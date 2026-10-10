# docs_tdd

FameEX Web 前端需求交付的**流程文档、回放基准与规则库**。本仓是本机私有仓库，通过软链挂载到 `fameex-web/apps/web/docs_tdd`，不进入业务仓提交。

## 现状一览

| 组成 | 状态 | 版本 | 本体位置 | 文档 |
|---|---|---|---|---|
| **prd-to-commit**：新需求从 PRD 到本地 commit 的流程 | **现行**，新需求唯一默认流程 | `prd-to-commit-v1.2` | `~/.ai-rules/skills/prd-to-commit/`（独立 git 仓库） | [使用说明](./docs/prd-to-commit/usage.md) · [版本记录](./docs/prd-to-commit/releases.md) |
| **回放基准**：衡量 prd-to-commit 每个版本 | 现行，改 skill 必须回放 | 6 个基准 | [benchmarks/replay/](./benchmarks/replay/README.md) | 同左 |
| **lark-bot**：群内 @ 触发的自动修 bug 服务 | 运行中（可选组件） | 未单独发版 | [common/lark-bot/](./common/lark-bot/) · CLI `~/.local/bin/lark-bot` | [运维手册](./common/lark-bot/docs/README.md) |
| **docs_tdd 引擎**：G0–G8 / workflowVersion 2 门禁流程 | **冻结**（2026-10-10），只用于收尾存量项目 | `v3.5.0` | [common/engine/](./common/engine/) · [common/rules/](./common/rules/) | [v3.5 引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md) |

为什么从 docs_tdd 引擎换到 prd-to-commit，见 [决策记录](./docs/decisions/2026-10-10-switch-to-prd-to-commit.md)。

## 快速开始

**新需求**：在 Claude Code 或 Codex 新开一个会话，说：

```text
用 prd-to-commit，项目号 PR-xxxxx，PRD：<Lark 链接>
```

AI 列出需求清单和待确认问题后会停下，等你确认一次，之后一路做到本地 commit，不会 push。详见[使用说明](./docs/prd-to-commit/usage.md)。

**存量项目**（`prds/<ID>/README.md` 标记了 `workflowVersion: 1|2`）：按该项目 README 恢复，命令见 [v3.5 引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md)。项目清单见 [PROJECTS.md](./PROJECTS.md)（自动生成）。

**改 prd-to-commit**：先满足「同类问题出现 2 次，并且能在回放中复现」，改完用 [回放基准](./benchmarks/replay/README.md) 验证，再按[版本记录](./docs/prd-to-commit/releases.md)的纪律发版。

**改 lark-bot**：见 [lark-bot 运维手册](./common/lark-bot/docs/README.md)。`~/.local/bin/lark-bot` 不在本仓里，网关的 HTTP 契约变了要同步修改它。

## 目录

```
README.md            本页
CHANGELOG.md         整仓版本时间线（各组成的版本与重大变更）
AGENTS.md            给 AI Agent 的行为规则
CONTEXT.md           本机运行状态与恢复提示（焦点行由引擎回写）
PROJECTS.md          存量项目索引（自动生成，勿手改）
docs/                人读文档：使用说明、决策、存量手册、历史归档 → docs/README.md
benchmarks/replay/   prd-to-commit 回放基准、结果与工具
common/              规则库（rules/）、引擎（engine/）、lark-bot、引擎变更日志
templates/           存量项目的文档模板（引擎 kickoff 使用）
prds/                存量项目实例：文档、状态与证据
```

`common/`、`templates/`、`prds/` 的路径被引擎脚本、fameex-web 的 pre-commit hook 和 lark-bot 直接引用，**不要移动**。

## 文档

全部人读文档的索引、分类规则和归档规则见 [docs/README.md](./docs/README.md)。常用入口：

- [prd-to-commit 使用说明](./docs/prd-to-commit/usage.md)
- [决策记录](./docs/decisions/README.md)：每次默认流程的切换及其原因
- [历史归档](./docs/archive/README.md)：v3.1 至今各阶段的计划、实验与复盘，逐条标注结论是否仍然有效
- [规则库索引](./common/README.md)：`common/rules/` 专题全索引

## 版本与变更

- 整仓时间线：[CHANGELOG.md](./CHANGELOG.md)。
- prd-to-commit：以 `~/.ai-rules` 的 tag 为准，记录在 [releases.md](./docs/prd-to-commit/releases.md)。
- docs_tdd 引擎和规则：细目见 [common/CHANGELOG.md](./common/CHANGELOG.md)（更早的条目在 [CHANGELOG-archive.md](./common/CHANGELOG-archive.md)）。
- 本仓 git tag：`docs-tdd-v3.5.0`（引擎最后一个正式版本）、`docs-2026.10.11`（本次文档整理）。

## 仓库约定

- 默认只做本地提交，未经当次明确授权不 push。
- 新文档先按 [docs/README.md](./docs/README.md) 的分类放置；不要再在根目录或 `plan/` 一类目录堆放报告。
- 体量和链接由 `common/engine/agent-scripts/check-doc-budget.mjs`、`check-doc-links.mjs` 校验；`common/` 目录下的规则改动之后，要运行 `rule-release.mjs --write` 重新发布指纹。
