# API / Schema / Mapper 核心规则

> v4.0 standard 档规则 — API 数据处理红线（从 api-and-mapper.md 精简）

## 核心原则

1. **Schema 是 API 真值源**：schema 反映真实字段/类型/nullability
2. **不伪造缺失字段**：后端缺的字段前端不能捏造
3. **不修正根因缺陷**：后端错误不在前端掩盖

## 必须遵守

### 1. Schema 建模真实 API
```typescript
// ✅ 正确：nullable 字段标为 optional
const UserSchema = z.object({
  name: z.string(),
  phone: z.string().optional(), // 后端可能不返回
})

// ❌ 错误：明明可能 null 却标 required
const UserSchema = z.object({
  phone: z.string(), // 实际后端会返回 null
})
```

### 2. 不伪造缺失字段
```typescript
// ❌ 错误：后端没返回 avatar，前端造一个默认值
const user = { ...apiData, avatar: apiData.avatar || '/default.png' }

// ✅ 正确：缺失就是 undefined，UI 层判断
const user = apiData // avatar 可能 undefined
// UI: {user.avatar ? <img src={user.avatar} /> : <DefaultAvatar />}
```

### 3. 不掩盖后端根因错误
```typescript
// ❌ 错误：后端返回错误的 status，前端从 displayText 反推
const realStatus = statusDisplayMap[data.displayText] || data.status

// ✅ 正确：发现错误 → 报 blocker，不能上线
// 临时 workaround 需要：产品/API owner 批准 + 后端 ticket + 测试 + owner
```

### 4. List 解析逐项容错
```typescript
// ✅ 正确：解析失败的项跳过，不让一条坏数据炸整个列表
const parseList = (items: unknown[]) => {
  return items
    .map(item => UserSchema.safeParse(item))
    .filter(result => result.success)
    .map(result => result.data)
}

// ❌ 错误：一条坏数据导致整个列表解析失败
const parseList = (items: unknown[]) => items.map(item => UserSchema.parse(item))
```

## standard 档必查

- Schema 真实反映 API（不伪造 required/optional）
- Mapper 不捏造缺失字段
- 不掩盖后端根因错误（报 blocker）
- List 逐项解析容错

## 何时升级到 standard

当需求涉及：
- 新 API 接入（需要写 schema）
- 复杂数据转换（多层嵌套、条件映射）
- 后端字段变更（需要更新 schema）

## 参考

完整规则见 `~/.ai-rules/skills/coding-quality/references/api-schema-mapper.md`
