# 03 — API 契约

## 0. 元信息

| 字段 | 值 |
|------|-----|
| 项目 | `PR-02233` |
| 契约来源 | 现有 Web services + 用户 2026-09-04 口径；新增字段/接口为 provisional，G5 与后端对账 |
| 契约版本 | PRD revision 670 / Web HEAD 2026-09-04 |
| 前端 service | `apps/web/src/services/api/login.ts`、`registerV2.ts`、`user.ts` |
| Mock 路线 | MSW 路线 B；`apps/web/src/mocks/handlers/verification.ts` |
| 环境策略 | 仅 development/test 注册；pre/prod 不启动 worker；业务代码无 mock 开关 |

## 1. 接口清单

| ID | Method | Path | 用途 | 策略 | 状态 |
|----|--------|------|------|------|------|
| A1 | POST | `/fe-ex-api/v6/user/login_in` | 提交登录凭据，返回 token、默认方式；拟扩展已绑定方式/cooldown | 复用 + MSW 模拟新增字段 | 待联调字段 |
| A2 | POST | `/fe-ex-api/user/confirm_login` | 按 email/phone/google 确认登录 | 直接复用 | 已有逻辑，待回归 |
| A3 | POST | `/fe-ex-api/v4/common/emailValidCode` | 发送邮箱验证码 | 直接复用；MSW 补 cooldown/error | 已有逻辑，专项回归已过 |
| A4 | POST | `/fe-ex-api/v4/common/smsValidCode` | 发送短信验证码 | 直接复用；MSW 补 cooldown/error | 已有逻辑，专项回归已过 |
| A5 | POST | `/fe-ex-api/v1/user/reg_email_chk_info` | 邮箱注册预校验 | 直接复用 | 已有逻辑，待回归 |
| A6 | POST | `/fe-ex-api/v1/user/reg_mobile_chk_info` | 手机注册预校验 | 直接复用 | 已有逻辑，待回归 |
| A7 | POST | `/fe-ex-api/v1/user/reg_email_confirm` | 邮箱注册验证码确认 | 直接复用 | 已有逻辑，待回归 |
| A8 | POST | `/fe-ex-api/v1/user/reg_mobile_confirm` | 手机注册验证码确认 | 直接复用 | 已有逻辑，待回归 |
| A9 | POST | 后端待定（若 A1 无法携带方法列表） | 获取登录可用验证方式/切换上下文 | 新增；MSW provisional | 未 ready |
| A10 | POST | 后端待定（若 A2/A3/A4 无法复用 token） | 切换验证渠道并返回 channel token | 新增；MSW provisional | 未 ready |
| A11 | POST | `/fe-ex-api/v4/common/emailValidCode` | 修改密码、绑定/修改手机时发送当前账户邮箱身份验证码 | 复用 path + provisional `operationType` | 待后端定 operationType |
| A12 | POST | `/fe-ex-api/user/password_update` | 修改密码提交双重身份验证码 | 复用 + provisional `emailCode` | 待后端定字段 |
| A13 | POST | `/fe-ex-api/user/mobile_bind_save`、`/mobile_update` | 绑定/修改手机时提交账户身份验证码；新手机号验证码仍沿用既有字段 | 复用 + provisional `emailCode` | 待后端定字段 |
| A14 | POST | `/fe-ex-api/user/email_bind_save_v4`、`/email_update` | 绑定/修改邮箱；新邮箱验证码留在表单，原账户身份验证码移入弹窗 | 直接复用既有字段 | 待回归 |

## 2. Provisional DTO 与 UI Model

```ts
export type VerificationMethodDTO = {
  type: '1' | '2' | '3' // existing VerifyType: GA=1, SMS=2, Email=3
  bound?: boolean
  maskedTarget?: string
  cooldownExpiresAt?: number // provisional: milliseconds since epoch
}

export type LoginVerificationDTO = {
  token: string
  type: '1' | '2' | '3'
  verifyMethods?: VerificationMethodDTO[] // optional for backward-compatible rollout
}

export type VerificationMethodView = {
  type: '1' | '2' | '3'
  maskedTarget?: string
  cooldownExpiresAt?: number
}

export type LoginVerificationContext = {
  token: string
  currentMethod: '1' | '2' | '3'
  boundMethods: VerificationMethodView[]
}
```

兼容原则：A1 未返回 `verifyMethods` 时只从现有 `type` 生成单项 `boundMethods`，隐藏切换入口，登录链路保持现状。

### 2.1 P2-B 账户安全 provisional 契约

```ts
export const PROVISIONAL_SECURITY_OPERATION_TYPES = {
  modifyPasswordEmail: 'PR02233_MODIFY_PASSWORD_EMAIL',
  bindPhoneIdentityEmail: 'PR02233_BIND_PHONE_IDENTITY_EMAIL',
  modifyPhoneIdentityEmail: 'PR02233_MODIFY_PHONE_IDENTITY_EMAIL',
} as const

type ProvisionalEmailIdentityFields = {
  emailCode?: string
}
```

以上三个 `operationType` 故意使用非生产数字的 `PR02233_*` 标识，避免被误认为后端最终值。业务代码仅声明真实候选请求形态，不包含 mock 分支；development/test 由 MSW 拦截。G5 对账时必须同时替换 operationType、提交字段名及对应 endpoint DTO。

## 3. 字段对账

| UI 字段 | mapper 取值 | 契约字段 | 映射类型 | 状态 |
|---------|-------------|---------|---------|------|
| `token` | `dto.token` | `token` | 同名直传 | 已有 |
| `currentMethod` | `verifyMethods` 存在时一律取 GA→邮箱→手机最高优先级；字段缺失时回退 `dto.type` | `verifyMethods[].type` / `type` | 跨来源统一 | provisional |
| `boundMethods[].type` | `verifyMethods[].type` 或 `[dto.type]` | `verifyMethods[].type` / `type` | 跨来源统一 | provisional |
| `boundMethods[].maskedTarget` | `method.maskedTarget ?? ''` | `verifyMethods[].maskedTarget` | 同名直传 | 待后端字段 |
| `boundMethods[].cooldownExpiresAtMs` | 校验毫秒；若返回秒数则在 mapper 转绝对毫秒 | `verifyMethods[].cooldownExpiresAt` 或错误 metadata | 同名转换 | 待后端字段 |

## 4. 错误 / 冷却契约

```ts
export type VerificationSendErrorDTO = {
  code: string
  data?: {
    remainingDisabledSeconds?: number
    cooldownExpiresAt?: number
    limitType?: 'ip' | 'country' | 'scene' | 'uid' | 'cooldown'
    showFormattedTime?: string
  }
}
```

| 分类 | 识别 | UI 行为 |
|------|------|---------|
| rate_limit | PR-02235 错误码或存在正数 cooldown metadata | toast 具体原因；转绝对 expiresAt；不再请求直到到期 |
| service_error | 已映射服务错误码 | toast；恢复 initial/resend；不倒计时 |
| network_error | 无业务 code 的网络异常 | toast；恢复 initial/resend |
| timeout | request timeout | toast；恢复 initial/resend |
| other | 其余业务异常 | 现有 error-code mapper；恢复可重试态，除非后端明确给 cooldown |

## 5. MSW 场景矩阵

| 场景 | Mock 触发 | 响应 / 断言 |
|------|-----------|-------------|
| `single-email` | scenario header/query | A1 仅 email；隐藏切换 |
| `empty-methods` | scenario header/query | A1 空集合；从 type 构造单一当前方式并隐藏切换入口 |
| `legacy-type-only` | scenario header/query | A1 不含新字段；兼容旧接口，仅保留当前方式 |
| `ga-email-sms` | scenario header/query | A1 三方式乱序返回；mapper 输出 GA→email→sms，GA 默认 |
| `email-sms` | scenario header/query | 默认 email，可切 sms；掩码存在 |
| `send-success` | A3/A4 | 发送成功，进入 60s sent |
| `rate-limit-30` | A3/A4 | 失败 + remainingDisabledSeconds=30；不重复请求 |
| `rate-limit-expiry` | A1/A9 | 返回未来 expiresAt；刷新后恢复剩余时间 |
| `service-error` | A3/A4 | 业务失败，无 cooldown；回可重试 |
| `network-error` | A3/A4 | networkError；回可重试 |
| `unauthorized` | A1 | HTTP 401；关闭/重启认证流程 |
| `invalid-contract` | test only | schema parse 失败，阻止 fixture 漂移 |
| `account-identity-email` | A11 | 接受显式 `PR02233_*` operationType，返回发码成功 |
| `account-security-submit` | A12/A13/A14 | 修改密码/邮箱/手机提交成功；验证 UI 与 mock 解耦 |

## 6.1 MSW 路线 B 清单

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | handler 覆盖 normal / empty / error / unauthorized / edge 场景 | 已实现或按端点标记 not-applicable；详见 `agent/msw-manifest.json` |
| 2 | service/hook/mapper/组件无 `USE_MOCK` / mock import | 已验证；mock 仅在 `src/mocks/**` |
| 3 | handler response 通过同一 schema 契约测试 | 已实现；含合法乱序 fixture 与 invalid-contract 反例 |
| 4 | `useMockWorker()` 仅 development + 显式环境变量接入；production 永不 start | 已实现 |
| 5 | 真实接口 ready 后按 handler 粒度停用，UI 代码零改动 | 待 G5 |

本地启用：先执行 `pnpm --filter @fameex/web msw:init` 生成被 Git 忽略的标准 worker 文件，再以 `NEXT_PUBLIC_MSW_ENABLED=true` 启动 dev；可用 `NEXT_PUBLIC_MSW_VERIFICATION_SCENARIO=<scenario>` 或请求 query/header 选择场景。`proxy.ts` 已排除 `/mockServiceWorker.js`，避免语言中间件产生 Service Worker 不允许的重定向。

## 7. 文案契约

| 文案 ID | 组件 | 来源 | zh-CN key | 默认中文（逐字） | 动态变量 |
|---------|------|------|-----------|------------------|----------|
| `copy.register.emailGuide` | VerifyInputs | PRD 注册引导 | `codeVerify:register-by-mail-guide` | 没收到验证码？尝试邮箱注册 | 无 |
| `copy.switch.title` | MethodDialog | PRD 登录交互 | `codeVerify:switch.title` | 切换验证方式 | 无 |
| `copy.switch.subtitle` | MethodDialog | PRD 登录交互 | `codeVerify:switch.subtitle` | 选择一种已绑定的验证方式完成登录 | 无 |
| `copy.switch.gaDesc` | MethodDialog | PRD 登录交互 | `codeVerify:switch.ga-description` | 30秒自动更新，无需发送 | 无 |
| `copy.switch.current` | MethodDialog | PRD 登录交互 | `codeVerify:switch.current` | 当前 | 无 |
| `copy.help.title` | NoCodeHelpDialog | PRD 未收到引导 | `codeVerify:help.title` | 没有收到验证码？ | 无 |
| `copy.help.known` | VerificationHelpDialog | PRD 未收到引导 | `codeVerify:help.acknowledge` | 已知晓 | 无 |
| `copy.send.initial` | RequestControl | PRD 四态 | `codeVerify:send` | 获取验证码 | 无 |
| `copy.send.sent` | RequestControl | PRD 四态 | `codeVerify:sent` | 验证码已发送 | 无 |
| `copy.send.resend` | RequestControl | PRD 四态 | `codeVerify:resend-new` | 重新发送 | 无 |
| `copy.send.tooltip` | VerifyInputs | PRD 四态 | `codeVerify:resend-tooltip` | {{count}}秒后可重新发送验证码，有效期为10分钟 | `count:number` |

邮箱/手机帮助正文逐字源见 `05-ui-and-interaction.md`；实现时拆成 intro/list locale key 并做 literal table test。

## 8. 待确认 / 契约差异

| # | 接口 / 字段 | 现状 | 期望 | 状态 |
|---|-------------|------|------|------|
| 1 | A1 `verifyMethods` | 当前仅 `type/token` | 返回已绑定方法、掩码和可选 cooldown | MSW provisional，G5 对账 |
| 2 | A9/A10 path | 未给正式接口 | 若现有接口不能覆盖则新增 | MSW provisional，G5 定稿 |
| 3 | cooldown 单位 | 已有部分错误返回 `remainingDisabledSeconds` | 统一可恢复的绝对截止时间，或由 mapper 转换 | G5 对账 |
| 4 | 限频错误码集合 | PRD 指向 PR-02235 | 后端提供 code→limitType/cooldown | G5 对账 |
| 5 | A11 账户邮箱身份发码 operationType | 仅有旧枚举，修改密码/绑定或修改手机无对应邮箱值 | 后端给出三场景正式值，或确认可共用一个账户身份场景值 | MSW provisional，G5 必须销账 |
| 6 | A12/A13 邮箱身份验证码提交字段 | 现有 DTO 缺少字段 | 暂定 `emailCode`；后端确认字段名、是否加密及错误码 | MSW provisional，G5 必须销账 |
| 7 | 修改手机旧手机码字段 | 现有 `authenticationCode` 必填 | 当优先级选中 SMS 才传；后端确认改为可选是否兼容 | G5 对账 |

## 9. 契约变更记录

| 日期 | 版本 | 变更 | 前端动作 |
|------|------|------|----------|
| 2026-09-04 | provisional-1 | 从整体 pending 改为已有 API 复用 + 新增/变更 MSW | 建 A1-A10 清单、兼容 mapper 和场景矩阵 |
| 2026-09-04 | provisional-2 | 负责人确认 P2-B 可先用临时契约；后台后续统一对接 | 建 A11-A14、显式 `PR02233_*` operationType、`emailCode` 字段及 MSW handler；列入 G5 强制销账 |
