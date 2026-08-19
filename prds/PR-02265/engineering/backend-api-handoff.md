# PR-02265 做市商负费率｜前后端接口对接清单

> 发给后端的对接清单。一句话背景：外部做市账户放开负费率（负值＝返佣）。前端 3 端（运营后台配置、C 端合约订单资金流水、C 端资产资金流水）已落码，口径为「**后端存/传带符号原始值，前端展示去负号显示正数，颜色仍正绿负红**」。以下逐项与后端对齐。

## 一、配置写入（运营后台 新增/编辑外部做市账户）

| # | 项目 | 前端现状 | 需后端确认 |
|---|---|---|---|
| 1 | 费率字段名 | 现货：`spotTakerFee` `spotMakerFee`；合约：`openTakerFee` `openMakerFee` `closeTakerFee` `closeMakerFee` `recommendedMarginMultiplier` | 字段名是否完全一致 |
| 2 | 值格式 | 字符串、**百分比数值**、[-100,100]、≤6 位小数 | 同口径？还是要小数比率(0.0001)？ |
| 3 | 负值范围 | 6 个费率字段均可负 | 是否都允许负，还是仅 maker 可负？ |
| 4 | 精度/舍入 | 前端截断到 6 位 | 落库精度、是否二次四舍五入 |

**写入示例报文（合约 bizType=2，maker 返佣负值）**
```json
{
  "spotUserId": 10086,
  "bizType": 2,
  "symbolIds": [1, 2, 3],
  "institutionId": "INST_001",
  "remark": "外部做市商A",
  "recommendedMarginMultiplier": "5",
  "openTakerFee": "0.02",
  "openMakerFee": "-0.01",
  "closeTakerFee": "0.02",
  "closeMakerFee": "-0.01",
  "id": 123
}
```

**写入示例报文（现货 bizType=1）**
```json
{
  "spotUserId": 10086,
  "bizType": 1,
  "symbolIds": [1, 2],
  "institutionId": "INST_001",
  "remark": "外部做市商A",
  "spotTakerFee": "0.05",
  "spotMakerFee": "-0.02"
}
```

## 二、配置读取（列表 / 详情回显）

| # | 需后端确认 |
|---|---|
| 5 | 列表/编辑回显接口，费率字段**原样回传负值**（编辑框需回填 `-0.01`），字段名与写入一致 |

## 三、C 端流水展示接口（两处，分别确认）

> 共同前提：`amount` 必须是**带符号原始值**（返佣为负），**后端不要预先正数化**，前端自行取绝对值 + 判色。

### 3.1 合约订单-资金流水（FundsFlow）— ⚠️ 重点

| # | 需后端确认 |
|---|---|
| 6a | `amount` 为带符号原始值（返佣负数） |
| 6b | ~~提供稳定的数字/枚举类型码替代文案字符串识别~~ **已关闭（2026-08-19，Aven/Milo）：后端本次未改、维持 pre 逻辑，不新增 typeCode，前端沿用 `type` 字段识别。详见下方「6b 决议」** |

**期望返回示例**
```json
{
  "list": [
    { "typeCode": 6, "typeText": "开仓手续费", "amount": "-0.01234567" },
    { "typeCode": 7, "typeText": "平仓手续费", "amount": "0.02345678" }
  ]
}
```

### 3.2 资产-资金流水（CashFlow）

| # | 需后端确认 |
|---|---|
| 7 | 类型码不变：开仓手续费=`6`、平仓手续费=`7`；`amount` 带符号、`precision` 字段照旧返回 |

## 四、口径确认

| # | 内容 |
|---|---|
| 8 | 已与 PM 确认：手续费/返佣列统一去负号显正数，颜色正绿负红。后端只需返回真实带符号值，无需配合做符号处理 |

## 五、本期明确不做（defer）

| # | 内容 |
|---|---|
| 9 | 「真金手续费 / netInflow」统计口径本期不动，留后续 PR，本批接口无需处理 |

---

## ⭐ 6b 决议（2026-08-19 关闭，原「唯一强阻塞项」）

**结论：不引入 typeCode / 枚举 key，`type` 字段够用，以 pre 环境逻辑为准。** 确认人 Aven / Milo，2026-08-19。

背景与经过：
- QA 在 test 环境发现 `get_transaction_list` 请求体 `type` 传的是枚举 key（`"FUTURES_OPEN_FEE"`），后端接收数字类型 → 报错；pre 环境请求 `type` 传数字（开仓手续费=`6`），正常。
- 团队核对：后端本次未改此接口，维持数字契约。故请求 `type` 应保持**数字编码**（与 pre 一致），test 上出错的是发枚举 key 的那个构建。
- 相应地，前端也**不新增 `typeCode` 响应字段**：曾在 commit `7fd0c224c2` 引入 `typeCode`(6/7) 做手续费行识别，已在 `d3f1a3c35a` 移除，回退为按 `type` 文案字符串匹配（`FEE_FLOW_TYPES`）。

遗留取舍（明确接受）：
- C 端合约订单流水 `isFeeFlowType` 靠 `type` 文案字符串识别（`'开仓手续费'/'Open Commission'/...`），理论上与语言绑定；本期以 pre 逻辑为准、后端不提供类型码，**该多语言风险本期知情接受**，如后续多语种漏判再单独起 PR。

**最终追加决议（2026-08-19，Aven）：get_transaction_list 正数化前端整段回退 online。**
- 后端进一步反馈：**该接口的正数化前端不用处理**。据此前端将 `FundsFlow` 与 `FuturesCashFlow` 关于 `get_transaction_list` 的正数化逻辑**全部回退到 `origin/online`**：删除 `FundsFlow/feeAmount.ts`、`CashFlow/futures/cashFlowAmount.ts` 及其单测，`index.tsx`/`FuturesCashFlow.tsx`/`TransactionFilter.tsx`/`services/api/margin.ts` 均对齐 online。
- 原正数化实现完整保留在**备份分支 `backup/PR-02265-txlist-positivization`**（HEAD `94bd45ac87`）。
- 因不再靠 `type` 文案匹配，上一条「多语言漏判风险」随回退一并消失。
- **F05 前台正数化本期仅保留 `PositionHistory/Card.tsx`（`tradeFee`/`open_close_fee`，走仓位历史接口，非 get_transaction_list），`formatNumber.ts` 的 `toPositiveAmount` 仍被其使用、勿删。**

| 业务含义 | 数字编码（请求/pre 现状） |
|---|---|
| 开仓手续费 | `6` |
| 平仓手续费 | `7` |

---

### 代码锚点（前端自查用）

- 后台配置值域/校验单一源：`apps/admin/legacy-admin/src/views/operateManager/marketMakerAccount/feeInput.js`（`FEE_MIN=-100` `FEE_MAX=100` `FEE_DECIMALS=6`）
- 后台提交报文：`external_market_account_modal.vue` `buildPayload()`
- C 端合约订单流水正数化：~~`FundsFlow/feeAmount.ts`~~ **已回退 online 删除**（见 6b 最终追加决议），原实现存备份分支 `backup/PR-02265-txlist-positivization`
- C 端资产流水正数化：~~`CashFlow/futures/cashFlowAmount.ts`~~ **已回退 online 删除**（见 6b 最终追加决议），原实现存备份分支
- C 端仍保留的正数化：`apps/web/src/apps/Futures/components/FuturesOrders/PositionHistory/Card.tsx`（`tradeFee`/`open_close_fee`）+ `apps/web/src/utils/formatNumber.ts` `toPositiveAmount`
