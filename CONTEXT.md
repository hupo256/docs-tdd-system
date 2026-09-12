# apps/web docs_tdd 当前上下文

> 本文件只记录当前本地运行状态、活跃项目和恢复提示。公共规则体系说明见 [README.md](./README.md)，Agent 行为规则见 [AGENTS.md](./AGENTS.md)。

## 本地环境

- 主仓库路径：`/Users/aven/github/fameex-web`（文档在此演进）
- 当前工作重点：**PR-02074 预测市场三期**——最近工作流结果 G8 BLOCK (fail=0, warn=2)（2026-09-12），worktree `/Users/aven/github/PR-02074`。本行由 `update-project-index.mjs --write` 从最近 Gate / verify 活动派生，勿手改。
- 本地文档目录（唯一真实路径）：`/Users/aven/github/fameex-web/apps/web/docs_tdd/`
- 文档跟踪：本目录为独立本地 Git 仓库；业务仓挂载路径继续保持 ignore，不提交到业务仓。
- 当前框架：docs_tdd v3.3；新需求默认使用第二代 work-item 协议（`workflowVersion: 2`），存量项目按 README `workflowVersion` 继续第一代流程。

## Worktree 与文档 symlink

文档先行模式：**只在主仓库维护 `docs_tdd`**；各 feature worktree 通过 symlink 实时读取同一份文档，禁止复制目录。

**worktree 归属（哪个项目在哪个 worktree）唯一真值源是 [PROJECTS.md](./PROJECTS.md) 的 Worktree 列**——它直接派生自 `git worktree list`，不再在本文件手抄（曾因手抄漏登记导致「按文档找不到 worktree、跑去主仓误判代码不存在」）。需要实时确认时直接跑 `git worktree list`，或重生成 `PROJECTS.md`。

| 角色 | 路径 | 分支 | 用途 |
|------|------|------|------|
| 主仓库 | `/Users/aven/github/fameex-web` | `online` | 写 / 改 `docs_tdd`、公共规则沉淀 |

> 各 feature worktree 均已 symlink `docs_tdd`；具体路径见 `git worktree list` / PROJECTS.md。启动端口不再固定登记，运行时按需 `PORT=4xxx pnpm dev` 传入（见 [common/rules/coding-worktree.md §2.1](./common/rules/coding-worktree.md)）。

## 当前活跃项目

> **项目清单/状态/worktree/责任模块的完整索引见 [PROJECTS.md](./PROJECTS.md)（自动生成）。** 本段只记 PROJECTS.md 给不了的「当前线程焦点、下一步动作、易踩坑位」这类叙述性上下文，不再枚举全部项目状态（那会漂）。

### PR-01685 活动落地页（当前主项目）

- 项目目录：`apps/web/docs_tdd/prds/PR-01685/`；worktree 见 PROJECTS.md（分支 `feature/PR-01685-1`；注意 `feature/PR-01685` 是后台分支、非基线）。
- 焦点/下一步：已切真实接口联调；Browser/Playwright 验收、JF 95% UI 还原；`06-collaboration §7` 仅余 `B10 ruleContent` 格式与联调环境网关实测待关闭。
- 全量待确认登记唯一来源：`product/06-collaboration.md §7`。

### docs_tdd 公共规则薄包装整理

- 公共规则唯一入口：`apps/web/docs_tdd/common/`；可执行公共脚本如 `common/engine/agent-scripts/notify-lark.mjs`。
- 已启用 Lark 通知项目的 `notify-lark.mjs` 保持薄包装，项目脚本不得复制公共实现；项目文档只写当前项目事实/配置/状态/例外，公共规则不得在项目目录复制全文。

## 非活跃历史项目

已上线 / worktree 已回收的项目（PR-01973 / PR-02006 / PR-02022 / PR-PricePanel / PR-01988 等）状态见 [PROJECTS.md](./PROJECTS.md)（Worktree 列显示 `—` 即已回收）与各项目 `README.md`；不在此重复枚举。真实 API / QA 验收后续差异回各项目 `product/06-collaboration.md` 补记。

## 恢复工作时先读（当前工作）

线程中断或上下文压缩后，**走 [common/rules/rule-router.md](./common/rules/rule-router.md) §1 启动协议**，不要在这里再列一遍读取顺序——本文件曾硬编码一份 10 步全读清单，与 router 的「禁止全读 `common/`」直接冲突，冷启动的 Agent 命中哪份全看运气。

冷启动只需三件事：

1. 读 [common/rules/rule-router.md](./common/rules/rule-router.md)（唯一常驻规则文件）。
2. 读 README `workflowVersion`：v2 读 `work-item.json` / `latest-result.json`，v1 读 `agent/context-summary.md`。
3. 跑 `docs-tdd context <PROJECT-ID> <SCENARIO>`；CLI 自动按版本返回对应 context。

不要自动回到其他项目；除非用户明确切换项目。
