#!/usr/bin/env node
// Explicit v2 checkpoint/delivery commit entrypoint. Checkpoints are non-delivery commits backed by
// a fresh dev-check; delivery commits remain backed by authoritative enforced verification.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codeFingerprint, pendingCodePaths } from './lib/fingerprint.mjs'
import { requireProjectWorktree } from './lib/project-status-report.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { applyCheckpointCommit } from './lib/vnext-autopilot.mjs'
import { persistVNextWorkItem } from './lib/vnext-persistence.mjs'
import { checkpointCommitProblems } from './vnext-dev-check.mjs'
import { commitEvidenceScope, commitScopedPaths, inspectVNext } from './project-orchestrator.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

export function commitVNextProject(projectId, mode) {
  if (!['checkpoint', 'delivery'].includes(mode)) throw new Error('commit requires --mode checkpoint|delivery')
  if (mode === 'delivery') {
    const before = inspectVNext(projectId)
    if (before.nextAction !== 'commit-ready-change') throw new Error(`delivery commit is not ready; next action is ${before.nextAction}`)
    const automation = commitEvidenceScope(projectId)
    if (!automation.ok) throw new Error(automation.error)
    return { ...inspectVNext(projectId), automation }
  }

  const { config } = resolveRoots()
  const projectDir = resolveProjectRoot(projectId)
  const workItem = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
  if (workItem.workflowVersion !== 2) throw new Error('commit is a v2-only command')
  const worktree = requireProjectWorktree(projectId)
  const paths = pendingCodePaths(worktree)
  const currentCodeState = codeFingerprint(worktree, config.baseRef || 'origin/online')
  const problems = checkpointCommitProblems({ projectId, workItem, currentCodeState, changedPaths: paths, baseAvailable: Boolean(currentCodeState.baseSha) })
  if (problems.length) throw new Error(`checkpoint commit blocked:\n- ${problems.join('\n- ')}`)
  const commit = commitScopedPaths(worktree, projectId, paths, undefined, 'checkpoint')
  if (!commit.ok) throw new Error(commit.error)
  persistVNextWorkItem(projectDir, applyCheckpointCommit(workItem, commit))
  return { ...inspectVNext(projectId), automation: commit }
}

function selfTest() {
  assert.throws(() => commitVNextProject('PR-00001', 'unknown'), /checkpoint\|delivery/)
  console.log('vnext-commit self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else try {
    const projectId = option('--project')
    if (!projectId) throw new Error('commit requires --project PR-xxxxx')
    console.log(JSON.stringify(commitVNextProject(projectId, option('--mode')), null, 2))
  } catch (error) {
    console.error(`vNext commit failed: ${error.message}`)
    process.exitCode = 1
  }
}
