# FameEX 共享组件速查

> v4.0 lite 档规则 — 优先复用已有组件

## 核心原则

**先找复用，再造轮子。** 改动前检查是否已有相似组件。

## 高频复用组件

### 1. 按钮相关

- `@fameex/ui` Button：基础按钮，支持 variant/color/size/isLoading/isDisabled
- `AccountContactSubmitButton`：账户联系方式提交按钮（已有 loading 支持）
- `ConfirmButton`：二次确认按钮

### 2. 输入相关

- `@fameex/ui` Input：基础输入框
- `AccountInput`：账号输入（邮箱/手机号）
- `CountryPhoneCode`：国家区号选择器
- `VerifyCodeInput`：验证码输入（6 位数字）

### 3. 表单相关

- `useForm`：表单状态管理 hook（@/utils/hooks/useForm）
- 校验规则：`@/utils/form/rules`（patternPhoneCode 等）
- 表单布局：`accountContactFormClassName` 等常量

### 4. 安全验证

- `AccountVerifyMan`：安全验证弹窗（二次确认）
- `SecurityVerificationCodes`：验证码类型定义
- `useSecurityVerification`：验证流程 hook

### 5. 国际化

- `useT`：翻译 hook（`const { t } = useT('namespace')`）
- 命名空间：user / common / trade / balance 等
- 键格式：`t('namespace:category.key')`

## 复用检查清单

在实现前问自己：

1. **UI 组件**：@fameex/ui 或 @/components 里有没有现成的？
2. **业务逻辑**：类似场景（登录/注册/修改密码）怎么做的？
3. **hooks**：useForm / useSnackbar / useSecurityVerification 能复用吗？
4. **工具函数**：@/utils 里有没有（encryptPasswordWithKey / validatePhoneNumber）？
5. **常量/类型**：OperationTypeEnum / MobileUpdateReq 等已定义类型

## 快速查找

```bash
# 找组件
rg "export.*Button" apps/web/src/components

# 找 hook
rg "export.*use[A-Z]" apps/web/src

# 找工具函数
ls apps/web/src/utils/

# 找类型定义
rg "type.*Req\|interface.*Req" apps/web/src/services
```

## lite 档约束

- 优先复用已有组件（不重新造轮子）
- 新组件必须有充分理由（现有的确实不满足）
- 复用时保持原有 API 不变（加 optional 属性可以）

## 示例

**❌ 错误**：自己写一个 LoadingButton
**✅ 正确**：用 `@fameex/ui` Button 的 `isLoading` 属性

**❌ 错误**：自己写表单校验逻辑
**✅ 正确**：用 `useForm` + `@/utils/form/rules`

**❌ 错误**：硬编码验证码长度
**✅ 正确**：用 `patternPhoneCode` 常量
