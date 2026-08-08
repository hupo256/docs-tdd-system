# 03 — API 契约

> **模板**：`templates/03-api-contract-template.md`
> **配套规则**：
> - 字段命名默认贴合契约、四类改名例外：[architecture-and-state.md](../../../common/architecture-and-state.md) §3.1
> - 文案像接口 contract 一样管理：[architecture-and-state.md](../../../common/architecture-and-state.md) §7.1
> - 真实接口到位后的字段对账关卡：[architecture-and-state.md](../../../common/architecture-and-state.md) §8.1
> - 新功能 mock 强制 MSW 路线 B：[architecture-and-state.md](../../../common/architecture-and-state.md) §8.4.1
> **使用**：G1 复制到项目；**G3 补 Mock 场景和文案契约（← 本次 T01 填充）**；G5 联调时逐行更新 §5 字段对账并做减法。

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02074` 预测市场三期 |
| 契约来源 | ⚠️ 后端接口未 ready；三期接口按一期 Polymarket 风格推测（下方全部标 **ASSUMED**），真实 YApi 到位后按 §5/§8 对账 |
| 契约版本 | 一期基线：`docs/prediction/api-getTagEventsList.json` / `api-getEstimatedProfit.json`（已落库）|
| 前端 service 目录 | `apps/web/src/services/api/prediction/` |
| Mock 路线 | **MSW 路线 B（强制）**；handler：`apps/web/src/mocks/handlers/prediction.ts`；参考 PR-01947 实践 |
| 环境策略 | dev/test 可启 MSW；pre/prod 不注册 handler / worker；无 `USE_MOCK` 业务开关 |
| 待确认登记入口 | `06-collaboration.md §B`（B1-B7） |

## 0.1 MSW 落地前置（G3 必填）

| 项 | 需要落地的内容 |
|----|----------------|
| handler | `src/mocks/handlers/prediction.ts` 覆盖 normal / empty / error / unauthorized / edge 场景；每类事件至少覆盖单/多/比赛三形态 |
| schema | mock response 与真实 schema（`schemas.ts`）同链路，契约测试 `prediction.contract.test.ts` 复核 `schema.parse(mock)` 不抛错 |
| worker | `useMockWorker()` 仅 dev 启用（现有），`browser.ts` 注册三期 handler；确认 `Providers.tsx` 已挂 |
| 切真实 | 后端 ready 后按 handler 粒度删除 / 停用，`schemas.ts` / `mapper` / UI 类型保留 |

## 1. 接口清单

| ID | Method | Path | 用途 | 登录要求 | 状态 |
|----|--------|------|------|---------|------|
| A1 | POST | `/fe-ex-api/polymarket/getTagEventsList` | 按分类查事件列表（**一期已有，三期扩展** `tagType` 四类 + 二/三级 `tag`/`subTag` 过滤）| 未登录可看 | ASSUMED（扩展）|
| A2 | POST | `/fe-ex-api/polymarket/getCategoryTree` | 四大类的二/三级分类树（**新增，可选**）| 未登录可看 | ASSUMED（前端静态兜底优先，见 Q2）|
| A3 | POST | `/fe-ex-api/polymarket/searchEvents` | 搜索（模糊匹配 / 按展示语言 / 排序 / 分页 50/页）| 未登录可看 | ASSUMED（新增）|
| A4 | POST | `/fe-ex-api/polymarket/getEstimatedProfit` | 预计收益 + **手续费字段**（一期已有，三期补手续费展示字段）| 需登录 | ASSUMED（补字段）|
| A5 | POST | `/fe-ex-api/polymarket/getEventsById` | 单事件详情（一期已有，不改）| 未登录可看 | 已联调 |

## 2. 通用约定

| 项 | 契约口径 |
|----|---------|
| 网关前缀 | `/fe-ex-api/polymarket/`（沿用一期）|
| Header | `language`（决定翻译后文本 + 搜索匹配语言，F01/F21）、`Authorization`（下单/收益需登录）|
| 成功响应 | `code: "0"`、`data: object \| array \| null`；经 `getQuery` 的 `transfer` 用 `toCamel` + `schema.parse` |
| 失败响应 | `code` 非 `"0"`；前端展示 `msg`，列表走 `WorldCupListBoundary` 错误态 |
| 时间字段 | 毫秒时间戳（`endDateTmeUtc0`）；分页 `pageNum` / `pageSize` |
| 枚举编码 | `tagType` 小写英文（`crypto`/`politics`/`sports`/`finance`）；`tableType` 数字（1 比赛 / 2 事件）|

不一致或未确认项列入 §8，同步 `06-collaboration.md §B`。

## 3. 核心 DTO（ASSUMED，真实到位对账）

> 沿用一期 `polymarketTagEventSchema`。三期**不改现有字段**，仅在请求侧加过滤参数，响应侧加 `tagType`/`categoryLabel`（搜索/更多结果页卡片需要分类标签）。

### 3.1 `A1 GET getTagEventsList` 请求（扩展）

```ts
interface TagEventsListRequestDTO {
  pageNum: number
  pageSize: number
  // 一期：固定 'sports'；三期：四大类
  tagType: 'crypto' | 'politics' | 'sports' | 'finance'
  // 体育用：1 比赛 / 2 事件（F15）；非体育可省略
  tableType?: number
  // 二级分类 slug（如 'trump' / 'soccer' / 'stocks' / '5m'）；'全部'/'进行中' 不传或传固定 key
  tag?: string | null
  // 三级分类 slug（仅体育足球/篮球等有）；如 'premier-league'
  subTag?: string | null
  eventId?: string | number | null
}
```

> **进行中固定分类请求**：`tag='ongoing'` + `tableType=1`（仅比赛形态）。响应含 `matchStatus`(live/upcoming) 供前端拆两区块、`categoryGroupLabel` 供组头（见 §3.2）。

### 3.2 `A1` 响应（沿用一期 + 加分类标签）

```ts
// 沿用一期 tagEventsListResponseSchema：{ total, list: PolymarketTagEvent[] }
// PolymarketTagEvent 现有字段不变（id/eventId/title/icon/volume/markets/teams…）
// 三期新增（ASSUMED，供搜索/更多结果页卡片分类标签用）：
interface PolymarketTagEventExtraDTO {
  tagType?: 'crypto' | 'politics' | 'sports' | 'finance'  // 事件所属一级分类
  categoryLabel?: string  // 展示用分类标签文本（如 "Crypto"，已按 language 翻译）
  // ↓ 体育「进行中」固定分类专用（ASSUMED，待后端对账 B7）：
  matchStatus?: 'live' | 'upcoming'  // 区分「进行中」/「即将开始」两区块归属
  categoryGroupLabel?: string        // 聚合组头分类名（如 "足球 | 中超"，已按 language 翻译；前端直接渲染不拼接）
  // 即将开始区块日期分组依据：复用已有 endDateTmeUtc0 / kickoff UTC 毫秒
}
```

### 3.3 `A2 GET getCategoryTree` 响应（新增，可选）

```ts
interface CategoryNodeDTO {
  key: string          // 稳定 slug，用于 tag/subTag 过滤参数
  name: string         // 展示名（已按 language 翻译，F21）
  children?: CategoryNodeDTO[]
}
interface CategoryTreeResponseDTO {
  // 四大类，每类 children 为二级；体育二级下再有三级 children
  categories: CategoryNodeDTO[]
}
```

### 3.4 `A3 GET searchEvents` 请求/响应（新增）

```ts
interface SearchEventsRequestDTO {
  keyword: string
  pageNum: number   // 更多结果页 50/页
  pageSize: number
  // language 走 header；后端按展示语言标题匹配（F01）
}
interface SearchEventsResponseDTO {
  total: number
  // 复用事件结构 + 分类标签（F04 弹窗右侧占比%+方向、F05 卡片分类标签）
  list: PolymarketTagEvent[]  // 含 §3.2 tagType/categoryLabel
}
```

> **排序（F03）由后端保障**：①匹配字符数量 > ②首个匹配字符在标题中的位置。前端不重排，直接按返回顺序渲染（Q：若后端不排，前端 `sortSearchResults` resolver 兜底，见 T15）。

### 3.5 `A4 getEstimatedProfit` 响应（补手续费字段，F22/F23）

```ts
// 一期 estimatedProfitDataSchema：{ estimateProfitAmount, profitAmount, rate, multiplier }
// 三期补（ASSUMED，后端算前端只展示，公式仅备查）：
interface EstimatedProfitFeeExtraDTO {
  orderAmount?: string   // 买入：Polymarket 下单金额 = 下注金额×(1-加价率)-手续费扣除
  feeAmount?: string     // 交易手续费扣除
  receiveAmount?: string // 卖出：用户获得金额 = 链上卖出金额×(1-抽水比例)-手续费扣除
}
```

**手续费公式（PRD 原文，仅备查，前端不算）**：
- 买入：`下单金额 = 下注金额 × (1 - 加价率) - 手续费扣除`；`手续费扣除 = 输入金额 × feeRate × (1 - 预计成交价)`；`预计成交价 = 当前买入价格 × 1.05`
- 卖出：`获得金额 = 链上卖出金额 × (1 - 抽水比例) - 手续费扣除`；`手续费扣除 = 卖出份额 × feeRate × 成交价 × (1 - 成交价)`

## 4. UI 领域模型

沿用一期 `WorldCupMatch` / `WorldCupEventMarket`（`WorldCup/common/types.ts`）。三期新增：

```ts
// 单市场事件卡（政治/金融/加密：半环占比 + 是/否大按钮）
type SingleMarketView = {
  id: string
  title: string           // API 同名（已翻译）
  icon?: string           // API 同名
  probPct: number         // 类型变化：markets[0].outcomes.Yes.outcomePrice → 上涨占比%
  volumeUsd: string       // API volume 同名
  yesClobTokenId?: string
  noClobTokenId?: string
  categoryLabel?: string  // API 同名，搜索/更多结果页卡片标签
}

// 多市场事件卡（政治/金融：多行 [名称+占比%+是/否小按钮]，无半环）
type MultiMarketView = {
  id: string
  title: string
  icon?: string
  volumeUsd: string
  outcomes: WorldCupEventOutcome[]  // 复用一期，每行一个 market
  categoryLabel?: string
}
```

## 5. 字段对账表（Mock 阶段就建）

### 5.1 `SingleMarketView` ← `PolymarketTagEvent`（`A1`，markets 数 = 1）

| UI 字段 | mapper 取值 | 契约字段 | 改名类型 | 备注 |
|---------|-------------|---------|---------|------|
| `id` | `event.id` | `id` | 同名 | |
| `title` | `event.title` | `title` | 同名 | 已按 language 翻译 |
| `icon` | `event.icon` | `icon` | 同名 | 缺失不渲染 |
| `probPct` | `round(Number(markets[0].outcomes.Yes.outcomePrice)*1000)/10` | `markets{}.outcomes.Yes.outcomePrice` | 类型变化 | string 概率 → % 数值（沿用一期算法）|
| `volumeUsd` | `event.volume` | `volume` | 同名 | 缺失显 `--` |
| `yesClobTokenId` | `markets[0].outcomes.Yes.clobTokenId` | `markets{}.outcomes.Yes.clobTokenId` | 同名 | 下单用 |
| `noClobTokenId` | `markets[0].outcomes.No.clobTokenId` | `markets{}.outcomes.No.clobTokenId` | 同名 | 下单用 |
| `categoryLabel` | `event.categoryLabel` | `categoryLabel` | 同名 | 仅搜索/更多结果页展示；列表页不渲染 |

### 5.2 `MultiMarketView` ← `PolymarketTagEvent`（`A1`，markets 数 > 1）

| UI 字段 | mapper 取值 | 契约字段 | 改名类型 | 备注 |
|---------|-------------|---------|---------|------|
| `id` | `event.id` | `id` | 同名 | |
| `title` | `event.title` | `title` | 同名 | |
| `icon` | `event.icon` | `icon` | 同名 | |
| `volumeUsd` | `event.volume` | `volume` | 同名 | |
| `outcomes` | `mapTagEventToMarket(event).outcomes` | `markets{}` | 多字段合并 | 复用一期 `mapTagEventToMarket` 每行 market |
| `categoryLabel` | `event.categoryLabel` | `categoryLabel` | 同名 | |

**G5 联调收尾自检**：
- [ ] 表格所有 column、type 字段都在本表出现且改名类型非空。
- [ ] 无两个 UI 字段兜底到同一 `dto.xxx`。
- [ ] mock 阶段臆造、契约无来源的字段已删除（重点核 `tagType`/`categoryLabel`/`orderAmount`/`feeAmount`/`receiveAmount` 是否真存在）。

### 5.3 真实 fixture schema 对账（推荐）

- [ ] 后端 ready 后接入真实 fixture schema 对账测试；当前：**接口未 ready，无真实 fixture，暂不适用**。

## 6. Mock 场景矩阵

| 场景 | 说明 | Mock 触发 | 覆盖字段 |
|------|------|----------|---------|
| normal | 每类 2-3 条，覆盖单/多/比赛三形态 | MSW handler 按 `tagType`/`tableType` 返回 | 全字段有值 |
| empty | 空列表（如某二级分类无事件）| handler 按特定 `tag` 返回空 | `list: []`, `total: 0` |
| error | 后端错误 | handler 返回 `code != "0"` | `msg` 非空 |
| unauthorized | 未登录访问需登录接口（下单/收益）| handler 对 `order/market`·`getEstimatedProfit` 返回 401/鉴权错误码 | `code` 鉴权错误、`data: null`（列表/搜索未登录可看，不触发）|
| edge | 长标题 / 大成交量 / 概率极值(0%/100%) | handler fixture | 长文案、大数 |
| search-empty | 搜索无命中 | `searchEvents` keyword 无匹配 | `list: []` |

Mock response 必须过真实 `schema.parse`；新增 `prediction.contract.test.ts` 断言 handler response 与 `tagEventsListResponseSchema` / `searchEventsResponseSchema` 同源。

## 6.1 MSW 路线 B 清单（G3 建，G5 切真实）

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | `src/mocks/handlers/prediction.ts` 覆盖 normal / empty / error / edge / search-empty | 待填（T02）|
| 2 | service / hook / mapper / 组件无 `USE_MOCK` / `@mock-only` / `isMock` / mock import | 待填 |
| 3 | handler response 通过真实 schema 契约测试 | 待填（T02）|
| 4 | dev-only 启动 MSW；production 不注册 handler / worker | 待填 |
| 5 | 真实接口 ready 后删/停 handler 即切真实，业务代码 0 改动 | 待填 |

**切真实完成判定（G5→G6）**：
- [ ] handler 已删/停用；业务代码无 mock 分支。
- [ ] 契约测试更新为真实 fixture / schema 对账。
- [ ] schema / mapper / UI 类型 / 纯函数保留未动。

## 7. 文案契约表（强制）

> 逐字 copy 自 PRD（`inbox/lark-sync/prd-latest.md`）。分类名/固定分类名/按钮名进 `common/categories.ts` 常量，配「值 === 原文」字面断言测试（`categories.test.ts`）。本地只维护 zh-CN。翻译文本（事件名/市场名/分类名/按钮名）后端翻译后存储、前端读（F21）；**下表锁定前端硬编码的固定文案**（分类树静态兜底、面包屑、页头）。

### 7.1 一级分类名（PRD「接入加密资产/政治/体育/金融分类」）

| 文案 ID | key | 默认中文（逐字原文）| 来源 |
|---------|-----|--------------------|------|
| `cat.l1.crypto` | crypto | `加密资产` | PRD 加密资产 §一级分类 |
| `cat.l1.politics` | politics | `政治` | PRD 政治 §一级分类 |
| `cat.l1.sports` | sports | `体育` | PRD 体育 §一级分类 |
| `cat.l1.finance` | finance | `金融` | PRD 金融 §一级分类 |

### 7.2 加密资产二级（时间桶，逐字含空格）

`5 分钟` / `15 分钟` / `每小时` / `每 4 小时` / `每日` / `每周` / `每月`

### 7.3 政治二级

固定：`全部`（展示全部事件）；`特朗普` / `全球选举` / `初选` / `美国大选` / `贸易战`

### 7.4 金融二级

固定：`全部`；`股票` / `指数` / `大宗商品` / `外汇` / `财报`

### 7.5 体育二/三级（PRD 三级分类表逐字，用全称非缩写）

固定：`进行中`（含上下两区块：进行中 + `即将开始`，F14）

> **组头文案口径**：本节中文全称契约**仅适用于侧栏分类树静态兜底**（`common/categories.ts`）。
> 「进行中/即将开始」聚合视图的**组头分类名文案以 API 返回的 `categoryGroupLabel` 为准**（已按 language 翻译，见 §3.2），前端**不自己拼接、不从 subTag 反查**。缺失时不渲染组头（不兜假默认）。
- `世界杯`（无三级）
- `一级方程式`（无三级）
- `足球`：`英超` / `欧冠` / `西甲` / `意甲` / `德甲` / `法甲` / `美职联` / `墨西哥甲级联赛` / `南美解放者杯` / `中超` / `沙特职业足球联赛` / `英冠`
- `美式足球（橄榄球）`：`美国大学橄榄球` / `美国国家橄榄球联盟`
- `篮球`：`美国职业篮球联赛` / `日本职业篮球联赛` / `中国职业篮球联赛` / `德国职业篮球联赛` / `欧洲职业篮球联赛` / `美国女子职业篮球联赛`
- `网球`：`男子网球巡回赛` / `女子网球巡回赛`

### 7.6 其它固定文案

| 文案 ID | 组件 | 默认中文（逐字/含变量）| 来源 |
|---------|------|----------------------|------|
| `search.moreResults` | SearchBox 弹窗 | `更多结果` | PRD 搜索交互-Web |
| `search.breadcrumb.root` | 更多结果页面包屑 | `预测市场` | PRD F05 图 3 |
| `search.breadcrumb.self` | 更多结果页面包屑 | `搜索` | PRD F05 图 3 |
| `search.resultsTitle` | 更多结果页标题 | `{{kw}}的搜索结果` | PRD F05（`kw`=关键词）|
| `sports.ongoing` | 体育侧栏固定 | `进行中` | PRD 体育 §进行中 |
| `sports.ongoingTitle` | 体育进行中区标题 | `即将开始` | PRD 体育 §进行中 |
| `outcome.up` | 加密单市场卡按钮/半环 | `涨` | PRD 加密 §展示字段「涨·跌两大按钮」+ 图 7 |
| `outcome.down` | 加密单市场卡按钮 | `跌` | PRD 加密 §展示字段「涨·跌两大按钮」+ 图 7 |
| `outcome.yes` | 政治/金融/体育卡按钮 | `是` | 图 8（一期已有）|
| `outcome.no` | 政治/金融/体育卡按钮 | `否` | 图 8（一期已有）|

**自检**：
- [ ] 分类名逐字取 PRD，无意译/缩写替换（NBA→`美国职业篮球联赛` 等已按 PRD 全称）。
- [ ] 已建「值 === 原文」字面断言测试（`categories.test.ts`，`it.each` + `toBe`）。
- [ ] 缺失文案显 `--` / 不渲染，无假默认兜底。
- [ ] locale 只更新 zh-CN。

## 8. 待确认 / 契约差异

| # | 接口 / 字段 | 现状 | 期望 | 待谁确认 | 状态 |
|---|------------|------|------|---------|------|
| 1 | `A1` `tagType` 四类枚举值 | 一期仅 `'sports'` | 确认 crypto/politics/sports/finance 编码 | 后端 | 待确认（06-B2）|
| 2 | `A1` 二/三级过滤参数名 | 无 | `tag`/`subTag`？还是 `secondTag`/`thirdTag`？| 后端 | 待确认（06-B2）|
| 3 | 单 vs 多市场判定字段 | mock 用 `markets` 数量 | 后端真实字段（类型标记？）| 后端 | 待确认（06-B3）|
| 4 | `A2` 分类树是否提供 | 无 | 前端静态兜底优先；接口 ready 后对齐 slug | 后端 | 待确认（06-B1，Q2）|
| 5 | `A3` 搜索接口 + 排序是否后端做 | 无 | 后端排序优先；前端 resolver 兜底 | 后端 | 待确认（06-B4）|
| 6 | `categoryLabel` 是否后端返回 | mock 臆造 | 确认字段名或改由前端按 tagType 映射 | 后端 | 待确认（06-B2）|
| 7 | `A4` 手续费字段名 | mock 臆造 `orderAmount`/`feeAmount`/`receiveAmount` | 确认真实字段 + feeRate/加价率/抽水比例来源 | 后端 | 待确认（06-B6）|
| 8 | 翻译存储字段结构 | 前端读已翻译文本 | 确认是随事件返回还是独立接口 | 后端 | 待确认（06-B5）|

## 9. 契约变更记录

| 日期 | 版本 / commit | 变更 | 前端同步动作 |
|------|--------------|------|-------------|
| 2026-07-22 | G4-T01 | 三期契约初稿：A1 扩展四类+二三级过滤、A2 分类树、A3 搜索、A4 手续费字段（全 ASSUMED）；文案契约 §7 逐字锁定分类名 | 待 T02 落 MSW handler + 契约测试 |
