# docs_tdd Agent 规则

> 本仓是个人维护的独立 git 仓库（`~/github/docs_tdd`，远端 `github.com/hupo256/docs-tdd-system`），以软链挂载为 `fameex-web/apps/web/docs_tdd`，在业务仓中由 `.git/info/exclude` 忽略，不进入业务提交。仓库定位和目录见 [README.md](./README.md)。

## 1. 先判断任务类型

| 任务 | 做法 |
|---|---|
| **新需求**（给了 PRD 和项目号） | 走 skill `prd-to-commit`（`~/.ai-rules/skills/prd-to-commit/SKILL.md`）。**不读本仓文档**，不创建 `prds/<ID>/`、状态 JSON 或证据套件。启动语：`用 prd-to-commit，项目号 PR-xxxxx，PRD：<链接>` |
| **存量项目**（`prds/<ID>/README.md` 标记了 `workflowVersion: 1\|2`） | 按该项目 README 恢复，开工入口是 [common/rules/rule-router.md](./common/rules/rule-router.md) §2「存量流程路由」，命令见 [v3.5 引擎手册](./docs/legacy/docs-tdd-v3.5-manual.md)。不静默迁移，也不把旧台账要求带到新需求上 |
| **改 prd-to-commit** | 先满足「同类问题出现 2 次，并且能在回放中复现」；改完用 [benchmarks/replay/](./benchmarks/replay/README.md) 回放验证，再按 [releases.md](./docs/prd-to-commit/releases.md) 的纪律发版 |
| **改 lark-bot** | 见 [lark-bot 运维手册](./common/lark-bot/docs/README.md)；网关的 HTTP 契约变了，要同步 `~/.local/bin/lark-bot` |
| **整理或新增文档** | 按 [docs/README.md](./docs/README.md) 的分类和命名放置 |

**不要一次性读完 `common/`**（全量约 9–10 万 token）。按 rule-router 的场景表渐进加载。

## 2. 单一真值源

| 事实 | 唯一来源 |
|---|---|
| 存量项目清单、状态、worktree 归属 | [PROJECTS.md](./PROJECTS.md)（由 `update-project-index.mjs --write` 生成；不要在 README/AGENTS/CONTEXT 里手抄项目表，`check-doc-budget.mjs` 会拦截） |
| 存量项目开工路由与流程硬规则 | [common/rules/rule-router.md](./common/rules/rule-router.md) §2–§4 |
| 版本与变更 | [CHANGELOG.md](./CHANGELOG.md)，各组件细目见 [docs/README.md](./docs/README.md)「版本管理」 |
| 默认流程为什么是现在这样 | [docs/decisions/](./docs/decisions/README.md) |

## 3. 规则放哪一层

- **L1 纯编码手艺**（换仓库也能用）→ `~/.ai-rules/AGENT.md` 或 `~/.ai-rules/skills/*`。Claude、Codex、Pi 都通过软链读同一份，不要分叉编辑。
- **L2 带 FameEX 锚点的编码规则** → fameex-web 仓库的 `.cursor/rules/*.mdc`。
- **L3 流程、门禁、证据、项目事实** → 本仓 `common/`。审查判据见 [rule-inheritance.md](./common/rules/rule-inheritance.md) §0.1/§0.2。
- 从旧项目总结出的通用规则，必须同步到对应的公共位置，不能只留在项目目录里。发现「以前定过、但当前项目没继承」的规则时，按流程缺陷处理：先修公共文档，再继续。
- 改了 `common/` 下的规则文档，要运行 `check-doc-budget.mjs`、`check-doc-links.mjs`，确认没有在[已知未修项](./docs/legacy/docs-tdd-v3.5-manual.md)之外新增失败。这些已知失败会挡住 `rule-release.mjs --write`，规则指纹停在 2026-09-26；不要绕过这道门禁。

## 4. Git

- 只做本地提交；未经当次明确授权，不 push。
- 在业务仓中，`apps/web/docs_tdd` 和 `apps/web/docs` 都是本地忽略目录，不进入业务提交，也不要 `git add -f`。
