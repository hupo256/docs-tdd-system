#!/usr/bin/env node
// run-project-gate 的判定/汇总层（纯函数）：checks 统计、结构化失败提取、JSON 解析、失败摘要、
// 机器事实层缺席守卫、payload.ok 派生、gate 缓存复用判定、命令摘要同步。--self-test 直测。

import assert from 'node:assert/strict'
import { buildQualityCell, formatEvidenceRunId, renderEvidence, summarizeCommand } from './gate-evidence.mjs'

const VALIDATION_TIERS = new Set(['MICRO', 'FOCUSED', 'FULL'])

export function parseValidationTierOptions(args = []) {
  const tierIndex = args.indexOf('--validation-tier')
  const reasonIndex = args.indexOf('--validation-tier-reason')
  const optionValue = (index) => {
    const value = index >= 0 ? args[index + 1] : ''
    return typeof value === 'string' && value.trim() && !value.startsWith('--') ? value.trim() : ''
  }
  if (tierIndex < 0) {
    return reasonIndex >= 0
      ? { tier: 'FULL', reason: '', explicit: false, forwardedArgs: [], error: '--validation-tier-reason requires --validation-tier' }
      : { tier: 'FULL', reason: '', explicit: false, forwardedArgs: [], error: null }
  }
  const rawTier = optionValue(tierIndex)
  if (!rawTier) return { tier: 'FULL', reason: '', explicit: true, forwardedArgs: [], error: '--validation-tier requires MICRO, FOCUSED, or FULL' }
  const tier = rawTier.toUpperCase()
  if (!VALIDATION_TIERS.has(tier)) return { tier: 'FULL', reason: '', explicit: true, forwardedArgs: [], error: `invalid --validation-tier: ${rawTier}` }
  if (reasonIndex >= 0 && !optionValue(reasonIndex)) {
    return { tier, reason: '', explicit: true, forwardedArgs: [], error: '--validation-tier-reason requires a non-empty value' }
  }
  const reason = optionValue(reasonIndex)
  if (tier !== 'FULL' && !reason) {
    return { tier, reason: '', explicit: true, forwardedArgs: [], error: `--validation-tier-reason is required for ${tier}` }
  }
  return {
    tier,
    reason,
    explicit: true,
    forwardedArgs: ['--validation-tier', tier, ...(reason ? ['--validation-tier-reason', reason] : [])],
    error: null,
  }
}

export function validationRequirements(tier) {
  if (tier === 'MICRO') return { biome: false, type: false, test: false, build: false }
  if (tier === 'FOCUSED') return { biome: true, type: false, test: 'existing', build: false }
  return { biome: true, type: true, test: true, build: true }
}

export function validationClassificationCheck(tier, reason) {
  return {
    ruleId: 'VERIFY-TIER-001',
    ok: true,
    severity: 'error',
    message: tier === 'FULL' ? '验证档位 FULL：执行完整机器事实层' : `验证档位 ${tier}：${reason}`,
    file: '',
    category: 'build-quality',
    disposition: 'classification',
    evidence: { counts: { tier, reason } },
  }
}

export function summarizeChecks(checks = []) {
  return {
    total: checks.length,
    ok: checks.filter((check) => check.ok).length,
    warn: checks.filter((check) => !check.ok && check.severity === 'warn').length,
    waived: checks.filter((check) => !check.ok && check.severity === 'waived').length,
    fail: checks.filter((check) => !check.ok && check.severity === 'error').length,
  }
}

export function structuredFailures(result) {
  const candidates = [...(result?.checks || []), ...(result?.findings || [])]
  return candidates.filter((item) => item?.ok === false)
}

export function parseJsonOutput(runResult) {
  try {
    return JSON.parse(runResult.stdout)
  } catch (error) {
    return { ok: false, parseError: error.message }
  }
}

export function conciseFailure(runResult, limit = 12) {
  const lines = `${runResult.stderr}\n${runResult.stdout}`.split('\n').map((line) => line.trim()).filter(Boolean)
  const actionable = lines.filter((line) => /\b(?:fail|block|error|warn|action|required|missing|invalid)\b/i.test(line))
  return (actionable.length ? actionable : lines).slice(0, limit)
}

// 机器事实层缺席守卫：子脚本被跳过、崩了或输出无法解析时，不允许静默当成「本阶段没有这一层」。
// 无理由跳过 = error（否则 --skip-build-quality 就是万能后门）；有理由跳过 = warn，进 warn 台账留痕。
// G8 例外：交付闸不接受自由文本理由整层跳过（那样连 biome/tsc/vitest 证据都没了）；真跑不了的正当出口是
// 实跑 verify-build-quality、若唯独 production build 过不了再在 agent/rule-waivers.json 具名豁免 VERIFY-PROD-BUILD-001。
export function buildQualityGuardCheck({ gate, required, skipped, reason, run, parsed }) {
  if (!required) return null
  const base = { ruleId: 'VERIFY-BUILD-001', category: 'build-quality', file: 'common/engine/agent-scripts/verify-build-quality.mjs' }
  if (skipped) {
    const trimmed = (reason || '').trim()
    if (!trimmed) {
      return { ...base, ok: false, severity: 'error', message: `${gate} 跳过机器事实层但未给 --skip-build-quality-reason，视为无证据`, evidence: '--skip-build-quality' }
    }
    if (gate === 'G8') {
      return { ...base, ok: false, severity: 'error', message: `${gate} 交付闸不接受 --skip-build-quality 整层跳过（会连 biome/tsc/vitest 一起丢证据）：${trimmed}。请实跑 verify-build-quality；若唯独 production build 过不了，在 agent/rule-waivers.json 具名豁免 VERIFY-PROD-BUILD-001`, evidence: '--skip-build-quality' }
    }
    return { ...base, ok: false, severity: 'warn', message: `${gate} 跳过机器事实层（biome/tsc/vitest 未实跑）：${trimmed}`, evidence: '--skip-build-quality' }
  }
  if (!run) {
    return { ...base, ok: false, severity: 'error', message: `${gate} 需要机器事实层但 verify-build-quality 未被执行`, evidence: 'no run' }
  }
  if (!Array.isArray(parsed?.checks)) {
    const detail = parsed?.parseError ? `输出无法解析：${parsed.parseError}` : `退出码 ${run.status ?? 'null'}，未产出 checks`
    return { ...base, ok: false, severity: 'error', message: `${gate} 机器事实层执行失败，${detail}`, evidence: run.logFile || 'verify-build-quality' }
  }
  const notRequired = parsed.checks.filter((check) => check.disposition === 'not-required').length
  return {
    ...base,
    ok: true,
    severity: 'error',
    message: `${gate} 机器事实层已按 ${parsed.validationTier || 'FULL'} 执行：${parsed.checks.length - notRequired} 条执行结论，${notRequired} 条 not-required`,
    evidence: run.logFile || 'verify-build-quality',
  }
}

export function derivePayloadOk(gateResult, summary, codeRulesOk) {
  return Boolean(gateResult.ok) && summary.fail === 0 && codeRulesOk
}

export function shouldUseGateCache({ isWrite, isNoCache, cacheExists, cachedOk }) {
  return !isWrite && !isNoCache && cacheExists && cachedOk === true
}

export function syncCommandSummary(payload, commands) {
  payload.commands = commands.map(summarizeCommand)
}

export function selfTest() {
  const checks = [
    { ruleId: 'SELFTEST-OK', ok: true, message: 'ok', file: 'a.md', severity: 'error' },
    { ruleId: 'SELFTEST-FAIL', ok: false, message: 'needs evidence', file: 'b.md', severity: 'error' },
    { ruleId: 'SELFTEST-WARN', ok: false, message: 'warn only', file: 'c.ts', severity: 'warn' },
  ]
  const summary = summarizeChecks(checks)
  assert.ok(summary.total === 3 && summary.fail === 1 && summary.warn === 1 && summary.ok === 1, `bad summary ${JSON.stringify(summary)}`)
  assert.deepEqual(parseValidationTierOptions([]), { tier: 'FULL', reason: '', explicit: false, forwardedArgs: [], error: null })
  assert.equal(parseValidationTierOptions(['--validation-tier', 'MICRO']).error, '--validation-tier-reason is required for MICRO')
  assert.equal(parseValidationTierOptions(['--validation-tier', '--no-cache']).error, '--validation-tier requires MICRO, FOCUSED, or FULL')
  assert.deepEqual(parseValidationTierOptions(['--validation-tier', 'focused', '--validation-tier-reason', 'local change']).forwardedArgs, ['--validation-tier', 'FOCUSED', '--validation-tier-reason', 'local change'])
  assert.ok(Object.values(validationRequirements('MICRO')).every((value) => value === false))
  assert.equal(validationRequirements('FOCUSED').test, 'existing')
  assert.ok(Object.values(validationRequirements('FULL')).every((value) => value === true))
  assert.equal(validationClassificationCheck('MICRO', 'small').disposition, 'classification')
  const text = renderEvidence({ projectId: 'PR-00001', gate: 'G6', generatedAt: '2026-07-14T00:00:00.000Z', summary, checks }, [], 'self-test')
  assert.ok(text.includes('Gate Evidence') && text.includes('SELFTEST-FAIL') && text.includes('Command Evidence'), 'evidence renderer missing required sections')
  assert.equal(formatEvidenceRunId('2026-07-14T12:34:56.000Z', 'G6'), '2026-07-14-123456-g6', 'evidence run id format drifted')
  const commandSummary = summarizeCommand({ label: 'self', result: { status: 0, ok: true, startedAt: '2026-07-14T00:00:00.000Z', finishedAt: '2026-07-14T00:00:01.000Z' } })
  assert.ok(commandSummary.label === 'self' && commandSummary.status === 0 && commandSummary.ok && commandSummary.startedAt && commandSummary.finishedAt, 'command summary missing required fields')
  const payload = { commands: [] }
  syncCommandSummary(payload, [
    { label: 'verify-project-gate PR-00001 G8', result: { status: 0, ok: true, startedAt: '2026-07-14T00:00:00.000Z' } },
    { label: 'update-project-index --write', result: { status: 0, ok: true, startedAt: '2026-07-14T00:00:01.000Z' } },
  ])
  assert.ok(payload.commands.length === 2 && payload.commands[1].label === 'update-project-index --write', 'refresh-index command summary not synced')
  assert.ok(!derivePayloadOk({ ok: true }, { fail: 0 }, false), 'verify-code-rules failure must block payload.ok')
  const guardCases = [
    { name: 'G5 不要求', input: { gate: 'G5', required: false, skipped: false, reason: '', run: null, parsed: null }, expect: null },
    { name: 'G6 无理由跳过', input: { gate: 'G6', required: true, skipped: true, reason: '', run: null, parsed: null }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 有理由跳过', input: { gate: 'G6', required: true, skipped: true, reason: '离线环境无依赖', run: null, parsed: null }, expect: { ok: false, severity: 'warn' } },
    { name: 'G8 有理由整层跳过仍 error', input: { gate: 'G8', required: true, skipped: true, reason: '离线环境无依赖', run: null, parsed: null }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 应跑未跑', input: { gate: 'G6', required: true, skipped: false, reason: '', run: null, parsed: null }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 输出不可解析', input: { gate: 'G6', required: true, skipped: false, reason: '', run: { status: 1 }, parsed: { ok: false, parseError: 'Unexpected token' } }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 正常实跑', input: { gate: 'G6', required: true, skipped: false, reason: '', run: { status: 0 }, parsed: { ok: true, checks: [{ ruleId: 'VERIFY-BIOME-001', ok: true }] } }, expect: { ok: true, severity: 'error' } },
  ]
  for (const guardCase of guardCases) {
    const actual = buildQualityGuardCheck(guardCase.input)
    if (guardCase.expect === null) {
      assert.equal(actual, null, `build-quality guard should be silent (${guardCase.name})`)
      continue
    }
    assert.ok(actual && actual.ok === guardCase.expect.ok && actual.severity === guardCase.expect.severity, `build-quality guard verdict drifted (${guardCase.name}): ${JSON.stringify(actual)}`)
    assert.equal(actual.ruleId, 'VERIFY-BUILD-001', `build-quality guard rule id drifted (${guardCase.name})`)
  }
  assert.ok(buildQualityCell({ required: false }).includes('不要求'), 'build-quality cell must state 不要求 when gate is below G6')
  assert.ok(buildQualityCell({ required: true, skipped: true, reason: 'x' }).includes('已跳过'), 'build-quality cell must surface skip state')
  assert.ok(buildQualityCell({ required: true, skipped: false, ok: false, checkCount: 5, validationTier: 'FULL' }).includes('FAIL'), 'build-quality cell must surface FAIL')
  assert.ok(buildQualityCell({ required: true, skipped: false, ok: true, checkCount: 5, notRequiredCount: 4, validationTier: 'MICRO' }).includes('not-required 4'), 'build-quality cell must surface tiered not-required counts')
  assert.ok(shouldUseGateCache({ isWrite: false, isNoCache: false, cacheExists: true, cachedOk: true }), 'reusable PASS cache was rejected')
  for (const cacheCase of [
    { isWrite: true, isNoCache: false, cacheExists: true, cachedOk: true },
    { isWrite: false, isNoCache: true, cacheExists: true, cachedOk: true },
    { isWrite: false, isNoCache: false, cacheExists: true, cachedOk: false },
    { isWrite: false, isNoCache: false, cacheExists: false, cachedOk: true },
  ]) {
    assert.ok(!shouldUseGateCache(cacheCase), `unsafe cache accepted ${JSON.stringify(cacheCase)}`)
  }
  console.log('PASS run-project-gate renderer')
}

if (process.argv[1] && process.argv[1].endsWith('gate-payload.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
