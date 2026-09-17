# PR-02233 web-next 需求对账清单（R-001~R-036）

> 口径：本批＝web-next 登录/注册/重置密码验证交互。逐条标注 done / gap / pending(外部契约) / deferred / not-doing。
> 证据以实际文件为准；纯逻辑已有聚焦单测。

## 本批已完成（done）

| R | 内容 | 证据 |
|---|---|---|
| R-001 | 注册「没收到验证码？尝试邮箱注册」+ 回首步清码 | `VerifyInputs/index.tsx` onRegisterEmailGuide→resetVerify；`codeVerify.registerEmailGuide` |
| R-002 | 移除旧的“跳回登录页”无效切换入口 | Login/VerifyInputs 已无旧跳转链接，仅新 switchVerify 入口 |
| R-003 | 登录确认下方切换入口，≥2 才显示 | `switchMethod.shouldShowSwitchEntry` + `VerifyInputsView` |
| R-004 | 切换弹窗（标题/副标题/列表/【当前】高亮/GA提示/排序/关闭不改当前/仅已绑定） | `SwitchVerifyMethodDialog.tsx` + `switchMethod.ts`（单测 4/4） |
| R-005 | 选后关闭并切输入区；默认取最高优先级、切换为主动 | `handleSwitchMethod` + copy 随 verifyType 更新 |
| R-009 | 「没有收到验证码？」单入口（登录/注册/重置各一次） | `VerifyInputsView`（sendCode 块）、`ResetPassword/.../VerificationFields` |
| R-010 | 引导弹窗双 Tab/默认 Tab/客服/已知晓 | `NoCodeGuideDialog.tsx` |
| R-011 | zh-CN Tab 排查文案 + i18n key | `zh-CN/codeVerify.json` noCodeGuide |
| R-012 | 获取验证码四态 + 代码层防重复 | `SendCodeButton.tsx`（isSending/isCounting 禁用） |
| R-013 | 已发送 tooltip「{n}秒后可重新发送…10分钟」悬浮显示 | `SendCodeButton` Tooltip `sendCode.tooltip {count}` |
| R-016 | 服务异常回退 + 本地化网络异常 Toast + 透传后端码 | `VerifyInputs/index.tsx` sendVerifyCode catch |
| R-017 | 8 个埋点事件参数逐字对齐 | `verification/tracking.ts`（单测覆盖） |
| R-029 | 新增文案仅 zh-CN + 稳定 key，无 hardcode | `zh-CN/codeVerify.json` |

## 缺口 / 待补（gap）—— 建议下轮处理

- **R-006（gap，本批范围内）**：surface 指名的 `apps/web-next/src/components/verification/methodResolver.ts`
  在 web-next **不存在**（仅 legacy `apps/web/src/components/Verification/methodResolver.ts`）。
  当前登录默认方式直接取后端 `login_in.type`，而 `backend-integration.md §3.3` 要求
  「新 Web 默认方式由方式全集按优先级(GA>邮箱>手机)计算、不依赖 type 推断」。
  建议：在 web-next 新增 resolver，从 `availableMethods` 计算默认方式，`type` 仅作兼容回退。
  未做原因：需 `verificationMethods` 后端契约落定（否则多绑定全集拿不到，无法计算）；属 integration pending。

## 依赖外部契约（pending，非本批可闭环）

- **R-014（partial）**：会话内邮箱/手机独立倒计时✓、限频 `remainingDisabledSeconds` 冷却✓；
  但「刷新/离开重进按后端冷却截止时间戳恢复」「跨业务场景共用后端冷却」**未实现**——
  发送成功仍用固定 `Date.now()+60_000`，缺 `resendAvailableAt/serverTime`。依赖后端返回绝对冷却截止时间。
- **R-015（partial）**：限频拦截、冷却禁用、`limitType` 采集、按 code 渲染文案的前端管线✓；
  IP/UID/60s 的**区分性文案**依赖 PR-02235 的限频类型与错误码交付，本 PR 仅消费渲染。
- **切换/脱敏整体**：`SwitchVerifyMethodDialog` 的 `maskedTarget` 与切换 token 复用，依赖
  `login_in.verificationMethods` 契约确认（当前 schema 可选、mock 驱动，标 integration pending）。

## R-027 全链路回归

- 纯逻辑/契约已有单测；PC + 390px 双视口浏览器验收、GA 场景回归、后台下发不中断回归 → 未跑，
  按 AGENTS「e2e 可由人工在提测阶段统一跑」延后，标 not-required(本次未执行)。

## deferred（App / 后端 / Account-Assets 迁移批，非本批）

R-007, R-008, R-018, R-019, R-030, R-031, R-032, R-033, R-035, R-036。

## not-doing（他 PR / 用户确认不改）

R-020(PR-02235), R-021(PR-02189), R-026(PR-02234), R-028(忘记密码保持页面形式), R-034(PR-02189)。
