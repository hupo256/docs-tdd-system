# Handoff：PRD intake 指纹对易变媒体元数据稳定化（docs_tdd 引擎加固）

> 独立引擎加固任务的交接文档。**方案已获用户批准，尚未实现。** 与任何 PR 功能分支无关。
> 新 chat 接手：读本文件，按「实现方案」四步执行，按「验证」段核验。

## 接手须知

- **状态**：已批准，未开始实现。**只改 docs_tdd 引擎 + 迁移 3 个项目 manifest**，不碰 fameex-web / 任何 PR 业务代码。
- **工作仓**：`/Users/aven/github/docs_tdd`（独立 git）。可另起分支或沿用当前文档分支；交付时提交推送。
- **命令统一加** `export DOCS_TDD_AGENT_CLIENT=claude`（否则 gate 报 `client changed`）。
- **改 `prd-manifest.mjs` 后必须重发指纹**（它在 rule-release 指纹内）：`node common/engine/agent-scripts/rule-release.mjs --write` + `node common/engine/agent-scripts/effective-rules.mjs --doctor` 后 `--write`；否则所有 gate 先在 freshness 环节 BLOCK（`run-project-gate.mjs:103-121`）。改 `lark-prd-drift.mjs` 不需重发（被 `isLarkPlumbing` 排除）。
- **验收初衷**：迁移后 `docs-tdd gate PR-02273 G2` 不再报 `DOC-PRD-010`（当初每次 gate 复发的拦路）。
- 三项目现指纹（迁移后会变，仅供核对命中）：PR-02265 `64998c88621d629f`、PR-02273 `e6eeaef4a44ed260`、PR-02172 approvedFingerprint 空(G0)。

## Context（为什么做）

PR-02273 每次续作都被 `DOC-PRD-010 remote PRD drift` 拦住 coding session / G2 gate，逼着"重新 sync + intake"。经逐行核对：**PRD 需求内容逐字未变（revision 2547）**，漂移全部来自**易变媒体元数据**：

- Lark 图片下载 URL 的 `authcode` 令牌（每次 fetch 轮换）——已归一化；
- 图片 **AI/OCR `alt`/描述文字**（同一张图每次 fetch 措辞不同，非确定性）——**未归一化**；
- `extracted.md` 前言的 `syncedAt` 时间戳（每次同步都变）。

这些噪声进入三处哈希，跨同步不稳定、反复误报。**G0–G8 每个 gate 都跑 `validatePrdIntake`（DOC-PRD-001~010）**（`verify-project-gate.mjs:457` 级联；`:462` 仅 `pilot.prdIntake` 为真时），所以漂移是**每次 gate 的复发拦路**。目标：让所有 intake 哈希在计算前剥离易变媒体元数据，使「同一 PRD 内容、不同 fetch」得稳定指纹，同时真实需求文字/结构/表格/资产字节仍参与指纹（真变更仍检出）。

## 影响面（Explore 实测）

- 触发检查的 gate：**G2/G4/G5/G6 全部**跑 DOC-PRD-003/008/009/010（prd-intake 收到的 stage 恒为 `G0`/`G2`）。
- 活跃项目 3 个：**PR-02172**(G0，52 items，无 remoteSources 基线，approvedFingerprint 空)、**PR-02265**(G4，34 items)、**PR-02273**(G4，22 items)。改哈希公式后三者 DOC-PRD-003/008/009 会失配。
- 现成迁移 `--init` **会 churn sourceId 且抹掉人工分类/摘要**（bridge 仅按 contentHash，`prd-intake.mjs:201-202`）；`--approve` 因 DOC-PRD-003 fail 属 blocking 被拒（`:260-261`）。**无就地 rehash 模式 → 必须新增**。
- golden/check/self-test 不受影响（golden fixture `pilot.prdIntake=false`；self-test self-consistent 动态算指纹）。

## 实现方案（完整加固 + 迁移模式）

### 1. 统一媒体归一化（`lib/lark-prd-drift.mjs`，不进 rule-release 指纹）

- 新增导出纯函数 `stripVolatileMediaMetadata(content)`：剥离 authcode URL（复用现有 `TEMPORARY_MEDIA_URL_RE`）+ markdown 图片描述 `/!\[(?:\\.|[^\]])*\]/g`→`![]` + HTML `<img … alt="…">` 的 alt 属性。
- `canonicalizeLarkDocumentContent` 改为：`\r\n`归一 → `stripVolatileMediaMetadata` → `trim`（修 DOC-PRD-010）。
- 扩 `selfTest`：仅 img alt/描述不同 → 同 hash；真实文字改 → 不同 hash。

### 2. item / source 哈希稳定化（`lib/prd-manifest.mjs`，进 rule-release 指纹）

- 从 `./lark-prd-drift.mjs` 导入 `stripVolatileMediaMetadata`（prd-manifest → lark-prd-drift 单向依赖，无环）。
- `scanMarkdown` item `contentHash`（约 `:61`）：`hash(stripVolatileMediaMetadata(raw) + "\n" + asset.assetHash)`。assetHash（PNG 字节）仍参与——真实换图仍检出。
- 新增导出 `sourceContentHash(text)` = `hash(stripVolatileMediaMetadata(去 syncedAt 前言行后的 text))`；替换**所有**源哈希计算点，全链一致：`prd-manifest.mjs:119`（DOC-PRD-008）、`prd-intake.mjs:199`（initManifest）、`:262`（--approve）、两处 selfTest 的 `hash(fixture)`。
- 扩 `selfTest`：仅 alt/syncedAt 变 → item/source hash 不变；真实内容变 → 变（self-consistent，保持 green）。

### 3. 新增就地迁移模式 `prd-intake.mjs --remigrate`（无 churn）

在 `--init`/`--approve`/`--stage` 旁新增 `--remigrate`：

- 读现有 manifest；用新 `scanMarkdown` 重扫当前 sources。
- **按 `locator` 匹配**新扫描项与旧 items（locator=行号:type:序号，跨"仅 alt/syncedAt 变"的同步稳定），carry over `sourceId` + 人工字段（`status/classification/readMethod/summary/featureIds/disposition/evidence`），仅用新扫描刷新 `contentHash/assetHash/assetPath/assetStatus`。
- 新扫描有、旧无 locator → 新增 unresolved（暴露真实新增）；旧有、新扫描无 → 丢弃（暴露真实删除）。
- 重算 `manifest.sources[].contentHash`（新 `sourceContentHash`）。
- 重算 `remoteSources[].contentHash` = `hashCanonicalLarkContent(读取 remoteSource.target 的本地已同步原文)`（与 live drift 同口径；**不 re-sync**，避免 inbox churn）。
- 若原 `approvedFingerprint` 非空则重算覆盖；G0/空则留空。
- 写回 manifest；`--json` 输出迁移摘要（carry/new/dropped 计数）。

### 4. 迁移执行 + 重发

- `node common/engine/agent-scripts/prd-intake.mjs PR-02172 --remigrate`、`PR-02265 --remigrate`、`PR-02273 --remigrate`（不 re-sync，就地重算）。
- `rule-release.mjs --write` + `effective-rules.mjs --doctor && … --write`。

## 关键文件

- `common/engine/agent-scripts/lib/lark-prd-drift.mjs`（canonicalize + 新 `stripVolatileMediaMetadata` + selfTest）
- `common/engine/agent-scripts/lib/prd-manifest.mjs`（`scanMarkdown` item 哈希、`sourceContentHash`、`inspectManifest:119`、selfTest）
- `common/engine/agent-scripts/prd-intake.mjs`（`--remigrate` 模式；`initManifest:199`、`--approve:262` 换 `sourceContentHash`）

## 验证（端到端）

1. `node common/engine/agent-scripts/lib/lark-prd-drift.mjs --self-test`、`node common/engine/agent-scripts/lib/prd-manifest.mjs --self-test` 绿。
2. `docs-tdd check`、`docs-tdd golden` 绿（预期不受影响）。
3. 迁移后对每个项目：`DOCS_TDD_AGENT_CLIENT=claude docs-tdd gate <ID> <其 stage/G2>` —— DOC-PRD-003/008/009/010 全绿。
4. **稳定性**：对 PR-02273 连跑两次 `agent/scripts/sync-lark-docs.mjs`（authcode/OCR 会变），再 `gate G2` —— 指纹稳定、DOC-PRD-010 不漂移。
5. **负向**：手工改 extracted.md 一处真实表格文字 → DOC-PRD-008/003 仍 fail；改远端映射文字 → DOC-PRD-010 仍 drift（证明只滤噪声、不滤真变更）。
6. 迁移不 churn：diff 迁移前后 manifest，`sourceId`/`classification`/`summary`/`featureIds` 逐项不变，仅哈希类字段（`contentHash`/`assetHash`/`approvedFingerprint`/`sources[].contentHash`/`remoteSources[].contentHash`）更新。

## 交付

引擎改动 + 3 项目 migrated manifest + 重发的 rule-release/effective-rules，一次提交推送（含 self-test/gate 证据）。
