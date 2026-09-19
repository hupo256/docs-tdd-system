# HANDOFF：docs_tdd v3.x 系统升级（仅引擎/规则，不动业务代码）— 2026-09-18

> 最后更新：2026-09-19

> 面向：接手本任务的下一个 chat。
> 当前目标：将已有 docs_tdd v3.x 能力同步到 v2 work-item 项目；**本轮只改 docs_tdd 系统代码、schema、fixture 和实践文档，不修改任何业务仓库代码，不迁移真实项目的 `workflowVersion` 数字。**
> 当前工作目录：`/Users/aven/github/docs_tdd`

## 1. 先读这些文件

按顺序：

1. `README.md`
2. `common/rules/rule-router.md`
3. `common/vnext/README.md`
4. `practice-log/ITERATION-PLAN-v3.5-20260917.md`
5. `practice-log/ITERATION-PLAN-AUTOPILOT-20260918.md`
6. `practice-log/pr-02233-system-feedback-0918.md`
7. 本文后面的“当前改动”和“未完成事项”。

## 2. 已确认的版本决策

不要把以下两个版本混为一谈：

```text
系统/引擎版本：docs_tdd v3.x
项目协议兼容标识：workflowVersion: 2
```

`workflowVersion: 2` 不是旧的 docs_tdd v2 产品版本，而是第二代 work-item 协议标识。当前决定是：

- 不批量把真实项目的 `workflowVersion: 2` 改为 `3`；
- 不做业务代码迁移；
- 只升级系统能力，让 v2 项目可以消费新的 v3.x 对账、自治验证、目标应用和 schema 能力；
- 存量项目继续保持兼容读取，未来如推出第三代协议，必须另做显式 migration / pilot，不能直接替数字。

v2 项目产物实际位于项目根目录：

```text
prds/<PROJECT-ID>/work-item.json
prds/<PROJECT-ID>/latest-result.json
prds/<PROJECT-ID>/runs.jsonl
```

不是 `agent/`。本轮已经修正预算/schema 扫描的根目录定位。

## 3. 本轮已完成的系统改动

### 3.1 结构化 surface / target schema

已改：

- `common/engine/schemas/vnext-work-item.schema.json`
  - `deliveryScope` 允许 `null`；
  - 增加 `deliveryTarget.app/history`；
  - surface 支持兼容旧 `locator`，新增结构化 `codeLocator`；
  - 增加 `displayHint`、`wiring`、`blockedBy`；
  - consumer 要求 wiring/dependsOn；
  - coverage findings 改为有结构的 finding；
  - API dependency 支持 `dependencies`。
- `common/engine/schemas/project-frontmatter.schema.json`
  - projectId 支持 `PR-*` / `TR-*`；
  - 增加 `workItemKind`。
- `common/engine/agent-scripts/lib/vnext-intake-audit.mjs`
  - 校验 codeLocator、目标 app、一致的 provider/consumer 依赖。
- `common/engine/agent-scripts/lib/vnext-work-item.mjs`
  - 对结构化 surface 使用机器对账结果判断覆盖；旧 locator 路径保持兼容。

### 3.2 surface-to-code reconciliation

新增：

- `common/engine/agent-scripts/lib/vnext-reconcile.mjs`
- `common/engine/agent-scripts/lib/vnext-reconcile-runtime.mjs`
- `common/engine/agent-scripts/lib/vnext-reconcile-actions.mjs`
- `common/engine/agent-scripts/vnext-reconcile.mjs`
- `common/engine/schemas/vnext-reconcile-result.schema.json`
- `common/engine/fixtures/vnext-reconcile-cases.json`

能力：

- 根据 codeLocator 在目标 app 中枚举候选路径、匹配 symbol/export；
- provider / consumer wiring 分开判断；
- 记录 `codeStatus`、`wiringStatus`、`runtimeStatus`；
- 绑定 `headSha`、`dirtyHash`、`contentHash`、delivery target；
- target app pivot 后使旧 surface 事实失效；
- 依赖未就绪时进入 `integration-pending` / `await-surface-dependencies`，不把未完成 surface 伪装成完成；
- 结果落盘为项目根目录 `reconcile-result.json`。

CLI 已接入：

```bash
node common/engine/agent-scripts/docs-tdd.mjs reconcile PR-01234 \
  --evidence <evidence.json> --out <reconcile-result.json>
```

注意：结构化 locator 的 reconciliation 目前是“有 codeLocator 才启用”；旧项目只有字符串 locator 时继续旧 evidence 路径，不强制迁移 artifact。

### 3.3 AutoPilot 编排接线

已改：

- `common/engine/agent-scripts/lib/vnext-autopilot-actions.mjs`
- `common/engine/agent-scripts/lib/vnext-autopilot.mjs`
- `common/engine/agent-scripts/project-orchestrator.mjs`
- `common/engine/agent-scripts/lib/vnext-autonomous-validation.mjs`（新增）

当前自动链路核心顺序：

```text
先做 surface reconciliation
→ 未完成 surface 回到 implement-current-scope
→ 依赖阻塞进入 await-surface-dependencies
→ 再执行 evidence
→ 同一 evidence 进入 verify
→ verify 消费当前 reconcile-result
→ PASS 后才允许 delivery commit
```

已修正一个顺序 bug：人工预检不应早于结构化对账；现在 reconciliation 优先。

已保留旧结构：无结构化 locator 的项目不强制生成 reconcile-result。

### 3.4 verify 接线

已改：

- `common/engine/agent-scripts/vnext-verify.mjs`
  - assemble 模式自动读取项目根目录 `reconcile-result.json`；
  - verify 增加 `SURFACE_RECONCILIATION` check；
  - 当前代码指纹/目标 app/运行时关键 surface 不一致时 fail-closed。
- `common/engine/agent-scripts/lib/vnext-autonomous-validation.mjs`
  - 执行 evidence → reconcile（结构化项目）→ verify。

### 3.5 根目录 schema/预算扫描

已改：

- `common/engine/agent-scripts/check-doc-budget.mjs`
  - v2 `work-item.json`、`coverage-review.json`、`latest-result.json`、`reconcile-result.json` 从项目根目录读取；
  - v1 状态文件仍从 `agent/` 读取；
  - schema 报错路径也按实际位置打印。
- `common/engine/agent-scripts/lib/doc-budget-schema.mjs`
  - 轻量校验器支持 schema `type: ["object", "null"]`。

### 3.6 CLI

已改：

- `common/engine/agent-scripts/docs-tdd.mjs`
  - 注册 `reconcile` 命令；
  - 支持 `--base` 参数；
  - v2/v1 命令路由保持隔离。

## 4. 已执行且通过的自测

以下均已通过：

```bash
node common/engine/agent-scripts/lib/doc-budget-schema.mjs --self-test
node common/engine/agent-scripts/lib/vnext-work-item.mjs --self-test
node common/engine/agent-scripts/lib/vnext-autopilot-actions.mjs --self-test
node common/engine/agent-scripts/lib/vnext-autopilot.mjs --self-test
node common/engine/agent-scripts/vnext-reconcile.mjs --self-test
node common/engine/agent-scripts/lib/vnext-reconcile-runtime.mjs --self-test
node common/engine/agent-scripts/lib/vnext-reconcile-actions.mjs --self-test
node common/engine/agent-scripts/lib/vnext-autonomous-validation.mjs --self-test
node common/engine/agent-scripts/lib/vnext-artifact-compat.mjs --self-test
node common/engine/agent-scripts/vnext-artifact-compat.mjs --self-test
node common/engine/agent-scripts/vnext-reconcile-e2e.mjs --self-test
node common/engine/agent-scripts/project-orchestrator.mjs --self-test
node common/engine/agent-scripts/vnext-self-test.mjs --self-test
```

结果：vNext 完整自测覆盖 50 个脚本；新增对账、自治、artifact 兼容和真实 Git E2E 均通过。

语法检查已通过：

```bash
node --check common/engine/agent-scripts/check-doc-budget.mjs
node --check common/engine/agent-scripts/docs-tdd.mjs
node --check common/engine/agent-scripts/project-orchestrator.mjs
node --check common/engine/agent-scripts/vnext-verify.mjs
```

## 5. 2026-09-19 最后一次预算/schema 检查结果

命令：

```bash
node common/engine/agent-scripts/check-doc-budget.mjs
```

命令完整执行并以退出码 1 结束。核心脚本存在性、自测、schema 路由、链接、规则台账、项目索引同步和阶段链均通过；剩余三项均已被准确分类，没有本轮代码异常。

### 5.1 需要修复的真实阻断

1. L1 全局规则超预算：

```text
L1 AGENT.md = 7883 字符，预算 7000，超 883
```

这是全局文件 `/Users/aven/.ai-rules/AGENT.md` 的问题，不是本轮业务/系统代码改动。按规则，应把长清单移入按需 skill；如果本轮只允许 docs_tdd 仓内改动，不要擅自修改该外部全局文件，报告为外部 blocker。

2. `PR-99997` 历史 artifact 被兼容层阻断：

```text
codeFingerprint.contentHash is missing or invalid
```

必须重新运行正式 verify；不能迁移、不能用 `dirtyHash` 代替内容身份，也不能伪造 autonomous PASS。

3. `TR-02386` 是可安全迁移的旧展示字段形态：

```bash
node common/engine/agent-scripts/docs-tdd.mjs artifact-compat TR-02386 --write
```

该命令只能由负责人显式执行。本轮没有自动改写真实 artifact。

### 5.2 非阻断告警

当前脚本预算有告警但未超硬上限：

- `check-doc-budget.mjs` 47997 / hard 48000
- `docs-tdd.mjs` 28632 / hard 30000
- `project-orchestrator.mjs` 29294 / hard 30000
- `verify-build-quality.mjs` 34422 / hard 36000
- `verify-code-rules.mjs` 46561 / hard 50000
- `vnext-verify.mjs` 24806 / hard 30000
- `lib/rule-consumption.mjs` 28814 / hard 30000
- `lib/vnext-autopilot.mjs` 29962 / hard 30000
- `architecture-and-state.md` 15210 / hard 17000

本轮不要通过提高预算来掩盖；后续可抽 lib/拆分。

## 6. 当前工作区状态

当前尚未提交，且没有 `git add` / `git commit` / `git push`。工作区包含：

### 已修改（tracked）

```text
common/engine/agent-scripts/check-doc-budget.mjs
common/engine/agent-scripts/docs-tdd.mjs
common/engine/agent-scripts/lib/doc-budget-schema.mjs
common/engine/agent-scripts/lib/vnext-autopilot-actions.mjs
common/engine/agent-scripts/lib/vnext-autopilot.mjs
common/engine/agent-scripts/lib/vnext-intake-audit.mjs
common/engine/agent-scripts/lib/vnext-work-item.mjs
common/engine/agent-scripts/project-orchestrator.mjs
common/engine/agent-scripts/vnext-verify.mjs
common/engine/schemas/project-frontmatter.schema.json
common/engine/schemas/vnext-work-item.schema.json
```

### 新增（untracked）

```text
common/engine/agent-scripts/lib/vnext-autonomous-validation.mjs
common/engine/agent-scripts/lib/vnext-artifact-compat.mjs
common/engine/agent-scripts/lib/vnext-reconcile-actions.mjs
common/engine/agent-scripts/lib/vnext-reconcile-runtime.mjs
common/engine/agent-scripts/lib/vnext-reconcile.mjs
common/engine/agent-scripts/vnext-artifact-compat.mjs
common/engine/agent-scripts/vnext-reconcile-e2e.mjs
common/engine/agent-scripts/vnext-reconcile.mjs
common/engine/fixtures/vnext-artifact-compat-cases.json
common/engine/fixtures/vnext-reconcile-cases.json
common/engine/schemas/vnext-reconcile-result.schema.json
practice-log/DESIGN-B1-case-expectations-v3.5.md
practice-log/DESIGN-B2-schema-statemachine-v3.5.md
practice-log/DESIGN-B3-golden-fixtures-v3.5.md
practice-log/DESIGN-F-autopilot-control-layer-v3.9.md
practice-log/ITERATION-PLAN-AUTOPILOT-20260918.md
practice-log/ITERATION-PLAN-v3.5-20260917.md
practice-log/pr-02233-system-feedback-0918.md
```

**不要把上述 `practice-log/` 记录误当成业务代码；它们是本轮系统设计和反馈证据。**

## 7. 下一 chat 的推荐执行顺序

### 第一步：确认 diff 范围，严禁碰业务仓库

```bash
git status --short
git diff --stat
git diff -- common/engine/agent-scripts common/engine/schemas
```

不要进入 `/Users/aven/github/fameex-web` 修改任何 `apps/`、`packages/` 业务代码。

### 第二步：历史 artifact schema 兼容策略（已完成）

- `docs-tdd artifact-compat <PROJECT-ID>` 默认只报告，显式 `--write` 才迁移。
- `latest-result.json` 与完整 `runs.jsonl` 作为同一个迁移单元；迁移会重算 summary/result fingerprint 并原子写入。
- 缺少或无效 `codeFingerprint.contentHash` 时禁止迁移，必须重新运行正式 verify；严禁用 `dirtyHash` 冒充内容身份。
- 无 receipt 的旧结果只能降级为 `assisted-pilot / caller-supplied`，不能伪造成 autonomous PASS。
- `check-doc-budget` 在严格 schema 前运行兼容诊断；`PR-99997` blocked、`TR-02386` safe migration 均有 fixture/self-test。

### 第三步：真实临时 Git worktree E2E（已完成）

`vnext-reconcile-e2e.mjs --self-test` 使用真实临时 Git 仓库验证：

- code locator 只枚举目标 app，同名 symbol 不会跨 app 误命中；
- `reconcile-result.json` 实际落盘，assemble verify 读取并消费同一结果；
- code fingerprint 或 delivery target 改变后旧结果失效；
- legacy string locator 不要求 reconcile artifact。

### 第四步：修复根目录错误文案和 schema 路径回归（已完成）

`check-doc-budget.mjs` 已按 `location` 输出真实路径；artifact 兼容诊断的 `readJson` 回归也已补自测。

### 第五步：重新跑分层自测，再跑总门禁

先跑：

```bash
node --check common/engine/agent-scripts/check-doc-budget.mjs
node common/engine/agent-scripts/vnext-self-test.mjs --self-test
node common/engine/agent-scripts/vnext-reconcile.mjs --self-test
node common/engine/agent-scripts/lib/vnext-autonomous-validation.mjs --self-test
```

再跑：

```bash
node common/engine/agent-scripts/check-doc-budget.mjs
```

总门禁当前仍被 L1 和两个历史 artifact 阻断，必须继续区分：

- 本轮系统改动造成的回归；
- 既有工作区漂移；
- 外部 `/Users/aven/.ai-rules/AGENT.md` blocker。

## 8. 不要做的事

- 不要把真实项目 `workflowVersion: 2` 批量改成 `3`；
- 不要修改 `/Users/aven/github/fameex-web/apps/**` 或任何业务代码；
- 不要为了让预算通过而提高 hard limit；
- 不要把历史 latest-result 直接手改成 PASS；
- 不要用 `dirtyHash` 冒充缺失的 `contentHash`；
- 不要把结构化 reconciliation 强制施加到旧 string locator 项目；
- 不要运行 `git push`；
- 不要在未确认范围前自动 `git add` / `git commit`。

## 9. 交接结论

当前已经完成的是：**v2 项目协议的系统侧能力接入、历史 artifact 显式兼容迁移、真实 Git reconciliation→verify E2E，以及对应纯函数和命令自测**。

当前尚未完成的是：**外部 L1 预算和真实历史 artifact 的人工处置**。`PROJECTS.md` / `CONTEXT.md` 已用官方生成器同步，最终稳定性复核已完成；真实 artifact 不应由系统升级自动改写：`PR-99997` 必须重新 verify，`TR-02386` 可由负责人显式执行安全迁移。
