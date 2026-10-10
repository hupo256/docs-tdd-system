# docs_tdd AutoPilot 现状审计与闭环实施计划

> 日期：2026-09-21  
> 范围：`/Users/aven/github/docs_tdd`  
> 当前系统版本：docs_tdd v3.5，项目协议兼容标识 `workflowVersion: 2`  
> 本文性质：评审结论与后续实施计划，不代表下列改造已经完成  
> 不包含：业务代码修改、存量 v1 批量迁移、自动 push

## 1. 目标

目标用户路径：

```text
用户只提供需求
→ 系统安全创建分支和 worktree
→ 完整读取并理解来源
→ 只在无法安全裁决时询问用户
→ 完成业务代码
→ 执行定向验证并有界修复
→ 生成安全的本地 delivery commit
→ 全程不静默漏需求、不假绿、不无限重试、可中断恢复
```

这不是“生成更多流程文件”或“增加更多 Gate”的目标，而是同时满足以下四项结果：

1. **正确性**：来源、需求、surface、代码、证据和交付状态能够闭环对账。
2. **自治性**：除真正需要业务裁决的节点外，系统能够连续执行。
3. **效率**：小改动走真正的短路径，安全强度不等于全流程成本。
4. **真实性**：所有完成声明均由当前代码、CLI 证据和真实提交状态派生。

## 2. 评审结论

### 2.1 总体判断

目标可以实现，但当前系统尚未达到 production-ready 的 AutoPilot 状态。

粗略成熟度评估：

| 维度 | 当前成熟度 | 判断 |
|---|---:|---|
| 安全工作区与提交边界 | 75% | 模块较完整，但存在 Git 基线规则冲突，且未由 `run` 自动驱动 |
| 来源与需求覆盖 | 70% | 已有 source graph、coverage audit 和 replay，但缺真实项目闭环证明 |
| 证据、verify 与防假绿 | 80% | 是当前最成熟部分，已有 CLI-attested evidence 和 enforced verify |
| 连续自动执行 | 35% | 状态机完整度高，执行器只接通少数动作 |
| 效率控制与观测 | 30% | 有预算数据结构，缺主循环消费和真实运行指标 |
| 真实项目认证 | 0% | v3.5 public-command-only 的 V0/V1/V2 完成样本均为 0 |
| 综合状态 | 55%–60% | “模块基本具备”，尚不是“用户只给需求即可闭环” |

### 2.2 当前已经具备的地基

- v2 三文件状态协议：`work-item.json`、`latest-result.json`、`runs.jsonl`。
- source → requirement → surface → evidence 的追溯结构。
- 确定性 extraction audit 和独立 cold-read coverage review。
- safe work context、冻结路径提交和越界写入保护。
- CLI-attested evidence、enforced verify 和 delivery truth。
- source/review/code/browser/environment/external-dependency 六类有界修复策略。
- 相同输入与失败指纹的重复重试保护。
- PR-01947、PR-02265、PR-02306、PR-01930 的 incident replay。
- 默认项目流程文件预计从 253 个降至 12 个。
- context 字符代理已有显著下降，但不能将其表述为真实 token 降幅。

这些能力应保留并接入主路径，不应再次从零重构。

## 3. 核心差距

### 3.1 `docs-tdd run` 不是完整执行器

当前 `project-orchestrator.mjs` 的 `autopilotRun()` 只自动执行：

1. `reconcile-current-code`
2. `capture-cli-evidence`、`revalidate-current-code-evidence`、`refresh-invalid-verification`
3. `commit-ready-change`

以下关键动作只返回 action packet，然后退出：

- `extract-requirements`
- `repair-intake-extraction`
- `classify-scope-and-risk`
- `complete-independent-review`
- `repair-review-findings`
- `collect-scope-approval`
- `prepare-coding-worktree`
- `implement-current-scope`
- `repair-failed-checks`
- 人工验收相关动作

因此当前系统本质上是“状态判定器 + 部分自动命令”，还不是从需求连续执行到提交的 runner。

### 3.2 worktree 能力存在，但没有接入主循环

`prepare-coding-worktree.mjs` 已包含：

- 拉取基线；
- 创建 branch/worktree；
- 建立 `docs_tdd` symlink；
- 安装依赖；
- 启动并检查开发服务；
- 运行 safe work context 校验。

但状态机到达 `prepare-coding-worktree` 时，`run` 只输出命令，不会执行它。

此外，脚本仍将“分支必须是当前 `origin/online` 的后代”作为硬阻断。这与现行 FameEX 本地 Git 规则冲突：普通开发或本地提交不能仅因 `origin/online` ancestry 检查失败而阻断。该冲突会在编码前制造误阻断，必须先统一语义。

### 3.3 效率预算没有形成运行时闭环

当前已有：

- `deriveEfficiencyRoute()`
- `createEfficiencyBudget()`
- `consumeEfficiencyBudget()`
- `efficiencyMetrics()`
- compact run record 汇总结构

但生产主路径尚未持续记录和消费：

- action 数量与起止时间；
- command 数量；
- reviewer 轮次；
- evidence 数量；
- repair 次数；
- 用户中断与必要中断；
- elapsed time；
- terminal state；
- 每个预算维度的真实使用量。

`estimatedInputTokens` 当前保持 `null` 是诚实的，但也意味着系统暂时无法证明 token 已经下降。

### 3.4 风险强度和执行成本仍然耦合

当前 password、login、permission、funds 等语义会直接把执行路径提升到 `high-risk`。这会让“代码改动很小但语义敏感”的需求承担最大 context、review、command 和 repair 预算。

应拆成两个正交维度：

```text
assuranceLevel：决定必须证明什么
executionRoute：决定以多大成本完成工作
```

例如单个密码页文案修复可以是：

```text
assuranceLevel = V2
executionRoute = micro 或 lite
```

V2 只提升该需求所需的定向安全验证和必要确认，不应自动扩大所有流程成本。

### 3.5 真实 Pilot 尚未开始形成证据

当前 `common/vnext/pilot-report.json` 的事实是：

```text
decision = collecting
automaticCutover = false
completedSamples = 0
completedLevels = []
```

PR-02074 和 PR-02172 是历史样本，不能追认为 v3.5 public-command-only 样本。PR-02233 尚未形成完整出口。

四个历史事故 replay 证明“算法可以识别夹具”，不能证明：

- 真实 PRD 能被完整读取；
- Agent 会按 action packet 正确执行；
- 业务仓搜索能找到全部 consumer；
- 失败后 runner 会自动修复并恢复；
- 从 clean project 能运行到本地 commit；
- 小改动的真实耗时和 token 已改善。

### 3.6 Guard 和文档事实仍不一致

2026-09-21 执行 `docs-tdd guard` 的结果：

- `rule-release --check`：fresh；
- golden 基线：通过；
- `EFFECTIVE-RELEASE`：stale，错误级阻断；
- pre-commit 未被识别为无条件接入 code/delivery guard；
- `CLAUDE.md` 与 canonical 规则存在重复声明警告。

同时，交接文档中存在“v3.5 实施范围内没有剩余代码项”“完成标准 1–9 已满足”等表述，但同文档又承认全自动闭环仍缺真实 pilot 和 clean-project 认证。后续必须严格区分：

| 状态 | 含义 |
|---|---|
| `module-implemented` | 模块代码已经存在 |
| `wired-to-run` | 模块已接入用户主路径 |
| `synthetic-tested` | self-test/fixture/replay 已通过 |
| `real-project-certified` | 真实项目按公开命令完成并通过观察 |

只有最后一项能支持 production-ready 声明。

## 4. 能力差距矩阵

| 能力 | 模块状态 | 已接入 `run` | Synthetic Test | Real Pilot | 目标状态 | 优先级 |
|---|---|---:|---:|---:|---|---|
| kickoff / source 初始化 | 已实现 | 部分 | 有 | 无 | 单输入自动完成初始化与来源快照 | P1 |
| source sync / drift | 已实现 | 否 | 有 | 无 | 自动同步，变化时局部失效 | P1 |
| worktree / branch | 已实现 | 否 | 有 | 无 | 自动创建或恢复，规则一致且不误阻断 | P0 |
| requirement extraction | 已实现 CLI | 否 | 有 | 无 | Runner 驱动 Agent 抽取并自动应用 | P1 |
| extraction repair | 状态机存在 | 否 | 有 | 无 | 确定性失败自动修复或进入唯一终态 | P1 |
| risk / scope route | 已实现 | 否 | 有 | 无 | assurance 与 execution cost 分离 | P2 |
| independent review | 已实现 CLI | 否 | 有 | 无 | 自动执行，轮次受预算约束 | P1 |
| review finding repair | 有协议 | 否 | 有 | 无 | 自动修复、重审，耗尽后一次性询问 | P1 |
| scope approval | 已实现 | 否 | 有 | 无 | 仅 V2 且 fingerprint 变化时询问 | P1 |
| implementation | action 存在 | 否 | 无 E2E | 无 | Agent 自动编码、checkpoint、继续循环 | P1 |
| code reconciliation | 已实现 | 是 | 有 | 无 | 自动运行，候选 surface 由仓库事实提出 | P2 |
| evidence | 已实现 | 是 | 有 | 无 | 按 reviewed plan 自动执行 | 保持 |
| failed-check repair | 有策略 | 否 | 有 | 无 | Agent 自动修复后只重验失效域 | P1 |
| verify | 已实现 | 是 | 有 | 无 | 唯一正式出口 | 保持 |
| delivery commit | 已实现 | 是 | 有 | 无 | authoritative PASS 后冻结路径提交 | 保持 |
| efficiency telemetry | 有结构 | 否 | 仅单元测试 | 无 | 每次真实 run 自动落 compact record | P0 |
| resume / recovery | 持久化基础存在 | 部分 | 有 | 无 | 重复 `run` 恢复到唯一下一动作 | P1 |
| user interruption policy | 分散存在 | 否 | 无 | 无 | 只有机器允许的原因才可询问 | P1 |

## 5. 实施计划

后续改造收敛为四个批次。批次必须按顺序推进，不再扩散成新的大版本规则体系。

## P0：Truth & Observability

### 目标

先让系统状态可信、规则一致、运行成本可测。没有观测能力时，不继续宣称“已提效”。

### 工作项

#### P0-1 修复发布与 Guard 真值

- 刷新或修复 effective rules release，使 `docs-tdd guard` 零 error。
- 修复 pre-commit 无条件 guard 检测与实际接线。
- 清理 `CLAUDE.md` 重复 canonical 规则，只保留指向单一来源的入口。
- 将 Guard 结果纳入 release qualification，不允许“核心自测通过”替代总 Guard。

#### P0-2 统一 Git 基线语义

- 移除“必须是当前 `origin/online` 后代”的错误绝对假设。
- 明确区分：
  - 新建分支时使用哪个用户批准或项目配置的 base；
  - 已有合法 feature/fix 分支的共同历史检查；
  - 环境分支禁止直接编码；
  - 普通本地提交与最终 delivery commit 的不同约束。
- worktree、status、readiness、delivery guard 和 changed detection 使用同一个 base resolution 结果。
- base 无法解析、分支属于环境分支或没有共同历史时才 fail closed。

#### P0-3 接入真实 run trace

每个 `run` 创建稳定 `runId`，至少记录：

```text
runId
projectId
route
assuranceLevel
startedAt
endedAt
actionCount
commandCount
reviewRounds
evidenceCount
repairAttempts
elapsedMs
userInterruptCount
necessaryInterruptCount
terminalState
budgetStatus
failureDomain
inputFingerprint
failureFingerprint
```

每个 action 记录：

```text
actionId
action
executorType
startedAt
endedAt
outcome
commandsConsumed
reviewRoundsConsumed
repairsConsumed
nextAction
```

- `consumeEfficiencyBudget()` 必须在真实执行点调用，而不是只生成初始预算。
- run 中断后继续使用同一 active run record，不重复计数。
- 无法获得模型真实 token usage 时继续记录 `null`，字符代理单独命名为 `contextChars`。

#### P0-4 修正文档状态

- 删除或修正“没有剩余代码项”“已完成全自动闭环”等 overclaim。
- README、CHANGELOG、handoff、readiness 和 pilot report 使用同一状态词汇。
- 明确 synthetic replay 和 real-project certification 的边界。

### P0 验收

- `docs-tdd guard`：0 error。
- Git 基线合法项目不因当前 `origin/online` 已前进而失败。
- 环境分支和无共同历史分支仍被阻断。
- 一次真实或隔离 E2E run 可生成完整 action trace。
- 预算 usage 随命令、review、repair 真实增长。
- 重复恢复不会创建重复 action 或重复 run 计数。

## P1：Continuous Runner

### 目标

将状态机已有动作真正接入一个连续、可恢复的执行循环。

### P1-1 建立 Action Executor Registry

建议采用统一接口：

```ts
type ExecutorType = 'deterministic' | 'agent' | 'human' | 'external'

interface ActionExecutorResult {
  outcome: 'completed' | 'needs-user' | 'blocked' | 'failed'
  changedState: boolean
  failureDomain?: string
  failureFingerprint?: string
  nextInputFingerprint: string
}
```

动作分类：

| Executor | 动作示例 | 行为 |
|---|---|---|
| deterministic | worktree、source sync、evidence、verify、commit | Runner 直接调用 CLI/库 |
| agent | extraction、review repair、implementation、code repair | 启动隔离 Agent，应用结构化结果 |
| human | V2 scope approval、业务歧义裁决、人工验收 | 生成一次性决策包并退出 |
| external | API/Figma 未到、权限或基础设施不可用 | 持久化 blocker，等待外部变化 |

Registry 是唯一动作执行入口，禁止继续在 `autopilotRun()` 中堆叠零散 `if`。

### P1-2 将现有动作接入 Runner

第一批必须接入：

1. `prepare-coding-worktree`
2. `extract-requirements`
3. `repair-intake-extraction`
4. `classify-scope-and-risk`
5. `complete-independent-review`
6. `repair-review-findings`
7. `implement-current-scope`
8. `repair-failed-checks`

已有自动动作迁入 Registry：

1. `reconcile-current-code`
2. `capture-cli-evidence`
3. `revalidate-current-code-evidence`
4. `refresh-invalid-verification`
5. `commit-ready-change`

### P1-3 建立连续循环

伪流程：

```text
load canonical state
→ derive next action
→ validate budget and retry fingerprint
→ execute registered action
→ persist result atomically
→ derive next action again
→ continue
```

Runner 只允许在以下状态退出：

- `complete`
- `needs-user`
- `blocked-external-dependency`
- `failed-infrastructure`
- `budget-exhausted`
- `failed-safety-check`

“输出一个 Agent 可以自行处理的 action packet”不能再作为 `run` 的正常终点。

### P1-4 Agent 动作协议

- Agent 获取 compact context，而不是整个 `common/`。
- Agent 输出写入临时结构化文件，由 CLI 校验并应用。
- Agent 不直接改 `work-item.json` 或 `latest-result.json`。
- 实现动作必须返回真实 `changedPaths`、`coveredSurfaceIds` 和发现的新 surface。
- checkpoint 成功后 Runner 自动继续，不要求用户手工拼 JSON 或再次执行命令。
- Agent 无输出、格式错误和超时归入明确 failure domain，不进行无变化重试。

### P1-5 自动修复

- code、browser、review、source 分别使用自己的 repair budget。
- 修复后只重跑受影响的检查和失效域。
- 相同 `inputFingerprint + failureFingerprint` 禁止再次执行。
- 预算耗尽生成一个包含已尝试内容、剩余问题和唯一恢复动作的决策包。

### P1-6 中断恢复

- 每个 action 开始前持久化 active checkpoint。
- 原子写入 action 结果后才进入下一动作。
- 进程中断时，重复 `docs-tdd run <ID>`：
  - 已成功且有有效 receipt 的动作不得重跑；
  - 未完成 deterministic 动作按幂等协议恢复；
  - 未确认是否写入代码的 Agent 动作先检查代码指纹和 changed paths；
  - 状态不明时进入 `reconcile-current-code`，不能直接重做。

### P1 验收

- clean micro project 从 `--prd` 单一输入运行到本地 delivery commit。
- 不需要用户手工执行中间命令或搬运 JSON。
- 人为中断后重复 `run` 可恢复，并且不重复 review/evidence/commit。
- 普通 lint/type/test 失败能自动修复并重新验证。
- 相同失败指纹无变化重试次数为 0。
- Runner 不执行 `git push`。

## P2：Efficiency & Coverage

### 目标

在连续运行成立后，缩短小需求路径，同时提高 surface 覆盖的机器确定性。

### P2-1 解耦 assurance 与 execution route

输出两个独立决策：

```text
assuranceLevel: V0 | V1 | V2
executionRoute: micro | lite | standard | extended
```

`assuranceLevel` 决定：

- 是否需要独立审查；
- 是否需要人工 scope approval；
- 必须具备哪些证据种类；
- 是否需要 runtime/human evidence。

`executionRoute` 决定：

- context 上限；
- 规则文件数；
- 命令数；
- review 轮次预算；
- repair 预算；
- elapsed time。

敏感关键词只能提升对应 assurance 检查，不得单独将 execution route 提升到最高档。

### P2-2 建立真正的 micro path

建议 micro 条件：

- 一个明确 requirement；
- 一到两个紧邻 surface；
- 代码候选路径可由仓库事实定位；
- 不新增 API/schema/权限模型；
- 不跨 app/仓库；
- 无来源冲突和开放依赖；
- 不需要完整浏览器业务链。

micro 最短路径：

```text
route
→ minimal source fact
→ repository target discovery
→ scoped implementation
→ one deterministic quality check
→ one targeted regression check
→ verify
→ commit
```

micro 不默认执行：

- 独立 reviewer；
- 完整 source graph 重编译；
- 全量 browser suite；
- 全规则上下文；
- 多轮 repair。

发现第二个独立业务 surface、集合语义、API 变化或来源冲突时自动升级，不先询问用户。

### P2-3 仓库事实驱动 surface 候选

在 requirement 声明基础上，系统自动提出候选：

- route/page entry；
- import consumer；
- shared provider；
- event handler；
- enum/status 分支；
- i18n literal usage；
- API/schema/mapper；
- 同类页面或集合成员。

Agent 负责确认、排除和补充候选，而不是从空白开始自报全部 surface。

对于“全部、每个、所有、各”等集合语义：

- 必须生成 expected set 或 expected count；
- 实现和 reconciliation 必须按集合对账；
- 少一个 consumer 即失败；
- 不能因 shared provider 已修改而推导所有 consumer 已完成。

### P2-4 历史真实来源 E2E replay

四个历史项目用于不同拦截点：

| 项目 | 必须证明的能力 |
|---|---|
| PR-02306 | 图片中的 reset-password/change-login-password 入口不会漏抽 |
| PR-01930 | 多 consumer 集合少一个时不能完成 |
| PR-02265 | 缺功能验收或 touched-file quality 时不能交付 |
| PR-01947 | legacy/release 文档不能冒充当前 authoritative completion |

Replay 分两层：

1. 保留快速 deterministic fixture。
2. 增加真实 source snapshot + 隔离业务仓 fixture 的 public-command E2E。

第二层必须经过与真实用户相同的 `docs-tdd run` 入口。

### P2-5 只重验失效范围

- source 未变时，不重跑 extraction/review。
- evidence command plan 变化只重审 evidence plan，不使 scope review 失效。
- 单个代码域变化只重跑相关 evidence。
- 格式化 hook 改写相关文件后只重算代码指纹并执行相关验证。
- context fingerprint 未变时只提供 delta。

### P2 验收

- `micro`：用户中断 0、review 0、repair ≤1、命令 ≤4。
- `lite`：必要中断 ≤1、review ≤1。
- PR-02306、PR-01930、PR-02265 三类遗漏在真实 E2E 中均无法到达 delivery。
- 敏感但局部的需求不再自动获得最大执行预算。
- 每次 route 升级都有机器可解释原因。
- p50/p90 的 elapsed、context、command 和 review 不劣于改造前真实基线。

## P3：Pilot & Cutover

### 目标

用真实项目证明系统已经达到目标，而不是继续依赖 self-test 和 fixture。

### P3-1 Pilot 样本

最低要求：

- V0：1 个真实 public-command-only 完成样本。
- V1：1 个真实 public-command-only 完成样本。
- V2：1 个真实 public-command-only 完成样本。
- 另收集至少 10 个 micro/lite 小需求效率样本。

每个资格样本必须：

- 从真实新需求或独立新变更开始；
- 使用公开 `docs-tdd` 命令；
- 具有完整 run trace；
- 取得 authoritative PASS；
- 生成本地 delivery commit；
- 完成提测后观察；
- 由实际核对人记录 omission 和 false-green 结果。

### P3-2 发布指标

质量门槛：

```text
silentOmissionCount = 0
falseCompletionCount = 0
sameFingerprintRetryCount = 0
unboundedActiveRunCount = 0
```

效率门槛：

- micro 用户机械中断为 0；
- micro reviewer 轮次为 0；
- micro 命令数不超过 4；
- lite 必要用户中断不超过 1；
- 10 个 micro/lite 样本的 p50/p90 elapsed、context、command、review 不劣于基线；
- 不能用字符数代理冒充 token；
- 若客户端能提供真实 usage，则单独记录真实 input/output token。

系统门槛：

- `docs-tdd guard` 0 error；
- V0/V1/V2 各至少一个完成样本；
- clean project 单输入到本地 commit；
- 中断恢复用例通过；
- 环境分支、越界路径和假证据仍 fail closed；
- Pilot 报告仍只提供事实，不自动切流。

### P3-3 Cutover

达到门槛后，只输出：

```text
eligible-for-owner-cutover-review
```

是否声明为默认稳定路径由 owner 决定。系统不得自动：

- 宣称 production-ready；
- 迁移 legacy v1；
- push；
- 跳过人工批准节点；
- 将历史样本追认为当前 release 样本。

## 6. “只在必要时问”规则

### 6.1 允许打断用户的情况

只允许以下类别：

1. PRD 业务语义存在多个安全且互斥的解释。
2. 来源之间冲突，且没有已声明的优先级。
3. 当前为 V2 且需要绑定 fingerprint 的 scope approval。
4. API、Figma、权限或外部服务无法由本地事实消除。
5. 涉及资金、权限、不可逆操作，存在产品决策而非实现细节。
6. 两轮自动 review/repair 后仍需要业务裁决。
7. 发现需求要求跨出已批准仓库、app 或 delivery scope。

询问必须：

- 一次性合并同类问题；
- 提供来源、影响范围和可选解释；
- 只询问无法由代码或规则回答的事实；
- 将回答绑定当前 fingerprint 并持久化。

### 6.2 禁止打断用户的情况

以下事项由系统自行完成：

- 查找代码路径和 symbol；
- 创建或恢复 worktree；
- 选择已有 CLI 命令；
- 生成、校验和应用中间 JSON；
- 普通 lint/type/test 失败修复；
- 已有规则能够明确裁决的问题；
- source、review、evidence 的状态恢复；
- 无变化的重复运行；
- route 自动升级；
- 确认当前 changed paths；
- 决定只重跑哪些已失效检查。

## 7. 明确不做

本轮优化不应继续扩大范围：

- 不新增一套 Gate 或阶段命名。
- 不继续扩展 legacy v1。
- 不批量迁移历史项目。
- 不自动 push。
- 不将更多规则全文常驻上下文。
- 不以增加 reviewer 轮次替代 deterministic coverage。
- 不让用户手工搬运中间 JSON。
- 不因敏感关键词直接扩大所有执行成本。
- 不用 self-test/replay 替代真实 pilot。
- 不把 `contextChars` 表述为 token。
- 不为了满足证据数量制造无业务价值的测试或 browser 脚本。

## 8. 推荐实施顺序

建议以可独立提交、可回滚的小批次推进：

| 顺序 | 提交主题 | 主要产物 |
|---:|---|---|
| 1 | truth: align guard and git baseline policy | Guard 零 error、统一 base resolution |
| 2 | telemetry: persist real run/action metrics | compact run trace、预算真实消费 |
| 3 | runner: introduce action executor registry | deterministic/agent/human/external executor |
| 4 | runner: wire intake and worktree actions | kickoff/source/worktree/extraction/routing |
| 5 | runner: wire review and implementation | review/repair/implementation/checkpoint |
| 6 | runner: close repair-to-commit loop | repair/evidence/verify/commit 连续执行 |
| 7 | efficiency: split assurance from cost route | 真 micro/lite 路径 |
| 8 | coverage: derive repository surface candidates | consumer/route/import/set reconciliation |
| 9 | e2e: add clean-project and real-source replay | public-command E2E |
| 10 | pilot: collect V0/V1/V2 and small-change samples | release qualification facts |

每个提交都必须保持：

- v1 行为不变；
- `workflowVersion: 2` 不变；
- 不修改业务仓；
- 不 push；
- 原有 replay 和 anti-fake-green 测试继续通过。

## 9. 每批验证策略

### P0

- Guard 和 release 检查。
- Git base resolution 的单元测试与临时仓库集成测试。
- run trace 的原子写入、中断和幂等测试。

### P1

- action executor 单元测试。
- 每种 executor 的成功、失败、超时和恢复测试。
- clean temporary repository E2E。
- 中途终止后重复 `run` 的恢复测试。

### P2

- route matrix replay。
- assurance/cost 正交组合测试。
- 四历史事故 deterministic replay。
- 真实 source snapshot + 隔离仓 public-command E2E。

### P3

- 真实项目执行证明。
- post-test observation。
- p50/p90 汇总。
- owner cutover review。

验证必须遵循经济性：

- 编辑稳定后集中运行；
- 小改动只运行相关 self-test；
- E2E 在批次边界运行；
- 不用全仓测试作为小改动默认命令；
- 未执行检查记录为 `not-required` 或未执行，不能写成 passed。

## 10. 完成定义

只有同时满足以下条件，才能称为达成目标：

1. 用户从一个需求输入启动，无需手工执行中间流程。
2. 系统自动创建或恢复安全 worktree。
3. 所有语义 source unit 均被 requirement、排除项或待裁决项覆盖。
4. 所有 `implement` surface 均有代码、wiring 和适用证据。
5. 只有机器允许的业务决策会打断用户。
6. 自动修复有预算，相同失败不重复运行。
7. 中断后可由项目状态恢复到唯一下一动作。
8. authoritative PASS 绑定当前 source、scope 和代码指纹。
9. delivery commit 只包含冻结路径且不 push。
10. V0/V1/V2 真实 pilot 全部完成。
11. 至少 10 个 micro/lite 样本证明效率没有倒退。
12. 提测后 observation 保持零静默漏项、零假绿。

在这些条件满足前，系统应表述为：

> v3.5 已具备较完整的安全、覆盖和验证模块，正在补齐连续执行器、真实效率观测与项目级认证。

不应表述为：

> 已完成从需求到提交的全自动闭环。

## 11. 当前基线记录

截至 2026-09-21：

```text
branch: main
HEAD: c6c2c99
main...origin/main: ahead 3
v3.5 public-command-only completed pilots: 0
pilot status: collecting
docs-tdd guard: blocked by EFFECTIVE-RELEASE stale
```

已确认通过的 synthetic 验证：

```text
vnext-self-test: 59 scripts passed
vnext-replay: 4 incident fixtures + 4 positive controls passed
vnext-route-replay: passed
vnext-exit-replay: passed
vnext-artifact-budget: passed
vnext-context-budget: passed
vnext-pilot self-test: passed
```

这些结果是后续改造的回归基线，不是 production-ready 认证。
