#!/usr/bin/env node

// Run a project gate, persist machine-readable results, and write a reviewable evidence README.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendGateHistory, createFingerprint, gateCacheFingerprint } from './lib/gate-cache.mjs'
import { formatEvidenceRunId, renderEvidence, summarizeCommand } from './lib/gate-evidence.mjs'
import { buildQualityGuardCheck, derivePayloadOk, parseJsonOutput, selfTest, shouldUseGateCache, summarizeChecks, syncCommandSummary } from './lib/gate-payload.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { requireRuleSession } from './lib/rule-session-runtime.mjs'
import { persistRunLog as persistRunLogRaw, printFailureSummary, run } from './lib/run-log.mjs'
import { loadLedger, recordFindings, saveLedger } from './warn-ledger.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
// 子 gate 的 GIT-G4 检查要认「agent 正在编码的 worktree 分支」，靠 verify-project-gate 内部的 process.cwd()。
// 但本聚合器经 symlink 解析出的 repoRoot 恒指向主仓（常停在 dev），若用它当子进程 cwd，会把子脚本
// 的 worktree 定位拽回主仓、误判 GIT-G4-001。所以 spawn 子 gate 时传调用者的真实 cwd（agent 所在 worktree）。
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

// 子进程日志按项目号归档，便于失败后翻全量。
const persistRunLog = (label, runResult) => persistRunLogRaw(label, runResult, projectId || 'unknown')

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '') || !/^G[0-8]$/.test(gate)) usage()
if (skipCodeRules && strictCodeRuleGates.includes(gate) && !skipCodeRulesReason) {
  fail('--skip-code-rules-reason is required when using --skip-code-rules for G6/G7/G8')
}

// 重构期临时开关：DOCS_TDD_SKIP_RULE_FRESHNESS=1 跳过规则发布/生效新鲜度硬闸
// （改脚本会让指纹链失效、每次都要重发布，重构期很烦）。稳定后不设此 env 即恢复严格模式。
const skipRuleFreshness = process.env.DOCS_TDD_SKIP_RULE_FRESHNESS === '1'
if (skipRuleFreshness) {
  console.error('[run-project-gate] ⚠ DOCS_TDD_SKIP_RULE_FRESHNESS=1：已跳过规则发布/生效新鲜度检查（重构期临时开关，稳定后移除该 env）')
} else {
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
}

const projectDir = resolveProjectRoot(projectId)
if (!existsSync(projectDir)) fail(`project directory does not exist: ${relative(repoRoot, projectDir)}`)
if (codeRuleGates.includes(gate)) {
  const release = JSON.parse(readFileSync(join(docsRoot, 'common/rule-release.json'), 'utf8'))
  const effectiveRules = JSON.parse(readFileSync(join(docsRoot, 'common/effective-rules.json'), 'utf8'))
  if (!requireRuleSession(projectId, callerCwd, { currentFingerprint: release.fingerprint }, { currentFingerprint: effectiveRules.fingerprint })) {
    fail(`rerun docs-tdd context ${projectId} <coding-scenario>`)
  }
}
const fingerprintCtx = { projectId, gate, callerCwd, config, docsRoot }
const cacheFingerprint = gateCacheFingerprint(projectDir, fingerprintCtx)
const cacheDir = join(tmpdir(), 'docs-tdd-gate-cache')
const cacheFile = join(cacheDir, `${projectId}-${gate}-${cacheFingerprint}.json`)
const cached = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : null
if (
  shouldUseGateCache({
    isWrite: write,
    isNoCache: noCache,
    cacheExists: Boolean(cached),
    cachedOk: cached?.ok,
  })
) {
  if (json) console.log(JSON.stringify({ ...cached, cache: { hit: true, fingerprint: cacheFingerprint } }, null, 2))
  else console.log(`run-project-gate: ${projectId} ${gate} — PASS (cache=hit, fingerprint=${cacheFingerprint})`)
  process.exit(0)
}

const reviewer = readOption('--reviewer', process.env.USER || 'local')
const gateRun = run([join(scriptDir, 'verify-project-gate.mjs'), projectId, gate, '--json'])
persistRunLog(`verify-project-gate-${gate}`, gateRun)
const gateResult = parseJsonOutput(gateRun)
const commands = [
  {
    label: `verify-project-gate ${projectId} ${gate}`,
    target: '项目 gate',
    result: gateRun,
  },
]

let codeRulesRun = null
let codeRulesResult = null
if (!skipCodeRules && codeRuleGates.includes(gate)) {
  codeRulesRun = run([join(scriptDir, 'verify-code-rules.mjs'), '--project', projectId, '--json'])
  persistRunLog('verify-code-rules', codeRulesRun)
  codeRulesResult = parseJsonOutput(codeRulesRun)
  commands.push({
    label: `verify-code-rules --project ${projectId}`,
    target: '责任模块 / 改动文件',
    result: codeRulesRun,
  })
}

// 机器事实层：真跑 biome/tsc/vitest。它的 checks 直接并入 payload.checks，
// 因此 summary/证据表/warn 台账/BLOCK 判定全部复用既有链路，不需要第二套结论口径。
let buildQualityRun = null
let buildQualityResult = null
if (!skipBuildQuality && buildQualityGates.includes(gate)) {
  buildQualityRun = run([join(scriptDir, 'verify-build-quality.mjs'), '--project', projectId, '--json', ...(gate === 'G8' ? ['--production-build'] : [])])
  persistRunLog('verify-build-quality', buildQualityRun)
  buildQualityResult = parseJsonOutput(buildQualityRun)
  commands.push({
    label: `verify-build-quality --project ${projectId}`,
    target: 'biome / tsc / vitest 实跑',
    result: buildQualityRun,
  })
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
  fingerprint: createFingerprint({ callerCwd, config, docsRoot }),
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
  if (payload.ok) {
    writeFileSync(evidenceFile, renderEvidence(payload, commands, reviewer))
    appendGateHistory(projectDir, payload, evidenceFile, {
      repoRoot,
      onError: fail,
    })
  }
  // 阶段同步是 gate 通过后的默认动作；gate 未通过时仍刷索引（PROJECTS.md 的 Latest gate 列需反映 BLOCK）。
  // 同步失败不翻转 gate 结论，但会留在 Command Evidence 表和 stderr，防止阶段真值悄悄漂移。
  if (!noRefreshIndex) {
    if (payload.ok) {
      const stageRun = run([join(scriptDir, 'set-project-stage.mjs'), projectId, gate])
      persistRunLog('set-project-stage', stageRun)
      commands.push({
        label: `set-project-stage ${projectId} ${gate}`,
        target: 'README 机器行 / context-summary / PROJECTS.md',
        result: stageRun,
      })
      payload.stageSync = { attempted: true, ok: stageRun.ok }
      if (!stageRun.ok) {
        console.error('run-project-gate: ⚠ gate 结论不变，但阶段同步失败，请按上面 set-project-stage 输出手工排查')
      }
    } else {
      const indexRun = run([join(scriptDir, 'update-project-index.mjs'), '--write'])
      persistRunLog('update-project-index', indexRun)
      commands.push({
        label: 'update-project-index --write',
        target: 'PROJECTS.md',
        result: indexRun,
      })
      payload.stageSync = { attempted: false, ok: false }
    }
  } else {
    payload.stageSync = { attempted: false, ok: false }
  }
  syncCommandSummary(payload, commands)
  writeFileSync(gateResultsFile, `${JSON.stringify(payload, null, 2)}\n`)
  writeFileSync(evidenceFile, renderEvidence(payload, commands, reviewer))
  // G8 交付摘要的机器段：必须在 gate-results.json 落盘之后渲染（渲染器消费它的 checks/commands/buildQuality）。
  if (gate === 'G8') {
    const summaryRun = run([join(scriptDir, 'render-delivery-summary.mjs'), '--project', projectId, '--write'])
    persistRunLog('render-delivery-summary', summaryRun)
    commands.push({
      label: `render-delivery-summary --project ${projectId} --write`,
      target: 'agent/delivery-summary.machine.md',
      result: summaryRun,
    })
    payload.deliverySummary = {
      attempted: true,
      ok: summaryRun.ok,
      file: 'agent/delivery-summary.machine.md',
    }
    syncCommandSummary(payload, commands)
    writeFileSync(gateResultsFile, `${JSON.stringify(payload, null, 2)}\n`)
    writeFileSync(evidenceFile, renderEvidence(payload, commands, reviewer))
  }
  // warn-first 晋级台账：把本 PR 命中的可晋级 warn 规则自动入账。无论 gate PASS/BLOCK 都记录。
  if (codeRulesResult?.findings?.length) {
    const ledger = loadLedger()
    const { recorded } = recordFindings(ledger, {
      projectId,
      fingerprint: payload.fingerprint.headSha,
      at: payload.generatedAt.slice(0, 10),
      findings: codeRulesResult.findings,
    })
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
  const groupText = payload.groups?.documentation && payload.groups?.implementation ? `; documentation=${payload.groups.documentation.ok}/${payload.groups.documentation.total}; implementation=${payload.groups.implementation.ok}/${payload.groups.implementation.total}` : ''
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
