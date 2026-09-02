#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { resolveRulePack } from './l2-rule-resolver.mjs'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const now = () => new Date().toISOString()

function git(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return result.status === 0 ? result.stdout : ''
}

export function resolveGitWorktree(cwd) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim() || null
}

export function currentHead(worktree) {
  return git(['rev-parse', 'HEAD'], worktree).trim()
}

function isInsidePath(parent, child) {
  const fromParent = relative(resolve(parent), resolve(child))
  return fromParent === '' || (fromParent !== '..' && !fromParent.startsWith('../') && !isAbsolute(fromParent))
}

export function changedFileSnapshot(worktree) {
  const ledgerRoot = resolve(process.env.DOCS_TDD_RULE_LEDGER_DIR || join(worktree, 'output-tdd/rule-consumption'))
  const names = new Set(
    [...git(['diff', '--name-only', '-z'], worktree).split('\0'), ...git(['diff', '--cached', '--name-only', '-z'], worktree).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z'], worktree).split('\0')].filter((file) => {
      if (!file) return false
      return !isInsidePath(ledgerRoot, resolve(worktree, file))
    }),
  )
  return Object.fromEntries(
    [...names].sort().map((file) => {
      const absolute = join(worktree, file)
      if (!existsSync(absolute)) return [file, 'missing']
      const stat = lstatSync(absolute)
      if (stat.isSymbolicLink()) return [file, sha256(`symlink:${readlinkSync(absolute)}`)]
      if (!stat.isFile()) return [file, `non-file:${stat.mode}`]
      return [file, sha256(readFileSync(absolute))]
    }),
  )
}

export function changedBetween(before = {}, after = {}) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) => before[file] !== after[file]).sort()
}

function safeSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) throw new Error('hook payload has no real session_id')
  return sha256(sessionId).slice(0, 24)
}

export function ledgerPath(worktree, sessionId) {
  const root = process.env.DOCS_TDD_RULE_LEDGER_DIR || join(worktree, 'output-tdd/rule-consumption')
  return join(root, `${safeSessionId(sessionId)}.json`)
}

function initialState({ worktree, sessionId, client }) {
  const snapshot = changedFileSnapshot(worktree)
  return {
    version: 2,
    client,
    sessionId,
    worktree: resolve(worktree),
    head: currentHead(worktree),
    contextEpoch: 0,
    injectedRuleHashes: [],
    injectionEvents: [],
    pendingTools: {},
    receipts: [],
    tainted: [],
    baselineSnapshot: snapshot,
    lastSnapshot: snapshot,
    createdAt: now(),
    updatedAt: now(),
  }
}

function resetEpochState(state, { reason, head = state.head, snapshot, previousHead = state.head }) {
  state.version = 2
  state.head = head
  state.contextEpoch += 1
  state.injectedRuleHashes = []
  state.pendingTools = {}
  state.receipts = []
  state.baselineSnapshot = snapshot
  state.lastSnapshot = snapshot
  state.injectionEvents.push({
    type: 'epoch',
    reason,
    previousHead,
    head,
    contextEpoch: state.contextEpoch,
    at: now(),
  })
  return state
}

function resetForHeadChange(state, worktree, head) {
  return resetEpochState(state, {
    reason: 'HEAD changed',
    head,
    snapshot: changedFileSnapshot(worktree),
  })
}

export function readLedger(worktree, sessionId) {
  const file = ledgerPath(worktree, sessionId)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

export function prepareLedger(identity) {
  return updateLedger(identity, (state) => state)
}

export function updateLedger({ worktree, sessionId, client }, update) {
  const file = ledgerPath(worktree, sessionId)
  mkdirSync(dirname(file), { recursive: true })
  const lock = `${file}.lock`
  let descriptor
  try {
    descriptor = openSync(lock, 'wx')
  } catch {
    throw new Error(`rule-consumption ledger is busy: ${file}`)
  }
  try {
    const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : initialState({ worktree, sessionId, client })
    if (existing.worktree !== resolve(worktree)) throw new Error('session ledger belongs to a different worktree')
    if (existing.client !== client) throw new Error('session ledger belongs to a different client')
    const head = currentHead(worktree)
    if (existing.head !== head) resetForHeadChange(existing, worktree, head)
    const next = update(existing) || existing
    next.updatedAt = now()
    const temporary = `${file}.${process.pid}.tmp`
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`)
    renameSync(temporary, file)
    return next
  } finally {
    if (descriptor != null) closeSync(descriptor)
    rmSync(lock, { force: true })
  }
}

export function advanceContextEpoch(identity, reason) {
  return updateLedger(identity, (state) => {
    return resetEpochState(state, {
      reason,
      snapshot: changedFileSnapshot(identity.worktree),
    })
  })
}

export function recordInjection(identity, { ruleHashes, packFingerprint, targets, channel, byteLength }) {
  return updateLedger(identity, (state) => {
    state.injectedRuleHashes = [...new Set([...state.injectedRuleHashes, ...ruleHashes])].sort()
    state.injectionEvents.push({
      type: 'inject',
      contextEpoch: state.contextEpoch,
      ruleHashes,
      packFingerprint,
      targets,
      channel,
      byteLength,
      at: now(),
    })
    return state
  })
}

export function recordPendingTool(identity, { toolUseId, targets, perFile, packFingerprint }) {
  if (!toolUseId) throw new Error('hook payload has no tool_use_id')
  return updateLedger(identity, (state) => {
    state.pendingTools[toolUseId] = {
      targets,
      perFile,
      packFingerprint,
      contextEpoch: state.contextEpoch,
      at: now(),
    }
    return state
  })
}

export function recordPostTool(identity, { toolUseId }) {
  return updateLedger(identity, (state) => {
    const current = changedFileSnapshot(identity.worktree)
    const changed = changedBetween(state.lastSnapshot, current)
    const pending = state.pendingTools[toolUseId]
    const expected = new Set(pending?.targets || [])
    for (const file of changed) {
      if (!pending || pending.contextEpoch !== state.contextEpoch || !expected.has(file)) {
        state.tainted.push({
          file,
          toolUseId,
          contextEpoch: state.contextEpoch,
          reason: 'changed without a matching allowed PreToolUse receipt',
          at: now(),
        })
        continue
      }
      const rule = pending.perFile[file]
      state.receipts.push({
        file,
        fileHash: current[file] || 'missing',
        toolUseId,
        contextEpoch: state.contextEpoch,
        head: state.head,
        packFingerprint: rule.packFingerprint,
        ruleHashes: rule.ruleHashes,
        at: now(),
      })
    }
    delete state.pendingTools[toolUseId]
    state.lastSnapshot = current
    return state
  })
}

export function verifyConsumption({ worktree, sessionId, client, resolveFile }) {
  const state = readLedger(worktree, sessionId)
  if (!state)
    return {
      ok: false,
      errors: ['missing rule-consumption ledger'],
      files: [],
    }
  const errors = []
  if (state.client !== client) errors.push(`ledger client is ${state.client}, expected ${client}`)
  if (state.worktree !== resolve(worktree)) errors.push('ledger worktree mismatch')
  if (state.head !== currentHead(worktree)) errors.push('ledger HEAD is stale')
  const current = changedFileSnapshot(worktree)
  const changed = changedBetween(state.baselineSnapshot, current)
  const tainted = new Set(state.tainted.filter((item) => item.contextEpoch === state.contextEpoch).map((item) => item.file))
  for (const file of changed) {
    if (tainted.has(file)) {
      errors.push(`${file}: tainted by an uncovered write`)
      continue
    }
    const expected = resolveFile(file)
    const receipt = [...state.receipts].reverse().find((item) => item.file === file && item.contextEpoch === state.contextEpoch)
    if (!receipt) {
      errors.push(`${file}: missing current consumption receipt`)
      continue
    }
    if (receipt.fileHash !== (current[file] || 'missing')) errors.push(`${file}: receipt content hash is stale`)
    if (receipt.packFingerprint !== expected.packFingerprint) errors.push(`${file}: matched rule pack changed after receipt`)
    if (JSON.stringify(receipt.ruleHashes) !== JSON.stringify(expected.ruleHashes)) errors.push(`${file}: matched rule hashes differ from receipt`)
  }
  return { ok: errors.length === 0, errors, files: changed, state }
}

export function verifyWorktreeConsumption({ worktree, sessionId, client, conflictOverrides = [] }) {
  if (!sessionId)
    return {
      ok: false,
      errors: ['a real --session-id or client session environment variable is required'],
      files: [],
    }
  return verifyConsumption({
    worktree,
    sessionId,
    client,
    resolveFile(file) {
      const pack = resolveRulePack({
        worktree,
        targetFiles: [file],
        conflictOverrides,
      })
      return {
        packFingerprint: pack.fingerprint,
        ruleHashes: pack.matchedRules.map((rule) => rule.sourceHash),
      }
    },
  })
}

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`rule-consumption self-test failed: ${message}`)
  }
  assert(changedBetween({ a: '1', b: '2' }, { a: '1', b: '3', c: '4' }).join(',') === 'b,c', 'snapshot delta')
  assert(changedBetween({ a: '1' }, {}).join(',') === 'a', 'deleted file delta')
  assert(isInsidePath('/repo/output-tdd/rule-consumption', '/repo/output-tdd/rule-consumption/session.json'), 'ledger path containment')
  assert(!isInsidePath('/repo/output-tdd/rule-consumption', '/repo/src/a.ts'), 'non-ledger path exclusion')
  const state = {
    version: 1,
    head: 'old',
    contextEpoch: 2,
    injectedRuleHashes: ['rule'],
    injectionEvents: [],
    pendingTools: { tool: {} },
    receipts: [{}],
    baselineSnapshot: { old: '1' },
    lastSnapshot: { old: '1' },
  }
  resetEpochState(state, {
    reason: 'HEAD changed',
    head: 'new',
    snapshot: { dirty: '2' },
  })
  assert(state.version === 2 && state.head === 'new' && state.contextEpoch === 3, 'HEAD reset advances the ledger epoch')
  assert(Object.keys(state.baselineSnapshot).join(',') === 'dirty' && state.receipts.length === 0, 'HEAD reset establishes a fresh baseline')
  console.log('PASS rule-consumption (snapshot delta and epoch reset)')
}

if (process.argv[1]?.endsWith('rule-consumption.mjs') && process.argv.includes('--self-test')) selfTest()
