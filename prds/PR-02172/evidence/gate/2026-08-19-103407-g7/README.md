# Gate Evidence — PR-02172 G7

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02172 |
| 阶段 | G7 |
| 日期 | 2026-08-19 |
| 验证人 | aven |
| 结论 | PASS |
| 统计 | total=87, fail=0, warn=2, waived=2 |
| 分组 | documentation=69/73, implementation=6/6 |
| 跳过代码规则 | 否 |
| 机器事实层 | PASS（biome/tsc/vitest 实跑 7 条结论） |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `verify-project-gate PR-02172 G7` | 项目 gate | PASS | exit=0 |
| `verify-code-rules --project PR-02172` | 责任模块 / 改动文件 | PASS | exit=0 |
| `verify-build-quality --project PR-02172` | biome / tsc / vitest 实跑 | PASS | exit=0 |
| `set-project-stage PR-02172 G7` | README 机器行 / context-summary / PROJECTS.md | FAIL | exit=1 |

## Gate Findings

| Rule ID | Severity | Message | File | Disposition |
|---------|----------|---------|------|-------------|
| DOC-G3-006 | warn | G3 frontend tasks include the MSW fallback task | ../docs_tdd/prds/PR-02172/product/04-frontend-tasks.md | 待处理 / 已豁免 / 不适用 |
| CODE-MOCK-002 | waived | mock residue found:<br>apps/admin/legacy-admin/src/views/userManager/other_information/a_third_party_bind_history.vue:2:     当前接口未就绪，service 层临时 mock（见 memberManager.js @mock-only），mock 已对齐正式契约字段。 --><br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:353:  // @mock-only 6025 接口后端未就绪，mock 数据已对齐正式契约字段；接口上线后将 USE_MOCK_6025 置 false（或删除 if 块）即恢复真实请求，无需改动组件。<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:356:    const USE_MOCK_6025 = true; // @mock-only 置 false（或删除下方 if 块）即恢复真实请求<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:357:    if (USE_MOCK_6025) { [waived: F13 第三方账号绑定关联历史依赖后端接口 6025 /platformAccountOperation/pageList。后端 2026-08-19 已提供正式契约（请求 {uid,pageNum,pageSize}，响应 list[] 含 operationType/platformCode/account/createTime 等），legacy-admin service 层 mock 数据与组件列已逐字对齐该契约（见 evidence/g5-reconcile/README.md）；但后端服务尚未部署到 DEV，故 service 层保留 @mock-only + USE_MOCK_6025 隔离 mock，组件/mapper 不写 mock 分支。接口上线后将 USE_MOCK_6025 置 false（或删除 if 块）即恢复真实请求，无需改组件。属临时脚手架，非业务常驻 mock。 · owner=用户（负责人） · until 2026-09-19] | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |
| CODE-MSW-002 | waived | MSW route B business mock residue found:<br>apps/admin/legacy-admin/src/views/userManager/other_information/a_third_party_bind_history.vue:2:     当前接口未就绪，service 层临时 mock（见 memberManager.js @mock-only），mock 已对齐正式契约字段。 --><br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:353:  // @mock-only 6025 接口后端未就绪，mock 数据已对齐正式契约字段；接口上线后将 USE_MOCK_6025 置 false（或删除 if 块）即恢复真实请求，无需改动组件。<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:356:    const USE_MOCK_6025 = true; // @mock-only 置 false（或删除下方 if 块）即恢复真实请求<br>apps/admin/legacy-admin/src/api/userManager/memberManager.js:357:    if (USE_MOCK_6025) { [waived: 同 CODE-MOCK-002：F13 落 legacy-admin(Vue2)，该栈无 MSW 基建，不适用 MSW 路线 B；采用 service 层隔离 mock 顶替未就绪的 6025 接口，@mock-only 标记、单点可删。MSW 路线 B 决策针对 apps/web(React)，本条残留来自 Vue2 admin 临时 mock，非 MSW handler 残留。真实接口 ready 后一并拆除。 · owner=用户（负责人） · until 2026-09-19] | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |
| CODE-SCOPE-001 | warn | changed files outside 责任模块目录 (confirm not out-of-scope, §1.1):<br>apps/web/src/app/[lang]/(with-header)/layout.tsx<br>apps/web/src/components/FacebookLoginSdk/index.tsx<br>apps/web/src/components/FacebookLoginSdk/stores.ts<br>apps/web/src/components/TelegramLoginSdk/index.tsx<br>apps/web/src/components/TelegramLoginSdk/stores.ts<br>apps/web/src/services/api/user.test.ts | ../docs_tdd/prds/PR-02172 | 待处理 / 已豁免 / 不适用 |

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
