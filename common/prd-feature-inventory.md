# PRD 功能清单（Feature Inventory）

> AI 主用：新需求先建全量功能清单再写码。章节号 §3 被外链引用，勿改编号。来源：PR-01973 TradFi 漏做 5.5 / 合约入口复盘。

## 1. 解决什么问题

防止把「当前 Figma 画板/落地页模块」误当「整个 PRD 范围」,导致 PRD 正文/验收标准里的跨页功能被静默裁掉、TDD 写「Figma 没有所以不做」却没同步 PRD 验收项、首轮只交付单页验收才补做 Header/Markets/交易页联动。

**核心原则:Figma 没有 ≠ PRD 不做。** 每条必须写清「在哪个路由/页面实现」。

## 2. 何时必须做

| 门禁 | 动作 |
|------|------|
| **G0** | 从 PRD（含**验收标准**章节）抽全量功能清单初稿 |
| **G1** | 清单写入 `<PROJECT-ID>/product/00-feature-inventory.md`（不存在则按 §3.1 步骤 A 创建），与 `01-scope-and-phases.md` 对齐 |
| **G2** | 每条标「做/不做/延期」并确认;**不做**须产品签字或记 `06-collaboration.md` |
| **G4 前** | 每条「本期做」已映射到路由 + 任务 |
| **G6/交付** | 对照清单逐项勾选,不得只验 Figma 画板模块 |

G2 未完成前不写业务代码（同 [workflow-gates.md](./workflow-gates.md)）。

## 3. Agent 自动执行流程（强制）

适用:AI 接手 `@fameex/web` 新需求或首次进入某 `docs_tdd/<PROJECT-ID>/` 时。步骤由 Agent 自行完成,不要求负责人手动复制模板;缺文件则 Agent 创建填写。

### 3.0 触发条件（满足任一即执行）

- 新建 `docs_tdd/<PROJECT-ID>/` 目录;
- 目录存在但缺 `product/00-feature-inventory.md`;
- 负责人给 PRD/工单要求开始,且该项目无 G2 定稿清单;
- 从其他项目 fork 文档结构但清单未迁移。

### 3.1 步骤 A — 创建清单文件（G0 前,自动）

1. 确认路径 `docs_tdd/<PROJECT-ID>/`（不存在按 [project-doc-structure.md](./project-doc-structure.md) 建骨架）。
2. 复制 `templates/feature-inventory-template.md` → `<PROJECT-ID>/product/00-feature-inventory.md`（Agent 写文件即等同复制）。
3. 填文首元信息:工单号、PRD 路径（`inbox/*.md`）、Figma node、维护人（未知留空）。

**禁止**:等负责人手动复制;跳过此文件直接写 `01-scope` 或业务代码。

### 3.2 步骤 B — G0 填初稿（读 PRD 后,自动）

1. 运行 `prd-intake.mjs <PROJECT-ID> --init --source <repo-relative-prd.md>`，完整读取 PRD 正文与验收标准；富媒体、删除线、manifest 字段和 unresolved 判定统一执行 [lark-doc-sync.md §8](./lark-doc-sync.md)，本文件不重复定义。
2. 对 manifest 中分类为 `requirement` 的 sourceId 映射 Feature ID；`decorative` 项写 disposition，`unresolved` 项按富媒体读取规则阻断或登记。
3. 每条可交付功能写入「功能清单」表,至少含:PRD sourceId/章节号+简述、实现页面/路由（跨页必须写清如 `/markets/...`、Header 下拉）、Figma 是否覆盖、与主画板关系（落地页/独立页/全局组件）。**字段级展示约束（长度上限/截断省略号/空态/默认值/溢出/可不配置）须各自拆成独立条目并进「验收标准对照」表,不能只登记字段本身——藏在 05-ui「展示规则」列里的边界规则不单列就会漏做+漏测（PR-01685 Hero 主标题 32/副标题 60 字符省略号复盘）。**
4. 填「验收标准对照」表（PRD 验收项 → 清单 ID）。
5. 列「Figma 未覆盖但 PRD 要求」表;**默认标「待 G2 确认」**,不得擅自标「不做」。
6. 列「PRD 未完全可读内容」表并同步写 `06-collaboration.md`；分类与处理方式消费 [lark-doc-sync.md §8](./lark-doc-sync.md)。
7. 任务回复简报:清单总条数 N、Figma 未覆盖 M、PRD 未完全可读 R。

### 3.3 步骤 C — G2 定稿（写业务代码前,必须完成）

1. 与负责人确认（或据已明确 PRD/评审结论）每条标**做/不做/延期**。
2. 更新 `00-feature-inventory.md`:「本期」列全落定;裁剪项写「Scope 裁剪记录」并同步 `06-collaboration.md`;填「G2 确认人 & 日期」（未回复标「待确认」,**此时仍禁写业务代码**）。
3. 每条「做」在 `04-frontend-tasks.md` 至少一条对应任务（无则补）。**任务备注须链到该字段的权威展示约束（05-ui「展示规则」列）或直接写明约束,不能只链 Figma——Figma 规格常缺长度/截断/空态等边界（PR-01685 任务 E3 只链 07-figma §4.1,致 32/60 字符省略号规则对开发不可见而漏做）。**
4. 每个 requirement sourceId 必须同时出现在 Feature Inventory 与 Task；运行 `prd-intake.mjs <PROJECT-ID> --approve` 固化当前源文件、素材和映射 fingerprint。
5. **门禁**:仅当 G2 确认人 & 日期已填、无「待 G2 确认」、无 unresolved sourceId 且 fingerprint 未漂移 → 方可进 G4。

### 3.4 步骤 D — 编码与交付回查

- G4-G6:对照清单 ID,不得只做 Figma 画板模块。
- G4-G6:每次 `docs-tdd changed` 复核 PRD fingerprint；正文、图片、表格或映射变化即暂停并重做 intake/G2 差异确认。
- G8:交付摘要附清单勾选结果（做了哪些 ID、裁剪哪些 ID）。

### 3.5 Agent 阻塞条件（出现即停写业务代码）

| 条件 | 动作 |
|------|------|
| 无 `product/00-feature-inventory.md` | 执行步骤 A、B |
| 清单「本期」列含「待 G2 确认」 | 执行步骤 C 或向负责人确认 |
| G2 确认人 & 日期为空 | 向负责人确认 scope |
| TDD 与 PRD 冲突且 `06-collaboration` 无结论 | 列差异表等确认 |
| 负责人「先写代码」但未定 scope | 仍先完成 B;至少输出初稿清单再编码 |

## 4. 清单怎么写

`00-feature-inventory.md` 至少含列:

| 列 | 说明 |
|----|------|
| PRD 条目 | 章节号 + 简述（含验收标准条目,不只扫「产品方案」） |
| 实现页面/路由 | 如 `/tradfi`、`/markets/tradfi`、Header 下拉、`/swap/...` |
| Figma 是否覆盖 | ✅ / ❌ / 部分 |
| 与主画板关系 | 落地页内嵌 / **独立页面** / 全局组件 |
| 本期状态 | 做 / 不做 / 延期 |
| 确认人 & 日期 | 裁剪或延期时必填 |
| 任务/代码锚点 | `04-frontend-tasks.md` 条目或文件路径 |

### 4.1 必读 PRD 范围

1. **产品方案**（如 PRD §5.1–5.6）
2. **验收标准**（如 PRD §5.7）—— 常含跨页入口,易漏读
3. **需求 List / 变更记录** —— 后期新增条目

无法读 Lark 时以 `inbox/*.md` 导出稿为**唯一 PRD 源**;TDD 与 PRD 冲突时**列差异表**,不得 silent 跟 TDD 裁剪。

### 4.2 常见误判（禁止）

| ❌ 错误推论 | ✅ 正确做法 |
|------------|------------|
| Figma 落地页无「行情板块」→ 不做 PRD 5.5 | 5.5 若在 **Markets 行情页**,仍要做 `/markets/tradfi` |
| 工单名「XX 落地页」→ 只做 `/xx` | 清单必须含 Header、Markets、交易页等 PRD 明示跨页项 |
| 5.2 已有可交易资产表 → 5.5 重复 | 5.2 在落地页,5.5 在行情页;写清差异,不能互相替代 |
| TDD D2 写「不做 5.5」 | 须同步 PRD 5.7 验收项删除或延期,并产品确认 |
| 字段已登记（如「活动名称」）→ 视为覆盖 | 字段的展示约束（最大 32 字符/超出省略号/可不配置）各自成清单+验收项;边界规则藏在 05-ui 展示规则列不落 AC = 漏做且漏测（PR-01685） |

## 5. 与现有文档的关系

| 文档 | 关系 |
|------|------|
| `01-scope-and-phases.md` | 摘要本期范围;清单是明细 |
| `04-frontend-tasks.md` | 每条「做」至少一条任务 |
| `06-collaboration.md` | 记 Figma vs PRD 差异、裁剪结论 |
| `05-ui-and-interaction.md` | 按**页面/路由**分节,不只写落地页 |

裁剪 scope 时 `06-collaboration.md` 必写:砍哪条 **PRD 章节/验收项**、谁确认何时确认、对 **5.7 验收标准**的影响（删项/延期/替换）。

## 6. 复盘样例（PR-01973 TradFi）

| PRD 条目 | 正确落点 | 初版问题 |
|---------|---------|---------|
| 5.5 行情板块 | `/markets/tradfi` | Figma 落地页无此模块,D2 误判整段不做 |
| 六、合约交易 TradFi 入口 | Header 下拉 + 交易页 TradFi tab | 放 5.7 验收里,首轮易被跳过 |

教训:**先清单、后 Figma**;跨页功能 G0 就标路由。

## 7. 开始编码前的汇报模板（Agent 必填）

进 G4 前在任务回复输出:

```text
【Feature Inventory】
- 文件：apps/web/docs_tdd/<PROJECT-ID>/product/00-feature-inventory.md
- PRD 已读：inbox/<文件名>（含验收标准 §x.x）
- 清单条目：N 条；本期做 M / 不做 K / 延期 L
- Figma 未覆盖但 PRD 要求：…（无则「无」）
- TDD vs PRD 冲突：…（无则「无」）
- G2 确认：是（确认人 / 日期）| 否（阻塞原因）
```

任一项「否」或 G2 未确认 → **停写业务代码**,先执行 §3 步骤 A–C。
