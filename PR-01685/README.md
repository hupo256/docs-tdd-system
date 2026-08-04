---
projectId: PR-01685
status: closed
stage: G8
branch: feature/PR-01685-1
worktree: ""
port: ""
visualFidelity: standard
prdSource: "apps/web/docs_tdd/PR-01685/inbox/lark-sync/activity-landing-page-prd.md"
figmaNode: "3068:7"
larkEnabled: true
---

# 活动落地页（PR-01685）— Web 开发文档

> **状态**：**已上线（2026-07-30），项目已关闭，worktree 已回收**。Web 活动落地页已合入 `online`；`feature/PR-01685-1` 分支保留用于历史回查。  
> **历史开发分支**：`feature/PR-01685-1`（详见 [§ 分支与代码基线](#分支与代码基线)）。  
> **范围**：仅 Web 端活动落地页；App 端、用户管理后台、后台报表实现不在本次 Web 前端开发范围内。  
> **PRD**：最新来源为 `apps/web/docs_tdd/PR-01685/inbox/lark-sync/activity-landing-page-prd.md`；只读同步报告见 `apps/web/docs_tdd/PR-01685/inbox/lark-sync/sync-report.md`。  
> **Figma**：`KzvWxAYxqfgpoiYuKdxMAE` · 组件画板 `web组件` · node `3068:7` · [Dev Mode 链接](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/%E3%80%8CFameEX%E4%B8%89%E6%9C%9F%E3%80%8D----WEB?node-id=3068-7&m=dev)  
> **UI 截图**：`apps/web/docs_tdd/PR-01685/inbox/activity-landing-page/ui/`

## 分支与代码基线

> 本节是后续开发的事实基线，先于任何代码改动确认。

| 项 | 值 |
|----|-----|
| 历史开发分支 | `feature/PR-01685-1`（Web 活动落地页；分支保留用于回查） |
| 上线状态 | 2026-07-30 合入 `online`（merge `9c17fcd5a2`） |
| `feature/PR-01685` | 活动配置**后台**工作（自任务创建 / 保存草稿 / 提交参数），**不含**落地页代码，非本文档基线 |
| worktree | 已回收；原路径 `/Users/aven/github/PR-01685-1` |

落地页代码落点（均在 `feature/PR-01685-1`）：

| 类型 | 路径 |
|------|------|
| 路由 | `apps/web/src/app/[lang]/(with-header)/(with-footer)/campaign/[activityId]/page.tsx` |
| 页面与组件 | `apps/web/src/apps/Campaign/`（`index.tsx`、`components/`、`hooks/`、`common/`） |
| 服务层 | `apps/web/src/services/api/campaign/campaign.ts` |
| 路由常量 | `apps/web/src/constants/pathnames.ts` → `CAMPAIGN_DETAIL` |
| i18n | `apps/web/src/i18n/locales/zh-CN/campaign.json` |

> Mock 已按 [architecture-and-state.md §8.0.3](../common/architecture-and-state.md) 零残留拆除（2026-07-03）：`apps/Campaign/mock/`、`mockApi.ts`、`NEXT_PUBLIC_CAMPAIGN_USE_MOCK` flag、`CampaignScenario` 类型均已删除，页面固定走真实接口。

## 文档地图

| 分类 | 文档 | 说明 |
|------|------|------|
| 功能清单 | [product/00-feature-inventory.md](./product/00-feature-inventory.md) | PRD 全量功能、验收项、做/不做/延期、待确认差异 |
| 产品范围 | [product/01-scope-and-phases.md](./product/01-scope-and-phases.md) | 背景、目标、Web v1 范围、不做项、验收 |
| 技术方案 | [product/02-technical-design.md](./product/02-technical-design.md) | 路由、目录、数据流、状态分层、组件拆分 |
| API 契约 | [product/03-api-contract.md](./product/03-api-contract.md) | §0 YApi 唯一契约真源；§1–§10 为历史草案（勿照此实现） |
| 前端任务 | [product/04-frontend-tasks.md](./product/04-frontend-tasks.md) | 可勾选任务清单 |
| UI 交互 | [product/05-ui-and-interaction.md](./product/05-ui-and-interaction.md) | 页面模块、状态、滚动、弹窗、截图索引 |
| Figma 规格 | [product/07-figma-spec.md](./product/07-figma-spec.md) | MCP 读取的节点映射、token、尺寸、组件对照 |
| 协作联调 | [product/06-collaboration.md](./product/06-collaboration.md) | 分工、联调、风险与待决 |
| 工程规则 | [engineering/development-rules.md](./engineering/development-rules.md) | 本模块开发规则，基于 docs_tdd 通用规则细化 |
| Agent 流程 | [agent/README.md](./agent/README.md) | Cursor + Figma/Browser/Playwright MCP + Lark 协作流程 |
| Lark 集成 | [agent/lark-integration.md](./agent/lark-integration.md) | 读取 Lark PRD、发送阶段状态、响应群内 @、派发开发任务与自测 |
| 通知记录 | [agent/notification-log.md](./agent/notification-log.md) | G0-G8 / Lark Job 实际发送记录 |
| 试跑记录 | [agent/pr-01685-dry-run.md](./agent/pr-01685-dry-run.md) | PR-01685 按自主开发流程的当前跑通记录 |

## 当前状态摘要

| 项 | 状态 |
|----|------|
| 项目状态 | ✅ 已上线（2026-07-30），G8 归档，worktree 已回收 |
| PRD | ✅ 已提供，V1.0，2026-05-14 |
| UI | ✅ 已提供 Figma URL 与 13 张截图；✅ 2026-06-28 已重读整页浅色 `9517:137713`（token + 原子几何）；✅ 2026-06-17 已读 `web组件` `3068:7` → [07-figma-spec.md](./product/07-figma-spec.md) |
| Web 范围 | ✅ 活动入口、活动落地页 |
| App 范围 | ❌ 不开发，仅 PRD 中作为参考 |
| 管理后台 | ❌ 不开发，依赖后端/后台配置输出 |
| 代码实现 | ✅ 已切真实接口；YApi 校准、埋点 J1/J2 完成；Mock 已零残留拆除（2026-07-03） |
| UI 视觉验收 (L2) | ✅ 桌面 light+dark + 390px H5 Figma 并排全 pass、无残留偏差（2026-07-07，见 [evidence/ui-ux/2026-07-07](./evidence/ui-ux/2026-07-07/README.md)）；JF1–JF10、K12 全绿，UI 达 95% 还原 |
| 后端 API | ✅ YApi **2026-06-26** 已同步（cat_1205，14 接口）；唯一契约见 [03-api-contract.md §0](./product/03-api-contract.md)；原始导出 [inbox/yapi-sync/sync-report.md](./inbox/yapi-sync/sync-report.md) |
| Web 埋点 | ✅ Lark QA/数据统计文档已同步；仅处理 Web 前端“看了 / 点了”事件与公共参数 |
| 路由 | ✅ 已确认：`/campaign/[activityId]` |
| Lark 同步 | ✅ 2026-06-19 已通过 `sync-lark-docs.mjs` 同步真实 PRD / QA 到 `inbox/lark-sync/` |
| Lark 应用 | ✅ `PRD 读取器` 已审批发布；群内 @ 已验证可进入本地任务队列；临时 tunnel 失效时需重启并更新回调地址 |
| 埋点文档 | ✅ `apps/web/docs_tdd/PR-01685/inbox/lark-sync/activity-landing-page-qa.md` |
| i18n | ⚠️ 按 docs_tdd 规则，开发期只维护 zh-CN |

## Web v1 核心能力

1. 展示后台配置的活动 Banner、活动信息、时间、倒计时。
2. 展示子活动与任务组合，支持 5 种任务类型：
   - 单一任务
   - 阶梯任务
   - 进阶任务
   - 组合任务
   - 排行榜任务
3. 支持用户报名活动。
4. 支持任务动作跳转：KYC、充值、现货交易、合约交易。
5. 支持奖励领取 / 已领取 / 已发放 / 待发放 / 已结束等状态展示。
6. 支持排行榜、我的排名、分页、最近更新时间。
7. 支持活动规则区与“活动规则”锚点滚动。
8. 支持底部浮层 CTA：当顶部“立即参与”不可见时展示。
9. 支持活动分享弹窗，Web 端固定分享渠道。
10. 支持受限用户/地区强拦截弹窗。

## 历史待确认项

全量待确认 / 待决项（后端字段、跳转、埋点、Figma 验收基准等）统一登记在 **[06-collaboration.md §7 待决问题](./product/06-collaboration.md#7-待决问题open-questions)**，作为唯一来源；其余文档只引用，不再各自维护一份。API 字段级待后端确认细项见 [03-api-contract.md §0.4 / §10](./product/03-api-contract.md#04-仍需后端确认)。

切真实接口前必须关闭的关键项（详见 06 §7）：网关前缀联调验证、`ruleContent` 渲染格式、排行榜本地分页策略、`BLOCKED` 细分原因联调验证。

## 历史开发顺序

> 以下内容保留为开发与联调历史，不表示项目仍在进行。项目已于 2026-07-30 上线并关闭；未执行或未留证的验收项保持历史状态，不做事后补写。

1. 确认 [00-feature-inventory.md](./product/00-feature-inventory.md) 的 G2 结论（做 / 不做 / 延期已定稿）。
2. 按 [03-api-contract.md §0](./product/03-api-contract.md) 的 YApi 版本，与当前真实 service/schema/mapper 逐项比对，关闭 [06 §7](./product/06-collaboration.md#7-待决问题open-questions) 的后端字段待确认项。
3. 使用真实接口联调校准 schema / mapper / UI 字段来源；不得恢复已删除的 `NEXT_PUBLIC_CAMPAIGN_USE_MOCK`、mock fixture 或 `USE_MOCK` 分支。历史 Mock 场景仅作旧证据参考，不作为运行时回归路径。
4. 用 Browser / Playwright MCP 跑桌面浅/深色、390px H5、五种任务、领取、排行榜、分享、规则锚点、受限弹窗的还原与交互验收。
5. 当前 Lark 同步的 QA 文档是数据统计 / 报表需求，不是完整 QA 测试用例；若后期收到测试用例文档，先与 PRD 逐项比对并输出不一致清单再执行。
6. Lark 文档后续以 `agent/lark-sources.json` + `agent/scripts/sync-lark-docs.mjs` 同步到 `inbox/lark-sync/`，不依赖手动导出。
7. 若执行了 QA 测试用例，全部跑通后记录 G7 完成；若未提供 QA 用例，则记录 G7 跳过并进入最终交付准备。
