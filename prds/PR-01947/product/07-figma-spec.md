# 07 — Figma 设计规格

> **模板**：`templates/07-figma-spec-template.md`  
> **读取流程**：[figma-mcp-read-workflow.md](../../../common/rules/figma-mcp-read-workflow.md)  
> **Token 规则**：[ui-style-token-rules.md](../../../common/rules/ui-style-token-rules.md)（**禁止为单页改 `packages/config/tailwind-preset.js`**）

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-01947` |
| 读取时间 | **2026-07-14**（增量重读 · 设计稿当日更新） |
| 设计稿最后编辑 | serena · **2026-07-14**（version `2376019592271881175`） |
| 读取方式 | Playwright Dev Mode Inspect（逐 nodeId 原子读取）；2026-07-13 曾用 MCP `get_metadata` |
| **本期还原范围** | **智能比例 Tab** 下「合约跟单设置」表单（`15089:25554` 及三参数变体 Frame） |
| **本期不读** | 固定额度 / 倍率 Tab、滑点方案 Frame（`15102:28139` 等 · N01）、后台、App |
| Figma fileKey | `KzvWxAYxqfgpoiYuKdxMAE` |
| 主 Canvas nodeId | `15089:25043` |
| 设计稿 | [「FameEX三期」 WEB](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=15089-25043&m=dev) |
| 还原目标 | 默认 ≥95%；高保真例外见 `engineering/development-rules.md` |
| 读取证据 | `evidence/ui-ux/2026-07-14/README.md` |

> **与旧登记差异**：L2 基线仍为正式三期稿 `KzvWxAYxqfgpoiYuKdxMAE`（非 Sissie 原型 8411-1559）。**2026-07-14 设计更新主要落在智能比例 Tab 表单 UI**；nodeId 与 2026-07-13 登记一致，几何/颜色/token 已补读。

---

## 1. G1 读取 Checklist（Agent 必勾选）

- [x] 已从 PRD / 协作记录确认 Figma 链接与主画板
- [x] `get_metadata` 已列出模块与子 **nodeId**（2026-07-13）
- [x] **智能比例 Tab** 关键 Frame 已逐帧 Dev Mode Inspect（2026-07-14）
- [x] **原子控件**（Input / select / Switch / Button / Modal / 图标）已单独读 nodeId（§3 已填 cornerRadius）
- [x] §3 **控件几何表** 已填（智能比例范围 · 含 **cornerRadius**、**preset class**）
- [x] §4 **Figma → preset 映射表** 已填（间距 + 圆角 + 颜色平替）
- [x] 颜色已映射语义 token（浅色 Dev Mode CSS 变量 → `bg-*` / `text-*` / `border-*`）
- [ ] **文本字段边界约束**已从 PRD / `05-ui-and-interaction.md` 补录（Figma 无字符上限）
- [x] **复用盘点**：`CopySetting/FollowParams/` + DS `Input` / `select` / `Switch` / `.MOL/Tab` / `Button`
- [x] PRD 与 Figma 差异已写入 §9（同步 `06-collaboration.md` Q1 基线变更）
- [ ] 深色模式 token 值待补（本次仅读浅色 Auto）

---

## 2. 链接与节点索引

```text
https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/...?node-id=15089-25043&m=dev
```

将 `{nodeId}` 中的 `:` 替换为 `-`（如 `15102:29220` → `15102-29220`）。

| 模块 | nodeId | 尺寸 (W×H) | 备注 |
|------|--------|------------|------|
| 主 Canvas | `15089:25043` | — | 【PM-1109】合约跟单优化 |
| **智能比例·默认** | `15089:25554` | 1440×1345 | **本期 L2 基准 Frame** |
| 保证金模式（收起） | `15102:28789` | 1440×1345 | 智能比例 · Select 收起态 |
| 保证金模式（展开） | `15102:29220` | 1440×1345 | Select 展开 · 面板 `15102:36290` 775×88 |
| 杠杆·跟随交易员 | `15102:37348` | 1440×1345 | Input 展示「跟随交易员」 |
| 杠杆·自定义 | `15102:37781` | 1440×1345 | 自定义 + Select 展开 |
| 杠杆·变体 3 | `15102:38202` | 1440×1345 | 第三变体（与 37781 对照） |
| 复制仓位 | `15102:38818` | 1440×1345 | Switch + Input · **Edited 2026-07-13** |
| 确认弹窗 F13 | `15206:9774` | **400×571** | JF2 · 新增三参数行 |
| ~~滑点方案 2~~ | `15102:28139` | 1440×1345 | **本期不做 N01** · 仅记录存在 |

---

## 3. 控件几何表（必填）

> 每个可点击 / 可辨识控件一行。**2026-07-14 Dev Mode 实测**（来源：Playwright Inspect · 浅色模式）。  
> 形状判定：`cornerRadius ≥ min(W,H)/2` → 圆形 → `rounded-full`。

| 模块 | nodeId | W×H | cornerRadius | 形状 | Figma 值 / CSS | **preset class（采用）** | 描边 / 填充 | 代码落点 |
|------|--------|-----|--------------|------|----------------|--------------------------|-------------|----------|
| 页面标题 | `15102:29297` | 满宽×36 | — | 文本 | Bold/H3 24/150 · `#241259` | `text-h3 text-1 font-bold` | Text-1 | `SettingForm` 标题 |
| 模式 Tab | `15102:29301` | 56×28 | 待补 | 胶囊 | `.MOL/Tab` 实例 | DS Tab · Tab 间距 16px `gap-4` | Text-1 选中 | 三表单 Tab 行 |
| 金额 Input | `15102:29312` | 776×40 | 8（DS） | 矩形 | padding 8×12 · gap 10 | `h-10 w-full py-2 px-3` | CC-3 边框 | `SmartCopyForm` 开仓金额 |
| Switch（新币对） | `15102:29328` | 32×16 | 8（推断） | 胶囊 | Brand-1 轨道 | `w-8 h-4` · DS Switch | Brand-1 | 自动跟单新币对 |
| Warning 图标 | `15102:29327` | 16×16 | — | 方形 | aspect 1:1 | `size-4` | — | 字段标签行 |
| Information 4 | `15102:29331` | 16×16 | — | 方形 | tooltip | `size-4` | — | 高级设置说明 |
| 字段标签 | `15102:29352` | 80×24 | — | 文本 | Medium/Subtitle | `text-body-regular text-3` | Text-3 | 各字段名 |
| 保证金 Input | `15102:29353` | 776×40 | 8（DS） | 矩形 | Theme_Web Input + 下拉箭头 | `h-10 w-full` | CC-3 | `MarginModeField` |
| 保证金下拉面板 | `15102:36290` | 775×88 | **8px** | 矩形 | padding 4×0 · shadow | `rounded-2 border-[0.5px] border-cc-2 bg-bg-3` | CC-2 `#F3F4F7` · BG-3 `#FFF` | `MarginModeField` Select 浮层 |
| 下拉箭头 | `15102:29349` | 12×12 | — | — | Arrow_drop_down | DS 图标 12 | — | Input 右侧 |
| 杠杆 Input（跟随） | `15102:37481` | 776×40 | 8（DS） | 矩形 | 单行 Select 展示 | `h-10 w-full` | CC-3 | `LeverageField` |
| 杠杆 Input（自定义） | `15102:37771` | 776×40 | 8（DS） | 矩形 | 数值 + 下拉 | `h-10 w-full` | CC-3 | `LeverageField` 自定义态 |
| 杠杆下拉面板 | `15102:38193` | 775×88 | **8px** | 矩形 | 同保证金 select | `rounded-2 border-cc-2 bg-bg-3` | 同上 | `LeverageField` |
| 复制仓位 Switch 行 | `15206:9730` | 776×72 | — | 纵向 Auto | gap 8 · 标签+Switch | `flex flex-col gap-2` | — | `CopyPositionField` 标题行 |
| 复制仓位 Input | `15206:9721` | 776×40 | 8（DS） | 矩形 | Switch 开启后展示 | `h-10 w-full` | CC-3 | `CopyPositionField` 模式 Select |
| 双列 Input 左 | `15102:29361` | 384×40 | 8（DS） | 矩形 | 列间距 8px | `flex-1 h-10` | CC-3 | 止盈/止损 |
| 提交提示行 | `15102:29374` | 251×17 | — | 行 | gap 4 · icon+文案 | `text-body-s text-4 gap-1` | Text-4 | 按钮上方 |
| 主按钮 | `15102:29377` | 776×40 | **8px** | 矩形 | padding 8×16 · gap 10 | `h-10 w-full rounded-2 bg-brand-1 py-2 px-4` | Brand-1 `#7132F4` · Text-6 | 提交 CTA |
| 确认弹窗 | `15206:9774` | 400×571 | **16px** | 矩形 | flex col · gap 8 · shadow | `w-100 rounded-4 bg-bg-3` | BG-3 `#FFF` | `ConfirmCopyModal` |
| 弹窗内容行 | `15206:9781` | 335×21 | — | 行 | label:value 21px 行高 | `flex justify-between text-body-regular` | Text-1 / Text-3 | 参数展示行 |
| 弹窗 Checkbox | `15206:9818` | 290×21 | — | 行 | gap 8 | `gap-2` · DS Checkbox 16×16 | — | 协议勾选 |
| 弹窗按钮 | `15206:9817` | 352×40 | 8（推断） | 矩形 | 底区 CTA | `h-10 rounded-2 bg-brand-1` | Brand-1 | 弹窗确认 |

---

## 4. Figma → Tailwind preset 映射表

| Figma / MCP 输出 | 像素值 | preset class（采用） | 映射类型 | 备注 |
|------------------|--------|----------------------|----------|------|
| 左表单宽 | 776px | `w-full max-w-[776px]` | 布局 | 无 spacing 键 776 |
| 右栏宽 | 336px | — | 布局 | 侧栏非本期三参数范围 |
| 表单列间距 | 8px | `gap-2` | 精确 | 384+8+384=776 |
| Tab 间距 | 16px | `gap-4` | 精确 | |
| Input 高 | 40px | `h-10` | 精确 | spacing 10=40px |
| Input 内边距（金额） | 8×12 | `py-2 px-3` | 精确 | `15102:29312` |
| 标签→Input | 8px | `mt-2` | 精确 | 字段块 gap 8 |
| Select 面板圆角 | 8px | `rounded-2` | 精确 | Figma rounded-2 = 8px |
| Select 边框 | 0.5px CC-2 | `border-[0.5px] border-cc-2` | 精确 | `#F3F4F7` |
| 主按钮圆角 | 8px | `rounded-2` | 精确 | |
| 主按钮 padding | 8×16 | `py-2 px-4` | 精确 | |
| 主按钮 gap | 10px | `gap-2.5` 或 DS 默认 | 相近 | 无 spacing 10 键时用 gap-2.5 |
| 弹窗宽 | 400px | `w-100` | 精确 | |
| 弹窗圆角 | 16px | `rounded-4` | 精确 | |
| 弹窗 gap | 8px | `gap-2` | 精确 | |
| Switch | 32×16 | `w-8 h-4` · DS | 组件 | 勿手写 |
| 图标 | 16×16 | `size-4` | 精确 | Warning / Information |
| 下拉箭头 | 12×12 | DS 12 | 组件 | Arrow_drop_down |
| 弹窗行高 | 21px | `text-body-regular` leading | 精确 | `15206:9781` |
| 标题字号 | 24/150 | `text-h3` | 精确 | 非 text-h1（2026-07-14 修正） |
| Brand-1 | `#7132F4` | `bg-brand-1` / `text-brand-1` | 精确 | 按钮 / Switch |
| Text-1 | `#241259` | `text-1` | 精确 | 标题 / 主文案 |
| BG-2 页面底 | `#FFF` | `bg-bg-2` | 精确 | Frame 背景 |
| BG-3 浮层 | `#FFF` | `bg-bg-3` | 精确 | Select / Modal |

**禁止**：为单页在 `tailwind-preset.js` 新增键；未声明高保真时禁止 arbitrary。

---

## 5. 颜色 / 字体 token

| Figma 变量 | 浅色（实测） | 深色 | preset class | 用途 |
|------------|-------------|------|--------------|------|
| `--BG-2` | `#FFF` | 待补 | `bg-bg-2` | 页面 / Frame 底 |
| `--BG-3` | `#FFF` | 待补 | `bg-bg-3` | Select 浮层 / Modal |
| `--Brand-1` | `#7132F4` | 待补 | `bg-brand-1` / `text-brand-1` | 主按钮 / Switch 选中 |
| `--Text-1` | `#241259` | 待补 | `text-1` | 标题 / 主文案 |
| `--Text-2` | 待补 hex | 待补 | `text-2` | 次要文案 |
| `--Text-3` | 待补 hex | 待补 | `text-3` | 字段标签 |
| `--Text-4` | 待补 hex | 待补 | `text-4` | 辅助 / 提示 |
| `--Text-6` | 待补 hex | 待补 | `text-6` | 主按钮字色 |
| `--CC-2` | `#F3F4F7` | 待补 | `border-cc-2` | Select 0.5px 边框 |
| `--CC-3` | 待补 hex | 待补 | `border-cc-3` | Input 边框 |
| 页面标题 | 24px / 150% | — | `text-h3 font-bold` | 「合约跟单设置」· **非 h1** |
| 字段标签 | Medium/Subtitle 24 行 | — | `text-body-regular text-3` | 各字段名 |
| 弹窗行 | 21px 行高 | — | `text-body-regular` | 确认弹窗 label:value |
| 辅助说明 | 17px 行高 | — | `text-body-s text-4` | Input 下提示 / 提交前提示 |
| 文本样式（选用） | Bold/H4 20/150 · H5 18/150 · H7 14/150 | — | 见 DS | Tab / 区块标题 |

字号优先 `fontSize` preset：`h1`–`h7`、`body-regular`、`body-s`。

---

## 6. 图标与品牌资源映射

| 控件 | nodeId | 图标 / 资源 | 禁止 |
|------|--------|-------------|------|
| 字段警告 | `15102:29327` | `Warning` 16×16 | 无关 icon |
| 说明 tooltip | `15102:29331` | `Information 4` 16×16 | — |
| 下拉箭头 | `15102:29349` | `Arrow_drop_down` 12×12 | — |
| 提交前提示 | `15102:29375` | `Information 3` 16×16 | — |
| 选中勾选（若用列表态） | — | `icon-[fx--check]` | 正式稿复制仓位为 Switch 非 ✓ 列表 |

---

## 7. 模块规格（按页面结构分节）

### 7.1 页面骨架 — `15089:25554`

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 布局 | 左 776px 表单 + 右 336px 交易员信息；页面 padding 左 120px | `flex` / 现有 `SettingForm` 布局 |
| 顶栏 | Top nav 64px |  sitewide |
| 面包屑 | 210×21 @ (120,88) | `Breadcrumb` 实例 |
| 标题 | 「合约跟单设置」满宽×36 | `text-h3 text-1 font-bold`（24/150 · **非 text-h1**） |
| Tab 行 | 3× `.MOL/Tab` 56×28 + 说明 18px | DS Tab + `text-body-s` |
| 提交区 | 提示 icon+文案 17px + Button 776×40 | `Information` + 主按钮 |

### 7.2 保证金模式 F01–F04

**智能比例**（`15102:28789` / `15102:29220`）：

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 布局 | 标签 80×24 → Input 776×40 → 辅助 198×17 → 可选展开 select 775×88 | **下拉 Select**，非两列卡片 |
| 交互 | 点击 Input/箭头展开选项 | HeroUI Select 或 DS `select` |
| 风险提示 | Input 下方 17px 辅助行（全仓时） | `text-body-s text-sem-r` |
| ~~禁用~~ | ~~有跟随持仓~~ | **前端无禁用态**：有持仓禁改由后端提交时校验（2026-07-21 定案，`disabled`/`marginModeLockedTips` 已删） |

**固定额度**（`15102:36298`）：

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 布局 | Input 776×40；下一行左辅助文案 + **右对齐 Radio 组**（全仓/逐仓） | 行内 `.MOL/Radio` 16×16 |
| 与智能比例差异 | **不同交互范式**——固定模式无下拉，用行内 Radio | 按 `followType` 分支渲染 |

### 7.3 杠杆调整 F05–F09

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 默认（跟随） | 标签「杠杆」32×24 + Input 776×40 + 辅助 187×17 | Select 展示「跟随交易员」 |
| 自定义 | 上述 + 第二 Input 块（自定义值） | 自定义时展开数值 Input；可选 Slider（1–20x，见 `constants.ts`） |
| 展开 | `select` 775×88 @ y=840 | 选项：跟随交易员 / 自定义 |
| 禁用 | F09 有跟随持仓 | `disabled` + 锁定提示 |
| 与现实现差异 | 现：`LeverageField` 两列卡片 + Slider | **应改为 Select + 条件 Input** |

### 7.4 复制仓位 F10–F12

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 布局 | 标题行 24px + Switch 右对齐；开启后 Input 776×40（`15206:9730`） | **Switch + 展开 Input** |
| 默认值 | 确认弹窗示例：「复制价格更好的持仓」 | `CopyPositionMode.BetterPrice` |
| 与现实现差异 | 现：三行卡片 + `icon-[fx--check]` | **应改为 Switch 控制 + 下拉/Input 选具体模式** |

### 7.5 确认弹窗 F13 — `15206:9774`

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 尺寸 | 400×571 | `w-100` Modal |
| 结构 | 头 60px → 头像+昵称 → 上半参数列表 → **分隔线** → 下半（含新增三行）→ Checkbox → Button |
| 新增行 | 保证金模式 / 杠杆 / （滑点本期不做） | `ConfirmCopyModal` props |
| 行布局 | 335×21，label 左 value 右 | `flex justify-between` |
| 展示值示例 | 「跟随交易员保证金模式」「跟随交易员杠杆」「复制价格更好的持仓」 | 需补 i18n（§8） |
| 文本约束 | 值过长右对齐省略 | `truncate` / `text-right` |

### 7.6 页面布局 ASCII

```text
┌─────────────────────────────────────────────────────────────┐
│ Top nav (64px)                                              │
├─────────────────────────────────────────────────────────────┤
│ Breadcrumb (120,88) 210×21                                  │
│ ┌─ 左表单 (120,149) 776px ─┐  ┌─ 右栏 (984,209) 336px ─┐   │
│ │ 合约跟单设置              │  │ 交易员统计/币种偏好      │   │
│ │ Tab + 表单 + 高级设置     │  │ 收益曲线                │   │
│ │ Button 776×40            │  │                         │   │
│ └──────────────────────────┘  └─────────────────────────┘   │
│ Footer                                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 文案映射（设计稿 ↔ i18n）

| 设计稿文案 | i18n key | 状态 |
|-----------|----------|------|
| 保证金模式 | `CopySetting.marginMode` | ✅ |
| 全仓 / 逐仓 | `CopySetting.cross` / `CopySetting.isolated` | ✅ |
| 杠杆调整 | `CopySetting.leverageMode` | ✅ |
| 跟随交易员 | `CopySetting.followTrader` | ✅ |
| 自定义 | `CopySetting.leverageCustom` | ✅ |
| 复制仓位 | `CopySetting.copyPosition` | ✅ |
| 复制所有持仓 | `CopySetting.copyPositionAll` | ✅ |
| 复制价格更好的持仓 | `CopySetting.copyPositionBetterPrice` | ✅ |
| 不复制现有持仓 | `CopySetting.copyPositionNone` | ✅ |
| 现有持仓复制模式（弹窗标签） | 用 `CopySetting.copyPosition` | ✅ 复用 |
| 跟随交易员保证金模式（弹窗值） | label=`marginMode` + value 查表 `cross`/`isolated` | ✅ 拆分组合 |
| 跟随交易员杠杆（弹窗值） | label=`leverageMode` + value=`followTrader` / `{n}x` | ✅ 拆分组合 |

> **实现口径**：弹窗未新增「整句」拼接文案，改用「label key + value 查表」组合（`ConfirmCopyModal` `marginModeText`/`leverageText`/`copyPositionText`），更符合内容资产逐字搬运 + 不兜假默认（缺失显 `--`）。§8 原「待新增」三条视为 ✅ 由既有 key 覆盖。

---

## 9. PRD / Figma 差异

| # | Figma（本稿） | PRD / 旧登记 | 结论 |
|---|--------------|-------------|------|
| D1 | 正式三期稿 `KzvWxAYxqfgpoiYuKdxMAE` | 原型 `1ro2OBI8…8411-1559` | **L2 基线改用正式稿**；更新 Q1 |
| D2 | 保证金/杠杆 = **下拉 Select**；固定模式保证金 = **行内 Radio** | 原型多为卡片 Radio | JF1 按正式稿改 `FollowParams/` |
| D3 | 复制仓位 = **Switch + Input** | 原型/现实现 = 三行卡片列表 | JF1 改 `CopyPositionField` |
| D4 | 滑点 Slider 0–3% 完整展示 | PRD N01 本期不做 | 不实现；Slider 几何可参考杠杆 |
| D5 | 弹窗含「最大交易滑点」行 | 本期不做 | 弹窗该行不渲染 |
| D6 | 自定义杠杆范围 | PRD 前端硬限制 1–20x | 已落码 `CUSTOM_LEVERAGE_MIN/MAX` |

---

## 10. 与当前实现差异（L2 还原清单）

> **2026-07-14 更新**：JF1/JF2 交互范式已落码（`c3c0b3b19a`）。下表「当前实现」列已是正式稿范式；剩余为 DS 组件层几何偏差，待人工 L2 走查判定。

| 控件 | 当前 `FollowParams/`（已落码） | 本 Figma 正式稿 | 剩余差异 |
|------|---------------------|----------------|--------|
| `MarginModeField` | ✅ Select（智能）/ 行内 Radio（固定） | 同 | Select 浮层描边/圆角（DS 层，T6） |
| `LeverageField` | ✅ Select + 条件数值 Input（钳制 1-20x） | 同 | 同上 |
| `CopyPositionField` | ✅ Switch + 展开 Select | 同 | 同上 |
| `ConfirmCopyModal` | ✅ 三行 + 查表文案 + `--` 兜底 | 行高 21px、分隔线、右对齐值 | 像素级走查 |

---

## 11. 响应式 / H5

| 断点 | nodeId | 与桌面差异 | preset 调整 |
|------|--------|------------|-------------|
| 390px | 无独立 Frame | 左栏全宽堆叠；右栏下移或隐藏 | `w-full`；三参数控件纵向 `flex-col` |
| 1440 桌面 | 各主 Frame | 基准 | 见 §7 |

---

## 12. 待补读取

| 控件 | nodeId | 状态 |
|------|--------|------|
| 保证金 Input | `15102:29353` | ✅ 2026-07-14 |
| 展开 select | `15102:36290` | ✅ 2026-07-14 |
| 杠杆 Input | `15102:37771` | ✅ 2026-07-14 |
| 复制仓位 Switch 块 | `15206:9730` | ✅ 2026-07-14 |
| 确认弹窗 | `15206:9774` | ✅ 2026-07-14 |
| 主按钮 | `15102:29377` | ✅ 2026-07-14 |
| 行内 Radio（固定 Tab） | `15102:36774` | ⏸ 本期范围外 |
| Select 选项行 / hover 色 | select 子节点 | 待补 |
| 深色模式 token hex | — | 待补 |
| 390px 独立 Frame | — | 待补 · 仍按堆叠推导 |

> 2026-07-14 使用 Playwright Dev Mode 销账；Figma MCP 恢复后可交叉验证。

---

## 13. 走查清单（G6 / JF1）

- [ ] 桌面主画板 L2 并排 ≥95%（对照 `15102:29220` / `15102:37781` / `15102:38818`）
- [ ] 390px H5 核心模块无横向溢出
- [ ] dark / light 各一遍
- [ ] §3 几何表每一行已在实现中对齐
- [ ] 未为单页修改 `tailwind-preset.js`
- [ ] 三参数交互范式与 §10 差异表一致（非卡片 Radio）
