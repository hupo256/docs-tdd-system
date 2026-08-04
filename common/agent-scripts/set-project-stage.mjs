#!/usr/bin/env node
// 项目阶段真值的唯一写口：把「最新通过门禁」同步到 README 机器行、机器版 context-summary、PROJECTS.md。
// 机器行 `| 最新通过门禁 | GX |` 只由本脚本（或 run-project-gate --write 间接）写入；人工叙述请写「当前阶段」行。
// 用法：node set-project-stage.mjs PR-01234 G6 [--force] [--dry-run] [--json] [--no-index] [--no-summary]
//   --force      允许阶段回退（默认 advance-only，拒绝把 G6 改回 G4）
//   --no-index   不刷新 PROJECTS.md
//   --no-summary 不重写机器版 context-summary.md
//   --dry-run    只打印将做的改动，不落盘
// 退出码 0 = 同步成功；1 = 参数/结构/回退校验失败。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const repoRoot = resolve(scriptDir, '../../../../..')
const docsRoot = join(repoRoot, 'apps/web/docs_tdd')
const callerCwd = process.cwd()
const args = process.argv.slice(2)
const projectId = args[0]
const gate = (args[1] || '').toUpperCase()
const force = args.includes('--force')
const dryRun = args.includes('--dry-run')
const json = args.includes('--json')
const noIndex = args.includes('--no-index')
const noSummary = args.includes('--no-summary')

function printHelp() {
  console.log(`usage: set-project-stage.mjs <PR-01234> <G0-G8> [--force] [--dry-run] [--json] [--no-index] [--no-summary] [--help]

项目阶段真值的唯一写口：把「最新通过门禁」同步到 README 机器行、机器版 context-summary、PROJECTS.md。

Options:
  --help         Show this help message and exit
  --force        Allow stage regression (default: advance-only)
  --dry-run      Print planned changes without writing
  --json         Output JSON result to stdout
  --no-index     Do not regenerate PROJECTS.md
  --no-summary   Do not rewrite machine context-summary`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

const MACHINE_ROW_LABEL = '最新通过门禁'
// 机器版 context-summary 判别标记：生成器会在头部写入自身脚本名；手写版（如 PR-01685 带手写「坑」section）不含此字样。
const MACHINE_SUMMARY_MARKER = 'update-context-summary.mjs'

function fail(message) {
  console.error(`[set-project-stage] ${message}`)
  process.exit(1)
}

// G0..G8 → 0..8；非纯 GX 值（如「未通过」、带描述的叙述）返回 -1，视为尚未通过任何门禁。
function gateNumber(value) {
  const match = /^G([0-8])$/.exec(String(value || '').trim())
  return match ? Number(match[1]) : -1
}

function isMachineSummary(text) {
  return text.includes(MACHINE_SUMMARY_MARKER)
}

function historyContainsSuccessfulGate(history, expectedGate) {
  return Array.isArray(history?.runs) && history.runs.some((run) => (
    run?.gate === expectedGate && run?.ok === true && run?.summary?.fail === 0
  ))
}

function hasSuccessfulGateHistory(projectDir, expectedGate) {
  const historyFile = join(projectDir, 'agent/gate-history.json')
  if (!existsSync(historyFile)) return false
  try {
    const history = JSON.parse(readFileSync(historyFile, 'utf8'))
    return historyContainsSuccessfulGate(history, expectedGate)
  } catch {
    return false
  }
}

// 机器行渲染：跟随表格既有风格（如 PR-01947 全表粗体标签），避免脚本行与人工行风格割裂。
function machineRow(nextGate, bold) {
  return bold ? `| **${MACHINE_ROW_LABEL}** | **${nextGate}** |` : `| ${MACHINE_ROW_LABEL} | ${nextGate} |`
}

// 在 README 的 YAML frontmatter 中更新 stage 字段，与状态表机器行保持一致。
function updateFrontmatterStage(readme, stage) {
  const fmMatch = readme.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!fmMatch) return readme
  const lines = fmMatch[1].split('\n')
  let updated = false
  const newLines = lines.map((line) => {
    if (/^stage:\s*/.test(line)) {
      updated = true
      return `stage: ${stage}`
    }
    return line
  })
  if (!updated) newLines.push(`stage: ${stage}`)
  return readme.replace(/^---\n([\s\S]*?)\n---\n?/, `---\n${newLines.join('\n')}\n---\n`)
}

// 在 README 的「## 状态」表中 upsert 机器行。返回 { ok, action, previous, lines }。
// 插入位置固定在表头分隔线之后第一行：机器行不依赖叙述行的存在与否，位置稳定利于 diff 与解析。
function upsertMachineRow(readme, nextGate) {
  const lines = readme.split('\n')
  const statusIndex = lines.findIndex((line) => /^##\s+状态/.test(line))
  if (statusIndex === -1) return { ok: false, reason: 'README.md 缺少「## 状态」小节' }
  let dividerIndex = -1
  for (let index = statusIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (index > statusIndex + 1 && line.startsWith('## ')) break
    if (/^\|[-: |]+\|$/.test(line)) {
      dividerIndex = index
      break
    }
  }
  if (dividerIndex === -1) return { ok: false, reason: '「## 状态」小节下没有表格' }
  const rowPattern = new RegExp(`^\\|\\s*(?:\\*\\*)?${MACHINE_ROW_LABEL}(?:\\*\\*)?\\s*\\|`)
  for (let index = dividerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line.startsWith('|')) break
    if (rowPattern.test(line)) {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/\*\*/g, ''))
      const previous = cells[1] || ''
      lines[index] = machineRow(nextGate, line.includes('**'))
      return { ok: true, action: 'updated', previous, lines }
    }
  }
  const boldStyle = /^\|\s*\*\*/.test((lines[dividerIndex + 1] || '').trim())
  lines.splice(dividerIndex + 1, 0, machineRow(nextGate, boldStyle))
  return { ok: true, action: 'inserted', previous: '', lines }
}

function selfTest() {
  const sample = `# PR-00001 demo\n\n## 状态\n\n| 字段 | 值 |\n|------|-----|\n| 当前阶段 | G0 资料接收 |\n| PRD 来源 | x |\n`
  const inserted = upsertMachineRow(sample, 'G2')
  if (!inserted.ok || inserted.action !== 'inserted' || inserted.previous !== '') {
    fail('self-test failed: insert path broken')
  }
  const rowIndex = inserted.lines.findIndex((line) => line.includes(MACHINE_ROW_LABEL))
  const dividerIndex = inserted.lines.findIndex((line) => /^\|[-: |]+\|$/.test(line.trim()))
  if (rowIndex !== dividerIndex + 1) {
    fail('self-test failed: machine row must sit right after the table divider')
  }
  const updated = upsertMachineRow(inserted.lines.join('\n'), 'G6')
  if (!updated.ok || updated.action !== 'updated' || updated.previous !== 'G2') {
    fail('self-test failed: update path should report previous machine value')
  }
  const titled = upsertMachineRow(`## 状态（2026-07-21 更新）\n\n| 项 | 值 |\n|----|----|\n| **当前阶段** | **G4** |\n`, 'G6')
  if (!titled.ok || titled.action !== 'inserted' || !titled.lines.some((line) => line === `| **${MACHINE_ROW_LABEL}** | **G6** |`)) {
    fail('self-test failed: status section with date suffix / bold labels must still be located')
  }
  const boldUpdated = upsertMachineRow(titled.lines.join('\n'), 'G7')
  if (!boldUpdated.ok || boldUpdated.action !== 'updated' || boldUpdated.previous !== 'G6' || !boldUpdated.lines.some((line) => line === `| **${MACHINE_ROW_LABEL}** | **G7** |`)) {
    fail('self-test failed: bold machine row update should keep bold style and strip bold from previous value')
  }
  const noSection = upsertMachineRow('# demo\n\nno table here\n', 'G2')
  if (noSection.ok) {
    fail('self-test failed: missing status section must be rejected')
  }
  if (gateNumber('G6') !== 6 || gateNumber('未通过') !== -1 || gateNumber('G6 代码实现') !== -1) {
    fail('self-test failed: gateNumber parsing drifted')
  }
  if (!(gateNumber('G4') < gateNumber('G6'))) {
    fail('self-test failed: advance-only comparison drifted')
  }
  if (!isMachineSummary(`> 由 \`${MACHINE_SUMMARY_MARKER}\` 生成`) || isMachineSummary('# 手写摘要\n\n## 坑\n')) {
    fail('self-test failed: machine summary marker detection drifted')
  }
  if (!historyContainsSuccessfulGate({ runs: [{ gate: 'G5', ok: true, summary: { fail: 0 } }] }, 'G5')) {
    fail('self-test failed: successful gate history should allow matching stage sync')
  }
  if (historyContainsSuccessfulGate({ runs: [{ gate: 'G5', ok: false, summary: { fail: 1 } }] }, 'G5')) {
    fail('self-test failed: blocked gate history must not allow stage sync')
  }
  if (historyContainsSuccessfulGate({ runs: [{ gate: 'G5', ok: true, summary: { fail: 0 } }] }, 'G6')) {
    fail('self-test failed: earlier gate history must not allow stage skip')
  }
  console.log('PASS set-project-stage machine row upsert')
}

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

if (!/^PR-\d{5}$/.test(projectId || '') || !/^G[0-8]$/.test(gate)) {
  fail('usage: set-project-stage.mjs PR-01234 G6 [--force] [--dry-run] [--json] [--no-index] [--no-summary]')
}

const projectDir = join(docsRoot, projectId)
if (!existsSync(projectDir)) fail(`project directory does not exist: ${relative(repoRoot, projectDir)}`)

const result = { projectId, gate, readme: '', previousGate: '', summary: 'skipped', index: 'skipped', warnings: [] }

// 1) README 机器行
const readmePath = join(projectDir, 'README.md')
if (!existsSync(readmePath)) fail(`README.md missing: ${relative(repoRoot, readmePath)}`)
const upsert = upsertMachineRow(readFileSync(readmePath, 'utf8'), gate)
if (!upsert.ok) fail(`${upsert.reason}，机器行无处安放，请先修正 README 结构。`)
result.previousGate = upsert.previous
const previousNumber = gateNumber(upsert.previous)
const nextNumber = gateNumber(gate)
if (!force && previousNumber > nextNumber) {
  fail(`拒绝回退：README 机器行已记录 ${upsert.previous}，新值 ${gate}。确需回退请显式加 --force。`)
}
if (force && previousNumber <= nextNumber) {
  fail('--force 只允许修正阶段回退，不能绕过成功 gate 历史推进或保持阶段。')
}
if (!force && !hasSuccessfulGateHistory(projectDir, gate)) {
  fail(`拒绝推进：agent/gate-history.json 中没有 ${gate} 的真实 PASS 记录。请通过 docs-tdd gate ${projectId} ${gate} 运行门禁。`)
}
const readmeWithFm = updateFrontmatterStage(upsert.lines.join('\n'), gate)
if (!dryRun) writeFileSync(readmePath, readmeWithFm)
result.readme = dryRun ? `would-${upsert.action}` : upsert.action

// 2) context-summary：仅机器版可被重写；手写版跳过并警告，防覆盖人工「坑」等高价值内容。
const summaryPath = join(projectDir, 'agent/context-summary.md')
if (noSummary) {
  result.summary = 'disabled'
} else if (!existsSync(summaryPath)) {
  result.summary = 'missing'
  result.warnings.push('agent/context-summary.md 不存在，跳过摘要同步')
} else if (!isMachineSummary(readFileSync(summaryPath, 'utf8'))) {
  result.summary = 'skipped-manual'
  result.warnings.push('agent/context-summary.md 为手写版（无机器标记），已跳过自动重写，请人工同步阶段描述')
} else {
  if (!dryRun) {
    const summaryRun = spawnSync(
      process.execPath,
      [join(scriptDir, MACHINE_SUMMARY_MARKER), projectId, '--stage', gate, '--write'],
      { cwd: callerCwd, encoding: 'utf8' },
    )
    if (summaryRun.status !== 0) fail(`context-summary 重写失败：${summaryRun.stderr.trim() || summaryRun.stdout.trim()}`)
  }
  result.summary = dryRun ? 'would-update' : 'updated'
}

// 3) PROJECTS.md 索引
if (!noIndex) {
  if (!dryRun) {
    const indexRun = spawnSync(process.execPath, [join(scriptDir, 'update-project-index.mjs'), '--write'], {
      cwd: callerCwd,
      encoding: 'utf8',
    })
    if (indexRun.status !== 0) fail(`PROJECTS.md 刷新失败：${indexRun.stderr.trim() || indexRun.stdout.trim()}`)
  }
  result.index = dryRun ? 'would-update' : 'updated'
}

if (json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`set-project-stage: ${projectId} → ${gate}${dryRun ? '（dry-run，未落盘）' : ''}`)
  console.log(`  README.md 机器行：${result.readme}${upsert.previous ? `（旧值 ${upsert.previous}）` : ''}`)
  console.log(`  context-summary：${result.summary}`)
  console.log(`  PROJECTS.md：${result.index}`)
  for (const warning of result.warnings) console.log(`  ⚠ ${warning}`)
}
