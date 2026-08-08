# PR-01973 Lark 集成说明

> 本文只记录 PR-01973 项目差异、当前运行状态和历史验证结果。通用规则继承：
> - 主动通知：[../../common/rules/lark-active-notification.md](../../../common/rules/lark-active-notification.md)
> - 群内 @ 应用转任务：[../../common/rules/lark-bot-gateway.md](../../../common/rules/lark-bot-gateway.md)
> - 协作边界：[../../common/rules/collaboration-and-notifications.md](../../../common/rules/collaboration-and-notifications.md)

## 1. 启用状态

| 能力 | 状态 | PR-01973 差异 |
|------|------|---------------|
| 主动发群消息 | 已启用 | 自定义机器人 webhook；配置在 `agent/scripts/pr-01973.json` |
| 群内 @ 应用转 task | 已验证真实闭环 | 复用本机 Koa Bot Gateway；Worker 为 `agent/scripts/lark-worker.mjs` |
| Lark 文档读取 | 可用 | Lark 在线稿以本地导出为准进行对照 |

Webhook、Secret、App Secret、OAuth token、群 `chat_id` 只允许放本机运行环境或 ignored 配置，不写入文档正文、群消息或交付摘要。

## 2. 项目配置

| 项 | 值 |
|----|----|
| 项目 | PR-01973 |
| 卡片标题 | `[PR-01973] TradFi 落地页` |
| Webhook 配置 | `apps/web/docs_tdd/prds/PR-01973/agent/scripts/pr-01973.json` |
| 主动通知脚本 | `apps/web/docs_tdd/prds/PR-01973/agent/scripts/notify-lark.mjs`（薄包装，调用公共脚本） |
| Worker | `apps/web/docs_tdd/prds/PR-01973/agent/scripts/lark-worker.mjs`（薄包装，调用公共 Worker） |
| 通知记录 | `apps/web/docs_tdd/prds/PR-01973/agent/notification-log.md` |
| Bot Gateway | 本机 Koa 服务 `/Users/aven/aven/koa/src/routes/larkRoutes.js`，端口 `3005` |

主动通知命令：

```bash
node apps/web/docs_tdd/prds/PR-01973/agent/scripts/notify-lark.mjs <G0-G8> [状态] [说明] [--dry-run]
```

Worker 按需启动：

```bash
node apps/web/docs_tdd/prds/PR-01973/agent/scripts/lark-worker.mjs
node apps/web/docs_tdd/prds/PR-01973/agent/scripts/lark-worker.mjs --once
```

## 3. 当前运行状态

| 项 | 状态 | 备注 |
|----|------|------|
| Webhook 配置 | 已配置并真实发送成功 | 详见 `notification-log.md` |
| Bot Gateway | 已验证真实群 @ 入队 | 临时 tunnel 失效后需重启并更新 Lark 控制台 |
| PR-01973 Worker | 已验证真实闭环 | 只启动 Gateway 不会自动执行任务，必须同时启动 Worker |
| QA 用例 | 未提供 | G7 记录为跳过，不作为交付阻塞 |

## 4. PR-01973 门禁状态

| 门禁 | 当前状态 | 项目备注 |
|------|----------|----------|
| G0 | 已完成 | PRD、本地导出、Figma 截图已归档 |
| G1 | 已完成 | 文档和技术方案已生成 |
| G2 | 已完成 | 开发基线已确认 |
| G3 | 已完成 | API / Mock / mapper 基线已落地 |
| G4 | 已完成 | 首版页面实现已落地 |
| G5 | 已完成 | 当前按已有数据链路联调完成；真实数据后续继续跟进 |
| G6 | 部分完成 | Biome、桌面、375px、空态 / 错误态、单测已有记录；仍需补部分交互和主题持久化验证 |
| G7 | 跳过 | 当前未提供 QA 全量测试用例 |
| G8 | 待交付摘要 | 交付前需补 G6 剩余验证 |

## 5. 历史群 @ 闭环记录

| 时间 | 群任务 | 处理结果 | 验证摘要 |
|------|--------|----------|----------|
| 2026-06-15 | 跑马灯播放速度再加快一倍 | `MARQUEE_SPEED` 从 `40` 调整为 `80` | Biome 通过；TradFi 单测 4 文件 42 用例通过；全量 typecheck 被无关历史错误阻塞 |
| 2026-06-15 | 每个 tab 前加小 icon 并跟随状态变化 | 资产分类 Tab 和 Markets TradFi 分类 Tab 增加复用 icon，选中态高亮 | 触达文件 Biome 通过；TradFi 单测通过 |
| 2026-06-15 | 页面刷新 hydration failed | `TradFiHero` 延后登录态按钮文案到浏览器 hydration 后切换 | 修复服务端 / 客户端首屏文本不一致；补充 Worker 兜底回写规则 |

## 6. 项目特有边界

- PR-01973 群内 @ 任务只处理 TradFi 落地页、相关文档、自测和低风险 UI 调整。
- Worker 必须使用默认 Codex 沙箱；涉及 commit、push、生产数据、密钥、依赖安装或超出 PR-01973 范围的任务，必须停止并回群请求确认。
- 群任务完成后，结果摘要写群里；验证命令、diff、截图、长日志写入本地文档或通知记录。
- 真实 quick tunnel 地址为临时运行态，不写成长期配置；重启 tunnel 后只更新 Lark 控制台请求地址。
