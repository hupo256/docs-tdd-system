# API Contract — PR-02022 合约跟单引导页

## API 状态

**接口已确认（2026-07-08，YApi project 579 / cat 1469「公共分类」）**：后端最终方案为**合并的 2 个接口**（非 G1 推导的 4 个拆分接口），引导与带单员弹窗**共用** `userType` + `isFirstEnter` 驱动，天然互斥。

| # | 接口 | 方法 | 入参 | 返回 |
|---|------|------|------|------|
| 5608 | `/cptrade/market/userType` | GET | `uid`（后端由 token 取，前端不传） | `data: { userType: 1普通/2带单员, isFirstEnter: 0已进入/1首次 }` |
| 5611 | `/cptrade/market/change_first_enter` | POST | body `{ userType }` | `data: boolean`（标记已进入，isFirstEnter→0） |

**触发逻辑**：
- `userType=1` + `isFirstEnter=1` → 新手引导（driver.js 3 步）
- `userType=2` + `isFirstEnter=1` → 带单员弹窗（与引导互斥，同一 `userType` 字段区分）
- 看完 / 跳过 → POST `change_first_enter`，后端置 `isFirstEnter=0`，刷新不再现

> **三态→二态决策**（2026-07-08 确认，跟随后端）：后端 `isFirstEnter` 只有二态，不区分「跳过 ended」与「完成 completed」。行为无影响（两者都不再触发）；`skip`/`complete` 仍作为**独立 posthog 事件**上报（`copytrade_guide_skip` / `copytrade_guide_complete`），分析层面无损失。

## 当前实现（2026-07-08）

| 层 | 文件 | 说明 |
|----|------|------|
| 查询 | [market/user-type.ts](../../../src/services/api/copyTrading/market/user-type.ts) `useUserType` | 扩 `isFirstEnter` 字段；已被 10+ 组件消费，仅读 `.userType`，向后兼容 |
| 上报 | [market/change-first-enter.ts](../../../src/services/api/copyTrading/market/change-first-enter.ts) `useChangeFirstEnter` | POST 后 invalidate `useUserType` |
| 引导编排 | [guide/useCopyGuide.ts](../../../src/apps/CopyTrading/guide/useCopyGuide.ts) | `shouldStartGuide` 判 `userType=normal && isFirstEnter=1` |
| 弹窗互斥 | [CopyTrading/index.tsx](../../../src/apps/CopyTrading/index.tsx) | `userType=leader && isFirstEnter=1` |
| 弹窗上报 | [Modals/TraderBecomeModal](../../../src/apps/CopyTrading/components/Modals/TraderBecomeModal/index.tsx) | 关闭/去带单调 `changeFirstEnter({ userType: leader })` |

> 已删除 G1 推导的 4 个假接口 hook（原 `services/api/copyTrading/guide/` 目录：`guide-status`、`guide-status-report`、`trader-popup-status`、`trader-popup-report`），目录已移除。

## 可见性逻辑（§5.3）✅ G2：后端处理

后端接口已过滤，前端 `useTopLeaderList` / `useLeaderList`（`services/api/copyTrading/market/top-leader.ts`）直接渲染返回结果，**本期无前端过滤改动**。带单员首次开仓后的实时更新机制随 API 文档补充后确认。

## 已确认（历史）

- [x] 接口真实路径、入参、返回字段 —— YApi 5608/5611 已确认（2026-07-08）
- [x] 引导 / 弹窗状态枚举 —— 后端用数字（`userType` 1/2、`isFirstEnter` 0/1）
- [x] 身份与弹窗状态是否合并 —— 已合并为 `userType` 单接口
- [x] 接口鉴权 —— 走现有 token 链路（uid 由 token 取，前端不传）
- [x] 首次开仓后带单员实时进入列表的前端感知方式 —— 后端过滤，前端无额外改动；仅保留历史说明
