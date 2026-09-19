#!/usr/bin/env node
// Append-only runtime decision records with deterministic parsing, deduplication, and replay.

import assert from 'node:assert/strict'
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

export const RUNTIME_DECISIONS_FILE = 'runtime-decisions.jsonl'
export const RUNTIME_DECISION_SCHEMA_VERSION = 1

const DECISION_TYPES = new Set([
  'source-conflict',
  'scope-change',
  'api-blocked',
  'auto-fix',
  'review-waive',
  'acceptance',
])
const RESOLUTIONS = new Set(['continue', 'blocked', 'deferred', 'superseded'])

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string`)
  return value.trim()
}

function stringList(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${field} must be an array of non-empty strings`)
  }
  const result = value.map((item) => item.trim())
  if (new Set(result).size !== result.length) throw new Error(`${field} must not contain duplicates`)
  return result
}

function jsonValue(value, field) {
  if (value === undefined) throw new Error(`${field} is required`)
  try {
    JSON.stringify(value)
  } catch (error) {
    throw new Error(`${field} must be JSON serializable: ${error.message}`)
  }
  return value
}

function validTimestamp(value) {
  const timestamp = text(value, 'ts')
  if (Number.isNaN(Date.parse(timestamp))) throw new Error('ts must be a valid ISO timestamp')
  return timestamp
}

function normalizeSupersedes(value) {
  if (value === undefined) return []
  return Array.isArray(value) ? stringList(value, 'supersedes') : [text(value, 'supersedes')]
}

function normalizeDecision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('runtime decision must be an object')
  const decision = {
    schemaVersion: input.schemaVersion ?? RUNTIME_DECISION_SCHEMA_VERSION,
    decisionId: text(input.decisionId, 'decisionId'),
    ts: validTimestamp(input.ts),
    actor: text(input.actor, 'actor'),
    type: text(input.type, 'type'),
    target: stringList(input.target, 'target'),
    before: jsonValue(input.before, 'before'),
    after: jsonValue(input.after, 'after'),
    reason: text(input.reason, 'reason'),
    evidence: stringList(input.evidence, 'evidence'),
    resolution: text(input.resolution, 'resolution'),
  }
  if (decision.schemaVersion !== RUNTIME_DECISION_SCHEMA_VERSION) {
    throw new Error(`schemaVersion must be ${RUNTIME_DECISION_SCHEMA_VERSION}`)
  }
  if (!DECISION_TYPES.has(decision.type)) throw new Error(`unsupported runtime decision type: ${decision.type}`)
  if (!RESOLUTIONS.has(decision.resolution)) throw new Error(`unsupported runtime decision resolution: ${decision.resolution}`)
  const supersedes = normalizeSupersedes(input.supersedes)
  if (supersedes.includes(decision.decisionId)) throw new Error('decision cannot supersede itself')
  if (supersedes.length) decision.supersedes = supersedes
  return decision
}

export function normalizeRuntimeDecision(input) {
  return normalizeDecision(input)
}

export function runtimeDecisionFingerprint(decision) {
  return fingerprint(normalizeDecision(decision))
}

function parseLine(line, lineNumber) {
  let parsed
  try {
    parsed = JSON.parse(line)
  } catch (error) {
    throw new Error(`invalid runtime-decisions.jsonl line ${lineNumber}: ${error.message}`)
  }
  try {
    return normalizeDecision(parsed)
  } catch (error) {
    throw new Error(`invalid runtime decision on line ${lineNumber}: ${error.message}`)
  }
}

export function parseRuntimeDecisions(content) {
  if (typeof content !== 'string') throw new Error('runtime decision log must be text')
  const records = []
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (line.trim()) records.push(parseLine(line, index + 1))
  }
  return dedupeRuntimeDecisions(records)
}

export function serializeRuntimeDecision(decision) {
  return `${JSON.stringify(normalizeDecision(decision))}\n`
}

export function dedupeRuntimeDecisions(records) {
  if (!Array.isArray(records)) throw new Error('runtime decision records must be an array')
  const byId = new Map()
  const duplicates = []
  for (const [index, item] of records.entries()) {
    const decision = normalizeDecision(item)
    const existing = byId.get(decision.decisionId)
    if (!existing) {
      byId.set(decision.decisionId, { decision, index })
      continue
    }
    const existingFingerprint = runtimeDecisionFingerprint(existing.decision)
    const currentFingerprint = runtimeDecisionFingerprint(decision)
    if (existingFingerprint !== currentFingerprint) {
      throw new Error(`conflicting runtime decisionId: ${decision.decisionId}`)
    }
    duplicates.push({ decisionId: decision.decisionId, firstIndex: existing.index, duplicateIndex: index })
  }
  return {
    records: [...byId.values()].sort((left, right) => left.index - right.index).map((item) => item.decision),
    duplicates,
  }
}

export function appendRuntimeDecisionText(content, decision) {
  const parsed = parseRuntimeDecisions(content)
  const normalized = normalizeDecision(decision)
  const existing = parsed.records.find((item) => item.decisionId === normalized.decisionId)
  if (existing) {
    if (runtimeDecisionFingerprint(existing) !== runtimeDecisionFingerprint(normalized)) {
      throw new Error(`conflicting runtime decisionId: ${normalized.decisionId}`)
    }
    return { content, decision: existing, appended: false, idempotent: true, recordCount: parsed.records.length }
  }
  return {
    content: `${content && !content.endsWith('\n') ? `${content}\n` : content}${serializeRuntimeDecision(normalized)}`,
    decision: normalized,
    appended: true,
    idempotent: false,
    recordCount: parsed.records.length + 1,
  }
}

export function readRuntimeDecisions(file) {
  const target = resolve(file)
  if (!existsSync(target)) return { file: target, records: [], duplicates: [], replay: replayRuntimeDecisions([]), summary: summarizeRuntimeDecisions([]) }
  const parsed = parseRuntimeDecisions(readFileSync(target, 'utf8'))
  return {
    file: target,
    records: parsed.records,
    duplicates: parsed.duplicates,
    replay: replayRuntimeDecisions(parsed.records),
    summary: summarizeRuntimeDecisions(parsed.records),
  }
}

function appendDurable(file, content) {
  const descriptor = openSync(file, 'a')
  try {
    appendFileSync(descriptor, content, 'utf8')
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

export function appendRuntimeDecision(file, decision) {
  const target = resolve(file)
  mkdirSync(dirname(target), { recursive: true })
  const current = existsSync(target) ? readFileSync(target, 'utf8') : ''
  const result = appendRuntimeDecisionText(current, decision)
  if (result.appended) {
    const separator = current && !current.endsWith('\n') ? '\n' : ''
    appendDurable(target, `${separator}${serializeRuntimeDecision(result.decision)}`)
  }
  return { ...result, file: target }
}

function compareReplayOrder(left, right) {
  const timestampOrder = Date.parse(left.ts) - Date.parse(right.ts)
  return Number.isFinite(timestampOrder) && timestampOrder !== 0 ? timestampOrder : 0
}

function conflictKey(decision) {
  return `${decision.type}\0${[...decision.target].sort().join('\0')}`
}

export function replayRuntimeDecisions(records) {
  const parsed = dedupeRuntimeDecisions(records).records
  const active = new Map()
  const knownIds = new Set(parsed.map((decision) => decision.decisionId))
  const activeByConflict = new Map()
  const unresolvedSupersedes = []
  const timeOrderOverrides = []
  for (const decision of parsed) {
    for (const supersededId of decision.supersedes || []) {
      if (!knownIds.has(supersededId)) {
        unresolvedSupersedes.push({ decisionId: decision.decisionId, supersededId })
        continue
      }
      active.delete(supersededId)
      for (const [key, activeId] of activeByConflict.entries()) {
        if (activeId === supersededId) activeByConflict.delete(key)
      }
    }
    const key = conflictKey(decision)
    const previousId = activeByConflict.get(key)
    const previous = previousId ? active.get(previousId) : null
    if (previous && compareReplayOrder(previous, decision) > 0) {
      timeOrderOverrides.push({ ignoredDecisionId: decision.decisionId, keptDecisionId: previous.decisionId })
      continue
    }
    if (previous) {
      active.delete(previous.decisionId)
      timeOrderOverrides.push({ ignoredDecisionId: previous.decisionId, keptDecisionId: decision.decisionId })
    }
    active.set(decision.decisionId, decision)
    activeByConflict.set(key, decision.decisionId)
  }
  const effective = [...active.values()].sort(compareReplayOrder)
  return {
    records: parsed,
    effective,
    unresolvedSupersedes,
    timeOrderOverrides,
    activeDecisionIds: effective.map((decision) => decision.decisionId),
  }
}

export function summarizeRuntimeDecisions(records) {
  const replay = replayRuntimeDecisions(records)
  const countBy = (items, field) => Object.fromEntries(
    [...new Set(items.map((item) => item[field]))].sort().map((key) => [key, items.filter((item) => item[field] === key).length]),
  )
  const latestByType = {}
  for (const decision of replay.effective) latestByType[decision.type] = decision.decisionId
  return {
    recordCount: replay.records.length,
    effectiveCount: replay.effective.length,
    supersededCount: replay.records.length - replay.effective.length,
    unresolvedSupersedes: replay.unresolvedSupersedes,
    timeOrderOverrides: replay.timeOrderOverrides,
    byType: countBy(replay.records, 'type'),
    byResolution: countBy(replay.records, 'resolution'),
    byActor: countBy(replay.records, 'actor'),
    effectiveDecisionIds: replay.activeDecisionIds,
    latestEffectiveDecisionByType: latestByType,
  }
}

export function selfTest() {
  const base = {
    schemaVersion: 1,
    decisionId: 'DEC-001',
    ts: '2026-09-19T10:00:00Z',
    actor: 'system',
    type: 'source-conflict',
    target: ['R-001', 'S-002'],
    before: { source: 'old' },
    after: { source: 'new' },
    reason: 'source comparison',
    evidence: ['SRC-001', 'F-001'],
    resolution: 'continue',
  }
  const replacement = {
    ...base,
    decisionId: 'DEC-002',
    ts: '2026-09-19T10:01:00Z',
    actor: 'human:owner',
    after: { source: 'approved' },
    reason: 'owner decision',
    resolution: 'continue',
    supersedes: ['DEC-001'],
  }

  const first = appendRuntimeDecisionText('', base)
  assert.equal(first.appended, true)
  assert.equal(appendRuntimeDecisionText(first.content, base).idempotent, true)
  assert.throws(() => appendRuntimeDecisionText(first.content, { ...base, reason: 'changed' }), /conflicting runtime decisionId/)
  const parsed = parseRuntimeDecisions(`${first.content}${first.content}`)
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.duplicates.length, 1)

  const replay = replayRuntimeDecisions([base, replacement])
  assert.deepEqual(replay.activeDecisionIds, ['DEC-002'])
  assert.equal(replay.effective[0].actor, 'human:owner')
  assert.deepEqual(summarizeRuntimeDecisions([base, replacement]).byType, { 'source-conflict': 2 })
  assert.equal(summarizeRuntimeDecisions([base, replacement]).supersededCount, 1)
  assert.deepEqual(replayRuntimeDecisions([replacement]).unresolvedSupersedes, [{ decisionId: 'DEC-002', supersededId: 'DEC-001' }])
  const timeOrdered = { ...base, decisionId: 'DEC-003', ts: '2026-09-19T10:02:00Z', reason: 'later source comparison' }
  const timeReplay = replayRuntimeDecisions([base, timeOrdered])
  assert.deepEqual(timeReplay.activeDecisionIds, ['DEC-003'])
  assert.deepEqual(timeReplay.timeOrderOverrides, [{ ignoredDecisionId: 'DEC-001', keptDecisionId: 'DEC-003' }])
  assert.throws(() => parseRuntimeDecisions('{"decisionId":"bad"}\n'), /invalid runtime decision/)
  assert.throws(() => parseRuntimeDecisions('{"decisionId":"bad"\n'), /invalid runtime-decisions.jsonl line 1/)

  const root = join(tmpdir(), `vnext-runtime-decisions-${process.pid}`)
  try {
    const file = join(root, RUNTIME_DECISIONS_FILE)
    assert.equal(appendRuntimeDecision(file, base).appended, true)
    assert.equal(appendRuntimeDecision(file, base).idempotent, true)
    assert.equal(appendRuntimeDecision(file, replacement).appended, true)
    const stored = readRuntimeDecisions(file)
    assert.equal(stored.records.length, 2)
    assert.deepEqual(stored.replay.activeDecisionIds, ['DEC-002'])
    assert.equal(stored.summary.effectiveCount, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  console.log('vnext-runtime-decisions self-test passed')
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect && process.argv.includes('--self-test')) selfTest()
