#!/usr/bin/env node
// Pure review-policy routing shared by the v2 Autopilot. Keeps model review bounded while allowing
// implementation to continue under an explicit human-review-before-test obligation.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { vnextContextReadiness } from './vnext-context.mjs'

export function deriveReviewPlanningPolicy(workItem, { effectiveReview, fingerprints }) {
  const projectId = workItem.projectId
  if (!effectiveReview.ok && workItem.reviewControl?.status === 'escalated') {
    return {
      deferredHumanReview: false,
      action: {
        action: 'escalate-review-failure',
        phase: 'blocked',
        status: 'blocked',
        reason: `Independent review requires immediate human intervention: ${workItem.reviewControl.reason || 'reviewer unavailable'}.`,
        constraints: ['do-not-loop-reviewer', 'human-review-required-before-implementation'],
      },
    }
  }

  const contextReadiness = vnextContextReadiness(workItem)
  if (!contextReadiness.ok) {
    return {
      deferredHumanReview: false,
      action: {
        action: 'bound-implementation-scope',
        phase: 'planning',
        status: 'waiting',
        reason: contextReadiness.code === 'context-budget-exceeded'
          ? `The implementation context is ${contextReadiness.chars} characters, above the ${contextReadiness.budget} character budget.`
          : `The implementation context cannot be generated: ${contextReadiness.problem}`,
        command: `docs-tdd extract ${projectId} --out <extraction.json>`,
        constraints: ['create-a-bounded-deliveryScope-before-review-or-coding', 'do-not-silently-truncate-requirements', 'record-deferred-owner-batch-and-reason'],
      },
    }
  }

  const deferredHumanReview = !effectiveReview.ok && workItem.reviewControl?.status === 'human-review-deferred'
  const adjudicationAcceptedFindings = workItem.reviewAdjudication?.decisions?.some((decision) => decision.disposition === 'accepted')
  const candidateChangedAfterAdjudication = adjudicationAcceptedFindings
    && workItem.reviewAdjudication.requirementsFingerprint !== fingerprints.requirementsFingerprint
  if (!effectiveReview.ok && ['changes-required', 'human-review-deferred'].includes(workItem.reviewControl?.status) && candidateChangedAfterAdjudication) {
    return {
      deferredHumanReview,
      action: {
        action: 'resume-review-after-human-repair',
        phase: 'planning',
        reason: 'Human adjudication accepted findings and the extraction candidate has been repaired; an explicit human-authorized resume is required.',
        command: `docs-tdd review-resume ${projectId} --input <review-resume.json> --client human`,
        constraints: ['human-intervention-resets-the-two-review-budget', 'do-not-resume-unchanged-candidate'],
      },
    }
  }

  const latestReviewAttempt = workItem.reviewControl?.history?.at(-1)
  if (!deferredHumanReview && !effectiveReview.ok && latestReviewAttempt?.verdict === 'changes-required'
      && latestReviewAttempt.requirementsFingerprint === fingerprints.requirementsFingerprint) {
    return {
      deferredHumanReview,
      action: {
        action: 'repair-review-findings',
        phase: 'planning',
        reason: 'The independent reviewer requested changes; revise the extraction before another review attempt.',
        command: `docs-tdd extract ${projectId} --out <extraction.json>`,
        constraints: ['resolve-current-findings', 'do-not-retry-unchanged-candidate'],
      },
    }
  }
  if (!effectiveReview.ok && !deferredHumanReview) {
    return {
      deferredHumanReview,
      action: {
        action: 'complete-independent-review',
        phase: 'planning',
        reason: 'The extracted requirements have not passed the current independent coverage review.',
        command: `docs-tdd review ${projectId} --client pi`,
        constraints: ['source-only-review', 'review-session-must-differ-from-author-session', 'maximum-two-automatic-reviews-before-human'],
      },
    }
  }
  return { deferredHumanReview, action: null }
}

function selfTest() {
  const requirement = {
    requirementId: 'R-001', title: 'bounded item', statement: 'bounded item', status: 'doing', priority: 'must', sourceAnchors: [{ sourceId: 'SRC-1' }],
    acceptanceCriteria: ['works'], affectedSurfaces: [{ surfaceId: 'S-001', type: 'route', locator: '/x', disposition: 'implement' }],
    sourceDependencies: { figma: 'not-required', api: 'not-required' }, evidencePlan: [{ type: 'directed-tests', locator: 'test' }],
  }
  const workItem = {
    projectId: 'PR-00001', workflowVersion: 2,
    sourceSnapshot: { fingerprint: 'source', manifest: [{ sourceId: 'SRC-1', kind: 'prd', title: 'prd', fingerprint: 'f', status: 'available' }], sourceUnits: [] },
    requirements: [requirement], routing: { verificationLevel: 'V2', scopeClass: 'small', riskSignals: [] }, decisions: [], assumptions: [],
    coverageAudit: { verdict: 'changes-required', reviewRunId: 'run-1', sourceFingerprint: 'stale', requirementsFingerprint: 'stale', routingFingerprint: 'stale', findings: [], unresolved: [] },
    reviewControl: { status: 'human-review-deferred' },
  }
  const deferred = deriveReviewPlanningPolicy(workItem, {
    effectiveReview: { ok: false },
    fingerprints: { requirementsFingerprint: 'requirements' },
  })
  assert.equal(deferred.deferredHumanReview, true)
  assert.equal(deferred.action, null)

  const escalated = deriveReviewPlanningPolicy({ ...workItem, reviewControl: { status: 'escalated', reason: 'reviewer-unavailable' } }, {
    effectiveReview: { ok: false },
    fingerprints: { requirementsFingerprint: 'requirements' },
  })
  assert.equal(escalated.action.action, 'escalate-review-failure')

  const acceptedAndRepaired = {
    ...workItem,
    reviewAdjudication: { requirementsFingerprint: 'old-requirements', decisions: [{ findingId: 'F-1', disposition: 'accepted' }] },
  }
  const resume = deriveReviewPlanningPolicy(acceptedAndRepaired, {
    effectiveReview: { ok: false },
    fingerprints: { requirementsFingerprint: 'repaired-requirements' },
  })
  assert.equal(resume.action.action, 'resume-review-after-human-repair')

  const oversized = structuredClone(workItem)
  oversized.requirements = Array.from({ length: 60 }, (_, index) => ({ ...requirement, requirementId: `R-${index}`, statement: 'x'.repeat(200) }))
  const bounded = deriveReviewPlanningPolicy(oversized, {
    effectiveReview: { ok: true },
    fingerprints: { requirementsFingerprint: 'requirements' },
  })
  assert.equal(bounded.action.action, 'bound-implementation-scope')
  console.log('vnext-review-policy self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
