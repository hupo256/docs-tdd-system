#!/usr/bin/env node
// G8 交付摘要的机器部分：从证据文件和 git 派生，而不是让 Agent 复述自己干过什么。
//
// 设计要点（对应 rule-execution-model.md §1 执行契约）：
// - Trigger：G8 交付前跑 `--project <PR-ID> --write`；G8 gate 之后跑才有完整 gate 历史。
// - Source：`agent/gate-results.json`（最近一次结论 + 命令退出码）、`agent/gate-history.json`
//   （各阶段真实 PASS 时点）、`agent/stage-status.json`、`agent/rule-waivers.json`、git diff。
// - 边界：机器只写能从证据推出来的第 1/2/3 段和第 4/5 段的机器线索；「产品/设计口径」这类
//   判断留 `<!-- 人工补充 -->` 占位，不代人拍板，也不用空话填满让人误以为已确认。
// - 摘要不含密钥/账号/Cookie/webhook URL；只输出文件路径、命令名、退出码和计数。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openBlockers } from './lib/blockers.mjs'
import { resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const worktreeRoot = (() => {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : repoRoot
})()

const args = process.argv.slice(2)
const GATES = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']
const MOCK_RESIDUE_PATTERNS = ['@mock-only', 'USE_MOCK', 'isMock']
const OUTPUT_RELATIVE = 'agent/delivery-summary.machine.md'

function readOption(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

function hasFlag(name) {
  return args.includes(name)
}

function printHelp() {
  console.log(`usage: render-delivery-summary.mjs --project <PR-ID> [--base <ref>] [--write] [--json] [--self-test] [--help]

Render the machine-derived part of the G8 delivery summary from gate evidence + git,
so the human-facing summary is not the agent narrating its own work.

Sections produced:
  1 改动     changed files grouped by module, derived from git
  2 验证     per-gate PASS timestamps from gate-history.json + command exit codes from gate-results.json
  3 功能清单 做 / 不做 / 延期 counts parsed from product/00-feature-inventory.md
  4 待确认   machine leads: unexpired waivers, ASSUMED placeholders, open collaboration items
  5 残留风险 machine leads: warn-level gate findings, mock residue hits

Options:
  --help       Show this help message and exit
  --project    Project ID (required unless --self-test)
  --base       Base ref for the changed-file diff (default: origin/online)
  --write      Write to <PROJECT>/${OUTPUT_RELATIVE} instead of stdout only
  --json       Output the structured facts as JSON to stdout
  --self-test  Run inline self-test`)
}

if (hasFlag('--help')) {
  printHelp()
  process.exit(0)
}

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

/* ------------------------------------------------------------------ helpers */

function runGit(gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: worktreeRoot, stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

function splitLines(value) {
  return value ? value.split('\n').map((line) => line.trim()).filter(Boolean) : []
}

function toPosix(value) {
  return value.split(sep).join('/')
}

function readJson(file) {
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    return { parseError: error.message }
  }
}

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

// 交付摘要的「改动」段按模块聚合：逐个文件列 60 行没人读，模块 + 计数才能一眼看出爆炸半径。
export function groupByModule(files) {
  const groups = new Map()
  for (const file of files) {
    const parts = file.split('/')
    // apps/web/src/apps/Prediction/x.tsx → apps/web/src/apps/Prediction；深度不足时退到父目录。
    const key = parts.length > 5 ? parts.slice(0, 5).join('/') : parts.slice(0, Math.max(1, parts.length - 1)).join('/')
    groups.set(key, (groups.get(key) || 0) + 1)
  }
  return [...groups.entries()]
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module))
}

// gate-history 是 append-only 的成功记录：每个阶段取最后一次 PASS，没有就是「无 PASS 历史」。
export function latestPassByGate(history) {
  const runs = Array.isArray(history?.runs) ? history.runs : []
  const latest = {}
  for (const run of runs) {
    if (!run?.gate || run.ok !== true) continue
    const previous = latest[run.gate]
    if (!previous || String(run.generatedAt) > String(previous.generatedAt)) latest[run.gate] = run
  }
  return latest
}

// 未过期豁免才算「仍待确认」；已过期的豁免不再生效，属于历史噪音，不进交付摘要。
export function activeWaivers(waiverFile, today) {
  const entries = Array.isArray(waiverFile?.waivers) ? waiverFile.waivers : Array.isArray(waiverFile) ? waiverFile : []
  return entries.filter((entry) => {
    if (!entry?.ruleId) return false
    if (!entry.expiresAt) return true
    return String(entry.expiresAt) >= today
  })
}

export function parseInventoryCounts(text) {
  const counts = { 做: 0, 不做: 0, 延期: 0 }
  for (const match of text.matchAll(/本期\s*[:：=]?\s*(做|不做|延期)/g)) counts[match[1]] += 1
  // 表格形态：`| F01 | ... | 做 | ...`，只认独立单元格，避免命中「不做的原因」这类叙述。
  for (const match of text.matchAll(/\|\s*(做|不做|延期)\s*\|/g)) counts[match[1]] += 1
  return counts
}

// 「待修复 / 未处理」是协作文档里的悬空项标记，G6 要求清零或转豁免，G8 必须如实列出来。
export function openCollaborationItems(text) {
  return splitLines(text)
    .filter((line) => /待修复|未处理|待确认/.test(line) && line.startsWith('|'))
    .map((line) => line.replace(/\s+/g, ' ').slice(0, 160))
}

export function severityBuckets(checks) {
  const list = Array.isArray(checks) ? checks : []
  return {
    fail: list.filter((check) => !check.ok && check.severity === 'error'),
    warn: list.filter((check) => !check.ok && check.severity === 'warn'),
    waived: list.filter((check) => !check.ok && check.severity === 'waived'),
  }
}

function grepCount(pattern, targets) {
  if (!targets.length) return { pattern, hits: 0, tool: 'skipped', files: [] }
  const probe = spawnSync('rg', ['--version'], { stdio: 'pipe' })
  if (probe.status !== 0) return { pattern, hits: 0, tool: 'unavailable', files: [] }
  const result = spawnSync('rg', ['--fixed-strings', '--files-with-matches', pattern, ...targets], {
    cwd: worktreeRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  const files = splitLines(result.stdout).map(toPosix)
  return { pattern, hits: files.length, tool: 'rg', files: files.slice(0, 10) }
}

/* ------------------------------------------------------------------ renderer */

export function renderSummary(facts) {
  const gateRows = GATES.map((gate) => {
    const pass = facts.gatePasses[gate]
    return `| ${gate} | ${pass ? 'PASS' : '—'} | ${pass ? pass.generatedAt.slice(0, 19).replace('T', ' ') : '无 PASS 历史'} | ${pass?.evidence || '—'} |`
  }).join('\n')

  const commandRows = facts.commands.length
    ? facts.commands.map((item) => `| \`${item.label}\` | exit=${item.status ?? 'null'} | ${item.ok ? 'PASS' : 'FAIL'} |`).join('\n')
    : '| 无 | | |'

  const moduleRows = facts.modules.length
    ? facts.modules.map((item) => `| ${item.module} | ${item.count} |`).join('\n')
    : '| 无改动文件（base 不可解析或工作区干净） | 0 |'

  const waiverRows = facts.waivers.length
    ? facts.waivers.map((item) => `| ${item.ruleId} | ${item.owner || '未登记'} | ${item.expiresAt || '无期限'} | ${(item.reason || '').replace(/\|/g, '/').slice(0, 120)} |`).join('\n')
    : '| 无 | | | |'

  const warnRows = facts.warn.length
    ? facts.warn.map((item) => `| ${item.ruleId} | ${(item.message || '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 160)} |`).join('\n')
    : '| 无 | |'

  const mockRows = facts.mockResidue.map((item) => `| \`${item.pattern}\` | ${item.tool === 'rg' ? item.hits : item.tool} | ${item.files.join('<br>') || '—'} |`).join('\n')

  const cell = (value) => String(value ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 160)
  const blockerRows = facts.openBlockers.length
    ? facts.openBlockers.map((item) => `| ${item.id} | ${item.owner} | ${item.blocksGate || '—'} | ${cell(item.summary)} |`).join('\n')
    : '| 无 | | | |'
  const changeRows = facts.openChanges.length
    ? facts.openChanges.map((item) => `| ${item.id} | ${item.owner} | ${item.blocksGate || '—'} | ${cell(item.summary)} |`).join('\n')
    : '| 无 | | | |'

  return `<!-- GENERATED by common/engine/agent-scripts/render-delivery-summary.mjs；机器段落勿手改，人工内容只写占位处 -->
# 交付摘要（机器段） — ${facts.projectId}

- 生成时间：${facts.generatedAt}
- 最近一次 gate：${facts.latestGate} → ${facts.latestGateOk ? 'PASS' : 'BLOCKED'}（${facts.latestGateAt || '未生成'}）
- 基线：\`${facts.baseRef}\`${facts.baseResolvable ? '' : '（不可解析，改动集仅含本地未提交部分）'}

## 1. 改动

共 ${facts.changedFileCount} 个文件：

| 模块 | 文件数 |
|------|--------|
${moduleRows}

## 2. 验证

阶段 PASS 历史（来自 append-only \`agent/gate-history.json\`）：

| 门禁 | 结论 | 时间 | 证据 |
|------|------|------|------|
${gateRows}

最近一次 gate 实际执行的命令（退出码来自真实子进程）：

| 命令 | 退出码 | 结论 |
|------|--------|------|
${commandRows}

机器事实层（biome / tsc / vitest）：${facts.buildQuality}

## 3. 功能清单

做 ${facts.inventory.做} / 不做 ${facts.inventory.不做} / 延期 ${facts.inventory.延期}（来源 \`product/00-feature-inventory.md\`${facts.inventoryFound ? '' : '，**文件缺失**'}）

## 4. 待确认（机器线索）

未解除的阻塞（来自结构化单一源 \`agent/blockers.json\`，非散文）：

| ID | Owner | 卡在 | 摘要 |
|----|-------|------|------|
${blockerRows}

未收口的需求变更（相对 PRD 的 delta，同源）：

| ID | Owner | 需在 | 摘要 |
|----|-------|------|------|
${changeRows}

生效中的规则豁免：

| Rule ID | Owner | 到期 | 理由 |
|---------|-------|------|------|
${waiverRows}

- 责任模块残留 \`// ASSUMED:\` 占位：${facts.assumedHits} 处${facts.assumedFiles.length ? `（${facts.assumedFiles.join('、')}）` : ''}
- \`06-collaboration.md\` 悬空项（含「待修复/未处理/待确认」的表格行，**散文线索非真值，以 \`blockers.json\` 为准**）：${facts.openItems.length} 条
${facts.openItems.length ? facts.openItems.map((line) => `  - ${line}`).join('\n') : '  - 无'}

<!-- 人工补充：产品/设计/后端/QA 仍需拍板的问题，机器判不了的写在这里 -->

## 5. 残留风险（机器线索）

未解除阻塞（同 §4，此处提示上线风险）：${facts.openBlockers.length ? facts.openBlockers.map((item) => `${item.id}(${item.category})`).join('、') : '无'}

Warn 级 findings（不阻断，但属于已知欠账）：

| Rule ID | Message |
|---------|---------|
${warnRows}

Mock 残留 grep：

| 模式 | 命中文件数 | 文件（最多 10 个） |
|------|-----------|-------------------|
${mockRows}

<!-- 人工补充：未覆盖场景、已知问题、上线注意事项 -->
`
}

/* ------------------------------------------------------------------ self-test */

function selfTest() {
  const cases = []
  const record = (name, condition) => {
    cases.push(name)
    if (!condition) fail(`self-test failed: ${name}`)
  }

  const groups = groupByModule([
    'apps/web/src/apps/Prediction/index.tsx',
    'apps/web/src/apps/Prediction/List.tsx',
    'apps/web/src/services/api/prediction.ts',
    'package.json',
  ])
  record('groupByModule 按模块聚合并按文件数降序', groups[0].module === 'apps/web/src/apps/Prediction' && groups[0].count === 2)
  record('groupByModule 顶层文件不崩', groups.some((item) => item.module === 'package.json' || item.module === ''))

  const passes = latestPassByGate({
    runs: [
      { gate: 'G5', ok: true, generatedAt: '2026-07-01T00:00:00.000Z', evidence: 'a' },
      { gate: 'G5', ok: true, generatedAt: '2026-07-02T00:00:00.000Z', evidence: 'b' },
      { gate: 'G6', ok: false, generatedAt: '2026-07-03T00:00:00.000Z', evidence: 'c' },
    ],
  })
  record('latestPassByGate 取最后一次 PASS', passes.G5?.evidence === 'b')
  record('latestPassByGate 不把 BLOCK 当 PASS', passes.G6 === undefined)

  const waivers = activeWaivers({ waivers: [{ ruleId: 'A', expiresAt: '2026-01-01' }, { ruleId: 'B', expiresAt: '2099-01-01' }, { ruleId: 'C' }] }, '2026-08-03')
  record('activeWaivers 过滤已过期豁免', waivers.length === 2 && !waivers.some((item) => item.ruleId === 'A'))

  const counts = parseInventoryCounts('| F01 | 标题 | 做 |\n本期：不做\n| F02 | 标题 | 延期 |\n这条不做的原因是范围外')
  record('parseInventoryCounts 统计三态', counts.做 === 1 && counts.不做 === 1 && counts.延期 === 1)

  const open = openCollaborationItems('| B10 | 格式 | 待修复 |\n正文里提到待修复但不是表格行\n| B11 | ok | 已修 |')
  record('openCollaborationItems 只认表格行', open.length === 1)

  const reg = openBlockers([
    { id: 'BLK-1', type: 'blocker', status: 'open', owner: 'be', blocksGate: 'G6', summary: '错误码待后端销账' },
    { id: 'CHG-1', type: 'change', status: 'open', owner: 'pm', summary: '杠杆改 1-20x 硬限制' },
    { id: 'BLK-2', type: 'blocker', status: 'resolved', owner: 'be', resolution: 'x', resolvedAt: '2026-08-03', summary: 'done' },
  ])
  record('openBlockers 分组且丢弃 resolved', reg.blockers.length === 1 && reg.changes.length === 1)

  const buckets = severityBuckets([
    { ruleId: 'X', ok: false, severity: 'error' },
    { ruleId: 'Y', ok: false, severity: 'warn' },
    { ruleId: 'Z', ok: true, severity: 'error' },
  ])
  record('severityBuckets 不把 ok=true 算失败', buckets.fail.length === 1 && buckets.warn.length === 1)

  const text = renderSummary({
    projectId: 'PR-00001',
    generatedAt: '2026-08-03T00:00:00.000Z',
    baseRef: 'origin/online',
    baseResolvable: true,
    latestGate: 'G8',
    latestGateOk: true,
    latestGateAt: '2026-08-03T00:00:00.000Z',
    changedFileCount: 2,
    modules: groups,
    gatePasses: passes,
    commands: [{ label: 'verify-build-quality --project PR-00001', status: 0, ok: true }],
    buildQuality: 'PASS（5 条结论）',
    inventory: counts,
    inventoryFound: true,
    waivers,
    assumedHits: 0,
    assumedFiles: [],
    openBlockers: reg.blockers,
    openChanges: reg.changes,
    openItems: open,
    warn: buckets.warn,
    mockResidue: [{ pattern: '@mock-only', hits: 0, tool: 'rg', files: [] }],
  })
  for (const section of ['## 1. 改动', '## 2. 验证', '## 3. 功能清单', '## 4. 待确认', '## 5. 残留风险', 'GENERATED by']) {
    record(`renderSummary 含 ${section}`, text.includes(section))
  }
  record('renderSummary 渲染结构化阻塞而非只 grep', text.includes('BLK-1') && text.includes('CHG-1') && text.includes('agent/blockers.json'))
  record('renderSummary 保留人工占位', text.split('<!-- 人工补充').length === 3)

  console.log(`PASS render-delivery-summary self-test (${cases.length} cases)`)
}

if (hasFlag('--self-test')) {
  selfTest()
  process.exit(0)
}

/* ------------------------------------------------------------------ main */

const projectId = readOption('--project')
if (!projectId) fail('missing --project <PR-ID>（或用 --self-test / --help）')

const baseRef = readOption('--base', config.baseRef || 'origin/online')
const projectDir = join(docsRoot, projectId)
if (!existsSync(projectDir)) fail(`project not found: ${relative(repoRoot, projectDir)}`)

const baseResolvable = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`], {
  cwd: worktreeRoot,
  stdio: 'pipe',
  encoding: 'utf8',
}).status === 0

const changedFiles = (() => {
  const files = new Set()
  if (baseResolvable) {
    for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`]))) files.add(toPosix(file))
  }
  for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR']))) files.add(toPosix(file))
  for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR', '--cached']))) files.add(toPosix(file))
  for (const file of splitLines(runGit(['ls-files', '--others', '--exclude-standard']))) files.add(toPosix(file))
  // docs_tdd 本身不进业务交付摘要（本地忽略目录）。
  return [...files].filter((file) => file && !file.startsWith(`${config.docsMountPath}/`))
})()

const gateResults = readJson(join(projectDir, 'agent/gate-results.json'))
const gateHistory = readJson(join(projectDir, 'agent/gate-history.json'))
const waiverFile = readJson(join(projectDir, 'agent/rule-waivers.json'))
const inventoryText = readText(join(projectDir, 'product/00-feature-inventory.md'))
const collaborationText = readText(join(projectDir, 'product/06-collaboration.md'))
const blockerEntries = readJson(join(projectDir, 'agent/blockers.json'))
const openReg = openBlockers(Array.isArray(blockerEntries) ? blockerEntries : [])

const buckets = severityBuckets(gateResults?.checks)
const buildQuality = gateResults?.buildQuality
const buildQualityCell = !buildQuality
  ? '最近一次 gate 未记录（G6 前的 gate 不要求，或 gate-results.json 早于本层上线）'
  : buildQuality.skipped
    ? `**已跳过**：${buildQuality.reason || '未填理由'}`
    : `${buildQuality.ok ? 'PASS' : 'FAIL'}（${buildQuality.checkCount ?? 0} 条结论）`

// ASSUMED 占位只在业务代码里找，且只看本次改动文件——存量占位不算本次交付欠账。
const assumedTargets = changedFiles.filter((file) => /\.(ts|tsx)$/.test(file) && existsSync(resolve(worktreeRoot, file)))
const assumed = grepCount('// ASSUMED:', assumedTargets)

const facts = {
  projectId,
  generatedAt: new Date().toISOString(),
  baseRef,
  baseResolvable,
  latestGate: gateResults?.gate || '未生成',
  latestGateOk: gateResults?.ok === true,
  latestGateAt: gateResults?.generatedAt || '',
  changedFileCount: changedFiles.length,
  modules: groupByModule(changedFiles),
  gatePasses: latestPassByGate(gateHistory),
  commands: Array.isArray(gateResults?.commands) ? gateResults.commands : [],
  buildQuality: buildQualityCell,
  inventory: parseInventoryCounts(inventoryText),
  inventoryFound: Boolean(inventoryText),
  waivers: activeWaivers(waiverFile, new Date().toISOString().slice(0, 10)),
  assumedHits: assumed.hits,
  assumedFiles: assumed.files,
  openBlockers: openReg.blockers,
  openChanges: openReg.changes,
  openItems: openCollaborationItems(collaborationText),
  warn: buckets.warn,
  mockResidue: MOCK_RESIDUE_PATTERNS.map((pattern) => grepCount(pattern, assumedTargets)),
}

const markdown = renderSummary(facts)

if (hasFlag('--json')) {
  console.log(JSON.stringify({ ok: true, tool: 'render-delivery-summary.mjs', ...facts, markdownPath: hasFlag('--write') ? join(projectId, OUTPUT_RELATIVE) : null }, null, 2))
} else {
  console.log(markdown)
}

if (hasFlag('--write')) {
  const outputFile = join(projectDir, OUTPUT_RELATIVE)
  writeFileSync(outputFile, markdown)
  console.error(`wrote ${relative(repoRoot, outputFile)}`)
}
