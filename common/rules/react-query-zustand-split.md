# React Query / Zustand 分治规则

> v4.0 standard 档规则 — 状态管理职责划分（从 architecture-and-state.md 精简）

## 核心原则

**服务器状态用 React Query，本地 UI 状态用 Zustand。不要在 store 里复制服务器数据。**

## 职责划分

### React Query 管什么
- 服务器数据（API 返回的）
- 缓存策略（staleTime / cacheTime）
- 自动重试 / 后台重新获取
- 乐观更新（optimistic update）

```typescript
// ✅ 正确：服务器数据用 React Query
const { data: user, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
})
```

### Zustand 管什么
- 本地 UI 状态（弹窗开关、选中项、tab index）
- 跨组件共享的临时状态
- 不需要持久化到服务器的状态

```typescript
// ✅ 正确：本地 UI 状态用 Zustand
const useModalStore = create<ModalState>(set => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
```

## 禁止模式

### ❌ 错误 1：store 里复制服务器数据
```typescript
// ❌ 错误：user 数据来自 API，不应该存 Zustand
const useUserStore = create<UserState>(set => ({
  user: null,
  setUser: (user) => set({ user }),
}))

// 组件里
const { data: user } = useQuery(['user'], fetchUser)
useEffect(() => {
  if (user) userStore.setUser(user) // 多此一举！
}, [user])
```

### ❌ 错误 2：Zustand 管 loading 状态
```typescript
// ❌ 错误：loading 状态应该用 React Query 的 isLoading
const useUserStore = create<UserState>(set => ({
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}))
```

### ❌ 错误 3：手动同步 cache 和 store
```typescript
// ❌ 错误：需要手动同步，容易不一致
const { data: user } = useQuery(['user'], fetchUser)
const storeUser = useUserStore(state => state.user)
// 哪个是最新的？user 还是 storeUser？
```

## 正确模式

### ✅ 模式 1：服务器数据直接用 React Query
```typescript
const { data: user, isLoading } = useQuery(['user'], fetchUser)

// 不需要 store，直接用 data
return isLoading ? <Spinner /> : <div>{user.name}</div>
```

### ✅ 模式 2：本地 UI 状态用 Zustand
```typescript
const useFilterStore = create<FilterState>(set => ({
  selectedCategory: 'all',
  setCategory: (cat) => set({ selectedCategory: cat }),
}))

// 组件里
const category = useFilterStore(state => state.selectedCategory)
const { data: items } = useQuery(['items', category], () => fetchItems(category))
```

### ✅ 模式 3：派生状态直接计算
```typescript
// ✅ 正确：派生状态不存 store，用 useMemo 计算
const { data: orders } = useQuery(['orders'], fetchOrders)
const pendingOrders = useMemo(
  () => orders?.filter(o => o.status === 'pending') ?? [],
  [orders]
)
```

## 何时例外

**仅在现有架构已经用 store 存服务器数据时，保持一致性。** 但新功能不应该再这样做。

## standard 档检查

- 服务器数据用 React Query（不复制到 Zustand）
- 本地 UI 状态用 Zustand（不用 React Query）
- 派生状态用 useMemo 计算（不存 store）
- 不手动同步 cache 和 store

## 参考

完整规则见 `~/.ai-rules/AGENT.md` React Query / Zustand 分治章节
