#!/usr/bin/env node
// Generate a compact, structured project context-summary.md from current project docs.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideNext, nextGateOf } from './lib/project-decision.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const args = process.argv.slice(2)
const projectId = args[0]
const write = args.includes('--write')
const dryRun = args.includes('--dry-run') || !write
const SUMMARY_TARGET = 1800
const SUMMARY_HARD_LIMIT = 2200

function printHelp() {
  console.log(`usage: update-context-summary.mjs <PR-01234> [--stage <G0-G8>] [--write|--dry-run] [--self-test] [--help]

Generate a compact, structured context-summary.md from current project docs.

Options:
  --help       Show this help message and exit
  --stage      Gate stage to write into the summary (default: G0)
  --write      Persist context-summary.md
  --dry-run    Print to stdout without writing (default if --write omitted)
  --self-test  Run inline self-test`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

if (args.includes('--self-test')) {
  const sample = `## 功能清单

| ID | 功能 | 本期 | 备注 |
|----|------|------|------|
| F01 | A | 做 | - |
| F02 | B | 不做（延期外） | - |
| F03 | C | 延期 | - |
`
  const table = markdownTable(sample, '## 功能清单')
  const scope = table.headers.findIndex((header) => header === '本期')
  const actual = [
    countFeatureRows(table.rows, scope, '做'),
    countFeatureRows(table.rows, scope, '不做'),
    countFeatureRows(table.rows, scope, '延期'),
  ]
  const expected = [1, 1, 1]
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`[update-context-summary] self-test failed: expected ${expected.join('/')} got ${actual.join('/')}`)
    process.exit(1)
  }
  if (SUMMARY_TARGET !== 1800 || SUMMARY_HARD_LIMIT !== 2200) {
    console.error('[update-context-summary] self-test failed: summary budget drifted')
    process.exit(1)
  }
  const stageBlockers = stageStatusRows({
    stages: {
      G5: { status: 'blocked', reason: '真实接口未 ready。' },
      G7: { status: 'pending', reason: '待 G6 通过。' },
    },
  })
  if (stageBlockers.length !== 1 || !stageBlockers[0].includes('G5 blocked') || stageBlockers[0].includes('G7')) {
    console.error('[update-context-summary] self-test failed: blocked stage status parsing')
    process.exit(1)
  }
  // Next Action stage-aware：有 blocker 优先处理；否则按最近通过阶段指向下一 gate（G3→G5 跳号也要对）。
  if (!nextActionText(['x'], null, null).includes('blocker')) {
    console.error('[update-context-summary] self-test failed: blocker next-action')
    process.exit(1)
  }
  if (!nextActionText([], null, { gate: 'G3', at: '2026-01-01' }).includes('执行 G4')) {
    console.error('[update-context-summary] self-test failed: stage-aware next gate (G3→G4)')
    process.exit(1)
  }
  if (!nextActionText([], { gate: 'G8', ok: true, checks: [] }, { gate: 'G8', at: '2026-01-01' }).includes('无下一 gate')) {
    console.error('[update-context-summary] self-test failed: terminal gate next-action')
    process.exit(1)
  }
  if (!nextActionText([], { gate: 'G6-partial', ok: true, checks: [] }, { gate: 'G6-partial', at: '2026-01-01' }).includes('对账')) {
    console.error('[update-context-summary] self-test failed: G6-partial next-action')
    process.exit(1)
  }
  console.log('PASS scope column parsing')
  process.exit(0)
}

function readOption(name, fallback = '') {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

function fail(message) {
  console.error(`[update-context-summary] ${message}`)
  process.exit(1)
}

if (!/^PR-\d{5}$/.test(projectId || '')) {
  fail('usage: update-context-summary.mjs PR-01234 [--stage G6] [--write|--dry-run]')
}

const stage = readOption('--stage', 'G0')
if (!/^G[0-8](\s+.+)?$/.test(stage)) fail('--stage must start with G0..G8')

const projectDir = resolveProjectRoot(projectId)
if (!existsSync(projectDir)) fail(`project directory does not exist: ${relative(repoRoot, projectDir)}`)

function read(pathFromProject) {
  const file = join(projectDir, pathFromProject)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function tableValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+?)\\s*\\|`))
  return match ? match[1].trim() : ''
}

function markdownTable(text, heading) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return { headers: [], rows: [] }
  const tableRows = []
  let seenHeader = false
  let seenDivider = false
  let headers = []
  let pendingHeader = []
  const rows = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (index > start + 1 && line.startsWith('## ')) break
    if (!line.startsWith('|')) continue
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
    if (/^\|[-: |]+\|$/.test(line)) {
      if (pendingHeader.length && !seenHeader) {
        headers = pendingHeader
        seenHeader = true
      }
      seenDivider = true
      continue
    }
    if (!seenDivider) {
      pendingHeader = cells
      continue
    }
    tableRows.push(cells)
  }
  if (!seenHeader && tableRows.length) {
    headers = tableRows[0]
    rows.push(...tableRows.slice(1))
  } else {
    rows.push(...tableRows)
  }
  return { headers, rows }
}

function markdownTableRows(text, heading) {
  return markdownTable(text, heading).rows
}

function normalizedScopeStatus(row, scopeIndex) {
  const value = row[scopeIndex] || ''
  if (/不做/.test(value)) return '不做'
  if (/延期/.test(value)) return '延期'
  if (/^\s*做\s*$/.test(value) || /^做(?:\W|$)/.test(value)) return '做'
  return '未定'
}

function countFeatureRows(rows, scopeIndex, expected) {
  if (scopeIndex < 0) return 0
  return rows.filter((row) => normalizedScopeStatus(row, scopeIndex) === expected).length
}

function pendingRows(text) {
  return markdownTableRows(text, '## 待确认（剩余开放项）')
    .filter((row) => row.some((cell) => /待|阻塞|补充|确认/.test(cell)))
    .map((row) => `${row[1] || row[0] || '待确认'}（${row[4] || row[2] || '待确认'}）`)
}

function stageStatusRows(data) {
  return Object.entries(data?.stages || {})
    .filter(([, value]) => value?.status === 'blocked')
    .map(([gate, value]) => `${gate} blocked：${value.reason || '未记录阻塞原因'}`)
}

function readStageStatus() {
  const file = join(projectDir, 'agent/stage-status.json')
  if (!existsSync(file)) return []
  try {
    return stageStatusRows(JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    return [`stage-status 无法解析：${error.message}`]
  }
}

function fingerprint(text) {
  let value = 2166136261
  for (const char of text) {
    value ^= char.codePointAt(0)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(16).padStart(8, '0')
}

function gateRows() {
  const file = join(projectDir, 'agent/gate-results.json')
  if (!existsSync(file)) return []
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    const status = data.ok ? '通过' : '阻塞'
    const fail = data.summary?.fail ?? 0
    const warn = data.summary?.warn ?? 0
    return [`| ${data.gate || 'gate'} | ${status} | ${data.generatedAt || ''} | fail=${fail}, warn=${warn} |`]
  } catch (error) {
    return [`| gate-results | 无法解析 | | ${error.message.replace(/\|/g, '/')} |`]
  }
}

function latestGateResult() {
  const file = join(projectDir, 'agent/gate-results.json')
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

// 最近一次「通过」验证（resume 用）：gate-history 只记 PASS，取末条即最近验证过的阶段。
// 兼顾 { runs: [...] } 与裸数组两种历史结构；返回 { gate, at } 或 null。
function latestPassedGate() {
  const file = join(projectDir, 'agent/gate-history.json')
  if (!existsSync(file)) return null
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    const runs = Array.isArray(data) ? data : Array.isArray(data.runs) ? data.runs : []
    const passed = runs.filter((run) => run?.ok)
    const last = passed[passed.length - 1]
    return last ? { gate: last.gate || 'gate', at: (last.generatedAt || '').slice(0, 10) } : null
  } catch {
    return null
  }
}

// 下一步（stage-aware）：优先「处理首个 blocker」；否则按最近通过阶段指向下一 gate。
function nextActionText(pending, gateResult, lastPass) {
  if (pending.length) return '处理首个 blocker，更新对应项目文档，再重跑对应 gate。'
  if (gateResult?.gate) {
    const decision = decideNext({ projectId, projectExists: true, gateResult })
    if (decision.status === 'complete') return '已通过 G8，无下一 gate；代码、规则或契约变化后重新验证。'
    if (decision.status === 'waiting_reconcile') return `完成真实字段对账后重跑完整 G6：${decision.command}`
    if (decision.command) return `执行：${decision.command}`
  }
  const next = nextGateOf(lastPass?.gate)
  return next ? `执行 ${next}（最近通过 ${lastPass.gate}）；阶段或契约变化后重生成本摘要。` : '执行当前阶段 gate；阶段或契约变化后重生成本摘要。'
}

const inventory = read('product/00-feature-inventory.md')
const collaboration = read('product/06-collaboration.md')
const featureTable = markdownTable(inventory, '## 功能清单')
const featureRows = featureTable.rows
const scopeIndex = featureTable.headers.findIndex((header) => header === '本期')
const pending = [...readStageStatus(), ...pendingRows(collaboration)]
const gates = gateRows()
const lastPass = latestPassedGate()
const gateResult = latestGateResult()
const now = new Date().toISOString()

const prd = tableValue(inventory, 'PRD 来源') || '待补'
const figma = tableValue(inventory, 'Figma 主画板') || tableValue(inventory, 'Figma 主画板（web）') || '待补'
const modulePaths = tableValue(inventory, '责任模块目录') || '待 G2 确认'
const g2 = tableValue(inventory, 'G2 确认人 & 日期') || '待确认'
const prdManifest = read('agent/prd-source-manifest.json')
const prdFingerprint = prdManifest
  ? (() => {
      try { return JSON.parse(prdManifest).approvedFingerprint || 'unapproved' } catch { return 'invalid' }
    })()
  : 'not-enabled'
const effectiveRulesFile = join(docsRoot, 'common/effective-rules.json')
const rulesFingerprint = existsSync(effectiveRulesFile)
  ? (() => {
      try { return JSON.parse(readFileSync(effectiveRulesFile, 'utf8')).fingerprint?.slice(0, 12) || 'unknown' } catch { return 'invalid' }
    })()
  : 'missing'
const contractFingerprint = fingerprint(read('product/03-api-contract.md'))

const content = `# ${projectId} Context Summary

> Generated by \`update-context-summary.mjs\`; project state only. Updated: ${now}

## Current State

| 字段 | 值 |
|------|-----|
| 项目 | ${projectId} |
| 当前阶段 | ${stage} |
| 最近通过 | ${lastPass ? `${lastPass.gate} @ ${lastPass.at}` : '未运行'} |
| PRD 来源 | ${prd} |
| Figma | ${figma} |
| G2 确认 | ${g2} |
| 责任模块目录 | ${modulePaths} |

## Scope / Fingerprints

| 做 | 不做 | 延期 | Blocker | PRD | Rules | Contract |
|----|------|------|---------|-----|-------|----------|
| ${countFeatureRows(featureRows, scopeIndex, '做')} | ${countFeatureRows(featureRows, scopeIndex, '不做')} | ${countFeatureRows(featureRows, scopeIndex, '延期')} | ${pending.length} | \`${prdFingerprint}\` | \`${rulesFingerprint}\` | \`${contractFingerprint}\` |

## Pending / Blockers

${pending.length ? pending.map((item) => `- ${item}`).join('\n') : '- 无机器可识别待确认项；交付前复核协作清单。'}

## Latest Gate Results

| Gate | 状态 | 时间 | 证据 |
|------|------|------|------|
${gates.length ? gates.join('\n') : '| G2/G6/G8 | 未运行 | | `agent/gate-results.json` |'}

> 本表是快照；代码是否仍与该 gate 一致以 \`docs-tdd context\` 的 gate 心跳为准，勿据此快照当作已通过。

## Next Action

- [ ] ${nextActionText(pending, gateResult, lastPass)}
`
const contentLength = Array.from(content).length
if (contentLength > SUMMARY_HARD_LIMIT) fail(`generated summary is ${contentLength} chars; hard limit=${SUMMARY_HARD_LIMIT}, target=${SUMMARY_TARGET}`)

const output = join(projectDir, 'agent/context-summary.md')
if (dryRun) {
  console.log(content)
} else {
  writeFileSync(output, content)
  console.log(`wrote ${relative(repoRoot, output)} (${contentLength} chars; target=${SUMMARY_TARGET})`)
}
