<!-- template-version: 3 -->
<!-- template-effective-since: 2026-07-24 -->

# 新需求文档 Checklist

复制本清单到 `apps/web/docs_tdd/<PROJECT-ID>/README.md` 或任务文档中使用。

> **模板演进是前向的，不回填存量项目**：`common/`/`templates/` 的模板会随迭代新增章节/关卡（如 `03-api-contract §7 文案契约表`、context-summary 新鲜度自检）。既有项目文档是复制时点的快照，**不强制回填**——回填会制造无收益的 churn。判据:新增关卡只对「本次迭代起新建或正在改的项目」硬性生效;存量项目改到相关模块时顺手对齐即可,未触及不追。若恢复一个旧项目发现其文档缺当前模板的章节,那是时点差异非缺陷,按需补,勿视作 gate 失败。新模板关卡若属硬闸,应同时在 `common/CHANGELOG.md` 记明生效边界（哪些项目受约束）。

## G0 资料接收

- [ ] PRD 已放入 `inbox/`
- [ ] 已按 [lark-doc-sync.md §8](../common/lark-doc-sync.md) 完成 `prd-intake --init`、富媒体读取与 unresolved 处理
- [ ] Agent 已自动创建 `product/00-feature-inventory.md`（从 [feature-inventory-template.md](./feature-inventory-template.md) 复制）
- [ ] Agent 已按 [prd-feature-inventory.md §3](../common/prd-feature-inventory.md) 读取验收标准并填写清单初稿（G0）
- [ ] Figma 链接 / node id 已登记
- [ ] API 文档或样例已登记
- [ ] QA 用例来源已登记或标记待补
- [ ] 现有代码复用候选已初查
- [ ] 现有组件、hooks、services、stores、utils、相近业务功能已盘点，并在技术方案中记录复用 / 封装 / 新建判断
- [ ] 已读取 `common/rule-router.md`，并只按当前场景读取命中的公共规则专题（不要全量读取 `common/`）
- [ ] 已对照最近成熟项目的 `engineering/development-rules.md` 做规则继承检查
- [ ] 旧项目可复用规则已提炼进 `common/`，或确认无新增公共规则
- [ ] 已完成薄包装检查：项目文档只写项目差异，没有复制公共规则全文
- [ ] 若启用脚本能力，项目脚本只调用 `common/` 公共脚本，不复制完整实现

## G1-G2 文档确认

- [ ] `00-feature-inventory.md` G2 已定稿：每条「做/不做/延期」+ G2 确认人 & 日期（**未定稿禁止写业务代码**）
- [ ] 每个 requirement sourceId 已追踪到 Feature + Task；decorative 项有判断依据；已运行 `prd-intake.mjs <PROJECT-ID> --approve`
- [ ] G2 已运行 `node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs <PROJECT-ID> G2`，机器可判定项通过或阻塞项已登记
- [ ] `01-scope-and-phases.md`
- [ ] `02-technical-design.md`
- [ ] `02-technical-design.md` 已填写复用盘点表；每项新增能力都有“直接复用 / 轻量封装 / 抽公共能力 / 新建实现”判断，新建项已写不复用原因
- [ ] `02-technical-design.md` 已填写单一事实源所有权表；共享事实有唯一写入口，必要副本已记录同步/失效、陈旧窗口、owner、恢复与验证证据
- [ ] `03-api-contract.md`
- [ ] `03-api-contract.md` 已明确 Mock 路线为 MSW 路线 B，并列出 `6.1` 清单（handler / schema / dev-only / 切真实）
- [ ] `04-frontend-tasks.md`
- [ ] `05-ui-and-interaction.md`
- [ ] `06-collaboration.md`
- [ ] `07-figma-spec.md`（从 [07-figma-spec-template.md](../templates/07-figma-spec-template.md) 复制；含 G1 Checklist、§3 几何表、§4 Figma→preset 映射）
- [ ] G1 已按 [figma-mcp-read-workflow.md](../common/figma-mcp-read-workflow.md) **原子节点**读取 Figma（含 cornerRadius）
- [ ] 样式映射遵循 [ui-style-token-rules.md](../common/ui-style-token-rules.md) §1：**先 preset 已有 class → 平替 → 最相近**；未改 `packages/config/tailwind-preset.js`
- [ ] `engineering/development-rules.md`
- [ ] `agent/README.md`
- [ ] 已记录是否启用 Lark 主动发群消息；未启用时写明本期人工同步，启用时配置 `agent/lark-integration.md`、发送脚本或复用方式
- [ ] 若启用 Lark 主动发群消息，`agent/scripts/notify-lark.mjs` 是调用 `common/engine/agent-scripts/notify-lark.mjs` 的薄包装
- [ ] 已记录是否启用群内 @ 应用自动生成 task；未启用时写明本期人工整理任务，启用时配置事件订阅、Bot Gateway、白名单和任务队列说明
- [ ] 若启用 Lark 能力，已建立通知记录位置，并说明接收任务、执行、自测、回群通知和记录策略

## G4-G6 实现与自测

- [ ] 已按 `common/coding-worktree.md` 准备编码 worktree：分支 `feature/<PROJECT-ID>`，目录与主仓同级且名为 `<PROJECT-ID>`
- [ ] worktree 内 `apps/web/docs_tdd` 已软链接回主仓 `apps/web/docs_tdd`
- [ ] worktree 依赖已安装，`apps/web` dev server 可启动
- [ ] 基础页面和项目目标路由已验证非 404 / 非白屏；若目标路由依赖登录或配置，阻塞项已写入 `product/06-collaboration.md`
- [ ] **代码 Review 逐项过 [quality-checklist.md §5](../common/quality-checklist.md)**（300 行/活注释/mapper 同名/字段对账/mock 零残留拆除/复用/no-any/Zustand/薄路由 等代码级硬项，单一权威源，此处不重复）
- [ ] 已运行 `verify-code-rules.mjs --project <PROJECT-ID>`；静态代码扫描只检查新增或已修改文件，findings 已修或登记豁免
- [ ] G6 已跑 `/code-review` skill 审本次 diff，findings 已修或登记原因
- [ ] G6 已运行 `node apps/web/docs_tdd/common/engine/agent-scripts/run-project-gate.mjs <PROJECT-ID> G6 --write`，结果已写入 `agent/gate-results.json` 和 `evidence/gate/`；若跳过代码规则，已带 `--skip-code-rules-reason` 并记录原因
- [ ] **桌面首屏、390px H5、dark/light、主题默认、核心 CTA/表单/弹窗、空态/错误态/loading 逐项过 [quality-checklist.md §3.2](../common/quality-checklist.md)**（含 L2 走查清单标准，见 [component-reuse-and-visual-fidelity.md §3.0](../common/component-reuse-and-visual-fidelity.md)；单一权威源，此处不重复）
- [ ] 若提供 QA 用例，已先比对 PRD / Figma / API 差异；若未提供，已记录 G7 跳过且不阻塞交付
