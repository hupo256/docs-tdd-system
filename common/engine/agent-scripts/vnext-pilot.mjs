#!/usr/bin/env node
// Explicit dual-track pilot evaluator. It reports readiness but can never switch v1 Router/Gate.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVNextContext } from './lib/vnext-context.mjs'
import { verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { readVNextRunHistory, VNEXT_ARTIFACT_FILES } from './lib/vnext-persistence.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRegistry = join(scriptDir, '..', '..', 'vnext', 'pilot-registry.json')
const defaultReport = join(scriptDir, '..', '..', 'vnext', 'pilot-report.json')
const v1Entrypoints = [
  'docs-tdd.mjs', 'project-orchestrator.mjs', 'start-new-project.mjs', 'run-project-gate.mjs',
  'verify-project-gate.mjs', 'rule-context-hook.mjs', 'claude-posttooluse-gate.mjs',
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
  const problems = []
  let workItem = null
  try {
    for (const name of VNEXT_ARTIFACT_FILES) if (!existsSync(join(root, name))) problems.push(`missing ${name}`)
    workItem = existsSync(join(root, 'work-item.json')) ? load(join(root, 'work-item.json')) : null
    if (problems.length) return { sampleId, projectId: entry.projectId, level: workItem?.routing?.verificationLevel || null, root, ok: false, problems }
    const latest = load(join(root, 'latest-result.json'))
    const history = readVNextRunHistory(root)
    if (workItem.projectId !== entry.projectId || latest.projectId !== entry.projectId) problems.push('projectId does not match registry')
    const integrity = verifyExitResultIntegrity(latest, workItem)
    if (!integrity.ok) problems.push(...integrity.problems)
    if (!history.some((run) => run.runId === latest.runId && run.resultFingerprint === latest.resultFingerprint)) problems.push('latest result is absent from runs.jsonl')
    if (latest.status !== 'passed' || latest.ok !== true) problems.push(`latest result is ${latest.status}, not passed`)
    const context = buildVNextContext({ workItem, latestResult: latest, generatedAt: entry.observation?.observedThrough || entry.enrolledAt })
    const artifacts = fileCount(root)
    if (artifacts > VNEXT_ARTIFACT_FILES.length) problems.push(`default artifact directory contains ${artifacts} files, expected at most ${VNEXT_ARTIFACT_FILES.length}`)
    if (!entry.newRequirement) problems.push('pilot entry is not attested as a new requirement')
    if (!entry.observation) problems.push('post-test observation is pending')
    return {
      sampleId,
      projectId: entry.projectId,
      level: workItem.routing.verificationLevel,
      root,
      latestStatus: latest.status,
      runCount: history.length,
      artifactCount: artifacts,
      contextChars: context.chars,
      contextBudget: context.budget,
      omissionEscapes: entry.observation?.requirementOmissionEscapes ?? null,
      falseGreenEscapes: entry.observation?.falseGreenEscapes ?? null,
      observedThrough: entry.observation?.observedThrough ?? null,
      ok: problems.length === 0,
      problems,
    }
  } catch (error) {
    return { sampleId, projectId: entry.projectId, level: workItem?.routing?.verificationLevel || null, root, ok: false, problems: [error.message] }
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
  let decision = 'collecting'
  if (!isolation.ok || !zeroEscapes || samples.length > registry.maximumSamples) decision = 'rollback'
  else if (withinCount && completed.length === samples.length && levelCoverage) decision = 'eligible-for-human-cutover-review'
  return {
    schemaVersion: 1,
    mode: registry.mode,
    generatedAt: new Date().toISOString(),
    decision,
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
    checks: [
      { code: 'LEGACY_ISOLATED', ok: isolation.ok, problems: isolation.coupled || [] },
      { code: 'SAMPLE_COUNT', ok: withinCount, problems: withinCount ? [] : [`need ${registry.minimumSamples}–${registry.maximumSamples} samples, got ${samples.length}`] },
      { code: 'LEVEL_COVERAGE', ok: levelCoverage, problems: requiredLevels.filter((level) => !levels.includes(level)).map((level) => `no completed ${level} sample`) },
      { code: 'SAMPLES_COMPLETE', ok: completed.length === samples.length && samples.length > 0, problems: samples.filter((sample) => !sample.ok).map((sample) => `${sample.sampleId || sample.projectId}: ${sample.problems.join('; ')}`) },
      { code: 'ZERO_ESCAPES', ok: zeroEscapes, problems: escapeSamples.map((sample) => `${sample.sampleId || sample.projectId}: omission=${sample.omissionEscapes}, falseGreen=${sample.falseGreenEscapes}`) },
    ],
    samples,
  }
}

export function selfTest() {
  const registry = { mode: 'explicit-dual-track-shadow', minimumSamples: 5, maximumSamples: 10, requiredLevels: ['V0', 'V1', 'V2'] }
  const samples = ['V0', 'V0', 'V1', 'V2', 'V2'].map((level, index) => ({ sampleId: `SAMPLE-${index}`, projectId: `PR-0000${index}`, level, ok: true, problems: [], omissionEscapes: 0, falseGreenEscapes: 0 }))
  const ready = evaluatePilot(registry, samples, { ok: true, coupled: [] })
  assert.equal(ready.decision, 'eligible-for-human-cutover-review')
  assert.equal(ready.automaticCutover, false)
  const escaped = structuredClone(samples)
  escaped[2].omissionEscapes = 1
  assert.equal(evaluatePilot(registry, escaped, { ok: true, coupled: [] }).decision, 'rollback')
  assert.equal(evaluatePilot(registry, samples.slice(0, 2), { ok: true, coupled: [] }).decision, 'collecting')
  assert.equal(evaluatePilot(registry, samples, { ok: false, coupled: ['docs-tdd.mjs'] }).decision, 'rollback')
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
    process.exitCode = report.decision === 'eligible-for-human-cutover-review' ? 0 : report.decision === 'rollback' ? 2 : 1
  } catch (error) {
    console.error(`vNext pilot evaluation failed: ${error.message}`)
    process.exitCode = 2
  }
}
