#!/usr/bin/env node
// v4.0 context builder: vnext-context + rule-loader-v4 集成

import { buildVNextContext } from './vnext-context.mjs'
import { generateRuleContext } from './rule-loader-v4.mjs'
import { resolve } from 'node:path'

/**
 * v4.0 增强版 context 构建器
 * 
 * @param {object} input
 * @param {object} input.workItem - work-item.json
 * @param {object} input.latestResult - latest-result.json (可选)
 * @param {object} input.previousSession - 上次 session (可选)
 * @param {object} options
 * @param {boolean} options.includeRules - 是否包含规则（默认 true）
 * @param {string} options.rulesRoot - 规则根目录
 * @param {string[]} options.extraTags - 额外需要的规则标签
 * @returns {object}
 */
export function buildVNextContextV4(input, options = {}) {
  const { workItem, latestResult = null, previousSession = null } = input
  const includeRules = options.includeRules !== false
  
  // 1. 生成基础 context（项目状态摘要）
  const baseContext = buildVNextContext({ workItem, latestResult, previousSession })
  
  if (!includeRules) {
    return {
      ...baseContext,
      rulesIncluded: false,
      totalChars: baseContext.chars,
    }
  }
  
  // 2. 按 efficiencyRoute 加载规则
  const efficiencyRoute = workItem.efficiencyRoute || 'standard'
  const rulesRoot = options.rulesRoot || resolve(process.cwd(), 'common/rules')
  
  const ruleContext = generateRuleContext(efficiencyRoute, {
    rulesRoot,
    extraTags: options.extraTags || [],
  })
  
  // 3. 合并 context
  const combinedText = `${baseContext.text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ruleContext}
`
  
  const totalChars = Array.from(combinedText).length
  
  return {
    ...baseContext,
    rulesIncluded: true,
    efficiencyRoute,
    ruleSelection: {
      route: efficiencyRoute,
      filesCount: ruleContext.match(/## \[/g)?.length || 0,
      ruleChars: ruleContext.length,
    },
    text: combinedText,
    chars: baseContext.chars, // 保持 baseContext chars 不变，用于预算检查
    totalChars, // 新增总字符数（含规则）
    budgetStatus: totalChars > baseContext.targetBudget ? 'large-context' : 'standard',
  }
}

/**
 * 自测
 */
export function selfTest() {
  console.log('vnext-context-v4 self-test...')
  
  const workItem = {
    workflowVersion: 2,
    projectId: 'TEST-V4-CTX',
    efficiencyRoute: 'lite',
    sourceSnapshot: { revision: '1' },
    coverageAudit: {
      sourceFingerprint: 'abc123',
      reviewer: { kind: 'model', id: 'test' },
      verdict: 'pass',
      findings: [],
      requirementsFingerprint: 'req123',
      sourceUnitsFingerprint: 'unit123',
    },
    routing: {
      scopeClass: 'single-surface',
      riskSignals: [],
      verificationLevel: 'V1',
    },
    apiDependency: { mode: 'not-required' },
    requirements: [{
      requirementId: 'R-001',
      status: 'doing',
      statement: '测试需求',
      sourceAnchors: [{ sourceId: 'SRC-1' }],
      affectedSurfaces: [{ surfaceId: 'S-001', locator: 'test', disposition: 'implement' }],
      evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }],
    }],
  }
  
  // 测试 1: 不含规则
  const withoutRules = buildVNextContextV4({ workItem }, { includeRules: false })
  if (withoutRules.rulesIncluded) throw new Error('should not include rules')
  if (withoutRules.totalChars !== withoutRules.chars) throw new Error('totalChars should equal chars when rules excluded')
  console.log('✓ Test 1: 不含规则')
  
  // 测试 2: lite 档含规则
  const withRules = buildVNextContextV4({ workItem }, { 
    includeRules: true,
    rulesRoot: '/tmp/fake', // 用假路径测试，规则会是占位内容
  })
  if (!withRules.rulesIncluded) throw new Error('should include rules')
  if (withRules.efficiencyRoute !== 'lite') throw new Error('should use lite route')
  if (withRules.totalChars <= withRules.chars) throw new Error('totalChars should be larger when rules included')
  if (!withRules.text.includes('LITE 档规则集')) throw new Error('should contain lite rules header')
  console.log('✓ Test 2: lite 档含规则')
  
  // 测试 3: standard 档
  const standardWorkItem = { ...workItem, efficiencyRoute: 'standard' }
  const standardCtx = buildVNextContextV4({ workItem: standardWorkItem }, { 
    includeRules: true,
    rulesRoot: '/tmp/fake',
  })
  if (standardCtx.efficiencyRoute !== 'standard') throw new Error('should use standard route')
  if (!standardCtx.text.includes('STANDARD 档规则集')) throw new Error('should contain standard rules header')
  console.log('✓ Test 3: standard 档')
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('vnext-context-v4 self-test: 3/3 passed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest()
  } else {
    console.log(`
Usage:
  node vnext-context-v4.mjs --self-test
  
For production use, import buildVNextContextV4() in your code:
  
  import { buildVNextContextV4 } from './vnext-context-v4.mjs'
  
  const context = buildVNextContextV4({ workItem }, {
    includeRules: true,
    rulesRoot: '/path/to/common/rules',
  })
  
  console.log(context.text)
`)
  }
}
