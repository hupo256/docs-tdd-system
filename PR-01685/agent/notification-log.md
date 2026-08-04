# PR-01685 通知记录

> 用于记录活动落地页 G0-G8 Lark / webhook 阶段通知和群内 @ 应用任务结果。实际发送后填写；dry-run 不等于已通知。  
> 早期试跑记录见 [pr-01685-dry-run.md](./pr-01685-dry-run.md)；后续真实发送和任务回写从本文件开始维护。

| 时间 | 门禁 | 状态 | 摘要 | 方式 | 结果 |
|------|------|------|------|------|------|
| 2026-06-16 14:03:06 +04 | G0 | 进行中 | PR-01685 webhook 配置 dry-run 验证；payload 和签名生成正常 | dry-run | success |
| 2026-06-16 14:03:xx +04 | G0 | 进行中 | PR-01685 Lark webhook 已配置，阶段通知链路真实发送验证 | real | success |
| 2026-06-16 14:17:xx +04 | Gateway | 已完成 | 本地 Koa Bot Gateway `/lark/health`、`/lark/events` challenge、`/lark/notify` 验证通过 | local | success |
| 2026-06-16 14:22:59 +04 | Gateway | 待公网回调 | 已找到 `/opt/homebrew/bin/cloudflared`；待启动 quick tunnel 并将新 `/lark/events` 地址更新到 Lark 控制台 | local | pending |
| 2026-06-16 20:xx +04 | G5 | 阻塞中 | 当前 PR-01685 处于接口联调阶段；Mock 开发里程碑和 Lark 文档接入已完成；等待后端确认 YApi 与真实接口差异、成功码、网关前缀和测试活动配置 | real | success |
| 2026-06-16 20:xx +04 | G6 | 部分完成 | 已补 Mock / real API 一键切换开关，全部 Mock 场景 mapper 自测和 calc 单测通过；完整 typecheck 仍被仓库既有非 Campaign 错误阻塞 | local | partial |
| 2026-06-17 22:41 +04 | G6 | 部分完成 | UI 还原修复后已用真实 Chrome + Playwright 验证桌面、390px H5、活动规则锚点和分享弹窗；截图已归档到 `agent/playwright-artifacts/2026-06-17-ui-fidelity-fix/` | local | success |
| 2026-06-18 08:25 +04 | Gateway | 已完成 | 按 docs_tdd 既有 Koa Bot Gateway 链路完成本地验证：health、challenge、群 @ mock 入队、任务领取、状态回写均通过；未再改 `apps/web` 运行时代码 | local | success |
| 2026-06-18 08:58 +04 | Gateway | 已完成 | 复验用户关心的群 @ 自动链路：公网 quick tunnel 投递 mock 群 @ 后，Gateway 入队、PR-01685 `lark-worker --once` 领取、状态回写 `done` 全部自动完成；此前卡点是状态类任务也会拉起子 Codex，公共 Worker 已补状态类直回写和 Codex 超时失败兜底 | local/public-tunnel | success |
| 2026-06-18 09:16 +04 | Gateway | 已完成 | 当前运行态复验：公网 `/lark/health` 可访问，本机 Koa 与 cloudflared 均在线；mock 群 @ 入队为 `pending`，PR-01685 Worker `--once` 自动领取并回写 `done` | local/public-tunnel | success |
| 2026-06-18 09:23 +04 | Gateway | 已完成 | LaunchAgent `com.fameex.pr01685.lark-worker` 常驻复验：服务 state=running；mock 群 @ 入队后由常驻 Worker 自动领取并回写 `done` | local/public-tunnel | success |
| 2026-06-18 09:59 +04 | Gateway | 已完成 | Gateway、cloudflared、Worker 三个 LaunchAgent 均已常驻；公网 `https://ears-labs-pasta-concerns.trycloudflare.com/lark/events` 投递 mock 群 @ 后自动入队、领取并回写 `done` | public-tunnel | success |
| 2026-06-18 10:16 +04 | Lark Task | 失败后修复 | 真实群 @ 已进入 Gateway；首条任务因 Worker LaunchAgent PATH 缺 `codex` 失败，已补 PATH 并重新加载 Worker | real | fixed |
| 2026-06-18 10:23 +04 | Lark Task | 已完成 | 真实群再次 @ 后成功入队、自动领取并回写 `done`；已配置真实群 `chat_id` 白名单，只限制群不限制用户 | real | success |
| 2026-06-18 10:30 +04 | Lark Task | 已完成 | 端口/运行状态查询直回规则验证通过：返回 Web `4001` 活动页地址与 Gateway `3005` 端口，避免拉起子 Codex | local-real-chat-mock | success |
| 2026-06-18 10:40 +04 | Lark Task | 已完成 | 两条消息规则修复并验证：Gateway 读取项目 `pr-01685.json` webhook 配置；日志出现 `[Lark webhook queued sent]` 和 `[Lark webhook result sent]`，表示收到回执和完成回执均已发送 | local-real-chat-mock | success |
| 2026-06-18 11:03 +04 | Lark Task | 已完成 | 人话卡片与时间规则验证通过：收到卡片内容归纳为项目状态和端口，完成卡片结果直说运行端口；两条卡片均带纯时间 note | local-real-chat-mock | success |
| 2026-06-18 11:17 +04 | Lark Task | 失败后修复 | 复杂文档任务含“端口状态”关键词时曾误走运行状态快捷回复；已修复公共 Worker 分类，命令前缀任务不再被端口关键词吞掉，且命令类任务禁止兜底假成功 | local-real-chat-mock | fixed |
| 2026-06-18 11:24 +04 | Lark Task | 失败后修复 | 真实群富文本图片任务 `这里的样式与 UI 稿不一致，修复它` 成功入队并发送收到回执，但因图片没有下载成本地可读附件，Codex 无法结合图片定位 UI 问题，最终 120 秒超时 | real | fixed |
| 2026-06-18 11:29 +04 | Lark Task | 方案废弃 | 曾尝试把短文本图片任务快速回群要求补页面/UI 定位，但这不符合“群里一句话 + 图片即可执行”的目标；该方案废弃，不作为后续规则 | local-real-chat-mock | deprecated |
| 2026-06-18 11:43 +04 | Lark Task | 修复中 | 正确方案改为：Gateway 按项目配置推断 PR-01685，记录图片 `imageKey/width/height`；真实事件可提供 `app_id`，配置提供 Lark 应用 `appSecret` 后即可下载图片到本地并把 `localPath` 交给 Worker/Codex；Worker 不再因文字简短直接失败 | local | in-progress |
| 2026-06-18 12:01 +04 | Lark Task | 部分完成 | 图片任务链路复验：Gateway 已把项目上下文和图片元数据写入 task；当前图片无法下载的明确原因是只配置了 webhook 签名 `secret`，它不是 Lark 应用 `appSecret`，已补配置模板和公共规则 | local-real-chat-mock | partial |
| 2026-06-18 13:38 +04 | Lark Task | 部分完成 | 带 `header.app_id` 的图片任务复验：Gateway 已自动使用事件 `app_id`，下载失败原因精确为 `missing LARK_APP_SECRET`；队列已清空，Worker 已恢复常驻 | local-real-chat-mock | partial |
| 2026-06-19 15:31 +04 | Lark Docs | 阻塞中 | 已按真实 `lark-sources.json` 执行 PRD / QA 只读同步；`lark-cli` 返回 `config/not_configured`，本机未完成 CLI 配置，未读取到最新 PRD / QA，产品文档暂不更新 | local | blocked |
| 2026-06-19 15:40 +04 | Lark Docs | 阻塞中 | 已完成 CLI 配置、Keychain 降级和联网重试；Bot 读取缺 `docx:document` / `docx:document:readonly` 应用权限，用户态授权返回应用待审批；仍未读取到最新 PRD / QA，产品文档暂不更新 | local/network | blocked |
| 2026-06-19 15:47 +04 | Lark Docs | 已完成 | Lark 应用权限审批通过后，真实 PRD / QA Wiki 已同步到 `inbox/lark-sync/`；README、功能清单、API / 埋点边界文档已按最新资料更新 | local/network | success |
| 2026-06-19 23:12 +04 | G6 | 部分完成 | PR-01685 已按 YApi Mock 跑 Campaign 单测 47/47 和 Browser / Playwright 桌面、移动端、分享、规则锚点、受限弹窗、未登录跳转自测；主流程通过，剩余风险为 hydration mismatch、script tag 与 aria-label 警告 | local-browser | partial |
## 规则

- 同一门禁同一状态不要重复发，除非内容有实质变化。
- 发送失败记录 `failed` 和原因。
- 未配置 webhook 时只能记录 `dry-run`。
- 群内 @ 应用触发的任务，也要记录接收、完成、阻塞或待确认结果。
- 不记录 Webhook URL、Secret、账号密码、Cookie 或私有环境地址。
