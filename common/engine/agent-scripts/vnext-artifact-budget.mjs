#!/usr/bin/env node
// Compare the historical v1 process-file baseline with the three-file vNext default artifact set.

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { artifactConvergence } from './lib/vnext-metrics.mjs'
import { VNEXT_ARTIFACT_FILES } from './lib/vnext-persistence.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const vnextDir = join(scriptDir, '..', '..', 'vnext')

export function buildArtifactBudget(baseline) {
  const metric = artifactConvergence({
    baselineProcessFiles: baseline?.portfolio?.processFiles,
    projectCount: baseline?.portfolio?.projectCount,
    vnextFilesPerProject: VNEXT_ARTIFACT_FILES.length,
  })
  return {
    schemaVersion: 1,
    generatedFrom: 'baseline.json',
    defaultArtifacts: VNEXT_ARTIFACT_FILES,
    comparison: metric,
    note: 'Projected vNext count compares the same four-project portfolio; optional evidence attachments are excluded from both default scaffolds.',
  }
}

export function selfTest() {
  const report = buildArtifactBudget({ portfolio: { processFiles: 263, projectCount: 4 } })
  assert.equal(report.comparison.projectedVNextFiles, 12)
  assert.equal(report.comparison.reductionPercent, 95.44)
  assert.equal(report.comparison.ok, true)
  console.log('vnext-artifact-budget self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
else {
  const report = buildArtifactBudget(JSON.parse(readFileSync(join(vnextDir, 'baseline.json'), 'utf8')))
  if (process.argv.includes('--write')) writeFileSync(join(vnextDir, 'artifact-budget.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.comparison.ok ? 0 : 1
}
