// Shared code-state fingerprint used by run-project-gate (gate evidence) and
// docs-tdd context (gate heartbeat). Both consumers MUST hash identically so a
// stored gate fingerprint can be compared against the current worktree state.

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function gitValue(args, cwd, fallback = '') {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
  return result.status === 0 ? result.stdout.trim() : fallback
}

function effectiveContentHash(cwd) {
  const files = gitValue(['ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd).split('\0').filter(Boolean).sort()
  const hash = createHash('sha256')
  for (const file of files) {
    const absolute = join(cwd, file)
    if (!existsSync(absolute)) continue
    const stat = lstatSync(absolute)
    hash.update(`${file}\0${stat.mode & 0o111 ? 'x' : '-'}\0`)
    hash.update(stat.isSymbolicLink() ? readlinkSync(absolute) : readFileSync(absolute))
    hash.update('\0')
  }
  return hash.digest('hex')
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
export function codeFingerprint(cwd, baseRef = 'origin/online') {
  const headSha = gitValue(['rev-parse', 'HEAD'], cwd)
  const baseSha = gitValue(['rev-parse', baseRef], cwd)
  const dirty = gitValue(['status', '--short', '--untracked-files=all'], cwd)
  const diff = gitValue(['diff', '--binary', baseRef], cwd)
  const untracked = untrackedContentHash(cwd)
  return {
    headSha,
    baseSha,
    contentHash: effectiveContentHash(cwd),
    dirtyHash: createHash('sha256').update(`${dirty}\n${diff}\n${untracked.hash}`).digest('hex'),
    dirtyFileCount: dirty ? dirty.split('\n').length : 0,
    untrackedFileCount: untracked.count,
    isGitRepo: Boolean(headSha),
  }
}

export function matchesEffectiveCodeState(current, recorded) {
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
