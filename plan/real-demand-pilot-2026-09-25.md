# docs_tdd 真实需求 Pilot 台账

> 启动日期：2026-09-25
> 状态：in-progress
> 范围：新的真实需求，不回放历史项目
> 目标：用真实来源、真实代码和真实提测结果验证完整性、质量、效率与 token 成本

## 1. Pilot 规则

1. 用户只提供真实需求来源；系统负责安全 worktree、来源抽取、风险路由、实现、验证、修复和本地提交。
2. V0/V1/V2 与 Micro/Lite/Standard route 均由当前契约自动判定，不为凑样本人工降级或升级。
3. 每个样本必须保留 source-unit coverage、正式 verify、冻结提交范围和 no-push 约束。
4. 只有业务裁决、V2 scope approval、不可读关键来源或外部依赖才中断用户。
5. token usage 只记录宿主提供的真实值；不可得时记录 `null`，不得估算。
6. Pilot 中发现通用失败模式时，补最小 synthetic regression；不回头建设历史项目档案。

## 2. 样本目标

- 至少 1 个真实 V0 样本。
- 至少 1 个真实 V1 样本。
- 至少 1 个真实 V2 样本。
- 至少 10 个复杂度可比的 Micro 样本，用于计算 p50/p90。

同一个样本可以同时计入 verification level 与 Micro 统计，但不得重复计数。

## 3. 单样本记录

每个样本结束后记录：

- 项目编号、来源类型和系统判定的 verification level / execution route。
- source unit 数、requirement 数、surface 数及 coverage 结果。
- reviewer 轮次、用户中断次数、命令数、repair 次数和终态。
- 总历时、真实 token usage 或 `null`。
- enforced verify、代码检查、提测结果和是否发生遗漏/假完成/越界写入/push。
- 失败原因、修复动作及新增 regression fixture。

## 4. 样本台账

| 项目 | Level | Route | 来源 | Coverage | Verify | 提测 | Review | 中断 | 命令 | Repair | 历时 | Token | 状态 |
|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| PR-02233 增量：第三方登录按钮 hover 手型 | 误绑为 V2 | 误绑为 high-risk | 用户文本 + 截图 | blocked：当前增量未进入 work-item | blocked：verify scaffold 仍指向历史 PRD | 待人工提测；定向代码与真实页面验证通过 | 0 | 0 | `null` | 1（系统执行失败） | 9m41s | `null` | `blocked-system` |

### 4.1 PR-02233 增量需求结论

- 当前输入只有一个明确改动：登录页 Google、HiChat、Apple、Telegram 按钮 hover 时显示手型光标；来源为用户文本和一张截图。
- 业务实现已在安全 worktree 的 `feature/PR-02233` 完成；定向 Biome、DOM contract（24/24）、`git diff --check` 和真实登录页 computed style 均通过。
- 从接收需求到完成的可见历时为 9m41s，远超 Micro 目标 `<=2 min` 和新的 3 分钟硬预算；宿主没有提供本次真实 token usage，因此只能记录 `null`，不估算。
- 本次不能计为 V0/V1/V2 合格样本：现有 `PR-02233/work-item.json` 绑定的是历史大型 PRD，系统把当前增量错误继承为 V2/high-risk、41 个历史 implementation surfaces，正式 verify 也仍指向旧范围。
- `docs-tdd run --dry-run` 实际启动了 Agent，并因宿主认证问题落为 `failed-infrastructure`。dry-run 不应产生 Agent 调用、receipt 或 repair 计数。
- 终态只能标记为 `blocked-system`：业务定向验证通过，但 source-unit coverage 与 enforced verify 没有绑定当前增量，不能宣称 Pilot 通过或正式 V2 通过。

### 4.2 本样本触发的系统修复

1. 新增 `--change <id>` 增量 change-set：当前增量写入独立目录，通过 `active-change.json` 选择活动范围，历史 `work-item.json` 保持不变。
2. `run --dry-run` 在初始化、Agent 调用和持久化之前直接返回；不得创建项目/change 目录、调用 Agent、写 receipt 或消耗 repair budget。
3. 修正路由：普通 login 按钮样式不再因 `login` 一词进入 high-risk；token/session/callback/auth-flow 等认证行为仍保持 high-risk。
4. V0/Micro 允许一张本地辅助截图，但必须明确处置为 `context-only` 或 `example-only`；未分类图片仍升级为 Standard。
5. Micro 硬预算从 10 分钟收紧为 3 分钟（`180000ms`）；目标仍为 `<=2 min`，超预算必须停止扩张并暴露系统阻塞。

定向回归已通过：

- `vnext-change-set --self-test`
- `project-orchestrator --self-test`
- `vnext-efficiency-policy --self-test`
- `vnext-work-item --self-test`
- `vnext-intake-runtime --self-test`
- `docs-tdd --self-test`
- `vnext-kickoff-public-e2e --self-test`
- `roots --self-test`

公开命令 E2E 已覆盖 dry-run 零文件变化、dry-run 不调用 Agent、新 change 不覆盖历史 work-item，以及增量 source 输出到实际 change 目录。

这些修复只消除了后续样本的系统根因，不追认 PR-02233 为合格 Pilot。下一条新的真实 Micro 需求必须重新验证端到端历时、当前增量 coverage 和 enforced verify。

## 5. 发布门槛

- silent omission、false completion、越界写入、未经授权 push 均为 0。
- V0/V1/V2 均完成真实需求、代码验证和提测观察。
- 至少 10 个可比 Micro 样本的 p50 总历时相对基线下降至少 30%，p90 不恶化超过 10%。
- token 仅在宿主提供真实 usage 且样本可比时作结论。

满足上述门槛后只标记 `eligible-for-owner-cutover-review`；owner 批准前不进入批次 E。
