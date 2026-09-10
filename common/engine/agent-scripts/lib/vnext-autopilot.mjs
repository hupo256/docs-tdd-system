#!/usr/bin/env node
// Pure v2 Autopilot state machine. It decides the next client-neutral action from canonical
// work-item/result facts; it never edits business code or persists a second workflow truth source.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableFingerprint } from './vnext-work-item.mjs'

export const AUTOPILOT_PHASES = Object.freeze([
  'intake',
  'planning',
  'implementing',
  'validating',
  'ready-to-test',
  'blocked',
])

export const AUTOPILOT_ACTIONS = Object.freeze([
  'extract-requirements',
  'classify-scope-and-risk',
  'complete-independent-review',
  'collect-scope-approval',
  'implement-current-scope',
  'capture-cli-evidence',
  'run-enforced-verification',
  'repair-failed-checks',
  'resolve-blockers',
  'refresh-invalid-verification',
  'revalidate-current-code-evidence',
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

function actionPacket(workItem, { action, phase, reason, command = '', status = 'active', constraints = [] }) {
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
  }
}

export function deriveAutopilotAction({
  workItem,
  latestResult = null,
  resultIntegrityOk = true,
  codeStateFresh = true,
  assuranceTrusted = false,
} = {}) {
  if (workItem?.workflowVersion !== 2 || !workItem?.projectId) throw new Error('Autopilot requires a workflowVersion=2 work item')
  const projectId = workItem.projectId
  const requirements = Array.isArray(workItem.requirements) ? workItem.requirements : []
  const doing = requirements.filter((requirement) => requirement.status === 'doing')
  const coverage = workItem.coverageAudit

  if (!doing.length) {
    return actionPacket(workItem, {
      action: 'extract-requirements',
      phase: 'intake',
      reason: 'The PRD is available, but no doing requirements have been extracted yet.',
      constraints: ['prd-is-the-only-required-start-input', 'do-not-invent-missing-business-semantics'],
    })
  }
  if (!workItem.routing || workItem.routing.riskSignals?.includes('unclassified')) {
    return actionPacket(workItem, {
      action: 'classify-scope-and-risk',
      phase: 'planning',
      reason: 'Requirements exist, but scope/risk routing is not classified.',
      constraints: ['risk-may-only-increase', 'classify-missing-figma-or-api-as-pending-not-global-blocker'],
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
  if (workItem.routing.verificationLevel === 'V2' && !workItem.scopeApproval) {
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
    return actionPacket(workItem, {
      action: 'repair-failed-checks',
      phase: 'validating',
      reason: 'The latest enforced verification contains failed checks.',
    })
  }
  return actionPacket(workItem, {
    action: 'complete',
    phase: 'ready-to-test',
    status: 'complete',
    reason: 'The current work item has an authoritative PASS bound to the current effective code state.',
  })
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
  assert.equal(deriveAutopilotAction({ workItem: unclassified }).action, 'classify-scope-and-risk')

  const needsReview = { ...unclassified, routing: { riskSignals: [], verificationLevel: 'V0' } }
  assert.equal(deriveAutopilotAction({ workItem: needsReview }).action, 'complete-independent-review')

  const reviewed = { ...needsReview, coverageAudit: { verdict: 'pass', unresolved: [] } }
  assert.equal(deriveAutopilotAction({ workItem: reviewed }).action, 'implement-current-scope')

  const implemented = { ...reviewed, autopilot: { ...base.autopilot, implementation: { status: 'completed', changedPaths: ['src/x.ts'] } } }
  assert.equal(deriveAutopilotAction({ workItem: implemented }).action, 'capture-cli-evidence')

  const passed = { mode: 'enforced', status: 'passed', ok: true }
  const { autopilot: _legacyMissingAutopilot, ...legacyReviewed } = reviewed
  assert.equal(deriveAutopilotAction({ workItem: legacyReviewed, latestResult: passed, assuranceTrusted: true }).action, 'complete')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, assuranceTrusted: false }).action, 'capture-cli-evidence')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, assuranceTrusted: true }).action, 'complete')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: { status: 'blocked', ok: false } }).action, 'resolve-blockers')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: { status: 'failed', ok: false } }).action, 'repair-failed-checks')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, resultIntegrityOk: false }).action, 'refresh-invalid-verification')
  assert.equal(deriveAutopilotAction({ workItem: implemented, latestResult: passed, codeStateFresh: false }).action, 'revalidate-current-code-evidence')

  const v2 = { ...reviewed, routing: { riskSignals: ['funds'], verificationLevel: 'V2' }, scopeApproval: null }
  assert.equal(deriveAutopilotAction({ workItem: v2 }).action, 'collect-scope-approval')
  console.log('vnext-autopilot self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
