#!/usr/bin/env node
// Minimal I/O contract for an independent vNext coverage review.
// This module prepares/verifies JSON only; the workflow orchestrator chooses a human or model reviewer.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { coverageFingerprints, stableFingerprint, verifyVNextCoverage } from './vnext-work-item.mjs'
import { deliveryPolicyPaths } from './vnext-delivery-scope.mjs'
import { reviewRequestFingerprint, verifyReviewReceipt } from './vnext-review-receipt.mjs'
import { sourceUnitDispositionProblems } from './vnext-source-disposition.mjs'
import { isStructuralSourceUnit } from './vnext-source-units.mjs'

export const REVIEW_PROTOCOL = 'vnext-independent-coverage-review-v3'
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

export function candidateRequirementFingerprints(requirements = []) {
  return requirements.map((item) => ({
    requirementId: item.requirementId,
    fingerprint: item.fingerprint || stableFingerprint(item),
  }))
}

function candidateDiff(previous = [], current = []) {
  const previousById = new Map(candidateRequirementFingerprints(previous).map((item) => [item.requirementId, item.fingerprint]))
  const currentById = new Map(candidateRequirementFingerprints(current).map((item) => [item.requirementId, item.fingerprint]))
  return {
    addedRequirementIds: [...currentById.keys()].filter((id) => !previousById.has(id)).sort(),
    removedRequirementIds: [...previousById.keys()].filter((id) => !currentById.has(id)).sort(),
    changedRequirementIds: [...currentById.keys()].filter((id) => previousById.has(id)
      && previousById.get(id) !== currentById.get(id)).sort(),
  }
}

export function attachReviewIteration(request, reviewControl = {}, { reviewRunId = '' } = {}) {
  const history = reviewControl.history || []
  const completedIndex = reviewRunId ? history.findIndex((item) => item.reviewRunId === reviewRunId) : -1
  const prior = completedIndex >= 0 ? history[completedIndex - 1] : history.at(-1)
  const iteration = completedIndex >= 0 ? completedIndex + 1 : (reviewControl.attempts || 0) + 1
  const packet = !prior
    ? { ...request, reviewIteration: iteration }
    : {
        ...request,
        reviewIteration: iteration,
        previousReview: { reviewRunId: prior.reviewRunId, verdict: prior.verdict, findings: structuredClone(prior.findings || []) },
        candidateDiff: candidateDiff(
          prior.candidateRequirementFingerprints || prior.candidateRequirements || [],
          request.candidateRequirements || [],
        ),
      }
  return { ...packet, requestFingerprint: reviewRequestFingerprint(packet) }
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
  if (scope.deferred !== null && (!scope.deferred?.owner?.trim() || !scope.deferred?.batch?.trim() || !scope.deferred?.reason?.trim())) {
    problems.push('bounded deliveryScope.deferred must be null for an empty remainder or include owner, batch, and reason')
  }
  try { deliveryPolicyPaths(workItem) } catch (error) { problems.push(error.message) }
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
  const sourceUnitById = new Map(sourceUnits.map((unit) => [unit.sourceId, unit]))
  const dispositionProblems = (workItem.sourceUnitDispositions || []).flatMap((disposition) =>
    sourceUnitDispositionProblems(disposition, sourceUnitById.get(disposition.sourceId)))
  if (dispositionProblems.length) throw new Error(`invalid source-unit dispositions: ${dispositionProblems.join('; ')}`)
  const unattributed = sourceUnits.filter((unit) => {
    if (anchoredSourceIds.has(unit.sourceId) || isStructuralSourceUnit(unit)) return false
    const disposition = dispositionBySourceId.get(unit.sourceId)
    return disposition?.disposition !== 'not-a-requirement'
  })
  if (unattributed.length) throw new Error(`source units have no requirement attribution: ${unattributed.map((unit) => unit.sourceId).join(', ')}`)
  const prioritizedSourceUnits = sourceUnits
    .filter((unit) => anchoredSourceIds.has(unit.sourceId) || !isStructuralSourceUnit(unit))
    .sort((left, right) => Number(anchoredSourceIds.has(right.sourceId)) - Number(anchoredSourceIds.has(left.sourceId)))
  const prioritizedIds = new Set(prioritizedSourceUnits.map((unit) => unit.sourceId))
  const missingAnchors = [...anchoredSourceIds].filter((sourceId) => !prioritizedIds.has(sourceId))
  if (missingAnchors.length) throw new Error(`review payload lost requirement anchors: ${missingAnchors.join(', ')}`)
  const sourceInventory = sourceUnits.map((unit) => ({
    sourceId: unit.sourceId,
    type: unit.type,
    structural: isStructuralSourceUnit(unit),
    anchored: anchoredSourceIds.has(unit.sourceId),
    disposition: dispositionBySourceId.get(unit.sourceId)?.disposition || (anchoredSourceIds.has(unit.sourceId) ? 'requirement-anchor' : 'unassigned'),
  }))
  const sourceAssets = sourceUnits.filter((unit) => unit.type === 'image').map((unit) => ({
    sourceId: unit.sourceId,
    assetPath: unit.assetPath,
    assetHash: unit.assetHash,
    assetStatus: unit.assetStatus,
    mediaType: unit.mediaType,
    reviewDisposition: anchoredSourceIds.has(unit.sourceId) ? 'attached-requirement-anchor' : 'manifest-only',
  }))
  const unreadAssets = sourceAssets.filter((asset) => !asset.assetHash || !['local', 'embedded'].includes(asset.assetStatus))
  if (unreadAssets.length) throw new Error(`image assets are not locally readable: ${unreadAssets.map((asset) => `${asset.sourceId}:${asset.assetStatus}`).join(', ')}`)
  const reviewAssets = sourceAssets.filter((asset) => asset.reviewDisposition === 'attached-requirement-anchor')
  const { sourceFingerprint, requirementsFingerprint } = coverageFingerprints(workItem)
  const request = {
    schemaVersion: 1,
    protocol: REVIEW_PROTOCOL,
    projectId: workItem.projectId,
    checks: ['source-unit-to-fact', 'fact-to-requirement', 'collection-completeness', 'affected-surface-candidates'],
    sourceFingerprint,
    requirementsFingerprint,
    sourceUnits: prioritizedSourceUnits,
    sourceInventory,
    sourceAssets,
    reviewAssets,
    deliveryScope: workItem.deliveryScope || { kind: 'whole-source' },
    extractionFacts: structuredClone(workItem.extractionFacts || []),
    candidateRequirements: reviewRequirements(workItem.requirements),
  }
  return { ...request, requestFingerprint: reviewRequestFingerprint(request) }
}

export function validateCoverageReviewResponse(workItem, response, { request = null, receiptKeyPath } = {}) {
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
  if (!['human', 'model'].includes(workItem?.requirementsAuthor?.kind) || !workItem?.requirementsAuthor?.id?.trim()) problems.push('requirementsAuthor is required')
  const sameReviewerIdentity = workItem?.requirementsAuthor?.id === response?.reviewer?.id
  const independentlySessionedModel = workItem?.requirementsAuthor?.kind === 'model'
    && response?.reviewer?.kind === 'model'
    && workItem?.requirementsAuthor?.sessionId
    && response?.receipt?.sessionId
    && workItem.requirementsAuthor.sessionId !== response.receipt.sessionId
  if (sameReviewerIdentity && !independentlySessionedModel) problems.push('reviewer must not be the same entity/session as the requirements author')
  if (!['pass', 'changes-required'].includes(response?.verdict)) problems.push('verdict must be pass or changes-required')
  if (!Array.isArray(response?.findings)) problems.push('findings must be an array')

  const findings = Array.isArray(response?.findings) ? response.findings : []
  const sourceIds = new Set(request?.sourceUnits?.map((unit) => unit.sourceId) || [])
  const findingIds = []
  for (const finding of findings) {
    if (!finding?.findingId?.trim() || !finding?.code?.trim() || !finding?.message?.trim()) problems.push('every finding requires findingId, code, and message')
    if (finding?.findingId) findingIds.push(finding.findingId)
    if (!allowedFindingCodes.has(finding?.code)) problems.push(`${finding?.findingId || 'finding'} has invalid code`)
    if (!Array.isArray(finding?.sourceIds)) problems.push(`${finding?.findingId || 'finding'} requires sourceIds`)
    else if (sourceIds.size && finding.sourceIds.some((sourceId) => !sourceIds.has(sourceId))) problems.push(`${finding?.findingId || 'finding'} references an unknown sourceId`)
    if (!allowedDispositions.has(finding?.disposition)) problems.push(`${finding?.findingId || 'finding'} has invalid disposition`)
    if (['not-applicable', 'deferred'].includes(finding?.disposition) && !finding?.reason?.trim()) problems.push(`${finding.findingId} ${finding.disposition} requires a reason`)
    if (finding?.disposition === 'deferred' && (!finding?.owner?.trim() || !finding?.batch?.trim())) problems.push(`${finding.findingId} deferred requires owner and batch`)
  }
  const duplicateIds = findingIds.filter((id, index) => findingIds.indexOf(id) !== index)
  if (duplicateIds.length) problems.push(`duplicate finding IDs: ${[...new Set(duplicateIds)].join(', ')}`)
  const open = findings.filter((finding) => finding.disposition === 'open')
  if (workItem?.deliveryScope?.kind === 'bounded-batch' && workItem.deliveryScope.deferred) {
    const expected = workItem.deliveryScope.deferred
    const boundary = findings.find((finding) => finding.disposition === 'deferred' && finding.owner === expected.owner && finding.batch === expected.batch)
    if (!boundary) problems.push(`bounded delivery scope requires a deferred finding for ${expected.batch}`)
  }
  if (response?.verdict === 'pass' && open.length) problems.push('pass verdict cannot contain open findings')
  if (response?.verdict === 'changes-required' && !open.length) problems.push('changes-required verdict must contain an open finding')

  const sourceAssets = request?.sourceAssets || workItem?.sourceSnapshot?.assets || []
  const receiptRequired = workItem?.routing?.verificationLevel !== 'V0' || sourceAssets.length > 0
  if (receiptRequired) {
    if (!request) problems.push('current normalized review request is required to validate the receipt')
    else problems.push(...verifyReviewReceipt(response, { requestFingerprint: reviewRequestFingerprint(request), sourceAssets: request.reviewAssets || sourceAssets, keyPath: receiptKeyPath }))
    if (workItem?.requirementsAuthor?.kind === 'model' && !workItem.requirementsAuthor.client?.trim()) problems.push('requirementsAuthor.client is required for independent model review')
    if (workItem?.requirementsAuthor?.kind === 'model' && !workItem.requirementsAuthor.sessionId?.trim()) problems.push('requirementsAuthor.sessionId is required for independent model review')
    if (workItem?.requirementsAuthor?.sessionId && workItem.requirementsAuthor.sessionId === response?.receipt?.sessionId) problems.push('reviewer session must differ from requirements author session')
  }
  return problems
}

export function coverageReviewResponseFromAudit(workItem) {
  const audit = workItem?.coverageAudit
  if (!audit?.receipt || !audit?.reviewRunId || !audit?.reviewer || !audit?.verdict) return null
  return {
    schemaVersion: 1,
    protocol: REVIEW_PROTOCOL,
    projectId: workItem.projectId,
    sourceFingerprint: audit.sourceFingerprint,
    requirementsFingerprint: audit.requirementsFingerprint,
    reviewRunId: audit.reviewRunId,
    completedAt: audit.completedAt,
    reviewer: structuredClone(audit.reviewer),
    verdict: audit.verdict,
    findings: structuredClone(audit.findings || []),
    receipt: structuredClone(audit.receipt),
  }
}

export function applyCoverageReview(workItem, response, options = {}) {
  const problems = validateCoverageReviewResponse(workItem, response, options)
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
      ...(response.receipt ? { receipt: structuredClone(response.receipt) } : {}),
      unresolved,
    },
  }
}

export function selfTest() {
  const workItem = {
    workflowVersion: 2,
    projectId: 'PR-00001',
    sourceSnapshot: { revision: '1', contentHash: 'a', sources: [{ path: 'prd.md', contentHash: 'a' }] },
    requirements: [{ requirementId: 'R-001', sourceAnchors: [{ sourceId: 'SRC-1' }], statement: 'A', status: 'doing', affectedSurfaces: [{ surfaceId: 'S-001', locator: 'src/a.ts', disposition: 'implement' }], evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }] }],
    requirementsAuthor: { kind: 'human', id: 'author@example.com' },
    routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0' },
    apiDependency: { mode: 'no-request', reason: 'fixture' },
    coverageAudit: {},
  }
  const sourceUnits = [
    { sourceId: 'SRC-HEADING', type: 'text', path: 'prd.md', lineStart: 1, lineEnd: 1, content: '# Requirement', contentHash: 'heading' },
    { sourceId: 'SRC-1', type: 'text', path: 'prd.md', lineStart: 2, lineEnd: 2, content: 'A', contentHash: 'a' },
  ]
  const request = buildCoverageReviewRequest({ workItem, sourceUnits })
  assert.equal(request.protocol, REVIEW_PROTOCOL)
  assert.equal(Object.hasOwn(request.candidateRequirements[0], 'evidencePlan'), false)
  assert.equal(Object.hasOwn(request, 'candidateEvidenceCommands'), false)
  assert.deepEqual(request.deliveryScope, { kind: 'whole-source' })
  assert.equal(request.sourceUnits[0].sourceId, 'SRC-1')
  assert.equal(request.sourceUnits.some((unit) => unit.sourceId === 'SRC-HEADING'), false)
  assert.equal(request.sourceInventory.some((unit) => unit.sourceId === 'SRC-HEADING' && unit.structural), true)
  assert.equal(candidateRequirementFingerprints(request.candidateRequirements)[0].fingerprint.length, 64)
  const imageUnits = [
    ...sourceUnits,
    { sourceId: 'IMG-ANCHORED', type: 'image', path: 'prd.md', lineStart: 3, lineEnd: 3, content: 'target state', contentHash: 'image-a', assetPath: 'a.png', assetHash: 'a'.repeat(64), assetStatus: 'local', mediaType: 'image/png' },
    { sourceId: 'IMG-REFERENCE', type: 'image', path: 'prd.md', lineStart: 4, lineEnd: 4, content: 'current state', contentHash: 'image-b', assetPath: 'b.png', assetHash: 'b'.repeat(64), assetStatus: 'local', mediaType: 'image/png' },
  ]
  const imageWorkItem = structuredClone(workItem)
  imageWorkItem.requirements[0].sourceAnchors.push({ sourceId: 'IMG-ANCHORED' })
  imageWorkItem.sourceUnitDispositions = [{
    sourceId: 'IMG-REFERENCE',
    disposition: 'not-a-requirement',
    reason: 'current-state reference',
    exclusionEvidence: { basis: 'context-only', sourceQuote: 'current state' },
  }]
  const imageRequest = buildCoverageReviewRequest({ workItem: imageWorkItem, sourceUnits: imageUnits })
  assert.deepEqual(imageRequest.reviewAssets.map((asset) => asset.sourceId), ['IMG-ANCHORED'])
  assert.equal(imageRequest.sourceAssets.find((asset) => asset.sourceId === 'IMG-REFERENCE').reviewDisposition, 'manifest-only')

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
  const requirementCheck = verifyVNextCoverage({ workItem: reviewed }).checks.find((item) => item.code === 'REQUIREMENT_COVERAGE')
  assert.equal(requirementCheck.ok, true, requirementCheck.problems.join('; '))
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
  const emptyRemainderRequest = buildCoverageReviewRequest({ workItem: { ...bounded, deliveryScope: { ...bounded.deliveryScope, deferred: null } }, sourceUnits: request.sourceUnits })
  assert.equal(emptyRemainderRequest.deliveryScope.deferred, null)
  const boundedResponse = { ...response, sourceFingerprint: boundedRequest.sourceFingerprint, requirementsFingerprint: boundedRequest.requirementsFingerprint }
  assert.throws(() => applyCoverageReview(bounded, boundedResponse), /requires a deferred finding/)
  const boundaryFinding = { findingId: 'F-DEFER', code: 'other', message: 'remainder is delegated', sourceIds: [], disposition: 'deferred', reason: 'separate delivery', owner: 'other-owner', batch: 'batch-2' }
  assert.equal(applyCoverageReview(bounded, { ...boundedResponse, findings: [boundaryFinding] }).coverageAudit.verdict, 'pass')
  assert.throws(() => buildCoverageReviewRequest({ workItem: { ...bounded, deliveryScope: { ...bounded.deliveryScope, includedRequirementIds: [] } }, sourceUnits: request.sourceUnits }), /includedRequirementIds/)
  console.log('vnext-coverage-review self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
