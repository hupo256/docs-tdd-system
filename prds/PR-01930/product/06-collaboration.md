# Collaboration — PR-01930 体验金手动失效功能（重做）

## 待确认 / 已确认

| 时间 | 问题 | 责任人 | 状态 |
|------|------|--------|------|
| 2026-07-20 | 本轮范围 | 用户 | 已确认：只做 F01-F13 后台核心闭环；F17-F24 延期 |
| 2026-07-20 | 批量上传弹窗标题冲突（文字「批量手动过期」vs 原型「批量发放」）| 用户 | 已确认：用「批量手动过期」 |
| 2026-07-20 | 笛卡尔积上限（删除线 200→10000）| 用户 | 已确认：10000 |
| 2026-07-20 | 主题色（原型蓝 vs admin 紫 #722ED1）| 用户 | 已确认：跟随后台紫色 |
| 2026-07-20 | 网关归属 | 用户 | 已确认：体验金手动失效属现货后台，走 getUrl operate-api，非合约网关 |
| 2026-07-20 | 批量上传形态 | 用户 | 已确认：单阶段直接上传（文件内容校验交后端）|
| 2026-07-20 | API/YApi/Swagger 未 ready | 用户 | 已确认：**API 未 ready 时的 MSW 路线 B 落地清单**（见 03-api-contract §6.1）|

## MSW 路线 B 决策记录

新功能 mock 强制走 **MSW 路线 B**（`src/mocks/handlers`），dev-only 注册（仅 `NODE_ENV==='development'`，无 `NEXT_PUBLIC` 开关，对齐 PR-01947 先例），production service 零 mock 分支。真实接口 ready 后删/清 handler 即切真实路径，业务代码 0 改动。若主仓 admin 无 MSW 基建则新建 dev-only 基建（browser/handlers/fixtures/useMockWorker + public worker）。

## 改动边界 / 影响面（不得超界）

| 文件 / 模块 | 类型 | 必要性 | 处理 |
|-------------|------|--------|------|
| `constants/routes.ts` | admin 全局路由契约 | 新增 `/trial-balance/manual-invalidate` | 仅追加 key |
| `constants/siderItems.ts` | admin 菜单/权限契约 | 福利中心-卡券记录新增入口 + 权限点 | 仅追加菜单项 |
| `components/layouts/constants/contentSettings.ts` | content 映射 | 识别新页面 | 仅追加 |
| `components/ImportModal/index.tsx`（可选）| 公共上传弹窗 | title 定制 | 只加可选 prop 默认「导入」，或本功能包一层 |

**红线**：本轮不碰合约后台 7.1.8 资产-流水查询、不碰 C 端 7.1.9、不改其他体验金既有页。

## Code Review

| 时间 | 命令 | 状态 |
|------|------|------|
| 2026-07-29 | `/review`（本地 diff：`feature/PR-01930` vs `origin/online`，46 改动文件，correctness + reuse/simplification/efficiency）| 已执行，2 finding 登记如下 |

### Findings（2026-07-29）

| # | 级别 | 位置 | 结论 | 处理 |
|---|------|------|------|------|
| R1 | 中（UX/正确性）| `TrialBalanceManualInvalidate/index.tsx` handleConfirmCancel + `AddInvalidateModal`（`destroyOnClose`+`preserve={false}`）| 二次确认弹窗点「取消」→ 返回添加弹窗，但添加弹窗已在打开二次确认时被销毁，UID/配置编码/备注全部丢失，用户须重填 | ✅ 已修（2026-07-29）：父级缓存 `payload` 经新增 `defaultValues` prop 回填 Form `initialValues`；区分「全新打开」(`handleOpenAdd` 清缓存)/「放弃」(`handleAddCancel` 清缓存)/「二次确认取消返回」(保留回填)。tsc 绿 + 29 测试全绿 |
| R2 | 低（复用）| `services/api/trialBalanceManualInvalidate.ts` `downloadBlobByGet`/`parseFilename` | 与既有 `userMassManage.ts#downloadExportFile` 的 blob 保存/错误码检查逻辑重叠；差异仅 GET(query) vs POST(json body) | 可延后：抽公共 blob-save 核心，GET/POST 各留薄封装（DRY 第 2 次重复才动，暂记录）|

> 其余核查通过：`numberRender(空)`→`--` 不假造数据；`useTableStore.refetch` 经 `SearchTable` 订阅生效；`searchFetchV2` 逐行套 `manualInvalidateRowSchema` 与 MSW 响应体对齐；枚举 `never` 穷尽未破坏（tsc 绿）。占位 type code（114/34/manual_invalidate_trial）为已登记的待后端销账项，非本次 review 缺陷。
