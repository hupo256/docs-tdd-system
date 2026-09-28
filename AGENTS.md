# apps/web 本地开发文档规则

> **本目录仅本地使用**：`apps/web/docs_tdd/` 已在 `.git/info/exclude` 中忽略，不跟踪、不 push。它用于沉淀 `@fameex/web` 功能开发规则、项目文档、协作流程和 Agent 经验。成熟后再考虑提升到仓库级或全局规则。

## 1. 目录定位

`apps/web/docs_tdd/` 是当前 Web 本地开发文档主工作区：

- 根目录放项目流程、门禁、自测、边界、证据规则和项目索引。
- 每个需求放一个独立项目目录，目录名必须是大写项目编号，例如 `PR-01685/`、`PR-01973/`。
- 不同项目的 PRD、Figma、API、QA、任务和实现规则必须分开维护。
- 旧项目的有效经验需要提炼到 `common/`，而不是散落在单个项目里。
- 通用代码质量和代码规范不在本目录展开：Codex 侧入口是 `~/.codex/AGENTS.md` 与按需 skill，Claude 侧入口是 `~/.claude/CLAUDE.md` 与按需 skill，Pi 侧入口是 `~/.pi/agent/AGENTS.md` 与 `~/.pi/agent/skills/*`（均软链同一份 `~/.ai-rules/AGENT.md` + `~/.ai-rules/skills/*`，三工具同源），FameEX 编码锚点入口是仓库 `.cursor/rules/*.mdc`。

## 2. 必读顺序（渐进披露）

**不要一次性读完整本 `common/`**（全量 ≈ 9-10 万 token，会挤占窗口、拖慢响应）。改为渐进披露：

1. **新需求**直接读 [common/rules/rule-router.md](./common/rules/rule-router.md) 和命中的 [common/rules/web-lite-workflow.md](./common/rules/web-lite-workflow.md)，不要先读整份 README 或全读 `common/`。
2. **存量项目**按其项目 README 中的 `workflowVersion` 读取对应规则和事实；需要查目录职责或项目索引时再读本文件/README。
3. 不要把 v1/v2 的台账、门禁带入新需求。

> 完整专题清单和触发条件见 [common/rules/rule-router.md](./common/rules/rule-router.md)；[common/README.md](./common/README.md) 保留专题全索引供查阅，但**开工路由以 rule-router 为准**。

Codex/Claude/Pi 侧编码规则入口不放在 `docs_tdd`：短硬规则常驻 `~/.ai-rules/AGENT.md`（`~/.codex/AGENTS.md`、`~/.claude/CLAUDE.md`、`~/.pi/agent/AGENTS.md` 均软链至此，三工具读同一份文件，禁止分叉编辑）；长清单按需读 `~/.ai-rules/skills/coding-quality/SKILL.md`、`~/.ai-rules/skills/figma-read/SKILL.md`（三工具的 `skills/coding-quality`、`skills/figma-read` 同样软链至此）；FameEX 锚定编码规则按主题读仓库 `.cursor/rules/*.mdc`。本目录只保留项目、流程、门禁、边界与项目事实。

新 chat 一句话启动需求时，使用 [common/rules/startup-prompt.md](./common/rules/startup-prompt.md)；新需求按 Web Lite 流程，不运行旧引擎 kickoff。

## 3. 当前项目索引

**唯一真值源是自动生成的 [PROJECTS.md](./PROJECTS.md)**（项目清单 / 状态 / G2 / 最新 gate / worktree 归属 / 责任模块，由 `common/engine/agent-scripts/update-project-index.mjs --write` 从各项目 `README` + `git worktree list` 派生）。

本文件不再手抄项目清单——手抄副本必然漂移（曾出现新项目只进自动表、三处手动表全漏）。新增/更新项目后跑一次 `--write` 重新生成 `PROJECTS.md` 即可；`check-doc-budget.mjs` 会拦「手动导航文件里再硬编码 `PR-xxxxx` 项目行」。

## 4. 公共开发规则

**流程硬规则的唯一常驻源是 [common/rules/rule-router.md](./common/rules/rule-router.md) §1**，本文不再重复列举（避免同批规则在多处常驻、三重冗余）。开工按 §2 渐进披露读路由表即可。

## 5. 新需求接入

新需求统一按 [common/rules/web-lite-workflow.md](./common/rules/web-lite-workflow.md)：`PRD → 最小 Task → worktree → coding（仅必要时 + MSW）→ 冷读 check → git add / commit`。只做 Web；PRD 单次完整读取；同一 revision 不重拉；Task 默认是对话中的短 checklist；不运行 G0–G8 或 v2 work-item 引擎。

### 5.1 存量项目兼容

- 存量 v1/v2 项目的 PRD / Figma / API / QA 只放对应项目 `inbox/`，不要放根目录；新需求遵循 Web Lite，不复制 PRD 到本目录。
- 已有 `workflowVersion: 1` / `workflowVersion: 2` 的项目按原协议完成；不静默迁移、不把旧台账要求施加给新需求。
- 存量文档和脚本仅在处理对应旧项目时加载；新需求不因历史工具存在而创建项目目录、状态 JSON 或证据套件。

## 6. 规则沉淀机制

- `common/` 是新项目继承规则的唯一公共入口；项目目录只放当前需求的差异化规则、PRD、Figma、API 和任务。
- 从旧项目总结出通用规则时，不允许只留在旧项目 `engineering/development-rules.md`；必须同步到 `common/` 对应专题文档。
- 新项目的 `engineering/development-rules.md` 只能补充当前项目的特殊约束，不复制整份公共规则。
- 纯编码手艺进入 L1（Claude/Codex 全局短规则或按需 skill），带 FameEX 锚点的编码规则进入 L2（`.cursor/rules`）；`docs_tdd` 只写流程侧引用和门禁承接，避免规则双写。
- 维护 `docs_tdd` 时按 [common/rules/rule-inheritance.md](./common/rules/rule-inheritance.md) §0.1/§0.2 审查：能换仓库复用的写 L1，需要 FameEX 锚点的写 L2，只有项目推进、准入准出、证据和失败处理留 L3。
- 每次发现“以前定过但当前项目没继承”的规则，按流程缺陷处理：先修公共文档，再继续业务实现。

## 7. 本地 Git 规则

- `apps/web/docs_tdd/` 和 `apps/web/docs/` 均为本地忽略目录，不应进入业务提交。
- 切分支时这些文档会留在工作区；若未来重新使用 worktree，需要把本目录同步到新 worktree。
- 不使用 `git add -f apps/web/docs_tdd`，除非负责人明确决定公开这些文档。
