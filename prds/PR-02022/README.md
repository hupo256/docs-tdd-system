---
projectId: PR-02022
status: closed
stage: G8
branch: feature/PR-02022
worktree: ""
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/WQECd5jNWo3qdBxUfiqlUAnmgfg
figmaNode: ""
larkEnabled: false
---

# PR-02022 合约跟单引导页

> 状态：**已上线（2026-07-22）**。PR-02022 已合入 online，相关 worktree 已回收；本目录保留历史文档、验收证据和复盘记录。

## 🤝 交接指引（下一位同学先读这里）

**当前状态：已上线（2026-07-22），worktree 已回收。** PR-02022 相关引导已合入 online；后端 YApi 5608/5611（`userType` + `change_first_enter`）已发到 dev；`user-type.ts` 中走查用的 `queryFn` mock 覆盖（`MOCK_USER_TYPE_WALKTHROUGH`）已删除，`useUserType` 直接走真实 GET；`grep -rn "@mock-only" apps/web/src/apps/CopyTrading apps/web/src/services/api/copyTrading` 已归零。Vitest 15 用例复跑全绿，type-check 无新增错误。G4 popover CSS 已还原；引导全流程/翻页/跳过/完成/上报/互斥/降级已在真实登录页验证；人工 L2 并排 + 390px H5 + dark/light 见 [evidence/ui-ux/manual-walkthrough-checklist.md](evidence/ui-ux/manual-walkthrough-checklist.md)（✅ 全勾）。QA 用例回归（32 条）+ dev 环境「刷新不再现」端到端验证均已完成，未发现 bug，见 [evidence/qa-regression-2026-07-13.md](evidence/qa-regression-2026-07-13.md)。残留风险 + 交付摘要见 [evidence/delivery-summary-2026-07-13.md](evidence/delivery-summary-2026-07-13.md)（4 项已知非阻塞风险，均已产品确认）。

### 必读顺序

1. 本 README（状态 + 已落地文件清单）
2. [product/04-frontend-tasks.md](product/04-frontend-tasks.md) — **G3-G8 已完成，历史归档**
3. [product/06-collaboration.md](product/06-collaboration.md) — 已确认项 + 上线归档 + 历史记录
4. [product/02-technical-design.md](product/02-technical-design.md) — driver.js 方案 + 埋点映射
5. [product/07-figma-spec.md](product/07-figma-spec.md) — G7 L2 还原对照

### 已落地文件（G3-G6）

**新增：**

- `apps/web/src/apps/CopyTrading/guide/copyGuideSteps.ts` — 三步 step 配置（第三步无 ×）
- `apps/web/src/apps/CopyTrading/guide/copyGuidePopover.ts` — `onPopoverRender` 注入跳过 + 进度 N/3
- `apps/web/src/apps/CopyTrading/guide/useCopyGuide.ts` — 引导编排 hook
- `apps/web/src/apps/CopyTrading/components/Modals/TraderBecomeModal/index.tsx` — 带单员弹窗

> G1 推导的 4 个 Mock hook（`services/api/copyTrading/guide/` 目录）已随后端接口合并方案删除，详见 [03-api-contract.md](product/03-api-contract.md)。

**修改：**

- `CopyTrading/index.tsx` — 挂 `useCopyGuide` + `TraderBecomeModal`，互斥逻辑（带单员未读弹窗优先，引导让位）
- `Banner/LeaderSummary.tsx:40` — 删自动弹（F12），保留用户主动路径（原 line 49/79）
- `Banner/Summary.tsx` / `TraderListSection/index.tsx` / `TraderListSection/TraderCard.tsx` — 加 3 个 data-tour 锚点
- `i18n/locales/zh-CN/copyTrading.json` — 13 条文案（`guide.*` + `traderBecomeModal.*`）

### G7 自测（已完成 2026-07-06）

1. ✅ Agent：引导全流程 / 互斥 / 降级 / Vitest 15 用例
2. ✅ 人工：Figma L2 并排 ≥95%、390px H5、dark/light（见 [evidence/ui-ux/manual-walkthrough-checklist.md](evidence/ui-ux/manual-walkthrough-checklist.md)）
3. ✅ 真实 API 接入（2026-07-13）：`useUserType` mock 覆盖删除，走真实 GET；⏳ G8：QA 回归 + dev 环境「刷新不再现」端到端

### 已确认（不要再动）

- 新手引导用 **driver.js**（已安装）
- 引导第三步**去掉 ×**，仅「上一步 / 完成」
- 引导第三步高亮「跟单管理」入口按钮
- 带单员弹窗**复用** `components/Modal.tsx`（`isDismissable={false}`）
- 交易员可见性 F13-16 **后端处理**；埋点仅 **Web 端**；App 端（F22）**本期不做**

### 已定位（省去重复 grep）

- 跟单广场：路由 `/copy-trading/futures`，容器 `CopyTrading/index.tsx`
- 带单交易页：`COPY_TRADING_LEADER_SETTING` = `/copy-trading/leader-setting`
- data-tour 锚点：Step1 `data-tour-trader-tab-top`、Step2 `data-tour-trader-tabs`、Step3 `data-tour-copy-management`
- 埋点：PostHog `posthog.capture`；i18n namespace `copyTrading`
- 历史 Mock 接口路径见 [06-collaboration.md](product/06-collaboration.md)「Mock 接口表（历史）」

### 编码环境（已回收）

- worktree `feature/PR-02022` 已回收，`/Users/aven/github/PR-02022` 不再作为活动编码目录。
- 历史复盘与证据保留在本目录下的 `evidence/` 和 `agent/`，如需回查直接读文档即可。

### 归档说明

- 以上待办已在上线前完成闭环；若后续真实接口或 QA 回归出现差异，直接回本项目 `product/06-collaboration.md` 补记历史即可。

---

## 当前阶段

- 当前阶段：**已上线（2026-07-22）**；`useUserType`/`useChangeFirstEnter` 直连 YApi 5608/5611，`@mock-only` 已归零；QA 回归 + dev 真机验证 + 交付摘要均已完成，无遗留 bug
- 公共规则：继承 [../common/README.md](../../common/README.md)
- PRD 来源：[Lark PRD](https://qfglxo2m3dc.sg.larksuite.com/docx/WQECd5jNWo3qdBxUfiqlUAnmgfg)（revision 633，2026-06-29，已同步到 `inbox/lark-sync/prd-latest.md`）
- 提测演示用例来源：[Lark 测试用例表](https://qfglxo2m3dc.sg.larksuite.com/wiki/T1eTwACdaibCB8kPG3plR08jg1d)（32 条，2026-07-13 已同步到 `inbox/lark-sync/test-cases-latest.md`，为下一步自测提供依据）
- Figma（web）：4 node（引导 1/2/3 步 + 带单员弹窗），fileKey=`KzvWxAYxqfgpoiYuKdxMAE`，规格见 07-figma-spec
- API 文档：已补齐并切真实接口（历史说明）

## 文档地图

- [inbox/README.md](inbox/README.md)：飞书原始同步材料归档说明
- [product/00-feature-inventory.md](product/00-feature-inventory.md)：22 条功能清单，含验收标准对照
- [product/01-scope-and-phases.md](product/01-scope-and-phases.md)：本期范围、阶段划分
- [product/02-technical-design.md](product/02-technical-design.md)：driver.js 方案、状态机、复用盘点、埋点映射
- [product/03-api-contract.md](product/03-api-contract.md)：接口清单（历史归档）、Mock schema
- [product/04-frontend-tasks.md](product/04-frontend-tasks.md)：G0-G8 任务清单
- [product/05-ui-and-interaction.md](product/05-ui-and-interaction.md)：页面路由、组件交互、i18n 文案
- [product/06-collaboration.md](product/06-collaboration.md)：已确认项 + 上线归档 + 历史记录
- [product/07-figma-spec.md](product/07-figma-spec.md)：4 node Figma 规格
- [engineering/development-rules.md](engineering/development-rules.md)：项目特殊约束
- [agent/README.md](agent/README.md)：Agent 恢复说明

## 归档索引摘要

| 类别 | 当前结论 | 入口 |
|------|----------|------|
| 上线状态 | 已上线（2026-07-22），worktree 已回收 | 本 README / `PROJECTS.md` |
| 验收证据 | QA 32 条用例回归完成，未发现阻塞 bug | `evidence/qa-regression-2026-07-13.md` |
| 交付复盘 | 真实接口、Mock 清理、文案逐字断言均已闭环 | `evidence/delivery-summary-2026-07-13.md` |
| 原始资料 | PRD / QA 用例只读快照，保留历史状态 | `inbox/README.md` |

## Lark 协作能力

- 主动发群消息：未启用
- 群内 @ 应用转 task：未启用
