# 交付摘要 + 残留风险 — PR-02022（2026-07-13）

## 交付摘要

合约跟单广场新手引导（driver.js 三步）+ 带单员首次开仓恭喜弹窗，已完成 G0-G8 全流程：

- 功能：`useUserType`（`GET userType`，含 `isFirstEnter`）+ `useChangeFirstEnter`（`POST change_first_enter`）驱动引导/弹窗二态互斥触发；driver.js 三步引导（无第三步 ×）；`TraderBecomeModal` 带单员弹窗；9 个 PostHog 埋点。
- 真实接口已接入（YApi 5608/5611），`@mock-only` 归零，无遗留 mock 代码。
- 验证：Vitest 28/28（`copyGuide.test.ts`，纯函数 `shouldStartGuide` + 按钮矩阵 + DOM 注入 + **13 条文案逐字断言**）；QA 32 条 Lark 用例回归 30/32 前端范围通过（见 [qa-regression-2026-07-13.md](qa-regression-2026-07-13.md)）；dev 环境真机「刷新不再现」端到端验证通过；人工 UI 走查（Figma L2 并排 ≥95%、390px H5、dark/light）全部通过（见 [ui-ux/manual-walkthrough-checklist.md](ui-ux/manual-walkthrough-checklist.md)）。

## 修正记录（2026-07-13 复盘）

> ⚠️ 初次收口曾结论「未发现 bug」，**已作废**。用户临时改数据看引导 UI 时发现一处内容 bug：

- **引导三步文案被意译改写**（P2 内容缺陷）：`copyTrading.json` 中 `guide.step1~3.title/desc` 6 条实际值为近义改写句（如 step1「发现优质交易员」应为「选择带单员」），与 PRD §5.1 及落盘文档 05/07 不符。落盘文档抄对了，G6 写 i18n 时凭记忆重打导致漂移。
- **漏测原因**：原 Vitest 只做结构断言（key 存在/渲染/不溢出），无「值 === PRD 原文」字面断言；人工 L2 走查被「读起来通顺」骗过。
- **修复**：6 条文案按文档原文改回；`copyGuide.test.ts` 新增 13 条文案逐字断言（`it.each` + `toBe`，含弹窗 3 条），Vitest 15→28 全绿，锁死语义漂移；规则入全局记忆 `feedback_content_assets_verbatim`。

## 残留风险

| 风险 | 说明 | 影响面 | 结论 |
|------|------|--------|------|
| 带单员首次开仓实时更新机制未定 | 弹窗触发依赖 `userType`/`isFirstEnter` 轮询/刷新拿到最新值，后端未提供实时推送（WS/轮询策略），首次开仓后用户需刷新页面才会看到弹窗 | 体验：非阻塞性延迟，不影响数据正确性 | 已知历史限制，[06-collaboration.md](../product/06-collaboration.md) 已归档，非本 PR 阻塞项 |
| 多语言文案仅 zh-CN | i18n 当前只落简中，英文等其他语种文案未补（`docs_tdd` 本地开发惯例，由本地化团队后续处理） | 非中文用户看到的引导/弹窗文案会 fallback 或缺失 | 团队既定流程，不在本 PR 范围内解决 |
| 交易员可见性 F13-F16 为后端过滤 | 前端不做二次校验，完全信任后端返回结果 | 若后端过滤逻辑有误，前端无法感知/兜底 | 已与 Aven 确认为后端职责范围（2026-06-30），前端不重复实现 |
| skip 与 complete 共用同一后端字段 | 后端 `isFirstEnter` 为二态（无独立 ended/completed），跳过和走完三步在数据层无法区分，仅 posthog 事件参数（`skip_step`）保留区分度 | 数据分析：无法从接口状态反查用户是主动跳过还是走完引导，需依赖埋点 | 后端方案确认后跟随，产品已知悉（memory 记录） |

## 结论

G8 全部交付项已完成，PR-02022 已上线（2026-07-22）并完成 worktree 回收。上述残留风险均为已知、已确认、非阻塞项，不需要本 PR 内解决。
