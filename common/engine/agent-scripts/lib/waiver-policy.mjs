#!/usr/bin/env node

// 豁免生命周期的单一语义源（见 rule-ids-and-gates.md §4）。
//
// 为什么这层判定是 error 而不是 warn：豁免是「我知道、我担责、到期我会回来」的书面承诺。
// 无期限、无 owner、无 reason、或者已过期还挂在台账上，说明承诺已经失效——此时继续用 warn
// 表达，两种错误方向（还没写全 / 已经过期）都指向「不用管」，台账只会越腐化。
// 注意：失效豁免本来就不会被套用（原规则照旧阻断），本层 error 追加的是「清理台账」的压力，
// 出口很便宜：续期、补 owner/reason，或者删掉这条豁免。
import assert from 'node:assert/strict'

const REQUIRED_FIELDS = ['reason', 'owner', 'expiresAt']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 返回 { state, ruleId, message }：state=active 时 ruleId/message 为 null（可套用）。
export function classifyWaiver(waiver, today) {
  const id = waiver?.ruleId || '(no ruleId)'
  const missing = REQUIRED_FIELDS.filter((field) => !waiver?.[field])
  if (missing.length) {
    return { state: 'invalid', ruleId: 'DOC-WAIVER-002', message: `waiver for ${id} 缺 ${missing.join('/')}；不生效（豁免必须具名、有理由、有期限）` }
  }
  if (!ISO_DATE.test(String(waiver.expiresAt))) {
    return { state: 'invalid', ruleId: 'DOC-WAIVER-002', message: `waiver for ${id} 的 expiresAt=${waiver.expiresAt} 不是 YYYY-MM-DD；不生效` }
  }
  if (String(waiver.expiresAt) < today) {
    return { state: 'expired', ruleId: 'DOC-WAIVER-003', message: `waiver for ${id} 已于 ${waiver.expiresAt} 过期；不生效，原规则照旧阻断（续期、修掉或删除本条）` }
  }
  return { state: 'active', ruleId: null, message: null }
}

// 从台账里筛出「可套用」的豁免：生命周期为 active（具名、有理由、ISO 期限且未过期）。
// 三个执行器（verify-project-gate / verify-build-quality / verify-code-rules）共用同一判据，
// 避免出现「project-gate 认定 DOC-WAIVER-002 不生效、但 build-quality/code-rules 仍拿它降级」的口径分裂。
export function activeWaivers(waivers, today) {
  if (!Array.isArray(waivers)) return []
  return waivers.filter((waiver) => waiver?.ruleId && classifyWaiver(waiver, today).state === 'active')
}

// 命中判定：某条 error 是否被一条 active 豁免覆盖（ruleId 必配；waiver.file 存在时须精确匹配文件）。
export function isWaived(active, { ruleId, file }) {
  return active.some((waiver) => waiver.ruleId === ruleId && (!waiver.file || waiver.file === file))
}

export function selfTest() {
  const today = '2026-08-23'
  const base = { ruleId: 'DOC-G3-006', reason: 'r', owner: 'aven', expiresAt: '2026-09-30' }
  assert.equal(classifyWaiver(base, today).state, 'active', '完整且未过期的豁免应可套用')
  assert.equal(classifyWaiver({ ...base, expiresAt: today }, today).state, 'active', '当天到期仍算有效（按日粒度比较）')
  const expired = classifyWaiver({ ...base, expiresAt: '2026-08-22' }, today)
  assert.equal(expired.state, 'expired', '昨天到期应判 expired')
  assert.equal(expired.ruleId, 'DOC-WAIVER-003', 'expired 应报 DOC-WAIVER-003')
  for (const field of REQUIRED_FIELDS) {
    const partial = { ...base }
    delete partial[field]
    const verdict = classifyWaiver(partial, today)
    assert.equal(verdict.state, 'invalid', `缺 ${field} 应判 invalid`)
    assert.equal(verdict.ruleId, 'DOC-WAIVER-002', `缺 ${field} 应报 DOC-WAIVER-002`)
    assert.ok(verdict.message.includes(field), `消息应点名缺失字段 ${field}`)
  }
  assert.equal(classifyWaiver({ ...base, expiresAt: '2026/09/30' }, today).ruleId, 'DOC-WAIVER-002', '非 ISO 日期应判 invalid 而不是拿去字符串比较')
  assert.equal(classifyWaiver({ ...base, expiresAt: '30-09-2026' }, today).state, 'invalid', 'DD-MM-YYYY 会让字典序比较失真，必须先拦格式')
  assert.ok(classifyWaiver({ reason: 'r', owner: 'a', expiresAt: '2026-09-30' }, today).state === 'active', '无 ruleId 的条目由调用方跳过，本函数只判生命周期')
  // activeWaivers / isWaived：三执行器共用的套用判据，只放行 active，且缺 ruleId 的条目被丢弃。
  const pool = [base, { ...base, ruleId: 'DOC-G3-005', owner: '' }, { ...base, ruleId: 'DOC-G3-007', expiresAt: '2020-01-01' }, { reason: 'r', owner: 'a', expiresAt: '2026-09-30' }]
  const active = activeWaivers(pool, today)
  assert.deepEqual(active.map((waiver) => waiver.ruleId), ['DOC-G3-006'], 'activeWaivers 只应留下具名齐备且未过期的条目')
  assert.equal(activeWaivers('not-an-array', today).length, 0, '非数组台账应安全返回空')
  assert.ok(isWaived(active, { ruleId: 'DOC-G3-006', file: 'a.md' }), 'ruleId 命中且 waiver 无 file 约束时应算覆盖')
  assert.ok(!isWaived(active, { ruleId: 'DOC-G3-005', file: 'a.md' }), '未在 active 台账中的 ruleId 不应被覆盖')
  assert.ok(isWaived([{ ruleId: 'X', file: 'b.ts' }], { ruleId: 'X', file: 'b.ts' }) && !isWaived([{ ruleId: 'X', file: 'b.ts' }], { ruleId: 'X', file: 'c.ts' }), 'waiver.file 存在时须精确匹配文件')
  console.log('PASS waiver-policy (豁免生命周期判定)')
}

if (process.argv[1] && process.argv[1].endsWith('waiver-policy.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
