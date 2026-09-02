#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { blockerChecks } from './lib/blockers.mjs'
import { assumptionChecks } from './lib/assumption-ledger.mjs'
import { codeReviewChecks } from './lib/code-review.mjs'
import { acceptanceConfirmationCheck, codeReviewConfirmationCheck, stageConfirmationCheck } from './lib/confirmation.mjs'
import { validateSchema } from './lib/doc-budget-schema.mjs'
import { fastTrackChecks } from './lib/fast-track-policy.mjs'
import { acceptanceChecks } from './lib/acceptance-results.mjs'
import { allowedG5Statuses, g5DispositionEvidenceOk, partialPrerequisiteCheck, partialRunNoteCheck, resolvePartialRun, splitPendingReconcile } from './lib/gate-partial.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { resolveSeverity } from './lib/rule-maturity.mjs'
import { classifyBaseline, codeReviewFindingsResolved, completedTasksWithUnresolvedContract, featureRowStatus, featureRowsMissingStatus, findBlockingPlaceholders, parseMarkdownTableRows, parseResponsibilityModulePaths, recordsG2Confirmer, recordsPrdSource, selfTest as gateDocParsersSelfTest, technicalDesignBreadcrumbCheck, technicalDesignDataFlow, technicalDesignOwnership } from './lib/gate-doc-parsers.mjs'
import { atomicRequirementChecks, parseAtomicRequirements, parseRequirementTasks } from './lib/requirement-coverage.mjs'
import { classifyWaiver } from './lib/waiver-policy.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()

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
// --partial：G6 的部分验收出口（G5 停靠态用）。语义与理由见 lib/gate-partial.mjs。
const partialRequested = args.includes('--partial')

function printHelp() {
  console.log(`usage: verify-project-gate.mjs <PR-01234> <G0-G8> [--json] [--write] [--verbose] [--partial] [--self-test] [--help]

Run a single project documentation/structure gate and emit JSON/check results.

Options:
  --help       Show this help message and exit
  --json       Output JSON result to stdout
  --write      Persist gate-results.json
  --verbose    Print every check, not just actionable ones
  --partial    G6 only: partial acceptance run for a G5 pending-reconcile project (records gate G6-partial)
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

  // 文档解析纯谓词（表格/字段正则、基线三分支等）已物理抽到 lib/gate-doc-parsers.mjs，
  // 直接委托其 self-test（34 cases，失败即 process.exit(1)）；本文件只留有 disk/git 副作用、
  // 无法搬进纯 lib 的断言（evidence 目录扫描、gate 历史、阻塞聚合器接线）。
  gateDocParsersSelfTest()

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
  console.log('verify-project-gate self-test passed (10 local + 34 delegated gate-doc-parsers cases).')
  process.exit(0)
}

if (args.includes('--self-test')) runSelfTest()

if (!/^PR-\d{5}$/.test(projectId || '') || !/^G[0-8]$/.test(gate)) failUsage()
// partial 只对 G6 合法；非法组合直接 usage 退出，不静默降级成完整 G6。
const { partial, gateLabel, error: partialError } = resolvePartialRun({ gate, partial: partialRequested })
if (partialError) {
  console.error(`[verify-project-gate] ${partialError}`)
  process.exit(1)
}

const projectDir = resolveProjectRoot(projectId)
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

// lib 产出的 check 统一接入 add()；null = 该 lib 判定本次不适用（不发 check）。
function addFrom(check, file) {
  if (check) add(check.ruleId, check.ok, check.message, file, check.severity, check.category)
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

function runGit(gitArgs, cwd = repoRoot) {
  const result = spawnSync('git', gitArgs, { cwd, stdio: 'pipe', encoding: 'utf8' })
  return { ok: result.status === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}

// 豁免：读 <projectDir>/agent/rule-waivers.json（见 rule-ids-and-gates.md §4）。
// 命中的 error 失败项降级为 waived（可见、不阻断）；过期 / 缺 owner·reason·expiresAt / 文件非法
// 一律不生效，且这三种「台账已失效」本身判 error（生命周期语义见 lib/waiver-policy.mjs）。
function applyWaivers() {
  const waiverFile = join(projectDir, 'agent/rule-waivers.json')
  if (!existsSync(waiverFile)) return
  let waivers
  try {
    waivers = JSON.parse(read(waiverFile))
  } catch (error) {
    add('DOC-WAIVER-001', false, `rule-waivers.json is not valid JSON: ${error.message}`, waiverFile, 'error')
    return
  }
  if (!Array.isArray(waivers)) {
    add('DOC-WAIVER-001', false, 'rule-waivers.json must be a JSON array of waiver objects', waiverFile, 'error')
    return
  }
  const today = new Date().toISOString().slice(0, 10)
  for (const waiver of waivers) {
    if (!waiver || !waiver.ruleId) continue
    const verdict = classifyWaiver(waiver, today)
    if (verdict.state !== 'active') {
      add(verdict.ruleId, false, verdict.message, waiverFile, 'error')
      continue
    }
    for (const check of checks) {
      if (check.ruleId !== waiver.ruleId) continue
      // 只有「失败且仍是 error」的检查才需要豁免：warn 级（永久 warn 规则、report-only 降级）
      // 本就不阻断，对它们发 DOC-WAIVER-004 只是噪音（CODE-MOCK-002/CODE-MSW-003 的豁免其实是给
      // verify-code-rules 用的，那边不读 ruleset）。
      if (check.ok || check.severity !== 'error') continue
      const rule = ruleset?.rules?.[check.ruleId]
      // 默认不可豁免：只有 ruleset.json 显式声明 waivable:true 的规则才接受豁免。
      // 此前判的是 `waivable === false`，未登记规则一律落进可豁免分支（DOC-G2-*/DOC-SYNC-* 都能被豁免掉）；
      // check-doc-budget 校验 5b 保证台账里的 error 级 ID 必须有 waivable 声明，故此处不会误伤已登记规则。
      if (rule?.waivable !== true) {
        add('DOC-WAIVER-004', false, `waiver for ${check.ruleId} is ignored because the rule is non-waivable`, waiverFile, 'warn')
        continue
      }
      if (!waiver.file || waiver.file === check.file) {
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
  validateG1()
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
  const atomic = atomicRequirementChecks({ inventoryText: text, tasksText: taskText, doingFeatureIds: doingIds, inventoryFile: inventory, tasksFile: tasks })
  for (const check of atomic.checks) addFrom(check, check.file)
}

function validateG1() {
  validateG0()
  const scope = join(projectDir, 'product/01-scope-and-phases.md')
  const design = join(projectDir, 'product/02-technical-design.md')
  const tasks = join(projectDir, 'product/04-frontend-tasks.md')
  const collaboration = join(projectDir, 'product/06-collaboration.md')
  add('DOC-G1-001', /本期范围|范围/.test(read(scope)), 'G1 scope document records the current scope', scope)
  add('DOC-G1-002', /复用盘点/.test(read(design)), 'G1 technical design contains reuse inventory scaffold', design)
  add('DOC-G1-003', /任务清单|\|\s*ID\s*\|/.test(read(tasks)), 'G1 frontend tasks contain a task inventory', tasks)
  add('DOC-G1-004', /待确认|差异|协作/.test(read(collaboration)), 'G1 collaboration document records decisions or pending items', collaboration)
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
  add('DOC-G3-006', /T03\s*\|\s*F01\s*\|(?:\s*(?:—|-|N\/A)\s*\|)?\s*G3 API 未 ready 时补齐 MSW handler \/ 契约测试 \/ dev-only worker 注册/.test(tasksText), 'G3 frontend tasks include the MSW fallback task', tasks)

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
    const baseRef = config.baseRef || 'origin/online'
    const hasCommonBase = runGit(['merge-base', baseRef, 'HEAD'], gitCwd).ok
    const onlineIsAncestor = runGit(['merge-base', '--is-ancestor', baseRef, 'HEAD'], gitCwd).ok
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
  const allowedG5 = allowedG5Statuses(partial)
  add('VERIFY-G5-002', allowedG5.includes(status?.status), `G5 status is ${allowedG5.join(' / ')} (got ${status?.status || 'missing'})`, join(projectDir, 'agent/stage-status.json'))
  const g5EvidenceOk = g5DispositionEvidenceOk({
    status: status?.status,
    evidenceOk: evidencePathsExist(status?.evidence),
    hasReason: Boolean(status?.reason),
  })
  add('VERIFY-G5-003', g5EvidenceOk, 'G5 completion has existing evidence paths, or not-applicable/pending-reconcile has a concrete reason', join(projectDir, 'agent/stage-status.json'))
  // VERIFY-G5-004：停靠态 frontend-complete-pending-reconcile = 前端已完成、仅待真实字段对账。
  // 普通运行下是报告态（warn，不放行完整 G6）；--partial 下它是本次结论的**依据**，故升 error。
  if (status?.status === 'frontend-complete-pending-reconcile') {
    add('VERIFY-G5-004', evidencePathsExist(status?.evidence) && Boolean(status?.reason), '前端完成待对账：须有前端 evidence 路径与待对账原因；此态不放行完整 G6，只能走 G6-partial', join(projectDir, 'agent/stage-status.json'), partial ? 'error' : 'warn')
  }
  // DOC-CONFIRM-001（warn）：G5 的人工处置态须留签名——README 人机分界说 G5+ 以人工确认为锚点。
  addFrom(stageConfirmationCheck({ stage: 'G5', status }), join(projectDir, 'agent/stage-status.json'))

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
  // 阶段前置：完整 G6 要 G5 PASS；G6-partial 的前提恰恰是 G5 还停靠着，故改要求 G4 PASS（编码前最后一个完整 gate）。
  if (partial) {
    const check = partialPrerequisiteCheck({ hasG4Pass: hasPassedGate('G4'), file: rel(join(projectDir, 'agent/gate-history.json')) })
    add(check.ruleId, check.ok, check.message, join(projectDir, 'agent/gate-history.json'), check.severity, check.category)
  } else {
    add('VERIFY-STAGE-001', hasPassedGate('G5'), 'G6 requires a persisted successful G5 run in agent/gate-history.json', join(projectDir, 'agent/gate-history.json'))
  }
  const evidenceDir = join(projectDir, 'evidence')
  const hasEvidence = existsSync(evidenceDir) && readdirSync(evidenceDir, { recursive: true }).some((name) => String(name).endsWith('README.md'))
  add('VERIFY-G6-001', hasEvidence, 'at least one evidence README exists under project evidence/', evidenceDir)
  const evidenceText = readEvidenceText(evidenceDir)
  const collaboration = join(projectDir, 'product/06-collaboration.md')
  const collabText = read(collaboration)
  const projectManifest = readJson(join(projectDir, 'agent/project-manifest.json'))
  const codeReviewFile = join(projectDir, 'agent/code-review.json')
  if (existsSync(codeReviewFile)) {
    const report = readJson(codeReviewFile)
    if (report === null) add('DOC-CR-001', false, 'code-review.json 不是合法 JSON', codeReviewFile)
    else {
      const currentSha = runGit(['rev-parse', 'HEAD'], gitCwd).stdout
      for (const check of codeReviewChecks({ report, currentSha, expectedProjectId: projectId, file: rel(codeReviewFile) })) {
        add(check.ruleId, check.ok, check.message, codeReviewFile, check.severity, check.category)
      }
      addFrom(codeReviewConfirmationCheck({ report }), codeReviewFile)
    }
  } else if ((projectManifest?.templateVersion || 0) >= 2) {
    add('DOC-CR-001', false, 'template v2+ 必须存在 agent/code-review.json', codeReviewFile)
  } else {
    add('VERIFY-G6-002', codeReviewFindingsResolved(collabText), 'legacy project: code-review findings recorded with disposition and no unresolved items', collaboration)
  }

  const inventoryText = read(join(projectDir, 'product/00-feature-inventory.md'))
  const doingFeatureIds = parseMarkdownTableRows(inventoryText, '## 功能清单')
    .filter((row) => featureRowStatus(row) === '做')
    .map((row) => row[0])
    .filter(Boolean)
  const acceptanceFile = join(projectDir, 'agent/acceptance-results.json')
  const atomicRequirements = parseAtomicRequirements(inventoryText).requirements
  const requirementTasks = parseRequirementTasks(read(join(projectDir, 'product/04-frontend-tasks.md'))).tasks
  let pendingReconcileIds = []
  if (existsSync(acceptanceFile)) {
    const report = readJson(acceptanceFile)
    if (report === null) add('DOC-AC-001', false, 'acceptance-results.json 不是合法 JSON', acceptanceFile)
    else {
      const currentSha = runGit(['rev-parse', 'HEAD'], gitCwd).stdout
      pendingReconcileIds = partial ? splitPendingReconcile(report.items).pending.map((item) => item.id) : []
      for (const check of acceptanceChecks({ report, doingFeatureIds, atomicRequirements, requirementTasks, expectedProjectId: projectId, currentSha, evidenceExists: (p) => existsSync(join(projectDir, p)), file: rel(acceptanceFile), partial })) {
        add(check.ruleId, check.ok, check.message, acceptanceFile, check.severity, check.category)
      }
      addFrom(acceptanceConfirmationCheck({ report }), acceptanceFile)
    }
  } else if ((projectManifest?.templateVersion || 0) >= 2) {
    add('DOC-AC-001', false, 'template v2+ 必须存在 agent/acceptance-results.json', acceptanceFile)
  }
  // partial 结论标记：把「本次是部分验收、不构成 G7 前置」写进 checks（验收报告不可读时也要出现）。
  if (partial) {
    const note = partialRunNoteCheck({ pendingIds: pendingReconcileIds, file: rel(acceptanceFile) })
    add(note.ruleId, note.ok, note.message, acceptanceFile, note.severity, note.category)
  }
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
  addFrom(stageConfirmationCheck({ stage: 'G7', status }), join(projectDir, 'agent/stage-status.json'))
}

function validateG8() {
  validateG7()
  add('VERIFY-STAGE-003', hasPassedGate('G7'), 'G8 requires a persisted successful G7 run in agent/gate-history.json', join(projectDir, 'agent/gate-history.json'))
  const projectManifest = readJson(join(projectDir, 'agent/project-manifest.json'))
  const deliveryFile = join(projectDir, 'agent/delivery-status.json')
  const delivery = readJson(deliveryFile)
  if ((projectManifest?.templateVersion || 0) >= 2 || existsSync(deliveryFile)) {
    const structureOk = Boolean(
      delivery
      && delivery.projectId === projectId
      && ['local', 'pushed', 'merged', 'released'].includes(delivery.mode)
      && typeof delivery.branch === 'string'
      && typeof delivery.headSha === 'string'
      && Array.isArray(delivery.evidence),
    )
    add('VERIFY-G8-001', structureOk, 'delivery-status.json has valid projectId/mode/branch/headSha/evidence', deliveryFile)
    if (structureOk) {
      add('VERIFY-G8-002', delivery.mode !== 'local', `G8 delivery mode must be pushed/merged/released (got ${delivery.mode})`, deliveryFile)
      const dirty = runGit(['status', '--porcelain'], gitCwd).stdout
      add('VERIFY-G8-003', dirty.length === 0, dirty.length ? `G8 worktree is not clean:\n${dirty}` : 'G8 worktree is clean', gitCwd)
      const branch = delivery.branch.trim()
      const deliveredHead = delivery.headSha.trim()
      const resolvedDeliveredHead = /^[0-9a-f]{7,40}$/.test(deliveredHead)
        ? runGit(['rev-parse', `${deliveredHead}^{commit}`], gitCwd)
        : { ok: false, stdout: '' }
      const hasDeliveryEvidence = delivery.evidence.length > 0
      let remoteOk = false
      let remoteMessage = ''
      if (!branch || !resolvedDeliveredHead.ok || !hasDeliveryEvidence) {
        remoteMessage = '非 local 交付必须记录 branch、7-40 位 headSha 和至少一条 evidence'
      } else if (delivery.mode === 'pushed') {
        const remoteHead = runGit(['rev-parse', `origin/${branch}`], gitCwd)
        const currentHead = runGit(['rev-parse', 'HEAD'], gitCwd)
        remoteOk = remoteHead.ok && currentHead.ok && remoteHead.stdout === resolvedDeliveredHead.stdout && currentHead.stdout === resolvedDeliveredHead.stdout
        remoteMessage = remoteOk
          ? `origin/${branch}、当前 HEAD 与 delivery-status.headSha 一致`
          : `origin/${branch}、当前 HEAD 与 delivery-status.headSha 不一致或不存在`
      } else {
        const baseRef = config.baseRef || 'origin/online'
        remoteOk = runGit(['merge-base', '--is-ancestor', resolvedDeliveredHead.stdout, baseRef], gitCwd).ok
        remoteMessage = remoteOk ? `交付提交 ${resolvedDeliveredHead.stdout.slice(0, 12)} 已进入 ${baseRef}` : `交付提交 ${resolvedDeliveredHead.stdout.slice(0, 12)} 尚未进入 ${baseRef}`
      }
      add('VERIFY-G8-004', remoteOk, remoteMessage, deliveryFile)
    }
  }
}

const validators = { G0: validateG0, G1: validateG1, G2: validateG2, G3: validateG3, G4: validateG4, G5: validateG5, G6: validateG6, G7: validateG7, G8: validateG8 }
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
    for (const check of blockerChecks({ entries, gate, file: rel(blockerFile), partial })) {
      add(check.ruleId, check.ok, check.message, blockerFile, check.severity, check.category)
    }
  }
}

// 假设台账销账（gate 轴）：G5-G7 卡 api-ready/reconciling，G8 additionally 卡 release。
// 与 DOC-G3-IMPL-006 的 lifecycle 轴同源不同名分，语义源在 lib/assumption-ledger.mjs。
// 同样放在 applyWaivers 之前，让「接受风险交付」走具名带期限豁免而非静默通过。
{
  const ledgerFile = join(projectDir, 'agent/assumptions.json')
  const ledger = existsSync(ledgerFile) ? readJson(ledgerFile) : null
  for (const check of assumptionChecks({ ledger, gate, file: rel(ledgerFile), partial })) {
    add(check.ruleId, check.ok, check.message, ledgerFile, check.severity, check.category)
  }
}

// 快速通道是显式 opt-in：只有 agent/fast-track.json 存在才检查，普通项目零回填。
// G2 判断「业务语义是否仍未决定」，后续 gate 判断临时契约是否按期销账；Mock 本身不替代业务决策。
{
  const fastTrackFile = join(projectDir, 'agent/fast-track.json')
  if (existsSync(fastTrackFile)) {
    const ledger = readJson(fastTrackFile)
    const schema = readJson(join(docsRoot, 'common/engine/schemas/fast-track.schema.json'))
    const schemaErrors = ledger && schema ? validateSchema(ledger, schema, 'fast-track.json') : ['JSON 或 schema 无法解析']
    for (const check of fastTrackChecks({ ledger: ledger ?? {}, projectId, gate, schemaErrors, partial, file: rel(fastTrackFile) })) {
      add(check.ruleId, check.ok, check.message, fastTrackFile, check.severity, check.category)
    }
  }
}

// Local pilots keep their creation-time contract. Newly introduced checks are report-only
// until a project explicitly opts into blocking current rules.
const projectManifest = readJson(join(projectDir, 'agent/project-manifest.json'))
const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))

for (const check of checks) {
  const rule = ruleset?.rules?.[check.ruleId]
  if (!check.ok && rule) {
    // 定档单一真值源见 lib/rule-maturity.mjs：experimental/stable 认 blocking（保持现状）；
    // trial 额外按 since 向下收窄（模板版本低于规则引入版的存量项目不被回溯阻断）；
    // report-only 降级同样在其中处理，waivable:false / reportOnlyExempt 免疫。
    const projectReportOnly = projectManifest?.gatePolicy?.currentTouchedRules === 'report-only'
    check.severity = resolveSeverity({ rule, manifest: projectManifest, projectReportOnly })
  }
}

// legacyRules 的定向降级必须排在 ruleset 定档之后：DOC-G3-001..007 已登记 blocking:true，
// 若先降级会被上面的循环推回 error。
if (projectManifest?.gatePolicy?.legacyRules === 'report-only') {
  for (const check of checks) {
    if (!check.ok && /^DOC-G3-00[1-7]$/.test(check.ruleId)) check.severity = 'warn'
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
// gate 字段写 gateLabel：partial 记 `G6-partial`，故 hasPassedGate('G6') 恒 false（G7 天然被挡），
// DOC-SYNC-001/002/003（只认 ^G[0-8]$）也不会据它要求 README 阶段跳级。
const result = { ok: checks.filter((check) => check.severity !== 'warn' && check.severity !== 'waived').every((check) => check.ok), projectId, gate: gateLabel, partial, checks, groups }

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
