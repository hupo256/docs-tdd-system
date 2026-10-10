# 优化落地计划与真实需求 Pilot（2026-09-24 ~ 2026-09-26）

> 状态：已归档（只读） · 结论有效性：未完成即被取代（批次 A–C 与 v4.x M0–M2 已实现并通过合成验证；Pilot 与 cutover 未完成） · 后继：[Web Lite 切换记录](../../decisions/2026-09-28-switch-to-web-lite.md) → [2026-10-09 现状审计](../../prd-to-commit/reports/2026-10-09-status-audit.md) → prd-to-commit

## 一句话

在 v4 Lite 实验撤回后，回到单一 v2 入口（`docs-tdd run`）做止损和 Runner 闭环，并计划用新的真实需求 Pilot 决定是否切换默认路径；合成 E2E 全部打通，真实 Pilot 只收集到 V0、V1 各 1 个完成样本，09-27 起方向转向，09-28 新需求改走 Web Lite，Pilot 和 v4.x M3/M4 未再推进。

## 背景与目标

- 前序：[v4 Lite 实验](../2026-09-23-v4-lite-experiment/) 用人工摘要绕过来源对账、跳过正式 verify，被判定与 v2 安全边界不兼容而撤回。
- 本阶段目标路径：用户给需求 → 安全 worktree → 完整理解 → 实现 → 定向验证与修复 → 本地提交，不自动 push。
- 硬约束：不静默漏需求、不假完成、小需求低成本、可连续执行、结果可度量（token 拿不到记 `null`，不估算）。
- 发布门槛：至少各 1 个真实 V0/V1/V2 样本 + 至少 10 个可比 Micro 样本，Micro p50 历时降 30% 以上、p90 恶化不超过 10%；达标也只标 `eligible-for-owner-cutover-review`，由 owner 决定切换。

## 做了什么

| 日期 | 事项 | 提交 |
|---|---|---|
| 09-24 | 批次 A/B：收敛入口（`kickoff` 走 v2，旧 Lite 禁写）；`not-a-requirement` 必须带 `exclusionEvidence` 原文引用；退役旧 v4 loader、0b894de 引入的 7 篇重复规则和 phase1 旁路脚本；压缩 rule-router（aa31b21 使其超出预算 173 字符） | aa31b21、6e26d1d |
| 09-25 | 批次 C/D 基础设施：Continuous Runner 接入 `run`，Codex/Claude adapter，clean-project 单输入 E2E 到 enforced PASS 和 scoped commit；Micro 路径与 trace | 5a27d3e |
| 09-25 | Owner 决策：发布证据改为新需求 Pilot，不再建设 PR-01947/02265/02306/01930 的历史 replay/golden | 9e1c068 |
| 09-25 | 首个 Pilot 候选 PR-02233（登录按钮 hover 手型）：业务改动完成，但系统把增量错绑到同编号历史 PRD（V2/high-risk、41 个历史 surface），记 `blocked-system`；据此修复增量 change-set、`--dry-run` 零副作用、login 样式误判 high-risk、单张辅助截图可走 Micro | 36181a6 |
| 09-25 | 同日另有 trivial 执行档、scope-advisor 入口守卫（计划文档未单列） | beb7919、cc280e8、7e819ad |
| 09-25 | 建立 v4.x 迭代计划 M0–M4；M0（Pilot hold/资格）、M1（状态真值/遥测）、M2（来源绑定闭环）完成合成验证 | 8ac9257、3dfe9d6、c5c8790、c726d43、f0109fc |
| 09-26 | 清理测试 PRD 与 v4 计划文档；修正 change-set 自建 `fix/<PR>-<change>` 分支和后缀 worktree 的偏差，改为复用父项目绑定 | 3b2e09c、[CHANGELOG](../../../common/CHANGELOG.md) 09-26 条 |
| 09-26 | PR-02233 下 4 个增量 change 登记为 Pilot 样本（见下节） | 09af056、17cf505 |

## 当时的结论与事后核实

| 当时结论 | 事后核实 |
|---|---|
| WP1 来源覆盖 `synthetic-tested`，WP2 Runner、WP3 Micro `e2e-tested` | 成立，但仅限合成项目；引擎在 09-28 后不再用于新需求 |
| 真实 Pilot 台账只有 PR-02233 一条，状态 `blocked-system` | 台账在 09-25 后未更新。09-26 实际样本记在 [prds/PR-02233/pilot-samples.json](../../../prds/PR-02233/pilot-samples.json)：V0 文案逗号、V1 Geetest not proof 两个 `completed`（enforced passed），1 个 V0 `failed`，1 个 `collecting`；均未记录提测观察、历时和 token |
| 发布门槛需要 V0/V1/V2 + 10 个 Micro | 未达到：无 V2 样本，Micro 样本远少于 10，未做 p50/p90 对比；[pilot-report.json](../../../common/vnext/pilot-report.json) 生成于 09-26 10:28，早于两个完成样本，仍显示 completed 0 |
| 10-09 审计称「real-demand-pilot 合格样本 0 个」 | 按台账口径成立；按 pilot-samples.json 有 2 个完成样本，但都缺提测观察，严格按门槛仍不算合格 |
| 增量 change 应切独立 `feature/<PR>-<change>` 或 `fix/<PR>-<change>` 分支（Pilot 台账 §4.2） | 09-26 被纠正为复用父项目分支/worktree，原设计已失效 |

## 未完成项及其去向

| 未完成项 | 去向 |
|---|---|
| 批次 D 真实 Pilot（V2 样本、10 个 Micro、提测观察、效率对比） | 放弃。09-27 MIGRATION.md 提出转向现成工具，09-28 [Web Lite](../../../common/rules/web-lite-workflow.md) 取代 v2 新需求流程，10-10 docs_tdd 冻结（e460b8f）。无人负责 |
| 批次 E / v4.x M4 owner cutover | 未启动，不再启动；VERSION 停在 v3.5.0 |
| v4.x M3 真实 Pilot | 状态停在 `blocked-on-new-real-demand` |
| 公开命令下 repair 二次失败预算与中断恢复 E2E | 未做，随引擎冻结 |
| 既有债：L2 golden `47 != 49`、`PROJECTS.md` 派生漂移 | 计划写「交给对应 owner」但未指名；git log 中未见后续处理 |
| 效率基线 | 未建立可审计基线；Web Lite 决策明确不采用未核实数字。prd-to-commit 改用 [回放基准](../../../benchmarks/replay/) 度量 |

## 沉淀下来、仍然有效的东西

- 状态词纪律：准备脚本只报 `ready`、模拟只报 `simulated`、未执行检查不记通过；`implemented ≠ wired-to-run ≠ synthetic-tested ≠ e2e-tested ≠ pilot-certified`。全局规则现有同义条款（unexecuted checks never pass）。
- token 只记宿主真实 usage，拿不到记 `null`，不估算。
- 「自然展示 / 沿用现有逻辑」本身不是排除证据；同一来源单元含明确新增功能时不能整体排除。
- 同编号增量需求不得继承历史 PRD 范围（PR-02233 错绑教训）。
- 效率目标是观测指标，超标记 `target-exceeded`，不得因此停止交付或必要验证。
- 「历史项目不做 replay/golden」这一取舍未延续：10-09 起 prd-to-commit 恰恰以 PR-02306、PR-01930 等历史 PR 回放作为基准。

## 教训

- 发布门槛（3 个等级 + 10 个 Micro + 提测观察）对单人、低频需求节奏过重，两天内只拿到 2 个完成样本，门槛在流程被替换前不可能达到。
- 样本登记分散在两处（plan 台账与项目内 pilot-samples.json），台账未同步，导致 10-09 审计读到的是过期数字。
- 计划、交接、台账、CHANGELOG 在 48 小时内多次互相改写，CHANGELOG 只覆盖 09-24 与 09-26，09-25 的大量引擎变更没有变更记录。
- 合成 E2E 全绿不能说明真实需求可用：第一条真实需求就暴露了增量错绑、dry-run 调 Agent、login 误判 high-risk 三个问题。

## 文件清单

| 文件 | 类型 | 内容 |
|---|---|---|
| [optimization-execution-plan-2026-09-24.md](./optimization-execution-plan-2026-09-24.md) | 计划 + 实施记录 | 成功标准、来源/Surface 处置契约、WP0–WP4、批次 A–E、状态词、09-25 owner 决策与已接受代价 |
| [real-demand-pilot-2026-09-25.md](./real-demand-pilot-2026-09-25.md) | Pilot 台账 | Pilot 规则、样本记录口径、PR-02233 `blocked-system` 结论与触发的系统修复；09-26 后续样本未登记于此 |
| [v4x-iteration-plan-2026-09-25.md](./v4x-iteration-plan-2026-09-25.md) | 迭代计划 | M0–M4 目标、验收证据、Pilot 指标定义（gross/active elapsed）、M0–M2 合成验证状态 |

文中引用的 `plan/...` 路径为归档前旧路径，对应文件均已移入本目录或 [v4 Lite 实验目录](../2026-09-23-v4-lite-experiment/)。

### 已合并删除的原文件

| 原路径 | 内容摘要 |
|---|---|
| `plan/next-steps-minimal-2026-09-24.md` | 承接 aa31b21 的 P0/P1 清单：doc-budget 阻断归属（router +173 字符、7 篇未索引规则来自 0b894de、两项既有债）、`exclusionEvidence` 契约改动、验证记录（67 个 vNext 聚合 self-test、101 个核心 self-test、339 个链接）、本地提交 aa31b21/6e26d1d/5a27d3e。要点已并入优化计划 §7 与本纪要 |
| `plan/handoff-real-demand-pilot-2026-09-25.md` | 09-25 交接快照（HEAD 36181a6，main ahead 7，未 push）：批次 A–D 状态、PR-02233 结论、批次 D/E 待办、明确不做清单、既有债、接续读取顺序。内容与优化计划 §4/§8、Pilot 台账、v4.x 计划 §2 重复 |

取回方式：`git show 2f39fdd:<原路径>`
