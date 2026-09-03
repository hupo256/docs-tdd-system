<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Frontend Tasks — PR-02273 增强体验金改为保证金模式

> G2 scope 定稿前所有编码任务保持「待办/阻塞」，仅文档任务可推进。requirement sourceId 与 featureId 必须同时出现在本表与 `00-feature-inventory.md`。F09 已按 PRD bullet 下沉为原子需求；每行单独状态、单独证据，不能再由一个总任务勾选完成。

## 任务清单

| ID | 功能 ID | 原子需求 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|-------------|----------|------|------|----------|
| T00 | F01 | — | `PRD-TABLE-004` `PRD-TABLE-005` | G0/G1 完成 PRD intake、9 张原型已读、manifest 全 resolved、G2 scope 定稿 | 完成 | `agent/prd-source-manifest.json` + `00-feature-inventory.md` |
| T01 | F01 | — | `PRD-TABLE-004` §名词解释 | 文案口径统一：i18n 增强体验金保证金模式文案（「可与自有资金一起作为合约保证金使用，盈利可全部提取」） | ✅ 完成 | `bonus:enhanced-margin-tip` + `rewards:activateCouponModal.enhancedTrialTip`（逐字断言 enhancedTrialCopy/enhancedTrialTip.copy.test） |
| T02 | F02 | — | `PRD-IMG-017` | 福利中心卡片：状态收敛去「已使用完」，按钮 领取/去使用/已失效，提示文案 | ✅ 完成 | commit fbc19d00cd（RewardCard 拆 model+copy，增强 Used→已失效；rewardCardCopy.test 4 例） |
| T03 | F01 | — | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 本需求复用现有接口，无新增 API；沿用现有 service/schema，以 Vitest 契约测试覆盖前端分支，例外已登记 | ✅ 豁免 | `agent/rule-waivers.json` `CODE-MSW-004`；契约测试范式=schema.parse + copy 断言 |
| T04 | F03 | — | `PRD-IMG-018` | 领取弹窗：抵扣比例→配资比例、删「使用方式」、文案改 | ✅ 完成 | commit b3f02c03d0 + 0eb8c6c37c（拆 hook+parts；detailMarginRatio/enhancedTrialTip 断言） |
| T05 | F04 | — | `PRD-IMG-019` | 详情弹窗增强体验金专版：可用/使用中体验金、配资比例、失效时间、删使用规则、隐藏查看使用详情按钮 | ✅ 完成 | commit fc784fc74c（DetailTable+index 分支；enhancedTrialCopy.test 5 例） |
| T06 | F05 | — | `PRD-IMG-020` | C 端领取记录：增强体验金使用规则列展示 --（列名待核） | ✅ 完成（核实无需改） | 现网 `leverageRange`「可用杠杆范围」列已对增强(trialMode≠'1')展示 `--`（useTrialFeeClaimRecordColumns.tsx） |
| T07 | F06 | — | 正文 §体验金总额/§可用 / 用户确认 2026-09-02 | 金额口径展示：总额=`quantity`；使用中=`frozen + occupy`；可用=`quantity - frozen - occupy` | ✅ 完成 | `useRuleType=3` 识别增强体验金；真实 `/position/get_assets_list` 结构与金额纯函数单测覆盖 |
| T08 | F07 | — | 正文预估强平价公式 / `PRD-EMBED-009` | 开仓页预估强平价剔除增强体验金（G4 修正：前端本地计算） | ✅ 完成（默认落码，待联调核值） | commit dc0dcfbf36：2026-09-01 后端确认 c 端字段全返回，`bonus` 由合并值 `availableTrialBalance` 改取后端直给 `normalTrialBalance`（普通净值，非算术派生）；对仅普通用户零行为变化、含增强用户正好剔除=可自证无回归；liq.formulas.test 10 例锁公式。残留假设：`normalTrialBalance` 净口径待后端一句确认（低风险，缺失按 0 偏保守） |
| T09 | F08 | — | 正文保证金率公式（rev2 §8.4） | 持仓保证金率/维持保证金率/强平价展示剔除增强体验金 | ✅ 完成 | commit 286fcedad8（marginRate 移除 .plus(enhancedTrialNum)；marginRate.test 8 例） |
| T10a | F09 | R-F09-01 | `PRD-IMG-021` / 群补充 2026-08-13 | 类型文案「自有资金优先」改为「不抵扣类型」 | 已实现，待原子验收 | 现有 constants 改动；须补 `copy-literal` + `component-dom` acceptance |
| T10b | F09 | R-F09-02 | `PRD-IMG-021` / 群补充 2026-08-13 | 选择不抵扣类型时字段标签显示「配资比例」 | 待补 DOM 证据 | 不能以 copy 断言代替条件渲染断言 |
| T10c | F09 | R-F09-03 | 群补充 2026-08-13 | 锁定激活门槛比例与混合配资开仓比例逻辑、提交值均不变 | 待补逻辑/提交证据 | 须补 `pure-logic` + `payload-contract` acceptance |
| T10d | F09 | R-F09-04 | 群补充 2026-08-13 | 选择不抵扣类型时在配资比例字段下方显示风险提示 | 待补 DOM 证据 | 现有 JSX 不等于已验收；须验证条件与位置 |
| T10e | F09 | R-F09-05 | `copy.admin.rebateRatioRisk` | 风险提示逐字匹配 PRD 且为红色字体 | 文案已有，待视觉证据 | 逐字测试只覆盖 `copy-literal`；红色仍需 `visual` |
| T10f | F09 | R-F09-06 | `PRD-IMG-022` `PRD-IMG-023` | 选择不抵扣类型时使用规则完全不渲染 | 待补 DOM 证据 | 须断言 DOM 中不存在字段，不接受 copy 测试替代 |
| T10g | F09 | R-F09-07 | 回归要求 | 其他体验金类型标签、字段可见性和提交逻辑不变 | 待补回归证据 | 须补 `component-dom` + `payload-contract` acceptance |
| T11 | F10 | — | `PRD-IMG-024` | 现货后台卡券领取记录：增强体验金金额口径（已使用=0 / 剩余口径删除 / 到期未使用=体验金总额） | ✅ 完成（核实无需改） | PRD 删除线更新：三项均后端字段直显（`expiredAmount` 等，CouponDistributionRecords useColumns），口径改在后端；「-历史最大开仓占用」为公式内单项删除线=公式更新非整行删；前端不硬编码（反造假） |
| T12 | F11 | — | `PRD-IMG-025` | 现货后台卡券使用记录：增强体验金无使用记录 | ⏳ 待后端对账 | 使用记录由后端返回，增强体验金无记录为后端过滤口径，待真实接口核对 |
| T13 | F13 | — | `PRD-EMBED-006` | 存量兼容展示层：容忍存量状态/「已使用完」旧态、灰度开关 | ✅ 完成（收口） | C 端容忍旧态由 F02「已失效」状态覆盖（已落码）；「失效存量增强体验金」按钮 PM 2026-09-01 定为**移出本仓、后台/运维处理**，前端不做。F13 前端职责闭环 |
| T14 | F02,F04,F06,F07,F08 | — | `PRD-TABLE-006` `PRD-TABLE-007` | 按核心验收用例逐项自测勾选 | 前端自动化完成，pre 待核 | `evidence/acceptance/g6/README.md` |
| T15 | F14 | — | 正文 §结算/§状态机/§回收/§强平 | 后端引擎（不做，本仓外）——仅对接 API 字段/状态 | 不做 | — |

## 实现检查

- [ ] 状态/文案/class/action 映射已收敛到 map/resolver（状态：待领取/使用中/已使用/已失效）。
- [ ] 可由 `tailwind-preset.js` 表达的尺寸/圆角/间距未写成 arbitrary class。
- [ ] API DTO 未直接进入组件展示层；字段经 schema/mapper 对账（可用体验金/使用中体验金/配资比例）。
- [ ] loading / empty / error / disabled / 未登录 / 无权限完整。
- [ ] 普通（按比例抵扣）体验金回归：卡片/详情/结算不受影响。
