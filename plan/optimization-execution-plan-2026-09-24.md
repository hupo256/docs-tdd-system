# docs_tdd 优化落地计划：面向下一次需求

> 日期：2026-09-24
> 最近更新：2026-09-25
> 状态：in-progress
> 范围：`docs_tdd` 新需求主路径、覆盖契约、执行器、效率度量与 Pilot
> 目标路径：用户给需求 -> 安全 worktree -> 完整理解 -> 必要时询问 -> 实现 -> 定向验证与修复 -> 本地提交；不自动 push

## 1. 成功标准

- **不静默漏需求**：每个 semantic source unit 都有 requirement anchor 或可验证排除；不完整内容 fail-closed。
- **不假完成**：action packet、准备脚本、模拟和未执行检查不能被报告为完成或通过。
- **小需求低成本**：只加载必要上下文、执行 touched-file 检查，不用历史项目和长篇方法论占据每次窗口。
- **可连续执行**：Runner 能推进确定性动作，宿主 Agent 完成语义动作；只有业务裁决、V2 scope approval 或外部依赖才打断用户。
- **安全交付**：只在隔离 worktree 写业务代码，只提交冻结范围，不自动 push。
- **结果可度量**：质量、耗时、命令数、人工中断、返工和真实模型 usage 分开记录；缺失值保持 `null`。

不承诺 AI 绝对零遗漏。系统通过逐单元对账、独立 review 和正式 verify，把遗漏从“静默发生”变成“可见失败”。

## 2. 设计约束

1. 只保留一个默认 v2 入口：`docs-tdd run <PROJECT-ID> --prd <source>`。
2. 不再新增平行 Gate、快速模式或 disposition 词表。
3. assurance 与 execution route 分离：风险决定保障强度，规模决定执行成本。
4. 规则按场景渐进加载；机器能验证的约束不重复写成长提示。
5. synthetic test 验证机制，新需求 Pilot 验证真实效果；历史项目不作为发布前置。
6. 未配置宿主 adapter 时诚实返回 `needs-agent`；需要人工裁决时返回 `needs-user`。

## 3. 当前契约

### 3.1 来源处置

- requirement 的 `sourceAnchors` 表示该 source unit 已进入需求。
- 未进入需求的 semantic unit 只能标记 `not-a-requirement`，并提供：
  - `reason`
  - `exclusionEvidence.basis`
  - 来源内可定位的 `exclusionEvidence.sourceQuote`
- “自然展示、自动生成、沿用现有逻辑”本身不是排除证据。同一 source unit 还包含新增字段、按钮、入口、导出、筛选等明确功能时，排除必须失败。
- 不可读图片、表格或嵌入对象不能默认无需求。

### 3.2 Surface 处置

沿用现有枚举：

| disposition | 含义 | 最小条件 |
|---|---|---|
| `implement` | 本次实现 | 来源锚点、代码落点、证据计划 |
| `already-covered` | 当前能力已覆盖 | 当前代码定位及对应验收证据 |
| `not-applicable` | 对该 requirement 不适用 | 可审计理由 |
| `deferred` | 延后到明确批次 | 理由、owner、batch |

未决来源不新增 disposition；它通过 extraction audit、coverage review 或审批状态阻断。

## 4. 工作包

### WP0：入口与真值止损

状态：`in-progress`

已完成：

- 默认 `kickoff` 进入 v2；旧 `kickoff-v4` 仅兼容转发并拒绝 `--force-lite`。
- Lite executor 禁止写入，不能生成 approved、scope approval 或 authoritative pass。
- `run --prd` 可初始化/恢复并在无 adapter 时返回 `needs-agent`。
- 来源变化、损坏状态、非法路径和 v1/v2 混用 fail-closed。

剩余：

- 核对所有公开帮助和入口没有旧 Lite 成功语义。
- 保持内容 fingerprint 确定性和重复运行幂等。

### WP1：来源覆盖真值

状态：`synthetic-tested`

工作项：

- 强制 `not-a-requirement` 使用可核验原文证据。
- intake audit、source graph、coverage verify 和 review request 使用同一判定。
- synthetic fixture 覆盖：
  - 合法 context-only 排除。
  - 缺失证据和错误引用。
  - “自然展示 + 明确新增功能”不得整单元排除。
  - 任一 semantic unit 未处置时失败。
- extraction action packet 删除历史案例和重复方法论，仅输出短契约与命中的领域检查。

退出条件：

- [x] 相关 self-test 确定性通过。
- [x] 错误排除和未处置来源均 fail-closed。
- [x] 只报告 `synthetic-tested`，未报告 E2E/Pilot。

### WP2：连续 Runner

状态：`e2e-tested`

已完成：

- 公开 `run` 主路径已接入 Continuous Runner 和四类 Action Executor Registry：`deterministic`、`agent`、`human`、`external`。
- Runner 持久化 active checkpoint 与 completion receipt；重复调用可恢复，成功 receipt 不静默重放，最多执行 20 步。
- deterministic action 已接入 safe worktree、surface reconciliation、evidence/revalidate/verify 和 scoped local commit。
- Codex/Claude Host Agent adapter 已接入 extraction、独立 coverage review 和代码 checkpoint；模型输出必须先过 JSON schema、canonical apply、intake audit 或 Git changed-path 对账。
- Codex review 支持 read-only sandbox、图片附件、非 Git 临时目录和签名 receipt；reviewer client 与 requirements author client 分离。
- timeout、取消、无效输出分别收敛为 `failed-infrastructure`、`needs-user`、`failed-safety-check`；同 invocation 的同类基础设施/安全失败第二次进入 `budget-exhausted`。
- Agent 代码动作中断后比较代码 fingerprint；发生变化时先 reconcile。delivery commit 中断后核对 HEAD、提交标题、冻结路径和 scope clean，再补 canonical delivery record。
- 无宿主 Agent adapter 时明确返回 `needs-agent`；人工和外部依赖分别返回 `needs-user`、`blocked-external-dependency`。
- `resume-review-after-human-repair` 已按命令契约归类为 human；尚无 canonical checkpoint 契约的 manual-test repair 与通用 `resolve-blockers` 仍明确停在 `needs-agent`，不伪装为已自动闭环。
- 临时 Git 仓库 self-test 已验证连续执行、提交中断恢复、只提交冻结路径，且未调用 `git push`。
- clean-project public-command E2E 已从单一 PRD 输入跑通抽取、独立 review、隔离 worktree、编码、enforced PASS、冻结路径本地提交，并断言未调用 `git push`。

后续增强（不阻塞批次 C）：

- 增加公开命令下真实 repair action 的二次失败预算和中断恢复 E2E；现有 synthetic 层已覆盖这两类状态机契约。

退出条件：

- [x] clean project 通过公开单输入命令到 enforced PASS 和本地 commit。
- [x] synthetic 层的超时、取消、无效输出、恢复和重复失败预算都有唯一终态。

### WP3：Micro 与成本

状态：`e2e-tested`

Micro 初始条件：

- 单一明确需求，1-2 个相邻 Surface。
- 无 API/schema/权限/资金/不可逆变化。
- 无集合语义、来源冲突或不可读附件。

任何风险、范围或来源复杂度上升都自动升级 route。Micro 仍保留完整 source-unit coverage 和正式 verify，只省略非必要 reviewer、上下文与全仓检查。

退出条件：

- [x] clean-project Micro E2E 中 reviewer 轮次 0，机械性用户中断 0。
- [x] clean-project Micro E2E 只执行必要的定向检查和正式 verify。
- [x] trace 记录 route、assurance、命令、耗时、返工及真实 usage；宿主未提供 token usage 时保持 `null`，不估算。

当前结论仅为 **Micro 基础设施 E2E 已通过**。尚未完成任何新需求 Pilot，批次 D 仍在进行中，不能标记为 `pilot-certified` 或“批次 D 完成”。

### WP4：新需求 Pilot

状态：`in-progress`

Pilot 于 2026-09-25 经 owner 确认正式启动。样本与结果统一记录在 [real-demand-pilot-2026-09-25.md](./real-demand-pilot-2026-09-25.md)；系统根据需求事实自动判定 V0/V1/V2 和 execution route，不由人工为了凑样本指定等级。

验证层次：

1. 契约 self-test：纯函数、schema、状态转移、预算、提交范围。
2. synthetic workflow：正负 fixture 和 clean-project public-command E2E。
3. 新需求 Pilot：至少各 1 个 V0/V1/V2 完整样本，并收集至少 10 个可比 micro 样本。

发布门槛：

- silent omission、false completion、越界写入、未经授权 push 均为 0。
- V0/V1/V2 均完成真实需求、代码验证和提测观察。
- micro 相对同复杂度基线 p50 总历时下降至少 30%，p90 不恶化超过 10%。
- token 只有在宿主提供真实 usage 且样本可比时才作结论。

达到门槛只输出 `eligible-for-owner-cutover-review`，由 owner 决定是否切换默认路径。

## 5. 批次

| 批次 | 内容 | 退出条件 |
|---|---|---|
| A | 清理假通过、重复规则和历史旁路 | 默认入口一致；doc-budget 本轮项清零 |
| B | 强化现有 intake 契约 | synthetic negative/positive fixtures 通过 |
| C | Runner 闭环 | clean-project 单输入 E2E 到本地 commit |
| D | Micro 与度量 | 新需求样本达到质量和效率门槛 |
| E | owner cutover | 证据完整且 owner 明确批准 |

每批独立验证。发现新的失败模式时补最小 synthetic regression，不回头建设历史项目档案。

## 6. 状态词

仅使用：

- `planned`
- `in-progress`
- `implemented`
- `wired-to-run`
- `synthetic-tested`
- `e2e-tested`
- `pilot-certified`
- `blocked`

准备脚本只能报 `ready`，模拟只能报 `simulated`，未执行检查记 `not-required` 或未执行，不能记通过。

## 7. 当前实施记录

本轮聚焦 A/B/C，并完成 D 的基础设施 E2E：

- 压缩常驻 router 和 extraction action packet。
- 退役无生产消费者的旧 v4 context loader、重复规则和 phase1 历史验证脚本。
- 在现有 intake contract 增加排除证据与混合语义反例。
- Continuous Runner 已接入公开 `run` 主路径；运行状态、checkpoint 和 receipt 持久化到 `agent/runner-state.json`。
- Codex/Claude Agent runtime 已完成 synthetic extraction/review/checkpoint、schema/canonical/Git 对账和失败预算测试；clean-project public-command E2E 已取得。
- Runner runtime adapter 已从 `project-orchestrator.mjs` 拆出；orchestrator 从 36,794 bytes 降至 28,148 bytes，回到 35,000 bytes 硬上限内。
- 临时 Git 仓库覆盖连续 deterministic action、commit 中断恢复、冻结路径提交和 no-push 契约。
- clean-project E2E 暴露并修复 evidence type 白名单缺项，以及 macOS `/var`/`/private/var` worktree 路径误判。
- Micro 路径已绑定 source、requirements、evidence-plan 和 source-unit 指纹；任一失效都会自动恢复独立 reviewer。
- clean-project Micro E2E 已验证 reviewer 轮次 0、机械性用户中断 0、定向 evidence + 正式 verify、compact trace、本地 scoped commit 和 no-push。
- trace 只记录宿主真实 token usage；当前 E2E 宿主未提供 usage，持久化值为 `null`。
- 保留三项既有债：L2 golden、`PROJECTS.md` 派生漂移、PR-02419 schema；分别交给对应 owner。
- WP1 状态为 `synthetic-tested`；WP2 状态为 `e2e-tested`，批次 C 已达到退出条件。
- WP3 状态为 `e2e-tested`；这只代表 Micro 基础设施 E2E 通过。新需求 Pilot 未完成，批次 D 尚未达到退出条件。
- WP4 已于 2026-09-25 进入 `in-progress`。首个候选样本 PR-02233 增量需求的业务改动与定向验证已完成，但系统将它错绑到同编号历史 PRD，正式 coverage/verify 未绑定当前增量，因此只记 `blocked-system`，不计为 V0/V1/V2 合格样本。
- 首个真实候选样本暴露的系统缺陷已完成定向修复：新增隔离历史范围的 `--change <id>` intake；`run --dry-run` 改为零写入、零 Agent 调用；普通 login 样式与单张 context/example-only 截图可走 Micro；Micro 硬预算收紧为 3 分钟。定向 self-test 与公开命令 E2E 已通过，但 PR-02233 仍保持 `blocked-system`，不追认合格样本，效果须由下一条新的真实需求重新验证。
- 定向 self-test、67 脚本 vNext 聚合 self-test、公开命令 E2E、339 个文档链接和 `git diff --check` 已通过。
- `check-doc-budget.mjs` 的本轮预算、索引和 101 个 self-test 入口已通过；当前 exit 1 仅来自上述三项既有债。

## 8. Owner 决策与已接受代价

### 2026-09-25：发布证据改为新需求 Pilot

这是 owner 明确认可的发布门槛调整：

- 历史 PR 不再作为发布前置，不补历史附件，不建设四个历史 PR 的逐单元 golden。
- PR-02306 不保留真实来源 replay；它与其他历史项目一样，不再消耗当前优化批次的实现和维护预算。
- 历史项目只在暴露出可复用的抽象失败模式时，提炼为最小 synthetic regression，不恢复整项目回放。

明确接受的代价：

- 放弃对 PR-02306 中 remote 图片、`<sheet>`、whiteboard 等历史脏来源的直接回归保护。
- synthetic fixture 只能证明契约机制，不能单独证明系统已适应所有真实来源噪声，因此不能据此标记 `pilot-certified`。

选择该方向的理由：

- 当前目标是提高后续真实需求的效率、完整性和交付质量，不继续为已完成项目重建昂贵档案。
- 历史 replay 的附件补齐和 golden 维护成本高，且会重新引入本轮要消除的时间与 token 负担。
- 新需求 V0/V1/V2 Pilot 能同时验证真实来源、真实代码、真实提测结果和效率数据，证据更贴近默认路径切换决策。

替代保护与发布门槛：

- 不可读图片、表格、embed 和未处置 semantic unit 继续 fail-closed。
- synthetic negative fixture 与 clean-project E2E 继续守住遗漏、假完成、越界提交和未经授权 push。
- 完成至少各 1 个 V0/V1/V2 新需求样本及至少 10 个可比 micro 样本前，不进入 owner cutover。
- Pilot 暴露新的通用失败模式时，补最小、确定性的 regression fixture，再继续样本收集。

本文件不授权业务仓改动、提交或 push。
