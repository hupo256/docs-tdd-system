# apps/web 本地开发文档规则

> **本目录仅本地使用**：`apps/web/docs_tdd/` 已在 `.git/info/exclude` 中忽略，不跟踪、不 push。它用于沉淀 `@fameex/web` 功能开发规则、项目文档、协作流程和 Agent 经验。成熟后再考虑提升到仓库级或全局规则。

## 1. 目录定位

`apps/web/docs_tdd/` 是当前 Web 本地开发文档主工作区：

- 根目录放项目流程、门禁、自测、边界、证据规则和项目索引。
- 每个需求放一个独立项目目录，目录名必须是大写项目编号，例如 `PR-01685/`、`PR-01973/`。
- 不同项目的 PRD、Figma、API、QA、任务和实现规则必须分开维护。
- 旧项目的有效经验需要提炼到 `common/`，而不是散落在单个项目里。
- 通用代码质量和代码规范不在本目录展开：Codex 侧入口是 `~/.codex/AGENTS.md` 与按需 skill，Claude 侧入口是 `~/.claude/CLAUDE.md` 与按需 skill，FameEX 编码锚点入口是仓库 `.cursor/rules/*.mdc`。

## 2. 必读顺序（渐进披露）

**不要一次性读完整本 `common/`**（全量 ≈ 9-10 万 token，会挤占窗口、拖慢响应）。改为渐进披露：

1. 先读 [README.md](./README.md)（本目录职责与项目索引）。
2. **读 [common/rule-router.md](./common/rule-router.md)——唯一常驻规则文件**：§1 硬规则 TL;DR（单一常驻源）+ §2 按场景命中才读的路由。
3. 如需机器路由，读 [common/rule-index.json](./common/rule-index.json)，按场景取 2-4 篇专题，不是全量。
4. 再读当前项目的 `agent/context-summary.md`（若存在）、`README.md`、`product/00-feature-inventory.md`、`product/06-collaboration.md`。

> 完整专题清单和触发条件见 [common/rule-router.md](./common/rule-router.md)；[common/README.md](./common/README.md) 保留专题全索引供查阅，但**开工路由以 rule-router 为准**。

Codex 侧编码规则入口不放在 `docs_tdd`：短硬规则常驻 `~/.codex/AGENTS.md`；长清单按需读 `~/.codex/skills/coding-quality/SKILL.md`、`~/.codex/skills/figma-read/SKILL.md`；FameEX 锚定编码规则按主题读仓库 `.cursor/rules/*.mdc`。本目录只保留项目、流程、门禁、边界与项目事实。

新 chat 一句话启动新需求时，优先使用 [common/startup-prompt.md](./common/startup-prompt.md) 的启动口令，并执行 [common/new-project-kickoff.md](./common/new-project-kickoff.md) §2 的自动链路。

## 3. 当前项目索引

**唯一真值源是自动生成的 [PROJECTS.md](./PROJECTS.md)**（项目清单 / 状态 / G2 / 最新 gate / worktree 归属 / 责任模块，由 `common/engine/agent-scripts/update-project-index.mjs --write` 从各项目 `README` + `git worktree list` 派生）。

本文件不再手抄项目清单——手抄副本必然漂移（曾出现新项目只进自动表、三处手动表全漏）。新增/更新项目后跑一次 `--write` 重新生成 `PROJECTS.md` 即可；`check-doc-budget.mjs` 会拦「手动导航文件里再硬编码 `PR-xxxxx` 项目行」。

## 4. 公共开发规则

**硬规则 TL;DR 的唯一常驻源是 [common/rule-router.md](./common/rule-router.md) §1**，本文不再重复列举（避免同批规则在多处常驻、三重冗余）。开工按 §2 渐进披露读路由表即可。

## 5. 新需求接入

新需求进入时，**G0–G2 文档骨架由 Agent 自动执行**（不要求负责人手动复制模板）。完整流程见 [common/prd-feature-inventory.md](./common/prd-feature-inventory.md) §3。（此处"自动"限于 G0–G2 文档脚手架；G5–G8 联调/验收/QA 为人机协同，见 [README.md](./README.md) 步骤 8 的人机分界。）

### 5.1 Agent 自动三步（G0–G2 文档骨架，强制）

| 步骤 | 门禁 | Agent 动作 | 完成标准 |
|------|------|-----------|---------|
| A | G0 前 | 复制 `templates/feature-inventory-template.md` → `<PROJECT-ID>/product/00-feature-inventory.md` | 文件存在 |
| B | G0 | 读 `inbox/` PRD **含验收标准**，填清单初稿 + 验收对照 + Figma 未覆盖表 | 无「待填」占位 |
| C | G2 | 每条标 **做/不做/延期**；填 G2 确认人 & 日期；「做」的项写入 `04-frontend-tasks.md` | G2 已确认 |

**G2 未定稿前禁止写业务代码**（`apps/web/src/**` 功能实现）。

### 5.2 项目目录初始化（与 5.1 并行）

1. 创建 `apps/web/docs_tdd/<PROJECT-ID>/`，例如 `apps/web/docs_tdd/prds/PR-01234/`。
2. 执行 **5.1 步骤 A–B**（创建并填写 `00-feature-inventory.md`）。
3. 复制 [templates/feature-doc-checklist.md](./templates/feature-doc-checklist.md) 到项目 README 或任务跟踪处。
4. 如需通知记录，复制 [templates/notification-log-template.md](./templates/notification-log-template.md) 到项目 `agent/notification-log.md`。
5. 按 [common/project-doc-structure.md](./common/project-doc-structure.md) 建 `inbox/`、`product/`、`engineering/`、`agent/`。
6. 原始 PRD / Figma / API / QA 只放项目 `inbox/`，不要放根目录。
7. 新项目启动前必须做一次 **规则继承检查**：先读 `common/`，再检查最近一个成熟项目的 `engineering/development-rules.md` 是否有尚未进入 `common/` 的通用规则。
8. 发现旧项目里有可复用规则但 `common/` 没有，先提炼进 `common/`，再写当前项目文档或代码。
9. 项目中沉淀的通用经验，不只写在项目目录里；必须及时提炼进 `common/`，避免下一个项目漏继承。
10. 项目文档和项目脚本必须通过薄包装检查；发现复制公共规则全文或复制公共脚本实现时，先改为公共入口 + 项目差异。

### 5.3 已有项目补跑

若 `<PROJECT-ID>/product/00-feature-inventory.md` 不存在，Agent 接手任意编码任务时 **必须先补跑 5.1**，再动代码。

## 6. 规则沉淀机制

- `common/` 是新项目继承规则的唯一公共入口；项目目录只放当前需求的差异化规则、PRD、Figma、API 和任务。
- 从旧项目总结出通用规则时，不允许只留在旧项目 `engineering/development-rules.md`；必须同步到 `common/` 对应专题文档。
- 新项目的 `engineering/development-rules.md` 只能补充当前项目的特殊约束，不复制整份公共规则。
- 纯编码手艺进入 L1（Claude/Codex 全局短规则或按需 skill），带 FameEX 锚点的编码规则进入 L2（`.cursor/rules`）；`docs_tdd` 只写流程侧引用和门禁承接，避免规则双写。
- 维护 `docs_tdd` 时按 [common/rule-inheritance.md](./common/rule-inheritance.md) §0.1/§0.2 审查：能换仓库复用的写 L1，需要 FameEX 锚点的写 L2，只有项目推进、准入准出、证据和失败处理留 L3。
- 每次发现“以前定过但当前项目没继承”的规则，按流程缺陷处理：先修公共文档，再继续业务实现。

## 7. 本地 Git 规则

- `apps/web/docs_tdd/` 和 `apps/web/docs/` 均为本地忽略目录，不应进入业务提交。
- 切分支时这些文档会留在工作区；若未来重新使用 worktree，需要把本目录同步到新 worktree。
- 不使用 `git add -f apps/web/docs_tdd`，除非负责人明确决定公开这些文档。
