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

1. 先读 [README.md](./README.md)（本目录职责与项目索引）。
2. **读 [common/rules/rule-router.md](./common/rules/rule-router.md)——唯一常驻规则文件**：§1 硬规则 TL;DR（单一常驻源）+ §2 按场景命中才读的路由。
3. 如需机器路由，读 [common/rules/rule-index.json](./common/rules/rule-index.json)，按场景取 2-4 篇专题，不是全量。
4. 再按项目版本读取事实：v2 读 `README.md`、`work-item.json`、`latest-result.json`（若存在）；v1 读 `agent/context-summary.md`（若存在）、`README.md`、`product/00-feature-inventory.md`、`product/06-collaboration.md`。

> 完整专题清单和触发条件见 [common/rules/rule-router.md](./common/rules/rule-router.md)；[common/README.md](./common/README.md) 保留专题全索引供查阅，但**开工路由以 rule-router 为准**。

Codex/Claude/Pi 侧编码规则入口不放在 `docs_tdd`：短硬规则常驻 `~/.ai-rules/AGENT.md`（`~/.codex/AGENTS.md`、`~/.claude/CLAUDE.md`、`~/.pi/agent/AGENTS.md` 均软链至此，三工具读同一份文件，禁止分叉编辑）；长清单按需读 `~/.ai-rules/skills/coding-quality/SKILL.md`、`~/.ai-rules/skills/figma-read/SKILL.md`（三工具的 `skills/coding-quality`、`skills/figma-read` 同样软链至此）；FameEX 锚定编码规则按主题读仓库 `.cursor/rules/*.mdc`。本目录只保留项目、流程、门禁、边界与项目事实。

新 chat 一句话启动新需求时，优先使用 [common/rules/startup-prompt.md](./common/rules/startup-prompt.md) 的启动口令，并执行 [common/rules/new-project-kickoff.md](./common/rules/new-project-kickoff.md) §2 的自动链路。

## 3. 当前项目索引

**唯一真值源是自动生成的 [PROJECTS.md](./PROJECTS.md)**（项目清单 / 状态 / G2 / 最新 gate / worktree 归属 / 责任模块，由 `common/engine/agent-scripts/update-project-index.mjs --write` 从各项目 `README` + `git worktree list` 派生）。

本文件不再手抄项目清单——手抄副本必然漂移（曾出现新项目只进自动表、三处手动表全漏）。新增/更新项目后跑一次 `--write` 重新生成 `PROJECTS.md` 即可；`check-doc-budget.mjs` 会拦「手动导航文件里再硬编码 `PR-xxxxx` 项目行」。

## 4. 公共开发规则

**硬规则 TL;DR 的唯一常驻源是 [common/rules/rule-router.md](./common/rules/rule-router.md) §1**，本文不再重复列举（避免同批规则在多处常驻、三重冗余）。开工按 §2 渐进披露读路由表即可。

## 5. 新需求接入

自 2026-09-08 起，新需求默认使用正式 v2；存量 `workflowVersion: 1` 项目继续使用 v1，不静默迁移。统一入口与完整步骤见 [common/rules/new-project-kickoff.md](./common/rules/new-project-kickoff.md) §2。

### 5.1 v2 新项目（默认）

1. 运行 `docs-tdd kickoff <PROJECT-ID> --prd <source> --title <title>`，创建最小项目并初始化 `work-item.json`。
2. 从当前 source snapshot 抽取原子需求与 surface，完成独立冷读 coverage review 和风险路由；V2 必须取得绑定当前 fingerprint 的 human scope approval。
3. 范围审查完成前禁止写业务代码；实现和证据必须绑定当前 `headSha + dirtyHash`。
4. 运行 `docs-tdd verify <PROJECT-ID> --input <verify-input.json>` 写正式出口。只有 `mode=enforced,status=passed,ok=true` 可以交付；failed/blocked 一律阻断。
5. v2 不运行 G0–G8 Gate；默认持久化事实仅为 `work-item.json`、`latest-result.json`、`runs.jsonl`（首次 verify 前可只有 work-item）。

### 5.2 v1 存量与显式 legacy 项目

只有用户明确要求时，使用 `docs-tdd kickoff ... --legacy` 新建 v1。v1 继续执行 [common/rules/prd-feature-inventory.md](./common/rules/prd-feature-inventory.md) §3：G0 前建 feature inventory，G2 标记做/不做/延期并确认，G2 未定稿前不写业务代码；后续按 G0–G8 Gate 推进。

### 5.3 共同约束

- 原始 PRD / Figma / API / QA 只放当前项目 `inbox/`，不要放根目录。
- 新项目启动先做规则继承检查；发现旧项目可复用规则尚未进入 `common/`，先提炼公共规则。
- 项目文档和脚本必须保持薄包装，不复制公共规则或公共脚本实现。
- 接手存量项目时以 README `workflowVersion` 路由；缺字段按 v1 兼容，不因缺少 v1 清单而把 v2 项目降级。

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
