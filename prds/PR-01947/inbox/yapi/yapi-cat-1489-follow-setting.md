# YApi 整理稿 — Cat 1489 跟单设置优化

> **YApi**：[Project 587 · Cat 1489](http://35.240.211.100:3333/project/587/interface/api/cat_1489)  
> **原始 JSON**：[`project-587-cat-1489/`](./project-587-cat-1489/)  
> **契约对账**：[`../../product/03-api-contract.md`](../../product/03-api-contract.md)  
> **前端网关前缀**：`/fe-ex-api`

---

## 1. Web 跟单接口

### 1.1 `GET /cptrade/follow/before_follow`（5713）

源码：`CopyTradingFollowerRpc.java`

**Query**（YApi query 字段损坏，以前端/RPC 为准）

| 参数           | 类型    | 必填 | 说明          |
| -------------- | ------- | ---- | ------------- |
| `leaderUserId` | integer | 是   | 带单员用户 ID |

**Response `data`**：`leaderDetail` · `followSetting` · `myFollowSetting`（详见 JSON 快照）

#### `followSetting` 新增（PR-01947）

| 字段                             | 类型      | 说明                 |
| -------------------------------- | --------- | -------------------- |
| `positionRiskRateMin` / `Max`    | number    | 仓位风险上下限       |
| `customLeverageLevelMin` / `Max` | integer   | 自定义杠杆倍数上下限 |
| `followSymbolList`               | integer[] | 带单交易对 ID        |
| `rate`                           | number    | 分润比例             |
| `maxNumber`                      | integer   | 跟随人数上限         |

#### `leaderDetail` 补充

| 字段              | 类型    | 说明             |
| ----------------- | ------- | ---------------- |
| `curLeadPosCount` | integer | 当前带单仓位数量 |

#### `myFollowSetting` 新增（PR-01947）

| 字段                  | 类型    | 说明                                 |
| --------------------- | ------- | ------------------------------------ |
| `marginMode`          | integer | 0 跟随 / 1 全仓 / 2 逐仓             |
| `leverageMode`        | integer | 0 跟随 / 1 自定义                    |
| `customLeverageLevel` | integer | 自定义杠杆倍数                       |
| `copyPositionMode`    | integer | 1 全部 / 2 更好价 / 3 不复制         |
| `followType`          | integer | 3 固定额度 / 4 固定比例 / 5 智能跟单 |

兼容：`isCopyPos` → 前端映射 `copyPositionMode`。

**代码**：`apps/web/src/services/api/copyTrading/follow/before-follow.ts`

---

### 1.2 `POST /cptrade/follow/setting_save`（5710）

| 字段                              | 类型     | 说明                    |
| --------------------------------- | -------- | ----------------------- |
| `leaderUserId`                    | integer  | 带单员 ID               |
| `followType`                      | integer  | 3 固定额度 / 4 固定比例 |
| `fixedAmount` / `fixedRate`       | number   | 跟单金额/比例           |
| `stopProfitRate` / `stopLossRate` | number   | 止盈止损                |
| `followSymbolList`                | string[] | 币对 ID 列表            |
| `positionRiskRate`                | number   | 仓位风险                |
| `isFollowNewSymbol`               | integer  | 1/0                     |
| `marginMode`                      | integer  | 0/1/2                   |
| `leverageMode`                    | integer  | 0/1                     |
| `customLeverageLevel`             | integer  | 自定义杠杆              |
| `copyPositionMode`                | integer  | 1/2/3                   |

**代码**：`apps/web/src/services/api/copyTrading/follow/setting-save.ts`

> `save_follow` 未收录于 Cat 1489；新增四参应与 `setting_save` 同口径（待后端确认）。

### 1.3 `POST /cptrade/follow/lead_position_count`（5752 · countLeadPositions）

跟单币对弹窗【确认】后，按跟单者所选币对范围查询交易员带单仓位数，刷新「当前带单笔数」。

**Req body**

| 字段               | 类型     | 说明                         |
| ------------------ | -------- | ---------------------------- |
| `leaderUserId`     | integer  | 交易员 UID                   |
| `followSymbolList` | string[] | 跟单者选中的跟单币对 ID 列表 |

**Response `data`**

| 字段              | 类型    | 说明                             |
| ----------------- | ------- | -------------------------------- |
| `curLeadPosCount` | integer | 所选币对范围内交易员带单仓位数量 |

**代码**：`apps/web/src/services/api/copyTrading/follow/lead-position-count.ts`（`SettingForm` 接管 `currentLeadCount`；进页面初值取 `before_follow.leaderDetail.curLeadPosCount`）

---

## 2. Admin（同 Cat）

| ID   | 方法 | 路径                     | 说明                                   |
| ---- | ---- | ------------------------ | -------------------------------------- |
| 5716 | GET  | `/cptrade/leader/page`   | KOL 列表，新增 `customLeverageRange`   |
| 5728 | POST | `/cptrade/leader/export` | CSV 导出，新增列 `customLeverageRange` |

---

## 3. 后端枚举（YApi 口径）

| 字段               | 值    | 含义                   |
| ------------------ | ----- | ---------------------- |
| `marginMode`       | 0/1/2 | 跟随 / 全仓 / 逐仓     |
| `leverageMode`     | 0/1   | 跟随 / 自定义          |
| `copyPositionMode` | 1/2/3 | 全部 / 更好价 / 不复制 |

---

## 4. 前端提交映射（✅ 已落码 2026-07-14）

```ts
marginSettingMode === FollowTrader ? 0 : marginMode; // Cross=1, Isolated=2
leverageMode === FollowTrader ? 0 : 1;
customLeverageLevel: Number(leverage);
```

落点：`useFollowParams.ts` `toParams()`，三表单（`useFixedCopyForm` / `useSmartCopyForm` / setting form）通过 `...followParams.toParams()` 统一透传，**无需各表单独立改动**。

| 项                  | 后端                           | 前端提交值                                  | 状态         |
| ------------------- | ------------------------------ | ------------------------------------------- | ------------ |
| 保证金              | `marginMode` 0/1/2             | `0`(跟随) / `1`(Cross) / `2`(Isolated)      | ✅ 已落码    |
| 杠杆模式            | `leverageMode` 0/1             | `0`(跟随) / `1`(自定义)                     | ✅ 已落码    |
| 杠杆字段名          | `customLeverageLevel` (number) | `Number(leverage)`                          | ✅ 已落码    |
| 复制仓位            | `copyPositionMode` 1/2/3       | 直传                                        | ✅           |
| `hasFollowPosition` | 未文档化                       | ASSUMED `myFollowSetting.hasFollowPosition` | ❓ Q3 待后端 |

---

_同步：2026-07-14（映射落码）_
