# PR-01685 真实接口 Playwright 验收（2026-06-27）

## 环境

| 项 | 值 |
|----|-----|
| URL | `http://localhost:4000/zh-CN/campaign/ACT-CODEX-20260624011448-DRAFT?mock=0` |
| API | `webapi.pfyys.com/fe-ex-api/api/activity` |
| 活动 ID | `ACT-CODEX-20260624011448-DRAFT` |
| 登录态 | 已登录（Chrome 扩展会话） |
| 工具 | Playwright MCP（`user-Playwright`） |

## 步骤与结论

| # | 步骤 | 结果 |
|---|------|------|
| 1 | 打开真实接口落地页 | ✅ Hero 标题 `Codex Admin API Test`，副标题、倒计时、Banner 正常 |
| 2 | 详情任务渲染 | ✅ 9 个任务（Single/Combine/Ladder/Advanced + 5 个 Ranking） |
| 3 | 排行榜数据 | ✅ 5 个榜均有 5 行数据（`10****30` 等 maskedUid） |
| 4 | 点击「立即参与」 | ✅ 报名成功，Hero + 底部 CTA 均变为「已参与」 |
| 5 | 点击「分享活动」 | ✅ 弹窗出现，链接含 `utm_campaign=ACT-CODEX-20260624011448-DRAFT` |
| 6 | 视口 1440 / 390 | ✅ 无横向溢出 |
| 7 | 领取流程 | ⏭ 当前无 `待领取` 任务（任务均未达标） |

## 发现问题

### ~~P1 — 多排行榜任务共用同一份 ranking 数据~~ ✅ 已修复

根因：`getCampaignRankingQuery` 把 `taskGroupId` 拼进 URL，但项目 fetcher 的 `searchStringGenerator` 会覆盖 URL query，需改用 `query: { taskGroupId, displayLimit }`。

修复后各榜指标：
- Ranking Task → 总交易量
- Spot Volume Ranking → 现货交易量
- Contract Volume Ranking → 合约交易量
- Profit Amount Ranking → 收益额
- Loss Amount Ranking → 亏损额

### P2 — 控制台非阻塞告警

- React Hydration mismatch（Footer，全站问题）
- `webapi.localhost` SSL 资源加载失败（全站）

与 Campaign 业务逻辑无直接关系。

## 后续

- ~~用 `ACT-CODEX-CLAIM-20260625011707` 测领取闭环~~ ✅ 见下方

---

## 领取活动验收（ACT-CODEX-CLAIM-20260625011707）

| 步骤 | 结果 |
|------|------|
| 打开 `?mock=0` | ✅ 标题 `Codex claim activity`，任务 120 USDT 合约赠金券 |
| 点击「立即参与」 | ✅ `POST .../join` 200，按钮变「已参与」 |
| 报名后任务状态 | ✅ 按钮变「待领取」（REGISTER 已达标） |
| 点击「待领取」 | ✅ `POST .../reward/161/claim` 200 |
| 领取后 | ✅ 按钮变「已领取」 |
