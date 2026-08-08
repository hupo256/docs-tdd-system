<!-- template-version: 1 -->

# Technical Review Agenda — PR-02172 【登录注册】增加第三方（tg、facebook）

> 一页评审议程。问题正文与 owner 见 `06-collaboration.md`（Q01–Q57；Q04 已删除，C3 已解决）。
> 本议程按「能否开工」重排：P0 不解决则 G2 卡死；P1 决定代码骨架；P2 决定业务分支；P3 决定 UI/文案；P4 处理 Admin 落点、App 拆单及外部依赖。
> 建议会议顺序：P0 认领 owner → P1 拍板 → P2 定分支 → P3 过 UI → P4 拆单。

## P0 · 开工阻塞（先认领 owner 和交付日期，否则 G2 无法启动）

| # | 阻塞 | 需要的结论 | owner |
|---|------|-----------|-------|
| B1 | PRD 白板（登录注册核心流程图）缺 `board:whiteboard:node:read` 权限 | 补授权或导出流程图，确认正文外是否有隐藏分支 | 文档 owner / Lark 管理员 |
| B2 | Figma node `9137:2` 未读取 | 定稿并授权读取，确认 visualFidelity 与弹窗全状态 | 设计 |
| B3 | API / YApi 未提供 | 提供接口字段、状态码、错误码、callback 参数 | 后端 |
| B4 | 参考文档《PM-1227/M-0370 嗨聊邀请关系》未纳入资料（5.5 大量规则「沿用」它）| 提供文档并契约化关联流程/验证码优先级/邀请关系（Q54/Q55）| 产品、后端 |
| B5 | 各环境 Telegram Bot / Meta App 账号与审核状态未知 | 各环境账号 owner + 完成日期（**Meta email 审核已非阻塞，见 06 §D4**；TG 需注册 Web Login Allowed URLs + Client ID/Secret，见 D2） | 产品、运维、后端 |
| B6 | QA 用例、测试账号（冻结/注销/受限）、兼容矩阵缺失 | 验收计划与账号清单 | QA |

## P1 · 架构拍板（决定 provider adapter 与 service 怎么写）

| # | 问题 | 关联 |
|---|------|------|
| A1 | Telegram Web：已确认官方新版 OIDC（`telegram-login.js` popup 返回 `id_token`，redirect 降级）——待后端验签/错误码契约 | Q07、Q53、06 §D1 |
| A2 | Facebook Web：已确认手动 code 模式（`/dialog/oauth?response_type=code`，后端换 token）——`email` 无需 Meta 审核 | Q08、06 §D4/D5 |
| A3 | 复用 `/fe-ex-api/oauth/*` 通用接口，还是新增渠道专属接口？ | Q14 |
| A4 | 登录 token 字段统一为 `token` / `accessToken` / `quicktoken`？ | Q17 |
| A5 | state / nonce / PKCE / CSRF 前端还是后端生成校验？ | Q10 |
| A6 | Telegram `hash` + `auth_date`（HMAC 校验、非标准 OAuth）谁校验、时效多久？ | Q53 |
| A7 | `telegram_id`/`facebook_id` 唯一索引范围 + 并发冲突错误码 + 查重竞态 | Q19、Q25 |

## P2 · 业务分支（决定流程与状态机，易漏做）

| # | 问题 | 关联 |
|---|------|------|
| S1 | Facebook 同邮箱：必须输密码，还是可直接二次验证？（PRD 自相矛盾）| Q20 |
| S3 | Telegram 无邮箱补填规则；是否创建无密码账户 + 「提示设密码」触发字段/弹窗 | Q21、Q22 |
| S4 | 无密码且只绑一个三方渠道时能否解绑？（漏判会导致账户永久无法登录）| Q32 |
| S5 | TG/FB 新注册是否绑定邀请码/邀请关系？（PRD 正文未提）| Q55 |
| S6 | 「受限账户」定义缺失——正文只写冻结/注销，验收要求拦截受限 | C1、Q30 |
| S7 | 外部主动撤销授权的检测时机（每次登录校验 / 定时 / webhook）| Q24 |

## P3 · UI / 文案（依赖 B2 Figma 与 B4 文档）

| # | 问题 | 关联 |
|---|------|------|
| U1 | 「首页」入口具体指哪个位置？（PRD 除 5.2 一句话外无任何设计稿/截图）| Q01 |
| U2 | 登录/注册入口排序与按钮形态（品牌图标 vs「继续使用 xxx」整行）| Q34、Q35 |
| U3 | 个人中心新旧绑定项形态不一致，是否统一 | Q57 |
| U4 | 关联流程 4 个分支固定文案（已关联/已注销/不存在/成功）逐字确认 | Q56 |
| U5 | 第三方失败文案是否统一「第三方服务暂时不可用，请稍后重试」| Q39 |
| U6 | 个人中心展示哪些字段、缺失显示 `--` 还是不展示 | Q38 |
| U7 | 开发期仅 zh-CN，其他语言何时由翻译流程同步，上线是否允许中文 fallback | Q40 |

## P4 · Admin 落点、App 拆单与外部依赖

| # | 问题 | 关联 |
|---|------|------|
| X1 | App 四种发行包谁做、owner、排期；App 走系统浏览器还是原生 SDK | Q02、C2 |
| X2 | Admin 已纳入本项目；确认落 legacy admin、`apps/admin` 或两者，并完成复用盘点 | Q03 |
| X3 | Admin 沿用现有字段/筛选/导出/详情/权限/脱敏规则，会上确认复用锚点 | Q41–Q46 |
| X4 | 关联历史日志沿用现有审计与 PR-01268 脱敏口径，确认接口字段 | Q44、Q45 |
| X5 | 埋点事件名统一口径、page_from 枚举、user_status 时机、A/B 方案 | Q47–Q50 |

## 已确认无需再议（TD01–TD12，2026-08-03）

本项目做 Web + Admin，App 拆单 · 扩展 `ThirdPartyLogin` + provider adapter · Admin 沿用现有规则 · 通用接口优先复用 · Provider 用 `Telegram`/`Facebook` · 沿用三态 `0/1/2` · popup 优先 redirect 降级 · SDK 数据经 runtime schema · `authUsers[]` 扩展 · API 未 ready 走 MSW 路线 B · G2 前不写业务代码。
