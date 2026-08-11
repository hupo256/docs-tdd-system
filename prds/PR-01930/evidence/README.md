# PR-01930 交付证据 — G6 自测交付（第一轮 F01-F13 + 第二轮 F17-F23）

> 记录时间：2026-07-27。验证方式按「验证分工」：Agent 跑逻辑/边界/契约（Vitest + type-check + verify-code-rules），人工待补视觉/手感走查。

## 1. 代码进度

| 轮次 | 范围 | 模块 | 文件 |
|------|------|------|------|
| 第一轮 | F01-F13 后台核心闭环 | 页面/弹窗/批量上传/二次确认 | `apps/admin/src/apps/TrialBalanceManualInvalidate/**` |
| 第一轮 | MSW 路线 B 占位 | list/add/batch handler | `apps/admin/src/mocks/**` |
| 第二轮 | F17-F19 现货后台流水枚举 | 体验金流水明细/合约账户资金流水/财务审计 | `apps/admin/src/constants/trialBalance.ts`, `services/api/order.ts`, `services/api/financeAudit.ts`, `UsersAssetsWalletTrading/utils/**`, `FinanceAuditAssetsFlow/utils/useColumns.tsx` |
| 第二轮 | F20 合约后台流水枚举 | 资产-流水查询 | `apps/futures-admin/src/types/order.ts`, `UsersAssetsWallet/utils/{useUserOrderTypeOptions,useTableColumns}` |
| 第二轮 | F21-F22 C端 web 流水枚举 | 合约资金流水/交易记录资金流水 | `apps/web/src/apps/CashFlow/futures/FuturesCashFlow.tsx`, `apps/Futures/components/FuturesOrders/FundsFlow/components/TransactionFilter.tsx`, `i18n/locales/zh-CN/assets.json` |
| 第二轮 | F23 C端 web 卡券记录 | 零前端改动，仅补契约测试锁 schema | `apps/web/src/apps/Orders/CouponRecord/couponRecordEnum.contract.test.ts` |

## 2. 单元测试

| 应用 | 测试文件 | 结果 |
|------|---------|------|
| admin | `manualInvalidateContract.test.ts` | ✅ 3/3 |
| admin | `manualInvalidateRules.test.ts` | ✅ 18/18 |
| admin | `manualInvalidateEnum.contract.test.ts` | ✅ 8/8 |
| futures-admin | `userOrderTypeEnum.contract.test.ts` | ✅ 4/4 |
| web | `futuresCashFlowEnum.contract.test.ts` | ✅ 3/3 |
| web | `couponRecordEnum.contract.test.ts` | ✅ 4/4 |

命令：
```bash
pnpm --filter @fameex/admin exec vitest run src/apps/TrialBalanceManualInvalidate
pnpm --filter @fameex/futures-admin exec vitest run src/apps/UsersAssetsWallet/utils/userOrderTypeEnum.contract.test.ts
pnpm exec vitest run apps/web/src/apps/CashFlow/futures/futuresCashFlowEnum.contract.test.ts apps/web/src/apps/Orders/CouponRecord/couponRecordEnum.contract.test.ts
```
共 40 例全绿。

## 3. Gate 结果

| 命令 | 目标 | 结果 |
|------|------|------|
| `verify-code-rules.mjs --project PR-01930` | 46 个改动文件 | exit 0；7 条 WARN（CODE-ARCH-002 if 分支收敛建议 ×5、CODE-ARCH-003 组件直连低层 API ×2），无 FAIL |
| `verify-project-gate.mjs PR-01930 G6` | 文档 + 代码门禁 | PASS 41/43（2 条 WARN，见 §5） |
| `verify-project-gate.mjs PR-01930 G8 --write` | 历史旧门禁 | 2026-08-01 审计确认该结果缺少 G5/G6/G7 持久化前置链且存在 G8 读取旧 G8 JSON 自证问题，已撤销其阶段效力 |
| `tsc --noEmit`（admin） | 责任模块目录内文件 | 0 error（仓库基线 ~193 既存错误与本 PR 无关，见 §4） |
| `tsc --noEmit`（futures-admin） | 责任模块目录内文件 | 0 error |
| `tsc --noEmit`（web） | 责任模块目录内文件 | 0 error |

Biome：本仓库未配置 Biome，回退为 `verify-code-rules.mjs` globalScan + 上述 `tsc --noEmit` 三端逐一核对，作为文档化替代（见 03-api-contract / rule-router 未强制 Biome）。

## 4. type-check 基线债说明

`tsc --noEmit` 在三端各自跑出若干既存错误（如 `apps/admin/src/utils/outExcel`、`packages/be-shared/**`、`packages/utils/csc-fetcher`、`apps/futures-admin/src/apps/UsersAssetsWallet/utils/useCryptoNameOptions.ts`），逐一核对均落在本 PR 责任模块目录之外、且 `git diff origin/online...HEAD` 确认未被本 PR 改动，判定为既存基线债（同 PR-02074 tsc 基线债口径），不阻塞本轮交付。

## 5. 责任目录外改动确认（CODE-SCOPE-001 warn，§1.1）

首次跑 G6 gate 时提示 4 个 web 文件落在责任模块目录外，核实为第二轮 F21-F23 已在 `agent/context-summary.md` 记录落点、但未同步进 `00-feature-inventory.md` 的 `责任模块目录` 字段（gate 脚本只读该精确字段名）。已补齐字段，覆盖第二轮 web/futures-admin 落点。补齐后 gate 仍对这 4 个文件报 WARN——核查脚本 `verify-project-gate.mjs` 的 `modulePaths` 解析只 `trim()` + 去掉尾部 `/**`，未 strip markdown 反引号，故字段值里带反引号的路径永远无法与裸文件路径前缀匹配（此限制对第一轮 admin 路径同样存在，只是脚本的越界扫描正则只覆盖 `apps/web/src`/`packages`，从未触发过）。这是脚本已知局限、非本 PR 引入，warn 不阻断，`00-feature-inventory.md` 的字段已如实覆盖两轮全部落点，判定为非越界改动。

## 6. lockfile 卫生修复

提交 `ed38cb7815 feat: add files by opus` 曾把 `pnpm-lock.yaml` 整体重写（+12121/-19733 行），系本地 pnpm 环境差异导致的整体重排，非本 PR 真实依赖变化。已还原至该提交前基线并重跑 `pnpm install`，最终仅新增 `msw@^2.15.0`（admin devDependencies）一个真实增量，diff 收敛至 56 行（均为 registry 元数据/peer-dep 重新解析的无害噪音）。

## 7. 人工待验（不阻塞代码门禁）

> ✅ 已过一轮走查（2026-07-29）：13 列列表 / 8 位金额 / 批量上传弹窗「批量手动过期」/ 二次确认弹窗「确认体验金失效操作（不可逆）」/ 主题紫色对齐；R1 二次确认取消返回回填回归通过；MSW mock 列表数据正常渲染；各端第二轮枚举下拉/列文案出现「手动失效（体验金）」/「系统回收（体验金）」。
> ⏸ 待后端真实接口 ready 后需再走一轮 check（关闭 MSW 走真实路径 + 见 §8 对账项）。

- 视觉/手感：13 列列表、8 位金额格式、批量上传弹窗、二次确认弹窗逐屏对齐 `inbox/prd-assets/` 真图
- MSW mock 数据渲染：`http://localhost:3001/zh-CN/trial-balance/manual-invalidate` 列表 5 条数据是否正常显示（`agent/handoff-msw-debug.md` 交接问题的最终确认）

## 8. 待后端销账（阻塞 G5）

> 2026-08-01 流程审计更正：以下事项会阻塞 G5，完成真实 API 对账前不得进入 G6/G7/G8；“不阻塞前端交付”的旧结论作废。

- 各端占位 type code：admin `114/34`、futures-admin `manual_invalidate_trial`、web `114`
- 卡券「系统回收」走 `description` vs 新 `recordType` 未定
- 落点A（数据概览-支出折合-来源明细）已定位页面：「用户管理-用户管理」用户详情页「合约账户」分组「历史收入/支出折合(USDT)」下的「来源」展开区块（用户 2026-07-29 截图确认），依赖 PR-02015（未上线），上线后补【系统回收】类型

## 9. /review 代码评审（2026-07-29 实跑）

对本地 diff（`feature/PR-01930` vs `origin/online`，46 改动文件）实跑 `/review`，审 correctness + reuse/simplification/efficiency（此前 gate 只标 PASS 未真跑，本次补齐）。

核查通过项：
- `numberRender(空)`→`--`（`utils/table.tsx:88` 对 undefined/NaN 返回 emptyText），列表金额缺失不假造 0；
- `useTableStore.refetch()` set `needToRefetch`，`SearchTable` 订阅生效，执行成功后列表刷新链路正确；
- `searchFetchV2` 取 `data.pageInfo.rows` 逐行套 `manualInvalidateRowSchema`（与 account.ts 同款），MSW handler 响应体 `{code,msg,data:{pageInfo}}` 对齐；
- admin `useTableColumns` 新增枚举分支后 `const never: never` 穷尽未破坏（tsc 绿）。

Findings（详见 `product/06-collaboration.md` Findings 表）：
- **R1 中**：`index.tsx` 二次确认「取消」回退添加弹窗，但添加弹窗已随打开二次确认被 `destroyOnClose` 销毁，UID/配置编码/备注丢失需重填 → ✅ 已修（2026-07-29）：新增 `AddInvalidateModal` 可选 `defaultValues`，从父级缓存 `payload` 反解回填 Form `initialValues`；父级区分「全新打开」`handleOpenAdd`（清缓存）/「放弃」`handleAddCancel`（清缓存）/「二次确认取消返回」`handleConfirmCancel`（保留回填）。tsc 绿 + 29 例测试全绿。
- **R2 低**：`trialBalanceManualInvalidate.ts#downloadBlobByGet` 与 `userMassManage.ts#downloadExportFile` 逻辑重叠（差异仅 GET/POST）→ 可延后抽公共核心。

占位 type code（114/34/manual_invalidate_trial）为已登记的待后端销账项，非评审缺陷。

## 10. PRD 漂移核查（2026-08-11）

用 `lark-cli docs +fetch --doc-format markdown` 直接拉取 Lark 源文档（`https://qfglxo2m3dc.sg.larksuite.com/docx/IpS2dJ4f1oPF4DxcKkKl5SFpgKc`）最新版本，与本地快照 `inbox/lark-sync/prd-latest.extracted.md` 逐行比对（去除图片签名 token 噪音后比对纯文本，257 行 vs 257 行）。

结论：**正文无实质改动**。本期包含表（125-137 行）、落点A 描述（261-275 行）、F17-F23 各端流水枚举描述逐字一致；唯一差异是标题从「体验金手动失效功能」加了项目编号前缀变为「【PR-01930】体验金手动失效功能」（PM 归档标记，非需求变更），其余差异均为图片下载链接的签名 token 重签（同一张图每次拉取签名不同，非内容变化）。代码无需同步更新。
