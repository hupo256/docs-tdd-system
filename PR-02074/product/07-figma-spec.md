# 07 — Figma 设计规格

> **读取流程**：[figma-mcp-read-workflow.md](../../common/figma-mcp-read-workflow.md)  
> **Token 规则**：[ui-style-token-rules.md](../../common/ui-style-token-rules.md)（禁止为单页修改 `packages/config/tailwind-preset.js`）

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02074` |
| 读取时间 | 2026-07-25 |
| Figma | [「FameEX三期」 WEB](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=17067-17867&m=dev) |
| Figma fileKey | `KzvWxAYxqfgpoiYuKdxMAE` |
| 主画板 nodeId | `17067:17867` |
| 当前读取方式 | Figma 官方远程 MCP：`get_metadata` / `get_design_context` / `get_variable_defs` |
| MCP 账号 | `dubaifrontend@mail.fameex.info`；HQEX `Dev` seat |
| 当前视觉基线 | Figma 原子数据优先；搜索区交互与同宽布局以用户提供参考图为准，PRD 截图与 BitMart Predict 仅补充未单独出稿的交互 |
| 还原目标 | 按原子节点逐模块补齐规格并执行像素级复核 |

## 1. 读取状态与证据等级

- [x] 已确认 Figma 链接、fileKey 与主画板 nodeId。
- [x] 已配置 Figma 官方远程 MCP `https://mcp.figma.com/mcp` 并完成 OAuth。
- [x] `get_metadata`：主 Section `预测市场`，尺寸 `8328×5494`，已取得页面与子节点树。
- [x] `get_design_context`：已验证搜索输入 `17127:74365` 与联想层 `17127:74310` 的原子几何、样式、资源和截图。
- [x] `get_variable_defs`：已读取 35 个颜色、字体和阴影变量。
- [x] 已逐张读取 PRD 同步截图，并与 BitMart Predict 的布局和搜索 UX 对照。
- [x] 已盘点 Prediction 现有分类、事件卡片、搜索和体育模块，优先复用而非重写。

证据等级：Figma 原子数据 > 设计标注/导出图 > PRD 截图 > 参考产品 > 代码现有约定。主 Section 过大时 `get_design_context` 会返回稀疏结构，实施时按 metadata 中的子 nodeId 逐个读取，不以父节点值代替原子控件值。

## 2. 页面与模块索引

| 页面 / 模块 | Figma nodeId | 可确认结构 | 原子规格 |
|-------------|--------------|------------|----------|
| Prediction 设计集合 | `17067:17867` | Section `预测市场`，包含 Desktop/H5 页面及搜索状态 | `8328×5494` |
| 一级分类 Tab | 待 Dev Mode/MCP | Crypto、Politics、Sports、Finance；未单独出稿的 Tab 复用同一骨架 | Pending Dev Mode/MCP |
| 搜索输入 | `17127:74365` | 搜索图标、placeholder；实例尺寸为设计稿当前状态 | `172×40`、圆角 8 |
| 搜索联想层 | `17127:74310` | 5 条联想结果；底部“更多结果” | `418×390`、圆角 12 |
| 搜索结果页 | 待 Dev Mode/MCP | 面包屑、关键词标题、搜索框、纵向结果列表 | Pending Dev Mode/MCP |
| 分类侧栏 | 待 Dev Mode/MCP | 二/三级分类；当前选中项高亮 | Pending Dev Mode/MCP |
| 事件列表 | 待 Dev Mode/MCP | 复用既有 Prediction 事件卡；体育复用既有体育事件模块 | Pending Dev Mode/MCP |

## 3. 可确认布局规格

| 区域 | 布局与行为 | 实现约束 |
|------|------------|----------|
| 页面头部 | 一级分类横向排列，搜索框位于同一行右侧 | 小屏允许换行；不为单页新增全局 token |
| 页面主体 | 桌面端为左侧分类树 + 右侧内容区 | 左栏固定为窄列，内容区自适应；H5 改为纵向布局 |
| 分类内容 | 不同一级 Tab 复用相同页面壳、分类选择和列表容器 | 复用 `CategoryTabs`、`CategorySidebar`、`PredictionCategoryList` |
| 搜索联想 | 浮层贴合输入框；条目为图标、标题高亮、占比/方向；底部更多结果入口 | 防抖请求；最多 5 条；缺失图标不造假占位 |
| 更多结果 | 独立路由；白底纵向结果行，以轻分割组织信息 | 每页 50 条，触底加载；关键词写入 URL |
| 事件展示 | 单市场、多市场、体育事件沿用现有业务组件 | 复用 `EventTab`、`WorldCupCon` 等，不另造平行卡片体系 |

## 4. 控件几何与 Token 映射

| 控件 | W×H | cornerRadius | 间距 / 字号 / 色值 | preset / 组件 | 状态 |
|------|-----|--------------|--------------------|---------------|------|
| 一级分类 Tab | Pending | Pending | Pending | 现有语义 token | 待 Dev Mode/MCP |
| 搜索输入 | `172×40` | 8 | 左 12；图标 24；文本左 48；`CC-3 #f9f9fb`；`Text-4 #c2c5d6`；Regular/Subtitle 16 | 现有 `Input` / `SearchBox` | 已读 `17127:74365` |
| 搜索联想层 | `418×390` | 12 | 上 16、下 20；白底 `BG-2`；`Light/Depth-Z200` | `bg-1`、`shadow-z200` / `SearchPopup` | 已读 `17127:74310` |
| 联想结果行 | `386×68` | 0 | 图标 24、圆角 4；图文 gap 8；左右内容 gap 26；标题 Bold/H7；方向 Medium/Body-XXS | `SearchPopup` | 已读 `17127:74391` 等 5 行 |
| 搜索结果页 | `1440` 宽画板 | — | 标题与搜索框；结果列 `648` 宽 | `SearchResultsPage` | 已读 `17127:131710` |
| 搜索结果卡 | `648×116` | 16 | 内边距 14；内容行 68；图标 32 / 圆角 4；标题 Bold/H7 | `SearchResultCard` | 已读 `17138:132328` 等 |

### 4.1 搜索模块 Figma → preset 映射（`visualFidelity: standard`）

`PR-02074` 当前为标准视觉模式，按公共规则 §1.1 仅使用 preset 同值或相近映射，不保留固定像素 arbitrary class。

| Figma 节点 / 值 | 采用 class | 映射类型 | 理由 |
|-----------------|------------|----------|------|
| 搜索输入 `17127:74365`：宽 200（用户确认） | `sm:w-50` | 精确 | spacing `50 = 200px` |
| 搜索输入 `17127:74365`：高 40、圆角 8、左右 12 | `h-10 rounded-m px-3` | 精确 | preset 均有同值 |
| 联想层 `17127:74310`：宽 418、圆角 12 | `w-104 rounded-m` | 相近 | `w-104 = 416px`（差 2px）；8px 与 16px 等距，沿用紧凑浮层的 `rounded-m` |
| 联想层阴影 `Light/Depth-Z200` | `shadow-z200` | 直接用 | 现有语义阴影 token |
| 联想行：高 68、圆角 4、左右内容 gap 26 | `h-17 rounded gap-7` | 精确 / 相近 | `h-17 = 68px`、`rounded = 4px`；`gap-7 = 28px`（差 2px） |
| 联想底部入口：高 18 | `h-4` | 相近 | `h-4 = 16px`（差 2px），文字本身受字体 token 约束 |
| 结果列 `17127:131710`：宽 648 | `max-w-161` | 相近 | `max-w-161 = 644px`（差 4px） |
| 结果卡：高 116、圆角 16、内边距 14 | `h-30 rounded-lg p-3.5` | 相近 / 精确 | `h-30 = 120px`（差 4px）；`rounded-lg = 16px`、`p-3.5 = 14px` |
| 结果卡内容：高 68、图标 32 / 圆角 4 | `h-17 size-8 rounded` | 精确 | spacing 与圆角 token 均有同值 |
| 结果标题 / 概率：14 / 21 | `text-body-regular` / `text-h7` | 直接用 | 两个 fontSize token 均定义 `14px / 150%`（21px） |
| 分类侧栏项 | Pending | Pending | Pending | `CategorySidebar` | 待 Dev Mode/MCP |
| 搜索结果行 | Pending | Pending | Pending | `SearchResultCard` | 待 Dev Mode/MCP |

已确认变量摘要：`BG-2 #ffffff`、`CC-3 #f9f9fb`、`Text-1 #241259`、`Text-2 #5a5e72`、`Text-3 #8d91a5`、`Text-4 #c2c5d6`、`Text-10 #2d2f39`、`Brand-1 #7132f4`、`Divider-1 #0b0c0e0a`、`Divider-2 #0b0c0e14`、`Sem-G #14b881`、`Red #eb4747`。实现仍优先映射仓库现有语义 token，不为单页修改 preset。

`Light/Depth-Z200`：`0 4px 8px #0b0c0e14` + `0 0 1px #0b0c0e33`。

## 5. 内容与交互边界

| 字段 / 场景 | 展示规则 | 缺失处理 |
|-------------|----------|----------|
| 事件标题 | 联想层单行截断；搜索结果页按现有卡片规则展示；命中词使用品牌色高亮 | 必填缺失显示 `--`，不得生成假标题 |
| 分类标签 | 搜索结果展示事件所属一级/二级标签 | 可选缺失时不渲染 |
| 图标 | 有合法 URL 时展示 | 缺失时不塞默认业务图 |
| 占比 / 方向 | 右对齐展示事件当前方向信息 | 方向为空不渲染；数值按 mapper 规则处理 |
| 成交量 | 搜索结果页展示格式化成交量 | 缺失按契约和 mapper 的显式空值策略处理 |
| 联想条数 | 固定最多 5 条 | 无结果展示搜索空态 |
| 更多结果 | 点击进入 `/prediction/search?keyword=...` | 空关键词不发起搜索跳转 |
| 分页 | 每批 50 条，触底加载下一页 | 无下一页后停止请求 |

## 6. 响应式

| 场景 | 可确认差异 | 待确认项 |
|------|------------|----------|
| Desktop | 顶部 Tab 与搜索同行；主体左右分栏 | 精确宽度、间距、字体和圆角 |
| H5 | 顶部区域和主体改为纵向；内容宽度不溢出 | 是否存在独立 H5 Figma Frame 及精确规格 |

## 7. PRD / Figma / 参考产品结论

| # | 来源差异或缺口 | 当前结论 |
|---|----------------|----------|
| 1 | Figma 未逐一提供每个一级 Tab 的独立稿 | 相同模块复用；只替换分类数据和对应事件内容 |
| 2 | API 文档尚未输出 | 按真实 schema/mapper/UI 链路接 MSW 最小 mock，接口就绪后按 handler 切换 |
| 3 | 主 Section 一次读取只返回稀疏结构 | 根据 metadata 子 nodeId 逐模块读取；搜索输入和联想层已完成原子验证 |
| 4 | BitMart 是产品行为参考，不是 FameEX token 来源 | 可复用信息架构、Tab、布局、搜索 UX 和数据结构；视觉色值仍遵循 FameEX token |
| 5 | 用户提供的搜索区参考图比 Figma 当前实例更完整 | Desktop 搜索框使用 `400px`，联想层以输入框左右边界对齐；采用卡片式圆角与轻阴影、无分割线的紧凑结果行、左对齐「更多结果」。Figma 仍作为图标、字体、阴影与色值参考；颜色留待后续微调 |

## 8. G6 走查清单

- [ ] Desktop 主流程：分类切换、侧栏过滤、搜索联想、更多结果、触底加载。
- [ ] H5 核心模块无横向溢出。
- [ ] loading / empty / error / success 状态可验证。
- [ ] light / dark 使用现有语义 token，无硬编码业务色值。
- [ ] 未为单页修改 `tailwind-preset.js`。
- [ ] 继续按子 nodeId 补齐 Tab、侧栏、事件卡和结果页的原子几何、变量链与 L2 并排证据。
