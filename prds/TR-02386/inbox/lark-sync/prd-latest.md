---
sourceName: "需求 PRD"
sourceType: "markdown"
sourceUrl: "/Users/aven/github/docs_tdd/prds/TR-02386/inbox/PLAN.md"
syncedAt: "2026-09-15T10:07:33.689Z"
readOnly: true
command: "local-markdown ../docs_tdd/prds/TR-02386/inbox/PLAN.md"
---

# 登录 / 注册 / 三方登录迁移到 web-next 计划书

> 状态：仅规划，未开始写代码。
> 背景：本次只是前端技术重构，**后台 API 字段、路径、加密规则、token 语义全部沿用 legacy `apps/web`**，不新增也不改动后端契约。
> 范围：**全部都做**——账号/密码登录、扫码登录、邮箱/手机注册、Google / Apple / Telegram / HiChat 三方登录、三方注册、绑定已有账号、登录后 MailBinder 弹窗、全站入口切换与灰度。

---

## 目录

1. [迁移背景与原则](#1-迁移背景与原则)
2. [web-next 迁移知识总结](#2-web-next-迁移知识总结)
3. [Prediction 迁移经验](#3-prediction-迁移经验)
4. [当前能力盘点](#4-当前能力盘点)
5. [契约与数据设计](#5-契约与数据设计)
6. [公共基础设施补齐](#6-公共基础设施补齐)
7. [阶段化迁移计划](#7-阶段化迁移计划)
8. [测试策略](#8-测试策略)
9. [验收与风险](#9-验收与风险)

---

## 1. 迁移背景与原则

### 1.1 为什么要迁

- `apps/web-next` 是 FameEX 从 legacy `apps/web` 向 **Next.js + TanStack Router + React Query + Effect/Schema + platform 组件** 新架构迁移的目标应用。
- 登录、注册、三方登录是整站入口，必须在 web-next 内闭环，才能彻底切换首页、交易页、个人中心等核心链路。
- 本次**只动前端**，后端接口、加密算法、验证码服务、OAuth 应用配置、域名白名单均保持不变。

### 1.2 迁移原则（沿用 Prediction 沉淀）

| 原则 | 说明 |
| --- | --- |
| 先契约、后 UI | 先把 legacy API 的 path/method/body/response 冻结成 web-next endpoint 与 Schema，再写页面。 |
| Schema 忠实契约 | 不确定是否必填的字段一律 `.nullish()`，禁止 schema 比后端更严导致整页空白。 |
| 纯函数下沉 | 格式化、校验、payload 组装、状态映射抽成纯函数并单测；组件只做组装。 |
| 服务端状态走 React Query | 禁止把 query data 再复制进 Zustand；Zustand 只保存真正的本地 UI 状态。 |
| command mutation 禁止自动重试 | 登录、注册、绑定都是不可逆操作，失败必须停在当前页并显式反馈。 |
| 缺数据不造假 | 必填缺失显示 `--`，optional 缺失不渲染；禁止 `?? 'fake copy'`。 |
| 只改 zh-CN | 新增/修改的 i18n key 只写入 `apps/web-next/src/i18n/resources/zh-CN/`；其它语言走 Tolgee 同步。 |
| 测试分层 | endpoint/纯函数必须测试；普通 `.tsx` 组件用 DOM contract / 真实浏览器验收，不大量写 render unit test。 |

---

## 2. web-next 迁移知识总结

### 2.1 技术边界

| 层级 | 目录 | 说明 |
| --- | --- | --- |
| 接口契约 / Schema | `apps/web-next/src/platform/domain/web/endpoints/*.ts` | Effect/Schema 描述 API path、method、payload、envelope。 |
| API Client | `apps/web-next/src/services/api/WebApiClient.ts` | 消费 `WebHttpApi` 中注册的 group。 |
| Query / Mutation 描述子 | `apps/web-next/src/services/hooks/**/*.ts` | `makeEffectQueryDescriptor` / `makeEffectMutationDescriptor` + `EffectReact.bind*`。 |
| 业务纯函数 / mapper | `apps/web-next/src/apps/<Feature>/common/*.ts` | 不依赖 React / Effect runtime / DOM，单独可测。 |
| 路由 | `apps/web-next/src/routes/**/*.tsx` | 薄路由，只负责结构、search param、loader、head。 |
| UI 组件 | `apps/web-next/src/apps/<Feature>/components/**/*.tsx` | 优先复用 `platform/components/convenience` → `ui` → `fields`。 |
| i18n | `apps/web-next/src/i18n/resources/zh-CN/*.json` | selector 式 `useTranslation`（`t(($) => $.key)`）。 |

### 2.2 关键约束

- **SSR 初期不调用需要鉴权的 API**：登录态相关请求先在浏览器侧发起，避免服务端拿不到 session 而失败。
- **列表响应逐行容错**：用 `decodeUnknownEither` 或 `ResilientArray`，坏行最多丢掉该行，不能清空整表。
- **组件 300 行拆分**：复杂表单拆分子组件；不要把 legacy 大组件直接复制过来。
- **外部依赖阻塞要落文档**：例如 provider SDK 加载、origin 白名单、测试 bot 等，必须登记 owner，不能前端硬编码绕过。

### 2.3 验证命令范围

所有检查限定在 `apps/web-next` 目录内：

```bash
cd apps/web-next
pnpm exec vitest
pnpm exec tsc --noEmit
pnpm exec biome check src
pnpm build:test
```

---

## 3. Prediction 迁移经验

### 3.1 按钮文案数据链事件回顾

用户此前反馈 Prediction 切换语言后交易按钮文案乱码。排查结论：

- 按钮文字取的是 API `markets[i].outcomes` 的**对象 key**（如 `Connecticut Sun`、`Yes`、`Over`），不是某个独立字段。
- 数据链：`outcomes key` → `listMarketOutcomes` → `mapTagEventsToMatches` → `PredictionTradeMan` → `resolveOutcomeDisplayName` / `formatTradeBuyOutcomeLabel`。
- `Yes/No/Over/Under` 等别名走翻译 key；队名、人名原样显示。
- 问题根因：**非 zh-CN 语言包缺少新 key**（`trade.buyOutcome`、`outcome.over/under` 等），不是前端字段取错。

启示：迁移中遇到显示异常时，先确认数据链路，再区分是“字段问题”还是“翻译资源同步问题”；本地仓库只维护 `zh-CN`，不能靠前端硬编码补其它语言。

### 3.2 可直接复用的经验

1. **契约优先**：`getTagEventsListEndpoint.ts` 等先例说明 endpoint 应先有红测再实现。
2. **Schema 宁松勿严**：`checkAccountEndpoint.ts` 用 `Schema.NullOr(...)` 收敛 `data: null`，避免整包 parse 失败。
3. **状态机显式化**：`OperateMapType`（Select/Reg/Create/Unite）比多个布尔值更安全。
4. **外部阻塞落文档**：`page-migration.md` 把“真实体育种子”“可交易账号”“多语言分类”列为阻塞，而不是前端造假数据。
5. **命令 mutation 不自动重试**：Prediction 下单 endpoint 明确禁用自动重试；登录/注册同样适用。

---

## 4. 当前能力盘点

### 4.1 已存在并可直接复用的 web-next 基础设施

| 能力 | 文件 | 状态 |
| --- | --- | --- |
| 账号输入框（含国家码） | `src/components/AccountInput/index.tsx` | 已迁移 |
| 验证码弹窗 | `src/components/CodeVerifyDialog/index.tsx` | 已迁移 |
| 多因子验证组件 | `src/components/VerifyMan/index.tsx` | 已迁移 |
| 极验 captcha hook | `src/platform/captcha/useCaptcha.tsx` | 已迁移 |
| 密码加密 | `src/platform/sign-key/encryptPasswordWithKey.ts` | 已迁移 |
| 登录态 session 写入 | `src/services/hooks/auth/useWriteAuthSession.ts` | 已存在 |
| 当前用户 query | `src/services/hooks/auth/authSessionQuery.ts` + `useIsLoggedIn` | 已存在 |
| 三方 provider SDK | `src/platform/third-party-sdk/{google,apple,telegram,facebook}Sdk.ts` | 已迁移 |
| 三方登录弹窗骨架 | `src/components/ThirdPartyLogin/LoginOperateModal/*.tsx` | 已大部分迁移 |
| 服务条款勾选 | `src/components/ThirdPartyLogin/LoginOperateModal/TermsAgreement.tsx` | 已迁移 |
| HiChat 成功弹窗 | `src/components/ThirdPartyLogin/LoginOperateModal/HiChatSucModal.tsx` | 已迁移 |
| 认证导航 URL | `src/apps/shared/auth/buildAuthNavigationUrl.ts` | 已存在 |

### 4.2 缺失或需要补齐的部分

| 缺失项 | 说明 | 影响范围 |
| --- | --- | --- |
| 登录/注册页面路由 | 当前只有 `routes/dev/login.tsx` 调试用，没有生产 `/login`、`/register` | 入口 |
| 登录 endpoint 未注册到 group | `loginInEndpoint.ts`、`confirmLoginEndpoint.ts`、`getValidateSwitchEndpoint.ts` 只被 import，未 `.add()` | 调用 |
| 注册 endpoint / hook | `reg_email_chk_info` / `reg_mobile_chk_info` / `set_*_password` 等均未迁移 | 注册 |
| 二维码登录 hook / WS | `get_login_qrcode_id` / `get_login_qrcode_status` 未迁移 | 扫码登录 |
| `VerifyInputs` store | 登录/注册共用的多步验证状态机 store 缺失 | 登录/注册 |
| `PasswordRuleChecklist` | 密码规则实时清单组件缺失 | 注册 |
| `useRedirectIfLogin` | 已登录用户访问登录/注册页重定向逻辑缺失 | 登录/注册 |
| `OperationTypeEnum.EmailLogin` | 当前 `verificationTypes.ts` 没有邮箱登录类型 | 登录 |
| 三方登录公共 hook | `HomeSocialLinks.tsx` 内联了三方状态分发，未抽出公共 `useThirdAuth` | 三方登录 |
| `page-migration.md` 登记的 6 个 TODO | HiChat `grant_token`/`gToken`、错误反馈、`CreateByThird` 加密、`VerifyMan` 重复提交、`createDesc` 插值、Google clip-path | 三方登录 |
| `thirdLogin.json` 缺失 key | `telegram`、`facebook`、`serviceUnavailable`、`PasswordTips` 等 | 三方登录 |

### 4.3 能力矩阵（全部纳入本次范围）

| 能力 | Legacy 入口 | Legacy API | web-next 现状 | 主要风险 |
| --- | --- | --- | --- | --- |
| 账号/密码登录 | `apps/web/src/apps/Login/InputAccount.tsx` | `getValidateSwitch`、`login_in`、`confirm_login` | endpoint 已定义未注册；hook 未建 | 2FA 跳过路径、错误码映射、密码加密 |
| 扫码登录 | `apps/web/src/apps/Login/ScanCode.tsx` | `get_login_qrcode_id`、`get_login_qrcode_status` + WS | 未迁移 | WS 层复用或轮询兜底 |
| 邮箱/手机注册 | `apps/web/src/apps/Register/RegisterV2/*.tsx` | `reg_email_chk_info` 等 | 未迁移 | 奖励侧边栏、邀请码、密码规则 |
| Google/Apple/Telegram/HiChat 登录 | `apps/web/src/components/ThirdPartyLogin/**` | `authLogin`、`check_user_status` 等 | 骨架已存在，6 个 TODO 未清 | 参数命名、SDK 白名单、错误反馈 |
| 三方注册/创建/绑定 | 同上 | `authRegister`、`newRegisterCheck`、`joinAddAccount`、`confirmLogin` | 大部分已迁移 | 账号加密、provider 文案插值 |
| 登录后 MailBinder | `apps/web/src/components/MailBinder/**` | - | 未迁移 | 是否随登录页一并迁移需确认 |

---

## 5. 契约与数据设计

> 本次后台 API 不动，因此本章节的核心工作是**冻结 legacy 现有契约**，把字段、加密规则、token 语义完整映射到 web-next 的 Schema / hook / store 中。

### 5.1 账号/密码登录契约

| 步骤 | Method | Path | 关键字段 | 备注 |
| --- | --- | --- | --- | --- |
| 查 2FA 开关 | POST | `/fe-ex-api/user/getValidateSwitch` | `validateSwitch: 0/1` | 0 时跳过验证码 |
| 提交账密 | POST | `/fe-ex-api/v6/user/login_in` | `verificationType: '2'`、`token: true`、`nc: null`、加密 `mobileNumber` / `loginPword`、极验字段、可选 `utm_source`/`hichatToken` | 返回 `type`（VerifyType）+ `token` |
| 确认登录 | POST | `/fe-ex-api/user/confirm_login` | `token`、`type: 'google'\|'email'\|'phone'`、`authCode` | 返回 `quicktoken` + `uid` |

**加密规则**：`mobileNumber` 与 `loginPword` 均使用 `encryptPasswordWithKey` 加密后发送。

**Token 语义**：legacy `confirm_login` 返回 `quicktoken`，之后直接作为 `accessToken` 写入 storage；本次迁移沿用该行为，并在真实验收时确认。

### 5.2 注册契约

| 步骤 | Method | Path | 关键字段 |
| --- | --- | --- | --- |
| 邮箱预检 | POST | `/fe-ex-api/v1/user/reg_email_chk_info` | 加密 `email`、极验字段、`verificationType: '2'`、`token: true`、可选 `invitedCode` |
| 邮箱验证码确认 | POST | `/fe-ex-api/v1/user/reg_email_confirm` | `token`、`emailCode` |
| 设置邮箱密码 | POST | `/fe-ex-api/v1/user/set_email_password` | `token`、加密 `loginPword` |
| 手机预检 | POST | `/fe-ex-api/v1/user/reg_mobile_chk_info` | 加密 `mobileNumber`、`countryCode`、极验字段、`verificationType: '2'`、`token: true`、可选 `invitedCode` |
| 手机验证码确认 | POST | `/fe-ex-api/v1/user/reg_mobile_confirm` | `token`、`smsCode` |
| 设置手机密码 | POST | `/fe-ex-api/v1/user/set_mobile_password` | `token`、加密 `loginPword` |

### 5.3 扫码登录契约

| 步骤 | Method | Path | 关键字段 |
| --- | --- | --- | --- |
| 获取二维码 | POST | `/fe-ex-api/get_login_qrcode_id` | - |
| 查询状态 | POST | `/fe-ex-api/get_login_qrcode_status` | `qrcodeId` |

legacy 同时通过 WS 推送扫码状态，本次需评估 web-next 现有 WS 层是否可直接复用；若不能，先实现轮询兜底。

### 5.4 三方登录契约

| 场景 | Method | Path | 关键字段 / 说明 |
| --- | --- | --- | --- |
| Google/Apple/Telegram 授权后 | POST | `/fe-ex-api/oauth/authLogin` | `source`、`idToken` |
| 查询 HiChat 状态 | GET | `/fe-ex-api/exchange-web-api/hichat/check_user_status/{gToken}` | 注意 legacy 使用 `grant_token` / `GRANT_TOKEN` 回跳，web-next 当前只认 `gToken`，需收敛 |
| 三方注册 | POST | `/fe-ex-api/oauth/authRegister` | `source`、`idToken`、极验字段、可选 `invitedCode`、`authCode` |
| 创建账号预检 | POST | `/fe-ex-api/oauth/newRegisterCheck` | `source`、`idToken`、加密 `mobileOrEmailNumber`、可选 `countryCode` |
| 关联已有账号 | POST | `/fe-ex-api/oauth/joinAddAccount` | `source`、`idToken`、账号/密码加密、极验字段 |
| HiChat 注册并绑定 | POST | `/fe-ex-api/exchange-web-api/hichat/register_and_bind` | `grantToken`、极验字段 |
| HiChat 绑定已有账号 | POST | `/fe-ex-api/exchange-web-api/hichat/bind_existing_account` | `grantToken`、加密账号/密码、验证码 |

**三方状态码**：`authStatus=1` 已授权自动登录；`authStatus=2` 已注册需关联；`authStatus=0` 未注册需选择。

### 5.5 状态机设计

#### 账号/密码登录

```
AccountInput + PasswordInput
    -> runCaptcha
    -> login_in
        -> 2FA 关闭: confirm_login(type=google, authCode='')
        -> 2FA 开启: CodeVerifyDialog -> confirm_login
    -> useWriteAuthSession({ accessToken: quicktoken, uid })
    -> redirect(from || HOME)
```

#### 注册

```
CreateAccount (account, inviteCode, terms)
    -> runCaptcha
    -> reg_email_chk_info / reg_mobile_chk_info
    -> CodeVerifyDialog
    -> reg_email_confirm / reg_mobile_confirm
    -> CreatePassword
    -> set_email_password / set_mobile_password
    -> useWriteAuthSession
    -> redirect
```

#### 三方登录

```
Provider 授权 -> authLogin / check_user_status
    -> authStatus=1: 写 session，跳转
    -> authStatus=2: 强制 Unite
    -> authStatus=0: SelThirdType
         -> Reg:  authRegister / hichatRegisterAndBind
         -> Create:  newRegisterCheck -> code -> authRegister
         -> Unite:  checkAccount -> password -> joinAddAccount -> VerifyMan -> confirmLogin / hichatBindExistingAccount
```

---

## 6. 公共基础设施补齐

以下基础设施必须在写页面前补齐并经过测试：

1. **注册 endpoint / hook**
   - `apps/web-next/src/platform/domain/web/endpoints/regEmailChkInfoEndpoint.ts`
   - `apps/web-next/src/platform/domain/web/endpoints/regEmailConfirmEndpoint.ts`
   - `apps/web-next/src/platform/domain/web/endpoints/setEmailPasswordEndpoint.ts`
   - 以及对应 mobile 版本
   - `apps/web-next/src/services/hooks/auth/reg*Mutation.ts`

2. **登录 endpoint 注册到 WebHttpApi group**
   修改 `apps/web-next/src/platform/domain/web/WebHttpApi.ts`，把 `LoginInEndpoint`、`ConfirmLoginEndpoint`、`GetValidateSwitchEndpoint` 真正 `.add()` 进某个 group。

3. **登录 hooks**
   - `apps/web-next/src/services/hooks/auth/loginInMutation.ts`
   - `apps/web-next/src/services/hooks/auth/validateSwitchQuery.ts`

4. **二维码登录 hooks / WS**
   - `apps/web-next/src/services/hooks/auth/loginQRCodeQuery.ts`
   - `apps/web-next/src/services/hooks/auth/qrStatusMutation.ts`
   - 复用或迁移 `useLoginQRCodeWS`

5. **`VerifyInputs` store（登录/注册共用）**
   从 legacy `apps/web/src/components/VerifyInputs/store.ts` 迁移，包含 `useResetVerifyOnPathEntry`，避免同路径 remount 时重置。

6. **`PasswordRuleChecklist` 组件**
   迁移自 `apps/web/src/components/PasswordRuleChecklist.tsx`，或重写为纯函数 + UI。

7. **`useRedirectIfLogin`**
   基于 `useIsLoggedIn` 实现，已登录用户访问 `/login`、`/register` 时重定向。

8. **`useCode`（邀请码）**
   读取 `c` / `inviteCode` query param，回退 localStorage，兼容 legacy 行为。

9. **`OperationTypeEnum.EmailLogin`**
   补充到 `apps/web-next/src/components/CodeVerifyDialog/verificationTypes.ts`。

10. **`useThirdAuth` 公共 hook**
    从 `HomeSocialLinks.tsx` 内联逻辑抽出，供 Home / Login / Register 共用。

11. **i18n 资源补齐**
    - 在 `apps/web-next/src/i18n/core/namespaces.ts` 增加 `loginI18nNamespaces`、`registerI18nNamespaces`。
    - 对照 legacy 补齐 `zh-CN/login.json`、`register.json`、`thirdLogin.json` 缺失 key。

---

## 7. 阶段化迁移计划

> 每阶段可独立验收、独立回滚。阶段 1–2 是基础设施；阶段 3–7 是登录/注册主体；阶段 8–10 是三方登录；阶段 11–13 是入口切换与收尾。

### Phase 0：基线与盘点

**目标**：确认当前 web-next 可编译、可测试基线；登记必须修复的 TODO。

**动作**：
- 运行 `apps/web-next` 内：
  ```bash
  pnpm exec vitest
  pnpm exec tsc --noEmit
  pnpm exec biome check src
  pnpm build:test
  ```
- 记录基线错误（如 `mainNavigationConfig.test.ts:34` 的既有错误）。
- 输出“打开登录/注册入口前必须关闭的 TODO 清单”。

**验收**：基线数字确定，不修复与本次无关的问题。

---

### Phase 1：契约冻结与 Endpoint 注册

**目标**：所有登录/注册相关 endpoint 在 `WebHttpApi` 中可用，并附带 contract 测试。

**修改目录**：
- `apps/web-next/src/platform/domain/web/endpoints/`
- `apps/web-next/src/platform/domain/web/WebHttpApi.ts`
- `apps/web-next/src/platform/domain/web/endpoints/test/`

**行为契约**：
- `login_in` payload 必须包含加密后的 `mobileNumber` / `loginPword`、极验字段、`verificationType: '2'`、`token: true`。
- `confirm_login` payload 必须包含 `token`、`type`（google/email/phone）、`authCode`。
- 注册 endpoint payload 必须包含加密后的账号/手机号、极验字段、`token: true`、`verificationType: '2'`。
- 注册 set-password payload 必须包含加密后的 `loginPword`。

**测试**：每个 endpoint 写一个 contract test：断言请求 body 字段名、断言加密字段存在、断言 response envelope 解包形状。

**验收**：
- `tsc --noEmit` 通过新 endpoint 类型。
- contract tests 全绿。

**风险/回滚**：仅新增 endpoint，未改动 UI；删除新增文件即可回滚。

---

### Phase 2：共享 hook、store 与纯函数

**目标**：把登录/注册需要的 hooks、store、纯函数补齐。

**修改目录**：
- `apps/web-next/src/services/hooks/auth/`
- `apps/web-next/src/components/VerifyInputs/`（新建）
- `apps/web-next/src/components/PasswordRuleChecklist/`（新建）
- `apps/web-next/src/apps/Login/common/`、`apps/web-next/src/apps/Register/common/`

**行为契约**：
- `loginInMutation` 禁用自动重试。
- `validateSwitchQuery` 返回 `validateSwitch: 0 | 1`。
- `useRedirectIfLogin` 在已登录时 redirect。
- `useResetVerifyOnPathEntry` 进入新路径重置验证状态，同路径 remount 不重置。
- `PasswordRuleChecklist` 实时校验 8–20 字符、字母、数字、特殊符号，特殊符号列表从单一 regex 常量读取。

**测试**：
- 纯函数：`buildLoginInPayload`、`buildRegisterCheckPayload`、`resolveVerifyType`、`isEmailAccount`、`normalizePhone`。
- hook 测试使用受控 runtime，不发真实请求。

**验收**：
- 新增测试全绿。
- `biome check` 通过。

---

### Phase 3：账号/密码登录页

**目标**：`/login` 页面可用，支持邮箱/手机号 + 密码 + 2FA。

**修改目录**：
- `apps/web-next/src/routes/(auth)/route.tsx`（无 header/footer 的登录/注册布局）
- `apps/web-next/src/routes/(auth)/login.tsx`
- `apps/web-next/src/apps/Login/components/LoginForm.tsx`
- `apps/web-next/src/apps/Login/components/InputAccount.tsx`

**行为契约**：
- `validateSearch` 读取 `from`、`utm_source`、`hichatToken`、`c`/`inviteCode`。
- `from` 只取当前 public pathname，不带 query/hash（复用 `buildAuthNavigationUrl` 逻辑）。
- 账号输入 blur 时校验邮箱或手机号；手机号时展示 `CountryCallingCodePicker`。
- 密码输入过滤非法字符（复用 `passwordAllowedCharPattern`）。
- 点击登录先调 captcha；若 2FA 关闭，直接 `login_in` + `confirm_login(type=google, authCode='')`；否则进入验证码弹窗。
- 登录成功后 `useWriteAuthSession` 写 session，PostHog 埋点，跳转 `from || HOME`。
- 登录失败按 `code` + `data.loginFailNum/seconds/hours` 显示错误。
- 已登录用户访问 `/login` 重定向。

**验收**：
- 邮箱登录成功/失败。
- 手机登录成功/失败。
- 2FA 邮箱/短信/Google 登录。
- `from` 跳转回原页面。
- 错误提示正确。

---

### Phase 4：验证码、Session 与错误反馈闭环

**目标**：把 `CodeVerifyDialog`、`VerifyMan`、错误提示、session 刷新串成完整闭环。

**修改目录**：
- `apps/web-next/src/components/CodeVerifyDialog/index.tsx`
- `apps/web-next/src/components/VerifyMan/index.tsx`
- `apps/web-next/src/services/hooks/auth/useWriteAuthSession.ts`

**行为契约**：
- `CodeVerifyDialog` 在登录场景使用 `OperationTypeEnum.EmailLogin/PhoneLogin`。
- 验证码自动提交、重发倒计时、错误标红。
- `VerifyMan` 在 `doneVerify` 前重置 `authPassed=false`，避免重复触发。
- `confirmLogin` 成功后拿到 `quicktoken` + `uid`，写入 session；写入后 `invalidateQueries` 刷新登录态相关 query。

**验收**：
- 6 位验证码自动提交。
- 重发倒计时 60s。
- 登录成功后 `useIsLoggedIn` 立即为 true，header 切登录态。

---

### Phase 5：扫码登录

**目标**：补齐 legacy 左侧二维码登录。

**修改目录**：
- `apps/web-next/src/services/hooks/auth/qrCodeQuery.ts`
- `apps/web-next/src/services/hooks/auth/qrStatusMutation.ts`
- 复用/迁移 `useLoginQRCodeWS`
- `apps/web-next/src/apps/Login/components/ScanCode.tsx`

**行为契约**：
- 页面加载请求 `get_login_qrcode_id`，60s 本地过期。
- 同时监听 WS 或轮询 `get_login_qrcode_status`；状态成功后取 `token` 写 session 并跳转。
- 过期后显示刷新按钮，重新请求二维码。

**验收**：
- 生成二维码。
- App 扫码后自动登录跳转。
- 过期刷新有效。

---

### Phase 6：注册页结构与账号步骤

**目标**：`/register` 页面与注册第一步（CreateAccount）。

**修改目录**：
- `apps/web-next/src/routes/(auth)/register.tsx`
- `apps/web-next/src/apps/Register/components/RegisterForm.tsx`
- `apps/web-next/src/apps/Register/components/CreateAccount.tsx`
- `apps/web-next/src/apps/Register/components/RegisterSidebar.tsx`（奖励侧边栏）

**行为契约**：
- `validateSearch` 读取 `account`、`c`/`inviteCode`、`utm_source`。
- 账号输入与登录共用 `AccountInput`。
- 服务条款默认勾选（保持与 legacy 一致）。
- 邀请码可折叠输入；若 URL 带 `c`，预填且禁用编辑。
- 点击创建账户调 captcha → `reg_email_chk_info` 或 `reg_mobile_chk_info` → 进入验证码弹窗。

**验收**：
- 页面渲染奖励侧边栏。
- 邮箱/手机账号校验。
- 邀请码预填。
- 提交后进入验证码步骤。

---

### Phase 7：注册验证与密码设置

**目标**：注册验证码确认 + 设置密码 + 注册成功。

**修改目录**：
- `apps/web-next/src/apps/Register/components/CreatePassword.tsx`
- `apps/web-next/src/components/PasswordRuleChecklist.tsx`

**行为契约**：
- 验证码校验通过后进入密码页。
- 密码必须满足 8–20 位、字母、数字、特殊符号；实时展示 `PasswordRuleChecklist`。
- 提交 `set_email_password` / `set_mobile_password`，密码加密。
- 成功后写 session，PostHog `register_complete` + `share_register_success`（若有邀请码），跳转 `from || HOME`。

**验收**：
- 密码规则实时反馈。
- 邮箱注册完整流程。
- 手机注册完整流程。

---

### Phase 8：三方登录基础设施修复

**目标**：先关闭 `page-migration.md` 里登记的 6 个 TODO，再让登录/注册页接入三方按钮。

**修改目录**：
- `apps/web-next/src/apps/Home/components/FafaAndAnniversaryBanner/HomeSocialLinks.tsx`
- `apps/web-next/src/components/ThirdPartyLogin/LoginOperateModal/CreateByThird.tsx`
- `apps/web-next/src/components/ThirdPartyLogin/LoginOperateModal/UniteByThird.tsx`
- `apps/web-next/src/components/VerifyMan/index.tsx`
- `apps/web-next/src/i18n/resources/zh-CN/thirdLogin.json`
- 新增 `apps/web-next/src/apps/shared/auth/useThirdAuth.ts`

**行为契约**：
- HiChat 回跳 `validateSearch` 同时识别 `grant_token` / `GRANT_TOKEN` / `gToken`，统一收敛到 `gToken`。
- `hichatUserStatusQuery` 失败时调用错误提示，不能只听 `data`。
- `CreateByThird` 的 `mobileOrEmailNumber` 必须 `encryptPasswordWithKey`。
- `VerifyMan` 在 `authPassed` 翻转时重置 `false`，`UniteByThird` 把 `confirming` pending 传入禁用态。
- `createDesc` 使用插值 `{{thirdName}}`，不能写死 Apple。
- Google GSI 叠层补 `clip-path` + `opacity-[0.01]`。
- 抽出公共 `useThirdAuth` hook，供 Home / Login / Register 共用。

**验收**：
- 各 provider SDK 加载成功。
- HiChat redirect 后能正确触发 `check_user_status`。
- `CreateByThird` 在 Telegram/Apple 注册时账号加密成功。

---

### Phase 9：三方注册流程（Reg / Create）

**目标**：三方授权后选择注册新账号，或需要手动填账号的 Create 分支。

**修改目录**：
- `apps/web-next/src/components/ThirdPartyLogin/LoginOperateModal/RegByThird.tsx`
- `apps/web-next/src/components/ThirdPartyLogin/LoginOperateModal/CreateByThird.tsx`

**行为契约**：
- `Reg` 分支：勾选条款 → captcha → `authRegister`（Google/Apple/Telegram）或 `hichatRegisterAndBind`（HiChat）。
- `Create` 分支：输入邮箱/手机 → captcha → `newRegisterCheck` → 验证码 → `authRegister`；账号加密。
- 成功后 `useWriteAuthSession` 写 session；HiChat 展示 `HiChatSucModal` 显示账号与预设密码。

**验收**：
- Google/Apple/Telegram 直接注册。
- 需要手动账号的渠道注册成功。
- HiChat 注册后弹窗可复制密码。

---

### Phase 10：三方绑定已有账号（Unite）

**目标**：三方授权后绑定已有 FameEX 账号。

**修改目录**：
- `apps/web-next/src/components/ThirdPartyLogin/LoginOperateModal/UniteByThird.tsx`

**行为契约**：
- 三步：账号 → 密码 → 多因子验证。
- 账号检查 `checkAccount`，密码加密。
- `joinAddAccount` 后若 `hasGoogleAuth` 需要 Google 验证码，走 `VerifyMan`。
- HiChat 分支用 `hichatBindExistingAccount`，参数兼容 `grantToken`、`email/mobileNumber` 加密。
- 成功后写 session，弹窗关闭。

**验收**：
- 绑定已有邮箱账号。
- 绑定已有手机账号。
- Google 验证绑定流程。

---

### Phase 11：全站入口切换

**目标**：登录/注册页在 web-next 内可用后，把 `MainHeader` 的登录/注册按钮切到内部路由。

**修改目录**：
- `apps/web-next/src/apps/shared/auth/buildAuthNavigationUrl.ts`（保留给受保护页跳转用）
- `apps/web-next/src/apps/shared/components/main-header/` 中 login/register 入口
- 路由灰度配置 / feature flag

**行为契约**：
- 未登录用户点击 header “登录” → `/zh-CN/login?from=<当前路径>`。
- 未登录用户点击 header “注册” → `/zh-CN/register?from=<当前路径>`。
- 保护页面仍用 `buildAuthNavigationUrl` 生成 `from` 后跳转 `/login`。

**验收**：
- 从交易页点击登录，成功后回到交易页。
- 移动端 header 登录入口同样生效。

---

### Phase 12：灰度、监控与回滚

**目标**：线上逐步放量，保留 legacy 回跳能力。

**动作**：
- 增加 feature flag（具体配置键与产品/运维确认）。
- flag 关闭时，登录/注册链接仍走 legacy site URL。
- flag 打开时走 web-next 路由。
- 监控埋点：login_page_view / register_page_view / login_complete / register_complete / 各 provider click。

**验收**：
- flag 可即时回滚到 legacy。
- 错误率不高于 legacy 基线。

---

### Phase 13：收尾与文档登记

**目标**：更新迁移状态，清理临时 dev 路由，最终验收。

**修改目录**：
- `apps/web-next/docs/page-migration.md`
- 视情况删除/保留 `routes/dev/login.tsx`

**验收**：
- `page-migration.md` 登记 `/login`、`/register`、三方登录为“已迁移”或“外部阻塞”。
- 全量 `vitest`、`tsc --noEmit`、`biome check src`、`build:test` 通过。
- 真实账号/真实 provider 多语言、移动端验收完成。

---

## 8. 测试策略

| 层级 | 测试对象 | 方式 |
| --- | --- | --- |
| 纯函数 | payload builder、账号类型判断、国家码规范化、密码规则、provider 参数归一化、回跳 URL 清洗、VerifyType 映射 | Vitest 字面断言 |
| Endpoint/Schema | 请求 body 字段、加密字段、envelope 解包、错误码 decode | Contract test，受控 runtime |
| Hook/Mutation | loginIn、confirmLogin、注册、三方授权、验证码发送 | mock client，不发真实请求；断言 retry=false |
| 组件/页面 | 文本可见性、disabled/loading、分步切换、错误反馈、跳转 | DOM contract script 或真实浏览器 |
| 集成/人工 | 邮箱/手机登录注册、2FA、GeeTest、扫码、Google/Apple/Telegram/HiChat、popup/callback、多语言、移动端、登录后回跳、session 刷新 | 真实账号与 provider |

---

## 9. 验收与风险

### 9.1 最终验收标准

- `apps/web-next` 内 `pnpm exec vitest`、`pnpm exec tsc --noEmit`、`pnpm exec biome check src`、`pnpm build:test` 全部通过。
- 真实邮箱、手机、Google、Apple、Telegram、HiChat 账号完成全流程人工验收。
- 多语言（至少 zh-CN / en-US / ko-KR）验收无缺失 key 显示为 raw namespace:key。
- 移动端 390px 与桌面 1440px 验收通过。
- 登录成功后 `from` 回跳正确，session 刷新后 header 进入登录态。
- feature flag 可一键回滚到 legacy。

### 9.2 关键风险

1. **`quicktoken` 与 `accessToken` 语义**：legacy `confirmLogin` 返回 `quicktoken`，当前 `useWriteAuthSession` 写 `accessToken`。计划先按 legacy 行为把 `quicktoken` 当作 session token 写入；真实验收时确认。
2. **验证码接口字段**：`getEmailValidCodeEndpoint` / `getSmsValidCodeEndpoint` 当前 payload 用宽松 `Record`，需确认登录场景下的 `operationType` 与 `token` 字段。
3. **HiChat 参数命名**：`grant_token` / `GRANT_TOKEN` / `gToken` 不统一，必须在 `validateSearch` 层收敛。
4. **Google GSI 叠层**：必须补 `clip-path`，否则 HTTPS/FedCM 生产环境会点穿或点不了。
5. **PasswordRuleChecklist**：web-next 目前没有该组件，需要先迁移或重写。
6. **MailBinder 弹窗**：legacy 登录成功后弹出绑定邮箱。计划建议与产品确认：若登录页必须保留该弹窗，则需在 Phase 4 迁移 `useMailBinderStore` 与对应弹窗。
7. **Facebook 入口**：当前 legacy 已隐藏 Facebook，web-next 计划同样保持隐藏，只支持 Google/Apple/Telegram/HiChat。

---

## 10. 下一步建议（交给下一个 chat）

1. **从 Phase 0 开始跑基线**：确认 `apps/web-next` 当前 `vitest`、`tsc`、`biome`、`build:test` 基线，记录既有错误。
2. **Phase 1 并行开工**：先把 `loginInEndpoint`、`confirmLoginEndpoint`、`getValidateSwitchEndpoint` 注册到 `WebHttpApi`，补齐注册 endpoint 与 hooks，并写 contract tests。
3. **同步清掉 Phase 8 的 6 个 TODO**：这些是三方的当前阻塞项，清理后 `HomeSocialLinks` 与 `LoginOperateModal` 才能稳定接入登录/注册页。
4. **确认 MailBinder**：决定登录成功后是否立即弹出绑定邮箱弹窗，若需要则提前排进 Phase 4。
