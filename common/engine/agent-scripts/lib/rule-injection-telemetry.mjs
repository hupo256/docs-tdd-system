#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { appendFileSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_BYTES = 256 * 1024
const RETAIN_BYTES = 128 * 1024
const LOCK_WAIT_MS = 150
const LOCK_STALE_MS = 30_000
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const sessionKey = (sessionId) => {
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('telemetry identity has no real session id')
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 24)
}

export function injectionTelemetryPath(worktree) {
  const root = process.env.DOCS_TDD_RULE_LEDGER_DIR || join(worktree, 'output-tdd/rule-consumption')
  return join(root, 'injection-events.jsonl')
}

function acquireLock(lock) {
  const deadline = Date.now() + LOCK_WAIT_MS
  while (true) {
    try {
      return openSync(lock, 'wx')
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
          rmSync(lock, { force: true })
          continue
        }
      } catch (statError) {
        if (statError?.code !== 'ENOENT') throw statError
      }
      if (Date.now() >= deadline) throw new Error('telemetry file is busy')
      sleep(10)
    }
  }
}

function recentCompleteLines(file, size) {
  const length = Math.min(size, RETAIN_BYTES)
  const buffer = Buffer.alloc(length)
  const descriptor = openSync(file, 'r')
  try {
    readSync(descriptor, buffer, 0, length, size - length)
  } finally {
    closeSync(descriptor)
  }
  const start = size > length ? buffer.indexOf(10) + 1 : 0
  const end = buffer.lastIndexOf(10) + 1
  return end > start ? buffer.subarray(start, end) : Buffer.alloc(0)
}

function appendBounded(file, line) {
  const record = Buffer.from(line)
  if (record.length > MAX_BYTES - RETAIN_BYTES) throw new Error('telemetry event exceeds the size limit')
  const lock = `${file}.lock`
  const descriptor = acquireLock(lock)
  try {
    const size = existsSync(file) ? statSync(file).size : 0
    if (size + record.length <= MAX_BYTES) {
      appendFileSync(file, record)
      return
    }
    const recent = recentCompleteLines(file, size)
    const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, Buffer.concat([recent, record]))
      renameSync(temporary, file)
    } finally {
      rmSync(temporary, { force: true })
    }
  } finally {
    closeSync(descriptor)
    rmSync(lock, { force: true })
  }
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
    appendBounded(file, `${JSON.stringify(record)}\n`)
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
    for (let index = 0; index < 180; index += 1) {
      assert.equal(appendInjectionTelemetry(identity, { event: 'probe', index, padding: 'x'.repeat(2048) }).telemetryWriteError, undefined)
    }
    const bounded = readFileSync(injectionTelemetryPath(identity.worktree), 'utf8')
    const events = bounded.trimEnd().split('\n').map((line) => JSON.parse(line))
    assert.ok(Buffer.byteLength(bounded) <= MAX_BYTES)
    assert.equal(events.at(-1).index, 179)
    assert.ok(events[0].index > 0)
    assert.equal(bounded.includes('secret-session') || bounded.includes('/private/repo'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
    if (previous == null) delete process.env.DOCS_TDD_RULE_LEDGER_DIR
    else process.env.DOCS_TDD_RULE_LEDGER_DIR = previous
  }
  console.log('PASS rule-injection-telemetry (redacted, bounded NDJSON metrics)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
