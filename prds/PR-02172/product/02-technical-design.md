<!-- template-version: 3 -->
<!-- template-effective-since: 2026-07-25 -->

# Technical Design — PR-02172 【登录注册】增加第三方（tg、facebook）

> 2026-08-03 已确认本页技术方向及 C01-C18 建议方案。范围为 Web + Admin，App 拆单；剩余 UI、API、owner 和验收资料待评审，G2 前不写业务代码。

## 已确认技术决策

| ID | 决策 | 结论 |
|----|------|------|
| TD01 | 项目责任范围 | Web + Admin；Admin 沿用现有后台规则与页面模式，具体落点待复用盘点；App 由 PM 拆单 |
| TD02 | 前端架构 | 扩展现有 `ThirdPartyLogin`，新增 Telegram/Facebook provider adapter，不另建整套流程 |
| TD03 | API 路线 | 优先复用 `/fe-ex-api/oauth/*` 通用接口与统一响应 schema；仅授权换 token 允许渠道专属接口 |
| TD04 | Provider 枚举 | 前端使用 `ThirdType.Telegram = 'Telegram'`、`ThirdType.Facebook = 'Facebook'`；后端 `source` 保持一致 |
| TD05 | 授权状态 | 继续使用 `0=未绑定`、`1=已绑定直登`、`2=强制关联`；异常状态使用明确错误码，不扩展模糊状态值 |
| TD06 | Web 授权交互 | popup 优先；popup 不支持/被拦截时降级 redirect；统一进入本站 callback 路由。Telegram 用官方 `telegram-login.js`（新版 OIDC，`Telegram.Login.auth()` popup 返回 `id_token`）；~~Facebook 用手动 code 模式（`/vXX/dialog/oauth?response_type=code`，后端换 token）~~ **2026-08-11 更正：Facebook 改走 Facebook JS SDK，`FB.login()` 直接返回 `accessToken`，不再走 code+回调路由（见 06-collaboration D6）** |
| TD07 | OAuth 安全 | 前端携带 state/PKCE 所需信息；后端负责生成或校验 state/nonce、code/token 交换与防重放。Telegram `id_token`(RS256 JWT) 由后端 JWKS 验签，密钥不进前端；~~Facebook code 均由后端验签/换取，app secret 不进前端~~ **2026-08-11 更正：Facebook 已无需 code 换 token，后端改用 accessToken 直查 Graph API `/me`** |
| TD08 | API 未 ready | 使用项目默认 MSW 路线 B；组件/service/hook 不写 mock 分支 |
| TD09 | 用户绑定模型 | 扩展统一 `authUsers` 数组，至少包含 `provider`、`bindStatus`、`maskedAccount`；不新增平铺的渠道状态字段 |
| TD10 | 外部数据边界 | Telegram/Facebook SDK 数据以 `unknown` 进入 runtime schema，再映射为统一授权模型 |
| TD11 | 解绑责任 | Web 只刷新用户资料并清理本地临时授权状态；数据库、token、缓存由后端原子清理；Bot 订阅不在本期范围 |
| TD12 | 阶段纪律 | PM/技术评审结论未回填前只维护文档，不开编码 worktree、不写业务代码 |

## 复用盘点

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 |
|------|-------------------|------|----------|
| 入口组件 | `components/ThirdPartyLogin/index.tsx`、`HomeThirdLogin.tsx` | 已覆盖登录/注册/首页授权入口与通用后续流程 | 扩展 provider adapter 和静态配置 |
| 流程弹窗 | `LoginOperateModal/*` | 已覆盖选择注册/关联、补填、关联已有账户 | 复用现有状态机，按统一 UI model 消费 |
| 个人中心 | `ThirdBindModal`、`ThirdBindItem`、`ThirdVerifyModal` | 已覆盖绑定、解绑和二次验证 | 扩展 `authUsers` provider 项 |
| API | `services/api/thirdLogin.ts` | 通用 OAuth 接口已存在；HiChat 有专属接口 | 通用接口优先；渠道换 token 通过 adapter 隔离 |
| 状态 | `ThirdPartyLogin/store.ts` | Zustand 只保存当前授权流程 UI 状态 | 保留本地 UI 状态；用户绑定数据继续归 React Query |
| 用户资料 | `services/api/user.ts` 的 `authUsers` | 已是多 provider 集合形态 | 扩展 item schema，不新增 provider 专属平铺字段 |
| 埋点 | 现有 `login_third_party_click` / `register_third_party_click` | 已支持 provider property | 最终事件口径待 PM/数据确认 |

## 单一事实源与所有权

| 事实 / 状态 / 规则 | 权威来源 / 唯一写入口 | 消费者与派生方式 | 副本策略 |
|--------------------|-----------------------|------------------|----------|
| 账户与 provider 绑定关系 | 后端数据库 / OAuth 服务 | `useGetUser()` 返回 `authUsers`，组件派生绑定状态 | 前端不持久化副本 |
| 当前授权流程 provider/token | `useThirdLoginStore` | 流程弹窗与安全验证读取 | 流程关闭/成功后 reset，不进 localStorage |
| OAuth state/nonce/code | 后端授权服务为安全真值源 | callback 只消费校验后的结果 | 前端只保留短生命周期跳转上下文 |
| Provider 静态配置 | `thirdConfig.ts` / provider adapter map | 入口、图标、授权动作统一 resolver | 单一常量表 |
| Server state | React Query | 用户资料、绑定结果刷新 | 不复制到 Zustand |

## 目标分层

```text
Login/Register/Home/User UI
  -> ThirdPartyLogin flow controller
    -> provider adapter (Google/Apple/HiChat/Telegram/Facebook)
      -> React Query mutation hook
        -> thirdLogin API service
          -> unknown response
            -> runtime schema
              -> unified auth UI model
```

## Provider Adapter 候选契约

```ts
interface ThirdLoginProviderAdapter {
  provider: ThirdType
  authorize: () => Promise<ThirdAuthorizationResult>
}

interface ThirdAuthorizationResult {
  provider: ThirdType
  credential: string
  transport: 'popup' | 'redirect'
}
```

- 这里只锁定职责形状，不代表最终代码必须使用完全相同的命名。
- popup/redirect callback、SDK 原始字段和渠道换 token 逻辑不得散落在业务 JSX。
- 现有 `thirdLogin.ts` 中相关裸 `any` 在触达时收敛为命名 Params 和 runtime schema，不扩大改动范围。

## 数据流与分层契约（请求型功能 G4 前必填）

> 调用链 `Component → Hook → Service`；数据链 `response → schema → mapper → UI Model`。无请求的纯 UI 填 N/A 并说明。

| Feature / Component | Hook | API Service | Response Schema / DTO | Mapper | UI Model | State Owner | Test |
|---------------------|------|-------------|-----------------------|--------|----------|-------------|------|
| F01/F03 授权登录（`ThirdPartyLogin`、`HomeThirdLogin`） | `useThirdAuth` → `useAuthLogin`（RQ mutation） | `POST /fe-ex-api/oauth/authLogin`（`{source, idToken}`） | `UserDataSchema`（`store.ts`：source/token/authStatus/email/mobile） | `pickToken`/`resolveStatusCode` resolver（token 与 authStatus 归一） | `UserDataType` | 授权态 Zustand `useThirdLoginStore`；server 态 RQ mutation | `pickToken`/`resolveStatusCode` 纯函数单测 |
| F02 渠道字段差异（TG 无邮箱 / FB 邮箱可选） | `useThirdAuth` | 同 authLogin | `UserDataSchema` 的 `email?/mobile?` 可空 | `handleAuthResult` 按 `email\|\|mobile` 派生补填账号 | `UserDataType` | `useThirdLoginStore` | 三态分发单测（0/1/2） |
| F04 注册新账户（`RegByThird`/`CreateByThird`） | `useAuthRegister`/`useRegisterCheck` | `POST /oauth/authRegister`、`/oauth/newRegisterCheck` | 复用 authLogin 响应契约 | 复用 resolver | `UserDataType` | `useThirdLoginStore` | 契约测试 + MSW 场景 |
| F05 关联已有账户（`UniteByThird`） | `useJoinAddAccount`/`useJoinAddAcc` | `POST /oauth/joinAddAccount`、`/oauth/internalJoinAuth` | 复用响应契约 | 复用 resolver | `UserDataType` | `useThirdLoginStore` | 契约测试 + MSW 场景 |
| F06 渠道接入配置 | N/A（静态配置） | N/A | N/A | `thirdConfig.ts` 分环境 lookup（Google/Apple/TG/FB client id） | 配置常量 | 模块常量（`isTest` 分支） | 配置解析无需单测 |
| 三方凭证归一（TG=id_token / FB=accessToken） | `authorizeThird`（`providerAdapters.ts`） | N/A（SDK 直取，非请求） | 外部 SDK 数据先经 `ThirdCredential` 归一（`unknown` 收敛） | `authorizeTelegram`/`authorizeFacebook` → `ThirdCredential`（FB accessToken 赋给 idToken） | `ThirdCredential` | 无（一次性凭证） | adapter 归一单测 |
| F09 个人中心账户绑定（`User/SafeSetting`） | 复用现状 `authUsers` 展示 | 复用现状用户资料接口 | 复用现状 schema | 复用现状 mapper | 现状用户资料 UI Model | 现状 | 绑定/解绑状态展示 |
| F14 埋点（`click_tg_login`/`click_fb_login`） | `capture()` 埋点 | PostHog 上报（非业务请求） | N/A | 事件属性映射（端/来源页/user_status） | N/A | PostHog | 事件触发断言 |

分层例外：F10/F13 管理后台落 `apps/admin`（Vue2 legacy-admin），不适用 React 分层契约，属既有技术栈事实；F06 与埋点为静态配置/上报，无 schema/mapper 改动。

## 状态与错误处理

| 输入 | 统一语义 | 前端动作 |
|------|----------|----------|
| `authStatus=0` | 未绑定 | 打开注册/关联选择流程 |
| `authStatus=1` | 已绑定且允许登录 | 写入统一登录 token、刷新会话并跳首页 |
| `authStatus=2` | 已有 FameEX 账号，必须安全关联 | 打开关联已有账户流程 |
| 明确错误码 | 冻结、注销、受限、重复绑定、第三方超时等 | 通过错误码 resolver 展示固定文案 |

## MSW 决策

- API 未 ready 时采用 MSW 路线 B。
- 预期资产：handler、fixture、runtime schema、contract test、browser worker 注册。
- dev/test 可启用；pre/prod 不注册 worker。
- 关闭 handler 即回真实接口，业务组件和 service 不改代码。

## 仍待 PM / 后端确认

- 首页具体入口、入口顺序、按钮形态与固定文案。
- Telegram/Facebook SDK/OAuth 产品方案已按官方最新文档确认（TG=OIDC `telegram-login.js`；FB=手动 code 模式，`email` 无需 Meta 审核）；仍待各环境 Bot/App 账号 readiness 与 owner。
- 注册/关联/解绑业务规则、后台交付、埋点和验收口径。
- API 字段、错误码、callback 参数和 YApi 文档。
