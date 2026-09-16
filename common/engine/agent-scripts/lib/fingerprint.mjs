// Shared code-state fingerprint used by run-project-gate (gate evidence) and
// docs-tdd context (gate heartbeat). Both consumers MUST hash identically so a
// stored gate fingerprint can be compared against the current worktree state.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function positiveIntegerSetting(name, fallback) {
  const value = Number(process.env[name] || fallback)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
  return value
}

const GIT_TIMEOUT_MS = positiveIntegerSetting('DOCS_TDD_FINGERPRINT_GIT_TIMEOUT_MS', 15000)
const HASH_TIMEOUT_MS = positiveIntegerSetting('DOCS_TDD_FINGERPRINT_HASH_TIMEOUT_MS', 30000)
const MAX_HASH_FILES = positiveIntegerSetting('DOCS_TDD_FINGERPRINT_MAX_FILES', 100000)
const MAX_HASH_BYTES = positiveIntegerSetting('DOCS_TDD_FINGERPRINT_MAX_BYTES', 2 * 1024 * 1024 * 1024)

function gitValue(args, cwd, fallback = '', { required = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024, timeout: GIT_TIMEOUT_MS })
  if (result.error) throw new Error(`fingerprint git ${args[0]} failed: ${result.error.code === 'ETIMEDOUT' ? `timed out after ${GIT_TIMEOUT_MS}ms` : result.error.message}`)
  if (result.status !== 0 && required) throw new Error(`fingerprint git ${args[0]} failed: ${(result.stderr || `exit ${result.status}`).trim()}`)
  return result.status === 0 ? result.stdout.trim() : fallback
}

function assertHashFileLimit(files, maxFiles = MAX_HASH_FILES) {
  if (files.length > maxFiles) throw new Error(`fingerprint audit refused ${files.length} files; limit is ${maxFiles} (set DOCS_TDD_FINGERPRINT_MAX_FILES to override)`)
}

function normalizedScopePaths(paths) {
  return [...new Set((paths || []).map(String).filter((path) => path && !isAbsolute(path) && path !== '..' && !path.startsWith('../')))].sort()
}

function effectiveContentHash(cwd, selectedPaths = null, { gitRequired = true } = {}) {
  const files = selectedPaths
    ? normalizedScopePaths(selectedPaths)
    : gitValue(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd, '', { required: gitRequired }).split('\0').filter(Boolean).sort()
  assertHashFileLimit(files)
  const hash = createHash('sha256')
  const deadline = Date.now() + HASH_TIMEOUT_MS
  let totalBytes = 0
  for (const file of files) {
    if (Date.now() > deadline) throw new Error(`fingerprint audit timed out after ${HASH_TIMEOUT_MS}ms (set DOCS_TDD_FINGERPRINT_HASH_TIMEOUT_MS to override)`)
    const absolute = join(cwd, file)
    if (!existsSync(absolute)) {
      hash.update(`${file}\0missing\0`)
      continue
    }
    const stat = lstatSync(absolute)
    totalBytes += stat.size
    if (totalBytes > MAX_HASH_BYTES) throw new Error(`fingerprint audit exceeded ${MAX_HASH_BYTES} bytes while hashing ${files.length} files (set DOCS_TDD_FINGERPRINT_MAX_BYTES to override)`)
    hash.update(`${file}\0${stat.mode & 0o111 ? 'x' : '-'}\0`)
    hash.update(stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function changedCodePaths(cwd, baseRef = 'origin/online') {
  const changed = gitValue(['diff', '--name-only', '-z', baseRef, '--'], cwd, '', { required: true }).split('\0').filter(Boolean)
  const untracked = gitValue(['ls-files', '--others', '--exclude-standard', '-z'], cwd, '', { required: true }).split('\0').filter(Boolean)
  const paths = normalizedScopePaths([...changed, ...untracked])
  assertHashFileLimit(paths)
  return paths
}

export function pendingCodePaths(cwd) {
  const staged = gitValue(['diff', '--cached', '--name-only', '-z', '--'], cwd, '', { required: true }).split('\0').filter(Boolean)
  const unstaged = gitValue(['diff', '--name-only', '-z', '--'], cwd, '', { required: true }).split('\0').filter(Boolean)
  const untracked = gitValue(['ls-files', '--others', '--exclude-standard', '-z'], cwd, '', { required: true }).split('\0').filter(Boolean)
  const paths = normalizedScopePaths([...staged, ...unstaged, ...untracked])
  assertHashFileLimit(paths)
  return paths
}

function untrackedContentHash(cwd, { gitRequired = true } = {}) {
  const files = gitValue(['ls-files', '--others', '--exclude-standard'], cwd, '', { required: gitRequired }).split('\n').filter(Boolean).sort()
  assertHashFileLimit(files)
  const hash = createHash('sha256')
  const deadline = Date.now() + HASH_TIMEOUT_MS
  let totalBytes = 0
  for (const file of files) {
    if (Date.now() > deadline) throw new Error(`fingerprint untracked audit timed out after ${HASH_TIMEOUT_MS}ms (set DOCS_TDD_FINGERPRINT_HASH_TIMEOUT_MS to override)`)
    const absolute = join(cwd, file)
    hash.update(`${file}\0`)
    if (existsSync(absolute)) {
      totalBytes += lstatSync(absolute).size
      if (totalBytes > MAX_HASH_BYTES) throw new Error(`fingerprint untracked audit exceeded ${MAX_HASH_BYTES} bytes (set DOCS_TDD_FINGERPRINT_MAX_BYTES to override)`)
      hash.update(readFileSync(absolute))
    }
    hash.update('\0')
  }
  return { count: files.length, hash: hash.digest('hex') }
}

// Pure code-state identity of a worktree, independent of ruleset/release fingerprints.
// contentHash covers the effective non-ignored file tree and survives a commit that changes
// HEAD/index metadata without changing file bytes. dirtyHash remains for legacy gate compatibility.
export function codeFingerprint(cwd, baseRef = 'origin/online', { scopePaths = null } = {}) {
  const headSha = gitValue(['rev-parse', 'HEAD'], cwd)
  const isGitRepo = Boolean(headSha)
  const baseSha = gitValue(['rev-parse', baseRef], cwd, '', { required: isGitRepo })
  const dirty = gitValue(['status', '--short', '--untracked-files=all'], cwd, '', { required: isGitRepo })
  const diff = gitValue(['diff', '--binary', baseRef], cwd, '', { required: isGitRepo })
  const untracked = untrackedContentHash(cwd, { gitRequired: isGitRepo })
  const normalizedPaths = scopePaths ? normalizedScopePaths(scopePaths) : null
  if (normalizedPaths) assertHashFileLimit(normalizedPaths)
  return {
    headSha,
    baseSha,
    contentHash: effectiveContentHash(cwd, normalizedPaths, { gitRequired: isGitRepo }),
    dirtyHash: createHash('sha256').update(`${dirty}\n${diff}\n${untracked.hash}`).digest('hex'),
    dirtyFileCount: dirty ? dirty.split('\n').length : 0,
    untrackedFileCount: untracked.count,
    isGitRepo,
    ...(normalizedPaths ? { scopeMode: 'path-set-v1', scopePaths: normalizedPaths } : {}),
  }
}

export function matchesEffectiveCodeState(current, recorded) {
  if (recorded?.scopeMode === 'path-set-v1') {
    return current?.scopeMode === 'path-set-v1'
      && JSON.stringify(current.scopePaths || []) === JSON.stringify(recorded.scopePaths || [])
      && Boolean(current.contentHash && current.contentHash === recorded.contentHash)
  }
  if (current?.contentHash && recorded?.contentHash) return current.contentHash === recorded.contentHash
  return Boolean(current?.headSha && current?.dirtyHash && recorded?.headSha && recorded?.dirtyHash
    && current.headSha === recorded.headSha && current.dirtyHash === recorded.dirtyHash)
}

// True when the worktree code state matches the state recorded in a legacy gate fingerprint.
// Worktree-level (not per-file): any dirty change in the worktree flips dirtyHash.
export function matchesGateFingerprint(current, gateFingerprint) {
  if (!current?.isGitRepo || !gateFingerprint) return false
  return current.headSha === gateFingerprint.headSha && current.dirtyHash === gateFingerprint.dirtyHash
}

export function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'docs-tdd-fingerprint-'))
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  try {
    git('init', '-q')
    git('config', 'user.email', 'fixture@example.com')
    git('config', 'user.name', 'Fixture')
    writeFileSync(join(dir, 'relevant.txt'), 'v1\n')
    writeFileSync(join(dir, 'unrelated.txt'), 'v1\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    writeFileSync(join(dir, 'relevant.txt'), 'v2\n')
    const scopePaths = changedCodePaths(dir, 'HEAD')
    assert.deepEqual(scopePaths, ['relevant.txt'])
    assert.deepEqual(pendingCodePaths(dir), ['relevant.txt'])
    const recorded = codeFingerprint(dir, 'HEAD', { scopePaths })
    writeFileSync(join(dir, 'unrelated.txt'), 'v2\n')
    assert.equal(matchesEffectiveCodeState(codeFingerprint(dir, 'HEAD', { scopePaths }), recorded), true)
    git('add', '.')
    git('commit', '-qm', 'commit without changing relevant bytes')
    assert.deepEqual(pendingCodePaths(dir), [])
    assert.equal(matchesEffectiveCodeState(codeFingerprint(dir, 'HEAD', { scopePaths }), recorded), true)
    writeFileSync(join(dir, 'relevant.txt'), 'v3\n')
    assert.equal(matchesEffectiveCodeState(codeFingerprint(dir, 'HEAD', { scopePaths }), recorded), false)
    assert.throws(() => codeFingerprint(dir, 'missing-base-ref'), /fingerprint git rev-parse failed/)
    assert.throws(() => assertHashFileLimit(['a', 'b'], 1), /refused 2 files/)
    console.log('fingerprint scoped self-test passed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
