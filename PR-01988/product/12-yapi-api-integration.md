# PR-01988 YApi 接口对接说明

> 来源：http://35.240.211.100:3333/project/459/interface/api  
> 项目：预测市场配置（project_id=459）  
> 拉取时间：2026-06-25  
> 接口数量：32（本轮新增分类按等级查询接口）  
> 原始快照：`../inbox/yapi/list-menu.json`、`../inbox/yapi/interface-details.json`、`../inbox/yapi/interface-details.md`；差异摘要：`../inbox/yapi/diff-summary-2026-06-25.json`、`../inbox/yapi/diff-summary-2026-06-24-latest.json`、`../inbox/yapi/diff-summary-2026-06-24.json`

## 已提供接口

| 模块     | 场景         | Method / Path                                        | YApi ID | 前端接入状态                                                                     |
| -------- | ------------ | ---------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| 告警配置 | 查询配置     | `GET /polymarket/alert-config/get`                   | 4615    | 可用于告警配置页真实模式                                                         |
| 告警配置 | 更新配置     | `POST /polymarket/alert-config/update_1782211023564` | 5215    | 待 mutation 接入；需确认该带时间戳后缀路径是否为最终稳定路径，secret 不回显      |
| 分类管理 | 支持语言     | `GET /polymarket/category/locale/list`               | 4624    | 可用于分类多语言表单                                                             |
| 分类管理 | 一级删除     | `GET /polymarket/category/delete?id=`                | 5233    | 2026-06-24 新增；可用于一级分类删除，需确认是否只支持一级、有关联事件 / 子级时的错误码 |
| 分类管理 | 按等级查询   | `GET /polymarket/category/category/list?level=`      | 5245    | 2026-06-25 新增；按 `level=1/2/3` 查询指定层级分类，可用于分类弹窗、级联选择和排序辅助 |
| 分类管理 | 一级创建     | `POST /polymarket/category/createLevelOne`           | 4630    | 待 mutation 接入                                                                 |
| 分类管理 | 二/三级保存  | `POST /polymarket/category/saveChildren`             | 4633    | 待 mutation 接入；响应示例为空                                                   |
| 分类管理 | 一级分页列表 | `POST /polymarket/category/pageList`                 | 4621    | 可用于分类列表真实模式                                                           |
| 分类管理 | 全量修改     | `POST /polymarket/category/update/full`              | 4636    | 待 mutation 接入；响应示例为空                                                   |
| 分类管理 | 按一级查树   | `GET /polymarket/category/treeByLevelOneId?id=`      | 4642    | 可用于编辑二/三级分类                                                            |
| 分类管理 | 全量分类树   | `GET /polymarket/category/tree`                      | 4627    | 可用于事件分类级联                                                               |
| 通用参数 | 查询三档 fee | `GET /polymarket/alert-config/get_1782211018309`     | 5212    | 新增；用于读取买入 / 卖出 / 结算费率，路径需后端确认稳定性                       |
| 通用参数 | 更新三档 fee | `POST /polymarket/alert-config/fee/update`           | 4618    | 变更；原预警配置更新 ID 已改为通用参数 fee 更新                                  |
| 每日收入 | 列表         | `POST /tradeDailyIncome/pageList`                    | 4645    | 可用于每日收入列表真实模式                                                       |
| 每日收入 | 汇总/趋势    | `POST /tradeDailyIncome/summary`                     | 4648    | 可用于收入 KPI / 趋势图，当前 UI 先保留静态 KPI                                  |
| 每日收入 | 导出         | `POST /tradeDailyIncome/export`                      | 5239    | 2026-06-24 新增；按 `statDateStart` / `statDateEnd` 导出，响应未描述，需按文件流 / 文件名联调 |
| 事件管理 | 同步查询事件 | `POST /polymarket/event/eventSync`                   | 4651    | 可用于按 eventId / slug 搜索 PM 事件                                             |
| 事件管理 | 后台分页列表 | `POST /polymarket/event/findAdminByPage`             | 4681    | 已接入真实模式列表；本轮新增上线时间 / 结算时间范围筛选；列表项不含 `tableType`，事件类型暂无法区分（见联调注意事项） |
| 事件管理 | 新增事件配置 | `POST /polymarket/event/addEvent`                    | 4669    | 已预留真实模式提交，入参为多语言事件/市场配置                                    |
| 事件管理 | 修改事件配置 | `POST /polymarket/event/updateEvent`                 | 4675    | 已预留真实模式提交                                                               |
| 事件管理 | 事件配置详情 | `GET /polymarket/event/viewEvent?eventId=`           | 4678    | 已预留真实模式回显，结构与新增/修改入参一致                                      |
| 事件管理 | 修改事件状态 | `POST /polymarket/event/updateEventStatus`           | 4684    | 已预留真实模式提交；`status` 0 下线 / 1 仅可见 / 2 开启交易                      |
| 订单管理 | 列表         | `POST /polymarket/order/pageList`                    | 4654    | 可用于订单列表真实模式                                                           |
| 订单管理 | 导出         | `POST /polymarket/order/export`                      | 4657    | 已接入真实模式导出；成功返回 Excel 文件流                                        |
| 订单管理 | 统计卡片     | `POST /polymarket/order/stats`                       | 4660    | 可用于订单顶部 KPI，当前 UI 待补卡片                                             |
| 仓位管理 | 列表         | `POST /polymarket/position/pageList`                 | 4663    | 可用于仓位列表真实模式                                                           |
| 仓位管理 | 导出         | `POST /polymarket/position/export`                   | 4666    | 已接入真实模式导出；成功返回 Excel 文件流                                        |
| 手动平账 | 顶部统计     | `GET /positionDiff/statistics`                       | 5218    | 新增；可替换当前 mock summary 卡片                                               |
| 手动平账 | 持仓差异列表 | `POST /positionDiff/pageList`                        | 5191    | 已接入真实模式列表                                                               |
| 手动平账 | 平账记录列表 | `POST /positionDiff/balanceRecordPageList`           | 5194    | 已接入真实模式列表并与差异列表合并展示                                           |
| 手动平账 | 手动平账     | `POST /positionDiff/markBalanced`                    | 5197    | 已预留真实模式提交；真实安全边界仍待权限/审计确认                                |
| 手动平账 | 平账记录导出 | `POST /positionDiff/export`                          | 5203    | 已接入真实模式导出                                                               |

## 前端真实模式开关

当前 `apps/admin` 已预留 `NEXT_PUBLIC_PREDICTION_API_MODE`：

| 值              | 行为                                                             |
| --------------- | ---------------------------------------------------------------- |
| 未设置 / `mock` | 使用源码 mock fixture，支持筛选、空态和 `keyword=__error` 错误态 |
| `real`          | 调用 YApi 已给出的真实路径，经过 mapper 转成 UI model            |

真实模式已映射的列表读取：

| 页面     | Mock 数据         | Real API                                             |
| -------- | ----------------- | ---------------------------------------------------- |
| 每日收入 | `dailyIncomeRows` | `POST /tradeDailyIncome/pageList`                    |
| 分类管理 | `categoryRows`    | `POST /polymarket/category/pageList`                 |
| 订单管理 | `orderRows`       | `POST /polymarket/order/pageList`                    |
| 仓位管理 | `positionRows`    | `POST /polymarket/position/pageList`                 |
| 告警配置 | `alertRows`       | `GET /polymarket/alert-config/get` 转成 3 条配置展示 |

真实模式已接入的导出：

| 页面     | Real API                           | 当前筛选映射                                                  |
| -------- | ---------------------------------- | ------------------------------------------------------------- |
| 每日收入 | `POST /tradeDailyIncome/export`    | `statDateStart` / `statDateEnd` 按当前日期筛选传入；响应类型和文件名待联调 |
| 订单管理 | `POST /polymarket/order/export`    | `matching` 映射为 `processing`；`success` / `failed` 原样传入 |
| 仓位管理 | `POST /polymarket/position/export` | `holding` 原样传入；`sold` / `settled` 归并为 `closed`        |

真实模式当前已覆盖列表读取：收入、分类、事件、订单、仓位、手动平账、告警配置。2026-06-25 新增按等级查询分类列表；2026-06-24 新增收入导出和一级分类删除；通用参数、持仓差异统计、收入导出、分类删除等后续按权限/审计闸口谨慎接入。

## 字段映射

### 每日收入

| UI 字段                | YApi 字段               | 说明                     |
| ---------------------- | ----------------------- | ------------------------ |
| `date`                 | `statDate`              | 统计日期                 |
| `buyOrderCount`        | `buyOrderCount`         | 买入订单数               |
| `sellOrderCount`       | `sellOrderCount`        | 卖出订单数               |
| `settlementOrderCount` | `settledOrderCount`     | 结算订单数               |
| `volume`               | `tradeAmount`           | 成交额                   |
| `buyMarkupIncome`      | `buyPlatformAmount`     | 买入加价收入             |
| `sellFeeIncome`        | `sellPlatformAmount`    | 卖出抽水收入             |
| `settlementFeeIncome`  | `settledPlatformAmount` | 结算抽水收入             |
| `pmFee`                | `polymarketAmountFee`   | PM fee，精度仍待后端确认 |
| `grossProfit`          | `grossProfit`           | 毛利由后端返回           |

### 分类管理

| UI 字段            | YApi 字段                | 说明                       |
| ------------------ | ------------------------ | -------------------------- |
| `id`               | `id`                     | 分类 ID                    |
| `name`             | `nameMap.zh-CN` / `name` | 优先中文，缺失回落英文名称 |
| `secondLevelCount` | `levelTwoTotal`          | 二级分类数量               |
| `thirdLevelCount`  | `levelThreeTotal`        | 三级分类数量               |
| `sort`             | `sort`                   | 排序                       |
| `status`           | 前端默认 `active`        | YApi 列表未提供启停状态    |

2026-06-24 新增一级分类删除接口：`GET /polymarket/category/delete?id=`。当前响应 schema 为空对象，仍需后端确认：

1. 是否只允许删除一级分类，二 / 三级分类是否继续走 `update/full` 或另有接口；
2. 存在子级分类、关联事件、已上线事件时的错误码和提示；
3. 成功响应 wrapper 是否与其他接口一致。

2026-06-25 新增按等级查询分类列表接口：`GET /polymarket/category/category/list?level=`。

| 字段         | 类型    | 说明                                             |
| ------------ | ------- | ------------------------------------------------ |
| `level`      | query   | 可选；1 一级分类，2 二级分类，3 三级分类         |
| `id`         | integer | 分类 ID                                          |
| `parentId`   | integer | 父级分类 ID，0 表示一级分类                      |
| `pathIds`    | string  | 分类路径 ID，例如 `/1/` 或 `/1/2/`               |
| `level`      | integer | 分类层级：1 一级分类，2 二级分类，3 三级分类     |
| `code`       | string  | 分类编码                                         |
| `sort`       | integer | 排序值，数值越小越靠前                           |
| `status`     | integer | 状态：1 启用，0 禁用                             |
| `createTime` | string  | 创建时间                                         |
| `updateTime` | string  | 更新时间                                         |

> 该接口当前不返回多语言名称和子级数量，适合补充按层级筛选 / 级联基础数据；分类列表展示仍优先使用 `pageList`，分类级联仍可按场景选择 `tree` 或 `category/list`。

### 订单管理

| UI 字段                  | YApi 字段               | 说明                                                                  |
| ------------------------ | ----------------------- | --------------------------------------------------------------------- |
| `orderId`                | `orderNo`               | 本地订单号                                                            |
| `uid`                    | `uid`                   | 用户 UID                                                              |
| `event`                  | `eventDirectionDisplay` | YApi 已拼事件 + Yes/No 方向                                           |
| `hash`                   | `txHash`                | Polygonscan 跳转                                                      |
| `type`                   | `opTradeType`           | `buy` / `sell` / `settled`，前端将 `settled` 映射为结算展示           |
| `amount`                 | `amount`                | 订单金额                                                              |
| `shares`                 | `tradeShares`           | 份额                                                                  |
| `platformIncome`         | `platformAmount`        | 平台收入                                                              |
| `status`                 | `statusType`            | `success` / `failed` / `processing`，前端将 `processing` 映射为成交中 |
| `createdAt` / `filledAt` | `displayTime`           | YApi 当前只给一个展示时间                                             |

### 通用参数管理

2026-06-24 新增通用参数管理接口，当前在 YApi 中复用了 `alert-config` path 前缀，但分类为“通用参数管理”。

| 场景         | Method / Path                                    | 字段                                 | 说明                                                                                                                      |
| ------------ | ------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 查询三档 fee | `GET /polymarket/alert-config/get_1782211018309` | `buyFee`, `sellFee`, `settlementFee` | 分别对应 `polymarket_buy_fee`、`polymarket_sell_fee`、`polymarket_settlement_fee`；路径带时间戳后缀，接入前需确认是否稳定 |
| 更新三档 fee | `POST /polymarket/alert-config/fee/update`       | `buyFee`, `sellFee`, `settlementFee` | YApi ID 4618 已变更为该接口；`sellFee` 示例值疑似误填为 Lark webhook，需要后端确认字段类型和精度                          |

### 告警配置

YApi 返回的是单对象配置，前端为了复用列表 UI 映射为三条配置：钱包余额警告/紧急、下单失败、持仓差异。

| UI 行        | YApi 字段                                                          |
| ------------ | ------------------------------------------------------------------ |
| 钱包余额告警 | `walletWarningBalance`, `walletCriticalBalance`, `larkWebhookUrl`  |
| 下单失败告警 | `orderErrorThreshold`, `orderErrorWindowMinutes`, `larkWebhookUrl` |
| 持仓差异告警 | `positionDiffRate`, `larkWebhookUrl`                               |

### 仓位管理

| UI 字段                   | YApi 字段                 | 说明                                                      |
| ------------------------- | ------------------------- | --------------------------------------------------------- |
| `positionId`              | `id`                      | 仓位 ID，对应 `polymarket_order_position.id`              |
| `uid`                     | `uid`                     | 用户 UID                                                  |
| `event`                   | `eventDirectionDisplay`   | YApi 已拼事件 + Yes/No 方向                               |
| `side`                    | `eventDirectionDisplay`   | 前端从展示文案解析 Yes/No；后端未单独返回方向字段         |
| `margin`                  | `betAmount`               | 保证金 / 下注金额                                         |
| `shares`                  | `betShares`               | 份额                                                      |
| `platformIncome`          | `platformAmount`          | 平台收入，按 position_id 汇总订单 platform_amount         |
| `status`                  | `statusType`              | `holding` 保持持仓中；`closed` 归并展示为已平仓           |
| `createdAt` / `updatedAt` | `createdAt` / `updatedAt` | YApi 同时提供毫秒时间戳字段，当前列表优先展示格式化字符串 |

## 需要后台补充的接口

| 优先级 | 模块       | 缺失接口 / 信息                                                                         | 用途                                                                                      |
| ------ | ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P0     | 权限       | 预测市场菜单与按钮 permission code，尤其手动平账独立权限                                | legacy 菜单、Next 菜单和按钮权限接入                                                      |
| P1     | 每日收入   | 导出响应类型 / 文件名规则、summary 响应标准 wrapper、PM fee 精度/币种、Gas 口径          | 收入页完整联调和报表导出；导出接口已新增，仍需文件流联调                                  |
| P1     | 分类管理   | 一级删除错误码、二/三级删除方式、排序保存、按等级查询是否返回多语言名称、响应 wrapper 统一 | 当前已新增一级删除和按等级查询；仍缺二/三级删除口径、排序保存、多语言名称和列表展示字段确认 |
| P1     | 订单管理   | 失败订单退款字段、导出文件名规则、筛选枚举完整说明                                      | 订单页筛选/导出/异常态                                                                    |
| P1     | 仓位管理   | 单独方向字段、均价/标记价/盈亏字段、导出文件名规则                                      | 当前列表只给页面展示低保真字段，无法展示完整仓位风险信息                                  |
| P1     | 事件管理   | `findAdminByPage` 列表补 `tableType`（及视需要 `slug` / `sellRate` / `settlementRate`），确认新增时间筛选字段是否均为毫秒时间戳 | 列表内区分赛事/普通事件，目前恒显示 EVENT；新增时间筛选接入前需确认时区 / 单位                         |
| P1     | 手动平账   | 明确 `diffRate` 计算口径（分母为链上持仓还是交易所持仓）                                | 统一前端差异率列与后端 `diffRate`                                                         |
| P1     | 告警配置   | Webhook 脱敏字段、是否允许前端提交 secret、告警配置新版更新 path 是否稳定               | Lark secret 不回显和配置保存安全边界；测试告警接口未提供且 PRD 删除线标记，当前不作为必做 |
| P2     | 公共       | 统一分页结构、错误码、时区、金额/份额/rate 类型与精度                                   | mapper、formatter、错误提示稳定化                                                         |
| P2     | Web 用户侧 | 埋点上报接口/SDK 点位、交易关闭错误码/禁用态字段                                        | 用户侧埋点和交易开关联动                                                                  |

## 联调注意事项

- `code` 在示例中同时出现 string 和 integer，前端 mapper 不能只按一种类型判断。
- 部分请求/响应示例包含注释，不是严格 JSON；联调时以真实响应为准。
- 分类 `saveChildren`、`update/full` 当前没有响应示例；前端 mutation 接入前需确认成功/失败结构。
- 告警 `larkWebhookUrl` 可能包含 secret，前端真实页面应只提交、不回显；列表中只能显示已配置/未配置。
- 订单 / 仓位导出成功返回文件流，失败返回 JSON；导出函数已复用通用 `postOperateExportDownload` 按 `content-type` 分支处理。
- 每日收入导出接口 2026-06-24 已新增，但 YApi 未写响应 body / content-type；建议沿用订单 / 仓位导出的文件流处理方式联调，并补文件名规则。

### 事件管理

| UI 字段                                         | YApi 字段                                 | 说明                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`                                            | `eventId` / `id`                          | 列表展示优先使用 Polymarket eventId                                                                                    |
| `category` / `secondCategory` / `thirdCategory` | `tagType` / `tagTypeTow` / `tagTypeThree` | 分类 code；中文名称待分类树映射                                                                                        |
| `displayStatus`                                 | `status`                                  | 0 下线，1 仅可见，2 开启交易                                                                                           |
| `eventType`                                     | `tableType`（仅 `eventSync` 返回）        | 1 赛事，2 普通事件；**`findAdminByPage` 列表项不返回该字段**，列表内事件类型恒为 EVENT，待后端补字段（见 P1 待确认项） |
| `startAt` / `settleAt`                          | `startDate` / `settleTime` / `endDate`    | 时间字段按后端返回展示                                                                                                 |
| `polymarketStatus`                              | `settleStatus`                            | 0 未结算 / 1 已结算                                                                                                    |

`findAdminByPage` 本轮新增 4 个请求筛选字段：

| 筛选含义     | YApi 字段            | 类型 / 示例      | 接入备注                                      |
| ------------ | -------------------- | ---------------- | --------------------------------------------- |
| 上线时间开始 | `startDateNum`       | number / ms 时间戳 | 对应事件列表“上线时间”范围筛选，单位需联调确认 |
| 上线时间结束 | `endDateNum`         | number / ms 时间戳 | 同上                                          |
| 结算时间开始 | `settleStartDateNum` | number / ms 时间戳 | 对应事件列表“结算时间”范围筛选，时区需联调确认 |
| 结算时间结束 | `settleEndDateNum`   | number / ms 时间戳 | 同上                                          |

> 列表接口 `findAdminByPage` 不返回 `slug`、`sellRate`、`settlementRate`、`tableType`；对应列在真实模式显示 `-` 或退化为 EVENT，需后端确认是否在列表补充这些字段。

### 手动平账

#### 顶部统计

| UI 字段建议                               | YApi 字段            | 说明                                                     |
| ----------------------------------------- | -------------------- | -------------------------------------------------------- |
| `unbalancedEventCount`                    | `unEventCount`       | 未平事件数量，统计 `status=0` 的持仓差异记录数           |
| `totalPendingDiffShares` / `sumDiffValue` | `sumDiffValue`       | 待平账差异额，统计 `status=0` 的 `diff_value` 绝对值合计 |
| `settledTodayCount`                       | `todayBalancedCount` | 今日已平数量，统计今日完成且 `result=1` 的平账记录数     |
| `lastReconciliationTime`                  | `latestTime`         | 最近同步事件时间                                         |

#### 列表与记录

| UI 字段             | YApi 字段                                       | 说明                                                           |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `event`             | `marketTitle`                                   | 市场标题                                                       |
| `side`              | `eventDirection`                                | Yes / No 方向                                                  |
| `exchangePosition`  | `exchangePosition`                              | 交易所持仓                                                     |
| `chainPosition`     | `chainPosition`                                 | 链上持仓                                                       |
| `shares`            | `tradeDiffValue` / `diffValue`                  | 实际交易差异值 / 差异值                                        |
| `suggestedAction`   | 差异列表 `opType` / 记录列表 `side`（BUY/SELL） | BUY 映射买入，SELL 映射卖出                                    |
| `suggestActionText` | `suggestAction`（中文文本，如“买入 2 份”）      | 记录列表“动作”列优先展示后端完整文案，无值时回退到 `side` 标签 |
| `status`            | 差异列表 `status`；记录列表 `result`            | 差异 0 待平账；记录 0 执行中、1 完成、2 失败                   |

> **差异率口径待确认**：前端 `差异率` 列按 `差值 / 链上持仓` 计算（`getDiffRateText`），后端 `diffRate`（示例 0.2，对应 exchange=10/chain=8/diff=2）疑似按 `差值 / 交易所持仓`，分母不一致；联调时需用真实数据确认口径后再决定是否改用后端 `diffRate`。

## 2026-06-25 增量接口差异

| 类型 | Method / Path                                      | YApi ID | 说明                                                                                     |
| ---- | -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| 新增 | `GET /polymarket/category/category/list?level=`    | 5245    | 按分类层级查询列表；`level` 可传 1/2/3，响应含 `id`、`parentId`、`pathIds`、`code`、`sort`、`status` |

## 2026-06-24 增量接口差异

| 类型 | Method / Path                         | YApi ID | 说明                                                                 |
| ---- | ------------------------------------- | ------- | -------------------------------------------------------------------- |
| 新增 | `GET /polymarket/category/delete?id=` | 5233    | 一级分类删除；响应 schema 为空，需确认关联事件 / 子级分类错误码      |
| 新增 | `POST /tradeDailyIncome/export`       | 5239    | 每日收入导出；入参为 `statDateStart` / `statDateEnd`，响应类型待联调 |
| 变更 | `POST /polymarket/event/findAdminByPage` | 4681 | 本轮新增 `startDateNum` / `endDateNum` / `settleStartDateNum` / `settleEndDateNum` 4 个时间范围筛选字段，示例为毫秒时间戳 |

## 2026-06-23 增量接口差异（历史记录）

| 类型 | Method / Path                                        | YApi ID | 说明                                                                           |
| ---- | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| 新增 | `GET /polymarket/alert-config/get_1782211018309`     | 5212    | 通用参数查询：`buyFee`、`sellFee`、`settlementFee`                             |
| 新增 | `POST /polymarket/alert-config/update_1782211023564` | 5215    | 预警配置新版更新：钱包余额、下单失败、持仓差异、Lark webhook                   |
| 新增 | `GET /positionDiff/statistics`                       | 5218    | 手动平账顶部统计：未平事件数量、待平账差异额、今日已平数量、最近同步事件时间   |
| 变更 | `POST /polymarket/alert-config/fee/update`           | 4618    | 原“预警配置更新”ID 变为通用参数 fee 更新；接入前需确认最终稳定 path 与字段精度 |
