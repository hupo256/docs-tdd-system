#!/usr/bin/env node

// 规则档位（severity）的单一真值源（见 rule-ids-and-gates.md line 19 的 maturity 语义）。
//
// 为什么要这层：ruleset.json 给每条规则声明了 { maturity, blocking, waivable }，但历史上定档只认
// blocking，maturity 是未消费的元数据。本 lib 把 maturity 接进定档，同时**行为保持**：
//   · experimental / stable：完全按 blocking 定档，与接线前逐位一致（很多 blocking:true 的
//     experimental 规则——如 DOC-PRD-* ——今天正当阻断，不能因为标了 experimental 就放松）。
//   · trial：在 blocking 基础上再按 `since` 向下收窄——规则是在 since 版模板才引入的，模板版本
//     低于 since 的**存量项目不被回溯阻断**（rule-ids-and-gates.md line 19「规则升级默认不回查
//     阻断存量项目」）。现存 trial 规则不带 since（视作 0）→ 恒阻断，与接线前一致；只有本批
//     显式带 since 的新规则（DOC-CONFIRM since:3、VERIFY-TEST-002 since:2）才产生「新项目才阻」。
//
// 纯函数、无 I/O：调用方负责读 ruleset 与 project-manifest，便于 --self-test 直接喂对象。
import assert from 'node:assert/strict'

// 项目对某条 trial 规则是否算「新项目」：模板版本 >= 规则引入版（since）。
// since 缺省视作 0 → 任何项目都达标（恒阻断，保持现存 trial 规则行为）。
export const projectMeetsRuleSince = ({ manifest, rule } = {}) =>
  (Number(manifest?.templateVersion) || 0) >= (Number(rule?.since) || 0)

// severity 单一真值源：给定规则声明 + 项目 manifest + 项目级 report-only 开关，返回 'warn' | 'error'。
// report-only 与免疫（waivable:false / reportOnlyExempt:true）语义原样沿用 verify-project-gate 既有实现。
export const resolveSeverity = ({ rule, manifest, projectReportOnly } = {}) => {
  if (!rule || !rule.blocking) return 'warn'
  // trial 规则晚于本项目模板引入 → 不回溯阻断存量项目，降 warn。
  if (rule.maturity === 'trial' && !projectMeetsRuleSince({ manifest, rule })) return 'warn'
  const immune = rule.waivable === false || rule.reportOnlyExempt === true
  return projectReportOnly && !immune ? 'warn' : 'error'
}

export function selfTest() {
  const v0 = { templateVersion: 0 }
  const v2 = { templateVersion: 2 }
  const v3 = { templateVersion: 3 }

  // 1) 非阻断规则永远 warn，与 maturity/项目无关
  assert.equal(resolveSeverity({ rule: { blocking: false, maturity: 'stable' }, manifest: v3 }), 'warn', 'blocking:false → warn')

  // 2) stable / experimental：认 blocking，不看 since，行为等同接线前
  for (const maturity of ['stable', 'experimental', undefined]) {
    assert.equal(resolveSeverity({ rule: { blocking: true, maturity }, manifest: v0 }), 'error', `${maturity} + blocking:true → error（不看 since）`)
  }

  // 3) trial 无 since：视作 0，恒阻断（保持现存 9 条 trial 规则行为）
  assert.equal(resolveSeverity({ rule: { blocking: true, maturity: 'trial' }, manifest: v0 }), 'error', 'trial 无 since → 任何项目都 error')

  // 4) trial + since 收窄：低于 since 的存量项目降 warn，达到 since 的新项目 error
  const confirm = { blocking: true, maturity: 'trial', waivable: true, since: 3 }
  assert.equal(resolveSeverity({ rule: confirm, manifest: v2 }), 'warn', 'trial since:3 对 v2 存量项目 → warn')
  assert.equal(resolveSeverity({ rule: confirm, manifest: v3 }), 'error', 'trial since:3 对 v3 新项目 → error')
  const test002 = { blocking: true, maturity: 'trial', waivable: true, since: 2 }
  assert.equal(resolveSeverity({ rule: test002, manifest: { templateVersion: 1 } }), 'warn', 'VERIFY-TEST-002 since:2 对 v1 → warn（等价旧 strictTestEvidence）')
  assert.equal(resolveSeverity({ rule: test002, manifest: v2 }), 'error', 'VERIFY-TEST-002 since:2 对 v2 → error（等价旧 strictTestEvidence）')

  // 5) report-only 降级：非免疫规则被降 warn；waivable:false 或 reportOnlyExempt 免疫仍 error
  assert.equal(resolveSeverity({ rule: { blocking: true, maturity: 'stable', waivable: true }, manifest: v3, projectReportOnly: true }), 'warn', 'report-only 降级可豁免规则')
  assert.equal(resolveSeverity({ rule: { blocking: true, maturity: 'stable', waivable: false }, manifest: v3, projectReportOnly: true }), 'error', 'report-only 不能盖住 waivable:false')
  assert.equal(resolveSeverity({ rule: { blocking: true, maturity: 'stable', reportOnlyExempt: true }, manifest: v3, projectReportOnly: true }), 'error', 'report-only 不能盖住 reportOnlyExempt')

  // 6) report-only 对达到 since 的 trial 规则同样按免疫判定（先过 since 再过 report-only）
  assert.equal(resolveSeverity({ rule: confirm, manifest: v3, projectReportOnly: true }), 'warn', 'v3 达 since 但项目 report-only 且规则可豁免 → warn')

  console.log('PASS rule-maturity (maturity→severity 单一真值源)')
}

if (process.argv[1] && process.argv[1].endsWith('rule-maturity.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
