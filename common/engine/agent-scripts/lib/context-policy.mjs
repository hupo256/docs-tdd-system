#!/usr/bin/env node

import assert from 'node:assert/strict'

export const CONTEXT_MODES = new Set(['brief', 'compact', 'full'])

/** Resolve one explicit context mode, otherwise use the scenario default. */
export function resolveContextMode(args, scenario, index) {
  const requested = [...CONTEXT_MODES].filter((mode) => args.includes(`--${mode}`))
  if (requested.length > 1) throw new Error(`context mode flags are mutually exclusive: ${requested.map((mode) => `--${mode}`).join(', ')}`)
  if (requested.length === 1) return requested[0]
  return (index.policy?.briefDefaultScenarios || []).includes(scenario) ? 'brief' : 'compact'
}

export function contextBudgetFor(index, scenario, kind) {
  const budgets = index.policy?.contextBudget
  return budgets?.scenarios?.[scenario] || budgets?.[kind]
}

export const coordinatorSteps = (index, scenario) => index.policy?.coordinatorScenarios?.[scenario] || null

/** Validate context policy as a closed configuration contract. */
export function validateContextPolicy(index, { codingScenarios = new Set() } = {}) {
  const errors = []
  const scenarios = index.scenarios || {}
  const policy = index.policy || {}
  const briefDefaults = policy.briefDefaultScenarios
  if (!Array.isArray(briefDefaults)) errors.push('policy.briefDefaultScenarios must be an array')
  else {
    for (const scenario of briefDefaults) {
      if (!Object.hasOwn(scenarios, scenario)) errors.push(`brief default references unknown scenario: ${scenario}`)
    }
  }
  for (const [scenario, steps] of Object.entries(policy.coordinatorScenarios || {})) {
    if (!Object.hasOwn(scenarios, scenario)) errors.push(`coordinator references unknown scenario: ${scenario}`)
    if (!Array.isArray(steps) || steps.length === 0) errors.push(`coordinator ${scenario} must define non-empty steps`)
    else for (const step of steps) if (!Object.hasOwn(scenarios, step)) errors.push(`coordinator ${scenario} references unknown step: ${step}`)
  }

  const validateBudget = (label, budget) => {
    if (!budget || !Number.isInteger(budget.warn) || !Number.isInteger(budget.fail) || budget.warn <= 0 || budget.fail <= 0) {
      errors.push(`${label} must define positive integer warn/fail`)
      return
    }
    if (budget.warn >= budget.fail) errors.push(`${label} must satisfy warn < fail`)
  }
  const budgets = policy.contextBudget
  if (!budgets || typeof budgets !== 'object') errors.push('policy.contextBudget must be an object')
  else {
    validateBudget('policy.contextBudget.coding', budgets.coding)
    validateBudget('policy.contextBudget.stage', budgets.stage)
    for (const [scenario, budget] of Object.entries(budgets.scenarios || {})) {
      if (!Object.hasOwn(scenarios, scenario)) errors.push(`context budget references unknown scenario: ${scenario}`)
      validateBudget(`policy.contextBudget.scenarios.${scenario}`, budget)
    }
  }
  const targets = policy.contextTargets
  if (!targets || !Number.isFinite(targets.codingMedianReductionPercent) || targets.codingMedianReductionPercent < 0 || targets.codingMedianReductionPercent > 100) {
    errors.push('policy.contextTargets.codingMedianReductionPercent must be between 0 and 100')
  }
  if (!targets || !Number.isInteger(targets.g6SequentialMaxChars) || targets.g6SequentialMaxChars <= 0) {
    errors.push('policy.contextTargets.g6SequentialMaxChars must be a positive integer')
  }

  const visitRefs = (scenario, stack = []) => {
    if (stack.includes(scenario)) return
    for (const ref of scenarios[scenario] || []) {
      if (ref && typeof ref.scenario === 'string') {
        visitRefs(ref.scenario, [...stack, scenario])
        continue
      }
      if (ref && typeof ref === 'object' && ref.brief != null && ref.brief !== 'pointer') {
        errors.push(`scenarios.${scenario} has invalid brief mode for ${ref.file || 'unknown'}: ${ref.brief}`)
      }
    }
  }
  for (const scenario of Object.keys(scenarios)) visitRefs(scenario)

  for (const scenario of codingScenarios) {
    if (!Object.hasOwn(scenarios, scenario)) errors.push(`coding scenario is missing from rule index: ${scenario}`)
  }
  return errors
}

function selfTest() {
  const index = {
    policy: {
      briefDefaultScenarios: ['write_ui'],
      contextBudget: { coding: { warn: 10, fail: 20 }, stage: { warn: 20, fail: 30 }, scenarios: {} },
      coordinatorScenarios: {},
      contextTargets: { codingMedianReductionPercent: 50, g6SequentialMaxChars: 100 },
    },
    scenarios: { write_ui: [{ file: 'ui.md', sections: '1', brief: 'pointer' }] },
  }
  assert.equal(resolveContextMode([], 'write_ui', index), 'brief')
  assert.equal(resolveContextMode(['--compact'], 'write_ui', index), 'compact')
  assert.equal(resolveContextMode(['--full'], 'write_ui', index), 'full')
  assert.throws(() => resolveContextMode(['--brief', '--full'], 'write_ui', index), /mutually exclusive/)
  assert.deepEqual(validateContextPolicy(index, { codingScenarios: new Set(['write_ui']) }), [])
  const broken = structuredClone(index)
  broken.policy.contextBudget.coding = { warn: 20, fail: 10 }
  broken.policy.briefDefaultScenarios.push('missing')
  broken.scenarios.write_ui[0].brief = 'hide'
  assert.equal(validateContextPolicy(broken, { codingScenarios: new Set(['write_ui', 'write_api']) }).length, 4)
  console.log('PASS context-policy (mode parsing + closed policy validation)')
}

if (process.argv[1]?.endsWith('context-policy.mjs') && process.argv.includes('--self-test')) selfTest()
