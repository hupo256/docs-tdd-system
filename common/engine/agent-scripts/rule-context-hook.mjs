#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
  composeRuleInjectionContext,
  DEFAULT_ADVISORY_BUDGET_BYTES,
  DEFAULT_BLOCKING_BUDGET_BYTES,
  DEFAULT_COMBINED_BUDGET_BYTES,
  partitionRuleInjection,
  resolveRulePack,
  resolveRulePreflightPack,
} from './lib/l2-rule-resolver.mjs'
import { loadConfig, resolveProjectRoot } from './lib/roots.mjs'
import { projectIdForWorktree, workflowVersionForProject } from './lib/workflow-version.mjs'
import {
  advanceContextEpoch,
  prepareLedger,
  recordEditObservation,
  recordInjection,
  recordPendingTool,
  recordPostTool,
  resolveGitWorktree,
} from './lib/rule-consumption.mjs'
import { appendInjectionTelemetry } from './lib/rule-injection-telemetry.mjs'
import { classifyTargets } from './lib/hook-targets.mjs'

const args = process.argv.slice(2)
const clientIndex = args.indexOf('--client')
const client = clientIndex >= 0 ? args[clientIndex + 1] : process.env.CODEX_THREAD_ID ? 'codex' : 'claude'
const DELIVERY_CANARY = 'DOCS_TDD_DELIVERY_CANARY_V1'

let raw = ''

function hookOutput(eventName, fields = {}) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: eventName, ...fields },
    }),
  )
}

function identity(input, worktree, workflowVersion, projectId) {
  return { worktree, sessionId: input.session_id, client, workflowVersion, projectId }
}

function positiveBudget(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function injectionPolicy(config) {
  const policy = config.ruleInjection || {}
  return {
    ...policy,
    blockingBudgetBytes: positiveBudget(policy.blockingBudgetBytes, DEFAULT_BLOCKING_BUDGET_BYTES),
    advisoryCatalogBudgetBytes: positiveBudget(policy.advisoryCatalogBudgetBytes, DEFAULT_ADVISORY_BUDGET_BYTES),
    combinedBudgetBytes: positiveBudget(policy.combinedBudgetBytes, DEFAULT_COMBINED_BUDGET_BYTES),
  }
}

function deliveryModeFor(policy, agentClient) {
  const configured = policy.deliveryModes?.[agentClient]
  if (['pretool-context', 'preflight', 'deny-and-retry'].includes(configured)) return configured
  if (agentClient === 'codex' || agentClient === 'claude' || agentClient === 'pi') return 'preflight'
  return 'deny-and-retry'
}

function decorateContext(rendered, combinedBudgetBytes) {
  const text = `${DELIVERY_CANARY}\n${rendered.text}`
  const byteLength = Buffer.byteLength(text)
  if (byteLength > combinedBudgetBytes) {
    const error = new Error(`decorated rule context is ${byteLength} bytes, exceeding the ${combinedBudgetBytes}-byte combined budget`)
    error.code = 'RULE_CONTEXT_COMBINED_BUDGET_EXCEEDED'
    throw error
  }
  return { ...rendered, text, byteLength }
}

function targetClasses(targets) {
  return [...new Set(targets.map((target) => {
    if (target === '<preflight>') return 'preflight'
    const extension = extname(target).toLowerCase()
    return extension || 'extensionless'
  }))].sort()
}

function telemetry(id, state, fields) {
  const createdAt = Date.parse(state?.epochStartedAt || state?.createdAt || '')
  appendInjectionTelemetry(id, {
    projectId: id.projectId || null,
    firstEditLatencyMs: fields.event === 'PreToolUse' && Number.isFinite(createdAt) ? Math.max(0, Date.now() - createdAt) : null,
    retryCount: fields.outcome === 'deny' ? 1 : 0,
    manualIntervention: 'not-observed',
    qualityOutcome: 'not-observed-at-injection',
    ...fields,
  })
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

function composeDelta(pack, delta, policy) {
  const { blocking, advisory } = partitionRuleInjection(delta, policy)
  const rendered = decorateContext(
    composeRuleInjectionContext(pack, {
      blocking,
      advisory,
      blockingBudgetBytes: policy.blockingBudgetBytes,
      advisoryBudgetBytes: policy.advisoryCatalogBudgetBytes,
      combinedBudgetBytes: policy.combinedBudgetBytes,
    }),
    policy.combinedBudgetBytes,
  )
  return { blocking, advisory, rendered }
}

if (args.includes('--self-test')) {
  const policy = injectionPolicy({ ruleInjection: { blockingBudgetBytes: 2048, deliveryModes: { pi: 'preflight' } } })
  if (policy.blockingBudgetBytes !== 2048 || policy.advisoryCatalogBudgetBytes !== DEFAULT_ADVISORY_BUDGET_BYTES || deliveryModeFor(policy, 'pi') !== 'preflight') process.exit(1)
  if (!decorateContext({ text: 'x', byteLength: 1 }, 1024).text.startsWith(DELIVERY_CANARY)) process.exit(1)
  console.log('PASS rule-context-hook (bounded policy, delivery canary, and shared target extraction)')
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
  const { config } = loadConfig({ cwd: input.cwd, consumerWorktree: worktree })
  const projectId = process.env.DOCS_TDD_PROJECT_ID || projectIdForWorktree(worktree, config)
  const workflowVersion = workflowVersionForProject(projectId, { resolveProjectRoot })
  const id = identity(input, worktree, workflowVersion, projectId)
  const conflictOverrides = config.ruleConflictOverrides || []
  const policy = injectionPolicy(config)
  const deliveryMode = deliveryModeFor(policy, client)

  const preflightEvent = client === 'pi'
    ? 'BeforeAgentStart'
    : client === 'claude'
      ? 'UserPromptSubmit'
      : client === 'codex'
        ? 'SessionStart'
        : null

  if (eventName === 'SessionStart' || eventName === 'PreCompact') {
    advanceContextEpoch(id, eventName)
    if (eventName !== preflightEvent) {
      // PreCompact does not accept hookSpecificOutput in Claude Code; an empty JSON object
      // avoids the validation error emitted by the previous adapter.
      if (eventName === 'PreCompact') process.stdout.write('{}')
      else hookOutput(eventName)
      process.exit(0)
    }
  }

  if (eventName === preflightEvent) {
    if (deliveryMode !== 'preflight') {
      hookOutput(eventName)
      process.exit(0)
    }
    const pack = resolveRulePreflightPack({ worktree, conflictOverrides })
    const state = prepareLedger(id)
    const injected = new Set(state?.injectedRuleHashes || [])
    const delta = pack.matchedRules.filter((rule) => !injected.has(rule.sourceHash))
    if (!delta.length) {
      hookOutput(eventName)
      process.exit(0)
    }
    const { rendered } = composeDelta(pack, delta, policy)
    recordInjection(id, {
      ruleHashes: rendered.ruleHashes,
      packFingerprint: pack.fingerprint,
      targets: pack.targets,
      channel: `${client}:${eventName}:preflight`,
      byteLength: rendered.byteLength,
    })
    telemetry(id, state, {
      event: eventName,
      deliveryMode,
      outcome: 'allow',
      targetClasses: targetClasses(pack.targets),
      injectedBytes: rendered.byteLength,
      blockingBytes: rendered.blockingByteLength,
      advisoryBytes: rendered.advisoryByteLength,
      injectedRuleCount: rendered.ruleCount,
      advisoryRemainingCount: rendered.advisoryRemainingCount,
    })
    hookOutput(eventName, {
      additionalContext: rendered.text,
    })
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

  const pack = resolveRulePack({ worktree, targetFiles: targets, conflictOverrides })
  const state = prepareLedger(id)
  const observation = recordEditObservation(id)
  const epochStartedAt = Date.parse(observation?.epochStartedAt || '')
  appendInjectionTelemetry(id, {
    event: 'edit-attempt',
    projectId: id.projectId || null,
    targetClasses: targetClasses(targets),
    injectedBytes: 0,
    firstEditLatencyMs: observation?.editAttemptCount === 1 && Number.isFinite(epochStartedAt) ? Math.max(0, Date.now() - epochStartedAt) : null,
    retryCount: 0,
    manualIntervention: 'not-observed',
    qualityOutcome: 'not-observed-at-edit',
  })
  const injected = new Set(state?.injectedRuleHashes || [])
  const delta = pack.matchedRules.filter((rule) => !injected.has(rule.sourceHash))

  if (delta.length) {
    const { blocking } = partitionRuleInjection(delta, policy)
    if (deliveryMode === 'preflight' && blocking.length) {
      telemetry(id, state, {
        event: 'PreToolUse',
        deliveryMode,
        outcome: 'deny',
        targetClasses: targetClasses(pack.targets),
        injectedBytes: 0,
        blockingBytes: 0,
        advisoryBytes: 0,
        injectedRuleCount: 0,
        advisoryRemainingCount: 0,
        reason: 'blocking-preflight-missing',
      })
      hookOutput('PreToolUse', {
        permissionDecision: 'deny',
        permissionDecisionReason: 'Blocking L2 rules were not delivered by the required before_agent_start preflight. Start a new Pi turn (or reload the extension) before editing.',
      })
      process.exit(0)
    }

    if (deliveryMode !== 'preflight') {
      const { rendered } = composeDelta(pack, delta, policy)
      const outcome = deliveryMode === 'pretool-context' ? 'allow' : 'deny'
      recordInjection(id, {
        ruleHashes: rendered.ruleHashes,
        packFingerprint: pack.fingerprint,
        targets: pack.targets,
        channel: `${client}:PreToolUse:${deliveryMode}`,
        byteLength: rendered.byteLength,
      })
      telemetry(id, state, {
        event: 'PreToolUse',
        deliveryMode,
        outcome,
        targetClasses: targetClasses(pack.targets),
        injectedBytes: rendered.byteLength,
        blockingBytes: rendered.blockingByteLength,
        advisoryBytes: rendered.advisoryByteLength,
        injectedRuleCount: rendered.ruleCount,
        advisoryRemainingCount: rendered.advisoryRemainingCount,
      })
      if (outcome === 'deny') {
        hookOutput('PreToolUse', {
          permissionDecision: 'deny',
          permissionDecisionReason: `Client ${client} has no verified pre-edit context delivery mode. Injected ${rendered.ruleCount} rules; read them and retry.`,
          additionalContext: rendered.text,
        })
        process.exit(0)
      }

      const perFile = Object.fromEntries(pack.targets.map((file) => [file, singleFileReceipt(worktree, file, conflictOverrides)]))
      recordPendingTool(id, { toolUseId: input.tool_use_id, targets: pack.targets, perFile, packFingerprint: pack.fingerprint })
      hookOutput('PreToolUse', {
        permissionDecision: 'allow',
        permissionDecisionReason: `Injected ${rendered.ruleCount} rules (${rendered.byteLength} bytes) before this edit${rendered.advisoryRemainingCount ? `; ${rendered.advisoryRemainingCount} advisory entries remain for a later edit` : ''}.`,
        additionalContext: rendered.text,
      })
      process.exit(0)
    }
  }

  const perFile = Object.fromEntries(pack.targets.map((file) => [file, singleFileReceipt(worktree, file, conflictOverrides)]))
  recordPendingTool(id, { toolUseId: input.tool_use_id, targets: pack.targets, perFile, packFingerprint: pack.fingerprint })
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
