# docs_tdd v3.4 正式工作流

> 状态：**正式启用（enforced）**。当前框架发布版本为 **v3.4**，使用第二代 work-item 协议；项目文件中的稳定兼容标识仍为 `workflowVersion: 2`。自 2026-09-08 起，该协议作为新需求默认系统；第一代流程只服务存量 `workflowVersion: 1` 项目和显式 `--legacy` 项目。历史切换决策见 [cutover-decision-20260908.md](./cutover-decision-20260908.md)。

项目编号支持大写 `PR-xxxxx` 与 `TR-xxxxx`（五位数字）；本文命令里的 `PR-01234` 仅作示例。

## 版本边界

- **产品发布版本**：v3.4，表示当前整体能力集合。
- **项目协议标识**：`workflowVersion: 2`，只负责区分第二代 work-item 项目与第一代 G0–G8 项目。
- v3.4 没有引入不兼容的第三代项目数据模型，因此不伪造 `workflowVersion: 3`，也不迁移或重写历史项目。

## 不变量

1. 当前正式流程使用 `workflowVersion: 2`，不是第一代流程上的“快速模式”。
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
| 5 上下文压缩 | v2 最小 context + session delta | V0/V1 ≤4K 字符；V2 目标 ≤8K、硬上限 24K；可测 context 字符降低至少 60% | **完成** |
| 6 MSW 条件化 | no-request / real-api / mock-required / pending-dependency | 无请求或真实 API 可用时不建 MSW，且无需 waiver | **完成** |
| 7 灰度与退役决策 | 历史 V0/V1/V2 样本与回放 | 灰度结果只作回归观测，不自动切流 | **完成；正式切换由 owner 于 2026-09-08 显式批准** |
| 8 正式切换 | Router、kickoff、CLI 版本路由、enforced 出口、v1 冻结 | 新项目默认 v2；v2 禁跑 v1 Gate；正式 verify 非 PASS 即非零 | **完成** |

## 当前已落地

- `vnext-extract.mjs` + `lib/vnext-intake-audit.mjs`：CLI 按“事实清单 → 原子需求 → surface/集合”三阶段生成抽取脚手架，再做确定性 Coverage Compiler；每个语义 source unit 必须进入事实或显式排除，每条事实必须反向关联 requirement，重复 requirement/surface ID、漏锚表格行、集合计数和证据计划缺陷均在调用模型 Reviewer 前失败。
- scope review 与 evidence plan 使用独立 fingerprint：Reviewer 只接收事实、需求、surface 和范围信息；修改 evidence command/argv 只重跑确定性 evidence-plan audit，不再使已经通过的 scope review 失效。
- `vnext-review.mjs` 的有界审查控制：同一候选禁止无变化重试；同一 source lifecycle 总计最多两轮，人工介入不重置预算。相同 finding 再现或次数耗尽进入 `human-review-deferred`，允许先实现但在 evidence / 测试交接前强制人工逐项裁决；Reviewer 不可用则立即 `escalated`，实现前处理。隔离 Reviewer 默认使用 Claude，也允许显式切换 Pi。
- `vnext-manual-test.mjs`：仅当两轮语义审查仍未收敛时启用提测前人工实跑。CLI 只把 `runtimeRequired` 需求转换为场景，并将功能与界面检查拆开；Requirement/Surface 只保留为机器映射，工程契约不再要求人工逐条填写。人工确认 `confirmedBy + 场景结果`；`failed` 补实际差异，`not-testable` 必须补 blocker 且绝不算通过。新遗漏优先路由回 extraction，功能/视觉失败分别路由修复。本地截图/录屏/日志文件在应用表单时复制到项目 `evidence/manual/`，避免仅保存会话临时引用。
- `vnext-source-sync.mjs`：从既有 Lark source config 拉取到 staging，规范化并比较语义快照；无变化不改文件，有变化才原子替换来源并使旧抽取/审查/结果失效，失败保留旧快照。
- `lib/vnext-source-units.mjs`：Markdown 表格按容器 + 每个数据行生成稳定 source units，避免一整张表作为一个不可审计黑盒。
- `lib/playwright-mcp-adapter.mjs`：通过仓外 `@playwright/mcp --extension` 驱动系统 Chrome，按场景 JSON 执行动作和文本断言，为 `browser-interaction` evidence command 提供可执行 argv；token/浏览器不可用时明确失败。
- `docs-tdd run <PROJECT-ID> --prd <source>` + `lib/vnext-autopilot.mjs`：PRD-only 新建/恢复入口与纯状态机；`status/next/resume/run` 返回同一个 client-neutral action packet。v2 不再把 `agent/run-state.json` 当作第二状态源。
- `baseline-observations.json`：用户复盘中可确认的事故事实；与机器指标分离。
- `baseline.json`：由 `vnext-baseline.mjs --write` 从四个历史项目重复生成。
- `vnext-work-item.schema.json`：v2 单一业务事实载体的第一版 schema。
- `lib/vnext-source-units.mjs`：将 Markdown 与 HTML 原始来源确定性正规化为 text/table/image units；HTML table 支持 `thead/tbody`、内联标签、实体、`rowspan/colspan`，每个业务行独立成 unit，单元格图片也独立成 image unit；source ID 不依赖行号；图片描述原文进入 reviewer 输入，本地图片字节以 SHA-256 绑定，未下载/不可读图片阻断审查；同步时间和 Lark 临时媒体 URL 不制造伪漂移。
- `vnext-review.mjs` + `lib/vnext-review-receipt.mjs`：由 `docs-tdd review` 真正启动无工具、无代码上下文的独立 client/session，图片以附件传入；输出经本机 HMAC 签名后写回 work-item，手写 reviewer JSON 不能形成 V1/V2 有效审查。
- `vnext-review-adjudicate.mjs`：逐 finding 的人工裁决 overlay；保留原始签名审查结果，接受项必须修复候选并显式 `review-resume`，拒绝项必须带反证，延期项必须带 owner/batch。
- `vnext-scope-approval.mjs`：公开的 V2 人签协议；先生成当前 fingerprint 的审批摘要，再应用带确认人、日期和原因的输入，来源/范围/风险变化后自动失效。
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
- `vnext-context-budget.mjs` + `context-budget.json`：V0/V1 4K 硬预算；V2 以 8K 为目标预算、24K 为硬上限，超过 8K 且不超过 24K 时标记 `large-context` 但不阻断；四案例同口径字符代理减少 99.14%，历史 token 继续明确记为 null。
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
node common/engine/agent-scripts/vnext-readiness.mjs
# 登记真实新需求后；collecting 返回 1、rollback 返回 2、具备人工评审资格返回 0
node common/engine/agent-scripts/vnext-pilot.mjs --write
node common/engine/agent-scripts/vnext-verify.mjs --self-test
node common/engine/agent-scripts/lib/vnext-exit.mjs --self-test
node common/engine/agent-scripts/lib/vnext-source-units.mjs --self-test
node common/engine/agent-scripts/lib/vnext-coverage-review.mjs --self-test
node common/engine/agent-scripts/lib/vnext-work-item.mjs --self-test
node common/engine/agent-scripts/lib/vnext-metrics.mjs --self-test
node common/engine/agent-scripts/lib/vnext-manual-test.mjs --self-test
node common/engine/agent-scripts/vnext-review-benchmark.mjs --self-test
```

## Intake / Autopilot 入口

```bash
# 已有 Lark source config 的项目：原子重拉 PRD；无语义变化不触发重审
node common/engine/agent-scripts/docs-tdd.mjs source-sync PR-01234

# 生成抽取脚手架；填写临时 JSON 后应用，CLI 会持久化 extractionAudit
node common/engine/agent-scripts/docs-tdd.mjs extract PR-01234 --out /tmp/extraction.json
node common/engine/agent-scripts/docs-tdd.mjs extract PR-01234 --input /tmp/extraction.json

# V2 独立审查通过后生成并应用人签；不得手改 work-item.json
node common/engine/agent-scripts/docs-tdd.mjs scope-approval PR-01234 --out /tmp/scope-approval.json
# 人只填写 confirmation.confirmedBy / confirmedAt / reason
node common/engine/agent-scripts/docs-tdd.mjs scope-approve PR-01234 --input /tmp/scope-approval.json --client human

# 编码前创建/校验项目专属 worktree；写命令不会再回退仓库根目录
node common/engine/agent-scripts/docs-tdd.mjs worktree-prepare PR-01234

# 新项目：PRD 是唯一必需输入
node common/engine/agent-scripts/docs-tdd.mjs run PR-01234 --prd <source>

# 中断恢复：重复同一命令即可；status/next/resume 返回相同的下一动作判定
node common/engine/agent-scripts/docs-tdd.mjs run PR-01234
```

Figma/API 缺失不会在 intake 阶段形成全局阻塞。CLI 输出的 action packet 是客户端无关协议；Claude、Codex、Pi、Cursor 都按 `action`、`reason`、`constraints` 执行，不从 Markdown 阶段文字猜状态。

实现过程中只在一批相关改动稳定后运行 `docs-tdd dev-check PR-01234`，不在每个小改动后重跑。它只执行已审查的非浏览器命令，报告当前 changed paths、待提交 paths、requirement/surface 映射、未映射路径和 `deliveryScope.policyPaths` 越界，并把结果写入 `work-item.json.autopilot.lastDevCheck`；不会生成或覆盖正式的 `latest-result.json`。测试命令必须枚举 touched 或直接相关的具体测试文件；整仓、整包、整目录测试以及 `.tsx` 组件 Vitest/RTL render 测试都会 fail-closed。完全相同的命令仅执行一次并把证据关联到被覆盖项；缺失测试文件、未映射路径和越界路径同样 fail-closed。每条命令默认限时 300 秒，超时会终止整个子进程组并停止后续命令，保证失败报告可以落盘。TypeScript 为保证正确性可以加载所属项目依赖图，但只把 changed path 的新诊断或相对上次基线增长的跨文件诊断归因给本次改动；同一稳定代码指纹只集中执行一次。`deliveryScope.policyPaths` 是真实写入边界：checkpoint、dev-check、evidence 和 commit guard 任一层发现越界都会 fail-closed。

当 surface locator 是业务描述、无法可靠推导代码路径时，可传 `--path-map <json>`；JSON 为 `{ "mappings": [{ "path": "repo/relative/file.ts", "surfaceIds": ["S-001"] }] }`。CLI 只接受当前 changed path 和已批准 doing/implement surface，并把解析后的 requirement/surface 绑定写入报告；后续相同路径可复用上次映射。该映射只证明改动路径属于批准范围，不证明功能已经完成。

实现动作完成后，Agent 将 action packet 的 `actionId`、真实 `changedPaths`、代码搜索得到的 `discoveredSurfaces` 与实际覆盖的 `coveredSurfaceIds` 写入临时 checkpoint JSON，再调用：

```bash
node common/engine/agent-scripts/docs-tdd.mjs dev-check PR-01234
node common/engine/agent-scripts/docs-tdd.mjs dev-check PR-01234 --path-map /tmp/PR-01234-path-map.json
node common/engine/agent-scripts/docs-tdd.mjs checkpoint PR-01234 --input /tmp/checkpoint.json
# 可选：在依赖尚未齐备时提交明确标记为 non-delivery 的中间成果
node common/engine/agent-scripts/docs-tdd.mjs commit PR-01234 --mode checkpoint
node common/engine/agent-scripts/docs-tdd.mjs run PR-01234
# 或在 authoritative PASS 后显式执行最终提交
node common/engine/agent-scripts/docs-tdd.mjs commit PR-01234 --mode delivery
```

其中 `docs-tdd run` 会自动执行已审查的 evidence command plan，并自动组装 surfaces report 跑 enforced verify；显式 delivery commit 只在 authoritative PASS 已就绪时提交冻结路径。正式 evidence runner 与 dev-check 共用相同 argv 命令去重、显式测试文件预检、300 秒默认预算和进程组超时契约。证据保存在 `~/.cache/docs-tdd/evidence/<PROJECT-ID>/`，不会增加项目状态文件。命令退出 1 时仍会把 CLI 签名的失败证据送入 verify，使 Autopilot 真正进入修复分支；只有 runner/协议错误才中断。代码检查与 browser 检查分别最多自动修复两轮，任一域耗尽即输出 `escalate-repair-failure`，禁止无限重试。

`evidencePlan[].runtimeRequired=true` 不是注释字段：同一 requirement 必须另有受审查的 `browser-interaction` argv 命令，runner 与最终出口都会双重检查，普通 Vitest/文案命令不能冒充 runtime evidence。`component-dom` 只接受 Node DOM-contract 或 browser 证据，禁止以 Vitest/Jest 组件 render 测试代替。浏览器命令仍遵守 [browser-e2e-mcp.md](../rules/browser-e2e-mcp.md) 的边界：不向业务仓安装 Playwright/Puppeteer；只把自然独立的纯/tool `.ts` 逻辑固化为定向测试，不为凑测试拆组件；确需真实运行时的集成行为使用已有外部 browser adapter。

取得 authoritative PASS 后，`run` 只 `git add`/`git commit --only` 当前 `path-set-v1` 冻结路径；其他已暂存或未暂存文件不会被带入。`commit --mode checkpoint` 则只接受当前 passing dev-check 的 `pendingCommitPaths`，写入独立的 `checkpointCommit.nonDelivery=true` 记录，绝不冒充 delivery。commit hook 若改写相关字节，状态会回到重验而不是沿用旧绿灯。Autopilot 永不执行 `git push`。

独立审查 payload 会把 requirement 已锚定的语义单元排在最前，未锚定结构节点仅保留在 `sourceInventory`；所有图片 hash 和 disposition 都保留在 manifest，但仅把 requirement anchor 实际引用的规格图片作为 `reviewAssets` 附件发送。超时时间按 payload 字符数和附件数动态计算；传输失败单独累计 `transportFailures`，不消耗语义审查次数。

本地安装器生成的 pre-commit 会在 `verify-code-rules` 后自动执行 v2 **checkpoint** guard（默认不要求系统仓 evidence/verify 或 `latest-result PASS`）。只有存在 passing dev-check 时才校验 staged 路径与其 `pendingCommitPaths` 一致；普通开发提交可直接 commit。最终交付前请运行 `docs-tdd run` / `docs-tdd verify` 取得 authoritative PASS，并用 `DOCS_TDD_COMMIT_MODE=delivery` 或 `docs-tdd commit --mode delivery` 提交。若团队 hook 只通过 JS/TS glob 的 lint-staged 调 wrapper，安装器不会误判为完整接线，而会保留团队 hook并追加无条件的个人兜底。CI 需同时显式接入：

```bash
node <docs-root>/common/engine/agent-scripts/verify-code-rules.mjs --project "$DOCS_TDD_PROJECT_ID"
node <docs-root>/common/engine/agent-scripts/vnext-delivery-guard.mjs --project "$DOCS_TDD_PROJECT_ID" --worktree "$CI_PROJECT_DIR" --base "$CI_MERGE_REQUEST_DIFF_BASE_SHA"
```

Guard 只读且 fail-closed；它核验 `enforced PASS`、work-item/result 完整性、CLI-attested evidence 与当前内容指纹。pre-commit 使用 `--changed-source staged`，只要求本次提交集合等于冻结路径，不会因工作区中未提交的无关改动误杀；CI 默认使用相对 base 的完整分支改动集合。非 v2 分支自动不适用。`doctor` 只有在 CI 配置同时出现两个 guard marker 时才报告 CI 已接线。

### Figma / API 晚到

新项目在 intake 时将 Figma 和 API 标记为 `unknown + pending`。需求抽取时必须分别分类为：

- `not-required + not-required`：本需求不依赖该资料；
- `required + pending`：资料尚未到达；不阻断 PRD-first 实现；
- `required + available/integrated`：资料已被 CLI 指纹化，并需要/已经完成代码对齐。

API 未到但存在已批准场景时，`apiDependency.mode=mock-required`，MSW 只把状态推进到 `implementation-ready`；真实 API 契约尚未到达时，`SOURCE_READINESS` 禁止最终 `ready-to-test`。API/Figma 到达后先把文件放在当前项目 `inbox/`，再运行：

```bash
node common/engine/agent-scripts/docs-tdd.mjs source-update PR-01234 --input /tmp/source-update.json
```

`source-update.json` 示例：

```json
{
  "kind": "api",
  "requirement": "required",
  "status": "available",
  "reason": "backend contract v3 arrived",
  "revision": "v3",
  "path": "apps/web/docs_tdd/prds/PR-01234/inbox/api-v3.md"
}
```

CLI 自己读取并计算内容指纹，不接受调用方伪造 hash。到达新版本后输出 `reconcile-late-sources`；Agent 只处理该增量，API 从 mock 切换到 real contract 时必须同时报告最终 MSW 状态。对齐 checkpoint 把 source fingerprint 标为 integrated，之后才恢复 evidence/verify。

### 证据与代码状态绑定

CLI 执行 evidence 前后仍比较整棵有效代码树，测试命令若改写代码或生成未忽略文件会立即失败；持久化的证据身份则冻结为 `path-set-v1`：当前分支相对基线的真实 changed paths，加上实现 checkpoint 报告的路径。checkpoint 路径也会由 Git 机械核验，不能用不存在或未变更的文件凑数。

因此：

- 仅执行 `git commit`、HEAD 改变但相关文件字节不变：证据仍有效；
- 后续修改无关路径：证据仍有效；
- 修改、删除、改权限或改软链目标，只要位于冻结路径集合：证据失效并自动重验；
- 旧结果没有 `scopeMode=path-set-v1` 时继续采用整仓 `contentHash`，不静默放宽历史证据。

## 独立审查调用边界

范围与证据使用独立 fingerprint：修改 `evidencePlan` 或 `evidenceCommands` 只会要求重跑确定性 evidence-plan 审计，不会使已通过的语义 scope review 失效。独立 Reviewer 不是确定性格式校验器。`docs-tdd extract --input` 必须先产出与当前 source/requirements fingerprint 一致且 `status=pass` 的 `extractionAudit`；否则 `review` 在启动子进程前失败。每次 changes-required 消耗一次审查机会；同一 source lifecycle 累计两轮或相同 finding 再现时进入 `human-review-deferred`。第二轮 packet 会附带首轮 findings 与 requirement 级 candidate diff，要求先验修复、只报告未解决或重大的新遗漏。此状态可继续实现当前抽取范围，但必须在运行 evidence、提交测试或声明 ready-to-test 前，由人逐 finding 执行 `review-adjudicate`。Reviewer 不可用属于基础设施失败，立即 `escalated` 并在实现前处理。人工接受 finding 后须修复抽取候选；仅在两轮预算尚有余额时才可显式 `review-resume`，且已消费次数保持不变。预算耗尽后不得开启第三轮；若人工接受 finding，修复抽取后必须再次由人以 `resolved` 确认当前 scope；若只是补录三阶段 traceability 等不改变需求/Surface 语义的迁移，也必须由人把原裁决重新绑定到当前 fingerprint。两种路径都继续受 `requiresPretestHumanRun` 约束，并在提测前完成人工实跑。拒绝/不适用/延期全部有依据且无接受项时，裁决 overlay 可形成有效 PASS，但原始签名审查 receipt 与 verdict 保持不变。

```bash
# 1. 原始来源 → 稳定 source snapshot + source units
node common/engine/agent-scripts/vnext-verify.mjs --normalize-sources source-input.json

# 2. 先生成并应用抽取候选；这一步执行确定性 intake audit
node common/engine/agent-scripts/docs-tdd.mjs extract PR-01234 --out /tmp/extraction.json
node common/engine/agent-scripts/docs-tdd.mjs extract PR-01234 --input /tmp/extraction.json
node common/engine/agent-scripts/docs-tdd.mjs coverage-check PR-01234

# 3. 在 requirementsAuthor 已记录后启动真正独立的 source-only reviewer；V1/V2 必须走此入口
node common/engine/agent-scripts/docs-tdd.mjs review PR-01234
# 默认使用 Claude；含图片且需要附加图片字节时显式使用 --client pi

# 若升级人工：逐 finding 裁决。接受项先重新 apply extraction；尚有预算才 resume
# 两轮已耗尽则不得 resume，修复后再次 adjudicate，并把原 accepted 项标记 resolved
node common/engine/agent-scripts/docs-tdd.mjs review-adjudicate PR-01234 --input /tmp/review-adjudication.json --client human
node common/engine/agent-scripts/docs-tdd.mjs review-resume PR-01234 --input /tmp/review-resume.json --client human

# V2 review PASS，或两轮耗尽后带明确 provisional 标识，执行 fingerprint-bound scope approval
node common/engine/agent-scripts/docs-tdd.mjs scope-approval PR-01234 --out /tmp/scope-approval.json
node common/engine/agent-scripts/docs-tdd.mjs scope-approve PR-01234 --input /tmp/scope-approval.json --client human

# 4. 仅当两轮审查耗尽触发兜底时：CLI 只展示 runtimeRequired 的人类可执行场景，工程契约不再要求人工逐条确认
node common/engine/agent-scripts/docs-tdd.mjs manual-test PR-01234 --out /tmp/manual-test.json
# evidenceRefs 可填 HTTPS/log 引用或本地文件；本地文件在应用时自动复制到项目 evidence/manual/，避免会话附件失效
node common/engine/agent-scripts/docs-tdd.mjs manual-test PR-01234 --input /tmp/manual-test.json

# 5. 运行受信 command evidence；命令计划默认取自已审查的 work-item.json evidenceCommands，输出放在被测 worktree 外
node common/engine/agent-scripts/docs-tdd.mjs evidence PR-01234 --worktree /absolute/path/to/worktree --out /tmp/evidence.json
# --plan <evidence-plan.json> 仅作兼容/显式输入保留；若提供，必须与 work-item.evidenceCommands 完全一致，否则 fail-closed

# 6. 组装并跑正式出口：--evidence 自动注入签名 bundle，--surfaces 只提供 agent 实现后无法推导的落点报告
#    （discoveredSurfaces = 代码搜索实到的落点；coveredSurfaceIds = 实际实现覆盖的）。workItem/sourceDocuments 由 CLI 从 work-item.json 自动组装。
node common/engine/agent-scripts/docs-tdd.mjs verify PR-01234 --evidence /tmp/evidence.json --surfaces /tmp/surfaces.json --worktree /absolute/path/to/worktree

# 兼容：仍可手工拼 verify-input.json 走 --input（V0 legacy fixture 或需要显式 reviewResponse 时）
node common/engine/agent-scripts/vnext-verify.mjs --input verify-input.json --worktree /absolute/path/to/worktree
```

默认 Reviewer 固定为 Claude，不探测或回退到 Codex。确定性基线用 `node common/engine/agent-scripts/vnext-review-benchmark.mjs --input common/engine/fixtures/vnext-review-benchmark.json --out <report.json>`：当前 oracle 来自三个历史语义场景，覆盖图片需求漏抽、集合第三入口漏 surface、权限与失败重试分支漏项，并用四个 mutation 保证漏项仍可观测；fixture 不伪造模型运行，所以默认 `recommended: null`。需要比较 Claude / Pi 时，在同一 fixture 的 `runs` 中录入真实结果；报告计算 requirement recall、surface recall、误报、首次审查通过率、finding 数、耗时和 token，但不自动修改默认值。token 或耗时拿不到时保留 `null`，不伪造。

`docs-tdd review` 只向子进程提供规范化 source units、候选 requirements 和图片附件，不提供代码仓或工具。Claude CLI 路径暂只支持纯文本 packet；含图片的审查须显式使用 `--client pi`。运行前，需求抽取者必须在 work-item 写入 `requirementsAuthor`；模型作者记录 `{ kind, id, client, sessionId }`（Pi 可取 `PI_SESSION_ID`），人工作者记录 `{ kind: "human", id }`。CLI receipt 绑定请求 fingerprint、reviewer client/session、时间和全部图片 hash；相同模型也必须使用不同 session，`pass` 不允许存在 `open` finding。来源、图片字节或需求变化后旧 response 自动失效。`--prepare-review` 仅保留为调试/协议查看入口，不能替代签名审查。

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
- 命令计划默认直接来自已审查的 `work-item.json.evidenceCommands`，不需要额外的 evidence plan 文件；标准命令是 `docs-tdd evidence <PROJECT-ID> --out <evidence.json>`。`--plan <evidence-plan.json>` 仅作兼容/显式输入保留，形如 `{ "schemaVersion": 1, "projectId": "PR-01234", "commands": [{ "evidenceId": "E-1", "kind": "pure-logic", "argv": ["pnpm", "test", "--run", "path/to/resolver.test.ts"], "requirementIds": ["R-001"], "surfaceIds": ["S-001"] }] }`；若提供，其 `commands` 必须与 work-item 的 `evidenceCommands` 完全一致，不能绕过独立 review，否则 fail-closed。该字段属于 requirements fingerprint，新增或改命令后必须重跑独立 review。reviewer 会拒绝 `true`、`echo`、version probe、shell eval、kind/argv 不相称、宽范围质量/测试、component-dom 测试 runner 或覆盖不全的计划；runner 对同类问题做确定性阻断。required level、requirement evidence plan 和 implement surfaces 还会由 runner 与最终 verify 双重交叉校验。
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

- full context 必须包含每条 requirement、surface、evidence plan、coverage finding disposition、API/MSW 策略和最后出口状态；绝不静默截断需求。
- V0/V1 的目标与硬上限均为 4K 字符；V2 目标预算为 8K，超过 8K 且不超过 24K 时进入 `large-context` 模式并携带 warning 继续运行，超过 24K 才返回 `bound-implementation-scope` 要求建立 `deliveryScope`。存在剩余批次时 `deferred` 必须填写 owner/batch/reason；本批次已覆盖全部剩余范围时显式写 `deferred: null`。
- 同 work-item fingerprint 下返回 delta/unchanged；session 由调用方临时持有，不增加项目默认文件。代码指纹审计对 Git 子进程、文件数量、总字节数和哈希耗时均设 fail-closed 上限；极端仓库只能通过 `DOCS_TDD_FINGERPRINT_*` 环境变量显式调高，不能静默截断。
- 历史 token 没有机器记录，所以不伪造 token 降幅；`context-budget.json` 只报告可复算的 Unicode 字符代理。
- `apiDependency.mode` 是 work-item 必填事实：无请求或真实 API 时禁止新增 vNext 范围 MSW；只有 `mock-required` 才要求 worker、handler 与 contract 覆盖；`pending-dependency` 必须绑定 open blocker，最终出口保持 blocked。
- V2 scope approval fingerprint 包含 `apiDependency`，API/MSW 策略变更后旧的人签自动失效。

## Pilot 质量观察与 v3.3 R-13（非当前切流条件）

1. Pilot 必须是 `newRequirement: true` 的真实需求；V0 可以是现有项目下的独立微变更。`artifactMode=isolated-snapshot` 只允许三份规范状态文件，`artifactMode=project` 可直接读取公共 CLI 管理的真实项目目录及其 source/support files。
2. 每个样本从三文件机器读取 level、出口完整性和 context 预算；提测后的漏项/假绿由负责人填写带姓名和观察截止时间的 observation。
3. 历史质量观察达到 3–10 个 completed 样本、覆盖 V0/V1/V2 且零逃逸时，仍只输出 `eligible-for-human-cutover-review`；`automaticCutover` 永远为 false，pilot 不控制 Router 或正式出口。
4. R-13 是独立的 v3.3 release qualification：V0/V1/V2 各至少一个样本必须取得 authoritative PASS、完成 post-test observation，并由实际核对人证明全流程只使用公共 `docs-tdd` 命令。旧版历史 PASS、未完成项目和 synthetic fixture 均不计数。
5. 当前 PR-02074（V0）与 PR-02172（V1）仅是历史样本，不能追认为 v3.3；PR-02233（V2）已纳入真实项目观察，但在实现、依赖、验证、交付和 post-test 观察完成前保持 collecting。PR-02118 作为“仅运营 SOP、无明确软件交付”的负向候选保留，不计入编码样本。
6. 执行证明和 observation 的填写格式见 `pilots/observation-template.md`；任何未发生的事实保持 `null`。
