# PR-02265 做市商负费率｜后端回填后 前端改动 Checklist

> 前置：本清单对应 [`backend-api-handoff.md`](./backend-api-handoff.md) 各确认项。后端每回一项，勾掉对应改动。

## A. 强阻塞项落地（对接清单 6b）—— 2026-08-19 已关闭，不做 typeCode

- [x] **决议（Aven/Milo 2026-08-19）：不引入 typeCode / 枚举 key，`type` 字段够用，以 pre 逻辑为准。**
  - 请求侧：`get_transaction_list` 的 `type` 保持**数字编码**（开仓=`6`、平仓=`7`），与 pre 一致；test 环境曾发枚举 key `"FUTURES_OPEN_FEE"` 致后端（收数字）报错，那是错误构建，非本分支
  - 响应侧：`FundsFlow/feeAmount.ts` 的 `isFeeFlowType` 维持按 `type` 文案字符串匹配（`FEE_FLOW_TYPES`）；曾引入的 `typeCode` 已于 `d3f1a3c35a` 移除
  - 多语言漏判风险本期知情接受（后端不提供类型码、以 pre 为准），如后续多语种出问题再单独起 PR
  - 详见 `backend-api-handoff.md`「6b 决议」

## B. 值格式 / 值域（对接清单 2、3）

- [ ] 若后端确认用**小数比率**（0.0001）而非百分比字符串 → `feeInput.js` 增加百分比 ↔ 比率转换，`buildPayload()` 提交前换算，回显时反算；值域常量语义相应调整
- [ ] 若后端确认**仅 maker 可负、taker 不可负** → `feeInput.js` 拆分校验（taker 走 `FEE_MIN=0`，maker 走 `FEE_MIN=-100`），`external_market_account_modal.vue` 按字段选校验器
- [ ] 精度/舍入若与前端 6 位截断不一致 → 对齐 `FEE_DECIMALS`

## C. 读取回显（对接清单 5）

- [ ] 用真实列表/详情接口验证编辑框能回填负值（如 `-0.01`），`pickFeeFromRow` 字段名与后端一致
- [ ] 列表页费率列展示负值正数化 + 颜色（若列表也要展示费率）

## D. 流水 amount 带符号校验（对接清单 6a、7）

- [ ] 合约订单流水：真实数据确认 `amount` 带符号，返佣行显示正数、色为红（`UpOrDownText isUp={Number(amount)>=0}`）
- [ ] 资产资金流水：tab 6/7 真实数据确认正数化 + 判色（`buildCashFlowAmount` isFeeTab 分支）

## E. 收尾 / 销账

- [ ] 移除所有 ASSUMED 占位（若展示层曾用占位字段，逐行对真实字段销账）
- [ ] 全链路联调后跑 G5，更新 `agent/acceptance-results.json` 与 `blockers.json`（关掉 6b 阻塞）
- [ ] `pnpm test` 相关单测全绿（`feeInput.spec.js` / `feeAmount.test.ts` / `cashFlowAmount.test.ts` / `positivizeAmount.spec.js`）
- [ ] 改动文件 `tsc` 零新增报错（`cd apps/web && pnpm exec tsc`，只看本 PR 改动文件）

## 不做（defer，勿顺手加）

- 真金手续费 / netInflow 统计口径 —— 后续 PR；2026-08-18 QA 测试用例（合约管理后台--数据查询--成交记录）交叉核对时提出异议，已与用户确认维持 defer，本期该条用例判定不适用
