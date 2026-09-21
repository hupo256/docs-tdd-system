#!/usr/bin/env node
// v3.5 smart-rules: intelligent rule injection based on verification level and requirement signals.
// Reduces AI cognitive load by injecting only relevant rules instead of the full rule set.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * 根据验证级别和需求信号智能选择规则
 *
 * @param {string} verificationLevel - V0-lite | V0 | V1 | V2
 * @param {Object} signals - 需求信号
 * @returns {Object} 选择的规则集
 */
export function selectRules(verificationLevel, signals = {}) {
  const baseRules = loadBaseRules()

  switch (verificationLevel) {
    case 'V0-lite':
      // 快速通道：只注入核心规则
      return {
        level: 'V0-lite',
        size: '~2K',
        description: '核心规则（快速通道专用）',
        rules: [baseRules.core],
        estimatedTokens: 500,
      }

    case 'V0':
      // 单模块低风险：核心 + 质量基础
      return {
        level: 'V0',
        size: '~5K',
        description: '精简规则（单模块低风险）',
        rules: [
          baseRules.core,
          baseRules.qualityBasics,
        ],
        estimatedTokens: 1250,
      }

    case 'V1':
      // 多模块中风险：标准规则 + 领域规则
      return {
        level: 'V1',
        size: '~10K',
        description: '标准规则（多模块中风险）',
        rules: [
          baseRules.core,
          baseRules.qualityBasics,
          ...loadDomainRules(signals),
        ],
        estimatedTokens: 2500,
      }

    case 'V2':
      // 高风险：完整规则
      return {
        level: 'V2',
        size: '~20K',
        description: '完整规则（高风险需求）',
        rules: [
          baseRules.core,
          baseRules.qualityBasics,
          baseRules.v2HighRisk,
          ...loadDomainRules(signals),
        ],
        estimatedTokens: 5000,
      }

    default:
      // 默认使用 V1 标准规则
      return selectRules('V1', signals)
  }
}

/**
 * 加载基础规则
 */
function loadBaseRules() {
  return {
    core: {
      name: 'core',
      description: '核心规则（必须）',
      content: `
# 核心规则

## 文件修改原则
- 只修改需要改的文件
- 保持代码风格一致
- 不做无关重构

## 提交规范
- 清晰的提交信息
- 原子性提交
- 相关改动一起提交

## 基本质量
- 无 Lint 错误
- 无 TypeScript 错误
- 基本功能正常
`,
      size: 500,
    },

    qualityBasics: {
      name: 'qualityBasics',
      description: '基础质量规则',
      content: `
# 基础质量规则

## 代码质量
- 命名清晰易懂
- 避免重复代码
- 适当的注释

## 测试要求
- 关键逻辑有测试
- 边界条件覆盖
- 错误处理验证

## 性能考虑
- 避免不必要的重渲染
- 合理使用 memo
- 避免内存泄漏
`,
      size: 750,
    },

    v2HighRisk: {
      name: 'v2HighRisk',
      description: '高风险专项规则',
      content: `
# 高风险专项规则

## 资金操作
- 金额计算精度
- 货币单位统一
- 四舍五入规则
- 金额展示格式

## 权限控制
- 检查用户权限
- 敏感操作二次确认
- 错误信息不泄露敏感信息

## 不可逆操作
- 必须有确认步骤
- 清晰的警告提示
- 操作日志记录
`,
      size: 1500,
    },
  }
}

/**
 * 根据信号加载领域规则
 */
function loadDomainRules(signals) {
  const domainRules = []

  // 检测领域信号
  if (signals.hasFunds) {
    domainRules.push({
      name: 'funds',
      description: '资金领域规则',
      content: `
# 资金领域规则

## 金额处理
- 精度：8 位小数
- 计算：使用 Decimal.js
- 展示：根据币种格式化

## 手续费
- 费率范围检查
- 费用计算公式
- 负费率特殊处理
`,
      size: 1000,
    })
  }

  if (signals.hasPermission) {
    domainRules.push({
      name: 'permission',
      description: '权限领域规则',
      content: `
# 权限领域规则

## 权限检查
- 前端 UI 权限控制
- 后端 API 权限验证
- 敏感操作二次确认
`,
      size: 800,
    })
  }

  if (signals.hasForm) {
    domainRules.push({
      name: 'form',
      description: '表单领域规则',
      content: `
# 表单领域规则

## 表单验证
- 必填项检查
- 格式验证
- 自定义校验规则

## 用户体验
- 实时验证反馈
- 错误信息清晰
- 提交状态管理
`,
      size: 1000,
    })
  }

  if (signals.hasList) {
    domainRules.push({
      name: 'list',
      description: '列表领域规则',
      content: `
# 列表领域规则

## 性能优化
- 虚拟滚动
- 分页加载
- 数据缓存

## 用户体验
- Loading 状态
- Empty 状态
- Error 状态
`,
      size: 1000,
    })
  }

  return domainRules
}

/**
 * 检测需求信号
 *
 * @param {Object} workItem - work-item 对象
 * @returns {Object} 检测到的信号
 */
export function detectSignals(workItem) {
  const { requirements = [] } = workItem
  const fullText = requirements.map(r => r.statement).join(' ').toLowerCase()

  return {
    hasFunds: /金额|费用|充值|提现|支付|余额|amount|balance|payment/.test(fullText),
    hasPermission: /权限|登录|注册|认证|授权|permission|auth/.test(fullText),
    hasForm: /表单|输入|验证|form|input|validation/.test(fullText),
    hasList: /列表|分页|滚动|list|pagination|scroll/.test(fullText),
    hasCollection: /所有|全部|批量|每个/.test(fullText),
  }
}

/**
 * 生成规则注入内容
 *
 * @param {Object} ruleSet - selectRules 返回的规则集
 * @returns {string} 格式化的规则内容
 */
export function formatRules(ruleSet) {
  const header = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 规则集: ${ruleSet.level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

级别: ${ruleSet.level}
描述: ${ruleSet.description}
大小: ${ruleSet.size} (~${ruleSet.estimatedTokens} tokens)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

  const rulesContent = ruleSet.rules.map(rule => `
## ${rule.description}

${rule.content.trim()}
`).join('\n')

  return header + rulesContent
}

/**
 * 对比规则注入大小
 */
export function compareRuleInjection() {
  const levels = ['V0-lite', 'V0', 'V1', 'V2']
  const signals = {
    hasFunds: true,
    hasPermission: true,
    hasForm: true,
    hasList: false,
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('规则注入大小对比')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  for (const level of levels) {
    const ruleSet = selectRules(level, signals)
    console.log(`${level.padEnd(10)} ${ruleSet.size.padEnd(10)} ~${ruleSet.estimatedTokens} tokens`)
    console.log(`           ${ruleSet.description}`)
    console.log(`           包含 ${ruleSet.rules.length} 个规则模块\n`)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('优化效果:')
  console.log('  V0-lite: 相比完整规则减少 90% (500 vs 5000 tokens)')
  console.log('  V0:      相比完整规则减少 75% (1250 vs 5000 tokens)')
  console.log('  V1:      相比完整规则减少 50% (2500 vs 5000 tokens)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

/**
 * 单元测试
 */
export function selfTest() {
  console.log('Running smart-rules self-test...\n')

  // Test 1: V0-lite 规则选择
  const rules1 = selectRules('V0-lite')
  if (rules1.rules.length !== 1 || rules1.estimatedTokens !== 500) {
    throw new Error('Test 1 failed: V0-lite should have 1 rule and 500 tokens')
  }
  console.log('✓ Test 1 passed: V0-lite rule selection')

  // Test 2: V2 规则选择
  const rules2 = selectRules('V2', { hasFunds: true, hasForm: true })
  if (rules2.rules.length < 4) {
    throw new Error('Test 2 failed: V2 should have 4+ rules')
  }
  console.log('✓ Test 2 passed: V2 rule selection with signals')

  // Test 3: 信号检测
  const signals = detectSignals({
    requirements: [
      { statement: '实现充值功能' },
      { statement: '添加表单验证' },
    ],
  })
  if (!signals.hasFunds || !signals.hasForm) {
    throw new Error('Test 3 failed: signal detection')
  }
  console.log('✓ Test 3 passed: signal detection')

  // Test 4: 规则格式化
  const formatted = formatRules(rules1)
  if (!formatted.includes('V0-lite') || !formatted.includes('核心规则')) {
    throw new Error('Test 4 failed: rule formatting')
  }
  console.log('✓ Test 4 passed: rule formatting')

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`smart-rules self-test: 4 passed, 0 failed`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest()
  } else if (process.argv.includes('--compare')) {
    compareRuleInjection()
  } else {
    console.log(`
Usage:
  node smart-rules.mjs --self-test
  node smart-rules.mjs --compare
`)
  }
}
