# v4.0 效率快速通道与 v4.1 Lite 模式实验（2026-09-23 ~ 2026-09-24）

> 状态：已归档（只读） · 结论有效性：效率/准确率数字已撤回；定性发现部分有效 · 后继：[优化计划与真实需求 Pilot](../2026-09-24-optimization-pilot/)

## 一句话

v3.5 stable 发布当天，为解决「小改动耗时长、Token 多」先后做了 v4.0 代码快速通道（lite-path 执行器、规则档位裁剪、precommit 分档）和 v4.1 人工提炼的 Lite 模式，靠 1~3 个自估样本宣称大幅提速；次日（09-24）入口被收敛、Lite executor 被禁用、未经可比样本验证的数字被删除。

## 背景与目标

- 前序：[v3.5 Requirement-to-Commit](../2026-09-17-v3.5-requirement-to-commit/)，09-23 发布 v3.5.0 stable（见 [CHANGELOG](../../../common/CHANGELOG.md) 2026-09-23 条目）。
- 用户复盘的三个痛点：小改动消耗大量时间与 Token（点名 PR-01947/02265/02306/01930）；提测时漏明显功能；Claude/Codex 因全量加载规则变慢。v4.0 交付总结自己的根因分析是：这 4 个项目都是 v1 项目，v3.5 的 lite-path/efficiency-policy 只对 v2 生效。
- 策略：「先建轻通道（效率止血），再加强守卫（准确性保底）」。第 2 周的 extraction checklist / expectPath 必填 / pre-delivery self-check 未在本阶段实施。

## 做了什么

### v4.0（09-23，提交 3ca7d37、985f7cd、f6495a1、c8b66f9）

- 新增 `lib/kickoff-v4.mjs`（默认 v2，调用 lite-path-router 判定）、`lib/lite-path-executor-v4.mjs`（跳过 extraction / coverage review / scope approval，直接写最小 work-item.json + README）、`lib/rule-loader-v4.mjs`（按 micro/lite/standard/high-risk 选 3/5/8/12 个规则文件）、`lib/vnext-context-v4.mjs`；`precommit-verify-code-rules.mjs` 读取 `efficiencyRoute`，micro/lite 跳过完整 checkpoint 守卫只跑 code-rules；`docs-tdd.mjs` 的 kickoff 分支改走 kickoff-v4。
- 当日又把档位规则补全（f6495a1 标题为 standard 8→10，v4 完整总结写 standard 8→11、high-risk 12→17）。
- 样本：
  - `TEST-V4-LITE-001`：合成需求「Home.tsx 按钮文案改为立即开始」，`--force-lite`，kickoff 脚本 15ms 产出 2 个文件。未写业务代码。
  - `PR-02233-BTN-LOADING`（真实）：「修改手机号页面提交按钮加 loading 且 loading 时不可操作」，`--force-lite`。fameex-web 提交 `b49a69eafc`（09-23，`ModifyPhone.tsx` + `AccountContactLayout.tsx`，+22/−5）。记录耗时「< 1 分钟，不含人工查找文件 30 秒」。

### v4.1（09-23 ~ 09-24，提交 35e0146、1367991、ece3952、73c0c84、652f715、983a582、ec07a97、7245b38、3349b0d）

- 思路改为「人工提炼 4~6 个要点 + 手填 lite work-item 模板」，不改 schema、不改命令；产出 `common/templates/lite-work-item-template.json`、`lite-experiment-template.md`、`common/docs/lite-mode-guide.md`、`new-project-kickoff.md` §5，计划见 [v4.1-simplified-implementation-plan.md](./v4.1-simplified-implementation-plan.md)。模板预置了 `coverageAudit.verdict: approved` 和 `scopeApproval`。
- 三个实验（数字均为执行者自报或预估，无计时/计费日志）：

| 实验 | 需求 | 结果 | 自报时间 | 自报 Token | 自报准确率 | 基线 |
|---|---|---|---|---|---|---|
| 1 PR-02233-BTN-LOADING | 修改登录密码页「确定」按钮 loading + 禁用 | 判定「功能已实现」，未改代码 | 10 分钟 | ~7K | 100% | Full extraction 20~25 分钟 / 25~30K，纯估算 |
| 2 PR-02208 | 合约后台新增「API 动态费率配置」页面 | 调研 15 分钟后阻塞（定位不到页面、API 硬阻塞未标记） | 23 分钟 | ~7K | 65% | 估算 35~45 分钟 / ~23K |
| 2b PR-02208 Full 对比 | 同上，lark-cli 拉全 PRD（424 行）后人工分析 | 仍阻塞，但页面位置与 API 阻塞在 intake 即可识别 | 45~50 分钟 | — | 90~95%（自估） | — |
| 3 PR-02233 跳转逻辑 | 修改邮箱/手机号成功跳 `/profile`，改密码成功跳 `/login` | fameex-web 提交 `0ccb79708f`（09-24，3 文件 +9/−13）；浏览器验证未做 | ~28 分钟 | ~7K | 预估 | 估算 40~55 分钟，节省比例文内两处写法不一（31~49% / 30~35%） |

实验 1 的汇总见 [v4.1-lite-experiment-results.md](./v4.1-lite-experiment-results.md)；实验 3 原始记录仍在 [prds/PR-02233/lite-experiment-3-jump-logic.md](../../../prds/PR-02233/lite-experiment-3-jump-logic.md)。

## 当时的结论与事后核实

| 宣称 | 样本量 | 是否可比 | 事后核实 / 处置 |
|---|---|---|---|
| v4.0 kickoff「~8 分钟 → 15ms，32,000x」 | 1（合成） | 否：15ms 是脚本写 2 个文件的耗时，8 分钟是含 AI extraction/coverage/approval 的全流程估值 | 已撤回 |
| v4.0「小改动 < 1 分钟，比 v3.5 提速 9x」 | 1（PR-02233 手机号 loading） | 否：v3.5 侧 9 分钟为分项拍估，未实跑 | 已撤回；代码提交 b49a69eafc 本身真实存在 |
| v4.0「可投入生产、建议推广到团队」 | 同上 | — | 次日入口收敛，未推广 |
| v4.1 H1/H2/H3：时间省 50~85%、准确率 100%、Token 省 76% | 1（实验 1） | 否：基线全部为估算；准确率无判定口径 | 已撤回 |
| 实验 1「功能已实现」 | 1 | — | 日志核对的是 `apps/admin` 与 `apps/futures-admin` 的 ChangePassword；PR-02233 是 Web 需求，`apps/web/src/apps/UpdatePassword/index.tsx` 在 b49a69eafc 时提交按钮只有 `isDisabled`、未见 loading。该结论很可能核对错工程；日志自注的浏览器实测未执行 |
| 「Lite 适合改现有功能，不适合新增页面」 | 2~3 | 部分：同一执行者、不同需求 | 作为定性观察保留，不作为数字结论 |

- 09-24 [CHANGELOG](../../../common/CHANGELOG.md)「优化计划 A/B 首批止损」：公开 `kickoff` 委托 v2 orchestrator；旧 v4 入口仅转发并拒绝 `--force-lite`；旧 Lite executor 改为无写入禁用态；模板撤销预置的 approved/scope approval；Lite 指南改为历史归档指针，删除未经可比样本验证的效率与准确率结论。对应代码提交 aa31b21（禁用 executor、kickoff-v4 转发）、6e26d1d（删除 rule-loader-v4 / vnext-context-v4）。
- 同日 ebb7c59 清理实验项目目录 `PR-02233-BTN-LOADING`、`TEST-V4-LITE-001`、`PR-02208`（PR-02208 于 09-26 ca4558c 重新作为真实项目建档）；09-26 3b2e09c 删除 `plan/v4-action-plan.md`、`plan/v4-complete-summary.md`。
- 09-28 [切换 Web Lite 决策](../../decisions/2026-09-28-switch-to-web-lite.md)明确：「目前没有可核实的 10 分钟 / 7K token / 100% 覆盖实验数据，不把它作为目标基线」。
- 量级参照：10-10 用 prd-to-commit 真实实跑 PR-02208，计量 9.38M token、26 分钟（[实跑结果](../../../benchmarks/replay/results/2026-10-10-PR-02208-live-run.md)）。范围不同、不可直接比较，但说明本阶段「~7K token」类数字是自估而非计量。
- 未撤回的残留：`precommit-verify-code-rules.mjs` 中按 `efficiencyRoute` 分档的逻辑在整理基线 2f39fdd 仍存在（随 v2 引擎一起冻结）。

## 沉淀下来、仍然有效的东西

- **规则按需加载**：rule-loader-v4 的「按档位裁剪」实现已删除，但「不全量加载规则」的方向被 rule-router 渐进披露、Web Lite「只加载确实命中的编码专题」、prd-to-commit 及全局规则的 On-Demand Rule Loading 继承。
- **小需求不建台账**：Lite 的「最小产物」想法以更安全的形式进入 [Web Lite](../../../common/rules/web-lite-workflow.md)（Task 默认留在对话、不建项目骨架/状态 JSON）和 prd-to-commit；但「人工摘要绕过来源对账、预置 approved、跳过正式 verify」明确未被继承（见 [v4x 迭代计划](../2026-09-24-optimization-pilot/v4x-iteration-plan-2026-09-25.md)）。
- **PR-02208 的教训**：新增页面类需求必须先拿到页面位置与 API 阻塞信息；「完整读 PRD 的价值在于阻塞点前置」。对应 Web Lite「PRD 单次完整读取 + 提取核对」与 prd-to-commit「需求清单（原句→落点）+ 冷读逐条找落点」。
- 兼容入口：[lite-mode-guide.md](../../../common/docs/lite-mode-guide.md)（归档指针）、[lite-work-item-template.json](../../../common/templates/lite-work-item-template.json)（仅供历史审阅）。

## 教训

1. 效率宣称必须有同口径基线：拿脚本毫秒数比全流程分钟数、拿拍估基线算百分比，结论不可用。
2. 「准确率」要先定义判定口径和样本，再报数字；单样本 100% 不能支撑推广。
3. 快速通道不能靠跳过来源对账与审批换速度；预置 approved 的模板等于伪造门禁通过，是 09-24 首先止损的点。
4. 「已实现」类结论要在需求所属工程内核对并做浏览器确认，否则容易在同名组件的其他 app 里得出假结论。
5. 一天内连续产出 README / 集成指南 / 交付总结 / 验收报告四份高度重叠的文档，且自报行数与实际不符（见下），文档量不等于交付质量。
6. 同一项目号承载不同需求（PR-02233-BTN-LOADING 先后指「手机号 loading」与「登录密码 loading」）会让样本无法追溯。

## 文件清单

| 文件 | 类型 | 内容 |
|---|---|---|
| [README.md](./README.md) | 阶段纪要 | 本文件 |
| [v4.1-lite-experiment-results.md](./v4.1-lite-experiment-results.md) | 实验数据（原 `plan/v4-lite-experiment-results.md`） | 实验 1 的时间/Token/准确率自报数据与 H1~H3 判定；数字已撤回，保留作反面样本 |
| [v4.1-simplified-implementation-plan.md](./v4.1-simplified-implementation-plan.md) | 决策记录（原 `plan/v4.1-simplified-implementation-plan.md`） | 基于实验 1 推进 v4.1 简化版的决策、lite 模板原文（含预置 approved）、成功指标；被 v4x 迭代计划引用为历史决策依据 |

### 已合并删除的原文件

| 原路径 | 内容摘要 |
|---|---|
| `practice-log/V4.0-README.md` | v4.0 目标、四个动作、档位规则数量、预期指标表（实测列未填）、验收用例、回滚步骤 |
| `practice-log/V4.0-INTEGRATION.md` | docs-tdd.mjs kickoff 分支改法、rule-loader 接入方案 A/B、precommit 分档测试步骤、FAQ |
| `practice-log/V4.0-DELIVERY-SUMMARY.md` | 痛点与「v1 项目未享受 v3.5 优化」根因、交付文件清单、「70-75% AutoPilot」预期、不换现成轮子的判断 |
| `practice-log/V4.0-ACCEPTANCE.md` | TEST-V4-LITE-001 端到端 15ms、自测 3/3 + 5/5 + 12/12、PR-02233 手机号 loading 真实需求（b49a69eafc）、「可投入生产」结论 |

取回方式：`git show 2f39fdd:<原路径>`

本次整理前已删除的相关一手记录：`git show 35e0146:prds/PR-02233-BTN-LOADING/lite-experiment-log.md`（实验 1）、`git show 73c0c84:prds/PR-02208/lite-experiment-log.md`（实验 2）、`git show 983a582:prds/PR-02208/full-extraction-analysis.md` 与 `git show ec07a97:prds/PR-02208/full-extraction-implementation-log.md`（Full 对比）、`git show 769c550:plan/v4-complete-summary.md`（阶段自评总结）。

自报与实际不符示例：验收报告称四份文档各 800/700/600/400 行、交付总结称文档约 2000 行，实际为 240/322/260/308（验收报告追加后 379）行；kickoff-v4 自报 260/280 行，3ca7d37 实际 212 行。验收报告同时写「vnext-context-v4 已集成」与「rule-loader-v4 未接入 Agent context」。
