---
sourceName: "需求 PRD (extracted, localized assets)"
sourceType: "wiki"
sourceUrl: "https://qfglxo2m3dc.sg.larksuite.com/wiki/TWvcwhONMieDKPkxA0wlrP0cghh"
derivedFrom: "prd-latest.md"
syncedAt: "2026-09-26T13:28:03.829Z"
readOnly: true
---

# 【PR-02208】API 用户动态费率及返佣体系

## 一.需求概况

#### 背景

- 外部做市商已逐步接入，未来平台会开放 API 交易，故需要对 API 用户进行独立的交易量统计及等级管理
- 系统需要识别用户订单是否来源于 API，并根据用户个人**滚动 30 天 API 成交量**自动匹配 L1-L5 等级，不同等级对应不同的交易费率及返佣规则。
- 普通用户和代理人用户均按照个人 API 成交量进行等级计算；外部 API 做市商继续使用独立的做市商规则，不属于本需求。



#### 目标

- 精准识别API订单
- 统计用户个人滚动 30 天 API 成交量，自动升降档
- 根据成交量自动匹配 L1-L5 等级，并定义费率
- 管理后台可配置L1-L5等级



---

## 二.当前流程及问题

#### 当前流程

用户订单成交→按订单类型+VIP等级确定费率→结束



#### 当前问题

未来放开API交易后，API的订单如果仍旧走VIP的费率，会造成API用户的流失，对市场推广造成不利影响。

因API交易的对手方为外部做市商，做市的风险已由外部承担，故我们可以适当以“薄利多量”的方式去降低API用户的费率，尽可能的沉淀留存此类用户。



---

## 三.目标流程

#### 目标链路

每日00:00 统计过去30个完整自然日API成交量 → 确定用户API等级 → 等级生效 → 结束

用户API订单成交 → 识别API订单 → 判断是否外部API做市商 → 否，读取当前已生效API等级 → 执行对应Maker/Taker费率 → 产生API自返佣 → 结束



#### 非本需求范围

- API 创建资格及 API 白名单准入；
- API Key 创建、管理及权限控制；
- 代理人团队返佣计算；
- 外部 API 做市商费率+ Maker 奖励；
- VIP 费率体系本身的建设。

---

## 四.名词与定义

| 对象 | 定义 |
|-|-|
| API订单 | 订单来源为API的订单 |
| API交易量 | 特指订单来源为API的交易量 |
| API动态费率 | 特指满足API交易量阶梯而升降档后的手续费费率 |
| API动态返佣 | 特指满足API交易量阶梯而升降档后的手续费自返佣比例，无上下级返佣，独立字段 |

---

## 五.API订单与用户身份

### API订单精准识别

#### 订单来源

交易订单需要记录订单来源：

| **订单来源** | **说明** |
|-|-|
| API | 通过 API Key 创建的订单 |
| WEB | Web端订单 |
| APP | IOS、Android |
| 其他 | 其他订单来源（如无，请忽略） |

#### 核心规则

1. 只有订单来源为 `API` 的订单计入 API 成交量
2. 用户拥有 API Key 不代表其所有订单均属于 API 订单，同时产生API订单和WEB/APP订单，两类订单需分别指向对应的费率
3. WEB、APP 等订单不计入 API 成交量
4. 订单来源在下单时确定，不根据用户是否拥有 API Key 进行判断
5. API 订单发生部分成交时，每笔成交均继承原订单的 API 来源
6. API 成交量统计仅统计来源为 API 的有效成交。

---

### API用户身份

本需求涉及的 API 用户包括：

| **用户类型** | **是否执行API动态费率** | **费率依据** |
|-|-|-|
| 普通用户 | 是 | 个人滚动30天API成交量 |
| 代理人用户 | 是 | 个人滚动30天API成交量 |
| 外部API做市商 | 否 | 独立做市商费率 |
| 非API订单 | 否 | 按原有交易费率体系执行 |

> 外部API做市商以现有做市商身份/标识体系为准进行识别；若用户同时满足API订单和外部做市商身份，则优先执行做市商费率，不进入API动态费率体系。



普通用户与代理人用户的个人 API 动态费率规则完全一致。

代理人身份发生变化时：

- 不重新初始化个人 API 成交量；
- 不重置当前 API 费率档位；
- 仍按照用户个人滚动 30 天 API 成交量重新定档。

---

## 六.API动态费率

### API动态费率（首版）

<table><colgroup><col/><col/><col/><col/><col/><col/><col/></colgroup><tbody><tr><td rowspan="2"><b>档位</b></td><td rowspan="2"><b>滚动 30 天 API 成交量 (USDT)</b></td><td rowspan="2"><b>返佣比例</b></td><td rowspan="2"><b>Taker费率</b></td><td rowspan="2"><b>Maker费率</b></td><td rowspan="2"><b>Taker用户实付有效费率</b></td><td rowspan="2"><b>Maker用户实付有效费率</b></td></tr><tr></tr><tr><td rowspan="2">L1</td><td rowspan="2">&lt;1 亿</td><td rowspan="2">75%</td><td rowspan="2">0.0500%</td><td rowspan="2">0.0150%</td><td rowspan="2">0.01250%</td><td rowspan="2">0.00375%</td></tr><tr></tr><tr><td rowspan="2">L2</td><td rowspan="2">1 亿 –3 亿</td><td rowspan="2">77%</td><td rowspan="2">0.0460%</td><td rowspan="2">0.0120%</td><td rowspan="2">0.01058%</td><td rowspan="2">0.00276%</td></tr><tr></tr><tr><td rowspan="2">L3</td><td rowspan="2">3 亿 – 6 亿</td><td rowspan="2">80%</td><td rowspan="2">0.0430%</td><td rowspan="2">0.0100%</td><td rowspan="2">0.00860%</td><td rowspan="2">0.00200%</td></tr><tr></tr><tr><td rowspan="2">L4</td><td rowspan="2">6 亿 – 10 亿</td><td rowspan="2">83%</td><td rowspan="2">0.0390%</td><td rowspan="2">0.0070%</td><td rowspan="2">0.00663%</td><td rowspan="2">0.00119%</td></tr><tr></tr><tr><td rowspan="2">L5</td><td rowspan="2">≥ 10 亿</td><td rowspan="2">85%</td><td rowspan="2">0.0350%</td><td rowspan="2">0.0050%</td><td rowspan="2">0.00525%</td><td rowspan="2">0.00075%</td></tr><tr></tr></tbody></table>

PS：费率有可能会微调，请知悉

---

### 默认档位

1. 用户个人滚动 30 天 API 成交量不足 1 亿 USDT；
2. 普通用户及代理人用户均适用
3. 用户创建API key后，默认初始化档位为 L1，后续每日根据滚动30天API成交量重新计算等级。未创建API Key的用户，无需进入API等级计算范围
4. 上线此需求后，存量API用户默认档位为L1，后续每日根据滚动30天API成交量重新计算等级。

---

### 升档与降档

系统每日重新计算用户个人滚动 30 天 API 成交量，并匹配对应费率档位。

规则：

```Plain Text
成交量达到更高档位
→ 下一生效周期自动升档

成交量下降至较低档位
→ 下一生效周期自动降档
```

升档、降档均以本次定档计算结果为准：

- 不设置额外保护期；
- 不设置连续满足天数；
- 不需要人工审核；
- 不需要运营人工调整。

生效规则

建议统一定义为：

> 每日完成定档后，新档位即刻生效。待研发确认是否需要留时间buffer

具体生效时间由系统统一配置，固定为每日 `00:00:00（UTC+8）`

失败处理规则

> 若当日定档任务执行失败，则保持用户原有生效档位，由研发通过补偿机制完成后续定档

---

### 统计时区

API 动态费率统计统一使用：

> **UTC+8**

自然日定义：

```Plain Text
00:00:00 ～ 23:59:59
```

---

### 滚动30天定义

每日UTC+8 0点进行一次费率档位计算。

计算某日新费率档位时，统计此前 **30 个完整自然日** 的 API 有效成交量。

例如：

```Plain Text
7月27日0点进行费率定档

统计区间：
6月27日00:00:00
～
7月26日23:59:59
```

---

### 成交量统计口径

成交是否计入API成交量与手续费结算状态无关，以交易系统最终确认的有效成交为准

建议统一按照：

> `API订单成交数量 × 成交价格`

折算为 USDT 后进行统计。

成交量统计必须与交易系统实际手续费计算口径保持一致。

对于撤销订单、未成交订单，不计入 API 成交量。

如存在成交冲正、异常成交回滚等情况，应按照交易系统最终有效成交结果修正统计数据。

---

### 管理后台配置API动态费率

合约后台-合约配置-新增“API动态费率及返佣”配置，样式由前端根据管理后台规范定义，请参考下面原型

![The image shows the API dynamic rate configuration table for the contract backend, which supports L1 - L5 tiers of 30-day rolling API trading volume, Maker/Taker fees, and commission ratios. The table has columns: Tier, 30-day rolling API trading volume (USDT), Maker fee rate, Taker fee rate, Commission ratio, and Operation. The tiers are L1 to L5, with L1 having <1 billion USDT trading volume, Maker fee rate 0.0150%, Taker fee rate 0.0500%, commission ratio 75%, and Operation as "edit". L2 has 1 - <3 billion USDT, Maker fee rate 0.0120%, Taker fee rate 0.0460%, commission ratio 77%, and "edit" operation. L3 has 3 - <6 billion USDT, Maker fee rate 0.0100%, Taker fee rate 0.0430%, commission ratio 80%, and "edit" operation. L4 has 6 - <10 billion USDT, Maker fee rate 0.0070%, Taker fee rate 0.0390%, commission ratio 83%, and "edit" operation. L5 has ≥10 billion USDT, Maker fee rate 0.0050%, Taker fee rate 0.0350%, commission ratio 85%, and "edit" operation.](assets/img-001.png)

<table><colgroup><col/><col/><col/></colgroup><thead><tr><th>字段</th><th>定义</th><th>备注</th></tr></thead><tbody><tr><td>档位</td><td>L1-L5</td><td>固定显示L1-L5</td></tr><tr><td>30天滚动API交易量（USDT）</td><td>A-B</td><td rowspan="4">各档位采用「左闭右开」区间，最后一档为左闭区间。<br/>此返佣比例实际为API自返佣</td></tr><tr><td>Maker费率</td><td>配置值</td></tr><tr><td>Taker费率</td><td>配置值</td></tr><tr><td>返佣比例</td><td>配置值</td></tr><tr><td>操作</td><td>编辑</td><td>支持修改各个档位的30天滚动交易量、手续费率、返佣比例</td></tr></tbody></table>

1. L1-L5 档位不可重复
2. 各档位成交量区间不得存在重叠，成交量区间必须连续，不允许出现空档
3. Maker/Taker 费率必须满足系统精度要求
4. 新规则生效后，仅影响新进入生效周期的费率计算。
5. 不符合上述规则，统一报错：请输入正确的参数。



#### API费率与VIP费率关系

API 动态费率与 VIP 费率**不叠加**。

本需求定义：

> **API 订单优先执行 API 动态费率，不再叠加 VIP 费率。**

非 API 订单继续按照现有 VIP 等费率体系执行。

费率计算公式与现有一致，不做赘述，如有模糊可找产品商榷。

最终规则：

<sheet sheet-id="jAmLzp" token="FXcSsK8wvhpr7stYXCkla79Rgrg"></sheet>



#### **权限控制**

此页面权限控制，遵循现有合约管理后台的配置及流程，由运营自主控制，可见即可编辑；



#### **更新规则**

编辑后，在次日UTC +8 0点时根据最新的配置，计算30天滚动API成交量，并进行升降档；

费率并非实时生效；



#### **日志规则**

需要额外记录此页面的编辑日志，包括编辑人、编辑时间、修改字段前、修改字段后，仅留存即可，方便有问题时查询。

---

## 七.API动态返佣

#### API动态返佣

> **API动态返佣与API动态费率共用L1-L5等级体系，返佣比例由API动态费率配置中的“返佣比例”字段统一配置，具体档位及初始配置以第六章为准。**



---

#### API返佣规则

- 根据30天滚动API成交量，确定档位、费率、返佣比例
- API自返佣金额 = 用户实际产生的API手续费 × API自返佣比例
- API自返佣结算执行规则，与当前每日一结算保持一致，且具体结算时间保持一致
- API自返佣不参与代理上下级佣金分配，不产生上下级佣金；API成交量不计入原有代理返佣体系的**返佣考核成交量及返佣计算基数**。
- API成交量暂不纳入原有的返佣成交量中，而是独立一个字段，因其走独立API自返佣的逻辑，但其API自返佣的金额纳入个人总返佣金额中
- API成交量在管理后台、用户侧的展示问题，将由其他需求后续推进

---

## 八.用户端需求

### 用户API接口变更

#### **新增费率等字段**

现有成交接口（如有其他接口更合适，请研发提出）需根据下述列表的字段进行检查，核心需要确保rateLevel、feeRate、fee能在接口中同步给用户侧

<sheet sheet-id="BuUqw1" token="FXcSsK8wvhpr7stYXCkla79Rgrg"></sheet>

#### 核心规则

1. API订单的订单来源在下单时确定；API动态费率以**成交发生时用户当前生效的API费率档位**为准。
2. 后续用户档位变化不得修改历史成交费率。
3. 后台调整费率规则后，不影响已经产生的历史成交。

---

## 九.后台需求

### 用户费率查询

![The image shows the user fee query interface in the contract backend system. The left sidebar has "手续费" (Fees) highlighted in red. The main area displays user fees, with a red arrow pointing to a row where the API fee rate is marked as "API费率档位: L2 Maker 0.1% / Taker 0.2%". This corresponds to the context mentioning the addition of "API费率档位" and "API费率（含Maker&Taker）" fields in the contract backend's "手续费" section, with "API费率档位" showing "L2 Maker 0.1% / Taker 0.2%" for users with API key.](assets/img-002.png)

合约后台-手续费-手续费折扣处，新增字段：API费率档位、API费率（含Maker&Taker），两个字段

如无API key的用户，此字段应该为“-”值

本期不提供“手动调整API费率等级”功能。

如后续存在特殊费率、人工指定费率等场景，另行提出特殊费率需求。

---

### 用户档位变化记录

记录以下信息：

<sheet sheet-id="hqsIdH" token="FXcSsK8wvhpr7stYXCkla79Rgrg"></sheet>

此历史可以以日志的形式留存，可暂不支持后台直接查询，但有异常时，可随时能调取。

---

## 十.验收标准

#### API订单识别

-  API下单产生的成交，正确标记 `source=API`
-  WEB/APP订单不计入API成交量
-  同一用户同时存在API、WEB、APP订单时，各订单按自身来源执行对应费率
-  API订单部分成交时，所有成交记录均继承API来源

#### API成交量统计

-  仅统计API有效成交
-  按过去30个完整自然日统计
-  统计时区为UTC+8
-  撤单、未成交订单不计入
-  异常成交回滚后，统计结果能够同步修正

#### 等级计算

验证：

```Plain Text
0～<1亿 → L1
1亿 → L2
<3亿 → L2
3亿 → L3
6亿 → L4
10亿 → L5
```

并验证：

-  成交量增加能够升档
-  成交量下降能够降档
-  每日00:00生效
-  新用户默认L1

#### 费率

-  API订单执行API动态费率
-  API动态费率不与VIP费率叠加
-  WEB/APP订单继续执行原有费率
-  外部API做市商执行做市商费率

#### 返佣

-  API返佣按照当前等级返佣比例计算
-  API返佣仅归用户本人
-  不产生上级/下级API返佣
-  API成交量不计入原代理返佣成交量
-  API返佣金额计入用户总返佣金额

#### 后台配置

-  L1-L5支持修改
-  区间不得重叠
-  区间不得存在空档
-  参数非法时无法保存
-  配置变更次日00:00生效

---

## 十一.其他

需求评审录屏：https://qfglxo2m3dc.sg.larksuite.com/minutes/obsg2fzw115q6lp2omzv84cm?from_source=finish_recording

在研发或测试过程中，因各类型原因导致的需求修正/变更，将以黄色底色标注。
