# 历史归档

docs_tdd 从 v1 到 prd-to-commit 各阶段的计划、设计、实验和复盘。**本目录只读**：文档保持当时的原文，不随现状更新；每个阶段目录的 `README.md` 是纪要，写明当时做了什么、声称了什么、事后如何核实、哪些东西至今仍然有效。

查现行流程请看 [prd-to-commit](../prd-to-commit/usage.md)；查为什么切换请看[决策记录](../decisions/README.md)。

## 时间线

| 阶段 | 时间 | 一句话 | 结论有效性 |
|---|---|---|---|
| v1 → v2 | 2026-06 ~ 09-08 | G0–G8 门禁流程上线；09-08 切到 workflowVersion 2（[切换决策](../../common/vnext/cutover-decision-20260908.md)）。这段时期没有单独的归档文档，细目见 [CHANGELOG-archive](../../common/CHANGELOG-archive.md) | 存量 v1/v2 项目仍按此执行 |
| [规则治理三合一分享](./2026-07-24-rule-governance/README.md) | 2026-07 ~ 08 | 架构规则、L1/L2/L3 分层、按需加载三项治理的会议分享 | 部分有效：分层判据沿用至今 |
| [v3.1–v3.3 实践期](./2026-09-12-v3.1-v3.3-practice/README.md) | 09-12 ~ 09-18 | v3.1 首次在 3 个真实需求上跑通，暴露约 40 条框架缺陷；PR-02233 出现「局部实现被误报为整批完成」的事故 | 部分有效 |
| [v3.5 Requirement-to-Commit](./2026-09-17-v3.5-requirement-to-commit/README.md) | 09-17 ~ 09-23 | 从「流程发生过」转向「交付事实可信」：surface→code 对账、预算路由、有界修复、delivery truth；09-23 发布 v3.5.0 stable | 部分有效：引擎落地，AutoPilot 未经真实认证 |
| [Phase 1–5 优化实验](./2026-09-21-phase1-5-experiment/README.md) | 09-21 ~ 09-24 | 一天写出 8 个实验模块，宣称大幅提效；当天审查发现安全问题并回滚 | **指标已撤回** |
| [v4.0 / v4.1 Lite 实验](./2026-09-23-v4-lite-experiment/README.md) | 09-23 ~ 09-24 | 代码快速通道与人工提炼 Lite 模式，靠 1~3 个自估样本宣称提速；次日入口收敛、执行器禁用 | **数字已撤回**；定性发现部分有效 |
| [优化落地与真实需求 Pilot](./2026-09-24-optimization-pilot/README.md) | 09-24 ~ 09-26 | 回到单一 v2 入口止损，合成 E2E 打通；真实 Pilot 只收集到 2 个完成样本 | 未完成即被取代 |
| Web Lite | 09-28 ~ 10-10 | 新需求改走轻量流程（[决策](../decisions/2026-09-28-switch-to-web-lite.md)、[规范](../../common/rules/web-lite-workflow.md)） | 已被取代 |
| prd-to-commit | 10-09 起 | 现行，见 [docs/prd-to-commit/](../prd-to-commit/usage.md) | **现行** |

## 一以贯之的教训

1. **没有实测的数字不要写成结论。** 09-21 和 09-23 两轮都把目标值或自估值写成了效果，事后整体撤回。prd-to-commit 因此改用[回放基准](../../benchmarks/replay/README.md)，每个版本都要有可复算的得分和 token 数据。
2. **流程越重，越容易漏需求。** [2026-10-09 现状审计](../prd-to-commit/reports/2026-10-09-status-audit.md)的结论是：漏项发生在「需求条目 → 代码落点」这一步，而门禁和规则在这一步上没有起作用，反而消耗了约一半的 token。
3. **完成报告不等于完成。** 多个阶段出现过「宣称已集成」与代码现状不符的情况，以代码、git 历史和可复算的证据为准。

## 旧路径对照

2026-10-11 整理前，这些文档散在根目录的 `plan/`、`practice-log/`、`output-tdd/`、`share/` 以及 `common/` 的几个角落里。归档原文里出现的旧路径按下表对应：

| 旧位置 | 现位置 |
|---|---|
| `practice-log/PRACTICE-LOG-*`、`pr-02233-system-feedback-0918.md` | [2026-09-12-v3.1-v3.3-practice/](./2026-09-12-v3.1-v3.3-practice/README.md) |
| `practice-log/ITERATION-PLAN-*`、`IMPLEMENTATION-PLAN-*`、`HANDOFF-V3.5-*`、`DESIGN-*`，`plan/docs-tdd-autopilot-gap-closure-plan-*` | [2026-09-17-v3.5-requirement-to-commit/](./2026-09-17-v3.5-requirement-to-commit/README.md) |
| `output-tdd/*`、`plan/optimization-plan-2026-09-21.md`、`plan/phase*`、`plan/task-completion-*`、根目录 `RELEASE-v3.5.0.md` | [2026-09-21-phase1-5-experiment/](./2026-09-21-phase1-5-experiment/README.md) |
| `practice-log/V4.0-*`、`plan/v4-lite-experiment-results.md`、`plan/v4.1-*` | [2026-09-23-v4-lite-experiment/](./2026-09-23-v4-lite-experiment/README.md) |
| `plan/optimization-execution-plan-*`、`plan/next-steps-*`、`plan/*pilot*`、`plan/v4x-*` | [2026-09-24-optimization-pilot/](./2026-09-24-optimization-pilot/README.md) |
| `share/rule-governance-share.html` | [2026-07-24-rule-governance/](./2026-07-24-rule-governance/README.md) |
| `common/docs/lite-mode-guide.md`、`common/templates/lite-*` | [2026-09-23-v4-lite-experiment/](./2026-09-23-v4-lite-experiment/README.md) |
| `common/lark-bot/docs/handoff-lark-lightweight-v31.md` | [2026-09-12-v3.1-v3.3-practice/](./2026-09-12-v3.1-v3.3-practice/README.md) |
| 根目录 `MIGRATION.md` | [decisions/2026-09-28-switch-to-web-lite.md](../decisions/2026-09-28-switch-to-web-lite.md) |
| `plan/prd-to-commit-*`、`plan/status-audit-*`、`plan/final-report-*`、`plan/autonomous-iteration-ledger.md` | [docs/prd-to-commit/](../prd-to-commit/usage.md) |
| `plan/replay/` | [benchmarks/replay/](../../benchmarks/replay/README.md) |

整理时有 28 份冗余文件（重复的完成报告、日报、集成状态、被取代的计划草稿）合并进了各阶段纪要后删除。每份纪要的「已合并删除的原文件」一节列出了原路径，可以用 `git show 2f39fdd:<原路径>` 取回原文。

## 归档规则

- 一个阶段一个目录，命名为 `YYYY-MM-DD-<主题>`，日期取阶段开始日。
- 每个阶段目录必须有 `README.md` 纪要，包含：状态、结论有效性、一句话、背景、做了什么、当时的结论与事后核实、仍然有效的东西、教训、文件清单。
- 阶段结束时归档：一手记录（计划、设计、实验数据、审计）保留；重复的完成报告和日报合并进纪要后删除，并在纪要里登记原路径。
- 归档后不改原文。需要更正时，在纪要里写明，或在原文顶部加「归档说明」。
