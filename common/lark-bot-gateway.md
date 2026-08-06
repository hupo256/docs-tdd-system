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

进入上述任一场景时，Worker 必须把 task 状态置为 `waiting_confirmation`，并自动发送待确认 / 补信息通知。通知里要写清缺什么、影响哪个阶段、需要谁处理；能识别责任人时必须 @ 具体人，不能识别时 @ 项目负责人 / 群内负责人。该通知不同于「收到任务」和「任务完成」消息，具体 UI 格式后续在 `collaboration-and-notifications.md` 定义。

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

AI 执行器只允许 `claude` / `codex`，优先级为：task > `LARK_AI_EXECUTOR` > `lark-bot.local.json.aiExecutor` > wrapper > `claude`。群消息开头 `[codex]` / `[claude]` 可单次覆盖，外部投递可传 `aiExecutor`；未知值拒绝，结果卡显示实际执行器。本机可用 `codexModel` / `codexReasoningEffort` 固定 Lark Worker 的 Codex 模型与推理强度，不影响其它 Codex 会话。

Codex 使用 `codex exec`：`ephemeral + workspace-write + approval never + 工具网络关闭`。Prompt 走 stdin，图片走 `--image`；最终结果按 `common/schemas/lark-ai-result.schema.json` 输出，由 Worker 回写 Gateway，不使用全放权参数。Claude 保持既有 callback。

## 12. 当前实现：lark-cli 长连接（替代公网 tunnel）

历史上 Gateway 是独立 Koa 服务，靠公网 cloudflared tunnel 收 Lark 事件回调并做 challenge / 验签。当前推荐实现改为 **lark-cli 官方长连接**，`common/agent-scripts/lark-gateway.mjs` 是本地专用 Gateway：

- 事件源：子进程 `lark-cli event consume im.message.receive_v1`（长连接），不再需要公网 tunnel、challenge 端点、手写签名校验。event bus 守护进程实测约 35MB。
- 对外仍暴露 §5 Worker 依赖的本地 HTTP 契约：`GET /lark/health`、`GET /lark/tasks`、`POST /lark/tasks`（外部投递，如 bug 表轮询器）、`POST /lark/tasks/next`（领取最老 queued，pending→running）、`POST /lark/tasks/:id/claim`（**按 id 原子领取**，供并行调度器挑选空闲 worktree 的任务）、`POST /lark/tasks/:id/status`（回写 done/failed，触发回群 + bug 表回写）。
- 发消息、下载图片、读写多维表格统一走 lark-cli 已登录的 bot 身份（keychain）；配置文件里不放 app 级 `appSecret`。图片经 `lark-cli im +messages-resources-download` 落到 `<PROJECT>/agent/lark-attachments/<messageId>/`。
- 上线前置：Lark 后台开启事件订阅 `im.message.receive_v1` 并授 `im:message.p2p_msg:readonly` + 群消息收发 / `im:resource` / bitable 相关 scope；白名单 `allowedChatIds` / `allowedOpenIds` 与 `botOpenId` 写入项目配置。
- 相关脚本：接收链路 `common/agent-scripts/lark-gateway.mjs`；bug 多维表格链路 `common/agent-scripts/lark-bugtable-poller.mjs`（`base +record-list` 拉「负责人=我 且 状态=待处理」→ 投递 Gateway 队列 → done 后 `base +record-batch-update` 回写状态）。
- **健壮性兜底**（无人值守必需）：
  - **领取租约**：`claimNext` 领走任务时盖 `claimedAt`，超过 `LARK_TASK_LEASE_MS`（默认 40min，须 > worker AI 超时 30min）仍 `running` 视为孤儿（worker 崩了），下次领取时自动重入队；`GET /lark/health` 暴露各状态计数与卡住任务 id。
  - **子进程超时**：所有 `lark-cli` 调用带 `LARK_CLI_TIMEOUT_MS`（默认 60s）超时，到点 SIGTERM→3s 后 SIGKILL，避免卡网/卡登录永久挂起。worker 的 AI 进程超时同样升级到 SIGKILL。
  - **AI 启动预检**：每种 executor 首次执行前先检查 CLI；Codex 额外检查 `codex login status`，缺二进制/登录态直接回写 failed，不等跑到半途。AI 超时用 `LARK_WORKER_AI_TIMEOUT_MS`（默认 30min；兼容旧 `LARK_WORKER_CODEX_TIMEOUT_MS`）。
  - **本地 API 鉴权（可选）**：配置 `LARK_GATEWAY_SECRET` 后，所有写操作 POST 必须带 `x-lark-gateway-secret`（worker/poller 从同名环境变量读取）；`readBody` 有 1MB 上限。未配置则仅靠 127.0.0.1 绑定兜底。
  - **附件文件名 sanitize、状态白名单校验**：`imageKey` 拼本地路径前清路径分隔符；`/status` 只接受合法生命周期状态。

## 13. bug 表链路：跨项目路由 + 按需轮询

bug 多维表格通常是**全公司共享表**，同一负责人的 bug 横跨多个项目。故 bug 链路按 **`项目ID` 列**路由，不绑单一项目：

- **poller** 读配置 `bugTable.projectField`（默认 `项目ID`）→ `POST /lark/tasks` 带 `project`。Gateway 入队时 `project: body.project || config.project`（不再硬编码覆盖）。**`项目ID` 单元格必须先过 `(PR|PM)-\d{3,}` 校验**才作为 `project`；异常值（如 `../../x`）不传，交由 worker 走 adhoc 临时 worktree。worker 的 `resolveWorkContext` 也会用 `safeProject` 二次校验（project 会拼进 worktree 路径与分支名，防越目录）。
- **worker** `resolveWorkContext(workerConfig, task)` 按 `task.project` 决定 cwd：
  - `/Users/aven/github/<项目ID>` 有 worktree → 在该 worktree 改；**进来时若已有未提交 WIP 先 `commitPreexistingWip` 单独提交一笔隔离**（标明"非本任务产生"），再跑 AI；任务**真 done** 后 `finalizeExistingWorktree` 把本任务改动 `git add -A && commit --no-verify` 到**当前分支**（每任务一个独立 commit；失败/阻塞不提交、无改动不提交、commit 失败保留改动在工作区）。→ 你的 WIP 与 bot 改动分成两个 commit，不混。
  - 无 worktree → **一次性临时 worktree**（`git worktree add` 到 `~/github/.lark-hotfix/<slug>`，基于 `origin/online` 建 `hotfix/<项目ID>-<id>` 分支；`prepareTempWorktree` 建、`finalizeTempWorktree` 收尾：有改动本地提交到分支+删目录，无改动连空分支删）。**不碰主仓**，天然无并发/顺序碰撞，无常驻 worktree 蔓延；
  - 无 `project` → 同样临时 worktree，分支 `hotfix/adhoc-<id>`。
- **群 @ 任务同源路由**：能力2 与能力3 共用 `resolveWorkContext`。项目号解析优先级 `resolveProject` = **群名 `[PR-xxxxx]`（权威）> 正文 `PR-####` > 都无则 null**（不再套 config.project）。群名优先是因为每个项目建一个群、群名带编号，而正文常引用别的工单号（只读正文会路由错项目）；`resolveChatName` 调 `lark-cli im +chat-list`（`data.chats[].name`）建缓存。差别仅：只有 `source:'lark-bugtable'` 的 task done 后回写表格。
- **无 worktree / 无项目号的处理**：@ 任务解析到项目号但本地无 worktree（或压根没项目号）→ **直接建一次性临时 worktree** 修（不再发「请选择处理方式」按钮卡片；分支 `hotfix/<项目ID|adhoc>-<msgId尾8位>`，尾部取值避免同群 messageId 共享前缀导致分支撞车）。「已收到」卡片带说明。poller 任务同理直接临时 worktree。（早前的 `card.action.trigger` 按钮澄清流程已移除。）
- **引用/回复消息合并**：@ 时若在别人的消息下回复（`reply_to`/`root_id`），真正内容多在父消息里。gateway `fetchReferencedContext` 用 `lark-cli im +messages-mget` 拉父消息，文本（含 `merge_forward` 合并转发的可读 content）+ 图片 image_key 合并进 task，再交给 worker。否则「看这里」类回复式 @ 会因无落点 failed。
- **回写健壮**：`writeBackBugRecord` 带重试；`doneValue` 缺失跳过不写（不写非法枚举）；重试仍失败发群告警，避免「已报完成 + 已 seen 不再捞 + 表格永卡待处理」静默不一致。
- **去重按 gateway 任务状态、非「入队即永久 seen」**：poller 每轮读 `GET /lark/tasks` 拿到 `record_id → status`，`done` 才落地本地 `seen`（跨重启防重入队）；`queued/running` 视为在处理中跳过；**`failed` 的记录不永久 seen**——群里已收到失败卡片、表格保持「待处理」待人工介入，poller 仅计数暴露（`stuck-failed=N`），不自动重跑（避免对修不动的 bug 无限重试 AI、刷群烧钱），人工可在群里重触发。这修掉了旧实现「failed 既留在表里又被本地 seen 挡住而静默消失」。
- **触发（手动轮询窗口）**：poller 不常驻，QA 密集期手动 `lark-bot poll-on` 开、`poll-off` 关；空闲 `LARK_BUGTABLE_IDLE_OFF_MS`（默认 4h）无新 bug 自动收工。进 G6/G7 的 gate 播报提醒开轮询、G8 提醒收工。

## 14. Worker 并行调度（按 worktree）

worker 不再是单串行循环，而是**按目标 worktree 并行**的调度器：

- **调度键 = `resolveWorkContext(task).cwd`**。同一 worktree（同项目、或同 adhoc 分支）的任务**串行**（并发 AI 在同目录改文件会打架）；不同 worktree 的任务**并行**。
- **并发上限** `LARK_WORKER_CONCURRENCY`（默认 3）。调度循环：`inFlight`（Map，key=cwd）未满时，`GET /lark/tasks` 列出 queued/received 按 createdAt 升序，挑第一个「cwd 未在飞」的任务，`POST /lark/tasks/:id/claim` 原子领取（返回 null 表示被并发领走/状态已变，下一轮重来），启动 `runTask` 并在 `finally` 里 `inFlight.delete(cwd)`。
- **`--once`** 保持旧单次语义（领一个最老 pending 跑完退出）。
- **临时 worktree 提速**：`prepareTempWorktree` 建好后 `linkNodeModules` 把主仓的 node_modules（根 + `apps/*` + `packages/*`，pnpm monorepo 每包各一份）**软链**进临时目录，免 `pnpm install`（重建整棵符号链接树很慢）。临时 worktree 基于 `origin/online`、依赖集与主仓一致，Node 经目录软链 realpath 解析进主仓 store。软链失败只 warn（claude 可自行装依赖兜底）。
- **验证分级**：L1 样式/文案只跑 diff-check、触达文件 Biome 和已有直接测试，不跑 type-check；L2 逻辑/类型、L3 契约/共享改动才跑触达包 type-check。临时 worktree 用已软链的 `.bin`，Vitest 加 `--no-cache`；同一检查最多一次，必需项完成即收尾。
- **编码规范双保险**：① prompt 里让 claude 先读 `~/.ai-rules/skills/coding-quality/SKILL.md` + 按 `rule-router.md` 加载 L3，并内联最易踩红线（禁 arbitrary value、颜色必须用真实 preset token）；② **无人值守规范闸**（`lib/lark-lint-diff.mjs` + worker `enforceCodeQuality`）：任务成功、提交前扫本次 **diff 新增行**的 arbitrary value（`rounded-[8px]`…）与失效裸色类（`text-green` 等 Tailwind 静默丢弃的未知类），命中先让 AI **定向纠正一次**，仍残留则写进 commit message（`⚠ N 处未修正规范问题`）供人工 review。只扫 `+` 行、不碰存量债，只对代码文件生效。

> git `worktree add/remove` 走 spawnSync 同步执行、本就互不交错，无需额外锁；并行的是各任务的 AI executor 运行。
> 规范闸是**代码级兜底**（不依赖哪个 AI 写的），补 prompt 自律之不足；团队级全局 lint 仍按项目节奏另议。
