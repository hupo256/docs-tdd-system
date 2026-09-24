#!/usr/bin/env node
// Durable, bounded execution loop for v2 Autopilot action packets.

import assert from 'node:assert/strict'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTOPILOT_ACTIONS } from './vnext-autopilot-actions.mjs'
import { stableFingerprint } from './vnext-work-item.mjs'

const DETERMINISTIC_ACTIONS = new Set([
  'prepare-coding-worktree',
  'reconcile-current-code',
  'capture-cli-evidence',
  'refresh-invalid-verification',
  'revalidate-current-code-evidence',
  'commit-ready-change',
  'complete',
])

const HUMAN_ACTIONS = new Set([
  'collect-scope-approval',
  'complete-deferred-human-review',
  'complete-pretest-human-run',
  'resume-review-after-human-repair',
  'blocked-user-decision',
  'escalate-review-failure',
  'escalate-repair-failure',
  'resolve-manual-test-blockers',
])

const EXTERNAL_ACTIONS = new Set([
  'await-surface-dependencies',
  'await-late-dependencies',
  'blocked-external-dependency',
  'failed-infrastructure',
])

const RUNNER_TERMINALS = new Set([
  'complete',
  'needs-agent',
  'needs-user',
  'blocked',
  'blocked-external-dependency',
  'failed-infrastructure',
  'failed-safety-check',
  'budget-exhausted',
])

const BUDGETED_FAILURES = new Set([
  'failed-infrastructure',
  'failed-safety-check',
])

function atomicWrite(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  let descriptor
  try {
    descriptor = openSync(temporary, 'wx')
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, file)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function runnerStateFile(projectDir) {
  return join(resolve(projectDir), 'agent', 'runner-state.json')
}

function initialRunnerState(projectId) {
  return {
    schemaVersion: 1,
    projectId,
    activeAction: null,
    receipts: [],
    updatedAt: null,
  }
}

export function readRunnerState(projectDir, projectId) {
  const file = runnerStateFile(projectDir)
  if (!existsSync(file)) return initialRunnerState(projectId)
  const state = JSON.parse(readFileSync(file, 'utf8'))
  if (state?.schemaVersion !== 1 || state?.projectId !== projectId || !Array.isArray(state.receipts)) {
    throw new Error(`invalid v2 runner state: ${file}`)
  }
  return state
}

function persistRunnerState(projectDir, state, generatedAt) {
  const next = { ...state, updatedAt: generatedAt }
  atomicWrite(runnerStateFile(projectDir), next)
  return next
}

export function executorTypeForAction(action) {
  if (!AUTOPILOT_ACTIONS.includes(action)) throw new Error(`unknown Autopilot action: ${action}`)
  if (DETERMINISTIC_ACTIONS.has(action)) return 'deterministic'
  if (HUMAN_ACTIONS.has(action)) return 'human'
  if (EXTERNAL_ACTIONS.has(action)) return 'external'
  return 'agent'
}

export function createActionExecutorRegistry({
  deterministic = {},
  agent = null,
  human = null,
  external = null,
} = {}) {
  const registry = new Map()
  for (const action of AUTOPILOT_ACTIONS) {
    const type = executorTypeForAction(action)
    let execute
    if (type === 'deterministic') execute = deterministic[action]
    else if (type === 'agent') execute = agent
    else if (type === 'human') execute = human
    else execute = external

    if (!execute && type === 'agent') {
      execute = ({ packet }) => ({
        outcome: 'needs-agent',
        changedState: false,
        adapter: 'not-configured',
        note: 'A host Agent must perform this action and submit its structured result.',
        actionId: packet.actionId,
      })
    }
    if (!execute && type === 'human') {
      execute = ({ packet }) => ({
        outcome: 'needs-user',
        changedState: false,
        actionId: packet.actionId,
      })
    }
    if (!execute && type === 'external') {
      execute = ({ packet }) => ({
        outcome: packet.action === 'failed-infrastructure' ? 'failed-infrastructure' : 'blocked-external-dependency',
        changedState: false,
        actionId: packet.actionId,
      })
    }
    if (!execute && action === 'complete') {
      execute = () => ({ outcome: 'complete', changedState: false })
    }
    registry.set(action, { action, type, execute })
  }
  return registry
}

export function runnerInvocationFingerprint(state) {
  return stableFingerprint({
    actionPacket: state?.actionPacket || null,
    latestResult: state?.latestResult || null,
    lifecycle: state?.lifecycle || null,
    blockers: state?.blockers || [],
  })
}

function receiptId(active, result) {
  return stableFingerprint({
    invocationId: active.invocationId,
    outcome: result.outcome,
    result: result.resultFingerprint || stableFingerprint(result),
  })
}

export function runnerFailureFingerprint(result) {
  if (!BUDGETED_FAILURES.has(result?.outcome)) return ''
  return stableFingerprint({
    outcome: result.outcome,
    error: result.error || '',
    adapter: result.adapter || '',
    step: result.step || '',
  })
}

function beginAction(projectDir, runnerState, { packet, invocationId, executorType, checkpoint, generatedAt }) {
  if (runnerState.activeAction?.invocationId === invocationId) return runnerState
  return persistRunnerState(projectDir, {
    ...runnerState,
    activeAction: {
      action: packet.action,
      actionId: packet.actionId,
      invocationId,
      executorType,
      startedAt: generatedAt,
      checkpoint: checkpoint || {},
    },
  }, generatedAt)
}

function finishAction(projectDir, runnerState, active, result, generatedAt, extra = {}) {
  const failureFingerprint = runnerFailureFingerprint(result)
  const receipt = {
    receiptId: receiptId(active, result),
    action: active.action,
    actionId: active.actionId,
    invocationId: active.invocationId,
    executorType: active.executorType,
    startedAt: active.startedAt,
    completedAt: generatedAt,
    ...result,
    ...(failureFingerprint ? { failureFingerprint } : {}),
    ...extra,
  }
  const receipts = runnerState.receipts.some((item) => item.receiptId === receipt.receiptId)
    ? runnerState.receipts
    : [...runnerState.receipts, receipt]
  return persistRunnerState(projectDir, { ...runnerState, activeAction: null, receipts }, generatedAt)
}

function terminalResult(state, outcome, details = {}) {
  if (!RUNNER_TERMINALS.has(outcome)) throw new Error(`unknown runner terminal: ${outcome}`)
  return {
    state,
    runner: {
      outcome,
      ...details,
    },
  }
}

function normalizeResult(result) {
  if (!result || typeof result !== 'object') {
    return { outcome: 'failed-infrastructure', changedState: false, error: 'executor returned no structured result' }
  }
  const outcome = result.outcome || (result.ok ? 'completed' : 'failed-infrastructure')
  return { changedState: false, ...result, outcome }
}

export function runContinuousRunner({
  projectId,
  projectDir,
  inspect,
  registry,
  checkpointFor = () => ({}),
  recoverInterrupted = null,
  maxSteps = 20,
  now = () => new Date().toISOString(),
} = {}) {
  if (!projectId || !projectDir || typeof inspect !== 'function' || !(registry instanceof Map)) {
    throw new Error('continuous runner requires projectId, projectDir, inspect, and registry')
  }

  for (let step = 1; step <= maxSteps; step += 1) {
    let current = inspect()
    const packet = current.actionPacket
    if (current.status === 'complete' || packet?.action === 'complete') {
      return terminalResult(current, 'complete', { steps: step - 1 })
    }
    if (!packet?.action || !packet?.actionId) {
      return terminalResult(current, 'failed-infrastructure', {
        steps: step - 1,
        error: 'Autopilot did not produce a valid action packet',
      })
    }

    const registered = registry.get(packet.action)
    if (!registered) {
      return terminalResult(current, 'failed-infrastructure', {
        steps: step - 1,
        actionId: packet.actionId,
        error: `no executor registered for ${packet.action}`,
      })
    }
    const invocationId = runnerInvocationFingerprint(current)
    let persisted = readRunnerState(projectDir, projectId)
    const active = persisted.activeAction

    if (active) {
      const sameInvocation = active.invocationId === invocationId
      if (sameInvocation && active.executorType === 'deterministic') {
        // Deterministic executors are required to be idempotent and receive the original checkpoint.
      } else {
        const recovery = recoverInterrupted
          ? normalizeResult(recoverInterrupted({ active, current, packet, sameInvocation }))
          : {
              outcome: sameInvocation ? 'failed-safety-check' : 'completed',
              changedState: !sameInvocation,
              recovered: !sameInvocation,
              error: sameInvocation ? 'interrupted non-deterministic action requires reconciliation' : '',
            }
        persisted = finishAction(projectDir, persisted, active, {
          ...recovery,
          outcome: recovery.outcome === 'completed' ? 'recovered' : recovery.outcome,
        }, now(), { recovery: true })
        if (recovery.outcome !== 'completed') {
          return terminalResult(inspect(), recovery.outcome, {
            steps: step - 1,
            actionId: active.actionId,
            recovery,
          })
        }
        current = inspect()
        if (current.status === 'complete' || current.actionPacket?.action === 'complete') {
          return terminalResult(current, 'complete', { steps: step - 1, recovered: true })
        }
        if (runnerInvocationFingerprint(current) !== invocationId) continue
      }
    }

    persisted = readRunnerState(projectDir, projectId)
    const successfulReceipt = persisted.receipts.find((receipt) => (
      receipt.invocationId === invocationId && receipt.outcome === 'completed'
    ))
    if (successfulReceipt) {
      return terminalResult(current, 'failed-infrastructure', {
        steps: step - 1,
        actionId: packet.actionId,
        error: 'completed action receipt exists but canonical state did not advance',
        receiptId: successfulReceipt.receiptId,
      })
    }

    const generatedAt = now()
    persisted = beginAction(projectDir, persisted, {
      packet,
      invocationId,
      executorType: registered.type,
      checkpoint: checkpointFor({ current, packet, executorType: registered.type }),
      generatedAt,
    })
    const running = persisted.activeAction
    let result
    try {
      result = normalizeResult(registered.execute({
        projectId,
        projectDir,
        current,
        packet,
        active: running,
      }))
    } catch (error) {
      result = {
        outcome: 'failed-infrastructure',
        changedState: false,
        error: error.message,
      }
    }

    let after = inspect()
    if (result.outcome === 'completed') {
      const changedState = after.status === 'complete'
        || after.actionPacket?.action === 'complete'
        || runnerInvocationFingerprint(after) !== invocationId
      if (!changedState) {
        result = {
          ...result,
          outcome: 'failed-infrastructure',
          changedState: false,
          error: result.error || `executor ${packet.action} completed without advancing canonical state`,
        }
      } else {
        result.changedState = true
      }
    }
    const failureFingerprint = runnerFailureFingerprint(result)
    const repeatedFailure = failureFingerprint && persisted.receipts.some((receipt) => (
      receipt.invocationId === invocationId
      && (receipt.failureFingerprint || runnerFailureFingerprint(receipt)) === failureFingerprint
    ))
    if (repeatedFailure) {
      result = {
        outcome: 'budget-exhausted',
        changedState: false,
        causeOutcome: result.outcome,
        failureFingerprint,
        error: `same ${result.outcome} repeated for the current invocation`,
      }
    }
    persisted = finishAction(projectDir, persisted, running, result, now())
    if (result.outcome === 'completed') continue

    after = inspect()
    return terminalResult(after, result.outcome, {
      steps: step,
      actionId: packet.actionId,
      executorType: registered.type,
      receiptId: persisted.receipts.at(-1)?.receiptId || '',
      ...result,
    })
  }

  return terminalResult(inspect(), 'budget-exhausted', {
    steps: maxSteps,
    error: `continuous runner exceeded ${maxSteps} actions`,
  })
}

function selfTest() {
  assert.equal(executorTypeForAction('capture-cli-evidence'), 'deterministic')
  assert.equal(executorTypeForAction('implement-current-scope'), 'agent')
  assert.equal(executorTypeForAction('collect-scope-approval'), 'human')
  assert.equal(executorTypeForAction('await-late-dependencies'), 'external')
  assert.equal(new Set(AUTOPILOT_ACTIONS.map(executorTypeForAction)).size, 4)

  const root = mkdtempSync(join(tmpdir(), 'vnext-continuous-runner-'))
  try {
    let stage = 0
    const states = [
      { status: 'active', actionPacket: { action: 'prepare-coding-worktree', actionId: 'A-1' } },
      { status: 'active', actionPacket: { action: 'capture-cli-evidence', actionId: 'A-2' } },
      { status: 'complete', actionPacket: { action: 'complete', actionId: 'A-3' } },
    ]
    const registry = createActionExecutorRegistry({
      deterministic: {
        'prepare-coding-worktree': () => { stage += 1; return { outcome: 'completed' } },
        'capture-cli-evidence': () => { stage += 1; return { outcome: 'completed' } },
      },
    })
    const completed = runContinuousRunner({
      projectId: 'PR-00001',
      projectDir: root,
      inspect: () => states[stage],
      registry,
      now: (() => {
        let tick = 0
        return () => `2026-09-24T00:00:0${tick += 1}Z`
      })(),
    })
    assert.equal(completed.runner.outcome, 'complete')
    assert.equal(readRunnerState(root, 'PR-00001').receipts.length, 2)

    let needsAgentCalls = 0
    const agentRoot = join(root, 'agent-case')
    const agentRegistry = createActionExecutorRegistry({
      agent: ({ packet }) => {
        needsAgentCalls += 1
        return { outcome: 'needs-agent', actionId: packet.actionId }
      },
    })
    const agentState = () => ({
      status: 'active',
      actionPacket: { action: 'implement-current-scope', actionId: 'A-agent' },
    })
    assert.equal(runContinuousRunner({
      projectId: 'PR-00002', projectDir: agentRoot, inspect: agentState, registry: agentRegistry,
    }).runner.outcome, 'needs-agent')
    assert.equal(runContinuousRunner({
      projectId: 'PR-00002', projectDir: agentRoot, inspect: agentState, registry: agentRegistry,
    }).runner.outcome, 'needs-agent')
    assert.equal(needsAgentCalls, 2)
    assert.equal(readRunnerState(agentRoot, 'PR-00002').receipts.length, 1)
    assert.equal(executorTypeForAction('resume-review-after-human-repair'), 'human')
    const humanResume = runContinuousRunner({
      projectId: 'PR-00005',
      projectDir: join(root, 'human-resume'),
      inspect: () => ({
        status: 'active',
        actionPacket: { action: 'resume-review-after-human-repair', actionId: 'A-human-resume' },
      }),
      registry: createActionExecutorRegistry(),
    })
    assert.equal(humanResume.runner.outcome, 'needs-user')

    const failureRoot = join(root, 'failure-budget')
    const failureState = () => ({
      status: 'active',
      actionPacket: { action: 'implement-current-scope', actionId: 'A-failure' },
    })
    const failureRegistry = createActionExecutorRegistry({
      agent: () => ({ outcome: 'failed-safety-check', error: 'reported paths do not match Git' }),
    })
    const firstFailure = runContinuousRunner({
      projectId: 'PR-00004',
      projectDir: failureRoot,
      inspect: failureState,
      registry: failureRegistry,
    })
    assert.equal(firstFailure.runner.outcome, 'failed-safety-check')
    const exhausted = runContinuousRunner({
      projectId: 'PR-00004',
      projectDir: failureRoot,
      inspect: failureState,
      registry: failureRegistry,
    })
    assert.equal(exhausted.runner.outcome, 'budget-exhausted')
    assert.equal(exhausted.runner.causeOutcome, 'failed-safety-check')

    let recoveryCalls = 0
    const recoveryRoot = join(root, 'recovery-case')
    atomicWrite(runnerStateFile(recoveryRoot), {
      ...initialRunnerState('PR-00003'),
      activeAction: {
        action: 'implement-current-scope',
        actionId: 'A-old',
        invocationId: 'old',
        executorType: 'agent',
        startedAt: '2026-09-24T00:00:00Z',
        checkpoint: {},
      },
    })
    const recovered = runContinuousRunner({
      projectId: 'PR-00003',
      projectDir: recoveryRoot,
      inspect: () => ({ status: 'active', actionPacket: { action: 'collect-scope-approval', actionId: 'A-new' } }),
      registry: createActionExecutorRegistry(),
      recoverInterrupted: () => {
        recoveryCalls += 1
        return { outcome: 'completed', changedState: true, reconciled: true }
      },
    })
    assert.equal(recovered.runner.outcome, 'needs-user')
    assert.equal(recoveryCalls, 1)
    assert.equal(readRunnerState(recoveryRoot, 'PR-00003').activeAction, null)
    console.log('vnext-continuous-runner self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) {
  selfTest()
}
