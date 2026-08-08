# Gate Evidence — PR-01947 G5

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-01947 |
| 阶段 | G5 |
| 日期 | 2026-08-01 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=50, fail=3, warn=5, waived=0 |
| 分组 | documentation=36/44, implementation=6/6 |
| 跳过代码规则 | 否 |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-01947 G5` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-01947` | 责任模块 / 改动文件 | PASS | exit=0 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-002 | warn | G3 API contract contains MSW checklist / landing preconditions | apps/web/docs_tdd/prds/PR-01947/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-003 | warn | G3 MSW checklist covers normal/empty/error/unauthorized/edge scenarios | apps/web/docs_tdd/prds/PR-01947/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-006 | warn | G3 frontend tasks include the MSW fallback task | apps/web/docs_tdd/prds/PR-01947/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| DOC-G3-007 | warn | G3 collaboration records the MSW fallback decision / checklist | apps/web/docs_tdd/prds/PR-01947/product/06-collaboration.md | 待处理 / 已豁免 / 不适用 |
| DOC-G5-003 | error | API contract records copy contract table | apps/web/docs_tdd/prds/PR-01947/product/03-api-contract.md | 待处理 / 已豁免 / 不适用 |
| VERIFY-G5-002 | error | G5 status is completed or not-applicable (got blocked) | apps/web/docs_tdd/prds/PR-01947/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-G5-003 | error | G5 completion has existing evidence paths, or not-applicable has a concrete reason | apps/web/docs_tdd/prds/PR-01947/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/app/[lang]/Providers.tsx<br>apps/web/src/components/modals/OpenContractModal/OpenContractModal.tsx<br>apps/web/src/types/copyTrading.ts<br>apps/web/src/utils/hooks/useServiceWorkerRegistration.ts<br>packages/ui/components/select/Select.tsx<br>packages/ui/components/slider/index.tsx | apps/web/docs_tdd/prds/PR-01947 | 待处理 / 已豁免 / 不适用 |

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
| DOC-G5-003 | 阻塞 G5 | 待定 | API contract records copy contract table | OPEN |
| VERIFY-G5-002 | 阻塞 G5 | 待定 | G5 status is completed or not-applicable (got blocked) | OPEN |
| VERIFY-G5-003 | 阻塞 G5 | 待定 | G5 completion has existing evidence paths, or not-applicable has a concrete reason | OPEN |
