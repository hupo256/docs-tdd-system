# docs_tdd v3.5 实施交接

> 交接日期：2026-09-19
> 仓库：`/Users/aven/github/docs_tdd`
> 当前分支：`main`
> 目标版本：`docs_tdd v3.5`
> 协议版本：`workflowVersion: 2`，不得升级或迁移协议号

## 1. 任务目标

完整实施：

`practice-log/IMPLEMENTATION-PLAN-REQUIREMENT-TO-COMMIT-20260919.md`

最终系统目标：

```text
用户只给需求
→ 系统安全创建分支/worktree
→ 完整理解来源
→ 只在必要时询问
→ 完成代码
→ 验证并有界修复
→ 创建安全的本地 delivery commit
→ 不漏需求、不误报完成、不无限重试
```

本轮只修改 `docs_tdd` 仓库，不修改 `/Users/aven/github/fameex-web`，不 push。

## 2. Git 状态

计划已单独提交：

```text
44fd27a docs(docs-tdd): add implementation plan for requirement to commit
```

实施改动已提交：

```text
9beb35a feat(docs-tdd): implement v3.5 requirement-to-commit upgrades
```

本轮没有执行 push。后续若继续修改，应在新的本地提交中记录，并重新校验 rule release manifest。

原计划提交命令为：

```bash
git add <本轮预期文件>
git commit -m "feat(docs-tdd): implement v3.5 requirement-to-commit upgrades"
```

禁止 `git push`。当前工作区应保持 clean。

当前验证事实：

- `vnext-self-test`：59 个脚本通过；
- replay：4 个 incident fixture + 4 个 positive control 通过；
- `rule-release --check`：fresh，manifest 绑定 `9beb35aaf30e3c53dd16f98eadd752189c58770b`；
- `check-doc-budget` 仍被外部 L1 超预算、`PR-99997` 缺真实 `contentHash`、`TR-02386` 缺本地 evidence receipt key 阻断；这些事实未被伪造或修改。

当前主要已修改文件：

```text
common/engine/agent-scripts/docs-tdd.mjs
common/engine/agent-scripts/lib/vnext-autopilot-actions.mjs
common/engine/agent-scripts/lib/vnext-autopilot.mjs
common/engine/agent-scripts/lib/vnext-command-contract.mjs
common/engine/agent-scripts/lib/vnext-exit.mjs
common/engine/agent-scripts/lib/vnext-manual-test.mjs
common/engine/agent-scripts/lib/vnext-metrics.mjs
common/engine/agent-scripts/lib/vnext-work-item.mjs
common/engine/agent-scripts/prepare-coding-worktree.mjs
common/engine/agent-scripts/project-orchestrator.mjs
common/engine/agent-scripts/vnext-commit.mjs
common/engine/agent-scripts/vnext-delivery-guard.mjs
common/engine/agent-scripts/vnext-manual-test.mjs
common/engine/agent-scripts/vnext-source-sync.mjs
common/engine/schemas/acceptance-results.schema.json
common/engine/schemas/vnext-exit-result.schema.json
common/engine/schemas/vnext-work-item.schema.json
```

当前新增文件：

```text
common/engine/agent-scripts/vnext-source-graph-report.mjs
common/engine/agent-scripts/lib/vnext-delivery-truth.mjs
common/engine/agent-scripts/lib/vnext-efficiency-policy.mjs
common/engine/agent-scripts/lib/vnext-evidence-sufficiency.mjs
common/engine/agent-scripts/lib/vnext-repair-policy.mjs
common/engine/agent-scripts/lib/vnext-runtime-decisions.mjs
common/engine/agent-scripts/lib/vnext-source-graph.mjs
common/engine/agent-scripts/lib/vnext-work-context-runtime.mjs
common/engine/agent-scripts/lib/vnext-work-context.mjs
```

不要撤销或覆盖这些已有改动。开始工作前先执行：

```bash
git status --short
git diff --stat
```

## 3. 已完成能力

### 3.1 Safe Run / work context

已实现或接入：

- 消费仓、base、branch、worktree 解析和校验；
- 环境分支拦截；
- dirty path、路径穿越、越界写入和已有文件覆盖拦截；
- checkpoint commit 与 delivery commit 分离；
- delivery 使用冻结 path set；
- runtime decision 追加写入 `runtime-decisions.jsonl`。

必须保持 checkpoint 数据结构为：

```js
checkpoint: {
  actionId,
  outcome,
  recordedAt
}
```

禁止产生 `checkpoint.checkpoint`。

### 3.2 效率路由和指标

已实现：

- `micro`、`lite`、`standard`、`high-risk` 四档路由；
- context、规则、命令、evidence、repair、elapsed 等预算；
- compact metrics；
- 预算和失败域记录；
- runtime decision append-only 记录。

### 3.3 Source Graph / Coverage

已实现：

- source document normalization；
- source graph 编译；
- source fingerprint 与局部失效；
- 新增 CLI：

```bash
docs-tdd source-graph PR-xxxxx [--json]
```

对应文件：

```text
common/engine/agent-scripts/vnext-source-graph-report.mjs
common/engine/agent-scripts/lib/vnext-source-graph.mjs
```

CLI 会重新 normalize 当前 source、对比冻结 fingerprint、编译图并在 source 漂移时 fail closed。

### 3.4 Evidence / Exit

已实现或初步接入：

- evidence sufficiency；
- requirement/surface/evidence 对账；
- 一等 evidence kinds：
  - `human-check`
  - `structural`
  - `quality`
  - `touched-file-quality`
- delivery truth 生命周期与 commit subject 约束；
- 人工验收 schemaVersion 2 初版。

### 3.5 Bounded repair

已实现六个失败域的基础策略：

```text
source
review
code
browser
environment
external-dependency
```

已完成 repair 状态持久化、相同失败指纹去重、预算耗尽终态和唯一恢复动作接线。

### 3.6 已修复的回归

`vnext-command-contract.mjs` 已修复：

- `pnpm --filter` 嵌套 script 展开保留最深层 package cwd；
- test target 和 broad directory 按目标 package 目录解析；
- forwarded path 使用 package-relative 语义；
- package script broad target 可正确阻断。

`vnext-autopilot.mjs` 的完成态 fixture 已补：

```js
codeFingerprint: {
  scopeMode: 'path-set-v1',
  scopePaths: ['src/x.ts']
}
```

已通过：

```text
vnext-command-contract self-test passed
vnext-autopilot-actions self-test passed
vnext-reconcile-actions self-test passed
vnext-autopilot self-test passed
vnext-source-graph-report self-test passed
docs-tdd self-test passed
```

另已执行并通过：

```bash
node --check common/engine/agent-scripts/vnext-review.mjs
```

## 4. 四项目 Replay

replay 已支持 `coverage`、`exit-evidence`、`delivery-truth` 三类 evaluator，并完成四个历史项目的 incident/positive control：

- `PR-01930`：漏第三个 fund-flow consumer 时命中 `SURFACE_COVERAGE`；
- `PR-02306`：漏重置密码和修改登录密码图片需求时命中 `REQUIREMENT_COVERAGE`；
- `PR-02265`：缺功能验收和 touched-file quality 时命中 evidence 阻断；
- `PR-01947`：历史 release/legacy 状态不能冒充当前 authoritative v2 completion。

验证结果：

```text
vnext-replay self-test passed (4 incident fixtures + 4 positive controls)
silentOmissionCount = 0
falseCompletionCount = 0
```

## 5. 已完成实施项

### 5.1 Delivery truth 全面接线

`update-project-index.mjs`、`vnext-pilot.mjs`、`project-orchestrator.mjs` 已使用同一个 delivery truth rollup。pilot release 为 `autopilot-v3.5`，状态保持 `collecting`；旧 G5/G6、release 文档或 legacy 状态不会被推导为 authoritative v2 completion。

正式 `verify` 可以记录为 enforced，但全自动闭环仍需真实 pilot 和 clean-project 认证。string locator 仍是兼容 fallback。

### 5.2 Bounded repair 收口

已完成：

- source sync 失败持久化 repair 状态；
- terminal state 提供唯一 recovery command 或 `nextAction`；
- 相同 `inputFingerprint + failureFingerprint` 禁止无变化重试；
- 预算耗尽进入明确终态；
- source sync、repair policy、autopilot 相关 self-test。

### 5.3 人工验收兼容

已完成 `unresolved` / `newOmissions` 语义分离、schema v1 到 v2 兼容转换、passed/failed 的 `actual` 约束，以及 passed 时 `unresolved = []` 的校验。

### 5.4 文档和版本

已完成 docs_tdd v3.5、ruleset 3.5、`autopilot-v3.5`、pilot `collecting`、readiness、`source-graph` CLI 和相关规则文档更新。`workflowVersion` 保持 `2`，历史日志、历史证据和过去日期事实未被机械改写。

## 6. 重要约束

1. 手工编辑必须使用 `apply_patch`。
2. 不修改 FameEX 业务仓。
3. 不撤销当前已有改动。
4. 不运行全仓库无关检查；稳定后集中执行 scoped/self-test。
5. 不使用 `--no-verify`。
6. 不 push。
7. 不能虚假宣称 Phase 8 已全部完成。
8. 正式 verify 已可 enforced，但全自动闭环仍待真实 pilot 和 clean-project 认证。
9. pilot 必须保持 `collecting`。
10. string locator 仍是兼容 fallback。
11. checkpoint 结构不得嵌套成 `checkpoint.checkpoint`。
12. 只在全部验证完成后创建最终本地 commit。

## 7. 当前剩余事项

v3.5 实施范围内没有剩余代码项。后续仅需在真实 pilot 和 clean-project 上继续收集自动闭环认证数据；取得这些事实前，pilot 必须保持 `collecting`。

仓库级 `check-doc-budget` 的三个既有阻塞需由对应规则或历史项目负责人独立处理：

- `/Users/aven/.ai-rules/AGENT.md` 超过 7000 字符预算；
- `PR-99997` 缺真实 `codeFingerprint.contentHash`；
- `TR-02386` 缺本地 evidence receipt key。

## 8. 最终验证

已执行并通过：

```bash
node common/engine/agent-scripts/vnext-self-test.mjs --self-test
node common/engine/agent-scripts/vnext-replay.mjs --self-test
node common/engine/agent-scripts/vnext-context-budget.mjs --self-test
node common/engine/agent-scripts/lib/vnext-repair-policy.mjs --self-test
node common/engine/agent-scripts/lib/vnext-delivery-truth.mjs --self-test
node common/engine/agent-scripts/rule-release.mjs --check --json
git diff --check
git status --short
git diff --stat
```

发布隔离环境还通过了 85 个核心 self-test 和 golden 基线/32 个变异用例。主工作区 `check-doc-budget` 未通过，原因仅为第 7 节列出的既有外部/历史阻塞，不能记录为 passed。

## 9. 完成标准

实施完成标准 1-9 已满足；主实现已创建本地提交：

```text
9beb35a feat(docs-tdd): implement v3.5 requirement-to-commit upgrades
```

release manifest 与本交接收口记录将使用独立本地提交保存。不得 push。
