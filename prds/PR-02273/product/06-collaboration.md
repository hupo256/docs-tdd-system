<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# Collaboration — PR-02273 增强体验金改为保证金模式

## G2 决策（2026-08-11 用户确认）

| 时间 | 问题 | 结论 | 状态 |
|------|------|------|------|
| 2026-08-11 | 前后端边界 | 前端本仓只做展示层 F01–F13；F14 计算引擎归后端+大数据组 | ✅ 已确认 |
| 2026-08-11 | 运营后台归属仓 | `apps/admin`（现货管理后台） | ✅ 已确认 |
| 2026-08-11 | 无 Figma 视觉验收 | 按 PRD 文字规则实现（standard），截图仅示意 | ✅ 已确认 |
| 2026-08-11 | API 契约 | 暂无 YApi，走 MSW 路线 B（G3 落 handler+契约测试+dev-only worker） | ✅ 已确认 |
| 2026-08-11 | F07/F08 强平价/保证金率计算位置 | **G4 盘点回炉修正**：现网预估强平价/保证金率是**前端本地计算**（`utils/liq/*`、`utils/marginRate.ts`），非后端下发。方案=改本地公式剔除增强体验金项（`liq.formulas.ts` 剔 `bonus` 增强项、`marginRate.ts` 用 `getCrossMarginTrialBalances` 排除 `enhancedTrialNum`），纯函数单测锁定 | ✅ 已确认（G4 盘点定稿，改本地公式，非纯展示对齐） |
| 2026-08-11 | 帮助中心 F12 | 延期/非前端代码，运营 CMS 维护 | ✅ 已确认 |
| 2026-08-13 | **PRD revision 2 增量**（§8.3/8.4 删除线+高亮） | 删「维持保证金率不计入总保证金」条、新增「不计入维持保证金能力」「结算按比例释放体验金回可用」；判读为后端计算口径澄清，F06/F07/F08 前端展示口径不变 | ✅ 已确认（文档口径对齐，不改前端算法） |
| 2026-08-13 | **PM 群补充**：F09 配资比例风险提示 | 后台不强制拦截，选不可抵扣类型增强体验金时配资比例字段下方展示红字静态文案，纳入 F09/T09 + 03-api-contract §7 `copy.admin.rebateRatioRisk` | ✅ 已确认（新增前端展示项） |

## 待办 / 待确认（不阻断 G2，G4 前处理，含 PR-01319/列名差异复核）

| 时间 | 问题 | 影响 | 责任人 | 状态 |
|------|------|------|--------|------|
| 2026-08-11 | **F07/F08 复核**：核对 PR-01319 现网预估强平价是否前端本地计算；若是，则「后端下发」结论需回炉重定 | F07/F08 实现方式 | Agent（G4 盘点）→负责人 | ✅ 已闭环：G4 盘点确认前端本地计算（无 PR-01319 标记，即 `utils/liq/*`+`marginRate.ts`），方案改为改本地公式剔除增强体验金，见上表 F07/F08 行 |
| 2026-08-11 | **C 端「使用规则展示 --」列位**：PRD 文字写"使用规则"，img-004 列头为「可用杠杆范围」显示 --，以现网实际列名为准 | F05 字段定位 | Agent（G4 盘点） | ✅ 已闭环：G5 核对现网无「使用规则」列，PRD 对应现网 `leverageRange`「可用杠杆范围」列；该列已对增强体验金（`trialMode≠'1'`）展示 `--`（useTrialFeeClaimRecordColumns.tsx），F05 无需改代码 |
| 2026-08-11 | **API 字段/枚举清单**：可用体验金/使用中体验金/配资比例/状态枚举/到期未使用金额，MSW mock 需先定契约 | G3 | 后端/负责人 | 待 G3 |
| 2026-08-13 | **风险提示文案逐字冲突**：PM 群消息作「请**谨慎**配置比例」，截图 mockup 作「请**合理**配置比例」。当前以 PM 群消息为准（谨慎）落 `copy.admin.rebateRatioRisk`；实现前请 PM 二次确认字面 | F09 文案 | PM Iris | 待 PM 确认 |
| 2026-08-14 | **F02/F03 需先拆分超长组件**：F02 卡片去「已使用完」状态在 `RewardCard.tsx`（441 行）、F03「抵扣比例→配资比例 label + 隐藏使用方式行」在 `ActivateCouponModal.tsx`（441 行），二者均 >300 行触发 PostToolUse `CODE-FILE-001`。按 change-scope §2.1 不在本特性顺手重构；需独立拆分子组件后再落这两处。F03 提示说明文案已单独落地（改 rewards.json，无需动组件） | F02 状态收敛 / F03 label 与使用方式 | 前端 | ✅ 已完成：按可复用重构拆分——ActivateCouponModal→useActivateCouponModal(hook)+activateCouponModalParts(展示/纯函数)+瘦视图，落 F03 配资比例/隐藏使用方式；RewardCard→rewardCardModel+rewardCardCopy(纯函数)+瘦身，落 F02 增强 Used→已失效。均配纯函数单测，逻辑等价迁移 |
| 2026-08-13 | **F07 强平价 bonus 剔除增强体验金的口径**：G5 编码确认——F08 保证金率已剔除增强体验金（`calcCrossMarginRate` 移除 `.plus(enhancedTrialNum)`，数据源 `trialFeeRecordList` 已拆分，纯函数单测锁定）。但 F07 强平价 `bonus` 现取 `useEffectiveTrialAmount().availableTrialBalance`（普通+增强合并，「已抵扣仓位占用」净值）。剔除增强需改 hook 传入普通值，候选=后端 `normalTrialBalance` 或 `availableTrialBalance - enhancedTrialBalance`；但 `normalTrialBalance`/`enhancedTrialBalance` 是否与 `availableTrialBalance` 同为「已抵扣占用」净口径未确认。**按 change-scope §2.1「改既有实盘计算不能自证无回归即阻塞」，本期不落 hook bonus 来源改动**，仅落基础无关的 liq.formulas 纯函数单测；待后端确认字段口径后一并对账 | F07 强平价 hook（useEstimatedLiqPrice/usePositionLiqPrice）bonus 来源 | 合约后端 / 负责人 | 待后端确认字段口径 |

## 假设（未确认前不写业务代码）

- A1：F14（结算/状态机/回收/强平计算/存量迁移）由后端+大数据组实现，前端本仓不做，仅对接字段与状态展示。
- A2：卡片/领取弹窗/详情弹窗文案以 PRD 文字规则为准，截图仅示意（截图仍含旧文案）。
- A3：存量兼容（`PRD-EMBED-006`）为后端迁移口径，前端仅需容忍存量状态与「已使用完」旧状态展示，不新增前端迁移逻辑。
- A4：普通（按比例抵扣）合约体验金的卡片/详情/结算逻辑本期完全不动，仅「增强体验金」专版改造。

## 参考文档（非本仓消费）

- `PRD-EMBED-001` 业务-数据组上下游对照表（doc-id H9WsdHvwZoLWc0xVEg1lK0w7gsf）— 后端数据组。
- `PRD-EMBED-002` PR-01268 手机/邮箱脱敏（doc-id RpDxdh53HoacPrxjj9wlXa2ag5f）— 关联需求，福利中心统计脱敏。
- `PRD-EMBED-009` PR-01319 合约开仓页预估强平价（wiki QadTw1Kj0iMwcwkiKiIlOFCfgxg）— F07 前端复用来源。

## Code Review

| 时间 | 命令 | findings | 处理结论 | 证据 |
|------|------|----------|----------|------|
| 待 G6 | `/code-review` | 待执行 | 待处理 | evidence/.../README.md |

## 验证证据索引

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| 待执行 | Biome / verify-code-rules / Browser | 待记录 | 不接受仅写“已通过” |
