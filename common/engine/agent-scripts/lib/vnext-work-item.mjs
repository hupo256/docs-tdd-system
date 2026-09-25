#!/usr/bin/env node
// docs_tdd vNext 的最小确定性闭环：source snapshot → atomic requirement → affected surfaces。
// 这是 v2 正式出口的纯判定层；与 v1 Gate 隔离，也不负责调用模型做需求抽取。

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { isStructuralSourceUnit } from './vnext-source-units.mjs'
import { sourceUnitDispositionProblems } from './vnext-source-disposition.mjs'
import { sourceGraphCheck } from './vnext-source-graph.mjs'

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

// Commit bookkeeping is recorded after verification and must not invalidate the verified
// requirement/evidence contract. All implementation and review facts remain fingerprinted.
export function verificationWorkItemFingerprint(workItem) {
  const contract = structuredClone(workItem)
  if (contract?.autopilot) {
    delete contract.autopilot.checkpointCommit
    delete contract.autopilot.delivery
    delete contract.autopilot.lastCheckpointAt
  }
  return stableFingerprint(contract)
}

export function coverageFingerprints(workItem) {
  const requirements = workItem?.requirements || []
  const scopeRequirements = requirements.map(({ evidencePlan: _evidencePlan, ...requirement }) => requirement)
  const hasScopeMetadata = workItem?.intake || workItem?.deliveryScope || workItem?.sourceUnitDispositions || workItem?.extractionFacts
  const reviewedScope = hasScopeMetadata
    ? {
        requirements: scopeRequirements,
        ...(workItem?.extractionFacts ? { extractionFacts: workItem.extractionFacts } : {}),
        ...(workItem?.intake ? { intake: workItem.intake } : {}),
        ...(workItem?.deliveryScope ? { deliveryScope: workItem.deliveryScope } : {}),
        ...(workItem?.sourceUnitDispositions ? { sourceUnitDispositions: workItem.sourceUnitDispositions } : {}),
      }
    : scopeRequirements
  return {
    sourceFingerprint: stableFingerprint(workItem?.sourceSnapshot || null),
    requirementsFingerprint: stableFingerprint(reviewedScope),
    evidencePlanFingerprint: stableFingerprint({
      requirementPlans: requirements.map(({ requirementId, evidencePlan }) => ({ requirementId, evidencePlan: evidencePlan || [] })),
      evidenceCommands: workItem?.evidenceCommands || [],
    }),
  }
}

export function evaluateMicroEligibility(workItem, sourceUnits = []) {
  const fingerprints = coverageFingerprints(workItem)
  const problems = []
  if (workItem?.routing?.verificationLevel !== 'V0') problems.push('deterministic Micro audit requires verificationLevel=V0')
  if (!Array.isArray(sourceUnits) || !sourceUnits.length) problems.push('deterministic Micro audit requires normalized source units')
  problems.push(...v0MicroProblems(workItem, sourceUnits))
  return {
    ok: problems.length === 0,
    mode: 'deterministic-micro-audit',
    ...fingerprints,
    sourceUnitsFingerprint: stableFingerprint(sourceUnits),
    problems: [...new Set(problems)],
  }
}

export function currentMicroEligibility(workItem, { sourceUnits } = {}) {
  const audit = workItem?.extractionAudit
  const eligibility = audit?.microEligibility
  const fingerprints = coverageFingerprints(workItem)
  const problems = []
  if (audit?.status !== 'pass') problems.push('deterministic Micro audit requires a passing extraction audit')
  if (eligibility?.ok !== true || eligibility?.mode !== 'deterministic-micro-audit') problems.push('deterministic Micro eligibility is not approved')
  if (eligibility?.sourceFingerprint !== fingerprints.sourceFingerprint) problems.push('deterministic Micro source fingerprint is stale')
  if (eligibility?.requirementsFingerprint !== fingerprints.requirementsFingerprint) problems.push('deterministic Micro requirements fingerprint is stale')
  if (eligibility?.evidencePlanFingerprint !== fingerprints.evidencePlanFingerprint) problems.push('deterministic Micro evidence-plan fingerprint is stale')
  const expectedSourceUnitsFingerprint = Array.isArray(sourceUnits)
    ? stableFingerprint(sourceUnits)
    : audit?.sourceUnitsFingerprint
  if (!expectedSourceUnitsFingerprint || eligibility?.sourceUnitsFingerprint !== expectedSourceUnitsFingerprint) {
    problems.push('deterministic Micro source-unit fingerprint is stale')
  }
  if (Array.isArray(sourceUnits)) {
    const current = evaluateMicroEligibility(workItem, sourceUnits)
    problems.push(...current.problems)
  }
  return {
    ok: problems.length === 0,
    mode: 'deterministic-micro-audit',
    problems: [...new Set(problems)],
  }
}

export function effectiveCoverageReview(workItem, { sourceUnits } = {}) {
  const micro = currentMicroEligibility(workItem, { sourceUnits })
  if (micro.ok) return micro
  const audit = workItem?.coverageAudit || {}
  const fingerprints = coverageFingerprints(workItem)
  const problems = []
  if (audit.sourceFingerprint !== fingerprints.sourceFingerprint) problems.push('coverage audit source fingerprint is stale')
  const auditScopeIsCurrent = audit.requirementsFingerprint === fingerprints.requirementsFingerprint
  if (!auditScopeIsCurrent && !workItem?.reviewAdjudication?.repairConfirmation) problems.push('coverage audit requirements fingerprint is stale')
  if (audit.verdict === 'pass' && !(audit.unresolved || []).length) return { ok: problems.length === 0, mode: 'review', problems }

  const adjudication = workItem?.reviewAdjudication
  if (!adjudication) return { ok: false, mode: 'review', problems: [...problems, 'coverage audit verdict is not pass'] }
  if (adjudication.originalReviewRunId !== audit.reviewRunId) problems.push('review adjudication targets a different review run')
  if (adjudication.sourceFingerprint !== fingerprints.sourceFingerprint) problems.push('review adjudication source fingerprint is stale')
  if (adjudication.requirementsFingerprint !== fingerprints.requirementsFingerprint) problems.push('review adjudication requirements fingerprint is stale')
  if (!auditScopeIsCurrent && adjudication.baseRequirementsFingerprint !== audit.requirementsFingerprint) problems.push('repair confirmation does not identify the reviewed base scope')
  if (adjudication.effectiveVerdict !== 'pass') problems.push('review adjudication does not pass coverage')
  const findings = audit.findings || []
  const decisions = adjudication.decisions || []
  const expectedIds = findings.map((finding) => finding.findingId).sort()
  const actualIds = decisions.map((decision) => decision.findingId).sort()
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) problems.push('review adjudication does not cover every finding exactly once')
  if (decisions.some((decision) => decision.disposition === 'accepted')) problems.push('accepted review findings require extraction repair and human confirmation')
  return { ok: problems.length === 0, mode: adjudication.repairConfirmation ? 'human-repair-confirmation' : 'human-adjudication', problems }
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

  const effectiveReview = effectiveCoverageReview(workItem, { sourceUnits })
  if (effectiveReview.mode !== 'deterministic-micro-audit') {
    const currentFingerprint = coverageFingerprints(workItem).requirementsFingerprint
    if (workItem.coverageAudit?.requirementsFingerprint !== currentFingerprint && !workItem.reviewAdjudication?.repairConfirmation) {
      problems.push('coverage audit does not match current requirements')
    }
    if (workItem.coverageAudit?.reviewMode !== 'independent-cold-read') problems.push('coverage audit was not an independent cold read')
    if (!workItem.coverageAudit?.reviewRunId) problems.push('coverage audit has no review run ID')
    if (!['human', 'model'].includes(workItem.coverageAudit?.reviewer?.kind) || !workItem.coverageAudit?.reviewer?.id) problems.push('coverage audit has no reviewer identity')
    if (!workItem.coverageAudit?.completedAt || Number.isNaN(Date.parse(workItem.coverageAudit.completedAt))) problems.push('coverage audit has no valid completion time')
  }
  if (!effectiveReview.ok) problems.push(...effectiveReview.problems)

  const anchoredSourceIds = new Set()
  for (const requirement of requirements) {
    for (const sourceId of sourceAnchorIds(requirement)) anchoredSourceIds.add(sourceId)
  }
  const dispositionBySourceId = new Map((workItem.sourceUnitDispositions || []).map((d) => [d.sourceId, d]))
  const sourceUnitIds = new Set((sourceUnits || []).map((unit) => unit.sourceId))
  const sourceUnitById = new Map((sourceUnits || []).map((unit) => [unit.sourceId, unit]))
  for (const unit of sourceUnits || []) {
    if (anchoredSourceIds.has(unit.sourceId) || isStructuralSourceUnit(unit)) continue
    const disposition = dispositionBySourceId.get(unit.sourceId)
    if (disposition?.disposition !== 'not-a-requirement') {
      problems.push(`source unit ${unit.sourceId} is not anchored to any requirement and has no not-a-requirement disposition`)
    }
  }
  for (const disposition of workItem.sourceUnitDispositions || []) {
    if (!sourceUnitIds.has(disposition.sourceId)) problems.push(`sourceUnitDisposition references unknown source unit: ${disposition.sourceId}`)
    problems.push(...sourceUnitDispositionProblems(disposition, sourceUnitById.get(disposition.sourceId)))
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

function surfaceCoverageProblems(workItem, discoveredSurfaces, implementation, reconciliation) {
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
    const reconciled = new Map((reconciliation?.surfaces || []).map((surface) => [surface.surfaceId, surface]))
    for (const surface of surfaces.filter((item) => item.disposition === 'implement')) {
      if (surface.codeLocator) {
        const derived = reconciled.get(surface.surfaceId)
        if (!derived) problems.push(`surface reconciliation has no result for ${surface.surfaceId}`)
        else if (derived.codeStatus !== 'covered' || !['covered', 'n/a'].includes(derived.wiringStatus)) {
          problems.push(`surface reconciliation does not cover ${surface.surfaceId}: code=${derived.codeStatus}, wiring=${derived.wiringStatus}`)
        }
      } else if (!covered.has(surface.surfaceId)) problems.push(`implementation/evidence does not cover ${surface.surfaceId}`)
    }
  }
  return problems
}

export function verifyVNextCoverage({ workItem, currentSourceSnapshot, sourceUnits, sourceOracle, discoveredSurfaces = [], implementation, reconciliation } = {}) {
  const expectedSource = coverageFingerprints(workItem).sourceFingerprint
  const actualSource = stableFingerprint(currentSourceSnapshot || workItem?.sourceSnapshot || null)
  const sourceProblems = []
  const effectiveReview = effectiveCoverageReview(workItem, { sourceUnits })
  if (workItem?.workflowVersion !== 2) sourceProblems.push('workflowVersion must be 2')
  if (!workItem?.sourceSnapshot?.sources?.length) sourceProblems.push('source snapshot has no sources')
  if (actualSource !== expectedSource) sourceProblems.push('current source snapshot differs from work item')
  if (effectiveReview.mode !== 'deterministic-micro-audit' && workItem?.coverageAudit?.sourceFingerprint !== expectedSource) {
    sourceProblems.push('coverage audit does not match current source snapshot')
  }
  if (workItem?.coverageAudit?.receipt) {
    const extractionAudit = workItem.extractionAudit
    const currentFingerprints = coverageFingerprints(workItem)
    if (extractionAudit?.status !== 'pass') sourceProblems.push('signed review requires a passing deterministic extraction audit')
    if (extractionAudit?.sourceFingerprint !== expectedSource) sourceProblems.push('extraction audit does not match current source snapshot')
    if (extractionAudit?.requirementsFingerprint !== currentFingerprints.requirementsFingerprint) sourceProblems.push('extraction audit does not match current requirements')
    if (extractionAudit?.evidencePlanFingerprint !== currentFingerprints.evidencePlanFingerprint) sourceProblems.push('extraction audit does not match current evidence plan')
    if (sourceUnits && extractionAudit?.sourceUnitsFingerprint !== stableFingerprint(sourceUnits)) sourceProblems.push('extraction audit does not match current normalized source units')
  }

  const requirementProblems = requirementCoverageProblems(workItem || {}, sourceUnits, sourceOracle)
  const surfaceProblems = surfaceCoverageProblems(workItem || {}, discoveredSurfaces, implementation, reconciliation)
  const checks = [
    { code: 'SOURCE_FRESH', ok: sourceProblems.length === 0, problems: sourceProblems },
    ...(Array.isArray(sourceUnits) ? [sourceGraphCheck({ sourceUnits, workItem })] : []),
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
  const evidencePlanChanged = structuredClone(commandBound)
  evidencePlanChanged.requirements[0].evidencePlan = [{ type: 'browser-interaction', runtimeRequired: true }]
  assert.equal(coverageFingerprints(commandBound).requirementsFingerprint, coverageFingerprints(commandChanged).requirementsFingerprint)
  assert.equal(coverageFingerprints(commandBound).requirementsFingerprint, coverageFingerprints(evidencePlanChanged).requirementsFingerprint)
  assert.notEqual(coverageFingerprints(commandBound).evidencePlanFingerprint, coverageFingerprints(commandChanged).evidencePlanFingerprint)
  assert.notEqual(coverageFingerprints(commandBound).evidencePlanFingerprint, coverageFingerprints(evidencePlanChanged).evidencePlanFingerprint)
  assert.notEqual(
    coverageFingerprints({ ...base, intake: { kind: 'feature', sourceRole: 'prd', sourceFingerprint: 'a', sourcePaths: ['prd.md'] } }).requirementsFingerprint,
    coverageFingerprints({ ...base, intake: { kind: 'bugfix', sourceRole: 'incident', sourceFingerprint: 'a', sourcePaths: ['prd.md'] } }).requirementsFingerprint,
  )
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
  const deterministicMicro = structuredClone(v0)
  deterministicMicro.extractionAudit = {
    status: 'pass',
    ...coverageFingerprints(deterministicMicro),
    sourceUnitsFingerprint: stableFingerprint([structuralUnit, semanticUnit]),
  }
  deterministicMicro.extractionAudit.microEligibility = evaluateMicroEligibility(deterministicMicro, [structuralUnit, semanticUnit])
  assert.equal(effectiveCoverageReview(deterministicMicro).mode, 'deterministic-micro-audit')
  assert.equal(verifyVNextCoverage({ workItem: deterministicMicro, sourceUnits: [structuralUnit, semanticUnit] }).ok, true)
  deterministicMicro.requirements[0].evidencePlan = [{ type: 'pure-logic', runtimeRequired: false }]
  assert.equal(effectiveCoverageReview(deterministicMicro).ok, false)
  const verifiedContract = { ...sealed, autopilot: { implementation: { status: 'completed' }, delivery: { status: 'pending' } } }
  const afterCommit = { ...verifiedContract, autopilot: { ...verifiedContract.autopilot, delivery: { status: 'committed', commitSha: 'abc' }, lastCheckpointAt: '2026-09-08T00:00:00Z' } }
  assert.equal(verificationWorkItemFingerprint(verifiedContract), verificationWorkItemFingerprint(afterCommit))
  assert.notEqual(verificationWorkItemFingerprint(verifiedContract), verificationWorkItemFingerprint({ ...verifiedContract, requirements: [] }))
  console.log('vnext-work-item self-test passed')
}

if (process.argv[1]?.endsWith('vnext-work-item.mjs') && process.argv.includes('--self-test')) selfTest()
