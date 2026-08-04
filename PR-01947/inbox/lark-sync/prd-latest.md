---
sourceName: "需求 PRD"
sourceType: "doc"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/docx/Qj5OdXCCroWHopxcfcmlGklMgff"
syncedAt: "2026-07-24T12:30:10.000Z"
readOnly: true
command: "lark-cli docs +fetch --api-version v2 --doc https://qfglxo2m3dc.sg.larksuite.com/docx/Qj5OdXCCroWHopxcfcmlGklMgff --doc-format markdown"
revisionId: 3890
note: "2026-07-24 手动修复：同步脚本原样写入 lark-cli JSON 信封，本文件已恢复为 .data.document.content 提取的净 markdown"
---

<title>PR-01947 【跟单】跟单设置优化（保证金/杠杆/复制仓位）</title>

## 一、 版本信息

<grid>
<column width-ratio="0.333333">
<callout emoji="⏰">
版本号：V_2.0.0
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="📆">
创建日期:2026-06-09
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="👮">
审核人
</callout>
</column>
</grid>



# 二、 变更日志

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>时间</b></td><td><b>版本号</b></td><td><b>变更人</b></td><td><b>主要变更内容</b></td></tr><tr><td>2026-06-09</td><td>V_1.0.0</td><td><cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite></td><td>新增</td></tr><tr><td>2026-07-07 </td><td>V_2.0.0</td><td><cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite></td><td>新增 7.10 其他优化内容 <cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

# 三、 评审记录（必填项）

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>评审<b>时间</b></td><td>参与人员</td><td><b>结论</b></td></tr><tr><td>2026-06-30</td><td><cite type="user" user-id="ou_9673ca5947df46dca27550d9f88012c6" user-name="George"></cite><cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite><cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite></td><td>会议<br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgji6am118l28nw1k2luyi<br/>结论：<ol><li seq="1">滑点（单拆需求做）<cite doc-id="Nbu1doMPRoj8plxMjP6l8bRJgwc" file-type="docx" title="PR-2069 【跟单】跟单设置优化（滑点）" type="doc"></cite><ol><li seq="1"><del>跟单侧不自己做拦截，只把值透传给合约，复用合约的划点逻辑；合约划点逻辑：设置最差成交价 → 进撮合逐档吃单 → 吃到划点价还没成交完则取消剩余 → </del><b><del>存在部分成交</del></b><del>・因此需补：部分成交的各类边界场景</del></li><li><del>划点基准价：交易员成交均价 or 跟单者下单时买一/卖一？ </del></li><li><del>跟单用户（被动交易）是否走风控划点？      </del></li><li><del>跟单超划点是否给补偿？（需拉运营一起定）      </del></li></ol></li><li>杠杆补充<ol><li seq="1">杠杆过低导致开仓金额不足最小开仓价值 → 失败场景   <b>-- 补充低杠杆，导致不满足最小开仓失败场景 （7.3.5 场景说明）</b></li><li> KYC 限制最高杠杆 → 降级逻辑 -<b>- 补充触发KYC限制下，降低杠杆跟随的场景 （7.3.5 场景说明）</b></li></ol></li><li>其他<ol><li seq="1">交叉风险：三个参数（ × 保证金模式 × 杠杆 × 仓位复制）组合后是否存在异常场景？需逐一交叉验证。<b>-- 补充7.6交叉场景推演</b></li></ol></li></ol></td></tr><tr><td>2026-07-08</td><td><cite type="user" user-id="ou_f7ba9a4140c817669b9c90a22d7f757b" user-name="Sissie"></cite><cite type="user" user-id="ou_9ee2b90bfab0ad7f920e1bf775216ca1" user-name="Hurley"></cite><cite type="user" user-id="ou_3ff7cb42ee8639e5ad09e35906e7a09f" user-name="Willem"></cite><cite type="user" user-id="ou_6a01315efffdbc2d175591ac4c8269e3" user-name="Kevin"></cite><cite type="user" user-id="ou_47a9fe590fed4b47bd0af22292e53522" user-name="Key"></cite><cite type="user" user-id="ou_91861d6da6cf6822e08045ba1868241e" user-name="Aven.tong"></cite><cite type="user" user-id="ou_8e4061bba550ab2fc1b132bc3aa7f69a" user-name="Fly"></cite><cite type="user" user-id="ou_37ccdadcf68accec34e8eec2609817f7" user-name="Bryn"></cite><cite type="user" user-id="ou_c8afb8c28ccb3c2f288613b466169500" user-name="Tracy"></cite><cite type="user" user-id="ou_02340702780f6acd689ef08febde8fff" user-name="River"></cite><cite type="user" user-id="ou_7c00e16e1c19a29b677bea48d8908e27" user-name="Check"></cite><cite type="user" user-id="ou_184262fbf4161f2edf706f8b2a8ee746" user-name="Spring"></cite></td><td>会议：<br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgoz3nq5ym55o696tjv5t3<br/>结论：<ol><li seq="1">关于跟单是子账户，没有kyc的概念  --  补充在7.4.5  #1  特殊情况：用户跟单设置选择【随交易员杠杆】，交易员使用需要kyc的杠杆，则跟单员无法跟随成功，跟单失败（交易员杠杆需KYC）</li><li>后台配置杠杆 -- <b>修改为后台配置前端限制只能配置1-20x杠杆</b></li></ol></td></tr></tbody></table>

# 四、 需求背景

### 4.1 背景

当前合约跟单功能中，跟单用户在发起跟单时缺少必要的交易参数配置能力：

1. ~~无法控制~~**~~滑点~~**~~容忍度，极端行情下跟单成交价可能严重偏离交易员成交价~~
2. **保证金模式**固定，无法根据个人风险偏好选择逐仓/全仓
3. **杠杆**强制跟随交易员，用户没有自主调整空间
4. 缺少现有**持仓复制策略**

与主流竞品存在明显能力差距。

### 4.2 目标

为跟单用户提供完整的交易参数配置能力，在发起跟单时可自主设置：

1. **~~滑点容忍度~~**~~：控制跟单执行的最高滑点~~
2. **保证金模式**：选择全仓或逐仓
3. **杠杆倍数**：跟随交易员或自定义
4. **现有持仓复制模式**：选择对交易员已有仓位的处理策略

### 4.3 范围

1. 涉及端：App（iOS/Android）、Web
2. 涉及用户：合约跟单用户
3. 本期范围：跟单设置

# 五、术语定义

| **术语** | **定义** |
|-|-|
| ~~跟单滑点~~ | ~~跟单执行成交价与交易员成交价之间的偏差，以百分比表示~~ |
| 全仓模式 | 同一交易对下的所有跟单仓位共享保证金池 |
| 逐仓模式 | 每个跟单仓位拥有独立保证金，仓位间互不影响 |
| 现有持仓复制 | 用户发起跟单时，对交易员已有持仓的处理策略（全部复制 / 仅更好价复制 / 不复制） |

# 六、全局规则

### 6.1 参数生效范围与修改规则

| 参数 | 可修改时机 | 生效时机 |
|-|-|-|
| ~~滑点~~ | ~~当前交易员有跟随持仓的话 ，无法修改滑点~~ | ~~仅后续新开仓~~ |
| 保证金模式 | 当前交易员有跟随持仓的话 ，无法修改保证金模式 | 仅后续新开仓 |
| 杠杆倍数 | 当前交易员有跟随持仓的话 ，无法修改杠杆 | 仅后续新开仓 |
| 现有持仓复制 | 发起跟单时选择，仅在发起跟单生效 | 本次跟单发起时一次性执行 |

### 6.2 参数独立生效规则

- 每位用户对**每个交易员**独立保存一套配置（~~滑点~~ / 保证金模式 / 杠杆 / 持仓复制模式）
- 不同交易员之间配置互不影响



# 七、功能详情

### 7.1原型图

原型图：https://www.figma.com/design/1ro2OBI8I1omI9bTJSMJPG/Sissie%E5%8E%9F%E5%9E%8B?node-id=8411-1559&p=f&t=OKgiFOwvtV2aIkGh-0

设计稿：（UI补充）

app：

web：

### ~~7.2 跟单滑点设置（单独拆需求实现，不放在这个需求单号）~~

#### **7.2.1 功能描述**

 跟单用户设置跟单执行时的最大滑点容忍度。超阈值时按策略处理。

#### **7.2.2 适用模式**

全部三种模式（智能比例、固定额度、倍率）

#### **7.2.3 UI 交互**

![The image shows two screenshots of the UI interface for the follow-up slip setting. On the left, there is a section with a red dashed box highlighting the "最大交易滑点" (maximum trading slip) setting, which is currently set to "默认" (default). On the right, the same "最大交易滑点" setting is shown with a red dashed box, and the value is set to "0.5%" (0.5%). This corresponds to the context describing the UI interaction of the follow-up slip setting, where the default is not set and the pre-set value can be configured from the backend.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NTBiMzU2MzM0ODgyZjZiNjM3MDhkNDlkZGUwNzYwNmZfYmNjYTg3ODllOWQwYzkyNmExNWFmNWIzYWE5ZDhkYzJfSUQ6NzY1NzA0MTMzOTY5MTI1NzU3M18xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>配置项</b></td><td><b>交互</b></td><td><b>范围</b></td><td><b>说明</b></td></tr><tr><td>默认</td><td><ul><li>默认不设置最大交易滑点</li></ul></td><td>--</td><td>合约侧目前用户不设置滑点的情况下 ， 默认不设置滑点下单；与合约侧一致</td></tr><tr><td>自定义</td><td><ul><li>步长0.5%自增<ul><li>例如：<code>0.1%  0.5%  1.0%</code>  </li></ul></li></ul></td><td><ul><li>预设档位从后台配置读取，按配置展示<img name="image.png" alt="The image shows a user interface related to the &#34;跟单滑点设置&#34; (Follow-up Slippage Setting) feature. A highlighted section in the interface displays a table with columns like &#34;配置项&#34; (Configuration Item), &#34;交互&#34; (Interaction), &#34;范围&#34; (Scope), and &#34;说明&#34; (Description). The &#34;配置项&#34; column lists items such as &#34;默认&#34; (Default) and &#34;自定义&#34; (Custom). The &#34;交互&#34; column mentions &#34;步长0.5%自增&#34; (0.5% increment step) for the &#34;自定义&#34; setting. The &#34;范围&#34; column notes &#34;默认不设置最大交易滑点&#34; (Default no maximum trading slippage setting) for the &#34;默认&#34; setting. This image corresponds to the &#34;7.2.3 UI交互&#34; (7.2.3 UI Interaction) section of the document, illustrating the UI configuration of the follow-up slippage setting." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MmQ1NTMxNGIxNWJmZWUyZWZiOGNhNWMzY2ZmODIxM2JfMGMxNzQxYzFjMjU0ODY1MTkyMDYyOWQwZmY2NzgwYmVfSUQ6NzY1NzA0MTQ2Njc4NjYxNTAxMF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM" mime="image/png" scale="1.000000" src="EujGbmXjIob3Baxc6PIlhiRjgOf"/></li></ul></td><td>--</td></tr></tbody></table>

#### **7.2.4 业务规则**

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td><b>方向</b></td><td><b>超滑点条件</b></td><td><b>说明</b></td></tr><tr><td>开多</td><td>跟单员成交价 &gt; 交易员成交价 × (1 + 滑点)</td><td rowspan="2"><ul><li>跟单侧不自己做拦截，把滑点值传给合约 ，复用合约的滑点逻辑 <ul><li>合约划点逻辑：设置最差成交价 → 进撮合逐档吃单 → 吃到划点价还没成交完则取消剩余 → <b>存在部分成交</b></li></ul></li><li>滑点基准价：交易员的成交价</li></ul></td></tr><tr><td>开空</td><td>跟单员成交价 &lt;交易员成交价 × (1 − 滑点)</td></tr></tbody></table>



#### 7.2.5 执行流程

（详见 <cite doc-id="LPYGw1Zvbi2jX3kItlXl7FNhg3b" file-type="wiki" title="【需求文档】PR-01537  合约市价单新增“最大滑点”" type="doc"></cite>）

跟单设置的滑点 = 合约侧用户下市价单设置滑点



**跟单滑点 vs 合约滑点场景说明**

// 跟单设置1% ，满足合约补偿 ，是否要补偿 ，运营确认一下<cite type="user" user-id="ou_7794894c0d13da375826a517c632b477" user-name="Mannual"></cite>与合约逻辑一致

![The image shows a trading platform interface with a "限制最大滑点0.1%" (Limit Maximum Slippage 0.1%) highlighted in a red circle. Below this, there is a "最大滑点" (Maximum Slippage) setting at 1%, along with "买入深度" (Buy Depth) at 404,809.8 USDT and "卖出深度" (Sell Depth) at 44,540.2 USDT. At the bottom, there are "开多" (Buy) and "开空" (Sell) buttons, and the "预估强平价" (Estimated Forced Liquidation Price) shows 0.00000000 USDT. This relates to the context of setting maximum slippage in trading, as mentioned in the document about跟单滑点设置 (Follow-up Slippage Setting).](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MzY2Yjc4Mjg0MGYzYzllNjc5MWIxNDMwNDdmYzU2ZjNfZTJjMDU2ZmUzMmIwZmJiMGU3ZmRlM2Q3Y2RkNDc2ZTVfSUQ6NzY1NzA5NDAxNDMyOTQwOTI1NF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

| **#** | **场景描述** | **跟单滑点设置** | **实际滑点** | 风控滑点 | **判定流程** | **结果** |
|-|-|-|-|-|-|-|
| 1 | 两者均在容忍范围内 | 5% | 1% | 未命中 | 跟单1%<5%→通过 | ✅ 正常成交 |
| 2 | 跟单通过，合约风控命中 | 5% | 1% | 命中2% | 按照风控滑点执行 | ✅ 正常成交 // 如果用户设置低于风控，还是按照风控滑点 --- 按照合约逻辑执行 |
| 3 | 滑点超出，合约拦截 | 2% | 2.5% | 未命中 | 合约实际滑点2.5%>跟单设置2%→拒绝 | ❌ 合约拒绝 ，返回给跟单 |

#### **7.2.6 场景说明**

<table><colgroup><col/><col/><col/><col/><col/></colgroup><thead><tr><th>场景</th><th>前置</th><th>触发</th><th>滑点计算</th><th>结果</th></tr></thead><tbody><tr><td>滑点在设置范围（全部成交）</td><td><ul><li>用户跟单交易员 A</li><li>模式：固定额度，单笔 500 USDT，</li><li>滑点容忍度 0.5%，</li></ul></td><td><ul><li>交易员 A 以市价开多 BTC/USDT，成交价 65,000 USDT，数量 0.1 BTC。</li><li>跟单系统收到信号，交易员成交价 = 65,000 USDT。</li><li>获取当前卖一价 = 65,050 USDT</li></ul></td><td><ul><li>滑点 = (65,050 - 65,000) / 65,000 = 0.077%。</li><li>0.077% &lt; 0.5% → 未超滑点</li></ul></td><td><ul><li>跟单员以市场价约 65,050 USDT 成交，记录滑点 0.077%，用户端无感知，仓位正常建立</li></ul></td></tr><tr><td>滑点在设置范围（部分成交）</td><td><ul><li>同上，滑点容忍度 0.5%</li></ul></td><td><ul><li>交易员 A 市价开多 BTC/USDT，成交价 65,000 USDT，数量 0.1 BTC。</li><li>跟单系统滑点校验通过（0.077%＜0.5%），向合约下单开仓约 0.0077 BTC。</li><li>合约撮合时深度不足，仅成交 0.005 BTC（成交均价 65,080 USDT），剩余 0.0027 BTC 无法成交</li></ul></td><td><ul><li>已成交均价滑点 = (65,080−65,000)/65,000 = 0.123%，＜0.5%，在容忍范围内</li></ul></td><td><ul><li> 已成交 0.005 BTC，开仓有效 </li><li>剩余未成交部分自动撤销 </li><li>跟单：实开 0.005 BTC，滑点 0.12成交跟随的概念 ？ 待定 看我们哪种模式</li></ul></td></tr><tr><td>滑点超限 - 拒绝执行 （全超，无法成交）</td><td><ul><li>同上，滑点容忍度 0.5%</li></ul></td><td><ul><li>交易员 A 以 65,000 成交，跟单系统收到信号时市场卖一价已大幅拉升到 65,600 USDT</li></ul></td><td><ul><li>滑点 = (65,600 - 65,000) / 65,000 = 0.923%。0.923% &gt; 0.5% → 超滑点</li></ul></td><td><ul><li>跟单拒绝执行。交易员有了新仓位，用户跟单列表中没有该笔。</li><li>系统记录超滑点日志</li></ul></td></tr><tr><td>边界值：滑点等于容忍度</td><td><ul><li>同上，滑点容忍度 0.5%</li></ul></td><td><ul><li>当前市场价偏差恰好 0.5%</li></ul></td><td><ul><li>滑点 = 0.5%，等于容忍度</li></ul></td><td><ul><li>视为未超，正常执行。等于容忍度时通过</li></ul></td></tr><tr><td>不同用户不同滑点</td><td><ul><li>用户甲滑点 0.5%，</li><li>用户乙滑点 2.0%，</li><li>同时跟单交易员 A</li></ul></td><td><ul><li>交易员 A 以 65,000 开多，</li><li>市场卖一 65,400（滑点 0.615%）</li></ul></td><td><ul><li>甲：0.615% &gt; 0.5% → 拒绝；</li><li>乙：0.615% &lt; 2.0% → 通过</li></ul></td><td><ul><li>甲不跟单，乙跟单。各自独立判定</li></ul></td></tr><tr><td>合约风控截（跟单通过但合约风控）</td><td><ul><li>用户设置跟单滑点 5%，</li><li>合约该币对风控全局滑点 3%</li></ul></td><td><ul><li>交易员成交价 65,000，</li><li>市场卖一 67,600（滑点 4%）// 这个时候盘口价格已经超出风控的滑点3%无法满足风控滑点 ？</li></ul></td><td><ul><li>合约风控全局3%→按照风控执行</li></ul></td><td><ul><li>按照风控滑点执行</li></ul></td></tr></tbody></table>

### 7.3 保证金模式

#### **7.3.1 功能描述**

跟单用户设置跟随当前交易员的仓位保证金模式：全仓或逐仓。

#### **7.3.2 适用模式**

全部三种模式（智能比例、固定额度、倍率）

#### **7.3.3 UI 交互**

![The image shows the UI interaction of the margin mode in the contract follow-up settings. There are two screenshots side by side, each with a highlighted section in a red dashed box. The highlighted part displays the "保证金模式" (margin mode) setting, which includes options like "智能比例" (smart ratio), "固定额度" (fixed amount), and "倍率" (leverage). This corresponds to the context describing the UI interaction of the margin mode, specifically the fixed mode options of full position and tiered position.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NDRmMGVhYTBhYzNmZjEzZTg4MWJmYWQ3MmVmZmRjZTRfOTkyZmRlNTcwMDljZjU1ZTRlM2JmNGVjMWJhMDEwYThfSUQ6NzY1NzA0ODgzNTQ5NTM4Mjc1NF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

- 固定模式选项：全仓 / 逐仓
- 全仓选中时展示风险提示：全仓模式下，同一交易员的所有跟单仓位共享保证金。任一仓位触发强平时，可能影响其他仓位

#### **7.3.4 业务规则**

（相关文档：<cite doc-id="XJDTdaMy9oqffxxyeu1l37tMgwd" file-type="docx" title="【5.7已上ol】【PR-01665】【合约跟单】新增“智能比例”跟单模式" type="doc"></cite>）

##### 逐仓 / 全仓规则

- 发起跟单时：用户可选择逐仓或全仓
- **跟单进行中：不允许直接切换保证金模式，需要当前交易员没有跟随持仓的情况下可以切换**
- 强平：按合约系统通用强平规则处理

#### **7.3.5 保证金隔离**

**三层隔离**：

```Plain Text
主合约账户（用户自有仓位）           ← 物理隔离（独立保证金池）
        │ 划转
        ↓
跟单子账户 ────────────────────────
  ├── 交易员 A 跟单 ──────────────  ← 逻辑隔离（交易员间独立）
  │   ├── BTC/USDT 仓位
  │   └── ETH/USDT 仓位
  │       （逐仓：仓位间内部隔离 / 全仓：该交易员仓位间共享）
  │
  └── 交易员 B 跟单 ──────────────  ← 逻辑隔离
      └── BTC/USDT 仓位
```

| 原则 | 说明 |
|-|-|
| 物理隔离 | 跟单子账户 ↔ 主合约账户，保证金池完全分离 |
| 逻辑隔离 | 不同交易员间保证金池独立计算，互不影响 |
| 内部隔离 | 同一交易员逐仓仓位间独立；同一交易员全仓仓位间共享 |

#### **7.3.5 详细场景**

<table><colgroup><col/><col/><col/><col/><col/></colgroup><thead><tr><th>场景</th><th>前置</th><th>触发</th><th>计算 / 逻辑</th><th>结果</th></tr></thead><tbody><tr><td>逐仓</td><td><ul><li>固定额度模式，单笔跟单=500 USDT 保证金，杠杆=20x</li><li>最大跟随资产=5,000 USDT</li><li>开 BTC/USDT 和 ETH/USDT 两仓</li></ul></td><td><ul><li>BTC 跌 5% 达到强平价</li></ul></td><td><ul><li>BTC 仓位保证金=500</li><li>ETH 仓位保证金=500</li></ul></td><td><ul><li>BTC 仓位强平按照强平规则处理</li><li>ETH 仓位和剩余最大跟随资产 4,000 不受影响</li></ul></td></tr><tr><td>全仓</td><td><ul><li>同上条件，全仓模式</li></ul></td><td><ul><li>BTC 跌 3%（浮亏 300）</li><li>ETH 涨 3%（浮盈 300）</li></ul></td><td><ul><li>总未实现盈亏=0，保证金率不变</li></ul></td><td><ul><li>盈亏完全对冲，保证金率无变化</li></ul></td></tr><tr><td>全仓</td><td><ul><li>同上</li></ul></td><td><ul><li>BTC 跌 4%（浮亏 400）</li><li>ETH 跌 5%（浮亏 500）</li></ul></td><td><ul><li>总浮亏=900；</li><li>保证金率=(4000+1000-900)/1000=4.1</li></ul></td><td><ul><li>按合约强平规则判定，未触发则继续持仓，触发则按爆仓规则处理</li></ul></td></tr><tr><td>两交易员-均逐仓</td><td><ul><li>A：逐仓 BTC/USDT 保证金 500；</li><li>B：逐仓 BTC/USDT 保证金 600</li></ul></td><td><ul><li>A 的 BTC 仓位强平</li></ul></td><td><ul><li>A 按照强平规则处理</li><li>B 的 600 不受影响</li></ul></td><td><ul><li>同币对不同交易员互不波及</li></ul></td></tr><tr><td>两交易员-均全仓</td><td><ul><li>A：全仓池 1,000；</li><li>B：全仓池 800</li></ul></td><td><ul><li>A 仓位浮亏</li></ul></td><td><ul><li>A 保证金率独立下降</li><li>B 不变</li></ul></td><td><ul><li>A 强平仅损失 A 的保证金</li><li>B 池子安全</li></ul></td></tr><tr><td>混用（逐仓+全仓）</td><td><ul><li>A：逐仓 500；</li><li>B：全仓池 800</li></ul></td><td><ul><li>任一方仓位异常</li></ul></td><td><ul><li>各自独立运作</li></ul></td><td><ul><li>互不干涉</li></ul></td></tr><tr><td>自有仓位+跟单</td><td><ul><li>主账户自有 BTC/USDT 全仓（保证金 2,000）</li><li> 跟单子账户 A 的 BTC/USDT 逐仓（保证金 500）</li></ul></td><td><ul><li>任一方强平</li></ul></td><td><ul><li>物理隔离，不在同一保证金池</li></ul></td><td><ul><li>即使同币对同方向，互不波及</li></ul></td></tr></tbody></table>



### 7.4 杠杆调整

#### **7.4.1 功能描述**

跟单用户设置跟单执行时的杠杆倍数。可选择 跟随交易员 或 自定义 ，自定义杠杆受该币对合约杠杆范围约束。

#### **7.4.2 适用模式**

全部三种模式（智能比例、固定额度、倍率）

#### **7.4.3 UI 交互**

![The image shows the UI interaction of the "7.4.3 UI交互" section in the document. It presents two screenshots of a trading platform interface. The left screenshot highlights the "自定义杠杆值" (Custom Leverage Value) section with a slider and a "自定义" (Custom) option. The right screenshot shows the slider being pulled to the right, with a red dashed rectangle emphasizing the slider area. This corresponds to the context describing the self-defined leverage value interaction, which supports pulling the slider or inputting (needs to be联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动联动](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ODY5ZjQ5ZmI3Mjg3N2ViYzhmMmEzNjQ4NTc2ZDlmYjNfNDQ2MDNmZGQ2ZGJjMTRlYThjOWFkMTFhMGE3NjhmMDFfSUQ6NzY2MDg3NTgzNDM0MDc0MDg0MV8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)



<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>配置项</b></td><td><b>交互</b></td><td><b>默认值</b></td><td><b>范围</b></td></tr><tr><td>杠杆模式</td><td>跟随交易员 / 自定义</td><td>跟随交易员</td><td>--</td></tr><tr><td>自定义杠杆值</td><td>滑块</td><td>—</td><td><ul><li>支持拉杆选择或者输入（需要联动）</li><li>后台配置 （1-20x）</li></ul><img name="image.png" alt="The image shows the UI interface of the contract management backend related to the &#34;Follow Trader&#34; and &#34;Custom&#34; leverage modes. It displays a configuration page with a highlighted section for &#34;General Settings&#34; and a &#34;Follow Trader&#34; option. There is a blue highlighted area with a &#34;Follow Trader&#34; label, and a red dashed rectangle around a &#34;Follow Trader&#34; setting option. The interface includes various configuration options and settings, with some text in Chinese describing the settings. This corresponds to the context about the UI interaction of the leverage adjustment function, specifically the &#34;self-defined leverage value&#34; configuration with a slider and step rule of &#34;following contract leverage&#34;." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NzI0YzcyNmIyMzQ2MjdmMTQ4MzM4MzU5OTMxZWExYzlfNDFmZDU2MGY1MzFhYTkzZmQwNDRlOWY4OGY3MGRiN2ZfSUQ6NzY2MDM5Nzc1Njc2NjM1OTI2Nl8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM" mime="image/png" scale="1.000000" src="HPR8bEXQNohfQ2xyQGdlwH3Kgkc"/><ul><li>步长规则：跟随合约杠杆</li></ul></td></tr></tbody></table>

#### 7.4.4 业务规则

| **场景** | **设定** |
|-|-|
| 跟随交易员 | 每次跟单自动使用交易员当前杠杆 |
| 自定义 | 根据自定义杠杆跟随开仓 |

- **当前交易员没有持仓的情况下，才可进行编辑**

**杠杆与币对范围联动规则**

```Plain Text
用户选择杠杆模式
    │
    ├── 「跟随交易员」
    │   └── 交易员开仓时使用的杠杆 = L
    │       ├── L ≤ 币对最大杠杆？ → 使用 L
    │       └── L > 币对最大杠杆？ → 使用币对最大杠杆（理论上不会出现，交易员开仓受合约杠杆范围约束）
    │
    └── 「自定义」
        └── 用户输入杠杆 = U
            ├── U 在币对范围 [Min, Max] 内 → 使用 U
            ├── U > Max → 自动钳制为 Max，Toast 提示用户
            └── U < Min → 自动钳制为 Min，Toast 提示用户（极少见，通常 Min=1x）
```

#### 7.4.5 场景说明

<table><colgroup><col/><col/><col/><col/><col/></colgroup><thead><tr><th>#</th><th><b>场景</b></th><th><b>设定</b></th><th><b>触发</b></th><th><b>结果</b></th></tr></thead><tbody><tr><td>1</td><td>跟随交易员杠杆（默认）</td><td><ul><li>用户选择「跟随交易员」</li><li>交易员 A 以 20x 杠杆交易 BTC/USDT</li></ul></td><td><ul><li>交易员 A 以 20x 开多 BTC/USDT</li></ul></td><td><ul><li>跟单系统使用 20x 执行。</li><li>特殊情况：用户跟单设置选择【随交易员杠杆】，交易员使用需要kyc的杠杆，则跟单员无法跟随成功，跟单失败（交易员杠杆需KYC）</li></ul></td></tr><tr><td>2</td><td>自定义杠杆（正常范围）</td><td><ul><li>用户自定义 10x，交易员 A 使用 50x</li></ul></td><td><ul><li>交易员 A 以 50x 开多</li></ul></td><td><ul><li>跟单系统使用用户自定义 10x，忽略交易员的 50x</li></ul></td></tr><tr><td>3</td><td>自定义杠杆超过币对最大值</td><td><ul><li>用户自定义 100x，但该币对最大杠杆 25x</li></ul></td><td><ul><li>交易员开仓该币对</li></ul></td><td><ul><li>系统自动钳制为 25x</li></ul></td></tr><tr><td><del>4</del></td><td><del>KYC 限制币对杠杆上限 （千倍杠杆上线后，跟随交易员会出现该情况）</del><br/><del>//子账</del></td><td><ul><li><del>币对BTC/USDT 规则：未完成 KYC 用户杠杆上限 10x，完成 KYC 后上限 125x。</del></li><li><del>用户未完成 KYC，自定义杠杆 50x。交易员在该币对使用 100x 杠杆</del></li></ul></td><td><ul><li><del>交易员在BTC/USDT 以 100x 杠杆开仓</del></li></ul></td><td><ul><li><del>跟单系统检测到币对 KYC 限制 → 用户实际杠杆取 min(自定义杠杆, KYC 上限) = min(50x, 10x) = 10x </del></li><li><del>以 10x 执行跟单，若保证金足够 → 正常开仓，杠杆钳制为 10x </del></li></ul></td></tr><tr><td>5</td><td>杠杆降低导致可开数量不满足最小开仓-固定额度（跟单失败）</td><td><ul><li>用户跟单交易员 A</li><li>模式：固定额度 30 USDT，自定义杠杆 2x</li><li>交易员 A 以 100x 杠杆开仓 BTC/USDT</li><li>合约最小下单量 0.001 BTC，开仓价 65,000 USDT</li></ul></td><td><ul><li>交易员 A 以 100x 杠杆市价开仓</li></ul></td><td><grid><column width-ratio="0.300000"><img name="image.png" alt="The image shows a trading platform interface related to the &#34;7.4.5场景说明&#34; section about leveraged trading. It displays options like &#34;全仓&#34;, &#34;2x&#34;, &#34;赠金下单&#34;, &#34;开仓&#34;, and &#34;平仓&#34;. The &#34;开仓&#34; tab is highlighted. The &#34;可用&#34; balance is 38.29 USDT, with &#34;限价&#34; set to &#34;市价&#34; and &#34;限制最大滑点0.1%&#34;. The &#34;成本&#34; is 30 USDT, marked with &#34;最小下单数量为0.001 BTC&#34;. Below, there are &#34;买入0.000 BTC&#34; and &#34;卖出0.000 BTC&#34; options, and &#34;开多&#34; and &#34;开空&#34; buttons. The pre-estimated margin is 30 USDT, and the pre-estimated opening amount is 61.5 USDT." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NDE2ODQyNGEyZDA4ZjI2YWZlNjkxMTY5ZGM1ODExMGRfMDA4MTA2OTY4OWVlNTQ2ODdlYThmMTFjOTgwZTIzNTNfSUQ6NzY1ODExNzM1OTAwNTYwMTUwMV8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM" mime="image/png" scale="0.347926" src="MAqrb21BDo4c8gxNZVulBF0dguc"/></column><column width-ratio="0.700000"><ul><li>保证金 = 30 USDT（固定额度不变）</li><li>仓位价值 = 30 × 2 = 60 USDT </li><li>可开数量 = 60 / 65,000 ≈ 0.00092 BTC </li><li> 0.00092 BTC ＜ 最小下单量 0.001 BTC → 跟单失败</li></ul><p></p></column></grid></td></tr><tr><td>6</td><td>杠杆降低导致可开数量不满足最小开仓-智能比例（跟单失败）</td><td><ul><li>用户跟单交易员 A</li><li>模式：智能比例，跟单金额 231 USDT，自定义杠杆 2x</li><li>交易员 A 总权益 5,000 USDT，以 100x 开仓 BTC/USDT 保证金 650 USDT（占比 13%）</li><li>合约最小下单量 0.001 BTC，开仓价 65,000 USDT</li></ul></td><td><ul><li>交易员 A 以 100x 杠杆市价开仓</li></ul></td><td><ul><li>保证金 = 231 × 13% ≈ 30 USDT </li><li>仓位价值 = 30 × 2 = 60 USDT </li><li> 可开数量 = 60 / 65,000 ≈ 0.00092 BTC </li><li> 0.00092 BTC ＜ 最小下单量 0.001 BTC → 跟单失败</li></ul></td></tr><tr><td>7</td><td>杠杆降低导致可开数量不满足最小开仓-倍率（跟单失败）</td><td><ul><li>用户跟单交易员 A</li><li>跟单模式：倍率 1x（与交易员等量开仓），自定义杠杆 3x</li><li>跟单员账户可用余额：20 USDT</li><li>交易员 A 以 100x 杠杆、市价开多 0.1 BTC，开仓价 65,000 USDT</li><li>合约最小下单量：0.001 BTC</li></ul></td><td><ul><li>交易员 A 以 100x 杠杆市价开仓</li></ul></td><td><ul><li>交易员开仓 0.1 BTC，倍率 1x 下跟单员需等量开仓 0.1 BTC。</li><li>跟单员可用余额 20 USDT，自定义杠杆 3x：</li><li>最大可开仓位价值 = 20 × 3 = 60 USDT</li><li>等量跟单所需仓位价值 = 0.1 × 65,000 = 6,500 USDT</li><li>所需保证金 = 6,500 ÷ 3 = 2,166.67 USDT ≫ 20 USDT（跟单保证金）→ 跟单失败</li></ul></td></tr><tr><td>8</td><td>杠杆降低后可开数量仍满足最小开仓（跟单成功）</td><td><ul><li>用户跟单交易员 A</li><li>模式：固定额度 50 USDT，自定义杠杆 5x</li><li>交易员 A 以 100x 杠杆开仓 BTC/USDT</li><li>合约最小下单量 0.001 BTC，开仓价 65,000 USDT</li></ul></td><td><ul><li>交易员 A 以 100x 杠杆市价开仓</li></ul></td><td><ul><li>保证金 = 50 USDT </li><li> 仓位价值 = 50 × 5 = 250 USDT </li><li> 可开数量 = 250 / 65,000 ≈ 0.0038 BTC </li><li> 0.0038 BTC ≥ 最小下单量 0.001 BTC → 正常跟单开仓 </li></ul></td></tr><tr><td colspan="5">//跟单这块如果因为杠杆导致不满足最小开仓 ，走合约不满足最小开仓拒绝  。。等于说 ，跟单的所有下单只是传参数下单，是否满足下单条件由合约判断。能不能下单合约说了算，拒绝了就把原因告诉用户。跟单不做单独的逻辑判断 .。。</td></tr></tbody></table>

### 7.5 复制仓位

#### 7.5.1 功能描述

用户发起跟单时，可选择如何处理交易员当前已有的持仓。此为**一次性操作**——仅在发起跟单瞬间执行，后续交易员新开仓按正常跟单流程处理。

#### 7.5.2 UI交互

![The image shows the UI interface of the "复制仓位" (Copy Position) function in the Fxall platform. It displays two side-by-side screenshots of the contract position settings page, with a red dashed rectangle highlighting the "复制所有持仓" (Copy All Positions) option. This option, as described in the context, allows users to follow a trader by copying all their existing positions at the market price, with parameters set by the user (amount/proportion/leverage/guaranteed mode) in proportion. The interface also shows other settings like "保证金模式" (Margin Mode) and "杠杆" (Leverage), with a current profit/loss indicator of +12.92%.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NjY5N2Y1ZDAzZjk4MzJiZjA0NzZmOTI0ZWI2NGZiNDNfMzMzNDE3MzRmZWIyZjc3YTM3MzdiMmRmYmJiNTMwNGJfSUQ6NzY1NzA0NzY5ODc3NTkwMzk2NF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

- 默认「复制价格更好的持仓」
- 选中态以 ✓ 标记
- 展开时显示完整列表，三个选项均可直接点击切换

| 模式 | 行为 | 使用场景 |
|-|-|-|
| **复制所有持仓** | 跟单后以市价复制该交易员所有现有仓位，按用户设定的跟单参数（金额/比例/杠杆/保证金模式）成比例复制 | 用户信任交易员全部持仓，希望完全对齐 |
| **复制价格更好的持仓**  <br/>**（默认）** | 跟单后仅复制当前最新价**优于**交易员开仓价的现有仓位。买入仓位：最新价 < 交易员开仓价即为"更好"；卖出仓位：最新价 > 交易员开仓价即为"更好" | 用户希望以比交易员更优价格入场，不追高 |
| **不复制现有持仓** | 跟单后不复制任何现有仓位，仅从下一笔新开仓开始跟单 | 用户只希望跟随未来交易 |

#### 7.5.3  复制价格更好的持仓 判定逻辑

```Plain Text
对于交易员的每个现有仓位：

买入方向（多仓）：
  if 当前市场买一价 < 交易员开仓价 → 「更好」 → 复制
  if 当前市场买一价 ≥ 交易员开仓价 → 「非更好」 → 不复制

卖出方向（空仓）：
  if 当前市场卖一价 > 交易员开仓价 → 「更好」 → 复制
  if 当前市场卖一价 ≤ 交易员开仓价 → 「非更好」 → 不复制
```

**仅复制开仓价格优于或等于交易员入场价格的仓位。**

#### 7.5.4 复制执行流程

```Plain Text
用户发起跟单，选择持仓复制模式
    ↓
┌─ 复制所有持仓 ────────────────────────
│  遍历交易员所有现有仓位：
│    对每个仓位，按用户跟单参数生成一笔市价委托
│    → 仓位规模按跟单模式计算（智能比例/固定额度/倍率）
│    → 杠杆按用户杠杆设置
│    → 保证金模式按用户选择
│    → 方向与交易员一致
│  所有复制委托发送完毕 → 跟单建立
│
├─ 复制价格更好的持仓 ──────────────────
│  遍历交易员所有现有仓位：
│    ├── 判定最新价是否优于开仓价 → 是 → 同上生成复制委托
│    └── 判定最新价不优于开仓价 → 跳过，不复制
│  有可复制的仓位 → 发送复制委托
│
└─ 不复制现有持仓 ──────────────────────
   仅建立跟单关系，不产生任何复制委托
   等待交易员下一笔新开仓信号
```

#### 7.5.5 场景说明

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>场景</b></th><th><b>设定</b></th><th><b>操作</b></th><th><b>结果</b></th></tr></thead><tbody><tr><td>复制所有持仓</td><td><ul><li>交易员 A 有 BTC 多仓（开仓 65,000，当前 65,500）和 ETH 空仓（开仓 3,000，当前 2,950）。</li><li>用户选择固定额度 500 USDT，杠杆 10x</li></ul></td><td><ul><li>用户发起跟单，选择「复制所有持仓」</li></ul></td><td><ul><li>复制出 BTC 多仓（0.077 BTC）和 ETH 空仓（1.69 ETH），</li><li>按跟单参数执行</li></ul></td></tr><tr><td>复制价格更好的-部分符合</td><td><ul><li>同上，但 ETH 空仓开仓 3,000，当前 2,950（卖一价 2,950 &lt; 开仓价 3,000，对空仓不优）</li></ul></td><td><ul><li>用户选择「复制价格更好的持仓」</li></ul></td><td><ul><li>BTC 多仓：当前 65,500 &gt; 开仓 65,000 → 不优，不复制。ETH 空仓：当前 2,950 &lt; 开仓 3,000 → 不优，不复制。结果：0 个仓位复制</li></ul></td></tr><tr><td>复制价格更好的-全部符合</td><td><ul><li>交易员 BTC 多仓开仓 65,000，当前 64,500（更低价买入）。ETH 空仓开仓 3,000，当前 3,100（更高价卖出）</li></ul></td><td><ul><li>用户选择「复制价格更好的持仓」</li></ul></td><td><ul><li>BTC：64,500 &lt; 65,000 → 更优，复制。ETH：3,100 &gt; 3,000 → 更优，复制。两仓均复制</li></ul></td></tr><tr><td>不复制现有持仓</td><td><ul><li>交易员有 3 个现有仓位</li></ul></td><td><ul><li>用户选择「不复制现有持仓」</li></ul></td><td><ul><li>不产生任何复制委托。仅建立跟单关系。交易员下一笔新开仓才开始跟单</li></ul></td></tr><tr><td>保证金不足复制</td><td><ul><li>用户跟单子账户余额 800 USDT，交易员 3 个仓位需总保证金 1,200 USDT</li></ul></td><td><ul><li>选择「复制所有持仓」</li></ul></td><td><ul><li> 可以跟 ，按照开仓时间跟随 ，失败的订单返回失败原因</li></ul></td></tr></tbody></table>

### 7.6 三个参数交叉场景

三个维度做穷举交叉验证：

**智能比例模式**

| # | 组合条件 | 异常场景 |  |
|-|-|-|-|
| 1 | P ≈ 0（交易员权益极大、仓位极小） | 保证金 ≈ 0 → 仓位价值 ≈ 0 → 可开数量 ＜ 最小下单量 → 跟单失败 |  |
| 2 | P ≈ 1（交易员几乎全仓） | 保证金 ≈ 跟单金额，风险可控；但交易员爆仓风险极高，跟单连锁爆仓 |  |
| 3 | 跟单金额 × P ＞ 可用余额 | 保证金不足 → 直接失败 |  |
| 4 | KYC/币对钳制后实际杠杆降低 | 仓位价值缩水 → 可开数量可能跌破最小下单量 |  |

**固定额度模式**

| # | 组合条件 | 异常场景 |
|-|-|-|
| 1 | 单笔跟单 × 实际杠杆 ÷ 开仓价 ＜ 最小下单量 | 仓位价值不足 → 数量不达标 → 跟单失败 |
| 2 | 单笔跟单 ＞ 可用余额 | 保证金不足 → 直接失败 |
| 3 | 单笔跟单极大 + 高杠杆 | 仓位价值可能超过合约单次开仓上限 → 按照合约逻辑 |
| 4 | KYC/币对钳制后实际杠杆降低 | 仓位价值缩水 → 同 #1 |

**倍率模式**

| 序# | 组合条件 | 异常场景 |
|-|-|-|
| 1 | 倍率极低（如 0.01x）+ 交易员小仓位 | 仓位价值极小 → 数量直接低于最小下单量 |
| 2 | 倍率极高（如 10x）+ 交易员大仓位 | 仓位价值巨大 → 保证金不足 |
| 3 | KYC/币对钳制后实际杠杆降低 | 仓位价值缩水 → 可开数量可能跌破最小下单量 |

**三模式交叉风险**

| # | 跨模式场景 | 说明 |
|-|-|-|
| 1 | 杠杆钳制链：用户杠杆 → KYC 上限 → 币对上限，三重 min 叠加 | 实际杠杆可能远低于用户预期，三种模式都会因此产生数量不足或保证金不足 |
| 2 | 最小下单量校验缺失 | 三种模式在计算完可开数量后必须统一做 ≥ 最小下单量校验，任一模式漏掉即出现异常仓位 |
| 3 | 账户余额在触发→下单之间被其他操作消耗 | 校验时余额够，下单时余额不足 → 并发一致性问题 |

### 7.7 确认弹窗

确认弹窗新增内容

![The image shows a confirmation pop-up window with red dashed rectangles highlighting key information. The window contains text such as "100.00 USDT" and "100.00 USDT", likely related to financial amounts. There are also some Chinese characters, including "确认信息" (Confirm Information) and "确认" (Confirm). The context mentions "确认弹窗新增内容" (new content in the confirmation pop-up), indicating this is the updated confirmation window with added information.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YjQ2NmRlOTljNzUzYzQ1NjM4NDI2ZDQ2N2ZmOTE1MDVfZWMwYzMxYWYxZWU5OTM0MjY5OTI2Njc2ZWM3M2I3NzFfSUQ6NzY2MDA5MTM5NDY5NDA1NzY5Ml8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

### 7.8 跟随设置页面提示文案删除

三个跟随模式删除底部提示文案 。

![The image shows the "Contract Follow-up Settings" interface of the platform. There are two red-highlighted sections: one labeled "Follow-up Mode" with options like "USD" and "BTC" and a toggle switch, and another labeled "Follow-up Amount" with a percentage input field. On the right side, there is a circular chart displaying various trading pairs and their corresponding percentages, along with a red-highlighted section showing "-1.58%" in a box. This interface is related to the context of contract follow-up settings, as mentioned in the document's section about "7.7确认弹窗" (7.7 Confirmation Pop-up) and "7.9后台新增配置展示" (7.9 Backend New Configuration Display).](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZGQxMDQ4ZDg5NzZjNDA2ZDUwYjRhMGQwMDMyNDNjNTdfMDVjNjY5Yzg4ZmNkZWM3YTcxOTdjMjg4MzlhZTdmYmNfSUQ6NzY1NzA3ODA1MzYzMzM4MDA3MF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

### 7.9 后台新增配置展示

<table><colgroup><col/><col/></colgroup><thead><tr><th>页面</th><th>说明</th></tr></thead><tbody><tr><td>【合约管理后台】--【合约跟单】--【Kol列表】</td><td><img name="image.png" alt="The image shows a user interface related to the &#34;Kol列表&#34; (Kol List) in the Contract Management Backend (CMB). It displays a table with columns like &#34;交易员&#34; (Trader), &#34;交易品种&#34; (Trading Product), &#34;保证金模式&#34; (Margin Mode), &#34;杠杆&#34; (Leverage), etc. A blue dashed rectangle highlights a specific row, and the right side has a &#34;Rectangle&#34; settings panel with options such as &#34;Position&#34;, &#34;Layout&#34;, &#34;Appearance&#34;, and &#34;Stroke&#34;. This corresponds to the context mentioning adding new fields for margin mode, leverage, and maximum trading spread for follow traders, with some configurations temporarily unsupported." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NDM0Y2YwN2YzMGU1MzBmYTJlNTU2ZTdkOGE3MGY1ZjFfNDAyMDU5YWNjM2M2ZmYwNjhhNTAwODVkY2ZmYTQyNmJfSUQ6NzY2MDA5MTk2MDI4MzUwMDI1OF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM" mime="image/png" scale="1.000000" src="QePjbLnsjoMvWQxh1ZQlkdXYgAd"/><ul><li>新增该交易员支持跟随杠杆<del>和滑点 </del><ul><li>暂时不支持特定配置，后期看跟随等级开发单独针对交易员配置</li></ul></li><li>导出新增该字段</li></ul></td></tr><tr><td>【合约管理后台】--【合约跟单】--【跟单者管理】</td><td><img name="image.png" alt="The image shows a user interface related to the &#34;Kol列表&#34; page in the Contract Management Backend&#39;s &#34;合约跟单&#34; section. There are two red-dashed rectangular boxes highlighting specific areas on the left side of the interface. On the right side, there is a &#34;Rectangle&#34; settings panel with options like &#34;Position&#34;, &#34;Layout&#34;, &#34;Appearance&#34;, &#34;Stroke&#34;, and &#34;Effects&#34;. This image is part of the context describing the backend configuration changes, such as adding support for follow leverage and sliding points, and displaying new fields like margin mode, leverage, and maximum transaction spread for follow traders." href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=NGUyODI2N2NmOGI4YThmMDAwMzBmZjljYzU1NWI2ZTZfMTRhMTIwYmFhNjUyYWMxYjU5YTdmMTE4MDI2Yzc5NTZfSUQ6NzY2MDA5MjIyMTA3MjQyODc2M18xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM" mime="image/png" scale="1.000000" src="URhCbR2sfonHKrxyzOmlsTydglf"/><ul><li>原有【跟单后复制全部仓位】按照跟随者选项展示</li><li>新增 保证金模式/杠杆<del>/最大交易滑点 </del>按照跟随者选项展示</li><li>导出新增该字段</li></ul></td></tr></tbody></table>

### 7.10 其他优化内容

1. **优化一：**

   1. **【现状】：**如下图说明
   2. **【优化后】：**“跟单者”设置“跟随参数”时，【跟单后复制全部仓位】的字段 取值：跟单者**选中的跟单币对**下的**“带单仓位”**数

![The image shows a screenshot of a webpage with a dark background and some text in green and red. There are two highlighted areas: "区域一" (Area 1) and "区域二" (Area 2). Area 1 is marked with a red box and contains text about "带单者带单的仓位数" (the number of positions brought by the follower) and mentions "btc, link" as two positions. Area 2 is another red-boxed area with some text. The image is related to the context discussing optimization content, specifically the first optimization point about "跟单者" setting "跟随参数" and the field value of "跟单后复制全部仓位" (copying all positions after following).](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YmM5OTMzNWViMWU2YmFjYmYyMWQzZDZjMDZjNDlkYzdfNjdmYjk2Y2RlNzhiNTc3Njg0ZTA3NTQ5NWIyOTg0NmZfSUQ6NzY1OTc1NjQ4NDU2MTA4MDAzMV8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)

 

1. **优化二：**

   1. **App 及 web前台：**
   
      ![The image shows the "开通合约账户" (Open Contract Account) pop-up window in the contract follow-up interface. It contains a green checkmark icon, a message about the risks of contract trading, a checkbox for agreeing to the contract service agreement, and a "立即开通" (Immediately Open) button. There is a red circle highlighting the close icon (×) at the top right of the window. This relates to the optimization content in the document where entering the follow-up square requires triggering the contract account opening pop-up logic, and the existing pop-up is used without displaying the close icon.](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MjMxMDNjYjc2NGRhMWMwNjRmYzBkYjQxMzhkNzkyMjhfZTlhNTVmYzI4OTg2MzgxMmU1ZjdiNjJkMDk5MjM4OWZfSUQ6NzY1OTc2NTcxMzQ1MTYxODAyNF8xNzg0ODk0NzQwOjE3ODQ4OTgzNDBfVjM)
   
      1. **进入【跟单广场】时，需要触发：必须**开通合约 的弹窗逻辑
      2. 沿用现有弹窗 ，不展示【关闭】icon ，点击【空白处】不可取消

# ~~八、通知消息~~

> 列单独一个需求

| 场景 | 触发条件 | 渠道 | **文案** | **去重规则** |  |
|-|-|-|-|-|-|
| 连续滑点超限 | 同一交易员连续 N 笔（默认 10，后端可配置）跟单因滑点超限未执行 | 站内信  | 「您跟随的交易员「{name}」最近连续 {count} 笔跟单因滑点超限未执行。建议调高滑点容忍度或暂停跟单。」 | 同一交易员同类型 24h 内最多 1 次 | // 补充失败原因 ，前后台展示 |
| 复制仓位完成 | 现有持仓复制执行完毕 | 站内信  | 「已按「{mode}」模式复制交易员「{name}」的 {copied}/{total} 个现有仓位。」 | 每次跟单发起生成 1 条 |  |
| 复制仓位部分失败 | 部分仓位因滑点/余额等原因未复制 | 站内信 | 「复制交易员「{name}」仓位时，{copied} 个成功、{skipped} 个跳过（原因：{reason}）。」 | 每次发起生成 1 条 |  |



# 九、埋点

// 后期



# 十、验收标准

### ~~10.1 跟单滑点设置~~

- [ ] ~~用户可在跟单设置中选择预设滑点档位（后台配置项）~~

- [ ] ~~滑点 = 容忍度时正常执行；滑点 > 容忍度时拒绝执行~~

- [ ] ~~当前交易员无跟随持仓的情况下才可修改参数值~~

- [ ] ~~不同用户不同滑点设置，同一交易员信号下各自独立判定~~

- [ ] ~~触发合约风控全局滑点 ，走风控滑点~~

- [ ] ~~超滑点拒绝/取消的委托有日志可查询~~

### 10.2 保证金模式

- [ ] 用户可选择逐仓或全仓，默认与交易员一致

- [ ] 当前交易员无跟随持仓的情况下才可修改参数值，有跟单进行中不允许切换保证金模式

- [ ] 逐仓：仓位间保证金隔离，单仓强平不影响其他仓位，按合约强平规则

- [ ] 全仓：同交易员仓位共享保证金，按合约强平规则

- [ ] 不同交易员间保证金池独立

### 10.3 杠杆调整

- [ ] 用户可选择「跟随交易员」或「自定义」杠杆

- [ ] 自定义杠杆超出跟随币对上限 → 自动钳制 

- [ ] 当前交易员无跟随持仓的情况下才可修改参数值

### 10.4 现有持仓复制模式

- [ ] 发起跟单时提供「复制所有持仓」「复制价格更好的持仓」「不复制现有持仓」三个选项

- [ ] 默认选中「复制价格更好的持仓」

- [ ] 「复制所有持仓」：以市价按跟单参数复制交易员全部现有仓位

- [ ] 「复制价格更好的持仓」：仅复制市价优于开仓价的仓位，判定逻辑正确（买入：市价<开仓价；卖出：市价>开仓价）

- [ ] 「不复制现有持仓」：不产生任何复制委托

- [ ] 复制仓位使用用户设定的杠杆和保证金模式，非交易员仓位参数

- [ ] 复制仓位前进行保证金校验，不足时提示用户

- [ ] 复制完成后生成通知消息

### 10.5 通用

- [ ] 所有设置按交易员独立保存

- [ ] 所有设置修改在 App 和 Web 端实时同步

### 10.6 后台

- [ ] KOL列表展示新增字段

- [ ] 跟单者管理展示新增字段
