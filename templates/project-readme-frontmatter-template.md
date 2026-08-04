---
templateVersion: 1
templateEffectiveSince: 2026-07-23
projectId: <PROJECT-ID>
status: active
stage: G0
branch: feature/<PROJECT-ID>
worktree: ""
port: ""
visualFidelity: standard
prdSource: <PRD-SOURCE>
figmaNode: ""
larkEnabled: false
---

# <PROJECT-ID> <TITLE>

> 本文件顶部 YAML frontmatter 是机器可读的元数据真值源，修改后请运行 `node apps/web/docs_tdd/common/agent-scripts/update-project-index.mjs --write` 刷新 PROJECTS.md。

## 状态

| 字段 | 值 |
|------|-----|
| 当前阶段 | G0 资料接收 |
| 最新通过门禁 | |
| 公共规则 | 继承 ../common/README.md |
| PRD 来源 | <PRD-SOURCE> |
| visualFidelity | standard |

## 文档地图

- product/00-feature-inventory.md
- product/01-scope-and-phases.md
- product/02-technical-design.md
- product/03-api-contract.md
- product/04-frontend-tasks.md
- product/05-ui-and-interaction.md
- product/06-collaboration.md
- product/07-figma-spec.md
- engineering/development-rules.md
- agent/README.md

## 待确认

- [ ] G2 scope 确认人和日期
- [ ] Figma / API / QA 资料是否补充
- [ ] API 未 ready 时是否按 MSW 路线 B 落地 handler / 契约测试 / dev-only worker
- [ ] Lark 主动通知是否启用
- [ ] 群内 @ 应用转 task 是否启用
