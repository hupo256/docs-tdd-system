# PR-02006 Technical Design

## 现有代码落点

| 范围 | 当前落点 | 初步判断 |
|------|----------|----------|
| Header 合约交易菜单 | `apps/web/src/components/layout/Header/PageEntries/SubEntry.tsx`、`FuturesMarketList` | 已能 hover 子菜单；TradFi 入口目前只 prime 交易页弹层 |
| 交易页交易对弹层 | `apps/web/src/apps/Futures/components/MarketList` | 已有 section Tab、搜索、排序和列表；缺 TradFi 二级分类 Tab、24h 成交额列、hover 触发调整 |
| TradFi 落地页 | `apps/web/src/apps/TradFi` | 已有资产列表、Tab、分页、价格/涨跌排序；缺别名、永续标签、24h 成交额列、高低价排序 |
| 行情 TradFi | `apps/web/src/apps/Markets/components/MarketTradFi` | 已复用 TradFi 数据模型；缺附属文案标签和 logo 样式优化 |
| 数据模型 | `apps/web/src/apps/TradFi/common/market.ts`、`types.ts` | `TradFiAsset` 需扩展别名、成交额、永续标签等字段 |
| Admin | `apps/admin` 待定位具体 legacy / Next 配置页 | 需确认是否本期前端同做，以及接口与权限边界 |

## 数据模型建议

`TradFiAsset` 建议补充以下 UI 字段，全部由 mapper 收敛，组件不直接消费 DTO：

| 字段 | 来源假设 | 用途 | 待确认 |
|------|----------|------|--------|
| `aliasLabel` | 币种配置 `币种别名`，按当前语言返回 | 附属名称 / 附属文案标签、搜索匹配 | API 字段名、语言参数 |
| `turnover24h` | 交易页已有 24h 成交额 ticker 字段 | Header 浮层、交易页弹层、落地页列表、排序 | ticker 字段名与格式 |
| `perpetualLabel` | 行情 TradFi 板块已有「永续」逻辑或 contractType | 落地页新增永续标签 | 是否固定文案或接口字段 |
| `sectionId` / `sectionName` | `public_info.configSectionList` + contract sectionIds | 交易页板块 Tab | 已有，需隐藏空板块 |
| `tagId` / `tagLabel` | contract `symbolTag` / 后台 TradFi 标签 | 分类 Tab | 标签名称是否需多语言 |

## 排序与筛选

- Header TradFi 浮层：默认按 `turnover24h` 降序；分类 Tab + 关键词同时过滤；重新 hover 初始化为全部 + 空关键词。
- 交易页弹层：板块 Tab 与 TradFi 分类 Tab 共同过滤；新增 24h 成交额排序，三击循环为降序 → 升序 → 默认，且同一时刻只允许一个字段排序。
- 落地页：现有 `sortTradFiAssets` 需扩展 `volume24h/high24h/low24h` 等 key；分页切换不得出现自动跳转或异常滚动。

## Mock-first 边界

若 API 未 ready，可以先扩展 `apps/web/src/apps/TradFi/common/public-info.mock.json` 和 mock ticker，但运行时 mock 必须在源码或 public 目录，不依赖 `docs_tdd`。

## 高风险点

- Futures 交易页是高风险业务面，MarketList 改动需同时验证 symbol、section、tab、sort、search、点击切换交易对。
- 成交额排序必须处理空值、字符串数值、单位格式化和实时 ticker 更新。
- Admin 多语言别名涉及后台语言配置、必填校验和前台语言参数，需后端契约确认后再编码。
