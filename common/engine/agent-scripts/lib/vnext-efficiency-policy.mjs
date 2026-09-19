#!/usr/bin/env node
// Bounded execution policy for vNext. Routing is intentionally independent from
// verification level: V0/V1/V2 describes assurance, while this route controls cost.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { stableFingerprint } from './vnext-work-item.mjs'

export const EFFICIENCY_POLICY_VERSION = 1

export const EFFICIENCY_ROUTES = Object.freeze(['micro', 'lite', 'standard', 'high-risk'])

export const EFFICIENCY_POLICIES = Object.freeze({
  micro: Object.freeze({
    contextChars: 12000,
    ruleFiles: 3,
    reviewerRounds: 0,
    commands: 4,
    evidence: 2,
    repairs: 1,
    elapsedMs: 600000,
  }),
  lite: Object.freeze({
    contextChars: 24000,
    ruleFiles: 5,
    reviewerRounds: 1,
    commands: 6,
    evidence: 4,
    repairs: 2,
    elapsedMs: 1200000,
  }),
  standard: Object.freeze({
    contextChars: 80000,
    ruleFiles: 8,
    reviewerRounds: 2,
    commands: 10,
    evidence: 8,
    repairs: 3,
    elapsedMs: 2700000,
  }),
  'high-risk': Object.freeze({
    contextChars: 160000,
    ruleFiles: 12,
    reviewerRounds: 2,
    commands: 16,
    evidence: 12,
    repairs: 4,
    elapsedMs: 5400000,
  }),
})

const ROUTE_ORDER = Object.freeze({ micro: 0, lite: 1, standard: 2, 'high-risk': 3 })
const HIGH_RISK_WORDS = /\b(password|permission|funds?|trading|delete|deletion|irreversible|login|authentication|auth|money|amount|withdraw|transfer)\b/i
const COLLECTION_WORDS = /\b(all|every|each|any|全部|每个|所有|每种|各个)\b/i
const RICH_SOURCE_TYPES = new Set(['table', 'table-row', 'table-cell', 'image', 'image-spec', 'figma', 'api', 'acceptance'])

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function requirementText(requirement) {
  return [
    requirement?.statement,
    requirement?.acceptanceCriteria,
    requirement?.notes,
    requirement?.collectionSemantics?.kind,
  ].filter(Boolean).join(' ')
}

function allRequirementText(workItem) {
  return asArray(workItem?.requirements).map(requirementText).join(' ')
}

function implementSurfaces(workItem) {
  return asArray(workItem?.requirements).flatMap((requirement) => asArray(requirement?.affectedSurfaces)
    .filter((surface) => surface?.disposition === 'implement')
    .map((surface) => ({ ...surface, requirementId: requirement.requirementId })))
}

function hasApiDependency(workItem) {
  const mode = workItem?.apiDependency?.mode
  return mode && !['no-request', 'not-required'].includes(mode)
}

function hasCollectionSemantics(workItem) {
  return asArray(workItem?.requirements).some((requirement) => {
    const collection = requirement?.collectionSemantics
    return collection && collection.kind && collection.kind !== 'none'
      || COLLECTION_WORDS.test(requirementText(requirement))
  })
}

function routeReason(route, code, detail) {
  return { route, code, detail }
}

function highestRoute(routes) {
  return routes.reduce((current, candidate) => ROUTE_ORDER[candidate] > ROUTE_ORDER[current] ? candidate : current, 'micro')
}

export function deriveEfficiencyRoute(workItem = {}) {
  const requirements = asArray(workItem.requirements)
  const surfaces = implementSurfaces(workItem)
  const sourceUnits = asArray(workItem.sourceSnapshot?.units).concat(asArray(workItem.sourceUnits))
  const riskSignals = asArray(workItem.routing?.riskSignals)
  const text = allRequirementText(workItem)
  const reasons = []
  const candidates = ['micro']

  const explicitHighRisk = riskSignals.some((signal) => HIGH_RISK_WORDS.test(signal))
    || HIGH_RISK_WORDS.test(text)
  if (explicitHighRisk) {
    candidates.push('high-risk')
    reasons.push(routeReason('high-risk', 'high-risk-semantics', 'login/password/permission/funds/irreversible semantics detected'))
  }
  if (riskSignals.some((signal) => ['funds', 'trading', 'permission', 'irreversible', 'new-api', 'cross-app'].includes(signal))) {
    candidates.push('high-risk')
    reasons.push(routeReason('high-risk', 'risk-signal', 'existing V2 risk signal requires the high-risk execution budget'))
  }
  if (workItem.routing?.scopeClass === 'cross-boundary' || riskSignals.includes('cross-app')) {
    candidates.push('high-risk')
    reasons.push(routeReason('high-risk', 'cross-boundary', 'cross-boundary work cannot use a short route'))
  }
  if (hasCollectionSemantics(workItem)) {
    candidates.push('standard')
    reasons.push(routeReason('standard', 'collection-semantics', 'collection language requires complete-set reconciliation'))
  }
  if (surfaces.length > 1) {
    candidates.push('standard')
    reasons.push(routeReason('standard', 'multiple-surfaces', `${surfaces.length} implementation surfaces require surface reconciliation`))
  }
  if (hasApiDependency(workItem) || asArray(workItem.apiContracts).length || riskSignals.includes('new-api')) {
    candidates.push('standard')
    reasons.push(routeReason('standard', 'api-or-contract', 'API, schema, mock, or contract work requires broader checks'))
  }
  if (sourceUnits.some((unit) => RICH_SOURCE_TYPES.has(unit?.type))
    || asArray(workItem.sourceSnapshot?.assets).length
    || asArray(workItem.sourceSnapshot?.revisions).length > 1) {
    candidates.push('standard')
    reasons.push(routeReason('standard', 'rich-source', 'table, image, Figma, acceptance, or multiple source revisions require coverage compilation'))
  }
  if (asArray(workItem.runtimeEvidence).length || asArray(workItem.browserScenarios).length) {
    candidates.push('standard')
    reasons.push(routeReason('standard', 'runtime-evidence', 'runtime or browser evidence is required'))
  }
  if (requirements.length > 1 || workItem.routing?.scopeClass === 'multi-surface') {
    candidates.push('lite')
    reasons.push(routeReason('lite', 'non-trivial-scope', 'more than one requirement or a multi-surface scope is not micro'))
  }

  const isMicroShape = requirements.length === 1
    && surfaces.length === 1
    && workItem.routing?.scopeClass === 'local'
    && riskSignals.length === 0
    && !hasApiDependency(workItem)
    && !hasCollectionSemantics(workItem)
    && sourceUnits.every((unit) => !RICH_SOURCE_TYPES.has(unit?.type))
    && !asArray(workItem.sourceSnapshot?.assets).length
    && !asArray(workItem.runtimeEvidence).length
    && !asArray(workItem.browserScenarios).length
  if (!isMicroShape) {
    candidates.push('lite')
    reasons.push(routeReason('lite', 'micro-preconditions', 'micro requires one local symbol-level change with no rich source or runtime dependency'))
  }

  if (!reasons.length) reasons.push(routeReason('micro', 'micro-shape', 'single local symbol-level change with no escalation signal'))
  const route = highestRoute(candidates)
  return {
    policyVersion: EFFICIENCY_POLICY_VERSION,
    route,
    policy: EFFICIENCY_POLICIES[route],
    reasons: reasons.filter((reason) => ROUTE_ORDER[reason.route] <= ROUTE_ORDER[route]),
    signals: {
      requirementCount: requirements.length,
      implementSurfaceCount: surfaces.length,
      sourceUnitCount: sourceUnits.length,
      riskSignals: [...riskSignals],
      hasApiDependency: Boolean(hasApiDependency(workItem)),
      hasCollectionSemantics: hasCollectionSemantics(workItem),
    },
  }
}

export function upgradeEfficiencyRoute(currentRoute, reason, detail = '') {
  if (!EFFICIENCY_ROUTES.includes(currentRoute)) throw new Error(`unknown efficiency route: ${currentRoute || 'missing'}`)
  const minimumRoute = reason?.route || 'standard'
  if (!EFFICIENCY_ROUTES.includes(minimumRoute)) throw new Error(`unknown upgrade route: ${minimumRoute}`)
  const route = ROUTE_ORDER[minimumRoute] > ROUTE_ORDER[currentRoute] ? minimumRoute : currentRoute
  return {
    route,
    policyVersion: EFFICIENCY_POLICY_VERSION,
    policy: EFFICIENCY_POLICIES[route],
    reason: routeReason(route, reason?.code || 'automatic-upgrade', detail || reason?.detail || 'execution signal requires a broader route'),
  }
}

function emptyUsage() {
  return {
    contextChars: 0,
    ruleFiles: 0,
    reviewerRounds: 0,
    commands: 0,
    evidence: 0,
    repairs: 0,
  }
}

export function createEfficiencyBudget(routeOrDecision, {
  startedAt = new Date().toISOString(),
  inputFingerprint = '',
  deadlineAt = null,
} = {}) {
  const decision = typeof routeOrDecision === 'string'
    ? { route: routeOrDecision, policy: EFFICIENCY_POLICIES[routeOrDecision], reasons: [] }
    : routeOrDecision
  if (!EFFICIENCY_ROUTES.includes(decision?.route)) throw new Error(`unknown efficiency route: ${decision?.route || 'missing'}`)
  const policy = decision.policy || EFFICIENCY_POLICIES[decision.route]
  const startedMs = Date.parse(startedAt)
  const resolvedDeadline = deadlineAt || (Number.isFinite(startedMs) ? new Date(startedMs + policy.elapsedMs).toISOString() : null)
  return {
    policyVersion: EFFICIENCY_POLICY_VERSION,
    route: decision.route,
    policy: { ...policy },
    usage: emptyUsage(),
    startedAt,
    deadlineAt: resolvedDeadline,
    inputFingerprint: inputFingerprint || null,
    status: 'active',
    warningAt: 0.8,
    terminalReason: null,
    lastFailureFingerprint: null,
  }
}

export function budgetStatus(budget, now = Date.now()) {
  if (!budget) return { status: 'missing', exhausted: true, warnings: ['efficiency budget is missing'] }
  const dimensions = Object.keys(budget.policy || {})
  const ratios = dimensions.map((dimension) => ({
    dimension,
    used: Number(budget.usage?.[dimension]) || 0,
    limit: Number(budget.policy?.[dimension]) || 0,
  })).map((item) => ({ ...item, ratio: item.limit > 0 ? item.used / item.limit : 0 }))
  const exhaustedDimensions = ratios.filter((item) => item.ratio >= 1).map((item) => item.dimension)
  const warningDimensions = ratios.filter((item) => item.ratio >= 0.8 && item.ratio < 1).map((item) => item.dimension)
  const deadlineMs = Date.parse(budget.deadlineAt || '')
  const deadlineExceeded = Number.isFinite(deadlineMs) && now >= deadlineMs
  const exhausted = exhaustedDimensions.length > 0 || deadlineExceeded || ['budget-exhausted', 'blocked', 'failed-infrastructure', 'complete'].includes(budget.status)
  return {
    status: exhausted ? (budget.status === 'active' ? 'budget-exhausted' : budget.status) : warningDimensions.length ? 'warning' : 'ok',
    exhausted,
    warning: warningDimensions.length > 0,
    warningDimensions,
    exhaustedDimensions,
    deadlineExceeded,
    ratios,
  }
}

export function consumeEfficiencyBudget(budget, dimension, amount = 1, { now = Date.now() } = {}) {
  if (!budget || !Object.hasOwn(budget.policy || {}, dimension)) throw new Error(`unknown efficiency budget dimension: ${dimension}`)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('budget amount must be a non-negative number')
  const next = structuredClone(budget)
  next.usage[dimension] = (Number(next.usage[dimension]) || 0) + amount
  const status = budgetStatus(next, now)
  if (status.exhausted) {
    next.status = 'budget-exhausted'
    next.terminalReason = status.deadlineExceeded ? 'deadline-exceeded' : `budget-exhausted:${status.exhaustedDimensions.join(',')}`
  }
  return { budget: next, ...status }
}

export function markEfficiencyTerminal(budget, status, reason) {
  if (!['complete', 'blocked', 'failed-infrastructure', 'budget-exhausted'].includes(status)) {
    throw new Error(`invalid efficiency terminal status: ${status}`)
  }
  return { ...structuredClone(budget), status, terminalReason: reason || status }
}

export function canRetryEfficiencyFailure({ inputFingerprint, failureFingerprint, previous = null } = {}) {
  if (!inputFingerprint || !failureFingerprint) return { retryable: true, reason: 'fingerprints-incomplete' }
  if (previous?.inputFingerprint === inputFingerprint && previous?.failureFingerprint === failureFingerprint) {
    return { retryable: false, reason: 'same-input-and-failure' }
  }
  return { retryable: true, reason: 'new-failure-or-input' }
}

export function efficiencyFailureRecord({ input, failure, domain = 'unknown', attempt = 0 } = {}) {
  const inputFingerprint = typeof input === 'string' ? input : stableFingerprint(input || null)
  const failureFingerprint = typeof failure === 'string' ? failure : stableFingerprint(failure || null)
  return {
    domain,
    attempt,
    inputFingerprint,
    failureFingerprint,
    retry: canRetryEfficiencyFailure({ inputFingerprint, failureFingerprint }),
  }
}

export function efficiencyMetrics({
  route = null,
  routeReasons = [],
  budget = null,
  actionCount = 0,
  commandCount = 0,
  reviewRounds = 0,
  evidenceCount = 0,
  repairAttempts = 0,
  elapsedMs = null,
  userInterruptCount = 0,
  necessaryInterruptCount = 0,
  silentOmissionCount = 0,
  falseCompletionCount = 0,
  terminalState = null,
} = {}) {
  return {
    route,
    routeReasons: routeReasons.map((reason) => reason?.code || reason).filter(Boolean),
    contextChars: budget?.usage?.contextChars ?? null,
    estimatedInputTokens: null,
    ruleFiles: budget?.usage?.ruleFiles ?? null,
    sourceUnits: null,
    actionCount,
    commandCount,
    reviewRounds,
    evidenceCount,
    repairAttempts,
    elapsedMs,
    userInterruptCount,
    necessaryInterruptCount,
    silentOmissionCount,
    falseCompletionCount,
    terminalState,
  }
}

export function selfTest() {
  const micro = deriveEfficiencyRoute({
    routing: { scopeClass: 'local', riskSignals: [] },
    requirements: [{ requirementId: 'R-1', status: 'doing', statement: 'Change one label.', affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement', codeLocator: 'src/a.ts:label' }] }],
    apiDependency: { mode: 'no-request' },
  })
  assert.equal(micro.route, 'micro')
  assert.equal(micro.policy.commands, 4)

  const standard = deriveEfficiencyRoute({
    routing: { scopeClass: 'multi-surface', riskSignals: [] },
    requirements: [{ requirementId: 'R-1', statement: 'Update every entry.', collectionSemantics: { kind: 'explicit-set', expectedCount: 2 }, affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement' }, { surfaceId: 'S-2', disposition: 'implement' }] }],
  })
  assert.equal(standard.route, 'standard')
  assert.ok(standard.reasons.some((reason) => reason.code === 'collection-semantics'))

  const highRisk = deriveEfficiencyRoute({
    routing: { scopeClass: 'local', riskSignals: ['permission'] },
    requirements: [{ requirementId: 'R-1', statement: 'Allow password reset.', affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement' }] }],
  })
  assert.equal(highRisk.route, 'high-risk')

  const budget = createEfficiencyBudget(micro, { startedAt: '2026-09-19T00:00:00.000Z', inputFingerprint: 'input' })
  const warning = consumeEfficiencyBudget(budget, 'commands', 4)
  assert.equal(warning.status, 'budget-exhausted')
  assert.equal(warning.budget.status, 'budget-exhausted')
  assert.equal(canRetryEfficiencyFailure({ inputFingerprint: 'a', failureFingerprint: 'b', previous: { inputFingerprint: 'a', failureFingerprint: 'b' } }).retryable, false)
  assert.equal(efficiencyMetrics({ route: 'micro', budget }).estimatedInputTokens, null)
  console.log('vnext-efficiency-policy self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
