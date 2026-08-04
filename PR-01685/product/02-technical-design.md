# 02 — 技术方案（Web）

## 1. 原则

遵循 `apps/web/docs_tdd` 通用规则：

- feature-first：业务代码集中在 `apps/web/src/apps/Campaign/`。
- 薄路由：`apps/web/src/app/[lang]/...` 只负责 metadata、参数读取和挂载页面组件。
- service-layer：所有接口放 `apps/web/src/services/api/campaign/`。
- React Query 管理服务端状态；组件内禁止裸 `fetch`。
- Zustand 仅用于本地 UI/session 状态；不重复存接口数据和派生数据。
- API 原始类型通过 mapper 转为 UI 领域模型；组件不直接依赖后端结构。
- 关键计算、状态推导、mapper 补单测。
- 开发期 i18n 仅维护 `zh-CN`。

## 2. 路由方案（已确认）

负责人已确认 Web 路由采用：

```text
/campaign/[activityId]
```

预期文件：

```text
apps/web/src/app/[lang]/(with-header)/(with-footer)/campaign/[activityId]/page.tsx
```

需新增常量：

```text
apps/web/src/constants/pathnames.ts
CAMPAIGN_DETAIL = '/campaign/[activityId]'
```

> 若运营 Banner 已有固定跳转规范，应以现有运营系统路径为准。

## 3. 目录结构建议

> ℹ️ 下方为设计期建议结构。`feature/PR-01685-1` 实际实现做了收敛：弹窗合并为 `components/CampaignModals.tsx`，五种任务卡合并为 `components/TaskCards.tsx`，未拆 `tasks/` 子目录；hooks 仅保留 `useCampaignCountdown` / `useCampaignBottomCta`。实际落点以 [README § 分支与代码基线](../README.md#分支与代码基线) 为准。

```text
apps/web/src/apps/Campaign/
├── index.tsx                              # 页面容器：拉取详情、组装 UI
├── AGENTS.md                              # 模块内规则（可选，确认开发后创建）
├── common/
│   ├── types.ts                           # UI 领域模型、枚举
│   ├── calc.ts                            # 倒计时、进度、按钮 label/disabled、可领取状态
│   ├── format.ts                          # 金额/时间/排名/UID 脱敏格式化
│   ├── routeActions.ts                    # KYC/充值/现货/合约跳转映射
│   └── constants.ts                       # 轮询间隔、分页大小、锚点 id
├── hooks/
│   ├── useCampaignCountdown.ts             # 倒计时；服务端时间戳 + 客户端本地 tick
│   ├── useCampaignBottomCta.ts             # 滚动阈值控制底部浮层
│   ├── useCampaignGuard.ts                 # 限制用户弹窗 / 登录 / KYC 前置判断
│   └── useCampaignLayout.ts                # 可选：封装响应式布局 + safe area
├── components/
│   ├── CampaignSkeleton.tsx
│   ├── CampaignHero.tsx                    # 头图 + 活动信息 + CTA + 分享/奖励/规则
│   ├── CampaignStatusCta.tsx               # 主按钮 / 底部浮层复用
│   ├── CampaignRestrictionModal.tsx
│   ├── CampaignRuleSection.tsx
│   ├── CampaignBottomCta.tsx
│   ├── CampaignShareModal.tsx              # 分享弹窗；Figma 9489:136733 / 802
│   ├── CampaignSubActivitySection.tsx
│   └── tasks/
│       ├── TaskRenderer.tsx                # 按 taskType 分发
│       ├── SingleTaskCard.tsx
│       ├── ComboTaskCard.tsx
│       ├── TierTaskCard.tsx
│       ├── ProgressiveTaskCard.tsx
│       ├── RankingTaskCard.tsx
│       ├── ConditionItem.tsx
│       ├── RewardBadge.tsx
│       ├── TaskActionButton.tsx
│       ├── TierStepper.tsx
│       └── RankingTable.tsx
└── __tests__ 或同目录 *.test.ts
```

服务层：

```text
apps/web/src/services/api/campaign/
├── campaign.ts             # React Query hooks / mutations
├── schemas.ts              # Zod schema + API 类型
├── mapCampaignDetail.ts    # API → UI 领域模型
└── campaign.test.ts        # 参数构造 / schema / mapper 测试
```

## 4. 数据流

```mermaid
flowchart TB
  Route[campaign/[activityId]/page.tsx]
  Page[Campaign/index.tsx]
  DetailQ[useCampaignDetailQuery]
  Mapper[mapCampaignDetail]
  Hero[CampaignHero]
  Sub[CampaignSubActivitySection]
  Task[TaskRenderer]
  Claim[useClaimCampaignRewardMutation]
  Signup[useJoinCampaignMutation]
  RankQ[useCampaignRankingQuery]

  Route --> Page
  Page --> DetailQ --> Mapper --> Page
  Page --> Hero
  Page --> Sub --> Task
  Hero --> Signup
  Task --> Claim
  Task --> RankQ
```

## 5. UI 领域模型草案

> 最终以 Swagger 为准。前端组件依赖 UI 类型，不依赖 API 原始字段。

```ts
export enum CampaignStatus {
  notStarted = 'notStarted',
  active = 'active',
  ended = 'ended',
}

export enum ActivityTaskType {
  single = 'single',
  tier = 'tier',
  progressive = 'progressive',
  combo = 'combo',
  ranking = 'ranking',
}

export enum ActivityConditionType {
  kyc = 'kyc',
  netDeposit = 'netDeposit',
  totalDeposit = 'totalDeposit',
  spotVolume = 'spotVolume',
  futuresVolume = 'futuresVolume',
}

export enum ActivityRewardStatus {
  incomplete = 'incomplete',
  claimable = 'claimable',
  claimed = 'claimed',
  pendingIssue = 'pendingIssue',
  issued = 'issued',
  ended = 'ended',
}
```

核心模型：

```ts
export interface CampaignView {
  id: string
  title: string
  subtitle?: string
  heroImageUrl?: string
  startTime: number
  endTime: number
  status: CampaignStatus
  isJoined: boolean
  requiresKyc: boolean
  userEligible: boolean
  restrictionReason?: 'limitedUser' | 'restrictedRegion' | 'blacklist'
  rules: string[] | string
  subActivities: SubActivityView[]
  share: CampaignShareView
}

export interface SubActivityView {
  id: string
  title: string
  subtitle?: string
  tasks: ActivityTaskView[]
}
```

## 6. 状态分层

| 数据 | 存放 | 说明 |
|------|------|------|
| 活动详情 | React Query | `useCampaignDetailQuery(activityId)` |
| 排行榜 | React Query | 可独立 query，按页和 taskId 缓存 |
| 报名 / 领取请求状态 | React Query mutation | 成功后 invalidate 活动详情和相关任务/排名 |
| 当前倒计时 / 活动状态切换 | hook 本地 state | 基于 `serverTime`、`startTime`、`endTime` 与本地 tick 计算，不进 store，不依赖 WebSocket |
| 底部浮层显示 | hook 本地 state | 滚动阈值触发，避免本地滚动场景下显示状态抖动 |
| 派生按钮状态 | `calc.ts` 纯函数 | 根据 activity/task/condition/reward 状态计算 |

禁止：

- 把活动详情接口数据复制进 Zustand。
- 用 `useEffect` 将派生按钮状态同步进 store。
- 在任务组件中直接拼 API 原始字段。

## 7. 请求刷新策略

Banner 活动信息区的倒计时、自动开启、自动结束不使用 WebSocket。2026-06-16 评论已确认：服务端返回时间戳，客户端本地按时间计算即可。实现上优先使用后端返回的 `serverTime` 计算 `serverOffset = serverTime - Date.now()`，再用本地每秒 tick 推导当前展示状态；YApi 当前版本暂未看到 `serverTime`，若后端不补该字段，则前端只能按客户端时间解析 `startTime` / `endTime`，并在联调记录时间偏差风险。

任务进度、排行榜等实时性需求优先按 YApi 当前的 `refresh` / `progress` / `ranking` 接口实现轮询或手动刷新；如果后端后续提供 WebSocket 协议，再接入推送并保留 30s 轮询降级。

| 场景 | 策略 | 备注 |
|------|----------|--------|
| Banner 倒计时 / 自动开启 / 自动结束 | 优先服务端时间校准；无 `serverTime` 时用客户端时间兜底 | 不走 WebSocket；缺 `serverTime` 时记录风险 |
| 任务进度 | YApi `progress` 轮询 + 必要时 `refresh` 手动刷新 | WebSocket 若后续提供再接入 |
| 排行榜 | 独立 query，30s 或后端返回更新频率 | 更新频率字段 |
| 报名成功 | invalidate 活动详情 | — |
| 领取成功 / 超时 | invalidate 活动详情；超时按 PRD toast | 幂等错误码 |

## 8. API 文档 → Mock 联调策略

YApi 当前版本已整理到 [03-api-contract.md §0](./03-api-contract.md#0-yapi-当前版本2026-06-08)。继续开发时先比对当前 Mock/service 与 YApi 的路径、字段、枚举、错误码、分页和时间单位差异，再校准 Mock、schema、mapper 和真实 service。

| 步骤 | 要求 | 产物 |
|------|------|------|
| 1. 解析 YApi 当前版本 | 按 `03-api-contract.md` §0 确认字段名、枚举、错误码、分页、时间单位，并列出与当前 Mock/service 的差异 | 更新 `03-api-contract.md` 差异 |
| 2. 生成类型与 schema | 按最终字段维护 Zod schema、DTO 类型、UI 领域类型、mapper | `services/api/campaign/schemas.ts`、`mapCampaignDetail.ts` |
| 3. 生成 Mock 数据 | 覆盖活动状态、用户状态、五种任务、排行榜、分享、异常态 | `apps/web/src/apps/Campaign/mock/` 或服务层 mock 文件 |
| 4. Mock 场景矩阵 | 每个场景有稳定入口，可通过 query/env 切换 | `mockScenarios.ts`、本地调试说明 |
| 5. Mock 联调 | 页面只消费 React Query/service 层，不在组件里写死假数据 | Browser/Playwright 可直接跑 Mock 场景 |
| 6. 切真实 API | Mock 与真实 API 共用 mapper 和 UI 类型，避免两套 UI 数据结构 | 差异确认后切真实接口；删除生产默认 Mock 开关 |

### 8.1 必备 Mock 场景

| 场景 | 覆盖内容 |
|------|----------|
| 未登录访问 | 页面可浏览，点击参与跳登录，任务按钮提示报名前置 |
| 未报名进行中 | 主 CTA 可报名，报名成功后刷新为已参与 |
| 已报名部分完成 | 单一、组合、阶梯、进阶任务的进度与按钮态 |
| 已报名全部完成 | 待领取、领取中、已领取、待发放、已发放 |
| 未开始 / 已结束 / 已下线 | 主 CTA、倒计时、任务按钮、规则区 |
| KYC 前置失败 | 点击参与 toast，任务跳转受限 |
| 受限用户 | 强拦截弹窗，遮罩不可关闭，关闭动作返回上一页 |
| 排行榜 | 我的排名 `-` / `1000+` / 正常排名、分页、空态 |
| 分享 | 活动链接、邀请码、复制成功、渠道点击 |
| 接口异常 | 首屏失败、局部刷新失败、领取超时、重复领取 |

## 9. 跳转动作映射

| 后台动作 | Web 跳转建议 | 待确认 |
|----------|--------------|--------|
| 去 KYC | 用户身份认证页 | 现有 KYC 路由常量需确认 |
| 去充值 | `/assets/spot` 或充值弹窗/页 | PRD 写 `/balance/trade/deposit`，需映射现有 Web 路由 |
| 去现货 | `/trade/BTC_USDT` 或项目实际 symbol | 现货 symbol 格式 |
| 去合约 | `/swap/BTCUSDT` 或项目实际 symbol | 合约 symbol 格式 |
| 我的奖励 | `/my-rewards` 或 `/orders/coupon-record` | PRD 写卡券中心，常量有两处候选 |

> 跳转路径不再向负责人单独确认。开发时由 Cursor AI 在项目中分析现有 KYC、充值、现货、合约、卡券中心路由逻辑，并沿用现有实现。

## 10. 分享弹窗（Figma 已确认）

Figma 规格见 [07-figma-spec.md §4.10](./07-figma-spec.md)。

| 项 | 规格 |
|----|------|
| 组件 | `CampaignShareModal.tsx` |
| 宽度 | 400px |
| 变体 A | 链接文本区 + 复制 / Telegram / WhatsApp / X（`9489:136733`） |
| 变体 B | 链接文本区 + 底部全宽按钮（`9489:136802`） |
| 顶栏 | 复用 `.MOL/header400` 样式（高 60px） |
| 参考实现 | `apps/web/src/apps/CopyTrading/components/Modals/ShareEarnModal.tsx` |

分享链接与邀请码数据需求：

待确认分享链接格式。PRD 写法为：

```text
https://www.fameex.com/zh-CN + utm-campaign=活动ID + 邀请码
```

建议规范为：

```text
https://www.fameex.com/{lang}/campaign/{activityId}?utm_campaign={activityId}&inviteCode={inviteCode}
```

## 11. 错误处理

| 场景 | 处理 |
|------|------|
| 首屏详情失败 | 展示错误态 + 重试按钮 |
| 局部刷新失败 | 保留旧数据，toast 或轻提示 |
| 领取 API 超时 | toast：领取请求已提交，请稍后在卡券中心中查看 |
| 重复领取 | toast：奖励已领取；刷新详情 |
| 活动不可见 | 依据后端错误码展示 404 / 已结束 / 拦截弹窗 |
| 限制用户 | 强拦截 Modal；PRD §6.6.3 点击遮罩不关闭；按 Figma 展示 X，X 与「我知道了」均返回上一页 |

## 12. 自动测试与修复策略

实现后必须使用 Browser MCP 和 Playwright MCP 做自动走查。发现不符合 PRD、Figma、API 契约或任务清单的点，必须修复后重新验证。

| 工具 | 用途 | 必做检查 |
|------|------|----------|
| Browser MCP | 真实打开本地页面，做视觉、响应式、深浅色检查并形成报告 | 桌面、移动端、浅色、深色、首屏、长页、弹窗、底部浮层 |
| Playwright MCP | 跑可重复交互流程 | 报名、任务跳转、领取、排行榜分页、分享、规则锚点、限制用户 |
| Vitest | 纯函数、mapper、schema、格式化 | `calc.ts`、`format.ts`、`mapCampaignDetail.ts`、请求参数构造 |
| Biome / lint / typecheck | 代码质量门禁 | touched files Biome、项目 lint/typecheck |

### 12.1 Browser MCP 视觉走查

- 对照 Figma 整页浅色 `9517:137713`、深色 `9364:134676`。
- 检查 Hero、五种任务、排行榜、活动规则、分享弹窗、受限弹窗、底部浮层。
- 检查移动端布局不破版、文字不溢出、按钮和卡片尺寸稳定。
- 报告记录 URL、视口、主题、步骤、实际结果和偏差；截图仅临时辅助观察，用完删除。

### 12.2 Playwright MCP 交互走查

- 未登录点击“立即参与”跳登录并带 from。
- 未报名点击任务按钮提示先报名。
- 报名成功后主 CTA 变“已参与”。
- KYC 前置失败 toast 正确。
- 可领取任务点击后进入 loading，成功后刷新状态。
- 领取超时、重复领取、接口失败不破坏按钮状态。
- 排行榜分页、空态、`1000+`、UID 脱敏正确。
- 分享复制和渠道点击可用。
- 点击活动规则平滑滚动到底部规则区。
- 顶部 CTA 不可见时底部浮层展示，回到顶部隐藏。

### 12.3 修复闭环

每轮自动测试后必须形成问题清单：

| 类型 | 处理要求 |
|------|----------|
| 不符 PRD | 修改实现或文档，不能静默忽略 |
| 不符 Figma | 修改样式；若设计与 PRD 冲突，记录并请求确认 |
| 不符 API 契约 | 修改 schema / mapper / mock；必要时更新 `03-api-contract.md` |
| bug | 修复后补测试或补 Playwright 场景 |

### 12.4 QA 测试用例文档回归流程

G7 只有在后期提供 QA 测试用例文档时执行；未提供 QA 用例时，记录为跳过，不阻塞交付。收到文档后，不直接运行用例，必须先完成 PRD 对照：

1. 读取 QA 测试用例文档、PRD、当前开发文档与已实现行为。
2. 按模块 / 用例编号逐项比对 QA 预期与 PRD 要求。
3. 输出差异清单，至少包含：模块、用例编号、PRD 依据、QA 预期、当前实现、差异判断、建议处理方式。
4. 将差异清单发给负责人确认；确认前不自动执行完整 QA 用例。
5. 确认后，使用 Browser MCP / Playwright MCP / Vitest / 手动可复核命令自动执行测试用例。
6. 跑用例期间发现问题即时调整，并重跑相关用例和受影响回归场景。
7. 中途缺测试账号、活动配置、环境、接口字段、QA 预期解释等信息时，按当前启用的协作方式索取；若启用 Lark，可通过机器人在 vtkj 群索取。
8. 测试用例全部跑通后记录 G7 完成；若启用 Lark 通知，再通过机器人在群里通知结果，并附测试范围、修复摘要和证据路径。

差异处理规则：

| 差异类型 | 处理要求 |
|----------|----------|
| QA 用例与 PRD 不一致 | 先记录差异并等待人工确认，不能擅自按其中一方修改 |
| QA 用例补充了 PRD 未覆盖场景 | 记录为新增验收点，等待确认是否纳入本次范围 |
| 当前实现不符合 PRD 和 QA 用例 | 立即修复并重跑相关用例 |
| 测试环境 / 数据不足 | 通过 Lark 机器人在 vtkj 群索取，记录阻塞用例 |

## 13. 单元测试策略

优先补测试：

- `calc.ts`：活动状态、倒计时目标、按钮文案、领取可用性、进度百分比。
- `format.ts`：金额千分位、2 位小数、排名 1000+、UID 脱敏。
- `mapCampaignDetail.ts`：API 脏数据、缺省副标题、任务类型分发。
- `activity.ts`：query key、mutation 参数构造。

## 14. 主题与 Mobile Web

### 14.1 深/浅色

- 全页（除 Hero 深色带）使用语义 token：`bg-1`、`text-1`、`text-3`、`bg-3`、`border-divider-2`、`bg-brand-1` 等。
- 禁止从 Figma MCP 参考代码复制硬编码颜色；`var(--*)` 映射为 Tailwind 语义类。
- 按钮 `disabled` 样式对齐 `Rewards/utils/taskActionButtonClasses.ts`。
- 验收：对照 Figma 整页浅色 `9517:137713`、深色 `9364:134676` 各走查一遍（见 07-figma-spec §2.1）。

### 14.2 Mobile Web

- 路由不变：`/campaign/[activityId]`。
- 布局断点按项目现有响应式规则处理；参考 `Rewards` 的任务卡片堆叠、页容器和按钮 token。
- 页面根容器建议：

```tsx
<div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 xl:px-0">
```

- 仅当 Tailwind 无法表达的行为差异（如移动端滚动锚点）才在组件内读取 `isMobile`。

## 15. 可能复用的现有模块

| 现有位置 | 可复用点 |
|----------|----------|
| `apps/web/src/apps/Rewards/` | 任务卡片响应式、规则区、按钮 class（`taskActionButtonClasses.ts`） |
| `apps/web/src/constants/pathnames.ts` | `LOGIN`、`PROFILE_REWARDS`、`COUPON_RECORD`、`SPOT`、`FUTURES` 等路由常量 |
| 全局 Modal / Toast | 报名、限制、领取反馈 |
| i18n `zh-CN` locale | `campaign.json` namespace |
