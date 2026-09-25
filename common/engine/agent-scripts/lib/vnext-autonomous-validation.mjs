#!/usr/bin/env node
// Execute the evidence -> reconciliation -> formal verification chain in an isolated cache directory.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { requiresSurfaceReconciliation } from './vnext-reconcile.mjs'

function evidenceExecutionCounts(evidenceFile) {
  if (!existsSync(evidenceFile)) return { commandCount: 0, evidenceCount: 0 }
  const bundle = JSON.parse(readFileSync(evidenceFile, 'utf8'))
  const facts = Array.isArray(bundle?.facts) ? bundle.facts : []
  const executedCommands = new Set(facts
    .filter((fact) => fact?.producer?.kind === 'command')
    .map((fact) => JSON.stringify({
      command: fact.producer.command || '',
      startedAt: fact.producer.startedAt || '',
      finishedAt: fact.producer.finishedAt || '',
      stdoutHash: fact.producer.stdoutHash || '',
      stderrHash: fact.producer.stderrHash || '',
    })))
  return { commandCount: executedCommands.size, evidenceCount: facts.length }
}

export function runAutonomousValidation({ id, projectDir, workItem, worktree, baseRef = 'origin/online', executeScript, evidenceRoot = join(homedir(), '.cache/docs-tdd/evidence', id) } = {}) {
  const implementation = workItem?.autopilot?.implementation
  if (!implementation || implementation.status !== 'completed') {
    return { ok: false, step: 'preflight', error: 'implementation checkpoint is not complete' }
  }
  if (!worktree) return { ok: false, step: 'worktree', error: 'safe project worktree is required' }
  if (typeof executeScript !== 'function') throw new Error('executeScript adapter is required')

  mkdirSync(evidenceRoot, { recursive: true })
  const runDir = mkdtempSync(join(evidenceRoot, 'run-'))
  const evidenceFile = join(runDir, 'evidence.json')
  const surfacesFile = join(runDir, 'surfaces.json')
  writeFileSync(surfacesFile, `${JSON.stringify({
    discoveredSurfaces: implementation.discoveredSurfaces || [],
    coveredSurfaceIds: implementation.coveredSurfaceIds || [],
    ...(implementation.msw ? { msw: implementation.msw } : {}),
    blockers: implementation.blockers || [],
  }, null, 2)}\n`)

  const evidence = executeScript('vnext-evidence.mjs', [
    '--project', projectDir,
    '--worktree', worktree,
    '--base', baseRef,
    '--out', evidenceFile,
  ])
  // Exit 1 is an attested failing bundle and must still reach verify. Exit 2 is a runner failure.
  if (evidence.status !== 0 && evidence.status !== 1) {
    return {
      ok: false,
      step: 'evidence',
      evidenceDir: runDir,
      commandCount: 0,
      evidenceCount: 0,
      error: (evidence.stderr || evidence.stdout).trim().slice(0, 2000),
    }
  }
  const counts = evidenceExecutionCounts(evidenceFile)

  let reconciliationCount = 0
  if (requiresSurfaceReconciliation(workItem)) {
    reconciliationCount = 1
    const reconciliation = executeScript('vnext-reconcile.mjs', [
      '--project', projectDir,
      '--worktree', worktree,
      '--base', baseRef,
      '--evidence', evidenceFile,
    ])
    if (reconciliation.status !== 0) {
      return {
        ok: false,
        step: 'reconcile',
        evidenceExitCode: evidence.status,
        evidenceDir: runDir,
        commandCount: counts.commandCount + reconciliationCount,
        evidenceCount: counts.evidenceCount,
        error: (reconciliation.stderr || reconciliation.stdout).trim().slice(0, 2000),
      }
    }
  }

  const verify = executeScript('vnext-verify.mjs', [
    '--evidence', evidenceFile,
    '--surfaces', surfacesFile,
    '--project', projectDir,
    '--worktree', worktree,
    '--base', baseRef,
    '--write',
    '--out', projectDir,
  ])
  return {
    ok: verify.status === 0,
    step: 'verify',
    verifyExitCode: verify.status,
    evidenceExitCode: evidence.status,
    evidenceDir: runDir,
    commandCount: counts.commandCount + reconciliationCount + 1,
    evidenceCount: counts.evidenceCount,
    output: (verify.stdout || '').trim().slice(0, 4000),
    error: verify.status === 0 ? '' : (verify.stderr || verify.stdout).trim().slice(0, 2000),
  }
}

function selfTest() {
  const incomplete = runAutonomousValidation({ id: 'PR-00001', workItem: {} })
  assert.equal(incomplete.step, 'preflight')
  const calls = []
  const result = runAutonomousValidation({
    id: 'PR-00001',
    projectDir: '/project',
    worktree: '/worktree',
    workItem: { autopilot: { implementation: { status: 'completed', coveredSurfaceIds: [] } } },
    evidenceRoot: mkdtempSync(join(tmpdir(), 'vnext-autonomous-validation-')),
    executeScript: (script, args) => {
      calls.push(script)
      if (script === 'vnext-evidence.mjs') {
        const output = args[args.indexOf('--out') + 1]
        writeFileSync(output, `${JSON.stringify({
          facts: [{
            evidenceId: 'E-1',
            producer: {
              kind: 'command',
              command: '"node" "tests/a.test.mjs"',
              startedAt: '2026-09-24T00:00:00Z',
              finishedAt: '2026-09-24T00:00:01Z',
              stdoutHash: 'a',
              stderrHash: 'b',
            },
          }],
        })}\n`)
      }
      return { status: 0, stdout: script === 'vnext-verify.mjs' ? 'PASS' : '', stderr: '' }
    },
  })
  assert.deepEqual(calls, ['vnext-evidence.mjs', 'vnext-verify.mjs'])
  assert.equal(result.ok, true)
  assert.equal(result.commandCount, 2)
  assert.equal(result.evidenceCount, 1)
  const structuredCalls = []
  const structured = runAutonomousValidation({
    id: 'PR-00001',
    projectDir: '/project',
    worktree: '/worktree',
    workItem: {
      deliveryTarget: { app: 'apps/web' },
      requirements: [{ status: 'doing', affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement', codeLocator: { app: 'apps/web', symbol: 'Page' } }] }],
      autopilot: { implementation: { status: 'completed' } },
    },
    evidenceRoot: mkdtempSync(join(tmpdir(), 'vnext-autonomous-validation-structured-')),
    executeScript: (script, args) => {
      structuredCalls.push(script)
      if (script === 'vnext-evidence.mjs') {
        const output = args[args.indexOf('--out') + 1]
        writeFileSync(output, `${JSON.stringify({ facts: [] })}\n`)
      }
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(structured.ok, true)
  assert.deepEqual(structuredCalls, ['vnext-evidence.mjs', 'vnext-reconcile.mjs', 'vnext-verify.mjs'])
  assert.equal(structured.commandCount, 2)
  console.log('vnext-autonomous-validation self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
