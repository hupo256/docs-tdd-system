# docs_tdd vNext 实施计划

> 状态：**shadow-only**。v1 继续服务存量项目；vNext 尚未接入 Router、kickoff 或正式 Gate。

## 不变量

1. vNext 是 `workflowVersion: 2`，不是 v1 上的“快速模式”。
   - 客户端责任边界：本仓只交付 Web 端，App 侧由兄弟团队交付。work-item 中 App surface 统一 `deferred`（owner + batch），纯 App 需求记录在 App 交接批次，不阻塞 Web 出口（规则本体见 `common/rules/change-scope-boundary.md` §1.2）。
2. 覆盖能力完成并通过历史回放前，不删除或放宽旧 Gate。
3. 只持久化直接服务于“原始 PRD → 代码落点 → 当前 HEAD 验收证据”的字段。
4. 历史上没有记录的 token、首次落码和流程耗时保持 `null`，禁止估算成假基线。
5. v1 冻结扩张：除严重缺陷外，不再新增 Rule ID、Gate、模板层或流程分支。

## 分步交付

| Phase | 交付物 | 退出条件 | 状态 |
|---|---|---|---|
| 0 基线 | 指标口径、四项目机器基线、人工事故观察 | 基线可重复生成；不可恢复值明确为 `null` | **完成** |
| 1 原始 PRD 闭环 | work-item schema、source/requirement fingerprint、独立审查输入输出、collection/surface 判定、历史 replay | PR-02306/01930 稳定失败；PRD 漂移稳定失败；修复后恢复 PASS；同输入结果稳定 | **完成** |
| 2 风险路由 | scope × risk 纯路由器、只升不降、V2 人工范围确认 | 四项目分类符合冻结结论；低风险样例不误升；未知风险不可降档 | **完成** |
| 3 统一出口 | 单一 vNext verify 聚合结果，先 shadow、后续再接正式命令 | V0/V1 一个出口；V2 仅范围确认 + 最终出口；blocked/旧 HEAD/伪造 PASS 不可绿 | **完成（shadow）** |
| 4 产物收敛 | v2 scaffold、latest-result、runs.jsonl；处置与 V2 确认留在 work-item | 默认持久化文件数降低至少 80% | **完成（shadow）** |
| 5 上下文压缩 | v2 最小 context + session delta | V0/V1 ≤4K 字符；V2 ≤8K 字符；可测 context 字符降低至少 60% | **完成（shadow）** |
| 6 MSW 条件化 | no-request / real-api / mock-required / pending-dependency | 无请求或真实 API 可用时不建 MSW，且无需 waiver | **完成（shadow）** |
| 7 灰度与退役决策 | V0/V1/V2 全覆盖，累计 5–10 个新需求 | 零漏项、零假绿且机器指标达标后，仅进入人工切换评审 | **进行中：3 个样本已登记（PR-02074 V0、PR-02172 V1、PR-02233 V2）；V0/V1 已 PASS，等待 observation；PR-02233 已重划范围并压到 8K 预算内，测试层/MSW/biome 已通过，仅剩浏览器运行时证据；PR-02117/02133/02193 因 API pending-dependency 已从灰度移除；PR-01930 worktree/branch 已退役** |

## 当前已落地

- `baseline-observations.json`：用户复盘中可确认的事故事实；与机器指标分离。
- `baseline.json`：由 `vnext-baseline.mjs --write` 从四个历史项目重复生成。
- `vnext-work-item.schema.json`：v2 单一业务事实载体的第一版 schema。
- `lib/vnext-source-units.mjs`：将 Markdown 原始来源确定性正规化为 text/table/image units；source ID 不依赖行号；同步时间、Lark 临时媒体 URL 和生成式图片 alt 变化不会制造伪漂移。
- `lib/vnext-coverage-review.mjs` + `vnext-coverage-review.schema.json`：独立冷读审查的最小 I/O 契约；每条 finding 必须处置，过期 fingerprint 不可复用。
- `lib/vnext-work-item.mjs`：`SOURCE_FRESH`、`REQUIREMENT_COVERAGE`、`SURFACE_COVERAGE` 的纯判定核心。
- `fixtures/vnext-replay/`：PR-02306 图片需求漏抽取、PR-01930 集合落点漏实现、PR-02265 PRD 漂移三个确定性事故夹具及三个修复后 positive controls。
- `vnext-replay.mjs`：无模型、无业务仓依赖的稳定回放入口。
- `vnext-verify.mjs`：显式输入、只读、shadow-only 的 source normalize / review request / verify CLI；不更新 v1 Gate。
- `lib/vnext-risk-route.mjs`：scope × risk 纯路由、V0/V1/V2 最小验证矩阵与 V2 人工 scope approval fingerprint。
- `fixtures/vnext-routing-cases.json` + `vnext-route-replay.mjs`：四个历史项目和一个低风险反例的确定性路由回放。
- `lib/vnext-exit.mjs` + `vnext-exit-result.schema.json`：将覆盖、路由、当前 Git 状态、证据和 blockers 聚合为唯一出口结果；`ok/status/summary` 只能派生。
- `fixtures/vnext-exit-cases.json` + `vnext-exit-replay.mjs`：旧 HEAD、开放依赖、命令假 PASS、缺定向证据和篡改结果五类禁假绿回放。
- `lib/vnext-persistence.mjs`：三文件持久化、原子替换、追加式历史、runId 幂等、锁超时/陈旧锁恢复和中断续写。
- `vnext-artifact-budget.mjs` + `artifact-budget.json`：以同一四项目组合对比 253 → 12 个默认流程文件，减少 95.26%。
- `vnext-context.mjs` + `lib/vnext-context.mjs`：按 work-item 生成紧凑上下文；fingerprint 未变时只返回 delta/unchanged，不重载 v1 规则包。
- `vnext-context-budget.mjs` + `context-budget.json`：V0/V1 4K、V2 8K 硬预算；四案例同口径字符代理减少 99.21%，历史 token 继续明确记为 null。
- `lib/vnext-msw-policy.mjs`：按 API 依赖选择 no-request / real-api / mock-required / pending-dependency；无通用 MSW 仪式，也无 waiver 旁路。
- `vnext-pilot.mjs` + `pilot-registry.json` / `pilot-report.json`：显式双轨灰度登记与准入判定；静态检查 v1 入口隔离，真实样本不足时只报 collecting，永不自动切流。

## 当前基线摘要

基线以 [baseline.json](./baseline.json) 为准。当前四项目合计：

- 253 个流程文件（`inbox/**` 之外的项目持久化文件）；
- 24 次有历史记录的 Gate；
- 1,588 次重复/累计检查执行；
- 3 次用户复盘确认的“提测后补 PRD 漏项”；
- 历史 token、首次落码、流程墙钟与 Mock 浪费没有完整机器记录，均保留为 `null`。

`PR-01947` 的 `gate-history.json` 缺失，所以其 Gate 次数为 0 只表示“没有可用历史记录”，不表示没有执行过 Gate。

## 验证命令

```bash
node common/engine/agent-scripts/vnext-baseline.mjs --write
node common/engine/agent-scripts/vnext-replay.mjs
node common/engine/agent-scripts/vnext-route-replay.mjs
node common/engine/agent-scripts/vnext-exit-replay.mjs
node common/engine/agent-scripts/vnext-artifact-budget.mjs
node common/engine/agent-scripts/vnext-context-budget.mjs
node common/engine/agent-scripts/vnext-pilot.mjs --self-test
# 登记真实新需求后；collecting 返回 1、rollback 返回 2、具备人工评审资格返回 0
node common/engine/agent-scripts/vnext-pilot.mjs --write
node common/engine/agent-scripts/vnext-verify.mjs --self-test
node common/engine/agent-scripts/lib/vnext-exit.mjs --self-test
node common/engine/agent-scripts/lib/vnext-source-units.mjs --self-test
node common/engine/agent-scripts/lib/vnext-coverage-review.mjs --self-test
node common/engine/agent-scripts/lib/vnext-work-item.mjs --self-test
node common/engine/agent-scripts/lib/vnext-metrics.mjs --self-test
```

## 独立审查调用边界

```bash
# 1. 原始来源 → 稳定 source snapshot + source units
node common/engine/agent-scripts/vnext-verify.mjs --normalize-sources source-input.json

# 2. 生成交给独立 reviewer 的只读请求；命令自身不 spawn 模型
node common/engine/agent-scripts/vnext-verify.mjs --prepare-review review-input.json

# 3. 带 reviewer response、当前来源、代码搜索落点和实现事实做 shadow 验证（默认只读）
node common/engine/agent-scripts/vnext-verify.mjs --input verify-input.json --worktree /absolute/path/to/worktree

# 4. 仅显式 --write 时写 v2 三文件；out 在 worktree 内时必须已被 Git ignore
node common/engine/agent-scripts/vnext-verify.mjs --input verify-input.json --worktree /absolute/path/to/worktree --write --out /path/to/v2/PR-01234
```

`reviewResponse` 必须携带当前 source/requirements fingerprints、reviewer identity、完成时间、verdict 和逐条 finding disposition。`pass` 不允许存在 `open` finding；来源或需求变化后旧 response 自动失效。

## 风险路由约束

- scope floor：`local=V0`、`multi-surface=V1`、`cross-boundary=V2`。
- password / authentication-surface / multiple-entry-points / shared-component / contract-change 至少 V1。
- funds / trading / permission / irreversible / new-api / cross-app / fee/amount semantics 强制 V2。
- 未识别风险信号保守派生为 V2，同时 `RISK_ROUTE` 失败，必须先显式分类，不能静默放行。
- V2 的 scope approval 必须是 human confirmation，且 fingerprint 绑定 source、requirements 和 routing；任一变化都会失效。

## 单一出口约束

- CLI 必须通过 `--worktree` 实测 Git `headSha + dirtyHash`，不接受输入 JSON 自报当前 HEAD。
- 每条 evidence 都绑定同一个代码 fingerprint；任何代码或未跟踪文件变化都会让旧证据失效。
- command evidence 的 PASS 从 `exitCode=0` 派生；`result=pass + exitCode!=0` 直接失败。
- 每个 doing requirement 的 evidence plan、每个 implement surface、以及 level 最小证据矩阵都必须被当前代码证据覆盖。
- open blocker 输出 `status=blocked`；缺证据/旧证据输出 `status=failed`，均不允许 `ok=true`。
- 最终结果带 `resultFingerprint`；手工把 failed 改成 PASS 会被完整性检查识别。

## 产物收敛约束

默认项目目录只有：

```text
<project>/
  work-item.json
  latest-result.json
  runs.jsonl
```

- `--init` 只创建 `work-item.json`；第一次 `--write` 后稳定为三文件。
- 写入前同时校验 result 自身 fingerprint 和 `workItemFingerprint`，failed/blocked 也照实追加。
- `latest-result.json` 原子替换后再追加 `runs.jsonl`；若两步之间中断，下次写入先把 latest 补入历史。
- 同一 `runId + resultFingerprint` 重试幂等；同一 runId 不同内容拒绝。
- 并发写由有界文件锁串行化，超时会明确失败，不无限等待；陈旧锁可恢复。
- coverage review 的逐条 finding/disposition 和 V2 scope approval 都保存在 `work-item.json`，不为默认项目再建决策文档。

## Context 与 MSW 约束

```bash
# 完整 context；只读，不落项目文件
node common/engine/agent-scripts/vnext-context.mjs --project /path/to/v2/PR-01234

# 调用方把上次 JSON 输出中的 session 临时保存后，可只取变化
node common/engine/agent-scripts/vnext-context.mjs --project /path/to/v2/PR-01234 --session /tmp/session.json --json
```

- full context 必须包含每条 requirement、surface、evidence plan、coverage finding disposition、API/MSW 策略和最后出口状态；超预算直接失败，绝不静默截断需求。
- 同 work-item fingerprint 下返回 delta/unchanged；session 由调用方临时持有，不增加项目默认文件。
- 历史 token 没有机器记录，所以不伪造 token 降幅；`context-budget.json` 只报告可复算的 Unicode 字符代理。
- `apiDependency.mode` 是 work-item 必填事实：无请求或真实 API 时禁止新增 vNext 范围 MSW；只有 `mock-required` 才要求 worker、handler 与 contract 覆盖；`pending-dependency` 必须绑定 open blocker，最终出口保持 blocked。
- V2 scope approval fingerprint 包含 `apiDependency`，API/MSW 策略变更后旧的人签自动失效。

## Phase 7 双轨灰度

1. 已有项目继续 v1；只有显式加入 `pilot-registry.json` 且 `newRequirement: true` 的新需求使用 v2。V0 可以是挂在现有项目下的一条独立微小变更，不要求为了灰度另建项目编号；registry 用可选 `sampleId` 区分同一项目内的多个微变更、沿用所属 `projectId`，但必须有可冻结的原始需求、独立 artifact 目录和可验证代码状态。
2. 每个样本从三文件机器读取 level、出口完整性、context 字符数和文件数；提测后的漏项/假绿由负责人填写带姓名和观察截止时间的 observation。
3. 样本少于 5 个、未覆盖 V0/V1/V2、任一样本未 PASS，均保持 `collecting`；任一漏项/假绿或 v1 入口耦合立即给出 `rollback`。
4. 满足条件也只输出 `eligible-for-human-cutover-review`，`automaticCutover` 永远为 false；是否切换主流程必须另行人工决策。
5. 当前 `pilot-report.json` 仅保留 3 个编码样本：PR-02074（V0）与 PR-02172（V1）已 PASS、等待 observation；PR-02233（V2）已按 Web 端范围重新审查，15 个 App surface 全部 `deferred` 到批次 06（owner=App 团队），测试层/MSW/biome 证据已通过，仅剩浏览器运行时证据未闭环。PR-02117/PR-02133/PR-02193 因 API `pending-dependency` 已从 `pilot-registry` 中移除，不再作为切流依据。PR-02118 作为“仅运营 SOP、无明确软件交付”的负向候选保留，不计入编码样本。
