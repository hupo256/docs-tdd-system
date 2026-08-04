# YApi 同步报告 — Growth Activity (cat_1205)

| 字段 | 值 |
|------|-----|
| 同步日期 | 2026-06-26 |
| YApi 项目 | `276` |
| 分类 | `1205` / Growth Activity |
| 来源 URL | http://35.240.211.100:3333/project/276/interface/api/cat_1205 |
| 接口总数 | 14（Web 用户端 8 + 后台报表 6） |
| 原始导出 | `interfaces/*.json`（YApi `/api/interface/get` 完整响应） |

## Web 用户端接口（本期落地页范围）

| YApi ID | Method | Path | 标题 |
|---------|--------|------|------|
| 4126 | GET | `/api/activity/{campaignId}` | 查询活动详情 |
| 4129 | POST | `/api/activity/{campaignId}/join` | 报名参加活动 |
| 4132 | POST | `/api/activity/{campaignId}/refresh` | 手动刷新任务进度 |
| 4135 | GET | `/api/activity/{campaignId}/progress` | 查询最新任务进度 |
| 4138 | POST | `/api/activity/reward/{rewardId}/claim` | 领取奖励 |
| 4141 | GET | `/api/activity/{campaignId}/my-record` | 查询我的活动奖励记录 |
| 4144 | GET | `/api/activity/{campaignId}/ranking` | 查询活动排行榜 |
| 5242 | GET | `/api/activity/list` | 查询活动列表 |

## 后台 / 报表接口（非 Web 落地页范围，仅登记）

| YApi ID | Method | Path | 标题 |
|---------|--------|------|------|

## 相较 2026-06-08 文档的主要变更

| 项 | 旧版 (2026-06-08) | 新版 (2026-06-26) |
|----|------------------|------------------|
| 接口数量 | 7 | Web 8（新增 `GET /api/activity/list`） |
| CommonResult | `code` / `msg` / `data` | 增加 `succ: boolean`；成功 `code="0"` |
| 详情时间字段 | `date-time` 字符串 | **毫秒时间戳 `number`**（`startTime`/`endTime`/`displayStartTime`/`displayEndTime`） |
| `serverTime` | 未见 | **已补充**，毫秒时间戳 |
| `shareConfigJson` | 详情返回字符串 | **已移除**；分享链接需前端拼装 |
| `displayConfigJson` | 任务视图字段 | **已移除** |
| 详情新增字段 | — | `ruleTitle`、`participantEligible`、`participantConfigType` |
| 排行榜 | 基础 rows | 增加 `metricType/Name/Unit`、`refreshIntervalMinutes`、`updateFrequencyText`、`lastUpdatedTime`、`maskedUid`、`metricValueText` |
| 报名/领取 rejectReason | 少量枚举 | 扩充（见 `03-api-contract.md` §0.3） |
| 活动列表 | 无 | 新增 `GET /api/activity/list`（二期活动中心可复用） |

## 下一步

1. 按本报告更新 `product/03-api-contract.md` §0。
2. 校准 `feature/PR-01685-1` 的 `yapiTypes.ts` / `mapYapiCampaign.ts` / Mock。
3. 关闭 `product/06-collaboration.md` §7 中已由 YApi 明确的项。
