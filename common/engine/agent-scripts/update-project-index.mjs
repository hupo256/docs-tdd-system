#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { listProjectIds, resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import {
  firstMatch,
  focusLine,
  frontendReconcileNote,
  frontmatterStatus,
  latestGateFocus,
  legacyAwareStatus,
  machineRowStatus,
  parseFrontmatter,
  parseStatus,
  renderMarkdown,
  replaceFocusLine,
  selfTest,
  stripMd,
} from './lib/project-index.mjs'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { deriveAutopilotAction } from './lib/vnext-autopilot.mjs'

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

function readJsonFile(file) {
  try { return JSON.parse(read(file) || 'null') } catch { return null }
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

// 被上面 README.md 条件过滤掉的目录。此前是静默过滤：PM-0047 / PR-01645 等孤儿目录既不在索引里、
// 也没人知道它们存在，看起来像「系统里没这个项目」。改为返回清单，由调用方打 warn（不阻断）。
function listOrphanDirs() {
  return listProjectIds()
    .filter((name) => name !== 'PR-00000')
    .filter((name) => includeArchive || name !== 'archive')
    .filter((name) => !existsSync(join(resolveProjectRoot(name), 'README.md')))
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
  if (!existsSync(file)) return { text: '', at: '' }
  try {
    const data = JSON.parse(read(file))
    const fail = data.summary?.fail ?? '?'
    const warn = data.summary?.warn ?? '?'
    return { text: `${data.gate || '?'} ${data.ok ? 'PASS' : 'BLOCK'} (fail=${fail}, warn=${warn})`, at: data.generatedAt || '' }
  } catch {
    return { text: 'invalid gate-results.json', at: '' }
  }
}

function projectInfo(name, byBranch) {
  const dir = resolveProjectRoot(name)
  const readme = read(join(dir, 'README.md'))
  const inventory = read(join(dir, 'product/00-feature-inventory.md'))
  const title = stripMd(firstMatch(readme, [/^#\s+(.+)$/m], name)) || name
  const frontmatter = parseFrontmatter(readme)
  const workflowVersion = Number(frontmatter.workflowVersion || (existsSync(join(dir, 'work-item.json')) ? 2 : 1))
  const indexGroup = frontmatter.indexGroup || (['closed', 'archived'].includes(frontmatter.status) ? 'closed' : 'active')
  const worktree = worktreePathFor(name, byBranch || {})
  // 优先级：表格机器行（gate 通过时脚本写入）> frontmatter stage（早期元数据兼容层）> 人工叙述行。
  const rawStatus = machineRowStatus(readme) || frontmatterStatus(readme) || parseStatus(readme)
  let history = null
  try {
    history = JSON.parse(read(join(dir, 'agent/gate-history.json')) || 'null')
  } catch {
    history = null
  }
  const status = workflowVersion === 1 ? legacyAwareStatus(rawStatus, history, (evidence) => existsSync(join(dir, evidence))) : rawStatus
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
  const gate = readGateSummary(dir)
  if (workflowVersion === 2) {
    const workItem = readJsonFile(join(dir, 'work-item.json'))
    const latest = readJsonFile(join(dir, 'latest-result.json'))
    const integrity = latest && workItem ? verifyExitResultIntegrity(latest, workItem) : { ok: false }
    let fresh = false
    if (latest?.codeFingerprint) {
      try {
        const current = codeFingerprint(worktree || repoRoot)
        fresh = current.headSha === latest.codeFingerprint.headSha && current.baseSha === latest.codeFingerprint.baseSha && current.dirtyHash === latest.codeFingerprint.dirtyHash
      } catch { fresh = false }
    }
    const assuranceTrusted = latest?.mode === 'enforced' && latest?.assuranceMode === 'autonomous' && latest?.evidenceTrust === 'cli-attested'
    const deliveryCommitted = workItem?.autopilot?.delivery?.status === 'committed'
    const complete = latest?.mode === 'enforced' && latest?.status === 'passed' && latest?.ok === true && integrity.ok && fresh && assuranceTrusted && deliveryCommitted
    let v2Status = 'V2 invalid work item'
    try {
      const action = deriveAutopilotAction({
        workItem,
        latestResult: latest,
        resultIntegrityOk: integrity.ok,
        codeStateFresh: latest ? fresh : true,
        assuranceTrusted,
        deliveryCommitted,
        worktreeReady: Boolean(worktree),
      })
      v2Status = complete ? 'V2 complete' : `V2 ${action.phase}/${action.action}`
    } catch (error) {
      v2Status = `V2 invalid: ${error.message}`
    }
    const approval = workItem?.scopeApproval ? `${workItem.scopeApproval.confirmedBy} / ${String(workItem.scopeApproval.confirmedAt || '').slice(0, 10)}` : workItem?.routing?.verificationLevel === 'V2' ? '缺失' : '不要求'
    return {
      id: name, title, workflow: 'v2', status: v2Status, indexGroup, prd, g2: approval,
      modulePath: '见 work-item.json', worktree, evidenceCount: countEvidence(dir),
      gate: latest ? `V2 ${latest.mode || 'unknown'} ${latest.status || 'invalid'}` : '未验证',
      gateAt: latest?.generatedAt || '',
      readme: relative(docsRoot, join(dir, 'README.md')),
    }
  }
  return {
    id: name,
    title,
    workflow: 'v1',
    status: displayStatus,
    indexGroup,
    prd,
    g2,
    modulePath,
    worktree,
    evidenceCount: countEvidence(dir),
    gate: gate.text || '未生成',
    // gateAt：CONTEXT.md 焦点行取「最近一次 Gate / v2 verify 活动」用。
    gateAt: gate.at,
    readme: existsSync(join(dir, 'README.md')) ? relative(docsRoot, join(dir, 'README.md')) : '',
  }
}

const byBranch = worktreesByBranch()
const projects = listProjectDirs().map((name) => projectInfo(name, byBranch))
const orphans = listOrphanDirs()

// CONTEXT.md 的「当前工作重点」与 PROJECTS.md 同一次 --write 回写：手写焦点会腐化
// （曾停在 PR-01685 近两个月），派生自最近一次门禁活动才不会说谎。
function writeContextFocus() {
  const contextFile = join(docsRoot, 'CONTEXT.md')
  if (!existsSync(contextFile)) return
  const result = replaceFocusLine(read(contextFile), focusLine(latestGateFocus(projects)))
  if (!result.matched) {
    console.warn(`warn: CONTEXT.md 没有「- 当前工作重点：」行，焦点未回写（补一行占位即可自动维护）`)
    return
  }
  if (!result.changed) return
  writeFileSync(contextFile, result.text)
  console.log(`wrote ${relative(repoRoot, contextFile)} (当前工作重点)`)
}

if (orphans.length) {
  console.warn(`warn: ${orphans.length} 个项目目录缺 README.md，未进索引（孤儿目录：${orphans.join(', ')}）——补 README.md 或删目录，别让它们静默存在`)
}

if (json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: projects.length, projects, orphans }, null, 2))
} else {
  const output = renderMarkdown(projects, new Date().toISOString())
  if (write) {
    const outFile = join(docsRoot, 'PROJECTS.md')
    writeFileSync(outFile, output)
    console.log(`wrote ${relative(repoRoot, outFile)} (${projects.length} project(s))`)
    writeContextFocus()
  } else {
    process.stdout.write(output)
  }
}
