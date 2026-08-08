---
sourceName: "PR-02006 PRD content extracted"
sourceType: "doc"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/docx/NiHVdQGgUohh20xRJmOlmo0rgAg"
syncedAt: "2026-06-20T07:06:59.889Z"
readOnly: true
derivedFrom: "apps/web/docs_tdd/prds/PR-02006/inbox/lark-sync/prd-latest.md"
---

<title>【预计下周三验收 6.24】【PR-02006】【Tradfi】板块币种体验优化（筛选、分类、交易量维度透传等）</title>

# 一、变更记录

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>时间</b></td><td><b>版本号</b></td><td><b>变更人</b></td><td><b>主要变更内容</b></td></tr><tr><td>2026-6-18</td><td>/</td><td><cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite></td><td>创建文档</td></tr><tr><td>2026-6-19</td><td>/</td><td><cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite></td><td>补充tradfi 本快 币种的 “别名多语言”规则<img name="image.png" alt="The image shows the &#34;Tradfi&#34;板块的【币种别名】字段多语言处理. It includes a screenshot of the operation path: [合约管理后台] - [合约配置] - [币种] - [添加或编辑]. Below, there is a table with columns: 字段名称 (Field Name), 字段类型 (Field Type), 取值 (Value), 说明 (Description). It mentions adding a new field &#34;归属板块&#34; with type &#34;枚举类型&#34; and value &#34;USDT本位, TradFi&#34;, and notes that when &#34;归属板块&#34; is &#34;TradFi&#34;, the 【币种别名】字段需多语言配置." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YzdmNTk0MTg4ZTg5NDUwYTA2ZWVkNzdlNTMwZmE5Y2VfNzgwODVjOTE0YTI1YzliNDQ3MjNhNDFhZWQ5OWQwZjlfSUQ6NzY1MzA1NzE3OTU4NjU0NzQxOV8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="1.000000" src="NXN6bHsmzoMQWfxlXTvlO4EMguh"/></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

# 二、评审记录

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td><b>评审时间</b></td><td><b>参与人员</b></td><td><b>结论</b></td></tr><tr><td>2026-6-19</td><td><cite type="user" user-id="ou_9ee2b90bfab0ad7f920e1bf775216ca1" user-name="Hurley"></cite><cite type="user" user-id="ou_91861d6da6cf6822e08045ba1868241e" user-name="Aven.tong"></cite><cite type="user" user-id="ou_71e594cff8dfc118989c3fdf7eb59a78" user-name="Durand"></cite></td><td>评审视频：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgby6b525qyw9rrp29yxu4<br/><br/>评审视频二https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgb29295vdcacqp721372i</td></tr></tbody></table>

# 三、需求背景

优化

# 四、需求List

**原型地址：**https://www.figma.com/design/RpAKwiau1QYLimGkHRy5Vl/Lucky%E5%8E%9F%E5%9E%8B?node-id=8923-9176&t=F6F5EoPBANeyytbt-1

**UI地址：**

| **形态** | **模块** | **说明** | **备注** |
|-|-|-|-|
| app/Web |  |  |  |



**遗留的问题：**别名目前是必填项，然后后段返回的，没有多语言。。。。。。。





# 五、web产品方案

## 5.1 鼠标hover TradFi 

**操作路径：**【web】→ 顶部导航栏 →鼠标hover 【合约交易】→ 鼠标hover【Tradfi】菜单

![The image shows a trading platform interface with a dark theme. On the left, there is a chart with green and red bars. In the center, a red rectangular box highlights a pop-up window (弹窗浮层) triggered by hovering over the "Tradfi" menu. The pop-up displays a list of trading pairs like "KALIUSDT", "TSLAUSDT", etc., with some marked in red, green, or orange. On the right, there are trading-related buttons and a green "Buy" button. This corresponds to the context describing the trigger way of the "Tradfi" menu, where hovering shows a pop-up window.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZDFiN2U3NDUyODU1NjMzZmNlZGU2NTRhNjc0MzZmYjBfNzdjNzdjY2E4ZTQ2ODUzMWM5NjYyMWJiNDRjMzAyZGJfSUQ6NzY1MjcwMjg1ODM5NTA5NDc1NF8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)

### **5.1.1 触发方式**

鼠标hover 上图的【Tradfi】菜单，显示弹窗浮层

### **5.1.2 弹窗内的交易对说明**

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>字段名称</b></th><th>组件类型</th><th>枚举值</th><th><b>说明</b></th></tr></thead><tbody><tr><td>分类 Tab</td><td>枚举值单选</td><td>全部 / 动态取值</td><td><ol><li seq="1"><b>默认枚举值：</b>全部 </li><li>切换<b>标签Tab</b>联动过滤，<b>【仅展示对应分类】</b>的交易对 </li><li><b>动态枚举值：</b><ol><li seq="1"><b>取值来源：</b>【合约管理后台】--【合约配置】--【币对】：TradFi标签 </li><li><b>展示规则：</b>前台 App / Web 仅展示<b>“当前存在有效币对的标签tab”</b>；<br/>若某婊天tab下<b>无任何</b>可用币对，则<b>该标签tab自动隐藏</b>，不占位、不展示。</li></ol></li></ol></td></tr><tr><td>搜索框</td><td>文本输入框</td><td>-</td><td><ol><li seq="1"><b>占位符：</b>搜索 </li><li><b>模糊搜索：</b><ol><li seq="1">支持交易对名称 / 附属名称（如输入"黄金"可匹配 XAUUSDT，输入"特斯拉"可匹配 TSLAUSDT）</li><li>实时查询</li><li>搜索结果实时更新，无需点击确认</li></ol></li><li><b>搜索范围规则：</b>在<b>【当前标签tab范围内】</b>进行搜索</li><li><b>无匹配结果时</b>展示空状态（具体样式以 UI 为准）<img name="image.png" alt="The image shows a user interface section related to the &#34;TradFi&#34; product scheme. At the top, there are tabs including &#34;全部&#34;, &#34;股票&#34;, &#34;Pre-IPO&#34;, &#34;贵金属&#34;, and &#34;大宗商品&#34;. Below the tabs, there is a search bar with the text &#34;coin&#34; entered. In the center of the interface, the message &#34;暂无数据&#34; (No data available) is displayed. This image likely illustrates the search and data display functionality in the web product scheme, possibly under the &#34;贵金属&#34; (Precious Metals) category as indicated by the selected tab." caption="&#xA;" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MWYzYTYxNjZiNDUzNjU5MDQ2NWE1N2ZmOGE5NGNiNzNfMzNiZDJiOGU5NDQxZTY4N2M5ZWMyNGRjYzZlN2I0YjdfSUQ6NzY1MjcwNTM1OTI5MTczMTY4Ml8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="0.407193" src="EHGEbecWeoHMsjxB9YvlqZcwgFc"/></li><li><b>搜索联动规则</b><ol><li seq="1"><b>切换 Tab 分类时保留关键词</b></li></ol><p>用户已输入关键词的情况下，切换 Tab 分类时，关键词保持不变，系统自动在新分类下执行该关键词的搜索。</p><blockquote><p><b>示例：</b>用户在"贵金属"分类下搜索"coin"无结果，切换至"股票"分类后，系统自动在股票分类下重新检索"coin"关键词。</p></blockquote><hr/><ol><li><b>搜索内容的关键词 清楚规则</b></li></ol><img name="image.png" alt="The table shows the trigger conditions and their corresponding behaviors in the web product scheme. When the user manually deletes a keyword or inputs a new one, the search results are updated in real-time based on the current input content. When the mouse moves out of the search box and hovers again, the search state is initialized, the keyword is cleared, and the Tab classification returns to the default 【All】." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MTU2NzEzNWU0ZWU5ZDRkMTkyYTkxNDg1OTcwNTE1ZjRfMTIzMTFjNGI2ZTQwMGYzNDQ0Mzc4YzQ4YTQ2NjRjNzBfSUQ6NzY1MjcwNzkyMzM3NzkzNDA1NF8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="1.000000" src="PmhfbOzn7oIhXKxKn5SlRRlhgch"/></li></ol></td></tr><tr><td>logo</td><td>-</td><td>-</td><td><ol><li seq="1">沿用现状取值逻辑（这里不用动）</li></ol></td></tr><tr><td>交易对名称</td><td>-</td><td>-</td><td><ol><li seq="1">展示交易对全称，如 XAUUSDT、TSLAUSDT </li><li>名称下方展示 24h 成交额<ol><li seq="1"><b>格式：</b>XX.XXM USDT / XX.XXK USDT</li><li><b>取值：</b>目前对应币对的交易页有这个值，跟这个值保持一致</li></ol></li></ol></td></tr><tr><td>附属名称标签</td><td>-</td><td>-</td><td><ol><li seq="1"><b>取值：</b>【合约管理后台】--【合约配置】--【币种】：币种别名<img name="image.png" alt="The image shows a user interface of the contract management backend system, specifically the &#34;币种&#34; (Currency) configuration page. A pop-up window is displayed, with the &#34;附属名称标签&#34; (Sub Name Tag) field highlighted in red. The context mentions that the附属名称标签 is taken from 【合约管理后台】--【合约配置】--【币种】: 币种别名, and its label style follows the UI standard." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTBkY2EwNjcxZDMxOGJhYjYwMzUzNTViMjFhOGRmMGNfZmY2YjUzZWVkYjQyYjc5MGUwODZlMGI5Nzc3YmY1NjhfSUQ6NzY1Mjk5OTEwOTI3NTY2ODE5MV8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="0.095076" src="LNMvbP4ayoooImxnSeclnuOEgFf"/></li><li><b>标签样式：</b>样式以 UI 为准 </li></ol></td></tr><tr><td>最新价</td><td>-</td><td>-</td><td><ol><li seq="1">展示该交易对当前最新价</li><li><b>精度：</b>跟随合约币对配置的参数</li><li>数据实时刷新</li></ol></td></tr><tr><td>24h 涨跌幅</td><td>-</td><td>-</td><td><ol><li seq="1"><b>取值：</b>沿用现状的逻辑</li><li><b>颜色规则：</b> <ol><li seq="1">正值：绿色（如 +4.78%） </li><li>负值：红色（如 -0.44%）</li></ol></li></ol></td></tr><tr><td>点击交互</td><td>-</td><td>-</td><td><ol><li seq="1">点击某一交易对后，关闭弹窗，页面<b>【切换至对应交易对】的 交易页</b></li></ol></td></tr><tr><td>交易对默认的排序规则</td><td>-</td><td>-</td><td><ol><li seq="1">依据【24h成交额】倒序排序（即高的在前面）</li><li>实时排序</li></ol></td></tr></tbody></table>



---



## 5.2 鼠标hover 交易页左上角的交易对

**操作路径：**【web】→ 【交易页】→ 鼠标hover左侧【交易对】

![The image shows a trading page interface with a red box highlighting the left side where the trading pairs are located. The trading pairs are listed vertically, with some pairs marked by colored circles (red, orange, green, blue) and their corresponding 24-hour trading volume displayed next to them. The interface also includes a chart in the middle, a trading volume bar chart on the right, and a green "Buy" and red "Sell" button on the far right. This image corresponds to the context describing the web product scheme, specifically the operation path of hovering over the left trading pairs on the trading page.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YmY1NDgwYWUwYTRkZjMzYjE1ZmE0YmVjYzcxYjAwMmFfOTU5ODc2ODE2NWUyNGZhYTU5NTBkYWI0YzMzYTY5MjRfSUQ6NzY1MjcxNzc2OTY4NjgxNDQyN18xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)

### 【调整1】TradFi板块的交易对数据

**默认排序规则：**依据【24h成交额】倒序排序（即高的在前面）

### 【调整2】如下表描述: 

<table><colgroup><col/><col/><col/></colgroup><thead><tr><th><b>字段名称</b></th><th>组件类型</th><th><b>说明</b></th></tr></thead><tbody><tr><td>TradFi</td><td>枚举值单选</td><td><ol><li seq="1"><b>取值来源：</b>【合约管理后台】--【合约配置】--【币对】：所属板块 </li><li><b>展示规则：</b>前台 App / Web 仅展示<b>“当前存在有效币对的板块”</b>；<br/>若某板块下无任何可用币对，则该板块<b>自动隐藏</b>，不占位、不展示。</li></ol></td></tr><tr><td>分类 Tab</td><td>枚举值单选</td><td><ol><li seq="1"><b>默认枚举值：</b>全部 </li><li>切换<b>标签Tab</b>联动过滤，<b>【仅展示对应分类】</b>的交易对 </li><li><b>动态枚举值：</b><ol><li seq="1"><b>取值来源：</b>【合约管理后台】--【合约配置】--【币对】：TradFi标签 </li><li><b>展示规则：</b>前台 App / Web 仅展示<b>“当前存在有效币对的标签tab”</b>；<br/>若某婊天tab下<b>无任何</b>可用币对，则<b>该标签tab自动隐藏</b>，不占位、不展示。</li></ol></li></ol></td></tr><tr><td>交易对</td><td>-</td><td><b>现状存在的字段（无需特殊处理）</b></td></tr><tr><td>24h成交额</td><td>标题</td><td>该字段是新增的<ol><li seq="1"><b>交易对结构：</b><ol><li seq="1">展示交易对全称，如 XAUUSDT、TSLAUSDT </li></ol></li><li><b>24h成交额</b><ol><li seq="1"><b>格式：</b>XX.XXM USDT / XX.XXK USDT</li><li><b>取值：</b>目前对应币对的交易页有这个值，跟这个值保持一致</li></ol></li><li><b>字段的排序icon规则、交互 均与线上逻辑一致</b><ol><li seq="1"><b>排序状态</b><b>互斥逻辑：</b>，同一时刻<b>仅允许一个字段处于排序激活</b>状态；</li><li><b>第一次点击：</b>切换为「降序」，图标高亮，列表按该字段从高→低排列</li><li><b>第二次点击：</b>切换为「升序」，图标高亮，列表按该字段从低→高排列</li><li><b>第三次点击（默认排序）：</b>重置为「默认排序」，图标恢复默认态，列表恢复与下图交易对默认排序一致</li></ol></li></ol></td></tr><tr><td>附属名称标签</td><td>-</td><td><ol><li seq="1"><b>取值：</b>【合约管理后台】--【合约配置】--【币种】：币种别名<img name="image.png" alt="The image shows a user interface related to the &#34;Tradfi&#34;板块币种体验优化方案中鼠标hover交易页左上角交易对的调整。界面左侧有多个币种选项，右侧是币种信息展示区域，其中“附属名称标签”字段的取值为【合约管理后台】--【合约配置】--【币种】：币种别名，标签样式以UI为准。该图与上下文内容紧密相关，直观呈现了方案中涉及的币种信息展示及标签样式相关内容。" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YWY1MTE4ZTk2OTJmMWU0NjRjZDJmYTU2NWViYzNjMDJfYzQ0NDY4MDQyMzQ1MzJiMGM3YzNlMWMwMDM5ZmU0YjlfSUQ6NzY1Mjk5OTY0NzM3MDcyNzE0MV8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="0.095076" src="IZ2bbsi6NoH1Ttx3TzplLkUlgcc"/></li><li><b>标签样式：</b>样式以 UI 为准 </li></ol></td></tr><tr><td>最新价</td><td>-</td><td><b>现状存在的字段（无需特殊处理）</b></td></tr><tr><td>24h 涨跌幅</td><td>-</td><td><b>现状存在的字段（无需特殊处理）</b></td></tr></tbody></table>



### 【调整3】如下图描述:

![The image shows a trading page interface. A red box highlights a specific point, with the text "下图位置：红框框选的点优化成鼠标hover显示浮层，而不是‘点击之后显示浮层’" indicating that the selected point should be optimized to display a pop-up layer when hovering the mouse, not after clicking. The interface includes a chart with price movements, a list of trading pairs on the left, and order and trading details on the right.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NTBhZjhiOTlkYzlmZDA4ODkwYWZkM2JmMmI1NWM0NmRfMzVlOGMzMzcxMjQ3MjgwZTNkNjZiNGVmMjEzMjZmODdfSUQ6NzY1MjczMzc1OTM0Njc5MDExMl8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)

### **【调整4】去掉【下图原有】的 这标签显示（只会显示本需求提到的别名）**![The image shows a trading page interface of FameEX. On the left side, there is a list of trading pairs under the "TradFi" category, with XAG/USDT highlighted in red. The right side displays the latest price of BTC/USDT as 63,803.8, along with other related information like 24-hour price change and trading volume. The context mentions adjusting the display of trading pairs, specifically removing the original label and only showing the alias as per the demand.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZjI2ZTQ3NDFiNDYxMGNjMTNkNThmMDZiMWNlMGM1NjhfOGZjMzFiNmJlODY2NWM4MGIxZTZlNmI0YTVhMDAxMGVfSUQ6NzY1Mjc0ODgyNDkxMzQxNTkxMF8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)



---



## 5.3 TradFi 落地页

**操作路径：**【web】→ 顶部菜单【TradFi】的落地页

![The image shows the "TradFi" trading page under the "TradFi" section of the web product. It displays a list of tradable assets, with the left part of the list highlighted in a red box. The right part of the list, including the 24h highest price and 24h lowest price fields, is also highlighted in a red box. This corresponds to the context which mentions adding the "24h highest price" and "24h lowest price" fields and adding sorting icons for these fields, as well as the 24h trading volume field.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MDUxMzU1NzI4NWY3MThmZTk2NDk5NDJkMTQyNjA0M2VfMTJhZTIwZGEwNTUzZjg2NzQ4NDI3YjUzYzFlNzUxMTFfSUQ6NzY1MjczMTg0MDMzMTEwODA2MF8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)

1. **交易对基础上：**

   1. **新增 “永续”标签**
   
      1. **标签取值逻辑：**与行情内的 tradfi板块的“永续标签”一致
      2. 样式以ui为准
   2. **新增“附属文案”标签**
   
      1. **取值：**【合约管理后台】--【合约配置】--【币种】：币种别名![The image shows a user interface related to the TradFi product scheme. It displays a list of trading pairs with columns like "Name", "Symbol", "24h Volume", etc. A pop-up window is open, showing a specific trading pair with details such as "24h Volume" highlighted in red. This relates to the context of adding the "24h成交额" (24-hour trading volume) field as a new list field in the TradFi landing page, with sorting icons based on other fields.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MGVkZDZmODM3NWY1MzdlNjA0YWRkZTIwM2VkMzI0MTlfOWI3NzQ5ODJlZDg5ZTdlY2UwN2U4NjRmZjczNThjZDJfSUQ6NzY1Mjk5OTc0MjM3Mzg5MTgxM18xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)
      2. 样式以ui为准
   3. **去掉原有的 标签**![The image shows a webpage section titled "可交易资产" (Tradable Assets) under the "TradFi" category. It displays a list of trading pairs with columns for "最新价格" (Latest Price), "24h涨跌" (24h Change), "24h最高价" (24h High), and others. A red box highlights the "24h涨跌" column, which is mentioned in the context as needing a new sorting icon, to be consistent with other field sorting icons.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=OTg5YzgyNzQ3NTM1Y2M0MDc3ZDE1ZDAwNjI1M2RiNzNfNDc0ZjhkMmYxNDJlYjQ3NWRmYWFhOTkxOGY1MWM1NDBfSUQ6NzY1Mjc0ODY1MjU1Mjg4MzkzMV8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)
2. **【新增】列表字段**

   1. **字段名称：**24h成交额
   2. **排序icon：**以其他字段的排序icon为准
3. **【优化】列表字段**

   1. **【**24h最高价】 及 【24h最低价】的两个字段，需要新增 **排序icon：**以其他字段的排序icon为准



---



## 5.4 行情 页

**操作路径：**【web】→ 顶部菜单【行情】页→ TradFi板块

![The image shows the "行情" (Trading) page of the FamaEX platform under the TradFi section. It displays various trading pairs with their corresponding prices, percentage changes, and trading volumes. BTC/USDT is highlighted with a 4.71% drop and a price of 65,191.6. Other pairs like ETH/USDT, SOL/USDT, and DOGE/USDT are also shown. Below, there is a list of trading pairs with their prices, percentage changes, and trading volumes, including KAGUSD/USDT, XAUUSD/USDT, etc. The page has a dark background with colorful icons for different trading pairs.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MWU4YjI5OTlmMTA4YzVjMTI5MTA4ZmE5YzA0ZjEyYTRfMTM3ZjdlZDc1NGQ5N2I5ZDkwODhhZjdkNzk2M2RjNTlfSUQ6NzY1MjczMzYwMDQyNDU5NTE3N18xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)

1. **新增“附属文案”标签**

   1. **取值：**【合约管理后台】--【合约配置】--【币种】：币种别名![The image shows the "币种" configuration interface in the contract management backend. A pop-up window is displayed, with the "币种别名" field highlighted in red. The field contains the text "TUSD", which is the value for the "附属文案" tag in the TradFi板块币种体验优化方案. This corresponds to the context stating that the "附属文案" tag's value is from the contract management backend's contract configuration - coin section.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTNhZGM0NGJjODRlMDQ1NDIzZjU4ZWM5OGIyNzAwZGNfY2RhYzY4YzIzODMyYjZmZDVlNmI1NzljMTNjNDY3OGJfSUQ6NzY1Mjk5OTgxMDU1OTQzMDM3M18xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)
   2. 样式以ui为准



1. **logo优化如下图描述**

![The image shows the logo transmission style optimization in the TradFi trading page. It presents two screenshots labeled 【图一】and 【图二】. 【图一】 highlights the "logo" style on the left side, with a red arrow pointing to the right side of 【图二】 which shows the model style to be followed. The left side of 【图一】 has a list of items with different colors and backgrounds, while the right side of 【图二】 displays a more uniform and stylized logo transmission. This is related to the web product scheme's 5.4行情页 (Trading Page) section, specifically the logo optimization mentioned in the context.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=Mjg5OTg3MGUzZjA3ODdhZjk1NGVhMWIwZTZjYWVhYzZfZDBmNzAxNGY5MWNiMzYxYzA0ZTUyYmY2MTk5ZmMwMzlfSUQ6NzY1MjczMzU3NDkxMDY2MDMxNl8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)



# 六、切换分页自动跳转了

![The image shows a trading platform interface with a dark background. At the top, there are several menu options including "行情", "期货交易", "合约交易", "TradFi", etc. A red arrow points to the "TradFi" option. Below, there is a list of trading pairs like "KAGUSD", "XAUUSD", etc., each with price, 24-hour change, highest and lowest prices, and trading volume. Another red arrow points to a "2" at the bottom right corner, possibly indicating a page number or next page indicator.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MDdmYWVhYTZmMWRhMTBhMjhiNjJjY2RiMGE3NmUzNzhfOTZiMjA4YTU0OTk0ODBjNWJmZjA2YTZmOWMzNWNiYmRfSUQ6NzY1MzAxNTU3ODg4NTkzNDgyNV8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)



---

---



# 六、多语言、h5都需要处理

## 6.1 其中【tradfi】板块的 【币种别名】字段 多语言处理如下：

**操作路径：**【合约管理后台】--【合约配置】--【币种】：添加 或 编辑

![The image shows the interface of the "Contract Management Backend" under the "Contract Configuration" and "Currency" section, comparing the "现状" (current state) and "优化后" (optimized) views of adding a currency. The "现状" view has a simple layout with a "确认" (Confirm) button, while the "优化后" view features a more structured interface with multiple input fields, including "币种别名" (Currency Nickname), "币种描述" (Currency Description), and "币种类型" (Currency Type), along with a "确认" (Confirm) button. This reflects the optimization of the "Currency Nickname" field for multilingual processing in the tradfi edition.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NjA3ZGIxNzdkZmI3MTNlNDFlNmEyOTQ4NTIzNjc3NDdfODY0YjVlN2IyNDk2NjQ2MmU1YTRhOTlkMzIyYjk2NTFfSUQ6NzY1MzA1NzAyMzA4MDIyMjQzMF8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM)

1. **优化后：**在现状基础之上，新增字段

   <table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>字段名称</b></th><th>组件类型</th><th>枚举值</th><th><b>说明</b></th></tr></thead><tbody><tr><td>归属板块</td><td>枚举值单选</td><td>USDT本位、TradFi</td><td><ol><li seq="1"><b>组件框提示语：</b>请选择</li><li><b>字段关联逻辑：</b><ol><li seq="1"><b>显示条件</b><br/><b>仅当</b>【归属板块】= <code>TradFi</code> 时，【币种别名】字段<b>展示多语言配置区域</b>。</li></ol><hr/><ol><li><b>国家语言动态取值：</b>后台多语言配置中的<b>"国家语言"维度</b>，动态取值于前台已维护的【国家语言】配置项，保持前后台数据一致，无需手动维护语言列表。</li></ol><hr/><ol><li><b>前端必填项校验规则</b><b>（鼠标失焦 或 点击保存 均需出发必填项校验）</b><img name="image.png" alt="The table shows the必填项校验规则 for the【tradfi】板块的【币种别名】字段. There are two scenarios: when there are unfilled language items during submission, the logic is to block the submission and the prompt is &#34;Please fill in all national language aliases&#34;; when all language items are filled, the logic is to pass the verification and submit normally, with no prompt. This table corresponds to the context about the必填项校验规则 in the document." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MDdjMjQwMGM5MGZlN2FlM2NmYmM5MGI2MTFmNGExNjBfZDdiZjA5MjM3OTllYzhhYWM4YWM5MGE5NDUyNzg2YTJfSUQ6NzY1MzA1NjM0NjcxNTExNTIzMV8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="1.000000" src="OF2hbiJoyo25rfxRYqwle42Sggh"/></li></ol><hr/><ol><li><b>展示结构：</b><ol><li seq="1"><b>结构样式：</b>以下图为准</li><li><b>下图常驻提示语：</b>💡 TradFi 品种需配置多语言别名，将在对应语言环境下展示</li></ol></li></ol><hr/><ol><li><b>配置成功后，前端应用逻辑：</b>配置保存成功后，前端<b>在各需展示【币种别名】的入口处</b>，根据当前用户的语言环境，传入对应的「语言参数」，接口返回该语言对应的别名值进行展示。</li></ol><hr/><ol><li><b>输入规则：</b>【币种别名】支持各语言字符的输入，包括但不限于中文、英文、阿拉伯语、日语等，不限制字符集。<img name="image.png" alt="The image shows the &#34;添加币种&#34; (Add Coin) interface. The &#34;归属板块&#34; (Category) is set to &#34;TradFi&#34;. The &#34;币种别名&#34; (Coin Nickname) section has tabs like &#34;中文 (简体)&#34; (Simplified Chinese), &#34;English&#34;, &#34;中文 (繁體)&#34; (Traditional Chinese), etc. There is a prompt: &#34;TradFi品种需配置多语言别名，将在对应语言环境下展示&#34; (TradFi coins need to configure multi-language nicknames, which will be displayed in the corresponding language environment). Other fields include &#34;是否为保证金币种&#34; (Is it a margin coin?), &#34;显示精度&#34; (Display Precision), &#34;资金划入状态&#34; (Funding Transfer Status), &#34;币种logo路径&#34; (Coin Logo Path), and &#34;币种概况&#34; (Coin Overview)." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZDlmOThkNGNjNTFiZTI0MzczODI3YzgyODEyZWNjMGVfMDBiOTg2NDQ1ZTliZjFkNTE3ODU1Y2Q2MTAyOTJmMDBfSUQ6NzY1MzA1MzgxMjM4Njg2MDc3NF8xNzgxOTM5MjI0OjE3ODE5NDI4MjRfVjM" mime="image/png" scale="0.207679" src="IVnob7D4Joi0yUxL4VhlR7JwgYf"/></li></ol><p></p></li></ol></td></tr></tbody></table>



# 七、验收标准

<sheet sheet-id="WppwGn" token="YZFbsxTxahoiC9tovURlyIoNgYc"></sheet>
