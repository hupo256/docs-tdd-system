# docs_tdd 框架变更日志

> 常驻路由的稳定目标（取代按日期命名的一次性升级报告，避免每次升级都新增文件并挤进路由表）。
> 每次对 `common/` 规则体系、gate 脚本、模板做实质升级，在顶部加一段「日期 + 变更」。
> **写法（去重）**：本日志只记「改了什么 + 为什么 + 生效边界」，不复制当前规则正文或证据表；当前口径统一引用 `rule-ownership.json` 指向的专题源。gate 计数只写一行结果，细目留在脚本输出。


> 更早的历史条目已归档到 [CHANGELOG-archive.md](./CHANGELOG-archive.md)（不进 context、不参与预算）。

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

