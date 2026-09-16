#!/usr/bin/env node
// Deterministic extraction/review benchmark. Fixture-owned semantic keys prevent model-specific IDs
// from inflating scores. Canonical mutation cases prove known omission classes remain observable.

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const CANONICAL_FIXTURE = join(scriptDir, '../fixtures/vnext-review-benchmark.json')
const BENCHMARK_CLIENTS = new Set(['claude', 'pi'])
const unique = (values) => new Set(Array.isArray(values) ? values : [])

function semanticKeys(values, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && !values.length)) throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`)
  if (values.some((value) => typeof value !== 'string' || !value.trim())) throw new Error(`${label} must contain non-empty strings`)
  if (new Set(values).size !== values.length) throw new Error(`${label} must not contain duplicates`)
  return values
}

function setScore(expectedValues, actualValues) {
  const expected = unique(expectedValues)
  const actual = unique(actualValues)
  const truePositive = [...actual].filter((value) => expected.has(value)).length
  const falsePositive = [...actual].filter((value) => !expected.has(value)).length
  const falseNegative = [...expected].filter((value) => !actual.has(value)).length
  const precision = actual.size ? truePositive / actual.size : expected.size ? 0 : 1
  const recall = expected.size ? truePositive / expected.size : 1
  return {
    expected: expected.size,
    actual: actual.size,
    truePositive,
    falsePositive,
    falseNegative,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number((precision + recall ? (2 * precision * recall) / (precision + recall) : 0).toFixed(4)),
  }
}

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

function validateCase(fixture) {
  if (!fixture?.caseId?.trim()) throw new Error('every benchmark case requires caseId')
  if (!Array.isArray(fixture.sourceUnits) || !fixture.sourceUnits.length) throw new Error(`${fixture.caseId} requires non-empty sourceUnits`)
  for (const [index, unit] of fixture.sourceUnits.entries()) {
    if (!unit?.sourceId?.trim() || !unit?.text?.trim()) throw new Error(`${fixture.caseId}.sourceUnits[${index}] requires sourceId and text`)
  }
  semanticKeys(fixture.expectedRequirementKeys, `${fixture.caseId}.expectedRequirementKeys`)
  semanticKeys(fixture.expectedSurfaceKeys, `${fixture.caseId}.expectedSurfaceKeys`, { allowEmpty: true })
  if (fixture.runs !== undefined && !Array.isArray(fixture.runs)) throw new Error(`${fixture.caseId}.runs must be an array`)
  if (fixture.mutations !== undefined && !Array.isArray(fixture.mutations)) throw new Error(`${fixture.caseId}.mutations must be an array`)
}

function mutationResult(fixture, mutation) {
  if (!mutation?.mutationId?.trim()) throw new Error(`${fixture.caseId} mutation requires mutationId`)
  const actualRequirements = semanticKeys(mutation.requirementKeys, `${fixture.caseId}/${mutation.mutationId}.requirementKeys`, { allowEmpty: true })
  const actualSurfaces = semanticKeys(mutation.surfaceKeys, `${fixture.caseId}/${mutation.mutationId}.surfaceKeys`, { allowEmpty: true })
  const declaredMissingRequirements = semanticKeys(mutation.expectedMissingRequirementKeys, `${fixture.caseId}/${mutation.mutationId}.expectedMissingRequirementKeys`, { allowEmpty: true })
  const declaredMissingSurfaces = semanticKeys(mutation.expectedMissingSurfaceKeys, `${fixture.caseId}/${mutation.mutationId}.expectedMissingSurfaceKeys`, { allowEmpty: true })
  const requirementScore = setScore(fixture.expectedRequirementKeys, actualRequirements)
  const surfaceScore = setScore(fixture.expectedSurfaceKeys, actualSurfaces)
  const missingRequirementKeys = fixture.expectedRequirementKeys.filter((key) => !actualRequirements.includes(key))
  const missingSurfaceKeys = fixture.expectedSurfaceKeys.filter((key) => !actualSurfaces.includes(key))
  const unexpectedRequirementKeys = actualRequirements.filter((key) => !fixture.expectedRequirementKeys.includes(key))
  const unexpectedSurfaceKeys = actualSurfaces.filter((key) => !fixture.expectedSurfaceKeys.includes(key))
  const expectationMatched = sameValues(missingRequirementKeys, declaredMissingRequirements)
    && sameValues(missingSurfaceKeys, declaredMissingSurfaces)
  const omissionDetected = missingRequirementKeys.length + missingSurfaceKeys.length > 0
  const noUnexpectedKeys = unexpectedRequirementKeys.length + unexpectedSurfaceKeys.length === 0
  return {
    caseId: fixture.caseId,
    mutationId: mutation.mutationId,
    omissionClass: mutation.omissionClass,
    requirementScore,
    surfaceScore,
    missingRequirementKeys,
    missingSurfaceKeys,
    unexpectedRequirementKeys,
    unexpectedSurfaceKeys,
    omissionDetected,
    expectationMatched,
    passed: omissionDetected && expectationMatched && noUnexpectedKeys,
  }
}

export function buildBenchmarkReport(input, { generatedAt = new Date().toISOString() } = {}) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.cases) || !input.cases.length) throw new Error('benchmark input requires schemaVersion=1 and non-empty cases')
  const policy = input.policy || { defaultClient: 'claude', allowedClients: ['claude', 'pi'] }
  if (policy.defaultClient !== 'claude') throw new Error('benchmark policy defaultClient must remain claude')
  if (!Array.isArray(policy.allowedClients) || !sameValues(policy.allowedClients, [...BENCHMARK_CLIENTS])) throw new Error('benchmark policy allowedClients must be exactly claude and pi')
  const caseIds = input.cases.map((fixture) => fixture.caseId)
  if (new Set(caseIds).size !== caseIds.length) throw new Error('benchmark caseId values must be unique')

  const runs = []
  const mutationRuns = []
  for (const fixture of input.cases) {
    validateCase(fixture)
    const mutationIds = (fixture.mutations || []).map((mutation) => mutation.mutationId)
    if (new Set(mutationIds).size !== mutationIds.length) throw new Error(`${fixture.caseId} mutationId values must be unique`)
    mutationRuns.push(...(fixture.mutations || []).map((mutation) => mutationResult(fixture, mutation)))
    for (const run of fixture.runs || []) {
      if (!BENCHMARK_CLIENTS.has(run.client)) throw new Error(`${fixture.caseId} run client must be claude or pi`)
      semanticKeys(run.requirementKeys, `${fixture.caseId}.${run.client}.requirementKeys`, { allowEmpty: true })
      semanticKeys(run.surfaceKeys, `${fixture.caseId}.${run.client}.surfaceKeys`, { allowEmpty: true })
      const requirements = setScore(fixture.expectedRequirementKeys, run.requirementKeys)
      const surfaces = setScore(fixture.expectedSurfaceKeys, run.surfaceKeys)
      runs.push({
        caseId: fixture.caseId,
        client: run.client,
        model: run.model || 'default',
        requirements,
        surfaces,
        firstReviewPassed: run.reviewVerdict === 'pass',
        reviewFindingCount: Number.isInteger(run.reviewFindingCount) ? run.reviewFindingCount : null,
        durationMs: Number.isFinite(run.durationMs) ? run.durationMs : null,
        tokenCount: Number.isFinite(run.tokenCount) ? run.tokenCount : null,
      })
    }
  }
  const identities = [...new Set(runs.map((run) => `${run.client}\u0000${run.model}`))]
  const candidates = identities.map((identity) => {
    const [client, model] = identity.split('\u0000')
    const samples = runs.filter((run) => run.client === client && run.model === model)
    const sum = (select) => samples.reduce((total, item) => total + select(item), 0)
    const requirementsExpected = sum((item) => item.requirements.expected)
    const requirementsTp = sum((item) => item.requirements.truePositive)
    const surfacesExpected = sum((item) => item.surfaces.expected)
    const surfacesTp = sum((item) => item.surfaces.truePositive)
    return {
      client,
      model,
      sampleCount: samples.length,
      requirementRecall: requirementsExpected ? Number((requirementsTp / requirementsExpected).toFixed(4)) : 1,
      surfaceRecall: surfacesExpected ? Number((surfacesTp / surfacesExpected).toFixed(4)) : 1,
      falsePositives: sum((item) => item.requirements.falsePositive + item.surfaces.falsePositive),
      firstReviewPassRate: Number((samples.filter((item) => item.firstReviewPassed).length / samples.length).toFixed(4)),
      reviewFindings: sum((item) => item.reviewFindingCount || 0),
      durationMs: samples.every((item) => item.durationMs !== null) ? sum((item) => item.durationMs) : null,
      tokenCount: samples.every((item) => item.tokenCount !== null) ? sum((item) => item.tokenCount) : null,
    }
  }).sort((a, b) =>
    b.requirementRecall - a.requirementRecall
    || b.surfaceRecall - a.surfaceRecall
    || a.falsePositives - b.falsePositives
    || b.firstReviewPassRate - a.firstReviewPassRate
    || a.reviewFindings - b.reviewFindings
    || (a.durationMs ?? Number.MAX_SAFE_INTEGER) - (b.durationMs ?? Number.MAX_SAFE_INTEGER)
    || (a.tokenCount ?? Number.MAX_SAFE_INTEGER) - (b.tokenCount ?? Number.MAX_SAFE_INTEGER))
  const mutationSummary = {
    total: mutationRuns.length,
    passed: mutationRuns.filter((run) => run.passed).length,
    ok: mutationRuns.length > 0 && mutationRuns.every((run) => run.passed),
  }
  return { schemaVersion: 1, generatedAt, policy, caseCount: input.cases.length, runs, mutationRuns, mutationSummary, ranking: candidates, recommended: candidates[0] || null }
}

export function selfTest() {
  const canonical = buildBenchmarkReport(JSON.parse(readFileSync(CANONICAL_FIXTURE, 'utf8')), { generatedAt: '2026-09-14T00:00:00Z' })
  assert.equal(canonical.caseCount, 3)
  assert.equal(canonical.mutationSummary.total, 4)
  assert.equal(canonical.mutationSummary.ok, true)
  assert.equal(canonical.recommended, null, 'canonical deterministic fixture must not fabricate model runs')

  const report = buildBenchmarkReport({ schemaVersion: 1, policy: { defaultClient: 'claude', allowedClients: ['claude', 'pi'] }, cases: [{
    caseId: 'ranking', sourceUnits: [{ sourceId: 'SRC-1', text: 'Cover both entries.' }], expectedRequirementKeys: ['a', 'b'], expectedSurfaceKeys: ['x', 'y'], mutations: [], runs: [
      { client: 'pi', requirementKeys: ['a'], surfaceKeys: ['x'], reviewVerdict: 'changes-required', reviewFindingCount: 2, durationMs: 100 },
      { client: 'claude', requirementKeys: ['a', 'b'], surfaceKeys: ['x', 'y'], reviewVerdict: 'pass', reviewFindingCount: 0, durationMs: 200 },
    ],
  }] }, { generatedAt: '2026-09-14T00:00:00Z' })
  assert.equal(report.recommended.client, 'claude')
  assert.equal(report.ranking[0].requirementRecall, 1)
  assert.equal(report.runs[0].requirements.falseNegative, 1)
  const undetected = buildBenchmarkReport({ schemaVersion: 1, cases: [{
    caseId: 'bad-mutation', sourceUnits: [{ sourceId: 'S', text: 'x' }], expectedRequirementKeys: ['a'], expectedSurfaceKeys: [], runs: [], mutations: [
      { mutationId: 'no-omission', omissionClass: 'fixture-error', requirementKeys: ['a'], surfaceKeys: [], expectedMissingRequirementKeys: [], expectedMissingSurfaceKeys: [] },
    ],
  }] })
  assert.equal(undetected.mutationSummary.ok, false)
  assert.throws(() => buildBenchmarkReport({ schemaVersion: 1, policy: { defaultClient: 'claude', allowedClients: ['claude', 'pi'] }, cases: [{ caseId: 'bad', sourceUnits: [{ sourceId: 'S', text: 'x' }], expectedRequirementKeys: ['a'], expectedSurfaceKeys: [], runs: [{ client: 'codex', requirementKeys: ['a'], surfaceKeys: [] }] }] }), /claude or pi/)
  console.log('vnext-review-benchmark self-test passed')
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else try {
    const inputFile = argumentValue('--input')
    if (!inputFile) throw new Error('--input <benchmark.json> is required')
    const report = buildBenchmarkReport(JSON.parse(readFileSync(resolve(inputFile), 'utf8')))
    const outputFile = argumentValue('--out')
    if (outputFile) writeFileSync(resolve(outputFile), `${JSON.stringify(report, null, 2)}\n`)
    else console.log(JSON.stringify(report, null, 2))
    if (!report.mutationSummary.ok) process.exitCode = 1
  } catch (error) {
    console.error(`vNext review benchmark failed: ${error.message}`)
    process.exitCode = 2
  }
}
