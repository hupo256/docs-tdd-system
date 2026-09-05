# docs_tdd vNext Phase 8 切换评审与接入预案

> 状态：**draft**（仅文档，未接入 Router / kickoff / Gate）。
> `automaticCutover` 永远为 `false`；本文所有步骤均需人工批准后执行。

## 1. Phase 8 目标

Phase 7 双轨灰度满足以下条件后，把 vNext 从 shadow 切换到新需求默认工作流：

- 6 个灰度样本 V0/V1/V2 全部 `completed`（`latest-result` 为 `passed` 且 `post-test observation` 已填）。
- 零漏项（`zeroRequirementOmissionEscapes=true`）。
- 零假绿（`zeroFalseGreenEscapes=true`）。
- v1 与 vNext 在 Router / kickoff / 正式 Gate 三处硬隔离。

不满足条件前，本文只做评审准备，不动任何接入代码。

## 2. 人工切换评审输入清单

评审人应能复算以下所有项：

| 输入 | 来源 | 必须满足 |
|------|------|----------|
| 基线指标 | `common/vnext/baseline.json` | 默认产物 253 → 12 个流程文件，artifact 减量 ≥80%；context 字符代理降幅 ≥60% |
| 回放结论 | `vnext-replay.mjs` / `vnext-exit-replay.mjs` / `vnext-route-replay.mjs` | 三个历史事故（PR-02306、PR-01930、PR-02265）全部 PASS；漏项/旧 HEAD/伪造 PASS/篡改结果等反例全部 FAIL |
| 灰度样本最终报告 | `vnext-pilot.mjs --write` → `common/vnext/pilot-report.json` | `decision === "eligible-for-human-cutover-review"`；V0/V1/V2 各至少 1 个 `completed`；无 `rollback` |
| 自我测试 | `common/engine/agent-scripts/vnext-self-test.mjs` + `check-doc-budget.mjs` | 18 个 vNext 脚本全部通过；主检查链 `exit=0` |
| 残余风险 | `pilot-report.json` / `baseline-observations.json` | 列出仍未闭环的外部依赖（后端 API 契约、App owner 批次等） |
| 显式 rollback 路径 | 本文 §6 | 开关文件、关闭顺序、回退到 v1 的命令已写死，不依赖事后推断 |

## 3. 触发评审的一键检查

```bash
node common/engine/agent-scripts/vnext-pilot.mjs && \
  node common/engine/agent-scripts/vnext-self-test.mjs && \
  node common/engine/agent-scripts/check-doc-budget.mjs
```

当 `pilot-report.json` 输出 `eligible-for-human-cutover-review` 且后两条 exit=0 时，AI 自动把上述清单打包成 `common/vnext/cutover-review-YYYYMMDD.md`，提交并 @ 你评审。

在此之前，任何人不应把 vNext 接入 Router / kickoff / Gate。

## 4. 通过后接入顺序（必须按顺序执行）

### 4.1 接入 rule-router

- 在 `common/rules/rule-router.md` §2 中新增 vNext 入口：
  - `newRequirement: true` 且 `classifiedLevel` ∈ {V0, V1, V2} → 默认走 vNext。
  - 存量项目继续走 v1，不回溯。
- 仅修改 `rule-router.md`，不修改 `verify-project-gate.mjs` 等 v1 脚本。

### 4.2 接入 startup-prompt

- `common/rules/startup-prompt.md` 在「新项目一句话启动」链路中，把 `new-project-kickoff` 默认产物从 v1 全套文档改为 vNext 三文件（`work-item.json`、`latest-result.json`、`runs.jsonl`）。
- 保留 `--legacy` 开关，让用户仍可显式走 v1。

### 4.3 接入 new-project-kickoff

- `common/engine/agent-scripts/new-project-kickoff.mjs`（或同功能脚本）新增 `--vnext` 默认分支：
  - 调用 `vnext-verify.mjs --init` 创建 `work-item.json`。
  - 不生成 `00-feature-inventory.md`、`04-frontend-tasks.md` 等 v1 流程文件，除非 `--legacy`。
- v1 kickoff 保持原路径，作为 `--legacy` 分支。

### 4.4 vNext 成为新需求默认出口

- 新需求默认 `workflowVersion: 2`。
- `vnext-verify.mjs` 在 CI / `lark-bot` 中作为 shadow 的「最终报告」入口；运行 `--write` 追加 `latest-result.json` 和 `runs.jsonl`。
- 只有当 `pilot-report.json` 稳定显示 `eligible-for-human-cutover-review` 至少一周后，才允许把 shadow 结果用于真实 gate 判定。

### 4.5 v1 Gate 冻结

- `common/rules/rule-ids-and-gates.md` 中所有 v1 Gate ID 标记为 `maintain-only`。
- 除严重缺陷外，不再新增 v1 Rule ID、Gate、模板层或流程分支（与 README「不变量 5」一致）。

### 4.6 v1 规则文档归档

- 把 v1 模板/流程文档移入 `common/archive/` 或 `templates/archive/`，在 `rule-router.md` 和 `README.md` 中保留索引但标注 `legacy`。
- 不删除文件，避免历史项目 context 断裂。

## 5. 需人工决策点

每步接入前，评审人必须明确说「可以」：

1. **rule-router 接入**：是否同意新需求默认走 vNext？
2. **startup-prompt 接入**：是否同意 Agent 启动默认使用 vNext 三文件产物？
3. **new-project-kickoff 接入**：是否同意 kickoff 不再生成 v1 文档，除非显式 `--legacy`？
4. **正式 Gate 接入**：是否同意 `vnext-verify` 的结果进入 CI 阻断？
5. **v1 冻结归档**：是否同意 v1 Gate 不再扩展并启动归档？

未批准下一项前，AI 不得提前执行后续步骤。

## 6. Rollback 路径

任何一步接入后，如果新需求出现以下情况，48 小时内回退：

- 漏项/假绿数量 > 0（由 `pilot-report.json` 的 `zeroRequirementOmissionEscapes` / `zeroFalseGreenEscapes` 监控）。
- `vnext-self-test` 或 `check-doc-budget` 失败。
- 业务方报告 vNext 产物缺失必要信息。

Rollback 操作：

```bash
# 1. 关闭 vNext 默认入口
git revert <rule-router 接入 commit>

# 2. 恢复 v1 kickoff 默认
git revert <startup-prompt / kickoff 接入 commit>

# 3. 重启 v1 Gate 对 vNext 项目失效期间的补充审查
node common/engine/agent-scripts/verify-project-gate.mjs --project <PR-xxxx>

# 4. 在 CHANGELOG.md 顶部记录 rollback 原因与影响范围
```

rollback 期间，v1 继续服务所有需求，vNext 退回 shadow。

## 7. 当前残余风险（截至 Phase 7）

- PR-02233：App/跨批次 surface 证据未全，批次 06 需 App owner 介入。
- PR-02117 / PR-02133 / PR-02193：后端 API 契约文档未到位，处于 `pending-dependency`。
- PR-02074 / PR-02172：已 `passed`，等待 `post-test observation` 人工回填。

这些风险不阻碍 Phase 0–6 代码收尾，但必须全部清理后才能进入 Phase 8 评审。
