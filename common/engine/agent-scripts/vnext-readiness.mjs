#!/usr/bin/env node
// Executable release contract for vNext autopilot reachability. This intentionally invokes the
// production self-tests rather than maintaining a second implementation-shaped mock suite.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { validateProjectWorktreeFacts } from './lib/project-status-report.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const engineDir = resolve(scriptDir, '..')

export function runReadiness() {
  const cases = JSON.parse(readFileSync(join(engineDir, 'schemas/vnext-readiness-cases.json'), 'utf8'))
  assert.equal(cases.schemaVersion, 1)
  assert.equal(cases.cases.filter((item) => item.required).length, 16)
  assert.equal(new Set(cases.cases.map((item) => item.id)).size, cases.cases.length)
  const r13 = cases.cases.find((item) => item.id === 'R-13')
  assert.equal(r13?.required, false)

  const commands = readFileSync(join(scriptDir, 'docs-tdd.mjs'), 'utf8')
  for (const command of ['scope-approval', 'scope-approve', 'review-adjudicate', 'review-resume', 'worktree-prepare', 'dev-check', 'commit']) {
    assert.match(commands, new RegExp(`['\"]${command}['\"]`), `public CLI is missing ${command}`)
  }
  const orchestrator = readFileSync(join(scriptDir, 'project-orchestrator.mjs'), 'utf8')
  assert.match(orchestrator, /option\('--kind'\)/, 'public kickoff is missing --kind intake selection')
  const baselineOk = { ok: true, severity: 'warn', note: 'baseline valid but origin/online has advanced since branch point; consider syncing before merge' }
  const safeFacts = {
    projectId: 'PR-00001', configuredPath: '/tmp/PR-00001', requestedWorktree: '', worktree: '/tmp/PR-00001',
    exists: true, topMatches: true, branch: 'feature/PR-00001', expectedBranch: 'feature/PR-00001',
    baseRef: 'origin/online', baseExists: true, baseline: baselineOk, requireClean: true, dirty: false,
  }
  assert.deepEqual(validateProjectWorktreeFacts(safeFacts), [])
  assert.match(validateProjectWorktreeFacts({ ...safeFacts, configuredPath: '', worktree: '', exists: false })[0], /no worktree binding/)
  assert.ok(validateProjectWorktreeFacts({ ...safeFacts, branch: 'online' }).some((problem) => problem.includes('environment branch')))
  assert.ok(
    validateProjectWorktreeFacts({
      ...safeFacts,
      baseline: { ok: false, severity: 'error', note: 'no common history with origin/online — likely branched off a non-online ref' },
    }).some((problem) => problem.includes('no common history')),
  )
  assert.ok(validateProjectWorktreeFacts({ ...safeFacts, dirty: true }).some((problem) => problem.includes('unowned changes')))

  const suites = [
    'lib/vnext-source-units.mjs',
    'lib/vnext-intake.mjs',
    'lib/vnext-delivery-scope.mjs',
    'lib/vnext-risk-route.mjs',
    'lib/vnext-autopilot.mjs',
    'lib/vnext-coverage-review.mjs',
    'lib/vnext-work-item.mjs',
    'vnext-dev-check.mjs',
    'vnext-commit.mjs',
    'vnext-delivery-guard.mjs',
    'vnext-pilot.mjs',
    'vnext-review.mjs',
    'vnext-scope-approval.mjs',
    'vnext-review-adjudicate.mjs',
  ]
  const results = suites.map((relativePath) => {
    const result = spawnSync(process.execPath, [join(scriptDir, relativePath), '--self-test'], { encoding: 'utf8' })
    return { relativePath, ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}`.trim() }
  })
  const failed = results.filter((result) => !result.ok)
  if (failed.length) throw new Error(failed.map((result) => `${result.relativePath}: ${result.output}`).join('\n'))
  const pilotReport = JSON.parse(readFileSync(join(engineDir, '..', 'vnext/pilot-report.json'), 'utf8'))
  const pilotCheck = pilotReport.checks?.find((item) => item.code === 'R13_PUBLIC_COMMAND_PILOTS')
  return {
    ok: true,
    release: cases.release,
    requiredCases: cases.cases.filter((item) => item.required).map((item) => item.id),
    optionalCases: [{ id: r13.id, complete: pilotCheck?.ok === true, problems: pilotCheck?.problems || ['pilot report is missing the R-13 check'] }],
    suites: results.map((item) => item.relativePath),
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runReadiness()
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(`vNext readiness failed: ${error.message}`)
    process.exitCode = 1
  }
}
