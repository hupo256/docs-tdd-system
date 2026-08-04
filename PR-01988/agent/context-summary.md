# PR-01988 预测市场二期 · context-summary

> AI 恢复项目时优先读本文。只放当前阶段/scope 快照/gate 状态/下一步,细节查 `product/`。
> 生成:2026-07-06,由子 agent 实读文档+跑 gate 核实。状态会漂移,动手前对当前代码复核。

## 一句话

运营**后台**闭环需求（可观测/可处置/可预警）。主战场 `apps/admin`（路由 `/prediction/...`）;`apps/web` 用户侧仅 F01 埋点 + F07 交易禁用态。**非用户侧新玩法。**

## 当前阶段

**代码已完成,test 测试通过,已部署 pre 验证（aven 2026-07-06 确认）。** Admin + Web 两侧代码均已实现并提测;剩 docs_tdd 侧 G6/G7 证据回填未收口。

> 2026-07-06 勘误:此前本文误记「Web 侧 F01/F07 未开发、worktree 找不到 Prediction 代码路径」——**错误**。实为子 agent 搜索不彻底(见下)。Web 侧代码在 `apps/web/src/apps/Prediction/`,埋点提交带 `(PR-01988)` 号(`add polymarket ... tracking (PR-01988)`),F07 禁用态在 `PredictionTradeMan/`。

G2 scope 已确认（aven/2026-06-17）;G4 Admin UI/UX 完成;G5 YApi project 459 的 32 接口拉取 + 联调完成。docs 侧下一步:按 `product/14-self-test-cases.md`(164 条用例)回填 G6/G7 证据。

## scope 快照

- **本期做**:F01 Web 埋点、F03 每日收入、F04 收入口径、F05 分类管理、F06 事件管理、F07 交易关闭禁用态、F08 订单管理、F09 仓位管理、F10 手动平账(高风险)、F11 告警配置、F12 上线验收。
- **后端主责/前端联调**:F02 服务端埋点。
- **不做(三期 F13)**:自动补资、限价单、自动平账、多品类、理财沉淀;另裁剪用户侧新玩法、多语言法币结算、最近告警记录页。

## gate / 验证状态

- `verify-project-gate.mjs PR-01988 G6 --json` → **ok:false**,7 项未过,**均为文档结构 heuristic,非代码问题**:
  - 5 error:DOC-G2-004(本期列格式)、DOC-G2-005(F12↔T12 文案 parser 匹配不到)、DOC-G4-002(技术设计缺复用清单)、DOC-G5-001(API 契约缺字段对账表)、VERIFY-G6-002(缺 code-review 结论记录)。
  - 2 warn:PRD content section 不可读、责任模块目录未填(无法扫 mock 残留)。
- Biome 已过;**Typecheck 被 worktree Admin workspace 依赖缺失阻塞**(非 prediction 专属);7 个 `/zh-CN/prediction/**` 路由 HTTP smoke 均 200;Playwright 未装;单测待补。

## 待办与阻塞（外部依赖为主）

1. **高风险 mutation 未接真实提交**:F10 手动平账、分类/事件变更、Lark webhook secret 提交——等权限、审批、白名单、限额、审计确认。
2. **后端/环境**:真实联调环境、Admin permission code(现占位)、YApi 带时间戳路径稳定性、PM 手续费精度(8 位 vs 5 位)待后端;部分字段(失败退款/导出文件名/状态枚举/仓位方向·均价·标记价·盈亏/二三级分类增删排序启停)仍待联调。
3. **QA 验收账号/环境待确认**。
4. gate 的 5 个文档 error 收口时补齐(复用清单、字段对账表、code-review 记录、F12 任务文案、本期列格式)。

## 恢复入口

- worktree `/Users/aven/github/PR-01988`,分支 `feature/PR-01988`(工作树干净)。
- 文档 `apps/web/docs_tdd/PR-01988/`:`product/00-feature-inventory.md`、`06-collaboration.md`、`14-self-test-cases.md`。
- 代码 Admin `apps/admin/src/apps/PredictionMarket/`(daily-income/categories/events/orders/positions/reconciliation/alerts/parameters 子模块齐全);Web `apps/web/src/apps/Prediction/`(PredictionTradeMan=F07 禁用态、埋点在 TradePanel/store)+ `apps/web/src/services/api/prediction`。
