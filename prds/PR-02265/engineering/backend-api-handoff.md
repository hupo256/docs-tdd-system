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
| 6b | **提供稳定的数字/枚举类型码**替代现有文案字符串识别（详见「唯一强阻塞项」） |

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

## ⭐ 唯一强阻塞项：第 6b 点

合约订单流水现在靠 `type` 的**文案字符串**（`'Open Commission'` / `'开仓手续费'` / `'Close Commission'` / `'平仓手续费'`）判断是否手续费行——**与语言绑定，多语言下会漏判正数化**。

**请提供一个稳定类型码**（像资产流水那样），并给出手续费类型对应的码值：

| 业务含义 | 期望类型码 |
|---|---|
| 开仓手续费 | ？ |
| 平仓手续费 | ？ |

其余为确认题，此项确定后前端改用码判断。

---

### 代码锚点（前端自查用）

- 后台配置值域/校验单一源：`apps/admin/legacy-admin/src/views/operateManager/marketMakerAccount/feeInput.js`（`FEE_MIN=-100` `FEE_MAX=100` `FEE_DECIMALS=6`）
- 后台提交报文：`external_market_account_modal.vue` `buildPayload()`
- C 端合约订单流水正数化：`apps/web/src/apps/Futures/components/FuturesOrders/FundsFlow/feeAmount.ts`（`isFeeFlowType` 文案字符串匹配 ← 待改类型码）
- C 端资产流水正数化：`apps/web/src/apps/CashFlow/futures/cashFlowAmount.ts`（类型码 6/7）
