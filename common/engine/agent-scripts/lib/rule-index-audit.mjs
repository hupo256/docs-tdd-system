#!/usr/bin/env node

import assert from 'node:assert/strict'
import { validateContextPolicy } from './context-policy.mjs'

const normalizeRef = (ref) => (typeof ref === 'string' ? { file: ref, sections: '' } : ref)

/** Audit the rule-index graph and every concrete markdown reference without performing filesystem IO. */
export function auditRuleIndex({ index, residentFile, codingScenarios = new Set(), resolveSourceFile, readSource }) {
  const errors = []
  const indexedRuleRefs = new Set()
  const scenarios = index?.scenarios || {}
  const scenarioNames = Object.keys(scenarios)

  if (index?.resident !== residentFile) {
    errors.push(`resident 应为 ${residentFile}，当前为 ${index?.resident || '空'}。`)
  }
  if (!scenarioNames.length) errors.push('scenarios 不能为空。')
  for (const error of validateContextPolicy(index || {}, { codingScenarios })) {
    errors.push(`context policy 无效：${error}`)
  }

  const validateScenario = (name, stack = []) => {
    if (stack.includes(name)) {
      errors.push(`scenarios 出现循环引用：${[...stack, name].join(' -> ')}`)
      return
    }
    const refs = scenarios[name]
    if (!Array.isArray(refs) || refs.length === 0) {
      errors.push(`scenarios.${name} 必须是非空数组。`)
      return
    }
    for (const ref of refs) {
      if (ref && typeof ref.scenario === 'string') {
        if (!Array.isArray(scenarios[ref.scenario])) errors.push(`scenarios.${name} 引用了不存在的场景：${ref.scenario}`)
        else validateScenario(ref.scenario, [...stack, name])
        continue
      }
      const normalized = normalizeRef(ref)
      if (!normalized || typeof normalized.file !== 'string') {
        errors.push(`scenarios.${name} 含无效引用：${JSON.stringify(ref)}`)
        continue
      }
      const { file, sections = '' } = normalized
      if (file.endsWith('.md')) indexedRuleRefs.add(file)
      const sourceFile = resolveSourceFile(file)
      if (!sourceFile) {
        errors.push(`scenarios.${name} 引用了不存在的文件：${file}`)
        continue
      }
      if (!sections) continue
      const selectors = sections.split(',').map((part) => /^(\d+)(?:-(\d+))?$/.exec(part.trim()))
      if (selectors.some((selector) => !selector || Number(selector[2] || selector[1]) < Number(selector[1]))) {
        errors.push(`scenarios.${name} 的 sections 无效：${sections}`)
        continue
      }
      const headings = [...readSource(sourceFile).matchAll(/^##\s+(\d+)(?:\.|\s)/gm)].map((match) => Number(match[1]))
      for (const selector of selectors) {
        if (!headings.some((heading) => heading >= Number(selector[1]) && heading <= Number(selector[2] || selector[1]))) {
          errors.push(`scenarios.${name} 的 sections 未命中标题：${file} §${selector[0]}`)
        }
      }
    }
  }
  for (const name of scenarioNames) validateScenario(name)
  return { errors, scenarioNames, indexedRuleRefs }
}

function selfTest() {
  const policy = {
    briefDefaultScenarios: [],
    coordinatorScenarios: {},
    contextBudget: { coding: { warn: 10, fail: 20 }, stage: { warn: 20, fail: 30 }, scenarios: {} },
    contextTargets: { codingMedianReductionPercent: 50, g6SequentialMaxChars: 100 },
  }
  const files = new Map([['a.md', '## 1. One\ntext\n## 2 Two\ntext']])
  const run = (index) => auditRuleIndex({
    index,
    residentFile: 'router.md',
    codingScenarios: new Set(['base']),
    resolveSourceFile: (file) => (files.has(file) ? file : null),
    readSource: (file) => files.get(file),
  })
  const valid = run({ resident: 'router.md', policy, scenarios: { base: [{ file: 'a.md', sections: '1-2', brief: 'pointer' }] } })
  assert.deepEqual(valid.errors, [])
  assert.deepEqual(valid.scenarioNames, ['base'])
  assert.deepEqual([...valid.indexedRuleRefs], ['a.md'])

  const broken = run({
    resident: 'wrong.md',
    policy: { ...policy, briefDefaultScenarios: ['missing'] },
    scenarios: {
      base: [{ scenario: 'cycle' }, { file: 'missing.md', brief: 'pointer' }, { file: 'a.md', sections: '3' }],
      cycle: [{ scenario: 'base' }],
    },
  })
  assert.ok(broken.errors.some((error) => error.includes('resident 应为')))
  assert.ok(broken.errors.some((error) => error.includes('循环引用')))
  assert.ok(broken.errors.some((error) => error.includes('不存在的文件')))
  assert.ok(broken.errors.some((error) => error.includes('未命中标题')))
  assert.ok(broken.errors.some((error) => error.includes('brief default references unknown scenario')))
  console.log('PASS rule-index-audit (graph + source + section + policy validation)')
}

if (process.argv[1]?.endsWith('rule-index-audit.mjs') && process.argv.includes('--self-test')) selfTest()
