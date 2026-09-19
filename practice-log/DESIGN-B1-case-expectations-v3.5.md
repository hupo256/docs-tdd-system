# 附录 B-1：四个真实案例的预期行为定义（v3.5 P0 验收基线）

> 状态：纸面基线，不动代码。配合 `ITERATION-PLAN-v3.5-20260917.md` 使用。
>
> 用途：把「系统应该怎么表现」变成可对照的验收样本。每个案例写清三件事：
> 1. **输入状态**——work-item / 代码树 / 依赖处于什么状态；
> 2. **期望机器输出**——docs-tdd 应产出的受控状态、对账结论、退出码；
> 3. **期望被拦截的错误话术**——Agent 在该状态下禁止说出的自然语言结论。
>
> 每个案例回链到具体 observation，验收时逐条核对。四个案例覆盖 Phase 1 验收标准场景 A/B/C/D。

---

## 案例 1：PR-02233 —— pivot + consumer wiring（对应场景 A+B）

> 回链：O-34 / O-35（严重事故）、O-12（web/web-next 双应用）。
> 这是本轮最高优先级案例，直接复现「局部实现误报整批完成」。

### 输入状态

- 目标应用从 `apps/web` 切换到 `apps/web-next`（delivery target pivot）。
- 代码树事实：
  - 已落盘：`SendCodeButton`、`NoCodeGuideDialog`、倒计时/异常分类/埋点等基础能力，ResetPassword 部分接入。
  - 未落盘：`SwitchVerifyMethodDialog` 组件不存在；Login 无「绑定 ≥2 种方式才显示切换入口」的接线；Register 未接入 R-001/R-006。
- work-item：R-001~R-017 等 implement surface 存在，但 surface 无强制真实代码落点绑定。
- 依赖：PR-02189/PR-02235 仅阻塞冷却时间戳与限频类型（integration-pending），不阻塞切换弹窗这类纯前端项。

### 期望机器输出

| 维度 | 期望 |
|---|---|
| A5 pivot invalidation | 检测到 delivery target `apps/web → apps/web-next`，把旧 `apps/web` 目标下的 implementation/evidence/acceptance 状态标记 `stale`，不得继承旧完成度 |
| A2 surface→code | 每个 `disposition=implement` surface 必须能解析到当前 Git 树的真实落点；`SwitchVerifyMethodDialog` 对应 surface 判为 `missing`（组件名在树中不存在）|
| A3 provider/consumer | `SwitchVerifyMethodDialog`（provider）即使存在，Login/Register 的 consumer surface 只有在 import+渲染+事件链路或真实 browser 证据存在时才能关闭；当前判为 provider=partial / consumer=missing → 整体 `incomplete` |
| A4 runtime critical path | 「绑定≥2方式→入口出现→点击→弹窗→仅列已绑定并排序→选择后切换输入区」属 PRD「动作→结果」交互，未执行 browser-interaction / 人工签认前禁止标 ready-for-acceptance |
| A6 dependency blast-radius | pending 只标记到冷却时间戳/限频类型对应的 surface；切换弹窗、入口显隐、排序、当前项标识归为 `still-implementable`，不进 pending |
| 整体状态 | `partially-implemented` 或 `implementation-incomplete`，绝不能是 `implementation-complete` / `ready-for-human-acceptance` |

### 期望被拦截的错误话术

以下在当前状态下必须被 A1 completion-language guard 阻断：

- 「开发完成，等待后台接口，进入人工验收」
- 「三页（Login/Register/ResetPassword）已接入」
- 「已取得双视口回归结果」
- 「验证方式切换流程已迁移完成」

允许的受控表述：`partial` / `implementation-incomplete` / `integration-pending`（仅限冷却时间戳与限频类型两项）/ `not-ready-for-acceptance`。

### 提交环节（A7）

若提交 `feat: PR-02233 migrate verification flow to web-next`，而树中不存在 `SwitchVerifyMethodDialog`：delivery commit 路径给出 overclaim 阻断，要求收窄标题（如 `feat: PR-02233 add send-code button and no-code guide dialog`）或补齐实现。checkpoint commit 不阻断，但摘要须标 partial。

---

## 案例 2：hichat redirect_url bugfix —— Bugfix Lite（对应流程分档）

> 回链：HB-1（缺轻量通道）、HB-2（需求类型→流程重量路由不明）、HB-4（开工前置门）、HB-5（write 覆盖）。

### 输入状态

- 需求类型：已定位根因的单点 bug。根因精确到 `apps/web/src/components/ThirdPartyLogin/common/thirdConfig.ts` 的 `hiChatUrl` 尾斜杠空段 `pop()`。
- 改动规模：抽一个纯函数 + `filter(Boolean)`，行为对无尾斜杠场景与旧实现一致。
- 不引入新业务语义、不触资金/权限/登录鉴权核心变更。
- 有明确回归方式：`thirdConfig.test.ts` 8 条边界（含 `/zh-CN/` → `home` 回归锚点）。

### 期望机器输出

| 维度 | 期望 |
|---|---|
| 流程分档 | 识别为 Bugfix Lite，不强制走 v2 全流程（需求抽取→coverage review→scope approval），也不走更重的 `--legacy` G0–G8 |
| Bugfix Lite 必录字段 | 现象/预期/实际/根因/修改文件/边界条件/回归命令/分支/基线/touched content hash/待确认产品语义 |
| 开工前置门（Phase 4） | 编码前机器校验当前分支不在 online/pre/test/dev；命中则拒绝并要求从 origin/online 切 `fix/<ID>` |
| 文件覆盖防护（Phase 4） | 对 `thirdConfig.test.ts` 这类已存在文件，`write` 前先探测存在性，存在则要求 `edit` 追加而非整体覆盖 |
| 自动升级判据 | 若根因触及资金/权限/登录鉴权/密码/数据删除/跨应用行为，或产品预期不明确/影响面无法收敛 → 不走 Lite，升级完整流程 |

### 期望被拦截的错误行为

- 在 `online` 分支直接 `git add` + `git commit`（HB-4 事故）——开工前置门必须拦截。
- 用 `write` 覆盖已存在的 `thirdConfig.test.ts`（HB-5 事故）——文件覆盖防护必须拦截或告警。

### 边界澄清

Bugfix Lite 与已有 `lib/fast-track-policy.mjs`（v1 G-gate 临时契约销账）无关，不复用其状态机。

---

## 案例 3：TR-02386 —— kickoff 兼容 + deliveryScope（对应场景 kickoff）

> 回链：TR-1（预存目录被误判 v1）、TR-2（本地 PRD 路径约束）、TR-3（bounded-batch 无延期项无法自洽）、O-14/O-16/O-32（includedRequirementIds 语义反直觉）。

### 输入状态

- `prds/TR-02386/` 目录在 kickoff 前已存在（含前一会话遗留 `HANDOFF.md`），但无 README `workflowVersion` 也无 `work-item.json`。
- 本地 Markdown PRD（PLAN.md）作为 source。
- 全部需求纳入本批次，无延期项（无 App deferred 等）。

### 期望机器输出

| 维度 | 期望 |
|---|---|
| kickoff 兼容 | 目录存在但无 workflowVersion 时，**不静默降级 v1**；输出明确诊断，默认建议 v2；若检测到 legacy 文件要求人工确认。诊断须解释：为何无法判断版本 / v1 与 v2 差别 / 如何选择 |
| 本地 PRD 路径 | 报错文案直接写明「本地 PRD 需放在 `<docs_tdd>/prds/<ID>/inbox/` 下」，而非只报 `docs path must stay inside ...` |
| deliveryScope 无延期项 | 允许 `deferred: null` 或内置 empty-remainder 约定；context 生成对 `deliveryScope.deferred` 做存在性保护，不抛 `Cannot read properties of undefined` |
| deferred finding | 全量单批次交付时，**不要求 reviewer 产出与 owner+batch 匹配的 deferred finding**（reviewer 不可能自然产出，属伪造）|
| includedRequirementIds | 字段语义澄清或改名：要么改为 `workItemRequirementIds`（列全部），要么允许 `includedRequirementIds` 只列本批次 + `deferredRequirementIds` 补集；报错文案说明「必须等于全部 requirementId」 |

### 期望被拦截的错误行为

- 因为凑不出 deferred finding 而移除整个 deliveryScope（TR-3 的绕行不应成为常态）。
- 把预存目录静默当 v1 走旧通道，报 `lark-sources.json 缺失或为空`。

---

## 案例 4：证据充分性 —— 有静态测试无真实交互（对应场景 D）

> 回链：O-31（audit 只检查存在性）、O-30（human-check 无一等 producer）、O-33（scoped 命令误跑全套）、O-17/O-18（browser 证据可执行）。

### 输入状态

- 某 requirement 声明了 UI 交互（如「切换后输入区替换」），evidence 只挂了源码字符串断言 + 静态 DOM contract，且一条命令绑定了多个 requirement/surface。
- 测试命令写成 `pnpm test --run <files>`，但 `web-next` 的 `test` script 是 `vitest run src`，实际展开成跑全套 536 文件。
- 依赖 MSW mock 返回信封，但 UI 切换/恢复/禁用/异常回退适合人工检查。

### 期望机器输出

| 维度 | 期望 |
|---|---|
| A4 / D3 | 静态字符串断言 + DOM contract 不足以证明完整交互链路；判 `claim strength insufficient`，要求 runtime 证据（browser-interaction 或 human-check）|
| D3 overclaim | 一条命令绑定过多 requirement/surface 时给 overclaim warning/error；建议逐条收窄绑定 |
| D4 scoped 展开 | 解析 package.json script 展开结果，发现 `test → vitest run src` 自带目录入口 → 拒绝称为 scoped，建议 `pnpm exec vitest run <explicit files>` |
| D1 human-check | 允许 requirement 直接声明 `producer: human` / `kind: human-check` 场景，不强制配对应 argv command；verify 同时校验 command receipt 与 human confirmation |
| D2 structural | 文件行数/命名/导出存在性等结构检查用 `structural`/`quality` kind 挂载，不冒充功能证据（Biome/typecheck 不归类为业务功能证据）|

### 期望被拦截的错误话术

- 「UI 交互已通过自动化测试验证」（实际只证明了 mock 信封或字符串存在）。
- 「scoped 测试全通过」（实际跑了全套并混入 8 个无关既有失败）。

---

## 四案例与 Phase 1 验收标准对照

| 计划验收场景 | 覆盖案例 |
|---|---|
| 场景 A：组件已写，页面未接入（provider=covered, consumer=missing） | 案例 1 |
| 场景 B：旧应用有实现，目标切到新应用（old=stale, new=uncovered） | 案例 1 |
| 场景 C：API 只阻塞部分 surface（API-dependent=pending, pure-frontend=still required） | 案例 1（依赖切分）+ 案例 4 |
| 场景 D：有静态测试，没有真实交互（evidence exists, claim insufficient） | 案例 4 |
| 流程分档（Phase 2） | 案例 2、案例 3 |

> 说明：案例 1 同时覆盖 A/B/C 三个 Phase 1 场景，是 P0 golden fixture 的主锚点。案例 4 覆盖场景 D 与 Phase 3 证据类。案例 2/3 属流程弹性，作为 Phase 2 输入，不与 P0 抢工，但预期行为先在此冻结。
