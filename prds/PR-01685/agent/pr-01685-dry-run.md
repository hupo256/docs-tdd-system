# PR-01685 试跑记录

> 日期：2026-06-05；更新：2026-06-09；规范补充：2026-06-16  
> 目标：记录 PR-01685 活动落地页 Cursor 自主开发流程与 Lark 集成断点。

> 2026-06-16 补充：本文件保留当时试跑状态；最新继续开发入口以 [../README.md](../README.md)、[../product/00-feature-inventory.md](../product/00-feature-inventory.md) 和 [../product/03-api-contract.md](../product/03-api-contract.md) 为准。YApi 当前版本已整理，后续先做 Mock/service 差异确认再切真实接口。

## 1. 资料接收结果

| 来源 | 状态 | 备注 |
|--------|--------|-------|
| PRD | 可读取 | `apps/web/docs_tdd/prds/PR-01685/inbox/lark-sync/activity-landing-page-prd.md` |
| Figma | MCP 已读取 | 组件画板 `9489:136579` + 整页浅/深 `9517:137713` / `9364:134676`；见 `product/07-figma-spec.md` |
| UI 截图 | 已提供 | `apps/web/docs_tdd/prds/PR-01685/inbox/activity-landing-page/ui/` 下有 13 张 PNG |
| API 文档 / Swagger | 已拿到 YApi | `Growth Activity` 分类 7 个接口已读取；已整理到 `product/03-api-contract.md` §0 |
| 埋点文档 | 已通过 Lark CLI 同步并可读取 | `apps/web/docs_tdd/prds/PR-01685/inbox/lark-sync/activity-landing-page-qa.md` |
| Lark 同步 | webhook 可用；Lark 应用已审批发布 | webhook 与签名密钥由负责人提供；`PRD 读取器` 已审批发布；群内 @ 已可进入本地任务队列 |
| 仓库规则 | 已提供 | 根目录 `AGENTS.md` 和活动模块规则可用 |

## 2. 已有开发文档

以下文档已经满足 G1 文档门禁：

| 文档 | 状态 |
|-----|--------|
| `README.md` | 当前状态、文档地图、Web v1 范围、阻塞项 |
| `product/01-scope-and-phases.md` | 范围、任务类型、验收标准 |
| `product/02-technical-design.md` | 路由建议、目录结构、状态与数据流 |
| `product/03-api-contract.md` | API 契约草案和后端确认清单 |
| `product/04-frontend-tasks.md` | 从文档到自测的任务拆分 |
| `product/05-ui-and-interaction.md` | UI 模块、截图、状态规则 |
| `product/06-collaboration.md` | RACI、联调清单、风险列表 |
| `engineering/development-rules.md` | 模块开发规则和 Review 清单 |

## 3. 门禁状态

| 门禁 | 状态 | 原因 |
|------|--------|--------|
| G0 资料接收 | 已完成 | PRD、Figma id、截图、仓库文档均已明确 |
| G1 文档生成 | 已完成 | 开发文档已存在且结构完整 |
| G2 方案确认 | 已完成主要前端范围确认 | 路由、Lark、Figma MCP 规格、Web 埋点、完全前端 Mock 策略、Banner 倒计时本地计算方案已确认；Swagger/API 文档、自测账号待补 |
| G3 API / Mock 准备 | 已完成前端 Mock 基线 | 已基于前端草案完成 Mock 场景；最新流程改为先按 YApi 当前版本校准差异再切真实接口 |
| G4 Mock 开发联调 | 已完成里程碑 | Campaign UI、Mock 场景、倒计时、任务、排行榜、规则、分享、受限弹窗、底部 CTA 已实现并完成基础 Browser 走查 |
| G5 API 联调 | 待差异确认 | YApi 已到位；下一步先比对当前 Mock/service 与 YApi 差异，确认后再切真实接口 |
| G6 自动验收与修复 | 部分完成 | Biome 与 Browser 冒烟已完成；完整 typecheck 曾被仓库既有无关错误阻塞；后续 API/QA 到位后继续 |
| G7 QA 用例比对与回归 | 待开始 | 等 QA 用例文档；先比对 PRD，确认差异后再跑用例 |
| G8 交付 | 待开始 | 等 API/QA/Lark 集成后续闭环 |

## 4. 需要人工提供的信息

| ID | 问题 | 影响 |
|----|----------|----------------|
| H1 | Lark webhook URL，以及是否开启签名密钥 | 已提供；密钥不得写入仓库 |
| H2 | 最终路由 | 已确认：`/campaign/[activityId]` |
| H3 | 当前是否开始 UI 开发 | 已完成 Mock 开发里程碑；后续聚焦 API 联调、QA 回归、Lark 集成 |
| H4 | Swagger/OpenAPI 地址或文件 | 已提供 YApi：项目 276 / 分类 1205；已整理接口清单和字段摘要 |
| H5 | Figma 状态稿与适配规则 | F1–F4、F6、F9、F10 已确认；深/浅色 token + Mobile Web 见 07-figma-spec §11 |
| H6 | 分享组件级方案 | 按 [common/rules/component-reuse-and-visual-fidelity.md](../../../common/rules/component-reuse-and-visual-fidelity.md)：渠道行复用 `ShareActionButtons`；活动弹窗内容区可定制 | 已落地（2026-06-27） |
| H7 | Web 埋点/事件文档内容 | 已导出 Markdown；只处理 Web 前端事件与公共参数 |
| H8 | 登录、已报名、未报名、KYC、受限、排行榜等测试账号 | 暂无；Browser/Playwright 自动验收前由 Lark 机器人向负责人索取 |
| H12 | Lark 应用审批 | 已审批通过并发布；机器人已可接收群内 @ 事件 |
| H13 | Lark 回调地址 | 当前本地 Koa + Cloudflare quick tunnel 已跑通；地址临时，断开后需重新生成并更新事件回调地址；仅改回调地址按当前验证无需重新审批 |
| H9 | 本地联调用 API Mock 策略 | 历史已确认完全前端 Mock；最新流程为按 YApi 当前版本校准 Mock/service 差异后切真实接口 |
| H10 | Banner 倒计时 / WebSocket | Banner 倒计时、自动开启、自动结束不走 WebSocket；优先服务端时间校准，YApi 暂未见 `serverTime`；任务/排名先按 refresh/progress/ranking 轮询或手动刷新 |
| H11 | 跳转与埋点 SDK | Cursor AI 开发时分析项目现有逻辑并沿用 |

## 5. 当前 Lark 状态

- 当前阶段通知继续使用已有自定义群机器人 webhook，消息格式需逐步改为 Lark `interactive` 卡片。
- Lark PRD / QA / API 资料统一通过 `agent/lark-sources.json` + `agent/scripts/sync-lark-docs.mjs` 同步到 `inbox/lark-sync/`；不再读取手动导出的旧 PRD Markdown。
- Lark 自建应用 `PRD 读取器` 已审批通过并发布。
- 本地 Koa 回调已加入 `/Users/aven/aven/koa/src/routes/larkRoutes.js`：
  - `GET /lark/health`
  - `POST /lark/events`
  - `GET /lark/events/latest`
  - `GET /lark/tasks`
  - `POST /lark/tasks/next`
  - `POST /lark/tasks/:taskId/status`
- 上次验证通过的临时 tunnel：

```text
https://cameron-mixture-optimum-rebates.trycloudflare.com/lark/events
```

当前状态：该 quick tunnel 地址已不可用；本地 Koa 仍正常，继续接收群内 @ 前需要重新启动 `cloudflared tunnel --url http://localhost:3005`，并把新地址更新到 Lark 事件回调请求地址。

当前下一步：

1. webhook 消息统一改为 Lark `interactive` 卡片格式，支持标题、编号列表、加粗重点项。
2. 继续完善 `状态` / `文档` 低风险命令的消费流程。
3. tunnel 已断开；重新启动 `cloudflared tunnel --url http://localhost:3005` 后，把新地址更新到 Lark 事件回调请求地址。
4. 固定域名或守护进程方案确定前，不把 quick tunnel 作为长期稳定通道。

## 6. 建议发送的下一条 Lark 更新

如需同步当前状态，可通过 webhook 发送：

```text
标题：[PR-01685] Lark 集成状态
1. 当前：PRD 读取器应用已审批发布，事件回调已验证可触达本地 Koa。
2. 已完成：机器人能力、事件订阅、Cloudflare quick tunnel、群内 @ 入队、任务状态回写基础接口。
3. 继续：阶段通知先用 webhook，并改为 Lark interactive 卡片格式。
4. 风险：quick tunnel 为临时地址，本机睡眠、网络切换或进程退出会导致回调中断。
```

## 7. 建议下一步

1. webhook 通知消息改为 Lark `interactive` 卡片格式。
2. PRD / QA / API 资料继续支持 `.md` 导出读取；Lark MCP 可用后再直接读取云文档。
3. QA 用例到位后先做 PRD 差异比对，等待确认后再自动跑用例。
4. Lark 群内 @ 已跑通，先接 `状态` / `文档` 低风险命令，再接 `自测` / `修复` / `QA`。
