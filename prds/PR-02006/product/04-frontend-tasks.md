# PR-02006 Frontend Tasks

> G2 范围已更新：本仓完成 F01-F23，包含 legacy admin 币种编辑页 F19-F21 后台配置项。允许 mock-first 开发。任务 ID 对应 `00-feature-inventory.md`。

| ID | 对应功能 | 任务 | 状态 |
|----|----------|------|------|
| T01 | F01 | 梳理 Header 合约交易菜单 TradFi hover 浮层触发与关闭行为 | 已实现；2026-06-20 审计补齐 TradFi 子项 hover 交易对浮层挂载与单测 |
| T02 | F02 | Header TradFi 浮层增加动态分类 Tab，仅展示有有效币对标签 | 已实现；复用 TradFi tabs，仅保留有数据标签 |
| T03 | F03 | Header TradFi 浮层搜索：当前 Tab 范围、实时过滤、空态、保留/初始化规则 | 已实现；TradFi hover 初始化全部 + 空关键词，切 Tab 保留关键词 |
| T04 | F04 | Header TradFi 浮层交易对行展示成交额、别名、价格、涨跌并点击跳转 | 已实现；2026-06-20 审计补齐成交额/别名/价格/涨跌展示 |
| T05 | F05 | Header TradFi 浮层默认 24h 成交额倒序和实时排序 | 已实现；复用 `sortTradFiAssets(...,{})` 默认成交额倒序 |
| T06 | F06 | Futures MarketList TradFi 默认排序改为成交额倒序 | 已实现 |
| T07 | F07 | Futures MarketList 板块 Tab 隐藏无有效币对板块 | 已实现 |
| T08 | F08 | Futures MarketList TradFi 下增加 symbolTag 分类 Tab | 已实现 |
| T09 | F09 | Futures MarketList 新增 24h 成交额列与三态排序 | 已实现；2026-06-20 审计补齐 `amount` 列、三态排序与单测 |
| T10 | F10 | Futures MarketList 显示别名标签并移除旧标签 | 已实现 |
| T11 | F11 | PairInfo / 交易页红框触发点由点击改为 hover 显示浮层 | 已实现；2026-06-20 审计确认并补齐桌面 hover 打开/关闭，H5 保留 Drawer 点击 |
| T12 | F12 | TradFi 落地页资产行新增永续标签 | 已实现 |
| T13 | F13 | TradFi 落地页资产行新增别名标签并移除旧标签 | 已实现 |
| T14 | F14 | TradFi 落地页新增 24h 成交额列、格式化与默认成交额倒序 | 已实现并单测通过（38/38） |
| T15 | F15 | TradFi 落地页高低价列新增排序 icon | 已实现并接入三态排序，单测覆盖 high24h / low24h |
| T16 | F16 | Markets TradFi 板块新增别名标签 | 已实现；2026-06-20 审计补齐 `MarketTable.showNameMap.tagLabel` 展示与单测 |
| T17 | F17 | Markets TradFi logo 样式优化 | 已实现；复用 futures coin source fallback 与圆形图标占位 |
| T18 | F18 | 修复 / 验证 TradFi 落地页分页切换不自动跳转 | 已验证代码路径 |
| T19 | F19 | Admin 币种配置新增归属板块单选 | 已实现；UI 使用 USDT本位 / TradFi，提交按 YApi 映射 `type=1/2` |
| T20 | F20 | Admin TradFi 币种别名多语言区域和动态语言列表 | 已实现；回显优先读取 `coinAliasI18nList`，提交 `coinAliasI18nList[{coin,langKey,content}]` |
| T21 | F21 | Admin 多语言别名失焦 / 保存必填校验 | 已实现；失焦与保存均校验，缺失时提示 `Please fill in all national language aliases`；TradFi 新增/编辑接 `/add_config_coin_sub`、`/edit_config_coin_sub` |
| T22 | F22 | Web 各别名展示入口接当前语言参数和别名返回字段 | 已实现；2026-06-20 审计补齐 `usePublicInfoQuery({ language: lang })`，后端返回语言别名后 Web 入口统一消费 `contractOtherName` / `displaySymbol` / `tagLabel` |
| T23 | F23 | 桌面 + 390px H5 + dark/light 自测矩阵 | 基础路由自测通过：清理 `.next/dev` 后 `/api/tradfi/public-info`、`/zh-CN/tradfi`、`/zh-CN/markets/tradfi`、`/zh-CN/markets/swap`、`/zh-CN/swap/E-BTC-USDT` 均 200；PRD §七验收标准已补入 `01-scope-and-phases.md`；落地页 metadata 已接入 `tdk` 多语言；H5 已补移动排序栏覆盖价格、涨跌、24h 成交额、高价、低价三态排序；2026-06-20 定向单测 `pnpm vitest --run apps/web/src/services/api/common/public-info.test.ts apps/web/src/apps/Markets/components/MarketTradFi/index.test.ts apps/web/src/components/layout/Header/PageEntries/SubEntry.test.ts apps/web/src/apps/Futures/components/MarketList/Sorter.test.ts apps/web/src/apps/Futures/components/MarketList/List.test.ts apps/web/src/apps/Futures/components/MarketList/index.test.ts apps/web/src/apps/TradFi/common/market.test.ts apps/web/src/apps/TradFi/common/format.test.ts apps/web/src/apps/TradFi/common/env.test.ts` 55/55 通过；Biome touched files 通过；Chrome headless 已生成 1440 桌面和 390 H5 截图、DOM 检查报告；CDP 点击 `最新价格`、`24小时成交额`、`股票` 成功且无 Next 错误；headless 对移动资产卡链接抓取不稳定，资产卡排序/筛选以单测覆盖为准；OCR 已全局安装并验证 `chi_sim` / `eng` 可用，见 `evidence/ui-ux/2026-06-20-headless-chrome/TEST-REPORT.md`；内置浏览器插件当前因 `sandboxPolicy` 元数据缺失不可用，人工可视浏览器交互仍建议最终补验；`pnpm --filter @fameex/web typecheck` 仍被 PR-02006 范围外既有 TS 错误阻断，见 TEST-REPORT Typecheck 记录；本仓范围内 Web 项已完成定向自测 |

## 建议优先级

1. 数据模型与 mapper：先补 `TradFiAsset`、成交额 formatter、排序 resolver。
2. Web 高复用面：落地页 + 行情页先复用同一 UI 资产模型。
3. 交易页弹层：改动 Futures 交易面，需单独测试点击交易对、排序、搜索、tab 互斥。
4. Header 浮层：确认是否复用 FuturesMarketList 还是新建轻量 TradFi 浮层。
5. Admin 多语言：YApi 字段已确认并接入，详见 `product/api/admin-contract-coin.md`；后续只需真实环境联调。
