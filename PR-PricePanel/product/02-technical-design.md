# 02 — 技术方案

## 0. 关键前置结论（react-grid-layout v2）

合约页用的是 `react-grid-layout@^2.2.x`（**非** 经典 v1，API 是 `GridLayout` + `useContainerWidth` + `useResponsiveLayout` + `gridConfig` + `Compactor`）。两个决定方案的事实：

1. **渲染宽度按比例**：单列像素宽
   `colW = (containerWidth - margin[0] * (cols - 1) - containerPadding[0] * 2) / cols`，
   item 像素宽 `= round(colW * w + (w - 1) * margin[0])`。本项目 `cols=48`、`margin=[4,4]`、`containerPadding=[0,0]`（见 `constants/grid/shared.ts` 与 `components/layout/GridLayout.tsx`）。
   → 列宽随 `containerWidth` 变化，**静态 `w` 无法跨视口保持固定像素**。
2. **`w` 支持小数**：`calcGridItemWHPx(gridUnits, ...)` 不对 `gridUnits` 取整。
   → 可以反解出小数 `w` 精确命中 260px：由 `260 = colW*w + (w-1)*margin` 得
   `w = (260 + margin) / (colW + margin)`。
3. `LayoutItem.constraints`（v2 新增）只作用于拖拽/缩放交互（`constrainPosition`/`constrainSize`），**不影响静态渲染宽度**，因此不能用它来固定宽度。

结论：要让订单簿固定 260px，必须 **随容器宽度反应式计算它的小数 `w`**，并让 K 线吸收差额。

## 1. 改动一：订单簿固定 260px

### 1.1 布局计算 — `constants/grid/futureLayouts.ts`

- `futureLayouts(_tab)` → `futureLayouts(containerWidth?: number)`。
- 新增：
  - `colWidthOf(W, colCount)`：上面的列宽公式。
  - `orderBookColsFor(W, fallbackW)`：反解 260px 对应的小数 `w`，clamp 到 `[MIN_ORDER_BOOK_COLS(=1), fallbackW]`。
  - `withFixedOrderBookWidth(layout, W)`：把某断点布局里的订单簿、K 线两块改写：
    - `boundary = orderPanel.x`（右侧下单面板左边界）
    - `obW = orderBookColsFor(W, orderBook.w)`，`obX = boundary - obW`
    - 订单簿：`{ x: obX, w: obW, minW: min(原minW, obW), isResizable: false }`
    - K 线：`{ x: 0, w: obX }`
    - 下单面板（`x=39, w=9`）、下方 Orders（`w=39`）、Assets（`x=39`）不变。
- 仅对 `FIXED_ORDER_BOOK_BREAKPOINTS = [xl, lg]` 应用；无 `containerWidth`（SSR/首屏）时返回原比例布局。

> **⚠️ 易错点（已修）**：clamp 的下界 **不能用布局里的 `minW`**。`minW` 是「窄屏拖拽缩放的列数下限」（xl=6、lg=8），在宽屏上 6 列 ≈356px，会把目标 4.39 列顶大，导致固定宽度失效（实测 bug：订单簿停在 356px）。下界改用极小常量 `MIN_ORDER_BOOK_COLS=1`；上界 clamp 到 `fallbackW`（原列宽）只为窄屏「只缩不放」。

> **为何只 `xl`/`lg`**：二者用合并的订单簿块（订单簿/最新成交 Tab 同一面板）。`md` 及以下是拆分布局（`OrderBookId` 与 `LatestTradesId` 上下同列），只缩订单簿会与下方错位；且 md 宽度区间内目标列数恒被 clamp 到原列宽（无变化）。

### 1.2 受控持久化 — `components/layout/GridLayout.tsx`

订单簿宽度由布局计算控制，但 GridLayout 会把用户拖拽/缩放结果存进 localStorage 并在 `mergeWithDefault` 时用持久化值覆盖 default。若不处理，旧缓存里的订单簿 `w` 会盖掉我们算出的 260px。

- 新增 prop `controlledItemIds?: readonly string[]`。
- `mergeWithDefault(defaultLayouts, saved, controlledItemIds)`：对受控 id **忽略持久化覆盖**，几何始终取 default（即 `futureLayouts(W)` 算出的值）。
- 初始化 state 与 `rehydrateOnDefaultChange` effect 均传入 `controlledItemIds`（effect 依赖已加该项）。

### 1.3 页面接入 — `apps/Futures/index.tsx`

- `import { useContainerWidth } from 'react-grid-layout'`，在包裹 `<div className="relative">` 上测量整页宽度 `W`：
  `const { width, containerRef } = useContainerWidth({ measureBeforeMount: true, initialWidth: 1440 })`。
- `const layouts = useMemo(() => futureLayouts(width), [width])`。
- 模块级常量 `FUTURES_CONTROLLED_ITEM_IDS = [GridItems.OrderBookId]`（稳定引用，避免 effect 抖动）传给 `<FuturesGridLayout controlledItemIds={...}>`。
- `FuturesGridLayout.tsx` 仅透传该 prop。

> 该 `useContainerWidth` 与 GridLayout 内部各自测量同一外层元素，宽度一致，误差可忽略。

## 2. 改动二：分享入口（UI）

### 2.1 组件 — `components/FutureChart/Menu/MenuLeft/KlineShare.tsx`

- 复用 `@heroui/react` 的 `Popover/PopoverTrigger/PopoverContent`，触发按钮样式对齐 `KlineSetting.tsx`（`h-[28px] w-[28px] rounded-[4px]`，图标 `icon-[fx--share]`）。
- 菜单数据由两个数组驱动，渲染为两段式列表 + 分割线：
  - `SOCIAL_ITEMS`：`x`/`telegram`/`discord`/`facebook` → 图标 `fx--twitter`/`fx--telegram`/`fx--discord`/`fx--facebook`
  - `IMAGE_ITEMS`：`saveImage`/`copyImage`/`copyLink`/`openImage` → 图标 `fx--download`/`fx--copy`/`fx--link`/`fx--share`
- 受控 `isOpen`；点击项调用 `handleShareAction(type)` 后关闭。

### 2.2 工具栏接入 — `components/FutureChart/Menu/MenuLeft/index.tsx`

在图标簇 `<div className="flex gap-1">` 内、`<KlineSetting />` 之后、`<PriceTypeSelect />` 之前插入 `<KlineShare />`。继承同组的显隐条件 `!isDepth && width > 510`。

### 2.3 i18n

`tradingAndDepthView` 命名空间（zh-CN / en-US）新增：`Share`、`ShareToX`、`ShareToTelegram`、`ShareToDiscord`、`ShareToFacebook`、`SaveImage`、`CopyChartImage`、`CopyImageLink`、`OpenImageInNewTab`。其余语言走 en-US 回退。

## 3. 图标资源

分享所需图标均已存在于 `packages/icon/output/icon-list.json`：
`fx--share`、`fx--twitter`、`fx--telegram`、`fx--discord`、`fx--facebook`、`fx--download`、`fx--copy`、`fx--link`。

## 4. 分享真实功能（P2 实际接入）

`KlineShare.tsx` 的 `handleShareAction(type)` 按 type 分派；社交与图片两条链路：

### 4.1 社交分享（分享当前合约页链接）

`buildSocialShareUrl(type, href)` 生成 URL，`window.open(url, '_blank', 'noopener,noreferrer')`，并 `posthog.capture('share_channel_click', { page_type:'futures', share_scene:'kline_chart', channel_type, content_type:'link' })`。

| type | URL |
|------|-----|
| `x` | `https://x.com/intent/tweet?url=<当前页>` |
| `telegram` | `https://t.me/share/url?url=<当前页>` |
| `facebook` | `https://www.facebook.com/sharer/sharer.php?u=<当前页>` |
| `discord` | `OFFICIAL_DISCORD`（`constants/pathnames.ts`，无 web intent，打开官方社区） |

### 4.2 图片导出

统一先 `captureChartImage({ chartViewType, chartInstance, tvWidget, isDark, type })` 拿 `Blob`（`components/FutureChart/utils/captureChartImage.ts`）。图片格式 `type` 默认 `jpeg`（下载/新页打开体积小）；**`copyImage` 传 `png`**——Chrome/Safari 的 Clipboard API 只支持写入 `image/png`（对齐 `/invite-friend` 分享海报）。

- **klineChart**：`chartInstance.getConvertPictureUrl(true, type, bg)` → dataURL → Blob。`chartInstance` 来自 `useKlineChartInstance()`；`bg` 读 `--fx-bg-2` CSS 变量（回退 `isDark ? #17181d : #ffffff`）。
- **tradingView**：`tvWidget.takeClientScreenshot()` → canvas → `toBlob(mime, 0.95)`。`tvWidget` 来自 `useKlineLeftInteractionStore()`（由 `useTVWidgetLifecycle` 在 widget 就绪时 `setTvWidget` 写入；**注意**：`window.tvWidget` 在本库从未赋值，勿用）。

拿到 Blob 后：

| type | 行为 | 复用 |
|------|------|------|
| `saveImage` | 下载图片 | `utils/savePicture.ts` 的 `saveImageBlob(blob, '<symbol>.jpg')` |
| `copyImage` | 写剪贴板，失败降级下载 + toast | `utils/copyImgToClipboard.ts` 的 `copyBlobToClipboard(blob)` |
| `openImage` | `URL.createObjectURL` → 新标签打开，延时 revoke | — |

失败（拿不到实例/widget）统一 `bar(t('ShareImageFailed'), 'error')`。

### 4.3 已删除

`copyLink`（复制图片链接）：需图床生成可分享图片 URL（依赖后端），经产品确认本期删除。
