#!/usr/bin/env node
// Run a project gate, persist machine-readable results, and write a reviewable evidence README.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { recordFindings, loadLedger, saveLedger } from './warn-ledger.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
// 子 gate 的 GIT-G4 检查要认「agent 正在编码的 worktree 分支」，靠 verify-project-gate 内部的 process.cwd()。
// 但本聚合器经 symlink 解析出的 repoRoot 恒指向主仓（常停在 dev），若用它当子进程 cwd，会把子脚本
// 的 worktree 定位拽回主仓、误判 GIT-G4-001。所以 spawn 子 gate 时传调用者
// 的真实 cwd（agent 所在 worktree），而非 repoRoot。内容路径（docsRoot/projectDir）仍用 repoRoot。
const callerCwd = process.cwd()
const args = process.argv.slice(2)
const projectId = args[0]
const gate = (args[1] || '').toUpperCase()
const write = args.includes('--write')
const noCache = args.includes('--no-cache')
// --refresh-index 仍被接受（旧命令行/文档不会报错），但已无效果：--write 下刷新索引是默认行为。
const noRefreshIndex = args.includes('--no-refresh-index')
const json = args.includes('--json')
const skipCodeRules = args.includes('--skip-code-rules')
const skipCodeRulesReason = readOption('--skip-code-rules-reason').trim()
const skipBuildQuality = args.includes('--skip-build-quality')
const skipBuildQualityReason = readOption('--skip-build-quality-reason').trim()
const codeRuleGates = ['G5', 'G6', 'G7', 'G8']
const strictCodeRuleGates = ['G6', 'G7', 'G8']
// 机器事实层（biome/tsc/vitest 真跑）从 G6「自动验收」起强制。G5 之前代码仍在联调中，
// 存量报错和未接完的 handler 会让它天天红，反而训练出「习惯性忽略」。
const buildQualityGates = ['G6', 'G7', 'G8']

function printHelp() {
  console.log(`usage: run-project-gate.mjs <PR-01234> <G0-G8> [--write] [--no-cache] [--no-refresh-index] [--skip-code-rules --skip-code-rules-reason <reason>] [--skip-build-quality --skip-build-quality-reason <reason>] [--reviewer <name>] [--json] [--help]

Run a project gate, persist machine-readable results, and write a reviewable evidence README.
G5+ automatically runs verify-code-rules unless --skip-code-rules is used.
G6+ additionally runs verify-build-quality (real biome / tsc / vitest execution) unless --skip-build-quality is used.

Options:
  --help                          Show this help message and exit
  --write                         Persist gate-results.json and evidence README
  --no-cache                      Force all gate sub-checks to run
  --no-refresh-index              Skip PROJECTS.md refresh
  --skip-code-rules               Skip the verify-code-rules sub-run (G6/G7/G8 need --skip-code-rules-reason)
  --skip-code-rules-reason        Reason recorded when skipping code rules
  --skip-build-quality            Skip the verify-build-quality sub-run (always needs a reason)
  --skip-build-quality-reason     Reason recorded when skipping biome/tsc/vitest execution
  --reviewer                      Reviewer name for evidence (default: $USER)
  --json                          Output JSON result to stdout`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

function fail(message) {
  console.error(`[run-project-gate] ${message}`)
  process.exit(1)
}

function readOption(name, fallback = '') {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

function usage() {
  fail('usage: run-project-gate.mjs PR-01234 G6 [--write] [--no-cache] [--no-refresh-index] [--skip-code-rules --skip-code-rules-reason reason] [--reviewer name]')
}

function run(commandArgs) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(process.execPath, commandArgs, { cwd: callerCwd, encoding: 'utf8', stdio: 'pipe' })
  return {
    command: [process.execPath, ...commandArgs].join(' '),
    startedAt,
    finishedAt: new Date().toISOString(),
    status: result.status,
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

function safeLogLabel(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'check'
}

function persistRunLog(label, runResult) {
  const logDir = join(tmpdir(), 'docs-tdd-logs', projectId || 'unknown')
  const stamp = runResult.startedAt.replace(/[:.]/g, '-')
  const logFile = join(logDir, `${stamp}-${safeLogLabel(label)}.log`)
  const body = [
    `command: ${runResult.command}`,
    `startedAt: ${runResult.startedAt}`,
    `finishedAt: ${runResult.finishedAt}`,
    `status: ${runResult.status ?? 'null'}`,
    '',
    '--- stdout ---',
    runResult.stdout,
    '',
    '--- stderr ---',
    runResult.stderr,
    '',
  ].join('\n')
  mkdirSync(logDir, { recursive: true })
  writeFileSync(logFile, body)
  runResult.logFile = logFile
  return logFile
}

function conciseFailure(runResult, limit = 12) {
  const lines = `${runResult.stderr}\n${runResult.stdout}`.split('\n').map((line) => line.trim()).filter(Boolean)
  const actionable = lines.filter((line) => /\b(?:fail|block|error|warn|action|required|missing|invalid)\b/i.test(line))
  return (actionable.length ? actionable : lines).slice(0, limit)
}

function structuredFailures(result) {
  const candidates = [...(result?.checks || []), ...(result?.findings || [])]
  return candidates.filter((item) => item?.ok === false)
}

function printFailureSummary(label, runResult, parsedResult) {
  const findings = structuredFailures(parsedResult).slice(0, 12)
  console.error(`FAIL ${label}`)
  if (findings.length) {
    for (const finding of findings) {
      const severity = String(finding.severity || 'error').toUpperCase()
      console.error(`  [${severity}] ${finding.ruleId || finding.id || 'ERROR'}: ${finding.message || finding.reason || 'check failed'}${finding.file ? ` (${finding.file})` : ''}`)
    }
  } else {
    for (const line of conciseFailure(runResult)) console.error(`  ${line}`)
  }
  console.error(`  full log: ${runResult.logFile}`)
}

function parseJsonOutput(runResult) {
  try {
    return JSON.parse(runResult.stdout)
  } catch (error) {
    return { ok: false, parseError: error.message }
  }
}

function summarizeChecks(checks = []) {
  return {
    total: checks.length,
    ok: checks.filter((check) => check.ok).length,
    warn: checks.filter((check) => !check.ok && check.severity === 'warn').length,
    waived: checks.filter((check) => !check.ok && check.severity === 'waived').length,
    fail: checks.filter((check) => !check.ok && check.severity === 'error').length,
  }
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '/').replace(/\n/g, '<br>')
}

function actionRows(checks = []) {
  const rows = checks.filter((check) => !check.ok)
  if (!rows.length) return '| 无 | PASS | 无阻塞项 | | |'
  return rows
    .map((check) => `| ${escapeCell(check.ruleId)} | ${escapeCell(check.severity)} | ${escapeCell(check.message)} | ${escapeCell(check.file)} | 待处理 / 已豁免 / 不适用 |`)
    .join('\n')
}

function commandRows(commands) {
  return commands
    .map((item) => `| \`${escapeCell(item.label)}\` | ${escapeCell(item.target)} | ${item.result.ok ? 'PASS' : 'FAIL'} | exit=${item.result.status ?? 'null'} |`)
    .join('\n')
}

function summarizeCommand(item) {
  return {
    label: item.label,
    status: item.result.status,
    ok: item.result.ok,
    startedAt: item.result.startedAt,
    finishedAt: item.result.finishedAt,
    logFile: item.result.logFile || null,
  }
}

function createFingerprint() {
  const code = codeFingerprint(callerCwd, config.baseRef || 'origin/online')
  const rulesetFile = join(docsRoot, 'common/rules/ruleset.json')
  const ruleset = existsSync(rulesetFile) ? JSON.parse(readFileSync(rulesetFile, 'utf8')) : { version: 'unknown' }
  const releaseFile = join(docsRoot, 'common/rule-release.json')
  const release = existsSync(releaseFile) ? JSON.parse(readFileSync(releaseFile, 'utf8')) : { fingerprint: 'unknown' }
  const effectiveRulesFile = join(docsRoot, 'common/effective-rules.json')
  const effectiveRules = existsSync(effectiveRulesFile) ? JSON.parse(readFileSync(effectiveRulesFile, 'utf8')) : { fingerprint: 'unknown' }
  return {
    headSha: code.headSha,
    baseSha: code.baseSha,
    dirtyHash: code.dirtyHash,
    dirtyFileCount: code.dirtyFileCount,
    untrackedFileCount: code.untrackedFileCount,
    rulesetVersion: ruleset.version,
    ruleReleaseFingerprint: release.fingerprint,
    effectiveRulesFingerprint: effectiveRules.fingerprint,
  }
}

function shouldUseGateCache({ isWrite, isNoCache, cacheExists, cachedOk }) {
  return !isWrite && !isNoCache && cacheExists && cachedOk === true
}

function gateCacheFingerprint(projectDir) {
  const fingerprint = createFingerprint()
  const projectFiles = ['product/00-feature-inventory.md', 'product/02-technical-design.md', 'product/03-api-contract.md', 'product/04-frontend-tasks.md', 'product/06-collaboration.md', 'agent/project-manifest.json', 'agent/prd-source-manifest.json', 'agent/msw-manifest.json', 'agent/assumptions.json', 'agent/rule-waivers.json', 'agent/stage-status.json', 'agent/gate-history.json', 'agent/blockers.json', 'agent/code-review.json', 'agent/acceptance-results.json', 'agent/delivery-status.json']
    .map((file) => {
      const absolute = join(projectDir, file)
      return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : `${file}\nmissing`
    })
    .join('\n')
  return createHash('sha256').update(`gate-v1\n${projectId}\n${gate}\n${JSON.stringify(fingerprint)}\n${projectFiles}`).digest('hex').slice(0, 16)
}

function syncCommandSummary(payload, commands) {
  payload.commands = commands.map(summarizeCommand)
}

function appendGateHistory(projectDir, payload, evidenceFile) {
  const historyFile = join(projectDir, 'agent/gate-history.json')
  let history = { projectId: payload.projectId, runs: [] }
  if (existsSync(historyFile)) {
    try {
      history = JSON.parse(readFileSync(historyFile, 'utf8'))
    } catch {
      fail(`invalid gate history: ${relative(repoRoot, historyFile)}`)
    }
  }
  const runs = Array.isArray(history.runs) ? history.runs : []
  runs.push({
    gate: payload.gate,
    ok: payload.ok,
    generatedAt: payload.generatedAt,
    tool: payload.tool,
    summary: payload.summary,
    fingerprint: payload.fingerprint,
    evidence: relative(projectDir, evidenceFile),
  })
  writeFileSync(historyFile, `${JSON.stringify({ projectId: payload.projectId, runs }, null, 2)}\n`)
}

// 机器事实层缺席守卫：子脚本被跳过、崩了或输出无法解析时，不允许静默当成「本阶段没有这一层」。
// 无理由跳过 = error（否则 --skip-build-quality 就是万能后门）；有理由跳过 = warn，进 warn 台账留痕。
export function buildQualityGuardCheck({ gate, required, skipped, reason, run, parsed }) {
  if (!required) return null
  const base = { ruleId: 'VERIFY-BUILD-001', category: 'build-quality', file: 'common/engine/agent-scripts/verify-build-quality.mjs' }
  if (skipped) {
    const trimmed = (reason || '').trim()
    return trimmed
      ? { ...base, ok: false, severity: 'warn', message: `${gate} 跳过机器事实层（biome/tsc/vitest 未实跑）：${trimmed}`, evidence: '--skip-build-quality' }
      : { ...base, ok: false, severity: 'error', message: `${gate} 跳过机器事实层但未给 --skip-build-quality-reason，视为无证据`, evidence: '--skip-build-quality' }
  }
  if (!run) {
    return { ...base, ok: false, severity: 'error', message: `${gate} 需要机器事实层但 verify-build-quality 未被执行`, evidence: 'no run' }
  }
  if (!Array.isArray(parsed?.checks)) {
    const detail = parsed?.parseError ? `输出无法解析：${parsed.parseError}` : `退出码 ${run.status ?? 'null'}，未产出 checks`
    return { ...base, ok: false, severity: 'error', message: `${gate} 机器事实层执行失败，${detail}`, evidence: run.logFile || 'verify-build-quality' }
  }
  return { ...base, ok: true, severity: 'error', message: `${gate} 机器事实层已实跑：${parsed.checks.length} 条 biome/tsc/vitest 结论`, evidence: run.logFile || 'verify-build-quality' }
}

function derivePayloadOk(gateResult, summary, codeRulesOk) {
  return Boolean(gateResult.ok) && summary.fail === 0 && codeRulesOk
}

function formatEvidenceRunId(generatedAt, gateName) {
  const compactTime = generatedAt.slice(11, 19).replace(/:/g, '')
  return `${generatedAt.slice(0, 10)}-${compactTime}-${gateName.toLowerCase()}`
}

// 交付摘要要能一眼看出 biome/tsc/vitest 到底跑没跑，而不是只看到一堆 PASS。
export function buildQualityCell(buildQuality) {
  if (!buildQuality?.required) return '本阶段不要求（G6 起强制）'
  if (buildQuality.skipped) return `已跳过：${escapeCell(buildQuality.reason || '未填理由')}`
  return `${buildQuality.ok ? 'PASS' : 'FAIL'}（biome/tsc/vitest 实跑 ${buildQuality.checkCount ?? 0} 条结论）`
}

function renderEvidence(payload, commands, reviewer) {
  const failed = payload.checks.filter((check) => !check.ok && check.severity === 'error')
  const conclusion = failed.length ? 'BLOCKED' : 'PASS'
  return `# Gate Evidence — ${payload.projectId} ${payload.gate}

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | ${payload.projectId} |
| 阶段 | ${payload.gate} |
| 日期 | ${payload.generatedAt.slice(0, 10)} |
| 验证人 | ${escapeCell(reviewer)} |
| 结论 | ${conclusion} |
| 统计 | total=${payload.summary.total}, fail=${payload.summary.fail}, warn=${payload.summary.warn}, waived=${payload.summary.waived} |
| 分组 | documentation=${payload.groups?.documentation?.ok ?? 0}/${payload.groups?.documentation?.total ?? 0}, implementation=${payload.groups?.implementation?.ok ?? 0}/${payload.groups?.implementation?.total ?? 0} |
| 跳过代码规则 | ${payload.codeRules?.skipped ? `是：${escapeCell(payload.codeRules.reason)}` : '否'} |
| 机器事实层 | ${buildQualityCell(payload.buildQuality)} |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
${commandRows(commands)}

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
${actionRows(payload.checks)}

## Browser / UI Evidence

| 页面 / 场景 | URL | 视口 / 主题 | 操作步骤 | 结果 |
|-------------|-----|-------------|----------|------|
| 本脚本不执行浏览器自测 | 待人工补充 | 待人工补充 | 待人工补充 | 未覆盖 |

## Code Review Evidence

| 时间 | 命令 | findings | 处理结论 | 备注 |
|------|------|----------|----------|------|
| 待补充 | /code-review | 待补充 | 已修 / 豁免 / 不适用 | 同步到 \`product/06-collaboration.md\` |

## Blockers / Risks

| 项 | 影响 | 责任人 | 下一步 | 状态 |
|----|------|--------|--------|------|
${failed.length ? failed.map((check) => `| ${escapeCell(check.ruleId)} | 阻塞 ${payload.gate} | 待定 | ${escapeCell(check.message)} | OPEN |`).join('\n') : '| 无 | | | | CLOSED |'}
`
}

function selfTest() {
  const checks = [
    { ruleId: 'SELFTEST-OK', ok: true, message: 'ok', file: 'a.md', severity: 'error' },
    { ruleId: 'SELFTEST-FAIL', ok: false, message: 'needs evidence', file: 'b.md', severity: 'error' },
    { ruleId: 'SELFTEST-WARN', ok: false, message: 'warn only', file: 'c.ts', severity: 'warn' },
  ]
  const summary = summarizeChecks(checks)
  if (summary.total !== 3 || summary.fail !== 1 || summary.warn !== 1 || summary.ok !== 1) {
    fail(`self-test failed: bad summary ${JSON.stringify(summary)}`)
  }
  const text = renderEvidence({ projectId: 'PR-00001', gate: 'G6', generatedAt: '2026-07-14T00:00:00.000Z', summary, checks }, [], 'self-test')
  if (!text.includes('Gate Evidence') || !text.includes('SELFTEST-FAIL') || !text.includes('Command Evidence')) {
    fail('self-test failed: evidence renderer missing required sections')
  }
  if (formatEvidenceRunId('2026-07-14T12:34:56.000Z', 'G6') !== '2026-07-14-123456-g6') {
    fail('self-test failed: evidence run id format drifted')
  }
  const commandSummary = summarizeCommand({ label: 'self', result: { status: 0, ok: true, startedAt: '2026-07-14T00:00:00.000Z', finishedAt: '2026-07-14T00:00:01.000Z' } })
  if (commandSummary.label !== 'self' || commandSummary.status !== 0 || !commandSummary.ok || !commandSummary.startedAt || !commandSummary.finishedAt) {
    fail('self-test failed: command summary missing required fields')
  }
  const payload = { commands: [] }
  const commands = [
    { label: 'verify-project-gate PR-00001 G8', result: { status: 0, ok: true, startedAt: '2026-07-14T00:00:00.000Z' } },
    { label: 'update-project-index --write', result: { status: 0, ok: true, startedAt: '2026-07-14T00:00:01.000Z' } },
  ]
  syncCommandSummary(payload, commands)
  if (payload.commands.length !== 2 || payload.commands[1].label !== 'update-project-index --write') {
    fail('self-test failed: refresh-index command summary not synced')
  }
  if (derivePayloadOk({ ok: true }, { fail: 0 }, false)) {
    fail('self-test failed: verify-code-rules failure must block payload.ok')
  }
  // 机器事实层守卫：G5 不要求、G6 起要求；跳过必须留痕，输出不可解析必须报 error。
  const guardCases = [
    { name: 'G5 不要求', input: { gate: 'G5', required: false, skipped: false, reason: '', run: null, parsed: null }, expect: null },
    { name: 'G6 无理由跳过', input: { gate: 'G6', required: true, skipped: true, reason: '', run: null, parsed: null }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 有理由跳过', input: { gate: 'G6', required: true, skipped: true, reason: '离线环境无依赖', run: null, parsed: null }, expect: { ok: false, severity: 'warn' } },
    { name: 'G6 应跑未跑', input: { gate: 'G6', required: true, skipped: false, reason: '', run: null, parsed: null }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 输出不可解析', input: { gate: 'G6', required: true, skipped: false, reason: '', run: { status: 1 }, parsed: { ok: false, parseError: 'Unexpected token' } }, expect: { ok: false, severity: 'error' } },
    { name: 'G6 正常实跑', input: { gate: 'G6', required: true, skipped: false, reason: '', run: { status: 0 }, parsed: { ok: true, checks: [{ ruleId: 'VERIFY-BIOME-001', ok: true }] } }, expect: { ok: true, severity: 'error' } },
  ]
  for (const guardCase of guardCases) {
    const actual = buildQualityGuardCheck(guardCase.input)
    if (guardCase.expect === null) {
      if (actual !== null) fail(`self-test failed: build-quality guard should be silent (${guardCase.name})`)
      continue
    }
    if (!actual || actual.ok !== guardCase.expect.ok || actual.severity !== guardCase.expect.severity) {
      fail(`self-test failed: build-quality guard verdict drifted (${guardCase.name}): ${JSON.stringify(actual)}`)
    }
    if (actual.ruleId !== 'VERIFY-BUILD-001') fail(`self-test failed: build-quality guard rule id drifted (${guardCase.name})`)
  }
  if (!buildQualityCell({ required: false }).includes('不要求')) fail('self-test failed: build-quality cell must state 不要求 when gate is below G6')
  if (!buildQualityCell({ required: true, skipped: true, reason: 'x' }).includes('已跳过')) fail('self-test failed: build-quality cell must surface skip state')
  if (!buildQualityCell({ required: true, skipped: false, ok: false, checkCount: 5 }).includes('FAIL')) fail('self-test failed: build-quality cell must surface FAIL')
  if (!shouldUseGateCache({ isWrite: false, isNoCache: false, cacheExists: true, cachedOk: true })) {
    fail('self-test failed: reusable PASS cache was rejected')
  }
  for (const cacheCase of [
    { isWrite: true, isNoCache: false, cacheExists: true, cachedOk: true },
    { isWrite: false, isNoCache: true, cacheExists: true, cachedOk: true },
    { isWrite: false, isNoCache: false, cacheExists: true, cachedOk: false },
    { isWrite: false, isNoCache: false, cacheExists: false, cachedOk: true },
  ]) {
    if (shouldUseGateCache(cacheCase)) fail(`self-test failed: unsafe cache accepted ${JSON.stringify(cacheCase)}`)
  }
  console.log('PASS run-project-gate renderer')
}

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '') || !/^G[0-8]$/.test(gate)) usage()
if (skipCodeRules && strictCodeRuleGates.includes(gate) && !skipCodeRulesReason) {
  fail('--skip-code-rules-reason is required when using --skip-code-rules for G6/G7/G8')
}

const releaseCheck = spawnSync(process.execPath, [join(scriptDir, 'rule-release.mjs'), '--check', '--json'], {
  cwd: callerCwd,
  encoding: 'utf8',
  stdio: 'pipe',
})
if (releaseCheck.status !== 0) {
  process.stderr.write(releaseCheck.stderr || releaseCheck.stdout)
  fail('published rule release is missing or stale')
}

const effectiveRulesCheck = spawnSync(process.execPath, [join(scriptDir, 'effective-rules.mjs'), '--check', '--json'], {
  cwd: callerCwd,
  encoding: 'utf8',
  stdio: 'pipe',
})
if (effectiveRulesCheck.status !== 0) {
  process.stderr.write(effectiveRulesCheck.stderr || effectiveRulesCheck.stdout)
  fail('effective rules release is missing or stale')
}

const projectDir = resolveProjectRoot(projectId)
if (!existsSync(projectDir)) fail(`project directory does not exist: ${relative(repoRoot, projectDir)}`)
const cacheFingerprint = gateCacheFingerprint(projectDir)
const cacheDir = join(tmpdir(), 'docs-tdd-gate-cache')
const cacheFile = join(cacheDir, `${projectId}-${gate}-${cacheFingerprint}.json`)
const cached = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null
if (shouldUseGateCache({ isWrite: write, isNoCache: noCache, cacheExists: Boolean(cached), cachedOk: cached?.ok })) {
  if (json) console.log(JSON.stringify({ ...cached, cache: { hit: true, fingerprint: cacheFingerprint } }, null, 2))
  else console.log(`run-project-gate: ${projectId} ${gate} — PASS (cache=hit, fingerprint=${cacheFingerprint})`)
  process.exit(0)
}

const reviewer = readOption('--reviewer', process.env.USER || 'local')
const gateRun = run([join(scriptDir, 'verify-project-gate.mjs'), projectId, gate, '--json'])
persistRunLog(`verify-project-gate-${gate}`, gateRun)
const gateResult = parseJsonOutput(gateRun)
const commands = [
  { label: `verify-project-gate ${projectId} ${gate}`, target: '项目 gate', result: gateRun },
]

let codeRulesRun = null
let codeRulesResult = null
if (!skipCodeRules && codeRuleGates.includes(gate)) {
  codeRulesRun = run([join(scriptDir, 'verify-code-rules.mjs'), '--project', projectId, '--json'])
  persistRunLog('verify-code-rules', codeRulesRun)
  codeRulesResult = parseJsonOutput(codeRulesRun)
  commands.push({ label: `verify-code-rules --project ${projectId}`, target: '责任模块 / 改动文件', result: codeRulesRun })
}

// 机器事实层：真跑 biome/tsc/vitest。它的 checks 直接并入 payload.checks，
// 因此 summary/证据表/warn 台账/BLOCK 判定全部复用既有链路，不需要第二套结论口径。
let buildQualityRun = null
let buildQualityResult = null
if (!skipBuildQuality && buildQualityGates.includes(gate)) {
  buildQualityRun = run([join(scriptDir, 'verify-build-quality.mjs'), '--project', projectId, '--json', ...(gate === 'G8' ? ['--production-build'] : [])])
  persistRunLog('verify-build-quality', buildQualityRun)
  buildQualityResult = parseJsonOutput(buildQualityRun)
  commands.push({ label: `verify-build-quality --project ${projectId}`, target: 'biome / tsc / vitest 实跑', result: buildQualityRun })
}

const buildQualityChecks = Array.isArray(buildQualityResult?.checks) ? buildQualityResult.checks : []
// 子脚本被跳过或输出无法解析时，不允许静默当成「没有这一层」——补一条显式失败的 check。
const buildQualityGuard = buildQualityGuardCheck({
  gate,
  required: buildQualityGates.includes(gate),
  skipped: skipBuildQuality,
  reason: skipBuildQualityReason,
  run: buildQualityRun,
  parsed: buildQualityResult,
})
const allChecks = [...(gateResult.checks || []), ...buildQualityChecks, ...(buildQualityGuard ? [buildQualityGuard] : [])]
const summary = summarizeChecks(allChecks)

const codeRulesOk = !codeRulesRun || (codeRulesRun.ok && codeRulesResult?.ok !== false)
const payload = {
  generatedAt: new Date().toISOString(),
  tool: 'run-project-gate.mjs',
  projectId,
  gate,
  ok: derivePayloadOk(gateResult, summary, codeRulesOk),
  summary,
  groups: gateResult.groups || {},
  checks: allChecks,
  commands: commands.map(summarizeCommand),
  codeRules: {
    required: codeRuleGates.includes(gate),
    skipped: skipCodeRules,
    reason: skipCodeRules ? skipCodeRulesReason : '',
    ok: codeRulesOk,
  },
  buildQuality: {
    required: buildQualityGates.includes(gate),
    skipped: skipBuildQuality,
    reason: skipBuildQuality ? skipBuildQualityReason : '',
    ok: buildQualityGuard ? buildQualityGuard.ok && buildQualityResult?.ok !== false : true,
    checkCount: buildQualityChecks.length,
    baselineFile: buildQualityResult?.baselineFile || null,
  },
  source: {
    gateCommand: gateRun.command,
    parseError: gateResult.parseError || null,
    codeRulesCommand: codeRulesRun?.command || null,
    codeRulesParseError: codeRulesResult?.parseError || null,
    buildQualityCommand: buildQualityRun?.command || null,
    buildQualityParseError: buildQualityResult?.parseError || null,
  },
  fingerprint: createFingerprint(),
  cache: { hit: false, fingerprint: cacheFingerprint },
}
syncCommandSummary(payload, commands)

const evidenceRunId = formatEvidenceRunId(payload.generatedAt, gate)
if (write) {
  const agentDir = join(projectDir, 'agent')
  const evidenceDir = join(projectDir, 'evidence', 'gate', evidenceRunId)
  mkdirSync(agentDir, { recursive: true })
  mkdirSync(evidenceDir, { recursive: true })
  const gateResultsFile = join(agentDir, 'gate-results.json')
  const evidenceFile = join(evidenceDir, 'README.md')
  // 成功历史必须先于阶段同步落盘；set-project-stage 只消费已存在的同阶段 PASS 历史。
  // 这样手工调用 set-project-stage 或 runner 中途失败都不能凭空推进阶段。
  if (payload.ok) {
    writeFileSync(evidenceFile, renderEvidence(payload, commands, reviewer))
    appendGateHistory(projectDir, payload, evidenceFile)
  }
  // 阶段同步是 gate 通过后的默认动作：set-project-stage 写 README 机器行、重写机器版 context-summary 并刷新索引。
  // gate 未通过时仍要刷索引（PROJECTS.md 的 Latest gate 列需反映 BLOCK）；--no-refresh-index 可整体关闭。
  // 同步失败不翻转 gate 结论，但会留在 Command Evidence 表和 stderr，防止阶段真值悄悄漂移。
  if (!noRefreshIndex) {
    if (payload.ok) {
      const stageRun = run([join(scriptDir, 'set-project-stage.mjs'), projectId, gate])
      persistRunLog('set-project-stage', stageRun)
      commands.push({ label: `set-project-stage ${projectId} ${gate}`, target: 'README 机器行 / context-summary / PROJECTS.md', result: stageRun })
      payload.stageSync = { attempted: true, ok: stageRun.ok }
      if (!stageRun.ok) {
        console.error('run-project-gate: ⚠ gate 结论不变，但阶段同步失败，请按上面 set-project-stage 输出手工排查')
      }
    } else {
      const indexRun = run([join(scriptDir, 'update-project-index.mjs'), '--write'])
      persistRunLog('update-project-index', indexRun)
      commands.push({ label: 'update-project-index --write', target: 'PROJECTS.md', result: indexRun })
      payload.stageSync = { attempted: false, ok: false }
    }
  } else {
    payload.stageSync = { attempted: false, ok: false }
  }
  syncCommandSummary(payload, commands)
  writeFileSync(gateResultsFile, `${JSON.stringify(payload, null, 2)}\n`)
  writeFileSync(evidenceFile, renderEvidence(payload, commands, reviewer))
  // G8 交付摘要的机器段：必须在 gate-results.json 落盘之后渲染（渲染器消费它的 checks/commands/buildQuality）。
  // 人交出去的那份摘要里，「跑了什么、退出码多少、还欠什么」由机器写，Agent 只补机器判不了的口径。
  if (gate === 'G8') {
    const summaryRun = run([join(scriptDir, 'render-delivery-summary.mjs'), '--project', projectId, '--write'])
    persistRunLog('render-delivery-summary', summaryRun)
    commands.push({ label: `render-delivery-summary --project ${projectId} --write`, target: 'agent/delivery-summary.machine.md', result: summaryRun })
    payload.deliverySummary = { attempted: true, ok: summaryRun.ok, file: 'agent/delivery-summary.machine.md' }
    syncCommandSummary(payload, commands)
    writeFileSync(gateResultsFile, `${JSON.stringify(payload, null, 2)}\n`)
    writeFileSync(evidenceFile, renderEvidence(payload, commands, reviewer))
  }
  // warn-first 晋级台账：把本 PR 命中的可晋级 warn 规则自动入账（verdict 默认 unreviewed，
  // 人工用 warn-ledger --mark 复核，warn-ledger --report 看晋级候选）。无论 gate PASS/BLOCK 都记录。
  if (codeRulesResult?.findings?.length) {
    const ledger = loadLedger()
    const { recorded } = recordFindings(ledger, { projectId, fingerprint: payload.fingerprint.headSha, at: payload.generatedAt.slice(0, 10), findings: codeRulesResult.findings })
    if (recorded.length) {
      saveLedger(ledger, payload.generatedAt)
      console.error(`run-project-gate: warn-ledger 已记录 ${projectId} 命中 ${recorded.join(', ')}（warn-ledger --report 查晋级候选）`)
    }
  }
}

if (payload.ok && !write && !noCache) {
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, `${JSON.stringify(payload, null, 2)}\n`)
}

if (json) {
  console.log(JSON.stringify({ ...payload, commands: commands.map(summarizeCommand) }, null, 2))
} else {
  const groupText = payload.groups?.documentation && payload.groups?.implementation
    ? `; documentation=${payload.groups.documentation.ok}/${payload.groups.documentation.total}; implementation=${payload.groups.implementation.ok}/${payload.groups.implementation.total}`
    : ''
  console.log(`run-project-gate: ${projectId} ${gate} — ${payload.ok ? 'PASS' : 'BLOCK'} (fail=${summary.fail}, warn=${summary.warn}, waived=${summary.waived}${groupText})`)
  if (!gateRun.ok) printFailureSummary(`verify-project-gate ${projectId} ${gate}`, gateRun, gateResult)
  if (codeRulesRun && !codeRulesRun.ok) printFailureSummary(`verify-code-rules --project ${projectId}`, codeRulesRun, codeRulesResult)
  for (const item of commands.slice(2).filter(({ result }) => !result.ok)) printFailureSummary(item.label, item.result, null)
  if (write) {
    console.log(`wrote ${relative(repoRoot, join(projectDir, 'agent/gate-results.json'))}`)
    console.log(`wrote ${relative(repoRoot, join(projectDir, 'evidence/gate', evidenceRunId, 'README.md'))}`)
  }
}

process.exit(payload.ok ? 0 : 1)
