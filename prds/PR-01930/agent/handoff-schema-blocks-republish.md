# Handoff：治理产物重发被共享 schema 缺口卡住（PR-01930 → docs_tdd schema owner / PR-02074）

> 状态：PR-01930 反「后端根因→前端凑数」治理六道防线**源文件已全部落码并提交**，但**产物重发**（`rule-release --write` → `effective-rules --write`）被 `check-doc-budget` 卡住。失败项**全部**是 PR-02074 的登记文件违反共享 schema，与 PR-01930 改动无关。
> 登记：`agent/blockers.json`（BLK-4，category=dependency）。日期 2026-08-27。
> 纪律：按「共享基础设施勿碰别的活跃项目，只报告不动手」，本轮**未**改 PR-02074 产物、**未**擅自扩共享 schema，仅报告并请 owner 裁决。

## 为什么卡住（链路）

1. 本轮改了受治理源：`~/.ai-rules/AGENT.md`、`~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md`、`common/lark-bot/lib/lark-worker-prompts.mjs`、`common/rules/rule-ids-and-gates.md`、`common/engine/agent-scripts/verify-code-rules.mjs` 等。
2. `VERIFY-RULE-004` fail-closed：改这些源后必须重发产物（`rule-release --write` 发 L3 指纹、`effective-rules --write` 发聚合指纹），否则规则加载门禁报 stale。
3. `rule-release --write` 内部**强制先过 `check-doc-budget`**，不过则拒绝发布。
4. `check-doc-budget` 我这侧全绿（`ruleset 声明完整 ✅`、`54 自测入口 ✅`），但在**常驻预算/路由覆盖**段对 `PR-02074/agent/*.json` 做 schema 校验时红——**唯一**的失败来源。
5. `effective-rules` 聚合指纹又依赖 `rule-release.json` 新鲜 → 整条重发链被 PR-02074 卡死。

## 冲突明细（诊断：共享 schema 缺口，非 PR-02074 漂移）

PR-02074 用的是**真实存在但共享 schema 从未建模**的状态/字段（G5 对账富化 + 路线 B「contract-documented 非 dev-ready」的中间态），属该扩而未扩。

### `common/engine/schemas/msw-manifest.schema.json`

| PR-02074 实际用法 | schema 现状 | 定性 |
|---|---|---|
| `endpoints[].apiStatus = "contract-documented"` | enum 只有 `["not-ready","partial","dev-ready","real"]` | 缺一个合法中间态：后端契约已文档化但未 dev-ready（PR-02074 路线 B 不退役的依据） |
| `endpoints[]` 额外字段 `filterParams / responseShape / requestPageField / note / ongoingValue / assumptions` | `additionalProperties:false` | G5 对账富化字段，schema 未建模 |
| 顶层 `reconciledAt / reconcileNote` | `additionalProperties:false` | G5 对账元数据，schema 未建模 |
| `retirement.retirementCondition` | `additionalProperties:false` | 退役条件，schema 未建模 |

### `common/engine/schemas/assumptions.schema.json`

| PR-02074 实际用法 | schema 现状 | 定性 |
|---|---|---|
| `assumptions[].status = "resolved"` | enum 只有 `["open","confirmed","rejected"]` | 缺销账完成的终态（G5 对账后 ASSUMED 字段落定） |
| `assumptions[].resolvedDate` | `additionalProperties:false` | 销账日期，schema 未建模 |

## 请 owner 裁决（两条路径）

- **路径 A（推荐，若上述状态/字段确属通用需求）**：由 **docs_tdd schema owner** 扩共享 schema——
  - `msw-manifest`：`apiStatus` enum 增 `"contract-documented"`；`endpoints[]`/顶层/`retirement` 放开或显式声明上述字段；
  - `assumptions`：`status` enum 增 `"resolved"`，声明 `resolvedDate`（`YYYY-MM-DD`）。
  - 扩后需 `check-doc-budget` 复跑绿 + `golden-run` 不回归，再由 owner 重发。此路径一次性修好全生态未来项目。
- **路径 B（若判定为 PR-02074 局部越格）**：由 **PR-02074 owner** 把产物收敛到现有 schema（例如 `contract-documented`→`not-ready`/`partial`、富化字段挪进散文或 evidence）。**但**这会削弱 PR-02074 真实状态表达力，需其 owner 确认口径，**不应由 PR-01930 代改**（那正是本治理要杜绝的「改症状迎合现象」）。

## 阻塞与解封触发器

- **被阻塞**：PR-01930 治理产物重发（`rule-release --write` → `effective-rules --write`）。防线在**源文件**已生效并提交，仅**产物指纹**滞后。
- **解封触发器**：`check-doc-budget` 对 PR-02074 产物复跑全绿后，在 docs_tdd 根执行：
  ```bash
  node common/engine/agent-scripts/check-doc-budget.mjs        # 期望全绿
  node common/engine/agent-scripts/rule-release.mjs --write    # 内含 golden-run，发 L3 指纹
  node common/engine/agent-scripts/effective-rules.mjs --write # 发聚合指纹
  node common/engine/agent-scripts/effective-rules.mjs --check # 期望 fresh
  ```
- 解封后 PR-01930 可关闭 BLK-4。

## 本轮明确未做（纪律留痕）

- 未修改任何 `PR-02074/agent/*.json`。
- 未擅自改 `common/engine/schemas/*.schema.json`。
- 仅提交本报告 + PR-01930 自身 `blockers.json` 的 BLK-4 登记。
