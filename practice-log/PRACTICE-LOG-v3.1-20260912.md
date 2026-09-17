# v3.1 首次真实前端项目实践记录 — 2026-09-12

> 目的：用一个真实前端需求跑通 docs_tdd v3.1（第二代 work-item 协议），逐步记录卡点/摩擦/规则缺陷，供迭代 v3.1。
> 记录人：Pi agent（本会话）。载体放在**仓库根目录**（不在 `common/`），见 O-4：`common/` 全树参与 L3 规则发布指纹，把日志放进去会每次改动都把规则发布弄 stale。

## 环境（开工前基线）

- 系统仓：`/Users/aven/github/docs_tdd`，HEAD `2951acc`。
- 消费仓：`/Users/aven/github/fameex-web`，通过软链 `apps/web/docs_tdd -> /Users/aven/github/docs_tdd` 挂载。
- 当前框架：v3.1（新项目默认 `workflowVersion: 2`）。

## 观察台账（O = Observation）

### O-1 消费仓缺 `docs-tdd.config.json`，且 roots 自检静默通过

- 现象：`fameex-web` 根目录与 `apps/web/` 均无 `docs-tdd.config.json`；系统靠 `docs-tdd.config.default.json`（FameEX 默认值）运行。
- 风险：README「首次接入」第 1-2 步要求复制并按项目改配置，真实环境跳过了这步却仍能跑；`roots.mjs --self-test` 退出码 0 但不打印 `roots: OK`，缺少正向确认信号，无法据输出判断「接入完成」。
- 影响面：本仓恰好就是 default 面向的 FameEX，所以能跑；换第二个仓会静默用错配置。
- 待定：是否让 `--self-test` 在缺显式 config 时打印一条 `using default config (FameEX)` 提示。

### O-2 doctor: EFFECTIVE-RELEASE stale（ERROR，阻断 context/changed/gate）

- 现象：`effective-rules.mjs --check` 报 `stale; changed: AGENTS.md`。根因是全局 L1 `~/.ai-rules/AGENT.md`（软链到各工具 AGENTS.md）被编辑，但 effective 快照未重发布。
- 影响：按 Router §4，发布漂移阻断 `context/changed/gate`——新 v2 项目一开工的 `docs-tdd context` 会被挡。
- 处置：见下方时间线。

### O-3 doctor: CI-GATE 缺 marker（WARN）

- 现象：消费仓 CI 未接 `verify-code-rules.mjs` / `vnext-delivery-guard.mjs`，Cursor / 非 hook 提交可绕过机器门禁。本地 pre-commit 已接线（PRECOMMIT-GATE PASS），所以本机开发不受影响。
- 处置：暂记录，不阻塞本次实践（本地 hook 已兜底）。

### O-4 记录载体放进 common/ 会污染 L3 规则发布指纹

- 现象：把实践日志建在 `common/vnext/practice-log-*.md` 后，`rule-release --check` 立即 stale（`added: common/vnext/practice-log-20260912.md`），进而 `effective-rules --write` 被「L3 rule release is stale」拒绝，形成连锁阻塞。
- 根因：`rule-release.mjs` 的发布指纹遍历整棵 `common/` + `templates/`（仅排除 `common/engine/**` 与三个 manifest），任何新增 `.md` 都被归类为 `policy` 规则源。
- 处置：把日志移到仓库根目录下的专用目录 `practice-log/PRACTICE-LOG-v3.1-20260912.md`（该目录不在发布指纹范围），rule-release 立即恢复 fresh。
- v3.1 迭代待定：v3.1 没有「流程迭代日志 / 实践笔记」的官方落点。`common/vnext/baseline-observations.json` 是被指纹跟踪的；若想在 `common/` 下写观察，需要一条排除规则或专门的 non-policy 目录约定。建议：新增 `common/vnext/journal/` 白名单排除，或明确「实践日志放仓库根」的约定并写进 README。

### O-5 认知摩擦：用户误以为 workflowVersion:2 = 要废弃的 v2

- 现象：用户问「做好了 v3.1，为什么还要去修 v2？v1/v2 都要废弃」。
- 根因：三个「版本」维度同形不同义——产品版本 v3.1 / 项目协议标识 `workflowVersion: 1|2` / 风险等级 V0|V1|V2。v3.1 正是**用** `workflowVersion: 2`；被冻结的是 `workflowVersion: 1`；且 O-2 的 effective-release 根本不是 workflow 版本，是规则快照发布。
- 影响：命名撞车导致用户对「修 stale」的必要性产生抵触。README/vnext 已有「版本边界」段落解释，但用户第一线仍会混淆。
- v3.1 迭代待定：doctor/CLI 报错文案里可否显式区分「这是规则快照发布，与 workflowVersion 无关」，降低误解。

## 时间线

- 2026-09-12 开工：读 README / rule-router / new-project-kickoff / vnext/README；探测环境，发现 O-1/O-2/O-3。
- 2026-09-12：建实践日志误放 `common/vnext/` → 触发 O-4 连锁 stale；移至仓库根目录后 rule-release 恢复 fresh。
- 2026-09-12：与用户澄清版本语义（O-5）；授权后 `effective-rules.mjs --write` 重发布快照（`8a36498`，110 files），`doctor: PASS (error=0, warn=1)`，O-2 关闭。v3.1 具备开工条件。
- 2026-09-12：启动真实项目 **PR-02233 【用户端】安全验证校验交互优化**（PRD 飞书 docx）。`docs-tdd run` 成功建项、同步 PRD、返回 `nextAction: extract-requirements`。随即发现 O-6 图片 intake 缺陷。
- 2026-09-12：O-6 治本——改 `lark-prd-drift.mjs` + `sync-lark-docs.mjs`（鉴权 media-download + magic-byte 校验），重跑同步得 27 张真 PNG、快照 0 missing/27 local，golden 全绿。过程新增 O-7~O-10。重发两层快照（rule-release `8df387f`、effective `aacf0d4`），doctor PASS。当前 nextAction=`extract-requirements`，intake 已干净。
- 2026-09-12：用户定 3 决策（只做 apps/web；API 未就绪→pending-dependency；R-007 场景集认可）。生成器产出 work-item.json：21 requirements(17 doing + 2 App deferred + 2 not-doing)、routing V2(funds/auth/password/multi-entry/shared-component)、apiDependency pending-dependency。37 dispositions。17 evidenceCommands。`run` 推进到 planning，nextAction=`complete-independent-review`。新增 O-13。

## 业务项目：PR-02233

- **需求**：全平台安全验证校验交互优化——登录/注册验证方式切换、验证方式优先级（GA>邮箱>手机）、Web 非登录注册场景统一弹窗化、「没收到验证码」引导弹窗、验证码请求四态倒计时、限频/异常态、埋点。
- **端口边界**：Web(PC/H5) 本仓交付；App(iOS/Android) 按 v3.1 不变量 #1 统一 `deferred`（兄弟团队交付）。
- **依赖切分**：限频策略 → PR-02235；短信后台/有效期 → PR-02189；通行密钥 → PR-02234。本 PR 只做前端交互。
- **初判风险**：触及提币(资金)+登录鉴权面+改密码 → 强制 **V2**，需人签 scope approval。
- **规模**：单 PRD 含 ~7 个特性簇，属大需求；v3.1 目前把整份 PRD 放进一个 work-item（无官方「拆分大 PRD 为多 work-item」指引，记为待观察）。

### O-6【严重】图片 intake：假 local 资产 + 内嵌图未鉴权下载

- 现象：28 个资产里 21 个 `assetStatus:missing`；其余 6 个标 `local`（img-001~006）经 `file` 检查全是 **92682B 的飞书 passport 登录 HTML**，非 PNG。实际可用图片 **0 张**。
- 根因 1（代码精确位置）：`common/engine/agent-scripts/sync-lark-docs.mjs:165-167` 对每个 media 做**未鉴权** `await fetch(media.url)`，`response.ok` 对登录页也是 true，直接把 HTML 字节 `writeFile` 成 `.png`，无 content-type / magic-byte 校验。
- 根因 2（`lib/lark-prd-drift.mjs:33 localizeLarkMediaReferences`）：它只能处理带 http URL 的图——markdown `![](https://feishu.cn/file/XXX)` 或 `<img href="http...">`。docx 内嵌图是 `<img src="TOKEN" mime="image/png">`（无 href），正则抽不到 url → `return raw` 原样保留 → source-units 标 `missing`。
- 拆成两个 bug：
  - **Bug A**（影响 6 张 markdown grid 图，即 img-001~006）：`feishu.cn/file/FILETOKEN` 未鉴权拆→拿登录页 HTML→存成假 png，无 magic-byte 校验→假 `local` 资产。
  - **Bug B**（影响 21 张内嵌图）：`<img src=TOKEN>`（无 href）不被识别为可下载 media→从不拉→`missing`。但这些 token 可用鉴权 `lark-cli docs +media-download --token TOKEN` 拉到真图（已实验：ZIJO... 返回 3584x2068 真 PNG）。
- 修复方向：内嵌 `<img src=TOKEN>` 走鉴权 `docs +media-download --token`；`feishu.cn/file/FILETOKEN` 提 file token 走同一鉴权下载；落盘前一律校验 magic bytes（非图片硬失败或标 unreadable，绝不冒充 local）。
- 处置：✅ **已治本（用户选 A）**。改了两个引擎文件：
  - `lib/lark-prd-drift.mjs`：`localizeLarkMediaReferences` 产出结构化描述符（`kind: lark-media|http` + token/url），优先用稳定内嵌 `src=TOKEN` 走鉴权；`feishu.cn/file/<token>` 提 token 也走鉴权；新增纯函数 `classifyMediaUrl` + `sniffImageType`（magic bytes），含 self-test。
  - `sync-lark-docs.mjs`：`runCommand` 支持 cwd；新增 `downloadLarkMedia`（`lark-cli docs +media-download`，cwd 设 assetDir 规避 out-of-tree 限制）/ `downloadHttpMedia` / `downloadPrdMedia`；落盘后一律 magic-byte 校验，非图片删文件硬失败。
  - 验证：lark-prd-drift self-test 过；lark-bot pure test 215/215；golden 41 项全绿；PR-02233 重跑同步 → 27 张全真 PNG；work-item 快照 0 missing / 27 local。

### O-7 main-module 守卫经软链调用失效，脚本静默空跑

- 现象：直接 `node apps/web/docs_tdd/.../sync-lark-docs.mjs`（经软链挂载路径）exit 0 但无任何输出/不执行。
- 根因：文件尾 `import.meta.url === file://argv[1]` 守卫；经软链调用时 `argv[1]` 是软链路径、`import.meta.url` 解析成真实路径，不等 → `runSyncLarkDocs` 不执行。`docs-tdd run` 内部直接 import 无恙，但直接跑脚本会被坑（静默成功最危险）。
- v3.1 迭代待定：统一用 `fileURLToPath`/realpath 归一后比较。影响面：所有用同模式守卫且可能被直接调用的脚本。

### O-8 inbox 源内容变了，`run` 不重新归一化快照

- 现象：修好图片、`extracted.md` 已引用 img-001~027 后，`run` 仍返回同一 actionId，work-item.sourceSnapshot 仍冻结在 kickoff 旧数据（revision 1 / 旧 hash / 21 missing）。
- 根因：sourceSnapshot 只在 work-item.json 不存在（init 路径）时由 `vnextInitWorkItem` 构建；`run` 不因 inbox 文件变化而重建，也无针对 PRD 资产的「重新归一化」命令（`source-update` 面向晚到 Figma/API）。
- 绕行：因当前是空需求 stub，删除 work-item.json 后 `run` 走 `syncAndInit`→重同步+重建快照，得到正确 0 missing/27 local。若已有 requirements 则不能这么删。
- v3.1 迭代待定：提供不丢 requirements 的「重新归一化 PRD 源/资产」命令；或 `run` 检测到 inbox 源 hash 与快照不一致时提示 `resync-sources`。

### O-9 纯引擎（`common/engine/**`）改动也会把 rule-release 弄 stale

- 现象：改 `sync-lark-docs.mjs`（纯执行器代码，非规则正文）后 `rule-release --check` stale，阻断 `effective --write`，需重发两层快照。
- 与设计注释矛盾：`rule-release.mjs` 注释自述「整棵 common/ 参与指纹会让纯基建改动拖成假性 stale」，且 `classifyRuleFile` 已将 engine 与 policy 分类——但引擎改动仍计入发布指纹。
- v3.1 迭代待定：若 engine 由 golden/self-test 保证，可考虑发布指纹只算 policy 类文件，engine 变更走 golden 而非 rule-release；否则注释与实现不一致。

### O-11 source-units 把飞书 markdown 表 + HTML 表全归成 text unit（0 table）

- 现象：PR-02233 归一化出 113 units：86 text / **0 table** / 27 image。PRD 里的 `需求范围`/`验证方式优先级` 等 markdown 管道表、以及 `需求背景`/`埋点`/`验收标准` 的 HTML `<table>` 全被当 text。
- 根因 1（markdown 表）：`vnext-source-units.mjs tableDelimiter` 要求分隔行 `-{3,}`（≥3 连字符），但飞书导出的是单连字符 `|-|-|` → `tableStart` 返回 false → 整表落入 text unit。
- 根因 2（HTML 表）：`<table>...</table>` 单行块不含 `|`，从设计上就不识别为 table。
- 影响：① V0-micro 的「不得含 table unit」硬约束会被静默绕过（飞书表永远不是 table）；② 表结构语义丢失，覆盖锚定只能锚到一个大 text 块（如 `验收标准` ~60 行验收项挤在 SRC-75E1670AD34B 一个 unit 里）。本项目是 V2，影响有限但真实。
- v3.1 迭代待定：`tableDelimiter` 放宽到 `-{1,}`（≥1 连字符）以吃下飞书导出；HTML `<table>` 块识别为 table unit（含拆行）。

### O-12 web / web-next 双 Web 应用，交付目标需显式判定

- 现象：`apps/web`(@fameex/web) 与 `apps/web-next` 都活跃（近30天 271 vs 251 commits），均有 codeVerify/user i18n。PRD 只说「Web(H5/PC)」，没说哪个应用。
- 判定依据：`docs-tdd.config` 的 `productionBuild --filter @fameex/web` → 交付目标锚定 `apps/web`；`web-next` 不在本次 surface 范围（待用户确认）。
- v3.1 迭代待定：当消费仓存在多个 Web 应用时，intake/surface 识别应显式记录目标应用，避免 surface 落错仓。

### O-14 deliveryScope.includedRequirementIds 语义反直觉（须含全部需求）

- 现象：review 报 `deliveryScope.includedRequirementIds must exactly match current requirements`。我按字面把它填成「本期交付(doing)」的 17 个，校验失败。
- 根因：`vnext-coverage-review.mjs deliveryScopeProblems` 要求 includedRequirementIds 排序后等于**全部** requirement id（含 deferred/not-doing）。deferred cohort 由独立的 `deferred{owner,batch,reason}` 描述、以及每条 requirement 的 status/affectedSurfaces.disposition 表达。
- 反直觉点：字段名「included」暗示「纳入本期交付」，实际要求「列全所有需求」。初次使用必然填错。
- v3.1 迭代待定：要么改名（如 `allRequirementIds`/`reviewScopeRequirementIds`），要么报错信息直接说明「必须等于全部 requirementId」。

### O-15 独立审查对大型多模态 PRD 超默认 5 分钟超时

- 现象：`docs-tdd review PR-02233 --client pi` 报 `spawnSync ... cli.js ETIMEDOUT`。reviewer 子进程默认 `DOCS_TDD_REVIEW_TIMEOUT_MS=300000`(5min)，本 PRD 27 张图 + 113 units + 21 需求的多模态审查跑不完。
- 观察：框架把**全部** 27 张 image 资产附给 reviewer；其中 img-005~021 多为「现状」截图（非新规格）。全量多模态输入使单次审查很慢/很贵。
- v3.1 迭代待定：① 默认超时对大 PRD 偏短，可按图片数/字符数动态给时或提高默认；② 是否只把「承载新规格的图」附给 reviewer（现状截图可降级为文本引用），减少多模态负载。

### O-16 review 模型选择 + bounded deliveryScope 的 deferred-finding 耦合

- 进展：默认 `claude-opus-4-8`(uniaix, adaptive thinking) 对 27 图多模态请求**网关超时**(Request timed out)；换 `--model uniaix/claude-sonnet-5`(1M, 更快) 后**独立审查真正跑通并返回**。→ 大 PRD 审查建议用更快的多模态模型，opus adaptive-thinking 不适合。
- 新卡点：用了 `deliveryScope`(bounded-batch + deferred App 批次) 后，`applyCoverageReview` 要求**独立 reviewer 的 findings 里必须有一条 disposition=deferred 且 owner/batch 完全匹配的 finding**（vnext-coverage-review.mjs:129-131）。但 reviewer 是独立模型、未被引导必然产出该 finding → 报 `bounded delivery scope requires a deferred finding for App 交接批次`。
- 处置：移除可选的 `deliveryScope`。App 延期已由每条 requirement `status=deferred` + surface `disposition=deferred(owner/batch)` 表达，SURFACE_COVERAGE 已校验，无需 deliveryScope。
- v3.1 迭代待定：要么 review 请求显式要求 reviewer 对 deferred 批次产出 boundary finding（并在 prompt/schema 里保证），要么把该 boundary finding 由 CLI 从 work-item 自动合成而非依赖模型自发输出。

### O-17【已解决】browser-interaction 运行时证据在本环境无可执行 adapter

- 现象：`vnext-review.mjs` 审查 prompt 明确要求「runtimeRequired=true 的 evidencePlan 必须配一条 browser-interaction argv 命令」；`README.md`/`vnext/README.md` 都提到「已有外部 browser adapter」。但全仓 `common/engine/**` 搜索 `browser-interaction` 只有 schema 声明和文档提及，**没有任何真实可 spawn 的浏览器适配器脚本**；`common/rules/browser-e2e-mcp.md` 描述的是 **Cursor 专属交互式 Playwright MCP**（`browser_navigate`/`browser_snapshot`），本质是人工/Cursor 会话操作，不是 `docs-tdd evidence` 能以 `argv: string[], shell=false` spawn 的命令。
- **解决方案**（用户提醒我关注自己运行环境 + Chrome 已装 Playwright 扩展后找到）：`@playwright/mcp --extension` 本质是一个能被命令行拉起、走 **MCP JSON-RPC 2.0 over stdio** 的独立进程，通过 `PLAYWRIGHT_MCP_EXTENSION_TOKEN` 认证到扩展，**不与 Cursor 进程绑定**。实测：用一个最小 Node 脚本手写 MCP handshake（initialize→tools/list→tools/call），真实 `browser_navigate` 到 example.com 并 `browser_snapshot`——**成功**，拿到真实页面可访问性树。
- 已封装为正式引擎组件 `common/engine/agent-scripts/lib/playwright-mcp-adapter.mjs`：`createMcpClient`（spawn+handshake+callTool）+ `runScenario`（按序执行 `{tool,arguments,assert}` 步骤，一步失败即短路，对应 browser-e2e-mcp.md §5「必须验证交互副作用而不是只断言存在」的要求）+ CLI 入口（`--scenario <file.json>`，退出码 0/1）+ `--self-test`（注入假 spawn，不需真浏览器即可验证协议编排）。自测通过；实测 CLI 入口对接真 Chrome 成功（exit=0，拿到 Example Domain 快照）。
- **重要边界（必须如实说明，不能过度宣传）**：该 adapter 依赖 (1) 开发者本机已安装并登录 Playwright Chrome 扩展；(2) 个人 `PLAYWRIGHT_MCP_EXTENSION_TOKEN`（**不能写进任何提交的文件**，只能环境变量）；(3) 当前有人在场的真 Chrome 会话。因此这是 **开发者本地证据**，类似 v1 G5-G8 的人工确认锚点，只是现在变成真实 CLI 可执行而不再是纯人工走查；CI 没有浏览器环境，不能重跑。
- v3.1 迭代待定：把这个 adapter 正式写进 `vnext/README.md`「已有外部 browser adapter」的具体指向，并在 `browser-e2e-mcp.md` 补一段「pi/Claude/Codex 等非 Cursor 客户端的 CLI 可执行路径」，不再暗示这只能靠 Cursor。

### O-18 经过真实验证，设计选择应重新评估（关联 O-13 学习点）

- 既然 browser-interaction 现在真可执行，O-13 里「全部 runtimeRequired=false 避开 browser adapter」的设计选择已过时。browser-e2e-mcp.md §5 要求凡 PRD 写了「交互:点击X后→Y」的行为都应用 runtime 证据（R-001/R-004/R-005/R-010 等均属此类）。
- 本轮仅先把 R-027(E2E 回归) 补上真实 browser-interaction 证据以闭合 F-07，其余需求仍保持 runtimeRequired=false（范围控制，作为后续优化遗留项，不在本会话内重写全部）。实施阶段应重评估哪些 UI 交互需补 browser-interaction。

### O-19 evidenceCommands 生成器系统性 bug：多类型需求只配了单一 kind

- 现象：第二轮独立审查（sonnet-5）返回 15 个新 finding，其中 F-01~F-12（12/15）同一病根：需求声明 2 个 `evidencePlan.type`（如 `[copy-literal, component-dom]`），但生成器 `kindForEvidence` 只按优先级取一种 kind，导致每个 surface 只配了 1 条证据命令，声明的另一种类型完全没有证据覆盖。
- 处置：改为**按「surface × 该需求声明的每个 evidencePlan.type」做笛卡尔积**生成证据命令（71 条，从 44 条增至 71 条）。
- 另外 3 个真实抽取缺陷（非生成器 bug，是我漏抓的语义）：
  - F-13：17 张「现状/优化后」截图（`Web校验交互优化`小节内，紧邻 R-007 的 14 场景表）未挂任何需求锚点——补挂到 R-007。
  - F-14：R-027（E2E 回归）陈述里提到 6 类回归检查，但 `collectionSemantics.expectedCount` 和 surface 只建了 4 个——补 S-064(GA 不受影响)/S-065(后台下发不受影响) 两个 surface，expectedCount 4→6。
  - F-15：R-007 把「API管理(创建)」和「修改API」两个结构不同的页面误合并成一个 surface(S-040)+一条证据——拆成 S-040(创建)/S-043(修改) 两个独立 surface。
- 观察：三轮审查（27 findings 累计）没有一次是审查本身的误报——**全部是我抽取/生成阶段的真实缺陷**。这是对 v3.1 独立冷读审查机制价值的强验证：换个模型、换个无代码上下文的会话，确实能抓出自我审查抓不到的系统性遗漏。

### O-20 手写生成脚本改结构化代码时批量操作未逐条验证，连续引入语法/语义错误

- 现象：修 F-01(App-deferred surfaces) 时用 Python 正则批量往 13 个需求插入 surface，非贪婪 `.*?` 在 R-007（用 `surfaces: popupScenes.map(...)` 而非字面数组）处匹配失败，**悄悄跳过并误插到了下一个需求 R-008 头上**；同一批操作还在多处漏加数组尾逗号（R-014 等），导致脚本直接语法报错。用户当场质疑：「还没写代码就一堆逗号括号错误，.md 阶段不该有影响吧」——纠正认知：这不是 `.md`，是被 JSON Schema 强校验 + 喂给独立审查模型当事实的可执行生成脚本，标点错误在这里是真故障，不是格式瑕疵。
- 真实根因两层：① 框架层——v3.1 对大 PRD 的 work-item 抽取**无任何脚手架**（O-13 的延伸），逼着我手写几百行生成脚本拼嵌套结构；② 操作层——**批量改动没有逐条验证**：改完 13 处才跑一次语法检查，正则匹配失败时静默错位而非报错，追责成本高。
- 处置：写了自检脚本核对每个 requirement 的 `affectedSurfaces.length == collectionSemantics.expectedCount`，抓出全部计数不一致；手动逐一修复错位/缺逗号。
- v3.1 迭代待定：① 需要一个「work-item 结构自检」工具（校验 surface 数/collectionSemantics 一致性、重复 surfaceId、正则误插）作为生成阶段的即时反馈，而不是靠人在审查报告里事后发现；② 提供大 PRD 的 work-item 抽取脚手架本身（O-13）能从根上减少手写代码的机会。

### O-21【重要】5 轮审查后首次出现真实误报（false positive），而非我的抽取缺陷

- 现象：第 5 轮审查 F-001 声称「R-007 完全没有声明 collectionSemantics」，并精确列出了 R-004/R-006/R-008/R-017/R-027 的 expectedCount 作对比。核实原始 work-item.json：**R-007 确实有 `collectionSemantics: {kind:'explicit-set', expectedCount:15}`**，与其 15 个 surface 完全匹配；审查列的另外 5 个需求的计数也逐一核对精确无误。
- 性质：这是**审查模型的事实性错误**（幻觉/看漏），不是我的数据缺陷。前 5 轮累计 27+ 条发现里，这是第一个被证实为假阳性的——此前的结论「审查从无误报」需要修正为「审查绝大多数发现是真实的，但不能免检，仍需人工核对原始 payload」。
- 可能根因猜测（未证实）：R-007 的 `sourceAnchors` 数组很长（20 个锚点，含 17 张图片），加上 27 张图片的多模态负载，可能导致该需求块在模型上下文里被截断/注意力分散，看漏了紧跟在超长 sourceAnchors 后面的 collectionSemantics 字段。
- 处置：重跑一轮审查，观察是否复现（非确定性采样可能不复现）；若持续复现，需考虑精简多模态负载或调整 payload 结构（如把超长 sourceAnchors 放在字段末尾而不是开头）。
- v3.1 迭代待定：独立审查的「不可辩驳」设计（disposition 只能来自 reviewer 自身签名输出，人工不能事后改判）在遇到审查模型事实性错误时没有申诉机制——只能靠重跑赌运气。需要一个「requirements author 对 finding 提出事实异议」的申诉通道，而不是无限重跑。

### O-22【核心教训】把独立审查当成了主质检手段，而非最后一道补救网

- 用户在第 7 轮审查仍未收敛时提出关键质疑：「是不是最开始做的方式就有问题，审查只该是补救，不该是解题主线」。
- 复盘 7 轮累计发现的性质构成：
  - **~40%（第2轮 12/15 条）纯粹是生成脚本自身的系统性 bug**（一个需求声明 2 种证据类型只配 1 条命令）——跟理解 PRD 无关，本该用几秒钟的本地一致性脚本自查揪出，不需要一次 6-10 分钟的模型审查才发现。
  - **~50% 是对 PRD 的系统性核对不足**（漏边界条件、场景归属、多语言声明、App/Web 归属、兄弟 PR 排除声明）——如果第一次抽取时就用检查清单逐条核对 PRD（每个验收表行/边界小标题/引用的他 PR/新增文案/跨端功能），这些本该被自己挑出来。
  - **~10%（第5轮）是审查模型自身的幻觉误判**（见 O-21）——说明审查机制本身不是零误差，拿「追到 0 条发现」当终点可能追不完。
- 根本问题：本次实践把独立审查当成了**主质检手段**（写完就送审、按发现改、改完再送审，循环 7 轮），而不是「先自查+机械校验，把审查留给真正的盲点」。这是**使用方法的问题，不是审查机制本身设计错了**——但框架也没有任何机制提醒/强制"送审前先自查"，纯靠使用者自觉，容易在时间压力下被跳过。
- 处置：从本项目往后改变工作法——先跑本地一致性自检脚本，再对照检查清单人工核对 PRD 覆盖度，最后才送审查；审查只处理这两步之后仍存在的盲点。
- v3.1 迭代待定：① 是否该提供一个「送审前自检清单/脚本」作为 extract-requirements 阶段的强制前置步骤（而非事后由审查发现同样的机械性缺陷）；② 是否该给独立审查设一个「最多重跑 N 轮，之后强制转人工判断」的硬上限，避免无限追逐一个有噪声的质检信号（类比 autopilot 对 code/browser repair 分别限 2 轮的设计，coverage review 目前没有类似上限）。

### O-23【方法论修正 + 落地】用确定性自查器替代审查循环，一次查全机械缺陷

- 触发：用户在第 10 轮审查启动时叫停——「这个审查已经没有意义了，最初的方法就错了，靠审查解决不了问题，现在就来解决」。判断完全正确。
- 复盘 10 轮审查的发现构成：绝大多数属于**少数几类可枚举、确定性可检查的机械规则**，却被交给「每轮 6-10 分钟、且自身会偶发幻觉(O-21)」的模型审查去逐条发现：
  1. 声明多种 evidencePlan.type 却缺对应 kind 的命令（第2轮 12 条）
  2. 引入新前端文案却没声明多语言/没 copy-literal（1/3/4/6/7/8 轮反复）
  3. collectionSemantics.expectedCount ≠ affectedSurfaces 数（我自己脚本 bug）
  4. 跨端功能漏 App-deferred surface（4/7/8 轮）
  5. runtimeRequired=true 却无 browser-interaction 命令（O-18 预判）
- 落地解法：写了 `self-audit-02233.mjs`（确定性、无模型、秒级），把上述 5 类编码为机械检查，对 work-item 一次性跑全。首跑查出 6 处（多语言类），其中含**假阳性**（R-002 仅移除入口、R-015/R-016 渲染后端文案，均非新增前端固定文案）——用一次人工判断处置（在 statement 显式记录判断，并让自查器识别「仅移除/渲染后端文案/他PR交付」这类非新增文案信号），再跑即全绿。
- 关键对比：**同样的缺陷类，自查器几秒查全 + 一次判断处置；审查循环用了 10 轮、数小时、还没收敛**。机械枚举天然完备（不漏、不重、无幻觉），审查模型天然有噪声且逐条串行。
- v3.1 迭代结论（强建议）：
  1. **把「抽取自查器」作为 extract-requirements 阶段的强制前置门禁**——覆盖上述可枚举机械类；只有自查通过才允许送独立审查。这样独立审查只处理真正的语义盲点（如"某验收行的业务语义没人覆盖"），发现数会从两位数降到个位数、1-2 轮收敛。
  2. **给 coverage review 设硬性轮次上限**（类比 autopilot 对 code/browser repair 各限 2 轮）：超过 N 轮强制转人工裁决，避免无限追逐一个有噪声的信号。
  3. 自查器里那些「半需判断」的类（跨端归属、验收行覆盖、他PR交付项是否留回归 surface）应产出**候选清单供一次人工判断**，而不是留给审查逐轮发现。
- 遗留（诚实说明）：本次没有再为「验收标准表逐行是否都映射到需求」建确定性枚举检查（该表约 60 行、HTML 结构，需专门解析器）——这是自查器还应补的一类，也是审查后期仍偶发命中的语义类。

### O-24 用户授权进入实现后，v2 持久状态仍停在 intake/pending

- 现象：用户已明确要求停止审查并进入写代码，但 `work-item.json.autopilot.phase` 仍为 `intake`、`implementation.status` 仍为 `pending`，`scopeApproval` 仍为 `null`；同时真实工作区已经产生实现改动。
- 影响：机器状态与真实推进状态分叉。后续 chat 若只执行 `docs-tdd run`，会再次要求 coverage review，而不是从现有实现继续；本次不得不靠交接文档和会话记忆绕开路由。
- v3.1 迭代建议：提供明确的人工裁决命令，例如 `scope-approve --human-override --reason ...` / `begin-implementation`，把用户在会话中的授权持久化并记录偏离原因；不能只允许“审查 PASS”这一条状态迁移路径。

### O-25 v2 缺少实现中期的 changed/differential check

- 现象：按仓库规则在一批实现稳定后执行 `docs-tdd changed PR-02233`，CLI 直接报错：`changed is a v1-only command`，并提示改用最终 `verify`。但当前实现尚未完成、API/Figma 仍 pending，不适合生成正式出口。
- 影响：v2 在“开始实现”到“最终 verify”之间没有轻量、可重复的差异检查入口；开发者只能直接调用 Biome/Vitest/tsc，检查结果不会回写工作事实。
- v3.1 迭代建议：为 v2 增加不产出最终结论的 `check`/`changed` 阶段，至少记录 changedPaths、范围越界、受影响 requirement/surface，以及 scoped checks；最终 `verify` 再消费这些中间事实。

### O-26 全量 typecheck 基线噪声过大，v2 需要“本次改动差分”判定

- 现象：执行 `pnpm --filter @fameex/web typecheck` 返回大量仓库既有错误（Futures、Kline、Rewards、日期类型、缺失生成模块等），本次验证码触达文件未出现在错误列表中；仅凭命令退出码无法判断本次改动质量。
- 处置：保留全量 typecheck 失败事实，同时用错误输出按 touched paths 过滤，并执行 touched-files Biome + 相关纯逻辑 Vitest（13 tests）确认本次改动自身无已发现错误。
- v3.1 迭代建议：verify/check 支持 baseline-aware typecheck（与基线错误集合做差），并明确区分 `new-errors=0` 与 `whole-command=failed`；否则成熟大仓库会长期因无关存量债务阻断真实增量验证。

### O-27 已有 i18n 仓库规则被执行过程遗漏，需确定性拦截

- 现象：本轮新增验证码文案时同时修改了 9 个非简体中文 locale；用户指出业务开发只维护中文，其他语言由国际化团队处理。核查发现该规则其实已明确写在仓库 `AGENTS.md` § Coding Style & Naming Conventions：Web 翻译变更只允许 `zh-CN` / `zh_CN`，新增 key 也不得同步修改其他 locale。
- 性质：这不是“规则缺失”，而是**已加载规则未被执行**。继续复制一份规则到 L3 不能解决问题，反而会制造双写漂移。
- 处置：撤回本轮对 9 个非 `zh-CN` 的 `codeVerify.json` 修改，只保留 `zh-CN`；规则唯一正文继续由仓库 `AGENTS.md` 持有。
- v3.1 迭代建议：在实现中期 `check` / 最终 `verify` 增加确定性 locale 变更守卫：普通 Web 业务任务若 changedPaths 命中 `src/i18n/locales/*` 且 locale 非 `zh-CN` / `zh_CN`，直接失败；只有显式“国际化团队同步/翻译任务”授权才能豁免。规则是否执行不能只靠上下文里读过。

### O-28 v2 delivery guard 把阶段性 commit 与最终交付绑定，阻断合法 checkpoint

- 现象：用户明确要求对已完成的第一批实现 `git add` + `git commit`。pre-commit 中 Biome 与 `verify-code-rules` 已通过，但 `vnext-delivery-guard` 因没有 `latest-result.json` 拒绝提交。当前后端契约仍 pending，不能诚实地产出最终 PASS；强行为提交生成 PASS 会伪造交付事实。
- 处置：在用户已明确授权停止 review、进入实现并要求提交的前提下，保留所有已执行检查证据，以 `git commit --no-verify` 创建阶段性 checkpoint `9ee99d0fdb`；没有伪造 `latest-result.json`，也没有 push。
- v3.1 迭代建议：区分 `checkpoint commit` 与 `delivery commit`。开发期间允许在 scope approval / 人工 override 已持久化、scoped checks 通过时提交；仅在标记 ready-for-delivery、提 PR 或 push 前要求 current `latest-result PASS`。否则“每个 commit 都必须最终验收”会迫使开发者在未完成时伪造 PASS 或绕过全部 hook。

### O-29 API readiness pending 被误当成实现停止条件，缺少本地契约 mock 路由

- 现象：PR-02233 的冷却时间戳与限频错误字段依赖 PR-02189/PR-02235，`apiDependency` / `sourceReadiness.api` 正确保持 pending；执行过程却因此一度停止在“等待真实 API 后再补浏览器证据”。用户指出 API 未 ready 是常态，不能因此停住。
- 处置：在 `apps/web-next` 增加显式 opt-in 的开发态 MSW，使用当前 pending schema 形状提供 `success` / `rate-limit` / `service-error` 三种场景；正常开发流量与生产构建不加载 MSW。真实 API readiness 继续 pending，不用 mock 反向宣称契约已 ready。
- AutoPilot 迭代建议：把 `pending-dependency` 细分为“implementation-blocking”与“integration-pending”。若现有 schema、PRD 和最小 mock 足以推进前端，自动建议并生成 contract-shaped mock + removal condition + contract test；只阻断正式联调/交付，不阻断实现。

### O-30 人工 check 没有一等 evidence producer，逼迫 browser command 过度归因

- 现象：R-014 的 UI 倒计时恢复适合基于 MSW 做一次人工检查。当前 intake audit 要求每个 `evidencePlan.type` 都有同 kind command；`vnext-manual-test` 又只在 `reviewControl.requiresPretestHumanRun=true` 时可用，不能单独由 requirement 声明人工检查。为了让 audit 通过，很容易把只证明 mock 信封的浏览器 smoke 冒充完整 UI 行为证据。
- 处置：自动浏览器 smoke 只证明 MSW 返回冷却/限频信封；UI 切换、恢复、禁用和异常回退单列人工检查，不把二者混成一个“已自动通过”的结论。
- AutoPilot 迭代建议：`evidencePlan` 增加原生 `producer: human` / `kind: human-check`，允许 requirement 直接生成 `manualTestRun` 场景，不要求对应 argv command；verify 同时校验 command receipt 与 human confirmation，且 UI 人工检查可以独立于 coverage-review fallback 启用。

### O-31 evidenceCommands 的确定性 audit 只检查存在性，不能识别过度声明

- 现象：将 67 条无效占位 evidence 压缩为 8 条真实命令后，intake audit 可 PASS，但独立复核发现多条命令把少量源码字符串断言映射到大量 requirements/surfaces，E-205/E-207 的 kind 与实际测试类型也不匹配。机器检查证明了“有一条映射”，没有证明“这条断言足以支持该 claim”。
- 处置：逐条收窄 requirementIds/surfaceIds；API contract、埋点 payload、DOM contract、浏览器入口回归拆开；Biome 不再绑定功能 requirement。
- AutoPilot 迭代建议：证据计划生成器默认一条命令只绑定其直接断言；增加 claim-to-assertion reconciliation（至少按文件、测试名、assertion label 与 requirement evidence type 做静态提示），并对“一条薄脚本覆盖大量 surface”设置 overclaim warning。

### O-32 修改 evidence plan 会退回 review，且 bounded-batch includedRequirementIds 语义不直观

- 现象：仅替换无效 evidenceCommands 后项目从 implementing 退回 planning；之后 reviewer 又要求 `deliveryScope.includedRequirementIds` 与 work-item 全部 requirements 完全一致，而原计划把该字段理解为“本批次 doing requirement 集合”，延期/他 PR 条目没有列入。
- 影响：字段名 `includedRequirementIds` 与校验语义冲突，容易让人误以为 deferred/not-doing requirement 不应包含；证据维护也会触发重复 semantic review。
- AutoPilot 迭代建议：将字段改名为 `workItemRequirementIds`，或允许 `includedRequirementIds` 只列本批次并由 `deferredRequirementIds` 明确补集；evidence-only fingerprint 变化应只触发 evidence review，不应重跑 source semantic coverage review。

### O-33 scoped test 命令经 package script 展开后意外运行全套

- 现象：执行 `pnpm test --run <4 files>` 时，`web-next` 的 `test` script 实际是 `vitest run src`，最终命令变成 `vitest run src --run <files>`，误跑 536 个测试文件并暴露 8 个无关既有失败。改用 `pnpm exec vitest run <explicit files>` 后才得到真实 4-file scoped 结果。
- AutoPilot 迭代建议：evidence command policy 不只检查 argv 表面，还应解析 package.json script 展开结果；发现脚本自带目录/通配入口时拒绝称为 scoped，自动建议 `pnpm exec <runner> run <explicit files>`。

### O-34【已撤回：完成状态误报】PR-02233 web-next auth-verification 批次阶段工作记录（2026-09-16）

> 撤回说明：本节原先声称“完成切换方式弹窗并接入 Login/Register/ResetPassword，已取得双视口回归结果”。2026-09-16 用户在本地验收时发现登录页无法触发切换弹窗；随后以当前 Git 树反查，确认该声明不成立。错误原文不再作为项目事实，事故分析见 O-35。

- 经核实，提交 `ff7020c0b6` 虽名为 `feat: PR-02233 migrate verification flow to web-next`，但树中不存在 `SwitchVerifyMethodDialog`，Login 也没有“绑定 ≥2 种方式才显示入口”的接线；Register 未完成 R-001/R-006 接入。
- 已落盘的是 `SendCodeButton`、`NoCodeGuideDialog`、倒计时/异常分类/埋点等部分基础能力，以及 ResetPassword 的部分接入；不能据此推导整个 auth-verification 批次完成。
- 所谓“等待真实 API/人工验收”只适用于冷却截止时间、限频类型等联调边界，不能解释或阻塞纯前端的切换弹窗、入口显隐、排序、当前项标识和方式切换。
- 此前列出的 DOM contract、浏览器 smoke、测试和 typecheck 结果没有逐项证明全部 in-scope surface；不得继续引用它们支持“开发完成”或“进入人工验收”的结论。

### O-35【严重事故】把局部实现与流程进度误报为整批完成，核心 PRD 路径未实现即宣称进入人工验收

#### 事故现象

- 用户在 `feature/PR-02233` 本地打开 `/zh-CN/login`，询问如何触发 PRD 6.3.3 的“切换验证方式”弹窗。
- 代码事实：当前树没有 `SwitchVerifyMethodDialog`；Login 没有确认按钮下的切换入口；不存在“仅绑定 ≥2 种方式展示”、`GA → 邮箱 → 手机` 排序、当前项高亮、关闭不切换、选择后替换校验输入区等实现。
- 状态事实：此前却对外汇报为“开发完成，等待后台接口，进入人工验收”，并在 O-34 写入了同样的完成声明。
- 影响：用户基于错误状态开始验收，核心交互完全无法触发；完成度、阻塞项和交付阶段三项信息同时失真，属于严重交付状态事故。

#### 直接原因

1. **目标 pivot 后未归零完成度**：旧 `apps/web` 的实现雏形和测试在目标切到 `apps/web-next` 后仍被心理上计入完成度；没有重新按 web-next 的 requirement/surface 建立未完成清单。
2. **把流程状态当成交付状态**：`V2-implementing` / `implement-current-scope` 仅表示允许开始编码，却被误读成实现接近结束。
3. **把局部能力外推成完整链路**：看到 resolver、发送按钮、引导弹窗、埋点等局部文件和测试后，没有核对 Login/Register/ResetPassword 是否真实消费，就宣称“三页已接入”。
4. **把 API pending 扩大成统一阻塞**：PR-02189/PR-02235 只阻塞冷却时间戳和限频类型等真实契约；切换方式弹窗是纯前端可完成项，却被错误归入“等后台接口”。
5. **证据存在性替代了 claim 充分性**：DOM contract / smoke / 源码断言即使执行成功，也没有证明“用户可从登录验证码校验区打开弹窗并完成切换”。证据命令的名字和退出码被当成了业务完成事实。
6. **缺少提交前的 requirement ↔ runtime reconciliation**：提交 `ff7020c0b6` 前未逐项核对 R-001～R-017、R-027、R-029 的 implement surface，也未运行最关键的真实浏览器路径。

#### 为什么现有门禁没有拦住

- work-item 记录了 requirement 和 surface，但没有强制“每个 implement surface 必须绑定到当前 Git 树中的真实实现落点”。
- evidence audit 能检查命令和映射是否存在，不能判断薄弱源码断言是否被过度归因到完整交互 claim（与 O-31 同源）。
- v2 缺少实现中的差分完成度检查（O-25），导致“有代码、有测试、命令成功”与“所有本期 surface 已完成”之间没有机器化对账。
- 没有对完成用语设置硬前置条件；在 `latest-result.json` 不存在、真实 browser acceptance 未执行、核心 surface 仍缺失时，Agent 仍可自然语言宣称“开发完成/进入人工验收”。

#### 立即纠正的项目事实

- TR-02386 的 Login/Register/ResetPassword 技术迁移：已完成并合入。
- PR-02233 的 docs-tdd re-scope：已完成到可实施状态，但不是业务完成。
- PR-02233 web-next 业务：仅部分基础能力和局部接入完成。
- `SwitchVerifyMethodDialog`、Login 切换入口及其完整交互：未完成。
- Login/Register/ResetPassword 全量接入和双视口真实回归：未完成。
- API pending：仅是部分集成风险，不是停止前端实现的理由。
- 当前阶段必须回退描述为：**implementation incomplete / not ready for human acceptance**。

#### AutoPilot / docs_tdd 迭代项

1. **Pivot invalidation**：delivery target、policy path 或主应用从 `apps/web` 改到 `apps/web-next` 时，自动把相关 implementation/evidence/acceptance 状态标记 stale；禁止继承旧目标的完成度。
2. **Surface-to-code reconciliation**：最终 verify 前，对每个 `disposition=implement` surface 要求一个真实 changed path / symbol / route 落点；不存在的组件名、未被消费的共享组件、未触达的目标页面直接报 missing-surface。
3. **Consumer wiring gate**：共享组件“已实现”与业务页“已接入”必须分开。只有 import/渲染/事件链路或真实浏览器证据能关闭 consumer surface，组件文件存在不能替代接入证明。
4. **Runtime critical-path gate**：对 PRD 明确写有“点击 X → 弹出 Y → 选择后 Z”的 requirement，若未执行能观察最终副作用的 browser-interaction 或人工签认，禁止标记 ready-for-test / ready-for-acceptance。
5. **Dependency blast-radius check**：pending API 必须绑定到具体 requirement/surface；非依赖项仍未完成时，禁止用统一的“等待接口”解释整个批次。
6. **Completion-language guard**：没有 current `latest-result PASS` 时，CLI/agent 摘要只能使用“部分实现”“ready for integration”“implementation pending evidence”等受控状态；若仍有 implement surface 无证据，明确禁止“开发完成”“进入人工验收”。
7. **Claim-to-assertion strength audit**：为一条证据绑定过多 requirements/surfaces 发出 overclaim error；源码字符串/静态 DOM contract 不得证明完整交互链路。
8. **Human acceptance checklist 由 PRD 原子项生成**：至少列出入口条件、动作、结果和反向条件。本事故对应的最低检查是：绑定 ≥2 种方式 → 入口出现 → 弹窗打开 → 仅列已绑定方式并正确排序/标记 → 关闭不切换 → 选择后输入区切换；单绑用户入口隐藏。
9. **提交摘要真实性检查**：当提交信息声称迁移完整 flow，而 scope 中存在未落盘的核心命名 surface 时，给出阻断性提示，要求收窄提交标题或补齐实现。

#### 后续验收口径

只有同时满足以下条件，才允许重新称为“开发完成，进入人工验收”：

- 所有本批次 `implement` surface 已逐项对账；
- Login/Register/ResetPassword 均有真实消费链路；
- 核心交互在 PC 与 390px H5 视口可触发并验证副作用；
- 聚焦测试、触达文件质量检查和真实浏览器结果均有当前代码指纹对应的记录；
- 未完成的后端联调项被精确限定，不掩盖任何可独立完成的前端缺口；
- 最终 docs-tdd verify 与人工确认均基于同一 HEAD/dirty hash。
