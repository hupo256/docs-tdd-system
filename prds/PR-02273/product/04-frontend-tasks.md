<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Frontend Tasks — PR-02273 增强体验金改为保证金模式

> G2 scope 定稿前所有编码任务保持「待办/阻塞」，仅文档任务可推进。requirement sourceId 与 featureId 必须同时出现在本表与 `00-feature-inventory.md`。

## 任务清单

| ID | 功能 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|----------|------|------|----------|
| T00 | F01 | `PRD-TABLE-004` `PRD-TABLE-005` | G0/G1 完成 PRD intake、9 张原型已读、manifest 全 resolved、G2 scope 定稿 | 完成 | `agent/prd-source-manifest.json` + `00-feature-inventory.md` |
| T01 | F01 | `PRD-TABLE-004` §名词解释 | 文案口径统一：i18n 增强体验金保证金模式文案（「可与自有资金一起作为合约保证金使用，盈利可全部提取」） | ✅ 完成 | `bonus:enhanced-margin-tip` + `rewards:activateCouponModal.enhancedTrialTip`（逐字断言 enhancedTrialCopy/enhancedTrialTip.copy.test） |
| T02 | F02 | `PRD-IMG-017` | 福利中心卡片：状态收敛去「已使用完」，按钮 领取/去使用/已失效，提示文案 | ✅ 完成 | commit fbc19d00cd（RewardCard 拆 model+copy，增强 Used→已失效；rewardCardCopy.test 4 例） |
| T03 | F01 | 不采用 MSW（仓库无 MSW 基建） | ~~落 MSW 路线 B~~ 改走仓库原生 schema-first + Vitest 契约测试；已登记豁免 | ✅ 豁免 | `agent/rule-waivers.json` `CODE-MSW-004`；契约测试范式=schema.parse + copy 断言 |
| T04 | F03 | `PRD-IMG-018` | 领取弹窗：抵扣比例→配资比例、删「使用方式」、文案改 | ✅ 完成 | commit b3f02c03d0 + 0eb8c6c37c（拆 hook+parts；detailMarginRatio/enhancedTrialTip 断言） |
| T05 | F04 | `PRD-IMG-019` | 详情弹窗增强体验金专版：可用/使用中体验金、配资比例、失效时间、删使用规则、隐藏查看使用详情按钮 | ✅ 完成 | commit fc784fc74c（DetailTable+index 分支；enhancedTrialCopy.test 5 例） |
| T06 | F05 | `PRD-IMG-020` | C 端领取记录：增强体验金使用规则列展示 --（列名待核） | ✅ 完成（核实无需改） | 现网 `leverageRange`「可用杠杆范围」列已对增强(trialMode≠'1')展示 `--`（useTrialFeeClaimRecordColumns.tsx） |
| T07 | F06 | 正文 §体验金总额/§可用 | 金额口径展示：总额=可用+使用中；使用中=委托冻结+开仓占用 | ⏳ 待后端对账 | 金额为后端字段（availableTrialBalance 等）；可用=总额-使用中口径依赖后端委托冻结/开仓占用，待真实接口对账 |
| T08 | F07 | 正文预估强平价公式 / `PRD-EMBED-009` | 开仓页预估强平价剔除增强体验金（G4 修正：前端本地计算） | ✅ 完成（默认落码，待联调核值） | commit dc0dcfbf36：2026-09-01 后端确认 c 端字段全返回，`bonus` 由合并值 `availableTrialBalance` 改取后端直给 `normalTrialBalance`（普通净值，非算术派生）；对仅普通用户零行为变化、含增强用户正好剔除=可自证无回归；liq.formulas.test 10 例锁公式。残留假设：`normalTrialBalance` 净口径待后端一句确认（低风险，缺失按 0 偏保守） |
| T09 | F08 | 正文保证金率公式（rev2 §8.4） | 持仓保证金率/维持保证金率/强平价展示剔除增强体验金 | ✅ 完成 | commit 286fcedad8（marginRate 移除 .plus(enhancedTrialNum)；marginRate.test 8 例） |
| T10 | F09 | `PRD-IMG-021` `PRD-IMG-022` `PRD-IMG-023` / 群补充 2026-08-13 | 现货后台体验金申请：不抵扣类型、配资比例、隐藏使用规则（apps/admin）；配资比例风险提示（红字静态，`copy.admin.rebateRatioRisk`） | ✅ 完成 | commit 286fcedad8（rebateRatioRisk 逐字文案+条件红字+断言）+ dcd8aad26b（后端确认不加枚举，「自有资金优先」relabel「不抵扣类型」，删 ASSUMED trialMode=3，风险提示挂 `trialMode===OwnFundsFirst(2)`）+ cd570b94b3（**2026-09-01 PM 口径：relabel 非全局改名，收窄为仅申请配置表单 SearchForm 下拉**，回退全局 label）；文案「谨慎」已 PM 确认 |
| T11 | F10 | `PRD-IMG-024` | 现货后台卡券领取记录：增强体验金金额口径（已使用=0 / 剩余口径删除 / 到期未使用=体验金总额） | ✅ 完成（核实无需改） | PRD 删除线更新：三项均后端字段直显（`expiredAmount` 等，CouponDistributionRecords useColumns），口径改在后端；「-历史最大开仓占用」为公式内单项删除线=公式更新非整行删；前端不硬编码（反造假） |
| T12 | F11 | `PRD-IMG-025` | 现货后台卡券使用记录：增强体验金无使用记录 | ⏳ 待后端对账 | 使用记录由后端返回，增强体验金无记录为后端过滤口径，待真实接口核对 |
| T13 | F13 | `PRD-EMBED-006` | 存量兼容展示层：容忍存量状态/「已使用完」旧态、灰度开关 | ⏳ 待后端 | 后端「停增量、不动存量、只切开关」；前端仅容忍旧态，待后端上线策略确认 |
| T14 | F02,F04,F06,F07,F08 | `PRD-TABLE-006` `PRD-TABLE-007` | 按核心验收用例逐项自测勾选 | 阻塞(G6) | `evidence/` |
| T15 | F14 | 正文 §结算/§状态机/§回收/§强平 | 后端引擎（不做，本仓外）——仅对接 API 字段/状态 | 不做 | — |

## 实现检查

- [ ] 状态/文案/class/action 映射已收敛到 map/resolver（状态：待领取/使用中/已使用/已失效）。
- [ ] 可由 `tailwind-preset.js` 表达的尺寸/圆角/间距未写成 arbitrary class。
- [ ] API DTO 未直接进入组件展示层；字段经 schema/mapper 对账（可用体验金/使用中体验金/配资比例）。
- [ ] loading / empty / error / disabled / 未登录 / 无权限完整。
- [ ] 普通（按比例抵扣）体验金回归：卡片/详情/结算不受影响。
