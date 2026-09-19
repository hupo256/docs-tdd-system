# docs_tdd AutoPilot 可落地路线图（新计划）

> 来源：`practice-log/` 下全部实践记录、`ITERATION-PLAN-v3.5-20260917.md`、B1/B2/B3 设计、PR-02233 0918 门禁反馈，以及 `DESIGN-F-autopilot-control-layer-v3.9.md`。
>
> 状态：规划稿，暂不动代码。
>
> 核心目标：从“流程发生过”升级为“用户只给需求，系统可安全、自主、可恢复地完成到交付或明确阻塞”。

---

## 一、AutoPilot 最终定位

用户只提供：

- PRD / 需求链接；
- bug 描述；
- 必要的业务约束。

系统自主负责：

```text
识别需求类型
→ 确认仓库、目标应用和工作上下文
→ 安全创建分支与 worktree
→ 完整同步并校验来源
→ 抽取 requirements / surfaces
→ 确定性自查
→ 必要时独立审查
→ 建立实现计划
→ 完成代码
→ 中期对账
→ 执行验证
→ 有界自动修复
→ 处理人工验收或外部依赖
→ checkpoint / delivery commit
```

系统只在无法安全自动裁决时询问用户；任何遗漏、阻塞或失败都必须显式结束，不能静默漏需求或无限卡住。

最终可兑现的保证不是“绝对不会漏、绝对不会卡”，而是：

> 不静默漏需求；不把局部实现误报为完成；不因局部依赖阻塞整批；不无限重试；不在错误分支修改；不丢失人工决策；所有无法自主解决的问题，都在有限时间内进入明确、可恢复、带最小决策的问题状态。

---

## 二、当前真实基线

### 已有能力，不重复从零设计

| 能力 | 当前情况 |
|---|---|
| v2 work-item 流程 | 已有 |
| PRD intake / source units | 已有，部分来源解析需增强 |
| 确定性 extraction audit | 已有基础，需补完整自查项 |
| 独立 coverage review | 已有，具备两轮限制基础 |
| review adjudication / appeal | 已有部分能力 |
| v2 dev-check | 已有 |
| baseline-aware typecheck | 已有基础 |
| checkpoint / delivery commit 分离 | 已有 |
| command timeout / 子进程终止 | 已有 |
| browser MCP adapter | 已完成并自测 |
| repairAttempts 计数 | 已有码级基础 |
| action packet / nextAction | 已有基础 |
| source-readiness / API pending | 已有，但粒度过粗 |
| 图片鉴权下载与 magic-byte 校验 | 已解决 |
| 多份真实案例与 golden 设计 | 已有纸面基线 |

### 仍缺失或不足的关键能力

1. `surface → code` 真实对账；
2. provider / consumer 接入对账；
3. delivery target pivot 后旧事实失效；
4. requirement / surface 级依赖阻塞；
5. 未完成 surface 驱动的实现调度；
6. 统一 AutoPilot 控制状态和终态；
7. 明确“什么时候问用户”的决策策略；
8. runtime decision 持久化；
9. review / verify / acceptance 失败后的统一自动处置；
10. 无静默遗漏、无无限循环的端到端验收；
11. source 冲突和人工纠正后的需求 reconciliation；
12. policyPaths 从消费图自动推导；
13. WIP 保存与正式交付进一步分离；
14. 全新真实项目的 AutoPilot replay。

---

## 三、目标架构：四层闭环

### Layer 1：事实层

回答：

```text
需求是什么？
本期做什么？
目标应用是什么？
有哪些 requirement / surface？
哪些来源已处理？
哪些依赖存在？
```

产物：

```text
work-item.json
source snapshot
source units
extraction audit
runtime-decisions.jsonl
```

### Layer 2：对账层

回答：

```text
代码是否真的实现？
页面是否真的消费？
交互是否真的可运行？
哪些 surface 仍缺失？
哪些证据已失效？
```

产物：

```text
reconcile-result.json
```

### Layer 3：执行层

回答：

```text
下一步做什么？
哪些 surface 可以并行？
哪个失败可以自动修？
什么时候重试？
什么时候继续其他任务？
什么时候询问用户？
```

产物：

```text
action packet
control state
repair decision
escalation
```

### Layer 4：交付层

回答：

```text
是否可以 checkpoint？
是否可以人工验收？
是否可以 delivery verify？
是否可以 commit？
```

产物：

```text
dev-check
evidence receipts
latest-result.json
checkpoint commit
delivery commit
delivery summary
```

---

## 四、能力等级

为避免引擎版本、`workflowVersion`、风险等级和计划版本继续混淆，后续用 AutoPilot Capability Level 表示能力成熟度。

### AP-0：设计基线

纸面契约、状态机、真实案例和 golden fixture 已冻结，尚未编码。

### AP-1：Safe Run

系统能安全启动、建分支、持久化动作、超时恢复、保存 WIP，不会误操作环境分支。

### AP-2：Truthful Completion

系统能证明：

- 没有漏 requirement；
- 没有漏 implement surface；
- provider / consumer 已区分；
- pivot 不继承旧完成度；
- 完成话术与代码事实一致。

### AP-3：Autonomous Execution

系统能：

- 根据未完成 surface 自主排程；
- 继续处理不受阻塞影响的 surface；
- 对白名单失败自动修复；
- 只在必要时询问用户；
- 将决策持久化。

### AP-4：Qualified AutoPilot

通过全链路真实项目验证后，才允许对外宣称“只给需求即可自动完成到交付或明确阻塞”。

---

# 五、AP-0：冻结设计和验收基线

当前 B1、B2、B3、F 已形成主要设计材料，需要整理为唯一实现入口。

## AP-0.1 冻结 P0 schema

### surface 代码落点

```json
{
  "codeLocator": {
    "kind": "component",
    "app": "apps/web-next",
    "symbol": "SwitchVerifyMethodDialog",
    "expectPath": "src/**/SwitchVerifyMethodDialog.tsx",
    "role": "provider"
  }
}
```

locator 类型采用：

```text
component
hook
function
export
route
style-token
copy-key
api-call
test
browser-scenario
```

旧的字符串 `locator` 保留兼容，迁移为 `displayHint`；它不能单独作为真实代码证明。

### provider / consumer

```json
{
  "wiring": {
    "role": "consumer",
    "dependsOn": ["S-004"],
    "wiringEvidence": "browser"
  }
}
```

### surface 依赖

```json
{
  "blockedBy": ["API-COOLDOWN-TS"]
}
```

### delivery target

```json
{
  "deliveryTarget": {
    "app": "apps/web-next",
    "history": []
  }
}
```

### 派生对账结果

新增独立：

```text
reconcile-result.json
```

机器对账结论不回填 work-item 的手填字段，避免人工字段和派生事实混淆。

对账结果采用三维正交状态：

```text
codeStatus
wiringStatus
runtimeStatus
```

## AP-0.2 冻结生命周期状态

沿用 B2 的十态：

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

### `implementation-complete`

必须满足：

```text
所有本批次 implement surface：
  codeStatus = covered
  wiringStatus = covered 或 n/a
  无 missing / partial / stale
```

### `integration-pending`

只有在以下情况下允许进入：

```text
纯前端 implement surface 全部完成
仅剩 blockedBy API / 外部依赖 surface
```

若仍有无依赖的前端 surface 未完成，状态必须是：

```text
partially-implemented
```

### `ready-for-human-acceptance`

必须满足：

```text
runtime critical path 全部 verified
```

### `delivery-ready`

必须满足：

```text
mode=enforced
status=passed
ok=true
当前 HEAD / dirtyHash 与 verify、reconcile 一致
```

## AP-0.3 冻结真实案例

至少冻结以下六个案例：

1. **PR-02233**：pivot、provider/consumer、API 局部阻塞、错误完成话术、delivery overclaim。
2. **hichat bugfix**：Bugfix Lite、错分支、已有测试文件覆盖、定点回归。
3. **TR-02386**：预存目录、缺 workflowVersion、v1/v2 路由、full-batch deliveryScope。
4. **证据不足**：静态字符串 / DOM 不能证明完整交互、package script 误跑全量、human-check。
5. **MA-010 DTO 不足**：defer 前提失效、API 无法表达 PRD、不猜字段、局部继续。
6. **source reconciliation**：PRD 与 Figma 冲突、人工纠正需求、决策留痕、相关 fingerprint 失效。

---

# 六、AP-1：安全运行控制层

这一层必须优先建设。没有控制层，后续自动化会放大错误。

## AP-1.1 开工前安全上下文

任何业务代码修改前，自动确认：

```text
消费仓
worktree
branch
project
target app
baseRef
当前 WIP
commit mode
```

禁止在以下环境分支直接修改业务代码：

```text
online
pre
test
dev
```

系统应自动：

```text
从 origin/online 创建 feature/<ID> 或 fix/<ID>
→ 建立隔离 worktree
→ 挂载 docs_tdd
→ 执行基线检查
→ 返回唯一下一动作
```

仅有文档规则不够，必须成为 `run` 的机器前置门。

## AP-1.2 统一 action packet

每个动作至少持久化：

```json
{
  "actionId": "...",
  "action": "implement-current-scope",
  "phase": "implementing",
  "attempt": 1,
  "startedAt": "...",
  "timeoutMs": 300000,
  "inputFingerprint": "...",
  "expectedOutputs": [],
  "retryBudget": 2,
  "nextActionOnSuccess": "...",
  "nextActionOnFailure": "...",
  "status": "active"
}
```

需要补齐：

- attempt；
- timeout；
- heartbeat；
- retry budget；
- failure class；
- recovery action；
- terminal transition。

## AP-1.3 统一终态

任何自动动作最终必须进入以下之一：

```text
succeeded
blocked-user-decision
blocked-external-dependency
failed-infrastructure
failed-safety-check
```

禁止：

```text
active 但没有 heartbeat
reviewing 无限持续
retrying 无限持续
waiting 但没有解除条件
代码已修改但状态仍停在 intake
```

所有阻塞结果必须包含：

```text
阻塞原因
受影响 requirement
受影响 surface
已继续完成的部分
解除条件
恢复命令
是否需要用户
```

## AP-1.4 超时与重复失败

统一规则：

```text
单动作超时 → 终止进程 → 保存结果 → 分类
同 fingerprint + 同错误超过预算 → 停止重试
普通自动修复最多 2 轮
coverage review 最多 2 轮
环境修复最多 1 轮
```

现有 `repairAttempts.code/browser`、review attempts 和 command runner timeout 应由同一控制层统一解释。

## AP-1.5 WIP、checkpoint、delivery 三档

### WIP save

只保存：

- patch；
- checkpoint ref；
- 当前 action；
- 当前 worktree 状态。

不得写入：

```text
PASS
完成
ready-for-delivery
```

### checkpoint commit

允许实现中阶段提交，要求：

- branch 安全；
- changed paths 可追踪；
- dev-check 通过；
- 不宣称最终交付。

### delivery commit

要求：

- reconcile 通过；
- evidence receipt 当前；
- latest-result 为 enforced PASS；
- commit paths 与冻结范围一致；
- commit message 不得 overclaim。

---

# 七、AP-2：需求完整性和交付真实性

## AP-2.1 A2：surface → code

为所有 `disposition=implement` surface 建立真实落点。

不能用以下内容直接关闭：

- 文件存在；
- 组件名存在；
- 字符串存在；
- 测试文件存在；
- 任意相关路径被修改。

必须产生：

```text
resolvedPaths
matchedSymbol
codeStatus
```

并绑定：

```text
headSha
dirtyHash
deliveryTarget
```

## AP-2.2 A3：provider / consumer

必须区分：

```text
能力是否存在
```

和：

```text
业务页面是否真正接入
```

consumer 关闭需要满足 locator 对应的最低证据档位：

```text
import
render
event-binding
browser
```

组件存在不等于页面接入；页面 import 不等于点击链路可用；点击链路可用不等于副作用正确。

## AP-2.3 A5：pivot invalidation

以下任一变化都会使旧对账失效：

- app；
- route；
- delivery target；
- worktree；
- policy path；
- 目标仓库；
- 关键 source contract。

旧结果可以保留为历史，但不得计入当前完成度。

## AP-2.4 A6：依赖局部化

把项目级 API pending 下沉为：

```text
requirement
→ surface
→ blockedBy
→ dependency
→ blocked phase
```

系统自动分为：

```text
still-implementable
integration-pending
blocked-user-decision
```

API 未就绪时：

1. schema 足够则生成 contract-shaped mock；
2. 继续纯前端实现；
3. 真实联调标记为 integration-pending；
4. DTO 无法表达 PRD 时禁止猜字段；
5. 输出最小升级问题。

## AP-2.5 A4：runtime critical path

PRD 出现以下动作语义时自动要求 runtime evidence：

```text
点击
打开
切换
选择
关闭后
提交后
恢复
禁用
重新发送
跳转
```

最低证据结构：

```text
precondition
→ action
→ visible result
→ state/data side effect
→ negative case
```

已存在的 browser adapter 继续复用，本阶段只补需求识别、surface 绑定和 ready-for-acceptance 门禁。

## AP-2.6 完成话术和提交摘要守卫

话术由状态机生成。

| 状态 | 允许表达 |
|---|---|
| `partially-implemented` | 部分实现、仍有未完成 surface |
| `integration-pending` | 前端实现完成，仅剩指定集成依赖 |
| `ready-for-human-acceptance` | 已具备人工验收条件 |
| `delivery-ready` | 已通过正式交付验证 |
| `delivered` | 已完成交付提交 |

禁止 Agent 自行把“有组件、有测试、有部分页面”组合成“整批完成”。

commit message 声称完整 flow，但核心 surface 未完成时，delivery commit 必须阻断；checkpoint 可保存，但摘要只能使用 partial / WIP 语义。

---

# 八、AP-3：需求完整性、范围推导和自主调度

## AP-3.1 extraction self-audit 前置

正式抽取自查器至少覆盖：

1. evidence plan type 与 command kind 对应；
2. 多类型 evidence plan 生成笛卡尔积；
3. `expectedCount` 与 surface 数量一致；
4. source unit 全部有 disposition；
5. 新文案与 copy evidence；
6. 跨端 deferred surface；
7. runtimeRequired 与 runtime command；
8. 验收标准表逐行覆盖；
9. requirement → surface → evidence 链路完整；
10. 重复 requirement / surface ID；
11. source unit 错误归属；
12. deferred / not-doing / implement 冲突。

自查不通过时，禁止进入独立 review。

## AP-3.2 大型 PRD 抽取脚手架

提供：

```bash
docs-tdd extract <ID> --scaffold
```

自动生成：

- source units 清单；
- source disposition 模板；
- requirement skeleton；
- surface skeleton；
- evidence plan；
- surface × evidence type 命令候选；
- collection count；
- 未覆盖 source unit；
- 需求与验收表关联候选。

减少手写大型嵌套 JSON 和正则批量插入造成的错位、漏逗号和静默跳过。

## AP-3.3 policyPaths 从消费图推导

推导链：

```text
requirement
→ surface
→ provider / consumer
→ import graph / route graph / shared module graph
→ candidate policy paths
```

重点检查：

- 同级共享组件；
- 同 namespace i18n；
- mock handlers；
- endpoint contract；
- shared auth / common components；
- 成对或对称页面模块。

越界时输出：

```text
当前越界路径
建议加入的目录前缀
与本批次 surface 的关系
是否涉及 deferred / excluded scope
```

安全规则：

- scope approval 前，同 app、同消费图内路径可自动生成候选；
- 跨 app、跨 deferred、跨业务域必须询问；
- 可能新增业务语义的路径必须询问。

## AP-3.4 deliveryScope 自动推导

从以下事实生成：

```text
requirement.status
surface.disposition
deferred.owner
deferred.batch
not-doing reason
blockedBy
```

无延期：

```json
{
  "mode": "full-batch",
  "deferred": null
}
```

有延期：

```json
{
  "mode": "bounded-batch",
  "deferred": {
    "owner": "app-team",
    "batch": "APP-2026-Q4",
    "reason": "out-of-scope"
  }
}
```

不再要求 reviewer 自发生成 deferred boundary finding。

## AP-3.5 未完成 surface 驱动的实现调度

每轮实现前重新计算未完成 surface，并按依赖排序：

```text
source / schema
→ mapper / contract
→ provider
→ consumer
→ runtime evidence
```

调度器必须支持：

- provider 先于 consumer；
- 无依赖 surface 并行；
- API-blocked 与纯前端分流；
- shared component 先实现；
- pivot 后重新排程；
- 修复后局部重验；
- 新发现 surface 加入待办队列。

终止条件：

```text
所有 implement surface：
  covered
  或有明确 blocker / deferred / not-doing
```

不能以“写了一批代码”作为完成标准。

---

# 九、AP-4：只在必要时询问用户

## AP-4.1 可以自动处理

- 文件位置；
- 测试命名；
- 已有组件复用；
- 普通 import；
- 明确的 i18n key typo；
- Biome 可自动修复问题；
- 声明式样式修正；
- 同一 scope 内的 policy path 候选；
- 已有 schema 下的 mock；
- nit 级 finding；
- 仓库规则已经明确的 branch / worktree；
- 存量 typecheck 与新增 error 分离。

## AP-4.2 必须询问

- 多个来源冲突且没有既定优先级；
- PRD 与 Figma 冲突且涉及业务行为；
- 需求前后矛盾；
- 资金、权限、登录、密码、删除等高风险语义；
- DTO 无法表达需求且无法安全降级；
- 需要扩大到其他 app / deferred scope；
- 自动修复超过预算；
- 人工验收无法判断；
- 需要用户提供凭据或本地环境；
- 需要改变已批准的交付范围。

## AP-4.3 询问格式

每次只问最小决策，并给出：

```text
问题
事实证据
推荐选项
其他选项
各选项影响
不回答时的安全默认
```

例如 API DTO 不足时，默认不猜字段，阻塞相关 surface，继续其他可实现 surface。

## AP-4.4 runtime-decisions 持久化

新增：

```text
prds/<ID>/runtime-decisions.jsonl
```

记录：

- stakeholder 决策；
- Figma / PRD 冲突处理；
- defer 失效；
- API blocked / unblock；
- policy path 自动扩展；
- finding waive；
- 自动修复；
- 人工验收结果；
- 用户选择的降级方案。

每条记录必须包含：

```text
时间
actor
before / after
reason
evidence
related decisions
```

下次会话必须读取，不能重复询问已决策事项。

---

# 十、AP-5：验证、证据和自动修复闭环

## AP-5.1 证据类型补齐

新增一等 producer / kind：

```text
human-check
structural
quality
```

功能证据：

```text
pure-logic
component-dom
browser-interaction
api-contract
payload-contract
```

质量证据：

```text
structural
quality
touched-file-quality
```

Biome、typecheck、文件行数不能冒充业务功能完成证据。

## AP-5.2 claim-to-assertion audit

检测：

- 一条命令绑定过多 requirement；
- 一条命令绑定过多 surface；
- 静态字符串证明完整交互；
- mock response 证明 UI 行为；
- provider 证据证明 consumer；
- 通用测试证明特定业务路径；
- DOM 存在证明点击副作用。

输出：

```text
overclaim-warning
overclaim-error
```

明显 overclaim 阻断，可疑 overclaim 要求人工确认。

## AP-5.3 scoped command 展开

解析：

- package scripts；
- workspace scripts；
- 默认目录；
- glob；
- shell wrapper；
- implicit test roots。

如果命令实际展开成 `vitest run src`，即使表面带了文件参数，也不能称为 scoped。

## AP-5.4 自动修复白名单

第一批允许：

| 类型 | 最大轮次 |
|---|---:|
| Biome auto-fix | 1 |
| 明确缺失 import | 1 |
| 已存在导出的 locator 修正 | 1 |
| i18n key typo | 1 |
| 单个 DOM 属性契约 | 2 |
| 声明式 cursor / spacing / color | 2 |
| policy path 候选扩展 | 1 |

不自动修复：

- 需求语义；
- API DTO 设计；
- 状态机业务逻辑；
- 跨 app scope；
- 资金 / 权限 / 密码；
- 复杂布局；
- 视觉目标不明确；
- 核心用户路径遗漏。

## AP-5.5 统一失败处置

所有失败进入：

```text
classify
→ auto-fixable
→ needs-user-decision
→ external-blocked
→ infrastructure-failure
```

自动修复后必须重跑受影响验证。若修复改变 code path、surface locator、source requirement、delivery target 或 evidence scope，相关结果必须 stale。

---

# 十一、AP-6：流程分档和工程稳定性

## AP-6.1 Bugfix Lite

适用于同时满足以下条件的 bug：

- 根因已定位到文件 / symbol / 代码位置；
- 改动范围小；
- 不引入新业务语义；
- 不触及高风险边界；
- 有明确回归方式。

流程：

```text
确认项目类型
→ 确认 branch / worktree
→ 记录现象、预期、实际
→ 记录根因和修复点
→ 定点回归
→ 绑定内容 hash
→ bugfix verify
```

涉及资金、权限、登录、密码、数据删除、生产一致性、跨应用行为或产品预期不明确时自动升级完整流程。

Bugfix Lite 不复用 v1 `fast-track-policy.mjs`。

## AP-6.2 kickoff 兼容

预存目录但缺 `workflowVersion` 时不得静默降级 v1：

```text
目录存在 + 无 workflowVersion
→ 明确诊断
→ 默认建议 v2
→ 发现 legacy 文件则要求确认
```

同时优化本地 Markdown 路径错误，直接说明应放入：

```text
<docs_tdd>/prds/<ID>/inbox/
```

## AP-6.3 人工授权和审查收敛

提供正式状态迁移：

```text
scope-approve --human-override --reason
begin-implementation --reason
review-defer --reason
accept-incomplete-scope --reason
```

人工授权记录 operator、时间、HEAD、dirty hash、scope、偏离规则和补偿条件。

Finding 分级：

```text
blocker
major
nit
false-positive
```

自动 review 最多两轮；超过后进入人工裁决，不追求无限“零 finding”。允许 unchanged fingerprint 的跨 client 复审，但必须记录原因和轮次。

## AP-6.4 extract 重跑保护

存在未裁决 finding 时：

- 强警告；
- 默认拒绝覆盖；
- 或要求显式 `--force`；
- 保存当前 audit；
- 提示正确顺序：

```text
review
→ adjudicate
→ extract / modify
→ review-resume
```

## AP-6.5 工程稳定性

纳入后续治理：

- 交互式 Agent 开工前机器门；
- `write` 覆盖已有文件防护；
- symlink 主模块守卫统一 realpath；
- policy / engine / template fingerprint 分离；
- practice-log 并发约定；
- source 变更后的 resync-sources；
- scope 外基础设施修复归属通道；
- doctor / CLI 文案区分引擎版本、workflowVersion、风险等级和规则发布。

---

# 十二、真实项目 Pilot

不能只靠 self-test 和 golden 宣布 AutoPilot 达成。

## Pilot 1：PR-02233

验证：

- apps/web → apps/web-next pivot；
- Login / Register / ResetPassword consumer wiring；
- MA-001～MA-010；
- policyPaths 消费图；
- source reconciliation；
- DTO blocked；
- API 局部继续；
- WIP / checkpoint / delivery 区分。

## Pilot 2：hichat

验证：

- 自动识别 Bugfix Lite；
- 安全切分支；
- 不走完整抽取和 review；
- 产生定点回归；
- 保留待确认产品语义；
- 正确 delivery commit。

## Pilot 3：TR-02386

验证：

- 预存目录；
- 缺 workflowVersion；
- v1/v2 诊断；
- 本地 Markdown 路径；
- full-batch deliveryScope；
- 无延期不伪造 deferred finding。

## Pilot 4：全新 clean project

必须从“只给 PRD”开始，不提前人工准备 work-item，完整运行：

```text
kickoff
→ branch/worktree
→ intake
→ extraction
→ review
→ approval
→ implementation
→ reconcile
→ evidence
→ repair
→ verify
→ delivery commit
```

## Pilot 5：中断恢复

在 intake、review、implementation、browser evidence、auto-fix、commit 前主动中断，由新会话验证：

- 不依赖聊天记忆；
- 不重复已完成副作用；
- 正确读取持久状态；
- 给出唯一下一动作。

---

# 十三、发布门槛

## AP-1 Safe Run

必须证明：

- 错误分支会被拦截；
- 能自动创建正确 worktree；
- action 有持久化；
- 命令超时后不会无限等待；
- 同错误不会无限重试；
- WIP 可以安全保存；
- 新会话可以恢复。

## AP-2 Truthful Completion

必须证明：

```text
0 个静默未处理 semantic source unit
0 个未解释 implement surface
provider / consumer 可区分
pivot 后旧结果不继承
API pending 只影响相关 surface
错误完成话术被拦截
delivery commit 不接受 overclaim
```

## AP-3 Autonomous Execution

必须证明：

- 未完成 surface 可以生成下一批动作；
- 可继续项不会被 blocked 项拖住；
- 白名单失败可以自动修复；
- 修复有上限；
- 用户决策会持久化；
- 同一决策不会重复询问；
- 每个动作最终进入成功、阻塞或失败终态。

## AP-4 Qualified AutoPilot

至少通过：

- 正常新功能端到端；
- Bugfix Lite；
- 大型多模态需求；
- API pending 局部继续；
- source 冲突升级；
- 人工验收失败分类处理；
- 中断恢复；
- 命令卡死终止；
- 无静默漏项；
- 无无限循环。

并在至少一个全新真实项目中记录：

- 人工打断次数；
- 每次打断是否必要；
- 所有决策是否持久化；
- 最终提交范围是否准确。

---

# 十四、实施顺序

## 阶段 0：冻结和盘点

只做设计，不改业务代码：

1. 评审 B1；
2. 评审 B2；
3. 评审 B3；
4. 评审 F；
5. 重新核对引擎实现；
6. 为每个计划项标记“已有 / 已有待改 / 新增 / 暂不做”；
7. 补 MA-010、source reconciliation、policyPaths、WIP fixture。

输出：

```text
唯一 schema
唯一状态机
唯一验收 fixture
唯一实现顺序
```

## 阶段 1：安全控制层

1. 开工上下文；
2. branch / worktree 安全创建；
3. action packet 完整字段；
4. timeout / retry / terminal state；
5. WIP / checkpoint / delivery 三档；
6. runtime decision 基础日志；
7. escalation 格式。

## 阶段 2：交付真实性地基

按既定顺序：

```text
A2 surface → code
→ A3 provider / consumer
→ A5 pivot invalidation
→ A6 dependency blast-radius
→ A4 runtime critical path
→ A1 completion-language
→ A7 commit summary
```

## 阶段 3：需求完整性和范围推导

1. extraction self-audit；
2. extraction scaffold；
3. source unit / acceptance row coverage；
4. source reconciliation；
5. deliveryScope 自动推导；
6. policyPaths 消费图反查；
7. kickoff 兼容；
8. Bugfix Lite。

## 阶段 4：证据和自动修复

1. human-check；
2. structural / quality evidence；
3. claim-to-assertion；
4. scoped command 展开；
5. locale guard；
6. baseline-aware typecheck；
7. auto-disposition；
8. 白名单自动修复；
9. 修复后局部重新验证。

## 阶段 5：实现调度和主控循环

最后将前述能力串成：

```text
run
→ 读取控制状态
→ 计算未完成 surface
→ 选择下一动作
→ 执行
→ 记录结果
→ 自动修复或升级
→ 重新 reconcile
→ 继续直到终态
```

不先写“大而全”的主控循环；先让每个阶段具备可靠输入、输出和失败分类，再进行编排。

---

# 十五、明确不做的事情

1. 不把所有 failure 交给模型自由修复；
2. 不允许 AI 猜 API 字段；
3. 不允许无审计地修改 source-attributed 需求原文；
4. 不允许自动扩大到其他 app 或 deferred scope；
5. 不把 Figma 永远设为最高优先级来源；
6. 不以 reviewer finding 数量作为唯一质量指标；
7. 不把 browser smoke 冒充人工视觉验收；
8. 不把存量 typecheck 错误直接算作本次失败；
9. 不把 WIP 保存绑定最终 delivery PASS；
10. 不在所有项目迁移前强制破坏性升级旧 work-item；
11. 不在没有 clean project pilot 前宣布 AutoPilot 达成；
12. 不用自然语言“看起来完成”替代机器状态。

---

# 十六、核心结论

后续建设顺序应是：

```text
安全控制
  ↓
事实对账
  ↓
需求完整性
  ↓
证据可信
  ↓
自动修复
  ↓
主控循环
  ↓
真实项目认证
```

已有材料的职责划分：

- B1：行为验收基线；
- B2：schema 和状态机基线；
- B3：P0 回归基线；
- F：AutoPilot 控制层设计；
- PR-02233 反馈：新增边界和失败案例；
- 真实 Pilot：最终发布依据。

当前不应直接开始“大范围自动化编码”。应先通过 AP-0 设计评审，确认 schema、状态机、终态、真实案例和实现顺序，然后从 AP-1 安全控制层开始。
