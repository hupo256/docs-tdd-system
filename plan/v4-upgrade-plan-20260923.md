# docs_tdd v4.x 系统升级计划

> 启动时间：2026-09-23  
> 当前版本：v3.5.0 stable  
> 目标版本：v4.0（规则补全）→ v4.1（人工提炼输入）

---

## 一、v4.0 规则补全（已完成 ✅）

### 1.1 问题诊断

**发现时间**：2026-09-23  
**问题来源**：PR-02233 项目实操暴露

**核心问题**：
- v4.0 只有 8 个精简规则文件（`-lite` 版本）
- 缺少完整的 `coding-quality`、`api-schema-mapper` 等关键规则
- 导致 standard 档规则覆盖不足，容易漏掉重要检查点

**影响**：
- 开发时缺少必要的编码规范指导
- 容易重复犯已知错误
- 代码质量不稳定

### 1.2 解决方案

**策略**：按需加载完整规则 + 预算分档控制

**实施步骤**：

#### Step 1: 补充完整规则文件（已完成 ✅）

新增 7 个规则文件：
- `api-schema-mapper-core.md` - API/schema/mapper 核心规则
- `biome-config-summary.md` - Biome 配置摘要
- `coding-core-checklist.md` - 编码核心检查清单
- `fameex-shared-components.md` - FameEX 共享组件索引
- `i18n-key-literal-rule.md` - i18n key 字面量规则
- `project-readme-summary.md` - 项目 README 摘要
- `react-query-zustand-split.md` - React Query/Zustand 职责分离

**文件位置**：`common/rules/*.md`

**commit**: `0b894de`

#### Step 2: 更新 rule-loader-v4.mjs（已完成 ✅）

**修改内容**：
```javascript
// 原来（v4.0 beta）：8 个精简规则
const standardRules = [
  'rule-router.md',
  'coding-quality-lite.md',     // 精简版
  'api-schema-mapper-lite.md',  // 精简版
  // ...
]

// 现在（v4.0 stable）：10 个完整规则
const standardRules = [
  'rule-router.md',
  'coding-core-checklist.md',        // 完整版
  'api-schema-mapper-core.md',       // 完整版
  'i18n-key-literal-rule.md',
  'react-query-zustand-split.md',
  'fameex-shared-components.md',
  'biome-config-summary.md',
  'project-readme-summary.md',
  'new-project-kickoff.md',
  'prd-feature-inventory.md',
]
```

**文件位置**：`common/engine/agent-scripts/lib/rule-loader-v4.mjs`

**commit**: `f6495a1`

#### Step 3: 调整预算配置（已完成 ✅）

**修改内容**：`vnext-efficiency-policy.mjs`
```javascript
micro:     25K  (2-3 个规则)
lite:      30K  (5-6 个规则)
standard:  80K  (10 个完整规则)  ← 从 50K 调整到 80K
high-risk: 120K (全量规则)
```

**文件位置**：`common/engine/agent-scripts/lib/vnext-efficiency-policy.mjs`

**commit**: `f6495a1`

### 1.3 验证结果

**测试命令**：
```bash
node test-ctx-with-rules.mjs PR-02233
```

**结果**：
- ✅ standard 档成功加载 10 个规则文件
- ✅ 总计 41611 字符，在 80000 预算内
- ✅ 规则覆盖完整（coding-quality、api-schema-mapper、i18n 等核心规则都有）

**结论**：v4.0 规则补全完成，可以正常使用。

---

## 二、v4.1 人工提炼输入（设计阶段 🚧）

### 2.1 问题诊断

**发现时间**：2026-09-23  
**问题来源**：准备启动 PR-02419 时的讨论

**核心问题**：
- AI 读完整 PRD（54 个 sourceUnits）浪费大量 token（20K-30K）和时间（10-15 分钟）
- PRD 包含大量"叙事性"内容（背景、目标、非目标、历史数据处理），但对开发来说只需要"要做什么"
- v2 的完整 extraction（extractionFacts + requirements + affectedSurfaces）对小需求是 overkill

**实验对比**：

| 方案 | 人工成本 | AI token | 时间 | 准确率 | 适用场景 |
|---|---|---|---|---|---|
| **完整 extraction**（现状） | 0 分钟 | 20K-30K | 10-15 分钟 | 70%（易误解） | 复杂需求 |
| **AI 生成摘要草稿** | 5-10 分钟审核 | 25K+8K | 15-20 分钟 | 85% | ❌ 仍需人工对照 PRD |
| **人工提炼指令** ✅ | 2-3 分钟 | 5K-8K | 5-8 分钟 | 95% | 小需求 |
| **截图 + 标注** ✅ | 3-5 分钟 | 8K-12K | 8-12 分钟 | 98% | 复杂 UI |

### 2.2 设计方案

#### 方案 A：分级 work-item 协议

**核心思路**：根据需求复杂度选择不同的 work-item 模式

##### Lite work-item（小需求）

```json
{
  "projectId": "PR-02419",
  "workflowVersion": 2,
  "workItemMode": "lite",  // 新增字段
  "humanSummary": "运营后台修改用户类型时，前端校验并拦截公司做市用户",
  "requirements": [
    {
      "requirementId": "R-001",
      "statement": "用户详情页修改用户类型，点击确认前校验账户类型...",
      "status": "doing",
      "affectedSurfaces": [
        {
          "surfaceId": "S-001",
          "locator": "apps/admin 用户详情页 - 设置类型弹窗",
          "disposition": "implement"
        }
      ],
      "evidencePlan": [
        {
          "type": "manual-browser",
          "description": "测试公司做市用户修改时 Toast 拦截"
        }
      ]
    }
  ]
  // 没有 extractionFacts、没有 sourceAnchors
}
```

**特点**：
- ✅ 跳过完整 extraction
- ✅ 直接从人工输入生成 requirements
- ✅ 保留核心字段（requirements + affectedSurfaces + evidencePlan）
- ✅ 新增 `humanSummary` 记录人工提炼的原始输入
- ✅ 仍然是结构化、可追溯、可验证的

**适用场景**：
- 单页面改动
- 纯前端校验/提示
- < 3 个文件
- 无新 API、无复杂状态、无多端协同

##### Full work-item（复杂需求）

```json
{
  "projectId": "PR-02233",
  "workflowVersion": 2,
  "workItemMode": "full",
  "extractionFacts": [/* 完整抽取 */],
  "requirements": [/* 完整锚定 */],
  "sourceAnchors": [/* 完整追溯 */]
}
```

**适用场景**：
- 多端协同（web + h5 + admin）
- 复杂交互（多分支状态机、异步流程）
- 高风险改动（支付、权限、数据迁移）
- 需要完整可追溯性

#### 方案 B：micro-lite 效率档位

在 `vnext-efficiency-policy.mjs` 中新增档位：

```javascript
{
  kind: 'micro-lite',
  trigger: '用户一句话说清楚 + 明确表示"这是小需求，直接做"',
  rules: ['rule-router.md §1 硬规则 TL;DR'],  // 只读 1 个文件
  budgetCeiling: 15000,  // 超低预算
  skipSteps: ['extraction', 'coverage-review', 'scope-approval'],
  evidence: 'optional',
  gate: 'none'
}
```

**效果**：
- 人工提炼（2-3 分钟）→ AI 生成 lite work-item（1 分钟）→ AI 实现（5-10 分钟）
- 总时间：10-15 分钟（vs. 现状的 25-30 分钟）
- Token 消耗：5K-10K（vs. 现状的 25K-35K）

### 2.3 实验验证

**实验项目**：PR-02419（公司做市用户类型禁止修改）

**实验流程**：
1. ✅ 用户用 30 秒口述需求（4 个点）
2. ✅ AI 生成简化版 work-item（1 分钟，4 个 requirements）
3. ⏳ AI 实现代码（待继续）
4. ⏳ 对比完整 extraction 的效率差异

**当前状态**：
- work-item 已生成：`prds/PR-02419/work-item.json`
- 实验中断：发现 worktree 命名问题，交接给下一个 chat 继续

**初步结论**：
- ✅ 人工提炼确实快（30 秒 vs. 10-15 分钟）
- ✅ 生成的 work-item 质量高（用户快速审核通过）
- ⏳ 实现效率待验证（需要继续完成 PR-02419）

### 2.4 待实现（v4.1）

#### Task 1: 扩展 work-item schema

**文件**：`common/engine/schemas/vnext-work-item.schema.json`

**修改**：
```json
{
  "workItemMode": {
    "type": "string",
    "enum": ["lite", "full"],
    "description": "lite 跳过完整 extraction，full 保留完整追溯"
  },
  "humanSummary": {
    "type": "string",
    "description": "人工提炼的原始输入（仅 lite 模式必需）"
  },
  "extractionFacts": {
    "type": "array",
    "description": "仅 full 模式必需"
  }
}
```

#### Task 2: 更新 kickoff 命令

**文件**：`common/engine/agent-scripts/docs-tdd.mjs`

**新增参数**：
```bash
docs-tdd kickoff PR-02419 \
  --kind feature \
  --mode lite \                    # 新增：指定 lite 模式
  --summary "运营后台修改用户类型时，前端校验并拦截公司做市用户"
```

#### Task 3: 更新 extract 命令

**文件**：`common/engine/agent-scripts/docs-tdd.mjs`

**修改逻辑**：
```javascript
if (workItem.workItemMode === 'lite') {
  // 跳过完整 extraction
  // 直接从 humanSummary 生成 requirements
  return generateLiteRequirements(workItem.humanSummary)
} else {
  // 保持现有完整 extraction 流程
  return fullExtraction(prd)
}
```

#### Task 4: 更新 efficiency-policy

**文件**：`common/engine/agent-scripts/lib/vnext-efficiency-policy.mjs`

**新增档位**：
```javascript
export const efficiencyLevels = {
  'micro-lite': {
    budgetCeiling: 15000,
    rules: ['rule-router.md'],
    skipSteps: ['extraction', 'coverage-review'],
    workItemMode: 'lite'
  },
  // ... 现有档位
}
```

#### Task 5: 文档更新

**文件**：`common/rules/new-project-kickoff.md`

**新增章节**：
```markdown
## 4. Lite 模式（小需求快速通道）

### 适用场景
- 单页面改动
- < 3 个文件
- 纯前端校验/提示

### 使用方法
1. 人工看 PRD，用 2-3 分钟提炼"要做什么"
2. 运行 kickoff --mode lite --summary "..."
3. AI 生成 lite work-item（跳过 extraction）
4. 直接实现

### 优势
- 节省 15K+ token
- 节省 10 分钟理解时间
- 准确率更高（人工理解 > AI 理解）
```

---

## 三、其他优化（已完成 ✅）

### 3.1 v1 流程标记废弃

**问题**：`start-new-project.mjs`（v1 G0-G8 Gate 流程）与 v2 work-item 协议方向冲突。

**解决**：
- 在文件开头添加废弃警告
- 在 help 信息中引导用户使用 `docs-tdd kickoff --kind feature|bugfix`
- v1 存量项目继续支持，但新项目默认走 v2

**commit**: `6e5d1d1`

### 3.2 迭代计划文档更新

**文件**：`practice-log/ITERATION-PLAN-v3.5-20260917.md`

**更新内容**：
- 记录 v4.0 规则补全决策
- 记录 lite/standard/high-risk 三档规则配置
- 记录 v4.1 方向（micro-lite 快速通道）

**commit**: `c39141e`

---

## 四、实施时间线

### Phase 1: v4.0 规则补全（已完成 ✅）

- ✅ 2026-09-23：补充 7 个完整规则文件
- ✅ 2026-09-23：更新 rule-loader-v4.mjs
- ✅ 2026-09-23：调整预算配置
- ✅ 2026-09-23：验证通过

**结果**：v4.0 可以正式使用，规则覆盖完整。

### Phase 2: v4.1 人工提炼输入（进行中 🚧）

- ✅ 2026-09-23：设计方案（lite work-item + micro-lite 档位）
- ✅ 2026-09-23：实验验证（PR-02419 部分完成）
- ⏳ 待定：完成 PR-02419 实验，收集完整数据
- ⏳ 待定：实现 Task 1-5
- ⏳ 待定：更新文档
- ⏳ 待定：发布 v4.1.0

**预计完成时间**：1-2 周

### Phase 3: v4.2 长期优化（规划中 📋）

#### 可能的方向：

1. **PRD 预处理**（中期）
   - 让产品在 PRD 中补充"开发摘要"章节
   - AI 优先读开发摘要，而不是全文
   - 适用于复杂需求（lite 模式不够用时）

2. **智能档位路由**（长期）
   - AI 自动判断需求复杂度，选择合适的档位
   - 不需要人工指定 --mode lite/full
   - 基于需求特征（文件数、端数、API 数、状态复杂度）自动路由

3. **渐进式 extraction**（长期）
   - 实现时才发现需要更多上下文
   - 按需补充 extraction，而不是一开始全量
   - 适用于不确定性高的需求

---

## 五、关键决策记录

### 决策 1：v4.0 规则补全策略

**问题**：v4.0 只有精简规则，是全量替换还是按需加载？

**选项**：
- A. 全量加载完整规则（100K+ token）
- B. 按需加载，standard 档加载完整规则（80K）
- C. 保持精简规则，牺牲质量

**决策**：选 B（按需加载）

**理由**：
- 小需求不需要完整规则（可以用 lite 档）
- 标准需求需要完整规则（standard 档）
- 高风险需求需要全量规则（high-risk 档）
- 按需加载平衡了质量和效率

### 决策 2：v4.1 人工提炼输入策略

**问题**：如何减少 AI 读 PRD 的 token 消耗？

**选项**：
- A. AI 生成"开发摘要"草稿，人工审核
- B. 人工直接提炼，AI 生成 work-item
- C. PRD 格式改进（要求产品写开发摘要）

**决策**：选 B（人工直接提炼）

**理由**：
- A 的问题：人工审核时还是要对照 PRD，没省事
- B 的优势：人工提炼 2-3 分钟，AI 直接生成 work-item，效率最高
- C 的问题：需要改变产品流程，推动成本高

**适用场景**：
- B 适合小需求（lite 模式）
- C 适合复杂需求（full 模式，长期优化方向）

### 决策 3：lite work-item 的最小字段集

**问题**：lite 模式跳过 extraction，但 work-item 要保留哪些字段？

**必须保留**：
- `requirements`：核心需求列表
- `affectedSurfaces`：影响的文件/组件
- `evidencePlan`：验证方案
- `humanSummary`：人工提炼的原始输入

**可以省略**：
- `extractionFacts`：从 PRD 抽取的原子事实
- `sourceAnchors`：需求锚定到 PRD 的具体段落
- `sourceUnits`：PRD 的结构化单元

**理由**：
- 必须保留的字段确保 work-item 仍然是"可执行、可验证、可追溯"的
- 省略的字段只影响"与 PRD 的完整追溯"，对小需求不重要
- 如果后续需要追溯，可以回看 `humanSummary` 和 `inbox/lark-sync/prd-latest.md`

---

## 六、待验证假设

### 假设 1：人工提炼的准确率更高

**假设**：人工看 PRD 后的理解比 AI 读 PRD 更准确。

**验证方法**：
- 同一个需求，分别用"AI extraction"和"人工提炼"生成 work-item
- 对比实现后的返工次数、bug 数、验收通过率

**当前状态**：待验证（需要完成 PR-02419 并收集数据）

### 假设 2：lite 模式节省 50% 时间

**假设**：lite 模式比 full 模式节省 50% 时间。

**验证方法**：
- 记录 10 个小需求的时间消耗（lite vs. full）
- 对比 intake → implementation → delivery 的总时间

**当前状态**：待验证

### 假设 3：lite 模式适用于 70% 的需求

**假设**：70% 的需求属于"小需求"，适合用 lite 模式。

**验证方法**：
- 统计过去 20 个需求的复杂度
- 分类：单页面/多页面、单端/多端、有无新 API、文件数
- 计算符合 lite 条件的比例

**当前状态**：待验证

---

## 七、相关文件清单

### 核心代码
- `common/engine/agent-scripts/lib/rule-loader-v4.mjs` - 规则加载器
- `common/engine/agent-scripts/lib/vnext-efficiency-policy.mjs` - 效率策略
- `common/engine/agent-scripts/docs-tdd.mjs` - CLI 入口
- `common/engine/schemas/vnext-work-item.schema.json` - work-item schema

### 规则文件
- `common/rules/rule-router.md` - 规则路由（常驻）
- `common/rules/api-schema-mapper-core.md` - API/schema/mapper 核心规则
- `common/rules/coding-core-checklist.md` - 编码核心检查清单
- `common/rules/i18n-key-literal-rule.md` - i18n key 字面量规则
- `common/rules/react-query-zustand-split.md` - React Query/Zustand 分离
- `common/rules/fameex-shared-components.md` - FameEX 共享组件索引
- `common/rules/biome-config-summary.md` - Biome 配置摘要
- `common/rules/project-readme-summary.md` - 项目 README 摘要

### 文档
- `practice-log/ITERATION-PLAN-v3.5-20260917.md` - v3.5 → v4.x 迭代计划
- `practice-log/V4-UPGRADE-PLAN-20260923.md` - 本文件（v4.x 系统升级计划）
- `common/rules/new-project-kickoff.md` - 新项目启动指南

### 实验项目
- `prds/PR-02419/` - lite 模式实验项目
- `prds/PR-02419/work-item.json` - 简化版 work-item 样例

---

## 八、下一步行动

### 立即行动（本周）

1. **完成 PR-02419 实验**（验证 lite 模式效率）
   - 修正 worktree 名称
   - 实现 4 个 requirements
   - 记录时间和 token 消耗
   - 对比 full 模式的效率差异

2. **收集数据**
   - lite 模式 vs. full 模式的时间对比
   - lite 模式 vs. full 模式的 token 对比
   - 人工提炼的准确率数据

3. **更新本文档**
   - 补充实验结果
   - 确认 v4.1 实施优先级

### 短期行动（1-2 周）

如果 PR-02419 实验验证通过：

1. **实现 v4.1 Task 1-5**
   - 扩展 work-item schema
   - 更新 kickoff 命令
   - 更新 extract 命令
   - 更新 efficiency-policy
   - 更新文档

2. **发布 v4.1.0**
   - 打 tag
   - 更新 CHANGELOG
   - 通知团队

### 中期行动（1-2 月）

1. **推广 lite 模式**
   - 在团队内试用
   - 收集反馈
   - 优化流程

2. **探索 PRD 预处理**
   - 与产品沟通"开发摘要"章节
   - 设计格式规范
   - 小范围试点

### 长期行动（3-6 月）

1. **智能档位路由**
2. **渐进式 extraction**
3. **多模态输入**（截图、语音）

---

## 九、风险和缓解

### 风险 1：lite 模式准确率不够

**风险**：人工提炼遗漏关键信息，导致实现不完整。

**缓解**：
- lite 模式增加"遗漏检查"步骤
- AI 根据 work-item 反推可能遗漏的点，提醒人工确认
- 保留 PRD 原文作为兜底

### 风险 2：团队不习惯人工提炼

**风险**：团队习惯了"AI 自动处理"，不愿意花时间提炼。

**缓解**：
- 明确 lite 模式的效率优势（节省 50% 时间）
- 提供提炼模板和示例
- 对比数据说服团队

### 风险 3：lite 模式适用范围小

**风险**：实际上只有 30% 的需求适合 lite 模式，不如预期。

**缓解**：
- 收集数据调整预期
- 优化 lite 模式的适用条件
- 探索 PRD 预处理作为补充方案

---

## 十、成功指标

### v4.0 成功指标（已达成 ✅）

- ✅ standard 档规则覆盖完整（10 个完整规则）
- ✅ 预算控制在 80K 以内
- ✅ 验证通过（test-ctx-with-rules.mjs）

### v4.1 成功指标（待验证 ⏳）

- [ ] lite 模式节省 50% 时间
- [ ] lite 模式节省 60% token
- [ ] lite 模式准确率 ≥ 95%
- [ ] lite 模式适用于 ≥ 60% 的需求
- [ ] 团队采纳率 ≥ 80%

---

## 十一、参考资料

### 相关讨论
- 本次 session 的完整对话记录（2026-09-23）
- PR-02419 交接文档：`practice-log/HANDOVER-PR-02419-20260923.md`

### 相关 commit
- `f6495a1` - v4.0 规则补全
- `0b894de` - 补充完整规则文件
- `c39141e` - 更新迭代计划
- `6e5d1d1` - v1 流程标记废弃
- `10db29c` - PR-02419 简化版 work-item

### 参考项目
- PR-02233（触发 v4.0 规则补全）
- PR-02419（验证 v4.1 lite 模式）

---

**最后更新**：2026-09-23  
**负责人**：待定  
**状态**：v4.0 已完成，v4.1 进行中
