# TR-02386 交接文档（登录 / 注册 / 三方登录 / 引导绑定邮箱迁移）

> 生成时间：本会话末。接手方请**先完整读本文件再动手**。
> 关联任务：TR-02385（TradFi 迁移，后做）、**TR-02386（登录/注册，先做）**。
> 主仓：`/Users/aven/github/fameex-web`；迁移目标 app：`apps/web-next`；legacy 只读参照：`apps/web`。

---

## 0. 最重要：先按 worktree 规则开环境，别重蹈覆辙

上一段会话最大的教训：**把"从 online 切任务分支"当成了在现有 worktree 里 `git switch -c`，直接在 `PR-02074`（预测市场三期的活跃 worktree，停在 `feature/PR-02074`）里原地切了分支**，还起错了名 `feat/TR-02386-login-register`。后果：
- 劫持了 PR-02074 的 HEAD；
- 原地切 HEAD 触发了 docs_tdd 的 rule-consumption ledger「HEAD 变更审计」（旧 head↔新 head 差异 949 文件，逐文件 hash），每次写钩子都跑满 20s 被 kill → 写操作反复超时死锁。

**接手方务必先读 `common/rules/rule-router.md` → `common/rules/coding-worktree.md`，然后按标准流程建独立 worktree：**

```bash
# 主仓执行；脚本会：从 origin/online 切分支、基线校验、挂 docs_tdd 软链、装依赖、起 dev、curl 校验
cd /Users/aven/github/fameex-web
node apps/web/docs_tdd/common/engine/agent-scripts/prepare-coding-worktree.mjs TR-02386 --dry-run
node apps/web/docs_tdd/common/engine/agent-scripts/prepare-coding-worktree.mjs TR-02386
```

- 目标：worktree `/Users/aven/github/TR-02386`，分支 `feature/TR-02386`，基于最新 `origin/online`。
- ⚠️ 脚本示例的编号格式是 `PR-xxxxx`；**若脚本拒绝 `TR-` 前缀，先确认编号规范或用规则 §4 手动兜底**（`git worktree add ../TR-02386 -b feature/TR-02386 origin/online` + 基线校验 + `ln -s` 挂 `apps/web/docs_tdd` 软链）。这一步我没验证过 `TR-` 前缀是否被脚本接受，请接手方先 dry-run。
- **实际编码请在以 `/Users/aven/github/TR-02386` 为 cwd 的新 pi 会话里进行**（docs_tdd 钩子/ledger 按 worktree+session 绑定；跨 worktree 写会引发上面那类 ledger 问题）。

### 需要先清理的遗留（我没能清掉，写钩子在死锁中）

```bash
cd /Users/aven/github/fameex-web    # 或任一该仓 worktree
git branch -D feat/TR-02386-login-register       # 我误建的分支（在 f24452ef55），删掉
```

- PR-02074 已恢复到 `feature/PR-02074`（正确），**不要在 PR-02074 里做 TR-02386**。
- 若在旧会话里遇到写超时：那是 `PR-02074/output-tdd/rule-consumption/b52eb747bb414f616a94647a.json` 这份 session ledger 的 `head` 停在 `f24452ef55` 与当前 HEAD 不符所致。**换到新 worktree 的新会话即可规避**；或手动删除该 ledger + 其 `.lock` 让钩子按当前 HEAD 重建（属清理被切分支打脏的 session 记账，不绕过规则）。

---

## 1. 任务范围（TR-02386）

迁移到 `apps/web-next`：**登录、注册、三方登录（Google/Apple/Telegram/HiChat，Facebook legacy 已隐藏）、引导用户绑定邮箱**。属 **P0 鉴权**，High-Risk。

### Legacy 只读参照（apps/web）
- 登录：`apps/web/src/apps/Login/**`（index / LoginForm / InputAccount / ScanCode / Fallback）
- 注册：`apps/web/src/apps/Register/**`（RegisterV2: CreateAccount / CreatePassword / RegisterFormV2 + common: const / useCode / Fallback）
- 设置密码：`apps/web/src/apps/SetLoginPassword/**`
- 三方：`apps/web/src/components/ThirdPartyLogin/**`（hooks/useThirdAuth、common/resolveThirdAuthOperation、LoginOperateModal/*）
- SDK：`components/{TelegramLoginSdk,GoogleLoginSdk,AppleLoginSdk,FacebookLoginSdk,ChannelLogin}/**`、`components/VerifyMan/**`
- API 契约：`apps/web/src/services/api/login.ts`、`apps/web/src/services/api/thirdLogin.ts`
- 路由：`app/[lang]/(with-header)/{login,register,login-resetpass}`

---

## 2. P0-1 契约/依赖盘点结论（已读码得出，直接用）

**web-next 的鉴权基建比预期完整得多，缺口很集中。**

### 已存在、直接复用（不要重写）
- 加密：`apps/web-next/src/platform/sign-key/encryptPasswordWithKey.ts`（`#platform/sign-key`）
- 端点（`platform/domain/web/WebHttpApi.ts` 的 `OAuthApiGroup`）：`authLogin`、`authRegister`、`newRegisterCheck`、`checkAccount`、`joinAddAccount`、`confirmLogin`、`getHichatUserStatus`、`hichatRegisterAndBind`、`hichatBindExistingAccount`
- 端点（`CommonApiGroup`）：`getGeetestV3Params`、`getCountryCode`、`getEmailValidCode`、`getSmsValidCode`
- mutation：`services/hooks/auth/authLoginMutation.ts`、`services/hooks/auth/confirmLoginMutation.ts`
- 组件：`components/ThirdPartyLogin/**`（store + LoginOperateModal 全套：CreateByThird/RegByThird/UniteByThird/SelThirdType/HiChatSucModal/TermsAgreement + test）、`components/VerifyMan/**`、`components/CodeVerifyDialog/**`（含枚举 `VerifyType`/`OperationTypeEnum` in `verificationTypes.ts`）
- 扫码登录：`services/subscription/wsfapi-public-business/login-qrcode/**`

### 缺口（本次要新建）
1. **账密登录数据层（Stage 1，未完成，见 §3）**
   - `loginInEndpoint`：`POST /fe-ex-api/v6/user/login_in`，对 `mobileNumber`+`loginPword` **双重 `encryptPasswordWithKey`**，`verificationType:'2'`（极验）、`token:true`、`nc:null`，可选 `utm_source`/`hichatToken`；返回 `{ type, token }`。
   - `getValidateSwitchEndpoint`：`POST /fe-ex-api/user/getValidateSwitch`，返回 `{ validateSwitch }`（0 关闭跳过 2FA / 1 开启）。
2. **页面/路由层**：`apps/web-next/src/apps/Login/**`、`apps/Register/**`、`SetLoginPassword`、`routes/(main)/(with-header)/{login,register,login-resetpass}`。
3. **支撑件**：`AccountInput`、绑定邮箱引导（legacy `MailBinder`）、web-next 的 `OperationTypeEnum` 缺 `EmailLogin`（现只有 Register/PhoneLogin/thirdBind）。
4. **i18n（仅 zh-CN）**：`login.json`、`register.json`、`thirdLogin.json`，并逐条清掉 §5 的 6 条三方登录 TODO。

### 关键契约细节（来自 legacy `services/api/login.ts`）
- `login_in` 的 `mobileNumber` 与 `loginPword` **都要加密**（`encryptPasswordWithKey`）；`verificationType:'2'` 为极验。
- 登录成功后：`setToken(quicktoken)` → 弹绑定邮箱（`MailBinder`）→ posthog `login_complete` → 跳 `from || HOME`。
- 2FA 开关关闭（`validateSwitch=0` 且 `isSkipLogin2FAFetched`）时走 `loginWithSkip2FA`：submit 后直接以 `type=google, authCode=''` confirm。
- `VerifyType` 枚举：`Google='1'`、`SMS='2'`、`Email='3'`。

---

## 3. Stage 1 未完成的落盘内容（写通道死锁前已备好，请在新 worktree 重建）

我在 PR-02074（错误位置）短暂写过后已删除。以下两份内容请在新 worktree 的 `apps/web-next/src/platform/domain/web/endpoints/` 下重建，并加入 `WebHttpApi.ts` 的 `OAuthApiGroup`，随后补账密登录 mutation（加密收敛在单一可测点）+ skip-2FA query + 加密单测。

### `loginInEndpoint.ts`
```ts
import * as Schema from 'effect/Schema'
import * as HttpApiEndpoint from 'effect/unstable/httpapi/HttpApiEndpoint'
import { apiResponseEnvelopeSuccessSchema } from '#platform/domain/shared/ApiResponseEnvelope'

export const LoginInResultSchema = Schema.Struct({
  type: Schema.optional(Schema.NullOr(Schema.Union([Schema.String, Schema.Number]))),
  token: Schema.optional(Schema.NullOr(Schema.String)),
})
export type LoginInResult = typeof LoginInResultSchema.Type

export const LoginInEndpoint = HttpApiEndpoint.post('loginIn', '/fe-ex-api/v6/user/login_in', {
  payload: Schema.Record(Schema.String, Schema.Unknown),
  success: apiResponseEnvelopeSuccessSchema(LoginInResultSchema),
})
```

### `getValidateSwitchEndpoint.ts`
```ts
import * as Schema from 'effect/Schema'
import * as HttpApiEndpoint from 'effect/unstable/httpapi/HttpApiEndpoint'
import { apiResponseEnvelopeSuccessSchema } from '#platform/domain/shared/ApiResponseEnvelope'

export const ValidateSwitchResultSchema = Schema.Struct({
  validateSwitch: Schema.optional(Schema.Number),
})
export type ValidateSwitchResult = typeof ValidateSwitchResultSchema.Type

export const GetValidateSwitchEndpoint = HttpApiEndpoint.post(
  'getValidateSwitch',
  '/fe-ex-api/user/getValidateSwitch',
  {
    payload: Schema.Struct({}),
    success: apiResponseEnvelopeSuccessSchema(ValidateSwitchResultSchema),
  },
)
```

### `WebHttpApi.ts` 注册（加进 OAuthApiGroup）
```ts
import { GetValidateSwitchEndpoint } from '#platform/domain/web/endpoints/getValidateSwitchEndpoint'
import { LoginInEndpoint } from '#platform/domain/web/endpoints/loginInEndpoint'
// ...
export const OAuthApiGroup = HttpApiGroup.make('oauth')
  // ...现有 endpoints...
  .add(LoginInEndpoint)
  .add(GetValidateSwitchEndpoint)
```

> 建议：账密登录 mutation 包一个 `useSubmitLogin` 之类的 hook，把 `encryptPasswordWithKey(mobileNumber)` / `encryptPasswordWithKey(loginPword)` + `verificationType:'2'`/`token:true`/`nc:null` 的 body 组装收敛到**单一处**并加单测，避免像 legacy 那样在页面里散落、或忘记加密（见 §5 CreateByThird 的明文教训）。

---

## 4. 分阶段实施计划（每阶段可独立验证）

1. **P0-1 数据层**（Stage 1，见 §3）：`loginIn` + `getValidateSwitch` 端点/mutation/query + 加密单测。→ 验证：加密 body 组装单测通过、类型通过。
2. **P0-2 SDK 适配层**：Telegram/Google/Apple/(Facebook 隐藏)/HiChat SDK 加载；**首页 Google GSI 叠层补 `clip-path`**（见 §5）。→ 各渠道按钮可点、不点穿。
3. **P0-3 账密登录 + 扫码登录**：LoginForm/InputAccount/ScanCode + 四态（loading/empty/error/disabled）。
4. **P0-4 注册 + 设置密码 + 绑定邮箱引导**：RegisterV2 三步 + SetLoginPassword，账号走密文。
5. **P0-5 三方登录闭环**：`useThirdAuth` + LoginOperateModal + VerifyMan 防重复；**逐条勾掉 §5 的 6 条 TODO**。
6. **P0-6 首页 hero 社交登录接入 + 路由/中间件 locale 回跳**。
7. **i18n（仅 zh-CN）+ 纯逻辑单测**（加密、resolveThirdAuthOperation、防重状态机）。

> 建议顺序：本任务是 P0 鉴权，团队在等；但要用上一段总结出的《迁移完成核对清单》逐项过（状态四态 / 缓存 queryKey 维度 / 业务字段派生 mapper / 交互等价 / 静态资源 / 公共元素放置层级 / 共享组件透传口 / 组件 300 行 / 像素对齐 / i18n）。

---

## 5. 打开三方登录前必须对齐 legacy 的 6 条 TODO

来源：`apps/web-next/docs/page-migration.md`（提交 `f19082a299` 登记）。这些正是"渲染出来≠功能等价"的坑：

- [ ] **HiChat 回跳参数**：首页 `validateSearch` 与 `HomeSocialLinks` 只认 `gToken`，legacy 实际是 `grant_token`（`GRANT_TOKEN`）。不对齐则回跳后不查 `check_user_status`，自动登录/注册/关联静默失效。
- [ ] **HiChat 状态查询失败要有反馈**：`HomeSocialLinks` 只听 `data`，未处理 `isError`，失败要给错误提示。
- [ ] **`CreateByThird` 账号加密**：`newRegisterCheck` 的 `mobileOrEmailNumber` 必须 `encryptPasswordWithKey`；当前打明文，Telegram「注册新账号」会被后端拒。
- [ ] **`VerifyMan` 防重复提交**：对齐 legacy——先 `authPassed=false` 再 `doneVerify`；确认按钮吃 `isLoading`；`UniteByThird` 把 pending 传进去。漏了会重复打关联接口。
- [ ] **`createDesc` 插值渠道名**：legacy 用 `{{thirdName}}`；web-next zh-CN 写死「Apple 账户」，Telegram 走同一创建页会显示错渠道。
- [ ] **首页 Google GSI 叠层补 `clip-path`**：对齐 `GSI_OVERLAY_CLASS_NAME`（`overflow-hidden [clip-path:inset(0)] opacity-[0.01]`）；少了在 HTTPS/FedCM 下会点不了或点穿旁边图标。

对照文件：`apps/web-next/src/routes/(main)/(with-footer)/index.tsx`、`apps/Home/components/FafaAndAnniversaryBanner/HomeSocialLinks.tsx`、`components/ThirdPartyLogin/LoginOperateModal/{CreateByThird,UniteByThird}.tsx`、`components/VerifyMan/index.tsx`、`i18n/resources/zh-CN/thirdLogin.json`。

---

## 6. i18n 约束
- Web 项目翻译**只加/改 zh-CN**（`zh_CN`），不动其他语言。
- key 用字面量内联 `t('ns:literal.key')`；枚举→文案映射的 **map value** 必须是字面量 `t()` 调用；渠道名等用插值 `{{thirdName}}`，不要写死。

---

## 7. 待办给 docs_tdd（与本任务分开，别混入 feature 分支）
可选改进建议：`rule-context-hook` 的「HEAD 变更审计」应加**文件数上限/超时**，或在检测到 worktree 切分支时**自动重基线**，避免像本次那样一次切分支就让写钩子连续超时死锁。属 `docs_tdd` 仓改动。

---

## 8. 现状快照
- 主仓：`/Users/aven/github/fameex-web`（worktree list：fameex-web、PR-02074[feature/PR-02074]、PR-02233[feature/PR-02233]）。
- PR-02074 已回到 `feature/PR-02074`（活跃：预测市场三期，端口 4108），**勿在此做 TR-02386**。
- 遗留：分支 `feat/TR-02386-login-register`（@ f24452ef55）待删；本任务尚**未建正式 worktree**、未落任何 TR-02386 代码。
- `origin/online` 最新（切分支基线）：切前务必 `git fetch origin online`。2026-09-15 经用户再次确认，虽然迁移通知曾提到 `feat/PR-01812`，该分支现已上线，本任务仍从 `origin/online` 切出。
