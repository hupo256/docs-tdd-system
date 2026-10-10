# v3.1 实践记录 — hichat redirect_url 截断 bugfix（2026-09-12）

> 目的：用一个**真实「已定位 bug」类需求**跑 docs_tdd v3.1，记录框架在 bug 场景下的卡点/摩擦/缺口，供迭代 v3.1。
> 记录人：Pi agent（本会话，独立于 PR-02233 会话）。
> 载体放在仓库根目录下的 `practice-log/`（不进 `common/`）：直接沿用姊妹日志 `practice-log/PRACTICE-LOG-v3.1-20260912.md` 的 O-4 结论——`rule-release.mjs` 发布指纹遍历整棵 `common/`，任何新增 `.md` 都会把 L3 规则发布弄 stale。

## 环境（开工前基线）

- 系统仓：`/Users/aven/github/docs_tdd`。
- 消费仓：`/Users/aven/github/fameex-web`，HEAD `d60f1c886a`，分支 `online`。
- 当前框架：v3.1（新项目默认 `workflowVersion: 2`）。
- 本需求类型：**已定位 bug 修复**，不是新特性需求。

## 业务事实：hichat 登录跳转 redirect_url 被截断

- **现象**：首页点击 hichat 三方登录，跳转 `https://www.hailiao.info/#/login?...&redirect_url=www.fameex.com-&lang=zh-CN`（path 段为空），预期 `redirect_url=www.fameex.com-home`（用户工单写 `-hom`，见下方待确认项）。后续 hichat 侧回跳流程因 redirect_url 残缺而乱。
- **根因（精确代码位置）**：`apps/web/src/components/ThirdPartyLogin/common/thirdConfig.ts` 旧 `hiChatUrl`：
  ```js
  const pathnames = location.pathname.split('/') || []
  const path = pathnames.length > 2 ? pathnames.pop() : 'home'
  ```
  首页 URL 是 `/{lang}` 或 `/{lang}/`（落点 `app/[lang]/[others]/page.tsx`）。`next.config.mjs` 设了 **`skipTrailingSlashRedirect: true`**，Next 不会把 `/zh-CN/` 的尾斜杠重定向掉。用户落在 `/zh-CN/` 时：
  - `'/zh-CN/'.split('/')` → `['', 'zh-CN', '']`，length 3 `> 2` → `pop()` 拿到最后一段 **`''`**
  - `redirect_url` = `www.fameex.com-` ← 现网现象
  - 无尾斜杠 `/zh-CN` → length 2，才走 `'home'`。
- **修复**：抽纯函数 `resolveHiChatPathTag(pathname)`，先 `split('/').filter(Boolean)` 过滤空段再判断：
  ```js
  const segments = pathname.split('/').filter(Boolean)
  return segments.length > 1 ? segments[segments.length - 1] : 'home'
  ```
  行为对所有无尾斜杠场景与旧实现一致，仅修掉尾斜杠/连续斜杠落空段的 bug。
- **回归**：新增 `thirdConfig.test.ts`，8 条边界（含 `/zh-CN/` → `home` 的回归锚点），`npx vitest run` 全通过。
- **验证经济**：只对触碰文件跑定点 vitest，未跑全仓 type/lint/build。
- **待确认（非阻断）**：工单预期写 `www.fameex.com-hom`，与代码注释语义（首页 tag = `home`）差一个 `e`。判断为工单笔误/截断，修复按 `home` 落地，已向用户标注请其确认；若确需 `hom` 需产品侧给出依据。

## 观察台账（O = Observation，本会话新增，编号续 hichat-bugfix 独立命名空间）

### HB-1【框架缺口】v3.1 缺「已定位 bug 类」的轻量通道
- 现象：本需求根因单点、改动一行级，但 v3.1 新项目默认强制 `workflowVersion: 2` 重流程（`docs-tdd run` → 原子需求抽取 → coverage review → scope approval → verify），`--legacy` 又更重（G0–G8）。对「已定位 bug」，这套需求抽取/独立冷读审查明显过重。
- 影响：真实研发里「解 bug」占比高；若每个 bug 都套 v2 全流程，会逼使用者绕过框架（回到裸改），反而流失实践数据。
- 处置：本次按「轻量根因说明 + 定点回归 + 不 push」的编码硬纪律执行，**未建 work-item**，仅本实践日志留痕。
- v3.1 迭代待定：是否新增一个 `bugfix` 档位——要求 ①根因定位到代码行 ②定点回归测试 ③证据绑定 effective content hash，但**跳过**需求抽取与独立审查。与 PR-02233 会话在「日志官方落点」上的待定项可合并考量。

### HB-2【认知摩擦】用户对「bug 也要不要走 v3.1 / 会不会沉淀」不确定
- 现象：用户开工前连问两点——「这个也用 v3.1 干活吗」「解决过程会不会记录成 v3.1 优化依据」。说明 v3.1 对「哪些需求类型进框架、进到什么深度」缺少一眼可查的准入分档说明。
- 根因：README/vnext 的分档是按 `workflowVersion` 与风险等级 V0/V1/V2 讲的，没有按「需求类型（新特性 / bug / 重构 / 文案）」给使用者直接的路由建议。
- v3.1 迭代待定：在 `rule-router.md` 或 kickoff 文档加一张「需求类型 → 建议流程重量」的路由表（新特性→全流程；已定位 bug→bugfix 轻档；纯文案/样式→最轻）。

### HB-4【严重·agent 流程失误】未先切分支，直接在 online 上 commit
- 现象：修复 hichat bug 时，我未确认/切换分支就在**环境分支 `online`** 上 `git add` + `git commit`（`07b0b43fff`）。
- 违反规则：`git-branch-flow.md §1/§6`——开新需求/修 bug 一律从最新 `origin/online` 切 `feature/<ID>` / `fix/<ID>`；`online/pre/test/dev` 是环境分支，只能被功能/修复分支**单向合入**，永不在其上直接改。
- 纠正：从最新 `origin/online` 新建 `fix/hichat-redirect-url`，cherry-pick 修复（`0764525621`，基线校验通过），本地 `online` 复位回动手前的 `d60f1c886a`。
- 根因（agent 侧）：动代码前缺少「先核对当前分支 / 切工作分支」这一前置动作；此前另一失误（`write` 覆盖既有 `thirdConfig.test.ts`）同源——**下手前未先探测现状**。
- v3.1 迭代待定：bugfix 轻档（见 HB-1）应把「① 确认不在 online/pre/test/dev ② 从最新 origin/online 切 fix/<name>」列为**编码前置硬门禁**，而非仅靠 G4 时点检查（G4 只在显式 gate 时触发，bug 轻档不跑 gate 就完全失去这道拦截）。

#### HB-4 深化：跨场景分支策略对照（2026-09-12 用户补充）
- **场景对照后的关键发现**：lark-bot 侧其实已有完整前置路由（`lark-work-context.mjs` resolveWorkContext + `lark-commit-policy.mjs`），**从不在 online/pre/test/dev 直接改**：
  | 场景 | 落点 | 分支 | 基线 | commit |
  |---|---|---|---|---|
  | 只读 | 主仓 | 不建分支 | — | none |
  | 有项目号+本地有 worktree | 该 worktree | 项目当前分支 | — | scoped（不碰人类 WIP）|
  | 有项目号+本地无 worktree | 隔离临时 worktree | `hotfix/<PROJECT-ID>-<suffix>` | origin/online | auto |
  | 无项目号 adhoc | 隔离临时 worktree | `hotfix/adhoc-<suffix>` | origin/online | auto |
  | 命中 worktree 但有人类 WIP | 改路由隔离 worktree | 同上 hotfix | origin/online | auto |
- **发现 1（HB-4 真根因）**：lark-bot 有机器强制的「开工前算工作上下文」前置层；**交互式 agent（我）没有对等前置门**，全靠人肉记规则，故会漏切分支直接在 online commit。修法不是「更小心」，是给交互式链路补一道和 resolveWorkContext 对等的开工前置检查。
- **发现 2（规则-实现漂移，需用户定夺）**：bug 分支命名三处不一致——
  - `git-branch-flow.md §1` 规则：`fix/<PROJECT-ID>`；
  - lark-bot 实现：`hotfix/<PROJECT-ID>-<suffix>` / `hotfix/adhoc-<suffix>`；
  - 本次手动纠正：`fix/hichat-redirect-url`。
  待用户拍板统一口径（倾向：计划内 bug=`fix/<ID>`，紧急生产热修=`hotfix/`；lark-bot 临时修复归类需明确），并把定稿同步进 `git-branch-flow.md` 与 lark-bot，消除三处分叉。
- **两个实践场景（用户提出）**：① hotfix 从 origin/online 切 —— 规则与 lark-bot 均已按 origin/online 基线，命名待统一；② lark-bot 接到的任务（多为 bug）—— 已有 worktree/临时 worktree/主仓只读三态策略，机制完整，缺的是与规则文档的命名对齐。

#### HB-4 落地决策（2026-09-12，用户选 A）
- **改变了上一轮判断**：本想把 lark-bot 的 `hotfix/*` 批量 rename 为 `fix/*` 以「消除漂移」；用 change-scoping §4 减法确认后**推翻**：
  1. 语义不同——lark-bot `hotfix/*` 是**bot 隔离临时草稿分支**（从不自动 push/merge），与人类计划内 `fix/<ID>` 是两回事，rename 反而混淆；
  2. live 迁移风险——分支名恒定于 task.id 用于 retry/QA 验退复用 worktree（path=branch.replace），改前缀会让在途任务重开时找不到旧 worktree，lark-bot 是常驻 poller；
  3. 60+ 处引用，纯命名对齐不修任何正确性。
- **正解：用定义消歧，不靠 rename**。已落地：
  - `git-branch-flow.md §1.1` 新增三前缀 taxonomy：`feature/<ID>`（人/agent 新需求）/ `fix/<ID|简述>`（人/agent 计划内 bug）/ `hotfix/<ID|adhoc>-<id>`（**lark-bot 专用**隔离草稿）——`hotfix/*` 被正式认可为 lark-bot 前缀，不再是「漂移」。
  - `git-branch-flow.md §1.2` 新增**交互 agent 开工前置门**：改业务代码前先 `git branch --show-current`，在 online/pre/test/dev 上禁改，先从 origin/online 切 fix/feature——对标 lark-bot 的 resolveWorkContext，把「开工前算工作上下文」从机器侧补到交互侧。
  - `lark-work-context.mjs` 加一行注释把 `hotfix/*` 挂到 taxonomy（零行为改动）。
- **未改 lark-bot 代码行为**（避免过度改动 + live 风险）。

### HB-5【agent 操作风险】write 覆盖了已存在文件
- 现象：新增回归测试时用 `write` 写 `thirdConfig.test.ts`，但该文件已存在（HEAD 已跟踪，含 8 条三方 SDK 契约测试），被整体覆盖。
- 纠正：`git checkout HEAD -- <file>` 恢复原文件，改用 `edit` 追加 `resolveHiChatPathTag` 测试块；最终 16 条全通过。
- v3.1 迭代待定：对「新增测试/新增文件」类动作，规约应要求先 `ls`/`git cat-file -e` 探测是否已存在，存在则 append 而非 write。

### HB-3【机制缺口】实践日志无并发写策略，多会话易互相覆盖
- 现象：本会话与 PR-02233 会话同时在 v3.1 实践期。姊妹日志是单个 `.md`（`practice-log/PRACTICE-LOG-v3.1-20260912.md`），无追加锁；两会话同写会互相覆盖。
- 处置：本会话另建独立文件（本文件），不碰姊妹日志，避免并发冲突；但这只是规避，不是机制。
- v3.1 迭代待定：官方实践日志统一放入 `practice-log/`；若需多会话并发追加，可采用 `practice-log/PRACTICE-LOG-v3.1.jsonl`（每观察点一行 append），或约定「一会话一文件 + 定期人工归并」。与 PR-02233 O-4 的「日志官方落点」待定项属同一议题。

## 时间线

- 2026-09-12：用户提出 hichat redirect_url 截断 bug。先澄清「bug 是否走 v3.1 / 是否沉淀」（→ HB-1/HB-2）。
- 2026-09-12：读 `thirdConfig.ts` + `next.config.mjs` + 路由结构，坐实根因为 `skipTrailingSlashRedirect: true` 下尾斜杠空段被 `pop()`。
- 2026-09-12：抽 `resolveHiChatPathTag` + `filter(Boolean)` 修复；建 `thirdConfig.test.ts` 8 条边界，定点 vitest 全通过。
- 2026-09-12：按用户选择建本独立实践日志（→ HB-3 规避并发）。
- 2026-09-12：修复中先犯 `write` 覆盖既有测试文件（→ HB-5，已恢复+追加）。
- 2026-09-12：误在 `online` 直接 commit（→ HB-4）；用户指出后从最新 `origin/online` 切 `fix/hichat-redirect-url` 并 cherry-pick 修复，`online` 复位。
