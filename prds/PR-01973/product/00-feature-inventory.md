# Feature Inventory — `PR-01973 TradFi 落地页`

> **追溯补齐说明**：本项目首版已交付，本清单为结构对齐时按 [common/prd-feature-inventory.md](../../../common/prd-feature-inventory.md) 追溯整理，内容全部来自已确认的 [01-scope-and-phases.md](./01-scope-and-phases.md)、[README.md](../README.md) 与 [06-collaboration.md](./06-collaboration.md)，不重新定义 scope。  
> 规则：[common/prd-feature-inventory.md](../../../common/prd-feature-inventory.md) §3（G0 初稿 → G2 定稿 → 再写代码）。

| 字段 | 值 |
|------|-----|
| 工单 | PR-01973 TradFi 落地页 |
| PRD 来源 | `inbox/【PR-01973】TradFi 落地页_0610 .md`（Lark 在线稿需登录，Agent 以本地导出为准） |
| Figma 主画板 | `KzvWxAYxqfgpoiYuKdxMAE` · 桌面整页 `10323:33697` · canvas `9409:22402` |
| 清单维护人 | Aven（追溯整理） |
| G2 确认人 & 日期 | PRD 评审 2026-06-09 通过（Lucky / Aven / Andy / Brad / Hurley）；PRD / Figma 7 项差异 2026-06-10 确认（见 06-collaboration §8）；范围更新 2026-06-10（5.5 纳入本期） |

## 功能清单

| ID | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |
|----|---------|---------|------------|-------|-------------|------|------|------------|
| F01 | 5.1 | 顶部 TradFi 一级导航（带 `hot` 标签） | 全局 Header | ✅ | 全局 | 做 | ✅ D1：合约后、返佣前 | Header PageEntries |
| F02 | 5.2 | 合约交易下拉 TradFi 入口（标题 + 副标题，跳默认对并定位 TradFi tab） | 合约交易下拉 | ✅ | 全局 | 做 | ✅ Q11/Q9：复用现有 store 定位 | Futures MarketList + Header |
| F03 | — | TradFi 落地页路由 `/tradfi` | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `apps/web/src/apps/TradFi` |
| F04 | 第一屏 | Hero：主/副标题 + 登录 / 立即开始交易 CTA | `/tradfi` | ✅ | 落地页 | 做（右侧交互图 D5 不做） | ✅ | `components/Hero` |
| F05 | 第一屏 CTA | 主 CTA：未登录跳登录（带回跳）；已登录跳 TradFi `NVDAUSDT` | `/tradfi` | ✅ | 落地页 | 做 | ✅ 用 `contractName` 替换 path | `buildTradFiTradePath` |
| F06 | 5.4 | Banner 按标签轮播交易对卡片（logo/名称/标签/价/涨跌/迷你走势） | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `components/Banner` |
| F07 | 5.2 | 可交易资产模块：标题 + 分类 Tab + 列表 + 排序 + 交易按钮 | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `components/AssetSection` |
| F08 | 5.3 | 动态分类 Tab：全部 / 股票 / 贵金属 / 商品 + 后台标签 | `/tradfi` | ✅ | 落地页 | 做 | ✅ Q5：`buildTradFiTabs` 支持未知标签 | `buildTradFiTabs` |
| F09 | 5.2 | 资产列表字段：交易对、最新价、24h 涨跌、24h 高、24h 低、走势、操作 | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `components/AssetSection` |
| F10 | 5.6 | 最新价 / 24h 涨跌 互斥三态排序（降序 → 升序 → 默认） | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `sortTradFiAssets` |
| F11 | 优势 | 优势模块三卖点：无需境外账户 / USDT 统一结算 / 7x24 | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `components/Advantages` |
| F12 | 5.4 FAQ | FAQ：默认收起、单开互斥、`+`/`-` 图标 | `/tradfi` | ✅ | 落地页 | 做 | ✅ | `components/Faq` |
| F13 | 5.5 | 行情板块：Markets 主 Tab `TradFi` + 子 Tab + 搜索 | `/markets/tradfi` | ✅ | 行情页 | 做 | ✅ Q6/D2：本期纳入 | `apps/Markets/components/MarketTradFi` |
| F14 | 5.6 | 多语言：固定 UI 文案进 `zh-CN/tradfi.json` | 全局 | — | 全局 | 做（仅 zh-CN） | ✅ Q8 | `i18n/locales/zh-CN/tradfi.json` |
| F15 | 5.6 | H5 适配：按桌面规格响应式降级（375px 走查） | `/tradfi` + `/markets/tradfi` | ❌（无独立画板） | 落地页 | 做 | ✅ Q9/D7 | 响应式实现 |

## 验收标准对照（PRD §7）

| 验收项 | 对应 ID | 状态 |
|--------|---------|------|
| 顶部导航 TradFi 入口位置 + hot 标签 | F01 | ☑ |
| 点击导航进入落地页 | F01/F03 | ☑ |
| 合约交易下拉 TradFi 入口 + 标题/副标题 | F02 | ☐ 待下拉入口走查 |
| 点击下拉入口进默认对并定位 TradFi tab | F02 | ☐ 待走查 |
| 第一屏标题/CTA（右侧交互图 D5 不做） | F04 | ☑ |
| 未登录 CTA 跳登录并回跳 | F05 | ☑ |
| 已登录 CTA 跳 TradFi `NVDAUSDT` | F05 | ☑ |
| Banner 按标签轮播 + 卡片字段 + hover + 点击 | F06 | ☑ |
| Banner / 列表价格随行情刷新 | F06/F09 | ☐ 待真实行情联调 |
| 分类 Tab 动态 + 切换过滤 | F08 | ☑ |
| 资产列表字段完整 | F09 | ☑ |
| 排序互斥三态 + 默认恢复 | F10 | ☑ |
| 交易按钮跳转对应交易页 | F05/F07 | ☑ |
| 优势模块三卖点 + 动效 | F11 | ☑ |
| FAQ 默认收起、单开互斥、图标 | F12 | ☑ |
| 行情板块 Markets `TradFi`（`/markets/tradfi`） | F13 | ☑（标 `[-]`，本期纳入） |
| H5 无横向溢出 + 元素不重叠（375px） | F15 | ☑ |
| 固定文案接入 i18n | F14 | ☑ |
| 加载 / 空 / 错误态可见反馈 | F07/F09 | ☑ |

> 状态以 [README.md](../README.md) 当前状态摘要为准：G6 部分完成，剩余主题持久化（G8）、下拉入口验收、真实数据联调、i18n 自测；G7 因无 QA 用例跳过，不作为交付阻塞。

## Figma 未覆盖但 PRD 要求

| ID | 说明 | 本期是否做 |
|----|------|-----------|
| F14 | 多语言文案为 PRD 要求，Figma 无对应节点 | 做（仅 zh-CN） |
| F15 | H5 无独立 Figma 画板，按桌面规格响应式降级 | 做 |

## Scope 裁剪记录

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| 合约后台 TradFi 标签 / logo / 币对配置 | 不做（非 Web 范围） | 2026-06-09 评审 | 2026-06-09 | 无 |
| 交易页本体改造 | 不做（仅从落地页导流） | 2026-06-09 评审 | 2026-06-09 | 无 |
| 自定义行情计算 | 不做（只展示接口 / WS 数据） | 2026-06-09 评审 | 2026-06-09 | 无 |
| 搜索交易对输入框（PRD 5.2 已划掉） | 不做 | PRD 0610 | 2026-06-10 | 无 |
| 新增行情数据源 | 不做（复用 futures public info / ticker / kline） | 2026-06-09 评审 | 2026-06-09 | 无 |
| Hero 右侧交互图（D5） | 本期不做 | 范围确认 | 2026-06-10 | 第一屏验收注明不做 |
| App 独立页面 | 不做（仅 Web，App 另确认） | 2026-06-09 评审 | 2026-06-09 | 无 |

## TDD / PRD 冲突

| 项 | PRD | TDD / 实现 | 结论 |
|----|-----|-----------|------|
| TradFi 导航位置 | 位于「合约」与「预测市场」之间 | 当前代码无预测市场入口 | 已确认 D1：先放合约后、返佣前，后续补预测市场再调整 |
| PRD / Figma 7 项差异 | 见 06-collaboration §8 | — | 2026-06-10 已确认（PRD 功能优先，Figma 视觉优先） |

## PRD 未完全可读内容

| 类型 | 位置 | 影响 | 处理方式 | 状态 |
|------|------|------|----------|------|
| 引用文档 | Lark 在线 PRD 2026-06-09 后是否更新 | 可能影响文案 | 人工核对在线稿与 `inbox/*.md` | 待确认（README / 01-scope Q10） |
