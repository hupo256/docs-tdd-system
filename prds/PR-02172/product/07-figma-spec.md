<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# 07 — Figma 设计规格

> **模板**：`templates/07-figma-spec-template.md`  
> **读取流程**：[figma-mcp-read-workflow.md](../../../common/rules/figma-mcp-read-workflow.md)  
> **Token 规则**：[ui-style-token-rules.md](../../../common/rules/ui-style-token-rules.md)（**禁止为单页改 `packages/config/tailwind-preset.js`**）

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02172` |
| 读取时间 | 2026-08-03 |
| 读取方式 | Figma MCP：`get_metadata` / `get_design_context`（**原子节点**）/ `get_variable_defs` |
| Figma fileKey | 待补 |
| 主画板 nodeId | 待补 |
| 还原目标 | 默认 ≥95%；高保真例外见 `engineering/development-rules.md` |

---

## 1. G1 读取 Checklist（Agent 必勾选）

- [ ] 已从 PRD / 协作记录确认 Figma 链接与主画板
- [ ] `get_metadata` 已列出模块与子 **nodeId**
- [ ] 每个 **按钮 / 图标容器 / 卡片 / 弹窗** 已单独 `get_design_context`
- [ ] §3 **控件几何表** 已填（含 **cornerRadius**、**preset class**）
- [ ] §4 **Figma → preset 映射表** 已填（平替 / 相近值及理由）
- [ ] `get_variable_defs` 颜色已映射语义 token（`bg-*` / `text-*` / `border-*`）
- [ ] **文本字段边界约束**（标题/副标题/说明的最大字符、超出截断省略号、空态、可不配置/默认值）已从 **PRD 或 `05-ui-and-interaction.md` 展示规则列**补录进 §7——**Figma 规格通常只有字号/行高、不含字符上限，不得因 Figma 无此信息而遗漏**（PR-01685 Hero 32/60 字符省略号漏做根因）
- [ ] **复用盘点**：同类 UI 已 grep `apps/**`（Modal、分享、表格、分页等）
- [ ] PRD 与 Figma 差异已写入 `06-collaboration.md`

---

## 2. 链接与节点索引

```text
https://www.figma.com/design/{fileKey}/...?node-id={nodeId}&m=dev
```

将 `{nodeId}` 中的 `:` 替换为 `-`。

| 模块 | nodeId | 尺寸 (W×H) | 备注 |
|------|--------|------------|------|
| 整页 / 主 Frame | 待补 | 待补 | |
| （按模块追加行） | | | |

---

## 3. 控件几何表（必填）

> 每个可点击 / 可辨识控件一行。**禁止只写宽高。**

| 模块 | nodeId | W×H | cornerRadius | 形状 | Figma 值 | **preset class** | 描边 / 填充 | 代码落点 |
|------|--------|-----|--------------|------|----------|------------------|-------------|----------|
| 示例：分享渠道图标 | `9336:133830` | 48×48 | 24 | 圆形 | gap 7px | `size-12 rounded-full gap-1.5 border-text-5` | `border-text-5` | `ShareActionButtons` |
| 待补 | | | | | | | | |

**形状判定**：`cornerRadius ≥ min(W,H)/2` → 圆形 → `rounded-full`。

**间距 / 尺寸**：优先查 `packages/config/tailwind-preset.js` 的 `spacing` 表（如 7px→`gap-1.5`，48px→`size-12` / `w-12`）。

---

## 4. Figma → Tailwind preset 映射表

> 实现顺序见 [ui-style-token-rules.md](../../../common/rules/ui-style-token-rules.md) §1：  
> **① preset 已有 class → ② 同值不同名平替 → ③ 最相近 preset → ④ 高保真 arbitrary（仅项目声明时）**

| Figma / MCP 输出 | 像素值 | preset class（采用） | 映射类型 | 备注 |
|------------------|--------|----------------------|----------|------|
| `rounded-4` | 16px | `rounded-lg` | 平替 | preset 无 `rounded-4` |
| `rounded-3` | 12px | `rounded-m` 或 `rounded-lg` | 相近 | 距 8px / 16px 取更近；**不改 preset** |
| `gap` 7px | 7px | `gap-1.5`（6px）或 `gap-2`（8px） | 相近 | 差 ≤2px 用相近 spacing |
| `w` 400px | 400px | `w-100` | 精确 | spacing 表有 `100: 400px` |
| 待补 | | | | |

**禁止**：为单页在 `tailwind-preset.js` 新增键；未声明高保真时禁止 `rounded-[12px]`、`w-[400px]` 等 arbitrary。

---

## 4.1 Design Token 对齐链

> 需要做到 Figma UI 稿高还原时，每个自定义颜色 / 字号 / 阴影 token 都必须能追踪完整链路。来源与规则见 [ui-style-token-rules.md](../../../common/rules/ui-style-token-rules.md) §1.5。

链路格式：

```text
Figma 变量 -> CSS 源变量 -> Tailwind token -> Tailwind class
```

颜色若需要给设计复核，同时记录 Figma 兼容 `rgba(...)`：

```text
Figma 变量 -> Figma rgba -> CSS 源变量 -> Tailwind token -> Tailwind class
```

| Figma 变量 | Figma rgba / 数值 | CSS 源变量 | Tailwind token | 示例 class | 用途 | 复核状态 |
|------------|-------------------|------------|----------------|------------|------|----------|
| `BG-1` | 待补 | `--fx-bg-1` | `--color-bg1` | `bg-bg1` / `text-bg1` / `border-bg1` | 页面底 / 待补 | 待确认 |
| `Text-1` | 待补 | `--fx-text-1` | `--color-t1` | `text-t1` / `bg-t1` / `border-t1` | 主文本 / 待补 | 待确认 |
| 待补 | | | | | | |

缺口处理：

- Figma 变量存在但代码 token 不存在：写入 `06-collaboration.md` 待 UI/前端确认，不直接改全局 token。
- 代码 token 存在但 Figma 变量不存在：标为“代码遗留 / 项目约定”，不能反向宣称为 Figma token。
- Figma 面板只有裸值、没有变量：优先匹配 Tailwind 默认 class 或现有 preset；不要把裸值提升为项目 token。
- 多个 token 当前值相同：不合并，保持语义身份，等待设计确认是否真的同义。

---

## 5. 颜色 / 字体 token

| Figma 变量 | 浅色 | 深色 | preset class | 用途 |
|------------|------|------|--------------|------|
| `--BG-1` | 待补 | 待补 | `bg-1` | 页面底 |
| 待补 | | | | |

字号优先 `fontSize` preset：`h1`–`h7`、`body-regular`、`body-s` 等（见 preset §`fontSize`）。

---

## 6. 图标与品牌资源映射

| 控件 | nodeId | 图标 / 资源 | 禁止 |
|------|--------|-------------|------|
| 待补 | | 品牌 SVG / 组件名 | 无关 `icon-[fx--*]` |

---

## 7. 模块规格（按页面结构分节）

### 7.1 `<模块名>` — `nodeId`

| 项 | Figma | preset / 组件 |
|----|-------|---------------|
| 布局 | 待补 | 待补 |
| 间距 | 待补 | 待补 |
| 圆角 | 待补 | 待补 |
| 文本约束 | 最大字符 / 截断省略号 / 空态 / 可不配置（**源自 PRD 或 05-ui 展示规则列,非 Figma**） | `truncateWithEllipsis` / `line-clamp-*` / 条件渲染 |

（为每个重要模块复制 §7.1 小节）

---

## 8. 响应式 / H5

| 断点 | nodeId | 与桌面差异 | preset 调整 |
|------|--------|------------|-------------|
| 390px | 待补 / 无独立 Frame | 待补 | `w-full md:w-auto` 等 |

---

## 9. PRD / Figma 差异

| # | Figma | PRD | 结论 |
|---|-------|-----|------|
| 待补 | | | 记入 `06-collaboration.md` |

---

## 10. 像素级还原附录（可选，复杂模块）

> 从 `get_design_context` 粘贴原子节点摘录，供 G6 L2 并排对照。

### 10.1 `<控件名>` — `nodeId`

```text
（MCP 原始输出或关键 class 摘录）
```

---

## 11. 走查清单（G6）

- [ ] 桌面主画板 L2 并排 ≥95%
- [ ] 390px H5 核心模块无横向溢出
- [ ] dark / light 各一遍
- [ ] §3 几何表每一行已在实现中对齐
- [ ] 未为单页修改 `tailwind-preset.js`
