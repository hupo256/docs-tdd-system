#!/usr/bin/env node
// Collect the v1 comparison baseline used by docs_tdd vNext. Read-only unless --write is passed.
// Historical metrics that were never recorded stay null; this command never estimates token/time data.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizePortfolio, summarizeProjectBaseline } from './lib/vnext-metrics.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const docsRoot = join(scriptDir, '..', '..', '..')
const prdsRoot = join(docsRoot, 'prds')
const vnextRoot = join(docsRoot, 'common', 'vnext')
const outputPath = join(vnextRoot, 'baseline.json')
const observationPath = join(vnextRoot, 'baseline-observations.json')
const defaultProjects = ['PR-01947', 'PR-02265', 'PR-02306', 'PR-01930']

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function listFiles(root, directory = root, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) listFiles(root, path, result)
    else if (entry.isFile()) result.push({ relativePath: relative(root, path).replaceAll('\\', '/'), size: statSync(path).size })
  }
  return result
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: docsRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

export function collectBaseline(projectIds = defaultProjects) {
  const observations = readJson(observationPath, { projects: {} })
  const projects = projectIds.map((projectId) => {
    const projectRoot = join(prdsRoot, projectId)
    if (!existsSync(projectRoot)) throw new Error(`project not found: ${projectId}`)
    const history = readJson(join(projectRoot, 'agent', 'gate-history.json'), { runs: [] })
    const context = readJson(join(projectRoot, 'agent', 'context-injections.json'), null)
    return summarizeProjectBaseline({
      projectId,
      files: listFiles(projectRoot),
      gateRuns: Array.isArray(history) ? history : history?.runs || [],
      latestGate: readJson(join(projectRoot, 'agent', 'gate-results.json'), null),
      contextInjections: Array.isArray(context) ? context : context?.injections ?? null,
      observation: observations.projects?.[projectId] || {},
    })
  })
  return {
    schemaVersion: 1,
    purpose: 'v1 comparison baseline for docs_tdd vNext; null means the historical value was not recorded and must not be estimated',
    collectedAt: new Date().toISOString(),
    sourceCommit: gitHead(),
    metricDefinitions: {
      processFiles: 'All files under the project except inbox/**; a reproducible proxy for docs_tdd-created persistent artifacts.',
      gateRuns: 'Entries present in agent/gate-history.json; absent historical logging is not reconstructed.',
      gateCheckEvaluations: 'Sum of summary.total across recorded gate runs, including repeated checks.',
      contextPackCalls: 'Entries in agent/context-injections.json when that ledger exists; null otherwise.',
      postTestRequirementOmissionFixes: 'User-reported incidents captured in baseline-observations.json.',
      recordedWindowMinutes: 'Elapsed minutes from first to last recorded gate; not total project wall-clock time.'
    },
    projects,
    portfolio: summarizePortfolio(projects),
  }
}

function printTable(report) {
  console.log('project      level process-files gate-runs checks omissions context-calls')
  for (const item of report.projects) {
    const row = [
      item.projectId.padEnd(12),
      String(item.expectedLevel || '?').padEnd(7),
      String(item.machineRecorded.files.process).padEnd(13),
      String(item.machineRecorded.gates.runs).padEnd(9),
      String(item.machineRecorded.gates.checkEvaluations).padEnd(6),
      String(item.retrospective.postTestRequirementOmissionFixes ?? 'unknown').padEnd(9),
      String(item.machineRecorded.contextPackCalls ?? 'unknown'),
    ]
    console.log(row.join(' '))
  }
  console.log(`portfolio: ${report.portfolio.processFiles} process files, ${report.portfolio.gateRuns} recorded gate runs, ${report.portfolio.gateCheckEvaluations} check evaluations, ${report.portfolio.reportedRequirementOmissionFixes} reported omission fixes`)
  console.log('historical token/first-code/process-time/mock-waste metrics: unknown (not estimated)')
}

if (process.argv.includes('--self-test')) {
  const report = collectBaseline(defaultProjects)
  assert.equal(report.projects.length, 4)
  assert.equal(report.portfolio.projectCount, 4)
  assert.ok(report.projects.every((item) => item.unavailableHistoricalMetrics.docsTddTokens === null))
  console.log('vnext-baseline self-test passed')
  process.exit(0)
}

const projectIds = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const report = collectBaseline(projectIds.length ? projectIds : defaultProjects)
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
else printTable(report)
if (process.argv.includes('--write')) {
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`wrote ${relative(docsRoot, outputPath)}`)
}
