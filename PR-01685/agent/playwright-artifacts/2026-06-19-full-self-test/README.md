# PR-01685 Browser / Playwright 全量自测报告

| 项 | 结果 |
|----|------|
| 时间 | 2026-06-19 23:12 +04 |
| Worktree | `/Users/aven/github/PR-01685-1`（2026-06-26 自 `/Users/aven/github/PR-01685` 迁移） |
| 服务 | `http://localhost:4001` |
| 数据模式 | `NEXT_PUBLIC_CAMPAIGN_USE_MOCK=true` |
| API Mock 来源 | YApi `Growth Activity` 字段映射；详见 `apps/web/src/apps/Campaign/mock/yapiCampaignMock.ts` |
| 真实 API 切换 | 设置 `NEXT_PUBLIC_CAMPAIGN_USE_MOCK=false` 后走 `apps/web/src/services/api/campaign/campaign.ts` 的 YApi 路径 |
| 单测 | `pnpm vitest --run apps/web/src/apps/Campaign/common/mapYapiCampaign.test.ts apps/web/src/apps/Campaign/common/calc.test.ts apps/web/src/apps/Campaign/common/format.test.ts`：3 files / 47 tests passed |

## 覆盖场景

| 场景 | 结果 | 实测方式 |
|------|------|------|
| 活动进行中 | 通过，无横向溢出，模块完整展示 | Playwright 打开真实页面 |
| 未开始 | 通过，无横向溢出，未开始态展示 | Playwright 打开真实页面 |
| 已结束 | 通过，无横向溢出，已结束态展示 | Playwright 打开真实页面 |
| 未报名 | 通过，无横向溢出，未报名态展示 | Playwright 打开真实页面 |
| 可领取 | 通过，无横向溢出，可领取态展示 | Playwright 打开真实页面 |
| 受限用户 | 通过，拦截弹窗展示“仅限指定用户参与” | Playwright 打开真实页面并触发弹窗 |
| 空排行榜 | 通过，无横向溢出，空榜场景可渲染 | Playwright 打开真实页面 |
| 移动端 390px | 通过，active/restricted/empty-ranking 均无横向溢出 | Playwright 390px 视口实测 |

## 交互结果

| 交互 | 结果 | 实测方式 |
|------|------|------|
| 分享弹窗 | 通过；弹窗出现，包含 `复制` / `Telegram` / `WhatsApp` / `X` | Playwright 真实点击 |
| 活动规则锚点 | 通过；桌面从顶部滚动到规则区，移动端同样生效 | Playwright 真实点击 / 滚动 |
| 未登录点击立即参与 | 通过；真实点击跳转 `/zh-CN/login?from=/campaign/PR-01685` | Browser / Playwright 真实点击 |
| 受限用户弹窗 | 通过；展示强拦截弹窗和“我知道了”按钮 | Playwright 打开受限场景 |

## 发现的问题 / 风险

| 优先级 | 问题 | 说明 |
|--------|------|------|
| P1 | 控制台存在 hydration mismatch | 多次出现 Footer SSR / Client HTML 不一致；页面最终可渲染，但正式交付前建议定位 Footer / RegisterAbFooterSlot 的 SSR 条件差异。 |
| P2 | 控制台存在 script tag 警告 | React 提示组件渲染过程中包含 script tag，需确认是否来自全局布局或第三方片段。 |
| P2 | 多个弹窗/按钮缺少 aria-label | 控制台多次提示 `An aria-label or aria-labelledby prop is required for accessibility.`，不阻断主流程，但影响可访问性。 |
| P3 | Browser 只读 evaluate 不能触发点击 | 首次匿名 CTA 测试因 Browser 只读沙箱无法执行 `button.click()` 失败；后续用真实坐标点击复验通过，不是产品问题。 |

## 文件索引

- `self-test-result.json`：Browser / Playwright 原始测试结果。
- 历史截图已按公共规则清理；后续自测默认只保留报告和必要 JSON 结果。
