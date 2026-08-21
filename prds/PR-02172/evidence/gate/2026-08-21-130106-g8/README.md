# Gate Evidence — PR-02172 G8

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02172 |
| 阶段 | G8 |
| 日期 | 2026-08-21 |
| 验证人 | aven |
| 结论 | BLOCKED |
| 统计 | total=89, fail=1, warn=5, waived=0 |
| 分组 | documentation=72/74, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | FAIL（biome/tsc/vitest 实跑 8 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02172 G8` | 项目 gate | PASS | exit=0 |
| `verify-code-rules --project PR-02172` | 责任模块 / 改动文件 | FAIL | exit=1 |
| `verify-build-quality --project PR-02172` | biome / tsc / vitest 实跑 | FAIL | exit=1 |
| `update-project-index --write` | PROJECTS.md | PASS | exit=0 |
| `render-delivery-summary --project PR-02172 --write` | agent/delivery-summary.machine.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-006 | warn | G3 frontend tasks include the MSW fallback task | ../docs_tdd/prds/PR-02172/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/app/[lang]/(with-header)/layout.tsx<br>apps/web/src/app/oauth/apple/callback/page.tsx<br>apps/web/src/components/FacebookLoginSdk/index.tsx<br>apps/web/src/components/FacebookLoginSdk/stores.ts<br>apps/web/src/components/TelegramLoginSdk/index.tsx<br>apps/web/src/components/TelegramLoginSdk/stores.ts<br>apps/web/src/services/api/user.test.ts | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-002 | warn | 改动文件之外的 tsc 报错 172 > 基线 157，疑似共享类型改动涟漪 | apps/admin | 待处理 / 已豁免 / 不适用 |
| VERIFY-TYPE-002 | warn | 改动文件之外的 tsc 报错 351 > 基线 181，疑似共享类型改动涟漪 | apps/web | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-001 | error | vitest 未通过（vitest 退出码非 0）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02172/2026-08-21T13-00-59-889Z-vitest-related.log |  | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-002 | warn | 以下逻辑文件导出了函数但无同名/同目录 __tests__ 单测：apps/web-next/src/apps/Futures/utils/util.ts, apps/web-next/src/utils/hooks/useCountdown.ts, apps/web-next/src/utils/hooks/useGetCountryCode.ts, apps/web-next/src/utils/hooks/useSmsErrorBar.ts, apps/web-next/src/utils/phonePatterns.ts | apps/web-next/src/apps/Futures/utils/util.ts | 待处理 / 已豁免 / 不适用 |

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
| VERIFY-TEST-001 | 阻塞 G8 | 待定 | vitest 未通过（vitest 退出码非 0）；详见 /var/folders/07/f0k63_dx0yb54r7bk3dx0ddr0000gp/T/docs-tdd-logs/PR-02172/2026-08-21T13-00-59-889Z-vitest-related.log | OPEN |
