# 组件复用与 UI 视觉验收公共规则

> AI 主用。沉淀自 PR-01685 返工：**功能验收通过 ≠ 视觉完成**；**方案写「新建组件」≠ 可跳过复用盘点**。还原目标：重要模块与 Figma 尽量 100% 还原，判定标准（走查清单全 pass，非估算百分比）见 [§3.0](#30-还原度判定与高保真声明唯一定义源)。章节号被外链引用（§2.3/§3.0），勿改编号。

## 1. 两类典型失误

| 类型 | 表现 | 根因 |
|------|------|------|
| **视觉漏验收** | 弹窗能开、卡片能渲染，但圆角/间距/图标/字号与 Figma 不一致 | 只验 L1 交互与 DOM 文案，未与 Figma 并排；「能跑」提前标 `[x]`，JF* 视觉仍 `[ ]` |
| **未复用已有组件** | 手写渠道按钮行，全站已有 `ShareActionButtons` | 方案预设新建；文档写「跳过复用」；G4 前未跨 `apps/**` grep |

**优先级**：`common/` > 项目 `engineering/` > 项目 `agent/` 草稿。**项目文档不得写「跳过复用」等与公共规则冲突的决策。**

### 1.1 谁做 Figma 对照 / 截图给谁

分工以 [verification-division-of-labor.md](./verification-division-of-labor.md) 为准：L2 像素/手感/响应式肉眼判定默认**人工**；Agent 保证 DOM 契约（结构/class/computed style == token）并生成走查清单。

- **谁比对**：L2 肉眼并排默认人工过 §3.3 清单；Agent 做 DOM 契约取值比对 + 集成加载 console 检查。
- **交付物**：Agent 交 DOM 契约结果 + 走查清单（§3.3）；人工交勾选结果。报告落 `evidence/.../README.md`，写 Figma 节点 ID、模块名、pass/fail。
- **截图**：保存与清理策略消费 [browser-e2e-mcp.md §6](./browser-e2e-mcp.md)，本文件只定义视觉判定。
- **负责人**：直接开 dev URL 与 Figma 并排过清单，不依赖 Agent 留图。

## 2. 组件复用（硬性流程）

### 2.1 G4 编码前：复用盘点（没有表不得写 UI）

在 `product/02-technical-design.md` 维护复用盘点表，至少含列：`待实现 UI/能力 | 搜索关键词(必须实际 grep) | 候选实现 | 结论 | 不复用原因(仅新建填)`。示例：分享渠道按钮行 → grep `ShareActionButtons`/`ShareModal`/`CircleShareAction` → `ShareActionButtons.tsx` → 直接复用 + `hideSave`。

**新增下列任一类型前必须先完成上表一行**，否则不得编码：Modal/弹窗/底部浮层；分享渠道行/海报保存/复制链接；分页/空态表格/状态 CTA；与现有业务域同模式的任务卡/排行榜/步骤条。

### 2.2 强制搜索范围

1. `apps/web/src/components/`、`packages/ui/`
2. **跨业务 `apps/web/src/apps/**`**（不止当前 feature）
3. `packages/icon`、`packages/utils`
4. `docs_tdd/common/` 与本项目 `02-technical-design.md` 复用候选

### 2.3 已知跨业务 UI（随发现增补）

| 能力 | 推荐复用 | 路径 |
|------|----------|------|
| 分享弹窗底部渠道行（圆形 + 品牌 SVG） | `ShareActionButtons` | `apps/web/src/apps/Futures/components/FuturesOrders/components/ShareSocial/ShareActionButtons.tsx` |
| 分享弹窗整体（含海报） | `PredictionShareMan`、`RewardsShareModal`、合约 `ShareModal` | 各业务 `apps/**/Share*.tsx` |
| 分页 | 项目 `Pagination` | `apps/web/src/components/Pagination` |
| 通用 Modal 壳 | `Modal` | `apps/web/src/components/Modal` |

差异仅在**上半内容区**（标题/链接框/海报）时：**禁止重写渠道行**，用 props（`hideSave`/`shareUrl`/`copyLabel`）扩展共享组件。

### 2.4 新建组件准入条件

同时满足才可新建：① 盘点表已列 ≥2 候选并写明为何不适用；② 不是「少一按钮/换一行文案」级差异；③ 不复用原因不是「方案已写新文件名」或「赶进度」。

**候选不足 2 的合法情形**：跨 `apps/**` grep 后全站仅 0-1 同类实现（新类型 UI）。此时条件 ① 改为盘点表写明「已 grep `<关键词>`，全站候选 N 个(N<2)，确认无更多可复用项」+ 实际 grep 命令与命中数——用「搜索已穷尽」证据替代「≥2 候选」，不是跳过盘点。空表/未写 grep 关键词 = 未盘点，不得新建。

## 3. UI 视觉验收（与功能验收拆分）

### 3.0 「还原度」判定与「高保真」声明（唯一定义源）

其他文件（[ui-style-token-rules.md §4.1](./ui-style-token-rules.md)、[figma-mcp-read-workflow.md §3.1](./figma-mcp-read-workflow.md)、[quality-checklist.md §3.5](./quality-checklist.md)）一律引用本节，不各自定义。

**还原度判定 = §3.3 走查清单逐项 pass，非估算百分比**：

- 「≥95% 还原」= §3.3 的 7 类必查项全部 pass 且无未达标 L2 偏差遗留。
- 任一项 fail → L2 未通过，列入残留偏差，不允许用「目测大概 95%」蒙混标 `[x]`。
- 百分比仅作汇报粗描述，不作判定依据；判定依据永远是清单勾选。
- 谁跑：Agent 保证 DOM 契约正确并生成清单；肉眼像素/手感/响应式默认人工过清单（见 [verification-division-of-labor.md](./verification-division-of-labor.md)）。

**高保真声明 = README 元信息 `visualFidelity`（唯一布尔来源）**：

- `README.md` 顶部元信息表写 `| visualFidelity | standard \| high |`。
- `high` = 允许 arbitrary value 像素级还原（见 [ui-style-token-rules.md §4.1](./ui-style-token-rules.md)）；缺省/未写 = `standard`，走「相近 token」。
- 其他文档判定是否高保真统一读此字段，不循环引用。

### 3.1 双层完成标准

| 层级 | 含义 | 何时可标 `[x]` |
|------|------|-------------------|
| **L1 功能** | 能开、能点、数据正确、跳转/埋点正确 | 仅「逻辑通」，**不能**标视觉/JF* 完成 |
| **L2 视觉** | 与 Figma 节点布局/间距/圆角/字号/颜色/图标/主题/H5 一致；模块还原度 ≥95% | `07-figma-spec` 节点 + Browser/Figma 并排通过后 |

**禁止**用 L1 结果给 L2/JF* 打勾。

> JF\* = 项目 `04-frontend-tasks.md` 的「95% UI 还原专项」任务编号（JF1/JF2…），属 L2 视觉验收项，不可由 L1 逻辑通过代勾。

### 3.2 L2 适用范围（不止弹窗）

凡 `07-figma-spec.md` 有节点映射、或 `04-frontend-tasks.md` 标 **JF\*/Figma** 的模块，G6 必须做 Figma 并排 L2：页面级（Hero/头图、整页浅深帧、390px H5 首屏）；区块级（子活动标题、活动规则、底部浮层 CTA）；卡片/列表（单一/组合/阶梯/进阶任务卡、排行榜表格分页、空态）；控件（主 CTA、状态按钮、进度条、Stepper、分页器）；弹窗/浮层（分享、受限、确认框、BottomSheet）。

**可只做 L1 的例外**（须报告写明原因）：纯文案改动、仅改接口字段且 UI 结构未动、后台配置驱动的动态文案。

### 3.3 L2 必查项（逐项勾选，写入报告文字，默认不持久截图）

- [ ] **布局**：宽高、内外边距、对齐、栅格/1200 内容区与稿一致
- [ ] **圆角/描边/阴影/层级** 与稿一致
- [ ] **字体**：字号/字重/行高/颜色 token/ellipsis/换行
- [ ] **图标/插图**：形状/尺寸/品牌色；禁止错用 icon（如 `close` 作 X）
- [ ] **状态**：可用/禁用、进行中/已结束、空态/有数据 与稿或 PRD 一致
- [ ] **主题**：dark/light（若随主题变化）
- [ ] **390px H5**：无横向溢出/遮挡，CTA/浮层不重叠

`07-figma-spec.md` 须为图标级控件写清映射（§4），不能只有「48×48、gap 7px」。

### 3.4 G6 自测：Figma 并排（重要 UI 强制）

对 §3.2 模块：按 [browser-e2e-mcp.md](./browser-e2e-mcp.md) 打开目标 URL/Mock 场景，与 Figma Dev Mode 同屏并排按 §3.3 勾选；报告字段消费 [execution-evidence.md §5](./execution-evidence.md)。未 pass 项列残留偏差并保持 L2 未完成。

### 3.5 与自动化测试的分工

| 测什么 | 工具 | 不能替代 |
|--------|------|--------------|
| 接口、mapper、场景矩阵 | Vitest integration | 间距/圆角/视觉层级 |
| 文案存在、能否点击 | `browser_snapshot` | 与 Figma 并排 L2 |
| 结构回归护栏 | 单测断言关键 class | ≥95% 视觉还原 |

## 4. Figma 规格：图标与控件映射（强制落文档）

`product/07-figma-spec.md` 中含图标按钮行/社交渠道/状态按钮的模块，除尺寸间距外须增：`控件 | Figma 节点 | 形状/尺寸 | 代码实现 | 禁止`。示例：复制=圆形 48×48 `ShareActionButtons`+`LinkIcon`（禁随意 `fx--copy`）；Telegram=圆形+品牌色 `TelegramIcon` SVG（禁单色 plane）；WhatsApp=圆形+`#25D366` `WhatsAppIcon` SVG（禁 `fx--share`/外链图标）；X=圆形+X 字形 `XIcon` SVG（禁 `fx--close`）。

## 5. 门禁与 Review 勾选项

**G4（编码前）**：

- [ ] `02-technical-design.md` 复用盘点表已填，含跨业务 `apps/**` 搜索记录
- [ ] 弹窗/分享类 UI 已对照 §2.3 已知组件表
- [ ] 项目文档无「跳过复用」等与 `common/` 冲突表述

**G6（交付前）**：

- [ ] §3.2 重要模块 L1+L2 分别结论；模块还原度 ≥95% 或列未达标项
- [ ] `07-figma-spec` 已更新（含图标映射）
- [ ] 自测报告含 Figma 节点 ID、§3.3 勾选结果；临时截图已删

## 6. Agent 执行摘要

**写 UI 前**：grep 复用候选 → 填盘点表 → 读 `07-figma-spec` 节点。

**G6 自测**：① 开 showcase/目标 scenario URL（桌面 + 390px + dark/light 按需）；② 对 Hero/任务卡/排行榜/规则区/浮层/弹窗与 Figma 并排做 L2；③ 必要则 `/tmp/` 截图自比，比完删；④ `evidence/README`：节点 ID + 模块 pass/fail + 还原度 ≥95% 或偏差清单。
