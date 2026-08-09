# PR-02074 Agent 恢复说明

## 必读顺序

1. ../../../common/rules/rule-router.md
2. ./context-summary.md
3. ../product/00-feature-inventory.md
4. ../product/06-collaboration.md

按当前任务在 ../../../common/rules/rule-index.json 命中场景后，再读取对应专题；不要一次性读取整个 common。

## Lark 能力

- 主动发群消息：待确认
- 群内 @ 应用转 task：待确认

## 交接文件索引

- `handoff-2026-07-22.md` — G4 编码入口

## 编码环境

G2 scope 确认后，按 ../../../common/rules/coding-worktree.md 创建 feature/PR-02074 同级 worktree。

## Gate 命令

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-02074 G2
node apps/web/docs_tdd/common/engine/agent-scripts/verify-code-rules.mjs --project PR-02074
node apps/web/docs_tdd/common/engine/agent-scripts/verify-project-gate.mjs PR-02074 G6
node apps/web/docs_tdd/common/engine/agent-scripts/update-context-summary.mjs PR-02074 --stage G6 --write
```
