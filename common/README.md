# common 公共规则入口

`common/` 是新项目继承项目流程、门禁、自测、边界和证据规则的唯一公共入口。项目目录只放当前需求的差异化规则、PRD、Figma、API 和任务。通用代码质量归全局 AGENTS/skill，FameEX 代码锚点归 `.cursor/rules/*.mdc`；本目录只记录何时加载、如何验证、证据落哪里。

> **开工不要全读本索引**：常驻只读 [rule-router.md](./rules/rule-router.md)，再执行 `docs-tdd.mjs context <PROJECT-ID> <SCENARIO>` 读取带 fingerprint 的临时 context pack。下面是**专题全索引，供人工查阅**，不是每次全读清单。

## 专题全索引（查阅用）

1. [rule-router.md](./rules/rule-router.md)：**渐进披露路由表**（开工唯一常驻入口，按场景命中才读正文）。
2. [new-project-kickoff.md](./rules/new-project-kickoff.md)：新 chat 一句话启动项目的自动链路。
3. [startup-prompt.md](./rules/startup-prompt.md)：新需求启动口令模板。
4. [rule-index.json](./rules/rule-index.json)：机器可读场景路由索引。
   - [rule-ownership.json](./rules/rule-ownership.json)：专题唯一正文所有权表；Router、Gate、模板只消费，不复制正文。
5. [rule-inheritance.md](./rules/rule-inheritance.md)：规则如何从旧项目沉淀到公共区。
6. [prd-feature-inventory.md](./rules/prd-feature-inventory.md)：**PRD 全量功能清单与范围 SSOT**（「做 / 不做 / 延期」只在 `00-feature-inventory.md` 裁决，防 Figma 边界误裁和多文档漂移）。
7. [workflow-gates.md](./rules/workflow-gates.md)：G0-G8 开发门禁（含 G3 MSW 前置、G5 字段对账、G6 自动验收）。
   - [fast-track-incomplete-docs.md](./rules/fast-track-incomplete-docs.md)：**文档未齐快速通道**（按语义确定性/可逆性/影响面决定能否用临时契约推进；`reuse-api` 连续推进，`pending-api` 在 G6-partial 后停靠）。
8. [rule-ids-and-gates.md](./rules/rule-ids-and-gates.md)：规则 ID、阶段 gate、只扫新增/修改文件的静态检查。
   - [blocking-and-change-protocol.md](./rules/blocking-and-change-protocol.md)：阻塞与需求变更的机器可读单一源 `agent/blockers.json`（`DOC-BLOCK-*`，gate 能拦、交付摘要能派生）。
9. [rule-execution-model.md](./rules/rule-execution-model.md)：规则从触发、加载、执行、证据到失败阻断的保障模型。
10. [hook-integration.md](./rules/hook-integration.md)：PostToolUse hook 接入、调度范围和降级手动命令。
11. [execution-evidence.md](./rules/execution-evidence.md)：命令、gate、自测和交付证据记录。
12. [coding-worktree.md](./rules/coding-worktree.md)：进入编码前创建 `feature/<PROJECT-ID>` 分支和同级 worktree。
13. [git-branch-flow.md](./rules/git-branch-flow.md)：**Git 分支流与合并规则**（功能分支单向合入环境分支、永不反向；冲突本地解决再 push）。
14. [development-rules.md](./rules/development-rules.md)：人工专题入口，不定义规则正文。
15. [architecture-and-state.md](./rules/architecture-and-state.md)：分层、状态管理与 Mock 项目门禁总览。
16. [api-and-mapper.md](./rules/api-and-mapper.md)：API/schema/mapper 权威专题；单一来源同名与两类改名例外。
    - [mock-legacy-route-a.md](./rules/mock-legacy-route-a.md)：Mock 路线 A（`if(USE_MOCK)`）隔离/拆除税，仅未采用 MSW 的遗留功能适用。
17. [ui-style-token-rules.md](./rules/ui-style-token-rules.md)：Figma、Tailwind token、dark / light、H5 的项目验收流程。
18. [figma-mcp-read-workflow.md](./rules/figma-mcp-read-workflow.md)：**Figma MCP 原子节点读取、cornerRadius 落盘**（防 rounded-full 等漏读）。
19. [component-reuse-and-visual-fidelity.md](./rules/component-reuse-and-visual-fidelity.md)：组件复用盘点、弹窗/UI 双层视觉验收。
20. [change-scope-boundary.md](./rules/change-scope-boundary.md)：**改动边界与影响半径**——改动收敛责任模块内；越界（公共/共享 或 其他业务模块）先警告 + 重点 check，确保不影响无关功能。
21. [react-component-props-types.md](./rules/react-component-props-types.md)：React 组件 2+ 入参 Props/Params 已上移 L1 的本地指针。
22. [quality-checklist.md](./rules/quality-checklist.md)：测试、自测、Review checklist。
23. [verification-division-of-labor.md](./rules/verification-division-of-labor.md)：**验证分工**——Agent 跑逻辑/边界/数据/DOM 契约（Vitest+取值比对），人工跑视觉/手感/响应式（修订旧文「Agent 自己完成 L2 并排」）。
24. [browser-e2e-mcp.md](./rules/browser-e2e-mcp.md)：Browser / Playwright MCP 自测（禁止项目内安装 Playwright）。
25. [collaboration-and-notifications.md](./rules/collaboration-and-notifications.md)：协作通知总入口和安全边界。
26. [lark-active-notification.md](./rules/lark-active-notification.md)：自定义机器人主动发群消息（G0-G8）规则。
27. [lark-bot 子系统文档](./lark-bot/docs/README.md)：群内 @ 应用触发任务的完整链路（线程文字/图片上下文、项目 scope 注入、Figma 规格预取、bug 表跨项目回执、附件保留期与并行调度）运维手册；不是编码规则，不参与规则指纹。
28. [lark-doc-sync.md](./rules/lark-doc-sync.md)：Lark CLI 只读同步 PRD / Wiki / Drive / Markdown 到 `docs_tdd` 的规则；PRD intake 使用剥离易变媒体元数据的稳定指纹，历史 manifest 可就地 `--remigrate`。
29. [project-doc-structure.md](./rules/project-doc-structure.md)：项目文档目录规范。
30. [CHANGELOG.md](./CHANGELOG.md)：公共规则、gate 脚本和模板的框架变更日志。

顶层项目索引用 `node apps/web/docs_tdd/common/engine/agent-scripts/update-project-index.mjs --write` 生成到 `../PROJECTS.md`。它只做导航汇总；项目事实由各项目 `README.md`、`product/00-feature-inventory.md`、`agent/stage-status.json` 和 `agent/gate-history.json` 共同表达，`agent/gate-results.json` 只代表最近一次 gate 运行结果，不能证明历史阶段已通过。

## 本地脚本入口

> `apps/web/docs_tdd/` 是本地自用文档区，暂不把命令挂到项目根 `package.json`。需要自动化时直接跑下面这些本目录脚本，成熟后再考虑提升到全局配置。

个人规则保持 local-only：本目录当前由 `.git/info/exclude` 排除；不要把个人规则写入 tracked 的仓库根 `AGENTS.md`、`.cursor/rules`、`.husky`、`package.json` 或 CI 配置。需要提升为团队规则时先取得明确批准，再单独提交评审。

| 场景 | 命令 |
|------|------|
| 公共规则/链接/脚本自检 | `node apps/web/docs_tdd/common/engine/agent-scripts/check-doc-budget.mjs` |
| 自检通过后发布当前规则内容指纹 | `node apps/web/docs_tdd/common/engine/agent-scripts/rule-release.mjs --write` |
| 检查规则发布状态是否 fresh | `node apps/web/docs_tdd/common/engine/agent-scripts/rule-release.mjs --check` |
| 安装/修复三端本地规则适配器 | `node apps/web/docs_tdd/common/engine/agent-scripts/install-local-agent-rules.mjs` |
| 发布 L1+adapter+L2+L3 组合指纹 | `node apps/web/docs_tdd/common/engine/agent-scripts/effective-rules.mjs --write` |
| 原子发布完整规则链并回归 | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs release PR-01234 --scenario write_ui` |
| 诊断三端规则加载、冲突和隔离 | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs doctor PR-01234` |
| 生成按场景裁剪的上下文包；编码场景同时签发 rule session | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context PR-01234 write_msw [--full]` |
| 按改动推荐场景（非自动裁决） | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs recommend PR-01234` |
| 增量检查改动 | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed PR-01234 [--no-cache]` |
| 单阶段 gate 只看结果 | `node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01234 G6` |
| 正式阶段 gate + 落证据/历史/阶段 | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G6 [--no-cache]` |
| G8 交付 gate（阶段/索引自动同步） | `node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G8` |
| 阶段同步内部脚本（仅排障/回退） | `node apps/web/docs_tdd/common/engine/agent-scripts/set-project-stage.mjs PR-01234 G4 --force` |
| 只刷新项目索引 | `node apps/web/docs_tdd/common/engine/agent-scripts/update-project-index.mjs --write` |
| warn-first 晋级台账（记录/复核/候选） | `node apps/web/docs_tdd/common/engine/agent-scripts/warn-ledger.mjs --report`（gate --write 自动记录；`--mark <RULE> <PR> <true-positive\|false-positive> --write` 复核） |
| Markdown 本地链接检查 | `node apps/web/docs_tdd/common/engine/agent-scripts/check-doc-links.mjs` |
| L2 glob 解析/消费回执诊断 | `node apps/web/docs_tdd/common/engine/agent-scripts/rule-context.mjs <resolve|status|verify>` |
| Claude/Codex Pre/PostToolUse 规则注入 | `node apps/web/docs_tdd/common/engine/agent-scripts/rule-context-hook.mjs --client <claude|codex>` |
| Claude PostToolUse 代码门禁分发 | `node apps/web/docs_tdd/common/engine/agent-scripts/claude-posttooluse-gate.mjs` |
| 上线后回收编码 worktree | `node apps/web/docs_tdd/common/engine/agent-scripts/decommission-worktree.mjs PR-01234 [--dry-run]` |
| Lark Bot Gateway 任务 worker | `node apps/web/docs_tdd/common/lark-bot/lark-worker.mjs [--once]` |
| PostToolUse Bash 执行证据日志 | `node apps/web/docs_tdd/common/engine/agent-scripts/log-exec.mjs --out <abs-log-path>` |
| 发送 Lark 阶段卡片 | `node apps/web/docs_tdd/common/engine/agent-scripts/notify-lark.mjs G6 已完成 "摘要" --config apps/web/docs_tdd/prds/PR-01234/agent/scripts/pr-01234.json` |
| 创建编码 worktree | `node apps/web/docs_tdd/common/engine/agent-scripts/prepare-coding-worktree.mjs PR-01234` |
| 字段对账（schema vs fixture） | `node apps/web/docs_tdd/common/engine/agent-scripts/schema-fixture-reconcile.mjs` |
| 新建项目文档骨架 | `node apps/web/docs_tdd/common/engine/agent-scripts/start-new-project.mjs PR-01234 --prd <Lark URL 或本地 md>` |
| 只读同步 Lark 资料 | `node apps/web/docs_tdd/common/engine/agent-scripts/sync-lark-docs.mjs --config apps/web/docs_tdd/prds/PR-01234/agent/lark-sources.json` |
| PRD 图片/表格/嵌入盘点与漂移检查 | `node apps/web/docs_tdd/common/engine/agent-scripts/prd-intake.mjs PR-01234 --init --source <repo-relative-prd.md>`；旧 manifest 按稳定指纹公式就地迁移用 `--remigrate` |
| 生成项目恢复摘要 | `node apps/web/docs_tdd/common/engine/agent-scripts/update-context-summary.mjs PR-01234 --stage G6 --write` |
| 静态代码规则扫描 | `node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-01234` |

`docs-tdd.mjs gate` 是正式阶段推进的唯一入口，默认调用 runner 持久化 `agent/gate-results.json`、`evidence/gate/<date>-<HHmmss>-g*/README.md`，成功后先追加 `agent/gate-history.json`，再由 `set-project-stage.mjs` 校验同阶段 PASS 历史并同步 README 机器行、frontmatter `stage`、机器版 `context-summary.md` 和 `PROJECTS.md`。失败只更新最近结果和索引，不追加成功历史。G6/G7/G8 必须分别已有 G5/G6/G7 PASS 历史，禁止跳级；`set-project-stage.mjs` 不能替代 gate，`--force` 只允许回退。G5+ 默认同步跑 `verify-code-rules.mjs --project <PROJECT-ID>`；G6/G7/G8 临时跳过代码规则必须带具体原因并落证据。

`context` 默认生成按原文章节裁剪的 compact pack；`--full` 只用于歧义和失败调查。`changed`/非写入 gate 只缓存同指纹 PASS，`--write`、`--no-cache` 和失败结果始终实跑；完整子检查日志写 `/tmp/docs-tdd-logs/`，项目证据只保留摘要与日志路径。

## 维护原则

- 修改规则后先跑公共自检，再依次执行 `rule-release.mjs --write`、`effective-rules.mjs --write` 和 `docs-tdd doctor`；`context/changed/gate` 只消费两层 fresh release。
- 新项目启动时只从 `common/` 继承公共规则。
- 用户用“根据 apps/web/docs_tdd 下的文档，开始新的需求...”启动时，Agent 必须先执行 [new-project-kickoff.md](./rules/new-project-kickoff.md)。
- 旧项目里发现可复用规则，必须提炼到 `common/`，再继续当前项目。
- 项目 `engineering/development-rules.md` 只写特殊约束，不复制整份公共规则。
- 每次发现“以前定过但新项目没继承”，视为文档流程缺陷，先补 `common/`。
- 维护 `docs_tdd` 时先按 [rule-inheritance.md](./rules/rule-inheritance.md) §0.1/§0.2 判断载体；不要把 L1/L2 代码规范正文复制进 L3。
- 新需求 / 缺清单项目：Agent 必须自动执行 [prd-feature-inventory.md](./rules/prd-feature-inventory.md) §3（复制模板 → G0 初稿 → G2 定稿 → 再写代码）。
- 新需求一句话启动时：Agent 优先执行 `common/engine/agent-scripts/start-new-project.mjs` 创建项目骨架、登记 PRD 来源和薄包装脚本，再进入 G0 / G1 文档生成。
- 项目晋级只能运行 `docs-tdd.mjs gate <PROJECT-ID> <GATE>`；runner 在成功历史落盘后自动同步阶段。`set-project-stage.mjs` 仅供内部同步、排障和显式回退，缺少同阶段 PASS 历史时拒绝推进。README 状态表的「最新通过门禁」机器行只由脚本写入；人工叙述写「当前阶段」行，二者不混用。
- 新需求进入编码前：Agent 必须按 [coding-worktree.md](./rules/coding-worktree.md) 创建或确认同级 worktree，不在主仓直接改业务代码。
- 新需求进入 G2 / G5 / G6 / G7 / G8 前：Agent 必须按 [rule-ids-and-gates.md](./rules/rule-ids-and-gates.md) 依次跑对应 gate；代码静态扫描只检查本次新增或已修改文件。
