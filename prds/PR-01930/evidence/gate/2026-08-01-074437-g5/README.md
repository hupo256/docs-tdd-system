# Gate Evidence — PR-01930 G5

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-01930 |
| 阶段 | G5 |
| 日期 | 2026-08-01 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=44, fail=4, warn=0, waived=0 |
| 分组 | documentation=40/44, implementation=0/0 |
| 跳过代码规则 | 否 |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-01930 G5` | 项目 gate | FAIL | exit=1 |
| `verify-code-rules --project PR-01930` | 责任模块 / 改动文件 | PASS | exit=0 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| VERIFY-G5-002 | error | G5 status is completed or not-applicable (got blocked) | apps/web/docs_tdd/prds/PR-01930/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| VERIFY-G5-003 | error | G5 completion has existing evidence paths, or not-applicable has a concrete reason | apps/web/docs_tdd/prds/PR-01930/agent/stage-status.json | 待处理 / 已豁免 / 不适用 |
| CODE-MOCK-002 | error | mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only | apps/web/docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-002 | error | MSW route B business mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only | apps/web/docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |

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
| VERIFY-G5-002 | 阻塞 G5 | 待定 | G5 status is completed or not-applicable (got blocked) | OPEN |
| VERIFY-G5-003 | 阻塞 G5 | 待定 | G5 completion has existing evidence paths, or not-applicable has a concrete reason | OPEN |
| CODE-MOCK-002 | 阻塞 G5 | 待定 | mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only | OPEN |
| CODE-MSW-002 | 阻塞 G5 | 待定 | MSW route B business mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only | OPEN |
