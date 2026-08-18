# G6 验收证据 — PR-02306 注册登录密码规则修改

- 验收 HEAD：`5e45db23a611dfb3c2dadc0684509fe95a376ea0`（分支 `feature/PR-02306`）
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

## F02 — 规则展示文案同步完整字符列表

方法：源码 + i18n 核对。

- `apps/web/src/i18n/locales/zh-CN/register.json`：`passwordRule.special = "至少1个特殊符号（{{chars}}）"`。
- `apps/web/src/apps/Register/RegisterV2/CreatePassword.tsx:64`：`t('register:passwordRule.special', { chars: PASSWORD_SPECIAL_CHARS })`，字符列表由单一源插值，扩符号自动同步。
- 渲染结果：`至少1个特殊符号（@$!%*#?&-.=(),/^_+[]{}）`，与实际校验字符集一致。
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

## 机器事实层（verify-build-quality）

- VERIFY-TYPE-002 PASS：改动外 tsc 270 ≤ 基线 270（delta 0）。
- VERIFY-TEST-001/002 PASS：相关测试文件全绿。
- VERIFY-BIOME-001 PASS。
- VERIFY-TYPE-001：`regex.ts:24 TS1501` 为既有 `/gu` flag 历史问题，非本 PR 引入，已在 `agent/rule-waivers.json` 登记豁免。
