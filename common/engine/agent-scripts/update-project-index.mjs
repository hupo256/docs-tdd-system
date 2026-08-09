#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { listProjectIds, resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import {
  firstMatch,
  frontendReconcileNote,
  frontmatterStatus,
  legacyAwareStatus,
  machineRowStatus,
  parseStatus,
  renderMarkdown,
  selfTest,
  stripMd,
} from './lib/project-index.mjs'

const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const args = process.argv.slice(2)
const write = args.includes('--write')
const json = args.includes('--json')
const includeArchive = args.includes('--include-archive')

function printHelp() {
  console.log(`usage: update-project-index.mjs [--write] [--json] [--include-archive] [--self-test] [--help]

Regenerate the PROJECTS.md navigation index from project READMEs, gate-results, and git worktrees.

Options:
  --help           Show this help message and exit
  --write          Persist PROJECTS.md
  --json           Output JSON to stdout
  --include-archive  Include the archive directory in the listing
  --self-test      Run inline self-test`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

// worktree 归属是运行时事实：直接从 `git worktree list` 派生，禁止手抄。返回 { branch: path }。
function worktreesByBranch() {
  const out = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' })
  if (out.status !== 0) return {}
  const map = {}
  let currentPath = ''
  for (const line of out.stdout.split('\n')) {
    if (line.startsWith('worktree ')) currentPath = line.slice('worktree '.length).trim()
    else if (line.startsWith('branch ')) {
      const branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '')
      if (currentPath) map[branch] = currentPath
    }
  }
  return map
}

// 项目 id → 其 feature/fix worktree 路径（无则空串）。以 git 为唯一真相，不依赖任何手工登记表。
function worktreePathFor(projectId, byBranch) {
  return byBranch[`${config.branchPrefix || 'feature/'}${projectId}`] || byBranch[`fix/${projectId}`] || ''
}

function listProjectDirs() {
  return listProjectIds()
    // PR-00000 是 golden-run 的保留夹具 ID（运行期临时物化），不是真实项目，不进 PROJECTS.md。
    .filter((name) => name !== 'PR-00000')
    .filter((name) => includeArchive || name !== 'archive')
    // 真正的项目一定有 README.md（scaffold 必写）；只含 agent/lark-audits 等产物的孤儿目录不进索引，避免断链。
    .filter((name) => existsSync(join(resolveProjectRoot(name), 'README.md')))
    .sort((a, b) => a.localeCompare(b))
}

function countEvidence(projectDir) {
  const evidenceDir = join(projectDir, 'evidence')
  if (!existsSync(evidenceDir)) return 0
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
  return walk(evidenceDir).filter((file) => /\.(md|json)$/.test(file)).length
}

function readGateSummary(projectDir) {
  const file = join(projectDir, 'agent/gate-results.json')
  if (!existsSync(file)) return ''
  try {
    const data = JSON.parse(read(file))
    const fail = data.summary?.fail ?? '?'
    const warn = data.summary?.warn ?? '?'
    return `${data.gate || '?'} ${data.ok ? 'PASS' : 'BLOCK'} (fail=${fail}, warn=${warn})`
  } catch {
    return 'invalid gate-results.json'
  }
}

function projectInfo(name, byBranch) {
  const dir = resolveProjectRoot(name)
  const readme = read(join(dir, 'README.md'))
  const inventory = read(join(dir, 'product/00-feature-inventory.md'))
  const title = stripMd(firstMatch(readme, [/^#\s+(.+)$/m], name)) || name
  // 优先级：表格机器行（gate 通过时脚本写入）> frontmatter stage（早期元数据兼容层）> 人工叙述行。
  const rawStatus = machineRowStatus(readme) || frontmatterStatus(readme) || parseStatus(readme)
  let history = null
  try {
    history = JSON.parse(read(join(dir, 'agent/gate-history.json')) || 'null')
  } catch {
    history = null
  }
  const status = legacyAwareStatus(rawStatus, history, (evidence) => existsSync(join(dir, evidence)))
  let stageStatusJson = null
  try {
    stageStatusJson = JSON.parse(read(join(dir, 'agent/stage-status.json')) || 'null')
  } catch {
    stageStatusJson = null
  }
  const displayStatus = frontendReconcileNote(status, stageStatusJson)
  const prd = stripMd(firstMatch(`${readme}\n${inventory}`, [
    /^>\s*\*\*PRD\*\*[:：]\s*(.+)$/m,
    /\|\s*PRD 来源\s*\|\s*([^|]+)\|/,
    /^-\s*PRD 来源[:：]\s*(.+)$/m,
  ], '未记录'))
  const g2 = stripMd(firstMatch(inventory, [/\|\s*G2 确认人 & 日期\s*\|\s*([^|]+)\|/], '未记录')) || '未记录'
  const modulePath = stripMd(firstMatch(inventory, [/\|\s*责任模块目录\s*\|\s*([^|]+)\|/], '未记录')) || '未记录'
  return {
    id: name,
    title,
    status: displayStatus,
    prd,
    g2,
    modulePath,
    worktree: worktreePathFor(name, byBranch || {}),
    evidenceCount: countEvidence(dir),
    gate: readGateSummary(dir) || '未生成',
    readme: existsSync(join(dir, 'README.md')) ? relative(docsRoot, join(dir, 'README.md')) : '',
  }
}

const byBranch = worktreesByBranch()
const projects = listProjectDirs().map((name) => projectInfo(name, byBranch))

if (json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: projects.length, projects }, null, 2))
} else {
  const output = renderMarkdown(projects, new Date().toISOString())
  if (write) {
    const outFile = join(docsRoot, 'PROJECTS.md')
    writeFileSync(outFile, output)
    console.log(`wrote ${relative(repoRoot, outFile)} (${projects.length} project(s))`)
  } else {
    process.stdout.write(output)
  }
}
