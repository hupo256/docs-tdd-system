# 下一步最小清单（承接 aa31b21）

> 日期：2026-09-24
> 决策：不再补历史 PR 附件，不做历史项目逐单元 golden；只修当前系统并用合成契约回归。
> 边界：仅修改 `docs_tdd`，不碰业务仓、不 push；后续已按 owner 授权完成本地提交。

## P0：清掉本轮可控的 doc-budget 阻断

归属已用 `git show`、`git log` 和引用搜索核实：

| 项目 | 真实归属 | 本轮处置 |
|---|---|---|
| `rule-router.md` 超 173 字符 | `aa31b21` 将 4,999 增至 5,173 | 压缩启动段，保留主路径和终态语义 |
| 4 个脚本缺 self-test/豁免 | 旧 v4 context 与 phase1 历史验证旁路 | 不登记伪豁免，直接退役无生产消费者的旁路 |
| 7 篇规则未入索引 | `0b894de` 引入，后续仅被旧 v4 loader 消费；与 L1/L2 当前规则重复 | 删除重复规则及其唯一 loader，不扩大当前 context |
| L2 golden `47 != 49` | `aa31b21` 前已存在 | 留债：L2 规则 owner 核对消费仓规则全集 |
| `PROJECTS.md` 漂移 | 运行时派生输入造成，非本轮引入 | 留债：项目索引生成器 owner 排查 |
| PR-02419 schema 不匹配 | 历史项目事实早于 `aa31b21` | 留债：该需求 owner 决定迁移 |

验收：

- [x] 本轮引入或本轮认领的前三类阻断清零。
- [x] `check-doc-budget.mjs` 只报告上述三类既有债。
- [x] `git diff --check` 通过。

## P1：强化现有 intake 契约

不新增平行四态。继续使用当前协议：

- source unit：由 requirement anchor 覆盖，或标记 `not-a-requirement`。
- requirement surface：`implement` / `already-covered` / `not-applicable` / `deferred`。
- 未决内容通过 audit/review 状态阻断，不伪装成 disposition。

本轮改动：

1. `not-a-requirement` 除 `reason` 外，必须提供 `exclusionEvidence.basis` 和来源中的精确 `sourceQuote`。
2. 引用不存在、证据不完整、同一 source unit 同时出现“自然展示/现有逻辑”和明确新增功能时，确定性 audit 必须失败。
3. 用小型 synthetic fixture 覆盖正例、缺证据反例和“自然展示不能吞明确功能”反例。
4. 压缩每次 extraction 都注入的长篇指南，删除历史项目叙事，只保留输出契约和按需领域清单。

验收：

- [x] intake、source graph、正式 coverage verify 和 review request 共用同一排除证据判定。
- [x] synthetic self-test 可确定性复跑，错误处置 fail-closed。
- [x] 状态为 `synthetic-tested`；未宣称 E2E 或 Pilot 已完成。

验证记录（2026-09-24）：

- `vnext-source-disposition`、`vnext-intake-audit`、`vnext-work-item`、`vnext-source-graph`、`vnext-coverage-review` 定向 self-test 通过。
- `vnext-self-test.mjs --self-test` 通过，共覆盖 63 个 vNext 脚本。
- `check-doc-links.mjs` 通过，339 个 Markdown 本地链接有效。
- `check-doc-budget.mjs` 中本轮预算、索引和 self-test 项全部通过；退出 1 仅由 P0 已列出的三类既有债导致。
- 最终收尾已通过 67 个 vNext 聚合 self-test、101 个核心 self-test、339 个 Markdown 链接和 `git diff --check`。
- 实施结果已分三次本地提交：`aa31b21`、`6e26d1d`、`5a27d3e`；均未 push。

## 后续

机制通过后直接进入新需求：

1. 用首个新需求验证 `run -> extract -> review -> implement -> evidence -> verify -> commit`。
2. 再收集 V0/V1/V2 新需求样本和至少 10 个 micro 样本。
3. 以漏项、返工、耗时、命令数、人工中断和真实 usage 决定是否切换默认路径。

历史项目不再作为发布前置；只有发现新的抽象失败模式时，才补最小 synthetic regression。
