#!/usr/bin/env node
// v4.0 rule loader: 按 efficiency-policy 预算裁剪规则加载

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

/**
 * 规则文件优先级（从高到低）
 * micro(3) → lite(5) → standard(10) → high-risk(15)
 * 
 * v4.0 策略：用现有完整规则文件，确保覆盖率
 */
const RULE_PRIORITY = [
  // P0: 必须（micro 3 个）
  { path: 'git-branch-flow.md', priority: 1, sizeKB: 10, tags: ['git', 'safety'] },
  { path: 'coding-worktree.md', priority: 2, sizeKB: 13, tags: ['git', 'worktree'] },
  { path: 'biome-config-summary.md', priority: 3, sizeKB: 1, tags: ['format', 'lint'] },
  
  // P1: 重要（lite +2 = 5 个）
  { path: 'coding-core-checklist.md', priority: 4, sizeKB: 1, tags: ['quality'] },
  { path: 'project-readme-summary.md', priority: 5, sizeKB: 2, tags: ['project'] },
  
  // P2: 核心业务（standard +5 = 10 个）
  { path: 'api-and-mapper.md', priority: 6, sizeKB: 6, tags: ['api'] },
  { path: 'architecture-and-state.md', priority: 7, sizeKB: 28, tags: ['state', 'architecture'] },
  { path: 'component-reuse-and-visual-fidelity.md', priority: 8, sizeKB: 10, tags: ['reuse', 'ui'] },
  { path: 'i18n-key-literal-rule.md', priority: 9, sizeKB: 3, tags: ['i18n'] },
  { path: 'hook-integration.md', priority: 10, sizeKB: 10, tags: ['git', 'precommit'] },
  
  // P3: 高风险场景（high-risk +5 = 15 个）
  { path: 'execution-evidence.md', priority: 11, sizeKB: 7, tags: ['test', 'evidence'] },
  { path: 'figma-mcp-read-workflow.md', priority: 12, sizeKB: 8, tags: ['figma'] },
  { path: 'change-scope-boundary.md', priority: 13, sizeKB: 7, tags: ['scope'] },
  { path: 'ui-style-token-rules.md', priority: 14, sizeKB: 9, tags: ['ui', 'style'] },
  { path: 'blocking-and-change-protocol.md', priority: 15, sizeKB: 4, tags: ['safety', 'blocker'] },
]

/**
 * 按 efficiencyRoute 选择规则文件
 * 
 * @param {string} efficiencyRoute - micro | lite | standard | high-risk
 * @param {object} options
 * @param {string[]} options.extraTags - 额外需要的标签（如 ['api', 'figma']）
 * @param {string} options.rulesRoot - 规则根目录
 * @returns {object} { files: [...], totalChars, budget }
 */
export function selectRulesByEfficiency(efficiencyRoute, options = {}) {
  const budgets = {
    micro: { ruleFiles: 3, contextChars: 12000 },
    lite: { ruleFiles: 5, contextChars: 24000 },
    standard: { ruleFiles: 8, contextChars: 80000 },
    'high-risk': { ruleFiles: 12, contextChars: 160000 },
  }
  
  const budget = budgets[efficiencyRoute] || budgets.standard
  const extraTags = options.extraTags || []
  const rulesRoot = options.rulesRoot || resolve(process.cwd(), 'common/rules')
  
  // 按优先级选前 N 个
  let selected = RULE_PRIORITY.slice(0, budget.ruleFiles)
  
  // 如果有 extraTags，且当前 budget 允许，追加匹配的规则
  if (extraTags.length > 0 && selected.length < budget.ruleFiles) {
    const remaining = RULE_PRIORITY.slice(budget.ruleFiles)
    const tagMatched = remaining.filter(r => 
      r.tags.some(tag => extraTags.includes(tag))
    )
    
    const slots = budget.ruleFiles - selected.length
    selected = [...selected, ...tagMatched.slice(0, slots)]
  }
  
  // 加载实际内容
  const loaded = selected.map(rule => {
    const fullPath = join(rulesRoot, rule.path)
    const exists = existsSync(fullPath)
    const content = exists ? readFileSync(fullPath, 'utf-8') : `# ${rule.path}\n(文件不存在，使用占位)`
    
    return {
      path: rule.path,
      priority: rule.priority,
      tags: rule.tags,
      exists,
      content,
      chars: content.length,
    }
  })
  
  const totalChars = loaded.reduce((sum, f) => sum + f.chars, 0)
  
  return {
    efficiencyRoute,
    budget,
    files: loaded,
    totalChars,
    withinBudget: totalChars <= budget.contextChars,
    summary: `${loaded.length} 个规则文件，共 ${totalChars} 字符（预算 ${budget.contextChars}）`,
  }
}

/**
 * 生成裁剪后的规则上下文（拼接成单个字符串）
 * 
 * @param {string} efficiencyRoute
 * @param {object} options
 * @returns {string} 拼接后的规则内容
 */
export function generateRuleContext(efficiencyRoute, options = {}) {
  const selection = selectRulesByEfficiency(efficiencyRoute, options)
  
  if (!selection.withinBudget) {
    console.warn(`⚠️  规则总字符数 ${selection.totalChars} 超出预算 ${selection.budget.contextChars}`)
  }
  
  const header = `# ${efficiencyRoute.toUpperCase()} 档规则集 (${selection.files.length} 个文件)

> 本规则集由 v4.0 efficiency-policy 自动裁剪，预算: ${selection.budget.contextChars} 字符 / ${selection.budget.ruleFiles} 文件
> 实际加载: ${selection.totalChars} 字符 / ${selection.files.length} 文件

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`
  
  const sections = selection.files.map((file, idx) => {
    return `
## [${idx + 1}/${selection.files.length}] ${file.path} (P${file.priority}, ${file.chars} chars)

${file.content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }).join('\n')
  
  return header + sections
}

/**
 * 自测
 */
export function selfTest() {
  console.log('rule-loader-v4 self-test...')
  
  // 测试 1: micro 档（3 个文件）
  const micro = selectRulesByEfficiency('micro', { rulesRoot: '/tmp/fake' })
  if (micro.files.length !== 3) throw new Error('micro should load 3 files')
  if (micro.files[0].priority !== 1) throw new Error('micro should load highest priority first')
  console.log('✓ Test 1: micro 档')
  
  // 测试 2: lite 档（5 个文件）
  const lite = selectRulesByEfficiency('lite', { rulesRoot: '/tmp/fake' })
  if (lite.files.length !== 5) throw new Error('lite should load 5 files')
  console.log('✓ Test 2: lite 档')
  
  // 测试 3: standard 档（8 个文件）
  const standard = selectRulesByEfficiency('standard', { rulesRoot: '/tmp/fake' })
  if (standard.files.length !== 8) throw new Error('standard should load 8 files')
  console.log('✓ Test 3: standard 档')
  
  // 测试 4: extraTags（api + figma）
  const withTags = selectRulesByEfficiency('lite', { 
    rulesRoot: '/tmp/fake',
    extraTags: ['api', 'figma'] 
  })
  if (withTags.files.length < 5) throw new Error('withTags should have at least 5 files')
  console.log('✓ Test 4: extraTags')
  
  // 测试 5: 生成完整 context
  const context = generateRuleContext('micro', { rulesRoot: '/tmp/fake' })
  if (!context.includes('MICRO 档规则集')) throw new Error('context should have header')
  if (!context.includes('git-branch-flow.md')) throw new Error('context should include files')
  console.log('✓ Test 5: generateRuleContext')
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('rule-loader-v4 self-test: 5/5 passed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest()
  } else if (process.argv.includes('--select')) {
    const route = process.argv[process.argv.indexOf('--select') + 1] || 'standard'
    const result = selectRulesByEfficiency(route)
    console.log(JSON.stringify(result, null, 2))
  } else if (process.argv.includes('--generate')) {
    const route = process.argv[process.argv.indexOf('--generate') + 1] || 'standard'
    const context = generateRuleContext(route)
    console.log(context)
  } else {
    console.log(`
Usage:
  node rule-loader-v4.mjs --self-test
  node rule-loader-v4.mjs --select <micro|lite|standard|high-risk>
  node rule-loader-v4.mjs --generate <micro|lite|standard|high-risk>
`)
  }
}
