# Figma MCP 读取与参数落盘规范

> **通用读取动作已落 skill** `figma-read`（读原子节点/cornerRadius 必读/圆形判定/读不到降级）——写代码时按需触发。本文件保留 **fameex 落盘流程**（`07-figma-spec` 几何表、G1/G4/G6 门禁勾选），是 skill 的 L3 项目侧落地，二者互补不重复。
>
> AI 主用:防「读了 Figma 仍漏 `rounded-full`/描边/品牌色」。用 Cursor Figma MCP（远程 Dev Mode）,不装补丁 exe,补读取流程+落盘字段+验收对照。章节号 §3.1 被外链引用,勿改编号。

## 1. 为什么 MCP 读了还会漏 `rounded-full`？

以 PR-01685 分享渠道按钮为例,原因常不是没开 MCP,而是:

| 原因 | 说明 |
|------|------|
| **只读父 Frame** | `9336:133821` 整弹窗 `cornerRadius:12`,误套到内部 48×48 图标按钮 → 写成 `rounded-m`(8px) |
| **规格只写宽高** | `07-figma-spec` 写「图标 48×48」,**没写** `cornerRadius:24`/`rounded-full` |
| **惯例代替实测** | 用「圆角优先 `rounded-m`/`rounded-lg`」近似 token 代替读子节点 |
| **未对照已有代码** | 全站 `ShareActionButtons` 已 `rounded-full`,仍手写 `ShareChannel` |
| **L1 通过即收工** | snapshot 有「Telegram」四字,未 L2 核对形状 |

**结论**:MCP 读**原子节点**;规格落**几何字段**;实现前 **grep 复用**;G6 **Figma 并排 L2**。

## 2. 推荐工具链（保持 Figma MCP,补强用法）

### 2.1 主路径:Figma 远程 MCP（Dev Mode）

G0–G1 对每个模块:

| 步骤 | MCP 调用 | 用途 |
|------|----------|------|
| 1 | `get_metadata`(nodeId) | 子节点树、尺寸、**子 nodeId 列表** |
| 2 | **`get_design_context`（每个原子控件单独调）** | 单按钮/卡片/图标容器的 className、padding、**圆角**、描边 |
| 3 | `get_variable_defs` | 颜色/间距 token 与项目 Tailwind 映射 |
| 4 | `get_screenshot`（可选） | L2 并排辅助,**临时**用完删 |

**不要**只对整页 Frame 调一次 `get_design_context` 就写完全部规格;**要**对交互控件**逐个 nodeId** 再调（PR-01973 `07-figma-spec.md` §10 做法）。

### 2.2 辅助:Figma Plugin `use_figma`（可选）

远程 MCP 对某节点返回模糊、或需批量导出 `cornerRadius` 时:用 Cursor **plugin-figma-figma** 的 `use_figma` 读 `node.cornerRadius`/`width`/`height`/`strokes`;适用于变量绑定复杂或需脚本遍历子节点。

### 2.3 不推荐

| 做法 | 原因 |
|------|------|
| 只看 PRD 截图 OCR | 无 cornerRadius |
| 只读父级 MCP 输出 | 子按钮圆角被父级 12px 误导 |
| 凭经验写 `rounded-m` | 与 50% 圆角图标按钮冲突 |
| 实现后再补 `07-figma-spec` | 先码后补文档,易漏字段 |

## 3. 强制落盘:`07-figma-spec` 控件几何表

每个**按钮、图标容器、卡片、弹窗**在 `product/07-figma-spec.md` 除文案外必须有一张**几何行**（MCP 粘贴后整理）:

| 字段 | 示例 | 必填 |
|------|------|------|
| `nodeId` | `9336:133830` | ✅ |
| `width` × `height` | 48 × 48 | ✅ |
| **`cornerRadius`** | 24（或 MCP 原始值） | ✅ |
| **形状判定** | `cornerRadius ≥ min(w,h)/2` → **圆形** | ✅ |
| **Tailwind 圆角** | `rounded-full` 或 preset：`rounded-m`/`rounded-lg` 等 | ✅ |
| **preset 映射** | 平替/相近及理由（见 [ui-style-token-rules.md](./ui-style-token-rules.md) §1） | ✅ |
| `border`/`stroke` | 1px `#444756` → `border-text-5` | 有则填 |
| `fill`/背景 | token 名 | 有则填 |
| **代码落点** | `ShareActionButtons`/组件名 | ✅ |

### 3.1 cornerRadius → preset 映射规则

**先读原子节点几何,再查 preset**（`packages/config/tailwind-preset.js`）。**禁止为单页改 preset。** 完整 `rounded-*` 像素映射表与圆形判定（`cornerRadius ≥ min(w,h)/2`）见 [ui-style-token-rules.md](./ui-style-token-rules.md) §1.2;arbitrary 硬编码值（`w-[700px]`/`rounded-[16px]`,非高保真项目禁用）见 [ui-style-token-rules.md](./ui-style-token-rules.md) §4。

无精确键时:
- **默认项目**:用**最相近** preset,映射写入 `07-figma-spec` §4。
- **高保真项目**（`README.md` 元信息 `visualFidelity: high`,见 [component-reuse-and-visual-fidelity.md §3.0](./component-reuse-and-visual-fidelity.md)）:可用 `rounded-[12px]` 等 arbitrary,**仍不改 preset**。

**禁止**规格只有 `48×48` 时让 Agent 自猜圆角;**禁止**把父 Frame 的 12px 套到子圆形按钮。

### 3.1.1 MCP 读不到几何时的降级路径（不许卡死,也不许瞎猜）

`get_design_context` 报错、节点无 `cornerRadius`/尺寸字段、或 MCP 不可用时按序降级,**每步都在 `07-figma-spec` 标来源**:

1. 换 `get_metadata` + 辅助工具（`use_figma`/Figma 插件）重取;
2. 仍拿不到 → 从**同稿同类控件**已确认几何**类比**,几何表该行标 `来源: 类比自 <nodeId>`;
3. 类比也无依据 → 该控件几何标 `待确认`,写 `06-collaboration.md`,启用 Lark 发「阻塞中」@ 设计;**用最相近 preset 先占位实现**,不 block 其它模块;
4. **禁止**把猜测值当确认值写进几何表（不标来源即视为确认值）。

判据:**读不到就降级 + 标来源 + 记待确认,绝不静默猜数当真值,也绝不整页停下干等。**

### 3.2 图标级控件额外字段

| 字段 | 说明 |
|------|------|
| 图标类型 | SVG 组件名/品牌资源,**禁止**用无关 `icon-[fx--*]` |
| 标签文案 | 「复制」vs「复制链接」 |

## 4. G1 读取 Checklist（Agent 必做）

对本期每个 Figma 模块:

- [ ] `get_metadata` 列出所有子 nodeId
- [ ] 每个**可点击控件**单独 `get_design_context`
- [ ] 几何表写入 `07-figma-spec`（含 **cornerRadius + preset class**）
- [ ] **Figma → preset 映射表**已填（平替/相近,未改 `tailwind-preset.js`）
- [ ] `get_variable_defs` 颜色已映射语义 token
- [ ] **复用盘点**:同类 UI grep `apps/**`（如 `ShareActionButtons`）
- [ ] 复杂模块增加 **§像素级还原**附录（原子 MCP 摘录）

## 5. G4 编码前:规格 → 代码对照

实现某控件前,在 PR 或任务备注写一行:

```text
Figma 9336:133830 → 48×48, cornerRadius 24 → rounded-full, border-text-5 → ShareActionButtons
```

代码 class 与几何表不一致 → **必须先改文档或改代码并说明**,不能静默偏离。

## 6. G6:L2 验收防漏

并排核对**必须看形状**,不能只看文案:

- [ ] 圆是圆（`rounded-full`）还是方（`rounded-m`）
- [ ] 描边粗细与颜色
- [ ] 图标是否品牌 SVG

可选:Vitest 对关键容器断言 `rounded-full` 存在、禁 `fx--close` 出现在分享渠道（见 [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md)）。

## 7. 与现有文档关系

| 文档 | 关系 |
|------|------|
| [ui-style-token-rules.md](./ui-style-token-rules.md) | token / 高保真 arbitrary value |
| [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md) | L2 并排、≥95% 还原 |
| 本文件 | MCP 怎么读、参数怎么落盘 |
| `<PROJECT>/product/07-figma-spec.md` | 项目几何表与 node 索引 |
| [templates/07-figma-spec-template.md](../../templates/07-figma-spec-template.md) | 新项目 G1 复制模板 |

## 8. 快速参考:分享渠道按钮（教训）

| 项 | 错误 | 正确 |
|----|------|------|
| 读法 | 只读弹窗 Frame `9336:133821` | 读每个渠道 icon 子节点 |
| 规格 | 「48×48」 | 「48×48,cornerRadius 24,**rounded-full**」 |
| 实现 | 手写 `ShareChannel` + `rounded-m` | 复用 `ShareActionButtons` |
| 验收 | snapshot 有 Telegram 文案 | L2 并排看圆形与品牌色 |
