#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { resolveProjectWorktree } from './lib/project-status-report.mjs'
import { decideNext } from './lib/project-decision.mjs'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { sourceTypeFromPrd } from './lib/project-scaffold.mjs'
import { normalizeSourceDocuments } from './lib/vnext-source-units.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { initializeVNextArtifacts } from './lib/vnext-persistence.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const args = process.argv.slice(2)
const [command, projectId] = args

function option(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

function run(script, scriptArgs) {
  return spawnSync(process.execPath, [join(scriptDir, script), ...scriptArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function stateFile(id) {
  return join(resolveProjectRoot(id), 'agent/run-state.json')
}

function writeState(id, patch) {
  const file = stateFile(id)
  const previous = readJson(file) || { version: 1, projectId: id, attempts: [] }
  const next = { ...previous, ...patch, updatedAt: new Date().toISOString() }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  return next
}

export function inferState({ projectExists, gateResult, worktree = '' }) {
  if (!projectExists) return { status: 'ready', currentStage: 'G0', nextAction: 'scaffold_project' }
  if (gateResult?.gate === 'G8' && gateResult?.ok === true) return { status: 'complete', currentStage: 'G8', nextAction: 'none' }
  if (gateResult?.gate) {
    if (gateResult.ok === false) return { status: 'blocked', currentStage: gateResult.gate, nextAction: 'fix_gate_failures' }
    return { status: 'active', currentStage: gateResult.gate, nextAction: 'run_next_gate' }
  }
  if (!worktree) return { status: 'active', currentStage: 'G2', nextAction: 'prepare_worktree' }
  return { status: 'active', currentStage: 'G4', nextAction: 'continue_current_stage' }
}

function print(state) {
  console.log(JSON.stringify(state, null, 2))
}

// README frontmatter 里的 worktree 标量（唯一从 markdown 读的字段，且是结构化的 key: value，
// 不是叙述文本的模糊匹配）。阶段/阻塞一律来自机器写的 JSON，不再扫 feature-inventory 的叙述行。
function readWorktree(projectDir) {
  const readmePath = join(projectDir, 'README.md')
  if (!existsSync(readmePath)) return ''
  const readme = readFileSync(readmePath, 'utf8')
  return readme.match(/^worktree:\s*(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || ''
}

// 决策所需的全部**结构化**真值：run-state.json（早期阶段编排真值）、gate-results.json（最新门禁结果，
// 含 fail 明细）、gate-history.json（append-only 成功历史）、README frontmatter 的 worktree。零 markdown 推断。
function loadDecisionInputs(id) {
  const projectDir = resolveProjectRoot(id)
  return {
    projectId: id,
    projectExists: existsSync(projectDir),
    storedState: readJson(stateFile(id)),
    gateResult: readJson(join(projectDir, 'agent/gate-results.json')),
    gateHistory: readJson(join(projectDir, 'agent/gate-history.json')),
    worktree: readWorktree(projectDir),
  }
}

function syncAndInit(id, { legacy = true } = {}) {
  const configFile = join(resolveProjectRoot(id), 'agent/lark-sources.json')
  const sources = readJson(configFile)
  if (!sources?.sources?.length) return { ok: false, nextAction: 'sync_prd', error: 'lark-sources.json 缺失或为空' }
  const sync = run('sync-lark-docs.mjs', ['--config', configFile])
  if (sync.status !== 0) {
    return { ok: false, nextAction: 'sync_prd', error: (sync.stderr || sync.stdout).trim().slice(0, 1200) }
  }
  const source = sources.sources[0]
  const syncedPath = join(sources.outputDir, source.target)
  if (!legacy) return { ok: true, nextAction: 'vnext_init', syncedPath }
  const intake = run('prd-intake.mjs', [id, '--init', '--source', syncedPath])
  if (intake.status !== 0) {
    return { ok: false, nextAction: 'initialize_prd_intake', error: (intake.stderr || intake.stdout).trim().slice(0, 1200), syncedPath }
  }
  return { ok: true, nextAction: 'complete_g0_g1_docs', syncedPath }
}

// vNext(workflowVersion 2)默认脚手架:kickoff 只建最小目录 + README frontmatter + Lark 同步配置,
// 不再物化 v1 全套 product/engineering 文档。PRD 同步成功后用 normalizeSourceDocuments 生成
// 带真实 source 锚点的 work-item stub(requirements 为空,verify 会诚实地 FAIL 到抽取完成为止)。
// 显式 --legacy 才走 v1 全套(start-new-project.mjs)。
function kickoffVNext(projectDir, prd, title) {
  mkdirSync(join(projectDir, 'inbox/lark-sync'), { recursive: true })
  mkdirSync(join(projectDir, 'agent'), { recursive: true })
  const branchName = `${config.branchPrefix || 'feature/'}${projectId}`
  writeFileSync(join(projectDir, 'README.md'), `---\nprojectId: ${projectId}\nstatus: active\nstage: G1\nbranch: ${branchName}\nworktree: ""\nport: ""\nvisualFidelity: standard\nprdSource: ${prd}\nfigmaNode: ""\nlarkEnabled: false\nworkflowVersion: 2\n---\n\n# ${projectId} ${title}\n\n> v2(workflowVersion: 2)正式项目:无 v1 门禁链,工作事实载体是三文件(work-item.json / latest-result.json / runs.jsonl),出口见 common/vnext/README.md。\n\n## 下一步\n\n1. 从 PRD 抽取原子需求(带 sourceAnchor)并填充 work-item.json\n2. 独立冷读审查(vnext-verify --prepare-review → reviewResponse)\n3. 按等级补证据后 \`docs-tdd verify ${projectId} --input <verify-input.json> --worktree <wt>\`\n`)
  const larkOutputDir = String(config.larkOutputDir || `apps/web/docs_tdd/prds/\${projectId}/inbox/lark-sync`).replaceAll('${projectId}', projectId)
  writeFileSync(join(projectDir, 'agent/lark-sources.json'), JSON.stringify({
    projectId,
    outputDir: larkOutputDir,
    sources: [{ type: sourceTypeFromPrd(prd), operation: 'read', name: '需求 PRD', url: prd, target: 'prd-latest.md', localizedTarget: 'prd-latest.extracted.md' }],
  }, null, 2))
}

// PRD 同步成功后,用规范化 source snapshot 直接落 work-item stub(requirements 为空 →
// 首次 verify 如实 FAIL,逼出「抽取 + 独立冷读审查」;riskSignals 置 unclassified → RISK_ROUTE
// 强制显式分类,不允许静默当 V0)。
function vnextInitWorkItem(projectDir) {
  const manifest = readJson(join(projectDir, 'agent/prd-source-manifest.json'))
  const syncedMd = join(projectDir, 'inbox/lark-sync/prd-latest.md')
  if (!existsSync(syncedMd)) return false
  const revision = manifest?.remoteSources?.[0]?.revisionId || '1'
  const prdUrl = manifest?.remoteSources?.[0]?.url || readJson(join(projectDir, 'agent/lark-sources.json'))?.sources?.[0]?.url || 'prd-latest.md'
  const { sourceSnapshot } = normalizeSourceDocuments([{ path: prdUrl, content: readFileSync(syncedMd, 'utf8') }], { revision })
  const workItem = {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId,
    sourceSnapshot,
    requirements: [],
    coverageAudit: {
      sourceFingerprint: 'pending', requirementsFingerprint: 'pending', reviewMode: 'independent-cold-read',
      reviewRunId: 'pending', reviewer: { kind: 'model', id: 'pending' },
      completedAt: '2000-01-01T00:00:00Z', verdict: 'changes-required',
      unresolved: ['kickoff stub: requirements not extracted from PRD yet'],
    },
    routing: { scopeClass: 'local', riskSignals: ['unclassified'], verificationLevel: 'V0', routerVersion: 1 },
    apiDependency: { mode: 'no-request', reason: 'kickoff stub before intake; reassess after requirement extraction' },
    scopeApproval: null,
  }
  initializeVNextArtifacts(projectDir, workItem)
  return true
}

function kickoff() {
  const prd = option('--prd')
  const title = option('--title', projectId)
  let legacy = args.includes('--legacy')
  if (!prd) throw new Error('kickoff requires --prd <Lark URL or local Markdown>')
  const projectDir = resolveProjectRoot(projectId)
  if (existsSync(projectDir)) {
    const existingVersion = projectWorkflowVersion(projectId)
    if (existingVersion === 2 && legacy) throw new Error(`${projectId} is already workflowVersion 2; refusing to downgrade it with --legacy`)
    legacy = existingVersion === 1
  }
  if (!existsSync(projectDir)) {
    if (legacy) {
      const scaffold = run('start-new-project.mjs', [projectId, '--prd', prd, '--title', title])
      if (scaffold.status !== 0) throw new Error((scaffold.stderr || scaffold.stdout).trim())
    } else {
      kickoffVNext(projectDir, prd, title)
    }
  }
  let state = writeState(projectId, {
    workflowVersion: legacy ? 1 : 2,
    status: 'active',
    currentStage: legacy ? 'G0' : 'V2-intake',
    lastAction: 'scaffold_project',
    nextAction: 'sync_prd',
    source: prd,
  })
  const result = syncAndInit(projectId, { legacy })
  const vnextInitialized = !legacy && result.ok && vnextInitWorkItem(projectDir)
  const initialized = legacy ? result.ok : Boolean(vnextInitialized)
  state = writeState(projectId, {
    status: initialized ? (legacy ? 'waiting_approval' : 'active') : 'blocked',
    currentStage: initialized ? (legacy ? 'G1' : 'V2-review') : (legacy ? 'G0' : 'V2-intake'),
    lastAction: initialized ? (legacy ? 'initialize_prd_intake' : 'initialize_vnext_work_item') : 'scaffold_project',
    nextAction: legacy ? result.nextAction : (vnextInitialized ? 'vnext_extract_requirements' : result.nextAction),
    blocker: result.error || (!legacy && !vnextInitialized ? 'v2 work-item initialization failed' : ''),
    syncedSource: result.syncedPath || '',
    attempts: [...(state.attempts || []), { at: new Date().toISOString(), action: 'sync_and_init', ok: result.ok }],
  })
  print({ ...state, workflowVersion: legacy ? 1 : 2, vnextWorkItemInitialized: Boolean(vnextInitialized) })
}

function projectWorkflowVersion(id) {
  const projectDir = resolveProjectRoot(id)
  const readmePath = join(projectDir, 'README.md')
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : ''
  const declared = readme.match(/^workflowVersion:\s*(\d+)$/m)?.[1]
  if (declared) return Number(declared)
  return existsSync(join(projectDir, 'work-item.json')) ? 2 : 1
}

function inspectVNext(id) {
  const projectDir = resolveProjectRoot(id)
  const workItem = readJson(join(projectDir, 'work-item.json'))
  const latest = readJson(join(projectDir, 'latest-result.json'))
  if (!workItem) {
    return { projectId: id, workflowVersion: 2, status: 'blocked', currentStage: 'V2-intake', nextAction: 'initialize_vnext_work_item', command: `docs-tdd resume ${id}` }
  }
  if (!latest) {
    const reviewReady = workItem.coverageAudit?.verdict === 'pass' && !(workItem.coverageAudit?.unresolved || []).length
    return {
      projectId: id, workflowVersion: 2, verificationLevel: workItem.routing?.verificationLevel || 'unclassified', status: 'active',
      currentStage: reviewReady ? 'V2-evidence' : 'V2-review', nextAction: reviewReady ? 'capture_current_code_evidence' : 'complete_independent_coverage_review',
      command: `docs-tdd verify ${id} --input <verify-input.json>`,
    }
  }
  const failedChecks = (latest.checks || []).filter((check) => !check.ok)
  const integrity = verifyExitResultIntegrity(latest, workItem)
  let codeStateFresh = false
  let codeStateProblem = ''
  try {
    const current = codeFingerprint(resolveProjectWorktree(id).worktree)
    codeStateFresh = current.headSha === latest.codeFingerprint?.headSha
      && current.baseSha === latest.codeFingerprint?.baseSha
      && current.dirtyHash === latest.codeFingerprint?.dirtyHash
    if (!codeStateFresh) codeStateProblem = 'latest result is stale for the current worktree code state'
  } catch (error) {
    codeStateProblem = `cannot measure current worktree code state: ${error.message}`
  }
  const authoritativePass = latest.mode === 'enforced' && latest.status === 'passed' && latest.ok === true && integrity.ok && codeStateFresh
  const shadowOnly = latest.mode !== 'enforced'
  const resultInvalid = !integrity.ok || !codeStateFresh
  return {
    projectId: id, workflowVersion: 2, verificationLevel: latest.level || workItem.routing?.verificationLevel || 'unclassified',
    status: authoritativePass ? 'complete' : latest.status === 'blocked' ? 'blocked' : 'active',
    currentStage: authoritativePass ? 'V2-complete' : 'V2-verification',
    nextAction: authoritativePass ? 'none' : shadowOnly ? 'run_enforced_verification' : resultInvalid ? 'refresh_stale_or_invalid_verification' : latest.status === 'blocked' ? 'resolve_blockers_and_reverify' : 'fix_failed_checks_and_reverify',
    blockers: [...failedChecks.flatMap((check) => check.problems || [check.code]), ...integrity.problems, ...(codeStateProblem ? [codeStateProblem] : [])],
    latestResult: { mode: latest.mode, status: latest.status, ok: latest.ok, integrity: integrity.ok, codeStateFresh, authoritative: authoritativePass, runId: latest.runId, generatedAt: latest.generatedAt },
    command: authoritativePass ? '' : `docs-tdd verify ${id} --input <verify-input.json>`,
  }
}

function status() {
  if (projectWorkflowVersion(projectId) === 2) {
    print({ ...inspectVNext(projectId), stateFile: relative(repoRoot, stateFile(projectId)) })
    return
  }
  const inputs = loadDecisionInputs(projectId)
  const decision = decideNext(inputs)
  print({ ...decision, projectId, workflowVersion: 1, stateFile: relative(repoRoot, stateFile(projectId)) })
}

function resume() {
  const stored = readJson(stateFile(projectId))
  if (projectWorkflowVersion(projectId) === 2) {
    const projectDir = resolveProjectRoot(projectId)
    if (!existsSync(join(projectDir, 'work-item.json'))) {
      const result = syncAndInit(projectId, { legacy: false })
      const initialized = result.ok && vnextInitWorkItem(projectDir)
      writeState(projectId, {
        workflowVersion: 2, status: initialized ? 'active' : 'blocked', currentStage: initialized ? 'V2-review' : 'V2-intake',
        nextAction: initialized ? 'vnext_extract_requirements' : result.nextAction, blocker: result.error || '', syncedSource: result.syncedPath || '',
        attempts: [...(stored?.attempts || []), { at: new Date().toISOString(), action: 'resume_vnext_sync_and_init', ok: Boolean(initialized) }],
      })
    }
    print({ ...inspectVNext(projectId), stateFile: relative(repoRoot, stateFile(projectId)) })
    return
  }
  // 早期阶段（PRD 同步 / intake 初始化）：resume 能真正推进——重跑同步+建档。
  if (stored && ['sync_prd', 'initialize_prd_intake'].includes(stored.nextAction)) {
    const result = syncAndInit(projectId)
    const state = writeState(projectId, {
      status: result.ok ? 'waiting_approval' : 'blocked',
      currentStage: result.ok ? 'G1' : stored.currentStage,
      lastAction: result.ok ? 'initialize_prd_intake' : stored.lastAction,
      nextAction: result.nextAction,
      blocker: result.error || '',
      syncedSource: result.syncedPath || stored.syncedSource || '',
      attempts: [...(stored.attempts || []), { at: new Date().toISOString(), action: 'resume_sync_and_init', ok: result.ok }],
    })
    print(state)
    return
  }
  // 其余所有阶段（含 G3–G8）：不再只对 G0/G1 有意义。从结构化真值算出下一步并给出可直接执行的命令；
  // 门禁类下一步需要 Agent 先做语义工作（改代码/补文档）再重跑门禁，故只给命令，不代跑。
  const inputs = loadDecisionInputs(projectId)
  if (!inputs.projectExists) throw new Error(`项目不存在；先运行 docs-tdd kickoff ${projectId} --prd <source>`)
  const decision = decideNext(inputs)
  const note = decision.nextAction === 'none'
    ? '项目已走到 G8 完成，无后续门禁。'
    : decision.blockers.length
      ? `先按下列 ${decision.blockers.length} 条阻塞修复，再执行：${decision.command}`
      : `执行下一步：${decision.command}`
  print({ ...decision, projectId, note, stateFile: relative(repoRoot, stateFile(projectId)) })
}

function selfTest() {
  // 阶段/阻塞判定的完整用例在 lib/project-decision.mjs --self-test；这里只验编排层的结构化装配：
  // inferState 只吃 JSON（不再有 markdown 分支），且 decideNext 能从最小结构化输入产出决策。
  const a = inferState({ projectExists: false })
  const blocked = inferState({ projectExists: true, gateResult: { gate: 'G5', ok: false } })
  const advance = inferState({ projectExists: true, gateResult: { gate: 'G5', ok: true } })
  const complete = inferState({ projectExists: true, gateResult: { gate: 'G8', ok: true } })
  const decision = decideNext({ projectId: 'PR-00001', projectExists: true, gateResult: { gate: 'G5', ok: false, checks: [{ ruleId: 'DOC-G5-003', ok: false, severity: 'error', message: 'x' }] } })
  if (
    a.nextAction !== 'scaffold_project'
    || blocked.nextAction !== 'fix_gate_failures'
    || advance.nextAction !== 'run_next_gate'
    || complete.status !== 'complete'
    || decision.command !== 'docs-tdd gate PR-00001 G5'
    || decision.blockers.length !== 1
  ) process.exit(1)
  console.log('project-orchestrator self-test passed (structured inferState + decideNext wiring)')
}

if (args.includes('--self-test')) selfTest()
else if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '')) {
  console.error('usage: project-orchestrator.mjs <kickoff|status|resume|next> PR-01234 [--prd <source>] [--title <name>]')
  process.exit(1)
} else {
  try {
    if (command === 'kickoff') kickoff()
    else if (command === 'status' || command === 'next') status()
    else if (command === 'resume') resume()
    else throw new Error(`unknown orchestrator command: ${command}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
