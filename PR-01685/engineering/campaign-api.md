# Campaign 活动详情 API 契约（C 端实现）

> 基于 dev 环境真实响应（`GET /fe-ex-api/api/activity/{campaignId}`）与 `feature/PR-01685-1` 联调结论整理。  
> **适用范围**：`apps/web/src/apps/Campaign/`、`apps/web/src/services/api/campaign/`。  
> **关联文档**：[03-api-contract.md](../product/03-api-contract.md)（YApi 全量契约）、[development-rules.md](./development-rules.md)（开发规则）。

## 任务按钮态（卡片 CTA）

### 真实 API 保证字段

| 字段 | 说明 |
|------|------|
| `taskViews[].buttonStatus` | **唯一保证下发**的任务级按钮态，驱动卡片奖励 `reward.status` |
| `taskViews[].progressResult.taskModeResult.claimableRewardIds` | 可选；命中时强制该奖励为「待领取」 |
| `taskViews[].progressResult.taskModeResult.claimableTierId` | 可选；阶梯/进阶任务档位可领时使用 |

### 当前线上**不**下发的字段

以下字段在类型中保留为可选，**不应作为 C 端主路径依赖**：

- `taskViews[].rewards[].buttonStatus` — 不存在
- `taskViews[].tierViews[].buttonStatus` — 不存在（SINGLE 任务 `tierViews` 通常为空数组 `[]`）
- `taskViews[].conditionViews[].buttonStatus` — 不存在

> **注**：2026-06-28 e2e 记录曾假设 `tierViews[].buttonStatus` 存在；2026-07 dev 联调（`ACT-CODEX-CLAIM-*`）已确认以 **`taskViews[].buttonStatus` 为准**，见 [evidence/e2e-real-api/2026-06-28/README.md](../evidence/e2e-real-api/2026-06-28/README.md) 后续修正。

### `buttonStatus` 枚举

```
IN_PROGRESS          → 进行中（CTA：立即充值/交易/认证/去完成）
CAN_CLAIM            → 可领取
CLAIMED              → 已领取
AUTO_ISSUE_PENDING   → 待发放
WAITING_SETTLEMENT   → 待发放
OFFLINE_MANUAL       → 待发放
```

### 前端映射链

```
taskViews[].buttonStatus
  + progressResult.taskModeResult.claimableRewardIds / claimableTierId
    → resolveRewardButtonStatus()     [mapYapiTask.ts]
    → reward.status (CampaignRewardStatus)
      → ConditionActionRow btnText / canClick
      → useCampaignActions.handleTaskAction
```

阶梯/进阶（LADDER / ADVANCED）在无 `tierViews[].buttonStatus` 时：

- 未完成档位 → `IN_PROGRESS`
- 已完成档位 → 继承该任务的 `taskViews[].buttonStatus`
- `claimableRewardIds` / `claimableTierId` 优先于任务级状态

## 条件数据（卡片标题 / 进度 / 跳转）

SINGLE 任务卡片上的 `condition` 来自：

```
taskViews[].conditionDefinitions[]        ← 条件定义（title、type、target…）
  + progressResult.conditionProgresses[]  ← 用户进度（current、completed）
    → mapCondition()                      [mapYapiTask.ts]
    → task.conditions[0]                  [SingleTaskCard]
```

`conditionViews[]` 当前 C 端未使用。

| UI 字段 | API 来源 |
|---------|---------|
| `title` / `description` | `conditionName` / `conditionSubtitle` |
| `type` / `actionType` | `conditionType` / `actionType`（经 map 转换） |
| `current` / `target` / `completed` | `conditionProgresses[]`（按 `taskConditionId` 匹配） |

## 活动整体态（Hero / 底部报名）

不由 `buttonStatus` 决定，由以下字段推导：

| 字段 | 用途 |
|------|------|
| `visible` | `false` → 已下线 |
| `serverTime` + `startTime` / `endTime` | 未开始 / 进行中 / 已结束 |
| `joinButtonStatus` | 报名按钮：`CAN_JOIN` / `JOINED` / `LOGIN_REQUIRED` / `BLOCKED` / `HIDDEN` |

## 埋点

`toCampaignTaskButtonType()`（`campaignTracking.ts`）仅用于 PostHog，不参与 UI；输入同为映射后的 `reward.status`。

## 相关代码

- 映射：`apps/web/src/apps/Campaign/common/mapYapiTask.ts`
- 卡片 UI：`apps/web/src/apps/Campaign/components/TaskCards/`
- 集成测试 fixture：`apps/web/src/services/api/campaign/__fixtures__/`
