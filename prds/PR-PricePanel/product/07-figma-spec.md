# 07 — Figma 规格：K 线分享下拉菜单

> 来源：Figma「FameEX三期」WEB · fileKey `KzvWxAYxqfgpoiYuKdxMAE` · node `13514:37601`（分享菜单展开态）。
> 通过 Dev Mode Inspect 逐节点读取（container `select` = `13514:37575`，行 `.MOL/select` = `13514:37576` 等）。
> 主题：Auto（深色模式）。截图证据见 `evidence/ui-ux/` 同批文件。

## 1. 菜单项清单（7 项，已删「复制图片链接」）

| 顺序 | type | 文案(zh) | 图标 | 分组 |
|------|------|----------|------|------|
| 1 | `x` | 分享至 X | `fx--twitter` | 社交 |
| 2 | `telegram` | 分享至 Telegram | `fx--telegram` | 社交 |
| 3 | `discord` | 分享至 Discord | `fx--discord` | 社交 |
| 4 | `facebook` | 分享至 Facebook | `fx--facebook` | 社交 |
| — | 分割线 | — | — | — |
| 5 | `saveImage` | 储存图片 | `fx--download` | 图片 |
| 6 | `copyImage` | 复制图表图片 | `fx--copy` | 图片 |
| 7 | `openImage` | 在新页中打开图片 | `fx--share` | 图片 |

> **删除**：`copyLink`「复制图片链接」（原 Figma 第 7 项）—— 需图床托管图片 URL，本期不做，经确认整项去除。

## 2. 容器（`select`）几何

| 字段 | Figma 值 | Tailwind |
|------|----------|----------|
| display | inline-flex column, align-items flex-start | `flex flex-col` |
| width | 164px（本实现放宽为 `w-max min-w-[164px]` 以完整显示各语言文案） | `w-max min-w-[164px]` |
| padding | 4px 0 | `py-1 px-0` |
| border-radius | 8px | `rounded-m` |
| border | 0.5px solid `CC-2` (#383B47) | `border-[0.5px] border-cc-2` |
| background | `BG-2` (#17181D) | `bg-bg-2` |
| box-shadow | `0 0 1px 0 rgba(11,12,14,.20), 0 4px 8px 0 rgba(11,12,14,.08)` | `shadow-popup`（token 完全一致） |

> **无分割线**：社交组与图片组之间**不画横线**（Figma 稿两组连续排列）。

## 3. 行（`.MOL/select`）几何

| 字段 | Figma 值 | Tailwind |
|------|----------|----------|
| display | flex, align-items center, align-self stretch | `flex items-center w-full` |
| padding | 9.5px 16px 9.5px 12px | `py-[9.5px] pr-4 pl-3` |
| gap | 8px | `gap-2` |
| 图标尺寸 | 16×16 | `size-4` |
| 文本尺寸 | 14px / 150%(=21px) → `body-regular` | `text-body-regular` |
| 文本换行 | 单行不截断 | `whitespace-nowrap`（不使用 `truncate`） |
| 行圆角 | 无（px-0 容器，hover 满宽） | 无 |

## 4. 配色（统一，非两段式）

| 状态 | 图标 | 文案 |
|------|------|------|
| 默认 | `Text-3` (#8D91A5) | `Text-2` (#C2C5D6) |
| hover | `Text-1` (#FFFFFF) | `Text-1` (#FFFFFF) + 行底 `bg-cc-2` (#383B47) |

> **纠正**：早期误读为「社交白 / 图片灰」两段式。实际 Figma 里 `分享至 X` 之所以是白色，是该行在稿中被设为 **hover 演示态**；组件默认态统一为图标 Text-3 + 文案 Text-2，hover 整行提亮到 Text-1。
> 实测（Playwright getComputedStyle）：默认 `rgb(141,145,165)`/`rgb(194,197,214)`；hover `rgb(255,255,255)` + 底 `rgb(56,59,71)`，全 7 行一致。

## 5. 分割线

**无**（见 §2 备注）。

## 6. 触发按钮（工具栏图标）

沿用图标簇同款：`h-[28px] w-[28px] rounded-[4px]`，图标 `fx--share size-5 text-1`；显隐随图标簇 `!isDepth && width > 510`。

## 7. 与实现的对照（G6 L2 检查点）

- [x] 容器宽 ≥164、圆角 8、bg-2、0.5px cc-2 边、popup 阴影
- [x] 行 py-[9.5px] pr-4 pl-3、gap-2、图标 16、文案 14px、nowrap 不截断
- [x] 统一配色：默认 Text-3 图标 + Text-2 文案，hover 提亮 Text-1 + bg-cc-2
- [x] 无分割线
- [x] 7 项、无「复制图片链接」

> L2 计算样式核对结果见 [evidence/ui-ux/2026-07-01-share-feature-verification.md](../evidence/ui-ux/2026-07-01-share-feature-verification.md)。
