# 增长活动详情页按钮状态前端接入说明

## 1. 适用范围

本文档用于指导前端在活动详情页渲染任务进度、领取按钮、已领取状态、发放阶段文案。

适用接口：

- 活动详情：`GET /api/activity/{campaignId}`
- 我的奖励记录：`GET /api/activity/{campaignId}/my-record`
- 排行榜：`GET /api/activity/{campaignId}/ranking`

核心结论：

- 详情接口的 `buttonStatus` 只表达“当前用户在该展示层级上是否可操作”。
- 详情接口的 `CLAIMED` 只表示“已领取或已进入发奖链路”，不区分待发放、已发放、发放失败。
- 如需展示“已领取待发放 / 已发放 / 发放失败”，必须结合 `my-record.fulfillmentRecords[].fulfillmentStatus`。

## 2. 返回结构层级

活动详情中任务相关字段有三层：

```text
taskViews[]                       // 任务组层级
  ├─ buttonStatus                 // 任务组按钮状态
  ├─ progressResult               // 任务组聚合进度
  │   ├─ conditionProgresses[]     // 条件进度列表
  │   └─ taskModeResult           // 任务模式聚合结果
  ├─ conditionViews[]             // 条件层级，主要用于 SINGLE
  │   ├─ conditionDefinition       // 条件配置、跳转动作、目标值
  │   ├─ progress                  // 当前用户该条件进度
  │   ├─ buttonStatus              // 条件按钮状态
  │   └─ rewards[]                 // 该条件绑定奖励
  └─ tierViews[]                  // 档位层级，主要用于 LADDER / ADVANCED
      ├─ completed                 // 档位是否完成
      ├─ selected                  // LADDER 最高完成档位是否被选中
      ├─ buttonStatus              // 档位按钮状态
      └─ rewards[]                 // 该档位绑定奖励
```

前端不要把三层 `buttonStatus` 混用：

| 层级   | 字段                                        | 适用场景                                 |
| ------ | ------------------------------------------- | ---------------------------------------- |
| 任务组 | `taskViews[].buttonStatus`                  | `COMBINE` 主按钮、任务组总览、排行榜提示 |
| 条件   | `taskViews[].conditionViews[].buttonStatus` | `SINGLE` 每个条件独立奖励按钮            |
| 档位   | `taskViews[].tierViews[].buttonStatus`      | `LADDER` / `ADVANCED` 档位奖励按钮       |

## 3. 按钮状态枚举

`buttonStatus` 当前可能值：

| 状态                 | 含义                               | 前端建议                                             |
| -------------------- | ---------------------------------- | ---------------------------------------------------- |
| `IN_PROGRESS`        | 未完成，或当前层级不可领取         | 展示进度、置灰按钮、按 `actionType` 引导用户完成任务 |
| `CAN_CLAIM`          | 已完成且可手动领取                 | 展示“领取”按钮，点击领取对应 `rewardId`              |
| `CLAIMED`            | 已领取或已进入发奖链路             | 不再展示可点击领取；如需细分发放阶段，查 `my-record` |
| `AUTO_ISSUE_PENDING` | 自动发放类任务已达成，用户无需点击 | 展示“待自动发放 / 发放中”类文案                      |
| `OFFLINE_MANUAL`     | 线下或后台人工发奖                 | 展示“等待人工发放 / 活动结束后发放”类文案            |
| `WAITING_SETTLEMENT` | 等待结算，当前代码较少使用         | 展示“等待结算”类文案                                 |

注意：

- `buttonStatus=CLAIMED` 不等于一定已发放成功。
- `buttonStatus=AUTO_ISSUE_PENDING` 表示无需用户点击，后端自动创建或即将创建履约记录。
- `buttonStatus=OFFLINE_MANUAL` 通常没有系统发券流程，具体以活动规则文案为准。

## 4. 通用进度字段取值

未完成状态的展示主要看进度字段：

| 展示内容            | 推荐字段                                                          |
| ------------------- | ----------------------------------------------------------------- |
| 当前条件是否完成    | `conditionViews[].progress.completed`                             |
| 当前进度值          | `conditionViews[].progress.currentValue`                          |
| 目标值              | `conditionViews[].progress.targetValue`                           |
| 条件名称            | `conditionViews[].conditionDefinition.conditionName`              |
| 条件副标题          | `conditionViews[].conditionDefinition.conditionSubtitle`          |
| 条件类型            | `conditionViews[].conditionDefinition.conditionType`              |
| 跳转动作            | `conditionViews[].conditionDefinition.actionType`                 |
| 任务组是否达标      | `taskViews[].progressResult.taskModeResult.completed`             |
| 已完成条件 ID       | `taskViews[].progressResult.taskModeResult.completedConditionIds` |
| 已完成档位 ID       | `taskViews[].progressResult.taskModeResult.completedTierIds`      |
| LADDER 最高完成档位 | `taskViews[].progressResult.taskModeResult.selectedTierId`        |

`actionType` 常见值：

| actionType    | 建议动作                               |
| ------------- | -------------------------------------- |
| `GO_REGISTER` | 引导注册，通常已登录场景不会出现未完成 |
| `GO_KYC`      | 跳转 KYC                               |
| `GO_DEPOSIT`  | 跳转充值                               |
| `GO_SPOT`     | 跳转现货交易                           |
| `GO_CONTRACT` | 跳转合约交易                           |

## 5. SINGLE 单条件独立奖励任务

### 5.1 业务语义

`SINGLE` 是一个完整任务组，任务组下可以有多个条件，每个条件独立配置奖励、独立完成、独立领取。

例如：

- 注册奖励
- KYC 奖励
- 充值奖励

### 5.2 前端取值规则

`SINGLE` 每一行条件按钮必须使用：

```text
taskViews[].conditionViews[i].buttonStatus
```

不要使用：

```text
taskViews[].buttonStatus
```

原因：`taskViews[].buttonStatus` 是任务组聚合状态。只要 SINGLE 任务组中还有任意条件可领取，任务组状态可能就是 `CAN_CLAIM`，不能代表某一个条件按钮。

### 5.3 未完成展示

条件未完成时：

```json
{
  "progress": {
    "completed": false,
    "currentValue": 0,
    "targetValue": 10
  },
  "buttonStatus": "IN_PROGRESS",
  "conditionDefinition": {
    "actionType": "GO_DEPOSIT"
  }
}
```

前端建议：

- 展示进度：`currentValue / targetValue`
- 按钮置灰或展示“去完成”
- 跳转动作取 `conditionDefinition.actionType`

### 5.4 已完成未领取

条件完成且未领取时：

```json
{
  "progress": {
    "completed": true
  },
  "buttonStatus": "CAN_CLAIM",
  "rewardIds": ["9"],
  "rewards": [
    {
      "rewardId": "9",
      "taskConditionId": "CD_xxx",
      "issueMode": "CLAIM"
    }
  ]
}
```

前端建议：

- 展示“领取”按钮
- 点击领取时使用当前条件下 `rewards[].rewardId`
- 如果一个条件下有多个奖励，按产品交互决定一次领一个还是逐个领；后端维度按 `rewardId + taskConditionId` 幂等。

### 5.5 已领取或已进入发放链路

条件已领取时：

```json
{
  "buttonStatus": "CLAIMED"
}
```

前端建议：

- 不再展示“领取”按钮。
- 简单展示可用“已领取”。
- 如果要区分“已领取待发放 / 已发放 / 发放失败”，调用 `my-record`，按 `rewardId + taskConditionId` 匹配履约记录。

### 5.6 示例说明

如果返回：

```text
conditionViews[注册].buttonStatus = CLAIMED
conditionViews[KYC].buttonStatus = CAN_CLAIM
taskViews[].buttonStatus = CAN_CLAIM
```

表示：

- 注册奖励已经领取。
- KYC 奖励还可以领取。
- 任务组层级还有可领取奖励，所以任务组聚合状态为 `CAN_CLAIM`。

前端展示注册行时应看注册条件自己的 `conditionViews[].buttonStatus=CLAIMED`，不能看任务组 `taskViews[].buttonStatus`。

## 6. COMBINE 组合任务

### 6.1 业务语义

`COMBINE` 是多个条件组合成一个任务组，奖励通常绑定任务组维度，而不是每个条件独立领取。

组合逻辑看：

```text
taskViews[].logicType
```

常见值：

- `AND`：所有条件完成才算任务完成。
- `OR`：任意条件完成即算任务完成。

### 6.2 前端取值规则

`COMBINE` 主按钮使用：

```text
taskViews[].buttonStatus
```

条件明细只展示进度，不作为领取按钮来源：

```text
taskViews[].conditionViews[].progress
```

### 6.3 未完成展示

```text
taskViews[].progressResult.taskModeResult.completed = false
taskViews[].buttonStatus = IN_PROGRESS
```

前端建议：

- 展示所有条件进度。
- AND 模式下提示还缺哪些条件。
- OR 模式下提示完成任意一个即可。
- 跳转动作可从未完成条件的 `conditionDefinition.actionType` 中取。

### 6.4 已完成未领取

```text
taskViews[].progressResult.taskModeResult.completed = true
taskViews[].buttonStatus = CAN_CLAIM
```

前端建议：

- 展示任务组级“领取”按钮。
- 领取使用 `taskViews[].rewards[].rewardId`。

### 6.5 已领取或进入发放链路

```text
taskViews[].buttonStatus = CLAIMED
```

发放阶段看 `my-record`，匹配维度建议：

```text
rewardId + taskGroupId
```

## 7. LADDER 阶梯任务

### 7.1 业务语义

`LADDER` 多个档位中只选择最高完成档位进行奖励，通常同一任务只领取一次最高档。

核心字段：

```text
taskViews[].progressResult.taskModeResult.selectedTierId
```

`selectedTierId` 表示当前最高完成档位。

### 7.2 前端取值规则

档位展示使用：

```text
taskViews[].tierViews[]
```

其中：

- `tierViews[].completed`：该档位是否完成。
- `tierViews[].selected`：是否是当前最高完成档位。
- `tierViews[].buttonStatus`：该档位按钮状态。

### 7.3 未完成展示

```text
taskViews[].progressResult.taskModeResult.completed = false
tierViews[].completed = false
tierViews[].buttonStatus = IN_PROGRESS
```

前端建议：

- 展示各档位目标和当前进度。
- 不显示领取按钮。

### 7.4 完成某个档位未领取

```text
tierViews[i].selected = true
tierViews[i].buttonStatus = CAN_CLAIM
```

前端建议：

- 只对 `selected=true` 的最高档位展示领取按钮。
- 低于最高档位即使 `completed=true`，也不应展示可领取。

### 7.5 已领取或进入发放链路

```text
tierViews[i].buttonStatus = CLAIMED
```

发放阶段看 `my-record`，匹配维度建议：

```text
rewardId + tierId
```

## 8. ADVANCED 进阶任务

### 8.1 业务语义

`ADVANCED` 支持多个档位逐档完成、逐档领取。与 `LADDER` 不同，多个档位可以分别领取。

### 8.2 前端取值规则

每个档位按钮使用：

```text
taskViews[].tierViews[i].buttonStatus
```

不要只使用 `taskViews[].buttonStatus` 代表所有档位。

### 8.3 未完成档位

```text
tierViews[i].completed = false
tierViews[i].buttonStatus = IN_PROGRESS
```

### 8.4 已完成未领取档位

```text
tierViews[i].completed = true
tierViews[i].buttonStatus = CAN_CLAIM
```

或者自动/人工发放：

```text
tierViews[i].buttonStatus = AUTO_ISSUE_PENDING
tierViews[i].buttonStatus = OFFLINE_MANUAL
```

### 8.5 已领取档位

```text
tierViews[i].buttonStatus = CLAIMED
```

发放阶段看 `my-record`，匹配维度建议：

```text
rewardId + tierId
```

## 9. RANKING 排行榜任务

### 9.1 业务语义

排行榜任务不按普通条件进度实时刷新，由排行榜快照/调度服务处理。

### 9.2 前端取值规则

详情页任务按钮通常看：

```text
taskViews[].buttonStatus
```

登录并报名后，排行榜任务常见状态：

```text
buttonStatus = OFFLINE_MANUAL
```

排行榜名次、排名、候选奖励不要从 `conditionViews` 或 `tierViews` 推断，应调用排行榜接口：

```text
GET /api/activity/{campaignId}/ranking
```

### 9.3 展示建议

- 未到结算或未出结果：展示“排行榜统计中 / 活动结束后公布”。
- 已出结果：展示排行榜接口返回的排名和奖励信息。
- 发奖通常为后台或线下处理，详情页可展示 `OFFLINE_MANUAL` 对应文案。

## 10. 发放阶段展示

### 10.1 为什么详情页不够用

详情页 `buttonStatus=CLAIMED` 表示已领取或已进入发放链路，但不区分：

- 待发放
- 已发放
- 发放失败
- 线下人工发放

如果前端需要展示这些精细状态，必须使用：

```text
GET /api/activity/{campaignId}/my-record
```

### 10.2 my-record 关键字段

`my-record` 返回：

```text
fulfillmentRecords[]
```

关键字段：

| 字段                | 含义                                              |
| ------------------- | ------------------------------------------------- |
| `campaignId`        | 活动 ID                                           |
| `subActivityId`     | 子活动 ID                                         |
| `uid`               | 用户 UID                                          |
| `taskGroupId`       | 任务组 ID                                         |
| `taskConditionId`   | SINGLE 条件奖励维度                               |
| `tierId`            | LADDER / ADVANCED 档位维度                        |
| `rewardId`          | 奖励 ID                                           |
| `issueMode`         | 发放方式：`CLAIM` / `AUTO_ON_COMPLETE` / `MANUAL` |
| `fulfillmentStatus` | 履约状态                                          |
| `claimTime`         | 用户领取时间                                      |
| `planIssueTime`     | 计划发券时间                                      |
| `issueTime`         | 实际发券成功时间                                  |
| `failReason`        | 失败原因                                          |

### 10.3 fulfillmentStatus 文案建议

| fulfillmentStatus | 含义         | 前端建议文案                |
| ----------------- | ------------ | --------------------------- |
| `PENDING`         | 系统待发券   | 已领取，待发放 / 发放中     |
| `SUCCESS`         | 系统发券成功 | 已发放                      |
| `FAILED`          | 系统发券失败 | 发放失败 / 发放处理中       |
| `OFFLINE_MANUAL`  | 线下人工发奖 | 待人工发放 / 活动结束后发放 |

### 10.4 履约记录匹配维度

前端把详情页奖励与 `my-record.fulfillmentRecords[]` 关联时，建议按任务模式匹配：

| 任务模式   | 匹配字段                                                |
| ---------- | ------------------------------------------------------- |
| `SINGLE`   | `rewardId + taskConditionId`                            |
| `COMBINE`  | `rewardId + taskGroupId`                                |
| `LADDER`   | `rewardId + tierId`                                     |
| `ADVANCED` | `rewardId + tierId`                                     |
| `RANKING`  | `rewardId + taskGroupId`，具体以排行榜/后台发奖记录为准 |

如果同一活动下可能存在重复奖励配置，建议额外带上 `campaignId + uid` 做限定。

## 11. 前端渲染决策表

| 任务模式   | 主展示单元 | 按钮字段                                | 进度字段                                       | 发放阶段字段                                     |
| ---------- | ---------- | --------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `SINGLE`   | 条件       | `conditionViews[].buttonStatus`         | `conditionViews[].progress`                    | `my-record` 按 `rewardId + taskConditionId` 匹配 |
| `COMBINE`  | 任务组     | `taskViews[].buttonStatus`              | `conditionViews[].progress` + `taskModeResult` | `my-record` 按 `rewardId + taskGroupId` 匹配     |
| `LADDER`   | 最高档位   | `tierViews[selected=true].buttonStatus` | `tierViews[]` + `selectedTierId`               | `my-record` 按 `rewardId + tierId` 匹配          |
| `ADVANCED` | 每个档位   | `tierViews[].buttonStatus`              | `tierViews[]`                                  | `my-record` 按 `rewardId + tierId` 匹配          |
| `RANKING`  | 排行榜     | `taskViews[].buttonStatus` + 排行榜接口 | 排行榜接口                                     | `my-record` 或后台发奖结果                       |

## 12. 常见误用

### 12.1 SINGLE 用任务组按钮渲染条件按钮

错误：

```text
注册条件按钮 = taskViews[].buttonStatus
```

问题：如果 KYC 还能领取，任务组 `buttonStatus` 可能是 `CAN_CLAIM`，导致注册条件已领取后仍显示可领取。

正确：

```text
注册条件按钮 = conditionViews[注册].buttonStatus
```

### 12.2 用 CLAIMED 判断已发放成功

错误：

```text
buttonStatus = CLAIMED => 展示“已发放”
```

问题：`CLAIMED` 可能只是已领取待发放。

正确：

```text
buttonStatus = CLAIMED => 不再展示领取按钮
fulfillmentStatus = SUCCESS => 展示“已发放”
fulfillmentStatus = PENDING => 展示“已领取，待发放”
```

### 12.3 ADVANCED 只看任务组按钮

错误：

```text
所有档位按钮 = taskViews[].buttonStatus
```

正确：

```text
每个档位按钮 = tierViews[i].buttonStatus
```

## 13. 后端代码依据

按钮状态生成：

- `GrowthActivityQueryServiceImpl.buildTaskViews`
- `GrowthActivityQueryServiceImpl.normalizeTaskButtonStatus`
- `GrowthActivityQueryServiceImpl.toConditionButtonStatus`
- `GrowthActivityQueryServiceImpl.toTierButtonStatus`
- `GrowthActivityQueryServiceImpl.toTaskButtonStatus`

任务模式聚合：

- `SingleTaskModeProcessor`
- `CombineTaskModeProcessor`
- `LadderTaskModeProcessor`
- `AdvancedTaskModeProcessor`

履约记录与发放阶段：

- `GrowthActivityMyRecordServiceImpl`
- `GrowthRewardFulfillmentRecord`
- `GrowthRewardFulfillmentStatusEnum`
- `GrowthMapperBackedFulfillmentRecordCreator`

## 14. 接入建议

建议前端封装一个统一方法：

```ts
type RenderTarget = "task" | "condition" | "tier";

function resolveActivityRewardDisplay(taskView, options) {
  switch (taskView.taskMode) {
    case "SINGLE":
      // 渲染 conditionViews
      break;
    case "COMBINE":
      // 渲染 taskView
      break;
    case "LADDER":
      // 渲染 selected tierView
      break;
    case "ADVANCED":
      // 渲染 tierViews
      break;
    case "RANKING":
      // 渲染 ranking API + taskView 提示
      break;
  }
}
```

详情页基础按钮状态来自详情接口；发放阶段增强文案来自 `my-record`。两者职责不要混用。
