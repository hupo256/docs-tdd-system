# 文档索引

本目录放**给人读的文档**。prd-to-commit 的使用说明、版本记录、迭代台账、评估报告、回放基准和新需求流程决策已于 2026-10-11 迁到 [~/.ai-rules/labs/prd-to-commit/](/Users/aven/.ai-rules/labs/prd-to-commit/README.md)，不再放本仓。会被脚本读写的文件（规则、引擎、模板、项目实例）不放这里，它们留在 `common/`、`templates/`、`prds/`，路径不变。

## 分类

| 目录 | 放什么 | 现有文档 |
|---|---|---|
| [decisions/](./decisions/README.md) | docs_tdd 自身的历史决策（新需求流程决策已迁出） | [索引](./decisions/README.md) |
| [legacy/](./legacy/) | 已冻结、但存量项目仍在用的系统手册 | [docs_tdd v3.5 引擎手册](./legacy/docs-tdd-v3.5-manual.md) |
| [archive/](./archive/README.md) | 历史阶段的计划、设计、实验与纪要，只读 | [时间线](./archive/README.md) |

不在本目录、但同属文档的：

- [~/.ai-rules/labs/prd-to-commit/](/Users/aven/.ai-rules/labs/prd-to-commit/README.md)：prd-to-commit 回放基准、发版台账、报告与流程决策（仓库外）。
- [common/README.md](../common/README.md)：规则库专题全索引；[common/rules/rule-router.md](../common/rules/rule-router.md) 是存量项目开工的常驻入口。
- lark-bot 运维手册：已随 lark-bot 迁到独立仓库 `~/github/lark-bot/docs/`。

## 新文档放哪

按这个顺序判断：

1. 是 prd-to-commit 的使用方法、版本说明、评估报告或新需求流程决策？→ 不放本仓，放 `~/.ai-rules/labs/prd-to-commit/` 对应位置。
2. 是 docs_tdd 自身的历史决策？→ `decisions/YYYY-MM-DD-<决策>.md`，并更新 `decisions/README.md`。（docs_tdd 已冻结，原则上不再新增。）
3. 是某个阶段的计划或复盘，并且阶段已经结束？→ `archive/<阶段>/`，按 [归档规则](./archive/README.md) 写纪要。
4. 是规则或会被脚本读的文件？→ 不放这里，放 `common/` 对应位置。

不要在仓库根目录或 `plan/`、`output-*` 一类临时目录堆放报告。同一件事只写一份：进展更新写进台账或报告，不要再新建「完成报告 / 最终报告 / 今日总结」。

## 命名

- 文件名用小写加连字符：`iteration-ledger.md`、`2026-10-11-final-report.md`。
- 时点文档以日期开头（`YYYY-MM-DD-`）；长期维护的文档不带日期。
- 每个目录有 `README.md` 时，它就是该目录的入口。

## 版本管理

| 对象 | 版本来源 | 记录在哪 |
|---|---|---|
| 整个仓库 | git tag：`docs-tdd-v3.5.0`、`docs-YYYY.MM.DD` | [CHANGELOG.md](../CHANGELOG.md) |
| prd-to-commit skill | `~/.ai-rules` 的 tag：`prd-to-commit-vX.Y[.Z]` | [releases.md](/Users/aven/.ai-rules/labs/prd-to-commit/releases.md)；回放数据记在 [iteration-ledger.md](/Users/aven/.ai-rules/labs/prd-to-commit/iteration-ledger.md)（均在仓库外） |
| docs_tdd 引擎与规则 | `common/engine/agent-scripts/lib/system-version.mjs`（冻结在 v3.5.0）；规则指纹记录在 `common/rule-release.json` | [common/CHANGELOG.md](../common/CHANGELOG.md) |
| lark-bot | 已迁出为独立仓库 `~/github/lark-bot`（2026-10-11） | 该仓库的 git log |

根目录 [CHANGELOG.md](../CHANGELOG.md) 是整仓的版本时间线，只记版本和重大变更，并链接到上表各自的细目。
