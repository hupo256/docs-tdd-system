#!/usr/bin/env node

import assert from 'node:assert/strict'
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createCursorAdapter } from './lib/agent-rule-adapters.mjs'
import { createPiExtension, PI_EXTENSION_RELPATH } from './lib/pi-adapter.mjs'
import { resolveRoots } from './lib/roots.mjs'

const { docsSystemRoot, consumerRoot: repoRoot, config } = resolveRoots()
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

function backupAndLink(entry, target, backupDir = null) {
  mkdirSync(dirname(entry), { recursive: true })
  if (sameLink(entry, target)) return
  if (existsSync(entry)) {
    const backup = backupDir ? join(backupDir, `${basename(entry)}.backup-${timestamp}`) : `${entry}.backup-${timestamp}`
    mkdirSync(dirname(backup), { recursive: true })
    renameSync(entry, backup)
    console.log(`backup: ${backup}`)
  }
  symlinkSync(relative(dirname(entry), target), entry)
  console.log(`link: ${entry} -> ${target}`)
}

function writeCursorAdapter() {
  const file = join(home, '.cursor/rules/fameex-local-governance.mdc')
  mkdirSync(dirname(file), { recursive: true })
  const content = createCursorAdapter({
    sharedRoot,
    repoRoot,
    conflictOverrides: config.ruleConflictOverrides || [],
  })
  writeFileSync(file, content)
  console.log(`adapter: ${file}`)
}

function writePiExtension() {
  const file = join(home, '.pi/agent', PI_EXTENSION_RELPATH)
  mkdirSync(dirname(file), { recursive: true })
  const content = createPiExtension({ docsSystemRoot })
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return
  if (existsSync(file)) {
    const backup = `${file}.backup-${timestamp}`
    copyFileSync(file, backup)
    console.log(`backup: ${backup}`)
  }
  writeFileSync(file, content)
  console.log(`extension: ${file}`)
}

const ruleContextHook = join(docsSystemRoot, 'common/engine/agent-scripts/rule-context-hook.mjs')

function addHook(settings, event, matcher, hook) {
  const groups = Array.isArray(settings.hooks?.[event]) ? settings.hooks[event] : []
  let replaced = false
  const nextGroups = []
  for (const group of groups) {
    const sameMatcher = (group.matcher ?? null) === matcher
    const hasCommand = group.hooks?.some((candidate) => candidate.command === hook.command)
    if (!sameMatcher || !hasCommand) {
      nextGroups.push(group)
      continue
    }
    const remaining = group.hooks.filter((candidate) => candidate.command !== hook.command)
    if (!replaced) {
      nextGroups.push({
        ...(matcher ? { matcher } : {}),
        hooks: [...remaining, hook],
      })
      replaced = true
    } else if (remaining.length) nextGroups.push({ ...group, hooks: remaining })
  }
  if (!replaced) nextGroups.push({ ...(matcher ? { matcher } : {}), hooks: [hook] })
  settings.hooks = { ...(settings.hooks || {}), [event]: nextGroups }
}

function removeHooksMatching(settings, event, predicate) {
  const groups = Array.isArray(settings.hooks?.[event]) ? settings.hooks[event] : []
  settings.hooks = {
    ...(settings.hooks || {}),
    [event]: groups
      .map((group) => ({ ...group, hooks: (group.hooks || []).filter((hook) => !predicate(hook)) }))
      .filter((group) => group.hooks.length > 0),
  }
}

function moveDiscoverableSkillBackups() {
  for (const [skillsDir, backupLabel] of [
    [join(home, '.codex/skills'), 'codex'],
    [join(home, '.claude/skills'), 'claude'],
    [join(home, '.pi/agent/skills'), 'pi'],
  ]) {
    if (!existsSync(skillsDir)) continue
    const backupDir = join(sharedRoot, 'backups', backupLabel, 'skills')
    for (const entry of readdirSync(skillsDir).filter((name) => name.includes('.backup-'))) {
      mkdirSync(backupDir, { recursive: true })
      const source = join(skillsDir, entry)
      const destination = join(backupDir, entry)
      if (existsSync(destination)) throw new Error(`backup destination already exists: ${destination}`)
      renameSync(source, destination)
      console.log(`moved discoverable backup: ${source} -> ${destination}`)
    }
  }
}

function writeJsonWithBackup(file, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`
  if (existsSync(file) && readFileSync(file, 'utf8') === content) return
  mkdirSync(dirname(file), { recursive: true })
  if (existsSync(file)) {
    const backup = `${file}.backup-${timestamp}`
    copyFileSync(file, backup)
    console.log(`backup: ${backup}`)
  }
  writeFileSync(file, content)
}

function mergeClaudeHooks() {
  const settingsFile = join(home, '.claude/settings.json')
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {}
  const contextCommand = `node ${ruleContextHook} --client claude`
  addHook(settings, 'UserPromptSubmit', null, {
    type: 'command',
    command: contextCommand,
    timeout: 20,
  })
  addHook(settings, 'PreToolUse', 'Edit|Write|MultiEdit|NotebookEdit|Bash', {
    type: 'command',
    command: contextCommand,
    timeout: 20,
  })
  addHook(settings, 'PostToolUse', 'Edit|Write|MultiEdit|NotebookEdit|Bash', {
    type: 'command',
    command: contextCommand,
    timeout: 20,
  })
  addHook(settings, 'SessionStart', null, {
    type: 'command',
    command: contextCommand,
    timeout: 10,
  })
  addHook(settings, 'PreCompact', null, {
    type: 'command',
    command: contextCommand,
    timeout: 10,
  })
  const gateCommand = `node ${docsSystemRoot}/common/engine/agent-scripts/claude-posttooluse-gate.mjs`
  removeHooksMatching(settings, 'PostToolUse', (hook) => hook.command?.includes('/claude-posttooluse-gate.mjs'))
  addHook(settings, 'PostToolUse', 'Edit|Write|MultiEdit', {
    type: 'command',
    command: gateCommand,
  })
  writeJsonWithBackup(settingsFile, settings)
  console.log(`hooks: ${settingsFile}`)
}

function mergeCodexHooks() {
  const hooksFile = join(home, '.codex/hooks.json')
  const settings = existsSync(hooksFile) ? JSON.parse(readFileSync(hooksFile, 'utf8')) : {}
  const command = `node ${ruleContextHook} --client codex`
  const matcher = 'functions\\.exec|apply_patch|Bash|Edit|Write|MultiEdit|NotebookEdit'
  addHook(settings, 'PreToolUse', matcher, {
    type: 'command',
    command,
    async: false,
    timeout: 20,
    additionalContextLimit: 16384,
  })
  addHook(settings, 'PostToolUse', matcher, {
    type: 'command',
    command,
    async: false,
    timeout: 20,
  })
  addHook(settings, 'SessionStart', null, {
    type: 'command',
    command,
    async: false,
    timeout: 10,
  })
  addHook(settings, 'PreCompact', null, {
    type: 'command',
    command,
    async: false,
    timeout: 10,
  })
  const gateCommand = `node ${docsSystemRoot}/common/engine/agent-scripts/claude-posttooluse-gate.mjs`
  removeHooksMatching(settings, 'PostToolUse', (hook) => hook.command?.includes('/claude-posttooluse-gate.mjs'))
  addHook(settings, 'PostToolUse', matcher, {
    type: 'command',
    command: gateCommand,
    async: false,
    timeout: 20,
  })
  writeJsonWithBackup(hooksFile, settings)
  console.log(`hooks: ${hooksFile}`)
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`
}

function installLocalPrecommit() {
  const hookDir = join(sharedRoot, 'git-hooks', basename(repoRoot))
  const hookFile = join(hookDir, 'pre-commit')
  const configured = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: repoRoot, encoding: 'utf8' })
  const priorHooksPath = configured.status === 0 ? configured.stdout.trim() : ''
  const wiring = config.enforcementWiring || {}
  const teamConfig = join(repoRoot, wiring.precommitConfig || 'package.json')
  const teamMarker = wiring.precommitMarker || 'precommit-verify-code-rules.mjs'
  const teamGateWired = existsSync(teamConfig) && readFileSync(teamConfig, 'utf8').includes(teamMarker)
  const trackedHuskyHook = join(repoRoot, '.husky', 'pre-commit')
  if (teamGateWired && existsSync(trackedHuskyHook)) {
    if (resolve(repoRoot, priorHooksPath || '.husky') === resolve(hookDir)) {
      const restore = spawnSync('git', ['config', '--local', 'core.hooksPath', '.husky'], { cwd: repoRoot, encoding: 'utf8' })
      if (restore.status !== 0) throw new Error(`cannot restore team core.hooksPath: ${restore.stderr.trim()}`)
    }
    console.log('local pre-commit: existing team Husky/lint-staged gate retained')
    return
  }
  const priorHook = existsSync(trackedHuskyHook)
    ? join('$repo_root', '.husky', 'pre-commit')
    : priorHooksPath && resolve(repoRoot, priorHooksPath) !== resolve(hookDir)
      ? (priorHooksPath.startsWith('/') ? join(priorHooksPath, 'pre-commit') : join('$repo_root', priorHooksPath, 'pre-commit'))
      : ''
  const priorCommand = priorHook
    ? priorHook.startsWith('$repo_root')
      ? `if [ -x "${priorHook}" ]; then "${priorHook}"; fi`
      : `if [ -x ${shellQuote(priorHook)} ]; then ${shellQuote(priorHook)}; fi`
    : ''
  const content = `#!/bin/sh\nset -e\nrepo_root=$(git rev-parse --show-toplevel)\n${priorCommand}\nnode ${shellQuote(join(docsSystemRoot, 'common/engine/agent-scripts/precommit-verify-code-rules.mjs'))}\n`
  mkdirSync(hookDir, { recursive: true })
  if (!existsSync(hookFile) || readFileSync(hookFile, 'utf8') !== content) writeFileSync(hookFile, content)
  chmodSync(hookFile, 0o755)
  const result = spawnSync('git', ['config', '--local', 'core.hooksPath', hookDir], { cwd: repoRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`cannot configure local core.hooksPath: ${result.stderr.trim()}`)
  console.log(`local pre-commit: ${hookFile}${priorHook ? ` (chains ${priorHook})` : ''}`)
}

function install() {
  const sharedAgent = join(sharedRoot, 'AGENT.md')
  ensureSharedFile(join(home, '.codex/AGENTS.md'), sharedAgent, (text) => {
    const neutral = text.replaceAll('/Users/aven/.codex/skills/', '/Users/aven/.ai-rules/skills/').replace('L1 global craft lives here plus `/Users/aven/.codex/skills/*`', 'L1 global craft lives here plus `/Users/aven/.ai-rules/skills/*`')
    return `${neutral.trim()}${protocol}\n`
  })
  for (const skill of ['coding-quality', 'figma-read']) {
    ensureSharedFile(join(home, `.codex/skills/${skill}/SKILL.md`), join(sharedRoot, `skills/${skill}/SKILL.md`), (text) => `${text.replaceAll('/Users/aven/.codex/AGENTS.md', `${sharedRoot}/AGENT.md`).trim()}\n`)
  }

  backupAndLink(join(home, '.codex/AGENTS.md'), sharedAgent)
  backupAndLink(join(home, '.claude/CLAUDE.md'), sharedAgent)
  backupAndLink(join(home, '.pi/agent/AGENTS.md'), sharedAgent)
  moveDiscoverableSkillBackups()
  for (const agent of ['.codex', '.claude']) {
    for (const skill of ['coding-quality', 'figma-read']) {
      backupAndLink(join(home, `${agent}/skills/${skill}`), join(sharedRoot, `skills/${skill}`), join(sharedRoot, 'backups', agent.slice(1), 'skills'))
    }
  }
  for (const skill of ['coding-quality', 'figma-read']) {
    backupAndLink(join(home, `.pi/agent/skills/${skill}`), join(sharedRoot, `skills/${skill}`), join(sharedRoot, 'backups', 'pi', 'skills'))
  }
  writeCursorAdapter()
  writePiExtension()
  mergeClaudeHooks()
  mergeCodexHooks()
  installLocalPrecommit()
}

function selfTest() {
  assert.equal(protocol.includes('docs-tdd.mjs context'), true)
  assert.equal(protocol.includes('docs-tdd.mjs changed'), true)
  assert.equal(protocol.includes('docs-tdd.mjs gate'), true)
  assert.equal(typeof repoRoot === 'string' && repoRoot.length > 0, true)
  assert.equal(ruleContextHook.endsWith('/common/engine/agent-scripts/rule-context-hook.mjs'), true)
  assert.equal(shellQuote("a'b"), `'a'"'"'b'`)
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: 'x',
          hooks: [{ type: 'command', command: 'same', timeoutSec: 600 }],
        },
      ],
    },
  }
  addHook(settings, 'PreToolUse', 'x', {
    type: 'command',
    command: 'same',
    timeout: 20,
  })
  assert.deepEqual(settings.hooks.PreToolUse[0].hooks[0], {
    type: 'command',
    command: 'same',
    timeout: 20,
  })
  const duplicateSettings = {
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'same' }] }, { hooks: [{ type: 'command', command: 'same' }] }],
    },
  }
  addHook(duplicateSettings, 'SessionStart', null, {
    type: 'command',
    command: 'same',
    timeout: 10,
  })
  assert.deepEqual(duplicateSettings.hooks.SessionStart, [{ hooks: [{ type: 'command', command: 'same', timeout: 10 }] }])
  const staleSettings = { hooks: { PostToolUse: [{ hooks: [{ command: 'node /old/claude-posttooluse-gate.mjs' }, { command: 'keep' }] }] } }
  removeHooksMatching(staleSettings, 'PostToolUse', (hook) => hook.command?.includes('/claude-posttooluse-gate.mjs'))
  assert.deepEqual(staleSettings.hooks.PostToolUse, [{ hooks: [{ command: 'keep' }] }])
  console.log('install-local-agent-rules self-test passed.')
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}
if (process.argv.includes('--self-test')) selfTest()
else install()
