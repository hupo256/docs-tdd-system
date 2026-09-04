#!/usr/bin/env node
// Deterministic vNext incident replay. No model calls, no business repository access, no v1 gate mutation.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealCoverageAuditForFixture, verifyVNextCoverage } from './lib/vnext-work-item.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(scriptDir, '..', 'fixtures', 'vnext-replay')

function loadFixture(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function verifyFixtureState(fixture) {
  const workItem = sealCoverageAuditForFixture(fixture.workItem, { reviewRunId: fixture.workItem.coverageAudit?.reviewRunId || 'replay' })
  const result = verifyVNextCoverage({
    workItem,
    currentSourceSnapshot: fixture.currentSourceSnapshot || workItem.sourceSnapshot,
    sourceOracle: fixture.sourceOracle,
    discoveredSurfaces: fixture.discoveredSurfaces,
    implementation: fixture.implementation,
  })
  return {
    actualFailures: result.checks.filter((check) => !check.ok).map((check) => check.code).sort(),
    checks: result.checks,
  }
}

function applyPositiveControl(fixture) {
  const fixed = structuredClone(fixture)
  const control = fixed.positiveControl || {}
  fixed.workItem.requirements.push(...(control.addRequirements || []))
  for (const addition of control.addAffectedSurfaces || []) {
    const requirement = fixed.workItem.requirements.find((item) => item.requirementId === addition.requirementId)
    if (!requirement) throw new Error(`positive control references unknown requirement ${addition.requirementId}`)
    requirement.affectedSurfaces.push(addition.surface)
  }
  fixed.implementation = fixed.implementation || { coveredSurfaceIds: [] }
  fixed.implementation.coveredSurfaceIds.push(...(control.addCoveredSurfaceIds || []))
  if (control.refreshWorkItemSourceFromCurrent) {
    fixed.workItem.sourceSnapshot = structuredClone(fixed.currentSourceSnapshot)
    fixed.currentSourceSnapshot = structuredClone(fixed.workItem.sourceSnapshot)
  }
  return fixed
}

export function runReplayFixture(fixture) {
  const incident = verifyFixtureState(fixture)
  const expectedFailures = [...(fixture.expectedFailures || [])].sort()
  const fixed = verifyFixtureState(applyPositiveControl(fixture))
  const positiveControl = {
    ok: fixed.actualFailures.length === 0,
    actualFailures: fixed.actualFailures,
    checks: fixed.checks,
  }
  return {
    name: fixture.name,
    ok: JSON.stringify(incident.actualFailures) === JSON.stringify(expectedFailures) && positiveControl.ok,
    expectedFailures,
    actualFailures: incident.actualFailures,
    checks: incident.checks,
    positiveControl,
  }
}

export function runAllReplays(directory = fixtureDir) {
  if (!existsSync(directory)) throw new Error(`vNext replay fixture directory missing: ${directory}`)
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ file: name, ...runReplayFixture(loadFixture(join(directory, name))) }))
}

function main() {
  const results = runAllReplays()
  const asJson = process.argv.includes('--json')
  if (asJson) console.log(JSON.stringify({ ok: results.every((item) => item.ok), results }, null, 2))
  else {
    for (const result of results) {
      console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.file}: expected [${result.expectedFailures.join(', ')}], got [${result.actualFailures.join(', ')}]`)
      for (const check of result.checks.filter((item) => !item.ok)) {
        for (const problem of check.problems) console.log(`  - ${check.code}: ${problem}`)
      }
      console.log(`  positive control: ${result.positiveControl.ok ? 'PASS' : `FAIL [${result.positiveControl.actualFailures.join(', ')}]`}`)
    }
  }
  process.exit(results.every((item) => item.ok) ? 0 : 1)
}

export function selfTest() {
  const results = runAllReplays()
  assert.equal(results.length, 3)
  assert.ok(results.every((result) => result.ok), JSON.stringify(results))
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-02306')).actualFailures, ['REQUIREMENT_COVERAGE'])
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-01930')).actualFailures, ['SURFACE_COVERAGE'])
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-02265')).actualFailures, ['SOURCE_FRESH'])
  assert.ok(results.every((item) => item.positiveControl.ok))
  console.log('vnext-replay self-test passed (3 incident fixtures + 3 positive controls)')
}

if (process.argv.includes('--self-test')) selfTest()
else main()
