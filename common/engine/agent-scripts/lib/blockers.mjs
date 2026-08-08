#!/usr/bin/env node
// 阻塞与变更的唯一语义源：gate（verify-project-gate）和交付摘要（render-delivery-summary）
// 都从这里 import，不各写一份判定。为什么要有它：此前阻塞/变更只存在于 06-collaboration.md
// 的散文表格里，机器读不动——交付摘要靠正则 grep「待修复/未处理」这类字样（一改口径就漏），
// gate 也拦不住「待后端销账」的错误码一路飘到 G8。见 blocking-and-change-protocol.md。
//
// 纯函数、无 I/O、无 process.exit（除 --self-test 入口）：所有 disk/spawn 由调用方负责，
// 这样 gate 的 --self-test 能直接喂对象断言，不碰真实项目。

export const BLOCKER_TYPES = ['blocker', 'change']
export const BLOCKER_STATUSES = ['open', 'resolved']
export const BLOCKER_CATEGORIES = ['backend', 'design', 'product', 'env', 'qa', 'dependency', 'other']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^(?:BLK|CHG)-\d+$/

export function parseGateNumber(gate) {
  const match = /^G([0-8])$/.exec(String(gate ?? ''))
  return match ? Number(match[1]) : null
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

// 单条 entry → 错误串数组（空 = 合法）。index 用于把定位信息带进 message。
export function validateBlockerEntry(entry, index) {
  const where = `blockers[${index}]`
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [`${where} 必须是对象`]
  const errors = []
  const label = isNonEmptyString(entry.id) ? entry.id : where

  if (!isNonEmptyString(entry.id)) errors.push(`${where} 缺 id`)
  else if (!ID_RE.test(entry.id)) errors.push(`${label} id 须形如 BLK-1 / CHG-2`)

  if (!BLOCKER_TYPES.includes(entry.type)) errors.push(`${label} type 须是 ${BLOCKER_TYPES.join(' | ')}`)
  if (parseGateNumber(entry.gate) === null) errors.push(`${label} gate 须是 G0–G8`)
  if (!BLOCKER_CATEGORIES.includes(entry.category)) errors.push(`${label} category 须是 ${BLOCKER_CATEGORIES.join('/')}`)
  if (!isNonEmptyString(entry.summary)) errors.push(`${label} 缺 summary`)
  if (!isNonEmptyString(entry.owner)) errors.push(`${label} 缺 owner`)
  if (!DATE_RE.test(entry.raisedAt ?? '')) errors.push(`${label} raisedAt 须是 YYYY-MM-DD`)
  if (!BLOCKER_STATUSES.includes(entry.status)) errors.push(`${label} status 须是 ${BLOCKER_STATUSES.join(' | ')}`)

  const raisedGate = parseGateNumber(entry.gate)
  const blocksGate = parseGateNumber(entry.blocksGate)
  if (entry.blocksGate !== undefined && entry.blocksGate !== null && entry.blocksGate !== '') {
    if (blocksGate === null) errors.push(`${label} blocksGate 须是 G0–G8`)
    else if (raisedGate !== null && blocksGate < raisedGate) errors.push(`${label} blocksGate(${entry.blocksGate}) 不能早于登记阶段 gate(${entry.gate})`)
  }
  // open 的 blocker 必须声明卡在哪个 gate，否则永远拦不住、等于没登记。change 可不填。
  if (entry.status === 'open' && entry.type === 'blocker' && blocksGate === null) {
    errors.push(`${label} 是 open 的 blocker，必须填 blocksGate（否则 gate 无从拦截）`)
  }
  // resolved 必须留下解除结论与日期，禁止「静默清零」。
  if (entry.status === 'resolved') {
    if (!isNonEmptyString(entry.resolution)) errors.push(`${label} 已 resolved 但缺 resolution`)
    if (!DATE_RE.test(entry.resolvedAt ?? '')) errors.push(`${label} 已 resolved 但缺 resolvedAt(YYYY-MM-DD)`)
  }
  if (entry.evidence !== undefined && !Array.isArray(entry.evidence)) errors.push(`${label} evidence 须是数组`)
  return errors
}

// 整份 entries 的结构校验（含 id 唯一）。返回错误串数组。
export function validateBlockerFile(entries) {
  if (!Array.isArray(entries)) return ['blockers.json 必须是数组']
  const errors = []
  const seen = new Map()
  entries.forEach((entry, index) => {
    errors.push(...validateBlockerEntry(entry, index))
    const id = entry && typeof entry === 'object' ? entry.id : undefined
    if (isNonEmptyString(id)) {
      if (seen.has(id)) errors.push(`id 重复：${id}（blockers[${seen.get(id)}] 与 blockers[${index}]）`)
      else seen.set(id, index)
    }
  })
  return errors
}

// open 且 blocksGate ≤ 当前 gate 的项：到点必须解除，否则 DOC-BLOCK-002 阻断。
export function blockingEntries(entries, gate) {
  const current = parseGateNumber(gate)
  if (current === null || !Array.isArray(entries)) return []
  return entries.filter((entry) => {
    if (!entry || entry.status !== 'open') return false
    const blocksGate = parseGateNumber(entry.blocksGate)
    return blocksGate !== null && blocksGate <= current
  })
}

// 其余 open 项：尚不卡当前 gate（含无 blocksGate 的 change）。只做可见性 warn。
export function pendingEntries(entries, gate) {
  if (!Array.isArray(entries)) return []
  const blockingIds = new Set(blockingEntries(entries, gate).map((entry) => entry.id))
  return entries.filter((entry) => entry && entry.status === 'open' && !blockingIds.has(entry.id))
}

// gate 消费：返回标准 check 形状（聚合式，每条规则一条 check），由调用方逐条 add()。
// 聚合而非逐 blocker 一条：豁免按 ruleId+file 匹配，聚合让「豁免 DOC-BLOCK-002」成为一次
// 具名带期限的担责动作，而不是给每个 blocker 单独开后门。
export function blockerChecks({ entries, gate, file = 'agent/blockers.json' }) {
  const base = { file, category: 'documentation' }
  // 文件不存在（entries 为 null）→ 不发任何 check：缺失即合法，零回填。
  if (entries === null || entries === undefined) return []

  const structural = validateBlockerFile(entries)
  if (structural.length) {
    // 结构非法时只报 001；此时 entries 不可信，不再跑 002/003 免得连环误报。
    return [{ ...base, ruleId: 'DOC-BLOCK-001', ok: false, severity: 'error', message: `blockers.json 结构非法：${structural.slice(0, 6).join('；')}${structural.length > 6 ? ` …(+${structural.length - 6})` : ''}` }]
  }

  const checks = [{ ...base, ruleId: 'DOC-BLOCK-001', ok: true, severity: 'error', message: `blockers.json 合法（${entries.length} 条登记）` }]
  const blocking = blockingEntries(entries, gate)
  checks.push({
    ...base,
    ruleId: 'DOC-BLOCK-002',
    ok: blocking.length === 0,
    severity: 'error',
    message: blocking.length
      ? `${gate} 前必须解除的 open 阻塞未解除：${blocking.map((entry) => `${entry.id}(${entry.owner}→${entry.blocksGate})`).join('、')}`
      : `无到达当前阶段(${gate})仍未解除的阻塞`,
  })
  const pending = pendingEntries(entries, gate)
  checks.push({
    ...base,
    ruleId: 'DOC-BLOCK-003',
    ok: pending.length === 0,
    severity: 'warn',
    message: pending.length
      ? `尚有 ${pending.length} 项 open 登记（未卡当前阶段）：${pending.map((entry) => `${entry.id}/${entry.type}`).join('、')}`
      : '无其他 open 登记',
  })
  return checks
}

// 交付摘要消费：把 open 项按 blocker/change 分组，给结构化清单（非散文 grep）。
export function openBlockers(entries) {
  const list = Array.isArray(entries) ? entries.filter((entry) => entry && entry.status === 'open') : []
  return {
    blockers: list.filter((entry) => entry.type === 'blocker'),
    changes: list.filter((entry) => entry.type === 'change'),
  }
}

function selfTest() {
  const assert = (name, condition) => {
    if (!condition) {
      console.error(`FAIL ${name}`)
      process.exitCode = 1
    }
  }
  const okEntry = { id: 'BLK-1', type: 'blocker', gate: 'G5', blocksGate: 'G6', category: 'backend', summary: 'x', owner: 'be', raisedAt: '2026-08-03', status: 'open', evidence: [] }

  assert('parseGateNumber', parseGateNumber('G6') === 6 && parseGateNumber('g6') === null && parseGateNumber('G9') === null)
  assert('valid open blocker', validateBlockerEntry(okEntry, 0).length === 0)
  assert('open blocker without blocksGate', validateBlockerEntry({ ...okEntry, blocksGate: undefined }, 0).some((error) => error.includes('blocksGate')))
  assert('bad id', validateBlockerEntry({ ...okEntry, id: 'X-1' }, 0).some((error) => error.includes('id')))
  assert('blocksGate earlier than gate', validateBlockerEntry({ ...okEntry, gate: 'G6', blocksGate: 'G5' }, 0).some((error) => error.includes('不能早于')))
  assert('resolved needs resolution', validateBlockerEntry({ ...okEntry, status: 'resolved', resolvedAt: '2026-08-03' }, 0).some((error) => error.includes('resolution')))
  assert('resolved with fields ok', validateBlockerEntry({ ...okEntry, status: 'resolved', resolution: 'fixed', resolvedAt: '2026-08-03' }, 0).length === 0)
  assert('change without blocksGate ok', validateBlockerEntry({ ...okEntry, id: 'CHG-1', type: 'change', blocksGate: undefined }, 0).length === 0)
  assert('duplicate id', validateBlockerFile([okEntry, { ...okEntry }]).some((error) => error.includes('重复')))

  // blockerChecks 分流
  assert('absent file emits nothing', blockerChecks({ entries: null, gate: 'G5' }).length === 0)
  const structuralBad = blockerChecks({ entries: [{ ...okEntry, id: 'bad' }], gate: 'G5' })
  assert('structural bad → only 001 fail', structuralBad.length === 1 && structuralBad[0].ruleId === 'DOC-BLOCK-001' && !structuralBad[0].ok)
  const atG6 = blockerChecks({ entries: [okEntry], gate: 'G6' })
  assert('open blocker blocks at blocksGate', atG6.find((check) => check.ruleId === 'DOC-BLOCK-002')?.ok === false)
  const atG5 = blockerChecks({ entries: [okEntry], gate: 'G5' })
  assert('not yet blocking at earlier gate', atG5.find((check) => check.ruleId === 'DOC-BLOCK-002')?.ok === true)
  assert('pending surfaces as warn', atG5.find((check) => check.ruleId === 'DOC-BLOCK-003')?.ok === false && atG5.find((check) => check.ruleId === 'DOC-BLOCK-003')?.severity === 'warn')
  const resolved = blockerChecks({ entries: [{ ...okEntry, status: 'resolved', resolution: 'done', resolvedAt: '2026-08-03' }], gate: 'G8' })
  assert('resolved never blocks', resolved.every((check) => check.ok))

  // openBlockers 分组
  const grouped = openBlockers([okEntry, { ...okEntry, id: 'CHG-9', type: 'change' }, { ...okEntry, id: 'BLK-9', status: 'resolved', resolution: 'x', resolvedAt: '2026-08-03' }])
  assert('openBlockers splits and drops resolved', grouped.blockers.length === 1 && grouped.changes.length === 1)

  if (!process.exitCode) console.log('blockers lib self-test passed (17 cases)')
}

if (process.argv[1] && process.argv[1].endsWith('blockers.mjs') && process.argv.includes('--self-test')) {
  selfTest()
}
