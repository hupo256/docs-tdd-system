# Collaboration — PR-02022 合约跟单引导页

## 项目状态

- **已上线（2026-07-22）**：PR-02022 已合入 online，`/Users/aven/github/PR-02022` worktree 已回收。
- 本页保留历史确认记录与验收证据，后续若有回归或接口差异，直接补记对应条目即可。

## G2 确认记录

| 确认人 | 日期 | 确认内容 |
|--------|------|---------|
| Aven | 2026-06-30 | F12 删除范围、F13-F16 后端处理、F17-F18 Web only、F22 不做 |

## 已确认（历史）

| 时间 | 问题 | 影响阶段 | 责任人 | 状态 |
|------|------|---------|--------|------|
| 2026-06-30 | YApi / 接口文档：引导状态查询/上报、带单员弹窗查询/上报 | G8 真实接口切换 | 后端 | **已补充并落地**（YApi 5608/5611，真实接口已上线） |
| 2026-06-30 | 带单员首次开仓后实时更新：前端如何感知（轮询/WS/接口标志）？ | G8 | 后端 | **已完成**（随接口文档和联调闭环） |
| 2026-06-30 | Figma node-id=3835-36597 是否覆盖所有交互态（步骤 1/2/3、互斥、H5）？ | G7 UI 还原 | 设计 | **G7 人工走查已通过**（2026-07-06；4 node L2 并排 + H5/dark/light 见走查清单） |
| 2026-06-30 | QA 用例链接 | G7/G8 | QA | **已完成**（32 条回归已记录于 evidence） |
| 2026-06-30 | popover CSS 是否 ≥95% 还原 Figma（`copy-guide-popover` 样式细节） | G7 | 开发 | **已关闭**（2026-07-06 人工 L2 并排通过） |

## Mock 接口表（历史）

> 该表仅保留历史说明。接口已切真实 API，相关 mock 路径不再作为活动配置使用。

| 用途 | hook | Mock url | method |
|------|------|----------|--------|
| 查引导状态 | `useGuideStatus` | `/fe-ex-api/cptrade/guide/status` | GET |
| 上报引导完成/跳过 | `useReportGuideStatus` | `/fe-ex-api/cptrade/guide/report` | POST |
| 查带单员弹窗状态 | `useTraderPopupStatus` | `/fe-ex-api/cptrade/trader/popup-status` | GET |
| 上报弹窗已读 | `useReportTraderPopup` | `/fe-ex-api/cptrade/trader/popup-report` | POST |

## 已关闭确认项

| 时间 | 问题 | 结论 | 确认人 |
|------|------|------|--------|
| 2026-06-30 | F12 旧引导删除范围 | 删除「**交易员带单协议**」+「**合约带单设置**」两个弹层在「成为交易员后→进入跟单广场」路径下的触发逻辑。⚠️ 两个弹层组件本身及其他路径下的触发逻辑**不得改动** | Aven |
| 2026-06-30 | F13-F16 可见性逻辑实现方 | **后端接口处理**，前端直接渲染 API 返回结果，无需前端过滤 | Aven |
| 2026-06-30 | F17-F18 埋点平台范围 | **Web 端 only**，不含 app | Aven |
| 2026-06-30 | F22 App 端 | **本期不做**，Web only | Aven |
| 2026-06-30 | driver.js 依赖 | **同意引入**，用于新手引导 | Aven |
| 2026-06-30 | 引导第三步 popover 右上 `×` | **去掉 ×**；第三步仅「上一步 / 完成」 | Aven |
| 2026-06-30 | 引导第三步高亮目标 | **沿用现有「跟单概览」卡片兜底**（顶部 User764106 + 未实现盈亏/当前跟单/总收益/跟单详情）；新用户该卡片也在（数值为 0），直接高亮即可 | Aven |
| 2026-06-30 | 带单交易页路由（G4 grep） | `COPY_TRADING_LEADER_SETTING` = `/copy-trading/leader-setting`（`constants/pathnames.ts:199`） | Agent grep |
| 2026-06-30 | F12 自动弹出触发点（G4 grep） | 仅 `LeaderSummary.tsx:40` `setIsOpen(data?.isFirstPage === 1)`；line 49/79 为用户主动路径保留 | Agent grep |
| 2026-06-30 | 三步高亮真实 DOM + data-tour 锚点（G4） | Step1 `data-tour-trader-tab-top`（HeaderTabs）、Step2 `data-tour-trader-tabs`（HeaderTabs）、Step3 `data-tour-copy-management`（Summary / LeaderSummary） | Agent 实现 |
| 2026-07-06 | G7 人工 UI 走查 | 带单员弹窗 + 引导三步 + 390px H5 + dark/light 全部通过；见 `evidence/ui-ux/manual-walkthrough-checklist.md` | Aven |

## 假设

- 两个弹窗的接口均走现有鉴权体系，无需额外 token 处理
- 引导状态和弹窗状态均为用户维度，后端按 user_id 存储
- F13-F16 后端接口已处理过滤，前端侧无需额外筛选逻辑
- i18n key 命名跟随现有合约跟单 namespace，G4 前 grep 对齐

## 上线结论

- 新手引导和带单员弹窗均已完成上线验收，旧引导触发逻辑已移除。
- `@mock-only`、Mock 路径和走查用覆盖已清理，真实接口链路已稳定。
- 本页后续仅作为历史记录，不再新增未确认项。

## Lark 协作能力

- 主动发群消息：**未启用**
- 群内 @ 应用转 task：**未启用**
