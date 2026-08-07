<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# PR-02265 Context Summary

> AI 恢复项目时优先读本文件；只保留当前决策、下一步和 gate 结果，不复制公共规则。细则按 `../../common/rule-router.md` 命中后再读。
> 可用 `node apps/web/docs_tdd/common/agent-scripts/update-context-summary.mjs PR-02265 --stage G6 --write` 从项目文档刷新本文件。
> **新鲜度自检**：恢复时先比对下方 `刷新于` 阶段与 `agent/gate-results.json` 最新 gate——若本文件停在早于实际进度的阶段（如这里写 G2、gate 已到 G6），说明摘要过期，先跑上面的 `update-context-summary.mjs --write` 再据此决策，勿信旧快照。

<!-- 刷新于: G0 / 未运行（由 update-context-summary.mjs --write 覆盖为真实阶段+时间戳） -->

## Current State

| 字段 | 值 |
|------|-----|
| 项目 | PR-02265 |
| 当前阶段 | G0 资料接收 |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/docx/P2xud4WYyoapp6xfjskl7UI3gKc |
| Figma | 待补 |
| API / YApi | 待补 |
| QA | 待补 |
| 责任模块目录 | 待 G2 确认 |

## Scope Snapshot

| 类型 | 数量 | 说明 |
|------|------|------|
| 本期做 | 0 | 待 G2 确认 |
| 不做 | 0 | 待 G2 确认 |
| 延期 | 0 | 待 G2 确认 |
| 阻塞 / 待确认 | 0 | 见 `../product/06-collaboration.md` |

## Read Next

1. `../../common/rule-router.md`
2. `../product/00-feature-inventory.md`
3. `../product/06-collaboration.md`
4. 按 `../../common/rule-index.json` 命中场景读取专题。

## Gate Commands

```bash
node apps/web/docs_tdd/common/agent-scripts/verify-project-gate.mjs PR-02265 G2
node apps/web/docs_tdd/common/agent-scripts/verify-code-rules.mjs --project PR-02265
node apps/web/docs_tdd/common/agent-scripts/verify-project-gate.mjs PR-02265 G6
node apps/web/docs_tdd/common/agent-scripts/update-context-summary.mjs PR-02265 --stage G6 --write
```

## Latest Gate Results

| Gate | 状态 | 时间 | 证据 |
|------|------|------|------|
| G2 | 未运行 | | `agent/gate-results.json` |
| codeRules | 未运行 | | `agent/gate-results.json` |
| G6 | 未运行 | | `agent/gate-results.json` |

## Next Action

- [ ] 读取 PRD 并填充 `product/00-feature-inventory.md`。
- [ ] 记录缺失资料到 `product/06-collaboration.md`。
- [ ] G2 前运行 `verify-project-gate.mjs PR-02265 G2`。
