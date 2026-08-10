---
sourceName: "需求 PRD (extracted, localized assets)"
sourceType: "doc"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/docx/P2xud4WYyoapp6xfjskl7UI3gKc"
derivedFrom: "prd-latest.md"
syncedAt: "2026-08-10T13:10:49.420Z"
readOnly: true
---

<title>【待排期开发】【PR-02265】外部做市商账户工具--合约业务类型--支持配置负手续费率</title>

# 一、变更记录

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td><b>时间</b></td><td><b>版本号</b></td><td><b>变更人</b></td><td><b>主要变更内容</b></td></tr><tr><td>2026-8-6</td><td>/</td><td><cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite></td><td>创建文档</td></tr><tr><td>2026-8-7</td><td>/</td><td><cite type="user" user-id="ou_6e76055c146cbd51e1c0ef8793caef2b" user-name="Lucky"></cite></td><td>内审会议：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgajvx487942o8759584v1<br/>与业务侧对齐的一次会议：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgakvbl9cgypvw78tq5646<br/>与业务侧对齐的二次会议：<br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgap4u64w8f9944a462en6</td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

# 二、评审记录

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td><b>评审时间</b></td><td><b>参与人员</b></td><td><b>结论</b></td></tr><tr><td>2026-8-7</td><td><cite type="user" user-id="ou_3ff7cb42ee8639e5ad09e35906e7a09f" user-name="Willem"></cite><cite type="user" user-id="ou_3b07f7144efb73c86edac1e8b610f8b6" user-name="Will"></cite><cite type="user" user-id="ou_8a01b11d51aad8e328fad4cdc08912a7" user-name="Brad"></cite><cite type="user" user-id="ou_f9e409190a355409ac44fcc17cab6f51" user-name="Milo"></cite><cite type="user" user-id="ou_6a4d04d23f39631efe83c83a1f01fa75" user-name="Rullin"></cite><cite type="user" user-id="ou_545e2b0108f3e3d40da2cd45d75f730d" user-name="Zeke"></cite><cite type="user" user-id="ou_c8afb8c28ccb3c2f288613b466169500" user-name="Tracy"></cite><cite type="user" user-id="ou_8e4061bba550ab2fc1b132bc3aa7f69a" user-name="Fly"></cite><cite type="user" user-id="ou_91861d6da6cf6822e08045ba1868241e" user-name="Aven.tong"></cite></td><td>一次评审会议：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgamu6znahm19mz6ji4r62<br/><b>二次对齐评审会议：</b><br/>https://qfglxo2m3dc.sg.larksuite.com/minutes/obsgaql83lhls464517x46be</td></tr></tbody></table>



# 三、需求背景

因目前对接外部合约做市商，需支持配置负费率以实现返佣；未来可能出现更多类似的外部合作场景，因此本次也一并支持负费率的配置能力。



# 四、需求List

**原型地址：** /

**UI地址：/**

| **模块** | **变更类型** | **说明** |
|-|-|-|
|  |  |  |



---





# 五、产品方案

## **5.1 【优化】【业务类型=合约做市账户】允许 手续费率 字段配置负值** 

**操作路径：**【现货管理后台】--【资产管理】--【做市账户工具】--【外部做市商账号】--【添加】：业务类型=合约做市账户

![The image shows the interface of the "External Market Maker Account Tool" in the "Contract" business type. The top part has a list of account information with columns like "Account ID", "Name", "Status", etc. The bottom part is a pop-up window titled "Add External Market Maker Account", with fields such as "Account ID", "Name", "Status", "Contract", "Contract Type", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "Contract Status", "](assets/img-001.png)

### **现状如下表：**

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>字段名称</b></th><th><b>组件类型</b></th><th>是否必填</th><th><b>说明</b></th></tr></thead><tbody><tr><td>开仓 Maker 手续费</td><td>数值输入框</td><td>是</td><td rowspan="4"><ol><li seq="1"><b>输入框提示语：</b>请输入</li><li><b>固定单位：</b>%</li><li><b>精度：</b>6位（输入超出6位键入无反应）</li><li><b>输入校验：</b><ol><li seq="1">仅支持正数</li><li><b>键入非法内容：</b>自动清空数据，报错提示</li></ol><p>请输入【0，100】之间的数字，精度支持6位</p><img name="image.png" alt="The image shows the input interface for &#34;开仓Maker手续费&#34; (Open Position Maker Fee). It is a numerical input box with a red border, displaying &#34;如 0.000002 %&#34;. Below the input box, there is a prompt: &#34;请输入【0，100】之间的数字，精度支持6位&#34; (Please input a number between 0 and 100, with a precision of 6 digits). This corresponds to the context describing the current status of the &#34;开仓Maker手续费&#34; field, which is a numerical input box requiring input of a percentage between 0 and 100 with a precision of 6 digits." mime="image/png" scale="0.305901" src="assets/img-002.png"/></li><li><b>非空校验：</b><ol><li seq="1"><b>触发时机：</b>鼠标失焦 或 点击确定触发</li><li><b>报错提示：</b>对应“必填字段”下 报错提示：请输入</li></ol></li></ol></td></tr><tr><td>开仓 Taker 手续费</td><td>数值输入框</td><td>是</td></tr><tr><td>平仓 Maker 手续费</td><td>数值输入框</td><td>是</td></tr><tr><td>平仓 Taker 手续费</td><td>数值输入框</td><td>是</td></tr></tbody></table>

### **优化后如下表：**

<table><colgroup><col/><col/><col/><col/></colgroup><thead><tr><th><b>字段名称</b></th><th><b>组件类型</b></th><th>是否必填</th><th><b>说明</b></th></tr></thead><tbody><tr><td>开仓 Maker 手续费</td><td>数值输入框</td><td>是</td><td rowspan="4"><ol><li seq="1"><b>输入框提示语：</b>请输入</li><li><b>固定单位：</b>%</li><li><b>精度：</b>6位（输入超出6位键入无反应）</li><li><b>输入校验：</b><ol><li seq="1">支持负数、正数</li><li><b>键入非法内容：</b>自动清空数据，报错提示</li></ol><p>请输入【-100,100】之间的数字，精度支持6位</p><img name="image.png" alt="The image shows a component interface for &#34;开仓 Maker 手续费&#34; (Open Position Maker Fee). A red-highlighted input box displays &#34;如 0.000002 %&#34;, indicating the fee value format. Below the input box, there is a prompt &#34;请输入数值，精度支持6位&#34; (Please input a number, precision supports 6 digits). This relates to the context about optimizing the business type of external maker accounts, where the fee rate configuration supports negative values, and the input box specifies the required precision for entering fee numbers." mime="image/png" scale="0.204545" src="assets/img-003.png"/></li><li><b>非空校验：</b><ol><li seq="1"><b>触发时机：</b>鼠标失焦 或 点击确定触发</li><li><b>报错提示：</b>对应“必填字段”下 报错提示：请输入</li></ol></li></ol></td></tr><tr><td>开仓 Taker 手续费</td><td>数值输入框</td><td>是</td></tr><tr><td>平仓 Maker 手续费</td><td>数值输入框</td><td>是</td></tr><tr><td>平仓 Taker 手续费</td><td>数值输入框</td><td>是</td></tr><tr><td><b>组件框底部常驻提示文案</b></td><td>--</td><td>--</td><td><ol><li seq="1"><b>【手续费率排职】新增、编辑的费率配置：</b>需要即时生效</li><li><b>在现状基础上新增提示文案：</b>按对应订单类型分别收取，负值表示返佣费率(如-0.000001)<img name="image.png" alt="The image shows the &#34;添加外部做市商账户&#34; interface. It includes fields for inputting coefficients, with highlighted red text stating &#34;按对应订单类型分别收取，负值表示返佣费率(如-0.000001)&#34;. Below this, there are descriptions: &#34;生效规则:以上费率按「账号x币对」维度精确匹配，交易对应币对时自动应用配置费率&#34; and &#34;外部做市商账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准&#34;. This corresponds to the optimization of the &#34;业务类型=合约做市账户&#34; where the fee rate configuration field allows negative values, with the added prompt that negative values indicate rebates." mime="image/png" scale="0.204947" src="assets/img-004.png"/></li><li><b>优化蓝色底框的描述文案：</b><p>1.生效规则:以上费率按「账号x币对」维度精确匹配，交易对应币对时自动应用配置费率</p><p>2.外部做市商账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准。</p><img name="image.png" alt="The image shows the &#34;添加外部做市商账户&#34; (Add External Maker Account) interface. It includes fields for inputting coefficients, opening Maker/Taker fees, closing Maker/Taker fees, and a description section. A red-highlighted blue box at the bottom contains two key descriptions: &#34;生效规则:以上费率按「账号x币对」维度精确匹配，交易对应币对时自动应用配置费率&#34; (Effective rule: The above fees are precisely matched by &#39;account x trading pair&#39; dimension, and applied automatically when trading the corresponding trading pair) and &#34;外部做市商账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准&#34; (If the external maker account is configured in both the [External Maker] table and the [Fee Discount] table, the fee rate in the [External Maker] table shall prevail)." mime="image/png" scale="0.211377" src="assets/img-005.png"/></li></ol></td></tr></tbody></table>

### 外部做市表业务类型=现货做市账户 **添加、编辑**

**操作路径：**【现货管理后台】--【资产管理】--【做市账户工具】--【外部做市商账号】--【添加】：业务类型=现货做市账户

#### **3.1 优化蓝色底框的描述文案：**

1.生效规则:以上费率按「账号x币对」维度精确匹配，交易对应币对时自动应用配置费率

2.外部做市商账号若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。

![The image shows the interface of adding an external ECN account in the trading system. It displays a pop-up window titled "添加外部做市商账户" (Add External ECN Account) with fields for selecting the account type as "现货做市账户" (Spot ECN Account), choosing the trading pair, and entering the "最低Taker手续费率" (Minimum Taker Fee Rate) and "最低Maker手续费率" (Minimum Maker Fee Rate) as negative values (-0.000002%). There is a note below stating "负值表示返佣 (如 -0.000001)" (Negative values indicate rebates). The interface also includes a description field and buttons for "取消" (Cancel) and "保存" (Save).](assets/img-006.png)



### 现货管理后台--基础配置

**操作路径：**【现货管理后台】--【用户管理】--【会员等级】--【基础配置】

**4.1 用户白名单配置 添加、编辑**

**新增蓝色底框的描述文案（样式以下图为准）：**账号若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。

![The image shows a user interface of the trading platform's user whitelist configuration. There is a red-highlighted blue bottom box with the text "账号交易的币对若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准." (If the trading pairs of accounts in both the \[External Market Maker\] table and the \[Member Level - Basic Configuration\] table are configured, the fee rate in the \[External Market Maker\] table shall prevail.). This corresponds to the context which mentions adding and editing whitelist configurations and the new blue bottom box description.](assets/img-007.png)

**4.2 币对白名单配置 添加、编辑**

**新增蓝色底框的描述文案（样式以下图为准）：**账号交易的币对若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。

![The image shows the interface of the exchange management system's user whitelist configuration. A pop-up window titled "编辑用户白名单" (Edit User Whitelist) is displayed, with fields for "用户对" (User Pair), "有效期" (Validity Period), "指定Taker手续费率" (Specified Taker Fee Rate), and "指定Maker手续费率" (Specified Maker Fee Rate). The "指定Maker手续费率" field is highlighted with a red box, and there is a yellow warning text below it stating "账号交易的币对若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准" (If the trading pairs of the account are configured in both the \[External Market Maker\] table and the \[Member Level - Basic Configuration\] table, the fee rate from the \[External Market Maker\] table shall prevail).](assets/img-008.png)



### 基础配置

**操作路径：**【合约管理后台】--【手续费】--【手续费折扣】添加、编辑

**5.1 新增蓝色底框的描述文案（样式以下图为准）：**该账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准。

![The image shows the interface of the Contract Management Backend's Fee Discount page. A pop-up window titled "添加手续费配置" (Add Fee Configuration) is displayed, listing multiple entries with "手续费" (Fee) and percentage values. At the bottom of the pop-up, there is a red warning text: "手续费率字段配置，如低于0则显示为负手续费率，不能配置为负100%" (The fee rate field configuration, if lower than 0, will be displayed as negative fee rate, cannot be configured as -100%). This corresponds to the context about allowing negative fee rate configuration for the External Market Maker Account.](assets/img-009.png)



---



## 5.2 负费率返佣逻辑

<callout emoji="😇">
**同步背景：**费率扣除、计算方式、发放用的流水类型，本次需求没有动（均是现状存在的）
</callout>

1. **返佣出款账户：**底层的 手续费出款账户
2. **出账规则：**【对应做市商账号】触发负费率成交**产生开仓或平仓手续费时**，从该账户扣减对应金额，转入对应的做市商账号合约账户中（同时生成对应流水）
3. **对应做市商账号收款账户：**合约账户
4. **资金流转示意**

```Plain Text
[做市商成交] → 判断该侧费率是否为负
    ├─ 费率配置为正 → 手续费从「做市商账户」扣除 → 转入「平台手续费收入账户」
    └─ 费率配置为负 → 返佣从「手续费出款账户」扣除 → 转入「对应的做市商账号的合约账户」
```



1. **角色互斥合约经纪人 与 外部做市商 不会是同一用户；**合约经纪人 也不会同时属于某个 VIP 等级。**结论：**领负费率返佣的外部做市商，不会同时是赚手续费返佣的经纪人
2. **核心规则：**负费率返佣 **不参与** 手续费返佣计算

   - 负费率是"**平台倒给用户的钱**"，不是"用户支付的手续费"，**不计入手续费返佣基数**。

     - 手续费返佣**只按【交易所正向收入 = 用户实际支付的手续费】汇总计算**。
     - **合约手续费抵扣**：用户该笔手续费 **≥ 0（未实付）→ 不产生合约手续费的抵扣流水**
     - **VIP 负费率等级**用户拿到的负费率返佣（用户进钱），该笔**不给其上级返佣**。
3. **成交底表**

   - 需**按【用户视角】区分手续费【＋ / －】符号**（现状不区分）；



---



## 5.3 前台/后台展示规则（正数化处理）

1. 展示层转换规则

<table><colgroup><col/><col/><col/></colgroup><thead><tr><th><b>场景</b></th><th><b>外部做市商户配置的费率</b></th><th><b>前台h5、app、web展示方式</b></th></tr></thead><tbody><tr><td>手续费流水（正常收费）</td><td>正数</td><td>账单显示："手续费 -12.5 USDT"</td></tr><tr><td>返佣流水（负费率触发）</td><td>负数</td><td><ol><li seq="1">与现有“手续费流水”共用一个流水类型：开仓手续费、平仓手续费</li><li><b>显示eg：</b>开仓手续费：+8.3 USDT</li></ol></td></tr></tbody></table>

1. 【上方第1点展示层转换规则】需要同步处理以下的点

<table><colgroup><col/><col/><col/></colgroup><thead><tr><th><b>产品形态</b></th><th>操作路径</th><th><b>示例图</b></th></tr></thead><tbody><tr><td rowspan="4">前台app、web、h5</td><td>合约账户--资金流水：开仓手续费、平仓手续费</td><td><img name="image.png" alt="The image shows a &#34;资金流水&#34; (funds flow) interface of a contract account. It displays a list of transactions with columns for type, currency, quantity, and time. The &#34;USDT&#34; currency is selected, and the date range is from 2025/7/22 to 2025/8/6. A red box highlights the &#34;开仓手续费&#34; (opening fee) and &#34;平仓手续费&#34; (closing fee) entries, which are part of the contract account&#39;s funds flow as mentioned in the context about the product scheme&#39;s front-end/web/h5 display rules for contract account funds flow." mime="image/png" scale="1.000000" src="assets/img-010.png"/></td></tr><tr><td>合约交易--资金流水：开仓手续费、平仓手续费</td><td><img name="image.png" alt="The image shows a trading platform interface of FAMEX. It displays various trading-related information, including a chart with bars, a balance section with USDT amounts, and a user account section. The key part is the red-highlighted &#34;平仓手续费&#34; (Closing Fee) column in the table, which lists multiple entries of closing fees in USDT for trades involving BTC-USD and ETH-USD pairs. This corresponds to the context about the front-end app/web/h5 display rule for contract trading - funding flow, specifically showing the closing fee in the contract account - funding flow." mime="image/png" scale="1.000000" src="assets/img-011.png"/></td></tr><tr><td>合约交易--历史成交：手续费</td><td><img name="image.png" alt="The image shows a trading platform interface related to the &#34;5.3前台/后台展示规则（正数化处理）&#34; section. It displays historical transactions with red boxes highlighting key fields. The left red box points to the &#34;历史成交&#34; (Historical Transactions) tab, and the right red box focuses on the &#34;平仓手续费&#34; (Closing Fee) column, showing specific fee amounts like &#34;655.57640000 USDT&#34; and &#34;12.09787500 USDT&#34;. This corresponds to the context describing how to display fees in the front-end app/web/h5 for contract trading historical transactions." mime="image/png" scale="1.000000" src="assets/img-012.png"/></td></tr><tr><td>合约交易--仓位历史记录：手续费</td><td><img name="image.png" alt="The image shows a trading platform interface related to the product scheme of external market makers&#39; account tools for the contract business type. It displays a chart on the left and a table of transaction records on the right. A red box highlights a negative number &#34;-1,131,099.70150&#34; in the table, which is likely the fee amount mentioned in the context about正数化处理 (positive number processing) for contract trading - historical transactions. This reflects the display rule of fees in the contract trading - historical transactions section of the platform." mime="image/png" scale="1.000000" src="assets/img-013.png"/></td></tr><tr><td>现货管理后台</td><td>现货管理后台--用户管理：某个用户详情--合约账户--资金流水tab：开仓手续费、平仓手续费</td><td><img name="image.png" alt="The image shows a user management interface in the现货管理后台 (Spot Management Backend). It displays basic user information such as UID, username, and status. The key focus is on the &#34;开仓手续费&#34; (Open Position Fee) field under the &#34;资金流水&#34; (Funding Flow) section, which is highlighted with a red box. This corresponds to the context mentioning that in the现货管理后台, the user management page&#39;s contract account&#39;s funding flow tab includes open position and close position fees." mime="image/png" scale="1.000000" src="assets/img-014.png"/></td></tr><tr><td rowspan="5">合约管理后台</td><td>合约管理后台--数据查询--仓位_已平仓：开平仓手续费字段</td><td><img name="image.png" alt="The image shows the interface of the Contract Management Backend (CMB) data query page for &#34;Position_Held&#34;. It displays a table with columns including Order ID, Position ID, Contract, Direction, User Type, etc. A red box highlights the &#34;Position_Held&#34; column, which is related to the context mentioning &#34;合约管理后台--数据查询--仓位_持仓中：开平仓手续费字段&#34;. This reflects the product scheme of front-end and back-end display rules (positive number processing) for the contract business type." mime="image/png" scale="1.000000" src="assets/img-015.png"/></td></tr><tr><td>合约管理后台--数据查询--仓位_持仓中：开平仓手续费字段</td><td><img name="image.png" alt="The image shows the &#34;仓位_持仓中&#34; (Position - Holding) page of the Contract Management Backend (CMB). It displays user ID, position ID, contract, position size, opening time, etc. There is a red box highlighting the &#34;开平仓手续费&#34; (Open/Close Fee) column, which is the key focus. This corresponds to the context mentioning &#34;合约管理后台--数据查询--仓位_持仓中：开平仓手续费字段&#34; (Contract Management Backend - Data Query - Position_Holding: Open/Close Fee field), demonstrating the display rule of the open/close fee in the CMB." mime="image/png" scale="1.000000" src="assets/img-016.png"/></td></tr><tr><td>合约管理后台--数据查询--成交记录：真金手续费</td><td><img name="image.png" alt="The image shows the &#34;成交记录&#34; (Transaction Records) page of the Contract Management Backend. It displays a list of transactions with columns including &#34;交易&#34; (Trade), &#34;账户&#34; (Account), &#34;商户类型&#34; (Merchant Type), &#34;商户名称&#34; (Merchant Name), &#34;商户ID&#34; (Merchant ID), &#34;商户流水号&#34; (Merchant流水号), &#34;商户手续费&#34; (Merchant Fee), &#34;商户手续费率&#34; (Merchant Fee Rate), &#34;商户手续费金额&#34; (Merchant Fee Amount), &#34;商户手续费类型&#34; (Merchant Fee Type), &#34;商户手续费状态&#34; (Merchant Fee Status), &#34;商户手续费备注&#34; (Merchant Fee Remark), and &#34;商户手续费时间&#34; (Merchant Fee Time). The &#34;商户手续费&#34; (Merchant Fee) column is highlighted with a red box, showing the actual transaction fees." mime="image/png" scale="1.000000" src="assets/img-017.png"/></td></tr><tr><td>合约管理后台--手续费--用户级别：贡献手续费</td><td><img name="image.png" alt="The image shows a webpage interface of the contract management backend, specifically the &#34;User Fee Info&#34; page under the &#34;User Management&#34; section. The interface displays user-level fee information, with a red box highlighting the &#34;Contribution Fee&#34; field. The left sidebar includes options like &#34;User Management&#34;, &#34;User Fee Info&#34;, etc. The main content area shows a user with a USDT contract, a fee PUID, and a time range from 2024-08-05 to 2024-08-04. This corresponds to the context describing the display rule of the &#34;Contribution Fee&#34; in the contract management backend." mime="image/png" scale="1.000000" src="assets/img-018.png"/></td></tr><tr><td>合约管理后台--资产--流水查询：开仓手续费、平仓手续费</td><td><img name="image.png" alt="The image shows the &#34;流水查询&#34; page of the contract management backend. It displays a table with columns including UserUID, 代币 (currency), 类型 (type), and 时间 (time). A red box highlights the &#34;开仓手续费&#34; (opening fee) and &#34;平仓手续费&#34; (closing fee) options in the type dropdown menu. This corresponds to the context describing the display rules for front-end and back-end interfaces, specifically showing the location of opening and closing fees in the contract management backend&#39;s data query section." mime="image/png" scale="1.000000" src="assets/img-019.png"/></td></tr></tbody></table>



---



## 5.4 异常情况处理

| **异常场景** | **处理建议** |
|-|-|
| 手续费出款账户余额不足 | 不阻断交易本身（做市商正常挂单、成交不受影响），另外这个账户目前可以出现负数么？。。。。 |
| 负费率配置后又改回正数 | 交易时**按当时获取到的的费率计算**，历史已结算的返佣流水**不受后续费率修改影响**，不做追溯调整 |



---



## **5.5 查询**

**操作路径：**【现货管理后台】--【资产管理】--【做市账户工具】--【做市账户管理】--【外部做市商】

1. **下图查询页面：**手续费率字段的值兼容“负的手续费率”显示

![The image shows the "做市账户管理" page in the "外部做市商" section of the "资产管理" module in the "现货管理后台". The "手续费率" field is highlighted in red, displaying values like "-0.00000001" and "-0.00000002", which are negative numbers. This corresponds to the context stating that the fee rate field's value can display "negative fee rate" after configuring negative fee rate.](assets/img-020.png)



---



## 5.6 以上的总结

1. **核心逻辑（与现有手续费一致，方向相反）**

   - 手续费计算口径、精度、舍入、结算时点等**全部复用现有手续费逻辑**，不新增独立算法。
   - **差异仅在方向：** 
   
     - **正费率**：按 |费率| 从用户的账户**扣除**手续费；
     - **负费率**：按 |费率| 计算返佣，**不扣除、改为新增**，返佣金额**直接计入该做市账户的合约账户余额**。
     - **所以对应的流水是+号：**即"手续费"由"收"变为"加"，其余链路与普通手续费完全一致。
2. **作用范围与口径**

   - **仅业务类型 = 合约做市账户** 支持将手续费率配置为负值。
   - **maker / taker、开仓 / 平仓口径沿用现有已区分的逻辑**，负费率按对应口径生效，无需额外区分设计。
3. **自成交**

   - 外部做市商侧**是否允许自成交保护需要看配置**，核心是taker、maker手续费加总>0，对于交易所就不亏，那么这一点就依据**业务侧同学配置**走就行了
4. **返佣预算上限**

   - 目前没有控制，依据配置的手续费率为准
5. **入账**：返佣按现有手续费结算规则走，直接**新增至该做市账户的合约账户余额内**（与现有手续费入账/扣减为同一链路，方向相反）。
6. **展示（正数化）：**前台 / 后台按 5.3「正数化处理」规则展示返佣（率 / 额不出现负号）





---

---

---



## 5.7 权限

1. 不涉及



## 5.8 埋点

1. 不涉及



## 5.9 核心验收标准

**注：**下方只是产品侧标记的核心验收项，具体验收测试用例**以测试同学产出为准！**

<sheet sheet-id="uwyfAZ" token="OoeSs7l5xhJy4Xtl40mliE0sgPf"></sheet>



---
