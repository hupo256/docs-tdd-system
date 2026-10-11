# docs_tdd 本机上下文

> 只记录本机运行状态和恢复提示。仓库定位见 [README.md](./README.md)，Agent 行为规则见 [AGENTS.md](./AGENTS.md)。

## 本地环境

- 本仓：`/Users/aven/github/docs_tdd`（独立 git 仓库，远端 `github.com/hupo256/docs-tdd-system`；默认只做本地提交，push 需当次授权）。
- 挂载：`/Users/aven/github/fameex-web/apps/web/docs_tdd` → 本仓（软链）。各 feature worktree 也通过软链读取同一份，禁止复制目录。
- 新需求流程：skill `prd-to-commit`（`~/.ai-rules/skills/prd-to-commit/`），过程文件在 `~/.prd-cache/<ID>/`，不写入本仓。
- lark-bot：CLI 为 `~/.local/bin/lark-bot`（`DOCS_ROOT` 指向本仓），密钥在 `~/.config/fameex-lark/`。
- 当前工作重点：**TR-02386 登录/注册/三方登录迁移到 web-next**——最近工作流结果 V2 enforced passed（2026-09-16）。本行由 `update-project-index.mjs --write` 从最近 Gate / verify 活动派生，勿手改。
- 上一行的说明：引擎 2026-10-10 冻结后不再有新的 Gate 活动，它只反映存量项目最近一次 Gate，不代表当前在做的需求。新需求的进度在 `~/.prd-cache/<ID>/`。

## 存量项目与 worktree

存量项目的清单、状态和 worktree 归属，唯一来源是 [PROJECTS.md](./PROJECTS.md)，它直接派生自 `git worktree list`。需要实时确认时运行 `git worktree list`，或重新生成 PROJECTS.md。启动端口不固定登记，运行时按需用 `PORT=4xxx pnpm dev` 传入（见 [coding-worktree.md](./common/rules/coding-worktree.md) §2.1）。

## 中断后恢复

- **新需求**：进度在 `~/.prd-cache/<ID>/` 的 checklist.md、plan.md、run-log.md 和 `~/github/<ID>` worktree 的提交里。新会话里让 AI 先读这三个文件和 worktree 的 `git log`，再接着做。重跑 skill 时，worktree 已存在会直接复用。
- **存量项目**：先读该项目 README 里的 `workflowVersion`，再按 [rule-router.md](./common/rules/rule-router.md) §2「存量流程路由」恢复。
- 不要自动切到其他项目，除非用户明确要求。
