# Technical Design — PR-02074 预测市场三期

> G2 已定稿（[00-feature-inventory.md](./00-feature-inventory.md)）。本文为 G3 技术方案，供负责人审阅；审阅通过后再建 worktree 进 G4。

## 0. 关键约束回顾（G2）

- **只做 Web**；手续费**后端算前端只展示**；视觉基线 = bitmart 截图；**API 未 ready 走 MSW 路线 B**（最小 mock）。
- **数据源 = Polymarket**（bitmart 图源 `polymarket-upload.s3`，与一期同源），直接扩展现有 `getTagEventsList` + `schemas.ts`。
- **路由前缀保持 `prediction/`**，四大类子路径用 bitmart 命名。

## 1. 路由设计

现状：一期只有 `prediction/world-cup`（`PREDICTION_WORLD_CUP` 常量，分享链接 `buildShareInviteUrl.ts` 依赖）。

三期改为四大类分路由（Next App Router，`app/[lang]/(with-header)/(with-footer)/prediction/`）：

| 路由 | 一级分类 | 页面组件 | 备注 |
|------|---------|---------|------|
| `prediction/crypto` | 加密资产 | `Prediction/index.tsx` 复用，按 category 渲染 | 默认落地页 |
| `prediction/politics` | 政治 | 同上 | |
| `prediction/sports` | 体育 | 同上（含"进行中"聚合 + 比赛/事件切换 + 多级树侧栏）| |
| `prediction/finance` | 金融 | 同上 | |
| `prediction/search` | — | 搜索「更多结果」独立页（F05）| 面包屑 预测市场 > 搜索 |

**一期 `prediction/world-cup` 兼容策略（待定，见「待确认 Q1」）**：
- 方案 A（推荐）：`world-cup` 页 301/302 重定向到 `prediction/sports?tag=世界杯`（世界杯降为体育三级分类）；保留旧 URL 不死链，分享链接仍可用。
- 方案 B：保留 `world-cup` 独立页不动，仅新增四大类。改动小但 URL 体系割裂、与 bitmart 不一致。

一级 Tab 切换 = 路由跳转（`<Link>`），非同页 state 切换（利于 SEO/直达/分享，贴合 bitmart）。二/三级分类 = 页内 state（query param 承载，可分享可回退）。

## 2. 目录组织

```
apps/web/src/apps/Prediction/
  index.tsx                    # 现有，改造为四大类通用容器（接 category prop）
  common/
    categories.ts              # 【新】四大类 + 各自二/三级分类树静态配置（含固定"全部"/"进行中"）
    types.ts                   # 【扩展】PredictionCategory enum、CategoryNode、卡片形态判定
  components/
    CategoryTabs.tsx           # 【新】顶部一级 Tab（路由跳转）
    CategorySidebar.tsx        # 【新】左侧二/三级分类树（加密=时间桶平铺；体育=可展开多级树）
    EventCard/                 # 【新】卡片形态分发
      SingleMarketCard.tsx     #   单市场：半环占比 + 是/否(涨/跌)大按钮（复用现有 YesNoPairBtn）
      MultiMarketCard.tsx      #   多市场：多行[名称+占比%+是/否小按钮]
      MatchCard.tsx            #   比赛：三段占比条（抽自现有 MatchTab）
    SearchBox/                 # 【新】搜索框 + 下拉弹窗（F01-F04）
    SearchResultsPage.tsx      # 【新】更多结果独立页（F05）
  WorldCup/                    # 现有，逐步收敛：MatchTab/EventTab 抽为通用卡后可能退役
  hooks/                       # 现有 + 新增分类/搜索 hooks
```

## 3. 复用盘点

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 |
|------|-------------------|------|----------|
| 组件 | `Prediction/index.tsx` 一级Tab+侧栏占位（现 hidden）| 三期激活对象 | 直接复用改造 |
| 组件 | `WorldCup/MatchTab`（三段占比条比赛卡）| = 体育比赛卡形态 | 抽为 `MatchCard` 通用 |
| 组件 | `WorldCup/EventTab` | 事件卡形态 | 抽为卡片形态之一 |
| 组件 | `components/YesNoPairBtn` | 是/否按钮 | 直接复用（单/多市场卡都用）|
| 组件 | `components/PredictionShareMan` | 分享弹窗 | 直接复用（所有卡分享按钮）|
| 组件 | `components/PredictionTradeMan` | 下单弹窗（含手续费展示位）| 复用，接后端手续费字段 |
| 组件 | `components/Pagination` | Web 更多结果页分页 | 直接复用 |
| services/API | `useTagEventsListQuery`（`getTagEventsList`，含 `tagType`+`tableType`+分页）| 核心列表接口 | 扩展 `tagType` 为四大类 + 加二/三级过滤参数 |
| services/API | `schemas.ts`（polymarket Zod）| 数据结构 | 扩展（新增分类树/搜索 schema）|
| utils/mapper | `mapTagEventsToWorldCup.ts` | 比赛/事件 mapper | 复用 + 新增单/多市场 mapper |
| utils | `groupMatchesByDate`（`WorldCup/common/tools`）| 体育"进行中"按日期聚合 | 复用/扩展（加 一级\|二级 分类名头）|

**待新建（无可复用）**：分类树静态配置、CategoryTabs/Sidebar、单/多市场卡、搜索框+下拉+结果页、分类树接口 hook、搜索接口 hook。

## 4. 数据结构与 API 契约（详见 03-api-contract.md）

沿用 Polymarket。三期 mock 接口（ASSUMED，真实到位对账）：

| 接口 | 用途 | 复用/新增 | mock |
|------|------|----------|------|
| `getTagEventsList` | 按分类查事件列表 | 扩展：`tagType`∈{crypto,politics,sports,finance}，新增二/三级 `tag`/`subTag` 过滤 | MSW |
| `getCategoryTree`（拟）| 四大类的二/三级分类树 | 新增 | MSW（或前端静态兜底，见 Q2）|
| `searchEvents`（拟）| 搜索（模糊/按语言/排序/分页）| 新增 | MSW |

**单 vs 多市场判定（Q3 待后端）**：mock 阶段暂以 `markets` 数量 >1 判定多市场，=1 判定单市场；真实字段到位对账。

## 5. 卡片形态 resolver（查表替 if 链）

| 事件类型 | 判定 | 渲染组件 |
|---------|------|---------|
| 比赛（体育 tableType=1）| `teams != null` | `MatchCard`（三段条）|
| 单市场事件 | markets 数 = 1 | `SingleMarketCard`（半环+大按钮）|
| 多市场事件 | markets 数 > 1 | `MultiMarketCard`（多行小按钮）|

集中到 `resolveEventCardType(event): EventCardType`，不在 JSX 堆 if。

## 6. MSW 落地（路线 B，参考 PR-01947）

- `apps/web/src/mocks/browser.ts`：`setupWorker(...handlers)` 注册三期 handler。
- `apps/web/src/mocks/handlers/prediction.ts`：【新】mock `getTagEventsList`(四类)/`getCategoryTree`/`searchEvents`，开发期每个一级 Tab 至少一屏示例数据，覆盖单/多/比赛三形态及 `tag`/`subTag` 侧栏过滤；标题可参考公开竞品页面，赔率/成交量/ID/时间一律视为本地假数据。
- `useMockWorker.ts`（现有）dev-only 启动，`onUnhandledRequest:'bypass'`。
- 契约测试：mock 数据过真实 `schema.parse`，保证关 handler=切真实接口业务 0 改动。
- `Providers.tsx` 挂 `useMockWorker()`（确认现有是否已挂）。

## 7. i18n

- 本地只做 zh-CN（[[feedback_i18n_local_dev_zh_cn_only]]）。分类名/按钮名文案逐字取 PRD/截图，不意译。
- F21 翻译 API 后端主责：事件名/市场名/分类名/按钮名由后端翻译后存储，前端读已翻译文本（Q4 待后端确认字段）。

## 8. 待确认（技术侧，审方案时定）

| # | 问题 | 建议 |
|---|------|------|
| Q1 | 一期 `world-cup` URL 兼容 | 方案 A：重定向到 `prediction/sports`（世界杯降三级）|
| Q2 | 分类树来源 | 优先后端接口；未 ready 前前端静态配置兜底（PRD 已列全量分类）|
| Q3 | 单/多市场判定字段 | mock 用 markets 数量，待后端真实字段 |
| Q4 | 翻译字段结构 | 待后端；前端先按"读已翻译文本"设计 |
| Q5 | 加密时间桶(5分钟…)是二级分类还是 tableType 类似机制 | 待后端；mock 按二级 tag 处理 |

## 9. 分阶段实现建议（G4）

1. 路由骨架 + CategoryTabs（四路由可切）+ 静态分类树侧栏
2. 列表接口扩展 + MSW + 三种卡片形态 + resolver
3. 体育特殊：进行中聚合 + 比赛/事件切换 + 多级树展开
4. 搜索：SearchBox + 下拉弹窗 + 更多结果页
5. 下单弹窗接后端手续费展示字段
6. 自测（Vitest 逻辑/DOM 契约）+ L2 对 bitmart 截图走查
