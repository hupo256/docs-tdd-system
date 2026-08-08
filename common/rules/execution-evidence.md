# Execution Evidence

本文定义开发过程中的执行证据记录方式，用来解决“声称跑过命令 / 自测，但无法复核”的问题。

## 1. 目标

- 命令、gate、自测和交付结论必须能追溯到具体证据。
- 证据记录只保存必要摘要，不保存密钥、Cookie、账号、完整私有响应或内网敏感 URL。
- 机器可记录的事实由脚本记录；机器无法判断的视觉、手感和 PRD 语义，由报告写明责任人、步骤和结论。
- 每条规则的触发、加载、执行器和失败动作按 [rule-execution-model.md](./rule-execution-model.md) 定义；本文只规定 Evidence 如何落盘。

## 2. 推荐文件

每个项目推荐维护：

```text
apps/web/docs_tdd/<PROJECT-ID>/
  agent/
    execution-log.md       # 命令执行摘要，可由 log-exec.mjs 追加
    gate-results.json      # 最近一次 gate 结果，可为 PASS 或 BLOCK
    gate-history.json      # 成功 gate 的追加历史，验证 G5→G6→G7→G8 顺序
    stage-status.json      # G5 联调、G7 QA 的结构化状态与证据路径
    code-review.json       # G6 review findings 与处置结论
    acceptance-results.json # 本期 Feature 的验收结果与证据
    blockers.json          # 阻塞/变更机器真值
    delivery-status.json   # G8 交付模式、branch/headSha 与外部证据
    run-state.json         # 一句话编排与断点恢复状态
    rule-waivers.json      # 可选，规则豁免记录
    prd-source-manifest.json # PRD 图片/表格/嵌入对象盘点、追踪和 fingerprint
  evidence/
    <category>/<run>/README.md
```

## 3. 命令执行日志

公共脚本：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/log-exec.mjs --out apps/web/docs_tdd/prds/PR-01234/agent/execution-log.md
```

`log-exec.mjs` 设计为 PostToolUse hook 的公共实现。它只追加真实工具执行后的 Bash 命令和截断输出摘要，且无论记录成功与否都不阻断主流程。

## 4. Gate 证据

首选一键脚本落证据：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G5
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G6
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G7
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate PR-01234 G8
```

它会写入：

- `agent/gate-results.json`：最近一次机器可读 gate 结果，只用于诊断当前运行，不作为成功历史。
- `agent/gate-history.json`：成功 gate 的追加式历史；G6/G7/G8 的前置阶段证明只认这里的连续记录及其真实 evidence 路径。
- `agent/stage-status.json`：G5 真实联调和 G7 QA 的结构化人工结论；`completed` 必须有证据，`not-applicable`/`skipped` 必须有具体原因。
- `agent/code-review.json` + `agent/acceptance-results.json`：G6 的 judgment review 和逐 Feature 验收真值；新模板不再接受散文“已 review/已自测”代替。
- `evidence/gate/<date>-<HHmmss>-g*/README.md`：命令、阻塞项、review/浏览器待补项的人工可读证据；同一天重复运行不会覆盖旧证据。

`agent/gate-results.json.commands` 是子命令摘要数组，新产物包含 `label`、`status`、`ok`、`startedAt`、`finishedAt`。聚合 gate 同时记录工作树和规则 fingerprint；变化后不得沿用旧证据。正式入口默认写 evidence：通过时先追加 `gate-history.json`，再调用 `set-project-stage.mjs` 校验同阶段历史并同步 README、机器版摘要和索引；未通过时只刷新最近结果与索引，不追加历史。不得直接调用 `verify-project-gate.mjs --write` 或 `set-project-stage.mjs` 代替 runner 完成晋级。

需要拆开排查时，可用只读 verifier 查看 G2/G5/G6/G7/G8 判定；正式晋级仍必须回到 `docs-tdd.mjs gate`：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01234 G2 --json
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-01234 --json
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01234 G6 --json
```

每个阶段出口必须由 `docs-tdd.mjs gate` 写入最近结果、成功历史和独立 evidence。不要只在最终回复里写“已通过”，也不要把 `gate-results.json` 的单次 PASS 当成前序阶段执行证明。

每份 `evidence/**/README.md` 或 `product/06-collaboration.md` 的验证摘要必须包含可复核表格：

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `pnpm exec biome ...` | 触达 JS/TS/JSON | PASS / FAIL / 未覆盖 | 若输出 `0 files`，必须补 `node --check` / 专项脚本作为 fallback |
| `node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-01234` | 本次改动文件 | PASS / FAIL | findings 已修 / 已登记豁免 |

`0 files` 不是通过证据，只能说明 Biome 没覆盖到目标文件；ignored 文档或脚本场景必须记录 fallback 命令和结果。

阶段切换或交付前同步恢复摘要：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/update-context-summary.mjs PR-01234 --stage G6 --write
```

## 5. UI / UX 证据

本文只定义报告字段；视觉判定消费 [component-reuse-and-visual-fidelity.md §3](./component-reuse-and-visual-fidelity.md)，工具操作消费 [browser-e2e-mcp.md](./browser-e2e-mcp.md)。UI / UX 报告必须写入 `evidence/`，并包含：

- 页面 URL、视口、主题、账号 / Mock 场景。
- 操作步骤、预期结果、实际结果。
- Figma 节点 ID 和 L2 走查清单 pass/fail。
- 未验证 / 阻塞项，以及需要谁补什么。

截图保存策略以 [browser-e2e-mcp.md §6](./browser-e2e-mcp.md) 为准，本文不维护副本。

## 6. PRD Intake 证据

`evidence/prd-intake/README.md` 逐项引用 sourceId，记录读取工具/方式、提取结论、歧义和负责人确认；读取判定消费 [lark-doc-sync.md §8](./lark-doc-sync.md)。证据报告不复制 manifest 全文。
