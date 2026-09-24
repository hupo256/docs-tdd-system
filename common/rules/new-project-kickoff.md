# 新项目一句话启动协议

> 本文只定义启动编排。docs_tdd v3.5 的第二代协议规则以 [../vnext/README.md](../vnext/README.md) 为准，项目兼容标识为 `workflowVersion: 2`；第一代专题只服务 `workflowVersion: 1` 存量项目或显式 `--legacy` 项目。章节号 §2 被外链引用，勿改编号。

## 1. 启动口令

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：https://...
```

可同时提供 Figma、API/YApi、QA、Lark 配置。只给项目号与 PRD 时也立即启动；缺料必须显式记录为 blocker，不静默猜测。

## 2. Agent 自动执行链路

1. 读 [rule-router.md](./rule-router.md)，禁止全读 `common/`。
2. 运行 `docs-tdd run <PROJECT-ID> --prd <source> --title <title>`。新项目默认创建 `workflowVersion: 2` 并同步、绑定来源；重复运行会恢复已有项目。已定位缺陷使用 `--kind bugfix`，来源绑定为 incident 且分支使用 `fix/<PROJECT-ID>`；只有用户明确要求 v1 时才使用 `docs-tdd kickoff ... --legacy`。
3. `run` 按 canonical state 推进确定性动作，并返回唯一下一步。当前未配置宿主 Agent adapter 的语义动作会明确返回 `needs-agent`，不能当成完成；V2 scope approval 和必要业务裁决返回 `needs-user`。同步或来源漂移失败时保留现状并阻断；不得用旧副本冒充最新来源。
4. v2：从 source snapshot 抽取原子需求和 surface，执行独立冷读覆盖审查，完成风险路由；V2 还必须取得绑定当前 fingerprint 的 human scope approval。上述范围动作完成前不写业务代码。
5. v2：实现后采集绑定当前 `headSha + dirtyHash` 的证据，运行 `docs-tdd verify <PROJECT-ID> --input <verify-input.json>`。它强制写入 `latest-result.json` / `runs.jsonl`；只有 `mode=enforced,status=passed,ok=true` 可交付。
6. v1：继续按 [prd-feature-inventory.md §3](./prd-feature-inventory.md) 完成 G0–G2，G2 前不写业务代码，再按 [workflow-gates.md](./workflow-gates.md) 推进 G3–G8。
7. 两种工作流进入编码前都按 [coding-worktree.md](./coding-worktree.md) 准备项目 worktree；不能把 v1 Gate 和 v2 verify 混用。

## 3. 缺资料处理

v2 把缺 PRD/Figma/API/QA、权限、环境、测试数据或 scope 确认写入 work-item blocker；`pending-dependency` 的正式出口必须保持 `blocked`。v1 继续写入 `product/06-collaboration.md` 并按既有 Gate 规则处理。

PRD 图片、表格、白板、删除线或引用文档不可完整读取时，严格执行 [lark-doc-sync.md §8](./lark-doc-sync.md)。影响 scope 的 unresolved 项在 v2 阻断 coverage/verify，在 v1 阻断 G2。

## 4. 启动完成判定

- v2：`work-item.json` 已基于当前来源建立；需求、surface、coverage review、routing 无未解决占位；如为 V2，scope approval 有效。
- v1：目录与阶段准入分别以 [project-doc-structure.md](./project-doc-structure.md)、[workflow-gates.md](./workflow-gates.md) 为准。
- 项目最少输入仅为 `<PROJECT-ID>` 与可读取的 PRD 链接或本地 Markdown；其他缺项进入对应工作流的 blocker。

## 5. 小需求效率路径

小需求也必须使用同一来源绑定、需求覆盖、风险路由、验证和交付出口。当前没有经真实对照样本认证的“跳过 extraction”快速通道；不得通过手工复制 Lite 模板、旧版脚本或缩短描述来伪造 coverage、scope approval 或验证通过。

`lite-path-integration.mjs` 仅提供只读候选评估，结果不具备交付权限，也不改变标准流程。旧 `kickoff-v4.mjs` 只作兼容转发；`--force-lite` 与旧 `lite-path-executor-v4.mjs --exec` 均被禁用。

过往 Lite 实验记录属于历史材料，不是当前效率或准确率基线。只有采集到可比较的真实样本及实际模型 usage 后，才能发布节省结论；当前入口和流程仍以 §2 为准。
