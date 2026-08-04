# PR-01685 UI/UX 验收报告

**日期**：2026-06-26  
**工具链**：Playwright MCP（`user-Playwright`，Chrome 扩展模式）  
**服务**：`http://localhost:4000`（Mock：`NEXT_PUBLIC_CAMPAIGN_USE_MOCK=true`）  
**视口**：桌面 1440×1200、移动 390×844  
**主题**：仅验证 light（深色切换未在本轮执行）

---

## 总览

| 结论 | 说明 |
|------|------|
| **🟢 通过（附注）** | 场景矩阵、布局溢出、主要交互链路达标；3 项需登录/场景文案差异附注；K2 深色与 Figma 95% 对照未本轮执行 |

| 统计 | 数量 |
|------|------|
| ✅ 通过 | 18 |
| ⚠️ 部分通过 | 3 |
| ❌ 失败 | 0 |
| ⏭️ 未验 | 1（K2 深色） |

---

## K1–K3 场景矩阵 + 溢出

7 个 scenario × 2 视口均已用 `browser_snapshot` 走查；自测截图已按 [browser-e2e-mcp.md](../../../common/browser-e2e-mcp.md) §5 清理，仅保留本报告。

| scenario | 桌面溢出 | 移动溢出 | 关键文案 |
|----------|----------|----------|----------|
| active | ✅ | ✅ | 标题、排行榜、Mock 角标 |
| not-started | ✅ | ✅ | 即将开始/未开始 |
| ended | ✅ | ✅ | 已结束 |
| unjoined | ✅ | ✅ | 立即参与 |
| claimable | ✅ | ✅ | 待领取 |
| restricted | ✅ | ✅ | 仅限指定用户参与、我知道了 |
| empty-ranking | ✅ | ✅ | 暂无数据 |

---

## K4–K7 交互验收（390px）

| ID | 操作 | 预期 | 实际 | 结果 |
|----|------|------|------|------|
| K4 | 下滚后底部浮层 | 固定 CTA 可见 | `scrollY=1200` 时 fixed 含「立即参与」 | ✅ |
| K5-1 | 未登录点「立即参与」 | 跳转 login 含 from | `/zh-CN/login?from=/campaign/PR-01685` | ✅ |
| K5-2 | restricted 场景 | 限制文案 + 我知道了 | 页面含目标文案 | ✅ |
| K6-1 | claimable 点「待领取」 | toast 领取相关 | **未登录 → 跳转登录**，未见 toast | ⚠️ |
| K6-2 | unjoined 点「去完成」 | toast 请先报名 | mock 为「立即认证/立即交易」，无「去完成」 | ⚠️ |
| K6-3 | 点「分享活动」 | 复制/TG/WA/X | 弹窗四渠道齐全 | ✅ |
| K6-4 | 点「活动规则」 | `#campaign-rules` 进视口 | `inViewport: true` | ✅ |
| K7-1 | 排行榜第 2 页 | 表格仍展示 | 分页点击成功 | ✅ |
| K7-2 | empty-ranking | 暂无数据 | ✅ | ✅ |

> **K6-1/K6-2 附注**：代码逻辑为未登录先跳登录；「请先报名」toast 需**已登录 + 未报名**态；unjoined mock 任务 CTA 为条件路由（立即认证/交易等），与验收文档「去完成」文案不完全一致，建议对齐文档或 mock 数据。

---

## K12 控制台

| 级别 | 典型问题 | 归属 |
|------|----------|------|
| P1 | Hydration mismatch（Footer） | 全站/layout |
| P2 | Image 缺 `alt`、aria-label 缺失 | a11y |
| 环境 | webapi SSL、geetest 502、Google GSI 403 | 本地 dev 环境，非活动页逻辑 |

---

## 未验 / 后续

| 项 | 状态 |
|----|------|
| K2 深色主题 | ⏭️ 未切换验证 |
| JF Figma 95% 对照 | ⏭️ 待与 Figma 并排肉眼对比（必要时临时截图，用完删除） |
| K6-1/K6-2 登录态 | 需测试账号或 mock 登录后复验 |

---

## 证据文件

- `acceptance-result.json` — 结构化结果（可选）

---

## MCP 配置备忘

Playwright 扩展模式**无需手动 Connect**：Cursor Agent 调用 `browser_navigate` 时 MCP 服务自动连扩展。扩展弹窗显示 `No clients connected` 表示等待 MCP 调用，属正常待命状态。
