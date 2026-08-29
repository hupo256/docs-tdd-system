---
projectId: PR-02265
status: closed
stage: G6
branch: "feature/PR-02265"
worktree: ""
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/P2xud4WYyoapp6xfjskl7UI3gKc
figmaNode: ""
larkEnabled: false
---

# PR-02265 PR-02265

> 状态：**已上线（2026-08-29 确认，分支已合入 origin/online）**。worktree 已回收（分支保留）；本目录保留历史文档与验收证据。

> 本文件顶部 YAML frontmatter 是机器可读的元数据真值源，修改后请运行 `node apps/web/docs_tdd/common/engine/agent-scripts/update-project-index.mjs --write` 刷新 PROJECTS.md。

## 状态

| 字段 | 值 |
|------|-----|
| 当前阶段 | 已上线，worktree 已回收 |
| 最新记录门禁 | G6 BLOCK（2026-08-21，fail=3：`apps/web/.../FuturesHistoryTransactionOrder/helper.ts:8` TS2339 类型错误；F04 无 passed 验收；AC-4/AC-13 failed/blocked）。**未见后续 G6 重跑记录**——据用户 2026-08-29 确认，上述问题在上线前已在代码中修复，只是未补跑 gate 留痕，此处如实记录以上落差，不代表本次回收时已重新验证。 |
| 公共规则 | 继承 ../../common/README.md |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/docx/P2xud4WYyoapp6xfjskl7UI3gKc |
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
