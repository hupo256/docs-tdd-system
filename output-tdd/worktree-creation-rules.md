# docs_tdd Worktree 创建规则

**脚本**: `prepare-coding-worktree.mjs`  
**版本**: v3.5.0  
**用途**: 为新需求创建隔离的 worktree 工作环境

---

## 🎯 基本规则

### 1. 项目 ID 格式

**规则**:
```javascript
// 默认格式：PR-xxxxx 或 TR-xxxxx
const projectIdPattern = /^(?:PR|TR)-\d{5}$/

// 可通过 config.projectIdPattern 自定义
```

**示例**:
- ✅ `PR-02440`
- ✅ `TR-02385`
- ❌ `pr-02440` (小写)
- ❌ `PR-123` (不足5位)
- ❌ `feature/PR-02440` (带前缀)

---

### 2. Worktree 目录结构

**位置规则**:
```
仓库根目录的父目录 / 项目ID

示例：
/Users/aven/github/fameex-web          # 仓库根目录
/Users/aven/github/PR-02440            # worktree 目录
/Users/aven/github/PR-02233            # 另一个 worktree
```

**实际代码**:
```javascript
const parentDir = dirname(repoRoot)
const worktreeDir = join(parentDir, projectId)

// 例如：
// repoRoot = /Users/aven/github/fameex-web
// projectId = PR-02440
// worktreeDir = /Users/aven/github/PR-02440
```

---

### 3. 分支命名规则

**规则**:
```javascript
// 优先级 1: README.md 中的 frontmatter 指定
branch: feature/PR-02440-custom

// 优先级 2: 默认规则
const branchName = `${config.branchPrefix || 'feature/'}${projectId}`

// 示例：
// projectId = PR-02440
// branchName = feature/PR-02440
```

**分支前缀**:
- 默认: `feature/`
- 可通过 `config.branchPrefix` 自定义

---

### 4. Base Ref（基准分支）

**规则**:
```javascript
// 默认从 origin/online 创建分支
const baseRef = readOption('--base-ref', 'origin/online')

// 可通过命令行参数覆盖：
// --base-ref origin/main
// --base-ref origin/develop
```

**检查规则**:
- ✅ 必须是当前分支的祖先
- ✅ 确保分支基于正确的基准创建
- ❌ 如果不是祖先，拒绝并报错

```javascript
const isDescendant = tryOutput('git', [
  'merge-base',
  '--is-ancestor',
  baseRef,
  'HEAD'
], worktreeDir)

if (!isDescendant) {
  fail('baseline check failed: 分支基于错误的 base 创建')
}
```

---

### 5. Git Worktree 创建

**命令**:
```bash
git worktree add -b <branchName> <worktreeDir> <baseRef>

# 实际示例：
git worktree add -b feature/PR-02440 /Users/aven/github/PR-02440 origin/online
```

**检查**:
- ✅ 检查 worktree 是否已存在
- ✅ 检查分支是否已存在
- ✅ 如果已存在且干净，复用
- ❌ 如果已存在且有未提交改动，报错

---

### 6. docs_tdd 符号链接

**规则**:
```javascript
// 在 worktree 中创建 docs_tdd 符号链接
const mainDocsTdd = docsSystemRoot
const linkedDocsTdd = join(worktreeDir, config.docsMountPath || 'docs_tdd')

// 创建符号链接：
ln -s /path/to/main/docs_tdd /path/to/worktree/docs_tdd
```

**检查**:
- ✅ 如果符号链接已存在且正确，跳过
- ✅ 如果符号链接目标错误，重新创建
- ❌ 如果存在同名目录（非符号链接），报错

---

### 7. 依赖安装

**规则**:
```bash
# 默认执行
pnpm install --frozen-lockfile

# 可跳过（使用 --skip-install）
```

**触发条件**:
- ✅ 默认总是执行
- ⏸️ `--skip-install` 参数可跳过

---

### 8. Dev Server 验证

**规则**:
```javascript
// 默认验证 dev server 可以启动
const port = readOption('--port', '4001')
const verifyPath = readOption('--verify-path', '/zh-CN')
const url = `http://localhost:${port}${verifyPath}`

// 启动 dev server
pnpm dev --port ${port}

// 等待健康检查（最多 120 秒）
await waitForHealthyPage(url, 120000)
```

**健康检查**:
- ✅ HTTP 200 响应
- ✅ HTML 包含 `<body` 标签
- ✅ 内容不为空
- ❌ 120 秒超时则失败

**可跳过**: `--skip-verify`

---

### 9. Work Context 安全检查

**规则**:
```javascript
assertSafeWorkContext({
  projectId,
  workItem,
  worktree: worktreeDir,
  baseRef,
  commitMode: 'no-commit',
  actionId: 'prepare-coding-worktree',
  targetPaths: []
})
```

**检查内容**:
- ✅ 项目 ID 有效
- ✅ Work item 存在且有效
- ✅ Worktree 路径正确
- ✅ Base ref 正确
- ✅ 无不安全操作

---

## 📋 完整流程

### 标准流程（按顺序）

```bash
# 1. 验证项目 ID 格式
PR-02440 ✅

# 2. 确定 worktree 位置
/Users/aven/github/PR-02440

# 3. 确定分支名称
feature/PR-02440

# 4. 检查 worktree 是否已存在
- 不存在 → 创建新的
- 已存在且干净 → 复用
- 已存在有改动 → 报错

# 5. 创建 git worktree
git worktree add -b feature/PR-02440 /Users/aven/github/PR-02440 origin/online

# 6. 基准分支检查
确保 feature/PR-02440 基于 origin/online

# 7. 创建 docs_tdd 符号链接
ln -s /path/to/main/docs_tdd /Users/aven/github/PR-02440/docs_tdd

# 8. 安装依赖
pnpm install --frozen-lockfile

# 9. 启动并验证 dev server
pnpm dev --port 4001
等待 http://localhost:4001/zh-CN 可访问

# 10. 完成
worktree 准备就绪
```

---

## 🚀 使用方式

### 基本用法

```bash
# 标准创建
node common/engine/agent-scripts/prepare-coding-worktree.mjs PR-02440

# 从不同 base 创建
node common/engine/agent-scripts/prepare-coding-worktree.mjs PR-02440 --base-ref origin/main

# 跳过安装和验证（快速）
node common/engine/agent-scripts/prepare-coding-worktree.mjs PR-02440 --skip-install --skip-verify

# 自定义端口和验证路径
node common/engine/agent-scripts/prepare-coding-worktree.mjs PR-02440 --port 3000 --verify-path /en-US

# 干运行（只显示命令，不执行）
node common/engine/agent-scripts/prepare-coding-worktree.mjs PR-02440 --dry-run
```

### 通过 docs-tdd CLI

```bash
# 如果 docs-tdd 集成了 worktree-prepare 命令
docs-tdd worktree-prepare PR-02440
```

---

## ⚠️ 常见错误和解决方案

### 错误 1: 项目 ID 格式不正确
```
❌ prepare-coding-worktree.mjs pr-02440
✅ prepare-coding-worktree.mjs PR-02440
```

### 错误 2: Worktree 已存在且有改动
```
错误: worktree /Users/aven/github/PR-02440 has uncommitted changes

解决:
1. cd /Users/aven/github/PR-02440
2. git status
3. git add . && git commit 或 git reset --hard
```

### 错误 3: 分支基于错误的 base
```
错误: baseline check failed: feature/PR-02440 不是 origin/online 的后代

解决:
1. 删除错误分支
2. 重新从正确的 base 创建
```

### 错误 4: 符号链接冲突
```
错误: docs_tdd exists and is not a symlink

解决:
1. cd /Users/aven/github/PR-02440
2. mv docs_tdd docs_tdd.bak
3. 重新运行 prepare-coding-worktree
```

### 错误 5: Dev server 端口被占用
```
错误: port 4001 is already in use

解决:
1. 使用不同端口: --port 4002
2. 或停止占用 4001 的进程
```

---

## 🔧 配置选项

### config.json 可配置项

```json
{
  "projectIdPattern": "(?:PR|TR)-\\d{5}",
  "branchPrefix": "feature/",
  "docsMountPath": "docs_tdd"
}
```

### README.md Frontmatter

```yaml
---
branch: feature/PR-02440-custom-name
---
```

---

## 📊 与 PR-02440 的对比

### PR-02440 实际使用的流程

**我们使用的**:
```bash
# 直接使用 git worktree add
git worktree add -b feature/PR-02440 .claude/worktrees/PR-02440 origin/online
```

**标准流程应该是**:
```bash
# 使用 prepare-coding-worktree.mjs
node common/engine/agent-scripts/prepare-coding-worktree.mjs PR-02440
```

**差异**:
1. ❌ 我们用了 `.claude/worktrees/PR-02440`（非标准位置）
2. ✅ 标准位置是 `/Users/aven/github/PR-02440`（父目录下）
3. ❌ 我们没有运行依赖安装
4. ❌ 我们没有验证 dev server

**建议**:
- 使用 `prepare-coding-worktree.mjs` 来创建 worktree
- 或者统一 worktree 位置为标准的父目录模式

---

## ✅ 总结

### Worktree 创建规则清单

- [x] 项目 ID 格式: `PR-xxxxx` 或 `TR-xxxxx`
- [x] Worktree 位置: 仓库父目录 / 项目ID
- [x] 分支命名: `feature/{projectId}`
- [x] Base ref: `origin/online`（默认）
- [x] 符号链接: `worktree/docs_tdd` → 主 docs_tdd
- [x] 依赖安装: `pnpm install --frozen-lockfile`
- [x] Dev server 验证: 启动并检查健康
- [x] 安全检查: `assertSafeWorkContext`

### 命令速查

```bash
# 标准创建
prepare-coding-worktree.mjs PR-02440

# 快速创建（跳过验证）
prepare-coding-worktree.mjs PR-02440 --skip-install --skip-verify

# 从其他分支创建
prepare-coding-worktree.mjs PR-02440 --base-ref origin/main

# 干运行
prepare-coding-worktree.mjs PR-02440 --dry-run
```

---

**创建日期**: 2026-09-21  
**版本**: v3.5.0  
**脚本**: prepare-coding-worktree.mjs
