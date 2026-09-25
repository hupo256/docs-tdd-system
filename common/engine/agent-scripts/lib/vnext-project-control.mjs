import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const PROJECT_ID_PATTERN = /^(?:PR|TR)-\d{5}$/
const SOURCE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/
const LEVELS = new Set(['V0', 'V1', 'V2'])
const ROUTES = new Set(['trivial', 'micro', 'lite', 'standard', 'high-risk'])
const TERMINAL_STATES = new Set(['pending', 'running', 'complete', 'passed', 'failed', 'blocked-system', 'unqualified'])
const ELIGIBILITY = new Set(['eligible', 'excluded', 'pending'])

function validateControl(control, collection) {
  if (!PROJECT_ID_PATTERN.test(control?.projectId || '')) throw new Error(`${collection} has an invalid projectId`)
  if (typeof control.sourceIdentity !== 'string' || !control.sourceIdentity.trim()) throw new Error(`${control.projectId} requires sourceIdentity`)
  if (typeof control.synthetic !== 'boolean') throw new Error(`${control.projectId} requires a boolean synthetic flag`)
  if (control.sourceFingerprint !== null && !SOURCE_FINGERPRINT_PATTERN.test(control.sourceFingerprint || '')) {
    throw new Error(`${control.projectId} sourceFingerprint must be a SHA-256 hex string or null`)
  }
  if (control.verificationLevel !== null && !LEVELS.has(control.verificationLevel)) throw new Error(`${control.projectId} has an invalid verificationLevel`)
  if (control.executionRoute !== null && !ROUTES.has(control.executionRoute)) throw new Error(`${control.projectId} has an invalid executionRoute`)
  if (!Array.isArray(control.observedExecutionRoutes) || control.observedExecutionRoutes.some((route) => !ROUTES.has(route))) {
    throw new Error(`${control.projectId} observedExecutionRoutes must contain known routes`)
  }
  if (typeof control.routeConflict !== 'boolean') throw new Error(`${control.projectId} requires a boolean routeConflict flag`)
  if (control.routeConflict && (control.executionRoute !== null || control.observedExecutionRoutes.length < 2)) {
    throw new Error(`${control.projectId} routeConflict requires an unresolved route and at least two observed routes`)
  }
  if (control.executionRoute && control.observedExecutionRoutes.length > 0 && !control.observedExecutionRoutes.includes(control.executionRoute)) {
    throw new Error(`${control.projectId} executionRoute must be among observedExecutionRoutes`)
  }
  if (control.pilotEligibility === 'eligible' && (control.synthetic || !control.sourceFingerprint || !control.verificationLevel)) {
    throw new Error(`${control.projectId} eligible Pilot sample requires a real source fingerprint and verification level`)
  }
  if (!TERMINAL_STATES.has(control.terminalState)) throw new Error(`${control.projectId} has an invalid terminalState`)
  if (typeof control.sampleDisposition !== 'string' || !control.sampleDisposition.trim()) throw new Error(`${control.projectId} requires sampleDisposition`)
  if (!ELIGIBILITY.has(control.pilotEligibility)) throw new Error(`${control.projectId} has an invalid pilotEligibility`)
  if (control.pilotEligibility === 'excluded' && (typeof control.exclusionReason !== 'string' || !control.exclusionReason.trim())) {
    throw new Error(`${control.projectId} exclusion requires an exclusionReason`)
  }
  if (control.pilotEligibility !== 'excluded' && control.exclusionReason !== null) {
    throw new Error(`${control.projectId} non-excluded disposition must set exclusionReason to null`)
  }
  const hold = control.executionHold
  if (!hold || typeof hold.active !== 'boolean') throw new Error(`${control.projectId} requires executionHold.active`)
  if (hold.active && (!hold.code || !hold.reason || !Number.isFinite(Date.parse(hold.setAt)))) {
    throw new Error(`${control.projectId} active execution hold requires code, reason, and setAt`)
  }
  if (hold.active && control.pilotEligibility === 'eligible') throw new Error(`${control.projectId} held project cannot be Pilot-eligible`)
  if (collection === 'projectDispositions' && control.pilotEligibility !== 'excluded') {
    throw new Error(`${control.projectId} projectDispositions entries must be excluded from Pilot`)
  }
  return control
}

export function validateProjectControlRegistry(registry) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.entries) || !Array.isArray(registry.projectDispositions)) {
    throw new Error('pilot registry requires schemaVersion 1, entries, and projectDispositions')
  }
  const ids = new Set()
  for (const [collection, controls] of [['entries', registry.entries], ['projectDispositions', registry.projectDispositions]]) {
    for (const control of controls) {
      validateControl(control, collection)
      if (ids.has(control.projectId)) throw new Error(`duplicate project control: ${control.projectId}`)
      ids.add(control.projectId)
    }
  }
  return registry
}

export function readProjectControlRegistry(file) {
  let registry
  try {
    registry = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`cannot read project control registry ${file}: ${error.message}`)
  }
  return validateProjectControlRegistry(registry)
}

export function findProjectControl(registry, projectId) {
  return registry.entries.find((entry) => entry.projectId === projectId)
    || registry.projectDispositions.find((entry) => entry.projectId === projectId)
    || null
}

export function summarizeProjectControl(control) {
  if (!control) {
    return {
      sourceIdentity: null,
      synthetic: null,
      sourceFingerprint: null,
      verificationLevel: null,
      executionRoute: null,
      observedExecutionRoutes: [],
      routeConflict: false,
      terminalState: 'pending',
      sampleDisposition: 'unregistered',
      pilotEligibility: 'pending',
      exclusionReason: null,
      executionHold: { active: false, code: null, reason: null, setAt: null },
    }
  }
  return {
    sourceIdentity: control.sourceIdentity,
    synthetic: control.synthetic,
    sourceFingerprint: control.sourceFingerprint,
    verificationLevel: control.verificationLevel,
    executionRoute: control.executionRoute,
    observedExecutionRoutes: control.observedExecutionRoutes,
    routeConflict: control.routeConflict,
    terminalState: control.terminalState,
    sampleDisposition: control.sampleDisposition,
    pilotEligibility: control.pilotEligibility,
    exclusionReason: control.exclusionReason,
    executionHold: control.executionHold,
  }
}

export function isProjectExecutionHeld(control) {
  return control?.executionHold?.active === true
}

export function selfTest() {
  const row = {
    projectId: 'PR-00001',
    sourceIdentity: 'fixture://requirement-1',
    synthetic: true,
    sourceFingerprint: 'a'.repeat(64),
    verificationLevel: 'V0',
    executionRoute: 'micro',
    observedExecutionRoutes: ['micro'],
    routeConflict: false,
    terminalState: 'running',
    sampleDisposition: 'synthetic-e2e',
    pilotEligibility: 'excluded',
    exclusionReason: 'Synthetic execution fixture.',
    executionHold: { active: true, code: 'synthetic-fixture', reason: 'Do not resume.', setAt: '2026-09-25T00:00:00.000Z' },
  }
  const registry = { schemaVersion: 1, entries: [], projectDispositions: [row] }
  assert.equal(findProjectControl(validateProjectControlRegistry(registry), row.projectId), row)
  assert.equal(isProjectExecutionHeld(row), true)
  assert.equal(summarizeProjectControl(row).pilotEligibility, 'excluded')
  assert.equal(summarizeProjectControl(null).executionHold.active, false)
  assert.equal(validateProjectControlRegistry({
    schemaVersion: 1,
    entries: [],
    projectDispositions: [{ ...row, projectId: 'TR-00001', executionRoute: 'trivial', observedExecutionRoutes: ['trivial'], routeConflict: false }],
  }).projectDispositions[0].executionRoute, 'trivial')
  assert.throws(() => validateProjectControlRegistry({ ...registry, projectDispositions: [{ ...row, projectId: '../unsafe' }] }), /invalid projectId/)
  assert.throws(() => validateProjectControlRegistry({ ...registry, projectDispositions: [{ ...row, sourceFingerprint: 'not-a-hash' }] }), /sourceFingerprint/)
  assert.throws(() => validateProjectControlRegistry({ ...registry, entries: [row] }), /duplicate project control/)
  assert.throws(() => validateProjectControlRegistry({ ...registry, projectDispositions: [{ ...row, executionHold: { active: true } }] }), /requires code, reason, and setAt/)
  console.log('vnext project control self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
