#!/usr/bin/env node
// Read-only v2 delivery guard for pre-commit and CI. It never creates evidence or mutates project
// state: a v2 branch may be delivered only when its CLI-attested PASS still matches the complete
// path set changed from the configured base ref.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { changedCodePaths, codeFingerprint, matchesEffectiveCodeState } from './lib/fingerprint.mjs'
import { deliveryScopePathProblems } from './lib/vnext-delivery-scope.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { projectIdForWorktree, projectIdFromBranch, workflowVersionForProject } from './lib/workflow-version.mjs'
import { coverageFingerprints } from './lib/vnext-work-item.mjs'
import { checkpointCommitProblems } from './vnext-dev-check.mjs'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function samePaths(left, right) {
  const normalize = (paths) => [...new Set((paths || []).map(String))].sort()
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

export function deliveryGuardProblems({
  projectId,
  workItem,
  latestResult,
  currentCodeState,
  changedPaths,
  baseAvailable = true,
  dependencies = {},
} = {}) {
  const problems = []
  const verifyIntegrity = dependencies.verifyIntegrity || verifyExitResultIntegrity
  const matchesCode = dependencies.matchesCode || matchesEffectiveCodeState
  if (!baseAvailable) problems.push('configured base ref is unavailable; cannot prove the complete changed-path set')
  if (!workItem || workItem.workflowVersion !== 2) problems.push('canonical workflowVersion=2 work-item.json is required')
  if (workItem?.projectId !== projectId) problems.push('work item does not match the branch project')
  if (!latestResult) return [...problems, 'latest-result.json is required']
  if (latestResult.mode !== 'enforced' || latestResult.status !== 'passed' || latestResult.ok !== true) problems.push('latest result must be enforced PASS')
  if (latestResult.assuranceMode !== 'autonomous' || latestResult.evidenceTrust !== 'cli-attested') problems.push('latest result must use CLI-attested autonomous evidence')
  const integrity = verifyIntegrity(latestResult, workItem)
  if (!integrity.ok) problems.push(...integrity.problems.map((problem) => `result integrity: ${problem}`))
  const recordedCode = latestResult.codeFingerprint
  if (recordedCode?.scopeMode !== 'path-set-v1' || !recordedCode.scopePaths?.length) problems.push('latest result must freeze a non-empty path-set-v1 scope')
  if (!matchesCode(currentCodeState, recordedCode)) problems.push('current code content differs from the verified path set')
  if (!samePaths(changedPaths, recordedCode?.scopePaths)) problems.push('changed paths differ from the verified path set')
  problems.push(...deliveryScopePathProblems(workItem, changedPaths))
  return [...new Set(problems)]
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
}

export function deliveryChangedPaths(worktree, baseRef, source = 'base') {
  if (source === 'base') return changedCodePaths(worktree, baseRef)
  if (source !== 'staged') throw new Error(`unknown changed-path source: ${source}`)
  const result = git(['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB', '-z'], worktree)
  if (result.status !== 0) throw new Error(`cannot read staged paths: ${result.stderr.trim()}`)
  return [...new Set(result.stdout.split('\0').filter(Boolean))].sort()
}

function projectIdFromEnvironment(config) {
  for (const value of [
    process.env.DOCS_TDD_PROJECT_ID,
    process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME,
    process.env.CI_COMMIT_REF_NAME,
    process.env.GITHUB_HEAD_REF,
    process.env.GITHUB_REF_NAME,
  ]) {
    const projectId = projectIdFromBranch(value, config)
    if (projectId) return projectId
  }
  return null
}

function selfTest() {
  const scopePaths = ['src/a.ts']
  const workItem = { workflowVersion: 2, projectId: 'PR-00001' }
  const code = { scopeMode: 'path-set-v1', scopePaths, contentHash: 'a'.repeat(64) }
  const latestResult = {
    mode: 'enforced',
    status: 'passed',
    ok: true,
    assuranceMode: 'autonomous',
    evidenceTrust: 'cli-attested',
    codeFingerprint: code,
  }
  const dependencies = {
    verifyIntegrity: () => ({ ok: true, problems: [] }),
    matchesCode: (current, recorded) => current.contentHash === recorded.contentHash,
  }
  assert.deepEqual(deliveryGuardProblems({ projectId: 'PR-00001', workItem, latestResult, currentCodeState: code, changedPaths: scopePaths, dependencies }), [])
  assert.match(deliveryGuardProblems({ projectId: 'PR-00001', workItem, latestResult, currentCodeState: code, changedPaths: [...scopePaths, 'src/unverified.ts'], dependencies }).join(' '), /changed paths/)
  assert.match(deliveryGuardProblems({ projectId: 'PR-00001', workItem, latestResult: { ...latestResult, status: 'failed', ok: false }, currentCodeState: code, changedPaths: scopePaths, dependencies }).join(' '), /enforced PASS/)
  assert.match(deliveryGuardProblems({ projectId: 'PR-00001', workItem, latestResult, currentCodeState: { ...code, contentHash: 'b'.repeat(64) }, changedPaths: scopePaths, dependencies }).join(' '), /code content/)
  assert.match(deliveryGuardProblems({ projectId: 'PR-00001', workItem, latestResult, currentCodeState: code, changedPaths: scopePaths, baseAvailable: false, dependencies }).join(' '), /base ref/)
  const reviewedWorkItem = {
    ...workItem,
    requirements: [{ requirementId: 'R-001', status: 'doing' }],
    routing: { verificationLevel: 'V1', riskSignals: [] },
    coverageAudit: { verdict: 'pass', unresolved: [] },
    autopilot: { lastDevCheck: { status: 'passed', ok: true, codeState: code, pendingCommitPaths: scopePaths } },
  }
  Object.assign(reviewedWorkItem.coverageAudit, coverageFingerprints(reviewedWorkItem))
  assert.deepEqual(checkpointCommitProblems({ projectId: 'PR-00001', workItem: reviewedWorkItem, currentCodeState: code, changedPaths: scopePaths, dependencies }), [])
  assert.match(checkpointCommitProblems({ projectId: 'PR-00001', workItem: reviewedWorkItem, currentCodeState: code, changedPaths: ['src/other.ts'], dependencies }).join(' '), /staged paths/)
  const pathScopedWorkItem = { ...workItem, deliveryScope: { policyPaths: ['src/allowed'] } }
  assert.match(deliveryGuardProblems({ projectId: 'PR-00001', workItem: pathScopedWorkItem, latestResult, currentCodeState: code, changedPaths: scopePaths, dependencies }).join(' '), /outside deliveryScope/)
  assert.throws(() => deliveryChangedPaths('.', 'HEAD', 'unknown'), /unknown changed-path source/)

  const repo = mkdtempSync(join(tmpdir(), 'vnext-delivery-guard-'))
  try {
    git(['init', '-q'], repo)
    git(['config', 'user.name', 'Self Test'], repo)
    git(['config', 'user.email', 'self-test@example.invalid'], repo)
    writeFileSync(join(repo, 'staged-delete.ts'), 'before\n')
    writeFileSync(join(repo, 'unrelated.ts'), 'before\n')
    git(['add', '.'], repo)
    git(['commit', '-qm', 'base'], repo)
    unlinkSync(join(repo, 'staged-delete.ts'))
    writeFileSync(join(repo, 'unrelated.ts'), 'after\n')
    git(['add', 'staged-delete.ts'], repo)
    assert.deepEqual(deliveryChangedPaths(repo, 'HEAD', 'staged'), ['staged-delete.ts'])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
  console.log('vnext-delivery-guard self-test passed')
}

function main() {
  const json = process.argv.includes('--json')
  const worktree = resolve(option('--worktree') || process.cwd())
  const { config } = resolveRoots({ cwd: worktree })
  const projectId = option('--project') || projectIdFromEnvironment(config) || projectIdForWorktree(worktree, config)
  if (!projectId) {
    const result = { ok: true, applies: false, reason: 'current branch is not associated with a docs-tdd project' }
    console.log(json ? JSON.stringify(result) : `vnext delivery guard: not applicable (${result.reason})`)
    return
  }
  const workflowVersion = workflowVersionForProject(projectId, { resolveProjectRoot })
  if (workflowVersion !== 2) {
    const result = { ok: true, applies: false, projectId, workflowVersion, reason: 'legacy v1 project' }
    console.log(json ? JSON.stringify(result) : `vnext delivery guard: not applicable (${result.reason})`)
    return
  }
  const projectDir = resolveProjectRoot(projectId)
  const workItem = readJson(join(projectDir, 'work-item.json'))
  const latestResult = readJson(join(projectDir, 'latest-result.json'))
  const baseRef = option('--base') || config.baseRef || 'origin/online'
  const changedSource = option('--changed-source') || 'base'
  const commitMode = option('--mode') || process.env.DOCS_TDD_COMMIT_MODE || 'delivery'
  if (!['checkpoint', 'delivery'].includes(commitMode)) throw new Error(`unknown commit mode: ${commitMode}`)
  const baseAvailable = git(['rev-parse', '--verify', `${baseRef}^{commit}`], worktree).status === 0
  const scopePaths = latestResult?.codeFingerprint?.scopeMode === 'path-set-v1' ? latestResult.codeFingerprint.scopePaths : []
  const currentCodeState = codeFingerprint(worktree, baseRef, commitMode === 'delivery' ? { scopePaths } : {})
  const changedPaths = deliveryChangedPaths(worktree, baseRef, changedSource)
  const problems = commitMode === 'checkpoint'
    ? checkpointCommitProblems({ projectId, workItem, currentCodeState, changedPaths, baseAvailable })
    : deliveryGuardProblems({ projectId, workItem, latestResult, currentCodeState, changedPaths, baseAvailable })
  const result = { ok: problems.length === 0, applies: true, projectId, workflowVersion, commitMode, baseRef, changedSource, problems }
  console.log(json ? JSON.stringify(result) : result.ok
    ? `vnext ${commitMode} guard: PASS ${projectId}`
    : `vnext ${commitMode} guard: BLOCK ${projectId}\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  if (!result.ok) process.exitCode = 1
}

if (process.argv.includes('--self-test')) selfTest()
else if (process.argv.includes('--help')) console.log('usage: vnext-delivery-guard.mjs [--project PR-xxxxx] [--worktree <path>] [--base <ref>] [--changed-source base|staged] [--mode checkpoint|delivery] [--json] [--self-test]')
else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
