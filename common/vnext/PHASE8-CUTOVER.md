# docs_tdd v2 Phase 8 正式切换记录

> 状态：**已执行**。owner 于 2026-09-08 明确要求立即正式启用 v2；本文件不再是待审批预案。

## 生效结果

1. 全新项目默认 `workflowVersion: 2`；只有显式 `docs-tdd kickoff ... --legacy` 才创建 v1。
2. v2 的唯一正式出口是：

```bash
node common/engine/agent-scripts/docs-tdd.mjs verify <PROJECT-ID> --input <verify-input.json> [--worktree <path>]
```

3. 该命令实测当前 Git `headSha + dirtyHash`，强制写项目 `latest-result.json` / `runs.jsonl`，默认结果为 `mode=enforced`；failed 或 blocked 返回非零并阻断交付。
4. `docs-tdd status/next/resume/context` 按 README `workflowVersion` 路由；v2 项目运行 v1 的 `gate` 或 `changed` 会被拒绝。
5. 存量 v1 项目不迁移，继续走 G0–G8；v1 Gate 维持 `maintain-only`。
6. `vnext-pilot` 与历史 `mode=shadow` 样本继续保留作回归和质量观测，不再控制正式切流。

## 采用的风险处置

切换时 pilot 尚未满足原预案中的样本数量/观察周期。owner 接受这一切换风险，但没有豁免任何项目验收：未闭环的 v2 项目仍会得到 failed/blocked，不能伪绿。决定详见 [cutover-decision-20260908.md](./cutover-decision-20260908.md)。

## 回退

只有 owner 明确决定回退时，才同时恢复以下三项，禁止只改文档或只改输出字段：

1. kickoff 默认分支改回 v1；
2. Router 标明新需求走 v1；
3. 统一 CLI 不再把 v2 `latest-result` 作为正式出口。

回退不得篡改已有 `runs.jsonl`，并须在 `common/CHANGELOG.md` 记录原因和影响范围。
