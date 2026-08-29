/* template-version: 1 */
/* template-effective-since: 2026-08-29 */

// MSW handler 契约测试参考骨架：<feature>.mockContract.test.ts
// 目的（gate 会查，见 CODE-MSW-001 / architecture-and-state.md §8.4.1 第 2 条）：
// 用**真实 schema** 校验 handler 造出的 response，确保 mock DTO 与真实契约同形——
// 这样真实接口 ready 后停用 handler 即切真实，schema/mapper/UI 不动。
//
// 生命周期（§8.4.2）：本 *.mockContract.test.ts 随 handler 存在；handler 退役即删除本测试，
// 换成 *.apiContract.test.ts / *.realFixture.test.ts（配套 real-fixture-reconcile-test-template.ts）长期验证真实样本。

import { describe, expect, it } from 'vitest'

import { featureHandlers } from '<repo>/apps/web/src/mocks/handlers/<feature>'
// import { featureListSchema } from '<feature schema path>' // 真实契约 schema，单一来源

// 取出 handler 的 JSON body（msw 的 http handler 是可直接 resolve 的纯函数）。
async function resolveBody(url: string): Promise<unknown> {
  const handler = featureHandlers[0]
  const result = await handler.run({ request: new Request(url) })
  return result?.response ? await result.response.json() : null
}

describe('<FEATURE> MSW handler ↔ 真实 schema 契约', () => {
  it('normal 场景 response 通过真实 schema', async () => {
    const body = (await resolveBody('http://localhost/fe-ex-api/<feature>/<endpoint>')) as { data: unknown }
    // 用真实 schema parse，不新造 mock 专用 schema：
    // expect(() => featureListSchema.parse(body.data)).not.toThrow()
    expect(body).toBeTruthy()
  })

  it('empty 场景仍是合法契约形状', async () => {
    const body = (await resolveBody('http://localhost/fe-ex-api/<feature>/<endpoint>?scenario=empty')) as { data: unknown[] }
    // expect(() => featureListSchema.parse(body.data)).not.toThrow()
    expect(Array.isArray(body.data)).toBe(true)
  })
})
