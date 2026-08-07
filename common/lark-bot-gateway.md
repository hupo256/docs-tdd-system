# Lark Bot Gateway 与 Worker 规则

> 本文描述群内 @ 应用触发开发任务的完整链路。  
> 主动发阶段通知的 webhook 规则见 [collaboration-and-notifications.md](./collaboration-and-notifications.md)。

## 1. 基础链路

```text
Lark 群 @应用
  ↓
Lark 事件订阅 im.message.receive_v1
  ↓
Bot Gateway 校验、解析、幂等入队
  ↓
Codex / Cursor Worker 领取任务
  ↓
读取 docs_tdd 与当前项目代码
  ↓
按任务类型改文档 / 改代码 / 自测 / 输出差异
  ↓
回群通知结果并记录通知日志
```

## 2. Bot Gateway 要求

Bot Gateway 是独立服务，不放进 `apps/web` 运行时。它负责：

- 处理 Lark challenge。
- 校验签名、encrypt key、verification token。
- 只接受白名单群和白名单用户。信任边界是**白名单群**：群内 QA / PM / 后台 @ 都能触发，群消息只按群放行、不按发送人过滤；p2p 直发才按白名单用户放行。**推荐动态成员制 `allowedChatIds:"auto"`**：白名单 = bot 当前所在的群（`im +chat-list`），新群拉进去即时响应、无需改配置或重启（未知 chat 首次 @ 自动刷新再判）。**fail-closed 硬规则**：完全没配任何白名单（`allowedChatIds` 非 `"auto"` 且群 + 用户皆空）时拒绝所有事件，绝不因配置漏填而放行所有人。
- 只处理群内 @ 应用消息，普通群聊默认忽略。
- 使用 `message_id` 做幂等，避免重复执行。
- 将消息解析为 Job，写入任务队列。
- 提供任务领取、任务状态回写和群通知能力。

图片读取要求：

- 自定义机器人 `webhookUrl/secret` 只能发群消息，不能读取 Lark 消息里的图片内容。
- 需要读取群消息图片时，项目配置或 Gateway 环境必须提供 Lark 应用凭证：`appSecret` 或 `LARK_APP_SECRET` 必填；`appId` / `LARK_APP_ID` 可选，真实 Lark 事件 header 里有 `app_id` 时可自动使用。
- Gateway 收到 post 图片后必须用应用凭证换取 `tenant_access_token`，再按 `image_key` 下载图片，保存到 `<PROJECT-ID>/agent/lark-attachments/<messageId>/`，并把 `localPath` 写入 task。
- 若缺少应用凭证，task 必须保留 `imageKey/width/height/downloadError`，失败原因应写成图片读取凭证缺失，不能写成任务信息不足。

## 3. 推荐命令类型

群内 @ 应用时，建议把意图写清楚：

```text
@Codex 文档：整理 docs_tdd，补充 QA 用例流程
@Codex 修复：/xxx 页面 light 模式背景色不对
@Codex 自测：跑页面桌面和 390px 移动端
@Codex API：根据 Swagger 校准 service 和 mock
@Codex QA：比对 QA 用例与 PRD 差异
@Codex 状态：汇总当前分支、未提交变更、验证结果
```

支持的通用类型：

- `文档 / docs`：只改文档或补规则。
- `修复 / fix`：修 bug 或 UI 偏差。
- `自测 / test`：运行验证并汇总结果。
- `API / api`：校准接口、schema、mapper、mock。
- `QA / qa`：比对 QA 用例、执行回归。
- `状态 / status`：只读状态并回群。

不清晰的消息只回复需要补充的信息，不自动猜测执行。

## 4. Job 字段

Job 至少包含：

| 字段 | 说明 |
|------|------|
| `jobId` | 任务 id |
| `source` | 固定为 `lark` |
| `chatId` | 来源群 |
| `messageId` | Lark 消息 id，用于幂等 |
| `operator` | 触发人 |
| `project` | 项目名 / 当前需求 |
| `commandType` | `docs / fix / test / api / qa / status` |
| `rawText` | 原始消息摘要 |
| `scope` | 影响范围 |
| `approvalRequired` | 是否需要人工确认 |
| `createdAt` | 创建时间 |

## 5. Worker 执行规则

Codex / Cursor Worker 领取任务后：

1. 先读取 `apps/web/docs_tdd/AGENTS.md`、`CONTEXT.md`、`common/README.md` 和当前项目文档。
2. 按命令类型决定只改文档、改代码、跑自测或输出差异。
3. 改代码前先更新必要文档或任务说明。
4. 代码变更后运行触达文件 Biome。
5. UI / 交互变更后验证桌面、390px H5、dark / light。
6. 输出 diff 摘要、验证结果、风险和待确认项。
7. 完成后回群通知结果，并写入通知记录。
8. 除非命令明确允许并经过确认，否则不自动 commit、push、开 PR。

## 6. 群内 @ 应用自动生成 Task 策略

群里有人 @ 应用后，系统必须先生成 task，再由 Worker 执行；不得让群消息直接驱动无记录的代码修改。

### 6.1 Task 生命周期

| 状态 | 含义 | 下一步 |
|------|------|--------|
| `received` | Gateway 收到 Lark 事件并通过签名、白名单、幂等校验 | 解析命令 |
| `queued` | 已生成 Job 并入队 | Worker 领取 |
| `triaging` | Worker 正在读取 docs_tdd、分支状态和影响范围 | 判断是否可自动执行 |
| `waiting_confirmation` | 范围、PRD、API、QA、登录账号、权限、环境或其他材料存在需人工确认 / 补充项 | 自动发送待确认 / 补信息通知，尽量 @ 具体责任人，回群等确认 |
| `running` | 已开始改文档 / 代码 / 自测 | 持续记录进展 |
| `verifying` | 已完成修改，正在跑 Biome、测试、Browser / Playwright | 生成验证摘要 |
| `done` | 完成并回群汇报 | 写通知记录 |
| `blocked` | 无法继续，需要外部资料或权限 | 回群说明阻塞 |
| `failed` | 执行异常或命令失败 | 回群说明失败和下一步 |

### 6.2 解析规则

Gateway / Worker 至少提取：

- 任务类型：`docs / fix / test / api / qa / status`。
- 项目范围：优先从消息中的项目名、PR 号、路由、文档路径推断；推断不到则回群询问。
- 目标文件或页面：如 `/tradfi`、`apps/web/src/apps/TradFi`、`docs_tdd/common`。
- 附件内容：post 富文本里的图片必须进入 task，例如 `imageKey`、`width`、`height`；能配置 Lark 应用凭证时必须下载成 `localPath`，让 Codex / Worker 可以直接看图。
- 是否需要确认：涉及 scope 裁剪、真实环境、敏感信息、提交发布动作时必须确认。
- 责任人：优先从 @ 对象、消息上下文、项目文档负责人字段、QA / API / 设计归属推断；无法推断时标记为项目负责人 / 群内负责人。
- 回群线程：使用原消息 thread / message id 作为汇报目标，避免刷屏。

### 6.3 自动执行边界

白名单群 + 白名单用户 + 当前项目范围内，以下可自动执行：

- 文档补充、格式修正、状态同步。
- 小范围 bug 修复、UI 偏差修复、测试补充。
- 运行本地验证命令、Browser / Playwright 自测。
- 输出 QA / PRD / Figma 差异清单。

以下只生成 task，不自动执行，必须先回群确认：

- 需求 scope 不清或与 `00-feature-inventory.md` 冲突。
- 缺 PRD、Figma、API 样例、QA 用例、登录账号、账号权限、测试环境、后台配置或验收数据。
- 需要新增全局设计 token、公共架构调整或跨项目重构。
- 需要读取生产数据、密钥、账号、Cookie 或内网敏感地址。
- 需要安装依赖、push、commit、开 PR、部署、改 CI/CD。
- 任务影响范围超出当前 `apps/web` 或当前 feature。

进入上述任一场景时，Worker 必须把 task 状态置为 `waiting_confirmation`，并自动发送待确认 / 补信息通知。通知里要写清缺什么、影响哪个阶段、需要谁处理；能识别责任人时必须 @ 具体人，不能识别时 @ 项目负责人 / 群内负责人。**已落地实现**：AI 结构化结果（`lark-ai-result.schema.json`）status 支持 `waiting_confirmation`，并可带 `blockers`（逐条列缺什么）、`owner`（推断责任人 / 角色）；Worker 原样回写该状态（不跑规范闸、不提交改动）并把 `owner` 随状态回写带给 Gateway；Gateway `handleStatusUpdate` 对 `waiting_confirmation` / `blocked` 发**橙色独立回执卡**（区别于绿/红的完成/失败卡）。**责任人 @ 落地**（`resolveOwnerMention`）：AI 自报 `owner`（角色 / 关键词）命中项目配置 `config.ownerMap`（`角色/关键词 → open_id`，可选表）则 `<at>` 对应责任人；未命中则回落 `<at>` 触发人（`task.operator`）并注明「未在责任人表识别，暂 @ 提单人」；bug 表任务无触发人则仅发群（不硬失败）。**续任务闭环**（`store.resumeWithSupplement`）：用户对一条仍卡在 `waiting_confirmation` / `blocked` 的原任务回复补料时，Gateway 复用**原任务**（append 补料到 `task.text` + 合并新附件 + 复用同 `task.id` → `resolveWorkContext` 算出同一分支/worktree），置回 `queued` 续跑并 bump `epoch`，而非新建孤儿任务。**关键约束**：AI 遇缺材料严禁猜测生成文案 / 默认值硬做，也严禁误判成 `failed`；`failed` 只留给工具 / 环境 / 权限等技术性失败。

### 6.4 完成后汇报策略

Worker 完成后必须回群，并写入项目通知记录。回群内容固定为：

```text
标题：[<项目>] Lark 任务完成 / 阻塞 / 失败
任务：@应用消息摘要
结果：已完成。
1. 大众能直接理解的完成项；
2. 现在产生的效果。
```

规则：

- 群消息字段不要编号，例如不要写 `1. 任务`、`2. 结果`。
- `结果` 字段内先写完成状态，再用数字小结列出“做了什么、现在是什么效果”。
- 不贴 diff 全文和长日志。
- 任务 ID、触达文件、验证命令、失败命令输出写入项目文档或任务记录，不放进普通完成消息。
- 如果失败，群消息只说明失败类型和下一步；详细错误写入任务记录。
- 如果失败，必须说明是工具失败、环境失败、权限失败还是需求不清。
- **AI 退出但未显式回写 done/failed 时，一律判 `failed`（待人工复核），不分任务类型都不得兜底谎报「已完成」**——无回写 = 无验证 = 不可信（AI 可能中途放弃/崩溃/未按要求回调 Gateway）。
- 图片 / 视觉任务不能因为文字简短就快速失败；项目配置已经提供项目编号和标题，Worker 必须结合当前项目文档、代码、PRD / Figma 资料和图片附件自动定位。只有 Lark 图片下载凭证缺失、图片下载失败、代码不可访问等技术原因，才能回写 failed，并明确说明具体技术卡点。

## 7. 必须等待确认

以下任务必须先回群等待确认，不自动执行：

- QA 用例与 PRD 不一致，需要决定以谁为准。
- API 文档与当前 Mock / PRD 冲突。
- 需要 commit、push、开 PR 或改公共配置。
- 需要新增或修改全局设计 token / Tailwind preset。
- 需要访问生产环境、真实用户数据、敏感配置或外网安装依赖。
- 请求范围超出当前项目。
- 消息中要求读取、输出或提交密钥。

## 8. 可自动执行

在白名单群、白名单用户、当前项目范围内，可自动执行：

- 读取 Lark PRD、Wiki、Swagger、QA 用例。
- 读取 `apps/web/docs_tdd/**`、Figma 记录和当前项目代码。
- 修改 `apps/web/docs_tdd/**` 文档。
- 修改当前项目相关前端代码。
- 对触达 JS / TS / JSON 文件运行 Biome。
- 启动本地 dev server 并用 Browser / Playwright 自测。
- 回群回复阶段结果、缺信息项和验证摘要。

## 9. 回复策略

收到任务后先回群确认已接收：

```text
标题：[项目名] 已收到 Lark 任务
内容：@应用消息摘要
状态：已收到，正在排队处理
```

硬规则：入队回执和完成 / 失败回执必须是两条独立群消息。Gateway 入队成功后立即发送「已收到 Lark 任务」；Worker 回写 `done` / `failed` 后再发送「Lark 任务完成 / 失败」。不得只在任务完成后发一条消息，也不得用完成消息替代收到回执。

防复发要求：

- Gateway 运行环境必须带有可发送群消息的 webhook 配置，或能读取项目级 Lark 配置文件；否则不能标记为真实群接入完成。
- 入队回执、完成回执的 webhook 发送结果必须写日志；`skipped`、非 0 code、网络失败都要记录原因。
- 验收群内 @ 自动任务时，必须检查日志里同时出现 queued sent 和 result sent，或在群里确认收到两条消息。
- 两条回群卡片底部都必须带时间 note(时间行格式见 [lark-active-notification.md](./lark-active-notification.md) §5)。
- 回群文案必须说人话：收到任务时把原始 @ 消息归纳成项目成员能理解的任务摘要；完成任务时写实际结果，不把原始命令、技术 fallback 或内部状态直接丢给群成员。
- 内容简单时一句话即可；有多项说明时在同一字段内拆成 `1.`、`2.` 编号。

完成后回群：

```text
标题：[项目名] Lark 任务完成
任务：<原始任务摘要>
结果：已完成。
1. <完成项>；
2. <当前效果>
```

## 10. 阻塞超时处理

门禁等待确认期间，Worker 应做到：

- G2 等待产品确认超过 1 个工作日：回群标记"仍在等待 G2 确认，阻塞编码"，不自动推进。
- G5 API 联调阻塞：挂起当前任务，输出阻塞原因，等待负责人重新触发。
- 任何需要等待确认的事项：保留当前文档状态，不猜测继续写代码。

## 11. 项目级配置要求

需要群内 @ 应用触发任务的项目，`<PROJECT-ID>/agent/` 下必须包含：

- 事件订阅配置说明。
- Bot Gateway 白名单（群 id、用户 id）。
- 任务队列接入方式。
- Worker 处理边界（可处理哪些命令类型、哪些需确认）。
- 通知记录位置（`agent/notification-log.md`）。

项目级 `agent/scripts/lark-worker.mjs` 必须是薄包装，只调用 `common/agent-scripts/lark-worker.mjs` 并传入项目编号、项目名称和需要读取的项目文档。Gateway 轮询、任务领取、Codex prompt、状态回写、空任务失败处理和兜底完成消息都由公共 Worker 维护；不得在项目目录复制完整 Worker 实现。

AI 执行器只允许 `claude` / `codex`，优先级为：task > `LARK_AI_EXECUTOR` > `lark-bot.local.json.aiExecutor` > wrapper > `claude`。群消息开头 `[codex]` / `[claude]` 可单次覆盖，外部投递可传 `aiExecutor`；未知值拒绝，入队即解析，排队/结果卡均显示实际执行器。可用 `codexModel` / `codexReasoningEffort` 固定本 Worker 的 Codex 模型/推理强度，不影响其它会话。

Codex 两阶段均为 `ephemeral + approval never + 工具网络关闭`：先把按任务抽取的现有 L1/L3 规则交给 `read-only` 分析，前后校验 git 状态；`blocked` 直接回群，只有 `ready` 才把规则原文和分析结论交给 `workspace-write` 实现。图片走 `--image`，结构化结果由 Worker 回写；Claude 保持 callback，但同样接收精准规则上下文。

审计写入 `<PROJECT>/agent/lark-audits/<taskId>.json/.log`：记录附件、规则来源/指纹、分析/最终结果、Gateway 状态和 CLI 输出；该目录已 gitignore。

## 12. 当前实现：lark-cli 长连接（替代公网 tunnel）

历史上 Gateway 是独立 Koa 服务，靠公网 cloudflared tunnel 收 Lark 事件回调并做 challenge / 验签。当前推荐实现改为 **lark-cli 官方长连接**，`common/agent-scripts/lark-gateway.mjs` 是本地专用 Gateway：

- 事件源：子进程 `lark-cli event consume im.message.receive_v1`（长连接），不再需要公网 tunnel、challenge 端点、手写签名校验。event bus 守护进程实测约 35MB。
- HTTP 契约：`GET /lark/health|tasks`、`POST /lark/tasks|tasks/next|tasks/:id/claim|tasks/:id/status|tasks/:id/retry|tasks/prune`；状态接口接受 done/failed/blocked/waiting_confirmation，触发对应卡片，仅 done 回写 bug 表。状态回写带领取时的 `epoch`（fencing token），与当前不匹配返回 **409**（旧 worker 迟到回写被拒，不覆盖新一代执行）。`POST /lark/tasks` 缺失/无效项目号一律 `project=null`（与 ingest 口径统一），走 adhoc 临时 worktree，不塞 Gateway 主项目常驻 worktree。`retry` 重置 failed/blocked 为 queued，`prune` 清陈旧终态（默认 done）。
- 发消息、下载图片、读写多维表格统一走 lark-cli 已登录的 bot 身份（keychain）；配置文件里不放 app 级 `appSecret`。图片经 `lark-cli im +messages-resources-download` 落到 `<PROJECT>/agent/lark-attachments/<messageId>/`。
- 上线前置：Lark 后台开启事件订阅 `im.message.receive_v1` 并授 `im:message.p2p_msg:readonly` + 群消息收发 / `im:resource` / bitable 相关 scope；白名单 `allowedChatIds` / `allowedOpenIds` 与 `botOpenId` 写入项目配置。
- 相关脚本：接收链路 `common/agent-scripts/lark-gateway.mjs`；bug 多维表格链路 `common/agent-scripts/lark-bugtable-poller.mjs`（`base +record-list` 拉「负责人=我 且 状态=待处理」→ 投递 Gateway 队列 → done 后 `base +record-batch-update` 回写状态）。
- **健壮性兜底**（无人值守必需）：
  - **领取租约 + AI 超时启动断言**：`claimNext` 领走任务时盖 `claimedAt`，超过 `LARK_TASK_LEASE_MS`（默认 40min）仍 `running` 视为孤儿（worker 崩了），下次领取时自动重入队。worker 启动即断言 `LARK_WORKER_AI_TIMEOUT_MS < LARK_TASK_LEASE_MS`，不满足拒绝启动——焊死「孤儿回收不与活着的 AI 双跑同一 worktree」这条唯一防线。
  - **毒任务死信 cap**：孤儿重投达 `LARK_MAX_REQUEUE`（默认 2）转 `failed` 死信、打 `deadLetterReason`、发一次告警卡，停止自动重投交人工；人工 `retry` 达 `LARK_MAX_RETRY`（默认 5）拒绝并提示 clean。防 crash 型 bug 绕过闭环无限烧钱。
  - **claim epoch / fencing token**：孤儿重投 / 人工 retry 递增 `task.epoch`，claim 返回基线，worker 回写带 `epoch`；`handleStatusUpdate` epoch 不匹配返回 409（缺省不校验，向后兼容）。防旧 worker 迟到回写覆盖新一代执行。
  - **事件摄入同步占位防 TOCTOU**：`ingestLarkEvent` 在任何 await 前用内存 `ingestingMessageIds` Set 同步占位，只有首个能进 ingest，持久化后交去重；堵 lark-cli 重投同一事件时并发双跑同一 messageId。
  - **持久化原子写 + 损坏隔离**：`persist` 走 `writeFileSync(.tmp)+renameSync` 原子替换；启动恢复遇非法 JSON 改名 `.corrupt` 并告警，不静默 continue 丢单。
  - **子进程超时**：所有 `lark-cli` 调用带 `LARK_CLI_TIMEOUT_MS`（默认 60s）超时，到点 SIGTERM→3s 后 SIGKILL，避免卡网/卡登录永久挂起。worker 的 AI 进程超时同样升级到 SIGKILL。
  - **AI 启动预检**：每种 executor 首次执行前先检查 CLI；Codex 额外检查 `codex login status`，缺二进制/登录态直接回写 failed，不等跑到半途。AI 超时用 `LARK_WORKER_AI_TIMEOUT_MS`（默认 30min；兼容旧 `LARK_WORKER_CODEX_TIMEOUT_MS`）。
  - **重连告警滑动窗口 + 事件静默探活**：退避延迟计数（稳定存活归零）与告警判定（`restartWindow` 滑动窗口，默认 `LARK_RECONNECT_ALERT_WINDOW_MS=10min`）解耦——「每 61s 抖一次」这类持续掉线也能告警。consumer 死亡或事件静默超 `LARK_EVENT_STALE_MS`（默认 30min，仅曾收到事件后判）时 `/lark/health` 返回 **503** 供外部探活。
  - **/lark/health 观测增强**：补 `consumerDetail`（lastEventAt / 窗口抖动数 / alerted / backoff）、`oldestQueuedAgeMs`、`minLeaseRemainingMs`、`deadLetters`、`topRequeued`（各状态计数与卡住任务 id 之外）。
  - **本地 API 鉴权（可选）**：配置 `LARK_GATEWAY_SECRET` 后，所有写操作 POST 必须带 `x-lark-gateway-secret`（worker/poller 从同名环境变量读取）；`readBody` 有 1MB 上限。未配置则仅靠 127.0.0.1 绑定兜底。
  - **附件文件名 sanitize、状态白名单校验**：`imageKey` 拼本地路径前清路径分隔符；`/status` 只接受合法生命周期状态。
  - **命令类型解析 + 只读分流**（`parseCommandType`）：Gateway 摄入时按任务首行前缀（`状态/status`、`文档/docs`、`修复/fix`、`自测/test`、`api`、`qa`）落 `task.commandType`。worker 对**只读命令**（`status`）走轻量分流：本地无 worktree 时不新建临时 worktree（省下 `git worktree add + origin/online` 拉取），直接在主仓只读回答、跳过 WIP 提交与代码提交闸；Codex 用 `read-only` 沙箱。
  - **失败分级 failureKind + nextStep**（`lark-ai-result.schema.json` / worker `classifyWorkerFailure`）：AI 结构化 `failed` 可带 `failureKind`（`tool/env/permission/requirement`）与 `nextStep`；worker 侧对 preflight / 超时 / exit code 分别归因（超时→tool、登录/权限→permission、ENOENT/worktree/git→env），回执列「失败类型 + 下一步」，替代恒定的「Worker 执行异常」。
  - **续任务闭环 + owner @ 落地**：见 §6.2——补料复用原任务续跑（`resumeWithSupplement`）、`owner` 命中 `config.ownerMap` 则 @ 责任人（`resolveOwnerMention`）。
- **规则上下文（多标签 + 缺章告警）**（`lib/lark-rule-context.mjs`）：`classifyLarkTask` 由「单一胜出」改**多标签叠加**（如 ui+api 同时命中就都产出 scenario，`refsFor` 按标签并集加载规则）；**有图片附件或 `fix` 命令强制并入 UI+STYLE 信号**（视觉/修复类常只写「字段 / 背景 / 不对」易被误判成纯 API 任务丢样式 token 规则）；`extractMarkdownSection` 抽到空段（源文档改了标题 → 规则被静默丢弃）时 `console.warn` + 记 `warnings`/audit，不静默 continue。

## 13. bug 表链路：跨项目路由 + 按需轮询

bug 表按 `项目ID` 跨项目路由，与群 @ 共用 `resolveWorkContext`：

- 项目号须通过 `(PR|PM)-\d{3,}` 校验：自由文本提取用带词边界的 `\b(PR|PM)-\d{3,}\b`（`matchProjectId`，`SUPR-01947` 不吞出 `PR-01947`），整串校验用 `isProjectId`；群任务按“群名 > 正文 > adhoc”解析，poller 与群链路共用同一正则，Gateway/Worker 双重拦截非法路径。
- 已有 worktree 时先隔离既存 WIP，done 后提交本次改动；失败/阻塞不提交，提交失败保留现场。
- 无 worktree 时基于 `origin/online` 建 `hotfix/<项目ID|adhoc>-<id>`；仅 done 提交并清理，失败/阻塞有半成品则保留，无改动可删除。
- 引用消息由 `messages-mget` 合并；`[Image: img_xxx]` / `![Image](img_xxx)` 占位会恢复、去重，并按实际项目下载。
- 仅 bug 表来源的 done 任务回写表格；**回写成功才置 `done`**，回写失败置中间态 `done_pending_writeback`（poller 视作 in-flight，不入队、不 seen），Gateway 每 5min 重试回写直至一致——消除「群报完成 + 表格永卡待处理」。活动状态跳过，blocked/waiting_confirmation 等人工补料，failed 计入 `stuck-failed`；三者均不自动重跑。
- **failed 人工重触发闭环**：群 @ 任务可直接重新 @（新 messageId 天然是新任务）；bug 表任务 id=record_id 固定、POST 幂等会命中旧 failed，只能显式重置 —— `lark-bot failed` 列出待处理失败项，`lark-bot retry <id>` 把 failed/blocked 重置为 queued（`retryCount++`、补发「已重新入队」卡片），worker 下一轮重跑。**不做自动重试**（避免对修不动的 bug 无限烧钱）。
- poller 由 `lark-bot poll-on/off` 控制，空闲 `LARK_BUGTABLE_IDLE_OFF_MS` 后自动停止；G6/G7 提醒开启，G8 提醒关闭。
- **陈旧终态清理**：Gateway 每小时自动清 `updatedAt` 早于 `pruneDoneAfterHours`（默认 24h）的 `done` 任务，`/lark/health` 计数不再单调增长；`lark-bot clean [hours]` 手动立即清 done，`lark-bot clean --failed [hours]` 一并清 failed/blocked。**failed 默认不自动删**：删掉后 bug 表若仍待处理，poller 下一轮会把它当新任务重投 = 变相自动重试，故 failed 只在人工确认后 `clean --failed` 或 `retry`。

## 14. Worker 并行调度（按 worktree）

worker 不再是单串行循环，而是**按目标 worktree 并行**的调度器：

- **调度键 = `resolveWorkContext(task).cwd`**。同一 worktree（同项目、或同 adhoc 分支）的任务**串行**（并发 AI 在同目录改文件会打架）；不同 worktree 的任务**并行**。
- **并发上限** `LARK_WORKER_CONCURRENCY`（默认 3）。调度循环：`inFlight`（Map，key=cwd）未满时，`GET /lark/tasks` 列出 queued/received 按 createdAt 升序，挑第一个「cwd 未在飞」的任务，`POST /lark/tasks/:id/claim` 原子领取（返回 null 表示被并发领走/状态已变，下一轮重来），启动 `runTask` 并在 `finally` 里 `inFlight.delete(cwd)`。
- **`--once`** 保持旧单次语义（领一个最老 pending 跑完退出）。
- **临时 worktree 提速**：`prepareTempWorktree` 建好后 `linkNodeModules` 把主仓的 node_modules（根 + `apps/*` + `packages/*`，pnpm monorepo 每包各一份）**软链**进临时目录，免 `pnpm install`（重建整棵符号链接树很慢）。临时 worktree 基于 `origin/online`、依赖集与主仓一致，Node 经目录软链 realpath 解析进主仓 store。软链失败只 warn（claude 可自行装依赖兜底）。
- **验证分级**：L1 样式/文案只跑 diff-check、触达文件 Biome 和已有直接测试，不跑 type-check；L2 逻辑/类型、L3 契约/共享改动才跑触达包 type-check。临时 worktree 用已软链的 `.bin`，Vitest 加 `--no-cache`；同一检查最多一次，必需项完成即收尾。
- **编码规范双保险**：① prompt 里让 claude 先读 `~/.ai-rules/skills/coding-quality/SKILL.md` + 按 `rule-router.md` 加载 L3，并内联最易踩红线（禁 arbitrary value、颜色必须用真实 preset token）；② **无人值守规范闸**（`lib/lark-lint-diff.mjs` + worker `enforceCodeQuality`）：任务成功、提交前扫本次 **diff 新增行**的违规，命中先让 AI **定向纠正一次**，仍残留则写进 commit message（`⚠ N 处未修正规范问题`）供人工 review。覆盖：arbitrary value（`rounded-[8px]`…含 `ring/outline/aspect/columns/indent/content` 前缀）、失效裸色类（`text-green` 等 Tailwind 静默丢弃的未知类）、裸 `any`（`as any`/`: any`/`<any>`，限 TS）、i18n 动态 key（`t(变量)`/模板插值）、JSX 文本硬编码中文。降噪：Tailwind 类只在 className 语境（引号内/`@apply`）判、跳过纯注释行、一行多违规经 `matchAll` 全列。只扫 `+` 行、不碰存量债。
- **done 可信度交叉校验**（`lark-worker.mjs` `detectChangeTier`/`crossCheckChangedFiles`/`assessDoneResult`）：AI 回写 done 后，用真实 `git diff --name-only HEAD` 交叉校验 AI 自报 `changedFiles`——**done 但工作区零改动直接降级 failed 需人工复核**（无改动=无修复=不可信；状态/status 只读任务豁免）；命中 `*.schema.*`/`mapper`/`/api/`/`*.d.ts`/跨包 `packages/` 即 L2+，AI 自报 checks 不含 type-check、或漏报/虚报改动文件 → 挂人工可见 `⚠` note（非阻塞）。

> git `worktree add/remove` 走 spawnSync 同步执行、本就互不交错，无需额外锁；并行的是各任务的 AI executor 运行。
> 规范闸是**代码级兜底**（不依赖哪个 AI 写的），补 prompt 自律之不足；团队级全局 lint 仍按项目节奏另议。
