# Collaboration — PR-01947

> G2 待确认清单。规则：../../common/rules/prd-feature-inventory.md、new-project-kickoff.md §4。

## A. Scope 待确认（G2 定稿前必须回）

> **G2 结论（用户 2026-07-08 口头确认）**：S1/S2 按 PRD 删除线不做；**S3 后台字段本期由 web 团队做**（scope 扩大，N04 → 本期做，落点见下）；视觉走「原型+复用现有组件先搭」；编码走「先搭 UI+Mock，后端就绪再对账」。

| # | 问题 | 影响 | 依据 | 结论 | 状态 |
|---|------|------|------|------|------|
| S1 | 滑点（7.2）本期不做、拆到 PR-2069？ | F/N 清单、10.1 验收 | 全篇删除线 + 7.2 标题「单独拆需求」 | **不做**（拆 PR-2069） | ✅ 已确认 |
| S2 | 通知消息（八）+ 埋点（九）本期不做/延期？ | N02/N03 | 「八」删除线「列单独一个需求」；「九」「// 后期」 | 通知**另立需求**、埋点**延期** | ✅ 已确认 |
| S3 | 7.9 + 10.6 管理后台字段本期是否由 web 团队做？ | N04 归属 | 用户确认 | **本期做**（后台字段+导出，落点=`apps/futures-admin/legacy-admin` KolListPanel.vue，agent 07-08 探查确认） | ✅ 已确认（scope 扩大） |
| S4 | 本 PR 仅 apps/web 前台？App 端并行？ | 工作量边界 | PRD 4.3 | 前台 apps/web + 后台管理页；App 端客户端团队并行 | ✅ 已确认 |

## B. 需求细节待确认（影响实现，可 G3 前回）

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| Q1 | **正式设计稿**：PRD 7.1 仍空，但三期正式稿已到位（`KzvWxAYxqfgpoiYuKdxMAE` / canvas `15089:25043`，见 `07-figma-spec.md`）。L2 基线改用正式稿，非旧原型 8411-1559。 | L2 视觉验收基线 | ✅ 2026-07-13 定稿 |
| Q2 | **Figma 读取**（2026-07-14 更新）：智能比例 Tab 原子节点 Dev Mode 已读并落 `07-figma-spec.md` §3–§5；证据 `evidence/ui-ux/2026-07-14/`。待补：深色模式 hex、Select 选项行、390px Frame。 | G1 Figma 落盘、JF1 编码 | **大部分完成**（智能比例范围） |
| Q3 | ~~**「有跟随持仓禁改」判据**~~ | F03/F09 禁用逻辑 | **✅ 2026-07-21 定案**：禁改改由后端在提交时校验并返回失败原因，前端不自判；`hasFollowPosition` 字段与前端 disabled 判据/文案已删 |
| Q4 | **复制模式字段**：现 `isCopyPos`(1/0 布尔) → 三态 `copyPositionMode`(1/2/3)。后端是替换旧字段还是新增并存？旧「复制全部仓位」= 新「复制所有持仓」？ | F10-F12 + 兼容 | ✅ 已定案（两字段并存）：回填 `copyPositionMode` 优先、`isCopyPos` 兜底（1→All / 其他→None），与 YApi 5713 一致（G5 2026-07-21）；提交侧 `resolveIsCopyPos` 由三态反推旧字段 |
| Q5 | **杠杆范围/步长来源**：PRD 7.4.3「后台配置」「步长跟随合约杠杆」。before_follow 的 followSetting 新增 leverageMin/Max/Step？还是取该币对合约杠杆配置接口？（Futures 有 user-config nowLevel/minLevel/maxLevel） | F06/F07 滑块 | ✅ 已定案（2026-07-10 需求变更）：前端硬编码 1–20x、步长 1，后端无需下发（F07 证伪，03 §4） |
| Q6 | **保证金模式默认值**：10.2「默认与交易员一致」，但 7.3 UI 未写默认。默认取交易员当前保证金模式（需接口给）还是固定全仓/逐仓？ | F01 默认 | ✅ 已落码：默认「跟随交易员」= `MarginSettingMode.FollowTrader`（`FOLLOW_PARAMS_DEFAULTS`，即 PRD「与交易员一致」），编辑态按 `myFollowSetting.marginMode` 回填；含在 2026-07-21 L2 走查范围 |
| Q7 | **杠杆「跟随交易员」显示**：跟随模式下是否需展示交易员当前杠杆值（只读）？before_follow 是否返回交易员杠杆？ | F05 展示 | ✅ 已落码：跟随模式仅展示文案「跟随交易员」+ 辅助说明（`followTraderLeverageTips`），不展示交易员杠杆数值（与正式稿一致）；含在 2026-07-21 L2 走查范围 |
| Q8 | **7.10 优化一落点**：「跟单后复制全部仓位」字段取值改为「选中币对下带单仓位数」——图中「区域一/区域二」具体指哪个页面控件？需看图确认。 | F15 | 待读图（F15 已落码接 `lead_position_count`，仅余本项） |

## C. 已读 PRD 富媒体检查（new-project-kickoff §4）

| 内容 | 类型 | 是否可读 | 处理 |
|------|------|---------|------|
| 7.3.3/7.4.3/7.5.2/7.7/7.10 UI 截图 | 图片（Lark drive 授权 URL） | alt 有描述；**2026-07-24 验证：重新同步后 authcode 图片可下载，像素可读**（authcode 约 9 天过期，需重新同步刷新） | 以 Figma 原型为准，见 Q1/Q2 |
| 保证金三层隔离 ASCII 图 | 代码块 | ✅ 可读 | 后端逻辑，前端不实现 |
| 杠杆钳制/复制执行流程 ASCII | 代码块 | ✅ 可读 | 后端逻辑，前端传参 |
| 滑点相关全部 | 删除线 `~~~~` | ✅ 识别为删除 | 不生成开发项（S1） |
| 「八 通知」标题 | 删除线 | ✅ | 不做（S2） |

## D. G2 已定决策（2026-07-08 用户确认）

1. **端**：apps/web 前台（跟单设置）+ 合约管理后台字段展示（F19-F21）；滑点/通知/埋点不做；App 端客户端团队并行。
2. **前端职责**：只做参数 UI + 传参 + 展示合约失败原因，业务判定全在后端（PRD 7.4.5 明示）。
3. **复用**：保证金复用 Futures `MarginModeEnum` + 受控化 UI；杠杆滑块复用 `@fameex/ui` Slider；确认弹窗/开通合约弹窗复用现有组件。
4. **视觉（Q1）**：正式三期稿 `KzvWxAYxqfgpoiYuKdxMAE` 已落 `07-figma-spec.md` 为 L2 基线；G4 先用标准组件搭通逻辑，JF1 按正式稿校准（Select/行内 Radio/Switch 范式，见 §10 差异表）。
5. **编码节奏（G3/Q3-Q7）**：历史上先搭 UI + Mock（Mock 走与真实 API 相同 schema/mapper），后端就绪再字段对账、mock 零残留；**当前 PR-01947 已切真实 dev API，MSW handler 仅保留过往试点结论，不再作为现状。** 契约字段名先按 02 §3 建议名建 schema。
6. **Q2 待补**：`07-figma-spec.md` §12 列出的原子节点 `get_design_context` + 颜色 token，MCP 配额恢复后销账。

## E. 通知能力决策

| 能力 | 本期 | 说明 |
|------|------|------|
| 主动发群消息 | 未启用（用户未提供配置） | 需要则补 notify-lark.mjs 薄包装 |
| 群内 @ 自动任务 | 未启用 | — |

## F. Code Review 结果与处置（G6，2026-07-09）

> 本轮前台编码（G4）+ MSW 试点的自查与门禁复核记录。

| 检查项 | 工具/方式 | 结果 | 处置 |
|--------|----------|------|------|
| 静态规则 | `verify-code-rules.mjs --project PR-01947` | OK，0 finding（globalScan） | 无需处置 |
| 类型安全 | 本轮 31 改动文件 `tsc --noEmit` | 0 error（仓库遗留 error 与本 PR 无关） | 无需处置 |
| 复用门禁（§2） | 人工核对：三表单是否复制粘贴三参数控件 | 已抽 `FollowParams/` 共享 hook+子组件 | 通过 |
| Mock 隔离（§8.4） | `rg USE_MOCK\|@mock-only\|isMock` | 空，业务码零 mock 耦合 | 通过 |
| 契约同源 | `copyTradingFollow.contract.test.ts` | 3/3，mock ↔ schema 对账绿 | 通过 |
| 单元测试 | clampLeverage 7 + useFollowParams 7 + contract 3 | 17/17 | 通过 |

**Finding 处置**：本轮自查/门禁无 blocking finding。ASSUMED 字段（§8.0.2）为无后端文档起步的预期状态，非 finding，待 G5 逐条对账销账（见 03-api-contract §6）。

**待人工 review**：视觉/手感（正式稿 `15102:29220` / `37781` / `38818` 并排、Select/Switch 交互、390px），按「验证分工」由人工执行。

## E. 环境发布核验（2026-08-01）

- 已确认关键提交存在于 `origin/dev` / `origin/test`，但不存在于 `origin/pre` / `origin/online`。
- 此前记录中的 `deploy`、节点部署、dev 接口联调和提测均不等于生产上线。
- 发布状态唯一证据见 `evidence/release/2026-08-01/README.md`；生产关闭项目必须再提供 `online` 合入提交或等价 patch 证据。
