<!-- template-version: 3 -->
<!-- template-effective-since: 2026-09-01 -->

# Frontend Tasks — PR-02233 【用户端】安全验证校验交互优化

## 实施批次

- **P0 基座**：共享方法 resolver、验证码请求状态机、帮助弹窗、MSW 契约与测试。
- **P1 登录/注册**：优先交付 Web 登录真实切换和注册引导，形成可独立提测闭环。
- **P2 非登录注册场景**：以共享 `CodeVerifyModal` 为基座，按资金/账户安全/其他场景分批迁移。
- **P3 观测与总回归**：统一埋点、全场景 Browser/视觉/异常矩阵。

## 任务清单

| ID | 功能 ID | 原子需求 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|-------------|----------|------|------|----------|
| T00 | F01-F08 | — | revision 670；全部富媒体 sourceId | 完成 PRD intake、范围裁决、API/MSW 口径和本地媒体归档 | 已落 | `agent/prd-source-manifest.json`、`00-feature-inventory.md` |
| T01 | F01 | R-F01-01 | `PRD-IMG-001`、`PRD-IMG-002` | 注册验证码页替换引导文案；点击回第一步并清空验证码 | 已落 | literal + Browser：`verify→account`，`12345→空` |
| T02 | F01 | R-F01-02 | `PRD-TABLE-002` | 锁定注册为所选邮箱/手机单一验证，GA 不参与 | 已落 | resolver unit + Browser 截图 |
| T03 | F01 | — | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 已落 | manifest lifecycle=`mock-active`；6 handler tests |
| T21 | F02 | R-F02-01 | `PRD-IMG-003`、`PRD-IMG-004` | 根据已绑定方式数量控制登录切换入口 | 已落 | unit/component SSR + 多方式 Browser |
| T04 | F02 | R-F02-02 | `PRD-IMG-004` | 实现登录验证方式选择弹窗、排序、脱敏说明与当前标记 | 已落 | component SSR + `p1-method-dialog.png` |
| T05 | F02 | R-F02-03 | `PRD-IMG-004` | 完成选择/关闭/遮罩交互与输入页切换 | 实现完成，待关闭路径 Browser | 选择手机及输入切换已过；X/遮罩待补 |
| T06 | F02 | R-F02-04 | `PRD-TABLE-002` | 接入/模拟登录已绑定方式契约，默认选择最高优先级 | 已落 | schema + mapper + MSW contract + unit |
| T07 | F03 | R-F03-01 | `PRD-TABLE-002` | 抽取验证方式优先级/场景选择 resolver 并覆盖矩阵测试 | 已落 | 登录 8 项 + 非登录 6 项 table/unit tests |
| T08 | F04 | R-F04-01 | `PRD-TABLE-003`、`PRD-IMG-005`—`PRD-IMG-021` | 盘点 19 类 Web 场景并分批接入共享安全验证弹窗 | 部分完成 | P2-A：提币/OTC/地址/白名单；P2-B：修改密码及绑定/修改邮箱手机已接；待 Browser 及其余入口 |
| T09 | F04 | R-F04-02 | `PRD-IMG-022`—`PRD-IMG-025` | 修改/绑定邮箱手机拆分新目标验证与账户身份验证 | 实现完成，待契约/Browser | 新目标验证码留表单、账户身份移弹窗；A11-A14 provisional + MSW，G5 后台对账 |
| T10 | F04 | R-F04-03 | `PRD-IMG-022`—`PRD-IMG-025` | 确保弹窗取消/失败不提交业务变更且可重试 | 实现完成，待 Browser | 共享弹窗仅成功后关闭；失败保留并标错；取消不调用 mutation |
| T11 | F05 | R-F05-01 | `PRD-IMG-026`、`PRD-IMG-027` | 建共享单入口规则并接入页面/弹窗 | 部分完成 | 登录/注册及 P2-A 共享弹窗已接；其余非登录场景待迁移 |
| T12 | F05 | R-F05-02 | `PRD-IMG-026`、`PRD-IMG-027` | 实现固定双 Tab 帮助弹窗及默认 Tab resolver | 已落 | 双 Tab + 默认手机渠道 Browser 已过 |
| T13 | F05 | R-F05-03 | `PRD-IMG-026`、`PRD-IMG-027` | 落 zh-CN 逐字文案并保证切 Tab 不改表单 | 已落 | literal tests + Browser 文案已过 |
| T14 | F05 | R-F05-04 | `PRD-IMG-026`、`PRD-IMG-027` | 接客服入口和“已知晓”关闭 | 实现完成，待客服 Browser | `wakeUpYSF` + close 已接；客服回调待点验 |
| T15 | F06 | R-F06-01 | `PRD-TABLE-004` | 实现验证码发送四态共享状态机/控件 | 部分完成 | VerifyInputs 与 CodeVerifyModal 已覆盖发送中/倒计时/重发；CodeVerifyDialog 待收敛 |
| T16 | F06 | R-F06-02 | `PRD-TABLE-004` | 实现 Web 倒计时 tooltip 与动态文案 | 已落 | 登录 literal + Browser Tooltip；P2-A 弹窗同规则待 Browser |
| T17 | F06 | R-F06-03 | `PRD-TABLE-004` | 将邮箱/手机倒计时按 channel 独立持有，切换不重置 | 已落 | 登录 Browser：邮箱 `58s→55s`；P2-A 两 channel 独立 state + unit |
| T18 | F06 | R-F06-04 | `PRD-TABLE-004` | 接入限频/服务异常 mapper；MSW 覆盖冷却、网络和服务失败 | 部分完成 | 既有 mapper + MSW 场景/contract tests 已落；Browser 待补 |
| T19 | F06 | R-F06-05 | `PRD-TABLE-004` | 依据后端 expiry 恢复冷却；MSW 模拟刷新/重入 | 待办 | MSW contract + Browser |
| T20 | F07 | R-F07-01 | `PRD-TABLE-005` | 接入 7 类 posthog 事件并校验 payload | 待办 | payload tests |

## 富媒体追踪

| Feature | 已追踪 sourceId |
|---------|------------------|
| F01 | `PRD-IMG-001`、`PRD-IMG-002` |
| F02 | `PRD-IMG-003`、`PRD-IMG-004` |
| F03 | `PRD-TABLE-002` |
| F04 | `PRD-TABLE-003`、`PRD-IMG-005`、`PRD-IMG-006`、`PRD-IMG-007`、`PRD-IMG-008`、`PRD-IMG-009`、`PRD-IMG-010`、`PRD-IMG-011`、`PRD-IMG-012`、`PRD-IMG-013`、`PRD-IMG-014`、`PRD-IMG-015`、`PRD-IMG-016`、`PRD-IMG-017`、`PRD-IMG-018`、`PRD-IMG-019`、`PRD-IMG-020`、`PRD-IMG-021`、`PRD-IMG-022`、`PRD-IMG-023`、`PRD-IMG-024`、`PRD-IMG-025` |
| F05 | `PRD-IMG-026`、`PRD-IMG-027` |
| F06 | `PRD-TABLE-004` |
| F07 | `PRD-TABLE-005` |
| F08 | `PRD-TABLE-001`、`PRD-EMBED-001`、`PRD-EMBED-002`、`PRD-EMBED-003`、`PRD-EMBED-004`、`PRD-EMBED-005`、`PRD-EMBED-006`、`PRD-EMBED-007`、`PRD-EMBED-008`、`PRD-EMBED-009`、`PRD-EMBED-010`、`PRD-EMBED-011`、`PRD-EMBED-012`、`PRD-EMBED-013`、`PRD-EMBED-014`、`PRD-EMBED-015`、`PRD-EMBED-016`、`PRD-EMBED-017`、`PRD-EMBED-018`、`PRD-EMBED-019` |

## 实现检查

- [x] 状态/文案/class/action 映射已收敛到 map/resolver。
- [ ] 既有 `VerifyInputs`、`CodeVerifyDialog`、`CodeVerifyModal`、`useCountdown` 优先复用，避免第二套验证码体系。
- [ ] service/hook 只写真实请求形态；mock 仅在 `src/mocks/handlers/verification.ts`。
- [ ] 新增/变更 DTO 经 schema/mapper，真实契约到位后逐字段对账。
- [ ] loading / error / disabled / rate-limit / refresh-restore / 单绑定方式完整。
- [ ] 资金与账号安全场景迁移逐入口验收，不以共享组件单测替代入口证据。
