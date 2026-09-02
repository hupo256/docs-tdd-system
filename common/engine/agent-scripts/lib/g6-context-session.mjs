#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveProjectRoot } from './roots.mjs'

export const G6_CONTEXT_SCENARIOS = ['g6_code_review', 'g6_contract', 'g6_visual', 'g6_delivery']
const MAX_AGE_MS = 24 * 60 * 60 * 1000

// headSha/dirtyHash bind the four review dimensions to the exact code snapshot under review
// (that binding is the point of review freshness). The rule dimension is the project's PINNED
// policy fingerprint, not docs_tdd's global-latest — a shared-repo rule edit must not retroactively
// invalidate an in-flight G6 review.
const bindingKeys = ['projectId', 'client', 'sessionId', 'headSha', 'dirtyHash', 'rulePolicyFingerprint']

export const sameG6ContextBinding = (session, current, now = Date.now()) => {
  const updatedAt = Date.parse(session?.updatedAt)
  const dimensions = Object.values(session?.dimensions || {})
  const dimensionsFresh = dimensions.every((dimension) => {
    const generatedAt = Date.parse(dimension?.generatedAt)
    return Number.isFinite(generatedAt) && now - generatedAt <= MAX_AGE_MS
  })
  return Boolean(
    session?.version === 1
      && Number.isFinite(updatedAt)
      && now - updatedAt <= MAX_AGE_MS
      && dimensionsFresh
      && bindingKeys.every((key) => (session[key] ?? null) === (current[key] ?? null)),
  )
}

export function validateG6ContextSession({ session, current, now = Date.now() }) {
  const errors = []
  if (!session || session.version !== 1) return { ok: false, errors: ['missing or invalid G6 context session'], missing: [...G6_CONTEXT_SCENARIOS] }
  for (const key of bindingKeys) {
    if ((session[key] ?? null) !== (current[key] ?? null)) errors.push(`${key} changed`)
  }
  const updatedAt = Date.parse(session.updatedAt)
  if (!Number.isFinite(updatedAt) || now - updatedAt > MAX_AGE_MS) errors.push('G6 context session expired')
  const dimensions = session.dimensions && typeof session.dimensions === 'object' ? session.dimensions : {}
  const missing = G6_CONTEXT_SCENARIOS.filter((scenario) => !dimensions[scenario]?.fingerprint)
  if (missing.length) errors.push(`missing dimensions: ${missing.join(', ')}`)
  const expired = G6_CONTEXT_SCENARIOS.filter((scenario) => {
    if (!dimensions[scenario]?.fingerprint) return false
    const generatedAt = Date.parse(dimensions[scenario].generatedAt)
    return !Number.isFinite(generatedAt) || now - generatedAt > MAX_AGE_MS
  })
  if (expired.length) errors.push(`expired dimensions: ${expired.join(', ')}`)
  return { ok: errors.length === 0, errors, missing }
}

function sessionFile(projectId) {
  return join(resolveProjectRoot(projectId), 'agent/g6-context-session.json')
}

export function loadG6ContextSession(projectId) {
  const file = sessionFile(projectId)
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

export function recordG6Context({ current, scenario, pack, now = new Date().toISOString() }) {
  if (!G6_CONTEXT_SCENARIOS.includes(scenario)) return null
  const file = sessionFile(current.projectId)
  const previous = loadG6ContextSession(current.projectId)
  const sameBinding = sameG6ContextBinding(previous, current)
  const dimensions = sameBinding ? { ...previous.dimensions } : {}
  dimensions[scenario] = { fingerprint: pack.fingerprint, mode: pack.mode, generatedAt: now }
  const session = { version: 1, ...current, dimensions, updatedAt: now }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(session, null, 2)}\n`)
  return session
}

export function requireG6ContextSession(current) {
  const result = validateG6ContextSession({ session: loadG6ContextSession(current.projectId), current })
  if (result.ok) return true
  console.error(`[VERIFY-RULE-005] G6 context session is missing or stale: ${result.errors.join('; ')}`)
  console.error(`run the four context dimensions for ${current.projectId}: ${G6_CONTEXT_SCENARIOS.join(' -> ')}`)
  return false
}

export function printG6ContextPlan(projectId, session) {
  const completed = new Set(Object.keys(session?.dimensions || {}))
  console.log(`G6 context plan for ${projectId}:`)
  for (const scenario of G6_CONTEXT_SCENARIOS) {
    console.log(`  ${completed.has(scenario) ? '✓' : '○'} node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context ${projectId} ${scenario}`)
  }
  console.log('After all four dimensions are current, run the G6 gate.')
}

export function nextG6ContextScenario(session) {
  const completed = new Set(Object.keys(session?.dimensions || {}))
  return G6_CONTEXT_SCENARIOS.find((scenario) => !completed.has(scenario)) || null
}

function selfTest() {
  const current = { projectId: 'PR-00001', client: 'codex', sessionId: 'thread-1', headSha: 'head', dirtyHash: 'dirty', rulePolicyFingerprint: 'pol' }
  const dimensions = Object.fromEntries(G6_CONTEXT_SCENARIOS.map((scenario) => [scenario, { fingerprint: scenario, generatedAt: '2026-01-01T00:00:00.000Z' }]))
  const session = { version: 1, ...current, dimensions, updatedAt: '2026-01-01T00:00:00.000Z' }
  const now = Date.parse('2026-01-01T01:00:00.000Z')
  assert.equal(validateG6ContextSession({ session, current, now }).ok, true)
  assert.deepEqual(validateG6ContextSession({ session: { ...session, dimensions: {} }, current, now }).missing, G6_CONTEXT_SCENARIOS)
  assert.ok(validateG6ContextSession({ session, current: { ...current, sessionId: 'thread-2' }, now }).errors.includes('sessionId changed'))
  assert.ok(validateG6ContextSession({ session, current: { ...current, dirtyHash: 'changed' }, now }).errors.includes('dirtyHash changed'))
  assert.equal(sameG6ContextBinding(session, current, now), true)
  assert.equal(sameG6ContextBinding(session, current, Date.parse('2026-01-03T00:00:00.000Z')), false)
  assert.equal(sameG6ContextBinding(session, { ...current, headSha: 'changed' }, now), false)
  const staleDimension = { ...session, updatedAt: '2026-01-03T00:00:00.000Z', dimensions: { ...dimensions, g6_code_review: { fingerprint: 'old', generatedAt: '2026-01-01T00:00:00.000Z' } } }
  const staleNow = Date.parse('2026-01-03T01:00:00.000Z')
  assert.ok(validateG6ContextSession({ session: staleDimension, current, now: staleNow }).errors.some((error) => error.includes('expired dimensions: g6_code_review')))
  assert.equal(sameG6ContextBinding(staleDimension, current, staleNow), false)
  assert.equal(nextG6ContextScenario({ dimensions: { g6_code_review: {} } }), 'g6_contract')
  assert.equal(nextG6ContextScenario({ dimensions }), null)
  console.log('PASS g6-context-session (four dimensions + client/session/code binding)')
}

if (process.argv[1]?.endsWith('g6-context-session.mjs') && process.argv.includes('--self-test')) selfTest()
