import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AUTOPILOT_ACTIONS } from '../agent-scripts/lib/vnext-autopilot-actions.mjs'
import {
  createActionExecutorRegistry,
  executorTypeForAction,
  readRunnerState,
  runContinuousRunner,
} from '../agent-scripts/lib/vnext-continuous-runner.mjs'

assert.equal(executorTypeForAction('capture-cli-evidence'), 'deterministic')
assert.equal(executorTypeForAction('implement-current-scope'), 'agent')
assert.equal(executorTypeForAction('collect-scope-approval'), 'human')
assert.equal(executorTypeForAction('await-late-dependencies'), 'external')
assert.equal(new Set(AUTOPILOT_ACTIONS.map(executorTypeForAction)).size, 4)

const root = mkdtempSync(join(tmpdir(), 'vnext-continuous-runner-'))
try {
  let stage = 0
  const states = [
    { status: 'active', executionRoute: 'micro', actionPacket: { action: 'prepare-coding-worktree', actionId: 'A-1', executionRoute: 'micro' } },
    { status: 'active', executionRoute: 'standard', actionPacket: { action: 'capture-cli-evidence', actionId: 'A-2', executionRoute: 'standard' } },
    { status: 'complete', executionRoute: 'standard', actionPacket: { action: 'complete', actionId: 'A-3', executionRoute: 'standard' } },
  ]
  const completed = runContinuousRunner({
    projectId: 'PR-00001',
    projectDir: root,
    inspect: () => states[stage],
    registry: createActionExecutorRegistry({
      deterministic: {
        'prepare-coding-worktree': () => { stage += 1; return { outcome: 'completed' } },
        'capture-cli-evidence': () => { stage += 1; return { outcome: 'completed' } },
      },
    }),
    now: (() => {
      let tick = 0
      return () => `2026-09-26T00:00:0${tick += 1}Z`
    })(),
  })
  assert.equal(completed.runner.outcome, 'complete')
  assert.deepEqual(completed.runner.trace.observedRoutes, ['micro', 'standard'])
  assert.equal(readRunnerState(root, 'PR-00001').receipts.length, 2)

  const human = runContinuousRunner({
    projectId: 'PR-00002',
    projectDir: join(root, 'human'),
    inspect: () => ({
      status: 'active',
      actionPacket: { action: 'collect-scope-approval', actionId: 'A-human' },
    }),
    registry: createActionExecutorRegistry(),
  })
  assert.equal(human.runner.outcome, 'needs-user')

  const failureRoot = join(root, 'failure')
  const failureState = () => ({
    status: 'active',
    actionPacket: { action: 'implement-current-scope', actionId: 'A-failure' },
  })
  let executions = 0
  const failureRegistry = createActionExecutorRegistry({
    agent: () => {
      executions += 1
      return { outcome: 'failed-safety-check', error: 'reported paths do not match Git' }
    },
  })
  assert.equal(runContinuousRunner({
    projectId: 'PR-00003',
    projectDir: failureRoot,
    inspect: failureState,
    registry: failureRegistry,
  }).runner.outcome, 'failed-safety-check')
  const repeated = runContinuousRunner({
    projectId: 'PR-00003',
    projectDir: failureRoot,
    inspect: failureState,
    registry: failureRegistry,
  })
  assert.equal(repeated.runner.repeatedFailure, true)
  assert.equal(repeated.runner.retryRequired, true)
  assert.equal(executions, 1)
  runContinuousRunner({
    projectId: 'PR-00003',
    projectDir: failureRoot,
    inspect: failureState,
    registry: failureRegistry,
    retryFailedAction: true,
  })
  assert.equal(executions, 2)

  let loop = 0
  const nonConvergent = runContinuousRunner({
    projectId: 'PR-00004',
    projectDir: join(root, 'non-convergent'),
    inspect: () => ({
      status: 'active',
      actionPacket: { action: 'prepare-coding-worktree', actionId: `A-loop-${loop}` },
    }),
    registry: createActionExecutorRegistry({
      deterministic: {
        'prepare-coding-worktree': () => {
          loop += 1
          return { outcome: 'completed', changedState: true }
        },
      },
    }),
    maxSteps: 1,
  })
  assert.equal(nonConvergent.runner.outcome, 'failed-safety-check')
  assert.equal(nonConvergent.runner.nonConvergent, true)
  console.log('vnext-continuous-runner self-test passed')
} finally {
  rmSync(root, { recursive: true, force: true })
}
