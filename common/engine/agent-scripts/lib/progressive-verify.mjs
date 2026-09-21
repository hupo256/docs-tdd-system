#!/usr/bin/env node
// v3.5 progressive verification provides preflight feedback only.
// The canonical delivery result is produced exclusively by vnext-verify.mjs.

import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runCommand } from './vnext-command-runner.mjs'

const DEFAULT_TIMEOUT_MS = 120_000

export async function level1Check(files, options = {}) {
  const { root = process.cwd(), fast = true, runner = runCommand } = options
  const lintArgv = ['npx', 'biome', 'check', ...(fast ? ['--fast'] : []), ...files]
  const typeArgv = ['npx', 'tsc', ...(fast ? ['--incremental'] : ['--noEmit']), ...files]
  return await runPreflight([
    ['lint', lintArgv],
    ['tsc', typeArgv],
  ], { root, runner })
}

export async function level2Check(files, relatedTests, options = {}) {
  const {
    root = process.cwd(),
    writeCheckpoint = true,
    runner = runCommand,
  } = options
  const steps = [
    ['lint', ['npx', 'biome', 'check', ...files]],
    ['tsc', ['npx', 'tsc', '--noEmit', ...files]],
  ]
  if (relatedTests.length > 0) {
    steps.push(['tests', ['npx', 'vitest', 'run', ...relatedTests]])
  }

  const results = await runPreflight(steps, { root, runner })
  if (relatedTests.length === 0) results.tests = { passed: true, notRequired: true }
  if (writeCheckpoint) {
    writeCheckpointFile({
      kind: 'progressive-preflight',
      deliveryAuthority: false,
      status: results.passed ? 'partial-pass' : 'partial-fail',
      files,
      results,
      timestamp: new Date().toISOString(),
    }, { root })
  }
  return results
}

export async function level3Check(workItem, options = {}) {
  const { root = process.cwd(), runner = runCommand } = options
  const evidenceResults = []
  const startedAt = Date.now()

  for (const command of workItem.evidenceCommands || []) {
    const result = await executeArgv(command.argv, {
      root,
      runner,
      timeoutMs: (command.timeoutSeconds || 120) * 1000,
    })
    evidenceResults.push({
      evidenceId: command.evidenceId || '',
      argv: command.argv,
      ...result,
    })
  }

  return {
    passed: evidenceResults.every((result) => result.passed),
    kind: 'progressive-preflight',
    deliveryAuthority: false,
    formalVerifyRequired: true,
    evidenceResults,
    timeSpent: Date.now() - startedAt,
  }
}

async function runPreflight(steps, options) {
  const startedAt = Date.now()
  const results = {
    passed: true,
    kind: 'progressive-preflight',
    deliveryAuthority: false,
    formalVerifyRequired: true,
    timeSpent: 0,
  }
  for (const [name, argv] of steps) {
    results[name] = await executeArgv(argv, options)
    if (!results[name].passed) results.passed = false
  }
  results.timeSpent = Date.now() - startedAt
  return results
}

async function executeArgv(argv, options = {}) {
  const {
    root = process.cwd(),
    runner = runCommand,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options
  if (!Array.isArray(argv) || argv.length === 0 || argv.some((part) => typeof part !== 'string' || part.length === 0)) {
    return { passed: false, exitCode: 1, error: 'command argv must be a non-empty string array' }
  }
  try {
    const result = await runner({ argv, cwd: root, timeoutMs })
    return {
      passed: result.exitCode === 0,
      exitCode: result.exitCode,
      signal: result.signal || '',
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      ...(result.exitCode === 0 ? {} : { error: result.stderr || result.stdout || `command exited ${result.exitCode}` }),
    }
  } catch (error) {
    return { passed: false, exitCode: 1, error: error.message }
  }
}

function writeCheckpointFile(data, options = {}) {
  writeFileSync(resolve(options.root, '.checkpoint.json'), `${JSON.stringify(data, null, 2)}\n`)
}

export async function selfTest() {
  const seenArgv = []
  const runner = async ({ argv }) => {
    seenArgv.push(argv)
    return argv.includes('--fail')
      ? { exitCode: 2, signal: '', stdout: '', stderr: 'expected failure' }
      : { exitCode: 0, signal: '', stdout: 'ok', stderr: '' }
  }

  const level1 = await level1Check(['src/a.ts'], { runner })
  assert.equal(level1.passed, true)
  assert.equal(level1.deliveryAuthority, false)

  const level3 = await level3Check({
    evidenceCommands: [
      { evidenceId: 'E-pass', argv: ['node', 'test.mjs'] },
      { evidenceId: 'E-fail', argv: ['node', 'test.mjs', '--fail'] },
      { evidenceId: 'E-argv', argv: ['node', 'test.mjs', 'value; touch /tmp/should-not-run'] },
    ],
  }, { runner })
  assert.equal(level3.passed, false)
  assert.equal(level3.deliveryAuthority, false)
  assert.equal(level3.formalVerifyRequired, true)
  assert.equal(seenArgv.at(-1)[2], 'value; touch /tmp/should-not-run')
  assert(!('verifyResultPath' in level3))

  console.log('progressive-verify self-test passed')
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--self-test')) {
  selfTest().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
