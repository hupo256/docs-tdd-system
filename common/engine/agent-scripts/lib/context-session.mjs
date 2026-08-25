#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const DELIVERY_TTL_MS = 24 * 60 * 60 * 1000
const DELIVERY_LIMIT = 32

/** Resolve a real task/session identity. No identity means delta reuse is disabled. */
export function resolveContextSessionId({ requested, env = process.env } = {}) {
  const value = requested || env.CODEX_THREAD_ID || env.CLAUDE_SESSION_ID || env.CURSOR_SESSION_ID || ''
  if (!value) return null
  if (typeof value !== 'string' || value.length > 256 || /[\r\n]/.test(value)) throw new Error('invalid --session-id')
  return value
}

function ledgerPath(projectId, client, sessionId) {
  const key = createHash('sha256').update(`${projectId}\n${client}\n${sessionId}`).digest('hex').slice(0, 24)
  return join(tmpdir(), 'docs-tdd-context', 'sessions', `${key}.json`)
}

export function loadContextDeliveryLedger({ projectId, client, sessionId, now = Date.now() }) {
  if (!sessionId) return { enabled: false, file: '', deliveries: [] }
  const file = ledgerPath(projectId, client, sessionId)
  if (!existsSync(file)) return { enabled: true, file, deliveries: [] }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    const deliveries = Array.isArray(data.deliveries)
      ? data.deliveries.filter((entry) => Number.isFinite(Date.parse(entry.deliveredAt)) && now - Date.parse(entry.deliveredAt) <= DELIVERY_TTL_MS)
      : []
    return { enabled: true, file, deliveries }
  } catch {
    return { enabled: true, file, deliveries: [] }
  }
}

export function findDeliveredPack(ledger, scenario, fingerprint) {
  if (!ledger.enabled) return null
  return ledger.deliveries.find((entry) => entry.scenario === scenario && entry.fingerprint === fingerprint && typeof entry.output === 'string' && existsSync(entry.output)) || null
}

export function recordContextDelivery(ledger, entry) {
  if (!ledger.enabled) return
  const deliveries = [entry, ...ledger.deliveries.filter((previous) => !(previous.scenario === entry.scenario && previous.fingerprint === entry.fingerprint))]
    .slice(0, DELIVERY_LIMIT)
  mkdirSync(dirname(ledger.file), { recursive: true })
  writeFileSync(ledger.file, `${JSON.stringify({ version: 1, deliveries }, null, 2)}\n`)
}

function selfTest() {
  assert.equal(resolveContextSessionId({ env: {} }), null)
  assert.equal(resolveContextSessionId({ env: { CODEX_THREAD_ID: 'codex-1' } }), 'codex-1')
  assert.equal(resolveContextSessionId({ requested: 'manual-1', env: { CODEX_THREAD_ID: 'ignored' } }), 'manual-1')
  assert.throws(() => resolveContextSessionId({ requested: 'bad\nid', env: {} }), /invalid/)

  const sessionA = loadContextDeliveryLedger({ projectId: 'PR-00001', client: 'codex', sessionId: 'a' })
  const sessionB = loadContextDeliveryLedger({ projectId: 'PR-00001', client: 'codex', sessionId: 'b' })
  const clientB = loadContextDeliveryLedger({ projectId: 'PR-00001', client: 'claude', sessionId: 'a' })
  assert.notEqual(sessionA.file, sessionB.file)
  assert.notEqual(sessionA.file, clientB.file)
  const pack = join(tmpdir(), 'context-session-selftest.md')
  writeFileSync(pack, 'pack')
  recordContextDelivery(sessionA, { scenario: 'write_ui', fingerprint: 'fp', output: pack, deliveredAt: new Date().toISOString() })
  const reloadedA = loadContextDeliveryLedger({ projectId: 'PR-00001', client: 'codex', sessionId: 'a' })
  assert.ok(findDeliveredPack(reloadedA, 'write_ui', 'fp'))
  assert.equal(findDeliveredPack(sessionB, 'write_ui', 'fp'), null)
  assert.equal(findDeliveredPack(clientB, 'write_ui', 'fp'), null)
  assert.equal(loadContextDeliveryLedger({ projectId: 'PR-00001', client: 'codex', sessionId: null }).enabled, false)
  rmSync(pack, { force: true })
  rmSync(sessionA.file, { force: true })
  console.log('PASS context-session (explicit identity + isolated delivery ledger + TTL)')
}

if (process.argv[1]?.endsWith('context-session.mjs') && process.argv.includes('--self-test')) selfTest()
