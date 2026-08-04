# 工程规则（PR-PricePanel）

> 本文件已继承 `apps/web/docs_tdd/common/` 通用规则（编码规范、UI token、测试与质量门、git 分支流等）。
> 这里只写本需求的特殊约束与坑位，不复制公共规则全文。

## 1. 模块边界

| 允许改动 | 说明 |
|----------|------|
| `apps/Futures/index.tsx`、`components/FuturesGridLayout.tsx` | 合约页栅格接入与透传 |
| `constants/grid/futureLayouts.ts` | 仅合约页布局；不要顺手改 spot/margin 布局 |
| `components/layout/GridLayout.tsx` | `controlledItemIds` 是通用增强，**必须向后兼容**：不传时行为与改动前完全一致 |
| `components/FutureChart/Menu/MenuLeft/*` | K 线工具栏分享按钮 |
| `i18n/locales/{zh-CN,en-US}/tradingAndDepthView.json` | 仅新增分享 key |

## 2. 固定宽度相关约束

1. **clamp 下界禁止用布局 `minW`**：`minW` 是窄屏拖拽缩放的列数下限，宽屏上会顶大目标列宽，使 260px 失效（已踩坑，见 [02 §1.1](../product/02-technical-design.md)）。下界用 `MIN_ORDER_BOOK_COLS`。
2. **只改 `xl`/`lg`**：`md` 及以下是拆分布局，固定单块会与「最新成交」错位。新增/调整断点时重新评估。
3. **`controlledItemIds` 要稳定引用**：在页面里用模块级常量传入，避免每次渲染新建数组导致 GridLayout 的 rehydrate effect 抖动。
4. **小数 `w` 是 v2 特性**：依赖 `react-grid-layout@2.x` 不对 `w` 取整。若升级该库，需回归此机制。
5. 修改布局后用 Playwright/Browser 实测 ≥2 个宽度（如 1440 与 1920）确认订单簿恒为 260px，不能只看单一视口。

## 3. 分享功能约束

1. P1 只做 UI；`handleShareAction` 保持单一接入点，下一阶段在此分发，不要把各平台逻辑散落到渲染层。
2. 社交分享优先复用 `apps/Futures/components/FuturesOrders/components/ShareSocial/ShareActionButtons.tsx`，避免重复实现。
3. 新增文案走 `tradingAndDepthView` 命名空间；开发期只补 zh-CN / en-US。
4. 图标只用 `packages/icon/output/icon-list.json` 已有的 `fx--*`，不新增图标资源。

## 4. 自测与校验

- `pnpm --dir apps/web typecheck`：改动文件须零报错（仓库既有的 `@fameex/klinecharts` 未构建等报错与本需求无关，不在本次范围内修）。
- `biome check`（lint-staged 实际用 biome，非 `next lint`）：改动文件须通过；可 `biome check --write` 自动格式化。
- 真机：`pnpm dev`（端口 4106）→ `/zh-CN/swap/<symbol>`，按 [01 §6 验收标准](../product/01-scope-and-phases.md) 逐项核对。
