# docs_tdd 框架变更日志

> 常驻路由的稳定目标（取代按日期命名的一次性升级报告，避免每次升级都新增文件并挤进路由表）。
> 每次对 `common/` 规则体系、gate 脚本、模板做实质升级，在顶部加一段「日期 + 变更」。
> **写法（去重）**：本日志只记「改了什么 + 为什么 + 生效边界」，不复制当前规则正文或证据表；当前口径统一引用 `rule-ownership.json` 指向的专题源。gate 计数只写一行结果，细目留在脚本输出。


> 更早的历史条目已归档到 [CHANGELOG-archive.md](./CHANGELOG-archive.md)（不进 context、不参与预算）。

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
- **新增 `agent-scripts/lib/blockers.mjs`（纯语义，含 17 用例自测）+ `common/schemas/blockers.schema.json` + `common/blocking-and-change-protocol.md`**：`verify-project-gate.mjs`（每个 gate）与 `render-delivery-summary.mjs`（G8 第 4/5 段）共用同一份判定，不各写一份。登记支持 `blocker`/`change` 两型，生命周期 `open → resolved` 必须带非空 `resolution`+`resolvedAt`（禁静默清零），`open` 的 blocker 必填 `blocksGate`（否则 gate 无从拦截）。
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
