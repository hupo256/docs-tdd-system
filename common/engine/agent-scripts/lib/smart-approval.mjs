#!/usr/bin/env node
// v3.5 smart-approval: intelligent scope approval for V2 requirements.
// Reduces unnecessary human intervention by distinguishing explicit high-risk signals
// from multi-surface requirements without obvious risk.

/**
 * 评估 V2 需求是否需要人工 scope approval
 *
 * @param {Object} workItem - work-item 对象
 * @returns {Object} 评估结果
 */
export function evaluateScopeApprovalNeed(workItem) {
  const { routing, requirements } = workItem

  // 检测明确的高风险信号
  const highRiskSignals = {
    funds: ['金额', '费用', '充值', '提现', '支付', '扣款', '余额', 'amount', 'balance', 'payment', 'withdraw', 'deposit'],
    permission: ['权限', '登录', '注册', '删除', '禁用', '注销', 'permission', 'auth', 'login', 'register', 'delete', 'disable'],
    irreversible: ['不可逆', '永久', '删除', '清空', 'permanent', 'irreversible', 'delete', 'purge'],
  }

  let explicitRiskFound = false
  let riskType = null
  const matchedKeywords = []

  // 检查每个 requirement 是否包含高风险关键词
  for (const [type, keywords] of Object.entries(highRiskSignals)) {
    for (const req of requirements) {
      const statement = req.statement.toLowerCase()
      for (const kw of keywords) {
        if (statement.includes(kw.toLowerCase())) {
          explicitRiskFound = true
          riskType = type
          matchedKeywords.push(kw)
        }
      }
      if (explicitRiskFound) break
    }
    if (explicitRiskFound) break
  }

  if (explicitRiskFound) {
    return {
      needsApproval: true,
      reason: `explicit-${riskType}-risk`,
      message: `检测到 ${riskType} 相关操作（${matchedKeywords.slice(0, 3).join(', ')}），需要人工确认范围`,
      riskType,
      matchedKeywords,
    }
  }

  // 只是 multi-surface，无明显高风险
  if (routing.scopeClass === 'cross-boundary' && !explicitRiskFound) {
    return {
      needsApproval: false,
      reason: 'multi-surface-only',
      message: '多落点需求，但无明显高风险信号，AI 可继续，事后复核',
      needsPostReview: true,
    }
  }

  // 低风险，不需要 approval
  return {
    needsApproval: false,
    reason: 'low-risk',
    message: '低风险需求，AI 可直接继续',
  }
}

/**
 * 生成智能提示消息
 *
 * @param {Object} evaluation - evaluateScopeApprovalNeed 的结果
 * @returns {string} 格式化的提示消息
 */
export function formatApprovalMessage(evaluation) {
  if (!evaluation.needsApproval) {
    if (evaluation.needsPostReview) {
      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️  智能审批：跳过人工确认

原因: ${evaluation.message}

【AI 将继续执行】
- 自动完成实现
- 标记为"需要事后复核"
- 交付时提醒用户检查

【人工介入点】
- 交付时复核改动范围
- 如有问题可重新调整
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    }

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 智能审批：无需人工确认

原因: ${evaluation.message}

AI 将直接继续执行
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  需要人工确认范围

原因: ${evaluation.message}

【检测到的风险信号】
${evaluation.matchedKeywords.slice(0, 5).join(', ')}

【需要确认】
1. 改动范围是否合理
2. 是否有遗漏的落点
3. 风险评估是否准确

请仔细审查后确认继续
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}

/**
 * 单元测试
 */
export function selfTest() {
  console.log('Running smart-approval self-test...\n')

  const testCases = [
    {
      name: '明确的资金操作（需要审批）',
      workItem: {
        routing: { scopeClass: 'cross-boundary' },
        requirements: [
          { statement: '实现充值功能，支持支付宝和微信' },
          { statement: '显示余额和金额' },
        ],
      },
      expectedNeedsApproval: true,
      expectedReason: 'explicit-funds-risk',
    },
    {
      name: '明确的权限操作（需要审批）',
      workItem: {
        routing: { scopeClass: 'single-module' },
        requirements: [
          { statement: '修改登录逻辑，增加二次验证' },
          { statement: '调整权限检查规则' },
        ],
      },
      expectedNeedsApproval: true,
      expectedReason: 'explicit-permission-risk',
    },
    {
      name: '多落点无高风险（跳过审批）',
      workItem: {
        routing: { scopeClass: 'cross-boundary' },
        requirements: [
          { statement: '在多个页面显示新的提示文案' },
          { statement: '调整布局样式' },
        ],
      },
      expectedNeedsApproval: false,
      expectedReason: 'multi-surface-only',
    },
    {
      name: '低风险单一改动（跳过审批）',
      workItem: {
        routing: { scopeClass: 'single-module' },
        requirements: [
          { statement: '修改按钮文案' },
          { statement: '调整颜色' },
        ],
      },
      expectedNeedsApproval: false,
      expectedReason: 'low-risk',
    },
  ]

  let passed = 0
  let failed = 0

  for (const tc of testCases) {
    const result = evaluateScopeApprovalNeed(tc.workItem)

    if (result.needsApproval !== tc.expectedNeedsApproval) {
      console.error(`❌ Test failed: ${tc.name}`)
      console.error(`   Expected needsApproval: ${tc.expectedNeedsApproval}, got: ${result.needsApproval}`)
      console.error(`   Reason: ${result.reason}`)
      failed++
    } else if (result.reason !== tc.expectedReason) {
      console.error(`❌ Test failed: ${tc.name}`)
      console.error(`   Expected reason: ${tc.expectedReason}, got: ${result.reason}`)
      failed++
    } else {
      console.log(`✓ Test passed: ${tc.name}`)
      passed++
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`smart-approval self-test: ${passed} passed, ${failed} failed`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`)
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest()
  } else {
    console.log(`
Usage:
  node smart-approval.mjs --self-test
`)
  }
}
