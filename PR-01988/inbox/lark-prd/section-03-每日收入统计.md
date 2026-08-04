# **每日收入统计**

位置：管理后台 → 预测市场 → 每日收入统计。按自然日聚合三类收入与成本，输出毛利，支持近7日/近30日/自定义区间与报表导出。

![The image shows the "每日收入统计" (Daily Income Statistics) page of the management backend prototype. It displays four key figures: $42,180 (Total Income), $31,540 (User Income), $6,210 (Polymarket Fee), and $4,430 (Gas Fee). Below these figures, there is a blue bar chart representing daily profit trends. At the bottom, there is a table titled "每日收入明细" (Daily Income Details) with columns including Date, Total Income, User Income, Polymarket Fee, Gas Fee, and others, showing data from 2022-05-17.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YjFhZDYyODVhMTVhOGQ2YWFkMTk3ZWY4ZmFiMGFiNmNfODI4Zjk0ODIwZDBlNGQ2YzRlMmQ1ODJmMzFhNWE0NmNfSUQ6NzY1MDg0MzMzMjQ1MjYzNDMzNF8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)

*图 3-1　每日收入统计页（管理后台原型）：KPI 卡、每日毛利趋势、收入明细、Polymarket 手续费口径*

**收入与成本口径**

**核心原则：所有金额按订单/成交逐笔记账后汇总，不按“成交额 × 比率”估算。其中 Polymarket 手续费必须取自每一笔链上成交回执返回的实际手续费逐笔累加，因其随成交价 p 非线性变化（见 3.2），用估算会产生系统性偏差。**

| **项目** | **方向** | **口径（逐笔记账后汇总）** |
|-|-|-|
| 买入加价收入 | 收入 | Σ_买入订单 (单笔买入加价收入)，按每笔买入订单累加 |
| 卖出抽水收入 | 收入 | Σ_卖出订单 (单笔卖出抽水收入)，链上卖出≤1U 的订单豁免不计 |
| 结算抽水收入 | 收入 | Σ_结算订单 (结算抽水收入)，统计盈利订单的结算抽水收入 |
| Polymarket 手续费 | 成本 | Σ_成交 fee_actual：逐笔取链上成交回执返回的实际手续费累加，不按成交额估算（见 3.2）  <br/>仅 taker 订单有手续费：  <br/>买入手续费 = 交易金额 × feeRate × (1 - 成交价)  <br/>卖出手续费 = 卖出份额 × feeRate × 成交价 × (1 - 成交价) |
| 链上 Gas  <br/>（poly 目前免 gas，预留） | 成本 | Σ_交易 实际 Gas(POL) 折算 USDT，逐笔累加 |
| 利润 | 结果 | sum（买入加价收入+卖出抽水收入+结算抽水收入） |

*毛利计算逻辑：毛利 = (Σ买入加价收入 + Σ卖出抽水收入 + Σ结算抽水收入) 。各项均为“逐笔记账 → 按日/区间汇总”，PM手续费与 Gas 以链上回执/交易实际值为准，保证毛利可被财务逐笔复算、可审计对账。*



**后台其他字段**

<table><colgroup><col/><col/></colgroup><tbody><tr><td><b>元素</b></td><td><b>定义</b></td></tr><tr><td>时间筛选</td><td><ol><li seq="1">近7日/近 15 日/近30日/自定义区间（选择起止日）</li><li>统计按自然日聚合，单日口径为UTC+8 00:00:00–23:59:59。</li></ol></td></tr><tr><td> 汇总卡片</td><td><ol><li seq="1">区间总收入<ol><li seq="1">所选时间区间内的总收入</li></ol></li><li>买入加价收入及占比<ol><li seq="1">所选时间区间内的买入加价收入，及占比</li><li>占比=买入加价收入 / 总收入，四舍五入保留小数点后两位</li></ol></li><li>卖出抽水收入及占比<ol><li seq="1">所选时间区间内的卖出抽水收入，及占比</li><li>占比=卖出抽水收入 / 总收入，四舍五入保留小数点后两位</li></ol></li><li>结算抽水收入及占比<ol><li seq="1">所选时间区间内的结算抽水收入，及占比</li><li>占比=结算抽水收入 / 总收入，四舍五入保留小数点后两位</li></ol></li></ol></td></tr><tr><td>毛利趋势图</td><td><ol><li seq="1">按日柱状图，展示所选区间内每日利润走势。</li></ol></td></tr><tr><td colspan="2"><b>每日明细表</b></td></tr><tr><td>导出</td><td>支持按当前筛选区间导出报表（CSV）。</td></tr><tr><td>订单数</td><td>展示汇总订单数、及买入/卖出/结算订单数<br/>汇总订单数=买入+卖出+结算订单</td></tr><tr><td>成交额</td><td>成交额= 买入成交额+卖出成交额<br/>买入成交额=买入份额*单价<br/>卖出成交额=卖出份额*单价</td></tr><tr><td>买入加价</td><td>∑买入加价收入</td></tr><tr><td>卖出抽水</td><td>∑卖出抽水收入</td></tr><tr><td>结算抽水</td><td>∑结算抽水收入</td></tr><tr><td>PM 手续费</td><td>∑PM手续费</td></tr><tr><td>Gas</td><td>∑Gas 费用</td></tr><tr><td>毛利</td><td>∑毛利（买入加价收入+卖出抽水收入+结算抽水收入）</td></tr></tbody></table>





**参考资料：**

**Polymarket 手续费精确定义**

**结论：手续费不是固定的“0–2%”，而是 Polymarket 协议在撮合时按公式实时计算并只向 Taker（吃单方）收取。平台在链上是 Taker，故该费用计入平台成本。**

计算公式：fee = C × feeRate × p × (1 − p)，其中 C = 成交份额数量，p = 成交价格（0–1）。因此费用在 p=0.5 时最高、向两端对称递减，与“成交价值×固定比例”不同。

*能否在成交结果中返回手续费：能。费用由协议在撮合时确定，成交回执/成交记录会返回该笔实际手续费。因此成本核算口径固定为：每笔链上成交完成时，将回执返回的实际手续费(fee_actual)随该成交落库，按日/区间对 fee_actual 逐笔累加得到 Polymarket 手续费总成本——不按“成交额 × 估算费率”计算。getClobMarketInfo(conditionID) 返回的 fd = { r: feeRate, e: exponent, to: takerOnly } 仅用于下单前预估与展示，不作为入账依据；feesEnabled=false 的市场不收费。*

落库要求：成交/订单记录新增字段 pm_fee_actual（该笔实际手续费, USDC, 8位精度）与 fee_tx_hash（手续费所在成交哈希），作为收入统计与对账的唯一可信来源；埋点 polymarket_buy_result / polymarket_sell_result 的结果事件一并上报 pm_fee_actual。

**各类别 Taker 费率（来自 Polymarket 费用文档）**

| **市场类别** | **Taker feeRate** | **50% 价格时每100份费用** | **Maker 返利** |
|-|-|-|-|
| 加密 | 0.07 | \$1.75 | 20% |
| 体育 | 0.03 | \$0.75 | 25% |
| 金融 / 政治 / 科技 / Mentions | 0.04 | \$1.00 | 25% |
| 经济 / 文化 / 天气 / 其他 | 0.05 | \$1.25 | 25% |
| 地缘政治 / 世界事件 | 0 | \$0 | —（零费用） |

*费用以 USDC 计、精度 5 位小数，最小 0.00001 USDC，更小金额舍为 0。Maker 不收费。*





