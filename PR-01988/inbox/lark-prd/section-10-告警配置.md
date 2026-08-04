# **告警配置**

![The image shows the告警配置 interface. It includes USDC and POL balance alerts with thresholds: USDC balance < $10,000 is emergency (notify top-up) and < $50,000 is warning (notify operations); POL balance < 10 POL is emergency (notify top-up) and < 50 POL is warning (notify operations). There are also 3 and 5 as unknown parameters. A new alert configuration for 0.1 balance is marked as warning. The notification channel is Lark, with a webhook link provided. This relates to the context of migrating hard-coded alert thresholds to a backend-configurable system via Lark notifications.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MGI1M2I5NGY2ZDFlNGM1ZjAyMzBlMDQ0M2JiYmQxODhfNDEyYjUxNDg3ZmIzMjY1MGNhYWNhZTVlNWJmZDA0ODZfSUQ6NzY1MzA5MzkwMDk0MDIzNDQ2MF8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)

将一期硬编码的告警阈值迁移为后台可配置，统一通过 Lark 通知。（新建 lark 群）

1. 钱包余额告警

| **监控项** | **阈值(默认)** | **级别** | **处理方式** |
|-|-|-|-|
| USDC 余额 | < \$10,000 | 紧急 | 通知补资 |
| USDC 余额 | < \$50,000 | 警告 | 通知运营 |
| ~~POL 余额~~ | ~~< 10 POL~~ | ~~紧急~~ | ~~通知补资~~ |
| ~~POL 余额~~ | ~~< 50 POL~~ | ~~警告~~ | ~~通知运营~~ |

*监控频率：每分钟一次。*

1. 下单失败告警

- 连续失败次数阈值（默认 3）+ 统计窗口（默认 5 分钟）；达阈值触发紧急告警并可选自动暂停该事件交易。
- ~~异常冻结解冻重试：3 次解冻失败 → Lark 告警，提示需人工 SQL 处理（对齐需求文档 5.2）。~~

1. 持仓差异告警配置

将持仓差异告警的阈值与行为也纳入后台可配置（此前仅在对账逻辑中硬编码）。

| **配置项** | **默认值** | **说明** |
|-|-|-|
| 差异率告警阈值 | 0.1% | 差异率 = \|交易所持仓 − 链上持仓\| / 链上持仓，超过即触发 |
| ~~最小对账差异（豁免阈值）~~ | ~~5 %~~ | ~~差额小于该值不告警、不平账，避免噪声~~![The image shows the formula for calculating the reconciliation difference, which is "对账差异 = \| 用户侧 - 链上侧 \|/链上侧". This formula is related to the告警配置 section in the document, where the minimum reconciliation difference (exemption threshold) is set to 5%, and the difference less than this value will not trigger an alarm or be settled, to avoid noise.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NDNkZWIyZjA4NTAwMDBiYjM1MDUwZWM2NWMzYTZhZTZfZWQ3NjIxYjkyNWM0MTA2NjdjY2RhMzc5MmZkMTk3NDJfSUQ6NzY1MzA4OTMwODU2MzIzMDQ0MF8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM) |
| ~~对账频率~~ | ~~5 分钟~~ | ~~自然周期~~ |
| 触发后动作 | Lark 告警 + 标记待平账 | 可选：仅 Lark 告警 |



*告警内容包含：事件名、交易所持仓、钱包持仓、差值（对齐需求文档 7.1 步骤4）。*

1. **通知渠道**

- Lark 群机器人 Webhook 可配置、可开关；紧急告警支持 @所有人。
- ~~提供“发送测试告警”按钮验证连通性。~~

*（说明：原“最近告警记录”页面已按需求移除，告警留痕由各告警源系统侧记录。）*

---

