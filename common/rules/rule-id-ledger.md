# Rule ID 完整台账（项目阶段 gate）

> 从 [rule-ids-and-gates.md](./rule-ids-and-gates.md) §5 拆出的纯查表：`verify-project-gate.mjs` 实装的**阶段 gate 类**全部 Rule ID、触发 gate、机器检查与严重度。
> `CODE-*` 代码扫描类见 [rule-ids-and-gates.md §3](./rule-ids-and-gates.md)、`VERIFY-*` 机器事实层见 §3.5、`DOC-WAIVER-*` 见 §4；本文补齐阶段 gate 类。
> **新增/删除脚本里的 ID 必须同步本台账**，否则 `check-doc-budget.mjs` 校验 5 失败（脚本 ID ⊄ 台账，跨本文件与 rule-ids-and-gates.md 一起核对）。
> 本文是机器查表、单调增长，从不路由进任何 context pack，故在 check-doc-budget 里登记为 COVERAGE_EXEMPT（同 CHANGELOG-archive.md）。

| Rule ID | 触发 gate | 机器检查 | 严重度 |
|---------|-----------|----------|--------|
| `DOC-PRD-001` | G0+（pilot） | PRD source manifest 存在，项目 ID、sources、items 结构有效 | error（experimental） |
| `DOC-PRD-002` | G0+（pilot） | manifest 登记的 PRD source 文件存在且位于 `docs_tdd` | error（experimental） |
| `DOC-PRD-003` | G0+（pilot） | PRD 图片、表格和 embed 均进入 intake 清单且无陈旧项 | error（experimental） |
| `DOC-PRD-004` | G0+（pilot） | PRD rich-media source ID 唯一 | error（experimental） |
| `DOC-PRD-005` | G2+（pilot） | rich-media 输入均已读取、分类、摘要并关联证据 | error（experimental） |
| `DOC-PRD-006` | G2+（pilot） | requirement 输入映射 Feature ID，decorative 输入有处置结论 | error（experimental） |
| `DOC-PRD-007` | G2+（pilot） | requirement source ID 与 Feature ID 可追溯到前端任务 | error（experimental） |
| `DOC-PRD-008` | G0+（pilot） | PRD source 内容 hash 未相对 manifest 漂移 | error（experimental） |
| `DOC-PRD-009` | G2+（pilot） | 已确认的 PRD intake fingerprint 与当前输入一致 | error（experimental） |
| `DOC-PRD-010` | G0+（pilot） | 远端 Lark PRD 正文 hash 与 intake baseline 一致。真漂移 / 无基线恒 fail-closed；网络·权限·CLI 拉取失败仅在基线过旧（>7d）或 G5+ 时升级阻断，否则告警 | error / warn（分级，experimental） |
| `DOC-STRUCT-001` | G0+ | 项目目录存在 | error |
| `DOC-STRUCT-002` | G0+ | `README.md` 存在 | error |
| `DOC-STRUCT-003` | G0+ | `product/00-feature-inventory.md` 存在 | error |
| `DOC-STRUCT-004` | G0+ | `product/01-scope-and-phases.md` 存在 | error |
| `DOC-STRUCT-005` | G0+ | `product/02-technical-design.md` 存在 | error |
| `DOC-STRUCT-006` | G0+ | `product/03-api-contract.md` 存在 | error |
| `DOC-STRUCT-007` | G0+ | `product/04-frontend-tasks.md` 存在 | error |
| `DOC-STRUCT-008` | G0+ | `product/05-ui-and-interaction.md` 存在 | error |
| `DOC-STRUCT-009` | G0+ | `product/06-collaboration.md` 存在 | error |
| `DOC-STRUCT-010` | G0+ | `product/07-figma-spec.md` 存在 | error |
| `DOC-STRUCT-011` | G0+ | `engineering/development-rules.md` 存在 | error |
| `DOC-STRUCT-012` | G0+ | `agent/README.md` 存在 | error |
| `DOC-G0-001` | G0+ | 功能清单记录 PRD 来源 | error |
| `DOC-G0-002` | G0+ | 有 `## 功能清单` 章节 | error |
| `DOC-G0-003` | G0+ | 有 `## 验收标准对照` 章节 | error |
| `DOC-G0-004` | G0+ | 有 `## PRD 未完全可读内容` 章节 | warn |
| `DOC-G1-001` | G1+ | scope 文档记录本期范围 | error |
| `DOC-G1-002` | G1+ | 技术方案包含复用盘点初稿 | error |
| `DOC-G1-003` | G1+ | 前端任务文档包含任务清单 | error |
| `DOC-G1-004` | G1+ | 协作文档记录决策、差异或待确认项 | error |
| `DOC-G2-001` | G2+ | 功能清单无阻断占位 | error |
| `DOC-G2-002` | G2+ | G2 确认人和日期已填 | error |
| `DOC-G2-003` | G2+ | 功能清单至少一行 | error |
| `DOC-G2-004` | G2+ | 每条功能 `本期=做/不做/延期` | error |
| `DOC-G2-005` | G2+ | 本期做的功能 ID 都进 `04-frontend-tasks.md` | error |
| `DOC-G3-001` | G3+ | API 契约记录 mock 路线为 MSW 路线 B | error |
| `DOC-G3-002` | G3+ | API 契约包含 MSW 清单 / 落地前置 | error |
| `DOC-G3-003` | G3+ | API 契约记录 normal/empty/error/unauthorized/edge 场景 | error |
| `DOC-G3-004` | G3+ | API 契约记录真实 schema 契约测试 | error |
| `DOC-G3-005` | G3+ | API 契约记录 dev-only worker 注册 | error |
| `DOC-G3-006` | G3+ | 前端任务包含 MSW fallback 任务 | error |
| `DOC-G3-007` | G3+ | 协作记录包含 MSW fallback 决策 / 清单 | error |
| `DOC-G3-IMPL-001` | G3+ | `agent/msw-manifest.json` 可解析 | warn（experimental） |
| `DOC-G3-IMPL-002` | G3+ | active 生命周期的 handler/fixture/contract test/注册/worker/provider 文件存在 | warn（experimental） |
| `DOC-G3-IMPL-003` | G3+ | handler export 已注册且 Provider 挂载 worker hook | warn（experimental） |
| `DOC-G3-IMPL-004` | G3+ | endpoint 场景结构有效，N/A 有理由，retired 有对账证据 | warn（experimental） |
| `DOC-G3-IMPL-005` | G3+ | `agent/assumptions.json` 可解析 | warn（experimental） |
| `DOC-G3-IMPL-006` | G3+ | API ready/reconciling/retired 时无阻断假设（lifecycle 轴） | error |
| `DOC-G4-001` | G4+ | 复用盘点无 `待检查/待确认` 占位 | error |
| `DOC-G4-002` | G4+ | 技术方案含复用盘点 | error |
| `DOC-G4-003` | G4+ | 技术方案不含 `跳过复用` | error |
| `DOC-G4-004` | G4+ | 技术方案模板 v2 含单一事实源所有权表 | error |
| `DOC-G4-005` | G4+ | 单一事实源所有权表无 `待确认/待填写` 占位 | error |
| `DOC-G4-006` | G4+ | 技术方案模板 v3 含数据流与分层契约表；纯 UI 可明确写 `N/A` 与数据来源 | error |
| `DOC-G4-007` | G4+ | 数据流与分层契约表无 `待确认/待填写/待检查` 占位 | error |
| `DOC-G4-008` | G4+ | 功能清单含 PRD 面包屑路径时，技术方案含「PRD 路径核验」表（见 [architecture-and-state.md](./architecture-and-state.md) §2.2） | error |
| `DOC-G4-009` | G4+ | 功能清单里的每条面包屑路径均在技术方案里原文出现（未被静默顶替/收敛） | error |
| `GIT-G4-001` | G4(时点) | 当前分支是 `feature/<PROJECT-ID>`(其他 `feature/*` 降 warn) | error/warn |
| `GIT-G4-002` | G4(时点) | 基线基于 `origin/online`(无共同历史 error;主线前进降 warn) | error/warn |
| `DOC-G5-001` | G5+ | API 契约记录字段对账 | error |
| `DOC-G5-002` | G5+ | API 契约记录 mock 状态 | error |
| `DOC-G5-003` | G5+ | API 契约记录文案契约表 | error |
| `DOC-G5-004` | G5+ | 已勾选完成的任务不得同行保留 `ASSUMED`、待后端/待对账、后端侧待办或契约未完成 | error |
| `CODE-MOCK-001` | G5+ | 责任模块目录未填→无法扫 mock 残留 | warn |
| `CODE-MOCK-002` | G5+ | `rg` 不可用/mock 残留 grep（`@mock-only`/`USE_MOCK`/`isMock`） | warn/error |
| `CODE-MSW-001` | G5+ | MSW 路线 B 在 API 契约中记录契约测试/schema 验证 | error |
| `CODE-MSW-002` | G5+ | MSW 路线 B 责任模块无业务 mock switch 残留 | error |
| `CODE-MSW-003` | G5+ | MSW 路线 B 记录 handler 删除/停用/转测试处置 | warn |
| `CODE-MSW-004` | G5+ | API 契约记录新功能 mock 路线为 MSW 路线 B | error |
| `CODE-ASSUMED-001` | G5+ | 责任模块残留 `// ASSUMED:`（对账未销账，§8.0.2） | warn |
| `CODE-SCOPE-001` | G5+ | 改动落在责任模块目录白名单外（越界，change-scope-boundary §1.1） | warn |
| `VERIFY-G5-001` | G5+ | `agent/stage-status.json` 存在 G5 结构化结论 | error |
| `VERIFY-G5-002` | G5+ | G5 状态为 `completed` 或 `not-applicable`，`blocked` 不得进入 G6 | error |
| `VERIFY-G5-003` | G5+ | G5 完成项存在证据路径；不适用项存在具体原因 | error |
| `VERIFY-G5-004` | G5+ | 报告态 `frontend-complete-pending-reconcile`（前端完成、仅待真实字段对账）须有前端 evidence 路径与待对账原因；此态不放行 G6，仅供索引/交付摘要正向显示 | warn |
| `VERIFY-G6-001` | G6+ | `evidence/` 下有自测 README | error |
| `VERIFY-G6-002` | G6+ | `06-collaboration.md` 记录 code-review findings + 处理结论，且无未处理悬空项（`待修复/未处理` 即 fail，须当场修或进 `rule-waivers.json`） | error |
| `VERIFY-G6-003` | G6+ | 自测证据记录命令、目标文件/场景、结果，含 Biome 或 fallback | error |
| `VERIFY-G6-004` | G6+ | `evidence/` 下不出现 `.png/.jpg/.html` 等二进制/临时文件（应放 `/tmp/` 或 `.gitignore` 目录） | warn |
| `VERIFY-G6-005` | G6-partial（`lib/gate-partial.mjs`） | 本次为部分验收：结论记 `G6-partial`，不构成 G7 前置，真实字段到位后须重跑完整 G6 | warn |
| `DOC-AC-001` | G6+ | `agent/acceptance-results.json` 结构合法；模板 v2 起必须存在 | error |
| `DOC-AC-002` | G6+ | 每个本期做 Feature 至少有一条 passed 验收结果 | error |
| `DOC-AC-003` | G6+ | 验收结果无 failed/blocked | error |
| `DOC-AC-004` | G6+ | 每条 passed 验收都有 evidence | error |
| `DOC-AC-005` | G6+（`lib/acceptance-results.mjs`） | 每条 passed 验收的 evidence 至少有一个真实存在的文件锚点（截图/报告/DOM 比对），且不含指向不存在文件的路径 | error |
| `DOC-AC-006` | G6+（`lib/acceptance-results.mjs`） | `acceptance-results.json.head` 覆盖当前 HEAD（缺 currentSha 不判定），防验收过时 | warn |
| `DOC-AC-007` | G6-partial（`lib/acceptance-results.mjs`） | 部分验收的欠账清单：逐条点名待真实字段对账的 `contract`/`browser` 验收项 | warn |
| `VERIFY-STAGE-001` | G6+ | `agent/gate-history.json` 存在此前真实写入的 G5 PASS | error |
| `VERIFY-STAGE-004` | G6-partial | `agent/gate-history.json` 存在此前真实写入的 G4 PASS（G5 停靠态下以 G4 为前置，取代 VERIFY-STAGE-001）。**不可豁免**：partial 已经放宽了一层前置，若剩下这层也能豁免，它就成了无边界后门 | error |
| `VERIFY-STAGE-002` | G7+ | `agent/gate-history.json` 存在此前真实写入的 G6 PASS | error |
| `VERIFY-G7-001` | G7+ | `agent/stage-status.json` 存在 G7 结构化结论 | error |
| `VERIFY-G7-002` | G7+ | G7 状态为 `completed` 或 `skipped` | error |
| `VERIFY-G7-003` | G7+ | G7 完成项存在证据路径；跳过项存在具体原因 | error |
| `VERIFY-STAGE-003` | G8 | `agent/gate-history.json` 存在此前真实写入的 G7 PASS，禁止当前 G8 自证 | error |
| `VERIFY-BIOME-001` | G6+（`verify-build-quality.mjs`） | 改动文件实跑 `biome check` 通过，且 `Checked` 文件数 >0 | error |
| `VERIFY-TYPE-001` | G6+（`verify-build-quality.mjs`） | 实跑 `tsc --noEmit`，改动文件零报错（存量债不阻断） | error |
| `VERIFY-TYPE-002` | G6+（`verify-build-quality.mjs`） | 改动之外的 tsc 报错数未超 `agent/tsc-baseline.json`（存量涟漪） | warn |
| `VERIFY-TEST-001` | G6+（`verify-build-quality.mjs`） | 实跑 `vitest run` 于相关测试文件全绿 | error |
| `VERIFY-TEST-002` | G6+（`verify-build-quality.mjs`） | 改动的 `.ts` 逻辑文件导出函数须有对应单测 | warn |
| `VERIFY-BUILD-001` | G6+（`run-project-gate.mjs`） | 机器事实层缺席守卫：未执行/输出不可解析/无理由跳过即 fail，有理由跳过降 warn | error/warn |
| `VERIFY-PROD-BUILD-001` | G8（`verify-build-quality.mjs`） | 按配置实跑 production build | error |
| `VERIFY-RULE-001` | 会话启动 / `doctor` | Codex、Claude Code、Cursor、Lark-Codex、Lark-Claude 的 L1/L2/L3 source matrix 指向同一 canonical source fingerprint | error |
| `VERIFY-RULE-002` | `changed`、G5-G8 | 编码 rule session v2 存在，且客户端、规则发布、G2 输入、HEAD 与 24 小时有效期均未漂移；一个客户端不能复用另一个客户端的会话 | error |
| `VERIFY-RULE-003` | `doctor` | 固定入口全集完整且无多余项：五个入口均登记 adapter、enforcement 与 source fingerprint | error |
| `VERIFY-RULE-004` | Lark 每次启动 AI 前 | 本次路由的**常驻必需**规则文件与章节都存在（缺一即 fail-closed）；两层发布 stale 只记 warning 继续执行（d533eb4），辅助章节缺失只降级 | error（仅缺常驻必需规则时） |
| `DOC-BLOCK-001` | G0+（`lib/blockers.mjs`） | `agent/blockers.json` 结构合法：字段合规、id 唯一、resolved 带 resolution+resolvedAt；缺文件不发 check | error（不可豁免） |
| `DOC-BLOCK-002` | G0+（`lib/blockers.mjs`） | 无 `open` 且 `blocksGate ≤ 当前 gate` 的阻塞/变更未解除 | error（可豁免） |
| `DOC-BLOCK-003` | G0+（`lib/blockers.mjs`） | 其余 `open` 登记（尚不卡当前 gate）可见性提示 | warn |
| `DOC-ASSUM-001` | G5-G7（`lib/assumption-ledger.mjs`） | 到 G5 出口仍有 `blockingWhen ∈ {api-ready, reconciling}` 的 `open` 假设未销账（gate 轴） | error（可豁免，免疫 report-only） |
| `DOC-ASSUM-002` | G8（`lib/assumption-ledger.mjs`） | 交付前仍有 `blockingWhen ∈ {api-ready, reconciling, release}` 的 `open` 假设未销账（gate 轴） | error（可豁免，免疫 report-only） |
| `DOC-SYNC-001` | —（`check-doc-budget.mjs`） | 已通过 gate 项目的 README 机器行与 `gate-results.json.gate` 一致 | error |
| `DOC-SYNC-002` | —（`check-doc-budget.mjs`） | 机器版 `context-summary.md` 的当前阶段与 `gate-results.json.gate` 一致 | error |
| `DOC-SYNC-003` | —（`check-doc-budget.mjs`） | `PROJECTS.md` 与即时重生成结果一致 | error |
| `DOC-SYNC-004` | —（`check-doc-budget.mjs`） | active 项目 stage=G5+ 时存在 G5→当前阶段连续 PASS 历史，且历史证据文件真实存在 | error |
| `DOC-CR-001` | G6+（`lib/code-review.mjs`） | `agent/code-review.json` 结构合法：字段合规（含必填 `head`）、finding id 唯一、fixed 带 resolution；缺文件不发 check | error |
| `DOC-FRESH-001` | —（`check-doc-budget.mjs`） | 根目录 `HANDOFF-*.md` 在 7 天保鲜期内（按 `git log -1 --format=%cs` 取最后提交日，不看 mtime）。交接完成就删，未完成就更新状态或移进 `prds/<PROJECT-ID>/` | warn |
| `DOC-CR-002` | G6+（`lib/code-review.mjs`） | code-review 无未处理 finding（open 项须当场修或 waive/标 N/A） | error |
| `DOC-CR-003` | G6+（`lib/code-review.mjs`） | `code-review.json.head` 覆盖当前 HEAD（head 现为必填，缺 currentSha 不判定），防 review 过时 | warn |
| `DOC-CONFIRM-001` | G5+（`lib/confirmation.mjs`） | G5 的人工处置态（`completed`/`not-applicable`/`frontend-complete-pending-reconcile`）带 `confirmedBy` + `confirmedAt`；AI 客户端名与占位符不算人工确认 | warn（warn-first，下一轮转 error） |
| `DOC-CONFIRM-002` | G7+（`lib/confirmation.mjs`） | G7 的人工处置态（`completed`/`skipped`）带 `confirmedBy` + `confirmedAt` | warn（warn-first，下一轮转 error） |
| `DOC-CONFIRM-003` | G6+（`lib/confirmation.mjs`） | `method ∈ {manual, manual-visual, browser}` 的 `passed` 验收项逐条带 `confirmedBy` + `confirmedAt`（这三种没有机器退出码兜底） | warn（warn-first，下一轮转 error） |
| `DOC-CONFIRM-004` | G6+（`lib/confirmation.mjs`） | `code-review.json` 带人工签收 `confirmedBy` + `confirmedAt`（`reviewer` 记谁做的 review，通常是 Agent 自己，不能兼任签收） | warn（warn-first，下一轮转 error） |
| `VERIFY-G8-001` | G8 | `agent/delivery-status.json` 的 project/mode/branch/headSha/evidence 结构合法；模板 v2 起必须存在 | error |
| `VERIFY-G8-002` | G8 | 交付模式不是 local，而是 pushed/merged/released | error |
| `VERIFY-G8-003` | G8 | 实际 Git 工作树干净 | error |
| `VERIFY-G8-004` | G8 | 非 local 交付具备证据；pushed 模式远端分支、当前 HEAD 与记录 SHA 一致；merged/released 模式记录 SHA 已进入基线分支 | error |

> `GIT-G4-*` 定位说明见 §2.1(时点检查、worktree cwd 求值);责任模块目录字段可填在 `00-feature-inventory.md` 或 `agent/context-summary.md`。
