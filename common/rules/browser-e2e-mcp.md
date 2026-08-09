# Browser / Playwright MCP 自测规范

> AI 主用。关联:[quality-checklist.md](./quality-checklist.md) §3.4、[development-rules.md](./development-rules.md)。**前置分工**:先读 [verification-division-of-labor.md](./verification-division-of-labor.md)。本规范适用于**确需交互验证**的场景;纯视觉/手感/响应式验收默认交人工,Agent 不逐步跑 MCP。章节号 §5 被外链引用,勿改编号。

## 1. 原则

UI/UX 自测用 **系统 Chrome + Chrome Playwright 扩展 + Cursor Playwright MCP**,不在 monorepo 内装浏览器自动化依赖。规则成熟前**只维护在 `apps/web/docs_tdd/`**（含 `common/` 与各项目 `agent/`）;Agent 入口见 [../AGENTS.md](../../AGENTS.md);不写入 `~/.cursor/rules/` 或仓库根 `AGENTS.md`。

## 2. 禁止

- 在 `package.json` 安装 `playwright`、`@playwright/test`、`playwright-core`、`puppeteer`、`puppeteer-core`
- 执行 `playwright install` / 下载 Chromium 到项目或 CI 缓存目录
- 编写 `import from 'playwright'` 的项目内 E2E 脚本并纳入常规开发流程
- 因 Playwright 安装卡住而长时间空等;应改用 Playwright MCP 或 Vitest integration test

## 3. 必须

| 层级 | 工具 | 用途 |
|------|------|------|
| API/Mock | Vitest + integration test | 全接口、全场景矩阵 |
| UI 交互/视觉 | **Playwright MCP**（`user-Playwright`） | 导航、点击、`browser_snapshot`、必要时临时截图 |
| 快速探索 | Browser MCP / cursor-ide-browser | Figma 对照、扩展不可用兜底 |

Playwright MCP 配置见 `~/.cursor/mcp.json`（`@playwright/mcp --extension`）。调用前读 `mcps/user-Playwright/tools/*.json` 确认参数。

## 4. 操作示例

```
# ✅ Playwright MCP（默认不截图）
browser_navigate → http://localhost:4000/zh-CN/campaign/PR-01685?mock=1&scenario=active
browser_snapshot → 确认 Hero / 任务卡文案与结构
browser_click    → 「立即参与」/「待领取」
browser_snapshot → 核对 CTA / 弹窗 / 状态变化

# ⚠️ 仅必要时临时截图（见 §5）
browser_take_screenshot → /tmp/playwright-<run-id>.png
# 验收结束立即删除；不要写入 docs_tdd/ 或提交到 git

# ❌ 项目内脚本
pnpm add -D playwright
node scripts/e2e.mjs
```

## 5. 交互副作用验证

凡 PRD/交互文档写了「**交互:点击 X 后 → Y**」的行为,测试步骤必须包含:

1. `browser_click` 触发目标元素。
2. 验证副作用 Y:URL 变化、页面跳转、弹窗消失、toast 出现、按钮状态变更——**缺一不可**。

只用 `browser_snapshot` 或文本包含检查目标元素「存在」,**不等于交互行为已验证**。

```text
# ❌ 只断言弹窗文案出现 — 没有测点击行为
bodyText.includes('我知道了')  →  pass ✗

# ✅ 必须点击并验证副作用
browser_click    → 「我知道了」按钮
browser_snapshot → URL 已变化 / 弹窗 DOM 已消失  →  pass ✓
```

常见副作用类型与验证方式:

| 副作用 | 验证方式 |
| ------ | -------- |
| 跳转/router.back() | `browser_snapshot` 确认 URL 或 pathname 已变化 |
| 弹窗关闭 | `browser_snapshot` 确认弹窗节点消失 |
| Toast 出现 | `browser_snapshot` 确认 toast 文案节点 |
| 按钮状态变更 | `browser_snapshot` 确认 disabled/文案变化 |
| 提交 → 列表刷新 | `browser_snapshot` 确认新数据出现 |

## 6. 验收证据与截图策略

自测结论以 **Markdown 文字报告**为主;**L2 视觉验收**的肉眼像素/手感/响应式判定默认**人工**过走查清单,**Agent** 负责 DOM 契约取值比对（class/computed style == token）与生成清单——分工以 [verification-division-of-labor.md](./verification-division-of-labor.md) 为准,不把截图存下来给负责人去对。

报告写入 `docs_tdd/prds/<PROJECT-ID>/evidence/<category>/<date>/README.md`,须含:
- URL、视口、主题、Mock 场景
- **Figma 节点 ID**、模块名、L2 走查清单逐项 pass/fail（还原度判定见 [component-reuse-and-visual-fidelity.md §3.0](./component-reuse-and-visual-fidelity.md),以清单全 pass 为准,非估算百分比）
- 操作步骤、结论与残留风险

### 截图策略

| 场景 | 做法 |
|------|------|
| L1 功能走查（能点、数据对） | 优先 `browser_snapshot`,**不必截图** |
| **L2 Figma 并排**（Hero、任务卡、弹窗、浮层等,见 [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md) §3） | Browser 与 Figma **同屏并排**;不便并排时可临时截图到 `/tmp/` **供 Agent 自己比对** |
| 验收结束 | **删除**所有 `/tmp/` 截图;报告只写文字,**不附图片路径、不存 evidence/** |
| PRD/设计输入 | `inbox/` 产品参考图可保留;与自测截图无关 |

**禁止:** 把自测截图持久保存到 `evidence/`/仓库/git（除非产品明确要求归档设计稿）;批量 fullPage 截图矩阵「证明跑过」;用截图代替文字报告里的节点 ID 与偏差说明。历史 `evidence/` 已有自测 PNG 则清理图片,README 保留文字结论。

## 7. Figma 并排验收（重要 UI 强制）

适用:**Hero、任务/活动卡片、排行榜、规则区、底部浮层、弹窗、Stepper、主 CTA** 等 `07-figma-spec` 有节点的模块（不限弹窗）。完整清单见 [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md) §3.2。

1. Playwright/Browser 打开目标页面与 Mock 场景（如 `?scenario=showcase`）。
2. 与 Figma Dev Mode **同屏并排**,按 L2 清单核对布局、圆角、字号、图标、间距、主题、H5。
3. **还原目标 ≥95%**（判定=[component-reuse §3.0](./component-reuse-and-visual-fidelity.md) 走查清单逐项 pass，`≥95%` 只是简写，非估算百分比；高保真项目尽量 100%）;未达标项写入报告,不得标 L2 通过。
4. 有必要则临时截图到 `/tmp/` 辅助 Agent 自己比对,**用完即删**。
5. 报告写节点 ID + 每项 pass/fail;**不得**仅写「snapshot 含某文案」即判视觉通过。

## 8. Mock 联调（Campaign 等项目）

- dev 默认可走真实接口;浏览器 Mock 加 `?mock=1`,场景加 `?scenario=active|claimable|...`
- 无需重启 dev 即可切换 Mock/场景

## 9. 迁移说明

本规范稳定并经 2+ 项目验证后,再评估是否同步到 Cursor 用户级 `~/.cursor/rules/`。迁移前以本文档为准。
