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
  console.log('PASS waiver-policy (豁免生命周期判定)')
}

if (process.argv[1] && process.argv[1].endsWith('waiver-policy.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
