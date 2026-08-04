# 活动落地页项目私有开发规则

> **项目**：PR-01685 活动落地页。  
> **适用范围**：`apps/web/src/apps/Campaign/` 与 `apps/web/src/services/api/campaign/`。  
> **公共规则**：先读 [`../../common/README.md`](../../common/README.md)。本文只保留 Campaign 私有约束；若与 `common/` 冲突，以 `common/` 为准。  
> **状态**：Mock 开发里程碑已完成，后续重点是 API 差异、QA 回归和 Lark 应用闭环。

## 0. 95% UI 还原专项策略

PR-01685 是运营活动落地页，当前验收目标为 **Figma 还原度至少 95%**。因此本项目进入公共规则定义的“高保真视觉模式”：功能逻辑继续遵守公共 token / 分层规则，但视觉层不能只按现有 token 做近似还原。

### 0.1 当前偏差根因

1. 现有实现大量使用项目通用 token 近似 Figma，例如 `min-h-120`、`rounded-m`、`text-h-l`、`space-y-12`，适合普通业务页，但无法保证运营页 95% 还原。
2. Figma 规格已经记录到 `product/07-figma-spec.md`，但代码阶段没有把这些规格变成强验收项，导致“文档有、实现弱”。
3. 视觉验收目前只有局部 Playwright 历史实测记录，缺少桌面浅色、桌面深色、390px H5 与 Figma 节点逐项对照的完整报告。
4. **分享弹窗曾犯两类流程失误**（已写入 [`../../common/component-reuse-and-visual-fidelity.md`](../../common/component-reuse-and-visual-fidelity.md)）：L1「能打开」冒充 L2 视觉完成；未复用全站 `ShareActionButtons` 手写渠道行。

### 0.2 执行方案

1. **先冻结视觉基准**：以 `product/07-figma-spec.md`（**2026-06-28** 整页浅色 `9517:137713` MCP 重读 token + 原子几何）的整页浅色/深色 `9364:134676`、组件画板 `3068:7` 为唯一视觉基准；旧 node 只做历史参考。
2. **重做视觉外壳**：Hero、子活动标题、任务卡、阶梯 / 进阶、组合任务、排行榜、活动规则、底部浮层、分享 / 受限弹窗都要按 Figma 尺寸、间距、圆角、层级重新校准。
3. **允许局部精确值**：本项目视觉组件可使用 `w-[1200px]`、`h-[480px]`、`rounded-[16px]`、`gap-[30px]` 等精确值；颜色仍优先走语义 token，Hero 固定底色、阴影、半透明遮罩等无法表达时可局部写精确值，并在 `07-figma-spec.md` 记录。
4. **视觉与业务分层**：精确视觉值只允许出现在 `components/` 视觉组件、视觉常量或专用 wrapper 中；`calc.ts`、mapper、service、hooks 不得混入视觉常量。
5. **真实浏览器驱动迭代**：每轮修复必须真实打开 Browser / Playwright，覆盖桌面浅色、桌面深色、390px H5、核心弹窗，并生成文字验收报告；截图仅临时辅助观察，用完删除。
6. **逐项对照验收**：报告按 Hero、模块间距、任务卡、排行榜、规则区、底部浮层、弹窗、主题色、H5 不溢出逐项记录 pass / fail；fail 项必须修复后重跑。

### 0.3 95% 验收口径

以下任一项未通过，不得声明 UI 达到 95%：

- 桌面浅色对照 Figma `9517:137713`：页面宽度、Hero 高度、1200px 内容区、模块间距、卡片尺寸和主视觉层级一致。
- 桌面深色对照 Figma `9364:134676`：语义色、卡片背景、文字层级、边框 / 分割线在深色主题下正确。
- 390px H5：无横向滚动、无文字遮挡、CTA / 分享 / 底部浮层不重叠，核心内容顺序与 Figma 移动适配策略一致。
- 分享弹窗、受限弹窗、底部浮层必须单独打开并写入验收报告。
- 已知偏差必须写入 `product/06-collaboration.md`，并标明“设计接受 / 产品接受 / 待确认”；不能静默留偏差。

## 1. 开发入口

开发或回归前先确认：

1. `product/01-scope-and-phases.md`：范围、不做项、待确认。
2. `product/02-technical-design.md`：Campaign 目录、数据流、状态分层。
3. `product/03-api-contract.md`：Swagger / YApi 差异、DTO、Mock 场景。
4. `product/04-frontend-tasks.md`：任务清单。
5. `product/05-ui-and-interaction.md`：UI 状态、主题、Mobile Web。
6. `product/06-collaboration.md`：PRD / Figma / API / QA 差异。
7. `product/07-figma-spec.md`：Figma 节点、token、截图与响应式。

未确认 Swagger / YApi 差异前，不在生产路径写死后端字段；可以维护 UI 领域类型和 Mock，但必须通过与真实 API 相同的 schema / mapper。

## 2. Campaign 分层约束

Campaign 模块按以下路径组织：

```text
Page Route
  ↓
Campaign page container
  ↓
Campaign UI domain model / components
  ↓
calc / format / routeActions pure utilities
  ↓
services/api/campaign: request + schema + mapper
```

项目特殊规则：

- 五种任务类型由 `TaskRenderer` 或同等分发组件承接，不在页面容器里写大量 switch UI。
- `TaskRenderer` 等 2+ 入参组件遵循 [../../common/react-component-props-types.md](../../common/react-component-props-types.md)（`TaskRendererParams` + `props` 解构）。
- 纯计算集中在 `common/calc.ts`，例如活动状态、任务按钮态、组合任务、阶梯任务、进度。
- API DTO 经过 `mapCampaignDetail` 收敛为 UI 领域模型后再进入组件。
- 活动详情、排行榜、报名、领取分别走 React Query；排行榜按 `activityId + taskId + page` 缓存。
- 倒计时基于 `serverTime`、`startTime`、`endTime` 与本地 tick 计算，不依赖 WebSocket。
- 底部浮层用本地滚动阈值 hook；分享弹窗用本地 state 或 modal props。

## 3. 任务类型规则

### 单一任务

- 使用统一 `ConditionItem` 和 `TaskActionButton`。
- 数值条件展示进度条；KYC 不展示。
- 领取按钮只在 `rewardStatus === claimable` 时可点击。

### 组合任务

- AND / OR 完成态由 `calcComboTaskState` 计算。
- 不在 JSX 中直接判断所有条件关系。

### 阶梯任务

- 按最高档发放，不叠加。
- 最高可领取档位由 `calcHighestClaimableTier` 计算。
- 档位 tooltip 内容由 mapper 或 format 工具准备。

### 进阶任务

- 逐档解锁，可叠加领取。
- 每个档位状态独立计算。
- 已领取档位不影响后续档位继续展示进行中。

### 排行榜任务

- 排行榜数据独立 query，不塞进活动详情 mapper。
- 分页状态放 RankingTaskCard 内部或 URL query（待产品确认），不要放全局 store。
- 排名格式化统一走 `formatRankDisplay`。

## 4. Campaign API 与 Mock 场景

YApi 差异确认前，Mock 场景至少覆盖：

- 未登录访问、未报名进行中、已报名部分完成、已报名全部完成。
- 未开始、已结束、已下线。
- KYC 前置失败、受限用户。
- 五种任务类型、排行榜分页 / 空态 / `1000+`。
- 分享、领取超时、重复领取、接口失败。

请求状态：

- 活动详情：页面骨架屏、错误态、重试。
- 报名：主 CTA disabled + loading。
- 领取：当前按钮 disabled + loading，失败不改变成功态。
- 排行榜：表格局部 loading / skeleton。
- 分享信息：若独立请求，分享按钮 loading 或弹窗 loading。

领取超时按 PRD 展示“领取请求已提交，请稍后在卡券中心中查看”。

## 5. 跳转、分享与埋点

所有任务动作统一走 `routeActions.ts`，禁止在各任务组件内手写路由字符串。

当前跳转候选：

```text
KYC → 身份认证页
DEPOSIT → 充值页
SPOT → BTC 现货交易页
FUTURES → BTC 合约交易页
```

分享规则：

- 分享链接拼接由 `useCampaignShare` 或 `buildCampaignShareUrl` 统一生成。
- Web 固定渠道：复制、Telegram、WhatsApp、X。
- **渠道行必须复用** `ShareActionButtons`（`hideSave`）；内容区（标题 + 链接框）在 `CampaignShareModal` 定制。见 `common/component-reuse-and-visual-fidelity.md`。
- 分享弹窗 L2 视觉以 Figma `9336:133821` 与 `07-figma-spec.md` §4.10 图标映射为准；L1 通过不得标 JF6 完成。

埋点：

- 只处理 Web 前端事件与公共参数；封装见 `apps/web/src/apps/Campaign/common/campaignTracking.ts`（沿用 `posthog.capture`，模式同 `worldCupTracking.ts`）。
- `device_id` 来自 `storage.deviceId`；`page_source` 由 `resolveCampaignPageSource` 解析。
- 埋点字段差异写入 `product/06-collaboration.md`。

## 6. Campaign 专项验证

纯函数 / mapper 优先补测：

- `calcCampaignStatus`
- `calcCountdownTarget`
- `calcConditionProgress`
- `calcTaskActionState`
- `calcComboTaskState`
- `calcHighestClaimableTier`
- `formatRankDisplay`
- `formatMetricValue`
- `maskUid`
- `mapCampaignDetail`

Browser / Playwright 重点验证：

- 未登录、未报名、已报名、KYC 失败、受限用户。
- 报名、任务跳转、领取、排行榜分页、分享、规则锚点。
- 底部浮层出现 / 隐藏。
- 桌面、390px H5、dark / light。
- QA 用例到位后，先比对 PRD 差异，再执行回归。

## 7. Campaign 交付检查

- [ ] 已继承 `common/` 公共规则。
- [ ] YApi / Swagger 差异已写入 `product/03-api-contract.md` 和 `product/06-collaboration.md`。
- [ ] 五种任务类型通过 mapper + renderer 分发。
- [ ] 任务状态计算集中在 `calc.ts`。
- [ ] 活动详情没有复制进 Zustand。
- [ ] 报名 / 领取 / 排行榜 loading、empty、error、disabled 状态完整。
- [ ] 分享链接、邀请码、渠道点击已验证。
- [ ] 受限用户弹窗强拦截逻辑已验证。
- [ ] QA 用例差异已先回写并等待确认。
- [ ] Lark 群通知和群内 @ 应用任务记录已按公共规则维护。
