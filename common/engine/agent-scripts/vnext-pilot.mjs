#!/usr/bin/env node
// Historical dual-track pilot evaluator. It reports sample quality; formal cutover is an explicit owner decision outside this script.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVNextContext } from './lib/vnext-context.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { readVNextRunHistory, VNEXT_ARTIFACT_FILES } from './lib/vnext-persistence.mjs'
import { deriveDeliveryTruth } from './lib/vnext-delivery-truth.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRegistry = join(scriptDir, '..', '..', 'vnext', 'pilot-registry.json')
const defaultReport = join(scriptDir, '..', '..', 'vnext', 'pilot-report.json')
const v1Entrypoints = [
  'start-new-project.mjs', 'run-project-gate.mjs', 'verify-project-gate.mjs',
  'rule-context-hook.mjs', 'claude-posttooluse-gate.mjs',
]

function load(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function fileCount(root) {
  let count = 0
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) count += fileCount(path)
    else count += 1
  }
  return count
}

export function inspectV1Isolation() {
  const coupled = []
  for (const name of v1Entrypoints) {
    const file = join(scriptDir, name)
    if (!existsSync(file)) continue
    const source = readFileSync(file, 'utf8')
    if (/from\s+['"][^'"]*vnext|import\s*\([^)]*vnext|vnext-verify\.mjs/.test(source)) coupled.push(name)
  }
  return { ok: coupled.length === 0, checkedEntrypoints: v1Entrypoints, coupled }
}

export function inspectPilotEntry(entry, registryDir) {
  const sampleId = entry.sampleId || entry.projectId
  const root = isAbsolute(entry.artifactDir) ? entry.artifactDir : resolve(registryDir, entry.artifactDir)
  const artifactMode = entry.artifactMode || 'isolated-snapshot'
  const execution = entry.executionAttestation || null
  const common = {
    sampleId,
    projectId: entry.projectId,
    root,
    artifactMode,
    autopilotRelease: execution?.release || null,
    publicCommandsOnly: execution?.publicCommandsOnly === true,
    executionAttestedBy: execution?.attestedBy || null,
    executionAttestedAt: execution?.attestedAt || null,
  }
  const problems = []
  let workItem = null
  try {
    for (const name of VNEXT_ARTIFACT_FILES) if (!existsSync(join(root, name))) problems.push(`missing ${name}`)
    workItem = existsSync(join(root, 'work-item.json')) ? load(join(root, 'work-item.json')) : null
    if (problems.length) return { ...common, level: workItem?.routing?.verificationLevel || null, authoritative: false, deliveryCommitted: workItem?.autopilot?.delivery?.status === 'committed', ok: false, problems }
    const latest = load(join(root, 'latest-result.json'))
    const history = readVNextRunHistory(root)
    if (workItem.projectId !== entry.projectId || latest.projectId !== entry.projectId) problems.push('projectId does not match registry')
    const integrity = verifyExitResultIntegrity(latest, workItem)
    if (!integrity.ok) problems.push(...integrity.problems)
    if (!history.some((run) => run.runId === latest.runId && run.resultFingerprint === latest.resultFingerprint)) problems.push('latest result is absent from runs.jsonl')
    if (latest.status !== 'passed' || latest.ok !== true) problems.push(`latest result is ${latest.status}, not passed`)
    const context = buildVNextContext({ workItem, latestResult: latest, generatedAt: entry.observation?.observedThrough || entry.enrolledAt })
    const authoritative = latest.mode === 'enforced' && latest.assuranceMode === 'autonomous' && latest.evidenceTrust === 'cli-attested'
    const deliveryTruth = deriveDeliveryTruth({
      workItem,
      latestResult: latest,
      integrityOk: integrity.ok,
      codeStateFresh: execution?.codeStateFresh === true,
      assuranceTrusted: authoritative,
      gitScopeClean: execution?.gitScopeClean === true,
      changedPaths: latest.codeFingerprint?.scopePaths || [],
    })
    const artifacts = fileCount(root)
    if (artifactMode === 'isolated-snapshot' && artifacts > VNEXT_ARTIFACT_FILES.length) problems.push(`isolated artifact directory contains ${artifacts} files, expected at most ${VNEXT_ARTIFACT_FILES.length}`)
    if (!entry.newRequirement) problems.push('pilot entry is not attested as a new requirement')
    if (!entry.observation) problems.push('post-test observation is pending')
    return {
      ...common,
      level: workItem.routing.verificationLevel,
      latestStatus: latest.status,
      runCount: history.length,
      artifactCount: artifacts,
      contextChars: context.chars,
      contextBudget: context.budget,
      omissionEscapes: entry.observation?.requirementOmissionEscapes ?? null,
      falseGreenEscapes: entry.observation?.falseGreenEscapes ?? null,
      observedThrough: entry.observation?.observedThrough ?? null,
      authoritative,
      deliveryCommitted: deliveryTruth.authoritativeCompletion,
      deliveryTruth,
      ok: problems.length === 0,
      problems,
    }
  } catch (error) {
    return { ...common, level: workItem?.routing?.verificationLevel || null, authoritative: false, deliveryCommitted: workItem?.autopilot?.delivery?.status === 'committed', ok: false, problems: [error.message] }
  }
}

export function evaluatePilot(registry, samples, isolation = inspectV1Isolation()) {
  const requiredLevels = registry.requiredLevels || ['V0', 'V1', 'V2']
  const enrolledLevels = [...new Set(samples.map((sample) => sample.level).filter(Boolean))].sort()
  const levels = [...new Set(samples.filter((sample) => sample.ok).map((sample) => sample.level))].sort()
  const escapeSamples = samples.filter((sample) => (sample.omissionEscapes || 0) > 0 || (sample.falseGreenEscapes || 0) > 0)
  const completed = samples.filter((sample) => sample.ok)
  const withinCount = samples.length >= registry.minimumSamples && samples.length <= registry.maximumSamples
  const levelCoverage = requiredLevels.every((level) => levels.includes(level))
  const zeroEscapes = escapeSamples.length === 0
  const qualificationTarget = registry.qualificationTarget || null
  const qualifiedSamples = qualificationTarget
    ? samples.filter((sample) => sample.ok
      && sample.authoritative === true
      && sample.deliveryCommitted === true
      && sample.autopilotRelease === qualificationTarget.release
      && sample.publicCommandsOnly === qualificationTarget.publicCommandsOnly
      && Boolean(sample.executionAttestedBy)
      && Boolean(sample.executionAttestedAt))
    : []
  const qualifiedLevels = [...new Set(qualifiedSamples.map((sample) => sample.level).filter(Boolean))].sort()
  const missingQualifiedLevels = requiredLevels.filter((level) => !qualifiedLevels.includes(level))
  const releaseQualificationComplete = qualificationTarget?.readinessCaseId === 'R-13'
    && qualificationTarget.publicCommandsOnly === true
    && Boolean(qualificationTarget.release)
    && missingQualifiedLevels.length === 0
  return {
    schemaVersion: 1,
    mode: registry.mode,
    generatedAt: new Date().toISOString(),
    decision: 'collecting',
    status: 'collecting',
    automaticCutover: false,
    summary: {
      enrolled: samples.length,
      completed: completed.length,
      minimumSamples: registry.minimumSamples,
      maximumSamples: registry.maximumSamples,
      enrolledLevels,
      completedLevels: levels,
      requiredLevels,
      zeroRequirementOmissionEscapes: samples.reduce((total, sample) => total + (sample.omissionEscapes || 0), 0) === 0,
      zeroFalseGreenEscapes: samples.reduce((total, sample) => total + (sample.falseGreenEscapes || 0), 0) === 0,
    },
    releaseQualification: {
      readinessCaseId: qualificationTarget?.readinessCaseId || null,
      release: qualificationTarget?.release || null,
      publicCommandsOnly: qualificationTarget?.publicCommandsOnly ?? null,
      completed: releaseQualificationComplete,
      completedSamples: qualifiedSamples.length,
      completedLevels: qualifiedLevels,
      missingLevels: missingQualifiedLevels,
    },
    checks: [
      { code: 'LEGACY_ISOLATED', ok: isolation.ok, problems: isolation.coupled || [] },
      { code: 'SAMPLE_COUNT', ok: withinCount, problems: withinCount ? [] : [`need ${registry.minimumSamples}–${registry.maximumSamples} samples, got ${samples.length}`] },
      { code: 'LEVEL_COVERAGE', ok: levelCoverage, problems: requiredLevels.filter((level) => !levels.includes(level)).map((level) => `no completed ${level} sample`) },
      { code: 'SAMPLES_COMPLETE', ok: completed.length === samples.length && samples.length > 0, problems: samples.filter((sample) => !sample.ok).map((sample) => `${sample.sampleId || sample.projectId}: ${sample.problems.join('; ')}`) },
      { code: 'ZERO_ESCAPES', ok: zeroEscapes, problems: escapeSamples.map((sample) => `${sample.sampleId || sample.projectId}: omission=${sample.omissionEscapes}, falseGreen=${sample.falseGreenEscapes}`) },
      {
        code: 'R13_PUBLIC_COMMAND_PILOTS',
        ok: releaseQualificationComplete,
        required: false,
        problems: qualificationTarget
          ? missingQualifiedLevels.map((level) => `no completed ${qualificationTarget.release} ${level} sample attested as public-command-only`)
          : ['pilot registry has no release qualification target'],
      },
    ],
    samples,
  }
}

export function selfTest() {
  const registry = {
    mode: 'explicit-dual-track-shadow',
    minimumSamples: 5,
    maximumSamples: 10,
    requiredLevels: ['V0', 'V1', 'V2'],
    qualificationTarget: { readinessCaseId: 'R-13', release: 'autopilot-v3.5', publicCommandsOnly: true },
  }
  const samples = ['V0', 'V0', 'V1', 'V2', 'V2'].map((level, index) => ({ sampleId: `SAMPLE-${index}`, projectId: `PR-0000${index}`, level, ok: true, problems: [], omissionEscapes: 0, falseGreenEscapes: 0, authoritative: true, deliveryCommitted: true, autopilotRelease: 'autopilot-v3.5', publicCommandsOnly: true, executionAttestedBy: 'owner', executionAttestedAt: '2026-09-19T00:00:00Z' }))
  const ready = evaluatePilot(registry, samples, { ok: true, coupled: [] })
  assert.equal(ready.decision, 'collecting')
  assert.equal(ready.status, 'collecting')
  assert.equal(ready.automaticCutover, false)
  assert.equal(ready.releaseQualification.completed, true)
  const escaped = structuredClone(samples)
  escaped[2].omissionEscapes = 1
  assert.equal(evaluatePilot(registry, escaped, { ok: true, coupled: [] }).decision, 'collecting')
  assert.equal(evaluatePilot(registry, samples.slice(0, 2), { ok: true, coupled: [] }).decision, 'collecting')
  assert.equal(evaluatePilot(registry, samples, { ok: false, coupled: ['docs-tdd.mjs'] }).decision, 'collecting')
  const unattested = structuredClone(samples)
  unattested[2].publicCommandsOnly = false
  assert.equal(evaluatePilot(registry, unattested, { ok: true, coupled: [] }).releaseQualification.completed, false)
  console.log('vnext-pilot self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
else {
  try {
    const registryIndex = process.argv.indexOf('--registry')
    const registryFile = resolve(registryIndex === -1 ? defaultRegistry : process.argv[registryIndex + 1])
    const registry = load(registryFile)
    const samples = registry.entries.map((entry) => inspectPilotEntry(entry, dirname(registryFile)))
    const report = evaluatePilot(registry, samples)
    if (process.argv.includes('--write')) writeFileSync(defaultReport, `${JSON.stringify(report, null, 2)}\n`)
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = 0
  } catch (error) {
    console.error(`vNext pilot evaluation failed: ${error.message}`)
    process.exitCode = 2
  }
}
