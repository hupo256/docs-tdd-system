# PR-01685 Lark 集成说明

> 本文只记录 PR-01685 项目差异、当前运行状态和历史验证结果。通用规则继承：
> - 主动通知：[../../common/lark-active-notification.md](../../common/lark-active-notification.md)
> - 群内 @ 应用转任务：[../../common/lark-bot-gateway.md](../../common/lark-bot-gateway.md)
> - Lark 文档只读同步：[../../common/lark-doc-sync.md](../../common/lark-doc-sync.md)
> - 协作边界：[../../common/collaboration-and-notifications.md](../../common/collaboration-and-notifications.md)

## 1. 启用状态

| 能力 | 状态 | PR-01685 差异 |
|------|------|---------------|
| 主动发群消息 | 已启用 | 自定义机器人 webhook；配置在 `agent/scripts/pr-01685.json` |
| 群内 @ 应用转 task | 已接入，按需启动 | 复用本机 Koa Bot Gateway；Worker 为 `agent/scripts/lark-worker.mjs` |
| Lark 文档读取 | 已接入只读同步入口 | 使用官方 `lark-cli` 只读读取 `doc/wiki/drive/markdown` 的 `read/search` 类命令；只落盘到 `apps/web/docs_tdd/**`，不写回 Lark 云文档 |

密钥、webhook、App Secret、OAuth token、群 `chat_id` 只允许放本机运行环境或 ignored 配置，不写入文档正文、群消息或交付摘要。

## 2. 项目配置

| 项 | 值 |
|----|----|
| 项目 | PR-01685 |
| 卡片标题 | `[PR-01685] Campaign 活动落地页` |
| Webhook 配置 | `apps/web/docs_tdd/PR-01685/agent/scripts/pr-01685.json` |
| 主动通知脚本 | `apps/web/docs_tdd/PR-01685/agent/scripts/notify-lark.mjs`（薄包装，调用公共脚本） |
| Worker | `apps/web/docs_tdd/PR-01685/agent/scripts/lark-worker.mjs`（薄包装，调用公共 Worker） |
| Lark 资料源 | `apps/web/docs_tdd/PR-01685/agent/lark-sources.json`；真实 PRD / QA 链接填入后同步到 `inbox/lark-sync/` |
| Lark 资料同步脚本 | `apps/web/docs_tdd/PR-01685/agent/scripts/sync-lark-docs.mjs`（薄包装，调用公共只读同步脚本） |
| 通知记录 | `apps/web/docs_tdd/PR-01685/agent/notification-log.md` |
| Bot Gateway | 本机 Koa 服务 `/Users/aven/aven/koa/src/routes/larkRoutes.js`，端口 `3005`；当前由 LaunchAgent `com.fameex.pr01685.lark-gateway` 常驻 |
| 公网 tunnel | 当前 quick tunnel 为 `https://ears-labs-pasta-concerns.trycloudflare.com/lark/events`；由 LaunchAgent `com.fameex.pr01685.cloudflared` 常驻 |
| 真实群白名单 | 只限制群 | `LARK_ALLOWED_CHAT_IDS=oc_51e2bcf0ed6a772c402d6cacd43176b3`；`LARK_ALLOWED_OPEN_IDS` 留空，暂不限制群内用户 |

主动通知命令：

```bash
node apps/web/docs_tdd/PR-01685/agent/scripts/notify-lark.mjs <G0-G8> [状态] [说明] [--dry-run]
```

Worker 按需启动：

```bash
node apps/web/docs_tdd/PR-01685/agent/scripts/lark-worker.mjs
node apps/web/docs_tdd/PR-01685/agent/scripts/lark-worker.mjs --once
```

Worker 常驻运行（当前已启用）：

```bash
launchctl print gui/$(id -u)/com.fameex.pr01685.lark-worker
launchctl kickstart -k gui/$(id -u)/com.fameex.pr01685.lark-worker
launchctl bootout gui/$(id -u)/com.fameex.pr01685.lark-worker
launchctl bootstrap gui/$(id -u) /Users/aven/Library/LaunchAgents/com.fameex.pr01685.lark-worker.plist
```

本机 LaunchAgent 配置：`/Users/aven/Library/LaunchAgents/com.fameex.pr01685.lark-worker.plist`；日志：`/Users/aven/Library/Logs/fameex-lark/pr01685-worker.out.log`、`/Users/aven/Library/Logs/fameex-lark/pr01685-worker.err.log`。该配置不提交仓库，项目文档只记录路径和运行状态。

Lark 资料只读同步：

```bash
node apps/web/docs_tdd/PR-01685/agent/scripts/sync-lark-docs.mjs --dry-run
node apps/web/docs_tdd/PR-01685/agent/scripts/sync-lark-docs.mjs
```

同步规则：只允许 `doc/wiki/drive/markdown` 的 `read/search`；输出只能进入 `apps/web/docs_tdd/PR-01685/inbox/lark-sync/`；每个 Markdown 副本必须带 `sourceUrl`、`syncedAt`、`readOnly: true` 元信息。当前 `lark-sources.json` 已填入真实 PRD / QA Wiki 链接；真实同步结果见 `apps/web/docs_tdd/PR-01685/inbox/lark-sync/sync-report.md`。公共 Worker 在处理 `文档 / 修复 / 自测 / API / QA` 命令类任务前会先运行本脚本；同步失败时不继续拿旧资料开发。

Gateway / tunnel 常驻运行（当前已启用）：

```bash
launchctl print gui/$(id -u)/com.fameex.pr01685.lark-gateway
launchctl print gui/$(id -u)/com.fameex.pr01685.cloudflared
launchctl kickstart -k gui/$(id -u)/com.fameex.pr01685.lark-gateway
launchctl kickstart -k gui/$(id -u)/com.fameex.pr01685.cloudflared
```

本机 LaunchAgent 配置：`/Users/aven/Library/LaunchAgents/com.fameex.pr01685.lark-gateway.plist`、`/Users/aven/Library/LaunchAgents/com.fameex.pr01685.cloudflared.plist`；日志在 `/Users/aven/Library/Logs/fameex-lark/`。

## 3. 当前运行状态

| 项 | 状态 | 备注 |
|----|------|------|
| Webhook 配置 | 已配置并真实发送成功 | 详见 `notification-log.md` |
| Bot Gateway | 本地验证通过 | 2026-06-18 复验 `/lark/health`、`/lark/events` challenge、群 @ mock 入队、`/lark/tasks/next` 领取、状态回写均通过 |
| 公网回调 | 本轮 quick tunnel 验证通过 | 当前地址 `https://ears-labs-pasta-concerns.trycloudflare.com/lark/events` 可打到本机；2026-06-18 09:59 复验公网 `/lark/health` 和 `/lark/events` mock 投递通过；临时地址变化后需更新 Lark 控制台 |
| PR-01685 Worker | 常驻自动领取已验证 | 已通过 LaunchAgent `com.fameex.pr01685.lark-worker` 常驻；2026-06-18 09:23 mock 群 @ 生成 task 后由常驻 Worker 自动领取并回写 `done`；状态类任务直回写，不拉起子 Codex |

## 4. PR-01685 门禁状态

| 门禁 | 当前状态 | 项目备注 |
|------|----------|----------|
| G0 | 已完成 | PRD / Figma / API 资料已入 inbox 和 product 文档 |
| G1 | 已完成 | 01-07 文档已生成 |
| G2 | 已完成 | Web 路由和核心范围已确认；feature inventory 仍需负责人补确认人 |
| G3 | 已完成 | Mock 以 YApi DTO 形状对齐 mapper；真实接口待后端差异确认 |
| G4 | 已完成 | Mock 页面开发里程碑已完成 |
| G5 | 阻塞中 | 等待后端确认成功码、网关前缀、serverTime、错误码和测试活动配置 |
| G6 | 部分完成 | 已有单测 / Biome；Browser / Playwright 全量走查待补 |
| G7 | 跳过 | 当前未提供 QA 全量测试用例 |
| G8 | 阻塞中 | API 联调和自测证据未完成前不交付 |

## 5. 历史验证记录

| 时间 | 验证项 | 结论 |
|------|--------|------|
| 2026-06-18 | Bot Gateway 本地复验 | health、challenge、mock 群 @ 入队、任务领取、状态回写通过；Gateway 已停掉，公网 tunnel 仍需按需重启 |
| 2026-06-18 | 群 @ 自动链路复验 | 本机 Gateway 与 quick tunnel 在线；公网 `/lark/events` 投递 mock 群 @ 后，PR-01685 `lark-worker --once` 自动领取并回写 `done`；此前卡点是状态类任务也会拉起子 Codex，公共 Worker 已改为状态类直回写并为 Codex 子进程增加超时失败兜底 |
| 2026-06-18 09:16 +04 | 当前运行态复验 | 本机 Koa `node app.js` 和 `cloudflared tunnel --url http://127.0.0.1:3005` 正在运行；公网 `/lark/health` 可访问；mock 群 @ `状态：验证 PR-01685 Lark 应用自动工作链路` 入队后由 PR-01685 Worker 领取并回写 `done` |
| 2026-06-18 09:23 +04 | LaunchAgent 常驻复验 | `launchctl print gui/$(id -u)/com.fameex.pr01685.lark-worker` 显示 `state = running`；mock 群 @ `状态：验证 PR-01685 LaunchAgent 常驻 Worker 自动领取` 入队后 3 秒内自动回写 `done` |
| 2026-06-18 09:59 +04 | Gateway / tunnel / Worker 常驻全链路复验 | Gateway、cloudflared、Worker 三个 LaunchAgent 均为 `state = running`；公网 `https://ears-labs-pasta-concerns.trycloudflare.com/lark/events` 投递 mock 群 @ 后，任务自动回写 `done` |
| 2026-06-18 10:16 +04 | 真实群事件接收 | 真实群 @ 已进入 Gateway，抓到 `chat_id=oc_51e2bcf0ed6a772c402d6cacd43176b3`、触发人 `open_id=ou_27c0c91ac40e639de48760228fc1cd4f`；首条因 Worker LaunchAgent 找不到 `codex` 失败 |
| 2026-06-18 10:23 +04 | 真实群自动领取 | 修复 Worker LaunchAgent `PATH` 后，真实群新消息成功入队并由 Worker 自动领取、回写 `done`；随后补充端口/运行状态直回规则，避免此类查询拉起子 Codex |
| 2026-06-18 10:30 +04 | 端口状态直回复验 | 模拟真实群同 `chat_id` 消息 `PR-01685 这个项目跑起来没有，端口号是多少` 自动回写准确结果：Web 为 `http://localhost:4001/zh-CN/campaign/PR-01685`，Gateway 为 `3005` |
| 2026-06-18 10:40 +04 | 两条群消息规则修复 | 根因：Gateway LaunchAgent 未带 webhook 配置，`notifyTaskQueued()` 执行时被 `missing LARK_WEBHOOK_URL` 静默跳过；已改为读取 `LARK_CONFIG_PATH`，并记录 queued / result webhook 发送日志 |
| 2026-06-18 11:03 +04 | 人话卡片与时间复验 | 收到卡片将端口查询归纳为 `PR-01685 项目状态，以及运行的端口`；完成卡片结果为 `已完成。正在运行中，端口号：4001...`；两张卡片均追加纯时间 note |
| 2026-06-18 11:17 +04 | 复杂文档任务防误判 | `文档：检查 PR-01685 Lark 自动链路...端口状态...` 曾被端口关键词误判为运行状态查询；公共 Worker 已增加命令前缀识别，`文档 / 修复 / 自测 / API / QA` 不再走端口快捷回复，命令类任务也不能兜底假成功 |
| 2026-06-18 11:29 +04 | 富文本图片任务根因复盘 | 真实群图片任务 `这里的样式与 UI 稿不一致，修复它` 曾因只保留文字、缺页面/UI 定位而等待 Codex 超时；此前“快速要求补信息”的处理方向错误，正确方案是用项目配置推断 PR-01685，并把 Lark 图片下载为本地附件交给 Codex 执行 |
| 2026-06-18 11:43 +04 | 图片读取链路修复 | Gateway 已支持从项目配置读取 `project/title/appSecret`，并可从真实事件 header 自动使用 `app_id`；对 Lark post 图片先记录 `imageKey/width/height`，有应用凭证时自动下载到 `<PROJECT>/agent/lark-attachments/<messageId>/` 并写入 `localPath`；Worker prompt 会把项目、文档、附件路径传给 Codex，不再因文字简短直接失败 |
| 2026-06-18 12:01 +04 | 图片读取配置验证 | mock 图片任务入队后 task 已带 `project=PR-01685`、`projectTitle=Campaign 活动落地页` 和图片 `imageKey/width/height`；当前未下载图片的原因是配置只有 webhook 签名 `secret`，它不是 Lark 应用 `appSecret`；真实事件可提供 `app_id`，但仍需要 `appSecret` 才能换取 `tenant_access_token` 下载图片 |
| 2026-06-18 13:38 +04 | 图片读取错误精确化 | mock 事件带 `header.app_id=cli_aaac1c2af0b89eea` 后，Gateway task 已记录项目上下文和图片元数据，下载失败原因精确为 `missing LARK_APP_SECRET`；说明当前无需每个项目手写 `appId`，但必须补 Lark 应用 `appSecret` |
| 2026-06-19 15:31 +04 | Lark PRD / QA 只读同步 | `lark-sources.json` 已填入真实 Wiki 链接；首次执行同步命令时 `lark-cli` 返回 `config/not_configured`；随后已完成本机配置、Keychain 降级和联网验证，但 Bot 读取返回 `app_scope_not_applied`，缺 `docx:document` / `docx:document:readonly`；用户态授权返回应用待审批 |
| 2026-06-19 15:47 +04 | Lark PRD / QA 同步成功 | Lark 应用权限审批通过后，执行 `sync-lark-docs.mjs` 成功同步真实 PRD / QA 到 `inbox/lark-sync/`；已更新 README、功能清单、API / 埋点边界文档 |
| 2026-06-16 | Webhook dry-run / real send | 已通过，记录在 `notification-log.md` |
| 2026-06-16 | Bot Gateway health / challenge / notify | 本地验证通过，记录在 `notification-log.md` |
| 2026-06-16 | quick tunnel | 需要按需重启并更新 Lark 控制台请求地址 |

## 6. 自动工作运行条件

要让 PR-01685 群内 @ Lark 应用持续自动工作，必须同时保持：

1. 本机 Koa Bot Gateway 在线：当前由 LaunchAgent `com.fameex.pr01685.lark-gateway` 常驻。
2. 公网回调 tunnel 在线：当前由 LaunchAgent `com.fameex.pr01685.cloudflared` 常驻。
3. Lark 控制台事件订阅请求地址指向当前 tunnel：`https://ears-labs-pasta-concerns.trycloudflare.com/lark/events`。
4. PR-01685 Worker 在线：当前由 LaunchAgent `com.fameex.pr01685.lark-worker` 常驻；只做单次验证时使用 `node apps/web/docs_tdd/PR-01685/agent/scripts/lark-worker.mjs --once`。
5. 自定义机器人 webhook 环境变量可用，确保入队回执和完成结果能回群。
6. 真实群上线前必须在 Gateway 运行环境配置 `LARK_ALLOWED_CHAT_IDS` 和 `LARK_ALLOWED_OPEN_IDS`；为空时仅适合本地 mock / 验证。
7. 如需读取群消息图片，项目配置 `agent/scripts/pr-01685.json` 或 Gateway 环境必须配置 Lark 应用 `appSecret` / `LARK_APP_SECRET`；真实 Lark 事件 header 里有 `app_id` 时可自动使用，`appId` / `LARK_APP_ID` 只作为兜底配置。只配置 webhook 和 webhook 签名 `secret` 只能发消息，不能下载图片。

当前已配置只限制 PR-01685 真实群：`LARK_ALLOWED_CHAT_IDS=oc_51e2bcf0ed6a772c402d6cacd43176b3`，`LARK_ALLOWED_OPEN_IDS` 留空。

两条群消息规则已强制：真实群 @ 入队后先发「已收到 Lark 任务」，Worker 回写后再发「Lark 任务完成 / 失败」。Gateway 当前通过 `LARK_CONFIG_PATH=/Users/aven/github/fameex-web/apps/web/docs_tdd/PR-01685/agent/scripts/pr-01685.json` 读取 webhook 配置，并在日志中记录 `[Lark webhook queued sent]` 与 `[Lark webhook result sent]`。

卡片文案规则已同步：收到卡片不直接展示原始 @ 文本，而是归纳成「PR-01685 项目状态，以及运行的端口」；完成卡片结果直接说明「已完成。正在运行中，端口号：4001...」。两张卡片底部都追加 Lark `note` 时间，格式为 `YYYY/M/D HH:mm:ss`。

富文本图片任务规则已同步：Gateway 会把 Lark post 图片附件的 `imageKey`、宽高记录进 task；项目配置提供 Lark 应用 `appSecret`（或环境变量 `LARK_APP_SECRET`）时，还会结合事件 `app_id` 下载图片到 `agent/lark-attachments/<messageId>/` 并把 `localPath` 写进 task。Worker 必须结合项目编号、项目文档、代码和图片附件执行；不能仅因群消息文字简短就失败。若只配置 webhook 而未配置 Lark 应用 `appSecret`，则只能拿到 `imageKey`，无法下载图片二进制，这是图片读取凭证缺失，不是任务信息不足。

当前 quick tunnel 是临时地址；如果进程重启或地址变化，需要把新的 `/lark/events` 地址更新到 Lark 控制台，否则真实群 @ 不会进入本机 Gateway。

## 7. 还需要确认的信息

- Lark 控制台当前事件订阅请求地址已配置为本轮 tunnel：`https://ears-labs-pasta-concerns.trycloudflare.com/lark/events`。
- PR-01685 正式协作群 `chat_id` 已确认并配置；当前策略为只限制群，不限制群内用户。
- 是否需要把 quick tunnel 升级为稳定公网域名 / 常驻服务；否则每次 tunnel 变化都要手动更新 Lark 控制台。
- 是否允许 Worker 常驻运行并处理 `文档 / 修复 / 自测 / QA / 状态` 全部类型，还是先只开放低风险的 `状态 / 文档`。

## 8. 项目特有边界

- `vtkj 群` 是 PR-01685 活动落地页协作群的内部称呼，不是 Lark 官方概念。
- 群内 @ 任务只处理 PR-01685 Campaign / docs_tdd 相关内容；超出范围需先确认。
- Worker 必须使用默认 Codex 沙箱；涉及 commit、push、生产数据、密钥、依赖安装或超出 PR-01685 范围的任务，必须停止并回群请求确认。
- 群任务完成后，结果摘要写群里；验证命令、diff、截图、长日志写入本地文档或通知记录。
