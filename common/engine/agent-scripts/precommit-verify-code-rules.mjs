#!/usr/bin/env node
// precommit-verify-code-rules.mjs — lint-staged glue for verify-code-rules.mjs
// lint-staged passes each staged file as a separate argv entry; verify-code-rules.mjs
// wants one --files <comma-list> argument, so this joins argv before dispatching.
// Same pass/block/warn contract as claude-posttooluse-gate.mjs:
//   0 = ok, 1 = violation found (blocks commit), gate itself failing to run = warn, don't block.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const T = 20000

function main() {
  const files = process.argv.slice(2).filter(Boolean)
  if (!files.length) process.exit(0)
  const script = join(SCRIPT_DIR, 'verify-code-rules.mjs')
  const r = spawnSync('node', [script, '--files', files.join(','), '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (r.status === 1 && r.stdout) {
    let findings = []
    try { findings = JSON.parse(r.stdout).findings || [] }
    catch {
      process.stderr.write('⚠ verify-code-rules: unparseable output, not blocking commit\n')
      process.exit(0)
    }
    if (!findings.length) process.exit(0)
    process.stderr.write('commit blocked by verify-code-rules, fix before committing:\n' +
      findings.map((v) => `  - [${v.ruleId}] ${v.file}:${v.line} - ${v.message}`).join('\n') + '\n')
    process.exit(1)
  }
  if (r.status !== 0) {
    const reason = r.error ? r.error.message : r.status === null ? `timeout after ${T}ms` : `unexpected exit ${r.status}`
    process.stderr.write(`⚠ verify-code-rules gate could not run (${reason}); not blocking this commit, run docs-tdd changed manually\n`)
  }
  process.exit(0)
}

main()
