#!/usr/bin/env node
// Compact extraction contract. Deterministic validators enforce the output invariants.

export const EXTRACTION_GUIDANCE_V2 = `
# 需求抽取契约

目标：一次建立可对账的来源、原子需求、代码落点和证据，不靠重复阅读堆质量。

1. 逐个处理 semantic source unit。正文、表格数据行、图片文字/交互和嵌入内容都必须真实读取；不可读即阻断。
2. 先写 source-grounded extractionFacts，再拆成可独立验收的 requirements，并让二者引用同一 sourceId。
3. 每个 doing requirement 至少有一个 affectedSurface 和 evidencePlan。出现“所有/每个/各”等集合语义时，明确成员及 expectedCount，不凭业务常识补造成员。
4. 未锚定的 semantic unit 只能使用：
   sourceUnitDispositions: [{
     sourceId,
     disposition: "not-a-requirement",
     reason,
     exclusionEvidence: {
       basis: "explicit-out-of-scope" | "example-only" | "context-only",
       sourceQuote: "该 source unit 中的原文"
     }
   }]
5. “自然展示、自动生成、沿用现有逻辑”只是核查线索，不是排除证据；同一单元出现新增字段、按钮、入口、导出、筛选或其他明确功能时必须抽取为需求。
6. 已有能力使用 Surface 的 already-covered disposition，并提供当前代码定位；不要把“已有实现”和“产品明确不做”混为一类。
7. 每个 implement Surface 都要被 focused evidenceCommand 覆盖。检查只针对 touched files 和直接相关测试，稳定后批量执行。
`

export const DOMAIN_CHECKLISTS = {
  funds: {
    keywords: ['金额', '费用', '充值', '提现', '支付', '余额', 'amount', 'fee', 'balance', 'payment', 'withdraw', 'deposit'],
    checklist: [
      '金额字段：类型、单位、精度',
      '边界与失败：余额、并发、重试、不可逆确认',
      '展示与审计：格式、操作人、时间、金额',
    ],
  },
  permission: {
    keywords: ['权限', '登录', '注册', '角色', '访问', '认证', 'permission', 'role', 'auth', 'login', 'register', 'access'],
    checklist: [
      '角色定义：哪些角色可以访问',
      '权限边界：前后端校验、越权和敏感操作确认',
      '会话与审计：登录态变化及操作记录',
    ],
  },
  collection: {
    keywords: ['所有', '全部', '每个', '各', 'all', 'every', 'each', '入口', '页面', '路径', 'entry', 'page', 'path'],
    checklist: [
      '完整枚举：列出所有成员',
      '计数匹配：expectedCount 与 affectedSurfaces 数量一致',
      '边界与对称项：范围、同类入口和增删改查',
    ],
  },
  list: {
    keywords: ['列表', '表格', 'list', 'table', 'grid'],
    checklist: [
      '数据来源：接口、字段映射',
      '查询行为：分页、排序、筛选和搜索',
      '状态与操作：空/加载/错误、行操作和批量操作',
    ],
  },
  form: {
    keywords: ['表单', '输入', '提交', 'form', 'input', 'submit'],
    checklist: [
      '字段列表：每个字段的类型、必填/可选、默认值',
      '校验与联动：规则、错误文案、字段依赖',
      '提交生命周期：回填、防重复、成功和失败行为',
    ],
  },
}

/**
 * Detect domain signals from source units and return applicable checklists.
 * @param {Array} sourceUnits - Normalized source units from PRD
 * @returns {Array} Array of {domain, checklist} objects
 */
export function detectDomainSignals(sourceUnits) {
  const text = sourceUnits.map((u) => u.content).join(' ').toLowerCase()
  const detected = []
  for (const [domain, config] of Object.entries(DOMAIN_CHECKLISTS)) {
    if (config.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      detected.push({ domain, checklist: config.checklist })
    }
  }
  return detected
}

/**
 * Generate domain-specific guidance based on detected signals.
 * @param {Array} domainSignals - Output from detectDomainSignals()
 * @returns {string} Formatted guidance text
 */
export function formatDomainGuidance(domainSignals) {
  if (domainSignals.length === 0) return ''

  let guidance = '\n\n## 检测到的领域信号\n\n'
  guidance += '根据 PRD 内容，自动激活以下检查清单：\n\n'

  for (const signal of domainSignals) {
    const domainName = {
      funds: '资金类',
      permission: '权限类',
      collection: '集合类',
      list: '列表类',
      form: '表单类',
    }[signal.domain] || signal.domain

    guidance += `**${domainName}** 检查清单：\n`
    guidance += signal.checklist.map((item) => `- □ ${item}`).join('\n')
    guidance += '\n\n'
  }

  guidance += '请在抽取过程中逐项确认以上检查点。\n'

  return guidance
}

export function selfTest() {
  const testUnits = [
    { sourceId: 'U-001', content: '用户充值功能，支持支付宝和微信支付' },
    { sourceId: 'U-002', content: '需要登录后才能访问，管理员有删除权限' },
    { sourceId: 'U-003', content: '修改所有登录入口的密码规则' },
  ]

  const signals = detectDomainSignals(testUnits)
  const domainNames = signals.map((s) => s.domain).sort()

  if (!domainNames.includes('collection')) throw new Error('Failed to detect collection domain')
  if (!domainNames.includes('funds')) throw new Error('Failed to detect funds domain')
  if (!domainNames.includes('permission')) throw new Error('Failed to detect permission domain')

  const guidance = formatDomainGuidance(signals)
  if (!guidance.includes('资金类')) throw new Error('Guidance should include funds checklist')
  if (!guidance.includes('权限类')) throw new Error('Guidance should include permission checklist')
  if (!guidance.includes('集合类')) throw new Error('Guidance should include collection checklist')
  if (!EXTRACTION_GUIDANCE_V2.includes('exclusionEvidence')) throw new Error('Guidance must describe exclusion evidence')
  if (/PR-\d{5}/.test(EXTRACTION_GUIDANCE_V2)) throw new Error('Guidance must not carry historical project IDs')
  if (EXTRACTION_GUIDANCE_V2.length > 2500) throw new Error('Guidance exceeds compact context budget')

  console.log('extraction-guidance self-test passed')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest()
}
