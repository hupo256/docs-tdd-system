# 03 — API 契约

> **状态**：已根据 PRD、现有项目逻辑和 `inbox/public_info.json` 完成数据链路确认；主数据源为老的 futures 公共信息 + futures ticker / kline。  
> **规则**：API 样例或负责人确认到位后，先更新本文件，再进入 service、schema、mapper 和 mock 实现。  
> **当前判断**：TradFi 不需要新增接口；从老接口中筛 `TradFi` 板块，再复用现有 futures 行情链路即可。当前 `public_info` 样例已确认 section id、`NVDAUSDT` 路由参数和 `stock/spot/futures` 标签返回值。

## 0. 代码反查结论（2026-06-09）

| PRD 能力 | 已找到的现有逻辑 | 结论 |
|----------|------------------|------|
| TradFi 板块 | `usePublicInfoQuery()` 返回 `configSectionList[]`；`MarketList/index.tsx` 已用它生成合约板块 Tab，并用 `contractList[].sectionIds` 过滤 | **主板块很可能就是 `configSectionList[].section === 'TradFi'`** |
| TradFi 交易对列表 | `public_info` 返回 `contractList[]`；`ProcessingPublicInfoData` 会写入 `useContractListStore` | **资产基础数据来自 `contractList[]`** |
| 股票 / 贵金属 / 商品分类 | `contractList[].symbolTag` schema 为 `spot | futures | stock`；`Futures/MarketList/List.tsx` 映射到 i18n | **现有字段已覆盖 PRD 分类：`stock=股票`、`spot=贵金属`、`futures=商品`** |
| 交易对展示名 | `contractOtherName` 在 Futures/Markets 多处作为展示名 | **资产名 / 交易对展示优先取 `contractOtherName`** |
| 交易页跳转 | `FUTURES.replace('[symbol]', contractName)` 在 Futures market list 和委托列表中已使用 | **跳转不要自己拼 symbol，优先使用 `contractName`** |
| 实时价格 / 涨跌 / 高低 | `useFuturesTicker` + `futuresTickerStore`，key 为 `subSymbol` | **行情字段复用 ticker：`close`、`rose`、`high`、`low`** |
| 迷你走势 | `MarketTable/TrendCell` 对 futures 使用 `useFuturesKlineData(subSymbol.toLowerCase())` + `MiniChart` | **走势复用 futures kline + MiniChart** |
| logo / 价格精度 / 默认排序 | `coinResultVo.icon`、`coinResultVo.symbolPricePrecision`、`sort` | **均已在 old public info 中存在** |

关键代码位置：

```text
apps/web/src/services/api/common/public-info.ts
apps/web/src/apps/Futures/components/FuturesProcessingPublicData/ProcessingPublicInfoData.tsx
apps/web/src/apps/Futures/store/contractListStore.ts
apps/web/src/apps/Futures/components/MarketList/index.tsx
apps/web/src/apps/Futures/components/MarketList/List.tsx
apps/web/src/apps/Futures/store/futuresTickerStore.ts
apps/web/src/utils/ws/useFuturesTicker.ts
apps/web/src/apps/Markets/components/MarketTable/components/TrendCell/index.tsx
apps/web/src/apps/Home/hooks/useKlineData.ts
```

当前 `public_info` 已确认：

- `configSectionList` 中 TradFi 的真实 `id=1`，展示文案为 `TradFi`。
- TradFi 合约的 `sectionIds` 都包含 `1`。
- `NVDAUSDT` 对应合约为 `contractName=E-NVDA-USDT`、`contractOtherName=NVDAUSDT`、`subSymbol=e_nvdausdt`、`symbolTag=stock`。
- 当前样例覆盖 `stock / spot / futures` 三类标签。若后台未来新增任意标签值，再放宽 schema / mapper。

## 0.1 `public_info.json` 样例分析（2026-06-10）

输入文件：

```text
apps/web/docs_tdd/PR-01973/inbox/public_info.json
```

确认项：

| 项 | 样例结果 | 结论 |
|----|----------|------|
| 外层结构 | `{ code, msg, data, succ }` | 实际业务字段在 `data` 下；现有请求层可能已做 response unwrap，编码前需按项目 `getQuery` 习惯确认 |
| `configSectionList` | 存在且只有 1 个 `section: "TradFi"`，`id=1` | TradFi section 可从老接口唯一读取 |
| `contractList[].sectionIds` | TradFi 命中合约均包含 `1` | 可用于筛选 TradFi section 下合约 |
| `contractList[].symbolTag` | TradFi 命中项覆盖 `stock / spot / futures` | 分类字段满足当前 PRD：股票 / 贵金属 / 商品 |
| `contractName` / `contractOtherName` / `subSymbol` | 存在；`NVDAUSDT` 命中 `E-NVDA-USDT` / `e_nvdausdt` | 跳转、展示和 ticker/kline key 所需字段具备 |
| `coinResultVo.icon` / `symbolPricePrecision` / `sort` | 存在 | logo、价格精度、默认排序所需字段具备 |

样例统计：

| 项 | 值 |
|----|----|
| `configSectionList` 数量 | 1 |
| TradFi section | `id=1` / `section=TradFi` |
| `contractList` 总数 | 179 |
| TradFi 命中合约数 | 17 |
| 标签覆盖 | `stock`、`spot`、`futures` |
| 默认合约 | `NVDAUSDT` 已命中 |

当前样例命中的 TradFi 合约：

| 分类 | 合约 |
|------|------|
| 股票 `stock` | `MSFTUSDT`、`SNDKUSDT`、`INTCUSDT`、`AMZNUSDT`、`NVDAUSDT`、`AAPLUSDT`、`SPCXUSDT`、`TSLAUSDT`、`JPMUSDT`、`CRCLUSDT`、`ORCLUSDT` |
| 贵金属 `spot` | `XAGUSDT`、`XAUUSDT`、`XPTUSDT` |
| 商品 `futures` | `NATGASUSDT`、`CLUSDT`、`BZUSDT` |

当前实现策略：

- 代码按已确认规则实现 mapper：从 `configSectionList` 找 TradFi section，再通过 `sectionIds` 过滤合约。
- 当前样例只有一个 TradFi section；代码仍保留合并同名 section id 的防御策略，以兼容后台误配。
- 默认交易对 `NVDAUSDT` 已命中；正式跳转使用 `contractName=E-NVDA-USDT`。
- `symbolTag` 当前可按 `stock | spot | futures | null | ""` 处理；若后续新增任意标签，再放宽 schema。
- `public_info` 已足够支撑落地页静态配置、资产列表、分类、logo、精度、排序和跳转。最终行情验收还需要 ticker / kline WS 的真实消息或在线联调。

## 0.2 当前样例是否够用

| 场景 | 是否够用 | 说明 |
|------|----------|------|
| 顶部导航 / 落地页路由 | 是 | 不依赖接口 |
| TradFi 板块筛选 | 是 | `configSectionList` 唯一 `TradFi id=1` |
| 可交易资产列表 | 是 | 17 个 TradFi 合约，`sectionIds` 均可关联 |
| 分类 Tab | 是 | 已覆盖 `stock` / `spot` / `futures` |
| 默认 CTA / 合约下拉入口 | 是 | `NVDAUSDT` 已命中，交易 path 使用 `E-NVDA-USDT` |
| logo / 价格精度 / 默认排序 | 是 | `coinResultVo.icon`、`symbolPricePrecision`、`sort` 均存在 |
| 最新价 / 24h 涨跌 / 高低 | 需要 WS 联调 | 依赖 `market_${subSymbol}_ticker` 推送 |
| 迷你走势 | 需要 WS 联调 | 依赖 `market_${subSymbol}_kline_60min` request 返回 |

结论：`public_info.json` 对 PR-01973 的**配置和列表数据已经够用**。后续只需要拿真实 ticker / kline WS 消息样例，或直接通过环境联调验证行情刷新。

## 0.3 Mock 兜底与真实接口验证策略（2026-06-11）

PR-01973 当前环境策略：

- local / dev / test 固定使用可发布的 mock public_info，运行时 fixture 位于 `apps/web/src/apps/TradFi/common/public-info.mock.json`。
- `apps/web/docs_tdd/PR-01973/inbox/public_info.json` 只作为开发文档样例源，不参与发布运行时读取。
- pre / prod 使用真实 `/fe-co-api/common/futures/public_info`，不以 mock 作为验收依据。
- 启用 mock public_info 时，同步将 mock `contractList` 写入现有合约 store，保证 ticker 订阅链路能按 TradFi `subSymbol` 工作。
- 价格、24h 涨跌、24h 高低优先使用真实 futures ticker store；若 mock 环境缺 WS 行情，则用稳定 mock ticker 补齐，保证页面可验收完整 UI。
- 迷你走势优先真实 kline；本地样例无 kline 时允许使用 mock 点位兜底。

联调验收基线：

- 真实接口返回 1 个 `TradFi` section。
- 命中 17 个 TradFi 合约。
- 分类覆盖：`stock=11`、`spot=3`、`futures=3`。
- 默认 CTA 可匹配 `E-NVDA-USDT`。
- ticker store 能按 `subSymbol` 命中价格、涨跌、高低。

2026-06-11 dev 真实接口验证：

- 请求 `https://futures.pfyys.com/fe-co-api/common/futures/public_info` 成功，`code=0`。
- `configSectionList` 当前只有 `AA / CC / bb`，没有 `TradFi`。
- 关闭 mock 观察时，当前 dev 真实接口下 TradFi 合约数为 0，页面会显示资产空态；这说明目标环境需要后台补 TradFi section 与合约归属后再验收真实行情。
- 由于 local / dev / test 仍需要可用页面，本次不删除 mock 兜底。

## 1. 当前代码中的可复用数据

### 1.1 合约公共信息

来源：

```text
apps/web/src/services/api/common/public-info.ts
usePublicInfoQuery()
POST /fe-co-api/common/futures/public_info
```

已知字段：

| 字段 | 说明 | PRD 映射 |
|------|------|----------|
| `contractList[].symbol` | 合约 symbol | 交易对 |
| `contractList[].contractName` | 交易页路由参数 | 交易页跳转 |
| `contractList[].contractOtherName` | 现有 Futures 展示名 | 资产名称 / 交易对展示 |
| `contractList[].subSymbol` | ticker / kline key | 行情订阅 |
| `contractList[].sort` | 后台排序 | 默认排序 |
| `contractList[].coinResultVo.icon` | 币种图标 | logo |
| `contractList[].coinResultVo.symbolPricePrecision` | 价格精度 | 最新价 / 24h 高低 |
| `contractList[].symbolTag` | 合约品种标签 | 股票 / 贵金属 / 商品 |
| `contractList[].sectionIds` | 所属板块 id | 过滤 TradFi 板块 |
| `configSectionList[].section` | 板块名称 | TradFi 板块 |

风险：

- 当前 schema 中 `symbolTag` 枚举为 `spot | futures | stock`，现有 i18n 已映射为「贵金属 / 商品 / 股票」。这与当前 PRD 标签一致。
- PRD 又要求标签动态新增 / 减少；如果后续后台会返回新增标签值，schema 需要放宽为字符串并在 mapper 收敛。
- Figma/PRD 对导航和文案存在 `TradFi` / `TradeFi` 差异；当前接口 section 名称为 `TradFi`。

### 1.2 合约 ticker

来源：

```text
apps/web/src/apps/Futures/store/futuresTickerStore.ts
useFuturesTicker()
```

已知字段：

| 字段 | 说明 | PRD 映射 |
|------|------|----------|
| `close` | 最新价 | 最新价格 |
| `rose` | 涨跌幅 | 24h 涨跌 |
| `high` | 高点 | 24h 最高 |
| `low` | 低点 | 24h 最低 |
| `amount` | 成交额 | PRD 不展示，可不用 |

风险：

- TradFi 合约已有 `subSymbol`，理论上可进入现有 futures ticker 订阅；最终仍需在线联调确认 WS 推送覆盖。
- ticker key 使用 `subSymbol`，不要用页面展示名或 `NVDAUSDT` 手拼。

### 1.3 迷你走势

来源候选：

```text
apps/web/src/apps/Markets/components/MarketTable/components/TrendCell/index.tsx
apps/web/src/apps/Home/hooks/useKlineData
```

已知能力：

- `TrendCell` 对 futures 使用 `useFuturesKlineData(symbol.toLowerCase())`。
- 使用 `MiniChart` 展示迷你走势。

风险：

- PRD 要求涨绿跌红，当前 `MiniChart` 的颜色规则需 Figma / 代码确认。
- 走势数据时间窗口、刷新频率待 API 确认。

## 2. 待 API 明确的能力

| 能力 | 说明 | 当前状态 |
|------|------|----------|
| TradFi 板块识别 | 从 `configSectionList` 找 TradFi section，再用 `sectionIds` 过滤 | ✅ 样例确认：`section=TradFi`、`id=1` |
| TradFi 标签列表 | 当前复用 `symbolTag`：`stock` / `spot` / `futures` | ✅ 样例确认覆盖三类；未来动态新增仍需兼容 |
| TradFi 交易对列表 | 从 TradFi section 下的 `contractList` 派生 | ✅ 样例确认 17 个合约 |
| 实时行情 | 当前价格、24h 涨跌、24h 高低、精度 | 复用 ticker |
| 迷你走势 | Banner 卡片和列表走势数据 | 复用 futures kline |
| 搜索 | PRD 5.5 行情板块搜索的数据范围和字段 | 当前阶段不做独立 5.5；若恢复该模块再确认 |
| 交易页跳转 | 使用 `contractName` 替换 `/swap/[symbol]` | ✅ 样例确认：`NVDAUSDT` → `E-NVDA-USDT` |
| 合约交易下拉入口 | 标题 / 副标题为静态文案，目标复用默认 TradFi 交易对 | PRD 0610 验收项；交易页 tab 定位用现有 store 状态 |

## 3. UI 需要的数据模型

```ts
export type TradFiTagDto = {
  id: string
  name: string
  sort?: number
}

export type TradFiAssetDto = {
  id: string
  symbol: string
  tradeSymbol: string
  displayName: string
  assetName?: string
  tagId: string
  tagName: string
  iconUrl?: string
  sort: number
  pricePrecision: number
}

export type TradFiTickerDto = {
  symbol: string
  close: number | null
  rose: number | null
  high: number | null
  low: number | null
}

export type TradFiTrendDto = {
  symbol: string
  points: number[]
}
```

> 上述 DTO 是前端 UI 模型草案，不代表后端字段。实现时由 `public_info` + ticker + kline 映射而来。

## 4. Mapper 要求

`mapTradFiMarketData` 需要输出稳定 UI 模型：

| UI 字段 | 来源候选 | 兜底 |
|---------|----------|------|
| `id` | contract id / symbol | symbol |
| `symbol` | `symbol` / `contractOtherName` | `--` |
| `displaySymbol` | `contractOtherName` | 格式化 symbol |
| `tradeSymbol` | `contractName` | 不建议手拼 |
| `assetName` | API 字段 / display name | display symbol |
| `tagId` | `symbolTag` / tag id | `unknown` |
| `tagLabel` | `symbolTag` i18n / API 标签名 | `--` |
| `iconUrl` | `coinResultVo.icon` | 默认币种图 |
| `price` | ticker `close` | null |
| `change24h` | ticker `rose` | null |
| `high24h` | ticker `high` | null |
| `low24h` | ticker `low` | null |
| `trend` | kline close list | [] |
| `sort` | contract `sort` | 原始 index |

## 5. Mock 场景

当前 `public_info` 已覆盖基础 Mock 场景；如需要独立 Mock，至少覆盖：

| 场景 | 覆盖 |
|------|------|
| 默认数据 | 全部 / 股票 / 贵金属 / 商品，含 `NVDAUSDT`（当前样例已覆盖） |
| 动态新增标签 | 新增标签 `123` 后 Tab 自动展示 |
| 标签减少 | 仅返回股票时，只展示全部 / 股票 |
| 正涨跌 | 绿色涨跌幅、绿色走势 |
| 负涨跌 | 红色涨跌幅、红色走势 |
| 空行情 | 价格 / 高低 / 涨跌展示 `--` |
| 无走势 | MiniChart 空态不破版 |
| 空列表 | 可交易资产空态 |
| 排序 | 最新价 / 涨跌互斥三态 |
| H5 | 卡片 / 列表移动端布局 |

## 6. 待确认清单

| ID | 待确认项 | 影响 |
|----|----------|------|
| A1 | TradFi section 的真实 id / 文案 | ✅ 已确认：`id=1`、`section=TradFi` |
| A2 | `NVDAUSDT` 样例的 `contractName` / `subSymbol` / `symbolTag` | ✅ 已确认：`E-NVDA-USDT` / `e_nvdausdt` / `stock` |
| A3 | `symbolTag` 是否会扩展为任意字符串 | 当前样例为 `stock/spot/futures`；未来后台新增标签时再放宽 schema |
| A4 | 后端是否返回标签展示名和排序 | 当前样例无独立标签名；分类名走前端映射，资产默认排序走 `contractList[].sort` |
| A5 | 5.5 搜索字段和是否需要接口搜索 | ✅ D2：当前阶段不做独立 5.5，暂关闭；恢复时重开 |
| A6 | API 返回的默认排序字段是否仍为 `sort` | ✅ 已确认：使用 `contractList[].sort` |
| A7 | 合约交易下拉入口点击后，交易页 TradFi tab 定位用 path、query 还是现有 store 状态 | ✅ 已确认：用现有 store 状态定位，不新增 path / query 协议 |
| A8 | ticker / kline WS 是否覆盖全部 TradFi `subSymbol` | 待在线联调或补 WS 消息样例 |
