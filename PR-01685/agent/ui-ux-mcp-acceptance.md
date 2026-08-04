# PR-01685 UI/UX 验收指南（Browser MCP + Playwright MCP）

> **约定**：Playwright **不安装到 monorepo**（不进 `package.json`）。  
> UI/UX 验收在 Cursor 内通过 **两个 MCP 配合**完成，本机 `~/.cursor/mcp.json` 已配置：
> - `Browser` → `@browsermcp/mcp`
> - `Playwright` → `@playwright/mcp`（`--extension --caps vision,devtools`）

## 1. 两个 MCP 的分工

| 能力 | Browser MCP | Playwright MCP | 说明 |
|------|-------------|----------------|------|
| 打开页面 / 点击 / 输入 | ✅ 主用 | ✅ 可替代 | 交互链路两边都能做 |
| **视口切换**（1440 / 390） | ❌ | ✅ `browser_resize` | H5 / 桌面 UI 验收必需 |
| **整页截图**（fullPage） | 部分 | ✅ `browser_take_screenshot` + `fullPage: true` | 归档到 `evidence/ui-ux/` |
| **布局度量**（横向溢出、锚点是否在视口） | 弱 | ✅ `browser_evaluate` | UI/UX 量化验收 |
| 控制台 / hydration 问题 | ✅ `browser_get_console_logs` | ✅ `browser_console_messages` | 记录 P1/P2 风险 |
| 网络请求 | ❌ | ✅ `browser_network_requests` | 真实接口联调抽检 |
| Trace / 录屏 | ❌ | ✅ `browser_start_tracing` / `browser_start_video` | 复杂交互复现 |
| 与 Figma 并排肉眼对照 | ✅ 侧栏打开 | 可选 | Browser 更适合人工视觉比对 |

**结论**：  
- **Playwright MCP** 负责 UI/UX **量化验收**（视口、整页截图、溢出检测、控制台）。  
- **Browser MCP** 负责 **快速探索**、与 Figma 并排对照、Playwright 扩展未连接时的兜底交互。

Playwright MCP 使用 `--extension` 模式时，需确保浏览器已安装 Playwright MCP 扩展且已连接（Cursor MCP 面板显示 Playwright 为绿色）。

## 2. 前置条件

```bash
# worktree 根目录；scenario 矩阵验收建议 Mock
NEXT_PUBLIC_CAMPAIGN_USE_MOCK=true pnpm --filter @fameex/web dev
```

| 项 | 值 |
|----|-----|
| 本地服务 | `http://localhost:4000` |
| 活动页 | `/zh-CN/campaign/PR-01685` |
| Mock 场景 | `?scenario=active\|not-started\|ended\|unjoined\|claimable\|restricted\|empty-ranking` |
| 证据目录 | `docs_tdd/PR-01685/evidence/ui-ux/<YYYY-MM-DD>/` |
| Figma 对照 | 浅色 `9517:137713`、深色 `9364:134676`、组件 `3068:7` |

## 3. Playwright MCP 标准流程（UI/UX 主路径）

对应 `04-frontend-tasks` **K1–K4、K12**。

1. `browser_navigate` → 目标 URL  
2. `browser_resize` → `{ width: 1440, height: 1200 }` 或 `{ width: 390, height: 844 }`  
3. 等待首屏关键文案（如「FameEX 三期交易挑战赛」）  
4. `browser_take_screenshot` → `fullPage: true`，`filename` 写入 `evidence/ui-ux/<date>/desktop-active.png`  
5. `browser_evaluate` → 横向溢出检测：

```js
() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
})
```

6. `browser_console_messages` → `level: "warning"`，记录 hydration / a11y 警告  
7. 深浅色：切换站点主题后重复 4–6（K2）  
8. 7 个 scenario × 2 视口 → 截图矩阵（K3）

### 3.1 场景 URL 矩阵

| scenario | URL |
|----------|-----|
| active | `http://localhost:4000/zh-CN/campaign/PR-01685?scenario=active` |
| not-started | `?scenario=not-started` |
| ended | `?scenario=ended` |
| unjoined | `?scenario=unjoined` |
| claimable | `?scenario=claimable` |
| restricted | `?scenario=restricted` |
| empty-ranking | `?scenario=empty-ranking` |

## 4. Playwright MCP 交互验收（K5–K7）

在 **390×844** 视口下执行：

| ID | 操作 | 预期 | Playwright 工具 |
|----|------|------|-----------------|
| K5-1 | 点「立即参与」（未登录） | URL 含 `/login` 且 `from=/campaign/PR-01685` | `browser_click` |
| K5-2 | 打开 `restricted` | 文案含「仅限指定用户参与」「我知道了」 | `browser_snapshot` + 截图 |
| K6-1 | `claimable` 点「待领取」 | toast「领取请求已提交」或「已领取」 | `browser_click` + snapshot |
| K6-2 | `unjoined` 点「去完成」 | toast「请先报名参与活动」 | 同上 |
| K6-3 | 点「分享活动」 | 弹窗含 复制 / Telegram / WhatsApp / X | 截图归档 |
| K6-4 | 点「活动规则」 | `#campaign-rules` 进入视口 | `browser_evaluate` 检测 `getBoundingClientRect` |
| K7-1 | `active` 排行榜点第 2 页 | 表格仍展示 | `browser_click` |
| K7-2 | `empty-ranking` | 空态「暂无数据」 | snapshot |

弹窗 / 底部浮层（K4）：滚动使顶部 CTA 不可见，验证底部浮层出现（`browser_evaluate` 检查浮层 DOM 可见性）。

## 5. Browser MCP 补充流程

当需要 **与 Figma 并排对照** 或 Playwright 扩展暂时不可用时：

1. `browser_navigate` → 活动页  
2. `browser_snapshot` → 确认模块结构  
3. `browser_screenshot` → 当前视口截图  
4. `browser_get_console_logs` → 记录错误  
5. 人工对照 `07-figma-spec.md` 记录偏差项

Browser MCP **不能替代** Playwright 的 `browser_resize` + `fullPage` 截图矩阵；只能作为补充。

## 6. 报告与任务闭环

验收完成后更新：

1. `evidence/ui-ux/<date>/README.md` — 摘要（通过/失败/阻塞）  
2. `evidence/ui-ux/<date>/acceptance-result.json` — 结构化结果（可选）  
3. `04-frontend-tasks.md` — 勾选 K1–K10 / K12  
4. `06-collaboration.md` §4.7 / §4.8 — 更新结论  
5. 保留偏差写入 `06-collaboration.md` §7 或 JF 差异清单

### 报告必填字段

- MCP 组合：Browser + Playwright  
- 服务 URL、Mock/真实、视口、主题  
- 逐步操作、预期、实际  
- Playwright 整页截图路径  
- 控制台警告摘要  
- 与 Figma 对照结论（95% 是否达标）  
- 未验项与阻塞原因

## 7. 本机 Playwright CLI（可选，非 MCP）

仅当需要离线批量回归、不经过 Cursor MCP 时：

```bash
npm i -g playwright && playwright install chromium
node apps/web/docs_tdd/PR-01685/agent/playwright-artifacts/campaign-smoke.cjs
```

**不进 monorepo**；MCP 验收优先，CLI 脚本兜底。
