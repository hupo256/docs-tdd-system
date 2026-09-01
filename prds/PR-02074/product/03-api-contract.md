# 03 — API 契约

> **模板**：`templates/03-api-contract-template.md`
> **配套规则**：
> - 字段命名默认贴合契约、四类改名例外：[architecture-and-state.md](../../../common/rules/architecture-and-state.md) §3.1
> - 文案像接口 contract 一样管理：[architecture-and-state.md](../../../common/rules/architecture-and-state.md) §7.1
> - 真实接口到位后的字段对账关卡：[architecture-and-state.md](../../../common/rules/architecture-and-state.md) §8.1
> - 新功能 mock 强制 MSW 路线 B：[architecture-and-state.md](../../../common/rules/architecture-and-state.md) §8.4.1
> **使用**：G1 复制到项目；**G3 补 Mock 场景和文案契约（← 本次 T01 填充）**；G5 联调时逐行更新 §5 字段对账并做减法。

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02074` 预测市场三期 |
| 契约来源 | ✅ 后端《Web端接口文档》已到位（`inbox/PR-02074-Web端接口文档.md`，2026-08-25 对账）；下方按真实契约重填，仍标 ASSUMED 者为文档未覆盖项 |
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
| A1 | POST | `/fe-ex-api/polymarket/getTagEventsList` | 按分类查事件列表（**一期已有，三期扩展** `tagType` 四类 + 二/三级 `tagTypeTow`/`tagTypeThree` 过滤）| 未登录可看 | ✅ 文档确认 |
| A2 | GET | `/fe-ex-api/polymarket/category/tree` | 四大类的二/三级分类树（语言走 `exchange-language` header，`appLocale` query 保留兼容）| 未登录可看 | ✅ 文档确认（前端静态兜底优先，见 Q2）|
| A3 | POST | `/fe-ex-api/polymarket/searchEvents` | 搜索（模糊匹配 / 按展示语言 / 排序 / 分页，联想 5、完整 50）| 未登录可看 | ✅ 文档确认（独立响应 `{list,count,currentPage,pageSize}`）|
| A4 | POST | `/fe-ex-api/polymarket/getEstimatedProfit` | 预计收益（一期既有，**协议不扩展**；费用明细属后端内部不下发 Web）| 需登录 | ✅ 文档(1) §4 确认（不扩展）|
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

## 3. 核心 DTO（真实契约，2026-08-25 对账）

> 沿用一期 `polymarketTagEventSchema`。三期**不改现有字段**，请求侧加过滤参数 `tagTypeTow`/`tagTypeThree`，响应侧新增 `tagType`/`tagTypeThree`（供分类归属与组头派生）。`categoryLabel` 经证伪已删（文档未列、UI 未渲染）。

### 3.1 `A1 POST getTagEventsList` 请求（扩展）

```ts
interface TagEventsListRequestDTO {
  pageNum: number
  pageSize: number
  // 一期：固定 'sports'；三期：四大类
  tagType: 'crypto' | 'politics' | 'sports' | 'finance'
  // 体育用：1 比赛 / 2 事件（F15）；非体育可省略
  tableType?: number
  // 二级分类 slug（文档 §2 `tagTypeTow`，如 'trump' / 'soccer' / 'stocks' / '5m'）；'全部'='all'、'进行中'='in_progress'
  tagTypeTow?: string | null
  // 三级分类 slug（文档 §2 `tagTypeThree`，仅体育足球/篮球等有）；如 'champions-league'
  tagTypeThree?: string | null
  eventId?: string | number | null
}
```

> **进行中固定分类请求**：`tagTypeTow='in_progress'`（文档明确强制 `tableType=1`，仅比赛形态）。`tagTypeTow='all'` 忽略二级过滤。locale/timezone 由 header 承载不入 body。响应用 `matchStatus`(live/upcoming, ASSUMED ASM-008) 拆两区块、组头由前端用 `tagTypeTow/tagTypeThree` 派生（见 §3.2）。

### 3.2 `A1` 响应（沿用一期 + 加分类归属）

```ts
// 沿用一期 tagEventsListResponseSchema：{ total, list: PolymarketTagEvent[] }（文档确认结构不变）
// PolymarketTagEvent 现有字段不变（id/eventId/title/icon/volume/markets/teams…）
// 三期新增（文档 §2 确认）：
interface PolymarketTagEventExtraDTO {
  tagType?: 'crypto' | 'politics' | 'sports' | 'finance'  // 事件所属一级分类
  tagTypeTow?: string   // 二级分类 slug（体育聚合用，供组头派生）
  tagTypeThree?: string // 三级分类 slug（文档明确「事件元素新增」，供组头派生）
  // ↓ 体育比赛 UTC 开赛毫秒时间戳（文档 §5），用于派生开赛时间与「进行中/即将开始」归属：
  startTimeUtc0?: number | null
  // 即将开始区块日期分组依据：优先 startTimeUtc0，其次已有 endDateTmeUtc0 / kickoff UTC 毫秒
}
// ⚠️ 组头分类名（如 "足球 | 中超"）不再取后端字段：由前端用 tagTypeTow/tagTypeThree
//    反查分类树 name 派生（resolveSportsGroupLabel）。原臆造 categoryLabel/categoryGroupLabel 已删。
// ⚠️ matchStatus 非响应字段（2026-08-31 dev 联调证实后端不返回）：前端用 startTimeUtc0 vs now 派生
//    live/upcoming（mapTagEventsToWorldCup：Date.now() >= resolveKickoffUtcMs ? 'live' : 'upcoming'）。
//    原 mapper 直通一个后端不返回的字段（MSW 假 fixture 撑着），切真实接口后会永久 undefined→两区块空。ASM-008 resolved。
```

### 3.3 `A2 GET category/tree` 响应（2026-08-31 dev 实测：裸数组 + code）

```ts
// GET /polymarket/category/tree，语言走 exchange-language header（appLocale query 保留兼容），无 body
// ⚠️ 2026-08-31 dev 联调证实：顶层 data 直接是数组（不是 {categories:[]}），节点用 code（非 key）：
interface ApiCategoryTreeNodeDTO {
  id: number           // db 主键，Web 不消费（文档明确「不得用 db id/中文名/下标」）
  parentId: number
  pathIds: string      // 如 "20_34"
  level: number        // 1=一级 2=二级 3=三级
  code: string         // ✅ Web 唯一关联/筛选值（= tagType / tagTypeTow / tagTypeThree）
  name: string         // 默认语言展示名
  nameMap: Record<string, string>  // { 'zh-CN','en-US',... } 多语言名
  sort: number
  children?: ApiCategoryTreeNodeDTO[]
}
// 响应：data 为 ApiCategoryTreeNodeDTO[]（裸数组）
// 前端 schema 只建模 code/name/children（apiCategoryTreeResponseSchema = z.array(...)）；
// 其余字段不消费不建模。经 resolveCategoryTree.mapApiNodeToCategoryNode 转成 UI 域 CategoryNode{key,name,children}（code→key）。
// resolveCategoryChildren(tagType, apiTree)：命中一级 code===tagType 且有 children → 用真实；否则回落静态 CATEGORY_TREE[tagType]。
// dev 现状：仅 sports→World Cup 一条真实数据（+ 测试脏数据），crypto/politics/finance 走静态兜底。
```

> 历史备注：G3 阶段曾按 `{ categories: CategoryNodeDTO[] }` + `{key,name}` 建模，且 `CategorySidebar` 从未真正调用此接口（只读静态树），故一直未暴露形状不符。2026-08-31 首次真实接线时按 dev 实测改为裸数组 + `code`（回归测试 `prediction.contract.test.ts` 断言裸数组解析 + 拒绝旧 `{categories:[]}` 形状）。

### 3.4 `A3 POST searchEvents` 请求/响应（独立响应结构）

```ts
interface SearchEventsRequestDTO {
  keyword: string   // trim 后 ≤50 unicode 字符；空词后端返回空列表
  currentPage: number  // 文档字段名 currentPage（非 pageNum）
  pageSize: number     // Web 联想 5、完整结果页 50（1-50）
  // language 走 header；后端按展示语言标题匹配（F01）
}
// ⚠️ 与列表 { total, list } 结构不同，独立响应：
interface SearchEventsResponseDTO {
  list: PolymarketTagEvent[]  // 元素复用 PolymarketEventMarketInfoRes（同 §3.2）
  count: number               // 总命中数（前端无限滚动 loaded<count 判定）
  currentPage: number
  pageSize: number
}
```

> **排序（F03）由后端保障**：①匹配字符数量 > ②首个匹配字符在标题中的位置。前端不重排，直接按返回顺序渲染。前端 `sortSearchResults` resolver 仅后端未就绪时兜底、默认不启用（见 ASM-006）。

### 3.5 `A4 getEstimatedProfit` 响应（协议不扩展，F22/F23）

> **2026-08-31 反转**：《Web端接口文档(1)》§4「协议不扩展」+§6 明确——费用拆解（平台费/Polymarket费/预计成交价/净下单金额/预计份额等）均属后端内部实现，**不下发 Web**。响应仅保留一期既有字段；前端不得自算手续费。8/25 曾按旧版文档加的 9 个费用字段已全部回退，费用拆解 UI 行已删（见 06-collaboration BLK-001）。

```ts
// estimatedProfitDataSchema：仅一期既有字段（均字符串数值，后端算前端只展示）
interface EstimatedProfitData {
  estimateProfitAmount: string // 计算手续费后的预计兑付金额（含本金），示例 BUY "169.61904761"
  profitAmount: string         // 预计兑付金额 − 用户投入金额，示例 "69.61904761"
  rate: string                 // profitAmount ÷ amount × 100，示例 "69.619000"
  multiplier: string           // estimateProfitAmount ÷ amount，示例 "1.696190"
  // 响应另有 outcomeMap（旧字段，Yes/No 价格+token 数组）；前端用事件列表 outcomes，不消费，故 schema 不建模。
}
// 无效入参：后端返回参数错误码，非 data=null。conditionId/tickSize 为 Spot→Node 内部字段，Web 不传。
```

**手续费公式（PRD 原文，仅备查，前端不算且不展示明细）**：后端 `PolymarketTradeQuoteService` 内部统一计算并已反映在 `estimateProfitAmount` 中；平台费/Polymarket费/预计成交价/净下单金额等中间值不返回 Web，前端不展示费用拆解行。

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
}

// 多市场事件卡（政治/金融：多行 [名称+占比%+是/否小按钮]，无半环）
type MultiMarketView = {
  id: string
  title: string
  icon?: string
  volumeUsd: string
  outcomes: WorldCupEventOutcome[]  // 复用一期，每行一个 market
}

// 体育比赛卡组头（进行中/即将开始聚合）：categoryGroupLabel 由前端派生（非 API 字段）
// WorldCupMatch.categoryGroupLabel ← resolveSportsGroupLabel(event.tagTypeTow, event.tagTypeThree)
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

> 组头 `categoryGroupLabel`（体育聚合）不是 view 字段来源自 API，由 `resolveSportsGroupLabel(tagTypeTow, tagTypeThree)` 前端派生（API-DERIVED，见 §3.2）。原臆造 `categoryLabel` 已删。

### 5.2 `MultiMarketView` ← `PolymarketTagEvent`（`A1`，markets 数 > 1）

| UI 字段 | mapper 取值 | 契约字段 | 改名类型 | 备注 |
|---------|-------------|---------|---------|------|
| `id` | `event.id` | `id` | 同名 | |
| `title` | `event.title` | `title` | 同名 | |
| `icon` | `event.icon` | `icon` | 同名 | |
| `volumeUsd` | `event.volume` | `volume` | 同名 | |
| `outcomes` | `mapTagEventToMarket(event).outcomes` | `markets{}` | 多字段合并 | 复用一期 `mapTagEventToMarket` 每行 market |

### 5.3 `A4` 预计收益 ← `EstimatedProfitData`（文档(1) §4，协议不扩展）

| UI 字段 | mapper 取值 | 契约字段 | 改名类型 | 备注 |
|---------|-------------|---------|---------|------|
| 预计收益（主行）| `profitData.estimateProfitAmount` | `estimateProfitAmount` | 同名 | 已含本金；tooltip 另展示 profitAmount/rate/multiplier |

> 2026-08-31 反转后无费用拆解行——`下单金额`/`手续费扣除`/`获得金额` 等 UI 行已删，因契约不下发费用明细且前端不得自算（见 BLK-001）。

**G5 联调收尾自检**：
- [x] 表格所有 column、type 字段都在本表出现且改名类型非空。
- [x] 无两个 UI 字段兜底到同一 `dto.xxx`。
- [x] mock 阶段臆造、契约无来源的字段已删除（`categoryLabel`/`categoryGroupLabel` 已证伪删除；预计收益费用拆解字段 `orderAmount`/`feeAmount`/`receiveAmount` 及 8/25 曾加的 9 个费用字段已随「协议不扩展」全部回退，schema 仅留旧 4 字段）。`matchStatus` 文档未给，保留标 ASSUMED(ASM-008)。

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
> 「进行中/即将开始」聚合视图的**组头分类名由前端用 `tagTypeTow/tagTypeThree` 反查分类树 `name` 派生**（`resolveSportsGroupLabel`，如「足球 | 中超」），与侧栏同源同一份 `name`（后端 category/tree ready 后翻译同源）。前端**不从后端取 categoryGroupLabel 字段**（已证伪删除）。tagTypeTow 未命中分类树时不渲染组头（不兜假默认）。
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
| 1 | `A1` `tagType` 四类枚举值 | crypto/politics/sports/finance | 文档确认小写英文四类 | 后端 | ✅ resolved（文档 §2）|
| 2 | `A1` 二/三级过滤参数名 | `tag`/`subTag` | 文档确认为 `tagTypeTow`/`tagTypeThree` | 后端 | ✅ resolved（已改契约名）|
| 3 | 单 vs 多市场判定字段 | mock 用 `markets` 数量 | 后端真实字段（类型标记？）| 后端 | 🟡 2026-09-01 PM：**无明确类型标记字段，可提供**。暂沿用 markets 数量判定，待后端补标记（06-B3）；另比赛 markets 数量可变见 ASM-007 |
| 4 | `A2` 分类树是否提供 | 无 | `GET /polymarket/category/tree` 提供，结构不变，语言走 header | 后端 | ✅ resolved（文档 §3）|
| 5 | `A3` 搜索接口 + 排序 + 响应结构 | 无 | 独立响应 `{list,count,currentPage,pageSize}`，排序后端做 | 后端 | ✅ resolved（文档 §1）|
| 6 | `categoryLabel` 是否后端返回 | mock 臆造 | 文档未列 → 证伪删除，组头改前端 `tagTypeTow/tagTypeThree` 派生 | 后端 | ✅ resolved（ASM-001）|
| 7 | `A4` 手续费字段名 | mock 臆造 `orderAmount`/`feeAmount`/`receiveAmount`；8/25 曾按旧版加 9 费用字段 | 文档(1) §4「协议不扩展」+§6 明确费用明细不下发 Web → 全部回退，仅留旧 4 字段；费用拆解 UI 删 | 后端 | ✅ resolved（ASM-002；遗留 PRD 冲突见 BLK-001）|
| 8 | 翻译存储字段结构 | 前端读已翻译文本 | 确认是随事件返回还是独立接口 | 后端 | ✅ resolved（06-B5，2026-09-01）：**无独立翻译接口**，按 `exchange-language` header 返回当前语言文本；事件读 `title`、市场读 `question`、分类读 `category.name`（`nameMap` 存各语言、缺失回退英文），前端不自调翻译 |
| 9 | `A1` `matchStatus`（live/upcoming）| mock 臆造 | 文档未给此字段，进行中两区块依赖它 | 后端 | ✅ resolved（ASM-008，2026-08-31 dev 证实后端不返回 → 改前端用 `startTimeUtc0` vs now 派生）|
| 10 | `A2` 分类树响应形状 | G3 建模 `{categories:[]}` + `{key,name}`（从未真正调用）| 2026-08-31 dev 实测：裸数组 + `code`/`name`/`nameMap` | 后端 | ✅ resolved（§3.3；schema 改裸数组，首次真实接线）|

## 9. 契约变更记录

| 日期 | 版本 / commit | 变更 | 前端同步动作 |
|------|--------------|------|-------------|
| 2026-07-22 | G4-T01 | 三期契约初稿：A1 扩展四类+二三级过滤、A2 分类树、A3 搜索、A4 手续费字段（全 ASSUMED）；文案契约 §7 逐字锁定分类名 | 待 T02 落 MSW handler + 契约测试 |
| 2026-08-25 | 《Web端接口文档》| 按真实契约对账：A1 过滤参数 `tagTypeTow/tagTypeThree`、进行中 `in_progress`、A3 独立响应、A4 曾加 9 费用字段、`categoryLabel/categoryGroupLabel` 证伪删除+组头前端派生 | schema/mapper/mock 重造，122 单测绿 |
| 2026-08-31 | 《Web端接口文档(1)》| **A4 反转「协议不扩展」**：§4/§6 明确费用拆解（平台费/净下单金额/份额等）属后端内部不下发 Web；PM(Tomoto) 确认仅 A4 变、其他不变 | 回退 8/25 加的 9 费用字段（schema/fixture/handler/test），删除费用拆解 UI 行（EstimatedProfit 费用行 + PredictSellFeeRows.tsx），主行保留；122 单测绿、改动文件 0 新增 tsc；遗留 BLK-001 |
| 2026-08-31 | dev 环境联调（后端 4 接口发布 dev）| 从 MSW 切真实接口：curl 实测 A1/A3/A2 可调（结构对齐，dev 空数据）；A2 顶层为**裸数组 + code**（非 `{categories:[]}`）；`matchStatus` **后端不返回** | ①schema 改 `apiCategoryTreeResponseSchema=z.array(...)`、新接线 `useCategoryTreeQuery`+`resolveCategoryTree`（分类树首次真实调用，后端优先+静态兜底）；②`matchStatus` 假透传改为 `startTimeUtc0` 时间派生（`polymarketTagEventSchema` 删 matchStatus、加 startTimeUtc0；mapper 用 `Date.now()>=ms` 派生）；③`browser.ts` 停止注册 predictionHandlers（脚手架文件保留）；133 单测绿、改动文件 0 新增 tsc（基线 193）|
| 2026-09-01 | PM/后端集中答复（10 项待确认清单）| BLK-001 费用明细**不展示**（关闭）；team id=**number**（ASM-004 resolved）；volume/volumeClob 字符串+缺失固定 `"0"`、市场无 name 字段读 `question`（ASM-005 resolved）；比赛 markets **数量可变**（ASM-007 partially-resolved）；单/多市场**无类型标记字段、可提供**（B3）；**无独立翻译接口**、读 title/question/name（B5 resolved）；分类 `code` 为正式关联值 | ①schema 撤 team id ASSUMED 注释（number 已对）；②mapper 新增 `matchOutcomeKeyAt`：2 段比赛 idx=1 从误判 `draw` 修为 `away`，3 段不变（+2 回归测试）；③BLK-001 关闭、无需追加 UI 改动（8/31 已删费用行即正解）；④markets>3 比赛 outcome 语义 + MatchCard 非-3 段视觉 + 单/多类型标记 3 项仍待后端/设计（见 ASM-007/B3）。改动文件 0 新增 tsc |
