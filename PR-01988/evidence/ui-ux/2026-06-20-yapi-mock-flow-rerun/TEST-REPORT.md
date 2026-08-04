# PR-01988 YApi Mock UX 验证报告（复跑）

> 验证时间：2026-06-20
> 验证对象：`http://127.0.0.1:3001/zh-CN/prediction/*`
> 验证方式：本地 `@fameex/admin` dev server + Playwright（system Chrome）
> 结果 JSON：`results.json`

> 截图已按公共规则清理（mock-first 低保真截图已过期，UI 已确认完成）；下表「截图」列保留为当时验证项记录，文件不再随报告保存。

## 页面覆盖

| 页面 | 路径 | 行数 | 结果 | 截图 |
|------|------|------|------|------|
| 预测市场每日收入 | `/prediction/daily-income` | 4 | 通过 | `daily-income.png` |
| 预测市场分类管理 | `/prediction/categories` | 4 | 通过 | `categories.png` |
| 预测市场事件管理 | `/prediction/events` | 5 | 通过 | `events.png` |
| 预测市场订单查询 | `/prediction/orders` | 5 | 通过 | `orders.png` |
| 预测市场仓位查询 | `/prediction/positions` | 4 | 通过 | `positions.png` |
| 预测市场对账与平账 | `/prediction/reconciliation` | 5 | 通过 | `reconciliation.png` |
| 预测市场告警配置 | `/prediction/alerts` | 5 | 通过 | `alerts.png` |

## 流程覆盖

| 流程 | 结果 | 截图 |
|------|------|------|
| orders keyword filter | 通过 | `orders-filter-uid-100382.png` |
| orders mock error state | 通过 | `orders-error-state.png` |
| category create modal | 通过 | `categories-create-modal.png` |
| reconciliation manual settle modal | 通过 | `reconciliation-manual-modal.png` |

## 发现与处理

| 类型 | 说明 | 处理 |
|------|------|------|
| 页面核查 | 顶部模式提示已随 mock/real 开关区分 | 本轮 mock 模式截图已验证 `mock-first` 提示存在 |
| 页面核查 | 订单 hash 为空占位时不应生成外链 | 本轮订单页通过，代码中无 hash 展示 `-` |
| 既有 warning | `antd v5 support React is 16 ~ 18` console warning | 非 PR-01988 新增，未阻断流程 |

## 验证结论

- PR-01988 预测市场 7 个后台页面均可打开并展示更精确 mock 数据。
- 订单筛选、错误态、分类新增弹窗、手动平账二次确认流程均可运行。
- 截图已按公共规则清理；本报告保留逐页 / 逐流程结论与 `results.json`。
