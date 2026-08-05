# Lark 主动通知规则

> 本文描述 G0-G8 阶段进度、阻塞和补信息的主动发群消息规则。  
> 群内 @ 应用触发任务的完整链路见 [lark-bot-gateway.md](./lark-bot-gateway.md)。

## 1. 职责边界

主动通知用于把项目状态推送到群里，不用于接收任务。

| 能力 | 用途 | 是否依赖本文 |
|------|------|--------------|
| 自定义机器人 webhook | 主动发送 G0-G8 阶段进度、阻塞、补信息、交付摘要（默认通道） | 是 |
| bot `im +messages-send` | 同上，改用已登录 bot 身份直发卡片（`notifyTransport:'bot'`，无需 webhook secret；见 §11） | 是 |
| Lark 应用事件订阅 | 群内 @ 应用后生成 task，进入 Bot Gateway / Worker | 否，见 `lark-bot-gateway.md` |

Webhook / bot 通道只能发消息；不能冒充群内 @ 应用接收链路。

## 2. 项目级配置放置

每个项目只在 `<PROJECT-ID>/agent/` 下保留差异信息：

```text
<PROJECT-ID>/agent/
  lark-integration.md       # 项目启用状态、配置路径、标题、记录位置
  notification-log.md       # 实际发送记录
  scripts/
    <PROJECT-ID>.json       # 本机 webhookUrl / secret / project / title，禁止提交公开仓库
    notify-lark.mjs         # 只做薄包装，调用 common/agent-scripts/notify-lark.mjs
```

项目文档只写：

- 是否启用主动通知。
- 配置文件路径。
- 项目标题 / 卡片标题。
- 发送命令和 dry-run 命令。
- 通知记录位置。
- 当前项目特有发送口径。

不要在项目文档重复整份 G0-G8、签名算法、消息格式和安全边界；这些继承本文。

硬规则：项目级 `notify-lark.mjs` 不允许复制整份消息模板。新项目只能创建薄包装入口，调用 `apps/web/docs_tdd/common/agent-scripts/notify-lark.mjs`，并通过 `--config` 或默认配置文件传入项目差异。若公共消息格式调整，只能改公共脚本和公共规则，不能在单个项目里私改卡片字段顺序、字段名或编号规则。

## 3. 配置文件约定

推荐 JSON 字段：

```json
{
  "project": "<PROJECT-ID>",
  "title": "<项目短名>",
  "webhookUrl": "https://open.larksuite.com/...",
  "secret": "...",
  "autoNotify": true,
  "notifyTransport": "webhook",
  "notifyChatId": "oc_...",
  "notifyOnGate": false
}
```

通道字段（见 §11）：

- `notifyTransport`：`'webhook'`（默认）或 `'bot'`。为 `'bot'` 时走 lark-cli 已登录 bot 身份直发，无需 `webhookUrl`/`secret`。
- `notifyChatId`：bot 通道目标群；缺省回落 `allowedChatIds[0]`。
- `notifyOnGate`：是否在 `docs-tdd gate` 通过后自动播报「Gx 已完成」。默认关，逐项目 opt-in。

安全规则：

- `webhookUrl`、`secret`、App Secret、OAuth token 只放本机 ignored 路径。
- dry-run 输出必须脱敏 `sign`、secret、webhook URL。
- 群消息和交付摘要不得出现 webhook、secret、token、账号、Cookie、内网地址。
- 配置缺失时只能 dry-run，不假装已通知。

## 4. 签名与 payload

自定义机器人开启签名校验时，payload 需要携带：

| 字段 | 说明 |
|------|------|
| `timestamp` | Unix 时间戳（秒，字符串） |
| `sign` | `Base64(HmacSHA256(key=timestamp + "\n" + secret, data=""))` |
| `msg_type` | 固定推荐 `interactive` |
| `card` | Lark 卡片内容 |

常见失败：`msg_type need` 通常表示缺 `msg_type`、payload 结构错误或签名错误。

## 5. 命令格式

推荐项目脚本格式：

```bash
node apps/web/docs_tdd/<PROJECT-ID>/agent/scripts/notify-lark.mjs <G0-G8> [状态] [说明] [--dry-run] [--config <path>]
```

消息时间行规则：只展示时间值，不加“时间”标签或其他汉字，格式为 `YYYY/M/D HH:mm:ss`，例如 `2026/6/16 18:52:11`；该行使用 Lark 卡片 `note` 元素展示，避免 `lark_md` 忽略 hex 色值导致颜色不生效。

项目级薄包装示例：

```js
#!/usr/bin/env node

import { runNotifyLark } from '../../../common/agent-scripts/notify-lark.mjs'

runNotifyLark({
  defaultConfigPath: 'apps/web/docs_tdd/<PROJECT-ID>/agent/scripts/<project-id>.json',
}).catch((error) => {
  console.error(error.message)
  process.exit(1)
})
```

状态建议支持：

```text
已完成 / 阻塞中 / 待确认 / 进行中 / 跳过
```

别名建议：

```text
完成 -> 已完成
阻塞 -> 阻塞中
```

发送失败处理：

- 网络 / sandbox `fetch failed`：按权限规则重试一次，需要外网时申请提升权限。
- webhook 返回非 0 code：记录 failed 和返回摘要，检查配置 / 签名 / payload。
- 重试成功：记录首次失败和最终成功，不刷重复群消息。

## 6. G0-G8 默认门禁

| 门禁 | 含义 | 建议状态 |
|------|------|----------|
| G0 | 资料接收 | 进行中 / 已完成 / 阻塞中 |
| G1 | 文档生成 | 进行中 / 已完成 / 阻塞中 |
| G2 | 方案确认 | 待确认 / 已完成 / 阻塞中 |
| G3 | API 与 Mock 准备 | 待确认 / 已完成 / 阻塞中 |
| G4 | 开发实现 | 进行中 / 已完成 / 阻塞中 |
| G5 | 接口联调 | 进行中 / 已完成 / 阻塞中 |
| G6 | 自测验收 | 待确认 / 已完成 / 阻塞中 |
| G7 | QA 用例回归 | 待确认 / 已完成 / 跳过 / 阻塞中 |
| G8 | 交付 | 待确认 / 已完成 / 阻塞中 |

## 7. 卡片格式

推荐 interactive 卡片字段：

```text
标题：[<ticket>] <项目短名>
当前阶段：<门禁含义>-<状态> <状态图标>
下一阶段：<下一门禁含义>
说明：<简短摘要，必要时编号>
<note><本地时间></note>
```

字段顺序固定为：`当前阶段` → `下一阶段` → `说明` → `note 时间`。旧字段名 `阶段` 不再使用；时间不写 `时间：` 标签，只用 Lark `note` 元素显示纯时间值。

标题色建议：

| 状态 | 标题色 |
|------|--------|
| 已完成 | green |
| 阻塞中 | red |
| 待确认 | yellow |
| 进行中 | blue |
| 跳过 | grey |

## 8. 多项内容必须编号

同一个字段如果包含多项说明、多个结论或多个待办，必须拆成数字编号，不能挤在同一行。适用字段包括但不限于：说明、结果、待办、待确认、风险。

示例：

```text
说明：
1. 格式校验：当前阶段与下一阶段字段已更新；
2. 请确认 C 端展示范围、Admin 是否同做、API 字段与 AB 分组来源。
```

项目脚本应支持用中文或英文分号（`；` / `;`）拆分多项说明，并自动生成编号列表。最后一项用句号收尾，前面各项用分号收尾。

## 9. 发送与记录

每次真实发送后，必须写入 `<PROJECT-ID>/agent/notification-log.md`：

| 字段 | 说明 |
|------|------|
| 时间 | 本地时间 |
| 门禁 | G0-G8 或 Lark Job |
| 状态 | 进行中 / 已完成 / 阻塞中 / 待确认 / 跳过 |
| 摘要 | 群消息摘要 |
| 方式 | real / dry-run / manual |
| 结果 | success / failed / skipped |

规则：

- dry-run 不算已通知。
- 同一门禁同一状态不重复发，除非内容有实质变化。
- 发送失败必须记录 failed 和原因；重试成功要写清首次失败和最终成功。
- 群消息只放摘要，详细差异、API 响应、命令输出写项目文档。

## 10. 待确认 / 补信息通知

遇到以下情况必须主动通知，不等用户追问：

- scope、PRD、Figma、API、QA 用例冲突。
- 缺 PRD、Figma、API 样例、QA 用例、登录账号、权限、环境、后台配置或验收数据。
- 自测 / 联调 / QA 被外部条件阻塞。
- 需要安装依赖、访问外网、操作生产环境、commit / push / 开 PR 等高风险动作。

通知必须写清：

- 当前卡在哪个项目 / 门禁。
- 已完成什么。
- 需要谁确认或补什么。
- 下一步等待什么。

## 11. bot 通道与阶段推进自动播报

### 11.1 bot 通道（`notifyTransport:'bot'`）

除自定义机器人 webhook 外，`notify-lark.mjs` 支持用 lark-cli 已登录的 bot 身份直发同款 interactive 卡片：

- 触发：config `notifyTransport === 'bot'`（缺省 / 其它值 = webhook，既有项目行为不变）。
- 目标群：`notifyChatId`，缺省回落 `allowedChatIds[0]`；二者皆缺则报错。
- 底层：`lark-cli im +messages-send --msg-type interactive --content <card>`；卡片体与 webhook 完全一致（`createPayload().card`），签名字段不参与。
- 优点：不需 webhook secret；缺点：依赖本机 lark-cli 已登录 + bot 在群内。

### 11.2 gate 通过自动播报（`notifyOnGate:true`）

`docs-tdd.mjs gate <PID> <Gx>` **机器校验通过（exit 0）** 时，自动发一张「Gx 已完成」卡片，无需手动 `notify-lark`。

- **opt-in**：仅当项目 config `notifyOnGate === true` 才发；默认关，其它项目不受影响。
- **仅通过时发**：gate 失败 / `changed` / `context` 等命令都不发。
- **非阻塞**：播报失败只 warn，绝不改 gate 退出码。
- **幂等防刷群**：幂等键 = `<PID>-<Gx>-<sha1(gate 指纹)[:12]>`，走 `--idempotency-key` 服务端去重；同代码状态重复跑同一 gate 不重复发。
- **通道**：复用 §11.1 的 `notifyTransport`。
- **实现坑**：`docs-tdd.mjs` 里 spawn 的是**项目薄包装** `notify-lark.mjs`，不能直调 common 脚本（软链主守卫恒 false，见 `lark-bot-gateway.md`）。

命令行入口（bot 通道加了）：`--idempotency-key <key>`（仅 `notifyTransport:'bot'` 生效）。`docs-tdd.mjs`/`notify-lark.mjs` 是按需 CLI，改完即生效，无需重启常驻。
