# 交接任务：修复 admin 后台 MSW mock 列表「暂无数据」问题（PR-01930）

> 本文件是交给另一个 AI 的交接提示词，可整体投喂。生成时间：2026-07-20。

## 你的身份与环境
你是接手 FameEX 加密交易所管理后台开发的 AI。项目是 Next.js 15 + React 19 + Turborepo + pnpm 的 monorepo。
- **工作目录（务必在此改代码）**：`/Users/aven/github/PR-01930`，admin 应用在 `apps/admin/`。
- **对话用中文，代码/命令用英文。**
- **dev server 已在运行**：端口 3001，进程工作目录已确认是 `/Users/aven/github/PR-01930/apps/admin`（不是别的 worktree）。用户已登录。
- 目标页面 URL：`http://localhost:3001/zh-CN/trial-balance/manual-invalidate`
- **不要用 `pnpm dev` 重启**：它的 dev 脚本是 `shx cp config/environments/.env.dev .env.development.local && ... next dev --port 3001`，每次启动会用 `config/environments/.env.dev` 覆盖 `.env.development.local`。
- 文档在 `apps/web/docs_tdd/PR-01930/`（软链），PRD 原型图在 `apps/web/docs_tdd/PR-01930/inbox/prd-assets/`。
- **禁止查看/参考 PR-01930 worktree**，它是上一轮失败的错误源。

## 需求背景（一句话）
在「现货后台-福利中心-卡券记录」下新增「体验金管理」页面（菜单名），页面内含「手动失效」按钮。API 未就绪，用 **MSW（路线 B，dev-only）** 提供 mock 数据。当前页面能渲染、URL 正确、菜单已显示，但**列表始终「暂无数据」**——即 MSW worker 没有拦截到列表请求。

## 核心问题
`http://localhost:3001/zh-CN/trial-balance/manual-invalidate` 列表页显示「暂无数据」。根因是 MSW worker 未成功拦截 `*/operate-api/trialFee/manualInvalidate/list` 请求（GET），mock fixture（5 条）没被返回。

## 已确认为「正常/已排除」的事实（不要重复排查）
1. 改动确实落在 PR-01930 worktree，3001 进程 cwd = `/Users/aven/github/PR-01930/apps/admin`。
2. `apps/admin/.env.local` 已写入 `NEXT_PUBLIC_ENABLE_MSW=true`（`.env.local` 不被 dev 脚本覆盖、已 gitignore）。
3. `apps/admin/public/mockServiceWorker.js` 存在，声明版本 `2.15.0`，与安装的 `msw@2.15.0` **一致**。
4. `src/components/Providers.tsx` 第 36 行确实调用了 `useMockWorker()`。
5. `src/mocks/useMockWorker.ts`：`useEffect` 内条件为 `process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_ENABLE_MSW !== 'true' || startedRef.current` 则 return，否则 `import('./browser').then(({worker}) => worker.start({ onUnhandledRequest:'bypass', serviceWorker:{ url:'/mockServiceWorker.js' }}))`，**`.catch(()=>{})` 静默吞掉了所有启动错误**（这是当前最大盲点）。
6. `src/mocks/browser.ts`：`setupWorker(...manualInvalidateHandlers)`。
7. `src/mocks/handlers/trialBalanceManualInvalidate.ts`：list handler 是 `http.get('*/operate-api/trialFee/manualInvalidate/list', ...)`，返回 `{code:'0', msg:'success', data:{pageInfo:{rows, total}}}`。
8. `src/services/api/trialBalanceManualInvalidate.ts` 的 `searchManualInvalidateList` 用 `searchFetchV2` + `getUrl('/operate-api/trialFee/manualInvalidate/list')`。
9. `getUrl`（`src/utils/api.ts`）：非 mock 前缀时返回 `${process.env.NEXT_PUBLIC_GATEWAY_API}${relativeUrl}`，dev 下 `NEXT_PUBLIC_GATEWAY_API=https://cmsadmin.pfyys.com`，故真实请求 URL = `https://cmsadmin.pfyys.com/operate-api/trialFee/manualInvalidate/list`，能被 `*/operate-api/...` 通配匹配。
10. 契约测试 `manualInvalidateContract.test.ts`（3 例）通过，fixture schema 不漂移。列表 fixture 有 5 条数据。

## 最可能的根因（按优先级排查）
**关键：`.env.local` 里的 `NEXT_PUBLIC_ENABLE_MSW=true` 在 Next.js 里到底有没有被浏览器端读到？** Next.js 环境变量加载优先级为 `.env.development.local` > `.env.local` > `.env.development` > `.env`，**但 `.env.local` 在 `NODE_ENV=development` 下确实会加载**。然而 `NEXT_PUBLIC_*` 变量是**构建/启动时内联**进 client bundle 的——dev server 是在 `.env.local` 写入**之前**还是之后启动的？如果 server 先启动、后写 `.env.local`，则 client bundle 里 `process.env.NEXT_PUBLIC_ENABLE_MSW` 仍是 `undefined`，`useMockWorker` 静默 return，worker 从不启动。这是当前第一嫌疑。

### 排查步骤（建议顺序）
1. **先让失败可见**：临时在 `useMockWorker.ts` 里，把 return 前后和 `worker.start` 成功/失败都加 `console.log`/`console.error`（去掉静默 catch），让用户打开浏览器 Console 报告：是走到了「flag 未开启 return」、还是「worker.start 报错」、还是「启动成功但没拦到」。这是唯一能定位的手段——你没有 Browser MCP，必须靠用户回报 Console + Network。
2. **让用户在 Network 面板**看 `manualInvalidate/list` 请求：是 200 + fixture 数据（说明拦到了，问题在数据解析/`searchFetchV2` 取值路径 `data.pageInfo.rows`）、还是打到了 `cmsadmin.pfyys.com` 真实域名返回空/401（说明 worker 没拦）、还是 `mockServiceWorker.js` 本身 404。
3. 若确认是 env 未内联：让用户**在当前 3001 进程存在的前提下**，用不覆盖 env 的方式重启（例如直接从 `apps/admin` 目录跑 `cross-env NEXT_PUBLIC_ENABLE_MSW=true NEXT_PUBLIC_LOCAL_DEV=true NEXT_PUBLIC_ORIGIN=http://localhost:3001 next dev --port 3001`），或把 flag 加进 `config/environments/.env.dev` 源文件（会被 cp 到 `.env.development.local`，优先级最高，一定生效）——但注意该文件已被 git 跟踪，改它需谨慎，最好加完确认效果后再决定是否保留。
4. 验证 `searchFetchV2` 期望的响应结构：确认它读的是 `res.data.pageInfo.rows` 还是别的路径，与 handler 返回结构逐字对齐。可读 `src/**/searchFetchV2` 实现或 `SearchTable` 组件确认 query 返回值契约（期望 `{rows, total}` 还是 `{list, total}` 还是 `{data:{pageInfo}}`）。

## 交付标准
- 列表页显示 5 条 mock 数据，13 列正常渲染。
- 不引入生产代码分支（MSW 仅 dev-only，路线 B，业务代码 0 改动）。
- 定位到根因后，用一句话向用户说明「为什么之前没数据」，并说明修复是否需要重启、重启命令是什么。
- 排查用的临时 `console.log` 在定稿前清理干净。

## 沟通要求
- 你没有 Browser 自动截图工具，视觉/运行时状态必须请用户回报 Console 日志和 Network 面板，不要凭空断言「应该好了」。
- 每一步先给证据再下结论，别猜。
