# **事件管理**

<sheet sheet-id="Jk1D12" token="LkAHsB6jIhYU02tdtETl4qBmgmf"></sheet>

**字段说明：**

![The image shows the "添加事件" (Add Event) interface. It includes an "添加方式" (Add Method) dropdown set to "ID" and a "值" (Value) input box. Event information has "事件名称" (Event Name) as "墨西哥会赢么", "类型" (Type) as "赛事", "Slug" as "moxick_will_wim", and "分类" (Category) as "Sport". Configuration has "事件名称(英文)" (Event Name (English)) input box marked "多语言" (Multilingual). There are three "市场" (Market) input boxes also marked "多语言". Event classification has dropdowns for "一级" (Level 1), "二级" (Level 2), and "三级" (Level 3). Status options are "仅可买,不可交易" (Only Buy, Not Trade), "开启交易" (Open Trade), and "下线" (Offline). At the bottom, there are "删除" (Delete) and "确认" (Confirm) buttons.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTQwMzQ2OGJiN2Y2Nzg0NmVmZjAyNmEzZGNhM2JhNDVfODEyZTk3MjkwYWVhZjVmMjNiNGZlMThiNmJlNjAyNDJfSUQ6NzY1MzA4MDE5MDU4MjU1ODQyN18xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)

1. 添加事件，点击弹出事件添加弹窗

   1. 选择添加方式： 可通过 ID/Slug 搜索，值为必填项，点击确认进行搜索并展示事件信息
   2. 事件信息
   
      1. 事件名称：title
      2. 类型：赛事/事件
      3. Slug：PM 的 Slug
      4. 分类：PM 的大类，体育/金融...
   3. 配置（所有配置均为必填项）![The image shows a mathematical formula for calculating the reconciliation difference: "对账差异 = | 用户侧 - 链上侧 |/链上侧". This formula is related to the context of the event management in the prediction market phase II scheme, which mentions configuring the difference percentage threshold for reconciliation minimum share. The formula likely calculates the percentage difference between the user side and the chain side reconciliation values.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NjRjZjZkMzcwY2RlYmQzZjE0MmM4NDI5ODNhYzU4YjZfYzc5OTMzODEzOGY2M2NiYzJlYjYyY2U4NGY0MGIzYTJfSUQ6NzY0OTc2NDY2MDg4MjkwMjc1NF8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)
   
      1. 事件名称：英文为必填项，点击多语言可配置多语言
      
         1. **自动填入从 PM 获取的英文，及可从 PM 获取的其他多语言**
      2. 市场名称：英文为必填项，点击多语言可配置多语言
      
         1. ***自动填入从 PM 获取的英文，及可从 PM 获取的其他多语言***
      3. 事件分类：在选取上一级后，才会出现下一级的选择弹窗（如存在），每一级分类均为必填项
      
         1. 例如：一级分类体育下无二三级分类，则选择体育后，不会出现二三级分类的选择框
      4. ~~费率配置：可配置买入加价/卖出抽水/结算抽水率~~
      5. ~~对账最小份额阈值，配置差异百分比阈值~~
   
      1. 状态：上线/下线，单选
      2. 交易开关：开启/关闭，单选
2. 点击保存

   1. 校验必填项是否填写，否则对应输入框变红，并提示“请填写必填项”
3. 事件列表

<table><colgroup><col/><col/></colgroup><tbody><tr><td><b>字段</b></td><td><b>说明</b></td></tr><tr><td>事件 ID</td><td><ul><li>对应 PM 的事件 ID</li></ul></td></tr><tr><td>事件名称</td><td><ul><li>对应 PM 的事件Title</li></ul></td></tr><tr><td>类型</td><td><ul><li>根据 API 返回值判断是比赛/事件</li></ul></td></tr><tr><td>一级/二级/三级 分类</td><td><ul><li>该事件的 1/2/3 级分类</li></ul></td></tr><tr><td>上线时间</td><td><ul><li>该事件在 FA 上线的事件（+8）</li></ul></td></tr><tr><td>结算时间</td><td><ul><li>该事件的结算时间（+8）</li></ul></td></tr><tr><td><del>买入/卖出/结算rate</del></td><td><ul><li><del>加价率：买入时加价，隐性含在价格中</del></li><li><del>卖出抽水率：提前卖出时收取，链上卖出≤1U 豁免</del></li><li><del>结算抽水率：到期结算时收取，仅盈利收取</del></li></ul></td></tr><tr><td><del>对账最小份额阈值</del></td><td><ul><li><del>低于该份额的事件不参与自动对账与手动平账。</del></li></ul></td></tr><tr><td>状态</td><td><ul><li>开启交易<ul><li>前端可见，未结算，可进行交易</li></ul></li><li>下线<ul><li>前端不可见，未结算，不可进行交易</li></ul></li><li>仅可见<ul><li>仅前端可见，不可进行交易</li></ul></li></ul></td></tr><tr><td>Polymarket 状态</td><td><ul><li>同步 Polymarkte 该交易对的状态</li></ul></td></tr><tr><td><del>交易开关</del></td><td><ul><li><del>开启</del><ul><li><del>可进行交易</del></li></ul></li><li><del>关闭</del><ul><li><del>不可进行交易，交易时后端 toast“当前事件不可进行交易”</del></li></ul></li></ul></td></tr><tr><td>操作</td><td><ul><li>修改，点击弹出修改弹窗（字段同创建，不可修改 ID/slug）</li><li>下线，点击弹出二次确认“是否要下线该事件”，点击确认后进行下线</li></ul></td></tr></tbody></table>

赛事/事件的判断参考：

| **类型** | **判别字段（来自 Gamma API）** | **结构特征** | **前端呈现** |
|-|-|-|-|
| 比赛 GAME | Event 含 startTime / gameStatus / live / score / spreadsMainLine / totalsMainLine；其 Market 含 sportsMarketType、gameId、teamAID/teamBID、line | 一场比赛(两队)下挂多个盘口：胜负盘(moneyline)、让分盘(spreads)、大小球(totals) 等 | A vs B 比赛卡 + 盘口切换 |
| 事件 EVENT | Event 的 Market 无 sportsMarketType / gameId（含多结果 neg-risk 期货，如“谁夺冠”） | 通用二元命题 或 多结果互斥 | Yes/No 命题卡 |







**~~4.1能力~~**

| **~~操作~~** | **~~说明~~** |
|-|-|
| ~~添加事件~~ | ~~新增功能：填入 Polymarket 事件ID、名称、多级分类、三档 rate 及上线/交易开关，创建后纳入交易所内事件库。~~ |
| ~~上线 / 下线~~ | ~~下线后事件从前端列表移除；上线后恢复展示。与交易开关相互独立。~~ |
| ~~开启 / 关闭交易~~ | ~~关闭后事件仍可见但不可买入和卖出（对齐需求文档 7.2）。~~ |
| ~~三档费率配置~~ | ~~每个事件可独立配置买入rate / 卖出rate / 结算rate，覆盖全局默认。~~ |
| ~~多级分类~~ | ~~分类支持多级，例如 体育 › 足球 › 英超，用于前端筛选与运营管理。~~ |
| ~~对账最小份额阈值~~ | ~~低于该份额的事件不参与自动对账与手动平账。~~ |



**~~4.2 三档费率说明~~**

| **~~字段~~** | **~~对应需求文档~~** | **~~默认值~~** | **~~说明~~** |
|-|-|-|-|
| ~~买入rate~~ | ~~加价率~~ | ~~10%~~ | ~~买入时加价，隐性含在价格中~~ |
| ~~卖出rate~~ | ~~卖出抽水率~~ | ~~1%~~ | ~~提前卖出时收取，链上卖出≤1U 豁免~~ |
| ~~结算rate~~ | ~~结算抽水率~~ | ~~1%~~ | ~~到期结算时收取，仅盈利收取~~ |



**~~添加事件 · 标签分类设计（对齐 Polymarket API）~~**

**~~目标：后台添加事件后的分类与 Polymarket 保持一致，不依赖人工臆造分类。设计依据 Polymarket 的 Event/Market 模型与标签（tags）体系。~~**

~~Polymarket 数据模型：Event（事件，容器）下挂一个或多个 Market（市场，二元 Yes/No）。每个 Market 有 Condition ID、Question ID、Token IDs；Event/Market 各有唯一 slug，出现在 URL 中。Event 携带 tags 数组（如 Sports、Soccer、EPL），即平台分类来源。~~

**~~4.3.1 添加逻辑（保证与 Polymarket 一致）~~**

1. ~~运营输入事件 slug 或 Condition ID（来自 Polymarket 事件 URL）。~~
2. ~~系统调用 Gamma API 拉取该事件：GET https://gamma-api.polymarket.com/events?slug={slug}，读取事件名、markets、tags、结算规则、feesEnabled、费率参数。~~
3. ~~以 Polymarket 返回的 tags 作为分类来源，按 tag 层级映射为交易所内的多级分类（一级/二级/三级，如 体育 › 足球 › 英超）；分类不手工录入，只做映射，保证一致。~~
4. ~~校验：仅 enableOrderBook=true 的市场可交易；体育类未成交限价单在开赛时自动取消，需提示运营。~~
5. ~~运营确认三档 rate 与上线/交易开关后创建；事件入库并定时与 Polymarket 同步 tags 变更。~~

**~~4.3.2 分类映射规则~~**

| **~~层级~~** | **~~来源~~** | **~~示例~~** |
|-|-|-|
| ~~一级分类~~ | ~~Polymarket 顶层 tag（市场类别，对应费率类别）~~ | ~~体育 / 加密 / 金融 / 政治…~~ |
| ~~二级分类~~ | ~~Polymarket 运动/子领域 tag~~ | ~~足球 / 篮球 / 网球~~ |
| ~~三级分类~~ | ~~Polymarket 联赛/细分 tag~~ | ~~英超 / 西甲 / 欧冠~~ |



*~~映射维护一张 Polymarket tag → 交易所分类的对照表；Polymarket 新增 tag 时同步该表，无对应则归入“其他”并提示运营补映射。一级分类同时决定该事件的 Polymarket Taker 费率类别（见 3.2.1）。~~*

**~~4.3.3 体育“比赛(Game)”与“事件(Event)”的区分与兼容~~**

**~~Polymarket 体育数据为三层结构：Series（联赛/赛季）→ Event（比赛或专题事件）→ Market（可交易的 Yes/No 标的）。需求文档前端区分的“比赛列表（A vs B）”与“事件（Yes/No 命题）”，本质是 Event 的两种形态，靠 Gamma API 返回字段即可自动判别，不需运营手工选择。~~**

| **~~类型~~** | **~~判别字段（来自 Gamma API）~~** | **~~结构特征~~** | **~~前端呈现~~** |
|-|-|-|-|
| ~~比赛 GAME~~ | ~~Event 含 startTime / gameStatus / live / score / spreadsMainLine / totalsMainLine；其 Market 含 sportsMarketType、gameId、teamAID/teamBID、line~~ | ~~一场比赛(两队)下挂多个盘口：胜负盘(moneyline)、让分盘(spreads)、大小球(totals) 等~~ | ~~A vs B 比赛卡 + 盘口切换~~ |
| ~~事件 EVENT~~ | ~~Event 的 Market 无 sportsMarketType / gameId（含多结果 neg-risk 期货，如“谁夺冠”）~~ | ~~通用二元命题 或 多结果互斥~~ | ~~Yes/No 命题卡~~ |



**~~4.3.4 接入与落库逻辑~~**

1. ~~统一按 Event 接入：输入 event slug → 拉取 Event 及其 markets、tags、seriesSlug。~~
2. ~~分类：用 Event.tags + seriesSlug→Series.title 组多级分类（体育 › 足球 › 英超），与 Polymarket 一致。~~
3. ~~判别事件类型：若 markets[].sportsMarketType 非空 → 标记为“比赛 GAME”，保存 teamA/teamB、startTime，并按 sportsMarketType 将盘口分组；否则标记为“事件 EVENT”。~~
4. ~~拆解为交易单元：每个 Market 落库 conditionId、clobTokenIds(Yes/No 两个 token)、feesEnabled/feeSchedule，作为交易所内真正的交易与费率单元；一场比赛=一个父事件下多个可交易盘口。~~
5. ~~校验与时效：仅 enableOrderBook/acceptingOrders=true 的 Market 可交易；比赛类未成交限价单在开赛(gameStartTime/startTime)时自动清空，需在事件管理标记开赛时间并提示。~~

*~~即：交易所内事件库以 Market 为交易粒度，但保留 Event(比赛/专题) 作为父级聚合，多级分类沿用 Series+tags，从而既兼容“比赛”又兼容“事件”，且与 Polymarket 结构保持一致。~~*

**~~4.4 交互与规则~~**

- ~~事件列表支持按多级分类（一级/二级/三级）、上线状态、名称检索；展示三档 rate、上线状态、交易开关、持仓份额（已去掉 Yes/No 卖一价字段）。~~
- ~~交易开关为行内即时切换（toggle），上线/下线为按钮操作，添加事件为弹窗表单，均需二次确认。~~
- ~~所有变更写入审计日志：操作人、时间、变更前后值。~~
- ~~三档 rate 当前存于 KV，事件管理页提供可视化读写入口，避免直接改 KV。~~

![The image shows the event management page interface. It displays a list of events with columns including Event ID, Event Name, Type, Multi-level Classification, Buy rate, Sell rate, Settlement rate, Status, Trading Switch, and Operation. The events listed have different types like "Canada vs Bosnia" (Sports, Football, World Cup), "Lakers win NBA Finals" (Sports, Basketball, NBA), etc. The interface supports multi-level classification, three rate tiers, status (online/offline), trading switch, and an add event entry.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NjU3OGZiNzUxZjRjNzI4MjdiNWFmMGZiODRmOTk5ODRfMzc1ODlhYTU0YTA0OTRlYjM1NjhlYjg5YjJlNzU3YzlfSUQ6NzY0NzE1NTg5NTMwMzYyMjM2Nl8xNzgxOTYzMTQ5OjE3ODE5NjY3NDlfVjM)

*图 4-1　事件管理页：类型（比赛/事件）、多级分类、三档 rate、上下线与交易开关、添加事件入口*

---

