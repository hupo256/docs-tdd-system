<!-- template-version: 1 -->
<!-- template-effective-since: 2026-07-23 -->

# <PROJECT-ID> 交接 — <YYYY-MM-DD>（给其他 AI）

> **目的**：接续 AI 无需重读对话，直接按本文件进入下一阶段。  
> **记录人**：Agent · **分支** `feature/<PROJECT-ID>` · **worktree** `<WORKTREE-PATH>`  
> **上一版**：`handoff-YYYY-MM-DD.md`（若有）

---

## 一句话

**<一句话概括当前状态、已落码内容和剩余关键事项。>**

---

## 环境

| 项 | 值 |
|----|-----|
| worktree 路径 | `<WORKTREE-PATH>` |
| 分支 | `feature/<PROJECT-ID>` |
| 端口 | `<PORT>` |
| 当前阶段 | <G0-G8> |
| 最新 commit | `<COMMIT-HASH>` <COMMIT-MSG> |

---

## 本轮已完成

| 项 | 产出 / 状态 |
|----|------------|
| <事项 1> | <结果> |

---

## AI 必读顺序（按序，勿跳）

| # | 文件 | 用途 |
|---|------|------|
| 1 | **本文件** | 交接入口 + 编码 checklist |
| 2 | `../product/00-feature-inventory.md` | G2 定稿的功能清单与决策 |
| 3 | `../product/02-technical-design.md` | 复用盘点与技术方案 |
| 4 | `../product/04-frontend-tasks.md` | 任务清单与当前进度 |
| 5 | `../product/05-ui-and-interaction.md` | UI/交互规格 |
| 6 | `../product/07-figma-spec.md` | Figma 几何/token/nodeId |
| 7 | `../product/03-api-contract.md` | schema / ASSUMED（改 UI 勿破坏传参） |
| 8 | `../product/06-collaboration.md` | 待确认项与风险 |
| 9 | `./context-summary.md` | 短摘要 + 关键决策 |
| 10 | `../../common/rules/rule-router.md` | 开工路由 |

---

## 代码落点

```text
<关键目录/文件树，说明每个文件的职责。>
```

**最新 commit**：`<COMMIT-HASH>` <COMMIT-MSG>

---

## 本轮编码指南

### 目标范式

| 目标 | 现状 | 目标态 | 参考 |
|------|------|--------|------|
| <...> | <...> | <...> | <Figma node / 文档> |

### 硬规格（编码时对照）

| 元素 | preset / 组件 / 约定 |
|------|---------------------|
| <...> | <...> |

### 编码约束

- <约束 1>
- <约束 2>

### 建议步骤

1. <步骤 1>
2. <步骤 2>

---

## 验证命令

```bash
cd <WORKTREE-PATH>
git checkout feature/<PROJECT-ID>

# 按需替换为项目实际命令
pnpm --filter @fameex/web test
pnpm --filter @fameex/web typecheck
pnpm --filter @fameex/web lint
```

Gate（文档侧，编码后可选）：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project <PROJECT-ID>
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs <PROJECT-ID> G6
```

---

## 待办 / 阻塞

| 优先级 | 项 | 状态 | 负责 |
|--------|-----|------|------|
| **P0** | <关键待办> | <状态> | <负责> |
| P1 | <次要待办> | <状态> | <负责> |

---

## 已知陷阱（勿重复踩）

| # | 说明 |
|---|------|
| T1 | <陷阱 1> |
| T2 | <陷阱 2> |

---

## 升级路径

- scope 变更 → `../product/06-collaboration.md` + 重新 G2
- 契约变更 → 先 `../product/03-api-contract.md` + schema，再 UI
- 阶段推进 → 更新本文件「待办」+ `./context-summary.md` + 可选 `../product/04-frontend-tasks.md` 勾选
