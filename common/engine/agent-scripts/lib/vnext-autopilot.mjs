#!/usr/bin/env node
// Pure v2 Autopilot state machine. It decides the next client-neutral action from canonical
// work-item/result facts; it never edits business code or persists a second workflow truth source.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { coverageFingerprints, stableFingerprint } from './vnext-work-item.mjs'
import { scopeApprovalFingerprint } from './vnext-risk-route.mjs'
import { evaluateSourceReadiness, reconcileAvailableSources } from './vnext-source-readiness.mjs'

export const AUTOPILOT_PHASES = Object.freeze([
  'intake',
  'planning',
  'implementing',
  'implementation-ready',
  'validating',
  'ready-to-test',
  'blocked',
])

export const AUTOPILOT_ACTIONS = Object.freeze([
  'extract-requirements',
  'repair-intake-extraction',
  'classify-scope-and-risk',
  'complete-independent-review',
  'repair-review-findings',
  'escalate-review-failure',
  'collect-scope-approval',
  'implement-current-scope',
  'await-late-dependencies',
  'reconcile-late-sources',
  'capture-cli-evidence',
  'repair-failed-checks',
  'escalate-repair-failure',
  'resolve-blockers',
  'refresh-invalid-verification',
  'revalidate-current-code-evidence',
  'commit-ready-change',
  'complete',
])

export function initialAutopilotState(generatedAt = new Date().toISOString()) {
  return {
    phase: 'intake',
    implementation: { status: 'pending', changedPaths: [] },
    repairAttempts: { code: 0, browser: 0 },
    lastCheckpointAt: generatedAt,
  }
}

function implementationState(workItem, latestResult) {
  if (workItem?.autopilot?.implementation) return workItem.autopilot.implementation
  // Work items created before Autopilot had no implementation checkpoint. A real persisted result
  // proves that they already crossed implementation, so migration must not send them backwards.
  return latestResult ? { status: 'completed', changedPaths: [] } : { status: 'pending', changedPaths: [] }
}

function actionPacket(workItem, { action, phase, reason, command = '', status = 'active', constraints = [], checkpoint = null }) {
  const projectId = workItem?.projectId || ''
  return {
    schemaVersion: 1,
    actionId: stableFingerprint({ projectId, workItem: stableFingerprint(workItem), action }),
    projectId,
    workflowVersion: 2,
    status,
    phase,
    action,
    reason,
    command,
    constraints,
    ...(checkpoint ? { checkpoint } : {}),
  }
}

function failedDomains(latestResult) {
  const domains = latestResult?.failureDomains
  return Array.isArray(domains) && domains.length ? [...new Set(domains)] : ['code']
}

export function deriveAutopilotAction({
  workItem,
  latestResult = null,
  resultIntegrityOk = true,
  codeStateFresh = true,
  assuranceTrusted = false,
  deliveryCommitted = false,
} = {}) {
  if (workItem?.workflowVersion !== 2 || !workItem?.projectId) throw new Error('Autopilot requires a workflowVersion=2 work item')
  const projectId = workItem.projectId
  const requirements = Array.isArray(workItem.requirements) ? workItem.requirements : []
  const doing = requirements.filter((requirement) => requirement.status === 'doing')
  const coverage = workItem.coverageAudit
  const sourceReadiness = evaluateSourceReadiness(workItem)

  if (!doing.length) {
    return actionPacket(workItem, {
      action: 'extract-requirements',
      phase: 'intake',
      reason: 'The PRD is available, but no doing requirements have been extracted yet.',
      command: `docs-tdd extract ${projectId} --out <extraction.json>`,
      constraints: ['prd-is-the-only-required-start-input', 'do-not-invent-missing-business-semantics'],
    })
  }
  const fingerprints = coverageFingerprints(workItem)
  const extractionAuditCurrent = workItem.extractionAudit?.status === 'pass'
    && workItem.extractionAudit.sourceFingerprint === fingerprints.sourceFingerprint
    && workItem.extractionAudit.requirementsFingerprint === fingerprints.requirementsFingerprint
  // Already-reviewed v3.1 work items remain readable. Any new/revised candidate must pass the v3.2
  // deterministic intake audit before spending an isolated reviewer invocation.
  if (coverage?.verdict !== 'pass' && !extractionAuditCurrent) {
    return actionPacket(workItem, {
      action: 'repair-intake-extraction',
      phase: 'intake',
      reason: 'Requirement extraction has not passed the current deterministic intake audit.',
      command: `docs-tdd extract ${projectId} --input <extraction.json>`,
      constraints: ['fix-source-attribution-before-review', 'reviewer-must-not-repair-mechanical-errors'],
    })
  }
  if (!workItem.routing || workItem.routing.riskSignals?.includes('unclassified') || sourceReadiness.unknownKinds.length) {
    return actionPacket(workItem, {
      action: 'classify-scope-and-risk',
      phase: 'planning',
      reason: 'Requirements exist, but scope/risk routing is not classified.',
      constraints: ['risk-may-only-increase', 'classify-missing-figma-or-api-as-pending-not-global-blocker'],
    })
  }
  if (coverage?.verdict !== 'pass' && workItem.reviewControl?.status === 'escalated') {
    return actionPacket(workItem, {
      action: 'escalate-review-failure',
      phase: 'blocked',
      status: 'blocked',
      reason: `Independent review requires human intervention: ${workItem.reviewControl.reason || 'attempt limit reached'}.`,
      constraints: ['do-not-loop-reviewer', 'human-review-required'],
    })
  }
  const latestReviewAttempt = workItem.reviewControl?.history?.at(-1)
  if (coverage?.verdict !== 'pass' && latestReviewAttempt?.verdict === 'changes-required'
      && latestReviewAttempt.requirementsFingerprint === fingerprints.requirementsFingerprint) {
    return actionPacket(workItem, {
      action: 'repair-review-findings',
      phase: 'planning',
      reason: 'The independent reviewer requested changes; revise the extraction before another review attempt.',
      command: `docs-tdd extract ${projectId} --out <extraction.json>`,
      constraints: ['resolve-current-findings', 'do-not-retry-unchanged-candidate'],
    })
  }
  if (coverage?.verdict !== 'pass' || (coverage?.unresolved || []).length) {
    return actionPacket(workItem, {
      action: 'complete-independent-review',
      phase: 'planning',
      reason: 'The extracted requirements have not passed the current independent coverage review.',
      command: `docs-tdd review ${projectId} --client pi`,
      constraints: ['source-only-review', 'review-session-must-differ-from-author-session'],
    })
  }
  const scopeApprovalIsCurrent = workItem.scopeApproval?.fingerprint === scopeApprovalFingerprint(workItem)
  if (workItem.routing.verificationLevel === 'V2' && !scopeApprovalIsCurrent) {
    return actionPacket(workItem, {
      action: 'collect-scope-approval',
      phase: 'planning',
      reason: 'The current V2 policy still requires a fingerprint-bound human scope approval.',
      constraints: ['human-confirmation-required'],
    })
  }
  if (implementationState(workItem, latestResult).status !== 'completed') {
    return actionPacket(workItem, {
      action: 'implement-current-scope',
      phase: 'implementing',
      reason: 'The reviewed scope has not been marked implementation-complete.',
      constraints: ['implement-only-reviewed-scope', 'checkpoint-real-changed-paths', 'do-not-claim-late-sources-as-final-contracts'],
      checkpoint: {
        command: `docs-tdd checkpoint ${projectId} --input <checkpoint.json>`,
        requiredFields: ['actionId', 'outcome', 'changedPaths', 'discoveredSurfaces', 'coveredSurfaceIds'],
        optionalFields: ['integratedSourceKinds', 'msw', 'blockers'],
      },
    })
  }
  if (sourceReadiness.reconciliationKinds.length) {
    return actionPacket(workItem, {
      action: 'reconcile-late-sources',
      phase: 'implementing',
      reason: `Late source content is available and must be reconciled: ${sourceReadiness.reconciliationKinds.join(', ')}.`,
      constraints: ['reconcile-only-arrived-source-deltas', 'reclassify-risk-before-checkpoint', 'replace-mock-assumptions-with-measured-contracts'],
      checkpoint: {
        command: `docs-tdd checkpoint ${projectId} --input <checkpoint.json>`,
        requiredFields: ['actionId', 'outcome', 'changedPaths', 'integratedSourceKinds'],
      },
    })
  }
  if (sourceReadiness.pendingRequiredKinds.length) {
    return actionPacket(workItem, {
      action: 'await-late-dependencies',
      phase: 'implementation-ready',
      status: 'waiting',
      reason: `PRD-first implementation is complete; ready-to-test waits for: ${sourceReadiness.pendingRequiredKinds.join(', ')}.`,
      constraints: ['do-not-claim-ready-to-test', 'continue-unrelated-work', 'resume-on-source-update'],
    })
  }
  if (!latestResult) {
    return actionPacket(workItem, {
      action: 'capture-cli-evidence',
      phase: 'validating',
      reason: 'Implementation is complete and has no verification result yet.',
      command: `docs-tdd evidence ${projectId} --out <evidence.json>`,
      constraints: ['execute-reviewed-command-plan', 'shell-disabled'],
    })
  }
  if (!resultIntegrityOk) {
    return actionPacket(workItem, {
      action: 'refresh-invalid-verification',
      phase: 'validating',
      reason: 'The latest verification result failed integrity validation.',
      command: `docs-tdd verify ${projectId} --evidence <evidence.json> --surfaces <surfaces.json>`,
    })
  }
  if (!codeStateFresh) {
    return actionPacket(workItem, {
      action: 'revalidate-current-code-evidence',
      phase: 'validating',
      reason: 'Effective code content changed after the latest evidence was captured.',
      command: `docs-tdd evidence ${projectId} --out <evidence.json>`,
    })
  }
  if (latestResult.status === 'blocked') {
    return actionPacket(workItem, {
      action: 'resolve-blockers',
      phase: 'blocked',
      status: 'blocked',
      reason: 'The verifier reports one or more open blockers.',
    })
  }
  if (latestResult.status === 'passed' && !assuranceTrusted) {
    return actionPacket(workItem, {
      action: 'capture-cli-evidence',
      phase: 'validating',
      reason: 'The checks passed with non-authoritative evidence and need CLI-attested evidence.',
      command: `docs-tdd evidence ${projectId} --out <evidence.json>`,
    })
  }
  if (latestResult.status !== 'passed' || latestResult.ok !== true) {
    const domains = failedDomains(latestResult)
    const attempts = workItem.autopilot?.repairAttempts || { code: 0, browser: 0 }
    const exhausted = domains.filter((domain) => (attempts[domain] || 0) >= 2)
    if (exhausted.length) {
      return actionPacket(workItem, {
        action: 'escalate-repair-failure',
        phase: 'blocked',
        status: 'blocked',
        reason: `Two automatic repair attempts failed for: ${exhausted.join(', ')}; human diagnosis is required.`,
        constraints: ['do-not-loop', 'report-last-failed-checks'],
      })
    }
    return actionPacket(workItem, {
      action: 'repair-failed-checks',
      phase: 'validating',
      reason: `The latest enforced verification contains failed ${domains.join(' + ')} checks.`,
      constraints: domains.map((domain) => `maximum-two-automatic-${domain}-repairs`),
      checkpoint: {
        command: `docs-tdd checkpoint ${projectId} --input <checkpoint.json>`,
        requiredFields: ['actionId', 'outcome', 'changedPaths'],
      },
    })
  }
  if (!deliveryCommitted) {
    return actionPacket(workItem, {
      action: 'commit-ready-change',
      phase: 'validating',
      reason: 'Authoritative checks passed; commit only the evidence-scoped paths before handoff.',
      command: `docs-tdd run ${projectId}`,
      constraints: ['stage-only-evidence-scoped-paths', 'do-not-push'],
    })
  }
  return actionPacket(workItem, {
    action: 'complete',
    phase: 'ready-to-test',
    status: 'complete',
    reason: 'The current work item has an authoritative PASS bound to the current effective code state.',
  })
}

export function applyAutopilotCheckpoint(workItem, checkpoint, { latestResult = null, generatedAt = new Date().toISOString() } = {}) {
  if (!checkpoint || !['in-progress', 'completed'].includes(checkpoint.outcome)) throw new Error('checkpoint outcome must be in-progress or completed')
  const expected = deriveAutopilotAction({ workItem, latestResult })
  if (checkpoint.actionId !== expected.actionId) throw new Error('checkpoint actionId is stale or does not match the current Autopilot action')
  if (!['implement-current-scope', 'reconcile-late-sources', 'repair-failed-checks'].includes(expected.action)) throw new Error(`action ${expected.action} does not accept an implementation checkpoint`)
  if (['reconcile-late-sources', 'repair-failed-checks'].includes(expected.action) && checkpoint.outcome !== 'completed') throw new Error(`${expected.action} checkpoint must be completed`)

  let next = structuredClone(workItem)
  const integratedSourceKinds = checkpoint.integratedSourceKinds || []
  if (expected.action === 'reconcile-late-sources') {
    if (!Array.isArray(integratedSourceKinds) || !integratedSourceKinds.length) throw new Error('source reconciliation checkpoint requires integratedSourceKinds')
    if (!(checkpoint.changedPaths || []).length) throw new Error('source reconciliation checkpoint requires at least one real changed path')
  }
  if (integratedSourceKinds.length && !['implement-current-scope', 'reconcile-late-sources'].includes(expected.action)) {
    throw new Error(`${expected.action} cannot reconcile late sources`)
  }
  if (integratedSourceKinds.length) {
    const existingMswHandlers = workItem.autopilot?.implementation?.msw?.handlerIds || []
    if (integratedSourceKinds.includes('api') && existingMswHandlers.length && !checkpoint.msw) {
      throw new Error('API reconciliation with existing mock handlers must report the resulting MSW state')
    }
    next = reconcileAvailableSources(next, integratedSourceKinds, generatedAt)
  }
  const previous = implementationState(next, latestResult)
  const changedPaths = [...new Set([...(previous.changedPaths || []), ...(checkpoint.changedPaths || [])])].sort()
  if (checkpoint.outcome === 'completed' && expected.action === 'implement-current-scope' && !changedPaths.length) {
    throw new Error('completed implementation checkpoint requires at least one real changed path')
  }
  if (checkpoint.outcome === 'completed' && expected.action === 'implement-current-scope') {
    if (!Array.isArray(checkpoint.discoveredSurfaces) || !Array.isArray(checkpoint.coveredSurfaceIds)) {
      throw new Error('completed implementation checkpoint requires discoveredSurfaces and coveredSurfaceIds arrays')
    }
  }

  next.autopilot = {
    ...initialAutopilotState(generatedAt),
    ...(next.autopilot || {}),
    phase: checkpoint.outcome === 'completed' ? 'validating' : 'implementing',
    implementation: {
      ...previous,
      status: ['reconcile-late-sources', 'repair-failed-checks'].includes(expected.action) ? 'completed' : checkpoint.outcome,
      changedPaths,
      ...(checkpoint.discoveredSurfaces ? { discoveredSurfaces: checkpoint.discoveredSurfaces } : {}),
      ...(checkpoint.coveredSurfaceIds ? { coveredSurfaceIds: checkpoint.coveredSurfaceIds } : {}),
      ...(checkpoint.msw ? { msw: checkpoint.msw } : {}),
      ...(checkpoint.blockers ? { blockers: checkpoint.blockers } : {}),
      ...(checkpoint.outcome === 'completed' ? { completedAt: generatedAt } : {}),
    },
    repairAttempts: {
      ...(next.autopilot?.repairAttempts || { code: 0, browser: 0 }),
      ...(expected.action === 'repair-failed-checks' && checkpoint.outcome === 'completed'
        ? Object.fromEntries(failedDomains(latestResult).map((domain) => [domain, (next.autopilot?.repairAttempts?.[domain] || 0) + 1]))
        : {}),
      ...(expected.action === 'reconcile-late-sources' ? { code: 0, browser: 0 } : {}),
    },
    lastCheckpointAt: generatedAt,
  }
  return next
}

export function selfTest() {
  const base = {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId: 'PR-00001',
    requirements: [],
    coverageAudit: { verdict: 'changes-required', unresolved: ['pending'] },
    routing: { riskSignals: ['unclassified'], verificationLevel: 'V0' },
    autopilot: initialAutopilotState('2026-09-08T00:00:00Z'),
  }
  assert.equal(deriveAutopilotAction({ workItem: base }).action, 'extract-requirements')

  const requirement = { requirementId: 'R-001', status: 'doing' }
  const unclassified = { ...base, requirements: [requirement] }
  unclassified.extractionAudit = { status: 'pass', ...coverageFingerprints(unclassified) }
  assert.equal(deriveAutopilotAction({ workItem: unclassified }).action, 'classify-scope-and-risk')

  const needsReview = { ...unclassified, routing: { riskSignals: [], verificationLevel: 'V0' } }
  assert.equal(deriveAutopilotAction({ workItem: needsReview }).action, 'complete-independent-review')
  const needsReviewRepair = structuredClone(needsReview)
  needsReviewRepair.reviewControl = {
    status: 'changes-required', attempts: 1,
    history: [{ verdict: 'changes-required', requirementsFingerprint: coverageFingerprints(needsReviewRepair).requirementsFingerprint }],
  }
  assert.equal(deriveAutopilotAction({ workItem: needsReviewRepair }).action, 'repair-review-findings')

  const reviewed = { ...needsReview, coverageAudit: { verdict: 'pass', unresolved: [] } }
  assert.equal(deriveAutopilotAction({ workItem: reviewed }).action, 'implement-current-scope')

  const implementAction = deriveAutopilotAction({ workItem: reviewed })
  const implemented = applyAutopilotCheckpoint(reviewed, {
    actionId: implementAction.actionId,
    outcome: 'completed',
    changedPaths: ['src/x.ts'],
    discoveredSurfaces: [{ surfaceId: 'S-001', locator: 'src/x.ts' }],
    coveredSurfaceIds: ['S-001'],
  }, { generatedAt: '2026-09-08T00:01:00Z' })
  assert.equal(deriveAutopilotAction({ workItem: implemented }).action, 'capture-cli-evidence')
  assert.throws(() => applyAutopilotCheckpoint(reviewed, { actionId: 'stale', outcome: 'completed' }), /actionId is stale/)

  const waitingForApi = structuredClone(implemented)
  waitingForApi.apiDependency = { mode: 'mock-required', reason: 'approved scenarios while API is pending', contractIds: ['C-1'] }
  waitingForApi.sourceReadiness = {
    figma: { requirement: 'not-required', status: 'not-required', reason: 'no visual dependency' },
    api: { requirement: 'required', status: 'pending', reason: 'API contract pending' },
  }
  assert.equal(deriveAutopilotAction({ workItem: waitingForApi }).action, 'await-late-dependencies')
  const apiAvailable = structuredClone(waitingForApi)
  apiAvailable.sourceReadiness.api = {
    requirement: 'required', status: 'available', reason: 'API contract arrived',
    source: { path: 'inbox/api.md', revision: 'v1', fingerprint: 'a'.repeat(64) },
  }
  const reconcileAction = deriveAutopilotAction({ workItem: apiAvailable })
  assert.equal(reconcileAction.action, 'reconcile-late-sources')
  const reconciled = applyAutopilotCheckpoint(apiAvailable, {
    actionId: reconcileAction.actionId,
    outcome: 'completed',
    changedPaths: ['src/api.ts'],
    integratedSourceKinds: ['api'],
    msw: { workerIntegrated: false, handlerIds: [], coveredContractIds: [] },
  })
  assert.equal(reconciled.sourceReadiness.api.status, 'integrated')
  assert.equal(reconciled.apiDependency.mode, 'real-api')
  assert.equal(deriveAutopilotAction({ workItem: reconciled }).action, 'capture-cli-evidence')

  const passed = { mode: 'enforced', status: 'passed', ok: true }
  const { autopilot: _legacyMissingAutopilot, ...legacyReviewed } = reviewed
  assert.equal(deriveAutopilotAction({ workItem: legacyReviewed, latestResult: passed, assuranceTrusted: true, deliveryCommitted: true }).action, 'complete')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, assuranceTrusted: false }).action, 'capture-cli-evidence')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, assuranceTrusted: true }).action, 'commit-ready-change')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, assuranceTrusted: true, deliveryCommitted: true }).action, 'complete')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: { status: 'blocked', ok: false } }).action, 'resolve-blockers')
  const failed = { status: 'failed', ok: false, failureDomains: ['code'] }
  const repairAction = deriveAutopilotAction({ workItem: implemented, latestResult: failed })
  assert.equal(repairAction.action, 'repair-failed-checks')
  const repairedOnce = applyAutopilotCheckpoint(implemented, { actionId: repairAction.actionId, outcome: 'completed', changedPaths: ['src/x.ts'] }, { latestResult: failed })
  const secondRepairAction = deriveAutopilotAction({ workItem: repairedOnce, latestResult: failed })
  const repairedTwice = applyAutopilotCheckpoint(repairedOnce, { actionId: secondRepairAction.actionId, outcome: 'completed', changedPaths: ['src/x.ts'] }, { latestResult: failed })
  assert.equal(deriveAutopilotAction({ workItem: repairedTwice, latestResult: failed }).action, 'escalate-repair-failure')
  const browserFailed = { status: 'failed', ok: false, failureDomains: ['browser'] }
  const browserRepair = deriveAutopilotAction({ workItem: implemented, latestResult: browserFailed })
  const browserRepaired = applyAutopilotCheckpoint(implemented, { actionId: browserRepair.actionId, outcome: 'completed', changedPaths: ['src/x.ts'] }, { latestResult: browserFailed })
  assert.deepEqual(browserRepaired.autopilot.repairAttempts, { code: 0, browser: 1 })
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, resultIntegrityOk: false }).action, 'refresh-invalid-verification')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, codeStateFresh: false }).action, 'revalidate-current-code-evidence')

  const v2 = { ...reviewed, routing: { riskSignals: ['funds'], verificationLevel: 'V2' }, scopeApproval: null }
  assert.equal(deriveAutopilotAction({ workItem: v2 }).action, 'collect-scope-approval')
  console.log('vnext-autopilot self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
