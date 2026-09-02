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
| 2026-08-13 | **风险提示文案逐字冲突**：PM 群消息作「请**谨慎**配置比例」，截图 mockup 作「请**合理**配置比例」。当前以 PM 群消息为准（谨慎）落 `copy.admin.rebateRatioRisk`；实现前请 PM 二次确认字面 | F09 文案 | PM Iris | ✅ 已闭环：PM Iris 2026-08-22 正式确认以「请谨慎配置比例」为准，截图「合理」作废；`rebateRatioRisk` 逐字断言已锁 |
| 2026-08-14 | **F02/F03 需先拆分超长组件**：F02 卡片去「已使用完」状态在 `RewardCard.tsx`（441 行）、F03「抵扣比例→配资比例 label + 隐藏使用方式行」在 `ActivateCouponModal.tsx`（441 行），二者均 >300 行触发 PostToolUse `CODE-FILE-001`。按 change-scope §2.1 不在本特性顺手重构；需独立拆分子组件后再落这两处。F03 提示说明文案已单独落地（改 rewards.json，无需动组件） | F02 状态收敛 / F03 label 与使用方式 | 前端 | ✅ 已完成：按可复用重构拆分——ActivateCouponModal→useActivateCouponModal(hook)+activateCouponModalParts(展示/纯函数)+瘦视图，落 F03 配资比例/隐藏使用方式；RewardCard→rewardCardModel+rewardCardCopy(纯函数)+瘦身，落 F02 增强 Used→已失效。均配纯函数单测，逻辑等价迁移 |
| 2026-08-13 | **F07 强平价 bonus 剔除增强体验金的口径**：G5 编码确认——F08 保证金率已剔除增强体验金（`calcCrossMarginRate` 移除 `.plus(enhancedTrialNum)`，数据源 `trialFeeRecordList` 已拆分，纯函数单测锁定）。但 F07 强平价 `bonus` 现取 `useEffectiveTrialAmount().availableTrialBalance`（普通+增强合并，「已抵扣仓位占用」净值）。剔除增强需改 hook 传入普通值，候选=后端 `normalTrialBalance` 或 `availableTrialBalance - enhancedTrialBalance`；但 `normalTrialBalance`/`enhancedTrialBalance` 是否与 `availableTrialBalance` 同为「已抵扣占用」净口径未确认。**按 change-scope §2.1「改既有实盘计算不能自证无回归即阻塞」，本期不落 hook bonus 来源改动**，仅落基础无关的 liq.formulas 纯函数单测；待后端确认字段口径后一并对账 | F07 强平价 hook（useEstimatedLiqPrice/usePositionLiqPrice）bonus 来源 | 合约后端 / 负责人 | 待后端确认字段口径 |

## 提测前后端对接清单（2026-08-22 发 Lark 群问后端，逐条回复后销账）

> 前端展示层大部分已完成，以下依赖后端字段/枚举/口径，未确认前会造成提测口径打架。第 1/2/3 项拿到答复后 F07/F06/F09 即可收口提测。
>
> **2026-08-25 群同步（Spring web/app 后端 + Hugo/Milo 体验金后台）**：web/app + 后台**接口结构均不变**，仅返回数据的**数值变化**（如保证金率、预估爆仓价），后端更新返回值即可；**需要新增字段的反馈后端调整**。据此重判 B1–B5：接口结构不变属好消息，但**字段口径/枚举值/新增字段后端并未在群里回答**，B1/B2/B3/B5 仍需后台点头；B4 属"数值侧改"已被覆盖，降级为联调验证。
>
> **2026-09-01 后端逐条答复（Spring + 体验金后台）**——已代码核实，重心从"待后端"转向"待 PM Iris（产品）"：
> 1. **持仓资产接口不变，返回的预估强平价/保证金率字段已经是剔除增强体验金后的结果**。代码核实：持仓列表 per-position `position.marginRate`/`reducePrice` 后端字段直显（`ProcessingCurrentPositionsData.tsx`）→ 后端已剔除，联调核数值即可；账户级全仓保证金率是前端本地 `calcCrossMarginRate`，F08 已剔除。**但「持仓资产接口」覆盖不到开仓页预估强平价（F07）+ 杠杆切换预览**——那是前端本地逐键实时算（`useEstimatedLiqPrice`/`usePositionLiqPrice`），后端无对应字段，仍需前端改。
> 2. **c 端接口未修改、字段都有返回**；是否改展示口径需先和产品确认，要改后端再对字段。→ F06 转产品决策，非后端阻塞。schema 已含 `availableTrialBalance`（净，"已抵扣仓位占用"）/`normalTrialBalance`/`enhancedTrialBalance`。
> 3. **后台体验金类型：不需增加枚举，可把「自由资金优先」改成「不抵扣类型」，跟产品(@Iris.ex)确认**。→ 证伪原 ASSUMED `trialMode=3`；F09 改为复用现有 `TrialMode.OwnFundsFirst=2`（`apps/admin/src/constants/trialBalance.ts` 只有 1/2 两枚举）relabel「不抵扣类型」+ 风险提示条件挂 `trialMode===2`。**PM Iris 2026-09-01 定稿：现货后台全局改名**（所有 admin 视图统一），经 constants 全局生效（commit cc49b07e09；曾临时收窄 cd570b94b3 已回退）。
> 5. **切换开关改成「失效存量增强体验金」功能按钮**，点击后端批量失效当前存量增强体验金。→ F13 机制明确。**2026-09-01 PM 定稿：该失效按钮移出本仓，由后台/运维处理，前端不做**；C 端容忍失效后旧态由 F02「已失效」状态覆盖（已落码）。F13 前端职责闭环。

| # | 项 | 前端为何卡住 | 需后端给的东西 | 关联 F | 状态 |
|---|----|-------------|----------------|--------|------|
| B1 | **强平价/保证金率口径统一（最优先，含口径归属错位）** | F08 保证金率已剔除增强，但 F07 预估强平价/爆仓价仍用合并值 `availableTrialBalance`（含增强）→ 打架。**且错位风险**：Spring 称"预估爆仓价后端更新返回值"，但 G4 已核实**开仓页预估强平价是前端本地实时计算**（`useEstimatedLiqPrice.ts`，用户改数量/杠杆时前端算），后端"更新返回值"覆盖不到这份本地公式；若据此放掉 F07，开仓页强平价仍含增强埋 bug | ①确认"开仓页预估强平价"是前端本地算还是后端返回；②若前端算，`futuresAccountSchema` 三字段 `availableTrialBalance`/`normalTrialBalance`/`enhancedTrialBalance` 哪个是"不含增强、已扣冻结/占用"净值供前端喂公式 | F07 | 🟡 部分收口（2026-09-01 后端答复+代码核实）：①持仓列表 per-position 保证金率/强平价=后端字段直显（`position.marginRate`/`reducePrice`），后端确认已剔除增强→联调核数值即可；②账户级全仓保证金率=前端本地 `calcCrossMarginRate`，F08 已剔除；③**开仓页预估强平价(F07)+杠杆切换预览=前端本地逐键实时算，后端「持仓资产接口」覆盖不到**，仍需前端改（bonus `availableTrialBalance`→普通值）。reply2 确认字段全返回，**仅差后端一句 `normalTrialBalance` 净/毛口径即可落 F07**（change-scope §2.1：改实盘计算需口径确认才自证无回归）。✅ **2026-09-01 已默认落码（commit dc0dcfbf36）**：bonus 改取后端直给 `normalTrialBalance`，仅普通用户零行为变化、含增强用户剔除=自证无回归，缺失按 0 偏保守；残留净口径低风险假设待联调核值 |
| B2 | **增强体验金金额口径（C 端详情 + 后台领取记录）** | 前端现用 `总额 − 已用` 近似，与 PRD「可用=总额−委托冻结−开仓占用」口径未对齐 | 下发「委托冻结金额」「开仓占用金额」对应字段名（属 Spring 说的"需新增字段反馈调整"），供前端按 总额=可用+使用中、使用中=委托冻结+开仓占用 展示 | F06 | 🔀 默认不改 C 端（2026-09-01）：后端答接口不改、字段全返回；加「委托冻结/开仓占用」明细属产品加法需求，**默认维持现状（总额/已使用），待 PM Iris 决定是否加，加则再对字段**。非提测阻塞 |
| B3 | **后台「体验金类型」枚举值** | 「不抵扣类型（增强体验金）」前端用假设值 `trialMode=3`，未敢纳入下拉可选项 → 后台选不到该类型，配资比例风险提示永不展示 | 「不抵扣类型」真实枚举（字段名 + 取值）——接口不变≠给了枚举值，仍需后台(Hugo/Milo)明确 | F09 | ✅ 定稿（commit dcd8aad26b + cc49b07e09）：后端答不加枚举，「自有资金优先」(`OwnFundsFirst=2`) relabel「不抵扣类型」，删 ASSUMED trialMode=3、风险提示改挂 `trialMode===2`。**PM Iris 2026-09-01 定稿：现货后台全局改名**（列表/筛选/审核/派发/明细/申请所有视图统一），经 `constants/trialBalance.ts` 全局生效（曾临时收窄 cd570b94b3 已回退） |
| B4 | **后台卡券记录金额口径（PRD 删除线简化）** | 前端直显后端字段、不做本地计算，需确认后端已按新口径返回 | 领取记录：增强 `usedAmount=0`、剩余口径删除、`expiredAmount=体验金总额`（不减历史开仓占用）；使用记录：增强**无使用记录**（是否已过滤为空） | F10/F11 | ⬇️ 降级：已被 2026-08-25"数值侧后端改"覆盖，联调时验证即可，不单独阻塞 |
| B5 | **存量兼容上线策略** | PRD「停增量、不动存量、只切开关」，前端需做旧态容忍展示 | 存量卡券/旧「已使用完」态的下发方式、灰度开关字段（属上线策略，非接口结构，2026-08-25 未覆盖） | F13 | 🔀 收口（2026-09-01 PM）：C 端容忍旧态由 F02「已失效」状态覆盖（已落码）；「失效存量增强体验金」按钮**移出本仓，由后台/运维处理**，前端不做。F13 前端职责闭环 |

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
| 2026-09-01 | PRD 对照 + `origin/online...HEAD` diff review | 5 项：2 个 PRD 缺口、1 个合并类型回归、1 个旧断言冲突、1 个双分支集成风险 | 全部修复；无 open code finding | `agent/code-review.json`、`evidence/acceptance/g6/README.md` |

## 验证证据索引

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| Web 定向 Vitest | 9 files / 60 tests | PASS | 详情、卡片、领取、金额、强平价、保证金率、schema |
| Admin 定向 Vitest | 12 files / 55 tests | PASS | 配置申请、手动失效、财务流水、领取记录 |
| Biome | 本需求触达文件 | PASS | 合并钩子的 online 基线问题另行记录 |
| TypeScript 定向筛查 | 本需求相关文件 | PASS | 全仓仍有大量既存错误 |
| Browser / pre API | 真实登录态与增强体验金测试数据 | 待提测执行 | 见 `agent/acceptance-results.json` AC-7/9/12/13/15 |
