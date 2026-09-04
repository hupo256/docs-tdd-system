#!/usr/bin/env node
// Deterministic replay for the frozen docs_tdd vNext V0/V1/V2 routing examples.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveRiskRoute } from './lib/vnext-risk-route.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(scriptDir, '..', 'fixtures', 'vnext-routing-cases.json')

export function runRouteReplay(path = fixturePath) {
  const fixture = JSON.parse(readFileSync(path, 'utf8'))
  return fixture.cases.map((item) => {
    const result = deriveRiskRoute(item)
    return {
      name: item.name,
      projectId: item.projectId,
      expectedLevel: item.expectedLevel,
      actualLevel: result.routing.verificationLevel,
      ok: result.ok && result.routing.verificationLevel === item.expectedLevel,
      problems: result.problems,
      verificationPlan: result.verificationPlan,
    }
  })
}

export function selfTest() {
  const results = runRouteReplay()
  assert.equal(results.length, 6)
  assert.ok(results.every((item) => item.ok), JSON.stringify(results))
  assert.ok(results.filter((item) => ['PR-02306', 'PR-02172'].includes(item.projectId)).every((item) => item.actualLevel === 'V1'))
  assert.equal(results.find((item) => item.projectId === 'PR-00000').actualLevel, 'V0')
  assert.ok(results.filter((item) => ['PR-01930', 'PR-02265', 'PR-01947'].includes(item.projectId)).every((item) => item.actualLevel === 'V2'))
  console.log('vnext-route-replay self-test passed (4 historical projects + V1 pilot + low-risk control)')
}

if (process.argv.includes('--self-test')) {
  selfTest()
} else {
  const results = runRouteReplay()
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: results.every((item) => item.ok), results }, null, 2))
  else for (const item of results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.projectId}: expected ${item.expectedLevel}, got ${item.actualLevel}`)
  process.exitCode = results.every((item) => item.ok) ? 0 : 1
}
