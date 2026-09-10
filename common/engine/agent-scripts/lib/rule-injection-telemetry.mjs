#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sessionKey = (sessionId) => {
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('telemetry identity has no real session id')
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 24)
}

export function injectionTelemetryPath(worktree) {
  const root = process.env.DOCS_TDD_RULE_LEDGER_DIR || join(worktree, 'output-tdd/rule-consumption')
  return join(root, 'injection-events.jsonl')
}

// Only operational metrics are persisted: never prompts, rule bodies, user input, or target paths.
export function appendInjectionTelemetry(identity, event) {
  const file = injectionTelemetryPath(identity.worktree)
  const record = {
    schemaVersion: 1,
    at: new Date().toISOString(),
    sessionKey: sessionKey(identity.sessionId),
    client: identity.client,
    workflowVersion: identity.workflowVersion,
    ...event,
  }
  try {
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, `${JSON.stringify(record)}\n`)
  } catch (error) {
    return { ...record, telemetryWriteError: error instanceof Error ? error.message : String(error) }
  }
  return record
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'rule-injection-telemetry-'))
  const previous = process.env.DOCS_TDD_RULE_LEDGER_DIR
  try {
    process.env.DOCS_TDD_RULE_LEDGER_DIR = root
    const identity = { worktree: '/private/repo', sessionId: 'secret-session', client: 'pi', workflowVersion: 2 }
    const record = appendInjectionTelemetry(identity, { event: 'probe', injectedBytes: 42 })
    const text = readFileSync(injectionTelemetryPath(identity.worktree), 'utf8')
    assert.equal(record.injectedBytes, 42)
    assert.equal(existsSync(injectionTelemetryPath(identity.worktree)), true)
    assert.equal(text.includes('secret-session') || text.includes('/private/repo'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
    if (previous == null) delete process.env.DOCS_TDD_RULE_LEDGER_DIR
    else process.env.DOCS_TDD_RULE_LEDGER_DIR = previous
  }
  console.log('PASS rule-injection-telemetry (redacted NDJSON metrics)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
