#!/usr/bin/env node
// Explicit compatibility layer for persisted v2 artifacts. It may remove obsolete display-only
// fields and recompute derived fingerprints, but it never fabricates code identity or evidence.

import assert from 'node:assert/strict'
import {
  closeSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync,
  rmSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSchema } from './doc-budget-schema.mjs'
import { verifyExitResultIntegrity } from './vnext-exit.mjs'
import { stableFingerprint } from './vnext-work-item.mjs'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const fixtureFile = join(moduleDir, '..', '..', 'fixtures', 'vnext-artifact-compat-cases.json')
const exitSchema = JSON.parse(readFileSync(join(moduleDir, '..', '..', 'schemas', 'vnext-exit-result.schema.json'), 'utf8'))
const allowedCheckFields = new Set(['code', 'ok', 'problems', 'evidenceIds'])
const lockName = '.vnext-artifact-compat.lock'
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

function resultBody(result) {
  const { resultFingerprint, ...body } = result
  return body
}

function derivedSummary(checks) {
  return {
    total: checks.length,
    passed: checks.filter((check) => check.ok).length,
    failed: checks.filter((check) => !check.ok).length,
  }
}

function sealFixtureResult(result) {
  const next = structuredClone(result)
  next.resultFingerprint = stableFingerprint(resultBody(next))
  return next
}

export function normalizeLatestResult(result) {
  const next = structuredClone(result)
  const changes = []
  const blockedReasons = []
  let requiresReverification = false

  if (!next || typeof next !== 'object' || Array.isArray(next)) {
    return {
      result: null,
      changes,
      blocked: true,
      blockedReasons: ['artifact is not a JSON object'],
      requiresReverification: true,
      beforeFingerprint: null,
      afterFingerprint: null,
    }
  }

  const beforeFingerprint = next.resultFingerprint || stableFingerprint(next)
  if (!next.assuranceMode && !next.evidenceTrust && !next.evidenceAttestation) {
    next.assuranceMode = 'assisted-pilot'
    next.evidenceTrust = 'caller-supplied'
    changes.push('declare legacy evidence as assisted-pilot/caller-supplied')
  } else {
    const autonomous = next.assuranceMode === 'autonomous' && next.evidenceTrust === 'cli-attested'
    const assisted = next.assuranceMode === 'assisted-pilot' && next.evidenceTrust === 'caller-supplied'
    if (!autonomous && !assisted) blockedReasons.push('assuranceMode/evidenceTrust cannot be normalized without inventing evidence trust')
  }

  if (!/^[a-f0-9]{64}$/.test(next.codeFingerprint?.contentHash || '')) {
    blockedReasons.push('codeFingerprint.contentHash is missing or invalid; dirtyHash cannot substitute for content identity')
    requiresReverification = true
  }

  if (!Array.isArray(next.checks)) {
    blockedReasons.push('checks must be an array')
  } else {
    next.checks = next.checks.map((check, index) => {
      if (!check || typeof check !== 'object' || Array.isArray(check)) {
        blockedReasons.push(`checks[${index}] is not an object`)
        return check
      }
      const normalized = {}
      for (const field of ['code', 'ok', 'problems', 'evidenceIds']) {
        if (Object.hasOwn(check, field)) normalized[field] = check[field]
      }
      for (const field of Object.keys(check)) {
        if (!allowedCheckFields.has(field)) changes.push(`remove checks[${check.code || index}].${field}`)
      }
      return normalized
    })
    const summary = derivedSummary(next.checks)
    if (JSON.stringify(next.summary) !== JSON.stringify(summary)) changes.push('recompute summary from checks')
    next.summary = summary
  }

  next.resultFingerprint = stableFingerprint(resultBody(next))
  if (next.resultFingerprint !== beforeFingerprint) changes.push('recompute resultFingerprint')

  if (!blockedReasons.length) {
    const integrity = verifyExitResultIntegrity(next)
    if (!integrity.ok) blockedReasons.push(...integrity.problems.map((problem) => `normalized integrity: ${problem}`))
    const schemaProblems = validateSchema(next, exitSchema, 'latest-result.json')
    if (schemaProblems.length) blockedReasons.push(...schemaProblems.map((problem) => `normalized schema: ${problem}`))
  }

  return {
    result: next,
    changes: [...new Set(changes)],
    blocked: blockedReasons.length > 0,
    blockedReasons: [...new Set(blockedReasons)],
    requiresReverification: requiresReverification || blockedReasons.length > 0,
    beforeFingerprint,
    afterFingerprint: blockedReasons.length ? null : next.resultFingerprint,
  }
}

function parseRuns(file) {
  if (!existsSync(file)) return []
  const lines = readFileSync(file, 'utf8').split('\n').filter((line) => line.trim())
  return lines.map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`runs.jsonl line ${index + 1} is invalid JSON: ${error.message}`)
    }
  })
}

function inspectArtifact(file, value, label) {
  const normalized = normalizeLatestResult(value)
  return {
    file,
    label,
    status: normalized.blocked ? 'blocked' : normalized.changes.length ? 'migration-available' : 'current',
    changes: normalized.changes,
    blockedReasons: normalized.blockedReasons,
    requiresReverification: normalized.requiresReverification,
    beforeFingerprint: normalized.beforeFingerprint,
    afterFingerprint: normalized.afterFingerprint,
    normalized: normalized.result,
  }
}

export function inspectVNextArtifacts({ projectDir } = {}) {
  const absolute = resolve(projectDir || '')
  const latestFile = join(absolute, 'latest-result.json')
  const runsFile = join(absolute, 'runs.jsonl')
  let projectId = ''
  try {
    const workItemFile = join(absolute, 'work-item.json')
    if (existsSync(workItemFile)) projectId = JSON.parse(readFileSync(workItemFile, 'utf8')).projectId || ''
  } catch {
    // Artifact-specific parse errors below remain the actionable diagnosis.
  }

  const artifacts = []
  const parseProblems = []
  let latest = null
  let runs = []
  if (existsSync(latestFile)) {
    try {
      latest = JSON.parse(readFileSync(latestFile, 'utf8'))
      projectId ||= latest.projectId || ''
      artifacts.push(inspectArtifact('latest-result.json', latest, latest.runId || 'latest'))
    } catch (error) {
      parseProblems.push(`latest-result.json is invalid JSON: ${error.message}`)
    }
  }
  if (existsSync(runsFile)) {
    try {
      runs = parseRuns(runsFile)
      for (const [index, run] of runs.entries()) {
        projectId ||= run.projectId || ''
        artifacts.push(inspectArtifact('runs.jsonl', run, `line ${index + 1}:${run.runId || 'unknown'}`))
      }
    } catch (error) {
      parseProblems.push(error.message)
    }
  }

  const duplicateRunIds = runs.map((run) => run.runId).filter((runId, index, all) => runId && all.indexOf(runId) !== index)
  if (duplicateRunIds.length) parseProblems.push(`runs.jsonl has duplicate runIds: ${[...new Set(duplicateRunIds)].join(', ')}`)
  if (latest && runs.length) {
    const matching = runs.find((run) => run.runId === latest.runId)
    if (!matching) parseProblems.push(`latest-result.json runId ${latest.runId || '(missing)'} is absent from runs.jsonl`)
    else if (matching.resultFingerprint !== latest.resultFingerprint) parseProblems.push(`latest-result.json conflicts with runs.jsonl for runId ${latest.runId}`)
  }

  const blockedReasons = [
    ...parseProblems,
    ...artifacts.flatMap((artifact) => artifact.blockedReasons.map((reason) => `${artifact.label}: ${reason}`)),
  ]
  const changes = [...new Set(artifacts.flatMap((artifact) => artifact.changes))]
  const requiresReverification = blockedReasons.length > 0 || artifacts.some((artifact) => artifact.requiresReverification)
  const latestArtifact = artifacts.find((artifact) => artifact.file === 'latest-result.json')
  return {
    mode: 'report-only',
    projectId,
    projectDir: absolute,
    artifacts: artifacts.map(({ normalized, ...artifact }) => artifact),
    changes,
    blocked: blockedReasons.length > 0,
    blockedReasons: [...new Set(blockedReasons)],
    requiresReverification,
    beforeFingerprint: latestArtifact?.beforeFingerprint || null,
    afterFingerprint: blockedReasons.length ? null : latestArtifact?.afterFingerprint || null,
    migrationAvailable: changes.length > 0 && blockedReasons.length === 0,
    _normalized: {
      latest: artifacts.find((artifact) => artifact.file === 'latest-result.json')?.normalized || null,
      runs: artifacts.filter((artifact) => artifact.file === 'runs.jsonl').map((artifact) => artifact.normalized),
    },
  }
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

export function artifactCompatibilitySchemaDiagnostic({ projectDir, projectId } = {}) {
  const workItemFile = join(projectDir, 'work-item.json')
  const hasResults = existsSync(join(projectDir, 'latest-result.json')) || existsSync(join(projectDir, 'runs.jsonl'))
  if (!existsSync(workItemFile) || !hasResults) return { skipExitResultSchema: false, problem: '' }
  try {
    const workItem = readJson(workItemFile)
    if (workItem.workflowVersion !== 2) return { skipExitResultSchema: false, problem: '' }
    const compatibility = inspectVNextArtifacts({ projectDir })
    if (compatibility.blocked) {
      return {
        skipExitResultSchema: true,
        problem: `❌ ${projectId} v2 artifacts require a fresh docs-tdd verify; compatibility migration is blocked: ${compatibility.blockedReasons.slice(0, 3).join('; ')}`,
      }
    }
    if (compatibility.migrationAvailable) {
      return {
        skipExitResultSchema: true,
        problem: `❌ ${projectId} v2 artifacts use a safe legacy shape; run docs-tdd artifact-compat ${projectId} --write, then rerun check.`,
      }
    }
    return { skipExitResultSchema: false, problem: '' }
  } catch (error) {
    return {
      skipExitResultSchema: true,
      problem: `❌ ${projectId}/work-item.json cannot be used for v2 artifact compatibility diagnosis: ${error.message}`,
    }
  }
}

export function migrateVNextArtifacts({ projectDir, write = false } = {}) {
  const report = inspectVNextArtifacts({ projectDir })
  const publicReport = { ...report, mode: write ? 'write' : 'report-only' }
  delete publicReport._normalized
  if (!write || report.blocked || !report.migrationAvailable) return { ...publicReport, written: false }

  const absolute = resolve(projectDir)
  const lockFile = join(absolute, lockName)
  let lockDescriptor
  try {
    lockDescriptor = openSync(lockFile, 'wx')
    writeFileSync(lockDescriptor, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`)
    closeSync(lockDescriptor)
    lockDescriptor = undefined
    const normalizedRuns = report._normalized.runs
    if (existsSync(join(absolute, 'runs.jsonl'))) {
      atomicWrite(join(absolute, 'runs.jsonl'), normalizedRuns.map((run) => JSON.stringify(run)).join('\n') + (normalizedRuns.length ? '\n' : ''))
    }
    if (report._normalized.latest) {
      atomicWrite(join(absolute, 'latest-result.json'), `${JSON.stringify(report._normalized.latest, null, 2)}\n`)
    }
  } finally {
    if (lockDescriptor !== undefined) closeSync(lockDescriptor)
    if (existsSync(lockFile)) unlinkSync(lockFile)
  }

  const after = inspectVNextArtifacts({ projectDir })
  if (after.blocked || after.migrationAvailable) throw new Error(`artifact migration did not converge: ${after.blockedReasons.join('; ')}`)
  const finalReport = {
    ...after,
    mode: 'write',
    written: true,
    changes: report.changes,
    migratedArtifacts: report.artifacts,
  }
  delete finalReport._normalized
  return finalReport
}

export function selfTest() {
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'))
  const root = mkdtempSync(join(tmpdir(), 'vnext-artifact-compat-'))
  try {
    for (const testCase of fixture.cases) {
      const result = sealFixtureResult(testCase.result)
      const normalized = normalizeLatestResult(result)
      assert.equal(normalized.blocked, testCase.expected.blocked, testCase.id)
      assert.equal(normalized.requiresReverification, testCase.expected.requiresReverification, testCase.id)
    }

    const blockedCase = fixture.cases.find((testCase) => testCase.id.startsWith('PR-99997'))
    const blockedDir = join(root, blockedCase.result.projectId)
    mkdirSync(blockedDir, { recursive: true })
    const blockedResult = sealFixtureResult(blockedCase.result)
    writeFileSync(join(blockedDir, 'work-item.json'), JSON.stringify({ schemaVersion: 1, workflowVersion: 2, projectId: blockedResult.projectId }))
    writeFileSync(join(blockedDir, 'latest-result.json'), JSON.stringify(blockedResult))
    writeFileSync(join(blockedDir, 'runs.jsonl'), `${JSON.stringify(blockedResult)}\n`)
    const blockedDiagnostic = artifactCompatibilitySchemaDiagnostic({ projectDir: blockedDir, projectId: blockedResult.projectId })
    assert.equal(blockedDiagnostic.skipExitResultSchema, true)
    assert.match(blockedDiagnostic.problem, /require a fresh docs-tdd verify/)
    assert.equal(migrateVNextArtifacts({ projectDir: blockedDir, write: true }).written, false)
    assert.equal(JSON.parse(readFileSync(join(blockedDir, 'latest-result.json'))).assuranceMode, undefined)

    const safeCase = fixture.cases.find((testCase) => testCase.id.startsWith('TR-02386'))
    const safeDir = join(root, safeCase.result.projectId)
    mkdirSync(safeDir, { recursive: true })
    const safeResult = sealFixtureResult(safeCase.result)
    writeFileSync(join(safeDir, 'work-item.json'), JSON.stringify({ schemaVersion: 1, workflowVersion: 2, projectId: safeResult.projectId }))
    writeFileSync(join(safeDir, 'latest-result.json'), JSON.stringify(safeResult))
    writeFileSync(join(safeDir, 'runs.jsonl'), `${JSON.stringify(safeResult)}\n`)
    const safeDiagnostic = artifactCompatibilitySchemaDiagnostic({ projectDir: safeDir, projectId: safeResult.projectId })
    assert.equal(safeDiagnostic.skipExitResultSchema, true)
    assert.match(safeDiagnostic.problem, /artifact-compat .* --write/)
    const migrated = migrateVNextArtifacts({ projectDir: safeDir, write: true })
    assert.equal(migrated.written, true)
    const latest = JSON.parse(readFileSync(join(safeDir, 'latest-result.json'), 'utf8'))
    assert.deepEqual(Object.keys(latest.checks[0]).sort(), ['code', 'ok', 'problems'])
    assert.equal(verifyExitResultIntegrity(latest).ok, true)
    assert.equal(migrateVNextArtifacts({ projectDir: safeDir, write: true }).written, false)
    console.log(`vnext-artifact-compat self-test passed (${fixture.cases.length} cases)`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
