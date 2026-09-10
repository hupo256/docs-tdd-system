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

function gitValue(args, cwd, fallback = '') {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
  return result.status === 0 ? result.stdout.trim() : fallback
}

function normalizedScopePaths(paths) {
  return [...new Set((paths || []).map(String).filter((path) => path && !isAbsolute(path) && path !== '..' && !path.startsWith('../')))].sort()
}

function effectiveContentHash(cwd, selectedPaths = null) {
  const files = selectedPaths
    ? normalizedScopePaths(selectedPaths)
    : gitValue(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd).split('\0').filter(Boolean).sort()
  const hash = createHash('sha256')
  for (const file of files) {
    const absolute = join(cwd, file)
    if (!existsSync(absolute)) {
      hash.update(`${file}\0missing\0`)
      continue
    }
    const stat = lstatSync(absolute)
    hash.update(`${file}\0${stat.mode & 0o111 ? 'x' : '-'}\0`)
    hash.update(stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute))
    hash.update('\0')
  }
  return hash.digest('hex')
}

export function changedCodePaths(cwd, baseRef = 'origin/online') {
  const changed = gitValue(['diff', '--name-only', '-z', baseRef, '--'], cwd).split('\0').filter(Boolean)
  const untracked = gitValue(['ls-files', '--others', '--exclude-standard', '-z'], cwd).split('\0').filter(Boolean)
  return normalizedScopePaths([...changed, ...untracked])
}

function untrackedContentHash(cwd) {
  const files = gitValue(['ls-files', '--others', '--exclude-standard'], cwd).split('\n').filter(Boolean).sort()
  const hash = createHash('sha256')
  for (const file of files) {
    const absolute = join(cwd, file)
    hash.update(`${file}\0`)
    if (existsSync(absolute)) hash.update(readFileSync(absolute))
    hash.update('\0')
  }
  return { count: files.length, hash: hash.digest('hex') }
}

// Pure code-state identity of a worktree, independent of ruleset/release fingerprints.
// contentHash covers the effective non-ignored file tree and survives a commit that changes
// HEAD/index metadata without changing file bytes. dirtyHash remains for legacy gate compatibility.
export function codeFingerprint(cwd, baseRef = 'origin/online', { scopePaths = null } = {}) {
  const headSha = gitValue(['rev-parse', 'HEAD'], cwd)
  const baseSha = gitValue(['rev-parse', baseRef], cwd)
  const dirty = gitValue(['status', '--short', '--untracked-files=all'], cwd)
  const diff = gitValue(['diff', '--binary', baseRef], cwd)
  const untracked = untrackedContentHash(cwd)
  const normalizedPaths = scopePaths ? normalizedScopePaths(scopePaths) : null
  return {
    headSha,
    baseSha,
    contentHash: effectiveContentHash(cwd, normalizedPaths),
    dirtyHash: createHash('sha256').update(`${dirty}\n${diff}\n${untracked.hash}`).digest('hex'),
    dirtyFileCount: dirty ? dirty.split('\n').length : 0,
    untrackedFileCount: untracked.count,
    isGitRepo: Boolean(headSha),
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
    const recorded = codeFingerprint(dir, 'HEAD', { scopePaths })
    writeFileSync(join(dir, 'unrelated.txt'), 'v2\n')
    assert.equal(matchesEffectiveCodeState(codeFingerprint(dir, 'HEAD', { scopePaths }), recorded), true)
    git('add', '.')
    git('commit', '-qm', 'commit without changing relevant bytes')
    assert.equal(matchesEffectiveCodeState(codeFingerprint(dir, 'HEAD', { scopePaths }), recorded), true)
    writeFileSync(join(dir, 'relevant.txt'), 'v3\n')
    assert.equal(matchesEffectiveCodeState(codeFingerprint(dir, 'HEAD', { scopePaths }), recorded), false)
    console.log('fingerprint scoped self-test passed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
