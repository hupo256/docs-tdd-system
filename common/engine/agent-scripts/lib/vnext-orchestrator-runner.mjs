#!/usr/bin/env node
// Side-effect adapter between the pure v2 action loop and project/Git runtimes.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { changedCodePaths, codeFingerprint, matchesEffectiveCodeState } from './fingerprint.mjs'
import { createVNextAgentExecutor } from './vnext-agent-runtime.mjs'
import { applyDeliveryCommit } from './vnext-autopilot.mjs'
import { createActionExecutorRegistry, runContinuousRunner } from './vnext-continuous-runner.mjs'
import { deriveDeliveryTruth } from './vnext-delivery-truth.mjs'
import { persistVNextWorkItem } from './vnext-persistence.mjs'
import { executeSurfaceReconciliation } from './vnext-reconcile-runtime.mjs'
import { assertSafeWorkContext } from './vnext-work-context-runtime.mjs'
import { sealCoverageAuditForFixture } from './vnext-work-item.mjs'

const CODE_WRITING_AGENT_ACTIONS = new Set([
  'implement-current-scope',
  'reconcile-late-sources',
  'repair-failed-checks',
])

const DETERMINISTIC_ACTIONS = [
  'prepare-coding-worktree',
  'reconcile-current-code',
  'capture-cli-evidence',
  'revalidate-current-code-evidence',
  'refresh-invalid-verification',
  'commit-ready-change',
]

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function runGit(worktree, gitArgs, spawn = spawnSync, env = process.env) {
  const result = spawn('git', gitArgs, { cwd: worktree, encoding: 'utf8', stdio: 'pipe', env })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `git ${gitArgs.join(' ')} failed`).trim())
  return result.stdout || ''
}

function samePathSet(left, right) {
  const normalize = (values) => [...new Set(values || [])].sort()
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export function commitScopedPaths(worktree, id, paths, spawn = spawnSync, mode = 'delivery', options = {}) {
  if (!paths?.length) return { ok: false, step: 'commit', error: 'automatic commit requires a non-empty path scope' }
  if (!['checkpoint', 'delivery'].includes(mode)) return { ok: false, step: 'commit', error: `unknown commit mode: ${mode}` }
  try {
    if (!options.workItem) throw new Error('automatic commit requires the canonical work item')
    const safety = (options.assertSafety || assertSafeWorkContext)({
      projectId: id,
      workItem: options.workItem,
      worktree,
      baseRef: options.baseRef || 'origin/online',
      commitMode: mode === 'delivery' ? 'delivery-commit' : 'checkpoint',
      actionId: options.actionId || '',
      targetPaths: paths,
    })
    const env = { ...process.env, DOCS_TDD_COMMIT_MODE: mode }
    runGit(worktree, ['add', '--', ...paths], spawn, env)
    const message = options.subject || deriveDeliveryTruth({
      workItem: options.workItem,
      latestResult: options.latestResult || null,
      integrityOk: options.integrityOk,
      codeStateFresh: options.codeStateFresh,
      assuranceTrusted: options.assuranceTrusted,
      reconciliationResult: options.reconciliationResult || null,
      gitScopeClean: false,
      changedPaths: paths,
    }).commitSubjects[mode]
    runGit(worktree, ['commit', '--only', '-m', message, '--', ...paths], spawn, env)
    const commitSha = runGit(worktree, ['rev-parse', 'HEAD'], spawn, env).trim()
    return { ok: true, step: 'commit', mode, commitSha, subject: message, paths, pushed: false, workContext: safety }
  } catch (error) {
    return { ok: false, step: 'commit', error: error.message, paths, pushed: false }
  }
}

export function adoptVerifiedHeadCommit(worktree, codeState, spawn = spawnSync, { baseRef = 'origin/online' } = {}) {
  const paths = codeState?.scopeMode === 'path-set-v1' ? codeState.scopePaths || [] : []
  if (!paths.length) return { ok: false, step: 'commit', error: 'existing commit adoption requires a non-empty verified path scope' }
  try {
    const pending = runGit(worktree, ['status', '--porcelain=v1', '-z', '--', ...paths], spawn)
    if (pending.length) throw new Error('verified paths still have pending changes')
    const current = codeFingerprint(worktree, baseRef, { scopePaths: paths })
    if (!matchesEffectiveCodeState(current, codeState)) throw new Error('HEAD content does not match the verified path scope')
    const committedPaths = runGit(worktree, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], spawn)
      .split('\n')
      .filter(Boolean)
    if (!samePathSet(paths, committedPaths)) throw new Error('HEAD commit paths do not exactly match the verified path scope')
    const commitSha = runGit(worktree, ['rev-parse', 'HEAD'], spawn).trim()
    const subject = runGit(worktree, ['log', '-1', '--format=%s'], spawn).trim()
    return { ok: true, step: 'commit', mode: 'delivery', commitSha, subject, paths, pushed: false, adopted: true }
  } catch (error) {
    return { ok: false, step: 'commit', error: error.message, paths, pushed: false }
  }
}

export function createVNextOrchestratorRunner({
  projectId,
  projectDir,
  baseRef = 'origin/online',
  inspect,
  requireWorktree,
  executeScript,
  runAutonomousValidation,
  commitEvidenceScope,
  scopedDeliveryCommitted,
  agentClient = 'codex',
  agentModel = '',
  agentReviewerClient = '',
  invokeAgent,
  runCoverageReview,
  maxSteps = 20,
  retryFailedAction = false,
} = {}) {
  const required = {
    inspect,
    requireWorktree,
    executeScript,
    runAutonomousValidation,
    commitEvidenceScope,
    scopedDeliveryCommitted,
  }
  const missing = Object.entries(required).filter(([, value]) => typeof value !== 'function').map(([name]) => name)
  if (!projectId || !projectDir || missing.length) {
    throw new Error(`vNext orchestrator runner requires project context and adapters${missing.length ? `: ${missing.join(', ')}` : ''}`)
  }

  function checkpointFor({ current, packet, executorType }) {
    const latest = readJson(join(projectDir, 'latest-result.json'))
    if (packet.action === 'commit-ready-change') {
      const worktree = requireWorktree(projectId)
      return {
        headShaBefore: runGit(worktree, ['rev-parse', 'HEAD']).trim(),
        paths: latest?.codeFingerprint?.scopeMode === 'path-set-v1' ? latest.codeFingerprint.scopePaths || [] : [],
        subject: current.lifecycle?.deliveryTruth?.commitSubjects?.delivery || '',
      }
    }
    if (executorType !== 'agent' || !CODE_WRITING_AGENT_ACTIONS.has(packet.action)) return {}
    try {
      const worktree = requireWorktree(projectId)
      return {
        codeState: codeFingerprint(worktree, baseRef),
        changedPaths: changedCodePaths(worktree, baseRef),
      }
    } catch (error) {
      return { unavailable: error.message }
    }
  }

  function recoverDeliveryCommit(active) {
    const worktree = requireWorktree(projectId)
    const workItem = readJson(join(projectDir, 'work-item.json'))
    if (workItem?.autopilot?.delivery?.status === 'committed') {
      return { outcome: 'completed', changedState: true, recovered: true }
    }
    const checkpoint = active.checkpoint || {}
    const expectedPaths = checkpoint.paths || []
    const currentHead = runGit(worktree, ['rev-parse', 'HEAD']).trim()
    if (!checkpoint.headShaBefore || currentHead === checkpoint.headShaBefore) {
      return { outcome: 'failed-safety-check', changedState: false, error: 'delivery commit interruption cannot be proven complete' }
    }
    const subject = runGit(worktree, ['log', '-1', '--format=%s']).trim()
    const committedPaths = runGit(worktree, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).split('\n').filter(Boolean)
    const latest = readJson(join(projectDir, 'latest-result.json'))
    if (
      !expectedPaths.length
      || !samePathSet(expectedPaths, committedPaths)
      || (checkpoint.subject && subject !== checkpoint.subject)
      || !scopedDeliveryCommitted(worktree, latest?.codeFingerprint)
    ) {
      return {
        outcome: 'failed-safety-check',
        changedState: false,
        error: 'HEAD changed during delivery commit, but its subject or path scope does not match the active checkpoint',
      }
    }
    persistVNextWorkItem(projectDir, applyDeliveryCommit(workItem, {
      commitSha: currentHead,
      paths: expectedPaths,
    }))
    return { outcome: 'completed', changedState: true, recovered: true, commitSha: currentHead, paths: expectedPaths, pushed: false }
  }

  function recoverInterrupted({ active, sameInvocation }) {
    if (active.action === 'commit-ready-change') return recoverDeliveryCommit(active)
    if (active.executorType === 'deterministic') {
      return {
        outcome: sameInvocation ? 'failed-safety-check' : 'completed',
        changedState: !sameInvocation,
        recovered: !sameInvocation,
        error: sameInvocation ? `deterministic action ${active.action} must resume through its idempotent executor` : '',
      }
    }
    if (active.executorType !== 'agent' || !CODE_WRITING_AGENT_ACTIONS.has(active.action)) {
      return { outcome: 'completed', changedState: false, recovered: true, retrySafe: true }
    }
    let worktree
    try {
      worktree = requireWorktree(projectId)
    } catch (error) {
      return { outcome: 'failed-safety-check', changedState: false, error: error.message }
    }
    const before = active.checkpoint?.codeState
    const current = codeFingerprint(worktree, baseRef)
    if (before && matchesEffectiveCodeState(current, before)) {
      return { outcome: 'completed', changedState: false, recovered: true, retrySafe: true }
    }
    const reconciliation = executeSurfaceReconciliation({
      projectDir,
      worktree,
      baseRef,
      executeScript,
    })
    return reconciliation.ok
      ? { outcome: 'completed', changedState: true, recovered: true, reconciliation }
      : { outcome: 'failed-infrastructure', changedState: false, error: reconciliation.error, reconciliation }
  }

  function executeDeterministic({ packet, active }) {
    if (packet.action === 'prepare-coding-worktree') {
      const execution = executeScript('prepare-coding-worktree.mjs', [projectId])
      return execution.status === 0
        ? { outcome: 'completed', output: (execution.stdout || '').trim().slice(0, 4000) }
        : { outcome: 'failed-infrastructure', error: (execution.stderr || execution.stdout || 'worktree preparation failed').trim().slice(0, 2000) }
    }
    if (packet.action === 'reconcile-current-code') {
      const reconciliation = executeSurfaceReconciliation({
        projectDir,
        worktree: requireWorktree(projectId),
        baseRef,
        executeScript,
      })
      return reconciliation.ok
        ? { outcome: 'completed', reconciliation }
        : { outcome: 'failed-infrastructure', error: reconciliation.error, reconciliation }
    }
    if (['capture-cli-evidence', 'revalidate-current-code-evidence', 'refresh-invalid-verification'].includes(packet.action)) {
      const validation = runAutonomousValidation(projectId)
      return validation.step === 'verify' && [0, 1].includes(validation.verifyExitCode)
        ? { outcome: 'completed', validation }
        : { outcome: 'failed-infrastructure', error: validation.error || 'autonomous validation did not reach verification', validation }
    }
    if (packet.action === 'commit-ready-change') {
      const checkpoint = active?.checkpoint || {}
      if (checkpoint.headShaBefore) {
        const currentHead = runGit(requireWorktree(projectId), ['rev-parse', 'HEAD']).trim()
        if (currentHead !== checkpoint.headShaBefore) return recoverDeliveryCommit(active)
      }
      const commit = commitEvidenceScope(projectId)
      return commit.ok
        ? { outcome: 'completed', commit }
        : {
            outcome: /unsafe|scope|branch|worktree/i.test(commit.error || '') ? 'failed-safety-check' : 'failed-infrastructure',
            error: commit.error,
            commit,
          }
    }
    if (packet.action === 'complete') return { outcome: 'complete' }
    return { outcome: 'failed-infrastructure', error: `deterministic executor is not implemented for ${packet.action}` }
  }

  const deterministic = Object.fromEntries(DETERMINISTIC_ACTIONS.map((action) => [action, executeDeterministic]))
  const agent = createVNextAgentExecutor({
    projectId,
    projectDir,
    baseRef,
    requireWorktree,
    client: agentClient,
    model: agentModel,
    ...(agentReviewerClient ? { reviewerClient: agentReviewerClient } : {}),
    ...(invokeAgent ? { invoke: invokeAgent } : {}),
    ...(runCoverageReview ? { runCoverageReview } : {}),
  })
  return {
    checkpointFor,
    recoverInterrupted,
    executeDeterministic,
    run: () => runContinuousRunner({
      projectId,
      projectDir,
      inspect,
      registry: createActionExecutorRegistry({ deterministic, agent }),
      checkpointFor,
      recoverInterrupted,
      maxSteps,
      retryFailedAction,
    }),
  }
}

function git(repo, args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim())
  return result.stdout || ''
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-orchestrator-runner-'))
  const repo = join(root, 'repo')
  const projectDir = join(root, 'project')
  try {
    mkdirSync(join(repo, 'src'), { recursive: true })
    mkdirSync(projectDir, { recursive: true })
    git(repo, ['init', '-q'])
    git(repo, ['config', 'user.name', 'Self Test'])
    git(repo, ['config', 'user.email', 'self-test@example.invalid'])
    writeFileSync(join(repo, 'src/frozen.ts'), 'before\n')
    writeFileSync(join(repo, 'src/unrelated.ts'), 'before\n')
    git(repo, ['add', '.'])
    git(repo, ['commit', '-qm', 'base'])
    git(repo, ['checkout', '-qb', 'feature/PR-00001'])

    writeFileSync(join(repo, 'src/frozen.ts'), 'after\n')
    writeFileSync(join(repo, 'src/unrelated.ts'), 'unrelated\n')
    const headShaBefore = git(repo, ['rev-parse', 'HEAD']).trim()
    const gitCalls = []
    const trackedSpawn = (command, args, options) => {
      gitCalls.push([command, ...args])
      return spawnSync(command, args, options)
    }
    const commit = commitScopedPaths(repo, 'PR-00001', ['src/frozen.ts'], trackedSpawn, 'delivery', {
      workItem: { schemaVersion: 1, workflowVersion: 2, projectId: 'PR-00001' },
      subject: 'feat(PR-00001): deliver verified scope',
      assertSafety: () => ({ ok: true, branch: 'feature/PR-00001' }),
    })
    assert.equal(commit.ok, true, commit.error)
    assert.deepEqual(git(repo, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']).trim().split('\n'), ['src/frozen.ts'])
    assert.match(git(repo, ['status', '--short', '--', 'src/unrelated.ts']), /src\/unrelated\.ts/)
    assert.equal(gitCalls.some((call) => call[1] === 'push'), false)
    const adopted = adoptVerifiedHeadCommit(repo, {
      ...codeFingerprint(repo, 'HEAD', { scopePaths: ['src/frozen.ts'] }),
      headSha: headShaBefore,
    }, spawnSync, { baseRef: 'HEAD' })
    assert.equal(adopted.ok, true, adopted.error)
    assert.equal(adopted.commitSha, commit.commitSha)
    assert.equal(adopted.adopted, true)

    const workItem = sealCoverageAuditForFixture({
      schemaVersion: 1,
      workflowVersion: 2,
      projectId: 'PR-00001',
      sourceSnapshot: { revision: '1', contentHash: 'source', sources: [{ path: 'prd.md', contentHash: 'source' }] },
      routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0', routerVersion: 1 },
      apiDependency: { mode: 'no-request', reason: 'fixture' },
      requirements: [{
        requirementId: 'R-001',
        sourceAnchors: [{ type: 'text', sourceId: 'SRC-1' }],
        statement: 'Fixture requirement.',
        status: 'doing',
        evidencePlan: [{ type: 'pure-logic', runtimeRequired: false }],
        affectedSurfaces: [],
      }],
      requirementsAuthor: { kind: 'model', id: 'codex/default', client: 'codex', sessionId: 'author-session' },
      autopilot: { delivery: { status: 'pending' } },
      coverageAudit: { unresolved: [] },
    })
    writeFileSync(join(projectDir, 'work-item.json'), `${JSON.stringify(workItem, null, 2)}\n`)
    writeFileSync(join(projectDir, 'latest-result.json'), `${JSON.stringify({
      codeFingerprint: { scopeMode: 'path-set-v1', scopePaths: ['src/frozen.ts'] },
    }, null, 2)}\n`)

    let stage = 0
    const states = [
      { status: 'active', actionPacket: { action: 'prepare-coding-worktree', actionId: 'A-1' } },
      { status: 'active', actionPacket: { action: 'capture-cli-evidence', actionId: 'A-2' } },
      { status: 'complete', actionPacket: { action: 'complete', actionId: 'A-3' } },
    ]
    const runtime = createVNextOrchestratorRunner({
      projectId: 'PR-00001',
      projectDir,
      baseRef: 'HEAD',
      inspect: () => states[stage],
      requireWorktree: () => repo,
      executeScript: () => {
        stage += 1
        return { status: 0, stdout: 'prepared' }
      },
      runAutonomousValidation: () => {
        stage += 1
        return { step: 'verify', verifyExitCode: 0 }
      },
      commitEvidenceScope: () => ({ ok: true }),
      scopedDeliveryCommitted: (worktree, codeState) => (
        runGit(worktree, ['status', '--porcelain=v1', '-z', '--', ...codeState.scopePaths]).length === 0
      ),
    })
    assert.equal(runtime.run().runner.outcome, 'complete')

    let agentStage = 0
    const agentRuntime = createVNextOrchestratorRunner({
      projectId: 'PR-00001',
      projectDir,
      baseRef: 'HEAD',
      inspect: () => [
        { status: 'active', actionPacket: { action: 'complete-independent-review', actionId: 'A-review' } },
        { status: 'complete', actionPacket: { action: 'complete', actionId: 'A-done' } },
      ][agentStage],
      requireWorktree: () => repo,
      executeScript: () => ({ status: 0, stdout: '' }),
      runAutonomousValidation: () => ({ step: 'verify', verifyExitCode: 0 }),
      commitEvidenceScope: () => ({ ok: true }),
      scopedDeliveryCommitted: () => true,
      agentClient: 'codex',
      runCoverageReview: ({ client }) => {
        assert.equal(client, 'codex')
        agentStage += 1
        return { response: { verdict: 'pass', reviewRunId: 'review-1' } }
      },
    })
    assert.equal(agentRuntime.run().runner.outcome, 'complete')

    const unsupportedAgentRuntime = createVNextOrchestratorRunner({
      projectId: 'PR-00001',
      projectDir,
      baseRef: 'HEAD',
      inspect: () => ({
        status: 'active',
        actionPacket: { action: 'repair-manual-test-failures', actionId: 'A-manual-repair' },
      }),
      requireWorktree: () => repo,
      executeScript: () => ({ status: 0, stdout: '' }),
      runAutonomousValidation: () => ({ step: 'verify', verifyExitCode: 0 }),
      commitEvidenceScope: () => ({ ok: true }),
      scopedDeliveryCommitted: () => true,
      agentClient: 'codex',
    })
    assert.equal(unsupportedAgentRuntime.checkpointFor({
      current: {},
      packet: { action: 'repair-manual-test-failures' },
      executorType: 'agent',
    }).codeState, undefined)
    assert.equal(unsupportedAgentRuntime.run().runner.outcome, 'needs-agent')

    const recovered = runtime.recoverInterrupted({
      sameInvocation: true,
      active: {
        action: 'commit-ready-change',
        executorType: 'deterministic',
        checkpoint: {
          headShaBefore,
          paths: ['src/frozen.ts'],
          subject: 'feat(PR-00001): deliver verified scope',
        },
      },
    })
    assert.equal(recovered.outcome, 'completed', recovered.error)
    const persisted = readJson(join(projectDir, 'work-item.json'))
    assert.equal(persisted.autopilot.delivery.status, 'committed')
    assert.deepEqual(persisted.autopilot.delivery.paths, ['src/frozen.ts'])
    assert.equal(persisted.autopilot.delivery.pushed, false)
    console.log('vnext-orchestrator-runner self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) {
  selfTest()
}
