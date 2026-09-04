# Verification Evidence — PR-02233 【用户端】安全验证校验交互优化

## Summary

| 字段 | 值 |
|------|-----|
| 项目 | PR-02233 |
| 阶段 | G4 P0/P1 自测（未宣告 G6） |
| 日期 | 2026-09-04 |
| 验证人 | Coding Agent |
| 结论 | P0/P1 专项 PASS；全仓 typecheck 被基线错误阻塞 |

## Command Evidence

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `pnpm exec biome check <17 touched files>` | 本次触达 TS/TSX/JSON | PASS | 2026-09-04 |
| `pnpm exec vitest run ...` | resolver、schema、MSW、copy、method dialog SSR | PASS | 5 files / 22 tests |
| `git diff --check` | 本次业务 diff | PASS | 无 whitespace error |
| `pnpm --filter @fameex/web typecheck` | Web 全仓 | BLOCKED | 大量 CopyTrading/Futures/Rewards 等基线错误；输出未命中本次 PR-02233 文件 |
| `curl -I http://localhost:42233/zh-CN/login` | webpack dev 编译与路由 | PASS | HTTP 200；Turbopack 因跨 worktree node_modules symlink panic，改用 webpack 验证 |

## Browser / UI Evidence

> 使用临时本地 component harness 渲染生产 `VerifyInputs` 及其真实依赖，验证后已删除 harness；MSW worker 为真实浏览器 Service Worker。视口均为 1440×1000、dark。

| 场景 | 证据 | 断言 | 结果 |
|------|------|------|------|
| 登录邮箱验证首态 | `p1-login-email.png` | 脱敏邮箱、切换入口、发送倒计时可见 | PASS |
| 登录方式弹窗 | `p1-method-dialog.png` | 仅 GA/邮箱/手机；顺序固定；邮箱标记“当前”；脱敏信息正确 | PASS |
| 切换到手机 | `p0-help-sms.png` | 标题/说明切为手机；帮助弹窗默认手机 Tab | PASS |
| 没收到验证码帮助 | `p0-help-sms.png` | 固定邮箱/手机双 Tab；手机文案 5 条；“已知晓”可见 | PASS |
| 倒计时 Tooltip | `p0-countdown-tooltip.png` | 展示“57秒后可重新发送验证码，有效期为10分钟” | PASS |
| 邮箱/手机独立倒计时 | Playwright console assertion | 邮箱初始 58s，切手机后返回邮箱为 55s，没有重置 | PASS |
| 手机注册回退 | `p1-register-sms.png` | 文案“没收到验证码？尝试邮箱注册”；输入 `12345` 后点击，step `verify→account` 且输入清空 | PASS |
| MSW 浏览器接线 | Playwright runtime assertion | `navigator.serviceWorker.controller === true`，active URL `/mockServiceWorker.js`，无 mock/worker console error | PASS |

## Blockers / Risks

| 项 | 影响 | 下一步 | 状态 |
|----|------|--------|------|
| 后端最终 `verifyMethods` 字段、错误码和 cooldown 单位未确认 | G5 真实 API 对账 | 保持 Zod + mapper 边界；联调时只改 adapter | OPEN |
| 全仓 typecheck 基线失败 | 无法给出全仓 PASS | 由基线/依赖 owner 修复；本批专项 tests 已通过 | BASELINE BLOCKED |
| P2 非登录注册场景与 P3 埋点未实施 | 整单尚未完成 | P0/P1 收口后按 work-item 分批推进 | OPEN |
