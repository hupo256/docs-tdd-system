<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# Collaboration — PR-02172 【登录注册】增加第三方（tg、facebook）

> 2026-08-03 当前负责人确认 C01-C18；主要 Web/Admin 功能已进入 G8。2026-08-21 正式 Figma 到位，本轮只同步 UI 与相关文档，授权流程、交互和 API 复用既有实现。
>
> **2026-09-04 最终裁决（aven）**：17:48–18:15 会话截图覆盖旧版 3+2 与临时 3+1 方案。登录/注册隐藏 Facebook，剩余 Google、HiChat、Apple、Telegram 按固定顺序排成等尺寸 2×2：第一行 Google/HiChat，第二行 Apple/Telegram。首页、个人中心以及 Telegram/Facebook 授权、绑定、SDK、API、埋点均不变。

## Figma UI 同步结论（2026-08-21）

| 模块 | 正式节点 | 结论 | 明确不变 |
|------|----------|------|----------|
| 登录 / 注册 | `19782:4920` | 固定 3+2：Google / HiChat / Apple；Telegram / Facebook；40px 高、`CC-3`、12px 设计圆角 | Google One Tap、各 provider 授权、埋点、0/1/2 三态 |
| 账户绑定 | `19936:2518` | 只改用户截图红框：TG/FB 行品牌图标与五行右侧关联按钮；弹窗恢复共享 16px 圆角 | 行文案、账号状态、绑定/解绑分发、安全验证、接口 |
| 首页 | `19800:10744`（原子 `19800:11142`） | 沿用 Banner `HomeThirdLogin`；顺序 Google / Apple / HiChat / TG / FB；各 40×40，QR 40×40 | 下载浮层、跳转、授权流程与首页其他布局 |

- 12px 圆角按项目 `visualFidelity: standard` 映射为 `rounded-m`（8px）；15px blur 映射 `backdrop-blur-lg`（16px），不修改全局 preset。
- Telegram/Facebook 使用仓库 `packages/figma-icon` 的品牌双色 SVG 源，不再使用单色字体图标。
- 详细原子节点、token 链与响应式规则见 `07-figma-spec.md`。

## 官方文档核对更正（2026-08-03，curl 直取官方最新文档）

> 来源：`core.telegram.org/bots/telegram-login`（新版）、`developers.facebook.com/docs/facebook-login/*`。以下更正推翻早期基于旧知识的假设，评审以本节为准。

| # | 更正点 | 影响 |
|---|--------|------|
| D1 | **Telegram 已改为标准 OIDC**（Authorization Code + PKCE）。旧的 iframe Login Widget（返回 `{id, hash, auth_date}`、后端用 bot_token 做 HMAC-SHA256 校验）已被官方**归档为 legacy**。新版前端 `telegram-login.js` 的 `Telegram.Login.auth()` 回调直接返回 **`id_token`（OIDC JWT，默认 RS256）**，后端按标准 JWKS 验签（`iss=oauth.telegram.org`、`aud=bot_id`、`exp`）。 | **Q53 前提作废**；TG 与现有 Google/Apple 的 `id_token` 流程同构，adapter 归一后无需 TG 专属校验分支 |
| D2 | Telegram 配置从「裸 bot_token」变为 **BotFather → Bot Settings > Web Login 注册 Allowed URLs → 获取 Client ID + Client Secret**。 | 更新 B5/C08 环境账号申请口径 |
| D3 | `telegram-login.js` popup 依赖跨窗口通信：站点若发 `Cross-Origin-Opener-Policy: same-origin` 会掐断登录，必须改 `same-origin-allow-popups` 或移除。 | 新增前端/运维核对项 |
| D4 | **Facebook `public_profile` 与 `email` 权限已不再需要 App Review**，所有 app 自动授予。 | **Q12 / B5「Meta email 审核」阻塞项撤销**，主流程无阻 |
| D5 | ~~Facebook 决定走**手动 code 模式**：popup 开 `/v26.0/dialog/oauth?response_type=code&scope=public_profile,email&state=…`，回调拿 `code` 由后端用 app secret 换 token（app secret 不进前端）。~~ **已被 D6 撤销（2026-08-11）**。 | 明确 A2/Q08 结论（已过期，见 D6） |
| D6 | **2026-08-11 后端定案更正**：Facebook 改为与 App 端统一，走 **Facebook JS SDK**（`developers.facebook.com/documentation/facebook-login/web`）在前端直接 `FB.login()` 拿 `accessToken`，**不再走 D5 的 OAuth code + 回调页 + 后端换 token**。前端已移除 `FacebookCallback.tsx` 与 `/oauth/facebook/callback` 路由，新增 `FacebookLoginSdk` 组件（镜像 `GoogleLoginSdk`）。Telegram 仍为方案 A（`id_token` + 后端 JWKS 验签），不受影响。 | 撤销 D5/Q08/后端待办 2；前端凭证形态由 `code` 变为 `accessToken` |

## 后端接口对接说明（前端整理，待后端确认，2026-08-03）

> 前端 spike 已完成（见 02-technical-design TD06/TD07）。前端统一走 `authLogin` 入口提交凭证，凭证形态按 provider 归一（见下）。后端需补三块，请对照确认。

### 契约总览：前端提交什么

前端各渠道授权后，把凭证收敛为统一形状 `{ source, credential }` 送后端（现复用 `authLogin({ source, idToken })`，Facebook 的 `code` 也塞进 `idToken` 字段）：

| provider | credential 内容 | 后端处理 |
|----------|-----------------|----------|
| Google / Apple | `id_token`（OIDC JWT） | 现有逻辑，JWKS 验签 |
| **Telegram（新增）** | `id_token`（OIDC JWT，默认 RS256） | **新增**：JWKS 验签，同 Google/Apple 套路 |
| **Facebook（新增）** | ~~`authorization code`（**非** token）~~ → **`accessToken`（SDK 直取，见 D6）** | **新增**：后端用 `accessToken` 查 Graph API `/me` 取 profile，不再需要 App Secret 换 token 这一步 |
| HiChat | `grant_token`（URL 回流） | 现有 `getUserStatus` 逻辑 |

### 后端待办 1 — Telegram id_token JWKS 验签（新增）

- Telegram 已改为标准 OIDC（见 D1），前端拿到的是 **OIDC JWT**，不是旧版 `hash + auth_date`，**后端不要再用 bot_token 做 HMAC 校验**。
- 后端拉 Telegram JWKS 公钥验签，并校验：`iss = oauth.telegram.org`、`aud = bot_id`、`exp` 未过期。默认算法 RS256。
- 需运维/后端提供：Telegram Bot 的 **Client ID**（BotFather → Bot Settings → Web Login 注册后获取，**不是裸 bot_token**），并注册各环境 origin 到 Allowed URLs（见 D2）。

### 后端待办 2 — Facebook accessToken 查 profile（2026-08-11 更正，见 D6）

> 原「code 换 token」方案已撤销，以下为最新方案。

- 前端 `FB.login()` 直接拿到 **accessToken**（非 code），后端收到后向 Graph API `graph.facebook.com/{version}/me?fields=id,name,email&access_token=...` 校验并取 profile，**不再需要 App Secret 换 token 这一步**。
- `public_profile` / `email` 已无需 App Review、自动授予（见 D4）。
- 需运维/后端提供：各环境 **Meta App ID**（App Secret 若仅用于服务端校验 token 有效性可选保留，具体看后端是否调用 `debug_token`）。
- 不再需要固定回调地址 `/oauth/facebook/callback`（SDK 模式无重定向），该路由与 `FacebookCallback.tsx` 已从前端移除。

### 后端待办 3 — state / nonce 服务端下发（防 CSRF / 重放）

- 前端现用 `crypto.randomUUID()` 临时生成 `state`（Facebook）/ `nonce`（Telegram OIDC）**仅 demo 兜底**，正式方案改为服务端签发。
- 需后端提供「签发 + 校验」能力：授权发起前前端取一次性 `state`/`nonce`，回调后由后端校验一致且未被使用。请给出路由与出入参。

### 需后端明确回答的 3 个问题

1. 三方登录是复用现有 `authLogin` 按 `source` 分支，还是新开 endpoint？字段名沿用 `{ source, idToken }`，还是为 Facebook 单列 `code` 字段？
2. 各环境 **Telegram Client ID / Meta App ID + App Secret** 由谁提供、何时能给？（前端 `thirdConfig` 现为空占位 `TODO(B5/C08)`，等此值填入）
3. state/nonce 的签发/校验接口路由与出入参？id_token/token 过期时的**错误码**与「重新授权」提示文案？（关联 Q53）

## 2026-08-04 落地进展（Client ID 到位 + 密钥口径更正 + 本地开发结论）

> D1/D2 已实锤：@BotFather → Bot Settings → **Login Widget → Switch to OpenID Connect Login**（弹窗警告 permanently disables legacy，**不可逆、每 bot 一次性**）。TG 确为标准 OIDC，与老版 `{id,hash}`+bot_token HMAC 二选一，老版切换后永久关闭。

**Client ID / App ID 已填入 `thirdConfig.ts`（均为公开值，可进代码）：**

| 环境组 | Telegram Client ID | Facebook App ID |
|--------|--------------------|-----------------|
| isTest（dev/pre/test 共用测试 bot/app） | `8904904266`（@fameex_login_test_bot） | `2802166923501452` |
| prod（独立生产 bot/app） | `8841057249`（@fameex_login_prod_bot） | `1592698835583337`（Fameex_login_prod） |

- 惯例同 Google/Apple：`isTest ? testId : prodId`。测试/生产 bot·app 均已建齐并填入 `thirdConfig.ts`。
- 控制台白名单分家：测试 bot/app 只放 dev/pre/test 三 origin（`dvmkgi.vip` / `azmgb.com` / `pfyys.com`）；生产 bot/app 只放生产/预备域名（`fameex.com` / `fameexbtc.com:17801` / `vsgpk.com` / `fameex.asia` / `canary.fameex.com`）。两边都**不放 localhost**（本地走桩）。
- **TG 生产 bot 提醒**：OIDC 走的是 **Trusted Origins**（跨域取 token），不是 Redirect URIs——生产 bot 的 Trusted Origins 须把上述生产 origin 补齐，否则 popup 被拒。
- FB 生产 app 尚「未发布」且缺应用图标/隐私政策/数据删除/类别等提交项；`public_profile`/`email` 走标准登录无需 App Review，但**上线前需把 app 切到 Live 并补齐基础资料**。

**给后端的密钥更正——TG 分两条路，取决于后端选哪条（2026-08-04 curl 官方文档核实）：**

官方 `core.telegram.org/bots/telegram-login` 明确 Web 有两条落地路径：

| 路 | 前端 | 后端验签需要 |
|----|------|--------------|
| **(A) JS 库 popup（前端现状）** | `Telegram.Login.auth()` 直接回 `id_token` | **仅公开 JWKS**（`oauth.telegram.org/.well-known/jwks.json`）验签 + 校 `iss=https://oauth.telegram.org`、`aud=<bot Client ID>`、`exp`、`nonce`。**无需 Client Secret、无需 bot token** |
| (B) 标准 Code+PKCE redirect | redirect `/auth?response_type=code` | 需 **Client Secret**（`/token` 端点 `Basic base64(client_id:client_secret)`）+ PKCE(S256) |

- 前端已实现 A 路（[providerAdapters.ts](../../../src/components/ThirdPartyLogin/common/providerAdapters.ts) `authorizeTelegram`，已带 `nonce`）。**走 A 后端零私钥**；仅当后端改走 B 才需 TG Client Secret。
- **FB App Secret 仍为必须**（code 换 token）。~~TG bot token~~ 两条路都不需要（只服务 Bot API / 已永久关闭的老版 HMAC）。
- 所有私钥只私发、勿进代码/群/git。Client ID / App ID 为公开值，已进代码。
- OIDC 发现文档：`https://oauth.telegram.org/.well-known/openid-configuration`；scope 中 `openid` 必带，`profile` 取 name/username/picture。

**COOP 实测非必需（撤销强制项）：** 主文档（dvmkgi.vip）响应头未设 COOP = 默认 `unsafe-none`，popup 回调即通。只需运维**别下发 `COOP: same-origin`**；若因其他安全需求要设，用 `same-origin-allow-popups`。

**本地开发结论（方案 A）：** localhost 无法进 TG/FB 白名单（强制 HTTPS + origin 含端口精确匹配），本地继续走 `DevThirdLoginDemo` 桩跑三态逻辑；真实 TG/FB 授权在已部署 dev 环境 `https://www.pfyys.com` 验证。（若需本机断真流程，可 hosts 劫持 + mkcert + 443 反代伪装成白名单 dev 域名，非常规不默认做。）

**验收：** code-rules + msw-manifest PASS、改动文件 tsc 0；prd-intake FAIL 为 G2 PRD 原文未归档的既存 blocker，非本次改动回退。

## 已确认技术决策（当前负责人 / 2026-08-03）

| 项 | 结论 |
|----|------|
| 本项目范围 | Web + Admin；App 由 PM 拆单 |
| 前端架构 | 复用 `ThirdPartyLogin`，新增 Telegram/Facebook provider adapter |
| API | 通用业务接口优先复用 `/fe-ex-api/oauth/*`，渠道专属接口只处理授权换 token |
| Provider | `Telegram`、`Facebook` |
| 授权状态 | 沿用 `0=未绑定`、`1=直登`、`2=强制关联` |
| Web 授权 | popup 优先，redirect 降级，统一本站 callback |
| OAuth 安全 | 前端携带 state/PKCE 信息；后端负责生成/校验、换 token、防重放 |
| Mock | API 未 ready 使用 MSW 路线 B |
| 用户绑定数据 | 扩展 `authUsers[]`，至少含 provider/bindStatus/maskedAccount |
| 数据边界 | SDK/接口数据以 `unknown` 进入 runtime schema，再映射 UI model |
| 解绑 | Web 刷新查询与清理临时状态；后端原子清理 DB/token/cache；Bot 订阅不在本期范围 |
| 阶段纪律 | PM 结论和 G2 前不写业务代码、不创建编码 worktree |

## 本轮简化确认结论（当前负责人 / 2026-08-03）

| ID | 结论 | 状态 |
|----|------|------|
| C01 | 登录、注册、首页和个人中心沿用现有第三方登录/绑定入口，仅扩展 Telegram/Facebook | 已确认；视觉以 2026-08-21 正式 Figma 为准 |
| C02 | 本项目交付 Web + Admin；App 另行拆单 | 已确认 |
| C03 | PRD §5.2.8 整段置灰删除：TG Bot 订阅、消息推送及解绑取消订阅全部不开发、不联调、不验收 | 已确认；截图复核 |
| C04 | 正式 Figma 读取后再定稿 UI | 已完成：三个主节点及原子控件已读取，见 `07-figma-spec.md` |
| C05 | Telegram 优先官方 Login Widget/OIDC 能力，popup 为主、redirect 降级 | 已确认方向；待后端/安全契约 |
| C06 | Facebook 使用官方 OAuth/JS SDK 能力，popup 为主、redirect 降级 | 已确认方向；待后端/安全契约 |
| C07 | 两个平台使用统一 callback 结果模型；参数和临时 token 有效期由后端提供 | 已确认方向；待 API 契约 |
| C08 | 各环境 Bot/App、白名单和 Meta Review owner | 留待技术评审确认 owner 与日期 |
| C09 | popup/Cookie/地区限制时优先 redirect 降级，仍失败展示统一错误态 | 已确认 |
| C10 | 优先扩展 `/fe-ex-api/oauth/*`，统一 token/profile/`authUsers` 契约 | 已确认方向；待 API 字段 |
| C11 | 同渠道账号全站唯一，并发由后端原子校验并返回明确错误码 | 已确认方向；待错误码 |
| C12 | Facebook 同邮箱或 Telegram 无邮箱时必须补充身份验证，不得仅凭同邮箱直接关联 | 已确认原则；补填字段待契约 |
| C13 | 允许三方创建无密码账户，成功后明确引导设置密码 | 已确认；触发字段/页面待契约 |
| C14 | 允许一个 FameEX 账户绑定多个不同渠道；解绑后无可用登录方式时禁止解绑 | 已确认 |
| C15 | 冻结、注销、受限、超时等由后端返回明确错误码，前端展示固定文案 | 已确认方向；错误码/逐字文案待提供 |
| C16 | 个人中心展示渠道、绑定状态和脱敏账号；必需字段缺失显示 `--` | 已确认 |
| C17 | Admin 本期做，沿用项目现有后台字段、权限、脱敏、筛选、导出和审计规则 | 已确认；实现落点需复用盘点 |
| C18 | 埋点沿用现有第三方登录事件并增加 provider；数据/QA 补正式契约、账号和兼容矩阵 | 已确认方向；资料待提供 |

## PM / 评审剩余待确认表

| # | 剩余待确认 | 期望输出 | 状态 |
|---|-------------|----------|------|
| PM01 | Figma 是否定稿并覆盖 Web/H5、明暗主题和全部状态 | 可读取设计稿 | 主流程 Web 稿已到位；H5 无独立原子稿，按现有响应式验收 |
| PM02 | App 四种发行包是否同期交付 | App 工单、owner、排期 | 待 PM 拆单 |
| PM03 | Admin 具体落在 legacy admin、`apps/admin` 或两者 | 本项目责任目录与复用落点 | 待技术评审盘点 |
| PM04 | Telegram/Facebook 环境账号、Meta Review 和上线 readiness | 各环境账号 owner、完成日期 | 待会上确认 owner（C08） |
| PM05 | callback、字段、错误码、临时 token、外部撤销授权等 API 契约 | YApi/OpenAPI/后端契约 | 待后端 |
| PM06 | 补填字段、服务条款、忘记密码回跳及邀请关系 | 可执行流程与固定文案 | 待 PM/后端 |
| PM07 | 冻结、注销、受限、重复绑定、第三方超时的逐字文案 | 错误码对应固定文案 | 待 PM/后端 |
| PM08 | 埋点属性、A/B 实验目标 | 数据字典与实验方案 | 待数据/PM |
| PM09 | 验收账号、浏览器/App 版本、QA 用例与兼容矩阵 | QA 资料与验收负责人 | 待 QA |
| PM10 | PRD 白板和 PM-1227/M-0370 参考文档 | 授权、导出或可读取原文 | 待文档 owner |

## 技术评审待确认清单

### A. Scope 与交付归属

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q01 | “登录/注册/首页”中的首页具体是哪一个入口？是现有 `HomeThirdLogin` Banner 图标，还是首页登录弹窗/其他位置？ | 决定页面范围和 UI 形态 | 产品、设计、Web | 已确认沿用现有 Banner `HomeThirdLogin`，视觉节点 `19800:10744` |
| Q02 | PRD §5.3 的 iOS/Android 四种包是否与 Web 同期交付？由哪个团队/工单/仓库负责？ | 当前仓库无法交付 App SDK | 产品、App、项目负责人 | 技术结论：本仓不做；待 PM 拆单 |
| Q03 | 管理后台需求落在 legacy admin、`apps/admin`，还是两个系统都要改？ | 当前 `apps/admin` 未定位到截图对应的完整用户管理页面 | 产品、后台前端、后端 | 本项目做 Admin；具体落点待复用盘点 |
| Q05 | 竞品 35 张截图仅作流程参考，还是其中某套交互要作为 FameEX 设计基线？ | 不能用竞品图替代正式设计稿 | 产品、设计 | 已确认为流程参考，不作视觉基线 |
| Q06 | Figma 是否覆盖 Web/H5/暗色/亮色及所有弹窗状态？ | 决定 visualFidelity 和 UI 验收 | 设计、产品 | Web 三个主节点已读取；颜色使用明暗主题 token，H5 沿用现有响应式 |

### B. OAuth / SDK / 配置

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q07 | Telegram Web 使用 Login Widget、OIDC Login 还是后端中转授权？Web 是 popup 还是 redirect？ | 决定 SDK、回调和 token 类型 | 后端、Web、安全 | 已确认：官方新版 OIDC（`telegram-login.js` popup 返回 `id_token`，redirect 降级），见 D1 |
| Q08 | Facebook Web 使用 JS SDK 还是标准 OAuth redirect？App 是否使用原生 SDK？ | 决定多端实现与审核材料 | 后端、Web、App | 已确认 Web 走手动 code 模式（`/dialog/oauth?response_type=code`，后端换 token），见 D5；App 拆单 |
| Q09 | 两个渠道的 callback URL、popup opener 通信协议、成功/取消/失败返回参数是什么？ | 现有 Apple/Google/HiChat 三种方式不同 | 后端、Web | 待确认 |
| Q10 | OAuth `state`、`nonce`、PKCE、CSRF 和重放防护由前端还是后端生成/校验？ | 登录安全硬要求 | 安全、后端、Web | 技术方向已确认，待后端契约 |
| Q11 | dev/test/pre/prod 各环境的 Telegram Bot、Meta App、client ID、secret、domain whitelist 和 callback 由谁申请维护？ | PRD 明确需提前申请，但无 owner/日期 | 产品、运维、后端 | 待技术评审确认 owner（C08） |
| Q12 | ~~Meta email 权限 App Review 未通过时是否允许无邮箱上线~~ **阻塞撤销（见 D4）**：官方文档明确 `public_profile`/`email` 不再需要 App Review，自动授予。仅保留「用户主动拒授 email → 走无邮箱补填」的分支。 | email 审核不再是排期/主流程阻塞 | 产品、后端、合规 | 已确认无需审核；仅处理用户拒授 email 分支 |
| Q13 | Telegram/Facebook 在受限国家、Cookie/第三方登录被浏览器禁用、popup blocked 时如何降级？ | 现有 Google 已有浏览器限制经验 | 产品、Web、合规 | 已确认 redirect 降级；仍失败走统一错误态 |

### C. 后端 API 与数据契约

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q14 | Telegram/Facebook 是否扩展现有 `/fe-ex-api/oauth/authLogin` 等通用接口，还是新增专属接口？ | 决定是否复用通用状态机或渠道适配层 | 后端、Web | 技术方向已确认，待后端契约 |
| Q15 | `ThirdType`/后端 `source` 的精确枚举值是什么：`Telegram`/`Facebook` 还是小写/数字？ | 类型、埋点、用户资料必须一致 | 后端、Web | 已确认 `Telegram` / `Facebook` |
| Q16 | 授权结果是否继续使用 `authStatus=0/1/2`？“Facebook 同邮箱强制关联”如何表达，返回哪个脱敏账号字段？ | 现有 UI 仅有三态 | 后端、Web | 三态已确认；字段待后端/PM |
| Q17 | 登录成功 token 字段统一为 `token`、`accessToken` 还是 `quicktoken`？ | 当前不同渠道存在三个字段兼容 | 后端、Web | 待确认 |
| Q18 | Telegram/Facebook 原始 profile 字段是否落库；字段长度、空值、username/name 更新策略是什么？ | 影响 schema、数据库和后台展示 | 后端、DBA | 待确认 |
| Q19 | `telegram_id` / `facebook_id` 唯一索引范围是全站、站点还是环境？并发冲突返回哪个错误码？ | PRD 要求只允许一笔成功 | 后端、DBA | 待确认 |
| Q20 | Facebook email 已存在时，是否必须输入目标账户密码，还是可直接进入二次验证？ | PRD 同时写“强制关联”和“不能仅凭同邮箱关联” | 产品、安全、后端 | 已确认不得仅凭同邮箱关联，必须补充身份验证 |
| Q21 | Telegram 无邮箱手机号时，补填允许邮箱和手机二选一吗？是否受站点/国家策略限制？ | 决定表单和验证码流程 | 产品、后端、合规 | 待确认 |
| Q22 | 新注册是否创建无密码账户？个人中心“告知设置密码”的具体触发字段、弹窗/页面和关闭规则是什么？ | 验收标准有要求，PRD 流程未定义 UI | 产品、后端、Web | 已确认允许无密码账户并引导设密；触发契约待补 |
| Q23 | `authUsers` 将返回什么结构？是否含 provider、绑定状态、脱敏账号、外部授权状态、绑定时间？ | 个人中心和后台展示依赖 | 后端、Web | 最小结构已确认，扩展字段待 PM/后端 |
| Q24 | 外部主动撤销授权如何被检测：每次登录校验、定时同步还是 webhook？平台绑定是否立即标记解绑？ | PRD 只描述结果，未定义时机 | 后端、运维 | 待确认 |

### D. 注册、关联与安全验证

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q25 | 新注册前的邮箱/手机查重由独立接口还是注册接口原子完成？如何避免查重后竞态？ | PRD 有重复账号与并发要求 | 后端、安全 | 待确认 |
| Q26 | 服务条款是否沿用当前注册页勾选状态和文案，还是三方补填弹窗单独勾选？ | 影响合规与 UI | 产品、法务、Web | 待确认 |
| Q27 | 关联已有账户的验证顺序是否固定为账号+密码 → 邮箱/手机验证码 → Google 验证？验证码优先级规则是什么？ | PRD引用旧规则但未给可执行契约 | 产品、安全、后端 | 待确认 |
| Q28 | 忘记密码完成后如何回到绑定页并恢复 provider、临时 token、账号和邀请关系？临时 token 有效期多久？ | 跨路由状态恢复风险高 | 后端、Web | 待确认 |
| Q29 | 密码错误阈值、验证码错误锁定、过期和重发规则完全复用哪个现有接口/错误码？ | 避免新流程自行复制安全规则 | 安全、后端 | 待确认 |
| Q30 | 冻结、注销、受限账户的精确定义、错误码与固定文案是什么？ | 验收标准要求分别拦截 | 产品、风控、后端 | 待确认 |
| Q31 | 同一个 FameEX 账户能否同时绑定 Google、Apple、HiChat、Telegram、Facebook？同渠道是否只能绑定一个？ | 影响唯一性与个人中心展示 | 产品、后端 | 已确认可绑定多个不同渠道，同渠道仅一个 |
| Q32 | 解绑是否要求至少保留一种可登录方式？无密码且只绑定一个三方渠道时能否解绑？ | 可能导致账户无法登录 | 产品、安全、后端 | 已确认必须保留至少一种可用登录方式 |
| Q33 | 解绑需要清理哪些对象：绑定记录、access/refresh token、缓存、会话、设备？失败如何补偿？ | PRD 要求“彻底解绑”；已置灰删除的 Bot 订阅不在范围内 | 后端、安全 | 责任边界已确认，具体对象待后端契约 |

### E. UI / 文案 / 交互

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q34 | 登录/注册入口排序是 Google、Apple、HiChat、Telegram、Facebook，还是按地区/端动态配置？ | 当前 UI 是固定枚举顺序 | 产品、设计 | 最终确认：登录/注册隐藏 Facebook，第一行 Google/HiChat、第二行 Apple/Telegram；首页仍为 Google/Apple/HiChat/Telegram/Facebook |
| Q35 | Telegram/Facebook 使用品牌图标按钮还是“继续使用 xxx”整行按钮？首页和弹窗是否同形态？ | 各入口容器形态不同 | 设计、产品 | 已确认：登录/注册为带文字整宽按钮；首页为 40×40 图标按钮；绑定为行内品牌图标 + 右侧操作按钮 |
| Q36 | popup 打开后的 loading、用户取消、窗口关闭、超时和重复点击如何表现？ | 需完整可测试状态 | 产品、设计、Web | 待确认 |
| Q37 | Facebook 同邮箱强制关联弹窗展示完整邮箱还是脱敏邮箱？是否允许切换“注册新账户”？ | 涉及隐私与安全 | 产品、安全 | 待确认 |
| Q38 | 个人中心是否展示 Telegram username/手机号、Facebook email/name？缺失时统一显示 `--` 还是不展示？ | PRD只定义后台日志缺失值 | 产品、设计 | 已确认展示渠道/状态/脱敏账号，必需缺失值为 `--` |
| Q39 | 第三方服务失败固定文案是否统一为“第三方服务暂时不可用，请稍后重试”，还是区分渠道/原因？ | i18n 与错误码契约 | 产品、Web | 已确认默认统一文案；明确业务错误按错误码展示 |
| Q40 | 开发期仅补 zh-CN 文案，其他语言何时由 Tolgee/翻译流程同步？上线是否允许中文 key fallback？ | 多语言上线门禁 | 产品、运营、Web | 待确认 |

### F. 管理后台、日志与权限

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q41 | 用户列表新增的是两个独立字段、一个多选“第三方登录”字段，还是 provider 标签集合？ | 影响接口与筛选 UI | 产品、后台前端、后端 | 本期做，沿用现有后台规则与页面模式 |
| Q42 | 筛选条件支持已绑定/未绑定、单 provider、多 provider 组合吗？默认值和导出范围是什么？ | PRD只写“筛选、导出” | 产品、后台前端 | 待确认 |
| Q43 | 用户详情展示哪些信息：绑定状态、账号、外部 ID、绑定时间、解绑时间？哪些字段需脱敏/禁止展示？ | 隐私与审计要求 | 产品、安全、后端 | 待确认 |
| Q44 | 关联历史是否记录操作者、来源端、IP、设备、失败记录和原因？只记成功还是所有尝试？ | PRD示意仅有时间/操作/平台/账号 | 产品、审计、后端 | 待确认 |
| Q45 | 手机/邮箱脱敏精确规则与 PR-01268 是否完全一致？列表、详情、导出是否使用相同口径？ | 引用文档主要描述场景，需契约化 | 审计、安全、后端 | 已确认沿用项目现有脱敏规则 |
| Q46 | 哪些后台角色可查看、筛选、导出第三方信息和关联历史？是否需要新增权限点？ | 验收标准包含权限 | 产品、权限 owner | 已确认沿用现有后台权限规则 |

### G. 埋点、实验与验收

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q47 | 事件名必须是 `click_tg_login` / `click_fb_login`，还是沿用现有 `login_third_party_click` / `register_third_party_click` 加 provider？ | 避免同一行为两套事件 | 数据、产品、Web/App | 待确认 |
| Q48 | `page_from` 的枚举是否只有 login/register，首页和个人中心绑定如何上报？ | PRD 与实际入口不一致 | 数据、产品 | 待确认 |
| Q49 | 登录前如何得到 `user_status=new/existing`？该字段是在授权结果后补发，还是改为 unknown？ | 点击时尚不知道用户是否已有账户 | 数据、后端、Web/App | 待确认 |
| Q50 | A/B 实验要实验什么、分流单位是什么、由 PostHog feature flag 还是服务端控制？ | 验收写了“能否做 ab 实验”但没有实验方案 | 产品、数据 | 待确认 |
| Q51 | 验收环境需要哪些 Telegram/Meta 测试账号、冻结/注销/受限账号、并发设备和权限拒绝场景？ | 无测试数据无法完成 G6/G7 | QA、后端、产品 | 待确认 |
| Q52 | 技术评审后是否由 QA 补正式测试用例与兼容矩阵？支持哪些浏览器/WebView/App 最低版本？ | 当前 QA 资料缺失 | QA、App、Web | 待确认 |

### H. 二次校对新增（2026-08-03，逐节比对 PRD 正文补充）

| ID | 问题 | 为什么必须确认 | 建议参会 owner | 状态 |
|----|------|----------------|----------------|------|
| Q53 | ~~Telegram Login Widget 的 `hash`+`auth_date` HMAC 校验~~ **已作废（见 D1）**：Telegram 改为标准 OIDC，前端拿 `id_token`(JWT)，后端按 JWKS 验签。改问：id_token 验签、`exp`/`nonce` 时效由后端负责；过期错误码与「重新授权」提示文案待契约。 | 官方文档已归档 legacy widget，校验机制变为标准 OIDC JWT | 后端、Web、安全 | 前提更正为 OIDC；后端验签，错误码/文案待契约 |
| Q54 | 5.5 明确「沿用」参考文档《PM-1227/M-0370 新增第三方登录及嗨聊邀请关系》的关联流程、验证码优先级、后台字段、注销解绑规则，但该文档未纳入本项目资料清单。是否先获取并契约化其可执行细节？ | 大量业务规则直接依赖该文档；不核对将凭空实现 | 产品、后端、Web | 待确认（资料阻塞，见下表） |
| Q55 | TG/FB 新注册是否需要绑定邀请码/邀请关系？参考文档标题含「嗨聊邀请关系」，但本 PRD 正文对新注册的邀请关系只字未提 | 邀请关系影响注册接口入参与业务分成，漏做代价高 | 产品、后端 | 沿用现有注册邀请关系，不新增独立规则；待参考文档核对 |
| Q56 | 5.2.6 关联已有账户 4 个分支的固定文案需逐字确认：①绑定成功 ②「该账户已关联 Telegram/Facebook，请先解除关联」③「该账户已注销，无法关联」④「用户不存在」 | 现有 Q09/Q30 只覆盖冻结/注销/受限错误码，未覆盖关联流程这组文案 | 产品、Web | 待确认 |
| Q57 | 个人中心新增 TG/FB 绑定项 PRD-IMG-036 呈现为「绑定Telegram登录」整行按钮，而现有 Google/Apple/HiChat（PRD-IMG-037）为「未绑定 + Bind 小按钮」。两种形态是否统一？以哪个为准？ | 同一弹窗新旧项形态不一致 | 设计、产品 | 已由 Figma `19936:2518` 确认统一为五行“渠道信息 + 右侧关联/解除按钮” |

### PRD 内部矛盾（提请评审当场澄清）

| # | 矛盾点 | 位置 | 关联问题 |
|---|--------|------|----------|
| C1 | 5.2.4 授权结果判断正文只写「冻结/注销」拦截，但「验收标准」要求同时拦截「受限」账户——受限账户定义在正文缺失 | §5.2.4 vs §九验收标准 | Q30 |
| C2 | 5.2 写「App 端打开浏览器页面完成授权」，5.2.7 又写 Facebook「iOS SDK、Android SDK 各自有集成指南」——App 到底走系统浏览器还是原生 SDK 未定 | §5.2 vs §5.2.7 | Q08（拆单给 App 时澄清） |
| C3 | 已解决：§5.2.8 整段置灰删除，正文中的订阅、推送及解绑取消订阅说明全部不生效 | §5.2.8 | 当前负责人 / 2026-08-03；截图复核 |

## 当前阻塞与资料缺口

| 时间 | 问题 | 影响 | 责任人 | 状态 |
|------|------|------|--------|------|
| 2026-08-03 | PRD 白板缺 `board:whiteboard:node:read` 权限，无法读取原始流程节点或缩略图 | 核心流程可能漏分支，阻断 G2 | 文档 owner / Lark 应用管理员 | 待补授权或导出 |
| 2026-08-21 | Figma 正式 Web 稿已读取；未提供独立 H5 原子稿 | H5 需沿用现有响应式做 390px 验收 | Web / QA | Web 规格关闭；H5 进入验收项 |
| 2026-08-03 | API/YApi 未提供 | 无法定 schema、状态码、错误态和 Mock | 后端 | 待补 |
| 2026-08-03 | QA 用例、账号、兼容矩阵未提供 | 无法形成完整验收计划 | QA | 待补 |
| 2026-08-03 | Telegram Bot / Meta App 各环境账号与审核状态未知 | 可能阻塞开发与联调（**Meta email 审核已非阻塞，见 D4**；TG 需注册 Web Login Allowed URLs + Client ID/Secret，见 D2） | 产品、运维、后端 | 待确认账号 owner |
| 2026-08-03 | 参考文档《PM-1227/M-0370 新增第三方登录及嗨聊邀请关系》未纳入资料清单，5.5 大量规则「沿用」它 | 关联流程/验证码优先级/后台字段/邀请关系凭空实现风险 | 产品、后端 | 待获取并契约化（Q54/Q55） |
| 2026-08-03 | 部署层 COOP 核对：Telegram/Facebook 走 `window.open` 弹窗授权，若网关/CDN/Nginx 对本站域名下发 `Cross-Origin-Opener-Policy: same-origin`，会掐断父子窗口通信、弹窗回调拿不到 `id_token`/`code`（见 D3）。next.config 现未设 COOP（默认 `unsafe-none`，正常）。要求：**部署层别设 `same-origin`，若因其他安全需求要设，须用 `same-origin-allow-popups`**。 | 设错则 TG/FB 登录静默失效，联调/上线阻塞 | 运维、Web | 待运维确认各环境网关未强制 COOP: same-origin |

## 已核实事实

- PRD revision `1341` 已于 2026-08-03 同步，40 张图片已全部下载为本地 PNG 并视觉核验。
- `PRD-IMG-001`～`035` 为竞品参考；`036`～`040` 为本期个人中心、后台和日志直接素材。
- Web 已存在 `ThirdPartyLogin` 通用流程、HiChat 专属流程、个人中心绑定/解绑和安全验证。
- 现有 `ThirdType` 仅含 Google、Apple、HiChat；服务层仍有若干宽泛 `any`，新增渠道时应以 schema/明确 Params 收敛，不继续扩散。
- 2026-08-21 UI 同步只修改 `ThirdPartyLogin` 展示组件、品牌静态资源和 `ThirdBindModal` 样式覆盖；未修改授权、API、store 或业务状态机。

## Code Review

2026-08-18 对本 PR 改动（15 个文件，`ThirdPartyLogin/**` + `TelegramLoginSdk`/`FacebookLoginSdk` + `services/api/thirdLogin.ts` + `apps/Login/InputAccount.tsx`）执行 code-review + 机器码规则（`verify-code-rules.mjs`）+ 改动文件 `tsc`。

机器检查结果：`tsc` 改动文件 0 error（基线既存债非本 PR）；`verify-code-rules` 无 error，4 条 warn。findings 与处理结论如下（全部已处理，无悬空项）：

| ID | 位置 | finding | 处理结论 |
|----|------|---------|----------|
| CR1 | `services/api/thirdLogin.ts:11` | `useAuthLogin` 请求体 typed `any` | 不适用/豁免：与 `authRegister`/`joinAddAccount` 一致的既有模式，本 PR 未新增契约破坏；后续可统一为 `AuthRegType`，不阻断本次 |
| CR2 | `providerAdapters.ts:50`、`useThirdAuth.ts:48`（CODE-ARCH-002） | 新增 6 / 3 个 `if` 分支 | 不适用：均为流程控制（三态分发、demo 降级、SDK 缺失兜底），非状态/文案/class 映射；规则明示流程控制可保留 |
| CR3 | `apps/Login/InputAccount.tsx:16`（CODE-ARCH-003） | 组件 import `@/services/api/login` | 豁免：既有模式、非本 PR 引入 |
| CR4 | `ThirdPartyLogin/index.tsx:1`（CODE-FILE-001） | 文件 312 行（>300） | 不归因本次：既存债（base 313，本次 −1 行）；已抽出 `useThirdAuth`/`providerAdapters` 减负 |
| CR5 | `providerAdapters.ts:43` `randomToken()` | 前端生成 state/nonce | 已登记：注释与技术设计 TD07 已说明为 dev 兜底，生产由后端签发下发；不阻断 |

结论：findings 全部已修 / 豁免 / 不适用，0 项遗留（全部当场闭环）。真实接口契约已对账（见下「后端契约对账」），无 `// ASSUMED:` 残留。

## 后端契约对账（2026-08-18，YAPI 2776 及同类接口）

关闭本文档「六、待后端回 Q2」：`POST /fe-ex-api/oauth/authLogin` 及 `authRegister`/`newRegisterCheck`/`checkAccount`/`joinAddAccount`/`internalJoinAuth` 请求体最终定为 `{ source, idToken }`，**无独立 `code` 字段**；`source` 枚举新增 `Telegram`/`Facebook`，Facebook 把 `accessToken` 赋给 `idToken`。前端 `useThirdAuth` 现有实现与之逐字一致，响应 `authStatus(0/1/2)`/`token`/`email`/`mobile` 均为前端已消费字段。

## 验证证据索引

| 命令 | 目标文件 / 场景 | 结果 | 备注 |
|------|-----------------|------|------|
| `lark-cli docs +fetch` | PRD revision 1341 | PASS | 原始同步件与纯正文快照已保存 |
| 本地下载 + `file` | 40 张 PRD 图片 | PASS | 全部为有效 PNG，共约 11.2 MB |
| `lark-cli whiteboard +query` | `PRD-EMBED-005` | BLOCK | 缺 `board:whiteboard:node:read` |
| `lark-cli docs +fetch` | PR-01268 现货后台章节 | PASS | 已读取脱敏场景参考 |
| `pnpm vitest --run .../ProviderLoginButtons.test.ts` | 登录/注册 3+2 顺序、品牌资源、disabled 点击 | PASS | 2 tests |
| `verify-build-quality --files <本轮 6 个 TS/TSX>` | Biome / 改动文件 tsc / 相关 Vitest | PASS | 改动文件 0 type error；全仓存量错误不归因本轮 |
| 本地 Browser | 登录 light/dark、注册 dark、首页五渠道 + QR | PASS | 布局、顺序、品牌图标与点击区正常；绑定弹窗需已登录态，代码分支按原子规格核对 |
| `docs-tdd.mjs gate PR-02172 G8` | 最终阶段门禁 | PASS | 2026-08-21 执行退出码 0 |

## 可转发交接清单（后端/运维，2026-08-04 官方文档核实版）

> 下面整段可直接转发。已按 `core.telegram.org/bots/telegram-login`（curl 直取核实）与 FB v26.0 文档校对。

### 一、Telegram（先定走哪条路，二选一）

前端已实现「A 路」。

- **A 路（推荐，与前端一致）**：前端用官方 JS 库 popup `Telegram.Login.auth()` 直接拿 `id_token`(OIDC JWT) 传后端。后端只需**公开 JWKS 验签，无需任何私钥**：
  - JWKS `https://oauth.telegram.org/.well-known/jwks.json`；discovery `https://oauth.telegram.org/.well-known/openid-configuration`
  - 校验 `iss=https://oauth.telegram.org`、`aud=<bot Client ID>`、`exp`、`nonce`（前端已带，见 providerAdapters `authorizeTelegram`）
- **B 路（后端若坚持服务端换 token）**：标准 Authorization Code + PKCE，redirect `/auth?response_type=code` → 后端 `/token` 换 token。**此路才需 TG Client Secret**（`Basic base64(client_id:client_secret)`）。走 B 请告知，前端改 redirect 发起。

> ⚠️ bot 的 HTTP API token 两条路都不需要（Bot API / 已永久关闭的老版 HMAC 用）。

### 二、Facebook（固定一条路）

- 前端 popup `/v26.0/dialog/oauth?response_type=code` 拿 **authorization code** 传后端。
- 后端用 **App Secret** 向 `graph.facebook.com/v26.0/oauth/access_token` 换 token，再 `/me?fields=id,name,email`。
- 校 `state`、`redirect_uri` 与前端**逐字一致**：`https://<域名>/oauth/facebook/callback`。
- `public_profile`/`email` 无需 App Review；生产 app 现「未发布」，上线前切 Live 并补图标/隐私政策/数据删除/类别。

### 三、公开值（已在前端代码，无需给）

| | 测试（dev/pre/test 共用） | 生产 |
|---|---|---|
| TG Client ID | `8904904266` | `8841057249` |
| FB App ID | `2802166923501452` | `1592698835583337` |

### 四、私钥（只私发，勿进代码/群/git）

- TG Client Secret —— **仅 B 路需要**（走 A 可不发）
- FB App Secret —— **必须**

### 五、运维

- **别给本站域名下发 `Cross-Origin-Opener-Policy: same-origin`**（会掐断 TG/FB popup 致登录静默失效）；要设改用 `same-origin-allow-popups`。当前各环境主文档未设 COOP，保持即可。
- **白名单分家**：测试 bot/app 放 `dvmkgi.vip / azmgb.com / pfyys.com`；生产放 `fameex.com / fameexbtc.com:17801 / vsgpk.com / fameex.asia / canary.fameex.com`；均不放 localhost。
- **TG 生产 bot 配 Trusted Origins**（A 路校验 origin，非 Redirect URIs）。

### 六、待后端回

1. TG 走 A 还是 B？
2. 复用 `authLogin` 按 `source` 分支还是新 endpoint？字段沿用 `{source, idToken}`（FB code 塞 idToken）还是给 FB 单列 `code`？
3. `state`/`nonce` 签发/校验接口路由与出入参？id_token/token 过期错误码 + 「重新授权」文案？
