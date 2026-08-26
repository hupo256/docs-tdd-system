# Gate Evidence — PR-01930 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-01930 |
| 阶段 | G6 |
| 日期 | 2026-08-26 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=64, fail=1, warn=4, waived=2 |
| 分组 | documentation=51/56, implementation=0/0 |
| 跳过代码规则 | 否 |
| 机器事实层 | PASS（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-01930 G6` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-01930` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-01930` | biome / tsc / vitest 实跑 | PASS | exit=0 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-CONFIRM-001 | warn | G5=completed 断言了人工确认，但缺 confirmedBy（人工确认签名）——README 人机分界要求 G5 以人工确认为锚点 | ../docs_tdd/prds/PR-01930/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| CODE-MOCK-002 | error | mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-002 | waived | MSW route B business mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only [waived: 同 CODE-MOCK-002：核心 4 接口 handler 已随 dev 部署拆除，仅余 dev-only menu 注入(NODE_ENV 短路，不入 prod 包)，待服务端菜单节点就位后删除。 · owner=aven · until 2026-09-30] | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/apps/Futures/components/FuturesAssetPanel/Assets.tsx<br>apps/web/src/apps/Futures/utils/marginRate.test.ts<br>apps/web/src/apps/Futures/utils/marginRate.ts | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| DOC-WAIVER-004 | warn | waiver for CODE-MOCK-002 is ignored because the rule is non-waivable | ../docs_tdd/prds/PR-01930/agent/rule-waivers.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-001 | waived | apps/web 本次改动文件存在 13 处类型错误：apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx:220 TS2322; apps/web/src/apps/Futures/utils/marginRate.test.ts:47 TS2322; apps/web/src/apps/Futures/utils/marginRate.test.ts:47 TS2322; apps/web/src/apps/Futures/utils/marginRate.test.ts:60 TS2322; apps/web/src/apps/Futures/utils/marginRate.test.ts:60 TS2322 … | apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx | 待处理 / 已豁免 / 不适用 |
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
| CODE-MOCK-002 | 阻塞 G6 | 待定 | mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only | OPEN |
