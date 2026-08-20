# PR-02265 做市商负费率｜后端回填后 前端改动 Checklist

> 前置：本清单对应 [`backend-api-handoff.md`](./backend-api-handoff.md) 各确认项。后端每回一项，勾掉对应改动。

## A. 强阻塞项落地（对接清单 6b）—— 2026-08-19 已关闭；get_transaction_list 正数化整段回退 online

- [x] **决议（Aven/Milo 2026-08-19）：不引入 typeCode / 枚举 key，`type` 字段够用，以 pre 逻辑为准。**
  - 请求侧：`get_transaction_list` 的 `type` 保持**数字编码**（开仓=`6`、平仓=`7`），与 pre 一致；test 环境曾发枚举 key `"FUTURES_OPEN_FEE"` 致后端（收数字）报错，那是错误构建，非本分支
- [x] **最终追加决议（Aven 2026-08-19）：后端反馈该接口正数化前端不用处理 → `FundsFlow` + `FuturesCashFlow` 关于 `get_transaction_list` 的正数化逻辑整段回退 `origin/online`。**
  - 删除 `FundsFlow/feeAmount.ts`(+test)、`CashFlow/futures/cashFlowAmount.ts`(+test)；`index.tsx`/`FuturesCashFlow.tsx`/`TransactionFilter.tsx`/`services/api/margin.ts` 对齐 online
  - 原实现存备份分支 `backup/PR-02265-txlist-positivization`（HEAD `94bd45ac87`）
  - 不再靠 `type` 文案匹配，多语言漏判风险随回退消失
  - **F05 前台正数化本期仅保留 `PositionHistory/Card.tsx`（非 get_transaction_list），`formatNumber.ts` `toPositiveAmount` 仍在使用**
  - 详见 `backend-api-handoff.md`「6b 决议」及其「最终追加决议」

## B. 值格式 / 值域（对接清单 2、3）

- [ ] 若后端确认用**小数比率**（0.0001）而非百分比字符串 → `feeInput.js` 增加百分比 ↔ 比率转换，`buildPayload()` 提交前换算，回显时反算；值域常量语义相应调整
- [ ] 若后端确认**仅 maker 可负、taker 不可负** → `feeInput.js` 拆分校验（taker 走 `FEE_MIN=0`，maker 走 `FEE_MIN=-100`），`external_market_account_modal.vue` 按字段选校验器
- [ ] 精度/舍入若与前端 6 位截断不一致 → 对齐 `FEE_DECIMALS`

## C. 读取回显（对接清单 5）

- [ ] 用真实列表/详情接口验证编辑框能回填负值（如 `-0.01`），`pickFeeFromRow` 字段名与后端一致
- [ ] 列表页费率列展示负值正数化 + 颜色（若列表也要展示费率）

## D. 流水 amount 带符号校验（对接清单 6a、7）—— get_transaction_list 已回退，前端不做

- [x] ~~合约订单流水正数化~~、~~资产资金流水 tab6/7 正数化~~ 均随 A 节最终决议回退 online，前端不再处理该接口正数化
- [ ] （仅保留）合约仓位历史 `PositionHistory/Card.tsx`：真实数据确认 `tradeFee` 返佣行正数化 + 判色

## E. 收尾 / 销账

- [ ] 移除所有 ASSUMED 占位（若展示层曾用占位字段，逐行对真实字段销账）
- [ ] 全链路联调后跑 G5，更新 `agent/acceptance-results.json` 与 `blockers.json`（关掉 6b 阻塞）
- [ ] `pnpm test` 相关单测全绿（`feeInput.spec.js` / `positivizeAmount.spec.js` / `flowerFlowFee.spec.js`；注：`feeAmount.test.ts`/`cashFlowAmount.test.ts` 已随 get_transaction_list 回退删除）
- [ ] 改动文件 `tsc` 零新增报错（`cd apps/web && pnpm exec tsc`，只看本 PR 改动文件）

## 不做（defer，勿顺手加）

- 真金手续费 / netInflow 统计口径 —— 后续 PR；2026-08-18 QA 测试用例（合约管理后台--数据查询--成交记录）交叉核对时提出异议，已与用户确认维持 defer，本期该条用例判定不适用

## F. 后端字段正负语义最终确认（2026-08-20，覆盖 A/D 节部分历史记录）

后端确认三个接口的手续费/流水字段最终语义，前端已同步：

- `POST /order/his_trade_list`、`POST /order/his_trade_list_v2`：`data.tradeHisList[].fee`。正常手续费为负数，返佣为正数。**规则＝正数补 `+`，负数原样展示（自带 `-`），禁止取反/`abs()`/固定拼接符号。**
  - 落地：`apps/web/src/apps/Orders/Futures/FuturesHistoryTransactionOrder/helper.ts`、`apps/web/src/apps/Futures/components/FuturesOrders/TransactionRecords/index.tsx`（4 处 `item.fee` 展示）改用新增的 `formatSignedFee`（`formatNumber.ts`）。仓库内未接入 v1 `his_trade_list`（只有 v2 有前端消费方），规则记录以备后续接入。
- `POST /position/history_position_list`：`data.positionList[].tradeFee`。同上规则（正+/负原样）。
  - Web 落地：`PositionHistory/Card.tsx` 的 `open_close_fee` 改用 `formatSignedFee`（此前 2026-08-19 已先改成展示原始值，本次补上正数 `+` 号）。
  - 合约后台（futures-admin legacy-admin）落地：**已符合，无需改动**——`positionHistory.js`/`positionInPos.js` 的 `fixD(tradeFee, 8)` 只做精度截断+保留原始负号（不加 `+`），渲染层 `v-rate-display`（`valueDisplay.vue`）默认 `showPositiveSign: true` 会给正数补 `+`，组合后已符合新规则。
- `POST /record/get_transaction_list`：`data.transList[].amount`。**后端已返回带符号字符串，前端直接展示，不做二次符号处理。**
  - `FundsFlow/index.tsx`（合约账户资金流水）：本已是 `BigNumber(amount).toFixed(8, ROUND_DOWN)` 直接对带符号值截断，符号由 BigNumber 原生保留，**符合，未改**。
  - `CashFlow/futures/FuturesCashFlow.tsx`（合约交易资金流水）：**不符合，已修复**——原实现手动 `startsWith('-')` 判断符号、`Math.abs()` 剥离、再按符号选 `formatNumberDown`/`formatNumberUp` 重新拼接前缀，属于二次处理。改为对 `item.amount` 直接 `BigNumber(...).toFixed(precision, ROUND_DOWN)` 保留原生符号，颜色改用 `BigNumber(...).isNegative()` 判定（不再依赖拼接后的字符串前缀）。

新增/调整的纯函数：`formatNumber.ts` 新增 `formatSignedFee(num, decimal)` — 复用 `formatNumberDown` 截断精度，仅在数值 `> 0` 时补 `+`，负数/0 不处理。已配 4 组单测（负数原样/正数补号/零不补号），随 `toPositiveAmount` 一起放在 `formatNumber.test.ts`。

`toPositiveAmount` 现状：2026-08-19 起 `PositionHistory/Card.tsx` 已不再调用它（按 Aven 指示改回展示原始值），目前 `apps/web` 内无生产调用方，函数与单测暂保留未删（futures-admin/admin 侧的 `positivizeAmount` 仍在用于贡献手续费等其它触点，未受本次影响）。

