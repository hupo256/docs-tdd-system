#!/usr/bin/env node
// 快速通道决策台账（agent/fast-track.json）的语义判定单一源。
//
// 核心边界：Mock 可以替代暂不可用的系统，不能替代尚未作出的业务决策。权限、金额精度、
// 状态机、路由、核心交互不是天然阻塞；只有语义仍 undecided，且影响跨模块/不可逆，或属于
// 这些高风险类别时才阻断 G2。负责人签过临时契约的 provisional 项可推进，但到约定 gate
// 必须销账。文件缺失表示项目没有选择快速通道，不影响普通项目。

import assert from 'node:assert/strict'
import { signatureReason, signatureState } from './confirmation.mjs'
import { isPendingReconcileFastTrackItem } from './gate-partial.mjs'

const HIGH_RISK_CATEGORIES = new Set(['permission', 'amount-precision', 'state-machine', 'routing', 'core-interaction'])
const GATE_INDEX = new Map(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'].map((gate, index) => [gate, index]))
// 各类别临时契约的销账 gate 上限（reuse-api 口径：G5 当场对账，故高影响类最迟 G5）。
const LATEST_RESOLUTION_GATE = {
  field: 'G5',
  permission: 'G5',
  'amount-precision': 'G5',
  'state-machine': 'G5',
  visual: 'G6',
  routing: 'G6',
  'core-interaction': 'G6',
  other: 'G8',
}

// pending-api 项目的真实对账发生在 G6-partial 之后的「完整 G6 重跑」，而非 G5。因此 route==='pending-api'
// 且 reconcileWith==='api'（等真实响应核对）的项，销账上限放宽到至少 G6——否则高影响 api 类会被 G5 上限
// 和 G6-partial overdue 两头夹死（P1 死结）。decision 类与 reuse-api 仍按基础表，不放宽。
function latestResolutionGate(item, route) {
  const base = LATEST_RESOLUTION_GATE[item?.category] || 'G8'
  if (route === 'pending-api' && item?.reconcileWith === 'api') {
    return (GATE_INDEX.get('G6') ?? 0) > (GATE_INDEX.get(base) ?? 0) ? 'G6' : base
  }
  return base
}
const PLACEHOLDER_RE = /^(?:|待确认|待定|unknown|tbd|n\/a|na|无)$/i

function meaningful(value) {
  return typeof value === 'string' && !PLACEHOLDER_RE.test(value.trim())
}

function itemLabel(item) {
  return `${item?.id || '?'}(${item?.category || '?'} / ${item?.semanticStatus || '?'})`
}

export function duplicateFastTrackIds(items) {
  const seen = new Set()
  const duplicates = new Set()
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) continue
    if (seen.has(item.id)) duplicates.add(item.id)
    seen.add(item.id)
  }
  return [...duplicates]
}

export function g2BlockingDecisions(items) {
  return (Array.isArray(items) ? items : []).filter((item) =>
    item?.status === 'open'
      && item.semanticStatus === 'undecided'
      && (HIGH_RISK_CATEGORIES.has(item.category) || item.impact !== 'local'),
  )
}

export function incompleteTemporaryDecisions(items, route) {
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (item?.status !== 'open') return false
    if (!meaningful(item.safeFallback) || !meaningful(item.owner) || !meaningful(item.resolveByGate)) return true
    const latest = GATE_INDEX.get(latestResolutionGate(item, route))
    if ((GATE_INDEX.get(item.resolveByGate) ?? Number.POSITIVE_INFINITY) > latest) return true
    if (item.semanticStatus === 'provisional' && !meaningful(item.temporaryContract)) return true
    if (item.semanticStatus === 'confirmed' && !meaningful(item.source)) return true
    return !Array.isArray(item.evidence) || item.evidence.length === 0 || item.evidence.some((entry) => !meaningful(entry))
  })
}

export function overdueFastTrackDecisions(items, gate) {
  const current = GATE_INDEX.get(gate)
  if (current === undefined) return []
  return (Array.isArray(items) ? items : []).filter((item) => {
    const due = GATE_INDEX.get(item?.resolveByGate)
    return item?.status === 'open' && due !== undefined && due <= current
  })
}

export function fastTrackChecks({ ledger, projectId, gate, schemaErrors = [], partial = false, file = 'agent/fast-track.json' }) {
  if (ledger === null || ledger === undefined) return []

  const items = Array.isArray(ledger?.items) ? ledger.items : []
  const route = ledger?.route
  const duplicates = duplicateFastTrackIds(items)
  const structureErrors = [
    ...schemaErrors,
    ...(ledger?.projectId === projectId ? [] : [`projectId 应为 ${projectId}`]),
    ...(duplicates.length ? [`重复 id：${duplicates.join(', ')}`] : []),
    ...items.filter((item) => item?.status === 'resolved' && !meaningful(item.resolution)).map((item) => `${item.id || '?'} 已 resolved 但缺 resolution`),
  ]
  const base = { file, category: 'documentation' }
  const checks = [{
    ...base,
    ruleId: 'DOC-FAST-001',
    ok: structureErrors.length === 0,
    severity: 'error',
    message: structureErrors.length ? `fast-track.json 结构非法：${structureErrors.join('；')}` : 'fast-track.json 结构与项目身份有效',
  }]
  if (structureErrors.length || (GATE_INDEX.get(gate) ?? -1) < GATE_INDEX.get('G2')) return checks

  const signature = signatureState(ledger.confirmedBy, ledger.confirmedAt)
  checks.push({
    ...base,
    ruleId: 'DOC-FAST-002',
    ok: signature.ok,
    severity: 'error',
    message: signature.ok
      ? `快速通道及出口已由 ${ledger.confirmedBy} 于 ${ledger.confirmedAt} 确认`
      : `快速通道必须在 G2 由人确认，当前${signatureReason(signature.kind)}`,
  })

  const blocked = g2BlockingDecisions(items)
  checks.push({
    ...base,
    ruleId: 'DOC-FAST-003',
    ok: blocked.length === 0,
    severity: 'error',
    message: blocked.length
      ? `高影响业务语义仍未决定，不能用 Mock 代替 G2 决策：${blocked.map(itemLabel).join('、')}`
      : '无未决的高风险、跨模块或不可逆业务决策',
  })

  const incomplete = incompleteTemporaryDecisions(items, route)
  checks.push({
    ...base,
    ruleId: 'DOC-FAST-004',
    ok: incomplete.length === 0,
    severity: 'error',
    message: incomplete.length
      ? `快速通道项缺少来源/临时契约/安全降级/owner/证据，或销账 gate 晚于该类别允许边界：${incomplete.map(itemLabel).join('、')}`
      : '快速通道项均有来源或临时契约、安全降级、owner、按类别限定的销账 gate 与证据',
  })

  const overdue = overdueFastTrackDecisions(items, gate)
  if ((GATE_INDEX.get(gate) ?? -1) >= GATE_INDEX.get('G5')) {
    // G6-partial（pending-api 停靠态的部分验收）：等真实接口对账的 open 项（reconcileWith==='api'）转待对账 warn、
    // 不阻断本次部分验收；纯业务 decision 类欠账仍硬阻断。完整 G6/G7/G8 下 partial=false，一律硬销账。
    const pendingReconcile = partial ? overdue.filter(isPendingReconcileFastTrackItem) : []
    const hardOverdue = partial ? overdue.filter((item) => !isPendingReconcileFastTrackItem(item)) : overdue
    checks.push({
      ...base,
      ruleId: 'DOC-FAST-005',
      ok: hardOverdue.length === 0,
      severity: 'error',
      message: hardOverdue.length
        ? `已到 ${gate} 仍未销账的快速通道决策：${hardOverdue.map((item) => `${itemLabel(item)}→${item.resolveByGate}`).join('、')}`
        : partial && pendingReconcile.length
          ? `G6-partial：${pendingReconcile.length} 项待真实接口对账（${pendingReconcile.map(itemLabel).join('、')}）记为待对账、不阻断部分验收，真实字段到位后须重跑完整 G6 销账`
          : `没有到达 ${gate} 仍未销账的快速通道决策`,
    })
  }
  return checks
}

function selfTest() {
  const item = (overrides = {}) => ({
    id: 'FTD-001', category: 'field', semanticStatus: 'undecided', impact: 'local', summary: '字段名待定', source: '',
    temporaryContract: '', safeFallback: '缺失显示 --', owner: 'backend', reconcileWith: 'api', resolveByGate: 'G5', status: 'open', resolution: '',
    evidence: ['product/03-api-contract.md'], ...overrides,
  })
  const ledger = (items, overrides = {}) => ({ projectId: 'PR-00001', route: 'pending-api', confirmedBy: 'aven', confirmedAt: '2026-08-24', items, ...overrides })

  assert.deepEqual(fastTrackChecks({ ledger: null, projectId: 'PR-00001', gate: 'G2' }), [])
  assert.deepEqual(duplicateFastTrackIds([item(), item()]), ['FTD-001'])
  assert.equal(g2BlockingDecisions([item()]).length, 0, '局部字段缺口可过 G2')
  assert.equal(g2BlockingDecisions([item({ category: 'permission' })]).length, 1, '未决权限语义挡 G2')
  assert.equal(g2BlockingDecisions([item({ impact: 'cross-cutting' })]).length, 1, '跨模块未决项挡 G2')
  assert.equal(g2BlockingDecisions([item({ category: 'permission', semanticStatus: 'provisional', temporaryContract: '默认拒绝' })]).length, 0, '人工临时契约不是未决语义')
  assert.equal(incompleteTemporaryDecisions([item({ semanticStatus: 'provisional', temporaryContract: '' })]).length, 1, '临时契约不可为空')
  assert.equal(incompleteTemporaryDecisions([item({ semanticStatus: 'provisional', temporaryContract: '默认拒绝' })]).length, 0)
  assert.equal(incompleteTemporaryDecisions([item({ category: 'amount-precision', semanticStatus: 'provisional', temporaryContract: '8 位、截断', resolveByGate: 'G8' })]).length, 1, '金额临时契约最迟 G5 销账')
  assert.equal(incompleteTemporaryDecisions([item({ semanticStatus: 'confirmed', source: '' })]).length, 1, '已确认语义必须有来源')
  assert.equal(overdueFastTrackDecisions([item()], 'G4').length, 0)
  assert.equal(overdueFastTrackDecisions([item()], 'G5').length, 1)
  assert.equal(overdueFastTrackDecisions([item({ status: 'resolved', resolution: '已对账' })], 'G8').length, 0)

  const blocked = fastTrackChecks({ ledger: ledger([item({ category: 'amount-precision' })]), projectId: 'PR-00001', gate: 'G2' })
  assert.equal(blocked.find((check) => check.ruleId === 'DOC-FAST-003')?.ok, false)
  const provisional = fastTrackChecks({ ledger: ledger([item({ category: 'amount-precision', semanticStatus: 'provisional', temporaryContract: '8 位、截断' })]), projectId: 'PR-00001', gate: 'G2' })
  assert.ok(provisional.every((check) => check.ok), '有签名和完整护栏的临时金额契约可过 G2')
  const due = fastTrackChecks({ ledger: ledger([item({ semanticStatus: 'provisional', temporaryContract: '临时字段 foo' })]), projectId: 'PR-00001', gate: 'G5' })
  assert.equal(due.find((check) => check.ruleId === 'DOC-FAST-005')?.ok, false)
  const unresolved = fastTrackChecks({ ledger: ledger([item({ status: 'resolved', resolution: '' })]), projectId: 'PR-00001', gate: 'G5' })
  assert.equal(unresolved.find((check) => check.ruleId === 'DOC-FAST-001')?.ok, false, 'resolved 项必须填写 resolution')
  const aiSigned = fastTrackChecks({ ledger: ledger([], { confirmedBy: 'codex' }), projectId: 'PR-00001', gate: 'G2' })
  assert.equal(aiSigned.find((check) => check.ruleId === 'DOC-FAST-002')?.ok, false)

  // route 感知的销账上限：pending-api + reconcileWith='api' 的金额精度项允许延到 G6（完整 G6 重跑对账）；
  // reuse-api 或 decision 类仍钉最迟 G5。
  assert.equal(incompleteTemporaryDecisions([item({ category: 'amount-precision', semanticStatus: 'provisional', temporaryContract: '8 位、截断', resolveByGate: 'G6' })], 'pending-api').length, 0, 'pending-api 的等接口金额项可延到 G6')
  assert.equal(incompleteTemporaryDecisions([item({ category: 'amount-precision', semanticStatus: 'provisional', temporaryContract: '8 位、截断', resolveByGate: 'G6' })], 'reuse-api').length, 1, 'reuse-api 金额项仍最迟 G5')
  assert.equal(incompleteTemporaryDecisions([item({ category: 'amount-precision', semanticStatus: 'provisional', temporaryContract: '8 位、截断', reconcileWith: 'decision', resolveByGate: 'G6' })], 'pending-api').length, 1, 'decision 类不随 pending-api 放宽')

  // partial（G6-partial）：等接口 open 项转待对账不阻断；纯业务 decision 类仍硬阻断；完整 G6 一律阻断。
  const apiItem = item({ category: 'amount-precision', semanticStatus: 'provisional', temporaryContract: '8 位、截断', resolveByGate: 'G6' })
  const partialApi = fastTrackChecks({ ledger: ledger([apiItem]), projectId: 'PR-00001', gate: 'G6', partial: true })
  assert.equal(partialApi.find((check) => check.ruleId === 'DOC-FAST-005')?.ok, true, 'G6-partial 下等接口项记为待对账、不阻断')
  const fullApi = fastTrackChecks({ ledger: ledger([apiItem]), projectId: 'PR-00001', gate: 'G6', partial: false })
  assert.equal(fullApi.find((check) => check.ruleId === 'DOC-FAST-005')?.ok, false, '完整 G6 下同一项必须阻断（partial 不是逃逸口）')
  const partialDecision = fastTrackChecks({ ledger: ledger([item({ category: 'permission', semanticStatus: 'provisional', temporaryContract: '默认拒绝', reconcileWith: 'decision', resolveByGate: 'G5' })]), projectId: 'PR-00001', gate: 'G6', partial: true })
  assert.equal(partialDecision.find((check) => check.ruleId === 'DOC-FAST-005')?.ok, false, 'G6-partial 下纯业务 decision 欠账仍硬阻断')

  console.log('fast-track-policy self-test passed (23 cases)')
}

if (process.argv[1]?.endsWith('fast-track-policy.mjs') && process.argv.includes('--self-test')) selfTest()
