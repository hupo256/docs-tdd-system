# Startup Prompt

把下面模板作为新需求启动口令。目标是让 AI 每次从同一个入口开始，不依赖上一次对话记忆。

## 新需求启动模板

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 <PROJECT-ID>，PRD 文档是：<PRD 链接或本地路径>。

请先读取 apps/web/docs_tdd/common/rules/rule-router.md，只按命中场景读取专题文档，不要一次性读取整个 common。
新项目默认走 vNext(kickoff 建 work-item.json 三文件,单一出口 vnext-verify;抽需求→独立冷读审查→补证据→verify 写出口)。V2 级出口在 PR-02233 闭环前只做 shadow 参考;存量项目继续 v1,显式回 v1 用 --legacy。
代码静态扫描只 review 新增或已修改文件。
```

可选补充：

```text
Figma：<链接 / node id>
API / YApi：<链接>
QA：<链接>
是否启用主动发群消息：是 / 否 / 稍后
是否启用群内 @ 自动任务：是 / 否 / 稍后
```

## Agent 启动顺序

1. 读取 `common/rules/rule-router.md`。
2. 如需机器路由，读取 `common/rules/rule-index.json` 中的 `new_project` 场景。
3. 执行统一编排入口（默认 vNext;`--legacy` 回 v1 门禁链）:

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs kickoff <PROJECT-ID> --prd <PRD> --title <项目短名>
# vNext 项目接下来:抽取原子需求(带 sourceAnchor)→ vnext-verify --prepare-review 冷读审查 → 补证据 → vnext-verify --write
```

4. 中断或换会话先运行 `docs-tdd status <PROJECT-ID>` 与 `docs-tdd next <PROJECT-ID>`；可安全重试的同步/intake 用 `docs-tdd resume <PROJECT-ID>`。
5. **v1 项目**:G2 / G5 / G6 / G7 / G8 前运行 `docs-tdd.mjs gate <PROJECT-ID> <GATE>`；代码变更后运行 `verify-code-rules.mjs --project <PROJECT-ID>`。只读 verifier 用于排障，不能代替正式 gate 写成功历史和推进阶段。**vNext 项目**不跑 G 门禁链，以 `vnext-verify.mjs --write` 的 latest-result 为唯一出口。
