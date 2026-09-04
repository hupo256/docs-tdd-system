# 文档未齐快速通道（G0→G4→按接口就绪度分两个出口）

> AI 主用：本文只定义「API 已存在待更新 + UI/UX 低保真 + Figma/API 文档后补」时的**阶段编排**。字段对账、Figma 降级、Mock 生命周期、阻塞登记等正文各归对应 Source，本文只写何时消费、串成什么次序、证据落哪里，不复制阈值/字段表/命令清单。

## 0. 触发（何时走这条通道）

**常态**：拿到 PRD 即开工，但 API 文档、Figma 尚未齐；相对好的情况是 API 已存在只需改字段/逻辑，UI/UX 要求不高，用 PRD 截图/原型 + 描述即可先写页面。

**前置必须可读**：PRD 正文、验收标准、截图（不满足按 [new-project-kickoff.md §3](./new-project-kickoff.md) 与 [lark-doc-sync.md §8](./lark-doc-sync.md) 处理，不进本通道）。

**判断的不是主题名称，而是语义确定性、可逆性和影响面**。Mock 可以替代暂不可用的接口/环境，不能替代尚未作出的业务决策：

| 情形 | 例子 | 处置 |
|---|---|---|
| 业务语义已确定，只缺接口/环境/正式素材 | 权限矩阵已定但接口未部署；精度公式已定但无真实响应 | 允许快速通道；按正式结构实现，用 MSW/占位数据解锁验证 |
| 语义未定，但仅局部、可逆且能安全降级 | 展示字段名、间距、非关键图标；缺失时可显 `--` 或不渲染 | 允许快速通道；登记 `undecided`、安全降级和销账 gate |
| 高影响语义有负责人批准的临时契约 | 暂定权限默认拒绝；暂定精度公式并禁止真实提交 | 允许快速通道；登记 `provisional` 临时契约、owner、证据和失效 gate |
| 高影响语义仍未决定 | 权限矩阵、金额单位/舍入、状态转换、正式路由、核心交互副作用未知 | **阻断 G2**；Mock 不能替产品/安全/资金规则作决定 |

高影响类别包括权限、金额精度、状态机、路由和核心交互，但“涉及这些类别”不等于阻断；只有其业务语义仍为 `undecided`，或缺口跨模块/不可逆时才阻断。对应机器真值为可选的 `agent/fast-track.json`（模板：[fast-track-template.json](../../templates/fast-track-template.json)）；文件存在即表示项目显式选择快速通道，由 `DOC-FAST-001..005` 校验。

**不适用**：全新接口且无任何契约线索；UI/UX 必须成品级或纯视觉验收硬需求；scope 未经 G2 人工确认。

## 0.1 两个出口（进通道时就判定，别走到 G5 才发现）

快速通道**不是**只有「停靠」一个终点。终点由接口就绪度决定，判据只有一条：**本期接口的真实响应现在能不能拿到**。

| 出口 | 判据 | 终点 | G5 字段对账 |
|---|---|---|---|
| `reuse-api` | 本期接口 100% 已存在、可直连 test 环境取到真实响应 | **可直达 G8**（G5→G6→G7→G8 正常跑完，无停靠） | 在 G5 **当场**做完：逐 endpoint 比对真实响应，`stage-status.G5` 记 `completed` |
| `pending-api` | 存在未就绪接口（新接口未上、字段未定、只有文档没有环境） | **G6-partial 后停靠**，等字段到位 | 做不到：G5 记 `frontend-complete-pending-reconcile`，字段到位后重跑完整 G6 再走 G7/G8 |

`reuse-api` 是本通道的典型情况（PRD 有了、Figma/API 文档没有，但接口本来就在），它**没有理由停在 G5**：对账要的真实响应当下就能取到，拖到「文档补齐」再对账等于把可完成的工作人为悬空。拿不到真实响应的那一刻它就是 `pending-api`，改记停靠态，不许含糊。

出口结论同时写入 `agent/fast-track.json` 的 `route`、`confirmedBy`、`confirmedAt`，并在 `product/06-collaboration.md` 变更边界表旁保留人读摘要，G2 一并确认——「为什么这个项目能直达 G8」在交付时可复核。AI 客户端或占位符不能代签。

## 1. 状态模型（`pending-api` 出口专用）

> `reuse-api` 出口不用本节：它在 G5 当场把对账做完、`stage-status.G5` 记 `completed`，按 [workflow-gates.md](./workflow-gates.md) 正常推进到 G8，不进停靠态。

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
- **G2 确认范围 + 变更边界**：负责人确认①本期做/不做/延期，②同意以临时基线编码（`DOC-G2-002/004` 硬闸，不可豁免绕过），③签认 `agent/fast-track.json` 的出口和临时业务契约。在 `product/06-collaboration.md` 写「变更边界表」定义后续变化在哪收敛：

  | 后续变化类型 | 收敛点 |
  |---|---|
  | 字段名 / nullable / 枚举 | G5 字段对账 |
  | 间距 / 颜色 / 图标 | G6 视觉收敛 |
  | 新流程 / 新权限 / 新页面 / 新业务状态 | **重开对应 Feature 的 G2** |

  `fast-track.json.items` 对每个缺口记录：`semanticStatus`（`confirmed/provisional/undecided`）、`impact`（`local/cross-cutting/irreversible`）、`reconcileWith`（`api`=语义/临时契约已定、只差真实响应核对；`decision`=纯业务临时决策、不依赖接口）、临时契约、安全降级、owner、`resolveByGate` 和证据。权限/金额/状态机/路由/核心交互可以 Mock 的前提，是语义已确认，或负责人已批准可逆、默认安全的临时契约；仍未决定时 `DOC-FAST-003` 阻断 G2。`category=field` 指**UI 展示字段名/文案**（非 API 契约字段——后者的假设走 `agent/assumptions.json`，不在此重复登记）。

- **G3 真实代码链 + 可替换数据源**：Service/Hook/Schema/Mapper/组件全按生产结构实现，未就绪接口才由 MSW 网络层拦截，业务代码不出现 mock 分支（[architecture-and-state.md §8.4.1](./architecture-and-state.md)）。临时字段进 `agent/assumptions.json` + 代码 `// ASSUMED: ASM-xxx`；非 API 的临时业务决策进 `agent/fast-track.json`。`product/03-api-contract.md` 接口表维护状态列 `mock中 / dev-ready / 已切真实 / blocked`（[§8.4.2](./architecture-and-state.md)）。**接口 100% 已存在复用、可直连 test 环境验证**（本通道的典型情况）时可选择完全不采用 MSW；但仍必须按 §8.4.1 第 5 点走 `agent/rule-waivers.json` 具名 + 限期豁免——「看起来都 ready」不能省略登记，owner 要为这个判断担责。

  临时值只允许默认安全、可删除的行为：权限未知时拒绝操作；金额规则未知时显示 `--` 并禁用提交；未知状态进入显式 unknown 分支且不开放动作；正式路由未知时只用 dev-only 占位入口；核心流程未知时只做无副作用原型。禁止用“默认允许”“默认成功”“随便取 8 位精度”等值伪装业务已确定。
- **G4 完成「前端可验收版本」**：填满 `product/02-technical-design.md` 四表（复用盘点 / 单一事实源所有权 / 数据流分层 / PRD 路径核验）无占位（`DOC-G4-001..009`，见 [architecture-and-state.md §2/§4.0](./architecture-and-state.md)）；按 [coding-worktree.md](./coding-worktree.md) 备 `feature/<PROJECT-ID>` worktree；至少覆盖 normal/empty/error/unauthorized/edge 场景 + schema/mapper/逻辑/组件测试 + PRD 截图对应页面交互；跑 `docs-tdd changed` 与 `docs-tdd gate <PR> G4`；出一份前端证据报告（已完成项 / 假设项 / 待正式资料对账项），路径落 `evidence/`。

## 3. 证据：两条「待补」登记线 + 停靠态

1. **API 字段线**：`agent/assumptions.json` + 代码 `// ASSUMED:` + `03-api-contract.md` 状态列；缺失/未就绪 API 在 `blockers.json` 开条目 **`blocksGate: G5`**——真实联调本身完不成，它不挡 G3/G4，精准挡 G5 正式 PASS。台账本身也有出口条件：`api-ready/reconciling` 轴的 `open` 假设挡 G5（`DOC-ASSUM-001`）、`release` 轴挡 G8（`DOC-ASSUM-002`），快速通道不豁免这一条（要带风险交付走 `rule-waivers.json` 具名限期豁免）。
2. **视觉线**：Figma 降级占位 + `06-collaboration.md` + `blockers.json` 条目 **`blocksGate: G6`**（视觉验收在 G6）。允许低保真交付、无需精修时登记为 `type: change` 不填 `blocksGate`（仅可见性提示）。
3. **临时业务决策线**：`agent/fast-track.json`。`undecided` 高影响项挡 G2；`provisional` 必须有临时契约和安全降级；所有 `open` 项到达 `resolveByGate` 时由 `DOC-FAST-005` 阻断，禁止靠假默认穿过交付。**G6-partial 例外**：`reconcileWith: api` 的到期项（销账依赖真实响应）在 `--partial` 下记为待对账 warn、不阻断部分验收；`reconcileWith: decision` 的纯业务欠账即使在 partial 下也硬阻断（partial 不是逃逸口）。`pending-api` 路由下这类 `api` 项的 `resolveByGate` 可放宽到 `G6`（对账真实发生在完整 G6 重跑），`reuse-api` 与 `decision` 项仍按类别最迟 `G5`。
4. **G5 停靠**：`agent/stage-status.json` 记 `frontend-complete-pending-reconcile` + 前端 evidence 路径 + 待对账原因，满足 `VERIFY-G5-004`。

`blockers.json` 的字段、生命周期与 gate 拦截规则以 [blocking-and-change-protocol.md](./blocking-and-change-protocol.md) 为准，本文不复制。

## 4. 失败处理 / 出口终点

- **`DOC-G5-004` 防呆**：仍待对账的任务**不得在 `04-frontend-tasks.md` 勾完成**（同行不能留 `ASSUMED` / 待对账）——保持未勾或拆行。
- **停在 G2 的情形**：缺人工确认；或业务语义仍为 `undecided`，且属于权限、金额精度、状态机、路由、核心交互等高风险类别；或未决缺口跨模块/不可逆 → 停在 G2 等确认，不豁免绕过。仅仅“涉及高风险类别”不构成阻断：已有真实来源的 `confirmed` 项，以及负责人签认了默认安全、可逆临时契约的 `provisional` 项，可以继续推进。
- **临时契约到期**：`fast-track.json` 的 `open` 项到达 `resolveByGate` 必须改为 `resolved` 并填写 `resolution`；确需带风险推进只能对 `DOC-FAST-005` 做具名、限期豁免，不能删除台账或把 `undecided` 伪写成 `confirmed`。
- **`reuse-api` 终点 = G8**：G5 当场逐 endpoint 对账真实响应并销 `ASM-*` → `stage-status.G5 = completed` → `docs-tdd gate <PR> G6/G7/G8` 正常跑完。视觉线若仍低保真，按 §3.2 登记为 `type: change`（不填 `blocksGate`），不阻断交付。
- **`pending-api` 终点 = G6-partial 停靠**：前端做完、静态与实现质量已可判定，但依赖真实字段的验收做不了。此时**不要空等**，跑
  `node …/docs-tdd.mjs gate <PR> G6 --partial`（等价 `run-project-gate <PR> G6 --partial`）：code-review、静态规则与所选验证档位要求的机器检查照跑照判，只有 `contract`/`browser` 方法的验收项记为待对账（`DOC-AC-007` + `VERIFY-G6-005` 逐条点名欠账）。结论以 **`G6-partial`** 入 `gate-history.json`，前置改判 G4 PASS（`VERIFY-STAGE-004`，**不可豁免**）。
  它**不是** G6 PASS：`hasPassedGate('G6')` 恒为 false → G7 天然被挡；README 的「最新通过门禁」不推进。作用是让停靠期的真实工作量拿到机器背书，而不是让项目在 G5 变成一团无证据的黑箱。
- **正式资料到达 = 增量收敛，不重跑 G0–G4**：同步 API/Figma 重算 fingerprint → 逐 endpoint 比对 URL/字段/类型/nullable/枚举/错误码并按 [architecture-and-state.md §8.1](./architecture-and-state.md) 对账、逐条销 `ASM-*`、逐接口关 MSW handler（[§8.4.2](./architecture-and-state.md)）→ Figma 只对受影响组件做视觉差异 → 超出 G2 变更边界的**只重开受影响 Feature 的 G2** → `blockers` 置 `resolved`（带 `resolution` + `resolvedAt`，禁静默删）→ `stage-status` 改 `completed` → **重跑完整 G6**（不带 `--partial`，此时才产生 G7 前置）→ G7 → G8。
- **确需带阻塞越 gate**：走 [rule-ids-and-gates.md §4](./rule-ids-and-gates.md) 的 `agent/rule-waivers.json` 具名 + 限期豁免，不删条目绕过。
