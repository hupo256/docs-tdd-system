---
projectId: PR-01973
status: active
stage: G4
branch: feature/PR-01973
worktree: ""
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/Gh1HdRBD4ogzmlxBRr6lW9gMg2c
figmaNode: "10323:33697"
larkEnabled: true
---

# TradFi 落地页（PR-01973）— Web 开发文档

> **状态**：页面代码、视觉走查和纯函数/mapper 单测已有历史证据；2026-08-01 阶段链审计后回退至 G4，当前 G5 阻塞于真实 TradFi section、ticker/kline 联调及入口验收。旧“G6 部分完成/G7 跳过”不再作为门禁结论。  
> **范围**：FameEX Web TradFi 专属落地页、顶部导航入口、合约交易下拉 TradFi 入口、TradFi 行情 / 可交易资产展示与交易页导流。  
> **PRD（Lark 在线）**：[【PR-01973】TradFi 落地页](https://qfglxo2m3dc.sg.larksuite.com/docx/Gh1HdRBD4ogzmlxBRr6lW9gMg2c)（需 Lark 登录；Agent 无法直接读取，以本地导出为准）  
> **PRD（本地导出）**：`inbox/【PR-01973】TradFi 落地页_0610 .md`（当前本地导出版，标题含 `【开发中_6.12上ol】`）  
> **Figma UI**：`KzvWxAYxqfgpoiYuKdxMAE` · canvas `9409:22402` · 桌面整页 `10323:33697` · [Dev Mode](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-33697&m=dev)

## 文档地图

| 分类       | 文档                                                                   | 说明                                                                              |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 原始输入   | [inbox/](./inbox/)                                                     | PRD、API、QA、Figma MCP 导出、截图等原始资料                                      |
| 功能清单   | [product/00-feature-inventory.md](./product/00-feature-inventory.md)   | 追溯整理的 PRD 全量功能清单、验收对照与 scope 裁剪记录                            |
| 产品范围   | [product/01-scope-and-phases.md](./product/01-scope-and-phases.md)     | 背景、目标、Web 范围、不做项、验收                                                |
| 技术方案   | [product/02-technical-design.md](./product/02-technical-design.md)     | 路由、目录、数据流、状态分层、跳转策略                                            |
| API 契约   | [product/03-api-contract.md](./product/03-api-contract.md)             | TradFi 行情、标签、交易对、走势等 API 占位与待确认项                              |
| 前端任务   | [product/04-frontend-tasks.md](./product/04-frontend-tasks.md)         | 文档确认后用于开发的任务清单                                                      |
| UI 交互    | [product/05-ui-and-interaction.md](./product/05-ui-and-interaction.md) | 首屏、轮播、资产列表、FAQ、H5；已与 Figma 规格对齐                                |
| 协作联调   | [product/06-collaboration.md](./product/06-collaboration.md)           | 依赖、风险、联调和确认记录                                                        |
| Figma 规格 | [product/07-figma-spec.md](./product/07-figma-spec.md)                 | MCP 已读取（2026-06-09），含节点、尺寸、token、PRD 差异                           |
| 工程规则   | [engineering/development-rules.md](./engineering/development-rules.md) | 本模块实现规则                                                                    |
| Agent 流程 | [agent/README.md](./agent/README.md)                                   | Codex / Cursor / Browser / Playwright；[Lark 群同步](./agent/lark-integration.md) |
| 通知记录   | [agent/notification-log.md](./agent/notification-log.md)               | G0-G8 / Lark Job 实际发送记录                                                     |

## 当前状态摘要

| 项           | 状态                                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRD          | Lark 在线稿 + 本地 Markdown 导出；评审 2026-06-09 通过（参会 Lucky / Aven / Andy / Brad / Hurley）                                                                                                                                                              |
| UI           | MCP 已读取 + 像素级补充（2026-06-10）；详见 [07-figma-spec.md](./product/07-figma-spec.md)；PRD/Figma 7 项差异已于 2026-06-10 确认（见 [06-collaboration.md](./product/06-collaboration.md) §8）                                                                |
| API          | 已确认先用老接口：`/fe-co-api/common/futures/public_info` + futures ticker / kline；`inbox/public_info.json` 已覆盖 TradFi section、`NVDAUSDT`、`stock/spot/futures`                                                                                            |
| Web 范围     | 已按 PRD 整理到 [01-scope-and-phases.md](./product/01-scope-and-phases.md)，开发基线已确认                                                                                                                                                                      |
| H5 适配      | PRD 5.6 要求；已按桌面规格响应式降级（375px 走查通过，无独立 H5 画板）                                                                                                                                                                                          |
| 多语言       | PRD 5.6 要求；固定 UI 文案进入 `apps/web/src/i18n/locales/zh-CN/tradfi.json`；后台返回数据不进前端 i18n；其他语言由多语言团队处理                                                                                                                               |
| Lark 自动闭环 | G0–G8 主动通知已接入；群内 @ Lark 应用可通过 Bot Gateway 自动生成 task、由 Codex / Worker 执行并回群汇报；真实 URL / Secret 只放本机私有配置                                                                                                                     |
| 代码实现     | 已重写：`index.tsx`(86 行) + `components/`(Hero/Banner/AssetSection/Pagination/Advantages/Faq/Parts) 均 <300 行；全量 token 化；新增分页/外框/统一黄色 badge/骨架空错态；`common/format.test.ts` + `common/market.test.ts` 30 例通过；Biome/lint/typecheck 干净 |

## 已确认开发基线

| 项               | 结论                                               |
| ---------------- | -------------------------------------------------- |
| 页面路由         | `/tradfi`                                          |
| 数据源           | 老接口 `/fe-co-api/common/futures/public_info`     |
| TradFi section   | 从 `data.configSectionList` 找                     |
| 资产过滤         | 用 `contractList[].sectionIds` 关联 TradFi section |
| 分类             | 先用 `symbolTag: stock / spot / futures`           |
| 交易跳转         | 统一用 `contractName` 替换 `/swap/[symbol]`        |
| Figma / PRD 冲突 | PRD 功能优先，Figma 视觉优先                       |

## 数据来源初步结论

| 数据                   | 现有来源                                                        | 说明                                                    |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| TradFi 板块            | `public_info.configSectionList[]` + `contractList[].sectionIds` | 当前样例唯一 TradFi section：`id=1`                     |
| TradFi 资产            | `public_info.contractList[]`                                    | 从 TradFi section 下筛选                                |
| 股票 / 贵金属 / 商品   | `contractList[].symbolTag`                                      | 样例已覆盖：`stock=股票`、`spot=贵金属`、`futures=商品` |
| logo / 精度 / 默认排序 | `coinResultVo.icon`、`symbolPricePrecision`、`sort`             | 老接口已有                                              |
| 最新价 / 涨跌 / 高低   | futures ticker store                                            | 使用 `subSymbol` 作为 key                               |
| 迷你走势               | futures kline + `MiniChart`                                     | 复用 Markets 现有思路                                   |
| 交易跳转               | `FUTURES.replace('[symbol]', contractName)`                     | 不手拼 `NVDAUSDT` path                                  |

## 已知 PRD 信息

- 顶部导航新增 **TradFi** 一级导航，PRD 要求位于 **合约** 与 **预测市场** 之间，带 `hot` 标签；当前代码无预测市场入口时按 D1 放在合约后。
- 合约交易下拉新增 **TradFi** 入口：标题 `TradFi`，副标题 `美股、贵金属、大宗商品，轻松交易`，点击跳 TradFi 交易页 `NVDAUSDT`，并让交易页下拉弹窗定位到 `TradFi` tab。
- 页面首屏展示主标题、副标题、登录 / 立即开始交易按钮和右侧交互图。
- 已登录点击主 CTA 跳转到 TradFi 交易页 `NVDAUSDT`。
- Banner 与「可交易资产 - 全部」同源，展示全部 TradFi 交易对卡片（当前样例约 17 个），横向无限循环播放；hover 时参考 BitMart TradFi 卡片上浮 / 背景高亮反馈。
- 可交易资产模块支持动态分类 Tab：全部 / 股票 / 贵金属 / 商品，以及后台新增标签。
- 资产列表展示交易对、最新价、24h 涨跌、24h 最高、24h 最低、走势、交易按钮。
- 最新价格和 24h 涨跌支持互斥三态排序：降序、升序、默认。
- 优势模块展示三个卖点：无需境外账户、USDT 统一结算、7x24 不间断交易。
- FAQ 默认全部收起，同一时间仅展开一条。
- PRD 5.5 行情板块：Markets 页新增 **TradFi** 主 Tab（`/markets/tradfi`），子 Tab 默认 `全部`，动态展示股票 / 贵金属 / 商品，顶部搜索过滤当前标签区域数据。
- PRD 5.2 可交易资产：落地页内独立模块（表格 + 分页），与 5.5 数据源相同、展示位置不同。
- 需要多语言和 H5 适配。

## 核心待确认项

| ID  | 待确认项                                                                      | 状态                                                                          |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Q1  | 顶部导航里 `预测市场` 的实际入口和 TradFi 插入位置                            | ✅ 本期：TradFi 在合约后、返佣前，不加预测市场（D1）                          |
| Q2  | `symbolTag` 后续是否会支持任意新增标签                                        | 仍开放；首版支持动态 Tab + `buildTradFiTabs` 未知标签                         |
| Q6  | 5.2 可交易资产与 5.5 行情板块是否为两个独立模块                               | ✅ 5.2 在落地页；5.5 在 Markets 行情页 `/markets/tradfi`（2026-06-10 范围更新） |
| Q7  | 多语言范围                                                                    | ✅ 固定 UI 文案维护 `zh-CN/tradfi.json`；后台返回数据和其他语言不由本任务处理 |
| Q8  | 是否有 H5 独立 Figma 画板                                                     | ✅ 无；按桌面规格响应式降级（D7）                                             |
| Q9  | 合约交易下拉 TradFi 入口所在组件、点击后定位 TradFi tab 的现有参数 / 状态机制 | ✅ 已确认：用现有 store 状态定位，不新增 path / query 协议                    |
| —   | PRD 在线稿是否有 2026-06-09 后的更新                                          | 待人工核对 Lark 与本地 `inbox/*.md` 是否一致                                  |

## 已确认降级策略

| 场景                      | 首版处理                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| 多个同名 `TradFi` section | 合并全部 `section === "TradFi"` 的 id                                  |
| 找不到默认合约            | CTA 降级跳转首个 TradFi 合约；当前样例已命中 `NVDAUSDT -> E-NVDA-USDT` |
| 分类数据缺失              | Tab 逻辑照常支持；当前样例已覆盖 `stock/spot/futures`                  |

## 当前后续顺序

1. ~~复查 300 行规则、拆分组件~~ → **已完成**（全部 TradFi `.tsx` < 300 行）。
2. ~~对照 [07-figma-spec.md](./product/07-figma-spec.md) 桌面视觉还原~~ → **已完成**（1440 走查，截图见 `inbox/impl-shots/`，§12）。
3. ~~Biome / 桌面 Browser / 375px H5 / 空态验证~~ → **已完成**（G1/G2/G3 / 空·错·骨架态）。
4. **待办**：验证首次进入默认 dark，用户切换 light 后下次进入仍为 light（G8）。
5. **待办**：合约交易下拉入口 + Markets TradFi 行情 Tab 浏览器走查（G9）。
6. **跳过**：当前未提供 QA 全量测试用例，G7 不作为交付阻塞；若后续收到 QA 用例，先放入 `inbox/qa/`，再比对 PRD / Figma / API / 实现并执行。
7. 后续若拿到 ticker / kline WS 真实消息或 QA 用例，先回写 `03-api-contract.md` / `06-collaboration.md`，再继续真实行情验收。

## Figma 规格入口

- 完整规格：[07-figma-spec.md](./product/07-figma-spec.md)
- PRD 差异确认：[06-collaboration.md](./product/06-collaboration.md) §8
