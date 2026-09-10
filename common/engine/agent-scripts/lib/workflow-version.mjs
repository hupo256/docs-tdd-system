#!/usr/bin/env node

// v1/v2 判定的单一实现：docs-tdd.mjs 的 workflowVersion(id) 与
// project-status-report.mjs 的同名逻辑都改为调用这里，避免第三份实现漂移。
// 判定不出来（无法解析 projectId、README 缺字段且无 work-item.json）一律返回 1（fail-safe 走 v1 现状）。

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  return result.status === 0 ? result.stdout.trim() : ''
}

export function projectIdFromBranch(branch, config = {}) {
  if (typeof branch !== 'string' || !branch.trim()) return null
  const branchPrefix = config.branchPrefix || 'feature/'
  const projectIdPattern = config.projectIdPattern || 'PR-\\d{5}'
  const idRe = new RegExp(projectIdPattern)
  for (const prefix of [branchPrefix, 'fix/']) {
    if (branch.startsWith(prefix)) {
      const match = branch.slice(prefix.length).match(idRe)
      if (match) return match[0]
    }
  }
  const bareMatch = branch.match(idRe)
  return bareMatch ? bareMatch[0] : null
}

export function workflowVersionForProject(projectId, { resolveProjectRoot }) {
  if (!projectId) return 1
  let projectRoot
  try {
    projectRoot = resolveProjectRoot(projectId)
  } catch {
    return 1
  }
  const readmeFile = join(projectRoot, 'README.md')
  if (existsSync(readmeFile)) {
    const value = readFileSync(readmeFile, 'utf8').match(/^workflowVersion:\s*(\d+)$/m)?.[1]
    if (value) return Number(value)
  }
  return existsSync(join(projectRoot, 'work-item.json')) ? 2 : 1
}

export function projectIdForWorktree(worktree, config) {
  if (!worktree) return null
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], worktree)
  return projectIdFromBranch(branch, config)
}

// 从 worktree 的当前分支剥出 projectId，再判定其 workflowVersion。判定不出来一律返回 1。
export function workflowVersionForWorktree(worktree, config, { resolveProjectRoot }) {
  const projectId = projectIdForWorktree(worktree, config)
  if (!projectId) return 1
  return workflowVersionForProject(projectId, { resolveProjectRoot })
}

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`workflow-version self-test failed: ${message}`)
  }
  assert(projectIdFromBranch('feature/PR-01234-foo', {}) === 'PR-01234', 'feature/ prefix extraction')
  assert(projectIdFromBranch('fix/PR-05678-bar', {}) === 'PR-05678', 'fix/ prefix extraction')
  assert(projectIdFromBranch('main', {}) === null, 'unrelated branch yields no projectId')
  assert(projectIdFromBranch('release/PR-09999', {}) === 'PR-09999', 'bare pattern fallback')
  assert(projectIdFromBranch(null, {}) === null, 'non-string branch is safe')

  assert(workflowVersionForProject(null, { resolveProjectRoot: () => '/unused' }) === 1, 'no projectId defaults to v1')
  assert(workflowVersionForProject('PR-does-not-exist', { resolveProjectRoot: () => { throw new Error('missing') } }) === 1, 'unresolvable project root defaults to v1')
  assert(workflowVersionForWorktree(null, {}, { resolveProjectRoot: () => '/unused' }) === 1, 'missing worktree defaults to v1')

  const root = mkdtempSync(join(tmpdir(), 'docs-tdd-workflow-version-'))
  try {
    const v2Project = join(root, 'PR-11111')
    mkdirSync(v2Project, { recursive: true })
    writeFileSync(join(v2Project, 'README.md'), '---\nworkflowVersion: 2\n---\n')
    const v1Project = join(root, 'PR-22222')
    mkdirSync(v1Project, { recursive: true })
    writeFileSync(join(v1Project, 'README.md'), '---\nworkflowVersion: 1\n---\n')
    const inferredV2Project = join(root, 'PR-33333')
    mkdirSync(inferredV2Project, { recursive: true })
    writeFileSync(join(inferredV2Project, 'work-item.json'), '{}')
    const undeclaredProject = join(root, 'PR-44444')
    mkdirSync(undeclaredProject, { recursive: true })
    const resolveProjectRoot = (id) => join(root, id)

    assert(workflowVersionForProject('PR-11111', { resolveProjectRoot }) === 2, 'explicit workflowVersion: 2 read from README frontmatter')
    assert(workflowVersionForProject('PR-22222', { resolveProjectRoot }) === 1, 'explicit workflowVersion: 1 read from README frontmatter')
    assert(workflowVersionForProject('PR-33333', { resolveProjectRoot }) === 2, 'missing README field falls back to work-item.json presence')
    assert(workflowVersionForProject('PR-44444', { resolveProjectRoot }) === 1, 'no README field and no work-item.json defaults to v1')

    spawnSync('git', ['init', '-q'], { cwd: root })
    spawnSync('git', ['config', 'user.email', 'self-test@example.invalid'], { cwd: root })
    spawnSync('git', ['config', 'user.name', 'Self Test'], { cwd: root })
    writeFileSync(join(root, 'a.txt'), 'x\n')
    spawnSync('git', ['add', 'a.txt'], { cwd: root })
    spawnSync('git', ['commit', '-qm', 'initial'], { cwd: root })
    spawnSync('git', ['checkout', '-qb', 'feature/PR-11111-thing'], { cwd: root })
    assert(workflowVersionForWorktree(root, {}, { resolveProjectRoot }) === 2, 'worktree on a feature/<id> branch resolves that project version')
    spawnSync('git', ['checkout', '-qb', 'main-unrelated'], { cwd: root })
    assert(workflowVersionForWorktree(root, {}, { resolveProjectRoot }) === 1, 'branch with no extractable projectId defaults to v1')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  void existsSync
  console.log('PASS workflow-version (branch parsing and fail-safe defaults)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
