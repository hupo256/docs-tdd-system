# Biome 配置摘要

> v4.0 micro/lite 档核心规则 — 格式化和 lint 基础

## 配置位置

- 根目录：`biome.json`
- 项目级：`apps/web/biome.json`（如果有）

## 核心规则

### 格式化
- 缩进：2 空格
- 行宽：120
- 引号：单引号
- 分号：必须
- 尾逗号：es5

### Lint 重点
- 未使用变量：error
- 未使用 import：error
- console.log：warn（生产环境 error）
- debugger：error
- any 类型：warn

## 快速修复

```bash
# 自动修复
pnpm biome check --write

# 只检查不修复
pnpm biome check

# 检查单个文件
pnpm biome check --write path/to/file.tsx
```

## 常见问题

1. **格式化冲突**：Biome 优先，禁用 Prettier
2. **import 排序**：Biome 自动排序，不需手动调整
3. **类型错误 vs lint 错误**：Biome 只管 lint，类型错误用 tsc

## micro/lite 档约束

- 必须通过 `biome check --write`
- 允许 warn，但 error 必须修复
- commit 前自动运行（precommit hook）
