#!/usr/bin/env node
// Late-bound Figma/API readiness. Missing optional sources never block PRD-first implementation,
// but required sources must be available and reconciled before the final ready-to-test exit.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LATE_SOURCE_KINDS = Object.freeze(['figma', 'api'])
export const SOURCE_REQUIREMENTS = Object.freeze(['unknown', 'required', 'not-required'])
export const SOURCE_STATUSES = Object.freeze(['pending', 'available', 'integrated', 'not-required'])

export function initialSourceReadiness() {
  return {
    figma: { requirement: 'unknown', status: 'pending', reason: 'not classified from PRD yet' },
    api: { requirement: 'unknown', status: 'pending', reason: 'not classified from PRD yet' },
  }
}

function normalizedEntry(workItem, kind) {
  const entry = workItem?.sourceReadiness?.[kind]
  // Backward compatibility: work items created before source readiness remain governed by their
  // existing apiDependency and do not become retroactively blocked.
  if (!entry) return { requirement: 'not-required', status: 'not-required', reason: 'legacy work item' }
  return entry
}

export function evaluateSourceReadiness(workItem) {
  const unknownKinds = []
  const pendingRequiredKinds = []
  const reconciliationKinds = []
  const problems = []

  for (const kind of LATE_SOURCE_KINDS) {
    const entry = normalizedEntry(workItem, kind)
    if (!SOURCE_REQUIREMENTS.includes(entry.requirement) || !SOURCE_STATUSES.includes(entry.status) || !entry.reason?.trim()) {
      problems.push(`${kind} source readiness requires a valid requirement, status, and reason`)
      continue
    }
    if (entry.requirement === 'unknown') unknownKinds.push(kind)
    if (entry.requirement === 'not-required' && entry.status !== 'not-required') problems.push(`${kind} not-required must use status=not-required`)
    if (entry.requirement === 'required' && entry.status === 'not-required') problems.push(`${kind} required cannot use status=not-required`)
    if (entry.requirement === 'required' && entry.status === 'pending') pendingRequiredKinds.push(kind)
    if (entry.status === 'available') {
      if (!entry.source?.fingerprint) problems.push(`${kind} available requires a measured source fingerprint`)
      else if (entry.integratedFingerprint !== entry.source.fingerprint) reconciliationKinds.push(kind)
    }
    if (entry.status === 'integrated') {
      if (!entry.source?.fingerprint || entry.integratedFingerprint !== entry.source.fingerprint) {
        problems.push(`${kind} integrated status requires matching source and integrated fingerprints`)
      }
    }
  }

  for (const kind of unknownKinds) problems.push(`${kind} requirement is still unknown`)
  for (const kind of pendingRequiredKinds) problems.push(`${kind} is required but still pending`)
  for (const kind of reconciliationKinds) problems.push(`${kind} source is available but has not been reconciled`)
  return {
    code: 'SOURCE_READINESS',
    ok: problems.length === 0,
    problems,
    unknownKinds,
    pendingRequiredKinds,
    reconciliationKinds,
    implementationCanProceed: true,
    readyToTest: problems.length === 0,
  }
}

export function applySourceUpdate(workItem, update, { fingerprint = '', storedPath = '', generatedAt = new Date().toISOString() } = {}) {
  if (!LATE_SOURCE_KINDS.includes(update?.kind)) throw new Error('source update kind must be figma or api')
  if (!SOURCE_REQUIREMENTS.includes(update.requirement)) throw new Error('source update requires requirement=unknown|required|not-required')
  if (!SOURCE_STATUSES.includes(update.status)) throw new Error('source update has an invalid status')
  if (!update.reason?.trim()) throw new Error('source update requires a reason')
  if (update.requirement === 'not-required' && update.status !== 'not-required') throw new Error('not-required source must use status=not-required')
  if (update.requirement === 'required' && update.status === 'not-required') throw new Error('required source cannot use status=not-required')
  if (['available', 'integrated'].includes(update.status) && (!fingerprint || !storedPath)) throw new Error(`${update.status} source update requires CLI-measured source content`)

  const previous = normalizedEntry(workItem, update.kind)
  const next = structuredClone(workItem)
  const source = fingerprint ? { path: storedPath, revision: update.revision || fingerprint.slice(0, 12), fingerprint } : undefined
  const sameIntegratedSource = source && previous.integratedFingerprint === source.fingerprint
  next.sourceReadiness = {
    ...(next.sourceReadiness || initialSourceReadiness()),
    [update.kind]: {
      requirement: update.requirement,
      status: update.status === 'integrated' && !sameIntegratedSource ? 'available' : update.status,
      reason: update.reason,
      updatedAt: generatedAt,
      ...(source ? { source } : {}),
      ...(sameIntegratedSource ? { integratedFingerprint: source.fingerprint, integratedAt: previous.integratedAt } : {}),
    },
  }
  if (source && !sameIntegratedSource) {
    const risks = new Set(next.routing?.riskSignals || [])
    risks.add('unclassified')
    next.routing = { ...next.routing, riskSignals: [...risks] }
    if (update.kind === 'api') {
      next.apiDependency = { ...next.apiDependency, mode: 'real-api', reason: 'available API contract is authoritative and pending code reconciliation' }
    }
  }
  return next
}

export function reconcileAvailableSources(workItem, kinds, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(kinds) || !kinds.length) throw new Error('source reconciliation requires at least one source kind')
  const next = structuredClone(workItem)
  next.sourceReadiness = { ...(next.sourceReadiness || {}) }
  for (const kind of [...new Set(kinds)]) {
    if (!LATE_SOURCE_KINDS.includes(kind)) throw new Error(`unsupported source kind: ${kind}`)
    const entry = next.sourceReadiness[kind]
    if (entry?.status !== 'available' || !entry.source?.fingerprint) throw new Error(`${kind} source is not available for reconciliation`)
    next.sourceReadiness[kind] = {
      ...entry,
      status: 'integrated',
      integratedFingerprint: entry.source.fingerprint,
      integratedAt: generatedAt,
    }
    if (kind === 'api' && next.apiDependency?.mode !== 'real-api') {
      next.apiDependency = { ...next.apiDependency, mode: 'real-api', reason: 'available API contract reconciled into implementation' }
    }
  }
  return next
}

export function selfTest() {
  const base = { routing: { riskSignals: [] }, sourceReadiness: initialSourceReadiness() }
  const unknown = evaluateSourceReadiness(base)
  assert.deepEqual(unknown.unknownKinds, ['figma', 'api'])
  assert.equal(unknown.implementationCanProceed, true)

  const classified = structuredClone(base)
  classified.sourceReadiness.figma = { requirement: 'not-required', status: 'not-required', reason: 'no visual change' }
  classified.sourceReadiness.api = { requirement: 'required', status: 'pending', reason: 'contract pending; use approved mock scenarios' }
  assert.deepEqual(evaluateSourceReadiness(classified).pendingRequiredKinds, ['api'])

  const available = applySourceUpdate(classified, {
    kind: 'api', requirement: 'required', status: 'available', reason: 'contract arrived', revision: 'v1',
  }, { fingerprint: 'api-hash', storedPath: 'inbox/api.md', generatedAt: '2026-09-08T00:00:00Z' })
  assert.deepEqual(evaluateSourceReadiness(available).reconciliationKinds, ['api'])
  assert.ok(available.routing.riskSignals.includes('unclassified'))

  const routed = structuredClone(available)
  routed.routing.riskSignals = ['new-api']
  const integrated = reconcileAvailableSources(routed, ['api'], '2026-09-08T00:01:00Z')
  assert.equal(evaluateSourceReadiness(integrated).ok, true)
  assert.equal(integrated.apiDependency.mode, 'real-api')
  assert.equal(evaluateSourceReadiness({}).ok, true)
  console.log('vnext-source-readiness self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
