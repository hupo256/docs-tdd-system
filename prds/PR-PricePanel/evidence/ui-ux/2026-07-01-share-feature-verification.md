# 验收记录 — 分享菜单 Figma 还原 + 真实功能（2026-07-01）

> 环境：worktree `/Users/aven/github/PR-PricePanel`，分支 `feature/PR-PricePanel`，dev 端口 4106，Next.js + Turbopack，Playwright MCP（`--extension` 接管本机 Chrome）。
> 页面：`/zh-CN/swap/E-BTC-USDT`（暗色主题）。
> Figma 源：`KzvWxAYxqfgpoiYuKdxMAE` node `13514:37601`，规格见 [product/07-figma-spec.md](../../product/07-figma-spec.md)。
> 截图：`2026-07-01-share-menu-figma-restored.png`。

## 1. UI 还原（L2 计算样式核对）

用 `getComputedStyle` 读实际渲染值，与 Figma 逐项对照：

| 元素 | 字段 | Figma | 实测 | 结果 |
|------|------|-------|------|------|
| 容器 | width | 164px | 163.99px | ✅ |
| 容器 | padding | 4px 0 | 4px 0px | ✅ |
| 容器 | border-radius | 8px | 8px | ✅ |
| 容器 | border | 0.5px #383B47(CC-2) | 0.75px rgb(56,59,71) | ✅（色准，0.75 为 DPR 取整） |
| 容器 | background | #17181D(BG-2) | rgb(23,24,29) | ✅ |
| 容器 | box-shadow | popup 阴影 | 含 rgba(11,12,14…) | ✅ |
| 行 | padding | 9.5px 16px 9.5px 12px | 一致 | ✅ |
| 行 | gap | 8px | 8px | ✅ |
| 行 | font | 14px/21px(body-regular) | 14px/21px | ✅ |
| 社交行 | 文案/图标色 | Text-1 #FFFFFF | rgb(255,255,255) | ✅ |
| 图片行 | 文案色 | Text-2 | rgb(194,197,214) | ✅ |
| 图片行 | 图标色 | Text-3 | rgb(141,145,165) | ✅ |

菜单项 = 7 项，**无「复制图片链接」** ✅。

## 2. 功能验证（拦截 window.open / 观察 blob）

| 动作 | 期望 | 实测 | 结果 |
|------|------|------|------|
| 分享至 X | `x.com/intent/tweet?url=<当前页>` | `https://x.com/intent/tweet?url=http%3A%2F%2Flocalhost%3A4106%2Fzh-CN%2Fswap%2FE-BTC-USDT` | ✅ |
| 分享至 Telegram | `t.me/share/url?url=<当前页>` | 一致 | ✅ |
| 分享至 Facebook | `facebook.com/sharer/sharer.php?u=<当前页>` | 一致 | ✅ |
| 分享至 Discord | 打开官方社区 `OFFICIAL_DISCORD` | `https://discord.gg/V8yvKPxVCk` | ✅ |
| 在新页中打开图片（原生版/klineChart） | 生成 `blob:` 截图并 open | `blob:http://localhost…` | ✅ |
| 在新页中打开图片（TradingView） | store.tvWidget.takeClientScreenshot → blob | `blob:http://localhost…` | ✅ |

- 每次点击后菜单自动收起（`setIsOpen(false)`）✅。
- 两种图表引擎（klinecharts / TradingView iframe）截图均成功产出 blob；TradingView 走 `useKlineLeftInteractionStore().tvWidget`，`window.tvWidget` 未使用不影响。

## 3. 校验

- `pnpm exec tsc --noEmit`：全项目 0 error（含改动文件）✅
- `biome check`（4 个改动/新增文件）：No fixes，通过 ✅
- i18n：`CopyImageLink` 已移除；`Share/ShareTo*/SaveImage/CopyChartImage/OpenImageInNewTab/CopyImageSuccess/CopyImageDowngraded/ShareImageFailed` zh-CN/en-US 齐全 ✅

## 4. 未覆盖 / 备注

- `储存图片`（下载）与 `复制图表图片`（剪贴板）触发了真实下载/剪贴板写入，自测未逐一断言文件落地；代码路径复用 `saveImageBlob` / `copyBlobToClipboard`（`useCopyImage` 同款），逻辑一致。
- 社交分享埋点 `posthog.capture('share_channel_click', …)` 已接入，未在本次断言事件上报。
