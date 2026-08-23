#!/usr/bin/env node
// rule ID 台账（common/rules/rule-id-ledger.md）与规则档位表（common/rules/ruleset.json）的
// 一致性判定源。check-doc-budget 校验 5b 消费它。
//
// 为什么必须有这层反向校验：verify-project-gate 的两条闸都以「ruleset 是否声明」为前提——
// 豁免闸判「显式 waivable:true」（未声明 = 拒绝豁免），severity 定档只对已声明规则生效
// （未声明 = 沿用脚本默认档）。所以「漏声明」不是无害缺省，而是规则语义未定义，
// 必须在加规则那一刻就拦住，而不是等某个项目豁免失败才发现。
//
// 纯函数、无 I/O：调用方负责读盘，便于 --self-test 直接喂字符串。

const ID_CELL = /^`((?:CODE|DOC|GIT|VERIFY)-[A-Z0-9]+(?:-[A-Z]+)*-\d+)`$/

// 解析 rule-id-ledger.md 的表格行 → { id, severity }。
// 只认这一个文件：它的末列固定是 severity；rule-ids-and-gates.md 的表列不同构（末列是扫描口径）。
export function parseLedgerRows(text) {
  const rows = []
  for (const line of String(text || '').split('\n')) {
    if (!line.startsWith('|')) continue
    const cells = line.split('|').map((cell) => cell.trim())
    const matched = (cells[1] || '').match(ID_CELL)
    if (!matched) continue
    rows.push({ id: matched[1], severity: cells[cells.length - 2] || '' })
  }
  return rows
}

// 双档规则（severity 写 `error/warn`，如 GIT-G4-*）由脚本按场景决定档位，一旦登记就会被
// 定档循环强推成 error，故不要求声明。
const requiresDeclaration = (severity) => severity.startsWith('error') && !severity.includes('/')

const declared = (rule) => Boolean(rule) && typeof rule.blocking === 'boolean' && typeof rule.waivable === 'boolean'

export function undeclaredErrorRules({ ledgerText, rulesetRules }) {
  const rules = rulesetRules || {}
  return parseLedgerRows(ledgerText)
    .filter((row) => requiresDeclaration(row.severity) && !declared(rules[row.id]))
    .map((row) => row.id)
    .sort()
}

function selfTest() {
  const assert = (name, condition) => {
    if (!condition) {
      console.error(`FAIL ${name}`)
      process.exitCode = 1
    }
  }
  const ledgerText = [
    '| Rule ID | Gate | 说明 | 档位 |',
    '|---|---|---|---|',
    '| `DOC-X-001` | G5 | 已声明 | error |',
    '| `DOC-X-002` | G5 | 未声明 | error |',
    '| `DOC-G3-IMPL-006` | G3+ | 多节 ID | error |',
    '| `DOC-X-003` | G5 | warn 不要求声明 | warn |',
    '| `GIT-X-001` | G4 | 双档不要求声明 | error/warn |',
    '| `DOC-X-004` | G5 | 声明不完整 | error（不可豁免） |',
    '正文行不该被当成表格 | `DOC-X-999` |',
  ].join('\n')
  // 夹具 ID 用拼接构造：check-doc-budget 校验 5 会把脚本里单引号包裹的 rule ID 视作「已实装」
  // 并要求登记台账，写成单引号字面量会污染那条校验。
  const id = (suffix) => `DOC-${suffix}`
  const rulesetRules = {
    [id('X-001')]: { maturity: 'stable', blocking: true, waivable: false },
    [id('G3-IMPL-006')]: { maturity: 'trial', blocking: true, waivable: false },
    [id('X-004')]: { maturity: 'stable', blocking: true },
  }
  const rows = parseLedgerRows(ledgerText)
  assert('只解析以 | 开头的表格行', !rows.some((row) => row.id === id('X-999')))
  assert('解析出全部 6 个 ID', rows.length === 6)
  assert('多节 ID 可解析', rows.some((row) => row.id === id('G3-IMPL-006')))
  const missing = undeclaredErrorRules({ ledgerText, rulesetRules })
  assert('未声明的 error 规则被报出', missing.includes(id('X-002')))
  assert('waivable 缺失算未声明', missing.includes(id('X-004')))
  assert('已声明不报', !missing.includes(id('X-001')) && !missing.includes(id('G3-IMPL-006')))
  assert('warn 档不要求声明', !missing.includes(id('X-003')))
  assert('双档不要求声明', !missing.includes(`GIT-${'X-001'}`))
  assert('结果有序', missing.join() === [...missing].sort().join())
  assert('ruleset 为空 → 全部 error 规则待声明', undeclaredErrorRules({ ledgerText, rulesetRules: null }).length === 4)
  assert('空文本 → 空结果', undeclaredErrorRules({ ledgerText: '', rulesetRules }).length === 0)
  if (!process.exitCode) console.log('rule-ledger lib self-test passed (11 cases)')
}

if (process.argv[1] && process.argv[1].endsWith('rule-ledger.mjs') && process.argv.includes('--self-test')) {
  selfTest()
}
