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
- 只接受白名单群和白名单用户。
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
