#!/usr/bin/env node

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CODEX_HOOK_MATCHER = 'functions\\.exec|apply_patch|Bash|Edit|Write|MultiEdit|NotebookEdit'

export function createCodexHookSpecs(command) {
  return [
    {
      event: 'PreToolUse',
      matcher: CODEX_HOOK_MATCHER,
      hook: {
        type: 'command',
        command,
        async: false,
        timeout: 20,
        additionalContextLimit: 0,
      },
    },
    {
      event: 'PostToolUse',
      matcher: CODEX_HOOK_MATCHER,
      hook: { type: 'command', command, async: false, timeout: 20 },
    },
    {
      event: 'SessionStart',
      matcher: null,
      hook: { type: 'command', command, async: false, timeout: 10 },
    },
    {
      event: 'PreCompact',
      matcher: null,
      hook: { type: 'command', command, async: false, timeout: 10 },
    },
  ]
}

export function validateHookContract(settings, specs) {
  const issues = []
  for (const spec of specs) {
    const groups = Array.isArray(settings?.hooks?.[spec.event]) ? settings.hooks[spec.event] : []
    const matches = groups.flatMap((group) => (Array.isArray(group.hooks) ? group.hooks : []).filter((hook) => hook.command === spec.hook.command).map((hook) => ({ group, hook })))
    if (matches.length !== 1) {
      issues.push(`${spec.event}: expected exactly one rule hook, found ${matches.length}`)
      continue
    }
    const [{ group, hook }] = matches
    if ((group.matcher ?? null) !== spec.matcher) issues.push(`${spec.event}: matcher differs`)
    for (const [field, expected] of Object.entries(spec.hook)) {
      if (hook[field] !== expected) issues.push(`${spec.event}: ${field} must be ${JSON.stringify(expected)}`)
    }
    if ('timeoutSec' in hook) issues.push(`${spec.event}: unsupported timeoutSec field remains`)
  }
  return issues
}

function selfTest() {
  const command = 'node /rules/rule-context-hook.mjs --client codex'
  const specs = createCodexHookSpecs(command)
  const settings = { hooks: {} }
  for (const spec of specs) {
    settings.hooks[spec.event] = [
      {
        ...(spec.matcher ? { matcher: spec.matcher } : {}),
        hooks: [{ ...spec.hook }],
      },
    ]
  }
  assert.deepEqual(validateHookContract(settings, specs), [])
  settings.hooks.SessionStart.push({
    hooks: [{ command, type: 'command', timeoutSec: 10 }],
  })
  assert.equal(
    validateHookContract(settings, specs).some((issue) => issue.includes('found 2')),
    true,
  )
  console.log('PASS hook-contract (Codex events, fields, and duplicates)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
