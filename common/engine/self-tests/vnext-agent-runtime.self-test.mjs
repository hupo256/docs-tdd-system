import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AGENT_RUNTIME_CLIENTS,
  CHECKPOINT_PROMPT_HARD_CHARS,
  agentActionKind,
  checkpointPrompt,
  invokeHostAgent,
} from '../agent-scripts/lib/vnext-agent-runtime.mjs'

assert.deepEqual(AGENT_RUNTIME_CLIENTS, ['codex', 'claude'])
assert.equal(agentActionKind('extract-requirements'), 'extraction')
assert.equal(agentActionKind('complete-independent-review'), 'review')
assert.equal(agentActionKind('implement-current-scope'), 'checkpoint')
assert.equal(agentActionKind('repair-manual-test-failures'), null)

const root = mkdtempSync(join(tmpdir(), 'vnext-agent-runtime-'))
try {
  const prompt = 'Return a JSON object from stdin.'
  let invocation
  const result = invokeHostAgent({
    client: 'claude',
    cwd: root,
    prompt,
    schema: { type: 'object' },
    sandbox: 'read-only',
    spawn: (_command, args, options) => {
      invocation = { args, options }
      return { status: 0, stdout: '{"ok":true}', stderr: '' }
    },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.output, { ok: true })
  assert.equal(invocation.args.includes(prompt), false)
  assert.equal(invocation.options.input, prompt)
  assert.deepEqual(invocation.options.stdio, ['pipe', 'pipe', 'pipe'])

  const projected = checkpointPrompt({
    action: 'implement-current-scope',
    packet: { projectId: 'PR-00001', actionId: 'checkpoint-preview' },
    workItem: {
      workflowVersion: 2,
      projectId: 'PR-00001',
      sourceSnapshot: { revision: '1', contentHash: 'source', sources: [] },
      requirements: [],
      routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V1', routerVersion: 1 },
      apiDependency: { mode: 'no-request', reason: 'self-test' },
      coverageAudit: {
        sourceFingerprint: 'source',
        requirementsFingerprint: 'requirements',
        reviewMode: 'independent-cold-read',
        reviewRunId: 'review-1',
        reviewer: { kind: 'model', id: 'self-test' },
        completedAt: '2026-09-26T00:00:00Z',
        verdict: 'pass',
        unresolved: [],
      },
      reviewControl: { sourceFingerprint: 'source', attempts: 0, status: 'active', history: [] },
      autopilot: {
        repairAttempts: { code: 0, browser: 0 },
        lastDevCheck: {
          runId: 'do-not-inline-this-report',
          problems: ['do-not-inline-this-problem'],
        },
      },
    },
  })
  assert.ok(projected.length < CHECKPOINT_PROMPT_HARD_CHARS)
  assert.equal(projected.includes('reviewControl'), false)
  assert.equal(projected.includes('do-not-inline-this-report'), false)
  assert.equal(projected.includes('do-not-inline-this-problem'), false)
  console.log('vnext-agent-runtime self-test passed')
} finally {
  rmSync(root, { recursive: true, force: true })
}
