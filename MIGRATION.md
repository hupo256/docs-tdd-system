# Web Lite 切换记录

> 本文件记录当前迁移决策，不是另一份执行流程。新需求的唯一规范见 [web-lite-workflow.md](./common/rules/web-lite-workflow.md)。

## 当前默认

`PRD → 最小 Task → worktree → coding（API 未 ready 时 + MSW）→ 冷读 check → git add / commit`

- 只交付 Web；用户给定的 PRD 单次完整读取，不重复拉取同一 revision。
- Task 默认留在当前对话，不为小需求创建项目骨架、状态 JSON、证据目录或逐条测试映射。
- 仅在实质影响 Web 行为、正确性或安全的歧义下提问。
- API 未 ready 或无法确认时按 endpoint 使用 MSW 最小数据完成 UI/UX；ready 后逐 endpoint 对账并切换真实请求。
- 不运行 G0-G8 或 v2 work-item/verify；不要求额外安装 OpenSpec、spec-kit 或编排器。
- 完成冷读核对和适用的定向验证后本地提交；未经当次明确授权不 push。

## 保留范围

- `common/engine/`、旧规则、模板和历史项目保持原样，供已有 `workflowVersion: 1|2` 项目继续使用；新需求不再调用其流程。
- 不在本次切换中归档或删除旧引擎，也不修改消费仓 hook、CI 或全局 Agent 配置。
- 旧的两周归档计划、OpenSpec/spec-kit 选型、逐项测试映射和额外人工签核建议均未采纳。

## 效率评估

目前没有可核实的“10 分钟 / 7K token / 100% 覆盖”实验数据，不把它作为目标基线。收集真实需求的耗时、token、遗漏和人工介入数据后，再决定是否需要调整流程；不得为追数字增加假测试或流程台账。
