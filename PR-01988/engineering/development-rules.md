# PR-01988 工程规则

> **适用范围**：预测市场二期涉及的 `apps/admin` 后台页面、服务 API、路由菜单权限，以及待确认的 `apps/web` 用户侧埋点 / 交易禁用态。  
> **继承关系**：先读 [`../../common/README.md`](../../common/README.md)。本文只写当前项目特殊约束，不复制公共规则全文。

## 当前项目约束

- `product/00-feature-inventory.md` G2 未定稿前，不进入 `apps/admin/src/**` 或 `apps/web/src/**` 实现。
- 当前 worktree 未找到 Web `Prediction` 代码路径；Web F01/F07 开发前需确认一期代码来源、是否在其他分支，或是否从当前 WorldCup / marketing 结构补新实现。
- Admin 页面遵循现有 Ant Design 后台风格：紧凑、功能优先、克制，不做营销视觉。
- 新增 Admin 路由若从 legacy 菜单进入，必须同步 legacy route 与 redirect 配置。
- Admin 新页面必须同步 pathnames、siderItems、permission、page route、zh-CN 文案；权限码待后端确认。
- 手动平账、关闭交易、删除分类、测试告警等高风险操作必须二次确认，mutation 防重复提交。
- Lark webhook / secret / token 不得明文回显；前端是否保存 secret 需安全确认。
- legacy 已有 Polymarket 私钥配置页 `/polymarket_config`，包含 privateKey、funderAddress、relayerApiKey；迁移前必须确认安全、权限和脱敏边界。
- 财务金额、PM fee、Gas、rate、份额、毛利等必须统一 formatter 和精度策略，不在 JSX 中散写计算。

## 建议模块边界

| 模块 | 建议目录 | 说明 |
|------|----------|------|
| Admin 页面容器 | `apps/admin/src/apps/PredictionMarket*/` | 具体命名 G2 确认 |
| Admin 路由 | `apps/admin/src/app/[lang]/(dashboard)/(main)/(sider)/prediction/**/page.tsx` | route file 保持薄层 |
| API service | `apps/admin/src/services/api/prediction*.ts` | schema / mapper 与 UI 分层 |
| 工具函数 | 模块内 `utils/` | 金额、费率、状态、hash 链接、导出参数 |
| 类型 | 模块内 `types.ts` 或 `apps/admin/src/types/` | 共享范围足够大再上移 |
| Web 埋点 | 待确认；当前 worktree 未找到 `apps/web/src/apps/Prediction/**` | 列表曝光、详情点击、买入/卖出、FAQ 点击；开发前确认一期代码来源或新落点 |
| legacy 配置 | `apps/admin/legacy-admin/src/views/exchangeTradeConfig/contractTrading/polymarket_config.vue` | G2 确认保留 legacy，本期不迁移 |

## 复用优先

- 列表页优先参考 `FutureOrder`、`ThirdPartyOrders`、`TrialBalanceCreateOrder`。
- 告警配置优先参考 `Warning`、`ThirdPartyRisk`、`ChargeRisk`。
- 高风险操作和策略记录优先参考 `Asset*` 做市/策略模块。
- 不复制大段表格或搜索表单；字段差异大时抽局部 helper。

## 测试与验证重点

- 纯函数：收入/成本/毛利、PM fee、rate、份额差异率、订单/仓位状态 mapper。
- Admin UI：筛选、导出、分页、空态、错误态、权限态、二次确认、mutation loading。
- Web 埋点：点位触发不影响交易主链路；失败不阻断用户操作。
- 高风险：手动平账必须确认不会产生用户订单，且操作留痕字段完整。
- 敏感配置：Polymarket privateKey / Relayer API Key / Lark webhook secret 不得在列表、日志、截图或通知中泄露。

## 规则继承检查

| 项 | 结论 |
|----|------|
| 已读公共规则入口 | 是，见 `../../common/README.md` |
| 已对照最近成熟项目 | 是，`PR-01973/engineering/development-rules.md` |
| 是否发现需新增到 common 的通用规则 | 暂无 |
| 薄包装检查 | 已通过；本文只写项目差异 |
