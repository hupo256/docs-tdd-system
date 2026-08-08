# 验收记录 — 2026-07-01 P2 分享真实功能 真机自测

> 环境：worktree `/Users/aven/github/PR-PricePanel`，`feature/PR-PricePanel`，`pnpm dev:test` 端口 4104，Next.js + Turbopack。
> 工具：Playwright MCP（真实 Chrome），页面 `/zh-CN/swap/E-BTC-USDT`。
> 范围：P2 分享真实逻辑（社交跳转 + 图表图片导出）。截图证据见同目录 `2026-07-01-klinechart-capture.png` / `2026-07-01-tradingview-capture.png`。

## 1. 菜单结构（含 copyLink 删除）

| 检查项 | 结论 |
|--------|------|
| 菜单共 **7 项**（4 社交 + 分割线 + 3 图片） | ✅（DOM 实测 7 项） |
| 「复制图片链接」已移除 | ✅ 不再出现 |
| 图片区为 储存图片 / 复制图表图片 / 在新页中打开图片 | ✅ |

## 2. 社交分享（分享当前合约页链接）

以 `window.open` 拦截捕获实际 URL（当前页 `http://localhost:4104/zh-CN/swap/E-BTC-USDT`）：

| 项 | 捕获 URL | 结论 |
|----|----------|------|
| 分享至 X | `https://x.com/intent/tweet?url=<当前页>` | ✅ |
| 分享至 Telegram | `https://t.me/share/url?url=<当前页>` | ✅ |
| 分享至 Discord | `https://discord.gg/V8yvKPxVCk`（`OFFICIAL_DISCORD`，无 intent 打开官方社区） | ✅ |
| 分享至 Facebook | `https://www.facebook.com/sharer/sharer.php?u=<当前页>` | ✅ |

- 均带 `posthog.capture('share_channel_click', { page_type:'futures', share_scene:'kline_chart', channel_type, content_type:'link' })` 埋点（对齐 `ShareActionButtons`）。

## 3. 图表图片导出（两种引擎）

以「在新页中打开图片」验证截图能力（新标签打开 blob 图片）：

| 引擎 | 截图源 | blob 尺寸 | 内容 | 结论 |
|------|--------|-----------|------|------|
| klineChart | `chartInstance.getConvertPictureUrl(true,'jpeg',bg)` | 2170×684 | K 线 + MA + 成交量 + 浮层图例，暗色背景 `#17181d` 匹配主题 | ✅ |
| tradingView | `tvWidget.takeClientScreenshot()` | 2206×746 | TradingView 图表（BTCUSDT/15/FameEX）+ MA + 成交量 + TV 标识 | ✅ |

- **回归过程发现并修复 1 个 bug**：初版 `captureChartImage` 的 TradingView 分支读 `window.tvWidget`，但本代码库该全局从未赋值；实际 widget 存于 `useKlineLeftInteractionStore().tvWidget`。改为从该 store 读取并作为参数传入后，TV 模式截图成功。
- `储存图片`（下载）、`复制图表图片`（剪贴板，失败降级下载）与上述共用同一 `captureChartImage` + blob 工具链；自动化环境下 clipboard/download 不易断言，逻辑经代码走查确认，复用 `saveImageBlob` / `copyBlobToClipboard`。

## 4. 静态校验

| 项 | 结论 |
|----|------|
| `tsc --noEmit`（5 个改动文件） | ✅ 零报错（全量 181 条为仓库既有 `@fameex/klinecharts` 未构建等，与本需求无关） |
| `biome check`（改动文件 + captureChartImage + KlineShare） | ✅ 通过 |

## 5. 复用清单

| 能力 | 复用来源 |
|------|----------|
| 下载图片 Blob | `utils/savePicture.ts` 新增 `saveImageBlob`（复用 desktop/mobile 下载分支） |
| 复制图片到剪贴板 | `utils/copyImgToClipboard.ts` 新增 `copyBlobToClipboard`（旧 DOM-id 版改为复用它） |
| 社交跳转 + 埋点 | 对齐 `apps/Futures/.../ShareSocial/ShareActionButtons.tsx` |
| Discord 官方链接 | `constants/pathnames.ts` 的 `OFFICIAL_DISCORD`（Footer `mediaPlatforms` 同源） |
| TradingView widget | `useKlineLeftInteractionStore().tvWidget` |
| klinecharts 实例 | `useKlineChartInstance()` |
| 主题背景色 | `useTheme().isDark` + `--fx-bg-2` CSS 变量 |

## 6. 备注 / 未覆盖

- 分享真实功能全部落在 `KlineShare.tsx` 的 `handleShareAction`；无新增第三方依赖。
- 社交分享按产品确认只分享**页面链接**（web intent 不支持直接带本地图片，需图床，超本期）。
- depth 模式与窗口 <510px 时分享按钮随图标簇隐藏（继承既有显隐条件，未回归改变）。
