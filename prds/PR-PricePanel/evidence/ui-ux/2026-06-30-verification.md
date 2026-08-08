# 验收记录 — 2026-06-30 真机自测

> 环境：worktree `/Users/aven/github/PR-PricePanel`，`feature/PR-PricePanel`，`pnpm dev` 端口 4104，Next.js 16 + Turbopack。
> 工具：Playwright MCP（真实 Chrome），页面 `/zh-CN/swap/E-BTCUSDT`。

## 1. 订单簿固定 260px

实测（`getBoundingClientRect().width`，容器 viewport ≈2263px）：

| 面板 | 实测宽度 | 结论 |
|------|----------|------|
| 订单簿（`订单簿/最新成交`） | **260px** | ✅ 命中目标 |
| 下单面板 | 422px（9 列比例） | ✅ 不变 |
| K 线（TradingView） | 1574px | ✅ 吸收差额，明显变宽 |
| Header / Orders / Assets | 全宽 / 1838 / 422 | ✅ 不受影响 |

- 公式自洽校验：1440 容器下 `colW=(1440-188)/48≈26.08`，`w=264/30.08≈8.78`，渲染 `round(26.08*8.78+7.78*4)=260` ✅；2880 容器下 `w≈4.39`，渲染 260 ✅。
- **回归过程发现并修复 1 个 bug**：初版 clamp 下界误用布局 `minW`（xl=6 列），宽屏上订单簿停在 356px；改用 `MIN_ORDER_BOOK_COLS=1` 后恒为 260px。

## 2. 分享入口

| 检查项 | 结论 |
|--------|------|
| 工具栏出现分享图标（齿轮后、最新价格前） | ✅ |
| 点击展开下拉 | ✅ |
| 社交区 4 项（X / Telegram / Discord / Facebook）+ 图标 | ✅ |
| 分割线 | ✅ |
| 图片区 4 项（储存图片 / 复制图表图片 / 复制图片链接 / 在新页中打开图片）+ 图标 | ✅ |
| 中文文案正确 | ✅ |
| 点击项后菜单关闭（占位，无副作用） | ✅ |

## 3. 静态校验

| 项 | 结论 |
|----|------|
| `pnpm --dir apps/web typecheck`（改动文件） | ✅ 零报错（其余报错为仓库既有 `@fameex/klinecharts` 未构建等，与本需求无关） |
| `biome check`（6 个改动文件 + 2 个 i18n JSON） | ✅ 通过（KlineShare.tsx 经 `--write` 自动格式化） |

## 4. 备注 / 未覆盖

- 自测截图按 common 规则仅用于临时比对，已删除，不入库。
- 未在本机精确控制到 1440 / 2560 各档逐一截图（连接的是真实 Chrome，窗口宽度受限）；公式已数学校验覆盖这些档位。
- 分享真实功能（截图/复制/链接/跳转）为 P2，未在本次验收范围。
