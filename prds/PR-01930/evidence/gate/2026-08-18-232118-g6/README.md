# Gate Evidence — PR-01930 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-01930 |
| 阶段 | G6 |
| 日期 | 2026-08-18 |
| 验证人 | aven |
| 结论 | PASS |
| 统计 | total=62, fail=0, warn=1, waived=2 |
| 分组 | documentation=52/54, implementation=0/0 |
| 跳过代码规则 | 否 |
| 机器事实层 | PASS（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-01930 G6` | 项目 gate | PASS | exit=0 |
| `verify-code-rules --project PR-01930` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-01930` | biome / tsc / vitest 实跑 | PASS | exit=0 |
| `set-project-stage PR-01930 G6` | README 机器行 / context-summary / PROJECTS.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| CODE-MOCK-002 | waived | mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only [waived: MSW 路线 B 退役显式延后到后续 PR（见 evidence/followup-deferred-to-next-pr.md D3）。残留仅 apps/admin/src/mocks/fixtures/menus.ts 等 dev-only fixture（NEXT_PUBLIC_ENABLE_MSW 才注册，prod build 短路），待 dev 验证真实核心接口 + 体验金管理菜单节点服务端就位后删除。 · owner=aven · until 2026-09-30] | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-002 | waived | MSW route B business mock residue found:<br>apps/admin/src/mocks/fixtures/menus.ts:1:// @mock-only [waived: 同 CODE-MOCK-002：MSW 路线 B 退役延后，dev-only 不入 prod 包。见 evidence/followup-deferred-to-next-pr.md D3。 · owner=aven · until 2026-09-30] | ../docs_tdd/prds/PR-01930 | 待处理 / 已豁免 / 不适用 |
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
| 无 | | | | CLOSED |
