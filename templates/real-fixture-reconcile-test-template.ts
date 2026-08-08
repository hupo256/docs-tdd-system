/* template-version: 1 */
/* template-effective-since: 2026-07-23 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { diffStrippedKeys } from '<repo>/apps/web/docs_tdd/common/engine/agent-scripts/schema-fixture-reconcile.mjs'
// import { detailSchema } from '<feature schema path>'

// fixture 是「某时刻真实响应」的快照,是本套件里唯一会过期的测试（接口改了 → 快照旧了）。
// 抓取信息写在这里,对账失败时一眼判断：是 fixture 老了该重抓,还是 schema 真错了。
// 生命周期规则见 common/rules/verification-division-of-labor.md §6：更新 fixture,不是删测试。
const FIXTURE_META = {
  source: '<YApi interface id，如 4126 / 手动抓取 URL>',
  capturedAt: 'YYYY-MM-DD', // 重抓时更新
}

function readJsonFixture<T>(pathFromRepoRoot: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), pathFromRepoRoot), 'utf8')) as T
}

describe(`<FEATURE> real fixture schema reconciliation (${FIXTURE_META.source} @ ${FIXTURE_META.capturedAt})`, () => {
  it('does not strip fields that exist in the real response fixture', () => {
    const raw = readJsonFixture<Record<string, unknown>>('apps/web/docs_tdd/<PROJECT-ID>/inbox/api/<fixture>.json')
    // Replace with the actual response payload path and schema.
    // const payload = raw.data
    // expect(diffStrippedKeys(payload, detailSchema.parse(payload))).toEqual([])
    expect(diffStrippedKeys(raw, raw)).toEqual([])
  })
})
