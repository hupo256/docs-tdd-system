# PR-02006 Scope And Phases

## 一句话范围

优化 TradFi 板块币种体验：覆盖 Header TradFi 浮层、交易页交易对弹层、TradFi 落地页、行情页 TradFi 板块；Admin 币种别名多语言配置 F19-F21 属于本期需求，当前由本仓 legacy admin 币种编辑页承接。

## 当前结论

| 项 | 结论 |
|----|------|
| PRD | 已同步：`../inbox/lark-sync/prd-content.md` |
| 代码基线 | 已存在 PR-01973 TradFi 落地页、行情页、Header 入口和 Futures MarketList |
| G2 scope | 已确认：本仓覆盖 Web/Header/交易页/行情页/落地页，以及 legacy admin 币种编辑页 F19-F21 后台配置项 |
| 正式 UI | PRD 中 UI 地址为空，已确认先按原型链接和内嵌截图开发，正式 UI 后补 |
| API | 未提供，已确认允许 mock-first；后续再对齐 public_info / ticker / Admin 币种配置接口字段 |
| QA / 验收 | G6 定向自测已完成；PRD §七验收标准已由截图 OCR 补齐，G7 待 QA sheet / 正式 UI / 真实 API 联调 |

## PRD 验收标准

> 来源：用户补充的 PRD §七截图，2026-06-20 本地 OCR 识别后补入。

| 验收项 | 预期结果 |
|--------|----------|
| 多语言 | 落地页所有文案（包括动态数据外的静态文案）均已提交多语言处理 |
| H5 适配 | 落地页在主流移动端机型（iOS / Android）H5 环境下布局无变形、无遮挡、无横向溢出 |
| H5 交互 | 排序、Tab 切换等交互在 H5 下功能正常 |

## 阶段建议

| 阶段 | 范围 | 进入条件 | 交付物 |
|------|------|----------|--------|
| G0/G1 | PRD 同步、清单、文档、代码基线盘点 | 已完成 | `product/00-07`、`engineering/development-rules.md` |
| G2 | 确认每条做 / 不做 / 延期 | 已完成 | F01-F23 全部本期做 |
| G3 | API / Mock 准备 | 已完成 mock-first；真实字段待联调 | API 契约、mapper 设计、Mock 场景 |
| G4 | Web 实现 | 已完成并提交 `ea8c24750` | Header / Futures / TradFi / Markets 代码改动 |
| G4-Admin | Admin 实现 | 已完成并提交 `ea8c24750` | legacy admin 币种编辑页承接 F19-F21 |
| G6 | 自测 | 已完成定向自测 | Biome、Vitest、headless Chrome evidence；全量 typecheck 被范围外既有错误阻断 |
| G7 | QA 回归 | 待 QA sheet / 正式 UI / 真实 API | 用例执行结果；未提供则记录跳过 |

## 当前阶段结论（2026-06-22）

PR-02006 当前处于 **G6 自测完成，等待 G7 QA / 联调准入**。本仓代码已在 `feature/PR-02006` 提交 `ea8c24750 feat: PR-02006 tradfi market experience`，worktree 干净。

| 项 | 当前状态 | 证据 |
|----|----------|------|
| 功能实现 | F01-F23 已实现，包含 Admin F19-F21 | `product/04-frontend-tasks.md` 全部标记已实现；提交 `ea8c24750` |
| 格式检查 | 通过 | `pnpm exec biome check --write --no-errors-on-unmatched <touched files>` |
| 定向单测 | 通过 | 2026-06-21 提交前 `pnpm vitest --run ...`：5 files / 46 tests |
| UI evidence | 已归档 | `evidence/ui-ux/2026-06-20-headless-chrome/TEST-REPORT.md` |
| 全量 typecheck | 未作为通过门禁 | 被 PR-02006 范围外既有 TS 错误阻断，已记录在 evidence |
| G7 准入 | 待补 | QA sheet 明细、正式 UI 差异、真实 API / Admin 字段联调 |

## 默认不裁剪

G0 初稿不裁剪任何 PRD 条目。若要拆期，必须在 `00-feature-inventory.md` 和 `06-collaboration.md` 写明确认人、日期、验收影响。

## 本仓范围调整

| 日期 | 调整 | 结论 |
|------|------|------|
| 2026-06-20 | Admin F19-F21 | 用户重新确认 PR-02006 确实包含后台功能；当前 `apps/admin/legacy-admin/src/views/exchangeTradeConfig/digitalDigitalTrade/coin_manager_edit.vue` 改动保留，用于承接归属板块与 TradFi 多语言别名配置 |

