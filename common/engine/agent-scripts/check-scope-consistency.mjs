#!/usr/bin/env node
// Validate feature (F-id) scope-status consistency across a PR's product docs.
//
// 背景（PR-01930 F20）：某 F-item 被 PRD 划删/移出范围后，回退记录只同步进了部分文档
// （00-feature-inventory + 03-api-contract），01-scope-and-phases / 04-frontend-tasks 仍写「已落/已做」。
// 口径不一致 → AI 报状态时读到过时的「活项」，把已划删的功能当成还在追的任务。
//
// SSOT 约定：`00-feature-inventory.md` 是每个 PR 的功能状态**单一真相源**。本检查只做一件事、
// 高信号低噪声：**SSOT 里判为「移出范围」的 F-id，其它 product 文档不得再标「已落/已做/已实现」**。
// （延后项 D1/D2/D3=F18/F19 那类「占位已落 + 待后端」是合法的，不在本检查范围，避免误报。）

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveRoots } from './lib/roots.mjs'

const SSOT_FILE = '00-feature-inventory.md'
const FID_RE = /F\d{2}/g
// 「移出范围」判定 token：命中任一即视为该行把相关 F-id 标为出范围。
const OUT_TOKENS = ['移出范围', '划删', '划移出', '已回退', '✂']
// 「已做/活项」判定 token。
const DONE_TOKENS = ['已落', '已做', '已实现', '✅', '☑']

const hasAny = (line, tokens) => tokens.some((token) => line.includes(token))
const fidsIn = (line) => [...new Set(line.match(FID_RE) || [])]

// SSOT 中判为「移出范围」的 F-id 集合。
// 只认「表格行 + 行首单元格恰好一个 F-id + 整行带出范围 token」的**专属行**（如 F20 专属行）作权威声明；
// 聚合行（行首是 `F17-F22 …` 范围、把 F20 划删写在括注里）与散文行不算，否则会把范围里的 F17/F22 误判出范围。
export const findOutOfScope = (ssotText) => {
  const set = new Set()
  for (const line of ssotText.split('\n')) {
    if (!line.trim().startsWith('|') || !hasAny(line, OUT_TOKENS)) continue
    const firstCell = line.split('|').map((cell) => cell.trim()).filter(Boolean)[0] || ''
    const keyFids = fidsIn(firstCell)
    if (keyFids.length === 1) set.add(keyFids[0])
  }
  return set
}

// 在非 SSOT 文档里找「提到出范围 F-id + 带已做 token + 本行无出范围 token」的行 → 冲突。
// 本行自带出范围 token 时跳过（如「~~F20~~ … 移出范围」这类已对齐的行，或「F21 已落（F20 移出）」的混写行）。
export const findConflicts = ({ outOfScope, docs }) => {
  const errors = []
  for (const { file, text } of docs) {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (hasAny(line, OUT_TOKENS)) continue
      if (!hasAny(line, DONE_TOKENS)) continue
      const hit = fidsIn(line).filter((fid) => outOfScope.has(fid))
      if (hit.length) {
        errors.push(`${file}:${i + 1}: ${hit.join('/')} 在 ${SSOT_FILE} 判为移出范围，但此处标为「已做」：${line.trim().slice(0, 90)}`)
      }
    }
  }
  return errors
}

const productDocs = (productDir) =>
  readdirSync(productDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)

// 校验单个 PR：读 SSOT 取出范围集，再核对其它 product 文档。返回 errors[]。
export const checkProject = ({ prdsRoot, project }) => {
  const productDir = join(prdsRoot, project, 'product')
  const ssotPath = join(productDir, SSOT_FILE)
  if (!existsSync(ssotPath)) return []
  const outOfScope = findOutOfScope(readFileSync(ssotPath, 'utf8'))
  if (!outOfScope.size) return []
  const docs = productDocs(productDir)
    .filter((name) => name !== SSOT_FILE)
    .map((name) => ({ file: join(productDir, name), text: readFileSync(join(productDir, name), 'utf8') }))
  return findConflicts({ outOfScope, docs })
}

const listProjects = (prdsRoot) =>
  existsSync(prdsRoot)
    ? readdirSync(prdsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : []

function selfTest() {
  const ssot = [
    '| ~~F17-F22 后台联动枚举~~ | 第二轮已落地（+ F20 已随 PRD 划删移出范围） | 已实现 |', // 聚合行：不得把 F17/F22 判出范围
    '| ~~F20~~ | 移出范围（PRD 划删） | ✂ 已回退 |', // 专属行：F20 出范围
    '| F17 | 体验金明细 | 已落 |',
  ].join('\n')
  const outOfScope = findOutOfScope(ssot)
  const cases = [
    { name: 'ssot picks only dedicated-row out-of-scope fid', pass: outOfScope.has('F20') && !outOfScope.has('F17') && !outOfScope.has('F22') },
    {
      name: 'stale done row flagged',
      pass: findConflicts({ outOfScope, docs: [{ file: 'x', text: '| F20 | 资产流水 | ✅ 已落 |' }] }).length === 1,
    },
    {
      name: 'aligned out-of-scope row not flagged',
      pass: findConflicts({ outOfScope, docs: [{ file: 'x', text: '| ~~F20~~ | ✂ 移出范围 |' }] }).length === 0,
    },
    {
      name: 'mixed line with out token skipped',
      pass: findConflicts({ outOfScope, docs: [{ file: 'x', text: 'F21 已落（F20 移出范围）' }] }).length === 0,
    },
    {
      name: 'unrelated done fid not flagged',
      pass: findConflicts({ outOfScope, docs: [{ file: 'x', text: '| F17 | 明细 | ✅ 已落 |' }] }).length === 0,
    },
  ]
  for (const testCase of cases) {
    if (!testCase.pass) {
      console.error(`[check-scope-consistency] self-test failed: ${testCase.name}`)
      process.exit(1)
    }
  }
  console.log('PASS scope-status consistency policy')
}

if (process.argv.includes('--help')) {
  console.log(`usage: check-scope-consistency.mjs [PR-01234] [--self-test]

校验 F-item 范围状态在各 product 文档间一致：SSOT(${SSOT_FILE}) 判为移出范围的 F-id，
其它文档不得再标「已落/已做/已实现」。省略 PR 时扫全部 prds/*。`)
  process.exit(0)
}

if (process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

const prdsRoot = join(resolveRoots().docsSystemRoot, 'prds')
const arg = process.argv.slice(2).find((token) => /^PR-\d{5}$/.test(token))
const projects = arg ? [arg] : listProjects(prdsRoot)
const errors = projects.flatMap((project) =>
  checkProject({ prdsRoot, project }).map((message) => `[${project}] ${message}`),
)

if (errors.length) {
  console.error(`❌ 功能范围状态口径不一致（SSOT ${SSOT_FILE} 已划删，他处仍标已做）：\n${errors.map((item) => `   ${item}`).join('\n')}`)
  process.exit(1)
}

console.log(`✅ 范围状态口径一致：核对 ${projects.length} 个 PR，无「已划删却仍标已做」的文档漂移。`)
