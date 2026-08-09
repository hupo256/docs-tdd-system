# Development Rules — PR-01930（项目差异，公共规则见 ../../../common/）

> 只写本项目特殊约束；通用规则继承 `common/`，不复制全文。

## 本项目特殊约束

1. **视觉真值 = 真图**：`inbox/prd-assets/`（真图 + 白板）是唯一 UI 真值来源；PRD 正文取 `inbox/lark-sync/`。每屏实现后必须与对应真图并排走查；gate/单测只证逻辑，不作为「符合需求」结论。UI 类需求的产出只从真图 + PRD 原文 + 主仓 apps/admin 原生代码模式 + 用户确认这四个一手来源产出。
2. **网关口径**：现货后台体验金核心走 `getUrl('/operate-api/trialFee/...')` + `futuresAdminHeaders`，勿误判为合约业务套合约网关。
3. **不超界**：只碰责任模块白名单（见 00-feature-inventory / 04-frontend-tasks）。第一轮限现货后台核心页；第二轮已授权扩到合约后台 7.1.8 资产-流水查询、C 端 web 7.1.9（仅 web，不碰 app）；除白名单落点外不改其他体验金既有页。
4. **文案逐字 copy PRD 原文**，禁意译（见 03-api-contract 文案契约表），配「值===原文」字面断言测试。
5. **MSW 是唯一 mock 策略**：本项目仅用 **MSW 路线 B**（`src/mocks/handlers`）做 dev-only 数据占位，不引入任何其他 mock 方案（无 `USE_MOCK`/service 内 mock 分支/静态 fixture 直返/其他拦截库）。production service 零 mock 分支，dev-only worker 懒加载不入包；真实接口 ready 后关闭 `NEXT_PUBLIC_ENABLE_MSW` 即切真实路径。
6. **i18n 口径按 app 分治**：
   - **仅 `apps/web` 做国际化**，且本地开发只写 `zh-CN`，其他语种交别团队处理（文案走 `t('ns:key')` + locales/zh-CN/*.json）。
   - **`apps/admin` / `apps/futures-admin` 等后台 app 不做国际化**：新增文案一律**简体中文硬编码进组件/常量**，不新增或依赖 `.json` i18n key。若某展示列历史上走 `t('...-N')`（如 financeAudit `businessType-N`、futures order `user-order-type-*`），对本 PR 新增类型改用硬编码分支兜底，不再往 locales 补 key。旧代码既有繁体/i18n 属历史，不在本 PR 顺带重构范围。
