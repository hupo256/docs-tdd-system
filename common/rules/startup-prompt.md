# Startup Prompt

把下面模板作为新需求启动口令。目标是让 AI 每次从同一个入口开始，不依赖上一次对话记忆。

## 新需求启动模板

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 <PROJECT-ID>，PRD 文档是：<PRD 链接或本地路径>。

请先读取 apps/web/docs_tdd/common/rules/rule-router.md，只按命中场景读取专题文档，不要一次性读取整个 common。
新项目默认走 docs_tdd v3.5 第二代协议（内部兼容标识 `workflowVersion: 2`）。用单一 `run --prd` 入口初始化并恢复；宿主 Agent 按唯一下一步完成需求抽取、审查、实现和验证，再由 `docs-tdd verify` 写正式出口。当前命令行尚无宿主 Agent adapter，语义动作会返回 `needs-agent`，审批和必要业务裁决返回 `needs-user`，不能把 action packet 当作已执行或通过。V0/V1/V2 的 failed/blocked 都阻断交付；存量 `workflowVersion: 1` 项目继续第一代流程，显式新建第一代项目才用 `kickoff --legacy`。
代码静态扫描只 review 新增或已修改文件。
```

可选补充：

```text
Figma：<链接 / node id>
API / YApi：<链接>
QA：<链接>
是否启用主动发群消息：是 / 否 / 稍后
是否启用群内 @ 自动任务：是 / 否 / 稍后
```

## Agent 启动顺序

1. 读取 `common/rules/rule-router.md`。
2. 如需机器路由，读取 `common/rules/rule-index.json` 中的 `new_project` 场景。
3. 执行统一编排入口（默认 v3.5 第二代协议；显式 v1 项目仍通过 kickoff 创建）：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs run <PROJECT-ID> --prd <PRD> --title <项目短名>
# 按 action packet 执行语义动作并提交结构化结果；scope approval / 必要业务裁决交由用户处理
```

4. 中断或换会话先运行 `docs-tdd status <PROJECT-ID>` 与 `docs-tdd next <PROJECT-ID>`；可安全重试的同步/intake 用 `docs-tdd resume <PROJECT-ID>`。
5. **v1 项目**：G2 / G5 / G6 / G7 / G8 前运行 `docs-tdd.mjs gate <PROJECT-ID> <GATE>`；代码变更后运行 `verify-code-rules.mjs --project <PROJECT-ID>`。**v2 项目**禁止跑 G 门禁链，以 `docs-tdd.mjs verify <PROJECT-ID> --input <verify-input.json>` 生成的 `mode=enforced` latest-result 为唯一正式出口；只有历史回放/灰度复算才允许直接传 `vnext-verify.mjs --shadow`。
