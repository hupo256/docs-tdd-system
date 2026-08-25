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
import { remedyFor } from './project-decision.mjs'

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

// 若 RULE-ID 自身是小节标题，连同该小节正文一起返回，避免只显示标题却丢掉执行契约。
function ruleSections(file, ruleId) {
  if (!existsSync(file)) return []
  const lines = readFileSync(file, 'utf8').split('\n')
  const needle = `\`${ruleId}\``
  const blocks = []
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^(#{2,6})\s+/.exec(lines[index])
    if (!heading || !lines[index].includes(needle)) continue
    let end = index + 1
    while (end < lines.length) {
      const next = /^(#{2,6})\s+/.exec(lines[end])
      if (next && next[1].length <= heading[1].length) break
      end += 1
    }
    blocks.push({ line: index + 1, text: lines.slice(index, end).join('\n').trim() })
  }
  return blocks
}

export function explainRule(ruleId) {
  if (!ruleId || !RULE_ID_RE.test(ruleId)) {
    console.error(`usage: docs-tdd explain <RULE-ID>（如 CODE-MAPPER-001 / VERIFY-TYPE-001 / DOC-G2-004）`)
    return 1
  }
  const ledger = join(rulesRoot, 'rule-id-ledger.md')
  const gates = join(rulesRoot, 'rule-ids-and-gates.md')
  const hits = [
    { file: 'rule-id-ledger.md', lines: grepRuleLines(ledger, ruleId), sections: ruleSections(ledger, ruleId) },
    { file: 'rule-ids-and-gates.md', lines: grepRuleLines(gates, ruleId), sections: ruleSections(gates, ruleId) },
  ].filter(({ lines, sections }) => lines.length > 0 || sections.length > 0)

  if (hits.length === 0) {
    console.error(`[explain] 未在台账中找到 ${ruleId}；确认 RULE-ID 是否正确，或读 common/rules/rule-ids-and-gates.md。`)
    return 1
  }

  console.log(`# ${ruleId}\n`)
  let primaryCheck = ''
  let detailedRemedy = ''
  for (const { file, lines, sections } of hits) {
    console.log(`## ${file}`)
    const sectionLines = new Set(sections.flatMap(({ text }) => text.split('\n').map((line) => line.trim())))
    for (const { line, text } of lines) {
      if (sectionLines.has(text.trim())) continue
      console.log(`  L${line}: ${text.trim()}`)
      const cells = text.split('|').map((cell) => cell.trim()).filter(Boolean)
      if (!primaryCheck && cells.length >= 3) primaryCheck = cells[2]
    }
    for (const { line, text } of sections) {
      console.log(`\nL${line}:\n${text}`)
      detailedRemedy ||= text.split('\n').find((value) => value.includes('**Failure**'))?.replace(/^[-*\s]+\*\*Failure\*\*[:：]\s*/, '') || ''
    }
    console.log('')
  }
  console.log(`建议修复：${detailedRemedy || remedyFor(ruleId, primaryCheck)}`)
  console.log('重跑：`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed <PR>` 或对应 `.../docs-tdd.mjs gate <PR> <Gx>`。')
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
    writeFileSync(tmp, ['# t', '### 3.1 `CODE-ARCH-003` contract', '', 'trigger', '', '#### detail', 'fix', '', '### 3.2 next'].join('\n'))
    const sections = ruleSections(tmp, 'CODE-ARCH-003')
    assert(sections.length === 1 && sections[0].text.includes('trigger') && sections[0].text.includes('fix') && !sections[0].text.includes('3.2 next'), 'heading match includes complete rule section')
  } finally {
    rmSync(tmp, { force: true })
  }
  console.log('PASS explain-rule (RULE_ID_RE + grepRuleLines)')
}

if (process.argv[1] && process.argv[1].endsWith('explain-rule.mjs') && process.argv.includes('--self-test')) selfTest()
