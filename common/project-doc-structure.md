# 项目文档目录规范

> AI 主用:每个需求在 `apps/web/docs_tdd/<PROJECT-ID>/` 下独立维护,避免不同项目 PRD/Figma/API/任务互相污染。

## 变量约定

- `<PROJECT-ID>`:项目编号目录,大写字母+五位数字,如 `PR-01234`。
- `<feature-domain>`:代码业务域名,仅用于源码路径,如 `apps/web/src/apps/<feature-domain>/`、`services/api/<feature-domain>/`。
- 公共规则正文不得写入具体项目目录;具体 `PR-xxxxx` 只允许出现在项目索引、历史来源、复盘案例或项目自己的文档。

## 推荐结构

```text
PROJECTS.md                    # 顶层项目状态索引，由 update-project-index.mjs 生成
<PROJECT-ID>/
  README.md
  inbox/
    lark-sync/                # Lark 只读同步落地（见 lark-doc-sync.md）
    figma/                    # 原始 Figma MCP 导出（可选）
  product/
    00-feature-inventory.md   # 可选编号 00；G0 初稿、G2 定稿（见 common/prd-feature-inventory.md）
    01-scope-and-phases.md
    02-technical-design.md
    03-api-contract.md        # G1 从 templates/03-api-contract-template.md 复制；含字段对账表
    04-frontend-tasks.md
    05-ui-and-interaction.md
    06-collaboration.md
    07-figma-spec.md          # G1 从 templates/07-figma-spec-template.md 复制；几何表 + preset 映射
  engineering/
    development-rules.md
  evidence/
    ui-ux/                  # Browser / Playwright 自测**文字报告**、结果 JSON（默认不放自测截图）
  agent/
    README.md
    project-manifest.json      # ruleset/template 版本、试点与存量规则策略
    stage-status.json          # G5 联调与 G7 QA 的结构化完成/阻塞/跳过结论
    gate-history.json          # 按时间追加的成功 gate 历史，供阶段前置链校验
    run-state.json             # kickoff/status/resume/next 的断点恢复状态
    prd-source-manifest.json   # PRD 富媒体盘点、素材 hash、Feature/Task 追踪和 G2 fingerprint
    msw-manifest.json          # endpoint、场景、资产和 mock 生命周期真值
    assumptions.json           # 字段/契约假设台账与销账状态
    blockers.json              # 阻塞/变更机器真值，新项目默认空数组
    code-review.json           # G6 findings、处置和 review HEAD
    acceptance-results.json    # Feature → 验收场景 → 方法/结果/evidence
    delivery-status.json       # G8 交付模式 + branch/headSha + 外部证据
    context-summary.md      # AI 恢复项目时优先读的短摘要
    gate-results.json         # 最近一次 gate 结果，不承担成功历史证明
    execution-log.md          # 可选，命令执行摘要
    rule-waivers.json         # 可选，规则豁免记录，必须有 owner / reason / expiresAt
    lark-sources.json         # 登记 PRD 来源（start-new-project.mjs 生成）
    lark-integration.md
    notification-log.md
    scripts/
      sync-lark-docs.mjs      # 薄包装
      notify-lark.mjs         # 仅启用主动通知时
      lark-worker.mjs         # 仅启用群内 @ 自动任务时
```

## 各目录职责

| 目录 | 内容 |
|------|------|
| `README.md` | 项目状态、文档地图、当前基线、待确认项 |
| `inbox/` | PRD 原文、API 样例、QA 用例、Figma MCP 导出、截图等原始输入 |
| `product/` | 产品范围、技术方案、API 契约、任务清单、UI 交互、协作记录、Figma 规格 |
| `engineering/` | 基于公共规则细化到本模块的工程约束;只写项目差异,不复制整份公共规则 |
| `agent/` | Codex/Cursor/Browser/Playwright/Lark 的项目级流程;`context-summary.md` 只放当前阶段、scope 快照、gate 状态、下一步;Lark 能力先记是否启用和启用时间,启用群同步放 `lark-integration.md`+发送脚本+通知记录,启用群内 @ 触发任务时说明事件订阅、Bot Gateway、白名单、任务队列、Worker 边界 |
| `evidence/` | 验收报告归档；字段格式见 [execution-evidence.md](./execution-evidence.md)，视觉判定与截图策略消费对应专题 |

## 命名规则

- 项目目录名必须用项目编号 `PR-01234`;字母大写,不用业务名、kebab-case 或小写 `pr-01234`。
- `inbox/` 原始输入建议 `.md`;可留原始中文名,也可重命名 `prd-<PROJECT-ID>-<简述>-<yyyymmdd>.md`。原始名含中文/特殊字符时在 `README.md` 登记来源和重命名映射,避免脚本引用和 grep 出错。
- 项目文档按编号排序,方便每次从 00/01 读到 07。
- 新增 Figma 规格:G1 复制 `templates/07-figma-spec-template.md` → `product/07-figma-spec.md`;原始 MCP 导出放 `inbox/figma/`。

## 公共规则引用

- 项目 README 必须显式链接 `../common/README.md` 或根 `common/README.md`。
- 项目 `engineering/development-rules.md` 开头必须说明已继承 `common/`,正文只补当前项目特殊约束。
- 项目 `agent/README.md` 只写恢复顺序、启用状态、配置路径、项目差异;不复制公共 Lark/Bot Gateway/G0-G8/质量检查全文。
- 开发中出现可复用规则,先更新 `common/`,再在项目文档引用。
- 新 chat 用「根据 apps/web/docs_tdd 下的文档,开始新的需求...」启动时,先执行 [new-project-kickoff.md](./new-project-kickoff.md),再进入项目文档生成。
- 新项目目录优先由 `common/agent-scripts/start-new-project.mjs` 生成,避免手工漏建 `00-feature-inventory.md`、`lark-sources.json` 或薄包装脚本。
- 一句话启动优先使用 `docs-tdd kickoff <PROJECT-ID> --prd <source>`；中断后用 `docs-tdd status/next/resume`，不要靠对话记忆猜下一步。
- 顶层 `PROJECTS.md` 由 `common/agent-scripts/update-project-index.mjs --write` 生成,只做导航汇总;不要手工维护表格,也不要把它当项目事实源。
- 新需求 G0/G1 必须记录 Lark 主动发群、群内 @ 应用自动建 task 是否启用;两项 nice to have,不配也能开发。
- 决定启用群通知:必须在 `agent/` 建 Lark/webhook 配置说明和通知记录;可复制 `templates/notification-log-template.md`。
- 决定启用群通知:`agent/scripts/notify-lark.mjs` 只能是调用 `common/agent-scripts/notify-lark.mjs` 的薄包装,不复制旧项目完整通知脚本。
- 决定启用群内 @ 反馈 bug/QA/自测任务:必须在 `agent/` 建 Lark 应用事件订阅和 Worker 处理规则,继承 `common/collaboration-and-notifications.md`。
- 新项目 G0 前 Agent **必须自动**创建 `product/00-feature-inventory.md`（见 [prd-feature-inventory.md](./prd-feature-inventory.md) §3）,登记 PRD 来源并优先用 Lark CLI 同步到 `inbox/lark-sync/`;G2 定稿前不写业务代码。
- 新项目 G2/G5/G6/G7/G8 前必须按 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 依次跑项目 gate；正式入口写最近结果、追加成功历史和独立证据，代码静态扫描只检查新增/已修改文件。

## 薄包装原则

项目目录是公共规则的**使用记录**,不是副本。

| 文件 | 应写内容 | 不应写内容 |
|------|----------|------------|
| `README.md` | 当前项目状态、文档地图、待确认项 | 整份公共流程、质量规则 |
| `engineering/development-rules.md` | 项目特殊模块边界、风险、例外 | 通用编码规范、通用测试规则全文 |
| `agent/README.md` | 恢复顺序、Lark 启用决策、配置路径 | 完整 Bot Gateway/Lark/G0-G8 规则 |
| `agent/context-summary.md` | 当前阶段、scope 快照、gate 状态、下一步 | PRD 原文、公共规则全文、历史 evidence 全文 |
| `agent/lark-integration.md` | 当前项目标题、配置文件、命令、发送记录位置 | 签名算法、卡片字段模板、公共安全边界全文 |
| `agent/scripts/notify-lark.mjs` | 调用公共脚本的薄包装 | `createHmac`、`gateMeta`、`createPayload` 等完整通知逻辑 |
| `agent/scripts/lark-worker.mjs` | 调用公共 Worker 的薄包装,只传项目编号/名称/项目文档 | Gateway 轮询、任务领取、Codex prompt、状态回写等完整 Worker 逻辑 |
| `product/00-feature-inventory.md` | 当前 PRD 的功能事实、验收映射、G2 结论 | 公共清单生成规则全文 |

发现项目文件复制了公共规则:先把规则补回 `common/` 或 `templates/`,再把项目文件改为引用+差异说明。
