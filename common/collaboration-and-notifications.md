# 协作、门禁与通知公共规则

> AI 主用:协作/门禁/通知的策略层。配置/签名/卡片模板细节在 [lark-active-notification.md](./lark-active-notification.md)、[lark-bot-gateway.md](./lark-bot-gateway.md)。安全边界「禁止同步」清单为硬性,勿删项。

## 1. G0-G8 是协作边界

门禁避免从 PRD 直接跳到不受控编码。详细阶段见 [workflow-gates.md](./workflow-gates.md)。硬规则:

- G1/G2 未完成前不写业务代码。
- 遇 PRD/Figma/API/QA 冲突不越门禁;先写入 `product/06-collaboration.md`。
- 阻塞门禁时先记录原因并请求确认,不继续猜测编码。

## 2. 群消息原则

Lark 主动发群 + 群内 @ 应用自动建 task 都是协作增强,非需求开发必需前置。G0/G1 文档阶段必须让决策者明确是否启用、何时启用,结论写入 `README.md`、`product/06-collaboration.md` 或 `agent/README.md`。

两能力简述:
- 主动发群:G0-G8 完成/阻塞/需补信息时自动把项目状态同步到群,减少人工转述。
- 群内 @ 应用自动建 task:把群里 bug/UI 调整/QA/自测请求转成可追踪 task,Worker 自动执行或进待确认,完成后自动回群。

默认:不配置也能正常开发;不启用时项目文档记「本期不接入 Lark 主动通知/@ 自动任务,阶段结果由人工同步」。启用主动通知继承 [lark-active-notification.md](./lark-active-notification.md);启用群内 @ 转 task 继承 [lark-bot-gateway.md](./lark-bot-gateway.md)。

**允许同步**:G0-G8 阶段状态;缺资料/待确认/阻塞;自测/QA/交付摘要;本地文档路径和已确认公开链接。

**禁止同步**:
- Webhook URL、Secret、App Secret、OAuth token。
- 测试账号、密码、Cookie。
- 私有环境内网地址。
- 过长命令输出。
- 完整 API 响应或含敏感字段的截图。
- 未确认的产品结论;只能标「待确认」或「假设」。

## 3. Lark 机器人主动发群消息策略

主动发群用于同步阶段结论,不接收任务。完整配置/签名/脚本/卡片格式/失败重试/记录规则见 [lark-active-notification.md](./lark-active-notification.md)。本节只保留发送策略总览。

### 3.1 发送时机

| 节点 | 触发条件 | 是否必须发 |
|------|----------|------------|
| G0 开始/阻塞 | 收到新需求、PRD/Figma/API 缺资料 | 有群同步要求时必须 |
| G1 完成 | 文档结构、功能清单初稿、Figma/PRD 差异已写入 | 有群同步要求时必须 |
| G2 待确认/完成 | scope 做/不做/延期需负责人确认,或已确认 | 必须 |
| G3 阻塞/完成 | API、Mock、数据样例、环境有结论 | 按项目需要 |
| G4 开始/完成 | 开始编码或主要实现完成 | 按项目需要 |
| G5 进行中/阻塞/完成 | 联调结果、环境问题、接口差异 | 必须同步阻塞 |
| G6 完成 | 自测、Browser/Playwright、命令验证完成 | 必须 |
| G7 完成/跳过/阻塞 | QA 用例结果、未提供 QA 的跳过结论,或已收到用例但环境/账号/权限阻塞 | 必须 |
| G8 交付 | 最终交付摘要、残留风险、待确认项 | 必须 |

### 3.2 消息内容

每条只发结论,不发长日志。推荐卡片字段见 [lark-active-notification.md](./lark-active-notification.md) §7。摘要至少含:

```text
标题：[<项目>] <Gx 节点> <状态>
结论：完成 / 阻塞 / 待确认 / 进行中
范围：本次覆盖的页面或接口
说明：项目成员能直接理解的简短说明
待办：需要谁确认什么；无则写「无」
```

### 3.3 去重与记录

- 同一门禁同一状态只发一次;内容有实质变化才补发。
- dry-run 只用于调试,不算通知成功。
- 每次 real 发送后必须记录到 `<PROJECT-ID>/agent/notification-log.md` 或 `agent/lark-integration.md` 的通知记录。
- 发送失败记 failed 和原因,不能在项目文档标「已通知」。

### 3.4 安全边界

- webhook URL、Secret、App Secret、OAuth token 只放本机配置,如 `.lark-fe-task/<PROJECT-ID>.json`。
- 群消息只贴本地文档相对路径、公开链接或脱敏摘要。
- 涉账号/Cookie/完整响应/内网地址/敏感截图时,只写「已记录在本地文档/待负责人查看」。

## 4. 待确认 / 补信息通知策略

Agent/Worker 在任意阶段遇需人工确认、需补资料、缺登录账号/权限、缺测试环境或外部依赖阻塞时,必须自动在群里发通知,让参与者知道任务卡在哪。

这类消息不是 G0-G8 进度消息,也不是 Lark Task 完成消息;用独立的「待确认/补信息」消息类型。具体 UI 格式后续单独定义,当前先固定触发策略和内容边界。

必须触发的场景:
- scope、PRD、Figma、API、QA 用例存在冲突,需负责人决定。
- 任意阶段缺 PRD、Figma、API 样例、QA 用例、登录账号、账号权限、测试环境、后台配置或验收数据。
- 已收到 QA 用例但因账号/权限/测试环境/后台配置/验收数据缺失无法执行;未提供 QA 用例时只记 G7 跳过,不触发阻塞。
- Worker 判断任务超出自动执行边界,进 `waiting_confirmation`。
- 自测/联调/QA 因外部环境阻塞无法继续。
- 需安装依赖、访问外网、操作生产、commit/push/开 PR 等高风险动作确认。

通知内容至少说明:
- 卡住的项目和任务/门禁。
- 需谁提供什么或确认什么;能识别责任人必须 @ 具体人,不能识别时 @ 项目/群内负责人。
- 当前已完成什么、下一步等什么。
- 相关本地文档路径或 task id。

规则:
- 不等人工来问状态;进等待确认或补信息状态时主动发。
- 通知尽量指向明确责任人;只在无法判断时才写「请项目负责人协调」。
- 同一卡点不刷屏;内容无变化时最多按项目约定做超时提醒。
- 收到确认并恢复执行后,由阶段进度消息或 Task 完成消息继续汇报。

## 5. 新需求 Lark 配置

新需求进 G0/G1 时必须先记录 Lark 协作能力启用决策。

通过 [new-project-kickoff.md](./new-project-kickoff.md) 一句话启动协议进入时,Agent 默认先完成 G0/G1 文档和 PRD 同步;发现缺 PRD/Figma/API/QA/账号/测试环境/后台配置/验收数据时必须写入 `product/06-collaboration.md`。项目已启用主动发群则同时发群索取资料,不等用户追问。

| 能力 | 是否必需 | 决策问题 | 启用后做什么 |
|------|----------|----------|--------------|
| 主动发群消息 | 否 | 是否需 Agent/脚本自动同步阶段进度、阻塞和补信息?何时启用? | 建 webhook/Lark 配置、发送脚本、消息格式、通知记录 |
| 群内 @ 应用转 task | 否 | 是否需群成员 @ 应用后自动生成 task、Worker 自动处理并回群?何时启用? | 建 Lark 事件订阅、Bot Gateway、白名单、任务队列、Worker 边界 |

只有决策为「启用」时才必须建对应项目级通知配置:

1. 在 `<PROJECT-ID>/agent/` 下登记 Lark/webhook 使用方式。
2. 用自定义机器人则提供 `agent/scripts/notify-lark.mjs` 或复用已有脚本,写明命令格式。
3. Webhook URL、Secret、App Secret、OAuth token 只放本机配置,不提交 Git。
4. `agent/lark-integration.md` 只写项目差异（配置路径、项目标题、启用状态、通知记录位置）;通用 G0-G8/签名/卡片格式继承 [lark-active-notification.md](./lark-active-notification.md)。
5. 无真实 webhook 配置时只允许 dry-run,项目文档标「通知未实际发送」。
6. 启用群内 @ 应用触发 Codex/Cursor 干活时,必须同时配 Lark 事件订阅和 Bot Gateway,不能只靠 webhook。

启用后项目文档至少含:配置路径、发送命令、dry-run 命令、G0-G8 节点发送策略、已发送通知记录位置、群内 @ 转任务的触发格式/白名单/任务队列/回群策略。

## 6. 群内 @ 应用转开发任务

已决定启用群内 @ 应用能力的项目,群里有人 @ Lark 应用反馈问题/bug/QA/自测请求时,Codex/Cursor 可响应并干活,但必须走任务化链路。

**Webhook 只能用于主动发阶段通知;响应群内 @ 必须用 Lark 应用机器人 + 事件订阅 + Bot Gateway。**

完整链路、Bot Gateway 要求、Job 字段、Worker 执行规则、自动/需确认边界、回复策略见 [lark-bot-gateway.md](./lark-bot-gateway.md)。

需群内 @ 触发任务的项目,必须在 `<PROJECT-ID>/agent/` 下建事件订阅、Bot Gateway 白名单、任务队列、Worker 处理边界的说明,并继承 `lark-bot-gateway.md`。未启用时项目文档只记「不接入 @ 自动任务,本期群反馈由人工整理为开发任务」。

## 7. 已发送通知记录

每次实际发群后必须在项目文档留轻量记录,避免重复或漏发。推荐记到 `<PROJECT-ID>/agent/lark-integration.md` 的「通知记录」小节,或独立 `agent/notification-log.md`。

| 字段 | 说明 |
| ---- | ---- |
| 时间 | 本地时间即可 |
| 门禁 | G0-G8 |
| 状态 | 进行中/完成/阻塞/待确认/补信息 |
| 摘要 | 群消息的简短说明 |
| 方式 | real/dry-run |
| 结果 | success/failed/skipped |

规则:
- 同一门禁同一状态不重复发,除非内容有实质变化。
- dry-run 不等于已通知,不能记为 real success。
- 发送失败记 failed 和原因,不假装已通知。
- 群消息只放摘要,详细差异仍写项目文档。

## 8. 消息格式

主动通知卡片完整格式见 [lark-active-notification.md](./lark-active-notification.md) §7-§8;群内 @ 应用任务完成格式见 [lark-bot-gateway.md](./lark-bot-gateway.md) §6.4。

同一条消息只放结论摘要:节点、状态、说明、时间（用 Lark `note` 元素显示纯时间值,不写 `时间：` 标签）、必要时附本地文档路径。

格式规则:
- 单项字段可写一行,如 `说明：阶段状态已更新`。
- 同一字段含多项说明/多个结论/多个待办时,必须换行并用数字编号,如 `说明：\n1. 格式校验已完成；\n2. 请确认 API 字段。`
- 主动通知字段顺序固定 `当前阶段` → `下一阶段` → `说明` → `note 时间`,时间格式 `YYYY/M/D HH:mm:ss`,作为 Lark `note` 元素单独展示。
- 面向全员的结果消息先写完成状态,再用数字小结列做了哪些、现在什么效果。如:`结果：已完成。\n1. TradFi 落地页跑马灯速度已从 40 调整为 80；\n2. 播放速度提升为原来的 2 倍。`
- 验证命令、任务 ID、diff 摘要、内部状态写入项目文档或任务记录,不放普通完成消息。

不发长日志;细节写入 `docs_tdd/<PROJECT-ID>/`。

### 8.1 多项内容必须编号

同一字段含多项说明/多个结论/多个待办时必须拆数字编号,不挤同一行。适用字段包括但不限于:说明、结果、待办、待确认、风险。

```text
说明：
1. 格式校验：当前阶段与下一阶段字段已更新；
2. 请确认 C 端展示范围、Admin 是否同做、API 字段与 AB 分组来源。
```

项目级 Lark 脚本应支持用中/英文分号（`；`/`;`）拆分多项说明并自动生成编号列表。主动通知脚本细则见 [lark-active-notification.md](./lark-active-notification.md) §8。待确认/补信息消息用独立 UI 格式,后续在本文件补充;格式定稿前至少按 §4 内容边界发纯摘要。

## 9. Webhook 使用边界

- Webhook 与 Secret 只放本地配置,不进 Git。
- 无真实 webhook 配置时只 dry-run。
- 当前项目可有自己的 `agent/scripts/notify-lark.mjs`,但消息语义和安全边界必须继承本文档。
- 未来若升级为完整 Lark 应用,仍保留 G0-G8 节点语义。
