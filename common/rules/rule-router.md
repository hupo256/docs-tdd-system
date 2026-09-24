<!-- RESIDENT-DOC: 唯一常驻规则；预算和覆盖校验见 check-doc-budget.mjs -->
# docs_tdd 启动路由

> 开工只读本文件并按场景加载；禁止全读 `common/`。机器路由见 [rule-index.json](./rule-index.json)，人工索引见 [README.md](../README.md)。

## 1. 启动协议

0. **新需求路由（2026-09-08 起）**：默认 `workflowVersion: 2`，入口为 `docs-tdd run <ID> --prd <source>`。CLI 初始化/恢复状态并推进确定性动作；语义执行或人工裁决分别返回 `needs-agent` / `needs-user`，action packet 不代表完成。`extract` 通过 intake audit 后最多做两轮独立 review；未决 finding 须在 evidence 前人工裁决。`evidence` + `verify` 是唯一正式出口，仅 enforced PASS 且 `autonomous/cli-attested` 可交付。v1 项目继续走 G0–G8，仅显式 `--legacy` 新建。完整协议见 [../vnext/README.md](../vnext/README.md)。
1. 先读取 README `workflowVersion`。v2 恢复时读 `work-item.json` 与 `latest-result.json`（若存在）；v1 恢复时读 `agent/context-summary.md`。
2. 执行 `docs-tdd context <PROJECT-ID> <SCENARIO>`：v2 返回最小 work-item context；v1 返回场景规则包并在编码场景签发 rule session。禁止自行全读规则。
3. v2 编辑后执行 `docs-tdd evidence <PROJECT-ID> --out <evidence.json>`（命令计划取自 work-item），再用 `docs-tdd verify <PROJECT-ID> --evidence <evidence.json> --surfaces <surfaces.json>` 一步组装并写入正式出口（workItem/sourceDocuments 自动从 work-item 组装，只需 agent 提供 `discoveredSurfaces`+`coveredSurfaceIds` 落点报告）；兼容旧路仍可用 `--input <verify-input.json>`。v1 编辑后执行 `changed`，阶段交付执行 `gate`。CLI 会拒绝混用。
4. 适配、冲突和发布状态用 `docs-tdd doctor <PROJECT-ID>`，能力摘要用 `docs-tdd capability <PROJECT-ID>`；规则上下文产出/预算探针用 `docs-tdd probe <PROJECT-ID> --client codex|claude|pi`（它不替代真实宿主的可见性抽查）。

规则落实以 [rule-execution-model.md](./rule-execution-model.md) 的执行契约判断；“已读/已注意”不算证据。

规则分层：通用编码手艺走 Codex/Claude 全局规则和 skill；FameEX 编码锚点走 `.cursor/rules/*.mdc`；`docs_tdd` 只承载项目流程、门禁、Mock 策略、证据和豁免。

个人规则只写用户目录或本地排除的 `docs_tdd`；根 `AGENTS.md`、`.cursor/rules`、hook、package/CI 默认只读，提升为团队规范须用户明确批准。

## 2. 常驻硬规则

- 新需求先路由等级:V0/V1 无门禁链，只留单一出口与最小证据矩阵;V2 保留完整矩阵与人签。**风险只升不降**,未知风险信号保守按 V2 处理，不许静默降档(路由约束见 [../vnext/README.md](../vnext/README.md))。
- 先明确范围后写代码：v2 先完成原子需求、独立覆盖审查与风险路由，V2 还必须有人签 scope approval；v1 仍以 G2 定稿为编码前置。
- 编码必须在 `feature/<PROJECT-ID>` worktree；v1 于 G4 准备，v2 于范围审查完成后准备。基线来自 `origin/online`；Git 只正向合环境分支。
- Mock：v2 按 `apiDependency` 条件化（仅 `mock-required` 要求 MSW）；v1 新功能默认 MSW + 契约测试。service/hook/mapper/组件不写 mock 分支。
- DTO 先过 schema/mapper；单一来源 mapper 字段默认与 API 同名，仅跨来源统一或多字段派生允许改名并登记结构化理由。
- PRD 含图片、表格或嵌入对象时必须真实读取：v2 表格逐数据行归一化，抽取先过确定性 intake audit 再进入有界 coverage review；v1 走 `prd_intake` 且 G2 前追踪到 Feature/Task。无法读取即阻断。
- 共享数据、状态、规则和配置只设一个权威写入口；编码前登记所有权，必要副本必须登记同步/失效、owner 和验证证据。
- 新建前查复用；改动限责任模块，越界先记录并重点 review。
- 固定文案逐字遵循 PRD/Figma 契约，apps/web 开发期只改 zh-CN。
- PRD 验收下沉到原子 requirement：v2 requirement 直接绑定 source/surface/evidence；v1 维持 requirement ID ↔ 单一 Task。一个 PASS 不得覆盖多个可独立失败的子点。
- v2 的 coverage findings 必须处置且正式 verify 通过；v1 G6 必须 code review。质量检查在一批相关改动稳定后集中执行，范围限 touched files 与直接相关测试；小步编辑期间不重复跑完整 Biome/typecheck/test。
- v1 新功能 MSW 继续按 manifest 强制验证；v2 只有 `apiDependency.mode=mock-required` 时要求 handler/worker/contract 覆盖，其他模式禁止无必要新增 mock。
- v2 以 safe work context 绑定消费仓、环境分支、worktree 和允许路径；source graph 漂移、越界写入或冻结路径不一致必须 fail-closed。
- 失败域仅允许 `source`、`review`、`code`、`browser`、`environment`、`external-dependency` 六类有界修复；同一失败指纹不重试，预算耗尽进入终态并给唯一恢复命令。

## 3. 场景

常用场景名：

`new_project` · `prd_intake` · `g0_g2_scope` · `g4_coding_worktree` · `write_api` · `write_mapper` · `write_query_hook` · `write_state` · `write_msw` · `legacy_mock` · `write_ui` · `write_figma` · `g6_verify` · `collaboration` · `review_docs_automation` · `docs_tdd_maintenance`

无法精确匹配时选最接近场景，从 pack 的 2-4 个专题开始；遗留 Mock 仅 `legacy_mock` 加载路线 A。维护时查 README，不把专题正文写回本文件。

不确定场景时可运行 `docs-tdd recommend <PROJECT-ID>`；结果只作候选，Agent 仍须按任务目标确认场景。

请求驱动的 UI 必须使用 `write_ui`（已包含分层/API 专题）；单独编写或调整 React Query Hook 使用 `write_query_hook`；读取或还原 Figma 使用 `write_figma`，不得只加载视觉或状态专题。

G6 验收按维度顺序加载 `g6_code_review`→`g6_contract`→`g6_visual`→`g6_delivery`；`g6_verify` 只打印进度与下一步，不再生成合并包。四维度绑定当前 client/session、代码 HEAD/dirty hash 和规则指纹，缺失或过期时 G6 门禁阻断。

## 4. 上下文与预算

- 主线程只保留决策、风险和结果；大文件先 `rg` 定位再读局部，长命令只回传失败行。
- context pack 是带 L3/effective fingerprint 的 `/tmp` 可丢弃缓存；规则真值仍是各层权威源。
- v2 实现上下文：V0/V1 4K 硬上限；V2 8K 目标、24K 硬上限，超过目标且不超过硬上限时以 `large-context` warning 继续，超过硬上限才拆 `deliveryScope`；禁止静默截断需求。
- 只有传入真实 `--session-id`（或客户端提供对应 session 环境变量）才在同一 project/client/session 内返回 delta；不带会话身份时每次完整报告，禁止跨任务猜测“已经读过”。
- Gate 完成、场景切换、PRD/契约 fingerprint 变化或处理大量日志/图片后，更新 `context-summary.md`；新任务只恢复 Router、摘要和当前 compact pack。
- 修改规则后依次运行 `docs-tdd check`、`rule-release.mjs --write`、`effective-rules.mjs --write`；任一发布漂移会阻断 context/changed/gate，但不阻断 check/capability/doctor。
- 规则维护优先使用 `docs-tdd release <PROJECT-ID> --scenario <SCENARIO>` 原子发布两层 manifest、doctor、golden 和 context smoke；任一步失败自动恢复旧 manifest。
- L3 常驻文件仅本文件且 ≤5000 字符；L1 `~/.ai-rules/AGENT.md` ≤7000 字符，跨层基础常驻面（L1 + L3 + L2 `alwaysApply`）≤16000 字符；专题必须被 `rule-index.json` 至少一个场景引用，并被 README 人工索引收录。
- 新主题只新增/更新场景索引和 on-demand 文件；机器已拦的细则不在常驻层重复。
