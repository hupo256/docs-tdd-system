# Design Token Alignment Chain

## 适用范围

涉及以下任务时必须读取本文档：

- 从 Figma 设计稿、Figma 变量、Figma 组件属性推导 UI 实现。
- 修改 `src/styles/theme.css` 或 Tailwind v4 `@theme inline` token。
- 新增、重命名、迁移颜色、字体、阴影相关 Tailwind class。
- 编写基础组件、业务组件或文档时，需要说明 Figma 变量与 Tailwind class 的对应关系。

## 核心规则

- Tailwind 默认 token 优先级最高；项目 token 不得覆盖 Tailwind 默认 token。
- 每个自定义设计 token 必须能追踪到完整链路：Figma 变量 -> CSS 源变量 -> Tailwind token -> Tailwind class。
- `src/styles/theme.css` 只承载 `:root`、`.dark` 和 `--fx-*` CSS 源变量，不直接暴露 Tailwind class。
- Tailwind class 只能通过 Tailwind token 文件产生。
- Figma 中真实存在的变量要尽量与 Tailwind class 1:1 对齐。
- Figma 中不存在、只是 UI 口头约定或实现面板值的内容，只能作为备注，不要提升为新版项目 token。
- 不因为多个 CSS 变量当前值相同就合并它们；每个 `--fx-*` 变量都保留独立 token 身份。

## 禁止项

- 不重定义 `--spacing`、`--font-sans`、`--radius-sm`、`--radius-lg`、`--breakpoint-sm`、`--breakpoint-xl` 等 Tailwind 默认 token。
- 不覆盖 Tailwind 默认颜色阶梯，例如 `--color-green-500`。
- 不为 spacing、radius、breakpoint 增加新版项目 token，除非它们成为真实 Figma 变量。
- 不把 HeroUI theme 变量纳入这条设计 token 链路。
- 不用裸视觉值替代已有 token，例如只因为 Figma 面板显示 `8px` 就新增 `rounded-m`。

## 文件职责

- `src/styles/theme.css`：主题源变量文件，只放 `--fx-*` 与主题覆盖。
- `src/styles/tailwind-theme.css`：新版 Tailwind v4 token 文件，放非冲突的 `@theme inline` alias。

如果任务需要新增文件或改变上述职责，先回到用户确认，不要自行扩大规则。

## 链路格式

文档、代码注释或评审说明中描述 token 时，使用这个格式：

```text
Figma 变量 -> CSS 源变量 -> Tailwind token -> Tailwind class
```

示例：

```text
H5 -> --text-h5 -> text-h5
CC-1 -> --fx-cc-1 -> --color-cc1 -> text-cc1 / bg-cc1 / border-cc1
```

Figma 颜色变量需要记录 Figma 兼容的 `rgba(...)` 值时，使用这个格式：

```text
Figma 颜色变量 -> Figma 兼容 rgba 值 -> CSS 源变量 -> Tailwind token -> Tailwind class
```

示例：

```text
Brand-1 -> rgba(113, 50, 244, 1) -> --fx-brand-1 -> --color-brand1 -> text-brand1 / bg-brand1 / border-brand1
```

## Figma 使用规则

- 先识别设计稿中是否使用了 Figma 变量；有变量时，以变量名作为命名来源。
- Figma 变量名称与 Tailwind class 应保持可读的一对一关系，例如 `H5` 对应 `text-h5`。
- Figma 只显示面板值但没有变量时，不要把该值直接加入项目 token；优先匹配 Tailwind 默认 class。
- 设计稿没有体现但团队已有口头约定的 spacing、radius、breakpoint，只能记录为默认对齐备注。
- Figma 变量与当前 CSS 变量不一致时，先指出差异并请用户确认，不要擅自改名或合并。
- Figma 不支持 OKLCH，面向 Figma 的颜色值统一记录为 `rgba(...)`。
- 带 alpha 的颜色变量表示完整语义色值。Tailwind opacity modifier（例如 `bg-bg6/20`）允许使用，但默认不推荐，因为它会对已经带透明度的 token 叠加第二层透明度。

## Figma RGBA 颜色映射

这张表只记录 Figma 兼容色值和用途说明，不代表本次必须修改 `src/styles/theme.css` 的运行时 token 值。来源以设计提供的颜色变量表为准：

- `亮色 rgba` 对应颜色变量表中的第一行值。
- `暗色 rgba` 对应颜色变量表中的第二行值。
- `用途` 对应颜色变量表中的 Used 说明。
- `复核状态` 表示当前迁移会话是否已经逐项人工确认。

### 背景颜色

| Figma 变量 | 亮色 rgba | 暗色 rgba | 用途 | CSS 源变量 | Tailwind token | 示例 class | 复核状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BG-1 | `rgba(243, 244, 247, 1)` | `rgba(11, 12, 14, 1)` | 特殊，用于底部黑线背景展示 | `--fx-bg-1` | `--color-bg1` | `text-bg1`, `bg-bg1`, `border-bg1` | 已确认 |
| BG-2 | `rgba(255, 255, 255, 1)` | `rgba(23, 24, 29, 1)` | 通常用于最底部的表面的背景 | `--fx-bg-2` | `--color-bg2` | `text-bg2`, `bg-bg2`, `border-bg2` | 已确认 |
| BG-3 | `rgba(255, 255, 255, 1)` | `rgba(34, 35, 43, 1)` | 用在弹出层，例如下拉菜单、气泡、模态弹窗的背景等 | `--fx-bg-3` | `--color-bg3` | `text-bg3`, `bg-bg3`, `border-bg3` | 已确认 |
| BG-4 | `rgba(11, 12, 14, 1)` | `rgba(11, 12, 14, 1)` | 特殊，用于投影 | `--fx-bg-4` | `--color-bg4` | `text-bg4`, `bg-bg4`, `border-bg4` | 已确认 |
| BG-5 | `rgba(255, 255, 255, 1)` | `rgba(90, 94, 114, 1)` | 特殊，用于分段控制器 | `--fx-bg-5` | `--color-bg5` | `text-bg5`, `bg-bg5`, `border-bg5` | 已确认 |
| BG-6 | `rgba(11, 12, 14, 0.55)` | `rgba(11, 12, 14, 0.55)` | 蒙层（弹窗/弹出层 Bg） | `--fx-bg-6` | `--color-bg6` | `text-bg6`, `bg-bg6`, `border-bg6` | 已确认 |
| BG-7 | `rgba(11, 12, 14, 0.75)` | `rgba(11, 12, 14, 0.75)` | 蒙层（popupBg） | `--fx-bg-7` | `--color-bg7` | `text-bg7`, `bg-bg7`, `border-bg7` | 已确认 |
| BG-G | `rgba(231, 248, 242, 1)` | `rgba(6, 55, 39, 1)` | 背景色。结合 Sem-G 颜色使用 | `--fx-bg-g` | `--color-bgg` | `text-bgg`, `bg-bgg`, `border-bgg` | 已确认 |
| BG-R | `rgba(253, 237, 237, 1)` | `rgba(71, 21, 21, 1)` | 背景色。结合 Sem-R 颜色使用 | `--fx-bg-r` | `--color-bgr` | `text-bgr`, `bg-bgr`, `border-bgr` | 已确认 |
| BG-Y | `rgba(254, 248, 236, 1)` | `rgba(74, 55, 18, 1)` | 背景色。结合 Sem-Y 颜色使用 | `--fx-bg-y` | `--color-bgy` | `text-bgy`, `bg-bgy`, `border-bgy` | 已确认 |
| BG-B | `rgba(241, 234, 254, 1)` | `rgba(45, 20, 98, 1)` | 背景色。结合 Brand 颜色使用 | `--fx-bg-b` | `--color-bgb` | `text-bgb`, `bg-bgb`, `border-bgb` | 已确认 |

### 分割线颜色

| Figma 变量 | 亮色 rgba | 暗色 rgba | 用途 | CSS 源变量 | Tailwind token | 示例 class | 复核状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Divider-1 | `rgba(11, 12, 14, 0.04)` | `rgba(255, 255, 255, 0.08)` | 分割线颜色-浅，多用于表单内分割 | `--fx-divider-1` | `--color-divider1` | `text-divider1`, `bg-divider1`, `border-divider1` | 已确认 |
| Divider-2 | `rgba(11, 12, 14, 0.08)` | `rgba(255, 255, 255, 0.12)` | 分割线颜色-中，多用于 Tab 切换等组件 | `--fx-divider-2` | `--color-divider2` | `text-divider2`, `bg-divider2`, `border-divider2` | 已确认 |
| Divider-3 | `rgba(11, 12, 14, 0.12)` | `rgba(255, 255, 255, 0.2)` | 分割线颜色-深 | `--fx-divider-3` | `--color-divider3` | `text-divider3`, `bg-divider3`, `border-divider3` | 已确认 |

### 文本/图标颜色

| Figma 变量 | 亮色 rgba | 暗色 rgba | 用途 | CSS 源变量 | Tailwind token | 示例 class | 复核状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Text-1 | `rgba(45, 47, 57, 1)` | `rgba(255, 255, 255, 1)` | 最主要的文本或图标颜色 | `--fx-text-1` | `--color-t1` | `text-t1`, `bg-t1`, `border-t1` | 已确认 |
| Text-2 | `rgba(90, 94, 114, 1)` | `rgba(194, 197, 214, 1)` | 稍次要的文本或图标颜色 | `--fx-text-2` | `--color-t2` | `text-t2`, `bg-t2`, `border-t2` | 已确认 |
| Text-3 | `rgba(141, 145, 165, 1)` | `rgba(141, 145, 165, 1)` | 次要的文本或图标颜色 | `--fx-text-3` | `--color-t3` | `text-t3`, `bg-t3`, `border-t3` | 已确认 |
| Text-4 | `rgba(194, 197, 214, 1)` | `rgba(90, 94, 114, 1)` | 最次要的文本或图标颜色或用于禁用或占位文案 | `--fx-text-4` | `--color-t4` | `text-t4`, `bg-t4`, `border-t4` | 已确认 |
| Text-5 | `rgba(225, 227, 235, 1)` | `rgba(68, 71, 86, 1)` | 用于禁用或占位文案和图标 | `--fx-text-5` | `--color-t5` | `text-t5`, `bg-t5`, `border-t5` | 已确认 |
| Text-6 | `rgba(255, 255, 255, 1)` | `rgba(255, 255, 255, 1)` | 不会反转的文本或图标颜色 | `--fx-text-6` | `--color-t6` | `text-t6`, `bg-t6`, `border-t6` | 已确认 |
| Text-7 | `rgba(113, 50, 244, 1)` | `rgba(141, 91, 246, 1)` | 最次要的文本或图标颜色或用于禁用或占位文案 | `--fx-text-7` | `--color-t7` | `text-t7`, `bg-t7`, `border-t7` | 已确认 |
| Text-8 | `rgba(255, 255, 255, 1)` | `rgba(45, 47, 57, 1)` | 白色字对应黑色字 | `--fx-text-8` | `--color-t8` | `text-t8`, `bg-t8`, `border-t8` | 已确认 |
| Text-9 | `rgba(227, 214, 253, 1)` | 待定义 | 紫色文字 | 待定义 | 待定义 | 待定义 | 待确认 |
| Text-10 | `rgba(45, 47, 57, 1)` | `rgba(255, 255, 255, 1)` | 黑色字对应黑色字 | `--fx-text-10` | `--color-t10` | `text-t10`, `bg-t10`, `border-t10` | 待确认 |

### 填充颜色

| Figma 变量 | 亮色 rgba | 暗色 rgba | 用途 | CSS 源变量 | Tailwind token | 示例 class | 复核状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CC-1 | `rgba(225, 227, 235, 1)` | `rgba(68, 71, 86, 1)` | 用于部分组件，如输入框的默认填充色 | `--fx-cc-1` | `--color-cc1` | `text-cc1`, `bg-cc1`, `border-cc1` | 已确认 |
| CC-2 | `rgba(243, 244, 247, 1)` | `rgba(56, 59, 71, 1)` | 用于部分组件，如按钮的默认填充色 | `--fx-cc-2` | `--color-cc2` | `text-cc2`, `bg-cc2`, `border-cc2` | 已确认 |
| CC-3 | `rgba(249, 249, 251, 1)` | `rgba(45, 47, 57, 1)` | 用于浅色板块填充 | `--fx-cc-3` | `--color-cc3` | `text-cc3`, `bg-cc3`, `border-cc3` | 已确认 |

### 功能色

| Figma 变量 | 亮色 rgba | 暗色 rgba | 用途 | CSS 源变量 | Tailwind token | 示例 class | 复核状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Brand-1 | `rgba(113, 50, 244, 1)` | `rgba(113, 50, 244, 1)` | 主要颜色。仅在需要非常强调的情况下使用。 | `--fx-brand-1` | `--color-brand1` | `text-brand1`, `bg-brand1`, `border-brand1` | 已确认 |
| Brand-2 | `rgba(186, 253, 0, 1)` | `rgba(213, 253, 0, 1)` | 辅助颜色。仅用在配图上 | `--fx-brand-2` | `--color-brand2` | `text-brand2`, `bg-brand2`, `border-brand2` | 已确认 |
| Sem-G | `rgba(20, 184, 129, 1)` | `rgba(20, 184, 129, 1)` | 表示安全、成功、开启的状态或 K 线、买等 | `--fx-sem-g` | `--color-semg` | `text-semg`, `bg-semg`, `border-semg` | 已确认 |
| Sem-Y | `rgba(245, 184, 61, 1)` | `rgba(245, 184, 61, 1)` | 表示警告、提示或收藏图标等使用 | `--fx-sem-y` | `--color-semy` | `text-semy`, `bg-semy`, `border-semy` | 已确认 |
| Sem-R | `rgba(235, 71, 71, 1)` | `rgba(235, 71, 71, 1)` | 表示危险的操作、或需要特别注意的危险信息或 K 线、卖等 | `--fx-sem-r` | `--color-semr` | `text-semr`, `bg-semr`, `border-semr` | 已确认 |
| Hover-B | `rgba(141, 91, 246, 1)` | `rgba(141, 91, 246, 1)` | Primary 按钮 hover 色 | `--fx-hover-b` | `--color-hoverb` | `text-hoverb`, `bg-hoverb`, `border-hoverb` | 已确认 |
| Press-B | `rgba(90, 40, 195, 1)` | `rgba(90, 40, 195, 1)` | Primary 按钮 press 色 | `--fx-press-b` | `--color-pressb` | `text-pressb`, `bg-pressb`, `border-pressb` | 已确认 |
| Hover-B2 | `rgba(245, 240, 254, 1)` | `rgba(56, 32, 106, 1)` | Secondary 按钮 hover 色 | `--fx-hover-b2` | `--color-hoverb2` | `text-hoverb2`, `bg-hoverb2`, `border-hoverb2` | 已确认 |
| Press-B2 | `rgba(227, 214, 253, 1)` | `rgba(36, 16, 78, 1)` | Secondary 按钮 press 色 | `--fx-press-b2` | `--color-pressb2` | `text-pressb2`, `bg-pressb2`, `border-pressb2` | 已确认 |
| Hover-N | `rgba(247, 248, 250, 1)` | `rgba(72, 75, 86, 1)` | Ordinary 按钮 hover 色 | `--fx-hover-n` | `--color-hovern` | `text-hovern`, `bg-hovern`, `border-hovern` | 已确认 |
| Press-N | `rgba(234, 235, 238, 1)` | `rgba(54, 57, 69, 1)` | Ordinary 按钮 press 色 | `--fx-press-n` | `--color-pressn` | `text-pressn`, `bg-pressn`, `border-pressn` | 已确认 |
| Hover-G | `rgba(67, 198, 154, 1)` | `rgba(67, 198, 154, 1)` | Positive 按钮 hover 色 | `--fx-hover-g` | `--color-hoverg` | `text-hoverg`, `bg-hoverg`, `border-hoverg` | 已确认 |
| Press-G | `rgba(16, 147, 103, 1)` | `rgba(16, 147, 103, 1)` | Positive 按钮 press 色 | `--fx-press-g` | `--color-pressg` | `text-pressg`, `bg-pressg`, `border-pressg` | 已确认 |
| Hover-R | `rgba(239, 108, 108, 1)` | `rgba(239, 108, 108, 1)` | Negative 按钮 hover 色 | `--fx-hover-r` | `--color-hoverr` | `text-hoverr`, `bg-hoverr`, `border-hoverr` | 已确认 |
| Press-R | `rgba(188, 57, 57, 1)` | `rgba(188, 57, 57, 1)` | Negative 按钮 press 色 | `--fx-press-r` | `--color-pressr` | `text-pressr`, `bg-pressr`, `border-pressr` | 已确认 |
| Hover-Y | `rgba(247, 198, 100, 1)` | `rgba(247, 198, 100, 1)` | Warning 按钮 hover 色 | `--fx-hover-y` | `--color-hovery` | `text-hovery`, `bg-hovery`, `border-hovery` | 已确认 |
| Press-Y | `rgba(196, 147, 49, 1)` | `rgba(196, 147, 49, 1)` | Warning 按钮 press 色 | `--fx-press-y` | `--color-pressy` | `text-pressy`, `bg-pressy`, `border-pressy` | 已确认 |

### 来源缺口

- `BG-0` 存在于当前代码 token 链路，但不在这份 Figma 颜色变量表中。
- `Text-11` 出现在视觉稿或代码中，但不在这份 Figma 颜色变量表中。
- 紫色阶 `B-0` 到 `B-9` 不属于这份 Figma 颜色变量表映射。

## 新版颜色 Token

颜色 alias 使用短而稳定的名称。数字和短后缀前不加分隔符，避免与已有 class 表面混淆。
Figma 变量族使用中划线拼接，例如 `Text-1`、`BG-G`、`Hover-B2`，避免写成 `Text1`、`BG_G` 或 `HoverB2`。

Figma 来源表中的颜色 token 链路已合并到上方 Figma RGBA 颜色映射表，不再单独维护重复表格。

`--fx-green`、`--fx-yellow`、`--fx-red` 是独立项目颜色变量。即使它们当前分别与 `--fx-sem-g`、`--fx-sem-y`、`--fx-sem-r` 值相同，也不能合并。

## 字体 Token

Figma 字体变量名直接映射到 Tailwind `text-*` 工具类。

| Figma 变量 | Tailwind token | Tailwind class |
| --- | --- | --- |
| H1 | `--text-h1` | `text-h1` |
| H2 | `--text-h2` | `text-h2` |
| H3 | `--text-h3` | `text-h3` |
| H4 | `--text-h4` | `text-h4` |
| H5 | `--text-h5` | `text-h5` |
| H6 | `--text-h6` | `text-h6` |
| H7 | `--text-h7` | `text-h7` |
| H-L | `--text-h-l` | `text-h-l` |
| H-XL | `--text-h-xl` | `text-h-xl` |
| H-XXL | `--text-h-xxl` | `text-h-xxl` |
| Subtitle | `--text-subtitle` | `text-subtitle` |
| Body-Regular | `--text-body-regular` | `text-body-regular` |
| Body-S | `--text-body-s` | `text-body-s` |
| Body-XS | `--text-body-xs` | `text-body-xs` |
| Body-XXS | `--text-body-xxs` | `text-body-xxs` |

每个 text token 都必须包含对应 line-height token，例如 `--text-h5--line-height`。

## 阴影 Token

阴影工具类作为项目 token 暴露，因为它们表达可复用的 elevation 规则。

| Token | 源变量 | Tailwind class |
| --- | --- | --- |
| `--shadow-z100` | `--fx-shadow-fill`, `--fx-shadow-stroke` | `shadow-z100` |
| `--shadow-z200` | `--fx-shadow-fill`, `--fx-shadow-stroke` | `shadow-z200` |
| `--shadow-z300` | `--fx-shadow-fill`, `--fx-shadow-stroke` | `shadow-z300` |
| `--shadow-z400` | `--fx-shadow-fill-depth`, `--fx-shadow-stroke-z400` | `shadow-z400` |
| `--shadow-z500` | `--fx-shadow-fill-depth`, `--fx-shadow-stroke-z500` | `shadow-z500` |
| `--shadow-popup` | `--fx-shadow-popup-fill`, `--fx-shadow-popup-stroke` | `shadow-popup` |

`--fx-shadow-*` 变量是源变量，不作为独立 Tailwind color token 暴露。

## 默认值对齐备注

这些约定用于设计与实现对齐，但不创建新的项目 token。

| UI 约定 | Tailwind 默认 class | CSS 源变量 | 备注 |
| --- | --- | --- | --- |
| 4px spacing | `p-1`, `m-1`, `gap-1` | 无 | 使用 Tailwind 默认 spacing。 |
| 8px spacing | `p-2`, `m-2`, `gap-2` | 无 | 使用 Tailwind 默认 spacing。 |
| 16px spacing | `p-4`, `m-4`, `gap-4` | 无 | 使用 Tailwind 默认 spacing。 |
| 8px radius | `rounded-lg` | 无 | 使用 Tailwind 默认 radius。 |
| 640px breakpoint | `sm:*` | 无 | 使用 Tailwind 默认 breakpoint。 |
| 768px breakpoint | `md:*` | 无 | 使用 Tailwind 默认 breakpoint。 |
| 1024px breakpoint | `lg:*` | 无 | 使用 Tailwind 默认 breakpoint。 |
| 1280px breakpoint | `xl:*` | 无 | 使用 Tailwind 默认 breakpoint。 |
| 1536px breakpoint | `2xl:*` | 无 | 使用 Tailwind 默认 breakpoint。 |

组件布局中出现的 radius、spacing、breakpoint 值属于 UI 实现约定，除非它们被提升为真实 Figma 变量。
