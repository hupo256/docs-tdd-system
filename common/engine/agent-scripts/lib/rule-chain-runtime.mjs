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

// 非抛错版：给 /lark/health 之类的探活/诊断用——只报告 { fresh, failures }，不阻断。
// 带 TTL 缓存：health 可能被频繁探活，两次 spawnSync 子进程校验不该每请求都跑（默认 60s）。
let ruleChainCache = null
export function inspectRuleChain({ check = runJsonCheck, cwd, ttlMs = 60_000, now = Date.now } = {}) {
  const at = now()
  if (ruleChainCache && at - ruleChainCache.at < ttlMs) return ruleChainCache.value
  try {
    const fingerprints = assertFreshRuleChain({ check, cwd })
    const value = { fresh: true, failures: [], ...fingerprints }
    ruleChainCache = { at, value }
    return value
  } catch (error) {
    const value = { fresh: false, failures: [String(error.message || error)] }
    ruleChainCache = { at, value }
    return value
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
  // inspectRuleChain 永不抛：stale 时返回 { fresh:false, failures:[...] }。用递增 now 绕过 TTL 缓存。
  let clock = 0
  const tick = () => (clock += 100_000)
  assert.equal(inspectRuleChain({ check: freshCheck, cwd: '/tmp', now: tick }).fresh, true)
  const stale = inspectRuleChain({ check: () => ({ fresh: false, status: 'stale' }), cwd: '/tmp', now: tick })
  assert.equal(stale.fresh, false)
  assert.ok(stale.failures.length > 0)
  console.log('rule-chain-runtime self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
