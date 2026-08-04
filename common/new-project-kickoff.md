# 新项目一句话启动协议

> 本文只定义启动编排。目录、PRD 读取、阶段门禁、MSW、视觉验收和通知细则分别消费对应专题，不在此复制。章节号 §2 被外链引用，勿改编号。

## 1. 启动口令

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：https://...
```

可同时提供 Figma、API/YApi、QA、Lark 配置和两项 Lark 能力启用决策。只给项目号与 PRD 时也立即推进 G0/G1，缺料按专题规则登记，不静默猜测。

## 2. Agent 自动执行链路

1. 读 [rule-router.md](./rule-router.md)，通过 `docs-tdd.mjs context <PROJECT-ID> new_project` 加载场景包；禁止全读 `common/`。
2. 运行 `docs-tdd kickoff <PROJECT-ID> --prd <source> --title <title>`；它幂等创建骨架、登记来源、尝试只读同步与 PRD intake，并写 `agent/run-state.json`。
3. 同步/intake 失败时用 `docs-tdd status/next/resume` 诊断和安全重试；不得用旧副本冒充最新。
4. 按 [prd-feature-inventory.md §3](./prd-feature-inventory.md) 建 sourceId → Feature → Task 映射并完成 G2 批准；语义文档仍由 Agent 读取真实 PRD 后填写，编排器不猜需求。
5. 运行 `update-project-index.mjs --write`；差异、缺料、假设和负责人确认写入 `product/06-collaboration.md`。
6. G2 前不写业务代码；G2 通过后按 [coding-worktree.md](./coding-worktree.md) 准备项目 worktree。
7. 后续只按 [workflow-gates.md](./workflow-gates.md) 推进 G3-G8。API 未 ready 消费 [architecture-and-state.md §8.4.1](./architecture-and-state.md)，验证消费 [quality-checklist.md](./quality-checklist.md) 与 [execution-evidence.md](./execution-evidence.md)。

## 3. 缺资料处理

缺 PRD/Figma/API/QA、权限、账号、环境、测试数据或 scope 确认时，继续完成不依赖缺项的 G0/G1 动作，并把阻塞写入 `product/06-collaboration.md`。是否及如何通知只消费 [collaboration-and-notifications.md](./collaboration-and-notifications.md)，本文不维护通知时机副本。

PRD 图片、表格、白板、删除线或引用文档不可完整读取时，严格执行 [lark-doc-sync.md §8](./lark-doc-sync.md)；影响 scope 的 unresolved 项阻断 G2。

## 4. 启动完成判定

不在本文维护产物清单或成功标准副本：

- 目录完整性以 [project-doc-structure.md](./project-doc-structure.md) 和 `start-new-project.mjs` 为准。
- 阶段准入准出以 [workflow-gates.md](./workflow-gates.md) 和项目 gate 结果为准。
- 项目最少输入仅为 `<PROJECT-ID>` 与可读取的 PRD 链接或本地 Markdown；其他缺项进入协作记录。
