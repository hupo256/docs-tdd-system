#!/usr/bin/env node
// Deterministic v3.2 intake preflight. It rejects mechanically incomplete extraction before an
// independent model reviewer is invoked; semantic completeness remains the reviewer's job.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evidencePlanProblems } from '../vnext-evidence.mjs'
import { isStructuralSourceUnit } from './vnext-source-units.mjs'
import { vNextIntakeProblems } from './vnext-intake.mjs'
import { coverageFingerprints, stableFingerprint } from './vnext-work-item.mjs'

const EVIDENCE_TYPES = new Set(['copy-literal', 'component-dom', 'pure-logic', 'payload-contract', 'api-contract', 'browser-interaction', 'visual'])
const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

function requirementProblems(workItem, sourceUnits) {
  const problems = []
  const requirements = workItem?.requirements || []
  const sourceIds = new Set(sourceUnits.map((unit) => unit.sourceId))
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
    if (!Array.isArray(requirement?.evidencePlan) || !requirement.evidencePlan.length) problems.push(`${label} requires an evidencePlan`)
    for (const evidence of requirement?.evidencePlan || []) {
      if (!EVIDENCE_TYPES.has(evidence?.type) || typeof evidence?.runtimeRequired !== 'boolean') problems.push(`${label} has an invalid evidencePlan item`)
    }
  }

  const anchored = new Set(requirements.flatMap((requirement) => (requirement.sourceAnchors || []).map((anchor) => anchor.sourceId)))
  const dispositions = new Map((workItem?.sourceUnitDispositions || []).map((item) => [item.sourceId, item]))
  for (const unit of sourceUnits) {
    if (isStructuralSourceUnit(unit) || anchored.has(unit.sourceId)) continue
    const disposition = dispositions.get(unit.sourceId)
    if (disposition?.disposition !== 'not-a-requirement' || !disposition.reason?.trim()) {
      problems.push(`semantic source unit ${unit.sourceId} is neither anchored nor explicitly excluded`)
    }
  }
  for (const disposition of workItem?.sourceUnitDispositions || []) {
    if (!sourceIds.has(disposition.sourceId)) problems.push(`sourceUnitDisposition references unknown sourceId ${disposition.sourceId}`)
    if (disposition.disposition === 'not-a-requirement' && !disposition.reason?.trim()) problems.push(`${disposition.sourceId} exclusion requires a reason`)
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
  add('EVIDENCE_COMMANDS', evidencePlanProblems({ schemaVersion: 1, projectId: workItem.projectId, commands: workItem.evidenceCommands || [] }, workItem))
  const fingerprints = coverageFingerprints(workItem)
  const audit = {
    schemaVersion: 1,
    auditedAt,
    ...fingerprints,
    sourceUnitsFingerprint: stableFingerprint(sourceUnits),
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
  if (audit.sourceUnitsFingerprint !== current.sourceUnitsFingerprint) problems.push('extractionAudit source-unit fingerprint is stale')
  if (current.status !== 'pass') problems.push(...current.checks.flatMap((check) => check.problems))
  return [...new Set(problems)]
}

export function selfTest() {
  const units = [
    { sourceId: 'SRC-H', type: 'text', content: '# Scope' },
    { sourceId: 'SRC-1', type: 'text', content: 'Change A.' },
    { sourceId: 'SRC-2', type: 'table', tableRole: 'row', content: '| Entry | Value |\n| Web | A |' },
  ]
  const workItem = {
    workflowVersion: 2, projectId: 'PR-00001', sourceSnapshot: { revision: '1', contentHash: 'x', sources: [{ path: 'prd.md', contentHash: 'x' }] },
    requirements: [{ requirementId: 'R-001', sourceAnchors: [{ type: 'text', sourceId: 'SRC-1' }], statement: 'Change A.', status: 'doing', collectionSemantics: { kind: 'none', expectedCount: 0 }, affectedSurfaces: [{ surfaceId: 'S-001', locator: 'src/a.ts', disposition: 'implement' }], evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }] }],
    sourceUnitDispositions: [{ sourceId: 'SRC-2', disposition: 'not-a-requirement', reason: 'example only' }],
    evidenceCommands: [
      { evidenceId: 'E-1', kind: 'copy-literal', argv: ['node', 'scripts/check-copy.mjs'], requirementIds: ['R-001'], surfaceIds: ['S-001'] },
      { evidenceId: 'E-2', kind: 'touched-file-quality', argv: ['pnpm', 'exec', 'biome', 'check', 'apps/web/src/a.ts'] },
    ],
    routing: { verificationLevel: 'V0' },
  }
  const pass = runIntakeAudit(workItem, units, { auditedAt: '2026-09-12T00:00:00Z' })
  assert.equal(pass.status, 'pass', JSON.stringify(pass))
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
  const omittedRow = structuredClone(workItem)
  omittedRow.sourceUnitDispositions = []
  assert.match(problemsFor(omittedRow, 'EXTRACTION_STRUCTURE'), /SRC-2/)
  console.log('vnext-intake-audit self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
