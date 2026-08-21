<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Frontend Tasks — PR-02265 外部做市商合约账户支持配置负手续费率

> 2026-08-10 以远端 PRD revision 1576 重新 intake。F08~F13 是首次同步后新增范围；业务代码尚未据此补齐。

## 任务清单

| ID | 功能 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|----------|------|------|----------|
| T00 | F01~F13 | PRD 全文 + manifest 34 项 | G0 PRD intake：20 图片、2 表格、1 sheet、11 cite 全部本地化、读取、分类并建立 Feature 映射 | 已完成 | `agent/prd-source-manifest.json` + intake evidence |
| T01 | F01 | `PRD-IMG-016` `PRD-IMG-017` `PRD-IMG-018` | 合约做市账户 4 费率字段允许负值；范围 `[-100,100]`、6 位精度、非法/非空校验、编辑回显 | 待办 | 单测 + G6 |
| T02 | F02 | `PRD-IMG-019` | 4 费率框下常驻：「按对应订单类型分别收取，负值表示返佣费率(如-0.000001)」 | 待办 | 字面量断言 + G6 |
| T03 | F01 F05 | API contract §0.1 | 不采用 MSW；直连 test 后端验证，负值/边界用纯函数单测 | 已完成（G5 用户确认） | 单测 + G5 用户确认记录 |
| T04 | F03 | `PRD-IMG-017` `PRD-IMG-018` | 校验失败逐字显示「请输入【-100,100】之间的数字，精度支持6位」；不采用图片中的短文案 | 待办 | 字面量断言 + G6 |
| T05 | F04 | `PRD-IMG-033` | 外部做市商列表「手续费率」列兼容负费率显示 | 待办 | G6 |
| T06 | F05 | `PRD-IMG-023` `PRD-IMG-024` `PRD-IMG-025` `PRD-IMG-026` | 前台 web 按最终接口契约展示：`his_trade_list_v2.fee`、`history_position_list.tradeFee` 正常手续费负、返佣正，正数补 `+`、负数原样；`get_transaction_list.amount` 直接保留后端符号；app/h5 不在本仓 | 已完成（2026-08-20 对账） | `formatNumber.test.ts` + G5/G6 |
| T07 | F06 | `PRD-IMG-027` `PRD-IMG-028` `PRD-IMG-029` `PRD-IMG-030` `PRD-IMG-031` `PRD-IMG-032` | 现货后台用户合约流水及合约后台触点按对应接口口径展示；`history_position_list.tradeFee` 保留后端符号并由渲染层为正数补 `+`，其余 PRD 正数化触点显示绝对值；含补录的 `flowerDetail.vue` | 已完成（原 5 触点 + 补漏 1 项） | `positivizeAmount.spec.js`（两端）/`flowerFlowFee.spec.js` + G5/G6 |
| T08 | F01 F03 F04 F05 F06 | `PRD-EMBED-003` | 对照验收 sheet 9 条逐项自测 | 待办 | `agent/acceptance-results.json` |
| T09 | F07 | `PRD-TABLE-003` | 返佣计算/入账/异常为后端逻辑；G5 仅确认展示层不受影响 | 已完成（后端/QA 联调） | G5 用户确认记录 |
| T10 | F01~F13 | scope revision 1576 | 对新增范围重新执行 G4 复用盘点与代码定位；不得沿用 revision 1009 的旧 G4 结论直接编码 | 已完成 | 2026-08-10 G4 PASS |
| T11 | F08 | `PRD-IMG-019` + §5.1 正文 | `/externalMmAccount/add|update` 保存后费率需即时生效；前端保存成功立即刷新，不加延时缓存；G5 验证实际生效 | 已完成（G5 用户确认） | 用户确认记录；无可归档交易明细 |
| T12 | F09 | `PRD-IMG-019` `PRD-IMG-020` | `external_market_account_modal.vue` 合约类型蓝框逐字显示：①「生效规则:以上费率按「账号x币对」维度精确匹配，交易对应币对时自动应用配置费率」②「外部做市商账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准。」 | 待办 | 字面量断言 + 弹窗截图 |
| T13 | F10 | `PRD-IMG-021` | 同弹窗现货类型蓝框第二条逐字显示：「外部做市商账号若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。」 | 待办 | 字面量断言 + 弹窗截图 |
| T14 | F11 | `PRD-IMG-034` + §5.1 正文 | `vip_level/components/userWhiteList.vue` 添加/编辑弹窗新增蓝框：「账号若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。」 | 待办 | 字面量断言 + 弹窗截图 |
| T15 | F12 | `PRD-IMG-035` + §5.1 正文 | `vip_level/components/coinWhiteList.vue` 添加/编辑弹窗新增蓝框：「账号交易的币对若在【外部做市商】表和【会员等级--基础配置】表中均有配置，以【外部做市商】表的手续费率为准。」 | 待办 | 字面量断言 + 弹窗截图 |
| T16 | F13 | `PRD-IMG-022` + §5.1 正文 | `futuresExchange/components/futuresFeeDiscountModal.vue` 添加/编辑弹窗表单末尾新增蓝框：「该账号若在【外部做市商】表和【手续费折扣】表中均有配置，以【外部做市商】表的手续费率为准。」 | 已完成 | 字面量断言 + DOM 顺序断言 + 弹窗截图 |

## 实现检查

- [ ] F01/F03 校验与 sanitize 抽为纯函数，覆盖负值、`±100`、6 位、多负号、非法和空值。
- [ ] F05/F06 按接口最终符号契约展示；Web signed fee 与后台正数化触点分别有单测。
- [x] F08 G5 联调由用户确认通过；本会话不补造账号、交易 ID 或截图。
- [ ] F09~F13 固定文案均有「值 === PRD 正文」断言；F11/F12 主语不可互换。
- [ ] 仅更新 Web 项目的简体中文 locale，不修改其他 locale。
- [ ] loading / empty / error / disabled / 权限状态不因提示框改动而回归。
