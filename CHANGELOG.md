# Changelog

整个 docs_tdd 仓库的版本时间线，只记版本和重大变更。细目分别见：

- prd-to-commit：[releases.md](/Users/aven/.ai-rules/labs/prd-to-commit/releases.md)（2026-10-11 起在 `~/.ai-rules/labs/prd-to-commit/`，不在本仓）
- docs_tdd 引擎与规则：[common/CHANGELOG.md](./common/CHANGELOG.md)（更早的条目在 [CHANGELOG-archive.md](./common/CHANGELOG-archive.md)）
- 各历史阶段的计划与复盘：[docs/archive/](./docs/archive/README.md)

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，按时间倒序排列。只写可核查的事实；效率和质量数字必须来自回放或真实运行的记录，并给出出处。

## 2026-10-11 prd-to-commit 研发资产迁出

### Removed

- `benchmarks/replay/`、`docs/prd-to-commit/`（releases、iteration-ledger、usage、reports/）和 `docs/decisions/` 里与新需求默认流程相关的两份决策（2026-09-28 Web Lite、2026-10-10 prd-to-commit），迁到 [~/.ai-rules/labs/prd-to-commit/](/Users/aven/.ai-rules/labs/prd-to-commit/README.md)。本仓不再承担 prd-to-commit 的现役职能。
- `docs/decisions/` 只保留 docs_tdd 自身历史（lark-bot 拆仓）；本仓指向迁出文件的链接改为绝对路径。

## 2026-10-11 lark-bot 迁出为独立仓库

见[决策记录](./docs/decisions/2026-10-11-split-lark-bot.md)。

### Changed

- lark-bot 用 `git subtree split` 带历史迁到 `~/github/lark-bot`，不再 import 本仓的任何代码。运行中的服务已切换到新仓库，`~/.local/bin/lark-bot` 转发到新仓库的 CLI。本仓删除 `common/lark-bot/`。
- 引擎中对 lark-bot 的引用已删除：规则指纹的排除项、effective-sources 的 runtime adapters、预算和自测注释。随后重新发布了规则指纹 `91334667a79a` 和生效规则 `cf11742be7a7`。
- 删除失效的项目级 worker 包装（PR-01685、PR-01973）。

### Added（在 lark-bot 仓库）

- 修改范围契约：所有会改代码的任务先跑只读分析，输出结构化的 `scope`；提交前用实际改动核对，越界时挂成「待确认」，群里回复「确认扩大范围」即可放行。
- 内置独立代码规则扫描器（权威版本在 `~/.ai-rules` `cdae09b`，prd-to-commit 的 `check.mjs` 也调用它）。
- PRD 优先从 `~/.prd-cache/<ID>/` 读取，其次读存量项目的 `prds/`。

## [docs-2026.10.11] — 2026-10-11 文档整理

### Changed

- 人读文档统一放到 `docs/`，按现行流程（`prd-to-commit/`）、决策（`decisions/`）、存量手册（`legacy/`）、历史归档（`archive/`）分类，分类和命名规则见 [docs/README.md](./docs/README.md)。
- 回放基准从 `plan/replay/` 移到 `benchmarks/replay/`（同日再迁到 [~/.ai-rules/labs/prd-to-commit/replay/](/Users/aven/.ai-rules/labs/prd-to-commit/replay/README.md)），评分标准和结果记录分开存放；`score-prompt.sh` 改为按脚本位置定位评分标准，不再写死本仓路径（`prompt.tpl`、`codex-run.sh` 中指向回放 worktree 的本机路径仍保留）。
- 根 README 改写为首页，只保留现状、快速开始和目录；docs_tdd v3.5 引擎的完整手册拆到 [docs/legacy/docs-tdd-v3.5-manual.md](./docs/legacy/docs-tdd-v3.5-manual.md)。
- 本文件重写为整仓时间线，补上 v4 实验、Web Lite 和 prd-to-commit 的记录。
- 复审修正（同日第二个提交）：
  - `common/` 里仍把 Web Lite 写成新需求流程的正文改为指向 prd-to-commit（不改被 lark-bot 引用的标题）；
  - 引擎版本源 `system-version.mjs` 的历史与本文件对齐；
  - `common/CHANGELOG.md` 补齐 09-28 之后的条目；
  - 存量项目指针从 rule-router §1 改为 §2；
  - Lite 遗留模板和 lark 交接快照移入归档，`common/docs/`、`common/templates/` 两个目录不再存在；
  - 重新生成 PROJECTS.md；
- 引擎自检转绿（同日第三个提交）：修复冻结前遗留的四项 `check-doc-budget` 失败，`rule-release --write` 重新发布规则指纹，`--check` 恢复 fresh。修法见[引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md)「自检状态」。
  - 修正 usage、台账中的数字，最终报告加勘误。

### Removed

- `plan/`、`practice-log/`、`share/` 三个目录和 `output-tdd/` 下的报告（该目录本身仍是引擎运行时日志的位置，已被 gitignore），以及根目录的 `RELEASE-v3.5.0.md`、`MIGRATION.md`、`VERSION`。内容迁移位置见[旧路径对照](./docs/archive/README.md)。`VERSION` 不再保留：仓库里有多个组件，各自的版本来源见 [docs/README.md](./docs/README.md)。
- 28 份冗余的完成报告、日报和被取代的计划草稿，内容合并进对应阶段纪要后删除。原路径登记在各纪要中，可用 `git show 2f39fdd:<原路径>` 取回。
- 残留的测试目录 `apps/web/docs_tdd/prds/TEST-V4-LITE-001/`（v4 Lite 实验的 kickoff 产物，路径套错了一层）。
- 旧版本文件里的 v3.5.0 效率、准确率指标（「准确率 +30%」「Token −60%」等）。这些数字已于 09-24 撤回，此前在本文件里一直没删。原始声明保留在[归档的发布说明](./docs/archive/2026-09-21-phase1-5-experiment/release-notes-v3.5.0.md)中作为证据。

## prd-to-commit v1.2 — 2026-10-11

浏览器核对打通：四个站点使用固定 dev server 加专用浏览器 profile，连 test 环境跑真实页面，写操作默认拦截。见 [releases.md](/Users/aven/.ai-rules/labs/prd-to-commit/releases.md)。

## prd-to-commit v1.1 — 2026-10-11（正式版）

在 6 个回放基准上，Claude 平均得分 95.3%，陷阱零违反；Codex 在 2 个基准上不低于历史首轮。成本约为历史的 1/4 到 1/16。未达标项：1 个中等需求的 token 超出目标约 15%。见[最终报告](/Users/aven/.ai-rules/labs/prd-to-commit/reports/2026-10-11-final-report.md)。

## prd-to-commit v1.0 — 2026-10-10 · docs_tdd 冻结

- 新需求改用 skill `prd-to-commit`；docs_tdd 引擎冻结在 v3.5.0，只用于收尾存量 `workflowVersion: 1|2` 项目；Web Lite 废弃。见[决策](/Users/aven/.ai-rules/labs/prd-to-commit/decisions/2026-10-10-switch-to-prd-to-commit.md)。
- 依据：[2026-10-09 现状审计](/Users/aven/.ai-rules/labs/prd-to-commit/reports/2026-10-09-status-audit.md)、[正式化评估](/Users/aven/.ai-rules/labs/prd-to-commit/reports/2026-10-10-readiness.md)，以及 PR-02306、PR-01930 两个回放。
- lark-bot：默认执行器改为 Claude；回收空闲的孤儿任务；新增 `claude-auth` 切换；修 bug 表前先做只读分诊。

## Web Lite — 2026-09-28

新需求改走「PRD → 最小 Task → worktree → coding → 冷读 → 本地提交」，不再跑 G0–G8 或 v2 work-item。2026-10-10 被 prd-to-commit 取代。见[决策](/Users/aven/.ai-rules/labs/prd-to-commit/decisions/2026-09-28-switch-to-web-lite.md)。

## 优化落地与真实需求 Pilot — 2026-09-24 ~ 09-26

撤回 Phase 1–5 和 v4 实验中无实测的数字；入口收敛到单一的 v2 `docs-tdd run`；Lite executor 禁用；Runner 闭环通过合成 E2E。真实 Pilot 未完成，方向随后转向 Web Lite。见[阶段纪要](./docs/archive/2026-09-24-optimization-pilot/README.md)。

## v4.0 / v4.1 Lite 实验 — 2026-09-23（已撤回）

代码快速通道、规则档位裁剪和人工提炼的 Lite 模式，靠 1~3 个自估样本宣称提速。次日入口被收敛、执行器被禁用，相关数字被删除。从未作为正式版本发布。见[阶段纪要](./docs/archive/2026-09-23-v4-lite-experiment/README.md)。

## docs_tdd v3.5.0 — 2026-09-23 stable

- 2026-09-19 实施 Requirement-to-Commit：四档效率路由与预算、safe work context、source graph、requirement/surface/evidence 对账、六类失败的有界修复、delivery truth。
- 2026-09-23 通过规则发布、golden 回归和 `docs-tdd guard --strict` 后定为 stable。pilot 仍为 `collecting`，没有 production attestation。
- 09-21 的 Phase 1–5 实验模块曾以「v3.5.0 发布」的名义带着效率指标对外说明，当天审查发现安全问题后回滚为只读候选，指标于 09-24 撤回。见[阶段纪要](./docs/archive/2026-09-21-phase1-5-experiment/README.md)。
- 细目：[common/CHANGELOG.md](./common/CHANGELOG.md) 2026-09-19、09-23 条；设计与计划见[阶段纪要](./docs/archive/2026-09-17-v3.5-requirement-to-commit/README.md)。

## docs_tdd v3.1.0 ~ v3.3.0 — 2026-09-11 ~ 09-16

v3.1 定版（09-11），v3.2 改进 Intake 和 Review 的可靠性，v3.3 实现 Autopilot Implementation Loop（均为 09-12），随后补齐审查成本上限、验证经济和 Hook 兼容。首批真实项目的实践记录见[阶段纪要](./docs/archive/2026-09-12-v3.1-v3.3-practice/README.md)。

## docs_tdd v2.0.0 — 2026-09-08（启用 workflowVersion 2 协议）

新需求默认使用 v2：work-item 状态机，`docs-tdd verify` 是唯一正式出口，结果全等级 enforced。存量项目继续用 v1。见[切换决策](./common/vnext/cutover-decision-20260908.md)。

## lark-bot — 2026-08-06 起

群内 @ 触发的自动修 bug 服务。08-06 增加 Codex 执行器；08-07 完成无人值守链路 P0–P3；08-08 抽成 `common/lark-bot/` 子树；08-10 接入 bug「验退」自动进入下一轮修复；之后持续迭代。正式交付权与轻量闭环分离（09-11）。见 lark-bot 运维手册（`~/github/lark-bot/docs/README.md`）。

## docs_tdd 独立成仓 — 2026-08-04

从 fameex-web 的本地忽略目录抽成独立 git 仓库，通过软链挂载回 `fameex-web/apps/web/docs_tdd`，路径解析与宿主仓解耦。

## docs_tdd v1 — 2026-06 ~ 08

G0–G8 阶段门禁、项目文档模板、规则路由与按需加载、L1/L2/L3 规则分层、规则发布指纹。细目见 [CHANGELOG-archive.md](./common/CHANGELOG-archive.md)（最早记录为 2026-07-05）。
