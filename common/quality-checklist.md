# 测试、自测与 Review 公共清单

> AI 主用。章节号被外链引用（§3.2/§3.4/§3.5/§5），勿改编号。

## 1. 必测优先级

- 纯函数：金额/精度/排序/状态机/mapper/权限/跳转。
- 页面：首屏、核心 CTA、Tab/排序/FAQ/弹窗、空态、错误态、移动端。
- 主题：涉及样式时至少查 dark + light。
- 数据：loading/empty/error/retry/disabled/权限/未登录。

## 2. 自动验证

每次代码变更后：

- 触达 JS/TS/JSON 跑 Biome。
- 机器静态规则跑 `node apps/web/docs_tdd/common/agent-scripts/verify-code-rules.mjs --project <PROJECT-ID>`（只检查新增/已改文件，内容类规则只看 diff 新增行）。
- 已启用 `pilot.prdIntake` 的项目跑 `docs-tdd changed <PROJECT-ID>`；通过标准消费 [lark-doc-sync.md §8](./lark-doc-sync.md) 与 [prd-feature-inventory.md §3](./prd-feature-inventory.md)。
- 需要浏览器才能证明的交互/集成行为必须真实执行 [browser-e2e-mcp.md](./browser-e2e-mcp.md)；能由 Vitest/DOM 契约证明的优先自动断言；纯视觉、手感与响应式默认交人工清单，分工以 [verification-division-of-labor.md](./verification-division-of-labor.md) 为准。
- 报告字段、目录和命令 fallback 统一执行 [execution-evidence.md](./execution-evidence.md)，本清单不维护格式副本。
- 全量 typecheck/test 被仓库既有问题阻塞时，记录阻塞原因并过滤确认本次模块无新增错误。
- 发现不符合 PRD/Figma/API 契约/QA 用例的点，修复并重跑对应检查。

## 3. 需求完成后的自测与验收策略

G6/交付前按「清单 → 场景 → 证据 → 残留风险」顺序自测，不得只跑命令或只看 Figma 画板。

### 3.1 自测输入

先读齐对齐：`00-feature-inventory.md`（逐项确认做/不做/延期）；`01-scope-and-phases.md`（范围/不做项/验收标准）；`04-frontend-tasks.md`（任务状态/待验项）；`05-ui-and-interaction.md` + `07-figma-spec.md`（视觉/交互/H5/主题；§3 几何表与 §4 preset 映射已对齐、未改 `tailwind-preset.js`，见 [ui-style-token-rules.md](./ui-style-token-rules.md) §1）；`03-api-contract.md` + `06-collaboration.md`（API/Mock/联调/裁剪/阻塞结论）。

### 3.2 自测分层

| 层级 | 必测内容 | 证据 |
|------|----------|------|
| 文档 | 每条「本期做」均有任务和验收结果；裁剪项有确认记录 | 清单勾选摘要 |
| 静态质量 | Biome、类型检查、单测/相关测试 | 命令+结果；失败写阻塞原因 |
| 业务逻辑 | mapper/排序/状态机/金额精度/跳转/权限/登录态 | 单测或手测步骤 |
| 页面交互 | CTA/Tab/排序/分页/弹窗/FAQ/表单/空·错·loading·retry | Browser/Playwright 结论 |
| 视觉响应式 | 桌面、390px H5、dark/light；**L2：与 Figma 并排走查清单全 pass（默认人工，Agent 供 DOM 契约比对）** | 文字报告：节点 ID + 模块 pass/fail（见 [component-reuse-and-visual-fidelity.md §3.0](./component-reuse-and-visual-fidelity.md)、[verification-division-of-labor.md](./verification-division-of-labor.md)） |
| 数据联调 | 真实接口/Mock 兜底/WS·轮询/异常返回/空数据 | 环境、样例、阻塞项 |
| 回归影响 | Header/导航/全局 store/路由/中间件/公共组件被触达面 | 触达范围说明 |

### 3.3 验收策略

1. **先验清单**：按 `00-feature-inventory.md` 的 ID 逐项标完成/未完成/阻塞。
2. **再验 PRD**：逐条对照 PRD 验收标准，不只验 Figma 出现的模块。
3. **再验跨页入口**：Header、Markets、交易页、用户中心等跨页功能单独点一遍或写明未验原因。
4. **再验异常态**：loading/empty/error/未登录/无权限/接口缺字段/无数据标签有可见反馈。
5. **最后出摘要**：含验证命令、浏览器走查、未跑项原因、残留风险、待确认人。

### 3.4 Browser/Playwright 真实自测要求

每个本期 Feature 都必须进入 `agent/acceptance-results.json`。只有浏览器才能证明的点击副作用、路由、弹窗、toast、hydration/白屏等场景才要求真实 Browser/Playwright；纯函数和数据契约用 Vitest，纯视觉/手感/响应式由人工清单确认。未执行或环境阻塞不能标通过。

### 3.5 UI 视觉验收：L1 功能 vs L2 Figma 并排（还原度判定见 §3.0）

判定与适用范围以 [component-reuse-and-visual-fidelity.md §3](./component-reuse-and-visual-fidelity.md) 为准，执行分工以 [verification-division-of-labor.md](./verification-division-of-labor.md) 为准。

| 层级 | 范围 | 能标 JF*/视觉 `[x]` |
|------|------|------------------------------|
| **L1** | 能开、能点、数据/跳转/埋点正确 | **否** |
| **L2** | Hero、任务卡/活动卡片、排行榜、规则区、浮层、弹窗等与 Figma 并排；走查清单全 pass | **是** |

验收动作只检查：适用模块已完成 L2，报告字段完整，未用 L1 结果代替 L2；具体判据不在本清单重复。

无法自测的项不能写「通过」，写「未验证/阻塞」并说明需谁提供什么。因缺文档/材料/账号/权限/环境/后台配置/验收数据阻塞的，记责任人和下一步；启用 Lark 主动通知则触发「阻塞中/补信息」并 @ 责任人。

## 4. QA 用例处理

G7 是「有 QA 用例时执行」的阶段，非必经阻塞点。无 QA 用例直接跳过、不阻塞交付；交付仍以 G6 自测、PRD 验收标准、功能清单、开发侧回归清单为依据。

收到 QA 用例后：① 先与 PRD/Figma/API 契约逐项比对；② 列不一致点和建议；③ 待负责人确认后按用例执行；④ 发现问题即修并重跑；⑤ 全量通过后交付摘要。

无 QA 用例时 G7 记「跳过：未提供 QA 用例」，不得写已跑通或阻塞；仅已收到但无法执行（缺账号/环境/权限/数据）才记阻塞。

## 5. Review Checklist

- [ ] 文档已先更新并确认。
- [ ] 规则继承检查已完成。
- [ ] 代码质量入口已按变更类型加载并记录证据：通用 React/TypeScript 规则走 Codex/Claude 全局 AGENTS/skill；FameEX 锚点规则走 `.cursor/rules/*.mdc`；`docs_tdd` 只记录加载结论、命中的项目 gate 和豁免。
- [ ] 输出质量双层门禁已过：局部实现质量（类型、边界、状态、错误处理、可测性）和整体方案质量（分层、复用、状态归属、影响半径、契约对齐）均有 review 结论；发现更简单或更贴合现有架构的方案时已调整或记录取舍。
- [ ] `02-technical-design.md` 已记录复用盘点：含跨业务 `apps/**` grep；弹窗/分享类已对照 [component-reuse-and-visual-fidelity.md](./component-reuse-and-visual-fidelity.md) §2.3。
- [ ] `02-technical-design.md` 已记录单一事实源所有权表（见 [architecture-and-state.md](./architecture-and-state.md) §4.0）：共享数据/状态/规则/配置各有一个权威写入源；消费者只读取或派生；必要副本有同步/失效、陈旧窗口、owner、恢复与验证证据。
- [ ] 请求型功能已填写数据流与分层契约表；调用链、数据链、query key、schema/DTO、mapper、UI Model、state owner 和测试可逐项追踪，无请求功能已说明真实数据来源。
- [ ] 所有新建组件/hook/service/store/utils 有不复用原因；无未说明原因的重复造轮子。
- [ ] 重要 UI（Hero/卡片/排行榜/弹窗/浮层）已完成 L2 Figma 并排走查清单，逐项 pass 或列偏差（判定见 [component-reuse-and-visual-fidelity.md §3.0](./component-reuse-and-visual-fidelity.md)；L2 默认人工、Agent 供 DOM 契约，见 [verification-division-of-labor.md](./verification-division-of-labor.md)）；未用 L1 代替 L2。
- [ ] 路由文件保持薄层。
- [ ] 组件不直接依赖 API DTO。
- [ ] API/schema/mapper 已通过 [api-and-mapper.md](./api-and-mapper.md) 对应检查，结构化例外与对账证据已记录。
- [ ] G6 已按真实 import 反查层边界：Mapper 保持纯转换；Component 不依赖 raw DTO/schema/低层 HTTP；API Service 不依赖 Feature UI；机器候选 `CODE-ARCH-003` 命中已人工确认或修复。
- [ ] Mock 生命周期已通过 [architecture-and-state.md §8](./architecture-and-state.md)；遗留路线 A 才额外执行 [mock-legacy-route-a.md](./mock-legacy-route-a.md)。
- [ ] L1/L2 代码质量 findings 已处理或登记：组件内 `fetch`、无约束 `any`、派生状态双写、散落映射/跳转动作等由全局规则、skill 或 `.cursor/rules` 审查；本清单只承接结果和证据。
- [ ] Review 已反查所有权表：无同一业务事实的多个可写副本；无只靠人工记忆同步的常量/枚举/规则/项目结论；迁移期例外已进 `06-collaboration.md` 并带到期条件和移除计划。
- [ ] 固定文案逐字核对：每条文案值 === 文案契约表「默认中文」=== PRD/Figma 原文（无意译/改写/增删标点）；已建「值 === 来源原文」字面断言测试（`it.each` + `toBe`，覆盖标题/按钮/toast/弹窗），结构断言不替代（见 [architecture-and-state.md §7.1](./architecture-and-state.md)，反面案例 PR-02022）。
- [ ] L1 结构/可维护性 findings 已处理或登记：`.tsx` 体量、活注释、关键逻辑注释、重复逻辑抽取等不在 L3 复制正文。
- [ ] loading/empty/error/disabled 完整。
- [ ] 未登录/无权限/接口失败/空数据边界覆盖。
- [ ] H5 与主题已同步考虑。
- [ ] 清空主题偏好后首次进入默认 dark。
- [ ] 用户切 light 后刷新/重进仍 light。
- [ ] Figma token 映射无硬编码绕过；可由 `tailwind-preset.js` 表达的尺寸/圆角未写成 arbitrary class。
- [ ] i18n 符合公共规则：`apps/web` 开发期只考虑中文，提测前收敛到 `zh-CN`；`apps/` 其他默认文字写死；无手动新增/复制/同步/占位其他语言目录；使用时优先静态全键 `t('ns:key')`，动态键须保留静态可 grep 前缀 + `Record` 收敛枚举。
- [ ] 触达文件已跑 Biome。
- [ ] 已跑 `verify-code-rules.mjs --project <PROJECT-ID>`（只检查新增/已改文件）；findings 已修或登记豁免。
- [ ] **G6 已跑 `/code-review` skill 审本次 diff**，`agent/code-review.json` 记录 findings、处置、证据和 review HEAD；不能只写“已 review”。
- [ ] `agent/acceptance-results.json` 覆盖每个本期 Feature，passed 有 evidence，failed/blocked 为 0。
- [ ] Browser/Playwright 验证结论已记录。
- [ ] Browser/Playwright 已真实打开页面逐项自测，报告记 URL/视口/步骤/结果。
- [ ] PRD/交互文档写「点击 X→Y」的行为，测试有实际 `browser_click` + Y 副作用验证（URL 变化/弹窗消失/toast/状态变更）；未以文案出现代替交互验证（见 [browser-e2e-mcp.md §5](./browser-e2e-mcp.md)）。
- [ ] 自测文字报告已写入项目 `evidence/`；未向 `docs_tdd/` 持久保存截图；临时截图/录屏/Playwright 图片已删。

## 6. 交付摘要

说明：改了哪些文件/模块；跑了哪些命令/验证；哪些验证因外部环境阻塞；仍待产品/设计/后端/QA 确认的事项；不贴密钥/账号/Cookie/Webhook URL/完整私有响应。

**第 1/2/3 段由机器生成，不靠 Agent 复述自己干过什么**：`docs-tdd gate <PROJECT-ID> G8 --write` 会自动跑 `render-delivery-summary.mjs`，从 `agent/gate-results.json`（命令 + 真实退出码 + 机器事实层结论）、append-only 的 `agent/gate-history.json`（各阶段 PASS 时点与证据路径）、`product/00-feature-inventory.md` 和 git diff 派生，写入 `agent/delivery-summary.machine.md`。第 4/5 段机器只给线索（生效中豁免、改动文件里的 `// ASSUMED:`、`06-collaboration.md` 悬空项、warn 级 findings、mock 残留 grep），产品/设计口径这类判断留 `<!-- 人工补充 -->` 占位，机器不代人拍板。

手动重跑：`node apps/web/docs_tdd/common/agent-scripts/render-delivery-summary.mjs --project PR-01234 --write`（不带 `--write` 只打 stdout）。

### 交付摘要模板

```text
【交付摘要】<项目名> <门禁>
1. 改动：<文件/模块列表>
2. 验证：<命令/浏览器/Playwright，或阻塞原因>
3. 功能清单：做 M / 不做 K / 延期 L（见 <PROJECT-ID>/product/00-feature-inventory.md）
4. 待确认：<产品/设计/后端/QA 仍需确认，无则「无」>
5. 残留风险：<已知问题或未覆盖场景，无则「无」>
```
