# PR-02233 Web 安全验证交互——前后端对接清单

> 状态：待后端确认
> 范围：仅 Web；App 不在本 PR 实现范围
> 关联：PR-02189（冷却恢复）、PR-02235（限频类型/错误码）
> 原则：本文中的新字段名和枚举值均为**前端建议稿**，不是已确认接口契约；后端确认前，前端不得按本文臆造字段。

## 1. 本次需要后端支持的能力

1. 登录二次验证时返回用户**已绑定的验证方式全集**，前端按 `GA > 邮箱 > 手机` 选择默认方式并展示可切换列表。
2. 返回邮箱、手机号的**脱敏展示值**，前端不根据其他字段拼接或推断绑定信息。
3. 明确同一个登录验证 token 是否可以在 GA、邮箱、手机之间切换使用。
4. 发送邮箱/短信验证码成功后返回可恢复的**绝对冷却截止时间**。
5. 触发限频时返回稳定的限频类型、错误码和冷却截止时间，使前端能区分 IP、UID、60 秒间隔限制。

## 2. 现有接口基线

### 2.1 登录凭证校验

- `POST /fe-ex-api/v6/user/login_in`
- 当前 Web 读取的响应：

```ts
interface CurrentLoginResponse {
  type: '1' | '2' | '3' // 1=GA, 2=手机, 3=邮箱
  token: string
}
```

当前响应只能表达一个验证方式，无法满足“展示全部已绑定方式并允许切换”。

### 2.2 登录二次验证

- `POST /fe-ex-api/user/confirm_login`
- 当前请求：

```ts
interface CurrentConfirmLoginRequest {
  authCode: string
  token: string
  type: 'google' | 'email' | 'phone'
  singPassCode?: string
  hasGoogleAuthCode?: string
}
```

### 2.3 发送验证码

- 邮箱：`POST /fe-ex-api/v4/common/emailValidCode`
- 手机：`POST /fe-ex-api/v4/common/smsValidCode`
- 现有错误数据中 Web 已使用：

```ts
interface CurrentSendCodeErrorData {
  remainingDisabledSeconds?: number
  showFormattedTime?: string
}
```

现有秒数可用于当前页面倒计时，但无法可靠支持刷新/离开重进后的恢复。

## 3. 登录验证方式契约

### 3.1 建议响应结构

建议在 `login_in` 响应中保留现有 `type`、`token`，增量返回以下结构；最终字段名以后端确认为准：

```ts
type VerificationMethod = 'google' | 'email' | 'phone'

interface LoginVerificationMethod {
  type: VerificationMethod
  maskedTarget?: string // email/phone 必填；google 不返回或返回 null
  countryCode?: string // phone 可选；仅用于展示时由后端明确是否需要
  resendAvailableAt?: number // Unix 毫秒时间戳；仅 email/phone
}

interface ProposedLoginResponse {
  type: '1' | '2' | '3' // 兼容现有 Web
  token: string
  verificationMethods: LoginVerificationMethod[]
  serverTime: number // Unix 毫秒时间戳，用于消除客户端时钟偏差
}
```

### 3.2 字段语义要求

| 字段 | 必需性 | 前端用途 | 约束 |
|---|---:|---|---|
| `verificationMethods` | 必需 | 决定是否展示“切换验证方式”及列表内容 | 只返回已绑定且当前登录流程可用的方式；不得混入未绑定方式 |
| `type` | 兼容期必需 | 兼容旧版客户端 | 新 Web 默认方式由方式全集按优先级计算，不依赖该字段推断绑定全集 |
| `token` | 必需 | 发送验证码、确认登录 | 需明确是否支持在全部返回方式间共用 |
| `maskedTarget` | 邮箱/手机必需 | 弹窗和校验区展示 | 由后端提供最终脱敏文本；前端不从账号或其他资料推断 |
| `resendAvailableAt` | 有冷却时必需 | 刷新/重进恢复倒计时 | 绝对时间，Unix 毫秒；没有冷却可省略或返回 `null` |
| `serverTime` | 建议必需 | 校正客户端时间差 | 与 `resendAvailableAt` 使用相同单位和时区语义 |

### 3.3 前端确定性规则

后端只需返回“可用方式全集”，前端负责排序和选择：

- 单一方式：直接使用，不展示切换入口。
- 多种方式：默认 `google > email > phone`。
- 切换弹窗只展示 `verificationMethods` 中的方式。
- 关闭弹窗不改变当前方式。

### 3.4 必须确认的问题

- [ ] 同一个 `token` 是否允许使用任一 `verificationMethods` 调用 `confirm_login`？
- [ ] 切换到 email/phone 后，现有发送验证码接口是否仍使用该 `token`？
- [ ] 如果不同方式需要不同 token，后端是否在每个方式对象中返回 `token`，还是提供独立的“切换验证方式”接口？
- [ ] `type` 与 `verificationMethods` 不一致时，以哪个字段为准？建议后端保证 `type` 必然属于方式全集。
- [ ] 邮箱和手机号脱敏格式由哪个端统一？建议后端直接返回 `maskedTarget`，Web/App 不各自实现脱敏规则。

## 4. 验证码冷却恢复契约

### 4.1 发送成功响应

邮箱、短信发送成功后需要返回绝对冷却截止时间：

```ts
interface ProposedSendCodeResponse {
  resendAvailableAt: number // Unix 毫秒时间戳
  serverTime: number // Unix 毫秒时间戳
}
```

前端剩余时间计算：

```text
remainingSeconds = max(0, ceil((resendAvailableAt - correctedNow) / 1000))
```

要求：

- 以后端时间为准，不能只返回固定 `60` 秒让前端自行起算。
- 同一验证 token 下，邮箱与手机必须分别维护冷却时间，互不覆盖。
- 再次进入登录验证流程时，`login_in.verificationMethods[*].resendAvailableAt` 应返回当前仍有效的冷却状态。
- GA 无发送动作，不返回冷却字段。

## 5. 限频错误契约

### 5.1 建议错误结构

```ts
type RateLimitType = 'ip' | 'uid' | 'send_interval'

interface ProposedRateLimitErrorData {
  limitType: RateLimitType
  resendAvailableAt: number // Unix 毫秒时间戳
  serverTime: number // Unix 毫秒时间戳
  remainingDisabledSeconds?: number // 兼容旧客户端，可保留
  showFormattedTime?: string // 兼容旧客户端，可保留
}
```

字段名和枚举值需由 PR-02235 后端负责人最终确认。前端要求的是稳定、可枚举的机器字段，禁止通过错误文案推断限频类型。

### 5.2 类型语义

| 类型语义 | 需要区分的原因 | 冷却要求 |
|---|---|---|
| IP 限频 | 用户与客服需知道限制来自当前网络/IP | 返回本次限制准确截止时间 |
| UID 限频 | 用户与客服需知道限制来自账号维度 | 返回本次限制准确截止时间 |
| 60 秒发送间隔 | 普通重复发送保护 | 返回下次允许发送的截止时间 |

### 5.3 前端行为

- 首次命中：展示对应错误码/原因，并进入后端指定的冷却状态。
- 冷却期间用户再次操作：前端拦截，不发请求，并再次展示上一次限频原因。
- 冷却结束：恢复“重新发送”。
- 网络异常或普通服务异常：不进入默认 60 秒倒计时，恢复“获取验证码”或“重新发送”，允许立即重试。

## 6. 错误码与文案责任

请后端提供以下映射表，前端接入前必须确认：

| 场景 | error code | `limitType` | 是否有截止时间 | 用户可见消息来源 |
|---|---|---|---:|---|
| 60 秒内重复发送 | 待确认 | 待确认 | 是 | 前端中文 i18n 或后端标准错误码映射，待确认 |
| IP 限频 | 待确认 | 待确认 | 是 | 同上 |
| UID 限频 | 待确认 | 待确认 | 是 | 同上 |
| 验证码错误 | 待确认 | 不适用 | 否 | 现有错误码体系 |
| 验证码过期 | 待确认 | 不适用 | 否 | 现有错误码体系 |
| 网络/服务异常 | 现有体系 | 不适用 | 否 | 现有错误码体系 |

国际化责任：Web 业务开发只维护 `zh-CN`；其他语言由国际化团队补齐。

## 7. 最小联调场景

后端可提供测试账号或 Mock 数据覆盖以下组合：

1. 仅 GA、仅邮箱、仅手机。
2. GA + 邮箱、GA + 手机、邮箱 + 手机。
3. GA + 邮箱 + 手机，确认默认选择 GA、列表只含已绑定方式。
4. 通过非默认方式完成登录，确认同一 token 的切换语义。
5. 邮箱已进入冷却、手机未冷却；切换后两者状态独立。
6. 发送后刷新/离开重进，剩余时间可由绝对截止时间恢复。
7. 分别命中 IP、UID、60 秒间隔限频，返回不同类型及准确截止时间。
8. 网络异常/500：不返回伪冷却，不阻止立即重试。

## 8. 对接结论记录

| 待确认项 | 后端结论 | 负责人 | 日期 |
|---|---|---|---|
| 登录已绑定方式字段及枚举 | 待确认 |  |  |
| token 是否跨方式共用 | 待确认 |  |  |
| 邮箱/手机脱敏字段 | 待确认 |  |  |
| 冷却截止时间字段、单位 | 待确认 |  |  |
| 服务端当前时间字段、单位 | 待确认 |  |  |
| IP/UID/发送间隔限频枚举 | 待确认 |  |  |
| 各限频错误码 | 待确认 |  |  |
| PR-02189 / PR-02235 可联调时间 | 待确认 |  |  |
