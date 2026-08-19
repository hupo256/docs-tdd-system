# G6 验收证据 — PR-02306 注册登录密码规则修改

- 验收 HEAD：`e431b78e38bdc0dcfa5d4095071a2a01c78f17dd`（分支 `feature/PR-02306`）
- 仓库：`/Users/aven/github/fameex-web`
- 验收日期：2026-08-18
- 单一事实源：`apps/web/src/constants/regex.ts`

## F01 — 扩展密码允许特殊字符（新增 `^ _ + [ ] { }`）

方法：Vitest（`apps/web/src/constants/regex.test.ts`，13 用例中密码相关 8 描述块 / 共 12 tests）+ 源码核对。

实测输出：

```
 ✓ |@fameex/core| apps/web/src/constants/regex.test.ts (12 tests) 3ms
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

覆盖点：
- `PASSWORD_SPECIAL_CHARS === '@$!%*#?&-.=(),/^_+[]{}'`，逐符号断言含新增 `^ _ + [ ] { }`。
- 每个特殊符号被字符类字面量识别（无误当范围）；`:` 等区间外字符仍被拒绝（旧 `&-.` 范围 bug 已消除）。
- 字母/数字/特殊三者缺一必挂；长度 7/8/20/21 边界正确。
- 数字必填保留（`(?=.*\d)`），符合 G2 决策。

## F02 — 规则展示文案改四行清单 + 抽取共享组件

方法：Vitest（`apps/web/src/components/PasswordRuleChecklist.test.ts`）+ 源码/i18n 核对。

实测输出：

```
 ✓ |@fameex/core| apps/web/src/components/PasswordRuleChecklist.test.ts (5 tests) 6ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

- 文案四行（较 rev298 新增「至少1个数字」独立行）：
  - `passwordRule.length = "密码包含8-20个字符"`
  - `passwordRule.letter = "至少1个英文字母"`
  - `passwordRule.number = "至少1个数字"`（本次新增）
  - `passwordRule.special = "至少1个特殊符号（{{chars}}）"`
- `apps/web/src/components/PasswordRuleChecklist.tsx`：四项由单一源正则实时校验（长度 `PASSWORD_MIN/MAX_LENGTH`、`PASSWORD_LETTER_RE`、`PASSWORD_DIGIT_RE`、`PASSWORD_SPECIAL_RE`），`special` 行经 `t('register:passwordRule.special', { chars: PASSWORD_SPECIAL_CHARS })` 插值，扩符号自动同步。
- 组件单测覆盖：空输入（四项中性）/全通过/仅字母（数字+特殊挂）/长度不足（仅长度挂）/新增符号 `_` 放行。
- `CreatePassword.tsx` 改为消费该组件，删除本地清单副本。
- 本地仅改 zh-CN，其余语种交国际化团队（用户要求）。

## F03 — 所有密码场景走同一校验源

方法：全仓 grep 消费者盘点 + 残留副本扫描。

5 个消费者均指向单一源，无本地副本：

| 场景 | 文件 | 引用 |
|------|------|------|
| 注册创建密码 | `apps/Register/RegisterV2/CreatePassword.tsx` | `passwordPattern` + `PASSWORD_SPECIAL_*` |
| 找回密码 | `apps/ResetPassword/ResetForm.tsx` | `passwordPattern`（经 const 再导出） |
| 设置登录密码 | `apps/SetLoginPassword/index.tsx` | `passwordPattern`（经 const 再导出） |
| 修改密码 | `apps/UpdatePassword/index.tsx` | `passwordPattern`（经 const 再导出） |
| 登录输入过滤 | `apps/Login/InputAccount.tsx` | `passwordAllowedCharPattern`（直连单一源） |
| 随机临时密码 | `apps/Register/common/const.ts` | `PASSWORD_SPECIAL_CHARS` 取样池 |

残留副本扫描：`grep -rn '@$!%*#?&'`（排除 regex.ts）→ 0 命中，无散落字符列表。

单测 `login input filter keeps allowed (incl. new) chars` 断言 `Aa1^_+[]{}` 经登录过滤器后原样保留，新符号不被剔除。

## F04 — 重置密码页展示四行规则清单

方法：源码核对（`apps/web/src/apps/ResetPassword/ResetForm.tsx`）。

- authPassed 阶段「设置新密码」`PasswordInput` 下方，原单行文案 `resetPassword:passwordRequirement`（icon + span）替换为 `<PasswordRuleChecklist password={password} className="mb-6" />`。
- 与注册页共用同一组件与单一源，实时校验逻辑一致；`passwordRequirement` 旧 key 在源码中已无引用。

## F05 — 修改登录密码页展示四行规则清单（含兄弟页对齐）

方法：源码核对（`apps/web/src/apps/UpdatePassword/index.tsx`、`apps/web/src/apps/SetLoginPassword/index.tsx`）。

- `UpdatePassword`：新密码 `PasswordInput`（`newLoginPword`）下方新增 `<PasswordRuleChecklist password={values.newLoginPword} className="-mt-2 mb-6" />`；原登录密码 `loginPword` 为验证字段，仅 `required`，不套设置强规则（避免存量无特殊字符老密码被锁）。
- `SetLoginPassword`（三方登录设置登录密码，同源兄弟页）：新密码下方单行文案替换为 `<PasswordRuleChecklist password={password} className="mb-6" />`，与修改页/注册页一致，避免同一「设置登录密码」清单不一致。
- 乙类 BindGoogle 验证字段同步为仅 `required`（已提交 `33484a68ab`）。

## 机器事实层（verify-build-quality）

- VERIFY-TYPE-002 PASS：改动外 tsc 270 ≤ 基线 270（delta 0）。
- VERIFY-TEST-001/002 PASS：相关测试文件全绿。
- VERIFY-BIOME-001 PASS。
- VERIFY-TYPE-001：`regex.ts:24 TS1501` 为既有 `/gu` flag 历史问题，非本 PR 引入，已在 `agent/rule-waivers.json` 登记豁免。
