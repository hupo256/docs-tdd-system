# Campaign Mock E2E 验收报告（登录态）

**日期**: 2026-06-27  
**工具**: Playwright MCP（系统 Chrome + 扩展）  
**账号**: 已登录（Header 显示充值/资产/订单）  
**入口**: `http://localhost:4000/zh-CN/campaign/PR-01685?mock=1&scenario=<name>`

## 验收结论

| 场景 | 操作 | 结果 |
|------|------|------|
| active + 登录 | 点击「立即参与」 | ✅ Hero CTA 变为「已参与」(disabled)，底部 CTA 同步 |
| claimable + 登录 | 点击「待领取」 | ✅ 按钮变为「已领取」(disabled)，Mock 会话 + invalidate 刷新正常 |
| restricted | 自动弹窗 | ✅ 「仅限指定用户参与」 |
| 未登录（前次） | 点击领取/报名 | ✅ 跳转 `/zh-CN/login?from=/campaign/PR-01685` |

## Vitest（API 全场景）

```bash
pnpm vitest run apps/web/src/services/api/campaign
# 19 passed
```

## Mock 联调参数

- `?mock=1` — 强制 Mock，无需改 env / 重启 dev
- `?scenario=active|claimable|restricted|...` — 场景切换

Browser/Playwright 规范见 `apps/web/docs_tdd/common/browser-e2e-mcp.md`（自测默认不截图）。
