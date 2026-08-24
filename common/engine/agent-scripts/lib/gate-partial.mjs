#!/usr/bin/env node
// G6-partial（部分验收）出口的判定语义单一事实源。
//
// 存在理由：G5 停靠态 `frontend-complete-pending-reconcile`（前端已完成、只差后端真实字段）此前
// 没有任何机器出口——VERIFY-G5-002 只认 completed/not-applicable，于是「前端做完了」既拿不到
// biome/tsc/vitest/code-review 的机器背书，也在索引里长期显示阻塞。partial 模式给它一个真实出口：
// 除依赖真实字段的验收项外全部照跑照判，结论以 `G6-partial` 入历史。
//
// 关键约束：`G6-partial` **不是** G6 PASS。它写成独立 gate 标签，因此
// ① `hasPassedGate('G6')` 恒为 false → VERIFY-STAGE-002 天然挡住 G7；
// ② DOC-SYNC-001/002/003（只认 `^G[0-8]$`）不会据它要求 README 阶段跳级。
// 纯函数 + --self-test，无 I/O。

import assert from 'node:assert/strict'

export const PARTIAL_SUFFIX = '-partial'
// 只有 G6 有部分验收语义：G5 之前没有验收项可分，G7/G8 是 QA 与交付，"部分交付"不成立。
export const PARTIAL_GATES = ['G6']
// 可待对账的验收方法只有两种：契约测试（要真实响应体）与浏览器端到端（要真实数据落地）。
// vitest / manual-visual / manual 不依赖真实字段，它们 blocked 就是真 blocked，不给 partial 出口。
export const PENDING_RECONCILE_METHODS = ['contract', 'browser']
const RECONCILE_G5_STATUS = 'frontend-complete-pending-reconcile'

// 解析 --partial：返回本次实际用的 gate 标签。gate 不支持 partial 时返回 error 供调用方 usage 退出，
// 不静默降级成普通 G6（否则人以为跑了部分验收，实际拿到的是完整 PASS 或误判 BLOCK）。
export function resolvePartialRun({ gate, partial }) {
  if (!partial) return { partial: false, gateLabel: gate, error: '' }
  if (!PARTIAL_GATES.includes(gate)) {
    return { partial: false, gateLabel: gate, error: `--partial 仅适用于 ${PARTIAL_GATES.join(' / ')}（收到 ${gate || 'missing'}）` }
  }
  return { partial: true, gateLabel: `${gate}${PARTIAL_SUFFIX}`, error: '' }
}

export function isPartialGateLabel(label) {
  return typeof label === 'string' && label.endsWith(PARTIAL_SUFFIX)
}

export function isPendingReconcile(item) {
  return item?.status === 'blocked' && PENDING_RECONCILE_METHODS.includes(item?.method)
}

// partial 模式下把「依赖真实字段」的 blocked 验收项拆出来：它们记为待对账，不算未处置项。
export function splitPendingReconcile(items) {
  const list = Array.isArray(items) ? items : []
  const pending = list.filter(isPendingReconcile)
  return { pending, rest: list.filter((item) => !pending.includes(item)) }
}

// 快速通道台账（agent/fast-track.json）里「等真实接口对账」的 open 项：G6-partial 下转待对账、不阻断。
// 判据刻意收窄到 reconcileWith==='api'——即语义/临时契约已定、只差真实响应核对的项；
// reconcileWith==='decision'（纯业务临时决策，不依赖接口）永远按 resolveByGate 硬销账，partial 不给出口，
// 否则 partial 会沦为「跳过一切业务决策欠账的后门」。与 assumptions/blockers 的待对账口径同源、单点收敛。
export function isPendingReconcileFastTrackItem(item) {
  return item?.status === 'open' && item?.reconcileWith === 'api'
}

// G5 阶段态的放行口径：partial 模式额外接受停靠态本身，否则仍只认 completed/not-applicable。
export function allowedG5Statuses(partial) {
  return partial ? ['completed', 'not-applicable', RECONCILE_G5_STATUS] : ['completed', 'not-applicable']
}

// G5 结论的证据要求：停靠态要求「前端 evidence + 待对账原因」同时具备——partial 运行是以它为依据的，
// 依据本身不能只是一个状态字符串。
export function g5DispositionEvidenceOk({ status, evidenceOk, hasReason }) {
  if (status === 'not-applicable') return Boolean(hasReason)
  if (status === RECONCILE_G5_STATUS) return Boolean(evidenceOk && hasReason)
  return status === 'completed' && Boolean(evidenceOk)
}

// partial 运行的阶段前置：G5 停靠意味着没有 G5 PASS，改要求 G4 PASS 历史（编码前的最后一个完整 gate）。
// 这一条不可被省略——否则 partial 会变成「跳过一切前置的后门」。
export function partialPrerequisiteCheck({ hasG4Pass, file }) {
  return {
    ruleId: 'VERIFY-STAGE-004',
    ok: Boolean(hasG4Pass),
    severity: 'error',
    category: 'documentation',
    file,
    message: 'G6-partial 要求 agent/gate-history.json 存在真实写入的 G4 PASS（G5 停靠态下以 G4 为前置）',
  }
}

// partial 运行的结论标记（warn）：把「这次是部分验收、不构成 G7 前置」写进 checks，
// 使结论卡/证据/交付摘要都能看到它，而不是只体现在 gate 字段的后缀里。
export function partialRunNoteCheck({ pendingIds = [], file }) {
  const list = [...pendingIds]
  return {
    ruleId: 'VERIFY-G6-005',
    ok: true,
    severity: 'warn',
    category: 'documentation',
    file,
    message: `本次为 G6-partial（部分验收）：${list.length ? `待真实字段对账 ${list.length} 项（${list.join(', ')}）` : '无待对账验收项'}；结论记为 G6-partial，不构成 G7 前置，字段到位后须重跑完整 G6`,
  }
}

function selfTest() {
  assert.deepEqual(resolvePartialRun({ gate: 'G6', partial: true }), { partial: true, gateLabel: 'G6-partial', error: '' })
  assert.deepEqual(resolvePartialRun({ gate: 'G6', partial: false }), { partial: false, gateLabel: 'G6', error: '' })
  const rejected = resolvePartialRun({ gate: 'G7', partial: true })
  assert.equal(rejected.partial, false)
  assert.ok(rejected.error.includes('G6'), 'non-G6 partial must report a usage error')
  assert.equal(resolvePartialRun({ gate: 'G8', partial: true }).gateLabel, 'G8', 'rejected partial must not rewrite the gate label')
  assert.ok(isPartialGateLabel('G6-partial') && !isPartialGateLabel('G6'))

  const items = [
    { id: 'AC-1', method: 'contract', status: 'blocked' },
    { id: 'AC-2', method: 'browser', status: 'blocked' },
    { id: 'AC-3', method: 'vitest', status: 'blocked' },
    { id: 'AC-4', method: 'contract', status: 'failed' },
    { id: 'AC-5', method: 'contract', status: 'passed' },
  ]
  const { pending, rest } = splitPendingReconcile(items)
  assert.deepEqual(pending.map((item) => item.id), ['AC-1', 'AC-2'], 'only blocked contract/browser items are pending-reconcile')
  assert.deepEqual(rest.map((item) => item.id), ['AC-3', 'AC-4', 'AC-5'], 'blocked vitest and failed contract stay unresolved')
  assert.deepEqual(splitPendingReconcile(null), { pending: [], rest: [] })

  // 快速通道待对账判据：只有 reconcileWith==='api' 的 open 项转待对账；decision 类与已 resolved 不给出口。
  assert.equal(isPendingReconcileFastTrackItem({ status: 'open', reconcileWith: 'api' }), true)
  assert.equal(isPendingReconcileFastTrackItem({ status: 'open', reconcileWith: 'decision' }), false, '纯业务决策不依赖接口，partial 不放行')
  assert.equal(isPendingReconcileFastTrackItem({ status: 'resolved', reconcileWith: 'api' }), false, '已销账不算 open')

  assert.deepEqual(allowedG5Statuses(false), ['completed', 'not-applicable'])
  assert.ok(allowedG5Statuses(true).includes(RECONCILE_G5_STATUS))
  assert.equal(g5DispositionEvidenceOk({ status: RECONCILE_G5_STATUS, evidenceOk: true, hasReason: true }), true)
  assert.equal(g5DispositionEvidenceOk({ status: RECONCILE_G5_STATUS, evidenceOk: true, hasReason: false }), false, '停靠态缺原因不算有依据')
  assert.equal(g5DispositionEvidenceOk({ status: RECONCILE_G5_STATUS, evidenceOk: false, hasReason: true }), false, '停靠态缺 evidence 不算有依据')
  assert.equal(g5DispositionEvidenceOk({ status: 'not-applicable', evidenceOk: false, hasReason: true }), true)
  assert.equal(g5DispositionEvidenceOk({ status: 'completed', evidenceOk: true, hasReason: false }), true)
  assert.equal(g5DispositionEvidenceOk({ status: 'blocked', evidenceOk: true, hasReason: true }), false)

  assert.equal(partialPrerequisiteCheck({ hasG4Pass: false, file: 'agent/gate-history.json' }).ok, false)
  assert.equal(partialPrerequisiteCheck({ hasG4Pass: true, file: 'agent/gate-history.json' }).ok, true)
  const note = partialRunNoteCheck({ pendingIds: ['AC-1'], file: 'agent/acceptance-results.json' })
  assert.ok(note.ok && note.severity === 'warn' && note.message.includes('AC-1') && note.message.includes('不构成 G7 前置'))
  assert.ok(partialRunNoteCheck({ pendingIds: [], file: 'x' }).message.includes('无待对账验收项'))
  console.log('PASS gate-partial (G6-partial 判定)')
}

if (process.argv[1]?.endsWith('gate-partial.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
