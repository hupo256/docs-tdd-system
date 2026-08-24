#!/usr/bin/env node
/**
 * `docs-tdd explain <RULE-ID>`：门禁失败后按需拉取单条规则的台账与修复指引，而不是把整篇
 * rule-ids-and-gates.md（28KB）塞进 context pack。配合 brief 模式——机器/参考型正文默认折成指针，
 * 真正需要某条规则细节时才用本命令定向展开。
 *
 * 数据源：rule-id-ledger.md（阶段 gate 类台账表）+ rule-ids-and-gates.md（CODE / VERIFY / §4 豁免）。
 * 二者都是「机器查表、从不路由进 pack」的 COVERAGE_EXEMPT 文档，按 RULE-ID 精确切片即可。
 */

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rulesRoot } from './roots.mjs'

const RULE_ID_RE = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/

// 从一份文档里抓所有「用反引号包住该 RULE-ID」的行（台账表行或正文引用），保留原始行号。
function grepRuleLines(file, ruleId) {
  if (!existsSync(file)) return []
  const needle = `\`${ruleId}\``
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((text, index) => ({ line: index + 1, text }))
    .filter(({ text }) => text.includes(needle))
}

export function explainRule(ruleId) {
  if (!ruleId || !RULE_ID_RE.test(ruleId)) {
    console.error(`usage: docs-tdd explain <RULE-ID>（如 CODE-MAPPER-001 / VERIFY-TYPE-001 / DOC-G2-004）`)
    return 1
  }
  const ledger = join(rulesRoot, 'rule-id-ledger.md')
  const gates = join(rulesRoot, 'rule-ids-and-gates.md')
  const hits = [
    { file: 'rule-id-ledger.md', lines: grepRuleLines(ledger, ruleId) },
    { file: 'rule-ids-and-gates.md', lines: grepRuleLines(gates, ruleId) },
  ].filter(({ lines }) => lines.length > 0)

  if (hits.length === 0) {
    console.error(`[explain] 未在台账中找到 ${ruleId}；确认 RULE-ID 是否正确，或读 common/rules/rule-ids-and-gates.md。`)
    return 1
  }

  console.log(`# ${ruleId}\n`)
  for (const { file, lines } of hits) {
    console.log(`## ${file}`)
    for (const { line, text } of lines) console.log(`  L${line}: ${text.trim()}`)
    console.log('')
  }
  console.log('修复：按上表「机器检查」列补齐对应文档/代码，再重跑 `docs-tdd changed <PR>` 或对应 `docs-tdd gate <PR> <Gx>`。')
  return 0
}

// ---------------------------------------------------------------------------
// self-test：纯函数（RULE-ID 正则 + 反引号行抓取）。node lib/explain-rule.mjs --self-test
// ---------------------------------------------------------------------------
function selfTest() {
  const assert = (cond, msg) => { if (!cond) { console.error(`[explain-rule] self-test failed: ${msg}`); process.exit(1) } }
  // RULE-ID 形状：大写段 + 至少一个连字符段；拒绝小写 / 无连字符。
  for (const ok of ['CODE-MAPPER-001', 'VERIFY-TYPE-001', 'DOC-G2-004']) assert(RULE_ID_RE.test(ok), `accept ${ok}`)
  for (const bad of ['foo', 'code-mapper-001', 'CODE', 'CODE_MAPPER', '']) assert(!RULE_ID_RE.test(bad), `reject ${bad}`)
  // grepRuleLines：只命中反引号包裹的该 RULE-ID 行，保留行号；裸串 / 别的 ID 不算。
  const tmp = join(tmpdir(), 'explain-rule-selftest.md')
  writeFileSync(tmp, ['# t', '| `CODE-MAPPER-001` | 触发 | tsc |', 'CODE-MAPPER-001 裸串不算', '| `CODE-MAPPER-002` | 别的 |'].join('\n'))
  try {
    const hits = grepRuleLines(tmp, 'CODE-MAPPER-001')
    assert(hits.length === 1 && hits[0].line === 2, 'grep matches only backticked line with lineno')
    assert(grepRuleLines(join(tmpdir(), 'explain-rule-nope.md'), 'CODE-MAPPER-001').length === 0, 'missing file → empty')
  } finally {
    rmSync(tmp, { force: true })
  }
  console.log('PASS explain-rule (RULE_ID_RE + grepRuleLines)')
}

if (process.argv[1] && process.argv[1].endsWith('explain-rule.mjs') && process.argv.includes('--self-test')) selfTest()
