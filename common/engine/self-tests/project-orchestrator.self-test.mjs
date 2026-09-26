import assert from 'node:assert/strict'
import { decideNext } from '../agent-scripts/lib/project-decision.mjs'
import {
  automaticChangeIdForSource,
  commitScopedPaths,
  inferState,
  resolveAutopilotAgentOptions,
  runnerFailureStatus,
  scopedDeliveryCommitted,
  vnextVerificationNextAction,
} from '../agent-scripts/project-orchestrator.mjs'

const missing = inferState({ projectExists: false })
const blocked = inferState({ projectExists: true, gateResult: { gate: 'G5', ok: false } })
const advance = inferState({ projectExists: true, gateResult: { gate: 'G5', ok: true } })
const complete = inferState({ projectExists: true, gateResult: { gate: 'G8', ok: true } })
const decision = decideNext({
  projectId: 'PR-00001',
  projectExists: true,
  gateResult: {
    gate: 'G5',
    ok: false,
    checks: [{ ruleId: 'DOC-G5-003', ok: false, severity: 'error', message: 'x' }],
  },
})

assert.equal(missing.nextAction, 'scaffold_project')
assert.equal(blocked.nextAction, 'fix_gate_failures')
assert.equal(advance.nextAction, 'run_next_gate')
assert.equal(complete.status, 'complete')
assert.equal(decision.command, 'docs-tdd gate PR-00001 G5')
assert.equal(decision.blockers.length, 1)
assert.equal(resolveAutopilotAgentOptions({ env: { CODEX_THREAD_ID: 'thread-1' } }).client, 'codex')
assert.equal(resolveAutopilotAgentOptions({ env: {} }).client, 'claude')
assert.equal(resolveAutopilotAgentOptions({
  requestedClient: 'codex',
  requestedModel: 'gpt-test',
  env: {},
}).model, 'gpt-test')
assert.match(automaticChangeIdForSource('path:/tmp/new-prd.md'), /^change-[0-9a-f]{8}$/)
assert.equal(runnerFailureStatus({
  trace: { terminalState: 'failed-infrastructure' },
  lastReceipt: { actionId: 'A-1', outcome: 'failed-infrastructure' },
}, { actionId: 'A-1' }), 'failed-infrastructure')
assert.equal(runnerFailureStatus({
  trace: { terminalState: 'failed-infrastructure' },
  lastReceipt: { actionId: 'A-1', outcome: 'failed-infrastructure' },
}, { actionId: 'A-2' }), null)
assert.equal(vnextVerificationNextAction({
  authoritativePass: false,
  shadowOnly: false,
  integrityOk: true,
  codeStateFresh: false,
  status: 'passed',
}), 'revalidate_current_code_evidence')
assert.equal(vnextVerificationNextAction({
  authoritativePass: false,
  shadowOnly: false,
  integrityOk: false,
  codeStateFresh: false,
  assuranceTrusted: false,
  status: 'passed',
}), 'refresh_invalid_verification')
assert.equal(vnextVerificationNextAction({
  authoritativePass: false,
  shadowOnly: false,
  integrityOk: true,
  codeStateFresh: true,
  assuranceTrusted: false,
  status: 'passed',
}), 'capture_cli_attested_evidence')
assert.equal(scopedDeliveryCommitted(
  '/tmp/worktree',
  { scopeMode: 'path-set-v1', scopePaths: ['src/a.ts'] },
  () => ({ status: 0, stdout: '', stderr: '' }),
), true)
assert.equal(scopedDeliveryCommitted(
  '/tmp/worktree',
  { scopeMode: 'path-set-v1', scopePaths: ['src/a.ts'] },
  () => ({ status: 0, stdout: ' M src/a.ts', stderr: '' }),
), false)

const gitCalls = []
const commit = commitScopedPaths('/tmp/worktree', 'PR-00001', ['src/a.ts'], (_command, gitArgs) => {
  gitCalls.push(gitArgs)
  return { status: 0, stdout: gitArgs[0] === 'rev-parse' ? 'abc123\n' : '', stderr: '' }
}, 'delivery', {
  workItem: { workflowVersion: 2, projectId: 'PR-00001' },
  assertSafety: () => ({ ok: true, branch: 'feature/PR-00001' }),
})
assert.equal(commit.ok, true)
assert.equal(commit.commitSha, 'abc123')
assert.equal(commit.mode, 'delivery')
assert.equal(gitCalls.some((gitArgs) => gitArgs[0] === 'push'), false)
assert.equal(gitCalls.some((gitArgs) => gitArgs[0] === 'commit' && gitArgs.includes('--only')), true)

console.log('project-orchestrator self-test passed (structured inferState + decideNext wiring)')
