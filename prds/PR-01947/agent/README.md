# PR-01947 Agent 恢复说明

## 必读顺序（AI 接手）

1. **`./handoff-2026-07-14.md`** — **交接入口（2026-07-14 · 含 JF1 编码指南）**
2. `./context-summary.md` — 短摘要
3. `../product/07-figma-spec.md` — L2 基线（**2026-07-14** 智能比例 Tab）
4. `../product/05-ui-and-interaction.md` — 字段顺序 + 交互
5. `../evidence/ui-ux/2026-07-14/README.md` — Figma 读取证据
6. `../product/03-api-contract.md` — schema / ASSUMED
7. `../../../common/rules/rule-router.md` — 开工路由

历史背景（按需）：

- `./handoff-2026-07-13.md` — G6 前后人读摘要
- `./handoff-g4-coding.md` — G4 编码决策 + MSW

## 交接文件索引

- `handoff-2026-07-14.md` — 最新交接（JF1/JF2 编码指南）
- `handoff-2026-07-13.md` — G6 前后摘要
- `handoff-2026-07-14-b.md` — 补充记录
- `handoff-g4-coding.md` — G4 编码决策 + MSW 试点

按当前任务在 `../../../common/rules/rule-index.json` 命中场景后，再读取对应专题；不要一次性读取整个 common。

## 当前阶段

| 阶段 | 状态 |
|------|------|
| G6 自测 | ✅ PASS（2026-07-09） |
| Figma 规格（智能比例 Tab） | ✅ 2026-07-14 |
| **JF1 编码** | ⏳ **待做（P0）** |
| JF2 确认弹窗 | ⏳ 待做 |
| G5 后端对账 | ⏳ 等后端 |

## 编码环境

- 分支：`feature/PR-01947`
- Worktree：`/Users/aven/github/PR-01947`
- 详见 `../../../common/rules/coding-worktree.md`

## Gate 命令

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-01947
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01947 G6
# G5 对账完成后：
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-01947 G8 --write
```

## Lark 能力

- 主动发群消息：未启用
- 群内 @ 应用转 task：未启用
