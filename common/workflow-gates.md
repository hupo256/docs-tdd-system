# G0-G8 开发门禁流程

> AI 主用。门禁防止 AI 从 PRD 直接跳到不受控编码。

| 门禁 | 阶段 | AI 动作 | 人工动作 | 通知建议 |
|------|------|---------|----------|----------|
| G0 | 资料接收 | 盘点 PRD 正文/图片/表格/嵌入对象并建 source manifest；产出功能清单初稿 | 补资料 / 确认范围 | 开始 / 阻塞 |
| G1 | 文档生成 | 生成/更新 `product/01-07`、`engineering`、`agent`；**定稿功能清单**；Figma 按 [figma-mcp-read-workflow.md](./figma-mcp-read-workflow.md) **原子节点**落盘（含 **cornerRadius**） | 评审文档结构与假设 | 文档完成 |
| G2 | 方案确认 | 输出差异/待确认/任务清单；**确认清单每条「做/不做/延期」** | 确认或调整 | 待确认 |
| G3 | API/Mock 准备 | 明确接口/schema/mapper/Mock 场景；新功能默认 MSW handler + 契约测试；API 未 ready 时必须补 `03-api-contract.md` 的 MSW 清单 / worker / 切真实前置 | 提供 API 或确认复用旧接口 | 完成 / 阻塞 |
| G4 | 开发实现 | 先确认 `02-technical-design.md` 复用盘点及单一事实源所有权表完成（见 [architecture-and-state.md](./architecture-and-state.md) §4.0），按 [coding-worktree.md](./coding-worktree.md) 备 worktree，再按文档实现 | 确认可进入编码 | 开始 / 完成 |
| G5 | API 联调 | 接真实接口、处理异常、更新文档；**逐页字段对账**（见 [architecture-and-state.md](./architecture-and-state.md) §8.1）：删 mock 臆造、契约无来源字段 | 提供环境 / 测试数据 | 进行中 / 阻塞 |
| G6 | 自动验收 | **实跑 biome/tsc/vitest**（[rule-ids-and-gates.md §3.5](./rule-ids-and-gates.md) 机器事实层）+ Browser/Playwright；**跑 `/code-review` skill 审本次 diff**（复用/简化/正确性），findings 清零或登记；重要 UI（Hero/卡片/弹窗/浮层）Figma 并排 L2 走查清单全 pass | 评审自测证据 | 完成 / 阻塞 |
| G7 | 用例回归 | 有 QA 用例则先比对 QA↔PRD 差异再跑并修；未提供则记跳过，不阻塞 | 确认差异处理 | 跳过 / 待确认 / 完成 |
| G8 | 交付 | 汇总文件/命令/风险/残留项；第 1/2/3 段由 `render-delivery-summary.mjs` 从证据自动生成（见 [quality-checklist.md §6](./quality-checklist.md)） | 接受或返工 | 交付摘要 |

## 执行规则

- G2 功能清单未定稿前不写业务代码（自动流程见 [prd-feature-inventory.md](./prd-feature-inventory.md) §3）。
- 新项目 G2 必须通过 PRD intake：读取判定消费 [lark-doc-sync.md §8](./lark-doc-sync.md)，Feature/Task 追踪消费 [prd-feature-inventory.md §3](./prd-feature-inventory.md)；gate 未过即阻断。
- G2/G5/G6/G7/G8 进下一阶段前必须依次跑 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 项目 gate；机器可判定项未过不得用口头代替。`docs-tdd gate` 默认持久化 `agent/gate-results.json`、`agent/gate-history.json` 与 `evidence/gate/**`；G6 必须存在 G5 PASS 历史，G7 必须存在 G6 PASS 历史，G8 必须存在 G7 PASS 历史，禁止跳级或用当前 G8 结果自证 G8。
- G5 与 G7 的业务结论写入 `agent/stage-status.json`：G5 仅允许 `completed` / `not-applicable` 通过，`blocked` 不得进入 G6；G7 仅允许 `completed` / `skipped` 通过，跳过必须明确记录“未提供 QA 用例”等具体原因。
- gate 通过后先追加不可覆盖的成功历史，再由 `set-project-stage.mjs` 校验该历史并同步阶段真值四面：README 状态表机器行「最新通过门禁」、README frontmatter `stage`、机器版 `agent/context-summary.md`、`PROJECTS.md`。机器行只由脚本写入，人工叙述写「当前阶段」行；禁止绕过 gate 手工推进，`set-project-stage.mjs --force` 只允许回退。单面漂移由 DOC-SYNC-001/002/003 拦截，active 项目阶段链缺失或证据丢失由 DOC-SYNC-004 拦截。
- G4 前 `02-technical-design.md` 必须有复用盘点结论：已检查的现有组件/hooks/services/stores/utils、**跨业务 `apps/**` 的 Modal/分享/渠道 UI**；每个新增能力标「直接复用/轻量封装/抽公共能力/新建」，新建须写原因。**项目文档不得出现「跳过复用」等与 `common/` 冲突表述。**
- G4 前按 [architecture-and-state.md](./architecture-and-state.md) §4.0 完成单一事实源所有权表：每项共享事实明确权威来源、唯一写入口和消费者；存在缓存/镜像/读模型等副本时写明同步或失效机制、陈旧窗口、owner、恢复方式和验证证据。模板 v2 起由 `DOC-G4-004/005` 检查；旧项目未触及相关模块不回填。
- G4 前必须创建/确认编码 worktree；业务代码、依赖安装、dev server、自测都在 `feature/<PROJECT-ID>` 同级 worktree，不在主仓改业务代码。worktree ready = 依赖装完 + 基础页可访问（非 404/白屏）。
- G0 必须从 PRD（含验收标准）抽功能清单；Figma 未覆盖的跨页功能不得默认「不做」。
- 新需求启动时 Agent **自动** `feature-inventory-template.md` → `product/00-feature-inventory.md`，无需手动复制。
- 遇 PRD/Figma/API/QA 冲突不越门禁，先写 `product/06-collaboration.md`。
- G5 出口含字段对账：每个列表/表单/详情页的 type/column/搜索项字段在契约里有唯一来源，mock 臆造字段已删/合并；结果写 `03-api-contract.md` 或 `12-*-api-integration.md`。未对账不得进 G6。**MSW 路线 B：删/停 handler 即切真实接口，保留 schema/mapper/契约测试；遗留路线 A 才同步按 [mock-legacy-route-a.md](./mock-legacy-route-a.md) §8.0.3 零残留拆 mock：`grep @mock-only` 归零、`USE_MOCK` 已删。删业务代码时顺带 grep 同名 `describe`/import 清孤儿测试；fixture 对账测试若接口已变，更新 fixture 不删测试（生命周期见 [verification-division-of-labor.md](./verification-division-of-labor.md) §6）。**
- **G6 必须跑 `/code-review` skill 审本次 diff**（correctness + reuse/simplification/efficiency）。Review 同时按所有权表检查重复事实源、派生状态双写和无同步契约的副本；findings 当场修或在 `06-collaboration.md` 登记。未跑或有未处理 findings 不得进 G8。judgment 级质量（复用/命名/过度抽象/mapper 臆造字段）靠它兜底，机械项由 Biome/typecheck 负责。
- G6 静态规则跑 `verify-code-rules.mjs --project <PROJECT-ID>`，只 review 新增/已改文件；不用全仓历史阻断本次，也不跳过本次 diff 新增问题。
- **G6/G7/G8 由 `docs-tdd gate` 自动调用 `verify-build-quality.mjs` 实跑 biome/tsc/vitest**（契约见 [rule-ids-and-gates.md §3.5](./rule-ids-and-gates.md)）：结论来自真实退出码，不接受「证据文档写了 Biome」这类自述；归因只看本次改动文件，存量债不阻断。跳过必须 `--skip-build-quality-reason`，无理由跳过由 `VERIFY-BUILD-001` 判 error。G5 及之前不强制，避免联调期天天红。
- 阶段通知只发结论摘要，不发长日志/密钥/账号/Cookie/内网 URL。
- **阻塞/变更登记为机器可读单一源 `agent/blockers.json`**（协议见 [blocking-and-change-protocol.md](./blocking-and-change-protocol.md)）：`open` 的项到达其 `blocksGate` 即由 `DOC-BLOCK-002` 阻断本 gate，当场解除或按 [rule-ids-and-gates.md §4](./rule-ids-and-gates.md) 登记有期限豁免；G8 交付摘要第 4/5 段从它派生。散文（`06-collaboration.md`）只作补充线索。
- Lark 主动发群 + 群内 @ 自动建 task 均为 nice to have；不配置也能完成开发。新需求 G0/G1 让决策者确认是否启用、何时启用并写入项目文档；启用时再配 Lark/webhook、事件订阅、Bot Gateway、白名单、队列与 Worker 边界。只启用主动发群用 `agent/scripts/notify-lark.mjs`；需响应群内 @ 须接完整 Lark 链路。实际发送后记入通知记录，dry-run 不算已通知。
