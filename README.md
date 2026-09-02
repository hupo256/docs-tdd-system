# docs_tdd — 可移植的 AI 前端开发规则与门禁系统

一套**独立**的 AI 前端开发操作系统：用「先文档后代码 + G0-G8 门禁 + 机器可验证证据」约束 Codex、Claude Code、Cursor、Lark-Codex、Lark-Claude 与人协作完成前端功能开发。引擎与业务仓库通过 `docs-tdd.config.json` + 一个软链解耦；**目前只在一个仓库（`@fameex/web`）真实验证过，移植到第二个仓库需要改动下列锚点**（见[可移植性的真实边界](#可移植性的真实边界)）。

> 本仓库是从某前端工程中沉淀、抽离出的独立系统，经多轮真实项目迭代。作为个人知识库独立版本管理，不含任何业务机密以外的通用方法论。

## 它解决什么

AI 编码的两个顽疾：**跳过需求确认直接写码**、**规则散落导致每次重新解释**。docs_tdd 把开发拆成 G0-G8 阶段门禁，每阶段有机器可读的证据要求（gate 脚本实跑 biome/tsc/vitest、校验字段对账、阻塞登记、通知记录），AI「已读/已注意」不算数，只认执行契约产出的证据。

规则本身遵循「**规则可变多，常驻恒定小**」：AI 开工只常驻读一个路由文件（`common/rules/rule-router.md`，≤5000 字符机器守），其余按场景加载，避免上下文膨胀。

## 架构

| 层 | 内容 | 位置 |
| --- | --- | --- |
| **常驻路由** | 开工唯一入口：启动协议 + 硬规则 + 场景表 | [common/rules/rule-router.md](./common/rules/rule-router.md) |
| **按需专题** | 架构/状态/API/Mock/UI/Figma/协作/门禁等规则，命中场景才加载 | `common/rules/*.md`（人工索引见 [common/README.md](./common/README.md)，机器路由见 `common/rules/rule-index.json`） |
| **流程引擎** | 阶段验证、机器事实层、发布指纹、golden 自回归 | `common/engine/` |
| **模板** | 新需求复制使用的文档骨架 | `templates/` |
| **项目实例** | 各需求的文档/证据（清单见自动生成的 [PROJECTS.md](./PROJECTS.md)） | `prds/<PROJECT-ID>/` |

核心命令统一走 `<mount>/common/engine/agent-scripts/docs-tdd.mjs`。下表中的 `docs-tdd` 是 `node <mount>/common/engine/agent-scripts/docs-tdd.mjs` 的阅读简写：

```bash
docs-tdd context <PROJECT-ID> <SCENARIO>   # 按场景生成默认 brief/compact 规则包；可显式覆盖模式
docs-tdd kickoff <PROJECT-ID> --prd <src>  # 一句话幂等启动：骨架+同步+intake+run-state
docs-tdd status|next|resume <PROJECT-ID>   # 状态、唯一下一步、断点恢复
docs-tdd recommend <PROJECT-ID>            # 根据当前改动推荐场景
docs-tdd changed <PROJECT-ID>              # 编辑后跑 code-rules / mock 校验
docs-tdd gate    <PROJECT-ID> <Gx>         # 阶段交付门禁
docs-tdd capability <PROJECT-ID>           # 查看 worktree、规则集与发布摘要
docs-tdd doctor                            # 适配/冲突/发布状态自检
docs-tdd check <PROJECT-ID>                # 校验文档、规则与脚本预算
docs-tdd release <PROJECT-ID> --scenario X # 原子发布 L3/effective + doctor/golden/context smoke
docs-tdd golden                            # 让门禁机器自己被回归测试
docs-tdd guard                             # 机器层兜底：一条命令跑 golden + 发布 fresh 检查 + doctor
docs-tdd rule-health                       # 规则体检：命中分布、warn 台账年龄、待退休、零命中清单
```

统一审计入口是 `docs-tdd doctor`：它检查五个 AI 入口是否一个不少、没有未登记入口，是否引用同一组 L1/L2/L3 source fingerprint，以及软链、adapter、Lark runtime 和发布清单是否漂移。需要连门禁回归一起检查时运行 `docs-tdd guard`；任一项失败都不是 PASS。

## 首次接入一个项目

系统可以放在任意绝对路径。接入只需要**一份本地配置 + 一个软链**，不需要理解内部路径解析逻辑。下面以默认挂载位置 `apps/web/docs_tdd` 为例；如果项目结构不同，同时修改软链位置和 `docsMountPath`。

### 1. 在消费仓库建立软链并复制配置

```bash
cd <CONSUMER_ROOT>
mkdir -p apps/web
ln -s /absolute/path/to/docs_tdd apps/web/docs_tdd
cp apps/web/docs_tdd/docs-tdd.config.default.json docs-tdd.config.json
```

将下面两行加入消费仓库的 `.git/info/exclude`，避免把本机配置和软链提交到业务仓库：

```gitignore
docs-tdd.config.json
apps/web/docs_tdd
```

### 2. 按当前项目修改 `docs-tdd.config.json`

至少核对这些字段：

| 字段 | 填什么 |
| --- | --- |
| `consumerRoot` | 消费仓库的绝对路径；建议显式填写 |
| `appSubpath` / `docsMountPath` | 应用目录与上一步创建的软链位置 |
| `baseRef` | 创建功能 worktree 时使用的远端基线 |
| `projectIdPattern` / `branchPrefix` | 项目编号格式与功能分支前缀 |
| `typecheckRoots` | 需要执行类型检查的包或应用目录 |
| `productionBuild` | G8 实际执行的生产构建命令 |

[docs-tdd.config.default.json](./docs-tdd.config.default.json) 是参考配置，不代表其他仓库可以零修改使用。仓库结构、包名或构建命令不同，就在本地配置中覆盖对应字段。

### 3. 自检接入结果

仍在消费仓库根目录执行：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/lib/roots.mjs --self-test
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs doctor
```

第一条最后显示 `roots: OK`，表示脚本已从当前目录找到三件事：规则系统放在哪里、哪个仓库在使用它、当前命令属于哪个 worktree。第二条检查五个 AI 入口、规则适配、冲突、本地隔离和发布状态。失败时按输出修配置；日常使用只需要维护 `docs-tdd.config.json` 和挂载软链，不需要理解内部变量或手工拼路径。

后续由 `prepare-coding-worktree.mjs` 创建的功能 worktree 会复用同一套配置，并自动挂载这份文档系统。

## 可移植性的真实边界

引擎（`common/engine/`）的路径解析、门禁、发布指纹都从 `docs-tdd.config.json` 派生，换仓库只改配置；但**下面这些位置仍写着 FameEX 的具体锚点，移植到第二个仓库必须逐项处理**。这份清单存在的意义就是不让 README 说「可挂载任意前端项目」这种在真实迁移面前会破的话：

| 类别 | 位置 | 移植动作 |
| --- | --- | --- |
| 配置默认值（改配置即可） | [docs-tdd.config.default.json](./docs-tdd.config.default.json) 的 `productionBuild`（`--filter @fameex/web`）、`moduleImportAliases`（`@fameex/ui`）、`cursorLocalGovernance` | 在本地 `docs-tdd.config.json` 覆盖；引擎无硬编码回落之外的依赖 |
| Agent 适配器文本 | [lib/agent-rule-adapters.mjs](./common/engine/agent-scripts/lib/agent-rule-adapters.mjs)、[install-local-agent-rules.mjs](./common/engine/agent-scripts/install-local-agent-rules.mjs) 里 "FameEX Local Execution Protocol" 等字面量与 `~/.cursor/rules/fameex-local-governance.mdc` 文件名 | 改为按 consumer 名生成（当前是硬编码字符串） |
| 规则文档示例 | [coding-worktree.md](./common/rules/coding-worktree.md)、[git-branch-flow.md](./common/rules/git-branch-flow.md)、[hook-integration.md](./common/rules/hook-integration.md)、[prd-feature-inventory.md](./common/rules/prd-feature-inventory.md)、[figma-mcp-read-workflow.md](./common/rules/figma-mcp-read-workflow.md)、[rule-inheritance.md](./common/rules/rule-inheritance.md) 中的绝对路径 / 包名 | 示例路径与 `pnpm --filter` 包名换成目标仓；`rule-inheritance.md` 的 L2 锚点描述需按目标仓 `.cursor/rules` 重写 |
| L2 依赖（不在本仓） | 消费仓的 `AGENTS.md` / `CLAUDE.md` / `.cursor/rules/*.mdc` | 目标仓必须有对应的 L2 锚点文件，否则 `doctor` 的规则适配项不 PASS |
| lark-bot 本机约定 | `~/.config/fameex-lark/`（密钥目录）、bug 表与项目路由配置 | 改目录名与表配置；lark-bot 是可选组件，不接入则无影响 |

尚未做的是把上面 2-3 类抽成 `adapters/<consumer>/`——在出现第二个真实消费仓之前不做这层抽象（为一个用户造抽象只会造错）。移植时以本表为检查表，逐项落地后再更新本节。

## 如何使用（Step by Step）

以「用本系统跑一个新需求」为例的日常流程（首次接入见上一节）。命令统一走 `<mount>/common/engine/agent-scripts/docs-tdd.mjs`（下文简写 `docs-tdd`）。

**0. 前置**：系统已挂载到消费仓库（软链 + `docs-tdd.config.json`），`docs-tdd doctor` 适配项全 PASS。

**1. 启动新需求** — 对 AI 说启动口令：
```text
根据 docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：<PRD 链接或本地路径>。
```
AI 会先读 `common/rules/rule-router.md`，再执行 `docs-tdd kickoff PR-01234 --prd <source>`。命令幂等创建项目、同步 PRD、初始化 intake 并写 `agent/run-state.json`；中断后用 `status/next/resume` 恢复。

**2. G0 资料接收**：把 PRD / Figma / API 资料放进 `prds/PR-01234/inbox/`。含图片、表格、嵌入对象时先完成 `prd_intake`（`docs-tdd context PR-01234 prd_intake`），逐项读取分类，读不了即阻断，不猜。PRD 指纹会剥离每次同步变化的 `syncedAt`、临时媒体下载 URL 和图片 alt 描述，避免同一内容反复误报漂移；旧 manifest 可用 `prd-intake.mjs PR-01234 --remigrate` 就地迁移，不重新拉远端、不丢人工分类。

**3. G1 文档生成**：AI 基于启动器生成的模板填写 PRD 全量功能清单、scope、技术方案初稿、任务与协作记录；G1 有独立机器出口，不与 G0 共用空骨架判定。`product/00-feature-inventory.md` 是「做 / 不做 / 延期」和 Scope 裁剪记录的唯一真相源，`01-scope-and-phases.md` 只写摘要，`04-frontend-tasks.md` 只保留本期做项，避免多份范围结论漂移。

**4. 按场景加载规则**：`docs-tdd context PR-01234 <SCENARIO>` 只读命中场景的专题，不全读 `common/`。模式由场景选择默认 brief/compact，也可用互斥的 `--brief|--compact|--full` 显式覆盖；brief 只折叠索引中逐引用标记为安全指针的机器规则。传 `--session-id <task-id>`（或由客户端注入 session 环境变量）后，同一 project/client/session 的相同 pack 才返回 delta；无会话身份时不做跨任务去重。编码场景须先通过 G2，并签发绑定当前客户端、规则指纹、G2 输入与 HEAD 的 24 小时 rule session v2；`changed` 和 G5-G8 拒绝缺失、过期或由其他客户端签发的会话。Cursor 原生消费 `.cursor/rules` 的 glob/alwaysApply；Claude/Codex 的 PreToolUse hook 使用同一 Resolver，在首次编辑时 deny-and-retry 注入命中正文，并由 PostToolUse 生成消费回执供 `changed`/G5+ 校验。Cursor adapter 会自动带 `--client cursor`；手动调用可显式传 `--client codex|claude|cursor|manual`。Lark 两个入口不复用这份会话，而是在每个任务启动 AI 前读取当前规则章节并检查发布链；发布链 stale 会在 health / 日志告警，但不再把修 bug 任务整体挡下，必需常驻规则缺失仍 fail-closed。常用场景：`g0_g2_scope` `write_api` `write_mapper` `write_query_hook` `write_ui` `write_figma` `write_msw` `g6_verify`（全表见 `rule-router.md §3`）。其中 `g6_verify` 仅打印四维执行计划；实际依次加载 `g6_code_review`、`g6_contract`、`g6_visual`、`g6_delivery`，完整或 partial G6 门禁会机器校验四维均为当前代码/规则状态。

**5. G2 方案定稿**：对功能清单逐条确认「做 / 不做 / 延期」，写完 `product/02-technical-design.md`（含复用盘点、PRD 路径核验）后**才允许写业务代码**。

**6. G4 建编码 worktree**：
```bash
node <mount>/common/engine/agent-scripts/prepare-coding-worktree.mjs PR-01234 --dry-run   # 先看
node <mount>/common/engine/agent-scripts/prepare-coding-worktree.mjs PR-01234             # 建分支+软链+装依赖+起 dev
```
脚本按 `docs-tdd.config.json` 的 `baseRef` 和 `branchPrefix` 创建分支；基线校验通过才算 ready。

**7. 编码 + 增量校验**：每次改完代码跑
```bash
docs-tdd changed PR-01234      # 实跑 code-rules / mock-manifest 校验改动文件
```

**8. 阶段门禁**：每过一关跑对应 gate，全绿才进下一阶段：
```bash
docs-tdd gate PR-01234 G5      # 接口联调（字段对账、删 mock 臆造字段）
docs-tdd gate PR-01234 G6      # 自测验收（实跑 biome/tsc/vitest + code review findings 清零）
docs-tdd gate PR-01234 G7      # QA 用例回归
docs-tdd gate PR-01234 G8      # production build + Git 可交付状态 + 交付摘要
```
`docs-tdd doctor` 随时自检适配/冲突/发布状态；缓存仅复用同输入 PASS，强制实跑加 `--no-cache`。

> **人机分界（自动化边界要如实）**：G0–G4（需求→文档→方案→MSW 编码）高度自动；G5–G8 是**人机协同**——gate 机器实跑 biome/tsc/vitest/build 与结构化验收/字段对账，但**真实接口联调、视觉还原（Figma 并排 ≥95%）、交互手感、响应式、QA 用例执行以人工确认为锚点**（分工见 [common/rules/verification-division-of-labor.md](./common/rules/verification-division-of-labor.md)：Agent 固化能回归的逻辑/边界/数据/DOM 契约，人工过一眼能判的像素/手感/响应式）。判断层的 `acceptance-results.json`/`code-review.json` 由 Agent 产出、gate 校验其结构与证据锚点真实性，但语义正确性仍需人工/Review 兜底（执行强度分级见 [common/rules/rule-execution-model.md §3](./common/rules/rule-execution-model.md)）。人工确认在机器侧有落点：`stage-status.json`（G5/G7 处置态）、人工判定的 passed 验收项与 `code-review.json` 都写 `confirmedBy` + `confirmedAt`，缺签名或用 AI 客户端名代签由 `DOC-CONFIRM-001..004` 逐条点名（见 [rule-ids-and-gates.md §3.7](./common/rules/rule-ids-and-gates.md)）。

**9. 上线后回收**：需求合入配置的 `baseRef` 并验证后，回收一次性 worktree（保留 `prds/PR-01234/` 文档）：
```bash
node <mount>/common/engine/agent-scripts/decommission-worktree.mjs PR-01234 --dry-run
node <mount>/common/engine/agent-scripts/decommission-worktree.mjs PR-01234
```

> 维护系统本身（改规则/加专题/发指纹）使用场景 `docs_tdd_maintenance`；改完先运行 `docs-tdd check <PROJECT-ID>`，再运行 `docs-tdd release <PROJECT-ID> --scenario docs_tdd_maintenance` 原子发布并自检，否则发布漂移会阻断 context/changed/gate。
>
> **大规模重构期**（频繁改门禁脚本会让指纹链反复失效、每次都要重发布）可临时 `export DOCS_TDD_SKIP_RULE_FRESHNESS=1` 跳过 `run-project-gate` / `docs-tdd`（context/changed/gate）的规则发布/生效新鲜度硬闸；跳过会打 warn、不静默。稳定后 `unset`（或不设该 env）即自动恢复严格模式。

## 目录

| 路径 | 用途 |
| --- | --- |
| [common/rules/](./common/rules/) | 跨项目复用的规则与场景路由 |
| [common/engine/](./common/engine/) | CLI、门禁脚本、schema 与 golden 夹具 |
| [common/lark-bot/](./common/lark-bot/) | 可选的消息接入与任务执行服务：合并话题上下文/图片、注入项目 scope、预取 Figma 规格、按项目路由 bug 回执并自动清理附件 |
| [prds/](./prds/) | 各项目的文档、状态与证据 |
| [common/rules/rule-router.md](./common/rules/rule-router.md) | **开工常驻入口**（渐进披露路由） |
| [common/README.md](./common/README.md) | 公共规则专题的人工全索引 |
| [templates/](./templates/) | 新需求文档模板 |
| [AGENTS.md](./AGENTS.md) | 给 AI Agent 的行为规则与接入流程 |
| [CONTEXT.md](./CONTEXT.md) | 本机运行状态与恢复提示 |
| [PROJECTS.md](./PROJECTS.md) | 项目清单/状态/worktree（自动生成，勿手抄） |
| [common/CHANGELOG.md](./common/CHANGELOG.md) | 框架变更日志（近期条目；历史见 CHANGELOG-archive.md） |

## 体量治理：重要文件不无限膨胀

「常驻恒定小」由机器强制，不靠自觉：

- **常驻限额**：唯一常驻文件 `rule-router.md` ≤5000 字符，`check-doc-budget.mjs` 校验。
- **按需文件预算**：每个 `common/rules/*.md` 有告警线/硬上限（默认 9000 / 13000 字符，少数引用型大文件设有界的 grandfather 上限），超限即打回，逼迫拆分/归档/改指针。
- **脚本体量预算**：`common/engine/agent-scripts/*.mjs` 与 `common/lark-bot/*.mjs` 同样有告警线/硬上限（默认 24000 / 30000 字符，大执行器设有界 grandfather 上限）。超限就按职责拆——纯逻辑下沉到同域 `lib/` 并带 `--self-test`，`check-doc-budget.mjs` 强制每个 `lib/*.mjs` 要么有自测要么显式登记豁免（门禁/服务脚本是 AI 最难 review、出错影响最大的部分，故拆小、可测、门面只做编排）。
- **日志轮转**：`CHANGELOG.md` 只保留近期条目，旧条目轮转进 `CHANGELOG-archive.md`（不进 context、不参与预算）。
- **防重复守护**：`FORBIDDEN_DUPLICATE_BLOCKS` 登记已收敛的唯一正文源签名，防规则正文在多处回潮重复。

## 规则继承原则

- `common/` 是新项目继承规则的唯一公共入口；项目目录只沉淀当前需求的差异，一旦可跨项目复用必须回写 `common/`。
- 跨项目脚本有公共实现，项目脚本只做薄包装。
- 通用 React/TypeScript 手艺归全局 AI 规则与 skill，框架代码锚点归各仓库 `.cursor/rules`；`docs_tdd` 只承载项目流程、门禁、Mock 策略、证据与豁免。详见 [common/rules/rule-inheritance.md](./common/rules/rule-inheritance.md)。
