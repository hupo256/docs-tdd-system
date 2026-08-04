# PR-02006 Lark 集成

> 公共规则继承 [`../../common/collaboration-and-notifications.md`](../../common/collaboration-and-notifications.md)、[`../../common/lark-doc-sync.md`](../../common/lark-doc-sync.md)、[`../../common/lark-active-notification.md`](../../common/lark-active-notification.md)。本文只记录当前项目状态和差异。

## 当前决策

| 能力 | 状态 | 说明 |
|------|------|------|
| Lark 文档只读同步 | 已启用 | PRD 链接已登记到 `agent/lark-sources.json`，同步成功 |
| 主动发群消息 | 未启用 | 用户未提供 webhook 配置；阶段结果先由人工同步 |
| 群内 @ 应用转 task | 未启用 | 如需启用，需另接 Lark 应用事件订阅、Bot Gateway 和 Worker |

## 文档同步命令

```bash
node apps/web/docs_tdd/PR-02006/agent/scripts/sync-lark-docs.mjs --dry-run
node apps/web/docs_tdd/PR-02006/agent/scripts/sync-lark-docs.mjs
```

同步输出目录：`apps/web/docs_tdd/PR-02006/inbox/lark-sync/`。当前输出包含 `prd-latest.md`、`prd-latest.md.metadata.json`、`prd-content.md`、`sync-report.md`。

## 通知记录

实际群通知记录写入 `agent/notification-log.md`。当前未配置 webhook，不记录 real success。
