# Feature Inventory — PR-02006 TradFi 板块币种体验优化

> 规则：[common/prd-feature-inventory.md](../../../common/prd-feature-inventory.md) §3（G0 初稿 → G2 定稿 → 再写代码）。

| 字段 | 值 |
|------|-----|
| 工单 | PR-02006 |
| PRD 来源 | `inbox/lark-sync/prd-content.md`；原始链接 `https://qfglxo2m3dc.sg.larksuite.com/docx/NiHVdQGgUohh20xRJmOlmo0rgAg` |
| Figma / 原型 | `https://www.figma.com/design/RpAKwiau1QYLimGkHRy5Vl/Lucky%E5%8E%9F%E5%9E%8B?node-id=8923-9176&t=F6F5EoPBANeyytbt-1`；UI 正式地址未提供 |
| 清单维护人 | Codex |
| G2 确认人 & 日期 | 用户 / 2026-06-20 |

## 功能清单

| ID | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |
|----|---------|---------|------------|-------|-------------|------|------|------------|
| F01 | 5.1.1 | 顶部导航「合约交易」下 hover TradFi 菜单时显示交易对浮层 | Header 合约交易菜单；`components/layout/Header/PageEntries` | 部分 | 全局组件 | 做 | 用户 / 2026-06-20 | T01 |
| F02 | 5.1.2 | TradFi 菜单浮层增加分类 Tab：全部 + 后台 TradFi 标签，隐藏无有效币对标签 | Header TradFi 浮层 / `FuturesMarketList` 或复用市场列表 | 部分 | 全局组件 | 做 | 用户 / 2026-06-20 | T02 |
| F03 | 5.1.2 | TradFi 菜单浮层增加搜索：按当前 Tab 范围实时模糊匹配交易对名称 / 附属名称；无结果展示空态；切 Tab 保留关键词；再次 hover 初始化为全部 + 空关键词 | Header TradFi 浮层 | 部分 | 全局组件 | 做 | 用户 / 2026-06-20 | T03 |
| F04 | 5.1.2 | TradFi 菜单浮层交易对展示 logo、交易对名、24h 成交额、附属名称标签、最新价、24h 涨跌幅；点击跳转交易页并关闭弹层 | Header TradFi 浮层 | 部分 | 全局组件 | 做 | 用户 / 2026-06-20 | T04 |
| F05 | 5.1.2 | TradFi 菜单浮层默认按 24h 成交额倒序，实时排序 | Header TradFi 浮层 | 部分 | 全局组件 | 做 | 用户 / 2026-06-20 | T05 |
| F06 | 5.2 调整1-2 | 交易页左上角交易对弹层中，TradFi 板块默认按 24h 成交额倒序 | `/swap/[symbol]`，`apps/web/src/apps/Futures/components/MarketList` | 部分 | 交易页弹层 | 做 | 用户 / 2026-06-20 | T06 |
| F07 | 5.2 调整2 | 交易页交易对弹层新增板块 Tab：仅展示存在有效币对的板块，TradFi 来源于合约后台币对所属板块 | `/swap/[symbol]` MarketList | 部分 | 交易页弹层 | 做 | 用户 / 2026-06-20 | T07 |
| F08 | 5.2 调整2 | 交易页 TradFi 板块内新增分类 Tab：全部 + 后台 TradFi 标签，仅展示有有效币对的标签 | `/swap/[symbol]` MarketList | 部分 | 交易页弹层 | 做 | 用户 / 2026-06-20 | T08 |
| F09 | 5.2 调整2 | 交易页交易对列表新增 24h 成交额列/标题，按现有排序 icon 交互支持降序、升序、默认排序且与其他字段互斥 | `/swap/[symbol]` MarketList / Sorter / List | 部分 | 交易页弹层 | 做 | 用户 / 2026-06-20 | T09 |
| F10 | 5.2 调整2/4 | 交易页 TradFi 交易对显示附属名称标签，取币种别名；去掉原有标签，只显示本需求别名 | `/swap/[symbol]` MarketList / List | 部分 | 交易页弹层 | 做 | 用户 / 2026-06-20 | T10 |
| F11 | 5.2 调整3 | 交易页红框点位从点击显示浮层优化为鼠标 hover 显示浮层 | `/swap/[symbol]` PairInfo / MarketList 触发器 | 部分 | 交易页弹层 | 做 | 用户 / 2026-06-20 | T11 |
| F12 | 5.3 | TradFi 落地页交易对基础展示新增「永续」标签，取值与行情 TradFi 板块一致 | `/tradfi` `apps/web/src/apps/TradFi` | 部分 | 落地页 | 做 | 用户 / 2026-06-20 | T12 |
| F13 | 5.3 | TradFi 落地页新增「附属文案」标签，取币种别名；去掉原有标签 | `/tradfi` 可交易资产模块 | 部分 | 落地页 | 做 | 用户 / 2026-06-20 | T13 |
| F14 | 5.3 | TradFi 落地页可交易资产列表新增 24h 成交额字段及排序 icon | `/tradfi` 可交易资产模块 | 部分 | 落地页 | 做 | 用户 / 2026-06-20 | T14 |
| F15 | 5.3 | TradFi 落地页 24h 最高价、24h 最低价新增排序 icon，交互与其他字段一致 | `/tradfi` 可交易资产模块 | 部分 | 落地页 | 做 | 用户 / 2026-06-20 | T15 |
| F16 | 5.4 | 行情页 TradFi 板块新增「附属文案」标签，取币种别名 | `/markets/tradfi` `apps/web/src/apps/Markets/components/MarketTradFi` | 部分 | 行情页 | 做 | 用户 / 2026-06-20 | T16 |
| F17 | 5.4 | 行情页 TradFi 板块 logo 展示样式优化为 PRD 图二效果 | `/markets/tradfi` | 部分 | 行情页 | 做 | 用户 / 2026-06-20 | T17 |
| F18 | 章节「切换分页自动跳转了」 | TradFi 落地页切换分页时不应自动跳转 / 异常滚动，需保持列表交互稳定 | `/tradfi` 分页 | 部分 | 落地页 | 做 | 用户 / 2026-06-20 | T18 |
| F19 | 6.1 | Admin 合约配置-币种添加/编辑新增「归属板块」单选：USDT本位 / TradFi | `apps/admin` 合约管理后台币种配置 | 部分 | Admin 后台 | 做 | 用户 / 2026-06-20 | T19 |
| F20 | 6.1 | 仅当归属板块为 TradFi 时，币种别名展示多语言配置区域；语言列表动态取后台国家语言配置 | `apps/admin` 币种配置 | 部分 | Admin 后台 | 做 | 用户 / 2026-06-20 | T20 |
| F21 | 6.1 | TradFi 币种别名多语言必填校验：失焦或保存均校验，未填阻止提交并提示 `Please fill in all national language aliases` | `apps/admin` 币种配置 | 部分 | Admin 后台 | 做 | 用户 / 2026-06-20 | T21 |
| F22 | 6.1 | 前台展示别名时根据当前用户语言传入语言参数，由接口返回对应语言别名 | `apps/web` 各别名展示入口 + API | 部分 | 跨端数据契约 | 做 | 用户 / 2026-06-20 | T22 |
| F23 | 六「多语言、h5都需要处理」 | Web 与 H5 均需覆盖本需求展示、筛选、排序、别名和交互 | `apps/web` desktop + 390px H5 | ❌ | 跨端适配 | 做 | 用户 / 2026-06-20 | T23 |

## 验收标准对照（PRD §七）

| 验收项 | 对应 ID | 状态 |
|--------|---------|------|
| PRD §七 为嵌入 sheet：`sheet-id="WppwGn" token="YZFbsxTxahoiC9tovURlyIoNgYc"`，当前 Lark Markdown 同步未展开 sheet 明细 | F01-F23 | 待补充 / 待确认 |

## Figma 未覆盖但 PRD 要求

| ID | 说明 | 本期是否做 |
|----|------|-----------|
| F19-F22 | Admin 币种归属板块与别名多语言配置属于后台表单与前后端数据契约，不在当前 Web 原型主链路中完整覆盖 | 做 |
| F23 | H5 全量适配在 PRD 文本提出，但 UI 地址为空，缺少 H5 设计细节 | 做 |
| 验收 sheet | PRD 验收标准以嵌入 sheet 存在，同步未展开 | 做 |

## Scope 裁剪记录（若有）

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| 暂无 | F01-F23 全部本期做，不裁剪 | 用户 | 2026-06-20 | 无裁剪 |

## TDD / PRD 冲突（若有）

| 项 | PRD | TDD | 结论 |
|----|-----|-----|------|
| 验收标准来源 | PRD §七 是嵌入 sheet | 当前只同步到 sheet 占位，未展开 sheet 内容 | 待确认：需补 sheet 导出或用 Lark/表格工具同步 |
| UI 地址 | PRD `UI地址` 为空 | 现有文档只能使用原型链接和 PRD 截图 alt 文本 | 待确认：需正式 UI/Figma 节点或确认按原型实现 |

## G2 确认记录

| 日期 | 确认人 | 结论 |
|------|--------|------|
| 2026-06-20 | 用户 | F01-F23 全部本期做；允许 API 未齐前 mock-first；Admin 本期同做；先按 PRD 原型链接开发，正式 UI 后期补；Lark 通知不启用；API 文档没有，数据先 Mock。 |
