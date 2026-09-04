<!-- template-version: 3 -->
<!-- template-effective-since: 2026-07-25 -->

# Technical Design — PR-02233 【用户端】安全验证校验交互优化

## 复用盘点

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 | 不复用原因 |
|------|-------------------|------|----------|------------|
| 页面验证码 | `components/VerifyInputs/**` | 登录/注册现用，保留页面形态 | 扩展为场景感知；复用 `CodeInput` | — |
| 旧页面弹窗 | `components/CodeVerifyDialog/**` | 单验证码旧入口仍多处使用 | 迁移适配，不继续增加业务分支 | — |
| 新安全弹窗 | `components/CodeVerifyModal/**` | 已有多方式、独立 countdown 雏形 | 修正 selector/状态逻辑后作为非登录注册基座 | — |
| 倒计时 | `useCountdown`、`CodeVerifyModal/countdown.ts` | 一个是单 channel、一个是双 channel 纯函数 | 抽共享 channel 状态机，保留 hook 适配 | — |
| API | `services/api/login.ts`、`registerV2.ts`、`user.ts` | 登录、注册、发邮箱/短信、确认多数可复用 | 直接复用；仅新增/变更字段建 schema/mapper/MSW | — |
| 状态 | `VerifyInputs/store.ts` | 已持有 step、账号、token、当前方式 | 扩展 verification context；单写入口仍为 Zustand store | — |
| 埋点 | `posthog-js` 既有事件 | 基础能力可复用 | 新增统一 typed helper，避免散落 payload | — |
| MSW | `src/mocks/{browser,useMockWorker}.ts` | 脚手架存在但未接 Providers | dev-only 接回并注册本项目 handler | — |

## 单一事实源与所有权

| 事实 / 状态 / 规则 | 权威来源 / 唯一写入口 | 消费者与读取 / 派生方式 | 副本 | 同步 / 失效 / 验证 |
|--------------------|-----------------------|--------------------------|------|--------------------|
| 当前流程 step、账号、token、当前方式 | `useVerifyInputsStore` action | Login/Register/VerifyInputs selector | 否 | store unit tests |
| 已绑定验证方式 | 登录 bootstrap DTO 经 mapper 的 `boundMethods` | resolver + selector dialog | 否 | schema/mapper contract tests |
| 验证方式优先级 | `resolveVerificationMethods(scene, boundMethods)` | Login + security dialogs | 否 | table-driven unit tests |
| 邮箱/手机 cooldown | `channel -> expiresAt` 状态；后端时间优先 | request control 派生 remainingSeconds | session mirror 可选 | key 含 scene/token/channel；过期清除；fake timers + refresh test |
| 输入验证码 | 当前页面/弹窗 local state | submit payload | 否 | switch 不串值测试 |
| 发送状态 | channel request state machine | 按钮文案/disabled/tooltip | 否 | transition unit tests |
| 文案 | zh-CN locale key | 共享组件 `useT` | 否 | literal tests |

## 数据流与分层契约

| Feature / Component | React Query Hook | API Service | DTO / Mapper | UI Model | State Owner | Test |
|---------------------|------------------|-------------|--------------|----------|-------------|------|
| 登录初始验证 | `useSubmitLoginCredentials` | `/v6/user/login_in` | `LoginVerificationDTO -> LoginVerificationContext` | token/current/boundMethods | Zustand | real fixture + MSW |
| 邮箱发送 | `useGetEmailValidCode` | 既有用户验证码接口 | existing response + error mapper | cooldown result | shared request state | unit + MSW |
| 短信发送 | `useGetSmsValidCode` | 既有用户验证码接口 | existing response + error mapper | cooldown result | shared request state | unit + MSW |
| 登录确认 | `useConfirmLogin` | `/user/confirm_login` | existing DTO | login result | mutation | regression |
| 冷却恢复 | provisional query/bootstrap field | 待后端定稿 | schema -> expiresAtMs | channel cooldown | store/session | MSW refresh test |

## 状态 / 文案 / class / action 映射

| 场景 | 输入 key | 输出 | 实现位置 |
|------|----------|------|----------|
| 方法排序 | scene + bound methods | GA/email/sms 有序数组 | `verificationMethods.ts` |
| 发送按钮 | idle/loading/sent/resend | 文案、disabled、tooltip、action | `verificationRequestState.ts` |
| 错误 | error code + response metadata | rate-limit/service/network/timeout/other + cooldown | `verificationError.ts` |
| 帮助默认 Tab | current methods | email 或 sms | `verificationHelp.ts` |
| 埋点 | action + state | PRD 规定 payload | `verificationAnalytics.ts` |

## 方案

1. **先解耦纯逻辑**：方法优先级、掩码、help 默认 Tab、发送状态转移和错误分类写成纯函数并表驱动测试。
2. **扩展登录 context**：兼容现有 `{type, token}`；新增字段缺失时保持现状，不展示切换；MSW 场景返回多种已绑定方式用于开发。
3. **登录选择器**：`VerifyInputs` 仅登录态显示；选择时更新 current method，按需触发邮箱/短信发送；GA 不发送。关闭不提交选择。
4. **注册差异**：注册态不展示方法选择器；手机注册入口文案回邮箱注册，调用 reset 并显式清空验证码。
5. **共享发送控制**：以绝对时间 `expiresAtMs` 而非递减数字作为事实源；UI 每秒派生剩余秒数。邮箱/手机分别持有，避免切换重置。
6. **非登录注册迁移**：以 `CodeVerifyModal` 为入口，通过 scene policy 决定单/双方式及是否允许切换；业务变更 mutation 只在身份验证成功后执行。
7. **MSW**：业务 service 无 mock 分支。handler 模拟多绑定方式、限频 cooldown、服务错误、刷新恢复；生产不注册 worker。

## 风险控制

- 登录/资金/权限类均为 V2；不只做快照测试。
- 新字段兼容缺失，避免真实环境在后端未发布时中断登录。
- 旧入口按批迁移；未迁移入口不删除旧组件。
- PRD 验收表与详情冲突已由人工口径覆盖，见 `06-collaboration.md`。
