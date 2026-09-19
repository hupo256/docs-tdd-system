#!/usr/bin/env node
// Load and freshness-check the derived surface reconciliation without coupling it to project orchestration.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { codeFingerprint, matchesEffectiveCodeState } from './fingerprint.mjs'

export function inspectSurfaceReconciliation({ projectDir, workItem, worktree, baseRef = 'origin/online', measure = codeFingerprint } = {}) {
  const file = join(projectDir, 'reconcile-result.json')
  if (!existsSync(file)) return { result: null, current: false, problem: '' }
  try {
    const result = JSON.parse(readFileSync(file, 'utf8'))
    const scopePaths = result.scopeMode === 'path-set-v1' ? result.scopePaths : null
    const currentCodeState = measure(worktree, baseRef, { scopePaths })
    const recordedCodeState = {
      headSha: result.headSha,
      dirtyHash: result.dirtyHash,
      contentHash: result.contentHash,
      ...(result.scopeMode ? { scopeMode: result.scopeMode, scopePaths: result.scopePaths || [] } : {}),
    }
    const current = matchesEffectiveCodeState(currentCodeState, recordedCodeState)
      && result.deliveryTargetApp === (workItem?.deliveryTarget?.app || '')
    return { result, current, problem: current ? '' : 'surface reconciliation is stale for the current code state or delivery target' }
  } catch (error) {
    return { result: null, current: false, problem: `cannot inspect surface reconciliation: ${error.message}` }
  }
}

export function executeSurfaceReconciliation({ projectDir, worktree, baseRef = 'origin/online', evidenceFile = '', executeScript } = {}) {
  const execution = executeScript('vnext-reconcile.mjs', [
    '--project', projectDir,
    '--worktree', worktree,
    '--base', baseRef,
    ...(evidenceFile ? ['--evidence', evidenceFile] : []),
  ])
  return {
    ok: [0, 1].includes(execution.status),
    step: 'reconcile',
    exitCode: execution.status,
    output: (execution.stdout || '').trim().slice(0, 4000),
    error: execution.status > 1 ? (execution.stderr || execution.stdout).trim().slice(0, 2000) : '',
  }
}

function selfTest() {
  const projectDir = mkdtempSync(join(tmpdir(), 'vnext-reconcile-runtime-'))
  try {
    const result = {
      schemaVersion: 1,
      projectId: 'PR-00001',
      headSha: 'head',
      dirtyHash: 'dirty',
      contentHash: 'content',
      deliveryTargetApp: 'apps/web',
    }
    writeFileSync(join(projectDir, 'reconcile-result.json'), JSON.stringify(result))
    const measure = () => ({ headSha: 'head', dirtyHash: 'dirty', contentHash: 'content' })
    assert.equal(inspectSurfaceReconciliation({ projectDir, workItem: { deliveryTarget: { app: 'apps/web' } }, worktree: '/tmp', measure }).current, true)
    assert.equal(inspectSurfaceReconciliation({ projectDir, workItem: { deliveryTarget: { app: 'apps/other' } }, worktree: '/tmp', measure }).current, false)
    const executed = executeSurfaceReconciliation({ projectDir, worktree: '/tmp', executeScript: () => ({ status: 1, stdout: 'partial', stderr: '' }) })
    assert.equal(executed.ok, true)
    assert.equal(executed.exitCode, 1)
    console.log('vnext-reconcile-runtime self-test passed')
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

if (process.argv.includes('--self-test')) selfTest()
