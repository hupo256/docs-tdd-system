# Hook Integration

本文说明如何把 `docs_tdd` 的规则注入与机器 gate 接到全部已登记 AI 入口。公共解析、消费回执和规则判断不依赖具体 AI；各入口只做薄适配。

## 0. Agent-neutral 入口

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs capability PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs doctor PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context PR-01234 write_api_or_mock
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed PR-01234
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G3
```

`capability` 声明 worktree、当前客户端、ruleset 和发布摘要；`doctor` 验证共享 L1、五入口全集、direct/runtime adapter、Claude/Codex hook、本地隔离、effective release、所有 worktree 的规则入口可见性，并报告 tracked L2 冲突。其中 `L1-SINGLE-SOURCE`（skill）与 `L1-TOPLEVEL-SINGLE-SOURCE`（Codex/Claude Code 顶层入口）用 `realpath` 证明它们读的是**字节级同一份 L1**；skill 的全部引用文件也进入 effective fingerprint。软链断开、出现可被扫描到的 backup skill、规则入口被 `skip-worktree` 隐藏或被换成内容相同的分叉真实文件都会报错。Cursor 使用生成器产出的薄 adapter；Lark-Codex / Lark-Claude 共用纳入 effective fingerprint 的 runtime adapter。

固定入口全集为 `codex`、`claude`、`cursor`、`lark-codex`、`lark-claude`。`doctor` 对缺项、多项、缺 adapter、缺 enforcement 或缺 source fingerprint 一律以 `VERIFY-RULE-003` 阻断，避免新增入口后忘记接规则链。

## 1. L2 机械注入

Cursor 继续原生消费当前 worktree 的 `.cursor/rules/*.mdc`。Claude Code 与 Codex 共用：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/rule-context-hook.mjs --client <claude|codex>
node apps/web/docs_tdd/common/engine/agent-scripts/rule-context.mjs resolve --file <repo-relative-file>
```

Resolver 逐字读取当前 worktree 的 MDC：`alwaysApply: true` 总是命中，其余按仓库相对路径匹配 `globs`。`PreToolUse` 首次命中新规则时 deny-and-retry 注入正文，同一 epoch 按内容 hash 去重。96 KiB 内按稳定顺序分批注入；单条自身超限则点名要求拆分，不截断。Shell 目标分仓内、仓外、未知三态：明确写 `/dev/null` 或仓外绝对路径不触发规则，仓内照常注入，动态/不透明落点 fail-closed。

重试放行前记录 pending tool，`PostToolUse` 再把文件内容 hash、规则包 fingerprint、规则 hash 和 session/context epoch 写入 `output-tdd/rule-consumption/`。`changed` 与 G5+ 对 Claude/Codex 校验当前 session 的**累计**回执；未经过 hook 的额外写入、过期内容或规则变化均阻断。SessionStart、PreCompact 和 Git HEAD 变化只开启新的**注入 epoch**（清规则注入缓存与未完成 pending），不重置会话审计基线、已消费回执、touched files 或 taint；因此压缩上下文和中途 commit 都不能洗白未覆盖写入。文件恢复到会话基线内容时可自动解除该文件 taint。账本锁带 PID/时间戳、短重试和 stale 抢占，进程异常退出不会永久卡死后续 hook。

没有 `globs` 且非 `alwaysApply` 的 MDC 无法按文件路径机械触发，Resolver 必须在 `unscopedRules` 中如实报告。目前已知为 `async-api-routes.mdc`；在补充明确 glob 前不宣称该条已与 Cursor 自动行为对齐。

## 2. PostToolUse 代码门禁

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
| `apps/web/docs_tdd/common/rules/rule-index.json` | `check-doc-budget.mjs` |
| `apps/web/docs_tdd/templates/*.md` | `check-doc-budget.mjs` |

`--files` 模式默认不跑全量 mock 扫描，避免无关存量残留阻断单文件编辑；env 文件会显式加 `--global-scan`。

## 3. 本地安装与配置

统一安装器会备份已有文件，创建 `~/.ai-rules`，把 Codex/Claude 的 L1 入口链接到同一源，为 Cursor 写用户级 adapter，并向 Claude 与 Codex 合并 PreToolUse/PostToolUse/SessionStart/PreCompact hook。skill 旧备份会移到 `~/.ai-rules/backups/<client>/skills/`，避免被客户端当成重复 skill 发现：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/install-local-agent-rules.mjs
```

安装器可重复运行且会升级已存在的同命令 hook，不覆盖已存在的共享正文。之后只编辑 `~/.ai-rules`，不要分别编辑 Codex/Claude skill 副本。Codex 首次加载新增或变更的 hook 时会按内容 hash 要求信任确认；必须先审查命令路径，再选“Trust all and continue”。配置改动后重新确认，因为旧 hash 不再有效。

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

Codex 配置字段名是 `timeout`（秒），不是 `hooks/list` 输出中的 `timeoutSec`；安装后用 Codex `hooks/list` 或启动审查确认四项均为 `trusted`，并确认 timeout 为 20/20/10/10 秒。Claude 的字段同样是 `timeout`。三个直接入口的阶段出口仍必须执行 gate；hook 是编辑时强制消费层，不替代最终门禁。Lark 两个入口由 Worker 在每次 AI 调用前执行 fresh/fail-closed 校验，并继续执行 Worker quality gate。

## 4. Smoke Test

验证 hook 是否真的生效：

1. 在带 `.cursor/rules` 的临时 Git 仓库请求编辑一个 `.tsx` 文件。
2. 首次编辑必须被拒绝并出现完整的匹配规则上下文；同一工具调用未经重试不得写入。
3. 重试后允许写入，`rule-context.mjs status --session-id <id>` 应有对应 receipt。
4. 绕过 hook 再改另一个文件后，`rule-context.mjs verify --session-id <id> --client <client>` 必须失败。

不要在真实业务文件里保留 smoke test 代码。

## 5. 降级方案

如果当前 Agent 环境没有 PostToolUse hook，优先运行统一入口：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed <PROJECT-ID>
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs check <PROJECT-ID>
```

交付前仍必须把命令结果写入 `agent/gate-results.json` 或交付摘要。

## 6. 机器层兜底守护（无 CI/定时器）

`docs_tdd` local-only、无 husky/CI；gate 脚本本身的正确性与规则发布是否 fresh，不能只靠"每次记得跑"。定期手动跑一条兜底命令：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs guard
```

`guard` 串跑 `rule-release --check`（发布是否 fresh）、`golden-run`（gate 机器自身回归，发布 stale 时自动 `--skip-aggregator`）、`doctor`（五入口覆盖/同源、adapter、冲突与隔离）三检并聚合退出码：任一失败即 BLOCK。建议改完规则/脚本、或每次开工前跑一次；**不安装 launchd/cron 定时器**（个人本地，保持 personal-local，不写常驻定时任务）。
