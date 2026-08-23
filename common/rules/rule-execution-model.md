# 规则执行保障模型

> 本文只定义规则如何被发现、执行、举证和阻断，不复制 L1/L2/L3 的规则正文。规则 ID、严重度和机器检查项仍以 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 为唯一真值源。

## 1. 落实标准

一条规则写进 Markdown 不等于已经落实。规则进入正式使用前必须形成以下执行契约：

| 字段 | 必须回答的问题 |
|------|----------------|
| Trigger | 哪个阶段、场景、文件或风险变化会触发规则？ |
| Source | 权威正文位于 L1、L2 还是 L3？是否只有一个维护入口？ |
| Loader | Agent 如何确定性加载：常驻入口、skill、glob 还是 context pack？ |
| Executor | 由格式化器、类型系统、测试、静态扫描、阶段 gate、Review 还是人工验收执行？ |
| Evidence | 通过或失败记录在哪里，能否关联命令、文件、Git/ruleset fingerprint 和责任人？ |
| Failure | 命中后是提示、诊断、阻断还是限时豁免？由谁修复和重跑？ |

缺少 Trigger/Loader 的规则会被漏用；缺少 Executor/Evidence 的规则只能算建议；缺少 Failure 的规则无法形成门禁。新增 L3 硬规则必须给 Rule ID，并按“触发 → 动作 → 证据 → 失败处理”写清执行契约。

规则载体还必须标记 `Visibility`：`personal-local` 或 `team-tracked`。个人规则默认 `personal-local`，只能写用户目录或经 `.git/info/exclude` 排除的 `docs_tdd`；任何 tracked 仓库文件都属于 `team-tracked`，没有用户明确批准不得写入规则、hook 或 gate。

## 2. 当前执行链

| 时点 | 执行动作 | 落实机制 |
|------|----------|----------|
| 会话启动/恢复 | Codex、Claude Code、Cursor 的 adapter 先读 `rule-router.md`，再执行 `docs-tdd context <PROJECT-ID> <SCENARIO>` | 入口先验证 L3 与 effective 两层发布指纹，再由 `rule-index.json` 按场景生成 context pack；编码场景须先过 G2，并写带客户端、三层 fingerprint、G2 输入与 HEAD 的 24 小时 `rule-session.json` v2；编辑中的未发布规则或其他客户端的旧会话不能被消费 |
| Lark 无人值守执行 | Lark-Codex / Lark-Claude 在每次启动 AI 前检查发布链，再按任务语义抽取规则章节 | **常驻必需**规则文件或章节缺失以 `VERIFY-RULE-004` 阻断（缺了等于裸跑）；L3/effective stale 与辅助章节缺失只记 warning 并带已发布规则继续（d533eb4：消费仓分支切换会让 stale 成为常态，fail-closed 会让所有修复任务全红），warning 浮现到结果卡、审计与 `/lark/health`；上下文仍绑定两层发布指纹 |
| 编码前 | 按变更类型加载 L1 全局规则/skill、L2 `.cursor/rules` 和 routed L3 专题 | G2/G4 文档、复用与所有权盘点把方案约束前置；不能只在 Review 时补读 |
| 编辑后 | 有 PostToolUse 时按文件调度；无 hook 时执行 `docs-tdd changed <PROJECT-ID>` | 先校验编码 rule session，再由 `verify-code-rules` 扫本次新增/修改内容；这是快速反馈层，不代替阶段 gate |
| 阶段出口 | 执行 `docs-tdd gate <PROJECT-ID> <Gx>`，G5+ 聚合代码扫描 | `error` 退出码阻断；G6/G8 用 `--write` 生成机器结果和 evidence，规则或工作树变化后旧证据失效 |
| 判断型验收 | G6 `/code-review` + Browser/Playwright + 必要人工视觉/语义确认 | 处理静态规则无法可靠判断的复用、架构、业务语义和视觉手感；findings 必须逐项已修、豁免或阻塞 |
| 规则维护 | 更新权威正文、适配器、场景路由、Rule ID/gate、自测和 CHANGELOG | 先发布 L3，再执行 `effective-rules.mjs --write` 发布 L1+direct adapter+Lark runtime adapter+L2+L3 组合指纹；五个入口只消费两层都 fresh 的版本 |

PostToolUse 是体验优化，不是最终信任边界。当前 Agent 若 `docs-tdd capability` 显示没有自动 hook，必须显式执行 `changed`；无论是否有 hook，阶段出口仍以 `run-project-gate --write` 的结果为准。`docs_tdd` 为 local-only 时，仓库 Husky/CI 也不能被描述为已提供这层保障。

## 3. 执行强度

规则按可判定性选择最强但可信的执行器，不把脆弱正则包装成全面保证：

| 等级 | 适用规则 | 保障方式 |
|------|----------|----------|
| Mechanical | 格式、类型、明确禁用语法、文件/字段存在性 | Biome、TypeScript、schema、测试或静态 gate；高置信规则可直接 `error` |
| Structural | 分层、依赖方向、重复写入口、Mock 注册链、范围越界 | AST/依赖图/manifest/定向扫描；无法完整机器判断时采用“机器候选 + G6 Review” |
| Judgment | PRD 语义、抽象是否合理、视觉手感、业务规则正确性 | Review/Browser/人工验收；必须使用结构化 checklist 和逐项结论，不能只写“已检查” |

严重度只允许三种执行语义：`diagnostic` 只收集数据，`warn` 必须在交付摘要可见，`error` 阻断 gate。warn-first 规则按 [rule-ids-and-gates.md](./rule-ids-and-gates.md) 的真实 PR 零误报台账晋级，长期合法例外不得伪装成待晋级 WARN。

## 4. 防止规则失效

1. **单一维护源**：同一规则只在一层维护正文；其他载体只保存触发器、指针或项目差异。脚本中的 Rule ID 必须回链台账，不再复制一份规则描述清单。
2. **规则即测试**：每个机器规则至少有一个应命中、一个不应命中的自测；修复误报时先加入回归样例。无测试的正则不得直接从 warn 提升 error。
3. **证据绑定状态**：机器证据至少绑定 ruleset、L3 发布指纹、effective rules 指纹、Git HEAD/base、dirty hash 和执行时间；代码或规则变化后必须重跑，不能复用旧 PASS。
4. **失败默认可见**：脚本失败、未运行、输出 `0 files`、环境阻塞和跳过都不能写 PASS。跳过必须记录原因；G6-G8 跳过代码规则时原因进入 gate JSON/evidence。
5. **豁免有生命周期**：豁免必须有 ruleId、reason、owner、expiresAt；过期或非法豁免不生效。高风险事实规则可设 non-waivable。
6. **只拦本次新增债**：默认检查 changed files/added lines，存量问题单独登记 known debt；全量扫描只用于生产 mock 泄漏、密钥等少量上线风险。
7. **定期删规则**：重复、失去触发场景、长期零命中或已被类型系统/框架替代的规则应合并或退役，避免 context 噪声降低真正硬规则的执行率。
8. **不静默扩大影响面**：规则从 `personal-local` 提升为 `team-tracked` 必须单独列出目标文件、团队收益、误报数据、回退方式并获得明确批准；不得把个人 gate 顺手塞进业务提交。

## 5. 规则发布与消费

规则源只有两种状态：编辑态和已发布态。维护者优先执行 `docs-tdd release <PROJECT-ID> --scenario <SCENARIO>`：依次 check/golden、发布 L3、发布 effective、doctor、完整 golden 和 context smoke，任一步失败恢复两份旧 manifest。底层仍分别由 `rule-release.mjs --write` 与 `effective-rules.mjs --write` 生成清单；effective 发布会直接验证当前 L3 内容 fresh、Cursor adapter 与生成器逐字一致、五入口全集与 source matrix 一致、Lark runtime adapter 已纳入 fingerprint，且 L2 无未解决冲突。个人覆盖只能来自 gitignored 的 config，必须声明 winner/loser 并进入 adapter、context 与 effective fingerprint；未登记冲突仍阻断。

`docs-tdd context/changed/gate` 与 `run-project-gate.mjs` 直达入口在执行前校验两层 freshness。任一清单缺失、损坏或输入漂移时退出 1；`check`、`capability`、`doctor` 仍可运行。context pack、新 gate evidence 与 Lark task audit 同时携带 L3 和 effective 指纹，从“声称读过某版本”升级为“能证明五个入口消费了哪组实际内容”。

## 6. 新规则准入与复盘

新增规则按以下顺序落地：

1. 用真实缺陷说明要防止的失败模式，并按 `rule-inheritance.md` 选择唯一权威层级。
2. 先定义 Trigger、适用边界、反例和误报成本，再选择执行器；不是先写正则。
3. 能机器判断则分配 Rule ID、严重度和自测；不能机器判断则定义 Review checklist、证据格式与确认责任人。
4. 把规则接入 `rule-index.json` 的最小场景，不把全文塞回常驻路由。
5. 运行 `check-doc-budget` 和相关脚本自测，依次执行 `rule-release.mjs --write`、`effective-rules.mjs --write`；再跑 `doctor` 并选一个活跃项目验证 context、changed 和对应 gate。
6. 在 CHANGELOG 记录生效边界；新规则默认前向生效，除非是安全或数据正确性风险并明确要求追溯。

每月或累计 5 个真实项目后做一次规则健康检查：统计每条机器规则的触发次数、真命中、误报、豁免、平均修复时间和长期 WARN；无数据时不得凭感觉晋级。优先修复“规则未加载/未运行/证据陈旧”这类执行链缺陷，再增加新规则正文。
