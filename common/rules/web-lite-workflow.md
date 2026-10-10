# Web Lite 开发流程

> **已废弃（2026-10-10）**：新需求改用 skill `prd-to-commit`（`~/.ai-rules/skills/prd-to-commit/SKILL.md`）。本文仅供查阅，不要再按本文执行。

## 流程

`PRD → 最小 Task → worktree → coding（仅必要时 + MSW）→ 冷读 check → git add / commit`

### 1. PRD → Task

- 只交付 Web。PRD 中纯 App、后端、运营等非 Web 内容直接忽略；只有影响 Web 行为、接口契约或无法安全实现时才纳入说明/提问。
- 对用户指定的 PRD 做一次完整读取：正文、相关表格、图片和嵌入内容都要检查，提取全部 Web 需求与可见验收结果。用户提供的定稿按定稿处理。
- 同一来源/revision 不重复 fetch、同步或校验漂移。用户告知 PRD 已变更时，才读取新版本并更新 Task。
- Task 默认是对话中的短 checklist，不建项目骨架、JSON 台账、Feature Inventory、evidence 目录或实验记录。仅当需求跨会话/多页面且确有恢复需要时，才保存一个简短 `task.md`。
- Task 写：要实现的 Web 行为与验收点、明确排除项、相关页面/API readiness，以及 PRD 明确指定的 UI 文案原文。文案原文应包括适用的 hover/tooltip、标题、按钮、说明、placeholder、空/错/成功状态和确认提示，并保留对应章节、表格行或图片位置；不可把明确文案改写成“显示提示”或标成缺失。小需求不要求逐项测试映射、不要求额外人工签核。
- Task 完成前，在已读取的 PRD 内容上做一次提取核对：检查正文、每个相关表格行、图片/嵌入内容，以及 hover、悬浮、tooltip、提示、文案、显示、标题等交互/文案线索是否都进入 checklist。这是对本轮已获取内容的核对，不是重新 fetch 或读取新 revision。
- 只有 PRD 确实未指定具体字符串时，才在 Task 中注明“PRD 未指定文案”；这不等于 PRD 读取失败，也不是 API readiness blocker。不得自行编造 PRD 未给出的固定文案；仅在该缺口实质改变行为或产品含义时提问。
- 只有歧义会实质改变 Web 行为、数据正确性或授权/资金安全时才提问；合并成一次必要的问题。其他细节按现有产品模式实现并说明假设。
- PRD 首次读取失败或有相关内容无法读取：报告具体来源/章节和失败原因，停止依赖该内容的工作并请求补充。最多一次读取尝试；不循环重试，也不声称已完整理解。

### 2. Worktree

- Task 明确后、写业务代码前，检查当前仓库和工作区；不得覆盖或清理已有改动。
- 在独立 worktree 中使用 FameEX 既定分支：新需求 `feature/<PROJECT-ID>`，缺陷修复 `fix/<PROJECT-ID>`。基线按 `git-branch-flow.md`；不在环境分支或主工作区直接改业务代码。
- 临时 worktree 必须位于主仓 checkout 同级的 `~/github/` 下，例如主仓为 `~/github/fameex-web` 时放在 `~/github/PR-01234`；不得放在主仓内部或 `~/.codex/worktrees/`。
- 可复用同项目、同分支且状态已核实的 worktree；发现未识别改动、分支冲突或路径冲突就停止并报告，不强制覆盖。
- worktree 可用即开始编码。不把安装依赖、启动服务或访问页面设成与当前任务无关的前置门；仅在验证需要时执行项目 setup。

### 3. Coding 与 API / MSW

- 只读目标模块及命中的编码规则，改动限于本需求 Web 范围。
- 默认沿用现有真实请求与可用数据。API 未就绪、或就绪情况无法确认，只意味着待对账，不自动启用 MSW；旧 endpoint 已可用的能力与本需求新增能力分别判断，不把整个旧请求伪装成已就绪或全部 mock。
- 先检查现有数据、纯逻辑及一次性定向浏览器响应能否覆盖关键 UI 状态。只有缺少真实数据/接口、且为完成与反复验证关键 UI/UX 流程确需请求级模拟时，才对必要的新能力局部引入最小 MSW。旧业务类型走真实请求，真实服务错误不能伪装成成功；不为了 mock 实现完整后端、复杂列表合并或导出引擎。
- MSW 只拦截必要的网络请求，handler 与生产请求链隔离；不在组件、hook 或 service 中添加 mock 分支。用到时在编码摘要中用一句话说明它解锁的 UI 状态；未用到无需逐接口填写不用 MSW 的理由。
- 仅使用 PRD/API 已知契约。缺失契约字段不得伪装成真实 API 事实；用最小临时假设时明确标注，并只在该假设会改变页面行为或数据模型时询问。
- UI/UX 按需求完成，包括适用的 loading、empty、error、success 和交互状态。关键交互无法可靠实现或验证时明确阻塞，不将未运行的检查写为通过。API ready 后对账真实契约，清理本需求对应 handler；无 MSW 的待联调 API 同样须对账后才能提测。

### 4. 冷读 check 与提交

- 冷读只核对 Task checklist 与最终 diff/页面，不重新 fetch 或重新读取同一 PRD revision。逐项确认实现、Task 中记录的文案是否逐字匹配、明显遗漏、Web 范围和无关改动；若发现 Task 漏记，回到本轮已读取内容补齐，不把已明确写在 PRD 的文案报成缺失或要求用户重发。
- 能用浏览器快速确认的 UI 行为做定向浏览器检查。按改动选最小有价值的 lint、typecheck 或纯逻辑测试；稳定后集中运行一次。`.tsx` 组件不新增 render/unit tests；不因流程要求制造假测试或大型证据套件。
- 失败先判断是否为真实问题；对可定位的代码问题修复后定向复验一次。来源读取失败不重试；环境/外部依赖不可用时说明未验证项，不假报通过、不无限循环。
- 最后检查 `git diff` 与 `git status`，只暂存本需求文件，按仓库 hook 正常 `git commit`。不得夹带其他改动；未经当次明确授权不得 push。

## 存量兼容

- 已有 `workflowVersion: 1` 项目继续使用其 G0-G8 流程；已有 `workflowVersion: 2` 项目继续使用对应 work-item/verify 流程。
- 只对新需求使用本流程。不为新需求运行 `docs-tdd run/kickoff/verify`，也不把新需求写入旧 JSON 状态机。无需为了启用本流程安装 OpenSpec、spec-kit 或新的编排器。
