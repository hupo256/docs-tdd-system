# PR-01947 Lark 集成

> 只记录 PR-01947 项目差异与运行状态。通用规则继承：
> - 群内 @ 应用转任务：[../../common/rules/lark-bot-gateway.md](../../../common/rules/lark-bot-gateway.md)
> - 主动发群消息：[../../common/rules/lark-active-notification.md](../../../common/rules/lark-active-notification.md)
> - Lark 文档只读同步：[../../common/rules/lark-doc-sync.md](../../../common/rules/lark-doc-sync.md)
> - 协作边界：[../../common/rules/collaboration-and-notifications.md](../../../common/rules/collaboration-and-notifications.md)

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
| 读 bug 表待处理项转 task（**跨项目**） | `scripts/lark-bugtable-poller.mjs` | ✅ 读取+分页+按「负责RD=Aven.tong(open_id)」过滤，**读 `项目ID` 列 → task.project**；worker 按项目号路由（见 §7）。当前名下 0 待处理，端到端待 QA 期真 bug |

## 3. 配置

| 项 | 值 |
|----|----|
| 项目 / 标题 | PR-01947 / CopyTrading 跟单设置 |
| 机器人 app | `cli_aabf9468b1789ed4`（Aven.tong 的 bot，已在试点群） |
| 配置文件 | `scripts/lark-bot.local.json`（**本机 gitignored 的单一 bot 配置**，含 botOpenId/allowedChatIds/myOpenId/bugTable.appToken 等标识，禁提交）。**这是单一跨项目 bot 服务配置**，非 PR-01947 专属；`project`/`title` 仅作附件/任务落盘目录与 adhoc 兜底品牌 |
| AI 执行器 | 仅允许 `claude` / `codex`；优先级 task（群消息开头 `[codex]`/`[claude]`）> `LARK_AI_EXECUTOR` > `lark-bot.local.json.aiExecutor` > 默认 `claude`。Codex 用 workspace-write、never、工具网络关闭及结构化结果，由 Worker 回写 Gateway；Claude 保持现有无人值守 callback。 |
| 任务队列 | `agent/lark-tasks/*.json`（文件队列，gitignored） |
| bug 去重状态 | `agent/lark-bugtable-state.json`（gitignored） |
| 图片附件 | `agent/lark-attachments/<messageId>/`（gitignored） |
| 通知记录 | `agent/notification-log.md` |

## 4. 运行命令

**首选：一键控制脚本 `~/.local/bin/lark-bot`**（`~/.zshrc` 已把 `~/.local/bin` 加进 PATH）：

```bash
lark-bot start      # 起 gateway + worker（detached）
lark-bot status     # 健康检查 + 进程（含 poller）
lark-bot stop       # 全停（含 poller + lark-cli consume/bus）
lark-bot restart
lark-bot logs       # 实时日志（~/Library/Logs/fameex-lark/）
lark-bot poll-on    # QA 期开 bug 轮询窗口（平时不跑；空闲 4h 无新 bug 自动收工）
lark-bot poll-off   # 关轮询
```

**原始入口（调试用）——必须走薄包装脚本，不能直接 `node common/xxx.mjs`：**

```bash
cd /Users/aven/github/fameex-web
node /Users/aven/github/docs_tdd/prds/PR-01947/agent/scripts/lark-gateway.mjs        # 能力2 gateway
node /Users/aven/github/docs_tdd/prds/PR-01947/agent/scripts/lark-worker.mjs         # 能力2 worker（--once 单次）
node /Users/aven/github/docs_tdd/prds/PR-01947/agent/scripts/lark-bugtable-poller.mjs --once   # 能力3
```

> ⚠️ **坑**：`fameex-web/apps/web/docs_tdd` 软链到 `~/github/docs_tdd`，Node `import.meta.url` 用真实路径而 `argv[1]` 是软链路径 → common 脚本的 `if(import.meta.url===file://+argv[1])` 主守卫恒 false → 直接跑 common 脚本会静默退出。**只能走薄包装入口**（wrapper 直接 import 调函数）。

常驻：暂用 `lark-bot start` 按需启动（未做开机 LaunchAgent 常驻）。不再需要 cloudflared。

## 5. 上线前置（均已完成）

1. ✅ bot 已在试点群；`botOpenId` / `myOpenId` 已填入本机配置。**白名单用动态成员制 `allowedChatIds:"auto"`**：白名单 = bot 当前所在的群（Lark 只投递 bot 所在群的消息，群成员资格即信任边界）。新项目群把 bot 拉进去即时响应 @、无需改配置或重启（未知 chat 首次 @ 自动刷新 `im +chat-list` 再判）；仍 fail-closed（bot 不在该群则拒）。p2p 直发无群锚点，仍只放行 `allowedOpenIds` 显式用户。
2. ✅ Lark 后台事件订阅 `im.message.receive_v1` 已开、应用已发布；bitable 读写 scope（`base:field:read` / `base:record:read` / `base:record:update`）已审批。
3. ✅ bug 表字段已确认（表名「EX项目bug统计表」）：
   - `assigneeField` = **负责RD**（表内**无**「负责人」字段，人员类字段为 解决人员/负责RD/测试人员）
   - `statusField` = **处理状态**，`pendingValue` = **待处理**，`doneValue` = **待推版**（「处理中」不是合法选项）
   - `titleField` = 问题标题，`descField` = 问题描述（复现步骤）
4. 进度卡片通道：本项目走 bot `im +messages-send`（`notifyTransport:'bot'`，复用已登录 bot 身份，无需 webhook secret）；若改用自定义机器人 webhook 再填 `webhookUrl`/`secret` 并去掉 `notifyTransport`。

## 6. 当前运行状态

| 项 | 状态 |
|----|------|
| 公共脚本 | ✅ `lark-gateway.mjs`（含拍平事件归一化器）、`lark-worker.mjs`（Claude/Codex executor 抽象 + 安全参数）、`lark-bugtable-poller.mjs`（列式解析 + 分页） |
| 本地 HTTP 队列契约 | ✅ health / ingest / claim / status / 去重 / 落盘 / 两条独立回群消息 全通过 |
| lark-cli 长连接 | ✅ `feishu-websocket: connected`，真 @ 事件已摄取解析 |
| 能力2 全链路 | ✅ claude 真执行验证通过 |
| 能力3 | ✅ 读取/分页/过滤/回写 shape 已验；当前 aven 名下无待处理 bug，缺真实数据端到端 |
| codex 执行器 | ✅ 本机 ChatGPT App 内置 Codex CLI 可用；已接 `codex exec` 非交互模式、结构化结果与 Worker 回写；默认仍为 Claude，改本机 `aiExecutor` 或消息加 `[codex]` 灰度启用 |

### 关键实现坑（避免重踩）
- **软链主守卫**：见 §4，只走薄包装入口。
- **引用/回复消息要单独拉**：工作流是「在 QA 的原始 bug 消息下回复 + @bot」，真正 bug 正文/截图在**被引用的父消息**里；@ 这条本身往往只有「看这里」。gateway `normalizeMessage` 提 `reply_to`/`root_id`，`fetchReferencedContext` 用 `lark-cli im +messages-mget` 拉父消息合并进 task（`merge_forward` 合并转发的 `content` 已是可读字符串直接用；post/image 解析出文本+图片 image_key 再下载）。不拉则「看这里」类 @ 必然 failed（踩过）。
- **lark-cli 事件是拍平顶层结构**（非官方嵌套 webhook schema）：`message_id/chat_id/sender_id` 在顶层、`content` 是已内联 mention 名的纯文本、`mentions[].id` 是字符串。gateway 已加归一化器（双 schema 容错 + 去 mention）。@bot 判定 = `mentions.some(m=>m.id===botOpenId)`。
- **`base +record-list` 返回列式结构**（`data.fields`=列名字符串数组 / `data.data`=行 / `data.record_id_list`），非 `data.items[].fields`；poller 已按列式解析并翻页。`+record-search` 强制要 `--keyword`，不适合列全部。
- **worker `claude -p` 默认权限无法无人值守写文件/git**，已加 `--dangerously-skip-permissions`。
- **Codex 不照搬 Claude 的全放权**：使用 `workspace-write + approval never + network=false + ephemeral`；AI 最终 JSON 由 Worker 回写本地 Gateway，避免为 callback 打开工具网络。

### 本轮健壮性加固（2026-08-06，review 后落码）

- **白名单 fail-closed**：`isWhitelisted` 群消息按群放行（群内 QA/PM/后台 @ 都能触发）、p2p 按用户；**完全没配白名单时拒绝所有事件**（旧实现是 fail-open，漏配即放行所有人 → 无监督改代码）。启动时空白名单打警告。
- **不再兜底谎报完成**：AI 退出但未显式回写 done/failed → 一律判 `failed`（待人工复核），不分任务类型（旧实现非命令类任务会伪造「已完成」）。
- **prompt 注入防护**：`task.text` / 附件在 AI prompt 里用 `UNTRUSTED_TASK_INPUT` 定界并声明为不可信输入，注入式指令一律忽略。
- **project 校验**：bug 表 `项目ID` 与群 @ 项目号都过 `(PR|PM)-\d{3,}`，worker `safeProject` 二次校验，防 `../` 越出 worktree 根。
- **领取租约 + 孤儿重入队**：任务领走盖 `claimedAt`，超 `LARK_TASK_LEASE_MS`（默认 40min）仍 running 自动重入队；`/lark/health` 暴露 `counts` + `stuck`。
- **子进程超时**：`lark-cli`/sync/AI 进程统一超时（`LARK_CLI_TIMEOUT_MS` 默认 60s），SIGTERM→SIGKILL 升级，不再永久挂起。`git fetch origin online` 退避重试、失败容忍本地 stale 引用。
- **bug 去重改按 gateway 状态**：`failed` 记录不永久 seen（旧实现会静默丢），保持表格待处理待人工，poller 计数 `stuck-failed`。
- **本地 API 可选鉴权**：设 `LARK_GATEWAY_SECRET` 后写操作 POST 需带 `x-lark-gateway-secret`；`readBody` 1MB 上限；`/status` 状态白名单校验；附件名 sanitize。sync 禁写校验扫全命令 token（不止 shortcut）。

## 7. 阶段推进自动播报（gate → 发「Gx 已完成」）

`docs-tdd.mjs gate <PID> <Gx>` **机器校验通过（exit 0）** 时，自动发一张「Gx 已完成」绿卡到群，无需手动 `notify-lark`。

**开关（opt-in，逐项目）**：仅当项目配置 `scripts/lark-bot.local.json` 里 `notifyOnGate:true` 才播报；其它项目默认不受影响。本项目已开启。

**通道**：复用 §5 的 `notifyTransport`。本项目 `'bot'`，走 bot `im +messages-send` 发卡片（无需 webhook secret）。

**触发规则（不夸大）**：
- 仅 `gate` 命令、仅 exit 0（通过）才发；gate 失败 / `changed` / `context` 等命令都不发。
- **非阻塞**：播报失败只 `⚠ warn`，绝不改 gate 退出码。
- **幂等防刷群**：幂等键 = `<PID>-<Gx>-<sha1(gate 指纹)[:12]>`，同代码状态重复跑同一 gate 不会重复发（lark-cli 服务端 `--idempotency-key` 去重）。

**实现位置**：
- `common/engine/agent-scripts/docs-tdd.mjs` → `maybeBroadcastGate(id, gate)`，在 gate 分支 exit 0 后调用；spawn **项目薄包装** `notify-lark.mjs`（不能直调 common，见 §4 软链主守卫坑）。
- `common/engine/agent-scripts/notify-lark.mjs` → `resolveTransport` / `deliverViaBot` + `--idempotency-key`；`createPayload` 卡片结构与 G0-G8 手动播报完全一致（图1 样式）。

**配置字段（lark-bot.local.json，gitignored）**：`notifyTransport:'bot'`、`notifyOnGate:true`、`notifyChatId`（缺省回落 `allowedChatIds[0]`）。

> 说明：`docs-tdd.mjs` / `notify-lark.mjs` 是按需 CLI，改完即生效，无需 `lark-bot restart`（那是给常驻的 gateway/worker 用的）。

## 8. 能力3：跨项目 bug 自动处理 + 按需轮询

bug 多维表格是**全公司共享表**，Aven.tong 名下的 bug 横跨多个项目（`PR-01685 / PR-01988 / PR-02022 / …`，`项目ID` 列存 PR-####）。故 bug 链路是**跨项目**的，不绑单一项目。

**触发（手动轮询窗口）**：平时不跑；进 QA 密集期 `lark-bot poll-on` 开、测完 `poll-off` 关。空闲 4h 无新 bug 自动收工（`LARK_BUGTABLE_IDLE_OFF_MS`）。进 G6/G7 的 gate 播报会提醒开轮询、G8 提醒收工（见 §7）。

**链路**：poller 读表筛「负责RD 含我的 open_id 且 状态=待处理」→ 读 `项目ID` → `POST /lark/tasks`（带 `project`）→ worker 按 `project` 路由：
- `/Users/aven/github/<项目ID>` **有 worktree** → 就在该 worktree 改。**进来时若已有未提交 WIP → 先把 WIP 单独提交一笔隔离**（`commitPreexistingWip`，message 标明"非本任务产生"），再跑 AI；任务**真 done** 后把本任务改动 `git add -A && commit --no-verify` 到**当前分支**（`finalizeExistingWorktree`，每任务一个独立 commit）。失败/阻塞不提交、无改动不提交、commit 失败保留改动在工作区。→ 你的 WIP 与 bot 改动**永远分成两个 commit**，不混。
- **无 worktree** → **一次性临时 worktree**：`git worktree add` 到 `~/github/.lark-hotfix/<分支slug>`（基于 `origin/online` 建 `hotfix/<项目ID>-<id>` 分支），在里面改；**不碰主仓**（主仓脏/在别的分支都不受影响，天然无并发/顺序碰撞）。干完**自动本地提交到该分支、删临时目录**（分支保留待 review，不 push/不合并）；无改动则连空分支一起删。
- 无 `project`（既没解析到、也无 `config.project`）→ 同样临时 worktree，分支 `hotfix/adhoc-<msgId前6>`。群 @ 任务的项目号解析见 §8.1。
- 干完回写表格状态 `待处理 → 待推版`（`doneValue`）。

**路由实现**：`common/engine/agent-scripts/lark-worker.mjs` → `resolveWorkContext(workerConfig, task)`（已导出，可只读单测）+ `prepareTempWorktree` / `finalizeTempWorktree`。

**并行调度（2026-08-06 加）**：worker 从单串行改成**按 worktree 并行**——调度键 = `resolveWorkContext(task).cwd`，同一 worktree 串行、不同 worktree 并行，并发上限 `LARK_WORKER_CONCURRENCY`（默认 3）。靠 store `claimById` + gateway `POST /lark/tasks/:id/claim` 原子按 id 领取。临时 worktree 建好后 `linkNodeModules` 软链主仓 node_modules（根+apps/*+packages/*）免 `pnpm install`；hotfix 任务 prompt 验证收窄到触达包/文件（不跑全仓 tsc）。详见 `common/rules/lark-bot-gateway.md` §14。

### 8.1 群 @ 任务也共用同一套跨项目路由

能力2（群内 @ bot）和能力3（poller）现在**路由逻辑统一**——都靠 `task.project` 走 `resolveWorkContext`，差别只剩来源与「是否回写表格」（仅 `source:'lark-bugtable'` 回写）。

**项目号解析优先级（`resolveProject`）：群名 `[PR-xxxxx]`（权威）> 正文 `PR-####` > 都无则 null（→ 临时 worktree adhoc 分支，不再套 `config.project`）。**

- **群名优先**：每个项目建一个群、群名形如 `[PR-02172]【登录注册】…`，是项目号权威来源。gateway `resolveChatName(chatId)` 调 `lark-cli im +chat-list`（返回 `data.chats[].name`）建缓存。**必须群名优先**——正文常引用别的工单号（如 PR-02172 群里正文提到 PR-02193），只读正文会路由到错项目。
- 正文兜底：非项目群（如试点群名 `lark webhook` 无 PR）可在正文写 `修复 PR-01685：…`（大小写/有无空格皆可，`normalizeMessage` 只剥 @名字，项目号保留）。
- **都无（群名+正文均无）→ 临时 hotfix worktree（adhoc 分支）**（不再套 config.project=PR-01947，避免把无关任务塞进它）。

### 8.2 无 worktree 直接建临时 worktree（不再问）

@ 任务解析到项目号后：

- **有本地 worktree** → 在该 worktree 改。
- **无本地 worktree（或无项目号）** → **直接建一次性临时 worktree**（`git worktree add` 到 `~/github/.lark-hotfix/<slug>`，基于 `origin/online` 建 `hotfix/<项目ID|adhoc>-<msgId尾8位>` 分支），改完自动本地提交到分支 + 删目录。「已收到」卡片带说明「本地无 worktree，将用临时 hotfix 分支处理」。

> **早前的「请选择处理方式」按钮卡片已去掉**：既然无 worktree 统一走临时 worktree，唯一另一选项（取消建 worktree）很少用，多一步反而啰嗦。相关的 `card.action.trigger` 第二消费、`buildChoiceCard`、`handleCardAction` 已删。后台那个 `card.action.trigger` 订阅可留着（无害），暂无脚本用它。
>
> **分支名用 messageId 尾部**（不是头部）：同一群的 messageId 共享长前缀（`om_x100b68708…`），取头部会让所有任务算出同一分支名而 `worktree add` 撞车（踩过）。

### 回写健壮性（避免静默不一致）

- `writeBackBugRecord` 带重试；`doneValue` 缺失**跳过不写**（绝不写非法值「处理中」）。
- 重试仍失败 → 发一次群告警「记录 X 回写失败，请手动改状态」。否则会「群里已报完成 + poller 已 seen 不再捞 + 表格永卡待处理」静默不一致。

> ✅ 无 worktree 用**一次性临时 worktree**（`~/github/.lark-hotfix/<slug>`，用完即删），**不碰主仓**、天然无并发/顺序碰撞、无常驻 worktree 蔓延；改动以本地分支提交保留待 review（不 push/不合并）。
