# PR-01988 Agent 流程

> 状态：G2 已确认，G4 Admin UI/UX 已完成，G5 接口联调已完成，当前进入 G6/G7 QA 用例同步和验收证据收口。公共协作规则继承 [`../../common/collaboration-and-notifications.md`](../../common/collaboration-and-notifications.md)。

## 恢复顺序

1. `apps/web/docs_tdd/AGENTS.md`
2. `apps/web/docs_tdd/CONTEXT.md`
3. `apps/web/docs_tdd/common/README.md`
4. `apps/web/docs_tdd/common/prd-feature-inventory.md`
5. `apps/web/docs_tdd/common/project-doc-structure.md`
6. `apps/web/docs_tdd/PR-01988/README.md`
7. `apps/web/docs_tdd/PR-01988/product/00-feature-inventory.md`
8. `apps/web/docs_tdd/PR-01988/product/06-collaboration.md`
9. `apps/web/docs_tdd/PR-01988/product/08-g2-scope-review.md`
10. `apps/web/docs_tdd/PR-01988/product/11-needed-inputs.md`
11. 最近一次用户消息

## 当前状态

| 项 | 状态 |
|----|------|
| PRD | 已提供：`../inbox/【PR-01988】预测市场二期方案.md` |
| docs_tdd 来源 | worktree 软链到主仓 `/Users/aven/github/fameex-web/apps/web/docs_tdd` |
| G0 功能清单 | 已填初稿 |
| G2 scope | 已确认：aven / 2026-06-17；允许 mock-first |
| 代码基线 | Admin 模式已初查；Web Prediction 路径已确认；legacy Polymarket 配置页已定位 |
| API | YApi project 459 已拉取 32 个接口；mock-first 保留兜底，用户已确认真实接口联调完成 |
| 原型 | 按 PRD 截图低保真实现；HTML / Figma 后续如有再补 |
| G2 review | `product/08-g2-scope-review.md` 已补，含默认建议和确认模板 |
| 最小输入 | N01-N05 已由用户确认，详见 `product/06-collaboration.md` |
| Mock-first | 已授权并已落地；YApi 32 个接口已用于 real-mode 预接入，mock 继续作为无环境 / 无权限时兜底 |
| 验收计划 | `product/09-acceptance-checklist.md` 已补 G6/G7 证据矩阵 |
| QA 用例 | 已通过 FreeMind 导出读取；原始 `.mm` 在 `inbox/lark-qa/`，执行清单见 `product/14-self-test-cases.md` |
| 实施计划 | `product/10-implementation-plan.md` 已补 G2 后文件落点和安全闸口 |
| Lark 主动通知 | 已接入脚本；本机 webhook 配置已就绪，可真实发送 |
| 群内 @ 应用转 task | 未启用；如需启用需另接 Lark 应用事件订阅 + Bot Gateway |
| 通知记录 | `notification-log.md` |

## Lark 决策

- 主动发群消息：已启用项目级脚本，配置路径为 `.lark-fe-task/PR-01988.json`；真实发送成功后必须记录到 `notification-log.md`。
- 群内 @ 应用自动生成 task：未启用；Webhook 不能接收群内 @，如需启用必须另接 Lark 应用事件订阅、Bot Gateway 和 Worker。
- 项目脚本为薄包装：`agent/scripts/notify-lark.mjs` 调用 `../../common/agent-scripts/notify-lark.mjs`，项目差异见 `agent/lark-integration.md`。

## 下一步动作

1. 按 `product/14-self-test-cases.md` 执行 G6/G7 自测用例。
2. 基于已完成的接口联调补验收证据：真实数据截图、Network、导出文件、mutation 结果和高风险安全链路记录。
3. 执行后回填用例结果、证据路径、失败 / 阻塞备注；必要时同步更新 `product/09-acceptance-checklist.md`。
4. Web 埋点和交易关闭禁用态按 scope 后续接入，需先确认一期 Prediction 代码来源和用户侧字段 / 错误码。
5. 高风险 mutation（手动平账、分类 / 事件变更、Lark webhook、私钥配置迁移）等权限和安全边界确认后再接真实提交。
6. 若要真实发群，先在 `.lark-fe-task/PR-01988.json` 放入本机 webhook/secret；不要复用 `agent/scripts/pr-01685.json`。

## 快速恢复提示

```text
当前 worktree：/Users/aven/github/PR-01988
docs_tdd：apps/web/docs_tdd -> /Users/aven/github/fameex-web/apps/web/docs_tdd
门禁：G2 已确认；G4 Admin UI/UX 已完成；G5 接口联调已完成；mock-first 保留兜底
下一步：按 product/14-self-test-cases.md 执行 G6/G7 自测并回填证据
开发入口：如继续补代码，仍按 product/10-implementation-plan.md 与 product/12-yapi-api-integration.md 执行
```
