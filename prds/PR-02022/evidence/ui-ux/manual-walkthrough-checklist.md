# PR-02022 UI/UX 人工走查清单

> **状态：✅ 人工走查全部通过（2026-07-06，Aven）**
>
> 生成：2026-07-01 by Agent（按 [common/rules/verification-division-of-labor.md](../../../../common/rules/verification-division-of-labor.md) 分工：视觉/手感/响应式由人工过）
> Agent 已固化的部分见本目录 `../../README` 的 G7 结论 + Vitest（15 用例全绿）+ 真实页集成验证。

## 前置

- **登录态**打开：`http://localhost:4107/zh-CN/copy-trading/futures`（worktree 默认端口 4107，或你的 dev 端口）
- **验带单员弹窗**：`trader-popup-status.ts` mock 改 `popupStatus: 'unread'` → 进页自动弹窗；验完改回 `'read'`
- **验引导三步**：mock 保持 `popupStatus: 'read'`（当前默认），进页自动起引导
- （历史记录）走查期用过 mock 强制 `not_triggered`，刷新会再现引导；2026-07-13 真实接口 `userType`/`change_first_enter` 已接入且「刷新不再现」端到端验证通过（见下方 G8 结论），mock 路径已废弃

## 一、带单员弹窗（node 9681-25408）

前置：mock `unread`。进页面自动弹出。

- [x] 与 Figma node `9681-25408` 并排 ≥95%：绿色 ✓ 徽章、标题「您已成为带单员！」、正文、紫色全宽圆角「去带单」按钮、右上 ×
- [x] 点遮罩**不关闭**（isDismissable=false）
- [x] 点 × → 弹窗关闭（Agent 已验：上报 popup-report）
- [x] 点「去带单」→ 跳转带单交易页 `/copy-trading/leader-setting`（Agent 已验上报，跳转已人工确认）

## 二、引导三步 popover（node 9679-22600 / 9681-17438 / 9681-19086）

前置：mock `read`。进页面自动起引导。

- [x] **Step1** 与 node `9679-22600` 并排 ≥95%：`1/3` 与标题间距正常、标题「发现优质交易员」、正文、左「跳过」右紫「下一步」文字链、**无「上一步」**、小三角箭头指向「顶级交易员」tab
- [x] **Step2** 与 node `9681-17438` 并排 ≥95%：`2/3`、「一键跟单」、左「跳过」+「上一步」右紫「下一步」文字链、小三角箭头指向「顶级交易员」+「交易员列表」两个 tab
- [x] **Step3** 与 node `9681-19086` 并排 ≥95%：`3/3`、「跟踪跟单进展」、**无「跳过」、无 ×**、「上一步」+紫「完成」文字链、小三角箭头指向「跟单详情」入口
- [x] 高亮挖空区域贴合目标元素，遮罩深色半透明（`--BG-6` 80%）
- [x] 蒙层点击不响应（不关闭、不跳步）
- [x] 翻页动画顺滑，箭头朝向随位置正确

> Agent 已验（数据层）：三步进度/标题/按钮矩阵正确、Step3 无跳过无×、翻页 1→2→3、完成上报 `completed`、跳过上报 `ended`、driver 正确高亮三锚点（tab / tabs / 跟单管理）、popover 计算样式 = Figma token（深灰 `rgb(34,35,43)`/12px/紫文字链 `rgb(136,77,255)`），蒙层 `overlayClickBehavior` 已置空。

## 三、响应式 + 主题

- [x] **390px H5**：popover 不溢出屏幕、按钮可点；弹窗按钮高度 ≥44px、不溢出
- [x] **dark / light** 各一遍：popover 与弹窗背景、文字、紫色按钮在两主题下均正常（当前 token 用 `--fx-bg-3`/`--fx-text-*`/`--fx-primary`，已随主题变量）

## 四、发现/结论

- Agent 修复（G7 前）：`fx--check-circle`（不存在，导致 server 报错）→ `fx--success`，弹窗绿勾正常。
- Agent 修复（走查期 2026-07-06）：引导锚点 `data-tour-trader-tab-top` 挂真实 DOM（Tab title span）；带单员 `LeaderSummary` 补 Step3 锚点；`waitForTourAnchors` 防 layout 竞态；`1/3` 与标题 flex 间距（`copy-guide-title-text`）。
- **G7 人工走查结论（2026-07-06）**：带单员弹窗、引导三步 popover、390px H5、dark/light **全部通过**，可进入 **G8 交付**。
- **G8 收口（2026-07-13）**：真实接口 `GET userType` + `POST change_first_enter` 已接入。Agent 在 dev 环境（`pfyys.com`，真实登录态）用 Playwright 网络层验证：跳过引导 → `change_first_enter` POST 200 → invalidate 重拉 `userType`，`isFirstEnter` 1→0 落库；硬刷新后 `GET userType` 仍返回 `isFirstEnter:0`，引导未再触发（DOM 无「发现优质交易员」弹窗）。「刷新不再现」端到端验证通过，无 bug。QA 32 条用例回归见 [../qa-regression-2026-07-13.md](../qa-regression-2026-07-13.md)。
