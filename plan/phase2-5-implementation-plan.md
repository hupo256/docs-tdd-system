# Phase 2-5 实施计划

**创建时间**: 2026-09-21
**前提条件**: Phase 1 已完成（extraction-guidance v2.0 已上线）

---

## 执行摘要

**目标**: 在 Phase 1（第一次理解准确）的基础上，通过流程简化和智能决策，进一步提升效率

**核心策略**:
- Phase 2: 快速通道（低风险需求 2-5 分钟完成）
- Phase 3: 智能提问（减少不必要的人工介入）
- Phase 4: 渐进式验证（加快反馈循环）
- Phase 5: 规则系统简化（降低心智负担）

**预期效果**:
- 小需求耗时: 30 分钟 → **2-5 分钟** (-85%)
- 人工介入: 2-3 次 → **0-1 次** (-70%)
- Token 消耗: 50K-100K → **10K-20K** (-80%)

---

## Phase 2: 快速通道（Lite Path）

### 目标

**单文件、低风险改动在 2-5 分钟内完成**

### 适用场景

#### 明确的低风险场景（白名单）

| 场景 | 示例 | 风险等级 |
|------|------|---------|
| **纯文案修改** | i18n key 不变，只改翻译文本 | V0-lite |
| **单一样式调整** | 改颜色、间距、字号，无行为变化 | V0-lite |
| **简单 bug 修复** | 单函数，无依赖变化，明确根因 | V0-lite |
| **明确的小增强** | 加一个字段展示，单一落点 | V0-lite |

#### 判定标准

**必须同时满足**:
1. ✅ 单文件修改（或少于3个相关文件）
2. ✅ 无行为变化（或行为变化非常明确）
3. ✅ 无资金/权限/不可逆操作
4. ✅ 无后端 API 变更
5. ✅ 用户明确描述了改动点

**任一不满足 → 转标准流程**

### 流程设计

```
┌─────────────┐
│  用户 PRD   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ AI 快速理解 + 自评风险      │
│ - 改什么？                  │
│ - 影响范围？                │
│ - 是否符合白名单？          │
└──────┬──────────────────────┘
       │
       ├─ 低风险？
       │  YES ↓
       │  ┌─────────────────────┐
       │  │ 快速通道 (V0-lite)  │
       │  │ - 直接改文件        │
       │  │ - 定向验证          │
       │  │ - commit            │
       │  └──────┬──────────────┘
       │         │
       │         ▼
       │  ✅ 完成 (2-5 分钟)
       │
       └─ NO ↓
          ┌─────────────────────┐
          │ 标准流程            │
          │ - 三阶段抽取        │
          │ - 独立审查          │
          │ - 完整验证          │
          └──────┬──────────────┘
                 │
                 ▼
          ✅ 完成 (15-30 分钟)
```

### 技术实现

#### Step 2.1: 创建快速通道路由器

**新增文件**: `common/engine/agent-scripts/lib/lite-path-router.mjs`

```javascript
/**
 * 快速通道路由器
 * 判断需求是否适合快速通道
 */

export const LITE_PATH_CRITERIA = {
  // 白名单场景
  whitelistPatterns: [
    { pattern: /纯文案修改|只改文案|文字修改/, risk: 'very-low' },
    { pattern: /样式调整|改颜色|改间距|改字号/, risk: 'very-low' },
    { pattern: /简单bug修复|修复typo|修复拼写/, risk: 'low' },
  ],
  
  // 黑名单信号（任一匹配 → 禁止快速通道）
  blacklistSignals: [
    '资金', '金额', '费用', '充值', '提现', '支付',
    '权限', '登录', '注册', '删除', '禁用',
    'API', '接口', '后端', '数据库',
    '不可逆', '批量', '所有', '全部',
  ],
  
  // 文件数量限制
  maxFiles: 3,
}

export function evaluateLitePath(prdText, userIntent) {
  const signals = {
    whitelistMatch: false,
    blacklistMatch: false,
    fileCount: estimateFileCount(userIntent),
    confidence: 0,
  }
  
  // 检查白名单
  for (const { pattern, risk } of LITE_PATH_CRITERIA.whitelistPatterns) {
    if (pattern.test(prdText) || pattern.test(userIntent)) {
      signals.whitelistMatch = true
      signals.confidence = risk === 'very-low' ? 0.9 : 0.7
      break
    }
  }
  
  // 检查黑名单（一票否决）
  for (const signal of LITE_PATH_CRITERIA.blacklistSignals) {
    if (prdText.includes(signal)) {
      signals.blacklistMatch = true
      signals.confidence = 0
      break
    }
  }
  
  // 文件数量检查
  if (signals.fileCount > LITE_PATH_CRITERIA.maxFiles) {
    signals.confidence = 0
  }
  
  return {
    eligible: signals.whitelistMatch && !signals.blacklistMatch && signals.fileCount <= LITE_PATH_CRITERIA.maxFiles,
    confidence: signals.confidence,
    reason: signals.blacklistMatch ? 'blacklist-signal-detected' : 
            signals.fileCount > LITE_PATH_CRITERIA.maxFiles ? 'too-many-files' :
            !signals.whitelistMatch ? 'no-whitelist-match' : 'eligible',
    signals,
  }
}

function estimateFileCount(userIntent) {
  // 简单启发式估算
  const multiFileSignals = ['多个', '所有', '各个', '每个', '批量']
  for (const signal of multiFileSignals) {
    if (userIntent.includes(signal)) return 10
  }
  return 1
}

export function selfTest() {
  // 测试用例
  const testCases = [
    {
      prd: '把登录按钮文案从"登录"改成"立即登录"',
      intent: '改文案',
      expected: true,
    },
    {
      prd: '修改所有页面的登录逻辑',
      intent: '改登录',
      expected: false, // 黑名单：登录 + 所有
    },
    {
      prd: '调整按钮颜色为蓝色',
      intent: '样式调整',
      expected: true,
    },
    {
      prd: '实现充值功能',
      intent: '新功能',
      expected: false, // 黑名单：充值
    },
  ]
  
  for (const { prd, intent, expected } of testCases) {
    const result = evaluateLitePath(prd, intent)
    if (result.eligible !== expected) {
      throw new Error(`Test failed: "${prd}" expected ${expected}, got ${result.eligible}`)
    }
  }
  
  console.log('lite-path-router self-test passed')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) selfTest()
}
```

#### Step 2.2: 修改 docs-tdd CLI 入口

**修改文件**: `common/engine/cli.mjs`（或对应的 CLI 入口）

```javascript
// 在 PRD 输入后，先评估是否走快速通道

import { evaluateLitePath } from './agent-scripts/lib/lite-path-router.mjs'

async function processPRD(projectId, prdInput) {
  // 读取 PRD
  const prdText = readPRD(prdInput)
  const userIntent = extractUserIntent(prdText)
  
  // 评估快速通道
  const litePathEval = evaluateLitePath(prdText, userIntent)
  
  if (litePathEval.eligible && litePathEval.confidence > 0.8) {
    console.log(`🚀 检测到低风险需求，使用快速通道（V0-lite）`)
    console.log(`   信心度: ${(litePathEval.confidence * 100).toFixed(0)}%`)
    console.log(`   原因: ${litePathEval.reason}`)
    
    // 询问用户确认
    const confirm = await askUser('是否使用快速通道？(Y/n)', { default: 'Y' })
    if (confirm.toLowerCase() === 'y' || confirm === '') {
      return await runLitePath(projectId, prdText)
    }
  }
  
  // 标准流程
  console.log(`📋 使用标准流程`)
  return await runStandardPath(projectId, prdText)
}
```

#### Step 2.3: 实现快速通道执行器

**新增文件**: `common/engine/agent-scripts/lite-path-executor.mjs`

```javascript
/**
 * 快速通道执行器
 * 跳过三阶段抽取，直接理解 + 实现 + 验证
 */

export async function executeLitePath(projectId, prdText) {
  console.log(`\n━━━ 快速通道执行 ━━━\n`)
  
  // Step 1: 快速理解（不走三阶段抽取）
  console.log(`1️⃣  快速理解需求...`)
  const understanding = await quickUnderstand(prdText)
  console.log(`   ✓ ${understanding.summary}`)
  console.log(`   ✓ 影响文件: ${understanding.files.join(', ')}`)
  
  // Step 2: 直接实现
  console.log(`\n2️⃣  实现改动...`)
  const changes = await implement(understanding)
  console.log(`   ✓ 修改了 ${changes.length} 个文件`)
  
  // Step 3: 定向验证（只跑相关文件的 lint + 类型检查）
  console.log(`\n3️⃣  定向验证...`)
  const verification = await quickVerify(changes)
  if (!verification.passed) {
    console.log(`   ✗ 验证失败，转标准流程`)
    return { success: false, fallbackToStandard: true }
  }
  console.log(`   ✓ 验证通过`)
  
  // Step 4: Commit
  console.log(`\n4️⃣  提交改动...`)
  await commit(projectId, understanding.summary, changes)
  console.log(`   ✓ 已提交`)
  
  console.log(`\n✅ 快速通道完成！`)
  return { success: true, timeSpent: '2-5 分钟' }
}

async function quickUnderstand(prdText) {
  // 调用 AI，但不走三阶段抽取
  // Prompt: "这是一个低风险需求，请快速理解要改什么、影响哪些文件"
  return {
    summary: '修改登录按钮文案',
    files: ['apps/web/src/components/Login.tsx'],
    changes: '把"登录"改成"立即登录"',
  }
}

async function implement(understanding) {
  // 调用 AI 直接改文件
  return [
    { file: 'apps/web/src/components/Login.tsx', status: 'modified' }
  ]
}

async function quickVerify(changes) {
  // 只跑受影响文件的 lint + 类型检查
  const files = changes.map(c => c.file)
  const lintResult = await runLint(files)
  const tscResult = await runTypeCheck(files)
  
  return {
    passed: lintResult.passed && tscResult.passed,
    lint: lintResult,
    tsc: tscResult,
  }
}
```

### 安全措施

1. **显式声明**: AI 必须输出 "使用快速通道 (V0-lite)"
2. **信心度阈值**: confidence > 0.8 才触发
3. **用户确认**: 默认询问用户是否使用快速通道
4. **失败降级**: 验证失败自动转标准流程
5. **审计日志**: 记录所有快速通道的使用和结果

### 成功标准

- [ ] lite-path-router 单元测试通过
- [ ] 10个低风险需求测试，准确率 > 90%
- [ ] 误判率 < 5%（不该走快速通道却走了）
- [ ] 平均耗时 < 5 分钟
- [ ] 用户满意度 > 8/10

---

## Phase 3: 智能提问策略

### 目标

**减少不必要的人工介入，从 2-3 次降至 0-1 次**

### 当前问题

1. **V2 强制人工 scope approval**: 即使范围很明确，也要等人工确认
2. **审查失败 escalate**: 第1次失败就问人，AI 没有自我修正机会
3. **过度依赖人工**: 很多决策 AI 可以自己做

### 优化策略

#### 3.1 智能 V2 Scope Approval

**当前逻辑**:
```
V2 需求 → 强制人工确认 scope → 继续
```

**优化逻辑**:
```
V2 需求 → 系统自评风险明确度
  ├─ 明确（funds/permission/irreversible + 范围清晰）
  │  → 必须人工确认
  │
  └─ 不明确（只是 multi-surface，无明显高风险信号）
     → 提供摘要，允许 AI 继续
     → 标记"需事后复核"
     → 交付时提醒用户检查
```

**实现**:

```javascript
// common/engine/agent-scripts/lib/smart-approval.mjs

export function evaluateScopeApprovalNeed(workItem) {
  const { routing, requirements } = workItem
  
  // 检测明确的高风险信号
  const highRiskSignals = {
    funds: ['金额', '费用', '充值', '提现', '支付', '扣款'],
    permission: ['权限', '登录', '注册', '删除', '禁用'],
    irreversible: ['不可逆', '永久', '删除', '禁用', '注销'],
  }
  
  let explicitRiskFound = false
  let riskType = null
  
  for (const [type, keywords] of Object.entries(highRiskSignals)) {
    for (const req of requirements) {
      if (keywords.some(kw => req.statement.includes(kw))) {
        explicitRiskFound = true
        riskType = type
        break
      }
    }
    if (explicitRiskFound) break
  }
  
  if (explicitRiskFound) {
    return {
      needsApproval: true,
      reason: `explicit-${riskType}-risk`,
      message: `检测到${riskType}相关操作，需要人工确认范围`,
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
  
  return { needsApproval: false, reason: 'low-risk' }
}
```

#### 3.2 智能审查修正

**当前逻辑**:
```
审查失败 → 立即 escalate 人工
```

**优化逻辑**:
```
审查失败
  ├─ 第1次 changes-required
  │  → AI 自动修正，不问人
  │  → 重新提交审查
  │
  └─ 第2次相同 finding
     → escalate 人工
     → 同时提供 "AI 建议方案"
     → 人只需选择：
        - 接受 AI 方案
        - 提供新方向
        - 延期
```

**实现**:

```javascript
// common/engine/agent-scripts/lib/smart-review.mjs

export async function handleReviewFinding(finding, attempt) {
  if (attempt === 1) {
    console.log(`📝 审查发现问题，AI 自动修正（第${attempt}次）...`)
    
    // AI 自动修正
    const fix = await autoFix(finding)
    
    if (fix.success) {
      console.log(`   ✓ 已自动修正`)
      return { action: 'retry', fix }
    } else {
      console.log(`   ✗ 自动修正失败，转人工`)
      return { action: 'escalate', reason: 'auto-fix-failed' }
    }
  }
  
  if (attempt === 2) {
    console.log(`⚠️  第2次相同问题，需要人工介入`)
    
    // 生成 AI 建议方案
    const aiSuggestion = await generateSuggestion(finding)
    
    console.log(`\nAI 建议方案：`)
    console.log(aiSuggestion.description)
    console.log(`\n请选择：`)
    console.log(`  1. 接受 AI 方案`)
    console.log(`  2. 提供新方向`)
    console.log(`  3. 延期处理`)
    
    const choice = await askUser('选择 (1/2/3):')
    
    if (choice === '1') {
      return { action: 'accept-ai-suggestion', suggestion: aiSuggestion }
    } else if (choice === '2') {
      const newDirection = await askUser('请描述新方向:')
      return { action: 'user-direction', direction: newDirection }
    } else {
      return { action: 'postpone' }
    }
  }
  
  // 超过2次，强制人工
  return { action: 'escalate', reason: 'max-attempts-exceeded' }
}
```

### 成功标准

- [ ] V2 人工介入次数减少 50%+
- [ ] 审查修正成功率 > 70%（第1次自动修正）
- [ ] 用户对 AI 建议方案满意度 > 7/10
- [ ] 无误判导致的高风险遗漏

---

## Phase 4: 渐进式验证

### 目标

**加快反馈循环，从"一批稳定后验证"改为"编辑后即时验证"**

### 当前问题

- dev-check 要等"一批相关改动稳定后"才运行
- 小步迭代时缺乏即时反馈
- 失败后才知道方向错了，已浪费 token

### 优化策略

#### 三级验证体系

```
┌──────────────────────────────────────┐
│ Level 1: 编辑后即时检查（轻量）      │
│ - Lint 受影响文件                    │
│ - 类型检查受影响文件                 │
│ - 不跑测试，不写状态文件             │
│ - 触发时机：每次文件编辑后           │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ Level 2: Checkpoint 检查（中等）     │
│ - Lint + 类型检查                    │
│ - 相关单测                           │
│ - 写 checkpoint，标记 "partial"      │
│ - 触发时机：逻辑单元完成后           │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ Level 3: Verify 检查（完整）         │
│ - 全部证据命令                       │
│ - 写正式 result                      │
│ - 触发时机：所有改动完成后           │
└──────────────────────────────────────┘
```

#### 实现

**新增文件**: `common/engine/agent-scripts/lib/progressive-verify.mjs`

```javascript
/**
 * 渐进式验证
 * 三级验证体系
 */

export async function level1Check(files) {
  console.log(`🔍 Level 1: 即时检查 (${files.length} 个文件)...`)
  
  const results = {
    lint: await runLint(files, { fast: true }),
    tsc: await runTypeCheck(files, { fast: true }),
  }
  
  if (!results.lint.passed || !results.tsc.passed) {
    console.log(`   ✗ 发现问题，立即反馈`)
    return { passed: false, results }
  }
  
  console.log(`   ✓ 通过`)
  return { passed: true, results }
}

export async function level2Check(files, relatedTests) {
  console.log(`🔍 Level 2: Checkpoint 检查...`)
  
  const results = {
    lint: await runLint(files),
    tsc: await runTypeCheck(files),
    tests: await runTests(relatedTests),
  }
  
  // 写 checkpoint，标记 partial
  await writeCheckpoint({
    status: 'partial',
    files,
    results,
    timestamp: new Date().toISOString(),
  })
  
  if (!results.tests.passed) {
    console.log(`   ✗ 测试失败`)
    return { passed: false, results }
  }
  
  console.log(`   ✓ 通过`)
  return { passed: true, results }
}

export async function level3Check(workItem) {
  console.log(`🔍 Level 3: 完整验证...`)
  
  // 运行所有证据命令
  const results = await runAllEvidence(workItem)
  
  // 写正式 result
  await writeVerifyResult({
    status: results.passed ? 'pass' : 'fail',
    workItem,
    results,
    timestamp: new Date().toISOString(),
  })
  
  if (!results.passed) {
    console.log(`   ✗ 验证失败`)
    return { passed: false, results }
  }
  
  console.log(`   ✓ 验证通过`)
  return { passed: true, results }
}
```

### 成功标准

- [ ] Level 1 反馈时间 < 10 秒
- [ ] Level 2 反馈时间 < 1 分钟
- [ ] 提早发现问题率 > 60%（在 Level 1/2 发现，不等到 Level 3）
- [ ] 无性能退化（总验证时间不增加）

---

## Phase 5: 规则系统简化

### 目标

**降低 AI 心智负担，规则注入智能化**

### 当前问题

- L1/L2/L3 三层规则对 AI 来说太复杂
- 每次都注入全部规则，即使只需要一小部分
- AI 需要理解规则体系本身就是负担

### 优化策略（长期）

#### 智能规则注入

**当前**:
```
每次都注入：
- L1 (~7K 字符)
- L2 (可变)
- L3 (4K-24K 字符)
```

**优化**:
```
根据需求类型智能注入：
- V0-lite: 只注入核心规则 (~2K 字符)
- V0: 精简规则 (~5K 字符)
- V1: 标准规则 (~10K 字符)
- V2: 完整规则 (~20K 字符)
```

#### 实现（概念设计）

```javascript
// common/engine/agent-scripts/lib/smart-rules.mjs

export function selectRules(verificationLevel, signals) {
  const baseRules = loadBaseRules() // 核心规则，必须
  
  switch (verificationLevel) {
    case 'V0-lite':
      return {
        size: '~2K',
        rules: [baseRules.core],
      }
    
    case 'V0':
      return {
        size: '~5K',
        rules: [baseRules.core, baseRules.qualityBasics],
      }
    
    case 'V1':
      return {
        size: '~10K',
        rules: [
          baseRules.core,
          baseRules.qualityBasics,
          loadDomainRules(signals), // 根据领域信号动态加载
        ],
      }
    
    case 'V2':
      return {
        size: '~20K',
        rules: [
          baseRules.core,
          baseRules.qualityBasics,
          baseRules.v2HighRisk,
          loadDomainRules(signals),
        ],
      }
  }
}
```

### 成功标准（长期）

- [ ] 规则注入大小减少 50%+（针对 V0/V1）
- [ ] AI 响应速度提升 10%+
- [ ] 规则遵循度不下降

---

## 实施时间表

| Phase | 任务 | 工作量 | 依赖 | 开始时间 | 完成时间 |
|-------|------|--------|------|---------|---------|
| **Phase 2** | 快速通道 | 2-3 天 | Phase 1 完成 | Week 1 | Week 1 |
| **Phase 3** | 智能提问 | 3-5 天 | Phase 1 完成 | Week 1 | Week 2 |
| **Phase 4** | 渐进式验证 | 3-5 天 | Phase 1 完成 | Week 2 | Week 3 |
| **Phase 5** | 规则简化 | 1-2 周 | Phase 2-4 完成 | Week 4 | Week 6 |

**总计**: 约 4-6 周

---

## 风险与缓解

### 风险矩阵

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| **快速通道误判** | 高 | 中 | 保守判断 + 用户确认 + 失败降级 |
| **智能提问遗漏高风险** | 高 | 低 | 明确高风险信号白名单 + 事后审计 |
| **渐进式验证性能问题** | 中 | 中 | 轻量检查 + 增量运行 |
| **系统复杂度增加** | 中 | 高 | 清晰分层 + 完整测试 |

---

## 成功标准总览

### 量化指标

| 指标 | 当前 | 目标 | 改进 |
|------|------|------|------|
| **小需求耗时** | 30 分钟 | **2-5 分钟** | **-85%** |
| **人工介入次数** | 2-3 次 | **0-1 次** | **-70%** |
| **Token 消耗** | 50K-100K | **10K-20K** | **-80%** |
| **快速通道准确率** | N/A | **> 90%** | N/A |
| **V2 人工介入减少** | 100% | **50%** | **-50%** |
| **提早发现问题率** | 0% | **> 60%** | N/A |

### 用户体验指标

- [ ] 小需求用户满意度 > 8/10
- [ ] 快速通道用户满意度 > 8/10
- [ ] AI 建议方案满意度 > 7/10
- [ ] 总体系统满意度 > 8/10

---

## 下一步行动

### 立即可做（本周）

1. **Phase 2: 快速通道**
   - [ ] 创建 lite-path-router.mjs（1天）
   - [ ] 修改 CLI 入口（0.5天）
   - [ ] 创建 lite-path-executor.mjs（1天）
   - [ ] 单元测试 + 10个案例测试（0.5天）

2. **Phase 3: 智能提问**
   - [ ] 创建 smart-approval.mjs（1天）
   - [ ] 创建 smart-review.mjs（1天）
   - [ ] 集成到现有流程（1天）

### 后续（2-4周）

3. **Phase 4: 渐进式验证**
   - [ ] 创建 progressive-verify.mjs
   - [ ] 修改 dev-check 逻辑
   - [ ] 性能测试

4. **Phase 5: 规则简化**
   - [ ] 设计智能规则选择器
   - [ ] 按 V0/V1/V2 拆分规则
   - [ ] A/B 测试效果

---

**计划创建时间**: 2026-09-21
**作者**: Kiro (Claude Opus 4.8)
**状态**: 待实施
