<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Frontend Tasks — <PROJECT-ID> <TITLE>

## 任务清单

| ID | 功能 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|----------|------|------|----------|
| T01 | F01 | PRD 正文 + `PRD-IMG-001` / `PRD-TABLE-001` | G0 完成 PRD intake 并填充功能清单 | 待办 | `agent/prd-source-manifest.json` + `00-feature-inventory.md` |
| T02 | F01 | F01 对应 sourceId | G2 确认 scope 后进入编码 worktree | 待办 | G2 gate |
| T03 | F01 | API 契约 | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 待办 | G3 gate + `03-api-contract.md` §6.1 |

## 实现检查

- [ ] 状态/文案/class/action 映射已收敛到 map/resolver。
- [ ] 可由 `tailwind-preset.js` 表达的尺寸/圆角/间距未写成 arbitrary class。
- [ ] API DTO 未直接进入组件展示层；字段经 schema/mapper 对账。
- [ ] loading / empty / error / disabled / 未登录 / 无权限完整。
