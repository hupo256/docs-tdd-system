# PR-01988 Implementation Plan

> 状态：G2 已确认。用于 G4-G7 的执行顺序。

## 开发阶段拆分

| 阶段 | 目标 | 主要动作 | 前置条件 |
|------|------|----------|----------|
| P0 | G2 定稿 | 更新 `00-feature-inventory.md`、裁剪记录、任务状态 | 负责人确认 scope |
| P1 | Admin 骨架 | 新增 pathnames、route pages、菜单、title/sider zh-CN 文案 | 已完成：独立 `预测市场管理` 菜单组、`/prediction/...` 路由、占位权限码、legacy language redirect |
| P2 | API / mock 基础 | 建 service、schema、mapper、mock fixture、query keys | Admin mock 已完成；YApi 32 个接口已形成快照，真实 schema / mapper 按权限 / 环境继续联调 |
| P3 | 低风险列表页 | 每日收入统计、订单管理、仓位管理 | mock-first UI 已完成；YApi 已给列表 / 统计 / 收入导出 / 订单导出 / 仓位导出，收入导出响应类型、文件名和真实分页细节仍待联调 |
| P4 | 配置页 | 分类管理、事件管理、告警配置 UI 与表单 | mock-first UI 已完成；YApi 已给主要读取和部分保存接口，删除 / 排序 / 启停 / 路径稳定性 / 权限仍待确认 |
| P5 | 高风险操作 | 手动平账、分类 / 事件变更、下线 / 关闭交易、告警配置保存 | UI 外壳已完成；真实 mutation 等安全边界确认后再接；PRD 删除线中的测试告警不作为当前必做 |
| P6 | Web 用户侧 | 埋点和交易关闭禁用态 | G2 确认 Web 本期改，API/SDK 口径确认 |
| P7 | 验证交付 | Biome、typecheck、单测、浏览器自测、验收证据 | Biome 已通过；TS 全量有历史无关错误；UI 已确认完成，接口联调证据待补 |

## 文件落点矩阵

| 能力 | 建议文件 / 目录 | 说明 |
|------|----------------|------|
| Admin 路由 | `apps/admin/src/app/[lang]/(dashboard)/(main)/(sider)/prediction/**/page.tsx` | route file 保持薄层，只渲染 container |
| Admin 业务模块 | `apps/admin/src/apps/PredictionMarket/**` | 若 G2 确认命名，也可用 `PredictionAdmin`；避免与 Web `Prediction` 混淆 |
| Admin API | `apps/admin/src/services/api/prediction.ts` 或 `prediction/**` | schema、mapper、query hook 与 UI 解耦 |
| Admin 类型 | `apps/admin/src/types/prediction.ts` | API DTO、UI model、枚举、搜索参数 |
| Admin 工具函数 | `apps/admin/src/apps/PredictionMarket/utils/**` | 金额、费率、状态、Polygonscan 链接、导出文件名 |
| Admin i18n | `apps/admin/src/i18n/locales/zh-CN/sider.json`、`title.json`、业务文案文件 | 只维护 `zh-CN` |
| Admin 菜单 | `apps/admin/src/constants/routes.ts`、`siderItems.ts`、`types/permission.ts` | 权限码确认后再落 |
| legacy redirect | `apps/admin/legacy-admin/src/router/index.js`、相关 legacy menu/router | 仅当 legacy 入口跳 Next Admin 时修改 |
| Web 埋点 | 待确认；当前 worktree 未找到 `apps/web/src/apps/Prediction/**` | Web F01/F07 开发前确认一期代码来源或新实现落点 |
| Web API / schema | 待确认；当前 worktree 未找到 `apps/web/src/services/api/prediction/**`、`predict/**` | 交易关闭字段或错误码联调前需确认 API 落点 |
| 测试 | 与 mapper / formatter 同目录 `*.test.ts` | 金额、费率、状态、URL builder 优先 |

## 建议实现顺序

1. 更新 G2 文档门禁：`00-feature-inventory.md`、`04-frontend-tasks.md`、`06-collaboration.md`。
2. 新增 Admin route/page 空壳和 zh-CN title/sider 文案，确保路由能打开。
3. 建立 prediction API service、types、mapper、mock 数据和 query keys。
4. 先做只读列表：每日收入统计、订单、仓位，验证分页、筛选、导出。
5. 再做配置型页面：分类、事件、告警，优先完成只读和编辑弹窗 UI。
6. 最后接高风险 mutation：手动平账、分类 / 事件变更、下线 / 关闭交易、告警配置保存，必须保留二次确认和失败态。
7. 若 Web 在 scope 内，最后接埋点和交易关闭禁用态，避免影响主交易链路。
8. 按 `09-acceptance-checklist.md` 收集验证证据。

## 高风险安全闸口

| 操作 | 未确认前策略 | 确认后最低要求 |
|------|--------------|----------------|
| 手动平账 | 只做 mock / UI，不接真实 mutation | 独立权限、二次确认、操作人、审计记录、失败态、不可重复提交 |
| Lark webhook | 不展示 secret，不保存真实 webhook | 仅展示脱敏状态；若前端提交 secret，必须有权限和审计 |
| Polymarket 私钥配置 | 默认保留 legacy，不迁移 | 若迁移，需安全评审、脱敏、权限、审计、禁止日志泄露 |
| 下线 / 关闭交易 | mock 或只读展示 | 二次确认，说明前端可见性和交易影响 |
| 导出 | mock 文件或禁用 | 权限控制、当前筛选条件、文件名规则、失败提示 |

## 每轮开发后的验证

- 触达 JS / TS / JSON 后跑 Biome；优先使用仓库已有 Biome 脚本。
- Admin 代码完成后跑 `pnpm --filter @fameex/admin typecheck`。
- Web 用户侧改动后跑 `pnpm --filter @fameex/web typecheck`。
- 纯函数 mapper / formatter 改动补 Vitest 或相邻测试。
- UI 改动保存桌面截图；若 Web 用户侧改动，补 390px 视口。

## 2026-06-17 开发记录

- 已创建 Admin mock-first 页面：`apps/admin/src/apps/PredictionMarket/**` 和 `apps/admin/src/app/[lang]/(dashboard)/(main)/(sider)/prediction/**/page.tsx`。
- 已拆出 Admin 类型和 React Query mock API 层：`apps/admin/src/types/prediction.ts`、`apps/admin/src/services/api/prediction.ts`、`apps/admin/src/services/api/prediction.mock.ts`，当前支持关键词 / 状态筛选。
- 已接入独立菜单组和路由：`/prediction/daily-income`、`/prediction/categories`、`/prediction/events`、`/prediction/orders`、`/prediction/positions`、`/prediction/reconciliation`、`/prediction/alerts`。
- 已增加占位权限码：`prediction.market.*`；后端正式 permission code 提供后需要替换。
- 已加入 legacy language redirect 和 Next sider special key，确保 legacy 菜单进入 App Router 时不走 hash。
- 已补 Admin 低保真操作入口：分类新增、事件添加 / rate / 交易开关展示、订单 hash 外链、订单 / 仓位 / 收入按当前筛选导出 mock 反馈、告警新增；测试告警入口后续已按 PRD 删除线口径移除。
- 已补 Admin mock-first 表格统一空态：无数据时提示调整筛选或等待后端同步。
- 已补 Admin mock-first 错误态：任意列表关键词输入 `__error` 可触发 mock API error 并展示错误提示。
- 已按 RDP 补齐 Admin mock-first 字段：收入三类明细 / 订单数 / PM fee / Gas / 毛利、分类二/三级数量和新增 / 修改 / 删除确认、事件 PM slug / 多级分类 / 三档 rate / 对账阈值 / 修改 / 下线确认、订单类型 / 份额 / 平台收入 / 成交时间、仓位 ID / 保证金 / 平台收入 / 创建时间、平账持仓差异 / 建议动作 / 挂单价格 / 记录字段、告警三类阈值 / 级别 / 处理方式 / 监控频率 / Lark 开关；YApi 已给主要读取 / 导出 / 部分提交接口，收入导出响应类型、分类删除校验、排序 / 启停、字段精度和高风险 mutation 安全边界仍待确认。
- 已执行 Biome；typecheck 因新 worktree 无 `node_modules` 未能有效完成。
- 已建立 Admin API mock / real 切换：默认使用源码 mock fixture，配置 `NEXT_PUBLIC_PREDICTION_API_MODE=real` 后请求预留 `/operate-api/prediction/**` 路径，并通过 DTO mapper 转为 UI model。

## 2026-06-22 阶段记录

- 当前阶段：G4 Admin UI/UX 已完成并提交，等待 G5 真实 API / 权限联调；接口联调后补真实数据证据。
- 最新代码提交：`b9f615195 feat: PR-01988 prediction admin UI`。
- 已完成：`/prediction/**` 路由、独立菜单组、legacy redirect、zh-CN title/sider、mock API 切换、核心表格 / 筛选 / 弹窗 / 空态 / 错误态。
- 已完成 UI 收口：按截图要求移除页面说明、解释、mock 提示型组件，保留核心业务 UI、错误态和二次确认。
- 已验证：Biome touched files 通过；`pnpm --filter @fameex/admin exec tsc --project ./tsconfig.json --noEmit --pretty false` 全量退出 1，但 PR-01988 路径无诊断。
- 待处理：真实环境 / permission code、收入导出响应类型和文件名、YApi 带时间戳路径稳定性、事件 / 分类 / 告警保存、手动平账真实 mutation 安全链路、Web 埋点 / 禁用态代码来源、接口联调截图证据。

## 2026-06-22 UI 完成后等待接口

- UI/UX 当前已确认完成；不再把“最新 UI 证据待重跑”作为阻塞项。
- 下一阶段主线切到真实接口联调：permission code、真实环境、分页 / 筛选 / 导出、字段精度 / 错误码、分类 / 事件 / 告警保存、手动平账安全 mutation。
- 接口联调完成或真实数据形态变化后，再补对应 Browser / Playwright 报告与截图证据。
