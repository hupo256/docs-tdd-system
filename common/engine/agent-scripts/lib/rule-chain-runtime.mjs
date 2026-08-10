#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoots } from './roots.mjs'

const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function runJsonCheck(script, cwd) {
  const result = spawnSync(process.execPath, [join(scriptDir, script), '--check', '--json'], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  try {
    return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
  } catch (error) {
    return {
      fresh: false,
      status: 'invalid',
      parseError: error.message,
      exitCode: result.status ?? 1,
    }
  }
}

/** Fail closed unless both published rule layers still match their current sources. */
export function assertFreshRuleChain({ check = runJsonCheck, cwd } = {}) {
  const { consumerRoot } = resolveRoots()
  const workdir = cwd || consumerRoot
  const l3 = check('rule-release.mjs', workdir)
  const effective = check('effective-rules.mjs', workdir)
  const failures = [
    !l3.fresh ? `L3 release is ${l3.status || 'invalid'}` : null,
    !effective.fresh ? `effective rules are ${effective.status || 'invalid'}` : null,
  ].filter(Boolean)
  if (failures.length) throw new Error(`[VERIFY-RULE-004] stale rule chain: ${failures.join('; ')}`)
  return {
    ruleReleaseFingerprint: l3.currentFingerprint,
    effectiveRulesFingerprint: effective.currentFingerprint,
  }
}

function selfTest() {
  const freshCheck = (script) =>
    script === 'rule-release.mjs'
      ? { fresh: true, currentFingerprint: 'l3' }
      : { fresh: true, currentFingerprint: 'effective' }
  assert.deepEqual(assertFreshRuleChain({ check: freshCheck, cwd: '/tmp' }), {
    ruleReleaseFingerprint: 'l3',
    effectiveRulesFingerprint: 'effective',
  })
  assert.throws(
    () =>
      assertFreshRuleChain({
        check: () => ({ fresh: false, status: 'stale' }),
        cwd: '/tmp',
      }),
    /VERIFY-RULE-004.*stale rule chain/,
  )
  console.log('rule-chain-runtime self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
