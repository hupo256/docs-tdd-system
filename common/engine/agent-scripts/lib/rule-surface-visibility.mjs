#!/usr/bin/env node
// RULE-SURFACE-VISIBLE 的软链豁免判定（从 effective-rules.mjs 抽出的纯逻辑，便于 --self-test 直测）。
//
// doctor 默认把「被 skip-worktree 藏起来的 tracked rule surface」判为 error（防有人偷偷隐藏规则改动）。
// 唯一被认可的例外：该条目是一条**指向规范 L1 源**的软链（如 CLAUDE.md → ~/.claude/*.CLAUDE.md、
// AGENTS.md → ~/.codex/*）。见 memory edit-claude-md-via-ai-rules-agent：把 tracked 的 L1 入口软链到
// 其家目录规范源是本地约定，而软链要保持 git 干净就必须 skip-worktree。窄豁免——只放行
// 「软链且目标落在给定 L1 家目录下」，任意其它 skip-worktree 隐藏仍 fail-closed。

import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { sep } from 'node:path'

/**
 * True when `abs` is a symlink whose resolved target lives under one of `l1Roots`
 * (the canonical L1 home dirs: ~/.ai-rules, ~/.codex, ~/.claude). Broken links,
 * plain files, and links pointing outside the roots return false (stay flagged).
 */
export function isCanonicalL1Symlink(abs, l1Roots = []) {
  try {
    if (!lstatSync(abs).isSymbolicLink()) return false
    const target = realpathSync(abs)
    // roots 也规范化：家目录或 tmpdir 本身可能经软链（macOS /tmp -> /private/var/...），否则 startsWith 落空。
    const canonicalRoots = l1Roots.filter(Boolean).map((root) => (existsSync(root) ? realpathSync(root) : root))
    return canonicalRoots.some((root) => target === root || target.startsWith(`${root}${sep}`))
  } catch {
    return false // 断链/无法解析：不豁免，仍按隐藏处理
  }
}

// `node lib/rule-surface-visibility.mjs --self-test`
if (process.argv[1] && process.argv[1].endsWith('rule-surface-visibility.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  const { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const fixture = mkdtempSync(join(tmpdir(), 'rule-surface-visibility-'))
  try {
    const l1Root = join(fixture, 'l1')
    mkdirSync(join(l1Root, 'nested'), { recursive: true })
    const l1Target = join(l1Root, 'nested', 'CLAUDE.md')
    writeFileSync(l1Target, 'canonical L1\n')
    const sanctioned = join(fixture, 'CLAUDE.md')
    symlinkSync(l1Target, sanctioned)
    assert.equal(isCanonicalL1Symlink(sanctioned, [l1Root]), true) // 软链→L1 家目录：豁免
    const outside = join(fixture, 'outside.md')
    writeFileSync(outside, 'x\n')
    const strayLink = join(fixture, 'AGENTS.md')
    symlinkSync(outside, strayLink)
    assert.equal(isCanonicalL1Symlink(strayLink, [l1Root]), false) // 软链但目标在 L1 之外：不豁免
    const plainFile = join(fixture, 'plain.md')
    writeFileSync(plainFile, 'x\n')
    assert.equal(isCanonicalL1Symlink(plainFile, [l1Root]), false) // 普通文件被 skip-worktree：不豁免
    const brokenLink = join(fixture, 'broken.md')
    symlinkSync(join(fixture, 'does-not-exist'), brokenLink)
    assert.equal(isCanonicalL1Symlink(brokenLink, [l1Root]), false) // 断链：不豁免
    assert.equal(isCanonicalL1Symlink(sanctioned, []), false) // 无 L1 根：无从豁免
    console.log('rule-surface-visibility self-test passed.')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}
