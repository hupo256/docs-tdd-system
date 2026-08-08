# Web 功能开发专题入口

> 本文只负责人工导航，不定义规则正文。开工常驻入口是 [rule-router.md](./rule-router.md)，机器按场景加载 [rule-index.json](./rule-index.json)。专题所有权以 [rule-ownership.json](./rule-ownership.json) 为准。

## 按场景消费

| 场景 | 唯一正文入口 |
|------|--------------|
| G0-G8 阶段与门禁 | [workflow-gates.md](./workflow-gates.md) |
| PRD 富媒体读取 | [lark-doc-sync.md §8](./lark-doc-sync.md) |
| PRD → Feature → Task | [prd-feature-inventory.md §3](./prd-feature-inventory.md) |
| 项目目录与文件职责 | [project-doc-structure.md](./project-doc-structure.md) |
| 分支与编码 worktree | [coding-worktree.md](./coding-worktree.md)、[git-branch-flow.md](./git-branch-flow.md) |
| API、schema、mapper | [api-and-mapper.md](./api-and-mapper.md) |
| 状态所有权与 MSW | [architecture-and-state.md](./architecture-and-state.md) |
| UI token 与主题 | [ui-style-token-rules.md](./ui-style-token-rules.md) |
| 组件复用与视觉判定 | [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md) |
| 验证分工与操作 | [verification-division-of-labor.md](./verification-division-of-labor.md)、[browser-e2e-mcp.md](./browser-e2e-mcp.md) |
| 质量与 Review | [quality-checklist.md](./quality-checklist.md) |
| 改动边界 | [change-scope-boundary.md](./change-scope-boundary.md) |
| 证据格式 | [execution-evidence.md](./execution-evidence.md) |
| 协作与通知 | [collaboration-and-notifications.md](./collaboration-and-notifications.md) |

## 消费规则

1. 先读 Router，再只读当前场景命中的专题，不把本文当规则清单。
2. 项目 `engineering/development-rules.md` 只记录项目特殊约束、例外与证据，不复制公共专题正文。
3. 新增公共规则时更新其唯一专题源；Router、Gate、模板只写触发条件、消费链接和执行结果。
