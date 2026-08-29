/* template-version: 1 */
/* template-effective-since: 2026-08-29 */

// MSW 路线 B handler 参考骨架（新功能强制路线，见 common/rules/architecture-and-state.md §8.4.1）。
// 复制到 apps/web/src/mocks/handlers/<feature>.ts 后：把 <FEATURE>/<Feature> 换成功能名、
// 补齐 endpoint path/method、按真实 schema 造 DTO（不是 UI 模型）。
//
// 铁律（gate 会查）：
// - 业务代码（service/hook/mapper/组件）禁止出现 mock flag / mock 分支 / mock DTO 工厂；真假切换只靠这里注册/停用 handler。
// - handler response 必须能通过真实 schema 契约测试（配套 msw-mock-contract-test-template.ts）。
// - 无 API 文档时，猜测字段进 agent/assumptions.json，并在此处以 `// ASSUMED: ASM-xxx` 标注，随字段对账销账。
// - 每个 endpoint 覆盖场景矩阵：normal / empty / error / unauthorized / edge；不适用项在 agent/msw-manifest.json 写理由。

import { http, HttpResponse } from 'msw'

// 与真实接口一致的 DTO（不是 UI 领域模型）——切真实接口时 schema/mapper/UI 类型不动。
const normalDto = {
  // id: 'FX-0001',
  // status: 1, // ASSUMED: ASM-001 待真实接口确认枚举取值
}

// 用 query/body 选择场景，便于 dev 页面自测：?scenario=empty|error|unauthorized|edge
function resolveScenario(request: Request): string {
  return new URL(request.url).searchParams.get('scenario') ?? 'normal'
}

export const featureHandlers = [
  http.get('/fe-ex-api/<feature>/<endpoint>', ({ request }) => {
    switch (resolveScenario(request)) {
      case 'empty':
        return HttpResponse.json({ code: 0, msg: 'success', data: [] })
      case 'error':
        return HttpResponse.json({ code: 500, msg: 'internal error', data: null }, { status: 200 })
      case 'unauthorized':
        return HttpResponse.json({ code: 401, msg: 'unauthorized', data: null }, { status: 200 })
      case 'edge':
        // 边界：超长/极值/分页末页等，按真实契约构造
        return HttpResponse.json({ code: 0, msg: 'success', data: [normalDto] })
      default:
        return HttpResponse.json({ code: 0, msg: 'success', data: [normalDto] })
    }
  }),
]
