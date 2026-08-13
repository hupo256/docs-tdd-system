<!-- template-version: 3 -->
<!-- template-effective-since: 2026-07-25 -->

# Technical Design — PR-02273 增强体验金改为保证金模式

> G4 复用盘点基于编码 worktree `/Users/aven/github/PR-02273`（fameex-web, `feature/PR-02273`）实际扫描，路径均相对该仓根。

## 复用盘点（G4 前必填）

> 规则：实现前必须优先复用已有逻辑、工具、组件；相近能力先轻量封装或组合，只有明显不适配时才新建。新建必须写明不复用原因。

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 | 不复用原因（仅新建时必填） |
|------|-------------------|------|----------|----------------------------|
| 组件（C端卡片/弹窗/记录） | `apps/web/src/apps/MyRewards/components/RewardCard.tsx`(RewardCard, enums RewardStatus/CouponType, getCouponTip)、`MyRewards/components/ActivateCouponModal.tsx`(领取弹窗)、`apps/web/src/apps/Assets/components/BonusDetailMan/index.tsx`+`DetailTable.tsx`(体验金详情弹窗)、`apps/web/src/apps/Orders/CouponRecord/TrialFeeClaimRecord/index.tsx`+`useTrialFeeClaimRecordColumns.tsx`(领取记录) | 全部命中，增强体验金专版就地改造（状态收敛去「已使用完」、抵扣比例→配资比例文案、删使用方式/使用规则、隐藏查看使用详情） | 轻量封装（在既有组件内按 `isEnhancedTrialBalanceRecord` 分支改造，普通版不动） | — |
| 组件（admin 表单/记录） | `apps/admin/src/apps/TrialBalanceCreateOrder/components/SearchForm.tsx`(CreateForm: trialMode 下拉 + deductionRate 抵扣比例 InputNumber%)、`apps/admin/src/apps/CouponDistributionRecords/`(发放记录 useColumns: usedAmount/remainingAmount/expiredAmount)、`CouponUsageRecords/`(使用记录)、`components/InformationBlock.tsx`(InformationBox type="error") | 命中，配资比例风险提示复用 `text-red-500` 静态文案约定 / `InformationBox` | 轻量封装（表单加风险提示行 + 类型分支；记录列口径调整） | — |
| hooks | C端 `apps/web/src/services/api/rewards.ts`(usePrizeList/useCouponRecordList/useTrialFeeClaimRecordList/useCouponTradeDetail)、`services/api/trial-fee.ts`(useTrialFeeCouponActivate*)、`services/api/futures/trial-balance.ts`(useTrialBalance)、`Futures/hooks/useEstimatedLiqPrice.ts`/`usePositionLiqPrice.ts`/`useEffectiveTrialAmount.ts`；admin `services/api/trialBalance.ts`(useTrialFeeCreate)、`services/api/benifits.ts`(searchCoupon*Records) | 全部命中 | 直接复用（新字段经 schema/mapper 扩展） | — |
| services / API | C端 `apps/web/src/services/api/{rewards,trial-fee,margin}.ts`、`services/api/futures/{trial-balance,position-assets-list}.ts`；admin `services/api/{trialBalance,benifits}.ts` | 命中，均为既有域 service | 直接复用 + 扩展字段/端点 | — |
| stores / selectors | `apps/web/src/apps/Assets/components/BonusDetailMan/store.ts`(useTrialFeeStore: trialFeeList)、合约 `accountAssetStore.entities[coin].availableTrialBalance`(useEffectiveTrialAmount 读取) | 命中；MyRewards 页无独立 store（RQ + local useState） | 直接复用现有 store，不新增 | — |
| utils / formatter / mapper | C端 `apps/web/src/utils/trialBalanceCoupon.ts`(TRIAL_RULE_TYPE.EnhancedTrial=3, CONTRACT_TRIAL_COUPON_TYPE=9, ENHANCED_CONTRACT_TRIAL_COUPON_TYPE=10, isEnhancedTrialBalanceRecord)、`MyRewards/index.tsx`(convertPrizeToReward)、`MyRewards/formatRewardModalDetails.ts`(formatExperienceFundDetailModal/formatLeverageRangeText/fmtDeductionRate)、`utils/formatNumber.ts`；合约 `Futures/utils/{availableBalance,marginRate}.ts`、`utils/liq/{liq.entry,liq.formulas}.ts`；admin `utils/trialFeeActivation.ts`、`constants/{trialBalance,couponTypeLabels}.ts` | 全部命中 | 直接复用；F07/F08 需就地改公式剔除增强体验金项 | — |
| 历史项目实现（PR-01319 预估强平价） | 全仓无 `01319`/`PR-01319` 字符串标记；预估强平价能力实为 `Futures/utils/liq/*` + `useEstimatedLiqPrice` 现网实现 | 命中（无 PR 标记，直接复用模块） | 直接复用现网 liq 模块 | — |

## 单一事实源与所有权（G4 前必填）

> 每项业务事实只保留一个权威写入源；其他位置读取或派生。缓存、持久化镜像、读模型等复制若确有必要，必须写清同步/失效机制、陈旧窗口、owner 和恢复方式。完整门禁见 [architecture-and-state.md §4.0](../../../common/rules/architecture-and-state.md)。

| 事实 / 状态 / 规则 | 权威来源 / 唯一写入口 | 消费者与读取 / 派生方式 | 是否存在副本 | 副本同步、失效、owner 与验证证据 |
|--------------------|-----------------------|--------------------------|--------------|------------------------------------|
| 增强体验金余额（可用/使用中/总额） | 后端账户资产：`useTrialBalance`（`/api/futures/trial-balance`）+ WS 推送写入 `accountAssetStore.entities[coin].availableTrialBalance` | `Futures/hooks/useEffectiveTrialAmount`、`OrderPanel/Available.tsx`、C端卡片/详情弹窗读取 | 否 | 无；前端不本地写余额，仅读后端值 |
| 卡券/体验金申请配置（类型/配资比例/规则） | 后端（admin `useTrialFeeCreate` 提交、`searchTrialBalanceList` 查询） | admin 表单只读展示 + 提交；C端 `usePrizeList` 读取 `trialMode`/`deductionRate` 展示 | 否 | 无；表单为写入入口，展示端只读 |
| 预估强平价 / 保证金率 / 维持保证金 | **前端本地计算**：`Futures/utils/liq/liq.entry.ts`(calcEstimatedLiqPriceOpen)、`utils/marginRate.ts`(calcCrossMarginRate/calcIsolatedMarginRate/getCrossMarginTrialBalances)，输入=行情+持仓+余额 | `OrderPanel/EstimatedLiqPrice.tsx`、`FuturesAssetPanel/PositionInfo.tsx`、`PositionCell.tsx` | 是（后端 fallback） | 后端 DTO `reducePrice`/`marginRate`（`CurrentPositions/store.ts`）作兜底；陈旧窗口=推送间隔；owner=合约后端；本期改前端公式剔除增强体验金，验证以前端展示与实际触发口径一致为准（见 06 待核已闭环） |
| 「抵扣比例」→「配资比例」等 C端文案 | i18n 单一 key 源 `apps/web/src/i18n/locales/*/rewards.json`（namespace `rewards`：activateCouponModal.*、couponTips.enhancedTrialBalance、couponTypes_10、detailDeductionRatio） | 卡片/弹窗/记录经 `useT('rewards')` 读取 | 否 | 无；文案改动落 key，多语言同步 |
| admin 配资比例风险提示文案 `copy.admin.rebateRatioRisk` | i18n 单一源 `apps/admin/src/i18n/locales/*/trialBalance.json` | admin `SearchForm.tsx` 经 `useT('trialBalance')` 读取，条件展示 | 否 | 无；逐字文案待 PM 二次确认（谨慎 vs 合理，见 06） |

## 数据流与分层契约（请求型功能 G4 前必填）

> 每条请求链分别登记调用方向和响应数据转换。调用链固定为 `Feature/Component → React Query Hook → API Service`；数据链固定为 `unknown response → schema/DTO → mapper → UI Model → Hook Result → Component`。无请求的纯 UI 功能填写 `N/A` 并说明数据来源。

| Feature / Component | React Query Hook | Query Key | API Service | Response Schema / DTO | Mapper | UI Model | State Owner | Test |
|---------------------|------------------|-----------|-------------|-----------------------|--------|----------|-------------|------|
| F02 卡片 MyRewards/RewardCard | usePrizeList | welfareCenter/prizeList | rewards.ts | prizeListItemSchema/PrizeListItem | convertPrizeToReward | RewardItem | React Query | rewards.ts schema.parse contract test |
| F03 领取弹窗 ActivateCouponModal | useTrialFeeCouponActivateCheck/Activate | trial-fee-coupon/activate-check | trial-fee.ts | TrialFeeCouponActivateCheck schema | buildActivateCheckRows/mapTrialFeeCouponActivateCheckResult | 条件行 UI Model | React Query | trial-fee.ts contract test |
| F04 详情弹窗 BonusDetailMan | useTrialBalance + usePrizeList(detail) | futures/trial-balance | futures/trial-balance.ts, rewards.ts | trialBalanceSchema, prizeListItemSchema | formatExperienceFundDetailModal | 详情 UI Model | React Query + Zustand(useTrialFeeStore) | schema.parse contract test |
| F05 领取记录 TrialFeeClaimRecord | useTrialFeeClaimRecordList | welfareCenter/trialFeeClaim/list | rewards.ts | trialFeeClaimRecordRowSchema/TrialFeeClaimRecordRow | useTrialFeeClaimRecordColumns + formatLeverageRangeText | 列表行 UI Model | React Query | rewards.ts contract test |
| F06 金额口径展示 Available/资产 | useTrialBalance + useEffectiveTrialAmount | futures/trial-balance | futures/trial-balance.ts | trialBalanceSchema | getOrderAvailableBalance/getDisplayTrialBalance | 可用/使用中/总额 | React Query + accountAssetStore | availableBalance.ts 单测 |
| F07 开仓预估强平价 EstimatedLiqPrice | useEstimatedLiqPrice（无独立请求，读行情/持仓/余额输入） | N/A（前端计算） | N/A（复用 liq.entry.ts；后端 reducePrice 兜底） | 输入 DTO 复用现有；无新 schema | calcEstimatedLiqPriceOpen（改：剔除增强体验金项） | 强平价文案 | local state / store 输入 | liq.formulas.ts 纯函数单测 |
| F08 持仓保证金率/强平价 PositionInfo | usePositionLiqPrice（前端计算） | N/A（前端计算） | N/A（复用 marginRate.ts；后端 marginRate 兜底） | 无新 schema | calcCrossMarginRate/getCrossMarginTrialBalances（改：排除 enhancedTrialNum） | 保证金率/维持保证金/强平价 | local state / store 输入 | marginRate.ts 纯函数单测 |
| F09 admin 配置申请 CreateForm | useTrialFeeCreate（mutation） | N/A（mutation） | admin trialBalance.ts | TrialBalanceCreateFormValues → payload | buildTrialBalanceCreatePayload | antd Form 值 | React Query mutation + antd Form | buildTrialBalanceCreatePayload.test.ts |
| F10 admin 发放记录 CouponDistributionRecords | searchCouponDistributionRecords | benifits distribution key | admin benifits.ts | couponDistributionRecordItemSchema/CouponDistributionRecordItem | recordsPageTransfer + buildCouponDistributionSearchBody | 发放记录行（到期未使用金额口径） | React Query | benifits.ts contract test |
| F11 admin 使用记录 CouponUsageRecords | searchCouponUsageRecords | benifits usage key | admin benifits.ts | couponUsageRecordItemSchema/CouponUsageRecordItem | recordsPageTransfer + buildCouponUsageSearchBody | 使用记录行 | React Query | benifits.ts contract test |
| F13 存量兼容展示 | N/A（复用上列 hooks） | N/A | N/A | 复用现有 schema（容忍旧枚举/「已使用完」旧态） | 现有 mapper 加旧态兜底 | 兼容展示 | React Query | 现有测试 + 兜底用例 |

分层例外必须写明原因、影响范围、owner 和移除条件；不能用目录共置或“现有代码如此”代替例外说明。完整依赖边界见 [api-and-mapper.md §1](../../../common/rules/api-and-mapper.md)。

**分层例外（F07/F08 前端计算）**：预估强平价/保证金率现网为前端本地计算（`utils/liq/*`、`marginRate.ts`），非经 Hook→Service 请求链。原因=现网既有实现且行情实时性要求；影响范围=合约开仓页/持仓面板；owner=合约前端；移除条件=后端稳定下发 `reducePrice`/`marginRate` 且经对账后可切后端值。本期沿用前端计算，仅剔除增强体验金项。

## 状态 / 文案 / class 映射

静态状态、按钮文案、样式 class、跳转动作优先集中为 `Record` / resolver，不在 JSX 或 handler 中堆多层 `if` / `else if`。

| 场景 | 输入 key | 输出 | 实现位置 |
|------|----------|------|----------|
| C端卡片状态→按钮/徽标/动作（去「已使用完」） | RewardStatus | 领取 / 去使用 / 已失效 文案 + action | `MyRewards/components/RewardCard.tsx`（沿用 tipKeyMap，收敛 if/else 为 Record resolver） |
| 体验金类型→卡片/弹窗提示文案 | CouponType / TRIAL_RULE_TYPE | couponTips.enhancedTrialBalance 等 i18n key | `utils/trialBalanceCoupon.ts` + `rewards.json`（tipKeyMap: Record<CouponType,string>） |
| 领取弹窗条件行→标签/主按钮 | ACTIVATE_CHECK_CONDITION_KEY | 条件标签 + 主动作 | `MyRewards/components/activateCouponModalConstants.ts`（ACTIVATE_COUPON_CONDITION_LABEL_KEY Record） |
| admin 配资比例风险提示展示条件 | trialMode = 不可抵扣类型增强体验金 | 展示红字静态文案 `copy.admin.rebateRatioRisk` | `TrialBalanceCreateOrder/components/SearchForm.tsx` + `trialBalance.json`（条件判断 + text-red-500） |

## Tailwind preset 对齐

涉及尺寸、间距、圆角时先查 `packages/config/tailwind-preset.js`。可由 preset 表达或相近表达时，不写 `w-[400px]` / `rounded-[16px]` 这类硬编码 arbitrary class。

| UI 项 | Figma 值 | preset class | 例外说明 |
|-------|----------|--------------|----------|
| C端卡片/弹窗改造 | N/A（无 Figma，standard 保真） | 沿用 RewardCard/ActivateCouponModal 现有 class，不新增硬编码尺寸 | 就地改造，不动布局 |
| admin 配资比例风险提示（红字） | N/A（无 Figma） | 文本色 `text-red-500`（admin 全仓约定）或 `InformationBox type="error"`；间距用 preset spacing scale（如 `mt-2`=8px） | 沿用 admin 既有红字/告警约定 |
| admin 表单字段 | N/A | 复用 antd + `@/components` 封装既有样式 | 不引入 arbitrary class |

## 方案

### 前端改动边界（本期，路线：优先就地改造 + 复用）

1. **F01 文案口径**：改 `rewards.json`（+ admin `trialBalance.json`）增强体验金保证金模式文案，「抵扣比例」→「配资比例」，替换旧「优先自有资金抵扣」表述。多语言同步。
2. **F02–F05 C端**：在 `MyRewards`（卡片/领取弹窗）、`BonusDetailMan`（详情弹窗）、`TrialFeeClaimRecord`（领取记录）内按 `isEnhancedTrialBalanceRecord` 分支就地改造，普通（按比例抵扣）版完全不动（A4）。卡片状态收敛去「已使用完」，详情弹窗删使用规则、隐藏查看使用详情。
3. **F06 金额口径**：复用 `availableBalance.ts` / `useEffectiveTrialAmount`，确认总额=可用体验金+使用中体验金、可用=可用真金+可用体验金 的展示口径。
4. **F07/F08 强平价/保证金率（前端计算，G4 盘点修正）**：现网为前端本地计算。改 `utils/liq/liq.formulas.ts` 从公式中剔除增强体验金（bonus 中的 enhancedTrial 部分），改 `utils/marginRate.ts` 用 `getCrossMarginTrialBalances` 排除 `enhancedTrialNum`。以纯函数单测锁定「剔除增强体验金后」的强平价/保证金率。后端 `reducePrice`/`marginRate` 保留作兜底。
5. **F09–F11 admin**：`TrialBalanceCreateOrder/SearchForm` 加体验金类型「不抵扣类型」分支、抵扣比例→配资比例、隐藏使用规则字段、**配资比例字段下方条件展示红字静态风险提示**（后台不强制拦截）。`CouponDistributionRecords` 到期未使用金额口径调整；`CouponUsageRecords` 增强体验金无使用记录。
6. **F13 存量兼容**：现有 mapper 加旧枚举/「已使用完」旧态兜底展示，灰度开关。

### Mock / 契约测试路线（G3 路线 B 落地方式，G5 前置决策）

> **仓库现状（G4 盘点）**：fameex-web **无 MSW**（无 `msw` 依赖、无 `src/mocks/`、无 `browser.ts`/`useMockWorker`）。现网 mock 为自研 per-query `isMock` 标志 + `/api/mock` 前缀（`utils/api/index.ts` getMockUrl），且生成路径当前注释停用（无运行时效果）。测试用 **Vitest**（root `vitest.workspace.ts`），契约测试既有范式为 `schema.parse`/`safeParse` 单测（如 `services/api/marketing/contractCarnival/schemas.test.ts`）。

- **决策**：不向成熟单仓强行引入 MSW（侵入性高、与现网约定冲突）。改为登记 `agent/rule-waivers.json` 豁免 MSW 强制项，采用仓库原生约定：
  - **schema/mapper 第一天即按真实契约写**（`services/zod/*.zod.ts` 或域内 `schemas.ts`，`XxxSchema`+`z.infer`），mapper 为纯函数。
  - **契约测试**用 `schema.parse` + fixture（Vitest，`<name>.test.ts` 就近放置），覆盖 normal/empty/error/unauthorized/edge 五场景 fixture 断言。
  - **运行时 mock**沿用 `/api/mock` 前缀 + `isMock` 约定（dev-only，`NODE_ENV==='development'` 日志），真实接口 ready 后置 `isMock=false` 即切真实、业务代码零改动。
- 豁免记录须含：不能采用 MSW 的原因（仓库无 MSW 基建、引入需改造 provider/worker）、替代隔离方案（schema-first + Vitest 契约测试 + isMock 前缀）、owner、过期时间（后端接口 ready）。

### 待用户知悉（G4 盘点新增，autonomously 落定，用户可否决）

- **F07/F08 由「后端下发」修正为「前端本地计算 + 改公式剔除增强体验金」**：06-collaboration 原 G4 待核项已闭环。此项使 F07/F08 从纯展示对齐扩为「改本地强平价/保证金率公式」，但改动被 `getCrossMarginTrialBalances`（已拆 enhancedTrialNum）严格限定，非新造计算。
- **MSW 强制项豁免**：因仓库无 MSW，改走 schema-first + Vitest 契约测试 + isMock，登记 rule-waivers。
