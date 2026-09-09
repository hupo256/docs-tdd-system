#!/usr/bin/env node
// docs_tdd vNext 的最小确定性闭环：source snapshot → atomic requirement → affected surfaces。
// 这是 v2 正式出口的纯判定层；与 v1 Gate 隔离，也不负责调用模型做需求抽取。

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

export function stableFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

export function coverageFingerprints(workItem) {
  const requirements = workItem?.requirements || []
  // A bounded delivery batch is part of the reviewed requirement boundary. Keep the legacy
  // fingerprint unchanged when no boundary is declared, but invalidate review/scope approval
  // whenever a declared batch or its delegated remainder changes.
  const reviewedRequirements = workItem?.deliveryScope
    ? { requirements, deliveryScope: workItem.deliveryScope, sourceUnitDispositions: workItem?.sourceUnitDispositions }
    : workItem?.sourceUnitDispositions
      ? { requirements, sourceUnitDispositions: workItem.sourceUnitDispositions }
      : requirements
  return {
    sourceFingerprint: stableFingerprint(workItem?.sourceSnapshot || null),
    requirementsFingerprint: stableFingerprint(reviewedRequirements),
  }
}

// Test/replay helper only. Production callers must use applyCoverageReview(), which validates
// reviewer identity, verdict, dispositions and both fingerprints before sealing the audit.
export function sealCoverageAuditForFixture(workItem, { reviewRunId = 'fixture-review' } = {}) {
  const fingerprints = coverageFingerprints(workItem)
  return {
    ...workItem,
    coverageAudit: {
      ...workItem.coverageAudit,
      ...fingerprints,
      reviewMode: 'independent-cold-read',
      reviewRunId,
      reviewer: { kind: 'model', id: 'deterministic-replay-fixture' },
      completedAt: '2000-01-01T00:00:00.000Z',
      verdict: workItem.coverageAudit?.unresolved?.length ? 'changes-required' : 'pass',
      findings: workItem.coverageAudit?.findings || [],
      unresolved: workItem.coverageAudit?.unresolved || [],
    },
  }
}

const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

function sourceAnchorIds(requirement) {
  return new Set((requirement.sourceAnchors || []).map((anchor) => anchor.sourceId).filter(Boolean))
}

function requirementCoverageProblems(workItem, sourceUnits, sourceOracle) {
  const requirements = workItem.requirements || []
  const problems = []
  const ids = requirements.map((item) => item.requirementId).filter(Boolean)
  const duplicates = duplicateValues(ids)
  if (duplicates.length) problems.push(`duplicate requirement IDs: ${duplicates.join(', ')}`)
  if (!requirements.length) problems.push('no atomic requirements')

  for (const requirement of requirements) {
    if (!requirement.requirementId || !requirement.statement?.trim()) problems.push('requirement missing ID or statement')
    if (!requirement.sourceAnchors?.length) problems.push(`${requirement.requirementId || 'unknown requirement'} has no source anchor`)
  }

  const currentFingerprint = coverageFingerprints(workItem).requirementsFingerprint
  if (workItem.coverageAudit?.requirementsFingerprint !== currentFingerprint) problems.push('coverage audit does not match current requirements')
  if (workItem.coverageAudit?.reviewMode !== 'independent-cold-read') problems.push('coverage audit was not an independent cold read')
  if (!workItem.coverageAudit?.reviewRunId) problems.push('coverage audit has no review run ID')
  if (!['human', 'model'].includes(workItem.coverageAudit?.reviewer?.kind) || !workItem.coverageAudit?.reviewer?.id) problems.push('coverage audit has no reviewer identity')
  if (!workItem.coverageAudit?.completedAt || Number.isNaN(Date.parse(workItem.coverageAudit.completedAt))) problems.push('coverage audit has no valid completion time')
  if (workItem.coverageAudit?.verdict !== 'pass') problems.push('coverage audit verdict is not pass')
  if (workItem.coverageAudit?.unresolved?.length) problems.push(`coverage audit has unresolved findings: ${workItem.coverageAudit.unresolved.join(', ')}`)

  const anchoredSourceIds = new Set()
  for (const requirement of requirements) {
    for (const sourceId of sourceAnchorIds(requirement)) anchoredSourceIds.add(sourceId)
  }
  const dispositionBySourceId = new Map((workItem.sourceUnitDispositions || []).map((d) => [d.sourceId, d]))
  const sourceUnitIds = new Set((sourceUnits || []).map((unit) => unit.sourceId))
  for (const unit of sourceUnits || []) {
    if (anchoredSourceIds.has(unit.sourceId)) continue
    const disposition = dispositionBySourceId.get(unit.sourceId)
    if (disposition?.disposition !== 'not-a-requirement') {
      problems.push(`source unit ${unit.sourceId} is not anchored to any requirement and has no not-a-requirement disposition`)
    }
  }
  for (const disposition of workItem.sourceUnitDispositions || []) {
    if (!sourceUnitIds.has(disposition.sourceId)) problems.push(`sourceUnitDisposition references unknown source unit: ${disposition.sourceId}`)
    if (disposition.disposition === 'not-a-requirement' && !disposition.reason?.trim()) problems.push(`not-a-requirement disposition for ${disposition.sourceId} requires a reason`)
  }

  for (const unit of sourceOracle?.requiredUnits || []) {
    const mapped = requirements.filter((requirement) => {
      const anchors = sourceAnchorIds(requirement)
      return (unit.sourceIds || []).some((sourceId) => anchors.has(sourceId))
    })
    if (mapped.length < (unit.minimumMappings || 1)) problems.push(`${unit.oracleId} is not mapped from source anchors ${(unit.sourceIds || []).join(', ')}`)
  }
  return problems
}

function surfaceCoverageProblems(workItem, discoveredSurfaces, implementation) {
  const requirements = workItem.requirements || []
  const surfaces = requirements.flatMap((requirement) => (requirement.affectedSurfaces || []).map((surface) => ({ ...surface, requirementId: requirement.requirementId })))
  const problems = []
  const surfaceIds = surfaces.map((surface) => surface.surfaceId).filter(Boolean)
  const duplicates = duplicateValues(surfaceIds)
  if (duplicates.length) problems.push(`duplicate surface IDs: ${duplicates.join(', ')}`)

  for (const requirement of requirements) {
    const semantics = requirement.collectionSemantics
    if (semantics && semantics.kind !== 'none' && (requirement.affectedSurfaces || []).length !== semantics.expectedCount) {
      problems.push(`${requirement.requirementId} expected ${semantics.expectedCount} surfaces but declares ${(requirement.affectedSurfaces || []).length}`)
    }
  }

  const declared = new Map(surfaces.map((surface) => [surface.surfaceId, surface]))
  for (const discovered of discoveredSurfaces || []) {
    if (!declared.has(discovered.surfaceId)) problems.push(`discovered surface is missing: ${discovered.surfaceId} (${discovered.locator || 'unknown'})`)
  }
  for (const surface of surfaces) {
    if (['not-applicable', 'deferred'].includes(surface.disposition) && !surface.reason?.trim()) problems.push(`${surface.surfaceId} ${surface.disposition} requires a reason`)
    if (surface.disposition === 'deferred' && (!surface.owner?.trim() || !surface.batch?.trim())) problems.push(`${surface.surfaceId} deferred requires owner and batch`)
  }

  if (implementation) {
    const covered = new Set(implementation.coveredSurfaceIds || [])
    for (const surface of surfaces.filter((item) => item.disposition === 'implement')) {
      if (!covered.has(surface.surfaceId)) problems.push(`implementation/evidence does not cover ${surface.surfaceId}`)
    }
  }
  return problems
}

export function verifyVNextCoverage({ workItem, currentSourceSnapshot, sourceUnits, sourceOracle, discoveredSurfaces = [], implementation } = {}) {
  const expectedSource = coverageFingerprints(workItem).sourceFingerprint
  const actualSource = stableFingerprint(currentSourceSnapshot || workItem?.sourceSnapshot || null)
  const sourceProblems = []
  if (workItem?.workflowVersion !== 2) sourceProblems.push('workflowVersion must be 2')
  if (!workItem?.sourceSnapshot?.sources?.length) sourceProblems.push('source snapshot has no sources')
  if (actualSource !== expectedSource) sourceProblems.push('current source snapshot differs from work item')
  if (workItem?.coverageAudit?.sourceFingerprint !== expectedSource) sourceProblems.push('coverage audit does not match current source snapshot')

  const requirementProblems = requirementCoverageProblems(workItem || {}, sourceUnits, sourceOracle)
  const surfaceProblems = surfaceCoverageProblems(workItem || {}, discoveredSurfaces, implementation)
  const checks = [
    { code: 'SOURCE_FRESH', ok: sourceProblems.length === 0, problems: sourceProblems },
    { code: 'REQUIREMENT_COVERAGE', ok: requirementProblems.length === 0, problems: requirementProblems },
    { code: 'SURFACE_COVERAGE', ok: surfaceProblems.length === 0, problems: surfaceProblems },
  ]
  return { ok: checks.every((check) => check.ok), checks }
}

export function selfTest() {
  const base = {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId: 'PR-00001',
    sourceSnapshot: { revision: '1', contentHash: 'source', sources: [{ path: 'inbox/prd.md', contentHash: 'source' }] },
    requirements: [{
      requirementId: 'R-001',
      sourceAnchors: [{ type: 'text', sourceId: 'SRC-001', path: 'inbox/prd.md', lineStart: 1, lineEnd: 1 }],
      statement: '两个入口显示同一文案',
      status: 'doing',
      collectionSemantics: { kind: 'explicit-set', expectedCount: 2 },
      affectedSurfaces: [
        { surfaceId: 'S-001', locator: 'page-a', disposition: 'implement' },
        { surfaceId: 'S-002', locator: 'page-b', disposition: 'already-covered' },
      ],
      evidencePlan: [{ type: 'component-dom', runtimeRequired: false }],
    }],
    coverageAudit: { unresolved: [] },
    routing: { scopeClass: 'multi-surface', riskSignals: [], verificationLevel: 'V1', routerVersion: 1 },
    apiDependency: { mode: 'no-request', reason: 'fixture has no network request' },
    scopeApproval: null,
  }
  const sealed = sealCoverageAuditForFixture(base)
  const valid = verifyVNextCoverage({
    workItem: sealed,
    sourceOracle: { requiredUnits: [{ oracleId: 'O-001', sourceIds: ['SRC-001'] }] },
    discoveredSurfaces: [{ surfaceId: 'S-001' }, { surfaceId: 'S-002' }],
    implementation: { coveredSurfaceIds: ['S-001'] },
  })
  assert.equal(valid.ok, true, JSON.stringify(valid))

  const stale = verifyVNextCoverage({ workItem: sealed, currentSourceSnapshot: { ...sealed.sourceSnapshot, revision: '2' } })
  assert.equal(stale.checks.find((check) => check.code === 'SOURCE_FRESH').ok, false)

  const missed = verifyVNextCoverage({
    workItem: sealed,
    sourceOracle: { requiredUnits: [{ oracleId: 'O-002', sourceIds: ['SRC-002'] }] },
    discoveredSurfaces: [{ surfaceId: 'S-001' }, { surfaceId: 'S-002' }, { surfaceId: 'S-003', locator: 'page-c' }],
    implementation: { coveredSurfaceIds: ['S-001'] },
  })
  assert.equal(missed.checks.find((check) => check.code === 'REQUIREMENT_COVERAGE').ok, false)
  assert.equal(missed.checks.find((check) => check.code === 'SURFACE_COVERAGE').ok, false)
  console.log('vnext-work-item self-test passed')
}

if (process.argv[1]?.endsWith('vnext-work-item.mjs') && process.argv.includes('--self-test')) selfTest()
