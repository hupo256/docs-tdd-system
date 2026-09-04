#!/usr/bin/env node
// vNext 基线指标纯计算层。只汇总已有机器记录，不推测历史 token、首次落码或流程墙钟时间。

import assert from 'node:assert/strict'

const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0)

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
  assert.deepEqual(artifactConvergence({ baselineProcessFiles: 263, projectCount: 4 }), {
    baselineProcessFiles: 263, projectCount: 4, vnextFilesPerProject: 3, projectedVNextFiles: 12,
    reductionPercent: 95.44, targetReductionPercent: 80, ok: true,
  })
  console.log('vnext-metrics self-test passed')
}

if (process.argv[1]?.endsWith('vnext-metrics.mjs') && process.argv.includes('--self-test')) selfTest()
