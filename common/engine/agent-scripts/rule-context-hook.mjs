#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { partitionRuleInjection, renderAdvisoryRuleCatalog, resolveRulePack, selectRuleInjectionBatch } from './lib/l2-rule-resolver.mjs'
import { loadConfig } from './lib/roots.mjs'
import { advanceContextEpoch, prepareLedger, recordInjection, recordPendingTool, recordPostTool, resolveGitWorktree } from './lib/rule-consumption.mjs'
import { classifyTargets } from './lib/hook-targets.mjs'

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
  console.log('PASS rule-context-hook (dispatcher imports shared target extraction)')
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
    const { blocking, advisory } = partitionRuleInjection(delta, config.ruleInjection)
    const blockingBatch = blocking.length ? selectRuleInjectionBatch(pack, { rules: blocking }) : null
    const advisoryCatalog = advisory.length
      ? renderAdvisoryRuleCatalog(pack, { rules: advisory, maxBytes: config.ruleInjection?.advisoryCatalogBudgetBytes })
      : null
    const injectedHashes = [
      ...(blockingBatch?.rendered.ruleHashes || []),
      ...(advisoryCatalog?.ruleHashes || []),
    ]
    const context = [blockingBatch?.rendered.text, advisoryCatalog?.text].filter(Boolean).join('\n')
    recordInjection(id, {
      ruleHashes: injectedHashes,
      packFingerprint: pack.fingerprint,
      targets: pack.targets,
      channel: blocking.length ? `${client}:PreToolUse:deny-and-retry` : `${client}:PreToolUse:advisory`,
      byteLength: Buffer.byteLength(context),
    })
    const remainingCount = (blockingBatch?.remainingCount || 0) + (advisoryCatalog?.remainingCount || 0)
    if (blocking.length) {
      hookOutput('PreToolUse', {
        permissionDecision: 'deny',
        permissionDecisionReason: `Injected ${blockingBatch.rendered.ruleCount} required rule bodies and ${advisoryCatalog?.ruleCount || 0} advisory summaries (${Buffer.byteLength(context)} bytes)${remainingCount ? `; ${remainingCount} rules remain for a later event` : ''}. Apply the required rules, then retry the tool call once.`,
        additionalContext: context,
      })
    } else {
      const perFile = Object.fromEntries(pack.targets.map((file) => [file, singleFileReceipt(worktree, file, conflictOverrides)]))
      recordPendingTool(id, {
        toolUseId: input.tool_use_id,
        targets: pack.targets,
        perFile,
        packFingerprint: pack.fingerprint,
      })
      hookOutput('PreToolUse', {
        permissionDecision: 'allow',
        permissionDecisionReason: `Attached ${advisoryCatalog.ruleCount} relevant rule summaries without blocking the tool call.`,
        additionalContext: context,
      })
    }
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
