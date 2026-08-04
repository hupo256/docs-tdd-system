<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# 通知记录

> 用于记录 G0-G8 Lark / webhook 阶段通知。实际发送后填写；dry-run 不等于已通知。

| 时间 | 门禁 | 状态 | 摘要 | 方式 | 结果 |
|------|------|------|------|------|------|
| YYYY-MM-DD HH:mm | G0 | 进行中 | 开始接收资料 | dry-run / real | success / failed / skipped |
| YYYY-MM-DD HH:mm | Lark Job | 完成 | 群内 @ 应用反馈 bug，已修复并自测 | real | success |

## 规则

- 同一门禁同一状态不要重复发，除非内容有实质变化。
- 发送失败记录 `failed` 和原因。
- 未配置 webhook 时只能记录 `dry-run`。
- 群内 @ 应用触发的任务，也要记录接收、完成、阻塞或待确认结果。
- 不记录 Webhook URL、Secret、账号密码、Cookie 或私有环境地址。
