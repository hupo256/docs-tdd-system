# docs_tdd 优化落地计划：从需求输入到可信提交

> 日期：2026-09-24
> 状态：in-progress；A/C 正在分批落地，B 因来源材料不完整而 blocked；详见 §8
> 范围：`docs_tdd` 新需求主路径、需求覆盖、执行器、效率度量与 Pilot
> 目标用户路径：用户给需求 → 安全隔离开发 → 完整理解来源 → 必要时询问 → 实现、验证、有限修复 → 本地提交；不自动 push

## 1. 决策摘要

本计划以 `plan/docs-tdd-autopilot-gap-closure-plan-2026-09-21.md` 为技术底稿，优先修正本次 review 发现的真值缺陷，再接通端到端执行，最后用真实样本判断是否提效。避免再新增一套 Gate、规则体系或依赖人工填报的快速模式。

当前不能宣称已达到以下目标：

- PRD 中每个语义需求都被实现、核实为已有能力、明确排除或标记待裁决。
- 单次需求输入可以连续运行到 authoritative PASS 和本地 delivery commit。
- 小需求的实际耗时、模型 token 或返工次数已下降。

执行顺序：

1. 关闭 Lite 假通过和入口歧义。
2. 建立 fail-closed 的来源覆盖真值。
3. 接通安全 worktree 与宿主 Agent 的连续执行和恢复。
4. 实现基于风险与成本分离的 micro 路径。
5. 完成事故回放、clean-project E2E 和真实 Pilot。

**任何阶段都不能用“模块已实现”“脚本能运行”替代“主路径已接通”或“真实项目已认证”。**

## 2. 目标与约束

### 2.1 目标

- **准确**：需求、来源单元、实现 Surface、验证证据之间可对账；不明确的内容不能静默排除。
- **安全**：代码只能写入目标项目的隔离 worktree；提交仅包含冻结范围；不 push。
- **自治**：Runner 连续执行可自动完成的动作；用户只处理规则无法安全裁决的业务问题，以及现行策略要求的 V2 scope approval。
- **高效**：小改动只加载必要上下文、运行定向检查；保障强度由 assurance 决定，执行成本由 route 决定。
- **可恢复**：进程中断后重复运行，能依据持久化状态恢复，不重复副作用。
- **可度量**：完成状态、漏项、用户等待时间、执行时间和真实模型 token 分开记录；未知值保持 null。

### 2.2 不承诺事项

- 不承诺 AI 理解绝对零遗漏；用来源逐项对账和 fail-closed 把静默遗漏变成可见失败。
- 不把 self-test、fixture、历史代码已存在或人工估算当成真实 Pilot 通过。
- 不为小改动默认运行全仓测试、全量 browser/e2e 或额外 reviewer 轮次。
- 不在本计划中批量迁移 v1 项目，不改业务仓规则，不自动 push。

## 3. 当前问题与立即约束

以下问题在修复前视为发布阻断：

| 问题 | 影响 | 立即约束 |
|---|---|---|
| Lite 在跳过 extraction/coverage 时写 `verdict: pass` | 未审需求可能进入可信状态 | 禁止 Lite 结果作为 approved、passed 或 authoritative；不能自动默认进入 Lite |
| Lite 使用随机值充当内容 fingerprint | 来源身份不稳定，无法可靠检查漂移和重试 | 所有来源指纹必须由规范化内容和附件内容确定性计算 |
| “自动展示/沿用现有逻辑”可直接成为排除 | 同一来源中的明确新增要求可能被压掉 | 此类表述只能作为待核实线索，不能单独产生 exclusion |
| 验证准备/模拟脚本被报告成真实验证完成 | 质量结论失真 | 报告必须按实际执行状态标记；pending/unexecuted 不得计入通过 |
| CLI 文档和入口存在 v3.5 / v4 Lite 路由口径差异 | 用户无法预期实际流程，可能走错协议 | 统一唯一默认入口；兼容入口显式路由且不得静默改变工作流 |

第一批实现前，先确认上述入口与文件仍是当前代码事实；若已有后续修复，以当前行为和测试结果为准，并更新此表，不重复改旧问题。

## 4. 工作包与验收

### WP0：统一入口并移除假通过风险

**目标**：对用户只暴露一个默认 v2 新需求路径，历史入口保持显式兼容，不让 Lite 绕过真实覆盖状态。

**工作项**

- 将产品文档、CLI help、kickoff 与 run 的职责对齐：
  - 默认新项目使用 `workflowVersion: 2`。
  - 单输入主路径由 `docs-tdd run <PROJECT-ID> --prd <source>` 驱动。
  - `kickoff` 只负责幂等初始化，或明确委托给同一协议；不能私自选择不同执行流程。
  - v1 只通过显式 legacy 选项创建；不迁移既有 v1。
- Lite 如暂时保留，只能作为 execution route，不能跳过来源快照、source-unit 对账、scope/risk 路由或正式出口。
- 移除“打印询问后自动选 yes”行为。自动路由结果应在状态中可查；有不确定性时升级 route，而不是降低 assurance。
- 所有 pending action、未处置语义单元、无效/缺失 fingerprint 均不得产生通过状态。

**验收**

- 新项目经默认命令创建为 v2；CLI、README、kickoff 文档行为一致。
- 相同 PRD 重复运行产生相同内容 fingerprint，不重复创建项目或副作用。
- Lite 路径不能生成 coverage pass、scope approval 或 authoritative pass 的伪状态。
- v1 存量行为不变；环境分支、越界路径仍 fail closed。

### WP1：来源覆盖真值与历史遗漏回归

**目标**：PRD 的每个语义来源单元必须有依据地进入需求、已满足、明确排除或待裁决之一。

**处置模型**

| 状态 | 含义 | 通过条件 |
|---|---|---|
| `implement` | 本项目需要实现 | 有来源锚点及至少一个待实现 Surface |
| `already-satisfied` | 目标能力已存在 | 有来源锚点及当前仓库文件/符号/契约证据，覆盖验收要求 |
| `explicit-exclusion` | 产品明确不在本期范围 | 有明确、可定位的排除语句；不能由“自动展示”等推断 |
| `unresolved` | 来源不足、冲突或依赖未决 | 必须阻止范围批准/交付；生成合并后的决策包 |

**工作项**

- 对每个 semantic source unit 生成一个且仅一个处置；标题、分隔线、纯注释等结构节点由确定性规则识别并单独记录。
- 显式排除必须引用 PRD 原文；“现有逻辑”“数据自然流转”“自动展示”不能覆盖同一 PRD 中的字段、操作、报表、入口等明确功能要求。
- `already-satisfied` 与 `explicit-exclusion` 不得混用：前者需要当前代码证据，后者需要产品范围证据。
- 稳定 fingerprint 使用来源文本规范化后的 SHA-256；附件逐个记录内容 hash、类型和读取/解析状态。附件不可读时不得默认为无需求。
- 对集合语义保存预期成员集合或可核对数量；Surface reconciliation 少成员即失败。
- 从 PR-01947、PR-02265、PR-02306、PR-01930 建立黄金样本：每个 source unit 有人工确认的期望处置、要求、Surface 和证据；PR-01930 特别核对体验金明细流水/导出等明确条款，以及历史已实现项的真实状态。
- 每项人工修复都更新 fixture，避免只更新 prompt 文案而没有回归测试。

**验收**

- 任一语义 unit 无处置、排除无原文锚点、已满足无代码证据、附件读取失败或集合成员不全：coverage 必须 failed/blocked，不能 passed。
- 四个历史事故及正向控制均通过 deterministic replay。
- 对“既有页面自然展示”与“同页明确新增功能”共存的反例，测试证明明确功能不会被自动排除。
- 独立冷读审查只能补漏，不可覆盖来源证据或将 unresolved 自动批准。

### WP2：安全 worktree 与连续 Action Runner

**目标**：把现有状态机和 CLI 能力接成用户可以重复调用的可恢复执行器。

**工作项**

- Runner 以 canonical project state 决定唯一下一动作；每个动作开始前持久化 checkpoint，结果原子写入后再推进。
- 接入动作顺序：source snapshot/sync → safe worktree → extraction/coverage → risk/scope → 必要审批 → implementation → targeted checks/evidence → verify → local delivery commit。
- worktree 创建与恢复必须幂等；写入目标只能是该 worktree。基线解析遵循仓库现行 Git 流程，不能仅因 feature/fix 分支不是 `origin/online` 后代就阻断；环境分支、无共同历史和越界写入仍 fail closed。
- Action Executor Registry 区分 `deterministic`、`agent`、`human`、`external`。Agent 输入为精简且带指纹的 context pack；输出为 schema 校验的临时 JSON，由 Runner 校验、应用和记录，Agent 不直接改 canonical state 文件。
- 明确 Codex/Claude 等宿主 adapter 契约：输入包含 `runId/actionId/worktree/context/outputSchema/budget`；回传包含结构化结果、changed paths、covered/discovered surfaces、执行状态及可获取的 usage。支持超时、取消、无输出、无效 JSON、进程中断和恢复。
- 如果宿主暂不支持自动调用 Agent，Runner 必须明确进入 `needs-agent`/`needs-user`，不能把 action packet 当作成功，也不能报告完成。
- 所有 repair 分 failure domain 设预算；相同输入与失败 fingerprint 不得无变化重试。预算用尽只生成一个包含证据和唯一恢复动作的决策包。
- 保留当前 V2 scope approval 要求；其他问题只在规则和仓库事实无法安全裁决时询问。可合并的问题一次性提问，回答绑定当前 source fingerprint。
- delivery commit 只包含冻结路径；不自动 push。

**验收**

- clean project 仅通过公开单输入命令，可从 PRD 运行到 authoritative PASS 和本地 delivery commit，不要求用户手工拼 JSON/逐步敲中间命令。
- 中断后重复 run：已成功动作不重做；未完成动作按幂等协议恢复；不确定是否写入时先 reconcile。
- 普通 lint/type/test 失败可在预算内修复并只重跑受影响检查；相同失败无变化重试为 0。
- 用户/环境阻塞均有唯一终态，不存在无界运行或静默跳过。
- Runner trace 证明未执行 `git push`，提交范围与冻结路径一致。

### WP3：小需求短路径与真实成本观测

**目标**：减少小需求的流程税，但不牺牲来源覆盖和正式出口。

**设计约束**

- 将 `assuranceLevel`（V0/V1/V2）与 `executionRoute`（micro/lite/standard/extended）分开。
- Micro 不是“少理解需求”：保留完整来源快照与 source-unit coverage；只减少冗余上下文、独立 reviewer 和非必要检查。
- Micro 初始范围限制为：单一明确需求、1-2 个紧邻 Surface、无需新增 API/schema/权限模型、不跨应用或仓库、无集合语义/来源冲突/未决外部依赖。
- 任何新增独立 Surface、集合语义、API/schema 变化、图片/表格解析失败、风险升级或低置信度，自动升至更高 route；升级理由需可解释。
- 小需求按变更路径执行最小定向质量检查和回归检查，再走统一 verify/commit；不默认全仓测试。
- 规则按路由渐进加载；不得为减少 token 而跳过仓库规范、需求覆盖或安全策略。

**Trace 字段**

- 每个 run/action：稳定 ID、输入指纹、route、assurance、起止时间、命令数、review/repair 次数、用户中断数、failure domain、终态、预算消耗。
- `inputTokens/outputTokens` 只记录宿主或模型提供的真实 usage；不可用为 `null`。
- `contextChars` 单独记录，禁止改称 token 或用其推算并宣称 token 节省。
- 记录首次需求抽取后补充/修正的 requirement、遗漏发现时间、返工次数和提测观察结果。

**验收**

- Micro：机械性用户中断为 0；命令数 ≤4；默认 reviewer 轮次 0；只执行必要的定向检查。
- Micro/lite 路由升级和退出原因在 trace 中完整可解释。
- token 数据缺失时结果明确标为不可比较，不得宣称 token 已下降。

### WP4：端到端验证、Pilot 与推广判定

**目标**：用可复现证据确认质量和效率，而非从脚本完成或少数主观样本推断。

**分层验证**

1. **单元/契约回归**：fingerprint、coverage disposition、集合对账、状态转移、预算、提交范围。
2. **历史真实来源 replay**：四个 PRD/附件和负向控制；每个事故既验证“问题能被发现”，也验证“错误状态不能通过”。
3. **clean-project public-command E2E**：覆盖 v0、v1、v2；包含安全建 worktree、模型动作、修复、恢复、PASS、commit。
4. **真实 Pilot**：至少 3 个完成样本分别覆盖 V0/V1/V2；另收集至少 10 个 micro/lite 小需求效率样本。每个样本从真实需求开始并经过实际提测观察；历史样本不得追认为本版本认证。

**质量发布门槛**

- silent omission = 0，false completion = 0，越界写入/未经授权 push = 0。
- unresolved source unit、无效证据、过期 fingerprint、未完成 action 均不能进入 authoritative PASS。
- V0/V1/V2 Pilot 各至少 1 个完整样本；样本记录实际需求核对人及提测后遗漏结果。
- `docs-tdd guard --strict` 无 error；synthetic、E2E、pilot 状态分别报告。

**效率发布门槛**

- 建立至少 10 个可比的小需求基线；以相近复杂度配对，记录用户等待/总历时、模型实际 token（可得时）、上下文字符、命令、用户中断、返工和质量结果。
- 与基线比较 p50/p90。推广前至少要求 micro p50 端到端时间下降 ≥30%，p90 不退化超过 10%；质量门槛必须先满足。
- 如模型实际 usage 覆盖不足，不得宣称 token 节省；可以报告真实可观测的时间和上下文指标，并明确样本与缺失率。
- 任何效率提升若伴随需求遗漏、错误排除或假通过，判定为失败，不以速度抵消质量问题。

达到门槛仅输出 `eligible-for-owner-cutover-review`；是否切换默认稳定路径由 owner 决定，不自动迁移 legacy 或宣称 production-ready。

## 5. 实施批次

| 批次 | 内容 | 退出条件 | 回滚/暂停条件 |
|---|---|---|---|
| A：真值止损 | Lite 假通过、随机指纹、自动默认 Lite、验证状态和完成声明 | 对应反例测试通过；文档状态修正 | 影响 v1 或正常 v2 创建则暂停切换 |
| B：覆盖可信 | disposition 契约、真实指纹、四个历史黄金样本与负向控制 | 所有语义单元 fail-closed 对账 | 任一明确需求被排除或 unresolved 被放行，禁止进入 Runner 批次 |
| C：Runner 闭环 | worktree、宿主 adapter、Action Registry、恢复/修复/提交 | clean-project 单输入完成 E2E | 越界写入、重复副作用、无法恢复或假 PASS，立即关闭自动交付 |
| D：Micro 与度量 | route/assurance 分离、定向检查、真实 trace | 十个可比样本及质量/效率门槛 | 质量退化或 p90 明显恶化，禁用 micro 自动路由 |
| E：Pilot 判定 | V0/V1/V2 真实样本、提测观察、owner review | 资格事实齐备且状态一致 | 样本缺项或证据不可追溯，维持 collecting |

每批独立提交和审查；不将全部工作塞入一个大改动。每批先核对现有代码状态，再改动对应模块，避免重复实现已落地能力。

## 6. 状态与报告规范

所有代码、文档、trace、pilot 报告统一使用以下状态，不用百分比代替：

| 状态 | 允许表述 |
|---|---|
| `planned` | 已列入计划 |
| `in-progress` | 正在实施，未满足批次退出条件 |
| `implemented` | 模块代码存在 |
| `wired-to-run` | 已接入公开主路径 |
| `synthetic-tested` | self-test/fixture/replay 通过 |
| `e2e-tested` | clean-project public-command E2E 通过 |
| `pilot-certified` | 真实 Pilot 完成并经提测观察 |
| `blocked` | 有具体阻塞原因、责任边界和恢复条件 |

“通过率 100%”只允许用于明确样本集合中实际执行且全部通过的检查；必须同时报告分子/分母、未执行项和样本类型。准备脚本只能报告 `ready`，模拟脚本只能报告 `simulated`。

## 7. 交付物

- 默认入口、兼容路径和状态术语一致的 CLI/README 文档。
- 来源处置与稳定 fingerprint 的 schema、validator 和契约测试。
- PR-01947、PR-02265、PR-02306、PR-01930 黄金 fixture 及正负向回归。
- Action Executor Registry、Codex/Claude 宿主 adapter 契约与恢复协议。
- clean-project E2E、真实 run trace 与 Pilot 报告。
- 十个可比效率样本及 owner cutover review 记录。

本文件不授权或执行业务代码变更、提交或 push。开始实施时逐批更新状态和验证证据；不得预先勾选完成。

## 8. 当前落地记录（2026-09-24）

本轮按 owner 同意开始实施，先做 A 的止损与 B 的只读诊断，同时接通 C 的单输入初始化边界；不触碰业务仓代码，不提交、不 push。

| 批次 / 工作包 | 当前状态 | 已完成 | 未完成 / 退出条件 |
|---|---|---|---|
| A / WP0 入口与 Lite 真值止损 | `in-progress` | 默认 `kickoff` 转入 v2 orchestrator；旧 `kickoff-v4` 只作兼容转发并拒绝 `--force-lite`；v4 Lite executor 禁止写入；旧模板不再声明 approved 或 scope approval；过时操作指南已收为归档指针。公开命令 E2E 覆盖默认 v2、幂等初始化、来源绑定/漂移保护、损坏状态保留、Lite 拒绝、v1 兼容、来源及路径 fail-closed；新增 `run --prd` 初始化后诚实返回 `needs-agent`，并拒绝 `run --legacy` | 尚需核对 CLI/README 全部兼容入口及 WP0 的稳定 fingerprint 等退出条件；当前 E2E 只验证初始化/边界，不证明完整需求执行与交付 |
| B / WP1 来源覆盖可信度 | `blocked` | 新增只读事故来源诊断，检查四份 PRD 的 source-unit 规模、指定事故条款锚点、图片/嵌入对象状态；诊断结果明确 `coverageAssessment=not-performed`，不产生通过权 | PR-01947/02265/01930 有未解析附件或嵌入对象；四个 PR 均缺少逐 semantic unit 人工确认的处置、Surface、证据黄金清单。须先补齐可读来源与人工期望，再开始 golden replay |
| C / WP2 Runner 闭环 | `in-progress` | `docs-tdd run <ID> --prd <source>` 已作为单输入入口接入初始化/恢复；来源不匹配、来源漂移和损坏状态会阻断并保留 work-item；E2E 验证当前无宿主 adapter 时返回 `needs-agent` 而非假完成，scope approval/业务裁决与外部依赖也有显式边界 | 当前停在 action handoff：safe-worktree 自动准备、Agent Executor Registry/宿主 adapter、语义结果 schema 回写、连续实现/验证/修复/commit 尚未接通；不能宣称 Runner 闭环或单输入自动交付 |
| D / WP3 Micro 与真实成本度量 | `planned` | 无 | 尚未开始 |
| E / WP4 Pilot 判定 | `planned` | 无 | 尚未开始 |

### 本轮来源诊断观察

针对只读副本 `/Users/aven/github/fameex-web/apps/web/docs_tdd` 执行 `vnext-source-incident-replay.mjs --json`：

- PR-01947：247 个 source units（172 semantic）；图片中有 9 个 remote、5 个 missing，来源未完整。
- PR-02265：123 个 source units（85 semantic）；发现 1 个未解析 `<sheet>`，来源未完整。
- PR-02306：23 个 source units（19 semantic）；4 个图片均可本地读取，指定锚点齐全；但尚未逐单元核对处置。
- PR-01930：246 个 source units（167 semantic）；8 个图片 token 未映射，3 个 whiteboard 只有本地预览、没有语义解析，来源未完整。

四组预设事故锚点均命中；这只证明选定文本仍在来源中，不证明需求已完整抽取或实现。整体诊断按未解析来源返回 `blocked` 是预期行为。继续 WP1 前须补齐附件原文/语义解析，并建立逐单元人工确认的 golden 期望；不得用锚点命中或项目历史完成状态替代。

### 验证记录

- `node --check vnext-source-incident-replay.mjs`、其 `--self-test`、`kickoff-v4.mjs --self-test`、`lite-path-executor-v4.mjs --self-test`、`docs-tdd.mjs --self-test`、`vnext-source-units.mjs --self-test`：通过。
- `check-doc-links.mjs`：340 个本地链接目标通过；`git diff --check`：通过。
- `vnext-kickoff-public-e2e.mjs --self-test`：公开命令 E2E 通过，覆盖默认 v2、幂等重复调用、拒绝切换 PRD 来源、内容变化保护、损坏 work-item 不覆盖、Lite 拒绝、v1 兼容、缺失 PRD fail-closed、来源越界、非法项目 ID，以及 `run --prd` 的 `needs-agent` 和 `run --legacy` 拒绝边界。每个子命令有 45 秒硬超时；此 E2E 单独运行，不挂入每次 `check-doc-budget` 的 self-test 序列。它不是 clean-project 到交付提交的全流程 E2E。
- `docs-tdd run <ID> --prd <source>` 当前只证明单输入可创建/恢复项目并给出下一动作；宿主 Agent adapter 未配置时必须由调用方执行该动作，不能表述为单命令连续跑到 PASS/commit。
- 四项目真实来源诊断：检查按预期返回 `blocked`（exit 1），因为 PR-01947、PR-02265、PR-01930 存在未解析来源；这不是 coverage 测试通过。
- 定向回归：`project-orchestrator.mjs --self-test`、`docs-tdd.mjs --self-test`、`kickoff-v4.mjs --self-test`、`lite-path-executor-v4.mjs --self-test`、事故来源诊断 self-test、`lib/vnext-intake-runtime.mjs --self-test`、vNext 聚合自测（63 个脚本）、公开命令 E2E、涉及脚本 `node --check`、`check-doc-links.mjs`（340 个目标）及 `git diff --check` 通过。
- `check-doc-budget.mjs`：未通过，不能记作通过。当前阻断为：`rule-router.md` 超常驻预算 173 字符；4 个脚本缺 self-test/豁免登记；7 个专题未进入 README 专题索引及 `rule-index.json`；L2 golden 规则数断言 `47 != 49`；`PROJECTS.md` 即时派生漂移；PR-02419 的 lark-sources/work-item schema 不匹配。另有 6 个脚本和 1 个专题超过告警线但未超硬上限。上述为完整检查输出，修复仍需按各自规则所有权单独处理。
- 本轮预算阻断修正：最终检查发现 `project-orchestrator.mjs` 原达 37,526 字符，超过 35,000 硬上限；已将来源同步、脚手架、fingerprint 绑定和 work-item 初始化拆至 `lib/vnext-intake-runtime.mjs`，当前 orchestrator 为 30,386 字符，intake runtime 为 10,250 字符，均低于对应硬上限。拆分不改变公开命令或 intake 行为；新模块的契约由独立自测、63-script vNext 聚合自测与公开命令 E2E 覆盖。
