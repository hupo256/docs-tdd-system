#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { blockerChecks } from './lib/blockers.mjs'
import { codeReviewChecks } from './lib/code-review.mjs'
import { resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()

// GIT-G4 checks the branch/HEAD of the worktree the agent is CODING in. That is process.cwd(),
// NOT repoRoot: in a feature worktree, docs_tdd is a symlink, so the script path resolves back to
// the main repo and repoRoot would always report the main branch (e.g. online) — making G4 判定恒错。
// Resolve the git toplevel of the current working directory instead; fall back to repoRoot.
const gitCwd = (() => {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' })
  return r.status === 0 ? r.stdout.trim() : repoRoot
})()
const args = process.argv.slice(2)
const projectId = args[0]
const gate = (args[1] || '').toUpperCase()
const json = args.includes('--json')
const write = args.includes('--write')
const verbose = args.includes('--verbose')

function printHelp() {
  console.log(`usage: verify-project-gate.mjs <PR-01234> <G0-G8> [--json] [--write] [--verbose] [--self-test] [--help]

Run a single project documentation/structure gate and emit JSON/check results.

Options:
  --help       Show this help message and exit
  --json       Output JSON result to stdout
  --write      Persist gate-results.json
  --verbose    Print every check, not just actionable ones
  --self-test  Run inline self-test`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

function failUsage() {
  console.error('usage: verify-project-gate.mjs PR-01234 G2 [--json] [--write] [--verbose]')
  process.exit(1)
}

// --self-test：用内联 +/- markdown 锚点用例逐条守阶段 gate 的表格解析与字段正则，不碰 disk/git。
// 纳入 check-doc-budget 的 SELF_TEST_SCRIPTS；改表头列序/占位词/确认人格式导致误判时，自测先 fail。
function runSelfTest() {
  const failures = []
  const truthy = (label, cond) => { if (!cond) failures.push(label) }

  truthy('recordsPrdSource pos', recordsPrdSource('| PRD 来源 | https://x/doc |'))
  truthy('recordsPrdSource neg empty', !recordsPrdSource('| PRD 来源 |  |'))
  truthy('recordsG2Confirmer pos', recordsG2Confirmer('| G2 确认人 & 日期 | 张三 2026-07-10 |'))
  truthy('recordsG2Confirmer neg pending', !recordsG2Confirmer('| G2 确认人 & 日期 | 待确认 |'))
  truthy('recordsG2Confirmer neg empty', !recordsG2Confirmer('| G2 确认人 & 日期 |  |'))
  truthy('findBlockingPlaceholders pos', findBlockingPlaceholders('前置 待填写 后置').length === 1)
  truthy('findBlockingPlaceholders neg', findBlockingPlaceholders('已定稿无占位').length === 0)
  truthy('findBlockingPlaceholders extra', findBlockingPlaceholders('含 待检查 项', ['待检查']).length === 1)

  const inventory = [
    '## 功能清单',
    '',
    '| ID | 名称 | a | b | c | d | 本期 |',
    '|----|------|---|---|---|---|------|',
    '| F1 | 甲 | . | . | . | . | 做 |',
    '| F2 | 乙 | . | . | . | . | 待定 |',
    '',
    '## 下一节',
  ].join('\n')
  const rows = parseMarkdownTableRows(inventory, '## 功能清单')
  truthy('parseMarkdownTableRows count', rows.length === 2)
  truthy('featureRowsMissingStatus pos', featureRowsMissingStatus(rows).length === 1)
  const allValid = parseMarkdownTableRows(inventory.replace('待定', '延期'), '## 功能清单')
  truthy('featureRowsMissingStatus neg', featureRowsMissingStatus(allValid).length === 0)

  // classifyBaseline：三分支——恶性(无共同历史,error) / 良性前进(warn,不阻断) / 完全最新(error 语义 pass)
  const bad = classifyBaseline(false, false)
  truthy('classifyBaseline no-common-base blocks', !bad.ok && bad.severity === 'error')
  const advanced = classifyBaseline(true, false)
  truthy('classifyBaseline online-advanced passes as warn', advanced.ok && advanced.severity === 'warn')
  const fresh = classifyBaseline(true, true)
  truthy('classifyBaseline fresh passes', fresh.ok && fresh.severity === 'error')
  const modulePaths = parseResponsibilityModulePaths(
    '`apps/web/src/apps/Prediction/**`、`apps/web/src/services/api/prediction/**`、`apps/web/src/mocks/**`（MSW）',
  )
  truthy('parseResponsibilityModulePaths backticks and Chinese delimiter', modulePaths.length === 3 && modulePaths[2] === 'apps/web/src/mocks')
  truthy('parseResponsibilityModulePaths plain commas', parseResponsibilityModulePaths('apps/a/**, apps/b/**').length === 2)
  truthy(
    'completedTasksWithUnresolvedContract detects checked ASSUMED task',
    completedTasksWithUnresolvedContract('- [x] **T-F20** 已落码（ASSUMED `marginMode`，待后端对账）').length === 1,
  )
  truthy(
    'completedTasksWithUnresolvedContract allows unchecked unresolved task',
    completedTasksWithUnresolvedContract('- [ ] **T-F20** 展示代码已落，字段待后端对账').length === 0,
  )

  // VERIFY-G6-002：findings 有结论且无未处理项才 pass
  truthy('codeReviewFindingsResolved pos disposition', codeReviewFindingsResolved('已跑 /code-review：findings 3 条，全部已修'))
  truthy('codeReviewFindingsResolved pos zero', codeReviewFindingsResolved('/code-review 0 findings，无问题'))
  truthy('codeReviewFindingsResolved neg command-only', !codeReviewFindingsResolved('已跑 code-review'))
  truthy('codeReviewFindingsResolved neg unresolved', !codeReviewFindingsResolved('code-review findings 3 条：2 已修，1 待修复'))

  const ownershipV1 = technicalDesignOwnership('<!-- template-version: 1 -->\n## 复用盘点')
  truthy('technicalDesignOwnership v1 not applicable', !ownershipV1.applicable)
  const ownershipMissing = technicalDesignOwnership('<!-- template-version: 2 -->\n## 方案\n已完成')
  truthy('technicalDesignOwnership v2 missing section', ownershipMissing.applicable && !ownershipMissing.hasSection)
  const ownershipPending = technicalDesignOwnership('<!-- template-version: 2 -->\n## 单一事实源与所有权\n| 事实 | 待确认 |\n## 方案')
  truthy('technicalDesignOwnership v2 pending fails', ownershipPending.hasSection && !ownershipPending.complete)
  const ownershipComplete = technicalDesignOwnership('<!-- template-version: 2 -->\n## 单一事实源与所有权\n| 分类规则 | categoryRules.ts | import | 否 | 无 |\n## 方案')
  truthy('technicalDesignOwnership v2 complete passes', ownershipComplete.applicable && ownershipComplete.hasSection && ownershipComplete.complete)
  const dataFlowV2 = technicalDesignDataFlow('<!-- template-version: 2 -->\n## 方案')
  truthy('technicalDesignDataFlow v2 not applicable', !dataFlowV2.applicable)
  const dataFlowMissing = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 方案\n已完成')
  truthy('technicalDesignDataFlow v3 missing section', dataFlowMissing.applicable && !dataFlowMissing.hasSection)
  const dataFlowPending = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 数据流与分层契约\n| UserCard | 待确认 |\n## 方案')
  truthy('technicalDesignDataFlow v3 pending fails', dataFlowPending.hasSection && !dataFlowPending.complete)
  const dataFlowComplete = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 数据流与分层契约\n| UserCard | useUser | userKeys.detail | getUser | userSchema/UserDto | mapUser | UserModel | React Query | mapper test |\n## 方案')
  truthy('technicalDesignDataFlow v3 complete passes', dataFlowComplete.applicable && dataFlowComplete.hasSection && dataFlowComplete.complete)
  const dataFlowPureUi = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 数据流与分层契约\n| StaticBanner | N/A：数据来自静态 i18n 配置 |\n## 方案')
  truthy('technicalDesignDataFlow v3 pure UI N/A passes', dataFlowPureUi.complete)
  const breadcrumbNoInventory = technicalDesignBreadcrumbCheck('无面包屑', '## 方案')
  truthy('technicalDesignBreadcrumbCheck no breadcrumb not applicable', !breadcrumbNoInventory.applicable)
  const breadcrumbMissing = technicalDesignBreadcrumbCheck(
    '【合约管理后台】--【合约跟单】--【Kol列表】\n【合约管理后台】--【合约跟单】--【跟单者管理】',
    '## 路径核验\n| 【合约管理后台】--【合约跟单】--【Kol列表】 | grep KolListPanel | 命中 | KolListPanel.vue |',
  )
  truthy(
    'technicalDesignBreadcrumbCheck flags breadcrumb missing from design doc',
    breadcrumbMissing.applicable && breadcrumbMissing.missing.length === 1,
  )
  const breadcrumbComplete = technicalDesignBreadcrumbCheck(
    '【合约管理后台】--【合约跟单】--【Kol列表】\n【合约管理后台】--【合约跟单】--【跟单者管理】',
    '## 路径核验\n| 【合约管理后台】--【合约跟单】--【Kol列表】 | grep KolListPanel | 命中 | KolListPanel.vue |\n| 【合约管理后台】--【合约跟单】--【跟单者管理】 | grep copyTradingAdminFollow | 缺失（需确认跨 PR 依赖） | N/A，待确认 |',
  )
  truthy(
    'technicalDesignBreadcrumbCheck passes when every breadcrumb echoed',
    breadcrumbComplete.applicable && breadcrumbComplete.hasSection && breadcrumbComplete.missing.length === 0,
  )

  // VERIFY-G6-004：evidence 目录只保留文字报告，二进制/临时文件应放 /tmp/
  const tmpEvidence = '/tmp/verify-project-gate-selftest-evidence'
  try {
    if (existsSync(tmpEvidence)) {
      for (const name of readdirSync(tmpEvidence)) {
        const p = join(tmpEvidence, name)
        if (statSync(p).isDirectory()) rmSync(p, { recursive: true })
        else rmSync(p)
      }
    }
    mkdirSync(tmpEvidence, { recursive: true })
    mkdirSync(join(tmpEvidence, 'ui-ux', '2026-07-23'), { recursive: true })
    writeFileSync(join(tmpEvidence, 'ui-ux', '2026-07-23', 'README.md'), '# report')
    writeFileSync(join(tmpEvidence, 'ui-ux', '2026-07-23', 'screenshot.png'), 'png')
    writeFileSync(join(tmpEvidence, 'dump.html'), '<html></html>')
    const found = findBinaryEvidenceFiles(tmpEvidence)
    truthy('findBinaryEvidenceFiles detects png and html', found.length === 2 && found.some((n) => n.endsWith('.png')) && found.some((n) => n.endsWith('.html')))
    truthy('findBinaryEvidenceFiles ignores README', !found.some((n) => n.endsWith('README.md')))
    const clean = '/tmp/verify-project-gate-selftest-evidence-clean'
    if (existsSync(clean)) rmSync(clean, { recursive: true })
    mkdirSync(clean, { recursive: true })
    writeFileSync(join(clean, 'README.md'), '# report')
    truthy('findBinaryEvidenceFiles clean', findBinaryEvidenceFiles(clean).length === 0)
    rmSync(clean, { recursive: true })
  } finally {
    if (existsSync(tmpEvidence)) rmSync(tmpEvidence, { recursive: true })
  }

  const sequentialHistory = {
    runs: [
      { gate: 'G5', ok: true, summary: { fail: 0 } },
      { gate: 'G6', ok: true, summary: { fail: 0 } },
    ],
  }
  truthy('historyHasPassedGate accepts persisted G5 pass', historyHasPassedGate(sequentialHistory, 'G5'))
  truthy('historyHasPassedGate rejects missing G7 pass', !historyHasPassedGate(sequentialHistory, 'G7'))
  truthy('historyHasPassedGate rejects blocked run', !historyHasPassedGate({ runs: [{ gate: 'G5', ok: false, summary: { fail: 1 } }] }, 'G5'))

  // 阻塞登记接线：语义细节由 lib/blockers.mjs 自测，这里只确认聚合器接进 gate 的行为不漂。
  const openBlocker = { id: 'BLK-1', type: 'blocker', gate: 'G5', blocksGate: 'G6', category: 'backend', summary: 'x', owner: 'be', raisedAt: '2026-08-03', status: 'open' }
  truthy('blockerChecks absent file → 空', blockerChecks({ entries: null, gate: 'G6' }).length === 0)
  truthy('blockerChecks open 阻塞到点 → DOC-BLOCK-002 fail', blockerChecks({ entries: [openBlocker], gate: 'G6' }).find((c) => c.ruleId === 'DOC-BLOCK-002')?.ok === false)
  truthy('blockerChecks 未到点 → DOC-BLOCK-002 pass', blockerChecks({ entries: [openBlocker], gate: 'G5' }).find((c) => c.ruleId === 'DOC-BLOCK-002')?.ok === true)
  truthy('blockerChecks 结构非法 → 只 001 fail', (() => { const r = blockerChecks({ entries: [{ ...openBlocker, id: 'bad' }], gate: 'G6' }); return r.length === 1 && r[0].ruleId === 'DOC-BLOCK-001' && !r[0].ok })())

  if (failures.length) {
    console.error(`verify-project-gate self-test FAILED (${failures.length}):\n  ${failures.join('\n  ')}`)
    process.exit(1)
  }
  console.log('verify-project-gate self-test passed (38 predicate/parser cases).')
  process.exit(0)
}

if (args.includes('--self-test')) runSelfTest()

if (!/^PR-\d{5}$/.test(projectId || '') || !/^G[0-8]$/.test(gate)) failUsage()

const projectDir = join(docsRoot, projectId)
const checks = []

function rel(file) {
  return relative(repoRoot, file)
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function readJson(file) {
  try {
    return JSON.parse(read(file))
  } catch {
    return null
  }
}

function stageStatus(stage) {
  return readJson(join(projectDir, 'agent/stage-status.json'))?.stages?.[stage] || null
}

function historyHasPassedGate(history, stage) {
  return Array.isArray(history?.runs) && history.runs.some((run) => run?.gate === stage && run?.ok === true && run?.summary?.fail === 0)
}

function hasPassedGate(stage) {
  const history = readJson(join(projectDir, 'agent/gate-history.json'))
  return historyHasPassedGate(history, stage)
}

function evidencePathsExist(paths) {
  return Array.isArray(paths) && paths.length > 0 && paths.every((file) => existsSync(join(projectDir, file)))
}

function readEvidenceText(evidenceDir) {
  if (!existsSync(evidenceDir)) return ''
  const names = readdirSync(evidenceDir, { recursive: true })
  return names
    .filter((name) => String(name).endsWith('README.md'))
    .map((name) => read(join(evidenceDir, String(name))))
    .join('\n')
}

// VERIFY-G6-004：证据目录只保存文字报告，二进制/临时对比素材必须放 /tmp/ 或 .gitignore 目录，禁止入 evidence。
function findBinaryEvidenceFiles(evidenceDir) {
  if (!existsSync(evidenceDir)) return []
  const blocked = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.html', '.htm', '.svg']
  const names = readdirSync(evidenceDir, { recursive: true })
  return names
    .filter((name) => {
      const lower = String(name).toLowerCase()
      return blocked.some((ext) => lower.endsWith(ext))
    })
    .map((name) => String(name))
}

function add(ruleId, ok, message, file = projectDir, severity = 'error', category = 'documentation') {
  checks.push({ ruleId, ok, message, file: rel(file), severity, category })
}

function requiredFile(ruleId, pathFromProject) {
  const file = join(projectDir, pathFromProject)
  add(ruleId, existsSync(file), `required file exists: ${pathFromProject}`, file)
  return file
}

function hasNoPlaceholders(ruleId, file, label, extra = []) {
  const text = read(file)
  const hits = findBlockingPlaceholders(text, extra)
  add(ruleId, hits.length === 0, `${label} has no blocking placeholders${hits.length ? `: ${hits.join(', ')}` : ''}`, file)
}

function parseMarkdownTableRows(text, heading) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const rows = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (index > start + 1 && line.startsWith('## ')) break
    if (!line.startsWith('|')) continue
    if (/^\|[-: |]+\|$/.test(line)) continue
    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()))
  }
  return rows.slice(1)
}

// 阶段 gate 的脆弱判定核心抽成纯谓词，供 --self-test 用 +/- 锚点用例逐条守正则/表格解析漂移
// （历史假阳性根因）。改行序/列序/占位词时，自测会先在 pre-commit/hook 处 fail。
function recordsPrdSource(text) {
  return /\| PRD 来源 \|\s*(?!\s*\|)/.test(text)
}
function recordsG2Confirmer(text) {
  return /\| G2 确认人 & 日期 \|\s*(?!\s*(待确认)?\s*\|)/.test(text)
}
function featureRowsMissingStatus(rows) {
  return rows.filter((row) => row[0] && !row.some((cell) => ['做', '不做', '延期'].includes(cell)))
}
function featureRowStatus(row) {
  return row.find((cell) => ['做', '不做', '延期'].includes(cell)) || ''
}
function parseResponsibilityModulePaths(value) {
  const backtickPaths = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1])
  const candidates = backtickPaths.length ? backtickPaths : value.split(/[,，、]/)
  return candidates
    .map((item) => item.trim().replace(/^`|`$/g, '').replace(/\/\*\*$/, ''))
    .filter((item) => item && !item.includes('如 ') && !item.includes('待'))
}
function completedTasksWithUnresolvedContract(text) {
  return text
    .split('\n')
    .filter((line) => /^\s*-\s*\[[xX]\]/.test(line) && /ASSUMED|待后端|待对账|后端侧待办|契约未完成/.test(line))
}
function findBlockingPlaceholders(text, extra = []) {
  const placeholders = ['待填写', '待读取', '待 G2 确认', ...extra]
  return placeholders.filter((item) => text.includes(item))
}
function technicalDesignOwnership(text) {
  const templateVersion = Number(text.match(/template-version:\s*(\d+)/)?.[1] || 0)
  const section = text.match(/## 单一事实源与所有权[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[0] || ''
  return {
    applicable: templateVersion >= 2,
    hasSection: Boolean(section),
    complete: Boolean(section) && !/待确认|待填写/.test(section),
  }
}
function technicalDesignDataFlow(text) {
  const templateVersion = Number(text.match(/template-version:\s*(\d+)/)?.[1] || 0)
  const section = text.match(/## 数据流与分层契约[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[0] || ''
  return {
    applicable: templateVersion >= 3,
    hasSection: Boolean(section),
    complete: Boolean(section) && !/待确认|待填写|待检查/.test(section),
  }
}
// DOC-G4-008/009（PR-01947 教训，2026-07-27）：PRD 给出的两条不同面包屑路径，落点探查时
// 其中一条 grep 不到真实代码，探查者未如实报「缺失」，而是静默顶替映射成了另一个名字相近的
// UI 元素——导致 PRD 真正要改的页面全程零改动、零测试却"验收通过"。此检查强制功能清单里
// 出现的每条面包屑，必须在技术方案里逐条原文复述+核验，不允许探查时找不到目标就悄悄换成
// 别的组件（见 architecture-and-state.md §2.2）。
function technicalDesignBreadcrumbCheck(inventoryText, designText) {
  const breadcrumbs = [...new Set((inventoryText.match(/【[^】]+】(?:--【[^】]+】)+/g) || []))]
  if (!breadcrumbs.length) return { applicable: false }
  const section = designText.match(/## (?:PRD )?路径核验[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[0] || ''
  const missing = breadcrumbs.filter((breadcrumb) => !designText.includes(breadcrumb))
  return {
    applicable: true,
    hasSection: Boolean(section),
    missing,
  }
}
// VERIFY-G6-002：不止「写了 review 命令名」，还要求 findings 有处理结论、且无未处理悬空项。
// 判据（纯谓词，供 self-test）：
//  ① 记录了 code-review / Review；
//  ② 记录了处理结论（已修 / 豁免 / 不适用 / 0 findings / 无问题）；
//  ③ 无未处理悬空标记（findings 旁写「待修复 / 未处理 / 待处理 finding」却无结论）= 未清零，判 fail。
// ③ 用于堵「写了 3 条 findings 就算过」的漏洞：未处理即红灯，要么当场修、要么进 rule-waivers.json。
function codeReviewFindingsResolved(text) {
  const mentionsReview = /code-review|\/code-review|Review/.test(text)
  const recordsDisposition = /findings?|finding|问题|处理|结论|disposition|0\s*findings?|无问题|已修复|已修|豁免|不适用|N\/A/i.test(text)
  const hasUnresolved = /(待修复|未处理|待处理|未修复|pending\s*fix|unresolved)/i.test(text)
  return mentionsReview && recordsDisposition && !hasUnresolved
}

// GIT-G4-002 基线判定（纯谓词，供 self-test）。
// 关键区分——两种偏离语义完全不同：
//  - 良性：feature 从 online 切出后，origin/online 又前进了（主线正常推进）。基线正确，不该 FAIL。
//  - 恶性：从 dev/test 或与 online 无共同历史处切出（把他人未上线提交带进 feature）。必须 BLOCK。
// 现状用 `origin/online is-ancestor HEAD` 把「良性前进」也判成 FAIL（过严误报）。
// 修正：只要 HEAD 与 origin/online 有共同历史（hasCommonBase）即基线合法 pass；
// online 已前进（!onlineIsAncestorOfHead）仅作 warn 提示「可考虑同步基线」，不阻断。
// 无共同历史（hasCommonBase=false）= 从无关分支切，仍 error。
function classifyBaseline(hasCommonBase, onlineIsAncestorOfHead) {
  if (!hasCommonBase) return { ok: false, severity: 'error', note: 'no common history with origin/online — likely branched off a non-online ref' }
  if (!onlineIsAncestorOfHead) return { ok: true, severity: 'warn', note: 'baseline valid but origin/online has advanced since branch point; consider syncing before merge' }
  return { ok: true, severity: 'error', note: 'HEAD descends from current origin/online' }
}

function runGit(gitArgs, cwd = repoRoot) {
  const result = spawnSync('git', gitArgs, { cwd, stdio: 'pipe', encoding: 'utf8' })
  return { ok: result.status === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

// 豁免：读 <projectDir>/agent/rule-waivers.json（见 rule-ids-and-gates.md §4）。
// 命中的 error 失败项降级为 waived（可见、不阻断）；过期 / 无 expiresAt / 文件非法一律不生效，
// 并以 warn 暴露，避免"永久绕过"和"静默豁免"。
function applyWaivers() {
  const waiverFile = join(projectDir, 'agent/rule-waivers.json')
  if (!existsSync(waiverFile)) return
  let waivers
  try {
    waivers = JSON.parse(read(waiverFile))
  } catch (error) {
    add('DOC-WAIVER-001', false, `rule-waivers.json is not valid JSON: ${error.message}`, waiverFile, 'warn')
    return
  }
  if (!Array.isArray(waivers)) {
    add('DOC-WAIVER-001', false, 'rule-waivers.json must be a JSON array of waiver objects', waiverFile, 'warn')
    return
  }
  const today = new Date().toISOString().slice(0, 10)
  for (const waiver of waivers) {
    if (!waiver || !waiver.ruleId) continue
    if (!waiver.expiresAt) {
      add('DOC-WAIVER-002', false, `waiver for ${waiver.ruleId} has no expiresAt; ignored (waivers must expire)`, waiverFile, 'warn')
      continue
    }
    if (waiver.expiresAt < today) {
      add('DOC-WAIVER-003', false, `waiver for ${waiver.ruleId} expired ${waiver.expiresAt}; still enforced`, waiverFile, 'warn')
      continue
    }
    for (const check of checks) {
      if (check.ruleId !== waiver.ruleId) continue
      const rule = ruleset?.rules?.[check.ruleId]
      if (rule?.waivable === false) {
        add('DOC-WAIVER-004', false, `waiver for ${check.ruleId} is ignored because the rule is non-waivable`, waiverFile, 'warn')
        continue
      }
      if (!check.ok && check.severity === 'error' && (!waiver.file || waiver.file === check.file)) {
        check.severity = 'waived'
        check.message += ` [waived: ${waiver.reason || 'no reason'} · owner=${waiver.owner || '?'} · until ${waiver.expiresAt}]`
      }
    }
  }
}

function validateBaseStructure() {
  add('DOC-STRUCT-001', existsSync(projectDir), `project directory exists: apps/web/docs_tdd/${projectId}`, projectDir)
  requiredFile('DOC-STRUCT-002', 'README.md')
  requiredFile('DOC-STRUCT-003', 'product/00-feature-inventory.md')
  requiredFile('DOC-STRUCT-004', 'product/01-scope-and-phases.md')
  requiredFile('DOC-STRUCT-005', 'product/02-technical-design.md')
  requiredFile('DOC-STRUCT-006', 'product/03-api-contract.md')
  requiredFile('DOC-STRUCT-007', 'product/04-frontend-tasks.md')
  requiredFile('DOC-STRUCT-008', 'product/05-ui-and-interaction.md')
  requiredFile('DOC-STRUCT-009', 'product/06-collaboration.md')
  requiredFile('DOC-STRUCT-010', 'product/07-figma-spec.md')
  requiredFile('DOC-STRUCT-011', 'engineering/development-rules.md')
  requiredFile('DOC-STRUCT-012', 'agent/README.md')
}

function validateG0() {
  validateBaseStructure()
  const inventory = join(projectDir, 'product/00-feature-inventory.md')
  const text = read(inventory)
  add('DOC-G0-001', recordsPrdSource(text), 'feature inventory records PRD source', inventory)
  add('DOC-G0-002', /## 功能清单/.test(text), 'feature inventory has feature list section', inventory)
  add('DOC-G0-003', /## 验收标准对照/.test(text), 'feature inventory has acceptance mapping section', inventory)
  add('DOC-G0-004', /## PRD 未完全可读内容/.test(text), 'feature inventory has unreadable PRD content section', inventory, 'warn')
  validatePrdIntake(['G0', 'G1'].includes(gate) ? 'G0' : 'G2')
}

function validatePrdIntake(stage) {
  const manifest = readJson(join(projectDir, 'agent/project-manifest.json'))
  if (!manifest?.pilot?.prdIntake) return
  const intake = spawnSync(process.execPath, [join(dirname(scriptPath), 'prd-intake.mjs'), projectId, '--stage', stage, '--json'], {
    cwd: gitCwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  let result = null
  try {
    result = JSON.parse(intake.stdout)
  } catch {
    add('DOC-PRD-001', false, `cannot parse PRD intake diagnostics: ${intake.stderr || intake.stdout}`, join(projectDir, 'agent/prd-source-manifest.json'))
    return
  }
  for (const check of result.checks || []) {
    add(check.ruleId, check.ok, check.message, join(projectDir, 'agent/prd-source-manifest.json'), check.severity || 'error', check.category || 'documentation')
  }
}

function validateG2() {
  validateG0()
  const inventory = join(projectDir, 'product/00-feature-inventory.md')
  const tasks = join(projectDir, 'product/04-frontend-tasks.md')
  const text = read(inventory)
  hasNoPlaceholders('DOC-G2-001', inventory, 'feature inventory')
  add('DOC-G2-002', recordsG2Confirmer(text), 'G2 confirmer and date are filled', inventory)

  const rows = parseMarkdownTableRows(text, '## 功能清单')
  const invalidRows = featureRowsMissingStatus(rows)
  add('DOC-G2-003', rows.length > 0, 'feature list has at least one feature row', inventory)
  add('DOC-G2-004', invalidRows.length === 0, 'each feature row has 本期=做/不做/延期', inventory)

  const doingIds = rows.filter((row) => featureRowStatus(row) === '做').map((row) => row[0]).filter(Boolean)
  const taskText = read(tasks)
  const missingTaskIds = doingIds.filter((id) => !taskText.includes(id))
  add('DOC-G2-005', missingTaskIds.length === 0, `all 本期=做 feature IDs appear in frontend tasks${missingTaskIds.length ? `: ${missingTaskIds.join(', ')}` : ''}`, tasks)
}

function validateG3() {
  validateG2()
  const apiContract = join(projectDir, 'product/03-api-contract.md')
  const apiText = read(apiContract)
  add('DOC-G3-001', /MSW 路线 B|路线 B|src\/mocks\/handlers/.test(apiText), 'G3 API contract locks mock route to MSW route B', apiContract)
  add('DOC-G3-002', /## 6\.1 MSW 路线 B 清单|MSW 落地前置/.test(apiText), 'G3 API contract contains MSW checklist / landing preconditions', apiContract)
  add('DOC-G3-003', /handler.*normal.*empty.*error.*unauthorized.*edge|normal.*empty.*error.*unauthorized.*edge/s.test(apiText), 'G3 MSW checklist covers normal/empty/error/unauthorized/edge scenarios', apiContract)
  add('DOC-G3-004', /契约测试|contract\.test|schema\.parse|schema\.safeParse|真实 schema/.test(apiText), 'G3 MSW route records schema contract test requirement', apiContract)
  add('DOC-G3-005', /browser\.ts|useMockWorker|dev-only|dev only|仅 dev|仅开发环境/.test(apiText), 'G3 MSW route records dev-only worker registration', apiContract)

  const tasks = join(projectDir, 'product/04-frontend-tasks.md')
  const tasksText = read(tasks)
  add('DOC-G3-006', /T03\s*\|\s*F01\s*\|\s*G3 API 未 ready 时补齐 MSW handler \/ 契约测试 \/ dev-only worker 注册/.test(tasksText), 'G3 frontend tasks include the MSW fallback task', tasks)

  const collab = join(projectDir, 'product/06-collaboration.md')
  const collabText = read(collab)
  add('DOC-G3-007', /MSW 路线 B|API 未 ready 时的 MSW 路线 B 落地清单/.test(collabText), 'G3 collaboration records the MSW fallback decision / checklist', collab)

  const projectManifest = readJson(join(projectDir, 'agent/project-manifest.json'))
  if (projectManifest?.pilot?.msw) {
    const mswRun = spawnSync(process.execPath, [join(dirname(scriptPath), 'verify-msw-manifest.mjs'), projectId, '--json'], { cwd: gitCwd, encoding: 'utf8', stdio: 'pipe' })
    let mswResult = null
    try {
      mswResult = JSON.parse(mswRun.stdout)
    } catch {
      add('DOC-G3-IMPL-001', false, `cannot parse MSW implementation diagnostics: ${mswRun.stderr || mswRun.stdout}`, join(projectDir, 'agent/msw-manifest.json'), 'warn')
    }
    for (const check of mswResult?.checks || []) {
      add(check.ruleId, check.ok, check.message, check.file, check.severity || 'error', check.category || 'implementation')
    }
  }
}

function validateG4() {
  validateG3()
  const design = join(projectDir, 'product/02-technical-design.md')
  const designText = read(design)
  hasNoPlaceholders('DOC-G4-001', design, 'technical design reuse inventory', ['待检查'])
  add('DOC-G4-002', /复用盘点/.test(designText), 'technical design contains reuse inventory', design)
  add('DOC-G4-003', !/跳过复用/.test(designText), 'technical design does not contain skipped-reuse wording', design)
  const ownership = technicalDesignOwnership(designText)
  if (ownership.applicable) {
    add('DOC-G4-004', ownership.hasSection, 'technical design template v2 contains single-source ownership inventory', design)
    add('DOC-G4-005', ownership.complete, 'single-source ownership inventory has no unresolved placeholders', design)
  }
  const dataFlow = technicalDesignDataFlow(designText)
  if (dataFlow.applicable) {
    add('DOC-G4-006', dataFlow.hasSection, 'technical design template v3 contains data-flow and layer contract inventory', design)
    add('DOC-G4-007', dataFlow.complete, 'data-flow and layer contract inventory has no unresolved placeholders', design)
  }
  const inventoryText = read(join(projectDir, 'product/00-feature-inventory.md'))
  const breadcrumb = technicalDesignBreadcrumbCheck(inventoryText, designText)
  if (breadcrumb.applicable) {
    add('DOC-G4-008', breadcrumb.hasSection, 'technical design contains PRD breadcrumb-path verification table (§2.2)', design)
    add(
      'DOC-G4-009',
      breadcrumb.missing.length === 0,
      breadcrumb.missing.length
        ? `PRD breadcrumb path(s) from feature inventory not echoed verbatim in technical design — possible silent substitution: ${breadcrumb.missing.join('; ')}`
        : 'every PRD breadcrumb path in feature inventory is echoed verbatim in technical design',
      design,
    )
  }

  // GIT-G4-001/002 are point-in-time checks: they describe state DURING active G4 coding
  // (on the feature branch, HEAD fresh from origin/online). Re-validating a later gate or a
  // shipped project happens on online/merged branches where these no longer hold — so only
  // enforce when G4 is the explicitly requested gate, not on cumulative descent from G5+.
  if (gate === 'G4') {
    const branch = runGit(['branch', '--show-current'], gitCwd)
    const onExact = branch.stdout === `feature/${projectId}`
    // A shared or differently-named feature/* branch is tolerated (warn, non-blocking);
    // coding on a non-feature branch (e.g. online) is still blocked.
    const onFeature = branch.stdout.startsWith('feature/')
    add('GIT-G4-001', onExact, `current branch is feature/${projectId} (feature/* tolerated); got ${branch.stdout || 'unknown'}`, projectDir, onFeature ? 'warn' : 'error')
    // 基线判定见 classifyBaseline：区分「良性前进(warn)」与「从非 online 切(error)」，不再把主线前进误判为 FAIL。
    const hasCommonBase = runGit(['merge-base', 'origin/online', 'HEAD'], gitCwd).ok
    const onlineIsAncestor = runGit(['merge-base', '--is-ancestor', 'origin/online', 'HEAD'], gitCwd).ok
    const baseline = classifyBaseline(hasCommonBase, onlineIsAncestor)
    add('GIT-G4-002', baseline.ok, baseline.note, projectDir, baseline.severity)
  }
}

function validateG5() {
  validateG4()
  const apiContract = join(projectDir, 'product/03-api-contract.md')
  const apiText = read(apiContract)
  add('DOC-G5-001', /字段对账|字段来源|契约来源/.test(apiText), 'API contract records field reconciliation', apiContract)
  add('DOC-G5-002', /mock|Mock/.test(apiText), 'API contract records mock status/removal result', apiContract)
  add('DOC-G5-003', /文案契约|文案 ID|zh-CN key|动态变量/.test(apiText), 'API contract records copy contract table', apiContract)
  const frontendTasks = join(projectDir, 'product/04-frontend-tasks.md')
  const unresolvedCompletedTasks = completedTasksWithUnresolvedContract(read(frontendTasks))
  add(
    'DOC-G5-004',
    unresolvedCompletedTasks.length === 0,
    unresolvedCompletedTasks.length === 0
      ? 'completed tasks contain no unresolved contract assumptions'
      : `checked-complete tasks still contain ASSUMED/pending contract work:\n${unresolvedCompletedTasks.join('\n')}`,
    frontendTasks,
  )
  add('CODE-MSW-004', /MSW|路线 B|src\/mocks\/handlers/.test(apiText), 'new feature mock route is MSW route B or explicitly documented', apiContract)
  const collaboration = join(projectDir, 'product/06-collaboration.md')
  const collabText = read(collaboration)
  const usesMswRouteB = /MSW|路线 B|src\/mocks\/handlers|handlers?/.test(apiText)
  if (usesMswRouteB) {
    add('CODE-MSW-001', /契约测试|contract\.test|schema\.parse|schema\.safeParse|schema-fixture-reconcile/.test(apiText), 'MSW route B records contract/schema verification', apiContract)
    add('CODE-MSW-003', /handler.*(删|停|关闭|移除|转入测试|切真实)|((删|停|关闭|移除).*handler)|MSW.*(删|停|关闭|移除|转入测试|切真实)/i.test(`${apiText}\n${collabText}`), 'MSW route B records handler removal/disable or test-only disposition before G6 handoff', apiContract, 'warn')
  }

  const status = stageStatus('G5')
  add('VERIFY-G5-001', Boolean(status), 'agent/stage-status.json records the G5 integration disposition', join(projectDir, 'agent/stage-status.json'))
  add('VERIFY-G5-002', ['completed', 'not-applicable'].includes(status?.status), `G5 status is completed or not-applicable (got ${status?.status || 'missing'})`, join(projectDir, 'agent/stage-status.json'))
  const g5EvidenceOk = status?.status === 'not-applicable'
    ? Boolean(status?.reason)
    : status?.status === 'completed' && evidencePathsExist(status?.evidence)
  add('VERIFY-G5-003', g5EvidenceOk, 'G5 completion has existing evidence paths, or not-applicable has a concrete reason', join(projectDir, 'agent/stage-status.json'))

  // 责任模块目录可填在 00-feature-inventory.md（scope 事实）或 agent/context-summary.md（恢复上下文），
  // 两处任一命中即可，避免脚手架把字段放在 context-summary 而 gate 只读 inventory 导致恒空。
  const moduleText = [
    read(join(projectDir, 'product/00-feature-inventory.md')),
    read(join(projectDir, 'agent/context-summary.md')),
  ]
    .flatMap((text) => text.split('\n'))
    .filter((line) => line.includes('| 责任模块目录 |'))
    .map((line) => line.split('|').slice(1, -1)[1]?.trim() || '')
    .find(Boolean) || ''
  const modulePaths = parseResponsibilityModulePaths(moduleText)
  const existingModulePaths = modulePaths.filter((item) => existsSync(join(gitCwd, item)))

  if (!existingModulePaths.length) {
    // Field unfilled → cannot scan; warn instead of hard-fail so an unset optional field does
    // not block delivery. Fill 责任模块目录 in 00-feature-inventory.md to enable the scan.
    add('CODE-MOCK-001', false, 'responsibility module paths unset; cannot scan mock residue (fill 责任模块目录 to enable)', join(projectDir, 'product/00-feature-inventory.md'), 'warn')
    return
  }

  // 责任模块相关扫描都在当前 worktree（gitCwd）跑：G5 编码/对账发生在 feature worktree，
  // 用 repoRoot（symlink 解析回主仓、通常在 online）会漏看 worktree 里的实际改动。
  const grepArgs = ['-n', '@mock-only|USE_MOCK|\bisMock\b', ...existingModulePaths]
  const grep = spawnSync('rg', grepArgs, { cwd: gitCwd, stdio: 'pipe', encoding: 'utf8' })
  if (grep.error || (grep.status !== 0 && grep.status !== 1)) {
    // rg missing or errored (status null on ENOENT) → cannot scan; warn, never false-positive as residue.
    add('CODE-MOCK-002', false, `cannot scan mock residue (rg unavailable: ${grep.error ? grep.error.code : `status ${grep.status}`})`, projectDir, 'warn')
  } else {
    add('CODE-MOCK-002', grep.status === 1, grep.status === 1 ? 'mock residue grep is empty in responsibility modules' : `mock residue found:\n${grep.stdout.trim()}`)
  }

  if (usesMswRouteB && !grep.error && (grep.status === 0 || grep.status === 1)) {
    add('CODE-MSW-002', grep.status === 1, grep.status === 1 ? 'MSW route B leaves no business mock switch residue in responsibility modules' : `MSW route B business mock residue found:\n${grep.stdout.trim()}`)
  }

  // CODE-ASSUMED-001（warn）：真实接口/文档到位后（G5 对账阶段）责任模块里残留 `// ASSUMED:` = 字段对账没做完
  // （architecture-and-state §8.0.2：残留 ASSUMED = 对账未完成）。warn-first——「接口是否已 ready」靠人判，
  // 故只提示不阻断；对账逐条销账后应归零。rg 不可用时静默跳过（不假阳性）。
  const assumed = spawnSync('rg', ['-n', '-F', '// ASSUMED:', ...existingModulePaths], { cwd: gitCwd, stdio: 'pipe', encoding: 'utf8' })
  if (!assumed.error && (assumed.status === 0 || assumed.status === 1)) {
    add('CODE-ASSUMED-001', assumed.status === 1, assumed.status === 1 ? 'no `// ASSUMED:` residue in responsibility modules' : `\`// ASSUMED:\` residue (reconcile & clear per §8.0.2):\n${assumed.stdout.trim()}`, projectDir, 'warn')
  }

  // CODE-SCOPE-001（warn）：改动落在责任模块目录白名单外 = 越界（change-scope-boundary §1.1）。
  // warn-first——跨模块重构/公共能力改动可能合法，故只提示 + 重点 check，不阻断。取 worktree 相对 origin/online
  // 的源码改动（apps/web/src 与 packages 的 .ts/.tsx），逐个比对是否落在任一 modulePath 前缀下。
  const isInScope = (f) => modulePaths.some((p) => {
    const prefix = p.endsWith('/') ? p : `${p}/`
    return f === p || f.startsWith(prefix)
  })
  const changed = runGit(['diff', '--name-only', '--diff-filter=ACMR', 'origin/online...HEAD'], gitCwd)
  const changedFiles = (changed.ok ? changed.stdout : '')
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => /^(apps\/web\/src|packages)\/.+\.(ts|tsx)$/.test(f))
  if (changedFiles.length) {
    const outOfScope = changedFiles.filter((f) => !isInScope(f))
    add('CODE-SCOPE-001', outOfScope.length === 0, outOfScope.length === 0 ? 'all changed source files fall inside 责任模块目录' : `changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):\n${outOfScope.join('\n')}`, projectDir, 'warn')
  }
}

function validateG6() {
  validateG5()
  add('VERIFY-STAGE-001', hasPassedGate('G5'), 'G6 requires a persisted successful G5 run in agent/gate-history.json', join(projectDir, 'agent/gate-history.json'))
  const evidenceDir = join(projectDir, 'evidence')
  const hasEvidence = existsSync(evidenceDir) && readdirSync(evidenceDir, { recursive: true }).some((name) => String(name).endsWith('README.md'))
  add('VERIFY-G6-001', hasEvidence, 'at least one evidence README exists under project evidence/', evidenceDir)
  const evidenceText = readEvidenceText(evidenceDir)
  const collaboration = join(projectDir, 'product/06-collaboration.md')
  const collabText = read(collaboration)
  add('VERIFY-G6-002', codeReviewFindingsResolved(collabText), 'code-review findings recorded with disposition and no unresolved items (fix on the spot or waive)', collaboration)
  add('VERIFY-G6-003', /\|\s*命令\s*\|\s*目标文件|Command\s*\|\s*Target|Biome|biome|node --check|verify-code-rules|check-doc-budget/.test(`${evidenceText}\n${collabText}`), 'verification evidence records command target/result, including Biome or documented fallback', evidenceDir)
  const binaryFiles = findBinaryEvidenceFiles(evidenceDir)
  add('VERIFY-G6-004', binaryFiles.length === 0, binaryFiles.length === 0 ? 'evidence directory contains no binary/temporary files (only text reports)' : `evidence directory contains binary/temporary files that should be moved to /tmp/ or a .gitignore path: ${binaryFiles.join(', ')}`, evidenceDir, 'warn')
}

function validateG7() {
  validateG6()
  add('VERIFY-STAGE-002', hasPassedGate('G6'), 'G7 requires a persisted successful G6 run in agent/gate-history.json', join(projectDir, 'agent/gate-history.json'))
  const status = stageStatus('G7')
  add('VERIFY-G7-001', Boolean(status), 'agent/stage-status.json records the G7 QA disposition', join(projectDir, 'agent/stage-status.json'))
  add('VERIFY-G7-002', ['completed', 'skipped'].includes(status?.status), `G7 status is completed or skipped (got ${status?.status || 'missing'})`, join(projectDir, 'agent/stage-status.json'))
  const g7EvidenceOk = status?.status === 'skipped'
    ? Boolean(status?.reason)
    : status?.status === 'completed' && evidencePathsExist(status?.evidence)
  add('VERIFY-G7-003', g7EvidenceOk, 'G7 completion has existing evidence paths, or skipped has a concrete reason', join(projectDir, 'agent/stage-status.json'))
}

function validateG8() {
  validateG7()
  add('VERIFY-STAGE-003', hasPassedGate('G7'), 'G8 requires a persisted successful G7 run in agent/gate-history.json', join(projectDir, 'agent/gate-history.json'))
}

const validators = { G0: validateG0, G1: validateG0, G2: validateG2, G3: validateG3, G4: validateG4, G5: validateG5, G6: validateG6, G7: validateG7, G8: validateG8 }
validators[gate]()

// 阻塞与变更登记跨所有阶段生效：读 agent/blockers.json，把 DOC-BLOCK-* 结论并入 checks。
// 放在 validator 之后、applyWaivers 之前——这样 DOC-BLOCK-002 能走既有 waiver 降级链路。
// 文件缺失 = 不发 check（零回填）；语义源在 lib/blockers.mjs，本处只做 I/O + add()。
{
  const blockerFile = join(projectDir, 'agent/blockers.json')
  const entries = existsSync(blockerFile) ? readJson(blockerFile) : null
  if (existsSync(blockerFile) && entries === null) {
    add('DOC-BLOCK-001', false, 'blockers.json 不是合法 JSON', blockerFile)
  } else {
    for (const check of blockerChecks({ entries, gate, file: rel(blockerFile) })) {
      add(check.ruleId, check.ok, check.message, blockerFile, check.severity, check.category)
    }
  }
}

// Local pilots keep their creation-time contract. Newly introduced checks are report-only
// until a project explicitly opts into blocking current rules.
const projectManifest = readJson(join(projectDir, 'agent/project-manifest.json'))
const ruleset = readJson(join(docsRoot, 'common/ruleset.json'))
if (projectManifest?.gatePolicy?.legacyRules === 'report-only') {
  for (const check of checks) {
    if (!check.ok && /^DOC-G3-00[1-7]$/.test(check.ruleId)) check.severity = 'warn'
  }
}

for (const check of checks) {
  const rule = ruleset?.rules?.[check.ruleId]
  if (!check.ok && rule) {
    const projectReportOnly = projectManifest?.gatePolicy?.currentTouchedRules === 'report-only'
    check.severity = !rule.blocking || projectReportOnly ? 'warn' : 'error'
  }
}

applyWaivers()

function summarize(checkList) {
  return {
    total: checkList.length,
    ok: checkList.filter((check) => check.ok).length,
    warn: checkList.filter((check) => !check.ok && check.severity === 'warn').length,
    waived: checkList.filter((check) => !check.ok && check.severity === 'waived').length,
    fail: checkList.filter((check) => !check.ok && check.severity === 'error').length,
  }
}

const groups = Object.fromEntries(
  ['documentation', 'implementation'].map((category) => [category, summarize(checks.filter((check) => check.category === category))]),
)
const result = { ok: checks.filter((check) => check.severity !== 'warn' && check.severity !== 'waived').every((check) => check.ok), projectId, gate, checks, groups }

// --write：把本次真实结果（含时间戳）落盘为 agent/gate-results.json，作为 G8 交付证据。
// 记录的是脚本此刻实际判定，不是人手编造"全绿"。G8 会校验产物来源、项目/阶段和 fail=0。
if (write) {
  const outDir = join(projectDir, 'agent')
  mkdirSync(outDir, { recursive: true })
  const summary = summarize(checks)
  const payload = { generatedAt: new Date().toISOString(), tool: 'verify-project-gate.mjs', ...result, summary }
  writeFileSync(join(outDir, 'gate-results.json'), `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`wrote ${rel(join(outDir, 'gate-results.json'))} (ok=${result.ok}, fail=${summary.fail}, warn=${summary.warn}, waived=${summary.waived})`)
}

if (json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  // 默认瘦输出：只打印需行动的行（FAIL/WARN/WAIV）+ 一行 summary，把通过项折叠成计数。
  // OK 行对 Agent 是噪音，累积会挤占上下文、诱发漂移。--verbose 才逐条全量。
  const okCount = checks.filter((c) => c.ok).length
  const actionable = checks.filter((c) => !c.ok)
  console.log(`verify-project-gate: ${projectId} ${gate} — ${result.ok ? 'PASS' : 'BLOCK'} (ok=${okCount}/${checks.length}; documentation=${groups.documentation.ok}/${groups.documentation.total}; implementation=${groups.implementation.ok}/${groups.implementation.total})`)
  for (const check of verbose ? checks : actionable) {
    const tag = check.ok ? 'OK' : check.severity === 'warn' ? 'WARN' : check.severity === 'waived' ? 'WAIV' : 'FAIL'
    console.log(`${tag} ${check.ruleId} ${check.file} - ${check.message}`)
  }
  if (!verbose && !actionable.length) console.log('all checks passed.')
}

process.exit(result.ok ? 0 : 1)
