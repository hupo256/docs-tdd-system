# Frontend Tasks — PR-01930 体验金手动失效功能（重做）

> **状态 SSOT**：各 F-item 的「做/移出范围/延后」以 `00-feature-inventory.md` 为单一真相源；本表与之冲突时以 SSOT 为准（`check-scope-consistency.mjs` 拦截「SSOT 已划删、他处仍标已做」的漂移）。

## 第二轮任务清单（F17-F23 流水枚举注入 · 已落码 + 契约测试全绿）

| ID | 功能 ID | 落点 | 改动 | 状态 | 验收证据 |
|----|---------|------|------|------|----------|
| T09 | F17 | 现货后台 体验金流水明细 | `constants/trialBalance.ts` 数组 +「手动失效（体验金）」code 114（自动联动下拉+map+resolver） | ✅ 已落 | `manualInvalidateEnum.contract.test.ts` |
| T10 | F18 | 现货后台 合约账户资金流水 | `services/api/order.ts` enum + `UsersAssetsWalletTrading/utils/{useUserOrderTypeOptions,useTableColumns}`（**简体硬编码**，含无跳转分支） | ✅ 已落 | 同上 |
| T11 | F19 | 现货后台 财务审计 | `services/api/financeAudit.ts` `contractBusinessTypes` +34 + 导出占位常量；`FinanceAuditAssetsFlow/utils/useColumns.tsx` 列渲染对 value=34 **简体硬编码**兜底（不再依赖 `businessType-34` i18n key） | ✅ 已落 | 同上 |
| ~~T12~~ | ~~F20~~ | 合约后台 7.1.8 资产-流水查询 | ~~`types/order.ts` enum + `UsersAssetsWallet/utils/{useUserOrderTypeOptions,useTableColumns}`~~ | ✂ 移出范围 | 2026-08-18 PRD 7.1.8 整段划删；3 源文件 `git checkout origin/online` 回退 + 删 `userOrderTypeEnum.contract.test.ts`；2026-08-22 Rullin 话题内再确认不做（`/fe-coadmin-api/transaction_list`） |
| T13 | F21-F22 | C 端 web 合约资金流水/交易记录 | `FuturesCashFlow.tsx` + `TransactionFilter.tsx` 两份拷贝同步 `trial114`=「系统回收」 | ✅ 已落 | `futuresCashFlowEnum.contract.test.ts` |
| T14 | F23 | C 端 web 卡券记录 | 零前端改动（说明列已直出 `description`），仅补契约测试锁 schema | ✅ 已落 | `couponRecordEnum.contract.test.ts` |

### 第二轮待后端销账

- 各端真实 type code（现全用占位：admin trialFundFlow=114、financeAudit businessType=34、TradingOrderType=`manual_invalidate_trial`、web fund flow=114）。（futures-admin `UserOrderTypeCode` 随 F20 移出范围已回退，不再销账。）
- 卡券「系统回收」走 `description` 直出 vs 新 recordType。
- 落点A「支出折合-来源明细」统计页在 admin 代码库找不到，待后端给 route/截图或确认属别 app。

> i18n 口径（用户 / 2026-07-21）：admin / futures-admin 后台文案一律**简体硬编码进组件**，不走 `.json`、不补 i18n key；国际化只在 `apps/web` 做（本地只写 zh-CN）。故后台侧无「其他语种文案交别团队」项。

## 第一轮任务清单（F01-F13 后台核心闭环）

| ID | 功能 ID | 任务 | 状态 | 验收证据 |
|----|---------|------|------|----------|
| T01 | F01 | 页面壳 + 路由/菜单/权限/contentSettings 注册五件套（现货后台 福利中心-卡券记录 体验金手动失效管理） | 待做 | 逐屏对齐 01-list-page；入口 Browser 走查 |
| T02 | F02 | 列表筛选：UID、配置编码、手动失效时间区间、搜索、重置、空态 | 待做 | SearchForm + SearchTable；请求参数走查 |
| T03 | F01 | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 待做 | src/mocks handlers + *.contract.test + useMockWorker dev-only |
| T03b | F03-F04 | 列表 13 列 + 8 位金额纯函数 + 仓位占用快照 + 失效数量动态累计展示 | 待做 | columns 对齐 01-list-page；字段待真实 API 对账 |
| T04 | F05 | 按当前筛选批量导出（复用 downloadExportFileByGet 模式） | 待做 | 导出请求参数走查；PR-01524 规则接口 ready 后对账 |
| T05 | F06 | 添加失效任务弹窗基础结构：UID、配置编号、备注、取消/确认 | 待做 | 对齐 03-add-modal |
| T06 | F07-F09/F12/F08 | 手输校验：二选一四场景、单项 100 上限、去重、笛卡尔积 10000 上限、备注必填/200 字 | 待做 | 纯函数 `manualInvalidateRules.test.ts` 覆盖 |
| T07 | F10-F11 | 批量上传弹窗（标题「批量手动过期」，单阶段直接上传）+ 下载模板；字段 uids/couponCode/remark | 待做 | 对齐 06-batch-upload / 07-upload-template；文件内容校验交后端 |
| T08 | F13 | 预校验 + 二次确认弹窗（影响用户数/总额/可用/委托冻结/仓位占用 + 固定提示语），确认后执行 + 成功 Toast | 待做 | 对齐 08-confirm-modal；requestId 幂等 |

## 实现检查

- [ ] 状态/文案/class/action 映射收敛到 map/resolver。
- [ ] 可由 tailwind-preset 表达的尺寸/间距不写 arbitrary class。
- [ ] API DTO 经 schema/mapper，不直接进组件展示层。
- [ ] loading/empty/error/disabled/无权限 主链路覆盖。
- [ ] 固定中文文案逐字 copy PRD 原文，禁意译。
- [ ] 高风险失效必须先预校验再二次确认，不允许主按钮直接执行。
- [ ] 逐屏对齐 `inbox/prd-assets/` 真图（不以 gate 绿代替视觉验收）。
- [ ] 不超界：第一轮只碰责任模块白名单文件；第二轮流水枚举注入按 T09-T14 落点白名单改动（合约后台流水查询、C 端 web 属第二轮已授权范围，仍不碰 C 端 app）。
