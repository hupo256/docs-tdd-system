# PR-01973 Agent 流程

> 本文只记录 PR-01973 项目差异和恢复顺序。通用门禁、Lark、Browser / Playwright、QA、质量检查规则继承 `../../common/`。

## 1. 当前运行口径

| 能力 | 状态 | 项目差异 |
|------|------|----------|
| 文档 / PRD | 已归档 | 本地 PRD：`inbox/【PR-01973】TradFi 落地页_0610 .md` |
| Figma | 已读取 | 主 node：`10323:33697`；规格见 `product/07-figma-spec.md` |
| 主动 Lark 通知 | 已启用 | 配置和状态见 [lark-integration.md](./lark-integration.md) |
| 群内 @ 自动闭环 | 已验证真实闭环 | 三次历史群任务见 [lark-integration.md](./lark-integration.md) |
| QA 用例 | 未提供 | G7 当前记录为跳过，不作为交付阻塞 |

## 2. 恢复顺序

如果线程中断或上下文压缩，按顺序读：

1. `apps/web/docs_tdd/AGENTS.md`
2. `apps/web/docs_tdd/CONTEXT.md`
3. `apps/web/docs_tdd/common/README.md`
4. `apps/web/docs_tdd/common/workflow-gates.md`
5. `apps/web/docs_tdd/common/collaboration-and-notifications.md`
6. `apps/web/docs_tdd/prds/PR-01973/README.md`
7. `apps/web/docs_tdd/prds/PR-01973/product/04-frontend-tasks.md`
8. `apps/web/docs_tdd/prds/PR-01973/engineering/development-rules.md`
9. `apps/web/docs_tdd/prds/PR-01973/agent/lark-integration.md`
10. 最近一次用户消息或 Lark task 内容

不要自动回到 PR-01685、Prediction 或已删除的 worktree。

## 3. PR-01973 项目特殊执行点

- Figma 与 PRD 冲突时，先写入 `product/06-collaboration.md`，再走 G2 待确认。
- API 到位后先放入 `inbox/`，再更新 `product/03-api-contract.md`，并对比 `usePublicInfoQuery`、`useFuturesTicker`、`useFuturesKlineData`、`MarketTable` 等复用候选。
- G6 当前仍有未验证项：CTA / 卡片 / 交易按钮点击、Tab 浏览器逐项交互、真实接口失败注入、dark 默认与 light 持久化、合约交易下拉 + Markets TradFi Tab。
- 群内 @ 任务只处理 TradFi 落地页、相关文档、自测和低风险 UI 调整；高风险动作必须先请求确认。

## 4. 项目入口

| 文档 | 用途 |
|------|------|
| [lark-integration.md](./lark-integration.md) | PR-01973 Lark 启用状态、配置路径、历史验证 |
| [notification-log.md](./notification-log.md) | 实际发送和 Lark Job 记录 |
| [../engineering/development-rules.md](../engineering/development-rules.md) | TradFi 专有工程约束 |
| [../product/07-figma-spec.md](../product/07-figma-spec.md) | Figma 节点和视觉规格 |

