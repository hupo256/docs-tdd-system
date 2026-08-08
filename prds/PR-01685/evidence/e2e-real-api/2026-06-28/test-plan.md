# PR-01685 真实接口 Playwright 自测计划（2026-06-28）

> 状态：**计划 / 待执行**（重启 session 加载 Playwright MCP 后开跑，跑完原地回填「结果」列）
> 触发原因：API 有更新 + 本地接入了 calc.ts 业务规则函数（阶梯最高档 / 进阶逐档可叠加 / 领取按钮活动状态门槛），需完整回归一次。
> 关联规范：[../../../../common/browser-e2e-mcp.md](../../../../../common/browser-e2e-mcp.md)（默认不截图，文字报告为主）

## 环境

| 项 | 值 |
|----|-----|
| 真实接口 URL | `http://localhost:4000/zh-CN/campaign/ACT-CODEX-20260624011448-DRAFT?mock=0` |
| 领取闭环 URL | `http://localhost:4000/zh-CN/campaign/ACT-CODEX-CLAIM-20260625011707?mock=0` |
| API | `webapi.pfyys.com/fe-ex-api/api/activity` |
| 登录态 | 已登录（Chrome 扩展会话） |
| 工具 | Playwright MCP（`user-Playwright`，`--extension`） |
| dev 服务 | 已确认在跑（4000 LISTEN，落地页返回 200） |
| mock 兜底 | `?mock=1&scenario=<name>` 切场景，无需重启 dev |

## 前置（已完成，无需浏览器）

| 项 | 结果 |
|----|------|
| Playwright MCP 镜像到 Claude Code 用户配置 | ✅ `claude mcp list` → `✔ Connected` |
| Campaign 单测 | ✅ 58 passed |
| Campaign API 全场景 Vitest（`apps/web/src/services/api/campaign`） | ✅ 27 passed |
| typecheck（Campaign 范围） | ✅ 无错误 |

---

## A. 真实接口主流程回归（mock=0）

对照 2026-06-27 报告矩阵，确认 API 更新后无回归。

| # | 步骤 | 预期 | 结果 |
|---|------|------|------|
| A1 | `browser_navigate` 打开真实接口落地页 | Hero 标题 / 副标题 / 倒计时 / Banner 正常 | ⬜ |
| A2 | `browser_snapshot` 详情任务渲染 | 任务全部渲染（上次为 9 个：Single/Combine/Ladder/Advanced + 5 Ranking），**注意 API 更新后任务数/类型可能变化，如实记录** | ⬜ |
| A3 | 排行榜数据 | 各 Ranking 榜有数据、maskedUid 脱敏（如 `10****30`）、5 榜指标各不相同（总/现货/合约交易量、收益额、亏损额） | ⬜ |
| A4 | 点击「立即参与」 | `POST .../join` 200，Hero + 底部 CTA 同步变「已参与」(disabled) | ⬜ |
| A5 | 点击「分享活动」 | 弹窗出现，链接含 `utm_campaign=ACT-CODEX-20260624011448-DRAFT` | ⬜ |
| A6 | 视口 1440 / 390 | 无横向溢出（`browser_resize` 后 snapshot 核对） | ⬜ |
| A7 | 控制台 | 记录 error/warn；区分 Campaign 业务问题 vs 全站已知（Hydration / webapi.localhost SSL） | ⬜ |

---

## B. 本次改动重点回归（核心）

本次接入 calc.ts 规则函数、修了 3 处行为，必须逐一验证。真实接口若无对应达标数据 → 用 mock 场景兜底覆盖。

### B1. 领取按钮的活动状态门槛（`canClickRewardButton`）

改动：`ConditionActionRow` 由「只看 reward.status」改为「`status===active && userEligible && reward∈{incomplete,claimable}`」。

| 场景 | 入口 | 预期 | 结果 |
|------|------|------|------|
| 进行中 + 可领取 | 真实 claim 活动 / `?mock=1&scenario=claimable` | 「待领取」按钮 primary 可点 | ⬜ |
| 已结束 | `?mock=1&scenario=ended` | 任务按钮 muted **不可点**（即使 reward 曾 claimable） | ⬜ |
| 受限用户 | `?mock=1&scenario=restricted` | 受限弹窗弹出；任务按钮 muted 不可点 | ⬜ |
| 受限弹窗关闭后不复弹 | `restricted` 场景手动关闭弹窗，**等 ≥30s**（detail query refetch 周期） | 弹窗**不再自动弹回**（本次 `hasAutoOpenedRestriction` 修复点） | ⬜ |

### B2. 阶梯任务「按最高档发放，不叠加」（`getHighestClaimableTier`）

改动：阶梯卡由 `find(第一个 claimable)` 改为取**最高**可领档。

| 场景 | 入口 | 预期 | 结果 |
|------|------|------|------|
| 多档同时可领 | `?mock=1&scenario=showcase`（阶梯任务第 1 档已领、第 2 档待领）或真实达标数据 | Stepper 高亮 + 条件行指向**最高**可领档，不是最低档 | ⬜ |
| 仅低档可领 | showcase / 真实 | 高亮该档，行为正常 | ⬜ |

### B3. 进阶任务「逐档解锁，可叠加领取」（`getProgressiveTierStates`）

改动：进阶卡按逐档状态找第一个可领档，已领档（claimed）自动跳到下一可领档。

| 场景 | 入口 | 预期 | 结果 |
|------|------|------|------|
| 进阶第 2 阶段待领 | `?mock=1&scenario=showcase`（进阶 tiers[1] claimable） | 显示「阶段 N — 可叠加领取」，指向可领档 | ⬜ |
| 领完第 1 档继续领第 2 档 | showcase / 真实 | 第 1 档 claimed 后不挡第 2 档领取 | ⬜ |

---

## C. 领取闭环（真实接口，ACT-CODEX-CLAIM）

复用 2026-06-27 已跑通路径，确认 API 更新后仍闭环。

| # | 步骤 | 预期 | 结果 |
|---|------|------|------|
| C1 | 打开 claim 活动 `?mock=0` | 标题 `Codex claim activity`，任务含赠金券 | ⬜ |
| C2 | 点「立即参与」 | `POST .../join` 200，按钮变「已参与」 | ⬜ |
| C3 | 报名后任务态 | REGISTER 达标 → 按钮变「待领取」 | ⬜ |
| C4 | 点「待领取」 | `POST .../reward/<id>/claim` 200 | ⬜ |
| C5 | 领取后 | 按钮变「已领取」(disabled) | ⬜ |

---

## D. Figma L2 并排（重要 UI，按需）

仅对本次改动触达的卡片做 L2 复核（[07-figma-spec](../../../product/07-figma-spec.md)）：

| 模块 | Figma 节点 | 核对点 | 结果 |
|------|-----------|--------|------|
| 阶梯卡 Stepper | `4057:594` / `3122:281` | 高亮档随「最高可领档」变化，连线进度正确 | ⬜ |
| 进阶卡 | `3259:775` | 「可叠加领取」文案 + 档位状态 | ⬜ |
| 任务按钮 | §7.2 | 可用/不可用两态与门槛一致 | ⬜ |

---

## 执行顺序

1. **重启 session** → 确认 `mcp__Playwright__*` 工具可用。
2. A（真实主流程）→ 若任务结构随 API 变化，如实更新 A2。
3. B（重点改动）→ 真实数据不足处立即切 mock 场景兜底。
4. C（领取闭环）。
5. D（按需 L2）。
6. 回填本表所有 ⬜ → ✅/❌/⏭，新建 `evidence/e2e-real-api/2026-06-28/README.md` 写最终结论 + 残留风险；本计划文件保留为执行记录。
7. 临时截图（如有）用完即删，不入 git。

## 已知风险

- **达标数据依赖真实账号**：阶梯/进阶多档 claimable、领取流程依赖账号实际达标。真实接口达标不足时，B2/B3 用 `?mock=1&scenario=showcase`、B1 用 `ended`/`restricted` 覆盖，并在结果中标注「真实数据未覆盖，已用 mock 场景验证」。
- **API 更新影响面未知**：A2 任务数/类型、字段映射可能变化；以实际 snapshot 为准，发现 mapper 不匹配立即记录并定位。
