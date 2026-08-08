# 04 — 前端任务清单

> 状态图例：`[ ]` 未开始 · `[~]` 进行中 · `[x]` 完成 · `[-]` 取消/非本端负责。  
> 当前首版代码已落地，本清单用于继续校准实现、拆分组件、自测和后续 API / QA 联调。

## A. 文档与确认

| ID  | 优先级 | 状态 | 任务                                                            | 备注                                                                                                      |
| --- | ------ | ---- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A1  | P0     | [x]  | PRD 放入 `PR-01973/inbox/`                           | 已完成                                                                                                    |
| A2  | P0     | [x]  | 整理范围、不做项、验收标准                                      | 已写入 `01-scope-and-phases.md`                                                                           |
| A3  | P0     | [x]  | 整理技术方案与复用候选                                          | 已写入 `02-technical-design.md`                                                                           |
| A4  | P0     | [x]  | API 文档 / 真实样例放入 `PR-01973/inbox/` 并整理契约 | 已分析 `inbox/public_info.json`；配置数据已覆盖 TradFi section / `NVDAUSDT` / 三类标签                    |
| A5  | P0     | [x]  | Figma MCP 读取结果写入 `07-figma-spec.md`                       | 已补齐                                                                                                    |
| A6  | P0     | [x]  | 确认最终路由、跳转和多语言 / H5 范围                            | 路由 `/tradfi`、跳转 `contractName` 已确认；H5 按桌面规格响应式降级；固定 UI 文案进入 `zh-CN/tradfi.json` |
| A7  | P0     | [x]  | 文档整体确认                                                    | 已确认首版开发基线                                                                                        |
| A8  | P0     | [x]  | 0610 PRD 复核与范围回写                                         | 已补充合约交易下拉 TradFi 入口；5.5 独立行情板块继续按 D2 关闭                                            |

## B. 路由与导航

| ID  | 优先级 | 状态 | 任务                                        | 备注                                                                          |
| --- | ------ | ---- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| B1  | P0     | [x]  | 新增 TradFi 路由页面                        | 已确认 `/tradfi`                                                              |
| B2  | P0     | [x]  | 新增 `TRADFI` pathnames 常量                | `apps/web/src/constants/pathnames.ts`                                         |
| B3  | P0     | [x]  | 顶部导航新增 TradFi 一级入口                | `Header/PageEntries/helper.tsx`                                               |
| B4  | P0     | [~]  | 导航 hot 标签样式                           | 已有首版，仍需对照 Figma hot 图标                                             |
| B5  | P0     | [x]  | Header 文案 i18n                            | `header.json` 已包含 `tradFi` / `tradFi-desc`                                 |
| B6  | P0     | [x]  | 合约交易下拉新增 TradFi 入口                | `helper.tsx` + `SubEntry.tsx` + `TradFiHeaderMarketList.tsx` |
| B7  | P0     | [x]  | 合约交易下拉入口跳转并定位交易页 TradFi tab | `navigation.ts` + `storage.contractMarketSectionTabKey` + `MarketList` |

## C. 数据与 API

| ID  | 优先级 | 状态 | 任务                                       | 备注                                                                                                                               |
| --- | ------ | ---- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| C1  | P0     | [x]  | 确认 TradFi API / 复用 futures public info | 已确认老接口；当前样例可支撑配置、列表、分类、跳转                                                                                 |
| C2  | P0     | [x]  | 定义 TradFi UI 领域类型                    | `apps/TradFi/common/types.ts`                                                                                                      |
| C3  | P0     | [x]  | 实现 TradFi 数据 mapper / selector         | `public_info` + ticker + kline → UI model                                                                                          |
| C4  | P0     | [x]  | 生成动态标签 Tab                           | 全部 + API 标签                                                                                                                    |
| C5  | P0     | [x]  | 接入实时行情                               | close / rose / high / low                                                                                                          |
| C6  | P0     | [x]  | 接入迷你走势                               | kline / MiniChart                                                                                                                  |
| C7  | P0     | [x]  | 建立 Mock 数据与场景                       | `public_info.json` 已覆盖 `NVDAUSDT` / `stock` / `spot` / `futures`；行情仍需 WS 联调                                              |
| C8  | P1     | [x]  | API / mapper 单测                          | `common/market.test.ts`：`mapTradFiAssets` 字段映射 / ticker 合并 / 空值 / 未标签兜底 + `getTradFiSectionIds` / `isTradFiContract` |

## D. 领域计算与工具

| ID  | 优先级 | 状态 | 任务                      | 备注                                                                                         |
| --- | ------ | ---- | ------------------------- | -------------------------------------------------------------------------------------------- |
| D1  | P0     | [x]  | `buildTradFiTabs`         | 动态标签 + 全部                                                                              |
| D2  | P0     | [x]  | `filterTradFiAssetsByTag` | 分类筛选                                                                                     |
| D3  | P0     | [x]  | `sortTradFiAssets`        | 最新价 / 涨跌互斥三态                                                                        |
| D4  | P0     | [x]  | `formatTradFiPrice`       | 精度、空值                                                                                   |
| D5  | P0     | [x]  | `formatTradFiChange`      | 正负号、颜色、百分比                                                                         |
| D6  | P0     | [x]  | `buildTradFiTradePath`    | CTA / 卡片 / 列表统一跳转                                                                    |
| D7  | P1     | [x]  | 纯函数单测                | `common/format.test.ts` + `common/market.test.ts`：D1-D6 + 三态排序 / 默认资产；共 30 例通过 |

## E. 页面结构与 UI

| ID  | 优先级 | 状态 | 任务                        | 备注                                                                        |
| --- | ------ | ---- | --------------------------- | --------------------------------------------------------------------------- |
| E1  | P0     | [x]  | 页面容器 `TradFi/index.tsx` | 已拆为 Hero/Banner/AssetSection/Pagination/Advantages/Faq/Parts，入口 86 行 |
| E2  | P0     | [x]  | 页面骨架屏 / 错误态         | 表格骨架行 + 移动卡片骨架 + 空态 + 错误重试态                               |
| E3  | P0     | [x]  | Hero 首屏                   | 按 Figma §10.1 还原；副标题用 Figma 文案，ghost CTA                         |
| E4  | P0     | [x]  | Hero CTA 登录态 / 已登录态  | 未登录跳登录；已登录跳交易页                                                |
| E5  | P0     | [x]  | Banner 交易对轮播           | 与「可交易资产 - 全部」同源；全量卡片无限循环；hover / focus 暂停           |
| E6  | P0     | [x]  | Banner 交易对卡片           | 按 Figma §10.2 重构；hover 参考 BitMart 上浮 + 背景高亮                     |
| E7  | P0     | [x]  | 可交易资产模块标题与 Tab    | 动态标签 + 外框卡片                                                         |
| E8  | P0     | [x]  | 可交易资产列表              | 字段、hover、交易按钮、统一黄色分类 badge、分页                             |
| E9  | P0     | [x]  | 资产列表排序                | 最新价 / 24h 涨跌三态                                                       |
| E10 | P1     | [x]  | 优势模块                    | 按 Figma §10.4 还原（去图标、文案补全）                                     |
| E11 | P1     | [x]  | FAQ 模块                    | 单开折叠 + Figma §10.5 视觉                                                 |
| E12 | P1     | [x]  | 行情板块（PRD 5.5）         | `MarketTradFi` + `/markets/tradfi` + Markets 主 Tab                         |

## F. H5 与多语言

| ID  | 优先级 | 状态 | 任务                        | 备注                                                            |
| --- | ------ | ---- | --------------------------- | --------------------------------------------------------------- |
| F1  | P0     | [x]  | H5 首屏适配                 | 375px 走查：标题缩放、CTA、无横向溢出                           |
| F2  | P0     | [x]  | H5 Banner / 卡片 / 列表适配 | 列表降级为卡片栈；Banner 横向滚动无溢出                         |
| F3  | P0     | [x]  | H5 FAQ / CTA 适配           | 全宽、触控区域充足                                              |
| F4  | P0     | [x]  | 新增 TradFi i18n namespace  | 固定 UI 文案进入 `zh-CN/tradfi.json`；后台返回数据不进前端 i18n |
| F5  | P1     | [-]  | 其他语言同步                | 不由本任务处理，由多语言团队统一补齐                            |

## G. 验证与验收

| ID  | 优先级 | 状态 | 任务                          | 备注                                                                |
| --- | ------ | ---- | ----------------------------- | ------------------------------------------------------------------- |
| G1  | P0     | [x]  | Biome 触达文件                | `apps/web/src/apps/TradFi` 0 error / 0 warning                      |
| G2  | P0     | [x]  | 桌面 Browser 视觉走查         | 1440px 对照 `inbox/figma-shots/` 逐区块；历史实现截图已按公共规则清理 |
| G3  | P0     | [x]  | 375px H5 走查                 | 整页无横向溢出、无遮挡；历史实现截图已按公共规则清理                 |
| G4  | P0     | [~]  | CTA / 卡片 / 交易按钮跳转验证 | 渲染与登录态文案已验证；点击跳转目标未逐一手测                      |
| G5  | P0     | [~]  | Tab 筛选与排序验证            | UI + 纯函数单测已覆盖三态；浏览器交互未逐项走查                     |
| G6  | P1     | [~]  | 接口失败 / 空态验证           | 空态/错误态已实现并渲染；真实接口失败注入未验证                     |
| G7  | P0     | [x]  | 单文件 300 行规则复查         | 全部 TradFi `.tsx` < 300 行                                         |
| G8  | P0     | [ ]  | dark 默认与 light 持久化验证  | 待验证：首次默认 dark、切 light 后持久化                            |
| G9  | P0     | [~]  | 合约交易下拉 + Markets TradFi Tab 验收      | 入口展示、默认 NVDAUSDT 跳转、交易页 TradFi section Tab 定位、行情 Tab 筛选/搜索 |
| G10 | P0     | [-]  | QA 全量测试用例执行           | 跳过：当前未提供 QA 用例；若后续收到，先放入 `inbox/qa/`，再比对 PRD / Figma / API / 实现并执行 |

## 建议开发顺序

1. **确认阶段**：A4-A8。
2. **基础阶段**：B、C2-C3、D1-D6。
3. **静态 UI 阶段**：E1-E4、E10-E11、F4。
4. **行情阶段**：C4-C7、E5-E9、E12。
5. **响应式阶段**：F1-F3。
6. **验证阶段**：G。
