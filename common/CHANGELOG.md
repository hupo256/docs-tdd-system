# docs_tdd 框架变更日志

> 常驻路由的稳定目标（取代按日期命名的一次性升级报告，避免每次升级都新增文件并挤进路由表）。
> 每次对 `common/` 规则体系、gate 脚本、模板做实质升级，在顶部加一段「日期 + 变更」。
> **写法（去重）**：本日志只记「改了什么 + 为什么 + 生效边界」，不复制当前规则正文或证据表；当前口径统一引用 `rule-ownership.json` 指向的专题源。gate 计数只写一行结果，细目留在脚本输出。


> 更早的历史条目已归档到 [CHANGELOG-archive.md](./CHANGELOG-archive.md)（不进 context、不参与预算）。

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
