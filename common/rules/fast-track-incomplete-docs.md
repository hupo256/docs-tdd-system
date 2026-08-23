# 文档未齐快速通道（G0→G4→停靠 G5 待对账）

> AI 主用：本文只定义「API 已存在待更新 + UI/UX 低保真 + Figma/API 文档后补」时的**阶段编排**。字段对账、Figma 降级、Mock 生命周期、阻塞登记等正文各归对应 Source，本文只写何时消费、串成什么次序、证据落哪里，不复制阈值/字段表/命令清单。

## 0. 触发（何时走这条通道）

**常态**：拿到 PRD 即开工，但 API 文档、Figma 尚未齐；相对好的情况是 API 已存在只需改字段/逻辑，UI/UX 要求不高，用 PRD 截图/原型 + 描述即可先写页面。

**前置必须可读**：PRD 正文、验收标准、截图（不满足按 [new-project-kickoff.md §3](./new-project-kickoff.md) 与 [lark-doc-sync.md §8](./lark-doc-sync.md) 处理，不进本通道）。

**缺料按影响面分级，不写笼统「资料不全」**（API / Figma 分别登记）：

| 缺失影响面 | 处置 |
|---|---|
| 只影响字段名 / 视觉细节 | 允许继续快速通道 |
| 影响权限 / 金额精度 / 状态机 / 路由 / 核心交互 | **阻断 G2**，走常规节奏，不进本通道 |

**不适用**：全新接口且无任何契约线索；UI/UX 必须成品级或纯视觉验收硬需求；scope 未经 G2 人工确认。

## 1. 状态模型（本通道的落点）

停靠 G5 = **不伪造 G5 PASS**，用仓库既有双真值表达「已进 G5 联调、前端已完成、等对账」：

| 面 | 值 | 载体 |
|----|----|------|
| 最新通过门禁（机器行） | **G4** | README 机器行 / frontmatter `stage` / `agent/gate-history.json`（脚本写） |
| 当前工作阶段（人工叙述行） | **G5** | README「当前阶段」行 |
| G5 处置结论 | **`frontend-complete-pending-reconcile`** + evidence + 待对账原因 | `agent/stage-status.json`（`VERIFY-G5-004` 校验） |

> 该双真值由 `set-project-stage.mjs` 同步四面，仓库**已实现**；本通道只是刻意使用，不新造能力。它比 `blocked` 更准确地表达「前端已交付」，但**同样不放行 G6**（对账完成改回 `completed` 才进 G6）。语义见 [workflow-gates.md](./workflow-gates.md) 执行规则与 [rule-ids-and-gates.md](./rule-ids-and-gates.md)。

## 2. 动作：G0→G4 逐 gate

各 gate 的准入准出与机器检查以 [workflow-gates.md](./workflow-gates.md) 为准，本节只加「文档未齐」时的编排要点。

- **G0 资料接收**：确认需求完整（≠ 资料完整）；PRD 正文/验收标准/截图可读；API、Figma 缺失**分别**登记到 [blocking-and-change-protocol.md](./blocking-and-change-protocol.md) 的 `agent/blockers.json`，按 §0 分级判断是否阻断 G2；功能清单按 [prd-feature-inventory.md](./prd-feature-inventory.md) 抽全量，Figma 未覆盖的跨页功能不得默认「不做」。
- **G1 建立「临时基线」**：
  - *API 基线*：在 `product/03-api-contract.md` 明确复用哪个现存 endpoint / schema / 真实响应，标注哪些字段稳定、哪些预计变化；**禁凭空增业务字段**（对账口径见 [api-and-mapper.md](./api-and-mapper.md) 与 [architecture-and-state.md §8.1](./architecture-and-state.md)）。
  - *UI/UX 基线*：`product/07-figma-spec.md` 不假装有 Figma，来源明确写「PRD 截图 / 原型 / 现有页面」，记录当前布局/组件/token/响应式依据；**Figma 视觉验收延期到 G6**。Figma 缺口按 [figma-mcp-read-workflow.md §3.1.1](./figma-mcp-read-workflow.md) 降级（类比 / `待确认` / preset 占位，记 `product/06-collaboration.md`），不静默猜、不整页停等。
- **G2 确认范围 + 变更边界**：负责人确认①本期做/不做/延期，②同意以临时基线编码（`DOC-G2-002/004` 硬闸，不可豁免绕过）。在 `product/06-collaboration.md` 写「变更边界表」定义后续变化在哪收敛：

  | 后续变化类型 | 收敛点 |
  |---|---|
  | 字段名 / nullable / 枚举 | G5 字段对账 |
  | 间距 / 颜色 / 图标 | G6 视觉收敛 |
  | 新流程 / 新权限 / 新页面 / 新业务状态 | **重开对应 Feature 的 G2** |

- **G3 真实代码链 + 可替换数据源**：Service/Hook/Schema/Mapper/组件全按生产结构实现，未就绪接口才由 MSW 网络层拦截，业务代码不出现 mock 分支（[architecture-and-state.md §8.4.1](./architecture-and-state.md)）。临时字段进 `agent/assumptions.json` + 代码 `// ASSUMED: ASM-xxx`；`product/03-api-contract.md` 接口表维护状态列 `mock中 / dev-ready / 已切真实 / blocked`（[§8.4.2](./architecture-and-state.md)）。**接口 100% 已存在复用、可直连 test 环境验证**（本通道的典型情况）时可选择完全不采用 MSW；但仍必须按 §8.4.1 第 5 点走 `agent/rule-waivers.json` 具名 + 限期豁免——「看起来都 ready」不能省略登记，owner 要为这个判断担责。
- **G4 完成「前端可验收版本」**：填满 `product/02-technical-design.md` 四表（复用盘点 / 单一事实源所有权 / 数据流分层 / PRD 路径核验）无占位（`DOC-G4-001..009`，见 [architecture-and-state.md §2/§4.0](./architecture-and-state.md)）；按 [coding-worktree.md](./coding-worktree.md) 备 `feature/<PROJECT-ID>` worktree；至少覆盖 normal/empty/error/unauthorized/edge 场景 + schema/mapper/逻辑/组件测试 + PRD 截图对应页面交互；跑 `docs-tdd changed` 与 `docs-tdd gate <PR> G4`；出一份前端证据报告（已完成项 / 假设项 / 待正式资料对账项），路径落 `evidence/`。

## 3. 证据：两条「待补」登记线 + 停靠态

1. **API 字段线**：`agent/assumptions.json` + 代码 `// ASSUMED:` + `03-api-contract.md` 状态列；缺失/未就绪 API 在 `blockers.json` 开条目 **`blocksGate: G5`**——真实联调本身完不成，它不挡 G3/G4，精准挡 G5 正式 PASS。台账本身也有出口条件：`api-ready/reconciling` 轴的 `open` 假设挡 G5（`DOC-ASSUM-001`）、`release` 轴挡 G8（`DOC-ASSUM-002`），快速通道不豁免这一条（要带风险交付走 `rule-waivers.json` 具名限期豁免）。
2. **视觉线**：Figma 降级占位 + `06-collaboration.md` + `blockers.json` 条目 **`blocksGate: G6`**（视觉验收在 G6）。允许低保真交付、无需精修时登记为 `type: change` 不填 `blocksGate`（仅可见性提示）。
3. **G5 停靠**：`agent/stage-status.json` 记 `frontend-complete-pending-reconcile` + 前端 evidence 路径 + 待对账原因，满足 `VERIFY-G5-004`。

`blockers.json` 的字段、生命周期与 gate 拦截规则以 [blocking-and-change-protocol.md](./blocking-and-change-protocol.md) 为准，本文不复制。

## 4. 失败处理 / 出口

- **`DOC-G5-004` 防呆**：仍待对账的任务**不得在 `04-frontend-tasks.md` 勾完成**（同行不能留 `ASSUMED` / 待对账）——保持未勾或拆行。
- **停在 G2 的情形**：缺人工确认，或缺料命中 §0 高影响面 → 停在 G2 等确认，不豁免绕过。
- **正式资料到达 = 增量收敛，不重跑 G0–G4**：同步 API/Figma 重算 fingerprint → 逐 endpoint 比对 URL/字段/类型/nullable/枚举/错误码并按 [architecture-and-state.md §8.1](./architecture-and-state.md) 对账、逐条销 `ASM-*`、逐接口关 MSW handler（[§8.4.2](./architecture-and-state.md)）→ Figma 只对受影响组件做视觉差异 → 超出 G2 变更边界的**只重开受影响 Feature 的 G2** → `blockers` 置 `resolved`（带 `resolution` + `resolvedAt`，禁静默删）→ `stage-status` 改 `completed` → 跑 G6/G7/G8。
- **确需带阻塞越 gate**：走 [rule-ids-and-gates.md §4](./rule-ids-and-gates.md) 的 `agent/rule-waivers.json` 具名 + 限期豁免，不删条目绕过。
