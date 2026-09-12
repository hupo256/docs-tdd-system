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
  assert.equal(cases.cases.filter((item) => item.required).length, 12)
  assert.equal(new Set(cases.cases.map((item) => item.id)).size, cases.cases.length)

  const commands = readFileSync(join(scriptDir, 'docs-tdd.mjs'), 'utf8')
  for (const command of ['scope-approval', 'scope-approve', 'review-adjudicate', 'review-resume', 'worktree-prepare', 'dev-check', 'commit']) {
    assert.match(commands, new RegExp(`['\"]${command}['\"]`), `public CLI is missing ${command}`)
  }
  const orchestrator = readFileSync(join(scriptDir, 'project-orchestrator.mjs'), 'utf8')
  assert.match(orchestrator, /option\('--kind'\)/, 'public kickoff is missing --kind intake selection')
  const safeFacts = {
    projectId: 'PR-00001', configuredPath: '/tmp/PR-00001', requestedWorktree: '', worktree: '/tmp/PR-00001',
    exists: true, topMatches: true, branch: 'feature/PR-00001', expectedBranch: 'feature/PR-00001',
    baseRef: 'origin/online', baseExists: true, descendsFromBase: true, requireClean: true, dirty: false,
  }
  assert.deepEqual(validateProjectWorktreeFacts(safeFacts), [])
  assert.match(validateProjectWorktreeFacts({ ...safeFacts, configuredPath: '', worktree: '', exists: false })[0], /no worktree binding/)
  assert.ok(validateProjectWorktreeFacts({ ...safeFacts, branch: 'online' }).some((problem) => problem.includes('environment branch')))
  assert.ok(validateProjectWorktreeFacts({ ...safeFacts, descendsFromBase: false }).some((problem) => problem.includes('not a descendant')))
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
  return { ok: true, release: cases.release, requiredCases: cases.cases.filter((item) => item.required).map((item) => item.id), suites: results.map((item) => item.relativePath) }
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
