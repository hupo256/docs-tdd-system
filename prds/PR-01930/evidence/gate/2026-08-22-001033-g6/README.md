# Gate Evidence — PR-01930 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-01930 |
| 阶段 | G6 |
| 日期 | 2026-08-22 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=62, fail=1, warn=1, waived=3 |
| 分组 | documentation=52/54, implementation=0/0 |
| 跳过代码规则 | 否 |
| 机器事实层 | FAIL（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-01930 G6` | 项目 gate | PASS | exit=0 |
| `verify-code-rules --project PR-01930` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-01930` | biome / tsc / vitest 实跑 | FAIL | exit=1 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| CODE-MOCK-002 | waived | mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only [waived: MSW 路线 B 核心 4 接口(manualInvalidRecord/manualInvalidSummary GET·POST/manualInvalid)已部署 dev 并按 §8.4.2 逐接口拆除(2026-08-21)：handler + contractFixtures + mockContract 测试已删，browser.ts 只余 menuHandlers。残留仅 dev-only menu 注入(src/mocks/handlers/menu.ts + fixtures/menus.ts)——仅 NODE_ENV==='development' 注册(无 NEXT_PUBLIC 开关，对齐 PR-01947 先例)、prod build 短路 tree-shake 出包。待服务端菜单树下发「体验金手动失效管理」节点后删除。 · owner=aven · until 2026-09-30] | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-002 | waived | MSW route B business mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only [waived: 同 CODE-MOCK-002：核心 4 接口 handler 已随 dev 部署拆除，仅余 dev-only menu 注入(NODE_ENV 短路，不入 prod 包)，待服务端菜单节点就位后删除。 · owner=aven · until 2026-09-30] | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| VERIFY-BIOME-001 | error | biome check 未通过（biome 报 9 error / 1 warning：apps/admin/src/services/api/financeAudit.ts:2 lint/correctness/noUnusedImports; apps/admin/src/services/api/financeAudit.ts:65 lint/suspicious/noExplicitAny; apps/admin/src/services/api/financeAudit.ts:66 lint/suspicious/noExplicitAny; apps/admin/src/services/api/financeAudit.ts:67 lint/suspicious/noExplicitAny）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-01930/2026-08-22T00-10-20-776Z-biome-check.log |  | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-001 | waived | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx:220 TS2322 | apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-002 | warn | 以下逻辑文件导出了函数但无同名/同目录 __tests__ 单测：apps/admin/src/apps/TrialBalanceManualInvalidate/utils/useItems.ts | apps/admin/src/apps/TrialBalanceManualInvalidate/utils/useItems.ts | 待处理 / 已豁免 / 不适用 |

## Browser / UI Evidence

| 页面 / 场景 | URL | 视口 / 主题 | 操作步骤 | 结果 |
|-------------|-----|-------------|----------|------|
| 本脚本不执行浏览器自测 | 待人工补充 | 待人工补充 | 待人工补充 | 未覆盖 |

## Code Review Evidence

| 时间 | 命令 | findings | 处理结论 | 备注 |
|------|------|----------|----------|------|
| 待补充 | /code-review | 待补充 | 已修 / 豁免 / 不适用 | 同步到 `product/06-collaboration.md` |

## Blockers / Risks

| 项 | 影响 | 责任人 | 下一步 | 状态 |
|----|------|--------|--------|------|
| VERIFY-BIOME-001 | 阻塞 G6 | 待定 | biome check 未通过（biome 报 9 error / 1 warning：apps/admin/src/services/api/financeAudit.ts:2 lint/correctness/noUnusedImports; apps/admin/src/services/api/financeAudit.ts:65 lint/suspicious/noExplicitAny; apps/admin/src/services/api/financeAudit.ts:66 lint/suspicious/noExplicitAny; apps/admin/src/services/api/financeAudit.ts:67 lint/suspicious/noExplicitAny）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-01930/2026-08-22T00-10-20-776Z-biome-check.log | OPEN |
