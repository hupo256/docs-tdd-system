# PR-01930 拆分 follow-up 清单（2026-08-18 用户拍板：已确认部分先走 G8）

> 决策：2026-08-18 用户确认「拆分 — 已确认部分先走 G8」。本 PR **收敛闭环范围** = 已对账确认的展示点 + 后台核心 4 接口 + F20/F18 PRD 划删移除。
> 更新（2026-08-22）：原 D1（F18 合约账户资金流水）经确认 PRD 段整段划删 → 移出范围、非延后；原 D2（F19 财务审计 businessType）数仓给出 34 → 已落码回补。
> 更新（2026-08-31）：原 D3（MSW 退役）已在 pre 阶段整体拆除 → 见下方 §已回补，本清单**无剩余延后项**。

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

### D3 MSW 路线 B 退役 —— 2026-08-31 pre 阶段整体拆除完成

- 拆除动作（apps/admin，业务代码 0 改动即切真实路径）：
  - 删 `src/mocks/**`（`useMockWorker.ts`、`browser.ts`、`handlers/menu.ts`、`fixtures/menus.ts`）。
  - 删 `public/mockServiceWorker.js`；删 `src/middleware.ts` 内 dev-only Service Worker 放行分支。
  - `src/app/[lang]/Providers.tsx` 去掉 `useMockWorker()` 与 worker 就绪前的阻塞渲染，恢复裸 Provider 树。
  - `package.json` 移除 `msw` devDependency 与 `msw.workerDirectory`，`pnpm-lock.yaml` 同步（改动仅限 msw 依赖子树）。
- 全仓 `grep`：无 `msw` import、无 `@mock-only`/`USE_MOCK`/`isMock` 残留；`CODE-MOCK-002`/`CODE-MSW-002` waiver 已从 `agent/rule-waivers.json` 删除（不再需要豁免）。
- 菜单节点：`fixtures/menus.ts` 注入的「体验金手动失效管理」叶子随之移除，改由服务端菜单树下发，pre 环境以真实菜单验证。

## 延后项（无）

> 2026-08-31：D3 完成后本节清空，本 PR 无显式延后项。
