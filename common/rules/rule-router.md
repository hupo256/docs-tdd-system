<!-- RESIDENT-DOC: 唯一常驻规则；预算和覆盖校验见 check-doc-budget.mjs -->
# docs_tdd 启动路由

> 开工只读本文件并按场景加载；禁止全读 `common/`。机器路由见 [rule-index.json](./rule-index.json)，人工索引见 [README.md](../README.md)。

## 1. 启动协议

1. 确认项目 ID/阶段；恢复项目先读 `<PROJECT>/agent/context-summary.md`。
2. 执行 `docs-tdd context <PROJECT-ID> <SCENARIO>` 并读取 `/tmp/docs-tdd-context/...md`；默认 compact，歧义或失败调查才用 `--full`，不得自行全读规则。
   编码场景同时生成带 L1/L2/L3 fingerprint 的 `agent/rule-session.json`；G2 未通过、规则冲突或发布过期时不生成会话，也不得写业务代码。
3. 编辑后执行 `docs-tdd changed <PROJECT-ID>`；阶段交付执行 `docs-tdd gate <PROJECT-ID> <Gx>`。缓存仅复用同输入 PASS，需强制实跑时加 `--no-cache`。
4. 无自动 hook 时显式执行 changed/gate；适配、冲突和发布状态用 `docs-tdd doctor <PROJECT-ID>`，能力摘要用 `docs-tdd capability <PROJECT-ID>`。

规则落实以 [rule-execution-model.md](./rule-execution-model.md) 的执行契约判断；“已读/已注意”不算证据。

规则分层：通用编码手艺走 Codex/Claude 全局规则和 skill；FameEX 编码锚点走 `.cursor/rules/*.mdc`；`docs_tdd` 只承载项目流程、门禁、Mock 策略、证据和豁免。

个人规则只写用户目录或本地排除的 `docs_tdd`；根 `AGENTS.md`、`.cursor/rules`、hook、package/CI 默认只读，提升为团队规范须用户明确批准。

## 2. 常驻硬规则

- 先文档后代码；G2 未定稿不写业务代码。
- G4 在 `feature/<PROJECT-ID>` worktree 开发，基线来自 `origin/online`；Git 只正向合环境分支。
- 新功能 Mock 默认 MSW + 契约测试；service/hook/mapper/组件不写 mock 分支；例外先登记 waiver。
- DTO 先过 schema/mapper；单一来源 mapper 字段默认与 API 同名，仅跨来源统一或多字段派生允许改名并登记结构化理由。
- PRD 含图片、表格或嵌入对象时先完成 `prd_intake`；G2 前每项须真实读取、分类并追踪到 Feature/Task，无法读取即阻断。
- 共享数据、状态、规则和配置只设一个权威写入口；G4 技术方案登记所有权，必要副本必须登记同步/失效、owner 和验证证据。
- 新建前查复用；改动限责任模块，越界先记录并重点 review。
- 固定文案逐字遵循 PRD/Figma 契约，apps/web 开发期只改 zh-CN。
- G6 必须 code review；findings 清零或登记。JS/TS/JSON touched files 跑 Biome，机器规则和项目 gate 必须通过。
- 新功能 MSW 当前为 experimental：按 manifest 验证 handler、fixture、schema、注册链、场景、假设和退出策略，不因试点阶段跳过证据。

## 3. 场景

常用场景名：

`new_project` · `prd_intake` · `g0_g2_scope` · `g4_coding_worktree` · `write_api` · `write_mapper` · `write_query_hook` · `write_state` · `write_msw` · `legacy_mock` · `write_ui` · `write_figma` · `g6_verify` · `collaboration` · `review_docs_automation` · `docs_tdd_maintenance`

无法精确匹配时选最接近场景，从 pack 的 2-4 个专题开始；遗留 Mock 仅 `legacy_mock` 加载路线 A。维护时查 README，不把专题正文写回本文件。

不确定场景时可运行 `docs-tdd recommend <PROJECT-ID>`；结果只作候选，Agent 仍须按任务目标确认场景。

请求驱动的 UI 必须使用 `write_ui`（已包含分层/API 专题）；单独编写或调整 React Query Hook 使用 `write_query_hook`；读取或还原 Figma 使用 `write_figma`，不得只加载视觉或状态专题。

## 4. 上下文与预算

- 主线程只保留决策、风险和结果；大文件先 `rg` 定位再读局部，长命令只回传失败行。
- context pack 是带 L3/effective fingerprint 的 `/tmp` 可丢弃缓存；规则真值仍是各层权威源。
- Gate 完成、场景切换、PRD/契约 fingerprint 变化或处理大量日志/图片后，更新 `context-summary.md`；新任务只恢复 Router、摘要和当前 compact pack。
- 修改规则后依次运行 `docs-tdd check`、`rule-release.mjs --write`、`effective-rules.mjs --write`；任一发布漂移会阻断 context/changed/gate，但不阻断 check/capability/doctor。
- 规则维护优先使用 `docs-tdd release <PROJECT-ID> --scenario <SCENARIO>` 原子发布两层 manifest、doctor、golden 和 context smoke；任一步失败自动恢复旧 manifest。
- 常驻文件仅本文件且 ≤5000 字符；专题必须被 `rule-index.json` 至少一个场景引用，并被 README 人工索引收录。
- 新主题只新增/更新场景索引和 on-demand 文件；机器已拦的细则不在常驻层重复。
