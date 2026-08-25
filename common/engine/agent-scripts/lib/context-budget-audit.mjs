#!/usr/bin/env node

import assert from 'node:assert/strict'
import { contextBudgetFor, coordinatorSteps, resolveContextMode } from './context-policy.mjs'

/** Generate every default context path against a max-size summary and report hard-limit violations. */
export function auditDefaultContextPacks({ index, codingScenarios, buildPack }) {
  const errors = []
  const metrics = []
  for (const scenario of Object.keys(index.scenarios || {})) {
    if (coordinatorSteps(index, scenario)) continue
    try {
      const mode = resolveContextMode([], scenario, index)
      const pack = buildPack(scenario, mode)
      const kind = codingScenarios.has(scenario) ? 'coding' : 'stage'
      const budget = contextBudgetFor(index, scenario, kind)
      if (!budget) errors.push(`${scenario}: missing ${kind} budget`)
      else if (pack.packChars > budget.fail) errors.push(`${scenario}: ${pack.packChars} > fail ${budget.fail} (${mode})`)
      metrics.push({ scenario, mode, kind, packChars: pack.packChars, budget })
    } catch (error) {
      errors.push(`${scenario}: ${error.message}`)
    }
  }
  const reductions = metrics
    .filter(({ scenario, kind }) => kind === 'coding' && (index.policy?.briefDefaultScenarios || []).includes(scenario))
    .map(({ scenario, packChars }) => {
      const fullChars = buildPack(scenario, 'full').packChars
      return { scenario, percent: Math.round((1 - packChars / fullChars) * 100) }
    })
  const sorted = reductions.map(({ percent }) => percent).sort((a, b) => a - b)
  const medianReductionPercent = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const minimumMedian = index.policy?.contextTargets?.codingMedianReductionPercent
  if (Number.isFinite(minimumMedian) && medianReductionPercent < minimumMedian) {
    errors.push(`coding median reduction ${medianReductionPercent}% < target ${minimumMedian}%`)
  }

  const g6Steps = coordinatorSteps(index, 'g6_verify') || []
  const g6SequentialChars = g6Steps.reduce((total, scenario, stepIndex) => total + buildPack(scenario, resolveContextMode([], scenario, index), { includeSummary: stepIndex === 0 }).packChars, 0)
  const g6Limit = index.policy?.contextTargets?.g6SequentialMaxChars
  if (Number.isFinite(g6Limit) && g6SequentialChars > g6Limit) errors.push(`G6 sequential packs ${g6SequentialChars} > target ${g6Limit}`)
  return { errors, metrics, reductions, medianReductionPercent, g6SequentialChars }
}

function selfTest() {
  const index = {
    policy: {
      briefDefaultScenarios: ['small'],
      coordinatorScenarios: { coordinator: ['small'] },
      contextBudget: { coding: { warn: 5, fail: 10 }, stage: { warn: 20, fail: 30 }, scenarios: {} },
      contextTargets: { codingMedianReductionPercent: 10, g6SequentialMaxChars: 100 },
    },
    scenarios: { small: ['a.md'], large: ['b.md'], coordinator: [{ scenario: 'small' }] },
  }
  const result = auditDefaultContextPacks({
    index,
    codingScenarios: new Set(['small']),
    buildPack: (scenario, mode) => ({ packChars: scenario === 'small' ? (mode === 'full' ? 16 : 8) : 31 }),
  })
  assert.deepEqual(result.errors, ['large: 31 > fail 30 (compact)'])
  assert.equal(result.metrics.length, 2)
  assert.equal(result.medianReductionPercent, 50)
  console.log('PASS context-budget-audit (all default pack paths + coordinator skip)')
}

if (process.argv[1]?.endsWith('context-budget-audit.mjs') && process.argv.includes('--self-test')) selfTest()
