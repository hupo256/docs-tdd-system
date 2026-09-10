# 规则执行保障模型

> 本文只定义规则如何被发现、执行、举证和阻断，不复制 L1/L2/L3 的规则正文。规则 ID、严重度和机器检查项仍以 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 为唯一真值源。

## 1. 落实标准

一条规则写进 Markdown 不等于已经落实。规则进入正式使用前必须形成以下执行契约：

| 字段 | 必须回答的问题 |
|------|----------------|
| Trigger | 哪个阶段、场景、文件或风险变化会触发规则？ |
| Source | 权威正文位于 L1、L2 还是 L3？是否只有一个维护入口？ |
| Loader | Agent 如何确定性加载：常驻入口、skill、glob 还是 context pack？ |
| Executor | 由格式化器、类型系统、测试、静态扫描、阶段 gate、Review 还是人工验收执行？ |
| Evidence | 通过或失败记录在哪里，能否关联命令、文件、Git/ruleset fingerprint 和责任人？ |
| Failure | 命中后是提示、诊断、阻断还是限时豁免？由谁修复和重跑？ |

缺少 Trigger/Loader 的规则会被漏用；缺少 Executor/Evidence 的规则只能算建议；缺少 Failure 的规则无法形成门禁。新增 L3 硬规则必须给 Rule ID，并按“触发 → 动作 → 证据 → 失败处理”写清执行契约。

规则载体还必须标记 `Visibility`：`personal-local` 或 `team-tracked`。个人规则默认 `personal-local`，只能写用户目录或经 `.git/info/exclude` 排除的 `docs_tdd`；任何 tracked 仓库文件都属于 `team-tracked`，没有用户明确批准不得写入规则、hook 或 gate。

## 2. 当前执行链

| 时点 | 执行动作 | 落实机制 |
|------|----------|----------|
| 会话启动/恢复 | Codex、Claude Code、Cursor 的 adapter 先读 `rule-router.md`，再执行 `docs-tdd context <PROJECT-ID> <SCENARIO>` | 入口先验证 L3 与 effective 两层发布指纹，再由 `rule-index.json` 按场景生成 context pack；编码场景须先过 G2，并写带客户端、三层 fingerprint、G2 输入与 HEAD 的 24 小时 `rule-session.json` v2；编辑中的未发布规则或其他客户端的旧会话不能被消费 |
| Lark 无人值守执行 | Lark-Codex / Lark-Claude 在每次启动 AI 前抽取任务语义对应的规则章节 | **常驻必需**规则文件或章节缺失以 `VERIFY-RULE-004` 阻断（缺了等于裸跑）；辅助章节缺失只记 warning 并浮现到结果卡、审计与 `/lark/health`。发布层 stale 检测已下线（规则消费改 pin-based，`docs-tdd rules status` 才是主动查询发布落后的入口）；上下文仍绑定两层发布指纹用于审计 |
| 编码前/首次编辑 | 按变更类型加载 L1、L2 `.cursor/rules` 和 routed L3 专题 | Cursor 原生消费 L2；Claude `UserPromptSubmit`、Codex `SessionStart`、Pi `before_agent_start` 首轮前预送 blocking 全文与 advisory 目录，PreToolUse/tool_call 只做覆盖确认/回执。blocking/advisory/单事件预算分别为 8/4/16 KiB；单条 blocking 超限直接阻断并要求拆分 |
| 编辑后 | Claude/Codex PostToolUse 写入按 session、文件与规则指纹绑定的累计回执，并对本次单文件/多文件改动立即执行代码检查 | `changed` 与 G5+ 校验本会话全部 touched files；PreCompact/HEAD 变化只轮换注入 epoch，不清审计基线、receipt 或 taint。绕过 hook、规则或内容过期即阻断 |
| 阶段出口 | 执行 `docs-tdd gate <PROJECT-ID> <Gx>`，G5+ 聚合代码扫描 | `error` 退出码阻断；G6/G8 用 `--write` 生成机器结果和 evidence，规则或工作树变化后旧证据失效 |
| 判断型验收 | G6 `/code-review` + Browser/Playwright + 必要人工视觉/语义确认 | 处理静态规则无法可靠判断的复用、架构、业务语义和视觉手感；findings 必须逐项已修、豁免或阻塞 |
| 规则维护 | 更新权威正文、适配器、场景路由、Rule ID/gate、自测和 CHANGELOG | 先发布 L3，再执行 `effective-rules.mjs --write` 发布 L1+direct adapter+Lark runtime adapter+L2+L3 组合指纹；五个入口只消费两层都 fresh 的版本 |

预送事件证明模型规划前已收到规则，PreToolUse/tool_call 证明当前文件的 blocking hash 已覆盖，PostToolUse/tool_result 回执绑定本次写入；规则新鲜度绑定 sourceHash，普通 HEAD 变化不重复灌入，SessionStart/PreCompact 或规则正文变化才重置。每次真实注入追加不含 prompt/正文的 NDJSON 指标（客户端、工作流、目标类别、字节数、首改耗时、重试/人工介入观测位）；最终边界仍是 `changed`/阶段 gate。安装器优先保留已接入相同 gate 的团队 Husky；仅在缺失时才以个人 `core.hooksPath` 追加 pre-commit 兜底并链回既有 hook。Cursor 无可信 PostToolUse 时仍须显式运行 `changed`；未检测到 CI 时不得宣称团队 CI 已承接。

## 3. 执行强度

规则按可判定性选择最强但可信的执行器，不把脆弱正则包装成全面保证：

| 等级 | 适用规则 | 保障方式 |
|------|----------|----------|
| Mechanical | 格式、类型、明确禁用语法、文件/字段存在性 | Biome、TypeScript、schema、测试或静态 gate；高置信规则可直接 `error` |
| Structural | 分层、依赖方向、重复写入口、Mock 注册链、范围越界 | AST/依赖图/manifest/定向扫描；无法完整机器判断时采用“机器候选 + G6 Review” |
| Judgment | PRD 语义、抽象是否合理、视觉手感、业务规则正确性 | Review/Browser/人工验收；必须使用结构化 checklist 和逐项结论，不能只写“已检查” |

严重度只允许三种执行语义：`diagnostic` 只收集数据，`warn` 必须在交付摘要可见，`error` 阻断 gate。warn-first 规则按 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 的真实 PR 零误报台账晋级，长期合法例外不得伪装成待晋级 WARN。

## 4. 防止规则失效

1. **单一维护源**：同一规则只在一层维护正文；其他载体只保存触发器、指针或项目差异。脚本中的 Rule ID 必须回链台账，不再复制一份规则描述清单。
2. **规则即测试**：每个机器规则至少有一个应命中、一个不应命中的自测；修复误报时先加入回归样例。无测试的正则不得直接从 warn 提升 error。
3. **证据绑定状态**：机器证据至少绑定 ruleset、L3 发布指纹、effective rules 指纹、Git HEAD/base、dirty hash 和执行时间；代码或规则变化后必须重跑，不能复用旧 PASS。
4. **失败默认可见**：脚本失败、未运行、输出 `0 files`、环境阻塞和跳过都不能写 PASS。跳过必须记录原因；G6-G8 跳过代码规则时原因进入 gate JSON/evidence。
5. **豁免有生命周期**：豁免必须有 ruleId、reason、owner、expiresAt；过期或非法豁免不生效。高风险事实规则可设 non-waivable。
6. **只拦本次新增债**：默认检查 changed files/added lines，存量问题单独登记 known debt；全量扫描只用于生产 mock 泄漏、密钥等少量上线风险。
7. **定期删规则**：重复、失去触发场景、长期零命中或已被类型系统/框架替代的规则应合并或退役，避免 context 噪声降低真正硬规则的执行率。
8. **不静默扩大影响面**：规则从 `personal-local` 提升为 `team-tracked` 必须单独列出目标文件、团队收益、误报数据、回退方式并获得明确批准；不得把个人 gate 顺手塞进业务提交。

## 5. 规则发布与消费

规则源只有两种状态：编辑态和已发布态。维护者优先执行 `docs-tdd release <PROJECT-ID> --scenario <SCENARIO>`：依次 check/golden、发布 L3、发布 effective、doctor、完整 golden 和 context smoke，任一步失败恢复两份旧 manifest。底层仍分别由 `rule-release.mjs --write` 与 `effective-rules.mjs --write` 生成清单；effective 发布会直接验证当前 L3 内容 fresh、Cursor adapter 与生成器逐字一致、五入口全集与 source matrix 一致、Lark runtime adapter 已纳入 fingerprint，且 L2 无未解决冲突。个人覆盖只能来自 gitignored 的 config，必须声明 winner/loser 并进入 adapter、context 与 effective fingerprint；未登记冲突仍阻断。

`docs-tdd context/changed/gate` 与 `run-project-gate.mjs` 直达入口在执行前校验两层 freshness。任一清单缺失、损坏或输入漂移时退出 1；`check`、`capability`、`doctor` 仍可运行。context pack、新 gate evidence 与 Lark task audit 同时携带 L3 和 effective 指纹，从“声称读过某版本”升级为“能证明五个入口消费了哪组实际内容”。

## 6. 新规则准入与复盘

新增规则按以下顺序落地：

1. 用真实缺陷说明要防止的失败模式，并按 `rule-inheritance.md` 选择唯一权威层级。
2. 先定义 Trigger、适用边界、反例和误报成本，再选择执行器；不是先写正则。
3. 能机器判断则分配 Rule ID、严重度和自测；不能机器判断则定义 Review checklist、证据格式与确认责任人。
4. 把规则接入 `rule-index.json` 的最小场景，不把全文塞回常驻路由。
5. 运行 `check-doc-budget` 和相关脚本自测，依次执行 `rule-release.mjs --write`、`effective-rules.mjs --write`；再跑 `doctor` 并选一个活跃项目验证 context、changed 和对应 gate。
6. 在 CHANGELOG 记录生效边界；新规则默认前向生效，除非是安全或数据正确性风险并明确要求追溯。

每月或累计 5 个真实项目后做一次规则健康检查。以下是渐进 warn-first 规则从观察到晋级或退休的完整生命周期与口径真值源（[rule-ids-and-gates.md](./rule-ids-and-gates.md) §2.1 只列当前 warn 项并指回本节）：

- **warn → error 晋级判据（防「永久 warn」）**：渐进 warn-first 的规则不是永远 warn。满足全部即提 error：① 连续 **2 个真实 PR** 命中该规则且**零误报**（误报=规则报了但人工判定不该报，如 lang-locale 类、流程控制类 if）；② 命中项都能给出明确修法（非「无法处理」）。达标后把脚本里该 finding 的 `'warn'` 改 `'error'`、更新 §2.1 warn 项列表、在 PR 里记一句「CODE-XXX warn-first 达标，提 error」。**未达标不提**——误报会 error 卡正常交付，比漏报更伤信任。
- **晋级台账（机器记录，取代手填表）**：判据 ① 靠人脑记不住也无法复核，且手填表长期为空。改为机器台账 `common/warn-ledger.json`，由 `warn-ledger.mjs` 维护：
  - **自动记录**：`docs-tdd gate --write`（G5+）命中可晋级 warn 规则时，自动按 `(ruleId, PR)` 入账（一 PR 一格，verdict 默认 `unreviewed`），无论 gate PASS/BLOCK。
  - **人工复核**：`node warn-ledger.mjs --mark <RULE> <PR-xxxxx> <true-positive|false-positive> --write` 标注真命中还是误报（误报请在 PR/CHANGELOG 记形态供改正则）。
  - **晋级候选**：`node warn-ledger.mjs --report` 计算——某规则满 **≥2 个 true-positive PR 且零 false-positive** 即列为 `ELIGIBLE`；任一 false-positive 使其失格（误报归零重计）。
  - **范围**：仅登记计划晋级的 warn-first 规则（`warn-ledger.mjs` 的 `PROMOTABLE` 集）；`CODE-MOCK-001/002`、`CODE-MSW-003`、`CODE-ASSUMED-001`、`CODE-SCOPE-001` 等「按阶段/场景合法」的永久 warn 不进台账。`warn-ledger.json` 是可变执行状态、不参与规则内容指纹（已在 `rule-release` 排除）。
- **90 天退休：观察期的默认结局是退休，不是永久 warn**。晋级判据要求人工裁决，而裁决可以永远不发生——台账曾全是 `unreviewed`，`eligible` 永远算不出来，规则实际停在「天天刷 warn、没人负责、也永不晋级」。判定源 `lib/warn-retirement.mjs`：某规则**首次命中起满 90 天、一次裁决都没有**（TP=FP=0）→ 自动降为 `note`（`verify-code-rules` 不再报 WARN、也不再累计入台账），并列入**待退休**。**沉默 = 撤下**：想留下它就 `warn-ledger.mjs --mark <RULE> <PR-xxxxx> true-positive --write` 裁决一次即回观察期；确认没人认的直接把 finding 从脚本删掉。待退休与 Top-N 高频 warn 写进 **G8 交付摘要 §5**（`lib/delivery-summary.mjs` 调 `renderWarnLedgerSection`）——台账文件没人主动打开，G8 那页是每次交付必读的。
- **规则体检入口 `docs-tdd rule-health`**（本节这条「定期复盘」的机器实现，取代靠记性）：① warn 台账逐条（累计命中 / 涉及 PR 数 / 首末命中时间 / 裁决分布 / 结局）；② 门禁命中分布（各项目 `gate-results.json` 的**最近一次**运行，是快照非终身累计）；③ **零命中清单**（已声明 ID 减去上面两处出现过的）。零命中有两种、机器分不了：预防型规则场景没发生（正常），或判定从来没咬到东西（形同摆设）——只有后者才该删，报告只摆到眼前、不代人拍板。

它输出数据，不代人拍板：无数据时不得凭感觉晋级。优先修复“规则未加载/未运行/证据陈旧”这类执行链缺陷，再增加新规则正文。

## 7. 机器事实层执行契约（`VERIFY-*` 真跑工具链）

Rule ID 与严重度以 [rule-ids-and-gates.md](./rule-ids-and-gates.md) §3.5 为真值源；本节固化其执行契约（§1「落实标准」的具体实例）。

- **Trigger**：`docs-tdd gate <PROJECT-ID> G6|G7|G8`；也可手动跑单个改动文件集。
- **Source**：本脚本即 Executor，不存在「文档说跑过」这条通路。
- **Loader**：G6 场景 `g6_verify` 加载 [quality-checklist.md](./quality-checklist.md) 与本节。
- **Evidence**：命令、退出码、日志路径写入 `evidence/gate/**/README.md` 的 Command Evidence 与 Summary「机器事实层」行；完整输出落 `/tmp/docs-tdd-logs/<PROJECT-ID>/`。
- **Failure**：`VERIFY-BIOME-001`/`VERIFY-TYPE-001`/`VERIFY-TEST-001`/`VERIFY-BUILD-001`（无理由跳过）阻断 gate，当场修或按 rule-ids-and-gates.md §4 登记有期限豁免；两条 warn 进 warn 台账。

## 8. Golden run（回归 gate 机器自己）

各脚本的 `--self-test` 只覆盖导出的纯谓词，覆盖不到「规则 ID 有没有真的连到判定、聚合器还能不能跑起来、规则改宽后有没有误伤旁边的项」。`golden-run.mjs` 填这一层（§4 第 2 条「规则即测试」的跨规则实现）：把 `common/engine/fixtures/golden-project` 物化成保留 ID 项目 `PR-00000`（模板 v2 基线刚好通过 G0/G1/G2/G3/G6），再逐个变异用例只破坏一处，断言预期规则 ID 正好命中且不牵连基线之外的 error 规则。

```bash
docs-tdd golden                 # 完整跑（含聚合器烟测，需指纹链已发布）
docs-tdd golden --verbose       # 逐条打印用例结论
docs-tdd golden --keep          # 保留 PR-00000 供手工排查
```

- **变异用例（22 条）**：覆盖结构、G0/G1/G2/G3、阻塞/豁免，以及 G6 的 `DOC-CR-002`、`DOC-AC-002/004/005` 接线；每条只破坏一处。
- **双向断言**：规则失效（该红不红）与规则变宽（连带误伤）都会 fail。故障注入实测：把 `DOC-G3-005` 改成恒真、把 `DOC-G0-003` 改宽，两类都被抓出。
- **发布即强制**：`rule-release.mjs --write` 在 `check-doc-budget` 之后跑 `golden-run --skip-aggregator`，不通过就拒绝发布。聚合器烟测（`run-project-gate PR-00000 G2`）需要**已发布**的新指纹，发布前跑不了，所以那一条留给发布后的 `docs-tdd golden`。
- **边界（不遮掩）**：G6 只覆盖结构化 Review/验收接线；G4+ 的真实分支 / 改动文件 / 工具链由 §7 机器事实层的真实执行负责。`prd-intake` 与 MSW 子链路在夹具里显式关闭，各自有 fixtures 与自测。
- **副作用**：不传 `--write`，不写 `gate-results.json` / `evidence/**` / `PROJECTS.md` / warn 台账；`PR-00000` 在 `finally` 里删除，且被 `check-doc-budget` 与 `update-project-index.mjs` 的项目扫描显式排除。
