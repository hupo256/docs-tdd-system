# 活动落地页 Web 接口联调口径

本文档基于当前 `PR-01685` 后端代码整理，目标是前端将 `NEXT_PUBLIC_CAMPAIGN_USE_MOCK=false` 后可以直接联调真实接口。

## 1. 接口基础

当前用户侧 Controller 路径为 `GrowthActivityController`，基础路径：

- 网关前缀：`/fe-ex-api`
- 后端 Controller：`/api/activity`
- 前端实际访问前缀：`/fe-ex-api/api/activity`

当前已实现接口：

| 方法 | 前端路径 | 说明 | 登录 |
| --- | --- | --- | --- |
| GET | `/fe-ex-api/api/activity/list` | 活动列表 | 非必需 |
| GET | `/fe-ex-api/api/activity/{campaignId}` | 活动详情 | 非必需 |
| POST | `/fe-ex-api/api/activity/{campaignId}/join` | 报名活动 | 必需 |
| POST | `/fe-ex-api/api/activity/{campaignId}/refresh` | 手动刷新任务进度 | 必需 |
| GET | `/fe-ex-api/api/activity/{campaignId}/progress` | 查询并刷新任务进度 | 必需 |
| POST | `/fe-ex-api/api/activity/reward/{rewardId}/claim` | 领取奖励 | 必需 |
| GET | `/fe-ex-api/api/activity/{campaignId}/my-record` | 我的报名、领取、发放记录 | 必需 |
| GET | `/fe-ex-api/api/activity/{campaignId}/ranking` | 排行榜 | 非必需 |

注意：当前 path variable `{campaignId}` 同时支持 `growth_campaign.id` 数字主键和业务字段 `growth_campaign.campaign_id`。返回体里的 `campaignId` 是业务 ID 字符串。

统一返回壳：

```json
{
  "code": "0",
  "message": "success",
  "data": {}
}
```

失败时仍是同一壳，`code != "0"`，通常没有 `data`。

## 2. 活动详情

`GET /api/activity/{campaignId}` 会返回活动展示信息、子活动、任务组、任务条件、奖励、规则文案和当前用户状态。

本次已补充给前端联调用的字段：

- `serverTime`：服务端当前时间，用于倒计时、自动开始、自动结束。
- `ruleTitle`：规则区标题。
- `participantConfigType`：活动参与对象配置类型。
- `participantEligible`：当前用户是否满足参与对象配置。
- `conditionDefinitions[].actionType`：任务未完成时建议跳转动作。
- 未登录访问详情/列表时，`joinButtonStatus=LOGIN_REQUIRED`。

详情示例：

```json
{
  "visible": true,
  "serverTime": "2026-06-24T15:30:00",
  "campaignId": "CAMPAIGN_202606",
  "campaignName": "后台活动名称",
  "title": "活动标题",
  "subtitle": "活动副标题",
  "ruleTitle": "活动规则",
  "ruleContent": "<p>规则内容</p>",
  "webBannerUrl": "https://static.example.com/web.png",
  "appBannerUrl": "https://static.example.com/app.png",
  "startTime": "2026-06-24T00:00:00",
  "endTime": "2026-07-01T23:59:59",
  "displayStartTime": "2026-06-20T00:00:00",
  "displayEndTime": "2026-07-03T23:59:59",
  "alreadyJoined": false,
  "rejectReason": "NONE",
  "participantConfigType": "ALL",
  "participantEligible": true,
  "joinButtonStatus": "CAN_JOIN",
  "subActivityViews": [],
  "taskViews": [
    {
      "taskGroupId": "1001",
      "taskGroupName": "完成交易任务",
      "taskMode": "SINGLE",
      "logicType": "AND",
      "triggerType": "CLAIM",
      "sortNo": 1,
      "progressResult": {
        "conditionProgresses": [],
        "taskModeResult": {
          "completed": false,
          "completedConditionIds": [],
          "claimableRewardIds": [],
          "claimableTierId": null
        }
      },
      "conditionDefinitions": [
        {
          "taskConditionId": "2001",
          "tierId": null,
          "conditionName": "现货交易额",
          "conditionSubtitle": "累计完成 100 USDT",
          "conditionType": "SPOT_VOLUME_USDT",
          "operator": "GTE",
          "actionType": "GO_SPOT",
          "targetValue": 100,
          "unit": "USDT",
          "sortNo": 1,
          "startTime": "2026-06-24T00:00:00",
          "endTime": "2026-07-01T23:59:59"
        }
      ],
      "buttonStatus": "IN_PROGRESS",
      "rewardIds": [3001],
      "rewards": []
    }
  ]
}
```

`displayStartTime/displayEndTime` 用于判断页面是否可展示；`startTime/endTime` 用于判断是否可报名、刷新进度、领奖。

活动未发布、已下线、展示期外、活动不存在时，详情接口按成功壳返回 `visible=false`，前端可展示不可见或错误态。活动已经结束但仍在展示期内时，通常 `visible=true`，`rejectReason=NOT_IN_PARTICIPATE_TIME`，`joinButtonStatus=BLOCKED`。

当前表结构和实体里没有 `displayConfigJson`、`shareConfigJson`、`extConfigJson` 三个字段，因此详情接口暂不返回完整分享配置和扩展 JSON。分享链接、邀请码来源也暂未接入当前接口，需要后续补 DB 字段或明确来源。

## 3. 参与资格 / 报名

详情和列表通过以下字段表达报名状态：

- `alreadyJoined`：是否已报名。
- `joinButtonStatus`：按钮状态。
- `rejectReason`：不允许参与的原因。
- `participantConfigType`：参与对象配置类型。
- `participantEligible`：是否满足参与对象配置。

`joinButtonStatus` 枚举：

| 值 | 含义 |
| --- | --- |
| `HIDDEN` | 活动不可见，不展示报名按钮 |
| `CAN_JOIN` | 可报名 |
| `JOINED` | 已报名 |
| `LOGIN_REQUIRED` | 未登录，需要先登录 |
| `BLOCKED` | 可见但当前用户不可报名 |

`rejectReason` 枚举：

| 值 | 含义 |
| --- | --- |
| `NONE` | 无拦截 |
| `NOT_EXISTS` | 活动不存在 |
| `NOT_PUBLISHED` | 未发布 |
| `OFFLINE` | 已下线 |
| `NOT_IN_DISPLAY_TIME` | 不在展示期 |
| `NOT_IN_PARTICIPATE_TIME` | 不在参与期 |
| `NOT_IN_AUDIENCE` | 不满足限定用户、标签、用户类型、新老用户或地区规则 |
| `NOT_LOGIN` | 未登录 |
| `KYC_NOT_PASSED` | KYC 不满足 |
| `ALREADY_JOINED` | 已报名 |

`participantConfigType` 枚举：

| 值 | 含义 |
| --- | --- |
| `ALL` | 全量用户 |
| `NEW_USER` | 新用户 |
| `OLD_USER` | 老用户 |
| `LIMITED_TAG` | 限定用户标签 |
| `LIMITED_USER_TYPE` | 限定用户类型 |
| `KYC` | 仅 KYC 通过用户 |
| `REGION_EXCLUDE` | 排除地区/国家 |

`POST /join` 是幂等的。已经报名再次请求会返回成功数据，`alreadyJoined=true`。

报名成功示例：

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "success": true,
    "alreadyJoined": false,
    "rejectReason": "NONE"
  }
}
```

报名被拦截但请求处理成功示例：

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "success": false,
    "alreadyJoined": false,
    "rejectReason": "KYC_NOT_PASSED"
  }
}
```

## 4. 任务进度 / 刷新

职责划分：

- `GET /detail`：返回活动详情，并在已报名时计算当前任务视图和按钮状态。
- `POST /refresh`：登录且已报名用户手动刷新任务进度。
- `GET /progress`：当前实现与 `refresh` 走同一逻辑，返回最新进度。

当前没有 WebSocket。前端可以按 `progress`、`ranking` 轮询，或提供手动刷新。

`refresh/progress` 未登录返回 `10002`。未报名、不满足资格、不在参与期等返回业务失败码。

## 5. 奖励领取 / 发放

`POST /api/activity/reward/{rewardId}/claim` 当前只需要传 `rewardId`。后端会根据 reward 反查活动、任务组、条件、档位和当前用户进度；阶梯、进阶、组合、单一任务不需要前端额外传 `taskId/tierId/conditionId`。

领取结果示例：

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "success": true,
    "alreadyClaimed": false,
    "rejectReason": "NONE"
  }
}
```

重复领取按幂等成功处理：

```json
{
  "code": "0",
  "message": "success",
  "data": {
    "success": true,
    "alreadyClaimed": true,
    "rejectReason": "ALREADY_CLAIMED"
  }
}
```

状态字段口径：

| 前端状态 | 后端字段 |
| --- | --- |
| 待领取 | `taskViews[].buttonStatus=CAN_CLAIM` |
| 已领取 | `taskViews[].buttonStatus=CLAIMED` 或 `my-record.fulfillmentStatus=SUCCESS` |
| 待发放 | `my-record.fulfillmentStatus=PENDING` |
| 已发放 | `my-record.fulfillmentStatus=SUCCESS` |
| 发放失败 | `my-record.fulfillmentStatus=FAILED` |
| 线下发放 | `taskViews[].buttonStatus=OFFLINE_MANUAL` 或 `my-record.fulfillmentStatus=OFFLINE_MANUAL` |

`buttonStatus` 枚举：

| 值 | 含义 |
| --- | --- |
| `IN_PROGRESS` | 任务进行中 |
| `CAN_CLAIM` | 可领取 |
| `CLAIMED` | 已领取 |
| `AUTO_ISSUE_PENDING` | 达标后自动发放待处理 |
| `WAITING_SETTLEMENT` | 等待结算 |
| `OFFLINE_MANUAL` | 线下人工发放 |

## 6. 排行榜

`GET /api/activity/{campaignId}/ranking?taskGroupId={taskGroupId}&displayLimit={displayLimit}`

当前排行榜不是分页接口，只返回最新快照的前 N 条：

- `displayLimit` 默认 `100`。
- 后端服务层最大限制为 `500`。
- 当前不返回 `total/currentPage/pageSize`。
- 最近更新时间字段：`snapshotTime`。
- 是否有快照：`hasSnapshot`。
- 当前登录用户排名：`currentUserRow`，未登录或未上榜时为 `null`。

返回示例：

```json
{
  "hasSnapshot": true,
  "snapshotBatchNo": "20260624153000",
  "snapshotTime": "2026-06-24T15:30:00",
  "rows": [],
  "currentUserRow": null
}
```

用户未报名或活动不可见时，当前返回空排行榜：

```json
{
  "hasSnapshot": false,
  "snapshotBatchNo": null,
  "snapshotTime": null,
  "rows": [],
  "currentUserRow": null
}
```

用户未上榜或 1000 名以后，当前没有特殊错误码，表现为 `currentUserRow=null`；`rows` 仍按 `displayLimit` 返回可展示榜单。

## 7. 配置 JSON / 分享 / 规则

当前可直接使用：

- `ruleTitle`
- `ruleContent`
- `webBannerUrl`
- `appBannerUrl`
- `title`
- `subtitle`

`ruleContent` 当前来自 `growth_campaign.rule_content` 多语言 JSON 解析后的字符串，后端不强制限定纯文本、HTML 或 Markdown。前端建议按运营配置约定渲染；如果要渲染 HTML，需要前端做安全白名单或后端统一清洗。

当前暂未返回：

- `displayConfigJson`
- `shareConfigJson`
- `extConfigJson`
- 完整 `share` 对象
- 分享链接
- 邀请码

这些字段当前没有落在 `growth_campaign` 实体和查询链路里，需要后端后续补表字段、实体字段和接口字段后才能作为稳定联调口径。

## 8. 错误码样例

| 场景 | code | 说明 |
| --- | --- | --- |
| 成功 | `0` | `Success` |
| 未登录 | `10002` | `NotLogin` |
| 系统异常 / 网络处理超时 | `10001` | `SystemError` |
| 奖励当前不可领取 / 重复处理中 | `1053002` | `TASK_CANNOT_CLAIM` |
| 未达标 | `1053006` | `TASK_NOT_COMPLETED` |
| 奖励发放方式不支持用户主动领取 | `1053016` | `TASK_UNSUPPORTED_CLAIM_MODE` |
| 未报名 | `1053013` | `NOT_REGISTERED` |
| 活动已结束 / 不在参与期 | `1053015` | `ACTIVITY_ENDED` |

已领取不是错误；领取接口会按成功返回 `alreadyClaimed=true`。

## 9. 枚举表

`rewardType` 当前不是强枚举字段，代码按字符串透传，现有配置常见值包括：

- `COUPON`
- `CASH`
- `TRIAL_BONUS`
- `MANUAL`

是否真实发现金或券，最终以后端奖励配置、`issueMode` 和发放服务为准。当前系统自动发放主要依赖 `couponCode`，排行类固定线下人工处理。

`issueMode/triggerType` 枚举：

| 值 | 含义 |
| --- | --- |
| `CLAIM` | 用户手动领取 |
| `AUTO_ON_COMPLETE` | 达标自动创建发放记录 |
| `MANUAL` | 线下人工发放 |

`taskType/taskMode` 枚举：

| 值 | 含义 |
| --- | --- |
| `SINGLE` | 单一任务 |
| `COMBINE` | 组合任务 |
| `LADDER` | 阶梯任务 |
| `ADVANCED` | 进阶任务 |
| `RANKING` | 排行榜任务 |

`conditionType` 枚举：

| 值 | 含义 |
| --- | --- |
| `REGISTER` | 注册 |
| `KYC_LEVEL` | KYC 等级 |
| `NET_DEPOSIT_USDT` | 活动期净充值 |
| `TOTAL_DEPOSIT_USDT` | 累计充值 |
| `SPOT_VOLUME_USDT` | 现货交易量 |
| `CONTRACT_VOLUME_USDT` | 合约交易量 |
| `TOTAL_VOLUME_USDT` | 总交易量 |

`actionType` 枚举：

| 值 | 含义 |
| --- | --- |
| `GO_REGISTER` | 去注册 |
| `GO_KYC` | 去 KYC |
| `GO_DEPOSIT` | 去充值 |
| `GO_SPOT` | 去现货交易 |
| `GO_CONTRACT` | 去合约交易 |

## 10. 前端联调建议

前端可以先按以下最小闭环联调：

1. `GET /fe-ex-api/api/activity/list` 获取活动卡片。
2. 使用列表项对应活动主键打开 `GET /fe-ex-api/api/activity/{campaignId}`。
3. 未登录时依据 `joinButtonStatus=LOGIN_REQUIRED` 拉登录。
4. 登录后 `POST /join`。
5. 轮询或手动调用 `GET /progress`。
6. `taskViews[].buttonStatus=CAN_CLAIM` 时调用 `POST /reward/{rewardId}/claim`。
7. 用 `GET /my-record` 展示领取和发放记录。
8. 排行榜活动用 `GET /ranking` 展示最新快照。

