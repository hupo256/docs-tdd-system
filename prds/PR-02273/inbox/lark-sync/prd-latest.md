---
sourceName: "需求 PRD"
sourceType: "doc"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/docx/OrRpd3exfoM2nKxD9uRlUZalgZ6"
syncedAt: "2026-08-11T17:30:43.590Z"
readOnly: true
command: "lark-cli docs +fetch --api-version v2 --doc https://qfglxo2m3dc.sg.larksuite.com/docx/OrRpd3exfoM2nKxD9uRlUZalgZ6 --doc-format markdown --as user --format json"
---

<title>【PR-02273】增强体验金改为保证金模式</title>

## 1. 前言

<callout emoji="📋">
**需求背景：**现有增强体验金设计，当仓位发生亏损、手续费或资金费时，优先扣除用户自有资金，自有资金不足的部分由增强体验金承担。
**现状痛点**：根据运营数据测算，在使用增强体验金仓位中，约52%的仓位亏损金额超过用户自有资金可承担金额，超出部分需由增强体验金承担，成为平台体验金成本的重要来源。
**本次改造目标**：参考竞品的保证金使用模式**，**增强体验金仅作为保证金参与开仓保证金不再作为交易结算资金。**不参与亏损/手续费/资金费的抵扣**，且不参与强平价计算，降低平台体验金成本。
</callout>

# 版本信息

<grid>
<column width-ratio="0.333333">
<callout emoji="⏰">
版本号：V1.0
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="📆">
创建日期 2026-08-10
</callout>
</column>
<column width-ratio="0.333333">
<callout emoji="👮">
审核人
</callout>
</column>
</grid>



# 变更日志

| **时间** | **版本号** | **变更人** | **主要变更内容** |
|-|-|-|-|
| 2026-08-11 |  | Iris | 创建文稿 |
|  |  |  |  |
|  |  |  |  |

# 评审记录

| 评审**时间** | 参与人员 | **结论** |
|-|-|-|
|  |  |  |
|  |  |  |
|  |  |  |

# 文档说明

## 基础业务标准

1、**增强体验金 业务规则优化**，涉及大数据组处理

2、福利中心侧相关统计查询的敏感信息脱敏展示

<cite doc-id="H9WsdHvwZoLWc0xVEg1lK0w7gsf" file-type="docx" title="业务-数据组上下游对照表" type="doc"></cite>

<cite doc-id="RpDxdh53HoacPrxjj9wlXa2ag5f" file-type="docx" title="PR-01268 【审计】手机/邮箱脱敏展示/加密传输" type="doc"></cite>



# 竞品分析

| **竞品** | **说明** |
|-|-|
| Deepcoin | 不可抵扣类型可用于开平仓合约交易，盈利可全部提取。  <br/>到期后，平台可能取消所有限价挂单，并在市价平仓后回收体验金。  <br/>体验金适用于任意币种交易和杠杆倍数，产生的盈利可划转和提现。  <br/>提现、划转或者到期后体验金将被回收。  <br/>https://www.deepcoin.com/ps/zh/helpcenter/article/22 |

# 文档说明

### 名词解释

| 术语 / 缩略词 | 说明 |
|-|-|
| 自有资金 | 用户充值、划转及交易盈利形成的合约账户资金，可用于保证金、亏损、手续费和资金费 |
| ~~增强体验金~~ | ~~平台发放的虚拟保证金权益卡券，用于合约交易的保证金，并不支持抵扣~~ |
| 保证金模式 | 是指增强体验金：仅可用于开平仓合约交易（作为保证金），不参与资金费/手续费/平仓亏损的抵扣；盈利可全部提取 |
| ~~已使用状态~~ | **~~该增强体验金曾实际用于开仓，并且当前已经结束使用、完成回收~~**~~，不是指体验金被亏损或费用消耗完。~~ |
| 已失效状态 | 直接到期回收或因划转、手动过期、系统失效而失效回收 |

# 需求范围

| 模块 | 本期支持内容 |
|-|-|
| 增强体验金 | 纯保证金不可抵扣 |
| 运营后台 | 使用规则，隐藏， 即，未到期前增强体验金都有效，可作为保证金开仓使用。 |
| 开仓 | 以增强体验金作为保证金参与开仓；开平仓全程不参与抵扣，其他规则不变（币对、杠杆） |
| 持仓管理 | 保证金率、预估强平价展示（**不含增强体验金余额，剔除处理**） |
| 平仓/结算 | 手动平仓、到期自动平仓、触发强平，ADL |
| 回收 | 划转、爆仓、到期、手动过期、手动失效 要 回收增强体验金 |
| 兼容 | 存量卡券、委托、仓位及旧版 APP 处理 |

非本需求范围：普通合约体验金（按比例抵扣，保持现状）

## 需求目标

- 将增强体验金统一调整为合约开仓保证金。
- 增强体验金不进入亏损及费用结算。
- 保证开仓额度、强平计算、资金结算和回收四类口径相互独立且可对账。
- 保证 C 端、运营后台、财务流水、风控及帮助中心规则一致。

# 功能详细说明

## 体验金总额 （改动）

= 可用体验金 + 使用中体验金；

使用中体验金包含委托冻结和开仓占用

可用体验金=总额-委托冻结和开仓占用

## **可用（改动） ：**

=可用真金+可用体验金

可用体验金=可用与开仓的= 增强体验金总额 - 委托冻结金额 - 开仓占用金额

## 交易结算与释放

手续费扣减金额 = 应付手续费，**仅扣自有资金**
应付资金费扣减金额 = max(应付资金费, 0)，**仅扣自有资金**
平仓亏损扣减金额 = max(-已实现盈亏, 0)，**仅扣自有资金**

增强体验金交易结算扣减金额 = 0

- 自有资金不足时不得自动改扣增强体验金，按照现有的风险控制流程处理（如阶梯减仓、爆仓、穿仓等）。

注：结算按比例释放体验金回可用的逻辑还在

## 预估强平价 / 实际爆仓价

**增强体验金不计入维持保证金能力，在计算预估强平价与实际爆仓价时，不计算增强体验金余额。**

- 预估强平价，**剔除增强体验金后的有效保证金/权益**计算；仅用现有预估强平公式中的用户自有资金相关项
- 实际爆仓价，同样**不纳入增强体验金余额**；仅用现有实际强平公式中的用户自有资金相关项
- 保证金率，"增强体验金"不计入总保证金；
- 维持保证金率，"增强体验金"不计入总保证金；

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td></td><td><b>编号</b></td><td><b>流程</b></td><td><b>说明</b></td></tr><tr><td>目前的公式</td><td>1</td><td>计算保证金率</td><td><ol><li seq="1"><b>#保证金率#</b><b>=仓位总保证金 / </b><b><del>∑全部币对仓位的标记价值</del></b><b>    </b><b>当前仓位的标记价值</b></li></ol><br/>（一般保证金率是指 维持保证金/总保证金，我们的需要用户自己去和维持保证金率+taker平仓费率对比）<ol><li>#仓位总保证金#=现金余额+体验金可用+∑全仓未实现盈亏-∑其他仓位最低维持保证金占用</li><li>#仓位最低维持保证金占用#=张数*单张数量*最低风险限额等级对应的 MMR</li><li>#仓位标记价值#=张数*单张数量*标记价格</li><li>#全仓账户权益#=现金余额+体验金可用+∑全仓未实现盈亏</li><li>#仓位实际保证金#=#现金余额#=总入金-总出金+资金费用+所有已实现盈亏+手续费-∑逐仓订单占用保证金-∑逐仓仓位占用保证金-∑全仓委托占用保证</li><li>#可用余额#=现金余额-∑全仓仓位占用保证+Min（0，未实现盈亏）</li></ol><br/>   （全仓的盈利无法拿来开仓）</td></tr><tr><td>改造后的公式</td><td>1</td><td>计算保证金率</td><td><ol><li seq="1"><b>#保证金率#</b><b>=仓位总保证金 / </b><b><del>∑全部币对仓位的标记价值</del></b><b>    </b><b>当前仓位的标记价值</b></li></ol><br/>（一般保证金率是指 维持保证金/总保证金，我们的需要用户自己去和维持保证金率+taker平仓费率对比）<ol><li>#仓位总保证金#=现金余额<del>+体验金余额</del>+∑全仓未实现盈亏-∑其他仓位最低维持保证金占用</li><li>#仓位最低维持保证金占用#=张数*单张数量*最低风险限额等级对应的 MMR</li><li>#仓位标记价值#=张数*单张数量*标记价格</li><li>#全仓账户权益#=现金余额+体验金可用+∑全仓未实现盈亏</li><li>#仓位实际保证金#=#现金余额#=总入金-总出金+资金费用+所有已实现盈亏+手续费-∑逐仓订单占用保证金-∑逐仓仓位占用保证金-∑全仓委托占用保证</li><li>#可用余额#=现金余额-∑全仓仓位占用保证+Min（0，未实现盈亏）</li></ol><br/>   （全仓的盈利无法拿来开仓）</td></tr><tr><td>目前的公式</td><td></td><td>双向持仓-全仓（开仓）<br/><b>预估强平价</b></td><td><b>#预估强平价#</b><b>  = [ (现金余额 + 体验金可用 + ∑全仓未实现盈亏-预计开仓手续费) - (标记价格 × 多仓数量 - 标记价格 × 空仓数量) - 订单方向 × 预估成交价 × 订单数量 - ∑其他合约全仓仓位最低维持保证金占用 ] / [ (维持保证金率 + 平仓Taker费率) × (同向仓位数量 + 订单数量) - (多仓数量 - 空仓数量 + 订单方向 × 订单数量) ]</b><ul><li>#现金余额#=总入金-总出金+资金费用+所有已实现盈亏+手续费-∑逐仓订单占用保证金-∑逐仓仓位占用保证金-∑全仓委托占用保证</li><li>∑全仓未实现盈亏为当前全仓账户的总未实现盈亏</li><li>多仓数量 / 空仓数量为当前 合约的持仓的数量，若无仓位则取 0</li><li>#预计开仓手续费#=订单数量*预计成交价*Taker 费率</li><li>#仓位最低维持保证金占用#=张数*面值*最低风险限额等级对应的 MMR</li><li>MMR 取第一档的维持保证金率</li></ul><br/><em>推导思路：</em><br/><em>通过现有公式 仓位总保证金 / ∑新仓位的标记价值 = 维持保证金率+当前交易对平仓Taker 费率  时触发强平，推导获得</em><br/><em>#∑新仓位的标记价值# =（同向仓位数量+订单数量）*预估强平价</em><br/><em>#仓位总保证金#=现金余额+体验金可用+∑新全仓未实现盈亏-∑其余合约全仓仓位最低维持保证金占用</em><br/><em>#∑新全仓未实现盈亏# = ∑全仓未实现盈亏+（预估强平价-标记价格）*  多仓数量+（标记价格-预估强平价）*  空仓数量+订单方向*（预估强平价-预估成交价）*订单数量</em><br/><cite doc-id="QadTw1Kj0iMwcwkiKiIlOFCfgxg" file-type="wiki" title="PR-01319 合约开仓页面增加“预估强平价”" type="doc"></cite></td></tr><tr><td>目前的公式</td><td></td><td>单向持仓-全仓（开仓）<br/><b>预估强平价</b></td><td><b>#预估强平价#</b><b>  = [ (现金余额 + 体验金可用 + ∑全仓未实现盈亏-预计开仓手续费) - (标记价格 × 多仓数量 - 标记价格 × 空仓数量) - 订单方向 × 预估成交价 × 订单数量 - ∑其他合约全仓仓位最低维持保证金占用 ] / [ (维持保证金率 + 平仓Taker费率) × (同向仓位数量 + 订单数量) - (多仓数量 - 空仓数量 + 订单方向 × 订单数量) ]</b><ul><li>#现金余额#=总入金-总出金+资金费用+所有已实现盈亏+手续费-∑逐仓订单占用保证金-∑逐仓仓位占用保证金-∑全仓委托占用保证</li><li>∑全仓未实现盈亏为当前全仓账户的总未实现盈亏</li><li>多仓数量 / 空仓数量为当前 合约的持仓的数量，若无仓位则取 0</li><li>#预计开仓手续费#=订单数量*预计成交价*Taker 费率</li><li>#仓位最低维持保证金占用#=张数*面值*最低风险限额等级对应的 MMR</li><li>MMR 取第一档的维持保证金率</li></ul><br/><em>推导思路：</em><br/><em>通过现有公式 仓位总保证金 / ∑新仓位的标记价值 = 维持保证金率+当前交易对平仓Taker 费率  时触发强平，推导获得</em><br/><em>#∑新仓位的标记价值# =（同向仓位数量+订单数量）*预估强平价</em><br/><em>#仓位总保证金#=现金余额+体验金可用+∑新全仓未实现盈亏-∑其余合约全仓仓位最低维持保证金占用</em><br/><em>#∑新全仓未实现盈亏# = ∑全仓未实现盈亏+（预估强平价-标记价格）*  多仓数量+（标记价格-预估强平价）*  空仓数量+订单方向*（预估强平价-预估成交价）*订单数量</em><br/><cite doc-id="QadTw1Kj0iMwcwkiKiIlOFCfgxg" file-type="wiki" title="PR-01319 合约开仓页面增加“预估强平价”" type="doc"></cite></td></tr><tr><td>改造后的公式</td><td></td><td>双向持仓-全仓（开仓）<br/><b>预估强平价</b></td><td><b>#预估强平价#</b><b>  = [ (现金余额</b><b><del> + 体验金余额 </del></b><b>+ ∑全仓未实现盈亏-预计开仓手续费) - (标记价格 × 多仓数量 - 标记价格 × 空仓数量) - 订单方向 × 预估成交价 × 订单数量 - ∑其他合约全仓仓位最低维持保证金占用 ] / [ (维持保证金率 + 平仓Taker费率) × (同向仓位数量 + 订单数量) - (多仓数量 - 空仓数量 + 订单方向 × 订单数量) ]</b><ul><li>#现金余额#=总入金-总出金+资金费用+所有已实现盈亏+手续费-∑逐仓订单占用保证金-∑逐仓仓位占用保证金-∑全仓委托占用保证</li><li>∑全仓未实现盈亏为当前全仓账户的总未实现盈亏</li><li>多仓数量 / 空仓数量为当前 合约的持仓的数量，若无仓位则取 0</li><li>#预计开仓手续费#=订单数量*预计成交价*Taker 费率</li><li>#仓位最低维持保证金占用#=张数*面值*最低风险限额等级对应的 MMR</li><li>MMR 取第一档的维持保证金率</li></ul><br/><em>推导思路：</em><br/><em>通过现有公式 仓位总保证金 / ∑新仓位的标记价值 = 维持保证金率+当前交易对平仓Taker 费率  时触发强平，推导获得</em><br/><em>#∑新仓位的标记价值# =（同向仓位数量+订单数量）*预估强平价</em><br/><em>#仓位总保证金#=现金余额+体验金可用+∑新全仓未实现盈亏-∑其余合约全仓仓位最低维持保证金占用</em><br/><em>#∑新全仓未实现盈亏# = ∑全仓未实现盈亏+（预估强平价-标记价格）*  多仓数量+（标记价格-预估强平价）*  空仓数量+订单方向*（预估强平价-预估成交价）*订单数量</em></td></tr><tr><td>改造后的公式</td><td></td><td>单向持仓-全仓（开仓）<br/><b>预估强平价</b></td><td><b>#预估强平价#</b><b>  = [ (现金余额 </b><b><del>+ 体验金余额 </del></b><b>+ ∑全仓未实现盈亏-预计开仓手续费) - (标记价格 × 多仓数量 - 标记价格 × 空仓数量) - 订单方向 × 预估成交价 × 订单数量 - ∑其他合约全仓仓位最低维持保证金占用 ] / [ (维持保证金率 + 平仓Taker费率) × (同向仓位数量 + 订单数量) - (多仓数量 - 空仓数量 + 订单方向 × 订单数量) ]</b><ul><li>#现金余额#=总入金-总出金+资金费用+所有已实现盈亏+手续费-∑逐仓订单占用保证金-∑逐仓仓位占用保证金-∑全仓委托占用保证</li><li>∑全仓未实现盈亏为当前全仓账户的总未实现盈亏</li><li>多仓数量 / 空仓数量为当前 合约的持仓的数量，若无仓位则取 0</li><li>#预计开仓手续费#=订单数量*预计成交价*Taker 费率</li><li>#仓位最低维持保证金占用#=张数*面值*最低风险限额等级对应的 MMR</li><li>MMR 取第一档的维持保证金率</li></ul></td></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>

-
-

**补充公式**

## 生命周期与状态

### 状态机改造

状态定义对照（改造前后）

<table><colgroup><col/><col/><col/><col/><col/></colgroup><tbody><tr><td><b>状态</b></td><td><b>改造前</b></td><td><b>改造后（增强体验金）</b></td><td><b>前端展示</b></td><td><b>按钮</b></td></tr><tr><td>待领取</td><td>待使用</td><td>卡券已发放，用户尚未领取</td><td>待使用</td><td>领取</td></tr><tr><td>使用中</td><td>使用中</td><td>用户领取成功，增强体验金进入合约账户，未过期</td><td>使用中</td><td>去交易</td></tr><tr><td>已使用（完）</td><td>按比例抵扣消耗完</td><td><del>开过仓（曾占用体验金），过期/到期时，只要开过仓 → 标记已使用完</del></td><td><del>已使用</del></td><td><del>已使用</del></td></tr><tr><td>已失效</td><td>过期/回收</td><td><del>领取过但从未开仓，</del>直接过期回收，操作：手动过期，系统回收、划转回收</td><td>已失效</td><td>已失效</td></tr><tr><td colspan="5">合约体验金的状态不变，还是改造前的状态</td></tr></tbody></table>

### 到期自动平仓（过期失效）（改造）

以服务器标准时间计算到期时间；达到到期/持仓时长后，系统自动发起市价平仓，取消所有限价挂单；平仓后完成结算、**回收增强体验金、**更新券状态；不影响用户真实资产。

#### 到期处理

- 无仓无单：立即回收全部增强体验金。
- 有委托或持仓：撤销相关委托，按规则市价平仓，释放冻结金额后回收。
- 回收增强体验金，但用户交易盈利正常划转至合约账户。
- 异常处理：撤单或平仓失败，保持待回收状态，持续重试并告警。

### 触发强平（改造）

达到强平阈值（剔除增强体验金后的风险率）时，增强体验金不参与计算，不抵扣亏损和费用，系统按市价结束仓位；**回收增强体验金**

### 划转失效

- 划转失效提示及逻辑不变，划转后会平仓/撤单+回收增强体验金
- 可提现、可划转金额不包含增强体验金本金。
- 异常处理：回收失败时，不得先执行划转。

### 手动过期

- 手动过期提示及逻辑不变，手动过期回收增强体验金

### 系统失效（改造）

- 管理后台，操作手动失效，处理同划转失效，回收增强体验金



## 极端场景（）：

配资50% 开100倍， 1% 就爆了，合约保证金小于维持保证金





客商保护：1、开进去就爆 会拦截；2刚好开进去，波动一点就爆，



### **不回收的场景：**

<table><colgroup><col/><col/></colgroup><tbody><tr><td>场景</td><td>增强体验金处理</td></tr><tr><td>正常平仓，</td><td>到期前，<b>体验金按比例释放，可继续使用</b></td></tr><tr><td>ADL</td><td><b>ADL，</b>按平仓的比例释放占用，不回收增强体验金<cite type="user" user-id="ou_5ce1e622c15e12a75924305e7933724f" user-name="Wolf"></cite><br/><b><del>A按减仓比例释放占用，不回收增强体验金</del></b><br/>（盈利减完 减亏损的）</td></tr><tr><td>阶梯减仓</td><td>按减仓比例释放占用，不回收增强体验金</td></tr></tbody></table>

# Web / App 页面设计

## 福利中心—增强体验金卡片

<table><colgroup><col/><col/><col/><col/></colgroup><tbody><tr><td>区域</td><td>字段/交互</td><td>展示规则</td><td>原型</td></tr><tr><td>主按钮</td><td>领取/ 去使用 /  已失效</td><td>不变， 去掉“已使用（使用完）”状态</td><td rowspan="2"><img name="image.png" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=ZmMzM2E3ZjRlZWVlMTY3YTJjYTJhN2QwMzJiMDU2OGJfOWVkYTk1MzI1ODcxNmUwMGNiNTU2MWE2MDZkNTRiN2ZfSUQ6NzY3MjM5NzM0NjQ3ODU3NTMyN18xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM" mime="image/png" scale="1.000000" src="UKUlbwzzYoQzFmxrKbblimy9gGd"/></td></tr><tr><td>提示说明</td><td>可与自有资金一起作为合约保证金使用，盈利可全部提取。</td><td>详情弹窗展示完整</td></tr></tbody></table>

## 福利中心—合约增强体验金领取弹窗

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>字段</td><td>规则</td><td>原型</td></tr><tr><td>文案说明</td><td>可与自有资金一起作为合约保证金使用，盈利可全部提取。</td><td><img name="image.png" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MjM3ODMzMDk4ZTg1ZTkxZjM3MjBkODQ5Y2M2NWMxM2ZfOGY1ODA4NjY4Yzc3MTE1ZWNjNTQyOGFmNzQ0NWNkZDJfSUQ6NzY3MjM5Nzg3NDAzODA2NjkxMF8xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM" mime="image/png" scale="1.000000" src="SHIrbS7fnoKFhMxlWbBlPUzpgAf"/></td></tr><tr><td>抵扣比例</td><td>改为配资比例</td><td></td></tr><tr><td>使用方式</td><td>删除，不展示</td><td></td></tr></tbody></table>



## 体验金详情弹窗

与按比例抵扣体验金区分 ，按比例抵扣体验金详情页不变， 仅增强体验金详情页改造

<table><colgroup><col/><col/><col/></colgroup><tbody><tr><td>字段</td><td>规则</td><td>原型</td></tr><tr><td>体验金名称</td><td>新增卡券类型【增强体验金】</td><td></td></tr><tr><td>已领取</td><td>已激活改为已领取</td><td rowspan="7">    <img name="image.png" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=OTc4NTg2OGJkZWI1MmM4Y2U3NmQyOTc3ZjFiM2JmYzRfOTRiOGVjMWJmZDQyMDk5OWFhZWRhMGZhZTVlZTVmZDFfSUQ6NzY3MjQwMzkwODMzMjkxNjQ1MF8xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM" mime="image/png" scale="1.000000" src="FG2dbPNptotM9KxAY2Nlg6d6gbh"/></td></tr><tr><td>可用体验金</td><td>由 体验金余额 改为 可用体验金<br/>=总额-使用中体验金</td></tr><tr><td>使用中体验金</td><td>已使用体验金改为 “使用中体验金”，<br/>由抵扣消耗的体验金改为：开仓交易委托冻结和仓位占用的增强体验金<br/>问题是：已使用 与 普通合约体验金的逻辑不一致</td></tr><tr><td>文案说明</td><td>可与自有资金一起作为合约保证金使用，盈利可全部提取。</td></tr><tr><td>使用规则</td><td>删除，不展示</td></tr><tr><td>配资比例</td><td>抵扣比例 改为 配资比例</td></tr><tr><td>按钮</td><td>隐藏查看使用详情按钮</td></tr></tbody></table>

## 体验金领取记录

<table><colgroup><col/><col/><col/></colgroup><thead><tr><th>字段</th><th>规则</th><th>原型</th></tr></thead><tbody><tr><td>使用规则</td><td>合约增强体验金，使用规则展示“--”</td><td><img name="image.png" href="https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YjI3ZmYxNWY5MDM4YmYwNWNkOWUwNzg0ZDcyOGM1MjJfZTU3OWEwYWIzMTc3MTk4ZWFhOWIwZTJiNzI0ZDQwMDRfSUQ6NzY3MjQwMTE1NTg1ODY0ODgwMl8xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM" mime="image/png" scale="1.000000" src="HrmebBYjnof1yFxSbmul1TsTgwh"/></td></tr></tbody></table>



# 现货后台

## 体验金申请

<grid>
<column width-ratio="0.500000">
![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YTA1Mzc3NjUzNGM5MzhiNjYxMDc1ZDA5OWUwYjdhZGZfODAwMGRmOTk2NTBlZDVlYTJhMzJmOWQ2NzU5N2ZjZjVfSUQ6NzY3MjcxNTAyODcyNTc2MzgwOF8xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM)
</column>
<column width-ratio="0.500000">
![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=MTVjMTM2NWVmMDYyYjZhZGZiYzc2YjhjM2IwNmExYWVfMjU1NmQxMThjYTBmMmY5NDBiOTczYTQ3MDQ1OTViNDJfSUQ6NzY3MjcxNDgxMjQyMTM2MTM4Ml8xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM)
</column>
</grid>



- 体验金类型： 自有资金优先，改为 “不抵扣类型”，
- 配资比例：选择“不抵扣类型”时， 抵扣比例 展示为“配资比例”， 逻辑不变， 还是激活门槛的比例和 体验金与真金混合配资开仓的比例
- 使用规则：选择“不抵扣类型”时，隐藏使用规则

## 卡券领取记录

![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=N2IyMzY3NjkyZGQ5ODgyYWM1YWRkNTk0M2EwNGMwZjdfNzVhMzRhMDdjZWJkNzZiM2ZiZDVkOWZiZTRkNGY1NWRfSUQ6NzY3MjcwNTE3MjQ5MDU1NTEwMV8xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM)

增强体验金：

- ~~已使用金额 = 当前正处于委托冻结或仓位占用中的增强体验金金额，会随撤单、开仓和平仓实时变化。~~
- ~~剩余金额= 总-已使用金额~~
- 到期未使用金额= 体验金总额 ~~- 历史最大的开仓占用金额~~

## 卡券使用记录



![](https://internal-api-drive-stream-sg.larksuite.com/space/api/box/stream/download/authcode/?code=YWZmNTAxZmNjMzEzMWI5ZGMyY2RkN2IyODA5OTExOTZfNmUyNDhiZWU2NmY1YmE2ZTZiMWFjOWJjNDUzYjI2OTJfSUQ6NzY3MjcwNzIxMjg0NTg3OTAwN18xNzg2NDY3ODY0OjE3ODY0NzE0NjRfVjM)

 ~~金额= 卡券有效期内历史最大仓位占用金额~~

无使用记录

# 埋点

无



# 非功能性需求

帮助中心：修改指南，

新增风险提示，预估强平价与实际爆仓价不计算增强体验金余额

# 线上回滚方案

停增量、不动存量、只切开关、不重算账。

1. 运营后台停发新增强体验金
2. 存量卡券，已领取未开仓的失效处理
3. 已开仓位，视情况不强行平仓，让其自然到期/强平；新规则已产生的回收不回滚
4. 状态机，新状态字段保留在数据库，回滚=切换逻辑开关，不改存量状态数据，避免二次迁移风险

# 存量数据兼容

1、存量体验金，失效处理。补发

2、老版本app ，公告新规则



二、上线时存量增强体验金处理

<sheet sheet-id="2RqIBu" token="ZyNhs5EnZhVj4btmidnlNS4VgAh"></sheet>

原则：存量不追补、不重算，只对新开仓/新到期生效，避免上线即大面积状态突变。

# 验收准备

| 准备项 | 说明 |
|-|-|
| 测试账号 ×2 | 其一为普通账号；  <br/>其一用于验证划转/提现/回收路径 |
| 增强体验金 | 只做保证金开仓，确认不发生任何抵扣 |
| 释放校验 | 平仓后体验金释放回可用 |
| 到期触发 | 到期自动撤单、平仓、回收体验金 |
| 测试环境数据 | 可构造币价/行情的币对，便于触发强平阈值 |

核心验收用例

| 路径 | 用例 | 操作/预期 |
|-|-|-|
| 领取 | 领取入账 | 领取增强体验金后进入合约账户，卡券状态由“待领取”变为“使用中” |
| 开仓 | 保证金开仓 | 使用增强体验金成功开仓；体验金总额不变，可用金额减少 |
| 开仓 | 金额口径 | 体验金总额 = 可用体验金 + 使用中体验金；使用中体验金包含委托冻结和开仓占用 |
| 结算 | 不参与交易结算 | 手续费、资金费及交易亏损仅从自有资金结算，不减少增强体验金总额 |
| 平仓 | 释放体验金 | 撤单或平仓后，对应冻结/占用金额释放回可用体验金，可继续用于开仓 |
| 平仓 | 盈利入账 | 平仓盈利正常计入用户自有资金，可提现、可划转金额不包含体验金本金 |
| 强平 | 不参与强平计算 | 预估强平价和实际强平价均不包含增强体验金；前端展示与实际触发口径一致 |
| 强平 | 强平回收 | 用户触发强平后，完成平仓及占用释放，再回收增强体验金，体验金已实际参与过开仓，卡券状态更新为“已使用” |
| ADL/阶梯减仓 | 释放但不回收 | 按实际减仓数量释放体验金占用；未进入爆仓终态时不回收，卡券保持“使用中” |
| 已使用 | 已使用状态 | 体验金实际参与过开仓，之后因强平、到期、划转、激活第二张或后台操作被回收 |
| 已失效 | 已失效状态 | 体验金从未参与开仓，直接到期回收或因划转、手动过期、系统失效、被回收 |
| 到期 | 到期无仓无单 | 到期后直接回收增强体验金，卡券变为“已失效” |
| 到期 | 到期有仓有单 | 系统撤销委托、市价平仓，释放全部占用后回收体验金；盈利保留在自有资金中 |
| 划转 | 回收校验 | 失效提示弹窗 |
| 状态 | 状态流转 | 已使用 和 已失效的走新的逻辑 |
| 页面 | C端详情 | 展示体验金总额、可用体验金、使用中体验金及失效时间，抵扣比例改为配资比例  <br/>不跳转使用记录 |
| 兼容 | 普通体验金回归 | 普通体验金的卡片、状态、抵扣及结算逻辑不受本需求影响 |
