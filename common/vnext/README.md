# docs_tdd v2 正式工作流

> 状态：**正式启用（enforced）**，自 2026-09-08 起作为新需求默认系统。v1 只服务存量 `workflowVersion: 1` 项目和显式 `--legacy` 项目；切换决策见 [cutover-decision-20260908.md](./cutover-decision-20260908.md)。

## 不变量

1. vNext 是 `workflowVersion: 2`，不是 v1 上的“快速模式”。
   - 客户端责任边界：本仓只交付 Web 端，App 侧由兄弟团队交付。work-item 中 App surface 统一 `deferred`（owner + batch），纯 App 需求记录在 App 交接批次，不阻塞 Web 出口（规则本体见 `common/rules/change-scope-boundary.md` §1.2）。
2. 覆盖能力完成并通过历史回放前，不删除或放宽旧 Gate。
3. 只持久化直接服务于“原始 PRD → 代码落点 → 当前 effective code state 验收证据”的字段。
4. 历史上没有记录的 token、首次落码和流程耗时保持 `null`，禁止估算成假基线。
5. v1 冻结扩张：除严重缺陷外，不再新增 Rule ID、Gate、模板层或流程分支。

## 分步交付

| Phase | 交付物 | 退出条件 | 状态 |
|---|---|---|---|
| 0 基线 | 指标口径、四项目机器基线、人工事故观察 | 基线可重复生成；不可恢复值明确为 `null` | **完成** |
| 1 原始 PRD 闭环 | work-item schema、source/requirement fingerprint、独立审查输入输出、collection/surface 判定、历史 replay | PR-02306/01930 稳定失败；PRD 漂移稳定失败；修复后恢复 PASS；同输入结果稳定 | **完成** |
| 2 风险路由 | scope × risk 纯路由器、只升不降、V2 人工范围确认 | 四项目分类符合冻结结论；低风险样例不误升；未知风险不可降档 | **完成** |
| 3 统一出口 | 单一 v2 verify 聚合结果并接入正式命令 | V0/V1/V2 共用一个出口；blocked/旧代码内容/伪造 PASS 不可绿 | **完成（enforced）** |
| 4 产物收敛 | v2 scaffold、latest-result、runs.jsonl；处置与 V2 确认留在 work-item | 默认持久化文件数降低至少 80% | **完成** |
| 5 上下文压缩 | v2 最小 context + session delta | V0/V1 ≤4K 字符；V2 ≤8K 字符；可测 context 字符降低至少 60% | **完成** |
| 6 MSW 条件化 | no-request / real-api / mock-required / pending-dependency | 无请求或真实 API 可用时不建 MSW，且无需 waiver | **完成** |
| 7 灰度与退役决策 | 历史 V0/V1/V2 样本与回放 | 灰度结果只作回归观测，不自动切流 | **完成；正式切换由 owner 于 2026-09-08 显式批准** |
| 8 正式切换 | Router、kickoff、CLI 版本路由、enforced 出口、v1 冻结 | 新项目默认 v2；v2 禁跑 v1 Gate；正式 verify 非 PASS 即非零 | **完成** |

## 当前已落地

- `docs-tdd run <PROJECT-ID> --prd <source>` + `lib/vnext-autopilot.mjs`：PRD-only 新建/恢复入口与纯状态机；`status/next/resume/run` 返回同一个 client-neutral action packet。v2 不再把 `agent/run-state.json` 当作第二状态源。
- `baseline-observations.json`：用户复盘中可确认的事故事实；与机器指标分离。
- `baseline.json`：由 `vnext-baseline.mjs --write` 从四个历史项目重复生成。
- `vnext-work-item.schema.json`：v2 单一业务事实载体的第一版 schema。
- `lib/vnext-source-units.mjs`：将 Markdown 原始来源确定性正规化为 text/table/image units；source ID 不依赖行号；图片描述原文进入 reviewer 输入，本地图片字节以 SHA-256 绑定，未下载/不可读图片阻断审查；同步时间和 Lark 临时媒体 URL 不制造伪漂移。
- `vnext-review.mjs` + `lib/vnext-review-receipt.mjs`：由 `docs-tdd review` 真正启动无工具、无代码上下文的独立 client/session，图片以附件传入；输出经本机 HMAC 签名后写回 work-item，手写 reviewer JSON 不能形成 V1/V2 有效审查。
- `lib/vnext-coverage-review.mjs` + `vnext-coverage-review.schema.json`：独立冷读审查 I/O 契约；作者 identity/session 必填且不能与 reviewer 相同，每条 finding 必须处置，过期 fingerprint 不可复用。
- `lib/vnext-work-item.mjs`：`SOURCE_FRESH`、`REQUIREMENT_COVERAGE`、`SURFACE_COVERAGE` 的纯判定核心。
- `fixtures/vnext-replay/`：PR-02306 图片需求漏抽取、PR-01930 集合落点漏实现、PR-02265 PRD 漂移三个确定性事故夹具及三个修复后 positive controls。
- `vnext-replay.mjs`：无模型、无业务仓依赖的稳定回放入口。
- `vnext-verify.mjs`：source normalize / review request / verify 内核；默认生成 `mode=enforced` 正式结果，不更新 v1 Gate。`--shadow` 只供历史回放/灰度复算。
- `lib/vnext-risk-route.mjs`：scope × risk 纯路由、V0/V1/V2 最小验证矩阵与 V2 人工 scope approval fingerprint。
- `fixtures/vnext-routing-cases.json` + `vnext-route-replay.mjs`：四个历史项目和一个低风险反例的确定性路由回放。
- `vnext-evidence.mjs` + `lib/vnext-evidence-receipt.mjs`：执行 work-item 已审查冻结的 argv command plan；签名绑定 work-item、plan、代码与输出 hash，代码被命令改写即拒签。
- `lib/vnext-exit.mjs` + `vnext-exit-result.schema.json`：将覆盖、路由、当前 Git 状态、证据和 blockers 聚合为唯一出口结果；证据绑定 effective content hash（提交但文件字节不变时不作废）；`ok/status/summary` 只能派生。验签成功输出 `autonomous / cli-attested`，外部或人工证据保持 `assisted-pilot / caller-supplied`。
- `fixtures/vnext-exit-cases.json` + `vnext-exit-replay.mjs`：旧 HEAD、开放依赖、命令假 PASS、缺定向证据和篡改结果五类禁假绿回放。
- `lib/vnext-persistence.mjs`：三文件持久化、原子替换、追加式历史、runId 幂等、锁超时/陈旧锁恢复和中断续写。
- `vnext-artifact-budget.mjs` + `artifact-budget.json`：以同一四项目组合对比 253 → 12 个默认流程文件，减少 95.26%。
- `vnext-context.mjs` + `lib/vnext-context.mjs`：按 work-item 生成紧凑上下文；fingerprint 未变时只返回 delta/unchanged，不重载 v1 规则包。
- `vnext-context-budget.mjs` + `context-budget.json`：V0/V1 4K、V2 8K 硬预算；四案例同口径字符代理减少 99.21%，历史 token 继续明确记为 null。
- `lib/vnext-msw-policy.mjs`：按 API 依赖选择 no-request / real-api / mock-required / pending-dependency；无通用 MSW 仪式，也无 waiver 旁路。
- `vnext-pilot.mjs` + `pilot-registry.json` / `pilot-report.json`：保留历史双轨样本与质量观察；它不再决定当前工作流，且永不自动切流。正式状态只由 owner 决策记录和 CLI 路由定义。

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

## Autopilot 入口

```bash
# 新项目：PRD 是唯一必需输入
node common/engine/agent-scripts/docs-tdd.mjs run PR-01234 --prd <source>

# 中断恢复：重复同一命令即可；status/next/resume 返回相同的下一动作判定
node common/engine/agent-scripts/docs-tdd.mjs run PR-01234
```

Figma/API 缺失不会在 intake 阶段形成全局阻塞。CLI 输出的 action packet 是客户端无关协议；Claude、Codex、Pi、Cursor 都按 `action`、`reason`、`constraints` 执行，不从 Markdown 阶段文字猜状态。

## 独立审查调用边界

```bash
# 1. 原始来源 → 稳定 source snapshot + source units
node common/engine/agent-scripts/vnext-verify.mjs --normalize-sources source-input.json

# 2. 在 requirementsAuthor 已记录后启动真正独立的 source-only reviewer；V1/V2 必须走此入口
node common/engine/agent-scripts/docs-tdd.mjs review PR-01234 --client pi

# 3. 运行受信 command evidence；命令计划默认取自已审查的 work-item.json evidenceCommands，输出放在被测 worktree 外
node common/engine/agent-scripts/docs-tdd.mjs evidence PR-01234 --worktree /absolute/path/to/worktree --out /tmp/evidence.json
# --plan <evidence-plan.json> 仅作兼容/显式输入保留；若提供，必须与 work-item.evidenceCommands 完全一致，否则 fail-closed

# 4. 组装并跑正式出口：--evidence 自动注入签名 bundle，--surfaces 只提供 agent 实现后无法推导的落点报告
#    （discoveredSurfaces = 代码搜索实到的落点；coveredSurfaceIds = 实际实现覆盖的）。workItem/sourceDocuments 由 CLI 从 work-item.json 自动组装。
node common/engine/agent-scripts/docs-tdd.mjs verify PR-01234 --evidence /tmp/evidence.json --surfaces /tmp/surfaces.json --worktree /absolute/path/to/worktree

# 兼容：仍可手工拼 verify-input.json 走 --input（V0 legacy fixture 或需要显式 reviewResponse 时）
node common/engine/agent-scripts/vnext-verify.mjs --input verify-input.json --worktree /absolute/path/to/worktree
```

`docs-tdd review` 只向子进程提供规范化 source units、候选 requirements 和图片附件，不提供代码仓或工具。含图片的审查当前必须使用 `--client pi`（Claude CLI 路径暂只支持纯文本 packet）。运行前，需求抽取者必须在 work-item 写入 `requirementsAuthor`；模型作者记录 `{ kind, id, client, sessionId }`（Pi 可取 `PI_SESSION_ID`），人工作者记录 `{ kind: "human", id }`。CLI receipt 绑定请求 fingerprint、reviewer client/session、时间和全部图片 hash；相同模型也必须使用不同 session，`pass` 不允许存在 `open` finding。来源、图片字节或需求变化后旧 response 自动失效。`--prepare-review` 仅保留为调试/协议查看入口，不能替代签名审查。

## 风险路由约束

- scope floor：`local=V0`、`multi-surface=V1`、`cross-boundary=V2`。
- V0 按 micro-change 硬约束：恰好一个 doing requirement、一个 implement surface、无风险信号、无 API 请求、无集合语义、无 runtime evidence、无图片/表格/embed；任一条件不满足必须升级。Markdown 标题、分隔线和纯注释由 intake 确定性识别为结构节点，不要求逐条填写 `sourceUnitDispositions`；其他未引用语义 unit 仍然阻断，绝不默认放行。
- password / authentication-surface / multiple-entry-points / shared-component / contract-change 至少 V1。
- funds / trading / permission / irreversible / new-api / cross-app / fee/amount semantics 强制 V2。
- `shared-component` 的边界：仅当改动触及被 ≥2 处复用的组件的 **prop / 行为 / 契约**（存在跨消费方爆炸半径）时才打此信号；**只改组件自身的视觉 token**（间距 / 颜色 / 圆角等 className，且无 prop、无行为、无契约变更）爆炸半径封闭在自身 render 内，不打任何风险信号 → 落 `local=V0`。是否属于后者由作者显式判断、并经独立冷读审查复核，不允许「因为文件是共享组件」就一律升 V1。
- 未识别风险信号保守派生为 V2，同时 `RISK_ROUTE` 失败，必须先显式分类，不能静默放行。
- V2 的 scope approval 必须是 human confirmation，且 fingerprint 绑定 source、requirements 和 routing；任一变化都会失效。

## 单一出口约束

- CLI 必须通过 `--worktree` 实测 Git effective content hash，同时保留 `headSha + dirtyHash` 作诊断；不接受输入 JSON 自报当前代码状态。
- `docs-tdd verify` 默认走组装模式：`--evidence <evidence.json>` 自动注入签名 bundle（杆绝手工粘贴导致验签失败），workItem / sourceDocuments / currentRevision 由 CLI 从 canonical `work-item.json` 自动组装。只有两个字段必须由实现后的 agent 提供（`--surfaces` 报告的 `discoveredSurfaces` 与 `coveredSurfaceIds`），因为把计划落点当作“已发现/已实现”会静默关掉 surface 漂移与漏实现校验。手工拼 `verify-input.json` 走 `--input` 仅作兼容或 V0 legacy fixture。组装模式要求 work-item 已携带签名 review receipt（`docs-tdd review` 产出）；无 receipt 的 V0 legacy fixture 必须用 `--input` 显式传 reviewResponse。
- 每条 evidence 都绑定同一个 effective content hash；代码或未跟踪文件字节变化会进入 `revalidate_current_code_evidence`，但只要 work-item/source fingerprint 未变，已签名 coverage review 继续复用，不重走需求审查；单纯把相同字节提交成新 HEAD 不会误杀绿灯。
- `docs-tdd evidence` 只接受 `argv: string[]`（`shell=false`），在 CLI 实测的 worktree 中运行命令，并绑定 work-item fingerprint、effective content hash、plan hash、输出 hash与时间；任一命令改写有效代码内容时拒绝签发 receipt。纯 command bundle 验签成功才输出 `assuranceMode=autonomous` 与 `evidenceTrust=cli-attested`。
- 命令计划默认直接来自已审查的 `work-item.json.evidenceCommands`，不需要额外的 evidence plan 文件；标准命令是 `docs-tdd evidence <PROJECT-ID> --out <evidence.json>`。`--plan <evidence-plan.json>` 仅作兼容/显式输入保留，形如 `{ "schemaVersion": 1, "projectId": "PR-01234", "commands": [{ "evidenceId": "E-1", "kind": "directed-tests", "argv": ["pnpm", "test", "path/to/test"], "requirementIds": ["R-001"], "surfaceIds": ["S-001"] }] }`；若提供，其 `commands` 必须与 work-item 的 `evidenceCommands` 完全一致，不能绕过独立 review，否则 fail-closed。该字段属于 requirements fingerprint，新增或改命令后必须重跑独立 review。reviewer 会拒绝 `true`、`echo`、version probe、shell eval、kind/argv 不相称或覆盖不全的计划，runner 也机器阻断明显 no-op/shell 命令。required level、requirement evidence plan 和 implement surfaces 还会由 runner 与最终 verify 双重交叉校验。
- 外部手填或含 human producer 的 evidence 仍只能是 `assisted-pilot / caller-supplied`；不得追加或修改已签 bundle（签名会失效）。command evidence 的 PASS 始终从 `exitCode=0` 派生，`result=pass + exitCode!=0` 直接失败。assisted 结果即使 checks 全绿也只作诊断结果；项目状态与 context 只有在 `mode=enforced + status=passed + ok=true + autonomous/cli-attested` 时才标记 authoritative/complete。
- 每个 doing requirement 的 evidence plan、每个 implement surface、以及 level 最小证据矩阵都必须被当前代码证据覆盖。
- open blocker 输出 `status=blocked`；缺证据/旧证据输出 `status=failed`，均不允许 `ok=true`。
- 最终结果带 `resultFingerprint`；手工把 failed 改成 PASS 会被完整性检查识别。

## 产物收敛约束

默认 v2 **工作流状态产物**只有以下三项（项目 README、原始来源与必要同步配置不计入状态产物）：

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

## 历史 Phase 7 灰度（非当前切流条件）

1. 已有项目继续 v1；只有显式加入 `pilot-registry.json` 且 `newRequirement: true` 的新需求使用 v2。V0 可以是挂在现有项目下的一条独立微小变更，不要求为了灰度另建项目编号；registry 用可选 `sampleId` 区分同一项目内的多个微变更、沿用所属 `projectId`，但必须有可冻结的原始需求、独立 artifact 目录和可验证代码状态。
2. 每个样本从三文件机器读取 level、出口完整性、context 字符数和文件数；提测后的漏项/假绿由负责人填写带姓名和观察截止时间的 observation。
3. 样本少于 5 个、未覆盖 V0/V1/V2、任一样本未 PASS，均保持 `collecting`；任一漏项/假绿或 v1 入口耦合立即给出 `rollback`。
4. 满足条件也只输出 `eligible-for-human-cutover-review`，`automaticCutover` 永远为 false。owner 已于 2026-09-08 独立批准正式切换；pilot 继续作为历史质量观测，不控制 Router 或正式出口。
5. 当前 `pilot-report.json` 仅保留 PR-02074（V0）与 PR-02172（V1）两个历史编码样本，实时有效性以报告为准；PR-02117/PR-02133/PR-02193 因 API `pending-dependency` 已从 `pilot-registry` 中移除，不再作为切流依据。PR-02118 作为“仅运营 SOP、无明确软件交付”的负向候选保留，不计入编码样本。
