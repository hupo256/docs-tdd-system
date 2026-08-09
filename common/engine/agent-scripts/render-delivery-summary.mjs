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
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openBlockers } from './lib/blockers.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import {
  activeWaivers,
  groupByModule,
  latestPassByGate,
  openCollaborationItems,
  parseInventoryCounts,
  renderSummary,
  selfTest,
  severityBuckets,
  splitLines,
  toPosix,
} from './lib/delivery-summary.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const worktreeRoot = (() => {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : repoRoot
})()

const args = process.argv.slice(2)
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

if (hasFlag('--self-test')) {
  selfTest()
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

/* ------------------------------------------------------------------ main */

const projectId = readOption('--project')
if (!projectId) fail('missing --project <PR-ID>（或用 --self-test / --help）')

const baseRef = readOption('--base', config.baseRef || 'origin/online')
const projectDir = resolveProjectRoot(projectId)
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
