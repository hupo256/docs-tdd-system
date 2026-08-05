# PR-01947 Lark 集成

> 只记录 PR-01947 项目差异与运行状态。通用规则继承：
> - 群内 @ 应用转任务：[../../common/lark-bot-gateway.md](../../common/lark-bot-gateway.md)
> - 主动发群消息：[../../common/lark-active-notification.md](../../common/lark-active-notification.md)
> - Lark 文档只读同步：[../../common/lark-doc-sync.md](../../common/lark-doc-sync.md)
> - 协作边界：[../../common/collaboration-and-notifications.md](../../common/collaboration-and-notifications.md)

## 1. 架构（lark-cli 长连接，无公网 tunnel）

接收链路用 `lark-cli event consume im.message.receive_v1` 长连接，替代当年已丢失的 Koa Gateway + cloudflared tunnel。发消息、下载图片、读写多维表格均走 lark-cli 已登录的 bot 身份（keychain），配置里不放 app 级密钥。

```text
Lark 群 @机器人 ─┐                         Lark bug 多维表格 ─┐
 lark-cli event  │                          lark-cli base       │
 consume 长连接   ▼                          +record-list 轮询    ▼
        lark-gateway.mjs（本地 3005，文件队列 + 收发消息 + 回写表格）
                 ▲ HTTP 领取/回写
        lark-worker.mjs（领 task → doc sync → AI(claude|codex) → 回写 done）
```

## 2. 三个能力

| 能力 | 脚本 | 状态 |
|------|------|------|
| 主动发群消息 | `scripts/notify-lark.mjs`（薄包装 → common/notify-lark.mjs） | 代码就绪，待填 webhook |
| 群内 @我 转 task | `scripts/lark-gateway.mjs` + `scripts/lark-worker.mjs` | 代码就绪，待补 scope + 群 chat_id |
| 读 bug 表待处理项转 task | `scripts/lark-bugtable-poller.mjs` | 代码就绪，待补 base scope + 字段名 |

## 3. 配置

| 项 | 值 |
|----|----|
| 项目 / 标题 | PR-01947 / CopyTrading 跟单设置 |
| 机器人 app | `cli_aabf9468b1789ed4`（Aven.tong 的 bot，需先加入协作群） |
| 配置文件 | `scripts/pr-01947.json`（占位模板已建，填真实值前禁提交敏感项） |
| AI 执行器 | `aiExecutor`：`codex` 或 `claude`，可被 task / `LARK_AI_EXECUTOR` 覆盖；worker 在 `/Users/aven/github/PR-01947` worktree 内执行 |
| 任务队列 | `agent/lark-tasks/*.json`（文件队列） |
| bug 去重状态 | `agent/lark-bugtable-state.json` |
| 图片附件 | `agent/lark-attachments/<messageId>/` |
| 通知记录 | `agent/notification-log.md` |

## 4. 运行命令

```bash
# 能力1：发进度卡片
node apps/web/docs_tdd/PR-01947/agent/scripts/notify-lark.mjs G4 进行中 "测试" --dry-run

# 能力2：Gateway（含 lark-cli 长连接）+ Worker
node apps/web/docs_tdd/PR-01947/agent/scripts/lark-gateway.mjs
node apps/web/docs_tdd/PR-01947/agent/scripts/lark-worker.mjs           # 常驻轮询
node apps/web/docs_tdd/PR-01947/agent/scripts/lark-worker.mjs --once     # 单次

# 能力3：bug 表轮询
node apps/web/docs_tdd/PR-01947/agent/scripts/lark-bugtable-poller.mjs --once
node apps/web/docs_tdd/PR-01947/agent/scripts/lark-bugtable-poller.mjs   # 常驻轮询
```

常驻方式：本机 LaunchAgent（不提交仓库），建议 `com.fameex.pr01947.lark-gateway` / `.lark-worker` / `.lark-bugtable-poller`，日志落 `~/Library/Logs/fameex-lark/pr01947-*.log`。不再需要 cloudflared。

## 5. 上线前置条件（配置项，非架构）

1. 把 bot `cli_aabf9468b1789ed4` 加入协作群，填 `allowedChatIds`（新群 `chat_id`）与 `botOpenId`。
2. Lark 开发者后台开启事件订阅 `im.message.receive_v1`，授权：
   - `im:message.p2p_msg:readonly` + 群消息接收/发送、`im:resource`（读图）。
   - 多维表格读写（bitable）scope。
   - （今天实测 consume 报 `context canceled` / `token_missing`，即缺上述 scope，属配置未开通。）
3. bug 表确认：`appToken`（base token）、字段名（`assigneeField` 负责人 / `statusField` 处理状态 / `pendingValue` 待处理 / `doneValue` 完成后写入值）、`myOpenId`。
4. 要发进度卡片则填 `webhookUrl` / `secret`。

## 6. 当前运行状态

| 项 | 状态 |
|----|------|
| 公共脚本 | 已建：`common/agent-scripts/lark-gateway.mjs`、`lark-bugtable-poller.mjs`；`lark-worker.mjs` 已加 executor 抽象 |
| 本地 HTTP 队列契约 | 已冒烟通过：health / ingest / claim / status / 去重 / 落盘 |
| lark-cli 长连接 | 未上线：缺事件订阅 scope（`context canceled`）；bus 守护实测 ~35MB |
| 群 chat_id / botOpenId | 待补（新群） |
| bug 表字段 | 待确认 |
