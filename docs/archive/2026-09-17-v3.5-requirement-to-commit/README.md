# v3.5 Requirement-to-Commit：交付真实性与 AutoPilot 规划（2026-09-17 ~ 2026-09-23）

> 状态：已归档（只读） · 结论有效性：部分有效 · 后继：[../2026-09-21-phase1-5-experiment/](../2026-09-21-phase1-5-experiment/)、[../2026-09-24-optimization-pilot/](../2026-09-24-optimization-pilot/)；现行流程见 [releases.md](/Users/aven/.ai-rules/labs/prd-to-commit/releases.md)

## 一句话

PR-02233 出现「局部实现被误报为整批完成」后，开始规划从「流程发生过」转向「交付事实可信」。按 surface→code 对账、四档预算路由、有界修复、delivery truth 这条线在 09-19 实施了 v3.5，09-23 发布 stable。但「只给需求即可自动提交」的 AutoPilot 一直没有通过真实项目认证，pilot 停在 `collecting`。

## 背景与目标

- 输入：v3.1–v3.3 实践日志里的 PR-02233（O-1~O-35）、hichat bugfix（HB-1~HB-5）、TR-02386（TR-1~TR-4），以及 0918 的 PR-02233 门禁反馈，见 [../2026-09-12-v3.1-v3.3-practice/](../2026-09-12-v3.1-v3.3-practice/)。
- 问题归纳：系统只能证明「有 work-item、有命令、有组件文件」，证明不了「目标页面已接入、核心交互可触发、本期 surface 全覆盖」。
- 目标：任何「完成 / 可验收 / 可提测」的结论，都要能沿 requirement → surface → code → wiring → evidence → 当前 HEAD 一路追溯。在此之上再建 AutoPilot：用户只给需求，系统安全建分支、只在必要时提问、有界修复，最后做本地 delivery commit。

## 做了什么

1. **09-17/18 主计划**（`iteration-plan-v3.5`）：把优化项分成 v3.5（交付真实性，A1–A7）、v3.6（流程弹性）、v3.7（证据可信）、v3.8（工程稳定）四期。附录 A 是 observation→优化项→实现状态台账；附录 C 拍板三项 P0 分歧：D-1 对账结果改为三维正交（code/wiring/runtime），D-2 locator kind 取并集，D-3 采用十态状态机；附录 E 并入 0918 反馈。
2. **纸面设计 B1/B2/B3/F**：四个真实案例的预期行为、schema 与十态状态机、golden fixture、AutoPilot 控制层（决策矩阵、自动修复、运行时决策日志）。
3. **09-18 AutoPilot 路线图**（已合并删除，见下）：AP-0~AP-4 能力等级、四层闭环。09-19 的实施计划完整吸收了它。
4. **09-19 实施计划**：整合上述材料，形成 Phase 0A（效率路由与预算，放在最前）到 Phase 8（shadow→pilot→enforced）。新增 PR-01947/02265/02306/01930 四个事故 replay，以及质量门与效率门两道独立门槛。§10.15 明确否决 F 设计中的 `policyPaths auto-extend`。
5. **09-19 实施**：`fc4acde`（reconcile、artifact compat，B 系列设计同批入库）、`9beb35a`（四档路由、work context、source graph、六失败域有界修复、delivery truth、evidence kinds、四项目 replay）、`c6c2c99`（release metadata）。交接文档记录了改动文件清单和验证结果。
6. **09-21 现状审计**（`autopilot-gap-closure-plan`）：结论是 v3.5 只是「状态判定器 + 部分自动命令」，`run` 不会连续执行。文档提出 P0 真值与观测 → P1 连续 Runner → P2 效率与覆盖 → P3 Pilot 四个批次。
7. **09-23**：CHANGELOG 记 v3.5.0 stable。pilot 仍为 `collecting`，因此不宣称 production-ready。

## 当时的结论与事后核实

| 当时的声称 | 事后核实 |
|---|---|
| 交接（09-19）：「v3.5 实施范围内没有剩余代码项」「完成标准 1–9 已满足」 | 09-21 审计认定这是 overclaim：模块已实现，但没接入 `run`，也没有真实项目认证。审计提出 `module-implemented / wired-to-run / synthetic-tested / real-project-certified` 四级状态词，作为纠偏 |
| 四项目 replay：`silentOmissionCount = 0`、`falseCompletionCount = 0` | 只说明算法能识别人工构造的夹具（synthetic）。09-21 审计和 [CHANGELOG 09-24](../../../common/CHANGELOG.md) 都说明它不能证明真实 PRD 被完整读取。10-09 审计（[status-audit](/Users/aven/.ai-rules/labs/prd-to-commit/reports/2026-10-09-status-audit.md)）显示这四个上线项目提测后仍分别漏了 3–5 项 |
| 主计划附录 F / 设计 F：当前计划可达「55% AutoPilot」，v3.9 达 80%，v4.0 达 90%，「3–4 周达成」 | **未经实测**，是主观估算。到 10-10 冻结为止，没有任何 AutoPilot 等级通过认证 |
| 09-21 审计的成熟度表（安全 75%、证据 80%、连续执行 35%、综合 55%–60%） | **未经实测**，原文自己写明是「粗略成熟度评估」 |
| 09-21 审计：「默认项目流程文件预计从 253 个降至 12 个」「context 字符代理显著下降」 | **未经实测**，属预计值。原文也说明不能把它表述为 token 降幅。09-24 的 CHANGELOG 删除了未经可比样本验证的效率结论 |
| 实施计划 §3.2 四档预算数值（micro 12k chars 等） | 原文称之为「首版硬上限，用于先建立 baseline」。之后 [vnext-efficiency-policy.mjs](../../../common/engine/agent-scripts/lib/vnext-efficiency-policy.mjs) 在 09-23 和 09-25 多次调整，不是校准后的值 |
| 09-21 审计 P0-2：worktree 脚本把「必须是当前 `origin/online` 后代」当硬阻断，与 Git 规则冲突 | 已修复：`1bfff62`（09-22）把它放宽为「有共同历史」，见 [prepare-coding-worktree.mjs](../../../common/engine/agent-scripts/prepare-coding-worktree.mjs) |
| 09-21 审计 P1：需要 Action Executor Registry 和连续 Runner | 09-24 起才在 [vnext-continuous-runner.mjs](../../../common/engine/agent-scripts/lib/vnext-continuous-runner.mjs) 中实现。CHANGELOG 09-24 说明 `run --prd` 返回 `needs-agent`，不等于 Runner 已接通或能连续交付 |
| Pilot 认证（V0/V1/V2 各一个 public-command-only 样本） | 始终没有完成。[pilot-report.json](../../../common/vnext/pilot-report.json) 的 `decision` 仍为 `collecting` |

## 沉淀下来、仍然有效的东西

- **v2 协议的 v3.5 能力说明**：[common/vnext/README.md](../../../common/vnext/README.md)，记录 source graph、delivery truth、R-13 pilot 资格。只用于维护存量 v2 项目。
- **B2 schema 落地**：`codeLocator / deliveryTarget / wiring / blockedBy` 已写进 [vnext-work-item.schema.json](../../../common/engine/schemas/vnext-work-item.schema.json)，三维对账结果见 [vnext-reconcile-result.schema.json](../../../common/engine/schemas/vnext-reconcile-result.schema.json)。
- **B3 fixture 落地**：[vnext-reconcile-cases.json](../../../common/engine/fixtures/vnext-reconcile-cases.json) 中有 PR-02233 `SwitchVerifyMethodDialog` 用例；四项目事故 replay 在 [fixtures/vnext-replay/](../../../common/engine/fixtures/vnext-replay/)。
- **引擎模块**：[vnext-delivery-truth.mjs](../../../common/engine/agent-scripts/lib/vnext-delivery-truth.mjs)、[vnext-repair-policy.mjs](../../../common/engine/agent-scripts/lib/vnext-repair-policy.mjs)、[vnext-source-graph.mjs](../../../common/engine/agent-scripts/lib/vnext-source-graph.mjs)、[vnext-runtime-decisions.mjs](../../../common/engine/agent-scripts/lib/vnext-runtime-decisions.mjs)、[vnext-work-context.mjs](../../../common/engine/agent-scripts/lib/vnext-work-context.mjs)。随 v2 一起冻结，不再演进。
- **思想被 prd-to-commit 轻量继承**：「requirement → 真实代码落点」演变为需求清单「原句→落点」逐行核对，「provider 存在≠consumer 接入」和集合 expectedCount 演变为冷读里的同因搜索，「不自动 push / 不伪造完成」继续保留。见 skill `~/.ai-rules/skills/prd-to-commit/SKILL.md`（仓库外）和 [~/.ai-rules/labs/prd-to-commit/](/Users/aven/.ai-rules/labs/prd-to-commit/README.md)。
- **Git 基线语义**：「环境分支禁写、只要求共同历史」与 [common/rules/git-branch-flow.md](../../../common/rules/git-branch-flow.md) 一致。

## 教训

1. **状态词要分级**。模块存在、接入主路径、synthetic 通过、真实项目认证是四件不同的事。交接文档把前两级写成了「完成」，两天后被审计推翻。
2. **replay 夹具通过不等于真实不漏**。四个事故全部被 fixture 拦住，但 10-09 回看，真实漏项发生在「清单条目 → 落点文件」逐条核对缺失、以及同因没搜全。这两件事不需要大型状态机，用一张核对表加搜索纪律就能覆盖。
3. **百分比路线图（55%→80%→90%）没有度量基础**，不该写进计划当作承诺。
4. **规划膨胀**：09-17 到 09-21 产出四份大计划（合计约 5000 行）和四份设计。纸面设计与实现在同一个 commit（`fc4acde`）入库，「评审通过才解锁编码」的门槛在 Git 历史中无法区分是否真的执行过。
5. **效率预算要放在质量能力之前**。实施计划把 Phase 0A 前置的判断是对的，但运行时一直没有接上预算消耗，小需求仍然很重，这直接导致后来 v4 Lite 和 Web Lite 的转向。

## 文件清单

| 文件 | 类型 | 内容 |
|---|---|---|
| [iteration-plan-v3.5-2026-09-17.md](./iteration-plan-v3.5-2026-09-17.md) | 主计划 + 决策 | v3.5–v3.8 四期规划；附录 A 问题台账、C 的 D-1/D-2/D-3 拍板、E 0918 反馈并入、F AutoPilot 索引。文末误挂了一段 v4.0 修订记录（见下方说明） |
| [design-b1-case-expectations.md](./design-b1-case-expectations.md) | 设计 | PR-02233 / hichat / TR-02386 / 证据充分性四案例的输入状态、期望机器输出、应拦截话术 |
| [design-b2-schema-statemachine.md](./design-b2-schema-statemachine.md) | 设计（已冻结） | codeLocator、wiring、deliveryTarget、reconcile-result 三维结果、十态状态机、A6 依赖下沉 |
| [design-b3-golden-fixtures.md](./design-b3-golden-fixtures.md) | 设计 | 场景 A/B/C/D 的 fixture 输入输出对 |
| [design-f-autopilot-control-layer-v3.9.md](./design-f-autopilot-control-layer-v3.9.md) | 设计 | M1 决策矩阵、M2 自动修复白名单、M3 runtime-decisions、M4 主控循环。其中 scope-auto-extend 被实施计划否决 |
| [implementation-plan-requirement-to-commit-2026-09-19.md](./implementation-plan-requirement-to-commit-2026-09-19.md) | 最终计划 | Phase 0A–8、四档预算、人工介入协议、失败域预算表、质量与效率双门、明确不做 |
| [handoff-v3.5-implementation-2026-09-19.md](./handoff-v3.5-implementation-2026-09-19.md) | 实施记录 | 9beb35a 的改动文件清单、已完成能力、replay 结果、check-doc-budget 遗留阻塞 |
| [autopilot-gap-closure-plan-2026-09-21.md](./autopilot-gap-closure-plan-2026-09-21.md) | 审计 + 计划 | 能力差距矩阵、`run` 只自动执行少数动作、四级状态词、P0–P3 补齐计划、09-21 基线 |

说明：`iteration-plan-v3.5` 文末的「修订记录 - 2026-01-XX（v4.0 规则补全）」由 `c39141e`（2026-09-23）追加，日期是占位符，内容属于 v4.0 Lite 实验，应当参照 [../2026-09-23-v4-lite-experiment/](../2026-09-23-v4-lite-experiment/) 阅读。

### 已合并删除的原文件

| 原路径 | 内容摘要 |
|---|---|
| `practice-log/ITERATION-PLAN-AUTOPILOT-20260918.md` | AutoPilot 路线图：AP-0~AP-4 能力等级、事实/对账/执行/交付四层、action packet 字段、统一终态、WIP/checkpoint/delivery 三档、A2–A7 细化、询问与不询问清单、Pilot 1–5、发布门槛。09-19 实施计划全部吸收（DoD 逐条一致，「明确不做」为其超集） |

取回方式：`git show 2f39fdd:<原路径>`
