# Hook Integration

本文说明如何把 `docs_tdd` 机器 gate 接到本地 Agent。公共命令与规则判断不依赖 Agent；Claude/Codex 配置只做薄适配。

## 0. Agent-neutral 入口

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs capability PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs doctor PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context PR-01234 write_api_or_mock
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G3
```

`capability` 声明 worktree、ruleset 和发布摘要；`doctor` 验证共享 L1、三端 adapter、Claude hook、本地隔离、effective release，并报告 tracked L2 冲突。其中 `L1-SINGLE-SOURCE`（两个 skill）与 `L1-TOPLEVEL-SINGLE-SOURCE`（codex/claude 顶层入口）用 `realpath` 证明三端读的是**字节级同一份 L1**（软链被换成分叉真实文件即 error，不靠子串匹配自欺）；cursor 是声明同一 L3 协议的薄 adapter。无 PostToolUse 能力时，Agent 在完成前必须运行 `changed`。

## 1. Hook 入口

公共 dispatcher：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/claude-posttooluse-gate.mjs
```

当前行为：

| 编辑文件 | 自动动作 |
|----------|----------|
| `apps/web/src/**/*.{ts,tsx}` | `verify-code-rules.mjs --files <file> --json` |
| `package.json` | `verify-code-rules.mjs --files package.json --json` |
| `apps/web/config/environments/.env*` | `verify-code-rules.mjs --files <env> --global-scan --json` |
| `apps/web/docs_tdd/common/*.md` | `check-doc-budget.mjs` |
| `apps/web/docs_tdd/common/rule-index.json` | `check-doc-budget.mjs` |
| `apps/web/docs_tdd/templates/*.md` | `check-doc-budget.mjs` |

`--files` 模式默认不跑全量 mock 扫描，避免无关存量残留阻断单文件编辑；env 文件会显式加 `--global-scan`。

## 2. 本地安装与配置

统一安装器会备份已有文件，创建 `~/.ai-rules`，把 Codex/Claude 的 L1 入口链接到同一源，为 Cursor 写用户级 adapter，并向 Claude settings 合并 hook：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/install-local-agent-rules.mjs
```

安装器可重复运行，不覆盖已存在的共享正文。之后只编辑 `~/.ai-rules`，不要分别编辑 Codex/Claude skill 副本。

Claude Code 风格 PostToolUse hook 示例：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/aven/github/fameex-web/apps/web/docs_tdd/common/engine/agent-scripts/claude-posttooluse-gate.mjs"
          }
        ]
      }
    ]
  }
}
```

本地路径按实际仓库位置替换。

Codex 与 Cursor 当前没有纳入本系统信任边界的自动 PostToolUse hook，必须执行 `changed` fallback；三端阶段出口都必须执行 gate。

## 3. Smoke Test

验证 hook 是否真的生效：

1. 在临时分支或 throwaway 文件里新增一行 `const x: any = 1`。
2. 保存后应看到 hook 输出 `machine gate blocked`，并包含 `CODE-TYPE-001`。
3. 删除该行后重试，应无阻断。

不要在真实业务文件里保留 smoke test 代码。

## 4. 降级方案

如果当前 Agent 环境没有 PostToolUse hook，优先运行统一入口：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed <PROJECT-ID>
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs check <PROJECT-ID>
```

交付前仍必须把命令结果写入 `agent/gate-results.json` 或交付摘要。

## 5. 机器层兜底守护（无 CI/定时器）

`docs_tdd` local-only、无 husky/CI；gate 脚本本身的正确性与规则发布是否 fresh，不能只靠"每次记得跑"。定期手动跑一条兜底命令：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs guard
```

`guard` 串跑 `rule-release --check`（发布是否 fresh）、`golden-run`（gate 机器自身回归，发布 stale 时自动 `--skip-aggregator`）、`doctor`（三端加载/冲突/隔离）三检并聚合退出码：任一失败即 BLOCK。建议改完规则/脚本、或每次开工前跑一次；**不安装 launchd/cron 定时器**（个人本地，保持 personal-local，不写常驻定时任务）。
