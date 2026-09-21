#!/usr/bin/env node
// v3.5 lite-path router: evaluates whether a requirement is eligible for the fast track.
// Fast track skips three-stage extraction and independent review for very low-risk changes.

/**
 * Lite Path 白名单场景
 * 这些场景风险极低，可以走快速通道
 */
export const LITE_PATH_CRITERIA = {
  // 白名单模式匹配
  whitelistPatterns: [
    {
      pattern: /纯文案修改|只改文案|文字修改|改文字|修改文案|文案调整|翻译文本|把.*改成|改为|改成|前端文案|页面文案|提示文案|显示文案|新增.*文案|替换.*文案/i,
      risk: 'very-low',
      description: '纯文案修改'
    },
    {
      pattern: /样式调整|改颜色|改间距|改字号|调整样式|修改样式|改边距|改圆角/i,
      risk: 'very-low',
      description: '样式调整'
    },
    {
      pattern: /修复typo|修复拼写|拼写错误|typo|拼写修正/i,
      risk: 'very-low',
      description: '拼写修复'
    },
    {
      pattern: /简单bug修复|小bug|明显的bug|显而易见的错误/i,
      risk: 'low',
      description: '简单bug修复'
    },
    {
      pattern: /前端提示|提示信息|错误提示|成功提示|校验提示|提示消息/i,
      risk: 'very-low',
      description: '前端提示修改'
    },
  ],

  // 黑名单信号（任一匹配 → 禁止快速通道）
  // 一票否决：高风险操作不能被“前端文案”或“纯展示”措辞覆盖。
  blacklistSignals: [
    // 资金相关
    { keyword: '资金', category: 'funds' },
    { keyword: '金额', category: 'funds' },
    { keyword: '费用', category: 'funds' },
    { keyword: '充值', category: 'funds' },
    { keyword: '提现', category: 'funds' },
    { keyword: '支付', category: 'funds' },
    { keyword: '扣款', category: 'funds' },
    { keyword: '余额', category: 'funds' },
    { keyword: 'amount', category: 'funds' },
    { keyword: 'balance', category: 'funds' },
    { keyword: 'payment', category: 'funds' },

    // 权限相关
    { keyword: '权限', category: 'permission' },
    { keyword: '登录', category: 'permission' },
    { keyword: '注册', category: 'permission' },
    { keyword: '认证', category: 'permission' },
    { keyword: '授权', category: 'permission' },
    { keyword: 'permission', category: 'permission' },
    { keyword: 'auth', category: 'permission' },

    // 不可逆操作
    { keyword: '删除', category: 'irreversible' },
    { keyword: '禁用', category: 'irreversible' },
    { keyword: '注销', category: 'irreversible' },
    { keyword: '不可逆', category: 'irreversible' },
    { keyword: '永久', category: 'irreversible' },

    // API/后端变更
    { keyword: 'API', category: 'backend' },
    { keyword: '接口', category: 'backend' },
    { keyword: '后端', category: 'backend' },
    { keyword: '数据库', category: 'backend' },
    { keyword: 'schema', category: 'backend' },

    // 集合/批量操作
    { keyword: '所有', category: 'collection' },
    { keyword: '全部', category: 'collection' },
    { keyword: '批量', category: 'collection' },
    { keyword: '每个', category: 'collection' },
  ],

  // 文件数量限制
  maxFiles: 3,

  // 最小信心度阈值
  minConfidence: 0.8,
}

/**
 * 评估需求是否适合快速通道
 * @param {string} prdText - PRD 文本内容
 * @param {string} userIntent - 用户意图描述
 * @returns {Object} 评估结果
 */
export function evaluateLitePath(prdText, userIntent) {
  const fullText = `${prdText} ${userIntent}`.toLowerCase()

  const signals = {
    whitelistMatch: null,
    blacklistMatches: [],
    estimatedFileCount: estimateFileCount(fullText),
    confidence: 0,
  }

  // 检查白名单（正向信号）
  for (const { pattern, risk, description } of LITE_PATH_CRITERIA.whitelistPatterns) {
    if (pattern.test(prdText) || pattern.test(userIntent)) {
      signals.whitelistMatch = { risk, description }
      signals.confidence = risk === 'very-low' ? 0.95 : 0.75
      break
    }
  }

  // 任意高风险信号都一票否决。路由器不推断“只是前端提示”，避免把资金、
  // 权限、后端或不可逆操作隐藏在低风险文案描述后。
  for (const { keyword, category } of LITE_PATH_CRITERIA.blacklistSignals) {
    if (fullText.includes(keyword.toLowerCase())) {
      signals.blacklistMatches.push({ keyword, category })
      signals.confidence = 0
    }
  }

  // 文件数量检查
  if (signals.estimatedFileCount > LITE_PATH_CRITERIA.maxFiles) {
    signals.confidence = Math.min(signals.confidence, 0.3)
  }

  // 综合判断
  const eligible =
    signals.whitelistMatch !== null &&
    signals.confidence > 0 &&
    Number.isInteger(signals.estimatedFileCount) &&
    signals.estimatedFileCount > 0 &&
    signals.estimatedFileCount <= LITE_PATH_CRITERIA.maxFiles &&
    signals.confidence >= LITE_PATH_CRITERIA.minConfidence

  let reason = 'unknown'
  if (!signals.whitelistMatch) {
    reason = 'no-whitelist-match'
  } else if (signals.confidence === 0 && signals.blacklistMatches.length > 0) {
    reason = `blacklist-signal-detected:${signals.blacklistMatches.map(m => m.keyword).join(',')}`
  } else if (signals.estimatedFileCount > LITE_PATH_CRITERIA.maxFiles) {
    reason = `too-many-files:${signals.estimatedFileCount}`
  } else if (!Number.isInteger(signals.estimatedFileCount) || signals.estimatedFileCount < 1) {
    reason = 'unknown-file-count'
  } else if (signals.confidence < LITE_PATH_CRITERIA.minConfidence) {
    reason = `low-confidence:${signals.confidence.toFixed(2)}`
  } else {
    reason = `eligible:${signals.whitelistMatch.description}`
  }

  return {
    eligible,
    confidence: signals.confidence,
    reason,
    signals,
    recommendation: eligible
      ? `✅ 适合快速通道 (${signals.whitelistMatch.description}, 信心度 ${(signals.confidence * 100).toFixed(0)}%)`
      : `❌ 不适合快速通道 (${reason})`
  }
}

/**
 * 估算文件数量
 * @param {string} text - 文本内容
 * @returns {number} 估算的文件数量
 */
function estimateFileCount(text) {
  const explicitFiles = text.match(/\b[a-zA-Z0-9_.\-/]+\.(?:tsx?|jsx?|css|scss)\b/g) || []
  if (explicitFiles.length > 0) return new Set(explicitFiles).size

  // 需要探索/查找的信号（通常意味着多文件）
  const explorationSignals = [
    /查找.*组件|搜索.*组件|找到.*组件/i,
    /查找.*文件|搜索.*文件|找到.*文件/i,
    /相关的.*页面|相关的.*组件/i,
    /活动.*规则|福利.*规则/i, // PR-02440 的案例
    /同步.*修改|一起.*修改/i,
  ]

  for (const pattern of explorationSignals) {
    if (pattern.test(text)) return 5 // 需要探索通常涉及多文件
  }

  // 多文件信号
  const multiFileSignals = [
    { pattern: /多个.*文件|多个.*页面|多个.*组件/i, count: 5 },
    { pattern: /所有.*文件|所有.*页面|所有.*组件/i, count: 10 },
    { pattern: /批量|全部|每个/i, count: 10 },
  ]

  for (const { pattern, count } of multiFileSignals) {
    if (pattern.test(text)) return count
  }

  // 单文件信号
  const singleFileSignals = [
    /单个文件|一个文件|这个文件/i,
    /单个页面|一个页面|这个页面/i,
    /单个组件|一个组件|这个组件/i,
  ]

  for (const pattern of singleFileSignals) {
    if (pattern.test(text)) return 1
  }

  // 未给出明确影响范围时拒绝候选，不能把未知范围当成单文件。
  return 0
}

/**
 * 生成快速通道摘要（给用户确认）
 * @param {Object} evaluation - evaluateLitePath 的返回值
 * @param {string} prdSummary - PRD 摘要
 * @returns {string} 格式化的摘要
 */
export function generateLitePathSummary(evaluation, prdSummary) {
  if (!evaluation.eligible) {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 不适合快速通道
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

原因: ${evaluation.reason}

将使用标准流程（三阶段抽取 + 独立审查）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
  }

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 检测到低风险需求，建议使用快速通道 (V0-lite)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【需求摘要】
${prdSummary}

【快速通道评估】
✓ 场景类型: ${evaluation.signals.whitelistMatch.description}
✓ 信心度: ${(evaluation.confidence * 100).toFixed(0)}%
✓ 预估文件数: ${evaluation.signals.estimatedFileCount}

【实验边界】
- 仅作为只读候选评估
- 不跳过 extraction、review、scope approval 或 verify
- 不修改文件、不运行验证、不暂存、不提交

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}

/**
 * 单元测试
 */
export function selfTest() {
  const testCases = [
    {
      name: '纯文案修改（应该通过）',
      prd: '把 Home.tsx 首页按钮文案从"开始"改成"立即开始"',
      intent: '改文案',
      expectedEligible: true,
      expectedConfidence: 0.95,
    },
    {
      name: '样式调整（应该通过）',
      prd: '调整 Home.tsx 按钮颜色为蓝色',
      intent: '样式调整',
      expectedEligible: true,
      expectedConfidence: 0.95,
    },
    {
      name: '修复拼写错误（应该通过）',
      prd: '修复 Home.tsx 首页的拼写错误：welcom → welcome',
      intent: '修复typo',
      expectedEligible: true,
      expectedConfidence: 0.95,
    },
    {
      name: '登录逻辑修改（应该拒绝：黑名单）',
      prd: '修改登录逻辑，增加验证码校验',
      intent: '改登录',
      expectedEligible: false,
    },
    {
      name: '充值功能（应该拒绝：资金）',
      prd: '实现充值功能',
      intent: '新功能',
      expectedEligible: false,
    },
    {
      name: '批量删除（应该拒绝：不可逆+集合）',
      prd: '批量删除所有测试数据',
      intent: '删除数据',
      expectedEligible: false,
    },
    {
      name: '多文件修改（应该拒绝：文件数）',
      prd: '修改所有页面的标题样式',
      intent: '样式调整',
      expectedEligible: false,
    },
    {
      name: '单文件文案（明确单文件）',
      prd: '在登录页（Login.tsx）把"登录"改成"立即登录"',
      intent: '改文案',
      expectedEligible: false,
    },
    {
      name: '前端支付失败提示（高风险一票否决）',
      prd: '前端文案修改支付失败提示',
      intent: '只改提示文案',
      expectedEligible: false,
    },
    {
      name: '前端权限提示（高风险一票否决）',
      prd: '前端文案修改权限不足提示',
      intent: '只改提示文案',
      expectedEligible: false,
    },
    {
      name: '没有影响文件范围（必须拒绝）',
      prd: '修改首页显示文案',
      intent: '文案调整',
      expectedEligible: false,
    },
    {
      name: '明确单文件低风险文案',
      prd: '修改 Home.tsx 的页面文案',
      intent: '只改文案',
      expectedEligible: true,
    },
  ]

  let passed = 0
  let failed = 0

  for (const tc of testCases) {
    const result = evaluateLitePath(tc.prd, tc.intent)

    if (result.eligible !== tc.expectedEligible) {
      console.error(`❌ Test failed: ${tc.name}`)
      console.error(`   Expected eligible: ${tc.expectedEligible}, got: ${result.eligible}`)
      console.error(`   Reason: ${result.reason}`)
      console.error(`   Signals:`, result.signals)
      failed++
    } else if (tc.expectedConfidence && Math.abs(result.confidence - tc.expectedConfidence) > 0.1) {
      console.error(`❌ Test failed: ${tc.name}`)
      console.error(`   Expected confidence: ${tc.expectedConfidence}, got: ${result.confidence}`)
      failed++
    } else {
      console.log(`✓ Test passed: ${tc.name}`)
      passed++
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`lite-path-router self-test: ${passed} passed, ${failed} failed`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed`)
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest()
  } else if (process.argv.includes('--eval')) {
    const prd = process.argv[process.argv.indexOf('--eval') + 1] || ''
    const intent = process.argv[process.argv.indexOf('--eval') + 2] || ''
    const result = evaluateLitePath(prd, intent)
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`
Usage:
  node lite-path-router.mjs --self-test
  node lite-path-router.mjs --eval "PRD text" "user intent"
`)
  }
}
