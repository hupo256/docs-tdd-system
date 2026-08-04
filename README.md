# apps/web 本地 TDD 开发文档

> 本目录只在本机使用：`apps/web/docs_tdd/` 已通过 `.git/info/exclude` 忽略，不跟踪、不 push。它是 Web 功能开发期间给 Codex / Cursor / 负责人共同使用的本地知识库。

## 目录职责

| 路径                                               | 用途                                             |
| -------------------------------------------------- | ------------------------------------------------ |
| [AGENTS.md](./AGENTS.md)                           | 给 AI Agent 的行为规则、必读顺序、新需求接入流程 |
| [CONTEXT.md](./CONTEXT.md)                         | 当前本地运行状态、恢复提示（项目清单见 PROJECTS.md） |
| [PROJECTS.md](./PROJECTS.md)                       | 项目清单/状态/worktree 唯一真值源（自动生成，勿手抄） |
| [common/](./common/)                               | 跨项目复用的项目流程、门禁、自测、边界和证据规则 |
| [templates/](./templates/)                         | 后续新需求复制使用的文档模板                     |
| `PR-xxxxx/`                                         | 各需求项目文档目录；完整清单与状态见 PROJECTS.md |

## 文档演进来源

当前规则来自多轮真实项目沉淀：

1. `apps/web/docs_tdd/PR-01685/`：Campaign 活动落地页，沉淀了先文档后代码、G0-G8 门禁、Browser / Playwright 自测、主题与 H5 规则。
2. `apps/web/docs_tdd/PR-01973/`：TradFi 落地页，沉淀了老接口复用、Figma / PRD 冲突处理、Lark webhook 阶段通知。
3. `apps/web/docs_tdd/PR-01988/`：预测市场二期，沉淀了 Admin mock-first、验收矩阵和高风险操作安全闸口。
4. `apps/web/docs_tdd/PR-02006/`：TradFi 板块币种体验优化，沉淀了新需求 Lark PRD 同步和 G0/G1 启动链路。

## 新项目默认流程

### 新需求启动口令

后续新 chat 建议直接使用：

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：<PRD 链接或本地路径>。
```

Agent 必须先读 [common/rule-router.md](./common/rule-router.md)，按场景命中专题；如需机器路由，读取 [common/rule-index.json](./common/rule-index.json)。不要一次性读取整个 `common/`。通用代码质量不从 `docs_tdd` 展开：Codex 读 `~/.codex/AGENTS.md` 和按需 skill，Claude 读 `~/.claude/CLAUDE.md` 和按需 skill，FameEX 锚点按主题读 `.cursor/rules/*.mdc`。

1. 在 `apps/web/docs_tdd/<PROJECT-ID>/` 下建项目目录，目录名必须是大写项目编号，例如 `PR-01234`。
2. **Agent 自动**：复制 [templates/feature-inventory-template.md](./templates/feature-inventory-template.md) → `product/00-feature-inventory.md`（见 [common/prd-feature-inventory.md](./common/prd-feature-inventory.md) §3）。
3. **G0**：Agent 读 `inbox/` PRD（含验收标准）填清单初稿。
4. **G2**：定稿每条「做 / 不做 / 延期」后再写业务代码。
5. 按 [common/project-doc-structure.md](./common/project-doc-structure.md) 放置 `inbox/`、`product/`、`engineering/`、`agent/`。
6. 先读 [common/rule-router.md](./common/rule-router.md)；只读取当前场景命中的公共规则专题。
7. 做规则继承检查：对照最近一个成熟项目的 `engineering/development-rules.md`，确认通用规则已进入 `common/`。
8. 如果旧项目有通用规则只沉在项目目录里，先提炼到 `common/`，再继续当前项目。
9. 先写 / 更新文档，确认后再写业务代码。
10. 实现中发现 PRD、Figma、API、QA 或代码现状冲突，先回写项目文档，再继续开发。
11. 执行薄包装检查：项目文档只写项目差异；公共规则、脚本、模板、清单和流程只保留在 `common/` 或 `templates/`。

## 规则继承原则

- `common/` 是新项目继承规则的唯一公共入口。详见 [common/rule-inheritance.md](./common/rule-inheritance.md)。
- 项目目录只沉淀当前需求的特殊规则；一旦规则可跨项目复用，必须回写到 `common/`。
- 跨项目脚本必须有公共实现，项目脚本只做薄包装；已启用 Lark 通知的项目统一调用 `common/agent-scripts/notify-lark.mjs`。
- 出现“以前定过但新项目没继承”的情况，视为文档流程缺陷，先修公共文档再继续实现。
- `docs_tdd` 只沉淀项目流程、边界、自测和证据；纯 React/TypeScript 代码规范归全局 AGENTS/skill，FameEX 代码锚点归 `.cursor/rules`，这里只保留触发入口和验证证据。

## 公共规则专题

| 文档                                                                                     | 主题                              |
| ---------------------------------------------------------------------------------------- | --------------------------------- |
| [common/rule-router.md](./common/rule-router.md)                                         | **渐进披露路由表（开工常驻入口）** |
| [common/rule-inheritance.md](./common/rule-inheritance.md)                               | 规则继承与沉淀机制                |
| [common/prd-feature-inventory.md](./common/prd-feature-inventory.md)                     | PRD 全量功能清单（防 scope 误裁） |
| [common/development-rules.md](./common/development-rules.md)                             | 项目开发流程总览与专题入口        |
| [common/change-scope-boundary.md](./common/change-scope-boundary.md)                     | 改动边界与影响半径（越界先警告+重点 check） |
| [common/architecture-and-state.md](./common/architecture-and-state.md)                   | API / mapper / state / Mock 的项目门禁与证据 |
| [common/mock-legacy-route-a.md](./common/mock-legacy-route-a.md)                         | Mock 路线 A（`if(USE_MOCK)`）拆除税，仅遗留功能适用 |
| [common/ui-style-token-rules.md](./common/ui-style-token-rules.md)                       | Figma、Tailwind token、主题、H5 的项目验收流程 |
| [common/react-component-props-types.md](./common/react-component-props-types.md)         | Props/Params 已上移 L1 的本地指针 |
| [common/quality-checklist.md](./common/quality-checklist.md)                             | 测试、自测、Review、交付摘要      |
| [common/collaboration-and-notifications.md](./common/collaboration-and-notifications.md) | G0-G8 协作通知和安全边界          |
| [common/lark-active-notification.md](./common/lark-active-notification.md)               | Lark 自定义机器人主动通知规则      |
| [common/lark-bot-gateway.md](./common/lark-bot-gateway.md)                               | 群内 @ 应用转任务和 Worker 链路    |

## 模板

| 文档                                                                                 | 用途                              |
| ------------------------------------------------------------------------------------ | --------------------------------- |
| [templates/feature-doc-checklist.md](./templates/feature-doc-checklist.md)           | 新需求 G0-G8 文档和验收清单       |
| [templates/feature-inventory-template.md](./templates/feature-inventory-template.md) | PRD 功能清单模板（G0-G2 必填）    |
| [templates/context-summary-template.md](./templates/context-summary-template.md)     | 项目恢复短摘要模板，减少每次上下文读取 |
| [templates/03-api-contract-template.md](./templates/03-api-contract-template.md)     | API 契约 + 字段对账表模板（Mock 阶段起建） |
| [templates/07-figma-spec-template.md](./templates/07-figma-spec-template.md)         | Figma 规格 + 几何表 + preset 映射模板 |
| [templates/notification-log-template.md](./templates/notification-log-template.md)   | Lark / webhook 已发送通知记录模板 |
