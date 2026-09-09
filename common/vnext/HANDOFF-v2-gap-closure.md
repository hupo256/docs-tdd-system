# 交接：docs_tdd v2 补齐（关 token 黑洞 + 漏项防护升硬闸）

> 交接时间：2026-09-09。上游完整计划：`/Users/aven/.claude/plans/hashed-prancing-thimble.md`（本文件自包含，不读那份也能执行）。
> 执行仓库：`/Users/aven/github/docs_tdd`（`/Users/aven/github/fameex-web/apps/web/docs_tdd` 是指向它的 symlink，改一处即两处生效）。

## 0. 为什么做这件事

owner 复盘了 PR-01947 / PR-02265 / PR-02306 / PR-01930 四个已上线项目，提出三个痛点：小改动烧掉大量时间与 token；提测时出现「PRD 里明显的功能没做」；claude 和 codex 都比以前慢。

v2 已于 2026-09-08 正式切换，机器层是干净的（CLI 双向隔离、kickoff 默认 v2、enforced 出口、`vnext-self-test` 18 个脚本 + 5 类回放全绿）。但切换只覆盖了「入口与出口」，三个痛点的真正成因都不在被切换的那部分：

1. **痛点 1/3 完全没被触碰。** `~/.claude/settings.json` 全局挂着 `common/engine/agent-scripts/rule-context-hook.mjs`，它在每次写文件前 `permissionDecision: 'deny'` + 注入 L2 规则正文 + 要求 AI 重试；`lib/rule-consumption.mjs` 的 `resetForHeadChange` 又在 HEAD 变化时清空 `injectedRuleHashes`，导致**每次 commit 后整轮重来**。实测编辑一个 `.tsx` 命中 53 条 `.mdc` / 84,948 字节（`check-doc-budget.mjs` 自己就在打印这行 `ℹ L2 首次编辑样本`）。这个 hook 里没有任何 `workflowVersion` 判断。
2. **痛点 2 只做了一半。** 判定层是对的（三个 replay 夹具能稳定失败），但 `sourceOracle` 在 `vnext-verify.mjs` 里是**可选**输入，不传就整段跳过 required-unit 检查；`discoveredSurfaces` 允许 `[]`；`reviewer.kind` 允许 `'model'` 且 id 自填。**AI 漏抽的需求同样不会出现在它自己提交的 oracle 里，于是全绿。** 夹具证明的是「给对输入时判定正确」，不是「AI 交的输入完整」。
3. **`verify-input.json` 没有脚手架**，而 `workItem` 必须与 canonical `work-item.json` 逐字节指纹一致，AI 手搓大 JSON 会反复 FAIL 重试。

**关键历史（务必先读，否则会重复造轮子）：** A 部分要写的核心代码在 `2ac31c9`（feat: add tiered validation workflow）已经写过、带 self-test，被 `990b213`（Revert tiered-validation workflow）连带 revert 掉了。那次 revert 的真实理由是同提交里的 `--validation-tier` 开关允许 G6–G8 门禁自我降级无人签 —— **撤得对，不要复活它**。但 `docs-tdd.config.json` 不在 revert 的文件列表里（它是消费方配置），所以 `ruleInjection` 配置块（`blockingRuleGlobs` / `advisoryRuleGlobs` / `advisoryCatalogBudgetBytes`）**至今是一段没有任何代码读取的死配置**。本次工作只恢复 L2 注入分层这一部分。

按那份既有配置实测，编辑一个 `.tsx`（v2 项目）：

| 项目 | 现状 | 目标 |
| --- | --- | --- |
| 注入体积 | ~85–98KB 全文 | blocking 8 条 11,526 字节 + advisory 清单 ~5,130 字节 ≈ **16.7KB** |
| 往返轮数 | deny → 读 → 重试 = 2 轮 | **1 轮**（allow + additionalContext） |
| commit 后 | 整轮重来 | 不重注入 |

---

## 1. 开工前必读

**A. 工作区有一批 `common/lark-bot/**` 未提交改动**（`lark-ai-executor.mjs`、`lark-worker.mjs` 等十余个文件，含 `.test.mjs`），是别人在做的事，**不要碰、不要一起 commit**。用 `git status` 一眼可辨：本次任务只应触碰 `common/engine/agent-scripts/**`、`common/vnext/HANDOFF-v2-gap-closure.md`、和机器本地未跟踪的 `docs-tdd.config.json`（`.gitignore` 忽略，改动不会出现在 `git diff` 里，但磁盘上是真实生效的）。

**B. 已完成，验证通过，不用重做：**

- **A1**：`lib/l2-rule-resolver.mjs` 复活了 `partitionRuleInjection(rules, policy)` 与 `renderAdvisoryRuleCatalog(pack, {rules, maxBytes})` 两个导出，`selfTest()` 加了 4 条断言（含「未分类规则默认落 blocking」）。
- **golden 修复**：`lib/l2-rule-resolver-golden.mjs` 的硬编码命中数已从过期的 47/34/30 改为实测的 **53/37/33**（`.tsx`/`useFoo.ts`/`foo.ts`）。`check-doc-budget.mjs` 这项之前是红的，现在绿。
- **A2**：新增 `lib/workflow-version.mjs`，导出 `projectIdFromBranch(branch, config)` 与 `workflowVersionForProject(projectId, {resolveProjectRoot})` / `workflowVersionForWorktree(worktree, config, {resolveProjectRoot})`，判定不出来一律返回 1（fail-safe）。`docs-tdd.mjs`（原 224-232 行的 `workflowVersion(id)`）与 `lib/project-status-report.mjs`（原 47-49 行）已改为调用它，不再各自实现一份。`--self-test` 用真实临时 git 仓库 + README frontmatter 断言，已通过；已登记进 `check-doc-budget.mjs` 的 `SELF_TEST_SCRIPTS`。
- **A6**：`docs-tdd.config.json`（机器本地文件，改动不进 git）的 `ruleInjection.blockingRuleGlobs` 已从 3 条显式补到 9 条：`001-guidelines.mdc` / `definition-of-done.mdc` / `frontend-harness.mdc` / `arch-layering-and-reuse.mdc` / `arch-api-and-schema.mdc` / `i18n-static-keys.mdc` / `ui-theme-tokens.mdc` / `ui-tailwind-token.mdc` / `ui-responsive-h5.mdc`。同时把 `'ruleInjection'` 加进了 `check-doc-budget.mjs` 的 `coreConfigKeys` 清单（防止它在 A3 落地前被判定为「无消费者的伪配置」而报错——**这意味着 A3 必须让某个脚本里出现字面量 `config.ruleInjection`，否则 `check-doc-budget` 会因新加的这一项而变红**，是本次改动引入的新依赖，A3 落地前请留意）。

**C. 还没做（A3/A4/A5，是本次交接的主体）：** 详见下面 §2 的 A3/A4/A5 小节，代码位置、改法与自测点都已具体化到行号。A2/A6 已完成的部分从 §2 中删除，避免重复劳动。

---

## 2. A 部分：hook L2 分层（打痛点 1/3，收益最快，先做）

**铁律：只改 v2 项目的行为，v1 一行不动。** 根据是 v1 的 `run-project-gate.mjs` 依赖 `verifyWorktreeConsumption` 的 receipt 审计，而 v2 项目不跑 Gate —— receipt 在 v2 下没有任何下游消费方，所以放宽 v2 是安全的，放宽 v1 不是。

### A3. 改 `rule-context-hook.mjs` 的 PreToolUse 分支（下一步，先做这个）

现在的逻辑在 `if (delta.length) { ... }` 块（约 96-115 行，就是当前文件里那段）。当前 hook 完全没有 v1/v2 分流，一律走 deny-and-retry。改成：

1. 先算出 `workflowVersion`：用刚落地的 `workflowVersionForWorktree(worktree, config, { resolveProjectRoot })`（`lib/workflow-version.mjs`），`resolveProjectRoot` 从 `lib/roots.mjs` import。
2. `workflowVersion === 1`：走现有 `selectRuleInjectionBatch` + `deny-and-retry`，**逐字保持不变**。
3. `workflowVersion === 2`：

   ```js
   const { blocking, advisory } = partitionRuleInjection(delta, config.ruleInjection)
   blocking → selectRuleInjectionBatch(pack, { rules: blocking })      // 正文
   advisory → renderAdvisoryRuleCatalog(pack, { rules: advisory, maxBytes: config.ruleInjection?.advisoryCatalogBudgetBytes })  // 目录
   ```

   两段文本拼进 `additionalContext`，**`permissionDecision: 'allow'`**，并照现有 else 分支（118-124 行）走 `recordPendingTool` + `singleFileReceipt` 保住审计链。`recordInjection` 的 `channel` 记为 `${client}:PreToolUse:v2-advisory`，`ruleHashes` 取 blocking 与 advisory 两者之和（否则下次会重复注入）。

   注意：`2ac31c9` 的原实现在 blocking 非空时**仍然 deny**。这次要求一律 allow —— v2 的质量闸在出口（`docs-tdd verify` + 证据矩阵），不靠 hook 阻断。

**别忘了**：A6 已经把 `'ruleInjection'` 加进了 `check-doc-budget.mjs` 的 `coreConfigKeys`（消费方检查依据字面量 `config.${key}` 是否出现在某脚本源码里）。A3 落地后 `rule-context-hook.mjs` 里必须出现字面量 `config.ruleInjection`，否则 `check-doc-budget.mjs` 会报「无人消费」变红——这是本次改动自己新增的检查，现在因为 A3 还没做，**`check-doc-budget.mjs` 现在跑起来会因为这一条新失败**（其余项已全绿），是预期中的、等你做完 A3 就会消失的红，不是你弄坏的。

### A4. v2 下 commit 不重注入

`lib/rule-consumption.mjs` 的 `resetForHeadChange`（162-167 行）/ `resetEpochState`（145-160 行）增加一个「保留 `injectedRuleHashes`」开关，由 hook 在 v2 时传入（`updateLedger` 的调用链里目前 HEAD 变化时无条件调 `resetForHeadChange(existing, worktree, head)`，在 267-270 行；需要把 v2 标记从 `updateLedger`/`prepareLedger` 的 identity 一路传下去，或者在 hook 侧用一个专门的 v2 更新函数）。**其余全部保持不动**：`recordHeadChangeAudit` 的 tainted 记录、`contextEpoch += 1`、`pendingTools = {}` 都照旧。只有「已注入哪些规则」的记忆跨 HEAD 保留。要给 `lib/rule-consumption.mjs --self-test`（428 行起）加一条断言。

### A5. 修 `node -e` 被误判为写操作

`lib/hook-targets.mjs` 的 `classifyTargets`（62-86 行）把 `node -e '<inline script>'` 判成 `unknownWrite` 并 deny（79 行 `opaqueWrite` 判据里的 `node\s+-e`），理由是「目标无法静态解析」。规划期间这条把纯只读的规则包统计脚本拦了两次。让内联脚本不再无条件算写操作（或至少在脚本文本不含写 API 时放行）。加对应 self-test 反例（`selfTest()` 在 88 行起，参考已有的 `python -c` 反例写法，102 行）。

---

## 3. B 部分：`sourceOracle` 改成机器派生的硬闸（打痛点 2）

### B1. work-item 新增 `sourceUnitDispositions`

每个 source unit 一条：`{ sourceId, disposition: 'anchored' | 'not-a-requirement', reason? }`，`not-a-requirement` 必须带 `reason`（与现有 surface disposition 的 `not-applicable` / `deferred` 需 reason 同一模式）。

改 `common/engine/schemas/vnext-work-item.schema.json` —— 它是 `additionalProperties: false`，不显式加字段会直接校验失败。

这个字段会自然进入 `coverageFingerprints()` 算的 `requirementsFingerprint`，所以**排除决定会被 reviewer 冷读看到，且改动会让旧 review response 和 V2 人签 `scopeApproval` 自动失效** —— 这是想要的行为，不是副作用。

### B2. verify 内部派生 oracle

`lib/vnext-work-item.mjs` 的 `requirementCoverageProblems` 增加：拿 normalize 出的全部 sourceUnits，逐个要求「被某 requirement 的 `sourceAnchors[].sourceId` 锚定」**或**「有 `not-a-requirement` + reason 的显式排除」，两者皆无即 `REQUIREMENT_COVERAGE` FAIL。

`vnext-verify.mjs` 的 `runVNextVerification` 在第 47 行已经算出 `normalized.sourceUnits`，直接往下传即可。**外部传入的 `input.sourceOracle` 降级为附加约束**（只能加要求、不能减），不再是唯一来源。

### B3. `buildCoverageReviewRequest` 加反向检查

`lib/vnext-coverage-review.mjs:41` 现在只查「requirement anchor 都在 sourceUnits 内」（`unknownAnchors`）。补上反方向：「每个 sourceUnit 都有归属（锚定或显式排除）」。让漏抽在 `--prepare-review` 阶段就暴露，而不是等到 verify。

### B4. 补齐所有样本（本部分的验收核心）

要改的样本：

- 3 个 pilot work-item：`common/vnext/pilots/PR-02074-search-width/work-item.json`、`PR-02172-provider-visibility/work-item.json`、`PR-02233/work-item.json`
- 3 个 replay 夹具：`common/engine/fixtures/vnext-replay/PR-0{1930,2265,2306}-*.json`。它们目前**手写** `sourceOracle`（例如 PR-02306 夹具手写了 `PASSWORD-RESET-COPY` → `PRD-IMG-004`）—— 正是「oracle 靠人喂」的活证据。改为依赖机器派生，只保留 `sourceDocuments` 让 `PRD-IMG-004/005` 成为真实 unit。
- `common/engine/fixtures/vnext-exit-cases.json`

**验收：夹具的 `expectedFailures`（`REQUIREMENT_COVERAGE` 等）必须保持不变、改完仍稳定失败，且 `positiveControl` 仍恢复 PASS。** 若为了让夹具通过而放宽了判定，等于把这次改造做废了。

---

## 4. C 部分：reviewer 独立性

work-item 新增 `requirementsAuthor: { kind, id }`（抽需求的执行者身份）。`lib/vnext-coverage-review.mjs` 的 `validateCoverageReviewResponse` 增加一条：`reviewer.id === requirementsAuthor.id` 即 invalid。同步改 schema 与 3 个 pilot 样本。

挡的是「同一个 session 自己抽需求、自己冷读审查、自己签 pass」。B 和 C 一起做（同一批改 schema 与样本，省一次回归）。

---

## 5. D 部分：`verify-input` 脚手架

`vnext-verify.mjs` 新增 `--scaffold-input --project <dir> --worktree <path>`，把骨架打到 stdout。机器能确定的全部填好：

- `workItem`：直接读 canonical `work-item.json`（消灭最大一类 FAIL —— 指纹不一致）
- `currentRevision`：取 `workItem.sourceSnapshot.revision`
- `sourceDocuments`：按 `sourceSnapshot.sources[].path` 从项目目录**实读文件内容**
- `evidence.codeFingerprint` / `runId` / `capturedAt`：从 `--worktree` 实测（复用 verify 现有的 code fingerprint 测量路径）
- `reviewResponse` / `discoveredSurfaces` / `implementation.coveredSurfaceIds` / `evidence.facts` / `blockers`：留成带 `TODO:` 说明的空骨架，**不猜内容**

同时把该命令写进 `common/rules/rule-router.md` §0 与 `common/rules/startup-prompt.md` 的 v2 步骤。

---

## 6. 验证

```bash
cd /Users/aven/github/docs_tdd

node common/engine/agent-scripts/lib/l2-rule-resolver.mjs --self-test    # A1（已绿）
node common/engine/agent-scripts/lib/workflow-version.mjs --self-test    # A2
node common/engine/agent-scripts/lib/rule-consumption.mjs --self-test    # A4
node common/engine/agent-scripts/lib/hook-targets.mjs --self-test        # A5
node common/engine/agent-scripts/vnext-self-test.mjs                    # 18+ 脚本
node common/engine/agent-scripts/vnext-replay.mjs                       # B 的核心验收
node common/engine/agent-scripts/vnext-route-replay.mjs
node common/engine/agent-scripts/vnext-exit-replay.mjs
node common/engine/agent-scripts/vnext-verify.mjs --self-test
node common/engine/agent-scripts/vnext-pilot.mjs --self-test
node common/engine/agent-scripts/check-doc-budget.mjs                   # 改对 golden 后才可能绿
node common/engine/agent-scripts/golden-run.mjs
```

**A 的行为验证（self-test 不够）**：给 hook 喂两份 stdin payload（同一个 Edit，一份 cwd 在 v1 worktree、一份在 v2 worktree），断言 v1 得 `deny`、v2 得 `allow` + `additionalContext`，且 v2 的 `additionalContext` 落在 ~17KB 量级而非 ~85KB。再断言同一 v2 session 在 HEAD 变化后第二次 Edit 不再注入。

**B/C 的反例验证**：构造「PRD 有 3 个 unit、work-item 只锚定 2 个、第 3 个既不锚定也不排除」的 work-item，断言 `REQUIREMENT_COVERAGE` FAIL；构造 `reviewer.id === requirementsAuthor.id`，断言 review 被拒。

**D 的验证**：对 PR-02074 pilot 跑 `--scaffold-input`，输出直接喂 `vnext-verify --input`，断言失败原因只剩「evidence / reviewResponse 是 TODO 骨架」，不出现任何指纹或结构错误。

**规则链**：A6 只改 `docs-tdd.config.json`（消费方配置，不进 `.mdc`，不影响 `sourceHash`），**不需要 republish**。B/C 若改了 `common/rules/*` 或 schema，按现状跑 `publish-rule-chain.mjs` 并 `docs-tdd rules status` 确认。

---

## 7. 明确不做的事

- 不改 v1 项目的 hook 行为、Gate 链、receipt 审计。v1 是 maintain-only，`prds/` 下 14 个项目全是 v1，它们的编码体验不在本次范围。
- **不复活 `2ac31c9` 的 `--validation-tier` 验证档位自降级** —— `990b213` revert 它是正确的。
- 不批量迁移存量项目到 v2，不删历史 Gate。
- 不动 `common/lark-bot/**` 的未提交改动。
- `git push` 需 owner 当次明确授权；默认止步于 `git add` / `git commit`。

## 8. 收尾（不是代码改动，但没它这套改进无法证伪）

拿一个真实小需求走完 v2 全程（`kickoff` → 抽需求 → `--prepare-review` → `--scaffold-input` → `docs-tdd verify`），记录真实 token 与墙钟，回填 `common/vnext/context-budget.json` 里至今为 `null` 的 `historicalTokenCount`。在此之前「v2 省 token」只是可复算的字符代理推算，不是事实。

同一步顺带了结：`common/vnext/pilot-report.json` 的 `decision` 仍是 `collecting`，`LEVEL_COVERAGE` 因「无 completed V2 样本」为 false，PR-02233 的 `latest-result.json` 相对 work-item 已 stale。owner 已接受「样本不足」的系统级风险并批准切换，但这两项该在有真实 v2 样本后一并关闭。
