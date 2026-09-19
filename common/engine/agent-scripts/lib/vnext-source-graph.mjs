#!/usr/bin/env node
// Deterministic source -> requirement -> surface/evidence graph and local invalidation.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { isStructuralSourceUnit } from './vnext-source-units.mjs'

const EXTENDED_SOURCE_TYPES = new Set([
  'text',
  'table',
  'image',
  'embed',
  'figma-node',
  'api-contract',
  'acceptance-row',
  'stakeholder-decision',
])

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort()

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

const stableFingerprint = (value) => createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')

function duplicates(values) {
  const seen = new Set()
  const duplicated = new Set()
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) duplicated.add(value)
    seen.add(value)
  }
  return [...duplicated].sort()
}

function semanticUnit(unit) {
  if (!unit?.sourceId || isStructuralSourceUnit(unit)) return false
  if (unit.disposition === 'not-a-requirement') return false
  return EXTENDED_SOURCE_TYPES.has(unit.type) || Boolean(unit.type)
}

function sourceIdsFor(requirement) {
  return uniqueSorted((requirement?.sourceAnchors || []).map((anchor) => anchor.sourceId))
}

function allSurfaces(workItem) {
  return (workItem?.requirements || []).flatMap((requirement) => (requirement.affectedSurfaces || []).map((surface) => ({
    ...surface,
    requirementId: requirement.requirementId,
  })))
}

function evidenceId(requirementId, evidence, index) {
  return evidence.evidenceId || `EP-${requirementId}-${String(index + 1).padStart(2, '0')}`
}

function conflictProblems(sourceUnits, requirements, surfaces) {
  const problems = []
  for (const [kind, values] of [
    ['source', sourceUnits.map((item) => item.sourceId)],
    ['requirement', requirements.map((item) => item.requirementId)],
    ['surface', surfaces.map((item) => item.surfaceId)],
  ]) {
    const ids = duplicates(values)
    if (ids.length) problems.push(`duplicate ${kind} IDs: ${ids.join(', ')}`)
  }
  const grouped = new Map()
  for (const unit of sourceUnits) {
    if (!unit?.sourceId) continue
    const fingerprints = grouped.get(unit.sourceId) || new Set()
    fingerprints.add(unit.contentHash || stableFingerprint({ type: unit.type, content: unit.content }))
    grouped.set(unit.sourceId, fingerprints)
  }
  for (const [sourceId, fingerprints] of grouped) {
    if (fingerprints.size > 1) problems.push(`conflicting source unit content for ${sourceId}`)
  }
  return problems
}

export function compileSourceGraph({ sourceUnits = [], workItem = {} } = {}) {
  const requirements = workItem.requirements || []
  const surfaces = allSurfaces(workItem)
  const sourceById = new Map(sourceUnits.map((unit) => [unit.sourceId, unit]))
  const dispositionById = new Map((workItem.sourceUnitDispositions || []).map((item) => [item.sourceId, item]))
  const requirementById = new Map(requirements.map((requirement) => [requirement.requirementId, requirement]))
  const surfaceById = new Map(surfaces.map((surface) => [surface.surfaceId, surface]))
  const problems = conflictProblems(sourceUnits, requirements, surfaces)
  const edges = []
  const evidence = []
  const mappedSourceIds = new Set()

  for (const requirement of requirements) {
    const sourceIds = sourceIdsFor(requirement)
    for (const sourceId of sourceIds) {
      mappedSourceIds.add(sourceId)
      edges.push({ type: 'source-requirement', from: sourceId, to: requirement.requirementId })
      if (!sourceById.has(sourceId)) problems.push(`${requirement.requirementId} references unknown source anchor ${sourceId}`)
    }
    for (const surface of requirement.affectedSurfaces || []) {
      edges.push({ type: 'requirement-surface', from: requirement.requirementId, to: surface.surfaceId })
      for (const blocker of surface.blockedBy || []) {
        edges.push({ type: 'surface-dependency', from: surface.surfaceId, to: blocker })
      }
    }
    for (const [index, plan] of (requirement.evidencePlan || []).entries()) {
      const id = evidenceId(requirement.requirementId, plan, index)
      evidence.push({
        evidenceId: id,
        requirementId: requirement.requirementId,
        kind: plan.type,
        runtimeRequired: plan.runtimeRequired === true,
      })
      edges.push({ type: 'requirement-evidence', from: requirement.requirementId, to: id })
    }
    const semantics = requirement.collectionSemantics
    if (semantics && semantics.kind !== 'none' && (requirement.affectedSurfaces || []).length !== semantics.expectedCount) {
      problems.push(`${requirement.requirementId} expectedCount=${semantics.expectedCount} but declares ${(requirement.affectedSurfaces || []).length} surfaces`)
    }
  }

  for (const unit of sourceUnits) {
    if (!semanticUnit(unit) || mappedSourceIds.has(unit.sourceId)) continue
    const disposition = dispositionById.get(unit.sourceId)
    if (disposition?.disposition !== 'not-a-requirement') problems.push(`semantic source unit ${unit.sourceId} is unattributed`)
  }
  for (const disposition of workItem.sourceUnitDispositions || []) {
    if (!sourceById.has(disposition.sourceId)) problems.push(`source disposition references unknown unit ${disposition.sourceId}`)
  }
  for (const unit of sourceUnits.filter((item) => item.type === 'acceptance-row')) {
    if (!mappedSourceIds.has(unit.sourceId)) problems.push(`acceptance row ${unit.sourceId} is not mapped to a requirement`)
  }
  for (const surface of surfaces.filter((item) => item.disposition === 'implement')) {
    const requirement = requirementById.get(surface.requirementId)
    if (!requirement || !sourceIdsFor(requirement).some((sourceId) => sourceById.has(sourceId))) {
      problems.push(`implement surface ${surface.surfaceId} has no source traceability`)
    }
  }

  const graph = {
    schemaVersion: 1,
    projectId: workItem.projectId || null,
    sourceFingerprint: stableFingerprint(sourceUnits.map((unit) => ({
      sourceId: unit.sourceId,
      type: unit.type,
      contentHash: unit.contentHash || stableFingerprint(unit.content || ''),
    }))),
    sourceUnitHashes: Object.fromEntries(sourceUnits.filter((unit) => unit.sourceId).map((unit) => [
      unit.sourceId,
      unit.contentHash || stableFingerprint({ type: unit.type, content: unit.content }),
    ]).sort(([a], [b]) => a.localeCompare(b))),
    nodes: {
      sources: sourceUnits.map((unit) => ({ sourceId: unit.sourceId, type: unit.type, path: unit.path || null })),
      requirements: requirements.map((requirement) => ({ requirementId: requirement.requirementId, status: requirement.status })),
      surfaces: surfaces.map((surface) => ({ surfaceId: surface.surfaceId, requirementId: surface.requirementId, disposition: surface.disposition })),
      evidence,
    },
    edges: edges.sort((a, b) => `${a.type}:${a.from}:${a.to}`.localeCompare(`${b.type}:${b.from}:${b.to}`)),
    problems: uniqueSorted(problems),
  }
  graph.ok = graph.problems.length === 0
  graph.graphFingerprint = stableFingerprint({ ...graph, graphFingerprint: undefined })
  return graph
}

export function sourceGraphDelta(previousGraph, currentGraph) {
  const previousHashes = previousGraph?.sourceUnitHashes || {}
  const currentHashes = currentGraph?.sourceUnitHashes || {}
  const changedSourceIds = uniqueSorted([
    ...Object.keys(previousHashes).filter((id) => currentHashes[id] !== previousHashes[id]),
    ...Object.keys(currentHashes).filter((id) => previousHashes[id] !== currentHashes[id]),
  ])
  const changed = new Set(changedSourceIds)
  const affectedRequirementIds = uniqueSorted(currentGraph?.edges
    ?.filter((edge) => edge.type === 'source-requirement' && changed.has(edge.from))
    .map((edge) => edge.to) || [])
  const affectedRequirements = new Set(affectedRequirementIds)
  const affectedSurfaceIds = uniqueSorted(currentGraph?.edges
    ?.filter((edge) => edge.type === 'requirement-surface' && affectedRequirements.has(edge.from))
    .map((edge) => edge.to) || [])
  const affectedEvidenceIds = uniqueSorted(currentGraph?.edges
    ?.filter((edge) => edge.type === 'requirement-evidence' && affectedRequirements.has(edge.from))
    .map((edge) => edge.to) || [])
  return {
    changedSourceIds,
    affectedRequirementIds,
    affectedSurfaceIds,
    affectedEvidenceIds,
    invalidationFingerprint: stableFingerprint({
      changedSourceIds,
      affectedRequirementIds,
      affectedSurfaceIds,
      affectedEvidenceIds,
    }),
  }
}

export function sourceGraphCheck(input) {
  const graph = compileSourceGraph(input)
  return { code: 'SOURCE_GRAPH', ok: graph.ok, problems: graph.problems, graph }
}

export function selfTest() {
  const sourceUnits = [
    { sourceId: 'SRC-1', type: 'text', content: 'Every entry opens the dialog.', contentHash: 'a' },
    { sourceId: 'SRC-2', type: 'acceptance-row', content: 'Click save updates state.', contentHash: 'b' },
  ]
  const workItem = {
    projectId: 'PR-00001',
    requirements: [{
      requirementId: 'R-001',
      status: 'doing',
      sourceAnchors: [{ sourceId: 'SRC-1' }, { sourceId: 'SRC-2' }],
      collectionSemantics: { kind: 'explicit-set', expectedCount: 1 },
      affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement' }],
      evidencePlan: [{ type: 'browser-interaction', runtimeRequired: true }],
    }],
  }
  const graph = compileSourceGraph({ sourceUnits, workItem })
  assert.equal(graph.ok, true, JSON.stringify(graph.problems))
  assert.deepEqual(graph.edges.map((edge) => edge.type), [
    'requirement-evidence',
    'requirement-surface',
    'source-requirement',
    'source-requirement',
  ])
  const changed = compileSourceGraph({
    sourceUnits: [{ ...sourceUnits[0], contentHash: 'changed' }, sourceUnits[1]],
    workItem,
  })
  assert.deepEqual(sourceGraphDelta(graph, changed), {
    changedSourceIds: ['SRC-1'],
    affectedRequirementIds: ['R-001'],
    affectedSurfaceIds: ['S-001'],
    affectedEvidenceIds: ['EP-R-001-01'],
    invalidationFingerprint: sourceGraphDelta(graph, changed).invalidationFingerprint,
  })
  const broken = compileSourceGraph({
    sourceUnits: [...sourceUnits, { sourceId: 'SRC-3', type: 'figma-node', content: 'unmapped' }],
    workItem: {
      ...workItem,
      requirements: [{
        ...workItem.requirements[0],
        collectionSemantics: { kind: 'explicit-set', expectedCount: 2 },
      }],
    },
  })
  assert.match(broken.problems.join(' '), /expectedCount=2/)
  assert.match(broken.problems.join(' '), /SRC-3 is unattributed/)
  console.log('vnext-source-graph self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
