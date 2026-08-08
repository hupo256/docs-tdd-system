# PR-01685 真实接口 Playwright 自测报告（2026-06-28）

> 工具：Playwright MCP（系统 Chrome + 扩展，已登录态）· 全程 `?mock=0` 真实接口
> API：`https://webapi.pfyys.com/fe-ex-api/api/activity`
> 状态：**进行中**（领取动态闭环待后台造可领取活动后补完）

## 真实可用活动（来自 list 接口）

| campaignId | 标题 | 用途 | 本次状态 |
|---|---|---|---|
| `ACT-CODEX-SMOKE-20260625011432` | Codex smoke activity | 报名流程 | 未报名→实测报名✅ |
| `ACT-CODEX-20260624011448-DRAFT` | Codex Admin API Test | 主测(9任务+5榜) | 已参与，任务全未达标 |
| `ACT20260624150357` | 活动2 | 阶梯(LADDER) | 未报名，eligible |
| `ACT-CODEX-CLAIM-20260625011707` | Codex claim activity | 领取 | 此账号已领完 |

---

## 一、已验证通过

### A. 主活动渲染（ACT-CODEX-...DRAFT, mock=0）
- ✅ Hero：标题 `Codex Admin API Test`、副标题、倒计时 `25D`、Banner 正常
- ✅ 9 任务渲染：Single / Combine(AND) / Ladder / Advanced + 5×Ranking
- ✅ 5 个排行榜：数据正常、maskedUid 脱敏（`10****30`）、5 榜指标各不同（总/现货/合约交易量、收益额、亏损额）、前 3 名奖励、预估奖励列
- ✅ 分享弹窗：链接含 `utm_campaign=...`，复制/Telegram/WhatsApp/X 四渠道齐全

### A'. 真实 DTO 结构发现
- ✅ **DTO 同时返回 `subActivityViews` 和根级 `taskViews`（内容完全重复，9 任务各出现两次）**。mapper `resolveSubActivities` 优先用 subActivityViews、忽略根级，页面正确渲染 9 个，**去重逻辑正确无 bug**。

### B. 报名流程（ACT-CODEX-SMOKE, mock=0，实测）
- ✅ 点击「立即参与」→ `POST .../join` 200 `{success:true, alreadyJoined:false, rejectReason:NONE}`
- ✅ 报名后 Hero + 底部 CTA 同步变「已参与」(disabled)
- ✅ join 接口契约与 `joinResultSchema` / `isJoinMutationSuccess` 匹配

### C. 活动2（ACT20260624150357, mock=0）
- ✅ list 接口显示 `KYC_NOT_PASSED/eligible:false`（**未登录默认值**），但带 token 的 detail 返回 `eligible:true / rejectReason:NONE / CAN_JOIN`——当前账号实际合格
- ✅ 页面正确显示「立即参与」可点、无受限弹窗（与 detail 真实态一致，非 bug）
- ✅ 阶梯任务 stepper 两档金额 `1,000 / 100 USDT` 按 tierId 升序渲染，当前档条件「条件1」(KYC) + 「立即认证」按钮

---

## 二、已修复 BUG

### 🔴 P1 — 进阶任务无条件显示「可叠加领取」误导文案（已修复）
- **现象**：真实接口下进阶任务（Advanced Task）完全未达标（`0/100`、按钮「立即交易」），却显示 `阶段 1 — 可叠加领取`，误导用户以为有奖励可领。且阶梯任务无此文案，两者不对称。
- **根因**：上一轮 review 接入 `getProgressiveTierStates` 时，在 `TierTaskCard` 加了无条件静态文案 `{activeTier.title} — 可叠加领取`，Figma 设计稿无此文案。
- **修复**：移除该行。"可叠加"由行为（逐档领取、领完一档进下一档）体现，不靠静态文字。
- **验证**：真实接口重载后文案消失，进阶/阶梯卡渲染干净。

### 🔴 P0 — 阶梯/进阶档位「可领取」状态从真实接口丢失（已修复）
- **根因（API 契约变更）**：真实 detail 的 `taskModeResult` **不返回** `claimableTierId` / `claimableRewardIds`（类型定义里有、真实数据没有）；`rewards[]` 内**无 `buttonStatus`**。真实档位领取态改由 2026-06 新增的 `tierViews[].buttonStatus` / `tierViews[].completed` / `tierViews[].selected` 表达。
- **缺陷**：`mapTiers` 依赖 `claimableTierId`（永远 undefined）+ `task.buttonStatus`（任务级）推导档位态。当某档 `tierViews[].buttonStatus=CAN_CLAIM`、但任务级仍 `IN_PROGRESS`（还有更高档未完成）时，**该档可领状态丢失，按钮错误显示「去完成」而非「待领取」**，用户无法领取。
- **修复**：
  - [yapiTypes.ts](../../../../src/apps/Campaign/common/yapiTypes.ts)：新增 `YapiTierView` / `YapiConditionViewItem` 类型，`YapiTaskView` 补 `tierViews?` / `conditionViews?`。
  - [mapYapiTask.ts](../../../../src/apps/Campaign/common/mapYapiTask.ts) `mapTiers`：档位 `completed` / `buttonStatus` / `unlocked` **优先取 `tierViews[]`**，`taskModeResult` 仅作旧契约 / Mock 兜底。
- **验证**：用真实活动2 DTO 存为 fixture [`codex-ladder-tierviews.json`](../../../../src/services/api/campaign/__fixtures__/codex-ladder-tierviews.json)，新增 [campaign.realFixture.test.ts](../../../../src/services/api/campaign/campaign.realFixture.test.ts) 回归测试：模拟「tierViews[0].buttonStatus=CAN_CLAIM 但顶层 IN_PROGRESS」场景。**还原旧逻辑该测试失败、修复后通过**，确证 bug 真实存在且已修。

---

## 三、待验证项

### ✅ 领取动态闭环（ACT-CODEX-CLAIM，后端修数据后回归通过）
- 活动状态：已参与 + 任务「完成注册」按钮「待领取」(可点)，奖励 120 USDT 合约赠金券。
- 点击「待领取」→ `POST /reward/161/claim` → `{code:0, success:true, alreadyClaimed:false, rejectReason:NONE}`。
- **完整闭环通过**：toast「领取请求已提交，请稍后在卡券中心中查看」→ invalidate 刷新 → 按钮变「已领取」(disabled)。
- B1 门槛验证：该活动 active + eligible + reward=claimable，按钮正常放行可点，`canClickRewardButton` 行为正确。
- 历史插曲：首轮 claim 曾返回 `code:10001 系统异常`（后端造数据问题，前端已正确 toast「系统异常」容错）；**后端修复数据后回归成功**。

### 未触达场景（真实环境无法构造）
- 受限弹窗（restricted）：4 活动当前账号均 eligible，真实环境无受限态。
- 未登录跳转：当前 Chrome 为登录态；逻辑有单测覆盖。

---

## 四、接口覆盖清单

| 接口 | 方法 | 覆盖 | 备注 |
|------|------|------|------|
| `/list` | GET | ✅ | 4 活动，未登录态 joinButtonStatus=LOGIN_REQUIRED |
| `/{id}` detail | GET | ✅ | 主活动/活动2/claim/smoke 均拉取，含新字段 tierViews/conditionViews |
| `/{id}/join` | POST | ✅ | 冒烟活动实测 200 |
| `/{id}/ranking` | GET | ✅ | 主活动 5 榜全 200 |
| `/reward/{id}/claim` | POST | ✅ | claim 活动实测闭环通过（待领取→已领取）；后端修数据后 success |
| `/{id}/refresh` | POST | ⬜ | 未覆盖（页面无手动刷新入口） |
| `/{id}/progress` | GET | ⬜ | 未覆盖（需鉴权，页面默认 enabled:false） |
| `/{id}/my-record` | GET | ⬜ | 未覆盖（需鉴权，页面默认 enabled:false；直连返回未登录） |

---

## 五、控制台
- detail/ranking/join/claim 请求均 HTTP 200；页面级有少量全站既有告警（Hydration / SSL），与 Campaign 业务无关。

## 六、质量门
- 单测：`apps/web/src/apps/Campaign` + `services/api/campaign` 共 **87 passed**（含新增 2 个真实 fixture 回归测试）。
- typecheck：本次改动文件无错误。`campaign.test.ts:76`(cast) / `mockApi.ts:195`(Set 迭代) 两处为**既有错误**（撤回本次改动后仍存在），与本次无关，未擅自修改。
- biome：本次改动文件全部通过。
