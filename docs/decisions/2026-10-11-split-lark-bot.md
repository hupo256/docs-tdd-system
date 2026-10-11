# 决策：lark-bot 拆为独立仓库，加修改范围契约；fameex-web 不再调用 docs_tdd 引擎（2026-10-11）

> 状态：已执行（C 已于 2026-10-11 完成切换；D 已在 fameex-web 本地分支提交，未 push） · 不取代其他决策（[2026-10-10 切换到 prd-to-commit](/Users/aven/.ai-rules/labs/prd-to-commit/decisions/2026-10-10-switch-to-prd-to-commit.md) 仍为现行，2026-10-11 已迁到 `~/.ai-rules/labs/prd-to-commit/decisions/`）

## 背景

- docs_tdd 引擎已在 2026-10-10 冻结，但 lark-bot 仍在 `common/lark-bot/` 里，并直接依赖引擎：
  - 10 处 `../../engine/...` import：`roots.mjs`、`lark-command.mjs`、`lark-prd-drift.mjs`、`rule-chain-runtime.mjs`；
  - 启动引擎的 `verify-code-rules.mjs`；
  - 读取冻结的 `common/rules/*.md` 章节，作为提示词里的可信规则；
  - 附件和审计写在 `prds/<PR>/agent/` 下。
- lark-bot 读项目 PRD 时只看 `prds/<PR>/`，但 prd-to-commit 的新项目把 PRD 放在 `~/.prd-cache/<ID>/`，所以新项目的 bug 拿不到 PRD。
- lark-bot 的修改边界只靠提示词约束，代码层没有任何硬检查判断「改的文件是不是该改的」：
  - 分析结果结构（schema）里没有结构化的范围字段；
  - 当前执行器 claude 是单趟执行，根本没有分析阶段；
  - 自报改动和实际改动不一致时只附提示，不拦。
- fameex-web 的 `package.json` lint-staged 调用 `precommit-verify-code-rules.mjs`：
  - 这一步带 `if [ -f ]` 判断，脚本不存在就跳过，所以只在本机生效，对同事和 CI 一直是空操作；
  - 它是冻结引擎剩下的唯一外部调用方。

## 决策

1. **拆仓**：lark-bot 用 `git subtree split` 带历史迁出到 `~/github/lark-bot`，成为独立仓库，CLI 和 launchd 也收进该仓库。
   - 拆出后不再 import docs_tdd 的任何代码，只依赖：fameex-web 路径（配置项）、`~/.ai-rules`（只读规则）、`~/.prd-cache`（只读 PRD）、lark-cli、AI CLI。
   - 存量项目的 `prds/` 只作为**可选**的只读配置项（`legacyPrdsRoot`），目录不存在就跳过。
2. **范围契约**：所有会改代码的任务，不论用哪个执行器，都先跑只读分析阶段，输出结构化的 `scope`。worker 收尾时用实际改动核对这份契约：
   - 有越界文件、碰了禁区、超出改动上限时，不提交，降级为人工复核；
   - 契约和实际改动并排显示在卡片上，同因搜索的关键词和兄弟位置清单也一并展示，用来防漏改。
3. **代码规则扫描器独立**：
   - 从 `verify-code-rules.mjs` 抽出零依赖的 `code-rules.mjs`，只保留误报低的 error 级规则，放进 `~/.ai-rules/skills/prd-to-commit/scripts/`；
   - prd-to-commit 的 `check.mjs` 和 lark-bot worker 显式调用它，lark-bot 内置一份钉住版本的副本；
   - fameex-web 删除 lint-staged 里的那一行，不再调用 docs_tdd。
4. **v2 提交守卫**随引擎冻结。剩余的 v2 存量项目在交付前按各自 README 手动运行。

## 执行计划

原则：**拆仓阶段不改行为**；行为改进（读 PRD 缓存、范围契约）单独提交。旧的 `common/lark-bot/` 在切换前保持运行，不动。

| 批次 | 任务 | 仓库 | 依赖 | 并行 |
|---|---|---|---|---|
| 0 | 落盘本计划；`git subtree split` 建 `~/github/lark-bot` | docs_tdd / 新仓库 | — | 串行 |
| A1 | 解耦：引擎模块复制进新仓库；路径改为配置驱动；运行时数据（附件、审计）放进 bot 自己的目录；规则原文快照到 `rules/`；去掉规则指纹读取；CLI、plist、wrapper 改指向新仓库；PRD 改从 `~/.prd-cache` 读 | lark-bot `main` | 0 | ✅ |
| A2 | 独立扫描器 `code-rules.mjs` 加自测 | `~/.ai-rules` | — | ✅ |
| A3 | 范围契约的纯函数模块 `lark-scope-contract.mjs`、分析结构的 `scope` 字段、单测（含历史回归用例） | lark-bot 分支 `scope-contract` | 0 | ✅ |
| B1 | 合并 A3，接入范围契约：所有执行器都先跑只读分析阶段；改提示词；收尾硬检查；卡片显示范围 | lark-bot | A1、A3 | ✅ |
| B2 | 接入扫描器：lark-bot 内置 A2 副本、改用它；prd-to-commit 的 `check.mjs` 调用它（skill 改动，记入「未发布」） | lark-bot / `~/.ai-rules` | A1、A2 | ✅ |
| B3 | 准备 docs_tdd 侧清理：去掉引擎对 lark-bot 的引用（rule-release、effective-sources、check-doc-budget、gate-heartbeat），更新 README、AGENTS、文档索引、CHANGELOG | docs_tdd | A1 | ✅（只准备，切换后提交） |
| C | **切换（需用户确认时间）**：停服务 → 复制 runtime 状态 → 换 plist 和 `~/.local/bin/lark-bot` → 启动 → 用真实的 `lark-bot` 入口验证 → 删除 `common/lark-bot/` → 提交 B3 | 全部 | B1、B2、B3 | 串行 |
| D | **fameex-web 删除 lint-staged 那一行（需用户确认分支和时间）**：这是业务仓提交，会随分支进入团队 | fameex-web | B2 | 串行 |

### 进度（2026-10-11）

| 批次 | 状态 | 产物 |
|---|---|---|
| 0 | ✅ | 计划 `165b070`；`~/github/lark-bot` 带 87 个历史提交 |
| A1 | ✅ | lark-bot `6e2d2cd`…`7873ce3`；13 个测试文件全部通过 |
| A2 | ✅ | `~/.ai-rules` `cdae09b`；自测 46 例；与旧脚本对比，新脚本报出的 error 都在旧脚本的 error 里 |
| A3 + B1 | ✅ | lark-bot `2e7f9e1`、`3f89c33`…`e6609fe`。越界时任务挂成「待确认」：群里回复「确认扩大范围」即可续跑（失败状态没有群内出口）。claude CLI 实测接受分析 schema |
| B2 | ✅ | lark-bot `90f6b40`、`afaf75c`；合并后 15 个测试文件共 507 条全部通过 |
| B3 | ✅ 已准备 | docs_tdd 分支 `chore/split-lark-bot` `7dcdab7`，切换后合并 |
| C | ✅ | 2026-10-11 切换：服务从新仓库运行，健康检查显示代码版本未落后；docs_tdd 合并 `d2d1380`；规则指纹 `91334667a79a` 与生效规则 `cf11742be7a7` 已重新发布 |
| D | ✅ 本地 | fameex-web 分支 `fix/remove-docs-tdd-lint-staged` `caf0b23f8`（基于 `origin/online`，worktree `~/github/fix-docs-tdd-lint-staged`），未 push，何时合入由用户决定。PR-02233 已上线（已完整合入 `origin/online`），2026-10-11 标为 closed。剩余 v2 项目（PR-02208、PR-02440、TR-02386）都在 planning 阶段，没有活跃 worktree，提交守卫失效对它们没有影响 |

### 范围契约（A3 / B1）

- **分析阶段输出** `scope`：
  - `targets[]`：`{ path, symbols[], reason }`；
  - `siblings`：`{ searchQueries[], items[{ path, include, reason }] }`。
- **自动放行**：
  - 已声明的 locale 文件，同 namespace 的其它语言文件；
  - 已声明源文件的同名测试文件。
- **禁区**，必须人工确认：`package.json`、lockfile、`biome.json`、`tsconfig*`、`turbo.json`、`packages/config/**`、`.github/**`、`.husky/**`。
- **改动上限**（可配置）：bugfix 120 行、qaFeedback 200 行、requirement 400 行。
- **收尾判定**：
  - 实际改动 ⊆ `targets` ∪ 标为要改的 `siblings` ∪ 自动放行文件；
  - 违反时不提交，降级为人工复核，列出越界文件；
  - 不自动回滚。
- **集合型任务**（统一 / 全部 / N 处）：`siblings.items` 不能为空。

### 验证

- 每个仓库只跑本次改动涉及的测试文件：`node --check` 加逐文件 `node --test`。
- 切换后用真实的 `lark-bot` 入口验证（`status`、`poll-on`），并跑一次只读任务做冒烟测试。
- docs_tdd 侧运行 `check-doc-budget.mjs`、`check-doc-links.mjs`，然后运行 `rule-release.mjs --write`。

## 后果

- docs_tdd 只剩存量项目的文档和冻结的引擎，不再有任何活跃的调用方。
- lark-bot 可以独立发版，`~/.local/bin/lark-bot` 纳入版本管理。
- 会改代码的任务多一次只读分析调用，换来可以核对的修改边界。
