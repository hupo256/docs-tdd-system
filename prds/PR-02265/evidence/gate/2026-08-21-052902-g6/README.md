# Gate Evidence — PR-02265 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02265 |
| 阶段 | G6 |
| 日期 | 2026-08-21 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=88, fail=3, warn=1, waived=7 |
| 分组 | documentation=70/80, implementation=0/0 |
| 跳过代码规则 | 否 |
| 机器事实层 | FAIL（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02265 G6` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-02265` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02265` | biome / tsc / vitest 实跑 | FAIL | exit=1 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-002 | waived | G3 API contract contains MSW checklist / landing preconditions [waived: 同 DOC-G3-001：不采用 MSW，无落地前置清单 · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-003 | waived | G3 MSW checklist covers normal/empty/error/unauthorized/edge scenarios [waived: 同 DOC-G3-001：无 MSW handler 场景矩阵 · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-004 | waived | G3 MSW route records schema contract test requirement [waived: 同 DOC-G3-001：无 MSW 契约测试（Vue admin 非 zod 体系；React 侧接口已存在） · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-005 | waived | G3 MSW route records dev-only worker registration [waived: 同 DOC-G3-001：无 MSW dev-only worker · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-006 | waived | G3 frontend tasks include the MSW fallback task [waived: 同 DOC-G3-001：无 MSW fallback 任务 · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-007 | waived | G3 collaboration records the MSW fallback decision / checklist [waived: 同 DOC-G3-001：协作记录改为记 MSW 豁免决策而非落地清单 · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/06-collaboration.md | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-001 | waived | MSW route B records contract/schema verification [waived: 同 DOC-G3-001：项目只复用既有真实接口且明确不采用 MSW，因此不存在 handler schema 契约测试 · owner=项目负责人 · until 2026-12-31] | ../docs_tdd/prds/PR-02265/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-003 | warn | MSW route B records handler removal/disable or test-only disposition before G6 handoff | ../docs_tdd/prds/PR-02265/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-AC-002 | error | 本期功能没有 passed 验收：F04 | ../docs_tdd/prds/PR-02265/agent/acceptance-results.json | 待处理 / 已豁免 / 不适用 |
| DOC-AC-003 | error | 验收仍有 failed/blocked：AC-4, AC-13 | ../docs_tdd/prds/PR-02265/agent/acceptance-results.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-001 | error | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/apps/Orders/Futures/FuturesHistoryTransactionOrder/helper.ts:8 TS2339 | apps/web/src/apps/Orders/Futures/FuturesHistoryTransactionOrder/helper.ts | 待处理 / 已豁免 / 不适用 |

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
| DOC-AC-002 | 阻塞 G6 | 待定 | 本期功能没有 passed 验收：F04 | OPEN |
| DOC-AC-003 | 阻塞 G6 | 待定 | 验收仍有 failed/blocked：AC-4, AC-13 | OPEN |
| VERIFY-TYPE-001 | 阻塞 G6 | 待定 | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/apps/Orders/Futures/FuturesHistoryTransactionOrder/helper.ts:8 TS2339 | OPEN |
