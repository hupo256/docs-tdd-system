# PR-02006 工程规则

> **适用范围**：TradFi Header 浮层、交易页交易对弹层、TradFi 落地页、行情页 TradFi 板块，以及待确认的 Admin 币种别名多语言配置。公共规则继承 [`../../../common/README.md`](../../../common/README.md)，本文只写当前项目特殊约束。

## 当前项目约束

- `product/00-feature-inventory.md` G2 未定稿前，不进入 `apps/web/src/**`、`apps/admin/src/**` 或 legacy Admin 实现。
- Futures 交易页 MarketList 属于高风险交易入口，改动需同时验证 section tab、symbolTag tab、搜索、排序、点击切换交易对、弹层开关与当前 symbol 保持一致。
- TradFi 数据模型优先在 `apps/web/src/apps/TradFi/common/market.ts`、`types.ts` 收敛，避免 Header、Markets、落地页各自重复实现筛选和排序。
- 24h 成交额排序必须使用数值字段排序，展示格式单独 formatter；空值沉底并有明确展示。
- 币种别名必须按当前语言展示，不能在组件里硬编码中文别名；API 未确认前只写文档和 mock 假设。
- Admin 多语言别名涉及权限、语言配置和保存校验，需确认页面落点与接口字段后再实现。
- PRD 明确 H5 也需要处理，所有 Web 展示项必须覆盖 390px 验证。

## 建议模块边界

| 模块 | 建议目录 | 说明 |
|------|----------|------|
| TradFi UI 模型 | `apps/web/src/apps/TradFi/common/*` | alias、turnover24h、排序、filter、formatter |
| TradFi 落地页 | `apps/web/src/apps/TradFi/components/TradFiAssetSection.tsx` 及拆分子组件 | 当前文件较大，若继续膨胀需拆列配置 / row / card |
| 行情页 TradFi | `apps/web/src/apps/Markets/components/MarketTradFi` | 复用 TradFi UI 模型 |
| 交易页弹层 | `apps/web/src/apps/Futures/components/MarketList` | 保持 Futures 业务状态不双写 |
| Header 浮层 | `apps/web/src/components/layout/Header/PageEntries` | 优先复用现有 FuturesMarketList 或抽轻量 TradFi 浮层 |
| Admin 币种配置 | 待定位 | 遵守 Admin UI Guidelines，避免大卡片和营销样式 |

## 测试与验证重点

- 纯函数：Tab 构造、搜索过滤、成交额排序、三态排序、别名 fallback、格式化。
- Web UI：Header 浮层、交易页弹层、`/tradfi`、`/markets/tradfi`。
- 响应式：桌面 + 390px H5。
- 主题：dark / light。
- Futures 回归：点击交易对后 symbol 切换正确，弹层关闭，当前订单/图表主链路不受影响。
- Admin：归属板块切换、多语言输入、失焦校验、保存校验、权限态。

## 规则继承检查

| 项 | 结论 |
|----|------|
| 已读公共规则入口 | 是，见 `../../../common/README.md` |
| 已对照最近成熟项目 | 是，`PR-01988/engineering/development-rules.md` |
| 是否发现需新增到 common 的通用规则 | 暂无 |
| 薄包装检查 | 已通过；本文只写项目差异 |
