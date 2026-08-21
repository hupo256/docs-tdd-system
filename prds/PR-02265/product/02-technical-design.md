<!-- template-version: 3 -->
<!-- template-effective-since: 2026-07-25 -->

# Technical Design — PR-02265 外部做市商合约账户支持配置负手续费率

> 技术栈事实：`apps/web` = 前台 web（React/TS）；`apps/admin/legacy-admin` = 现货管理后台（Vue2 + Element UI）；`apps/futures-admin/legacy-admin` = 合约管理后台（Vue2）。F01~F04、F06、F08~F12 位于现货后台，F13 位于现存手续费折扣页，F05 位于 apps/web。接口均复用现状；Mock 已豁免（见 03-api-contract §0.1）。

## 复用盘点（G4 前必填）

> 规则：实现前优先复用已有逻辑/工具/组件；相近能力先轻量封装或组合，仅明显不适配才新建。

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 | 不复用原因（仅新建时必填） |
|------|-------------------|------|----------|----------------------------|
| 组件(Vue) | `apps/admin/legacy-admin/.../marketMakerAccount/external_market_account_modal.vue`（添加/编辑弹窗）、`market_maker_account.vue`（列表） | 现有弹窗与列表已实现全部字段，仅需放开负值+加提示文案+列表负值显示 | 直接复用（改现有组件） | — |
| 校验逻辑(Vue) | 同弹窗 `isValidSpotFeeValue`(:563)/`sanitizeSpotFeeInput`(:524) 现货侧**已支持负号**（`/^-?\d+/`+`Math.abs`） | 合约侧 `isValidFuturesFeeValue`(:572)/`sanitizeFuturesFeeInput`(:548) 照现货侧对齐即可放开负值 | 轻量封装（合约校验借鉴现货侧现成模式） | — |
| utils/formatter(React) | `apps/web/src/utils/formatNumber.ts`（`formatNumberDown`、`formatSignedFee`）、`UpOrDownText` 组件 | 已有精度格式化与正负色能力；新增的 `formatSignedFee` 只对正数补 `+`，不改变后端符号 | 直接复用 + 小型语义 formatter | — |
| 展示组件(React) | `FuturesHistoryTransactionOrder/helper.ts`、`TransactionRecords/index.tsx`、`PositionHistory/Card.tsx`、`CashFlow/futures/FuturesCashFlow.tsx` | `fee`/`tradeFee` 走 signed fee 规则，`get_transaction_list.amount` 直接保留后端符号 | 直接复用（仅改格式化调用） | — |
| 展示逻辑(Vue后台) | `apps/admin/.../userManager/other_information/i_contract_capital_flow.vue`(:50-51,159 amountClass+side)、`apps/futures-admin/.../mixin/reportManager/*` | 现有后台流水/费用展示，改正数化 | 直接复用（改格式化） | — |
| service/API | `apps/admin/legacy-admin/src/api/operateManager/marketAccount.js`（`/externalMmAccount/add|update|page`） | 接口已存在，payload 字段名 open/close Maker/Taker Fee 不变 | 直接复用（不改接口） | — |
| 提示框(Vue) | `external_market_account_modal.vue` 已有 `.fee-effective-rule`；会员等级白名单在 `vip_level/components/userWhiteList.vue`、`coinWhiteList.vue`；手续费折扣在 `futuresExchange/components/futuresFeeDiscountModal.vue` | F09/F10 复用现有提示框；F11~F13 在对应弹窗增加同类轻提示块 | 直接复用现有弹窗和样式语义 | — |

所有相关能力均复用现状实现，无新建绕过复用。做市账户模块无 zod schema / mapper / React Query（属 Vue 体系），故无该层复用项。

## PRD 路径核验

> 逐字回显 PRD 操作路径，防止实现时静默替换页面落点。

| PRD 原文路径（逐字） | 对应 Feature | 代码落点 |
|----------------------|--------------|----------|
| 【现货管理后台】--【资产管理】--【做市账户工具】--【外部做市商账号】--【添加】 | F01/F02/F03 | `external_market_account_modal.vue` |
| 【现货管理后台】--【资产管理】--【做市账户工具】--【做市账户管理】--【外部做市商】 | F04 | `market_maker_account.vue` |
| 【现货管理后台】--【用户管理】--【会员等级】--【基础配置】--【用户白名单配置】添加、编辑 | F11 | `vip_level/components/userWhiteList.vue` |
| 【现货管理后台】--【用户管理】--【会员等级】--【基础配置】--【币对白名单配置】添加、编辑 | F12 | `vip_level/components/coinWhiteList.vue` |
| 【合约管理后台】--【手续费】--【手续费折扣】添加、编辑 | F13 | `futuresExchange/components/futuresFeeDiscountModal.vue` |

## 单一事实源与所有权（G4 前必填）

> 每项业务事实只保留一个权威写入源；跨 app 无法共享代码的复制必须写清同步方式、owner、验证。

| 事实 / 状态 / 规则 | 权威来源 / 唯一写入口 | 消费者与读取 / 派生方式 | 是否存在副本 | 副本同步、失效、owner 与验证证据 |
|--------------------|-----------------------|--------------------------|--------------|------------------------------------|
| 合约手续费率值域/精度（`[-100,100]`、6 位） | `external_market_account_modal.vue` 的 `FEE_MIN/FEE_MAX/FEE_DECIMALS`(:281-283) + `isValidFuturesFeeValue`/`sanitizeFuturesFeeInput` | 该弹窗表单校验与 sanitize | 否（现货侧 `isValidSpotFeeValue` 为独立字段，非同一事实） | 无 |
| 前台手续费字段符号语义 | 2026-08-20 后端最终契约：`fee`/`tradeFee` 正常手续费负、返佣正；`get_transaction_list.amount` 直接遵循后端符号 | Web `formatSignedFee` 消费前两者；`FuturesCashFlow` 直接格式化 `amount` | 否 | `formatNumber.test.ts` 锁定正数补 `+`、负数原样、0 无符号；G5 用户确认通过 |
| 后台 PRD 正数化触点 | PRD §5.3；不覆盖已单独确认的 `history_position_list.tradeFee` signed 语义 | 现货后台 `positivizeAmount`、合约后台 `positivizeAmount`/`flowerFlowFee` | **是**（Vue2 两 app 无法共享代码） | 两端纯函数单测 + `flowerFlowFee.spec.js` 保证一致；owner=前端 |
| 固定文案（提示/校验报错） | PRD 原文（见 03-api-contract §7） | Vue 弹窗 i18n/直文 | 否 | 逐字断言测试保证 === PRD 原文 |
| 费率配置即时生效 | `/externalMmAccount/add|update` 保存成功后的服务端配置 | 合约交易取费率链路；前端仅提交并刷新，不引入延时缓存 | 后端事实 | G5 用保存后立即发起的下一笔匹配交易验证，不以 UI toast 代替生效证据 |

## 数据流与分层契约（请求型功能 G4 前必填）

> 调用链 `Component → Hook → Service`；数据链 `response → schema → mapper → UI Model`。无请求的纯 UI 填 N/A 并说明。

| Feature / Component | React Query Hook | Query Key | API Service | Response Schema / DTO | Mapper | UI Model | State Owner | Test |
|---------------------|------------------|-----------|-------------|-----------------------|--------|----------|-------------|------|
| F05 前台流水/成交/仓位手续费展示（React） | 复用现状 hook（不改数据获取） | 现状 key | 复用现状 service | 无 schema 改动（`fee`/`tradeFee`/`amount` 已存在） | `fee`/`tradeFee` 用 `formatSignedFee`；`amount` 直接按精度格式化 | 现状 UI Model + 展示文本派生 | React Query（现状） | signed fee 单测 + 组件展示 |
| F01~F04 做市账户配置/列表（Vue2 admin） | N/A（Vue2 非 React Query） | N/A | `marketAccount.js` axios（`/externalMmAccount/*`，复用） | N/A（Vue 无 zod，费率值前端校验） | N/A | Vue 组件 data | Vue 组件本地 state | 校验/格式化纯函数单测 |
| F06 后台流水手续费展示（Vue2 admin） | N/A（Vue2） | N/A | 复用现状后台流水接口 | N/A | N/A（`amountClass`+side 展示派生） | Vue 组件 data | Vue 组件本地 state | 正数化逻辑单测（如可）+ G5 联调 |
| F08 即时生效 | N/A（Vue2） | N/A | `/externalMmAccount/add|update` | 既有 payload 不变 | N/A | 保存成功后刷新现状列表 | 服务端配置 | G5 保存后立即成交验证 |
| F09~F13 提示文案 | N/A | N/A | 无新增请求 | N/A | N/A | 静态 i18n 文案 | Vue 组件 | 字面量断言 + 弹窗视觉证据 |

分层例外：Vue2 legacy-admin 不适用 React 分层契约，属既有技术栈事实，非本需求引入；F05 复用现状 React 请求链不新增 hook/schema。

## 状态 / 文案 / class 映射

| 场景 | 输入 key | 输出 | 实现位置 |
|------|----------|------|----------|
| 费率输入校验 | 输入字符串 | 合法(bool) / sanitize 后字符串 | Vue 弹窗 `isValidFuturesFeeValue`/`sanitizeFuturesFeeInput`（放开负号后抽为可测函数） |
| 费率列表显示 | 费率值(可负) | `${value}%` / `--` | `market_maker_account.vue` `formatExternalFee`(:1563) |
| 历史成交/仓位手续费 | `fee` / `tradeFee` | 正数补 `+`，负数原样，0 无符号 | 前台 `formatSignedFee`；合约后台 `fixD` + `valueDisplay` |
| `get_transaction_list` 流水金额 | `amount` | 保留后端符号，仅按精度格式化 | `FuturesCashFlow.tsx` 等既有展示链路 |
| 后台其余 PRD 正数化触点 | 金额(可负) | 显示绝对值 | 两个 legacy-admin 的 `positivizeAmount` / `flowerFlowFee` |

## Tailwind preset 对齐

| UI 项 | Figma 值 | preset class | 例外说明 |
|-------|----------|--------------|----------|
| Vue admin（F01~F04/F06） | 无 Figma | N/A | Vue2 + Element UI，非 tailwind 体系；复用现有样式，无新增尺寸 |
| React F05 展示 | 无 Figma | 复用现有组件 class | 仅改格式化文本，不新增布局/尺寸 |

## 方案

**F01/F03（放开合约费率负值 + 校验文案）— `external_market_account_modal.vue`**
1. `FEE_MIN` 由 `0` 改为 `-100`（:282），`FEE_MAX` 保持 `100`（区间 `[-100,100]`）。
2. `isValidFuturesFeeValue`(:572)：正则 `/^\d+(\.\d{1,6})?$/` → `/^-?\d+(\.\d{1,6})?$/`（允许负号），范围判断沿用 `num >= FEE_MIN && num <= FEE_MAX`（即含负值）。参考现货侧 `isValidSpotFeeValue`(:563) 现成模式。
3. `sanitizeFuturesFeeInput`(:548)：`replace(/[^\d.]/g,"")` → 保留首位负号（借鉴 `sanitizeSpotFeeInput`:524），精度仍 `slice(0, FEE_DECIMALS=6)`。
4. `handleFeeInput` 非法字符判断(:897)：futures 分支 `/[^\d.]/` → `/[^\d.\-]/`。
5. 校验失败提示文案统一为「请输入【-100,100】之间的数字，精度支持6位」（以 PRD 正文为准）。
6. 把校验/sanitize 抽为可独立单测的纯函数，覆盖负值/边界 `±100`/6 位精度/多负号/非法。

**F02（常驻提示文案）**：弹窗 4 费率输入框下方新增常驻提示「按对应订单类型分别收取，负值表示返佣费率(如-0.000001)」。

**F04（列表负值显示）**：`market_maker_account.vue` `formatExternalFee`(:1563) 兼容负值（当前 `value ? \`${value}%\` : "--"` 已支持负值字符串，确认负号正常拼接与列宽/换行）。

**F05（前台 web 符号展示）**：2026-08-20 最终对账后，`his_trade_list_v2.fee`、`history_position_list.tradeFee` 均为正常手续费负、返佣正；相关展示统一使用 `formatSignedFee`，仅对正数补 `+`，负数原样。`get_transaction_list.amount` 直接遵循后端符号，只按精度格式化，不做 `abs()`、取反或重新拼符号。2026-08-19 的统一正数化实现已回退，废弃的 `toPositiveAmount` 及其测试删除。

**F06（后台展示）**：`history_position_list.tradeFee` 在合约后台由 `fixD` 保留原始符号、`valueDisplay` 为正数补 `+`；`i_contract_capital_flow.vue`、`userFeeInfoList.js` 及 `flowerDetail.vue`/`.js` 等 PRD 正数化触点继续使用后台 `positivizeAmount`/`flowerFlowFee` 显示绝对值。不同接口不再强行套同一符号规则。

**F07**：后端逻辑，前端不实现，G5 联调确认展示层不受影响。

**F08（新增/编辑费率即时生效）**：继续复用 `/externalMmAccount/add|update`；前端保存成功后立即刷新列表，不增加 debounce、定时刷新或客户端缓存。真正生效时点属于后端配置读取链路；用户于 2026-08-21 确认 G5 联调通过，本会话未取得可归档交易明细。

**F09/F10（外部做市商弹窗蓝框）**：把 `external_market_account_modal.vue` 现有单行 `externalFeeEffectiveRule` 改为按 `isFuturesBizType` / `isSpotBizType` 输出两条逐字文案；两业务类型的第二条来源表不同，不允许共用错误文案。

**F11/F12（会员等级白名单）**：分别在 `userWhiteList.vue`、`coinWhiteList.vue` 的添加/编辑弹窗表单尾部、footer 前增加蓝色轻提示框。F11 主语为「账号若在」，F12 主语为「账号交易的币对若在」，不得互换。

**F13（手续费折扣）**：在 `futuresFeeDiscountModal.vue` 添加/编辑弹窗表单尾部、footer 前增加蓝色轻提示框，逐字使用 PRD 相邻正文；图片 OCR/alt 只用于位置和样式，不覆盖正文。

**测试策略**：MSW 已豁免；负值/边界靠**纯函数单测**（校验、sanitize、signed fee、后台正数化）+ test 后端真实负费率数据联调（G5）。
