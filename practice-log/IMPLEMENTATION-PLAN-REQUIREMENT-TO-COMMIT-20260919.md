# docs_tdd 从需求到安全提交的可实施升级计划

> 日期：2026-09-19
> 适用范围：`docs_tdd` 系统、v2 work-item 协议兼容层、公共规则、fixture、CLI 和验证执行器
> 不包含：FameEX 业务代码修改、真实业务项目批量迁移、自动 push
> 目标：把“只给需求”收敛为一个安全、有界、可恢复的本地 AutoPilot 闭环

## 1. 目标与承诺边界

用户期望的是：

```text
我只给需求
→ 系统安全建分支和 worktree
→ 完整理解来源
→ 只在必要时问我
→ 完成代码
→ 验证、修复
→ 安全提交
→ 不漏需求、不误报完成、不无限卡住
```

本计划把它转换为可机器验收的承诺：

1. **不静默漏需求**：每个可解释的 source unit 必须进入 requirement、显式排除或进入待裁决状态；每个 `implement` surface 必须进入实现队列、明确阻塞或明确延期。
2. **不误报完成**：代码、页面接入、运行时路径、证据、当前内容指纹和提交摘要必须相互一致，系统不能用局部事实推导整批完成。
3. **不误操作**：业务代码只能写入由系统解析出的消费仓、隔离 worktree 和工作分支；环境分支、他人 WIP、已有文件覆盖和越界路径必须在写入前拦截。
4. **只在必要时询问**：可由来源优先级、代码搜索、确定性检查或白名单修复解决的问题不打断用户；无法安全裁决的问题一次批量询问，并持久化结果。
5. **不无限重试**：每个失败域有独立预算；同一输入指纹和同一失败不允许无变化重试；预算耗尽进入可恢复终态。
6. **不丢失状态**：中断后新会话仅依赖项目产物即可恢复到唯一下一动作，不依赖聊天记忆。
7. **不自动 push**：本计划的终点是安全本地 delivery commit；远端发布仍由人工或现有团队流程负责。

### 1.1 范围谓词

本次升级只纳入：

> 覆盖从唯一需求输入到安全本地提交的全部必要系统能力，且仅包含能消除漏需求、错误完成、无效提问、无限重试、危险分支操作和不可恢复中断的能力。

不因“看起来更智能”而纳入与上述承诺无直接关系的模型升级、规则复制、全量重构或业务仓适配抽象。

## 2. 当前基线

### 2.1 已有地基，不重复从零实现

当前工作区已经具备以下能力或实现地基：

| 能力 | 当前基线 | 后续动作 |
|---|---|---|
| v2 work-item / enforced verify | 已存在 | 保持兼容，补主控终态和状态迁移 |
| `codeLocator` / `deliveryTarget` / `wiring` / `blockedBy` | 已接入 schema 和 intake audit | 补 locator 质量、消费图和迁移诊断 |
| surface → code reconciliation | 已有 `vnext-reconcile`、schema、fixture | 补 symbol 解析、consumer 运行时和调度闭环 |
| provider / consumer 区分 | 已有结构和基础判断 | 补 import/render/event/runtime 分层证据 |
| target pivot invalidation | 已有目标和内容指纹校验 | 扩展 source、route、worktree、scope 变化的失效半径 |
| `reconcile-result.json` → verify | 已接线并有真实 Git E2E | 统一与状态机、证据 freshness、delivery rollup 的关系 |
| `dev-check` | 已有 scoped command、路径映射、baseline-aware typecheck、超时 | 补 command expansion、失败分类和主控触发 |
| evidence runner / browser adapter | 已有无 shell argv runner、Playwright MCP adapter、runtimeRequired 门禁 | 补 human-check、证据强度和人工结果持久化 |
| checkpoint / delivery commit | 已分离，delivery 使用冻结 path set，永不 push | 补 WIP 档、越界归属和摘要真实性 |
| code/browser 修复预算 | `repairAttempts` 已存在 | 统一为按失败域的恢复协议 |
| artifact compatibility | 已有显式报告/迁移和缺 contentHash 阻断 | 继续禁止静默修写历史结果 |
| v2/v1 路由 | 已有协议隔离 | 补预存目录歧义诊断，不批量改 `workflowVersion` |

### 2.2 仍未形成端到端闭环的能力

1. `work-context resolver` 尚未成为所有交互式 Agent 写入动作的机器前置门。
2. source 尚未统一为可追溯的多模态 source graph；表格行、图片规格、Figma/API 后到变更和 stakeholder decision 仍需统一进入 coverage compiler。
3. extraction audit、review、人工 scope approval 和 source reconciliation 尚未共享一个持久化决策模型。
4. 当前 reconciliation 地基尚未完整驱动“未完成 surface → 下一 action → checkpoint → 局部重验”。
5. `human-check`、`structural`、`quality` 仍需成为一等 evidence producer/kind，并与业务功能证据分离。
6. 需要统一 `observe → classify → repair → revalidate`，覆盖 source、review、code、browser、environment、external dependency 六个失败域。
7. `policyPaths` 仍主要依赖人工声明，尚未从 requirement → surface → consumer/import/route/shared module 消费图提出候选。
8. completion language、delivery summary、commit subject 尚未全部由同一 rollup 生成和约束。
9. runtime decision 尚未形成 append-only、可重放、可引用的 `runtime-decisions.jsonl`。
10. 真实 clean project、真实中断恢复和真实用户打断次数尚未成为发布门槛。

### 2.3 不能重复规划或直接照搬的旧项

以下内容不能在新计划中再次作为“从零实现”：

- browser MCP adapter；
- 结构化 `codeLocator` schema；
- 基础 provider/consumer reconciliation；
- delivery target 与旧结果失效的基础逻辑；
- `reconcile-result.json` 的基本落盘和 verify 消费；
- `dev-check`、evidence runner、checkpoint/delivery 分离；
- 代码和浏览器修复次数的已有计数；
- 图片鉴权下载和 magic-byte 校验；
- v2 项目根目录 artifact 兼容层。

这些项目只允许作为“补齐缺口、扩大覆盖、接入主控、增加回归 fixture”出现。

### 2.4 近期真实项目对照

下面四个项目不是用来证明“旧系统完全失效”，而是用来定位系统在哪一层失去事实约束。后续每个拦截能力必须至少能回放其中一个问题。

| 项目 | 真实问题 | 漏项/失真所在层 | 现有系统为何未拦 | 新系统拦截点 | 成本风险 |
|---|---|---|---|---|---|
| `PR-01947` | 已有上线事实，但历史流程仍为 `G5 BLOCK`，项目状态可被归档为未验证 | delivery truth / human gate | 发布事实、gate 事实和归档状态没有统一 rollup | Phase 7 的 delivery truth、release receipt 和状态一致性检查 | 低 |
| `PR-02265` | `F04`、`AC-4`、`AC-13` 未形成通过验收，且存在类型错误 | requirement → evidence → delivery | 清单存在不代表每个要求都有有效证据；验收结果不完整仍可能继续流转 | requirement-to-evidence 强绑定、touched-file quality、delivery 阻断 | 中 |
| `PR-02306` | 重置密码、修改登录密码两个页面及对应图片需求最初漏抽 | source → requirement | 共享密码规则覆盖了公共逻辑，却掩盖了具体入口和图片中的独立功能 | 图片 source unit、入口级 surface、collection coverage、反向追溯 | 中 |
| `PR-01930` | 第三个 fund-flow consumer 未被覆盖；分批实现状态容易被误读为整体完成 | requirement → surface → completion | provider 或已完成批次被错误地当成整体完成 | `expectedCount`、consumer 集合对账、未完成 surface 队列和 delivery rollup | 中 |

这四个项目也说明一个重要边界：**继续增加 reviewer 轮数不能替代 coverage compiler 和 surface reconciliation**。reviewer 只能审查它收到的范围；如果范围本身少了页面、图片或 consumer，更多轮次只会更贵地确认一个错误范围。

## 3. 效率预算与风险分档（最高优先级）

### 3.1 为什么必须前置

当前系统把很多小需求按标准需求处理，导致完整 source graph、全量规则、独立 reviewer、浏览器证据和多轮 repair 被默认加载。这样即使质量检查有效，也会把效率目标抵消。

因此，任何新 AutoPilot 能力在进入主控循环前，必须先通过本节的路由和预算。**预算是硬约束，不是建议；超预算不能通过继续加载上下文来“解决”。**

### 3.2 四档路由

路由在读取完整来源和完整规则之前完成，只读取用于分类的最小输入。无法确定时升级一档，不直接按最高档加载全部材料。

| Route | 适用条件 | 最小执行链 | 默认最大预算 |
|---|---|---|---|
| `micro` | 单一明确文件/符号；无 API、图片、表格集合、跨页面、跨 app、权限/资金/登录/密码/删除等高风险语义 | 直接定位 → 定向修改 → 确定性检查 → 一次定向验证 → compact run record | context `12k` chars；规则 3 个；reviewer 0；命令 4 个；evidence 2 个；repair 1 轮；10 分钟 |
| `lite` | 局部 bugfix 或单页面小改动；根因、范围、回归方式明确；不含不可逆副作用 | 最小 source read → scope check → 修改 → 定向质量/回归检查 → 必要时一次 review | context `24k` chars；规则 5 个；reviewer 1；命令 6 个；evidence 4 个；repair 2 轮；20 分钟 |
| `standard` | 多 surface、普通功能、来源不止一个、需要 provider/consumer 对账或 runtime evidence | 完整 source coverage → scope review → planner/reconcile → implementation → evidence → verify | context `80k` chars；规则 8 个；reviewer 2；命令 10 个；evidence 8 个；repair 3 轮；45 分钟 |
| `high-risk` | 登录/密码/权限/资金/删除/不可逆操作；跨 app/仓库；来源冲突；未知 API；集合语义；runtime critical path | 完整流程，关键决策和人工验收不可省略 | context `160k` chars；规则 12 个；reviewer 2；命令 16 个；evidence 12 个；repair 4 轮；90 分钟 |

以上数值是首版硬上限，用于先建立可比较基线，不是承诺每类需求都必须耗尽预算。`estimated_input_tokens`、真实 token 或模型计费信息无法获取时记录 `null`，不得用字符数伪造 token。

### 3.3 `micro` 最短路径

`micro` 不生成完整 source graph、全量历史 artifact、独立 coverage review 或 browser/runtime 套件，只生成：

```text
route decision
→ source snippet / direct requirement
→ target file + symbol
→ approved path set
→ one scoped change
→ one deterministic check
→ one targeted regression check
→ compact run record
```

`micro` 仍必须保留安全底线：不能写环境分支，不能覆盖已有文件，不能越出目标文件/符号，不能把检查失败写成成功。任何升级信号出现，立即转为 `lite` 或更高档，并记录升级原因。

### 3.4 自动升级条件

出现任一条件时自动升级，不需要先询问用户：

- 发现第二个未预期的实现 surface；
- 需要修改 API/schema/mock/auth/common module；
- 出现图片、表格、Figma、多个 source revision 或来源冲突；
- 出现 `all/every/each/全部/每个/所有` 等集合语义；
- 涉及登录、密码、权限、资金、删除或不可逆副作用；
- 需要跨页面、跨 app、跨仓库或 shared module；
- 需要浏览器运行时或人工视觉/业务验收；
- 发现未知 API 字段、状态、权限或路由；
- 失败超过当前 route 的 repair/command/context 预算。

自动升级只改变执行档位，不改变批准 scope；跨 app、跨仓库、deferred scope 或业务语义仍必须进入用户决策包。

### 3.5 预算熔断与死锁保护

- 达到预算的 80%：停止加载新的非必要上下文，输出当前阻塞面和剩余动作。
- 达到预算 100%：停止当前 action，落盘 `budget-exhausted`，进入可恢复的 `blocked` 或 `failed-infrastructure`，不得静默切换成完整流程。
- 同一 `inputFingerprint + failureFingerprint` 无变化时禁止重试。
- 每个 action 必须有 `heartbeat`、`deadline` 和 `nextAction`；超过 deadline 必须转终态。
- 预算消耗必须按 route、失败域和 action 记录，不能只记录总耗时。

### 3.6 效率发布指标

每次 run 至少记录：

```text
route
context_chars
estimated_input_tokens
rule_files_loaded
source_units_read
action_count
command_count
review_rounds
evidence_count
repair_attempts
elapsed_ms
user_interrupt_count
necessary_interrupt_count
silent_omission_count
false_completion_count
```

首轮发布不使用未经测量的“提速百分比”作为承诺。先用最近真实项目和 10 个代表性小需求建立 baseline，再按以下门槛判断：

1. `micro`/`lite` 不得默认进入 `standard`/`high-risk`；
2. 每次升级都有机器可解释原因；
3. 小需求的 p50/p90 context、command、review 和 elapsed 不高于基线，除非新增安全拦截并明确标注原因；
4. 三个漏项 replay fixture 的 `silent_omission_count` 和 `false_completion_count` 必须为 0；
5. 超预算必须进入终态，不得出现无限 active/retrying；
6. 用户打断必须能区分“必要决策”和“机械打断”，发布只看前者；
7. 未具备真实 token 采集能力时，不允许把 `estimated_input_tokens` 当作真实节省结果。

本节必须在 Phase 0/1 完成后先落地观测，再继续实现完整 AutoPilot。否则系统可能在质量能力增强的同时继续变慢，且无法知道变慢发生在哪个环节。

## 4. 目标架构

系统按五层组织，所有层都必须有输入、输出、指纹和终态。

```text
事实层
  source snapshot / source graph / work-item / runtime decisions
        ↓
范围层
  requirements / surfaces / dependencies / delivery target / approved scope
        ↓
对账层
  code / wiring / runtime / evidence / current content reconciliation
        ↓
执行层
  action packet / scheduler / repair / escalation / recovery
        ↓
交付层
  dev-check / evidence / verify / delivery rollup / local commit
```

### 4.1 事实和派生结果分离

| 文件 | 责任 |
|---|---|
| `work-item.json` | intake 时冻结的需求、初始 scope、surface、依赖和 delivery target |
| `source-manifest.json` 或等价 source snapshot | 输入来源、版本、媒体 hash、结构化 source unit |
| `runtime-decisions.jsonl` | 运行时的人工决策、自动处置和 source reconciliation 增量 |
| `reconcile-result.json` | 绑定 `headSha + dirtyHash + contentHash + target` 的代码/接入/运行时派生事实 |
| `latest-result.json` / `runs.jsonl` | 正式 verify 出口和历史运行记录 |
| `action-state.json` 或 work-item 内 action packet | 当前动作、预算、heartbeat、失败分类和唯一下一动作 |

派生结果不得反向伪造 source 或需求原文。需求语义改变必须走受控 reconciliation，保留原值、新值、来源、操作者和影响 surface。

### 4.2 统一状态机

采用已有 B2 十态，补充每态进入条件和终态原因：

```text
not-started
→ scoped
→ approved
→ implementing
→ partially-implemented
→ implementation-complete
→ integration-pending
→ ready-for-human-acceptance
→ delivery-ready
→ delivered
```

允许的非成功终态：

```text
blocked-user-decision
blocked-external-dependency
failed-infrastructure
failed-safety-check
cancelled
```

关键规则：

- 仍有无依赖的未完成 implement surface 时，不能进入 `integration-pending`。
- `implementation-complete` 只表示代码和 wiring 完成，不表示运行时验收完成。
- `ready-for-human-acceptance` 必须满足全部 runtime critical path。
- `delivery-ready` 必须满足当前 `headSha/dirtyHash/contentHash/target` 一致且 enforced verify PASS。
- target、source contract、approved scope、policy path 或关键 evidence scope 改变时，只让受影响的 requirement/surface/evidence 失效，不无理由清空全项目。

## 5. 人工介入协议

### 5.1 系统可以自行处理

- 已有规则明确的仓库、分支、worktree 选择；
- 同一批准 scope 内的文件落点、import、测试命名和复用判断；
- 可确定性修复的 locator glob、缺失 import、i18n key typo、Biome autofix；
- 同一 app、同一消费图内的 `policyPaths` 候选；
- API 已有 schema 下的 contract-shaped mock；
- nit finding 的批量 waive；
- 存量 typecheck 与本次新增诊断的分离；
- 已知环境故障的一次重启/清缓存尝试。

### 5.2 必须询问用户

仅在下列情况提问：

1. 多来源冲突无法由已批准的优先级规则裁决。
2. 涉及资金、权限、登录、密码、数据删除或不可逆副作用。
3. 缺少后端契约，任何实现都会猜字段、状态或权限。
4. 需要扩大到其他 app、deferred scope、其他仓库或新的业务域。
5. 两轮独立语义审查后仍有 blocker/major 语义歧义。
6. 两轮同类修复后同一失败仍存在。
7. 用户已批准的 scope、delivery target 或 defer 前提需要改变。
8. 需要用户凭据、本地人工操作或无法由系统验证的视觉/业务判断。

### 5.3 提问格式

每次询问必须是一个可执行决策包：

```text
事实：当前检测到什么
问题：哪一个决策无法安全自动作出
影响：涉及 requirement / surface / 文件 / 交付阶段
推荐：默认推荐选项及理由
选项：每个选项的后果
安全默认：不回答时保留什么、阻塞什么、继续什么
恢复：用户回答后从哪个 action 恢复
```

提问必须批量合并同一决策域，不能把 nit、可搜索问题和局部 pending 拆成多次打断。

### 5.4 决策持久化

新增或定稿 `runtime-decisions.jsonl`，最小字段：

```json
{
  "decisionId": "DEC-001",
  "ts": "2026-09-19T10:00:00Z",
  "actor": "agent|system|human:<id>",
  "type": "source-conflict|scope-change|api-blocked|auto-fix|review-waive|acceptance",
  "target": ["R-001", "S-002"],
  "before": {},
  "after": {},
  "reason": "source comparison and user decision",
  "evidence": ["source-unit-id", "finding-id"],
  "resolution": "continue|blocked|deferred|superseded"
}
```

读取方式必须是 append-only replay；同类冲突以 `supersedes` 或时间顺序明确覆盖，不能依赖聊天上下文。

## 6. 分阶段实施路线

### Phase 0A：效率预算、风险路由和基线观测

**目的**：先证明系统不会因为安全能力增强而默认变重，再进入完整 AutoPilot 主控循环。

**实现内容**

1. 在 full source read、full rules load 和 reviewer 启动之前实现 `routeRequest`，输出 `micro / lite / standard / high-risk`。
2. 将本计划 3.2 的预算固化为机器可校验的 route policy；每个 action 只能消费当前 route 的预算。
3. 新增 compact run record，至少保存：
   - route 和升级原因；
   - context/rule/source/action/command/review/evidence/repair 计数；
   - elapsed、heartbeat、deadline；
   - interruption 和是否必要；
   - silent omission、false completion 和终态。
4. 先以 `observe-only` 运行在近期真实项目回放和 10 个代表性小需求上，建立 p50/p90 baseline；没有 baseline 前不得宣称提速比例。
5. 将 `micro`/`lite` 最短路径接到 kickoff、run、verify、checkpoint；完整 source graph、browser evidence 和独立 reviewer 只能由升级信号触发。
6. 增加预算熔断：80% 停止扩展上下文，100% 进入可恢复终态；不得因为超预算自动切换成更重流程。

**首批 fixture**

- 一个单文件、单符号、无 API 的 `micro` 需求；
- 一个明确根因的 `lite` bugfix；
- `micro` 中发现第二个 consumer 后升级为 `standard`；
- 发现密码/权限/集合语义后升级为 `high-risk`；
- 命令超时、review 超预算、同一错误重复出现；
- 四个真实项目的 observe-only replay，比较当前路径和新路由的成本。

**退出条件**

- route 在重上下文加载前确定；
- 每次升级都有原因且可回放；
- 每个预算达到上限都进入终态；
- `micro`/`lite` 不会隐式加载完整流程；
- 最近真实项目和小需求已有可比较 baseline；
- 任何质量能力后续接入都不能绕过本节的预算与观测。

**依赖**：无。Phase 0 和后续所有阶段依赖本阶段的 route policy 与指标契约。

### Phase 0：冻结契约、基线和可观测指标

**目的**：先把已有实现和纸面设计收敛为唯一实现入口，避免边写边改变语义。

**主要工作**

1. 将 B1/B2/B3/F 的有效内容汇总为：
   - 唯一 schema 变更表；
   - 唯一状态迁移表；
   - 唯一人工介入矩阵；
   - 唯一失败域和预算表。
2. 给每个计划项标记 `done / partial / new / retired`，以当前代码和 self-test 为准。
3. 为每个能力定义指标：
   - `silent-source-unit-count`
   - `unexplained-implement-surface-count`
   - `false-completion-count`
   - `unsafe-write-count`
   - `necessary-interruption-count`
   - `same-failure-retry-count`
   - `recovery-success-rate`
   - route/预算消耗和升级原因；
   - `context_chars`、`command_count`、`review_rounds`、`elapsed_ms`；
4. 冻结 fixture 命名、输出目录和迁移策略。

**代码/文档落点**

- `common/engine/schemas/`
- `common/engine/fixtures/`
- `common/vnext/README.md`
- `common/CHANGELOG.md`
- 新增一份能力矩阵，不再新增第二份重复总计划。

**Fixture**

- PR-02233：pivot、provider/consumer、局部 API pending、runtime 不足；
- hichat：Bugfix Lite、错误分支、已有测试文件；
- TR-02386：预存目录、缺 workflowVersion、deliveryScope；
- MA-010：defer 失效、DTO 不足、局部继续；
- source reconciliation：PRD/Figma/stakeholder 冲突；
- clean project：从唯一 PRD 输入开始。
- `PR-01947`：上线事实与历史 gate 不一致；
- `PR-02265`：清单存在但验收/类型质量未闭环；
- `PR-02306`：图片入口需求漏抽；
- `PR-01930`：第三个 consumer 漏覆盖；
- efficiency replay：同一小需求分别走旧路径和四档 route。

**退出条件**

- 所有能力都有唯一 owner、输入、输出、fixture 和失败终态；
- 已有代码不再被旧计划误标为“未实现”；
- 方案评审可以只审查差异和新增行为；
- 不通过则禁止进入主控循环编码。

**依赖**：Phase 0A。

### Phase 1：Safe Run，安全上下文与幂等开工

**目的**：在任何自动理解和写码之前，先保证写入边界正确。

**用户可见行为**

用户提供需求后，系统自动返回：

```text
consumer repo
worktree
branch
baseRef
target app
workflow version
existing WIP
next action
```

发现已有目录或未归属 WIP 时，系统诊断并恢复，不静默当作新项目或覆盖。

**实现内容**

1. 新增统一 `resolveWorkContext`：
   - 定位消费仓和真实 Git root；
   - 判断当前 branch 是否为环境分支；
   - 计算 feature/fix branch；
   - 创建或复用隔离 worktree；
   - 绑定 project、target app、baseRef 和当前 HEAD；
   - 检测其他 WIP 和未归属 dirty paths。
2. 将 resolver 接入 kickoff、run、write、checkpoint、commit 和交互式 Agent 前置 hook。
3. 写入前检查：
   - 目标文件是否已存在；
   - 是否 tracked；
   - 是否属于当前 action 和批准 scope；
   - 是否被其他 WIP 归属；
   - `write` 是否应改为 `edit`。
4. 增加官方 WIP 保存档：
   - 只保存 patch/ref/action state；
   - 明确 `non-delivery`；
   - 不生成 PASS、完成或 ready-for-delivery。
5. 所有 action packet 持久化：
   - `actionId`
   - phase/action
   - input fingerprint
   - attempt/heartbeat/timeout
   - retry budget
   - failure class
   - recovery action
   - terminal transition

**不做**

- 不把 `DOCS_TDD_COMMIT_MODE=off` 作为标准成功路径；
- 不使用 `--no-verify` 作为系统能力；
- 不批量迁移 `workflowVersion: 2`；
- 不自动 push。

**Fixture**

- 在 `online/pre/test/dev` 分支尝试写入，必须 fail-closed；
- 当前目录已有 v1/v2 混合文件，必须诊断；
- 已有 `thirdConfig.test.ts`，新建动作必须被拦截；
- 中途 kill 进程后重复 `run`，不能重复建分支或覆盖文件；
- 工作区含他人 WIP，系统必须分离或询问；
- WIP 保存后新会话能恢复。

**退出条件**

- 安全分支直接写入次数为 0；
- 已有文件被 `write` 覆盖次数为 0；
- 同一 kickoff 重跑幂等；
- 任意 active action 都有 heartbeat、预算和解除条件；
- 中断恢复至少通过 intake、implementation、commit 前三个断点。

**依赖**：Phase 0。

### Phase 2：Source Graph 与确定性 Coverage Compiler

**目的**：把“完整理解来源”从模型记忆变成可重放的 source graph。

**用户可见行为**

系统对 PRD、Markdown/HTML 表格、图片、Figma、API、验收表和后到 stakeholder decision 给出：

```text
来源版本
source unit 数量
已覆盖 requirement
显式排除
未决冲突
受影响 surface
需要用户决策的最小问题
```

**实现内容**

1. 统一 source unit：
   - paragraph/bullet；
   - table/container；
   - table row/cell；
   - image/spec；
   - Figma node；
   - API field/contract；
   - acceptance row；
   - stakeholder decision。
2. 每个 unit 绑定：
   - source id/location；
   - content/media hash；
   - parser；
   - disposition；
   - requirement ids；
   - exclusion reason；
   - source priority/conflict set。
3. Coverage compiler 确定性生成：
   - requirements；
   - surfaces；
   - dependency edges；
   - evidence plan 候选；
   - runtimeRequired；
   - source-to-requirement-to-surface 链。
4. compiler 在 reviewer 前检查：
   - 所有 source unit 有处置；
   - collection/all/every 要求有全集；
   - acceptance row 无漏挂；
   - 多 evidence type 生成完整组合；
   - `expectedCount` 和实际 surface 一致；
   - duplicate/contradictory ids；
   - deferred/not-doing/implement 冲突。
5. 后到 source 只使受影响图谱失效：
   - source unit；
   - 相关 requirement；
   - 相关 surface；
   - 相关 evidence；
   - 相关 reconcile/verify。

**安全规则**

- Figma 不能永远无条件优先；使用 source priority matrix。
- AI 不得无痕改写 source-attributed 需求。
- PRD/Figma/stakeholder 冲突必须进入 reconciliation。
- 图片必须经过真实读取和 media type 校验，不能把登录 HTML 当图片。

**Fixture**

- HTML/Markdown 表格逐行覆盖；
- 图片 URL 返回登录 HTML；
- 一条 requirement 同时需要 DOM、pure logic、browser 三类证据；
- “全部页面/每种方式”要求漏一个 surface；
- Figma 顺序与 PRD 顺序冲突；
- API 后到只使绑定的 surfaces stale；
- stakeholder 修改验收语义并保留 before/after。

**退出条件**

- `silent-source-unit-count = 0`；
- 每个 implement surface 都能反向追溯 source unit；
- collection 类要求有完整集合断言；
- source 更新不会静默沿用旧 evidence；
- reviewer 收到的是 compiler 产物而不是未结构化原文猜测。

**依赖**：Phase 0；需要 Phase 1 提供稳定 project/worktree identity。

### Phase 3：Scope、Review 和最小提问策略

**目的**：把 scope approval、语义审查、人工 override 和用户问题合成一条可恢复协议。

**实现内容**

1. 增加风险路由：
   - 复用 Phase 0A 的 `micro / lite / standard / high-risk`；
   - `source-conflict` 和 `external-dependency` 作为失败域，不再创建第五套流程模式。
2. `lite` 仅在根因、文件/symbol、回归方式、风险边界都明确时启用；登录、密码、权限、资金、删除、跨应用和产品语义不明自动升级。
3. Review 分级：
   - `blocker`：必须关闭；
   - `major`：修复或人工接受；
   - `nit`：可批量 waive；
   - `false-positive`：进入申诉。
4. 独立语义 reviewer 最多两轮；相同 finding、超时、传输失败和语义不确定分别记账。
5. 允许 unchanged fingerprint 的跨 client/strategy 复审，但不重置预算。
6. 正式动作：
   - `scope-approve`
   - `begin-implementation`
   - `review-defer`
   - `accept-incomplete-scope`
   - `decide`
7. 所有 override 和用户选择写入 `runtime-decisions.jsonl`。

**关于自动扩 scope 的限制**

- 系统可以提出同 app、同消费图内的候选 `policyPaths`；
- 不能直接把候选写入已批准 scope 并视为用户批准；
- 跨 app、跨 deferred、跨业务域必须询问；
- 越界路径可选择：
  1. 用户批准扩 scope；
  2. 拆分到独立 commit/action；
  3. 标记为 infrastructure blocker；
  4. 停止 delivery，保留 WIP。

**Fixture**

- nit 与 blocker 混合；
- review 两轮后仍有同一 blocker；
- reviewer transport timeout；
- 用户批准进入实现后状态必须推进；
- 无延期项目不伪造 deferred finding；
- 预存目录缺 workflowVersion；
- policyPaths 越界但可生成候选前缀；
- policyPaths 越界且跨 app，必须问。

**退出条件**

- 中等需求的用户打断集中在真实决策，不再被机械 nit 打断；
- 每次用户决策在新会话可复用；
- review 不超过预算；
- 未经批准不扩大 delivery scope；
- `micro`/`lite` 和完整流程的升级条件可由 fixture 复现。

**依赖**：Phase 1、Phase 2。

### Phase 4：Implementation Planner 与 Surface Reconciliation 闭环

**目的**：让系统根据未完成 surface 自主排程，而不是依赖 Agent 自报“已实现”。

**当前地基**

`vnext-reconcile`、`reconcile-result.json`、provider/consumer、pivot invalidation 和 verify 接线已经存在，本阶段只补齐其成为主控事实源所需的缺口。

**实现内容**

1. 将 surface 调度顺序固定为：

```text
source/schema
→ mapper/contract
→ provider
→ consumer
→ runtime scenario
→ evidence/acceptance
```

2. 每一轮 action 前重新计算：
   - missing/partial/stale；
   - provider/consumer dependency；
   - blockedBy；
   - target/source/scope stale；
   - 可并行 surface；
   - 本轮唯一 action。
3. consumer 证据分层：
   - import；
   - render；
   - event binding；
   - browser path；
   - side effect。
4. `policyPaths` 从消费图提出候选：
   - feature 目录；
   - shared component；
   - i18n hook/resource；
   - mock handler；
   - endpoint contract；
   - auth/common module；
   - 对称页面。
5. dependency blast radius 下沉到 requirement/surface：
   - 影响阶段；
   - 不影响阶段；
   - 解除条件；
   - 可继续 surface；
   - 是否阻塞 delivery。
6. 只对受影响图重算，不因一个 API pending 清空整批。

**关键完成判据**

```text
implementation-complete =
  所有 implement surface codeStatus=covered
  且 wiringStatus=covered 或 n/a
  且无 missing/partial/stale
```

组件、provider、测试文件或字符串存在都不能单独关闭 surface。

**Fixture**

- provider 存在、Login/Register/ResetPassword consumer 缺失；
- provider 和 consumer 都存在但点击链路缺失；
- target 从 `apps/web` pivot 到 `apps/web-next`；
- API 只阻塞两个 surfaces，其他 surfaces 必须继续；
- shared `CodeVerifyDialog` 不在初始 policyPaths；
- 新发现 surface 进入待办队列；
- 同一 surface 修复后只局部重验。

**退出条件**

- 每个 implement surface 都能产生三维 reconciliation；
- provider 完成不能推导 consumer 完成；
- pivot 后旧结果不能计入新目标；
- API pending 只阻塞受影响 surfaces；
- 未完成 surface 队列为空或每项都有明确 blocker/deferred/not-doing。

**依赖**：Phase 1–3；复用当前 reconciliation 地基。

### Phase 5：Evidence Sufficiency、Runtime 和人工验收

**目的**：让证据足以支撑结论，而不是只证明“命令跑过”。

**实现内容**

1. evidence kind 分为：
   - 功能：`pure-logic`、`component-dom`、`api-contract`、`browser-interaction`、`payload-contract`；
   - 人工：`human-check`；
   - 结构/质量：`structural`、`quality`、`touched-file-quality`。
2. `human-check` 一等 producer 必须记录：
   - 步骤；
   - 预期；
   - 实际；
   - 结果；
   - 操作者；
   - 时间；
   - HEAD/dirty hash；
   - 截图/录屏；
   - 未通过项。
3. claim-to-assertion 审计：
   - 命令绑定过多 requirement/surface；
   - provider 证据证明 consumer；
   - DOM 存在证明副作用；
   - mock response 证明真实 UI；
   - 静态字符串证明完整交互；
   - 泛化测试证明特定业务路径。
4. runtime critical path 自动从动作语义识别：
   - 点击、打开、切换、选择、关闭后、提交后、恢复、禁用、重发、跳转。
5. runtime 最低结构：

```text
precondition
→ action
→ visible result
→ state/data side effect
→ negative case
```

6. 展开 package/workspace script，判断命令是否真实 scoped；表面带文件参数但实际跑整包时 fail-closed。
7. typecheck 输出 whole-command、baseline、new、touched-file 四类结果，不把历史噪声冒充本次失败。

**退出条件**

- 每个 runtime critical path 有直接 runtime 或真实 human evidence；
- mock、DOM、browser、human、quality 证据不互相冒充；
- overclaim 能 warning 或 error；
- scoped command 展开可解释；
- `ready-for-human-acceptance` 时没有缺失 runtime critical path。

**依赖**：Phase 4。

### Phase 6：Bounded Repair、失败分类和死锁恢复

**目的**：把验证失败自动带入有限修复链，失败后仍有唯一恢复动作。

**统一协议**

```text
observe
→ classify
→ repair or escalate
→ revalidate
→ continue or terminal
```

**失败域和预算**

| 失败域 | 允许自动处理 | 默认预算 | 预算耗尽 |
|---|---|---:|---|
| source/intake | 重新解析受影响 source、修复结构性抽取 | 1 | `blocked-user-decision` |
| scope/review | 机械修复、重跑不同 reviewer | 2 轮 | 人工裁决 |
| code | import、locator、Biome、单属性契约 | 2 轮 | `escalate-repair-failure` |
| browser/runtime | 重跑、白名单交互修复 | 2 轮 | 人工或 blocker |
| environment/tooling | 重启、清缓存、修复命令入口 | 1 轮 | `failed-infrastructure` |
| external dependency | 仅验证是否已解除 | 0 次猜测 | `blocked-external-dependency` |

**禁止**

- 自动猜 API 字段、权限和状态；
- 自动修改 source-attributed 需求原文；
- 自动扩大跨 app scope；
- 同一 fingerprint + 同一错误无变化重试；
- 用户不回复时自动把真实 blocker 伪装成 deferred。

**退出条件**

- 每个失败都能分类；
- 修复后只重跑受影响验证；
- 预算耗尽必然落盘并生成恢复命令；
- 新会话能从 blocked 状态继续；
- 任何 action 不会永久保持 active/waiting/retrying。

**依赖**：Phase 3–5。

### Phase 7：Delivery Truth、Scope-derived Commit 和恢复提交

**目的**：让最终提交只包含批准且已证明的内容，提交摘要不夸大。

**实现内容**

1. `policyPaths` 使用三态归属：
   - `delivery`：本次业务交付；
   - `infrastructure`：为运行/验证所需的环境修复；
   - `unowned`：禁止提交，必须归属或撤销。
2. delivery path set 从：

```text
approved requirements
→ surfaces
→ code locators
→ provider/consumer graph
→ shared dependencies
```

   生成候选，再经 scope approval 冻结。
3. checkpoint：
   - 允许保存不完整实现；
   - 标记 `non-delivery`；
   - 使用 `partial/WIP` 摘要；
   - 可不具备最终 PASS，但必须满足最小安全和真实 changed paths。
4. delivery commit：
   - 当前 reconcile、evidence、verify 指纹一致；
   - enforced PASS；
   - frozen path set；
   - commit message 与未完成 surface rollup 对账；
   - hook 改写字节后自动回到重验。
5. 完成话术由 rollup 生成：

| 状态 | 允许表达 |
|---|---|
| `partially-implemented` | 部分实现，列出未完成 surfaces |
| `integration-pending` | 前端实现完成，仅指定依赖 pending |
| `ready-for-human-acceptance` | 已具备人工验收条件 |
| `delivery-ready` | 已通过正式交付验证 |
| `delivered` | 已完成本地交付提交 |

**退出条件**

- staged 路径不能夹带他人 WIP；
- 越界路径有候选归属和明确动作；
- checkpoint 不会被误读为 delivery；
- delivery commit 不接受 overclaim；
- 系统永不自动 push。

**依赖**：Phase 1、Phase 4–6。

### Phase 8：真实项目认证、shadow、pilot、enforced

**目的**：证明系统不是只在 self-test 和 synthetic fixture 中工作。

**顺序**

1. **shadow**：对现有真实项目只生成 action/reconcile/decision，不写代码、不提交。
2. **assisted pilot**：允许系统执行，人工批准 scope、冲突和最终 delivery。
3. **bounded autopilot**：系统自动处理白名单修复和局部 pending，人工只处理决策包。
4. **enforced**：满足发布门槛后，允许“只给需求”作为默认入口。

**必须通过的项目**

- `PR-01947` delivery truth replay；
- `PR-02265` requirement-to-evidence replay；
- `PR-02306` image/source-to-surface replay；
- `PR-01930` expected consumer collection replay；
- PR-02233；
- hichat bugfix；
- TR-02386；
- 10 个真实 `micro`/`lite` 小需求成本样本；
- 一个多模态/多 evidence 新功能；
- 一个全新 clean project；
- 一个中断恢复项目；
- 一个 API pending 局部继续项目。

**退出条件**

- 0 个静默 source unit；
- 0 个未解释 implement surface；
- 0 个错误分支写入；
- 0 个已有文件被 write 覆盖；
- false completion = 0；
- same failure 无预算外重试；
- 所有用户决策都可重放；
- clean project 从唯一需求输入到本地 delivery commit；
- 统计必要打断次数，而不是只统计总打断次数。
- `micro`/`lite` 的 p50/p90 context、命令数、review 轮数和 elapsed 不高于 Phase 0A baseline；
- `micro`/`lite` 无未解释的 `standard`/`high-risk` 升级；
- 质量指标通过但效率退化时，不得进入 enforced。

**依赖**：Phase 0–7 全部完成。

## 7. 迁移与兼容策略

### 7.1 v1/v2 兼容

- `workflowVersion: 2` 继续表示第二代 work-item 协议，不改为 3。
- v1 继续走 G0–G8，不把 v2 证据和状态强行写入 v1。
- 新项目默认 v2。
- 预存目录缺版本时：
  - 输出诊断；
  - 默认建议 v2；
  - 检测到 legacy artifact 时要求明确选择；
  - 禁止静默降级 v1。

### 7.2 旧 artifact

- 默认只读诊断；
- 只有负责人显式执行迁移命令才写入；
- 缺 `codeFingerprint.contentHash` 必须重新 verify；
- 不得用 `dirtyHash` 冒充内容身份；
- 无 receipt 的旧结果最多降级为 assisted/caller-supplied，不能伪造 autonomous PASS；
- 旧 string locator 项目保持兼容，不强制一次性补齐结构化 locator。

### 7.3 渐进启用

每项新能力提供 feature capability：

```text
legacy-compatible
observe-only
enforced
```

启用顺序：

1. fixture/self-test；
2. clean temporary Git E2E；
3. shadow real project；
4. assisted pilot；
5. enforced。

## 8. Rollout、观测和回滚

### 8.1 运行时观测

每次 `run` 记录：

- route、route 升级原因和 route policy 版本；
- project/worktree/branch；
- actionId 和 input fingerprint；
- source graph fingerprint；
- code/dirty/content hash；
- target；
- 当前状态；
- retry budget 使用；
- 用户打断及是否必要；
- blocked surfaces；
- 最终恢复命令。
- context/rule/source/action/command/review/evidence/repair/elapsed 预算实际消耗。

### 8.2 回滚原则

- schema 新字段必须 optional 或有兼容默认；
- 派生 artifact 可以删除后重新生成，不能手改成 PASS；
- 新主控只在 capability=enabled 的项目启用；
- route policy 与质量能力分开开关：效率退化时可关闭重能力，但不能关闭 Safe Run、内容指纹和 delivery guard；
- 若新 reconciliation 失败，旧 string locator 项目回退旧路径；
- 若修复执行器异常，停止自动修复但保留失败证据和 WIP；
- 任何回滚都不能绕过 branch/worktree、delivery guard 或内容指纹。

### 8.3 发布门槛

不得因为“自测通过”直接宣布 AutoPilot 完成，必须同时满足：

```text
fixture pass
∧ real Git E2E pass
∧ clean project pass
∧ interruption recovery pass
∧ no silent omission
∧ no false completion
∧ bounded retry
∧ local delivery commit accurate
∧ micro/lite cost not regressed
∧ route escalation explainable
```

### 8.4 质量与效率双门槛

发布判定分成两个独立门：

```text
quality gate =
  silent omission = 0
  ∧ false completion = 0
  ∧ unsafe write = 0
  ∧ replay fixtures pass

efficiency gate =
  micro/lite p50/p90 不高于 baseline
  ∧ 无隐式 full-flow
  ∧ 无预算外重试
  ∧ necessary interruption 可解释
```

只有两个门都通过才能升级 capability。质量通过、效率失败时保持 `observe-only` 或 `assisted`；效率通过、质量失败时同样不能 enforced。

## 9. Definition of Done

### AP-1 Safe Run

- 自动识别消费仓、worktree、branch、baseRef、target；
- 环境分支写入被拦截；
- 文件覆盖被拦截；
- action 有持久状态、heartbeat、预算和终态；
- 中断可恢复；
- WIP、checkpoint、delivery 清晰分离。

### AP-2 Truthful Completion

- source unit 无静默遗漏；
- implement surface 无未解释项；
- provider/consumer 可区分；
- target pivot 会使旧事实失效；
- API pending 只局部阻塞；
- runtime critical path 有足够证据；
- 完成话术和 commit 摘要不能 overclaim。

### AP-3 Autonomous Execution

- 未完成 surface 自动生成下一 action；
- 可继续项不被 blocked 项拖住；
- 白名单失败自动修复并重验；
- 同一失败不无限重试；
- 用户决策只问一次且可重放；
- 所有动作进入成功、阻塞或失败终态。

### AP-4 Qualified AutoPilot

- clean project 从需求到本地 delivery commit；
- `micro`/`lite` 正确分流且没有成本回退；
- 多模态 source reconciliation 可恢复；
- 人工验收有一等证据；
- API/环境/浏览器失败有边界；
- 中断后新会话能继续；
- 无需用户提供聊天上下文才能恢复。

## 10. 明确不做

1. 不继续增加 reviewer 轮数来替代 coverage compiler。
2. 不把所有失败交给模型自由修复。
3. 不自动猜 API 字段、权限、金额和不可逆状态。
4. 不自动扩大到其他 app、deferred scope 或其他仓库。
5. 不因用户暂未回复就把真实 blocker 伪装成 deferred。
6. 不把 Figma 永远设为最高优先级来源。
7. 不把 browser smoke、mock 或静态 DOM 存在性冒充完整业务验收。
8. 不把存量 typecheck 错误直接算成本次失败。
9. 不要求每个 checkpoint 都具备最终 delivery PASS。
10. 不批量迁移 `workflowVersion`，不静默改写历史 artifact。
11. 不为了通过预算提高 hard limit；超预算应拆分模块或下沉按需文档。
12. 不在没有真实 clean project pilot 前宣布 AutoPilot 达成。
13. 不允许 `micro`/`lite` 预加载完整 source graph、全部历史 artifact 或全套规则。
14. 不把“自动升级”为借口绕过预算熔断；升级必须先结束当前 action 并记录原因。
15. 不沿用旧设计中的 `policyPaths auto-extend`；系统只能提出候选，批准 scope 不能被静默改写。
16. 不因高风险流程有效，就让所有需求默认按高风险流程执行。

## 11. 主要新增风险及控制

| 新风险 | 可能后果 | 控制 |
|---|---|---|
| 路由误判为过轻 | 漏 source、surface 或 runtime 路径 | 确定性升级信号；shadow 对照；delivery 前重新检查风险特征 |
| 路由误判为过重 | 小需求继续变慢 | 硬预算；升级原因审计；p50/p90 门槛；允许降级重跑 |
| 指标采集本身膨胀 | artifact 和维护成本增加 | compact run record；只保留决策和计数；详细 trace 按失败开启 |
| source graph 过度建模 | 实现成本和 token 上升 | 仅 `standard/high-risk` 建完整图；`micro/lite` 使用最小 source snapshot |
| fixture 过拟合 | 历史案例通过，新问题仍漏 | 保留 clean project、未知新需求和人工冷读抽样 |
| 自动修复改错语义 | 代码“通过”但业务错误 | 白名单修复；高风险字段禁止猜测；同一失败最多有限轮次 |
| 状态机/兼容层复杂化 | 迁移卡死或状态冲突 | capability 独立开关；append-only decision；旧项目默认只读诊断 |
| 只优化 token 忽视时延 | 模型调用少但命令/等待仍慢 | 同时记录 context、command、review 和 elapsed，不用单指标优化 |
| 为减少提问而擅自决策 | scope 扩大或业务语义被改写 | 决策权限表；跨 app/API/高风险语义必须询问；安全默认是阻塞 |
| 规则继续重复增长 | Claude/Codex 都被长上下文拖慢 | 单一 router；按 route 限制规则文件数；重复规则由 CI/doctor 拦截 |

这些风险不能靠文档声明消除，必须分别有 fixture、指标或 feature flag。没有控制手段的能力不进入 enforced。

## 12. 对两个核心问题的结论

### 12.1 能否切实解决当前痛点

**可以显著解决，但条件是按本计划的顺序落地并通过真实项目双门槛，不能只实现完整 AutoPilot。**

- 小需求耗时/token 高：由 Phase 0A 的最短路径、规则/context/命令/review/evidence 预算直接治理。
- 明显 PRD 功能漏做：由 source unit coverage、collection/entry surface、expected consumer count 和 requirement-to-evidence 绑定治理。
- Claude/Codex 变慢：通过 route 前置、按需规则、停止全量 artifact 加载和有限 reviewer/repair 控制，而不是继续叠加提示词。
- 卡死：通过 action deadline、失败指纹、预算熔断、持久化终态和恢复命令治理。
- 误报完成：通过 surface reconciliation、freshness、runtime evidence 和 delivery rollup 治理。

能够承诺的是“遗漏和阻塞不再静默、成本可测且受预算约束”；不能承诺任何新需求绝对零遗漏、模型永不出错或每次都比人工更快。

### 12.2 会不会带来其他问题

会有新增复杂度和路由误判风险。如果不做 Phase 0A，完整 source graph、reconciliation、runtime evidence 和 repair loop 很可能进一步放大耗时与 token；如果只追求轻量，又可能恢复漏需求。

因此本计划把成功条件定义为：

```text
质量不退化
∧ 小需求成本不回升
∧ 高风险需求不降级
∧ 所有超预算/阻塞有终态
```

任一条件失败都只保留在 `observe-only`/`assisted`，不替换当前默认流程。这样新增问题会在 shadow/pilot 阶段暴露，而不是直接扩散到所有项目。

## 13. 最终实施顺序

```text
Phase 0A 效率路由、预算、基线观测
  ↓
Phase 0  冻结契约、指标和真实项目 replay
  ↓
Phase 1  Safe Run：上下文、分支、worktree、WIP、终态
  ↓
PR-01947/02265/02306/01930 replay + micro/lite pilot
  ↓
Phase 2  Source Graph：仅 standard/high-risk 完整启用
  ↓
Phase 3  Scope/Review：最小提问、人工决策、有限审查
  ↓
Phase 4  Planner/Reconcile：未完成 surface 驱动实现
  ↓
Phase 5  Evidence/Runtime：证据强度和人工验收
  ↓
Phase 6  Repair/Recovery：有界修复、失败分类、死锁恢复
  ↓
Phase 7  Delivery Truth：scope-derived commit 和摘要约束
  ↓
Phase 8  Shadow → Pilot → Enforced
```

最先可实施的编码批次不是“大主控循环”，而是：

1. Phase 0A 的 route policy、compact metrics 和预算熔断；
2. Phase 0 的能力矩阵，以及四个近期项目的漏项 replay；
3. Phase 1 的 `work-context resolver`、WIP/终态和写入前保护；
4. 用 `micro`/`lite` 小需求、PR-02233、hichat、TR-02386 做成本与质量回放；
5. 只有 Safe Run、Truthful Completion 和 efficiency gate 同时达标后，才接入完整 source graph、runtime decision、auto-disposition 和主控循环。

这样每一步都有真实输入、确定性输出、失败边界和回滚方式，最终才有资格兑现“只给需求，系统负责完成到安全本地提交”的承诺。
