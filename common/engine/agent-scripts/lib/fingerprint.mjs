// Shared code-state fingerprint used by run-project-gate (gate evidence) and
// docs-tdd context (gate heartbeat). Both consumers MUST hash identically so a
// stored gate fingerprint can be compared against the current worktree state.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function gitValue(args, cwd, fallback = '') {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  return result.status === 0 ? result.stdout.trim() : fallback
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
// headSha covers committed work; dirtyHash covers uncommitted + untracked changes.
export function codeFingerprint(cwd, baseRef = 'origin/online') {
  const headSha = gitValue(['rev-parse', 'HEAD'], cwd)
  const baseSha = gitValue(['rev-parse', baseRef], cwd)
  const dirty = gitValue(['status', '--short', '--untracked-files=all'], cwd)
  const diff = gitValue(['diff', '--binary', baseRef], cwd)
  const untracked = untrackedContentHash(cwd)
  return {
    headSha,
    baseSha,
    dirtyHash: createHash('sha256').update(`${dirty}\n${diff}\n${untracked.hash}`).digest('hex'),
    dirtyFileCount: dirty ? dirty.split('\n').length : 0,
    untrackedFileCount: untracked.count,
    isGitRepo: Boolean(headSha),
  }
}

// True when the worktree code state matches the state recorded in a gate fingerprint.
// Worktree-level (not per-file): any dirty change in the worktree flips dirtyHash.
export function matchesGateFingerprint(current, gateFingerprint) {
  if (!current?.isGitRepo || !gateFingerprint) return false
  return current.headSha === gateFingerprint.headSha && current.dirtyHash === gateFingerprint.dirtyHash
}
