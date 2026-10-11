# 文档索引

本目录放**给人读的文档**。会被脚本读写的文件（规则、引擎、模板、项目实例）不放这里，它们留在 `common/`、`templates/`、`prds/`，路径不变。

## 分类

| 目录 | 放什么 | 现有文档 |
|---|---|---|
| [prd-to-commit/](./prd-to-commit/) | 现行流程：使用说明、版本记录、迭代台账、评估报告 | [使用说明](./prd-to-commit/usage.md) · [版本记录](./prd-to-commit/releases.md) · [迭代台账](./prd-to-commit/iteration-ledger.md) |
| [prd-to-commit/reports/](./prd-to-commit/reports/) | 某一时点的评估与报告，文件名带日期，写成后不再改 | [10-09 现状审计](./prd-to-commit/reports/2026-10-09-status-audit.md) · [10-10 正式化评估](./prd-to-commit/reports/2026-10-10-readiness.md) · [10-11 最终报告](./prd-to-commit/reports/2026-10-11-final-report.md) |
| [decisions/](./decisions/README.md) | 改变默认流程的决策：背景、决策、依据、后果 | [索引](./decisions/README.md) |
| [legacy/](./legacy/) | 已冻结、但存量项目仍在用的系统手册 | [docs_tdd v3.5 引擎手册](./legacy/docs-tdd-v3.5-manual.md) |
| [archive/](./archive/README.md) | 历史阶段的计划、设计、实验与纪要，只读 | [时间线](./archive/README.md) |

不在本目录、但同属文档的：

- [benchmarks/replay/](../benchmarks/replay/README.md)：回放基准、结果与工具。
- [common/README.md](../common/README.md)：规则库专题全索引；[common/rules/rule-router.md](../common/rules/rule-router.md) 是存量项目开工的常驻入口。
- lark-bot 运维手册：已随 lark-bot 迁到独立仓库 `~/github/lark-bot/docs/`。

## 新文档放哪

按这个顺序判断：

1. 是现行流程的使用方法或版本说明？→ `prd-to-commit/`，更新已有文件，不新建同主题文件。
2. 是某一时点的评估、审计、实验报告？→ `prd-to-commit/reports/YYYY-MM-DD-<主题>.md`。
3. 改变了默认流程？→ `decisions/YYYY-MM-DD-<决策>.md`，并更新 `decisions/README.md` 和被取代决策的状态行。
4. 是某个阶段的计划或复盘，并且阶段已经结束？→ `archive/<阶段>/`，按 [归档规则](./archive/README.md) 写纪要。
5. 是规则或会被脚本读的文件？→ 不放这里，放 `common/` 对应位置。

不要在仓库根目录或 `plan/`、`output-*` 一类临时目录堆放报告。同一件事只写一份：进展更新写进台账或报告，不要再新建「完成报告 / 最终报告 / 今日总结」。

## 命名

- 文件名用小写加连字符：`iteration-ledger.md`、`2026-10-11-final-report.md`。
- 时点文档以日期开头（`YYYY-MM-DD-`）；长期维护的文档不带日期。
- 每个目录有 `README.md` 时，它就是该目录的入口。

## 版本管理

| 对象 | 版本来源 | 记录在哪 |
|---|---|---|
| 整个仓库 | git tag：`docs-tdd-v3.5.0`、`docs-YYYY.MM.DD` | [CHANGELOG.md](../CHANGELOG.md) |
| prd-to-commit skill | `~/.ai-rules` 的 tag：`prd-to-commit-vX.Y[.Z]` | [releases.md](./prd-to-commit/releases.md)；回放数据记在 [iteration-ledger.md](./prd-to-commit/iteration-ledger.md) |
| docs_tdd 引擎与规则 | `common/engine/agent-scripts/lib/system-version.mjs`（冻结在 v3.5.0）；规则指纹记录在 `common/rule-release.json` | [common/CHANGELOG.md](../common/CHANGELOG.md) |
| lark-bot | 已迁出为独立仓库 `~/github/lark-bot`（2026-10-11） | 该仓库的 git log |

根目录 [CHANGELOG.md](../CHANGELOG.md) 是整仓的版本时间线，只记版本和重大变更，并链接到上表各自的细目。
