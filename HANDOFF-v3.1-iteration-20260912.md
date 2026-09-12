# HANDOFF：v3.1 迭代交接（基于 PR-02233 首次真实实践）— 2026-09-12

> 面向：接手迭代 docs_tdd v3.1 的另一个会话。
> 来源：本次用真实需求 PR-02233（【用户端】安全验证校验交互优化，V2）首次跑通 v3.1「PRD→抽原子需求→独立冷读覆盖审查→实现」链路，累计 28 条观察。
> 完整原始记录：`practice-log/PRACTICE-LOG-v3.1-20260912.md`（O-1~O-28 逐条含现象/根因/代码位置/待定项）。
> 本文只提炼**可执行的迭代待办**，按优先级分组；每条给出问题、证据、建议改动、涉及文件。

---

## 0. 一句话结论

v3.1 的「先锁需求再写码」方向是对的，独立冷读审查确实能抓出自查抓不到的真实盲点（27+ 条发现里绝大多数非误报）。**但本次实践暴露：对大型 V2 PRD，v3.1 把大量「可枚举的机械规则」交给了昂贵且有噪声的模型审查去逐轮发现，导致 10 轮审查、数小时未收敛。核心修正是：抽取阶段加确定性自查门禁 + 给审查设轮次上限。**

---

## 1. P0 — 最高优先级（直接决定 v3.1 对大 PRD 是否可用）

### P0-1 抽取阶段缺确定性自查门禁（对应 O-22 / O-23）
- 问题：10 轮审查发现的绝大多数是**少数几类可枚举、确定性可检查**的机械缺陷，却靠模型审查逐条发现（每轮 6-10 分钟）。
- 证据：本次已写出一次性查全这些类的确定性脚本（秒级、无模型）：`/tmp/self-audit-02233.mjs`（项目内没保留，逻辑见 O-23）。它一次跑出的机械缺陷类：
  1. `evidencePlan.type` 声明了但无对应 kind 的 evidenceCommand；
  2. 引入新前端文案却未声明多语言/无 `copy-literal` 证据；
  3. `collectionSemantics.expectedCount` ≠ `affectedSurfaces` 数；
  4. 跨端功能漏 App-deferred surface；
  5. `runtimeRequired=true` 却无 `browser-interaction` 命令。
- 建议改动：把这些检查做成 `common/engine/agent-scripts/` 下的正式工具（带 `--self-test`，登记 `SELF_TEST_SCRIPTS`），并在 `docs-tdd run` 的 `complete-independent-review` **之前**插一个强制前置动作 `extraction-self-audit`：不过不允许送审。这样独立审查只处理真正语义盲点，发现数从两位数降到个位数、1-2 轮收敛。
- 涉及：`project-orchestrator.mjs`（动作编排）、新增 `lib/extraction-self-audit.mjs`、`vnext-work-item.mjs`（可复用现有覆盖判定）。

### P0-2 coverage review 无轮次上限（对应 O-22）
- 问题：审查可无限重跑，而它自身会偶发幻觉（见 P1-1），追「0 发现」可能追不完。
- 证据：autopilot 对 code/browser repair 各限 2 轮并 `escalate-repair-failure`；coverage review 没有对等机制。
- 建议改动：给 coverage review 设硬上限（如 3 轮），耗尽后输出 `escalate-coverage-review-to-human`，转人工裁决而非继续烧模型。
- 涉及：`vnext-autopilot.mjs` / `project-orchestrator.mjs` 的 review 循环，`work-item.json` 增一个 review 轮次计数。

### P0-3 大 PRD 的 work-item 抽取无脚手架（对应 O-13）
- 问题：抽取 21+ 需求要手写一个大 `work-item.json`（sourceAnchors/affectedSurfaces/evidencePlan/evidenceCommands/sourceUnitDispositions），无任何辅助。我只能自己写生成脚本，脚本本身又引入 bug（O-19/O-20）。
- 建议改动：提供 `docs-tdd extract --scaffold`：自动列出所有非结构 source unit 供逐条标 anchored/not-a-requirement，自动生成 evidenceCommands（surface×type 笛卡尔积）、自动核对 collectionSemantics 一致性。把手写巨型 JSON 的机会从根上消除。
- 涉及：新增 scaffold 命令 + `vnext-source-units.mjs` 复用。

---

## 2. P1 — 审查机制健壮性

### P1-1 独立审查会偶发事实性幻觉，且无申诉通道（对应 O-21）
- 问题：第 5 轮审查声称「R-007 没有 collectionSemantics」，但原始 work-item 里明确有 `{kind:'explicit-set',expectedCount:15}`，且它精确引用了其他 5 个需求的计数作对比——纯属看漏/幻觉。而 disposition 只能来自 reviewer 签名输出，**人工不能事后改判**，只能重跑赌运气。
- 建议改动：加「requirements author 对 finding 提事实异议」的通道——异议附机器可核验的反证（如指向 work-item 具体字段），CLI 机械复核该字段后可自动 resolve 该 finding，无需重跑整轮。
- 涉及：`vnext-coverage-review.mjs`、`vnext-review-receipt.mjs`。

### P1-2 大 PRD 多模态审查慢/易超时，且现状截图被全量附上（对应 O-15）
- 问题：27 张图全量附给 reviewer，默认 opus 网关超时；换 `uniaix/claude-sonnet-5` 才跑通（每轮 ~6-7 分钟）。且其中 ~17 张是「现状」截图（非新规格）。
- 建议改动：① 默认 review 模型选更快的多模态模型，opus adaptive-thinking 不适合；② 只把「承载新规格的图」附给 reviewer，现状截图降级为文本引用；③ 超时按图片数/字符数动态给。
- 涉及：`vnext-review.mjs`（`runReviewer` 模型默认值、imageFiles 筛选、timeout）。

### P1-3 `deliveryScope.includedRequirementIds` 语义反直觉（对应 O-14）
- 问题：字段名「included」暗示「本期交付」，实际要求「列全**所有**需求 id（含 deferred/not-doing）」，初次必填错。
- 建议改动：改名（如 `allRequirementIds`）或让报错信息直接说明「必须等于全部 requirementId」。
- 涉及：`vnext-coverage-review.mjs` `deliveryScopeProblems`。

### P1-4 bounded deliveryScope 要求 reviewer 自发产出 deferred-finding（对应 O-16）
- 问题：用 deliveryScope 后，`applyCoverageReview` 要求审查 findings 里必须有一条 owner/batch 完全匹配的 deferred finding，但 reviewer 模型不被引导必然产出 → 卡死。本次只能弃用 deliveryScope。
- 建议改动：该 boundary finding 由 CLI 从 work-item 自动合成，而非依赖模型自发输出。
- 涉及：`vnext-coverage-review.mjs`。

---

## 3. P1 — intake / source-units 数据完整性

### P3-1【已修，需回归】飞书图片同步：假 local 图 + 内嵌图未鉴权下载（对应 O-6）
- 问题：`sync-lark-docs.mjs` 用未鉴权 `fetch` 抓 `feishu.cn/file/...`，拿回登录页 HTML 存成 `.png` 并算 hash 标 `local`（架空「本地图片字节 SHA-256 绑定」）；docx 内嵌 `<img src=TOKEN>` 无 href 从不下载 → `missing`。
- 已做的修复（本次已落地并过 golden）：`lib/lark-prd-drift.mjs` 的 `localizeLarkMediaReferences` 产出结构化描述符（`classifyMediaUrl` + `sniffImageType` magic-byte 校验）；`sync-lark-docs.mjs` 走鉴权 `lark-cli docs +media-download`。
- 交接动作：确认这个修复符合你的预期；考虑把 magic-byte 校验推广到所有 source-units 落盘路径。

### P3-2 飞书表格全被识别成 text unit（0 table）（对应 O-11）
- 问题：`tableDelimiter` 要求 `-{3,}`，但飞书导出的 markdown 表是单连字符 `|-|-|` → 整表退化为 text；HTML `<table>` 更是从不识别。导致 V0-micro 的「无 table」约束可被绕过，且表结构语义丢失（如 60 行验收表挤在一个 text unit）。
- 建议改动：`tableDelimiter` 放宽到 `-{1,}`；识别 HTML `<table>` 块为 table unit（含拆行）。
- 涉及：`lib/vnext-source-units.mjs`。

### P3-3 验收标准表逐行覆盖无确定性枚举（对应 O-23 遗留）
- 问题：`验收标准` 表约 60 行，审查后期仍偶发命中「某行没映射到需求」。这类应做成确定性枚举而非靠审查逐轮发现。
- 建议改动：自查器（P0-1）里加一类：解析验收表每行，对每行产出「已被哪个 requirement 覆盖 / 未覆盖」矩阵，供一次人工确认。

---

## 4. P2 — 环境 / 发布 / 工程摩擦

### P4-1 消费仓缺 `docs-tdd.config.json`，roots 自检静默通过（对应 O-1）
- `fameex-web` 根/`apps/web/` 都无该文件，靠 default 跑；`roots.mjs --self-test` 退出码 0 却不打印 `roots: OK`，无正向确认。建议 `--self-test` 在用 default 时打印 `using default config (FameEX)` 提示。

### P4-2 上游 L1 漂移阻断新项目开工（对应 O-2 / O-5）
- 全局 `~/.ai-rules/AGENT.md` 改过、快照没重发布，`effective-rules stale` 阻断 `context`。命名撞车（workflowVersion:2 / 风险 V2 / effective-release）让用户误以为「要修被废弃的 v2」。建议 doctor/CLI 文案显式区分「这是规则快照发布，与 workflowVersion 无关」。

### P4-3 记录/日志类文件放 common/ 会污染 L3 发布指纹（对应 O-4）
- `rule-release` 遍历整棵 `common/`+`templates/`，任何新增 `.md` 都被当规则源、把发布弄 stale。本次把实践日志放到了仓库根目录规避。建议给 `common/vnext/journal/` 之类加白名单排除，或明确「实践日志放根目录」的约定。

### P4-4 纯引擎改动也拖 stale rule-release（对应 O-9）
- 改 `common/engine/**`（`classifyRuleFile` 已分类为 engine、由 golden/self-test 保证）仍算进发布指纹、要求重发两层快照，与代码注释自述矛盾。建议发布指纹只算 policy 类文件，engine 变更走 golden。

### P4-5 main-module 守卫经软链调用失效（对应 O-7）
- `import.meta.url === file://${process.argv[1]}` 经软链挂载路径直接 `node` 调用时不相等 → 脚本静默空跑 exit 0（最危险的假成功）。建议统一 `fileURLToPath`/realpath 归一后比较。影响所有用同模式守卫且可能被直接调用的脚本。

### P4-6 inbox 源变了但 run 不重归一化快照（对应 O-8）
- 修好图片后 `extracted.md` 变了，`run` 不重建 work-item.sourceSnapshot（仍冻结在 kickoff 旧数据）。无「重归一化 PRD 资产」命令，只能删 stub 重建（有 requirements 后就不能这么删）。建议 `run` 检测 inbox 源 hash 与快照不一致时提示 `resync-sources`。

---

## 5. P1 — 能力补全（本次已搭好，建议正式纳入）

### P5-1【已搭好，建议正式纳入】browser-interaction 的 CLI 可执行 adapter（对应 O-17）
- 背景：v3.1 文档提「已有外部 browser adapter」，但引擎里**从来没有**一个可 spawn 的浏览器证据 adapter，`browser-e2e-mcp.md` 描述的是 Cursor 专属交互式 MCP。非 Cursor 客户端（pi/Claude/Codex）此前无法产出 autonomous runtime 证据。
- 本次已做：`common/engine/agent-scripts/lib/playwright-mcp-adapter.mjs`——用 `@playwright/mcp --extension`（MCP JSON-RPC over stdio + `PLAYWRIGHT_MCP_EXTENSION_TOKEN`）驱动系统 Chrome，`--scenario <file.json>` 执行 `{tool,arguments,assert}` 步骤序列，退出码 0/1。已过 `--self-test`，并实测真实导航到 example.com 拿到快照。
- 边界（如实）：依赖开发者本机已装并登录 Playwright Chrome 扩展 + 个人 token（只走环境变量、不进任何提交文件）+ 有人在场的真 Chrome 会话；属**开发者本地证据**（类比 v1 G5-G8 人工确认，只是变成 CLI 可执行），CI 无浏览器不能重跑。
- 交接动作：① 把它写进 `vnext/README.md`「已有外部 browser adapter」的具体指向；② 在 `browser-e2e-mcp.md` 补「非 Cursor 客户端的 CLI 可执行路径」；③ 已登记 `check-doc-budget.mjs` 的 `SELF_TEST_SCRIPTS`。

---

### P2-1 用户人工授权无法持久化为实现阶段（对应 O-24）
- 用户明确叫停无意义的继续审查并授权进入实现后，work-item 仍为 `autopilot.phase=intake`、`implementation.status=pending`、`scopeApproval=null`，下一会话执行 `run` 会被重新导回 review。
- 建议增加带审计原因的 `scope-approve --human-override` / `begin-implementation` 状态迁移命令，使机器状态与真实用户裁决一致。

### P2-2 v2 缺实现中期检查，且 typecheck 无基线差分（对应 O-25 / O-26）
- `docs-tdd changed` 仅支持 v1；v2 在开始实现和最终 `verify` 之间没有可持久化的轻量检查。真实仓库全量 typecheck 又有大量存量错误，单看退出码无法判断增量质量。
- 建议为 v2 增加 `check`/`changed`，记录 changedPaths、范围映射及 scoped checks；类型检查支持 baseline-aware 差分，分别报告 `whole-command=failed` 与 `new-errors=0/N`。

### P2-3 已加载的 locale 规则缺确定性执行（对应 O-27）
- 仓库 `AGENTS.md` 已明确规定 Web 业务开发只改 `zh-CN` / `zh_CN`，但本次实现仍误改 9 个非中文 locale，说明“加载过规则”不等于“规则被执行”。
- 建议在 v2 `check` / `verify` 加 changedPaths 守卫：普通业务任务触达非简体中文 locale 直接失败；仅显式国际化同步任务可豁免。不要把同一规则再复制进 L3。

### P2-4 delivery guard 不应阻断阶段性 commit（对应 O-28）
- 当前 pre-commit 对 v2 每次提交都要求已有 current `latest-result PASS`；后端仍 pending、实现尚未最终交付时，合法 checkpoint 也无法提交。
- 建议区分 checkpoint 与 delivery：开发中提交只要求范围授权和 scoped checks；ready-for-delivery / PR / push 才要求最终 verify PASS。否则机制会诱导伪造 PASS 或使用 `--no-verify` 绕过全部 hook。

## 6. 关键产物索引

| 产物 | 路径 | 状态 |
|---|---|---|
| 完整观察日志 O-1~O-23 | `practice-log/PRACTICE-LOG-v3.1-20260912.md` | 本次产出 |
| 浏览器证据 adapter | `common/engine/agent-scripts/lib/playwright-mcp-adapter.mjs` | 已落地+自测 |
| 图片同步修复 | `lib/lark-prd-drift.mjs` + `sync-lark-docs.mjs` | 已落地+过 golden |
| PR-02233 work-item（示例产物） | `prds/PR-02233/work-item.json` | 24 需求，自查器全绿，未走最终 review/scope approval |
| 抽取自查器（原型，未入库） | 逻辑见 O-23，需按 P0-1 正式化 | 待正式化 |

## 7. 建议的迭代顺序

先做 **P0-1（自查门禁）+ P0-2（审查轮次上限）**，这两条直接解决「大 PRD 靠审查不收敛」的核心痛点；再做 P5-1（把已搭好的 browser adapter 正式纳入）和 P3-2（表识别）这类低风险高收益项；P4 环境类可穿插处理。
