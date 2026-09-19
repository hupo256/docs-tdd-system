#!/usr/bin/env node
// Deterministic vNext incident replay. No model calls, no business repository access, no v1 gate mutation.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sealCoverageAuditForFixture, verifyVNextCoverage } from './lib/vnext-work-item.mjs'
import { buildVNextExitResult } from './lib/vnext-exit.mjs'
import { deriveDeliveryTruth } from './lib/vnext-delivery-truth.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(scriptDir, '..', 'fixtures', 'vnext-replay')

function loadFixture(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function verifyCoverageState(fixture) {
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

function applyCoveragePositiveControl(fixture) {
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

function verifyExitEvidenceState(fixture) {
  const result = buildVNextExitResult({
    workItem: fixture.workItem,
    preflightChecks: fixture.preflightChecks || [],
    currentCodeState: fixture.currentCodeState,
    evidence: fixture.evidence,
    blockers: fixture.blockers || [],
    mode: fixture.mode || 'enforced',
    generatedAt: fixture.generatedAt || '2026-09-19T00:00:00.000Z',
  })
  return {
    actualFailures: result.checks.filter((item) => !item.ok).map((item) => item.code).sort(),
    checks: result.checks,
    result,
  }
}

function applyExitPositiveControl(fixture) {
  return {
    ...structuredClone(fixture),
    ...(fixture.positiveControl || {}),
    positiveControl: undefined,
  }
}

function verifyDeliveryTruthState(fixture) {
  const truth = deriveDeliveryTruth(fixture.deliveryInput || {})
  return {
    actualFailures: truth.authoritativeCompletion ? [] : ['AUTHORITATIVE_COMPLETION'],
    checks: [{
      code: 'AUTHORITATIVE_COMPLETION',
      ok: truth.authoritativeCompletion,
      problems: truth.blockers,
    }],
    truth,
  }
}

function applyDeliveryPositiveControl(fixture) {
  return {
    ...structuredClone(fixture),
    deliveryInput: structuredClone(fixture.positiveControl?.deliveryInput || {}),
    positiveControl: undefined,
  }
}

function evaluatorFor(fixture) {
  switch (fixture.evaluator || 'coverage') {
    case 'coverage':
      return { verify: verifyCoverageState, applyPositiveControl: applyCoveragePositiveControl }
    case 'exit-evidence':
      return { verify: verifyExitEvidenceState, applyPositiveControl: applyExitPositiveControl }
    case 'delivery-truth':
      return { verify: verifyDeliveryTruthState, applyPositiveControl: applyDeliveryPositiveControl }
    default:
      throw new Error(`unknown replay evaluator: ${fixture.evaluator}`)
  }
}

export function runReplayFixture(fixture) {
  const evaluator = evaluatorFor(fixture)
  const incident = evaluator.verify(fixture)
  const expectedFailures = [...(fixture.expectedFailures || [])].sort()
  const fixed = evaluator.verify(evaluator.applyPositiveControl(fixture))
  const positiveControl = {
    ok: fixed.actualFailures.length === 0,
    actualFailures: fixed.actualFailures,
    checks: fixed.checks,
  }
  const silentOmissionCount = expectedFailures.filter((failure) => !incident.actualFailures.includes(failure)).length
  const falseCompletionCount = fixture.evaluator === 'delivery-truth' && incident.truth?.authoritativeCompletion ? 1 : 0
  return {
    name: fixture.name,
    evaluator: fixture.evaluator || 'coverage',
    ok: JSON.stringify(incident.actualFailures) === JSON.stringify(expectedFailures)
      && positiveControl.ok
      && silentOmissionCount === 0
      && falseCompletionCount === 0,
    silentOmissionCount,
    falseCompletionCount,
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
  assert.equal(results.length, 4)
  assert.ok(results.every((result) => (
    result.ok
    && result.silentOmissionCount === 0
    && result.falseCompletionCount === 0
  )), JSON.stringify(results))
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-02306')).actualFailures, ['REQUIREMENT_COVERAGE'])
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-01930')).actualFailures, ['SURFACE_COVERAGE'])
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-02265')).actualFailures, ['REQUIRED_EVIDENCE', 'REQUIREMENT_EVIDENCE', 'SURFACE_EVIDENCE'])
  assert.deepEqual(results.find((item) => item.file.startsWith('PR-01947')).actualFailures, ['AUTHORITATIVE_COMPLETION'])
  assert.ok(results.every((item) => item.positiveControl.ok))
  console.log('vnext-replay self-test passed (4 incident fixtures + 4 positive controls)')
}

if (process.argv.includes('--self-test')) selfTest()
else main()
