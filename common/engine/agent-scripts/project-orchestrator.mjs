#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { resolveProjectWorktree } from './lib/project-status-report.mjs'
import { decideNext } from './lib/project-decision.mjs'
import { codeFingerprint, matchesEffectiveCodeState } from './lib/fingerprint.mjs'
import { sourceTypeFromPrd } from './lib/project-scaffold.mjs'
import { normalizeSourceDocuments, readLocalSourceAsset } from './lib/vnext-source-units.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { initializeVNextArtifacts, persistVNextWorkItem } from './lib/vnext-persistence.mjs'
import { applyAutopilotCheckpoint, deriveAutopilotAction, initialAutopilotState } from './lib/vnext-autopilot.mjs'
import { applySourceUpdate, initialSourceReadiness } from './lib/vnext-source-readiness.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const args = process.argv.slice(2)
const [command, projectId] = args

function option(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

function executeScript(script, scriptArgs) {
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
  const sync = executeScript('sync-lark-docs.mjs', ['--config', configFile])
  if (sync.status !== 0) {
    return { ok: false, nextAction: 'sync_prd', error: (sync.stderr || sync.stdout).trim().slice(0, 1200) }
  }
  const source = sources.sources[0]
  const syncedPath = join(sources.outputDir, source.target)
  if (!legacy) return { ok: true, nextAction: 'vnext_init', syncedPath }
  const intake = executeScript('prd-intake.mjs', [id, '--init', '--source', syncedPath])
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
  writeFileSync(join(projectDir, 'README.md'), `---\nprojectId: ${projectId}\nstatus: active\nstage: G1\nbranch: ${branchName}\nworktree: ""\nport: ""\nvisualFidelity: standard\nprdSource: ${prd}\nfigmaNode: ""\nlarkEnabled: false\nworkflowVersion: 2\n---\n\n# ${projectId} ${title}\n\n> v2 Autopilot 项目：PRD 是唯一必需的开工输入；Figma/API 可后续增量接入。工作事实只保存在 work-item.json、latest-result.json、runs.jsonl。\n\n## 继续开发\n\n运行 \`docs-tdd run ${projectId}\`。CLI 会根据当前事实返回唯一下一动作；正常路径无需手工选择 Gate 或拼装验证输入。\n`)
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
  const rawSyncedMd = join(projectDir, 'inbox/lark-sync/prd-latest.md')
  const localizedSyncedMd = join(projectDir, 'inbox/lark-sync/prd-latest.extracted.md')
  const syncedMd = existsSync(localizedSyncedMd) ? localizedSyncedMd : rawSyncedMd
  if (!existsSync(syncedMd)) return false
  const revision = manifest?.remoteSources?.[0]?.revisionId || '1'
  const sourcePath = relative(docsRoot, syncedMd)
  const { sourceSnapshot } = normalizeSourceDocuments([{ path: sourcePath, content: readFileSync(syncedMd, 'utf8') }], {
    revision,
    readAsset: (asset) => readLocalSourceAsset(asset, { root: docsRoot }),
  })
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
    sourceReadiness: initialSourceReadiness(),
    scopeApproval: null,
    autopilot: initialAutopilotState(),
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
      const scaffold = executeScript('start-new-project.mjs', [projectId, '--prd', prd, '--title', title])
      if (scaffold.status !== 0) throw new Error((scaffold.stderr || scaffold.stdout).trim())
    } else {
      kickoffVNext(projectDir, prd, title)
    }
  }

  const result = syncAndInit(projectId, { legacy })
  if (!legacy) {
    const initialized = result.ok && vnextInitWorkItem(projectDir)
    if (!initialized) {
      print({
        projectId,
        workflowVersion: 2,
        status: 'blocked',
        currentStage: 'V2-intake',
        nextAction: result.nextAction,
        blocker: result.error || 'v2 work-item initialization failed',
        syncedSource: result.syncedPath || '',
      })
      return
    }
    print({ ...inspectVNext(projectId), initialized: true, syncedSource: result.syncedPath || '' })
    return
  }

  let state = writeState(projectId, {
    workflowVersion: 1,
    status: 'active',
    currentStage: 'G0',
    lastAction: 'scaffold_project',
    nextAction: 'sync_prd',
    source: prd,
  })
  state = writeState(projectId, {
    status: result.ok ? 'waiting_approval' : 'blocked',
    currentStage: result.ok ? 'G1' : 'G0',
    lastAction: result.ok ? 'initialize_prd_intake' : 'scaffold_project',
    nextAction: result.nextAction,
    blocker: result.error || '',
    syncedSource: result.syncedPath || '',
    attempts: [...(state.attempts || []), { at: new Date().toISOString(), action: 'sync_and_init', ok: result.ok }],
  })
  print({ ...state, workflowVersion: 1 })
}

function projectWorkflowVersion(id) {
  const projectDir = resolveProjectRoot(id)
  const readmePath = join(projectDir, 'README.md')
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : ''
  const declared = readme.match(/^workflowVersion:\s*(\d+)$/m)?.[1]
  if (declared) return Number(declared)
  return existsSync(join(projectDir, 'work-item.json')) ? 2 : 1
}

export function vnextVerificationNextAction({ authoritativePass, shadowOnly, integrityOk, codeStateFresh, assuranceTrusted, status }) {
  if (authoritativePass) return 'none'
  if (shadowOnly) return 'run_enforced_verification'
  if (!integrityOk) return 'refresh_invalid_verification'
  if (!codeStateFresh) return 'revalidate_current_code_evidence'
  if (status === 'blocked') return 'resolve_blockers_and_reverify'
  if (status === 'passed' && !assuranceTrusted) return 'capture_cli_attested_evidence'
  return 'fix_failed_checks_and_reverify'
}

function inspectVNext(id) {
  const projectDir = resolveProjectRoot(id)
  const workItem = readJson(join(projectDir, 'work-item.json'))
  const latest = readJson(join(projectDir, 'latest-result.json'))
  if (!workItem) {
    return {
      projectId: id,
      workflowVersion: 2,
      status: 'blocked',
      currentStage: 'V2-intake',
      nextAction: 'initialize-vnext-work-item',
      command: `docs-tdd run ${id}`,
    }
  }

  const failedChecks = (latest?.checks || []).filter((check) => !check.ok)
  const integrity = latest ? verifyExitResultIntegrity(latest, workItem) : { ok: true, problems: [] }
  let codeStateFresh = true
  let codeStateProblem = ''
  if (latest) {
    try {
      const current = codeFingerprint(resolveProjectWorktree(id).worktree)
      codeStateFresh = matchesEffectiveCodeState(current, latest.codeFingerprint)
      if (!codeStateFresh) codeStateProblem = 'code content changed; revalidate evidence only (the signed source review remains reusable while the work item is unchanged)'
    } catch (error) {
      codeStateFresh = false
      codeStateProblem = `cannot measure current worktree code state: ${error.message}`
    }
  }
  const assuranceTrusted = latest?.mode === 'enforced'
    && latest?.assuranceMode === 'autonomous'
    && latest?.evidenceTrust === 'cli-attested'
  const actionPacket = deriveAutopilotAction({
    workItem,
    latestResult: latest,
    resultIntegrityOk: integrity.ok,
    codeStateFresh,
    assuranceTrusted,
  })
  return {
    projectId: id,
    workflowVersion: 2,
    verificationLevel: latest?.level || workItem.routing?.verificationLevel || 'unclassified',
    status: actionPacket.status,
    currentStage: `V2-${actionPacket.phase}`,
    nextAction: actionPacket.action,
    command: actionPacket.command,
    blockers: [...failedChecks.flatMap((check) => check.problems || [check.code]), ...integrity.problems, ...(codeStateProblem ? [codeStateProblem] : [])],
    actionPacket,
    ...(latest ? {
      latestResult: {
        mode: latest.mode,
        assuranceMode: latest.assuranceMode,
        evidenceTrust: latest.evidenceTrust,
        assuranceTrusted,
        status: latest.status,
        ok: latest.ok,
        integrity: integrity.ok,
        codeStateFresh,
        authoritative: actionPacket.action === 'complete',
        runId: latest.runId,
        generatedAt: latest.generatedAt,
      },
    } : {}),
  }
}

function status() {
  if (projectWorkflowVersion(projectId) === 2) {
    print(inspectVNext(projectId))
    return
  }
  const inputs = loadDecisionInputs(projectId)
  const decision = decideNext(inputs)
  print({ ...decision, projectId, workflowVersion: 1, stateFile: relative(repoRoot, stateFile(projectId)) })
}

function resume() {
  if (projectWorkflowVersion(projectId) === 2) {
    const projectDir = resolveProjectRoot(projectId)
    if (!existsSync(join(projectDir, 'work-item.json'))) {
      const result = syncAndInit(projectId, { legacy: false })
      const initialized = result.ok && vnextInitWorkItem(projectDir)
      if (!initialized) {
        print({
          projectId,
          workflowVersion: 2,
          status: 'blocked',
          currentStage: 'V2-intake',
          nextAction: result.nextAction,
          blocker: result.error || 'v2 work-item initialization failed',
        })
        return
      }
    }
    print(inspectVNext(projectId))
    return
  }
  const stored = readJson(stateFile(projectId))
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

function sourceUpdate() {
  if (projectWorkflowVersion(projectId) !== 2) throw new Error('source-update is a v2-only command')
  const inputFile = option('--input')
  if (!inputFile) throw new Error('source-update requires --input <source-update.json>')
  const update = readJson(inputFile)
  if (!update) throw new Error(`cannot read source update: ${inputFile}`)
  const projectDir = resolveProjectRoot(projectId)
  const workItem = readJson(join(projectDir, 'work-item.json'))
  if (!workItem) throw new Error(`canonical v2 work item is missing: ${join(projectDir, 'work-item.json')}`)

  let fingerprint = ''
  let storedPath = ''
  if (['available', 'integrated'].includes(update.status)) {
    if (!update.path?.trim()) throw new Error(`${update.status} source update requires path`)
    const sourcePath = isAbsolute(update.path) ? resolve(update.path) : resolve(repoRoot, update.path)
    const inbox = resolve(projectDir, 'inbox')
    const inboxRelative = relative(inbox, sourcePath)
    if (!inboxRelative || inboxRelative === '..' || inboxRelative.startsWith('../') || isAbsolute(inboxRelative)) {
      throw new Error(`late source must be a file inside ${inbox}`)
    }
    const content = readFileSync(sourcePath)
    fingerprint = createHash('sha256').update(content).digest('hex')
    storedPath = relative(docsRoot, sourcePath)
  }

  const next = applySourceUpdate(workItem, update, { fingerprint, storedPath })
  persistVNextWorkItem(projectDir, next)
  print(inspectVNext(projectId))
}

function checkpoint() {
  if (projectWorkflowVersion(projectId) !== 2) throw new Error('checkpoint is a v2-only command')
  const inputFile = option('--input')
  if (!inputFile) throw new Error('checkpoint requires --input <checkpoint.json>')
  const projectDir = resolveProjectRoot(projectId)
  const workItem = readJson(join(projectDir, 'work-item.json'))
  if (!workItem) throw new Error(`canonical v2 work item is missing: ${join(projectDir, 'work-item.json')}`)
  const latestResult = readJson(join(projectDir, 'latest-result.json'))
  const next = applyAutopilotCheckpoint(workItem, readJson(inputFile), { latestResult })
  persistVNextWorkItem(projectDir, next)
  print(inspectVNext(projectId))
}

function runAutonomousValidation(id) {
  const projectDir = resolveProjectRoot(id)
  const workItem = readJson(join(projectDir, 'work-item.json'))
  const implementation = workItem?.autopilot?.implementation
  if (!implementation || implementation.status !== 'completed') {
    return { ok: false, step: 'preflight', error: 'implementation checkpoint is not complete' }
  }
  let worktree
  try {
    worktree = resolveProjectWorktree(id).worktree
  } catch (error) {
    return { ok: false, step: 'worktree', error: error.message }
  }

  const evidenceRoot = join(homedir(), '.cache/docs-tdd/evidence', id)
  mkdirSync(evidenceRoot, { recursive: true })
  const runDir = mkdtempSync(join(evidenceRoot, 'run-'))
  const evidenceFile = join(runDir, 'evidence.json')
  const surfacesFile = join(runDir, 'surfaces.json')
  writeFileSync(surfacesFile, `${JSON.stringify({
    discoveredSurfaces: implementation.discoveredSurfaces || [],
    coveredSurfaceIds: implementation.coveredSurfaceIds || [],
    ...(implementation.msw ? { msw: implementation.msw } : {}),
    blockers: implementation.blockers || [],
  }, null, 2)}\n`)

  const evidence = executeScript('vnext-evidence.mjs', [
    '--project', projectDir,
    '--worktree', worktree,
    '--out', evidenceFile,
  ])
  if (evidence.status !== 0) {
    return {
      ok: false,
      step: 'evidence',
      evidenceDir: runDir,
      error: (evidence.stderr || evidence.stdout).trim().slice(0, 2000),
    }
  }

  const verify = executeScript('vnext-verify.mjs', [
    '--evidence', evidenceFile,
    '--surfaces', surfacesFile,
    '--project', projectDir,
    '--worktree', worktree,
    '--write',
    '--out', projectDir,
  ])
  return {
    ok: verify.status === 0,
    step: 'verify',
    evidenceDir: runDir,
    output: (verify.stdout || '').trim().slice(0, 4000),
    error: verify.status === 0 ? '' : (verify.stderr || verify.stdout).trim().slice(0, 2000),
  }
}

function autopilotRun() {
  const projectDir = resolveProjectRoot(projectId)
  if (!existsSync(projectDir)) {
    kickoff()
    return
  }
  if (projectWorkflowVersion(projectId) !== 2 || !existsSync(join(projectDir, 'work-item.json'))) {
    resume()
    return
  }
  const before = inspectVNext(projectId)
  if (!['capture-cli-evidence', 'revalidate-current-code-evidence', 'refresh-invalid-verification'].includes(before.nextAction)) {
    print(before)
    return
  }
  const automation = runAutonomousValidation(projectId)
  const after = inspectVNext(projectId)
  print({ ...after, automation })
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
    || vnextVerificationNextAction({ authoritativePass: false, shadowOnly: false, integrityOk: true, codeStateFresh: false, status: 'passed' }) !== 'revalidate_current_code_evidence'
    || vnextVerificationNextAction({ authoritativePass: false, shadowOnly: false, integrityOk: false, codeStateFresh: false, assuranceTrusted: false, status: 'passed' }) !== 'refresh_invalid_verification'
    || vnextVerificationNextAction({ authoritativePass: false, shadowOnly: false, integrityOk: true, codeStateFresh: true, assuranceTrusted: false, status: 'passed' }) !== 'capture_cli_attested_evidence'
  ) process.exit(1)
  console.log('project-orchestrator self-test passed (structured inferState + decideNext wiring)')
}

if (args.includes('--self-test')) selfTest()
else if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '')) {
  console.error('usage: project-orchestrator.mjs <run|kickoff|status|resume|next|source-update|checkpoint> PR-01234 [--prd <source>] [--title <name>] [--input <json>]')
  process.exit(1)
} else {
  try {
    if (command === 'run') autopilotRun()
    else if (command === 'kickoff') kickoff()
    else if (command === 'status' || command === 'next') status()
    else if (command === 'resume') resume()
    else if (command === 'source-update') sourceUpdate()
    else if (command === 'checkpoint') checkpoint()
    else throw new Error(`unknown orchestrator command: ${command}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
