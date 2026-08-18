# Gate Evidence — PR-02306 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02306 |
| 阶段 | G6 |
| 日期 | 2026-08-18 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=89, fail=3, warn=3, waived=1 |
| 分组 | documentation=71/77, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | FAIL（biome/tsc/vitest 实跑 5 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02306 G6` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-02306` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02306` | biome / tsc / vitest 实跑 | FAIL | exit=1 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-006 | waived | G3 frontend tasks include the MSW fallback task [waived: 纯前端密码校验规则修改，无任何 API / 数据请求（PRD 明确前端可闭环、不需要后端；00-feature-inventory §数据流 与 02-technical-design 数据流表均记为 N/A）。MSW 路线 B 针对数据请求型功能，本需求不适用，故 G3 前端 MSW fallback 任务 N/A。 · owner=用户（负责人） · until 2026-09-18] | ../docs_tdd/prds/PR-02306/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| CODE-MOCK-001 | warn | responsibility module paths unset; cannot scan mock residue (fill 责任模块目录 to enable) | ../docs_tdd/prds/PR-02306/product/00-feature-inventory.md | 待处理 / 已豁免 / 不适用 |
| DOC-CR-002 | error | code-review 有未处理 findings（需当场修或 waive/标 N/A）：CR-1(other) | ../docs_tdd/prds/PR-02306/agent/code-review.json | 待处理 / 已豁免 / 不适用 |
| DOC-CR-003 | warn | code-review.head(0000000000000000000000000000000000000000) 与当前 HEAD(7fd5b4a4e8a7) 不一致，review 可能已过时 | ../docs_tdd/prds/PR-02306/agent/code-review.json | 待处理 / 已豁免 / 不适用 |
| DOC-AC-002 | error | 本期功能缺验收结果：F01, F02, F03 | ../docs_tdd/prds/PR-02306/agent/acceptance-results.json | 待处理 / 已豁免 / 不适用 |
| DOC-AC-006 | warn | acceptance-results.head(0000000000000000000000000000000000000000) 与当前 HEAD(7fd5b4a4e8a7) 不一致，验收可能已过时 | ../docs_tdd/prds/PR-02306/agent/acceptance-results.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-001 | error | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/constants/regex.ts:22 TS1501 | apps/web/src/constants/regex.ts | 待处理 / 已豁免 / 不适用 |

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
| DOC-CR-002 | 阻塞 G6 | 待定 | code-review 有未处理 findings（需当场修或 waive/标 N/A）：CR-1(other) | OPEN |
| DOC-AC-002 | 阻塞 G6 | 待定 | 本期功能缺验收结果：F01, F02, F03 | OPEN |
| VERIFY-TYPE-001 | 阻塞 G6 | 待定 | apps/web 本次改动文件存在 1 处类型错误：apps/web/src/constants/regex.ts:22 TS1501 | OPEN |
