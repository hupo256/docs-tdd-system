#!/usr/bin/env node
// v3.5 extraction guidance: detailed instructions for accurate first-pass requirement understanding.
// This module provides multi-pass reading methodology, mandatory enumeration protocols, deep image
// understanding, and domain-specific checklists to minimize omissions in the extraction phase.

export const EXTRACTION_GUIDANCE_V2 = `
# 需求抽取指南 v2.0（精读版）

你的任务是精确、完整地理解需求。**关键原则：第一次就理解准确，不依赖后续审查补救**。

多轮审查很费时且效率低，即使审查多次仍可能遗漏。审查只是补救，不能本末倒置。

## 四遍精读法（强制遵循，不要跳过）

### 第 1 遍：全局扫描（5 分钟）
快速阅读全文，建立整体认知：
- 需求类型？（新功能/修改/bug修复）
- 涉及模块？（前端/后端/数据）
- 风险等级？（资金/权限/不可逆 → V2；多影响面 → V1；局部微改 → V0）
- 富媒体数量？（图片、表格、流程图）
- 主要用户流程？

生成需求概要（100-200 字），记在心里，不输出到 JSON。

### 第 2 遍：分主题深入理解（按优先级）

**优先级 1：高风险要素（如果有）**
关键词触发：金额、费用、充值、提现、支付、余额、权限、登录、注册、删除、禁用、不可逆
→ 每个都要明确：范围、边界条件、异常处理、审计日志

**优先级 2：PRD 明确标注（最强排除信号）**

当 PRD 明确写以下标注时，直接采信为"无需改动"，无需进一步判定：
- "无需专项开发"、"无需改动"、"不需要前端改动"
- "自动展示"、"会自动包含"、"系统自动生成"、"自动记录"
- "沿用现有逻辑"、"继续使用现有 XX"、"保持现状"

这些是产品经理的明确排除性陈述，在抽取结果中应明确标记为"现有 Surface（无需改动）"。

**优先级 3：完整性关键词（强制枚举）**
遇到以下词必须完整列举，不能遗漏：
- "所有"、"全部"、"每个"、"各"
- "相关"、"涉及"（范围模糊，需要明确）
- "等"、"..."（列举不完整）

**强制枚举协议**：
1. 识别枚举目标（例："所有登录入口"）
2. 完整列举（从 PRD、业务常识推断）
3. 在 collectionSemantics 中标记 expectedCount
4. 在 affectedSurfaces 中逐个列出所有成员

示例（错误）：
  PRD："修改所有登录入口"
  AI 抽取：找到 2 个入口 → ❌ 可能遗漏第 3 个

示例（正确）：
  PRD："修改所有登录入口"
  AI 思考：有哪些登录入口？
    - 账号密码登录、手机号登录、第三方登录、忘记密码、注册
  AI 抽取：
    collectionSemantics: { kind: 'all-members', expectedCount: 5 }
    affectedSurfaces: [ S-001...S-005 ]（5 个，明确列出）
  → ✅ 完整枚举

**集合语义判定专项：区分"操作入口"与"查询入口"**

当 PRD 列举多个页面/路径/入口时，必须判断哪些需要实现，哪些是数据自然流转。

**三步检查清单**：

1. **量词检查**：是否有明确的集合量词？
   - 有"所有"、"全部"、"每个"等 → 可能是集合枚举
   - 只是列举多个位置，无集合量词 → 需进一步判断

2. **描述强度识别**：PRD 对每个位置的描述深度如何？
   - **操作入口**（需实现）：有完整的 UI 描述、表单字段、交互逻辑、校验规则
   - **查询入口**（数据自然流转）：只提到"展示"、"可见"，无 UI 变更描述
   - 对比示例：
     - "新增体验金手动失效管理页面，包含筛选区、操作按钮、列表字段..." → 操作入口，需实现
     - "卡券列表展示「已失效」状态标签" → 查询入口，数据变化后自然显示

3. **遗漏测试**（数据流转检查）：
   - 问：如果不改这个页面的代码，数据能自然显示吗？
   - **能** → 无需改动（后端写入数据库后，前端查询接口自动展示）
   - **否** → 需要专项开发（要改 UI、加字段、改交互）
   - 示例：
     - "资金流水页展示失效记录" → 后端自动生成流水，前端查询自动显示 → 能，无需改动
     - "添加失效任务弹窗" → 全新弹窗，需实现表单和校验逻辑 → 否，需要开发

**常见误判场景：数据展示 ≠ 功能开发**

典型特征：
- PRD 列举了 N 个页面/路径（N > 3）
- 这些位置会"展示"新数据或新状态
- 容易误判为"所有这些页面都要改"

判定方法：
- 区分**操作入口**（需实现）与**查询入口**（数据自然流转）
- 后端自动生成的数据（流水、状态变更）→ 前端查询接口自动展示 → 无需专项开发
- PRD 只说"展示"/"可见"，无 UI/交互描述 → 数据自然流转 → 无需改动

案例：PR-01930 体验金手动失效管理
- PRD 提到 8 个路径：
  - 1 个操作入口：体验金手动失效管理页面（有完整功能描述，需实现）
  - 7 个查询入口：体验金明细、资金流水、合约账户等（只说"展示失效数据"，无需改动）
- 正确判定：只需实现 1 个操作入口的 4 个 Surface，7 个查询页面数据自然流转
- 错误判定：会多创建 7 个冗余 R 项，虚高工作量评估 175%

**抽取输出要求**：
- 在 Surface Coverage Analysis 中明确区分：

  新增 Surface（需实现）
    - [列出所有需要开发的 Surface]

  现有 Surface（被动展示，无需改动）
    - [列出所有数据自然流转的查询页面]

  集合语义判定
    - 不是集合枚举场景：PRD 没有"所有 XX 页面都要改"的语义
    - 现有页面影响：纯数据变化后的自然展示
    - 开发范围：仅需实现上述 N 个新增 Surface

**优先级 4：常规功能和细节**
- 页面/组件完整元素
- 接口/字段列表
- 状态流转路径

### 第 3 遍：富媒体深度解读（每个都要）

**图片（每张必须深度解读）**

不合格示例：
  "这是登录页截图，包含用户名输入框、密码输入框、登录按钮。"
  → ❌ 只描述了元素，没有提取需求

合格示例：
  "图片传达以下需求：

  R-IMG-001（图片文字）：
    密码输入框下方提示："8-20位，必须包含字母和数字"
    → 需求：密码长度 8-20，必须字母+数字组合
    → PRD 文字中未提及此规则 ⚠️
    → 标记为【图片独有需求】

  R-IMG-002（图片交互）：
    密码输入框右侧有"眼睛图标"
    → 需求：密码可见/隐藏切换功能"
  → ✅ 提取了需求，不只是描述

**对每张图片问 5 个问题**：
1. 图片类型？（界面/流程/示意图）
2. 传达什么需求？（不是"有什么"，是"要做什么"）
3. 哪些信息是文字中没有的？（图片独有 → 高优先级）
4. 哪些细节容易被忽略？（小字、边角、状态）
5. 如果我不看这张图，会漏掉什么？

**表格（每行都要处理）**
- 确认表格类型（字段列表/状态流转/权限矩阵）
- 逐行理解语义（系统已自动生成 tableRole=row 的 source units）
- 每一行必须在 requirements 中有对应或在 sourceUnitDispositions 中标记 not-a-requirement
- 注意隐含规则（必填/可选、依赖关系）

### 第 4 遍：自我完整性检查（强制，不要跳过）

**反向检查（从 PRD 到抽取）**：
□ PRD 每个关键词是否都处理了？
□ 每张图片是否都深度解读了？
□ 每个表格的每一行是否都映射了？
□ 所有 semantic source units 是否都有对应的 fact 或 explicit exclusion？

**正向检查（从抽取到 PRD）**：
□ 每条 requirement 能否在 PRD 中找到依据（sourceAnchors）？
□ 每个 surface 能否对应到具体落点？

**边界检查（针对集合语义）**：
□ "所有 X"：X 有哪些？是否完整枚举？expectedCount 是否匹配？
□ "每个 Y"：Y 有哪些？是否遗漏？
□ "相关 Z"：相关的范围是什么？是否明确？

**高风险检查（如果涉及）**：
□ 资金：金额计算、余额检查、二次确认、审计日志
□ 权限：访问控制、敏感操作、审计
□ 数据修改：修改范围、影响面、回滚

## 输出质量自评

完成抽取后，给自己打分：
- 完整性：__/10（是否有遗漏？集合是否完整枚举？）
- 准确性：__/10（理解是否正确？）
- 深度：__/10（图片/表格是否深入解读？）

如果任一项 < 8，重新精读相关部分。

## 历史遗漏教训（必读，避免重蹈覆辙）

**案例 1：PR-02306 密码规则遗漏**
  问题：图片中的密码规则（8-20位、字母+数字）被遗漏
  根因：只看了图片的布局，没有读图片中的文字
  教训：图片中的文字是需求，不是装饰！必须深度解读

**案例 2：PR-01930 集合第三入口遗漏**
  问题："所有入口"只找到 2 个，漏了第 3 个
  根因：看到 2 个就停了，没有完整枚举
  教训：遇到"所有"、"每个"必须完整枚举，不能看到几个就停

**案例 3：PR-02265 金额字段遗漏**
  问题：显式 amount/fee 字段被遗漏
  根因：关键字段被淹没在大量细节中
  教训：资金相关必须高度重视，用检查清单逐项确认
`

export const DOMAIN_CHECKLISTS = {
  funds: {
    keywords: ['金额', '费用', '充值', '提现', '支付', '余额', 'amount', 'fee', 'balance', 'payment', 'withdraw', 'deposit'],
    checklist: [
      '金额字段：类型、单位、精度',
      '余额检查：是否检查余额充足',
      '不可逆确认：是否有二次确认弹窗',
      '异常处理：余额不足、支付失败如何处理',
      '审计日志：是否记录操作人、时间、金额',
      '并发控制：是否有防重复扣款机制',
      '展示规则：金额格式化、货币符号',
    ],
  },
  permission: {
    keywords: ['权限', '登录', '注册', '角色', '访问', '认证', 'permission', 'role', 'auth', 'login', 'register', 'access'],
    checklist: [
      '角色定义：哪些角色可以访问',
      '权限校验：前端+后端双重校验',
      '敏感操作：是否需要二次验证（密码/验证码）',
      '审计日志：记录谁在什么时间访问了什么',
      '越权测试：是否考虑越权访问场景',
      'Token 刷新：长时间操作是否需要刷新登录态',
    ],
  },
  collection: {
    keywords: ['所有', '全部', '每个', '各', 'all', 'every', 'each', '入口', '页面', '路径', 'entry', 'page', 'path'],
    checklist: [
      '完整枚举：列出所有成员',
      '边界明确：范围是什么',
      '计数匹配：expectedCount 与 affectedSurfaces 数量一致',
      '对称检查：是否有成对的入口（登录/注册、创建/编辑/删除）',
      '操作 vs 查询：区分操作入口（需实现）与查询入口（数据自然流转）',
      '数据流转测试：不改这个页面，数据能自然显示吗？',
    ],
  },
  list: {
    keywords: ['列表', '表格', 'list', 'table', 'grid'],
    checklist: [
      '数据来源：接口、字段映射',
      '分页：前端/后端分页、每页条数',
      '排序：默认排序、可排序字段',
      '筛选：筛选条件、多条件组合',
      '搜索：搜索字段、模糊/精确',
      '空状态：无数据时的展示',
      '加载状态：首次加载、翻页加载',
      '错误状态：接口失败时的展示',
      '操作列：编辑/删除/详情等按钮',
      '批量操作：是否支持、如何实现',
    ],
  },
  form: {
    keywords: ['表单', '输入', '提交', 'form', 'input', 'submit'],
    checklist: [
      '字段列表：每个字段的类型、必填/可选、默认值',
      '校验规则：前端校验 + 后端校验',
      '错误提示：每个字段的错误提示文案',
      '联动关系：字段之间的依赖关系',
      '提交逻辑：成功后跳转/提示、失败后如何处理',
      '编辑回填：编辑时如何获取初始值',
      '防重复提交：是否需要',
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
  // Test detectDomainSignals
  const testUnits = [
    { sourceId: 'U-001', content: '用户充值功能，支持支付宝和微信支付' },
    { sourceId: 'U-002', content: '需要登录后才能访问，管理员有删除权限' },
    { sourceId: 'U-003', content: '修改所有登录入口的密码规则' },
  ]

  const signals = detectDomainSignals(testUnits)
  const domainNames = signals.map((s) => s.domain).sort()

  // Should detect: collection, funds, permission
  if (!domainNames.includes('collection')) throw new Error('Failed to detect collection domain')
  if (!domainNames.includes('funds')) throw new Error('Failed to detect funds domain')
  if (!domainNames.includes('permission')) throw new Error('Failed to detect permission domain')

  // Test formatDomainGuidance
  const guidance = formatDomainGuidance(signals)
  if (!guidance.includes('资金类')) throw new Error('Guidance should include funds checklist')
  if (!guidance.includes('权限类')) throw new Error('Guidance should include permission checklist')
  if (!guidance.includes('集合类')) throw new Error('Guidance should include collection checklist')

  console.log('extraction-guidance self-test passed')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest()
}
