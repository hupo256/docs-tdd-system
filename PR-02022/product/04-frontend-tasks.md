# Frontend Tasks — PR-02022 合约跟单引导页

## 任务清单

### G0-G2 文档（已完成）

- [x] G0 PRD 同步 + 功能清单（2026-06-30）
- [x] G1 文档 01-07（2026-06-30）
- [x] G2 部分确认：F12 范围 / F13-16 后端 / 埋点 web-only / app 不做（2026-06-30）
- [x] Figma 4 node 读取 + 07-figma-spec 落盘（2026-06-30）
- [x] driver.js 方案 + 复用盘点（02-technical-design，2026-06-30）

### G3 准备（编码前）

- [x] 用户/组长正式同意引入 `driver.js` 依赖（2026-06-30 已同意，已安装到 `@fameex/web`）
- [x] 创建 `feature/PR-02022` 分支 + 同级 worktree（`/Users/aven/github/PR-02022`，端口 4107），`docs_tdd` symlink（历史记录，worktree 已回收）
- [x] grep 确认带单交易页路由常量 → `COPY_TRADING_LEADER_SETTING`（`/copy-trading/leader-setting`，`constants/pathnames.ts:199`）
- [x] grep F12 旧引导全部触发点 → 自动弹出仅 `LeaderSummary.tsx:40`（`setIsOpen(data?.isFirstPage === 1)`）；line 49/79 为用户主动路径，保留
- [x] 确认三步高亮目标真实 DOM，规划 data-tour 锚点（见下方锚点表）

#### data-tour 锚点表（实际落地）

| Step | 高亮目标 | 锚点属性 | 落地文件 |
|------|---------|---------|---------|
| 1 | 交易员列表 section | `data-tour-trader-list` | `TraderListSection/index.tsx`（container div） |
| 2 | 跟单 CTA 按钮 | `data-tour-follow-cta` | `TraderListSection/TraderCard.tsx`（Button） |
| 3 | 跟单概览卡片 | `data-tour-copy-overview` | `Banner/Summary.tsx`（外层 card div） |

### G4 引导主体（driver.js）

- [x] 安装 driver.js（`pnpm --filter @fameex/web add driver.js`）+ 动态引入基础样式（`import('driver.js/dist/driver.css')`，避免 SSR）
- [x] `guide/copyGuideSteps.ts`：三步 step 配置（target/文案/按钮矩阵），第三步 `showButtons: ['previous','next']`（无 ×）
- [x] `guide/copyGuidePopover.ts`：`onPopoverRender` 注入「跳过」（Step 1/2）+ 进度 N/3；Step 3 不注入跳过
- [x] popover 样式还原 Figma（`popoverClass: 'copy-guide-popover'`，2026-07-01 补全 §07 §3 深色气泡 CSS 落 `globals.css`，浏览器实测计算样式 = token：深灰 `rgb(34,35,43)`/12px/紫按钮 `rgb(136,77,255)`）
- [x] `guide/useCopyGuide.ts`：查状态→判定→driver 实例→`drive/moveNext/movePrevious/destroy`
- [x] 高亮目标加 data-tour 锚点（见上方锚点表）
- [x] F02/F03 接口 Mock hook（`useGuideStatus`/`useReportGuideStatus`）
- [x] 接口异常降级（`startGuide().catch()` + 上报 try/catch，不展示、不阻断）

### G5 带单员弹窗 + 删除旧引导

- [x] `TraderBecomeModal`：复用 `components/Modal.tsx`（`isDismissable={false}`）、绿 ✓ icon、紫色去带单按钮
- [x] F08/F09 接口 Mock hook（`useTraderPopupStatus`/`useReportTraderPopup`）
- [x] 互斥逻辑：带单员未读弹窗优先（`isTraderPopupVisible`），引导 `pageReady` 让位
- [x] 去带单跳转带单交易页（`COPY_TRADING_LEADER_SETTING`）
- [x] F12：移除 `LeaderSummary.tsx:40` 首次自动弹出，**保留用户主动路径**（line 49/79）

### G6 埋点 / i18n / H5

- [x] 9 个 PostHog 埋点（§02 §5 映射表，已接入 driver.js 回调 + 弹窗）
- [x] i18n 13 条文案进 `copyTrading.json`（仅中文，`guide.*` + `traderBecomeModal.*`）
- [x] H5：popover 不溢出、按钮可点；弹窗 ≥44px（2026-07-06 人工走查通过）

### G7 自测（Browser/Playwright + Figma L2）

> 2026-07-01：按 [common/verification-division-of-labor.md](../../common/verification-division-of-labor.md) 分工执行。逻辑/边界/数据/DOM 契约由 Agent 用 Vitest + 真实页取值验证；视觉/手感/响应式转人工走查清单（[evidence/ui-ux/manual-walkthrough-checklist.md](../evidence/ui-ux/manual-walkthrough-checklist.md)）。

- [x] 引导全流程：第一步起 → 翻页 → 跳过/完成 → 状态不可逆 → 刷新不再现（Agent 真实页验证：翻页 1→2→3、完成上报 `completed`、跳过上报 `ended`；状态不可逆由 `shouldStartGuide` Vitest 覆盖；真实「刷新不再现」已随后端 GET `guide/status` 闭环）
- [x] 互斥：带单员未读时只出弹窗（Agent 验证：弹窗开启时 driver 未激活、popover 不存在）
- [x] 弹窗 ×/去带单 → 已读 → 不再现（Agent 验证：均触发 popup-report 上报；跳转/再现请见人工清单）
- [x] 接口异常降级（Vitest：status undefined 不触发；上报 try/catch 不阻断；真实环境 guide/status 404 兜底不崩已印证）
- [x] 三步 popover + 弹窗 与 Figma node L2 并排 ≥95%（2026-07-06 人工走查通过，见 [manual-walkthrough-checklist.md](../evidence/ui-ux/manual-walkthrough-checklist.md)）
- [x] 390px H5 + dark/light（2026-07-06 人工走查通过）
- [x] Mock/接口 Vitest integration（`copyGuide.test.ts` 15 用例全绿：步骤矩阵/DOM 注入/触发判定）

### G8 交付

- [x] QA 用例回归（32 条 Lark 用例，2026-07-13；见 [evidence/qa-regression-2026-07-13.md](../evidence/qa-regression-2026-07-13.md)，30/32 前端范围通过，#19-25 后端范围不回归，未发现 bug）
- [x] 真实接口对齐（`userType`/`change_first_enter` 已切真实接口，`@mock-only` 归零；dev 环境「刷新不再现」端到端验证通过）
- [x] 残留风险 + 交付摘要（见 [evidence/delivery-summary-2026-07-13.md](../evidence/delivery-summary-2026-07-13.md)）
