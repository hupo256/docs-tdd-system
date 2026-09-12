# 新项目一句话启动协议

> 本文只定义启动编排。docs_tdd v3.3 的第二代协议规则以 [../vnext/README.md](../vnext/README.md) 为准，项目兼容标识为 `workflowVersion: 2`；第一代专题只服务 `workflowVersion: 1` 存量项目或显式 `--legacy` 项目。章节号 §2 被外链引用，勿改编号。

## 1. 启动口令

```text
根据 apps/web/docs_tdd 下的文档，开始新的需求 PR-01234，PRD 文档是：https://...
```

可同时提供 Figma、API/YApi、QA、Lark 配置。只给项目号与 PRD 时也立即启动；缺料必须显式记录为 blocker，不静默猜测。

## 2. Agent 自动执行链路

1. 读 [rule-router.md](./rule-router.md)，禁止全读 `common/`。
2. 运行 `docs-tdd kickoff <PROJECT-ID> --prd <source> --title <title>`。默认创建 `workflowVersion: 2` 的 feature 最小项目、同步来源并初始化 `work-item.json`；已定位缺陷使用 `--kind bugfix`，其来源会绑定为 incident 且分支使用 `fix/<PROJECT-ID>`，但不会绕过风险路由、独立审查或验证；只有用户明确要求 v1 时才加 `--legacy`。
3. 同步失败时运行 `docs-tdd status/next/resume` 诊断和安全重试；不得用旧副本冒充最新来源。
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
