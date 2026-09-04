<!-- template-version: 3 -->
<!-- template-effective-since: 2026-09-01 -->

# Feature Inventory — `PR-02233 【用户端】安全验证校验交互优化`

| 字段 | 值 |
|------|-----|
| 工单 | PR-02233 |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/docx/QaBEditNroySaGxmywFl8CwXg6d（revision 670） |
| 视觉来源 | PRD 内嵌 Web/App 截图与原型链接；未提供独立 Figma node |
| 清单维护人 | Agent |
| G2 确认人 & 日期 | Aven / 2026-09-04（API 口径：已有逻辑优先复用，少量新增/变更 API 走 MSW） |
| 责任模块目录 | `apps/web/src/components/VerifyInputs/**`、`apps/web/src/components/CodeVerifyDialog/**`、`apps/web/src/components/CodeVerifyModal/**`、`apps/web/src/apps/{Login,Register,ResetPassword,VerifyEmail,VerifyPhone,VerifyAssetsPassword,DeleteAccount,AddressManagement,Balance,Otc,Sdk,User}/**`、`apps/web/src/services/api/{login,registerV2,user}.ts`、`apps/web/src/mocks/**`、`apps/web/src/i18n/locales/zh-CN/**` |
| visualFidelity | standard |

## 功能清单

| ID | PRD 来源锚点 | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |
|----|--------------|---------|---------|------------|-------|-------------|------|------|------------|
| F01 | `PRD-IMG-001`、`PRD-IMG-002` | 切换注册方式引导 | Web 注册验证码页将入口改为“没收到验证码？尝试邮箱注册”，点击回注册第一步且清空验证码 | Web 注册 | ❌（PRD 截图） | 页面态 | 做 | Aven 2026-09-04 | `VerifyInputs` / Register |
| F02 | `PRD-IMG-003`、`PRD-IMG-004` | 切换登录校验引导 | Web 登录支持真实验证方式切换弹窗；仅展示已绑定方式和当前态 | Web 登录 | ❌（PRD 截图） | 页面 + 弹窗 | 做 | Aven 2026-09-04 | `VerifyInputs` / Login |
| F03 | `PRD-TABLE-002` | 验证方式优先级 | 注册单一方式；登录 GA>邮箱>手机；敏感场景按规则选一/双重方式 | Web 全验证链路 | ❌ | 共享规则 | 做 | Aven 2026-09-04 | 共享 resolver / tests |
| F04 | `PRD-TABLE-003`、`PRD-IMG-005`—`PRD-IMG-025` | Web 校验交互优化 | 登录/注册保留页面式；其余已列 Web 场景统一到安全验证弹窗，并拆分新目标验证与账户身份验证 | Web 19 类场景中的非登录注册入口 | ❌（PRD 现状图） | 跨模块迁移；按 P2 批次接入 | 做 | Aven 2026-09-04 | `CodeVerifyModal` + 各业务入口 |
| F05 | `PRD-IMG-026`、`PRD-IMG-027` | 没有收到验证码引导 | 每场景仅一个入口；弹窗固定邮箱/手机双 Tab、默认当前渠道、客服和“已知晓”操作 | Web 页面/弹窗共用 | ❌（PRD 截图） | 共享弹窗 | 做 | Aven 2026-09-04 | 新共享组件 + zh-CN 文案 |
| F06 | `PRD-TABLE-004` | 验证码请求倒计时优化 | 获取/发送中/已发送倒计时/重新发送四态；邮箱/手机独立倒计时；限频失败冷却、服务失败可重试 | Web 全验证码发送控件 | ❌ | 共享状态机 | 做 | Aven 2026-09-04 | shared hook/control + MSW |
| F07 | `PRD-TABLE-005` | 埋点 | 增加曝光、发送、限频、切换、帮助、提交和结果事件 | Web 全验证链路 | N/A | 共享 analytics | 做 | Aven 2026-09-04 | posthog payload tests |
| F08 | `PRD-TABLE-001`、`PRD-EMBED-001`—`PRD-EMBED-019` | 平台范围与引用资料 | App iOS/Android 同类改动及短信快捷填充修复 | App 仓 | ❌ | 跨客户端；非本仓 | 不做 | Aven 2026-09-04 | 交由 App owner；Web 回归不得受影响 |

## 原子需求清单

| 需求 ID | 功能 ID | PRD 原子条目 | 所需证据类型 |
|---------|---------|--------------|----------------|
| R-F01-01 | F01 | 注册短信验证码页展示“没收到验证码？尝试邮箱注册”，点击回注册第一步并清空验证码 | copy-literal, browser-interaction |
| R-F01-02 | F01 | 注册仅使用用户本次选择的邮箱或手机，不出现 GA | pure-logic, browser-interaction |
| R-F02-01 | F02 | 登录仅在至少两种已绑定方式时展示切换入口 | pure-logic, component-dom |
| R-F02-02 | F02 | 弹窗仅列已绑定方式，顺序 GA→邮箱→手机，含脱敏说明和“当前”标记 | pure-logic, component-dom, visual |
| R-F02-03 | F02 | 选择方式后关闭弹窗并切换输入页；关闭/遮罩不改变当前方式 | browser-interaction |
| R-F02-04 | F02 | 登录默认取 GA→邮箱→手机的最高优先级方式 | pure-logic, api-contract |
| R-F03-01 | F03 | 共享 resolver 对登录、注册、强制双校验及其他敏感操作输出正确方式集合 | pure-logic |
| R-F04-01 | F04 | 登录/注册保持页面式，其余本仓已列验证码场景逐步统一复用安全验证弹窗 | component-dom, browser-interaction |
| R-F04-02 | F04 | 修改/绑定邮箱手机时，新目标所有权在表单验证，账户身份在提交后弹窗验证 | pure-logic, browser-interaction, api-contract |
| R-F04-03 | F04 | 账户身份校验取消/失败时业务变更不生效且可重试 | browser-interaction |
| R-F05-01 | F05 | 一个验证场景只显示一个“没有收到验证码？”入口 | component-dom |
| R-F05-02 | F05 | 帮助弹窗始终有邮箱/手机 Tab，默认当前请求渠道，双渠道默认邮箱 | pure-logic, component-dom |
| R-F05-03 | F05 | 邮箱/手机排查文案逐字符合 PRD；切 Tab 不修改底层验证码表单 | copy-literal, browser-interaction |
| R-F05-04 | F05 | 客服 icon 打开客服，“已知晓”关闭弹窗 | browser-interaction |
| R-F06-01 | F06 | 发送控件实现 initial/loading/sent/resend 四态及对应可点击性 | pure-logic, component-dom |
| R-F06-02 | F06 | Web 已发送态 tooltip 动态展示“{n}秒后可重新发送验证码，有效期为10分钟” | copy-literal, browser-interaction |
| R-F06-03 | F06 | 邮箱和手机倒计时独立，切换后保持原倒计时 | pure-logic, browser-interaction |
| R-F06-04 | F06 | 限频错误采用返回冷却时间、前端拦截重复请求；服务/网络错误回到可重试态 | api-contract, browser-interaction |
| R-F06-05 | F06 | 刷新/重入按后端冷却截止时间恢复，不以刷新绕过限频 | api-contract, browser-interaction |
| R-F07-01 | F07 | 7 类事件按 PRD 名称、时机和字段上报 | payload-contract, browser-interaction |

## 验收标准对照

| 验收项 | 对应 ID | 状态 |
|--------|---------|------|
| 登录、注册全链路及 GA/验证码下发回归 | F01、F02、F03 | ☐ |
| Web 注册引导文案与回退行为 | F01 | ☐ |
| 登录优先级、绑定方式过滤和切换弹窗 | F02、F03 | ☐ |
| 非登录注册场景弹窗化、修改/绑定表单拆分 | F04 | ☐（按接入批次） |
| 没收到验证码入口、双 Tab、文案和客服操作 | F05 | ☐ |
| 四态、Tooltip、独立倒计时、限频/异常/恢复 | F06 | ☐ |
| 埋点 payload | F07 | ☐ |
| App 端行为 | F08 | 由 App 仓验收，不纳入本仓完成率 |

## Figma 未覆盖但 PRD 要求

| ID | 说明 | 本期是否做 |
|----|------|-----------|
| F06 | 限频类错误的 cooldown、刷新恢复和服务异常分支无独立视觉稿 | 是，按 PRD 状态表和现有 token 实现 |
| F07 | 埋点无视觉稿 | 是，按 PRD payload 表实现 |
| F08 | App 快捷填充、防重复和点击 Tooltip | 否，非本仓 |

## Scope 裁剪记录

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| App iOS/Android 页面、弹窗、短信快捷填充 | 不在 `@fameex/web` 仓实施；移交 App owner | Aven | 2026-09-04 | App 验收不计入 Web G6/G7；保留跨端回归依赖 |
| 后台验证码查询/第三方通道策略 | 属 PR-02189 / PR-02235 或后端范围，不在本需求 Web 实现 | PRD | 2026-09-04 | 本项目只消费统一错误/cooldown 契约 |

## TDD / PRD 冲突

| 项 | PRD | TDD | 结论 |
|----|-----|-----|------|
| 登录切换入口 | 详情 §“切换登录校验引导”要求 App 新增、Web 修复；验收表旧行写 Web 移除/App 不变 | 用户 2026-09-04 明确可继续推进并沿用已确认 scope | 以详情章节和 2026-09-04 人工确认口径为准：Web 实现真实切换；旧验收行废弃 |
| API 可用性 | 原工作项记为整体 pending | 用户确认“大部分 API 用已有逻辑，少量更新/新增 API 走 MSW” | 改为 mock-required，不再整体阻塞 |

## PRD 未完全可读内容

| 类型 | 位置 | 影响 | 处理方式 | 状态 |
|------|------|------|----------|------|
| Figma 原始 node | PRD 仅给原型链接与截图 | 无法执行 Figma MCP 像素级取值 | 使用 PRD 本地截图 + 现有 design token，visualFidelity=standard | 已处理 |
| 引用文档/会议 | `PRD-EMBED-001`—`PRD-EMBED-019` | 用于背景、既有方案和评审记录，不替代本 PRD 范围 | 已读取导出文本摘要并作为 informative evidence | 已处理 |

> 富媒体逐项事实源：`agent/prd-source-manifest.json`。
