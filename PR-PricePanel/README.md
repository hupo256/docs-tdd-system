---
projectId: PR-PricePanel
status: closed
stage: G8
branch: feature/PR-PricePanel
worktree: ""
port: "4106"
visualFidelity: standard
prdSource: "Figma node 12331:21676 + 产品截图"
figmaNode: "12331:21676"
larkEnabled: false
---

# 合约 K 线区扩容 + 分享功能（PR-PricePanel）— Web 开发文档

> **状态**：**已上线（2026-07-03），历史项目归档**。P1（订单簿固定 260px + 分享入口 UI）与 P2（分享真实功能）均已完成并通过真机自测；代码已合入 `online`（merge `0168dd6d4b`）。本项目早于阶段历史链规则，保留历史证据但不回填伪造 gate history。
> **开发基线分支**：`feature/PR-PricePanel`（从 `online` 切出）。
> **范围**：仅合约交易页（`apps/Futures`）Web 端；现货/杠杆/币本位等其他交易页本次不动。
> **Figma**：`KzvWxAYxqfgpoiYuKdxMAE` ·「FameEX 三期」WEB · node `12331:21676` · [Dev Mode 链接](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=12331-21676)（需登录，未通过 MCP 读取，按产品截图实现）。

## 分支与代码基线

| 项 | 值 |
|----|-----|
| 开发基线分支 | `feature/PR-PricePanel`（从 `online` HEAD 切出） |
| worktree | `/Users/aven/github/PR-PricePanel` · 端口 `4106`（`apps/web/package.json` 的 `dev*` 脚本已改 `PORT=4106`；见 [common/coding-worktree.md §2 端口注册表](../common/coding-worktree.md)） |
| 公共规则 | 通用 `docs_tdd/common/` 规则在 `dev` / `PR-01685` 线维护；本目录只写本需求差异，遵循 [common/project-doc-structure.md](../common/project-doc-structure.md) 的薄包装原则 |

代码落点（均在 `feature/PR-PricePanel`）：

| 类型 | 路径 | 说明 |
|------|------|------|
| 栅格受控增强 | `apps/web/src/components/layout/GridLayout.tsx` | 新增 `controlledItemIds`：受控项几何始终取 default，忽略 localStorage 历史覆盖 |
| 布局透传 | `apps/web/src/apps/Futures/components/FuturesGridLayout.tsx` | 透传 `controlledItemIds` |
| 布局计算 | `apps/web/src/constants/grid/futureLayouts.ts` | 入参容器宽度，把订单簿列固定为 260px，差额给 K 线 |
| 页面接入 | `apps/web/src/apps/Futures/index.tsx` | `useContainerWidth` 测量整页宽度，反应式重算 layouts；传 `controlledItemIds` |
| 分享组件 | `apps/web/src/components/FutureChart/Menu/MenuLeft/KlineShare.tsx` | 工具栏分享下拉（7 项）：社交跳转 + 图表图片导出，`handleShareAction` 已接入真实逻辑 |
| 图表截图 | `apps/web/src/components/FutureChart/utils/captureChartImage.ts` | 按 chartViewType 截图：klineChart 用 `getConvertPictureUrl`，tradingView 用 `tvWidget.takeClientScreenshot` |
| 图片工具复用 | `apps/web/src/utils/savePicture.ts` · `copyImgToClipboard.ts` | 新增 blob 版 `saveImageBlob` / `copyBlobToClipboard` |
| 工具栏接入 | `apps/web/src/components/FutureChart/Menu/MenuLeft/index.tsx` | 齿轮与「最新价格」之间插入 `<KlineShare chartViewType={...} />` |
| i18n | `apps/web/src/i18n/locales/{zh-CN,en-US}/tradingAndDepthView.json` | 分享菜单 + 图片操作反馈文案 |

## 文档地图

| 分类 | 文档 | 说明 |
|------|------|------|
| 范围与分期 | [product/01-scope-and-phases.md](./product/01-scope-and-phases.md) | 背景、目标、本期做/不做、分期 |
| 技术方案 | [product/02-technical-design.md](./product/02-technical-design.md) | 固定宽度机制、栅格受控增强、分享组件结构 |
| UI 交互 | [product/05-ui-and-interaction.md](./product/05-ui-and-interaction.md) | 面板宽度行为、分享菜单规格、显隐条件 |
| Figma 规格 | [product/07-figma-spec.md](./product/07-figma-spec.md) | 分享下拉菜单几何/配色（node `13514:37601`，含 L2 对照） |
| 工程规则 | [engineering/development-rules.md](./engineering/development-rules.md) | 本模块工程约束（继承 common，仅写差异） |
| 验收记录 | [evidence/ui-ux/2026-06-30-verification.md](./evidence/ui-ux/2026-06-30-verification.md) | P1 Playwright 真机自测报告 |
| 验收记录 | [evidence/ui-ux/2026-07-01-verification.md](./evidence/ui-ux/2026-07-01-verification.md) | P2 分享真实功能真机自测报告 |
| 验收记录 | [evidence/ui-ux/2026-07-01-share-feature-verification.md](./evidence/ui-ux/2026-07-01-share-feature-verification.md) | 分享菜单 Figma 还原 + 功能 L2 核对 |

## 当前状态摘要

| 项 | 状态 |
|----|------|
| 需求来源 | ✅ 产品截图 + Figma node `12331:21676` |
| 改动一：订单簿固定 260px | ✅ 已实现并实测（宽屏精确 260px，K 线吸收差额） |
| 改动二：分享入口 UI | ✅ 已实现（工具栏下拉，两段式带分割线） |
| 改动二：分享真实功能 | ✅ 已实现并实测（社交跳转分享页面链接 + K 线/TradingView 截图导出；已删「复制图片链接」） |
| 校验 | ✅ 改动文件 TS 零报错；biome 全通过；Playwright 真机自测通过 |
| i18n | ⚠️ 开发期只维护 zh-CN / en-US；其余语言走 en-US 回退 |
| 代码提交 | ⏳ 待确认后提交 |

## P2 分享真实功能（已完成）

- 社交分享（X / Telegram / Discord / Facebook）分享**当前合约页链接**：X/TG/FB 用官方 web 分享 intent，Discord 无 intent 打开官方社区 `OFFICIAL_DISCORD`（对齐 Footer `mediaPlatforms`），统一带 `share_channel_click` 埋点。
- 图片导出（储存图片 / 复制图表图片 / 在新页中打开图片）：截图源按 `chartViewType` 分派——klineChart 用 klinecharts `getConvertPictureUrl`，tradingView 用 `tvWidget.takeClientScreenshot`（widget 取自 `useKlineLeftInteractionStore`）。
- **产品决策**：删除「复制图片链接」（需图床生成可分享图片 URL，超本期范围）。
- 验收记录见 [evidence/ui-ux/2026-07-01-verification.md](./evidence/ui-ux/2026-07-01-verification.md)。
