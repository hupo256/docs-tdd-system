# vNext 切换评审包 2026-09-06：分级切换（graduated cutover）

> 决策人：aven（2026-09-06，会话内明确「现在将系统切到 v2，成为默认运行系统，v1 慢慢退役」+「分级切换」）。
> 决策结果：**新需求默认 v2；V0/V1 判定立即生效；V2 级需求保持 shadow 判定（结果不阻断交付）直到 PR-02233 闭环后自动转正**。v1 不删除、不回溯存量项目，进入冻结。

## 1. 评审输入复核（可复算）

| 输入 | 结论 | 复核命令 |
|---|---|---|
| 基线指标 | 默认产物 253→12（−95.26%），context 字符代理 −99.21% | `vnext-artifact-budget.mjs` / `vnext-context-budget.mjs` |
| 回放结论 | 三事故（PR-02306/01930/02265）稳定 FAIL→修复 PASS；旧 HEAD/伪造/篡改反例全 FAIL；路由回放符合冻结结论 | `vnext-replay.mjs` / `vnext-exit-replay.mjs` / `vnext-route-replay.mjs` |
| 灰度报告 | V0(PR-02074)、V1(PR-02172) complete，0 漏项 0 假绿；V2(PR-02233) failed（仅欠浏览器运行时证据）+ observation pending | `vnext-pilot.mjs` → `collecting`（见 §2) |
| 自检 | 18 vNext 脚本 + 主检查链全绿 | `vnext-self-test.mjs` / `check-doc-budget.mjs` |
| 残余风险 | PR-02233 浏览器证据采集中断点已记录；批次 02–06 未启动；批次 06 需 App owner | `HANDOFF-phase7-pr02233.md` |

## 2. Deviation： pilot `eligible-for-human-cutover-review` 未达成

`pilot-report.json` 保持 `collecting`（缺 completed V2 sample),**不改判定、不调 minimumSamples凑绿**。owner 知悉并接受：在 V2 无端到端证据的情况下提前切换，补偿控制是「V2 级结果在 PR-02233 闭环前只做参考、不阻断」，以及回滚路径持续有效（PHASE8 §6)。
PR-02233 提测后按 HANDOFF Step 1–4 翻绿 + 回填 observation → `vnext-pilot --write` 翻 eligible → V2 自动转正 + 可进入正式 Gate/CI 接入评审（决策点 4,本次未批准）。

## 3. 决策点逐项结论

| PHASE8 §5 决策点 | 结论 |
|---|---|
| 1. rule-router 接入：新需求默认走 vNext | **批准**(V2 级 shadow,见 §2) |
| 2. startup-prompt 接入：默认 vNext 三文件产物 | **批准**（保留 v1 legacy 路径） |
| 3. new-project-kickoff 接入：kickoff 不再默认生成 v1 全套文档 | **批准**（提供 v1 兼容开关） |
| 4. 正式 Gate/CI 接入 | **不批准，推迟**：待 V2 样本 eligible 后另行评审 |
| 5. v1 冻结归档 | **部分批准**:v1 Gate/Rule ID 标记 maintain-only 冻结新增；归档（移 archive/)等 V2 转正后执行 |

## 4. 回滚

任何新需求出现漏项/假绿，或 vnext 自检/检查链失败：48h 内按 PHASE8 §6 revert 本批接入 commit, v1 恢复默认。本评审包与 deviation 是回滚的判定基线。
