#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CODING_SCENARIOS = new Set(['g4_coding_worktree', 'write_api', 'write_mapper', 'write_query_hook', 'write_state', 'write_msw', 'legacy_mock', 'write_ui', 'write_figma'])
export const RULE_SESSION_CLIENTS = new Set(['codex', 'claude', 'cursor', 'human'])

function detectedAiClient(env) {
  if (env.CLAUDE_PROJECT_DIR) return 'claude'
  if (env.CODEX_THREAD_ID || env.CODEX_SHELL) return 'codex'
  return null
}

const G2_INPUTS = ['product/00-feature-inventory.md', 'product/01-scope-and-phases.md', 'product/02-technical-design.md', 'product/04-frontend-tasks.md', 'agent/project-manifest.json']

/** Resolve the current rule consumer so one AI cannot reuse another client's evidence. */
export function resolveRuleSessionClient({ requested, env = process.env } = {}) {
  const explicit = requested || env.DOCS_TDD_AGENT_CLIENT
  const detected = detectedAiClient(env)
  if (explicit) {
    if (!RULE_SESSION_CLIENTS.has(explicit)) throw new Error(`invalid agent client: ${explicit}`)
    if (detected && explicit !== detected) throw new Error(`agent client mismatch: runtime is ${detected}, requested ${explicit}`)
    return explicit
  }
  return detected || 'human'
}

/** Fingerprint the project inputs that authorize business coding. */
export function codeReadinessFingerprint(projectDir) {
  const payload = G2_INPUTS.map((file) => {
    const absolute = resolve(projectDir, file)
    return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : `${file}\nmissing`
  }).join('\n')
  return createHash('sha256').update(payload).digest('hex')
}

/**
 * Validate that a coding session still represents the current rule and project state.
 *
 * Blocks ONLY on the project's own authority drifting or the agent not reloading after an
 * explicit rule upgrade:
 *   - structural (version/scenario/expiry), projectId, client;
 *   - codeReadinessFingerprint — the project's G2 authoring inputs changed;
 *   - rulePin.policyFingerprint != the project's pinned baseline — rules were upgraded but
 *     context was not reloaded.
 * It does NOT block on docs_tdd's global-latest rule/effective fingerprint (a shared-repo edit
 * must not retroactively wedge in-flight projects) nor on headSha (HEAD legitimately advances
 * between gates); those surface as warnings elsewhere.
 */
export function validateRuleSession({ session, current, baseline, now = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000 }) {
  const errors = []
  const warnings = []
  if (!session || session.version !== 2) errors.push('missing or invalid rule session')
  else {
    if (!CODING_SCENARIOS.has(session.scenario)) errors.push(`non-coding scenario: ${session.scenario || 'missing'}`)
    for (const key of ['projectId', 'client', 'codeReadinessFingerprint']) {
      if (session[key] !== current[key]) errors.push(`${key} changed`)
    }
    if (baseline && session.rulePin?.policyFingerprint !== baseline.policyFingerprint) {
      errors.push('rule policy upgraded; reload context')
    }
    if (current.headSha && session.headSha && session.headSha !== current.headSha) {
      warnings.push('headSha advanced since context was loaded (informational)')
    }
    const generatedAt = Date.parse(session.generatedAt)
    if (!Number.isFinite(generatedAt) || now - generatedAt > maxAgeMs) errors.push('rule session expired')
  }
  return { ok: errors.length === 0, errors, warnings }
}

function selfTest() {
  const current = {
    projectId: 'PR-01234',
    codeReadinessFingerprint: 'g2',
    headSha: 'head',
    client: 'codex',
  }
  const baseline = { policyFingerprint: 'pol' }
  const session = {
    version: 2,
    scenario: 'write_ui',
    generatedAt: '2026-01-01T00:00:00.000Z',
    rulePin: { policyFingerprint: 'pol' },
    ...current,
  }
  const now = Date.parse('2026-01-01T01:00:00.000Z')
  assert.equal(validateRuleSession({ session, current, baseline, now }).ok, true)
  // Global rule/effective fingerprint drift no longer blocks — a shared-repo edit must not wedge the project.
  assert.equal(
    validateRuleSession({ session: { ...session, ruleReleaseFingerprint: 'whatever' }, current, baseline, now }).ok,
    true,
  )
  // headSha advancing is a warning, not a block.
  const advanced = validateRuleSession({ session, current: { ...current, headSha: 'head2' }, baseline, now })
  assert.equal(advanced.ok, true)
  assert.ok(advanced.warnings.some((w) => /headSha advanced/.test(w)))
  // The project's own G2 inputs changing DOES block.
  assert.deepEqual(
    validateRuleSession({ session, current: { ...current, codeReadinessFingerprint: 'g2b' }, baseline, now }).errors,
    ['codeReadinessFingerprint changed'],
  )
  // An explicit rule upgrade the agent hasn't reloaded blocks.
  assert.deepEqual(
    validateRuleSession({ session, current, baseline: { policyFingerprint: 'pol-next' }, now }).errors,
    ['rule policy upgraded; reload context'],
  )
  assert.deepEqual(
    validateRuleSession({ session: { ...session, client: 'cursor' }, current, baseline, now }).errors,
    ['client changed'],
  )
  assert.equal(
    validateRuleSession({ session: { ...session, scenario: 'g0_g2_scope' }, current, baseline, now }).ok,
    false,
  )
  assert.equal(resolveRuleSessionClient({ env: { CODEX_THREAD_ID: 'thread' } }), 'codex')
  assert.equal(resolveRuleSessionClient({ env: { CLAUDE_PROJECT_DIR: '/repo' } }), 'claude')
  assert.equal(resolveRuleSessionClient({ requested: 'cursor', env: {} }), 'cursor')
  assert.equal(resolveRuleSessionClient({ env: {} }), 'human')
  assert.throws(() => resolveRuleSessionClient({ requested: 'human', env: { CODEX_SHELL: '1' } }), /agent client mismatch/)
  assert.throws(() => resolveRuleSessionClient({ requested: 'manual', env: {} }), /invalid agent client/)
  assert.throws(() => resolveRuleSessionClient({ requested: 'unknown', env: {} }), /invalid agent client/)
  assert.equal(
    validateRuleSession({ session, current, baseline, now: Date.parse('2026-01-03T00:00:00.000Z') }).ok,
    false,
  )
  console.log('rule-session self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
