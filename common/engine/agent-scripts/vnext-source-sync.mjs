#!/usr/bin/env node
// Atomic v3.2 source refresh: fetch into a sibling staging directory, normalize and compare there,
// then swap source files and work-item snapshot together. A failed fetch never touches current input.

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { docsSystemRoot, resolveDocsPath, resolveRoots } from './lib/roots.mjs'
import { persistVNextWorkItem } from './lib/vnext-persistence.mjs'
import { normalizeSourceDocuments, readLocalSourceAsset } from './lib/vnext-source-units.mjs'
import { bindVNextIntake } from './lib/vnext-intake.mjs'
import { stableFingerprint } from './lib/vnext-work-item.mjs'
import { runSyncLarkDocs } from './sync-lark-docs.mjs'
import { initialAutopilotState } from './lib/vnext-autopilot.mjs'
import {
  evaluateRepairPolicy,
  initialRepairState,
  normalizeRepairState,
  recordRepairAttempt,
} from './lib/vnext-repair-policy.mjs'

const { consumerRoot, config: bindingConfig } = resolveRoots()

function docsPath(value, mustExist = false) {
  return resolveDocsPath(value, { consumerRoot, docsMountPath: bindingConfig.docsMountPath, mustExist })
}

function canonicalAssetReader(stagedDocumentPath, canonicalDocumentPath) {
  return ({ target }) => {
    const staged = readLocalSourceAsset({ documentPath: stagedDocumentPath, target }, { root: docsSystemRoot })
    if (staged.status !== 'local') return staged
    let decoded = target.split(/[?#]/, 1)[0]
    try { decoded = decodeURIComponent(decoded) } catch { /* Keep malformed paths literal. */ }
    return { ...staged, assetPath: relative(docsSystemRoot, resolve(dirname(canonicalDocumentPath), decoded)) }
  }
}

function normalizeStaged(config, stageDir) {
  const canonicalOutput = docsPath(config.outputDir)
  const documents = []
  const readers = new Map()
  for (const source of config.sources || []) {
    const target = source.localizedTarget || source.target
    const stagedPath = resolve(stageDir, target)
    const canonicalPath = resolve(canonicalOutput, target)
    if (!existsSync(stagedPath)) throw new Error(`staged source is missing: ${target}`)
    const path = relative(docsSystemRoot, canonicalPath)
    documents.push({ path, content: readFileSync(stagedPath, 'utf8') })
    readers.set(path, canonicalAssetReader(stagedPath, canonicalPath))
  }
  const normalized = normalizeSourceDocuments(documents, {
    revision: 'content-addressed',
    readAsset: (asset) => readers.get(asset.documentPath)?.(asset) || readLocalSourceAsset(asset, { root: docsSystemRoot }),
  })
  normalized.sourceSnapshot.revision = normalized.sourceSnapshot.contentHash
  return normalized
}

function snapshotSemantics(snapshot) {
  if (!snapshot) return null
  const { revision: _revision, ...semantic } = snapshot
  return semantic
}

function pendingCoverage(reason) {
  return {
    sourceFingerprint: 'pending', requirementsFingerprint: 'pending', reviewMode: 'independent-cold-read',
    reviewRunId: 'pending', reviewer: { kind: 'model', id: 'pending' }, completedAt: '2000-01-01T00:00:00Z',
    verdict: 'changes-required', unresolved: [reason],
  }
}

function sourceRepairInputFingerprint(workItem, sourceConfig) {
  return stableFingerprint({
    sourceSnapshot: workItem?.sourceSnapshot || null,
    sourceConfig,
  })
}

function sourceFailureFingerprint(error) {
  return stableFingerprint({
    name: error?.name || 'Error',
    message: error?.message || String(error),
  })
}

function persistSourceFailure(projectDir, workItem, sourceConfig, error, generatedAt = new Date().toISOString()) {
  const repair = normalizeRepairState(workItem.autopilot?.repair, workItem.autopilot?.repairAttempts)
  const inputFingerprint = sourceRepairInputFingerprint(workItem, sourceConfig)
  const failureFingerprint = sourceFailureFingerprint(error)
  const decision = evaluateRepairPolicy({
    repairState: repair,
    failureDomains: ['source'],
    inputFingerprint,
    failureFingerprint,
  })
  const nextRepair = decision.allowed
    ? recordRepairAttempt(repair, {
      failureDomains: ['source'],
      inputFingerprint,
      failureFingerprint,
      generatedAt,
    })
    : repair
  const next = structuredClone(workItem)
  next.autopilot = {
    ...initialAutopilotState(generatedAt),
    ...(next.autopilot || {}),
    repair: nextRepair,
    repairAttempts: {
      code: nextRepair.attempts.code,
      browser: nextRepair.attempts.browser,
    },
  }
  persistVNextWorkItem(projectDir, next)
  return { decision, repair: nextRepair }
}

export function sourceDriftSummary(oldSnapshot, normalized) {
  const before = new Map((oldSnapshot?.sources || []).map((item) => [item.path, item.contentHash]))
  const after = new Map((normalized.sourceSnapshot.sources || []).map((item) => [item.path, item.contentHash]))
  const changedPaths = [...new Set([...before.keys(), ...after.keys()])].filter((path) => before.get(path) !== after.get(path)).sort()
  return {
    previousContentHash: oldSnapshot?.contentHash || '',
    currentContentHash: normalized.sourceSnapshot.contentHash,
    changedPaths,
    sourceUnitCount: normalized.sourceUnits.length,
    tableRowUnitCount: normalized.sourceUnits.filter((unit) => unit.type === 'table' && unit.tableRole === 'row').length,
    assetCount: normalized.sourceSnapshot.assets?.length || 0,
  }
}

export async function syncVNextSource(projectDir, { dryRun = false, sync = runSyncLarkDocs } = {}) {
  const absoluteProject = resolve(projectDir)
  const workItemFile = join(absoluteProject, 'work-item.json')
  const configFile = join(absoluteProject, 'agent/lark-sources.json')
  const workItem = JSON.parse(readFileSync(workItemFile, 'utf8'))
  const sourceConfig = JSON.parse(readFileSync(configFile, 'utf8'))
  if (dryRun) {
    await sync({ argv: ['--config', configFile, '--dry-run'] })
    return { projectId: workItem.projectId, dryRun: true, changed: false, nextAction: 'rerun-without-dry-run' }
  }

  const outputDir = docsPath(sourceConfig.outputDir)
  const parent = dirname(outputDir)
  mkdirSync(parent, { recursive: true })
  const token = randomUUID()
  const stageDir = join(parent, `.lark-sync-stage-${token}`)
  const backupDir = join(parent, `.lark-sync-backup-${token}`)
  const stagedConfigFile = join(absoluteProject, 'agent', `.source-sync-${token}.json`)
  writeFileSync(stagedConfigFile, `${JSON.stringify({ ...sourceConfig, outputDir: stageDir }, null, 2)}\n`)
  let swapped = false
  try {
    try {
      await sync({ argv: ['--config', stagedConfigFile] })
    } catch (error) {
      persistSourceFailure(absoluteProject, workItem, sourceConfig, error)
      throw error
    }
    const normalized = normalizeStaged(sourceConfig, stageDir)
    const summary = sourceDriftSummary(workItem.sourceSnapshot, normalized)
    if (stableFingerprint(snapshotSemantics(workItem.sourceSnapshot)) === stableFingerprint(snapshotSemantics(normalized.sourceSnapshot))) {
      return { projectId: workItem.projectId, dryRun: false, changed: false, summary, nextAction: 'continue-current-action' }
    }

    if (existsSync(outputDir)) renameSync(outputDir, backupDir)
    renameSync(stageDir, outputDir)
    swapped = true
    const next = structuredClone(workItem)
    next.sourceSnapshot = normalized.sourceSnapshot
    if (next.intake) next.intake = bindVNextIntake(next.intake.kind, normalized.sourceSnapshot)
    next.coverageAudit = pendingCoverage('source changed; regenerate extraction and independent review')
    next.scopeApproval = null
    delete next.extractionAudit
    delete next.reviewControl
    if (next.autopilot) {
      next.autopilot.phase = 'intake'
      next.autopilot.implementation = { status: 'pending', changedPaths: [] }
      next.autopilot.repair = initialRepairState()
      next.autopilot.repairAttempts = { code: 0, browser: 0 }
      next.autopilot.lastCheckpointAt = new Date().toISOString()
    }
    try {
      persistVNextWorkItem(absoluteProject, next)
    } catch (error) {
      rmSync(outputDir, { recursive: true, force: true })
      if (existsSync(backupDir)) renameSync(backupDir, outputDir)
      swapped = false
      throw error
    }
    rmSync(backupDir, { recursive: true, force: true })
    return { projectId: workItem.projectId, dryRun: false, changed: true, summary, nextAction: `docs-tdd extract ${workItem.projectId} --out <extraction.json>` }
  } finally {
    rmSync(stagedConfigFile, { force: true })
    if (!swapped) rmSync(stageDir, { recursive: true, force: true })
    if (!swapped && existsSync(backupDir) && !existsSync(outputDir)) renameSync(backupDir, outputDir)
    else rmSync(backupDir, { recursive: true, force: true })
  }
}

export async function selfTest() {
  const oldSnapshot = { revision: 'remote-1', contentHash: 'old', sources: [{ path: 'a.md', contentHash: 'a' }] }
  const normalized = {
    sourceSnapshot: { revision: 'new', contentHash: 'new', sources: [{ path: 'a.md', contentHash: 'b' }, { path: 'b.md', contentHash: 'c' }] },
    sourceUnits: [{ type: 'text' }, { type: 'table', tableRole: 'row' }],
  }
  const summary = sourceDriftSummary(oldSnapshot, normalized)
  assert.deepEqual(summary.changedPaths, ['a.md', 'b.md'])
  assert.equal(summary.tableRowUnitCount, 1)
  assert.equal(stableFingerprint(snapshotSemantics({ ...oldSnapshot, revision: 'other' })), stableFingerprint(snapshotSemantics(oldSnapshot)))

  const root = join(docsSystemRoot, 'common', 'engine', `.source-sync-test-${process.pid}`)
  const projectDir = join(root, 'PR-00001')
  const outputDir = join(projectDir, 'inbox', 'lark-sync')
  try {
    mkdirSync(join(projectDir, 'agent'), { recursive: true })
    mkdirSync(outputDir, { recursive: true })
    const sourcePath = join(root, 'source.md')
    writeFileSync(sourcePath, 'Old requirement.\n')
    const canonicalPath = relative(docsSystemRoot, join(outputDir, 'prd.md'))
    writeFileSync(join(outputDir, 'prd.md'), 'Old requirement.\n')
    writeFileSync(join(outputDir, 'keep.marker'), 'unchanged')
    const initial = normalizeSourceDocuments([{ path: canonicalPath, content: 'Old requirement.\n' }], { revision: 'old' })
    initial.sourceSnapshot.revision = initial.sourceSnapshot.contentHash
    const workItem = {
      schemaVersion: 1, workflowVersion: 2, projectId: 'PR-00001',
      intake: bindVNextIntake('bugfix', initial.sourceSnapshot), sourceSnapshot: initial.sourceSnapshot,
      requirements: [], coverageAudit: pendingCoverage('fixture'), routing: { scopeClass: 'local', riskSignals: ['unclassified'], verificationLevel: 'V0', routerVersion: 1 },
      apiDependency: { mode: 'no-request', reason: 'fixture' }, scopeApproval: null,
    }
    writeFileSync(join(projectDir, 'work-item.json'), `${JSON.stringify(workItem, null, 2)}\n`)
    writeFileSync(join(projectDir, 'agent', 'lark-sources.json'), `${JSON.stringify({ projectId: 'PR-00001', outputDir, sources: [{ type: 'markdown', operation: 'read', name: 'PRD', url: sourcePath, target: 'prd.md' }] }, null, 2)}\n`)
    const fakeSync = async ({ argv }) => {
      const stagedConfig = JSON.parse(readFileSync(argv[argv.indexOf('--config') + 1], 'utf8'))
      mkdirSync(stagedConfig.outputDir, { recursive: true })
      writeFileSync(join(stagedConfig.outputDir, 'prd.md'), readFileSync(sourcePath, 'utf8'))
    }
    const noChange = await syncVNextSource(projectDir, { sync: fakeSync })
    assert.equal(noChange.changed, false)
    assert.equal(readFileSync(join(outputDir, 'keep.marker'), 'utf8'), 'unchanged')

    writeFileSync(sourcePath, 'New requirement.\n')
    const changed = await syncVNextSource(projectDir, { sync: fakeSync })
    assert.equal(changed.changed, true)
    assert.equal(readFileSync(join(outputDir, 'prd.md'), 'utf8'), 'New requirement.\n')
    const refreshed = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
    assert.equal(refreshed.intake.sourceFingerprint, stableFingerprint(refreshed.sourceSnapshot))
    await assert.rejects(() => syncVNextSource(projectDir, { sync: async () => { throw new Error('network unavailable') } }), /network unavailable/)
    const afterFailure = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
    assert.equal(afterFailure.autopilot.phase, 'intake')
    assert.deepEqual(afterFailure.autopilot.implementation, { status: 'pending', changedPaths: [] })
    assert.equal(afterFailure.autopilot.repair.attempts.source, 1)
    assert.equal(afterFailure.autopilot.repair.terminalState, 'blocked-user-decision')
    await assert.rejects(() => syncVNextSource(projectDir, { sync: async () => { throw new Error('network unavailable') } }), /network unavailable/)
    const afterRepeatedFailure = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
    assert.equal(afterRepeatedFailure.autopilot.repair.attempts.source, 1)
    assert.equal(afterRepeatedFailure.sourceSnapshot.contentHash, refreshed.sourceSnapshot.contentHash)
    assert.equal(readFileSync(join(outputDir, 'prd.md'), 'utf8'), 'New requirement.\n')
    console.log('vnext-source-sync self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) await selfTest()
  else {
    syncVNextSource(argumentValue('--project'), { dryRun: process.argv.includes('--dry-run') })
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => {
        console.error(`vNext source sync failed: ${error.message}`)
        process.exitCode = 2
      })
  }
}
