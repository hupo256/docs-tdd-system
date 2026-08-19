# PR-01930 拆分 follow-up 清单（2026-08-18 用户拍板：已确认部分先走 G8）

> 决策：2026-08-18 用户确认「拆分 — 已确认部分先走 G8」。本 PR **收敛闭环范围** = 已对账确认的展示点 + 后台核心 4 接口 + F20 移除；以下 3 项 **显式延后到后续 PR / 后端就绪后回补**，在 G5 以带到期 waiver 可见化，不静默跳过。

## 本 PR 闭环范围（已确认，可交付）

- 后台核心 4 接口（YAPI 231/770：A1 列表/导出、A2 汇总、A6 文件解析、A3 执行）真实契约对账落码。
- F17 admin 体验金流水明细（trial-scene 数字码 114）已销账。
- F21/F22 C 端合约资金流水 / 交易记录（`get_transaction_list` 返回 `type`，key `'114'`）已销账。
- F23 C 端卡券记录（kingstar 确认继续用 `description`，零改动）已销账。
- F20 futures-admin 资产-流水查询 —— 2026-08-18 PRD 7.1.8 整段划删，已回退移除。
- 「即时失效金额（固定快照）」计算口径 —— PRD 划删，前端本就未单独实现，零改动。

## 延后项（不在本 PR 闭环，回补前提已写明）

### D1. F18 admin 合约账户资金流水 —— 待 Rullin 点死 `scene` vs `ext_scene`

- 现状：占位 `TradingOrderType.manualInvalidateTrial='manual_invalidate_trial'` 挂在 `order_type` 字段。
- Rullin 已确认合约资金流水靠 `scene`/`ext_scene` **数字字段**识别（trial-scene 114），但未点死是哪个字段。
- 回补动作：字段确认后，把 F18 从 `order_type` 字符串识别改为读该数字字段 === 114。
- 纪律：money-adjacent，不猜字段（撞码会错标真实资金流水）。对接单见 `handoff-contract-datawarehouse-enums.md` §1a。

### D2. F19 财务审计 `businessType` —— 待数仓 @Peanut 给数字值

- 现状：占位 `TRIAL_MANUAL_INVALIDATE_BUSINESS_TYPE = 34`。
- 回补动作：数仓给出真实数字后替换常量 + 跑契约测试。对接单见 `handoff-contract-datawarehouse-enums.md` §1b。

### D3. MSW 路线 B 退役 —— 待 dev 验证真实接口 + 「体验金管理」菜单节点就位

- 现状：`apps/admin/src/mocks/**`（`handlers/trialBalanceManualInvalidate.ts`、`handlers/menu.ts`、`fixtures/menus.ts` 注入体验金管理叶子）仍在，dev-only（`NEXT_PUBLIC_ENABLE_MSW=true` 才注册，prod build 短路）。
- 后端「已发 dev」但前端无法单方验证：①核心 4 接口在 dev 可直连；②「体验金管理」菜单节点已服务端注入（不再需要 fixture 注入）。
- 回补动作：dev 验证通过后，删 `handlers/*` + `fixtures/menus.ts`，业务代码 0 改动即切真实路径。
- 在 G5 以 waiver（`CODE-MOCK-002`/`CODE-MSW-002`）可见化，到期后强制回收。
