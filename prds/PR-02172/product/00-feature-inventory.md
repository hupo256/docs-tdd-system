<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Feature Inventory — `PR-02172 【登录注册】增加第三方（tg、facebook）`

> G2 已定稿（负责人 2026-08-18，依 PRD §5.1 本期范围）。除 F07（PRD §5.2.8 明示暂时不做）与 App 侧（F08 iOS/Android、F15，2026-08-18 用户决定不做）外均本期做；Admin（F10/F13）落 `apps/admin`，本期做。本期无 Figma，按原型低保真开发。

| 字段 | 值 |
|------|-----|
| 工单 | PR-02172 |
| PRD 来源 | https://qfglxo2m3dc.sg.larksuite.com/docx/Zj7Dd8cdIorON3xmYSdlI94qg1c |
| PRD 本地副本 | `inbox/prd-content.md`（revision `1341`，2026-08-03 同步） |
| PRD 原始同步件 | `inbox/lark-sync/prd-latest.md` |
| PRD 素材 | 40 张图片、6 张表、1 个白板、1 个引用文档；见 `agent/prd-source-manifest.json` |
| Figma 主画板 | 本期无 Figma 交付；按 PRD 原型低保真开发（负责人 2026-08-18 确认） |
| 清单维护人 | Agent |
| G2 确认人 & 日期 | Aven 于 2026-08-18 依 PRD §5.1 本期范围确认进入 G2（Admin/App 落点见各行确认列） |
| 责任模块目录 | Web：`apps/web/src/components/ThirdPartyLogin/**`、`apps/web/src/services/api/thirdLogin.ts`、`apps/web/src/services/api/user.ts`、`apps/web/src/apps/Login/**`、`apps/web/src/apps/Register/**`、`apps/web/src/apps/User/**`；Admin：沿用现有后台用户管理/日志规则，具体目录待 G2 前复用盘点；App 由 PM 拆单 |
| visualFidelity | `low`（本期无 Figma，按 PRD 原型低保真开发） |

## 现有实现与复用基线

- `ThirdPartyLogin` 已挂载在登录页、注册页和个人中心账户绑定弹窗。
- `ThirdType` 当前包含 `Google`、`Apple`、`HiChat`；Google/Apple 走通用 `/fe-ex-api/oauth/*`，HiChat 走专属 `/exchange-web-api/hichat/*`。
- 现有状态机已覆盖“已绑定直登 / 未绑定选择注册或关联 / 已有同账号强制关联”，个人中心已覆盖绑定、解绑和安全验证。
- 用户资料接口已有 `authUsers`，当前 UI 通过该数组判断第三方绑定状态。
- 首页沿用现有 `HomeThirdLogin` 图标入口；具体视觉待 Figma 复核。

## 已确认技术方向（2026-08-03）

- 本项目负责 Web 用户端与 Admin；Admin 沿用现有后台字段、权限、脱敏、筛选、导出和审计规则；App 由 PM 拆单。
- 扩展现有 `ThirdPartyLogin`，以 provider adapter 隔离 Telegram/Facebook OAuth 差异。
- 通用注册/关联/解绑优先复用 `/fe-ex-api/oauth/*`；provider 使用 `Telegram` / `Facebook`。
- 沿用授权三态 `0/1/2`；SDK/接口数据必须经过 runtime schema 和统一 UI model。
- 用户绑定状态统一扩展 `authUsers[]`；API 未 ready 使用 MSW 路线 B。
- Web 采用 popup 优先、redirect 降级；后端负责 OAuth 安全校验和 token 原子清理。

## 功能清单

| ID | PRD 来源锚点 | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |
|----|--------------|---------|---------|------------|-------|-------------|------|------|------------|
| F01 | 正文 §5.2、`PRD-EMBED-005` | 登录/注册整体流程 | Web 登录、注册、首页新增 Telegram / Facebook 授权入口 | `/login`、`/register`、首页 | 低保真（无 Figma） | 全局入口 | 做 | PRD §5.1 本期范围；2026-08-18 | T02、T03 |
| F02 | `PRD-TABLE-001` | 渠道字段差异 | Telegram 无邮箱；Facebook 邮箱可选授权；按字段结果进入补填或强制关联 | 授权回调/登录流程 | 低保真（无 Figma） | 流程分支 | 做 | PRD §5.2.3；2026-08-18 | T04、T05 |
| F03 | 正文 §5.2.4、`PRD-EMBED-005` | 授权结果判断 | 已绑定账户校验状态并直登；未绑定进入注册/关联选择；Facebook 同邮箱强制关联 | 登录流程弹窗 | 低保真（无 Figma） | 流程分支 | 做 | PRD §5.2.4 / 白板流程；2026-08-18 | T04、T05 |
| F04 | 正文 §5.2.5 | 注册新账户 | 补填邮箱/手机、同意条款、查重、验证码校验、创建账户并绑定三方 ID | 注册流程弹窗 | 低保真（无 Figma） | 流程分支 | 做 | PRD §5.2.5；2026-08-18 | T05、T06 |
| F05 | 正文 §5.2.6 | 关联已有账户 | 邮箱/手机 + 密码登录，复用忘记密码和二次验证，绑定三方 ID | 关联流程弹窗 | 低保真（无 Figma） | 流程分支 | 做 | PRD §5.2.6；2026-08-18 | T05、T06 |
| F06 | 正文 §5.2.7 | 渠道接入配置 | Telegram Bot/domain 与 Meta App/Review/SDK 分环境配置 | Web/OAuth 配置 | 不适用 | 基础设施 | 做 | PRD §5.2.7；client ID 已配 thirdConfig.ts；2026-08-18 | T07 |
| F07 | 正文 §5.2.8（整段置灰） | Telegram Bot 订阅 | 整段已删除：不开发订阅/推送，解绑也不处理 Bot 订阅 | Telegram | 不适用 | 已删除范围 | 不做 | PRD §5.2.8 明示暂时不做；2026-08-18 | T01 |
| F08 | `PRD-TABLE-002` | 平台展示规则 | Web 端展示 TG / FB 入口；iOS/Android 本期不做 | Web（本仓） | 低保真（无 Figma） | 跨端 | 做 | Web 本期做；App（iOS/Android）不做（2026-08-18 用户决定）；2026-08-18 | T02 |
| F09 | `PRD-IMG-036`、`PRD-IMG-037` | 个人中心 | 账户绑定新增 Telegram / Facebook 状态、绑定和解绑操作 | 用户中心安全设置 | 低保真（无 Figma） | 独立模块 | 做 | PRD §5.4；2026-08-18 | T08 |
| F10 | `PRD-IMG-038`、`PRD-IMG-039` | 管理后台 | 用户列表/详情新增 Telegram / Facebook 展示、筛选与导出 | 管理后台用户管理 | 低保真（无 Figma） | 跨应用 | 做 | PRD §5.5；落 apps/admin，沿用现有后台规则；2026-08-18 | T09 |
| F11 | 正文 §5.5 通用规则 | 通用规则 | 复用既有第三方登录的关联、安全验证、注销解绑和验证码优先级 | 全流程 | 不适用 | 业务规则 | 做 | PRD §5.5；2026-08-18 | T04、T05、T08 |
| F12 | `PRD-TABLE-003` | 异常与边界 | 并发唯一性、重复账号、第三方超时、验证码错误/过期、外部撤销授权、注销一致性 | 全流程 | 不适用 | 异常状态 | 做 | PRD §八；2026-08-18 | T04、T10 |
| F13 | `PRD-IMG-040`、`PRD-TABLE-004`、`PRD-EMBED-006` | 日志新增 | 后台新增第三方绑定/解绑历史，账号按既有审计规则脱敏，缺失账号显示 `--` | 管理后台日志 | 低保真（无 Figma） | 跨应用 | 做 | PRD §7.1；落 apps/admin，沿用审计规则；2026-08-18 | T09 |
| F14 | `PRD-TABLE-005` | 埋点 | `click_tg_login`、`click_fb_login` 上报端、来源页和用户状态 | Web + App | 不适用 | 数据能力 | 做 | PRD §7.2；2026-08-18 | T11 |
| F15 | 正文 §十 | 版本兼容 | 老版本 App 不展示入口，原登录/注册流程不新增报错 | App/后端 | 不适用 | 兼容性 | 不做 | App 侧本期不做（2026-08-18 用户决定）；Web 主流程无回归 | T01 |

## 验收标准对照（PRD「验收标准」）

| 验收项 | 对应 ID | 状态 |
|--------|---------|------|
| 所有端入口展示 | F01、F08 | 待技术评审确认“所有端”责任边界 |
| 已绑定直登及异常账户拦截 | F03、F12 | 待接口状态码/文案契约 |
| 快捷注册与密码状态提示 | F04 | 待确认密码提示落点与现有流程复用方式 |
| 重复账号与安全关联 | F03、F04、F05、F11 | 待接口及二次验证规则 |
| 并发绑定唯一性 | F12 | 后端主责，待确认前端错误态 |
| 彻底解绑 | F09、F12 | 清理三方绑定、缓存和 Token；不包含已置灰删除的 Bot 订阅 |
| 后台展示、筛选、导出、权限、脱敏和审计 | F10、F13 | 待确认实现仓库及接口 |
| 埋点与 PostHog 实验能力 | F14 | 待数据团队确认事件契约和实验方案 |
| 老版本兼容 | F15 | 待 App/后端确认 |

## Scope 裁剪记录（待 G2）

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| TG Bot 订阅（§5.2.8 整段置灰） | 整体删除：不开发、不联调、不验收；解绑不处理 Bot 订阅取消 | 当前负责人 | 2026-08-03；截图复核 | 完全排除出本期验收 |
| iOS / Android | 当前仓库为 Web；是否由其他团队/仓库并行交付待确认 | 待确认 | | 影响“所有端入口展示”和老版本兼容 |
| 管理后台 | 本项目纳入；沿用现有后台规则，legacy admin / `apps/admin` 具体落点待复用盘点 | 当前负责人 | 2026-08-03 | 后台能力、日志与审计进入本期验收 |

## PRD 未完全可读内容

| 类型 | 位置 | 影响 | 处理方式 | 状态 |
|------|------|------|----------|------|
| 图片 40 张 | 竞品、个人中心、后台、日志 | 流程与 UI 参考 | 已全部下载、本地 PNG 校验并逐组查看 | 已处理 |
| 表格 6 张 | 渠道、端展示、异常、日志、埋点、验收（`PRD-TABLE-001`～`006`） | scope 与验收 | 已读取纯正文快照；验收表 `PRD-TABLE-006` 映射 F01-F15 | 已处理 |
| 白板 | `PRD-EMBED-005` / 登录注册流程 | 核心流程可能含正文未覆盖分支 | 2026-08-18 `board:whiteboard:node:read` 已放开，经 `lark-cli api /open-apis/board/v1/whiteboards/.../nodes` 读取；流程见 `evidence/prd-intake/whiteboard-PRD-EMBED-005.md`，未引入清单外分支 | 已处理 |
| 引用文档 | `PRD-EMBED-006` / PR-01268 | 后台日志脱敏 | 已读取现货管理后台相关章节；具体脱敏格式仍建议后端/审计确认 | 已处理，待确认契约 |
| Figma | node `9137:2` | 视觉与交互规格 | 本期无 Figma 交付，按 PRD 原型低保真开发（负责人 2026-08-18 确认） | 已处理（低保真） |

> 完整技术评审问题见 `product/06-collaboration.md`。
