#!/usr/bin/env node
// 按 docs_tdd commit 读规则内容的不可变快照层。
//
// 业务项目 pin 到某个 docs_tdd commit 后，其 context pack 从该 commit 读规则文档
// （`git show <commit>:<relPath>`），而不是读工作副本。这样规则维护者在工作区编辑
// 下一版规则时，不会污染已 pin 项目正在消费的内容——不可变、零文件拷贝、天然复现。
//
// commit 为空（未 pin / 旧项目过渡期）时回退到工作副本 readFileSync，行为等同改造前。
// pin 了但该 commit 缺该文件 → 抛错，由调用方判为「pinned release 损坏/缺失」硬阻塞。

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { docsSystemRoot } from './roots.mjs'

const cache = new Map()

// root 默认 docsSystemRoot（真实调用零行为差）；回归自测传临时 git 仓根，缓存 key 含 root 避免跨仓串味。
function gitShow(commit, relPath, root = docsSystemRoot) {
  const key = `${root}:${commit}:${relPath}`
  if (cache.has(key)) return cache.get(key)
  const result = spawnSync('git', ['show', `${commit}:${relPath}`], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 32 * 1024 * 1024,
  })
  const value = result.status === 0 ? { ok: true, text: result.stdout } : { ok: false, error: (result.stderr || '').trim() }
  cache.set(key, value)
  return value
}

/** True if `relPath` exists at the pinned commit (or on disk when commit is falsy). */
export function pinnedFileExists({ commit, relPath, root = docsSystemRoot }) {
  if (!commit) return existsSync(join(root, relPath))
  return gitShow(commit, relPath, root).ok
}

/**
 * Read `relPath` as of the pinned commit. Falls back to the working copy when
 * `commit` is falsy (unpinned/legacy). Throws when a pinned commit lacks the file
 * so callers can surface it as a corrupt/missing pinned release.
 */
export function readPinnedFile({ commit, relPath, root = docsSystemRoot }) {
  if (!commit) {
    const abs = join(root, relPath)
    if (!existsSync(abs)) throw new Error(`rule source does not exist: ${relPath}`)
    return readFileSync(abs, 'utf8')
  }
  const shown = gitShow(commit, relPath, root)
  if (!shown.ok) throw new Error(`pinned rule source missing at ${commit.slice(0, 12)}: ${relPath} (${shown.error || 'not found'})`)
  return shown.text
}

/** Resolve the docs_tdd HEAD commit (host-independent). Null when not a git repo. */
export function currentDocsCommit(root = docsSystemRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  return result.status === 0 ? result.stdout.trim() : null
}

// `node lib/pinned-source.mjs --self-test`
if (process.argv[1] && process.argv[1].endsWith('pinned-source.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  const head = currentDocsCommit()
  assert.ok(head && head.length >= 7, 'currentDocsCommit should resolve HEAD')
  // A file that is committed at HEAD reads back identically to the working copy (when clean).
  const relKnown = 'common/engine/agent-scripts/lib/roots.mjs'
  assert.equal(pinnedFileExists({ commit: head, relPath: relKnown }), true)
  const pinned = readPinnedFile({ commit: head, relPath: relKnown })
  assert.ok(pinned.includes('resolveRoots'), 'pinned read returns file content')
  // Missing file at a real commit throws.
  assert.throws(() => readPinnedFile({ commit: head, relPath: 'common/does-not-exist.md' }), /pinned rule source missing/)
  // Falsy commit falls back to the working copy.
  assert.ok(readPinnedFile({ commit: null, relPath: relKnown }).includes('resolveRoots'), 'falsy commit falls back to working copy')
  assert.equal(pinnedFileExists({ commit: null, relPath: 'common/does-not-exist.md' }), false)
  console.log('pinned-source self-test passed.')
}
