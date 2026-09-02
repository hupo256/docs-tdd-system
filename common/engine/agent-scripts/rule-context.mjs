#!/usr/bin/env node

import { renderRuleContext, resolveRulePack } from './lib/l2-rule-resolver.mjs'
import { loadConfig } from './lib/roots.mjs'
import { readLedger, resolveGitWorktree, verifyWorktreeConsumption } from './lib/rule-consumption.mjs'

const args = process.argv.slice(2)
const command = args[0]
const value = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}
const values = (name) => args.flatMap((item, index) => (item === name && args[index + 1] ? [args[index + 1]] : []))
const worktree = resolveGitWorktree(value('--worktree') || process.cwd())
if (!worktree) throw new Error('not inside a git worktree')
const { config } = loadConfig({ cwd: worktree, consumerWorktree: worktree })
const conflictOverrides = config.ruleConflictOverrides || []

if (command === 'resolve') {
  const files = values('--file')
  const pack = resolveRulePack({
    worktree,
    targetFiles: files,
    conflictOverrides,
  })
  const rendered = renderRuleContext(pack)
  const output = {
    worktree: pack.worktree,
    targets: pack.targets,
    fingerprint: pack.fingerprint,
    byteLength: rendered.byteLength,
    unscopedRules: pack.unscopedRules,
    rules: pack.matchedRules.map((rule) => ({
      path: rule.relativePath,
      sourceHash: rule.sourceHash,
      bodyHash: rule.bodyHash,
      matches: rule.matches,
    })),
    conflictOverrides: pack.conflictOverrides,
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
} else if (command === 'status') {
  const sessionId = value('--session-id') || process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID
  process.stdout.write(`${JSON.stringify(readLedger(worktree, sessionId), null, 2)}\n`)
} else if (command === 'verify') {
  const sessionId = value('--session-id') || process.env.CODEX_THREAD_ID || process.env.CLAUDE_SESSION_ID
  const client = value('--client') || (process.env.CODEX_THREAD_ID ? 'codex' : 'claude')
  const result = verifyWorktreeConsumption({
    worktree,
    sessionId,
    client,
    conflictOverrides,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
} else {
  console.error('usage: rule-context.mjs <resolve --file FILE... | status --session-id ID | verify --session-id ID --client CLIENT>')
  process.exitCode = 2
}
