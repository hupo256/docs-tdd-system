# Feature Inventory — `PR-01930 体验金手动失效功能（重做）`

> 本轮为上一轮实现的重做。根因见 `agent/context-summary.md`：上一轮无 PRD 真图、照文字想象实现导致 UI 面目全非。本轮已用 `lark-cli docs +media-download` 落盘全部 20 个真实素材（`inbox/prd-assets/`），逐屏对齐真图。

| 字段 | 值 |
|------|-----|
| 工单 | PR-01930 |
| PRD 来源 | `inbox/lark-sync/prd-latest.extracted.md`（Lark revision 4103）+ `inbox/prd-assets/`（17 图 + 3 白板真值） |
| Figma 主画板 | 不使用 Figma；以 PRD 原型图/白板为准 |
| 清单维护人 | Agent |
| G2 确认人 & 日期 | 用户 / 2026-07-20 |
| 责任模块目录 | `apps/admin/src/apps/TrialBalanceManualInvalidate/**`, `apps/admin/src/services/api/trialBalanceManualInvalidate.ts`, `apps/admin/src/types/trialBalanceManualInvalidate.ts`, `apps/admin/src/app/[lang]/(dashboard)/(main)/(sider)/trial-balance/manual-invalidate/page.tsx`, `apps/admin/src/constants/routes.ts`, `apps/admin/src/constants/siderItems.ts`, `apps/admin/src/components/layouts/constants/contentSettings.ts`, `apps/admin/src/types/permission.ts`, `apps/admin/src/mocks/**`, `apps/web/src/apps/CashFlow/futures/**`, `apps/web/src/apps/Futures/components/FuturesOrders/FundsFlow/components/TransactionFilter.tsx`, `apps/web/src/apps/Orders/CouponRecord/**`, `apps/web/src/i18n/locales/zh-CN/assets.json` |
| visualFidelity | standard |

## 功能清单

> 本轮范围 = F01-F13 后台核心闭环（现货后台 · 福利中心-卡券记录 · 体验金手动失效管理）。F14-F16 随核心链路带前端可感知部分；F17-F24 联动流水枚举/C端 延期。

| ID | PRD 章节 | 功能简述 | 页面 / 路由 | Figma | 与主画板关系 | 本期 | 确认 | 任务 / 代码 |
|----|---------|---------|------------|-------|-------------|------|------|------------|
| F01 | 产品方案/体验金手动失效管理 | 现货后台 福利中心-卡券记录 新增「体验金管理」页面（菜单名，页面内含「手动失效」入口按钮） | 现货后台/福利中心/卡券记录/体验金管理 | 01-list-page | 独立页 | 做 | 用户 / 2026-07-20 | T01 |
| F02 | 产品方案/体验金手动失效管理 | 列表筛选：UID 精确、配置编码精确、手动失效时间区间；搜索/重置/空态 | 同 F01 | 01-list-page | 独立页 | 做 | 用户 / 2026-07-20 | T02 |
| F03 | 产品方案/体验金手动失效管理 | 列表 13 列：序号、UID、账号(phone/email脱敏)、活动名称、配置编号、体验金名称、类型、数量、失效数量、仓位占用、备注、操作人、操作时间 | 同 F01 | 01-list-page | 独立页 | 做 | 用户 / 2026-07-20 | T03 |
| F04 | 边界条件/核心计算规则 | 失效数量 8 位小数动态累计展示；仓位占用为操作时刻快照 | 同 F01 | PRD 文字 | 独立页 | 做 | 用户 / 2026-07-20 | T03 |
| F05 | 产品方案/体验金手动失效管理 | 列表按当前筛选批量导出 | 同 F01 | 01-list-page | 独立页 | 做 | 用户 / 2026-07-20 | T04 |
| F06 | 产品方案/添加页面 | 添加失效任务弹窗：UID、体验金配置编号、备注(必填)、取消/确认 | 同 F01 弹窗 | 03-add-modal | 弹窗 | 做 | 用户 / 2026-07-20 | T05 |
| F07 | 添加页面/核心输入项二选一校验 | UID 与配置编码二选一四场景：模式一(仅UID全量)/模式二(笛卡尔积)/模式三(仅编码批次全量)/双空拦截标红 | 同 F06 | 02-rule-table | 弹窗 | 做 | 用户 / 2026-07-20 | T06 |
| F08 | 添加页面/UID·配置编码录入 | 英文逗号分隔单/多值；单次 UID≤100、配置编码≤100；超限提示按 PRD 原文 | 同 F06 | 03-add-modal | 弹窗 | 做 | 用户 / 2026-07-20 | T06 |
| F09 | 添加页面/备注 | 备注必填，placeholder「请输入失效原因」，≤200 字；提交先弹二次确认，不直接执行 | 同 F06 | 03-add-modal | 弹窗 | 做 | 用户 / 2026-07-20 | T06 |
| F10 | 添加页面/批量手动失效 | 批量上传弹窗：标题「批量手动过期」、下载模板、上传模板、关闭；支持 .xlsx/.xls/.csv、≤10MB（两阶段：上传→A6a 预校验返汇总+batchId→复用二次确认→A6b 执行） | 同 F01 弹窗 | 06-batch-upload | 弹窗 | 做 | 用户 / 2026-07-20；批量两阶段化 用户 / 2026-08-07 | T07 |
| F11 | 添加页面/上传模版样式 | 模板字段 `uids`/`couponCode`/`remark`；remark 必填；uid 与 couponCode 不能同时为空；提示按 PRD 原文 | 同 F10 | 07-upload-template | 弹窗 | 做 | 用户 / 2026-07-20 | T07 |
| F12 | 添加页面/边界兜底 | UID 与配置编码去重；笛卡尔积有效配对 >10000 拦截提示拆分批次（删除线旧值 200 不采用） | 同 F06/F10 | PRD 文字 | 弹窗 | 做 | 用户 / 2026-07-20 | T06 |
| F13 | 二次确认弹窗/安全需求 | 二次风险确认：⚠️标题「确认体验金失效操作（不可逆）」+影响用户数/总金额/可用/委托冻结/仓位占用+固定提示语；点「确认失效」才执行；成功 Toast「操作成功」 | 同 F06 | 08-confirm-modal | 弹窗 | 做 | 用户 / 2026-07-20 | T08 |

## 验收标准对照（PRD §x.x）

| 验收项 | 对应 ID | 状态 |
|--------|---------|------|
| 后台按 UID / 配置编码 / UID+编码 / 批量上传 四维度发起手动失效 | F06-F13 | ☑ 已确认 |
| 二选一四场景校验（含双空拦截标红） | F07 | ☑ 已确认 |
| 二次确认展示影响用户数、总金额、可用/委托冻结/仓位占用 | F13 | ☑ 已确认 |
| 列表 13 列 + 8 位金额 + 仓位占用快照 + 失效数量动态累计 | F03-F04 | ☑ 已确认 |
| 批量上传 .xlsx/.xls/.csv ≤10MB，模板 uids/couponCode/remark | F10-F11 | ☑ 已确认 |
| 逐屏对齐 `inbox/prd-assets/` 真图 | F01/F06/F10/F13 | ☐ 待实现后走查 |

## Figma 未覆盖但 PRD 要求

| ID | 说明 | 本期是否做 |
|----|------|-----------|
| 无 | 不使用 Figma，全部以 PRD 真图/白板为真值 | — |

## Scope 裁剪记录（若有）

| PRD 条目 | 裁剪结论 | 确认人 | 日期 | 对验收标准影响 |
|---------|---------|--------|------|---------------|
| F14-F16 状态矩阵/幂等/权限点 | 前端可感知部分随核心链路带；后端逻辑本轮不涉前端落点 | 用户 | 2026-07-20 | 核心链路不受影响 |
| ~~F17-F22 后台联动流水/统计枚举~~ | **第二轮已落地**（见下「第二轮」表）：admin 体验金明细/合约账户资金流水/财务审计资金流水 + futures-admin 资产流水查询 | 用户 | 2026-07-21 | 已实现 |
| ~~F23-F24 C端 web~~ | **第二轮已落地**：web 合约账户资金流水×2拷贝 + 卡券记录（只做 web，app 不碰） | 用户 | 2026-07-21 | 已实现 |
| 落点A 数据概览-支出折合-来源明细统计 | **前置已就绪（2026-08-07）**：PR-02015 已合入当前分支，来源明细基建落在 `apps/admin/legacy-admin/src/views/userManager/other_information/data_overview/index.vue`（来源标签走 `src/mixin/dictionary/index.js` 的 `contractBusinessTypeList` code→label 映射）。补法=向 `contractBusinessTypeList` 加一条 label「体验金手动失效」。**卡点**：该条 businessType code 未知占位，塞猜值有撞码错标真实资金数据风险，故用户拍板**等后端 code 到位再补一行**（2026-08-07） | 用户 | 2026-08-07 | 不影响本期其余落点 |
| C 端 app | 延期（只做 web，app 为独立 RN 仓库） | 用户 | 2026-07-21 | 本轮不做 |

## 第二轮功能清单（流水枚举注入 · 系统回收/手动失效）

> 范围经用户确认 = PRD「本期包含」剩余全量（除落点A）/ 只做 web / MSW 占位路线 B。
> 文案口径（用户拍板）：后台记「手动失效（体验金）」；C 端**卡券记录「说明」列**记「系统回收」，**C 端合约资金流水类型**记「系统回收（体验金）」（PRD 本期包含表逐字，2026-08-07 修正，原先笼统写「系统回收」漏了限定词）；图中「系统失效」统一按对应场景处理。
> ⚠️ 各端新增流水 type code 为**占位值**（admin trialFundFlow=114 / financeAudit businessType=34 / TradingOrderType=manual_invalidate_trial / futures-admin UserOrderTypeCode=manual_invalidate_trial / web fund flow=114），真实 code 待后端销账，ready 后改常量对账。

| ID | 端 | PRD 本期包含 | 文件 | 枚举形态 | 状态 | 契约测试 |
|----|----|-------------|------|---------|------|---------|
| F17 | admin | 体验金流水明细 新增【手动失效】 | `constants/trialBalance.ts` `trialFundFlowTypes` +1行 | 常量数组+派生Record+resolver | ☑ | `manualInvalidateEnum.contract.test.ts` |
| F18 | admin | 合约账户-资金流水 新增【手动失效（体验金）】 | `services/api/order.ts` enum + `UsersAssetsWalletTrading/utils/{useUserOrderTypeOptions,useTableColumns}` | TS enum + 内联简体硬编码 | ☑ | 同上 |
| F19 | admin | 财务审计-资金流水 新增【手动失效（体验金）】+筛选【体验金系统回收】 | `services/api/financeAudit.ts` `contractBusinessTypes`+导出占位常量 + `FinanceAuditAssetsFlow/utils/useColumns.tsx` 列渲染硬编码兜底 | 常量数组 + 列渲染硬编码（不走 i18n） | ☑ | 同上 |
| F20 | futures-admin | 合约后台 资产-流水查询 新增类型+筛选 | `types/order.ts` enum + `UsersAssetsWallet/utils/{useUserOrderTypeOptions,useTableColumns}` | TS enum + 内联简体硬编码（去 t()） | ☑ | `userOrderTypeEnum.contract.test.ts` |
| F21 | web | 资产-合约账户-资金流水 新增【系统回收（体验金）】 | `apps/CashFlow/futures/FuturesCashFlow.tsx` `typeItems` +1项 + `i18n/zh-CN/assets.json` `FuturesCashFlow.trial114` | 常量`{key,label}[]` + i18n | ☑ | `futuresCashFlowEnum.contract.test.ts` |
| F22 | web | 合约交易-交易记录-资金流水 新增【系统回收（体验金）】 | `apps/Futures/components/FuturesOrders/FundsFlow/components/TransactionFilter.tsx` `typeList` +1项（第二份拷贝，共用 assets json） | 同上 | ☑ | 同上 |
| F23 | web | 福利中心-卡券记录 类型=过期/说明=系统回收 | 「说明」列已直出 `record.description`、类型列已含 EXPIRE | **前端零改动**（后端 description 返回「系统回收」即达标） | ☑ 仅契约测试 | `couponRecordEnum.contract.test.ts` |

### 第二轮验证结论

- 契约测试全绿：admin `manualInvalidateEnum.contract.test.ts` 8 · futures-admin `userOrderTypeEnum.contract.test.ts` 4 · web 7（futuresCashFlow 3 + couponRecord 4）。
- 断言覆盖：新类型存在性 + 文案字面（`值===原文`，禁意译，后台简体）+ 占位 code + 后台不落 i18n key（撤回校验）+ 两份 web 拷贝同步 + 卡券零改动路径不破坏。
- tsc：三端改动文件均干净（仓库既有 type 错误与本 PR 无关）。
- MSW handler：本轮 8 落点均为纯前端枚举/展示注入（下拉选项 + label 映射），不新增 API 调用（列表仍走既有接口，新类型只是数据里多一个 type 值），故无需新增 handler；契约测试已锁 schema/文案。**MSW 为本项目唯一 mock 策略**。
- i18n 口径（用户 / 2026-07-21）：admin/futures-admin 后台文案简体硬编码进组件，不走/不补 .json；国际化只在 web（本地只写 zh-CN）。已撤回上轮误加的 admin `financeAudit.json`、futures `zh-TW/order.json` key。
- 待后端销账：各端真实 type code；卡券「系统回收」走 description 直出 vs 新 recordType；落点A（用户详情页 合约账户历史支出折合(USDT) 来源明细）待 PR-02015 上线后补开发。

## TDD / PRD 冲突（若有）

| 项 | PRD | TDD | 结论 |
|----|-----|-----|------|
| 批量上传弹窗标题 | 文字「批量手动过期」 vs 原型图「批量发放」 | — | 已确认：用「批量手动过期」（原型图为复用他处截图） |
| 笛卡尔积配对上限 | 删除线 200 → 10000 | — | 已确认：用 10000 |
| 主题色 | 原型图蓝色 | admin 全局紫色 #722ED1 | 已确认：跟随后台紫色 |
| 网关 | — | 现货后台体验金核心走 getUrl operate-api | 已确认：getUrl /operate-api/trialFee/...，非合约网关 |

## PRD 未完全可读内容

| 类型 | 位置 | 影响 | 处理方式 | 状态 |
|------|------|------|----------|------|
| 图片/白板 | PRD 全部 UI 真值 | 上一轮缺失导致返工 | 已用 lark-cli 落盘 17 图 + 3 白板到 `inbox/prd-assets/` | 已处理 |
| 引用文档 | PR-01524 导出规则、PR-02015 流水新增、业务-数据组对照表 | 导出/流水枚举口径 | 不阻塞本轮核心页；接口联调时对账 | 已确认 |
