# Frontend Tasks — PR-01930 体验金手动失效功能（重做）

> **范围裁决以 `00-feature-inventory.md` 为准**；本表只列在范围内 F-id 的任务与执行进度，被划删/延后项（如 F18/F20）不在此列，其裁剪记录见 `00` 的 Scope 裁剪记录。

## 第二轮任务清单（F17-F23 流水枚举注入 · 已落码 + 契约测试全绿）

| ID | 功能 ID | 落点 | 改动 | 状态 | 验收证据 |
|----|---------|------|------|------|----------|
| T09 | F17 | 现货后台 体验金流水明细 | `constants/trialBalance.ts` 数组 +「手动失效（体验金）」code 114（自动联动下拉+map+resolver） | ✅ 已落 | `manualInvalidateEnum.contract.test.ts` |
| T11 | F19 | 现货后台 财务审计-资金流水 新增【系统回收（体验金）】+筛选【体验金系统回收】（PRD 7.1.7） | `constants/financeAuditBusinessType.ts`（内容单一源+纯resolver，businessType=34）+ `services/api/financeAudit.ts` `contractBusinessTypes` 新增筛选项 + `FinanceAuditAssetsFlow/utils/useColumns.tsx` 列渲染走 resolver（不依赖 i18n key） | ✅ 已落（businessType=34 数仓 2026-08-22 确认） | `financeAuditBusinessType.contract.test.ts`（8例锁字面） |
| T13 | F21-F22 | C 端 web 合约资金流水/交易记录 | `FuturesCashFlow.tsx` + `TransactionFilter.tsx` 两份拷贝同步 `trial114`=「系统回收」 | ✅ 已落 | `futuresCashFlowEnum.contract.test.ts` |
| T14 | F23 | C 端 web 卡券记录 | 零前端改动（说明列已直出 `description`），仅补契约测试锁 schema | ✅ 已落 | `couponRecordEnum.contract.test.ts` |

### 第二轮 code 销账进展（更新 2026-08-22）

- admin trialFundFlow=114（Rullin 确认）、web fund flow=114（确认）、**financeAudit businessType=34（数仓 2026-08-22 确认，已落码）** 均已销账。
- 卡券「系统回收」走 `description` 直出 vs 新 recordType。
- 落点A「支出折合-来源明细」统计页在 admin 代码库找不到，待后端给 route/截图或确认属别 app。
- F18/F20 随 PRD 划删移出范围、前端零改动/已回退，不再销账；裁剪记录见 `00-feature-inventory.md`。

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
