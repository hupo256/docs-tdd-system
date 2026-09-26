# docs_tdd 优化计划交接：真实需求 Pilot

> 交接日期：2026-09-25
> 当前分支：`main`
> 当前提交：`36181a6 fix(docs-tdd): isolate incremental demand execution`
> 工作区状态：clean
> 总体状态：批次 D `in-progress`

## 1. 当前目标

用新的真实需求验证 docs_tdd 是否能够做到：

- 用户只给需求，系统自动完成安全分支/worktree、来源理解、实现、验证、修复和本地提交。
- 不静默漏需求、不假完成、不越界修改、不未经授权 push。
- 小需求减少无关规则、历史资料、命令和 token 消耗。
- 效率目标只用于度量和收敛流程，不得因超时停止尚未完成的需求。

## 2. 已完成

| 批次 | 状态 | 结果 |
|---|---|---|
| A | completed | 清理旧入口、假通过、重复规则和历史旁路 |
| B | `synthetic-tested` | 来源处置、覆盖契约及正反例通过 |
| C | `e2e-tested` | 公开单输入命令已跑到 enforced PASS 和 scoped local commit |
| D 基础设施 | `e2e-tested` | Micro 路径、trace、定向检查和 no-push 契约通过 |

最新一轮修复已经完成：

- 同项目编号收到不同 PRD/source 时，自动创建隔离 change-set。
- change-set 独立绑定文档、分支、worktree 和 `baseRef`。
- 默认基线通常为 `origin/online`；可用 `--base-ref <ref>` 覆盖并持久化。
- `--change` 只用于显式命名或恢复，不要求正常需求手动提供。
- `run --dry-run` 不创建文件、不调用 Agent、不写 receipt。
- 普通 login 样式不再误判为认证 high-risk。
- 一张已分类的辅助截图可进入 V0/Micro。
- Micro 时间目标是观测指标；超目标记录 `target-exceeded`，但继续完成需求。
- 重复失败保留真实失败类型；不收敛时为 `failed-safety-check`。

相关 self-test、公开命令 E2E、103 个核心脚本 self-test、339 个 Markdown 链接和 `git diff --check` 已通过。

## 3. PR-02233 结论

PR-02233 增量需求暴露了“当前增量错绑历史 PRD”的系统问题，但该问题已经修复。

- PR-02233 保持 `blocked-system`。
- 不追认它为 V0/V1/V2 合格 Pilot 样本。
- 不修复、不回放、不重建该历史项目。
- 下一步必须使用一条全新的真实需求验证修复效果。

## 4. 尚未完成

### 批次 D：真实需求 Pilot

1. 用下一条新的真实需求完整跑通：
   `run -> extract -> review -> implement -> evidence -> verify -> local commit`。
2. 至少取得 1 个真实 V0、1 个真实 V1、1 个真实 V2 合格样本。
3. 累计至少 10 个复杂度可比的 Micro 样本。
4. 每个样本记录：
   - source unit、requirement、surface 和 coverage；
   - enforced verify、代码检查和提测结果；
   - reviewer 轮次、用户中断、命令数、repair 次数；
   - 遗漏、假完成、越界写入和 push 尝试；
   - 总历时；
   - 宿主提供的真实 token usage，拿不到则记 `null`，不得估算。
5. Pilot 暴露通用失败模式时，只补最小 synthetic regression，不回头维护历史项目。

批次 D 发布门槛：

- silent omission = 0
- false completion = 0
- out-of-scope writes = 0
- unauthorized push = 0
- V0/V1/V2 均完成真实需求、代码验证和提测观察
- 至少 10 个可比 Micro 样本的 p50 总历时改善至少 30%
- Micro p90 恶化不超过 10%

达到门槛后只能标记为 `eligible-for-owner-cutover-review`。

### 批次 E：owner cutover

- 当前未开始。
- 只有批次 D 证据完整且 owner 明确批准后才能进入。
- 未获批准前不得宣称新路径 production-ready 或已成为默认路径。

### 非阻断增强

- 继续观察公开帮助语义、content fingerprint 确定性和重复运行幂等性。
- 可选增加公开命令下 repair 二次失败预算及中断恢复 E2E。

## 5. 明确不做

- 不再建设 PR-01947、PR-02265、PR-02306、PR-01930 的历史 replay/golden。
- 不把 PR-02306 或其他历史项目作为发布前置。
- 不为凑样本人工指定、降低或提高 V0/V1/V2 和 Micro/Lite/Standard。
- 不估算 token。
- 未经用户当前请求明确授权，不修改业务仓、不提交业务代码、不 push。

## 6. 既有债

以下两项不属于当前优化计划，不阻塞真实需求 Pilot：

1. L2 golden：`47 != 49`
2. `PROJECTS.md` generated-content drift

不要把它们混入下一条真实需求。

## 7. 接续读取顺序

新 chat 先读取：

1. `plan/handoff-real-demand-pilot-2026-09-25.md`
2. `plan/optimization-execution-plan-2026-09-24.md`
3. `plan/real-demand-pilot-2026-09-25.md`
4. `common/rules/rule-router.md`

收到下一条真实需求后，直接启动新的真实 Pilot；不要先回放 PR-02233 或其他历史 PR。

## 8. Git 状态

- 本地 `main` 相对 `origin/main` ahead 7。
- 最新提交为 `36181a6`。
- 当前工作区在交接文档创建前为 clean。
- 本轮交接文档尚未提交。
- 从未执行 push。
