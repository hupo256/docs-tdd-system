# docs_tdd v2 正式切换决策（2026-09-08）

## 决策

owner 明确批准立即正式启用 v2，不等待历史 Phase 7 pilot 达到原建议样本数或所有样本项目闭环。

- 新需求默认 v2。
- v2 的 V0/V1/V2 结果全部正式生效；`failed` / `blocked` 阻断交付。
- `docs-tdd verify` 是 v2 唯一正式出口，落盘结果必须为 `mode=enforced`。
- 存量项目继续 v1；不批量迁移，不删除历史 Gate。
- v1 保持 `maintain-only`；只修严重缺陷，不扩展新 Gate/模板层。
- 历史 pilot 不具备自动切流权；`automaticCutover` 保持 false。

## 接受的偏差

原 Phase 8 预案要求更多 completed 样本和观察周期。owner 本次选择人工提前切换，接受“样本尚不足”的系统级风险。该偏差只改变系统采用决策，不改变项目质量判定：任何新 v2 项目缺证据、存在 blocker、来源漂移或 coverage 未完成时仍必须失败，不能用切换决策豁免。

## 机器落点

- 默认入口：`project-orchestrator.mjs kickoff` → `workflowVersion: 2`。
- 版本路由：`docs-tdd.mjs` / `project-orchestrator.mjs`。
- 正式出口：`vnext-verify.mjs` 默认 `mode=enforced`，统一 CLI 强制 `--write`。
- v1 隔离：v2 项目拒绝 `docs-tdd gate` / `docs-tdd changed`；v1 项目拒绝 `docs-tdd verify`。
- SSOT：`work-item.json`、`latest-result.json`、`runs.jsonl`。
