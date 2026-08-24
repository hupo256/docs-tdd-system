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
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContextPack, enforceContextBudget, expandScenarioRefs, printContextPack, requireFreshEffectiveRules, requireFreshRuleRelease } from './lib/context-pack.mjs'
import { maybeBroadcastGate, printGateHeartbeat } from './lib/gate-heartbeat.mjs'
import { runChanged, recommendScenarios } from './lib/changed-detection.mjs'
import { capability, resolveProjectWorktree } from './lib/project-status-report.mjs'
import { explainRule } from './lib/explain-rule.mjs'
import { resolveRoots } from './lib/roots.mjs'
import { resolveRuleSessionClient } from './lib/rule-session.mjs'
import { CODING_SCENARIOS, requireRuleSession, verifyG2Ready, writeRuleSession } from './lib/rule-session-runtime.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const releaseScript = join(scriptDir, 'rule-release.mjs')
const effectiveRulesScript = join(scriptDir, 'effective-rules.mjs')
const cliArgs = process.argv.slice(2)
const [command, projectId] = cliArgs
const commandArgs = cliArgs.slice(2)
const clientIndex = commandArgs.indexOf('--client')
if (clientIndex >= 0 && !commandArgs[clientIndex + 1]) {
  console.error('--client requires one of: codex, claude, cursor, manual')
  process.exit(1)
}
let agentClient
try {
  agentClient = resolveRuleSessionClient({ requested: clientIndex >= 0 ? commandArgs[clientIndex + 1] : undefined })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const positional = commandArgs.filter((arg, index) => !arg.startsWith('--') && commandArgs[index - 1] !== '--client')
const detail = positional[0]
const fullContext = cliArgs.includes('--full')
const noCache = cliArgs.includes('--no-cache')
// --partial：G6 部分验收（G5 停靠态出口）。必须在此显式透传给 run-project-gate.mjs——
// 否则公共入口跑的是普通 G6，用户以为做了部分验收、实际被 G5 前置挡下（真机漏传缺陷修复）。
const partial = cliArgs.includes('--partial')

// 子进程直通（stdio inherit）：分发到同级脚本时复用，退出码原样上抛。
function run(args, cwd = repoRoot) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' })
  return result.status ?? 1
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
  assert(expandScenarioRefs(index, 'g6_verify').some((ref) => ref.file === 'quality-checklist.md'))
  console.log('docs-tdd self-test passed.')
  process.exit(0)
}

if (command === 'capability') {
  capability(projectId, { agentClient })
  process.exit(0)
}

if (command === 'doctor') {
  const doctorFlags = commandArgs.filter((arg) => ['--json', '--allow-tracked-rule-changes'].includes(arg))
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
  step('doctor (effective-rules)', [effectiveRulesScript, '--doctor'])
  console.log(`\ndocs-tdd guard: ${worst === 0 ? 'PASS — 机器层回归/发布/加载三检通过' : 'BLOCK — 见上方失败项'}`)
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

if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '')) {
  console.error('usage: docs-tdd.mjs <kickoff|status|resume|next|capability|doctor|release|golden|guard|rule-health|explain|check|gate|context|changed|recommend> PR-01234 [G0-G8|scenario] [--compact|--full|--no-cache] [--client codex|claude|cursor|manual]')
  process.exit(1)
}

if (['kickoff', 'status', 'resume', 'next'].includes(command)) {
  process.exit(run([join(scriptDir, 'project-orchestrator.mjs'), command, projectId, ...cliArgs.slice(2)]))
}

capability(projectId, { agentClient })
const resolvedWorktree = resolveProjectWorktree(projectId)
const { worktree } = resolvedWorktree
let status = 0
if (command === 'check') status = run([join(scriptDir, 'check-doc-budget.mjs')])
else {
  const release = requireFreshRuleRelease()
  if (!release) process.exit(1)
  const effectiveRules = requireFreshEffectiveRules()
  if (!effectiveRules) process.exit(1)
  if (command === 'gate') {
    if (['G5', 'G6', 'G7', 'G8'].includes((detail || 'G3').toUpperCase()) && !requireRuleSession(projectId, worktree, release, effectiveRules, agentClient)) process.exit(1)
    status = run([join(scriptDir, 'run-project-gate.mjs'), projectId, detail || 'G3', '--write', ...(noCache ? ['--no-cache'] : []), ...(partial ? ['--partial'] : [])], worktree)
    // partial 不是 G6 PASS：不播报「G6 通过」，免得群里误读为完整通过。
    if (status === 0 && !partial) maybeBroadcastGate(projectId, (detail || 'G3').toUpperCase())
  } else if (command === 'changed') {
    if (!requireRuleSession(projectId, worktree, release, effectiveRules, agentClient)) process.exit(1)
    status = runChanged(projectId, worktree, effectiveRules.currentFingerprint, { noCache })
  } else if (command === 'context') {
    try {
      const scenario = detail || 'g0_g2_scope'
      if (CODING_SCENARIOS.has(scenario) && !verifyG2Ready(projectId, worktree, scriptDir)) process.exit(1)
      // 模式选择：--full 优先展开全文；否则 brief 默认场景（编码 + G6 验收）折叠机器/参考型正文，其余 compact。
      const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
      const briefDefault = new Set(index.policy?.briefDefaultScenarios || [])
      const mode = fullContext ? 'full' : briefDefault.has(scenario) ? 'brief' : 'compact'
      const pack = createContextPack(projectId, scenario, release, effectiveRules, mode)
      printContextPack(scenario, pack)
      // 预算门禁：编码场景归 coding、其余归 stage；已知偏大的判断密集场景走 scenarios 覆盖（grandfather 带余量）。
      // --full 是「要全文」的显式逃生口，不受预算硬闸约束（预算治理的是 brief/compact 默认路径的膨胀）。
      if (!fullContext) {
        const kind = CODING_SCENARIOS.has(scenario) ? 'coding' : 'stage'
        const budgets = index.policy?.contextBudget
        const verdict = enforceContextBudget(pack, kind, budgets?.scenarios?.[scenario] || budgets?.[kind])
        if (!verdict.ok) process.exit(1)
      }
      if (CODING_SCENARIOS.has(scenario)) writeRuleSession(projectId, worktree, release, effectiveRules, pack, agentClient)
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
