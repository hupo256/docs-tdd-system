#!/usr/bin/env node
// vNext 基线指标纯计算层。只汇总已有机器记录，不推测历史 token、首次落码或流程墙钟时间。

import assert from 'node:assert/strict'

const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0)

function routeReasonCode(reason) {
  if (typeof reason === 'string') return reason
  return reason?.code || ''
}

function normalizeTokenUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  const inputTokens = Number.isFinite(usage.inputTokens) ? usage.inputTokens : null
  const outputTokens = Number.isFinite(usage.outputTokens) ? usage.outputTokens : null
  const totalTokens = Number.isFinite(usage.totalTokens) ? usage.totalTokens : null
  if (inputTokens === null && outputTokens === null && totalTokens === null) return null
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    source: typeof usage.source === 'string' && usage.source.trim() ? usage.source.trim() : null,
  }
}

function countMetric(value, terminalState) {
  if (Number.isFinite(value)) return value
  return terminalState === 'running' || terminalState === 'interrupted' ? null : 0
}

export function normalizeCompactRunRecord(record = {}) {
  const terminalState = record.terminalState || null
  return {
    schemaVersion: 1,
    runId: record.runId || null,
    projectId: record.projectId || null,
    route: record.route || null,
    routePolicyVersion: Number.isInteger(record.routePolicyVersion) ? record.routePolicyVersion : null,
    observedRoutes: Array.isArray(record.observedRoutes) ? [...new Set(record.observedRoutes.filter((route) => typeof route === 'string'))] : [],
    assurance: record.assurance || null,
    routeReasons: Array.isArray(record.routeReasons)
      ? [...new Set(record.routeReasons.map(routeReasonCode).filter(Boolean))]
      : [],
    contextChars: Number.isFinite(record.contextChars) ? record.contextChars : null,
    estimatedInputTokens: null,
    tokenUsage: normalizeTokenUsage(record.tokenUsage),
    ruleFiles: Number.isFinite(record.ruleFiles) ? record.ruleFiles : null,
    sourceUnits: Number.isFinite(record.sourceUnits) ? record.sourceUnits : null,
    actionCount: countMetric(record.actionCount, terminalState),
    commandCount: countMetric(record.commandCount, terminalState),
    reviewRounds: countMetric(record.reviewRounds, terminalState),
    evidenceCount: countMetric(record.evidenceCount, terminalState),
    repairAttempts: countMetric(record.repairAttempts, terminalState),
    elapsedMs: Number.isFinite(record.grossElapsedMs) ? record.grossElapsedMs : Number.isFinite(record.elapsedMs) ? record.elapsedMs : null,
    grossElapsedMs: Number.isFinite(record.grossElapsedMs) ? record.grossElapsedMs : Number.isFinite(record.elapsedMs) ? record.elapsedMs : null,
    activeElapsedMs: Number.isFinite(record.activeElapsedMs) ? record.activeElapsedMs : null,
    userInterruptCount: countMetric(record.userInterruptCount, terminalState),
    necessaryInterruptCount: countMetric(record.necessaryInterruptCount, terminalState),
    silentOmissionCount: countMetric(record.silentOmissionCount, terminalState),
    falseCompletionCount: countMetric(record.falseCompletionCount, terminalState),
    terminalState,
    budgetStatus: record.budgetStatus || null,
    budget: record.budget && typeof record.budget === 'object' ? structuredClone(record.budget) : null,
    startedAt: record.startedAt || null,
    endedAt: record.endedAt || null,
    generatedAt: record.generatedAt || null,
    receiptOffset: Number.isInteger(record.receiptOffset) ? record.receiptOffset : null,
  }
}

function percentile(values, ratio) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))]
}

export function summarizeCompactRuns(records = []) {
  const normalized = records.map(normalizeCompactRunRecord)
  const elapsed = normalized.map((record) => record.grossElapsedMs).filter(Number.isFinite)
  const activeElapsed = normalized.map((record) => record.activeElapsedMs).filter(Number.isFinite)
  const contexts = normalized.map((record) => record.contextChars).filter(Number.isFinite)
  const completeGrossElapsed = normalized.length > 0 && normalized.every((record) => Number.isFinite(record.grossElapsedMs))
  const completeActiveElapsed = normalized.length > 0 && normalized.every((record) => Number.isFinite(record.activeElapsedMs))
  const completeTokenUsage = normalized.length > 0 && normalized.every((record) => record.tokenUsage !== null)
  const sumKnown = (field) => normalized.length === 0 ? 0 : normalized.every((record) => Number.isFinite(record[field]))
    ? sum(normalized.map((record) => record[field]))
    : null
  const tokenUsage = completeTokenUsage
    ? {
        inputTokens: sum(normalized.map((record) => record.tokenUsage.inputTokens)),
        outputTokens: sum(normalized.map((record) => record.tokenUsage.outputTokens)),
        totalTokens: sum(normalized.map((record) => record.tokenUsage.totalTokens)),
        source: normalized.every((record) => record.tokenUsage.source === normalized[0].tokenUsage.source)
          ? normalized[0].tokenUsage.source
          : 'mixed',
      }
    : null
  return {
    runCount: normalized.length,
    completeRunCount: normalized.filter((record) => record.terminalState && !['running', 'interrupted'].includes(record.terminalState)).length,
    incompleteRunCount: normalized.filter((record) => ['running', 'interrupted'].includes(record.terminalState)).length,
    routes: [...new Set(normalized.map((record) => record.route).filter(Boolean))].sort(),
    assurances: [...new Set(normalized.map((record) => record.assurance).filter(Boolean))].sort(),
    p50ElapsedMs: completeGrossElapsed ? percentile(elapsed, 0.5) : null,
    p90ElapsedMs: completeGrossElapsed ? percentile(elapsed, 0.9) : null,
    p50GrossElapsedMs: completeGrossElapsed ? percentile(elapsed, 0.5) : null,
    p90GrossElapsedMs: completeGrossElapsed ? percentile(elapsed, 0.9) : null,
    p50ActiveElapsedMs: completeActiveElapsed ? percentile(activeElapsed, 0.5) : null,
    p90ActiveElapsedMs: completeActiveElapsed ? percentile(activeElapsed, 0.9) : null,
    p50ContextChars: percentile(contexts, 0.5),
    p90ContextChars: percentile(contexts, 0.9),
    totals: {
      actions: sumKnown('actionCount'),
      commands: sumKnown('commandCount'),
      reviews: sumKnown('reviewRounds'),
      evidence: sumKnown('evidenceCount'),
      repairs: sumKnown('repairAttempts'),
      necessaryInterrupts: sumKnown('necessaryInterruptCount'),
      silentOmissions: sumKnown('silentOmissionCount'),
      falseCompletions: sumKnown('falseCompletionCount'),
    },
    terminalStates: [...new Set(normalized.map((record) => record.terminalState).filter(Boolean))].sort(),
    estimatedInputTokens: null,
    tokenUsage,
  }
}

export function summarizeProjectBaseline({ projectId, files = [], gateRuns = [], latestGate = null, contextInjections = null, observation = {} }) {
  const processFiles = files.filter((file) => !file.relativePath.startsWith('inbox/'))
  const evidenceFiles = files.filter((file) => file.relativePath.startsWith('evidence/'))
  const timestamps = gateRuns.map((run) => Date.parse(run.generatedAt)).filter(Number.isFinite).sort((a, b) => a - b)
  const firstGateAt = timestamps.length ? new Date(timestamps[0]).toISOString() : null
  const lastGateAt = timestamps.length ? new Date(timestamps.at(-1)).toISOString() : null
  const gateWindowMinutes = timestamps.length > 1 ? Math.round((timestamps.at(-1) - timestamps[0]) / 60000) : null
  const distinctGates = [...new Set(gateRuns.map((run) => run.gate).filter(Boolean))].sort()

  return {
    projectId,
    expectedLevel: observation.expectedLevel || null,
    machineRecorded: {
      files: {
        total: files.length,
        process: processFiles.length,
        inbox: files.length - processFiles.length,
        evidence: evidenceFiles.length,
        totalBytes: sum(files.map((file) => file.size)),
        processBytes: sum(processFiles.map((file) => file.size)),
      },
      gates: {
        runs: gateRuns.length,
        passedRuns: gateRuns.filter((run) => run.ok === true).length,
        failedRuns: gateRuns.filter((run) => run.ok === false).length,
        distinct: distinctGates,
        checkEvaluations: sum(gateRuns.map((run) => run.summary?.total)),
        warnings: sum(gateRuns.map((run) => run.summary?.warn)),
        waivers: sum(gateRuns.map((run) => run.summary?.waived)),
        firstRecordedAt: firstGateAt,
        lastRecordedAt: lastGateAt,
        recordedWindowMinutes: gateWindowMinutes,
        latestResult: latestGate ? { gate: latestGate.gate || null, ok: latestGate.ok === true, generatedAt: latestGate.generatedAt || null } : null,
      },
      contextPackCalls: Array.isArray(contextInjections) ? contextInjections.length : null,
    },
    retrospective: {
      postTestRequirementOmissionFixes: Number.isInteger(observation.postTestRequirementOmissionFixes) ? observation.postTestRequirementOmissionFixes : null,
      incidentClass: observation.incidentClass || null,
    },
    unavailableHistoricalMetrics: {
      firstCodeMinutes: null,
      docsTddTokens: null,
      processWallClockMinutes: null,
      mockWasteMinutes: null,
    },
  }
}

export function artifactConvergence({ baselineProcessFiles, projectCount, vnextFilesPerProject = 3 }) {
  const projectedVNextFiles = projectCount * vnextFilesPerProject
  const reductionRatio = baselineProcessFiles > 0 ? (baselineProcessFiles - projectedVNextFiles) / baselineProcessFiles : null
  return {
    baselineProcessFiles,
    projectCount,
    vnextFilesPerProject,
    projectedVNextFiles,
    reductionPercent: reductionRatio === null ? null : Number((reductionRatio * 100).toFixed(2)),
    targetReductionPercent: 80,
    ok: reductionRatio !== null && reductionRatio >= 0.8,
  }
}

export function summarizePortfolio(projects) {
  return {
    projectCount: projects.length,
    processFiles: sum(projects.map((item) => item.machineRecorded.files.process)),
    gateRuns: sum(projects.map((item) => item.machineRecorded.gates.runs)),
    gateCheckEvaluations: sum(projects.map((item) => item.machineRecorded.gates.checkEvaluations)),
    reportedRequirementOmissionFixes: sum(projects.map((item) => item.retrospective.postTestRequirementOmissionFixes)),
    unavailableMetricsMustRemainNull: ['firstCodeMinutes', 'docsTddTokens', 'processWallClockMinutes', 'mockWasteMinutes'],
  }
}

export function selfTest() {
  const summary = summarizeProjectBaseline({
    projectId: 'PR-00001',
    files: [
      { relativePath: 'inbox/prd.md', size: 10 },
      { relativePath: 'agent/work.json', size: 20 },
      { relativePath: 'evidence/gate.md', size: 30 },
    ],
    gateRuns: [
      { gate: 'G2', ok: true, generatedAt: '2026-01-01T00:00:00.000Z', summary: { total: 10, warn: 1, waived: 0 } },
      { gate: 'G6', ok: false, generatedAt: '2026-01-01T01:00:00.000Z', summary: { total: 20, warn: 0, waived: 2 } },
    ],
    contextInjections: [{ scenario: 'write_ui' }],
    observation: { expectedLevel: 'V1', postTestRequirementOmissionFixes: 1 },
  })
  assert.equal(summary.machineRecorded.files.process, 2)
  assert.equal(summary.machineRecorded.files.evidence, 1)
  assert.equal(summary.machineRecorded.gates.runs, 2)
  assert.equal(summary.machineRecorded.gates.checkEvaluations, 30)
  assert.equal(summary.machineRecorded.gates.recordedWindowMinutes, 60)
  assert.equal(summary.machineRecorded.contextPackCalls, 1)
  assert.equal(summary.unavailableHistoricalMetrics.docsTddTokens, null)
  assert.equal(summarizePortfolio([summary]).reportedRequirementOmissionFixes, 1)
  const compact = summarizeCompactRuns([
    {
      runId: 'a',
      route: 'micro',
      assurance: 'V0',
      routeReasons: [{ route: 'micro', code: 'micro-shape', detail: 'local' }, 'micro-shape'],
      contextChars: 100,
      grossElapsedMs: 1000,
      activeElapsedMs: 400,
      routePolicyVersion: 1,
      observedRoutes: ['micro'],
      commandCount: 2,
      terminalState: 'complete',
    },
    { runId: 'b', route: 'lite', contextChars: 200, elapsedMs: 3000, commandCount: 4, necessaryInterruptCount: 1, terminalState: 'blocked' },
  ])
  assert.deepEqual(compact.routes, ['lite', 'micro'])
  assert.deepEqual(compact.assurances, ['V0'])
  assert.equal(compact.p50ElapsedMs, 1000)
  assert.equal(compact.p90ElapsedMs, 1000)
  assert.equal(compact.p50GrossElapsedMs, 1000)
  assert.equal(compact.p50ActiveElapsedMs, null)
  assert.equal(compact.routes.join(','), 'lite,micro')
  assert.equal(compact.p90ContextChars, 100)
  assert.equal(compact.estimatedInputTokens, null)
  assert.equal(compact.tokenUsage, null)
  const normalized = normalizeCompactRunRecord({
    routeReasons: [{ code: 'micro-shape' }, 'micro-shape'],
    tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, source: 'host-agent' },
  })
  assert.deepEqual(normalized.routeReasons, ['micro-shape'])
  assert.equal(normalized.tokenUsage.totalTokens, 15)
  const pendingSummary = summarizeCompactRuns([{ runId: 'pending', terminalState: 'running' }])
  assert.equal(pendingSummary.incompleteRunCount, 1)
  assert.equal(pendingSummary.completeRunCount, 0)
  assert.equal(pendingSummary.totals.actions, null)
  assert.equal(pendingSummary.p50GrossElapsedMs, null)
  assert.equal(normalizeCompactRunRecord({ terminalState: 'running' }).actionCount, null)
  assert.equal(normalizeCompactRunRecord({ terminalState: 'interrupted' }).commandCount, null)
  assert.deepEqual(artifactConvergence({ baselineProcessFiles: 263, projectCount: 4 }), {
    baselineProcessFiles: 263, projectCount: 4, vnextFilesPerProject: 3, projectedVNextFiles: 12,
    reductionPercent: 95.44, targetReductionPercent: 80, ok: true,
  })
  console.log('vnext-metrics self-test passed')
}

if (process.argv[1]?.endsWith('vnext-metrics.mjs') && process.argv.includes('--self-test')) selfTest()
