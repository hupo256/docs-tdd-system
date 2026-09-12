---
projectId: PR-02172
status: closed
stage: G8
branch: feature/PR-02172
worktree: ""
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/Zj7Dd8cdIorON3xmYSdlI94qg1c
figmaNode: "19782:4920"
larkEnabled: false
workflowVersion: 1
---

# PR-02172 【登录注册】增加第三方（tg、facebook）

> 本文件顶部 YAML frontmatter 是机器可读的元数据真值源，修改后请运行 `node apps/web/docs_tdd/common/engine/agent-scripts/update-project-index.mjs --write` 刷新 PROJECTS.md。

## 状态

| 字段 | 值 |
|------|-----|
| 当前阶段 | 发布归档：负责人于 2026-09-12 确认已上线；worktree 已回收 |
| 归档门禁标记 | G8：保留既有真实 PASS 历史，不补造新的 Gate 证据 |
| 发布状态 | `feature/PR-02172` 的 HEAD `92cde0060596` 已在 `origin/online`；核验见 `evidence/release/2026-09-12/README.md` |
| 公共规则 | 继承 ../../common/README.md |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/docx/Zj7Dd8cdIorON3xmYSdlI94qg1c |
| visualFidelity | standard（已确认；12px 圆角 / 15px blur 使用最近 preset） |

## 归档判断（2026-09-12）

- 负责人确认该项目已经上线；`feature/PR-02172` 的当前 HEAD 已合入 `origin/online`。
- 一次性编码 worktree 已按上线回收；本地与远端 `feature/PR-02172` 分支均保留供回查。远端分支存在与本地不同的历史，未强推或改写。
- 历史 Gate、协作记录与证据保留原样；后续问题按新的变更项目处理，不重新激活本项目。

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

## 历史待确认（不构成活动工作项）

- [x] 12 项技术方向全部按建议确认（2026-08-03）
- [x] 当前负责人确认 C01-C18 建议方案（2026-08-03）
- [x] 登录/注册、账户绑定、首页 Figma 原子规格已读取并回填（2026-08-21）
- [ ] 评审确认 C08 环境账号/审核 owner 与完成日期
- [ ] 确认 Admin 在 legacy admin / `apps/admin` 的复用落点
- [ ] 补白板读取权限或导出流程图
- [ ] G2 scope 确认人和日期
- [ ] QA 账号、兼容矩阵与人工视觉验收资料是否补充
- [ ] API 未 ready 时是否按 MSW 路线 B 落地 handler / 契约测试 / dev-only worker
- [ ] Lark 主动通知是否启用
- [ ] 群内 @ 应用转 task 是否启用
