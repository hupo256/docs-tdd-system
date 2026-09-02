#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeTargetPath, resolveRulePack, selectRuleInjectionBatch } from './lib/l2-rule-resolver.mjs'
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
  for (const match of command.matchAll(/\b(?:tee|truncate)\s+(?:-[^\s]+\s+)*(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  for (const match of command.matchAll(/\b(?:cp|mv)\s+(?:-[^\s]+\s+)*(?:["']?[^\s"';&|]+["']?\s+)+(["']?)([^\s"';&|]+)\1(?=\s*(?:[;&|]|$))/g)) targets.push(match[2])
  for (const match of command.matchAll(/\b(?:biome|prettier)\b[^\n;&|]*\s(?:--write|check\s+--write)[^\n;&|]*\s(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  return targets
}

export function classifyTargets(input, worktree) {
  const repoTargets = []
  const externalTargets = []
  let dynamicTarget = false
  for (const target of extractTargets(input)) {
    if (/[$`*?{}]|^~(?:\/|$)/.test(target)) {
      dynamicTarget = true
      continue
    }
    try {
      repoTargets.push(normalizeTargetPath(worktree, target))
    } catch {
      externalTargets.push(target)
    }
  }
  const toolInput = input?.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  const commands = [toolInput.command, toolInput.cmd].filter((value) => typeof value === 'string')
  const opaqueWrite = commands.some((command) => /(?:^|\s)(?:sed\s+-i|perl\s+-pi|python\s+-c|node\s+-e)(?:\s|$)/.test(command))
    || (typeof toolInput.code === 'string' && /tools\.(?:apply_patch|exec_command)\s*\(/.test(toolInput.code) && repoTargets.length === 0)
  return {
    repoTargets: [...new Set(repoTargets)],
    externalTargets: [...new Set(externalTargets)],
    unknownWrite: dynamicTarget || opaqueWrite || (isPotentialUnresolvedWrite(input) && repoTargets.length === 0 && externalTargets.length === 0),
  }
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
  const external = classifyTargets({ tool_input: { command: 'npm test > /dev/null 2>&1' } }, '/repo')
  assert(external.repoTargets.length === 0 && external.externalTargets.join(',') === '/dev/null', 'external redirect is classified')
  const copy = classifyTargets({ tool_input: { command: 'cp /tmp/a src/a.ts' } }, '/repo')
  assert(copy.repoTargets.join(',') === 'src/a.ts', 'copy destination is classified as a repository target')
  const opaque = classifyTargets({ tool_input: { command: "python -c 'open(\"src/a.ts\",\"w\").write(\"x\")' > /tmp/out" } }, '/repo')
  assert(opaque.unknownWrite, 'opaque writes stay unresolved even with an external redirect')
  assert(classifyTargets({ tool_input: { command: 'printf x > "$TMPDIR/out"' } }, '/repo').unknownWrite, 'dynamic targets stay unresolved')
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

  const targetClassification = classifyTargets(input, worktree)
  const targets = targetClassification.repoTargets
  if (targetClassification.unknownWrite) {
    hookOutput('PreToolUse', {
      permissionDecision: 'deny',
      permissionDecisionReason: 'Potential write has an opaque or statically unresolved repository target. Use Edit/Write/apply_patch or a command with explicit repository-relative paths.',
    })
    process.exit(0)
  }
  if (!targets.length) {
    hookOutput('PreToolUse')
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
    const { rendered, remainingCount } = selectRuleInjectionBatch(pack, { rules: delta })
    recordInjection(id, {
      ruleHashes: rendered.ruleHashes,
      packFingerprint: pack.fingerprint,
      targets: pack.targets,
      channel: `${client}:PreToolUse:deny-and-retry`,
      byteLength: rendered.byteLength,
    })
    hookOutput('PreToolUse', {
      permissionDecision: 'deny',
      permissionDecisionReason: `Injected ${rendered.ruleCount} previously unseen rules (${rendered.byteLength} bytes)${remainingCount ? `; ${remainingCount} rules remain for the next retry` : ''}. Read the complete injected context, apply it, then retry the tool call.`,
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
      const repair = error?.code === 'RULE_CONTEXT_SINGLE_RULE_TOO_LARGE' ? ` Rule ${error.rulePath} cannot fit by itself; split or shorten that .mdc file before retrying.` : ''
      hookOutput('PreToolUse', {
        permissionDecision: 'deny',
        permissionDecisionReason: `L2 rule injection failed closed: ${message}.${repair}`,
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
