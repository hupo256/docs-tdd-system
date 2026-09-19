#!/usr/bin/env node
// Claim-to-assertion audit for functional, runtime, human, structural, and quality evidence.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { matchesEffectiveCodeState } from './fingerprint.mjs'

const RUNTIME_LANGUAGE = /(?:点击|打开|切换|选择|关闭后|提交后|恢复|禁用|重发|跳转|弹出|交互)|\b(?:click|open|toggle|switch|select|after close|after submit|restore|disable|resend|redirect|navigate|interaction)\b/i
const SIDE_EFFECT_LANGUAGE = /(?:保存|提交|更新|创建|删除|发送|写入|状态变化|副作用)|\b(?:save|submit|update|create|delete|send|write|state change|side effect)\b/i
const FUNCTIONAL_KINDS = new Set(['copy-literal', 'component-dom', 'pure-logic', 'payload-contract', 'api-contract', 'browser-interaction', 'human-check'])
const QUALITY_KINDS = new Set(['structural', 'quality', 'touched-file-quality', 'directed-quality'])

const passing = (facts) => facts.filter((fact) => fact.result === 'pass' && (fact.producer?.kind !== 'command' || fact.producer.exitCode === 0))

export function runtimeCriticalRequirementIds(workItem) {
  return (workItem?.requirements || [])
    .filter((requirement) => requirement.status === 'doing')
    .filter((requirement) => RUNTIME_LANGUAGE.test(requirement.statement || '')
      || (requirement.evidencePlan || []).some((plan) => plan.runtimeRequired || plan.type === 'browser-interaction'))
    .map((requirement) => requirement.requirementId)
}

export function manualRunEvidenceFacts(workItem, currentCodeState) {
  const run = workItem?.manualTestRun
  if (!run || run.status !== 'passed' || !matchesEffectiveCodeState(run.codeFingerprint, currentCodeState)) return []
  return (run.scenarios || run.results || []).filter((scenario) => scenario.result === 'passed').map((scenario) => ({
    evidenceId: `human-check:${run.runId}:${scenario.scenarioId || scenario.requirementId}`,
    kind: 'human-check',
    result: 'pass',
    codeFingerprint: run.codeFingerprint,
    requirementIds: scenario.requirementIds || [scenario.requirementId].filter(Boolean),
    surfaceIds: scenario.surfaceIds || [],
    evidenceRefs: scenario.evidenceRefs?.length ? scenario.evidenceRefs : [`manual-run:${run.runId}`],
    producer: {
      kind: 'human',
      confirmedBy: run.confirmedBy,
      confirmedAt: run.confirmedAt,
      steps: scenario.steps || [scenario.title || scenario.scenarioId || 'manual scenario'],
      expected: scenario.expected || scenario.title || 'matches the requirement',
      actual: scenario.actual || scenario.actualResult,
      unresolved: scenario.unresolved || [],
    },
  }))
}

function validRuntimeFact(fact, requirementId) {
  if (!(fact.requirementIds || []).includes(requirementId)) return false
  if (fact.kind === 'browser-interaction') return fact.producer?.kind === 'command' || fact.producer?.kind === 'human'
  if (fact.kind !== 'human-check' || fact.producer?.kind !== 'human') return false
  return Array.isArray(fact.producer.steps) && fact.producer.steps.length > 0
    && Boolean(fact.producer.expected?.trim())
    && Boolean(fact.producer.actual?.trim())
    && !(fact.producer.unresolved || []).length
}

function humanFactProblems(fact) {
  if (fact.kind !== 'human-check') return []
  const problems = []
  if (fact.producer?.kind !== 'human') problems.push(`${fact.evidenceId} human-check must use a human producer`)
  if (!Array.isArray(fact.producer?.steps) || !fact.producer.steps.length) problems.push(`${fact.evidenceId} human-check requires steps`)
  if (!fact.producer?.expected?.trim()) problems.push(`${fact.evidenceId} human-check requires expected`)
  if (!fact.producer?.actual?.trim()) problems.push(`${fact.evidenceId} human-check requires actual`)
  if ((fact.producer?.unresolved || []).length) problems.push(`${fact.evidenceId} human-check has unresolved items`)
  return problems
}

export function auditEvidenceSufficiency({ workItem, evidence, currentCodeState } = {}) {
  const commandFacts = evidence?.facts || []
  const humanFacts = manualRunEvidenceFacts(workItem, currentCodeState)
  const facts = passing([...commandFacts, ...humanFacts])
  const problems = []
  const warnings = []

  for (const fact of [...commandFacts, ...humanFacts]) problems.push(...humanFactProblems(fact))
  for (const fact of facts) {
    const requirementCount = (fact.requirementIds || []).length
    const surfaceCount = (fact.surfaceIds || []).length
    if (FUNCTIONAL_KINDS.has(fact.kind) && (requirementCount > 5 || surfaceCount > 8) && !(fact.assertionIds || []).length) {
      problems.push(`${fact.evidenceId} binds too many claims without assertionIds`)
    }
    if (QUALITY_KINDS.has(fact.kind) && (requirementCount || surfaceCount)) {
      warnings.push(`${fact.evidenceId} quality evidence is not functional proof`)
    }
    if (fact.producer?.coverageRole === 'provider' && (fact.surfaceIds || []).length) {
      problems.push(`${fact.evidenceId} provider evidence cannot prove consumer surfaces`)
    }
    if (fact.producer?.mocked === true && fact.kind === 'browser-interaction') {
      problems.push(`${fact.evidenceId} mocked browser evidence cannot prove the real UI path`)
    }
  }

  const runtimeIds = new Set(runtimeCriticalRequirementIds(workItem))
  for (const requirement of (workItem?.requirements || []).filter((item) => item.status === 'doing')) {
    const requirementFacts = facts.filter((fact) => (fact.requirementIds || []).includes(requirement.requirementId))
    const hasRuntime = requirementFacts.some((fact) => validRuntimeFact(fact, requirement.requirementId))
    if (runtimeIds.has(requirement.requirementId) && !hasRuntime) {
      problems.push(`${requirement.requirementId} runtime critical path lacks browser-interaction or human-check evidence`)
    }
    if (SIDE_EFFECT_LANGUAGE.test(requirement.statement || '')
      && requirementFacts.some((fact) => ['component-dom', 'copy-literal'].includes(fact.kind))
      && !hasRuntime
      && !requirementFacts.some((fact) => ['payload-contract', 'pure-logic'].includes(fact.kind))) {
      problems.push(`${requirement.requirementId} DOM/static evidence cannot prove its side effect`)
    }
  }

  return {
    code: 'EVIDENCE_SUFFICIENCY',
    ok: problems.length === 0,
    problems: [...new Set(problems)].sort(),
    warnings: [...new Set(warnings)].sort(),
    runtimeCriticalRequirementIds: [...runtimeIds].sort(),
    humanEvidenceIds: humanFacts.map((fact) => fact.evidenceId),
    facts,
  }
}

export function selfTest() {
  const code = { isGitRepo: true, headSha: 'abc', contentHash: 'a', dirtyHash: 'b' }
  const workItem = {
    requirements: [{
      requirementId: 'R-001',
      status: 'doing',
      statement: 'Click save and update the visible state.',
      affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement' }],
      evidencePlan: [{ type: 'component-dom', runtimeRequired: true }],
    }],
  }
  const dom = {
    evidenceId: 'E-DOM',
    kind: 'component-dom',
    result: 'pass',
    requirementIds: ['R-001'],
    surfaceIds: ['S-001'],
    producer: { kind: 'command', exitCode: 0 },
  }
  assert.match(auditEvidenceSufficiency({ workItem, evidence: { facts: [dom] }, currentCodeState: code }).problems.join(' '), /runtime critical path/)
  const manualTestRun = {
    runId: 'run-1',
    status: 'passed',
    codeFingerprint: code,
    confirmedBy: 'tester',
    confirmedAt: '2026-09-19T00:00:00Z',
    scenarios: [{
      scenarioId: 'MT-001',
      title: 'Save',
      requirementIds: ['R-001'],
      surfaceIds: ['S-001'],
      result: 'passed',
      steps: ['Open the surface', 'Click save', 'Observe state'],
      expected: 'Visible state updates',
      actual: 'Visible state updated',
      unresolved: [],
    }],
  }
  const passed = auditEvidenceSufficiency({ workItem: { ...workItem, manualTestRun }, evidence: { facts: [dom] }, currentCodeState: code })
  assert.equal(passed.ok, true, JSON.stringify(passed.problems))
  const provider = { ...dom, evidenceId: 'E-PROVIDER', producer: { ...dom.producer, coverageRole: 'provider' } }
  assert.match(auditEvidenceSufficiency({ workItem: { ...workItem, manualTestRun }, evidence: { facts: [provider] }, currentCodeState: code }).problems.join(' '), /cannot prove consumer/)
  console.log('vnext-evidence-sufficiency self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
