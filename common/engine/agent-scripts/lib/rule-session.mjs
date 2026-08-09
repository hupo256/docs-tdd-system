#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CODING_SCENARIOS = new Set(['g4_coding_worktree', 'write_api', 'write_mapper', 'write_query_hook', 'write_state', 'write_msw', 'legacy_mock', 'write_ui', 'write_figma'])

const G2_INPUTS = ['product/00-feature-inventory.md', 'product/01-scope-and-phases.md', 'product/02-technical-design.md', 'product/04-frontend-tasks.md', 'agent/project-manifest.json']

/** Fingerprint the project inputs that authorize business coding. */
export function codeReadinessFingerprint(projectDir) {
  const payload = G2_INPUTS.map((file) => {
    const absolute = resolve(projectDir, file)
    return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : `${file}\nmissing`
  }).join('\n')
  return createHash('sha256').update(payload).digest('hex')
}

/** Validate that a coding session still represents the current rule and project state. */
export function validateRuleSession({ session, current, now = Date.now(), maxAgeMs = 24 * 60 * 60 * 1000 }) {
  const errors = []
  if (!session || session.version !== 1) errors.push('missing or invalid rule session')
  else {
    if (!CODING_SCENARIOS.has(session.scenario)) errors.push(`non-coding scenario: ${session.scenario || 'missing'}`)
    for (const key of ['projectId', 'ruleReleaseFingerprint', 'effectiveRulesFingerprint', 'codeReadinessFingerprint', 'headSha']) {
      if (session[key] !== current[key]) errors.push(`${key} changed`)
    }
    const generatedAt = Date.parse(session.generatedAt)
    if (!Number.isFinite(generatedAt) || now - generatedAt > maxAgeMs) errors.push('rule session expired')
  }
  return { ok: errors.length === 0, errors }
}

function selfTest() {
  const current = {
    projectId: 'PR-01234',
    ruleReleaseFingerprint: 'l3',
    effectiveRulesFingerprint: 'effective',
    codeReadinessFingerprint: 'g2',
    headSha: 'head',
  }
  const session = {
    version: 1,
    scenario: 'write_ui',
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...current,
  }
  const now = Date.parse('2026-01-01T01:00:00.000Z')
  assert.equal(validateRuleSession({ session, current, now }).ok, true)
  assert.deepEqual(
    validateRuleSession({
      session: { ...session, effectiveRulesFingerprint: 'old' },
      current,
      now,
    }).errors,
    ['effectiveRulesFingerprint changed'],
  )
  assert.equal(
    validateRuleSession({
      session: { ...session, scenario: 'g0_g2_scope' },
      current,
      now,
    }).ok,
    false,
  )
  assert.equal(
    validateRuleSession({
      session,
      current,
      now: Date.parse('2026-01-03T00:00:00.000Z'),
    }).ok,
    false,
  )
  console.log('rule-session self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
