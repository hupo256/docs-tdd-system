#!/usr/bin/env node
// Minimal I/O contract for an independent vNext coverage review.
// This module prepares/verifies JSON only; the workflow orchestrator chooses a human or model reviewer.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { coverageFingerprints, verifyVNextCoverage } from './vnext-work-item.mjs'

export const REVIEW_PROTOCOL = 'vnext-independent-coverage-review-v1'
const allowedDispositions = new Set(['resolved', 'not-applicable', 'deferred', 'open'])
const allowedFindingCodes = new Set(['missing-requirement', 'merged-requirement', 'ambiguous-collection', 'missing-surface', 'other'])

function reviewRequirements(requirements = []) {
  return requirements.map(({ requirementId, sourceAnchors, statement, status, collectionSemantics, affectedSurfaces }) => ({
    requirementId,
    sourceAnchors,
    statement,
    status,
    collectionSemantics,
    affectedSurfaces,
  }))
}

function deliveryScopeProblems(workItem) {
  const scope = workItem?.deliveryScope
  if (!scope) return []
  const problems = []
  if (scope.kind !== 'bounded-batch' || !scope.batchId?.trim()) problems.push('deliveryScope requires bounded-batch kind and batchId')
  const actual = (workItem.requirements || []).map((item) => item.requirementId).sort()
  const included = Array.isArray(scope.includedRequirementIds) ? [...scope.includedRequirementIds].sort() : []
  if (new Set(included).size !== included.length || JSON.stringify(included) !== JSON.stringify(actual)) {
    problems.push('deliveryScope.includedRequirementIds must exactly match current requirements')
  }
  if (!scope.deferred?.owner?.trim() || !scope.deferred?.batch?.trim() || !scope.deferred?.reason?.trim()) {
    problems.push('bounded deliveryScope requires deferred owner, batch, and reason')
  }
  return problems
}

export function buildCoverageReviewRequest({ workItem, sourceUnits }) {
  if (!workItem?.projectId) throw new Error('review request requires a work item')
  if (!Array.isArray(sourceUnits) || !sourceUnits.length) throw new Error('review request requires normalized source units')
  const scopeProblems = deliveryScopeProblems(workItem)
  if (scopeProblems.length) throw new Error(`invalid delivery scope: ${scopeProblems.join('; ')}`)
  const sourceIds = sourceUnits.map((unit) => unit.sourceId)
  const duplicateSourceIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index)
  if (duplicateSourceIds.length) throw new Error(`duplicate source unit IDs: ${[...new Set(duplicateSourceIds)].join(', ')}`)
  const sourceIdSet = new Set(sourceIds)
  const unknownAnchors = (workItem.requirements || []).flatMap((requirement) => (requirement.sourceAnchors || [])
    .filter((anchor) => !sourceIdSet.has(anchor.sourceId))
    .map((anchor) => `${requirement.requirementId}:${anchor.sourceId}`))
  if (unknownAnchors.length) throw new Error(`requirement anchors are absent from source units: ${unknownAnchors.join(', ')}`)
  const anchoredSourceIds = new Set((workItem.requirements || []).flatMap((requirement) => (requirement.sourceAnchors || []).map((anchor) => anchor.sourceId)))
  const dispositionBySourceId = new Map((workItem.sourceUnitDispositions || []).map((d) => [d.sourceId, d]))
  const unattributed = sourceUnits.filter((unit) => {
    if (anchoredSourceIds.has(unit.sourceId)) return false
    const disposition = dispositionBySourceId.get(unit.sourceId)
    return disposition?.disposition !== 'not-a-requirement'
  })
  if (unattributed.length) throw new Error(`source units have no requirement attribution: ${unattributed.map((unit) => unit.sourceId).join(', ')}`)
  const fingerprints = coverageFingerprints(workItem)
  return {
    schemaVersion: 1,
    protocol: REVIEW_PROTOCOL,
    projectId: workItem.projectId,
    checks: ['source-unit-to-requirement', 'collection-completeness', 'affected-surface-candidates'],
    ...fingerprints,
    sourceUnits,
    deliveryScope: workItem.deliveryScope || { kind: 'whole-source' },
    candidateRequirements: reviewRequirements(workItem.requirements),
  }
}

export function validateCoverageReviewResponse(workItem, response) {
  const problems = []
  const expected = coverageFingerprints(workItem)
  if (response?.schemaVersion !== 1) problems.push('schemaVersion must be 1')
  if (response?.protocol !== REVIEW_PROTOCOL) problems.push(`protocol must be ${REVIEW_PROTOCOL}`)
  if (response?.projectId !== workItem?.projectId) problems.push('review project does not match work item')
  if (response?.sourceFingerprint !== expected.sourceFingerprint) problems.push('review source fingerprint is stale')
  if (response?.requirementsFingerprint !== expected.requirementsFingerprint) problems.push('review requirements fingerprint is stale')
  if (!response?.reviewRunId?.trim()) problems.push('reviewRunId is required')
  if (!response?.completedAt || Number.isNaN(Date.parse(response.completedAt))) problems.push('completedAt must be an ISO timestamp')
  if (!['human', 'model'].includes(response?.reviewer?.kind) || !response?.reviewer?.id?.trim()) problems.push('reviewer kind and id are required')
  if (workItem?.requirementsAuthor?.id === response?.reviewer?.id) problems.push('reviewer must not be the same entity as the requirements author')
  if (!['pass', 'changes-required'].includes(response?.verdict)) problems.push('verdict must be pass or changes-required')
  if (!Array.isArray(response?.findings)) problems.push('findings must be an array')

  const findings = Array.isArray(response?.findings) ? response.findings : []
  const findingIds = []
  for (const finding of findings) {
    if (!finding?.findingId?.trim() || !finding?.code?.trim() || !finding?.message?.trim()) problems.push('every finding requires findingId, code, and message')
    if (finding?.findingId) findingIds.push(finding.findingId)
    if (!allowedFindingCodes.has(finding?.code)) problems.push(`${finding?.findingId || 'finding'} has invalid code`)
    if (!Array.isArray(finding?.sourceIds)) problems.push(`${finding?.findingId || 'finding'} requires sourceIds`)
    if (!allowedDispositions.has(finding?.disposition)) problems.push(`${finding?.findingId || 'finding'} has invalid disposition`)
    if (['not-applicable', 'deferred'].includes(finding?.disposition) && !finding?.reason?.trim()) problems.push(`${finding.findingId} ${finding.disposition} requires a reason`)
    if (finding?.disposition === 'deferred' && (!finding?.owner?.trim() || !finding?.batch?.trim())) problems.push(`${finding.findingId} deferred requires owner and batch`)
  }
  const duplicateIds = findingIds.filter((id, index) => findingIds.indexOf(id) !== index)
  if (duplicateIds.length) problems.push(`duplicate finding IDs: ${[...new Set(duplicateIds)].join(', ')}`)
  const open = findings.filter((finding) => finding.disposition === 'open')
  if (workItem?.deliveryScope?.kind === 'bounded-batch') {
    const expected = workItem.deliveryScope.deferred
    const boundary = findings.find((finding) => finding.disposition === 'deferred' && finding.owner === expected.owner && finding.batch === expected.batch)
    if (!boundary) problems.push(`bounded delivery scope requires a deferred finding for ${expected.batch}`)
  }
  if (response?.verdict === 'pass' && open.length) problems.push('pass verdict cannot contain open findings')
  if (response?.verdict === 'changes-required' && !open.length) problems.push('changes-required verdict must contain an open finding')
  return problems
}

export function applyCoverageReview(workItem, response) {
  const problems = validateCoverageReviewResponse(workItem, response)
  if (problems.length) throw new Error(`invalid coverage review: ${problems.join('; ')}`)
  const unresolved = response.findings.filter((finding) => finding.disposition === 'open').map((finding) => `${finding.findingId}: ${finding.message}`)
  return {
    ...workItem,
    coverageAudit: {
      sourceFingerprint: response.sourceFingerprint,
      requirementsFingerprint: response.requirementsFingerprint,
      reviewMode: 'independent-cold-read',
      reviewRunId: response.reviewRunId,
      reviewer: response.reviewer,
      completedAt: response.completedAt,
      verdict: response.verdict,
      findings: structuredClone(response.findings),
      unresolved,
    },
  }
}

export function selfTest() {
  const workItem = {
    workflowVersion: 2,
    projectId: 'PR-00001',
    sourceSnapshot: { revision: '1', contentHash: 'a', sources: [{ path: 'prd.md', contentHash: 'a' }] },
    requirements: [{ requirementId: 'R-001', sourceAnchors: [{ sourceId: 'SRC-1' }], statement: 'A', affectedSurfaces: [] }],
    coverageAudit: {},
  }
  const request = buildCoverageReviewRequest({
    workItem,
    sourceUnits: [{ sourceId: 'SRC-1', type: 'text', path: 'prd.md', lineStart: 1, lineEnd: 1, content: 'A', contentHash: 'a' }],
  })
  assert.equal(request.protocol, REVIEW_PROTOCOL)
  assert.equal(request.candidateRequirements[0].evidencePlan, undefined)
  assert.deepEqual(request.deliveryScope, { kind: 'whole-source' })

  const response = {
    schemaVersion: 1,
    protocol: REVIEW_PROTOCOL,
    projectId: workItem.projectId,
    sourceFingerprint: request.sourceFingerprint,
    requirementsFingerprint: request.requirementsFingerprint,
    reviewRunId: 'review-1',
    completedAt: '2026-09-04T00:00:00Z',
    reviewer: { kind: 'human', id: 'reviewer@example.com' },
    verdict: 'pass',
    findings: [],
  }
  const reviewed = applyCoverageReview(workItem, response)
  assert.equal(reviewed.coverageAudit.verdict, 'pass')
  assert.deepEqual(reviewed.coverageAudit.findings, [])
  assert.deepEqual(reviewed.coverageAudit.unresolved, [])
  assert.equal(verifyVNextCoverage({ workItem: reviewed }).checks.find((item) => item.code === 'REQUIREMENT_COVERAGE').ok, true)
  assert.throws(() => buildCoverageReviewRequest({ workItem, sourceUnits: [{ sourceId: 'OTHER' }] }), /anchors are absent/)
  assert.throws(() => applyCoverageReview(workItem, { ...response, sourceFingerprint: 'stale' }), /source fingerprint is stale/)
  const { findings: omittedFindings, ...withoutFindings } = response
  assert.equal(omittedFindings.length, 0)
  assert.throws(() => applyCoverageReview(workItem, withoutFindings), /findings must be an array/)
  assert.throws(() => applyCoverageReview(workItem, {
    ...response,
    verdict: 'pass',
    findings: [{ findingId: 'F-1', code: 'MISSING', message: 'missing', disposition: 'open' }],
  }), /pass verdict cannot contain open findings/)

  const bounded = {
    ...workItem,
    deliveryScope: {
      kind: 'bounded-batch', batchId: 'batch-1', includedRequirementIds: ['R-001'],
      deferred: { owner: 'other-owner', batch: 'batch-2', reason: 'separate delivery' },
    },
  }
  const boundedRequest = buildCoverageReviewRequest({ workItem: bounded, sourceUnits: request.sourceUnits })
  assert.equal(boundedRequest.deliveryScope.batchId, 'batch-1')
  const boundedResponse = { ...response, sourceFingerprint: boundedRequest.sourceFingerprint, requirementsFingerprint: boundedRequest.requirementsFingerprint }
  assert.throws(() => applyCoverageReview(bounded, boundedResponse), /requires a deferred finding/)
  const boundaryFinding = { findingId: 'F-DEFER', code: 'other', message: 'remainder is delegated', sourceIds: [], disposition: 'deferred', reason: 'separate delivery', owner: 'other-owner', batch: 'batch-2' }
  assert.equal(applyCoverageReview(bounded, { ...boundedResponse, findings: [boundaryFinding] }).coverageAudit.verdict, 'pass')
  assert.throws(() => buildCoverageReviewRequest({ workItem: { ...bounded, deliveryScope: { ...bounded.deliveryScope, includedRequirementIds: [] } }, sourceUnits: request.sourceUnits }), /includedRequirementIds/)
  console.log('vnext-coverage-review self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
