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

// 只读取「当前源」的规则指纹，供审计与 AI 上下文注入用。
// 不再判 stale/fresh：规则消费已切 pin-based（项目钉 policyFingerprint），发布层是否 == 源
// 对在飞任务无影响，旧的 stale 检测退化成 fameex-web AGENTS.md 漂移导致的狼来了噪音，已下线。
// `--check --json` 无论 fresh 与否都输出 currentFingerprint，故这里直接取、不看 fresh、不抛错。
// 缺失常驻硬规则的真 fail-closed 仍在 lark-rule-context.mjs（VERIFY-RULE-004），与此无关。
export function readRuleFingerprints({ check = runJsonCheck, cwd } = {}) {
  const { consumerRoot } = resolveRoots()
  const workdir = cwd || consumerRoot
  const l3 = check('rule-release.mjs', workdir)
  const effective = check('effective-rules.mjs', workdir)
  return {
    ruleReleaseFingerprint: l3.currentFingerprint || null,
    effectiveRulesFingerprint: effective.currentFingerprint || null,
  }
}

function selfTest() {
  const check = (script) =>
    script === 'rule-release.mjs'
      ? { fresh: true, currentFingerprint: 'l3' }
      : { fresh: false, status: 'stale', currentFingerprint: 'effective' }
  // 即便 effective 报 stale，也照样取到 currentFingerprint（stale 判定已退休）。
  assert.deepEqual(readRuleFingerprints({ check, cwd: '/tmp' }), {
    ruleReleaseFingerprint: 'l3',
    effectiveRulesFingerprint: 'effective',
  })
  // 无 currentFingerprint 时回落到 null，不抛错。
  assert.deepEqual(readRuleFingerprints({ check: () => ({}), cwd: '/tmp' }), {
    ruleReleaseFingerprint: null,
    effectiveRulesFingerprint: null,
  })
  console.log('rule-chain-runtime self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
