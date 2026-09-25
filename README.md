# docs_tdd v3.5 - 可移植的 AI 前端开发规则与门禁系统

> 当前产品能力线：**v3.5**。截至 2026-09-23，**v3.5.0 / stable** 已通过 `docs-tdd guard --strict`、规则发布和 golden 回归；pilot 仍为 collecting，未宣称 production-ready。项目文件中的兼容路由标识仍为 `workflowVersion: 2`，它不是产品发布版本。

一套**独立**的 AI 前端开发操作系统：新需求默认使用第二代 work-item 流程的「原始需求 → 独立覆盖审查 → 风险分级 → 当前代码证据 → 单一正式出口」，存量项目兼容第一代 G0–G8 门禁；两条工作流都只认机器可验证证据。引擎与业务仓库通过 `docs-tdd.config.json` + 一个软链解耦；**目前只在一个仓库（`@fameex/web`）真实验证过，移植到第二个仓库需要改动下列锚点**（见[可移植性的真实边界](#可移植性的真实边界)）。

> 本仓库是从某前端工程中沉淀、抽离出的独立系统，经多轮真实项目迭代。作为个人知识库独立版本管理，不含任何业务机密以外的通用方法论。

## 它解决什么

AI 编码的两个顽疾：**跳过需求确认直接写码**、**规则散落导致每次重新解释**。docs_tdd v3.5 用 `work-item.json` 固定原始需求、覆盖审查、风险等级和证据，并由 `latest-result.json` 给出唯一正式结论；抽取先经过确定性 intake audit，独立 Reviewer 在同一 source lifecycle 总计最多两轮；仍未通过时允许先实现，但测试交接前必须人工逐 finding 核对并完成一次真实预提测运行（CLI 预填，人工只确认必要结果），第一代 G0–G8 仅作为存量兼容。AI「已读/已注意」不算数，只认执行契约产出的证据。

v3.5 把流程继续收敛为 requirement-to-commit：四档效率路由（`micro`、`lite`、`standard`、`high-risk`）带显式效率目标；safe work context、隔离 worktree、环境分支和路径边界共同阻断越界写入；source graph、requirement/surface/evidence 对账和四项目 replay 用于发现漏项与漂移；`source`、`review`、`code`、`browser`、`environment`、`external-dependency` 六类失败进入有界修复，同指纹不重复重试。时间、命令和证据目标超标只记录 `target-exceeded` 并停止非必要扩张，不中断需求交付；真实失败保持原失败类型并给唯一恢复命令。交付真值只接受当前 enforced PASS、`autonomous/cli-attested`、完整性与新鲜度、匹配的冻结路径、非空 delivery commit SHA 和 clean Git scope。pilot 仍为 `collecting`，尚未宣称 production-ready。

规则本身遵循「**规则可变多，常驻恒定小**」：AI 开工只常驻读一个路由文件（`common/rules/rule-router.md`，≤5000 字符机器守），其余按场景加载，避免上下文膨胀。v2 实现上下文对 V0/V1 保持 4K 硬上限；V2 使用 8K 目标、24K 硬上限，处于两者之间时显式警告但不中断大型需求。

## 架构

| 层 | 内容 | 位置 |
| --- | --- | --- |
| **常驻路由** | 开工唯一入口：启动协议 + 硬规则 + 场景表 | [common/rules/rule-router.md](./common/rules/rule-router.md) |
| **按需专题** | 架构/状态/API/Mock/UI/Figma/协作/门禁等规则，命中场景才加载 | `common/rules/*.md`（人工索引见 [common/README.md](./common/README.md)，机器路由见 `common/rules/rule-index.json`） |
| **流程引擎** | 阶段验证、机器事实层、发布指纹、golden 自回归 | `common/engine/` |
| **模板** | 新需求复制使用的文档骨架 | `templates/` |
| **项目实例** | 各需求的文档/证据（清单见自动生成的 [PROJECTS.md](./PROJECTS.md)） | `prds/<PROJECT-ID>/` |

运行环境必须提供 Node.js、Git 与 ripgrep（`rg`）；`docs-tdd doctor` 会对缺失依赖 fail-closed。核心命令统一走 `<mount>/common/engine/agent-scripts/docs-tdd.mjs`。下表中的 `docs-tdd` 是 `node <mount>/common/engine/agent-scripts/docs-tdd.mjs` 的阅读简写：

```bash
docs-tdd run <PROJECT-ID> --prd <src>      # v2 编排入口：初始化/恢复并推进确定性动作；不会越过 needs-agent / needs-user
docs-tdd context <PROJECT-ID> <SCENARIO>   # 按场景生成默认 brief/compact 规则包；可显式覆盖模式
docs-tdd kickoff <PROJECT-ID> --prd <src>  # 默认创建 workflowVersion 2 feature；已定位缺陷可加 --kind bugfix，显式 v1 加 --legacy
docs-tdd verify  <PROJECT-ID> --input <json> # 第二代协议唯一正式出口，非 PASS 阻断
vnext-delivery-guard.mjs --project <ID> ... # pre-commit/CI 只读校验 PASS、指纹与完整改动集合
docs-tdd status|next|resume <PROJECT-ID>   # 状态、唯一下一步、断点恢复
docs-tdd source-update <PROJECT-ID> --input X # 登记后到的 Figma/API 快照并触发增量对齐
docs-tdd source-sync <PROJECT-ID>          # 原子重拉远端 PRD；有漂移则使旧抽取/审查失效
docs-tdd source-graph <PROJECT-ID>         # 编译当前 source graph 并检查冻结 source fingerprint
docs-tdd extract <PROJECT-ID> --out X      # 生成三阶段抽取脚手架；--input X 应用候选
docs-tdd coverage-check <PROJECT-ID>       # Review 前运行确定性 Coverage Compiler
docs-tdd dev-check <PROJECT-ID>             # 实现中期检查受审查的非浏览器命令、改动路径与 surface 映射
docs-tdd manual-test <PROJECT-ID> --out X   # 仅两轮审查未收敛时生成预填人工实跑单；--input X 应用确认
docs-tdd checkpoint <PROJECT-ID> --input X    # Agent 回写实现/修复 checkpoint；非日常人工操作
docs-tdd recommend <PROJECT-ID>            # 根据当前改动推荐场景
docs-tdd changed <PROJECT-ID>              # v1 编辑后增量校验；v2 项目拒绝执行
docs-tdd gate    <PROJECT-ID> <Gx>         # v1 阶段交付门禁；v2 项目拒绝执行
docs-tdd capability <PROJECT-ID>           # 查看 worktree、规则集与发布摘要
docs-tdd probe <PROJECT-ID> --client pi    # 验证规则上下文产出、预算与同会话去重
docs-tdd doctor                            # 适配/冲突/发布状态自检
docs-tdd check <PROJECT-ID>                # 校验文档、规则与脚本预算
docs-tdd release <PROJECT-ID> --scenario X # 原子发布 L3/effective + doctor/golden/context smoke
docs-tdd golden                            # 让门禁机器自己被回归测试
docs-tdd guard                             # 机器层兜底：一条命令跑 golden + 发布 fresh 检查 + doctor
docs-tdd guard --strict                    # 再把本地可修的 doctor warning 视为阻断
docs-tdd rule-health                       # 规则体检：命中分布、warn 台账年龄、待退休、零命中清单
```

统一审计入口是 `docs-tdd doctor`：它检查六个 AI 入口是否一个不少、没有未登记入口，是否引用同一组 L1/L2/L3 source fingerprint，以及软链、adapter、Lark runtime 和发布清单是否漂移。需要连门禁回归一起检查时运行 `docs-tdd guard`；任一项失败都不是 PASS。

### 可选 Lark 自动修复链的边界

`common/lark-bot/` 保留独立的消息任务、AI 分析、轻量质量闸和本地提交链，**不接入 v3.5 状态机**。它的 `done` 仅表示候选修复已通过 Worker 最终 diff/Biome 复验并本地提交，审计固定为 `assuranceMode=lark-lightweight`、`deliveryAuthority=false`；高风险改动仍须另取项目级 v3.5 authoritative PASS 才能正式交付。这样既不让群内小修复承担完整项目流程，也不把 Lark 结果误当正式绿灯。

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

第一条最后显示 `roots: OK`，表示脚本已从当前目录找到三件事：规则系统放在哪里、哪个仓库在使用它、当前命令属于哪个 worktree。第二条检查六个 AI 入口、规则适配、冲突、本地隔离和发布状态。失败时按输出修配置；日常使用只需要维护 `docs-tdd.config.json` 和挂载软链，不需要理解内部变量或手工拼路径。

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

命令统一走 `<mount>/common/engine/agent-scripts/docs-tdd.mjs`（下文简写 `docs-tdd`）。

### 默认：v3.5 工作流

v3.5 是当前产品版本；项目文件继续使用 `workflowVersion: 2` 作为第二代协议的稳定兼容标识。风险等级 `V0/V1/V2` 也不是产品版本：V0 是严格受限的局部微改，V1 是多影响面或中等风险，V2 是资金、权限、新 API、跨应用等高风险变更并要求人工确认范围。效率路由会在这些风险等级内进一步选择 `micro`、`lite`、`standard` 或 `high-risk`，并为 context、规则、命令、evidence、repair 和 elapsed 设置预算。

```text
输入 PRD
  → 建立 work-item 并规范化文本、表格、图片等来源
  → 由脚手架抽取原子需求、实现 surface 和验收命令
  → 确定性 intake audit 前置拦截结构/锚点/证据计划缺陷
  → 启动隔离的 source-only 子会话做独立覆盖审查（同一 source lifecycle 总计最多两轮）
  → 按 scope × risk 路由 V0 / V1 / V2
  → Agent 在 feature worktree 实现并登记 checkpoint
  → CLI 执行已审查的 evidence command plan
  → enforced verify 单一出口
     ├─ failed：有界自动修复后重新验证
     ├─ blocked：等待资料或人工决策
     └─ passed：只提交冻结路径，永不自动 push
```

#### 1. PRD-only 启动与断点恢复

```bash
docs-tdd run PR-01234 --prd <source> # 新项目，PRD 是唯一必需输入
docs-tdd run PR-01234                # 中断后重复运行，按当前事实恢复
```

CLI 始终返回带稳定 `actionId` 的唯一 action packet；Agent 只按 `action`、`reason`、`constraints` 执行下一步，不让用户手工选择 Gate，也不从 Markdown 阶段描述猜状态。第二代项目禁止运行第一代的 `gate` 或 `changed`。

`run` 会初始化或恢复项目，并通过选定的 Codex/Claude 宿主执行已接通的语义动作；确定性动作由 CLI 执行。需要人工审批或业务裁决时返回 `needs-user`，不支持的动作返回 `needs-agent`。action packet 本身不是完成证据。已失败的同一 action 不会在普通 `run` 中自动重放；修复失败原因后，只有显式传入 `--retry-failed-action` 才会重新调用，`status` 会显示失败终态和唯一重试命令。

#### 2. 结构化需求、确定性前置审计与机器独立审查

PRD 被确定性转换为 source units；表格既保留容器上下文，也逐数据行生成稳定 unit。先用 `docs-tdd extract <ID> --out /tmp/extraction.json` 生成带来源锚点的脚手架，按 Facts → Atomic Requirements → Surface Candidates 三阶段填写后，以 `--input` 应用。CLI 会先审计重复 ID、语义 unit/表格行反向覆盖、Fact→Requirement 链路、集合计数和 surface 映射；失败时不调用 Reviewer。需求作者登记身份后，`docs-tdd review` 才启动一个独立 session 做冷读（独立性按 session 判定，默认沿用同一 client，可显式跨 client）；reviewer 只审语义范围，不审 evidence plan、代码或工具。每个 source lifecycle 总计最多自动审查两轮，人工介入不重置预算：候选未变化禁止重试，相同 finding 再现或两轮未通过会持久化 `human-review-deferred`；实现可以继续，但 evidence / 测试交接前必须人工逐 finding 裁决。Reviewer 启动失败仍立即 `escalated`，在实现前处理，不进入无限循环。审查结果由 CLI 本机签名，手写 reviewer JSON、复用同一 session、未处置 finding 或来源漂移都不能形成有效审查。

#### 3. 安全上下文、实现与真实覆盖登记

范围审查通过后，Agent 在安全绑定的 `feature/<PROJECT-ID>` worktree 实现，并通过 checkpoint 回写当前 `actionId`、真实 `changedPaths`、代码搜索得到的 `discoveredSurfaces` 和实际完成的 `coveredSurfaceIds`。消费仓、环境分支、worktree、路径穿越、越界写入和已有文件覆盖均由 safe work context fail-closed 校验；CLI 使用 Git 机械核验路径，不接受不存在或未变化的文件凑数。

```bash
docs-tdd checkpoint PR-01234 --input /tmp/checkpoint.json
docs-tdd run PR-01234
```

#### 4. CLI-attested evidence 与单一出口

`run` 会执行独立审查冻结的 argv command plan，并自动组装 surface report 进入 enforced verify。命令假 PASS、shell/no-op 命令、测试期间改写代码、漏覆盖 requirement/surface，或用普通测试冒充必需的 browser runtime evidence，都会 fail-closed。

证据按 `path-set-v1` 绑定相关路径的有效内容，而不是脆弱地只绑定 HEAD：仅提交相同字节或修改无关路径不会使绿灯作废；修改、删除、改权限或改软链目标，只要命中冻结路径，就会自动重新验证。

正式交付必须同时满足：

```text
mode=enforced
status=passed
ok=true
assuranceMode=autonomous
evidenceTrust=cli-attested
```

`failed` 或 `blocked` 均不可交付；外部手填证据只能得到 `assisted-pilot / caller-supplied`，不能成为正式绿灯。当前 delivery truth 还要求 evidence/result integrity 与 freshness 通过、delivery commit 的 SHA 非空且路径集合匹配冻结集合、Git scope clean。代码检查和 browser 检查分别最多自动修复两轮，六类失败域按同一失败指纹去重；重复失败保持真实失败类型并明确升级人工处理，不无限循环。效率目标超标不构成交付终态。

人工验收中，普通 `unresolved` 表示当前场景未解决，路由到实现修复；只有 `newOmissions` 表示需求范围出现新遗漏，才回到 extraction 并重新审查。字符串 locator 仍保留为兼容 fallback，不作为已移除能力宣称。

#### 5. 晚到资料与精确提交

Figma/API 在 intake 阶段可以是 `required + pending`，不阻止 PRD-first 实现；若最终验收依赖它们，则 unresolved 状态不能进入 ready-to-test。资料到达后运行 `docs-tdd source-update`，只处理受影响的增量并重新对齐证据。

取得 authoritative PASS 后，Autopilot 只 `git add` / `git commit --only` 当前冻结路径，不带入其他工作区改动，且永不执行 `git push`。pre-commit delivery guard 会再次校验 PASS、签名、内容指纹和提交集合。当前 owner 明确选择本机 pre-commit 作为交付边界，远端 CI guard 为 `not-required`；使用 `--no-verify` 或在未安装本地 hook 的机器提交属于该边界之外的显式风险。

默认工作流状态只持久化三个文件：

```text
work-item.json       # 当前需求、范围、审查、路由和 blocker
latest-result.json   # 唯一当前正式结论
runs.jsonl           # 追加式历史
```

完整协议、命令和失败条件见 [common/vnext/README.md](./common/vnext/README.md)。

### 兼容：v1 存量或显式 legacy 项目

以下 G0–G8 流程只适用于 README 标记 `workflowVersion: 1` 的存量项目，或用 `--legacy` 新建的项目。

**0. 前置**：系统已挂载到消费仓库（软链 + `docs-tdd.config.json`），`docs-tdd doctor` 适配项全 PASS。

**1. 启动 v1 需求** — 对 AI 说启动口令并明确要求 legacy：
```text
根据 docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：<PRD 链接或本地路径>。
```
AI 会先读 `common/rules/rule-router.md`，再执行 `docs-tdd kickoff PR-01234 --prd <source> --legacy`。命令幂等创建 v1 项目、同步 PRD、初始化 intake 并写 `agent/run-state.json`；中断后用 `status/next/resume` 恢复。

**2. G0 资料接收**：把 PRD / Figma / API 资料放进 `prds/PR-01234/inbox/`。含图片、表格、嵌入对象时先完成 `prd_intake`（`docs-tdd context PR-01234 prd_intake`），逐项读取分类，读不了即阻断，不猜。PRD 指纹会剥离每次同步变化的 `syncedAt`、临时媒体下载 URL 和图片 alt 描述，避免同一内容反复误报漂移；旧 manifest 可用 `prd-intake.mjs PR-01234 --remigrate` 就地迁移，不重新拉远端、不丢人工分类。

**3. G1 文档生成**：AI 基于启动器生成的模板填写 PRD 全量功能清单、scope、技术方案初稿、任务与协作记录；G1 有独立机器出口，不与 G0 共用空骨架判定。`product/00-feature-inventory.md` 是「做 / 不做 / 延期」和 Scope 裁剪记录的唯一真相源，`01-scope-and-phases.md` 只写摘要，`04-frontend-tasks.md` 只保留本期做项，避免多份范围结论漂移。

**4. 按场景加载规则**：`docs-tdd context PR-01234 <SCENARIO>` 只读命中场景的专题，不全读 `common/`。模式由场景选择默认 brief/compact，也可用互斥的 `--brief|--compact|--full` 显式覆盖；brief 只折叠索引中逐引用标记为安全指针的机器规则。传 `--session-id <task-id>`（或由客户端注入 session 环境变量）后，同一 project/client/session 的相同 pack 才返回 delta；无会话身份时不做跨任务去重。编码场景须先通过 G2，并签发绑定当前客户端、规则指纹、G2 输入与 HEAD 的 24 小时 rule session v2；`changed` 和 G5-G8 拒绝缺失、过期或由其他客户端签发的会话。Cursor 原生消费 `.cursor/rules` 的 glob/alwaysApply；Claude/Codex 的 PreToolUse hook 使用同一 Resolver，在首次编辑时 deny-and-retry 注入命中正文，并由 PostToolUse 生成消费回执供 `changed`/G5+ 校验。Cursor adapter 会自动带 `--client cursor`；未传 `--client` 且未检测到 Codex/Claude 环境时默认按 `cursor` 记账；纯人工终端使用 `--client human`，检测到 Codex/Claude 环境时不得伪装成其他客户端。Lark Bot 无人值守入口不复用这份会话，而是在每个任务启动 AI 前读取当前规则章节并检查发布链；发布链 stale 会在 health / 日志告警，但不再把修 bug 任务整体挡下，必需常驻规则缺失仍 fail-closed。常用场景：`g0_g2_scope` `write_api` `write_mapper` `write_query_hook` `write_ui` `write_figma` `write_msw` `g6_verify`（全表见 `rule-router.md §3`）。其中 `g6_verify` 仅打印四维执行计划；实际依次加载 `g6_code_review`、`g6_contract`、`g6_visual`、`g6_delivery`，完整或 partial G6 门禁会机器校验四维均为当前代码/规则状态。

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
docs-tdd gate PR-01234 G7      # 提测用例预检与开发侧回归
docs-tdd gate PR-01234 G8      # production-mode build + feature 推送 + test 提测摘要
```
`docs-tdd doctor` 随时自检适配/冲突/发布状态；缓存仅复用同输入 PASS，强制实跑加 `--no-cache`。

> **G8 边界**：G8 PASS 只表示开发侧已完成并可把功能/修复分支发布到 `test` 提交 AQ 测试，不表示 test、pre 或 online 已通过。后续由同一功能/修复分支分别合入 `test`（AQ 验证）→ `pre`（PM 验证）→ `online`（生产发布）；环境分支不得反向合回功能/修复分支。

> **人机分界（自动化边界要如实）**：G0–G4（需求→文档→方案→MSW 编码）高度自动；G5–G8 是**人机协同**——gate 机器实跑 biome/tsc/vitest/build 与结构化验收/字段对账，但**真实接口联调、视觉还原（Figma 并排 ≥95%）、交互手感、响应式、QA 用例执行以人工确认为锚点**（分工见 [common/rules/verification-division-of-labor.md](./common/rules/verification-division-of-labor.md)：Agent 固化能回归的逻辑/边界/数据/DOM 契约，人工过一眼能判的像素/手感/响应式）。判断层的 `acceptance-results.json`/`code-review.json` 由 Agent 产出、gate 校验其结构与证据锚点真实性，但语义正确性仍需人工/Review 兜底（执行强度分级见 [common/rules/rule-execution-model.md §3](./common/rules/rule-execution-model.md)）。人工确认在机器侧有落点：`stage-status.json`（G5/G7 处置态）、人工判定的 passed 验收项与 `code-review.json` 都写 `confirmedBy` + `confirmedAt`，缺签名或用 AI 客户端名代签由 `DOC-CONFIRM-001..004` 逐条点名（见 [rule-ids-and-gates.md §3.7](./common/rules/rule-ids-and-gates.md)）。

**9. 上线后回收**：需求合入配置的 `baseRef` 并验证后，回收一次性 worktree（保留 `prds/PR-01234/` 文档）：
```bash
node <mount>/common/engine/agent-scripts/decommission-worktree.mjs PR-01234 --dry-run
node <mount>/common/engine/agent-scripts/decommission-worktree.mjs PR-01234
```

> 维护系统本身（改规则/加专题/发指纹）使用场景 `docs_tdd_maintenance`；改完先运行 `docs-tdd check <PROJECT-ID>`，再运行 `docs-tdd release <PROJECT-ID> --scenario docs_tdd_maintenance` 原子发布并自检。
>
> **规则漂移不再阻断在飞项目**：每个业务项目在 `agent/project-manifest.json` 的 `rulePolicy` 钉住其验收依据的规则政策版本（commit + policyFingerprint），context/changed/gate 从该 commit 不可变读规则文档。共享规则仓的后续编辑、未发布草稿、`common/engine/**` 引擎更新、个人 L1/adapter 变化一律只 warn、不阻断业务命令；只有已发布规则政策基线（rule-release manifest）损坏/缺失、或项目 pin 所指 commit 内容缺失才硬阻塞。用 `docs-tdd rules status <PR>` 查 pinned vs latest 差距、`docs-tdd rules upgrade <PR>` 显式升级到最新发布（只影响该项目）。

## 目录

| 路径 | 用途 |
| --- | --- |
| [common/rules/](./common/rules/) | 跨项目复用的规则与场景路由 |
| [common/engine/](./common/engine/) | CLI、门禁脚本、schema 与 golden 夹具 |
| [common/vnext/](./common/vnext/) | v3.5 正式工作流、单一出口、基线、历史灰度与切换决策 |
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

- **常驻限额**：L3 唯一常驻文件 `rule-router.md` ≤5000 字符，L1 `~/.ai-rules/AGENT.md` ≤7000 字符；跨层基础常驻面（L1 + L3 + L2 `alwaysApply`）≤16000 字符，均由 `check-doc-budget.mjs` 校验并报告分项；同一检查还报告 TSX/hook/TS 三类首次编辑的实际 L2 注入量。
- **按需文件预算**：每个 `common/rules/*.md` 有告警线/硬上限（默认 9000 / 13000 字符，少数引用型大文件设有界的 grandfather 上限），超限即打回，逼迫拆分/归档/改指针。
- **脚本体量预算**：`common/engine/agent-scripts/*.mjs` 与 `common/lark-bot/*.mjs` 同样有告警线/硬上限（默认 24000 / 30000 字符，大执行器设有界 grandfather 上限）。超限就按职责拆——纯逻辑下沉到同域 `lib/` 并带 `--self-test`，`check-doc-budget.mjs` 强制每个 `lib/*.mjs` 要么有自测要么显式登记豁免（门禁/服务脚本是 AI 最难 review、出错影响最大的部分，故拆小、可测、门面只做编排）。
- **日志轮转**：`CHANGELOG.md` 只保留近期条目，旧条目轮转进 `CHANGELOG-archive.md`（不进 context、不参与预算）。
- **防重复守护**：`FORBIDDEN_DUPLICATE_BLOCKS` 登记已收敛的唯一正文源签名，防规则正文在多处回潮重复。

## 规则继承原则

- `common/` 是新项目继承规则的唯一公共入口；项目目录只沉淀当前需求的差异，一旦可跨项目复用必须回写 `common/`。
- 跨项目脚本有公共实现，项目脚本只做薄包装。
- 通用 React/TypeScript 手艺归全局 AI 规则与 skill，框架代码锚点归各仓库 `.cursor/rules`；`docs_tdd` 只承载项目流程、门禁、Mock 策略、证据与豁免。详见 [common/rules/rule-inheritance.md](./common/rules/rule-inheritance.md)。
