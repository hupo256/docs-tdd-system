#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readlinkSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { resolveRulePack } from './l2-rule-resolver.mjs'
import { matchingPendingTool } from './rule-consumption-pairing.mjs'

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

function hashWorktreePath(worktree, file) {
  const absolute = join(worktree, file)
  if (!existsSync(absolute)) return 'missing'
  const stat = lstatSync(absolute)
  if (stat.isSymbolicLink()) return sha256(`symlink:${readlinkSync(absolute)}`)
  if (!stat.isFile()) return `non-file:${stat.mode}`
  return sha256(readFileSync(absolute))
}

function hashAtRevision(worktree, revision, file) {
  return hashFilesAtRevision(worktree, revision, [file]).get(file) || 'missing'
}

// `recordHeadChangeAudit` can see hundreds of files after a merge. Spawning one
// `git show` process per file made the synchronous Pi hook exceed its 20 second
// deadline and left the session unable to write. `cat-file --batch` resolves the
// same revision contents in one Git process while preserving the existing SHA-256
// receipt format.
function hashFilesAtRevision(worktree, revision, files) {
  const uniqueFiles = [...new Set(files)]
  const hashes = new Map(uniqueFiles.map((file) => [file, 'missing']))
  if (!revision || uniqueFiles.length === 0) return hashes

  const input = `${uniqueFiles.map((file) => `${revision}:${file}`).join('\n')}\n`
  const result = spawnSync('git', ['cat-file', '--batch'], {
    cwd: worktree,
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
  })
  if (result.status !== 0 || result.error || !Buffer.isBuffer(result.stdout)) return hashes

  let offset = 0
  for (const file of uniqueFiles) {
    const headerEnd = result.stdout.indexOf(10, offset)
    if (headerEnd < 0) return hashes
    const header = result.stdout.subarray(offset, headerEnd).toString('utf8')
    offset = headerEnd + 1
    if (header.endsWith(' missing')) continue
    const match = /^[0-9a-f]+ blob (\d+)$/.exec(header)
    if (!match) return hashes
    const size = Number(match[1])
    const contentEnd = offset + size
    if (!Number.isSafeInteger(size) || contentEnd > result.stdout.length) return hashes
    hashes.set(file, sha256(result.stdout.subarray(offset, contentEnd)))
    offset = contentEnd + 1 // git appends one LF after every batch payload
  }
  return hashes
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
  const head = currentHead(worktree)
  return {
    version: 3,
    client,
    sessionId,
    worktree: resolve(worktree),
    head,
    auditBaselineHead: head,
    auditBaselineSnapshot: snapshot,
    contextEpoch: 0,
    firstEditAt: null,
    editAttemptCount: 0,
    injectedRuleHashes: [],
    injectionEvents: [],
    pendingTools: {},
    receipts: [],
    tainted: [],
    touchedFiles: {},
    lastFileHashes: { ...snapshot },
    baselineSnapshot: snapshot,
    lastSnapshot: snapshot,
    createdAt: now(),
    epochStartedAt: now(),
    updatedAt: now(),
  }
}

function migrateState(state, worktree) {
  const legacy = state.version !== 3
  state.version = 3
  state.auditBaselineHead ||= state.head
  state.auditBaselineSnapshot ||= state.baselineSnapshot || {}
  state.touchedFiles ||= {}
  state.lastFileHashes ||= { ...(state.lastSnapshot || {}) }
  state.receipts ||= []
  state.tainted ||= []
  state.pendingTools ||= {}
  state.injectedRuleHashes ||= []
  state.injectionEvents ||= []
  state.epochStartedAt ||= state.createdAt || now()
  state.firstEditAt ||= null
  state.editAttemptCount ||= 0
  if (legacy && worktree) {
    const current = changedFileSnapshot(worktree)
    const changedFiles = changedBetween(state.auditBaselineSnapshot, current)
    const baselineHashes = hashFilesAtRevision(
      worktree,
      state.auditBaselineHead,
      changedFiles.filter((file) => !Object.hasOwn(state.auditBaselineSnapshot, file)),
    )
    for (const file of changedFiles) {
      const baselineHash = Object.hasOwn(state.auditBaselineSnapshot, file) ? state.auditBaselineSnapshot[file] : baselineHashes.get(file) || 'missing'
      const currentHash = hashWorktreePath(worktree, file)
      state.touchedFiles[file] ||= { baselineHash, firstTouchedAt: now() }
      state.lastFileHashes[file] = currentHash
      const receipt = [...state.receipts].reverse().find((item) => item.file === file && item.fileHash === currentHash)
      if (!receipt && !state.tainted.some((item) => item.file === file)) {
        state.tainted.push({
          file,
          toolUseId: null,
          contextEpoch: state.contextEpoch,
          reason: 'legacy ledger migrated with an uncovered write',
          at: now(),
        })
      }
    }
    state.lastSnapshot = current
  }
  return state
}

function resetEpochState(state, { reason, head = state.head, previousHead = state.head, preserveInjectedRuleHashes = false }) {
  migrateState(state)
  state.head = head
  state.contextEpoch += 1
  state.epochStartedAt = now()
  state.firstEditAt = null
  state.editAttemptCount = 0
  if (!preserveInjectedRuleHashes) state.injectedRuleHashes = []
  state.pendingTools = {}
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

function resetForHeadChange(state, head, { preserveInjectedRuleHashes = false } = {}) {
  return resetEpochState(state, {
    reason: 'HEAD changed',
    head,
    preserveInjectedRuleHashes,
  })
}

function recordHeadChangeAudit(state, worktree, previousHead, head) {
  if (!previousHead || !head) return
  const files = git(['diff', '--name-only', '-z', previousHead, head], worktree).split('\0').filter(Boolean)
  const baselineHashes = hashFilesAtRevision(
    worktree,
    state.auditBaselineHead,
    files.filter((file) => !Object.hasOwn(state.auditBaselineSnapshot, file)),
  )
  const latestReceipts = new Map(state.receipts.map((receipt) => [receipt.file, receipt]))
  for (const file of files) {
    const baselineHash = Object.hasOwn(state.auditBaselineSnapshot, file) ? state.auditBaselineSnapshot[file] : baselineHashes.get(file) || 'missing'
    const currentHash = hashWorktreePath(worktree, file)
    state.touchedFiles[file] ||= { baselineHash, firstTouchedAt: now() }
    state.lastFileHashes[file] = currentHash
    const receipt = latestReceipts.get(file)
    if (!receipt || receipt.fileHash !== currentHash) {
      state.tainted.push({
        file,
        toolUseId: null,
        contextEpoch: state.contextEpoch,
        reason: 'committed without a matching content receipt',
        at: now(),
      })
    }
  }
}

export function readLedger(worktree, sessionId) {
  const file = ledgerPath(worktree, sessionId)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

export function prepareLedger(identity) {
  return updateLedger(identity, (state) => state)
}

const LOCK_TTL_MS = 60_000
// Stay comfortably below the adapter's 20 second subprocess deadline. A busy
// ledger should fail with its own actionable error instead of being killed by
// the parent and reported as an opaque spawnSync ETIMEDOUT.
const LOCK_WAIT_TIMEOUT_MS = 4_000
const LOCK_BACKOFF_MIN_MS = 15
const LOCK_BACKOFF_MAX_MS = 150

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
}

function staleLock(lock) {
  try {
    const age = Date.now() - statSync(lock).mtimeMs
    let owner = null
    try {
      owner = JSON.parse(readFileSync(lock, 'utf8'))
    } catch {}
    const ownerPid = Number(owner?.pid)
    return age > LOCK_TTL_MS || (Number.isInteger(ownerPid) && ownerPid > 0 && !processExists(ownerPid))
  } catch {
    return false
  }
}

function acquireLedgerLock(lock, identity) {
  const startedAt = Date.now()
  let attempt = 0
  while (true) {
    try {
      const descriptor = openSync(lock, 'wx')
      writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, sessionId: identity.sessionId, createdAt: now() })}\n`)
      return descriptor
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      if (staleLock(lock)) {
        rmSync(lock, { force: true })
        continue
      }
      const remaining = LOCK_WAIT_TIMEOUT_MS - (Date.now() - startedAt)
      if (remaining <= 0) break
      const backoff = Math.min(LOCK_BACKOFF_MAX_MS, LOCK_BACKOFF_MIN_MS * 2 ** Math.min(attempt, 4))
      sleepSync(Math.min(remaining, backoff + Math.floor(Math.random() * LOCK_BACKOFF_MIN_MS)))
      attempt += 1
    }
  }
  throw new Error(`rule-consumption ledger remained busy for ${LOCK_WAIT_TIMEOUT_MS}ms: ${lock.replace(/\.lock$/, '')}`)
}

export function updateLedger({ worktree, sessionId, client, workflowVersion }, update) {
  const file = ledgerPath(worktree, sessionId)
  mkdirSync(dirname(file), { recursive: true })
  const lock = `${file}.lock`
  const descriptor = acquireLedgerLock(lock, { worktree, sessionId, client })
  try {
    const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : initialState({ worktree, sessionId, client })
    migrateState(existing, worktree)
    if (existing.worktree !== resolve(worktree)) throw new Error('session ledger belongs to a different worktree')
    if (existing.client !== client) throw new Error('session ledger belongs to a different client')
    const head = currentHead(worktree)
    // 注入新鲜度绑定规则 sourceHash，而不是 HEAD：业务提交不会让未变化规则反复占用上下文；
    // SessionStart/PreCompact 仍通过 advanceContextEpoch 显式清空，规则正文变化则自然产生新 hash。
    const preserveInjectedRuleHashes = true
    if (existing.head !== head) {
      recordHeadChangeAudit(existing, worktree, existing.head, head)
      resetForHeadChange(existing, head, { preserveInjectedRuleHashes })
    }
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
    })
  })
}

export function recordEditObservation(identity) {
  return updateLedger(identity, (state) => {
    state.editAttemptCount += 1
    state.firstEditAt ||= now()
    return state
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
      beforeHashes: Object.fromEntries(targets.map((file) => [file, hashWorktreePath(identity.worktree, file)])),
      contextEpoch: state.contextEpoch,
      at: now(),
    }
    return state
  })
}

export function recordPostTool(identity, { toolUseId }) {
  return updateLedger(identity, (state) => {
    const current = changedFileSnapshot(identity.worktree)
    const directPending = state.pendingTools[toolUseId]
    const directExpected = new Set(directPending?.targets || [])
    const candidates = new Set([...changedBetween(state.lastSnapshot, current), ...directExpected])
    for (const file of candidates) {
      const currentHash = hashWorktreePath(identity.worktree, file)
      const baselineHash = Object.hasOwn(state.auditBaselineSnapshot, file) ? state.auditBaselineSnapshot[file] : hashAtRevision(identity.worktree, state.auditBaselineHead, file)
      const previousHash = directPending?.beforeHashes?.[file] ?? state.lastFileHashes[file] ?? baselineHash
      state.lastFileHashes[file] = currentHash
      if (previousHash === currentHash) {
        const tainted = state.tainted.some((item) => item.file === file)
        if (tainted && directPending?.contextEpoch === state.contextEpoch && directExpected.has(file) && directPending.perFile?.[file]) {
          const rule = directPending.perFile[file]
          state.receipts.push({
            file,
            fileHash: currentHash,
            toolUseId,
            contextEpoch: state.contextEpoch,
            head: state.head,
            packFingerprint: rule.packFingerprint,
            ruleHashes: rule.ruleHashes,
            reconciledTaint: true,
            at: now(),
          })
          state.tainted = state.tainted.filter((item) => item.file !== file)
        }
        continue
      }
      state.touchedFiles[file] ||= { baselineHash, firstTouchedAt: now() }
      if (currentHash === state.touchedFiles[file].baselineHash) {
        state.tainted = state.tainted.filter((item) => item.file !== file)
        continue
      }
      const match = matchingPendingTool(state, { toolUseId, file, previousHash })
      if (!match) {
        state.tainted.push({
          file,
          toolUseId,
          contextEpoch: state.contextEpoch,
          reason: 'changed without a matching allowed PreToolUse receipt',
          at: now(),
        })
        continue
      }
      const rule = match.pending.perFile[file]
      state.receipts.push({
        file,
        fileHash: currentHash,
        toolUseId,
        ...(match.preToolUseId !== toolUseId ? { preToolUseId: match.preToolUseId } : {}),
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
  migrateState(state, worktree)
  const changed = Object.entries(state.touchedFiles)
    .filter(([file, audit]) => hashWorktreePath(worktree, file) !== audit.baselineHash)
    .map(([file]) => file)
    .sort()
  const tainted = new Set(state.tainted.map((item) => item.file))
  for (const file of changed) {
    if (tainted.has(file)) {
      errors.push(`${file}: tainted by an uncovered write`)
      continue
    }
    const expected = resolveFile(file)
    const receipt = [...state.receipts].reverse().find((item) => item.file === file)
    if (!receipt) {
      errors.push(`${file}: missing current consumption receipt`)
      continue
    }
    if (receipt.fileHash !== hashWorktreePath(worktree, file)) errors.push(`${file}: receipt content hash is stale`)
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
    tainted: [{ file: 'old', contextEpoch: 1 }],
    touchedFiles: { old: { baselineHash: '0' } },
  }
  resetEpochState(state, {
    reason: 'HEAD changed',
    head: 'new',
  })
  assert(state.version === 3 && state.head === 'new' && state.contextEpoch === 3, 'HEAD reset advances the context epoch')
  assert(state.receipts.length === 1 && state.tainted.length === 1 && state.touchedFiles.old, 'epoch reset preserves audit evidence')

  const worktree = resolveGitWorktree(process.cwd())
  if (worktree) {
    const previousRoot = process.env.DOCS_TDD_RULE_LEDGER_DIR
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'docs-tdd-ledger-'))
    process.env.DOCS_TDD_RULE_LEDGER_DIR = temporaryRoot
    const staleIdentity = { worktree, sessionId: `self-test-${process.pid}`, client: 'self-test' }
    const stalePath = `${ledgerPath(worktree, staleIdentity.sessionId)}.lock`
    mkdirSync(dirname(stalePath), { recursive: true })
    writeFileSync(stalePath, '{"pid":99999999,"createdAt":"stale"}\n')
    assert(prepareLedger(staleIdentity).version === 3, 'stale lock is reclaimed')
    rmSync(temporaryRoot, { recursive: true, force: true })
    if (previousRoot == null) delete process.env.DOCS_TDD_RULE_LEDGER_DIR
    else process.env.DOCS_TDD_RULE_LEDGER_DIR = previousRoot
  }
  const auditRepo = mkdtempSync(join(tmpdir(), 'docs-tdd-audit-'))
  const auditLedger = mkdtempSync(join(tmpdir(), 'docs-tdd-audit-ledger-'))
  const previousRoot = process.env.DOCS_TDD_RULE_LEDGER_DIR
  try {
    spawnSync('git', ['init', '-q'], { cwd: auditRepo })
    spawnSync('git', ['config', 'user.email', 'self-test@example.invalid'], { cwd: auditRepo })
    spawnSync('git', ['config', 'user.name', 'Self Test'], { cwd: auditRepo })
    writeFileSync(join(auditRepo, 'a.txt'), 'before\n')
    spawnSync('git', ['add', 'a.txt'], { cwd: auditRepo })
    spawnSync('git', ['commit', '-qm', 'initial'], { cwd: auditRepo })
    const revisionHashes = hashFilesAtRevision(auditRepo, currentHead(auditRepo), ['a.txt', 'missing.txt'])
    assert(revisionHashes.get('a.txt') === sha256('before\n'), 'batch revision hashing preserves file content hashes')
    assert(revisionHashes.get('missing.txt') === 'missing', 'batch revision hashing preserves missing files')
    process.env.DOCS_TDD_RULE_LEDGER_DIR = auditLedger
    const legacyIdentity = { worktree: auditRepo, sessionId: 'legacy-session', client: 'self-test' }
    const legacy = prepareLedger(legacyIdentity)
    legacy.version = 2
    delete legacy.auditBaselineHead
    delete legacy.auditBaselineSnapshot
    delete legacy.touchedFiles
    delete legacy.lastFileHashes
    writeFileSync(ledgerPath(auditRepo, legacyIdentity.sessionId), `${JSON.stringify(legacy, null, 2)}\n`)
    writeFileSync(join(auditRepo, 'a.txt'), 'legacy-uncovered\n')
    prepareLedger(legacyIdentity)
    const legacyVerdict = verifyConsumption({ ...legacyIdentity, resolveFile: () => ({ packFingerprint: 'pack', ruleHashes: ['rule'] }) })
    assert(!legacyVerdict.ok && legacyVerdict.files.join(',') === 'a.txt', 'v2 migration backfills and taints uncovered edits')
    writeFileSync(join(auditRepo, 'a.txt'), 'before\n')

    const identity = { worktree: auditRepo, sessionId: 'audit-session', client: 'self-test', workflowVersion: 1 }
    recordInjection(identity, { ruleHashes: ['v1-rule'], packFingerprint: 'pack', targets: ['a.txt'], channel: 'test', byteLength: 50 })
    recordPendingTool(identity, {
      toolUseId: 'edit-1',
      targets: ['a.txt'],
      perFile: { 'a.txt': { packFingerprint: 'pack', ruleHashes: ['rule'] } },
      packFingerprint: 'pack',
    })
    writeFileSync(join(auditRepo, 'a.txt'), 'after\n')
    recordPostTool(identity, { toolUseId: 'edit-1' })
    advanceContextEpoch(identity, 'PreCompact')
    recordInjection(identity, { ruleHashes: ['v1-rule'], packFingerprint: 'pack', targets: ['a.txt'], channel: 'test-after-compact', byteLength: 50 })
    const resolveFile = () => ({ packFingerprint: 'pack', ruleHashes: ['rule'] })
    assert(verifyConsumption({ ...identity, resolveFile }).ok, 'PreCompact preserves receipts and touched files')
    spawnSync('git', ['add', 'a.txt'], { cwd: auditRepo })
    spawnSync('git', ['commit', '-qm', 'change'], { cwd: auditRepo })
    const v1State = prepareLedger(identity)
    const afterCommit = verifyConsumption({ ...identity, resolveFile })
    assert(afterCommit.ok && afterCommit.files.join(',') === 'a.txt', 'HEAD changes preserve the full-session audit')
    assert(JSON.stringify(v1State.injectedRuleHashes) === JSON.stringify(['v1-rule']), 'v1 HEAD change preserves source-hash freshness')
    const v2Identity = { worktree: auditRepo, sessionId: 'v2-persist', client: 'self-test', workflowVersion: 2 }
    recordInjection(v2Identity, { ruleHashes: ['rule-a', 'rule-b'], packFingerprint: 'pack', targets: ['a.txt'], channel: 'test', byteLength: 100 })
    recordPendingTool(v2Identity, { toolUseId: 'v2-edit', targets: ['a.txt'], perFile: { 'a.txt': { packFingerprint: 'pack', ruleHashes: ['rule-a', 'rule-b'] } }, packFingerprint: 'pack' })
    writeFileSync(join(auditRepo, 'a.txt'), 'v2\n')
    recordPostTool(v2Identity, { toolUseId: 'v2-edit' })
    spawnSync('git', ['add', 'a.txt'], { cwd: auditRepo })
    spawnSync('git', ['commit', '-qm', 'v2 change'], { cwd: auditRepo })
    const v2State = prepareLedger(v2Identity)
    assert(JSON.stringify(v2State.injectedRuleHashes) === JSON.stringify(['rule-a', 'rule-b']), 'v2 HEAD change preserves injected rule hashes')
    assert(v2State.contextEpoch === 1, 'v2 HEAD change still advances context epoch')

    writeFileSync(join(auditRepo, 'a.txt'), 'uncovered\n')
    recordPostTool(identity, { toolUseId: 'missing-pre-tool' })
    assert(!verifyConsumption({ ...identity, resolveFile }).ok, 'an uncovered write taints the file')
    recordPendingTool(identity, {
      toolUseId: 'restore-1',
      targets: ['a.txt'],
      perFile: { 'a.txt': { packFingerprint: 'pack', ruleHashes: ['rule'] } },
      packFingerprint: 'pack',
    })
    writeFileSync(join(auditRepo, 'a.txt'), 'before\n')
    recordPostTool(identity, { toolUseId: 'restore-1' })
    assert(verifyConsumption({ ...identity, resolveFile }).ok, 'restoring baseline content clears taint')

    const nestedIdentity = { worktree: auditRepo, sessionId: 'nested-tool-session', client: 'self-test', workflowVersion: 1 }
    recordPendingTool(nestedIdentity, {
      toolUseId: 'wrapper-tool',
      targets: ['a.txt'],
      perFile: { 'a.txt': { packFingerprint: 'pack', ruleHashes: ['rule'] } },
      packFingerprint: 'pack',
    })
    writeFileSync(join(auditRepo, 'a.txt'), 'nested-one\n')
    recordPostTool(nestedIdentity, { toolUseId: 'nested-apply-patch-1' })
    writeFileSync(join(auditRepo, 'a.txt'), 'nested-two\n')
    recordPostTool(nestedIdentity, { toolUseId: 'nested-apply-patch-2' })
    recordPostTool(nestedIdentity, { toolUseId: 'wrapper-tool' })
    const nestedState = readLedger(auditRepo, nestedIdentity.sessionId)
    assert(nestedState.tainted.length === 0, 'nested post-tool ids reuse the wrapper pre-tool target without false taint')
    assert(nestedState.receipts.some((receipt) => receipt.preToolUseId === 'wrapper-tool' && receipt.toolUseId === 'nested-apply-patch-2'), 'nested edits retain both pre-tool and post-tool ids for audit')
    assert(verifyConsumption({ ...nestedIdentity, resolveFile }).ok, 'nested wrapper edits produce a valid current-content receipt')
    writeFileSync(join(auditRepo, 'not-approved.txt'), 'uncovered\n')
    recordPostTool(nestedIdentity, { toolUseId: 'nested-unapproved-write' })
    assert(!verifyConsumption({ ...nestedIdentity, resolveFile }).ok, 'nested id reconciliation remains fail-closed for targets absent from PreToolUse')
    recordPendingTool(nestedIdentity, {
      toolUseId: 'explicit-recovery',
      targets: ['not-approved.txt'],
      perFile: { 'not-approved.txt': { packFingerprint: 'pack', ruleHashes: ['rule'] } },
      packFingerprint: 'pack',
    })
    recordPostTool(nestedIdentity, { toolUseId: 'explicit-recovery' })
    const recoveredState = readLedger(auditRepo, nestedIdentity.sessionId)
    assert(recoveredState.receipts.some((receipt) => receipt.reconciledTaint === true), 'an explicit supported-tool retry records taint recovery')
    assert(verifyConsumption({ ...nestedIdentity, resolveFile }).ok, 'an explicit supported-tool retry can recover false taint without changing file content')
  } finally {
    rmSync(auditRepo, { recursive: true, force: true })
    rmSync(auditLedger, { recursive: true, force: true })
    if (previousRoot == null) delete process.env.DOCS_TDD_RULE_LEDGER_DIR
    else process.env.DOCS_TDD_RULE_LEDGER_DIR = previousRoot
  }
  console.log('PASS rule-consumption (persistent audit epoch and stale lock recovery)')
}

if (process.argv[1]?.endsWith('rule-consumption.mjs') && process.argv.includes('--self-test')) selfTest()
