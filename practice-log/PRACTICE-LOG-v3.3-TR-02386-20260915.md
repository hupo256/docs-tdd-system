# v3.3 实践记录 — TR-02386 登录/注册迁移 kickoff（2026-09-15）

> 目的：记录 docs_tdd v3.3（workflowVersion 2）在真实新项目 kickoff 上的卡点，供框架迭代。
> 记录人：Devin agent（TR-02386 会话）。
> 项目：`prds/TR-02386/`（登录/注册/三方登录迁移到 apps/web-next，PRD 为本地 Markdown PLAN.md）。

## 观察台账（TR = 本项目编号空间）

### TR-1【kickoff 兼容性】预存在的项目目录被误判为 v1，静默走旧通道
- 现象：`prds/TR-02386/` 在 kickoff 前已存在（内含前一会话遗留的 `HANDOFF.md`）。`docs-tdd kickoff TR-02386 --prd <md> --title <t>` 进入 `existsSync(projectDir)` 分支 → `projectWorkflowVersion` 读不到 README `workflowVersion:` 也无 `work-item.json` → 返回 1 → `legacy=true` → 直接 `syncAndInit`，报 `lark-sources.json 缺失或为空`，且不生成 v2 脚手架。
- 期望行为：目录存在但无版本标识时，应默认按 v3.3 的 v2 处理（或显式询问），而不是静默落到 v1。
- 绕行：手工按 `kickoffVNext` 的产物补写 `README.md` frontmatter（`workflowVersion: 2`）与 `agent/lark-sources.json`（`type: markdown`），再重跑 kickoff 才进入 v2 通道。
- 迭代建议：kickoff 遇到「目录存在但无 workflowVersion」时给出明确错误或自动按 v2 初始化，不要降级 v1。

### TR-2【报错信息】本地 Markdown PRD 必须位于 docs_tdd 根内，报错未前置说明
- 现象：`--prd` 传 worktree 内路径（`/Users/aven/github/TR-02386/apps/web-next/.scratch/.../PLAN.md`）时 sync 报 `docs path must stay inside /Users/aven/github/docs_tdd`。kickoff 文档只说「本地 Markdown 可用」，未提示路径约束。
- 绕行：把 PLAN.md 复制到 `prds/TR-02386/inbox/PLAN.md`，lark-sources.json `url` 指向该路径后同步成功。
- 迭代建议：kickoff 文档/报错文案直接写明「本地 PRD 需放在 `<docs_tdd>/prds/<ID>/inbox/` 下」。

### TR-3【deliveryScope 语义】bounded-batch 在「无延期项」场景下无法自洽
- 现象：context 生成在 deliveryScope 缺 `deferred.batch` 时直接抛 `Cannot read properties of undefined (reading 'batch')`（`vnext-context.mjs` 未做可选链），随后 `next` 强制要求 `create-a-bounded-deliveryScope-before-review-or-coding`。
- 补上 `deferred: {owner, batch: 'none', reason}` 后，coverage review 又要求 findings 里存在与该 owner+batch 匹配的 `deferred` 处置项——全部需求都纳入本批次时，这个「延期边界 finding」语义上是凑出来的，reviewer 也不可能自然产出。
- 结论：对「单批次全量交付」的项目，bounded-batch 结构反而是障碍；本次最终**移除 deliveryScope**（context 11841 字符 < 24K 硬上限，large-context 仅为 warning）。
- 迭代建议：① `vnext-context.mjs` 对 `deliveryScope.deferred` 做存在性保护，报错信息给可执行的修复指引；② bounded-batch 允许 `deferred: null` 或内置「empty remainder」约定，不要求 reviewer 伪造 deferred finding；③ 文档给出「何时必须 bounded-batch」的判据（看起来是 context 预算驱动）。

### TR-4【流程留痕】上个会话的 docs_tdd 待办
- `prds/TR-02386/HANDOFF.md` §7 已登记：`rule-context-hook` 的 HEAD 变更审计需加文件数上限/超时，避免切分支后写钩子死锁。本项继续有效，未重复登记。

## 环境基线
- 系统仓 `/Users/aven/github/docs_tdd`；消费 worktree `/Users/aven/github/TR-02386`（`feature/TR-02386` == `origin/online` @ 5011507e1f）。
- 框架 v3.3；review 通道 `--client pi`（隔离冷读，无工具）。

## 审查循环摩擦（2026-09-15 追加）

1. **排序陷阱**：`extract` 重跑会把 sealed coverageAudit 重置为 stub（findings 丢失），而 `review-adjudicate` 只能裁决当前 audit——顺序错了状态机就锁死。正确顺序必须先裁决（accepted）→ 再改 extraction → `review-resume`。建议引擎在 extract 时若存在未裁决 open findings 给出警告，或 adjudicate 支持绑定 reviewControl.history 中最近一次 sealed audit。
2. **重审阻塞**：指纹未变时 `review` 直接拒绝（review retry blocked），连换 client 也不行——想用另一个 reviewer 复核同一 candidate 被挡住。建议允许 unchanged-fingerprint 的跨 client 复审，或增加显式 override。
3. **审查收敛性差**：pi 冷读 4 轮每轮都提新的 nit 级 finding（kind 标注、surface 覆盖、漏 surface），claude 复审只剩 1 条 kind 标注类 finding。finding 无严重度分级，nit 与实质缺陷同权阻断，成本偏高。建议 findings 分 severity，nit 允许 deferred 批量处理。
4. **evidence kind 与 evidencePlan type 的强耦合**：`evidencePlan.type` 受 EVIDENCE_TYPES 枚举限制（无 quality/structural 类），命令 kind 必须与 plan type 严格相等，导致"文件行数门禁"这类结构检查没有合法挂法（component-dom/pure-logic 都被审出 kind 不匹配）。建议 EVIDENCE_TYPES 增加 `structural`/`quality` 类型，或允许命令 kind 扩展集。
5. **reviewer 可用性**：pi 出现一次 reviewer-unavailable 传输故障；`review-resume` 的 infrastructureFailure 路径可恢复，体验 OK。
