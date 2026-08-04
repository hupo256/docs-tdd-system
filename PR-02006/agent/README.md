# PR-02006 Agent 流程

> 状态：G2 已确认，允许 mock-first 进入开发。公共协作规则继承 [`../../common/collaboration-and-notifications.md`](../../common/collaboration-and-notifications.md)。

## 恢复顺序

1. `apps/web/docs_tdd/AGENTS.md`
2. `apps/web/docs_tdd/CONTEXT.md`
3. `apps/web/docs_tdd/common/README.md`
4. `apps/web/docs_tdd/common/new-project-kickoff.md`
5. `apps/web/docs_tdd/common/prd-feature-inventory.md`
6. `apps/web/docs_tdd/common/lark-doc-sync.md`
7. `apps/web/docs_tdd/PR-02006/README.md`
8. `apps/web/docs_tdd/PR-02006/product/00-feature-inventory.md`
9. `apps/web/docs_tdd/PR-02006/product/06-collaboration.md`
10. 最近一次用户消息

## 当前状态

| 项 | 状态 |
|----|------|
| PRD | 已同步到 `inbox/lark-sync/prd-latest.md`；可读正文在 `inbox/lark-sync/prd-content.md` |
| G0/G2 功能清单 | 已填 F01-F23 共 23 条，全部确认本期做 |
| G2 scope | 已确认：全部做，Admin 同做，mock-first |
| Figma | 已有原型链接；正式 UI 后期补，当前按 PRD 原型开发 |
| API / YApi | 未提供；已确认数据先 Mock |
| QA 用例 | PRD §七 为嵌入 sheet，当前未展开，待导出或补充 |
| Lark 主动通知 | 不启用；本期阶段结果人工同步 |
| 群内 @ 应用转 task | 未启用；如需启用需另接 Lark 应用事件订阅 + Bot Gateway |

## Lark 文档同步

```bash
node apps/web/docs_tdd/PR-02006/agent/scripts/sync-lark-docs.mjs --dry-run
node apps/web/docs_tdd/PR-02006/agent/scripts/sync-lark-docs.mjs
```

同步配置：`agent/lark-sources.json`。项目脚本是薄包装，只调用 `common/agent-scripts/sync-lark-docs.mjs`。

## 快速恢复提示

```text
当前项目：PR-02006
门禁：G2 已确认，可 mock-first 开发
PRD 来源：https://qfglxo2m3dc.sg.larksuite.com/docx/NiHVdQGgUohh20xRJmOlmo0rgAg
下一步：进入开发；真实 API、正式 UI 和验收 sheet 后续补齐
```
