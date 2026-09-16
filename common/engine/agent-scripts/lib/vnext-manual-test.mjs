#!/usr/bin/env node
// Minimal, fingerprint-bound human pre-test run used only after bounded semantic review falls back.
// The CLI pre-fills scope, environment and time; the operator confirms only outcomes and identity.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { matchesEffectiveCodeState } from './fingerprint.mjs'
import { coverageFingerprints, stableFingerprint } from './vnext-work-item.mjs'

const RESULTS = new Set(['passed', 'failed', 'not-testable'])

export function requiresPretestHumanRun(workItem) {
  return workItem?.reviewControl?.requiresPretestHumanRun === true
}

function doingRequirements(workItem) {
  return (workItem?.requirements || []).filter((requirement) => requirement.status === 'doing')
}

export function pretestHumanRunAction(workItem) {
  if (!requiresPretestHumanRun(workItem)) return null
  const run = workItem.manualTestRun
  const fingerprints = coverageFingerprints(workItem)
  if (run?.status === 'passed' && run.sourceFingerprint === fingerprints.sourceFingerprint && run.requirementsFingerprint === fingerprints.requirementsFingerprint) return null
  return {
    action: 'complete-pretest-human-run', phase: 'implementation-ready', status: run?.status === 'blocked' ? 'blocked' : 'waiting',
    reason: run ? `The required human pre-test run is ${run.status}; repair or clear its blocker, then confirm a fresh run.` : 'Bounded semantic review fell back to a human decision; one real pre-test run is required as the final omission safety net.',
    command: `docs-tdd manual-test ${workItem.projectId} --out <manual-test.json>`,
    constraints: ['cli-prefills-scope-environment-and-time', 'human-confirms-identity-and-result', 'not-testable-is-a-blocker-not-a-pass', 'new-omissions-return-to-extraction'],
  }
}

export function createManualTestTemplate(workItem, codeFingerprint, {
  worktree,
  baseRef = 'origin/online',
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!requiresPretestHumanRun(workItem)) throw new Error('manual pre-test run is not required for this work item')
  if (!codeFingerprint?.isGitRepo || !codeFingerprint.contentHash) throw new Error('manual pre-test template requires a valid Git code fingerprint')
  const fingerprints = coverageFingerprints(workItem)
  return {
    schemaVersion: 1,
    projectId: workItem.projectId,
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    codeFingerprint,
    generatedAt,
    environment: {
      worktree: resolve(worktree),
      baseRef,
      headSha: codeFingerprint.headSha,
    },
    confirmation: {
      confirmedBy: '',
      results: doingRequirements(workItem).map((requirement) => ({
        requirementId: requirement.requirementId,
        expected: requirement.statement,
        surfaceIds: (requirement.affectedSurfaces || [])
          .filter((surface) => surface.disposition === 'implement')
          .map((surface) => surface.surfaceId),
        result: 'pending',
        actualResult: '',
        evidenceRefs: [],
        blocker: '',
        newOmissions: [],
      })),
    },
  }
}

export function applyManualTestConfirmation(workItem, input, currentCodeFingerprint, {
  confirmedAt = new Date().toISOString(),
  environment = input?.environment,
} = {}) {
  if (!requiresPretestHumanRun(workItem)) throw new Error('manual pre-test run is not required for this work item')
  if (input?.schemaVersion !== 1 || input?.projectId !== workItem?.projectId) throw new Error('manual test schemaVersion/projectId does not match work item')
  const fingerprints = coverageFingerprints(workItem)
  if (input.sourceFingerprint !== fingerprints.sourceFingerprint || input.requirementsFingerprint !== fingerprints.requirementsFingerprint) {
    throw new Error('manual test template is stale because source or requirements changed')
  }
  if (!matchesEffectiveCodeState(input.codeFingerprint, currentCodeFingerprint)) throw new Error('manual test template is stale because effective code changed')
  if (!input.confirmation?.confirmedBy?.trim()) throw new Error('manual test confirmation requires confirmedBy')
  const results = Array.isArray(input.confirmation.results) ? input.confirmation.results : []
  const expectedIds = doingRequirements(workItem).map((item) => item.requirementId).sort()
  const actualIds = results.map((item) => item?.requirementId).sort()
  if (new Set(actualIds).size !== actualIds.length || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error('manual test confirmation must contain every doing requirement exactly once')
  }
  for (const item of results) {
    if (!RESULTS.has(item.result)) throw new Error(`${item.requirementId} result must be passed, failed, or not-testable`)
    if (item.result === 'failed' && !item.actualResult?.trim()) throw new Error(`${item.requirementId} failed requires actualResult`)
    if (item.result === 'not-testable' && !item.blocker?.trim()) throw new Error(`${item.requirementId} not-testable requires blocker`)
    if (item.evidenceRefs !== undefined && (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.some((ref) => !String(ref).trim()))) throw new Error(`${item.requirementId} evidenceRefs must contain non-empty strings`)
    if (item.newOmissions !== undefined && (!Array.isArray(item.newOmissions) || item.newOmissions.some((value) => !String(value).trim()))) throw new Error(`${item.requirementId} newOmissions must contain non-empty strings`)
  }
  const hasBlocked = results.some((item) => item.result === 'not-testable')
  const hasFailure = results.some((item) => item.result === 'failed' || item.newOmissions?.length)
  const requirements = new Map(doingRequirements(workItem).map((item) => [item.requirementId, item]))
  return {
    schemaVersion: 1,
    runId: `manual-${confirmedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${stableFingerprint(results).slice(0, 8)}`,
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    codeFingerprint: currentCodeFingerprint,
    environment: structuredClone(environment || {}),
    confirmedBy: input.confirmation.confirmedBy.trim(),
    confirmedAt,
    status: hasBlocked ? 'blocked' : hasFailure ? 'failed' : 'passed',
    results: results.map((item) => ({
      requirementId: item.requirementId,
      surfaceIds: (requirements.get(item.requirementId)?.affectedSurfaces || []).filter((surface) => surface.disposition === 'implement').map((surface) => surface.surfaceId),
      result: item.result,
      actualResult: item.actualResult?.trim() || (item.result === 'passed' ? '符合预期' : ''),
      ...(item.evidenceRefs?.length ? { evidenceRefs: item.evidenceRefs.map((ref) => ref.trim()) } : {}),
      ...(item.blocker?.trim() ? { blocker: item.blocker.trim() } : {}),
      ...(item.newOmissions?.length ? { newOmissions: item.newOmissions.map((value) => value.trim()) } : {}),
    })),
  }
}

export function manualTestProblems(workItem, currentCodeFingerprint) {
  if (!requiresPretestHumanRun(workItem)) return []
  const run = workItem?.manualTestRun
  if (!run) return ['bounded review fallback requires a human pre-test run']
  const fingerprints = coverageFingerprints(workItem)
  const problems = []
  if (run.sourceFingerprint !== fingerprints.sourceFingerprint || run.requirementsFingerprint !== fingerprints.requirementsFingerprint) problems.push('human pre-test run is stale for current source/requirements')
  if (!matchesEffectiveCodeState(run.codeFingerprint, currentCodeFingerprint)) problems.push('human pre-test run is stale for current effective code')
  if (run.status !== 'passed') problems.push(`human pre-test run status is ${run.status || 'missing'}, not passed`)
  return problems
}

export function selfTest() {
  const workItem = {
    projectId: 'PR-00001', sourceSnapshot: { revision: '1', contentHash: 'x', sources: [] },
    reviewControl: { requiresPretestHumanRun: true },
    requirements: [{ requirementId: 'R-001', statement: 'works', status: 'doing', affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement' }] }],
  }
  const code = { isGitRepo: true, headSha: 'abc', contentHash: 'a'.repeat(64), dirtyHash: 'd' }
  const template = createManualTestTemplate(workItem, code, { worktree: '/tmp/repo', generatedAt: '2026-09-14T00:00:00Z' })
  template.confirmation.confirmedBy = 'tester@example.com'
  template.confirmation.results[0].result = 'passed'
  const run = applyManualTestConfirmation(workItem, template, code, { confirmedAt: '2026-09-14T00:01:00Z' })
  assert.equal(run.status, 'passed')
  assert.equal(run.results[0].actualResult, '符合预期')
  assert.deepEqual(manualTestProblems({ ...workItem, manualTestRun: run }, code), [])
  const blocked = structuredClone(template)
  blocked.confirmation.results[0].result = 'not-testable'
  assert.throws(() => applyManualTestConfirmation(workItem, blocked, code), /requires blocker/)
  console.log('vnext-manual-test self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
