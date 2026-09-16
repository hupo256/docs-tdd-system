#!/usr/bin/env node
// Fingerprint-bound, scenario-oriented human pre-test used after bounded semantic review falls back.
// Only runtime-observable requirements are presented to the operator; machine IDs remain mapping metadata.

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isAbsolute, resolve } from 'node:path'
import { matchesEffectiveCodeState } from './fingerprint.mjs'
import { coverageFingerprints, stableFingerprint } from './vnext-work-item.mjs'

const RESULTS = new Set(['passed', 'failed', 'not-testable'])
const DURABLE_REF = /^(?:https:\/\/|evidence-run:|log:)/
const VISUAL_WORDS = /(?:视觉|界面|布局|样式|间距|对齐|响应式|截断|溢出|尺寸|颜色|圆角)|\b(?:UI|visual|layout|responsive|spacing|alignment|overflow)\b/i

export function requiresPretestHumanRun(workItem) {
  return workItem?.reviewControl?.requiresPretestHumanRun === true
}

function doingRequirements(workItem) {
  return (workItem?.requirements || []).filter((requirement) => requirement.status === 'doing')
}

function runtimeRequirements(workItem) {
  const doing = doingRequirements(workItem)
  const runtime = doing.filter((requirement) => (requirement.evidencePlan || []).some((item) => item.runtimeRequired))
  return runtime.length ? runtime : doing
}

function scenarioKinds(requirement) {
  const evidenceTypes = new Set((requirement.evidencePlan || []).map((item) => item.type))
  const hasVisual = evidenceTypes.has('visual') || VISUAL_WORDS.test(requirement.statement)
  const hasFunctional = [...evidenceTypes].some((type) => type !== 'visual')
  return hasVisual && hasFunctional ? ['functional', 'visual'] : hasVisual ? ['visual'] : ['functional']
}

function scenarioTitle(requirement, kind, index) {
  const text = String(requirement.statement || '').trim()
  const concise = text.split(/[：。；\n]/, 1)[0].trim()
  const base = concise && concise.length <= 70 ? concise : `验收场景 ${index + 1}`
  return `${base}（${kind === 'visual' ? '界面' : '功能'}）`
}

export function createManualTestScenarios(workItem) {
  const scenarios = runtimeRequirements(workItem).flatMap((requirement) => scenarioKinds(requirement).map((kind) => ({
    kind,
    title: '',
    expected: requirement.statement,
    requirementIds: [requirement.requirementId],
    surfaceIds: (requirement.affectedSurfaces || []).filter((surface) => surface.disposition === 'implement').map((surface) => surface.surfaceId),
  })))
  return scenarios.map((scenario, index) => ({ ...scenario, scenarioId: `MT-${String(index + 1).padStart(3, '0')}`, title: scenarioTitle({ statement: scenario.expected }, scenario.kind, index) }))
}

function runEntries(run) {
  return Array.isArray(run?.scenarios) ? run.scenarios : Array.isArray(run?.results) ? run.results : []
}

function hasNewOmissions(run) {
  return runEntries(run).some((item) => item.newOmissions?.length)
}

export function pretestHumanRunAction(workItem) {
  if (!requiresPretestHumanRun(workItem)) return null
  const run = workItem.manualTestRun
  const fingerprints = coverageFingerprints(workItem)
  if (run?.status === 'passed' && run.sourceFingerprint === fingerprints.sourceFingerprint && run.requirementsFingerprint === fingerprints.requirementsFingerprint) return null
  if (run && hasNewOmissions(run)) return {
    action: 'repair-manual-test-omissions', phase: 'planning', status: 'blocked',
    reason: 'The human run found scope omissions. Return to extraction before repairing or retesting implementation.',
    command: `docs-tdd extract ${workItem.projectId} --out <extraction.json>`,
    constraints: ['incorporate-every-new-omission', 'rerun-coverage-review-and-scope-approval', 'retest-with-fresh-fingerprints'],
  }
  if (run?.status === 'blocked') return {
    action: 'resolve-manual-test-blockers', phase: 'blocked', status: 'blocked',
    reason: 'At least one human scenario is not testable; resolve its recorded blocker and run a fresh test.',
    command: `docs-tdd manual-test ${workItem.projectId} --out <manual-test.json>`,
    constraints: ['not-testable-is-not-a-pass', 'resolve-recorded-blockers', 'confirm-a-fresh-run'],
  }
  if (run?.status === 'failed') {
    const requirementsById = new Map(doingRequirements(workItem).map((item) => [item.requirementId, item]))
    const failedKinds = new Set(runEntries(run).filter((item) => item.result === 'failed').flatMap((item) => {
      if (item.kind) return [item.kind]
      if (VISUAL_WORDS.test(item.actualResult || '')) return ['visual']
      return scenarioKinds(requirementsById.get(item.requirementId) || {})
    }))
    const visualOnly = failedKinds.size === 1 && failedKinds.has('visual')
    const functionalOnly = failedKinds.size === 1 && failedKinds.has('functional')
    return {
      action: visualOnly ? 'repair-manual-visual-failures' : functionalOnly ? 'repair-manual-functional-failures' : 'repair-manual-test-failures',
      phase: 'implementing', status: 'active',
      reason: visualOnly ? 'The human run found visual/UI regressions.' : functionalOnly ? 'The human run found functional regressions.' : 'The human run found both functional and visual regressions.',
      command: '',
      constraints: ['repair-recorded-failures-only', 'preserve-passed-scenarios', 'rerun-a-fresh-human-test-after-code-changes'],
    }
  }
  return {
    action: 'complete-pretest-human-run', phase: 'implementation-ready', status: 'waiting',
    reason: 'Bounded semantic review fell back to a human decision; one real pre-test run is required as the final omission safety net.',
    command: `docs-tdd manual-test ${workItem.projectId} --out <manual-test.json>`,
    constraints: ['cli-prefills-runtime-scenarios-environment-and-time', 'human-confirms-identity-and-scenario-results', 'not-testable-is-a-blocker-not-a-pass', 'new-omissions-return-to-extraction'],
  }
}

export function createManualTestTemplate(workItem, codeFingerprint, { worktree, baseRef = 'origin/online', generatedAt = new Date().toISOString() } = {}) {
  if (!requiresPretestHumanRun(workItem)) throw new Error('manual pre-test run is not required for this work item')
  if (!codeFingerprint?.isGitRepo || !codeFingerprint.contentHash) throw new Error('manual pre-test template requires a valid Git code fingerprint')
  const fingerprints = coverageFingerprints(workItem)
  return {
    schemaVersion: 2,
    projectId: workItem.projectId,
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    codeFingerprint,
    generatedAt,
    environment: { worktree: resolve(worktree), baseRef, headSha: codeFingerprint.headSha },
    confirmation: {
      confirmedBy: '',
      scenarios: createManualTestScenarios(workItem).map((scenario) => ({ ...scenario, result: 'pending', actualResult: '', evidenceRefs: [], blocker: '', newOmissions: [] })),
    },
  }
}

function validateEvidenceRef(ref, projectDir) {
  const value = String(ref).trim()
  if (!value) return false
  if (DURABLE_REF.test(value)) return true
  if (!projectDir) return !isAbsolute(value) && !value.startsWith('conversation-attachment:')
  const path = resolve(projectDir, value)
  return path.startsWith(`${resolve(projectDir)}/`) && existsSync(path)
}

export function applyManualTestConfirmation(workItem, input, currentCodeFingerprint, { confirmedAt = new Date().toISOString(), environment = input?.environment, projectDir } = {}) {
  if (!requiresPretestHumanRun(workItem)) throw new Error('manual pre-test run is not required for this work item')
  if (input?.schemaVersion !== 2 || input?.projectId !== workItem?.projectId) throw new Error('manual test schemaVersion/projectId does not match work item')
  const fingerprints = coverageFingerprints(workItem)
  if (input.sourceFingerprint !== fingerprints.sourceFingerprint || input.requirementsFingerprint !== fingerprints.requirementsFingerprint) throw new Error('manual test template is stale because source or requirements changed')
  if (!matchesEffectiveCodeState(input.codeFingerprint, currentCodeFingerprint)) throw new Error('manual test template is stale because effective code changed')
  if (!input.confirmation?.confirmedBy?.trim()) throw new Error('manual test confirmation requires confirmedBy')
  const scenarios = Array.isArray(input.confirmation.scenarios) ? input.confirmation.scenarios : []
  const expected = createManualTestScenarios(workItem)
  const expectedIds = expected.map((item) => item.scenarioId).sort()
  const actualIds = scenarios.map((item) => item?.scenarioId).sort()
  if (new Set(actualIds).size !== actualIds.length || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw new Error('manual test confirmation must contain every generated runtime scenario exactly once')
  const expectedById = new Map(expected.map((item) => [item.scenarioId, item]))
  for (const item of scenarios) {
    if (!RESULTS.has(item.result)) throw new Error(`${item.scenarioId} result must be passed, failed, or not-testable`)
    if (item.result === 'failed' && !item.actualResult?.trim()) throw new Error(`${item.scenarioId} failed requires actualResult`)
    if (item.result === 'not-testable' && !item.blocker?.trim()) throw new Error(`${item.scenarioId} not-testable requires blocker`)
    if (item.evidenceRefs !== undefined && (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.some((ref) => !validateEvidenceRef(ref, projectDir)))) throw new Error(`${item.scenarioId} evidenceRefs must be durable HTTPS/log refs or existing project-relative files`)
    if (item.newOmissions !== undefined && (!Array.isArray(item.newOmissions) || item.newOmissions.some((value) => !String(value).trim()))) throw new Error(`${item.scenarioId} newOmissions must contain non-empty strings`)
  }
  const hasBlocked = scenarios.some((item) => item.result === 'not-testable')
  const hasFailure = scenarios.some((item) => item.result === 'failed' || item.newOmissions?.length)
  const persistedScenarios = scenarios.map((item) => {
    const definition = expectedById.get(item.scenarioId)
    return {
      scenarioId: item.scenarioId, kind: definition.kind, title: definition.title,
      requirementIds: definition.requirementIds, surfaceIds: definition.surfaceIds,
      result: item.result, actualResult: item.actualResult?.trim() || (item.result === 'passed' ? '符合预期' : ''),
      ...(item.evidenceRefs?.length ? { evidenceRefs: item.evidenceRefs.map((ref) => ref.trim()) } : {}),
      ...(item.blocker?.trim() ? { blocker: item.blocker.trim() } : {}),
      ...(item.newOmissions?.length ? { newOmissions: item.newOmissions.map((value) => value.trim()) } : {}),
    }
  })
  return {
    schemaVersion: 2,
    runId: `manual-${confirmedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${stableFingerprint(persistedScenarios).slice(0, 8)}`,
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    codeFingerprint: currentCodeFingerprint,
    environment: structuredClone(environment || {}),
    confirmedBy: input.confirmation.confirmedBy.trim(), confirmedAt,
    status: hasBlocked ? 'blocked' : hasFailure ? 'failed' : 'passed', scenarios: persistedScenarios,
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
    projectId: 'PR-00001', sourceSnapshot: { revision: '1', contentHash: 'x', sources: [] }, reviewControl: { requiresPretestHumanRun: true },
    requirements: [
      { requirementId: 'R-001', statement: 'API schema is valid', status: 'doing', evidencePlan: [{ type: 'api-contract', runtimeRequired: false }], affectedSurfaces: [] },
      { requirementId: 'R-002', statement: '登录流程可正常完成', status: 'doing', evidencePlan: [{ type: 'browser-interaction', runtimeRequired: true }], affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement' }] },
      { requirementId: 'R-003', statement: '弹窗布局与设计一致', status: 'doing', evidencePlan: [{ type: 'browser-interaction', runtimeRequired: true }], affectedSurfaces: [{ surfaceId: 'S-002', disposition: 'implement' }] },
    ],
  }
  const code = { isGitRepo: true, headSha: 'abc', contentHash: 'a'.repeat(64), dirtyHash: 'd' }
  const template = createManualTestTemplate(workItem, code, { worktree: '/tmp/repo', generatedAt: '2026-09-14T00:00:00Z' })
  assert.equal(template.confirmation.scenarios.length, 3)
  assert.equal(template.confirmation.scenarios[2].kind, 'visual')
  template.confirmation.confirmedBy = 'tester@example.com'
  template.confirmation.scenarios.forEach((scenario) => { scenario.result = 'passed' })
  const run = applyManualTestConfirmation(workItem, template, code, { confirmedAt: '2026-09-14T00:01:00Z' })
  assert.equal(run.status, 'passed')
  assert.deepEqual(manualTestProblems({ ...workItem, manualTestRun: run }, code), [])
  const visualFailure = structuredClone(template)
  visualFailure.confirmation.scenarios[2].result = 'failed'
  visualFailure.confirmation.scenarios[2].actualResult = '间距错误'
  const visualRun = applyManualTestConfirmation(workItem, visualFailure, code)
  assert.equal(pretestHumanRunAction({ ...workItem, manualTestRun: visualRun }).action, 'repair-manual-visual-failures')
  const functionalFailure = structuredClone(template)
  functionalFailure.confirmation.scenarios[0].result = 'failed'
  functionalFailure.confirmation.scenarios[0].actualResult = '登录失败'
  const functionalRun = applyManualTestConfirmation(workItem, functionalFailure, code)
  assert.equal(pretestHumanRunAction({ ...workItem, manualTestRun: functionalRun }).action, 'repair-manual-functional-failures')
  const mixedFailure = structuredClone(visualFailure)
  mixedFailure.confirmation.scenarios[0].result = 'failed'
  mixedFailure.confirmation.scenarios[0].actualResult = '登录失败'
  const mixedRun = applyManualTestConfirmation(workItem, mixedFailure, code)
  assert.equal(pretestHumanRunAction({ ...workItem, manualTestRun: mixedRun }).action, 'repair-manual-test-failures')
  visualFailure.confirmation.scenarios[2].newOmissions = ['缺少重置密码页']
  const omissionRun = applyManualTestConfirmation(workItem, visualFailure, code)
  assert.equal(pretestHumanRunAction({ ...workItem, manualTestRun: omissionRun }).action, 'repair-manual-test-omissions')
  const blocked = structuredClone(template)
  blocked.confirmation.scenarios[0].result = 'not-testable'
  assert.throws(() => applyManualTestConfirmation(workItem, blocked, code), /requires blocker/)
  blocked.confirmation.scenarios[0].blocker = '缺少测试账号'
  const blockedRun = applyManualTestConfirmation(workItem, blocked, code)
  assert.equal(pretestHumanRunAction({ ...workItem, manualTestRun: blockedRun }).action, 'resolve-manual-test-blockers')
  const transientEvidence = structuredClone(template)
  transientEvidence.confirmation.scenarios[0].evidenceRefs = ['conversation-attachment:image-1']
  assert.throws(() => applyManualTestConfirmation(workItem, transientEvidence, code), /must be durable/)
  console.log('vnext-manual-test self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
