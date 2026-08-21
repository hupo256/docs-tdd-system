<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# 03 — API 契约

> **模板**：`templates/03-api-contract-template.md`
> **配套规则**：
> - 单一来源字段默认贴合契约、仅两类改名例外：[api-and-mapper.md](../../../common/rules/api-and-mapper.md) §2
> - 文案像接口 contract 一样管理：[architecture-and-state.md](../../../common/rules/architecture-and-state.md) §7.1
> - 真实接口到位后的字段对账关卡：[architecture-and-state.md](../../../common/rules/architecture-and-state.md) §8.1
> **使用**：G1 复制到项目；G3 补 Mock 场景和文案契约；G5 联调时逐行更新 §5 字段对账。

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02265` |
| 契约来源 | **复用现状接口**（添加/编辑外部做市商、做市账户查询、前台/后台资金流水与成交记录）；无新增接口。YApi 分类链接待补 |
| 契约变化 | **仅字段值域**：手续费率相关字段由 `[0,100]` 放开为 `[-100,100]`（精度 6 位不变）。DTO 结构不变 |
| 技术栈分布 | **F01~F04 + F06 + F08~F13 = Vue2 legacy-admin**（`apps/admin`、`apps/futures-admin`）；**F05 = apps/web React** |
| Mock 路线 | **不采用 MSW（已豁免 DOC-G3-001~007，见 `agent/rule-waivers.json`）**。接口均已存在，开发直接连 **test 后端**用真实负费率数据验证；Vue admin 非 React/MSW 体系 |
| 环境策略 | 直连 test 后端；无 mock worker、无 `USE_MOCK` 业务开关 |
| 待确认登记入口 | `06-collaboration.md` |

## 0.1 Mock 策略（G3 决策：不采用 MSW，已豁免）

> 项目负责人 2026-08-07 确认：接口全部已存在复用、仅放开负值；主体是 Vue2 legacy-admin，非 apps/web React/MSW 体系；F05 前台亦为已存在接口的纯展示改动。故不引入 MSW，直接连 test 后端验证。豁免记录见 `agent/rule-waivers.json`（DOC-G3-001~007）。

| 项 | 结论 |
|----|------|
| Mock 框架 | 不采用（MSW 路线 B / 遗留路线 A 均不用） |
| 负值数据来源 | test 后端配置负费率账户，产生负费率成交，验证配置/查询/展示全链路 |
| 后端「放开负值」就绪风险 | 用户于 2026-08-21 确认 G5 联调通过；本会话未取得可归档账号、交易 ID 或截图 |
| 前端自测 | Vue 组件校验/格式化用单测（纯函数）覆盖负值边界；React 侧格式化纯函数单测 |

## 1. 接口清单（均为现有接口，复用现状逻辑）

| ID | Method | Path | 用途 | 技术栈 | 状态 |
|----|--------|------|------|--------|------|
| A1 | GET | `/externalMmAccount/page` | F04 外部做市商列表「手续费率」列（含负值） | Vue 现货后台 | 已存在复用 |
| A2 | POST | `/externalMmAccount/add` | F01 添加并保存 4 个手续费率；F08 保存后即时生效 | Vue 现货后台 | 已存在复用；G5 已由用户确认通过 |
| A3 | POST | `/externalMmAccount/update` | F01 编辑回显/保存负值；F08 保存后即时生效 | Vue 现货后台 | 已存在复用；G5 已由用户确认通过 |
| A4 | POST | `/order/his_trade_list_v2`、`/position/history_position_list`、`/record/get_transaction_list` | F05 前台手续费/返佣按接口符号契约展示 | apps/web React | 已存在复用；2026-08-20 字段语义已确认 |
| A5 | GET/POST | `<现有后台接口>` | F06 后台手续费按对应接口口径展示 | Vue 现货/合约后台 | 已存在复用；`history_position_list.tradeFee` 已对账 |

> A2/A3 path 来自现有 `apps/admin/legacy-admin/src/api/operateManager/marketAccount.js`；A4 path 与字段已从现有 service/组件及 2026-08-20 后端最终口径确认。A5 其余存量报表接口不改 DTO，仅调整展示。

## 2. 通用约定

| 项 | 契约口径 |
|----|---------|
| 成功响应 | `code: "0"`、`data: object \| array \| null` |
| 数值口径 | 手续费率为字符串百分比，**值域放开为 `[-100,100]`**，精度 6 位；负值表示返佣费率 |
| 手续费/流水符号 | `his_trade_list_v2.fee`、`history_position_list.tradeFee`：正常手续费负、返佣正，正数补 `+`、负数原样；`get_transaction_list.amount`：直接遵循后端符号，不做 `abs()`/取反 |

## 3. 核心 DTO（契约原文）

> DTO 结构复用现状，本次不改字段名/结构；仅费率字段值域放开负值。以下字段名已从现有 Vue 代码确认。

```js
// 外部做市商账户（A2/A3 payload & A1 列表项）——真实字段名（见 external_market_account_modal.vue buildPayload）
{
  openMakerFee, openTakerFee, closeMakerFee, closeTakerFee,  // 合约 4 费率(%)，放开负值 [-100,100]
  spotMakerFee, spotTakerFee,                                 // 现货费率（现货侧现状已支持负号）
  recommendedMarginMultiplier                                 // 维持保证金倍率系数（提交名）
}

// 前台历史成交/仓位历史：fee、tradeFee 为正常手续费负数、返佣正数
// get_transaction_list：amount 为后端带符号值，前端只按精度格式化，不改变符号
// 后台 Vue 其余 PRD 正数化触点：复用现有 amount + side/type 展示派生
```

## 4. UI 领域模型

- **Vue admin（F01~F04/F06）**：无 TS/mapper；`history_position_list.tradeFee` 保留后端符号并由 `valueDisplay` 为正数补 `+`，其余 PRD 正数化触点使用各后台既有纯函数。
- **React 前台（F05）**：`fee`/`tradeFee` 使用 `formatSignedFee`（正数补 `+`、负数原样）；`get_transaction_list.amount` 仅按精度格式化并保留后端符号。

## 5. 字段对账表

> Vue admin 无 mapper 层，费率字段 form↔payload 同名直传（见 §3）。React 前台 F05 展示派生如下：

### 5.1 前台流水展示（F05，`apps/web`）

| UI 字段 | 取值 | 契约字段 | 映射类型 | 备注 |
|---------|------|---------|---------|------|
| `feeText` | `formatSignedFee(fee)` | `his_trade_list_v2.tradeHisList[].fee` | 同名格式化 | 正常手续费负、返佣正；正数补 `+`、负数原样 |
| `tradeFeeText` | `formatSignedFee(tradeFee)` | `history_position_list.positionList[].tradeFee` | 同名格式化 | 与 `fee` 使用相同符号语义 |
| `amountText` | 按精度直接格式化 `amount` | `get_transaction_list.transList[].amount` | 同名格式化 | 保留后端符号，不做 `abs()`、取反或重新拼符号 |

**G5 联调收尾自检**：
- [x] `fee`、`tradeFee`、`amount` 字段名与符号语义已从现有代码及 2026-08-20 后端最终口径确认。
- [x] 无两个语义不同的 UI 字段兜底同一 `dto.xxx`。

## 6. Mock 场景矩阵

**不采用 Mock**（见 §0.1，已豁免）。负值/边界场景由 test 后端真实数据 + 前端纯函数单测覆盖：

| 场景 | 覆盖方式 |
|------|---------|
| 正常正费率 | test 后端现有正费率账户 |
| 负费率 | test 后端配置负费率账户；纯函数单测 `-0.000001` |
| 边界 | 纯函数单测 `±100`、6 位精度、超 6 位截断 |
| 非法输入 | 纯函数单测（多负号/非数字/空值） |

## 7. 文案契约表（强制）

> 逐字取自 PRD 原文；实现阶段只维护 zh-CN。Vue admin 侧文案沿用其 i18n/直文机制。

| 文案 ID | 页面/组件 | 来源 | Owner | 默认中文（逐字原文） | 展示条件 | 状态 |
|---------|-----------|------|-------|----------|----------|------|
| `mmFee.hint` | 外部做市商弹窗(Vue) | PRD §5.1 / `PRD-IMG-004` | PM(Lucky) | `按对应订单类型分别收取，负值表示返佣费率(如-0.000001)` | 4 费率输入框下方常驻 | 已确认（F02） |
| `mmFee.rangeError` | 同上校验报错(Vue) | PRD §5.1 正文 | PM(Lucky) | `请输入【-100,100】之间的数字，精度支持6位` | 输入非法/越界时 | 已确认（F03） |
| `mmFee.futuresEffectiveRule` | 合约做市账户弹窗蓝框 | PRD §5.1 / `PRD-IMG-019` `020` | PM(Lucky) | `生效规则:以上费率按「账号x币对」维度精确匹配，交易对应币对时自动应用配置费率` | 合约业务类型添加/编辑 | 已确认（F09） |
| `mmFee.futuresPriority` | 同上蓝框第二条 | PRD §5.1 | PM(Lucky) | `外部做市商账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准。` | 合约业务类型添加/编辑 | 已确认（F09） |
| `mmFee.spotPriority` | 现货做市账户弹窗蓝框第二条 | PRD §5.1 / `PRD-IMG-021` | PM(Lucky) | `外部做市商账号若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。` | 现货业务类型添加/编辑 | 已确认（F10） |
| `vip.userWhitelistPriority` | 用户白名单添加/编辑弹窗 | PRD §5.1 正文 / `PRD-IMG-034` | PM(Lucky) | `账号若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。` | 弹窗常驻 | 已确认（F11） |
| `vip.pairWhitelistPriority` | 币对白名单添加/编辑弹窗 | PRD §5.1 正文 / `PRD-IMG-035` | PM(Lucky) | `账号交易的币对若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。` | 弹窗常驻 | 已确认（F12） |
| `feeDiscount.externalMmPriority` | 合约后台手续费折扣添加/编辑弹窗 | PRD §5.1 正文 / `PRD-IMG-022` | PM(Lucky) | `该账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准。` | 弹窗常驻 | 已确认（F13） |

**自检**：
- [ ] 固定文案逐字取自 PRD 原文，无意译；配「值 === 来源原文」字面断言测试。
- [ ] locale 只更新 zh-CN。

## 8. 待确认 / 契约差异

| # | 接口 / 字段 | 现状 | 期望 | 待谁确认 | 状态 |
|---|------------|------|------|---------|------|
| 1 | 手续费率字段值域（**后端**） | 后端校验/存储是否限正 | 后端同步放开负值 `[-100,100]`，否则前端配负值被拒 | 后端 | 已解决：用户确认 G5 联调通过（2026-08-21） |
| 2 | A4/A5 前台/后台流水接口 path + 金额/side 字段真实名 | 分散在现有代码 | 从现有 service/组件与后端最终口径确认 | 前端（G4/G5） | 已解决（2026-08-20） |
| 3 | 三类接口的手续费/流水符号语义 | 历史文档曾统一描述为 `abs()` 正数化 | `fee`/`tradeFee` 正常手续费负、返佣正；`amount` 直接遵循后端符号 | 后端 + 前端 | 已解决（2026-08-20） |
| 4 | A2/A3 即时生效 | PRD revision 1576 新增要求 | 保存成功后的下一笔匹配交易直接使用新费率，不等待缓存过期 | 后端 + QA | 已解决：用户确认 G5 联调通过（2026-08-21） |

同步登记到 `06-collaboration.md`；G5 前必须清零或标注延期。

## 9. 契约变更记录

| 日期 | 版本 / commit | 变更 | 前端同步动作 |
|------|--------------|------|-------------|
| 2026-08-07 | 复用现状接口 | 手续费率字段值域 `[0,100]`→`[-100,100]`；流水金额可为负(返佣)展示正数化 | Vue：改 `FEE_MIN`、futures 校验/sanitize 放开负号、列表格式化；React：正数化格式化复用 |
| 2026-08-10 | PRD revision 1576 | A2/A3 新增“费率配置即时生效”要求；F09~F13 仅新增 UI 文案，无新接口 | G5 验证实际生效时点；补齐 5 组逐字文案断言 |
| 2026-08-20 | 后端最终符号口径 | `his_trade_list_v2.fee`、`history_position_list.tradeFee` 正常手续费负、返佣正；`get_transaction_list.amount` 直接遵循后端符号 | Web 使用 `formatSignedFee` 处理前两者；资金流水仅按精度格式化，删除统一 `abs()` 假设 |
| 2026-08-21 | G5 用户确认 | 用户明确确认 G5 联调已通过；未提供可归档的账号、交易 ID 或截图 | 仅登记用户确认，不补造联调明细 |
