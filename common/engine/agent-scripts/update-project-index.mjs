#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listProjectIds, resolveProjectRoot, resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
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

function selfTest() {
  const stripped = stripMd('`apps/web/docs_tdd/prds/PR-00001` **done**')
  if (!stripped.includes('docs_tdd') || stripped.includes('`') || stripped.includes('**')) {
    console.error('[update-project-index] self-test failed: stripMd should preserve underscores and remove markdown markers')
    process.exit(1)
  }
  const markdown = renderMarkdown([
    {
      id: 'PR-00001',
      status: 'G6',
      g2: 'Aven / 2026-07-10',
      gate: 'G6 PASS (fail=0, warn=0)',
      evidenceCount: 1,
      worktree: '/Users/aven/github/PR-00001',
      modulePath: 'apps/web/src/apps/Demo',
    },
  ])
  if (!markdown.includes('[PR-00001](./prds/PR-00001/README.md)') || !markdown.includes('| Project | Status |')) {
    console.error('[update-project-index] self-test failed: rendered markdown table is incomplete')
    process.exit(1)
  }
  if (!markdown.includes('| Worktree |') || !markdown.includes('/Users/aven/github/PR-00001')) {
    console.error('[update-project-index] self-test failed: worktree column missing from rendered table')
    process.exit(1)
  }
  const noWt = renderMarkdown([
    { id: 'PR-00002', status: 'G2', g2: '—', gate: '未生成', evidenceCount: 0, worktree: '', modulePath: '—' },
  ])
  if (!noWt.includes('无活跃 worktree')) {
    console.error('[update-project-index] self-test failed: empty worktree should render placeholder')
    process.exit(1)
  }
  const machineFirst = parseStatus('| 字段 | 值 |\n|------|-----|\n| 最新通过门禁 | G6 |\n| 当前阶段 | G0 资料接收 |')
  if (machineFirst !== 'G6') {
    console.error('[update-project-index] self-test failed: machine row must win over narrative 当前阶段')
    process.exit(1)
  }
  const boldLabel = parseStatus('| 项 | 值 |\n|----|----|\n| **当前阶段** | **G4 开发中** |')
  if (boldLabel !== 'G4 开发中') {
    console.error('[update-project-index] self-test failed: bold 当前阶段 label should still parse')
    process.exit(1)
  }
  const quoteFallback = parseStatus('> **状态**: G5 联调中')
  if (quoteFallback !== 'G5 联调中') {
    console.error('[update-project-index] self-test failed: quote-style status fallback broken')
    process.exit(1)
  }
  const fm = parseFrontmatter('---\nprojectId: PR-00003\nstage: G6\nstatus: active\n---\n# PR-00003')
  if (fm.projectId !== 'PR-00003' || fm.stage !== 'G6' || fm.status !== 'active') {
    console.error('[update-project-index] self-test failed: parseFrontmatter should parse simple scalars')
    process.exit(1)
  }
  const fmStatus = frontmatterStatus('---\nstage: G6\n---\n# PR-00003\n\n## 状态\n| 当前阶段 | G0 |')
  if (fmStatus !== 'G6') {
    console.error('[update-project-index] self-test failed: frontmatter stage must win over narrative status')
    process.exit(1)
  }
  const prioritySample = '---\nstage: G4\n---\n# PR-00004\n\n## 状态\n\n| 字段 | 值 |\n|------|-----|\n| 最新通过门禁 | G6 |\n| 当前阶段 | G0 |'
  const priority = machineRowStatus(prioritySample) || frontmatterStatus(prioritySample) || parseStatus(prioritySample)
  if (priority !== 'G6') {
    console.error('[update-project-index] self-test failed: machine row must win over frontmatter stage')
    process.exit(1)
  }
  const legacy = legacyAwareStatus('G8', { runs: [] }, () => false)
  if (legacy !== 'G8 (legacy-unverified)') {
    console.error('[update-project-index] self-test failed: G5+ without machine history must be marked legacy-unverified')
    process.exit(1)
  }
  const verified = legacyAwareStatus('G8', {
    runs: [{ gate: 'G8', ok: true, summary: { fail: 0 }, evidence: 'evidence/gate/g8/README.md' }],
  }, () => true)
  if (verified !== 'G8') {
    console.error('[update-project-index] self-test failed: verified G8 should not carry legacy marker')
    process.exit(1)
  }
  const reconcile = frontendReconcileNote('G4', { stages: { G5: { status: 'frontend-complete-pending-reconcile' } } })
  if (reconcile !== 'G4 · 前端完成待对账') {
    console.error('[update-project-index] self-test failed: frontend-complete-pending-reconcile G5 should annotate status')
    process.exit(1)
  }
  const noReconcile = frontendReconcileNote('G4', { stages: { G5: { status: 'blocked' } } })
  if (noReconcile !== 'G4') {
    console.error('[update-project-index] self-test failed: non-reconcile G5 status must not annotate')
    process.exit(1)
  }
  console.log('PASS project index renderer')
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

// worktree 归属是运行时事实：直接从 `git worktree list` 派生，禁止手抄。
// 返回 { 'feature/PR-00001': '/Users/aven/github/PR-00001', ... }（按分支名索引）。
function worktreesByBranch() {
  const out = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
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

function firstMatch(text, patterns, fallback = '') {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match?.[1]) return match[1].trim()
  }
  return fallback
}

function stripMd(value) {
  return value
    .replace(/^#+\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// 解析 README 顶部的 YAML frontmatter，返回对象。只处理简单标量（字符串/布尔/数字），
// 不引入外部 YAML 依赖，足够支撑 docs_tdd 的元数据字段。
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()
    let quoted = false
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
      quoted = true
    }
    if (value === 'true') result[key] = true
    else if (value === 'false') result[key] = false
    else if (!quoted && /^\d+$/.test(value)) result[key] = Number(value)
    else result[key] = value
  }
  return result
}

function frontmatterStatus(readme) {
  const fm = parseFrontmatter(readme)
  if (fm.stage) return `${fm.stage}`
  if (fm.status && fm.status !== 'active') return `${fm.status}`
  return ''
}

// 只取表格机器行「最新通过门禁」。它是 set-project-stage.mjs 的唯一写真值，优先级高于 frontmatter。
function machineRowStatus(readme) {
  return stripMd(firstMatch(readme, [/\|\s*(?:\*\*)?最新通过门禁(?:\*\*)?\s*\|\s*([^|]+)\|/], ''))
}

// README 状态解析：机器行「最新通过门禁」优先——它由 set-project-stage.mjs 在 gate 通过时写入，
// 是客观真值；人工叙述行（当前阶段/代码实现/引用形态）只做回落。标签兼容 **粗体** 写法。
function parseStatus(readme) {
  return stripMd(firstMatch(readme, [
    /\|\s*(?:\*\*)?最新通过门禁(?:\*\*)?\s*\|\s*([^|]+)\|/,
    /^>\s*\*\*状态\*\*[:：]\s*(.+)$/m,
    /^>\s*状态[:：]\s*(.+)$/m,
    /\|\s*(?:\*\*)?当前阶段(?:\*\*)?\s*\|\s*([^|]+)\|/,
    /\|\s*(?:\*\*)?代码实现(?:\*\*)?\s*\|\s*([^|]+)\|/,
  ], '未记录'))
}

function legacyAwareStatus(status, history, evidenceExists) {
  const stage = String(status || '').match(/\b(G[5-8])\b/)?.[1]
  if (!stage || String(status).includes('legacy-unverified')) return status
  const verified = Array.isArray(history?.runs) && history.runs.some((run) => (
    run?.gate === stage
    && run?.ok === true
    && run?.summary?.fail === 0
    && typeof run?.evidence === 'string'
    && evidenceExists(run.evidence)
  ))
  return verified ? status : `${status} (legacy-unverified)`
}

// 若 G5 记为报告态 frontend-complete-pending-reconcile（前端完成、仅待真实字段对账），
// 在索引状态上追加可读标记——让"前端已交付、后端字段待对账"的项目不再笼统显示为阻塞/停在 G4。
function frontendReconcileNote(status, stageStatusJson) {
  const g5 = stageStatusJson?.stages?.G5?.status
  if (g5 !== 'frontend-complete-pending-reconcile') return status
  return String(status).includes('前端完成待对账') ? status : `${status} · 前端完成待对账`
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

function cell(value) {
  return String(value || '未记录').replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

function worktreeCell(project) {
  if (!project.worktree) return '—（无活跃 worktree）'
  return `\`${project.worktree}\``
}

function renderMarkdown(projects) {
  const generatedAt = new Date().toISOString()
  const rows = projects.map((project) => `| [${cell(project.id)}](./prds/${cell(project.id)}/README.md) | ${cell(project.status)} | ${cell(project.g2)} | ${cell(project.gate)} | ${project.evidenceCount} | ${worktreeCell(project)} | ${cell(project.modulePath)} |`)
  return `# docs_tdd Project Index

> Generated by \`common/engine/agent-scripts/update-project-index.mjs --write\` at ${generatedAt}. Do not hand-edit table rows; update project README / product docs, then regenerate.
> 本表是「当前有哪些项目 / 状态 / 在哪个 worktree」的唯一生成式聚合视图，不是底层事实源。Worktree 列直接派生自 \`git worktree list\`，禁止手工登记；README / AGENTS / CONTEXT 只放指向本表的指针，不得再抄一份项目清单（\`check-doc-budget.mjs\` 会拦）。

## Active Projects

| Project | Status | G2 | Latest gate | Evidence files | Worktree | Responsibility modules |
|---------|--------|----|-------------|----------------|----------|-------------------------|
${rows.join('\n')}

## Notes

- This index is a generated navigation view; its underlying facts remain in each project README / agent state and Git.
- Project status uses the machine row \`| 最新通过门禁 | GX |\` first, then README frontmatter \`stage\`, then narrative rows. G5+ without matching successful gate history and existing evidence is labeled \`legacy-unverified\`.
- \`legacy-unverified\` = 机制上线（gate-history 机器背书）之前的自声明 G8/G5+，非机器背书。这些旧项目 worktree 多已回收、无真实 gate 运行；**不 backfill 伪造 PASS 历史**（违反"不伪造证据"原则）。要转为机器背书须有真实结构的 \`agent/gate-history.json\` 且其 evidence 路径真实存在。
- \`· 前端完成待对账\` = G5 记为报告态 \`frontend-complete-pending-reconcile\`：前端已交付、仅待后端真实字段对账；此态不放行 G6（见 \`workflow-gates.md\`）。
- G2/module data comes from \`product/00-feature-inventory.md\`; final gate data comes from \`agent/gate-results.json\` when present.
- Worktree column is derived live from \`git worktree list\` (configured branch prefix or \`fix/<ID>\`); a project with no active worktree shows \`—\`.
- Regenerate after creating or materially updating a project: \`node apps/web/docs_tdd/common/engine/agent-scripts/update-project-index.mjs --write\`.
- README frontmatter schema is enforced by \`common/engine/schemas/project-frontmatter.schema.json\`; invalid frontmatter will be reported by \`check-doc-budget.mjs\`.
`
}

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

const byBranch = worktreesByBranch()
const projects = listProjectDirs().map((name) => projectInfo(name, byBranch))

if (json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: projects.length, projects }, null, 2))
} else {
  const output = renderMarkdown(projects)
  if (write) {
    const outFile = join(docsRoot, 'PROJECTS.md')
    writeFileSync(outFile, output)
    console.log(`wrote ${relative(repoRoot, outFile)} (${projects.length} project(s))`)
  } else {
    process.stdout.write(output)
  }
}
