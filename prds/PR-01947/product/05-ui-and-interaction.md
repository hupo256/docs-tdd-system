# UI And Interaction — 智能比例 Tab（PR-01947）

> **范围**：仅 `SmartCopyForm` + `SmartAdvancedSettings` + `FollowParams/`（固定/倍率 Tab 见各自 Frame，**本期不还原**）。  
> **Figma 基准**：`15089:25554` · 规格见 `07-figma-spec.md`

## 页面 / 路由

| 项 | 值 |
|----|-----|
| 路由 | `/[lang]/copy-trading/...` 跟单设置（交易员详情 → 跟单设置） |
| 容器 | `SettingForm.tsx` → `SmartCopyForm`（`followType === SmartRatio`） |
| 布局 | 左表单 776px + 右栏交易员信息 336px（1440 桌面） |

## 智能比例 Tab — 字段顺序（自上而下）

| # | 区块 | Figma 参考 | 组件 / 交互 |
|---|------|-----------|-------------|
| 1 | 页面标题 | `15102:29297` | 「合约跟单设置」 |
| 2 | 模式 Tab | `15102:29301` ×3 | 智能比例 **选中** / 固定额度 / 倍率 · DS Tab |
| 3 | Tab 说明 | 18px 辅助文案 | `text-body-s text-4` |
| 4 | 单笔开仓金额 | `15102:29312` | Theme_Web Input · 776×40 · 右侧 USDT |
| 5 | 自动跟单新币对 | `15102:29328` | Switch 32×16 · 标签左 Switch 右 |
| 6 | 高级设置（可折叠） | — | 展开后含三参数 + 止盈止损 |
| 7 | **保证金模式** | `15102:28789` / `29220` | **Select Input** · 点击展开 775×88 面板 · 选项：全仓/逐仓 |
| 8 | **杠杆** | `15102:37348` / `37781` | **Select Input** · 选项：跟随交易员 / 自定义 · 自定义时第二行 Input |
| 9 | **复制仓位** | `15102:38818` | **Switch** 控制是否复制 · 开启后 **Select Input** 选具体模式 |
| 10 | 止盈 / 止损 | `15102:29361` ×2 | 双列 Input 384+8+384 · **小数比例输入（0.15=15%），placeholder 为动态上下限（缺省 0.01–4，2026-07-23 口径 `03 §3.2`）** |
| 11 | 提交提示 | `15102:29374` | Information + 17px 文案 |
| 12 | 提交按钮 | `15102:29377` | 776×40 · `bg-brand-1` 全宽 |

## 三参数交互（JF1 还原要点）

### 保证金模式（智能比例）

| 态 | 交互 | 视觉 |
|----|------|------|
| 默认 | 单行 Input 展示当前值（如「全仓」） | 776×40 · 右侧 Chevron down 12 |
| 展开 | 点击 Input/箭头 → 浮层 select | 775×88 · `rounded-2 border-cc-2 bg-bg-3` · 0.5px 边框 + shadow |
| 选中 | 点击选项 → 收起 · 更新 Input 文案 | 选中项 Text-1 |
| 全仓风险 | Input 下方辅助行 | `text-body-s text-sem-r`（PRD F02） |

> **无禁用态**（2026-07-21 定案）：有跟随持仓禁改由后端在提交时校验并返回失败原因，前端不做 `disabled` + 锁定提示（Q3 字段已删）。

### 杠杆（智能比例）

| 态 | 交互 | 视觉 |
|----|------|------|
| 跟随交易员 | Input 展示「跟随交易员」 | 单行 776×40 |
| 展开 | 同保证金 Select 范式 | 775×88 面板 |
| 自定义 | 选中「自定义」→ 显示数值 Input + Slider | 可输入 1–20x（`CUSTOM_LEVERAGE_MIN/MAX`） |

> **注意**：正式稿 **无** 两列卡片 Radio + Slider；现 `LeverageField` 卡片范式需改 Select + 条件 Input。

### 复制仓位（智能比例）

| 态 | 交互 | 视觉 |
|----|------|------|
| Switch 关 | 不复制现有持仓 | 仅标题行 776×72（标签 + Switch 右对齐） |
| Switch 开 | 下方出现 Select Input | 776×40 · 选项：复制所有 / 复制更好价 / 不复制 |
| 默认 | PRD：复制价格更好的持仓 | `CopyPositionMode.BetterPrice` |

> **注意**：正式稿 **非** 三行卡片 + ✓ 图标列表。

## 确认弹窗（JF2 · P1 · 智能比例共用）

| 项 | 规格 |
|----|------|
| 尺寸 | 400×571 · `rounded-4 bg-bg-3` |
| 新增行 | 保证金模式 / 杠杆 / 复制仓位（各 335×21） |
| 布局 | label 左 · value 右 · `flex justify-between` |
| 分隔 | 上半参数与下半新增行之间有分隔线 |
| 滑点行 | **不渲染**（N01） |

## 状态

| 状态 | 处理 |
|------|------|
| Loading | `before_follow` 请求中 · 表单 skeleton 或 disabled |
| Empty | 不适用（交易员上下文必填） |
| Error | 接口失败 Toast · `getSaveFollowForbiddenMessage` 展示后端原因 |
| Disabled | 提交中按钮 loading（有持仓禁改由后端校验，前端不做 disabled 态） |
| Success | 提交成功 → 跳转或 Toast · 刷新 follow 状态 |

## 响应式（390px）

- 左栏 `w-full` 堆叠 · 三参数控件保持全宽 Input
- 双列止盈/止损改为纵向 `flex-col gap-2`
- Select 浮层全宽 · 不横向溢出

## 本期不做

- 滑点区（`15102:28139` 等 Frame · N01）
- 固定额度 Tab 行内 Radio（`15102:36298` · 另一 PRD 落点）
- 倍率 Tab 专属字段
