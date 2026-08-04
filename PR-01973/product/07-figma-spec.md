# 07 — Figma 设计规格（MCP 读取结果）

> **读取时间**：2026-06-09；**像素级补充**：2026-06-10（见 §10、§11）  
> **读取方式**：Cursor Figma MCP（`whoami` / `get_metadata` / `get_design_context` / `get_variable_defs` / `get_screenshot`）  
> **认证账号**：`dubaifrontend@mail.fameex.info`（MCP 已登录，无需浏览器再登）  
> **Figma 文件**：「FameEX三期」— WEB · fileKey `KzvWxAYxqfgpoiYuKdxMAE`  
> **TradFi 画板页**：canvas `tradfi` · node `9409:22402`  
> **桌面整页 Frame**：`10323:33697`（画板内名称仍为「预测市场/无二级标题」，属模板遗留）

## 1. 链接模板

```text
https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id={nodeId}&m=dev
```

将 `{nodeId}` 中的 `:` 替换为 `-`。

| 用途 | nodeId | 链接 |
|------|--------|------|
| TradFi 整页（桌面 1440） | `10323:33697` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-33697&m=dev) |
| TradFi 页面 canvas | `9409:22402` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=9409-22402&m=dev) |
| 顶部导航 | `10323:33777` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-33777&m=dev) |
| Hero 文案 + CTA | `10357:71386` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10357-71386&m=dev) |
| Banner 轮播卡片组 | `10323:35213` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-35213&m=dev) |
| 单张 Banner 卡片 | `10323:35215` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-35215&m=dev) |
| 可交易资产（整模块） | `10323:34338` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-34338&m=dev) |
| 资产 Tab | `10323:34349` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-34349&m=dev) |
| 资产表头 | `10323:34356` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-34356&m=dev) |
| 资产列表行 | `10323:34370` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-34370&m=dev) |
| 分页 | `10350:45468` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10350-45468&m=dev) |
| 优势三卡 | `10323:35189` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-35189&m=dev) |
| FAQ | `10323:33699` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10323-33699&m=dev) |
| Nav hot 图标 | `10350:40898` | [打开](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=10350-40898&m=dev) |

## 2. 画板结构概览

### 2.1 桌面整页 `10323:33697`

| 项 | 值 |
|----|-----|
| 画板尺寸 | **1440 × 3561** |
| 内容区宽度 | **1200px**（左右各 **120px** 留白） |
| 主题 | **深色**（变量以 dark token 为主；实现时需支持深浅色切换） |
| H5 画板 | **未提供**（本 canvas 内无 375/390 独立 Frame） |

**页面纵向结构**（自上而下，y 取自 Figma metadata）：

```text
┌─ Top nav ─────────────────────────────── 1440×64 ─┐  10323:33777 · y=0
├─ 间距 ~130px ──────────────────────────────────────┤
├─ Hero（文案 + CTA）──────────────────── 680×263 ─┤  10357:71386 · y=194 · x=120
├─ 间距 ~197px ──────────────────────────────────────┤
├─ Banner 横向卡片轮播 ─────────────────── 1802×248 ─┤  10323:35213 · y=654 · x=-148（左右溢出）
├─ 间距 ~100px ──────────────────────────────────────┤
├─ 可交易资产（Tab + 表 + 分页）────────── 1200×828 ─┤  10323:34338 · y=1002 · x=120
├─ 间距 ~100px ──────────────────────────────────────┤
├─ 为什么选择 FameEX TradFi ────────────── 1200×350 ─┤  10323:35189 · y=1930 · x=125
├─ 间距 ~100px ──────────────────────────────────────┤
├─ 常见问题 ───────────────────────────── 1200×472 ─┤  10323:33699 · y=2380 · x=120
├─ 间距 ~180px ──────────────────────────────────────┤
└─ Footer（站点通用）───────────────────── 1440×529 ─┘  10323:33698 · y=3032
```

| 区块 | nodeId | 尺寸 (W×H) | 备注 |
|------|--------|------------|------|
| 顶部导航 | `10323:33777` | 1440 × 64 | 含 TradeFi + hot 图标 |
| Hero | `10357:71386` | 680 × 263 | 仅左侧文案区；右侧头图节点 **hidden** |
| Banner 轮播 | `10323:35213` | 1802 × 248 | 6 张卡片示意，卡片间距 32px |
| 单张 Banner 卡 | `10323:35215` | 230 × 248 | padding 20，圆角 12 |
| 可交易资产模块 | `10323:34338` | 1200 × 828 | 含标题、Tab、8 行列表、分页 |
| 优势三卡 | `10323:35189` | 1200 × 350 | 3×376 卡片，间距 36px |
| FAQ | `10323:33699` | 1200 × 472 | 4 条，默认全收起 |
| Footer | `10323:33698` | 1440 × 529 | 复用站点 footer 实例 |

> **模块间距约定**：大区块之间约 **100px**；区块内「标题 → 内容」统一 **40px**（标题高 48px，内容 y=88）。

### 2.2 与 PRD 结构差异（已按 2026-06-10 结论收敛）

| # | Figma | PRD | 建议 |
|---|-------|-----|------|
| D1 | 导航文案 **TradeFi**（非 TradFi），位于 **返佣 → 理财** 之间 | TradFi，位于 **合约 → 预测市场** 之间 | ✅ 文案用 `TradFi`；当前 Header 无预测市场入口时放合约后 |
| D2 | **无**独立「行情板块」模块 | PRD 5.5 行情板块 + 搜索 | ✅ 当前阶段仅实现「可交易资产」表格，不做独立 5.5 |
| D3 | Hero 副标题：`美股、外汇、贵金属、USDT统一结算` | `美股 · 贵金属 · 大宗商品，USDT 统一结算` | ✅ 采用 Figma 文案 |
| D4 | Hero 仅 **1 个** ghost 按钮「立即交易」 | 未登录「登录」/ 已登录「立即开始交易」 | ✅ 交互按 PRD，视觉参考 ghost 按钮规格 |
| D5 | Hero 右侧交互图 **hidden** | PRD 要求右侧交互图 | ✅ 本期不做 |
| D6 | 画板 Frame 名仍带「预测市场」 | TradFi 落地页 | 仅命名遗留，不影响实现 |
| D7 | **无 H5 画板** | PRD 要求 H5 适配 | ✅ 按桌面规格响应式降级 |
| D8 | 整页 Figma 未覆盖合约交易下拉状态 | PRD 0610 要求【合约交易】下拉新增 TradFi 入口 | 功能按 PRD；视觉复用现有合约交易下拉样式 |

## 3. 设计 Token（Figma Variables → 项目 Tailwind）

> 实现时 **映射为项目语义类**（`bg-1`、`text-1`、`bg-brand-1`、`text-sem-g`…），由 `globals.css` 的 `:root` / `.dark` 切换。**禁止**把 MCP 参考代码里的硬编码 hex 直接写进组件。

本页 `get_variable_defs` 读取到的主要变量（深色画板采样）：

| Figma Variable | 采样值 | 项目 Tailwind / CSS | 用途 |
|----------------|--------|---------------------|------|
| `Brand-1` | `#7132f4` | `brand-1` / `bg-brand-1` / `text-brand-1` | 主色、TradFi 高亮、分页当前页、CTA 描边 |
| `Hover-B2` | `#38206a` | `hover-b2` / `bg-hover-b2` | 列表「交易」按钮背景（深色） |
| `Text-0` | `#ffffff` | `text-0` | Hero 主标题 |
| `Text-1` | `#ffffff` | `text-1` | 正文、表数据、Tab 选中 |
| `Text-2` | `#c2c5d6` | `text-2` | Hero 副标题、表头 |
| `Text-3` | `#8d91a5` | `text-3` | 次要说明、Banner 分类标签 |
| `Text-4` | `#5a5e72` | `text-4` | Tab 未选中 |
| `Text-6` | `#ffffff` | `text-6` | 深色背景主文案 |
| `Text-10` | `#ffffff` | `text-10` | 优势卡片标题 |
| `Sem-G` | `#14b881` | `text-sem-g` / `sem-g` | 涨、正收益 |
| `Sem-R` | `#eb4747` | `text-sem-r` / `sem-r` | 跌、负收益 |
| `Sem-Y` | `#f5b83d` | `text-sem-y` | 贵金属标签字色 |
| `BG-2` | `#17181d` | `bg-2` | 页面 / 导航底 |
| `BG-Y` | `#4a3712` | `bg-y` | 贵金属标签底（深色） |
| `CC-3` | `#1e2026` | `cc-3` / `bg-cc-3` | FAQ 条目背景 |
| `Divider-1` | `#ffffff14` | `divider-1` | 分割线 |
| `Divider-2` | `#ffffff1f` | `divider-2` / `border-divider-2` | 卡片边框、Banner 边框 |

### 字体样式

| Figma 样式名 | family | size | weight | lineHeight | 典型用途 |
|--------------|--------|------|--------|------------|----------|
| Bold/H-XXL 56px | HarmonyOS Sans SC | 56 | 700 | 1.2 | Hero 主标题 |
| Bold/H-L 40px | HarmonyOS Sans SC | 40 | 700 | 1.2 | 区块标题（可交易资产、FAQ、优势） |
| Bold/H3 | HarmonyOS Sans SC | 24 | 700 | 1.5 | Banner 卡片价格 |
| Medium/H3 | HarmonyOS Sans SC | 24 | 500 | 1.5 | 优势卡片标题 |
| Medium/H4 | HarmonyOS Sans SC | 20 | 500 | 1.5 | Banner 交易对名 |
| Bold/H5 · 700/H5 | HarmonyOS Sans SC | 18 | 700 | 1.5 | Tab 选中、列表交易对 |
| Regular/H5 | HarmonyOS Sans SC | 18 | 400 | 1.5 | Hero 副标题 |
| Medium/H5 | HarmonyOS Sans SC | 18 | 500 | 1.5 | Hero CTA |
| Medium/Subtitle | HarmonyOS Sans SC | 16 | 500 | 1.5 | 列表价格列 |
| Regular/Body-Regular | HarmonyOS Sans SC | 14 | 400 | 1.5 | 优势说明、分页数字 |
| Medium/Body-Regular | HarmonyOS Sans SC | 14 | 500 | 1.5 | 涨跌幅、交易按钮 |
| Regular/Body-S 12px | HarmonyOS Sans SC | 12 | 400 | 1.5 | 表头、Banner 分类 |
| Regular/Body-XXS 10px | HarmonyOS Sans SC | 10 | 400 | 1.6 | 列表内分类标签 |

### 圆角与间距

| 元素 | 值 |
|------|-----|
| Banner / 优势 / FAQ 卡片 | `12px` / `20px` / `16px` |
| 主按钮 / 列表交易按钮 | `8px` |
| 分类小标签 | `2px` |
| 分页页码 | `4px` |
| 区块标题 → 内容 | `40px` |
| 大区块间距 | `~100px` |
| Banner 卡片间距 | `32px` |
| 优势三卡间距 | `36px`（1200 - 376×3） |
| FAQ 条目间距 | `24px` |

## 4. 模块规格

### 4.1 顶部导航 `10323:33777`

| 项 | 规格 |
|----|------|
| 高度 | **64px**，背景 `bg-2` |
| TradeFi 入口 | node `10350:35412` · 文案 **TradeFi** · 右侧 hot 图标 `10350:40898` · **11.2 × 14px** 紫色 flame |
| 导航顺序（Figma） | 买币 → 行情 → 现货交易 ↓ → 合约交易 ↓ → 返佣 ↓ → **TradeFi 🔥** → 理财 → 福利 → 反馈 |
| hot 标签 | 非文字 badge，为 **图标**（Group 1017）；实现可导出 SVG 或复用现有 header hot 组件 |
| 右侧 | 充值（brand 实心 32h）· 资产 ↓ · 订单 ↓ · 账户 · 通知 · 下载 · 主题 · 语言 · 线路 |
| active 态 | 本 Frame **未单独标注** TradFi active；落地页内建议沿用 Header 现有 active 样式 |

### 4.2 Hero `10357:71386`

| 区域 | 规格 |
|------|------|
| 容器 | 宽 **680px**，高 **263px**，左对齐内容区（x=120） |
| 主标题 | 两行：`FameEX` + `加密赋能的 TradFi 交易` · **56px Bold** · `TradFi` 字色 **brand-1**，其余 **text-0/white** |
| 副标题 | `美股、外汇、贵金属、USDT统一结算` · **18px Regular** · **text-2** · 标题下间距 **24px** |
| CTA | **160 × 40** · 描边 **1px brand-1** · 圆角 **8px** · 文案 **立即交易** · **18px Medium brand-1** · ghost 样式（透明底）；hover 为 **bg-brand-1 + text-0** |
| 标题 ↔ CTA | 垂直间距 **40px**（183px 文案区 + 40px gap + 40px 按钮） |
| 右侧图 | `10323:35382`（486×480 `头图 1`）在 Figma 中为 **hidden**；PRD 若要求展示需补资源 |

### 4.3 Banner 交易对轮播 `10323:35213`

| 项 | 规格 |
|----|------|
| 轨道 | 横向 flex，**gap 32px**，总宽 1802px，相对内容区 **左右溢出**（x=-148） |
| 单卡 | **230 × 248** · padding **20** · gap **12** · 圆角 **12** · 边框 **divider-2** |
| Logo | **44 × 44**，圆形裁切 |
| 交易对名 | **20px Medium** · text-1 / text-10 |
| 分类 | **12px Medium** · text-3（Banner 内无彩色 tag 底） |
| 价格 | **24px Bold** |
| 涨跌幅 | **14px Medium** · sem-g / sem-r |
| 迷你走势 | 宽约 **190px**，曲线高约 **54px**；涨绿跌红矢量线 |
| 示意数据 | NVDAUSDT、XUAUSDT、XAGUSDT、TSLAUSDT、AMZNUSDT 等 |
| hover / 放大 | Frame **未提供** 独立 hover 态；PRD 要求 hover 反馈需交互稿或实现时与产品确认 |
| 轮播 | 6 卡横排示意；实现为按标签维度轮播 + 自动刷新 |

### 4.4 可交易资产 `10323:34338`

**模块标题** `10323:34341`：`可交易资产` · **40px Bold** · 宽 200px。

**Tab** `10323:34349`：

| 状态 | 样式 |
|------|------|
| 选中（全部） | **18px Bold** · text-1 |
| 未选中 | **18px Bold** · text-4 · 可选 bottom border 2px transparent |
| 项 | 全部 · 股票 · 贵金属 · 商品 |
| 布局 | 水平 gap **32px**，左右 padding **24px**，行高 **40px** |
| 动态标签 | 有一 hidden Tab `10323:34354`（宽 113）示意后台新增标签 |

**表头** `10323:34356`（高 **24px**）：

| 列 | 宽 | 对齐 | 排序 |
|----|-----|------|------|
| 交易对 | 198px | 左，pl 24 | — |
| 最新价格 | 158px | 右 | Sort 图标 12×12 |
| 24h涨跌 | 158px | 右 | Sort 图标 12×12 |
| 24h最高 | 158px | 右 | — |
| 24h最低 | 158px | 右 | — |
| 走势图 | 171px | 右 | — |
| （交易） | 142px | 右 | 无表头文案 |

表头字：**12px Regular text-2**。

**列表行** `10323:34370`（高 **72px**，行内 padding 12px）：

| 元素 | 规格 |
|------|------|
| Logo | **28 × 28** 圆形 |
| 交易对 | **18px Medium** text-1 |
| 分类标签 | **10px** · 贵金属：`bg-y` + `sem-y` · 股票：同色 badge 结构（宽 ~26px） |
| 价格 / 高低 | **16px Medium** text-1 · 右对齐 |
| 涨跌幅 | **16px Medium** sem-g / sem-r |
| 走势 sparkline | **92 × 40** 区域 |
| 交易按钮 | **60 × 32** · 圆角 8 · 背景 hover-b2 · 文案「交易」14px Medium |

**分页** `10350:45468`：268×28 · 页码按钮 **28×28** · 当前页 **brand-1 底 + text-6** · 左右 Chevron · gap **12px**。

### 4.5 优势模块 `10323:35189`

| 项 | 规格 |
|----|------|
| 标题 | `为什么选择 FameEX TradFi？` · 40px Bold |
| 布局 | 3 列等分卡片，各 **376 × 262**，padding **40**，圆角 **20**，边框 divider-2 |
| 卡片 1 | 标题 `无需境外账户` 24px Medium · 说明 14px Regular text-3 |
| 卡片 2 | `USDT统一结算` + 共用余额说明 |
| 卡片 3 | `7X24 不间断交易` + 全天候说明 |
| 标题 ↔ 正文 | gap **12px** |
| 动效 | 无独立 keyframes；PRD「键入动效」**未在 Figma 体现** |

### 4.6 FAQ `10323:33699`

| 项 | 规格 |
|----|------|
| 标题 | `常见问题` · 40px Bold |
| 条目 | 4 条，各 **1200 × 78** · 背景 **cc-3** · 圆角 **16** · padding **24**（pl 24 pr 28） |
| 问题字 | **20px Medium** text-1 |
| 图标 | Chevron down **24 × 24** 右对齐 |
| 条目间距 | **24px** |
| 展开态 | **未提供** 展开 Frame；实现：单开 accordion，展开后 chevron 旋转 180° |
| 文案 | 见下表 |

| # | 问题（Figma 原文） |
|---|-------------------|
| 1 | FameEX TradFi 上可以交易哪些资产？ |
| 2 | FameEX TradFi 产品是真实股票吗？价格如何确定？ |
| 3 | 投资 FameEX TradFi 需要多少门槛？ |
| 4 | 稳定币在 FameEX TradFi 交易中有什么作用？ |

### 4.7 Footer `10323:33698`

复用站点通用 **footer** 组件实例（1440×529），TradFi 页无额外定制。

## 5. 交互状态

| 交互 | Figma 状态 | 实现建议 |
|------|------------|----------|
| Nav TradeFi hover / active | 未单独标注 | 复用 Header 导航 hover/active |
| Hero CTA hover | 2026-06-10 补充截图 | ghost 按钮 hover：`bg-brand-1` + `text-0` |
| Banner 卡片 hover | 未标注 | PRD 要求放大/反馈；可用 scale(1.02) + shadow |
| Banner 轮播 | 横排示意 | 按标签自动轮播，支持 touch/drag |
| Tab selected | 已标注（全部选中） | text-1 vs text-4 |
| 排序 | 表头 Sort 默认态 | 最新价 / 24h涨跌 三态互斥（默认/升/降） |
| 列表行 hover | 未标注 | 可选行背景 cc-3 或 divider-1 |
| FAQ 收起 | 已标注 | 默认全收起 |
| FAQ 展开 | **未提供** | 单开 + 答案区 padding 24 |
| H5 | **未提供** | 见 §6 |

## 6. H5 / 响应式

| 项 | 结论 |
|----|------|
| H5 画板 | **未提供**；D7 已确认按桌面规格响应式降级 |
| 建议断点 | 与项目一致：`<768px` 移动端 |
| Banner | 横向 scroll-snap，单卡宽约 230px |
| 资产列表 | 表格改卡片栈或横向 scroll；表头排序保留 |
| Hero | 标题缩小（建议 32–40px）、CTA 全宽或 min-width 160 |
| 优势三卡 | 纵向 stack，间距 16–24px |
| FAQ | 全宽，触摸区域 ≥ 44px 高 |

## 7. 素材

| 素材 | node / 来源 | 备注 |
|------|-------------|------|
| Nav hot 火焰 | `10350:40898` | 导出 SVG；约 11×14px |
| Banner / 列表 logo | API | 不从 Figma 固定 |
| Banner 走势线 | Vector 215 等 | 运行时由 mini chart 绘制，颜色跟涨跌 |
| 列表走势 | Group 2087324700 | 同上 |
| Hero 头图 | `10323:35383` hidden | D5 已确认本期不启用 |
| Footer | footer 实例 | 站点级 |

## 8. Figma ↔ PRD 差异清单（2026-06-10 已收敛）

已在 §2.2 列出 D1–D8。D1–D7 已按 `06-collaboration.md` §8 收敛；D8 为 PRD 0610 新增的合约交易下拉入口，当前整页 Figma 未覆盖该下拉状态，功能按 PRD，视觉复用现有合约交易下拉。

## 9. 实现检查清单

- [ ] 内容区 max-width **1200px**，大屏水平居中
- [ ] Token 走语义类，不写死 hex
- [ ] Banner 卡片 **230×248**、圆角 12、间距 32
- [ ] 资产表头排序仅 **最新价格 / 24h涨跌**
- [ ] 分类 tag：贵金属 **bg-y + sem-y**；股票结构一致
- [ ] FAQ **手风琴单开**
- [ ] 深浅色主题均验收
- [ ] H5 无稿部分已与产品确认降级方案

## 10. 像素级还原补充（get_design_context 精确值）

> **补充时间**：2026-06-10  
> **来源**：Figma MCP `get_design_context`（逐个原子组件读取）+ `get_screenshot`（区块截图，见 §11）。  
> **用途**：为 100% 还原提供逐元素精确 padding / gap / radius / 字号 / token。  
> **重要**：下方出现的 `var(--token, #xxxxxx)` 里的 hex 是 MCP 注入的**浅色 fallback**（见 §10.8），实现时一律用项目语义类，深色取值以 §3 表为准。

### 10.1 Hero `10357:71386`

```text
容器          flex-col · gap 40 · w 680
└ 文案块      flex-col · gap 24（主标题 ↔ 副标题）· h 183
   ├ 主标题   56px Bold · lh 1.2 · 两行
   │          "FameEX" / "加密赋能的 TradFi 交易"；"TradFi " 段 = brand-1，其余 = text-0(white)
   └ 副标题   18px Regular · lh 1.5 · text-2 · 文案「美股、外汇、贵金属、USDT统一结算」
CTA          w160 · h40 · border 1px brand-1 · rounded 8 · px16 py8 · flex center
             文案「立即交易」18px Medium · brand-1
文案块 ↔ CTA  gap 40
```

### 10.2 Banner 单卡 `10323:35215`

```text
卡片          border 1px divider-2 · rounded 12 · p 20 · flex-col · gap 12
├ 头部行
│  ├ logo     44 × 44（圆形裁切）
│  └ 信息列   flex-col · gap 4
│     ├ 名称  20px Medium · text-1
│     └ 分类  12px Medium · text-3（纯文字，Banner 内无彩色底）
└ 行情列      flex-col · gap 4
   ├ 价格     24px Bold · text-1
   ├ 涨跌幅   14px Medium · sem-g / sem-r
   ├ 占位     h 21（空白间隔）
   └ 走势     满宽 · h 54.27 · 涨绿跌红矢量线
```

### 10.3 资产列表行 `10323:34370`（行高 72）

```text
行底         rounded 8 矩形（行 hover / 选中背景层，宽随容器）
交易对列     pl12 pr8 py22 · gap12
   ├ logo    28 × 28（圆形）
   ├ 名称    18px Medium · text-1
   └ 分类    badge：bg-y · rounded 2 · px3 py0.5 · h16；文字 10px Regular · sem-y · lh1.6
             ⚠ 列表内**所有分类**（股票/贵金属/商品）均用同一套 bg-y + sem-y 黄色 badge
数值列       px8 py24 · 右对齐 · 16px Medium
   ├ 最新价格 / 24h最高 / 24h最低 = text-1
   └ 24h涨跌 = sem-g / sem-r
走势列       右对齐 · px8 py16 · sparkline 92 × 40
交易按钮列   w142 · 右对齐 · pl8 pr24 py20
   └ 按钮    bg-hover-b2 · rounded 8 · px16 py5.5 · 文案「交易」14px Medium
```

> **整表外框**：截图 `05-assets-table.png` 中 Tab + 表头 + 列表 + 分页被一层 **圆角 + divider 描边卡片**包裹；实现时给表格模块加外层 `rounded` + `border-divider`（圆角值实现时按 12/16 试齐，未在变量中单列）。

### 10.4 优势单卡 `10323:35192`

```text
卡片         border 1px divider-2 · rounded 20 · p 40
└ 内容列     flex-col · gap 12 · w 304
   ├ 标题    24px Medium · text-10
   └ 说明    14px Regular · text-3（3 行约 h71）
```

### 10.5 FAQ 条目 `10323:33702`

```text
条目         bg-cc-3 · rounded 16 · pl24 pr28 py24
└ 行         justify-between · w1148
   ├ 问题    20px Medium · text-1
   └ 图标    Chevron down 24 × 24（展开态旋转 180°）
```

### 10.6 分页 `10350:45468`

```text
容器         flex · gap 12 · 居中
页码按钮     size 28 · rounded 4 · px6 py3 · 14px Regular
   ├ 当前页  bg-brand-1 · text-6(white)
   └ 其他页  透明底 · text-1
上/下一页    size 28 · 透明底 · rounded 4 · Chevron 图标
```

### 10.7 顶部导航 `10323:33777`

高 64 · 背景 bg-2；TradeFi 入口（`10350:35412`）文案右侧贴 hot 火焰图标（`10350:40898`，约 11.2 × 14，brand 色）。落地页内导航 active / hover 复用站点 Header，不在本稿单独定义。

> PRD 0610 另有【合约交易】下拉新增 TradFi 入口要求；该下拉状态未在当前整页 Figma 节点中覆盖，详见 [05-ui-and-interaction.md §2.3](./05-ui-and-interaction.md#23-合约交易下拉-tradfi-入口prd-0610-验收项)。

### 10.8 深 / 浅色 token 对照（MCP fallback 仅供参考）

`get_design_context` 注入的 fallback 为**浅色模式**取值，可与 §3 的深色采样配合理解主题；**真实取值以项目 `globals.css` 的 `:root` / `.dark` 为准**，组件里只用语义类。

| 语义类 | 深色（§3 采样） | 浅色（MCP fallback） |
|--------|----------------|----------------------|
| `text-1` | `#ffffff` | `#241259` |
| `text-10` | `#ffffff` | `#2d2f39` |
| `cc-3` | `#1e2026` | `#f9f9fb` |
| `hover-b2` | `#38206a` | `#f5f0fe` |
| `bg-y` | `#4a3712` | `#fef8ec` |
| `divider-2` | `#ffffff1f` | `rgba(11,12,14,0.08)` |
| `brand-1` | `#7132f4` | `#7132f4` |
| `sem-g` / `sem-r` / `sem-y` | `#14b881` / `#eb4747` / `#f5b83d` | 同左 |

## 11. 区块参考截图索引

> 位置：`inbox/figma-shots/`（本地原始资料，随 docs_tdd 一起被 git 忽略）。实现每个区块时对照对应 PNG 做像素级核对。

| 文件 | 区块 | Figma node | 原始尺寸 |
|------|------|-----------|----------|
| `00-full-page.png` | 整页 | `10323:33697` | 1440 × 3561 |
| `01-top-nav.png` | 顶部导航 | `10323:33777` | 1440 × 64 |
| `02-hero.png` | Hero | `10357:71386` | 680 × 264 |
| `03-banner-carousel.png` | Banner 轮播 | `10323:35213` | 1440 × 248（裁切） |
| `04-banner-card.png` | 单张 Banner 卡 | `10323:35215` | 82 × 248 |
| `05-assets-table.png` | 可交易资产（整模块） | `10323:34338` | 1440 × 828 |
| `06-pagination.png` | 分页 | `10350:45468` | 268 × 28 |
| `07-advantages.png` | 优势三卡 | `10323:35189` | 1201 × 351 |
| `08-faq.png` | 常见问题 | `10323:33699` | 1200 × 472 |

> 截图 URL 为短时有效，已落地为本地 PNG；后续设计更新需重新 `get_screenshot` 覆盖。

## 12. 实现走查记录（2026-06-10）

> 来源：本地 dev server（`localhost:4000`，测试环境）+ 真实浏览器走查，分别在桌面 1440px 与移动 375px 视口与 §11 Figma 稿逐区块对照。历史实现截图已按公共规则清理；后续自测默认只保留报告，不保留图片。

| 区块 / 视口 | 备注 |
|------------|------|
| 整页 1440 | 已做整体纵向节奏对照 |
| Hero 1440 | ghost CTA + Figma 副标题已走查 |
| Banner 1440 | 纯文字分类、价格/涨跌/走势已走查 |
| 可交易资产 1440 | 分类 badge 已改为单行内联后复查 |
| 优势三卡 1440 | 文案已按 Figma 完整描述补全后复查 |
| FAQ 1440 | 收起态 + 单开展开态已走查 |
| 整页 375 | 响应式降级、无横向溢出已走查 |

**走查发现并已修复**：① 列表分类标签原为名称下方堆叠 → 改为名称右侧同行内联（对齐 Figma §10.3）；② 优势卡文案较设计稿简略 → 按 Figma §4.5 / 07-advantages 补全。

**环境说明**：当前 `inbox/public_info.json` 已包含正确 TradFi section：`id=1`，命中 17 个合约，覆盖 `NVDAUSDT`、股票、贵金属、商品。后续视觉走查应以这份样例或真实环境同结构数据为准；行数 > 8 时自动出现分页。
