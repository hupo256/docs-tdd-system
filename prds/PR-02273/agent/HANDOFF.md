# PR-02273 交接文档（Handoff）— 增强体验金改为保证金模式

> 更新时间：2026-08-22。给「在编码 worktree 里继续的下一个 chat」。
> 编码 worktree：`/Users/aven/github/PR-02273`（fameex-web，分支 `feature/PR-02273` ← `origin/online`）。
> docs_tdd 事实源：`/Users/aven/github/docs_tdd`（worktree 内经 `apps/web/docs_tdd/` 符号链接可达），文档分支 `pr-02273/kickoff-g0-g2`。
> 前序历史（G0–G4 kickoff）见本文件 git 历史；本版反映 G5 编码进展。

---

## 0. 一句话现状

G0–G4 PASS。**G5 编码进行中，纯前端能落的需求已全部落码 + 纯函数单测 + 提交推送**；剩余项为后端字段口径/枚举/PM 文案依赖，已逐条登记，等真实 API 与 PRD 稳定后对账补齐。

- 代码分支 `feature/PR-02273` 最新提交 `fbc19d00cd`（已推 origin）。
- 文档分支 `pr-02273/kickoff-g0-g2` 最新提交 `70d6ac7`（已推 origin）。

## 1. 用户执行授权（务必遵守）

- 全权自主，权限提示默认 YES，不停下来问。
- **把已 intake 进来的需求都做好**；PRD 可能还会更新，**等它稳定再重新 intake**，当前不重新 lark-sync（避免拉入未定稿改动、改变范围）。
- **重构是为后期扩展/复用服务**：遇到 >300 行组件挡路，正解是按分层拆分（hook + 展示子组件 + 纯函数 + 领域模型），而非绕过——本轮 F02/F03 即如此做（见 §4）。
- 对用户中文回复；代码/标识符/命令/路径英文。不伪造 mapper/数据。逐字文案从 PRD copy-paste，配「值===原文」断言。
- 提交信息结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。节奏：每落一个功能 add-commit-push（code 与 docs 两仓分别提交）。

## 2. 功能交付状态总表（逐条对照 04-frontend-tasks.md）

| F | 说明 | 状态 | 落点 / commit |
|---|------|------|--------------|
| F01 | 增强体验金保证金模式文案 | ✅ | `bonus:enhanced-margin-tip`、`rewards:activateCouponModal.enhancedTrialTip`（逐字断言） |
| F02 | 卡片去「已使用完」状态 | ✅ | `fbc19d00cd`：RewardCard 拆分，增强 Used→已失效 |
| F03 | 领取弹窗 配资比例 + 隐藏使用方式 + 提示文案 | ✅ | `b3f02c03d0`+`0eb8c6c37c`：ActivateCouponModal 拆分 |
| F04 | 详情弹窗增强专版 | ✅ | `fc784fc74c`：BonusDetailMan 分支改造 |
| F05 | 领取记录使用规则列 -- | ✅ 核实无需改 | 现网 `leverageRange`「可用杠杆范围」列已对增强(trialMode≠'1')显示 `--` |
| F06 | 金额口径（可用=总额-使用中） | ⏳ 待后端对账 | 金额为后端字段；依赖后端「委托冻结/开仓占用」口径 |
| F07 | 开仓预估强平价剔除增强 | 🚧 阻塞待后端 | 见 §3.1（bonus 口径未确认，change-scope §2.1 阻塞） |
| F08 | 保证金率剔除增强 | ✅ | `286fcedad8`：marginRate 移除 `.plus(enhancedTrialNum)` |
| F09 | admin 配资比例风险提示 | 🟡 部分 | `286fcedad8`：文案+条件红字 UI；⏳枚举 ASSUMED=3、文案待后端/PM |
| F10 | admin 到期未使用金额口径 | ✅ 核实无需改 | `expiredAmount` 后端字段直显，口径改在后端 |
| F11 | admin 增强无使用记录 | ⏳ 待后端对账 | 后端过滤口径 |
| F13 | 存量兼容 | ⏳ 待后端 | 后端停增量不动存量，前端容忍旧态 |
| F14 | 后端引擎 | 不做 | 本仓外 |

## 3. 剩余项如何继续（真实 API/PRD 稳定后）

### 3.1 F07 开仓预估强平价 bonus 剔除增强体验金（阻塞）
- 现状：liq 公式的 `bonus` = `useEffectiveTrialAmount().availableTrialBalance`（普通+增强**合并**、「已抵扣仓位占用」净值）。链路见 `useEstimatedLiqPrice.ts:335,373` / `usePositionLiqPrice.ts:83,110` → `liq.entry.ts:160,177` → `liq.formulas.ts:182,308`。
- 待确认：后端 `normalTrialBalance` / `enhancedTrialBalance`（`position-assets-list.ts:172,174`）与 `availableTrialBalance` 是否**同为「已抵扣占用」净口径**。
- 落法（确认后）：让 hook 传给 liq 的 `bonus` 用普通值（`normalTrialBalance` 或 `availableTrialBalance - enhancedTrialBalance`）。`liq.formulas.test.ts` 已证 bonus 线性进入分子，改 hook 即可。
- **为什么本期不落**：改既有实盘强平价计算，口径未确认不能自证无回归（change-scope §2.1）。见 `06-collaboration.md §待办`。

### 3.2 F06 金额口径 / F11 使用记录 / F13 存量兼容
- 均为后端字段/口径驱动。真实接口到位后：对账 `03-api-contract §5` 字段表；确认 `availableBalance.ts` 的 trial 口径（可用=总额-使用中）与后端字段一致；`CouponUsageRecords` 增强是否后端过滤为空。

#### 3.2.1 PRD 删除线口径细则（2026-08-22 用户确认，F10/F11 卡券记录）
> **解读规则（用户强调，勿死板）**：整行删除线=该条不做/删除；**公式内某一项加删除线=公式逻辑更新（去掉该项），非整行废弃**。
- **卡券领取记录（F10）** 增强体验金三项口径：
  1. 已使用金额 = **0**（未产生实际消耗）——旧「实时委托冻结/仓位占用，随撤单/开仓/平仓实时变化」整条定义删除。
  2. 剩余金额 **口径删除**——不再展示「总-已使用金额」。
  3. 到期未使用金额 = **体验金总额**——公式内「- 历史最大的开仓占用金额」单项删除线，公式更新为「=体验金总额」（不再减），非整行删除。
- **卡券使用记录（F11）**：增强体验金**无使用记录**——旧「金额=卡券有效期内历史最大仓位占用金额」整条定义删除。
- **前端影响**：三项均后端字段直显/后端过滤口径，**前端无代码改动**（`expiredAmount` 等直显后端值；不得按反造假规则硬编码 0/总额）。已核实 F10 `CouponDistributionRecords` 直显、F11 由后端返回空。此为后端口径简化，前端只需口径确认。

### 3.3 F09 admin「不可抵扣类型」枚举 + 文案
- `SearchForm.tsx` 已有 `ENHANCED_NON_DEDUCTIBLE_TRIAL_MODE = 3`（`// ASSUMED:`），**未纳入 `trialModeSelectOptions`**（不可选/不可提交）。后端确认真实枚举值后：改常量、纳入选项、销 ASSUMED。
- 文案「谨慎 vs 合理」：已落 `rebateRatioRisk`=「请谨慎配置比例」并经 PM 2026-08-22 二次确认，**已销**。

## 4. 本轮重构结构（为后期扩展/复用，续作请沿用分层）

**领取弹窗 ActivateCouponModal**（原 441 行 → 拆 3 文件）：
- `useActivateCouponModal.ts`：数据/mutation/主按钮态/埋点 hook（组件不再直连 `@/services/api`，符合 architecture-and-state §1 分层）。
- `activateCouponModalParts.tsx`：`ActivateCouponConditionList` / `ActivateCouponDetailRows` 展示子组件 + `resolveActivatePrimary` 纯函数 + `activateConditionLabel` + `ActivateCouponModalProps` 类型。
- `ActivateCouponModal.tsx`：纯视图（~110 行）。

**卡片 RewardCard**（原 448 行 → 拆 3 文件，252 行）：
- `rewardCardModel.ts`：`RewardStatus`/`CouponType`/`RewardUsage` 枚举 + `RewardItem` 类型（独立领域模型，防循环依赖）。
- `rewardCardCopy.ts`：`getCouponTip`（说明文案）+ `resolveRewardButtonText`（主按钮态，F02 在此）纯函数。
- `RewardCard.tsx`：瘦身 + `export { … } from './rewardCardModel'` re-export 保持既有 importer 兼容。

> 续作提示：详情弹窗 `BonusDetailMan/DetailTable.tsx`、admin `SearchForm.tsx` 也用 `isEnhancedTrialBalanceRecord`(`utils/trialBalanceCoupon.ts`) 分支。新增增强分支时优先复用该判定 + 上述纯函数/子组件，勿在 JSX 堆 if。

## 5. 关键架构事实（省得重新盘点）

- **增强体验金判定**：`utils/trialBalanceCoupon.ts` `isEnhancedTrialBalanceRecord`（依次看 trialRuleType / isTrialFee / trialMode / couponType）；常量 `TRIAL_RULE_TYPE.EnhancedTrial=3`、`ENHANCED_CONTRACT_TRIAL_COUPON_TYPE=10`。
- **保证金率（F08）**：`marginRate.ts` `getCrossMarginTrialBalances` 从 `trialFeeRecordList`(useRuleType===3) 拆 `{trialNum, enhancedTrialNum}`；`calcCrossMarginRate` 已**不**加 enhancedTrialNum（保留入参供对账/测试）。
- **后端账户 schema**：`services/api/futures/position-assets-list.ts` `futuresAccountSchema` 有 `availableTrialBalance`(净)/`normalTrialBalance`/`enhancedTrialBalance` 三字段（F06/F07 对账用）。
- **i18n**：C 端卡片/领取弹窗 = `rewards` ns；详情弹窗 = `bonus` ns；admin = `trialBalance` ns。只改 zh-CN。
- **MSW 豁免**：仓库无 MSW，`agent/rule-waivers.json` 登记 `CODE-MSW-004`；契约测试范式 = `schema.parse` + copy 逐字断言（就近 `*.test.ts`）。

## 6. 单测清单（vitest，改动文件全绿）

- `Futures/utils/marginRate.test.ts`（8）、`Futures/utils/liq/liq.formulas.test.ts`（10）
- `Assets/components/BonusDetailMan/enhancedTrialCopy.test.ts`（5）
- `MyRewards/enhancedTrialTip.copy.test.ts`（2）、`MyRewards/components/rewardCardCopy.test.ts`（4）
- `admin/.../TrialBalanceCreateOrder/rebateRatioRisk.copy.test.ts`（1）
- 跑：`pnpm exec vitest run <path>`。typecheck：`cd apps/web && pnpm exec tsc --noEmit`（基线既存报错：`MyRewards/index.tsx:42`、admin `buildTrialBalanceCreatePayload.test.ts` string/number——**非本 PR 引入**，验收只看改动文件）。

## 7. docs_tdd gate / session 命令与坑

在 docs_tdd 根跑；**统一用 `export DOCS_TDD_AGENT_CLIENT=claude`** 避免 client 不一致：
```
export DOCS_TDD_AGENT_CLIENT=claude
node common/engine/agent-scripts/docs-tdd.mjs context PR-02273 g4_coding_worktree   # 建编码 session（headSha/指纹变化后需重建）
node common/engine/agent-scripts/docs-tdd.mjs gate PR-02273 G5
node common/engine/agent-scripts/docs-tdd.mjs changed PR-02273
```
- **引擎回归已修**：`run-project-gate.mjs` 曾漏传 client 致 G5+ gate 恒报 `client changed`，已修（传 `resolveRuleSessionClient()`）+ 重发 rule-release/effective-rules（golden PASS）。
- **改引擎/规则面后必重发**：`rule-release.mjs --write` 与 `effective-rules.mjs --doctor && --write`，否则 gate 拦 stale。
- **PostToolUse gate `CODE-FILE-001`**：.tsx >300 行且被编辑即拦——按 §4 拆分而非绕过。`CODE-ARCH-003`：组件别直连 `@/services/api`，抽 hook。
- **DOC-PRD-010 远端 PRD 漂移**（同 revision 内容变）曾拦 G5；远端已有修复提交 `15f6b56 fix(lark-bot: 自带规格的改动越过 requirement 误判)`。若再遇：PRD 稳定后重跑 lark-sync + intake，核对是否影响已实现项。

## 8. 下一步 TODO（按序）

1. 等 PRD 稳定 → 若有更新，重跑 lark-sync + intake，diff 核对 F01–F13 是否受影响。
2. 后端接口/字段/枚举 ready 后：F07（bonus 口径）、F06（金额口径）、F09（枚举）、F11、F13 逐条对账落码 + 补单测；销 `06 §待办` 与 `04` 里的 ⏳/🚧 项。
3. ~~F09 文案「谨慎/合理」找 PM Iris 二次确认。~~ ✅ 已确认（2026-08-22）以「请谨慎配置比例」为准，已销。
4. G5 stage-status 具备条件后由 `pending` → `frontend-complete-pending-reconcile`（前端完成待对账，见 stage-status.schema），最终 `completed`。
5. G6：`/code-review` + 机器验收（verify-build-quality 真跑 biome/tsc/vitest）+ 人工 UI 走查（普通体验金回归 + 增强专版）。
