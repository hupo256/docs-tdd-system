#!/usr/bin/env node
// precommit-verify-code-rules.mjs — lint-staged glue for code rules plus the v2 delivery guard.
// lint-staged passes each staged file as a separate argv entry; verify-code-rules.mjs wants one
// --files <comma-list> argument, so this joins argv before dispatching. On v2 project branches the
// read-only delivery guard additionally requires a current CLI-attested PASS over the full change set.
// Any violation or inability to run either applicable guard blocks the commit.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const T = 20000

function stagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'cannot list staged files')
  return result.stdout.split('\0').filter(Boolean)
}

function runCodeRules(files) {
  if (!files.length) return
  const script = join(SCRIPT_DIR, 'verify-code-rules.mjs')
  const result = spawnSync('node', [script, '--files', files.join(','), '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (result.status === 1 && result.stdout) {
    let findings = []
    try { findings = JSON.parse(result.stdout).findings || [] }
    catch {
      process.stderr.write('verify-code-rules returned unparseable output; commit blocked because the result is unknown\n')
      process.exit(1)
    }
    if (findings.length) {
      process.stderr.write('commit blocked by verify-code-rules, fix before committing:\n' +
        findings.map((v) => `  - [${v.ruleId}] ${v.file}:${v.line} - ${v.message}`).join('\n') + '\n')
      process.exit(1)
    }
    return
  }
  if (result.status !== 0) {
    const reason = result.error ? result.error.message : result.status === null ? `timeout after ${T}ms` : `unexpected exit ${result.status}`
    process.stderr.write(`verify-code-rules gate could not run (${reason}); commit blocked because the result is unknown\n`)
    process.exit(1)
  }
}

function runVNextDeliveryGuard() {
  const script = join(SCRIPT_DIR, 'vnext-delivery-guard.mjs')
  const result = spawnSync('node', [script, '--worktree', process.cwd(), '--changed-source', 'staged', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (result.status === 0) return
  if (result.status === 1 && result.stdout) {
    try {
      const payload = JSON.parse(result.stdout)
      process.stderr.write(`commit blocked by v2 delivery guard for ${payload.projectId || 'unknown project'}:\n${(payload.problems || []).map((problem) => `  - ${problem}`).join('\n')}\n`)
      process.exit(1)
    } catch { /* fall through to fail closed */ }
  }
  const reason = result.error ? result.error.message : result.stderr.trim() || `unexpected exit ${result.status}`
  process.stderr.write(`v2 delivery guard could not run (${reason}); commit blocked because the result is unknown\n`)
  process.exit(1)
}

function main() {
  const files = process.argv.slice(2).filter(Boolean)
  if (!files.length) files.push(...stagedFiles())
  runCodeRules(files)
  runVNextDeliveryGuard()
}

main()
