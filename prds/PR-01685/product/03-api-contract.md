# 03 — API 契约

> **唯一契约真源**：本文 **§0（YApi 当前版本）** 是后续开发与切真实接口的唯一契约依据。  
> **§1–§10 为历史前端草案**，仅作差异推导参考，**勿照此实现**（路径、字段、分页、时间格式均已被 §0 取代）。  
> **YApi 来源**：`http://35.240.211.100:3333/project/276/interface/api/cat_1205` · 项目 `276` · 分类 `1205` / `Growth Activity`。  
> **原则**：接口路径、方法、字段、错误码以 YApi / 后端最终实现为准；切真实接口前必须同步更新 service、schema、mapper、Mock 数据和测试场景。  
> **待后端确认**：字段级明细见 [§0.4](#04-仍需后端确认) 与 [§10](#10-后端确认清单)；全量待决登记以 [06 §7](./06-collaboration.md#7-待决问题open-questions) 为唯一来源。

## 0.0 同步记录

| 字段 | 值 |
|------|-----|
| 最近同步 | **2026-07-04**（YApi 4126/4144 口径补充，来源 Chrome 登录态直读 YApi，非批量导出） |
| 上一份文档基线 | 2026-06-26 |
| 原始导出 | [inbox/yapi-sync/sync-report.md](../inbox/yapi-sync/sync-report.md) · `inbox/yapi-sync/interfaces/*.json`（2026-06-26 版，未含本次 2026-07-04 补充） |
| 开发基线分支 | `feature/PR-01685-1` |

### 0.0.2 2026-07-04 变更（仅落地页相关：4126、4144）

> 5254（Query issue records）、5545（导出活动数据详情）、5548（导出奖励记录）为后台/报表接口，不在 Web 落地页范围，仅登记不处理（见 §0.1 后台/报表表）。

| 接口 | 字段 | 口径 | 前端处理（已实现） |
|------|------|------|---------------------|
| 4126 详情 | `data.displayStatus` | 用户端展示状态：`NOT_STARTED`/`ACTIVE`/`ENDED`/`OFFLINE`；已下线活动按已结束口径返回 | `mapYapiCampaign.ts#resolveCampaignStatus` 优先取 `displayStatus`，缺省时按 `visible`+时间兜底 |
| 4126 详情 | `data.currentTime` | `serverTime` 别名，同值毫秒时间戳 | 仅补类型，倒计时仍用 `serverTime`（两者同值） |
| 4126 详情 | `rewards[].couponType` / `couponTypeName` | `couponType` 为卡券类型数值，`couponTypeName` 为映射后的枚举名（如 `CONTRACT_BONUS`/`TRIAL_FEE_COUPON`）；不要仅靠 `couponCode` 推断卡券类型 | `yapiTypes.ts` 补 `couponCode`/`couponType`；展示仍用已接的 `couponTypeName`（`shared.tsx`） |
| 4126 详情 | `conditionViews[].progress.actionType` / `progressResult.conditionProgresses[].actionType` | 条件未完成时建议的前端跳转动作，口径同 `conditionDefinition.actionType` | 仅补类型；现有 `mapCondition` 已通过 `conditionDefinition.actionType` 取得等价值，无需改动映射逻辑 |
| 4144 排行榜 | `data.rewardDescription` | 排行榜奖励说明文案，未配置可能为空/`null` | `mapYapiTask.ts#mapRanking` 由硬编码空字符串改为读取 `ranking.rewardDescription` |
| 4144 排行榜 | `data.currentPage` / `pageSize` / `total` | 分页字段；`lastUpdatedTime` 口径不变（无真实批次时按 10 分钟整点兜底，避免展示 `--`） | 仅补类型；当前前端仍对 `displayLimit=100` 结果做本地分页（见 [`RankingTaskCard.tsx`](../../../src/apps/Campaign/components/TaskCards/RankingTaskCard.tsx)），未接服务端分页 |
| 4144 排行榜 Query | `pageNum` / `pageSize` | 支持分页查询；不传时兼容旧 `displayLimit` 口径 | 未接入；service 仍只传 `taskGroupId`/`displayLimit`，向后兼容不受影响 |

## 0.0.1 当前代码对齐状态（2026-06-26 复查 · 2026-06-27 更新）

- `apps/web/src/services/api/campaign/campaign.ts` 已按 YApi 路径封装，固定走真实接口。
- `fetchCampaignDetail`：先拉详情 DTO，再按排行榜 `taskGroupId` 补拉 ranking，共用 `mapYapiCampaignDetail`。
- `apps/web/src/apps/Campaign/common/yapiTypes.ts`、`mapYapiCampaign.ts` 已按 YApi 2026-06-26 校准（见 §0.5）。
- **Mock 已零残留拆除（2026-07-03）**：按 [architecture-and-state.md §8.0.3](../../../common/architecture-and-state.md) 拆除三道闸删除 `apps/Campaign/mock/`、`services/api/campaign/mockApi.ts`、`campaign.integration.test.ts`、`NEXT_PUBLIC_CAMPAIGN_USE_MOCK` flag、`CampaignScenario` 类型；`grep -rn "mock" apps/web/src/apps/Campaign apps/web/src/services/api/campaign`、`grep -rn "USE_MOCK" apps/web` 均已归零。
- 埋点：`apps/web/src/apps/Campaign/common/campaignTracking.ts`，沿用 PostHog（模式同 `worldCupTracking.ts`）。
- **仍待联调确认**：`ruleContent` 渲染格式（当前纯文本）；`GET /api/activity/list` 本期不接入。
- **C 端字段映射（2026-07 dev 联调）**：任务卡片 `buttonStatus` 仅 `taskViews[]` 级保证下发，见 [engineering/campaign-api.md](../engineering/campaign-api.md)。
- **2026-07-04 口径补充**：详情 `displayStatus`/`currentTime`、奖励 `couponType`/`couponCode`、条件进度 `actionType`、排行榜 `rewardDescription`/`currentPage`/`pageSize`/`total` 已同步进 `yapiTypes.ts`/`mapYapiCampaign.ts`/`mapYapiTask.ts`（见 §0.0.2）；排行榜服务端分页（`pageNum`/`pageSize`）暂未接入，仍用 `displayLimit=100` + 前端本地分页。

## 0. YApi 当前版本（2026-06-26）

### 0.1 接口清单

#### Web 用户端（本期落地页）

| YApi ID | Method | Path | 标题 | 登录要求 |
|---------|--------|------|------|----------|
| 4126 | GET | `/api/activity/{campaignId}` | 查询活动详情 | 未登录可看公开信息；已报名用户返回任务进度 |
| 4129 | POST | `/api/activity/{campaignId}/join` | 报名参加活动 | 需要登录；已报名幂等成功 |
| 4132 | POST | `/api/activity/{campaignId}/refresh` | 手动刷新任务进度 | 需要登录 |
| 4135 | GET | `/api/activity/{campaignId}/progress` | 查询最新任务进度 | 需要登录；逻辑同 refresh |
| 4138 | POST | `/api/activity/reward/{rewardId}/claim` | 领取奖励 | 需要登录；领取前重校验进度 |
| 4141 | GET | `/api/activity/{campaignId}/my-record` | 查询我的活动奖励记录 | 需要登录 |
| 4144 | GET | `/api/activity/{campaignId}/ranking` | 查询活动排行榜 | 未登录可查榜；登录时标识当前用户行 |
| 5242 | GET | `/api/activity/list` | 查询活动列表 | 返回可展示公开活动列表（二期活动中心可复用；**本期 Web 落地页不接入**） |

#### 后台 / 报表（非 Web 落地页范围，仅登记）

| YApi ID | Method | Path | 标题 |
|---------|--------|------|------|
| 5221 | GET | `/growth/campaigns/list-stats` | 查询活动列表统计数据 |
| 5224 | GET | `/growth/campaigns/{campaignId}/overview` | 查询活动数据概览 |
| 5227 | GET | `/growth/campaigns/{campaignId}/trend` | 查询活动趋势数据 |
| 5248 | GET | `/growth/campaigns/{campaignId}/data-detail` | 查询活动数据详情 |
| 5251 | GET | `/growth/campaigns/{campaignId}/users/{uid}/detail` | 查询活动用户详情 |
| 5254 | GET | `/growth/campaigns/issue-records` | Query issue records |

### 0.1.1 通用约定

| 项 | YApi 2026-06-26 口径 |
|----|---------------------|
| Path 参数 | `campaignId` 或 `rewardId` |
| Header | `language` 必填，例如 `zh_CN` / `en_US`（以 `BaseAct#getLanguage` 为准） |
| 成功响应 | `code: "0"`（string）、`msg: string`、`succ: true`、`data: object \| array \| null` |
| 失败响应 | `code` 非 `"0"` 或 `succ: false`；前端优先展示 `msg` |
| 兼容字段 | `message` 可选，通常为空或不返回 |
| 网关前缀 | 前端 service 当前用 `/fe-ex-api/api/activity/*`；联调时以实际环境为准 |

### 0.2 核心字段

#### 活动详情 `GET /api/activity/{campaignId}`

```ts
interface GrowthActivityDetailDTO {
  visible: boolean
  serverTime: number // 毫秒时间戳，用于倒计时校准
  currentTime?: number // serverTime 别名，同值，2026-07-04 补充
  campaignId: string
  campaignName: string
  title: string
  subtitle: string
  ruleTitle: string
  ruleContent: string
  webBannerUrl: string
  appBannerUrl: string
  startTime: number // 可参与开始，毫秒时间戳
  endTime: number // 可参与结束，毫秒时间戳
  displayStartTime: number // 展示开始，毫秒时间戳
  displayEndTime: number // 展示结束，毫秒时间戳
  displayStatus?: 'NOT_STARTED' | 'ACTIVE' | 'ENDED' | 'OFFLINE' // 用户端展示状态，2026-07-04 补充；已下线活动按已结束口径返回
  alreadyJoined: boolean
  participantEligible: boolean
  participantConfigType:
    | 'ALL'
    | 'NEW_USER'
    | 'OLD_USER'
    | 'LIMITED_TAG'
    | 'LIMITED_USER_TYPE'
    | 'KYC'
    | 'REGION_EXCLUDE'
  rejectReason: string // 可参与时为 NONE；示例见 §0.3
  joinButtonStatus: 'HIDDEN' | 'CAN_JOIN' | 'JOINED' | 'LOGIN_REQUIRED' | 'BLOCKED'
  subActivityViews: GrowthActivitySubActivityView[]
  taskViews: GrowthActivityTaskView[] // 扁平任务列表，可不分子活动直接渲染
}
```

> **注意**：2026-06-26 版已**移除** `shareConfigJson`；分享链接由前端按活动 ID + 邀请码拼装（见 02 §10）。

子活动：

```ts
interface GrowthActivitySubActivityView {
  subActivityId: string
  subActivityName: string
  subActivityTitle: string
  sortNo: number
  taskViews: GrowthActivityTaskView[]
}
```

任务：

```ts
type GrowthTaskMode = 'SINGLE' | 'COMBINE' | 'LADDER' | 'ADVANCED' | 'RANKING'
type GrowthLogicType = 'AND' | 'OR'
type GrowthTriggerType = 'CLAIM' | 'AUTO_ON_COMPLETE' | 'MANUAL'
type GrowthTaskButtonStatus =
  | 'IN_PROGRESS'
  | 'CAN_CLAIM'
  | 'CLAIMED'
  | 'AUTO_ISSUE_PENDING'
  | 'OFFLINE_MANUAL'

interface GrowthActivityTaskView {
  taskGroupId: string
  taskGroupName: string
  taskMode: GrowthTaskMode
  logicType?: GrowthLogicType | null
  triggerType: GrowthTriggerType
  sortNo: number
  progressResult: GrowthActivityProgressResult
  conditionDefinitions: GrowthActivityConditionDefinition[]
  buttonStatus: GrowthTaskButtonStatus
  rewardIds: string[]
  rewards: GrowthActivityRewardView[]
}
```

> **注意**：2026-06-26 版已**移除** `displayConfigJson`。

任务进度：

```ts
interface GrowthActivityProgressResult {
  conditionProgresses: Array<{
    taskConditionId: string
    completed: boolean
    actionType?: string // 2026-07-04 补充；未完成时建议跳转动作，口径同 conditionDefinition.actionType
    currentValue: number
    targetValue: number
  }>
  taskModeResult: {
    completed: boolean
    completedConditionIds: string[]
    completedTierIds: number[]
    selectedTierId?: number | null
  }
}
```

任务条件：

```ts
type GrowthTaskConditionType =
  | 'REGISTER'
  | 'KYC_LEVEL'
  | 'TOTAL_DEPOSIT_USDT'
  | 'NET_DEPOSIT_USDT'
  | 'SPOT_VOLUME_USDT'
  | 'CONTRACT_VOLUME_USDT'
  | 'TOTAL_VOLUME_USDT'

type GrowthTaskConditionActionType =
  | 'GO_REGISTER'
  | 'GO_KYC'
  | 'GO_DEPOSIT'
  | 'GO_SPOT'
  | 'GO_CONTRACT'

interface GrowthActivityConditionDefinition {
  taskConditionId: string
  tierId?: number | null
  conditionName: string
  conditionSubtitle: string
  conditionType: GrowthTaskConditionType
  operator: 'GTE' | 'GT' | 'LTE' | 'LT' | 'EQ' | 'IN'
  actionType: GrowthTaskConditionActionType
  targetValue?: number | null
  unit: string
  sortNo: number
  startTime?: number | null // 毫秒时间戳
  endTime?: number | null // 毫秒时间戳
}
```

> **注意**：2026-06-26 版已**移除** `targetText`、`actionUrl`、`extConfigJson`。

奖励：

```ts
interface GrowthActivityRewardView {
  rewardId: string
  taskConditionId?: string | null
  tierId?: number | null
  rankStart?: number | null
  rankEnd?: number | null
  rewardName: string
  rewardType: 'COUPON' | 'CASH' | 'TRIAL_BONUS' | 'MANUAL'
  rewardAmount: number
  rewardUnit: string
  issueMode: 'CLAIM' | 'AUTO_ON_COMPLETE' | 'MANUAL'
  couponCode?: string | null // 卡券业务编码；真金/现金红包等卡券奖励也通过该编码发放
  couponType?: number | null // 2026-07-04 补充；卡券类型数值
  couponTypeName?: string | null // 2026-07-04 补充；卡券类型枚举名，例如 CONTRACT_BONUS/TRIAL_FEE_COUPON，展示以此字段为准
}
```

#### 报名 `POST /api/activity/{campaignId}/join`

```ts
interface GrowthJoinResult {
  success: boolean
  alreadyJoined: boolean
  rejectReason:
    | 'NONE'
    | 'ALREADY_JOINED'
    | 'NOT_LOGIN'
    | 'KYC_NOT_PASSED'
    | 'NOT_IN_AUDIENCE'
    | 'NOT_IN_PARTICIPATE_TIME'
}
```

#### 领取 `POST /api/activity/reward/{rewardId}/claim`

```ts
interface GrowthClaimResult {
  success: boolean
  alreadyClaimed: boolean
  rejectReason:
    | 'NONE'
    | 'ALREADY_CLAIMED'
    | 'NOT_COMPLETED'
    | 'CLAIM_PROCESSING'
    | 'UNSUPPORTED_ISSUE_MODE'
}
```

#### 刷新 / 进度 `POST refresh` · `GET progress`

```ts
interface GrowthProgressRefreshResult {
  campaignId: string
  uid: number
  taskResults: Array<{
    taskGroupId: string
    progressResult: GrowthActivityProgressResult
  }>
}
```

我的奖励记录 `GET /api/activity/{campaignId}/my-record`：

```ts
interface GrowthRewardFulfillmentRecord {
  id: number
  fulfillmentNo: string
  campaignId: string
  subActivityId: string
  uid: number
  taskGroupId: string
  taskConditionId?: string | null
  tierId?: number | null
  rewardId: string
  issueMode: 'CLAIM' | 'AUTO_ON_COMPLETE' | 'MANUAL'
  couponCode?: string | null
  idempotentKey?: string | null
  fulfillmentStatus: 'OFFLINE_MANUAL' | 'PENDING' | 'SUCCESS' | 'FAILED'
  claimTime?: string | null
  planIssueTime?: string | null
  issueTime?: string | null
  failReason?: string | null
  retryCount: number
  ctime?: string | null
  mtime?: string | null
}
```

排行榜 `GET /api/activity/{campaignId}/ranking`：

```ts
interface GrowthRankingQuery {
  taskGroupId?: string
  displayLimit?: number // 默认 100
  pageNum?: number // 2026-07-04 补充；默认 1，不传时仍兼容 displayLimit 口径
  pageSize?: number // 2026-07-04 补充；默认 20，不传时仍兼容 displayLimit 口径
}

interface GrowthRankingQueryResult {
  hasSnapshot: boolean
  snapshotBatchNo: string
  snapshotTime?: number | null // 毫秒时间戳
  taskGroupId?: string
  metricType?: string
  metricName?: string
  metricUnit?: string
  refreshIntervalMinutes?: number
  updateFrequencyText?: string
  lastUpdatedTime?: number // 毫秒时间戳；暂无真实批次时按 10 分钟整点兜底，避免前端展示 --
  rewardDescription?: string | null // 2026-07-04 补充；排行榜奖励说明文案，未配置可能为空
  currentPage?: number // 2026-07-04 补充；当前页码
  pageSize?: number // 2026-07-04 补充；每页条数
  total?: number // 2026-07-04 补充；排行榜总条数
  rows: GrowthRankingSnapshot[]
  currentUserRow?: GrowthRankingSnapshot | null
}

interface GrowthRankingSnapshot {
  campaignId: string
  taskGroupId: string
  uid: number
  maskedUid: string
  rankNo: number
  tradeVolumeUsdt: number
  metricValue: number
  metricValueText?: string
  snapshotBatchNo: string
  snapshotTime: number // 毫秒时间戳
}
```

活动列表 `GET /api/activity/list`（二期可复用）：

```ts
interface GrowthActivityListItem {
  campaignId: string
  serverTime: string // yyyy-MM-dd'T'HH:mm:ss（与详情接口时间类型不一致，接入时注意）
  campaignName: string
  title: string
  subtitle: string
  webBannerUrl: string
  appBannerUrl: string
  startTime: string
  endTime: string
  displayStartTime: string
  displayEndTime: string
  alreadyJoined: boolean
  participantEligible: boolean
  participantConfigType: string
  rejectReason: string
  joinButtonStatus: GrowthActivityDetailDTO['joinButtonStatus']
}
```

### 0.3 相较 2026-06-08 YApi 文档变更

| 项 | 2026-06-08 | 2026-06-26 | 前端处理 |
|----|------------|------------|----------|
| 接口数量 | 7 | Web 8（+`GET /api/activity/list`） | 列表接口本期不接入 |
| CommonResult | `code`/`msg`/`data` | +`succ: boolean`；成功 `code="0"` | service 层校验 `code` 与 `succ` |
| 详情时间字段 | `date-time` string | **毫秒 `number`** | mapper 改 `number`；倒计时用 `serverTime` 校准 |
| `serverTime` | 无 | **有**，毫秒 `number` | `useCampaignCountdown` 优先使用 |
| `shareConfigJson` | 详情返回 | **移除** | 分享链接前端拼装 |
| `displayConfigJson` | 任务字段 | **移除** | 删除 mapper 依赖 |
| 详情新增 | — | `ruleTitle`、`participantEligible`、`participantConfigType` | 规则标题、资格拦截 UI |
| `triggerType` | 含 `AFTER_ACTIVITY` | 仅 `CLAIM`/`AUTO_ON_COMPLETE`/`MANUAL` | 更新枚举 |
| `buttonStatus` | 含 `WAITING_SETTLEMENT` | 含 `OFFLINE_MANUAL`，无 `WAITING_SETTLEMENT` | 更新按钮态映射 |
| `rewardType` | 自由 string | `COUPON`/`CASH`/`TRIAL_BONUS`/`MANUAL` | 更新展示映射 |
| 排行榜 | 基础字段 | +`metric*`、`maskedUid`、`refreshIntervalMinutes`、`updateFrequencyText`、`lastUpdatedTime` | 排行榜 UI 对齐 |
| 报名/领取 rejectReason | 少量 | 扩充（见 §0.2） | toast / 拦截文案映射 |
| 列表接口时间 | — | `serverTime`/时间字段为 **string** date-time | 与详情 `number` 不一致，二期接入时注意 |

### 0.4 相较历史前端草案的关键差异

| 项 | 历史前端草案 (§1–§10) | YApi 2026-06-26 | 处理建议 |
|----|----------------------|-----------------|----------|
| 接口路径 | `/activity/landing/*` | `/api/activity/*` | service 按 YApi |
| 路由参数名 | `activityId` | `campaignId` | 页面保留 `activityId`，service 映射 |
| 时间格式 | 毫秒 + `serverTime` | 详情/排行榜为毫秒；列表为 string | 按接口分别解析 |
| 任务类型枚举 | `TIER`/`PROGRESSIVE`/`COMBO` | `LADDER`/`ADVANCED`/`COMBINE` | mapper 映射到 UI 类型 |
| 领取参数 | 多字段 body | 仅 `rewardId` path | mutation 按 `rewardId` |
| 排行榜分页 | `pageNum`/`pageSize` | `displayLimit` 默认 100 | 前端本地分页或后端扩展 |
| 分享信息 | `share` 对象 | 无专用字段 | 前端拼装链接 + 邀请码 |

### 0.5 相较 `feature/PR-01685-1` 代码差异

| 项 | 当前代码 (`yapiTypes.ts` / Mock) | YApi 2026-06-26 | 待改文件 |
|----|--------------------------------|-----------------|----------|
| `YapiCommonResult` | 无 `succ` | 有 `succ` | `yapiTypes.ts`、`campaign.ts` |
| 详情时间类型 | `string` date-time | `number` 毫秒 | `yapiTypes.ts`、`mapYapiCampaign.ts`、Mock |
| `serverTime` | 无 | 必填 | `yapiTypes.ts`、`useCampaignCountdown.ts` |
| `shareConfigJson` | 有 | 已移除 | 删除相关 mapper/Mock；分享改前端拼装 |
| `displayConfigJson` | 有 | 已移除 | 删除相关字段 |
| `ruleTitle` / `participantEligible` / `participantConfigType` | 无 | 有 | `yapiTypes.ts`、限制弹窗逻辑 |
| `rejectReason` 枚举 | 3 个领奖原因 | 报名/详情/领取各自扩充 | `yapiTypes.ts`、错误处理 |
| `triggerType` | 含 `AFTER_ACTIVITY` | 无 | `yapiTypes.ts` |
| `buttonStatus` | 含 `WAITING_SETTLEMENT` | 无 | `yapiTypes.ts`、`calc.ts` |
| 排行榜 | 缺 `maskedUid`、metric 元数据 | 已补充 | `yapiTypes.ts`、排行榜组件 |
| `GET /api/activity/list` | 未实现 | 已定义 | 本期可不接；二期活动中心用 |

### 0.6 仍需后端确认

- [x] 成功 `code` 值：YApi 明确为字符串 `"0"`，并返回 `succ: true`。
- [x] `serverTime`：详情接口已返回毫秒时间戳。
- [ ] 实际网关前缀是否与 `/fe-ex-api/api/activity` 一致（联调环境验证）。
- [ ] `displayStartTime` / `displayEndTime` 与 `startTime` / `endTime` 的前端展示与可参与边界（YApi 有字段描述，联调验证）。
- [ ] `joinButtonStatus=BLOCKED` 时 `rejectReason` 是否足够区分限定用户 / 受限地区 / 黑名单 / KYC（YApi 示例含 `NOT_IN_AUDIENCE`、`KYC_NOT_PASSED`，联调验证）。
- [x] 排行榜：2026-07-04 已补 `pageNum`/`pageSize`/`currentPage`/`total`；不传分页参数时仍兼容旧 `displayLimit` 口径，前端暂未接服务端分页（见 §0.0.2）。
- [ ] 活动规则正文渲染格式（`ruleContent` 纯文本 / HTML / Markdown）。
- [ ] 分享：无 `shareConfigJson` 后，邀请码来源是否仍走现有用户邀请体系。
- [ ] 列表接口与详情接口时间类型不一致（`string` vs `number`）是否为最终口径。
- [ ] 任务进度 / 排行榜 WebSocket：YApi 仍只有 refresh/progress/ranking；按轮询实现。

---

> ⚠️ **以下 §1–§10 为历史前端草案（YApi 之前的推导稿），已被上方 §0 取代，勿照此实现。**
> 保留原因：记录字段/路径演进与差异推导；其中 §1（能力优先级）、§9（埋点口径）、§10（后端确认清单）仍有参考价值，但接口形态一律以 §0 为准。

## 1. 前端需要的能力

| 能力 | 说明 | 优先级 |
|------|------|--------|
| 活动详情 | 活动头图、信息、状态、资格、子活动、任务组合、规则、分享配置 | P0 |
| 报名活动 | 点击“立即参与”报名 | P0 |
| 领取奖励 | 对可领取任务 / 档位触发领取 | P0 |
| 排行榜 | 排行榜任务分页、我的排名、更新时间 | P0 |
| 任务进度刷新 | 充值、交易、KYC 等用户实时进度 | P0 |
| 分享信息 | 邀请码、分享链接、分享渠道配置（Web 固定渠道也需邀请码） | P1 |
| 资格拦截 | 受限地区、限定用户、黑名单、KYC 前置校验 | P0 |
| 埋点 | 活动曝光、点击、报名、领取、分享、跳转等 | P1，需数据统计文档 |

## 2. 通用约定（待确认）

| 项 | 建议 |
|----|------|
| Base | 走现有 `fe-ex-api` / `getUrl` 封装 |
| 鉴权 | 详情可匿名；报名、领取、我的排名、个人进度需登录 |
| 活动 ID | 路由参数 `activityId` |
| 时间 | 毫秒时间戳；活动详情必须返回 `serverTime`、`startTime`、`endTime` 或等价字段，用于 Banner 倒计时、自动开启、自动结束 |
| 金额 | 字符串，单位 USDT；前端按币种精度/PRD 展示 |
| 错误码 | 需覆盖未登录、未 KYC、未报名、已领取、活动结束、受限用户、网络超时 |
| 多语言 | Web 初版 zh-CN；后端配置文案是否多语言待确认 |

## 3. GET 活动详情

**建议**：`GET /activity/landing/detail`

### Query

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | Y | 活动 ID |

### Response data 草案

```ts
interface CampaignDetailDTO {
  serverTime: number
  activity: {
    id: string
    status: 'NOT_STARTED' | 'ACTIVE' | 'ENDED' | 'OFFLINE'
    visible: boolean
    title: string
    subtitle?: string
    heroImageUrl?: string
    startTime: number
    endTime: number
    rules: string[] | string
    requiresKyc: boolean
    isJoined: boolean
    canJoin: boolean
    userEligibility: {
      allowed: boolean
      reason?: 'LIMITED_USER' | 'RESTRICTED_REGION' | 'BLACKLIST' | 'NEED_KYC'
    }
    share?: {
      title: string
      url: string
      inviteCode?: string
    }
    subActivities: CampaignSubActivityDTO[]
  }
}
```

### CampaignSubActivityDTO

```ts
interface CampaignSubActivityDTO {
  id: string
  title: string
  subtitle?: string
  tasks: CampaignTaskDTO[]
}
```

### CampaignTaskDTO

建议通过 `taskType` 区分五类任务：

```ts
type CampaignTaskTypeDTO = 'SINGLE' | 'TIER' | 'PROGRESSIVE' | 'COMBO' | 'RANKING'

interface CampaignTaskDTO {
  id: string
  type: CampaignTaskTypeDTO
  title?: string
  subtitle?: string
  reward?: RewardDTO
  issueMode: 'SYSTEM' | 'MANUAL'
  distributionType?: 'CLAIM' | 'AUTO'
  conditions?: ConditionDTO[]
  tiers?: TierDTO[]
  comboLogic?: 'AND' | 'OR'
  ranking?: RankingTaskDTO
  rewardStatus?: RewardStatusDTO
}
```

### ConditionDTO

```ts
interface ConditionDTO {
  id: string
  type: 'KYC' | 'NET_DEPOSIT' | 'TOTAL_DEPOSIT' | 'SPOT_VOLUME' | 'FUTURES_VOLUME'
  title: string
  subtitle?: string
  currentValue?: string
  targetValue?: string
  unit?: string
  completed: boolean
  action: 'KYC' | 'DEPOSIT' | 'SPOT' | 'FUTURES' | 'NONE'
}
```

### TierDTO

```ts
interface TierDTO {
  id: string
  level: number
  title?: string
  conditionGroupTitle?: string
  reward: RewardDTO
  conditions: ConditionDTO[]
  unlocked: boolean
  completed: boolean
  rewardStatus: RewardStatusDTO
}
```

### RewardDTO / RewardStatusDTO

```ts
interface RewardDTO {
  amount?: string
  currency?: string // default USDT
  couponName?: string
  rewardType?: 'CASH' | 'FUTURES_BONUS' | 'COUPON'
  displayText?: string
}

type RewardStatusDTO =
  | 'INCOMPLETE'
  | 'CLAIMABLE'
  | 'CLAIMED'
  | 'PENDING_ISSUE'
  | 'ISSUED'
  | 'ENDED'
```

## 4. POST 报名活动

**建议**：`POST /activity/landing/join`

### Body

```ts
{
  activityId: string
}
```

### Response

```ts
{
  joined: boolean
  joinedAt?: number
}
```

### 错误码需求

| 场景 | 前端表现 |
|------|----------|
| 未登录 | 跳登录 |
| 活动未开始 | 按钮仍未开始，提示以后端为准 |
| 活动已结束 | 按钮变已结束 |
| 需要 KYC | toast：该活动需先完成身份认证后，才可参与 |
| 非限定用户 / 受限地区 / 黑名单 | 强拦截弹窗 |
| 已报名 | 视为成功，按钮“已参与” |

## 5. POST 领取奖励

**建议**：`POST /activity/landing/reward/claim`

### Body

```ts
{
  activityId: string
  subActivityId: string
  taskId: string
  tierId?: string
  conditionId?: string
}
```

> 阶梯 / 进阶任务是否按 tierId 领取、单一 / 组合是否按 taskId 领取，需后端确认。

### Response

```ts
{
  claimId: string
  status: 'CLAIMED' | 'PENDING_ISSUE' | 'ISSUED'
  message?: string
}
```

### 错误码需求

| 场景 | 前端表现 |
|------|----------|
| 未登录 | 跳登录 |
| 未报名 | toast：请先点击【立即参与】报名活动后，即可参与 |
| 条件未完成 | 保持按钮状态，提示以后端为准 |
| 重复领取 | toast：奖励已领取；刷新详情 |
| 活动结束 | 按钮已结束 |
| 超时 | toast：领取请求已提交，请稍后在卡券中心中查看 |

## 6. GET 排行榜

**建议**：`GET /activity/landing/ranking`

### Query

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| activityId | string | Y | 活动 ID |
| taskId | string | Y | 排行榜任务 ID |
| pageNum | number | Y | 页码，从 1 |
| pageSize | number | Y | 固定 10 |

### Response

```ts
interface ActivityRankingDTO {
  myRank?: number | null
  myMetricValue?: string
  metricName: 'TOTAL_VOLUME' | 'SPOT_VOLUME' | 'FUTURES_VOLUME' | 'PROFIT' | 'LOSS'
  rewardDescription: string
  title: string
  updateFrequencyMinutes: number
  lastUpdatedAt: number
  baseThreshold?: string
  total: number
  list: Array<{
    rank: number
    uidMasked: string
    metricValue: string
  }>
}
```

### 展示规则

| 字段 | 规则 |
|------|------|
| 我的排名 | 未报名 / 未上榜展示 `-`；1000 名以上展示 `1000+` |
| 指标值 | 千分位，保留 2 位小数 |
| 排名 | 前三名显示 🥇🥈🥉 |
| 分页 | 一页 10 条；展示前五页和最后一页，中间省略号 |
| 空态 | 暂无数据 |

## 7. 倒计时与进度刷新

### 7.1 Banner 倒计时 / 自动开启 / 自动结束

Banner 活动信息区的倒计时不走 WebSocket。2026-06-16 评论已确认：服务端返回时间戳，客户端本地计算即可。服务端返回当前服务端时间戳和活动开始 / 结束时间戳后，客户端本地计算：

```ts
const serverOffset = serverTime - Date.now()
const now = Date.now() + serverOffset
```

前端每秒 tick 一次，根据 `now < startTime`、`startTime <= now < endTime`、`now >= endTime` 分别展示未开始、进行中、已结束。自然到点自动切换状态，不需要 WebSocket 推送。

### 7.2 任务进度 / 排行榜刷新

YApi 当前版本只看到 `refresh` / `progress` / `ranking` 接口，未看到 WebSocket 协议。任务进度和排行榜先按 React Query 轮询 / 手动刷新设计；如果后端后续明确提供 WebSocket，再接入推送并保留 30s 轮询降级。

| 方案 | 前端实现 |
|------|----------|
| 默认方案 | `progress` / `ranking` 轮询，必要时调用 `refresh` 手动刷新当前用户进度 |
| WebSocket 后续提供 | WebSocket 推送任务进度、排名等实时数据 |
| 断连 / 不可用 | React Query 30s 轮询详情和排行榜 |

若后端提供 WebSocket，消息建议至少包含：

```ts
{
  activityId: string
  type: 'TASK_PROGRESS_CHANGED' | 'RANKING_UPDATED' | 'ACTIVITY_CONFIG_CHANGED'
  payload: unknown
}
```

说明：`ACTIVITY_CONFIG_CHANGED` 只用于后台人工修改活动配置、下线等非自然时间变化；Banner 自然开启 / 结束仍由客户端本地时间计算完成。

## 8. 分享接口 / 邀请码

开发时由 Cursor AI 分析项目现有邀请 / 分享逻辑并沿用。Web 分享需要：

| 字段 | 说明 |
|------|------|
| inviteCode | 当前用户邀请码，未登录是否为空待确认 |
| shareUrl | 带 lang、activityId、utm_campaign、inviteCode 的链接 |
| shareTitle | 活动标题 |
| shareText | 活动标题 + 活动链接 + “请复制此链接，在浏览器中打开。” |

如果详情接口已返回 `share`，无需单独接口。

## 9. 埋点接口 / 事件

来源：`apps/web/docs_tdd/prds/PR-01685/inbox/lark-sync/activity-landing-page-qa.md`（2026-06-19 Lark CLI 只读同步）。

### 9.1 Web 前端埋点口径

| 口径 | 执行方式 |
|------|----------|
| 本文档处理范围 | 只处理 Web 前端埋点，不处理 App、后台、服务端埋点或业务事件 |
| Web 前端埋点 | 只负责“看了 / 点了”，记录页面浏览、按钮点击、分享、规则点击、任务按钮点击 |
| 成功结果 | 报名成功、任务完成、领奖成功、发奖成功不由 Web 前端埋点上报，以接口状态或服务端数据为准 |
| 活动串联字段 | Web 前端事件统一使用 `campaign_id` 串联；分享链接的 `utm_campaign` 入库时映射为 `campaign_id` |
| 报表边界 | 后台报表不直接读前端埋点明细，数据侧先聚合后提供后台接口 |

### 9.2 前端公共参数

| 字段 | 类型 | 必传 | 说明 / 枚举 |
|------|------|------|-------------|
| `campaign_id` | string | 是 | 活动 ID，所有事件和业务表统一使用 |
| `uid` | string | 登录后必传 | 用户 ID；未登录不传 |
| `device_id` | string | 是 | 未登录 UV 去重 |
| `platform` | string | 是 | 固定 `web` |
| `page_source` | string | 是 | `banner` / `entrance` / `push` / `share` |
| `activity_status` | string | 是 | `not_started` / `processing` / `ended` / `offline` |
| `sub_activity_id` | string | 任务场景必传 | 子活动 ID |
| `task_group_id` | string | 任务场景必传 | 任务组合 ID |
| `task_id` | string | 任务场景必传 | 任务条件 ID |
| `reward_id` | string | 奖励场景必传 | 奖励 ID |
| `timestamp` | number | 是 | 毫秒时间戳 |

### 9.3 前端埋点事件

| 事件 ID | 触发时机 | 必传参数 | 用于统计 |
|---------|----------|----------|----------|
| `activity_detail_page_view` | 活动详情接口成功后 | `campaign_id`, `activity_status`, `page_source`, `platform` | 活动页 PV / UV |
| `join_activity_click` | 点击“立即参与” | `campaign_id`, `is_login`, `kyc_status` | 参与意图 |
| `task_click` | 点击任务“去完成”按钮 | `campaign_id`, `sub_activity_id`, `task_group_id`, `task_id`, `button_type` | 任务引导点击 |
| `reward_claim_click` | 点击待领取按钮 | `campaign_id`, `reward_id`, `reward_type`, `reward_amount`, `task_id` | 领奖意图 |
| `share_click` | 点击分享 | `campaign_id`, `share_channel` | 分享行为 |
| `view_rules_click` | 点击活动规则 | `campaign_id` | 规则查看 |
| `activity_intercept_page_view` | 命中拦截弹窗 | `campaign_id`, `intercept_reason` | 不可参与原因 |

### 9.4 不处理项

| 不处理项 | 说明 |
|----------|------|
| App 埋点 | App 端事件、渠道差异、IP 差异不在 Web 开发范围 |
| 后台埋点 / 报表 | 后台页面、报表聚合、明细查询不在 Web 落地页范围 |
| 服务端业务事件 | 报名成功、任务完成、领奖成功、发奖成功、发奖失败等不由 Web 前端上报 |
| 发奖失败闭环 | 自动重试、人工处理、失败原因和操作日志由后端 / 发奖系统 / 后台承接 |

### 9.5 待开发时从项目中确认

- [x] Web 前端埋点上报 SDK / 方法名、是否已有统一封装。→ `posthog.capture`，封装见 `apps/web/src/apps/Campaign/common/campaignTracking.ts`
- [x] `device_id` 在 Web 端的来源。→ `storage.deviceId`
- [x] `page_source` 的入口映射规则。→ `resolveCampaignPageSource`：`page_source` / `utm_source` / `from`，默认 `entrance`
- [x] `is_login`、`kyc_status`、`button_type`、`share_channel`、`intercept_reason` 的最终枚举。→ 见 `campaignTracking.ts` 类型定义
- [x] 排行榜活动是否本期启用；若启用，需要确认 Web 前端是否新增点击类事件。→ 本期启用；排行榜点击走通用 `task_click`

## 10. 后端确认清单

- [ ] 最终 Swagger path、method、字段名。
- [ ] 活动详情是否完整返回子活动和任务树。
- [ ] 用户资格拦截是否在详情接口返回，还是单独接口。
- [ ] 活动未发布 / 下线 / 限制用户的错误码。
- [ ] 需要 KYC 的活动如何判断用户 KYC 状态。
- [ ] 报名接口是否幂等。
- [ ] 领取接口的唯一参数：taskId、tierId、conditionId 如何组合。
- [ ] 领取超时、重复领取、已发放、待发放错误码 / 状态码。
- [ ] 排行榜分页与总数、更新时间、更新频率字段。
- [x] Banner 倒计时是否需要 WebSocket：不需要；服务端返回时间戳，客户端本地计算。
- [ ] 任务进度 / 排行榜是否需要 WebSocket：YApi 当前只有 refresh / progress / ranking；若后端不提供 WebSocket，则按轮询 / 手动刷新实现。
- [ ] 分享链接和邀请码字段来源。
- [ ] 活动规则正文格式：纯文本、HTML、Markdown、富文本 JSON。
- [ ] 后端是否返回 `serverTime`、`startTime`、`endTime` 或等价字段。
