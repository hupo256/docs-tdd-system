#!/usr/bin/env node
// Deterministic replay for vNext final-exit anti-fake-green behavior.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVNextExitResult, verifyExitResultIntegrity } from './lib/vnext-exit.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(scriptDir, '..', 'fixtures', 'vnext-exit-cases.json')

function mutate(base, mutation) {
  const input = structuredClone(base)
  if (mutation === 'stale-head') input.evidence.codeFingerprint.headSha = 'stale-head'
  else if (mutation === 'open-blocker') input.blockers.push({ blockerId: 'DEP-1', status: 'open', reason: 'backend contract unavailable', owner: 'api-owner' })
  else if (mutation === 'forged-command-pass') input.evidence.facts.find((item) => item.evidenceId === 'E-DIRECTED').producer.exitCode = 1
  else if (['missing-directed-evidence', 'forged-result-pass'].includes(mutation)) input.evidence.facts = input.evidence.facts.filter((item) => item.evidenceId !== 'E-DIRECTED')
  else throw new Error(`unknown exit replay mutation: ${mutation}`)
  return input
}

export function runExitReplay(path = fixturePath) {
  const fixture = JSON.parse(readFileSync(path, 'utf8'))
  const positive = buildVNextExitResult(fixture.base)
  const positiveIntegrity = verifyExitResultIntegrity(positive)
  const cases = fixture.cases.map((item) => {
    const input = mutate(fixture.base, item.mutation)
    const result = buildVNextExitResult(input)
    const derivedStatus = result.status
    if (item.mutation === 'forged-result-pass') {
      result.ok = true
      result.status = 'passed'
    }
    const integrity = verifyExitResultIntegrity(result)
    const actualFailures = result.checks.filter((entry) => !entry.ok).map((entry) => entry.code)
    if (!integrity.ok) actualFailures.push('RESULT_INTEGRITY')
    actualFailures.sort()
    const expectedFailures = [...item.expectedFailures].sort()
    const rejected = item.mutation === 'forged-result-pass' ? !integrity.ok : result.ok === false
    return {
      name: item.name,
      mutation: item.mutation,
      ok: JSON.stringify(actualFailures) === JSON.stringify(expectedFailures)
        && derivedStatus === item.expectedStatus
        && rejected,
      expectedFailures,
      actualFailures,
      expectedStatus: item.expectedStatus,
      derivedStatus,
      integrityProblems: integrity.problems,
    }
  })
  return { positive: { ok: positive.ok && positiveIntegrity.ok, result: positive, integrity: positiveIntegrity }, cases }
}

export function selfTest() {
  const replay = runExitReplay()
  assert.equal(replay.positive.ok, true, JSON.stringify(replay.positive))
  assert.equal(replay.cases.length, 5)
  assert.ok(replay.cases.every((item) => item.ok), JSON.stringify(replay.cases))
  console.log('vnext-exit-replay self-test passed (1 positive + 5 anti-fake-green cases)')
}

if (process.argv.includes('--self-test')) {
  selfTest()
} else {
  const replay = runExitReplay()
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: replay.positive.ok && replay.cases.every((item) => item.ok), ...replay }, null, 2))
  else {
    console.log(`${replay.positive.ok ? 'PASS' : 'FAIL'} positive control: complete V1 evidence on current HEAD`)
    for (const item of replay.cases) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}: expected [${item.expectedFailures.join(', ')}], got [${item.actualFailures.join(', ')}], status=${item.derivedStatus}`)
  }
  process.exitCode = replay.positive.ok && replay.cases.every((item) => item.ok) ? 0 : 1
}
