# Gate Evidence — PR-02074 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02074 |
| 阶段 | G6 |
| 日期 | 2026-09-01 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=67, fail=4, warn=5, waived=0 |
| 分组 | documentation=50/55, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | FAIL（biome/tsc/vitest 实跑 5 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02074 G6` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-02074` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02074` | biome / tsc / vitest 实跑 | FAIL | exit=1 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| VERIFY-G5-002 | warn | G5 status is completed / not-applicable (got blocked) | ../docs_tdd/prds/PR-02074/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-G5-003 | warn | G5 completion has existing evidence paths, or not-applicable/pending-reconcile has a concrete reason | ../docs_tdd/prds/PR-02074/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/crypto/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/finance/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/politics/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/search/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/sports/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/world-cup/page.tsx<br>apps/web/src/components/Empty.tsx<br>apps/web/src/constants/pathnames.ts<br>apps/web/src/proxy.ts | ../docs_tdd/prds/PR-02074 | 待处理 / 已豁免 / 不适用 |
| VERIFY-STAGE-001 | error | G6 requires a persisted successful G5 run in agent/gate-history.json | ../docs_tdd/prds/PR-02074/agent/gate-history.json | 待处理 / 已豁免 / 不适用 |
| DOC-ASSUM-001 | error | G6 出口前必须销账的 open 假设未销账：ASM-010(backend→api-ready)（销账=改 status 并写 resolution；确需带风险交付走 rule-waivers.json 具名带期限豁免） | ../docs_tdd/prds/PR-02074/agent/assumptions.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-BIOME-001 | error | biome check 未通过（biome 报 1 error / 2 warning：apps/web/src/apps/Prediction/WorldCup/index.tsx:71 lint/correctness/useExhaustiveDependencies; apps/web/src/apps/Prediction/components/PredictionCategoryList.tsx:38 lint/correctness/useExhaustiveDependencies; apps/web-next/src/platform/domain/web/endpoints/getTagEventsListEndpoint.ts format）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02074/2026-09-01T12-47-01-065Z-biome-check.log |  | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-002 | warn | 改动文件之外的 tsc 报错 429 > 基线 193，疑似共享类型改动涟漪 | apps/web | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-001 | error | vitest 未通过（vitest 退出码非 0）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02074/2026-09-01T12-47-07-197Z-vitest-related.log |  | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-002 | warn | 以下逻辑文件导出了函数但无同名/同目录 __tests__ 单测：apps/web/src/apps/Prediction/WorldCup/common/format.ts, apps/web-next/src/apps/Prediction/mappers/mapTagEventsToPrediction.ts | apps/web/src/apps/Prediction/WorldCup/common/format.ts | 待处理 / 已豁免 / 不适用 |

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
| VERIFY-STAGE-001 | 阻塞 G6 | 待定 | G6 requires a persisted successful G5 run in agent/gate-history.json | OPEN |
| DOC-ASSUM-001 | 阻塞 G6 | 待定 | G6 出口前必须销账的 open 假设未销账：ASM-010(backend→api-ready)（销账=改 status 并写 resolution；确需带风险交付走 rule-waivers.json 具名带期限豁免） | OPEN |
| VERIFY-BIOME-001 | 阻塞 G6 | 待定 | biome check 未通过（biome 报 1 error / 2 warning：apps/web/src/apps/Prediction/WorldCup/index.tsx:71 lint/correctness/useExhaustiveDependencies; apps/web/src/apps/Prediction/components/PredictionCategoryList.tsx:38 lint/correctness/useExhaustiveDependencies; apps/web-next/src/platform/domain/web/endpoints/getTagEventsListEndpoint.ts format）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02074/2026-09-01T12-47-01-065Z-biome-check.log | OPEN |
| VERIFY-TEST-001 | 阻塞 G6 | 待定 | vitest 未通过（vitest 退出码非 0）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02074/2026-09-01T12-47-07-197Z-vitest-related.log | OPEN |
