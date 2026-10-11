# docs_tdd

FameEX Web 前端需求交付的**流程文档、回放基准与规则库**。本仓是个人维护的独立 git 仓库（远端 `github.com/hupo256/docs-tdd-system`，默认只做本地提交），通过软链挂载到 `fameex-web/apps/web/docs_tdd`，不进入业务仓提交。

## 现状一览

| 组成 | 状态 | 版本 | 本体位置 | 文档 |
|---|---|---|---|---|
| **prd-to-commit**：新需求从 PRD 到本地 commit 的流程 | **现行**，新需求唯一默认流程 | `prd-to-commit-v1.2` | `~/.ai-rules/skills/prd-to-commit/`（独立 git 仓库） | [使用说明](./docs/prd-to-commit/usage.md) · [版本记录](./docs/prd-to-commit/releases.md) |
| **回放基准**：衡量 prd-to-commit 每个版本 | 现行，改 skill 必须回放 | 6 个基准 | [benchmarks/replay/](./benchmarks/replay/README.md) | 同左 |
| **lark-bot**：群内 @ 触发的自动修 bug 服务 | 运行中，**已迁出为独立仓库**（2026-10-11） | 见该仓库 git log | `~/github/lark-bot`（CLI `~/.local/bin/lark-bot` 转发到该仓库） | 该仓库的 `README.md` 与 `docs/` |
| **docs_tdd 引擎**：G0–G8 / workflowVersion 2 门禁流程 | **冻结**（2026-10-10），只用于收尾存量项目；其代码规则检查 `precommit-verify-code-rules.mjs` 仍由 fameex-web 的 lint-staged 在每次提交时调用 | `v3.5.0` | [common/engine/](./common/engine/) · [common/rules/](./common/rules/) | [v3.5 引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md) |

为什么从 docs_tdd 引擎换到 prd-to-commit，见 [决策记录](./docs/decisions/2026-10-10-switch-to-prd-to-commit.md)。

## 快速开始

**新需求**：在 Claude Code 或 Codex 新开一个会话，说：

```text
用 prd-to-commit，项目号 PR-xxxxx，PRD：<Lark 链接>
```

AI 列出需求清单和待确认问题后会停下，等你确认一次，之后一路做到本地 commit，不会 push。详见[使用说明](./docs/prd-to-commit/usage.md)。

**存量项目**（`prds/<ID>/README.md` 标记了 `workflowVersion: 1|2`）：按该项目 README 恢复，命令见 [v3.5 引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md)。项目清单见 [PROJECTS.md](./PROJECTS.md)（自动生成）。

**改 prd-to-commit**：先满足「同类问题出现 2 次，并且能在回放中复现」，改完用 [回放基准](./benchmarks/replay/README.md) 验证，再按[版本记录](./docs/prd-to-commit/releases.md)的纪律发版。

**改 lark-bot**：它已是独立仓库 `~/github/lark-bot`，按该仓库的 `AGENTS.md` 操作，不在本仓改。拆分原因见[决策记录](./docs/decisions/2026-10-11-split-lark-bot.md)。

## 目录

```
README.md            本页
CHANGELOG.md         整仓版本时间线（各组成的版本与重大变更）
AGENTS.md            给 AI Agent 的行为规则
CONTEXT.md           本机运行状态与恢复提示（焦点行由引擎回写）
PROJECTS.md          存量项目索引（自动生成，勿手改）
docs/                人读文档：使用说明、决策、存量手册、历史归档 → docs/README.md
benchmarks/replay/   prd-to-commit 回放基准、结果与工具
common/              规则库（rules/）、引擎（engine/）、引擎变更日志
templates/           存量项目的文档模板（引擎 kickoff 使用）
prds/                存量项目实例：文档、状态与证据
docs-tdd.config.default.json   挂载配置的参考模板；本机实际配置 docs-tdd.config.json 已被 gitignore
package.json         引擎脚本的 Node 依赖（minimatch、yaml）
```

本地还可能出现被忽略的 `output-tdd/`：那是引擎运行时写的规则消费日志，不是文档。

`common/`、`templates/`、`prds/` 的路径被引擎脚本和 fameex-web 的 pre-commit hook 直接引用（lark-bot 只按配置只读 `prds/` 下的存量项目），**不要移动**。

## 文档

全部人读文档的索引、分类规则和归档规则见 [docs/README.md](./docs/README.md)。常用入口：

- [prd-to-commit 使用说明](./docs/prd-to-commit/usage.md)
- [决策记录](./docs/decisions/README.md)：每次默认流程的切换及其原因
- [历史归档](./docs/archive/README.md)：v3.1 至今各阶段的计划、实验与复盘，逐条标注结论是否仍然有效
- [规则库索引](./common/README.md)：`common/rules/` 专题全索引

## 版本与变更

整仓时间线见 [CHANGELOG.md](./CHANGELOG.md)；各组件的版本来源、git tag 和细目日志见 [docs/README.md](./docs/README.md)「版本管理」。

## 仓库约定

- 默认只做本地提交，未经当次明确授权不 push。
- 新文档先按 [docs/README.md](./docs/README.md) 的分类放置；不要再在根目录或 `plan/` 一类目录堆放报告。
- `common/` 下的规则改动之后，运行 `check-doc-links.mjs` 和 `check-doc-budget.mjs`，都通过后再运行 `rule-release.mjs --write` 重新发布指纹。自检现状见 [v3.5 引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md)「自检状态」。
