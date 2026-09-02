#!/usr/bin/env node
/**
 * Gate 心跳 + 阶段播报子系统：从 docs-tdd.mjs 抽出。
 * - heartbeatDecision：纯判定（worktree 是否偏离上次 PASS），可 `--self-test` 直测。
 * - gateHeartbeat / printGateHeartbeat：读 worktree 指纹与 gate-results.json，诊断式提醒，绝不阻断。
 * - maybeBroadcastGate：gate 通过后按项目 notify 配置发「Gx 已完成」卡片，指纹入幂等键，非阻塞。
 *
 * 自成一体：自己 resolveRoots()、自己定位项目 notify 薄包装，不依赖调用方模块作用域。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeFingerprint, matchesGateFingerprint } from './fingerprint.mjs'
import { resolveProjectRoot, resolveRoots } from './roots.mjs'

const { consumerRoot: repoRoot, config } = resolveRoots()
const baseRef = () => config.baseRef || 'origin/online'
const readOptionalJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null)

// Gate 心跳判定（纯函数，便于 self-test）：located/isGitRepo 缺失即跳过；无 gate 结果时，
// 若 worktree 与 base 零差异（还没代码可 gate）也跳过，避免对 pre-coding 项目催跑 gate。
export function heartbeatDecision({ located, isGitRepo, noDivergence, gate, matches }) {
  if (!located || !isGitRepo) return { level: 'skip' }
  if (!gate)
    return noDivergence
      ? { level: 'skip' }
      : { level: 'warn', message: '尚无 gate-results.json（从未跑过 gate）；交付前先跑 docs-tdd gate' }
  if (gate.ok !== true)
    return { level: 'warn', message: `上次 ${gate.gate} 未通过（ok=false）；修复后重跑 docs-tdd gate ${gate.gate}` }
  if (matches) return { level: 'ok', message: `${gate.gate} PASS 与当前代码一致` }
  return {
    level: 'warn',
    message: `距上次 ${gate.gate} PASS 后 worktree 代码已变更（worktree 级，非文件级）；交付前先跑 docs-tdd changed/gate`,
  }
}

export function gateHeartbeat(id, resolvedWorktree) {
  const located = resolvedWorktree.configured && resolvedWorktree.exists
  if (!located) return { level: 'skip' } // pre-G4 / 未配置 worktree
  const current = codeFingerprint(resolvedWorktree.worktree, baseRef())
  const noDivergence = current.headSha === current.baseSha && current.dirtyFileCount === 0 && current.untrackedFileCount === 0
  const gate = readOptionalJson(join(resolveProjectRoot(id), 'agent/gate-results.json'))
  return heartbeatDecision({
    located,
    isGitRepo: current.isGitRepo,
    noDivergence,
    gate,
    matches: matchesGateFingerprint(current, gate?.fingerprint),
  })
}

export function printGateHeartbeat(id, resolvedWorktree) {
  const beat = gateHeartbeat(id, resolvedWorktree)
  if (beat.level === 'warn') console.warn(`⚠ gate 心跳：${beat.message}`)
  else if (beat.level === 'ok') console.log(`✓ gate 心跳：${beat.message}`)
}

// 阶段推进自动播报：gate 通过（exit 0）后，仅当项目 notify 配置 notifyOnGate===true 才发「Gx 已完成」卡片。
// 非阻塞——发送失败只 warn，绝不改 gate 退出码；指纹入幂等键，同代码状态重复跑 gate 不重复刷群。
export function maybeBroadcastGate(id, gate) {
  const configPath = join(resolveProjectRoot(id), 'agent/scripts', `${id.toLowerCase()}.json`)
  const notifyConfig = readOptionalJson(configPath)
  if (!notifyConfig?.notifyOnGate) return

  const wrapper = join(resolveProjectRoot(id), 'agent/scripts/notify-lark.mjs')
  if (!existsSync(wrapper)) {
    console.warn(`⚠ notifyOnGate 开启但缺 notify-lark 薄包装：${wrapper}`)
    return
  }

  const gateResult = readOptionalJson(join(resolveProjectRoot(id), 'agent/gate-results.json'))
  const baseSummary = typeof gateResult?.summary === 'string' && gateResult.summary.trim() ? gateResult.summary.trim() : `${gate} 机器校验通过`
  // G8 是发布 test、提交 AQ 的起点，不是 QA 收工或 online 完成；因此在 G8 后开启 bug 轮询。
  const pollHint = gate === 'G8' ? '；可发布 test 提交 AQ，建议 lark-bot poll-on 开始接 bug' : ''
  const summary = `${baseSummary}${pollHint}`
  const fpKey = createHash('sha1')
    .update(JSON.stringify(gateResult?.fingerprint ?? gate))
    .digest('hex')
    .slice(0, 12)
  const idempotencyKey = `${id}-${gate}-${fpKey}`

  const result = spawnSync(process.execPath, [wrapper, gate, '已完成', summary, '--config', configPath, '--idempotency-key', idempotencyKey], { cwd: repoRoot, encoding: 'utf8' })
  if (result.status === 0) console.log(`✓ 阶段播报已发：${id} ${gate} 已完成`)
  else console.warn(`⚠ 阶段播报失败（不影响 gate）：${(result.stderr || result.stdout || '').trim().slice(0, 200)}`)
}

// ---------------------------------------------------------------------------
// self-test：heartbeatDecision 全分支。node lib/gate-heartbeat.mjs --self-test
// ---------------------------------------------------------------------------
function selfTest() {
  const assert = (cond, msg) => { if (!cond) { console.error(`[gate-heartbeat] self-test failed: ${msg}`); process.exit(1) } }
  assert(heartbeatDecision({ located: false }).level === 'skip', 'not located → skip')
  assert(heartbeatDecision({ located: true, isGitRepo: false }).level === 'skip', 'not git repo → skip')
  assert(heartbeatDecision({ located: true, isGitRepo: true, noDivergence: true, gate: null }).level === 'skip', 'no code + no gate → skip')
  assert(heartbeatDecision({ located: true, isGitRepo: true, noDivergence: false, gate: null }).level === 'warn', 'has diff + never gated → warn')
  assert(heartbeatDecision({ located: true, isGitRepo: true, noDivergence: false, gate: { ok: false, gate: 'G5' } }).level === 'warn', 'last gate failed → warn')
  assert(heartbeatDecision({ located: true, isGitRepo: true, noDivergence: false, gate: { ok: true, gate: 'G5' }, matches: true }).level === 'ok', 'pass + matches → ok')
  assert(heartbeatDecision({ located: true, isGitRepo: true, noDivergence: false, gate: { ok: true, gate: 'G5' }, matches: false }).level === 'warn', 'pass but drifted → warn')
  console.log('PASS gate-heartbeat (heartbeatDecision all branches)')
}

if (process.argv[1] && process.argv[1].endsWith('gate-heartbeat.mjs') && process.argv.includes('--self-test')) selfTest()
