#!/usr/bin/env node
// Pure scope × risk routing for docs_tdd vNext. Risk can raise a level but never lower it.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { coverageFingerprints, stableFingerprint } from './vnext-work-item.mjs'

export const ROUTER_VERSION = 1
export const LEVEL_ORDER = Object.freeze({ V0: 0, V1: 1, V2: 2 })
export const SCOPE_FLOOR = Object.freeze({ local: 'V0', 'multi-surface': 'V1', 'cross-boundary': 'V2' })
export const RISK_FLOOR = Object.freeze({
  password: 'V1',
  'authentication-surface': 'V1',
  'multiple-entry-points': 'V1',
  'shared-component': 'V1',
  'contract-change': 'V1',
  funds: 'V2',
  trading: 'V2',
  permission: 'V2',
  irreversible: 'V2',
  'new-api': 'V2',
  'cross-app': 'V2',
  'fee-semantics': 'V2',
  'amount-semantics': 'V2',
})

export const VERIFICATION_MATRIX = Object.freeze({
  V0: Object.freeze(['source-fresh', 'requirement-coverage', 'touched-file-quality', 'current-head-evidence']),
  V1: Object.freeze(['source-fresh', 'requirement-coverage', 'surface-coverage', 'directed-tests', 'prd-to-diff-review', 'current-head-evidence']),
  V2: Object.freeze(['source-fresh', 'requirement-coverage', 'surface-coverage', 'human-scope-approval', 'contract-or-scenario-tests', 'directed-quality', 'current-head-evidence']),
})

function highestLevel(levels) {
  return levels.reduce((highest, level) => LEVEL_ORDER[level] > LEVEL_ORDER[highest] ? level : highest, 'V0')
}

export function deriveRiskRoute({ scopeClass, riskSignals = [], minimumLevel = 'V0' } = {}) {
  const problems = []
  if (!(scopeClass in SCOPE_FLOOR)) problems.push(`unknown scopeClass: ${scopeClass || 'missing'}`)
  if (!(minimumLevel in LEVEL_ORDER)) problems.push(`unknown minimumLevel: ${minimumLevel || 'missing'}`)
  const rawSignals = Array.isArray(riskSignals) ? riskSignals : []
  if (!Array.isArray(riskSignals)) problems.push('riskSignals must be an array')
  const duplicatedSignals = rawSignals.filter((signal, index) => rawSignals.indexOf(signal) !== index)
  if (duplicatedSignals.length) problems.push(`duplicate risk signals: ${[...new Set(duplicatedSignals)].join(', ')}`)
  const signals = [...new Set(rawSignals)].sort()
  const unknownRiskSignals = signals.filter((signal) => !(signal in RISK_FLOOR))
  if (unknownRiskSignals.length) problems.push(`unknown risk signals require classification: ${unknownRiskSignals.join(', ')}`)

  const candidates = [
    SCOPE_FLOOR[scopeClass] || 'V2',
    minimumLevel in LEVEL_ORDER ? minimumLevel : 'V2',
    Array.isArray(riskSignals) ? 'V0' : 'V2',
    ...signals.map((signal) => RISK_FLOOR[signal] || 'V2'),
  ]
  const verificationLevel = highestLevel(candidates)
  return {
    ok: problems.length === 0,
    routing: { scopeClass, riskSignals: signals, verificationLevel, routerVersion: ROUTER_VERSION },
    verificationPlan: VERIFICATION_MATRIX[verificationLevel],
    reasons: candidates.filter((level, index) => candidates.indexOf(level) === index),
    problems,
  }
}

export function scopeApprovalFingerprint(workItem, routing = workItem?.routing) {
  const fingerprints = coverageFingerprints(workItem)
  return stableFingerprint({
    projectId: workItem?.projectId,
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    routing,
    apiDependency: workItem?.apiDependency || null,
  })
}

export function createScopeApproval(workItem, { confirmedBy, confirmedAt } = {}) {
  const route = deriveRiskRoute(workItem?.routing)
  if (!route.ok || route.routing.verificationLevel !== 'V2') throw new Error('scope approval is only valid for a valid V2 route')
  if (!confirmedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(confirmedAt || '')) throw new Error('V2 scope approval requires a human confirmer and YYYY-MM-DD date')
  return {
    confirmationKind: 'human',
    confirmedBy,
    confirmedAt,
    fingerprint: scopeApprovalFingerprint(workItem, route.routing),
  }
}

export function verifyVNextRouting(workItem) {
  const route = deriveRiskRoute(workItem?.routing || {})
  const routeProblems = [...route.problems]
  if (workItem?.routing?.routerVersion !== ROUTER_VERSION) routeProblems.push(`routerVersion must be ${ROUTER_VERSION}`)
  if (workItem?.routing?.verificationLevel !== route.routing.verificationLevel) {
    routeProblems.push(`verificationLevel must be ${route.routing.verificationLevel}, got ${workItem?.routing?.verificationLevel || 'missing'}`)
  }

  const approvalProblems = []
  if (route.routing.verificationLevel === 'V2') {
    const approval = workItem?.scopeApproval
    if (!approval) approvalProblems.push('V2 requires scope approval')
    else {
      if (approval.confirmationKind !== 'human') approvalProblems.push('V2 scope approval must be human')
      if (!approval.confirmedBy?.trim()) approvalProblems.push('V2 scope approval has no confirmer')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(approval.confirmedAt || '')) approvalProblems.push('V2 scope approval has no valid date')
      const expected = scopeApprovalFingerprint(workItem, route.routing)
      if (approval.fingerprint !== expected) approvalProblems.push('V2 scope approval fingerprint is stale')
    }
  }

  const checks = [
    { code: 'RISK_ROUTE', ok: routeProblems.length === 0, problems: routeProblems },
    { code: 'SCOPE_APPROVAL', ok: approvalProblems.length === 0, problems: approvalProblems },
  ]
  return { ok: checks.every((check) => check.ok), routing: route.routing, verificationPlan: route.verificationPlan, checks }
}

export function selfTest() {
  assert.equal(deriveRiskRoute({ scopeClass: 'local' }).routing.verificationLevel, 'V0')
  assert.equal(deriveRiskRoute({ scopeClass: 'multi-surface', riskSignals: ['password'] }).routing.verificationLevel, 'V1')
  assert.equal(deriveRiskRoute({ scopeClass: 'local', riskSignals: ['authentication-surface'] }).routing.verificationLevel, 'V1')
  assert.equal(deriveRiskRoute({ scopeClass: 'local', riskSignals: ['funds'] }).routing.verificationLevel, 'V2')
  assert.equal(deriveRiskRoute({ scopeClass: 'cross-boundary' }).routing.verificationLevel, 'V2')
  assert.equal(deriveRiskRoute({ scopeClass: 'local', minimumLevel: 'V1' }).routing.verificationLevel, 'V1')
  const unknown = deriveRiskRoute({ scopeClass: 'local', riskSignals: ['mystery-risk'] })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.routing.verificationLevel, 'V2')
  assert.equal(deriveRiskRoute({ scopeClass: 'local', riskSignals: ['password', 'password'] }).ok, false)
  assert.equal(deriveRiskRoute({ scopeClass: 'local', riskSignals: 'funds' }).routing.verificationLevel, 'V2')

  const workItem = {
    projectId: 'PR-00001',
    sourceSnapshot: { revision: '1', contentHash: 'a', sources: [{ path: 'prd.md', contentHash: 'a' }] },
    requirements: [{ requirementId: 'R-001' }],
    routing: deriveRiskRoute({ scopeClass: 'local', riskSignals: ['funds'] }).routing,
    scopeApproval: null,
  }
  assert.equal(verifyVNextRouting(workItem).checks.find((check) => check.code === 'SCOPE_APPROVAL').ok, false)
  workItem.scopeApproval = createScopeApproval(workItem, { confirmedBy: 'owner@example.com', confirmedAt: '2026-09-04' })
  assert.equal(verifyVNextRouting(workItem).ok, true)
  workItem.requirements.push({ requirementId: 'R-002' })
  assert.equal(verifyVNextRouting(workItem).checks.find((check) => check.code === 'SCOPE_APPROVAL').ok, false)
  workItem.requirements.pop()
  workItem.scopeApproval = createScopeApproval(workItem, { confirmedBy: 'owner@example.com', confirmedAt: '2026-09-04' })
  workItem.apiDependency = { mode: 'real-api', reason: 'existing API' }
  assert.equal(verifyVNextRouting(workItem).checks.find((check) => check.code === 'SCOPE_APPROVAL').ok, false)
  console.log('vnext-risk-route self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
