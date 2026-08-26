# PR-01947 Context Summary

> Project state only. Updated: 2026-08-26 (production release archival).

## Current State

| 字段 | 值 |
|------|-----|
| 项目 | PR-01947 |
| 当前阶段 | 已关闭；G8（legacy-unverified） |
| PRD 来源 | inbox/lark-sync/prd-latest.md（Lark docx Qj5OdXCCroWHopxcfcmlGklMgff，V_2.0.0 / 2026-07-07，revision 3703） |
| Figma | 待补 |
| G2 确认 | 用户（口头确认 scope）/ 2026-07-08 |
| 责任模块目录 | apps/web/src/apps/CopyTrading, apps/web/src/services/api/copyTrading, apps/web/src/mocks, apps/futures-admin/legacy-admin/src/viewsTemplate/copyTrading（后台 F19-F21 Vue2，展示层已落码 4002bc85，G5 对账阶段） |

## Scope / Fingerprints

| 做 | 不做 | 延期 | Blocker | PRD | Rules | Contract |
|----|------|------|---------|-----|-------|----------|
| 21 | 0 | 0 | 1 | `not-enabled` | `4ebca4f034e5` | `a47154f1` |

## Historical Gate Record

- 2026-08-01 的 G5 BLOCK 及其未完成对账项保留在 `agent/stage-status.json` 和 `agent/gate-results.json`；未补造 G5→G8 的 PASS 历史。
- 2026-08-26 已确认交付提交 `29f304b3b9` 进入 `origin/online`，项目转为生产发布归档；证据见 `evidence/release/2026-08-26/README.md`。

## Latest Gate Results

| Gate | 状态 | 时间 | 证据 |
|------|------|------|------|
| G5 | BLOCK（历史） | 2026-08-01T09:18:39.507Z | fail=3, warn=5；未补造后续 PASS |

## Future Action

- 无活动开发任务。后续生产问题或文档补证据以新变更处理，并在 `product/06-collaboration.md` 追加历史记录。
