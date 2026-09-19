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

当前实施改动尚未提交。最终应执行：

```bash
git add <本轮预期文件>
git commit -m "feat(docs-tdd): implement v3.5 requirement-to-commit upgrades"
```

禁止 `git push`。

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

还需完成持久化、去重重试和唯一恢复动作接线，见第 5 节。

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

## 4. 当前最高优先级：四项目 Replay

文件：

```text
common/engine/agent-scripts/vnext-replay.mjs
common/engine/fixtures/vnext-replay/
```

当前 replay 只有三个 coverage fixture，evaluator 只调用：

```js
verifyVNextCoverage(...)
```

需要把 replay 扩展为三类 evaluator：

```json
{
  "evaluator": "coverage|exit-evidence|delivery-truth"
}
```

### 4.1 PR-01930

保留 coverage replay：

```text
PR-01930-missing-fund-flow-entry.json
```

目标：第三个 fund-flow consumer 漏失时出现 `SURFACE_COVERAGE`，补齐后 positive control 通过。

### 4.2 PR-02306

保留 coverage replay：

```text
PR-02306-missing-password-surfaces.json
```

目标：重置密码和修改登录密码图片需求漏抽时出现 `REQUIREMENT_COVERAGE`，补齐后 positive control 通过。

### 4.3 PR-02265

现有 fixture 只测 stale source，必须改为 requirement-to-evidence replay。

历史事实：

- `F04` 没有 passed 验收；
- `AC-4` blocked；
- `AC-13` blocked；
- touched-file type/quality 失败。

历史参考：

```text
prds/PR-02265/README.md:25
prds/PR-02265/agent/acceptance-results.json
prds/PR-02265/evidence/gate/2026-08-21-052902-g6/README.md
```

建议用 `buildVNextExitResult()` 构造 deterministic fixture，incident 应被以下检查阻断：

```text
REQUIRED_EVIDENCE
REQUIREMENT_EVIDENCE
SURFACE_EVIDENCE
```

也可以断言更具体的 acceptance/quality preflight code，但必须表达“缺功能验收和 touched-file quality 时不能完成”。

positive control 必须补：

- F04 passing evidence；
- AC-4、AC-13 `human-check`；
- passing `touched-file-quality`。

### 4.4 PR-01947

新增：

```text
common/engine/fixtures/vnext-replay/PR-01947-delivery-truth.json
```

历史事实：

- 项目实际已经生产上线；
- 历史 G5 仍为 BLOCK；
- 旧归档或 release 事实不能冒充当前 authoritative v2 completion。

历史参考：

```text
prds/PR-01947/README.md
prds/PR-01947/agent/stage-status.json
prds/PR-01947/agent/delivery-status.json
prds/PR-01947/evidence/release/2026-08-26/README.md
```

使用 `deriveDeliveryTruth()`：

- incident：只有历史 release/legacy 状态，没有当前 enforced PASS 和 matching local delivery commit，`authoritativeCompletion` 必须为 `false`；
- positive control：当前 enforced authoritative verification、matching verified paths、committed delivery record、git clean，状态才可为 `delivered`。

### 4.5 Replay 统一指标

每个结果必须输出：

```text
silentOmissionCount
falseCompletionCount
```

四个 fixture 两项都必须为 `0`。

建议定义：

- incident 漏项被预期检查捕获，且 positive control 通过，则 `silentOmissionCount = 0`；
- 未满足 delivery truth 却被判完成时才增加 `falseCompletionCount`。

更新 self-test：

```js
assert.equal(results.length, 4)
assert.ok(results.every((result) =>
  result.ok
  && result.silentOmissionCount === 0
  && result.falseCompletionCount === 0
))
```

## 5. Replay 后的剩余实施项

### 5.1 Delivery truth 全面接线

检查并完成：

```text
common/engine/agent-scripts/update-project-index.mjs
common/engine/agent-scripts/vnext-pilot.mjs
common/engine/agent-scripts/project-orchestrator.mjs
```

要求：

- 项目索引、pilot、orchestrator 使用同一个 delivery truth rollup；
- pilot release 名改为 `autopilot-v3.5`；
- pilot 状态必须保持 `collecting`；
- 不能用旧 G5/G6、release 文档或 legacy 状态推导 authoritative v2 completion；
- 正式 `verify` 可以记录为 enforced，但“全自动闭环”仍需真实 pilot 和 clean-project 认证；
- string locator 仍是兼容 fallback，不得写成已完全淘汰。

### 5.2 Bounded repair 收口

需要补齐：

- source sync 失败持久化 repair 状态；
- terminal state 给出唯一 recovery command 或 `nextAction`；
- 相同 `inputFingerprint + failureFingerprint` 禁止无变化重试；
- 预算耗尽进入明确终态，不得保持 active/retrying；
- 更新 source sync、repair policy、autopilot 相关 self-test。

重点查看：

```text
common/engine/agent-scripts/vnext-source-sync.mjs
common/engine/agent-scripts/lib/vnext-repair-policy.mjs
common/engine/agent-scripts/lib/vnext-autopilot-actions.mjs
common/engine/agent-scripts/lib/vnext-autopilot.mjs
```

### 5.3 人工验收兼容

目标语义：

- `unresolved`：普通未解决项；
- `newOmissions`：本轮新发现漏项；
- `hasNewOmissions()` 只能读取 `newOmissions`；
- schema v1 模板重新 apply 时转换为 v2 兼容结构；
- `passed` 时必须 `unresolved = []`；
- `passed` 和 `failed` 都要求填写 `actual`。

重点查看：

```text
common/engine/agent-scripts/lib/vnext-manual-test.mjs
common/engine/agent-scripts/vnext-manual-test.mjs
common/engine/schemas/acceptance-results.schema.json
```

### 5.4 文档和版本

需要按真实能力更新：

```text
README.md
common/README.md
common/vnext/README.md
common/CHANGELOG.md
common/rules/rule-router.md
common/rules/startup-prompt.md
common/rules/new-project-kickoff.md
common/rules/ruleset.json
common/rule-release.json
```

其中：

```text
docs_tdd v3.4 → v3.5
ruleset 3.3 → 3.5
pilot release → autopilot-v3.5
pilot status → collecting
workflowVersion 保持 2
```

还要更新：

- pilot registry/report/template；
- readiness cases；
- CLI 文档，包括 `source-graph`；
- route/预算、repair、delivery truth 和人工验收语义。

不要机械修改历史日志、历史证据或过去日期下的事实。

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

## 7. 建议执行顺序

```text
1. 扩展 vnext-replay evaluator
2. 改造 PR-02265 fixture
3. 新增 PR-01947 fixture
4. 跑 replay self-test
5. 接通 delivery truth 到 index/pilot/orchestrator
6. 收口 bounded repair
7. 收口 manual acceptance v1/v2 兼容
8. 更新版本、规则、pilot/readiness 文档
9. 运行完整 vNext self-test 和文档预算检查
10. 审查 diff
11. git add + commit
```

## 8. 最终验证

至少执行：

```bash
node common/engine/agent-scripts/vnext-self-test.mjs --self-test
node common/engine/agent-scripts/vnext-replay.mjs --self-test
node common/engine/agent-scripts/check-doc-budget.mjs
git diff --check
git status --short
git diff --stat
git diff
```

如果某个检查是本次范围内 `not-required`，应明确记录为 `not-required`；未执行的检查不能写成 passed。

提交前重点搜索：

```bash
rg -n "v3\\.4|autopilot-v3\\.4|ruleset.*3\\.3|checkpoint\\.checkpoint|pilot.*passed|production-ready" \
  README.md common practice-log/IMPLEMENTATION-PLAN-REQUIREMENT-TO-COMMIT-20260919.md
```

确认没有：

- 把 pilot 写成完成；
- 把旧 gate/release 当 v2 authoritative completion；
- 把字符数写成真实 token；
- 把 string locator 写成已移除；
- 错误升级 `workflowVersion`；
- 无依据的性能提升百分比。

## 9. 完成标准

只有同时满足以下条件才可结束：

1. 四个历史 replay 均通过；
2. `silentOmissionCount = 0`；
3. `falseCompletionCount = 0`；
4. 同指纹失败不能无限重试；
5. terminal state 有唯一恢复动作；
6. authoritative delivery 只来自当前 enforced verify + matching commit/path + clean state；
7. manual acceptance 的 unresolved/newOmissions 语义正确；
8. v3.5 文档、pilot、readiness 与真实能力一致；
9. 最终验证通过；
10. 创建本地提交：

```text
feat(docs-tdd): implement v3.5 requirement-to-commit upgrades
```

不得 push。
