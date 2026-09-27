# Startup Prompt

新需求直接使用下面口令；编码规范仍按全局/仓库规则按需加载。

## 新需求模板

```text
新需求 <PROJECT-ID>，PRD：<链接或本地路径>。
只做 Web。请按 apps/web/docs_tdd/common/rules/web-lite-workflow.md 执行：
PRD 单次完整读取 → 最小 Task → 独立 worktree → coding（API 未 ready 时用最小 MSW）→ 冷读 check → 本地 git add / commit。
PRD 是定稿；不要重复 fetch 同一 revision。仅在实质影响 Web 行为、正确性或安全的歧义下提问。不要运行 G0-G8、v2 work-item/verify 或创建重型台账。不要 push。
```

## 执行入口

1. 读 `common/rules/rule-router.md`，再读 `common/rules/web-lite-workflow.md`。
2. 对 PRD 做一次完整读取，生成简短 Task checklist；非 Web 内容忽略。
3. 检查 Git 状态并在独立 worktree 开发；按需加载目标模块对应的编码规则。
4. API 未 ready 或无法确认时，以 endpoint 为单位采用最小 MSW 数据，完成 UI/UX；ready 后按契约对账并切换真实请求。
5. 冷读对照 Task 和 diff，定向验证，复核后本地提交。

存量项目通过其现有 `workflowVersion` 路由旧流程；不要将旧流程套用到新需求。
