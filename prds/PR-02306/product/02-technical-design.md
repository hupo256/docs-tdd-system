<!-- template-version: 3 -->
<!-- template-effective-since: 2026-07-25 -->

# Technical Design — PR-02306 注册登录密码规则修改

## 复用盘点（G4 前必填）

> 规则：实现前必须优先复用已有逻辑、工具、组件；相近能力先轻量封装或组合，只有明显不适配时才新建。新建必须写明不复用原因。

| 类型 | 已检查位置 / 名称 | 结论 | 采用方式 | 不复用原因（仅新建时必填） |
|------|-------------------|------|----------|----------------------------|
| utils / 常量（校验源） | `apps/web/src/apps/Register/common/const.ts`(`passwordPattern`,`TEMP_SPECIALS`)、`apps/web/src/constants/regex.ts`(`PASSWORD` 死代码,`passwordAllowedCharPattern`)、`apps/web/src/apps/Register/RegisterV2/CreatePassword.tsx`(`ALLOWED_SYMBOL_RE`) | 特殊字符集**在 4 处重复、无单一源**，直接就地改会漏改且未来继续漂移 | 抽公共能力：新建单一常量源，4 处消费者全部改为 import | — |
| 组件 | `CreatePassword.tsx` 密码规则清单（绿勾/红叉） | 现有清单组件够用，仅数据源指向新常量 | 直接复用 | — |
| hooks | 无密码校验相关 hook | N/A | — | — |
| services / API | 无（纯前端校验，PRD 明确前端闭环，不需后端） | N/A | — | — |
| stores / selectors | 无 | N/A | — | — |
| 历史项目实现 | 无同类项目 | N/A | — | — |

## 单一事实源与所有权（G4 前必填）

| 事实 / 状态 / 规则 | 权威来源 / 唯一写入口 | 消费者与读取 / 派生方式 | 是否存在副本 | 副本同步、失效、owner 与验证证据 |
|--------------------|-----------------------|--------------------------|--------------|------------------------------------|
| 密码允许的特殊字符集 | 新建常量 `PASSWORD_SPECIAL_CHARS` / `SPECIAL_CLASS`（正则字符类）单一源，位置：`apps/web/src/constants/`（密码规则专用模块） | `passwordPattern`（注册/重置/设置/修改提交校验）、`passwordAllowedCharPattern`（登录输入过滤）、`CreatePassword.tsx` 清单判定、`generateRegisterTempPassword` 随机密码均从此常量派生 | 改造后：否（本次目标即消除现有 4 份副本） | 改造后无副本；单测断言各消费者对 `^ _ + [ ] { }` 一致放行 |

## 数据流与分层契约（请求型功能 G4 前必填）

| Feature / Component | React Query Hook | Query Key | API Service | Response Schema / DTO | Mapper | UI Model | State Owner | Test |
|---------------------|------------------|-----------|-------------|-----------------------|--------|----------|-------------|------|
| N/A（纯前端校验，无请求） | N/A | N/A | N/A | N/A | N/A | N/A | local form state | 校验函数纯单测 |

## 状态 / 文案 / class 映射

| 场景 | 输入 key | 输出 | 实现位置 |
|------|----------|------|----------|
| 密码规则清单（长度+数字 / 字母 / 特殊符号） | 各布尔判定 | i18n label + 绿勾/红叉 | `CreatePassword.tsx` `ruleItems`（沿用现状，仅特殊符号判定改指新常量） |

## Tailwind preset 对齐

| UI 项 | Figma 值 | preset class | 例外说明 |
|-------|----------|--------------|----------|
| N/A（无新增视觉/尺寸，仅文案/校验逻辑） | — | — | — |

## 方案

### 目标
把密码「允许特殊字符集」从 `@ $ ! % * # ? & - . = ( ) , /` 扩为 `@ $ ! % * # ? & - . = ( ) , / ^ _ + [ ] { }`（新增 `^ _ + [ ] { }`），并收敛为**单一事实源**，让登录/注册/找回/重置/设置/修改/随机密码全部一致。数字必填、长度 8–20、字母必填均**不变**（PRD §产品方案 2 明确保留「数字+英文+特殊字符」）。

### 单一源设计
在 `apps/web/src/constants/regex.ts`（G2 决策：并入现有正则常量模块，不新建文件）以一份字符串常量为唯一源，派生所有正则：

```ts
// PR-02306：特殊符号集合（人可读，用于文案展示 + 测试；单一事实源）
export const PASSWORD_SPECIAL_CHARS = '@$!%*#?&-.=(),/^_+[]{}'
// 正则字符类主体：] [ 转义、^ 不置首位、- 置末尾，确保均按字面量匹配
const SPECIAL_CLASS = '@$!%*#?&.=(),/^_+\\[\\]{}-'
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 20
export const PASSWORD_LETTER_RE = /[A-Za-z]/
export const PASSWORD_DIGIT_RE = /\d/
export const PASSWORD_SPECIAL_RE = new RegExp(`[${SPECIAL_CLASS}]`)
// 提交校验：8-20 且含字母+数字+特殊符号
export const passwordPattern = new RegExp(
  `^(?=.*[A-Za-z])(?=.*\\d)(?=.*[${SPECIAL_CLASS}])[A-Za-z\\d${SPECIAL_CLASS}]{8,20}$`, 'i')
// 登录输入过滤：匹配「不允许字符」用于剔除
export const passwordAllowedCharPattern = new RegExp(`[^A-Za-z\\d${SPECIAL_CLASS}]`, 'g')
```

`SPECIAL_CLASS` 是唯一源；`PASSWORD_SPECIAL_CHARS` 是其对应的「可读展示串」（供文案插值），两者同处一文件、同批维护，扩符号时只改这两行。

### 消费者改造（4 处 → 全部 import 单一源）
1. `apps/web/src/apps/Register/common/const.ts` — 删除本地 `passwordPattern` 与 `TEMP_SPECIALS`，改从新模块导入；`generateRegisterTempPassword` 用 `PASSWORD_SPECIAL_CHARS` 取特殊符号池。
2. `apps/web/src/apps/Register/RegisterV2/CreatePassword.tsx` — 删除本地 `ALLOWED_SYMBOL_RE`/`DIGIT_RE`/`LETTER_RE`/`MIN/MAX_LENGTH`，改用新模块导出。
3. `apps/web/src/constants/regex.ts` — `passwordAllowedCharPattern` 改从新模块 re-export；死代码 `PASSWORD` 删除（无引用）或指向 `passwordPattern`（防止再被误用）。
4. 其余消费方（`ResetForm`、`SetLoginPassword`、`UpdatePassword`）经 `passwordPattern` 间接受益，无需改动（仅确认 import 路径仍有效）。

### 文案（F02）— G2 决策：展示完整字符列表
- `passwordRule.special` 文案改为「至少1个特殊符号（{{chars}}）」，`chars` 由单一源 `PASSWORD_SPECIAL_CHARS` 插值传入 `t()`，避免字符集在文案里再写死一份（DRY，扩符号只改常量）。
- 全语言处理：`register.json` 各 locale 的 `passwordRule.special`（zh-CN 扁平点键、其余嵌套对象）统一加 `（{{chars}}）` 占位；`chars` 不翻译，其余文字按各语言既有译法保留。
- i18n 规则遵守：键为字面量，仅对固定键插值 value（非动态键），符合 `~/.ai-rules/AGENT.md` i18n 硬规则。

### 测试
- 对 `passwordPattern` / `passwordAllowedCharPattern` / `PASSWORD_SPECIAL_RE` 做单测：逐个断言新增 `^ _ + [ ] { }` 及原有符号全部放行、常见非法字符（空格、中文、`<>` 等）仍拦截、长度边界 7/8/20/21。
- 手动过一遍 6 个场景（登录粘贴含新符号密码不被过滤、注册清单勾选、重置/设置/修改提交、随机密码生成）。
