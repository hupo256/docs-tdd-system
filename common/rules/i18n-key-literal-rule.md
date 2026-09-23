# i18n 键字面量规则

> v4.0 standard 档规则 — i18n Ally WYSIWYG

## 核心原则

**键必须是字面量，支持 WYSIWYG（所见即所得）。**

i18n Ally 需要在源码里看到完整的 `t('namespace:category.key')` 才能：
1. 提示补全
2. 显示译文预览
3. 检测缺失/未使用 key

## 正确写法

### 1. 直接字面量
```typescript
// ✅ 正确
const text = t('user:login.submit')
const error = t('common:validation.required')
```

### 2. enum/status 映射（reasonMap 模式）
```typescript
// ✅ 正确：map 的值是字面量 t() 调用
const statusTextMap: Record<Status, string> = {
  pending: t('trade:status.pending'),
  success: t('trade:status.success'),
  failed: t('trade:status.failed'),
}
const text = statusTextMap[order.status]
```

### 3. 动态 key + defaultValue（仅限后端返回的 key）
```typescript
// ✅ 正确：后端返回的错误码是动态的，必须用 defaultValue
const errorText = t(`error:${errorCode}`, { defaultValue: errorCode })
```

## 禁止写法

### ❌ 错误 1：变量插值
```typescript
// ❌ 错误：i18n Ally 无法静态分析
const category = 'login'
const text = t(`user:${category}.submit`) // Ally 不知道 key 是什么
```

### ❌ 错误 2：key 存变量
```typescript
// ❌ 错误：键存在变量里，Ally 看不到
const key = 'user:login.submit'
const text = t(key)
```

### ❌ 错误 3：map 值是 key 字符串
```typescript
// ❌ 错误：map 值不是 t() 调用，而是 key 字符串
const statusKeyMap: Record<Status, string> = {
  pending: 'trade:status.pending', // 只是 key，不是译文
  success: 'trade:status.success',
}
const text = t(statusKeyMap[order.status]) // 这样 Ally 看不到实际 key
```

## 检查方式

### 人工检查
- 搜索 `t(` 调用
- 确认第一个参数是字面量字符串（或 map 值是字面量 t()）
- 动态 key 必须有 defaultValue

### i18n Ally 检查
- 安装 VSCode 插件：i18n Ally
- 悬停 `t()` 调用看预览
- 如果显示「Unknown key」→ 可能是动态 key 或 key 不存在

## standard 档约束

- 所有 `t()` 调用键必须字面量（除非后端动态 + defaultValue）
- enum/status 映射用 reasonMap 模式（map 值是 `t('literal')`）
- 新增 key 后运行 `pnpm i18n:sync` 同步到 .json

## 示例对比

```typescript
// ❌ 错误示例
const getStatusText = (status: Status) => {
  const keyMap = { pending: 'trade:status.pending', success: 'trade:status.success' }
  return t(keyMap[status])
}

// ✅ 正确示例
const statusTextMap: Record<Status, string> = {
  pending: t('trade:status.pending'),
  success: t('trade:status.success'),
}
const getStatusText = (status: Status) => statusTextMap[status]
```

## 参考

完整规则见 `~/.ai-rules/AGENT.md` i18n 键字面量章节
