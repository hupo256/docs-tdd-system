# PR-02265 Agent 恢复说明

## 必读顺序

1. ../../common/rule-router.md
2. 执行 `node apps/web/docs_tdd/common/agent-scripts/docs-tdd.mjs context PR-02265 <SCENARIO>`
3. 读取命令生成的临时 context pack
4. ./handoff-*.md（最新交接文件，若无则跳过）

context pack 自动包含 ./context-summary.md 与场景专题；不要一次性读取整个 common。

## 交接文件索引

> 按 handoff-YYYY-MM-DD[-seq].md 命名；新交接产生时在此追加索引。

- 暂无

## Lark 能力

- 主动发群消息：待确认
- 群内 @ 应用转 task：待确认

## 编码环境

G2 scope 确认后，按 ../../common/coding-worktree.md 创建 feature/PR-02265 同级 worktree。

## Gate 命令

```bash
node apps/web/docs_tdd/common/agent-scripts/prd-intake.mjs PR-02265 --init --source <repo-relative-prd.md>
node apps/web/docs_tdd/common/agent-scripts/prd-intake.mjs PR-02265 --approve
node apps/web/docs_tdd/common/agent-scripts/verify-project-gate.mjs PR-02265 G2
node apps/web/docs_tdd/common/agent-scripts/verify-code-rules.mjs --project PR-02265
node apps/web/docs_tdd/common/agent-scripts/verify-project-gate.mjs PR-02265 G6
node apps/web/docs_tdd/common/agent-scripts/update-context-summary.mjs PR-02265 --stage G6 --write
```
