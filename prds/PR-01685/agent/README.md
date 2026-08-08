# PR-01685 Agent 流程

> 本文只记录 PR-01685 项目差异和恢复顺序。通用门禁、Lark、Browser / Playwright、QA、质量检查规则继承 `../../common/`。

> 项目已于 2026-07-30 上线并在 2026-08-01 完成归档；编码 worktree 已回收。以下内容仅供历史回查。

## 1. 当前运行口径

| 能力 | 状态 | 项目差异 |
|------|------|----------|
| Figma / 设计读取 | 已完成历史读取 | `web组件` 画板 `9489:136579` 曾于 2026-06-05 完成 MCP 读取 |
| 主动 Lark 通知 | 已启用 | 配置和状态见 [lark-integration.md](./lark-integration.md) |
| 群内 @ 自动闭环 | 已接入，按需启动 | 需同时启动 Koa Gateway、quick tunnel、`lark-worker.mjs` |
| QA 用例 | 未提供 | G7 当前记录为跳过，不作为交付阻塞 |

## 2. 恢复顺序

如果线程中断或上下文压缩，按顺序读：

1. `apps/web/docs_tdd/AGENTS.md`
2. `apps/web/docs_tdd/common/README.md`
3. `apps/web/docs_tdd/common/rules/workflow-gates.md`
4. `apps/web/docs_tdd/common/rules/collaboration-and-notifications.md`
5. `apps/web/docs_tdd/prds/PR-01685/README.md`
6. `apps/web/docs_tdd/prds/PR-01685/product/00-feature-inventory.md`
7. `apps/web/docs_tdd/prds/PR-01685/product/03-api-contract.md`
8. `apps/web/docs_tdd/prds/PR-01685/product/04-frontend-tasks.md`
9. `apps/web/docs_tdd/prds/PR-01685/agent/lark-integration.md`
10. `apps/web/docs_tdd/prds/PR-01685/inbox/lark-sync/sync-report.md`（若存在）
11. 最近一次用户消息或 Lark task 内容

## 3. PR-01685 项目特殊执行点

- 继续开发前先比对当前 Mock / service 与 YApi 当前版本差异，再校准 Mock、schema、mapper 并切真实接口。
- 继续开发前先用 `agent/scripts/sync-lark-docs.mjs --dry-run` 审计 Lark 只读资料源；真实 PRD / QA 链接配置完成后再同步到 `inbox/lark-sync/`，并以带 `sourceUrl` / `syncedAt` 的本地副本为准。
- 活动页 UI/UX 验收必须 **Browser MCP + Playwright MCP** 配合（见 [ui-ux-mcp-acceptance.md](./ui-ux-mcp-acceptance.md)）；Playwright 不进 monorepo，走 Cursor `@playwright/mcp`。
- 收到 QA 用例后，先与 PRD 逐项比对并输出差异清单，等待确认后再执行。
- 自动验收或 QA 回归缺测试账号、环境、接口、活动配置、QA 用例解释时，通过已启用的 Lark 机制索取，不静默等待。

## 4. 项目入口

| 文档 | 用途 |
|------|------|
| [lark-integration.md](./lark-integration.md) | PR-01685 Lark 启用状态、配置路径、历史验证 |
| [lark-sources.json](./lark-sources.json) | Lark CLI 只读同步 PRD / QA / Wiki / Drive 资料源清单 |
| [notification-log.md](./notification-log.md) | 实际发送、dry-run、Gateway 验证记录 |
| [ui-ux-mcp-acceptance.md](./ui-ux-mcp-acceptance.md) | **UI/UX 验收主文档**：Browser MCP + Playwright MCP 双 MCP 分工与 K1–K12 步骤 |
| [playwright-artifacts/](./playwright-artifacts/) | 历史自测与可选本机 Playwright 脚本 |
| [../engineering/development-rules.md](../engineering/development-rules.md) | Campaign 专有工程约束 |
