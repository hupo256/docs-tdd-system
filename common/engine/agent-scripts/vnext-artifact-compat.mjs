#!/usr/bin/env node
// CLI wrapper for explicit v2 artifact compatibility reporting and migration.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrateVNextArtifacts, normalizeLatestResult } from './lib/vnext-artifact-compat.mjs'
import { stableFingerprint } from './lib/vnext-work-item.mjs'

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

function printReport(report) {
  console.log(`${report.blocked ? 'BLOCKED' : report.migrationAvailable ? 'MIGRATION AVAILABLE' : 'CURRENT'} ${report.projectId || report.projectDir}`)
  console.log(`  mode: ${report.mode}`)
  console.log(`  written: ${report.written}`)
  if (report.written) {
    for (const change of report.changes) console.log(`  migrated: ${change}`)
  }
  for (const artifact of report.artifacts) {
    console.log(`  ${artifact.file} ${artifact.label}: ${artifact.status}`)
    for (const change of artifact.changes) console.log(`    - ${change}`)
    for (const reason of artifact.blockedReasons) console.log(`    - BLOCK: ${reason}`)
  }
  if (report.requiresReverification) console.log('  next: rerun docs-tdd verify; missing code identity cannot be migrated')
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-artifact-compat-cli-'))
  try {
    const projectDir = join(root, 'TR-00001')
    mkdirSync(projectDir, { recursive: true })
    const result = {
      schemaVersion: 1,
      workflowVersion: 2,
      tool: 'vnext-verify.mjs',
      mode: 'enforced',
      assuranceMode: 'assisted-pilot',
      evidenceTrust: 'caller-supplied',
      runId: 'run-1',
      generatedAt: '2026-09-19T00:00:00Z',
      projectId: 'TR-00001',
      level: 'V0',
      status: 'passed',
      ok: true,
      workItemFingerprint: 'a'.repeat(64),
      codeFingerprint: {
        headSha: 'head',
        baseSha: 'base',
        contentHash: 'b'.repeat(64),
        dirtyHash: 'dirty',
        dirtyFileCount: 0,
        untrackedFileCount: 0,
        isGitRepo: true,
      },
      checks: [{ code: 'MSW_POLICY', ok: true, problems: [], mode: 'no-request' }],
      summary: { total: 1, passed: 1, failed: 0 },
      blockedBy: [],
      failureDomains: [],
    }
    const { resultFingerprint: _ignored, ...resultBody } = result
    result.resultFingerprint = stableFingerprint(resultBody)
    assert.equal(normalizeLatestResult(result).blocked, false)
    writeFileSync(join(projectDir, 'work-item.json'), JSON.stringify({ schemaVersion: 1, workflowVersion: 2, projectId: 'TR-00001' }))
    writeFileSync(join(projectDir, 'latest-result.json'), JSON.stringify(result))
    writeFileSync(join(projectDir, 'runs.jsonl'), `${JSON.stringify(result)}\n`)
    assert.equal(migrateVNextArtifacts({ projectDir }).migrationAvailable, true)
    assert.equal(migrateVNextArtifacts({ projectDir, write: true }).written, true)
    assert.equal(Object.hasOwn(JSON.parse(readFileSync(join(projectDir, 'latest-result.json'), 'utf8')).checks[0], 'mode'), false)
    console.log('vnext-artifact-compat command self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else {
    try {
      const projectDir = argumentValue('--project')
      if (!projectDir) throw new Error('artifact compatibility requires --project <v2-project-dir>')
      const report = migrateVNextArtifacts({ projectDir: resolve(projectDir), write: process.argv.includes('--write') })
      if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
      else printReport(report)
      process.exitCode = report.blocked ? 2 : 0
    } catch (error) {
      console.error(`vNext artifact compatibility failed: ${error.message}`)
      process.exitCode = 2
    }
  }
}
