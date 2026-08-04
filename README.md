# docs_tdd — 可移植的 AI 前端开发规则与门禁系统

一套**独立、可复用**的 AI 前端开发操作系统：用「先文档后代码 + G0-G8 门禁 + 机器可验证证据」约束 AI（Codex / Claude / Cursor）与人协作完成前端功能开发。与具体业务仓库解耦，可挂载到任意前端项目复用。

> 本仓库是从某前端工程中沉淀、抽离出的独立系统，经多轮真实项目迭代。作为个人知识库独立版本管理，不含任何业务机密以外的通用方法论。

## 它解决什么

AI 编码的两个顽疾：**跳过需求确认直接写码**、**规则散落导致每次重新解释**。docs_tdd 把开发拆成 G0-G8 阶段门禁，每阶段有机器可读的证据要求（gate 脚本实跑 biome/tsc/vitest、校验字段对账、阻塞登记、通知记录），AI「已读/已注意」不算数，只认执行契约产出的证据。

规则本身遵循「**规则可变多，常驻恒定小**」：AI 开工只常驻读一个路由文件（`common/rule-router.md`，≤5000 字符机器守），其余按场景加载，避免上下文膨胀。

## 架构

| 层 | 内容 | 位置 |
| --- | --- | --- |
| **常驻路由** | 开工唯一入口：启动协议 + 硬规则 + 场景表 | [common/rule-router.md](./common/rule-router.md) |
| **按需专题** | 架构/状态/API/Mock/UI/Figma/协作/门禁等规则，命中场景才加载 | `common/*.md`（人工索引见 [common/README.md](./common/README.md)，机器路由见 `common/rule-index.json`） |
| **门禁脚本** | 阶段验证、机器事实层、发布指纹、golden 自回归 | `common/agent-scripts/*.mjs` |
| **模板** | 新需求复制使用的文档骨架 | `templates/` |
| **项目实例** | 各需求的文档/证据（清单见自动生成的 [PROJECTS.md](./PROJECTS.md)） | `PR-xxxxx/` |

核心命令（统一入口 `common/agent-scripts/docs-tdd.mjs`）：

```bash
docs-tdd context <PROJECT-ID> <SCENARIO>   # 按场景生成 compact 规则包
docs-tdd changed <PROJECT-ID>              # 编辑后跑 code-rules / mock 校验
docs-tdd gate    <PROJECT-ID> <Gx>         # 阶段交付门禁
docs-tdd doctor  <PROJECT-ID>              # 适配/冲突/发布状态自检
docs-tdd golden                            # 让门禁机器自己被回归测试
```

## 与业务解耦：如何挂载到一个项目

系统真身可放任意位置（如 `~/github/docs_tdd`），通过**软链 + 一份绑定配置**接入消费项目，脚本零改动：

1. **挂载**：在消费仓库里把 `<app>/docs_tdd` 软链到本仓库真身（各 worktree 同样直指真身）。
2. **绑定**：在消费仓库根放一份 `docs-tdd.config.json`（gitignored，各安装/各公司自带），声明 `consumerRoot` 等；可复用默认值在已提交的 [docs-tdd.config.default.json](./docs-tdd.config.default.json)。
3. **根解析**：[common/agent-scripts/lib/roots.mjs](./common/agent-scripts/lib/roots.mjs) 的 `resolveRoots()` 把三个根解耦——
   - `docsSystemRoot`：本系统自身（从脚本位置推，与物理位置无关）
   - `consumerRoot`：被指导项目主仓（由 config 绑定确定）
   - `consumerWorktree`：当前编码 worktree（cwd 的 git 根）

换一个项目/公司复用，只需重复 1+2，不动任何脚本或规则正文。

## 如何使用（Step by Step）

以「用本系统跑一个新需求」为例的日常流程（首次接入新仓库见上一节「挂载」）。命令统一走 `common/agent-scripts/docs-tdd.mjs`（下文简写 `docs-tdd`）。

**0. 前置**：系统已挂载到消费仓库（软链 + `docs-tdd.config.json`），`docs-tdd doctor <任意ID>` 适配项全 PASS。

**1. 启动新需求** — 对 AI 说启动口令：
```text
根据 docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：<PRD 链接或本地路径>。
```
AI 会先读 `common/rule-router.md`，在 `PR-01234/` 下建项目目录，按 `common/project-doc-structure.md` 放置 `inbox/ product/ engineering/ agent/`。

**2. G0 资料接收**：把 PRD / Figma / API 资料放进 `PR-01234/inbox/`。含图片、表格、嵌入对象时先完成 `prd_intake`（`docs-tdd context PR-01234 prd_intake`），逐项读取分类，读不了即阻断，不猜。

**3. G1 文档生成**：AI 复制 `templates/feature-inventory-template.md` → `product/00-feature-inventory.md`，产出 PRD 全量功能清单初稿（防 scope 误裁）。

**4. 按场景加载规则**：`docs-tdd context PR-01234 <SCENARIO>` 生成 compact 规则包，只读命中场景的专题，不全读 `common/`。常用场景：`g0_g2_scope` `write_api` `write_mapper` `write_query_hook` `write_ui` `write_figma` `write_msw` `g6_verify`（全表见 `rule-router.md §3`）。

**5. G2 方案定稿**：对功能清单逐条确认「做 / 不做 / 延期」，写完 `product/02-technical-design.md`（含复用盘点、PRD 路径核验）后**才允许写业务代码**。

**6. G4 建编码 worktree**：
```bash
node <mount>/common/agent-scripts/prepare-coding-worktree.mjs PR-01234 --dry-run   # 先看
node <mount>/common/agent-scripts/prepare-coding-worktree.mjs PR-01234             # 建分支+软链+装依赖+起 dev
```
从最新 `origin/online` 切 `feature/PR-01234`，基线校验通过才算 ready。

**7. 编码 + 增量校验**：每次改完代码跑
```bash
docs-tdd changed PR-01234      # 实跑 code-rules / mock-manifest 校验改动文件
```

**8. 阶段门禁**：每过一关跑对应 gate，全绿才进下一阶段：
```bash
docs-tdd gate PR-01234 G5      # 接口联调（字段对账、删 mock 臆造字段）
docs-tdd gate PR-01234 G6      # 自测验收（实跑 biome/tsc/vitest + code review findings 清零）
docs-tdd gate PR-01234 G7      # QA 用例回归
docs-tdd gate PR-01234 G8      # 交付摘要 + 残留风险/阻塞（blockers.json）
```
`docs-tdd doctor PR-01234` 随时自检适配/冲突/发布状态；缓存仅复用同输入 PASS，强制实跑加 `--no-cache`。

**9. 上线后回收**：需求合入 `origin/online` 并验证后，回收一次性 worktree（保留 `PR-01234/` 文档）：
```bash
node <mount>/common/agent-scripts/decommission-worktree.mjs PR-01234 --dry-run
node <mount>/common/agent-scripts/decommission-worktree.mjs PR-01234
```

> 维护系统本身（改规则/加专题/发指纹）用场景 `docs_tdd_maintenance`；改完依次 `docs-tdd check`、`rule-release.mjs --write`、`effective-rules.mjs --write`，否则发布漂移会阻断 context/changed/gate。

## 目录

| 路径 | 用途 |
| --- | --- |
| [common/](./common/) | 跨项目复用的规则、门禁脚本、schema、模板索引 |
| [common/rule-router.md](./common/rule-router.md) | **开工常驻入口**（渐进披露路由） |
| [common/README.md](./common/README.md) | 公共规则专题的人工全索引 |
| [templates/](./templates/) | 新需求文档模板 |
| [AGENTS.md](./AGENTS.md) | 给 AI Agent 的行为规则与接入流程 |
| [CONTEXT.md](./CONTEXT.md) | 本机运行状态与恢复提示 |
| [PROJECTS.md](./PROJECTS.md) | 项目清单/状态/worktree（自动生成，勿手抄） |
| [common/CHANGELOG.md](./common/CHANGELOG.md) | 框架变更日志（近期条目；历史见 CHANGELOG-archive.md） |

## 体量治理：重要文件不无限膨胀

「常驻恒定小」由机器强制，不靠自觉：

- **常驻限额**：唯一常驻文件 `rule-router.md` ≤5000 字符，`check-doc-budget.mjs` 校验。
- **按需文件预算**：每个 `common/*.md` 有告警线/硬上限（默认 9000 / 13000 字符，少数引用型大文件设有界的 grandfather 上限），超限即打回，逼迫拆分/归档/改指针。
- **日志轮转**：`CHANGELOG.md` 只保留近期条目，旧条目轮转进 `CHANGELOG-archive.md`（不进 context、不参与预算）。
- **防重复守护**：`FORBIDDEN_DUPLICATE_BLOCKS` 登记已收敛的唯一正文源签名，防规则正文在多处回潮重复。

## 规则继承原则

- `common/` 是新项目继承规则的唯一公共入口；项目目录只沉淀当前需求的差异，一旦可跨项目复用必须回写 `common/`。
- 跨项目脚本有公共实现，项目脚本只做薄包装。
- 通用 React/TypeScript 手艺归全局 AI 规则与 skill，框架代码锚点归各仓库 `.cursor/rules`；`docs_tdd` 只承载项目流程、门禁、Mock 策略、证据与豁免。详见 [common/rule-inheritance.md](./common/rule-inheritance.md)。
