# 新需求启动协议

> **已废弃（2026-10-10）**：本文是 Web Lite 时期（2026-09-28 ~ 10-10）的新需求启动协议，仅供查阅。新需求改用 skill `prd-to-commit`（`~/.ai-rules/skills/prd-to-commit/SKILL.md`）；存量项目路由见 [rule-router.md](./rule-router.md) §2。
>
> 原说明：本文定义新需求入口；完整规则见 [web-lite-workflow.md](./web-lite-workflow.md)。章节号 §2 被外链引用，勿改编号。

## 1. 启动口令

```text
新需求 <PROJECT-ID>，PRD：<链接或本地路径>。按 Web Lite 流程完成并本地提交。
```

## 2. Agent 执行链路

1. 读 [rule-router.md](./rule-router.md)，新需求只加载 `web-lite-workflow.md` 和确实命中的编码专题。
2. 单次完整读取给定的定稿 PRD，抽取 Web 范围为简短 Task checklist；不重复读取同一 revision，不运行 `docs-tdd run/kickoff`，不创建重型项目台账。
3. Task 明确后检查仓库状态，在独立 worktree 建立 `feature/<PROJECT-ID>` 或 `fix/<PROJECT-ID>`；遵守 [git-branch-flow.md](./git-branch-flow.md)。不覆盖已有目录、分支或未识别改动。
4. 实现 Task 中的 Web 行为，默认沿用真实请求。API 未 ready 或无法确认只标记待联调/核实；仅关键 UI/UX 需要反复走请求链模拟时局部使用最小 MSW。真实契约对账并清理本需求 MSW 后才能提测。
5. 冷读核对 Task、diff 和可见页面；按改动做最小有效验证。不重新拉 PRD，不建 G0-G8 / v2 evidence 套件。
6. 复核改动范围后 `git add`、`git commit`。不 push，除非用户在当前请求明确授权。

## 3. 必要提问与读取失败

- 仅在歧义会改变 Web 行为、正确性或安全时提问；一次合并提出必要问题。无需为清晰的小需求请求范围签核。
- 定稿 PRD 的图片、表格和嵌入内容只在影响 Web 范围时纳入。相关内容无法读取时说明具体缺口并停止依赖它的实现；不无限重试、不用旧 revision 代替。
- 用户明确通知 PRD 改版后才读新版本，并据此更新 Task。

## 4. 存量项目

已有 `workflowVersion: 1` 或 `workflowVersion: 2` 的项目按原协议恢复和交付；新需求不继承旧流程。详见 [web-lite-workflow.md §存量兼容](./web-lite-workflow.md)。
