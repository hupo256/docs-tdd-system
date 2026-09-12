#!/usr/bin/env node
// docs_tdd vNext 的最小确定性闭环：source snapshot → atomic requirement → affected surfaces。
// 这是 v2 正式出口的纯判定层；与 v1 Gate 隔离，也不负责调用模型做需求抽取。

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isStructuralSourceUnit } from './vnext-source-units.mjs'

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
  const reviewedRequirements = workItem?.deliveryScope || workItem?.sourceUnitDispositions || workItem?.evidenceCommands
    ? {
        requirements,
        ...(workItem?.deliveryScope ? { deliveryScope: workItem.deliveryScope } : {}),
        ...(workItem?.sourceUnitDispositions ? { sourceUnitDispositions: workItem.sourceUnitDispositions } : {}),
        ...(workItem?.evidenceCommands ? { evidenceCommands: workItem.evidenceCommands } : {}),
      }
    : requirements
  return {
    sourceFingerprint: stableFingerprint(workItem?.sourceSnapshot || null),
    requirementsFingerprint: stableFingerprint(reviewedRequirements),
  }
}

export function effectiveCoverageReview(workItem) {
  const audit = workItem?.coverageAudit || {}
  const fingerprints = coverageFingerprints(workItem)
  const problems = []
  if (audit.sourceFingerprint !== fingerprints.sourceFingerprint) problems.push('coverage audit source fingerprint is stale')
  if (audit.requirementsFingerprint !== fingerprints.requirementsFingerprint) problems.push('coverage audit requirements fingerprint is stale')
  if (audit.verdict === 'pass' && !(audit.unresolved || []).length) return { ok: problems.length === 0, mode: 'review', problems }

  const adjudication = workItem?.reviewAdjudication
  if (!adjudication) return { ok: false, mode: 'review', problems: [...problems, 'coverage audit verdict is not pass'] }
  if (adjudication.originalReviewRunId !== audit.reviewRunId) problems.push('review adjudication targets a different review run')
  if (adjudication.sourceFingerprint !== fingerprints.sourceFingerprint) problems.push('review adjudication source fingerprint is stale')
  if (adjudication.requirementsFingerprint !== fingerprints.requirementsFingerprint) problems.push('review adjudication requirements fingerprint is stale')
  if (adjudication.effectiveVerdict !== 'pass') problems.push('review adjudication does not pass coverage')
  const findings = audit.findings || []
  const decisions = adjudication.decisions || []
  const expectedIds = findings.map((finding) => finding.findingId).sort()
  const actualIds = decisions.map((decision) => decision.findingId).sort()
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) problems.push('review adjudication does not cover every finding exactly once')
  if (decisions.some((decision) => decision.disposition === 'accepted')) problems.push('accepted review findings require extraction repair and a new review')
  return { ok: problems.length === 0, mode: 'human-adjudication', problems }
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

export function v0MicroProblems(workItem, sourceUnits = []) {
  if (workItem?.routing?.verificationLevel !== 'V0') return []
  const problems = []
  const requirements = workItem.requirements || []
  const implementingSurfaces = requirements.flatMap((requirement) => requirement.affectedSurfaces || []).filter((surface) => surface.disposition === 'implement')
  const richUnits = sourceUnits.filter((unit) => ['table', 'image', 'embed'].includes(unit.type))
  if (requirements.length !== 1 || requirements[0]?.status !== 'doing') problems.push('V0-micro requires exactly one doing requirement')
  if (implementingSurfaces.length !== 1) problems.push('V0-micro requires exactly one implement surface')
  if (workItem?.routing?.scopeClass !== 'local' || workItem.routing.riskSignals?.length) problems.push('V0-micro requires local scope with no risk signals')
  if (workItem?.apiDependency?.mode !== 'no-request') problems.push('V0-micro requires apiDependency.mode=no-request')
  if (workItem?.deliveryScope) problems.push('V0-micro cannot use a bounded delivery scope')
  if (richUnits.length || workItem?.sourceSnapshot?.assets?.length) problems.push('V0-micro cannot contain table, image, or embedded source units')
  const collection = requirements[0]?.collectionSemantics
  if (collection && (collection.kind !== 'none' || collection.expectedCount !== 0)) problems.push('V0-micro cannot contain collection semantics')
  if ((requirements[0]?.evidencePlan || []).some((item) => item.runtimeRequired)) problems.push('V0-micro cannot require runtime evidence')
  return problems
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
  const effectiveReview = effectiveCoverageReview(workItem)
  if (!effectiveReview.ok) problems.push(...effectiveReview.problems)

  const anchoredSourceIds = new Set()
  for (const requirement of requirements) {
    for (const sourceId of sourceAnchorIds(requirement)) anchoredSourceIds.add(sourceId)
  }
  const dispositionBySourceId = new Map((workItem.sourceUnitDispositions || []).map((d) => [d.sourceId, d]))
  const sourceUnitIds = new Set((sourceUnits || []).map((unit) => unit.sourceId))
  for (const unit of sourceUnits || []) {
    if (anchoredSourceIds.has(unit.sourceId) || isStructuralSourceUnit(unit)) continue
    const disposition = dispositionBySourceId.get(unit.sourceId)
    if (disposition?.disposition !== 'not-a-requirement') {
      problems.push(`source unit ${unit.sourceId} is not anchored to any requirement and has no not-a-requirement disposition`)
    }
  }
  for (const disposition of workItem.sourceUnitDispositions || []) {
    if (!sourceUnitIds.has(disposition.sourceId)) problems.push(`sourceUnitDisposition references unknown source unit: ${disposition.sourceId}`)
    if (disposition.disposition === 'not-a-requirement' && !disposition.reason?.trim()) problems.push(`not-a-requirement disposition for ${disposition.sourceId} requires a reason`)
  }

  problems.push(...v0MicroProblems(workItem, sourceUnits))

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
  if (workItem?.coverageAudit?.receipt) {
    const extractionAudit = workItem.extractionAudit
    const expectedRequirements = coverageFingerprints(workItem).requirementsFingerprint
    if (extractionAudit?.status !== 'pass') sourceProblems.push('signed review requires a passing deterministic extraction audit')
    if (extractionAudit?.sourceFingerprint !== expectedSource) sourceProblems.push('extraction audit does not match current source snapshot')
    if (extractionAudit?.requirementsFingerprint !== expectedRequirements) sourceProblems.push('extraction audit does not match current requirements')
    if (sourceUnits && extractionAudit?.sourceUnitsFingerprint !== stableFingerprint(sourceUnits)) sourceProblems.push('extraction audit does not match current normalized source units')
  }

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
  const commandBound = { ...base, evidenceCommands: [{ evidenceId: 'E-1', kind: 'directed-tests', argv: ['pnpm', 'test'] }] }
  const commandChanged = { ...base, evidenceCommands: [{ evidenceId: 'E-1', kind: 'directed-tests', argv: ['pnpm', 'test', 'other'] }] }
  assert.notEqual(coverageFingerprints(commandBound).requirementsFingerprint, coverageFingerprints(commandChanged).requirementsFingerprint)
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

  const v0 = {
    ...base,
    routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0', routerVersion: 1 },
    requirements: [{
      ...base.requirements[0],
      collectionSemantics: { kind: 'none', expectedCount: 0 },
      affectedSurfaces: [{ surfaceId: 'S-001', locator: 'page-a', disposition: 'implement' }],
      evidencePlan: [{ type: 'component-dom', runtimeRequired: false }],
    }],
  }
  const v0Sealed = sealCoverageAuditForFixture(v0)
  const structuralUnit = { sourceId: 'SRC-HEADING', type: 'text', content: '## Requirement' }
  const semanticUnit = { sourceId: 'SRC-001', type: 'text', content: 'Two entries show the same copy.' }
  assert.equal(verifyVNextCoverage({ workItem: v0Sealed, sourceUnits: [structuralUnit, semanticUnit] }).checks.find((item) => item.code === 'REQUIREMENT_COVERAGE').ok, true)
  const extraSemantic = { sourceId: 'SRC-EXTRA', type: 'text', content: 'Also change the mobile entry.' }
  assert.equal(verifyVNextCoverage({ workItem: v0Sealed, sourceUnits: [structuralUnit, semanticUnit, extraSemantic] }).checks.find((item) => item.code === 'REQUIREMENT_COVERAGE').ok, false)
  assert.match(v0MicroProblems(v0Sealed, [{ sourceId: 'SRC-TABLE', type: 'table', content: '| A |' }]).join(' '), /cannot contain table/)
  console.log('vnext-work-item self-test passed')
}

if (process.argv[1]?.endsWith('vnext-work-item.mjs') && process.argv.includes('--self-test')) selfTest()
