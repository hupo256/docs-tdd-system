# docs_tdd 框架变更日志

> 常驻路由的稳定目标（取代按日期命名的一次性升级报告，避免每次升级都新增文件并挤进路由表）。
> 每次对 `common/` 规则体系、gate 脚本、模板做实质升级，在顶部加一段「日期 + 变更」。
> **写法（去重）**：本日志只记「改了什么 + 为什么 + 生效边界」，不复制当前规则正文或证据表；当前口径统一引用 `rule-ownership.json` 指向的专题源。gate 计数只写一行结果，细目留在脚本输出。


> 更早的历史条目已归档到 [CHANGELOG-archive.md](./CHANGELOG-archive.md)（不进 context、不参与预算）。

## 2026-09-23（v3.5.0 stable）

- **正式发布**：v3.5.0 已通过规则发布、golden 回归和 `docs-tdd guard --strict`；pilot 仍为 `collecting`，暂无 production attestation，因此不宣称 production-ready。
- **安全与验证收口**：正式 extraction 保持 v2 状态机，lite-path 仅作只读候选评估；progressive verify 仅作 preflight，正式交付仍以 enforced verify 为唯一出口。
- **生效边界**：新项目默认使用 `workflowVersion: 2`，存量 v1 项目不迁移；系统不自动 push，两个非阻断 doctor warning 继续留在后续维护清单。

## 2026-09-19（v3.5 Requirement-to-Commit）

- **版本与协议**：当前入口升级为 docs_tdd v3.5 / ruleset 3.5；新项目继续使用 `workflowVersion: 2`，不迁移历史项目。
- **Requirement-to-commit**：新增四档效率路由和预算、safe work context、隔离 worktree/环境分支/路径边界校验、source graph 与 `source-graph` CLI，并用 requirement/surface/evidence 对账和四项目 replay 防止漏项、漂移、假完成。
- **有界修复**：`source`、`review`、`code`、`browser`、`environment`、`external-dependency` 六类失败按输入/失败指纹去重；预算耗尽进入终态并提供唯一恢复命令，避免无限重试。
- **交付真值**：正式 delivery 只接受当前 enforced PASS、`autonomous/cli-attested`、integrity/freshness、匹配冻结路径、非空 delivery commit SHA 和 clean Git scope。人工验收的普通 `unresolved` 留在 implementation repair，只有 `newOmissions` 回到 extraction；string locator 保留兼容 fallback。
- **Pilot 边界**：pilot release 为 `autopilot-v3.5`，状态仍为 `collecting`，历史样本不能追认，真实 clean-project/public-command V0/V1/V2 pilot 尚未完成；系统不自动 push，也不宣称 production-ready 或 Phase 8 全部升级完成。

## 2026-09-16（Hook 嵌套事件兼容与审计诊断解耦）

- **嵌套 tool id 对齐**：客户端以 wrapper tool 触发 `PreToolUse`、却以内层 `apply_patch` 等不同 id 触发 `PostToolUse` 时，规则消费账本按已批准目标和连续 hash 链配对，并保留 pre/post 双 id；未批准文件继续 fail-closed，避免合法编辑被误记为无回执写入。
- **失败语义解耦**：`changed` 将此类失败明确标记为 `workflow-rule-audit`，同时输出业务 worktree、代码检查 `not-run`、恢复动作，以及“不读取 docs_tdd 系统仓 dirty 状态”的边界，避免把 Hook 基础设施异常误报为业务代码检查失败或跨仓耦合。

## 2026-09-15（验证经济与响应韧性收口）

- **批次化、定向验证**：Biome / TypeScript / tests 改为相关改动稳定后集中执行；Biome 和测试必须显式指向 touched files / 直接相关测试，禁止每个小改动重复跑完整检查，也禁止整仓、整包或整目录测试。TypeScript 保持项目依赖图正确性，但只以 touched-file diagnostics 归因本次门禁。
- **组件测试边界**：Vitest 只用于自然独立的纯/tool `.ts` 逻辑；`.tsx` 的 label、visibility、条件渲染改走 DOM-contract 或 browser evidence，禁止新增 Vitest/RTL render 测试或为凑测试拆组件。v1 `component-dom` 不再接受 `vitest` method；v2 intake/reviewer 与 evidence command policy 同步拒绝组件测试冒充 DOM 证据。
- **集合解析韧性**：API/schema/mapper 流程要求逐元素韧性解析与定向回归证据；单个字段或单条记录异常不得让其余合法 response/list 整体不渲染。
- **生效边界**：规则同时进入常驻批次节奏、按需质量清单、API 专题与 v2 evidence plan 机器校验；既有 work-item 中的宽范围或 component-dom Vitest 命令需重新审查后更新，不能沿用旧 scope approval 冒充合规。

## 2026-09-13（审查成本上限与状态可信度）

- **自动审查两轮封顶**：每次人工介入前最多执行两轮独立 Reviewer；第二轮仍未通过进入 `human-review-deferred`，允许先完成实现，但 evidence、测试交接和 ready-to-test 前必须人工逐 finding 裁决。Reviewer 基础设施不可用仍立即阻断；人工接受 finding 后，修订候选并显式 `review-resume` 才能开启下一段两轮预算。
- **上下文 readiness 前移**：Autopilot 在模型审查和业务编码前生成完整实现上下文；超预算直接返回 `bound-implementation-scope`，禁止一边声称 `implement-current-scope` 一边让 `context` fail-closed。
- **大型 V2 双层预算**：8K 从阻断线改为目标线；超过 8K 且不超过 24K 时保留完整需求并以 `large-context` warning 继续，只有超过 24K 才要求拆分 `deliveryScope`。V0/V1 仍保持 4K 硬上限。
- **状态与环境诊断**：V2 项目索引改从真实 action 派生状态，并拆分 active / closed / diagnostic fixture；上下文同时展示 raw/effective review verdict；doctor 增加 `rg` 运行依赖检查。

## 2026-09-12（v3.3 Autopilot Implementation Loop）

- **Feature / Bugfix 双入口**：`kickoff --kind bugfix` 把缺陷报告绑定为 incident source，使用 `fix/<PROJECT-ID>` 分支；两类 intake 共用风险路由、独立审查和正式验证，不为修 bug 开旁路。
- **实现期快速反馈**：新增 `docs-tdd dev-check`，执行已审查的非浏览器证据命令，报告 changed path 到 requirement/surface 的映射，并用 baseline-aware typecheck 区分存量诊断与当前改动回归；不污染正式 `latest-result.json`。真实 V2 pilot 进一步补齐目录级命令去重、缺失/空测试目标拒绝、显式 `--path-map`、未映射路径直接失败，以及 300 秒进程组超时和 fail-fast；正式 evidence runner 复用同一命令执行契约，状态 action packet 直接回显上次失败原因，避免空操作假绿、超时后无报告和失败后仍无可执行提示。
- **写入边界与两类提交**：`deliveryScope.policyPaths` 在 checkpoint、dev-check、evidence、pre-commit/CI guard 全链 fail-closed；checkpoint commit 必须绑定 passing dev-check 且标记 non-delivery，delivery commit 仍只接受 authoritative PASS，均不自动 push。
- **审查降噪与有界失败**：审查请求优先语义单元，结构节点和非规格图片保留可审计 inventory 但不挤占附件；timeout 随 payload 调整，传输失败单独记账并升级人工，不消耗语义审查轮次。
- **Pilot 资格与当前进度**：R-13 只接受 v3.3 下经公共命令完成、取得 authoritative PASS 且有 post-test observation 的真实 V0/V1/V2；历史样本和 synthetic fixture 不追认。PR-02233 已作为真实 V2 项目纳入 collecting，未完成前不计数。
- **本地交付边界定案**：owner 明确远端 CI guard 为 `not-required`；doctor 读取配置后不再为该选择告警，本机 pre-commit 继续强制 code-rules 与 delivery guard。`--no-verify` 或其他未安装 hook 的机器仍在保障边界之外。
- **兼容边界不变**：产品版本升至 v3.3，项目协议继续使用 `workflowVersion: 2`；存量 work-item 无需迁移。

## 2026-09-12（v3.2 Intake / Review Reliability）

- **确定性检查前移**：新增 `docs-tdd extract` 脚手架与 `extractionAudit`；重复需求 ID、漏锚语义 unit/表格行、集合计数和 evidence command 完整性在启动模型 Reviewer 前 fail-closed。
- **Reviewer 有界化（当时策略，已由 2026-09-13 两轮策略替代）**：同一候选禁止无变化重试；changes-required 当时最多三轮，相同 finding 再现、次数耗尽或 Reviewer CLI 不可用均持久化 `reviewControl.status=escalated` 并转人工，不再无限循环。
- **表格逐行与 Source 重同步**：Markdown 表格同时产出结构容器和逐数据行 unit；`docs-tdd source-sync` 先拉 staging，再比较语义快照并原子替换，有变化才使旧抽取/审查/结果失效，失败保留旧快照。
- **Browser adapter 闭环**：提供 `playwright-mcp-adapter.mjs`，通过仓外 `@playwright/mcp --extension` 执行场景动作/断言，并文档化 argv、退出码和无源码副作用契约；不向业务仓安装 Playwright，也不把 adapter 纳入状态机。
- **兼容边界不变**：产品版本升至 v3.2，项目协议仍为 `workflowVersion: 2`；Lark 继续保持 `lark-lightweight` 独立链，不接入 v3.2 状态机。

## 2026-09-11（Lark 轻量闭环与正式交付权分离）

- **不并入 v3.1 状态机**：Lark 保留适合群反馈的独立任务/提交链；`done` 定义为本地候选修复，审计显式写 `assuranceMode=lark-lightweight`、`deliveryAuthority=false`。L2 高风险改动提示项目级 authoritative PASS，但不因此阻断 Lark 候选修复。
- **Worker 最终回执**：AI 与规范纠正结束后，由 Worker 对最终工作树实跑 diff-check 与触达文件 Biome，回执绑定 `HEAD + diffHash + changedFiles`；失败不提交、不回 done，AI 自报 checks 不再是唯一证据。
- **路由/提交防串线**：新增任务项目、cwd、hotfix branch 一致性校验，并在开工、终检、提交前锁定真实 git root/branch/HEAD；中途切分支或 AI 自行 commit 会 fail-closed。提交模式、身份回执与结果进入任务审计。

## 2026-09-11（v3.1 正式定版）

- **版本身份**：当前框架与规则集正式定名为 **docs_tdd v3.1**；`common/rules/ruleset.json` 是机器可读版本源，发布清单随规则链重新生成。项目内 `workflowVersion: 2` 继续作为第二代 work-item 协议的兼容路由标识，不等同于产品版本，也不回写历史项目。
- **正式能力集合**：v3.1 收录 PRD-only Autopilot、隔离子会话审查、CLI-attested evidence、相关路径内容绑定、code/browser 有界修复、后到 Figma/API 增量对齐，以及 authoritative PASS 后按冻结路径提交且永不自动 push。当前契约与操作入口见 [vnext/README.md](./vnext/README.md)。
- **交付强制边界（当时状态）**：本机 pre-commit 已无条件串联 code-rules 与 `vnext-delivery-guard`；当时业务仓尚无可识别的远端 CI gate。后续 owner 已在 2026-09-12 明确远端 CI 为 `not-required`，当前边界以上方 v3.3 条目为准。

## 2026-09-10（Hook 止血 + v2 intake/review 防假绿）

- **先探针后切流**：新增 Codex/Claude/Pi capability/probe、统一 16 KiB 组合预算和注入 telemetry；验证通过的客户端改为 allow-with-context，规则消费 ledger 按规则内容 hash 增量复用，commit 不再导致相同规则重复注入，opaque write 仍 fail-closed。
- **图片进入 source truth**：v2 source normalization 读取本地图片字节并绑定 `assetHash/status/mediaType`，同步时间与 Lark 临时图片 URL 不再制造漂移；缺失、远程或未读图片直接阻断 review。PR-02306 原始图片样本进入回归自测。
- **独立 reviewer 机器化**：新增 `docs-tdd review <ID> --client pi|claude`，以无工具、无项目 context、独立 session 子进程冷读 source packet；本机 HMAC receipt 绑定请求、图片 hash、client/session 与时间，V1/V2 缺 receipt、伪造或同作者身份均不能通过 verify。
- **证据诚实性与 freshness**：调用方 evidence 固定披露 `assuranceMode=assisted-pilot`、`evidenceTrust=caller-supplied`；代码 freshness 改按 effective content hash 判定，同字节 commit 不再误杀。真实代码内容变化进入 `revalidate_current_code_evidence`，只重验代码证据，work-item/source 未变时复用已签名需求审查。
- **V0-micro 安全瘦身**：Markdown 标题、分隔线和纯注释由 intake 确定性识别为结构节点，不再要求逐条写 `sourceUnitDispositions`；其他未引用语义内容继续阻断。V0 同时强制单 doing requirement、单 implement surface、local/no-risk/no-request、无集合与富媒体、无 runtime evidence，不满足即升级而非静默放行。
- **受信 command evidence runner**：新增 `docs-tdd evidence <ID>`，以无 shell 的 argv 执行经独立 review 冻结在 work-item 的 `evidenceCommands`，绑定 work-item / plan / effective code / 输出 hash 并签发本机 receipt；机器拒绝明显 no-op/shell 计划与覆盖不全，验签成功的纯命令证据升级为 `autonomous / cli-attested`，手填或 human evidence 继续诚实标记为 assisted。
- **verify 组装模式（去手工衫接）**：`docs-tdd verify <ID> --evidence <evidence.json> [--surfaces <report.json>]` 从 canonical `work-item.json` 自动组装 workItem/sourceDocuments/currentRevision 并注入签名 evidence bundle，消除手工拼 `verify-input.json` 与粘贴 evidence 导致的验签失败；仅 `discoveredSurfaces`/`coveredSurfaceIds` 由 agent 实现后报告（不可推导，否则关掉 surface 漂移与漏实现校验）。新增端到端 autonomous 回归：evidence 按磁盘 work-item 签名、verify 经 `applyCoverageReview` 重建后验签，锁定单元级测试共享对象时漏掉的指纹往返一致性。
- **Autopilot 与 runtime 修复闭环**：`docs-tdd run <ID>` 串联 review/evidence/verify，失败 evidence 也会进入正式 verify；code/browser 各有独立修复预算，`runtimeRequired` 必须由真实 `browser-interaction` 证据满足。PASS 后只提交冻结路径且永不 push。
- **交付绿灯防绕过**：证据改为 `path-set-v1` 内容绑定，单纯 commit/无关文件不再误杀，相关路径变化仍重验；新增只读 `vnext-delivery-guard`，pre-commit/CI 核验 CLI-attested PASS、结果完整性与当前内容，并分别以 staged 集合/相对配置 base 的完整分支集合校验冻结路径。安装器不再把受 JS/TS glob 限制的 lint-staged 当作无条件接线，删除或非 JS 提交由外层本地 hook fail-closed 兜底。

## 2026-09-10（下线发布层 stale 检测，彻底靠 pin-based）

- **移除 `ruleChainFresh` / stale 告警**：lark 自动执行路径（worker `runAI`、`/lark/health`、`lark-bot status` CLI）不再判「published L3/effective vs 当前源」是否 stale。该检测早已 note-only 不阻断（d533eb4），且因消费仓 `fameex-web` 的 `AGENTS.md` 随分支漂移而频繁假 stale，退化成刷屏噪音。规则消费已切 pin-based（项目钉 `policyFingerprint`），发布层落后于源对在飞任务无影响。
- **指纹链路保留**：`rule-chain-runtime.mjs` 新增 `readRuleFingerprints`（无条件取当前两层 `currentFingerprint`，不判 fresh、不抛错），替换 `inspectRuleChain`/`assertFreshRuleChain`（已删）。两层发布指纹仍注入 AI 上下文与审计。
- **`VERIFY-RULE-004` 语义收敛**：只保留「缺失常驻必需规则文件/章节」的 fail-closed（`lark-rule-context.mjs`），"stale rule chain" 含义退休。
- **主动查询不变**：`docs-tdd rules status|upgrade`（`rule-pin.mjs`）仍是查看/采纳发布层落后的入口，输出 "newer rules available"。

## 2026-09-08（v2 正式启用：新需求默认 + 全等级 enforced）

- **owner 决策立即正式切换**：新需求默认 `workflowVersion: 2`，V0/V1/V2 共用正式出口；不再等待历史 pilot 样本数或全部样本闭环。接受的偏差与不豁免原则见 `common/vnext/cutover-decision-20260908.md`。
- **机器硬路由**：`docs-tdd verify` 强制对 v2 写 `mode=enforced` 的 `latest-result.json` / `runs.jsonl`，failed/blocked 返回非零；v2 拒绝 `gate`/`changed`，v1 拒绝 `verify`；`status/next/resume/context` 按 `workflowVersion` 路由。
- **兼容边界**：存量 v1 不迁移，继续 G0–G8；显式 `--legacy` 才新建 v1。历史 shadow 样本和 pilot 保留作回归观测，但不再控制正式切流，`automaticCutover` 仍为 false。
- **文档收敛**：Router、startup、kickoff、AGENTS、根/公共 README、Phase 8 与旧评审统一为同一口径；未闭环项目仍按自身结果失败，系统切换不构成豁免。

## 2026-09-06（历史：vNext 分级切流，已由 2026-09-08 决策取代）

- **历史事实（当时的分级决策）**：`docs-tdd kickoff` 默认创建 vNext 项目；当时 V2 仅作非阻断观察。该临时边界已被 2026-09-08 正式切换取代，历史摘要见 `common/vnext/cutover-review-20260906.md`。
- **V0/V1 灰度已实测闭环**：PR-02074-search-width / PR-02172-provider-visibility 提测后零漏项零假绿；pilot report 的已完成样本均保持零逃逸。
- **v1 冻结**:rule-ids-and-gates.md 标 maintain-only——不新增 v1 Rule ID/Gate/模板层,不删除不回溯;V2 转正与 v1 归档(移 archive/)等 pilot eligible 后另行评审。
- **生效边界**:存量项目读不到新 router 行即无行为变化;`check-doc-budget`/`vnext-self-test`/三个 replay 全绿;kickoff 的 vNext 分支经 PR-99999 探针实测(source snapshot 真 hash、run-state nextAction `vnext_extract_requirements`)后已清理。

## 2026-09-04（docs_tdd vNext Phase 0–6 shadow-only 落地）

- **vNext 工作流（workflowVersion: 2）从流程门禁转向效率与质量**：用单一 `work-item.json` 承载「原始 PRD → 代码落点 → 当前 HEAD 验收证据」，默认产物从 253 个流程文件收敛到 3 个（4 项目组合 253 → 12，−95.26%），机器 context 字符代理从 v1 可复算口径 342592 → 2718（−99.21%），V0/V1 硬预算 ≤4K、V2 ≤8K。
- **三个历史提测漏项（PR-02306 图片密码、PR-01930 集合落点、PR-02265 PRD 漂移）做成确定性回放夹具**：`vnext-replay.mjs` / `vnext-exit-replay.mjs` / `vnext-route-replay.mjs` 全部通过，漏项和假绿路径可机器复现，不是纸面承诺。
- **Phase 0–6 核心模块完成**：source units、coverage review、risk route、single exit、persistence、context/artifact budget、MSW policy 已接入 `vnext-self-test.mjs`（18 脚本）并注册进 `check-doc-budget.mjs`（71 自测入口）。
- **Phase 7 双轨灰度启动**：样本按 V0/V1/V2 分级登记，当前 `decision: collecting`；`post-test observation` 与部分后端 API 契约依赖等待业务/人工推进。
- **当时的生效边界**：2026-09-04 尚为 shadow-only；该状态已被 2026-09-08 正式切换取代。

## 2026-09-03（常驻预算闭环与本地多客户端强制补齐）

- L1 `~/.ai-rules/AGENT.md` 纳入 7000 字符硬闸，并新增 L1 + L3 + L2 `alwaysApply` 的 16000 字符首次编辑总预算；重复的通用质量细则下沉到按需 `coding-quality`。
- Claude/Codex 共用 PostToolUse 代码 gate 与多文件目标解析；Codex 的 hook 合同现在同时验证规则注入、消费回执和即时代码检查。纯人工客户端改名为 `human`，检测到 Codex/Claude 环境时拒绝伪装客户端。
- 安装器在团队未接相同 gate 时才增加个人 `core.hooksPath` pre-commit 兜底，并链式保留已有 hook；本仓已存在 Husky/lint-staged 与 CI gate，故保持原配置、不重复执行。gate 基础设施失败改为 fail-closed。
- `doctor` 新增五端实际 loader/executor 能力检查，`guard --strict` 会阻断本地可修 warning；CI 缺口因需团队批准仍只报告。
- G6 四维默认上下文通过章节去重从约 30K 收敛到 25K 硬目标；业务仓仅修正两份 AI 规则：SWR 改为 React Query，通用 DoD 取消 alwaysApply 与无条件重门禁。

## 2026-09-02（Claude/Codex 机械消费 Cursor L2 规则）

- 新增统一 MDC Resolver 与 Claude/Codex PreToolUse deny-and-retry 注入：直接读取当前 worktree 的 `.cursor/rules`，按 `alwaysApply`/`globs` 匹配，正文逐字注入；单事件 96 KiB 超限阻断，不静默截断。
- 新增 session/context epoch 消费账本：PostToolUse 记录文件 hash 与规则 fingerprint，`changed` 和 G5+ 拒绝缺回执、绕过 hook、规则漂移或陈旧内容；账本目录排除在变更快照外，Git HEAD 变化会先开启新 epoch 再重新注入。
- Codex/Claude 用户级 hook 由统一安装器幂等维护；Codex hook timeout 使用真实输入字段 `timeout`，首次或内容变化后必须通过 Codex 启动审查信任新 hash。
- effective rules 现在递归指纹化 L1 skill 全树，按当前 worktree 读取 L2、但不把物理 worktree 路径写入内容 fingerprint；doctor 阻断可发现的 backup skill 和任一 worktree 中被 `skip-worktree` 隐藏的规则入口。
- 原子发布链、golden 聚合器与 context 新鲜度检查保留调用方 worktree，不再退回主仓读取另一份本地 L2 入口；不同 worktree 的真实字节差异继续由 effective fingerprint 明示。
- 未改动的仓库入口重复文案由 doctor 明示为 warning；真实 L2 冲突、入口本地改写/隐藏和 fingerprint 漂移仍保持 error，避免为了消警擅改团队 tracked 文件。
- 生效边界：Cursor 原生行为不变；Claude/Codex 对有 glob 或 `alwaysApply` 的 MDC 生效。无 glob 且非 alwaysApply 的 `async-api-routes.mdc` 继续在 `unscopedRules` 明示，尚不宣称机械对齐。

## 2026-09-01（PRD bullet 原子验收与证据类型硬闸）

- 新模板把本期 PRD bullet 固化为 `R-Fxx-xx`，要求一条 requirement 恰好对应一条 Task；存量项目仅在主动加入「原子需求清单」后启用，避免全量回填。
- `acceptance-results.json` 增加可选 `requirementId/taskId/evidenceType`；`DOC-G2-006/007` 与 `DOC-AC-008/009` 分别阻断原子清单/Task 漏映射，以及 requirement 未通过或 copy/DOM/logic/payload/interaction/visual 证据错配。
- 新脚手架升至 v5；Golden 增加漏 Task 与证据错型反例。完整 G6 PASS（当前 HEAD/dirty/rule fingerprint）成为“可提测”唯一口径，G6-partial 或 Feature/commit 级证据不可替代。

## 2026-08-29（MSW 路线 B 试点结项，晋级为新功能强制标准 + 补参考范例）

- **PR-01947 上线归档，试点结论坐实**：MSW 路线 B 随 PR-01947 引入并验证「停用 handler 即切真实接口，业务代码不因拆 mock 而修改」；项目已合入 `origin/online`、handler 完整拆除（manifest lifecycle=`mock-retired`），据此把该路线由试点晋级为新功能强制标准。
- **`DOC-G3-IMPL-001..006` 晋级阻断（不回溯）**：`ruleset.json` 里 IMPL-001/002/004/005 由 `{experimental, blocking:false}` → `{trial, blocking:true, since:4}`（可豁免），IMPL-003/006 同批 `trial+since:4`（不可豁免）。沿用 Batch 5 的 `since` 收窄范式，只硬阻断模板 v4+ 新项目，存量低版本项目（含 PR-01947 及在飞项目）仍 warn，不被回溯打断。定档逻辑（`lib/rule-maturity.mjs`）无改动。
- **scaffold 升 v4 + 去过渡措辞**：`project-scaffold.mjs` `templateVersion:3→4` 作为本批新规则锚点（DOC-CONFIRM since:3 仍绑 v3+）；`rule-router.md`、`rule-id-ledger.md`、`rule-ids-and-gates.md`、`msw-manifest.schema.json` 标题去掉「试点/experimental/pilot」过渡态，改口径为强制标准；`architecture-and-state.md §8.4` 收尾为标准路线并指向新范例。
- **补可照抄参考范例**：新增 `templates/msw-handler-template.ts`（场景矩阵 + `xxxHandlers` 导出）与 `templates/msw-mock-contract-test-template.ts`（真实 schema 契约测试骨架），登记进 `check-doc-budget` REQUIRED_TEMPLATES 并由 §8.4.1 / `03-api-contract-template.md` §6.1 引用；manifest 模板仍由 `start-new-project` 自动落。PR-01947 项目文档标注为「§8.4 路线 B 首个固化范例」，历史事实记录不改。
- **生效边界**：改动集中在 ruleset/台账/scaffold/模板 + 规则散文，未新增/改任何检查判定逻辑（`verify-msw-manifest.mjs` 不带 severity，仍由 ruleset 定档）。改 ruleset + gate 脚本触发指纹链失效，收尾走 check → golden → doctor → release 重新发布 L3/effective 链；gate 计数以脚本实时输出为准。

## 2026-08-25（context-budget-v2：细粒度路由、会话去重与 G6 四维协调）

- **默认上下文减量但不降门禁**：场景引用改为章节级有序去重，brief 只折叠逐引用声明为安全指针的机器规则；新增互斥 `--brief|--compact|--full`、场景预算与全场景审计。按 2200 字符摘要上限实测，常规编码默认包中位缩减 60%，所有默认场景均低于 hard limit。
- **去重收窄到真实会话**：删除项目级“已注入”推断；仅当调用方提供 session identity 时，按 project/client/session 隔离并在 24 小时内返回 delta。无 session ID 始终完整报告，两个客户端或任务不能相互复用。
- **G6 拆成四维机器协议**：`g6_verify` 改为只打印计划的协调器，依次加载 code review、contract、visual、delivery；进度绑定 client/session、HEAD、dirty hash、L3/effective 指纹和有效期。乱序、缺维、过期或代码/规则变化均由不可豁免 `VERIFY-RULE-005` 阻断 G6/G6-partial。摘要仅首包加载，四包顺序总量 28723 字符（目标 ≤30000）。
- **可诊断性与阶段摘要修正**：`docs-tdd explain <RULE-ID>` 展开完整规则小节与 Failure 修复命令；修正 G3/G4/G6-partial/失败 gate/G8 的 summary 下一步推导；规则索引、预算与 G6/session 协议均有独立 self-test。

## 2026-08-24（Batch 6b：两个 grandfather gate 脚本物理抽 lib / 折表，全部退出预算 warn 区）

- **`verify-project-gate.mjs` 抽出 13 个文档解析纯谓词到 `lib/gate-doc-parsers.mjs`**：主文件逼近硬闸（53240/58000），把表格/字段正则解析器与基线三分支判定（`parseMarkdownTableRows`、`recordsG2Confirmer`、`featureRowStatus`、`technicalDesign*`、`classifyBaseline` 等，逐字保留、无 disk/git 副作用）物理移入新 lib，随附 34 例 `--self-test`（±锚点守表头列序/占位词漂移）并登记进 `check-doc-budget` 的 `SELF_TEST_SCRIPTS`。主文件 `runSelfTest` 改委托 `gateDocParsersSelfTest()`，只留 10 例有 disk/git 副作用、无法搬进纯 lib 的断言（evidence 目录扫描 / gate 历史 / 阻塞聚合器接线）。`verify-project-gate.mjs` 53240 → 42534（退出 warn 52000 区，距硬闸 ~15k）。
- **`check-doc-budget.mjs` schema 校验块折表去重（DRY）**：项目元数据 schema 校验里 `gate-results.json`/`rule-waivers.json`/`lark-sources.json` 各写一段近乎相同的 `existsSync + try/JSON.parse/validateSchema/catch`，而其下方已有一段 data-driven 表对另 12 个 JSON 做同一件事。把这三个折进那张 `[fileName, schemaKey]` 表（README frontmatter 因走 `parseFrontmatter` 保留特例），删掉 ~27 行重复。`check-doc-budget.mjs` 45102 → 43866（退出 warn 44000 区）。
- **零行为改动**：谓词逐字搬运、schema 校验对象集合与逐项报错口径不变——`docs-tdd check` 全绿（17 个项目 frontmatter + agent JSON schema 校验照旧通过），golden 38/38（含聚合器烟测），doctor error=0/warn=0。改 gate 脚本触发指纹链失效，已重发布（L3 `c531d5f5` / effective `258cc950`）。至此 Batch 6 计划里点名的三个近上限文件（rule-ids-and-gates.md、verify-project-gate.mjs、check-doc-budget.mjs）全部经真实物理抽离退出预算 warn 区，非预算把戏。

## 2026-08-24（Batch 6：warn 生命周期正文归并 rule-execution-model §6，rule-ids-and-gates 退出预算 warn 区）

- **P2「warn-retirement overdue-review」经核对已随远端合入完整落地，非待办**：`lib/warn-retirement.mjs` 的 90 天默认退休（`due-for-retirement` → note-only）已接进 `verify-code-rules`（`demoteRetiredFindings`）、G8 交付摘要（`renderWarnLedgerSection`）与 `docs-tdd rule-health`，state 机（eligible/reviewing/due-for-retirement/watching）+ self-test 齐备。本批不改其代码。
- **物理瘦身（真值源归并，非预算把戏）**：Batch 5 对 `rule-ids-and-gates.md` §2.1/§3.7 的补写把它推到 19942/20000（距硬闸仅 58 字符，任何后续编辑即破线）。把 §2.1 里 warn-first 规则生命周期的操作正文（晋级判据 / 机器台账 `warn-ledger.json` / 90 天退休 / `docs-tdd rule-health` 体检，约 2.2k 码点）**移入 [rule-execution-model.md](./rules/rule-execution-model.md) §6**——该节本就是「新规则准入与复盘」且此前已反向指回 §2.1，归并后 §6 成为唯一真值源、§2.1 收成一行指针。`rule-ids-and-gates.md` 由 19942 → 17897（退出 warn 18000 区，距硬闸 ~2100 余量）；execution-model 5109 → 6827（默认闸 warn 9000，余量充足）。
- **当时暂缓、已于 Batch 6b 补做的两个 grandfather 脚本**：`check-doc-budget.mjs`（45055/48000）、`verify-project-gate.mjs`（53240/58000）本批未动（对核心 gate 聚合器抽 lib 属独立高风险工程），随后在 Batch 6b 完成物理抽离，均退出 warn 区（见上一条）。
- **生效边界**：仅在两份已路由规则文档间搬运操作正文 + 收指针，零逻辑改动；`docs-tdd check` 全绿（rule-ids-and-gates.md 已退出预算告警，311 个本地链接含新指针均解析）、warn-retirement self-test 通过。移动路由规则触发指纹链失效，已重发布（L3 `0834d3ed` / effective `acb28a1e`，doctor error=0/warn=0、golden 38/38）。

## 2026-08-24（Batch 5：maturity 定档引擎接线 + DOC-CONFIRM 晋级新项目 error）

- **maturity 字段被真正消费（此前是未接线的元数据）**：远端合入时给 `ruleset.json` 每条规则加了 `{maturity, blocking, waivable}`（experimental/trial/stable），但所有闸仍只认 `blocking`，maturity 从不参与定档。新建单一 severity 真值源 `lib/rule-maturity.mjs`（`resolveSeverity` + `projectMeetsRuleSince`，带 `--self-test` 全矩阵）：`stable`/`experimental` 按 `blocking` 定档（保持现状）；`trial` 在 `blocking` 基础上再按可选 `since`（规则引入时的模板版本）向下收窄——项目 `templateVersion < since` 时降 warn，即「规则升级默认不回查阻断存量项目」。report-only 与免疫（`waivable:false` / `reportOnlyExempt`）语义原样搬入。
- **行为保持 by construction**：现存 9 条 trial + 15 条 experimental 规则当前都 `blocking:true` 且无 `since`（视作 0）→ `projectMeetsRuleSince` 恒真 → 走原 `blocking`/report-only 分支，与合并后逐位一致。只有本批显式带 `since` 的规则才产生「新项目才阻」。天真按语义映射会把这 24 条正在阻断的规则放松，故引擎只让 `trial+since` 向下收窄，不碰 experimental/stable。
- **两处定档点归一到 lib**：`verify-project-gate.mjs` 的中央 severity 循环、`verify-build-quality.mjs` 的 `VERIFY-TEST-002` 定档（原本地 `strictTestEvidence=templateVersion>=2`）都改调 `resolveSeverity`。DOC-CONFIRM 四条本就流经 project-gate 中央循环，登记后自动重定档。
- **DOC-CONFIRM-001..004 晋级为「新项目 error / 旧项目 warn」**：四条人工确认签名此前硬编码 `warn`、连 `ruleset.json` 都未登记。现登记为 `{trial, blocking:true, waivable:true, since:3}`；`VERIFY-TEST-002` 登记为 `since:2`（吸收 strictTestEvidence，行为等价）。`rule-id-ledger.md` 五行同步 error 级声明（满足 check-doc-budget 校验 5b：error 级 ID 必须声明 blocking+waivable）。
- **scaffold 升 v3 + 落签名槽位**：`project-scaffold.mjs` `templateVersion:2→3`；`stage-status.json`（G5/G7）与 `code-review.json` 补空 `confirmedBy`/`confirmedAt` 槽位（空串经 `classifySignature` 判缺签名，逼真人在处置态转 completed/skipped 时补签）。新建 v3 项目缺人工签名即 error，存量 v1/v2（PR-01947/02074/02172/02265/02273/02306）行为不变。
- **生效边界**：改动集中在定档 lib + 两处接线 + ruleset/台账/scaffold；未新增/改任何检查逻辑，仅把 severity 口径归一并借 since 让 DOC-CONFIRM 只阻新项目。改门禁脚本 + ruleset 触发指纹链失效，收尾走 check → golden → doctor → release 重新发布 L3/effective 链。

## 2026-08-24（Batch 4：codeRules 文件级归因硬闸 + lark 配置启动校验）

- **codeRules 从纯尺子升为「本次改动引入的 error 才拦」的窄闸**：`lark-code-rules.mjs` 的 changed-file 静态扫描此前明确「不阻断、人来决定回炉」，但 bot 完成后是自动 commit 进分支——「人会在合入前看那行数字并拦下」这个前提在无人值守下不成立，带 error 的改动可能静默进分支。修法保留初衷里两条硬理由、只修正定位：`summarizeCodeRules` 暴露 error 级 finding 的 `{ruleId,file,line}`，新增纯函数 `codeRuleErrorsInDiff({summary,changedFiles})` 只挑「文件 ∈ bot 本次实测改动清单」的 error（文件级归因），task-runner 命中即降级 failed（与失效裸色类硬闸同一路径与立场）。**责任模块存量债不碰、`ran===false`（缺 rg/离线/超时）恒不阻断**——避开 verify-code-rules 项目级口径的误伤（同 VERIFY-TYPE-001 文件级归因的教训）。
- **lark-bot 配置启动期结构校验**：`loadConfig` 此前只 `JSON.parse`，bugTable 缺 appToken/tableId 等要拖到首轮轮询才炸。新增纯函数 `validateConfig`（不引 ajv，手写守卫贴合固定形状）+ `assertConfigOrExit`：`project` 必填、白名单/数组字段类型校验；**bugTable 配了就得配全 `appToken/tableId/statusField/assigneeField`**（缺任一 poller 会静默拉不到或回写打到空字段），`doneValue` 缺失有优雅降级故只告警；`botOpenId` 缺失只告警（有只读降级兼容）。gateway 与 bugtable-poller 启动即 fail-closed（poller 另将 bugTable 视作刚需）。
- **现状核对结论（不重复造轮子）**：Batch 4 计划里的「bugtable 回写对账 + retry writeback-only 模式」经核对已随既有 `resolveWritebackOutcome`/`retryPendingWriteback`/`done_pending_writeback` 状态机完整落地（12 次上限 + gaveUp + health 持续告警 + 达上限不落 done），非待办。
- **生效边界**：全部改动在 `common/lark-bot/` 子系统，不触碰 L3/effective 指纹规则链（doctor error=0/warn=0）。lark 单测 276/276（新增 codeRuleErrorsInDiff/buildCodeRulesBlockedResult 6 例、validateConfig 9 例）；真实 `lark-bot.local.json` 过 `validateConfig` 零 error/warn，不影响运行中的 bot。

## 2026-08-24（Batch 3 现状核对：lark 写接口鉴权已达成安全目标，不新增 ACL）

- **核对结论**：P0-C（lark-bot 鉴权/ACL）的实质内容已随 `a3ecde8`「lark 写接口强制鉴权」落地并在 live bot 跑通，非待办。逐项：①密钥已就位——`~/.config/fameex-lark/gateway-secret`（0600）经 wrapper export `LARK_GATEWAY_SECRET`，gateway 从 env 读；②缺密钥拒启 + 删短路——`lark-gateway.mjs` 无密钥即 `process.exit(1)`，`lark-routes.mjs` 所有 POST 与 `GET /lark/tasks` 强制校验（`GET /lark/health` 匿名探活）；③`@所有人` 与「无 botOpenId」兼容分支收紧为只读 `task_mention`，不再直接入队改代码；④启动 `hardenRuntimeFiles` 把运行时 JSON 收 0600。live 校验（port 3005）：不带密钥 `POST /lark/tasks/prune`、`GET /lark/tasks` 均 401，匿名 `GET /lark/health` 200。lark 单测 262/262 覆盖上述触发/白名单判定。
- **不做 W3.3（运维端点加 operator ∈ allowedOpenIds）**：与锁定的「写任务维持群信任」冲突或纯冗余——①所有 POST 已强制密钥，`retry/prune/reopen` 早已满足计划里「或仅接受带 secret 的本机调用」这一支；②`retry/prune` 是带密钥的 CLI 运维命令、请求体无 operator 可查，边界本就是密钥；③`reopen` 由 poller 从 QA 验退触发，operator 是群里 QA/PM（未必在 allowedOpenIds），要求 operator ∈ allowedOpenIds 会挡掉正当验退，正是群信任要保护的场景。故判定 Batch 3 已达成安全目标、无需新增代码。

## 2026-08-24（三个执行器的豁免套用口径统一到 waiver-policy）

- **口径分裂**：`verify-project-gate` 通过 `classifyWaiver` 只让「生命周期 active」（具名 + 有理由 + ISO 期限且未过期）的 waiver 生效，缺 owner/reason 会判 `DOC-WAIVER-002` 不套用；但 `verify-build-quality` 与 `verify-code-rules` 各自的 `applyWaivers` 只校验 `ruleId + expiresAt 存在且未过期`——**缺 owner/reason 的残缺 waiver 仍会静默把它们的 error 降级**。同一份 `agent/rule-waivers.json`，project-gate 拒收的条目却能豁免掉 biome/tsc/vitest 或静态扫描的红。
- **修法**：`waiver-policy.mjs` 抽出共享 `activeWaivers(waivers, today)`（筛 active 生命周期）与 `isWaived(active, {ruleId, file})`（ruleId 必配、`waiver.file` 存在时精确匹配），三个执行器一律改调它。`verify-code-rules` 的 `--waivers <path>` / 本地 `agent/rule-waivers.json` 双路径解析、`verify-build-quality` 的本地路径解析都保留，只把「哪些 waiver 算数」这层判据收敛为单一真值源。
- **生效边界**：仅收紧（残缺 waiver 不再意外生效），不放宽任何豁免。实测存量 4 个项目 15 条 waiver 字段齐备且未过期，零行为回归。台账 error 级 ID → ruleset `waivable` 声明的反向一致性守卫（check-doc-budget「ruleset 声明完整」）此前已到位并通过。`waiver-policy` self-test 补 `activeWaivers`/`isWaived` 正反例；两执行器 self-test（49+22 / 34 例）通过、golden 32 项通过、lark 262/262。

## 2026-08-24（堵掉 G8 构建质量整层跳过的后门）

- **漏洞**：`run-project-gate.mjs` 的 `--skip-build-quality` 只要带一句自由文本 `--skip-build-quality-reason` 就把机器事实层缺席守卫 `VERIFY-BUILD-001` 降成 warn（不挡 `payload.ok`）。在 G8 交付闸这意味着随手写句理由即可整层跳过 biome/tsc/vitest **和** production build，连证据都不留。
- **修法（只堵洞，不建审批机制）**：`buildQualityGuardCheck` 加 G8 例外——G8 上带理由整层跳过一律判 error（无理由本就 error，不变；G6/G7 带理由仍降 warn 留痕，不变）。正当出口不是「换个更重的跳过审批」，而是**实跑 verify-build-quality**、若唯独 production build 过不了再在 `agent/rule-waivers.json` 具名豁免 `VERIFY-PROD-BUILD-001`（该条维持可豁免）——这样 biome/tsc/vitest 证据照样产出，只有 build 子项被具名带期限地豁免。
- **生效边界**：判定收在 `lib/gate-payload.mjs`（补 self-test：G8 带理由跳过仍 error），主脚本零改动；`VERIFY-PROD-BUILD-001` 不翻转（承接上一条 2a 里预留的决定）。ledger 的 `VERIFY-BUILD-001` 行标注 G8 例外。

## 2026-08-24（阶段顺序完整性收口：前置 gate PASS 历史不可豁免）

- **`VERIFY-STAGE-001/002/003` 由可豁免收成不可豁免**：这三条查的是「进 G6/G7/G8 前，`gate-history.json` 里有此前真实写入的 G5/G6/G7 PASS」——即阶段顺序的完整性锚点。此前它们在 `ruleset.json` 声明 `waivable:true`，意味着一条具名 waiver 就能跳过「前一阶段真的过了」这件事，让当前阶段自证交付（G8 直接自证、不要求 G7 真过）。收成 `waivable:false`：前置只能**补跑**、不能豁免，与已是不可豁免的 `VERIFY-STAGE-004`（G6-partial 的 G4 前置）同一立场。
- **为什么安全**：改前实测无任何项目对这三条挂过 waiver，翻转不改变任何现有项目的判定结果。正当的联调/风险出口仍在——那是 `DOC-ASSUM-*`/`DOC-BLOCK-002` 的可豁免销账与 G6-partial 停靠态，而不是伪造「前一阶段过了」。
- **生效边界**：仅收紧豁免面，不新增/改任何检查逻辑。`rule-id-ledger.md` 三行标注同步为「不可豁免」；`check-doc-budget` 的「ruleset 声明完整」守卫通过、golden 32 项通过。`VERIFY-PROD-BUILD-001`（G8 production build）暂不翻转——它的非豁免形态需要配套「结构化构建质量审批」出口，留待下一批。

## 2026-08-24（G6-partial 收口：公共入口透传 + 台账 partial 感知 + 决策/schema 对齐）

- **公共入口漏传 `--partial`（真机缺陷）**：`docs-tdd gate <PR> G6 --partial` 经 `docs-tdd.mjs` 分发时未把 `--partial` 透传给 `run-project-gate.mjs`，于是用户以为做了部分验收、实际跑的是完整 G6 并被 `VERIFY-STAGE-001`(G5 PASS) 前置挡下。补透传，且 partial 运行**不播报**「G6 通过」（免群里误读为完整通过）。
- **假设台账 / 阻塞登记在 partial 下不感知**：`assumptionChecks` / `blockerChecks` 此前无视 partial，等接口的 open 假设与后端未就绪的 open 阻塞会在 G6-partial 里照旧判 error，把停靠态本该放行的项挡下。现按单点判据 `isPendingReconcileAssumption`（open 且轴 ∈ api-ready/reconciling）/ `isPendingReconcileBlocker`（open 且 category=backend）记「待对账」不阻断；非接口类 open 假设、非 backend 阻塞仍是硬 error；完整 G6/G7/G8 一律照旧卡销账。判据收在 `lib/gate-partial.mjs`，assumption-ledger / blockers 只 import。
- **`next`/`resume` 决策不认 `G6-partial`**：`project-decision` 的 `gateNumber` 正则 `^G([0-8])$` 匹配不到 `G6-partial`，PASS 时会落 `run_next_gate` 空命令。新增独立分支：PASS → `waiting_reconcile`（下一步明确为 `docs-tdd gate <PR> G6` 真实字段对账后重跑完整 G6），FAIL → `blocked`（重跑 `--partial`）。
- **schema 与写入端对齐**：`gate-results.schema.json` 的 `gate` 由 pattern 收成 enum（含 `G6-partial`），显式声明 `partial` 字段并加 `gate=G6-partial ⇔ partial=true` 一致性约束；`verify-project-gate.mjs --write` 补写 `partial`（此前只有 `run-project-gate.mjs` 写，两写入端口径不一，partial 运行产出的 gate-results 缺字段）。
- **golden 端到端对照**：新增两条共用同一 setup（G4 PASS 历史 + 一条等接口 open 假设 + 一条后端 open 阻塞）的用例——`--partial` 放行（gate=G6-partial、ok、两条记待对账、落 VERIFY-G6-005）、完整 G6 恰好由这两条判 error 阻断。golden-run 支持按用例传 `--partial`。
- **生效边界**：只收口既有 G6-partial 能力、不放宽任何 gate；各 lib self-test（gate-partial / assumption-ledger 24 例 / blockers 20 例 / project-decision 8 组）通过、golden 32 项通过、`docs-tdd check` 通过。

## 2026-08-24（快速通道从类别封禁改为风险分级 + 临时业务契约机器化）

- **修正过粗的 G2 门槛**：原规则把权限、金额精度、状态机、路由、核心交互整体视为 G2 blocker，混淆了“业务语义未决定”和“语义已定但接口/环境未就绪”。现改为三轴判定：`semanticStatus`（confirmed/provisional/undecided）× `impact`（local/cross-cutting/irreversible）× 类别；只有高风险语义仍 undecided，或未决项跨模块/不可逆时阻断 G2。Mock 可以替代不可用系统，不能替代业务决策。
- **新增显式 opt-in 台账 `agent/fast-track.json`**：选择快速通道才从 `templates/fast-track-template.json` 创建，普通项目零回填。`route`、真人签名、临时契约、安全降级、owner、最迟销账 gate 与证据均结构化；`DOC-FAST-001..005` 分别校验结构、人工确认、高风险未决项、临时护栏和到期未销账。字段/权限/金额/状态最迟 G5，视觉/路由/核心交互最迟 G6，其他项最迟 G8。
- **允许安全占位，不允许假业务默认**：权限未知默认拒绝，金额规则未知显示 `--` 并禁提交，未知状态不开放动作，正式路由未知只走 dev-only 入口，核心流程未知只做无副作用原型。高风险项若有负责人签认的可逆临时契约可继续 G0→G4；无决策仍停 G2。
- **执行链**：新 schema 纳入全项目元数据检查，gate cache/changed fingerprint 纳入台账；判定收敛到 `lib/fast-track-policy.mjs` 自测，并补 golden 变异覆盖“未决金额挡 G2”和“临时决策到期挡 G5”。
- **对齐 G6-partial 停靠出口（补 `reconcileWith`）**：`pending-api` 项目的终点是 G6-partial，但原 `DOC-FAST-005` 不感知 `--partial`，会把等真实接口对账的到期项在部分验收时硬卡，与“不要空等”的初衷相悖；同时类别销账上限一刀切 G5，使高风险 `provisional` 项被 G5 上限与 G6-partial overdue 两头夹死。现给每项加 `reconcileWith`（`api`/`decision`）：`--partial` 下 `api` 类到期项转待对账 warn、`decision` 类仍硬阻断（partial 不是逃逸口）；`pending-api` 路由下 `api` 项销账上限放宽到 G6。待对账判据收敛到 `lib/gate-partial.isPendingReconcileFastTrackItem`，并补 golden G6-partial 正反对照用例。

## 2026-08-23（文档一致性收口 + 可移植性说实话 + lark 完成卡挂静态尺子）

- **交接文档保鲜（`DOC-FRESH-001`，warn）**：根目录 `HANDOFF-*.md` 曾长期躺着一份「方案已获批准、尚未实现」的交接（实际工作早已落地），没人负责删、也没有机制点名。`check-doc-budget.mjs` 新增校验：根目录 `HANDOFF-*.md` 若最后提交日（`git log -1 --format=%cs`，不看 mtime——clone 会重置 mtime）超过 7 天即 warn（对齐 `DOC-PRD-010` 的 >7d 先例），提示「交接完了就删、没完就更新状态或移进 `prds/<PR>/`」。同步删掉那份过期交接。
- **可移植性说实话**：README 首句原写「与业务仓库解耦，可挂载任意前端项目复用」，但引擎里仍散着 FameEX 具体锚点（`docs-tdd.config.default.json` 的 `@fameex/web` 构建 / `@fameex/ui` 别名、`agent-rule-adapters.mjs` 的 "FameEX Local Execution Protocol" 字面量、多份规则文档的绝对路径示例、消费仓 `.cursor/rules` 依赖）。改为「目前只在一个仓库真实验证过，移植到第二个仓库需改这些锚点」并新增「可移植性的真实边界」小节，把移植必改项列成检查表（配置默认值 / Agent 适配器文本 / 规则文档示例 / 消费仓 L2 依赖 / lark 本机约定）。**未做**抽 `adapters/<consumer>/`：在出现第二个真实消费仓前不造这层抽象。
- **lark 完成卡挂 changed 静态尺子（D5，非阻断）**：`common/lark-bot/**` 此前从不跑 `docs-tdd changed`，bot 改的代码踩没踩规则只有 bot 自己知道。新 `lib/lark-code-rules.mjs`（纯判定 + lark-pure 单测）在完成前用与人类同一把尺子（`verify-code-rules.mjs --project <ID>`）跑一次，把 error/warn 计数与命中规则 ID 附到完成卡「系统实测」栏。**不阻断**——bot 的硬闸只有规范闸（失效裸色类）一道；跑不成时如实写「未跑成 + 原因」，绝不渲染成零违规。不走 `docs-tdd changed` CLI 是因为那条入口要求编码 rule session，而 lark 按设计不签会话（改为每任务注入规则章节），走 CLI 只会让每张卡挂一条无信息量的会话缺失 FAIL。
- **lark 提交带机器锚点**：收尾提交正文加 `lark-task: <id>` trailer（标题 `[<id>]` 给人看，trailer 供 `git log --grep '^lark-task: <id>'` 把群内反馈精确对到提交）。lark 单测 261/261。
- **lark 只读查询词表补「汇报/报告」（真机漏判修复）**：端到端演练时「汇报一下这个项目的状态」被判成新需求拦在 `waiting_confirmation`——`STATUS_QUERY_CUE_RE` 只收了「汇总」漏了「汇报」。补齐 `汇报/报告/说一下/说说/讲一下/介绍/report` 等同义查询信号，仍受「缺陷信号 / 写操作动词一票否决」双闸约束（补反例单测：「汇报下为什么…转圈」「新增…汇报页面」仍判 null）。
- **lark `no_change_needed` 边界收紧**：worker 提示词与文档原写「需求属后台 API / 别的仓 / 别的职责」，同一 monorepo 内的另一个前端 app（如 admin / futures-admin）可能被「别的仓」误导成不属本仓而被踢走。改为明确「判据是**不属本 git 仓库**、不是不属本前端 app」——同仓另一个 app/package 仍是本仓可改、应直接实现（范围不清则 `waiting_confirmation`）。lark 单测 262/262。

## 2026-08-23（人工确认终于有地方签名：`DOC-CONFIRM-001..004`）

- **「以人工确认为锚点」此前在机器侧不存在**：README 人机分界写着 G5-G8 的真实联调、视觉还原、交互手感、QA 用例执行以人工确认为锚点，但 `stage-status.schema.json` 的 required 只有 status/reason/evidence/updatedAt 且 `additionalProperties:false`——连写 `confirmedBy` 的地方都没有；`acceptance-results.json` 的 `manual`/`manual-visual`/`browser` 项与 `code-review.json` 同理。结果是 Agent 自己把 G5 写成 `completed`、自己把人工验收项写成 `passed`，gate 只能校验结构与证据路径存在，**无法区分「人看过」和「AI 声称人看过」**。
- **修法**：三份判断层 schema 各加可选 `confirmedBy` + `confirmedAt`（`YYYY-MM-DD`），判定收进新 `lib/confirmation.mjs`（纯函数 + self-test，23 例）：`DOC-CONFIRM-001`（G5 的 `completed`/`not-applicable`/`frontend-complete-pending-reconcile`）、`DOC-CONFIRM-002`（G7 的 `completed`/`skipped`）、`DOC-CONFIRM-003`（`manual`/`manual-visual`/`browser` 的 passed 项逐条，这三种没有机器退出码兜底）、`DOC-CONFIRM-004`（`code-review.json` 的人工签收——`reviewer` 记的是谁做的 review，通常就是 Agent 自己，不能兼任签收）。`pending`/`blocked` 与非人工判定方式不发 check（还没到人确认那一步）。
- **AI 不能代签**：`classifySignature` 把 AI 客户端名（codex/claude/cursor/…）与 `TBD`/`N/A`/`unknown` 等占位符判为 `agent`，不算人工确认——这正是本规则要防的主要形态。只按独立词匹配，`aichen`、「cursor 组的 aven」不误伤。
- **生效边界**：四条全部 **warn**，不阻断任何现有交付。晋级路径与 `VERIFY-TEST-002` 同型（新模板 error / 旧项目 warn）：签名字段进模板骨架、且有一个真实项目 G5→G7 全签过一遍后转 error，存量项目走 waiver。骨架不预写空签名（`minLength:1`，占位符也会被判 `agent`），缺签名由 gate 逐条点名。当前 PR-02306 四条全 warn 且未代签，`docs-tdd check` 通过、golden 30 条变异用例无变化、lark 单测 256/256。

## 2026-08-23（豁免到期真的失效 + warn 观察期的默认结局是退休 + `docs-tdd rule-health`）

- **失效豁免从 warn 提到 error**：判定收进新 `lib/waiver-policy.mjs`（唯一语义源 + self-test）——缺 `reason`/`owner`/`expiresAt` 之一或 `expiresAt` 非 `YYYY-MM-DD` → `DOC-WAIVER-002` error；已过期 → `DOC-WAIVER-003` error 且原规则照旧阻断；文件非法 JSON/非数组 → `DOC-WAIVER-001` error。为什么是 error：失效豁免本来就套不上（原规则照旧红），这一档追加的是**清理台账**的压力——用 warn 表达时「还没写全」和「已经过期」都指向「不用管」，台账只会越腐化；出口很便宜（续期、补 owner/reason、或删掉）。`DOC-WAIVER-004`（命中 non-waivable 规则）仍是 warn：那类条目多是给 `verify-code-rules` 写的，那边不读 `ruleset.json`，判 error 会误伤。存量 4 个项目的 15 条豁免全部字段齐备且未过期，本次不新增任何红。
- **warn 观察期有了默认结局：退休，而不是永久 warn**。晋级判据要求人工裁决，而裁决可以永远不发生——台账 12 个格子曾全是 `unreviewed`，`eligible = TP>=2 && FP===0` 因此永远算不出来，规则实际停在「天天刷 WARN、没人负责、也永不晋级」。新 `lib/warn-retirement.mjs` 给它一个终点：某规则首次命中起满 **90 天且一次裁决都没有** → 自动降 `note`（`verify-code-rules` 不再报 WARN、也不再累计入台账）并列入待退休。**沉默 = 撤下**；想留下它只需裁决一次（`warn-ledger.mjs --mark <RULE> <PR> true-positive --write`）。当前 4 条在账规则首次命中都是 2026-08-03，到期日 2026-11-01，故本次零行为变化——机制先立，钟表开始走。
- **Top-N 高频 warn 打进 G8 交付摘要 §5**：台账文件没人主动打开，交付摘要那一页是每次 G8 必读的，所以「谁最吵 / 谁待退休 / 谁够格提 error」直接渲染在那里（`lib/delivery-summary.mjs` 调 `renderWarnLedgerSection`）。
- **`docs-tdd rule-health`（新命令）**：`rule-execution-model.md §6` 那条「每月/每 5 个项目做一次规则体检」此前零工具零记录，131 个规则 ID 从未退休过一个。现在一条命令给出①warn 台账逐条（累计命中/PR 数/首末命中/裁决分布/结局与到期日）②门禁命中分布（各项目 `gate-results.json` 的**最近一次**运行，快照非终身累计，口径写在输出里）③零命中清单（当前 145 条声明 ID 里 115 条没咬到任何东西）。报告只摆事实不代人拍板：零命中既可能是预防型规则场景没发生（正常），也可能是判定形同摆设（该删）。
- **生效边界**：新增 3 个门禁 golden 用例/自测（`waiver-policy`、`warn-retirement`、`unowned-waiver-is-error`），不放宽任何既有 gate；`docs-tdd check` 通过、golden 32 项通过、lark 单测 256/256。

## 2026-08-23（G5 停靠态有真实出口 G6-partial + 快速通道分两个终点 + 自报阶段下移打标）

- **G5 停靠态终于有出口**：`frontend-complete-pending-reconcile` 此前只是个「更准的 blocked」——前端做完、静态与实现质量本可判定，却因为不放行 G6 而整段悬空，停靠期的真实工作量在索引里等于零证据。新增 `run-project-gate <PR> G6 --partial`：biome/tsc/vitest/code-review/静态规则**照跑照判**，只有依赖真实字段的 `contract`/`browser` 验收项记 pending-reconcile（`DOC-AC-007` 逐条点名欠账、`VERIFY-G6-005` 标本次为部分验收）。语义收在新 `lib/gate-partial.mjs`（单一真值源 + self-test），`verify-project-gate` / `run-project-gate` 只做接线。
- **partial 为什么是独立 gate 标签而不是「宽松的 G6」**：结论以 `G6-partial` 入 `gate-history.json`，于是 `hasPassedGate('G6')` 恒为 false → G7 天然被挡，不需要再写一条「partial 不算 G6」的规则去防自己；同时 `--partial` 下不跑 `set-project-stage`，README 的「最新通过门禁」不推进（只刷索引让它显形）。前置由 `VERIFY-STAGE-001`(G5 PASS) 换成 `VERIFY-STAGE-004`(G4 PASS)，且该条**不可豁免**——partial 已经放宽了一层前置，若剩下这层也能豁免它就成了无边界后门，出口是补跑那个很便宜的 G4 文档 gate。`method` 不是 contract/browser 的 blocked 项照旧 fail（已在 PR-02265 实测：`manual-visual/blocked` 的 AC-4/AC-13 仍被 `DOC-AC-003` 咬住）。
- **快速通道写清两个终点，不再只有「停靠」一种命运**：`fast-track-incomplete-docs.md` 新增 §0.1——接口 100% 已存在（`reuse-api`）就在 G5 当场对账、正常推进到 G8，接口未就绪（`pending-api`）才走 G6-partial 后停靠。此前全文默认所有快速通道项目都停 G5，导致「PRD 有了、文档没齐、但接口本来就在」这类最常见的情况被无谓地悬在 G5 等文档——而对账要的真实响应当下就能取到。出口结论在 G2 一并确认，写进 `06-collaboration.md`，便于交付时复核「为什么这个项目能直达 G8」。
- **自报阶段打标下移到 G2**：`legacyAwareStatus` 原先只查 G5+，G2-G4 声称什么就显示什么。现无同阶段真实 PASS 历史即打标——G2-G4 记 `self-declared`（gate 从 G2 起就该跑，没跑就是没跑，出口是补跑而不是改 README），G5+ 沿用 `legacy-unverified`（多为机制上线前的旧项目）。G0/G1 不打标：按 `workflow-gates.md`，项目 gate 从 G2 起才要求逐阶段跑。本次显形 PR-01947 / PR-01973 两个自报 G4。
- **生效边界**：只加检查与标记，不放宽任何既有 gate；`docs-tdd check` 24 项通过、golden 31 项通过、lark 单测 256/256。



- **自动提交从「隐含约定」收敛为可直测的策略函数**：新增 `lib/lark-commit-policy.mjs`（`resolveCommitMode` / `partitionScopedPaths` + 13 例 self-test）作为唯一裁决——只读或任务未完成 → `none`；隔离临时 worktree（bot 自己开的 hotfix 分支）→ `auto` 全量提交；命中人类已有 worktree → `scoped`，**只**提交本任务实测改动清单里的路径。理由：WIP 路由检查只发生在任务开始前，而 AI 可跑 30 分钟，期间人在同一 worktree 新写的文件会被 `git add -A` 一并扫走。收尾时才出现的路径进 `unexpected` 写进完成卡请人确认，既不入库也不静默丢弃。三种模式都不 push、不开 PR。
- **顺带修掉一个真 bug**：`paths: []` 在 `paths?.length` 下为 falsy，`commitAll` 会**回落到全量 `git add -A`**——即「实测清单为空」这个最该保守的场景反而提交得最多。守卫上移到调用之前，并补 5 个真 git 级用例（定向提交 / 人类 WIP 被排除且进 `unexpected` / 空清单一个都不提交且 ok=false / 无改动 / git 读不出来）。
- **续跑意图补第 ⑤ 类**：话题内直接发补料时 Lark 既不带 `reply_to`、`root_id` 也只指向原 @ 消息本身（而 `task.id === messageId`），此前只认「root_id 命中机器人回执卡」→ PR-01947 的补料落空、原任务空等 3.5 小时。现 root_id 命中**仍处 `waiting_confirmation`/`blocked` 的任务 id** 亦算续跑；收窄点是「仍卡着」，已完成话题的新消息照旧按新任务处理。
- **项目归属：正文唯一命中优先于群名**（`matchProjectIds`）。共享群里群名带 PR 号、正文明确写另一个工单时，原口径会把任务错投到群名项目。仅当正文命中**恰好一个**项目号时才越过群名，多个或零个仍回落群名——用唯一性做裁决，不在「群名权威」与「正文权威」之间二选一。
- **`MODIFY_INTENT_RE` 补词表**：位置/命名/列增删/排序/显隐/文案样式这类自带规格的增量（「挪到」「重命名」「置灰」「加一列」…）此前落进 `requirement` 兜底，每次都要人放行一遍才肯动手。现归 `bugfix` 走快车道。
- **回写耗尽不再假落 `done`**：`resolveWritebackOutcome`（纯函数，三出口）+ `writebackGaveUp` 标记。到重试上限后任务**停在 `done_pending_writeback`**——落 `done` 会让「群里说完成、bug 表还挂着待处理」这个不一致当场消失（`done` 会被每小时终态清理抹掉、health 计数也不再点名），只剩一条没人回看的日志。现 `/lark/health` 区分「正在重试」与「已停止重试、需人工改表格」。
- **文档补真实终态并收口**：`task-boundaries-and-reply.md` §1 生命周期表补 `done_pending_writeback` / `no_change_needed`（后者是**非完成态终局**）+ 「回执卡二选一」（`no_change_needed` 绝不复用绿色完成卡）+ `done_with_warnings` 只是 AI 侧状态的说明；§3.2 落 `auto/scoped/none` 表；§3 与 `collaboration-and-notifications.md` §4 的高风险动作清单移除 `commit`（本地 commit 是既定行为，push/PR 才需确认）；清掉规则链 stale 的旧 fail-closed 表述残留（`rule-id-ledger.md` / `rule-execution-model.md` / health 文案，均以 d533eb4 的分层口径为准：仅常驻必需规则缺失才阻断）。
- **生效边界**：全为 lark-bot 运行时与文档，不改 gate 判定；lark 单测 256/256。

## 2026-08-23（假设台账真阻断 + 豁免默认拒绝 + lark 写接口强制鉴权）

- **根因（假设销账三重削弱）**：`DOC-G3-IMPL-006`（无阻断假设）早已实装，但对任何项目都不阻断，因为三条削弱叠加：① `ruleset.json` 里 `blocking:false` 被无条件降 warn；② 阻断轴取自 MSW lifecycle 而非 gate——`mock-active` 项目的 open 假设连 warn 都不产生（PR-02074 7 条 open 全静默），`blockingWhen:'release'` 在 G8 完全没有钩子；③ `gatePolicy.currentTouchedRules:"report-only"` 把全部已登记规则无条件降 warn。三条必须一起改，单改任一条都不生效。
- **修复**：新增 `lib/assumption-ledger.mjs`（阻断轴的单一语义源 + self-test，`verify-msw-manifest` 改调同一 lib 消除两处真值）；`verify-project-gate` 的 G5/G6/G7 按 `api-ready|reconciling` 轴、G8 追加 `release` 轴阻断，规则号 `DOC-ASSUM-001`（G5-G7）/ `DOC-ASSUM-002`（G8）；`DOC-G3-IMPL-006` 晋级 `blocking:true`（trial）。销账 = 改 `status` + 写 `resolution`；确需带风险交付走 `rule-waivers.json` 具名带期限豁免，**不得把 status 谎报成 confirmed**。`blockingWhen:'prd-clarify'` 仍永不阻断（沿用既有设计，走 blockers.json）。
- **豁免默认拒绝**：此前 `ruleset.json` 只声明 25 条规则，而判据是 `rule?.waivable === false`——**未登记的规则一律落进可豁免分支**（`DOC-G2-*`/`DOC-SYNC-*`/`VERIFY-G8-*` 都能被豁免掉）。现补齐到 106 条声明（30 条 `waivable:false`），判据改 `waivable !== true`（未登记 = 不可豁免），并加 `check-doc-budget` 校验 5b（`lib/rule-ledger.mjs`）反向锁死：台账里每个 error 级 ID 必须在 ruleset 声明 `blocking`+`waivable`。同时修掉校验 5 的正则漏网（多段 ID 如 `DOC-G3-IMPL-006` 此前从未被登记校验，现 140 个脚本 ID 全覆盖）。豁免只对「失败且仍是 error」的检查生效，不再对永久 warn 规则刷 `DOC-WAIVER-004` 噪音。
- **report-only 语义收紧 + 补文档定义**：`waivable:false` 或 `reportOnlyExempt:true` 的规则免疫项目级 report-only 降级（`DOC-ASSUM-001/002` 属后者：需保留具名豁免出口，故不能靠 `waivable:false` 取得免疫）。`legacyRules` 的定向降级必须排在 ruleset 定档之后（否则 `DOC-G3-001..007` 登记 blocking 后会被推回 error，影响 PR-02172）。`rule-ids-and-gates.md` 新增 §4.1 定义两个开关的分工——report-only 回答「这批规则本项目还没接」，豁免回答「这一条我知道且我担责」。
- **lark 写接口鉴权由「可选」改硬前置**：此前 401 分支带 `gatewaySecret &&` 短路且本机未配密钥 → 本机任一进程可 POST 触发改代码 / commit / prune / reopen。现 gateway 缺 `LARK_GATEWAY_SECRET` 直接 `exit(1)`（同 `isWhitelisted` 的 fail-closed 立场），`GET /lark/tasks`（返回工单正文/附件路径/内部分支名）一并鉴权，只有 `/lark/health` 可匿名探活；密钥落 `~/.config/fameex-lark/gateway-secret`（0600，**不写 plist**）。`runtime/*.json` 写入带 `mode 0o600`，启动时对历史 0644 统一 chmod 并告警。
- **`@所有人` 不再直接入队**：降级到与 `@负责人` 同档的只读意图分类（群里喊一句全体通知不等于授权改代码）；未配 `botOpenId` 的旧兼容分支同样收紧。
- **刻意不做**：运维型端点（retry/prune/reopen）的用户级 ACL。核查后 retry/prune 只能从 `~/.local/bin/lark-bot` 发起、reopen 只能从 poller 发起，强制密钥之后再加 openId ACL 不增加边界，反而会挡住本机 `allowedOpenIds:[]` 下的 QA 验退。

## 2026-08-11（lark-bot 运维手册归位 lark-bot 子树 + 主题拆分 + 脱离规则指纹）

- **根因**：`common/rules/lark-bot-gateway.md` 本质是 bot 服务运维手册（网关 HTTP 契约 / worker / bug 表 / 长连接 / 调度），却被误分类进 rules 层——既是唯一超 doc-budget 告警线（17449 字符，靠 `DOC_BUDGET_OVERRIDES` 压着）的文件，又被卷进规则指纹链（改一行运维文档就触发 golden-run 重发布）。
- **归位 + 拆分**：删除该文件，迁入 `common/lark-bot/docs/`，按主题拆为 `README.md`（索引）+ `gateway-and-worker.md`（管道接线）+ `task-boundaries-and-reply.md`（AI 执行边界/完成回复格式）+ `runtime-and-scheduling.md`（长连接/bug 表/并行调度），各文件远低于默认预算线。去重：卡片格式/圆角 token 不复述，保留指针到 `lark-active-notification.md`、`ui-style-token-rules.md`。
- **脱离规则体制**：新路径落在 lark-bot 子树 → 被 `rule-release.isLarkPlumbing` 排除出指纹、不在 `check-doc-budget` 的 `RULES_DIR` 扫描范围，故删除对应 `DOC_BUDGET_OVERRIDES` 条目。权衡：失去规则层 budget 上限与「必须被 index 收录」保证，用 `docs/README.md` 索引 + `common/README.md` 子系统指针弥补导航——刻意为之，运维手册不受编码规则体制约束。
- **生效边界**：唯一影响行为的改动是 `lark-worker-prompts.mjs` 注入 worker 的文档由整本手册收窄到 `task-boundaries-and-reply.md`（减少 token 噪声，只留执行边界）。其余为链接/注释重定向（`collaboration-and-notifications.md`、`lark-active-notification.md`、`lark-doc-sync.md`、`rule-inheritance.md`、`rule-index.json`、3 个项目 `lark-integration.md`、`common/README.md`、两处代码注释），及收敛 PR-01947 README 误放的系统级触发描述为指针。

## 2026-08-10（群内 @负责人代理触发自动任务）

- Gateway 支持本机 `taskMentionOpenIds`：群消息仅 @Aven、未 @bot 时先持久化为 `received`，普通群聊在成员查询、附件下载和 AI 调用之前本地过滤。
- Worker 增加严格只读意图分类：bug / 明确需求且置信度不低才正式排队并发领取卡；普通聊天静默落 `ignored`，分类器异常落 `intake_failed`，两者都不会进入 worktree 或修改代码。
- 分类沿用任务选择的 Claude/Codex；Claude 仅开放 Read + plan 权限，Codex 使用 read-only + network off。结论与 CLI 输出保留审计，兼容 Claude CLI 把 Schema JSON 置于 `result` 或完整 JSON 代码围栏的真实返回。
- 全量消息下显式丢弃 `sender_type=bot`，防机器人自己的 @Aven 卡片回流；分类回写对同一结果幂等，发领取卡瞬时失败后可重试且不覆盖已决策结果。当前应用已授 tenant 级 `im:message:readonly`（获取群组中所有消息），`grant_status=1`。

## 2026-08-10（Lark Bug「验退」自动进入下一轮修复）

- Poller 从只查「待处理」扩为同时查询配置的 `rejectedValue:"验退"`；验退会忽略旧 seen，把同一 record_id 的既有终态显式重开，活动态/等待态仍去重，避免每轮重复入队。
- Gateway 新增 QA return 重开路径：上一轮结果进入 `executionHistory`，`qaReturnCount`/`epoch` 换代，最新表格内容与上一轮结论一并交给 AI，要求先分析未解决根因再修复。
- 临时 worktree 在验退轮次复用原 hotfix 分支 tip，不再用 `-B origin/online` 丢掉上一轮提交；Worker 审计文件名加入 epoch，多个修复轮次各自保留。配置已加入 `rejectedValue:"验退"`。

## 2026-08-10（Lark PRD 远端内容漂移门禁）

- **事故根因**：PR-02265 在 2026-08-07 首次同步后，PM 又更新了 Lark PRD；原 gate 只校验本地快照与 manifest，未重新读取远端，因此新增需求在本地功能清单与 task 中从未出现。
- **远端 fail-closed gate**：新增 `DOC-PRD-010`。同步时记录规范化正文 SHA-256、document ID 与 revision；每次 PRD stage / 项目 gate 重新 fetch 远端并比较 hash。正文漂移、baseline 缺失、权限/网络失败均阻塞且不可豁免，要求重新 sync → intake → approve。
- **同步产物修正**：Lark docs fetch 固定 `--as user --format json`，解析信封后只落正文；支持 `localizedTarget`，同步下载图片并生成仅引用本地 assets 的 extracted Markdown。
- **指纹完整性**：批准 fingerprint 纳入 `remoteSources`，防远端 baseline metadata 被静默改写；补稳定媒体 URL 规范化、响应解析、远端 baseline 变化与转义图片 alt 自测。

## 2026-08-10（五入口同源审计与执行前防漂移）

- AI 入口收敛为固定全集：Codex、Claude Code、Cursor、Lark-Codex、Lark-Claude；effective client matrix 缺项、多项或缺执行保障都会由 `VERIFY-RULE-003` 阻断，Lark runtime adapter 也进入 effective fingerprint。
- 交互式编码会话升级为 v2，绑定 `codex|claude|cursor|manual`、两层发布指纹、G2 输入、HEAD 与 24 小时有效期；Cursor adapter 显式传客户端，错客户端复用会话由 `VERIFY-RULE-002` 阻断。
- Lark Worker 每次启动 AI 前校验 L3/effective 均 fresh，并把两层指纹写入规则上下文；任一路由文件或章节缺失都以 `VERIFY-RULE-004` fail-closed，不再只告警后继续。
- `doctor` 增加入口全集审计与真实软链回归；补齐断链、分叉真实文件、入口矩阵和适配器漂移测试。生效范围仅本地规则系统与 Lark 执行链，不新增其他 AI 入口。

## 2026-08-09（Lark 测试反馈不再被 G2 / 非必要环境检查误阻断）

- 真实事故：PR-01947 样式已改完，`git diff --check` 与 Biome 通过；随后本地端口权限导致 Playwright 页面验证无法启动，Codex 按旧契约返回 `failed/env`，群内收到错误的红色失败卡。
- 结果契约新增内部态 `done_with_warnings` 与 `warnings[]`：实现和风险分级必需检查通过、仅额外视觉验证或无关历史门禁受限时用该状态；Worker 继续跑规范闸与 diff 可信度评估，通过后映射为 Gateway `done`，正常提交并发绿色完成卡，同时单列验证提醒。
- Prompt 明确 `failed` 只用于实现未完成或本次风险等级必需检查无法通过；新增与事故同形的回归测试，防止 Playwright 环境问题再次覆盖代码完成事实。
- 为缩短回群耗时，Lark Bot 自动视觉验收现默认关闭：不在 Codex 沙箱启动 dev server / Playwright，未明确要求的 hover / 像素验收交产品与 QA 在测试环境完成，也不作为 warning；明确要求时仅复用已运行页面。
- 修复 `[codex]正文` 无空格时误回落 Claude：执行器标签现在可直接接正文；事故任务已停止 Claude、清理其未提交半成品并改回 Codex 排队。
- 第二起事故：普通样式反馈已定位，但实现 Prompt 又重跑同步与 `docs-tdd context`，被 Keychain 和历史 G2 挡在改码前。初版只豁免 L1 style 仍过窄；现统一群任务与 Bug 表测试反馈：任务 / 附件就是当前依据，第一阶段只确认范围；明确时 L1-L3 均实施，不重复同步/context/gate。分析层把纯 G2 / 流程 blocker 自动转 ready，仅保留范围歧义、越界或真实访问失败。

## 2026-08-09（三端同源规则链与编码 rule session 加固）

- Codex/Claude 的 L1 继续使用同一软链源；Cursor adapter 改由共享生成器产出并逐字校验，doctor 同时验证真实 router/CLI 目标，旧路径不再能靠关键词假通过。
- `effective-rules` v2 发布三端 source matrix，直接依赖当前 L3 fresh，并把未解决的 SWR/React Query 冲突升级为 error；个人可在 gitignored 的 `docs-tdd.config.json` 显式声明 winner/loser，覆盖进入 adapter、context 与 effective fingerprint，不修改 FameEX tracked 规则。
- 新增原子 `docs-tdd release`：L3、effective、doctor、golden、context smoke 任一步失败即恢复两份旧 manifest，消除半发布状态。
- 编码场景 context 在 G2 通过后签发 24 小时 `agent/rule-session.json`；`changed` 与 G5-G8 以 `VERIFY-RULE-002` 校验规则/G2/HEAD 漂移，未真实加载当前规则不能交付。

## 2026-08-08（「AI 自动修 bug」Lark 服务抽成 `common/lark-bot/` 专属单例子树）

- **背景**：这套 bot 是**机器级全局单例**（一个 gateway + 一个 worker，launchd 常驻），却「寄居」两处：入口/lib/schema/测试埋在 `common/engine/agent-scripts/`（与按项目跑的 docs-tdd 工具混在一起，看不出是常驻服务），启动 shim + 单例配置 `lark-bot.local.json` 挂在 `PR-01947/agent/scripts/`（全机唯一服务塞进某具体项目目录）。
- **收拢**（`git mv` 保留历史）：入口 `lark-{gateway,worker,bugtable-poller}.mjs`、`lib/lark-*.mjs`（8 个）、`schemas/lark-ai-{analysis,result}.schema.json`、`__tests__/lark-*.test.mjs` 全部迁入 `common/lark-bot/{,lib/,schemas/,__tests__/}`；运行时 shim + `launchd-node.sh` + `lark-bot.local.json`（gitignore）落到 `common/lark-bot/runtime/`。共享的 `lib/roots.mjs`（大量非 lark 脚本在用）、`notify-lark.mjs`、`sync-lark-docs.mjs`、`lark-sources.schema.json` **不动**。
- **路径修正**：入口/lib 的 `roots.mjs` 引用改跨目录到 `agent-scripts/lib/roots.mjs`；schema join 改 `common/lark-bot/schemas/`；shim 引用与 `configPath` 改 `common/lark-bot/runtime/`；两份 plist `ProgramArguments` 指向新 runtime 路径（`WorkingDirectory`=fameex-web、worker `repoCwd`=PR-01947 不变）。
- **旁路同步**：`rule-release.mjs` 的 `isLarkPlumbing` 加 `common/lark-bot/` 前缀（整棵子树排除出规则指纹，避免基建高频改动把规则发布拖成假性 stale）；`check-doc-budget.mjs` 删悬空的 `agent-scripts/lib/lark-*` 自检豁免；`lark-bot-gateway.md` 登记 `DOC_BUDGET_OVERRIDES`（按需查阅型运维大文件）。
- **验证**：114 单测全绿；`common/lark-bot/**/*.mjs` 全过 `node --check`；重载 launchd 后 `/lark/health` `ok:true`。全程不 push、不改真实 bug 表。

## 2026-08-07（Lark 链路上线修复：lark-cli 身份 `--as bot` + launchd/executor）

- **背景**：P0–P3 合入 main 后首次实连拉起，gateway 长连接反复 `exit 2`、发消息报 `missing_scope`。根因：`lark-cli` 1.0.70 的 `defaultAs:auto` 在 user + bot 双登录下解析成 **user** 身份，而 `event consume` 只支持 bot、发消息/读表需 bot scope。
- **强制 bot 身份**（`lib/lark-cli.mjs` / `lark-gateway.mjs` / `lark-bugtable-poller.mjs`）：三处 `spawn(larkCliBin, …)` 统一注入 `--as bot`（consume 长连接 + 所有 `runLarkCli` 发消息/下载/chat-list/mget + poller bitable 读写）。不改全局 `lark-cli config default-as`（会波及用户自身 user 身份的 docs/sheets 操作），只在系统调用侧显式指定。
- **launchd 资产恢复**（`PR-01947/agent/launchd/*.plist`）：`docs_tdd-dev` 克隆已删，plist 源缺失。重建 gateway/worker 两份 plist 指向 **main 克隆** wrapper（`/Users/aven/github/docs_tdd/prds/PR-01947/agent/scripts/*`，`WorkingDirectory=fameex-web` 使 config/roots 落到真实 consumer）；launcher 默认 `DOCS_ROOT` 由已删的 dev 改为 `/Users/aven/github/docs_tdd`。
- **默认执行器 codex → claude**（`PR-01947/agent/scripts/lark-bot.local.json`，main 与 fameex-web 内嵌两份同步）。
- **claude 在 launchd 下的鉴权**（`PR-01947/agent/scripts/launchd-node.sh` + 两份 plist）：codex 登录态在 keychain、launchd 拿得到；claude 走第三方网关（`ANTHROPIC_API_KEY`/`BASE_URL`/`MODEL` 在 `~/.zshrc`），launchd 不 source zshrc → worker 里 spawn 的 claude 报 `Not logged in`。新增 wrapper：从 `~/.config/fameex-lark/claude.env`（0600，与 `gateway-secret` 同目录同权限）注入凭据后 `exec node`；plist `ProgramArguments` 由裸 `node` 改为该 wrapper。凭据不落进 world-readable 的 plist。
- **验证**：离线烟测 11/11（health/入队/幂等/claim/epoch 409/status 全通）；实连后 `feishu-websocket: connected`、`/lark/health` `ok:true consumer:true restarts:0`；claude executor 端到端实跑一条 status 自检任务达 `done`（worker 进程 env 已含注入凭据）；110 单测全绿、触达 `.mjs` 过 Biome。

## 2026-08-07（Lark 无人值守链路 P3 能力扩展）

- **接续同日 P0/P1/P2**，补 5 项能力缺口（价值高、改动大），仍只碰 `common/engine/agent-scripts/**` 与本文档，不碰业务代码。
- **P3-18 规则场景多标签 + 图片/fix 强制 UI/STYLE + 缺章告警**（`lib/lark-rule-context.mjs`）：`classifyLarkTask` 由「单一胜出」改**多标签叠加**（ui+api 命中就都产出 scenario，`refsFor` 按标签并集加载）；有图片附件或 `fix` 命令**强制并入 UI+STYLE 信号**（防「字段/背景/不对」等短语误判成纯 API 任务丢样式 token 规则）；`extractMarkdownSection` 抽到空段（源文档改了标题→规则被静默丢弃）时 `warn`+记 `warnings`/audit，不静默 continue。保留 `scenario` 主标签向后兼容。
- **P3-17 failureKind 分级 + nextStep**（`lark-ai-result.schema.json` / `lib/lark-ai-executor.mjs` / `lark-worker.mjs`）：AI 结构化 `failed` 增可选 `failureKind`（`tool/env/permission/requirement`）与 `nextStep`；`formatStructuredAiResult` 回执列「失败类型 + 下一步」；worker `classifyWorkerFailure` 对 preflight/超时/exit code 分别归因（超时→tool、登录/权限→permission、ENOENT/worktree/git→env），替代恒定的「Worker 执行异常」。
- **P3-15 commandType 解析 + status/docs 只读分流**（`lib/lark-message.mjs` / `lark-gateway.mjs` / `lark-worker.mjs`）：抽公共 `parseCommandType`（首行前缀→`status/docs/fix/test/api/qa`），Gateway 摄入与 POST 落 `task.commandType`；worker 对只读命令（`status`）本地无 worktree 时**不新建临时 worktree**（省 `git worktree add`），主仓就地只读回答、跳过 WIP 与代码提交、Codex 用 `read-only` 沙箱。
- **P3-16 owner @ 落地**（`lib/lark-cards.mjs` / `lark-gateway.mjs` / `lark-worker.mjs`）：新增纯函数 `resolveOwnerMention`——AI 自报 `owner`（随状态回写带给 Gateway）命中项目 `config.ownerMap`（`角色/关键词→open_id`，精确+关键词包含，可选表）则 `<at>` 责任人，未命中回落 `<at>` 提单人并注明「未识别，暂 @ 提单人」，无提单人则仅发群（不硬失败）。
- **P3-14 waiting_confirmation 续任务闭环**（`lib/lark-task-store.mjs` / `lark-gateway.mjs`）：`store.resumeWithSupplement` 复用**原任务**续跑——用户回复一条仍卡 `waiting_confirmation`/`blocked` 的任务时，append 补料到 `task.text`+合并新附件+复用同 `task.id`（→ `resolveWorkContext` 算出同一分支/worktree），置回 `queued` 并 bump `epoch`，不新建孤儿任务。
- **测试**：`lark-ai-executor.test.mjs` 补 failureKind/nextStep 回执 + `resolveOwnerMention` 命中/关键词/回落/无表 + 卡片 ownerNote 共 3 例（29）；`lark-pure.test.mjs` 补只读路由 3 例 + `parseCommandType`/`isReadOnlyCommand` 3 例（65）；`lark-task-store.test.mjs` 补 `resumeWithSupplement` 续跑/拒非法态 2 例（16）。三文件共 110 用例全绿；触达 `.mjs` 过 Biome。
- **生效边界**：`ownerMap` 为项目级可选配置，缺表始终回落提单人；续任务走「回复命中仍处 waiting/blocked 的原任务」路径。改动在 `docs_tdd` 源，上线需同步到 `docs_tdd-dev` 后 `lark-bot restart`（本轮按用户要求不动 dev）。

## 2026-08-07（Lark 无人值守链路 P2 规范闸/验证加强）

- **接续同日 P0/P1**，补规范闸扩检与 worker 侧验证加强，仍只碰 `common/engine/agent-scripts/**` 与本文档；只扫本次 diff 新增行、不碰存量债、不改团队 CI。
- **P2-12 规范闸扩检**（`lib/lark-lint-diff.mjs`）：① 补裸 `any` 检测（`as any` / `: any` / `<any>`，限 `.ts/.tsx`）；② `.match` → `matchAll`，一行多违规全列（原只报首个）；③ arbitrary 前缀补 `ring/outline/aspect/columns/indent/content`；④ className 语境限定——arbitrary/裸色只在引号字符串内或 CSS `@apply` 才算，跳过纯注释行，降注释/散文/i18n 文案误报；⑤ i18n 高置信项：动态 key（`t(变量)` 或模板插值 key，限 TS）与 JSX 文本硬编码中文（`>…中文…<`，限 tsx/jsx）。advice 走 `Record` 查表。
- **P2-13 worker 侧分级探测 + changedFiles 交叉校验**（`lark-worker.mjs`）：新增纯函数 `detectChangeTier`（命中 `*.schema.*`/`mapper`/`/api/`/`*.d.ts`/`packages/` 跨包即 L2+）、`crossCheckChangedFiles`（AI 自报 vs 真实 `git diff --name-only HEAD`，分漏报/虚报差集）、`assessDoneResult`（done 可信度评估）。worker 在 done 分支：**done 但工作区零改动 → 降级 failed 需人工复核**（无改动=无修复=不可信；状态/status 只读任务豁免）；L2+ 改动但 AI 自报 checks 不含 type-check、或漏报/虚报改动文件 → 挂人工可见 `⚠` note（非阻塞）。「done+空 changedFiles 不算成功」落在 worker 层而非纯 parser——只有此处能拿到真实 git 改动并区分只读任务，比盲目 throw 更稳。
- **测试**：`lark-ai-executor.test.mjs` 补 lint-diff 扩检 6 例（多违规/新前缀/className 语境/any/i18n 动态 key/JSX 中文）；`lark-pure.test.mjs` 补 `detectChangeTier`/`crossCheckChangedFiles`/`assessDoneResult` 共 11 例。三文件共 88 用例全绿；触达 `.mjs` 过 Biome。

## 2026-08-07（Lark 无人值守链路 P1 健壮性加固）

- **接续同日 P0**，补 4 项无人值守健壮性（改动更大、需设计），仍只碰 `common/engine/agent-scripts/**` 与本文档。
- **P1-8 claim epoch / fencing token**（`lib/lark-task-store.mjs` + `lark-gateway.mjs` + `lark-worker.mjs`）：孤儿重投 / 人工 retry 递增 `task.epoch`；claim 返回 epoch 基线，worker 回写 status 带 `epoch`；`handleStatusUpdate` epoch 不匹配返回 409。防「旧 worker 迟到回写覆盖新一代执行」。epoch 缺省时不校验（向后兼容）。
- **P1-9 事件摄入同步占位防 TOCTOU**（`lark-gateway.mjs`）：`ingestLarkEvent` 在任何 await 前用内存 `ingestingMessageIds` Set 同步占位，只有首个能进 ingest；持久化后交 `store.has` 去重。堵 lark-cli 重投同一事件时两个 `onLine` 并发双跑同一 messageId。
- **P1-10 重连告警滑动窗口 + lastEventAt**（`lark-gateway.mjs`）：退避延迟（`backoffAttempts`，稳定存活归零）与告警判定（`restartWindow` 滑动窗口计数，默认 10min）解耦——「每 61s 抖一次」这类稳定即归零 backoff 但持续掉线的情况现在也能告警；记录 `lastEventAt`（每收到事件更新）。
- **P1-11 /lark/health 观测增强**（`lark-gateway.mjs` + `lib/lark-task-store.mjs` stats）：health 补 `consumerDetail`（lastEventAt / 窗口抖动数 / alerted / backoff）、`oldestQueuedAgeMs`、`minLeaseRemainingMs`、`deadLetters`、`topRequeued`；consumer 死亡或事件静默超 `LARK_EVENT_STALE_MS`（默认 30min，仅在曾收到事件后判）时返回 503 供外部探活。
- **测试**：`lark-pure.test.mjs` 补 epoch fencing 三态（不匹配 409 / 匹配放行 / 缺省兼容，导出 `handleStatusUpdate` 只测 network-free 分支）；`lark-task-store.test.mjs` 补 epoch 递增与 stats 观测字段。三文件共 72 用例全绿；触达 `.mjs` 过 Biome。

## 2026-08-07（Lark 无人值守链路 P0 安全兜底）

- **背景**：对「借 lark-cli 自动修 bug」链路做四维审查，本次落地 P0 层——堵住无人值守下「烧钱 / 丢单 / 跨项目污染 / 双跑覆写」四类硬伤。只改 `common/engine/agent-scripts/**` 与本文档，不碰业务代码。
- **P0-1 毒任务死信 cap**（`lib/lark-task-store.mjs`）：孤儿重投 `requeueCount` 达 `LARK_MAX_REQUEUE`（默认 2）转 `failed` 死信并打 `deadLetterReason`、触发注入的 `onDeadLetter`（Gateway 侧发一次告警卡），停止自动重投；人工 `retry` 达 `LARK_MAX_RETRY`（默认 5）返回 `{task:null,reason}`。防 crash 型 bug 绕过闭环无限烧钱。
- **P0-2 POST 项目回落**（`lark-gateway.mjs`）：`POST /lark/tasks` 的 `body.project || config.project` 改 `body.project || null`，与 ingest 口径统一；无效/缺失项目号走 adhoc 临时 worktree，不再塞进 Gateway 主项目常驻 worktree。
- **P0-3 持久化原子写 + 损坏告警**（`lib/lark-task-store.mjs`）：`persist` 改 `writeFileSync(.tmp)+renameSync` 原子替换；启动恢复遇非法 JSON 改名 `.corrupt` 并 `console.warn`，不再静默 continue 丢单。
- **P0-4 项目号正则统一 + 锚定**（`lib/lark-message.mjs` + `lark-bugtable-poller.mjs`）：抽公共 `matchProjectId`（自由文本提取，词边界 `\b(PR|PM)-\d{3,}\b`）/ `isProjectId`（整串校验），poller 与 `parseProjectFromText` 共用；消除 `SUPR-01947` 吞子串与两链路解析不一致的误路由。
- **P0-5 规范闸口径修正**（`lark-worker.mjs`）：`enforceCodeQuality` 的 `diffOf` 由裸 `git diff`（仅未暂存）改 `git diff HEAD`，与 `snapshotWorktree` 统一；AI 自行 `git add`/commit 后不再扫到 0 违规静默放行。
- **P0-6 回写成功再置 done + 告警重试**（`lark-gateway.mjs` + poller）：bug 表任务先回写成功才落地 `done`，失败置中间态 `done_pending_writeback`（poller 视作 in-flight，不再入队/不 seen），Gateway 每 5min 重试回写直至一致；消除「群报完成 + 表格永卡待处理」。
- **P0-7 AI 超时 < lease 启动断言**（`lark-worker.mjs` + `lib/lark-ai-executor.mjs` 导出 `aiTimeoutMs`）：worker 启动断言 `LARK_WORKER_AI_TIMEOUT_MS < LARK_TASK_LEASE_MS`，不满足拒绝启动；焊死「孤儿回收不与活着的 AI 双跑同一 worktree」这条唯一防线。
- **测试**：`lark-pure.test.mjs` 补 `matchProjectId`/`isProjectId` 边界；`lark-task-store.test.mjs` 补死信 cap、retry 上限、损坏文件隔离。三个测试文件共 66 用例全绿（原 57）；触达 `.mjs` 过 Biome。
- **上线边界**：本改动在 `docs_tdd` 源；`lark-bot` launcher 实跑在 `docs_tdd-dev` 克隆，需同步后 `lark-bot restart` 才生效（dev 分支暂不动）。不引入 launchd/cron，不改团队级 CI/lint。

## 2026-08-06（Lark 自动修复增加 Codex executor）

- Lark Worker 的 AI 执行器收敛为 `claude|codex` 固定枚举，接通 task / 环境变量 / 本机配置三级选择，并支持群消息 `[codex]` / `[claude]` 单次覆盖；卡片记录实际执行器。
- Codex 走非交互 workspace-write、无审批、工具网络关闭与 ephemeral 会话，图片直接附加；最终结果按 schema 输出后由 Worker 回写 Gateway，不给 AI callback 开网络，也不使用全放权参数。
- executor 适配抽入 `lib/lark-ai-executor.mjs`，新增选择、命令权限、结构化回执与卡片测试；真实 `/tmp` 隔离 smoke 已验证 Codex CLI 登录、参数和零业务文件改动。

## 2026-08-04（判断层门禁锚定可核验证据 + 收敛自动化边界）

- **补的是哪一层**：评审发现机器强制层"硬层真硬（biome/tsc/vitest/build 实跑退出码），软层必然软"——判断层的 `acceptance-results.json` 只校验 evidence 数组非空、不验证产物真实存在；SHA 绑定可选（head 缺省即跳过 staleness）。本次把承重的判断层门禁锚定到外部可核验产物，并把叙事与真实能力对齐。
- **A. acceptance evidence 真实性**（`lib/acceptance-results.mjs`）：新增 `DOC-AC-005`（error）——每条 passed 验收的 evidence 至少要有一个真实存在的文件锚点（截图/报告/DOM 比对），且不含指向不存在文件的路径；复用 `verify-project-gate.mjs` 的 `evidencePathsExist` 以回调注入，保持 lib 无 I/O。堵"evidence 写一句话就算过"。
- **B. head 强制绑定**（两 schema + `lib/acceptance-results.mjs` + `lib/code-review.mjs`）：`acceptance-results.json` 与 `code-review.json` 的 `head` 提为必填；新增 `DOC-AC-006`（warn，仿 `DOC-CR-003`）——验收是否覆盖当前 HEAD，代码再改即判过时。gate 侧把 `currentSha` 传进 `acceptanceChecks`。
- **C. 前端完成待对账报告态**（`stage-status.schema.json` + `verify-project-gate.mjs` + `update-project-index.mjs`）：G5 枚举加 `frontend-complete-pending-reconcile`，新增 `VERIFY-G5-004`（warn，须有前端 evidence 与待对账原因）。**不放行 G6**（`VERIFY-G5-002` 放行集合不变），只在 PROJECTS.md 显示为"· 前端完成待对账"，让卡在 G5 的项目不再笼统显示阻塞。
- **F. 机器层兜底守护**（`docs-tdd.mjs`）：新增 `docs-tdd guard`——一条命令串跑 `rule-release --check` + `golden-run`（stale 时自动 `--skip-aggregator`）+ `doctor`，聚合退出码。本地无 CI/husky，机器层正确性不再只靠"每次记得跑"；**不装 launchd/cron**（保持 personal-local）。
- **G. 门禁脚本预算 + self-test 覆盖门**（`check-doc-budget.mjs` 校验 2.6）：脚本也上体量预算（默认 24000/30000 码点，大执行器 grandfather）+ self-test 覆盖门（无 `--self-test` 且未登记 `SELF_TEST_EXEMPT` 即 error）。
- **D. 端到端 golden**（`golden-run.mjs`）：baseline 从 G0/G1/G2/G3/G6 扩到 **G0-G7**（G4 的 GIT-G4 依赖真实分支，走 G5 累积覆盖其 DOC 检查）+ **G8 结构 dry-check**（合成 fixture 无真实 git 推送，只断言 G0-G7 文档链在 G8 校验下无回归）；新增 `acceptance-evidence-broken-anchor` 变异用例覆盖 `DOC-AC-005`。
- **E. legacy-unverified 语义**：`update-project-index.mjs` 的 Notes 显式说明 `legacy-unverified` = 机制上线前的自声明 G8、非机器背书；旧项目 worktree 已回收、**不 backfill 伪造 PASS 历史**。
- **H. 叙事如实**（`README.md` 步骤 8 + `AGENTS.md` §5）：补"人机分界"——G0-G4 高度自动，G5-G8 人机协同（真实联调/视觉/QA 为人工确认锚点），锚定 `verification-division-of-labor.md`/`rule-execution-model.md §3`；`AGENTS.md` 的"自动"限定为 G0-G2 文档骨架。
- **附带**：`assumptions.schema.json` 的 `blockingWhen` 枚举补 `prd-clarify`（PR-02074 ASM-006 的 `searchSort.matchCount 语义` 属"待 PRD 澄清"，是正当阻塞轴而非数据错；`verify-msw-manifest.mjs` 的 `blockingStatuses` 永不含它，故不改任何 gate 行为）。
- **接线验证**：新 rule ID（DOC-AC-005/006、VERIFY-G5-004）纳入台账；golden 31 项全绿（含聚合器烟测），全 lib/脚本 self-test 通过，发布链已重跑（`2941a71c7553`/`1490fbece06d`），`docs-tdd guard` 三检全绿。
- **边界**：不削弱任何既有 error 门禁；判断层语义正确性仍需人工/Review 兜底（结构+证据锚点可机器验，"验收结论是否真"不可）。

## 2026-08-03（阻塞与变更协议：`agent/blockers.json` 机器可读单一源）

- **补的是哪一层**：阻塞和需求变更此前只存在于 `06-collaboration.md §7` 的散文表格里——交付摘要靠正则 grep「待修复/未处理/待确认」字样（改口径就漏），gate 也拦不住「错误码待后端销账」这类项一路飘到 G8。改为机器可读单一源 `agent/blockers.json`，散文层退化为叙述补充而非真值源。
- **新增 `agent-scripts/lib/blockers.mjs`（纯语义，含 17 用例自测）+ `common/engine/schemas/blockers.schema.json` + `common/rules/blocking-and-change-protocol.md`**：`verify-project-gate.mjs`（每个 gate）与 `render-delivery-summary.mjs`（G8 第 4/5 段）共用同一份判定，不各写一份。登记支持 `blocker`/`change` 两型，生命周期 `open → resolved` 必须带非空 `resolution`+`resolvedAt`（禁静默清零），`open` 的 blocker 必填 `blocksGate`（否则 gate 无从拦截）。
- **三条规则 + 缺文件即合法**：`DOC-BLOCK-001`（结构合法，不可豁免）、`DOC-BLOCK-002`（无 open 且 `blocksGate ≤ 当前 gate` 的项未解除即阻断，可豁免——豁免走 `rule-waivers.json`，owner 具名带期限担责）、`DOC-BLOCK-003`（其余 open 项 warn）。无 `blockers.json` = 不发任何 check，存量项目零回填。与 `stage-status.blocked`（G5/G7 阶段处置）分工：后者答「阶段整体什么状态」，前者答「具体卡在哪几件、谁负责、什么解除」。
- **交付摘要结构化**：`render-delivery-summary.mjs` 第 4 段从 `openBlockers(entries)` 派生未解除阻塞与未收口变更（id+owner+blocksGate+摘要），第 5 段把 open 的 blocker 作为上线风险再点一次；散文 grep 降级为「补充线索，以 blockers.json 为准」。
- **接线验证**：`lib/blockers.mjs` rule ID 纳入台账扫描（`check-doc-budget` 校验 5 改为递归 `lib/`）；`blockers.schema.json` 进校验 13；golden 加 3 个变异用例（open blocker 到点→002、resolved 缺 resolution→001、waiver 降级 002→waived），基线夹具含 1 条 resolved blocker 证明不误伤。发布链已重跑（`7dd0184a5345`/`2c1eb69fc05e`），`docs-tdd golden` 22 项全绿，`doctor` error=0。
- **边界**：不碰 Lark 通知链路（阻塞通知策略仍在 `collaboration-and-notifications.md §4`，协议只交叉引用）；未加 JSON 模板（`blockers.json` valid-when-absent，模板反增摩擦，形状文档化在协议 §3）。

## 2026-08-03（机器事实层：真跑 biome/tsc/vitest + G8 交付摘要机器段）

- **机器事实层落地（P0：修复「gate 只验文档、不验代码」）**：此前所有「静态质量 / Biome / typecheck / 单测」类判定都由正则匹配 Agent 自己写的证据 markdown 满足（`verify-project-gate.mjs` 匹配字面量「Biome」），gate 脚本实际只 spawn `git` 和 `rg`——通过 gate 的最省力路径是「把文档写好」而不是「把代码写对」。新增 `agent-scripts/verify-build-quality.mjs`：自己执行 `biome check` / `tsc --noEmit` / `vitest run`，退出码来自真实子进程。实测 PR-02074 在 G5 47/50 检查全绿的状态下，biome 报 2 error + 2 warning，`WorldCup/common/format.ts` 导出函数无单测——证明缺口不是理论上的。
- **五条新规则 + 归因口径**：`VERIFY-BIOME-001`（error，候选文件 >0 但 `Checked 0 files` 也判 fail，0 files 不算通过证据）、`VERIFY-TYPE-001`（error，tsc 报错路径换算成 worktree 相对路径后只归因本次改动文件，存量债不阻断且无法通过删基线洗白——归属来自 git 不来自基线）、`VERIFY-TYPE-002`（warn，存量涟漪 vs `agent/tsc-baseline.json`，只做 warn 故篡改基线的收益上限是「少一个 warn」）、`VERIFY-TEST-001`（error，跑 changed 测试文件 ∪ changed 源文件的同名/`__tests__` 测试；`vitest related` 在本仓因目录 import 解析失败不可用，故直接跑测试文件路径）、`VERIFY-TEST-002`（warn，changed `.ts` 逻辑文件导出函数须有单测；`.tsx` 不在范围，视觉走人工分工）。
- **缺席守卫 `VERIFY-BUILD-001`**：`run-project-gate` 在 G6/G7/G8 自动调用本层，checks 直接并入 `payload.checks`，复用同一条 summary / 证据表 / warn 台账 / BLOCK 链路，不存在第二套结论口径。子脚本被跳过 / 未执行 / 输出不可解析时补一条显式失败——无理由 `--skip-build-quality` 判 error（否则它就是万能后门），有理由降 warn 留痕。**G6 起强制而非 G5**：联调期存量报错会让 gate 天天红，反而训练出「习惯性忽略」。
- **G8 交付摘要机器段（P0：交出去的那份摘要必须可信）**：G8 是流水线终点，其证据 + 交付摘要是唯一交到人手上的产物；此前它由 Agent 复述自己干过什么，人还得自己重跑一遍 lint/tsc/test 才敢提测。新增 `agent-scripts/render-delivery-summary.mjs`，`gate G8 --write` 自动调用，写 `agent/delivery-summary.machine.md`：第 1/2/3 段（改动模块+计数、各阶段真实 PASS 时点+证据路径、命令+退出码、机器事实层结论、功能清单三态计数）全部从 `gate-results.json` / append-only `gate-history.json` / `00-feature-inventory.md` / git diff 派生；第 4/5 段机器只给线索（生效中豁免、改动文件里的 `// ASSUMED:`、`06-collaboration.md` 悬空项、warn findings、mock 残留 grep），产品口径留 `<!-- 人工补充 -->` 占位，机器不代人拍板。
- **冷启动协议单一化（一致性）**：`CONTEXT.md` 曾硬编码一份 10 步「按顺序全读」清单（含 `common/README.md`、`rule-inheritance.md`），与 `rule-router.md §1`「禁止全读 `common/`」直接冲突——冷启动 Agent 命中哪份全看运气。改为三步指针（router → 项目机器版摘要 → 按场景 `docs-tdd context`），并加 `check-doc-budget` 校验 10.4 焊死：导航文件里再出现「≥4 个连续编号项、每项几乎只是文档路径」的阅读清单即 error（判据带正/反样例内联自测，README 的流程句子不会误报）。
- **生效边界**：改动限 local-only `docs_tdd`（新增 2 个脚本 + `run-project-gate`/`check-doc-budget` 接线 + `ruleset.json` 登记 6 条规则 + `rule-ids-and-gates §3.5`/`workflow-gates`/`quality-checklist §6`/`CONTEXT.md` 文档），未改业务代码与团队 tracked 配置。self-test 全通过（`check-doc-budget` 17 个自测入口）；PR-02074 上做了可回滚的 G8 端到端实跑验证（`buildQuality.checkCount=5`、`deliverySummary.ok=true`、证据 Summary 新增「机器事实层」行），验证后已还原 `agent/` 与 evidence 目录。已依次 `rule-release --write` / `effective-rules --write` 重发布。

## 2026-08-01（阶段门禁事故整改）

- **根因**：旧 G8 读取既有 `gate-results.json` 并允许同一份旧 G8 PASS 自证当前 G8；G5 依赖关键词而非结构化联调状态；G7 复用 G6 校验且无 completed/skipped/blocked 状态；`set-project-stage.mjs` 可脱离成功 gate 历史手工推进。
- **阶段链改造**：新增 `stage-status.json` 和追加式 `gate-history.json`；G6/G7/G8 分别强制已有 G5/G6/G7 PASS 历史及真实 evidence，G8 不再读取旧结果自证。G5 completed、G7 completed 必须有证据，N/A/skipped 必须有具体原因。
- **唯一写入口**：`docs-tdd.mjs gate` 默认持久化结果；成功时先追加历史再同步阶段，失败不追加历史。`set-project-stage.mjs` 缺少同阶段 PASS 历史时拒绝推进，`--force` 只允许回退。
- **全局防漂移**：新增 DOC-SYNC-004，阻断 active G5+ 项目缺连续 PASS 历史或历史 evidence 丢失；历史虚高 active 项目已统一回退到真实 G4，已上线 closed 项目保留 legacy 归档但不伪造新历史。
- **事故处置**：PR-01930 原 G8 PASS 已撤销并归档，真实状态恢复为 G4/G5 blocked；PR-01947、PR-01973、PR-02074 同步回退，PR-PricePanel 按已上线事实关闭。
- **审计防漂移补强**：`update-context-summary.mjs` 改为读取 `stage-status.json`，blocked 阶段必须出现在机器摘要；责任模块目录解析兼容反引号路径及中文逗号/顿号，避免合法路径被拼接后跳过 Mock/ASSUMED 扫描。两项均加入自测。
- **提测前契约完整性**：新增 `DOC-G5-004`，已勾选完成的任务同行仍含 `ASSUMED`、待后端/待对账、后端侧待办或契约未完成时直接阻断。源于 PR-01947 F19–F21“展示代码已落”被误写为完成并进入 test，但后台 P0 用例未执行、follower 接口契约未同步的问题。

> 2026-07 及更早条目已轮转到 [CHANGELOG-archive.md](./CHANGELOG-archive.md)（不进 context、不参与预算）。
