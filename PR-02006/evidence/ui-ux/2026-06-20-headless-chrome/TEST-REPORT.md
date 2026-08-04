# PR-02006 Headless Chrome 自测报告

## 环境

- 时间：2026-06-20
- 本地服务：`pnpm --filter @fameex/web dev`，端口 `4000`
- 浏览器：本机 Google Chrome headless
- 说明：内置 Browser 插件初始化失败：`codex/sandbox-state-meta: missing field sandboxPolicy`，因此使用 Chrome headless + HTTP + 单测替代。

## 路由结果

| 路由 | 结果 |
|------|------|
| `/api/tradfi/public-info` | 200 |
| `/zh-CN/tradfi` | 200 |
| `/zh-CN/markets/tradfi` | 200 |
| `/zh-CN/markets/swap` | 200 |
| `/zh-CN/swap/E-BTC-USDT` | 200 |

> 清理 `apps/web/.next/dev` 后子路由 404 消失，确认属于 Next dev 缓存问题。

## PRD §七验收项

| 验收项 | 自测结果 |
|--------|----------|
| 多语言 | 落地页 visible copy 走 `tradfi`/`futures`/`spot`/`home`/`markets`/`trade` namespace；metadata 已改为 `tdk:tradfi.*` |
| H5 适配 | 生成 `mobile-tradfi.png`（390x844）和 `mobile-asset-full.png`（390x2600）；可视截图覆盖 Hero、资产区、优势区与 FAQ；`main` 使用 `max-w-full overflow-x-hidden`；DOM 检查未出现 Next error |
| H5 交互 | H5 已补移动排序栏，包含价格、24h 涨跌、24小时成交额、24h 最高价、24h 最低价；Tab 文案包含全部、股票、贵金属、商品；2026-06-20 CDP 点击 `最新价格`、`24小时成交额`、`股票` 均返回成功且未出现 Next 错误；资产卡排序/筛选逻辑由 `market.test.ts` 覆盖 |

## 产物

- `desktop-tradfi.png`：1440x1000 首屏截图
- `mobile-tradfi.png`：390x844 首屏截图
- `mobile-asset-full.png`：390x2600 全页截图，覆盖资产区与下方模块
- `mobile-full-dom.html`：390 宽 headless DOM
- `dom-checks.json`：DOM 静态检查结果
- `interaction-results.json`：早期 CDP 交互脚本尝试结果；当前 Chrome DevTools 长连接在本环境不稳定，结果为空页，不作为通过证据
- `mobile-interaction-cdp.json`：新版 CDP H5 交互结果；排序按钮与 Tab 点击成功，未出现 Next 错误。headless 当前只暴露隐藏导航 `/swap/E-*` 链接，未稳定抓到移动资产卡链接，因此资产卡列表顺序仍以单测覆盖为准

## 自动化验证

- `pnpm vitest --run apps/web/src/apps/TradFi/common/market.test.ts apps/web/src/apps/TradFi/common/format.test.ts apps/web/src/apps/TradFi/common/env.test.ts`
  - 3 files passed
  - 42 tests passed

- `pnpm vitest --run apps/web/src/apps/Futures/components/MarketList/Sorter.test.ts apps/web/src/apps/Futures/components/MarketList/List.test.ts apps/web/src/apps/Futures/components/MarketList/index.test.ts apps/web/src/apps/TradFi/common/market.test.ts apps/web/src/apps/TradFi/common/format.test.ts apps/web/src/apps/TradFi/common/env.test.ts`
  - 6 files passed
  - 51 tests passed
  - 覆盖交易页 MarketList 24h 成交额列 / 三态排序、section Tab、TradFi mapper / formatter / mock 开关

- `pnpm vitest --run apps/web/src/components/layout/Header/PageEntries/SubEntry.test.ts apps/web/src/apps/Futures/components/MarketList/Sorter.test.ts apps/web/src/apps/Futures/components/MarketList/List.test.ts apps/web/src/apps/Futures/components/MarketList/index.test.ts apps/web/src/apps/TradFi/common/market.test.ts apps/web/src/apps/TradFi/common/format.test.ts apps/web/src/apps/TradFi/common/env.test.ts`
  - 7 files passed
  - 52 tests passed
  - 覆盖 Header TradFi hover 浮层挂载、交易页 MarketList 24h 成交额列 / 三态排序、section Tab、TradFi mapper / formatter / mock 开关

- `pnpm vitest --run apps/web/src/apps/Markets/components/MarketTradFi/index.test.ts apps/web/src/components/layout/Header/PageEntries/SubEntry.test.ts apps/web/src/apps/Futures/components/MarketList/Sorter.test.ts apps/web/src/apps/Futures/components/MarketList/List.test.ts apps/web/src/apps/Futures/components/MarketList/index.test.ts apps/web/src/apps/TradFi/common/market.test.ts apps/web/src/apps/TradFi/common/format.test.ts apps/web/src/apps/TradFi/common/env.test.ts`
  - 8 files passed
  - 53 tests passed
  - 覆盖 Markets TradFi 空标签隐藏与别名标签传递、Header TradFi hover 浮层挂载、交易页 MarketList 24h 成交额列 / 三态排序、section Tab、TradFi mapper / formatter / mock 开关

- `pnpm vitest --run apps/web/src/services/api/common/public-info.test.ts apps/web/src/apps/Markets/components/MarketTradFi/index.test.ts apps/web/src/components/layout/Header/PageEntries/SubEntry.test.ts apps/web/src/apps/Futures/components/MarketList/Sorter.test.ts apps/web/src/apps/Futures/components/MarketList/List.test.ts apps/web/src/apps/Futures/components/MarketList/index.test.ts apps/web/src/apps/TradFi/common/market.test.ts apps/web/src/apps/TradFi/common/format.test.ts apps/web/src/apps/TradFi/common/env.test.ts`
  - 9 files passed
  - 55 tests passed
  - 覆盖 public_info 当前语言参数、Markets TradFi 空标签隐藏与别名标签传递、Header TradFi hover 浮层挂载、交易页 MarketList 24h 成交额列 / 三态排序、section Tab、TradFi mapper / formatter / mock 开关
- `pnpm exec biome check --write --no-errors-on-unmatched ...`
  - touched files passed
  - Biome 备注：2026-06-20 已清理 `apps/web/src/apps/Markets/components/MarketTable/index.tsx` 的 `useExhaustiveDependencies` 提示，并保留搜索变化回第一页行为
- `tesseract --version` / `tesseract --list-langs`
  - OCR 已通过 Homebrew 全局安装；`chi_sim`、`eng` 语言包可用

## 运行阻塞修复

- `@fameex/ui` 直接 import `@heroui/react` / `@heroui/shared-icons`，但此前未声明直接依赖，导致 Next dev 编译错误。
- 已在 `packages/ui/package.json` 补直接依赖，并更新 `pnpm-lock.yaml`。

## Typecheck 记录

- `pnpm --filter @fameex/web typecheck`
  - 结果：失败；错误集中在当前任务外的既有模块（如 Assets、ContractBroker、CopyTrading、FuturesOrders、packages/kline、packages/utils 等），未能作为 PR-02006 全量通过证据。
  - 处理：未修改 PR-02006 范围外代码；改用 PR-02006 touched files 的 Biome + 9 个定向单测作为本轮可验证证据。
- `pnpm exec biome check --write --no-errors-on-unmatched <PR-02006 touched files>`
  - 结果：通过；`apps/web/src/apps/Markets/components/MarketTable/index.tsx` 的搜索分页 effect warning 已清理。
