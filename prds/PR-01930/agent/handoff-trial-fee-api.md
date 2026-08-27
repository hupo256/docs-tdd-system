# Handoff：体验金失效链路 API 口径问题（PR-01930 → 后端）

> 状态：前端已回滚"前端凑数"式修复，恢复为忠实透出后端字段；以下为需后端确认/修复的口径问题。
> 登记：`agent/blockers.json`（BLK-1/2/3）。日期 2026-08-26。

## 背景

体验金手动失效相关的多个前端展示 bug，经数据链定位，根因均在**后端返回字段本身**，前端仅展示。此前 Codex/Claude 曾在前端用其它字段做减法反推/文案匹配来"修正"展示值（commit 3b26d311eb / 284261ae48 / c040169116），已按"后端根因不在前端凑数"原则回滚，改为本 handoff 移交后端。

## BLK-1　`manualInvalidSummary.availableTrialFee` 漏计未激活体验金

- **接口**：`GET /operate-api/trialFee/manualInvalidSummary`（YAPI 6031）
- **前端展示点**：后台「确认体验金失效操作（不可逆）」弹窗 → 「◆ 可用体验金」
- **用户看到的错误值**：可用体验金少了"未激活但可立即回收"的部分。
- **API 实际返回**：`availableTrialFee` 仅含已激活可用部分（据现象推断，需后端确认口径）。
- **期望值 / 契约**：产品口径「可用体验金 = 立即失效部分」应包含未激活但会被立即回收的体验金。
- **数据链首个出错位置**：API 响应 `availableTrialFee` 字段（前端 `ConfirmInvalidateModal.tsx` 仅 `amount(preview.availableTrialFee)` 原样展示，无计算）。
- **请后端确认**：`availableTrialFee` 是否应含未激活部分；若是，请在接口侧修正或新增字段明确区分。

## BLK-2　`manualInvalidSummary.affectedTotalAmount` 构成口径待定稿

- **接口 / 展示点**：同上 → 「影响总金额」
- **争议**：`affectedTotalAmount` 是否包含 `positionOccupiedAmount`（仓位占用）？
  - 产品提示语称"仓位占用不自动平仓、单独展示"，暗示不计入总额；
  - 但曾观察到总额疑似含仓位占用（前端一度用 `total − positionOccupied` 反推，已回滚）。
- **期望**：请后端明确 `affectedTotalAmount` 的确切构成（是否含仓位占用 / 未激活），并保证与各分项字段自洽。前端不做任何加减，按后端字段原样展示。

## BLK-3　体验金失效后 prize 接口 `status` 是否下发失效枚举（需证据）

- **展示点**：C 端「我的奖励」体验金卡片（`MyRewards/components/RewardCard.tsx`）
- **现象**：未领取体验金被手动失效后，卡片仍显示「可领取」。
- **前端已做**：移除了 `status ?? Unused` / `Number(...) : Unused` 的**假默认**（未知状态曾被错误默认为"可领取"），此为正当前端修复，已保留。
- **待后端证据**：失效后 prize 列表接口该记录的 `status` 字段**实际返回什么**？
  - 若返回明确的失效枚举（Expired）→ 前端只依据 `status` 即可，将删除现有对展示文案 `couponStatusText === '已过期'` 的反推分支（该分支是同族猜测，暂挂起）。
  - 若 `status` 不下发失效态（仍为可领取/空）→ 属**后端缺陷**，请后端在失效后正确回写 `status`。
- **数据链首个出错位置**：待 Network 证据确认在 API 响应还是前端映射。

## 复审项（非阻塞）：合约保证金率前端过滤失效体验金记录

- **代码**：`apps/web/src/apps/Futures/utils/marginRate.ts`（commit 29f7a17679）
- **现状**：前端以 `endTime < now` 过滤已失效体验金记录后再汇总，避免失效体验金虚增分母导致保证金率显示 `--`。**保留，未回滚**（`endTime` 是真实字段，属前端正当业务解释权）。
- **请后端答复**：体验金被手动失效后，为何 `trialFeeRecordList` 仍下发该记录？是否应移除或置失效标记？据答复决定该过滤长期归属（前端业务规则 vs 后端应不下发）。

## 前端处置结论

- 三处"前端凑数"修复已回滚 / 拆分处理，弹窗与卡片恢复忠实展示后端数据。
- 上述 BLK-1/2/3 为后端根因，前端不再自行补偿；请后端修复或明确契约后，前端按新契约对齐。
