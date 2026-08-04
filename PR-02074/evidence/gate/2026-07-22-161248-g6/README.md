# Gate Evidence — PR-02074 G6

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02074 |
| 阶段 | G6 |
| 日期 | 2026-07-22 |
| 验证人 | aven |
| 结论 | PASS |
| 统计 | total=42, fail=0, warn=2, waived=0 |
| 跳过代码规则 | 否 |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02074 G6` | 项目 gate | PASS | exit=0 |
| `verify-code-rules --project PR-02074` | 责任模块 / 改动文件 | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| CODE-MOCK-002 | warn | cannot scan mock residue (rg unavailable: ENOENT) | apps/web/docs_tdd/PR-02074 | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/crypto/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/finance/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/politics/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/search/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/sports/page.tsx<br>apps/web/src/app/[lang]/(with-header)/(with-footer)/prediction/world-cup/page.tsx<br>apps/web/src/app/[lang]/Providers.tsx<br>apps/web/src/apps/Prediction/WorldCup/EventTab.tsx<br>apps/web/src/apps/Prediction/WorldCup/MatchTab.tsx<br>apps/web/src/apps/Prediction/WorldCup/OngoingTab.tsx<br>apps/web/src/apps/Prediction/WorldCup/common/MatchCard.tsx<br>apps/web/src/apps/Prediction/WorldCup/common/format.ts<br>apps/web/src/apps/Prediction/WorldCup/common/ongoingGroup.test.ts<br>apps/web/src/apps/Prediction/WorldCup/common/types.ts<br>apps/web/src/apps/Prediction/WorldCup/index.tsx<br>apps/web/src/apps/Prediction/common/categories.test.ts<br>apps/web/src/apps/Prediction/common/categories.ts<br>apps/web/src/apps/Prediction/common/categorySelection.test.ts<br>apps/web/src/apps/Prediction/common/categorySelection.ts<br>apps/web/src/apps/Prediction/common/eventCardType.test.ts<br>apps/web/src/apps/Prediction/common/eventCardType.ts<br>apps/web/src/apps/Prediction/common/metadata.ts<br>apps/web/src/apps/Prediction/common/outcomeLabels.test.ts<br>apps/web/src/apps/Prediction/common/outcomeLabels.ts<br>apps/web/src/apps/Prediction/components/CategorySidebar.tsx<br>apps/web/src/apps/Prediction/components/CategoryTabs.tsx<br>apps/web/src/apps/Prediction/components/PredictionCategoryList.tsx<br>apps/web/src/apps/Prediction/index.tsx<br>apps/web/src/constants/pathnames.ts<br>apps/web/src/mocks/browser.ts<br>apps/web/src/mocks/fixtures/prediction.ts<br>apps/web/src/mocks/handlers/prediction.ts<br>apps/web/src/mocks/prediction.contract.test.ts<br>apps/web/src/mocks/useMockWorker.ts<br>apps/web/src/services/api/prediction/mapTagEventsToWorldCup.ts<br>apps/web/src/services/api/prediction/polymarket.test.ts<br>apps/web/src/services/api/prediction/polymarket.ts<br>apps/web/src/services/api/prediction/schemas.ts | apps/web/docs_tdd/PR-02074 | 待处理 / 已豁免 / 不适用 |

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
