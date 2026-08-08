# Startup Prompt

把下面模板作为新需求启动口令。目标是让 AI 每次从同一个入口开始，不依赖上一次对话记忆。

## 新需求启动模板

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 <PROJECT-ID>，PRD 文档是：<PRD 链接或本地路径>。

请先读取 apps/web/docs_tdd/common/rule-router.md，只按命中场景读取专题文档，不要一次性读取整个 common。
新项目优先执行 start-new-project.mjs 建骨架；G2/G5/G6/G7/G8 必须依次运行对应 gate，不得跳级。
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

1. 读取 `common/rule-router.md`。
2. 如需机器路由，读取 `common/rule-index.json` 中的 `new_project` 场景。
3. 执行统一编排入口：

```bash
node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs kickoff <PROJECT-ID> --prd <PRD> --title <项目短名>
```

4. 中断或换会话先运行 `docs-tdd status <PROJECT-ID>` 与 `docs-tdd next <PROJECT-ID>`；可安全重试的同步/intake 用 `docs-tdd resume <PROJECT-ID>`。
5. G2 / G5 / G6 / G7 / G8 前运行 `docs-tdd.mjs gate <PROJECT-ID> <GATE>`；代码变更后运行 `verify-code-rules.mjs --project <PROJECT-ID>`。只读 verifier 用于排障，不能代替正式 gate 写成功历史和推进阶段。
