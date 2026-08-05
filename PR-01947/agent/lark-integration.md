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

单进程内聚：gateway 进程内起 http:3005 + 内嵌 consume 子进程（`spawn` 保持 stdin 打开常驻），约 4 个 node 进程（gateway + consume wrapper + consume + bus daemon ~35MB）。

## 2. 三个能力（均已端到端验证，2026-08-05）

| 能力 | 脚本 | 状态 |
|------|------|------|
| 主动发群消息 | `scripts/notify-lark.mjs` | ✅ 卡片式进度可走 bot `im +messages-send` 直发（`notifyTransport:'bot'`，无需 webhook secret）或自定义机器人 webhook（默认）；本项目走 bot（见 §5、§7） |
| 阶段推进自动播报 | `docs-tdd.mjs gate` → `notify-lark.mjs` | ✅ gate 通过后自动发「Gx 已完成」绿卡；仅对 `notifyOnGate:true` 项目生效；非阻塞 + 指纹幂等（见 §7） |
| 群内 @我 转 task → AI → 回群 | `scripts/lark-gateway.mjs` + `scripts/lark-worker.mjs` | ✅ 真 @「汇报项目进度」全链路：入队→发「已收到」→worker 领取→claude 真执行→回「完成」 |
| 读 bug 表待处理项转 task | `scripts/lark-bugtable-poller.mjs` | ✅ 读取+分页(242条)+按「负责RD=我」过滤+回写`待推版` shape 已验；待有 bug 落名下时端到端 |

## 3. 配置

| 项 | 值 |
|----|----|
| 项目 / 标题 | PR-01947 / CopyTrading 跟单设置 |
| 机器人 app | `cli_aabf9468b1789ed4`（Aven.tong 的 bot，已在试点群） |
| 配置文件 | `scripts/pr-01947.json`（**本机 gitignored**，含 botOpenId/allowedChatIds/myOpenId/bugTable.appToken 等标识，禁提交） |
| AI 执行器 | `aiExecutor`：默认 `claude`（worker wrapper 设定），可被 task / `LARK_AI_EXECUTOR` 覆盖；worker 在 `/Users/aven/github/PR-01947` worktree 内执行；claude 已带 `--dangerously-skip-permissions`（无人值守可真改代码，故务必只绑受控 worktree + 白名单群） |
| 任务队列 | `agent/lark-tasks/*.json`（文件队列，gitignored） |
| bug 去重状态 | `agent/lark-bugtable-state.json`（gitignored） |
| 图片附件 | `agent/lark-attachments/<messageId>/`（gitignored） |
| 通知记录 | `agent/notification-log.md` |

## 4. 运行命令

**首选：一键控制脚本 `~/.local/bin/lark-bot`**（`~/.zshrc` 已把 `~/.local/bin` 加进 PATH）：

```bash
lark-bot start      # 起 gateway + worker（detached）
lark-bot status     # 健康检查 + 进程
lark-bot stop       # 全停（含 lark-cli consume/bus）
lark-bot restart
lark-bot logs       # 实时日志（~/Library/Logs/fameex-lark/）
```

**原始入口（调试用）——必须走薄包装脚本，不能直接 `node common/xxx.mjs`：**

```bash
cd /Users/aven/github/fameex-web
node /Users/aven/github/docs_tdd/PR-01947/agent/scripts/lark-gateway.mjs        # 能力2 gateway
node /Users/aven/github/docs_tdd/PR-01947/agent/scripts/lark-worker.mjs         # 能力2 worker（--once 单次）
node /Users/aven/github/docs_tdd/PR-01947/agent/scripts/lark-bugtable-poller.mjs --once   # 能力3
```

> ⚠️ **坑**：`fameex-web/apps/web/docs_tdd` 软链到 `~/github/docs_tdd`，Node `import.meta.url` 用真实路径而 `argv[1]` 是软链路径 → common 脚本的 `if(import.meta.url===file://+argv[1])` 主守卫恒 false → 直接跑 common 脚本会静默退出。**只能走薄包装入口**（wrapper 直接 import 调函数）。

常驻：暂用 `lark-bot start` 按需启动（未做开机 LaunchAgent 常驻）。不再需要 cloudflared。

## 5. 上线前置（均已完成）

1. ✅ bot 已在试点群；`allowedChatIds` / `botOpenId` / `myOpenId` 已填入本机配置。
2. ✅ Lark 后台事件订阅 `im.message.receive_v1` 已开、应用已发布；bitable 读写 scope（`base:field:read` / `base:record:read` / `base:record:update`）已审批。
3. ✅ bug 表字段已确认（表名「EX项目bug统计表」）：
   - `assigneeField` = **负责RD**（表内**无**「负责人」字段，人员类字段为 解决人员/负责RD/测试人员）
   - `statusField` = **处理状态**，`pendingValue` = **待处理**，`doneValue` = **待推版**（「处理中」不是合法选项）
   - `titleField` = 问题标题，`descField` = 问题描述（复现步骤）
4. 进度卡片通道：本项目走 bot `im +messages-send`（`notifyTransport:'bot'`，复用已登录 bot 身份，无需 webhook secret）；若改用自定义机器人 webhook 再填 `webhookUrl`/`secret` 并去掉 `notifyTransport`。

## 6. 当前运行状态

| 项 | 状态 |
|----|------|
| 公共脚本 | ✅ `lark-gateway.mjs`（含拍平事件归一化器）、`lark-worker.mjs`（executor 抽象 + claude 放权）、`lark-bugtable-poller.mjs`（列式解析 + 分页） |
| 本地 HTTP 队列契约 | ✅ health / ingest / claim / status / 去重 / 落盘 / 两条独立回群消息 全通过 |
| lark-cli 长连接 | ✅ `feishu-websocket: connected`，真 @ 事件已摄取解析 |
| 能力2 全链路 | ✅ claude 真执行验证通过 |
| 能力3 | ✅ 读取/分页/过滤/回写 shape 已验；当前 aven 名下无待处理 bug，缺真实数据端到端 |
| codex 执行器 | ⏸ 本机 `codex` CLI 不在 PATH（装的是 ChatGPT App），未预置其 bypass flag；默认 claude 已工作 |

### 关键实现坑（避免重踩）
- **软链主守卫**：见 §4，只走薄包装入口。
- **lark-cli 事件是拍平顶层结构**（非官方嵌套 webhook schema）：`message_id/chat_id/sender_id` 在顶层、`content` 是已内联 mention 名的纯文本、`mentions[].id` 是字符串。gateway 已加归一化器（双 schema 容错 + 去 mention）。@bot 判定 = `mentions.some(m=>m.id===botOpenId)`。
- **`base +record-list` 返回列式结构**（`data.fields`=列名字符串数组 / `data.data`=行 / `data.record_id_list`），非 `data.items[].fields`；poller 已按列式解析并翻页。`+record-search` 强制要 `--keyword`，不适合列全部。
- **worker `claude -p` 默认权限无法无人值守写文件/git**，已加 `--dangerously-skip-permissions`。

## 7. 阶段推进自动播报（gate → 发「Gx 已完成」）

`docs-tdd.mjs gate <PID> <Gx>` **机器校验通过（exit 0）** 时，自动发一张「Gx 已完成」绿卡到群，无需手动 `notify-lark`。

**开关（opt-in，逐项目）**：仅当项目配置 `scripts/pr-01947.json` 里 `notifyOnGate:true` 才播报；其它项目默认不受影响。本项目已开启。

**通道**：复用 §5 的 `notifyTransport`。本项目 `'bot'`，走 bot `im +messages-send` 发卡片（无需 webhook secret）。

**触发规则（不夸大）**：
- 仅 `gate` 命令、仅 exit 0（通过）才发；gate 失败 / `changed` / `context` 等命令都不发。
- **非阻塞**：播报失败只 `⚠ warn`，绝不改 gate 退出码。
- **幂等防刷群**：幂等键 = `<PID>-<Gx>-<sha1(gate 指纹)[:12]>`，同代码状态重复跑同一 gate 不会重复发（lark-cli 服务端 `--idempotency-key` 去重）。

**实现位置**：
- `common/agent-scripts/docs-tdd.mjs` → `maybeBroadcastGate(id, gate)`，在 gate 分支 exit 0 后调用；spawn **项目薄包装** `notify-lark.mjs`（不能直调 common，见 §4 软链主守卫坑）。
- `common/agent-scripts/notify-lark.mjs` → `resolveTransport` / `deliverViaBot` + `--idempotency-key`；`createPayload` 卡片结构与 G0-G8 手动播报完全一致（图1 样式）。

**配置字段（pr-01947.json，gitignored）**：`notifyTransport:'bot'`、`notifyOnGate:true`、`notifyChatId`（缺省回落 `allowedChatIds[0]`）。

> 说明：`docs-tdd.mjs` / `notify-lark.mjs` 是按需 CLI，改完即生效，无需 `lark-bot restart`（那是给常驻的 gateway/worker 用的）。
