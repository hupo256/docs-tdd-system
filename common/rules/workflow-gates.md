# G0-G8 开发门禁流程

> **v1 maintain-only**：本流程只服务 `workflowVersion: 1` 存量项目和显式 `--legacy` 项目。v2 不运行 G0–G8，正式出口见 [../vnext/README.md](../vnext/README.md)。

| 门禁 | 阶段 | AI 动作 | 人工动作 | 通知建议 |
|------|------|---------|----------|----------|
| G0 | 资料接收 | 盘点 PRD 正文/图片/表格/嵌入对象并建 source manifest；产出功能清单初稿 | 补资料 / 确认范围 | 开始 / 阻塞 |
| G1 | 文档生成 | 生成/更新 `product/01-07`、`engineering`、`agent`；**定稿功能清单**；Figma 按 [figma-mcp-read-workflow.md](./figma-mcp-read-workflow.md) **原子节点**落盘（含 **cornerRadius**） | 评审文档结构与假设 | 文档完成 |
| G2 | 方案确认 | 输出差异/待确认/任务清单；确认每条「做/不做/延期」，并把本期 PRD bullet 拆成稳定原子需求 ID 与一对一 Task | 确认或调整 | 待确认 |
| G3 | API/Mock 准备 | 明确接口/schema/mapper/Mock 场景；新功能默认 MSW handler + 契约测试；API 未 ready 时必须补 `03-api-contract.md` 的 MSW 清单 / worker / 切真实前置 | 提供 API 或确认复用旧接口 | 完成 / 阻塞 |
| G4 | 开发实现 | 先确认 `02-technical-design.md` 复用盘点及单一事实源所有权表完成（见 [architecture-and-state.md](./architecture-and-state.md) §4.0），按 [coding-worktree.md](./coding-worktree.md) 备 worktree，再按文档实现 | 确认可进入编码 | 开始 / 完成 |
| G5 | API 联调 | 接真实接口、处理异常、更新文档；**逐页字段对账**（见 [architecture-and-state.md](./architecture-and-state.md) §8.1）：删 mock 臆造、契约无来源字段 | 提供环境 / 测试数据 | 进行中 / 阻塞 |
| G6 | 自动验收 | **实跑 biome/tsc/vitest**；`acceptance-results.json` 按原子需求覆盖全部所需证据类型；`code-review.json` findings 清零；需要浏览器才能证明的交互真实执行，纯视觉/手感按人工清单 | 评审自测证据 | 完成 / 阻塞 |
| G7 | 提测准备 | 有 QA 用例则先比对 QA↔PRD 差异，并完成开发侧可执行的预回归；未提供则记跳过，不阻塞。此阶段不表示 AQ 已在 test 验收 | 确认差异处理 | 跳过 / 待确认 / 完成 |
| G8 | test 提测交付 | 实跑 production-mode build（只验证发布构建，不代表生产上线）；工作树干净；`delivery-status.json` 记录 mode/branch/headSha/evidence，至少确认功能/修复分支已 pushed；生成机器提测摘要 | 接受或返工并触发 test 流水线 | 提测摘要 |

### G8 之后的环境发布链

G8 是开发流程终点、测试流程起点：G8 PASS → 功能/修复分支合入 `test` 由 AQ 测试 → AQ 通过后同一分支合入 `pre` 由 PM 验证 → PM 通过后同一分支合入 `online`。各环境都直接接收功能/修复分支，禁止环境分支链式或反向合并（详见 [git-branch-flow.md](./git-branch-flow.md)）。`delivery-status.mode` 仅描述 Git 交付状态；G8 使用 `pushed` 即可，`merged` / `released` 只兼容事后复核。

## 执行规则

- G2 功能清单未定稿前不写业务代码（自动流程见 [prd-feature-inventory.md](./prd-feature-inventory.md) §3）。
- 新项目 G2 必须通过 PRD intake：读取判定消费 [lark-doc-sync.md §8](./lark-doc-sync.md)，Feature/Task 追踪消费 [prd-feature-inventory.md §3](./prd-feature-inventory.md)；gate 未过即阻断。
- G2/G5/G6/G7/G8 进下一阶段前必须依次跑 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 项目 gate；机器可判定项未过不得用口头代替。`docs-tdd gate` 默认持久化 `agent/gate-results.json`、`agent/gate-history.json` 与 `evidence/gate/**`；G6 必须存在 G5 PASS 历史，G7 必须存在 G6 PASS 历史，G8 必须存在 G7 PASS 历史，禁止跳级或用当前 G8 结果自证 G8。
- G5 与 G7 的业务结论写入 `agent/stage-status.json`：G5 仅允许 `completed` / `not-applicable` 通过，`blocked` 不得进入 G6；G7 仅允许 `completed` / `skipped` 通过，跳过必须明确记录“未提供提测用例”等具体原因。G7 的 completed 只证明提测用例已预检、开发侧可执行项已回归，不得写成“AQ/test 已通过”。前端已完成、仅待后端真实字段对账时，可记 `frontend-complete-pending-reconcile`（报告态：须有前端 evidence 与待对账原因，由 `VERIFY-G5-004` 校验）——它比 `blocked` 更准确地表达“前端已交付”，会在 PROJECTS.md / 交付摘要显示为“前端完成待对账”，但**同样不放行 G6**（字段对账完成后改回 `completed` 才进 G6）。该停靠态的出口是 `docs-tdd gate <PR> G6 --partial`：静态规则与 biome/tsc/vitest/code-review 照跑照判，只有 `contract`/`browser` 验收项记待对账，结论以 **`G6-partial`** 入历史——它不是 G6 PASS，不满足 G7 前置、不推进 README 阶段，真实字段到位后须重跑完整 G6。
- gate 通过后先追加不可覆盖的成功历史，再由 `set-project-stage.mjs` 校验该历史并同步阶段真值四面：README 状态表机器行「最新通过门禁」、README frontmatter `stage`、机器版 `agent/context-summary.md`、`PROJECTS.md`。机器行只由脚本写入，人工叙述写「当前阶段」行；禁止绕过 gate 手工推进，`set-project-stage.mjs --force` 只允许回退。单面漂移由 DOC-SYNC-001/002/003 拦截，active 项目阶段链缺失或证据丢失由 DOC-SYNC-004 拦截。
- G4 前 `02-technical-design.md` 必须有复用盘点结论：已检查的现有组件/hooks/services/stores/utils、**跨业务 `apps/**` 的 Modal/分享/渠道 UI**；每个新增能力标「直接复用/轻量封装/抽公共能力/新建」，新建须写原因。**项目文档不得出现「跳过复用」等与 `common/` 冲突表述。**
- G4 前按 [architecture-and-state.md](./architecture-and-state.md) §4.0 完成单一事实源所有权表：每项共享事实明确权威来源、唯一写入口和消费者；存在缓存/镜像/读模型等副本时写明同步或失效机制、陈旧窗口、owner、恢复方式和验证证据。模板 v2 起由 `DOC-G4-004/005` 检查；旧项目未触及相关模块不回填。
- G4 前必须创建/确认编码 worktree；业务代码、依赖安装、dev server、自测都在 `feature/<PROJECT-ID>` 同级 worktree，不在主仓改业务代码。worktree ready = 依赖装完 + 基础页可访问（非 404/白屏）。
- G0 必须从 PRD（含验收标准）抽功能清单；Figma 未覆盖的跨页功能不得默认「不做」。
- 新需求启动时 Agent **自动** `feature-inventory-template.md` → `product/00-feature-inventory.md`，无需手动复制。
- 遇 PRD/Figma/API/QA 冲突不越门禁，先写 `product/06-collaboration.md`。
- G5 出口含字段对账：每个列表/表单/详情页的 type/column/搜索项字段在契约里有唯一来源，mock 臆造字段已删/合并；结果写 `03-api-contract.md` 或 `12-*-api-integration.md`。未对账不得进 G6。**MSW 路线 B：删/停 handler 即切真实接口，保留 schema/mapper/契约测试；遗留路线 A 才同步按 [mock-legacy-route-a.md](./mock-legacy-route-a.md) §8.0.3 零残留拆 mock：`grep @mock-only` 归零、`USE_MOCK` 已删。删业务代码时顺带 grep 同名 `describe`/import 清孤儿测试；fixture 对账测试若接口已变，更新 fixture 不删测试（生命周期见 [verification-division-of-labor.md](./verification-division-of-labor.md) §6）。**
- **G6 必须跑 `/code-review` skill 审本次 diff**（correctness + reuse/simplification/efficiency），结果写 `agent/code-review.json`；每个本期原子需求及其所需证据类型写 `agent/acceptance-results.json`。findings 或验收阻塞不得进入 G8；`06-collaboration.md` 只保留讨论背景，不再承担机器真值。
- **“可提测”只等于当前状态完整 G8 PASS**：G6 只证明开发自测通过，G7 只证明提测准备完成；还必须完成 G8 的发布构建、干净工作树、远端功能/修复分支与交付摘要校验。`G6-partial`、旧 HEAD 的历史 PASS、仅 commit/Feature 级证据均不得表述为“可提测”。
- G6 静态规则跑 `verify-code-rules.mjs --project <PROJECT-ID>`，只 review 新增/已改文件；不用全仓历史阻断本次，也不跳过本次 diff 新增问题。
- **G6 规则按维度顺序加载，不一次展开整包**：依 code_review → contract → visual → delivery，逐维度 `docs-tdd context <PROJECT-ID> g6_<dimension>`（`g6_code_review`/`g6_contract`/`g6_visual`/`g6_delivery`），每个子包单独预算。`g6_verify` 是协调器，只打印四维进度/命令，不生成合并包。机器会把四维完成状态绑定 client/session、HEAD、dirty hash、L3/effective 指纹与 24 小时有效期；乱序加载会阻断，任一维缺失/过期/绑定变化时 `VERIFY-RULE-005` 阻断完整或 partial G6，必须从 `g6_code_review` 重新加载。
- **G6/G7/G8 由 `docs-tdd gate` 自动调用 `verify-build-quality.mjs` 实跑 biome/tsc/vitest**（契约见 [rule-ids-and-gates.md §3.5](./rule-ids-and-gates.md)）：结论来自真实退出码，不接受「证据文档写了 Biome」这类自述；归因只看本次改动文件，存量债不阻断。跳过必须 `--skip-build-quality-reason`，无理由跳过由 `VERIFY-BUILD-001` 判 error。G5 及之前不强制，避免联调期天天红。
- 阶段通知只发结论摘要，不发长日志/密钥/账号/Cookie/内网 URL。
- 「API 已存在待更新 + UI/UX 低保真 + Figma/API 文档后补」的常态项目，按 [fast-track-incomplete-docs.md](./fast-track-incomplete-docs.md) 编排 G0→G4 快速通道，`agent/fast-track.json` 结构化记录出口与临时业务契约。判定按语义确定性、可逆性和影响面，不按“涉及权限/金额/状态机”一刀切：接口 100% 已存在（`reuse-api`）则 G5 当场对账、正常推进到 G8；存在未就绪接口（`pending-api`）才停靠 G5 `frontend-complete-pending-reconcile` 待对账。本表只定义各 gate 准入准出，不复制该通道正文。
- **阻塞/变更登记为机器可读单一源 `agent/blockers.json`**（协议见 [blocking-and-change-protocol.md](./blocking-and-change-protocol.md)）：`open` 的项到达其 `blocksGate` 即由 `DOC-BLOCK-002` 阻断本 gate，当场解除或按 [rule-ids-and-gates.md §4](./rule-ids-and-gates.md) 登记有期限豁免；G8 交付摘要第 4/5 段从它派生。散文（`06-collaboration.md`）只作补充线索。
- Lark 主动发群 + 群内 @ 自动建 task 均为 nice to have；不配置也能完成开发。新需求 G0/G1 让决策者确认是否启用、何时启用并写入项目文档；启用时再配 Lark/webhook、事件订阅、Bot Gateway、白名单、队列与 Worker 边界。只启用主动发群用 `agent/scripts/notify-lark.mjs`；需响应群内 @ 须接完整 Lark 链路。实际发送后记入通知记录，dry-run 不算已通知。
