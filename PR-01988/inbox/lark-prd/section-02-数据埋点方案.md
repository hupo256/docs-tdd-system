# **数据埋点方案**

**公共字段**

| **字段** | **类型** | **说明** |
|-|-|-|
| uid | string | 用户ID（未登录为匿名 device_id） |
| event_id | string | Polymarket 事件ID |
| direction | enum | yes / no |
| source | enum | web / app |
| channel | string | 渠道/入口来源 |
| ts | long | 客户端/服务端时间戳(ms) |



*资金相关事件追加字段：amount（下注金额）、shares（份额）、markup_rate（加价率）、order_id、hash、status。*

**关键点位清单**

**前端**

| **点位ID** | **触发时机** | **类型** | **参数** |
|-|-|-|-|
| polymarket_list_expose | 预测事件列表页曝光 | 曝光 | first_level_tab：一级菜单的英文名称second_level_tab：二级菜单的英文名称 |
| polymarket_event_click | 点击进入市场详情 | 点击 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID |
| polymarket_buy_submit | 点击买入 | 点击 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>amount：带上用户实际的下注金额  <br/>direction：yes / no |
| polymarket_buy_result | 买入成交/失败回执 | 结果 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>amount：带上用户实际的下注金额  <br/>direction：yes / no |
| polymarket_sell_submit | 点击卖出 | 点击 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>amount：带上用户实际的下注金额  <br/>direction：yes / no |
| polymarket_sell_result | 卖出成交/失败回执 | 结果 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>amount：带上用户实际的下注金额  <br/>direction：yes / no |
| polymarket_faq_click | 点击常见问题 | 点击 |  |

**后端**

| **点位ID** | **触发时机** | **类型** | **参数** |
|-|-|-|-|
| polymarket_buy_result | 买入成交 / 失败回执 | 结果 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>amount：带上用户实际的下注金额  <br/>direction：yes / no |
| polymarket_sell_result | 卖出成交 / 失败回执 | 结果 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>amount：带上用户实际的下注金额  <br/>direction：yes / no |
| polymarket_settle | 事件结算入账 | 结果 | event_id：Polymarket 事件ID  <br/>event_slug：Polymarket 事件slug  <br/>market_id：Polymarket 市场ID  <br/>direction：yes / no  <br/>win_loss: win为用户胜利，loss 为用户失败  <br/>amount：用户胜利获取/失败损失的金额 |

