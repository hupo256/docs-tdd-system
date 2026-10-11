# Phase 1–5 优化实验（2026-09-21 ~ 2026-09-24）

> 状态：已归档（只读） · 结论有效性：效率/准确率指标已撤回；安全修复与版本入口部分有效 · 前序：[v3.5 Requirement-to-Commit](../2026-09-17-v3.5-requirement-to-commit/) · 后继：[v4 Lite 实验](../2026-09-23-v4-lite-experiment/)、[09-24 优化落地计划](../2026-09-24-optimization-pilot/optimization-execution-plan-2026-09-24.md)

## 一句话

一天内写出 8 个实验模块，并按 v3.5.0 发布，宣称准确率 +30%、Token −60%。当天审查发现快速通道绕过了正式流程、会自动提交、还有命令注入，随后回滚为只读候选。所有指标都没有实测依据，事后已撤回。

## 背景与目标

- 起点：v3.5 Requirement-to-Commit（09-19 实施）流程完整，但小需求耗时长，并且 PR-02306（图片里的密码规则）、PR-01930（集合第三入口）、PR-02265（amount/fee 语义）仍然出现漏项。
- 用户的判断：审查只是补救，应该提高第一次抽取的准确率。见 [optimization-plan-2026-09-21.md](./optimization-plan-2026-09-21.md) §10.1。
- 计划目标：先做 Phase 1（第一次理解准确），达标（准确率 > 90%）后再做 Phase 2–5 的流程简化。实际执行没有等 Phase 1 验证，当天就把 1–5 全部写完了。

## 做了什么

处置以引擎当前代码、[system-version.mjs](../../../common/engine/agent-scripts/lib/system-version.mjs) 和 [common/CHANGELOG.md](../../../common/CHANGELOG.md) 为准。

| Phase | 模块（`common/engine/agent-scripts/lib/`） | 意图 | 最终处置 |
| --- | --- | --- | --- |
| 1 | `extraction-guidance.mjs` | 四遍精读、强制枚举、图片深度解读、领域检查清单 | 仍注入 `vnext-extract.mjs` 脚手架的 `extractionGuidance`；09-24（6e26d1d）重写为约 140 行的「需求抽取契约」，原四遍精读版已不存在 |
| 2 | `lite-path-router/-executor/-integration.mjs` | 低风险需求跳过三阶段抽取和独立审查，直接改代码并提交 | 09-21（0e0c4a8）从 `extract` 中移除，降为只读候选评估：不写文件、不验证、不提交、无交付权限；入口命令不再引用 |
| 3 | `smart-approval.mjs`、`smart-review.mjs` | 减少 V2 人工 scope approval，审查失败时由 AI 自动修正 | 从未接入流程，仅登记自测，标记为 experimental |
| 4 | `progressive-verify.mjs` | 三级渐进验证（编辑后 / checkpoint / 完整） | 降为 preflight-only：不写 `verify-result`，命令改用 argv + `shell:false`，正式出口仍为 `vnext-verify` |
| 5 | `smart-rules.mjs` | 按验证级别和信号裁剪注入的规则 | 从未接入流程，仅登记自测，标记为 experimental |
| — | `system-version.mjs` | 版本号与历史 | 保留，`docs-tdd --version/--info/--history` 已接入 |
| — | `run-trace.mjs` 等 3 个脚本（09-24） | 为 Phase 1 的真实验证记录耗时和 token | 09-24 当天在 6e26d1d 中删除；生成的 trace 只有「读 PRD」一步，抽取一步停在 `pending` |

回滚过程（详见 [v3.5.0-review-and-fix-plan.md](./v3.5.0-review-and-fix-plan.md) 的执行记录）：

- A：恢复安全默认值（0e0c4a8，09-21）。
- B：修复验证与版本入口（09-21）。
- C：补齐自测登记（09-23）。
- D：重新发布规则事实，`guard --strict` 通过，标记 v3.5.0 / stable（4036064，09-23）。pilot 仍为 collecting，没有 production attestation。

## 当时的结论与事后核实

| 当时宣称（[release-notes-v3.5.0.md](./release-notes-v3.5.0.md)、根 [CHANGELOG.md](../../../CHANGELOG.md)） | 核实 |
| --- | --- |
| 第一次抽取准确率 +30%（60–70% → 90–95%） | 未经实测。基线带问号（计划 §5.1 原文为「~60-70%？」），目标值被直接写成「效果」 |
| 遗漏率 −80% | 未经实测，同上 |
| Phase 1「手工验证 3/3 通过」 | 无效证据：由已知答案的人手工模拟 AI 抽取，而指南本身就写入了这 3 个案例。09-24 准备的 12 个检查点从未跑过真实抽取 |
| 小需求耗时 −85%；PR-02233「2 分钟 vs 30 分钟，效率提升 93%」 | 已撤回。30 分钟是按步骤估出来的基线，计划 §1.3 写明历史无完整记录。审查确认当时 executor 的 `implement()` 是 TODO，返回模拟数据（1f812a3），那次一行改动不可能由快速通道产出 |
| 执行 Token −80%、规则 Token −60%、人工介入 −70%、反馈 < 10 秒 | 未经实测。Phase 3/5 从未接入，Phase 4 已降为预检 |
| 「27/27 单元测试通过」「100% 测试覆盖率」 | 已撤回。审查指出 progressive-verify 自测是假绿（没有断言 `passed`），9 个模块也没有登记进强制自测 |
| 快速通道「生产就绪，实战验证成功」 | 已撤回。见审查报告 P0-1 至 P0-4 |

撤回依据：

- [v3.5.0-review-and-fix-plan.md](./v3.5.0-review-and-fix-plan.md) Phase B：删除不可复算的效率指标和「生产验证成功」声明。
- [common/CHANGELOG.md](../../../common/CHANGELOG.md) 2026-09-23 / 2026-09-24 条目：删除未经可比样本验证的效率与准确率结论。
- [2026-10-09 现状审计](/Users/aven/.ai-rules/labs/prd-to-commit/reports/2026-10-09-status-audit.md) §1：这些数字没有实测数据。

## 沉淀下来、仍然有效的东西

- **安全原则**（审查报告「实施原则」）：
  - 实验模块不得拥有交付权限。
  - 「快速」不能成为旁路 extraction / review / scope approval / safe work context / 唯一 verify 出口的理由。
  - 不补写不存在的 pilot 记录或效率指标。
- **工程修正**：
  - 外部文本进入命令一律用 argv + `shell:false`。
  - 资金和权限关键词一票否决。
  - 无法确定影响文件数时 fail-closed。
  - 非 TTY 不等待交互。
- **抽取契约中仍保留的条目**：集合语义要列出成员和 `expectedCount`；「自然展示 / 自动生成」只算核查线索，不算排除证据；不可读的来源直接阻断。
- **版本入口**：`docs-tdd --version/--info/--history`。
- **worktree 位置纠偏**（PR-02440 曾建在 `.claude/worktrees/` 下，后改到主仓同级目录）：已由 [coding-worktree.md](../../../common/rules/coding-worktree.md) §2 覆盖。

## 教训

1. 把目标值写成「效果」：计划表里的「目标」列，经过报告转写和发布说明，变成了「效果 / 理论指标」。指标要能复算才能写进发布物。
2. 用已知答案去手工模拟验证，结论没有意义。验证必须是冷读，用真实模型跑真实输入。
3. 先接入、后实现：executor 还是 TODO 就接进 `extract`，而且会自动 `git commit`。功能要么完整实现，要么标成 WIP 并且不给写权限。
4. 发布前没有跑自己的发布门禁：`guard --strict` 当时是 BLOCK，却照样标了 v3.5.0。
5. 一天之内产出 13 份「完成报告」，彼此对集成状态的说法互相矛盾（见下方文件清单）。报告的数量不能替代证据。

## 文件清单

| 文件 | 类型 | 内容 |
| --- | --- | --- |
| [optimization-plan-2026-09-21.md](./optimization-plan-2026-09-21.md) | 原始计划（一手） | 触发本阶段的复盘与优化计划：差距表、漏项根因、Phase 1 优先的策略和量化目标 |
| [v3.5.0-review-and-fix-plan.md](./v3.5.0-review-and-fix-plan.md) | 审查与回滚记录（一手） | P0–P2 问题清单（快速通道劫持、自动提交、命令注入等），以及 Phase A–D 的回滚执行记录 |
| [release-notes-v3.5.0.md](./release-notes-v3.5.0.md) | 被撤回声明的原样本 | 当时对外的 v3.5.0 发布说明，保留原文作为「宣称了什么」的证据，内容不可信 |

### 已合并删除的原文件

| 原路径 | 内容摘要 |
| --- | --- |
| `plan/phase2-5-implementation-plan.md` | Phase 2–5 设计细节（白名单、三级验证、规则分层）；目标数字与原始计划相同 |
| `plan/phase1-implementation-report.md` | Phase 1 模块与 vnext-extract 注入说明；PR-02233（加背景色）被检测出全部 5 个领域信号 |
| `plan/phase1-comparison-and-next-steps.md` | 新旧抽取指令对比、理解摘要示例、待验证计划 |
| `plan/phase1-execution-guide.md` | 09-24 真实验证操作指南（12 个检查点），从未执行完 |
| `plan/task-completion-2026-09-24.md` | run-trace 与验证脚本的完成报告；这些脚本当天即被删除 |
| `output-tdd/phase1-validation-analysis.md` | 3 个漏项案例与新指南的逐条对应分析（理论推演） |
| `output-tdd/phase1-validation-summary.md` | 上述分析的摘要，自评「理论验证通过」 |
| `output-tdd/phase1-manual-validation.md` | 手工模拟抽取，得出「3/3 通过」 |
| `output-tdd/phase2-completion-report.md` | lite-path 三个模块的完成报告 |
| `output-tdd/phase2-integration-complete.md` | lite-path 接入 `docs-tdd extract` 的说明 |
| `output-tdd/phase2-final-integration.md` | 同上，修订版 |
| `output-tdd/phase3-completion-report.md` | smart-approval / smart-review 完成报告 |
| `output-tdd/phase4-completion-report.md` | progressive-verify 完成报告 |
| `output-tdd/phase5-completion-report.md` | smart-rules 完成报告 |
| `output-tdd/final-implementation-report.md` | Phase 1–5 汇总报告 |
| `output-tdd/final-complete-report.md` | 同上，加入 PR-02233「93%」的流程对比 |
| `output-tdd/daily-summary-2026-09-21.md` | 当日总结，称 extraction-guidance「待集成」 |
| `output-tdd/final-summary-2026-09-21.md` | 当日最终总结，称其「已集成」，版本号写作 v3.5.1 |
| `output-tdd/system-improvement-suggestions.md` | 剩余 Phase 的集成优先级建议 |
| `output-tdd/v3.5.0-integration-status.md` | 集成状态报告，09-21 已自注为被审查报告取代 |
| `output-tdd/worktree-creation-rules.md` | `prepare-coding-worktree.mjs` 用法转述，已被 `common/rules/coding-worktree.md` 取代。其中「base 必须是祖先」的校验已于 09-22（1bfff62）放宽为「有共同历史」，默认端口和 docs_tdd 软链路径也与现行脚本不符 |

取回方式：`git show 2f39fdd:<原路径>`
