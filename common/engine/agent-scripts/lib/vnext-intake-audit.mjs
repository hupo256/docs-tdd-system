#!/usr/bin/env node
// Deterministic v3.2 intake preflight. It rejects mechanically incomplete extraction before an
// independent model reviewer is invoked; semantic completeness remains the reviewer's job.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidencePlanProblems } from '../vnext-evidence.mjs'
import { sourceUnitDispositionProblems } from './vnext-source-disposition.mjs'
import { isStructuralSourceUnit } from './vnext-source-units.mjs'
import { vNextIntakeProblems } from './vnext-intake.mjs'
import { coverageFingerprints, evaluateMicroEligibility, stableFingerprint } from './vnext-work-item.mjs'

const EVIDENCE_TYPES = new Set([
  'copy-literal',
  'component-dom',
  'pure-logic',
  'payload-contract',
  'api-contract',
  'browser-interaction',
  'human-check',
  'structural',
  'quality',
  'touched-file-quality',
  'visual',
])
const FACT_CATEGORIES = new Set(['action', 'content', 'state', 'constraint', 'dependency', 'permission', 'navigation', 'error', 'collection', 'entry', 'visual'])
const SURFACE_DISPOSITIONS = new Set(['implement', 'already-covered', 'not-applicable', 'deferred'])
const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

function requirementProblems(workItem, sourceUnits) {
  const problems = []
  const requirements = workItem?.requirements || []
  const sourceIds = new Set(sourceUnits.map((unit) => unit.sourceId))
  const sourceById = new Map(sourceUnits.map((unit) => [unit.sourceId, unit]))
  const requirementIds = requirements.map((item) => item.requirementId).filter(Boolean)
  const duplicates = duplicateValues(requirementIds)
  if (!requirements.length) problems.push('no requirements were extracted')
  if (duplicates.length) problems.push(`duplicate requirement IDs: ${duplicates.join(', ')}`)

  for (const [index, requirement] of requirements.entries()) {
    const label = requirement?.requirementId || `requirement[${index}]`
    if (!/^R-\d{3}$/.test(requirement?.requirementId || '')) problems.push(`${label} requires a stable R-NNN ID`)
    if (!requirement?.statement?.trim()) problems.push(`${label} requires an atomic statement`)
    if (!Array.isArray(requirement?.sourceAnchors) || !requirement.sourceAnchors.length) problems.push(`${label} requires at least one source anchor`)
    for (const anchor of requirement?.sourceAnchors || []) {
      if (!sourceIds.has(anchor.sourceId)) problems.push(`${label} references unknown sourceId ${anchor.sourceId || '(missing)'}`)
    }
    const semantics = requirement?.collectionSemantics
    if (!semantics || !['none', 'explicit-set', 'discovered-set'].includes(semantics.kind) || !Number.isInteger(semantics.expectedCount) || semantics.expectedCount < 0) {
      problems.push(`${label} requires valid collectionSemantics`)
    } else if (semantics.kind === 'none' && semantics.expectedCount !== 0) {
      problems.push(`${label} collection kind none requires expectedCount=0`)
    } else if (semantics.kind !== 'none' && (requirement.affectedSurfaces || []).length !== semantics.expectedCount) {
      problems.push(`${label} expected ${semantics.expectedCount} affected surfaces but declares ${(requirement.affectedSurfaces || []).length}`)
    }
    const surfaces = requirement?.affectedSurfaces || []
    if (requirement?.status === 'doing' && !surfaces.length) problems.push(`${label} requires at least one affected surface`)
    for (const [surfaceIndex, surface] of surfaces.entries()) {
      const surfaceLabel = surface?.surfaceId || `${label}.affectedSurfaces[${surfaceIndex}]`
      const hasLocator = Boolean(surface?.locator?.trim() || surface?.codeLocator)
      if (!/^S-\d{3}$/.test(surface?.surfaceId || '') || !hasLocator || !SURFACE_DISPOSITIONS.has(surface?.disposition)) {
        problems.push(`${surfaceLabel} requires a valid ID, locator/codeLocator, and disposition`)
      }
      if (surface?.codeLocator) {
        const locator = surface.codeLocator
        if (!locator.kind || !locator.app?.trim() || !locator.symbol?.trim() || !['provider', 'consumer', 'standalone'].includes(locator.role)) {
          problems.push(`${surfaceLabel} has an invalid codeLocator`)
        }
        if (workItem.deliveryTarget?.app && locator.app !== workItem.deliveryTarget.app) {
          problems.push(`${surfaceLabel} codeLocator app ${locator.app} differs from deliveryTarget ${workItem.deliveryTarget.app}`)
        }
        if (locator.role === 'consumer' && (!surface.wiring || surface.wiring.role !== 'consumer' || !(surface.wiring.dependsOn || []).length)) {
          problems.push(`${surfaceLabel} consumer requires wiring.dependsOn`)
        }
      }
    }
    if (!Array.isArray(requirement?.evidencePlan) || !requirement.evidencePlan.length) problems.push(`${label} requires an evidencePlan`)
    for (const evidence of requirement?.evidencePlan || []) {
      if (!EVIDENCE_TYPES.has(evidence?.type) || typeof evidence?.runtimeRequired !== 'boolean') problems.push(`${label} has an invalid evidencePlan item`)
    }
  }

  const allSurfaces = requirements.flatMap((requirement) => requirement.affectedSurfaces || [])
  if (allSurfaces.some((surface) => surface.codeLocator) && !workItem.deliveryTarget?.app) {
    problems.push('structured codeLocator surfaces require deliveryTarget.app')
  }
  const surfaceIds = allSurfaces.map((surface) => surface.surfaceId).filter(Boolean)
  const duplicateSurfaces = duplicateValues(surfaceIds)
  if (duplicateSurfaces.length) problems.push(`duplicate surface IDs: ${duplicateSurfaces.join(', ')}`)
  const surfaceById = new Map(allSurfaces.map((surface) => [surface.surfaceId, surface]))
  for (const surface of allSurfaces.filter((item) => item.codeLocator?.role === 'consumer')) {
    for (const providerId of surface.wiring?.dependsOn || []) {
      const provider = surfaceById.get(providerId)
      if (!provider) problems.push(`${surface.surfaceId} depends on unknown provider surface ${providerId}`)
      else if (provider.codeLocator?.role !== 'provider') problems.push(`${surface.surfaceId} dependency ${providerId} is not a provider`)
    }
  }

  const anchored = new Set(requirements.flatMap((requirement) => (requirement.sourceAnchors || []).map((anchor) => anchor.sourceId)))
  const sourceUnitDispositions = workItem?.sourceUnitDispositions || []
  const duplicateDispositions = duplicateValues(sourceUnitDispositions.map((item) => item.sourceId).filter(Boolean))
  if (duplicateDispositions.length) problems.push(`duplicate source-unit dispositions: ${duplicateDispositions.join(', ')}`)
  const dispositions = new Map(sourceUnitDispositions.map((item) => [item.sourceId, item]))
  for (const unit of sourceUnits) {
    if (isStructuralSourceUnit(unit) || anchored.has(unit.sourceId)) continue
    const disposition = dispositions.get(unit.sourceId)
    if (disposition?.disposition !== 'not-a-requirement' || !disposition.reason?.trim()) {
      problems.push(`semantic source unit ${unit.sourceId} is neither anchored nor explicitly excluded`)
    }
  }
  for (const disposition of sourceUnitDispositions) {
    if (!sourceIds.has(disposition.sourceId)) problems.push(`sourceUnitDisposition references unknown sourceId ${disposition.sourceId}`)
    problems.push(...sourceUnitDispositionProblems(disposition, sourceById.get(disposition.sourceId)))
  }
  return problems
}

function traceabilityProblems(workItem, sourceUnits) {
  const problems = []
  const facts = workItem?.extractionFacts || []
  const sourceIds = new Set(sourceUnits.map((unit) => unit.sourceId))
  const requirementById = new Map((workItem?.requirements || []).map((item) => [item.requirementId, item]))
  const dispositions = new Map((workItem?.sourceUnitDispositions || []).map((item) => [item.sourceId, item]))
  if (!facts.length) return ['three-stage extraction requires a non-empty extractionFacts inventory']
  const duplicateFactIds = duplicateValues(facts.map((fact) => fact.factId).filter(Boolean))
  if (duplicateFactIds.length) problems.push(`duplicate fact IDs: ${duplicateFactIds.join(', ')}`)
  const linkedRequirements = new Set()
  const coveredSources = new Set()
  for (const [index, fact] of facts.entries()) {
    const label = fact?.factId || `extractionFacts[${index}]`
    if (!/^F-\d{3}$/.test(fact?.factId || '')) problems.push(`${label} requires a stable F-NNN ID`)
    if (!FACT_CATEGORIES.has(fact?.category)) problems.push(`${label} requires a valid category`)
    if (!fact?.statement?.trim()) problems.push(`${label} requires a factual statement`)
    if (!Array.isArray(fact?.sourceIds) || !fact.sourceIds.length) problems.push(`${label} requires sourceIds`)
    if (!Array.isArray(fact?.requirementIds) || !fact.requirementIds.length) problems.push(`${label} requires requirementIds`)
    for (const sourceId of fact?.sourceIds || []) {
      if (!sourceIds.has(sourceId)) problems.push(`${label} references unknown sourceId ${sourceId}`)
      coveredSources.add(sourceId)
    }
    for (const requirementId of fact?.requirementIds || []) {
      const requirement = requirementById.get(requirementId)
      if (!requirement) {
        problems.push(`${label} references unknown requirementId ${requirementId}`)
        continue
      }
      linkedRequirements.add(requirementId)
      const anchors = new Set((requirement.sourceAnchors || []).map((anchor) => anchor.sourceId))
      if (!(fact.sourceIds || []).some((sourceId) => anchors.has(sourceId))) problems.push(`${label} and ${requirementId} have no shared source anchor`)
    }
  }
  for (const unit of sourceUnits) {
    if (isStructuralSourceUnit(unit) || coveredSources.has(unit.sourceId) || dispositions.get(unit.sourceId)?.disposition === 'not-a-requirement') continue
    problems.push(`semantic source unit ${unit.sourceId} is missing from extractionFacts and has no exclusion`)
  }
  for (const requirement of workItem?.requirements || []) {
    if (!linkedRequirements.has(requirement.requirementId)) problems.push(`${requirement.requirementId} is not derived from any extraction fact`)
  }
  return problems
}

export function runIntakeAudit(workItem, sourceUnits, { auditedAt = new Date().toISOString() } = {}) {
  if (!workItem?.projectId || workItem.workflowVersion !== 2) throw new Error('intake audit requires a workflowVersion=2 work item')
  if (!Array.isArray(sourceUnits) || !sourceUnits.length) throw new Error('intake audit requires normalized source units')
  const checks = []
  const add = (code, problems) => checks.push({ code, ok: problems.length === 0, problems })
  add('INTAKE_SOURCE_BINDING', vNextIntakeProblems(workItem))
  add('EXTRACTION_STRUCTURE', requirementProblems(workItem, sourceUnits))
  add('EXTRACTION_TRACEABILITY', traceabilityProblems(workItem, sourceUnits))
  add('EVIDENCE_COMMANDS', evidencePlanProblems({ schemaVersion: 1, projectId: workItem.projectId, commands: workItem.evidenceCommands || [] }, workItem))
  const fingerprints = coverageFingerprints(workItem)
  const audit = {
    schemaVersion: 1,
    auditedAt,
    ...fingerprints,
    sourceUnitsFingerprint: stableFingerprint(sourceUnits),
    microEligibility: evaluateMicroEligibility(workItem, sourceUnits),
    status: checks.every((check) => check.ok) ? 'pass' : 'fail',
    checks,
  }
  return audit
}

export function intakeAuditProblems(workItem, sourceUnits) {
  const audit = workItem?.extractionAudit
  if (!audit) return ['extractionAudit is missing; run docs-tdd extract <PROJECT-ID> --input <extraction.json>']
  const current = runIntakeAudit(workItem, sourceUnits, { auditedAt: audit.auditedAt })
  const problems = []
  if (audit.status !== 'pass') problems.push('extractionAudit status is not pass')
  if (audit.sourceFingerprint !== current.sourceFingerprint) problems.push('extractionAudit source fingerprint is stale')
  if (audit.requirementsFingerprint !== current.requirementsFingerprint) problems.push('extractionAudit requirements fingerprint is stale')
  if (audit.evidencePlanFingerprint !== current.evidencePlanFingerprint) problems.push('extractionAudit evidence-plan fingerprint is stale')
  if (audit.sourceUnitsFingerprint !== current.sourceUnitsFingerprint) problems.push('extractionAudit source-unit fingerprint is stale')
  if (current.status !== 'pass') problems.push(...current.checks.flatMap((check) => check.problems))
  return [...new Set(problems)]
}

export function selfTest() {
  const units = [
    { sourceId: 'SRC-H', type: 'text', content: '# Scope' },
    { sourceId: 'SRC-1', type: 'text', content: 'Change A.' },
    { sourceId: 'SRC-2', type: 'table', tableRole: 'row', content: '| Entry | Value |\n| Web | A |' },
    { sourceId: 'SRC-3', type: 'text', content: 'Background: this screenshot is context only.' },
  ]
  const workItem = {
    workflowVersion: 2, projectId: 'PR-00001', sourceSnapshot: { revision: '1', contentHash: 'x', sources: [{ path: 'prd.md', contentHash: 'x' }] },
    extractionFacts: [
      { factId: 'F-001', category: 'action', statement: 'Change A.', sourceIds: ['SRC-1'], requirementIds: ['R-001'] },
      { factId: 'F-002', category: 'content', statement: 'The table row is an example.', sourceIds: ['SRC-2'], requirementIds: ['R-001'] },
    ],
    requirements: [{ requirementId: 'R-001', sourceAnchors: [{ type: 'text', sourceId: 'SRC-1' }, { type: 'table', sourceId: 'SRC-2' }], statement: 'Change A.', status: 'doing', collectionSemantics: { kind: 'none', expectedCount: 0 }, affectedSurfaces: [{ surfaceId: 'S-001', locator: 'src/a.ts', disposition: 'implement' }], evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }] }],
    sourceUnitDispositions: [{
      sourceId: 'SRC-3',
      disposition: 'not-a-requirement',
      reason: 'context only',
      exclusionEvidence: { basis: 'context-only', sourceQuote: 'this screenshot is context only' },
    }],
    evidenceCommands: [
      { evidenceId: 'E-1', kind: 'copy-literal', argv: ['node', 'scripts/check-copy.mjs'], requirementIds: ['R-001'], surfaceIds: ['S-001'] },
      { evidenceId: 'E-2', kind: 'touched-file-quality', argv: ['pnpm', 'exec', 'biome', 'check', 'apps/web/src/a.ts'] },
    ],
    routing: { verificationLevel: 'V0' },
  }
  const pass = runIntakeAudit(workItem, units, { auditedAt: '2026-09-12T00:00:00Z' })
  assert.equal(pass.status, 'pass', JSON.stringify(pass))
  assert.equal(pass.microEligibility.ok, false)
  assert.match(pass.microEligibility.problems.join(' '), /table, image, or embedded/)
  const staleIntake = {
    ...workItem,
    intake: { kind: 'bugfix', sourceRole: 'incident', sourceFingerprint: 'stale', sourcePaths: ['prd.md'] },
  }
  const problemsFor = (item, code) => runIntakeAudit(item, units).checks.find((check) => check.code === code)?.problems.join(' ') || ''
  assert.match(problemsFor(staleIntake, 'INTAKE_SOURCE_BINDING'), /stale/)
  assert.deepEqual(intakeAuditProblems({ ...workItem, extractionAudit: pass }, units), [])
  const duplicate = structuredClone(workItem)
  duplicate.requirements.push(structuredClone(duplicate.requirements[0]))
  assert.match(problemsFor(duplicate, 'EXTRACTION_STRUCTURE'), /duplicate requirement IDs/)
  const missingFact = structuredClone(workItem)
  missingFact.extractionFacts = missingFact.extractionFacts.filter((fact) => fact.factId !== 'F-002')
  assert.match(problemsFor(missingFact, 'EXTRACTION_TRACEABILITY'), /SRC-2/)
  const duplicateSurface = structuredClone(workItem)
  duplicateSurface.requirements.push({ ...structuredClone(duplicateSurface.requirements[0]), requirementId: 'R-002' })
  assert.match(problemsFor(duplicateSurface, 'EXTRACTION_STRUCTURE'), /duplicate surface IDs/)
  const incompleteExclusion = structuredClone(workItem)
  delete incompleteExclusion.sourceUnitDispositions[0].exclusionEvidence
  assert.match(problemsFor(incompleteExclusion, 'EXTRACTION_STRUCTURE'), /exclusion requires evidence/)
  const touchedQuality = structuredClone(workItem)
  touchedQuality.requirements[0].evidencePlan = [{ type: 'touched-file-quality', runtimeRequired: false }]
  touchedQuality.evidenceCommands = [{
    evidenceId: 'E-QUALITY',
    kind: 'touched-file-quality',
    argv: ['node', 'tests/a.test.mjs'],
    requirementIds: ['R-001'],
    surfaceIds: ['S-001'],
  }]
  assert.equal(problemsFor(touchedQuality, 'EXTRACTION_STRUCTURE'), '')
  const mixedFeatureUnits = [...units, { sourceId: 'SRC-4', type: 'text', content: 'The data appears automatically, and add an export button on the same page.' }]
  const mixedFeature = structuredClone(workItem)
  mixedFeature.sourceUnitDispositions.push({
    sourceId: 'SRC-4',
    disposition: 'not-a-requirement',
    reason: 'automatic display',
    exclusionEvidence: { basis: 'context-only', sourceQuote: 'The data appears automatically' },
  })
  assert.match(
    runIntakeAudit(mixedFeature, mixedFeatureUnits).checks.find((check) => check.code === 'EXTRACTION_STRUCTURE').problems.join(' '),
    /mixes passive-display/,
  )
  const simpleUnits = units.filter((unit) => ['SRC-H', 'SRC-1'].includes(unit.sourceId))
  const simple = structuredClone(workItem)
  simple.extractionFacts = simple.extractionFacts.filter((fact) => fact.factId === 'F-001')
  simple.requirements[0].sourceAnchors = simple.requirements[0].sourceAnchors.filter((anchor) => anchor.sourceId === 'SRC-1')
  simple.sourceUnitDispositions = []
  simple.routing = { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0', routerVersion: 1 }
  simple.apiDependency = { mode: 'no-request', reason: 'local copy change' }
  const simpleAudit = runIntakeAudit(simple, simpleUnits)
  assert.equal(simpleAudit.status, 'pass', JSON.stringify(simpleAudit))
  assert.deepEqual(simpleAudit.microEligibility, {
    ok: true,
    mode: 'deterministic-micro-audit',
    ...coverageFingerprints(simple),
    sourceUnitsFingerprint: stableFingerprint(simpleUnits),
    problems: [],
  })
  console.log('vnext-intake-audit self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
