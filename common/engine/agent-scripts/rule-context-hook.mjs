#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderRuleContext, resolveRulePack } from './lib/l2-rule-resolver.mjs'
import { loadConfig } from './lib/roots.mjs'
import { advanceContextEpoch, prepareLedger, recordInjection, recordPendingTool, recordPostTool, resolveGitWorktree } from './lib/rule-consumption.mjs'

const args = process.argv.slice(2)
const clientIndex = args.indexOf('--client')
const client = clientIndex >= 0 ? args[clientIndex + 1] : process.env.CODEX_THREAD_ID ? 'codex' : 'claude'

let raw = ''

function hookOutput(eventName, fields = {}) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: eventName, ...fields },
    }),
  )
}

function patchPaths(value) {
  if (typeof value !== 'string') return []
  const expanded = value.replaceAll('\\n', '\n')
  return [...expanded.matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\r\n"']+)/g)].map((match) => match[1].trim())
}

function shellTargets(command) {
  if (typeof command !== 'string') return []
  const targets = [...patchPaths(command)]
  for (const match of command.matchAll(/(?:^|[^>])>{1,2}\s*(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  for (const match of command.matchAll(/\b(?:touch|rm|unlink)\s+(?:--\s+)?(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  for (const match of command.matchAll(/\b(?:biome|prettier)\b[^\n;&|]*\s(?:--write|check\s+--write)[^\n;&|]*\s(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  return targets
}

function looksLikeUnresolvedWrite(command) {
  return typeof command === 'string' && /(?:^|\s)(?:sed\s+-i|perl\s+-pi|cp\s|mv\s|tee\s|truncate\s|python\s+-c|node\s+-e)|>{1,2}/.test(command)
}

export function extractTargets(input) {
  const toolInput = input?.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  const targets = []
  for (const key of ['file_path', 'filePath']) {
    if (typeof toolInput[key] === 'string') targets.push(toolInput[key])
  }
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (typeof edit?.file_path === 'string') targets.push(edit.file_path)
      if (typeof edit?.filePath === 'string') targets.push(edit.filePath)
    }
  }
  for (const key of ['patch', 'code', 'input']) targets.push(...patchPaths(toolInput[key]))
  for (const key of ['command', 'cmd']) targets.push(...shellTargets(toolInput[key]))
  return [...new Set(targets)]
}

function isPotentialUnresolvedWrite(input) {
  const toolInput = input?.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  return looksLikeUnresolvedWrite(toolInput.command) || looksLikeUnresolvedWrite(toolInput.cmd) || (typeof toolInput.code === 'string' && /tools\.(?:apply_patch|exec_command)\s*\(/.test(toolInput.code))
}

function identity(input, worktree) {
  return { worktree, sessionId: input.session_id, client }
}

function singleFileReceipt(worktree, file, conflictOverrides) {
  const pack = resolveRulePack({
    worktree,
    targetFiles: [file],
    conflictOverrides,
  })
  return {
    packFingerprint: pack.fingerprint,
    ruleHashes: pack.matchedRules.map((rule) => rule.sourceHash),
  }
}

if (args.includes('--self-test')) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`rule-context-hook self-test failed: ${message}`)
  }
  assert(extractTargets({ tool_input: { file_path: 'a.ts' } }).join(',') === 'a.ts', 'direct file path')
  assert(
    extractTargets({
      tool_input: {
        patch: '*** Begin Patch\n*** Update File: src/a.ts\n*** End Patch',
      },
    }).join(',') === 'src/a.ts',
    'patch path',
  )
  assert(
    extractTargets({
      tool_input: { code: 'const p = "*** Add File: src/b.ts\\n+x"' },
    }).join(',') === 'src/b.ts',
    'nested apply_patch path',
  )
  assert(extractTargets({ tool_input: { command: "printf x > 'src/c.ts'" } }).join(',') === 'src/c.ts', 'shell redirect path')
  assert(
    isPotentialUnresolvedWrite({
      tool_input: { command: 'sed -i x src/a.ts' },
    }),
    'unresolved write detection',
  )
  console.log('PASS rule-context-hook (target extraction)')
  process.exit(0)
}

for await (const chunk of process.stdin) raw += chunk

try {
  const input = JSON.parse(raw)
  const eventName = input.hook_event_name
  const worktree = resolveGitWorktree(input.cwd || process.cwd())
  if (!worktree || !existsSync(join(worktree, '.cursor/rules'))) {
    hookOutput(eventName)
    process.exit(0)
  }
  const id = identity(input, worktree)
  const { config } = loadConfig({ cwd: input.cwd, consumerWorktree: worktree })
  const conflictOverrides = config.ruleConflictOverrides || []

  if (eventName === 'SessionStart' || eventName === 'PreCompact') {
    advanceContextEpoch(id, eventName)
    hookOutput(eventName)
    process.exit(0)
  }

  if (eventName === 'PostToolUse') {
    recordPostTool(id, { toolUseId: input.tool_use_id })
    hookOutput(eventName)
    process.exit(0)
  }

  if (eventName !== 'PreToolUse') {
    hookOutput(eventName)
    process.exit(0)
  }

  const targets = extractTargets(input)
  if (!targets.length) {
    if (isPotentialUnresolvedWrite(input)) {
      hookOutput('PreToolUse', {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Potential write has no statically resolvable target path. Use Edit/Write/apply_patch or a command with explicit repository-relative paths.',
      })
    } else hookOutput('PreToolUse')
    process.exit(0)
  }

  const pack = resolveRulePack({
    worktree,
    targetFiles: targets,
    conflictOverrides,
  })
  // Refresh HEAD/epoch before deciding which rules were already injected. Reading the
  // stale ledger directly here would allow the first edit after a commit to skip the
  // required re-injection and only reset the epoch while recording the pending tool.
  const state = prepareLedger(id)
  const injected = new Set(state?.injectedRuleHashes || [])
  const delta = pack.matchedRules.filter((rule) => !injected.has(rule.sourceHash))
  if (delta.length) {
    const rendered = renderRuleContext(pack, { rules: delta })
    recordInjection(id, {
      ruleHashes: rendered.ruleHashes,
      packFingerprint: pack.fingerprint,
      targets: pack.targets,
      channel: `${client}:PreToolUse:deny-and-retry`,
      byteLength: rendered.byteLength,
    })
    hookOutput('PreToolUse', {
      permissionDecision: 'deny',
      permissionDecisionReason: `Injected ${rendered.ruleCount} previously unseen rules (${rendered.byteLength} bytes). Read the complete injected context, apply it, then retry the tool call.`,
      additionalContext: rendered.text,
    })
    process.exit(0)
  }

  const perFile = Object.fromEntries(pack.targets.map((file) => [file, singleFileReceipt(worktree, file, conflictOverrides)]))
  recordPendingTool(id, {
    toolUseId: input.tool_use_id,
    targets: pack.targets,
    perFile,
    packFingerprint: pack.fingerprint,
  })
  hookOutput('PreToolUse')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const eventName = raw ? JSON.parse(raw).hook_event_name : 'PreToolUse'
    if (eventName === 'PreToolUse') {
      hookOutput('PreToolUse', {
        permissionDecision: 'deny',
        permissionDecisionReason: `L2 rule injection failed closed: ${message}`,
      })
    } else {
      process.stderr.write(`L2 rule hook failed: ${message}\n`)
      process.exitCode = 2
    }
  } catch {
    process.stderr.write(`L2 rule hook failed: ${message}\n`)
    process.exitCode = 2
  }
}
