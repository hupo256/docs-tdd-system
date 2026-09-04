#!/usr/bin/env node
// Minimal vNext artifact store: work-item.json + latest-result.json + append-only runs.jsonl.
// All mutations are explicit, lock-bounded, atomic where replaceable, and idempotent by runId.

import assert from 'node:assert/strict'
import {
  appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  readdirSync, renameSync, rmSync, statSync, unlinkSync, utimesSync, writeFileSync,
} from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { buildVNextExitResult, verifyExitResultIntegrity } from './vnext-exit.mjs'
import { stableFingerprint } from './vnext-work-item.mjs'

export const VNEXT_ARTIFACT_FILES = Object.freeze(['work-item.json', 'latest-result.json', 'runs.jsonl'])
const lockName = '.vnext-write.lock'
const sleepBuffer = new Int32Array(new SharedArrayBuffer(4))

function sleep(milliseconds) {
  Atomics.wait(sleepBuffer, 0, 0, milliseconds)
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function atomicWrite(file, content) {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  let descriptor
  try {
    descriptor = openSync(temporary, 'wx')
    writeFileSync(descriptor, content, 'utf8')
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, file)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function acquireLock(outDir, { timeoutMs = 5000, retryMs = 25, staleMs = 30000 } = {}) {
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, lockName)
  const deadline = Date.now() + timeoutMs
  while (true) {
    try {
      const descriptor = openSync(file, 'wx')
      writeFileSync(descriptor, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }))
      closeSync(descriptor)
      return () => {
        if (existsSync(file)) unlinkSync(file)
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        if (Date.now() - statSync(file).mtimeMs > staleMs) {
          unlinkSync(file)
          continue
        }
      } catch (statError) {
        if (statError.code === 'ENOENT') continue
        throw statError
      }
      if (Date.now() >= deadline) throw new Error(`timed out waiting for vNext artifact lock: ${file}`)
      sleep(retryMs)
    }
  }
}

function appendDurable(file, line) {
  const descriptor = openSync(file, 'a')
  try {
    appendFileSync(descriptor, line, 'utf8')
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

export function readVNextRunHistory(outDir) {
  const file = join(resolve(outDir), 'runs.jsonl')
  if (!existsSync(file)) return []
  const lines = readFileSync(file, 'utf8').split('\n').filter((line) => line.trim())
  const runs = lines.map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`invalid runs.jsonl line ${index + 1}: ${error.message}`)
    }
  })
  const seen = new Map()
  for (const run of runs) {
    const integrity = verifyExitResultIntegrity(run)
    if (!integrity.ok) throw new Error(`invalid stored run ${run.runId || 'unknown'}: ${integrity.problems.join('; ')}`)
    if (!run.runId?.trim()) throw new Error('stored run is missing runId')
    if (seen.has(run.runId) && seen.get(run.runId) !== run.resultFingerprint) throw new Error(`conflicting stored runId: ${run.runId}`)
    seen.set(run.runId, run.resultFingerprint)
  }
  return runs
}

function appendIfAbsent(outDir, result, history) {
  const existing = history.find((run) => run.runId === result.runId)
  if (existing) {
    if (existing.resultFingerprint !== result.resultFingerprint) throw new Error(`runId conflict: ${result.runId}`)
    return false
  }
  appendDurable(join(outDir, 'runs.jsonl'), `${JSON.stringify(result)}\n`)
  history.push(result)
  return true
}

function recoverLatest(outDir, history) {
  const latestFile = join(outDir, 'latest-result.json')
  if (!existsSync(latestFile)) {
    if (history.length) {
      atomicWrite(latestFile, json(history.at(-1)))
      return true
    }
    return false
  }
  const latest = readJson(latestFile)
  const integrity = verifyExitResultIntegrity(latest)
  if (!integrity.ok) throw new Error(`invalid latest-result.json: ${integrity.problems.join('; ')}`)
  return appendIfAbsent(outDir, latest, history)
}

function assertWorkItem(workItem) {
  if (workItem?.schemaVersion !== 1 || workItem?.workflowVersion !== 2 || !/^PR-\d{5}$/.test(workItem?.projectId || '')) {
    throw new Error('work item must be schemaVersion=1, workflowVersion=2, and have a PR-xxxxx projectId')
  }
}

export function initializeVNextArtifacts(outDir, workItem, lockOptions = {}) {
  assertWorkItem(workItem)
  const absolute = resolve(outDir)
  const release = acquireLock(absolute, lockOptions)
  try {
    const workFile = join(absolute, 'work-item.json')
    const latestFile = join(absolute, 'latest-result.json')
    if (existsSync(latestFile)) {
      const latest = readJson(latestFile)
      if (latest.workItemFingerprint !== stableFingerprint(workItem)) throw new Error('cannot replace an active work item without writing its matching verification result')
    }
    if (existsSync(workFile) && stableFingerprint(readJson(workFile)) === stableFingerprint(workItem)) return { initialized: false, idempotent: true, files: readdirSync(absolute).filter((name) => name !== lockName).sort() }
    atomicWrite(workFile, json(workItem))
    return { initialized: true, idempotent: false, files: readdirSync(absolute).filter((name) => name !== lockName).sort() }
  } finally {
    release()
  }
}

export function persistVNextRun(outDir, { workItem, result }, options = {}) {
  assertWorkItem(workItem)
  const integrity = verifyExitResultIntegrity(result, workItem)
  if (!integrity.ok) throw new Error(`refusing to persist invalid result: ${integrity.problems.join('; ')}`)
  if (!result.runId?.trim()) throw new Error('result runId is required')
  if (result.projectId !== workItem.projectId) throw new Error('result projectId does not match work item')

  const absolute = resolve(outDir)
  const release = acquireLock(absolute, options.lock)
  try {
    const history = readVNextRunHistory(absolute)
    const recovered = recoverLatest(absolute, history)
    const duplicate = history.find((run) => run.runId === result.runId)
    if (duplicate) {
      if (duplicate.resultFingerprint !== result.resultFingerprint) throw new Error(`runId conflict: ${result.runId}`)
      return { written: false, idempotent: true, recovered, runCount: history.length, files: VNEXT_ARTIFACT_FILES }
    }

    atomicWrite(join(absolute, 'work-item.json'), json(workItem))
    atomicWrite(join(absolute, 'latest-result.json'), json(result))
    if (options.failAfterLatest) throw new Error('injected interruption after latest-result write')
    const written = appendIfAbsent(absolute, result, history)
    return { written, idempotent: false, recovered, runCount: history.length, files: VNEXT_ARTIFACT_FILES }
  } finally {
    release()
  }
}

function sample(runId, generatedAt = '2026-09-04T00:00:03Z') {
  const code = { headSha: 'abc1234', baseSha: 'base1234', dirtyHash: 'dirty', dirtyFileCount: 0, untrackedFileCount: 0, isGitRepo: true }
  const workItem = {
    schemaVersion: 1, workflowVersion: 2, projectId: 'PR-00001', routing: { verificationLevel: 'V0' }, apiDependency: { mode: 'no-request', reason: 'fixture' },
    requirements: [{ requirementId: 'R-001', status: 'doing', evidencePlan: [{ type: 'pure-logic' }], affectedSurfaces: [] }],
  }
  const fact = (evidenceId, kind, requirementIds = []) => ({
    evidenceId, kind, result: 'pass', codeFingerprint: code, requirementIds, surfaceIds: [], evidenceRefs: [`logs/${evidenceId}.txt`],
    producer: { kind: 'command', command: `test ${kind}`, exitCode: 0, startedAt: '2026-09-04T00:00:00Z', finishedAt: '2026-09-04T00:00:01Z' },
  })
  const evidence = { runId, capturedAt: '2026-09-04T00:00:02Z', codeFingerprint: code, facts: [fact(`${runId}-quality`, 'touched-file-quality'), fact(`${runId}-req`, 'pure-logic', ['R-001'])] }
  return { workItem, result: buildVNextExitResult({ workItem, currentCodeState: code, evidence, blockers: [], generatedAt }) }
}

function spawnWorker(payloadFile) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', payloadFile], { stdio: 'pipe' })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('error', reject)
    child.on('close', (status) => status === 0 ? resolvePromise(output) : reject(new Error(`persistence worker failed (${status}): ${output}`)))
  })
}

export async function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-persist-'))
  try {
    const basic = join(root, 'basic')
    const first = sample('run-1')
    assert.deepEqual(initializeVNextArtifacts(basic, first.workItem).files, ['work-item.json'])
    assert.equal(initializeVNextArtifacts(basic, first.workItem).idempotent, true)
    assert.equal(persistVNextRun(basic, first).written, true)
    assert.equal(persistVNextRun(basic, first).idempotent, true)
    assert.deepEqual(readdirSync(basic).sort(), [...VNEXT_ARTIFACT_FILES].sort())
    assert.equal(readVNextRunHistory(basic).length, 1)
    const conflict = sample('run-1', '2026-09-04T00:00:04Z')
    assert.throws(() => persistVNextRun(basic, conflict), /runId conflict/)

    const interrupted = join(root, 'interrupted')
    assert.throws(() => persistVNextRun(interrupted, sample('run-a'), { failAfterLatest: true }), /injected interruption/)
    assert.equal(readVNextRunHistory(interrupted).length, 0)
    persistVNextRun(interrupted, sample('run-b', '2026-09-04T00:00:04Z'))
    assert.deepEqual(readVNextRunHistory(interrupted).map((run) => run.runId), ['run-a', 'run-b'])

    const stale = join(root, 'stale-lock')
    mkdirSync(stale, { recursive: true })
    writeFileSync(join(stale, lockName), '{}')
    const old = new Date(Date.now() - 60000)
    utimesSync(join(stale, lockName), old, old)
    assert.equal(persistVNextRun(stale, sample('run-stale'), { lock: { staleMs: 10 } }).written, true)

    const concurrent = join(root, 'concurrent')
    const payloads = Array.from({ length: 6 }, (_, index) => {
      const payloadFile = join(root, `worker-${index}.json`)
      writeFileSync(payloadFile, JSON.stringify({ outDir: concurrent, bundle: sample(`parallel-${index}`, `2026-09-04T00:00:0${index}Z`) }))
      return payloadFile
    })
    await Promise.all(payloads.map(spawnWorker))
    const parallelRuns = readVNextRunHistory(concurrent)
    assert.equal(parallelRuns.length, 6)
    assert.equal(new Set(parallelRuns.map((run) => run.runId)).size, 6)
    assert.deepEqual(readdirSync(concurrent).sort(), [...VNEXT_ARTIFACT_FILES].sort())
    console.log('vnext-persistence self-test passed (atomic, idempotent, recovery, stale-lock, concurrency)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirect && process.argv.includes('--worker')) {
  const workerPath = process.argv[process.argv.indexOf('--worker') + 1]
  const payload = readJson(resolve(workerPath))
  persistVNextRun(payload.outDir, payload.bundle)
} else if (isDirect && process.argv.includes('--self-test')) {
  await selfTest()
}
