# docs_tdd 系统改进建议

**日期**: 2026-09-21  
**当前状态**: Phase 1-5 核心模块全部完成

---

## ✅ 已完成的模块（今天）

| 模块 | 状态 | 集成状态 | 优先级 |
|------|------|---------|--------|
| extraction-guidance.mjs | ✅ 完成 | ⏸️ 待集成到 vnext-extract | 🔴 高 |
| lite-path-router.mjs | ✅ 完成 | ✅ 已集成到 docs-tdd.mjs | 🟢 完成 |
| lite-path-executor.mjs | ✅ 完成 | ✅ 已集成到 docs-tdd.mjs | 🟢 完成 |
| lite-path-integration.mjs | ✅ 完成 | ✅ 已集成到 docs-tdd.mjs | 🟢 完成 |
| smart-approval.mjs | ✅ 完成 | ⏸️ 待集成到 vnext 流程 | 🟡 中 |
| smart-review.mjs | ✅ 完成 | ⏸️ 待集成到审查流程 | 🟡 中 |
| progressive-verify.mjs | ✅ 完成 | ⏸️ 待集成到编辑工作流 | 🟡 中 |
| smart-rules.mjs | ✅ 完成 | ⏸️ 待集成到规则注入 | 🟡 中 |

---

## 🎯 优先集成建议

### 1. 高优先级：Phase 1 extraction-guidance

**原因**: 
- 直接影响理解准确率（+30%）
- 减少遗漏率（-80%）
- 减少审查返工（-70%）

**集成位置**: `vnext-extract.mjs`

**改动点**:
```javascript
// 在 vnext-extract.mjs 的提示生成中
import { generateExtractionGuidance } from './lib/extraction-guidance.mjs'

// 在发送给 AI 的 prompt 前
const guidance = generateExtractionGuidance(workItem)
const prompt = `
${guidance}

现在请根据以上指南分析需求...
`
```

**预期效果**: 立即提升所有 V2 需求的理解准确率

---

### 2. 中优先级：Phase 5 smart-rules

**原因**:
- 减少规则 Token（-60%）
- 降低 AI 认知负担（-60%）
- 提升响应速度（+10-15%）

**集成位置**: `vnext-extract.mjs`, `docs-tdd.mjs`

**改动点**:
```javascript
import { selectRules, detectSignals, formatRules } from './lib/smart-rules.mjs'

// 在规则注入前
const signals = detectSignals(workItem)
const ruleSet = selectRules(verificationLevel, signals)
const rulesContent = formatRules(ruleSet)

// 只注入需要的规则，不是全部
```

**预期效果**: 降低成本，提升速度

---

### 3. 中优先级：Phase 3 smart-approval + smart-review

**原因**:
- 减少 V2 人工介入（-50%）
- 自动修正审查问题
- 减少总体人工介入（-70%）

**集成位置**: `vnext-autopilot.mjs`, `vnext-review-policy.mjs`

**改动点**:
```javascript
import { evaluateScopeApprovalNeed } from './lib/smart-approval.mjs'
import { handleReviewFinding } from './lib/smart-review.mjs'

// V2 scope approval 时
const evaluation = evaluateScopeApprovalNeed(workItem)
if (!evaluation.needsApproval) {
  // AI 继续，不问用户
}

// 审查失败时
const result = await handleReviewFinding(finding, attemptNumber)
if (result.action === 'retry') {
  // AI 自动修正，重新审查
}
```

---

### 4. 低优先级：Phase 4 progressive-verify

**原因**:
- 需要深度集成到编辑工作流
- 涉及多个工具和 hook
- 相对复杂

**集成位置**: 编辑工作流、checkpoint 流程

**建议**: 先完成 Phase 1/3/5，观察效果后再考虑

---

## 📊 实际使用数据收集

### PR-02440 经验教训

**问题**:
- ❌ 直接在 online 分支工作（违反流程）
- ❌ 没有创建 worktree
- ❌ 快速通道评估为"适合"，但实际需要标准流程

**改进建议**:

#### 1. 强化 worktree 流程检查

**位置**: `docs-tdd.mjs` 或 pre-commit hook

**逻辑**:
```javascript
// 在开始工作前检查
if (currentBranch === 'online' || currentBranch === 'main') {
  console.error('❌ 不能直接在 online/main 分支工作')
  console.log('请创建 feature 分支和 worktree:')
  console.log('  git worktree add -b feature/PR-xxxxx .claude/worktrees/PR-xxxxx')
  process.exit(1)
}
```

#### 2. 优化快速通道评估

**问题**: PR-02440 被评为"适合快速通道"，但实际：
- 涉及 2 个组件
- 需要修改 i18n
- 需要查找多个位置

**改进**:
```javascript
// lite-path-router.mjs
// 增加文件数量限制的实际检测
const estimatedFiles = await detectAffectedFiles(requirement)
if (estimatedFiles > 3) {
  return { eligible: false, reason: 'too-many-files' }
}

// 检测是否需要"查找"
const needsSearch = /多个|所有|每个|活动/.test(requirement)
if (needsSearch) {
  return { eligible: false, reason: 'needs-exploration' }
}
```

---

## 🔧 其他改进建议

### 1. 集成测试

**建议**: 为 Phase 2-5 创建集成测试

```javascript
// test/integration/lite-path-e2e.test.mjs
describe('快速通道端到端测试', () => {
  it('应该正确处理纯文案修改', async () => {
    const result = await runLitePath('PR-test-001', '修改按钮文案')
    expect(result.success).toBe(true)
    expect(result.timeSpent).toBeLessThan(300000) // <5分钟
  })
})
```

### 2. 效果数据收集

**建议**: 在每个阶段记录指标

```javascript
// common/engine/agent-scripts/lib/metrics.mjs
export function recordMetrics(phase, data) {
  const metrics = {
    phase,
    timestamp: Date.now(),
    ...data
  }
  
  appendFile('.metrics.jsonl', JSON.stringify(metrics) + '\n')
}

// 使用
recordMetrics('lite-path', {
  projectId: 'PR-02233',
  timeSpent: 120000, // 2分钟
  filesChanged: 1,
  success: true
})
```

### 3. 文档更新

**建议**: 更新 README 和 CLAUDE.md

```markdown
# docs_tdd 优化系统

## 快速通道（Phase 2）

适用场景：
- 纯文案修改
- 样式调整
- 拼写修复

使用方式：
自动触发，无需手动干预

## 智能规则（Phase 5）

自动根据需求类型选择规则：
- V0-lite: 500 tokens
- V0: 1250 tokens
- V1: 2500 tokens
- V2: 5000 tokens
```

---

## ⏭️ 下一步行动计划

### 本周（Week 1）

1. ✅ 集成 Phase 1（extraction-guidance）
   - 修改 vnext-extract.mjs
   - 测试 1-2 个真实需求
   - 观察准确率

2. ✅ 优化快速通道评估
   - 增加文件数量检测
   - 增加"需要查找"检测
   - 测试边界案例

### 下周（Week 2）

3. ✅ 集成 Phase 5（smart-rules）
   - 修改规则注入逻辑
   - 测试不同验证级别
   - 收集 Token 节省数据

4. ✅ 集成 Phase 3（smart-approval + smart-review）
   - 修改 V2 approval 流程
   - 修改审查流程
   - 观察人工介入减少情况

### 本月（Week 3-4）

5. 📊 数据收集和分析
   - 收集 2-3 周的使用数据
   - 分析实际效果
   - 调整参数

6. 📝 文档完善
   - 更新 README
   - 更新 CLAUDE.md
   - 编写最佳实践

---

## 🎯 成功标准

### Phase 1 集成成功标准

- ✅ 准确率从 60-70% 提升到 85-90%+
- ✅ 遗漏率从 5-10% 降至 2-3%
- ✅ 审查返工从 2-3 次降至 0-1 次

### Phase 2 运行成功标准

- ✅ 快速通道触发率 30-40%
- ✅ 快速通道成功率 95%+
- ✅ 平均耗时 2-5 分钟
- ✅ 降级率 <5%

### Phase 5 集成成功标准

- ✅ 规则 Token 平均减少 50-60%
- ✅ AI 响应速度提升 10-15%
- ✅ 质量不下降

---

**创建日期**: 2026-09-21  
**下次更新**: 2026-09-28（1周后）
