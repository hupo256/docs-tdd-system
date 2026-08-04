---
projectId: PR-02172
status: active
stage: G0
branch: feature/PR-02172
worktree: /Users/aven/github/PR-02172
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/Zj7Dd8cdIorON3xmYSdlI94qg1c
figmaNode: "9137:2"
larkEnabled: false
---

# PR-02172 【登录注册】增加第三方（tg、facebook）

> 本文件顶部 YAML frontmatter 是机器可读的元数据真值源，修改后请运行 `node apps/web/docs_tdd/common/agent-scripts/update-project-index.mjs --write` 刷新 PROJECTS.md。

## 状态

| 字段 | 值 |
|------|-----|
| 当前阶段 | G0/G1：C01-C18 已确认，范围为 Web + Admin；等待剩余资料/契约（未进 G2） |
| 最新通过门禁 | |
| 公共规则 | 继承 ../common/README.md |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/docx/Zj7Dd8cdIorON3xmYSdlI94qg1c |
| visualFidelity | standard（待读取 Figma 后确认） |

## 文档地图

- product/00-feature-inventory.md
- product/01-scope-and-phases.md
- product/02-technical-design.md
- product/03-api-contract.md
- product/04-frontend-tasks.md
- product/05-ui-and-interaction.md
- product/06-collaboration.md
- product/07-figma-spec.md
- product/08-review-agenda.md（一页技术评审议程，按 P0–P4 优先级重排）
- engineering/development-rules.md
- agent/README.md

## 待确认

- [x] 12 项技术方向全部按建议确认（2026-08-03）
- [x] 当前负责人确认 C01-C18 建议方案（2026-08-03）
- [ ] 评审确认 C08 环境账号/审核 owner 与完成日期
- [ ] 确认 Admin 在 legacy admin / `apps/admin` 的复用落点
- [ ] 补白板读取权限或导出流程图
- [ ] G2 scope 确认人和日期
- [ ] Figma / API / QA 资料是否补充
- [ ] API 未 ready 时是否按 MSW 路线 B 落地 handler / 契约测试 / dev-only worker
- [ ] Lark 主动通知是否启用
- [ ] 群内 @ 应用转 task 是否启用
