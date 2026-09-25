# docs_tdd v4.x 迭代实施计划

> 建立日期：2026-09-25
> 状态：计划已落盘；实现尚未开始
> 目标：从 v3.5 的模块与 Runner 基础，迭代到可安全验证真实需求、以数据决定是否切换默认路径的 v4.x。
> 兼容边界：项目协议继续使用 `workflowVersion: 2`；产品版本号不因本计划创建而提前升级。

## 1. 目标与成功定义

### 1.1 总目标

让 docs_tdd 从“能生成流程、状态和门禁”进一步成为一个**真实需求可驱动、执行可恢复、范围可证明、效率可度量**的交付系统：

```text
真实需求来源
  → 安全隔离并绑定当前 source/change
  → 来源单元与需求/surface/evidence 对账
  → 按风险确定保障强度，按规模确定执行成本
  → 实现、定向验证、有界修复
  → 当前 enforced PASS
  → 只提交冻结路径的本地 delivery commit
  → 不自动 push
```

用户提供需求不代表所有情况下都免除必要裁决：V2 scope approval、来源不可读、业务决策和外部依赖仍可要求用户处理。效率预算是观测/收敛目标，不能把尚未交付的需求变成成功或停止必要验证。

### 1.2 必须守住的结果

- **需求完整性**：每个 semantic source unit 都有 requirement anchor，或有可审计的排除证据；来源不完整时显式失败，不静默忽略。
- **交付真实性**：只有当前、完整、绑定冻结路径的 enforced PASS 和匹配的本地 delivery commit 才能称为完成；准备动作、模拟和未执行检查不算通过。
- **执行安全性**：业务改动限制在安全 worktree 与允许路径内；提交仅包含冻结路径；不自动 push。
- **可恢复性**：中断、重复调用和失败保留真实终态与 action/receipt；同一失败不无限重试或伪装成预算问题。
- **效率可证明**：记录可比较的历时、命令、review、repair、中断与真实 token usage；宿主没提供 token 时记 `null`。
- **状态可解释**：明确区分“项目可执行状态”“Pilot 样本资格”和“发布资格”，不能让台账与 CLI 给出相互冲突且无法解释的结论。

### 1.3 暂不做

- 不恢复早期 v4.1 的并行 `lite work-item`、人工摘要绕过 source 对账、可选 evidence 或跳过正式 verify 的方案。
- 不为了版本号重写现有 workflowVersion 2 协议，不新增平行 Gate、disposition 词表或第二条默认入口。
- 不回放或修复 PR-02233 等历史业务项目来凑 Pilot；历史项目只可作为被明确排除的回归输入。
- 不重建已被决策放弃的历史 PRD/replay 档案；新发现的通用失败只补最小 synthetic regression。
- 不因本计划修改 FameEX 业务代码、提交业务代码或 push。
- 不把 `L2 golden 47 != 49`、`PROJECTS.md` 派生漂移、PR-02419 schema mismatch 混入本轮，除非它们被证明确实阻断当前里程碑。

## 2. 当前基线（2026-09-25 检查）

### 2.1 产品与实现状态

- `VERSION` 仍为 `v3.5.0`；README 将 v3.5.0 标为 stable，但明确 Pilot 仍 collecting，尚未宣称 production-ready。
- 新项目的兼容协议标识是 `workflowVersion: 2`，默认入口为 `docs-tdd run`；旧 v1 项目保留兼容流程。
- 最新优化计划（`plan/optimization-execution-plan-2026-09-24.md`）记录：WP1 来源覆盖为 `synthetic-tested`；WP2 Runner 为 `e2e-tested`；WP3 Micro 基础设施为 `e2e-tested`；WP4 真实需求 Pilot 仍 `in-progress`。
- `plan/real-demand-pilot-2026-09-25.md` 只有 PR-02233 一个记录，且明确为 `blocked-system`，不计入 V0/V1/V2 合格样本；当前没有有效真实 Pilot 样本。
- 旧 `v4-upgrade-plan-20260923.md` / `v4-action-plan.md` 是历史方案，不作为当前实施真值；其中跳过完整追溯/正式证据的 Lite 设想与当前 v3.5 单一 v2 流程不兼容。

### 2.2 当前工作区与状态冲突

- docs_tdd 仓库在 `main`，HEAD 为 `36181a6`，相对 `origin/main` ahead 7。
- 当前工作区并非 clean：`prds/PR-02233/work-item.json` 有已跟踪修改；存在未跟踪的 `.clean-project-e2e-xHwCFh/`、`prds/PR-42071/` 和 `plan/handoff-real-demand-pilot-2026-09-25.md`。本计划不假定这些文件可删除、重置或提交。
- PR-02233 的 Pilot 台账称其 `blocked-system` 且禁止回放；但只读 `docs-tdd status PR-02233` 仍返回 `active` / `repair-intake-extraction`。这属于会误导下一步执行的状态冲突，必须先解决防误执行问题。
- PR-42071 的来源明确写着 `Clean project E2E`，README 指向临时 E2E worktree；Runner 停在 `capture-cli-evidence`。它是 synthetic E2E fixture，不是真实业务需求，也不得计入 Pilot。
- PR-42071 当前 `status` 报 `executionRoute: micro`，runner trace 报 `route: lite`；trace 仍是 running，且已有 receipt 但 `actionCount`/`elapsedMs` 等统计未完整落定。需在隔离回归中核实路由命名与终态汇总，不可用该 trace 计算 Pilot 效率。

> 当前状态检查仅用于定义计划，不授权清理、续跑上述项目、修改业务仓或提交任何内容。先保留现状，明确归属后再做最小处置。

## 3. 迭代路线与阶段门

### M0：状态隔离与防误执行（P0，进入真实 Pilot 的前置）

**目标**：不清理历史现场的前提下，明确当前事实，阻断把历史/测试项目误当成真实 Pilot 或继续执行。

任务：

1. 给当前工作区做只读盘点：tracked/untracked 改动、项目输入来源、关联 worktree、Runner active action、receipt 和 Pilot 台账归属；对所有未知归属保持原样。
2. 将 PR-02233 明确登记为 `pilotEligibility=excluded/blocked-system`，保留原始 work-item 与失败事实；实现可验证的执行 hold，使 `run/resume` 不会按遗留的 `active` action 继续推进。`status` 必须同时显示真实 execution state 和 Pilot eligibility，不能用其一冒充另一项。
3. 将 PR-42071 明确标为 synthetic E2E、Pilot 不合格；隔离未来测试项目的持久化位置/命名，避免 clean-project fixture 混入真实 `prds/` 索引或 Pilot 统计。当前文件不自动移动或删除，先确认归属。
4. 定义唯一的 Pilot 样本登记与排除字段：真实来源身份、是否 synthetic、来源 fingerprint、verification level、execution route、终态、排除理由。样本资格不能由目录名或 `status` 单独推断。
5. 记录并核实真实需求开始前的 Git/worktree 基线；不把当前脏状态默认为可用基线。

验收证据：

- [ ] PR-02233 被标为不可用于 Pilot，且 `run/resume` 在产生任何文件、Agent 调用或 receipt 前被安全 hold；其原始业务来源和实现不被重写。
- [ ] PR-42071 明确显示为 synthetic、Pilot excluded；测试夹具不能进入真实 Pilot 样本计数。
- [ ] `status` 能并列显示 execution state、execution hold、Pilot eligibility 和 terminal/sample disposition。
- [ ] 所有当前未跟踪/已修改项均有“保留/移交/获批清理”的明确归属；未获批的内容未被清除。

### M1：单一状态真值与执行遥测（P0）

**目标**：让 CLI 状态、Runner 状态、receipt、verify 结果和 Pilot trace 可互相对账，为安全续跑和效率测量提供事实基础。

任务：

1. 审计 `status`、`run`、runner-state、work-item、latest-result 与 delivery record 的状态优先级；规定各自真值责任，拒绝静默覆盖更新状态。
2. 明确 action 生命周期：`started → completed/failed/needs-user/blocked`；每个 action 有稳定 actionId、invocationId、开始/结束时间、结果和关联 receipt。重启恢复不重复执行已完成副作用。
3. 在终态 trace 汇总真实 action/command/review/evidence/repair/interrupt 数与 gross/active elapsed；运行中的 trace 可以标 pending，但不能写成完整样本或用零值冒充已测数据。
4. 统一 `micro`/`lite` 等 route 的定义与编码。若运行时只采用 micro/lite/standard/high-risk，就让 status、budget、trace、报告使用同一枚举；兼容映射必须显式记录，不得悄悄改标签。
5. 确保 `--dry-run` 是纯只读：不建项目/change 目录，不调用 Agent，不写 receipt/runner state，不消耗 repair budget。
6. 保持效率预算为目标而非需求终态；预算超标记录 `target-exceeded` 并削减非必要扩张，必要实现与验证继续。

验收证据：

- [ ] 针对历史 active/blocked 冲突、重复 run、action 中断恢复、receipt 对账和 trace 聚合有最小确定性 self-test。
- [ ] 临时 Git 仓库 public-command E2E 验证正常完成与中断恢复两条路径；不访问或改写 FameEX 业务仓。
- [ ] dry-run 零文件变化、零 Agent 调用、零 receipt/预算副作用。
- [ ] 已完成执行的终态 trace 中，统计值与实际 receipt/命令一致；未知值保留 `null`，不填估算值。
- [ ] 仅当 M1 的 blocking self-test 与 scoped E2E 通过，才进入 M2。

### M2：需求来源/change-set 绑定与覆盖闭环（P0）

**目标**：任何新需求（特别是同项目编号的增量来源）都只针对当前 source/change 抽取、实现、验证和提交，不继承历史大项目范围。

任务：

1. 复核当前 change-set 协议：source 文档、source fingerprint、branch、worktree、baseRef、work-item、Runner state 和 delivery record 必须绑定同一 change。
2. 覆盖 source 更新、重复同步、同 ID 新来源、恢复运行、显式 `--change` 和 `--base-ref` 的边界；baseRef 固定后不得跟随全局配置漂移。
3. 验证完整对账链：semantic source unit → requirement / 可验证排除 → surface disposition → evidence command → enforced verify → 冻结提交路径。
4. 对不可读图片、表格、embed、未处置 unit、失效 fingerprint、历史 requirement 泄漏保持 fail-closed；不因 Micro 路由跳过完整 coverage 真值。
5. 不重建 PR-02233 历史样本。只在隔离 fixture 中复现“同 ID 增量错绑历史”的抽象反例，并证明新 change 与旧 work-item 相互隔离。

验收证据：

- [ ] 定向 schema/intake/source-graph/change-set/coverage self-test 覆盖上述正反例。
- [ ] 临时 clean-project E2E 从新 source 到 verify/本地 scoped commit；断言无历史来源继承、无冻结范围外提交、无 `git push`。
- [ ] 真实 Pilot 的 source snapshot 与 change-set fingerprint 可回溯，scope 未变更时不重复抽取/审查；变化时旧证据失效并重新对账。

### M3：真实需求 Pilot（产品效果验证，不用 synthetic 替代）

**进入条件**：M0–M2 通过；Pilot 台账和计量定义可用；取得新的真实需求。PR-02233、PR-42071 均不计数。

Pilot 规则：

1. 由真实需求事实自动判定 V0/V1/V2 与 execution route；不得为了凑样本人工指定、升降级或拆分样本。
2. 第一条真实需求验证完整主路径；遇到系统缺陷时，保留原失败类型、补最小 synthetic regression，再由下一条新的真实需求验证修复，不追认失败样本。
3. 至少取得 1 个真实 V0、1 个真实 V1、1 个真实 V2 合格样本；另收集至少 10 个复杂度可比的 Micro 样本。一个样本可同时计入 level 和 Micro，但在样本总数中只计一次。
4. V2 必须取得绑定当前 fingerprint 的人工 scope approval；所有样本均须有当前 enforced verify、代码检查、提测观察和冻结范围提交证据。
5. 只有宿主提供的 usage 才记录真实 token；拿不到即为 `null`，不估算、不以字符数替代 token。

开始收集前必须冻结指标定义：

- `grossElapsed`：从系统接收完整来源并开始处理，到交付本地 commit/明确失败的墙钟时间；等待用户/外部依赖单独标记并保留在 gross 值中。
- `activeElapsed`：扣除经记录的用户/外部等待时间；不得用它替换 gross 值掩盖用户等待。
- 起止时间、用户中断数、必要中断数、命令数、review 轮次、repair 次数由 CLI/host 实际记录。
- 效率比较必须使用相同起止定义、相近复杂度和可审计 baseline。没有可用基线就报告“暂不可比较”，不得用旧文档估算数字或只挑有利样本。
- 每个样本保存 source/requirement/surface/coverage 数量、verify/检查/提测终态、提交 SHA、失败/返工、遗漏/假完成/越界写/push 事件、真实 token usage 或 `null`。

退出门槛：

- silent omission = 0
- false completion = 0
- out-of-scope writes = 0
- unauthorized push = 0
- V0/V1/V2 均有真实完整样本及代码验证、提测观察
- 至少 10 个可比 Micro 样本；相对预先确认且可审计的同复杂度 baseline，gross elapsed p50 至少改善 30%，p90 恶化不超过 10%
- 未达门槛、基线不可比或统计证据不足时保持 collecting/blocked，不宣称通过

**统计限制**：10 个 Micro 是 Pilot 阶段的最低观察量，p90 仍不稳定；它只支持是否进入 owner review，不足以单独证明普遍性或生产级可靠性。报告必须同时列样本数与分布，不能只列百分比。

### M4：Owner cutover review 与版本发布

**目标**：将“系统可运行”与“允许默认切换”分开决策。

任务：

1. 汇总 M0–M3 机器证据、样本台账、失败案例和未解决风险。
2. 达到 M3 门槛后只标记 `eligible-for-owner-cutover-review`；由 owner 明确批准是否切换默认路径。
3. 未经批准保持原默认入口和安全边界，不自动启用新模式，不宣称 production-ready。
4. 发布前核对 README、VERSION、CHANGELOG、帮助文本、Pilot 报告和实际 CLI 行为一致；旧 v4 计划标注为历史/被本计划取代，不能继续被新 chat 当作可执行现状。
5. 只有 release gate 通过后才讨论产品版本号和 SemVer；`workflowVersion: 2` 不因产品版本升级而自动变更。

## 4. 决策边界与授权

- 本计划授权范围仅为：编写/维护 docs_tdd 系统计划，并在后续明确实施授权后修改 docs_tdd 系统代码和本地规则文档。
- 它不授权修改 FameEX 业务仓、代用户接受业务决策、提交业务代码、删除当前工作区材料或执行 `git push`。
- 用户提交新的真实需求时，按该需求授权范围处理业务代码；本地 delivery commit 是否默认包含在授权内，应在 Pilot 首次运行前明确。无论何种情况都不自动 push。
- 既有工作区内容先确认归属。不能因“计划要求 clean”而 reset、checkout、clean 或覆盖未提交材料。

## 5. 里程碑和报告状态

| 里程碑 | 内容 | 必须证据 | 当前状态 |
|---|---|---|---|
| M0 | 状态隔离与防误执行 | hold/exclusion、样本资格字段、工作区归属清单 | `not-started` |
| M1 | 状态真值与遥测 | 定向 self-test、dry-run/恢复 E2E、receipt/trace 对账 | `not-started` |
| M2 | 来源绑定与覆盖闭环 | intake/change-set/source graph/verify/scoped commit 回归 | `partially-present; revalidate-required` |
| M3 | 真实 Pilot | V0/V1/V2 + ≥10 可比 Micro 完整台账 | `blocked-on-M0-M2-and-new-real-demand` |
| M4 | Owner cutover/release | M3 证据 + 明确 owner 决定 + release gate | `not-started` |

状态含义：

- `implemented` 不等于 `wired-to-run`；
- `synthetic-tested` 不等于 `e2e-tested`；
- `e2e-tested` 不等于 `real-pilot-certified`；
- `eligible-for-owner-cutover-review` 不等于已切换默认路径。

每阶段只运行与改动相关的定向 self-test / public-command E2E / 文档检查；不因小改动重复跑全仓验证。所有未执行检查明确写 `not-run` / `not-required`，不写通过。

## 6. 开工顺序（后续分步实施）

1. **先 M0 只读盘点与防误执行设计**：不续跑 PR-02233/PR-42071，不清理当前材料；先明确 pilot eligibility、执行 hold 和隔离位置。
2. **经 owner 确认 M0 的数据归属方案后实施**：优先加最小 hold/样本资格机制，不迁移或覆盖历史项目事实。
3. **再做 M1 状态/trace 确定性修复**：针对真实发现的 route 命名、终态汇总、状态优先级缺陷补小型回归。
4. **M2 只补覆盖盲点**：已有 change-set 和 clean-project E2E 不重复造轮子；先审计证据，再补缺口。
5. **M0–M2 通过后等一条新的真实需求**：不得拿合成 PRD 或历史 PR 替代。
6. **收满样本后做 M3 统计与 owner review**：在真实证据达到门槛前不切默认路径、不发“production-ready”声明。

## 7. 关联文档与优先级

- 当前产品事实：`README.md`、`VERSION`、`common/rules/rule-router.md`。
- 当前工作项与 Pilot 事实：`plan/optimization-execution-plan-2026-09-24.md`、`plan/real-demand-pilot-2026-09-25.md`、`plan/handoff-real-demand-pilot-2026-09-25.md`。
- 本计划是 **v4.x 目标到分阶段实施的主计划**；具体每个 Work Package 的实现事实仍由代码、自测和当前 Pilot 台账证明。
- `plan/v4-upgrade-plan-20260923.md`、`plan/v4-action-plan.md`、`plan/v4.1-simplified-implementation-plan.md` 保留作历史决策依据，不作为当前运行手册；与本计划冲突时以当前 README/Router 和本计划的安全边界为准。
- 本计划不自动更新 `VERSION`、README 的当前稳定版本声明或 release 文档；待 M4 才统一决定是否发布 v4.x。
