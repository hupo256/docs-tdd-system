# Collaboration — PR-02074 预测市场三期

> G0 已完成：PRD 同步本地 + 22 张截图逐张读图，全量清单见 [00-feature-inventory.md](./00-feature-inventory.md)。**G2 定稿前不写业务代码。**
>
> **2026-09-04 增量裁决（aven）**：分类首页顶部搜索框仅在桌面断点由 `200px` 调整为 `240px`；移动端 `w-full`、独立搜索结果页、搜索逻辑与 API 均不改。

## A. 待确认：需用户/产品在 G2 确认的 scope

| # | 事项 | 默认建议 |
|---|------|---------|
| A1 | 四大类 + 搜索 + 翻译对接 + 手续费公式，本期是否全做 | 建议全做（PRD 无删除线，均本期）|
| A2 | 手续费公式 F22/F23 是否本期前端改动 | 前端下单弹窗需按新公式算展示金额，需做 |
| A3 | App 端（图 4/20）是否本仓本期 | 本仓 `@fameex/web`(Web)；建议 App 走 App 仓，本期只做 Web |

## B. 需后端明确（阻塞联调，非阻塞 G2 文档）

> **G5 决策（aven，2026-08-22）**：等后端接口 ready 再对账，本期不走 fast-track（不改 G5 为 `frontend-complete-pending-reconcile`/`not-applicable`）。前端阶段0-4 已落码，MSW 路线 B 继续挂载至接口 ready；B1-B7 逐项在接口 ready 后一次性对账+销 mock。
>
> **G5 对账（aven，2026-08-25）**：后端《Web端接口文档》到位，按真实契约重造 schema/mapper/mock（B1/B2/B4/B6/B7 逐项对账，见下表结论）。文档只给契约未确认后端 dev-ready，故**本轮不退役 handler，MSW 路线 B 继续挂**；接口真正可调后再退役。`matchStatus` 文档未给仍 open（ASM-008），正当挡 G5。
>
> **预计收益扩展反转（aven，2026-08-31）**：后端《Web端接口文档(1)》§4 改为「协议不扩展」、§6 明确费用拆解（平台费/Polymarket费/预计成交价/净下单金额/预计份额等）均属后端内部实现**不下发 Web**。PM(Tomoto) Lark 确认「原先返回预计收益的扩展了响应体字段已删掉、不扩展，以此文档为准，其他地方没变」。已回退 8/25 加的 9 个费用字段（schema/fixture/handler/test），并**删除 T18 建的费用拆解 UI 行**（买入弹窗「下单金额/手续费扣除」、卖出弹窗「获得金额/手续费」及 PredictSellFeeRows.tsx 整文件），「预计收益」主行保留。遗留 PRD F22/F23（前端按费用明细展示）与新契约冲突，见 🔴 BLK-001。
>
> **PM/后端集中答复对账（aven，2026-09-01）**：PM(Tomoto) 逐条回复待确认清单，收敛多项 open 假设与 BLK-001：①**费用明细不展示** → BLK-001 resolved（现状代码已删费用行、留预计收益主行即为正解）；②预计收益接口**已准备**（dev 部署）；③team id 类型 = **number**（ASM-004 resolved，schema `z.number()` 已对）；④`volume`/`volumeClob` 为**字符串**、上游缺失固定返回 `"0"`（后端保证有值，前端 `?? '0'` 与契约一致），市场**无 `name` 字段** → 读 `markets.*.question`（ASM-005 resolved，mapper 已读 question 未读 name）；⑤比赛 markets **数量可变、不恒三段**（ASM-007：修 mapper 2 段比赛 idx=1 从误判 `draw` 改为 `away`）；⑦单/多市场目前**无明确类型标记字段，后端可提供**（B3：暂沿用 markets 数量判定，待后端补标记）；⑧**不提供独立翻译接口**，按 `exchange-language` 返回当前语言文本，事件读 `title`、市场读 `question`、分类读 `category.name`（`nameMap` 存各语言、缺失回退英文），前端**不自调翻译**（B5 resolved）；⑨测试脏数据已清理；⑩分类 `code` 为**正式关联值**（与 §3.3 一致）。

| # | 事项 | 影响功能 | 2026-08-25 对账结论 |
|---|------|---------|--------------------|
| B1 | 分类树接口（四大类各自二/三级分类，含固定"全部"/"进行中"）| F07,F10,F13,F18 | ✅ `GET /polymarket/category/tree` 提供，结构不变，语言走 header；前端静态兜底优先，slug 待接口 ready 对齐 |
| B2 | 按分类查事件列表接口（`tagType` 扩展 + 二/三级过滤参数）| 全部列表 | ✅ 过滤参数确认为 `tagTypeTow`/`tagTypeThree`（原 `tag`/`subTag`），进行中固定值 `in_progress`（强制 tableType=1）；`categoryLabel` 文档未列→证伪删除 |
| B3 | **单市场 vs 多市场事件判定字段**（决定卡片形态）| F12,F20 | ⏳→🟡 2026-09-01 PM：目前**无明确类型标记字段，可提供**。暂沿用 `markets` 数量判定（1→single，>1→multi），待后端补类型标记后切换。另比赛 markets **数量可变**（见 ASM-007）|
| B4 | 搜索接口（模糊匹配、按展示语言、排序、分页 50/页）| F01-F06 | ✅ 请求 `currentPage`（非 pageNum）；独立响应 `{list,count,currentPage,pageSize}`；排序后端保障；联想 5/完整 50 |
| B5 | 翻译存储字段结构（前端读已翻译文本还是调接口）| F21 | ✅ 2026-09-01 PM resolved：**不提供独立翻译接口**，按 `exchange-language` header 返回当前语言文本。事件读 `title`、市场读 `question`、分类读 `category.name`（`nameMap` 存各语言、缺失回退英文原文）。前端直接展示、不自调翻译 |
| B6 | feeRate/加价率/抽水比例/预计成交价 取值来源 | F22,F23 | ⛔ **2026-08-31 反转**：《Web端接口文档(1)》§4「协议不扩展」+§6 明确费用拆解字段（平台费/Polymarket费/预计成交价/净下单金额/份额等）均属后端内部实现**不下发 Web**。`getEstimatedProfit` 响应仅 estimateProfitAmount/profitAmount/rate/multiplier。8/25 加的 9 字段已回退，前端不得自算手续费。费用拆解 UI 行已删（见 BLK-001）。窄口径争议随扩展作废 |
| B7 | 体育"进行中"聚合：①是后端返回还是前端聚合 ②两区块拆分依据字段 `matchStatus`('live'/'upcoming') 是否后端返回 ③组头分类名 `categoryGroupLabel`(如"足球\|中超",已翻译)是否后端返回，还是前端从 subTag 反查 | F14 | ①前端聚合（列表接口按 in_progress 返回全部比赛，前端拆两区块）②`matchStatus` 文档**未给**→🔴 open ASM-008，暂保留 mock ③组头**确定前端派生**：`resolveSportsGroupLabel(tagTypeTow,tagTypeThree)` 反查分类树 name，后端 `categoryGroupLabel` 证伪删除 |

### ✅ BLK-001 预计收益费用明细展示 vs 契约冲突（2026-08-31 提出，2026-09-01 resolved）

- **状态**：✅ resolved（2026-09-01 PM Tomoto 明确「不展示」）。
- **冲突**：PRD F22/F23 要求下单弹窗展示手续费/下单金额等费用明细；但《Web端接口文档(1)》§4/§6 明确这些中间值不下发 Web、且前端不得自算手续费（后端职责）。
- **裁决**：PM 确认下单/卖出弹窗**不展示费用拆解明细**，仅展示「预计收益」主行（`estimateProfitAmount`，已含后端计算的手续费）。费用收取逻辑（PRD「手续费收取逻辑优化」章）为后端内部口径，不映射为前端 UI。
- **落地结果**：现状代码已符合裁决——8/31 已删费用拆解 UI 行（买入 EstimatedProfit 费用行 / 卖出 PredictSellFeeRows.tsx / PredictAccount 卖出 Modal），保留预计收益主行；本次无需追加改动。BLK-001 关闭。
- **owner**：product + backend（已答复）。

## C. 需设计确认

| # | 事项 |
|---|------|
| C1 | Figma 官方远程 MCP 已于 2026-07-25 配置并完成 OAuth；已成功读取主 Section `17067:17867`、35 个变量，以及搜索输入 `17127:74365`、联想层 `17127:74310` 的原子上下文。后续 L2 直接按 metadata 子 nodeId 逐模块读取，不再依赖浏览器 DOM。 |
| C2 | Figma 未逐一提供每个一级 Tab 的独立稿；按产品说明，相同页面壳、分类树、事件模块和搜索模块直接复用，仅切换分类数据。 |
| C3 | BitMart 可作为 Tab、信息架构、布局、搜索 UX 和数据结构参考，但 FameEX 的颜色、字体、间距 token 不从 BitMart 反推。 |

## MSW 路线 B 落地决策（G3）

> API 未 ready 时的 **MSW 路线 B** 落地清单（决策依据 `common/rules/architecture-and-state.md` §8.4.1，参考 PR-01947 实践）：

- **决策**：三期所有新接口（`getTagEventsList` 扩展 / `getCategoryTree` / `searchEvents` / `getEstimatedProfit`）在后端 ready 前一律走 MSW handler mock，业务代码按真实 schema 编写；后端 ready 后按 handler 粒度删除/停用即切真实，`schemas.ts`/`mapper`/UI 类型零改动。
- **当前状态（2026-07-25）**：API 文档仍未输出，继续执行路线 B；本轮 UI/UX 还原不新增组件内 mock 或直连 fixture。
- **落地位置**：handler `src/mocks/handlers/prediction.ts`；fixtures `src/mocks/fixtures/prediction.ts`；worker `useMockWorker()` 仅 dev/test 启用，`browser.ts` 注册，`Providers.tsx` 已挂；pre/prod 不注册。
- **场景覆盖**：normal / empty / error / unauthorized / edge（见 `03-api-contract.md` §0.1、§6）。
- **契约复核**：`prediction.contract.test.ts` 对每个 handler response 跑真实 `schema.parse` 不抛错，防 mock 与契约漂移。
- **切真实追踪**：见 §B（B1-B7 待后端对账项），各 ASSUMED 字段关 mock 即切。

## 假设（未确认，先记录）

- 复用一期 `Prediction/WorldCup` 的 `MatchTab`(三段占比条)/`EventTab` 作体育卡；`PredictionShareMan` 分享弹窗。
- 顶部一级 Tab / 左侧分类占位（`Prediction/index.tsx` 现 `hidden`）为三期激活对象。
- 数据源仍 Polymarket，schema/mapper 在 `services/api/prediction/` 扩展。

## Code Review

| 时间 | 命令 | findings | 处理结论 | 证据 |
|------|------|----------|----------|------|
| 2026-07-22 | `verify-code-rules.mjs --project PR-02074` | 0 findings（静态规则） | 无需处理 | 本表下方 review 记录 |
| 2026-07-22 | 人工 review 本次 diff（阶段3-5，501 行/12 文件） | 0 阻断缺陷；1 待对账观察点 | 全部已处理/登记，无悬空 | 见下方明细 |

**Review 明细（findings 处理结论）**：

- **correctness**：买入 `useTradeDerivedState` 手续费字段有 `hasProfitData` 守卫、缺失 `?? '--'`；卖出 `useEstimatedProfitQuery` enabled 内建 `!!tokenId && !!marketId && amount>0` 守卫，`sellRecord` null 时不发请求 → **无空值/NaN 风险**。**已确认，无需改**。
- **复用/简化**：买入 feeRows、卖出 `PredictSellFeeRows` 均查表渲染并抽小组件避免撑大 `PredictAccount`（975 行）；契约测试复用 fixture 常量字面断言。**符合规约**。
- **数据缺失不兜假默认**：手续费三字段（orderAmount/feeAmount/receiveAmount）缺失一律显 `--`，无假默认。**符合规约**。
- **待对账观察点（非缺陷，登记）**：卖出预估 `amount = String(record.estimatedValueTxt)`（预估价值），而 PRD 卖出公式 amount 语义应为「份额」。mock 阶段 handler 只按 side 返回固定值不读 amount，不影响展示；真实接口接入时需按 B6 对齐 amount 语义（份额 vs 价值）。**已登记 §B-B6，待后端对账**。

### 改动范围越界说明（CODE-SCOPE-001，确认非误改）

以下改动文件落在 `apps/Prediction/` 责任目录外，均为**合理的接入点**，非越界误改：

- `app/[lang]/.../prediction/{crypto,politics,sports,finance,search,world-cup}/page.tsx`、`prediction/page.tsx`：四大类 + 搜索路由页 + world-cup 重定向，路由骨架必须落在 App Router 目录（T04）。
- `app/[lang]/Providers.tsx`：挂 `useMockWorker()`（MSW 路线 B dev-only worker，T02）。
- `constants/pathnames.ts`：新增 `PREDICTION_SEARCH` 路由常量（搜索跳转用，T16）。
- `mocks/{browser,useMockWorker}.ts`、`mocks/handlers|fixtures/prediction.ts`：MSW mock 落地（T02，路线 B）。
- `services/api/prediction/*`：接口 hook + schema + mapper（数据层，全程需要）。
- `apps/Assets/PredictAccount.tsx`：卖出手续费展示（F23 落点，无独立卖出组件，T18）。

## 验证证据索引

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `pnpm exec vitest run`（Prediction 全量 11 文件）| 搜索/进行中/卡片/mapper/契约/手续费契约 | ✅ 79 passed | 含 T18 契约 2 项、搜索 21 项、进行中 5 项 |
| `pnpm exec tsc --noEmit`（改动文件过滤）| 阶段3-5 全部改动文件 | ✅ 0 新增报错 | 基线 ~193 既存债不计（见 memory）|
| `verify-code-rules.mjs --project PR-02074` | 改动文件静态规则 | ✅ 0 findings | — |
| `verify-project-gate.mjs PR-02074 G6` | G6 阶段门 | ✅ PASS 40/42 | 2 WARN：rg 环境缺失、scope 越界已登记 |
| 人工 code-review（501 行/12 文件）| 阶段3-5 diff | ✅ 0 阻断，1 待对账观察点 | 见上方 Code Review 明细 |
| Browser / L2 对图走查（22 张 bitmart）| 三卡形态+进行中两区块+搜索弹窗/更多页 | ⏳ 待人工 | 视觉/手感人工跑（memory 验证分工）|

## 2026-09-16 test 构建热修越界说明

- **越界文件**：`apps/web-next/src/platform/runtime/Runtime.ts`（全局 Runtime 组合根）。
- **必要性**：PR-02074 合入 `test` 后，`Runtime.ts -> ServerContext -> ServerCmsBaseUrl` 将 `@tanstack/react-start/server` 带入客户端依赖图；Prediction 模块内无法切断该依赖。
- **影响面**：所有由 router context 创建的浏览器/SSR Effect runtime；`makeRuntime` 的公开签名、target 分支与 Layer 内容保持不变。
- **处理**：仅用 TanStack `createServerOnlyFn` 标记 `ServerContext.layer` 读取边界；不改 CMS host 规则、API 契约或业务状态。
- **验证**：当前 feature 的 Runtime 聚焦测试、typecheck、`build:test` 通过；在 `origin/test` 临时检出上确认原 import-protection 错误消失。该检出随后暴露 `MyOrdersLink.tsx` 引用已删除 `useIsLoggedIn` 的独立构建问题，需由对应集成改动处理。
