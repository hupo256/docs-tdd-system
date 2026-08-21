<!-- template-version: 2 -->
<!-- template-effective-since: 2026-07-23 -->

# Frontend Tasks — PR-02172 【登录注册】增加第三方（tg、facebook）

> 当前为 G8 交付跟踪。2026-08-21 新增正式 Figma UI 同步任务，流程、交互与 API 均复用既有实现。

| ID | 功能 ID | 需求依据 | 任务 | 状态 | 验收证据 |
|----|---------|----------|------|------|----------|
| T01 | F01-F15 | `PRD-IMG-001`～`040`、`PRD-TABLE-001`～`006`、`PRD-EMBED-001`～`006` | 完成 PRD intake、现状复用盘点和技术评审问题清单 | 已完成（白板权限阻塞已登记） | `agent/prd-source-manifest.json`、`00-feature-inventory.md`、`06-collaboration.md` |
| T02 | F01、F08 | 正文 §5.2、`PRD-TABLE-002` | Web 沿用现有登录/注册/首页入口；App 由 PM 拆单；按正式 Figma 复核视觉 | 已确认 | `05-ui-and-interaction.md`、`07-figma-spec.md` |
| T03 | F01、F06 | OAuth 配置 | popup 优先/redirect 降级已确认；PM/后端补具体 SDK、callback 和分环境账号 | 部分确认 | `02-technical-design.md` |
| T04 | F02、F03、F11、F12 | 渠道字段与状态分支 | 三态与统一 schema 已确认；后端补字段和错误码 | 部分确认 | `03-api-contract.md` |
| T05 | F03-F05 | 注册/关联流程 | 复用现有状态机 + provider adapter 已确认；PM 补业务分支 | 部分确认 | 技术方案 |
| T06 | F04、F05 | 表单与验证 | 明确补填字段、条款、查重、密码、验证码、Google 验证与忘记密码回跳 | 待评审 | API/UI 契约 |
| T07 | F06 | 第三方平台准备 | 技术评审确认 Bot/App、域名白名单、Meta Review、client ID/secret 的环境 owner 与日期 | 待评审（C08） | 配置清单 |
| T08 | F09、F11、F12 | 个人中心 | 确认 `authUsers` 返回结构、绑定状态、解绑清理与外部撤销授权同步 | 待评审 | API/UI 契约 |
| T09 | F10、F13 | 后台与日志 | 落 legacy-admin(Vue2,hash 路由)：F10 用户列表筛选枚举加 TG/FB（列/详情/导出后端字符串驱动，`oauthProviders||'--'`）；F13 用户详情→安全信息→新增子 tab「第三方账号绑定关联历史」，直连接口 6025 `/platformAccountOperation/pageList`（请求 `{uid,pageNum,pageSize}`，列按 operationType/platformCode/account/createTime 映射） | 完成（F13 已接真实 6025，无 mock） | `member_manager.vue`、`a_security_info_main.vue`、`a_third_party_bind_history.vue`、`dictionary/index.js`、`memberManager.js`；evidence/g5-reconcile 6025 章节 |
| T10 | F12 | 异常场景 | 建立可测试的错误状态矩阵与 MSW 场景 | 待评审 | `03-api-contract.md`、MSW manifest |
| T11 | F14 | 埋点 | 确认 PostHog 事件名、触发时机、属性枚举、登录前 user_status 口径与 A/B 实验方案 | 待评审 | 埋点契约 |
| T12 | F01-F15 | `PRD-EMBED-005` + G2 | 补白板、回填会议结论，标记做/不做/延期，补责任模块并执行 intake approve / G2 gate | 待办 | G2 gate |
| T13 | F01、F08、F09 | Figma `19782:4920` / `19936:2518` / `19800:10744` | 登录/注册同步 3+2 按钮；首页同步五渠道与 QR 点击区；账户绑定只改红框；补品牌 SVG、单测和视觉验收 | 已完成 | 代码 diff、`ProviderLoginButtons.test.ts`、本地 Browser 走查、G8 gate |

## PRD sourceId 逐项追踪

| sourceId | Feature | 任务 |
|----------|---------|------|
| `PRD-IMG-036` | F09 | T08 |
| `PRD-IMG-037` | F09 | T08 |
| `PRD-IMG-038` | F10 | T09 |
| `PRD-IMG-039` | F10 | T09 |
| `PRD-TABLE-003` | F12 | T10 |
| `PRD-IMG-040` | F13 | T09 |
| `PRD-TABLE-004` | F13 | T09 |
| `PRD-EMBED-006` | F13 | T09 |
| `PRD-TABLE-005` | F14 | T11 |
| `PRD-TABLE-006` | F01、F02、F03、F04、F05、F06、F07、F08、F09、F10、F11、F12、F13、F14、F15 | T12 |

## 代码改动面

- `apps/web/src/components/ThirdPartyLogin/**`
- `apps/web/src/services/api/thirdLogin.ts`
- `apps/web/src/services/api/user.ts`
- `apps/web/src/apps/Login/**`
- `apps/web/src/apps/Register/**`
- `apps/web/src/apps/User/components/SafeSetting/**`
- `apps/web/public/static/icon/{telegram2,facebook2}.svg`
- `apps/web/src/i18n/locales/zh-CN/thirdLogin.json`
- `apps/web/src/mocks/**`（仅 API 未 ready 且 G3 决定采用 MSW 时）
- Admin 已按 T09 落 legacy admin；本轮 Figma 同步不触达 Admin

## 实现检查（G4 后）

- [ ] 外部 SDK 数据先以 `unknown` 进入 schema，不新增裸 `any`。
- [ ] 渠道静态配置和状态/文案/icon 映射使用 lookup table + resolver。
- [ ] API DTO 经 schema/mapper，不直接进入组件。
- [ ] OAuth state/nonce、popup 通信、回调来源与 token 清理完成安全审查。
- [ ] loading / popup blocked / canceled / timeout / revoked / duplicate / frozen / deleted 状态完整。
