# Gate Evidence — PR-02273 G6-partial

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02273 |
| 阶段 | G6-partial |
| 日期 | 2026-09-01 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=100, fail=1, warn=4, waived=0 |
| 分组 | documentation=81/86, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | PASS（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02273 G6 --partial` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-02273` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02273` | biome / tsc / vitest 实跑 | PASS | exit=0 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-006 | error | G3 frontend tasks include the MSW fallback task | ../docs_tdd/prds/PR-02273/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| DOC-CONFIRM-001 | warn | G5=frontend-complete-pending-reconcile 断言了人工确认，但缺 confirmedBy（人工确认签名）——README 人机分界要求 G5 以人工确认为锚点 | ../docs_tdd/prds/PR-02273/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/apps/Assets/components/BonusDetailMan/DetailTable.tsx<br>apps/web/src/apps/Assets/components/BonusDetailMan/enhancedTrialCopy.test.ts<br>apps/web/src/apps/Assets/components/BonusDetailMan/index.tsx<br>apps/web/src/apps/Assets/utils/pendingActivationTrialBonus.test.ts<br>apps/web/src/apps/Assets/utils/pendingActivationTrialBonus.ts<br>apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx<br>apps/web/src/apps/CashFlow/futures/futuresCashFlowEnum.contract.test.ts<br>apps/web/src/apps/Futures/components/FuturesAssetPanel/Assets.tsx<br>apps/web/src/apps/Futures/components/FuturesOrders/FundsFlow/components/TransactionFilter.tsx<br>apps/web/src/apps/Futures/hooks/useEffectiveTrialAmount.ts<br>apps/web/src/apps/Futures/hooks/useEstimatedLiqPrice.ts<br>apps/web/src/apps/Futures/hooks/usePositionLiqPrice.ts<br>apps/web/src/apps/Futures/utils/liq/liq.formulas.test.ts<br>apps/web/src/apps/Futures/utils/marginRate.test.ts<br>apps/web/src/apps/Futures/utils/marginRate.ts<br>apps/web/src/apps/MyRewards/components/InflationRecordMobileList.tsx<br>apps/web/src/apps/MyRewards/components/RewardCard.tsx<br>apps/web/src/apps/MyRewards/components/TrialFeeActivateModal.tsx<br>apps/web/src/apps/MyRewards/components/activateCouponModalParts.tsx<br>apps/web/src/apps/MyRewards/components/rewardCardCopy.test.ts<br>apps/web/src/apps/MyRewards/components/rewardCardCopy.ts<br>apps/web/src/apps/MyRewards/components/rewardCardModel.ts<br>apps/web/src/apps/MyRewards/components/useActivateCouponModal.ts<br>apps/web/src/apps/MyRewards/enhancedTrialTip.copy.test.ts<br>apps/web/src/apps/Orders/CouponRecord/couponRecordEnum.contract.test.ts<br>apps/web/src/services/api/futures/position-assets-list.test.ts<br>apps/web/src/services/api/rewards.ts | ../docs_tdd/prds/PR-02273 | 待处理 / 已豁免 / 不适用 |
| DOC-CONFIRM-004 | warn | code-review 结论无人工签收：缺 confirmedBy（人工确认签名）（reviewer=Codex 只记录谁做的 review，不等于人认了结论） | ../docs_tdd/prds/PR-02273/agent/code-review.json | 待处理 / 已豁免 / 不适用 |
| DOC-AC-007 | warn | G6-partial：5 条验收待真实字段对账（AC-7/contract, AC-9/contract, AC-12/contract, AC-13/contract, AC-15/browser），字段到位后须重跑完整 G6 | ../docs_tdd/prds/PR-02273/agent/acceptance-results.json | 待处理 / 已豁免 / 不适用 |

## Browser / UI Evidence

| 页面 / 场景 | URL | 视口 / 主题 | 操作步骤 | 结果 |
|-------------|-----|-------------|----------|------|
| 本脚本不执行浏览器自测 | 待人工补充 | 待人工补充 | 待人工补充 | 未覆盖 |

## Code Review Evidence

| 时间 | 命令 | findings | 处理结论 | 备注 |
|------|------|----------|----------|------|
| 待补充 | /code-review | 待补充 | 已修 / 豁免 / 不适用 | 同步到 `product/06-collaboration.md` |

## Blockers / Risks

| 项 | 影响 | 责任人 | 下一步 | 状态 |
|----|------|--------|--------|------|
| DOC-G3-006 | 阻塞 G6-partial | 待定 | G3 frontend tasks include the MSW fallback task | OPEN |
