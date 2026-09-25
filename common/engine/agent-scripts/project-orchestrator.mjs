#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveProjectBaseRoot,
  resolveProjectChangeRoot,
  resolveProjectRoot,
  resolveRoots,
} from './lib/roots.mjs'
import { inspectProjectWorktree, requireProjectWorktree } from './lib/project-status-report.mjs'
import { decideNext } from './lib/project-decision.mjs'
import { changedCodePaths, codeFingerprint, matchesEffectiveCodeState } from './lib/fingerprint.mjs'
import { VNEXT_INTAKE_KINDS } from './lib/vnext-intake.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { persistVNextWorkItem } from './lib/vnext-persistence.mjs'
import { applyAutopilotCheckpoint, applyDeliveryCommit, deriveAutopilotAction } from './lib/vnext-autopilot.mjs'
import { applySourceUpdate } from './lib/vnext-source-readiness.mjs'
import { inspectSurfaceReconciliation } from './lib/vnext-reconcile-runtime.mjs'
import { runAutonomousValidation as executeAutonomousValidation } from './lib/vnext-autonomous-validation.mjs'
import { assertSafeWorkContext } from './lib/vnext-work-context-runtime.mjs'
import { deriveDeliveryTruth } from './lib/vnext-delivery-truth.mjs'
import { createVNextIntakeRuntime } from './lib/vnext-intake-runtime.mjs'
import {
  commitScopedPaths as executeCommitScopedPaths,
  createVNextOrchestratorRunner,
} from './lib/vnext-orchestrator-runner.mjs'
import { activateVNextChangeSet } from './lib/vnext-change-set.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const args = process.argv.slice(2)
const [command, projectId] = args

function option(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

export function resolveAutopilotAgentOptions({
  requestedClient = '',
  requestedModel = '',
  env = process.env,
} = {}) {
  const client = requestedClient || (env.CODEX_THREAD_ID ? 'codex' : 'claude')
  if (!['codex', 'claude'].includes(client)) {
    throw new Error('docs-tdd run --client must be codex or claude')
  }
  return { client, model: requestedModel }
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

function runGit(worktree, gitArgs, spawn = spawnSync, env = process.env) {
  const result = spawn('git', gitArgs, { cwd: worktree, encoding: 'utf8', stdio: 'pipe', env })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `git ${gitArgs.join(' ')} failed`).trim())
  return result.stdout || ''
}

const {
  syncAndInit,
  kickoffVNext,
  initializeVNextWorkItem: vnextInitWorkItem,
  sourceIdentity,
  initializeFromBoundSource: initializeVNextFromBoundSource,
} = createVNextIntakeRuntime({
  docsRoot,
  consumerRoot: repoRoot,
  config,
  resolveProjectRoot,
  executeScript,
})

export function scopedDeliveryCommitted(worktree, codeState, spawn = spawnSync) {
  if (codeState?.scopeMode !== 'path-set-v1' || !codeState.scopePaths?.length) return true
  return runGit(worktree, ['status', '--porcelain=v1', '-z', '--', ...codeState.scopePaths], spawn).length === 0
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

function requestedProjectContext({ dryRun = false } = {}) {
  const changeId = option('--change')
  if (!changeId) return { projectDir: resolveProjectRoot(projectId), changeId: '', change: null }
  const baseRoot = resolveProjectBaseRoot(projectId)
  const changeRoot = resolveProjectChangeRoot(projectId, changeId)
  if (!dryRun && !existsSync(changeRoot) && !option('--prd')) {
    throw new Error(`new change ${changeId} requires --prd <source>`)
  }
  const change = activateVNextChangeSet({
    projectId,
    changeId,
    baseRoot,
    changeRoot,
    dryRun,
  })
  return { projectDir: changeRoot, changeId, change }
}

function dryRunOutput() {
  const { projectDir, changeId, change } = requestedProjectContext({ dryRun: true })
  const activeProjectDir = resolveProjectRoot(projectId)
  const targetExists = existsSync(projectDir)
  const canInspect = targetExists && projectDir === activeProjectDir && existsSync(join(projectDir, 'work-item.json'))
  const state = canInspect
    ? inspectVNext(projectId)
    : {
        projectId,
        workflowVersion: 2,
        status: targetExists ? 'ready' : 'not-created',
        currentStage: 'V2-intake',
        nextAction: targetExists ? 'resume-current-change' : 'create-project',
      }
  return {
    ...state,
    status: 'dry-run',
    dryRun: {
      projectDir,
      changeId: changeId || null,
      targetExists,
      requiresPrd: !targetExists && !option('--prd'),
      source: option('--prd') || null,
      change,
    },
    runner: {
      outcome: 'dry-run',
      wouldExecute: {
        activateChange: Boolean(changeId),
        initializeProject: !targetExists,
        resumeProject: targetExists,
      },
    },
  }
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

function kickoff({ quiet = false } = {}) {
  const emit = quiet ? () => {} : print
  if (args.includes('--dry-run')) {
    const output = dryRunOutput()
    emit(output)
    return { ok: true, output }
  }
  const prd = option('--prd')
  const title = option('--title', projectId)
  const requestedKind = option('--kind')
  let intakeKind = requestedKind || 'feature'
  let legacy = args.includes('--legacy')
  if (!prd) throw new Error('kickoff requires --prd <Lark URL or local Markdown>')
  if (!VNEXT_INTAKE_KINDS.includes(intakeKind)) throw new Error(`kickoff --kind must be one of: ${VNEXT_INTAKE_KINDS.join(', ')}`)
  if (legacy && requestedKind) throw new Error('kickoff --kind is only supported by workflowVersion 2')
  const { projectDir } = requestedProjectContext()
  if (existsSync(projectDir)) {
    const configuredPrd = readJson(join(projectDir, 'agent/lark-sources.json'))?.sources?.[0]?.url
    if (configuredPrd && sourceIdentity(configuredPrd) !== sourceIdentity(prd)) {
      throw new Error('PRD source differs from the source bound at kickoff; preserve the current work item and use docs-tdd source-update')
    }
    const existingVersion = projectWorkflowVersion(projectId)
    if (existingVersion === 2 && legacy) throw new Error(`${projectId} is already workflowVersion 2; refusing to downgrade it with --legacy`)
    legacy = existingVersion === 1
    const existingKind = readJson(join(projectDir, 'work-item.json'))?.intake?.kind
    if (requestedKind && existingKind && requestedKind !== existingKind) throw new Error(`${projectId} is already a ${existingKind} intake; refusing --kind ${requestedKind}`)
    intakeKind = existingKind || intakeKind
  }
  if (!existsSync(projectDir)) {
    if (legacy) {
      const scaffold = executeScript('start-new-project.mjs', [projectId, '--prd', prd, '--title', title])
      if (scaffold.status !== 0) throw new Error((scaffold.stderr || scaffold.stdout).trim())
    } else {
      kickoffVNext(projectId, projectDir, prd, title, intakeKind)
    }
  }

  const result = syncAndInit(projectId, { legacy })
  if (!legacy) {
    const initialization = result.ok
      ? vnextInitWorkItem(projectId, projectDir, intakeKind)
      : { ok: false, initialized: false, nextAction: result.nextAction, error: result.error }
    if (!initialization.ok) {
      const output = {
        projectId,
        workflowVersion: 2,
        status: 'blocked',
        currentStage: 'V2-intake',
        nextAction: initialization.nextAction,
        blocker: initialization.error || 'v2 work-item initialization failed',
        syncedSource: result.syncedPath || '',
      }
      emit(output)
      process.exitCode = 1
      return { ok: false, output }
    }
    const output = { ...inspectVNext(projectId), initialized: initialization.initialized, idempotent: initialization.idempotent, syncedSource: result.syncedPath || '' }
    emit(output)
    return { ok: true, output }
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
  const output = { ...state, workflowVersion: 1 }
  emit(output)
  if (!result.ok) process.exitCode = 1
  return { ok: result.ok, output }
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

export function inspectVNext(id) {
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
  const worktreeInspection = inspectProjectWorktree(id)
  let codeStateFresh = true
  let codeStateProblem = ''
  let gitScopeClean = false
  let safeWorktree = ''
  try {
    safeWorktree = requireProjectWorktree(id)
    if (latest) {
      const scopePaths = latest.codeFingerprint?.scopeMode === 'path-set-v1' ? latest.codeFingerprint.scopePaths : null
      const current = codeFingerprint(safeWorktree, config.baseRef || 'origin/online', { scopePaths })
      codeStateFresh = matchesEffectiveCodeState(current, latest.codeFingerprint)
      gitScopeClean = scopedDeliveryCommitted(safeWorktree, latest.codeFingerprint)
      if (!codeStateFresh) codeStateProblem = 'code content changed; revalidate evidence only (the signed source review remains reusable while the work item is unchanged)'
    }
  } catch (error) {
    if (latest) {
      codeStateFresh = false
      codeStateProblem = `cannot measure current worktree code state: ${error.message}`
    }
  }
  const reconciliation = worktreeInspection.ok
    ? inspectSurfaceReconciliation({ projectDir, workItem, worktree: safeWorktree, baseRef: config.baseRef || 'origin/online' })
    : { result: null, current: false, problem: '' }
  const reconciliationResult = reconciliation.result
  const reconciliationCurrent = reconciliation.current
  const assuranceTrusted = latest?.mode === 'enforced'
    && latest?.assuranceMode === 'autonomous'
    && latest?.evidenceTrust === 'cli-attested'
  const deliveryTruth = deriveDeliveryTruth({
    workItem,
    latestResult: latest,
    integrityOk: integrity.ok,
    codeStateFresh,
    assuranceTrusted,
    reconciliationResult,
    gitScopeClean,
    changedPaths: latest?.codeFingerprint?.scopePaths || workItem.autopilot?.implementation?.changedPaths || [],
  })
  const actionPacket = deriveAutopilotAction({
    workItem,
    latestResult: latest,
    resultIntegrityOk: integrity.ok,
    codeStateFresh,
    assuranceTrusted,
    deliveryCommitted: gitScopeClean,
    deliveryTruth,
    worktreeReady: worktreeInspection.ok,
    reconciliationResult,
    reconciliationCurrent,
  })
  return {
    projectId: id,
    workflowVersion: 2,
    verificationLevel: latest?.level || workItem.routing?.verificationLevel || 'unclassified',
    executionRoute: actionPacket.executionRoute,
    routeReasons: actionPacket.routeReasons,
    budgetStatus: actionPacket.budgetStatus,
    status: actionPacket.status,
    currentStage: `V2-${actionPacket.phase}`,
    nextAction: actionPacket.action,
    command: actionPacket.command,
    blockers: [...failedChecks.flatMap((check) => check.problems || [check.code]), ...integrity.problems, ...worktreeInspection.problems, ...(codeStateProblem ? [codeStateProblem] : []), ...(reconciliation.problem ? [reconciliation.problem] : [])],
    actionPacket,
    lifecycle: {
      deliveryTruth,
      implementationCheckpoint: workItem.autopilot?.implementation?.checkpoint || null,
      checkpointCommit: workItem.autopilot?.checkpointCommit || null,
      deliveryCommit: workItem.autopilot?.delivery || { status: 'pending' },
      reconciliation: reconciliationResult ? {
        current: reconciliationCurrent,
        overall: reconciliationResult.rollup?.overall,
        runtimeCriticalPending: reconciliationResult.rollup?.runtimeCriticalPending || [],
        integrationPending: reconciliationResult.rollup?.integrationPending || [],
      } : null,
    },
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
        authoritative: deliveryTruth.authoritativeCompletion,
        gitScopeClean,
        deliveryRecordCommitted: deliveryTruth.deliveryRecordCommitted,
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
      const initialization = initializeVNextFromBoundSource(projectId)
      if (!initialization.ok) {
        print({
          projectId,
          workflowVersion: 2,
          status: 'blocked',
          currentStage: 'V2-intake',
          nextAction: initialization.nextAction,
          blocker: initialization.error || 'v2 work-item initialization failed',
        })
        process.exitCode = 1
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
  const checkpointInput = readJson(inputFile)
  if (!checkpointInput) throw new Error(`cannot read checkpoint: ${inputFile}`)
  if (checkpointInput.outcome === 'completed') {
    const worktree = requireProjectWorktree(projectId)
    const actionId = checkpointInput.actionId || ''
    assertSafeWorkContext({
      projectId,
      workItem,
      worktree,
      baseRef: config.baseRef || 'origin/online',
      commitMode: 'no-commit',
      actionId,
      targetPaths: checkpointInput.changedPaths || [],
    })
    const actualChangedPaths = new Set(changedCodePaths(worktree, config.baseRef || 'origin/online'))
    const unverifiedPaths = (checkpointInput.changedPaths || []).filter((path) => !actualChangedPaths.has(path))
    if (unverifiedPaths.length) throw new Error(`checkpoint paths are not changed from ${config.baseRef || 'origin/online'}: ${unverifiedPaths.join(', ')}`)
  }
  const currentAction = inspectVNext(projectId).actionPacket
  const next = applyAutopilotCheckpoint(workItem, checkpointInput, { latestResult, expectedAction: currentAction })
  persistVNextWorkItem(projectDir, next)
  print(inspectVNext(projectId))
}

function runAutonomousValidation(id) {
  const projectDir = resolveProjectRoot(id)
  let worktree
  try {
    worktree = requireProjectWorktree(id)
  } catch (error) {
    return { ok: false, step: 'worktree', error: error.message }
  }
  return executeAutonomousValidation({
    id,
    projectDir,
    worktree,
    workItem: readJson(join(projectDir, 'work-item.json')),
    baseRef: config.baseRef || 'origin/online',
    executeScript,
  })
}

export function commitScopedPaths(worktree, id, paths, spawn = spawnSync, mode = 'delivery', options = {}) {
  return executeCommitScopedPaths(worktree, id, paths, spawn, mode, {
    ...options,
    baseRef: options.baseRef || config.baseRef || 'origin/online',
  })
}

export function commitEvidenceScope(id) {
  const projectDir = resolveProjectRoot(id)
  const latest = readJson(join(projectDir, 'latest-result.json'))
  const workItem = readJson(join(projectDir, 'work-item.json'))
  const paths = latest?.codeFingerprint?.scopeMode === 'path-set-v1' ? latest.codeFingerprint.scopePaths : []
  const commit = commitScopedPaths(requireProjectWorktree(id), id, paths, spawnSync, 'delivery', {
    workItem,
    latestResult: latest,
    integrityOk: verifyExitResultIntegrity(latest, workItem).ok,
    codeStateFresh: true,
    assuranceTrusted: latest?.mode === 'enforced' && latest?.assuranceMode === 'autonomous' && latest?.evidenceTrust === 'cli-attested',
    actionId: workItem?.autopilot?.implementation?.checkpoint?.actionId || '',
    baseRef: config.baseRef || 'origin/online',
  })
  if (!commit.ok) return commit
  const persisted = persistVNextWorkItem(projectDir, applyDeliveryCommit(workItem, commit))
  return { ...commit, persisted }
}

function autopilotRun() {
  if (args.includes('--legacy')) {
    throw new Error('docs-tdd run is workflowVersion 2 only; create an explicit legacy project with docs-tdd kickoff --legacy')
  }
  if (args.includes('--dry-run')) {
    print(dryRunOutput())
    return
  }
  const { projectDir } = requestedProjectContext()
  if (!existsSync(projectDir)) {
    const initialized = kickoff({ quiet: true })
    if (!initialized?.ok) {
      if (initialized?.output) print(initialized.output)
      return
    }
    if (initialized.output?.workflowVersion !== 2) {
      print(initialized.output)
      return
    }
  } else {
    const requestedPrd = option('--prd')
    const workflowVersion = projectWorkflowVersion(projectId)
    if (requestedPrd && workflowVersion !== 2) {
      throw new Error('--prd is only accepted by docs-tdd run when creating or resuming a workflowVersion=2 project')
    }
    if (workflowVersion !== 2) {
      resume()
      return
    }
    if (requestedPrd || !existsSync(join(projectDir, 'work-item.json'))) {
      const initialization = initializeVNextFromBoundSource(projectId, requestedPrd)
      if (!initialization.ok) {
        print({
          projectId,
          workflowVersion: 2,
          status: 'blocked',
          currentStage: 'V2-intake',
          nextAction: initialization.nextAction || 'sync_prd',
          blocker: initialization.error || 'v2 source initialization failed',
          syncedSource: initialization.syncedPath || '',
        })
        process.exitCode = 1
        return
      }
    }
  }
  const agent = resolveAutopilotAgentOptions({
    requestedClient: option('--client'),
    requestedModel: option('--model'),
  })
  const execution = createVNextOrchestratorRunner({
    projectId,
    projectDir,
    inspect: () => inspectVNext(projectId),
    requireWorktree: requireProjectWorktree,
    executeScript,
    runAutonomousValidation,
    commitEvidenceScope,
    scopedDeliveryCommitted,
    baseRef: config.baseRef || 'origin/online',
    agentClient: agent.client,
    agentModel: agent.model,
  }).run()
  const topLevelStatus = ['needs-agent', 'needs-user', 'blocked-external-dependency', 'failed-infrastructure', 'failed-safety-check', 'budget-exhausted']
    .includes(execution.runner.outcome)
    ? execution.runner.outcome
    : execution.state.status
  print({ ...execution.state, status: topLevelStatus, runner: execution.runner })
  if (['failed-infrastructure', 'failed-safety-check', 'budget-exhausted'].includes(execution.runner.outcome)) {
    process.exitCode = 1
  }
}

function selfTest() {
  // 阶段/阻塞判定的完整用例在 lib/project-decision.mjs --self-test；这里只验编排层的结构化装配：
  // inferState 只吃 JSON（不再有 markdown 分支），且 decideNext 能从最小结构化输入产出决策。
  const a = inferState({ projectExists: false })
  const blocked = inferState({ projectExists: true, gateResult: { gate: 'G5', ok: false } })
  const advance = inferState({ projectExists: true, gateResult: { gate: 'G5', ok: true } })
  const complete = inferState({ projectExists: true, gateResult: { gate: 'G8', ok: true } })
  const decision = decideNext({ projectId: 'PR-00001', projectExists: true, gateResult: { gate: 'G5', ok: false, checks: [{ ruleId: 'DOC-G5-003', ok: false, severity: 'error', message: 'x' }] } })
  const codexAgent = resolveAutopilotAgentOptions({ env: { CODEX_THREAD_ID: 'thread-1' } })
  const claudeAgent = resolveAutopilotAgentOptions({ env: {} })
  const modeledAgent = resolveAutopilotAgentOptions({ requestedClient: 'codex', requestedModel: 'gpt-test', env: {} })
  const gitCalls = []
  const commit = commitScopedPaths('/tmp/worktree', 'PR-00001', ['src/a.ts'], (_command, gitArgs) => {
    gitCalls.push(gitArgs)
    return { status: 0, stdout: gitArgs[0] === 'rev-parse' ? 'abc123\n' : '', stderr: '' }
  }, 'delivery', {
    workItem: { workflowVersion: 2, projectId: 'PR-00001' },
    assertSafety: () => ({ ok: true, branch: 'feature/PR-00001' }),
  })
  if (
    a.nextAction !== 'scaffold_project'
    || blocked.nextAction !== 'fix_gate_failures'
    || advance.nextAction !== 'run_next_gate'
    || complete.status !== 'complete'
    || decision.command !== 'docs-tdd gate PR-00001 G5'
    || decision.blockers.length !== 1
    || codexAgent.client !== 'codex'
    || claudeAgent.client !== 'claude'
    || modeledAgent.model !== 'gpt-test'
    || vnextVerificationNextAction({ authoritativePass: false, shadowOnly: false, integrityOk: true, codeStateFresh: false, status: 'passed' }) !== 'revalidate_current_code_evidence'
    || vnextVerificationNextAction({ authoritativePass: false, shadowOnly: false, integrityOk: false, codeStateFresh: false, assuranceTrusted: false, status: 'passed' }) !== 'refresh_invalid_verification'
    || vnextVerificationNextAction({ authoritativePass: false, shadowOnly: false, integrityOk: true, codeStateFresh: true, assuranceTrusted: false, status: 'passed' }) !== 'capture_cli_attested_evidence'
    || !scopedDeliveryCommitted('/tmp/worktree', { scopeMode: 'path-set-v1', scopePaths: ['src/a.ts'] }, () => ({ status: 0, stdout: '', stderr: '' }))
    || scopedDeliveryCommitted('/tmp/worktree', { scopeMode: 'path-set-v1', scopePaths: ['src/a.ts'] }, () => ({ status: 0, stdout: ' M src/a.ts', stderr: '' }))
    || !commit.ok
    || commit.commitSha !== 'abc123'
    || commit.mode !== 'delivery'
    || gitCalls.some((gitArgs) => gitArgs[0] === 'push')
    || !gitCalls.some((gitArgs) => gitArgs[0] === 'commit' && gitArgs.includes('--only'))
  ) process.exit(1)
  console.log('project-orchestrator self-test passed (structured inferState + decideNext wiring)')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--self-test')) selfTest()
  else if (!new RegExp(`^(?:${config.projectIdPattern || '(?:PR|TR)-\\d{5}'})$`).test(projectId || '')) {
    console.error('usage: project-orchestrator.mjs <run|kickoff|status|resume|next|source-update|checkpoint> PR-01234 [--change <id>] [--prd <source>] [--title <name>] [--input <json>] [--client codex|claude] [--model <name>] [--dry-run]')
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
}
