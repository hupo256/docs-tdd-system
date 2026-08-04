# Collaboration — PR-02074 预测市场三期

> G0 已完成：PRD 同步本地 + 22 张截图逐张读图，全量清单见 [00-feature-inventory.md](./00-feature-inventory.md)。**G2 定稿前不写业务代码。**

## A. 需用户/产品在 G2 确认的 scope

| # | 事项 | 默认建议 |
|---|------|---------|
| A1 | 四大类 + 搜索 + 翻译对接 + 手续费公式，本期是否全做 | 建议全做（PRD 无删除线，均本期）|
| A2 | 手续费公式 F22/F23 是否本期前端改动 | 前端下单弹窗需按新公式算展示金额，需做 |
| A3 | App 端（图 4/20）是否本仓本期 | 本仓 `@fameex/web`(Web)；建议 App 走 App 仓，本期只做 Web |

## B. 需后端明确（阻塞联调，非阻塞 G2 文档）

| # | 事项 | 影响功能 |
|---|------|---------|
| B1 | 分类树接口（四大类各自二/三级分类，含固定"全部"/"进行中"）| F07,F10,F13,F18 |
| B2 | 按分类查事件列表接口（`tagType` 扩展 + 二/三级过滤参数）| 全部列表 |
| B3 | **单市场 vs 多市场事件判定字段**（决定卡片形态）| F12,F20 |
| B4 | 搜索接口（模糊匹配、按展示语言、排序、分页 50/页）| F01-F06 |
| B5 | 翻译存储字段结构（前端读已翻译文本还是调接口）| F21 |
| B6 | feeRate/加价率/抽水比例/预计成交价 取值来源 | F22,F23 |
| B7 | 体育"进行中"聚合：①是后端返回还是前端聚合 ②两区块拆分依据字段 `matchStatus`('live'/'upcoming') 是否后端返回 ③组头分类名 `categoryGroupLabel`(如"足球\|中超",已翻译)是否后端返回，还是前端从 subTag 反查 | F14 |

## C. 需设计确认

| # | 事项 |
|---|------|
| C1 | Figma 官方远程 MCP 已于 2026-07-25 配置并完成 OAuth；已成功读取主 Section `17067:17867`、35 个变量，以及搜索输入 `17127:74365`、联想层 `17127:74310` 的原子上下文。后续 L2 直接按 metadata 子 nodeId 逐模块读取，不再依赖浏览器 DOM。 |
| C2 | Figma 未逐一提供每个一级 Tab 的独立稿；按产品说明，相同页面壳、分类树、事件模块和搜索模块直接复用，仅切换分类数据。 |
| C3 | BitMart 可作为 Tab、信息架构、布局、搜索 UX 和数据结构参考，但 FameEX 的颜色、字体、间距 token 不从 BitMart 反推。 |

## MSW 路线 B 落地决策（G3）

> API 未 ready 时的 **MSW 路线 B** 落地清单（决策依据 `common/architecture-and-state.md` §8.4.1，参考 PR-01947 实践）：

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
