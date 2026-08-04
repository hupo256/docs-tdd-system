# 06 — 协作与联调

> **状态**：开发基线已确认。0610 PRD 已复核；Figma MCP 已补齐；`public_info` 样例已确认可支撑配置、列表、分类和跳转；合约交易下拉入口定位方式已确认为现有 store 状态。  
> **原则**：外部资料先进入 `inbox/`，再整理到产品 / 技术文档；不直接跳到代码。

## 1. 已知输入

| 类型 | 状态 | 位置 / 链接 |
|------|------|-------------|
| PRD（Lark 在线） | 已提供 | [【PR-01973】TradFi 落地页](https://qfglxo2m3dc.sg.larksuite.com/docx/Gh1HdRBD4ogzmlxBRr6lW9gMg2c)（需 Lark 登录；Cursor Agent **无法直接读取**） |
| PRD（本地导出） | 已提供 | `../inbox/【PR-01973】TradFi 落地页_0610 .md`（当前本地导出，标题 `【开发中_6.12上ol】`） |
| PRD 评审 | 已通过 | 2026-06-09，参会：Lucky / Aven / Andy / Brad / Hurley；[评审纪要](http://qfglxo2m3dc.sg.larksuite.com/minutes/obsg492rohtb91s38123zqf6) |
| 原型 | PRD 中有链接 | `RpAKwiau1QYLimGkHRy5Vl` node `8596:11395` |
| UI | 有 Figma 链接 | `KzvWxAYxqfgpoiYuKdxMAE` node `10323:33697` |
| API | 已有样例 | `../inbox/public_info.json`；老接口 `/fe-co-api/common/futures/public_info` 已覆盖 TradFi section / `NVDAUSDT` / `stock/spot/futures` |
| WS 行情 | 待联调 | futures ticker：`market_${subSymbol}_ticker`；futures kline：`market_${subSymbol}_kline_60min` |
| QA | 待提供 | 待放入 `../inbox/` |

## 2. 当前阻塞项

| ID | 阻塞项 | 影响 | 处理方式 |
|----|--------|------|----------|
| ~~B1~~ | ~~样例里存在多个同名 TradFi section~~ | — | **已解决**（2026-06-10）：当前样例唯一 `id=1` / `section=TradFi` |
| ~~B2~~ | ~~Figma MCP 规格未补~~ | — | **已解决**（2026-06-09）：见 `07-figma-spec.md` |
| ~~B3~~ | ~~默认合约参数确认~~ | — | **已解决**（2026-06-10）：`NVDAUSDT` 命中 `E-NVDA-USDT` / `e_nvdausdt` / `stock` |
| ~~B4~~ | ~~5.2 与 5.5 模块关系未确认~~ | — | **已解决**（2026-06-10，D2）：本期仅 5.2 可交易资产，不做 PRD 5.5 行情板块 |
| ~~B5~~ | ~~多语言范围未确认~~ | — | **已解决**（2026-06-11）：固定 UI 文案进入 `zh-CN/tradfi.json`；后台返回数据不进前端 i18n；其他语言由多语言团队处理 |
| ~~B6~~ | ~~合约交易下拉入口点击后如何定位交易页 TradFi tab~~ | — | **已解决**（2026-06-10）：用现有 store 状态定位，不新增 path / query 协议 |

## 3. API 到位后的流程

1. 把 API 文档或新的真实 `public_info` 样例放入 `PR-01973/inbox/`。
2. 更新 [03-api-contract.md](./03-api-contract.md)：TradFi section、字段、枚举、刷新方式。
3. 与 [02-technical-design.md](./02-technical-design.md) 的老接口方案逐项比对。
4. 输出差异清单：
   - 可直接复用现有 `public_info` / ticker / kline 的字段。
   - `symbolTag` 是否仍为 `stock | spot | futures`，还是需要放宽 schema。
   - `NVDAUSDT` 是否能从 `contractList` 匹配并取到正确 `contractName`。
5. 当前 `public_info` 已确认可按老接口方案实现 mapper 和组件；后续重点是 ticker / kline WS 联调。

## 4. Figma 到位后的流程

1. ~~Cursor 使用 Figma MCP 读取 UI~~ → **已完成**（2026-06-09，node `10323:33697` / canvas `9409:22402`）。
2. 节点结构、token、尺寸已写入 [07-figma-spec.md](./07-figma-spec.md)；**H5 画板未提供**。
3. [05-ui-and-interaction.md](./05-ui-and-interaction.md) 视觉占位可在开发前按需同步（非阻塞）。
4. Figma 与 PRD 差异见 `07-figma-spec.md` §2.2 / §8，**确认前不实现**。

## 8. Figma MCP 差异确认记录（2026-06-09 提出 / 2026-06-10 确认）

| ID | 差异 | 状态 |
|----|------|------|
| D1 | 导航文案 **TradeFi** vs PRD **TradFi**；位置在返佣/理财间 vs 合约/预测市场间 | ✅ 已确认：沿用现有 Header —— 文案 **TradFi**、位于 **合约 → 返佣** 之间、带 **HOT** badge；本期不加「预测市场」入口 |
| D2 | Figma 无独立「行情板块」 | ✅ 已确认：本期仅实现「可交易资产」表格，不做独立行情板块 / 搜索（Q6 暂关闭） |
| D3 | Hero 副标题文案不一致 | ✅ 已确认：采用 Figma 文案 **「美股、外汇、贵金属、USDT统一结算」** |
| D4 | Figma 仅 ghost「立即交易」 vs PRD 登录/已登录双 CTA | ✅ 已确认：**ghost 视觉**（160×40 / 描边 brand-1 / 圆角 8）+ **PRD 登录态行为与文案**（未登录「登录」、已登录「立即开始交易」） |
| D5 | Hero 右侧头图 hidden | ✅ 已确认：本期不实现 Hero 右侧头图 |
| D6 | 画板 Frame 命名遗留「预测市场」 | 已知，可忽略 |
| D7 | 无 H5 画板 | ✅ 已确认：按桌面规格做响应式降级，无独立 H5 稿（Q8 暂关闭） |

**附加实现约定（2026-06-10 确认）**

| 项 | 结论 |
|----|------|
| 圆角 | Banner 卡 / 优势卡 / FAQ 条目统一 `rounded-lg`(16)；列表分类小标签 `rounded-xs`(2)；CTA / 交易按钮 `rounded-m`(8)；分页页码 `rounded`(4)。Figma 原始 12/20 因无对应 token，统一落到 `rounded-lg` |
| 字号 | 全量改用 preset fontSize token（`h-xxl`/`h-l`/`h1`/`h3`/`h4`/`h5`/`subtitle`/`body-*`），删除 `text-[40px]` 等 arbitrary 值；无对应 token 的整页纵向间距（130/197px 等）保留 arbitrary |
| 分类 badge | 列表内所有分类（股票/贵金属/商品）统一 `bg-y` + `sem-y`；Banner 卡内分类为纯文字 `text-3`，无彩色底 |
| 表格外框 | Tab + 表头 + 列表 + 分页包一层 `rounded-lg border-divider-2` 卡片 |
| 分页 | 客户端分页，每页 8 行（对齐 Figma 8 行示意），切 Tab / 排序后回到第 1 页 |
| i18n | 2026-06-11 更新：固定 UI 文案进入 `apps/web/src/i18n/locales/zh-CN/tradfi.json`；后台返回的交易对、资产名、行情等数据不进前端 i18n；其他语言由多语言团队处理，不在本任务手动复制或占位 |

## 5. QA 到位后的流程

1. 把 QA 用例放入 `PR-01973/inbox/qa/`。
2. 逐项比对 PRD、开发文档和当前实现。
3. 输出差异清单并等待确认。
4. 确认后再执行 Browser / Playwright 验收。

## 6. 联调关注点

| 模块 | 关注点 |
|------|--------|
| 顶部导航 | 插入位置、hot 标签、移动端菜单 |
| 合约交易下拉入口 | 标题 / 副标题、点击默认 `NVDAUSDT`、交易页 TradFi tab 定位 |
| CTA | 登录态判断、登录回跳、默认 `NVDAUSDT` |
| Banner | 标签轮播、行情刷新、卡片点击 |
| 资产列表 | 动态标签、排序、行情数据、空态 |
| 走势 | 数据窗口、涨跌颜色、无数据状态 |
| FAQ | 单开状态、i18n 文案 |
| H5 | 无横向溢出、表格降级策略 |
| 多语言 | 固定文案 namespace、翻译范围 |

## 7. 风险清单

| 风险 | 影响 | 缓解 |
|------|------|------|
| TradFi section 文案 / id 与预期不一致 | 无法正确筛板块 | ✅ 当前样例确认：`id=1`、`section=TradFi`；代码仍不写死 id |
| `public_info` 存在多个同名 TradFi section | 可能混入非 TradFi 资产 | ✅ 当前样例唯一；代码仍保留合并同名 section 的防御策略 |
| 默认合约参数不明确 | CTA 默认跳转不能最终验收 | ✅ 当前样例已包含 `NVDAUSDT -> E-NVDA-USDT` |
| 分类覆盖不完整 | 股票 / 商品 Tab 无法用真实数据验证 | ✅ 当前样例已覆盖 `stock/spot/futures` |
| API 标签字段与现有 schema 不一致 | 动态 Tab 无法解析 | 样例到位后先调整 schema / mapper |
| 现有 ticker 不覆盖 TradFi | 价格无法实时刷新 | 新增 TradFi ticker 接入或轮询 |
| 交易页 symbol 格式不同 | 跳转失败 | 路由构造统一封装；只用 `contractName` 生成交易路径 |
| 合约交易下拉入口 store 状态未正确写入 | 入口能跳转但交易页未定位 TradFi tab | 复用现有市场列表 store 定位能力；验收时检查 store 写入和 tab 展示一致 |
| H5 无设计稿 | 响应式还原风险 | Cursor 补 Figma H5 规格；无稿时先给负责人确认方案 |
| PRD 搜索描述不一致 | 重复开发或漏功能 | D2 已确认本期不做独立 5.5；后续恢复时重开搜索字段确认 |

## 8. 确认记录

| 日期 | 事项 | 结论 |
|------|------|------|
| 2026-06-09 | PRD 评审 | PRD 记录为通过 |
| 2026-06-09 | docs_tdd 前置结构 | 根目录改为通用规则；项目资料放各自项目目录 |
| 2026-06-09 | 现有代码数据链路反查 | 主数据源强匹配老 futures `public_info` + ticker + kline |
| 2026-06-09 | 开发基线确认 | 路由 `/tradfi`；老接口；section 从 `configSectionList` 找；分类用 `symbolTag`；跳转用 `contractName`；PRD 功能 + Figma 视觉 |
| 2026-06-09 | 旧 `public_info.json` 样例首次分析 | 字段链路确认；当时样例存在多 TradFi section、缺 `NVDAUSDT`、分类覆盖不足 |
| 2026-06-10 | Figma vs PRD 差异 D1–D7 + 实现约定 | 见本节上方表格：D1 沿用现有 Header、D2 仅资产表、D3 用 Figma 副标题、D4 ghost+PRD 登录态、D5 不做头图、D7 响应式降级；圆角/字号/分类/外框/分页约定确认 |
| 2026-06-11 | TradFi i18n 范围更新 | 固定 UI 文案进入 `zh-CN/tradfi.json`；后台返回的交易对、资产名、行情等数据不进前端 i18n；其他语言由多语言团队处理 |
| 2026-06-10 | PRD Lark 链接登记 | 在线稿 [Gh1HdRBD4ogzmlxBRr6lW9gMg2c](https://qfglxo2m3dc.sg.larksuite.com/docx/Gh1HdRBD4ogzmlxBRr6lW9gMg2c) 已写入 README / 06 / 01 / CONTEXT；Agent 不可直接读，以 `inbox/*.md` 为准 |
| 2026-06-10 | 0610 PRD 复核 | 明确新增【合约交易】下拉 TradFi 入口验收项；5.5 独立行情板块仍按 D2 当前阶段不做 |
| 2026-06-10 | 合约交易下拉入口定位方式 | 已确认：点击后用现有 store 状态定位交易页 TradFi tab，不新增 path / query 协议 |
| 2026-06-10 | `public_info.json` 样例复核 | 当前样例唯一 TradFi section `id=1`；命中 17 个 TradFi 合约；覆盖 `NVDAUSDT`、`stock/spot/futures`；配置数据足够，剩余 WS ticker/kline 联调 |
| 2026-06-11 | 真实接口探测 | 临时关闭 TradFi 本地 public_info / ticker mock 后验证真实 `/fe-co-api/common/futures/public_info` 链路不会崩；结论见下一条。代码需保留 local / dev / test mock 兜底 |
| 2026-06-11 | dev 真实接口验证 | `https://futures.pfyys.com/fe-co-api/common/futures/public_info` 返回成功，但 `configSectionList` 只有 `AA / CC / bb`，无 `TradFi` section；关闭 mock 时页面真实表现为可交易资产空态，需后台在目标环境配置 TradFi section 和合约归属 |
