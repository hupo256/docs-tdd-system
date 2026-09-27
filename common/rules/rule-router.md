<!-- RESIDENT-DOC: 唯一常驻规则；预算和覆盖校验见 check-doc-budget.mjs -->
# docs_tdd 启动路由

> 新需求只读本文件和命中专题；禁止全读 `common/`。机器路由见 [rule-index.json](./rule-index.json)，完整规范见 [web-lite-workflow.md](./web-lite-workflow.md)。

## 1. 新需求默认流程

新需求唯一默认流程：`PRD → 最小 Task → worktree → coding（API 未 ready 时 + MSW）→ 冷读 check → git add / commit`。

- **范围**：只交付 Web；纯非 Web 内容忽略。只有影响 Web 行为/契约或阻碍正确实现时才纳入说明或提问。
- **来源**：用户提供的 PRD 按定稿处理；一次完整读取正文及相关表格/图片/嵌入内容。同一来源/revision 不重复 fetch、同步或漂移校验；只有用户通知改版才读新版本。读取失败说明具体缺口并停止依赖该内容的工作，不循环重试。
- **Task**：默认在当前对话中形成短 checklist；不建重型目录、JSON 状态、逐条测试映射或人工签核。只在确需跨会话恢复时保存单个 `task.md`。仅就实质影响 Web 行为、正确性或安全的歧义提问。
- **工作区**：编码前检查 Git 状态并使用独立 worktree。worktree 必须放在主仓 checkout 的同级 `~/github/` 下（如 `~/github/docs_tdd-<task>`），不得放入主仓内部或 `~/.codex/worktrees/`。新需求 `feature/<PROJECT-ID>`，缺陷 `fix/<PROJECT-ID>`；按 [git-branch-flow.md](./git-branch-flow.md) 操作，不覆盖已有或未知改动。
- **API / MSW**：目标环境 API 已 ready 用真实请求；未 ready 或无法确认时按 endpoint 用 MSW 最小数据完成 UI/UX。隔离 handler，不在业务代码加 mock 分支；API ready 后对账并逐 endpoint 切真实请求。
- **检查与交付**：冷读对照 Task、diff、页面，不重拉同一 PRD。只运行有价值的定向验证；稳定后集中执行一次。复核 diff 后只暂存本需求改动并本地 commit；未经当次明确授权不 push。
- 详细步骤见 [web-lite-workflow.md](./web-lite-workflow.md)；启动口令见 [startup-prompt.md](./startup-prompt.md)。

## 2. 存量流程路由

- 已有项目按其 README `workflowVersion` 继续：v1 使用原 G0-G8；v2 使用原 work-item/verify。不得静默迁移。
- 新需求禁止运行旧 `docs-tdd run/kickoff/verify`、G0-G8、coverage review 或旧证据套件。旧专题仅在处理对应存量项目时加载。
- 编码规范分层：通用规则走全局 AGENTS/skill；FameEX 锚点走 `.cursor/rules/*.mdc`；本目录只保留流程与项目规则。

## 3. 按需加载

- 新需求：`new_project` → 仅加载 `web-lite-workflow.md`；只有需要启动口令模板时再读 `startup-prompt.md`。
- Web UI：`write_ui`；API/schema/mapper：`write_api` / `write_mapper` / `write_query_hook`；MSW：`write_msw`；Figma：`write_figma`。
- 存量 v1：`g0_g2_scope`、`g4_coding_worktree`、`g6_verify` 等原场景。
- 不确定时先读任务相关专题 1-3 篇；大文件用 `rg` 定位后读局部，不全读 `common/`。

## 4. 上下文与验证节制

- 主线程只保留决策、风险和结果；规则按需读取。不得为规则系统本身生成状态台账。
- 质量命令不在迭代编辑中反复运行；改动稳定后按风险选 touched-file lint、typecheck、纯逻辑测试或定向浏览器验证。
- 小改动不跑全仓/全套件；`.tsx` 不新增 render/unit tests，不为流程指标制造假测试。
- 未执行的检查标为 `not-required` 或“未运行”，不得称为通过。
- 修改本目录规则后运行 `node common/engine/agent-scripts/check-doc-budget.mjs` 与 `git diff --check`；旧发布引擎只在维护它所覆盖的旧规则执行链时使用。
