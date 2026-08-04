# Growth 阶梯/进阶任务前端进度展示规则

## 背景

用户端活动详情接口会返回任务组 `taskViews`，其中阶梯/进阶类任务主要依赖 `tierViews`、`conditionViews`、`buttonStatus` 展示进度轴、奖励档位、条件卡片和操作按钮。

当前接口里的 `selected` 字段容易被误解。它不是“当前应高亮档位”，也不是“下一档待完成档位”。前端实现 UI 效果时，建议按本文规则计算展示态。

## 关键字段语义

### 任务组字段

| 字段 | 含义 | 前端用途 |
| --- | --- | --- |
| `taskMode` | 任务模式，如 `ADVANCED`、`LADDER` | 决定档位高亮规则 |
| `buttonStatus` | 任务组整体按钮状态 | 可用于任务组级按钮兜底，不建议直接决定档位高亮 |
| `progressResult.taskModeResult.completed` | 任务组是否整体完成 | 判断任务组整体完成态 |
| `progressResult.taskModeResult.selectedTierId` | 后端选中的档位 ID | 仅 `LADDER` 模式可信用于最高命中档 |

### 档位字段 `tierViews[]`

| 字段 | 含义 | 前端用途 |
| --- | --- | --- |
| `tierId` | 档位 ID | 关联奖励、条件和高亮结果 |
| `tierLevel` | 档位层级 | 排序、展示档位顺序 |
| `completed` | 该档位条件是否完成 | 判断打勾、完成色、进度线是否走过 |
| `selected` | 后端选中的档位 | 仅 `LADDER` 表示“最高已完成/当前命中奖励档” |
| `buttonStatus` | 该档位奖励操作状态 | 判断是否可领取、已领取、线下处理、进行中 |
| `rewards` | 该档位奖励 | 展示奖励金额、币种、券等 |

### 条件字段 `conditionViews[]`

| 字段 | 含义 | 前端用途 |
| --- | --- | --- |
| `conditionDefinition.tierId` | 条件所属档位 | 根据当前高亮档位筛选要展示的条件 |
| `progress.completed` | 条件是否完成 | 条件卡片完成态 |
| `progress.currentValue` | 当前进度值 | 展示如 `0/20 USDT` 的左侧值 |
| `progress.targetValue` | 目标值 | 展示如 `0/20 USDT` 的右侧值 |
| `buttonStatus` | 条件操作状态 | 条件级按钮或跳转动作参考 |

## 不要直接用 `selected` 做通用高亮

### `ADVANCED` 进阶任务

`ADVANCED` 模式支持多个档位独立完成、逐档领取。后端会返回已完成档位列表，但不会设置 `selectedTierId`，因此：

- 已完成档位可能是 `completed=true`、`selected=false`。
- 下一档未完成档位也可能是 `completed=false`、`selected=false`。
- 前端如果用 `selected` 判断高亮，会导致进阶任务没有正确高亮当前目标档。

### `LADDER` 阶梯任务

`LADDER` 模式会选择“最高已完成档位”作为 `selectedTierId`，因此：

- `selected=true` 表示当前命中的最高奖励档。
- 低档即使 `completed=true`，也可能 `selected=false`。
- 当没有任何档位完成时，所有档位都会 `selected=false`。

## 推荐 UI 状态定义

前端建议拆分 3 类状态，不要混用一个字段：

| UI 状态 | 推荐来源 | 说明 |
| --- | --- | --- |
| 完成态 | `tier.completed` | 用于打勾、已完成图标、进度线已完成部分 |
| 操作态 | `tier.buttonStatus` | 用于按钮文案、是否可领取、是否已领取 |
| 当前高亮档 | 前端计算 `activeTierId` | 用于紫色光效、条件区标题和当前条件卡片 |

## 当前高亮档计算规则

高亮档位表示 UI 图中的紫色光效档位，也表示条件区当前展示哪个档位的条件。

推荐优先级如下：

1. 优先高亮可操作档位。
2. `LADDER` 模式下，如果已有后端 `selected=true`，高亮该档位。
3. 没有可操作档或命中档时，高亮第一个未完成档位。
4. 全部完成后，高亮最后一个已完成档位；如果产品希望完成后不高亮，也可以返回空。

### TypeScript 参考实现

```ts
type TaskMode = 'ADVANCED' | 'LADDER' | 'SINGLE' | 'COMBINE' | 'RANKING' | string

type ButtonStatus =
  | 'IN_PROGRESS'
  | 'CAN_CLAIM'
  | 'CLAIMED'
  | 'AUTO_ISSUE_PENDING'
  | 'OFFLINE_MANUAL'
  | string

interface TierView {
  tierId: number
  tierLevel: number
  completed: boolean
  selected: boolean
  buttonStatus: ButtonStatus
}

interface TaskView {
  taskMode: TaskMode
  tierViews?: TierView[]
}

const ACTIONABLE_STATUSES = new Set<ButtonStatus>([
  'CAN_CLAIM',
  'AUTO_ISSUE_PENDING',
  'OFFLINE_MANUAL',
])

export function getActiveTierId(task: TaskView): number | undefined {
  const tiers = [...(task.tierViews ?? [])].sort((a, b) => a.tierLevel - b.tierLevel)

  const actionableTier = tiers.find(tier => ACTIONABLE_STATUSES.has(tier.buttonStatus))
  if (actionableTier) {
    return actionableTier.tierId
  }

  if (task.taskMode === 'LADDER') {
    const selectedTier = tiers.find(tier => tier.selected)
    if (selectedTier) {
      return selectedTier.tierId
    }
  }

  const firstIncompleteTier = tiers.find(tier => !tier.completed)
  if (firstIncompleteTier) {
    return firstIncompleteTier.tierId
  }

  return [...tiers].reverse().find(tier => tier.completed)?.tierId
}
```

## 档位样式映射规则

拿到 `activeTierId` 后，每个档位可计算 UI 状态：

```ts
interface TierUiState {
  isActive: boolean
  isCompleted: boolean
  isClaimed: boolean
  isLocked: boolean
  isActionable: boolean
}

export function getTierUiState(tier: TierView, activeTierId?: number): TierUiState {
  return {
    isActive: tier.tierId === activeTierId,
    isCompleted: tier.completed,
    isClaimed: tier.buttonStatus === 'CLAIMED',
    isLocked: !tier.completed && tier.tierId !== activeTierId,
    isActionable: ACTIONABLE_STATUSES.has(tier.buttonStatus),
  }
}
```

建议样式：

| 状态 | UI 表现 |
| --- | --- |
| `isActive=true` | 紫色边框/光效，高亮奖励金额 |
| `isCompleted=true` | 完成图标、进度线已完成色 |
| `isClaimed=true` | 已领取图标或已领取文案 |
| `isLocked=true` | 锁图标、弱化色 |
| `isActionable=true` | 展示可操作按钮或强调按钮 |

## 条件区展示规则

条件区应展示当前高亮档位对应的条件，而不是展示所有条件。

```ts
interface ConditionView {
  conditionDefinition?: {
    tierId?: number
  }
}

export function getActiveTierConditions(
  conditionViews: ConditionView[] | undefined,
  activeTierId: number | undefined,
): ConditionView[] {
  if (activeTierId == null) {
    return []
  }

  return (conditionViews ?? []).filter(condition =>
    condition.conditionDefinition?.tierId === activeTierId,
  )
}
```

条件区标题建议使用当前高亮档位的奖励：

- `完成以下条件，即可获得 20 USDT`
- 奖励金额来自 `activeTier.rewards`。
- 条件进度来自 `activeTierConditions[].progress`。

## 按任务模式的推荐行为

### `ADVANCED`

适用于逐档独立完成、逐档领取。

- 已完成档：看 `completed=true` 展示完成态。
- 当前目标档：优先取第一个未完成档。
- 可领取档：如果存在 `CAN_CLAIM`，优先高亮可领取档。
- 不使用 `selected` 判断高亮。

示例：

| 档位 | completed | selected | buttonStatus | 推荐 UI |
| --- | --- | --- | --- | --- |
| 1 | true | false | CLAIMED | 已完成/已领取，不高亮 |
| 2 | false | false | IN_PROGRESS | 当前目标档，高亮并展示条件 |

### `LADDER`

适用于阶梯奖励，只命中一个最高档。

- 已完成且最高档：`selected=true`，高亮。
- 已完成但非最高档：`completed=true`、`selected=false`，展示完成态但不作为主高亮。
- 未完成且没有 selected：高亮第一个未完成档，引导用户继续做任务。

示例：

| 档位 | completed | selected | buttonStatus | 推荐 UI |
| --- | --- | --- | --- | --- |
| 1 | true | false | IN_PROGRESS | 已完成经过态，不高亮 |
| 2 | true | true | CLAIMED | 最高命中档，高亮 |

## 按钮状态建议

| `buttonStatus` | 推荐文案/行为 |
| --- | --- |
| `IN_PROGRESS` | 展示任务动作按钮，如“去交易”“去认证”；也可仅显示进度 |
| `CAN_CLAIM` | 展示“领取”按钮 |
| `CLAIMED` | 展示“已领取”或完成图标，不允许重复领取 |
| `AUTO_ISSUE_PENDING` | 展示“发放中”或“待发放” |
| `OFFLINE_MANUAL` | 展示“人工审核/线下发放中”，具体文案按产品要求 |

## 注意事项

1. `selected` 当前不是通用高亮字段，尤其不能用于 `ADVANCED`。
2. `completed=true` 只代表条件达成，不代表当前应高亮。
3. `buttonStatus=CLAIMED` 只代表奖励已有领取记录，不代表该档必须高亮。
4. 条件区必须跟随 `activeTierId`，否则会出现高亮 20 USDT 但展示 10 USDT 条件的错位。
5. 如果后续后端新增 `activeTierId`、`currentTierId` 或 `highlighted` 字段，前端可以优先使用后端字段，本文规则作为兜底。

## 推荐后端增强字段

为了避免前后端重复理解规则，建议后端后续增加以下任一字段：

```json
{
  "activeTierId": 2
}
```

或在 `tierViews[]` 中增加：

```json
{
  "tierId": 2,
  "active": true
}
```

字段语义应明确为“前端当前主高亮档位”，与现有 `selected` 区分。
