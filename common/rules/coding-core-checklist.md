# 编码核心清单

> v4.0 micro/lite 档核心规则 — 最小质量红线

## React/TypeScript 硬规则

### 1. 命名输入类型
- 2+ 参数（含回调）→ 必须定义 `XxxProps`/`XxxParams`
- 在函数体内解构，不用匿名内联类型
- 禁止 `Record<string, unknown>` 捷径

### 2. 避免裸 any
- 外部数据用 schema / type guard / unknown
- 不确定性用具体类型或 union，不隐藏在 `any`

### 3. i18n 键字面量（WYSIWYG）
- 写 `t('ns:literal.key')`，不存变量
- enum/status 映射：`reasonMap[status]` 值必须是字面量 `t()` 调用
- 禁止 `t(\`ns:\${x}\`)` 插值（除非后端动态 key + defaultValue）

### 4. 不伪造缺失数据
- 必填缺失 → 显示 `--` 或占位符
- 可选缺失 → 不渲染
- 禁止 `?? 'fake copy'` 或 `|| 'fake value'`

### 5. 文件大小
- `.tsx` < 300 行
- 超了就拆：子组件 / 纯函数 / 常量 / 类型

## micro 档必查项（3 条）

1. Biome 通过（format + lint）
2. 命名类型（组件/hook 有 Props/Params）
3. 无 `any`（除非显式标注理由）

## lite 档补充（+2 条）

4. i18n 键字面量（`t('literal')`）
5. 不伪造数据（缺失用 `--` 或不渲染）

## 检查方式

```bash
# Biome
pnpm biome check --write

# 类型检查
pnpm tsc --noEmit

# 命名/i18n/伪造数据：人工 review 或静态分析
```

## 参考

完整清单见 `~/.ai-rules/skills/coding-quality/SKILL.md`（按需加载，不常驻）
