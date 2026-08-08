# PR-01988 技术方案

> 状态：G2 已确认；Admin UI/UX 已完成；YApi project 459 已拉取 32 个接口，真实 API 按权限 / 环境 / 安全闸口继续联调。

## 代码影响面

| 区域 | 预计影响 | 当前证据 / 说明 |
|------|----------|------------------|
| `apps/admin/src/app/[lang]/(dashboard)/(main)/(sider)/**` | 新增预测市场 Admin 路由页面 | 已新增 `/prediction/**/page.tsx` 薄路由 |
| `apps/admin/src/apps/PredictionMarket*` | 新增 Admin 业务模块 | 已新增 `apps/admin/src/apps/PredictionMarket/index.tsx` mock-first 页面容器 |
| `apps/admin/src/services/api/**` | 新增预测市场管理 API service | 已新增 `prediction.ts` React Query mock hooks、real-mode 预接入和 `prediction.mock.ts` fixture；继续按 YApi 32 个接口联调 |
| `apps/admin/src/types/prediction.ts` | 新增预测市场 UI/API 类型 | 已新增 mock-first 类型和主要 YApi DTO / mapper；字段精度、错误码、权限态继续联调 |
| `apps/admin/src/constants/routes.ts` | 新增 pathnames | 已新增 `prediction*` route keys |
| `apps/admin/src/constants/siderItems.ts` | 新增侧栏菜单 | 已新增独立「预测市场」菜单组，权限码为占位，后端正式 code 后替换 |
| `apps/admin/src/types/permission.ts` | 新增权限枚举 | 已新增 `prediction.market.*` 占位枚举；后端正式 code 后替换 |
| `apps/admin/legacy-admin/src/router/index.js` | 新增 `LANG_REDIRECT_PATHS` | 已加入 `prediction`，避免 legacy 菜单进入 Next 路由时走 hash |
| `apps/admin/src/i18n/locales/zh-CN/sider.json`、`title.json` | 新增菜单和页面标题中文文案 | 已按仓库规则只维护 `zh-CN` |
| `apps/admin/src/i18n/locales/zh-CN/**` | 新增中文文案 | 当前只维护 `zh-CN`，其他语言不手动补 |
| `apps/web/src/apps/Prediction/**` | 用户侧埋点、交易禁用态可能涉及 | 当前 worktree 未找到该路径；Web F01/F07 开发前需确认一期代码来源或是否从当前结构补新实现 |
| `apps/web/src/services/api/prediction/**` | Polymarket 列表、详情、预计收益、买卖 API | 当前 worktree 未找到该路径；不能按该路径开发 |
| `apps/web/src/services/api/predict/**` | 预测市场账户页 API | 当前 worktree 未找到该路径；不能按该路径开发 |
| `apps/admin/legacy-admin/src/views/exchangeTradeConfig/contractTrading/polymarket_config.vue` | 既有 Polymarket 私钥 / 钱包 / Relayer API Key 配置 | 需确认保留 legacy、迁移 Next Admin，或与二期告警 / 事件后台分开 |
| `apps/admin/legacy-admin/src/router/exchangeTradeConfig.js` | 既有 legacy 路由 `/polymarket_config` | 新 Next Admin 路由若由 legacy 菜单进入，需要同步 redirect |

## 建议 Admin 路由

| 模块 | 建议 pathname | 说明 |
|------|---------------|------|
| 每日收入统计 | `/prediction/daily-income` | KPI、趋势、明细、导出 |
| 分类管理 | `/prediction/categories` | 多级分类和排序 |
| 事件管理 | `/prediction/events` | 添加事件、状态、rate、阈值 |
| 订单管理 | `/prediction/orders` | 订单列表和对账 |
| 仓位管理 | `/prediction/positions` | 用户持仓维度 |
| 手动平账 | `/prediction/reconciliation` | 持仓差异和平账记录 |
| 告警配置 | `/prediction/alerts` | 阈值与 Lark 配置状态；PRD 删除线中的测试告警不作为当前必做 |
| Polymarket 私钥配置 | 保留 legacy | G2 确认本期不迁移 `/polymarket_config` |

> 路由名、菜单名和权限码需 G2 确认；若 legacy 菜单进入 Next 路由，必须同步 legacy router redirect 配置。

## Admin 实现锚点

| 能力 | 已确认参考 | 后续实现约束 |
|------|------------|--------------|
| 普通列表页 | `apps/admin/src/apps/ThirdPartyOrders/index.tsx`：`SearchForm` + `Table` + `Space` | 订单、仓位、收入明细优先沿用该结构 |
| 统计列表页 | `apps/admin/src/apps/ThirdPartySummary/index.tsx` | 每日收入统计可复用搜索 + 表格 + 导出按钮布局 |
| 风控配置 + 修改记录 | `apps/admin/src/apps/ThirdPartyRisk/index.tsx`：主配置表 + `Block` 包裹修改记录 | 告警配置优先拆成当前配置和修改记录两块 |
| 高风险/冲正流程 | `apps/admin/src/apps/MerchantReversalForm/index.tsx` | 手动平账需确认订单、二次确认、loading 和失败态 |
| 路由命名 | `apps/admin/src/constants/routes.ts` 已有 `thirdParty*` 系列 | 预测市场建议统一 `prediction*` key，pathname 用 `/prediction/...` |
| 菜单挂载 | `apps/admin/src/constants/siderItems.ts` 三方交易组位于 `thirdParty*` | 预测市场可独立组或挂交易管理，等 G2 菜单确认 |

## 分层方案

```text
Admin route page
  ↓
Prediction admin container
  ↓
Ant Design tables / forms / modals
  ↓
formatter / mapper / validators / route helpers
  ↓
services/api/prediction + schema + React Query
```

## 复用候选

| 能力 | 候选路径 | 用法 |
|------|----------|------|
| 列表页结构 | `apps/admin/src/apps/ThirdPartyOrders`、`FutureOrder`、`TrialBalanceCreateOrder` | 搜索表单 + 表格 + 导出模式参考 |
| 统计页结构 | `apps/admin/src/apps/ThirdPartySummary`、`PlatformAssetsAccount` | KPI / 汇总表 / 导出参考 |
| 告警配置 | `apps/admin/src/apps/ThirdPartyRisk`、`ChargeRisk` | 阈值配置和修改记录 UI 参考 |
| 高风险操作 | `apps/admin/src/apps/MerchantReversalForm`、`Asset*Edit` | 平账确认、策略配置、日志列表参考 |
| Admin 路由/菜单 | `routes.ts`、`siderItems.ts`、`permission.ts` | 新增菜单、权限、页面路径 |
| Web 用户侧 | 当前 worktree 仅找到 `apps/web/src/apps/Marketing/WorldCup/**` 和 `/world-cup` route | F01/F07 开发前需确认一期 Prediction 代码来源或新实现落点 |
| Web API | 当前 worktree 仅找到 `apps/web/src/services/api/marketing/worldCup.ts`，未找到 `prediction/**` / `predict/**` | 不按缺失路径开发；等待代码来源或 API 落点确认 |
| legacy Polymarket 配置 | `apps/admin/legacy-admin/src/views/exchangeTradeConfig/contractTrading/polymarket_config.vue` | 私钥、钱包、Relayer API Key 配置参考；G2 确认保留 legacy |
| 多语言弹窗 | 待进一步搜索现有内容配置模块 | 分类/事件名称多语言配置复用 |

## 数据与状态

- 列表 / 详情 / 配置读取默认走 React Query。
- 表单编辑状态使用 Ant Design Form 本地状态；不要把服务端详情复制进 Zustand。
- API DTO 经 mapper 转成 UI model 后给表格/表单使用。
- 金额、比例、份额、精度、毛利、费率和状态映射必须放纯函数，优先补测试。
- 手动平账 mutation 必须有二次确认、loading、失败态和不可重复提交保护。
- 导出按钮应复用现有 Admin 导出模式；若后端返回文件流，保留当前筛选条件并记录文件名规则。

## Mock / API 策略

- YApi 已提供后，真实路径以 `inbox/yapi/` 和 `product/12-yapi-api-integration.md` 为准；带时间戳后缀路径必须等后端确认稳定后再固化。
- mock fixture 放源码或 Admin mock API，不从 `docs_tdd` 运行时读取；mock-first 保留为无权限 / 无环境时的兜底。
- 每个模块至少定义正常、空态、错误、权限/禁用、边界数据场景。

## 风险

| 风险 | 影响 | 处理 |
|------|------|------|
| Web 用户侧代码基线缺失 | F01/F07 虽已确认 Web 本期做，但当前 worktree 未找到一期 Prediction 路径 | 先继续 Admin mock-first；Web 开发前需确认代码来源、分支或新落点 |
| YApi 已提供但真实环境 / 权限 / 路径稳定性未确认 | real-mode 页面级验收无法完成，高风险 mutation 不能直接放开 | 继续向后端确认 permission code、测试账号、错误码、字段精度和带时间戳路径是否最终稳定 |
| 权限码未提供 | 菜单和操作按钮权限无法最终落地 | 需后端 / legacy 菜单提供权限码 |
| 手动平账高风险 | 误操作可能影响链上头寸 | 需要权限、二次确认、审计、失败重试边界 |
| Lark webhook 敏感配置 | 不能暴露 webhook/secret | 只展示配置状态或脱敏摘要，真实密钥不进前端 |
| Polymarket 私钥配置 | legacy 页面可提交 privateKey / Relayer API Key | 是否迁移到 Next Admin 需先确认安全、权限和脱敏边界 |

## 开发前检查清单

- `routes.ts`：已新增 `predictionDailyIncome`、`predictionCategories`、`predictionEvents`、`predictionOrders`、`predictionPositions`、`predictionReconciliation`、`predictionAlerts` 等 key。
- `siderItems.ts`：已按 G2 新增独立预测市场菜单组；icon / 后端权限 code 待后端菜单数据补齐。
- `permission.ts`：当前为 `prediction.market.*` 占位枚举；后端正式 code 提供后必须替换。
- Route files：每个 `page.tsx` 保持薄层，只渲染对应 `apps/admin/src/apps/Prediction*/...` container。
- i18n：只补 `zh-CN` 的 `sider.json`、`title.json` 和页面文案；不手动改其他语言。
