<!-- template-version: 1 -->
<!-- template-effective-since: 2026-08-03 -->

# 阻塞与变更协议

> AI 主用。给「阻塞」和「需求变更」一个机器可读单一源 `agent/blockers.json`，让 gate 能拦、交付摘要能派生、生命周期可追踪。规则 ID 与判定细节见 [rule-ids-and-gates.md §3.6](./rule-ids-and-gates.md)，语义纯函数在 `agent-scripts/lib/blockers.mjs`。

## 1. 为什么要有它

此前阻塞/变更只写在 `product/06-collaboration.md §7` 的自由格式表格里：

- 交付摘要（`render-delivery-summary.mjs`）只能 grep「待修复/未处理/待确认」字样——改口径就漏。
- gate 拦不住：一个「错误码待后端销账」的阻塞可以一路飘到 G8 而机器不知情。
- 需求中途变更（如把杠杆改成 1-20x 硬限制）没有相对 PRD 的机器可读 delta，reviewer 看不到偏移。

`agent/blockers.json` 把这两类事变成结构化登记，散文层退化为叙述补充而非真值源。

## 2. 何时登记

| 类型 | `type` | 什么时候记 |
|------|--------|-----------|
| 阻塞 | `blocker` | 缺资料/缺账号/缺环境/等后端接口或错误码/等设计确认，导致某阶段无法如实通过 |
| 变更 | `change` | 需求相对 PRD 发生偏移（范围增删、约束变化、口径调整），需在交付前收口 |

不确定算不算阻塞时：如果它会让你在某个 gate 前无法给出真实「完成」，就登记为 `blocker` 并填 `blocksGate`。

## 3. 字段与生命周期

一条登记的形状（完整字段见 `common/engine/schemas/blockers.schema.json`）：

```json
[
  {
    "id": "BLK-1",
    "type": "blocker",
    "gate": "G5",
    "blocksGate": "G6",
    "category": "backend",
    "summary": "交易员杠杆错误码待后端销账",
    "owner": "backend",
    "raisedAt": "2026-08-03",
    "status": "open",
    "resolution": "",
    "resolvedAt": "",
    "evidence": []
  }
]
```

- `id`：`BLK-<n>`（阻塞）/ `CHG-<n>`（变更），全文件唯一。
- `gate`：登记时所在阶段；`blocksGate`：必须在该阶段前解除，且 ≥ `gate`。`open` 的 `blocker` 必填 `blocksGate`，否则 gate 无从拦截；`change` 可不填（不填=仅可见性提示，不阻断）。
- **`open → resolved` 必须带非空 `resolution` + `resolvedAt`**，禁止把状态改回或直接删条目做「静默清零」。

## 4. gate 如何拦

`verify-project-gate.mjs` 每个 gate 都读 `blockers.json`，产出三条结论：

- `DOC-BLOCK-001`（error，不可豁免）：结构非法（字段缺失、id 重复、resolved 缺 resolution 等）。
- `DOC-BLOCK-002`（error，可豁免）：有 `open` 且 `blocksGate ≤ 当前 gate` 的项没解除 → 阻断本 gate。
- `DOC-BLOCK-003`（warn）：其余 `open` 项（尚不卡当前阶段、无 `blocksGate` 的 change）→ 只提示。

**豁免**：确需带阻塞往前推，走 [rule-ids-and-gates.md §4](./rule-ids-and-gates.md) 的 `agent/rule-waivers.json`（`ruleId: DOC-BLOCK-002` + `owner` + `expiresAt` + `reason`）。这是 owner 具名、带期限地担责，而不是删条目绕过。缺文件 = 不发任何 check（存量项目零回填）。

## 5. 与既有机制的分工

- **`agent/stage-status.json`**：G5/G7 的阶段处置结论（`completed`/`blocked`/`skipped` 等）。它回答「这个阶段整体什么状态」；`blockers.json` 回答「具体卡在哪几件事、谁负责、什么解除」。阶段 `blocked` 时对应的具体项应在 `blockers.json` 各有一条。
- **`product/06-collaboration.md §7`**：人读的叙述记录（背景、讨论、决策过程）。真值以 `blockers.json` 为准；交付摘要从后者派生，散文只作补充线索。
- **Lark 通知**：阻塞/待确认的群通知策略见 [collaboration-and-notifications.md §4](./collaboration-and-notifications.md)，本协议只管登记与 gate 拦截，不重复通知链路。

## 6. 交付摘要

G8 的 `render-delivery-summary.mjs` 第 4 段从 `openBlockers(entries)` 结构化派生未解除的阻塞与未收口的变更（id + owner + blocksGate + 摘要），第 5 段把 `open` 的 `blocker` 作为 test 提测风险再点一次。人工只在占位处补机器判不了的产品/设计口径；test/pre/online 的后续验收风险另行跟踪。
