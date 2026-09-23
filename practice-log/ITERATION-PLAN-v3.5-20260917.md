# docs_tdd 系统优化与迭代计划（综合版·v2 修订）

> 来源：近几天真实项目实践记录，包括 PR-02233（PRACTICE-LOG-v3.1-20260912.md O-1~O-35）、hichat redirect_url bugfix（PRACTICE-LOG-v3.1-hichat-bugfix HB-1~HB-5）、TR-02386（PRACTICE-LOG-v3.3-TR-02386 TR-1~TR-4），以及既有 v3.1～v3.4 迭代记录。
>
> 状态：规划稿，暂不动业务代码与框架代码。本版对着 `common/engine/agent-scripts/` 现状核对过，逐项标注实现状态。
>
> 核心主题：从“流程发生过”升级为“交付事实可信”。
>
> 修订说明（2026-09-18）：
> - 每个优化项补「实现状态」标签：`[新增]` 引擎里没有对等能力；`[已存在待改]` 有代码但语义/覆盖不足；`[边界澄清]` 已有能力但要划清与新增项的界线，避免重复造。
> - P0 范围收紧：A2/A3/A5 是地基，A4/A6 次之，A1/A7 收口；证据类（Phase 3）和流程弹性（Phase 2）不与 P0 抢工。
> - 附「问题台账」章节（见附录），每条根因回链到具体 observation 编号，便于验收时逐条核对。
>
> 已核对的引擎现状（避免重复规划）：
> - `lib/fast-track-policy.mjs` 已存在，但它是 **v1 G-gate 的临时契约销账**机制（provisional 契约 → 约定 gate 销账），与本计划的 **Bugfix Lite（v2 轻档）无关**，二者不可合并。
> - 证据 kind 枚举（`lib/vnext-command-contract.mjs`）当前仅 `component-dom / pure-logic / copy-literal / directed-quality / touched-file-quality`，**无** `structural` / `quality` / `human-check` —— D2/D1 属实是新增。
> - 引擎中搜不到 `human-override` / `begin-implementation` —— C1 / O-24 属实缺失。
> - 引擎中无独立的 surface→code 对账、consumer wiring、pivot invalidation 实现 —— A2 / A3 / A5 属实是新增。

---

## 一、总体判断

近几天暴露的问题看似分散在 PRD 抽取、独立审查、deliveryScope、evidence plan、API pending、worktree、typecheck、rule release、bugfix 流程和 Agent 交付表述等环节，但根本问题可以收敛为四类。

### 1. 系统能记录流程发生过，但还不能充分证明业务已经完成

目前系统可以证明：

- 创建了 work-item；
- 有 requirement；
- 有 surface；
- 有 evidence command；
- 命令执行成功；
- 有组件文件；
- 有测试文件；
- 有部分页面改动。

但这些事实仍不足以证明：

- 目标应用已经实现；
- 目标页面已经接入；
- 用户可以真实触发核心交互；
- 所有本期 surface 都已覆盖；
- 当前结果可以进入人工验收；
- 当前结果可以正式交付。

PR-02233 中“局部实现被误报为整批完成”的事故，就是这个问题的集中表现。

### 2. 需求建模和审查投入较多，实现对账投入不足

现有流程已经有：

```text
PRD intake
→ 原子需求抽取
→ 确定性 coverage audit
→ 独立冷读审查
→ scope approval
→ evidence plan
→ verify
```

但缺少同等强度的：

```text
目标应用确认
→ surface 与代码落点对账
→ provider 与 consumer 对账
→ requirement 与真实运行路径对账
→ 证据强度与业务结论对账
→ 未完成项与依赖边界对账
```

下一阶段应把重点从：

> 需求有没有被审查过

逐步转向：

> 当前代码是否真的完成了被批准的需求。

### 3. 审查、证据和人工判断边界不够清楚

实践证明：

- 机械缺陷应由确定性自查解决；
- 需求覆盖遗漏应由抽取清单和结构化核对解决；
- 独立审查只适合补充语义盲点；
- 无限增加审查轮次不能保证质量，反而会增加模型误报和流程成本；
- 人工授权、人工验收和人工申诉不能只停留在对话记录中。

### 4. 不同需求类型的流程重量还不够匹配

已定位单点 bug、大型跨页面新功能、纯文案、局部样式和行为不变的重构，不应默认走完全相同的流程。

需要正式建立：

- Bugfix Lite；
- 纯文案 / locale / 样式微调路径；
- 行为不变重构路径；
- 高风险 bug 自动升级；
- 目标应用 pivot 后重新建立事实。

---

## 二、优化目标

### 目标 A：交付真实性

任何“完成”“进入验收”“可提测”的结论，都必须能够追溯到：

```text
requirement
→ surface
→ code location
→ consumer wiring
→ evidence
→ 当前 HEAD / dirty hash
```

### 目标 B：状态一致性

以下状态必须保持一致：

- work-item 状态；
- 当前代码状态；
- evidence receipt；
- latest-result；
- Agent 对外描述；
- commit / checkpoint 状态。

不能出现：

```text
代码只完成一部分
work-item 显示 implementing
Agent 却说开发完成
```

### 目标 C：证据充分性

系统不仅要检查：

```text
有没有命令
```

还要检查：

```text
这条命令是否足以支撑绑定的业务结论
```

### 目标 D：流程适配性

不同需求按风险、规模和影响面选择不同流程：

```text
流程重量 = 需求复杂度 × 业务风险 × 影响面
```

### 目标 E：Agent 操作安全

在修改业务代码之前，尽量提前拦截：

- 错分支；
- 错 worktree；
- 错目标应用；
- 覆盖已有文件；
- 使用错误证据；
- 把阶段性状态说成完成；
- 使用全量命令冒充 scoped 命令。

---

## 三、目标工作流

优化后的理想流程：

```text
需求类型识别
    ↓
风险与流程分档
    ↓
确认仓库 / worktree / branch / target app
    ↓
需求 intake 与源事实冻结
    ↓
确定性抽取自检
    ↓
人工需求覆盖核对
    ↓
有限轮次独立语义审查
    ↓
人工授权 / scope 定稿
    ↓
实现
    ↓
实现中期 check
    ├─ changed paths
    ├─ surface → code
    ├─ provider → consumer
    ├─ dependency blast radius
    ├─ locale / branch / command guard
    └─ scoped checks
    ↓
证据执行
    ├─ pure logic
    ├─ contract
    ├─ DOM
    ├─ browser interaction
    ├─ human check
    └─ structural / quality
    ↓
requirement ↔ surface ↔ code ↔ evidence 对账
    ↓
verify
    ↓
checkpoint commit 或 delivery commit
```

最关键的变化是：

> 实现中期不再直接从“开始编码”跳到“最终 verify”，中间必须有正式的差异检查和完成度对账。

---

# 四、版本规划

## Phase 1：v3.5——交付真实性

### 目标

解决 PR-02233 事故类问题：

> 防止局部实现、组件存在、测试通过被误报为整批完成。

这是最高优先级阶段。

### 1. A2：surface → code 对账基元　`[新增]`

> 回链：O-35 直接原因 3/6、O-34（误报整批完成）。引擎当前只有 `lib/requirement-coverage.mjs` 做需求↔surface 计数一致性，没有 surface↔真实代码落点的对账。这是本轮唯一的地基项，其余对账（A3/A5/A6/A4）都依赖它。

为每个 `disposition=implement` 的 surface 建立真实代码落点。

每个 surface 至少需要一种 locator：

```text
path-prefix
symbol
component
hook
route
test
browser-scenario
```

对账结果分为：

```text
covered
partially-covered
missing
stale
not-applicable
human-confirmed
```

以下内容只能作为线索，不能直接关闭 surface：

- 文件存在；
- 组件名存在；
- 字符串存在；
- 测试文件存在；
- 任意相关文件被修改。

### 2. A3：provider / consumer 分离　`[新增]`

> 回链：O-35 直接原因 3、O-34。事故核心正是「`SwitchVerifyMethodDialog` 类 provider 存在」被外推成「Login/Register/ResetPassword consumer 已接入」。

区分：

```text
能力实现
```

和：

```text
业务页面真实接入
```

例如：

| 类型 | 示例 |
|---|---|
| provider | `SwitchVerifyMethodDialog` |
| provider | `resolveVerifyMethods` |
| consumer | Login 页面 import 并渲染 |
| consumer | Register 点击入口打开弹窗 |
| consumer | ResetPassword 选择后切换输入区 |

只有 provider 和 consumer 都满足，相关业务 surface 才能标记为完成。

### 3. A5：pivot invalidation　`[新增]`

> 回链：O-35 直接原因 1、O-12（web / web-next 双应用需显式判定）。目标从 apps/web 切到 apps/web-next 后旧完成度未归零，是事故第一诱因。

当以下内容变化时，自动使旧完成度失效：

- `apps/web` → `apps/web-next`；
- route 改变；
- delivery target 改变；
- 主应用改变；
- policy path 改变；
- worktree 改变；
- 目标仓库改变。

失效内容包括：

```text
implementation status
evidence receipt
browser result
surface mapping
acceptance result
```

目标切换后，旧目标结果只能保留为历史事实，不得继续作为新目标完成度。

### 4. A6：依赖影响半径　`[已存在待改]`

> 回链：O-29（API pending 被误当实现停止条件）、O-35 直接原因 4。引擎已有 `lib/vnext-source-readiness.mjs` 和 `lib/blockers.mjs` 表达 pending，但粒度是项目级；需下沉到 requirement/surface 级，区分 implementation-blocking 与 integration-pending。这是「改造已有能力」，不是从零起。

把 `pending-dependency` 从项目级阻塞改为 requirement / surface 级阻塞。

每个依赖必须记录：

- 依赖来源；
- 影响的 requirement；
- 影响的 surface；
- 阻塞阶段；
- 不阻塞阶段；
- 解除条件；
- 当前 mock 或 fixture；
- 是否影响正式交付。

结果应类似：

```text
integration-pending:
  S-014: blocked by real cooldown timestamp
  S-015: blocked by backend rate-limit enum

still-implementable:
  S-001 ~ S-013
  UI switch flow
  countdown behavior
  error presentation
```

不允许再使用：

```text
等待 API，所以整批不能继续
```

### 5. A4：runtime critical path　`[已存在待改]`

> 回链：O-17（browser adapter 已可执行）、O-18、O-35 直接原因 5/6。引擎已有 `lib/playwright-mcp-adapter.mjs`（真实可 spawn 的 MCP 浏览器适配器）和 `vnext-manual-test.mjs`；缺的是「PRD 写了动作→结果就强制绑定 runtime 证据」的门禁规则，而非适配器本身。

凡是 PRD 写出“动作 → 结果”的交互，都必须有真实运行路径证据。

最低证据结构：

```text
precondition
action
visible result
state/data side effect
negative case
```

以验证方式切换为例，至少应能验证：

```text
绑定 ≥ 2 种验证方式
→ 切换入口出现
→ 点击入口
→ 弹窗打开
→ 仅展示已绑定方式
→ 正确排序
→ 当前方式高亮
→ 关闭后不切换
→ 选择后输入区切换
→ 单绑定时入口隐藏
```

证据来源可以是：

- browser-interaction；
- human-check；
- 必要时二者结合。

源码静态检查不能关闭 runtime critical path。

### 6. A1：完成用语双层门　`[新增]`

> 回链：O-35（把流程状态当交付状态）、O-34。这是纯新增的话术约束层，依赖 A2~A4 的对账结果作为放行条件。

#### 机器层

没有满足条件时，系统输出受控词：

```text
partial
implementation-incomplete
pending-evidence
integration-pending
not-ready-for-acceptance
```

#### 规则层

未满足条件时禁止自然语言使用：

- 开发完成；
- 全部接入；
- 已进入人工验收；
- 已可提测；
- 已完成迁移。

至少满足以下条件后，才允许进入完成或验收类表述：

- 所有本批次 implement surface 已对账；
- 关键 consumer 已接入；
- runtime critical path 已验证；
- 当前证据与 HEAD / dirty hash 一致；
- API pending 仅剩允许延期的集成项；
- 当前 latest-result 为有效 PASS。

### 7. A7：提交摘要真实性　`[已存在待改]`

> 回链：O-35 迭代项 9（ff7020c0b6 提交标题 overclaim）。引擎已有 `vnext-commit.mjs` / `vnext-delivery-guard.mjs`；A7 是在 delivery commit 路径上加 commit message ↔ 未落盘 surface 的 overclaim 检查，复用现有 guard 挂载点。

如果 commit message 声称：

```text
complete login verification flow
migrate auth flow
finish all register pages
```

但核心 surface 未实现，系统应：

- 提示 overclaim；
- 要求收窄 commit message；
- 或补齐实现；
- delivery commit 时直接阻断。

### Phase 1 验收标准

至少验证以下场景：

#### 场景 A：组件已写，页面未接入

```text
provider = covered
consumer = missing
overall = incomplete
```

#### 场景 B：旧应用有实现，目标切换到新应用

```text
old result = stale
new target = uncovered
```

#### 场景 C：API 只阻塞部分 surface

```text
API-dependent surfaces = pending
pure frontend surfaces = still required
```

#### 场景 D：有静态测试，没有真实交互

```text
evidence exists
claim strength insufficient
runtime evidence required
```

---

## Phase 2：v3.6——流程分档与审查收敛

### 目标

解决流程过重、状态迁移不完整和审查不收敛的问题。

### 1. Bugfix Lite　`[新增]`

> 回链：HB-1（v3.1 缺轻量通道）、HB-2（需求类型→流程重量路由不明）。注意：与已有的 `lib/fast-track-policy.mjs`（v1 G-gate 临时契约销账）是两回事，不可合并；Bugfix Lite 是 v2 侧轻档。

#### 适用条件

同时满足：

- 已定位根因；
- 根因能定位到文件 / symbol / 代码位置；
- 改动范围小；
- 不引入新的业务需求语义；
- 不触及高风险业务边界；
- 有明确回归方式。

#### 流程

```text
确认项目类型
→ 确认 branch / worktree
→ 记录现象
→ 记录根因
→ 记录修复点
→ 定点回归
→ 绑定内容 hash
→ bugfix verify
```

#### 必须记录

- 现象；
- 预期；
- 实际；
- 根因；
- 修改文件；
- 边界条件；
- 回归命令；
- 分支；
- 基线；
- touched content hash；
- 待确认的产品语义。

#### 自动升级完整流程的情况

涉及以下任一项时，不走 Lite：

- 资金；
- 权限；
- 登录 / 鉴权；
- 密码；
- 数据删除；
- 生产数据一致性；
- 跨应用行为；
- 产品预期不明确；
- 影响范围无法收敛。

### 2. kickoff 兼容性　`[已存在待改]`

> 回链：TR-1（预存项目目录被误判 v1 静默走旧通道）。引擎已有 kickoff 逻辑（`lib/workflow-version.mjs`），需修正「目录存在+无 workflowVersion → 静默降级 v1」的分支。

预存在项目目录但缺少版本信息时，不得静默降级 v1。

推荐策略：

```text
目录存在 + 无 workflowVersion
→ 输出明确诊断
→ 默认建议 v2
→ 若检测到 legacy 文件，要求人工确认
```

错误信息应直接解释：

- 当前目录为什么无法判断版本；
- v1 / v2 的差别；
- 如何选择；
- 不应继续自动走哪条路径。

### 3. C1：人工 override / begin implementation　`[新增]`

> 回链：O-24（用户授权进入实现后 v2 持久状态仍停 intake/pending）。引擎搜不到 human-override / begin-implementation，属实缺失。

支持以下正式动作：

```text
scope-approve --human-override --reason
begin-implementation --reason
review-defer --reason
accept-incomplete-scope --reason
```

人工授权写入：

- 操作人；
- 时间；
- HEAD；
- dirty hash；
- 当前 scope；
- 偏离的自动规则；
- 后续补偿条件。

### 4. deliveryScope 自动推导　`[已存在待改]`

> 回链：TR-3（bounded-batch 在无延期项时无法自洽）、O-14/O-16/O-32（includedRequirementIds 语义反直觉 + deferred-finding 耦合）。引擎已有 `lib/vnext-delivery-scope.mjs`，需修复空剩余/不强迫 reviewer 伪造 deferred finding。

由以下信息自动生成批次边界：

```text
requirement.status
surface.disposition
deferred.owner
deferred.batch
not-doing reason
```

无延期项目推荐：

```json
{
  "deliveryScope": {
    "mode": "full-batch",
    "deferred": null
  }
}
```

有延期项目可以是：

```json
{
  "deliveryScope": {
    "mode": "bounded-batch",
    "implementedRequirementIds": [],
    "deferred": {
      "owner": "app-team",
      "batch": "APP-2026-Q4",
      "reason": "out-of-scope"
    }
  }
}
```

不要再要求：

- 手工列出全部 requirement ID；
- reviewer 自发生成 deferred boundary finding；
- 无延期项目凑出一个延期项。

### 5. 审查 finding 分级　`[新增]`

> 回链：TR-审查循环摩擦3（finding 无严重度分级，nit 与实质缺陷同权阻断）、O-22/O-23（把审查当主质检手段）。

增加：

```text
blocker
major
nit
```

处理原则：

| 类型 | 处理方式 |
|---|---|
| blocker | 必须关闭 |
| major | 必须修复或人工接受 |
| nit | 可以批量 deferred |
| false-positive | 进入申诉 / 反证流程 |

审查最多自动运行两轮。超过后进入：

```text
human-review-deferred
```

不允许无限追求“零 finding”。

### 6. 跨 client 复审　`[已存在待改]`

> 回链：TR-审查循环摩擦2（指纹未变时 review 直接拒绝，换 client 也不行）。引擎已有 `lib/vnext-review-policy.mjs` 控制重试，需放宽 unchanged-fingerprint 的跨 client 复审。

candidate fingerprint 未变化时，仍应允许：

```text
换 reviewer client
换模型
换审查策略
```

但必须记录：

- 原审查；
- 新审查；
- 复审原因；
- 是否消耗自动轮次；
- 是否属于人工 override。

### 7. extract 重跑保护　`[已存在待改]`

> 回链：TR-审查循环摩擦1（extract 重跑把 sealed coverageAudit 重置为 stub，findings 丢失）。引擎已有 `vnext-extract.mjs`，需在存在未裁决 finding 时拒绝静默覆盖。

如果存在未裁决 finding，`extract` 应：

- 给出强警告；
- 默认拒绝覆盖；
- 或要求显式 `--force`；
- 自动保存当前 audit；
- 提示正确顺序。

推荐顺序：

```text
review
→ adjudicate
→ extract / modify
→ review-resume
```

### Phase 2 验收标准

至少验证：

- 已定位低风险 bug 不进入完整 PRD 流程；
- 高风险 bug 自动升级；
- 人工授权能推动状态；
- 无延期项目不需要伪造 deferred finding；
- 审查两轮后可以稳定进入人工裁决；
- nit 不再阻断整个实现；
- extract 不会静默覆盖未裁决审查结果。

---

## Phase 3：v3.7——证据表达力与确定性规则执行

### 目标

解决：

> 证据存在，但不足以证明业务结论。

### 1. D1：human-check 一等 producer　`[新增]`

> 回链：O-30（人工 check 没有一等 evidence producer，逼迫 browser command 过度归因）。证据 kind 枚举无 human-check，属新增。

人工检查直接成为 requirement 的证据来源：

```text
producer: human
kind: human-check
```

人工证据包括：

- 步骤；
- 预期；
- 实际；
- 通过 / 不通过；
- 操作人；
- 时间；
- HEAD / dirty hash；
- 截图或录屏；
- 未通过项。

### 2. D2：增加 structural / quality evidence　`[新增]`

> 回链：TR-审查循环摩擦4（evidencePlan.type 受 EVIDENCE_TYPES 枚举限制，结构检查无合法挂法）。已核实：`lib/vnext-command-contract.mjs` 枚举无 structural/quality。

将结构性检查从功能证据中分离：

```text
component-dom
pure-logic
api-contract
browser-interaction
human-check
structural
quality
```

例如：

- 文件行数；
- 命名；
- 是否存在特定导出；
- 是否存在重复实现；
- 是否满足目录约束；
- 是否通过 lint / format。

Biome 和 typecheck 不应自动归类为业务功能证据。

### 3. D3：claim-to-assertion 强度审计　`[新增]`

> 回链：O-31（确定性 audit 只检查存在性，不能识别过度声明）。

检测：

- 一条命令绑定过多 requirement；
- 一条命令绑定过多 surface；
- 字符串断言证明完整交互；
- mock 信封证明 UI 行为；
- provider 证据证明 consumer 完成；
- 通用测试证明特定业务路径。

输出：

```text
overclaim-warning
overclaim-error
```

建议初期采用：

- warning：要求人工确认；
- error：绑定范围明显不合理时阻断。

### 4. D4：scoped command 展开检查　`[新增]`

> 回链：O-33（scoped test 经 package script 展开后意外跑全套）。

解析：

- package.json scripts；
- workspace scripts；
- shell 包装；
- 默认目录；
- glob；
- wildcard；
- 隐含测试入口。

只有明确运行目标文件的命令，才可标记为 scoped。

### 5. E1：locale guard　`[新增]`

> 回链：O-27（已有 i18n 仓库规则被执行过程遗漏，需确定性拦截）。注意：规则正文已在仓库 AGENTS.md，本项只加确定性守卫，不复写规则。

普通业务任务默认只允许修改：

```text
zh-CN
zh_CN
```

命中其他 locale 时：

- 普通任务直接失败；
- 国际化任务必须显式声明；
- 由对应任务类型或人工授权放行。

### 6. baseline-aware typecheck　`[新增]`

> 回链：O-26（全量 typecheck 基线噪声过大，v2 需本次改动差分判定）。

最终同时输出：

```text
whole-command-status
baseline-errors
new-errors
touched-file-errors
```

例如：

```text
whole-command: failed
baseline-errors: 42
new-errors: 0
touched-file-errors: 0
```

不能把全量存量错误直接等同于本次改动失败。

### Phase 3 验收标准

至少验证：

- 人工检查可以独立绑定 requirement；
- mock 证据和 UI 证据不能混淆；
- 大范围 overclaim 可以被提示或阻断；
- scoped test 不会误跑全套；
- 存量 typecheck error 与新增 error 分离；
- 普通任务修改非中文 locale 会被拦截。

---

## Phase 4：v3.8——工程稳定性与维护治理

### 目标

降低框架本身和 Agent 操作造成的事故。

### 1. Agent 开工前置门　`[部分已存在待扩展]`

> 回链：HB-4（未先切分支直接在 online commit）。已核实：lark-bot 侧已有 `lib/lark-command.mjs` resolveWorkContext 等机器强制前置层；**交互式 agent 没有对等前置门**（HB-4 发现 1）。本项是把前置检查从机器侧补到交互侧。git-branch-flow.md §1.2 已写入规则，缺的是机器拦截。

所有交互式 Agent 开工前确认：

```text
当前仓库
当前 worktree
当前 branch
目标项目
目标应用
是否有其他 WIP
baseRef
commit 权限
```

禁止在以下分支直接改业务代码：

```text
online
pre
test
dev
```

人类 / Agent 使用：

```text
feature/<ID>
fix/<ID>
```

lark-bot 使用：

```text
hotfix/<ID>-<suffix>
```

继续作为机器人隔离草稿分支，不做重命名迁移。

### 2. 文件覆盖防护　`[新增]`

> 回链：HB-5（write 覆盖了已存在的 thirdConfig.test.ts）。

对“新增测试”或“新增文件”动作：

```text
先确认文件不存在
→ 检查 git tracked
→ 读取现有文件
→ 已存在使用 edit
→ 不存在才使用 write
```

若工具层可支持，`write` 覆盖已存在文件时直接警告或要求确认。

### 3. symlink 主模块守卫　`[新增]`

> 回链：O-7（main-module 守卫经软链调用失效，脚本静默空跑）。

统一处理：

- `import.meta.url`；
- `argv[1]`；
- symlink；
- cwd；
- direct execution。

要求：

- 软链执行不能静默空跑；
- 入口判断失败时有明确输出；
- self-test 覆盖真实和软链路径。

### 4. policy / engine 指纹分离　`[已存在待改]`

> 回链：O-4（日志进 common/ 污染发布指纹）、O-9（纯引擎改动也把 rule-release 弄 stale）；`rule-release.mjs` 注释自述与实现矛盾。引擎已有 `classifyRuleFile` 区分 engine/policy，需把发布指纹真正按类拆开。

建议拆分：

```text
policyFingerprint
engineFingerprint
templateFingerprint
```

policy 改动：

- 触发规则 release；
- 更新政策版本；
- 影响项目规则基线。

engine 改动：

- 运行 self-test；
- 运行 golden；
- 更新引擎版本；
- 不直接阻断所有项目的 context / gate。

### 5. practice-log 正式约定　`[新增]`

> 回链：HB-3/O-4（实践日志无并发写策略，多会话易互相覆盖）。

建议固定：

```text
practice-log/
  PRACTICE-LOG-<version>-<topic>.md
  observations.jsonl
  ITERATION-PLAN-<version>-<date>.md
```

规则：

- 不放 `common/`；
- 不进入 policy fingerprint；
- 一次会话一个 Markdown 日志；
- 结构化观察用 JSONL 追加；
- 不允许多个会话同时覆盖同一 Markdown；
- 迭代计划统一汇总问题；
- 已落地内容进入 CHANGELOG；
- 未落地内容进入 backlog。

---

# 五、跨 Phase 的共性设计原则

## 1. 机器状态、代码事实、证据和话术必须同源

目标关系：

```text
work-item
  ↓
机器状态
  ↓
代码对账
  ↓
证据结果
  ↓
交付摘要
```

Agent 的自然语言只能解释机器事实，不能替代机器事实。

## 2. 区分实现完成和验收完成

建议至少使用以下状态：

```text
not-started
scoped
approved
implementing
partially-implemented
implementation-complete
integration-pending
ready-for-human-acceptance
delivery-ready
delivered
```

其中：

- `implementation-complete`：代码层面已完成；
- `integration-pending`：依赖真实 API 或外部环境；
- `ready-for-human-acceptance`：核心运行路径已可验证；
- `delivery-ready`：正式 verify PASS；
- `delivered`：完成提交 / 合入等交付动作。

不能用一个 `implementing` 或 `done` 覆盖全部含义。

## 3. 依赖必须局部化

任何 blocker 都必须回答：

```text
阻塞哪条 requirement？
阻塞哪个 surface？
阻塞哪个阶段？
不阻塞哪些实现？
解除条件是什么？
```

## 4. 审查不是事实来源

Reviewer 只能提供独立语义意见，不能直接改变：

- 原始需求；
- 代码事实；
- surface 实现状态；
- evidence receipt；
- 最终交付结论。

模型发现必须经过：

```text
原始 source 核验
→ 确定性检查
→ 人工裁决
```

---

# 六、实施顺序

## 第一批：先完成 P0 真实性基础

推荐顺序：

```text
A2 surface → code
→ A3 provider / consumer
→ A5 pivot invalidation
→ A6 dependency blast radius
→ A4 runtime critical path
→ A1 completion-language guard
→ A7 commit summary guard
```

原因：

- A2 是所有后续对账的基础；
- A3 直接针对“组件完成但页面未接入”；
- A5 解决目标应用切换造成的旧事实污染；
- A6 解决 API pending 被泛化；
- A4 解决核心交互无法触发；
- A1 / A7 最后收紧交付表达和提交边界。

## 第二批：再做流程弹性

```text
Bugfix Lite
→ kickoff 兼容
→ human override
→ deliveryScope 自动推导
→ finding severity
→ 跨 client 复审
→ extract 重跑保护
```

## 第三批：增强证据

```text
human-check
→ structural / quality evidence
→ claim-to-assertion audit
→ scoped command 展开
→ baseline-aware typecheck
→ locale guard
```

## 第四批：工程治理

```text
开工前置门
→ write 覆盖防护
→ symlink 守卫
→ policy / engine fingerprint 分离
→ practice-log 并发机制
→ 文档和错误提示整理
```

---

# 七、真实项目 Pilot

不能只靠 golden fixture，必须使用真实项目验证。

## Phase 1 Pilot：PR-02233

重点验证：

- `apps/web` → `apps/web-next` pivot；
- Login / Register / ResetPassword consumer wiring；
- API pending 局部阻塞；
- `SwitchVerifyMethodDialog` 运行时路径；
- “局部实现误报整批完成”回归。

## Phase 2 Pilot：hichat bugfix + TR-02386

hichat 验证：

- Bugfix Lite；
- 分支前置；
- 定点回归；
- 产品预期差异记录；
- 不进入完整需求抽取。

TR-02386 验证：

- 预存项目目录；
- v1/v2 路由；
- deliveryScope；
- 审查 finding 分级。

## Phase 3 Pilot

选择一个同时包含以下内容的真实需求：

- 自动 API mock；
- UI 运行时交互；
- 人工视觉检查；
- 结构性检查；
- 全量 typecheck 存量错误。

## Phase 4 Pilot

使用真实软链工作区和并发实践日志验证：

- 开工上下文；
- 软链脚本直接执行；
- 文件覆盖防护；
- practice-log 并发写入。

---

# 八、量化验收指标

## 交付真实性

目标：

```text
false-completion = 0
ready-for-acceptance 时 missing implement surface = 0
ready-for-acceptance 时 missing consumer wiring = 0
```

## 审查效率

目标：

```text
机械性缺陷在 Reviewer 前被发现
平均自动审查轮次 ≤ 2
超过两轮必须转人工
审查误报不会直接改变代码状态
```

## 证据质量

目标：

```text
每个 implement surface 有直接证据
runtime critical path 覆盖率 = 100%
过度绑定 evidence command 数量下降
mock evidence 与 UI evidence 不混淆
```

## 工程稳定性

目标：

```text
online 直接改动次数 = 0
已有文件被 write 覆盖次数 = 0
软链脚本静默空跑次数 = 0
engine 改动造成无关规则阻断次数 = 0
```

---

# 九、明确不做的事情

本轮不建议：

1. 继续增加独立审查轮数；
2. 先做大范围破坏性 schema 重构；
3. 把所有人工判断都强行自动化；
4. 通过复制更多文档来“加强规则”；
5. 把所有 API pending 都当成实现阻塞；
6. 让每个 commit 都必须具备最终 delivery PASS；
7. 为了追求零 finding 而牺牲实际研发效率。

---

# 十、版本路线总结

## v3.5：交付真实性

核心问题：

> 这批代码是否真的完成了这批需求？

重点：

- surface → code；
- provider / consumer；
- pivot invalidation；
- dependency blast radius；
- runtime critical path；
- completion-language guard；
- commit summary guard。

## v3.6：流程弹性

核心问题：

> 这类需求是否走了合适重量的流程？

重点：

- Bugfix Lite；
- human override；
- kickoff 兼容；
- deliveryScope 自动推导；
- finding severity；
- 审查轮次和复审；
- extract 重跑保护。

## v3.7：证据可信

核心问题：

> 这条证据是否足以支持这个业务结论？

重点：

- human-check；
- structural / quality evidence；
- claim-to-assertion audit；
- scoped command 展开；
- baseline-aware typecheck；
- locale guard。

## v3.8：工程稳定

核心问题：

> Agent 和框架本身是否足够不容易犯低级错误？

重点：

- 开工前置门；
- 文件覆盖防护；
- symlink 守卫；
- policy / engine fingerprint 分离；
- practice-log 并发治理；
- 多消费仓适配。

---

# 十一、核心结论

1. 下一轮第一优先级不是继续加强审查，而是建立实现完成度对账。
2. “组件存在”必须和“业务页面真实消费”分开。
3. API pending 只能阻塞对应集成面，不能成为整批未完成的统一借口。
4. 只有机器状态、代码事实、证据强度和交付话术四者一致，才允许进入人工验收或正式交付。
5. `surface → code` 是后续 consumer wiring、pivot invalidation、依赖影响半径、runtime readiness 和交付话术约束的共同地基。
6. 规则写出来、AI 读过，不等于规则被执行；优先级应是：

```text
确定性检查 > 状态机约束 > 证据对账 > Agent 提示 > 文档说明
```

本计划完成后，下一步不是立即写代码，而是先完成：

- v3.5 问题台账定稿；
- 四个真实案例的预期行为定义；
- P0 各项的 schema / 状态迁移草图；
- 每项对应的 golden fixture 和失败案例；
- 再进入分 Phase 实现。

---

# 附录 A：问题台账（observation → 优化项 → 实现状态）

> 用途：验收时逐条核对。每条来自真实实操日志的观察，映射到本计划的优化项，并标注引擎当前是否已有对等能力。

## A.1 交付真实性（Phase 1 / v3.5）

| 观察 | 现象摘要 | 优化项 | 实现状态 |
|---|---|---|---|
| O-34 / O-35 | 局部实现被误报为整批完成，核心 PRD 路径未实现即宣称进入人工验收 | A2+A3+A4+A1+A7 合力 | 见下各行 |
| O-35 因 3/6 | surface 无强制真实代码落点；证据存在性替代 claim 充分性 | A2 surface→code | 新增 |
| O-35 因 3、O-34 | provider 存在被外推成 consumer 已接入 | A3 provider/consumer | 新增 |
| O-35 因 1、O-12 | 目标 apps/web→apps/web-next pivot 后旧完成度未归零 | A5 pivot invalidation | 新增 |
| O-29、O-35 因 4 | API pending 被泛化为整批停止条件 | A6 dependency blast-radius | 已存在待改（source-readiness/blockers 有项目级 pending） |
| O-17、O-18、O-35 因 5/6 | 缺「动作→结果」的运行时路径强制证据 | A4 runtime critical path | 已存在待改（playwright-mcp-adapter 已可执行） |
| O-35 迭代项 6 | 无完成用语硬前置条件 | A1 completion-language guard | 新增 |
| O-35 迭代项 9 | 提交标题 overclaim 无拦截 | A7 commit summary guard | 已存在待改（vnext-commit/delivery-guard） |

## A.2 流程弹性与审查收敛（Phase 2 / v3.6）

| 观察 | 现象摘要 | 优化项 | 实现状态 |
|---|---|---|---|
| HB-1 / HB-2 | 已定位 bug 被迫走 v2 重流程或更重的 --legacy | Bugfix Lite | 新增（勿与 fast-track-policy 混） |
| TR-1 | 预存项目目录无 workflowVersion 被静默降级 v1 | kickoff 兼容 | 已存在待改（workflow-version.mjs） |
| O-24 | 用户授权进实现后 v2 持久状态仍停 intake/pending | C1 human-override/begin-implementation | 新增 |
| TR-3 / O-14 / O-16 / O-32 | bounded-batch 无延期项无法自洽；includedRequirementIds 语义反直觉 | deliveryScope 自动推导 | 已存在待改（vnext-delivery-scope.mjs） |
| 审查摩擦 3、O-22、O-23 | finding 无严重度分级；审查被当主质检 | finding severity + 轮次上限 | 新增 |
| 审查摩擦 2 | 指纹未变时换 client 复审被拒 | 跨 client 复审 | 已存在待改（vnext-review-policy.mjs） |
| 审查摩擦 1 | extract 重跑把 sealed audit 重置，findings 丢失 | extract 重跑保护 | 已存在待改（vnext-extract.mjs） |
| O-21 | 审查模型事实性误报无申诉通道 | finding 申诉/反证 | 新增 |

## A.3 证据可信（Phase 3 / v3.7）

| 观察 | 现象摘要 | 优化项 | 实现状态 |
|---|---|---|---|
| O-30 | 人工 check 无一等 producer，逼迫 browser command 过度归因 | D1 human-check producer | 新增 |
| 审查摩擦 4 | evidencePlan.type 枚举无 structural/quality，结构检查无合法挂法 | D2 structural/quality evidence | 新增（已核实枚举缺失） |
| O-31 | 确定性 audit 只检查存在性，不能识别过度声明 | D3 claim-to-assertion audit | 新增 |
| O-33 | scoped test 经 package script 展开意外跑全套 | D4 scoped command 展开 | 新增 |
| O-27 | 已有 i18n 规则被执行遗漏，改了 9 个非中文 locale | E1 locale guard | 新增（规则正文留仓库 AGENTS.md） |
| O-26 | 全量 typecheck 基线噪声过大 | baseline-aware typecheck | 新增 |

## A.4 工程稳定（Phase 4 / v3.8）

| 观察 | 现象摘要 | 优化项 | 实现状态 |
|---|---|---|---|
| HB-4 | 交互式 agent 无开工前置门，误在 online 直接 commit | Agent 开工前置门 | 部分已存在待扩展（lark-bot 有 resolveWorkContext，交互侧缺机器拦截） |
| HB-5 | write 覆盖了已存在文件 | 文件覆盖防护 | 新增 |
| O-7 | main-module 守卫经软链失效，脚本静默空跑 | symlink 守卫 | 新增 |
| O-4 / O-9 | 日志/纯引擎改动污染 rule-release 发布指纹 | policy/engine 指纹分离 | 已存在待改（classifyRuleFile 已分类但指纹仍全算） |
| HB-3 / O-4 | 实践日志无并发写策略 | practice-log 正式约定 | 新增 |
| O-1 / O-5 | 缺显式 config 静默用默认；版本命名撞车致误解 | doctor/CLI 文案澄清 | 已存在待改（文案层） |
| O-8 | inbox 源变了 run 不重新归一化快照 | resync-sources 命令 | 新增（未进 Phase，记为 backlog） |
| O-11 | 飞书 markdown/HTML 表全归成 text unit | source-units 表识别 | 新增（未进 Phase，记为 backlog） |
| O-6 | 图片 intake 假 local + 内嵌图未鉴权下载 | 已治本 | 已完成（O-6 处置：lark-prd-drift/sync-lark-docs 已改） |
| O-15 | 大 PRD 独立审查超默认 5 分钟超时 | 审查超时/多模态负载 | 已存在待改（review timeout 可配） |

## A.5 已落地/已闭合，不重复规划

- O-6 图片 intake 治本：已改 `lib/lark-prd-drift.mjs` + `sync-lark-docs.mjs`，magic-byte 校验 + 鉴权下载，golden 全绿。
- O-17 browser adapter：`lib/playwright-mcp-adapter.mjs` 已封装并实测可执行；A4 只需在其上加门禁规则，不重造适配器。
- HB-4 分支 taxonomy：`git-branch-flow.md §1.1/§1.2` 已写入三前缀定义与交互 agent 开工前置门规则；Phase 4「开工前置门」补的是机器拦截，不是规则文档。

---

# 附录 B：实施前必须先产出的中间物（不动代码）

按第十版结论，进入编码前先完成以下四份，作为每个 P0 项的验收基线：

1. **四个真实案例的预期行为定义**（PR-02233 pivot+consumer wiring / hichat Bugfix Lite / TR-02386 kickoff+deliveryScope / 一个证据充分性案例）——每个写清「输入状态 → 期望机器输出 → 期望被拦截的错误话术」。
2. **P0 各项 schema / 状态迁移草图**：A2 的 surface locator 与对账结果枚举（covered/partially-covered/missing/stale/not-applicable/human-confirmed）；A3 的 provider/consumer 标记；A5 的 pivot 失效字段；work-item 新状态机（not-started…delivered）。
3. **每项 golden fixture + 失败案例**：至少覆盖 Phase 1 验收标准的场景 A/B/C/D。
4. **优先级执行序确认**：A2 → A3 → A5 → A6 → A4 → A1 → A7，其中 A2 是所有后续对账的地基，先冻结它的数据结构再动其余项。

> 提醒：本计划所有条目均未动代码。下一步若要推进，建议先只做附录 B 第 1、2 两份中间物，再回到本计划评审 P0 schema，避免直接进入实现。

---

# 附录 C：P0 评审结论（B-1/B-2 产出后回炉，进入编码前的最后拍板）

> 前置：附录 B 第 1、2 份已产出 —— `DESIGN-B1-case-expectations-v3.5.md`、`DESIGN-B2-schema-statemachine-v3.5.md`。
> 本节把两份草图对回 Phase 1 契约逐条核对，锁定一致项，列出需拍板的分歧项。全程不动代码。

## C.1 已对齐、可直接冻结

- **执行序**：A2 → A3 → A5 → A6 → A4 → A1 → A7，与计划 §第一批一致，无异议。
- **A2 地基先行**：先冻 surface 落点结构再动其余项，B-2 §7 冻结清单 6 项与此吻合。
- **对账结论不回填 work-item**：B-2 §4 独立 `reconcile-result.json`（派生事实，绑定 headSha/dirtyHash），与「机器状态背书完成话术」一致 —— 采纳为定论（此前作为设计判断提出，现确认）。
- **A6 局部阻塞**：surface 级 `blockedBy[]` 指向项目级 `apiDependency`，无 blockedBy 的 surface 不得借依赖停工 —— 与计划 §A6 still-implementable 一致。
- **A5 pivot 回退**：deliveryTarget 变更 → 旧 app 完成度作废、状态回退 implementing —— 与计划 §A5 一致。
- **A1 话术映射**：完成类话术↔最低状态映射表覆盖计划 §A1 六条禁用语，案例 1 四条错误话术均命中 —— 一致。

## C.2 需拍板的分歧项（三处，冻结前必须定）

> **拍板结论（已确认）**：D-1 采用三维正交；D-2 采用并集枚举；D-3 以 B-2 十态为准。三项均按下文「建议」定案，进入 frozen。后续第 3 份 fixture 与实现以此为契约基线。

### D-1：对账结果——单一枚举 vs 三维正交　【建议：三维】

- 计划 §A2 写单一枚举 6 态：`covered / partially-covered / missing / stale / not-applicable / human-confirmed`。
- B-2 §4 拆成三个正交维度：`codeStatus{covered|partial|missing|stale}` + `wiringStatus{covered|partial|missing|n/a}` + `runtimeStatus{verified|not-verified|n/a}`。
- 分歧本质：`human-confirmed` 其实是 runtime 维度的取值，`partially-covered` 混合了「代码部分」和「wiring 部分」两种不同缺口。单一枚举无法同时表达「代码有、wiring 无、runtime 未验」这种案例 1 的真实状态。
- **建议**：采用三维正交（B-2）。单一 rollup 供话术层用，明细保留三维。`not-applicable` 落到 disposition 而非 status；`human-confirmed` 归入 `runtimeStatus=verified(by-human)`。
- **待你确认**：是否接受从 6 态单枚举改为三维？

### D-2：locator kind 枚举命名对齐　【建议：合并取并集】

- 计划 §A2：`path-prefix / symbol / component / hook / route / test / browser-scenario`。
- B-2 §1：`component / route / function / export / style-token / copy-key / api-call`。
- 差异：计划有 `path-prefix/hook/test/browser-scenario`，B-2 有 `function/export/style-token/copy-key/api-call`。
- **建议**：合并为 `component / hook / function / export / route / style-token / copy-key / api-call / test / browser-scenario`，去掉 `path-prefix`（太粗，退化为 expectPath glob 提示）；`symbol` 归并入 `function`/`export`。
- **待你确认**：这个并集是否作为冻结枚举？

### D-3：状态机十态 vs 计划表述　【建议：以 B-2 十态为准】

- B-2 §5 定义十态：`not-started → scoped → approved → implementing → partially-implemented → implementation-complete → integration-pending → ready-for-human-acceptance → delivery-ready → delivered`。
- 计划 §A1 只列了完成话术受控词，未定完整状态机。附录 B-2 是首次完整定义。
- **建议**：以 B-2 十态 + 四条跃迁守卫 + pivot 回退为准，写入 stage/状态引擎。
- **待你确认**：`integration-pending` 排在 `implementation-complete` 之后是否合理？（含义：纯前端全 covered，仅剩集成项 pending 时进入此态；若同时存在未实现纯前端项则停在 partially-implemented，不进 integration-pending）

## C.3 拍板后的下一步（仍在编码前）

1. 按 D-1/D-2/D-3 结论回填 B-2，冻结 §7 六项契约。
2. 产出附录 B 第 3 份：每项 golden fixture + 失败案例，覆盖场景 A/B/C/D（案例 1 作为 A/B/C 主 fixture，案例 4 作为 D fixture）。
3. 第 3 份评审通过后，才按 A2→…→A7 序进入实现，首个改动点为 `vnext-work-item.schema.json` 的 surface 结构扩展（向后兼容，旧 locator 字符串迁 displayHint）。

> 冻结门槛：D-1/D-2/D-3 三项全部确认 + 第 3 份 fixture 就位，才解锁编码。
>
> **当前进度**：D-1/D-2/D-3 已确认；三份纸面中间物（B-1/B-2/B-3）均已产出，未动引擎代码。剩余卡点 = 人工评审通过三份基线，评审后解锁 A2 实现。

---

# 附录 E：PR-02233 门禁反馈（0918）增量并入

> 来源：`practice-log/pr-02233-system-feedback-0918.md`（Q1–Q4 + MA-001~010 + 越 scope 记录）。
> 目的：把这份反馈对回本计划，区分「已被现有条目覆盖」与「计划未写全的新增/细化」，挂到对应 Phase。仍不动代码。

## E.1 已被现有条目覆盖（不新增，只回链）

| 反馈项 | 对应计划条目 | 说明 |
|---|---|---|
| Q3 / Q4 policyPaths 低估作用面、未纳入 CodeVerifyDialog 等同因模块 | Phase 2 §4 deliveryScope 自动推导 | 反馈提供了「同因搜索反查消费图」的强证据；并入 §4 验收（见 E.2 的 E-2）|
| Q1 workflowVersion 语义困惑 | 附录 A.2 kickoff 兼容（workflow-version.mjs）| 反馈补充了「引擎升 v3.x 但项目仍钉 v2」的长期并存风险，作为 §kickoff 诊断文案输入 |
| MA-010 R-008 未实现却涉及 defer 失效 + DTO 不足 blocked | Phase 1 A2/A3（consumer wiring）+ A6（依赖阻塞）+ A5（defer 前提失效近似 pivot）| 这是「defer 前提失效 + 提交 DTO 无法表达 PRD 组合 → 正确 blocked 未伪造完成」的真实样本,补入 B-1 案例池 |

## E.2 计划未写全的新增/细化项（需并入）

### E-1：WIP / 即时保存官方轻量档（Q2）　`[新增]` → 挂 Phase 2

> 回链：Q2。守卫 fail-closed，把「从未产出上游状态」表述成「已损坏/过期」，用户被迫在 `--no-verify` 与「无法保存」间二选一。

两件事：

1. **文案区分两态**：`precommit-verify-code-rules.mjs` / checkpoint 守卫报错时，区分
   - `never-established`（首次、从未建 checkpoint / review / scope-approval）
   - `stale`（曾通过但指纹已过期）
   现状把前者也说成 stale/not-pass，误导用户以为自己破坏了状态。

2. **官方 WIP 路径**：提供文档化的即时保存档位，避免 `--no-verify` 与「无法保存」二选一。候选：
   - `docs-tdd checkpoint --wip`（只存 patch + ref，不校验上游 gate）
   - 或明确 `DOCS_TDD_COMMIT_MODE` 的非交付档位语义 + 文档
   约束：WIP 档不得写出任何「通过 / 完成」事实,只产出可恢复补丁(如反馈里的 `output-tdd/checkpoints/PR-02233-latest.patch` + `refs/checkpoints/...`)。

与 Bugfix Lite 区别：Bugfix Lite 是「小改动走轻流程仍要交付」；WIP 档是「任意批次的中途保存，不主张交付」。二者都不复用 v1 fast-track-policy。

### E-2：deliveryScope 自动推导——强化为「消费图反查 + 候选前缀提示」　挂 Phase 2 §4 细化

> 回链：Q3/Q4。现有 §4 只写了「从 requirement/surface/deferred 生成边界」,反馈补了两条可落地的具体行为:

1. **同因搜索反查**：scope 推导不能只列 feature 目录前缀;要从 surface/requirement 的消费图反查全部 touched 共享模块（CodeVerifyDialog、MailBinder、VerifyMan、PasswordRuleChecklist、i18n/react hook 等与 verification 同波次但物理路径并列的模块）。这正是 change-scoping skill 的「同因搜索 + 对称模块检查」在 scope 阶段的应用。
2. **越界报错输出候选前缀**：守卫报 outside-scope 时,把 staged 越界路径按目录聚类,输出「建议加入 policyPaths 的候选前缀」,而不是只罗列单文件,降低反复试错。
3. **deferred 与 policyPaths 解耦**：`deferred.batch` 指向 Account/Assets 迁移不应被理解为「所有 Account 命名空间代码不可改」;当前批次仍会触达的共享件必须显式写入 policyPaths,除非有 explicit 排除列表。

并入 §4 验收标准:给一个「verification 已白名单、CodeVerifyDialog 越界」的 fixture,断言推导器能把同波次弹窗壳一并纳入候选。

### E-3：intake 需求原文与验收/设计冲突的 reconciliation　`[新增]` → 挂 Phase 3 或独立 intake 项

> 回链：R-004（Figma 顺序 vs PRD 原文）、MA-001/MA-010（work-item R-012/R-013/R-008 写成旧实现语义,与验收设计冲突）。

问题:代码已按 stakeholder/Figma 改对,但 `work-item.json` 需求原文仍是旧语义,且原文受 intake source-attribution 门管控,AI 不宜单方面改写,导致「代码与需求长期不一致」。

需要一条受控的需求 reconciliation 路径:

- 当 stakeholder 决策 / 人工验收纠正了需求语义时,允许在**留痕**前提下更新 work-item 需求原文(记录决策来源、决策人、原值→新值、关联 requirementId)。
- 不允许 AI 无痕改写 source-attributed 需求;但也不该让「代码对、需求错」长期漂移。
- 与 A5 呼应:需求原文变更应触发相关 surface 的对账重算(旧完成度可能失效)。

### E-4：越 scope 的 runtime 修复归属　`[新增]` → 挂 Phase 4 工程稳定

> 回链：越 scope 记录(ServerCmsBaseUrl.ts / localeCookie.ts import-protection)。

为解本地运行而改的基础设施文件不在 deliveryScope,交付时需归属清楚。需要:

- 一个「基础设施/环境修复」标注通道,把这类改动与业务交付 surface 分开记账;
- 避免它们要么被 scope 守卫误拦、要么被静默混入业务 commit。

## E.3 台账登记（补入附录 A 对应分区)

| observation | 优化项 | 归属 | 状态 |
|---|---|---|---|
| Q2 fail-closed 文案 + 无 WIP 档 | E-1 WIP 轻量档 + 两态文案 | Phase 2 | 新增 |
| Q3/Q4 policyPaths 消费图反查 | E-2 deliveryScope 强化 | Phase 2 §4 | 已存在待改（细化） |
| R-004/MA-001/MA-010 需求原文漂移 | E-3 需求 reconciliation | Phase 3 / intake | 新增 |
| import-protection 越 scope 修复 | E-4 基础设施改动归属 | Phase 4 | 新增 |
| Q1 workflowVersion 长期并存 | kickoff 诊断文案 | Phase 2 kickoff | 已存在待改（补文案） |
| MA-010 defer 失效 + DTO 不足 blocked | 补入 B-1 案例池（正确 blocked 样本）| Phase 1 | 新增案例 |

> 说明：E.1 三项无需新条目,只回链既有计划;E.2 是对已有 §4 的强化,不是新 Phase;真正的纯新增是 E-1/E-3/E-4 三项 + MA-010 案例。均未动代码,待与 B-1/B-2/B-3 一并人工评审。

---

# 附录 F：AutoPilot 控制层（索引）

> 完整设计见 `practice-log/DESIGN-F-autopilot-control-layer-v3.9.md`。
>
> 定位：Phase 1（v3.5 P0）建立安全底线（防误报、防漏需求），附录 F（v3.9 / v4.0）在其上建自主控制层，达成「我只给需求，系统负责安全建分支、完整理解来源、只在必要时问我、完成代码、验证、修复、提交，不会漏需求或卡死」的 AutoPilot 目标。

## F.0 当前计划（P0 + Phase 2–4）能达到的与缺口

**能达到**（55% AutoPilot）：
- ✅ 不会误报完成（A1/A2/A3/A7）
- ✅ 不会漏需求（A2 对账 + extraction audit）
- ✅ 安全建分支（Phase 4 开工前置门）
- 🟡 验证能力（A4 + Phase 3），但缺自动修复触发器

**三个结构性缺口**：
1. Agent 自主决策边界未定义（遇到不确定就问，无 escalation 路由）。
2. 自动修复 / 重试触发器缺失（verify/review fail 后等人喂下一步）。
3. 多源输入与运行时决策的持久化缺失（stakeholder override 不写回，下次重复问）。

## F.1 三模块概要

| 模块 | 作用 | 核心产物 |
|---|---|---|
| M1 决策权限表 + escalation 路由 | 定义每类不确定性的 Agent 自主策略与 escalate 条件 | `common/rules/agent-decision-matrix.json`（6 大类 15+ 场景） |
| M2 自动修复 / 重试执行器 | verify/review/acceptance fail 后自动判可修复性 → 修或 escalate | `lib/auto-disposition.mjs` + 白名单修复策略（5 种初版） |
| M3 运行时决策日志 | 持久化 stakeholder override / Figma 优先 / defer 失效等动态修正 | `prds/<ID>/runtime-decisions.jsonl`（append-only） |

## F.2 实现分两批（在 P0 之后）

### 第一批：v3.9 minimal AutoPilot（80% 达成度）

- M3 runtime-decisions schema + 读取/应用
- M1 decision-matrix 核心 6 场景（figma-priority / policyPaths / dto-insufficient / finding / visual-qa）
- M2 auto-disposition 框架 + 5 种白名单修复（policyPaths / 样式 / copy / DOM / Biome）
- M4 主控循环串联（手动触发验证链路）

验收：PR-02233 回放，MA-003 类修复不再需人工喂、policyPaths 越界自动扩、nit finding 批量 waive。

### 第二批：v4.0 full AutoPilot（90% 达成度）

- M1 补全剩余场景 + escalation CLI（`docs-tdd decide`）
- M2 重试上限 + 修复后验证链
- M4 打断次数监控 + 卡死守卫（escalate timeout 降级）
- 端到端 pilot：全新需求打断 ≤ 5 次

## F.3 四阶段解锁路径

1. **P0 + F 设计评审** → 解锁 Phase 1 实现
2. **P0 实现 + PR-02233 pilot** → 解锁 M1/M2/M3 minimal
3. **M minimal pilot** → 解锁 M4 full
4. **M full 端到端 pilot** → AutoPilot 达成

> **当前卡点**：第 1 阶段，等待人工评审 B-1/B-2/B-3 + F 四份设计基线。评审通过后先做 P0，P0 验证通过再做 M。
>
> 预估时间线（若当前评审通过）：
> - P0 实现 + pilot：1–2 周
> - M minimal 实现 + pilot：1 周
> - M full 实现 + pilot：1 周
> - 共 3–4 周达成 AutoPilot 90%

---

## 全计划文件清单（截至附录 F）

| 文件 | 类型 | 状态 |
|---|---|---|
| `ITERATION-PLAN-v3.5-20260917.md` | 主计划 | 已完成（含附录 A–F 索引） |
| `DESIGN-B1-case-expectations-v3.5.md` | P0 案例预期 | 已完成，待评审 |
| `DESIGN-B2-schema-statemachine-v3.5.md` | P0 schema/状态机（D-1/D-2/D-3 已冻结） | 已完成，待评审 |
| `DESIGN-B3-golden-fixtures-v3.5.md` | P0 fixtures | 已完成，待评审 |
| `DESIGN-F-autopilot-control-layer-v3.9.md` | AutoPilot 控制层（M1/M2/M3/M4） | 已完成，待评审 |
| `pr-02233-system-feedback-0918.md` | 实操反馈（已盘入附录 E） | 已归档 |

> 四份设计文件（B-1/B-2/B-3/F）+ 主计划全部是纸面 plan，未动任何引擎代码。下一步等你评审这四份基线，通过后才解锁 P0 实现。

---

## 修订记录 - 2026-01-XX（v4.0 规则补全）

### 背景

用户指出：v4.0 只写了 8 个精简规则文件（micro 3 + lite 2 + standard 3），但实践证明规则覆盖严重不足——缺失 worktree 使用规则、改动前检查清单、文件查找策略、commit 规范、测试策略、依赖管理等关键规则。

根本问题：**我只提炼了规则摘要，但没有引用完整规则文件**。

### 决策

**方案 C：完全不记录 lite-path 使用日志**（用户同意）

理由：
1. git commit 已经是完整记录
2. 需要分析时从 git log 提取（`--grep "lite-path"`）
3. lite-path 的设计目标就是轻量快速，不应该增加额外的记录负担

### 执行

1. **修改 rule-loader-v4.mjs**：standard 档从 8 个精简规则改为 10 个完整规则文件
   - P0（micro 3）：git-branch-flow.md (10K) + coding-worktree.md (13K) + biome-config-summary.md (1K)
   - P1（lite +2 = 5）：coding-core-checklist.md (1K) + project-readme-summary.md (2K)
   - P2（standard +5 = 10）：api-and-mapper.md (6K) + architecture-and-state.md (28K) + component-reuse-and-visual-fidelity.md (10K) + i18n-key-literal-rule.md (3K) + hook-integration.md (10K)

2. **修改 vnext-efficiency-policy.mjs**：调整预算配置
   - micro: 25000 字符（3 个核心规则）
   - lite: 30000 字符（+2 个轻量规则）
   - standard: 80000 字符（+5 个业务规则，**从 12K 增加到 41K**）
   - high-risk: 120000 字符（+5 个完整规则）

3. **测试结果**：standard 档成功加载 10 个规则文件，总计 41611 字符，在 80000 预算内

### 效果对比

| 场景 | v4.0 精简版 | v4.0 完整版 | 说明 |
|------|------------|------------|------|
| 规则大小 | 16K | 41K | 接近预算上限但覆盖完整 |
| lite-path 耗时 | < 1 分钟 | < 2 分钟 | 仍然很快 |
| 准确性 | ⚠️ 规则缺失 | ✅ 覆盖完整 | **这是关键** |
| 实用性 | ❌ 不可用 | ✅ 可用 | 规则不全等于没用 |

### 未来优化方向

1. **lite-path（10ms kickoff）**：保持现状，只用精简规则
2. **standard 档（按需加载）**：不是一次性加载 80K，而是：
   - kickoff 时：只读项目元数据（3K）
   - 实现前：按需读相关规则（20-30K）
   - 实现中：context 只保留当前文件相关片段（5-10K）
   - commit 前：完整检查（80K，但只一次）

### 结论

v4.0 第 1 周先用完整规则文件保证准确性，等验证效果后再做按需加载优化。

**核心教训**：规则不全 = 系统不可用，加速的前提是规则覆盖完整。

