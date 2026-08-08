# PR-01988 YApi Mock UX 验证报告

> 验证时间：2026-06-20  
> 验证对象：`http://127.0.0.1:3001/zh-CN/prediction/*`  
> 验证方式：本地 `@fameex/admin` dev server + Playwright（system Chrome）  
> 结果 JSON：`results.json`

> 截图已按公共规则清理（mock-first 低保真截图已过期，UI 已确认完成）；下表「截图」列保留为当时验证项记录，文件不再随报告保存。

## 页面覆盖

| 页面 | 路径 | 结果 | 截图 |
|------|------|------|------|
| 每日收入 | `/prediction/daily-income` | 通过 | `daily-income.png` |
| 分类管理 | `/prediction/categories` | 通过 | `categories.png` |
| 事件管理 | `/prediction/events` | 通过 | `events.png` |
| 订单查询 | `/prediction/orders` | 通过 | `orders.png` |
| 仓位查询 | `/prediction/positions` | 通过 | `positions.png` |
| 对账与平账 | `/prediction/reconciliation` | 通过 | `reconciliation.png` |
| 告警配置 | `/prediction/alerts` | 通过 | `alerts.png` |

## 流程覆盖

| 流程 | 结果 | 截图 |
|------|------|------|
| 订单关键词筛选 `100382` | 通过，筛选后仍展示目标订单 | `orders-filter-uid-100382.png` |
| 订单 mock 错误态 `__error` | 通过，展示 `PR-01988 mock API error` | `orders-error-state.png` |
| 新增分类弹窗 | 通过，弹出 `新增分类（mock）` | `categories-create-modal.png` |
| 手动平账二次确认 | 通过，弹出高风险确认和审计字段 | `reconciliation-manual-modal.png` |

## 发现与处理

| 类型 | 说明 | 处理 |
|------|------|------|
| 页面 bug | 订单 hash 为 `-` 时不应生成 Polygonscan 外链 | 已修复：无 hash 时展示 `-` |
| 页面 bug | 告警弹窗曾有重复 `持仓差异` 选项 | 已修复 |
| 脚本问题 | 初版脚本按按钮可访问名找 `查询`，AntD DOM 下定位不稳定 | 已改为输入即生效验证，不影响产品代码 |
| 既有 warning | `antd v5 support React is 16 ~ 18` console warning | 非 PR-01988 新增，未阻断流程 |

## 验证结论

- PR-01988 预测市场 7 个后台页面均可打开并展示更精确 mock 数据。
- 订单筛选、错误态、分类新增弹窗、手动平账二次确认流程均可运行。
- 截图已按公共规则清理；本报告保留逐页 / 逐流程结论与 `results.json`。
