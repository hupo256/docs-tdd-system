#!/usr/bin/env node
// Golden run：给 gate 机器本身做端到端契约测试，而不是再测一遍纯谓词。
// - 为什么需要：各脚本的 `--self-test` 只覆盖导出的纯函数；「聚合器能不能跑起来、
//   规则 ID 有没有真的连到判定、有没有误伤旁边的规则」这类接线问题它一条都拦不住。
//   本会话就出现过 run-project-gate 处于不可运行状态、只靠人工翻代码才发现。
// - 怎么测：把 `common/engine/fixtures/golden-project` 物化成临时项目 PR-00000（基线刚好全绿），
//   然后每个变异用例只破坏一处，断言「预期规则 ID 正好命中」且「没有其他 error 级规则被牵连」。
//   后者是防误报的那一半——规则变宽会让基线之外的项一起红，这里会直接失败。
// - 边界：端到端覆盖文档类 gate G0-G7（G4 的 GIT-G4 point-in-time 检查依赖真实 feature 分支，故 baseline 走 G5
//   累积覆盖 G4 的 DOC 检查、不直接跑 G4）。G8 做结构 dry-check：合成 fixture 无真实 git 推送，G8 必然因
//   交付/git 终点规则失败，只断言 G0-G7 文档链在 G8 校验下无回归。G4+ 的真实分支、改动文件和工具链
//   仍由 verify-build-quality 的真实执行负责。
//   prd-intake / MSW 子链路在夹具里显式关闭（project-manifest.pilot 全 false），它们各自有 fixtures 与自测。
// - 副作用：临时项目目录在 finally 里删除；不传 `--write`，所以不写 gate-results /
//   evidence / PROJECTS.md / warn 台账。PR-00000 是保留 ID，索引与预算检查都排除它。

import { existsSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { errorFailures, mutationVerdict, selfTest as verdictSelfTest } from './lib/golden-verdict.mjs'
import { baselineGates, buildMutationCases } from './lib/golden-cases.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const fixtureDir = join(docsRoot, 'common/engine/fixtures/golden-project')

export const GOLDEN_PROJECT_ID = 'PR-00000'
const targetDir = resolveProjectRoot(GOLDEN_PROJECT_ID)

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

function runProjectGate(gate, { partial = false } = {}) {
  const result = spawnSync(process.execPath, [join(scriptDir, 'verify-project-gate.mjs'), GOLDEN_PROJECT_ID, gate, '--json', ...(partial ? ['--partial'] : [])], {
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

const mutationCases = buildMutationCases({ targetDir, editFixtureFile, writeFixtureFile, GOLDEN_PROJECT_ID, errorFailures })

function selfTest() {
  verdictSelfTest()
  assert.ok(existsSync(join(fixtureDir, 'product/00-feature-inventory.md')), 'self-test failed: golden fixture 缺 product/00-feature-inventory.md')
  console.log('golden-run self-test passed (委托 golden-verdict + 夹具存在性)')
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

  // 1.5 G8 结构 dry-check：合成 fixture 无真实 git 推送，G8 必然因交付/git 规则失败（这是诚实终点，
  //     真实交付依赖推送 origin，无法在无后端夹具里伪造）。这里只断言 G0-G7 文档链在 G8 校验下无回归——
  //     即除交付/git 终点规则外，不得有任何额外 error。它把"端到端到 G7 机器全绿 + G8 结构完好"一次固化。
  {
    materialize()
    const g8 = runProjectGate('G8')
    const G8_DELIVERY_RULES = new Set(['VERIFY-STAGE-003', 'VERIFY-G8-002', 'VERIFY-G8-003', 'VERIFY-G8-004'])
    const structuralErrors = g8.parseError ? ['(parse error)'] : errorFailures(g8.checks).filter((id) => !G8_DELIVERY_RULES.has(id))
    record(
      !g8.parseError && structuralErrors.length === 0,
      'G8 structural dry-check',
      g8.parseError
        ? `gate 输出无法解析：${g8.parseError}`
        : `G0-G7 文档链在 G8 校验下应无回归（仅允许交付/git 终点规则 ${[...G8_DELIVERY_RULES].join('/')} 失败），实际额外 error：${structuralErrors.join(', ')}`,
    )
  }

  // 2. 变异：每条只破坏一处，预期规则必须红，且不牵连基线之外的 error 规则。
  for (const testCase of mutationCases) {
    materialize()
    testCase.apply()
    const result = runProjectGate(testCase.gate, { partial: testCase.partial })
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
