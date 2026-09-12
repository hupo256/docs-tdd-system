#!/usr/bin/env node

/**
 * docs_tdd 统一 CLI 入口。本文件只做「参数解析 + 命令分发 + 前置闸」，不含业务逻辑；各命令的实质
 * 都在同级脚本或 lib/ 里，随各自职责增长而不撑大这个路由：
 *   · lib/context-pack          场景引用展开 / section 切片 / context pack 物化 / 发布新鲜度闸 / printContextPack
 *   · lib/changed-detection     `changed`（指纹缓存 + 子检）与 `recommend`（改动文件 → 场景推荐）
 *   · lib/project-status-report `capability` 体检报告 + worktree 解析
 *   · lib/gate-heartbeat        gate 心跳提醒 + 通过后播报
 *   · lib/rule-session*         编码 rule session v2 的写入与校验
 *   · project-orchestrator.mjs  kickoff/status/resume/next（阶段编排）
 *   · run-project-gate.mjs      gate 正式落证据；verify-* / golden-run / publish-* 各自的机器判定
 *
 * 逐字段 console.log 已收敛：状态报告在 project-status-report、context 指标在 context-pack（都经 lib/cli-report）。
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recommendScenarios, runChanged } from './lib/changed-detection.mjs'
import { printReport } from './lib/cli-report.mjs'
import { createContextPack, enforceContextBudget, expandScenarioRefs, printContextDelta, printContextPack, requireFreshEffectiveRules, requireFreshRuleRelease } from './lib/context-pack.mjs'
import { contextBudgetFor, coordinatorSteps, resolveContextMode, validateContextPolicy } from './lib/context-policy.mjs'
import { findDeliveredPack, loadContextDeliveryLedger, recordContextDelivery, resolveContextSessionId } from './lib/context-session.mjs'
import { explainRule } from './lib/explain-rule.mjs'
import { G6_CONTEXT_SCENARIOS, loadG6ContextSession, nextG6ContextScenario, printG6ContextPlan, recordG6Context, sameG6ContextBinding } from './lib/g6-context-session.mjs'
import { createFingerprint } from './lib/gate-cache.mjs'
import { maybeBroadcastGate, printGateHeartbeat } from './lib/gate-heartbeat.mjs'
import { capability, requireProjectWorktree, resolveProjectWorktree } from './lib/project-status-report.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { resolveRuleSessionClient } from './lib/rule-session.mjs'
import { latestReleasePin, resolveRulePin, upgradeRulePin } from './lib/rule-pin.mjs'
import { stableFingerprint } from './lib/vnext-work-item.mjs'
import { workflowVersionForProject } from './lib/workflow-version.mjs'
import { CODING_SCENARIOS, requireRuleSession, verifyG2Ready, writeRuleSession } from './lib/rule-session-runtime.mjs'
import { runRuleContextProbe } from './rule-context-probe.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree, config } = resolveRoots()
const executionRoot = consumerWorktree && consumerWorktree !== docsRoot ? consumerWorktree : repoRoot
const releaseScript = join(scriptDir, 'rule-release.mjs')
const effectiveRulesScript = join(scriptDir, 'effective-rules.mjs')
const cliArgs = process.argv.slice(2)
const [command, projectId] = cliArgs
const commandArgs = cliArgs.slice(2)
const clientIndex = commandArgs.indexOf('--client')
if (clientIndex >= 0 && !commandArgs[clientIndex + 1]) {
  console.error('--client requires one of: codex, claude, cursor, pi, human')
  process.exit(1)
}
const sessionIndex = commandArgs.indexOf('--session-id')
if (sessionIndex >= 0 && !commandArgs[sessionIndex + 1]) {
  console.error('--session-id requires a non-empty task/session identifier')
  process.exit(1)
}
const modelIndex = commandArgs.indexOf('--model')
if (modelIndex >= 0 && !commandArgs[modelIndex + 1]) {
  console.error('--model requires a model name')
  process.exit(1)
}
let agentClient
try {
  agentClient = resolveRuleSessionClient({
    requested: clientIndex >= 0 ? commandArgs[clientIndex + 1] : undefined,
  })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
let contextSessionId
try {
  contextSessionId = resolveContextSessionId({
    requested: sessionIndex >= 0 ? commandArgs[sessionIndex + 1] : undefined,
  })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const valueOptions = new Set(['--client', '--session-id', '--target', '--model', '--input', '--plan', '--out', '--worktree', '--session', '--evidence', '--surfaces'])
const positional = commandArgs.filter((arg, index) => !arg.startsWith('--') && !valueOptions.has(commandArgs[index - 1]))
const detail = positional[0]
const noCache = cliArgs.includes('--no-cache')
// --partial：G6 部分验收（G5 停靠态出口）。必须在此显式透传给 run-project-gate.mjs——
// 否则公共入口跑的是普通 G6，用户以为做了部分验收、实际被 G5 前置挡下（真机漏传缺陷修复）。
const partial = cliArgs.includes('--partial')

// 子进程直通（stdio inherit）：分发到同级脚本时复用，退出码原样上抛。
function run(args, cwd = executionRoot) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' })
  return result.status ?? 1
}

function safeV2Worktree(id, args) {
  const worktreeIndex = args.indexOf('--worktree')
  const requestedWorktree = worktreeIndex >= 0 && args[worktreeIndex + 1] ? resolve(args[worktreeIndex + 1]) : ''
  try {
    return requireProjectWorktree(id, { requestedWorktree })
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

if (process.argv.includes('--self-test')) {
  // 纯判定（section 切片 / scenario 展开 / gate 心跳）已随抽出的 lib 各自 --self-test，此处不重复；
  // 本文件的自测只守它作为**分发器**的独有关切：resolveRoots + readJson 能对真实规则数据接上、且
  // 关键索引结构（ruleset 版本/成熟度、rule-index 场景表）不为空。逻辑覆盖见各 lib 的 --self-test。
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  if (!ruleset.version || !ruleset.maturity) process.exit(1)
  const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
  if (!Array.isArray(index.scenarios?.write_mapper) || index.scenarios.write_mapper.length === 0) process.exit(1)
  assert.deepEqual(validateContextPolicy(index, { codingScenarios: CODING_SCENARIOS }), [])
  assert.deepEqual(coordinatorSteps(index, 'g6_verify'), G6_CONTEXT_SCENARIOS)
  assert(expandScenarioRefs(index, 'g6_code_review').some((ref) => ref.file === 'quality-checklist.md'))
  console.log('docs-tdd self-test passed.')
  process.exit(0)
}

if (command === 'capability') {
  capability(projectId, { agentClient })
  process.exit(0)
}

if (command === 'probe') {
  if (!projectId || !/^PR-\d+$/.test(projectId)) {
    console.error('Usage: docs-tdd probe PR-XXXXX --client codex|claude|pi [--target path]')
    process.exit(1)
  }
  if (!['codex', 'claude', 'pi'].includes(agentClient)) {
    console.error('probe requires --client codex, claude, or pi')
    process.exit(1)
  }
  const targetIndex = commandArgs.indexOf('--target')
  const target = targetIndex >= 0 ? commandArgs[targetIndex + 1] : undefined
  const { worktree } = resolveProjectWorktree(projectId)
  const result = runRuleContextProbe({ client: agentClient, worktree, ...(target ? { target } : {}) })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

if (command === 'doctor') {
  const doctorFlags = commandArgs.filter((arg) => ['--json', '--allow-tracked-rule-changes', '--strict'].includes(arg))
  process.exit(run([effectiveRulesScript, '--doctor', ...doctorFlags]))
}

if (command === 'release') {
  process.exit(run([join(scriptDir, 'publish-rule-chain.mjs'), ...cliArgs.slice(1)]))
}

// golden 不针对具体项目：它用保留夹具 PR-00000 回归 gate 机器自己，所以必须在项目 ID 校验之前分流。
if (command === 'golden') {
  process.exit(run([join(scriptDir, 'golden-run.mjs'), ...cliArgs.slice(1)]))
}

// guard：机器层兜底守护，一条命令串跑三检——发布是否 fresh、gate 机器自身能否回归、三端规则加载/冲突。
// project-agnostic，手动/按需运行（不装 launchd/cron；个人本地，机器层正确性不再只靠"每次记得跑"）。
if (command === 'guard') {
  const strict = commandArgs.includes('--strict')
  const allowTrackedRuleChanges = commandArgs.includes('--allow-tracked-rule-changes')
  let worst = 0
  const step = (label, args) => {
    console.log(`\n=== docs-tdd guard: ${label} ===`)
    const code = run(args)
    if (code !== 0) worst = code
    return code
  }
  // 先查发布 fresh：stale 时 golden 的聚合器烟测跑不了（run-project-gate 拒 stale 指纹链），
  // 据此决定是否给 golden 传 --skip-aggregator，而不是伪装通过。stale 本身即 worst≠0，guard 会判 BLOCK。
  const releaseFresh = step('rule-release --check', [releaseScript, '--check']) === 0
  step('golden-run', [join(scriptDir, 'golden-run.mjs'), ...(releaseFresh ? [] : ['--skip-aggregator'])])
  step(`doctor (effective-rules${strict ? ', strict' : ''})`, [
    effectiveRulesScript,
    '--doctor',
    ...(strict ? ['--strict'] : []),
    ...(allowTrackedRuleChanges ? ['--allow-tracked-rule-changes'] : []),
  ])
  console.log(`\ndocs-tdd guard${strict ? ' --strict' : ''}: ${worst === 0 ? 'PASS — 机器层回归/发布/加载三检通过' : 'BLOCK — 见上方失败项'}`)
  process.exit(worst)
}

// rule-health 也不针对具体项目：它盘的是规则本身（命中分布 / warn 台账年龄 / 待退休 / 零命中），
// 是 rule-execution-model.md §6 那条「定期规则体检」的机器入口，故同样在项目 ID 校验之前分流。
if (command === 'rule-health') {
  process.exit(run([join(scriptDir, 'warn-ledger.mjs'), '--health', ...cliArgs.slice(1)]))
}

// explain 也不针对具体项目：按 RULE-ID 定向切出台账与修复指引（配合 brief 模式，门禁失败才按需展开）。
if (command === 'explain') {
  process.exit(explainRule(projectId))
}

// rules status|upgrade <PR>：项目级规则版本 pin 的查看/显式升级。子命令在 projectId 槽（cliArgs[1]），
// 目标 PR 在 detail（cliArgs[2]）。upgrade 只影响该项目：搬 pin 到最新发布、作废其 rule-session /
// g6-context-session、清该项目 gate cache，要求重跑 context。别的项目仍钉旧版。
if (command === 'rules') {
  const subcommand = projectId
  const targetPr = detail
  const idPattern = new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`)
  if (!['status', 'upgrade'].includes(subcommand) || !idPattern.test(targetPr || '')) {
    console.error('usage: docs-tdd.mjs rules <status|upgrade> PR-01234')
    process.exit(1)
  }
  const latest = latestReleasePin()
  if (subcommand === 'status') {
    const pin = resolveRulePin(targetPr, { persist: false })
    const upToDate = pin.policyFingerprint === latest.policyFingerprint
    printReport([
      ['project', targetPr],
      ['pinned policy', `${(pin.policyFingerprint || 'unpinned').slice(0, 12)}${pin.commit ? ` @ ${pin.commit.slice(0, 12)}` : ''}`],
      ['pin source', pin.source],
      ['upgrade mode', pin.upgradeMode || 'explicit'],
      ['latest policy', `${(latest.policyFingerprint || 'unknown').slice(0, 12)}${latest.commit ? ` @ ${latest.commit.slice(0, 12)}` : ''}`],
      ['status', upToDate ? 'up to date' : 'newer rules available — run docs-tdd rules upgrade to adopt'],
    ])
    process.exit(0)
  }
  // upgrade
  const { previous, next } = upgradeRulePin(targetPr)
  const projectRoot = resolveProjectRoot(targetPr)
  for (const rel of ['agent/rule-session.json', 'agent/g6-context-session.json']) {
    const file = join(projectRoot, rel)
    if (existsSync(file)) rmSync(file)
  }
  const cacheDir = join(tmpdir(), 'docs-tdd-gate-cache')
  let clearedCache = 0
  if (existsSync(cacheDir)) {
    for (const entry of readdirSync(cacheDir)) {
      if (entry.startsWith(`${targetPr}-`)) {
        rmSync(join(cacheDir, entry))
        clearedCache += 1
      }
    }
  }
  printReport([
    ['project', targetPr],
    ['previous policy', previous?.policyFingerprint ? `${previous.policyFingerprint.slice(0, 12)}${previous.commit ? ` @ ${previous.commit.slice(0, 12)}` : ''}` : 'unpinned'],
    ['new policy', `${next.policyFingerprint.slice(0, 12)}${next.commit ? ` @ ${next.commit.slice(0, 12)}` : ''}`],
    ['invalidated', 'rule-session + g6-context-session'],
    ['gate cache cleared', `${clearedCache} entr${clearedCache === 1 ? 'y' : 'ies'}`],
    ['next step', `run docs-tdd context ${targetPr} <coding-scenario> before editing or gating`],
  ])
  process.exit(0)
}

if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '')) {
  console.error('usage: docs-tdd.mjs <run|kickoff|status|resume|next|source-update|source-sync|extract|scope-approval|scope-approve|review|review-adjudicate|review-resume|checkpoint|worktree-prepare|capability|probe|doctor|release|golden|guard|rule-health|rules|explain|check|gate|evidence|verify|context|changed|recommend> PR-01234 [G0-G8|scenario] [--input file.json] [--evidence evidence.json] [--surfaces surfaces.json] [--plan evidence-plan.json] [--out file.json] [--dry-run] [--brief|--compact|--full|--no-cache] [--client codex|claude|cursor|pi|human] [--session-id <id>] [--target path] [--model <name>]')
  process.exit(1)
}

if (['run', 'kickoff', 'status', 'resume', 'next', 'source-update', 'checkpoint'].includes(command)) {
  process.exit(run([join(scriptDir, 'project-orchestrator.mjs'), command, projectId, ...cliArgs.slice(2)]))
}

const projectWorkflowVersion = workflowVersionForProject(projectId, { resolveProjectRoot })
if (projectWorkflowVersion === 2 && command === 'worktree-prepare') {
  process.exit(run([join(scriptDir, 'prepare-coding-worktree.mjs'), projectId, ...commandArgs], repoRoot))
}
if (projectWorkflowVersion === 2 && ['scope-approval', 'scope-approve'].includes(command)) {
  const inputIndex = commandArgs.indexOf('--input')
  const outputIndex = commandArgs.indexOf('--out')
  if (command === 'scope-approve' && (inputIndex < 0 || !commandArgs[inputIndex + 1])) {
    console.error('scope-approve requires --input <scope-approval.json>')
    process.exit(1)
  }
  if (command === 'scope-approval' && inputIndex >= 0) {
    console.error('scope-approval is read-only; use scope-approve to apply an input')
    process.exit(1)
  }
  process.exit(run([
    join(scriptDir, 'vnext-scope-approval.mjs'), '--project', resolveProjectRoot(projectId),
    ...(inputIndex >= 0 ? ['--input', resolve(commandArgs[inputIndex + 1])] : []),
    ...(outputIndex >= 0 ? ['--out', resolve(commandArgs[outputIndex + 1])] : []),
    '--client', agentClient,
    ...(contextSessionId ? ['--session-id', contextSessionId] : []),
  ], docsRoot))
}
if (projectWorkflowVersion === 2 && ['review-adjudicate', 'review-resume'].includes(command)) {
  const inputIndex = commandArgs.indexOf('--input')
  if (inputIndex < 0 || !commandArgs[inputIndex + 1]) {
    console.error(`${command} requires --input <human-review.json>`)
    process.exit(1)
  }
  process.exit(run([
    join(scriptDir, 'vnext-review-adjudicate.mjs'), '--project', resolveProjectRoot(projectId),
    '--input', resolve(commandArgs[inputIndex + 1]),
    ...(command === 'review-resume' ? ['--resume'] : []),
    '--client', agentClient,
    ...(contextSessionId ? ['--session-id', contextSessionId] : []),
  ], docsRoot))
}
if (projectWorkflowVersion === 2 && command === 'source-sync') {
  process.exit(run([
    join(scriptDir, 'vnext-source-sync.mjs'), '--project', resolveProjectRoot(projectId),
    ...(commandArgs.includes('--dry-run') ? ['--dry-run'] : []),
  ], docsRoot))
}
if (projectWorkflowVersion === 2 && command === 'extract') {
  const inputIndex = commandArgs.indexOf('--input')
  const outputIndex = commandArgs.indexOf('--out')
  if (inputIndex >= 0 && !commandArgs[inputIndex + 1]) {
    console.error('--input requires <extraction.json>')
    process.exit(1)
  }
  if (outputIndex >= 0 && !commandArgs[outputIndex + 1]) {
    console.error('--out requires <extraction.json>')
    process.exit(1)
  }
  process.exit(run([
    join(scriptDir, 'vnext-extract.mjs'), '--project', resolveProjectRoot(projectId),
    ...(inputIndex >= 0 ? ['--input', resolve(commandArgs[inputIndex + 1])] : []),
    ...(outputIndex >= 0 ? ['--out', resolve(commandArgs[outputIndex + 1])] : []),
  ], docsRoot))
}
if (projectWorkflowVersion === 2 && command === 'context') {
  const session = commandArgs.indexOf('--session')
  if (session >= 0 && !commandArgs[session + 1]) {
    console.error('--session requires <session.json>')
    process.exit(1)
  }
  process.exit(run([
    join(scriptDir, 'vnext-context.mjs'), '--project', resolveProjectRoot(projectId),
    ...(session >= 0 ? ['--session', resolve(commandArgs[session + 1])] : []),
    ...(commandArgs.includes('--json') ? ['--json'] : []),
  ]))
}
if (projectWorkflowVersion === 2 && command === 'review') {
  if (!['pi', 'claude'].includes(agentClient)) {
    console.error('v2 review requires --client pi or --client claude')
    process.exit(1)
  }
  const model = modelIndex >= 0 ? commandArgs[modelIndex + 1] : ''
  process.exit(run([
    join(scriptDir, 'vnext-review.mjs'), '--project', resolveProjectRoot(projectId), '--client', agentClient,
    ...(model ? ['--model', model] : []),
  ], docsRoot))
}
if (projectWorkflowVersion === 2 && command === 'evidence') {
  const planIndex = commandArgs.indexOf('--plan')
  if (planIndex >= 0 && !commandArgs[planIndex + 1]) {
    console.error('--plan requires <evidence-plan.json>')
    process.exit(1)
  }
  const outputIndex = commandArgs.indexOf('--out')
  if (outputIndex >= 0 && !commandArgs[outputIndex + 1]) {
    console.error('--out requires <evidence.json>')
    process.exit(1)
  }
  const worktree = safeV2Worktree(projectId, commandArgs)
  process.exit(run([
    join(scriptDir, 'vnext-evidence.mjs'), '--project', resolveProjectRoot(projectId), '--worktree', worktree, '--base', config.baseRef || 'origin/online',
    ...(planIndex >= 0 ? ['--plan', resolve(commandArgs[planIndex + 1])] : []),
    ...(outputIndex >= 0 ? ['--out', resolve(commandArgs[outputIndex + 1])] : []),
  ], docsRoot))
}
if (projectWorkflowVersion === 2 && command === 'verify') {
  if (commandArgs.includes('--shadow')) {
    console.error('docs-tdd verify is always enforced; --shadow is reserved for direct historical pilot replay')
    process.exit(1)
  }
  const inputIndex = commandArgs.indexOf('--input')
  const evidenceIndex = commandArgs.indexOf('--evidence')
  const hasInput = inputIndex >= 0 && Boolean(commandArgs[inputIndex + 1])
  const hasEvidence = evidenceIndex >= 0 && Boolean(commandArgs[evidenceIndex + 1])
  if (hasInput === hasEvidence) {
    console.error('v2 verify requires exactly one of --input <verify-input.json> or --evidence <evidence.json>')
    process.exit(1)
  }
  const projectDir = resolveProjectRoot(projectId)
  const projectWorkItemFile = join(projectDir, 'work-item.json')
  if (!existsSync(projectWorkItemFile)) {
    console.error(`canonical v2 work item is missing: ${projectWorkItemFile}`)
    process.exit(1)
  }
  const worktree = safeV2Worktree(projectId, commandArgs)
  const verifyArgs = [join(scriptDir, 'vnext-verify.mjs')]
  if (hasInput) {
    const inputFile = resolve(commandArgs[inputIndex + 1])
    const verifyInput = readJson(inputFile)
    if (verifyInput?.workItem?.projectId !== projectId) {
      console.error(`verify input projectId ${verifyInput?.workItem?.projectId || '(missing)'} does not match ${projectId}`)
      process.exit(1)
    }
    const projectWorkItem = readJson(projectWorkItemFile)
    if (stableFingerprint(verifyInput.workItem) !== stableFingerprint(projectWorkItem)) {
      console.error('verify input workItem differs from the canonical project work-item.json; refresh the input before verification')
      process.exit(1)
    }
    verifyArgs.push('--input', inputFile)
  } else {
    const surfacesIndex = commandArgs.indexOf('--surfaces')
    if (surfacesIndex >= 0 && !commandArgs[surfacesIndex + 1]) {
      console.error('--surfaces requires <surfaces.json>')
      process.exit(1)
    }
    verifyArgs.push(
      '--evidence', resolve(commandArgs[evidenceIndex + 1]),
      '--project', projectDir,
      ...(surfacesIndex >= 0 ? ['--surfaces', resolve(commandArgs[surfacesIndex + 1])] : []),
    )
  }
  verifyArgs.push(
    '--worktree', worktree,
    '--base', config.baseRef || 'origin/online',
    '--write', '--out', projectDir,
    ...(commandArgs.includes('--json') ? ['--json'] : []),
  )
  process.exit(run(verifyArgs))
}
if (projectWorkflowVersion === 2 && ['gate', 'changed'].includes(command)) {
  console.error(`${command} is a v1-only command; ${projectId} uses workflowVersion 2. Use docs-tdd verify ${projectId} --input <verify-input.json>.`)
  process.exit(1)
}
if (['source-sync', 'extract', 'scope-approval', 'scope-approve', 'review', 'review-adjudicate', 'review-resume', 'worktree-prepare', 'evidence', 'verify'].includes(command)) {
  console.error(`${command} is a v2-only command; ${projectId} uses workflowVersion 1. Use docs-tdd gate ${projectId} <GATE>.`)
  process.exit(1)
}

capability(projectId, { agentClient })
const resolvedWorktree = resolveProjectWorktree(projectId)
const { worktree } = resolvedWorktree
let status = 0
if (command === 'check') status = run([join(scriptDir, 'check-doc-budget.mjs')])
else {
  const release = requireFreshRuleRelease()
  if (!release) process.exit(1)
  // effective-rules 只作展示基线：缺失/损坏/漂移只 warn，业务命令按项目 pinned 政策继续（永不返回 null）。
  const effectiveRules = requireFreshEffectiveRules()
  if (command === 'gate') {
    if (['G5', 'G6', 'G7', 'G8'].includes((detail || 'G3').toUpperCase()) && !requireRuleSession(projectId, worktree, agentClient)) process.exit(1)
    status = run([join(scriptDir, 'run-project-gate.mjs'), projectId, detail || 'G3', '--write', '--client', agentClient, ...(contextSessionId ? ['--session-id', contextSessionId] : []), ...(noCache ? ['--no-cache'] : []), ...(partial ? ['--partial'] : [])], worktree)
    // partial 不是 G6 PASS：不播报「G6 通过」，免得群里误读为完整通过。
    if (status === 0 && !partial) maybeBroadcastGate(projectId, (detail || 'G3').toUpperCase())
  } else if (command === 'changed') {
    if (!requireRuleSession(projectId, worktree, agentClient)) process.exit(1)
    status = runChanged(projectId, worktree, effectiveRules.currentFingerprint, { noCache, client: agentClient, sessionId: contextSessionId })
  } else if (command === 'context') {
    try {
      const scenario = detail || 'g0_g2_scope'
      if (CODING_SCENARIOS.has(scenario) && !verifyG2Ready(projectId, worktree, scriptDir)) process.exit(1)
      const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
      const policyErrors = validateContextPolicy(index, {
        codingScenarios: CODING_SCENARIOS,
      })
      if (policyErrors.length) throw new Error(`invalid context policy:\n- ${policyErrors.join('\n- ')}`)
      const code = createFingerprint({ callerCwd: worktree, config, docsRoot })
      // 项目钉版：规则文档从项目 pinned commit 不可变读取，维护者工作副本的下一版编辑不污染在飞项目。
      const rulePin = resolveRulePin(projectId)
      const g6Current = {
        projectId,
        client: agentClient,
        sessionId: contextSessionId,
        headSha: code.headSha,
        dirtyHash: code.dirtyHash,
        rulePolicyFingerprint: rulePin.policyFingerprint,
      }
      if (coordinatorSteps(index, scenario)) {
        const previous = loadG6ContextSession(projectId)
        printG6ContextPlan(projectId, sameG6ContextBinding(previous, g6Current) ? previous : null)
        printGateHeartbeat(projectId, resolvedWorktree)
        process.exit(0)
      }
      const currentG6Session = G6_CONTEXT_SCENARIOS.includes(scenario) ? loadG6ContextSession(projectId) : null
      const activeG6Session = sameG6ContextBinding(currentG6Session, g6Current) ? currentG6Session : null
      const expectedG6Scenario = nextG6ContextScenario(activeG6Session)
      if (G6_CONTEXT_SCENARIOS.includes(scenario) && expectedG6Scenario && scenario !== expectedG6Scenario && !activeG6Session?.dimensions?.[scenario]) {
        throw new Error(`G6 context order violation: next required scenario is ${expectedG6Scenario}, received ${scenario}`)
      }
      const mode = resolveContextMode(cliArgs, scenario, index)
      const pack = createContextPack(projectId, scenario, release, effectiveRules, mode, {
        includeSummary: !G6_CONTEXT_SCENARIOS.includes(scenario) || !activeG6Session || Object.keys(activeG6Session.dimensions || {}).length === 0,
        pinnedCommit: rulePin.commit,
      })
      const kind = CODING_SCENARIOS.has(scenario) ? 'coding' : 'stage'
      const verdict = mode === 'full' ? { ok: true } : enforceContextBudget(pack, kind, contextBudgetFor(index, scenario, kind))
      if (!verdict.ok) throw new Error(`context pack exceeds the ${kind} hard limit`)

      // 只有调用方提供真实 task/session identity 时才做会话内 delivery 去重；无 identity 默认完整报告，绝不跨任务复用。
      const ledger = loadContextDeliveryLedger({
        projectId,
        client: agentClient,
        sessionId: contextSessionId,
      })
      if (findDeliveredPack(ledger, scenario, pack.fingerprint)) {
        printContextDelta(scenario, pack)
      } else {
        printContextPack(scenario, pack)
        recordContextDelivery(ledger, {
          scenario,
          fingerprint: pack.fingerprint,
          output: pack.output,
          deliveredAt: new Date().toISOString(),
        })
      }
      // 编码会话仍每次刷新（headSha / codeReadiness 可能变，门禁证据不能靠 delta 复用）。
      if (CODING_SCENARIOS.has(scenario)) writeRuleSession(projectId, worktree, rulePin, pack, agentClient)
      if (G6_CONTEXT_SCENARIOS.includes(scenario)) recordG6Context({ current: g6Current, scenario, pack })
      printGateHeartbeat(projectId, resolvedWorktree)
    } catch (error) {
      console.error(error.message)
      status = 1
    }
  } else if (command === 'recommend') {
    recommendScenarios(worktree)
  } else {
    console.error(`unknown command: ${command}`)
    status = 1
  }
}
process.exit(status)
