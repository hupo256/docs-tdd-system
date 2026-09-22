#!/usr/bin/env node
// Human adjudication and explicit resume protocol for bounded independent-review failures.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { persistVNextWorkItem } from './lib/vnext-persistence.mjs'
import { coverageFingerprints, effectiveCoverageReview } from './lib/vnext-work-item.mjs'

const DISPOSITIONS = new Set(['accepted', 'resolved', 'rejected', 'not-applicable', 'deferred'])
const MAX_AUTOMATED_REVIEW_ATTEMPTS = 2

function validateHuman(input, verb) {
  if (!input?.adjudicatedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input?.adjudicatedAt || '')) {
    throw new Error(`${verb} requires adjudicatedBy and YYYY-MM-DD adjudicatedAt`)
  }
  if (!input.reason?.trim()) throw new Error(`${verb} requires a reason`)
}

export function applyReviewAdjudication(workItem, input, { client = 'cursor', sessionId = '' } = {}) {
  if (input?.schemaVersion !== 1 || input?.projectId !== workItem?.projectId) throw new Error('review adjudication schemaVersion/projectId does not match work item')
  validateHuman(input, 'review adjudication')
  const audit = workItem.coverageAudit
  if (!audit?.reviewRunId || audit.verdict !== 'changes-required') throw new Error('review adjudication requires a changes-required coverage review')
  const fingerprints = coverageFingerprints(workItem)
  if (input.reviewRunId !== audit.reviewRunId) throw new Error('review adjudication targets a stale review run')
  if (input.sourceFingerprint !== fingerprints.sourceFingerprint || input.requirementsFingerprint !== fingerprints.requirementsFingerprint) {
    throw new Error('review adjudication fingerprints are stale')
  }
  const auditScopeIsCurrent = audit.requirementsFingerprint === fingerprints.requirementsFingerprint
  const priorDecisions = new Map((workItem.reviewAdjudication?.decisions || []).map((decision) => [decision.findingId, decision]))
  const confirmingExhaustedRepair = !auditScopeIsCurrent
    && (workItem.reviewControl?.attempts || 0) >= MAX_AUTOMATED_REVIEW_ATTEMPTS
    && workItem.reviewAdjudication?.originalReviewRunId === audit.reviewRunId
    && priorDecisions.size > 0
  if (!auditScopeIsCurrent && !confirmingExhaustedRepair) throw new Error('review adjudication requires the reviewed scope or an exhausted-budget repair/migration confirmation')
  if (confirmingExhaustedRepair) {
    const extraction = workItem.extractionAudit
    if (extraction?.status !== 'pass' || extraction.sourceFingerprint !== fingerprints.sourceFingerprint || extraction.requirementsFingerprint !== fingerprints.requirementsFingerprint) {
      throw new Error('repair confirmation requires a current passing extraction audit')
    }
  }

  const findings = audit.findings || []
  const decisions = Array.isArray(input.decisions) ? input.decisions : []
  const findingIds = findings.map((finding) => finding.findingId).sort()
  const decisionIds = decisions.map((decision) => decision.findingId).sort()
  if (new Set(decisionIds).size !== decisionIds.length || JSON.stringify(findingIds) !== JSON.stringify(decisionIds)) {
    throw new Error('review adjudication must decide every finding exactly once')
  }
  for (const decision of decisions) {
    if (!DISPOSITIONS.has(decision.disposition)) throw new Error(`${decision.findingId} has invalid adjudication disposition`)
    if (!decision.reason?.trim()) throw new Error(`${decision.findingId} requires an adjudication reason`)
    if (decision.disposition === 'resolved' && (!confirmingExhaustedRepair || priorDecisions.get(decision.findingId)?.disposition !== 'accepted')) {
      throw new Error(`${decision.findingId} resolved is only valid for a previously accepted finding after exhausted-budget repair`)
    }
    if (decision.disposition === 'rejected' && (!Array.isArray(decision.evidenceRefs) || !decision.evidenceRefs.length)) {
      throw new Error(`${decision.findingId} rejected requires at least one evidenceRef`)
    }
    if (decision.disposition === 'deferred' && (!decision.owner?.trim() || !decision.batch?.trim())) {
      throw new Error(`${decision.findingId} deferred requires owner and batch`)
    }
  }

  const effectiveVerdict = decisions.some((decision) => decision.disposition === 'accepted') ? 'changes-required' : 'pass'
  const reviewAdjudication = {
    schemaVersion: 1,
    originalReviewRunId: audit.reviewRunId,
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    ...(!auditScopeIsCurrent ? { baseRequirementsFingerprint: audit.requirementsFingerprint, repairConfirmation: true } : {}),
    adjudicatedBy: input.adjudicatedBy.trim(),
    adjudicatedAt: input.adjudicatedAt,
    reason: input.reason.trim(),
    recordedVia: { client, ...(sessionId ? { sessionId } : {}) },
    decisions: structuredClone(decisions),
    effectiveVerdict,
  }
  const next = {
    ...workItem,
    reviewAdjudication,
    reviewControl: {
      ...(workItem.reviewControl || {}),
      status: effectiveVerdict === 'pass'
        ? 'adjudicated'
        : (workItem.reviewControl?.attempts || 0) >= MAX_AUTOMATED_REVIEW_ATTEMPTS ? 'human-review-deferred' : 'changes-required',
    },
  }
  if (effectiveVerdict === 'pass' && !effectiveCoverageReview(next).ok) throw new Error('internal error: adjudication did not produce effective review PASS')
  return next
}

export function resumeReview(workItem, input, { client = 'cursor', sessionId = '' } = {}) {
  if (input?.schemaVersion !== 1 || input?.projectId !== workItem?.projectId) throw new Error('review resume schemaVersion/projectId does not match work item')
  validateHuman(input, 'review resume')
  if (!['escalated', 'human-review-deferred', 'changes-required'].includes(workItem.reviewControl?.status)) {
    throw new Error('review resume requires an escalated, deferred-human, or changes-required review control')
  }
  const fingerprints = coverageFingerprints(workItem)
  const extraction = workItem.extractionAudit
  if (extraction?.status !== 'pass' || extraction.sourceFingerprint !== fingerprints.sourceFingerprint || extraction.requirementsFingerprint !== fingerprints.requirementsFingerprint) {
    throw new Error('review resume requires a current passing extraction audit')
  }
  const infrastructureFailure = workItem.reviewControl?.reason === 'reviewer-unavailable'
  const accepted = workItem.reviewAdjudication?.decisions?.some((decision) => decision.disposition === 'accepted')
  const candidateChanged = workItem.reviewAdjudication?.requirementsFingerprint !== fingerprints.requirementsFingerprint
  if (!infrastructureFailure && !(accepted && candidateChanged)) {
    throw new Error('semantic review resume requires accepted findings and a revised extraction candidate')
  }
  const attempts = workItem.reviewControl?.attempts || 0
  if (!infrastructureFailure && attempts >= MAX_AUTOMATED_REVIEW_ATTEMPTS) {
    throw new Error('review resume blocked: the two-review source-lifecycle budget is exhausted; continue with the required pretest human run')
  }
  const { reason: _reason, escalatedAt: _escalatedAt, deferredAt: _deferredAt, lastError: _lastError, ...control } = workItem.reviewControl || {}
  return {
    ...workItem,
    reviewControl: {
      ...control,
      sourceFingerprint: fingerprints.sourceFingerprint,
      status: 'active',
      attempts,
      maxAttempts: MAX_AUTOMATED_REVIEW_ATTEMPTS,
    },
    reviewAdjudication: workItem.reviewAdjudication ? {
      ...workItem.reviewAdjudication,
      resumedBy: input.adjudicatedBy.trim(),
      resumedAt: input.adjudicatedAt,
      resumeReason: input.reason.trim(),
      resumeRecordedVia: { client, ...(sessionId ? { sessionId } : {}) },
    } : workItem.reviewAdjudication,
  }
}

export function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-review-adjudicate-'))
  try {
    const workItem = {
      schemaVersion: 1, workflowVersion: 2, projectId: 'PR-00001',
      sourceSnapshot: { revision: '1', contentHash: 'a', sources: [{ path: 'prd.md', contentHash: 'a' }] },
      requirements: [{ requirementId: 'R-001' }],
      coverageAudit: {
        sourceFingerprint: '', requirementsFingerprint: '', reviewMode: 'independent-cold-read', reviewRunId: 'review-1',
        reviewer: { kind: 'model', id: 'pi/default' }, completedAt: '2026-09-12T00:00:00Z', verdict: 'changes-required',
        findings: [{ findingId: 'F-1', code: 'other', message: 'false positive', sourceIds: [], disposition: 'open' }],
        unresolved: ['F-1: false positive'],
      },
      extractionAudit: { status: 'pass' },
      reviewControl: { sourceFingerprint: 'source', attempts: 1, maxAttempts: 2, status: 'human-review-deferred', reason: 'repeated-findings', history: [] },
    }
    const fingerprints = coverageFingerprints(workItem)
    Object.assign(workItem.coverageAudit, fingerprints)
    Object.assign(workItem.extractionAudit, fingerprints)
    const input = {
      schemaVersion: 1, projectId: 'PR-00001', reviewRunId: 'review-1', ...fingerprints,
      adjudicatedBy: 'owner@example.com', adjudicatedAt: '2026-09-12', reason: 'manual cold read',
      decisions: [{ findingId: 'F-1', disposition: 'rejected', reason: 'covered by R-001', evidenceRefs: ['work-item:R-001'] }],
    }
    const adjudicated = applyReviewAdjudication(workItem, input)
    assert.equal(effectiveCoverageReview(adjudicated).ok, true)
    assert.equal(adjudicated.coverageAudit.verdict, 'changes-required')
    assert.throws(() => applyReviewAdjudication(workItem, { ...input, decisions: [] }), /every finding/)

    const accepted = applyReviewAdjudication(workItem, {
      ...input,
      decisions: [{ findingId: 'F-1', disposition: 'accepted', reason: 'requirement is missing' }],
    })
    const revised = structuredClone(accepted)
    revised.requirements.push({ requirementId: 'R-002' })
    Object.assign(revised.extractionAudit, { status: 'pass', ...coverageFingerprints(revised) })
    revised.reviewControl.attempts = 1
    const resumed = resumeReview(revised, { schemaVersion: 1, projectId: 'PR-00001', adjudicatedBy: 'owner@example.com', adjudicatedAt: '2026-09-13', reason: 'candidate repaired' })
    assert.equal(resumed.reviewControl.status, 'active')
    assert.equal(resumed.reviewControl.attempts, 1)
    revised.reviewControl.attempts = 2
    assert.throws(() => resumeReview(revised, { schemaVersion: 1, projectId: 'PR-00001', adjudicatedBy: 'owner@example.com', adjudicatedAt: '2026-09-13', reason: 'candidate repaired' }), /budget is exhausted/)
    const repairedFingerprints = coverageFingerprints(revised)
    const confirmedRepair = applyReviewAdjudication(revised, {
      ...input,
      ...repairedFingerprints,
      adjudicatedAt: '2026-09-14',
      reason: 'confirmed accepted finding repair against the current extraction',
      decisions: [{ findingId: 'F-1', disposition: 'resolved', reason: 'covered by R-002', evidenceRefs: ['work-item:R-002'] }],
    })
    assert.equal(confirmedRepair.reviewAdjudication.repairConfirmation, true)
    assert.equal(effectiveCoverageReview(confirmedRepair).mode, 'human-repair-confirmation')
    assert.equal(effectiveCoverageReview(confirmedRepair).ok, true)

    const previouslyRejected = structuredClone(adjudicated)
    previouslyRejected.reviewControl.attempts = 2
    previouslyRejected.requirements[0].statement = 'A migrated three-stage requirement.'
    Object.assign(previouslyRejected.extractionAudit, { status: 'pass', ...coverageFingerprints(previouslyRejected) })
    const migratedFingerprints = coverageFingerprints(previouslyRejected)
    const migrationConfirmation = applyReviewAdjudication(previouslyRejected, {
      ...input,
      ...migratedFingerprints,
      adjudicatedAt: '2026-09-14',
      reason: 'Confirm the traceability-only migration after the review budget was exhausted.',
    })
    assert.equal(migrationConfirmation.reviewAdjudication.repairConfirmation, true)
    assert.equal(effectiveCoverageReview(migrationConfirmation).ok, true)

    const infrastructureFailure = structuredClone(workItem)
    infrastructureFailure.reviewControl = { ...infrastructureFailure.reviewControl, status: 'escalated', attempts: 1, reason: 'reviewer-unavailable' }
    const infrastructureResumed = resumeReview(infrastructureFailure, { schemaVersion: 1, projectId: 'PR-00001', adjudicatedBy: 'owner@example.com', adjudicatedAt: '2026-09-13', reason: 'reviewer repaired' })
    assert.equal(infrastructureResumed.reviewControl.attempts, 1)
    persistVNextWorkItem(root, resumed)
    assert.equal(existsSync(join(root, 'work-item.json')), true)
    console.log('vnext-review-adjudicate self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? '' : process.argv[index + 1] || ''
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else {
    try {
      const projectDir = resolve(argumentValue('--project'))
      const workItem = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
      const inputFile = argumentValue('--input')
      if (!inputFile) throw new Error('--input is required')
      const input = JSON.parse(readFileSync(resolve(inputFile), 'utf8'))
      const actor = { client: argumentValue('--client') || 'cursor', sessionId: argumentValue('--session-id') }
      const next = process.argv.includes('--resume') ? resumeReview(workItem, input, actor) : applyReviewAdjudication(workItem, input, actor)
      const persisted = persistVNextWorkItem(projectDir, next)
      console.log(JSON.stringify({ projectId: next.projectId, reviewControl: next.reviewControl, reviewAdjudication: next.reviewAdjudication, persisted }, null, 2))
    } catch (error) {
      console.error(`vNext review adjudication failed: ${error.message}`)
      process.exitCode = 2
    }
  }
}
