#!/usr/bin/env node
// Pure vNext final-exit aggregation. PASS is derived from fresh facts; caller-supplied PASS is never trusted.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { matchesEffectiveCodeState } from './fingerprint.mjs'
import { stableFingerprint, verificationWorkItemFingerprint } from './vnext-work-item.mjs'
import { evidenceBundleFingerprint, signEvidenceBundle, verifyEvidenceAttestation, verifyEvidenceReceipt } from './vnext-evidence-receipt.mjs'
import { auditEvidenceSufficiency, manualRunEvidenceFacts } from './vnext-evidence-sufficiency.mjs'

export const EXIT_EVIDENCE_REQUIREMENTS = Object.freeze({
  V0: Object.freeze(['touched-file-quality']),
  V1: Object.freeze(['directed-tests', 'prd-to-diff-review']),
  V2: Object.freeze(['contract-or-scenario-tests', 'directed-quality']),
})

const evidenceResults = new Set(['pass', 'fail', 'blocked', 'not-applicable'])
const producerKinds = new Set(['command', 'human'])
const browserEvidenceKinds = new Set(['browser-interaction'])
const failureDomains = new Set(['source', 'scope', 'code', 'browser', 'environment', 'external-dependency'])

function check(code, problems, evidenceIds = []) {
  return { code, ok: problems.length === 0, problems, evidenceIds }
}

const sameCodeState = matchesEffectiveCodeState

function evidenceIntegrityProblems(evidence, attestationProblems = []) {
  const problems = []
  const ids = (evidence?.facts || []).map((fact) => fact.evidenceId).filter(Boolean)
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) problems.push(`duplicate evidence IDs: ${[...new Set(duplicates)].join(', ')}`)
  if (!evidence?.runId?.trim()) problems.push('evidence runId is required')
  if (!evidence?.capturedAt || Number.isNaN(Date.parse(evidence.capturedAt))) problems.push('evidence capturedAt must be an ISO timestamp')
  if (!Array.isArray(evidence?.facts)) problems.push('evidence facts must be an array')
  const hasReceipt = Boolean(evidence?.receipt)
  if (hasReceipt) {
    if (evidence?.assuranceMode !== 'autonomous' || evidence?.evidenceTrust !== 'cli-attested') problems.push('receipt-backed evidence must declare autonomous / cli-attested')
    problems.push(...attestationProblems)
  } else if ((evidence?.assuranceMode && evidence.assuranceMode !== 'assisted-pilot') || (evidence?.evidenceTrust && evidence.evidenceTrust !== 'caller-supplied')) {
    problems.push('evidence without a CLI receipt must remain assisted-pilot / caller-supplied')
  }

  for (const fact of evidence?.facts || []) {
    if (!fact.evidenceId?.trim() || !fact.kind?.trim()) problems.push('every evidence fact requires evidenceId and kind')
    if (!evidenceResults.has(fact.result)) problems.push(`${fact.evidenceId || 'evidence'} has invalid result`)
    if (!producerKinds.has(fact.producer?.kind)) problems.push(`${fact.evidenceId || 'evidence'} has invalid producer`)
    if (!Array.isArray(fact.evidenceRefs) || !fact.evidenceRefs.length) problems.push(`${fact.evidenceId || 'evidence'} requires evidenceRefs`)
    if (fact.producer?.kind === 'command') {
      if (!fact.producer.command?.trim() || !Number.isInteger(fact.producer.exitCode)) problems.push(`${fact.evidenceId} command evidence requires command and exitCode`)
      if (!fact.producer.startedAt || Number.isNaN(Date.parse(fact.producer.startedAt)) || !fact.producer.finishedAt || Number.isNaN(Date.parse(fact.producer.finishedAt))) {
        problems.push(`${fact.evidenceId} command evidence requires valid timestamps`)
      }
      const derived = fact.producer.exitCode === 0 ? 'pass' : 'fail'
      if (fact.result !== derived) problems.push(`${fact.evidenceId} claims ${fact.result} but exitCode derives ${derived}`)
    }
    if (fact.producer?.kind === 'human') {
      if (!fact.producer.confirmedBy?.trim() || !fact.producer.confirmedAt || Number.isNaN(Date.parse(fact.producer.confirmedAt))) {
        problems.push(`${fact.evidenceId} human evidence requires confirmer and timestamp`)
      }
    }
    if (['blocked', 'not-applicable'].includes(fact.result) && !fact.reason?.trim()) problems.push(`${fact.evidenceId} ${fact.result} requires a reason`)
  }
  return problems
}

function evidenceFreshnessProblems(evidence, currentCodeState) {
  const problems = []
  if (!currentCodeState?.isGitRepo || !currentCodeState.headSha || (!currentCodeState.contentHash && !currentCodeState.dirtyHash)) problems.push('current code state is not a valid Git fingerprint')
  if (!sameCodeState(evidence?.codeFingerprint, currentCodeState)) problems.push('evidence bundle does not match current effective code state')
  for (const fact of evidence?.facts || []) {
    if (!sameCodeState(fact.codeFingerprint, currentCodeState)) problems.push(`${fact.evidenceId || 'evidence'} does not match current effective code state`)
  }
  return problems
}

function passingFacts(evidence) {
  return (evidence?.facts || []).filter((fact) => fact.result === 'pass' && (fact.producer?.kind !== 'command' || fact.producer.exitCode === 0))
}

function requiredEvidenceProblems(level, evidence) {
  const requiredKinds = EXIT_EVIDENCE_REQUIREMENTS[level]
  if (!requiredKinds) return [`unknown level: ${level || 'missing'}`]
  const passedKinds = new Set(passingFacts(evidence).map((fact) => fact.kind))
  return requiredKinds.filter((kind) => !passedKinds.has(kind)).map((kind) => `${level} requires passing ${kind} evidence`)
}

function requirementEvidenceProblems(workItem, evidence) {
  const facts = passingFacts(evidence)
  const problems = []
  for (const requirement of (workItem?.requirements || []).filter((item) => item.status === 'doing')) {
    for (const plan of requirement.evidencePlan || []) {
      const covered = facts.some((fact) => (
        fact.kind === plan.type
        || (plan.type === 'browser-interaction' && fact.kind === 'human-check')
      ) && (fact.requirementIds || []).includes(requirement.requirementId))
      if (!covered) problems.push(`${requirement.requirementId} has no passing ${plan.type} evidence on current code state`)
      if (plan.runtimeRequired && !facts.some((fact) => ['browser-interaction', 'human-check'].includes(fact.kind) && (fact.requirementIds || []).includes(requirement.requirementId))) {
        problems.push(`${requirement.requirementId}:${plan.type} requires passing browser-interaction or human-check evidence`)
      }
    }
  }
  return problems
}

function failureDomainForCheck(code = '') {
  if (/^(?:SOURCE|EXTRACTION)/.test(code)) return 'source'
  if (/^(?:SCOPE|REQUIREMENT|SURFACE|COVERAGE)/.test(code)) return 'scope'
  if (/^(?:ENVIRONMENT|WORKTREE|COMMAND_RUNTIME|INFRASTRUCTURE)/.test(code)) return 'environment'
  if (/^(?:EXTERNAL|DEPENDENCY)/.test(code)) return 'external-dependency'
  return 'code'
}

function failureDomainsFor(evidence, ok, blockedBy, checks = []) {
  if (ok || blockedBy.length) return []
  const failedFacts = (evidence?.facts || []).filter((fact) => fact.result === 'fail')
  const domains = new Set(failedFacts.map((fact) => (
    failureDomains.has(fact.failureDomain)
      ? fact.failureDomain
      : browserEvidenceKinds.has(fact.kind)
        ? 'browser'
        : 'code'
  )))
  for (const failedCheck of checks.filter((item) => !item.ok)) domains.add(failureDomainForCheck(failedCheck.code))
  if (!domains.size) domains.add('code')
  return [...domains].sort()
}

function surfaceEvidenceProblems(workItem, evidence) {
  const passed = passingFacts(evidence)
  const problems = []
  for (const requirement of workItem?.requirements || []) {
    for (const surface of (requirement.affectedSurfaces || []).filter((item) => item.disposition === 'implement')) {
      if (!passed.some((fact) => (fact.surfaceIds || []).includes(surface.surfaceId))) problems.push(`${surface.surfaceId} has no passing evidence on current code state`)
    }
  }
  return problems
}

function blockerProblems(blockers) {
  const problems = []
  if (!Array.isArray(blockers)) return ['blockers must be an array (use [] when none are open)']
  for (const blocker of blockers) {
    if (!blocker.blockerId?.trim() || !['open', 'resolved'].includes(blocker.status) || !blocker.reason?.trim()) problems.push('every blocker requires blockerId, open/resolved status, and reason')
    if (blocker.status === 'open' && !blocker.owner?.trim()) problems.push(`${blocker.blockerId || 'open blocker'} requires an owner`)
  }
  for (const blocker of blockers.filter((item) => item.status === 'open')) problems.push(`${blocker.blockerId}: ${blocker.reason}`)
  return problems
}

function summarize(checks) {
  return { total: checks.length, passed: checks.filter((item) => item.ok).length, failed: checks.filter((item) => !item.ok).length }
}

function resultBody(result) {
  const { resultFingerprint, ...body } = result
  return body
}

export function buildVNextExitResult({ workItem, preflightChecks = [], currentCodeState, evidence, blockers, mode = 'enforced', generatedAt = new Date().toISOString() } = {}) {
  if (!['enforced', 'shadow'].includes(mode)) throw new Error(`unknown vNext result mode: ${mode}`)
  const level = workItem?.routing?.verificationLevel
  const attestationProblems = evidence?.receipt ? verifyEvidenceReceipt(evidence, { workItem, currentCodeState }) : []
  const integrityProblems = evidenceIntegrityProblems(evidence, attestationProblems)
  const trustedEvidence = Boolean(evidence?.receipt) && attestationProblems.length === 0
  const freshnessProblems = evidenceFreshnessProblems(evidence, currentCodeState)
  const requiredProblems = requiredEvidenceProblems(level, evidence)
  const humanFacts = manualRunEvidenceFacts(workItem, currentCodeState)
  const combinedEvidence = { ...evidence, facts: [...(evidence?.facts || []), ...humanFacts] }
  const requirementProblems = requirementEvidenceProblems(workItem, combinedEvidence)
  const surfaceProblems = surfaceEvidenceProblems(workItem, combinedEvidence)
  const sufficiency = auditEvidenceSufficiency({ workItem, evidence, currentCodeState })
  const blockedProblems = blockerProblems(blockers)
  const openBlockerIds = Array.isArray(blockers) ? blockers.filter((item) => item.status === 'open').map((item) => item.blockerId) : []
  const blockedEvidenceIds = (evidence?.facts || []).filter((fact) => fact.result === 'blocked').map((fact) => fact.evidenceId)
  for (const evidenceId of blockedEvidenceIds) blockedProblems.push(`${evidenceId}: evidence is blocked`)

  const checks = [
    ...preflightChecks,
    check('CODE_STATE', !currentCodeState?.isGitRepo || !currentCodeState?.headSha || (!currentCodeState?.contentHash && !currentCodeState?.dirtyHash) ? ['current effective code fingerprint is incomplete'] : []),
    check('EVIDENCE_INTEGRITY', integrityProblems, (evidence?.facts || []).map((fact) => fact.evidenceId)),
    check('EVIDENCE_FRESHNESS', freshnessProblems, (evidence?.facts || []).map((fact) => fact.evidenceId)),
    check('REQUIRED_EVIDENCE', requiredProblems),
    check(sufficiency.code, sufficiency.problems, [...sufficiency.humanEvidenceIds, ...(evidence?.facts || []).map((fact) => fact.evidenceId)]),
    check('REQUIREMENT_EVIDENCE', requirementProblems),
    check('SURFACE_EVIDENCE', surfaceProblems),
    check('BLOCKERS', blockedProblems, [...openBlockerIds, ...blockedEvidenceIds]),
  ]
  const blockedBy = [...new Set([...openBlockerIds, ...blockedEvidenceIds])]
  const ok = checks.every((item) => item.ok) && blockedBy.length === 0
  const failureDomains = failureDomainsFor(evidence, ok, blockedBy, checks)
  const result = {
    schemaVersion: 1,
    workflowVersion: 2,
    tool: 'vnext-verify.mjs',
    mode,
    assuranceMode: trustedEvidence ? 'autonomous' : 'assisted-pilot',
    evidenceTrust: trustedEvidence ? 'cli-attested' : 'caller-supplied',
    runId: evidence?.runId?.trim() || `invalid-${stableFingerprint({ workItem, currentCodeState, evidence }).slice(0, 16)}`,
    generatedAt,
    projectId: workItem?.projectId,
    level,
    status: blockedBy.length ? 'blocked' : ok ? 'passed' : 'failed',
    ok,
    workItemFingerprint: verificationWorkItemFingerprint(workItem),
    codeFingerprint: currentCodeState,
    checks,
    summary: summarize(checks),
    blockedBy,
    failureDomains,
    ...(trustedEvidence ? { evidenceAttestation: { ...evidence.receipt, bundleFingerprint: evidenceBundleFingerprint(evidence) } } : {}),
  }
  return { ...result, resultFingerprint: stableFingerprint(result) }
}

export function verifyExitResultIntegrity(result, workItem = null) {
  const problems = []
  const expectedOk = Array.isArray(result?.checks) && result.checks.every((item) => item.ok) && (result.blockedBy || []).length === 0
  if (!['enforced', 'shadow'].includes(result?.mode)) problems.push('mode must be enforced or shadow')
  const autonomous = result?.assuranceMode === 'autonomous' && result?.evidenceTrust === 'cli-attested'
  const assisted = result?.assuranceMode === 'assisted-pilot' && result?.evidenceTrust === 'caller-supplied'
  if (!autonomous && !assisted) problems.push('assuranceMode/evidenceTrust must be autonomous/cli-attested or assisted-pilot/caller-supplied')
  if (autonomous) {
    problems.push(...verifyEvidenceAttestation(result.evidenceAttestation, {
      expectedBundleFingerprint: result.evidenceAttestation?.bundleFingerprint,
      expectedProjectId: result.projectId,
      expectedWorkItemFingerprint: result.workItemFingerprint,
      expectedCodeContentHash: result.codeFingerprint?.contentHash,
      expectedRunId: result.runId,
    }))
  } else if (result?.evidenceAttestation) problems.push('assisted result must not claim an evidence attestation')
  if (result?.workflowVersion !== 2) problems.push('workflowVersion must be 2')
  const expectedStatus = (result?.blockedBy || []).length ? 'blocked' : expectedOk ? 'passed' : 'failed'
  const expectedSummary = summarize(result?.checks || [])
  if (result?.ok !== expectedOk) problems.push(`ok must be derived as ${expectedOk}`)
  if (result?.status !== expectedStatus) problems.push(`status must be derived as ${expectedStatus}`)
  if (JSON.stringify(result?.summary) !== JSON.stringify(expectedSummary)) problems.push('summary does not match checks')
  if (result?.failureDomains !== undefined) {
    const validDomains = Array.isArray(result.failureDomains)
      && new Set(result.failureDomains).size === result.failureDomains.length
      && result.failureDomains.every((domain) => failureDomains.has(domain))
    if (!validDomains) problems.push('failureDomains must contain unique supported failure-domain values')
    if (result.status === 'passed' && result.failureDomains.length) problems.push('passed result cannot have failureDomains')
    if (result.status === 'failed' && !result.failureDomains.length) problems.push('failed result requires at least one failureDomain')
  }
  if (result?.resultFingerprint !== stableFingerprint(resultBody(result))) problems.push('result fingerprint does not match payload')
  if (workItem && result?.workItemFingerprint !== verificationWorkItemFingerprint(workItem)) problems.push('result does not match work item')
  return { ok: problems.length === 0, problems }
}

export function selfTest() {
  const code = { headSha: 'abc1234', baseSha: 'base123', contentHash: 'content-v1', dirtyHash: 'dirty', dirtyFileCount: 1, untrackedFileCount: 0, isGitRepo: true }
  const command = (evidenceId, kind, extra = {}) => ({
    evidenceId, kind, result: 'pass', codeFingerprint: code, requirementIds: [], surfaceIds: [], evidenceRefs: [`logs/${evidenceId}.txt`],
    producer: { kind: 'command', command: `test ${kind}`, exitCode: 0, startedAt: '2026-09-04T00:00:00Z', finishedAt: '2026-09-04T00:00:01Z' }, ...extra,
  })
  const workItem = {
    projectId: 'PR-00001', routing: { verificationLevel: 'V1' },
    requirements: [{ requirementId: 'R-001', status: 'doing', evidencePlan: [{ type: 'pure-logic' }], affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement' }] }],
  }
  const evidence = {
    runId: 'run-1', capturedAt: '2026-09-04T00:00:02Z', codeFingerprint: code,
    facts: [
      command('E-1', 'pure-logic', { requirementIds: ['R-001'], surfaceIds: ['S-001'] }),
      command('E-2', 'directed-tests'),
      { evidenceId: 'E-3', kind: 'prd-to-diff-review', result: 'pass', codeFingerprint: code, requirementIds: ['R-001'], surfaceIds: ['S-001'], evidenceRefs: ['review/1'], producer: { kind: 'human', confirmedBy: 'reviewer', confirmedAt: '2026-09-04T00:00:01Z' } },
    ],
  }
  const passed = buildVNextExitResult({ workItem, preflightChecks: [{ code: 'SOURCE_FRESH', ok: true, problems: [] }], currentCodeState: code, evidence, blockers: [], generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(passed.ok, true, JSON.stringify(passed))
  assert.equal(passed.mode, 'enforced')
  assert.equal(buildVNextExitResult({ workItem, currentCodeState: code, evidence, blockers: [], mode: 'shadow' }).mode, 'shadow')
  assert.throws(() => buildVNextExitResult({ workItem, currentCodeState: code, evidence, blockers: [], mode: 'invalid' }), /unknown vNext result mode/)
  assert.equal(verifyExitResultIntegrity(passed).ok, true)
  const keyPath = resolve(`.vnext-exit-evidence-key-${process.pid}`)
  const previousKeyPath = process.env.DOCS_TDD_EVIDENCE_KEY_FILE
  try {
    process.env.DOCS_TDD_EVIDENCE_KEY_FILE = keyPath
    const autonomousBody = {
      ...evidence,
      assuranceMode: 'autonomous',
      evidenceTrust: 'cli-attested',
      facts: evidence.facts.map((fact) => fact.producer.kind === 'human' ? command(fact.evidenceId, fact.kind, { requirementIds: fact.requirementIds, surfaceIds: fact.surfaceIds }) : fact),
    }
    const autonomousEvidence = signEvidenceBundle(autonomousBody, {
      workItem,
      plan: { schemaVersion: 1, projectId: workItem.projectId, commands: [] },
      startedAt: '2026-09-04T00:00:00Z',
      completedAt: autonomousBody.capturedAt,
    })
    const autonomous = buildVNextExitResult({ workItem, currentCodeState: code, evidence: autonomousEvidence, blockers: [] })
    assert.equal(autonomous.assuranceMode, 'autonomous', JSON.stringify(autonomous))
    assert.equal(verifyExitResultIntegrity(autonomous).ok, true)
  } finally {
    if (previousKeyPath === undefined) delete process.env.DOCS_TDD_EVIDENCE_KEY_FILE
    else process.env.DOCS_TDD_EVIDENCE_KEY_FILE = previousKeyPath
    try { unlinkSync(keyPath) } catch { /* no-op */ }
  }
  const stale = buildVNextExitResult({ workItem, currentCodeState: { ...code, headSha: 'newhead' }, evidence, blockers: [], generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(stale.checks.find((item) => item.code === 'EVIDENCE_FRESHNESS').ok, true, 'same effective content survives a metadata-only commit')
  const changed = buildVNextExitResult({ workItem, currentCodeState: { ...code, headSha: 'newhead', contentHash: 'content-v2' }, evidence, blockers: [], generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(changed.checks.find((item) => item.code === 'EVIDENCE_FRESHNESS').ok, false)
  assert.deepEqual(changed.failureDomains, ['code'])
  const browserEvidence = structuredClone(evidence)
  browserEvidence.facts = browserEvidence.facts.map((fact, index) => index === 0
    ? { ...fact, kind: 'browser-interaction', result: 'fail', producer: { ...fact.producer, exitCode: 1 } }
    : fact)
  const browserFailure = buildVNextExitResult({ workItem, currentCodeState: code, evidence: browserEvidence, blockers: [] })
  assert.deepEqual(browserFailure.failureDomains, ['browser', 'scope'])
  const runtimeWorkItem = structuredClone(workItem)
  runtimeWorkItem.requirements[0].evidencePlan = [{ type: 'pure-logic', runtimeRequired: true }]
  const runtimeMissing = buildVNextExitResult({ workItem: runtimeWorkItem, currentCodeState: code, evidence, blockers: [] })
  assert.match(runtimeMissing.checks.find((item) => item.code === 'REQUIREMENT_EVIDENCE').problems.join(' '), /browser-interaction/)
  const forged = structuredClone(passed)
  forged.checks[0].ok = false
  assert.equal(verifyExitResultIntegrity(forged).ok, false)
  const invalidMode = { ...passed, mode: 'invalid' }
  invalidMode.resultFingerprint = stableFingerprint(resultBody(invalidMode))
  assert.equal(verifyExitResultIntegrity(invalidMode).ok, false)
  console.log('vnext-exit self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
