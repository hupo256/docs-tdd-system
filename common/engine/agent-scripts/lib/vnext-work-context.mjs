#!/usr/bin/env node

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const ENVIRONMENT_BRANCHES = new Set(['online', 'pre', 'test', 'dev'])
const WRITE_COMMIT_MODES = new Set(['checkpoint', 'local-commit', 'delivery-commit', 'no-commit'])
const WORKTREE_KINDS = new Set(['existing', 'isolated'])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function identity(value) {
  if (typeof value === 'string') return text(value)
  if (value && typeof value === 'object') return text(value.id || value.ownerId || value.name)
  return ''
}

function firstText(...values) {
  return values.map(text).find(Boolean) || ''
}

function normalizeBranch(branch) {
  return firstText(branch).replace(/^refs\/heads\//, '').replace(/^origin\//, '')
}

/**
 * Keep repository-relative path syntax visible so callers can reject traversal
 * instead of normalizing `a/../b` into an apparently safe path.
 */
export function normalizeRepositoryPath(path) {
  return firstText(path).replaceAll('\\', '/').replace(/^(\.\/)+/, '').replace(/\/+/g, '/').replace(/\/$/, '')
}

function repositoryPathProblem(path) {
  const raw = firstText(path).replaceAll('\\', '/')
  const normalized = normalizeRepositoryPath(raw)
  if (!normalized) return 'path is missing'
  if (normalized.startsWith('/') || normalized.startsWith('//') || /^[A-Za-z]:\//.test(normalized)) return 'path must be repository-relative'
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../') || normalized.endsWith('/..')) {
    return 'path traversal is not allowed'
  }
  if (normalized.split('/').includes('..')) return 'path traversal is not allowed'
  return ''
}

export function isEnvironmentBranch(branch) {
  return ENVIRONMENT_BRANCHES.has(normalizeBranch(branch))
}

function isReadOnly(input) {
  return input?.readOnly === true || input?.operation === 'read' || input?.commitMode === 'read-only'
}

function recordPath(record) {
  if (typeof record === 'string') return record
  if (!record || typeof record !== 'object') return ''
  return firstText(record.path, record.file, record.filePath, record.target)
}

function pathRecord(record) {
  return {
    path: normalizeRepositoryPath(recordPath(record)),
    owner: identity(record && typeof record === 'object' ? record.owner || record.ownerId : ''),
    taskId: firstText(record && typeof record === 'object' ? record.taskId : ''),
    actionId: firstText(record && typeof record === 'object' ? record.actionId : ''),
    mode: firstText(record && typeof record === 'object' ? record.mode || record.operation : ''),
  }
}

function pathRecords(value, label, problems) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    problems.push(`${label} must be an array`)
    return []
  }
  return value.map((record) => {
    const parsed = pathRecord(record)
    if (!parsed.path) problems.push(`${label} contains a path-less record`)
    return parsed
  })
}

function scopeRecords(input, problems) {
  const rawScope = input?.approvedScope ?? input?.scope ?? input?.policyPaths
  if (!Array.isArray(rawScope) || rawScope.length === 0) {
    problems.push('approved scope is required')
    return []
  }

  const defaultOwner = identity(input.scopeOwner)
  const records = rawScope.map((entry) => {
    const path = normalizeRepositoryPath(recordPath(entry))
    const owner = identity(entry && typeof entry === 'object' ? entry.owner || entry.ownerId : defaultOwner)
    return { path, owner }
  })

  const seen = new Set()
  for (const record of records) {
    const syntaxProblem = repositoryPathProblem(record.path)
    if (syntaxProblem) problems.push(`approved scope ${record.path || '(missing)'}: ${syntaxProblem}`)
    if (!record.owner) problems.push(`approved scope ${record.path || '(missing)'} has no owner`)
    if (seen.has(record.path)) problems.push(`approved scope contains duplicate path: ${record.path}`)
    seen.add(record.path)
  }
  return records
}

function pathInScope(path, scope) {
  return scope.some((entry) => path === entry.path || path.startsWith(`${entry.path}/`))
}

function matchingScope(path, scope) {
  return scope
    .filter((entry) => path === entry.path || path.startsWith(`${entry.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0]
}

function matchingPathRecord(path, records) {
  return records.filter((record) => record.path === path)
}

function ownerMatches(record, owner) {
  return Boolean(record?.owner) && record.owner === owner
}

function contextProblems(input, { allowReadOnlyEnvironment = true } = {}) {
  const problems = []
  const readOnly = isReadOnly(input)
  const branch = normalizeBranch(input?.branch)
  const worktree = firstText(input?.worktree, input?.cwd)
  const consumerRepo = firstText(input?.consumerRepo, input?.repoRoot, input?.repo)
  const baseRef = firstText(input?.baseRef)
  const owner = identity(input?.owner || input?.ownerId)
  const commitMode = firstText(input?.commitMode)
  const worktreeKind = firstText(input?.worktreeKind)

  if (!consumerRepo) problems.push('consumer repo is required')
  if (!worktree) problems.push('worktree is required')
  if (!branch) problems.push('branch is required')
  if (!baseRef) problems.push('baseRef is required')
  if (!readOnly && !owner) problems.push('owner is required for write context')
  if (!commitMode) problems.push('commitMode is required')
  if (readOnly) {
    if (commitMode && commitMode !== 'read-only') problems.push('read-only context cannot use a write commitMode')
  } else if (!WRITE_COMMIT_MODES.has(commitMode)) {
    problems.push(`unsupported write commitMode: ${commitMode || '(missing)'}`)
  }
  if (worktreeKind && !WORKTREE_KINDS.has(worktreeKind)) problems.push(`unsupported worktreeKind: ${worktreeKind}`)
  if (!worktreeKind) problems.push('worktreeKind is required')

  if (isEnvironmentBranch(branch) && !(readOnly && allowReadOnlyEnvironment)) {
    problems.push(`environment branch is write-protected: ${branch}`)
  }
  return { problems, readOnly, branch, worktree, consumerRepo, baseRef, owner, commitMode, worktreeKind }
}

function dirtyPathRecords(input, problems) {
  return pathRecords(input?.dirtyPaths ?? input?.currentWip, 'dirtyPaths', problems)
}

function unownedDirtyPaths(records, owner) {
  return [...new Set(records.filter((record) => !ownerMatches(record, owner)).map((record) => record.path).filter(Boolean))].sort()
}

function suggestedBranch(input) {
  const projectId = firstText(input?.projectId).toUpperCase()
  if (!projectId) return ''
  const changeKind = firstText(input?.changeKind, input?.requestKind, input?.kind)
  return `${['bugfix', 'bug', 'fix'].includes(changeKind) ? 'fix' : 'feature'}/${projectId}`
}

/**
 * Resolve only from supplied facts. Creating a branch/worktree and querying Git
 * remain the responsibility of an outer runner; this function never performs
 * those side effects.
 */
export function resolveWorkContext(input = {}) {
  const facts = contextProblems(input)
  const dirtyProblems = []
  const dirtyPaths = dirtyPathRecords(input, dirtyProblems)
  const unowned = unownedDirtyPaths(dirtyPaths, facts.owner)
  const problems = [...facts.problems, ...dirtyProblems]
  const readOnly = facts.readOnly
  const requiresIsolation = unowned.length > 0

  if (!readOnly && requiresIsolation) {
    problems.push(`unowned dirty paths require an isolated worktree: ${unowned.join(', ')}`)
  }

  const isolated = facts.worktreeKind === 'isolated'
  const mode = problems.length
    ? 'blocked'
    : readOnly
      ? 'read-only'
      : isolated
        ? 'isolated-worktree'
        : 'existing-worktree'

  return {
    ok: problems.length === 0,
    mode,
    projectId: firstText(input.projectId),
    consumerRepo: facts.consumerRepo,
    worktree: facts.worktree,
    branch: facts.branch,
    baseRef: facts.baseRef,
    currentHeadSha: firstText(input.currentHeadSha, input.headSha),
    targetApp: firstText(input.targetApp, input.app),
    workflowVersion: input.workflowVersion ?? null,
    commitMode: facts.commitMode,
    owner: facts.owner,
    worktreeKind: facts.worktreeKind,
    isEnvironmentBranch: isEnvironmentBranch(facts.branch),
    requiresIsolation,
    suggestedBranch: suggestedBranch(input),
    dirtyPaths,
    unownedDirtyPaths: unowned,
    problems,
  }
}

function existingPathRecords(input, problems) {
  return pathRecords(input?.existingFiles ?? input?.existingPaths, 'existingFiles', problems)
}

function targetPathRecords(input, problems) {
  const rawTargets = input?.targetPaths ?? input?.paths ?? input?.writes
  if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
    problems.push('target paths are required')
    return []
  }
  return rawTargets.map((record) => {
    const parsed = pathRecord(record)
    if (!parsed.path) problems.push('target paths contains a path-less record')
    return parsed
  })
}

function pathOwnerFrom(input, path, scopeEntry) {
  const pathOwners = input?.pathOwners
  if (Array.isArray(pathOwners)) {
    const record = pathOwners.map(pathRecord).find((entry) => entry.path === path)
    if (record?.owner) return record.owner
  } else if (pathOwners && typeof pathOwners === 'object') {
    const owner = identity(pathOwners[path])
    if (owner) return owner
  }
  return scopeEntry?.owner || ''
}

/**
 * Check a proposed write before any file operation. The result is pure data:
 * callers must stop on `ok: false` and must not turn a failure into a write.
 */
export function checkWritePaths(input = {}) {
  const context = contextProblems(input, { allowReadOnlyEnvironment: false })
  const problems = [...context.problems]
  if (context.readOnly) problems.push('read-only context cannot write')
  const scope = scopeRecords(input, problems)
  const targets = targetPathRecords(input, problems)
  const existingFiles = existingPathRecords(input, problems)
  const dirtyPaths = dirtyPathRecords(input, problems)
  const owner = context.owner
  const targetDetails = []
  const seenTargets = new Set()

  for (const target of targets) {
    const syntaxProblem = repositoryPathProblem(target.path)
    if (syntaxProblem) {
      problems.push(`target ${target.path || '(missing)'}: ${syntaxProblem}`)
      continue
    }
    if (seenTargets.has(target.path)) {
      problems.push(`target paths contains duplicate path: ${target.path}`)
      continue
    }
    seenTargets.add(target.path)

    const scopeEntry = matchingScope(target.path, scope)
    if (!scopeEntry) {
      problems.push(`target is outside approved scope: ${target.path}`)
      continue
    }
    const targetOwner = target.owner || pathOwnerFrom(input, target.path, scopeEntry)
    if (!targetOwner) problems.push(`target has no owner: ${target.path}`)
    else if (targetOwner !== owner) problems.push(`target owner does not match current owner: ${target.path}`)

    const existing = matchingPathRecord(target.path, existingFiles)[0]
    const dirty = matchingPathRecord(target.path, dirtyPaths)
    const foreignDirty = dirty.filter((record) => !ownerMatches(record, owner))
    if (foreignDirty.length) {
      problems.push(`target overlaps unowned dirty path: ${target.path}`)
    }

    if (existing) {
      const editMode = target.mode === 'edit'
      const explicitEdit = input.allowExistingFiles === true || target.allowExisting === true
      if (!explicitEdit || !editMode) {
        problems.push(`existing file requires explicit edit approval: ${target.path}`)
      }
      if (!ownerMatches(existing, owner)) {
        problems.push(`existing file owner is missing or different: ${target.path}`)
      }
      if (input.taskId && existing.taskId && existing.taskId !== input.taskId) {
        problems.push(`existing file belongs to another task: ${target.path}`)
      }
      if (input.actionId && existing.actionId && existing.actionId !== input.actionId) {
        problems.push(`existing file belongs to another action: ${target.path}`)
      }
    }

    targetDetails.push({
      path: target.path,
      mode: existing ? 'existing-file' : 'new-file',
      approvedScope: scopeEntry.path,
      owner: targetOwner,
      existing: Boolean(existing),
    })
  }

  return {
    ok: problems.length === 0,
    worktree: context.worktree,
    branch: context.branch,
    owner,
    paths: targetDetails,
    problems,
  }
}

export function writePathProblems(input = {}) {
  return checkWritePaths(input).problems
}

export function selfTest() {
  const base = {
    consumerRepo: '/repo/fameex-web',
    worktree: '/repo/PR-00001',
    branch: 'feature/PR-00001',
    baseRef: 'origin/online',
    worktreeKind: 'isolated',
    commitMode: 'local-commit',
    owner: 'agent:task-1',
    scopeOwner: 'agent:task-1',
    approvedScope: ['apps/web/src/feature'],
  }

  assert.equal(isEnvironmentBranch('online'), true)
  assert.equal(isEnvironmentBranch('refs/heads/dev'), true)
  assert.equal(isEnvironmentBranch('feature/online'), false)
  assert.equal(normalizeRepositoryPath('./apps\\web/src/'), 'apps/web/src')
  assert.equal(normalizeRepositoryPath('../escape'), '../escape')

  const resolved = resolveWorkContext(base)
  assert.equal(resolved.ok, true)
  assert.equal(resolved.mode, 'isolated-worktree')
  assert.equal(resolved.requiresIsolation, false)

  const environment = resolveWorkContext({ ...base, branch: 'online' })
  assert.equal(environment.ok, false)
  assert.match(environment.problems.join(' '), /write-protected/)

  const missingContext = resolveWorkContext({ ...base, branch: '' })
  assert.equal(missingContext.ok, false)
  assert.match(missingContext.problems.join(' '), /branch is required/)

  const dirtyContext = resolveWorkContext({
    ...base,
    worktreeKind: 'existing',
    dirtyPaths: [{ path: 'apps/web/src/feature/owned.ts', owner: 'human:other' }],
  })
  assert.equal(dirtyContext.ok, false)
  assert.equal(dirtyContext.requiresIsolation, true)

  const goodNewFile = checkWritePaths({
    ...base,
    targetPaths: [{ path: 'apps/web/src/feature/new.ts', mode: 'create' }],
  })
  assert.equal(goodNewFile.ok, true)
  assert.equal(goodNewFile.paths[0].mode, 'new-file')

  const outsideScope = checkWritePaths({
    ...base,
    targetPaths: [{ path: 'apps/web/src/other/new.ts', mode: 'create' }],
  })
  assert.equal(outsideScope.ok, false)
  assert.match(outsideScope.problems.join(' '), /outside approved scope/)

  const unsafePaths = checkWritePaths({
    ...base,
    targetPaths: [
      { path: '/tmp/outside.ts', mode: 'create' },
      { path: '../outside.ts', mode: 'create' },
    ],
  })
  assert.equal(unsafePaths.ok, false)
  assert.match(unsafePaths.problems.join(' '), /repository-relative|traversal/)

  const existingFile = {
    path: 'apps/web/src/feature/existing.ts',
    owner: 'agent:task-1',
    taskId: 'task-1',
  }
  const overwriteDenied = checkWritePaths({
    ...base,
    existingFiles: [existingFile],
    targetPaths: [{ path: existingFile.path, mode: 'edit' }],
  })
  assert.equal(overwriteDenied.ok, false)
  assert.match(overwriteDenied.problems.join(' '), /explicit edit approval/)

  const overwriteAllowed = checkWritePaths({
    ...base,
    taskId: 'task-1',
    allowExistingFiles: true,
    existingFiles: [existingFile],
    targetPaths: [{ path: existingFile.path, mode: 'edit' }],
  })
  assert.equal(overwriteAllowed.ok, true)
  assert.equal(overwriteAllowed.paths[0].mode, 'existing-file')

  const foreignDirty = checkWritePaths({
    ...base,
    dirtyPaths: [{ path: 'apps/web/src/feature/existing.ts', owner: 'human:other' }],
    targetPaths: [{ path: 'apps/web/src/feature/existing.ts', mode: 'create' }],
  })
  assert.equal(foreignDirty.ok, false)
  assert.match(foreignDirty.problems.join(' '), /unowned dirty path/)

  const readOnly = checkWritePaths({
    ...base,
    readOnly: true,
    commitMode: 'read-only',
    targetPaths: [{ path: 'apps/web/src/feature/new.ts', mode: 'create' }],
  })
  assert.equal(readOnly.ok, false)
  assert.match(readOnly.problems.join(' '), /write-protected|read-only/)

  console.log('vnext-work-context self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) {
  selfTest()
}
