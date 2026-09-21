#!/usr/bin/env node
// v3.5 smart-review: intelligent review handling with automatic retry and AI suggestions.
// Reduces human intervention by allowing AI to self-correct on first failure.

/**
 * 处理审查结果，决定是自动修正还是人工介入
 *
 * @param {Object} finding - 审查发现的问题
 * @param {number} attempt - 当前尝试次数（1-based）
 * @param {Object} options - 选项
 * @returns {Object} 处理决策
 */
export async function handleReviewFinding(finding, attempt, options = {}) {
  const { autoFix = true, maxAttempts = 2 } = options

  // 第1次发现问题：AI 自动修正
  if (attempt === 1 && autoFix) {
    console.log(`\n📝 审查发现问题，AI 自动修正（第 ${attempt} 次）...`)
    console.log(`   问题: ${finding.issue}`)
    console.log(`   建议: ${finding.suggestion || '自动分析修正方案'}`)

    // AI 自动修正
    const fix = await autoFixIssue(finding)

    if (fix.success) {
      console.log(`   ✓ 已自动修正`)
      return {
        action: 'retry',
        fix,
        message: '已自动修正，重新提交审查',
      }
    } else {
      console.log(`   ✗ 自动修正失败: ${fix.error}`)
      console.log(`   → 转人工介入`)
      return {
        action: 'escalate',
        reason: 'auto-fix-failed',
        message: '自动修正失败，需要人工介入',
      }
    }
  }

  // 第2次相同问题：提供 AI 建议方案 + 人工选择
  if (attempt === 2) {
    console.log(`\n⚠️  第 ${attempt} 次发现相同问题，需要人工介入`)
    console.log(`   问题: ${finding.issue}`)

    // 生成 AI 建议方案
    const aiSuggestion = await generateSuggestion(finding)

    return {
      action: 'suggest',
      suggestion: aiSuggestion,
      message: 'AI 建议方案已生成，等待用户选择',
      choices: [
        { value: 'accept', label: '接受 AI 方案' },
        { value: 'manual', label: '提供新方向' },
        { value: 'postpone', label: '延期处理' },
      ],
    }
  }

  // 超过最大尝试次数：强制人工
  if (attempt > maxAttempts) {
    console.log(`\n❌ 超过最大尝试次数 (${maxAttempts})，强制人工介入`)
    return {
      action: 'escalate',
      reason: 'max-attempts-exceeded',
      message: `已尝试 ${attempt} 次，需要人工介入`,
    }
  }

  // 默认：escalate
  return {
    action: 'escalate',
    reason: 'unknown',
    message: '未知情况，需要人工介入',
  }
}

/**
 * AI 自动修正问题
 *
 * @param {Object} finding - 审查发现的问题
 * @returns {Object} 修正结果
 */
async function autoFixIssue(finding) {
  // TODO: 实际实现需要调用 AI
  // 这里先返回模拟数据

  // Prompt 示例：
  // """
  // 审查发现以下问题：
  // ${finding.issue}
  //
  // 建议修正：
  // ${finding.suggestion}
  //
  // 请修正代码，解决这个问题。
  // """

  // 模拟：根据问题类型决定是否能自动修正
  const autoFixableIssues = [
    'lint',
    'format',
    'naming',
    'simple-logic',
  ]

  const isAutoFixable = autoFixableIssues.some(type =>
    finding.issue.toLowerCase().includes(type)
  )

  if (isAutoFixable) {
    return {
      success: true,
      changes: [
        { file: 'example.tsx', description: '已修正' },
      ],
    }
  }

  return {
    success: false,
    error: '问题复杂，无法自动修正',
  }
}

/**
 * 生成 AI 建议方案
 *
 * @param {Object} finding - 审查发现的问题
 * @returns {Object} AI 建议方案
 */
async function generateSuggestion(finding) {
  // TODO: 实际实现需要调用 AI
  // 这里先返回模拟数据

  // Prompt 示例：
  // """
  // 审查发现以下问题：
  // ${finding.issue}
  //
  // 第1次自动修正失败了。
  //
  // 请分析问题根因，提供详细的修正方案：
  // 1. 问题根因分析
  // 2. 具体修正步骤
  // 3. 需要修改的文件
  // 4. 预期效果
  // """

  return {
    analysis: '问题根因：逻辑不完整',
    steps: [
      '1. 修改 X 文件的 Y 函数',
      '2. 增加边界条件检查',
      '3. 更新相关测试',
    ],
    files: ['example.tsx', 'example.test.tsx'],
    expectedResult: '修正后应该通过审查',
    description: `
【问题根因】
${finding.issue}

【建议方案】
1. 修改 X 文件的 Y 函数
2. 增加边界条件检查
3. 更新相关测试

【预期效果】
修正后应该通过审查
`,
  }
}

/**
 * 格式化审查处理结果消息
 *
 * @param {Object} result - handleReviewFinding 的结果
 * @returns {string} 格式化的消息
 */
export function formatReviewMessage(result) {
  if (result.action === 'retry') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ AI 自动修正完成

${result.message}

【修正内容】
${result.fix.changes.map(c => `- ${c.file}: ${c.description}`).join('\n')}

【下一步】
重新提交审查
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }

  if (result.action === 'suggest') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 AI 建议方案

${result.suggestion.description}

【请选择】
${result.choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }

  if (result.action === 'escalate') {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  需要人工介入

${result.message}

原因: ${result.reason}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }

  return result.message || '未知结果'
}

/**
 * 单元测试
 */
export async function selfTest() {
  console.log('Running smart-review self-test...\n')

  // Test 1: 第1次，可自动修正
  const result1 = await handleReviewFinding(
    { issue: 'lint error in file', suggestion: 'fix formatting' },
    1
  )

  if (result1.action !== 'retry') {
    throw new Error('Test 1 failed: should retry after auto-fix')
  }
  console.log('✓ Test 1 passed: auto-fix on first attempt')

  // Test 2: 第1次，无法自动修正
  const result2 = await handleReviewFinding(
    { issue: 'complex logic error', suggestion: 'rethink approach' },
    1
  )

  if (result2.action !== 'escalate') {
    throw new Error('Test 2 failed: should escalate if auto-fix fails')
  }
  console.log('✓ Test 2 passed: escalate when auto-fix fails')

  // Test 3: 第2次，提供建议
  const result3 = await handleReviewFinding(
    { issue: 'same issue again', suggestion: 'try different approach' },
    2
  )

  if (result3.action !== 'suggest') {
    throw new Error('Test 3 failed: should suggest on second attempt')
  }
  console.log('✓ Test 3 passed: suggest on second attempt')

  // Test 4: 超过最大次数
  const result4 = await handleReviewFinding(
    { issue: 'persistent issue', suggestion: 'needs help' },
    3
  )

  if (result4.action !== 'escalate') {
    throw new Error('Test 4 failed: should escalate after max attempts')
  }
  console.log('✓ Test 4 passed: escalate after max attempts')

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`smart-review self-test: 4 passed, 0 failed`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest().catch(error => {
      console.error(error)
      process.exit(1)
    })
  } else {
    console.log(`
Usage:
  node smart-review.mjs --self-test
`)
  }
}
