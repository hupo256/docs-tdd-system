#!/usr/bin/env node
// Git-backed adapter for the pure work-context policy. Write-capable callers use
// this module so branch, dirty-path, scope, and existing-file checks stay identical.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pendingCodePaths } from './fingerprint.mjs'
import { deliveryPolicyPaths } from './vnext-delivery-scope.mjs'
import { checkWritePaths, normalizeRepositoryPath, resolveWorkContext } from './vnext-work-context.mjs'

function git(worktree, args, spawn = spawnSync, { required = true } = {}) {
  const result = spawn('git', args, { cwd: worktree, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0 && required) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim())
  }
  return result.status === 0 ? (result.stdout || '').trim() : ''
}

function commonRepositoryRoot(worktree, spawn = spawnSync) {
  const common = git(worktree, ['rev-parse', '--git-common-dir'], spawn)
  const absolute = isAbsolute(common) ? common : resolve(worktree, common)
  return dirname(absolute)
}

function pathMatches(path, candidates) {
  return candidates.some((candidate) => path === candidate || path.startsWith(`${candidate}/`))
}

function currentOwner(projectId, actionId = '') {
  return actionId ? `agent:${projectId}:${actionId}` : `agent:${projectId}`
}

function approvedPaths(workItem, targetPaths) {
  const policyPaths = deliveryPolicyPaths(workItem)
  if (policyPaths.length) return { paths: policyPaths, source: 'delivery-policy' }
  const recorded = (workItem?.autopilot?.implementation?.changedPaths || []).map(normalizeRepositoryPath).filter(Boolean)
  if (recorded.length) return { paths: [...new Set(recorded)].sort(), source: 'implementation-checkpoint' }
  return { paths: [...new Set(targetPaths)].sort(), source: 'current-action' }
}

function existingPathRecords(worktree, targetPaths, owner, taskId, actionId) {
  return targetPaths
    .filter((path) => existsSync(join(worktree, path)))
    .map((path) => ({ path, owner, taskId, actionId }))
}

export function collectWorkContextFacts({
  projectId,
  workItem,
  worktree,
  baseRef,
  commitMode,
  targetPaths = [],
  actionId = '',
  operation = 'write',
  spawn = spawnSync,
} = {}) {
  const absoluteWorktree = realpathSync(resolve(worktree))
  const top = realpathSync(resolve(git(absoluteWorktree, ['rev-parse', '--show-toplevel'], spawn)))
  if (top !== absoluteWorktree) throw new Error(`worktree must be a git toplevel: ${absoluteWorktree}`)
  const normalizedTargets = [...new Set(targetPaths.map(normalizeRepositoryPath).filter(Boolean))].sort()
  const owner = currentOwner(projectId, actionId)
  const scope = approvedPaths(workItem, normalizedTargets)
  const ownedPaths = new Set([
    ...normalizedTargets,
    ...(workItem?.autopilot?.implementation?.changedPaths || []).map(normalizeRepositoryPath),
    ...(workItem?.autopilot?.checkpointCommit?.paths || []).map(normalizeRepositoryPath),
  ])
  const dirtyPaths = pendingCodePaths(absoluteWorktree).map((path) => ({
    path,
    owner: pathMatches(path, [...ownedPaths].filter(Boolean)) ? owner : '',
    taskId: projectId,
    actionId: pathMatches(path, normalizedTargets) ? actionId : '',
  }))
  const consumerRepo = commonRepositoryRoot(absoluteWorktree, spawn)
  const branch = git(absoluteWorktree, ['branch', '--show-current'], spawn)
  const headSha = git(absoluteWorktree, ['rev-parse', 'HEAD'], spawn)
  const worktreeKind = resolve(consumerRepo) === absoluteWorktree ? 'existing' : 'isolated'
  const context = {
    projectId,
    workflowVersion: workItem?.workflowVersion,
    consumerRepo,
    worktree: absoluteWorktree,
    worktreeKind,
    branch,
    baseRef,
    currentHeadSha: headSha,
    targetApp: workItem?.deliveryTarget?.app || '',
    commitMode,
    operation,
    owner,
    taskId: projectId,
    actionId,
    approvedScope: scope.paths.map((path) => ({ path, owner })),
    scopeOwner: owner,
    targetPaths: normalizedTargets.map((path) => ({
      path,
      owner,
      mode: existsSync(join(absoluteWorktree, path)) ? 'edit' : 'create',
    })),
    existingFiles: existingPathRecords(absoluteWorktree, normalizedTargets, owner, projectId, actionId),
    dirtyPaths,
    allowExistingFiles: true,
  }
  return { ...context, scopeSource: scope.source }
}

export function inspectSafeWorkContext(input = {}) {
  const facts = collectWorkContextFacts(input)
  const context = resolveWorkContext(facts)
  const writes = facts.targetPaths.length ? checkWritePaths(facts) : { ok: true, paths: [], problems: [] }
  const problems = [...new Set([...context.problems, ...writes.problems])]
  return {
    ok: problems.length === 0,
    projectId: facts.projectId,
    worktree: facts.worktree,
    branch: facts.branch,
    baseRef: facts.baseRef,
    headSha: facts.currentHeadSha,
    owner: facts.owner,
    worktreeKind: facts.worktreeKind,
    scopeSource: facts.scopeSource,
    approvedScope: facts.approvedScope.map((entry) => entry.path),
    targetPaths: facts.targetPaths.map((entry) => entry.path),
    dirtyPaths: facts.dirtyPaths,
    context,
    writes,
    problems,
  }
}

export function assertSafeWorkContext(input = {}) {
  const inspection = inspectSafeWorkContext(input)
  if (!inspection.ok) throw new Error(`unsafe work context for ${inspection.projectId}:\n- ${inspection.problems.join('\n- ')}`)
  return inspection
}

function runGit(repo, args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`)
}

export function selfTest() {
  const repo = mkdtempSync(join(tmpdir(), 'vnext-work-context-runtime-'))
  try {
    runGit(repo, ['init', '-q'])
    runGit(repo, ['config', 'user.name', 'Self Test'])
    runGit(repo, ['config', 'user.email', 'self-test@example.invalid'])
    writeFileSync(join(repo, 'owned.ts'), 'before\n')
    writeFileSync(join(repo, 'foreign.ts'), 'before\n')
    runGit(repo, ['add', '.'])
    runGit(repo, ['commit', '-qm', 'base'])
    runGit(repo, ['checkout', '-qb', 'feature/PR-00001'])
    writeFileSync(join(repo, 'owned.ts'), 'after\n')
    const workItem = {
      workflowVersion: 2,
      projectId: 'PR-00001',
      deliveryScope: { policyPaths: ['owned.ts'] },
      autopilot: { implementation: { changedPaths: ['owned.ts'] } },
    }
    const safe = inspectSafeWorkContext({
      projectId: 'PR-00001',
      workItem,
      worktree: repo,
      baseRef: 'HEAD~0',
      commitMode: 'checkpoint',
      actionId: 'A-1',
      targetPaths: ['owned.ts'],
    })
    assert.equal(safe.ok, true, safe.problems.join('; '))
    assert.equal(safe.scopeSource, 'delivery-policy')

    runGit(repo, ['checkout', '-q', '-b', 'dev'])
    const environment = inspectSafeWorkContext({
      projectId: 'PR-00001',
      workItem,
      worktree: repo,
      baseRef: 'HEAD',
      commitMode: 'checkpoint',
      actionId: 'A-1',
      targetPaths: ['owned.ts'],
    })
    assert.equal(environment.ok, false)
    assert.match(environment.problems.join(' '), /write-protected/)

    runGit(repo, ['checkout', '-q', 'feature/PR-00001'])
    writeFileSync(join(repo, 'foreign.ts'), 'after\n')
    const foreign = inspectSafeWorkContext({
      projectId: 'PR-00001',
      workItem,
      worktree: repo,
      baseRef: 'HEAD',
      commitMode: 'checkpoint',
      actionId: 'A-1',
      targetPaths: ['owned.ts'],
    })
    assert.equal(foreign.ok, false)
    assert.match(foreign.problems.join(' '), /unowned dirty/)

    assert.throws(() => assertSafeWorkContext({
      projectId: 'PR-00001',
      workItem,
      worktree: repo,
      baseRef: 'HEAD',
      commitMode: 'checkpoint',
      actionId: 'A-1',
      targetPaths: ['../outside.ts'],
    }), /traversal|outside approved scope/)
    console.log('vnext-work-context-runtime self-test passed')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
