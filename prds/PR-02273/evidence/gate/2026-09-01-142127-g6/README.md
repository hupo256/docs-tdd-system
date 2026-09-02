# Gate Evidence — PR-02273 G6-partial

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02273 |
| 阶段 | G6-partial |
| 日期 | 2026-09-01 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=98, fail=6, warn=4, waived=0 |
| 分组 | documentation=78/84, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | FAIL（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02273 G6 --partial` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-02273` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02273` | biome / tsc / vitest 实跑 | FAIL | exit=1 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-006 | error | G3 frontend tasks include the MSW fallback task | ../docs_tdd/prds/PR-02273/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| DOC-CONFIRM-001 | warn | G5=frontend-complete-pending-reconcile 断言了人工确认，但缺 confirmedBy（人工确认签名）——README 人机分界要求 G5 以人工确认为锚点 | ../docs_tdd/prds/PR-02273/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/apps/Assets/components/BonusDetailMan/DetailTable.tsx<br>apps/web/src/apps/Assets/components/BonusDetailMan/enhancedTrialCopy.test.ts<br>apps/web/src/apps/Assets/components/BonusDetailMan/index.tsx<br>apps/web/src/apps/Assets/utils/pendingActivationTrialBonus.test.ts<br>apps/web/src/apps/Assets/utils/pendingActivationTrialBonus.ts<br>apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx<br>apps/web/src/apps/CashFlow/futures/futuresCashFlowEnum.contract.test.ts<br>apps/web/src/apps/Futures/components/FuturesAssetPanel/Assets.tsx<br>apps/web/src/apps/Futures/components/FuturesOrders/FundsFlow/components/TransactionFilter.tsx<br>apps/web/src/apps/Futures/hooks/useEffectiveTrialAmount.ts<br>apps/web/src/apps/Futures/hooks/useEstimatedLiqPrice.ts<br>apps/web/src/apps/Futures/hooks/usePositionLiqPrice.ts<br>apps/web/src/apps/Futures/utils/liq/liq.formulas.test.ts<br>apps/web/src/apps/Futures/utils/marginRate.test.ts<br>apps/web/src/apps/Futures/utils/marginRate.ts<br>apps/web/src/apps/MyRewards/components/InflationRecordMobileList.tsx<br>apps/web/src/apps/MyRewards/components/RewardCard.tsx<br>apps/web/src/apps/MyRewards/components/TrialFeeActivateModal.tsx<br>apps/web/src/apps/MyRewards/components/activateCouponModalParts.tsx<br>apps/web/src/apps/MyRewards/components/rewardCardCopy.test.ts<br>apps/web/src/apps/MyRewards/components/rewardCardCopy.ts<br>apps/web/src/apps/MyRewards/components/rewardCardModel.ts<br>apps/web/src/apps/MyRewards/components/useActivateCouponModal.ts<br>apps/web/src/apps/MyRewards/enhancedTrialTip.copy.test.ts<br>apps/web/src/apps/Orders/CouponRecord/couponRecordEnum.contract.test.ts<br>apps/web/src/services/api/futures/position-assets-list.test.ts<br>apps/web/src/services/api/rewards.ts | ../docs_tdd/prds/PR-02273 | 待处理 / 已豁免 / 不适用 |
| DOC-CR-001 | error | code-review.json 结构非法：CR-3 category 须是 correctness/reuse/simplification/efficiency/security/test-coverage/other | ../docs_tdd/prds/PR-02273/agent/code-review.json | 待处理 / 已豁免 / 不适用 |
| DOC-CONFIRM-004 | warn | code-review 结论无人工签收：缺 confirmedBy（人工确认签名）（reviewer=Codex 只记录谁做的 review，不等于人认了结论） | ../docs_tdd/prds/PR-02273/agent/code-review.json | 待处理 / 已豁免 / 不适用 |
| DOC-AC-007 | warn | G6-partial：5 条验收待真实字段对账（AC-7/contract, AC-9/contract, AC-12/contract, AC-13/contract, AC-15/browser），字段到位后须重跑完整 G6 | ../docs_tdd/prds/PR-02273/agent/acceptance-results.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-001 | error | apps/admin 本次改动文件存在 6 处类型错误：apps/admin/src/components/SearchForm/index.tsx:61 TS2769; apps/admin/src/components/SearchForm/index.tsx:62 TS2769; apps/admin/src/components/SearchForm/index.tsx:375 TS2345; apps/admin/src/components/SearchForm/index.tsx:377 TS2322; apps/admin/src/components/SearchForm/index.tsx:380 TS2345 … | apps/admin/src/components/SearchForm/index.tsx | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-001 | error | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx:213 TS2322 | apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-001 | error | vitest 未通过（vitest 退出码非 0）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02273/2026-09-01T14-21-24-153Z-vitest-related.log |  | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-002 | error | 以下逻辑文件导出了函数但无同名/同目录 __tests__ 单测：apps/admin/src/apps/FinanceAuditAssetsFlow/utils/useBusinessTypes.ts, apps/admin/src/apps/TrialBalanceManualInvalidate/utils/useItems.ts, apps/admin/src/utils/patternFetch/basicTransform.ts | apps/admin/src/apps/FinanceAuditAssetsFlow/utils/useBusinessTypes.ts | 待处理 / 已豁免 / 不适用 |

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
| DOC-CR-001 | 阻塞 G6-partial | 待定 | code-review.json 结构非法：CR-3 category 须是 correctness/reuse/simplification/efficiency/security/test-coverage/other | OPEN |
| VERIFY-TYPE-001 | 阻塞 G6-partial | 待定 | apps/admin 本次改动文件存在 6 处类型错误：apps/admin/src/components/SearchForm/index.tsx:61 TS2769; apps/admin/src/components/SearchForm/index.tsx:62 TS2769; apps/admin/src/components/SearchForm/index.tsx:375 TS2345; apps/admin/src/components/SearchForm/index.tsx:377 TS2322; apps/admin/src/components/SearchForm/index.tsx:380 TS2345 … | OPEN |
| VERIFY-TYPE-001 | 阻塞 G6-partial | 待定 | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx:213 TS2322 | OPEN |
| VERIFY-TEST-001 | 阻塞 G6-partial | 待定 | vitest 未通过（vitest 退出码非 0）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02273/2026-09-01T14-21-24-153Z-vitest-related.log | OPEN |
| VERIFY-TEST-002 | 阻塞 G6-partial | 待定 | 以下逻辑文件导出了函数但无同名/同目录 __tests__ 单测：apps/admin/src/apps/FinanceAuditAssetsFlow/utils/useBusinessTypes.ts, apps/admin/src/apps/TrialBalanceManualInvalidate/utils/useItems.ts, apps/admin/src/utils/patternFetch/basicTransform.ts | OPEN |
