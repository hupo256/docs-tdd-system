# 2026-06-17 UI 还原修复自测报告

> 关联修改：PR-01685 Campaign 页面 UI 还原修复。  
> 页面：`http://localhost:4301/zh-CN/campaign/PR-01685?scenario=active`  
> 工具：真实 Chrome + Playwright（系统 Chrome：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）。

## 1. 自测场景

| 场景 | 结论 |
|------|------|
| 修复前桌面首屏顶部 | 曾作为 UI 偏差对照基线；历史截图已按公共规则清理 |
| 修复前 390px H5 首屏顶部 | 曾作为移动端遮挡 / 间距问题对照基线；历史截图已按公共规则清理 |
| 修复后桌面活动进行中首屏 | Hero 背景、标题、CTA、图像圆角和阴影已调整 |
| 修复后 390px H5 活动进行中首屏 | 顶部链接不遮挡标题；CTA 和分享按钮布局正常 |
| 移动端点击“活动规则”后 | 已滚动到规则区，锚点交互可用 |
| 点击分享前 | 分享按钮位于 Hero CTA 右侧，`aria-label="分享活动"` |
| 点击分享后 | 分享弹窗出现，包含复制、Telegram、WhatsApp、X 渠道 |

## 2. 验证结论

- 桌面和 390px H5 均使用真实 Chrome + Playwright 验证，不是静态代码推断。
- 历史截图已按公共规则删除；本报告保留文字结论。
- 移动端顶部“活动规则 / 我的奖励”不再遮挡 Hero 标题。
- 移动端 CTA 保持整行主按钮，分享按钮保持固定可点区域。
- “活动规则”锚点跳转已验证可滚动到规则区。
- 分享按钮已验证可打开分享弹窗。

## 3. 已知未覆盖

- 本轮只针对 UI 还原修复后的 active 场景补验证结论；完整 Mock 场景以全量自测报告为准。
- 真实 API 联调、登录态账号矩阵、QA 用例回归仍按 `agent/lark-integration.md` 中 G5 / G7 状态处理。
