# YApi Project 459 Export（历史快照）

> 注意：本目录是 2026-06-20 的早期导出快照，仅保留历史对照。当前权威 YApi 快照已更新到 2026-06-25，共 32 个接口，见 `../../yapi/interface-details.md`、`../../yapi/interface-details.json` 和 `../../yapi/diff-summary-2026-06-25.json`。后续开发文档以 `inbox/yapi/` 与 `product/12-yapi-api-integration.md` 为准。

- Exported at: 2026-06-20T11:49:20.676Z
- Count: 17

| ID | Method | Path | Title | Category | Status |
|---|---|---|---|---|---|
| 4615 | GET | `/polymarket/alert-config/get` | 查询 Polymarket 预警配置 | Polymarket 预警配置 | done |
| 4618 | POST | `/polymarket/alert-config/update` | 更新 Polymarket 预警配置 | Polymarket 预警配置 | done |
| 4621 | POST | `/polymarket/category/pageList` | 分类列表 | 分类管理 | undone |
| 4624 | GET | `/polymarket/category/locale/list` | 支持的语言列表&code | 分类管理 | undone |
| 4627 | GET | `/polymarket/category/tree` | 全量分类树桩结构 | 分类管理 | undone |
| 4630 | POST | `/polymarket/category/createLevelOne` | 一级创建 | 分类管理 | undone |
| 4633 | POST | `/polymarket/category/saveChildren` | 二，三级创建 | 分类管理 | undone |
| 4636 | POST | `/polymarket/category/update/full` | 修改一，二，三分类级别 | 分类管理 | undone |
| 4642 | GET | `/polymarket/category/treeByLevelOneId` | 某一级分类树桩结构 | 分类管理 | undone |
| 4645 | POST | `/tradeDailyIncome/pageList` | 每日统计列表 | 每日收入统计 | undone |
| 4648 | POST | `/tradeDailyIncome/summary` | 毛利趋势和统计 | 每日收入统计 | undone |
| 4651 | GET | `/polymarket/category/evenSync18n` | 同步查询事件 | 事件 | undone |
| 4654 | POST | `/polymarket/order/pageList` | 预测市场订单管理列表 | 订单管理 | done |
| 4657 | POST | `/polymarket/order/export` | 预测市场订单管理导出 | 订单管理 | done |
| 4660 | POST | `/polymarket/order/stats` | 预测市场订单管理统计数据 | 订单管理 | done |
| 4663 | POST | `/polymarket/position/pageList` | 预测市场仓位管理列表 | 仓位管理 | done |
| 4666 | POST | `/polymarket/position/export` | 预测市场仓位管理导出 | 仓位管理 | done |
