<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# UI And Interaction — PR-02172 【登录注册】增加第三方（tg、facebook）

## 页面 / 入口候选

| 页面 | 现有入口 | PRD 变化 | 待确认 |
|------|----------|----------|--------|
| 登录页 | `apps/web/src/apps/Login/InputAccount.tsx` 挂载 `ThirdPartyLogin` | 新增 Telegram / Facebook | 入口顺序、按钮形态、文案、暗色/亮色 |
| 注册页 | `apps/web/src/apps/Register/RegisterV2/CreateAccount.tsx` 挂载 `ThirdPartyLogin` | 新增 Telegram / Facebook | 与 Google One Tap、条款勾选的关系 |
| 首页 | `HomeThirdLogin` 已有 Google/Apple/HiChat 图标入口 | PRD 写“首页新增按钮” | 指首页 Banner 图标还是另一个登录弹窗 |
| 授权后选择 | 现有 `SelThirdType` | 注册新账户 / 关联已有账户 | 是否沿用现有弹窗，Facebook 同邮箱是否跳过选择 |
| 补填注册 | 现有 `RegByThird` / `CreateByThird` | Telegram 强制补填；Facebook 按 email 权限分流 | 必填字段、条款、验证码、密码提示 |
| 关联已有账户 | 现有 `UniteByThird` | 邮箱/手机+密码、忘记密码回跳、二次验证 | 回跳状态保存和错误次数限制 |
| 个人中心 | 现有 `ThirdBindModal` / `ThirdBindItem` | 新增 TG/FB 状态、绑定、解绑 | 账号展示、排序、外部撤销后的状态刷新 |
| 管理后台 | PRD 截图对应页面待定位 | 本期新增字段、筛选、导出、日志 | 沿用现有后台规则；legacy / Next admin 落点待复用盘点 |

## 必测状态候选

| 场景 | 预期表现 | 契约状态 |
|------|----------|----------|
| SDK 未加载 / popup 被拦截 | 按钮 disabled 或展示明确错误，不静默失败 | 待评审 |
| 用户取消授权 | 回到原页面，不打开后续流程，不残留临时 token | 待评审 |
| 第三方服务超时 | “第三方服务暂时不可用，请稍后重试” | PRD 固定文案，待确认 i18n key |
| 已绑定正常账户 | 直接登录成功 | 待状态码 |
| 已绑定冻结/注销/受限账户 | 阻止登录并展示对应文案 | “受限”定义及错误码待确认 |
| 未绑定且无可用邮箱 | 进入补填邮箱/手机 | 待字段契约 |
| Facebook 返回已注册邮箱 | 强制关联已有账户 | 待确认是否展示脱敏账号、是否需密码 |
| 重复绑定 / 并发绑定 | 后到请求提示已绑定，不覆盖 | 后端主责，前端错误码待确认 |
| 外部撤销授权 | 下次校验后展示已解绑 | 状态刷新时机待确认 |
| 解绑成功 | 清理绑定并回到未绑定状态 | Token/cache/Bot 清理责任待确认 |

## 视觉资料

- `PRD-IMG-001`～`PRD-IMG-035`：竞品流程参考，不作为 FameEX 像素级设计稿。
- `PRD-IMG-036`、`PRD-IMG-037`：个人中心账户绑定现状/示意。
- `PRD-IMG-038`、`PRD-IMG-039`：管理后台字段示意。
- `PRD-IMG-040`：第三方绑定关联历史示意。
- Figma node `9137:2` 尚未读取，视觉规格不得提前定稿。
