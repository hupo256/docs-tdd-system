# Gate Evidence — PR-02172 G8

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02172 |
| 阶段 | G8 |
| 日期 | 2026-08-19 |
| 验证人 | aven |
| 结论 | PASS |
| 统计 | total=89, fail=0, warn=3, waived=2 |
| 分组 | documentation=70/74, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | PASS（biome/tsc/vitest 实跑 8 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02172 G8` | 项目 gate | PASS | exit=0 |
| `verify-code-rules --project PR-02172` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02172` | biome / tsc / vitest 实跑 | PASS | exit=0 |
| `set-project-stage PR-02172 G8` | README 机器行 / context-summary / PROJECTS.md | PASS | exit=0 |
| `render-delivery-summary --project PR-02172 --write` | agent/delivery-summary.machine.md | PASS | exit=0 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-006 | warn | G3 frontend tasks include the MSW fallback task | ../docs_tdd/prds/PR-02172/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| CODE-MOCK-002 | waived | mock residue found:<br>apps/admin/legacy-admin/src/views/userManager/other_information/a_third_party_bind_history.vue:2:     当前接口未就绪，service 层临时 mock（见 memberManager.js @mock-only），真实字段以 6025 response 为准。 --><br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:352:  // @mock-only 6025 接口后端未就绪，临时返回 mock 数据；接口 ready 后删除下方 mock 分支即恢复真实请求。<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:355:    const USE_MOCK_6025 = true; // @mock-only 删除本行与下方 if 块即恢复真实请求<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:356:    if (USE_MOCK_6025) { [waived: F13 第三方账号绑定关联历史依赖后端接口 6025 /platformAccountOperation/pageList，后端 2026-08-19 反馈接口未就绪。按 docs_tdd Mock 策略在 legacy-admin(Vue2) service 层（memberManager.js platform_account_operation_page_list）做隔离 mock，@mock-only + USE_MOCK_6025 标记，组件/mapper 不写 mock 分支。真实接口 ready 后删除 mock 分支恢复 axios，并按 6025 response 对账列 prop（G5 reconcile）。属临时脚手架，非业务逻辑常驻 mock。 · owner=用户（负责人） · until 2026-09-19] | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-002 | waived | MSW route B business mock residue found:<br>apps/admin/legacy-admin/src/views/userManager/other_information/a_third_party_bind_history.vue:2:     当前接口未就绪，service 层临时 mock（见 memberManager.js @mock-only），真实字段以 6025 response 为准。 --><br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:352:  // @mock-only 6025 接口后端未就绪，临时返回 mock 数据；接口 ready 后删除下方 mock 分支即恢复真实请求。<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:355:    const USE_MOCK_6025 = true; // @mock-only 删除本行与下方 if 块即恢复真实请求<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:356:    if (USE_MOCK_6025) { [waived: 同 CODE-MOCK-002：F13 落 legacy-admin(Vue2)，该栈无 MSW 基建，不适用 MSW 路线 B；采用 service 层隔离 mock 顶替未就绪的 6025 接口，@mock-only 标记、单点可删。MSW 路线 B 决策针对 apps/web(React)，本条残留来自 Vue2 admin 临时 mock，非 MSW handler 残留。真实接口 ready 后一并拆除。 · owner=用户（负责人） · until 2026-09-19] | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/app/[lang]/(with-header)/layout.tsx<br>apps/web/src/components/FacebookLoginSdk/index.tsx<br>apps/web/src/components/FacebookLoginSdk/stores.ts<br>apps/web/src/components/TelegramLoginSdk/index.tsx<br>apps/web/src/components/TelegramLoginSdk/stores.ts | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |
| VERIFY-TEST-001 | warn | 本次有 ts/tsx 改动但未找到任何相关测试文件，无单测证据 |  | 待处理 / 已豁免 / 不适用 |

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
