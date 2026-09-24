# Phase 1 验证执行指南

## 🎯 目标

验证 extraction-guidance v2.0 在 3 个历史遗漏案例上的表现

## 📋 准备工作（已完成 ✅）

- ✅ 验证脚本已创建
- ✅ run trace 基础设施已就绪
- ✅ 3 个历史案例的 PRD 已确认存在
- ✅ 12 个检查点已设计完成

## 🚀 执行步骤

### Step 1: 选择一个案例开始

**推荐顺序**：
1. PR-02306（图片需求，最典型）
2. PR-01930（集合枚举）
3. PR-02265（资金字段）

### Step 2: 读取 PRD

```bash
# PR-02306
cat prds/PR-02306/inbox/lark-sync/prd-latest.md

# PR-01930
cat prds/PR-01930/inbox/lark-sync/prd-latest.extracted.md

# PR-02265
cat prds/PR-02265/inbox/lark-sync/prd-latest.md
```

### Step 3: 使用 extraction-guidance v2.0 抽取

#### 方法 A：使用 docs-tdd CLI（推荐）

```bash
# 会自动使用 extraction-guidance v2.0
node common/engine/agent-scripts/docs-tdd.mjs extract PR-02306 --force
```

#### 方法 B：手动调用 AI

**提示词模板**：

```
请按照 extraction-guidance v2.0 的"四遍精读法"抽取以下 PRD 的需求：

【PRD 内容粘贴在这里】

请严格遵循：
1. 第 1 遍：全局扫描（5 分钟）
2. 第 2 遍：分主题深入理解（高风险优先、集合强制枚举）
3. 第 3 遍：富媒体深度解读（图片提取需求、表格逐行处理）
4. 第 4 遍：自我完整性检查（反向、正向、边界、高风险）

历史遗漏教训：
- PR-02306：图片中的文字是需求，不是装饰
- PR-01930：遇到"所有"必须完整枚举，代码中搜索确认
- PR-02265：资金相关必须用检查清单逐项确认

请输出完整的需求抽取结果。
```

### Step 4: 检查验证点

#### PR-02306 检查清单

- [ ] 🔴 **[IMG-TEXT]** 识别图片中的密码规则文本
  - 查找：是否提取了图片中的"8-20位"、"字母+数字"文本
  - ✅ 通过 / ❌ 失败

- [ ] 🔴 **[LENGTH]** 提取"8-20位"长度限制
  - 查找：requirements 中是否明确提到"8-20"
  - ✅ 通过 / ❌ 失败

- [ ] 🔴 **[COMBINATION]** 提取"必须包含字母和数字"组合要求
  - 查找：requirements 中是否明确提到"字母+数字"组合
  - ✅ 通过 / ❌ 失败

- [ ] 🟡 **[IMAGE-ONLY]** 标记为【图片独有需求】
  - 查找：是否标注该需求来自图片，且 PRD 文字中未提及
  - ✅ 通过 / ❌ 失败

#### PR-01930 检查清单

- [ ] 🔴 **[COLLECTION-KW]** 识别"所有"、"每个"等集合语义关键词
  - 查找：是否识别到集合语义
  - ✅ 通过 / ❌ 失败

- [ ] 🔴 **[COMPLETE-ENUM]** 完整枚举所有入口（≥ 3 个）
  - 查找：affectedSurfaces 中是否列出 ≥ 3 个入口
  - ✅ 通过 / ❌ 失败

- [ ] 🟡 **[COLLECTION-TAG]** 在 work-item 中标记 collectionSemantics
  - 查找：是否有 collectionSemantics 字段
  - ✅ 通过 / ❌ 失败

- [ ] ⚪ **[CODE-SEARCH]** 使用代码搜索确认完整性
  - 查找：是否提到用代码搜索确认
  - ✅ 通过 / ❌ 失败

#### PR-02265 检查清单

- [ ] 🔴 **[FUND-CHECKLIST]** 自动激活【资金类】检查清单
  - 查找：extractionGuidance 中是否包含资金类检查清单
  - ✅ 通过 / ❌ 失败

- [ ] 🔴 **[AMOUNT-FEE]** 识别 amount/fee 关键字段
  - 查找：requirements 中是否明确提到 amount/fee
  - ✅ 通过 / ❌ 失败

- [ ] 🟡 **[FIELD-DETAILS]** 检查金额字段的类型、单位、精度
  - 查找：是否检查了金额字段的详细规格
  - ✅ 通过 / ❌ 失败

- [ ] 🟡 **[V2-RISK]** 标记为高风险需求（V2）
  - 查找：routing.verificationLevel 是否为 V2
  - ✅ 通过 / ❌ 失败

### Step 5: 记录结果

创建验证结果文件：

```bash
# 示例：prds/PR-02306/phase1-verification-result.md

# Phase 1 验证结果 - PR-02306

## 执行信息
- 验证时间: 2026-09-24
- 执行人: [你的名字]
- AI: Claude Opus 4.8 / Pi

## 检查点结果

### Critical (必须全部通过)
- [x] ✅ [IMG-TEXT] 识别图片中的密码规则文本
- [x] ✅ [LENGTH] 提取"8-20位"长度限制
- [x] ✅ [COMBINATION] 提取"必须包含字母和数字"组合要求

### Important
- [x] ✅ [IMAGE-ONLY] 标记为【图片独有需求】

## 准确率
- Critical: 3/3 = 100%
- 总体: 4/4 = 100%

## 结论
✅ 通过 - extraction-guidance v2.0 成功识别图片需求

## 对比旧版（如果有）
- 旧版准确率: N/A
- 改进: +100%
```

### Step 6: 汇总结果

完成 3 个案例后，汇总准确率：

```markdown
# Phase 1 验证总结

## 汇总结果

| 项目 | Critical 通过率 | 总体通过率 | 结论 |
|------|----------------|-----------|------|
| PR-02306 | 3/3 = 100% | 4/4 = 100% | ✅ 通过 |
| PR-01930 | ?/3 = ?% | ?/4 = ?% | ? |
| PR-02265 | ?/3 = ?% | ?/4 = ?% | ? |
| **平均** | **?%** | **?%** | **?** |

## 成功标准
- Critical 通过率 = 100%（6/6）
- 总体通过率 > 90%（≥ 11/12）

## 结论
- [ ] ✅ 达标 - Phase 1 成功
- [ ] ⚠️ 部分达标 - 需要调整
- [ ] ❌ 未达标 - 需要重新设计
```

---

## 🛠️ 辅助工具

### 快速验证脚本

```bash
# 查看验证准备情况
node common/engine/agent-scripts/test-phase1-verification.mjs --all

# 查看单个项目
node common/engine/agent-scripts/test-phase1-verification.mjs PR-02306

# 运行集成了 run trace 的验证（推荐）
node common/engine/agent-scripts/phase1-verify-with-trace.mjs --all
```

### 查看生成的 trace

```bash
# 查看 trace 文件
cat prds/PR-02306/phase1-verification-run-*.json

# 查看所有 trace
find prds -name "phase1-verification-*.json" -exec cat {} \;

# 查看 runs.jsonl
cat prds/PR-02306/runs.jsonl
```

---

## 📊 成功指标

### 必须达到
- [ ] 3 个历史案例第一次抽取就全对
- [ ] Critical 检查点通过率 = 100%（6/6）
- [ ] 总体检查点通过率 > 90%（≥ 11/12）

### 次要指标
- [ ] 用户对"理解摘要"满意度 > 8/10
- [ ] 抽取时间 < 15 分钟（每个案例）
- [ ] 无需人工返工

---

## ⚠️ 注意事项

1. **严格按照检查点**：不要主观判断，严格对照检查点逐项检查

2. **记录证据**：每个检查点的通过/失败都要有具体证据（哪一行、哪个字段）

3. **对比旧版（如果有）**：如果有旧版抽取结果，对比改进程度

4. **时间记录**：记录每个阶段的实际耗时，用于评估效率

5. **诚实记录失败**：如果有检查点失败，诚实记录，分析原因

---

## 🎯 预期结果

**如果 Phase 1 成功（通过率 > 90%）**：
- ✅ 证明 extraction-guidance v2.0 有效
- ✅ 可以继续 Phase 2-5（快速通道、智能提问等）
- ✅ 为 autopilot 快速上线奠定基础

**如果 Phase 1 部分成功（80-90%）**：
- ⚠️ 调整 extraction-guidance
- ⚠️ 增加针对性检查清单
- ⚠️ 继续观察 1-2 周

**如果 Phase 1 失败（< 80%）**：
- ❌ 分析根本原因
- ❌ 考虑双 Agent 交叉验证
- ❌ 或重新设计抽取流程

---

**创建时间**：2026-09-24  
**状态**：准备就绪，等待执行

🚀 **让我们开始验证吧！**
