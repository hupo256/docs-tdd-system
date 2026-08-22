# PR-01930 拆分 follow-up 清单（2026-08-18 用户拍板：已确认部分先走 G8）

> 决策：2026-08-18 用户确认「拆分 — 已确认部分先走 G8」。本 PR **收敛闭环范围** = 已对账确认的展示点 + 后台核心 4 接口 + F20/F18 PRD 划删移除。
> 更新（2026-08-22）：原 D1（F18 合约账户资金流水）经确认 PRD 段整段划删 → 移出范围、非延后；原 D2（F19 财务审计 businessType）数仓给出 34 → 已落码回补。当前仅剩 **D3（MSW 退役）** 一项显式延后，在 G5 以带到期 waiver 可见化，不静默跳过。

## 本 PR 闭环范围（已确认，可交付）

- 后台核心 4 接口（YAPI 231/770：A1 列表/导出、A2 汇总、A6 文件解析、A3 执行）真实契约对账落码。
- F17 admin 体验金流水明细（trial-scene 数字码 114）已销账。
- F19 admin 财务审计-资金流水（`businessType=34`，数仓 2026-08-22 确认）已落码销账（见下方 §已回补）。
- F21/F22 C 端合约资金流水 / 交易记录（`get_transaction_list` 返回 `type`，key `'114'`）已销账。
- F23 C 端卡券记录（kingstar 确认继续用 `description`，零改动）已销账。
- F20 futures-admin 资产-流水查询 —— 2026-08-18 PRD 7.1.8 整段划删，已回退移除。
- F18 admin 合约账户-资金流水 —— PRD「用户管理-合约账户-资金流水」段整段划删，移出范围，前端零改动（见下方 §已划删）。
- 「即时失效金额（固定快照）」计算口径 —— PRD 划删，前端本就未单独实现，零改动。

## 已划删移出范围（PRD 删除，非延后）

### F18 admin 合约账户资金流水 —— PRD 段划删，取消不做

- PRD「用户管理-合约账户-资金流水（新增系统回收/体验金系统回收筛选）」段已在原型上整段划删，与 F20 同批移出本 PR 范围。
- 本 PR 对该处**零改动**：既有占位 `TradingOrderType.manualInvalidateTrial='manual_invalidate_trial'` 未接入、也不再回补。
- 因此原「待 Rullin 点死 `scene` vs `ext_scene`」对接项**作废**（不再是 blocker）；`handoff-contract-datawarehouse-enums.md` §1a 已随之失效。

## 已回补（原延后，现已就绪落码）

### F19 财务审计-资金流水 `businessType=34` —— 数仓 2026-08-22 确认，已落码

- 数仓确认「体验金系统回收」`businessType=34`。
- 落码：`apps/admin/src/constants/financeAuditBusinessType.ts`（内容单一源 + 纯 resolver）、`services/api/financeAudit.ts`（`contractBusinessTypes` 新增筛选项）、`FinanceAuditAssetsFlow/utils/useColumns.tsx`（列展示走 resolver）。
- 内容字面对齐 PRD 7.1.7：筛选类型「体验金系统回收」、列记「系统回收（体验金/增强体验金）」，8 个契约测试锁字面（`financeAuditBusinessType.contract.test.ts`）。

## 延后项（不在本 PR 闭环，回补前提已写明）

### D3. MSW 路线 B 退役 —— 待 dev 验证真实接口 + 「体验金管理」菜单节点就位

- 现状：`apps/admin/src/mocks/**`（`handlers/menu.ts`、`fixtures/menus.ts` 注入体验金管理叶子；核心 4 接口 handler 已随 dev 部署删除）仍在，dev-only（仅 `NODE_ENV==='development'` 注册，无 `NEXT_PUBLIC` 开关，对齐 PR-01947 先例；prod build 短路 tree-shake 出包）。
- 后端「已发 dev」但前端无法单方验证：①核心 4 接口在 dev 可直连；②「体验金管理」菜单节点已服务端注入（不再需要 fixture 注入）。
- 回补动作：dev 验证通过后，删 `handlers/*` + `fixtures/menus.ts`，业务代码 0 改动即切真实路径。
- 在 G5 以 waiver（`CODE-MOCK-002`/`CODE-MSW-002`）可见化，到期后强制回收。
