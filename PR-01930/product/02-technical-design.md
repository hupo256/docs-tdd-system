# Technical Design — PR-01930 体验金手动失效功能（重做）

## 复用盘点（基于主仓 apps/admin 原生代码，未参考上一轮 worktree）

| 类型 | 已检查位置 | 采用方式 |
|------|-----------|----------|
| 列表/分页 | `components/SearchTable/index.tsx` | 复用 `SearchTable<T>`，新页面只提供 columns/query/searchFields |
| 搜索表单 | `components/SearchForm/` + `createSearchFieldsState` | 复用；feature-local `useSearchFields`/`useItems` |
| 列表 service | `utils/searchFetch`(searchFetchV2) + `utils/api.ts`(getUrl) + `constants/headers.ts`(futuresAdminHeaders) | 参照 `services/api/trialBalance.ts` 的 `searchTrialBalanceList`，走 `getUrl('/operate-api/trialFee/...')` |
| query/mutation | `services/api/util.ts`(usePatternQuery/usePatternMutation) | 复用 |
| 导出 | `services/api/trialBalance.ts` 的 `downloadExportFileByGet` | 抄 helper + useMutation |
| 添加弹窗 | antd `Form.useForm` + 通用 `Modal`；多值 UID validator 参照 `apps/TrialBalanceDispatch/components/Form.tsx` | 新建 feature-local 弹窗 |
| 二次确认 | `components/ConfirmModal.tsx`（带 warning）| 新建业务专用二次确认（对齐 08 真图），复用 antd Modal/Button |
| 批量上传 | `components/ImportModal/index.tsx`（title 硬编码「导入」）| 轻量扩展可选 `title` prop 默认「导入」，本功能传「批量手动过期」；或本功能内包一层。不改既有调用方行为 |
| 表格工具 | `utils/table.tsx`（dateTimeRender/numberRender/emptyText='--'/operatorRender）| 复用；8 位金额新建 feature-local 纯函数并测试 |
| 权限 | `utils/hasAuth.ts`/`types/permission.ts` | 权限点 `manual_invalidate_trial_fund`，入口/按钮按权限控制 |
| 路由/菜单 | `constants/routes.ts`/`siderItems.ts`/`contentSettings.ts` + `app/[lang]/.../page.tsx` | 仅追加，不改既有排序 |

## 前端分层

| 层 | 责任 | 约束 |
|----|------|------|
| 页面/路由 | 挂载页面、权限壳、列表和弹窗 | 不直接 fetch |
| service/schema | A1-A6 请求、Zod 响应 schema、错误处理 | 走 getUrl operate-api 真实占位路径；MSW 路线 B |
| 纯函数 | UID/编码解析、去重、单项 100、笛卡尔积 10000、二选一模式判定、备注校验 | 单测覆盖边界 |
| UI 组件 | 列表、添加弹窗、批量上传弹窗、二次确认弹窗 | 复用 admin antd 组件，逐屏对齐真图 |

## 高风险操作链路（对齐 wb3 流程图）

1. 点击「手动失效」打开添加弹窗。
2. 本地校验：二选一四场景、格式、单项上限、备注、去重后笛卡尔积上限。
3. 校验通过调 A2 预校验，取影响用户数与金额拆分。
4. 展示二次风险确认弹窗（08 真图）；取消不执行。
5. 点「确认失效」调 A3 执行，携带 requestId 幂等；提交中禁用按钮。
6. 成功 Toast「操作成功」并刷新列表。

## 主题 / 网关（已定）

- 主题色跟随 admin 全局紫色 `#722ED1`，直接用 `@/components` Button/ActionButton。
- 网关走现货后台 `getUrl('/operate-api/trialFee/...')`，非合约网关。
