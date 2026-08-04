# docs_tdd 框架变更日志

> 常驻路由的稳定目标（取代按日期命名的一次性升级报告，避免每次升级都新增文件并挤进路由表）。
> 每次对 `common/` 规则体系、gate 脚本、模板做实质升级，在顶部加一段「日期 + 变更」。
> **写法（去重）**：本日志只记「改了什么 + 为什么 + 生效边界」，不复制当前规则正文或证据表；当前口径统一引用 `rule-ownership.json` 指向的专题源。gate 计数只写一行结果，细目留在脚本输出。

## 2026-08-03（阻塞与变更协议：`agent/blockers.json` 机器可读单一源）

- **补的是哪一层**：阻塞和需求变更此前只存在于 `06-collaboration.md §7` 的散文表格里——交付摘要靠正则 grep「待修复/未处理/待确认」字样（改口径就漏），gate 也拦不住「错误码待后端销账」这类项一路飘到 G8。改为机器可读单一源 `agent/blockers.json`，散文层退化为叙述补充而非真值源。
- **新增 `agent-scripts/lib/blockers.mjs`（纯语义，含 17 用例自测）+ `common/schemas/blockers.schema.json` + `common/blocking-and-change-protocol.md`**：`verify-project-gate.mjs`（每个 gate）与 `render-delivery-summary.mjs`（G8 第 4/5 段）共用同一份判定，不各写一份。登记支持 `blocker`/`change` 两型，生命周期 `open → resolved` 必须带非空 `resolution`+`resolvedAt`（禁静默清零），`open` 的 blocker 必填 `blocksGate`（否则 gate 无从拦截）。
- **三条规则 + 缺文件即合法**：`DOC-BLOCK-001`（结构合法，不可豁免）、`DOC-BLOCK-002`（无 open 且 `blocksGate ≤ 当前 gate` 的项未解除即阻断，可豁免——豁免走 `rule-waivers.json`，owner 具名带期限担责）、`DOC-BLOCK-003`（其余 open 项 warn）。无 `blockers.json` = 不发任何 check，存量项目零回填。与 `stage-status.blocked`（G5/G7 阶段处置）分工：后者答「阶段整体什么状态」，前者答「具体卡在哪几件、谁负责、什么解除」。
- **交付摘要结构化**：`render-delivery-summary.mjs` 第 4 段从 `openBlockers(entries)` 派生未解除阻塞与未收口变更（id+owner+blocksGate+摘要），第 5 段把 open 的 blocker 作为上线风险再点一次；散文 grep 降级为「补充线索，以 blockers.json 为准」。
- **接线验证**：`lib/blockers.mjs` rule ID 纳入台账扫描（`check-doc-budget` 校验 5 改为递归 `lib/`）；`blockers.schema.json` 进校验 13；golden 加 3 个变异用例（open blocker 到点→002、resolved 缺 resolution→001、waiver 降级 002→waived），基线夹具含 1 条 resolved blocker 证明不误伤。发布链已重跑（`7dd0184a5345`/`2c1eb69fc05e`），`docs-tdd golden` 22 项全绿，`doctor` error=0。
- **边界**：不碰 Lark 通知链路（阻塞通知策略仍在 `collaboration-and-notifications.md §4`，协议只交叉引用）；未加 JSON 模板（`blockers.json` valid-when-absent，模板反增摩擦，形状文档化在协议 §3）。

## 2026-08-03（Golden run：让 gate 机器自己被回归测试）

- **补的是哪一层**：各脚本 `--self-test` 只覆盖导出的纯谓词，覆盖不到接线——「规则 ID 有没有真的连到判定、聚合器还能不能跑起来、规则改宽后有没有误伤旁边的项」。本次升级中 `run-project-gate.mjs` 一度处于不可运行状态而全部纯函数自测仍全绿，只靠人工翻代码才发现；这类故障需要端到端夹具才拦得住。
- **新增 `agent-scripts/golden-run.mjs` + `common/fixtures/golden-project/`**：夹具是一份刚好通过 G0/G2/G3 的最小项目文档，物化成保留 ID `PR-00000` 后逐个变异用例只破坏一处，断言预期规则 ID 正好命中，**且不牵连基线之外的 error 规则**。后半句是防误报的那一半：规则变宽会让基线其他项一起红，直接 fail。14 个变异用例覆盖 `DOC-STRUCT-006/012`、`DOC-G0-001/002/003`、`DOC-G2-001/002/004/005`、`DOC-G3-001/005/006`，外加豁免机制两条（未过期豁免须把 error 降 waived；过期豁免须以 `DOC-WAIVER-003` 暴露且规则仍阻断）。
- **故障注入实测双向有效**：把 `DOC-G3-005` 改成恒真（规则失效）→ 对应变异用例与豁免用例同时 fail；把 `DOC-G0-003` 改宽（误伤）→ 基线直接红。两类都被抓出，注入文件已还原。
- **发布即强制**：`rule-release.mjs --write` 在 `check-doc-budget` 之后跑 `golden-run --skip-aggregator`，不通过拒绝发布。聚合器烟测（`run-project-gate PR-00000 G2`，本会话那类崩溃就靠它）需要**已发布**的新指纹，发布前跑不了，故拆出来留给发布后的 `docs-tdd golden`；跳过时显式打印并计入用例数，不伪装成通过。
- **生效边界**：只覆盖文档类 gate（G0/G2/G3）。G4+ 依赖真实分支 / 改动文件 / 工具链，夹具造不出可信输入，那一层由机器事实层的真实执行负责；`prd-intake` 与 MSW 子链路在夹具里显式关闭（`project-manifest.pilot` 全 false），各自已有 fixtures 与自测。全程不传 `--write`，不写 `gate-results.json` / `evidence/**` / `PROJECTS.md` / warn 台账；`PR-00000` 在 `finally` 里删除，并被 `check-doc-budget` 与 `update-project-index.mjs` 的项目扫描显式排除（保留 ID）。单次约 2.6s。

## 2026-08-03（机器事实层：真跑 biome/tsc/vitest + G8 交付摘要机器段）

- **机器事实层落地（P0：修复「gate 只验文档、不验代码」）**：此前所有「静态质量 / Biome / typecheck / 单测」类判定都由正则匹配 Agent 自己写的证据 markdown 满足（`verify-project-gate.mjs` 匹配字面量「Biome」），gate 脚本实际只 spawn `git` 和 `rg`——通过 gate 的最省力路径是「把文档写好」而不是「把代码写对」。新增 `agent-scripts/verify-build-quality.mjs`：自己执行 `biome check` / `tsc --noEmit` / `vitest run`，退出码来自真实子进程。实测 PR-02074 在 G5 47/50 检查全绿的状态下，biome 报 2 error + 2 warning，`WorldCup/common/format.ts` 导出函数无单测——证明缺口不是理论上的。
- **五条新规则 + 归因口径**：`VERIFY-BIOME-001`（error，候选文件 >0 但 `Checked 0 files` 也判 fail，0 files 不算通过证据）、`VERIFY-TYPE-001`（error，tsc 报错路径换算成 worktree 相对路径后只归因本次改动文件，存量债不阻断且无法通过删基线洗白——归属来自 git 不来自基线）、`VERIFY-TYPE-002`（warn，存量涟漪 vs `agent/tsc-baseline.json`，只做 warn 故篡改基线的收益上限是「少一个 warn」）、`VERIFY-TEST-001`（error，跑 changed 测试文件 ∪ changed 源文件的同名/`__tests__` 测试；`vitest related` 在本仓因目录 import 解析失败不可用，故直接跑测试文件路径）、`VERIFY-TEST-002`（warn，changed `.ts` 逻辑文件导出函数须有单测；`.tsx` 不在范围，视觉走人工分工）。
- **缺席守卫 `VERIFY-BUILD-001`**：`run-project-gate` 在 G6/G7/G8 自动调用本层，checks 直接并入 `payload.checks`，复用同一条 summary / 证据表 / warn 台账 / BLOCK 链路，不存在第二套结论口径。子脚本被跳过 / 未执行 / 输出不可解析时补一条显式失败——无理由 `--skip-build-quality` 判 error（否则它就是万能后门），有理由降 warn 留痕。**G6 起强制而非 G5**：联调期存量报错会让 gate 天天红，反而训练出「习惯性忽略」。
- **G8 交付摘要机器段（P0：交出去的那份摘要必须可信）**：G8 是流水线终点，其证据 + 交付摘要是唯一交到人手上的产物；此前它由 Agent 复述自己干过什么，人还得自己重跑一遍 lint/tsc/test 才敢提测。新增 `agent-scripts/render-delivery-summary.mjs`，`gate G8 --write` 自动调用，写 `agent/delivery-summary.machine.md`：第 1/2/3 段（改动模块+计数、各阶段真实 PASS 时点+证据路径、命令+退出码、机器事实层结论、功能清单三态计数）全部从 `gate-results.json` / append-only `gate-history.json` / `00-feature-inventory.md` / git diff 派生；第 4/5 段机器只给线索（生效中豁免、改动文件里的 `// ASSUMED:`、`06-collaboration.md` 悬空项、warn findings、mock 残留 grep），产品口径留 `<!-- 人工补充 -->` 占位，机器不代人拍板。
- **冷启动协议单一化（一致性）**：`CONTEXT.md` 曾硬编码一份 10 步「按顺序全读」清单（含 `common/README.md`、`rule-inheritance.md`），与 `rule-router.md §1`「禁止全读 `common/`」直接冲突——冷启动 Agent 命中哪份全看运气。改为三步指针（router → 项目机器版摘要 → 按场景 `docs-tdd context`），并加 `check-doc-budget` 校验 10.4 焊死：导航文件里再出现「≥4 个连续编号项、每项几乎只是文档路径」的阅读清单即 error（判据带正/反样例内联自测，README 的流程句子不会误报）。
- **生效边界**：改动限 local-only `docs_tdd`（新增 2 个脚本 + `run-project-gate`/`check-doc-budget` 接线 + `ruleset.json` 登记 6 条规则 + `rule-ids-and-gates §3.5`/`workflow-gates`/`quality-checklist §6`/`CONTEXT.md` 文档），未改业务代码与团队 tracked 配置。self-test 全通过（`check-doc-budget` 17 个自测入口）；PR-02074 上做了可回滚的 G8 端到端实跑验证（`buildQuality.checkCount=5`、`deliverySummary.ok=true`、证据 Summary 新增「机器事实层」行），验证后已还原 `agent/` 与 evidence 目录。已依次 `rule-release --write` / `effective-rules --write` 重发布。

## 2026-08-03（执行契约补强：心跳、fail-open 可见化、mock/质量扫描漏洞）

- **Gate 心跳（P0：修复「无机制强制跑 gate」）**：新增 `agent-scripts/lib/fingerprint.mjs`（`codeFingerprint`/`matchesGateFingerprint`），`run-project-gate` 的 `createFingerprint` 改为复用它以保证 gate 与心跳同口径。`docs-tdd context` 在 pack 输出后比对当前 worktree 代码状态与 `gate-results.json.fingerprint`，代码漂移/上次未过/从未跑过时打 warn 心跳；`update-context-summary` 的 Latest Gate Results 加一行「快照非实时，以心跳为准」指针。心跳为 diagnostic，不阻断；worktree 未配置或 pre-G4 静默跳过（worktree 级非文件级）。判定逻辑抽为纯函数 `heartbeatDecision` 并 self-test（7 例）：worktree 与 base 零差异（`headSha===baseSha` 且无 dirty/untracked，即刚建还没写代码）时不催「从未跑过 gate」，避免对空 worktree 噪音；有真实改动/提交则照常提醒。
- **PostToolUse hook fail-open 可见化（P0）**：`claude-posttooluse-gate.mjs` 原「任何 error/timeout → 静默 exit 0」违反 `rule-execution-model §4.4 失败默认可见`。改为：真实违规 exit 2（阻断、回喂 Claude）；gate 无法执行（spawn 失败/超时/输出不可解析）exit 1（非阻断、stderr 提示 result unknown，催手动跑 `docs-tdd changed`）；顶层 catch 也打 stderr 再退。基础设施失败不再伪装成 pass，也不误阻断编辑。
- **Mock 泄漏硬闸补 MSW 复数目录（P1）**：`CODE-MOCK-005`/`isMockFile` 原正则只认单数 `mock/`，漏掉 MSW 的 `src/mocks/handlers` 复数目录——生产 import MSW handler 未被 error 级全量扫抓到。正则扩为 `mocks?/`、`__mocks?__/` 并覆盖 `.fixture`；`rule-ids-and-gates.md §3` 同步。
- **error 级规则测试文件误伤（P1）**：`CODE-TYPE-001`/`CODE-STYLE-002` 原不豁免 test/fixture，`z.any()`/`expect.any()`/fixture 里 hex 会报 error 卡 gate。TYPE-001 放行 `.any(` 方法调用且不扫 test/spec/fixture，STYLE-002 同加 test 豁免。补 4 条负向 self-test。
- **base 不可解析误判 error（P1）**：`baseRef`（如 `origin/online` 未 fetch）不可解析时 `CODE-FILE-001` 原把存量超限 `.tsx` 误判成新建 error；改为无法证明新建即降 warn 并提示先 fetch 基线。
- **MSW 退役「零残留」机器核验（P1）**：`verify-msw-manifest` 原 `retirementOk` 只校验 `retiredAt`/`reconciliationEvidence` 两字符串非空，handler 仍在也能伪造通过。抽纯函数 `retirementIssues` 并入 `DOC-G3-IMPL-004`：`mock-retired` 时还须 handler 文件已删、注册文件不再引用它；补 3 条 self-test。
- **effective 新鲜度门禁自我否定（enforceability）**：`effective-rules` 原整文件 hash `~/.claude/settings.json`，harness 每改一次（permissions/会话态）就令 `context/gate` 误挡、逼无谓 republish，稀释「证明消费了哪组规则」价值。改为只 hash 其 `hooks` 子树（effective 真正依赖的适配）；补投影 self-test。
- **schema 过严阻断 planned MSW（数据一致性）**：`msw-manifest.schema.json` 的 `sourceRoot` 原 `minLength:1` 对 `planned`（尚未搭 mock）恒失败、并因 PostToolUse+check-doc-budget 联动阻断全部 docs 编辑与规则发布；改为允许空串（active 侧资产存在性仍由 `DOC-G3-IMPL-002` 单独保。）
- **warn→error 晋级台账自动化（enforceability，接上条 review #2）**：原 `rule-ids-and-gates.md §2.1` 手填台账长期全 0、无自动化——正是它自己警告的「永久 warn」现状。新增 `warn-ledger.mjs` + `common/warn-ledger.json`（可变态，已在 `rule-release` 排除）：`gate --write`（G5+）自动按 `(ruleId, PR)` 记录可晋级 warn 命中（默认 `unreviewed`，PASS/BLOCK 都记）；人工 `--mark` 标 true/false-positive；`--report` 按「≥2 个 true-positive PR 且零 false-positive」算晋级候选。晋级仍是人工改脚本严重度的动作，机器只负责记录与计算。§2.1 手填表改为指向机器台账；`PROMOTABLE` 集与 §2.1 一致，永久 warn 类不进台账。补纯函数 self-test 并入 check-doc-budget。
- **CODE-COPY-001 误报修复（regex 打磨）**：原 t() 剥离正则只剥到第一个字符串，`t('key', '中文默认')` / `t('key', { defaultValue: '中文' })` 的默认值实参残留 CJK → 对合法 i18n 形态误报。改用平衡括号 `stripTCalls` 剥掉整个 `t(...)` 调用；补 3 条 self-test（默认值实参、defaultValue 对象、CJK 在 t() 外仍命中）。
- **生效边界**：全部改动限 local-only `docs_tdd`（agent-scripts/schema/规则台账），未改业务代码与团队 tracked 配置。self-test 全通过（计数以脚本实时输出为准）；已依次 `rule-release --write` / `effective-rules --write` 重发布。**未处理（预存、非本轮引入）**：PR-02172 README `worktree` 与 msw-manifest `sourceRoot` 为空的项目配置缺口，待其负责人补。

## 2026-08-01（阶段门禁事故整改）

- **根因**：旧 G8 读取既有 `gate-results.json` 并允许同一份旧 G8 PASS 自证当前 G8；G5 依赖关键词而非结构化联调状态；G7 复用 G6 校验且无 completed/skipped/blocked 状态；`set-project-stage.mjs` 可脱离成功 gate 历史手工推进。
- **阶段链改造**：新增 `stage-status.json` 和追加式 `gate-history.json`；G6/G7/G8 分别强制已有 G5/G6/G7 PASS 历史及真实 evidence，G8 不再读取旧结果自证。G5 completed、G7 completed 必须有证据，N/A/skipped 必须有具体原因。
- **唯一写入口**：`docs-tdd.mjs gate` 默认持久化结果；成功时先追加历史再同步阶段，失败不追加历史。`set-project-stage.mjs` 缺少同阶段 PASS 历史时拒绝推进，`--force` 只允许回退。
- **全局防漂移**：新增 DOC-SYNC-004，阻断 active G5+ 项目缺连续 PASS 历史或历史 evidence 丢失；历史虚高 active 项目已统一回退到真实 G4，已上线 closed 项目保留 legacy 归档但不伪造新历史。
- **事故处置**：PR-01930 原 G8 PASS 已撤销并归档，真实状态恢复为 G4/G5 blocked；PR-01947、PR-01973、PR-02074 同步回退，PR-PricePanel 按已上线事实关闭。
- **审计防漂移补强**：`update-context-summary.mjs` 改为读取 `stage-status.json`，blocked 阶段必须出现在机器摘要；责任模块目录解析兼容反引号路径及中文逗号/顿号，避免合法路径被拼接后跳过 Mock/ASSUMED 扫描。两项均加入自测。
- **提测前契约完整性**：新增 `DOC-G5-004`，已勾选完成的任务同行仍含 `ASSUMED`、待后端/待对账、后端侧待办或契约未完成时直接阻断。源于 PR-01947 F19–F21“展示代码已落”被误写为完成并进入 test，但后台 P0 用例未执行、follower 接口契约未同步的问题。

## 2026-07-25（上下文与增量执行减负）

- **按章节加载**：`rule-index.json` 支持章节路由和 G6 子场景，`context` 默认生成确定性 compact pack，保留 `--full` 调查模式；规则 Markdown 仍是唯一真值源。
- **安全增量缓存**：`changed` 和非写入 gate 仅复用同规则、项目文档、Git diff、未跟踪文件内容及 PRD manifest 指纹下的 PASS；失败、`--write`、`--no-cache` 不复用，避免以提速换验证强度。
- **输出与恢复收敛**：项目摘要收紧为阶段、指纹、阻塞和下一步，完整子检查日志移至 `/tmp/docs-tdd-logs/`；Router 增加场景推荐和 checkpoint 触发指针，长规则、日志和图片不常驻主上下文。
- **生效边界**：全部产物和改动保持在 local-only `docs_tdd` 或 `/tmp`，不改 tracked 配置、业务代码和既有项目 pilot；PRD 图片、表格、嵌入对象覆盖及 Gate 数量不减少。

## 2026-07-25（调用链、数据链与分层落地）

- **三端规则统一消费**：新增 `~/.ai-rules` 单一 L1 真值源与本地 installer，Codex/Claude 通过 symlink 消费同一短规则和 skills，Cursor 使用用户级薄 adapter；旧文件先备份，tracked 仓库规则不修改。
- **有效规则组合发布**：新增 `effective-rules.mjs` / `effective-rules.json`，组合 L1、三端 adapter、tracked L2 与 L3 release；context、changed、gate 现在同时要求 L3/effective fresh，并把组合指纹写入 context pack 和 gate evidence。
- **可操作诊断**：新增 `docs-tdd doctor`，阻断 adapter/共享 skill/hook/隔离/release 漂移，并把仓库现有 SWR vs React Query、缺失 `.ai-harness`、失效 component-comments 引用作为 tracked L2 warning 报告，不越权修复。

- **架构语义拆分**：将含混的 `Page → hook → schema/mapper → API` 拆为调用链和响应数据链，`api-and-mapper.md §1` 增加 Component、Query Hook、API Service、Schema、Mapper 的输入/输出/允许依赖/禁止依赖固定契约；Mapper 明确为无网络、状态和 UI 依赖的纯转换层。
- **确定性加载与设计前置**：新增 `write_query_hook`，并让 `write_ui`/`write_state` 加载分层入口；技术方案模板升 v3，新增请求链必填表。`DOC-G4-006/007` 仅约束 v3，新旧模板不回溯，纯 UI 可用有来源说明的 `N/A`。
- **结构候选机器兜底**：新增 `CODE-ARCH-003` changed-file import 扫描和正反 self-test，提示 Mapper 反向依赖、Service 依赖 UI、Component 穿透 Hook、生产链引 fixture。正则不宣称替代依赖图，当前 warn-first，由 G6 Review 裁决并进入晋级台账。

## 2026-07-24（规则内容发布指纹）

- 新增 `rule-release.mjs` 与 `rule-release.json`，对 `common/`、`templates/` 的实际内容和文件列表计算确定性 SHA-256；人工 `ruleset.version` 继续表示兼容标签，不再冒充实际规则内容证明。
- 规则维护采用“编辑 → `check-doc-budget` → publish → consume”：`context/changed/gate` 和 gate 直达入口只消费 fresh release，规则半成品、遗漏发布或发布后漂移均退出 1；`check/capability` 保持可用于修复和诊断。
- context pack 和新 gate evidence 绑定同一规则发布指纹，可准确追溯当次 AI 加载、扫描和门禁使用的规则内容；全部机制保持在 ignored local-only `docs_tdd`，不修改团队 tracked 配置。

## 2026-07-24（专题唯一正文源收敛）

- 新增 `rule-ownership.json`，登记流程、PRD intake、API/mapper、状态/MSW、视觉、验证和证据等主题的唯一正文源；Router、Gate、模板和项目文档只保留触发与消费指针。
- `development-rules.md` 降级为纯导航，`new-project-kickoff.md` 只保留启动编排；移除目录树、成功标准、质量清单等副本。
- `architecture-and-state.md §8.4.1` 成为当前 MSW 执行契约；删除“尚待试点”与“已强制”并存的过期时态，历史结论移入本日志。
- `check-doc-budget.mjs` 增加专题所有权有效性与已知重复块防回归检查；本次规则只影响 `common/` 维护方式，不要求历史项目回填。

## 2026-07-24（PRD 富媒体 intake 门禁）

- **从声明“读过”改为可追踪输入链**：新增 `prd-source-manifest.json` 与 `prd-intake.mjs`，逐项登记图片、表格和嵌入对象，要求 `sourceId → Feature → Task → evidence` 可追溯；G0 可保留 unresolved，G2 前必须归零并批准 fingerprint。
- **视觉输入与漂移阻断**：图片必须视觉读取，OCR/alt 仅辅助；本地图片二进制参与 hash，链接不变但素材被替换也会阻断。只有远程 URL 或附件缺失时不得批准，需先同步为 `docs_tdd` 本地附件。
- **前向生效边界**：新项目默认 `pilot.prdIntake=true` 并阻断，历史项目未显式 opt-in 时保持原行为；规则、脚本和证据均留在 ignored local-only `docs_tdd`，不改项目根配置和业务 worktree。

## 2026-07-24（单一事实源所有权）

- **问题收敛**：针对共享数据、状态、业务规则、配置和项目结论在多处重复维护、更新不一致的问题，`architecture-and-state.md §4.0` 新增项目所有权门禁；编码细则仍由 L1/L2 承担，L3 只记录阶段、证据与例外。
- **前向模板与 gate**：`02-technical-design-template.md` 升级 v2，新增权威来源/唯一写入口/消费者/副本契约表；`DOC-G4-004/005` 仅对 v2 技术方案检查章节与占位，不回溯阻断未触及相关模块的旧项目。
- **例外口径**：缓存、持久化镜像、读模型和迁移兼容值不被一刀切禁止，但必须登记同步或失效机制、陈旧窗口、owner、恢复方式与验证证据；无此契约即按第二真值源处理。

## 2026-07-24（规则执行保障模型）

- **从“规则存在”改为“执行契约完整”**：新增 `rule-execution-model.md`，要求规则明确 Trigger、唯一 Source、Loader、Executor、Evidence 和 Failure；缺执行器或证据的规则只能算建议，不能声称已落实。
- **真实保障边界**：明确 PostToolUse 只提供快速反馈，无 hook 的 Agent 必须跑 `docs-tdd changed`；无论是否有 hook，阶段出口都以带工作树/ruleset fingerprint 的 gate 证据为准。`docs_tdd` local-only 时不宣称 Husky/CI 已兜底。
- **规则治理闭环**：建立 Mechanical/Structural/Judgment 三级执行方式、新规则准入流程、规则即测试、证据新鲜度、限时豁免和定期健康指标；专题接入 G6、文档自动化 Review 与维护场景，常驻路由只保留判断指针。
- **个人规则本地优先**：规则载体新增 `personal-local` / `team-tracked` 边界；个人 AI 规则只写用户目录或 `.git/info/exclude` 排除的 `docs_tdd`。仓库根 `AGENTS.md`、`.cursor/rules`、hooks、package/CI 默认只读，只有用户明确批准为团队规范后才允许提升，避免影响其他同事。

- **Mapper 命名收紧**：单一来源字段即使类型/格式变化或需要来源消歧也保持 API 名；改名只接受跨来源统一和多字段语义派生，并用 `API-RENAME: cross-source` / `API-DERIVED: sources=` 留可审计理由。`CODE-NAMING-001` 普通 `// API:` 不再豁免，新增 4 条回归自测；新项目 API 契约模板改用四种“映射类型”。
- **二级规则路由**：`rule-router.md` 从 4855 压到约 1.9k 字符，预算收紧为 5000；专题覆盖唯一机器真值迁到 `rule-index.json`，README 继续做人读全索引。新增 `write_api` / `write_mapper` / `write_state` / `write_msw` / `legacy_mock` 场景，遗留路线 A 不再被新功能无条件加载。
- **Context Pack 缓存**：`docs-tdd context` 按项目摘要 + 场景专题 + ruleset 生成带内容 fingerprint 的 `/tmp/docs-tdd-context/*.md`；规则或摘要变化即换 fingerprint，不把缓存当真值源。API/mapper 另拆 `api-and-mapper.md`，使 mapper 场景不再加载 31KB 聚合规则。

## 2026-07-24

本地规则试点升级（保持 `docs_tdd` local-only，不改项目根配置、不进入团队版本管理）：

- **本地 ruleset + 项目版本边界**：新增 `common/ruleset.json` 与 `agent/project-manifest.json`，规则带 maturity/blocking/waivable 元数据；PR-01947、PR-02074 固定当前本地规则版本并采用 report-only，避免规则迭代回溯阻断存量项目。
- **MSW 事实清单取代纯关键词声明**：新增 `agent/msw-manifest.json`、`agent/assumptions.json` 及 schema/verifier，校验真实 handler、fixture、契约测试、注册链、场景矩阵、退役证据和 API 假设清零；planned 生命周期允许 G3 前 endpoint 清单为空。
- **Agent-neutral 执行入口**：新增 `docs-tdd.mjs` 统一提供 capability/context/changed/gate/check；从项目 README 解析 worktree，并在对应 feature worktree 执行代码扫描和 gate，Claude/Codex 配置只保留薄适配与无 hook 时的显式 fallback。
- **证据可复现性**：gate 产物新增命令结束时间、Git/dirty/ruleset fingerprint，以及 documentation/implementation 分组统计；新字段保持向后兼容，不要求历史证据回填。
- **生效边界**：MSW implementation 规则当前为 experimental、非阻断；注册链完整性与阻断假设清零标记为 non-waivable，为后续从试点晋级提供明确开关。本轮只更新主仓 local-only 文档工具，未修改 PR-02074 feature worktree 业务代码。
- **真实 worktree 规则精度回归**：`verify-code-rules` 改用调用者 Git worktree，覆盖 committed/unstaged/staged/untracked 改动；Query 规则按新增 hook 块验证显式 `queryKey` + 导出 key 工厂，避免合规 hook 假阳性；300 行规则改为新建/新跨线阻断、存量超限 WARN 并报告 base/delta，区分当前引入风险与历史债；行数统计不再把末尾换行计为额外一行；假默认规则放行只用于 React identity 的 `key`，避免把列表稳定标识误判成展示数据兜底。

## 2026-07-23

阶段真值同步写口收敛（这是当时机制，已被 2026-08-01 的“正式 gate 唯一推进入口 + 成功历史前置”取代；实证：PR-02074 `gate-results` 已 G6 PASS，README 仍写「G0 资料接收」，PROJECTS.md 派生自手工行随之失真）：

- **`set-project-stage.mjs` 新增（当时的阶段真值同步写口）**：一条命令同步四面——README 状态表机器行「最新通过门禁」（只由脚本写入，跟随表格粗体/纯文本既有风格）、README frontmatter `stage`、机器版 `agent/context-summary.md`、`PROJECTS.md`。2026-08-01 起它只消费已有成功历史，不能脱离正式 gate 推进；`--force` 也只允许回退。
- **`run-project-gate.mjs --write` 默认同步阶段**：gate 通过自动调 `set-project-stage`，未通过只刷索引；`--refresh-index` 退役（仍被接受但已无效果），新增 `--no-refresh-index` 关闭。gate JSON 改为集齐子命令摘要后一次落盘，payload 新增 `stageSync` 字段；同步失败不翻转 gate 结论，但留在 Command Evidence 与 stderr。
- **check-doc-budget 校验 11（`DOC-SYNC-001/002/003`）**：已通过 gate 项目的 README 机器行 == `gate-results.gate`、机器版摘要当前阶段 == `gate-results.gate`、PROJECTS.md 与即时重生成一致（归一化时间戳）。ID 已登记 `rule-ids-and-gates.md §5`；修复提示直接给出要跑的命令。
- **PROJECTS.md Status 派生优先级定型**：机器行 > frontmatter `stage` > 人工叙述行（当前阶段/代码实现/引用形态）；叙述行标签兼容 `**粗体**`（PR-01947 此前因粗体标签不命中解析而显示「未记录」）。
- **README frontmatter 元数据**：`start-new-project.mjs` 模板顶部带 YAML frontmatter（projectId/status/stage/branch/worktree 等），`update-project-index.mjs` 解析之，check-doc-budget 新增元数据 schema 校验。
- 生效边界：存量项目无机器行者，DOC-SYNC-001 会在其 gate-results ok=true 时报错并给出修复命令；PR-02074 / PR-01947 已同步至 G6。check-doc-budget 全绿，8 个脚本自测入口通过（计数以脚本实时输出为准）。

## 2026-07-23（第二批：AI 自动化可读性升级）

从「AI 自动化开发」视角对 `docs_tdd/` 做结构化升级，减少 Agent 恢复项目时的启发式猜测：

- **README frontmatter schema 固化**：`common/schemas/project-frontmatter.schema.json` 定义 `projectId/status/stage/branch/worktree/port/visualFidelity/prdSource/figmaNode/larkEnabled`；`check-doc-budget.mjs` 校验 9 个项目 frontmatter + `agent/gate-results.json` + `agent/rule-waivers.json` + `agent/lark-sources.json` 全部通过 schema。`lark-sources.json` 补齐 `operation` 字段，`gate-results.schema.json` 补齐 `stageSync`。
- **JSON Schema 轻量校验器内联**：不引入外部依赖，`check-doc-budget.mjs` 内置 draft-07 子集校验，覆盖 type/required/enum/pattern/array/object/minimum/additionalProperties。
- **统一 handoff 交接模板**：新增 `templates/handoff-template.md`，固定「一句话 / 环境 / 已完成 / 必读顺序 / 代码落点 / 编码指南 / 验证命令 / 待办 / 已知陷阱 / 升级路径」章节；`start-new-project.mjs` 生成的 `agent/README.md` 自带交接索引区；存量项目 `agent/README.md` 补交接文件索引。
- **Evidence 二进制文件门禁（VERIFY-G6-004）**：`verify-project-gate.mjs` G6 扫描 `evidence/` 下 `.png/.jpg/.html` 等二进制/临时文件，warn 提示应移至 `/tmp/` 或 `.gitignore` 目录，保持证据目录只存文字报告。
- **Agent 脚本 `--help` 全覆盖**：`common/agent-scripts/` 下 17 个脚本均支持 `--help`；`common/README.md` 脚本索引表从 6 行扩展到 18 行，覆盖全部脚本及典型用法。
- **engineering/development-rules.md 空文件口径**：`start-new-project.mjs` 生成时明确「暂无特殊约束也保留本文件并写『暂无』」；存量空文件补记说明，避免 AI 怀疑文件缺失。
- **common/README.md 编号唯一性**：修复「专题全索引」中 `workflow-gates.md` 重复、`project-doc-structure.md` 与 `lark-doc-sync.md` 同号 27 的问题；`check-doc-budget.mjs` 新增编号唯一性校验。
- **模板版本化机制**：14 个核心模板顶部加 `template-version` + `template-effective-since` 标记；`check-doc-budget.mjs` 校验模板版本标记，为后续「活跃项目模板版本一致性检查」打基础。
- 生效边界：存量项目文档是复制时点快照，不强制回填新模板章节；新规则对新建项目立即生效，存量项目改到相关模块时顺手对齐。check-doc-budget 全绿，8 个脚本自测入口通过。

## 2026-07-20（第二批：Review 剩余项落地）

承上一批，续落 review 列表 #3/#5/#6/#8/#9/#10/#11 七项（文档去重 + 新鲜度守 + 文案 gate + 晋级台账 + §1 提纯）：

- **CODE-COPY-001 新增（#6，文案逐字契约机器兜底）**：`apps/web/src/apps/**.tsx` 新增行硬编码中文展示文案（非 `t()`/注释/日志）判 warn，催走 i18n + `03-api-contract.md §7 文案契约表` + 「值===原文」字面断言。原本文案逐字只有模板 checkbox 约束（PR-02022 有表仍意译、结构断言拦不住），现加结构信号兜底。谓词 `hasHardcodedDisplayCJK` 剥注释保字符串、放行 `t()`/日志/`// copy-exception`；补 5 条 self-test（rule 23→28）。
- **warn→error 晋级台账（#3）**：`rule-ids-and-gates.md §2.1` 原只有「连续 2 PR 零误报」判据却无处登记，靠人脑记不可复核。新增台账表（8 个 warn-first 规则各一行,记命中 PR/真命中或误报/累计连续数/状态）,满 2 行真命中即可提 error,误报归零重计。永久 warn 类（按阶段合法）不进台账。
- **全量扫 vs MSW 新项目隔离（#5）**：`§3` 补口径——MSW 新功能对 CODE-MOCK-004/005/006 恒 N/A（mock 不进生产路径）;全量扫命中的存量债按 finding 归属判,落在责任模块外用 `rule-waivers.json` 登记 known-debt(带 expiresAt),严禁关全量扫消音;落在模块内不可豁免。
- **context-summary 新鲜度自检（#9）**：模板与 `update-context-summary.mjs` 生成内容都加「若当前阶段早于最新 gate 则摘要过期,先重跑 --write」提示,防 AI 信旧快照决策。
- **模板演进不回填标注（#11）**：`feature-doc-checklist.md` 头部写明模板前向演进、存量项目不强制回填、旧文档缺新章节是时点差异非缺陷、硬闸类新关卡须在 CHANGELOG 记生效边界。
- **CHANGELOG 去重（#8，约定 + 去重本体）**：头部加写法约定（记「改了什么+为什么+生效边界」,引用正文权威表而非重抄,gate 计数只写一行）;并回改存量违约条目——两批 2026-07-20 条目里重抄的 gate 计数细目（专题/链接/ID/用例数）收敛成「self-test 通过,计数以脚本实时输出为准」一行,消掉会随脚本漂移的双写。核对 §8.4.1 MSW 试点表在日志中本就是引用形态（无重抄）。历史 07-16/07-14 条目按 #11 时点快照原则不回填。
- **§1 硬闸提纯（#10）**：`rule-router §1` 删两条与「定位」段及 §2/§1.1 重复的行（编码质量入口、docs_tdd 记录范围），改为一行指针「编码质量入口在 §2 与 §1.1」;§1 只留影响推进/交付判定的硬闸。常驻文件仍 <8000 字符,check-doc-budget EXIT 0。
- gate 全绿：`verify-code-rules` / `update-context-summary` / `verify-project-gate` self-test 与 `check-doc-budget.mjs` 均通过（用例计数以脚本实时输出为准，不在此重抄）。

## 2026-07-20

Review 后三项收敛（Mock 文档主路径前置 + `/code-review` gate 收紧 + stub 路由清理）：

- **Mock 路线 A 拆到 on-demand 文件**：`architecture-and-state.md §8` 原本 60% 篇幅是「已降级为遗留」的路线 A 拆除税（隔离原则/拆除的vs保留/拆除三道闸/构建期排除），却排在默认主路径 MSW 前面。现把路线 A 特有块（§8.0/§8.0.1/§8.0.3/§8.3）整体搬到新文件 `mock-legacy-route-a.md` 并**沿用原编号**（外链只改文件名、锚点号不变，改动面最小）；主文档 §8 开头改写为「默认 MSW 路线 B」纲领，只保留两路线通用关卡（§8.-1 主轴、§8.0.2 ASSUMED、§8.1 对账、§8.2 禁兜底）。新文件已进 rule-router §2 / README / common/README 三处索引。
- **VERIFY-G6-002 收紧（堵「写了就算做了」）**：原判据只要 `06-collaboration.md` 含「code-review」+「处理/findings」字样即 PASS——实测多个占位 review 明明是「待执行/待处理」却全被误判 PASS。抽纯谓词 `codeReviewFindingsResolved`：须记录 review + 处理结论 + **无未处理悬空项**（`待修复/未处理/待处理/未修复` 即 fail，须当场修或进 `rule-waivers.json`）；补 4 条 self-test（16→20 用例）。占位项目现正确判 FAIL。
- **stub 路由清理**：`rule-index.json` 的 `write_ui` 移除已上移 L1 的 `react-component-props-types.md` 空壳指针（避免写 UI 时被路由去读空文件）；`write_api_or_mock` 补 `mock-legacy-route-a.md`。
- gate 全绿：`check-doc-budget.mjs` EXIT 0、`verify-project-gate` / `verify-code-rules` self-test 通过（专题/链接/ID/用例计数以脚本实时输出为准，不在此重抄防漂移）。

## 2026-07-16

单一真值源收敛（消灭「项目/worktree 事实在多处手抄」的 drift）+ 一处 git 判据硬 bug 修复：

- **项目索引三轨 → 一轨**：同一「项目→状态→worktree」事实原本在 `README`/`AGENTS`/`CONTEXT` 三处手抄 + 自动生成的 `PROJECTS.md`，共 4 份；新项目只进了自动表，三处手抄全漏（还导致「按文档找不到 worktree、跑主仓误判代码不存在」的连环误判）。现三处手动清单删除、改为指向 `PROJECTS.md` 的指针；CONTEXT 只保留 PROJECTS.md 给不了的「当前焦点/下一步/易踩坑位」叙述。
- **worktree 归属自动派生**：`update-project-index.mjs` 新增 Worktree 列，数据直接来自 `git worktree list`（分支 `feature/<ID>`/`fix/<ID>`），不再手工登记；已回收项目显示 `—`。端口不再固定登记（运行时 `PORT=4xxx pnpm dev` 按需传，见 `coding-worktree.md §2.1`）。加 self-test 覆盖 worktree 列渲染与空占位。
- **加 gate 焊死（check-doc-budget 校验 10）**：手动导航文件（README/AGENTS/CONTEXT）禁止再出现硬编码项目清单行（判据只拦「表格数据行首格是 `PR-编号`」，不误伤单个指针引用）；带内联正/反自测防判据漂移，故障注入已验证（注入清单行即 EXIT≠0）。以后经 PostToolUse hook 当场拦「又抄回一份清单」。
- **git 基线校验方向修正（正确性 bug）**：`git merge-base --is-ancestor` 参数在 `coding-worktree.md`（脚本行为描述 + Agent 检查点）与 `git-branch-flow.md §1` 三处写反成 `HEAD origin/online`，会在「从陈旧本地 online 切出」这一唯一要拦的场景反而误判通过。统一为 `origin/online HEAD`（online 是 HEAD 祖先），与 gate `verify-project-gate.mjs` GIT-G4-002（本就正确）对齐。全库审计无残留。
- **GIT-G4-002 去误报（判据过严）**：原判据 `origin/online is-ancestor HEAD` 把「feature 切出后 online 正常前进」也判 FAIL。改为 `classifyBaseline` 三分支——与 online **无共同历史**（从 dev/test 切）判 `error` 阻断；有共同历史但 online 已前进（基线合法、只是不再最新）降 `warn` 只提示；完全最新照旧 pass。加 3 条 self-test（16 用例）。
- **run-project-gate 定位 bug（symlink 拽回主仓）**：聚合器 spawn 子 gate 时用 `cwd: repoRoot`，而 `repoRoot` 经 symlink 解析恒指向主仓（常停 `dev`），推翻了 `verify-project-gate` 内部用 `process.cwd()` 认 worktree 分支的修复——导致经聚合器跑 G4 时 GIT-G4-001 误报调用者 worktree 分支。改为传调用者真实 `callerCwd`。
- gate 全绿：`check-doc-budget.mjs` EXIT 0（含新校验 10 + 两脚本 self-test）。

## 2026-07-14

本地 docs_tdd 自动化闭环优化（不污染项目根配置；`apps/web/docs_tdd` 仍是本机自用、不提交）：

- **一键 gate + 证据落盘**：新增并加固 `common/agent-scripts/run-project-gate.mjs`，统一执行 `verify-project-gate`，G5+ 同步跑 `verify-code-rules --project`，并在 `--write` 时生成 `agent/gate-results.json` + `evidence/gate/<date>-<HHmmss>-g*/README.md`；`--refresh-index` 先写 gate JSON、再刷新 `PROJECTS.md`、最后写 evidence，命令结果统一落入 `commands` 摘要。
- **代码规则跳过收紧**：G6/G7/G8 使用 `--skip-code-rules` 必须带 `--skip-code-rules-reason`；reason 同步写入 `gate-results.json` 和 evidence Summary，避免无痕跳过。
- **G8 自举修复**：`VERIFY-G8-001` 现在接受 `verify-project-gate.mjs --write` 和 `run-project-gate.mjs --write` 两种真实来源，避免聚合脚本生成的合法交付证据被旧规则误判。
- **入口口径收敛**：`common/README.md` 新增“本地脚本入口”，明确不往根 `package.json` 加 docs_tdd 命令；`execution-evidence.md` 和 `feature-doc-checklist.md` 改为优先使用 `run-project-gate.mjs --write`，并继续强调 `docs_tdd` 管项目工程证据，代码质量细则交给 Codex 配置 / skill / `.cursor/rules`。

---

两次线上事故（mock 残留合入 online、文案未按 PRD 自作主张）复盘，把「前置策略」写死进规则，不做事后加门禁的消极补救：

- **mock → MSW 强制路线（确认已落，无新增）**：核对现状——`architecture-and-state.md §8.4.1`（MSW 升新功能强制路线）、`rule-router §1`、`workflow-gates G3`、gate `CODE-MSW-001~004`、模板 `03 §0/§6/§6.1/§6.2` 全套已在；`start-new-project.mjs` 经 `readTemplate` 复制完整模板，新项目起步即带 MSW 清单+文案契约表。MSW 让 mock 从不进生产代码路径，结构上不可能残留——「前置解决」而非门禁补救。
- **文案 → 逐字契约（本次新增落盘）**：原规则只要求「建文案契约表」，拦不住「有表仍意译」（PR-02022 反面案例）。补齐逐字硬性——`architecture-and-state.md §7.1` 加「默认中文逐字 copy 原文、禁意译 + 值===来源原文字面断言测试」硬条款和「文案只是按需求原文不想当然的一个实例」泛化；`rule-router §1`、`development-rules`、`quality-checklist`（新增 G6 逐字核对项）、模板 `03 §7`（新增逐字自检项 + 断言测试项 + 列名标注）同步。
- **判据**：结构断言（key 存在/渲染/不溢出）≠ 文字对；只有「值 === 来源原文」字面断言锁得住语义漂移。文案值与字段名同理——契约已写死的照搬，不自行改写。

## 2026-07-11

编码手艺三层剥离固化（docs_tdd 只管工程/流程/准入准出，高质量代码规则跟全局+仓库配置走，换仓自动生效）：

- **放置标准升为四层唯一真值源**：`rule-inheritance.md` 新增 §0「载体分层」（L1 全局 / L2 仓库 / L3 docs_tdd 按生效范围分层）+ §3 表格扩层 + §4 禁止错层，解决它原本「所有通用规则→`common/`」与新方案的冲突，放置口径不再双写。判据口诀：纯编码手艺→L1；编码手艺+fameex 锚点→L2；门禁/流程/项目→L3。
- **L1 全局**（换仓即用、无锚点）：`~/.claude/CLAUDE.md` 六条短硬规则（命名入参类型 / DRY 阈值 / 查表替 if 链 / 300 行上限 / 活注释 / 禁假默认掩盖空数据）+ skill `coding-quality`（数据态清单 / 查表 resolver / Page Visibility）+ skill `figma-read`（读原子节点 / cornerRadius / 圆形判定 / 读不到降级）。
- **L2 仓库**（通用原则 + fameex 锚点，glob 触发，team&CI 共享）：`.cursor/rules/*.mdc` 7 个——`arch-layering-and-reuse` / `arch-api-and-schema` / `state-server-vs-client` / `ui-tailwind-token` / `ui-theme-tokens` / `ui-responsive-h5` / `i18n-static-keys`。
- **docs_tdd 改指针不留副本**（防三处漂移）：`react-component-props-types.md` 全文→stub 指向 L1；`development-rules.md §5/§6/§7` 编码手艺条→指针，只留 G4 流程要点；`figma-mcp-read-workflow.md` 顶部加 skill 指针，正文保留（被 `component-reuse §3.1` 带锚点引用 + 是落盘流程核心）；`rule-router.md §2` Props 行标「已上移 L1」。
- **退役一次性迁移清单**：根目录 `MIGRATION-PLAN-code-quality-split.md` 已删——内容被本条目 + `rule-inheritance.md §0` 完全取代，留着即双写。稳定口径见 `rule-inheritance.md`，历史见本日志（对齐「用 CHANGELOG 取代按日期命名的一次性报告」的既定做法）。
- gate 全绿：`check-doc-budget.mjs` EXIT 0、`verify-code-rules.mjs --self-test` 通过。`.cursor/rules/*.mdc` 提交时机待用户拍板（会 push 给 team/CI）。

## 2026-07-10

执行力最后一公里（gate 从「靠自觉」到「自动强制 + 自我守护」）：

- **gate 真正自动运行**：新增项目级 `.claude/settings.json`，把 `claude-posttooluse-gate.mjs` 挂进 PostToolUse hook（`$CLAUDE_PROJECT_DIR` 可移植），编辑 `apps/web/src`、`package.json`、env、`docs_tdd/common` 即自动校验，不再依赖手动跑。`hook-integration.md` 的示例从此有真实落点。
- **pre-commit 挡规则漂移（已回退）**：曾在 `.husky/pre-commit` 加 `docs_tdd/common|templates` 变更时跑 `check-doc-budget.mjs` 的守卫；因 `docs_tdd` 被 git 排除（本机 local-only 工具，不入库），该守卫在 team-tracked 的 `.husky/pre-commit` 里是死代码，已还原原始 3 行。budget 校验改由上条 PostToolUse hook 运行时触发。
- **两个核心裁决脚本自我守护**：`verify-code-rules.mjs` 与 `verify-project-gate.mjs` 各加 `--self-test`，并纳入 `check-doc-budget.mjs` 的 `SELF_TEST_SCRIPTS`（现 6 个自测入口）。逐行 diff 规则抽成纯函数 `scanAddedLine`、阶段 gate 判定抽成纯谓词（`recordsPrdSource`/`recordsG2Confirmer`/`featureRowsMissingStatus`/`findBlockingPlaceholders`），每条规则一正一反锚点用例（含注释/字符串关键字、`as const`、`JSON.parse`、`rgb(var())`、奇数 px 等历史假阳性形态）。故障注入验证：改坏 `CODE-TYPE-002` 前瞻，自测精确报出 `as-const` 回归。行为回归：PR-01947 G2 仍 21/21。

三条 coding 约定固化（纯文档，无新 gate/rule ID）：

- **i18n 静态全键约定**（`development-rules.md` §7 + `quality-checklist.md`）：默认写 `t('namespace:key')` 吃 i18n Ally 所见即所得 + 全局可 grep + 可静态提取；确需动态取文案时须保留静态可 grep 前缀（`ns:enum.`）+ 有界枚举后缀 + `Record` 收敛映射，禁整键裸变量 `t(keyVar)`。
- **API 层范式锚点**（`architecture-and-state.md` §3）：立 `services/api/prediction/polymarket.ts` 为「新文件照此形状写」样板（`getQuery`/`getMutation` + `getUrl` + `transfer: schema.parse(toCamel(data))` + 稳定 `xxxQueryKey` 工厂 + 请求类型命名 + JSDoc）；「组件禁 fetch」扩为「service 层走 `getQuery`/`getMutation` 不裸写 `fetch`/`axios`」。
- **决策：i18n 动态键与裸 fetch 均不上机器 gate**。实测动态键（14+ 处 `t(`ns:enum.${x}`)` + 大量 `t(varKey)` resolver）与 `getQuery/getMutation` 范式（137 文件用、仅 1 处裸 fetch）都是广泛既有写法，blanket gate 会大量误伤合法代码、侵蚀信任，违反 warn-first + changed-file-only 铁律，故只做文档约定；规则① 复用优先已由 `architecture-and-state.md` §2 + `DOC-REUSE-001` 覆盖，未改。

## 2026-07-07

批次 3（扫描精度）+ mapper/mock 去重 + 批次 5（新机器规则）：

- **CODE-TYPE-001 / CODE-STYLE-002 反误报**：先剥注释/字符串再匹配 `any`（`// returns any`、`'any'` 不再误报）；颜色规则剥注释 + token 定义文件白名单（theme/tokens/palette/tailwind.config），`// see #1234` 与合法 hex 定义不再误判。
- **CODE-FILE-001 数据文件豁免**：300 行上限豁免 test/spec/fixture 与纯数据文件（constants/i18n/locale/generated），对齐 development-rules。
- **base ref 告警**：`origin/online` 不可解析时 stderr 显式告警，不再静默只扫本地。
- **mapper 四类去重**：「四类」枚举收敛到 architecture-and-state §3.1 唯一源，development-rules / quality-checklist 改为引用不复述；G8 文档口径与实现对齐。
- **CODE-ASSUMED-001（warn，G5+）**：责任模块残留 `// ASSUMED:` = 对账未销账（§8.0.2），rg 不可用时静默跳过。
- **CODE-SCOPE-001（warn，G5+）**：改动落在责任模块目录白名单外 = 越界（change-scope-boundary §1.1），跨模块重构可能合法故 warn + 重点 check。
- 责任模块扫描统一在 worktree（`gitCwd`）求值，与 G4 修正同理，避免 symlink 解析回主仓漏看改动。

批次 1（台账 + housekeeping）+ 批次 2（gate 正确性）：

- **项目级静态 gate**：`verify-code-rules.mjs` 支持 `--project <PROJECT-ID>`，默认读取项目 `agent/rule-waivers.json`；脚手架、上下文模板、证据模板和质量清单统一推荐项目级命令。
- **G8 证据质量加固**：`VERIFY-G8-001~004` 现在分别校验 `gate-results.json` 来源、项目匹配、阶段为 G8、且 `summary.fail=0`/`ok=true`，不再只认「像脚本写过」。
- **全仓 mock 扫描显式化**：新增 `--global-scan/--no-global-scan`；普通 changed-file gate 保持只扫变更文件，`CODE-MOCK-004/005` 仅在全量 gate 或 env 安全场景启用。
- **Hook 接入文档与调度**：新增 `hook-integration.md`，PostToolUse dispatcher 覆盖 `apps/web/src`、`package.json`、env 文件和 docs_tdd 规则文档；env 变更自动加 `--global-scan`。
- **真实 fixture 对账模板**：新增 `real-fixture-reconcile-test-template.ts` 并接入 API 契约模板，用真实响应 fixture 检查 schema parse 是否静默剥字段。
- **模板存在性校验**：`check-doc-budget.mjs` 现校验 7 个核心模板存在，避免索引提到但模板缺失。
- **README 索引覆盖校验**：`check-doc-budget.mjs` 现校验 `common/README.md` 专题全索引覆盖全部专题文件，避免人工查阅入口漏新规则。
- **Markdown 断链校验**：新增 `check-doc-links.mjs` 并接入 `check-doc-budget.mjs`，校验 `common/` 与 `templates/` 中本地 Markdown 链接的目标文件存在；跨文件 `#anchor` 禁用，统一写文件链接 + 章节号文字，避免中文 slug 规则跨渲染器误判；`check-doc-budget.mjs` 会运行其 `--self-test`。
- **公共脚本引用校验**：`check-doc-budget.mjs` 会扫描 `common/` 与 `templates/` 中直接写到的 `common/agent-scripts/*.mjs`，防命令示例、JSON 或代码块引用不存在的公共脚本。
- **模板引用校验**：`check-doc-budget.mjs` 会扫描 `common/` 与 `templates/` 中直接写到的 `templates/*`，防说明、代码块或脚手架字符串引用不存在的模板文件。
- **恢复摘要自动化**：新增 `update-context-summary.mjs`，从项目 feature inventory、collaboration 和 gate-results 生成固定结构的 `agent/context-summary.md`；功能清单按表头定位 `本期` 列，并用 `--self-test` 防列位漂移，`check-doc-budget.mjs` 会运行该自测和 fixture 对账自测。
- **G4 gate 定位修正**：`verify-project-gate.mjs` 的 `GIT-G4-*` 改用 `process.cwd()` 的 git toplevel 求值，不再因 worktree 里 `docs_tdd` symlink 解析回主仓而恒判分支不符。
- **G5 责任模块字段对齐**：gate 现从 `00-feature-inventory.md` 或 `agent/context-summary.md` 任一读「责任模块目录」，并过滤 `待*` 占位；脚手架 feature-inventory 补该字段行。
- **G8 证据反糊弄**：`VERIFY-G8-001` 改查 `gate-results.json` 含 `generatedAt`+`tool`（须由 `--write` 真实产出）；脚手架不再预建空 `gate-results.json`。
- **PostToolUse 反误阻断**：`verify-code-rules.mjs` 在 `--files` 模式下跳过全仓 `CODE-MOCK-004/005` 扫描，避免别处存量残留阻断无关单文件编辑、并避免 git grep 撞 hook 5s 超时。
- **rule ID 台账**：`rule-ids-and-gates.md` §5 补齐全部阶段 gate ID 台账；`check-doc-budget.mjs` 新增校验 5——脚本里的每个 rule ID 必须登记进台账，否则失败。
- **还原度判定单一源加固**：`≥95%` 在 `browser-e2e-mcp.md`、`verification-division-of-labor.md` 补链到 [component-reuse §3.0](./component-reuse-and-visual-fidelity.md)（清单逐项 pass 为准，`≥95%` 是简写）；修正 verification-division §5 悬空修订引用。
- **housekeeping**：`CONTEXT.md` 主仓分支 `dev`→`online`；清理 `.DS_Store`；旧 `automation-upgrade-report-2026-07-05.md` 内容并入本日志。

## 2026-07-05（原 automation-upgrade-report）

把 `docs_tdd` 从「文档先行 + Agent 自觉执行」推进到「关键规则可机器 gate」，代码静态扫描只 review 新加/已改代码：

- 新增 `rule-ids-and-gates.md`、`execution-evidence.md`（补 `log-exec.mjs` 断链）。
- 新增项目阶段 gate `verify-project-gate.mjs`、changed-file-only 静态扫描 `verify-code-rules.mjs`。
- 更新 `rule-router.md`/`common/README.md`/`workflow-gates.md`/`quality-checklist.md`/`project-doc-structure.md`/`feature-doc-checklist.md`，把 gate 纳入 G2/G6/G8 出口。
- `start-new-project.mjs` 自动生成 gate 命令说明、`gate-results.json`、`rule-waivers.json`。
- 新增 `startup-prompt.md`（新需求启动口令）、`rule-index.json`（机器可读场景路由）、`templates/context-summary-template.md`。
- `rule-waivers.json` 豁免（owner/reason/expiresAt，过期仍拦）与 `--write` 落盘 `gate-results.json` 落地。
- changed-file 策略：文件级规则只作用 changed files、内容类只看 diff 新增行；机器规则 `CODE-FILE-001`/`CODE-STYLE-001/002`/`CODE-TYPE-001`/`CODE-ARCH-001`/`CODE-E2E-001`/`DOC-REUSE-001`。
