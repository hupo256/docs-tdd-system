# 规则继承与沉淀机制

> AI 主用:新规则不断沉淀,只写在项目目录会导致下个项目只读 `common/` 时漏继承。漏继承按**文档流程缺陷**处理,不按「Agent 忘了」处理。

## 0. 载体分层：一条规则该放哪一层（放置标准的唯一真值源）

放置有两个正交坐标轴,先定**纵轴(生效范围)**再定**横轴(通用 vs 项目差异)**:

**纵轴——按「生效范围」选载体**。越通用放得越外层,越外层越不与具体需求绑定:

| 层 | 放什么 | 载体 | 判据 |
|----|--------|------|------|
| **L1 全局** | 与任何仓库无关的编码硬手艺 | 唯一真值源 `~/.ai-rules/AGENT.md` + `~/.ai-rules/skills/*`；Codex/Claude 入口以 symlink 消费，Cursor 用用户目录薄适配器 | 换个仓库照样成立、无 fameex 锚点 |
| **L2 仓库** | 已由团队接受的通用原则 + fameex 具体锚点(token 值、`@fameex/utils` 范式、`apps/web` 结构) | 仓库 `.cursor/rules/*.mdc`(带 glob 触发) | 明确需要团队共享、经过评审且命中文件才加载；个人试验规则不进入 |
| **L3 流程** | 门禁、准入准出、清单、worktree、协作、项目事实 | 本 `docs_tdd/`(`common/` ↔ `PROJECT/`) | 管「工程怎么跑」,非「代码怎么写」 |

**判据口诀**:纯编码手艺 → L1;编码手艺但引用了 fameex 锚点 → L2;门禁/流程/项目 → L3。**同一条规则只落一层**,其余层引用指针,不复制正文。

### 0.0 个人规则本地优先（高于分层落点）

本套 `docs_tdd` 是个人 AI 工作流，默认目标是不改变团队仓库行为。纵轴判断出规则“理论上属于 L2”时，不等于可以直接写入仓库：

1. 个人新增、试验中或只服务当前 Agent 的 L1 规则只维护 `~/.ai-rules/`；L3 规则放已由 `.git/info/exclude` 本地排除的 `apps/web/docs_tdd/`。
2. 仓库根 `AGENTS.md`、`.cursor/rules/*.mdc`、`.husky/`、`package.json`、CI 配置和业务源码均视为**团队影响面**；默认只读取和遵守，不主动加入个人规则。
3. 只有用户明确要求沉淀为团队规范，且完成团队评审/提交边界确认后，才把 FameEX 锚点提升到 L2 tracked 文件。提升前在本地 L1/L3 试运行，记录命中、误报和收益。
4. 不用 `.gitignore` 修改或 `skip-worktree` 隐藏 tracked 文件中的个人规则；这会制造本地与团队不可见漂移。个人覆盖必须使用用户目录或 `.git/info/exclude` 已排除目录。
5. 每次准备修改规则载体前运行 `git ls-files <path>` 与 `git check-ignore -v <path>`：tracked 文件默认停止写入；确认 local-only 后才继续。

因此，本文后续“归 L2”的表述表示**团队认可后的最终归属**；在批准前，个人版本仍保留在本地载体，不影响同事。

L1/L2 的具体落点:全局短规则与 `coding-quality`、`figma-read` 只在 `~/.ai-rules/` 维护；`~/.codex`、`~/.claude` 和 `~/.cursor/rules/fameex-local-governance.mdc` 只是消费适配器。**已获团队批准**的仓库锚定规则才进入 tracked `.cursor/rules/`。docs_tdd 内的编码专题是 L2 规则在 L3 的本地流程侧引用，只保留门禁和项目证据需要的正文。

### 0.1 docs_tdd 内允许保留什么

`docs_tdd` 允许保留的是**项目工程自动化可执行的东西**:

- 项目阶段、准入准出、G0-G8 gate、worktree、分支、通知、证据目录和报告模板。
- PRD/Figma/API/QA 如何进入项目文档,以及冲突、裁剪、待确认如何记录。
- FameEX 项目里的契约表、字段对账、Mock 生命周期、MSW 选型、Browser/Playwright 自测和人工/Agent 验证分工。
- 机器 gate 如何证明某条项目规则被执行,包括命令、输出、豁免、失败 playbook 和交付摘要。

`docs_tdd` 不应保留的是**脱离本项目也成立的代码写法清单**。例如命名 `Props`/`Params`、禁裸 `any`、DRY、组件 300 行、查表优先、React/TypeScript 纯编码规范,正文归 L1;`packages/config/tailwind-preset.js`、`@fameex/utils` API 范式、`apps/web` 分层锚点、i18n 命名空间等 FameEX 代码锚点归 L2。L3 只能写“本项目在哪个阶段必须加载/验证这些规则”和“结果记录到哪里”。

### 0.2 迁移/审查动作

维护 `docs_tdd` 时先做四问:

1. 换一个仓库还成立吗? 成立则放 L1,这里只留入口指针。
2. 需要 FameEX 具体路径、token、包名、架构锚点才成立吗? 是则最终归属 L2；未获团队批准前留在本地载体，只把它当个人检查规则。
3. 它是在规定 Agent/人如何推进项目、验收、记录证据吗? 是则留 L3。
4. 它能被 gate、模板、项目文档或交付摘要证明吗? 不能证明的 L3 规则要补证据字段,否则不要扩写。

发现错层内容时按“先指针,再迁移”的顺序处理:先把 L3 正文改成 L1/L2 入口指针和项目门禁要求;若对应载体尚不存在，个人规则先补到 Codex/Claude 用户目录或本地 `docs_tdd`。只有明确批准为团队规范后才写 `.cursor/rules`，再从本地过渡载体删除正文。禁止为了节省当次工作把同一代码规范同时复制到 L1/L2/L3。

**横轴见 §3 之后**:选定 L3 后,再分「所有项目通用 → `common/`」vs「当前项目差异 → `PROJECT/`」。

## 1. 问题定义

真实项目会不断沉淀新规则。规则只写在某项目目录里,下个项目只读 `common/` 就会漏继承。**放置层级错误(该 L1 的塞进 L3、该 L3 的散进项目)同属漏继承,按 §0 纵轴先归层再按横轴归位。**

## 2. 新项目启动检查

每个新需求进入 G0 时必须完成:

1. 读 `common/rule-router.md`，再通过 `docs-tdd.mjs context <PROJECT-ID> <SCENARIO>` 只加载命中专题；禁止全读 `common/`。
2. 读最近一个成熟项目的 `engineering/development-rules.md`。
3. 对照是否有通用规则尚未进入 `common/`。
4. 若有,先提炼到 `common/`,再写当前项目文档或代码。
5. 在项目 README 或 checklist 记录「规则继承检查已完成」。

## 3. 规则放置标准

**先按 §0 纵轴归层,再按下表在 L3 内部归位**。L1/L2 规则不进下表(它们出 docs_tdd),此表只管落在 L3 的规则:

| 规则类型 | 放置位置 |
|----------|----------|
| 纯通用编码手艺(命名类型/DRY/300行/查表/活注释/禁假默认) | **L1** `~/.ai-rules/AGENT.md` + `~/.ai-rules/skills/*`(非本表) |
| 编码手艺 + fameex 锚点(分层/API/mapper/state/token/H5/i18n) | **L2** `.cursor/rules/*.mdc`(非本表) |
| 所有项目都应遵守的**流程规则** | `common/` 对应专题文件；所有权见 `rule-ownership.json` |
| 工作流/门禁/通知 | `common/workflow-gates.md`、`common/collaboration-and-notifications.md` |
| 目录结构 | `common/project-doc-structure.md` |
| UI token/Figma 映射(流程与门禁侧) | `common/ui-style-token-rules.md` |
| API、schema、mapper(流程与门禁侧) | `common/api-and-mapper.md` |
| 状态所有权、Mock(流程与门禁侧) | `common/architecture-and-state.md` |
| 测试、自测、Review | `common/quality-checklist.md` |
| Browser/Playwright MCP | `common/browser-e2e-mcp.md` |
| 当前项目特有约束 | `<PROJECT-ID>/engineering/development-rules.md` |
| 未确认需求、PRD/Figma/API 差异 | `<PROJECT-ID>/product/06-collaboration.md` |

### 3.1 L3 文档写法标准

L3 写规则时默认使用“触发 → 动作 → 证据 → 失败处理”四段式,避免写成代码风格教程:

| 段 | 要写什么 | 不写什么 |
|----|----------|----------|
| 触发 | 哪类项目/阶段/文件变化需要执行 | 泛泛的最佳实践口号 |
| 动作 | Agent 或负责人要读哪些项目材料、跑哪些 gate、更新哪些项目文档 | React/TS 具体代码写法长清单 |
| 证据 | 命令、表格、报告、负责人确认、豁免记录 | “已注意”“已检查”这类不可复核结论 |
| 失败处理 | 阻塞、跳过、重跑、通知、待确认如何记录 | 靠记忆下次注意 |

若某条规则无法落到证据,要么改写成可验证 gate,要么迁出 `docs_tdd`。

同一主题只能有一个正文源，登记在 `rule-ownership.json`。Source 文档可完整写触发、动作、证据、失败处理；Consumer（Router、Gate、启动协议、模板、项目文档）只写何时消费、链接哪个 Source、结果落哪里，不复制阈值、枚举、字段表、命令清单和例外条件。历史决策写 `CHANGELOG.md`，不得与当前规则并列成第二套时态。

## 4. 禁止事项

- 不把通用规则只留在旧项目 `engineering/development-rules.md`。
- 不把纯通用编码手艺(该 L1)或带 fameex 锚点的编码规则(该 L2)塞进 `docs_tdd/`——放置错层同属漏继承(见 §0)。
- 不在 `rule-router.md` §1 常驻区展开代码风格正文;常驻区只放项目硬闸、路由入口、加载指针和会导致 gate fail 的准则。
- 不把“代码质量清单”伪装成“项目流程”复制进 L3;L3 只写何时加载 L1/L2、如何验证、证据落哪里。
- 不在新项目复制整份公共规则,避免多处漂移。
- 不因 Figma 或 API 一次性缺口就修改全局契约文件。
- 不越过规则继承检查直接写业务代码。

## 5. 复盘触发条件

遇以下情况必须补公共规则:

- 用户指出「之前已经定过」。
- 新项目重复踩旧项目踩过的问题。
- Review 发现同类硬编码、状态双写、文件过大、未验 H5/主题等问题。
- Figma/Tailwind token 映射规则再次产生歧义。

## 6. 公共规则必须薄包装

公共规则不能只停在 Markdown 描述,也不能在每个项目复制一份。凡跨项目复用的规则、脚本、模板、清单、流程,都遵守「公共规则 + 项目差异」薄包装:公共目录保存唯一规则,项目目录只写当前项目事实、配置、状态、例外。

| 场景 | 公共入口 | 项目目录只允许放 |
|------|----------|------------------|
| Lark 主动通知 | `common/agent-scripts/notify-lark.mjs` | `agent/scripts/notify-lark.mjs` 薄包装、`<project-id>.json` 配置 |
| G0-G8 门禁 | `common/workflow-gates.md` | 项目当前状态和特殊门禁说明 |
| 文档结构 | `common/project-doc-structure.md` | 当前项目实际文件和状态 |
| 功能清单 | `common/prd-feature-inventory.md`、`templates/feature-inventory-template.md` | `product/00-feature-inventory.md` 的项目功能事实 |
| Agent 流程 | `common/collaboration-and-notifications.md`、`common/lark-bot-gateway.md` | 项目恢复顺序、启用状态、配置路径 |
| 工程规则 | `common/development-rules.md` 专题入口 + `rule-ownership.json` 指向的唯一正文 | 项目特殊约束、模块边界、例外说明 |
| 质量检查 | `common/quality-checklist.md` | 当前项目执行记录和跳过原因 |
| 通知记录 | `templates/notification-log-template.md` | 当前项目实际发送记录 |

防复发规则:

1. 发现公共规则没作用到新项目时,先检查是否存在项目级复制脚本、复制模板或整段复制的公共规则。
2. 若存在,必须把通用逻辑上移到 `common/` 或 `templates/`,项目文件改成薄包装或项目差异记录。
3. 不允许项目 `engineering/development-rules.md`、`agent/README.md`、`agent/lark-integration.md` 复制整份公共规则;这些文件只说明当前项目的状态、路径、启用决策、例外。
4. 有脚本时,dry-run/自测必须覆盖至少一个旧项目和一个规则来源项目,确认两边输出一致。
5. 修复后把原因写入公共规则,不能只修当前项目。

2026-06-16 复盘:Lark 消息格式已在公共规则定义,但部分历史项目仍用项目内复制的旧 `notify-lark.mjs`,导致字段名/顺序/编号规则可能漂移。已将通知脚本上移到 `common/agent-scripts/notify-lark.mjs`,后续项目脚本必须改薄包装,不复制整份通知脚本。该原则扩展到所有公共规则:项目只保留差异,不复制公共规则全文。

## 7. 新项目薄包装检查清单

新项目 G0/G1 必须完成,并在项目 README 或 `engineering/development-rules.md` 记录结果:

- [ ] 项目目录名为大写 `<PROJECT-ID>`,没用业务名或小写编号。
- [ ] 项目 README 只写状态、文档地图、待确认项,已链接 `../common/README.md`。
- [ ] `engineering/development-rules.md` 只写项目特殊约束,没复制公共工程规则全文。
- [ ] `agent/README.md` 只写恢复顺序、项目启用状态、配置路径,没复制公共 Agent/Lark 规则全文。
- [ ] 启用 Lark 主动通知则 `agent/scripts/notify-lark.mjs` 是薄包装,调用 `common/agent-scripts/notify-lark.mjs`。
- [ ] 未启用 Lark 则只记录未启用和人工同步方式,不创建无配置的伪脚本。
- [ ] `product/00-feature-inventory.md` 来自模板,内容只保留当前项目功能事实和 G2 结论。
- [ ] 质量检查、Browser/Playwright、Biome、i18n、主题、H5 等规则只引用公共规则;项目文件只写执行结果、跳过原因或项目特殊补充。
