# PR-02273 交接文档（Handoff）— 增强体验金改为保证金模式

> 生成时间：2026-08-13。给「在编码 worktree 里继续的下一个 chat」。
> 编码 worktree：`/Users/aven/github/PR-02273`（fameex-web，分支 `feature/PR-02273` ← `origin/online`，端口 4102）。
> docs_tdd 事实源：`/Users/aven/github/docs_tdd`（worktree 内经 `apps/web/docs_tdd/` 符号链接可达）。
> 文档分支：docs_tdd 仓 `pr-02273/kickoff-g0-g2`（已推送到 origin）。

---

## 0. 一句话现状

G0–G3 全部 PASS 并已提交推送。G4 复用盘点已完成、`02-technical-design.md` 已填满。**G4 gate 尚未重跑**。下一步：闭环两处口径修正 → 登记 MSW 豁免 → 跑 G4 → 进入 G5 编码（schema/mapper/契约测试 + 展示层改造），跑到 G5 等真实 API 对接。

## 1. 用户给的执行授权（务必遵守）

- 全权自主，权限提示一律默认 YES，**不要停下来问、不要等待**。
- **尽可能自主一路跑到 G5，停在「等待真实 API 对接」**。
- 全局规则（CLAUDE.md）：对用户中文回复；代码/标识符/命令/路径用英文。docs_tdd 门禁按顺序走不跳。不伪造 mapper/数据。CLAUDE.md 是符号链接，改它要经 `~/.ai-rules/AGENT.md`，别用 sed/perl -i。
- 提交信息结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。用户此前建立了「add commit push」节奏，文档阶段每过一个 gate 提交并推送 docs_tdd 分支。

## 2. Gate 状态与常用命令

在 **docs_tdd 根**（`/Users/aven/github/docs_tdd`）跑 orchestrator：

```
node common/engine/agent-scripts/docs-tdd.mjs status  PR-02273
node common/engine/agent-scripts/docs-tdd.mjs next    PR-02273
node common/engine/agent-scripts/docs-tdd.mjs gate    PR-02273 G4
node common/engine/agent-scripts/docs-tdd.mjs changed  PR-02273   # 编辑后无 hook 时手动跑
```

已通过：**G2 PASS**（39/39 doc，manifest fingerprint `e6eeaef4a44ed260`，PRD revision 2547）；**G3 PASS**（doc 46/46，impl 6/6）。
未跑：**G4**（上次 dry-run BLOCK，因 `02-technical-design.md` 有占位符，现已填满，需重跑确认）。

## 3. 本轮已完成（G0–G3 + G4 文档）

1. **PRD revision 2273→2547 重新同步 + 重跑 intake**：富媒体 sourceId 顺延重编号（图片 IMG-009..016→017..025，按 assetHash 桥接沿用分类），新增 `PRD-IMG-023`（现货后台配置申请完整表单）、`PRD-EMBED-009`（PR-01319 引用）、`PRD-EMBED-010`、`PRD-TABLE-008`。
2. **§8.3/8.4 删除线/高亮判读**：删「维持保证金率不计入总保证金」条、新增「不计入维持保证金能力」「结算按比例释放体验金回可用」——判为后端计算口径澄清，F06/F07/F08 前端展示口径不变。
3. **PM 群补充 F09 配资比例风险提示**：后台不强制拦截，选「不可抵扣类型」增强体验金时在配资比例字段下方展示红字静态文案，落 `03-api-contract.md §7` 文案契约 `copy.admin.rebateRatioRisk`。逐字冲突（PM 群「请谨慎配置比例」vs 截图 mockup「请合理配置比例」）已记 `06-collaboration.md §待确认`，当前以 PM「谨慎」为准，**实现前需 PM 二次确认字面**。
4. **G3**：`04-frontend-tasks.md` 补回模板保留的 T03 MSW fallback 行，原特性任务 T03..T14 顺延 T04..T15，`00-feature-inventory.md` 任务列引用同步。
5. **G4 复用盘点**：扫描编码 worktree 四个域，`02-technical-design.md` 复用盘点/单一事实源/数据流/映射/方案全部填实（见 §5）。

## 4. ⚠️ 两个必须处理的关键决策（我自主落定，用户可否决）

### 4.1 F07/F08 由「后端下发」修正为「前端本地计算 + 改公式剔除增强体验金」

G4 盘点确认：预估强平价 / 保证金率 / 维持保证金**现网是前端本地计算**，不是后端下发：
- 强平价：`apps/web/src/apps/Futures/utils/liq/liq.entry.ts`（`calcEstimatedLiqPriceOpen`）+ `liq.formulas.ts`（四套公式，分子含 `bonus`=体验金项）；hook `useEstimatedLiqPrice.ts` / `usePositionLiqPrice.ts`；组件 `OrderPanel/EstimatedLiqPrice.tsx`。
- 保证金率：`utils/marginRate.ts`（`calcCrossMarginRate` / `calcIsolatedMarginRate` / `getCrossMarginTrialBalances`——**已把 `enhancedTrialNum`(增强体验金) 单独拆出**）；组件 `FuturesAssetPanel/PositionInfo.tsx`（`calculatedMarginRate`、`keepMarginAmount` memo）、`CurrentPositions/components/PositionCell.tsx`。
- 后端 DTO 兜底字段：`CurrentPositions/store.ts` 的 `reducePrice` / `marginRate`（存在但面板优先用本地公式）。
- 无 `PR-01319` 字符串标记，预估强平价就是上述 `utils/liq/*` 模块。

**方案**：改 `liq.formulas.ts` 剔除增强体验金项、改 `marginRate.ts` 用 `getCrossMarginTrialBalances` 排除 `enhancedTrialNum`，纯函数单测锁定。此项使 F07/F08 从「纯展示对齐」扩为「改本地公式」，但被现有 `enhancedTrialNum` 拆分严格限定。**06-collaboration 原 G4 待核项已闭环**（下一步需把 06 那行标记为已确认——我尚未改 06，见 §6 TODO）。

### 4.2 仓库无 MSW → 登记豁免，改走 schema-first + Vitest 契约测试 + isMock

G4 盘点确认：fameex-web **完全无 MSW**（无 `msw` 依赖、无 `src/mocks/`、无 `browser.ts`/`useMockWorker`）。现网 mock=自研 per-query `isMock` 标志 + `/api/mock` 前缀（`apps/web/src/utils/api/index.ts` `getMockUrl`），且生成路径当前注释停用（无运行时效果）。测试用 **Vitest**（root `vitest.workspace.ts`），契约测试范式为 `schema.parse`/`safeParse` 单测（范例 `apps/web/src/services/api/marketing/contractCarnival/schemas.test.ts`）。

**方案**：不向成熟单仓强行引入 MSW。登记 `agent/rule-waivers.json` 豁免 MSW 强制项，采用仓库原生约定（schema/mapper 第一天按真实契约写 + Vitest 契约测试覆盖 normal/empty/error/unauthorized/edge + `/api/mock`+`isMock` 运行时 dev-only）。

**⚠️ 待办：豁免尚未写入**。`prds/PR-02273/agent/rule-waivers.json` 现为 `[]`。schema 见 `common/engine/schemas/rule-waivers.schema.json`：数组，每项需 `ruleId, reason, owner, expiresAt(YYYY-MM-DD)`，可选 `file`。**下一步需确认 MSW 强制项的确切 ruleId**（跑 G5 dry-run 看 verify-msw-manifest 报的 rule id，或查 `common/engine/agent-scripts/verify-msw-manifest.mjs` + `verify-project-gate.mjs` 的 DOC-G3-IMPL-*/CODE-MSW-* / DOC-G5-* checks），再据实登记。豁免过期时间设为「后端接口 ready」的估期。

> 交接时我正卡在这步：在 `verify-msw-manifest.mjs` / `lib/` 里找 MSW 强制项对应的 ruleId 以便登记豁免。`project-decision.mjs` 里出现过 `CODE-MSW-002`（MSW route B business mock residue）、`CODE-MOCK-002`（mock residue）——这些是 G5/G6 的实现残留检查，需甄别哪个是「强制用 MSW」而非「MSW 残留清理」。

## 5. 复用盘点索引（详见 `product/02-technical-design.md`，路径相对 worktree 根）

**C端 apps/web（体验金卡券）**
- 卡片：`apps/web/src/apps/MyRewards/components/RewardCard.tsx`（RewardCard；enums RewardStatus/CouponType；`getCouponTip`；`tipKeyMap` Record 范式）；页面 `MyRewards/index.tsx`（`convertPrizeToReward`）。
- 领取弹窗：`MyRewards/components/ActivateCouponModal.tsx` + `activateCouponModalConstants.ts`（`ACTIVATE_COUPON_CONDITION_LABEL_KEY` Record）。
- 详情弹窗：`apps/web/src/apps/Assets/components/BonusDetailMan/index.tsx` + `DetailTable.tsx` + `store.ts`(`useTrialFeeStore`)。
- 领取记录：`apps/web/src/apps/Orders/CouponRecord/TrialFeeClaimRecord/index.tsx` + `useTrialFeeClaimRecordColumns.tsx`。
- service/schema/mapper：`services/api/rewards.ts`（`usePrizeList`/`useTrialFeeClaimRecordList`；`prizeListItemSchema`/`PrizeListItem`：字段 trialMode/deductionRate/max·minMultiple/faceValue/trialFeeBalance；`trialFeeClaimRecordRowSchema`）、`services/api/trial-fee.ts`、`services/api/futures/trial-balance.ts`；mapper `MyRewards/formatRewardModalDetails.ts`（`formatExperienceFundDetailModal`/`formatLeverageRangeText`/`fmtDeductionRate`）。
- 领域常量：`apps/web/src/utils/trialBalanceCoupon.ts`（`TRIAL_RULE_TYPE.EnhancedTrial=3`、`CONTRACT_TRIAL_COUPON_TYPE=9`、`ENHANCED_CONTRACT_TRIAL_COUPON_TYPE=10`、`isEnhancedTrialBalanceRecord`）、`utils/formatUseRuleTypeLabel.ts`。
- i18n：namespace `rewards`，`apps/web/src/i18n/locales/*/rewards.json`（`activateCouponModal.detailDeductionRatio`="抵扣比例"、`couponTips.enhancedTrialBalance`、`couponTypes_10`="合约增强体验金"）。

**合约 apps/web/Futures（强平价/保证金率/可用余额）**——见 §4.1。可用余额：`Futures/utils/availableBalance.ts`（`getOrderAvailableBalance`、`TRIAL_BALANCE_DECIMALS=2`）、`hooks/useEffectiveTrialAmount.ts`、`OrderPanel/Available.tsx`；精度 `apps/web/src/utils/formatNumber.ts`。

**运营后台 apps/admin（卡券配置/记录）**
- 配置表单：`apps/admin/src/apps/TrialBalanceCreateOrder/components/SearchForm.tsx`（`CreateForm`；antd Form；`trialMode` 类型下拉 + `deductionRate` 抵扣比例 InputNumber addonAfter="%"；`buildTrialBalanceCreatePayload.ts`）。
- 记录页：`apps/admin/src/apps/CouponDistributionRecords/`（`useColumns`: usedAmount/remainingAmount/expiredAmount 到期未使用金额）、`CouponUsageRecords/`、`TrialFeeClaimLog/`。
- service/schema/mapper：`apps/admin/src/services/api/benifits.ts`（`searchCouponDistributionRecords`/`searchCouponUsageRecords`；`couponDistributionRecordItemSchema`/`couponUsageRecordItemSchema`；`recordsPageTransfer`/`build*SearchBody`）、`services/api/trialBalance.ts`（`useTrialFeeCreate`）。
- 常量：`apps/admin/src/constants/{trialBalance.ts(TrialMode,trialModeSelectOptions),couponTypeLabels.ts(ENHANCED_CONTRACT_TRIAL_COUPON_TYPE=7)}`；utils `utils/trialFeeActivation.ts`。
- 红字风险提示 UI：`text-red-500` span（admin 全仓约定）或 `components/InformationBlock.tsx`(`InformationBox type="error"`)。i18n namespace `trialBalance`（`i18n/locales/*/trialBalance.json`）。

**基建约定（G5 必守）**
- React Query：`utils/queryClient.ts` 单例；query key 用 `@lukemorales/query-key-factory` `createQueryKeys`（`services/queryKeys/<domain>.ts`）；hook 在 `services/hooks/<domain>.ts`；工厂 `utils/api/createQueryFactorySchema.ts`（`createHttpFn`）。
- Zod：`services/zod/*.zod.ts`（`XxxSchema` PascalCase）或域内 `services/api/<domain>/schemas.ts`（camelCase）；`z.infer` 导出类型；分页 `services/zod/base.zod.ts`（`PageResultSchema`/`createPageResultSchema`）。Zod v3。
- Mapper：域内 `mapXxx.ts` 纯函数（非 `*mapper*` 命名），无效行 `console.warn` 丢弃不抛。
- fetch client：`utils/patternFetch/`（`basicFetch`/`sfetch`→`parseBySchema`(schema.parse)）；URL builder `utils/api/index.ts`（`getUrl`/`getSpotUrl`/`getFuturesUrl`）。响应封套 `types/response.ts`：`s2cBasicSchema={status:{code,error,messages},data}`（注意是 `status.code`/`status.messages`，非顶层 code/msg），内部归一为 `FetchResponse<T>` 判别联合。错误码 `constants/code.ts`。
- 契约测试：Vitest，`<name>.test.ts` 就近放置，root `vitest.workspace.ts`（`include: apps/**/*.{test,spec}.{ts,js}`，alias `@ → apps/web/src`）。范例 `services/api/marketing/contractCarnival/schemas.test.ts`。
- Tailwind preset：`packages/config/tailwind-preset.js`（borderRadius: DEFAULT=4px/sm=6px/m=8px/lg=16px；spacing 4px 基，`2`=8px…注意 `35`=100px 例外；语义色 `text.*`/`sem.g/y/r`）。不写 `w-[400px]` 等 arbitrary class。

## 6. 下一步 TODO（按序）

1. **闭环 06-collaboration**：把 §待办 里「F07/F08 复核」行标记为「已确认：G4 盘点确认前端本地计算，方案=改本地公式剔除增强体验金」（`product/06-collaboration.md` line ~23）。
2. **登记 MSW 豁免**：确认 ruleId（见 §4.2），写入 `agent/rule-waivers.json`。
3. **同步 00-feature-inventory F07/F08 行**（可选但建议）：把「后端下发对齐展示」措辞改为「前端本地计算，改公式剔除增强体验金」，与 02 一致。
4. **跑 G4 gate** → PASS 后 commit + push docs_tdd 分支。
5. **进入 G5 编码**（在 worktree `apps/web`/`apps/admin` 内）：优先按 §5 就地改造 + 复用；schema/mapper 按真实契约先写 + Vitest 契约测试（normal/empty/error/unauthorized/edge）；F01 文案落 i18n；F07/F08 改公式 + 纯函数单测；F09 admin 加类型分支 + 配资比例风险提示。普通（按比例抵扣）版完全不动。跑到 G5 停，等真实 API。
6. 各 gate 前用 `docs-tdd.mjs changed PR-02273` 刷新，`gate PR-02273 Gx` 校验。

## 7. 未决 / 假设（不阻断，实现前处理）

- 风险提示逐字：PM「谨慎」vs 截图「合理」，以 PM 为准，实现前请 PM 二次确认（06 §待确认）。
- C端「使用规则展示 --」列名：PRD 写"使用规则"，img 列头为「可用杠杆范围」，以现网实际列名为准（G4/G5 现网核对）。
- A1–A4 假设见 `06-collaboration.md §假设`：F14 后端做；文案以 PRD 为准；存量兼容后端迁移前端只容忍；普通版不动。
