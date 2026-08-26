---
projectId: PR-01947
status: closed
stage: G8
branch: feature/PR-01947
worktree: ""
port: ""
visualFidelity: standard
prdSource: https://qfglxo2m3dc.sg.larksuite.com/docx/Qj5OdXCCroWHopxcfcmlGklMgff
figmaNode: "15089:25554"
larkEnabled: false
---

# PR-01947 跟单设置优化（保证金/杠杆/复制仓位）

## 状态（2026-08-26 更新）

| 项 | 值 |
|----|-----|
| **归档门禁标记** | **G8（legacy-unverified）**：项目已关闭，但没有补造 G5→G8 的 PASS 历史；最后一份机器门禁仍是 2026-08-01 的 G5 BLOCK |
| **当前阶段** | **发布归档**：用户于 2026-08-26 确认已生产上线；历史联调/QA 缺口保留为历史记录，不再作为活动开发工作项 |
| **发布状态** | **已生产上线**：`feature/PR-01947` 的 HEAD `29f304b3b9` 已进入 `origin/online`；发布核验见 `evidence/release/2026-08-26/README.md` |
| **代码分支** | `feature/PR-01947` 已保留供回查；上线后 worktree 已回收 |
| **交付提交** | `29f304b3b9` `chore(PR-01947): make MSW worker opt-in` |
| **Figma 设计稿** | 2026-07-14 serena 更新 · 智能比例 Tab 规格已落盘 `07-figma-spec.md` |
| **PRD** | [Lark docx](https://qfglxo2m3dc.sg.larksuite.com/docx/Qj5OdXCCroWHopxcfcmlGklMgff) |
| **Figma（L2 基线）** | [「FameEX三期」 WEB](https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/...?node-id=15089-25554&m=dev) |
| **交接文档** | **`agent/handoff-2026-07-14.md`**（AI 入口）+ `evidence/ui-ux/2026-07-14/README.md` |

## 归档判断

- **生产事实已更新**：旧发布核验（2026-08-01）仅反映当时 `dev/test` 状态；2026-08-26 已确认 feature HEAD 进入 `origin/online`，因此项目按上线归档并回收 worktree。
- **不伪造门禁**：历史 `agent/gate-results.json` 的 G5 BLOCK 与缺失的 G5→G8 PASS 历史保留原状。这里的 `G8 (legacy-unverified)` 仅是已上线归档标签，不表示补跑或伪造了 G8 gate。
- 开发链路为 **dev 直连真实 API**，MSW 试点已按计划完整拆除；worker、Provider 启动点、service worker 文件与 `msw` 依赖均已移除，`before_follow` 不再被 MSW 拦截。
- **F15 已落**：复制全部仓位取值改为选中币对带单仓位数，已接真实接口 `services/api/copyTrading/follow/lead-position-count.ts`（`8a71fde629`），`SettingForm.tsx` 消费。
- 若后续要恢复 mock-first：先补 `src/mocks/handlers/<feature>.ts` + 契约测试，再把 handler 注册回 `browser.ts`，最后确认 `Providers.tsx` 的 dev-only 启动仍有效；只加一个假数据文件不算闭环。

## 已完成

- G0–G3 文档与 scope 定稿（G2 2026-07-08）
- G4 前台 F01–F17（除 F15）+ MSW 试点 + 后台 F19–F21 展示层
- G6 gate PASS（2026-07-09，fail=0 warn=2）
- 2026-07-10 需求变更：杠杆范围改前端硬编码 1–20x（`03-api-contract.md` §4）
- 2026-07-13 正式 Figma 规格初版（`07-figma-spec.md`）
- **2026-07-14 Figma 智能比例 Tab 重读** · 规格/交互文档更新 · `handoff-2026-07-14.md`
- **2026-07-14 JF1/JF2 交互范式落码**（`c3c0b3b19a`）：三控件改 Select/Switch+Input，确认弹窗三行；16/16 单测通过
- **2026-07-15 真实 dev API 联调**：删除 `copyTradingFollowHandlers` 与契约测试，`before_follow` 不再被 MSW 拦截，dev 直连真实接口。
- **2026-07-21 F15 + MSW 拆除落码**（`c3c0b3b19a`..`8a71fde629`，10 个 commit，已推远端）：
  - `98038c66d1` 移除 PR-01947 MSW handlers（试点按「零拆除税」预期收尾）
  - `8f7050964c` / `8a71fde629` F15 接真实接口 `lead-position-count.ts`（复制全部取选中币对带单仓位数）
  - `f65c14324b` 移除 `resolveCopyPositionMode` · `149f482d82` FollowParamsSelectTriangle 等交互补齐
  - 跟单单测 35/35 通过（clampLeverage 7 + useFollowParams 17 + before-follow 2 + followRateParams 6 + resolveIsFollowed 3）
- **2026-07-21 P0 人工 L2 像素并排走查完成**（三控件 + 确认弹窗，业务方确认）。
- **2026-07-21 G5 API 文档对账通过**（严格按 YApi Cat 1489 + 代码逐字段核对）：
  - 四参数提交映射（marginMode 0/1/2 · leverageMode 0/1 · customLeverageLevel · copyPositionMode 1/2/3）与 YApi 5710 一致
  - before_follow 四字段回填 nullable + isCopyPos→copyPositionMode 兼容（Q4）与 5713 一致
  - lead_position_count（5752）Req/Res 与代码一致
- **2026-07-21 需求外前端自判逻辑清除**（业务方确认）：
  - **交易员杠杆 KYC 错误码通道**（`FOLLOW_LEADER_LEVERAGE_KYC_CODE` + `isLeaderLeverageKycError` + 三表单 catch 分支 + `leaderLeverageKycFailed` 文案）→ 本需求不考虑该场景，全删；命中错误码回落平台通用错误通道
  - **Q3 有持仓禁改前端自判**（`useFollowParams` 的 `locked` + `FollowParamsFields`/三字段的 `disabled` + `marginModeLockedTips` 文案 + before_follow schema 的 `hasFollowPosition`）→ 禁改改由后端在提交时校验，前端不再自判，整条死链清除
  - 跟单单测同步收敛，改动文件零类型错误、零残留
- **2026-07-23 止盈止损/仓位风险单位口径对齐 online**（`badd923ff3`，`followRateParams.ts` 重排，详见 `03-api-contract.md` §3.2）：
  - **止盈/止损率**：UI 与 API 同用小数比例（0.15=15%），原样透传不再 ×100/÷100；输入上下限直用 `followSetting.stopProfitRateMin/Max`・`stopLossRateMin/Max`（缺省 0.01–4），placeholder 动态渲染（撤掉硬编码「1～400」）
  - **仓位风险**：UI 整数百分数（50=50%）↔ API 小数；`save_follow.positionRiskRate` 提交 ÷100 为小数字符串（50→"0.5"）；回填 `positionRiskToDisplay` 兼容 ≤1 小数与历史整数存量值
  - 函数重命名：`percentToApiRate→toOptionalApiRate`、`apiRateToPercentDisplay→apiRateToDisplay`、`apiRateBoundsToPercent→resolveRateBounds`；新增 `resolvePositionRiskBounds`/`positionRiskToDisplay`/`positionRiskToApiRate`/`positionRiskToApiString`
  - 跟单单测 **37/37** 通过（clampLeverage 7 + useFollowParams 16 + before-follow 2 + followRateParams 9 + resolveIsFollowed 3）
- **2026-08-26 生产发布归档**：确认 `feature/PR-01947` 已合入 `origin/online`；项目切为 `closed`，保留 feature 分支和全部 `docs_tdd` 历史，回收一次性编码 worktree。

## 历史未闭环项（不伪装为已验收）

> 以下为 2026-08-01 文档中记录的联调/QA 缺口。生产发布确认不等同于这些历史 gate 证据已补齐；后续若需追溯或修复，应在 `product/06-collaboration.md` 追加记录并按新变更处理。

| 优先级 | 事项 | 负责建议 | 文档 |
|--------|------|----------|------|
| **P0** | QA 53 条用例执行（现全「待执行」，撮合/资金/MQ 类须联调环境人工跑） | QA + 前端 | `product/14-self-test-cases.md` |
| P1 | DS 组件 3 处几何偏差评估（Select 圆角/高度/浮层描边，见 handoff T6） | 前端 + DS | `handoff-2026-07-14.md` T6 |
| P2 | Q8 读图（F15 已落码，仅余 Q8 待读） | 产品 + 前端 | 暂缓 |
| P2 | `07-figma-spec.md` 深色模式 / Select 选项行 / 390px 补读 | 设计/前端 | §12 待补列表 |
| P2 | 补拉 YApi 5752 原始 JSON（`_cat_list` 未登记、`yapi_api_5752.json` 缺失，代码已对齐整理稿，仅快照不全） | 前端 | `inbox/yapi/` |

## 文档地图

- **`agent/handoff-2026-07-14.md`** — **交接入口（AI 优先）**
- `agent/handoff-2026-07-13.md` — 历史摘要（G6 背景）
- `agent/context-summary.md` — AI 短摘要
- `evidence/ui-ux/2026-07-14/README.md` — Figma 读取证据
- `product/00-feature-inventory.md`
- `product/03-api-contract.md`
- `inbox/yapi/` — YApi Project 587 Cat 1489 原始 JSON + 整理稿
- `product/04-frontend-tasks.md`
- `product/06-collaboration.md`
- `product/07-figma-spec.md` — **Figma L2 基线（2026-07-14 · 智能比例 Tab）**
- `product/05-ui-and-interaction.md` — 智能比例 Tab 交互
- `engineering/development-rules.md`
- `agent/README.md`

## 公共规则

继承 `../../common/README.md`；开工读 `../../common/rules/rule-router.md`。
