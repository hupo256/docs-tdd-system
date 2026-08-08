# PR-01988 UI/UX 验收报告

## 结论

- 验收结论：通过。
- 验收时间：2026-06-19。
- 验收范围：预测市场 Admin mock-first 页面，`/prediction/...` 七个路由。
- 报告目录：`apps/web/docs_tdd/prds/PR-01988/evidence/ui-ux/`。
- 截图清理：历史截图已按公共规则删除；本报告保留真实 Browser / Playwright 自测步骤、结果和风险。

## 工具分工

- Browser MCP：把真实浏览器窗口展示给人工可见，用于现场观察页面、读取 DOM、检查控制台错误和确认页面状态。
- Playwright：自动化批量验收，用脚本逐路由打开页面、等待关键标题与 mock-first 提示、检查重定向/权限页/Next overlay/控制台错误，并保存结构化 `results.json`。
- 关系：Browser MCP 负责透明可见和人工复核，Playwright 负责可重复、批量、结构化断言；两者互补，不是二选一。

## 已修问题

| 问题 | 现象 | 修复 |
|---|---|---|
| i18n 渲染期副作用 | Browser 看到 Next overlay：`Cannot update a component while rendering...` | `useT` 中 `changeLanguage` 移入 `useEffect` |
| 菜单接口触发登出 | Playwright 发现部分页面跳 `/unauthorized` / `#/login` | mock-first 模式下菜单请求改走本地 `/api/mock/menus` |
| mock 菜单响应格式不兼容 | Playwright 发现 `ZodError` 控制台错误 | `/api/mock/menus` 返回 `patternFetch` 兼容的 `code/succ/msg/data` |
| mock DTO 泛型约束 | TS 映射中 model 需要 object 约束 | `fetchPredictionRows<TDto, TModel extends object>` |

## Playwright 自动验收

运行环境：本地 Playwright，安装在 `~/.codex/tools/playwright`，未写入项目依赖。

验证点：

- HTTP 响应为 200。
- 最终 URL 保持在目标 `/zh-CN/prediction/...`。
- 页面标题可见。
- `当前为 PR-01988 mock-first 低保真页面` 提示可见。
- 未出现 `/unauthorized`、`#/login`、Next `Application error` overlay。
- 控制台错误为空。
- 历史每页截图已清理；报告保留逐路由实测结论。

| 页面 | 路由 | 结果 | 实测方式 |
|---|---|---|---|
| 每日收入统计 | `/zh-CN/prediction/daily-income` | pass | Playwright 打开真实页面并断言标题 / mock 提示 / 控制台 |
| 分类管理 | `/zh-CN/prediction/categories` | pass | Playwright 打开真实页面并断言标题 / mock 提示 / 控制台 |
| 事件管理 | `/zh-CN/prediction/events` | pass | Playwright 打开真实页面并断言标题 / mock 提示 / 控制台 |
| 订单查询 | `/zh-CN/prediction/orders` | pass | Playwright + Browser MCP 可见复核 |
| 仓位查询 | `/zh-CN/prediction/positions` | pass | Playwright 打开真实页面并断言标题 / mock 提示 / 控制台 |
| 对账与平账 | `/zh-CN/prediction/reconciliation` | pass | Playwright 打开真实页面并断言标题 / mock 提示 / 控制台 |
| 告警配置 | `/zh-CN/prediction/alerts` | pass | Playwright 打开真实页面并断言标题 / mock 提示 / 控制台 |

结构化结果：`results.json`。

## Browser MCP 可见复核

复核页面：`/zh-CN/prediction/orders`。

复核结果：

```json
{
  "url": "http://127.0.0.1:3001/zh-CN/prediction/orders",
  "overlayErrors": [],
  "hasExpectedTitle": true,
  "hasMockNotice": true,
  "hasUnauthorized": false,
  "consoleErrors": []
}
```

Browser MCP 可见复核已执行；历史截图已按公共规则删除。

## 剩余风险

- 当前为 mock-first 低保真实现，真实 API、后端 permission code、PM fee 精度仍待后端对齐。
- 手动平账仅验证 UI 外壳、二次确认提示和审计字段展示，真实 mutation 未接入。
- 本报告不代表生产数据链路通过，只证明 PR-01988 当前 Admin mock-first UI/UX 可见、可访问、无前端崩溃和无控制台错误。

## 2026-06-22 过期说明

本报告记录的是 2026-06-19 版本的 UI/UX 验收结果。后续代码已按截图要求移除页面说明、解释和 mock 提示型组件，因此本报告中关于 `当前为 PR-01988 mock-first 低保真页面` 可见的断言已经过期。

UI/UX 当前已确认完成；本旧报告仅保留历史可访问性参考。下一次报告应在真实接口联调后执行，重点验证真实数据、权限、导出、保存 mutation 和高风险操作安全状态。
