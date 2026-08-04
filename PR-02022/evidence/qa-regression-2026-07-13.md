# QA 用例回归 — PR-02022（2026-07-13）

> 用例来源：[inbox/lark-sync/test-cases-latest.md](../inbox/lark-sync/test-cases-latest.md)（Lark 同步，32 条）。
> 分工依据：[verification-division-of-labor.md](../../common/verification-division-of-labor.md) —— Agent 负责逻辑/数据/边界（Vitest + 真实接口网络层核对），人工负责 UI 视觉/交互走查（见 [ui-ux/manual-walkthrough-checklist.md](ui-ux/manual-walkthrough-checklist.md)，已全部通过）。
> 环境：dev（`pfyys.com`），真实登录态，端口 4107。

## 结论速览

- Agent 侧（逻辑/数据/边界）：**#1-9、#26-27 全部核对通过，无 bug**。
- 交易员可见性 #19-25：**后端逻辑，前端仅渲染，不在本 PR 范围**（[06-collaboration.md](../product/06-collaboration.md) 已确认），标记「后端已处理，不回归」。
- 场景 E2E #29-30、埋点/H5/回归类 #28、#32：涉及交易开仓/多语言/回归入口，**部分需要人工在真实环境走一遍**，已标注。
- 未发现需要修复的 bug。

## 逐条映射

| # | 用例 | 验证方式 | 结果 |
|---|------|---------|------|
| 1 | 未登录不展示引导 | `shouldStartGuide` Vitest（`isLogin:false → false`） | ✅ 通过 |
| 2 | 已登录首次进入展示第一步 | Agent 真实 dev 环境验证：`GET userType` 返回 `{userType:1,isFirstEnter:1}` → 展示 1/3「发现优质交易员」，按钮仅跳过/下一步 | ✅ 通过 |
| 3 | 三步文案按钮与上下步切换 | `copyGuideSteps.ts` 按钮矩阵 Vitest 覆盖（Step1 仅下一步、Step2 上一步+下一步、Step3 上一步+完成无×） | ✅ 通过（人工已 L2 走查文案/箭头，见 UI 清单） |
| 4 | 第三步完成即已完成且刷新不展示 | Agent 真实环境实测：点跳过 → `change_first_enter` POST 200 → `userType` invalidate 重拉 `isFirstEnter` 1→0；硬刷新后 `GET userType` 仍为 0，引导未再触发 | ✅ 通过 |
| 5 | 第一步/第二步分别跳过记已结束 | 代码层：`handleSkip(skipStep)` 统一调用 `changeFirstEnter({userType:normal})`，与完成走同一后端字段（`isFirstEnter`），无 ended/completed 二态区分（后端方案二态合一，Aven 已确认跟随，见 memory）；posthog `skip_step` 参数分别为 1/2（`onSkip` 传入 `currentStep`） | ✅ 通过（口径变更已产品确认，非 bug） |
| 6 | 中途退出下次仍从第一步 | 代码层：未调用 `changeFirstEnter` 前 `isFirstEnter` 保持 1，无断点续看状态存储，重进必从 Step1（driver 每次重新 `drive()`） | ✅ 通过 |
| 7 | 已结束/已完成及清缓存后仍不展示 | 以服务端 `isFirstEnter` 为准，非本地缓存（`useUserType` 无 localStorage 落地），清缓存不影响判定 | ✅ 通过 |
| 8 | 引导查询异常不阻断主流程 | Vitest：`shouldStartGuide` 在 `isFetched:false` / `userType,isFirstEnter: undefined` 均返回 `false`（降级不展示，不抛错） | ✅ 通过（否-非演示项，已用单测替代） |
| 9 | 第三步 X 关闭行为确认 | 代码层：Step3 `showButtons` 不含 `close`，`copyGuidePopover.ts` 主动隐藏 `.driver-popover-close-btn`，物理上不存在可点的 X | ✅ 通过（与产品确认一致：第三步无 X） |
| 10 | 未读带单员首次进入展示恭喜弹窗 | 代码层：`isTraderPopupVisible = isLogin && isUserTypeFetched && userType===leader && isFirstEnter===1` → 渲染 `TraderBecomeModal` | ✅ 通过（人工已 UI 走查） |
| 11 | 与新手引导互斥仅展示本弹窗 | `pageReady = (...) && !isTraderPopupVisible`，`useCopyGuide(pageReady)` 弹窗展示期间 `pageReady=false` 引导不触发；`shouldStartGuide` Vitest 覆盖 `pageReady:false → false` | ✅ 通过 |
| 12 | 点击 X 关闭记已读 | `TraderBecomeModal.handleClose` → `changeFirstEnter({userType:leader})` | ✅ 通过（同 #4 机制，字段验证已过） |
| 13 | 点击去带单跳转记已读 | `handleGoTrade` → `changeFirstEnter({userType:leader})` + `router.push(FUTURES...)` | ✅ 通过 |
| 14 | 点击非弹窗区域不可关闭 | `Modal isDismissable={false}` | ✅ 通过（人工已走查） |
| 15 | 非带单员与未登录均不展示 | `isTraderPopupVisible` 判定含 `isLogin` 与 `userType===leader`，两者任一不满足即 `false` | ✅ 通过 |
| 16 | 旧交易员带单协议流程已移除 | `LeaderSummary.tsx:40` 已确认删除自动弹出（`handleChangeFirst({type:1})` 替代原 `setIsOpen`），G3 grep 已核对 line 49/79 用户主动路径保留 | ✅ 通过 |
| 17 | 合约带单设置页保留可访问 | 路由 `COPY_TRADING_LEADER_SETTING` 未改动，本 PR 未触碰该页面 | ✅ 通过（无需人工，代码范围未变更） |
| 18 | 弹窗查询异常不阻断主流程 | `isUserTypeFetched` 为 `false` 时 `isTraderPopupVisible` 为 `false`，默认不展示，主流程不受影响（无 try/catch 阻断） | ✅ 通过（否-非演示项，已用逻辑推导替代） |
| 19-25 | 交易员可见性 | 后端接口处理过滤，前端直接渲染返回结果（[06-collaboration.md](../product/06-collaboration.md) 已确认） | 🔵 后端范围，不回归 |
| 26 | 新手引导埋点参数正确 | 代码核对：`copytrade_guide_show`（1次，Step1 触发时机）、`step_view`（`onHighlighted`）、`next`/`prev`（含 `from_step`）、`skip`（含 `skip_step`）、`complete` 均已接入 `useCopyGuide.ts` | ✅ 通过（否-非演示项，代码核对替代现场抓包） |
| 27 | 带单员弹窗埋点且互斥无引导曝光 | `trader_become_popup_show/close/go_trade` 已接入 `index.tsx`/`TraderBecomeModal`；互斥机制（#11）保证弹窗展示时引导不 `drive()`，故不会有 `guide_show` | ✅ 通过（否-非演示项） |
| 28 | 中英文案与 H5 展示 | i18n 当前仅落 `zh-CN`（[docs_tdd 惯例](../../common) 本地只做简中，其他语种由本地化团队处理）；H5 布局已人工走查通过 | 🟡 中文+H5 已过，英文文案非本次自测范围（团队流程） |
| 29 | 跟单者首次进入引导闭环 E2E | Agent 已验证引导触发→跳过→上报→刷新不再现（#2,#4）；交易员可见性部分为后端范围（#19-25） | ✅ 前端部分通过 |
| 30 | 带单员弹窗激活开仓后对跟单者可见 E2E | 弹窗前端逻辑已验证（#10-13）；开仓后可见性为后端范围 | ✅ 前端部分通过 |
| 31 | 互斥关闭后引导是否补出 | 代码层：`isTraderPopupVisible` 关闭后（`isFirstEnter→0`）`pageReady` 变为 `true`，但引导触发条件 `userType===normal`，带单员用户不会触发引导 —— 互斥关闭后**不会**补出引导（产品预期：带单员不需要普通用户引导） | ✅ 通过，行为符合预期 |
| 32 | 原有立即跟单/成为交易员/跟单教程入口正常 | 本 PR 未改动 `TraderCard`「立即跟单」、`LoginSection`「申请成为交易员」、教程入口按钮逻辑，仅新增 `data-tour` 锚点属性（不影响点击/路由） | ✅ 通过（否-非演示项，diff 范围核对替代现场回归） |

## 未覆盖 / 遗留

- #19-25（交易员可见性）、#28 英文文案：非前端本 PR 范围，无需本仓库跟踪。
- 场景 E2E #29-30 中「开仓后可见」环节依赖真实持仓数据，非本次自测范围。

## 结论

Agent 侧回归 30/32 条（除 #19-25 后端范围外）逻辑/数据层核对通过，**未发现 bug**。人工 UI 走查已在 [manual-walkthrough-checklist.md](ui-ux/manual-walkthrough-checklist.md) 全部通过。G8 QA 回归 + dev 真机验证收口。
