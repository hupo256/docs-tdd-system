# G5 — 真实 API 契约对账（YAPI 2776 及同类接口）

> 对账时间 2026-08-18。后端已发 DEV（Knox 确认）。本文件记录 Web 侧请求/响应契约与后端最新文档的逐字对账结果。

## 数据源

经 `lark-cli`/`curl` 登录 YAPI（`35.240.211.100:3333`，接口 2776 分类 746）实读以下接口的 `req_body_other` / `res_body`：

| 接口 | id | 路径 |
|------|----|----|
| 授权登录 | 2776 | `POST /fe-ex-api/oauth/authLogin` |
| 注册新用户 | 2777 | `POST /oauth/authRegister` |
| 注册输入检查 | 2791 | `POST /oauth/newRegisterCheck` |
| 检查有账号 | 2775 | `POST /oauth/checkAccount` |
| 关联已有账号 | 2778 | `POST /oauth/joinAddAccount` |
| 站内关联授权 | 2794 | `POST /oauth/internalJoinAuth` |

## 请求契约对账

后端 2776 请求体（实读）：`{ source: string（来源 Google/Apple/Telegram/Facebook）, idToken: string（Facebook 把 accessToken 赋值给 idToken 就行）}`，required=`[source, idToken]`。**无 `code` 字段**。

| 字段 | 后端文档 | 前端实现 | 对账 |
|------|----------|----------|------|
| `source` | 枚举含 Telegram / Facebook | `ThirdType.Telegram`/`Facebook`（`thirdTypes.ts`），`useThirdAuth` 送 `{ source }` | ✅ 一致 |
| `idToken` | 通用授权 token；FB 用 accessToken | `useAuthLogin({ source, idToken: credential })`；FB `credential`=SDK accessToken（`providerAdapters.ts:78`），TG=id_token | ✅ 一致（FB accessToken→idToken） |
| `code` | 不存在 | 前端未发送 | ✅ 一致（早期「FB 单列 code」方案已撤销） |

同类接口 2777/2791/2775/2778/2794 请求体均为 `{ source, idToken, ... }`，`source` 枚举同样含 Telegram/Facebook；前端 `RegByThird`/`UniteByThird`/`useJoinAddAccount` 等复用同一 `source` + 存储的 `idToken`（FB 即 accessToken），天然覆盖。

## 响应契约对账

2776 响应 `data`：`{ source, token(quickToken), authStatus(0/1/2), userId, email, mobile, authTokenEmail }`。

| 字段 | 前端消费点 | 对账 |
|------|-----------|------|
| `authStatus` 0/1/2 | `resolveStatusCode` → 三态分发（0 选择 / 1 直登 / 2 强制关联） | ✅ |
| `token` | `pickToken(res.token ?? res.accessToken)` → `setToken` | ✅ |
| `email` / `mobile` | `handleAuthResult` 补填账号判断 | ✅ |

## 结论

- Web 侧请求/响应契约与后端 2776 及同类接口**逐字一致**，`code` 字段确认不存在，FB accessToken→idToken 已实现。
- 无 `// ASSUMED:` 残留，无字段待销账。
- 现存 3 个 commit 的实现即为对账后的最终形态，本次同步无需改代码。

## 尚待（部署时跨团队）

真实 token 端到端联调（Knox 拿 token 走全流程）需前端部署到 DEV 域 `https://www.pfyys.com`（localhost 不在 TG/FB 白名单）。该步为部署时的后端/联合验收，属跨团队动作，见 `08-review-agenda.md`。
