# 附录 F：AutoPilot 控制层设计（v3.9 / v4.0，Phase 1 之上）

> 状态：纸面设计，Phase 1（v3.5 P0）完成并验证后才进入实现。
>
> 背景：当前 v3.5 P0（A2~A7 + Phase 2–4）能防误报、防漏需求、防越界提交，但离「我只给需求，系统负责安全建分支、完整理解来源、只在必要时问我、完成代码、验证、修复、提交，不会漏需求或卡死」的 AutoPilot 定位还有三个结构性缺口：
> 1. Agent 自主决策边界未定义（遇到不确定就问，无 escalation 路由）。
> 2. 自动修复 / 重试触发器缺失（verify/review fail 后等人喂下一步，而非自动进修复循环）。
> 3. 多源输入与运行时决策的持久化缺失（stakeholder override、Figma 优先、defer 失效等动态修正不写回，下次会话重复问）。
>
> 本设计补全三个模块（M1 决策权限表 + M2 执行器 + M3 决策日志），在 P0 安全底线之上建自主控制层。

---

## M1：Agent 决策权限表 + escalation 路由

### M1.1 决策矩阵（decision matrix）

定义每类不确定性的 Agent 自主策略与 escalate 条件。新增文件 `common/rules/agent-decision-matrix.json`（或 .md 表格），格式：

```jsonc
{
  "schemaVersion": 1,
  "categories": [
    {
      "categoryId": "source-conflict",
      "scenarios": [
        {
          "scenarioId": "figma-vs-prd-ordering",
          "description": "Figma 节点排序与 PRD 文字描述冲突",
          "agentAutonomy": "prefer-figma",  // prefer-figma | ask-human | try-both
          "autoAction": {
            "do": "采用 Figma 顺序实现",
            "log": "记 runtime-decisions.jsonl type=figma-priority",
            "annotation": "在代码注释标注 PRD 原文与 Figma 差异"
          },
          "escalateIf": [
            "Figma 节点也有歧义（如同层多组排列）",
            "PRD 含明确版本号或审批签字",
            "冲突涉及金额/权限/不可逆操作"
          ]
        },
        {
          "scenarioId": "prd-multi-source-conflict",
          "description": "Lark 文档 vs 口头需求 vs Figma 三源不一致",
          "agentAutonomy": "ask-human",
          "escalateIf": ["always"],
          "escalateWith": "列出三源差异对照表 + 推荐方案（如优先最新 ts）"
        }
      ]
    },
    {
      "categoryId": "scope-boundary",
      "scenarios": [
        {
          "scenarioId": "policypaths-out-of-scope",
          "description": "staged 路径不在 deliveryScope.policyPaths 内",
          "agentAutonomy": "auto-extend",
          "autoAction": {
            "do": "按目录聚类越界路径，推导候选前缀（≤5 条）",
            "apply": "追加到 work-item.json deliveryScope.policyPaths",
            "log": "runtime-decisions: type=scope-auto-extend, paths=[...]"
          },
          "escalateIf": [
            "推导候选 > 5 条路径前缀",
            "越界路径跨 app（如 apps/web + apps/shared 同时出现）",
            "路径在已声明的 deferred.excludedPaths 内"
          ]
        },
        {
          "scenarioId": "defer-prerequisite-invalidated",
          "description": "deferred 前提失效（如 MA-010：Account 迁移 defer 但 stakeholder 要求本批次落 apps/web）",
          "agentAutonomy": "confirm-and-update",
          "autoAction": {
            "do": "向 stakeholder 确认 defer 是否仍有效",
            "apply": "若无效，移除对应 deferred 条目，把相关 surface 改 disposition=implement",
            "log": "runtime-decisions: type=defer-invalidate, reason=stakeholder-override"
          },
          "escalateIf": ["stakeholder 未明确回复 3 个工作日"]
        }
      ]
    },
    {
      "categoryId": "api-dependency",
      "scenarios": [
        {
          "scenarioId": "dto-fields-insufficient",
          "description": "API DTO 字段无法表达 PRD 全部组合（如 MA-010 MobileBindReq 缺邮箱验证码字段）",
          "agentAutonomy": "mark-blocked",
          "autoAction": {
            "do": "标记相关 surface blockedBy=[API-xxx]，状态进 integration-pending",
            "continue": "纯前端项（无 blockedBy）继续实现",
            "log": "runtime-decisions: type=api-blocked, surfaces=[...], reason=dto-insufficient"
          },
          "escalateIf": [
            "纯前端项也依赖该 DTO 字段（如前端校验逻辑需要知道后端接受哪些字段）",
            "blocked surface 占比 > 50%"
          ],
          "escalateWith": "DTO 当前字段 vs PRD 要求对照 + 建议补字段清单 + @API-owner"
        },
        {
          "scenarioId": "api-ready-but-no-update",
          "description": "apiDependency 声明 ready=false，但后端已上线未更新 work-item",
          "agentAutonomy": "verify-and-unblock",
          "autoAction": {
            "do": "运行 API contract test 或查后端 changelog",
            "apply": "若测试通过，更新 apiDependency.ready=true，解除 surface blockedBy",
            "log": "runtime-decisions: type=api-unblock, verified-by=contract-test"
          },
          "escalateIf": ["contract test 失败或无测试覆盖"]
        }
      ]
    },
    {
      "categoryId": "review-finding",
      "scenarios": [
        {
          "scenarioId": "finding-nit",
          "description": "coverage review 产出 nit 级 finding（如变量命名建议）",
          "agentAutonomy": "batch-waive",
          "autoAction": {
            "do": "自动标 disposition=waived, reason=nit-deferred",
            "threshold": "单轮 nit ≤ 10 条可批量 waive；> 10 条 escalate"
          },
          "escalateIf": ["nit 累计 > 10 或涉及安全/money 关键词"]
        },
        {
          "scenarioId": "finding-blocker",
          "description": "coverage review 产出 blocker 级 finding",
          "agentAutonomy": "auto-fix-if-mechanical",
          "autoAction": {
            "do": "判断可机械修复（如缺 surface、copy key typo），自动改后 re-review",
            "maxRetry": 2
          },
          "escalateIf": [
            "修复需业务判断（如「requirement 遗漏关键用户故事」）",
            "自动修复 2 轮后仍 blocker"
          ]
        }
      ]
    },
    {
      "categoryId": "human-acceptance",
      "scenarios": [
        {
          "scenarioId": "visual-qa-failed",
          "description": "人工验收视觉不符（MA-001~009 类）",
          "agentAutonomy": "auto-fix-if-declarative",
          "autoAction": {
            "do": "若 failed 原因为声明式样式（cursor/size/spacing/color），自动改后重新请求验收",
            "maxRetry": 2,
            "log": "runtime-decisions: type=visual-fix, ma-id=MA-xxx"
          },
          "escalateIf": [
            "需重新布局或改组件结构",
            "涉及交互逻辑变更",
            "自动修复 2 轮仍 failed"
          ],
          "escalateWith": "当前实现截图 vs 目标态截图对比 + 差异清单"
        },
        {
          "scenarioId": "acceptance-blocked-by-environment",
          "description": "人工验收因环境问题无法进行（如本地服务启动失败）",
          "agentAutonomy": "fix-environment",
          "autoAction": {
            "do": "尝试常见修复（install deps / clear cache / restart dev server）",
            "maxRetry": 1
          },
          "escalateIf": ["环境修复失败或需系统级依赖"]
        }
      ]
    },
    {
      "categoryId": "kickoff-ambiguity",
      "scenarios": [
        {
          "scenarioId": "existing-dir-no-workflow-version",
          "description": "项目目录已存在但无 workflowVersion 也无 work-item.json",
          "agentAutonomy": "diagnose-and-recommend",
          "autoAction": {
            "do": "检测目录内文件特征（有 lark-sources.json→疑似v1 / 有 coverage-findings→疑似v2 / 仅 README→未初始化）",
            "output": "诊断报告 + 推荐版本（默认 v2）+ 命令示例"
          },
          "escalateIf": ["检测到 v1 legacy 文件但用户未显式要求 --legacy"]
        }
      ]
    }
  ]
}
```

### M1.2 escalation 输出规范

当 Agent 判定需 escalate 时，输出结构化 JSON + 自然语言：

```jsonc
{
  "escalationType": "decision-required",  // decision-required | blocker | info
  "scenarioId": "dto-fields-insufficient",
  "context": {
    "requirement": "R-008",
    "surfaces": ["S-030", "S-031"],
    "apiDependency": "API-MOBILE-BIND"
  },
  "problem": "MobileBindReq 缺少邮箱验证码字段，无法表达 PRD「首次绑手机需邮箱安全验证」",
  "evidence": {
    "currentDTO": "{ smsCode, googleCode }",
    "prdRequirement": "首次绑定手机号需通过已绑定邮箱的验证码进行安全校验",
    "gap": "缺 emailVerificationCode 字段"
  },
  "options": [
    { "option": "A", "label": "联系 API owner 补字段后继续", "impact": "阻塞本批次，等待后端排期" },
    { "option": "B", "label": "降级：本批次只做「已有邮箱时的手机绑定」", "impact": "缩减 scope，defer 首次绑定场景" },
    { "option": "C", "label": "mock DTO 完成前端，标记 integration-pending", "impact": "前端完成但无法真实提交" }
  ],
  "recommendation": "B（降级 scope）",
  "autoBlockedSurfaces": ["S-030"],
  "autoContinuedSurfaces": ["S-031（纯前端切换 UI）"]
}
```

### M1.3 人工决策输入协议

stakeholder 回复 escalation 时，可以：

- CLI：`docs-tdd decide <PROJECT-ID> <escalation-id> --option B --reason "首次绑定延到 Q4"`
- 或自然语言（Agent 解析后写 runtime-decisions.jsonl）

---

## M2：自动修复 / 重试执行器

### M2.1 执行器架构

在每个产出 pass/fail 判定的环节后插入 **auto-disposition** 步骤：

```
verify → result
  → if pass: continue
  → if fail: classify(result) → disposition
      → auto-fixable:   apply-fix → re-verify (max 2 rounds) → still-fail? escalate
      → needs-decision: escalate-with-options → wait-input
      → blocked:        mark-surface-pending → continue-others
```

新增脚本 `common/engine/agent-scripts/lib/auto-disposition.mjs`，输入 verify/review/acceptance result，输出：

```jsonc
{
  "disposition": "auto-fixable" | "needs-decision" | "blocked" | "pass",
  "fixActions": [
    { "type": "edit-file", "path": "...", "change": "..." },
    { "type": "update-work-item", "field": "deliveryScope.policyPaths", "append": [...] }
  ],
  "escalation": { /* 见 M1.2 */ }
}
```

### M2.2 可自动修复的失败类型（白名单）

| 失败类型 | 自动修复策略 | 最大重试 |
|---|---|---|
| policyPaths 越界（≤5 候选） | 推导前缀追加 work-item | 1 |
| 声明式样式不符（cursor/size/spacing/color） | 按目标值改 Tailwind class | 2 |
| copy key typo（i18n key 不存在） | 补 key 到对应 locale json | 1 |
| surface locator 解析失败但符号存在别处 | 更正 expectPath glob | 1 |
| DOM contract 单个断言 fail | 按 contract 期望调整 JSX 属性 | 2 |
| Biome lint auto-fixable | `biome check --write` | 1 |
| import missing | 补 import 语句（需静态分析确认导出存在） | 1 |

**不可自动修的（必须 escalate）**：
- 需业务逻辑判断（如「requirement 遗漏关键路径」）
- 需重新布局或改组件结构
- 涉及交互状态机变更
- API DTO 不足需后端改
- 人工验收视觉差异 > 声明式样式（如布局、图标、文案语义）

### M2.3 重试上限与降级

- 单项 auto-fix 最多 2 轮；2 轮后仍 fail → escalate。
- 单批次累计 auto-fix > 10 次 → 暂停自动修复，escalate「疑似根本性设计问题」。
- review finding 最多 2 轮自动修；Phase 2 §5 的「超过后进 human-review-deferred」保持不变，但前两轮的 blocker/major 自动修复先走 M2。

### M2.4 修复后的验证链

auto-fix 应用后必须重跑对应验证：

```
MA-003 cursor 修复 → re-run pr-02233-auth-flows DOM contract
policyPaths 追加 → re-run dev-check (scoped to new paths)
copy key 补全 → re-run i18n-copy contract
surface locator 更正 → re-run reconcile (that surface)
```

若重跑仍 fail 且未达重试上限 → 再修一轮；达上限 → escalate。

---

## M3：运行时决策日志 schema

### M3.1 文件位置与格式

新增 `prds/<ID>/runtime-decisions.jsonl`（append-only JSONL），每条一行：

```jsonc
{"ts":"2026-09-18T10:23:45Z","actor":"stakeholder-aven","type":"figma-priority","target":"R-004","before":"排序 GA→邮箱→手机","after":"排序 邮箱→手机→GA","reason":"stakeholder confirmed follow Figma node 19834:3367","evidence":"PR-02233 口头需求会话"}
{"ts":"2026-09-18T14:56:12Z","actor":"agent","type":"scope-auto-extend","target":"deliveryScope.policyPaths","append":["apps/web-next/src/components/CodeVerifyDialog","apps/web-next/src/i18n/react"],"reason":"staged paths outside scope, auto-inferred from requirement consumption graph"}
{"ts":"2026-09-19T09:10:03Z","actor":"system","type":"api-blocked","target":"S-030,S-031","dependency":"API-MOBILE-BIND","reason":"MobileBindReq lacks emailVerificationCode field","resolution":"defer to Q4 Account batch"}
{"ts":"2026-09-19T11:45:28Z","actor":"agent","type":"visual-fix","target":"MA-003","surface":"S-009","change":"add cursor-pointer to NoCodeGuide trigger","retryCount":1}
{"ts":"2026-09-20T08:30:15Z","actor":"stakeholder-aven","type":"defer-invalidate","target":"deliveryScope.deferred.batch=ACCOUNT-Q4","before":"defer Account/Assets to web-next Q4","after":"implement R-008 modify/bind email/mobile in apps/web this batch","reason":"stakeholder override: must land in apps/web now"}
```

### M3.2 schema 定义

```jsonc
{
  "ts": "ISO 8601",
  "actor": "stakeholder-<name> | agent | system | human-reviewer",
  "type": "figma-priority | requirement-override | scope-auto-extend | api-blocked | api-unblock | defer-invalidate | visual-fix | finding-waive | delivery-target-change | kickoff-version-select",
  "target": "requirementId | surfaceId | work-item field path | MA-id",
  "before": "原值（可选，用于 override 类）",
  "after": "新值（可选）",
  "append": "追加内容（可选，如 policyPaths）",
  "reason": "自然语言原因",
  "evidence": "决策依据（可选，如会话链接、Figma node、API doc URL）",
  "resolution": "最终处置（可选，如 blocked → defer）",
  "relatedDecisions": ["前序决策的 ts，形成决策链"]
}
```

### M3.3 读取与应用

每次会话启动 / context 加载时：

1. 读 `runtime-decisions.jsonl` 全部条目，按 ts 排序。
2. 按 type 分组构建索引：
   - `figma-priority` / `requirement-override` → 覆盖 work-item 对应字段的语义解释（代码注释标注差异，但实现按 after 做）。
   - `scope-auto-extend` → 合并到当前 `deliveryScope.policyPaths`。
   - `defer-invalidate` → 移除对应 deferred 条目，affected surface 改 disposition=implement。
   - `api-blocked` / `api-unblock` → 更新 surface blockedBy 状态。
   - `visual-fix` / `finding-waive` → 跳过已处理的 MA-id / finding-id，不重复修或问。
3. 遇到同类决策冲突（如 R-004 有两条 figma-priority，ts 不同）→ 取最新 ts 的，older 标 `superseded`。

### M3.4 与 work-item 的关系

- **work-item.json**：intake 阶段冻结的「需求快照 + 初始 scope + 初始依赖声明」，是基线。
- **runtime-decisions.jsonl**：运行时动态修正，是增量 patch。
- **reconcile-result.json**（B-2）：对账派生事实，绑定 headSha/dirtyHash。
- **latest-result.json**：verify 出口事实。

四者关系：`work-item（基线）+ runtime-decisions（修正）→ 有效输入 → reconcile → 对账结论 → verify → 出口判定`。

---

## M4：AutoPilot 主控循环（串联 M1/M2/M3）

### M4.1 完整流程（从 kickoff 到 delivery）

```
kickoff
  → 读 runtime-decisions（若重入）
  → PRD intake + multi-source conflict detection
    → 冲突? 查 M1 decision-matrix → auto / escalate
  → extract requirements + surfaces
  → coverage review
    → finding? classify severity → blocker/major auto-fix (M2) / nit batch-waive
  → scope approval (human)
  → implementation
    → surface reconcile loop:
        reconcile → missing/partial? → 写码 → re-reconcile
        → dependency blocked? mark pending, continue others (M1 api-dependency)
        → policyPaths 越界? auto-extend (M1 scope-boundary)
  → evidence collection
    → runtime critical path insufficient? auto-补 browser-interaction 或 escalate human-check (M2)
  → dev-check
    → fail? auto-fix (M2) → re-check
  → human acceptance
    → MA failed? classify → declarative-style auto-fix (M2) / complex escalate
    → 修复后 re-request acceptance
  → verify
    → enforced pass? → delivery commit (A7 guard)
    → fail/blocked? 回到对应环节修复
  → delivered
```

每个 `→` 节点都查 M1 decision-matrix，决定 auto / escalate。每个 fail/blocked 都进 M2 auto-disposition。每个 auto-action / escalate-resolution 都写 M3 runtime-decisions.jsonl。

### M4.2 "只在必要时问我" 的量化目标

定义**必要打断**（human-in-the-loop 必须）：

1. scope approval（human 签字，Phase 1 gate）。
2. stakeholder 需求冲突无历史决策可参考。
3. API blocked 且纯前端项 < 50%。
4. 人工验收视觉差异超出声明式样式范围。
5. 自动修复 2 轮后仍 blocker。
6. 安全 / 金额 / 权限 / 不可逆操作的变更。

其余场景（policyPaths 越界、nit finding、声明式样式修复、copy key 补全、环境启动失败、dependency 已就绪但未更新）全部 Agent 自主处理 + 写日志。

目标：单个中等需求（如 PR-02233 规模），人工打断次数从当前 15–20 次降到 3–5 次。

### M4.3 "不会卡死" 的守卫

- API blocked：只阻塞 affected surface，纯前端项继续（A6 已覆盖）。
- review finding 循环：最多 2 轮，然后 human-review-deferred（Phase 2 §5 已定）。
- auto-fix 循环：最多 2 轮，然后 escalate。
- escalate 无响应：超时（如 3 工作日）自动降级为 deferred 并继续可继续项（需新增 timeout 策略）。

---

## M5：与现有 Phase 的衔接

| 现有 Phase | M1/M2/M3/M4 如何衔接 |
|---|---|
| Phase 1 (P0) | M2 执行器在 A1/A4/A7 守卫 fail 后触发；M3 记录 pivot/defer 失效；M1 定义 API blocked 路由 |
| Phase 2 流程弹性 | M1 decision-matrix 覆盖 kickoff 兼容、deliveryScope 推导、Bugfix Lite 判据；M3 记录 scope-auto-extend |
| Phase 3 证据充分性 | M2 自动补 browser-interaction 或 escalate human-check；M1 定义 evidence insufficient 路由 |
| Phase 4 工程稳定 | M2 处理环境修复；M1 定义 import-protection 越 scope 归属；M3 记录基础设施改动 |

---

## M6：实现优先级（在 P0 之后分两批）

### 第一批（v3.9 minimal AutoPilot）

- M3 runtime-decisions.jsonl schema + 读取/应用（先手工写 JSONL 验证加载逻辑）
- M1.1 decision-matrix 核心 6 场景（figma-priority / policyPaths-extend / dto-insufficient / finding-nit/blocker / visual-qa-declarative）
- M2.1/M2.2 auto-disposition 框架 + 5 种白名单修复（policyPaths / 声明式样式 / copy key / DOM contract / Biome）
- M4.1 主控循环串联（手动触发各环节，验证 auto-fix → re-verify 链路）

验收：用 PR-02233 回放（假设从 MA-003 开始），断言 cursor 类修复不再需人工喂、policyPaths 越界自动扩、nit finding 批量 waive。

### 第二批（v4.0 full AutoPilot）

- M1.1 decision-matrix 补全剩余场景（multi-source / defer-invalidate / api-unblock / kickoff-ambiguity / acceptance-environment）
- M1.2 escalation 输出规范 + CLI `docs-tdd decide`
- M2.3 重试上限与降级 + M2.4 修复后验证链
- M4.2 打断次数监控 + M4.3 卡死守卫（escalate timeout 降级策略）
- 端到端 pilot：一个全新需求从 kickoff 到 delivery，记录实际打断次数与自主处理率

---

## 附：AutoPilot 达成度预估（落地后）

| 目标维度 | P0 后 | +M1/M2/M3 minimal | +M4 full | 说明 |
|---|---|---|---|---|
| 不会误报完成 | 95% | 95% | 95% | P0 已达成 |
| 不会漏需求 | 90% | 90% | 90% | P0 已达成 |
| 安全建分支 | 90% | 95% | 95% | Phase 4 机器拦截 |
| 完整理解来源 | 60% | 75% | 85% | M1 figma-priority + M3 记录冲突决策 |
| 只在必要时问 | 30% | 65% | 80% | M1 decision-matrix + M2 auto-fix |
| 验证→修复闭环 | 40% | 70% | 85% | M2 执行器 + M4 主控循环 |
| 不会卡死 | 70% | 80% | 90% | A6 + M1 blocked 路由 + M4 timeout 降级 |
| **综合 AutoPilot 度** | **55%** | **80%** | **90%** | P0 是安全底线，M minimal 达生产可用，M full 达设计目标 |

---

## 解锁编码前置（四阶段）

1. **P0 评审通过**（B-1/B-2/B-3 + 本 F 设计）→ 解锁 Phase 1 实现。
2. **P0 实现 + PR-02233 pilot 验证通过**（能拦对、不误报）→ 解锁 M1/M2/M3 minimal 实现。
3. **M minimal pilot 通过**（MA-003 类不再需人工喂）→ 解锁 M4 full 实现。
4. **M full 端到端 pilot 通过**（全新需求打断 ≤ 5 次）→ 宣布 AutoPilot 达成，进入生产使用。

> 当前状态：卡在第 1 阶段（P0 + F 设计评审）。本份与 B-1/B-2/B-3 一并评审后才开工。
