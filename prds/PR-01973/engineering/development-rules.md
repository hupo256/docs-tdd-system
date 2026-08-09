# TradFi 落地页模块开发规则

> **适用范围**：后续 `apps/web/src/apps/TradFi/`、`apps/web/src/services/api/tradfi/`、顶部导航 TradFi 入口、合约交易下拉 TradFi 入口。  
> **状态**：当前 PR-01973 代码实现和后续 refactor / 自测规则。公共规则先读 [`../../../common/README.md`](../../../common/README.md)。
> **继承关系**：本文只写 TradFi 项目特殊约束；若与 `common/` 冲突，以 `common/` 为准。

## 1. 开发入口

开发前必须先确认：

1. `product/01-scope-and-phases.md`：范围、不做项、验收标准、待确认项。
2. `product/02-technical-design.md`：路由、目录、数据流、复用候选。
3. `product/03-api-contract.md`：API 字段、schema、mapper、刷新策略。
4. `product/04-frontend-tasks.md`：任务清单与开发顺序。
5. `product/05-ui-and-interaction.md`：模块、交互、H5、多语言。
6. `product/07-figma-spec.md`：Figma 规格。

未确认文档前，不写业务代码。

## 2. 架构分层

必须保持四层结构：

```text
Route
  ↓
TradFi page container
  ↓
TradFi UI domain model / components
  ↓
filters / sort / format / routeActions pure utilities
  ↓
services/api or existing market stores + mapper
```

规则：

- 路由文件只挂载页面组件，不承载业务逻辑。
- 组件不直接依赖 futures API DTO。
- 行情数据必须通过 TradFi mapper / selector 收敛成 UI 模型。
- 组件内禁止直接 `fetch`。
- API 未确认前不写死后端字段。
- Figma 未确认前不硬编码精确视觉规格。

## 3. 行情数据规则

- TradFi 资产来源优先复用现有 futures public info，但筛选和字段映射必须集中处理。
- TradFi 板块优先从 `configSectionList` 找 section，再用 `contractList[].sectionIds` 过滤；section id 不得写死。
- 当前 `public_info.json` 样例中 `TradFi` section 唯一且 `id=1`；代码不得写死该 id。若后续存在多个同名 `TradFi` section，开发期先合并全部同名 section id，同时记录数据配置风险。
- TradFi 分类优先使用 `contractList[].symbolTag`：`stock` 对应股票，`spot` 对应贵金属，`futures` 对应商品。
- 实时价格、24h 涨跌、高低优先复用现有 ticker store；若 API 另有说明，以 API 文档为准。
- ticker / kline key 必须使用 `contractList[].subSymbol`。
- 迷你走势优先复用现有 kline / `MiniChart` 能力；颜色和尺寸以 Figma 为准。
- ticker / kline 无数据时展示 `--` 或空图，不让布局跳动。
- 不在 UI 组件中直接读多个 store 拼业务字段；统一通过 hook 输出 `TradFiAsset[]`。

## 4. 分类、筛选、排序

分类：

- `全部` 是前端固定 Tab。
- 其他标签来自 API / 后台配置。
- 标签新增、减少时 UI 自动跟随。
- 标签映射逻辑放在 `buildTradFiTabs` 或 mapper 中。

排序：

- 只有最新价和 24h 涨跌可排序，除非产品后续确认更多字段。
- 排序状态必须互斥。
- 点击顺序必须与现有交易列表保持一致：默认 → 升序 → 降序 → 默认。
- 默认排序恢复 API `sort` 或原始顺序。
- 排序逻辑放纯函数，不散落在表头 JSX。

## 5. 跳转规则

- 所有 TradFi 交易跳转统一走 `buildTradFiTradePath`。
- Hero CTA、Banner 卡片、资产列表交易按钮、合约交易下拉 TradFi 入口必须复用同一个跳转方法。
- 交易页 path 参数优先使用 `contractList[].contractName`，并通过 `FUTURES.replace('[symbol]', contractName)` 生成。
- 不允许从 `NVDAUSDT`、`contractOtherName`、`symbol` 手拼 `/swap/E-*-USDT`。
- 默认交易对优先匹配 `NVDAUSDT`；当前样例已确认真实 path 为 `E-NVDA-USDT`。若后续环境未命中，代码需降级到 TradFi 列表第一个可交易合约。
- 未登录 CTA 跳登录，建议携带 from 回跳。
- 顶部一级导航只负责进入 `/tradfi` 落地页；合约交易下拉 TradFi 入口直接进入交易页并定位 TradFi tab，二者不要混用。
- 交易页 TradFi tab 定位方式必须复用现有市场列表 store 状态；不得为本需求新增 path / query 协议。

## 6. UI 组件规则

通用组件体量、导出注释、短注释、Tailwind token、H5 与主题规则继承 [`../../../common/rules/development-rules.md`](../../../common/rules/development-rules.md)、[`../../../common/rules/ui-style-token-rules.md`](../../../common/rules/ui-style-token-rules.md) 和 [`../../../common/rules/quality-checklist.md`](../../../common/rules/quality-checklist.md)。本节只保留 TradFi 专有补充：

- 交易对卡片、Tab、FAQ、排序表头应有稳定尺寸，避免行情刷新造成布局抖动。
- 不复制现有 Markets 表格的大段代码；若复用成本高，抽 helper 或做 TradFi 专用小表格。

## 7. i18n

- TradFi 页面固定 UI 文案进入 `apps/web/src/i18n/locales/zh-CN/tradfi.json`。
- 新增 TradFi 文案前先搜索现有 namespace；如 `futures.MarketList.*`、`markets.trade`、`header.login`、`trade.orderList.table.*` 等已有精确文案，直接复用。
- 后台返回的交易对、资产名、行情、配置标签原始值等数据不重复进前端 i18n；前端仅翻译展示标签和固定 UI 文案。
- Header 文案进入 `header.json`。
- FAQ 固定文案进入 i18n，除非后续确认由后台配置。
- 其他语言处理方式继承公共 i18n 规则；本任务不手动新增、复制、同步或占位。

## 8. 测试与验证

通用 Biome、typecheck、Browser / Playwright、dark / light、390px H5 和 QA 用例处理规则继承 [`../../../common/rules/quality-checklist.md`](../../../common/rules/quality-checklist.md)。本节只列 TradFi 专有补充。

建议补纯函数测试：

- `buildTradFiTabs`
- `filterTradFiAssetsByTag`
- `sortTradFiAssets`
- `formatTradFiPrice`
- `formatTradFiChange`
- `buildTradFiTradePath`

UI 验证：

- 桌面首屏。
- 桌面资产列表排序。
- 桌面 FAQ。
- 390px H5 首屏和资产列表。
- CTA / 卡片 / 交易按钮跳转。
- 合约交易下拉入口展示、跳转和 TradFi tab 定位。

## 9. 交付前检查

- [ ] 文档已确认。
- [ ] 已继承 `docs_tdd/common/README.md` 的公共规则专题。
- [ ] API / Figma / QA 变化已回写 docs_tdd。
- [ ] 没有把 API DTO 直接传给 UI。
- [ ] 没有在组件内直接 fetch。
- [ ] 排序 / 筛选 / 跳转逻辑集中。
- [ ] 合约交易下拉入口未重复实现交易跳转逻辑。
- [ ] 桌面与 H5 已验证。
