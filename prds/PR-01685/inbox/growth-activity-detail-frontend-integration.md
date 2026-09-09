# 增长活动详情接口前端对接文档

> 面向 Web、H5、App 前端开发人员，以及需要根据接口自动生成页面逻辑的前端 AI。本文档以当前代码实际行为为准。

## 1. 接口概览

### 1.1 地址

```http
GET /api/activity/{campaignId}
```

### 1.2 用途

查询增长活动公开信息、展示状态、时间、当前用户报名/资格状态、任务分组、任务进度、档位进度、奖励信息和按钮状态。

### 1.3 登录要求

接口不强制登录：

- 未登录可以查看公开活动详情、规则、任务定义和奖励展示；
- 未登录不能报名、刷新进度或领取奖励；
- 已登录且已报名时，查询型非排行榜任务会实时刷新进度；
- 已登录但未报名时，只返回任务定义，不返回当前用户实时进度。

### 1.4 `campaignId`

控制器先按数据库主键解析；数字主键不存在或参数不是数字时，再按活动业务 ID 查询。两者都不存在时，接口可能仍返回 `code=0`，但 `data.visible=false`。

前端不要自行把路径参数转成数字；后续定位活动应使用返回的 `data.campaignId` 和任务的稳定 ID。

### 1.5 请求上下文

接口读取现有登录态、语言和请求地区/IP。前端应复用项目既有鉴权和语言/地区请求头，不要把 UID 或地区编码当作普通 query 参数。

## 2. 通用响应

接口类型为 `CommonResult<GrowthActivityDetailResult>`。

### 2.1 成功

```json
{
  "code": "0",
  "msg": "成功",
  "message": "成功",
  "data": {
    "visible": true,
    "displayStatus": "ACTIVE",
    "serverTime": 1760000000000,
    "currentTime": 1760000000000,
    "campaignId": "CAMP_2026_001",
    "campaignName": "后台活动名称",
    "title": "活动标题",
    "subtitle": "活动副标题",
    "ruleTitle": "活动规则",
    "ruleContent": "活动规则内容",
    "webBannerUrl": "https://cdn.example.com/web-banner.png",
    "appBannerUrl": "https://cdn.example.com/app-banner.png",
    "alreadyJoined": false,
    "startTime": 1760000000000,
    "endTime": 1762592000000,
    "displayStartTime": 1759913600000,
    "displayEndTime": 1762678400000,
    "rejectReason": "NONE",
    "participantConfigType": "ALL",
    "participantEligible": true,
    "joinButtonStatus": "CAN_JOIN",
    "subActivityViews": [],
    "taskViews": []
  }
}
```

`code=0` 只代表详情查询成功，不代表用户一定能报名或领奖。前端还必须判断 `visible`、`joinButtonStatus`、任务/条件/档位的 `buttonStatus`。

### 2.2 失败

```json
{
  "code": "10001",
  "msg": "系统异常，请联系管理员",
  "message": "系统异常，请联系管理员",
  "data": null
}
```

```text
if response.code != "0":
    使用通用错误处理，不读取 data
else:
    读取 data
    先判断 data.visible
    再根据报名和任务按钮状态渲染
```

详情接口通常将活动不存在、未发布封装为 `code=0 + visible=false`；未预期异常才返回系统错误。

## 3. 顶层字段

| 字段 | 类型 | 含义 | 对接规则 |
|---|---|---|---|
| `visible` | boolean | 详情是否可见 | false 时隐藏活动主体和所有操作 |
| `displayStatus` | enum/null | 详情展示状态 | 以服务端返回为准 |
| `serverTime` | number/null | 服务端当前时间，毫秒 | 用于倒计时和校时 |
| `currentTime` | number/null | `serverTime` 别名，当前实现相同 | 可作为兼容回退 |
| `campaignId` | string/null | 活动业务 ID | 不要用数组下标定位活动 |
| `campaignName` | string/null | 后台活动名称 | 常用于埋点/调试 |
| `title` | string/null | 当前语言活动标题 | 主标题 |
| `subtitle` | string/null | 当前语言副标题 | 空时隐藏 |
| `ruleTitle` | string/null | 规则区标题 | 空时使用默认文案或隐藏 |
| `ruleContent` | string/null | 活动规则说明 | 按产品约定渲染，不当结构化规则解析 |
| `webBannerUrl` | string/null | Web Banner | Web 优先 |
| `appBannerUrl` | string/null | App Banner | App 优先 |
| `alreadyJoined` | boolean | 当前用户是否已报名 | 只有 true 才进入用户任务周期 |
| `startTime` | number/null | 参与开始时间 | 参与倒计时 |
| `endTime` | number/null | 参与结束时间 | 结束倒计时 |
| `displayStartTime` | number/null | 展示开始时间 | 展示窗口参考 |
| `displayEndTime` | number/null | 展示结束时间 | 展示截止参考 |
| `rejectReason` | enum/null | 资格/可操作性原因 | 辅助提示，不替代按钮状态 |
| `participantConfigType` | enum | 参与对象配置类型 | 不自行重复资格计算 |
| `participantEligible` | boolean | 是否命中参与对象规则 | 匿名时不能直接理解为可报名 |
| `joinButtonStatus` | enum | 报名按钮状态 | 报名按钮唯一驱动字段 |
| `subActivityViews` | array | 子活动到任务的树形结构 | 有值时优先按它渲染 |
| `taskViews` | array | 所有任务扁平列表 | 无分组或查找任务时使用 |

### 3.1 时间

所有 `LocalDateTime` 字段输出 Unix epoch 毫秒数。JavaScript 直接使用 `new Date(timestamp)`，不要当成秒。当前序列化基于服务端 JVM 默认时区。

```ts
const serverOffset = data.serverTime - Date.now();
const nowByServer = Date.now() + serverOffset;
const remaining = data.endTime - nowByServer;
```

## 4. 活动状态与报名按钮

### 4.1 `displayStatus`

| 值 | 含义 | 建议 |
|---|---|---|
| `NOT_STARTED` | 已发布但参与未开始 | 展示开始倒计时，禁止提前报名 |
| `ACTIVE` | 已发布且在参与窗口 | 正常展示和操作 |
| `IN_PROGRESS` | 兼容的进行中状态 | 按进行中处理，以按钮为准 |
| `TO_PUBLISH` | 已审核但未发布 | 按不可参与处理 |
| `ENDED` | 参与时间已结束 | 展示结束/结算，禁止新操作 |
| `OFFLINE` | 运营手动下线 | 禁止参与，是否隐藏以 `visible` 为准 |

当前详情主要返回 `NOT_STARTED`、`ACTIVE`、`ENDED`、`OFFLINE`。前端必须兼容新增枚举。

### 4.2 `visible=false`

不可见场景仍可能返回非空 `data`，但公开字段为空、任务数组为空：

```json
{
  "code": "0",
  "data": {
    "visible": false,
    "displayStatus": null,
    "serverTime": 1760000000000,
    "campaignId": "NOT_EXISTS_ID",
    "campaignName": null,
    "title": null,
    "ruleContent": null,
    "alreadyJoined": false,
    "rejectReason": "NOT_EXISTS",
    "participantConfigType": "ALL",
    "participantEligible": true,
    "joinButtonStatus": "HIDDEN",
    "subActivityViews": [],
    "taskViews": []
  }
}
```

前端必须：不渲染活动主体；不显示报名和任务操作；把报名状态视为 `HIDDEN`。当前实现对不存在、未发布直接返回不可见；下线活动仍可能返回公开配置但不可参与，所以不能只根据 `displayStatus` 隐藏页面。

### 4.3 `rejectReason`

| 值 | 含义 |
|---|---|
| `NONE` | 无拦截 |
| `NOT_EXISTS` | 活动/配置不存在 |
| `NOT_PUBLISHED` | 活动未发布 |
| `OFFLINE` | 活动已下线 |
| `NOT_IN_DISPLAY_TIME` | 不在展示窗口 |
| `NOT_IN_PARTICIPATE_TIME` | 不在参与窗口 |
| `NOT_IN_AUDIENCE` | 不在活动人群 |
| `NOT_LOGIN` | 需要登录 |
| `KYC_NOT_PASSED` | KYC 未满足 |
| `ALREADY_JOINED` | 已报名 |

### 4.4 `participantConfigType`

`ALL` 全量；`NEW_USER` 新用户；`OLD_USER` 老用户；`LIMITED_TAG` 限定标签；`LIMITED_USER_TYPE` 限定用户类型；`KYC` KYC 用户；`REGION_EXCLUDE` 排除地区。

不要按此字段自行判定资格，实际校验依赖登录态、标签、KYC 和请求地区。

### 4.5 匿名资格

匿名详情存在兼容归一化：无 UID 时，`participantEligible` 可能返回 true，只表示允许公开查看，不表示匿名用户可报名。报名是否允许只看 `joinButtonStatus`，并以报名接口的服务端校验为准。

### 4.6 `joinButtonStatus`

| 值 | 含义 | 动作 |
|---|---|---|
| `HIDDEN` | 详情不可见 | 隐藏 |
| `CAN_JOIN` | 已登录、未报名且满足资格 | 调用报名接口 |
| `JOINED` | 已报名 | 展示已参与，不重复报名 |
| `LOGIN_REQUIRED` | 未登录 | 先登录，登录后重新拉详情 |
| `BLOCKED` | 被 KYC、地区、人群或时间规则拦截 | 禁用并展示原因 |

```ts
function resolveJoinAction(data: Detail) {
  if (!data.visible || data.joinButtonStatus === 'HIDDEN') return { type: 'HIDE' };
  switch (data.joinButtonStatus) {
    case 'CAN_JOIN': return { type: 'JOIN' };
    case 'JOINED': return { type: 'SHOW_JOINED' };
    case 'LOGIN_REQUIRED': return { type: 'LOGIN' };
    case 'BLOCKED': return { type: 'DISABLED', reason: data.rejectReason };
    default: return { type: 'DISABLED' };
  }
}
```

## 5. 任务结构

### 5.1 分组与扁平列表

```text
subActivityViews: 子活动 -> taskViews
 taskViews:       所有任务的扁平列表
```

有子活动分组时，按 `subActivityViews[].sortNo` 和内部 `taskViews[].sortNo` 渲染；无分组时直接使用顶层 `taskViews`。不要通过 `taskGroupId` 自行重建分组。

### 5.2 `subActivityViews[]`

| 字段 | 含义 |
|---|---|
| `subActivityId` | 子活动 ID |
| `subActivityName` | 子活动名称 |
| `subActivityTitle` | 子活动副标题，当前注释标记为多语言 JSON |
| `sortNo` | 展示顺序 |
| `taskViews` | 子活动下任务 |

### 5.3 `taskViews[]`

| 字段 | 含义 |
|---|---|
| `taskGroupId` | 任务组业务 ID，稳定定位键 |
| `taskGroupName` | 任务组名称 |
| `taskGroupDescription` | 任务说明/条件总标题 |
| `taskMode` | 条件如何组合 |
| `logicType` | 组合逻辑，常见 `AND`/`OR` |
| `triggerType` | 奖励如何发放 |
| `sortNo` | 任务顺序 |
| `progressResult` | 原子条件进度和聚合结果 |
| `conditionDefinitions` | 条件配置定义 |
| `buttonStatus` | 任务组按钮状态 |
| `rewardIds` | 任务组奖励 ID |
| `rewards` | 任务组奖励展示信息 |
| `conditionViews` | 条件定义+进度+条件按钮+奖励 |
| `tierViews` | 档位完成+选中+档位按钮+奖励 |

### 5.4 条件定义

`conditionDefinitions[]` 是规则配置，不是用户进度。字段：`taskConditionId` 条件稳定 ID；`tierId` 所属档位；`conditionName`/`conditionSubtitle` 文案；`conditionType` 条件类型；`operator` 比较符；`actionType` 建议动作，如 `GO_KYC`、`GO_DEPOSIT`、`GO_SPOT`；`targetValue` 目标值；`unit` 单位；`sortNo` 顺序；`startTime`/`endTime` 统计时间窗。

`actionType` 只能通过前端白名单映射到真实路由，未知动作降级为普通详情，不拼接任意 URL。

### 5.5 `conditionViews[]`

| 字段 | 含义 |
|---|---|
| `conditionDefinition` | 条件定义 |
| `progress` | 条件当前进度 |
| `buttonStatus` | 条件按钮状态 |
| `rewardIds` | 条件奖励 ID |
| `rewards` | 条件奖励 |

不要只根据目标值计算完成，使用 `progress.completed`。

### 5.6 `progressResult`

```json
{
  "conditionProgresses": [
    {
      "taskConditionId": "COND_TRADE_1",
      "completed": false,
      "actionType": "GO_SPOT",
      "currentValue": 50,
      "targetValue": 100
    }
  ],
  "taskModeResult": {
    "completed": false,
    "completedConditionIds": [],
    "completedTierIds": [],
    "selectedTierId": null
  }
}
```

`conditionProgresses[]`：`taskConditionId` 关联条件；`completed` 原子条件完成状态；`actionType` 建议动作；`currentValue` 当前值，布尔条件通常为 0/1；`targetValue` 目标值，布尔条件通常为 1。

`taskModeResult`：`completed` 任务组是否有可处理结果；`completedConditionIds` 为 SINGLE/COMBINE 完成条件；`completedTierIds` 为 LADDER/ADVANCED 完成档位；`selectedTierId` 为 LADDER 选中的最高完成档位，其他模式为空。

```ts
const ratio = targetValue > 0
  ? Math.min(currentValue / targetValue, 1)
  : completed ? 1 : 0;
```

### 5.7 `tierViews[]`

字段：`tierId` 档位 ID；`tierLevel` 档位等级；`completed` 是否完成；`selected` 是否为选中的领奖档位；`buttonStatus` 档位按钮；`rewardIds` 档位奖励 ID；`rewards` 档位奖励。

`LADDER` 可多个完成但只一个 selected；`ADVANCED` 可多个完成并分别处理，不依赖 selected 作为唯一档位。

### 5.8 奖励

`rewardId` 奖励 ID；`taskConditionId` 条件关联 ID；`tierId` 档位关联 ID；`rankStart`/`rankEnd` 排名区间；`rewardName` 名称；`rewardType` 类型；`couponCode` 卡券编码；`couponType`/`couponTypeName` 卡券类型；`rewardAmount` 数量；`rewardUnit` 单位；`issueMode` 为 `CLAIM`、`AUTO_ON_COMPLETE` 或 `MANUAL`。

## 6. 多任务组合模式

`taskMode` 决定“如何达标”，`triggerType` 决定“如何发奖”，两者不能混用。

### 6.1 `SINGLE`

同一任务组的多个条件相互独立，每个条件可以单独完成、绑定奖励和领取。必须遍历 `conditionViews[]`。

| 条件按钮 | 含义 |
|---|---|
| `IN_PROGRESS` | 未完成，展示进度/跳转 |
| `CAN_CLAIM` | 完成且可手动领取 |
| `CLAIMED` | 已领取/已进入幂等完成 |
| `AUTO_ISSUE_PENDING` | 自动发放，无需点击 |
| `OFFLINE_MANUAL` | 线下发放 |

任务组按钮优先级：任一条件 `CAN_CLAIM` -> `CAN_CLAIM`；否则任一自动发放 -> `AUTO_ISSUE_PENDING`；否则任一人工发放 -> `OFFLINE_MANUAL`；所有带奖励条件均已领取 -> `CLAIMED`；否则 `IN_PROGRESS`。

### 6.2 `COMBINE`

多个条件组成一个任务组，奖励在任务组维度处理一次。`logicType` 只影响同一 `taskGroupId` 内的条件。

- `AND`：所有条件完成才完成；部分完成时任务组 `IN_PROGRESS`，引导完成全部条件；
- `OR`：任意一个条件完成即完成；不要要求其他条件，也不要为每个条件生成独立领取按钮；
- 不要跨任务组合并条件或奖励；条件用于展示，领取按任务组处理。

### 6.3 `LADDER`

多个档位按最高已完成档位发奖，同一用户同一任务按幂等规则处理一次。

- `completed=true` 表示档位达标；
- `selected=true` 表示后端选定的最高可领奖档位；
- 只有 selected 档位显示领取/自动发放动作；
- 较低档位即使完成但未 selected，也不要显示独立领取；
- `selectedTierId` 应与 selected 档位 ID 一致。

### 6.4 `ADVANCED`

多个档位逐档解锁，已完成档位可以叠加处理和领取。

- 遍历全部 `tierViews`；
- 每个 `completed=true && buttonStatus=CAN_CLAIM` 的档位都可显示领取；
- 不把 `selected` 当作唯一档位；
- `completedTierIds` 是已完成并可处理档位集合。

### 6.5 `RANKING`

排行榜由快照服务定时刷新，详情接口不按普通任务实时计算：

- `progressResult` 通常为空进度且聚合未完成；
- 已报名时按钮通常为 `OFFLINE_MANUAL`；
- 排名使用独立排行榜接口，不从 `progressResult` 推导；
- 不调用普通用户领取接口；
- 展示排名奖励区间和排行榜入口，奖励以结算/后台结果为准。

## 7. 奖励发放和按钮

### 7.1 发放方式

| 值 | 含义 | 前端 |
|---|---|---|
| `CLAIM` | 用户达标后手动领取，系统后续发券 | `CAN_CLAIM` 时允许点击 |
| `AUTO_ON_COMPLETE` | 达标后自动进入发奖链路 | 不显示领取 |
| `MANUAL` | 线下人工发奖 | 不显示系统领取 |

以最终返回的 `buttonStatus` 为准，不只根据 `triggerType` 推断。

### 7.2 任务/条件/档位按钮状态

| 值 | 含义 | 可主动领取 |
|---|---|---|
| `IN_PROGRESS` | 未完成、无奖励、未报名或不可处理 | 否 |
| `CAN_CLAIM` | 完成且支持主动领取 | 是 |
| `CLAIMED` | 已领取或已进入幂等链路 | 否 |
| `AUTO_ISSUE_PENDING` | 自动发放中/待发放 | 否 |
| `WAITING_SETTLEMENT` | 活动结束统一结算 | 否 |
| `OFFLINE_MANUAL` | 线下人工发放 | 否 |

只有 `CAN_CLAIM` 才能进入主动领取流程。

### 7.3 领取前置条件

```text
code == "0"
data.visible == true
data.alreadyJoined == true
对应任务/条件/档位 buttonStatus == "CAN_CLAIM"
triggerType/issueMode == "CLAIM"
```

点击后立即禁用按钮；请求锁使用 `taskGroupId + taskConditionId` 或 `taskGroupId + tierId`；成功、已领取、处理中或失败后都重新请求详情，不做本地乐观 `CLAIMED` 更新。

## 8. 全场景矩阵

| 场景 | visible | joined | joinButtonStatus | 进度 | 处理 |
|---|---:|---:|---|---|---|
| 未登录公开查看 | true | false | `LOGIN_REQUIRED` | 空/未刷新 | 展示公开内容，点击先登录 |
| 已登录未报名且符合资格 | true | false | `CAN_JOIN` | 未刷新 | 调用报名 |
| 不在人群/KYC 不满足 | true | false | `BLOCKED` | 未刷新 | 禁用并展示原因/引导 |
| 已报名进行中 | true | true | `JOINED` | 查询型任务实时刷新 | 展示进度和按钮 |
| 未开始 | true | true/false | `JOINED`/`BLOCKED` | 通常未达标 | 展示开始倒计时 |
| 已结束 | true 或按返回 | 可能 true | `BLOCKED`/`JOINED` | 不应继续刷新普通进度 | 展示结束/结算 |
| 手动下线 | 通常 true | false/true | `BLOCKED`/`JOINED` | 不应继续操作 | 展示下线 |
| 不存在 | false | false | `HIDDEN` | 空数组 | 展示不存在 |
| 未发布 | false | false | `HIDDEN` | 空数组 | 展示暂不可用 |
| SINGLE 部分完成 | true | true | 任务组可能 `CAN_CLAIM` | 条件级 | 只领取完成条件 |
| COMBINE AND 部分完成 | true | true | `IN_PROGRESS` | 未完成 | 完成全部条件 |
| COMBINE OR 任一完成 | true | true | 可能 `CAN_CLAIM` | 已完成 | 不要求其他条件 |
| LADDER 多档完成 | true | true | 按选中档位 | 档位级 | 只操作 selected |
| ADVANCED 多档完成 | true | true | 任务/档位分别返回 | 档位级 | 逐档处理 |
| RANKING | true | true | `OFFLINE_MANUAL` | 空/快照 | 使用排行榜接口 |

## 9. 推荐对接流程

### 9.1 进入详情

```text
1. GET /api/activity/{campaignId}
2. 判断 code；非 0 不读取 data
3. visible=false 时展示不可见页面并结束
4. 保存 serverTime 与客户端时间差
5. 渲染活动信息、时间状态和报名区域
6. 有 subActivityViews 时按树渲染，否则使用 taskViews
7. 只有 CAN_CLAIM 显示主动领取按钮
```

### 9.2 登录/报名

```text
1. LOGIN_REQUIRED -> 跳登录
2. 登录成功 -> 重新请求详情，不复用匿名资格和按钮缓存
3. CAN_JOIN -> 调用报名接口
4. 报名成功 -> 重新请求详情
5. 以 alreadyJoined=true、joinButtonStatus=JOINED 为准
```

### 9.3 刷新/领取

```text
1. 仅已报名用户显示进度刷新
2. 刷新后重新请求详情
3. 领取前再次确认 buttonStatus=CAN_CLAIM
4. 领取后重新请求详情
5. RANKING 不走普通实时进度或领取流程
```

活动文案可短时缓存，但不要长时间缓存 `alreadyJoined`、`rejectReason`、所有进度和按钮状态。进入页面、登录完成、报名完成、刷新完成、领取完成后都应重新请求。

## 10. 前端 AI 直接使用规则

```text
你正在对接 GET /api/activity/{campaignId} 增长活动详情接口。

1. 先判断 response.code，非 "0" 时不要读取 data。
2. code 为 "0" 后先判断 data.visible；false 时展示不可见页面，不展示报名和任务操作。
3. 报名按钮只由 joinButtonStatus 决定：HIDDEN 隐藏，CAN_JOIN 报名，JOINED 已参与，LOGIN_REQUIRED 先登录，BLOCKED 禁用并展示 rejectReason。
4. taskMode 决定条件如何组合，triggerType 决定奖励如何发放。
5. SINGLE 使用 conditionViews 逐条件渲染和领取。
6. COMBINE AND 要求全部条件完成，OR 任一条件完成即可；逻辑只在同一 taskGroupId 内生效。
7. LADDER 只对 selected=true 的最高完成档位执行领取或发放展示。
8. ADVANCED 对每个已完成且可领取档位分别处理，不依赖 selected 唯一判断。
9. RANKING 使用独立排行榜接口，不调用普通用户领取接口。
10. 只有 buttonStatus=CAN_CLAIM 才展示领取按钮；其他状态均不可主动领取。
11. 报名和领取后重新请求详情，以服务端状态为准。
12. 时间是毫秒时间戳，使用 serverTime 校准倒计时。
13. 匿名 participantEligible=true 不代表可以报名。
14. 使用 taskGroupId、taskConditionId、tierId、rewardId 做稳定 key。
15. 对 null、空数组和未知枚举做降级处理，不能让页面崩溃。
```

## 11. 典型组合响应

### 11.1 COMBINE AND 部分完成

```json
{
  "code": "0",
  "data": {
    "visible": true,
    "alreadyJoined": true,
    "joinButtonStatus": "JOINED",
    "taskViews": [{
      "taskGroupId": "TASK_AND_001",
      "taskMode": "COMBINE",
      "logicType": "AND",
      "triggerType": "CLAIM",
      "buttonStatus": "IN_PROGRESS",
      "progressResult": {
        "conditionProgresses": [
          {"taskConditionId": "KYC", "completed": true, "currentValue": 1, "targetValue": 1},
          {"taskConditionId": "TRADE", "completed": false, "actionType": "GO_SPOT", "currentValue": 80, "targetValue": 100}
        ],
        "taskModeResult": {
          "completed": false,
          "completedConditionIds": ["KYC"],
          "completedTierIds": [],
          "selectedTierId": null
        }
      }
    }]
  }
}
```

结果：KYC 已完成但交易未完成，不能领取。

### 11.2 COMBINE OR 任一完成

```json
{
  "code": "0",
  "data": {
    "visible": true,
    "alreadyJoined": true,
    "joinButtonStatus": "JOINED",
    "taskViews": [{
      "taskGroupId": "TASK_OR_001",
      "taskMode": "COMBINE",
      "logicType": "OR",
      "triggerType": "CLAIM",
      "buttonStatus": "CAN_CLAIM",
      "progressResult": {
        "conditionProgresses": [
          {"taskConditionId": "DEPOSIT", "completed": true, "currentValue": 100, "targetValue": 100},
          {"taskConditionId": "TRADE", "completed": false, "currentValue": 20, "targetValue": 100}
        ],
        "taskModeResult": {
          "completed": true,
          "completedConditionIds": ["DEPOSIT"],
          "completedTierIds": [],
          "selectedTierId": null
        }
      }
    }]
  }
}
```

结果：完成充值或交易任一条件即可，允许领取。

### 11.3 LADDER 与 ADVANCED

```json
{
  "code": "0",
  "data": {
    "visible": true,
    "alreadyJoined": true,
    "joinButtonStatus": "JOINED",
    "taskViews": [
      {
        "taskGroupId": "TASK_LADDER_001",
        "taskMode": "LADDER",
        "triggerType": "CLAIM",
        "buttonStatus": "CAN_CLAIM",
        "progressResult": {
          "conditionProgresses": [],
          "taskModeResult": {"completed": true, "completedConditionIds": [], "completedTierIds": [101, 102], "selectedTierId": 102}
        },
        "tierViews": [
          {"tierId": 101, "tierLevel": 1, "completed": true, "selected": false, "buttonStatus": "IN_PROGRESS"},
          {"tierId": 102, "tierLevel": 2, "completed": true, "selected": true, "buttonStatus": "CAN_CLAIM"},
          {"tierId": 103, "tierLevel": 3, "completed": false, "selected": false, "buttonStatus": "IN_PROGRESS"}
        ]
      },
      {
        "taskGroupId": "TASK_ADVANCED_001",
        "taskMode": "ADVANCED",
        "triggerType": "CLAIM",
        "buttonStatus": "CAN_CLAIM",
        "progressResult": {
          "conditionProgresses": [],
          "taskModeResult": {"completed": true, "completedConditionIds": [], "completedTierIds": [201, 202], "selectedTierId": null}
        },
        "tierViews": [
          {"tierId": 201, "tierLevel": 1, "completed": true, "selected": false, "buttonStatus": "CLAIMED"},
          {"tierId": 202, "tierLevel": 2, "completed": true, "selected": false, "buttonStatus": "CAN_CLAIM"},
          {"tierId": 203, "tierLevel": 3, "completed": false, "selected": false, "buttonStatus": "IN_PROGRESS"}
        ]
      }
    ]
  }
}
```

LADDER 只操作 102；ADVANCED 只操作 202，201 已领取，203 未完成。

## 12. 相关接口和错误

| 接口 | 用途 | 调用条件 |
|---|---|---|
| `POST /api/activity/{campaignId}/join` | 报名 | `joinButtonStatus=CAN_JOIN` |
| `POST /api/activity/{campaignId}/refresh` | 刷新已报名进度 | 已登录且已报名 |
| `POST /api/activity/{campaignId}/progress` | 刷新进度兼容入口 | 按客户端约定 |
| `POST /api/activity/{campaignId}/claim` | 领取手动奖励 | 对应按钮为 `CAN_CLAIM` |
| `GET /api/activity/{campaignId}/record` | 个人记录 | 登录后 |
| `GET /api/activity/{campaignId}/ranking` | 排行榜 | RANKING 使用 |

报名/刷新错误含义：`NOT_LOGIN` 未登录；`KYC_NOT_PASSED` KYC 未通过；`NOT_IN_AUDIENCE` 不在人群；`NOT_IN_DISPLAY_TIME` 不在展示窗口；`NOT_EXISTS`/`NOT_PUBLISHED`/`OFFLINE` 活动不可用；`NOT_IN_PARTICIPATE_TIME` 未开始或已结束；`ALREADY_JOINED` 已报名。

领取错误含义：`TASK_ALREADY_CLAIMED` 已领取；`TASK_NOT_COMPLETED` 最新校准后未完成；`TASK_CANNOT_CLAIM` 系统繁忙/处理中；`TASK_UNSUPPORTED_CLAIM_MODE` 不支持主动领取。操作失败后重新请求详情。

## 13. 常见错误和实现依据

- 不要把 `code=0` 等同于可以报名；
- 不要把 `SINGLE` 当成任务组一次领取；
- 不要把 `LADDER` 当成 `ADVANCED`；
- 不要使用本地计算覆盖后端完成状态；
- 不要为 `IN_PROGRESS`、`CLAIMED`、`AUTO_ISSUE_PENDING`、`WAITING_SETTLEMENT`、`OFFLINE_MANUAL` 展示主动领取按钮；
- 不要依赖数组下标，稳定 key 使用 `taskGroupId`、`taskConditionId`、`tierId`、`rewardId`；
- 兼容 null、空列表和未知枚举。

实现依据：

- 控制器：`ex-parent/exchange-web-api/src/main/java/com/fcex/exchange/api/growth/GrowthActivityController.java`；
- 详情聚合：`ex-parent/exchange-service/src/main/java/com/fcex/exchange/service/growth/user/impl/GrowthActivityQueryServiceImpl.java`；
- 返回对象：`ex-parent/exchange-common/src/main/java/com/fcex/common/exchange/dto/growth/GrowthActivityDetailResult.java`；
- 任务对象：`GrowthActivityTaskView`、`GrowthActivityConditionView`、`GrowthActivityTierView`；
- 枚举：`GrowthTaskModeEnum`、`GrowthActivityTaskButtonStatus`、`GrowthActivityJoinButtonStatus`；
- 时间序列化：`LocalDateTimeToTimestampSerializer`。

后端若调整详情可见性、匿名资格归一化、任务领取粒度或任务模式规则，应同步更新本文档和前端 AI 提示词。
