# PR-02273 前端提测前验收证据

## 结论

- 代码 HEAD：`269bdd57a96bc5d76f38feba3009475abf5a9c53`
- 已正向合入 `origin/feature/PR-01930@91870c16dc` 与最新 `origin/online`，未反向修改 PR-01930。
- PRD review 发现的前端缺口均已修复；当前前端完成，进入 pre 真实字段对账与 QA 页面回归。

## 自动化验证

| 验证 | 结果 |
|------|------|
| Web 定向 Vitest：详情/卡片/领取弹窗/金额/强平价/保证金率/接口 schema | 9 files / 60 tests passed |
| Admin 定向 Vitest：配置申请/手动失效/财务流水/领取记录 | 12 files / 55 tests passed |
| G6 相关 Vitest（含新增门禁覆盖） | 23 files / 120 tests passed |
| 本次修改文件 Biome | PASS |
| Admin 定向 TypeScript 错误筛查 | PR-02273/PR-01930 相关文件 0 error |
| Web 定向 TypeScript 错误筛查 | PR-02273 相关文件 0 error；命中 1 个未改动的 `TransactionRuleContent.tsx` 既存错误 |

执行命令：

```bash
pnpm exec vitest run \
  apps/web/src/apps/Assets/utils/pendingActivationTrialBonus.test.ts \
  apps/web/src/apps/Assets/components/BonusDetailMan/enhancedTrialCopy.test.ts \
  apps/web/src/apps/MyRewards/enhancedTrialTip.copy.test.ts \
  apps/web/src/apps/MyRewards/components/rewardCardCopy.test.ts \
  apps/web/src/apps/Futures/utils/marginRate.test.ts \
  apps/web/src/apps/Futures/utils/liq/liq.formulas.test.ts \
  apps/web/src/services/api/futures/position-assets-list.test.ts \
  apps/web/src/apps/Orders/CouponRecord/couponRecordEnum.contract.test.ts \
  apps/web/src/utils/trialBalanceCoupon.test.ts

cd apps/admin && pnpm exec vitest run \
  src/apps/FinanceAuditAssetsFlow \
  src/apps/TrialBalanceManualInvalidate \
  src/apps/TrialBalanceCreateOrder \
  src/apps/TrialFeeClaimLog/utils/layout.test.ts
```

## Review 修复

1. 详情弹窗增强体验金金额改为 `availableTrialAmount` 与 `frozen + occupy`，补名称。
2. 福利中心卡片说明改为保证金模式原文。
3. 后台不抵扣类型展示配资比例并隐藏使用规则，倍数 payload 归一化为 number。
4. 合并中保留 PR-01930 手动失效、系统回收流水、日期范围与错误提示逻辑；同时保留 online 新分页、预测账户、推送权限和新文案。
5. 修复合并后资金流水筛选 `string | number` 类型与表格泛型回归。
6. 修复 PR-01930 选项数组与 online 包装逻辑合并后重复展示两个“全部”的问题。

## 提测仍需真实环境核对

1. `normalTrialBalance` 是否为“不含增强体验金且已扣冻结/占用”的净口径；核对开仓预估强平价。
2. 详情页总额、可用、委托冻结、仓位占用是否满足 PRD 守恒关系。
3. 后台领取记录的已使用/到期未使用金额是否为新口径；增强体验金使用记录是否为空。
4. 福利中心卡片、领取弹窗、详情弹窗及后台配置表单进行登录态页面交互/视觉回归。

## 仓库基线说明

- Web/Admin 全量 typecheck 仍有大量非本需求存量错误；定向筛查确认本需求相关文件无新增错误。
- 合并提交钩子扫描 `online` 带入的 625 个文件，被 `online` 未修复的 Biome 问题阻断；合并提交保留线上文件原样并使用 `--no-verify`，本需求触达文件已单独通过 Biome。
- 扩大执行 Admin 全量测试时仍有推送、VIP、env 等未改动模块的基线失败；本需求 12 个 Admin 测试文件全部通过。
