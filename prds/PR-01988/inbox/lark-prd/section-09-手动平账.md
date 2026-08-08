# **手动平账**

![The image shows the interface of the manual平账 process in the prediction market system. It displays key information such as the number of unsettled transactions (4), the latest time (10:32:15), the total settlement amount (312.5), and the number of today's settled transactions (7). There is a list of settlement records, including details like the event name, transaction direction, settlement amount, settlement price, settlement ratio, settlement action, status, and operations. This interface is related to the manual平账 logic described in the context, which involves adjusting platform wallet chain head寸 without generating new user orders.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MGRlYjg2ODI5OWYwM2JkODAyNmI5MTkzMmVhOTVhMDNfOWNlNmQzNDFmNTdjN2NjZDBlZDhkOTljMWVkMDkwNzRfSUQ6NzY0OTc2ODI0MDAyOTE0Mjc1MV8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)



1. 触发逻辑

   1. 5 分钟自动对账发现差异率 > {阈值} 并触发 Lark 告警后，若差异无法自然消解，运营/技术在后台手动发起平账。平账过程不产生新的用户订单，仅调整平台钱包链上头寸。
2. 平账逻辑（以 Yes 为为例）

| **条件** | **动作** |
|-|-|
| 交易所内份额 > 链上份额 | 链上买入差额；买入份额=交易所−链上；价格=该事件卖一价 |
| 交易所内份额 < 链上份额 | 链上卖出差额；卖出份额=\|交易所−链上\|；价格=该事件买一价 |

1. 平账逻辑

   - 挂单方式：盘口价市价单，直到达到目标份额停止。
   - 低于配置阈值的份额差异不执行平账。
   - NO 方向逻辑对称处理。
2. 操作流程

   1. 系统展示持仓差异列表：事件/方向、交易所持仓、链上持仓、差值、差异率、建议动作。
   2. 运营点击“平账”，弹窗展示动作、挂单价格、FOK 方式，二次确认。
   3. 执行后记录平账单（非用户订单）：操作人、动作、成交份额、哈希、结果。
   4. 平账完成后下一周期对账复核，差异率回落至阈值内则关闭告警。
3. 手动平账记录

   1. 新增手动平账记录，留痕“谁、在什么时间、做了什么、是否完成”，用于审计与复盘。
   2. 记录支持导出。

| **字段** | **说明** |
|-|-|
| 平账单ID | 唯一标识，非用户订单 |
| 事件 / 方向 | 平账目标事件与方向 |
| 动作 | 链上买入/卖出 + 份额 |
| 挂单价格 | 卖一价（买入）/ 买一价（卖出） |
| 操作人 | 发起平账的运营/技术账号 |
| 发起时间 | 点击确认执行的时间 |
| 完成时间 | 平账成交完成时间（未完成为空） |
| 结果 / 状态 | 执行中 / 已完成 / 失败（FOK 未成交，可重新发起） |







