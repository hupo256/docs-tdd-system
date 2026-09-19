#!/usr/bin/env node
// Read-only source graph report for workflowVersion 2 projects.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { docsSystemRoot } from './lib/roots.mjs'
import { compileSourceGraph } from './lib/vnext-source-graph.mjs'
import { normalizeSourceDocuments, readLocalSourceAsset } from './lib/vnext-source-units.mjs'
import { stableFingerprint } from './lib/vnext-work-item.mjs'

function sourceDocumentsFor(workItem, sourceRoot) {
  const sources = workItem?.sourceSnapshot?.sources
  if (!Array.isArray(sources) || !sources.length) throw new Error('work-item sourceSnapshot.sources must contain at least one source')
  return sources.map((source) => {
    if (/^(?:https?:)?\/\//i.test(source.path)) throw new Error(`source must be localized before graph compilation: ${source.path}`)
    const file = isAbsolute(source.path) ? source.path : resolve(sourceRoot, source.path)
    if (!existsSync(file)) throw new Error(`source file is missing: ${source.path}`)
    return { path: source.path, content: readFileSync(file, 'utf8') }
  })
}

export function buildSourceGraphReport({ projectDir, sourceRoot = docsSystemRoot } = {}) {
  if (!projectDir) throw new Error('source graph report requires --project <v2-project-dir>')
  const workItemFile = resolve(projectDir, 'work-item.json')
  if (!existsSync(workItemFile)) throw new Error(`work-item.json not found: ${workItemFile}`)
  const workItem = JSON.parse(readFileSync(workItemFile, 'utf8'))
  if (workItem.workflowVersion !== 2) throw new Error('source graph report is v2-only and requires workflowVersion 2')

  const normalized = normalizeSourceDocuments(sourceDocumentsFor(workItem, sourceRoot), {
    revision: workItem.sourceSnapshot?.revision || 'unversioned',
    readAsset: (asset) => readLocalSourceAsset(asset, { root: sourceRoot }),
  })
  const expectedSnapshotFingerprint = stableFingerprint(workItem.sourceSnapshot)
  const actualSnapshotFingerprint = stableFingerprint(normalized.sourceSnapshot)
  if (actualSnapshotFingerprint !== expectedSnapshotFingerprint) {
    throw new Error(`current source/assets differ from workItem.sourceSnapshot; run docs-tdd source-sync before source-graph (expected ${expectedSnapshotFingerprint.slice(0, 12)}, actual ${actualSnapshotFingerprint.slice(0, 12)})`)
  }

  const graph = compileSourceGraph({ sourceUnits: normalized.sourceUnits, workItem })
  return {
    schemaVersion: 1,
    projectId: workItem.projectId,
    ok: graph.ok,
    snapshotMatches: true,
    counts: {
      sources: graph.nodes.sources.length,
      requirements: graph.nodes.requirements.length,
      surfaces: graph.nodes.surfaces.length,
      evidence: graph.nodes.evidence.length,
      edges: graph.edges.length,
    },
    fingerprints: {
      sourceSnapshot: actualSnapshotFingerprint,
      sourceContent: graph.sourceFingerprint,
      sourceGraph: graph.graphFingerprint,
    },
    problems: graph.problems,
    graph,
  }
}

function printReport(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  console.log(`${report.ok ? 'PASS' : 'FAIL'} ${report.projectId} source graph`)
  console.log(`  nodes: ${report.counts.sources} sources, ${report.counts.requirements} requirements, ${report.counts.surfaces} surfaces, ${report.counts.evidence} evidence`)
  console.log(`  edges: ${report.counts.edges}`)
  console.log(`  graph: ${report.fingerprints.sourceGraph}`)
  for (const problem of report.problems) console.log(`  - ${problem}`)
}

export function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-source-graph-report-'))
  const projectDir = join(root, 'prds', 'PR-00001')
  const sourcePath = 'inbox/prd.md'
  const sourceFile = join(root, sourcePath)
  try {
    mkdirSync(dirname(sourceFile), { recursive: true })
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(sourceFile, 'Every password entry uses the same copy.\n')
    const normalized = normalizeSourceDocuments([{ path: sourcePath, content: readFileSync(sourceFile, 'utf8') }], { revision: '1' })
    const workItem = {
      schemaVersion: 1,
      workflowVersion: 2,
      projectId: 'PR-00001',
      sourceSnapshot: normalized.sourceSnapshot,
      requirements: [{
        requirementId: 'R-001',
        status: 'doing',
        sourceAnchors: [{ sourceId: normalized.sourceUnits[0].sourceId }],
        affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement' }],
        evidencePlan: [{ type: 'structural', runtimeRequired: false }],
      }],
    }
    writeFileSync(join(projectDir, 'work-item.json'), `${JSON.stringify(workItem, null, 2)}\n`)
    const report = buildSourceGraphReport({ projectDir, sourceRoot: root })
    assert.equal(report.ok, true, JSON.stringify(report.problems))
    assert.deepEqual(report.counts, { sources: 1, requirements: 1, surfaces: 1, evidence: 1, edges: 3 })
    assert.equal(report.snapshotMatches, true)
    assert.equal(report.fingerprints.sourceGraph.length, 64)
    writeFileSync(sourceFile, 'Changed requirement.\n')
    assert.throws(() => buildSourceGraphReport({ projectDir, sourceRoot: root }), /source\/assets differ/)
    writeFileSync(join(projectDir, 'work-item.json'), `${JSON.stringify({ ...workItem, workflowVersion: 1 }, null, 2)}\n`)
    assert.throws(() => buildSourceGraphReport({ projectDir, sourceRoot: root }), /v2-only/)
    console.log('vnext-source-graph-report self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else if (process.argv.includes('--help')) console.log('usage: vnext-source-graph-report.mjs --project <v2-project-dir> [--json]')
  else {
    try {
      const report = buildSourceGraphReport({ projectDir: argumentValue('--project') })
      printReport(report, process.argv.includes('--json'))
      process.exitCode = report.ok ? 0 : 1
    } catch (error) {
      console.error(`vNext source graph failed: ${error.message}`)
      process.exitCode = 2
    }
  }
}
