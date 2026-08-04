#!/usr/bin/env node
// Golden run：给 gate 机器本身做端到端契约测试，而不是再测一遍纯谓词。
// - 为什么需要：各脚本的 `--self-test` 只覆盖导出的纯函数；「聚合器能不能跑起来、
//   规则 ID 有没有真的连到判定、有没有误伤旁边的规则」这类接线问题它一条都拦不住。
//   本会话就出现过 run-project-gate 处于不可运行状态、只靠人工翻代码才发现。
// - 怎么测：把 `common/fixtures/golden-project` 物化成临时项目 PR-00000（基线刚好全绿），
//   然后每个变异用例只破坏一处，断言「预期规则 ID 正好命中」且「没有其他 error 级规则被牵连」。
//   后者是防误报的那一半——规则变宽会让基线之外的项一起红，这里会直接失败。
// - 边界：覆盖文档类 gate（G0/G1/G2/G3/G6）。G6 只验证结构化 Review/验收接线，
//   G4+ 的真实分支、改动文件和工具链仍由 verify-build-quality 的真实执行负责。
//   prd-intake / MSW 子链路在夹具里显式关闭（project-manifest.pilot 全 false），
//   它们各自有 fixtures 与自测。
// - 副作用：临时项目目录在 finally 里删除；不传 `--write`，所以不写 gate-results /
//   evidence / PROJECTS.md / warn 台账。PR-00000 是保留 ID，索引与预算检查都排除它。

import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const fixtureDir = join(docsRoot, 'common/fixtures/golden-project')

export const GOLDEN_PROJECT_ID = 'PR-00000'
const targetDir = join(docsRoot, GOLDEN_PROJECT_ID)

const args = process.argv.slice(2)
const keepFixture = args.includes('--keep')
// 发布前调用时聚合器烟测跑不了（run-project-gate 拒绝 stale 指纹链），显式跳过而不是伪装通过。
const skipAggregator = args.includes('--skip-aggregator')
const verbose = args.includes('--verbose')

function printHelp() {
  console.log(`usage: golden-run.mjs [--keep] [--verbose] [--self-test] [--help]

Materialize the golden fixture as ${GOLDEN_PROJECT_ID}, assert the gate baseline is green,
then assert each mutation case trips exactly its expected rule ID.

Options:
  --help        Show this help message and exit
  --self-test   Run the pure-helper predicate cases and exit
  --keep        Leave ${GOLDEN_PROJECT_ID} materialized for manual debugging
  --skip-aggregator  Skip the run-project-gate smoke run (used pre-publish, when the fingerprint chain is still stale)
  --verbose     Print every case verdict, not just failures`)
}

// 基线里允许存在的非 error 级项：warn/waived 不参与「误伤」判定，否则夹具得为每条 warn 造数据。
function errorFailures(checks) {
  return (checks || []).filter((check) => !check.ok && check.severity === 'error').map((check) => check.ruleId)
}

// 变异用例的判定核心：预期规则必须命中，且不得牵连任何基线之外的 error 规则。
export function mutationVerdict({ expectRuleId, checks, baselineFailures = [] }) {
  const failures = errorFailures(checks)
  const hit = failures.includes(expectRuleId)
  const collateral = failures.filter((ruleId) => ruleId !== expectRuleId && !baselineFailures.includes(ruleId))
  return { ok: hit && collateral.length === 0, hit, collateral, failures }
}

function readFixtureFile(relPath) {
  return readFileSync(join(targetDir, relPath), 'utf8')
}

function writeFixtureFile(relPath, text) {
  writeFileSync(join(targetDir, relPath), text)
}

function editFixtureFile(relPath, transform) {
  writeFixtureFile(relPath, transform(readFixtureFile(relPath)))
}

function materialize() {
  rmSync(targetDir, { recursive: true, force: true })
  cpSync(fixtureDir, targetDir, { recursive: true })
}

function cleanup() {
  if (keepFixture) {
    console.log(`golden-run: --keep 生效，保留 ${GOLDEN_PROJECT_ID}（调试完请手工删除）`)
    return
  }
  rmSync(targetDir, { recursive: true, force: true })
}

function runProjectGate(gate) {
  const result = spawnSync(process.execPath, [join(scriptDir, 'verify-project-gate.mjs'), GOLDEN_PROJECT_ID, gate, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  try {
    return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
  } catch (error) {
    return { parseError: error.message, stdout: result.stdout, stderr: result.stderr, exitCode: result.status ?? 1, checks: [] }
  }
}

function runAggregator(gate) {
  // 不传 --write：只验「聚合器能跑起来、产出结构完整」，不产生任何持久化副作用。
  const result = spawnSync(process.execPath, [join(scriptDir, 'run-project-gate.mjs'), GOLDEN_PROJECT_ID, gate, '--json', '--no-cache'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  try {
    return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
  } catch (error) {
    // 指纹链未重新发布时聚合器会拒跑（设计如此）。这不是接线故障，但也不能当成「跳过」，
    // 所以照旧判失败，只把修复命令直接写进消息，省去二次排查。
    const stale = /rule release is missing or stale|effective rules release is missing or stale/.test(`${result.stderr}${result.stdout}`)
    return {
      parseError: stale ? '指纹链已过期：先跑 check-doc-budget → rule-release.mjs --write → effective-rules.mjs --write，再重跑 golden-run' : error.message,
      stdout: result.stdout,
      stderr: stale ? '' : result.stderr,
      exitCode: result.status ?? 1,
    }
  }
}

const baselineGates = ['G0', 'G1', 'G2', 'G3', 'G6']

// 每个用例只破坏一处。expectRuleId 是「必须命中」的那条；任何额外 error 命中都算规则变宽。
const mutationCases = [
  {
    id: 'missing-api-contract-file',
    gate: 'G0',
    expectRuleId: 'DOC-STRUCT-006',
    apply: () => rmSync(join(targetDir, 'product/03-api-contract.md')),
  },
  {
    id: 'missing-agent-readme',
    gate: 'G0',
    expectRuleId: 'DOC-STRUCT-012',
    apply: () => rmSync(join(targetDir, 'agent/README.md')),
  },
  {
    id: 'prd-source-row-empty',
    gate: 'G0',
    expectRuleId: 'DOC-G0-001',
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| PRD 来源 | golden-project/inbox/prd-fixture.md |', '| PRD 来源 |  |')),
  },
  {
    id: 'feature-list-heading-renamed',
    gate: 'G0',
    expectRuleId: 'DOC-G0-002',
    // 标题被改写时 G0-002 必须红；同一份文档的表格解析也会跟着空掉，故 G2 的行级规则不在此用例断言。
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('## 功能清单', '## 功能一览')),
  },
  {
    id: 'acceptance-mapping-removed',
    gate: 'G0',
    expectRuleId: 'DOC-G0-003',
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('## 验收标准对照', '## 验收想法')),
  },
  {
    id: 'g1-scope-missing',
    gate: 'G1',
    expectRuleId: 'DOC-G1-001',
    apply: () => editFixtureFile('product/01-scope-and-phases.md', (text) => text.replaceAll('范围', '阶段')),
  },
  {
    id: 'blocking-placeholder-left-in-inventory',
    gate: 'G2',
    expectRuleId: 'DOC-G2-001',
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('夹具用最小功能', '待填写')),
  },
  {
    id: 'g2-confirmer-unfilled',
    gate: 'G2',
    expectRuleId: 'DOC-G2-002',
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| G2 确认人 & 日期 | golden-fixture 2026-08-03 |', '| G2 确认人 & 日期 | 待确认 |')),
  },
  {
    id: 'feature-row-without-status',
    gate: 'G2',
    expectRuleId: 'DOC-G2-004',
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| F02 | 历史榜单归档 | 不做 | 夹具用不做项 |', '| F02 | 历史榜单归档 | 评估中 | 夹具用不做项 |')),
  },
  {
    id: 'doing-feature-missing-from-tasks',
    gate: 'G2',
    expectRuleId: 'DOC-G2-005',
    apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| F03 | 榜单分享卡片 | 延期 | 夹具用延期项 |', '| F04 | 榜单筛选 | 做 | 任务表里故意缺 F04 |')),
  },
  {
    id: 'msw-route-b-not-locked',
    gate: 'G3',
    expectRuleId: 'DOC-G3-001',
    // 三处 MSW 路线锚点同时消失才可能改动路线结论，故本用例把同文件的连带命中列进 tolerate。
    tolerate: ['DOC-G3-002'],
    apply: () => editFixtureFile('product/03-api-contract.md', (text) => text.replace(/MSW 路线 B/g, 'Mock 方案').replace('`src/mocks/handlers`', '`src/fake`')),
  },
  {
    id: 'msw-fallback-task-missing',
    gate: 'G3',
    expectRuleId: 'DOC-G3-006',
    apply: () => editFixtureFile('product/04-frontend-tasks.md', (text) => text.replace('| T03 | F01 | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 完成 |', '| T03 | F01 | 补 mock | 完成 |')),
  },
  {
    id: 'dev-only-worker-note-missing',
    gate: 'G3',
    expectRuleId: 'DOC-G3-005',
    apply: () => editFixtureFile('product/03-api-contract.md', (text) => text.replace('worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。', 'worker 全环境注册。')),
  },
  {
    id: 'valid-waiver-downgrades-error',
    gate: 'G3',
    // 豁免机制本身也是 gate 的一部分：可豁免规则命中 + 未过期豁免 => 该条不再是 error。
    expectRuleId: null,
    apply: () => {
      editFixtureFile('product/03-api-contract.md', (text) => text.replace('worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。', 'worker 全环境注册。'))
      writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
        { ruleId: 'DOC-G3-005', reason: 'golden fixture waiver case', owner: 'golden-run', expiresAt: '2099-12-31' },
      ], null, 2)}\n`)
    },
    assert: (result) => {
      const waived = (result.checks || []).find((check) => check.ruleId === 'DOC-G3-005')
      assert.ok(waived, 'DOC-G3-005 应出现在 checks 里')
      assert.equal(waived.severity, 'waived', `未过期豁免应把 DOC-G3-005 降为 waived，实际 ${waived.severity}`)
      assert.equal(errorFailures(result.checks).length, 0, `豁免后不应剩余 error：${errorFailures(result.checks).join(', ')}`)
    },
  },
  {
    id: 'expired-waiver-still-blocks',
    gate: 'G3',
    expectRuleId: 'DOC-G3-005',
    apply: () => {
      editFixtureFile('product/03-api-contract.md', (text) => text.replace('worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。', 'worker 全环境注册。'))
      writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
        { ruleId: 'DOC-G3-005', reason: 'expired waiver case', owner: 'golden-run', expiresAt: '2020-01-01' },
      ], null, 2)}\n`)
    },
    assert: (result) => {
      const expired = (result.checks || []).find((check) => check.ruleId === 'DOC-WAIVER-003')
      assert.ok(expired, '过期豁免必须以 DOC-WAIVER-003 暴露，不能静默忽略')
    },
  },
  {
    id: 'open-blocker-blocks-at-gate',
    gate: 'G3',
    // 阻塞登记：open 且 blocksGate=G3 的 blocker 在 G3 必须命中 DOC-BLOCK-002。
    expectRuleId: 'DOC-BLOCK-002',
    apply: () => writeFixtureFile('agent/blockers.json', `${JSON.stringify([
      { id: 'BLK-9', type: 'blocker', gate: 'G3', blocksGate: 'G3', category: 'backend', summary: '接口未就绪', owner: 'be', raisedAt: '2026-08-03', status: 'open', evidence: [] },
    ], null, 2)}\n`),
  },
  {
    id: 'malformed-blocker-file',
    gate: 'G3',
    // 结构非法（resolved 缺 resolution）只报 DOC-BLOCK-001，不连环误报 002/003。
    expectRuleId: 'DOC-BLOCK-001',
    apply: () => writeFixtureFile('agent/blockers.json', `${JSON.stringify([
      { id: 'BLK-8', type: 'blocker', gate: 'G3', blocksGate: 'G3', category: 'backend', summary: 'x', owner: 'be', raisedAt: '2026-08-03', status: 'resolved' },
    ], null, 2)}\n`),
  },
  {
    id: 'blocker-waiver-downgrades',
    gate: 'G3',
    // DOC-BLOCK-002 可豁免：具名带期限的 waiver 应把它降为 waived，允许带阻塞往前推。
    expectRuleId: null,
    apply: () => {
      writeFixtureFile('agent/blockers.json', `${JSON.stringify([
        { id: 'BLK-7', type: 'blocker', gate: 'G3', blocksGate: 'G3', category: 'backend', summary: '接口未就绪', owner: 'be', raisedAt: '2026-08-03', status: 'open', evidence: [] },
      ], null, 2)}\n`)
      writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
        { ruleId: 'DOC-BLOCK-002', reason: 'golden fixture blocker waiver', owner: 'golden-run', expiresAt: '2099-12-31' },
      ], null, 2)}\n`)
    },
    assert: (result) => {
      const waived = (result.checks || []).find((check) => check.ruleId === 'DOC-BLOCK-002')
      assert.ok(waived, 'DOC-BLOCK-002 应出现在 checks 里')
      assert.equal(waived.severity, 'waived', `未过期豁免应把 DOC-BLOCK-002 降为 waived，实际 ${waived.severity}`)
      assert.equal(errorFailures(result.checks).length, 0, `豁免后不应剩余 error：${errorFailures(result.checks).join(', ')}`)
    },
  },
  {
    id: 'open-code-review-finding',
    gate: 'G6',
    expectRuleId: 'DOC-CR-002',
    apply: () => writeFixtureFile('agent/code-review.json', `${JSON.stringify({
      projectId: GOLDEN_PROJECT_ID,
      reviewedAt: '2026-08-03',
      reviewer: 'golden-fixture',
      findings: [{ id: 'CR-1', category: 'correctness', severity: 'high', summary: '未处理问题', disposition: 'open', evidence: [] }],
    }, null, 2)}\n`),
  },
  {
    id: 'doing-feature-missing-acceptance',
    gate: 'G6',
    expectRuleId: 'DOC-AC-002',
    apply: () => writeFixtureFile('agent/acceptance-results.json', `${JSON.stringify({ projectId: GOLDEN_PROJECT_ID, items: [] }, null, 2)}\n`),
  },
  {
    id: 'passed-acceptance-missing-evidence',
    gate: 'G6',
    expectRuleId: 'DOC-AC-004',
    apply: () => editFixtureFile('agent/acceptance-results.json', (text) => text.replace('"evidence": ["evidence/gate/g6/README.md"]', '"evidence": []')),
  },
]

function selfTest() {
  const cases = [
    { name: '命中且无连带', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }] }, expectOk: true },
    { name: '规则没命中', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-005', ok: false, severity: 'error' }] }, expectOk: false },
    { name: '有连带误伤', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G0-001', ok: false, severity: 'error' }] }, expectOk: false },
    { name: '连带在 tolerate 内', input: { expectRuleId: 'DOC-G2-004', baselineFailures: ['DOC-G0-001'], checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G0-001', ok: false, severity: 'error' }] }, expectOk: true },
    { name: 'warn 不算连带', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G0-004', ok: false, severity: 'warn' }] }, expectOk: true },
    { name: 'waived 不算连带', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G3-005', ok: false, severity: 'waived' }] }, expectOk: true },
    { name: '通过项不算失败', input: { expectRuleId: 'DOC-G2-004', checks: [{ ruleId: 'DOC-G2-004', ok: false, severity: 'error' }, { ruleId: 'DOC-G2-005', ok: true, severity: 'error' }] }, expectOk: true },
  ]
  for (const testCase of cases) {
    const verdict = mutationVerdict(testCase.input)
    assert.equal(verdict.ok, testCase.expectOk, `self-test failed: ${testCase.name} => ${JSON.stringify(verdict)}`)
  }
  assert.equal(errorFailures([{ ruleId: 'A', ok: false, severity: 'error' }, { ruleId: 'B', ok: false, severity: 'warn' }]).join(','), 'A', 'self-test failed: errorFailures 应只收 error 级')
  assert.ok(existsSync(join(fixtureDir, 'product/00-feature-inventory.md')), 'self-test failed: golden fixture 缺 product/00-feature-inventory.md')
  console.log(`golden-run self-test passed (${cases.length + 2} predicate cases)`)
}

if (args.includes('--help')) {
  printHelp()
  process.exit(0)
}

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

if (!existsSync(fixtureDir)) {
  console.error(`golden-run: 夹具目录不存在：${fixtureDir}`)
  process.exit(1)
}

const failures = []
function record(ok, label, detail) {
  if (ok) {
    if (verbose) console.log(`PASS ${label}`)
    return
  }
  failures.push(`${label}: ${detail}`)
  console.error(`FAIL ${label}: ${detail}`)
}

mkdirSync(dirname(targetDir), { recursive: true })
try {
  // 1. 基线：夹具必须在每个覆盖的 gate 上全绿。基线不绿的话变异用例的「无连带」断言就没有意义。
  const baselineFailuresByGate = {}
  for (const gate of baselineGates) {
    materialize()
    const result = runProjectGate(gate)
    const failed = errorFailures(result.checks)
    baselineFailuresByGate[gate] = failed
    record(
      !result.parseError && result.ok === true && failed.length === 0,
      `baseline ${gate}`,
      result.parseError ? `gate 输出无法解析：${result.parseError}\n${result.stderr || ''}` : `期望全绿，实际 error 命中：${failed.join(', ') || '(无但 ok!==true)'}`,
    )
  }

  // 2. 变异：每条只破坏一处，预期规则必须红，且不牵连基线之外的 error 规则。
  for (const testCase of mutationCases) {
    materialize()
    testCase.apply()
    const result = runProjectGate(testCase.gate)
    if (result.parseError) {
      record(false, `mutation ${testCase.id}`, `gate 输出无法解析：${result.parseError}`)
      continue
    }
    if (testCase.expectRuleId) {
      const verdict = mutationVerdict({
        expectRuleId: testCase.expectRuleId,
        checks: result.checks,
        baselineFailures: [...(baselineFailuresByGate[testCase.gate] || []), ...(testCase.tolerate || [])],
      })
      record(
        verdict.ok,
        `mutation ${testCase.id}`,
        verdict.hit
          ? `${testCase.expectRuleId} 命中，但连带误伤了：${verdict.collateral.join(', ')}`
          : `期望 ${testCase.expectRuleId} 判 error，实际 error 命中：${verdict.failures.join(', ') || '(无)'}`,
      )
    }
    if (testCase.assert) {
      try {
        testCase.assert(result)
        if (verbose) console.log(`PASS mutation ${testCase.id} (custom assert)`)
      } catch (error) {
        record(false, `mutation ${testCase.id}`, error.message)
      }
    }
  }

  // 3. 聚合器烟测：run-project-gate 必须能真的跑起来并产出结构完整的 payload。
  //    本会话它曾处于不可运行状态而所有纯函数自测仍全绿——这一条就是为那类接线故障留的。
  if (skipAggregator) {
    console.log('golden-run: --skip-aggregator 生效，聚合器烟测未跑（发布后跑 docs-tdd golden 补上）')
  } else {
  materialize()
  const aggregated = runAggregator('G2')
  record(
    !aggregated.parseError && aggregated.projectId === GOLDEN_PROJECT_ID && aggregated.gate === 'G2' && Array.isArray(aggregated.checks) && typeof aggregated.summary?.total === 'number',
    'aggregator smoke run-project-gate G2',
    aggregated.parseError ? `payload 无法解析：${aggregated.parseError}\n${aggregated.stderr || ''}` : `payload 结构不完整：${JSON.stringify({ projectId: aggregated.projectId, gate: aggregated.gate, summary: aggregated.summary })}`,
  )
  record(
    aggregated.buildQuality?.required === false,
    'aggregator smoke buildQuality 边界',
    `G2 不应要求机器事实层，实际 required=${aggregated.buildQuality?.required}`,
  )
  }
} finally {
  cleanup()
}

const totalCases = baselineGates.length + mutationCases.length + (skipAggregator ? 0 : 2)
if (failures.length) {
  console.error(`\ngolden-run: BLOCK — ${failures.length}/${totalCases} 项失败`)
  process.exit(1)
}
const smokeText = skipAggregator ? '聚合器烟测已跳过' : '聚合器烟测通过'
console.log(`golden-run: PASS — 基线 ${baselineGates.join('/')} 全绿，${mutationCases.length} 个变异用例命中预期规则，${smokeText}（共 ${totalCases} 项）`)
