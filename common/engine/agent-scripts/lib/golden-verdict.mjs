#!/usr/bin/env node
// golden-run 的变异判定核心（纯函数）：从 checks 里挑 error 级失败，判定「预期规则命中且无连带误伤」。
// 抽成独立 lib 便于 --self-test 单测（被 check-doc-budget 的 SELF_TEST_SCRIPTS 驱动）。

import assert from 'node:assert/strict'

// 基线里允许存在的非 error 级项：warn/waived 不参与「误伤」判定，否则夹具得为每条 warn 造数据。
export function errorFailures(checks) {
  return (checks || []).filter((check) => !check.ok && check.severity === 'error').map((check) => check.ruleId)
}

// 变异用例的判定核心：预期规则必须命中，且不得牵连任何基线之外的 error 规则。
export function mutationVerdict({ expectRuleId, checks, baselineFailures = [] }) {
  const failures = errorFailures(checks)
  const hit = failures.includes(expectRuleId)
  const collateral = failures.filter((ruleId) => ruleId !== expectRuleId && !baselineFailures.includes(ruleId))
  return { ok: hit && collateral.length === 0, hit, collateral, failures }
}

export function selfTest() {
  const cases = [
    { name: '命中且无连带', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }] }, expectOk: true },
    { name: '规则没命中', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-005', ok: false, severity: 'error' }] }, expectOk: false },
    { name: '有连带误伤', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G0-001', ok: false, severity: 'error' }] }, expectOk: false },
    { name: '连带在 tolerate 内', input: { expectRuleId: 'DOC-G2-004', baselineFailures: ['DOC-G0-001'], checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G0-001', ok: false, severity: 'error' }] }, expectOk: true },
    { name: 'warn 不算连带', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G0-004', ok: false, severity: 'warn' }] }, expectOk: true },
    { name: 'waived 不算连带', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G3-005', ok: false, severity: 'waived' }] }, expectOk: true },
    { name: '通过项不算失败', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G2-005', ok: true, severity: 'error' }] }, expectOk: true },
  ]
  for (const testCase of cases) {
    const verdict = mutationVerdict(testCase.input)
    assert.equal(verdict.ok, testCase.expectOk, `self-test failed: ${testCase.name} => ${JSON.stringify(verdict)}`)
  }
  assert.equal(errorFailures([{ ruleId: 'A', ok: false, severity: 'error' }, { ruleId: 'B', ok: false, severity: 'warn' }]).join(','), 'A', 'self-test failed: errorFailures 应只收 error 级')
  console.log(`golden-verdict self-test passed (${cases.length + 1} predicate cases)`)
}

if (process.argv[1] && process.argv[1].endsWith('golden-verdict.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
