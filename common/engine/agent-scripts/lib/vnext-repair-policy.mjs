#!/usr/bin/env node
// Bounded repair policy shared by source, scope, code, browser, environment, and dependency failures.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { stableFingerprint } from './vnext-work-item.mjs'

export const REPAIR_DOMAINS = Object.freeze([
  'source',
  'scope',
  'code',
  'browser',
  'environment',
  'external-dependency',
])

export const REPAIR_POLICY = Object.freeze({
  source: Object.freeze({
    budget: 1,
    terminalState: 'blocked-user-decision',
    recoveryAction: 'blocked-user-decision',
    recoveryCommand: 'docs-tdd source-sync <PROJECT-ID>',
  }),
  scope: Object.freeze({
    budget: 2,
    terminalState: 'blocked-user-decision',
    recoveryAction: 'blocked-user-decision',
    recoveryCommand: 'docs-tdd extract <PROJECT-ID> --out <extraction.json>',
  }),
  code: Object.freeze({
    budget: 2,
    terminalState: 'escalate-repair-failure',
    recoveryAction: 'escalate-repair-failure',
    recoveryCommand: 'docs-tdd dev-check <PROJECT-ID>',
  }),
  browser: Object.freeze({
    budget: 2,
    terminalState: 'escalate-repair-failure',
    recoveryAction: 'escalate-repair-failure',
    recoveryCommand: 'docs-tdd manual-test <PROJECT-ID> --out <manual-test.json>',
  }),
  environment: Object.freeze({
    budget: 1,
    terminalState: 'failed-infrastructure',
    recoveryAction: 'failed-infrastructure',
    recoveryCommand: 'docs-tdd doctor <PROJECT-ID>',
  }),
  'external-dependency': Object.freeze({
    budget: 0,
    terminalState: 'blocked-external-dependency',
    recoveryAction: 'blocked-external-dependency',
    recoveryCommand: 'docs-tdd source-update <PROJECT-ID> --input <source-update.json>',
  }),
})

const emptyAttempts = () => Object.fromEntries(REPAIR_DOMAINS.map((domain) => [domain, 0]))

export function initialRepairState() {
  return {
    attempts: emptyAttempts(),
    lastFailure: null,
    terminalState: null,
  }
}

export function normalizeRepairState(value, legacyAttempts = {}) {
  const base = initialRepairState()
  const attempts = value?.attempts || legacyAttempts
  for (const domain of REPAIR_DOMAINS) {
    const count = attempts?.[domain]
    base.attempts[domain] = Number.isInteger(count) && count >= 0 ? count : 0
  }
  if (value?.lastFailure) base.lastFailure = structuredClone(value.lastFailure)
  if (value?.terminalState) base.terminalState = value.terminalState
  return base
}

export function repairFailureFingerprint({ failureDomains = [], checks = [], blockedBy = [] } = {}) {
  return stableFingerprint({
    failureDomains: [...new Set(failureDomains)].sort(),
    failedChecks: checks
      .filter((check) => check?.ok === false)
      .map((check) => ({ code: check.code, problems: [...new Set(check.problems || [])].sort() }))
      .sort((left, right) => String(left.code).localeCompare(String(right.code))),
    blockedBy: [...new Set(blockedBy)].sort(),
  })
}

export function repairInputFingerprint({ workItem, latestResult } = {}) {
  const stableWorkItem = structuredClone(workItem || {})
  if (stableWorkItem.autopilot) {
    delete stableWorkItem.autopilot.repair
    delete stableWorkItem.autopilot.repairAttempts
    delete stableWorkItem.autopilot.lastCheckpointAt
    delete stableWorkItem.autopilot.checkpointCommit
    delete stableWorkItem.autopilot.implementation?.checkpoint
    delete stableWorkItem.autopilot.implementation?.completedAt
    delete stableWorkItem.autopilot.delivery?.committedAt
  }
  return stableFingerprint({
    workItem: stableWorkItem,
    codeState: {
      contentHash: latestResult?.codeFingerprint?.contentHash || '',
      scopeMode: latestResult?.codeFingerprint?.scopeMode || '',
      scopePaths: latestResult?.codeFingerprint?.scopePaths || [],
    },
  })
}

function validateDomains(domains) {
  const unique = [...new Set(domains || [])]
  const invalid = unique.filter((domain) => !REPAIR_DOMAINS.includes(domain))
  if (invalid.length) throw new Error(`unknown repair domain(s): ${invalid.join(', ')}`)
  return unique.sort()
}

export function evaluateRepairPolicy({
  repairState,
  legacyAttempts,
  failureDomains,
  inputFingerprint,
  failureFingerprint,
} = {}) {
  const state = normalizeRepairState(repairState, legacyAttempts)
  const domains = validateDomains(failureDomains)
  if (!domains.length) throw new Error('repair policy requires at least one failure domain')
  const unchangedFailure = state.lastFailure?.inputFingerprint === inputFingerprint
    && state.lastFailure?.failureFingerprint === failureFingerprint
  const exhaustedDomains = domains.filter((domain) => state.attempts[domain] >= REPAIR_POLICY[domain].budget)
  const terminalDomains = exhaustedDomains.length ? exhaustedDomains : unchangedFailure ? domains : []
  const primaryDomain = terminalDomains[0] || null
  const terminalStates = [...new Set(terminalDomains.map((domain) => REPAIR_POLICY[domain].terminalState))]
  return {
    allowed: !unchangedFailure && exhaustedDomains.length === 0,
    unchangedFailure,
    domains,
    exhaustedDomains,
    terminalState: terminalStates[0] || null,
    terminalStates,
    recoveryAction: primaryDomain ? REPAIR_POLICY[primaryDomain].recoveryAction : null,
    recoveryCommand: primaryDomain ? REPAIR_POLICY[primaryDomain].recoveryCommand : null,
    budgets: Object.fromEntries(domains.map((domain) => [domain, REPAIR_POLICY[domain].budget])),
    attempts: Object.fromEntries(domains.map((domain) => [domain, state.attempts[domain]])),
  }
}

export function recordRepairAttempt(repairState, {
  failureDomains,
  inputFingerprint,
  failureFingerprint,
  generatedAt = new Date().toISOString(),
} = {}) {
  const state = normalizeRepairState(repairState)
  const decision = evaluateRepairPolicy({
    repairState: state,
    failureDomains,
    inputFingerprint,
    failureFingerprint,
  })
  if (!decision.allowed) {
    const reason = decision.unchangedFailure
      ? 'unchanged input/failure fingerprint cannot be retried'
      : `repair budget exhausted for: ${decision.exhaustedDomains.join(', ')}`
    throw new Error(reason)
  }
  for (const domain of decision.domains) state.attempts[domain] += 1
  state.lastFailure = {
    domains: decision.domains,
    inputFingerprint,
    failureFingerprint,
    recordedAt: generatedAt,
  }
  const terminalDomain = decision.domains.find((domain) => state.attempts[domain] >= REPAIR_POLICY[domain].budget)
  state.terminalState = terminalDomain ? REPAIR_POLICY[terminalDomain].terminalState : null
  return state
}

export function resetRepairDomains(repairState, domains = REPAIR_DOMAINS) {
  const state = normalizeRepairState(repairState)
  for (const domain of validateDomains(domains)) state.attempts[domain] = 0
  state.lastFailure = null
  state.terminalState = null
  return state
}

export function selfTest() {
  const state = initialRepairState()
  const inputFingerprint = 'input-1'
  const failureFingerprint = 'failure-1'
  assert.equal(evaluateRepairPolicy({ repairState: state, failureDomains: ['code'], inputFingerprint, failureFingerprint }).allowed, true)
  const once = recordRepairAttempt(state, { failureDomains: ['code'], inputFingerprint, failureFingerprint })
  assert.equal(once.attempts.code, 1)
  const unchanged = evaluateRepairPolicy({ repairState: once, failureDomains: ['code'], inputFingerprint, failureFingerprint })
  assert.equal(unchanged.unchangedFailure, true)
  assert.equal(unchanged.terminalState, 'escalate-repair-failure')
  assert.equal(unchanged.recoveryCommand, 'docs-tdd dev-check <PROJECT-ID>')
  const twice = recordRepairAttempt(once, { failureDomains: ['code'], inputFingerprint: 'input-2', failureFingerprint })
  assert.equal(twice.terminalState, 'escalate-repair-failure')
  const exhausted = evaluateRepairPolicy({ repairState: twice, failureDomains: ['code'], inputFingerprint: 'input-3', failureFingerprint })
  assert.equal(exhausted.allowed, false)
  assert.equal(exhausted.terminalState, 'escalate-repair-failure')
  const external = evaluateRepairPolicy({ repairState: state, failureDomains: ['external-dependency'], inputFingerprint, failureFingerprint })
  assert.equal(external.allowed, false)
  assert.equal(external.terminalState, 'blocked-external-dependency')
  assert.equal(external.recoveryCommand, 'docs-tdd source-update <PROJECT-ID> --input <source-update.json>')
  const fingerprintWorkItem = {
    projectId: 'PR-00001',
    autopilot: {
      repair: once,
      lastCheckpointAt: '2026-09-19T00:00:00Z',
      implementation: {
        status: 'completed',
        changedPaths: ['src/x.ts'],
        checkpoint: { actionId: 'implement', outcome: 'completed', recordedAt: '2026-09-19T00:00:00Z' },
      },
    },
  }
  assert.equal(
    repairInputFingerprint({ workItem: fingerprintWorkItem }),
    repairInputFingerprint({
      workItem: {
        ...fingerprintWorkItem,
        autopilot: {
          ...fingerprintWorkItem.autopilot,
          repair: twice,
          lastCheckpointAt: '2026-09-19T01:00:00Z',
          implementation: {
            ...fingerprintWorkItem.autopilot.implementation,
            checkpoint: { actionId: 'repair', outcome: 'completed', recordedAt: '2026-09-19T01:00:00Z' },
            completedAt: '2026-09-19T01:00:00Z',
          },
        },
      },
    }),
  )
  assert.equal(resetRepairDomains(twice, ['code']).attempts.code, 0)
  console.log('vnext-repair-policy self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
