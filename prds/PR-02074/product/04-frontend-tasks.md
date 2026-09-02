# Frontend Tasks — PR-02074 预测市场三期

> 依据 [02-technical-design.md](./02-technical-design.md)（G3 方案已定稿）。按阶段推进，每个 T 完成后补验收证据。

## 当前进度快照（2026-07-22 刷新）

> 状态图例：✅ 已落码验证 · 🟡 部分完成/有缺口 · ⏳ 待办。

| 阶段 | 状态 | 说明 |
|------|------|------|
| 0 契约与骨架（T01-T04）| ✅ | 契约/MSW/分类树/四路由全落码，Prediction 相关单测全绿（详见收尾实跑数）|
| 1 一级Tab+侧栏+列表（T05-T07）| ✅ | Tab/侧栏/非体育列表 + **体育列表已消费侧栏 `tag/subTag`**（T07 缺口已补）|
| 2 三种卡片（T08-T11）| ✅ | resolver+测试；单/多/比赛卡**复用 `EventTab`/`MatchTab` 内分支**实现（未拆独立 `SingleMarketCard`/`MultiMarketCard` 组件，属方案微调）|
| 3 体育特殊逻辑（T12-T13）| ✅ | T13 比赛/事件切换 + T12「进行中」两区块(进行中按联赛/即将开始按日期→联赛)聚合+组头(API `categoryGroupLabel`)+侧栏联动**已落码**（`OngoingTab`+`groupOngoingMatches`+`ongoingGroup.test.ts`）|
| 4 搜索（T14-T17）| ✅ | `SearchBox`+弹窗+更多结果页(无限滚动)+两 resolver 全落码；方向文本/青蓝 token/面包屑灰色待后端 B4+设计 |
| 5 手续费+收尾（T18-T19）| 🟡 | T18 手续费展示 mock 版落码(真实字段待 B6)；T19 gate/文档定稿进行中，L2 对图走查待人工 |

**下一步优先级**：① 补体育侧栏↔列表联动 + T12「进行中」聚合（打通阶段 3）→ ② 阶段 4 搜索整块 → ③ T18 手续费展示（待后端）→ T19 收尾。

## 阶段与任务

### 阶段 0 · 契约与骨架

| ID | 功能 | 任务 | 状态 | 验收证据 |
|----|------|------|------|----------|
| T01 | 全部 | G3 落 `03-api-contract.md`：三接口 mock schema（`getTagEventsList` 扩展 / `getCategoryTree` / `searchEvents`），沿用 polymarket 风格，标 ASSUMED | ✅ | `03-api-contract.md` 已落（含 §5 对账/§7 文案契约）|
| T02 | 全部 | MSW handler `mocks/handlers/prediction.ts` + `browser.ts` 注册 + 契约测试（mock 过真实 schema.parse）；确认 `Providers.tsx` 挂 `useMockWorker()` | ✅ | `prediction.contract.test.ts` 7 项绿；`browser.ts`/`Providers.tsx` 已挂 |
| T03 | F01 | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册（MSW 路线 B fallback，后端 ready 按 handler 粒度删除即切真实）| ✅ | 同 T02：handler+contract test+`useMockWorker()` 已落；覆盖 normal/empty/error/unauthorized/edge |
| T03 | F07/F10/F13/F18 | `common/categories.ts` 四大类 + 二/三级分类树静态配置（含固定"全部"/"进行中"，PRD 全量分类）| ✅ | `categories.test.ts` 12 项绿（树结构 + 文案字面断言）|
| T04 | 路由 | 四路由 page.tsx：`prediction/{crypto,politics,sports,finance}` + `prediction/search`；`world-cup` 301→`prediction/sports`（Q1）| ✅ | 四路由 + search 骨架 + world-cup `permanentRedirect`（保留 `c` 邀请码）|

### 阶段 1 · 一级 Tab + 侧栏 + 列表

| ID | 功能 | 任务 | 状态 | 验收证据 |
|----|------|------|------|----------|
| T05 | F07/F10/F13/F18 | `CategoryTabs`（一级路由跳转）+ 激活 `Prediction/index.tsx` 现有占位 | ✅ | `CategoryTabs.tsx` + `index.tsx` 四类通用容器 |
| T06 | F07/F10/F13/F18 | `CategorySidebar`：加密=时间桶平铺；政治/金融=语义二级；体育=可展开多级树 | ✅ | `CategorySidebar.tsx` + `categorySelection.ts`（URL `?tag=&subTag=` 承载选中态）；图标待 L2 补 |
| T07 | 列表 | 列表接口扩展（`tagType` 四类 + 二/三级过滤参数）+ 数据接入 | ✅ | 非体育 `PredictionCategoryList` + 体育 `WorldCupCon` 均按 `sel.tag/subTag` 拉取；`WorldCupCon` 已接 `useSearchParams`+`resolveSelection('sports',…)`，`tag/subTag` 入参 |

### 阶段 2 · 三种卡片形态

| ID | 功能 | 任务 | 状态 | 验收证据 |
|----|------|------|------|----------|
| T08 | F12/F20 | `resolveEventCardType` resolver（比赛/单市场/多市场）| ✅ | `eventCardType.ts` + `eventCardType.test.ts` 5 项覆盖三分支 |
| T09 | F09 | `SingleMarketCard`：半环占比 + 涨/跌(是/否)大按钮 + 成交量 + 分享（复用 `YesNoPairBtn`/`PredictionShareMan`）| ✅ | **方案微调**：未拆独立组件，复用 `EventTab` 单 outcome 分支；加密「涨/跌」由 `resolveOutcomeLabelKeys` + `outcomeLabels.test.ts` 驱动。待 L2 对图 7 |
| T10 | F12/F20 | `MultiMarketCard`：多行[名称+占比%+是/否小按钮] | ✅ | **方案微调**：复用 `EventTab` 多 outcome 分支。待 L2 对图 8 |
| T11 | F15/F17 | `MatchCard`：三段占比条（抽自现有 `MatchTab`）| ✅ | 复用现有 `MatchTab`。待 L2 对图 13 |

### 阶段 3 · 体育特殊逻辑

| ID | 功能 | 任务 | 状态 | 验收证据 |
|----|------|------|------|----------|
| T12 | F14 | "进行中"固定分类**两区块**：①进行中(按联赛 `categoryGroupLabel` 分组)②即将开始(先 `groupMatchesByDate` 再按联赛)；组头文案取 API `categoryGroupLabel`(不拼接) + **体育侧栏↔列表联动**(`WorldCupCon` 读 URL `tag/subTag`) | ✅ | `OngoingTab.tsx`+`groupOngoingMatches`(format.ts)+`ongoingGroup.test.ts` 5 项绿；`WorldCupCon` 接 URL 选中态、进行中走聚合视图；mock 含 live/upcoming 全场景。L2 对图 12/16 待人工走查 |
| T13 | F15 | 比赛/事件切换（复用现有 InnerTab 机制）；进行中固定分类下**隐藏** InnerTab | ✅ | `WorldCupCon` `InnerTab` 比赛/事件切换 + 埋点；`isOngoing` 时隐藏 InnerTab、强制 `tableType=match` |

### 阶段 4 · 搜索

| ID | 功能 | 任务 | 状态 | 验收证据 |
|----|------|------|------|----------|
| T14 | F01/F02 | `SearchBox` + 实时联想（debounce）+ 按当前展示语言匹配标题 | ✅ | `components/SearchBox/`(受控 props+`useDebounce`300ms+`useSearchEventsQuery`)；language 走 header 由后端匹配；已挂预测页右上角 |
| T15 | F03 | 排序 resolver：匹配字符数 > 首个匹配字符位置 | ✅ | `common/searchSort.ts`+`searchSort.test.ts`（含 PRD「意大利」用例）；后端排序优先，此为前端兜底(默认不启用) |
| T16 | F04 | Web 下拉弹窗（5 条 + 匹配高亮 + 右侧占比/方向）| ✅ | `SearchBox/SearchPopup.tsx`+`highlightMatch.ts`(8 测试)；右侧占比%+方向取 `resolveSearchDirection`。⚠️方向文本受 schema 字段限制降级为市场展示名(B4 待后端)；青蓝高亮暂用 `primary`(待设计 token) |
| T17 | F05 | `prediction/search` 更多结果页（面包屑 + 卡片带分类标签 + 分页 50/页下拉加载）| ✅ | `SearchResultsPage.tsx`+`SearchResultCard.tsx`+`CategoryLabelBadge.tsx`；`useSearchEventsInfiniteQuery` 50/页无限滚动(`useInfiniteScroll`)。面包屑「预测市场」灰待 L2 |

### 阶段 5 · 手续费展示 + 收尾

| ID | 功能 | 任务 | 状态 | 验收证据 |
|----|------|------|------|----------|
| T18 | F22/F23 | `PredictionTradeMan` 接后端手续费字段，**只展示不计算**（下单金额/手续费扣除/获得金额）| 🟡 | mock 版落码：schema 补 3 optional 字段 + `getEstimatedProfit` mock；买入 `EstimatedProfit.tsx` 展示下单金额/手续费扣除、卖出 `PredictAccount`+`PredictSellFeeRows` 展示获得金额/手续费扣除，缺失显 `--`；契约测试 2 项绿。**真实字段/amount 语义待后端 B6** |
| T19 | 全部 | G6 `/code-review` + Biome + type-check；L2 逐张对 bitmart 截图走查 | 🟡 | 自动化部分完成：`verify-code-rules` 0 findings + 人工 review 0 阻断（06 已记）+ 改动文件 tsc 零报错 + Prediction 全量 79 项绿；**G6 gate PASS(40/42，2 WARN 非阻断)**。**L2 对图 22 张走查待人工**（视觉/手感） |

## 实现检查

- [ ] 状态/文案/class/action 映射已收敛到 map/resolver（卡片形态、分类树）。
- [ ] 可由 `tailwind-preset.js` 表达的尺寸/圆角/间距未写成 arbitrary class。
- [ ] API DTO 未直接进入组件展示层；字段经 schema/mapper 对账。
- [ ] loading / empty / error / disabled / 未登录完整（复用现有 `WorldCupListBoundary`/`Empty`/Skeleton）。
- [ ] 分类名/按钮名文案逐字取 PRD/截图，不意译（[[feedback_content_assets_verbatim]]）。
- [ ] 数据缺失显 `--` / 不渲染，禁假默认（[[feedback_no_fallback_masks_missing_data]]）。
- [ ] 单个 .tsx ≤300 行；卡片形态拆子组件。

## apps/web-next 迁移补充（2026-09-02）

| 范围 | 状态 | 验收证据 |
| --- | --- | --- |
| Phase 1：4 endpoint/query、Schema/mapper、逐行容错、i18n、Pagination | ✅ | 聚焦测试覆盖 endpoint、query、mapper、纯函数、分页与文案契约 |
| Phase 2：crypto / politics / finance 路由与页面 | ✅ | 三条路由可访问；URL 使用 `tag/subTag`；`/prediction` 重定向 crypto；sports/search 本期保持 404 |
| 请求状态 | ✅ | loading skeleton、empty、error+retry、refresh overlay、禁用 Yes/No 均已落地 |
| i18n 缺失资源 | ✅ | 批量 hydration 跳过未同步 namespace；`en-US/prediction/crypto` 不崩溃，不跨语言伪回退 |
| Empty 资源 | ✅ | 改为语义色内联 SVG，不再请求不存在的 `/static/empty-dark.png` / `/static/empty.webp` |
| 自动化 | ✅ | `pnpm test`、typecheck、lint、`build:test` 全部 exit 0；lint 仅 14 条既存 warning |
| 浏览器 | 🟡 | 1440px dark/light 与 390px 主体通过；crypto 月度 3 条、politics 4 条、finance 3 条真实卡片已验收；390px 全局 Header 仍有既存横向溢出 |
| 外部依赖 | ⏳ | C08 分类翻译、crypto 其余 6 个粒度/两段式比赛种子、登录态测试账号、Footer 合入 online |
| 分支基线 | ⏳ | `feature/PR-02074` 相对最新 `origin/online` 落后 69 / 领先 14；双方当前无重叠文件且 merge-tree 无文本冲突，发布前仍须在保护未提交 web-next 文件后同步 |
| web-next G6 | ⏳ | 共享规则发布漂移已恢复，MSW 退役检查 6/6 通过；`changed PR-02074` 仅剩 `CODE-TYPE-001` 对自动生成 `routeTree.gen.ts` 的 5 个 `as any` 误报。扫描器已有 `*.gen.ts` 识别但该规则未应用，待规则 owner 修复后重跑四维 G6。 |
