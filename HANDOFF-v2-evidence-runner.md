# v2 Evidence Runner 开发交接

> 生成时间：2026-09-08 之后的当前工作会话  
> 工作目录：`/Users/aven/github/docs_tdd`  
> 当前状态：已停止编码，等待下一个 chat 接手

## 1. 本轮目标

继续完成 docs-tdd v2 精简和可靠性改造，当前聚焦于“受信 command evidence runner”：

- CLI 亲自执行已审查的验证命令；
- 签发绑定当前代码和 work-item 的 evidence receipt；
- 只有可验证的 CLI 证据才能获得 autonomous assurance；
- 人工或调用方填写的 evidence 必须保持 assisted，不能伪装成 autonomous。

## 2. 已提交工作

当前已有三个相关提交：

```text
41587e3 feat: harden rule delivery and v2 review
61ea40f feat: enforce safe v0 micro scope
605486e fix: revalidate evidence without repeating review
```

它们已经完成：

- v2 代码规则路由；
- Hook 注入预算、分层和去重；
- 图片 source intake；
- 独立机器 review；
- 安全的 V0-micro；
- 代码变化后只重验 evidence，不重复 source review；
- effective code fingerprint，避免仅 Git HEAD 变化导致证据失效。

## 3. 当前未提交工作

受信 command evidence runner 约完成 80%–90%，尚未提交。

最后确认的 `git status --short`：

```text
 M common/CHANGELOG.md
 M common/engine/agent-scripts/docs-tdd.mjs
 M common/engine/agent-scripts/lib/vnext-context.mjs
 M common/engine/agent-scripts/lib/vnext-coverage-review.mjs
 M common/engine/agent-scripts/lib/vnext-exit.mjs
 M common/engine/agent-scripts/lib/vnext-work-item.mjs
 M common/engine/agent-scripts/project-orchestrator.mjs
 M common/engine/agent-scripts/vnext-review.mjs
 M common/engine/schemas/vnext-coverage-review.schema.json
 M common/engine/schemas/vnext-exit-result.schema.json
 M common/engine/schemas/vnext-work-item.schema.json
 M common/rules/rule-router.md
 M common/vnext/README.md
?? common/engine/agent-scripts/lib/vnext-evidence-receipt.mjs
?? common/engine/agent-scripts/vnext-evidence.mjs
```

本交接文档创建后，状态中还会新增：

```text
?? HANDOFF-v2-evidence-runner.md
```

不要丢弃上述未提交改动。

## 4. Evidence runner 已实现内容

主要新增文件：

```text
common/engine/agent-scripts/vnext-evidence.mjs
common/engine/agent-scripts/lib/vnext-evidence-receipt.mjs
```

已经实现：

1. 新增 `docs-tdd evidence` 命令。
2. 命令计划使用 `argv: string[]`，执行时强制 `shell: false`。
3. `evidenceCommands` 冻结在 `work-item.json` 中。
4. `evidenceCommands` 纳入 work-item/review fingerprint。
5. 独立 reviewer 检查 evidence command 的合法性以及 requirement/surface coverage。
6. runner 拒绝明显伪证据命令，包括：
   - `true`；
   - `echo`；
   - version probe；
   - shell eval；
   - command 与 evidence kind 不匹配。
7. 执行命令前后测量 effective code fingerprint。
8. 如果命令修改了代码内容，拒绝签发 receipt。
9. receipt 绑定：
   - work-item fingerprint；
   - evidence plan fingerprint；
   - effective code fingerprint；
   - argv；
   - exit code；
   - 命令输出 hash；
   - 执行时间。
10. 使用本机 HMAC 对 receipt 签名并支持验签。
11. 验签成功的纯命令证据可以得到：

```text
assuranceMode: autonomous
evidenceTrust: cli-attested
```

12. 手填证据或 human evidence 继续标记为：

```text
assuranceMode: assisted-pilot
evidenceTrust: caller-supplied
```

13. assisted PASS 不再被 status/context 认定为 authoritative PASS。
14. verify/exit 会交叉验证 receipt、coverage 和 required evidence level。

## 5. 已确定的产品与安全决策

### 5.1 标准命令不要求额外 plan 文件

默认命令计划直接来自：

```text
work-item.json.evidenceCommands
```

标准命令应为：

```bash
docs-tdd evidence <PROJECT-ID> --out <evidence.json>
```

`--plan` 可以作为兼容或显式输入参数保留，但如果提供：

- 内容必须与 work-item 中已 review 的 `evidenceCommands` 完全一致；
- 不能绕过独立 review；
- 修改命令计划后必须重新 review。

不要再把额外 evidence plan 文件写成标准流程中的必需步骤。

### 5.2 不能只信退出码

仅证明某条命令退出 0，不足以证明它是有效测试。例如不能把 `true` 标成 `directed-tests` 后获得 autonomous PASS。

命令必须：

- 与 evidence kind 匹配；
- 覆盖对应 requirement/surface；
- 预先冻结到 work-item；
- 经过独立 review；
- 由 CLI 实际执行并签发 receipt。

### 5.3 人工证据不能升级为 autonomous

human/manual/caller-supplied evidence 必须维持 assisted 状态。不能因为 verify 输入写了 PASS 就升级成 authoritative PASS。

## 6. 最后中断位置

### 6.1 已成功同步

以下文件已经把标准入口从必需 `--plan` 改成默认读取 work-item：

#### `common/CHANGELOG.md`

已从：

```text
docs-tdd evidence <ID> --plan ...
```

改为：

```text
docs-tdd evidence <ID>
```

#### `common/rules/rule-router.md`

已改为：

```text
docs-tdd evidence <PROJECT-ID> --out <evidence.json>
```

并注明命令计划取自 work-item。

### 6.2 尚未完成：`project-orchestrator.mjs`

需要修改：

```text
common/engine/agent-scripts/project-orchestrator.mjs
```

把三处旧提示：

```text
docs-tdd evidence ... --plan <evidence-plan.json> --out <evidence.json>
```

改为：

```text
docs-tdd evidence ... --out <evidence.json>
```

位置包括：

1. `kickoffVNext()` 生成 README 的“下一步”第 3 步；
2. `resumeVNext()` 在尚无 `latest-result.json` 时返回的 command；
3. `resumeVNext()` 在需要重新采集 evidence 时返回的 command。

最后两次编辑均未执行成功，工具报错：

```text
docs_tdd L2 preflight did not complete before this turn.
Retry the user turn or reload the extension.
```

因此这三处仍保持旧内容。下一个 chat 重载环境后继续修改即可。

### 6.3 尚未完成：`common/vnext/README.md`

至少还有以下内容需要同步：

- 第 94 行附近仍有带 `--plan /tmp/evidence-plan.json` 的标准示例；
- 第 120 行附近仍把 evidence plan 描述成外部文件。

应调整为：

- 默认从 work-item 读取 `evidenceCommands`；
- `--plan` 只是可选兼容/显式输入；
- 如果提供，必须与 work-item 完全一致；
- 修改命令后必须重新独立 review。

`vnext-evidence.mjs` usage 中：

```text
[--plan <evidence-plan.json>]
```

明确表示可选，可以保留。

建议搜索：

```bash
grep -RIn \
  "docs-tdd evidence.*--plan\|evidence <ID> --plan\|--plan <evidence-plan" \
  README.md common \
  --exclude='effective-rules.json' \
  --exclude='rule-release.json'
```

预期只允许留下“`--plan` 是可选参数”的说明，不能再将其写成标准必选流程。

## 7. 接手后的建议步骤

### 步骤 1：先读取规则和当前差异

按仓库规则先读：

```text
AGENTS.md
README.md
common/rules/rule-router.md
```

然后查看：

```bash
git status --short
git diff --check
git diff --stat
git diff
```

不要重做已经存在的实现。

### 步骤 2：完成默认 work-item plan 的入口同步

修改：

```text
common/engine/agent-scripts/project-orchestrator.mjs
common/vnext/README.md
```

然后重新 grep 所有旧的必需 `--plan` 提示。

### 步骤 3：检查关键实现一致性

重点确认：

- schema 与运行时生成结果一致；
- work-item fingerprint 包含 `evidenceCommands`；
- review receipt 绑定更新后的 fingerprint；
- 修改 `evidenceCommands` 会令旧 review receipt 失效；
- exit result 的 assurance 字段与 schema 一致；
- assisted 结果不会被视为 authoritative；
- `docs-tdd evidence` dispatcher 路由正确；
- 默认没有 `--plan` 时，runner 从 work-item 读取计划；
- 显式 `--plan` 与 work-item 不一致时 fail-closed。

### 步骤 4：语法检查

至少执行：

```bash
node --check common/engine/agent-scripts/vnext-evidence.mjs
node --check common/engine/agent-scripts/lib/vnext-evidence-receipt.mjs
node --check common/engine/agent-scripts/lib/vnext-exit.mjs
node --check common/engine/agent-scripts/lib/vnext-work-item.mjs
node --check common/engine/agent-scripts/lib/vnext-coverage-review.mjs
node --check common/engine/agent-scripts/vnext-review.mjs
node --check common/engine/agent-scripts/vnext-verify.mjs
node --check common/engine/agent-scripts/project-orchestrator.mjs
node --check common/engine/agent-scripts/docs-tdd.mjs
```

### 步骤 5：定向验证

此前定向验证覆盖过以下模块，但最后的默认 work-item plan 改动后必须重新验证：

- evidence receipt；
- evidence runner；
- exit aggregation；
- work-item fingerprint；
- coverage review；
- isolated review；
- verify；
- replay；
- context；
- orchestrator；
- CLI dispatcher。

仓库 v2 聚合自测入口：

```bash
node common/engine/agent-scripts/vnext-self-test.mjs
```

还应检查现有 replay/fixture 验证以及 `docs-tdd golden`。

### 步骤 6：重新生成规则产物

因为 `common/rules/rule-router.md` 已修改，当前生成文件可能已过期：

```bash
node common/engine/agent-scripts/rule-release.mjs --write
node common/engine/agent-scripts/effective-rules.mjs --write
```

预计会更新：

```text
common/rule-release.json
common/effective-rules.json
```

### 步骤 7：最终检查

```bash
git diff --check
node common/engine/agent-scripts/docs-tdd.mjs golden
node common/engine/agent-scripts/docs-tdd.mjs doctor --json
```

已知此前 `doctor` 的唯一 warning 是 CI 闸尚未接入。不要把 warning 或未执行检查描述为已通过。

### 步骤 8：提交

验证稳定后建议执行：

```bash
git add \
  common/CHANGELOG.md \
  common/effective-rules.json \
  common/rule-release.json \
  common/engine/agent-scripts/docs-tdd.mjs \
  common/engine/agent-scripts/lib/vnext-context.mjs \
  common/engine/agent-scripts/lib/vnext-coverage-review.mjs \
  common/engine/agent-scripts/lib/vnext-evidence-receipt.mjs \
  common/engine/agent-scripts/lib/vnext-exit.mjs \
  common/engine/agent-scripts/lib/vnext-work-item.mjs \
  common/engine/agent-scripts/project-orchestrator.mjs \
  common/engine/agent-scripts/vnext-evidence.mjs \
  common/engine/agent-scripts/vnext-review.mjs \
  common/engine/schemas/vnext-coverage-review.schema.json \
  common/engine/schemas/vnext-exit-result.schema.json \
  common/engine/schemas/vnext-work-item.schema.json \
  common/rules/rule-router.md \
  common/vnext/README.md
```

建议提交信息：

```bash
git commit -m "feat: attest v2 command evidence"
```

`HANDOFF-v2-evidence-runner.md` 是临时交接文档，是否纳入提交由接手者决定；默认可以不提交。

不得执行 `git push`，除非用户在当前请求中明确授权。

## 8. 本批完成后的剩余大项

### 8.1 Evidence 级路径依赖与局部失效

当前 effective code hash 已解决“纯 commit 导致证据失效”，但无关源码变化仍可能使整体证据失效。

后续需要：

```text
watchedPaths + dependencyDigest
```

目标是按 evidence 判断受影响范围并增量重验，而不是任意源码变化都让所有证据失效。

### 8.2 CI 强制闸接入

目前 CI 强制闸尚未接入，doctor 仍会报告相应 warning。

在 CI 接入前，不能宣称整套系统已经达到最终 autonomous assurance。

## 9. 不可破坏的安全边界

1. 不能因为命令退出码为 0，就认定它是有效测试。
2. evidence command 必须先冻结到 work-item，再经过独立 review。
3. human/manual evidence 不能伪装为 autonomous。
4. receipt 必须绑定当前有效代码内容，而不是只绑定 Git HEAD。
5. 修改 `evidenceCommands` 后必须让旧 review receipt 失效并重新 review。
6. `--plan` 不能重新变成标准流程中的必需文件。
7. 命令执行期间如果代码内容发生变化，不能签发可信 receipt。
8. 未执行的检查必须报告为 `not-required` 或未执行，不能报告为 passed。
9. 未解决的 doctor warning 不能被隐去。
10. 不得未经当前请求授权执行 `git push`。
