#!/usr/bin/env node
// Deterministic character-budget comparison. Historical token counts remain null and are never invented.

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContextPack } from './lib/context-pack.mjs'
import {
  buildVNextContext,
  VNEXT_CONTEXT_HARD_BUDGETS,
  VNEXT_CONTEXT_TARGET_BUDGETS,
} from './lib/vnext-context.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(scriptDir, '..', 'fixtures', 'vnext-replay')
const outputFile = join(scriptDir, '..', '..', 'vnext', 'context-budget.json')
const v1Scenarios = ['g0_g2_scope', 'g4_coding_worktree', 'g6_code_review', 'g6_contract']

function load(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function p0WorkItem() {
  return {
    workflowVersion: 2, projectId: 'PR-00000', sourceSnapshot: { revision: '1' },
    coverageAudit: { sourceFingerprint: 'p0-source', reviewer: { kind: 'model', id: 'benchmark' }, verdict: 'pass', findings: [] },
    routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0' }, apiDependency: { mode: 'no-request', reason: 'copy-only change' },
    requirements: [{ requirementId: 'R-001', status: 'doing', statement: 'Update one local label.', sourceAnchors: [{ sourceId: 'SRC-1' }], affectedSurfaces: [], evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }] }],
  }
}

export function buildContextBudget() {
  const fakeRelease = { currentFingerprint: 'benchmark', clientMatrix: { codex: { conflictOverrides: [] } } }
  const v1 = v1Scenarios.map((scenario) => {
    const pack = createContextPack('PR-00000', scenario, fakeRelease, fakeRelease, 'compact', { includeSummary: false, write: false })
    return { scenario, chars: pack.packChars }
  })
  const cases = [
    { label: 'V0-low-risk', workItem: p0WorkItem() },
    { label: 'V1-PR-02306', workItem: load(join(fixturesDir, 'PR-02306-missing-password-surfaces.json')).workItem },
    { label: 'V2-PR-01930', workItem: load(join(fixturesDir, 'PR-01930-missing-fund-flow-entry.json')).workItem },
    { label: 'V2-PR-02265', workItem: load(join(fixturesDir, 'PR-02265-stale-prd-revision.json')).workItem },
  ].map(({ label, workItem }) => {
    const context = buildVNextContext({ workItem, generatedAt: '2026-09-04T00:00:00Z' })
    return {
      label,
      level: context.level,
      chars: context.chars,
      targetBudget: context.targetBudget,
      budget: context.budget,
      budgetStatus: context.budgetStatus,
      withinTarget: context.chars <= context.targetBudget,
      withinBudget: context.chars <= context.budget,
    }
  })
  const v1PerProjectChars = v1.reduce((total, item) => total + item.chars, 0)
  const v1ComparableChars = v1PerProjectChars * cases.length
  const vnextComparableChars = cases.reduce((total, item) => total + item.chars, 0)
  const reductionPercent = Number((((v1ComparableChars - vnextComparableChars) / v1ComparableChars) * 100).toFixed(2))
  return {
    schemaVersion: 1,
    metric: 'Unicode code-point characters in deterministic generated context',
    historicalTokenCount: null,
    v1Scenarios,
    v1Packs: v1,
    v1PerProjectChars,
    vnextCases: cases,
    comparison: { projectCount: cases.length, v1ComparableChars, vnextComparableChars, reductionPercent, targetReductionPercent: 60, ok: reductionPercent >= 60 && cases.every((item) => item.withinBudget) },
    budgets: {
      target: VNEXT_CONTEXT_TARGET_BUDGETS,
      hard: VNEXT_CONTEXT_HARD_BUDGETS,
    },
  }
}

export function selfTest() {
  const report = buildContextBudget()
  assert.equal(report.historicalTokenCount, null)
  assert.ok(report.vnextCases.some((item) => item.level === 'V0'))
  assert.ok(report.vnextCases.some((item) => item.level === 'V1'))
  assert.ok(report.vnextCases.some((item) => item.level === 'V2'))
  assert.ok(report.comparison.ok, JSON.stringify(report.comparison))
  console.log(`vnext-context-budget self-test passed (${report.comparison.reductionPercent}% character reduction)`)
}

if (process.argv.includes('--self-test')) selfTest()
else {
  const report = buildContextBudget()
  if (process.argv.includes('--write')) writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.comparison.ok ? 0 : 1
}
