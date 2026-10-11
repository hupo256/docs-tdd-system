# v3.1–v3.3 真实项目实践日志（2026-09-12 ~ 2026-09-18）

> 状态：已归档（只读） · 结论有效性：部分有效 · 后继：[v3.5 Requirement-to-Commit 阶段](../2026-09-17-v3.5-requirement-to-commit/)（其 [iteration-plan-v3.5](../2026-09-17-v3.5-requirement-to-commit/iteration-plan-v3.5-2026-09-17.md) 附录 A 逐条承接本目录观察项）；现行入口见 [rule-router.md](../../../common/rules/rule-router.md)

## 一句话

v3.1（`workflowVersion: 2`）首次在三个真实前端需求上跑通，暴露出约 40 条框架缺陷，直接驱动了同日的 v3.2/v3.3 发版和 09-17 的 v3.5 迭代计划；其中 PR-02233 发生了「局部实现被误报为整批完成」的严重事故。

## 背景与目标

- v3.1 于 2026-09-11 正式定版（[CHANGELOG](../../../common/CHANGELOG.md) 09-11 条），此前没有真实项目从 kickoff 走到实现。
- 目标：用真实需求逐步记录卡点、摩擦和规则缺陷，作为迭代依据。日志由不同 agent 会话（Pi、Devin、其他 AI 会话）分别撰写，编号空间各自独立（O-、HB-、TR-、Q/MA-）。
- 日志放在仓库根 `practice-log/` 而非 `common/`，原因是当时 `rule-release.mjs` 的发布指纹遍历整棵 `common/`，任何新增 `.md` 都会让 L3 规则发布变 stale（O-4）。

## 做了什么

| 项目 | 类型 | 日期 | 记录 |
|---|---|---|---|
| PR-02233 安全验证校验交互优化 | 大型 V2 特性（21 条需求、27 张图） | 09-12 起 | O-1 ~ O-35 |
| hichat redirect_url 截断 | 已定位 bug（一行级） | 09-12 | HB-1 ~ HB-5 |
| TR-02386 登录/注册迁移到 web-next | v3.3 kickoff | 09-15 | TR-1 ~ TR-4 + 审查循环摩擦 |
| PR-02233 web-next 编码与人工验收 | 门禁反馈 + 验收记录 | 09-18 前后 | Q1 ~ Q4、MA-001 ~ MA-010 |

PR-02233 过程要点：

- 修了图片 intake 的两个 bug（O-6）：飞书 `file/<token>` 未鉴权下载把登录页 HTML 存成 `.png`；内嵌 `<img src=TOKEN>` 从不下载。改为鉴权 `lark-cli docs +media-download` 加 magic-byte 校验，27 张图全部变为真 PNG。
- 独立审查（coverage review）跑了约 10 轮仍未收敛，用户叫停；会话改写确定性自查脚本 `self-audit-02233.mjs`，几秒内查全同类机械缺陷（O-22、O-23）。
- 进入实现后发现 v2 缺中期检查（O-25）、全量 typecheck 存量噪声（O-26）、阶段性 commit 被交付守卫阻断（O-28，当时以 `--no-verify` 提交 checkpoint `9ee99d0fdb`）、API pending 被误当停工条件（O-29，补了 opt-in MSW）。
- 09-16 用户本地验收时发现登录页无法触发「切换验证方式」弹窗，此前「开发完成、进入人工验收」的汇报不成立，O-34 撤回、O-35 写事故分析。
- 09-18 前后完成切换弹窗，commit 又被 checkpoint 守卫和 `deliveryScope.policyPaths` 越界拦下（Q2 ~ Q4）；人工验收 MA-001 ~ MA-009 为视觉/交互细节修复，MA-010（R-008 账号改绑四页面）因后端 request contract 无法表达 PRD 组合而记为 blocked。

## 当时的结论与事后核实

| 当时的说法 | 事后核实 |
|---|---|
| O-6 图片 intake 已治本 | 成立：`classifyMediaUrl`、`sniffImageType` 仍在 [lark-prd-drift.mjs](../../../common/engine/agent-scripts/lib/lark-prd-drift.mjs)，[sync-lark-docs.mjs](../../../common/engine/agent-scripts/sync-lark-docs.mjs) 落盘前校验。 |
| O-19「三轮审查从无误报，全部是抽取缺陷」 | 同一日志 O-21 自行修正：第 5 轮出现被证实的假阳性（R-007 的 collectionSemantics 实际存在）。 |
| O-22 发现构成「约 40% 生成脚本 bug / 约 50% PRD 核对不足 / 约 10% 审查幻觉」 | 会话内粗估，基数不一致（40% 引用的是第 2 轮 12/15 条），未经独立统计，不应作为数据引用。 |
| O-23 自查器前置后「审查发现会从两位数降到个位数、1-2 轮收敛」 | 预测，未经实测。v3.2 落地了 `extract` 与 `extractionAudit` 前置检查；09-13 将自动审查封顶为两轮（CHANGELOG 09-12 v3.2、09-13 条），没有前后对比数据。 |
| O-34「auth-verification 批次完成，已取得双视口回归」 | 已撤回：提交 `ff7020c0b6` 树中不存在 `SwitchVerifyMethodDialog`，见 O-35。 |
| O-17 browser adapter 可执行 | 成立但有边界：依赖本机 Playwright Chrome 扩展、个人 token 和在场的 Chrome 会话，属开发者本地证据，CI 无法重跑。 |
| O-11 飞书表格全部被归成 text unit | v3.2（commit `dae6a54`，09-12）已放宽飞书单连字符分隔行并识别 HTML 表；但 09-17 v3.5 计划附录 A.4 仍把 O-11 列为「未进 Phase，记为 backlog」，与代码不符。 |
| O-7 软链调用时 main-module 守卫失效 | 未修：`sync-lark-docs.mjs` 末尾仍是 ``import.meta.url === `file://${process.argv[1]}` ``，未做 realpath 归一。 |
| O-27 应加非 `zh-CN` locale 变更守卫 | 在 `common/engine/agent-scripts` 中未找到对应守卫；规则正文仍只在业务仓 `AGENTS.md`。 |
| PR-02233 作为 v3.3 真实 V2 pilot | CHANGELOG 09-12 v3.3 条记为 collecting、「未完成前不计数」；09-23 v3.5.0 stable 时 pilot 仍为 collecting。[PROJECTS.md](../../../PROJECTS.md) 当前显示 PR-02233 为 `V2 implementing`、未验证；TR-02386 为 `V2 enforced passed`。 |

## 沉淀下来、仍然有效的东西

以下按发版时间列出；10-10 起新需求改用 prd-to-commit，docs_tdd 引擎冻结，引擎类沉淀只对存量 v2 项目有效。

- 分支 taxonomy 与开工前置门（HB-4）：[git-branch-flow.md](../../../common/rules/git-branch-flow.md) §1.1 三前缀（`feature/`、`fix/`、lark-bot 专用 `hotfix/`）、§1.2 改业务代码前先确认不在环境分支。
- 图片 intake 鉴权下载与 magic-byte 校验（O-6）：见上表。
- Browser adapter（O-17）：[playwright-mcp-adapter.mjs](../../../common/engine/agent-scripts/lib/playwright-mcp-adapter.mjs)，用法写入 [browser-e2e-mcp.md](../../../common/rules/browser-e2e-mcp.md) 与 [vnext/README.md](../../../common/vnext/README.md)。
- v3.2（09-12）：[vnext-extract.mjs](../../../common/engine/agent-scripts/vnext-extract.mjs) 的确定性抽取审计前置于模型审查（O-20、O-23）；表格逐行 unit（O-11，[vnext-source-units.mjs](../../../common/engine/agent-scripts/lib/vnext-source-units.mjs)）；`source-sync`（O-8）。
- v3.3（09-12）：`kickoff --kind bugfix`（HB-1）；[vnext-dev-check.mjs](../../../common/engine/agent-scripts/vnext-dev-check.mjs) 与 baseline-aware typecheck（O-25、O-26）；checkpoint commit 与 delivery commit 分离（O-28）；审查 timeout 随 payload 调整（O-15）。
- v3.5（09-19）：surface-to-code 与 consumer wiring 对账 [vnext-reconcile.mjs](../../../common/engine/agent-scripts/lib/vnext-reconcile.mjs)、完成用语与交付真值 [vnext-delivery-truth.mjs](../../../common/engine/agent-scripts/lib/vnext-delivery-truth.mjs)（O-31、O-35）。
- policyPaths 前缀匹配语义（Q4）：[vnext-delivery-scope.mjs](../../../common/engine/agent-scripts/lib/vnext-delivery-scope.mjs)。
- 方法论延续到 prd-to-commit（仓外 `~/.ai-rules/skills/prd-to-commit/SKILL.md`）：需求清单「原句→落点」逐行填真实文件（对应 O-35 surface 对账）；冷读放在改动文件检查之后、最多 2 轮（对应 O-22）；同因搜索（对应 Q4 漏列 `CodeVerifyDialog` 等兄弟模块）；接口未就绪时照写代码、占位加 TODO（对应 O-29）。

## 教训

1. 独立审查是最后一道补救网，不是主质检手段。可枚举的机械缺陷应先用确定性脚本查全，审查必须有轮次上限（O-22、O-23）。
2. 审查模型也会出事实性错误，「追到 0 条发现」不是可靠终点（O-21）。
3. 流程状态（`implement-current-scope`）不等于交付状态；目标应用 pivot 后完成度必须归零；共享组件存在不等于业务页已接入（O-35）。
4. 证据命令「存在且退出 0」不证明 claim 充分，一条薄断言不能覆盖大量 surface（O-31、O-35）。
5. API pending 只阻塞依赖它的 requirement，不能拿来解释整个批次未完成（O-29、O-35）。
6. 已加载的规则仍可能不被执行（O-27 改了 9 个非中文 locale）；靠复制规则文本解决不了，需要机器拦截。
7. 交互式 agent 动手前先探测现状：当前分支（HB-4）、目标文件是否已存在（HB-5）。
8. 批量改结构化生成脚本时要逐条校验，正则失配会静默错位（O-20）。
9. 守卫的错误文案要区分「从未建立」与「已过期」，并给出 WIP 保存的官方出口，否则用户只能在 `--no-verify` 与无法保存之间二选一（Q2）。
10. `workflowVersion: 2`、产品版本 v3.x、风险等级 V0–V2 三套「版本」同形不同义，持续造成误解（O-5、Q1）。

## 文件清单

| 文件 | 类型 | 内容 |
|---|---|---|
| [practice-log-v3.1-2026-09-12.md](./practice-log-v3.1-2026-09-12.md) | 实践日志 | PR-02233 观察台账 O-1 ~ O-35；文件名日期为开工日，条目延续到 09-16（O-34/O-35），最后修改提交于 09-19 |
| [practice-log-v3.1-hichat-bugfix-2026-09-12.md](./practice-log-v3.1-hichat-bugfix-2026-09-12.md) | 实践日志 | hichat bug 根因（`skipTrailingSlashRedirect` 下尾斜杠空段）、HB-1 ~ HB-5、分支命名三处不一致的消歧决策 |
| [practice-log-v3.3-tr-02386-2026-09-15.md](./practice-log-v3.3-tr-02386-2026-09-15.md) | 实践日志 | TR-02386 kickoff 误判为 v1、本地 PRD 路径约束、bounded-batch 无延期项不自洽、审查循环排序陷阱 |
| [pr-02233-system-feedback-2026-09-18.md](./pr-02233-system-feedback-2026-09-18.md) | 门禁反馈 + 验收记录 | Q1 ~ Q4（版本语义、fail-closed 守卫、policyPaths 低估）、R-004 改按 Figma 排序的决策、MA-001 ~ MA-010 |
| [lark-lightweight-handoff-2026-09-11.md](./lark-lightweight-handoff-2026-09-11.md) | 交接快照 | v3.1 时期 lark-bot 轻量闭环强化（提交前 HEAD + diffHash 二次校验等）的跨会话交接；原为 `common/lark-bot/docs/handoff-lark-lightweight-v31.md`，2026-10-11 移入 |

### 已合并删除的原文件

无。
