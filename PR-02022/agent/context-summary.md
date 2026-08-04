# PR-02022 合约跟单新手引导 · context-summary

> AI 恢复项目时优先读本文。只放当前阶段/scope 快照/gate 状态/下一步,细节查 `product/`。
> 生成:2026-07-06,由子 agent 实读文档+跑 Vitest 核实。状态会漂移,动手前对当前代码复核。

## 一句话

跟单广场（`/copy-trading/futures`）**新手引导**(driver.js 三步)+ 带单员首次开仓强提醒弹窗。本期 **Web only**。

## 当前阶段

**G7 已全部通过（Agent + 人工 2026-07-06），进入 G8 交付。** G0-G7 全勾;G8 剩 QA 回归、真实 API 对齐、GET `guide/status` 端到端。

## scope 快照

- **本期做**:F01-F21——新手引导三步、状态查/报、翻页、降级、带单员弹窗互斥、F12 删旧引导、埋点、i18n、H5。
- **不做**:F22 App 端(本期 Web only,埋点也仅 Web),Aven 2026-06-30 确认。
- **已冻结**:driver.js 依赖、第三步去 ×、第三步高亮「跟单详情」入口、带单员弹窗复用 `Modal.tsx`(isDismissable=false)、F13-16 可见性后端处理前端直渲、埋点仅 Web。
- **仍开放(G8 收口)**:真实 API 路径/字段、带单员首次开仓实时更新机制、QA 用例链接/T1-01~T4-04 回归。

## gate / 验证状态

- **Vitest 全绿**:实跑 `apps/web/src/apps/CopyTrading/guide/copyGuide.test.ts` → **15 passed**。
- type-check + Biome:README 声明通过。
- 真实登录页:引导全流程/翻页/跳过/完成/上报/互斥/降级已在真实页验证。
- **人工 UI 走查 ✅**（2026-07-06）:`evidence/ui-ux/manual-walkthrough-checklist.md` 全部勾选——带单员弹窗、引导三步 popover、390px H5、dark/light。
- 修复记录:`fx--check-circle`→`fx--success`;走查期补锚点/`waitForTourAnchors`/`1/3` 标题间距。

## 待办与阻塞

1. **G8 — 后端 GET `guide/status` 未实现**:`useCopyGuide` / `guide-status` 仍 `@mock-only` 兜底 `not_triggered` → 刷新会再现引导。「刷新不再现」待接口就位端到端验证。**POST 上报已通真实后端。**
2. **G8 — QA 用例回归** T1-01~T4-04 待排期。
3. **G8 — 拆 `@mock-only`**：接口就绪后按 `03-api-contract.md`「Mock 拆除清单」逐行删。

## 恢复入口

- worktree `/Users/aven/github/PR-02022`,分支 `feature/PR-02022`;dev 端口 4107。
- 代码:`apps/web/src/apps/CopyTrading/guide/` + `components/Modals/TraderBecomeModal` + `services/api/copyTrading/guide/`(4 hook)。
- 测试 `copyGuide.test.ts`;走查清单 `evidence/ui-ux/manual-walkthrough-checklist.md`（✅ 已通过）。
