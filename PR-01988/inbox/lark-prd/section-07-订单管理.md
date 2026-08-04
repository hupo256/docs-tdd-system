# **订单管理**

位置：管理后台 → 预测市场 → 订单管理。对齐需求文档 5.8 的订单字段定义，订单ID 与哈希一一对应用于链上对账。

<sheet sheet-id="BhbHBU" token="LkAHsB6jIhYU02tdtETl4qBmgmf"></sheet>



![The image shows the order management page of the prediction market system. It displays key metrics such as total orders (3,418), success rate (98.6%), total transaction amount ($184,920), and pending orders (23). The order list includes columns like order ID, UID, event/no, type, amount, platform income, creation time, hash, and status. Some orders are marked as "success" (green) and "failed" (red), with details like event (Yes/No), type (buy/sell/settle), and creation time. This corresponds to the context describing the order management page with search conditions and order list features.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YzMxMzc0NWZkMThjOTJmYTJiZGU5ZWQ1Zjg2NDc4YTBfYzRlNGUwMGMxNTIyMjU2OTEzNGNkNTM2YWRhMWNmZGFfSUQ6NzY0OTc2NjI2Mjg1NTM3MjUxMl8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)

*图 5-1　订单管理页：检索条件、订单列表（订单ID/哈希、类型、金额、平台收入、状态）*

1. 列表搜索项

   1. 支持按：类型（买入/卖出/结算）、状态（成功/失败/成交中）、UID、订单ID、哈希、创建时间区间、成交时间区间检索；支持导出 CSV。
2. 列表字段

| **字段** | **取值** | **说明** |
|-|-|-|
| 订单ID / 哈希 | 字符串 | 一一对应，哈希可跳转 Polygonscan |
| UID | 字符串 | 下单用户 |
| 事件 / 方向 | 文本 / yes·no | 事件名 + 买卖方向 |
| 类型 | 买入/卖出/结算 | 订单类型 |
| 金额(USDT) | 数值 | 买入显示用户下单金额；卖出/结算显示返还金额 |
| 份额 | 数值 | 链上返回份额 |
| 平台收入 | 数值 | 按类型归集到对应收入账户 |
| 创建/成交时间 | 时间 | 下单时间 / 成交成功时间 |
| 状态 | 成交中/成功/失败 | 失败订单冻结资金自动退回现货账户  <br/>成功：订单完成  <br/>失败：订单失败  <br/>结算中：结算订单，结算中  <br/>成功：  <br/>失败：  <br/>结算中： |



