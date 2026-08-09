#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { createCursorAdapter } from './lib/agent-rule-adapters.mjs'
import { resolveRoots } from './lib/roots.mjs'

const { consumerRoot: repoRoot, config } = resolveRoots()
const home = homedir()
const sharedRoot = join(home, '.ai-rules')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

const protocol = `

## FameEX Local Execution Protocol

- In \`${repoRoot}\` or its feature worktrees, read \`${repoRoot}/apps/web/docs_tdd/common/rules/rule-router.md\` first.
- Before business coding, load repository \`AGENTS.md\`, repository \`CLAUDE.md\`, and the matching \`.cursor/rules/*.mdc\`; unresolved conflicts block coding, while local config overrides are fingerprinted into the context pack.
- Load only routed L3 rules with \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context <PROJECT-ID> <SCENARIO>\`.
- After edits run \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed <PROJECT-ID>\` when no automatic hook is available.
- At a stage boundary run \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate <PROJECT-ID> <Gx>\`.
- Diagnose rule loading and drift with \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs doctor <PROJECT-ID>\`.
`

function printHelp() {
  console.log(`usage: install-local-agent-rules.mjs [--self-test]

Install one local L1 source and thin Codex, Claude, and Cursor adapters.
Existing files are moved to timestamped backups before links are changed.`)
}

function ensureSharedFile(source, target, transform = (text) => text) {
  if (existsSync(target)) return
  if (!existsSync(source)) throw new Error(`initial source does not exist: ${source}`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, transform(readFileSync(source, 'utf8')))
}

function sameLink(entry, target) {
  if (!existsSync(entry) || !lstatSync(entry).isSymbolicLink()) return false
  return resolve(dirname(entry), readlinkSync(entry)) === resolve(target)
}

function backupAndLink(entry, target) {
  mkdirSync(dirname(entry), { recursive: true })
  if (sameLink(entry, target)) return
  if (existsSync(entry)) {
    const backup = `${entry}.backup-${timestamp}`
    renameSync(entry, backup)
    console.log(`backup: ${backup}`)
  }
  symlinkSync(relative(dirname(entry), target), entry)
  console.log(`link: ${entry} -> ${target}`)
}

function writeCursorAdapter() {
  const file = join(home, '.cursor/rules/fameex-local-governance.mdc')
  mkdirSync(dirname(file), { recursive: true })
  const content = createCursorAdapter({ sharedRoot, repoRoot, conflictOverrides: config.ruleConflictOverrides || [] })
  writeFileSync(file, content)
  console.log(`adapter: ${file}`)
}

function mergeClaudeHook() {
  const settingsFile = join(home, '.claude/settings.json')
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {}
  const command = `node ${repoRoot}/apps/web/docs_tdd/common/engine/agent-scripts/claude-posttooluse-gate.mjs`
  const postToolUse = Array.isArray(settings.hooks?.PostToolUse) ? settings.hooks.PostToolUse : []
  const present = postToolUse.some((group) => group.hooks?.some((hook) => hook.command === command))
  if (!present) {
    postToolUse.push({
      matcher: 'Edit|Write|MultiEdit',
      hooks: [{ type: 'command', command }],
    })
  }
  settings.hooks = { ...(settings.hooks || {}), PostToolUse: postToolUse }
  writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
  console.log(`hook: ${settingsFile}`)
}

function install() {
  const sharedAgent = join(sharedRoot, 'AGENT.md')
  ensureSharedFile(join(home, '.codex/AGENTS.md'), sharedAgent, (text) => {
    const neutral = text
      .replaceAll('/Users/aven/.codex/skills/', '/Users/aven/.ai-rules/skills/')
      .replace('L1 global craft lives here plus `/Users/aven/.codex/skills/*`', 'L1 global craft lives here plus `/Users/aven/.ai-rules/skills/*`')
    return `${neutral.trim()}${protocol}\n`
  })
  for (const skill of ['coding-quality', 'figma-read']) {
    ensureSharedFile(
      join(home, `.codex/skills/${skill}/SKILL.md`),
      join(sharedRoot, `skills/${skill}/SKILL.md`),
      (text) => `${text.replaceAll('/Users/aven/.codex/AGENTS.md', `${sharedRoot}/AGENT.md`).trim()}\n`,
    )
  }

  backupAndLink(join(home, '.codex/AGENTS.md'), sharedAgent)
  backupAndLink(join(home, '.claude/CLAUDE.md'), sharedAgent)
  for (const agent of ['.codex', '.claude']) {
    for (const skill of ['coding-quality', 'figma-read']) {
      backupAndLink(join(home, `${agent}/skills/${skill}`), join(sharedRoot, `skills/${skill}`))
    }
  }
  writeCursorAdapter()
  mergeClaudeHook()
}

function selfTest() {
  assert.equal(protocol.includes('docs-tdd.mjs context'), true)
  assert.equal(protocol.includes('docs-tdd.mjs changed'), true)
  assert.equal(protocol.includes('docs-tdd.mjs gate'), true)
  assert.equal(typeof repoRoot === 'string' && repoRoot.length > 0, true)
  console.log('install-local-agent-rules self-test passed.')
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}
if (process.argv.includes('--self-test')) selfTest()
else install()
