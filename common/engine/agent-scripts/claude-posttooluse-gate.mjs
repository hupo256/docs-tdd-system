#!/usr/bin/env node
// claude-posttooluse-gate.mjs — Claude Code PostToolUse hook dispatcher
// Agent Edit/Write after -> dispatch to machine gate; violations via stderr + exit 2.
// Dispatch: apps/web/src/**/*.{ts,tsx}, package.json -> verify-code-rules.mjs --files <f> --json
//           apps/web/config/environments/.env* -> verify-code-rules.mjs --files <f> --global-scan --json
//           apps/web/docs_tdd/common/*.md, rule-index.json, templates/*.md -> check-doc-budget.mjs
// Exit: 0 = ok/na; 2 = violation (blocks, fed to Claude); 1 = gate could not run
//       (non-blocking, surfaced to user so a failed/timed-out gate never reads as pass).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const T = 5000

function printHelp() {
  console.log(`usage: claude-posttooluse-gate.mjs [--help]

Claude Code PostToolUse hook dispatcher.
Reads a JSON payload from stdin and dispatches to the appropriate machine gate
(verify-code-rules for source/env edits, check-doc-budget for docs_tdd edits).

Options:
  --help  Show this help message and exit`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

function readStdin() { try { return readFileSync(0, 'utf8') } catch { return '' } }
function gitTop(d) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: d, encoding: 'utf8', stdio: ['ignore','pipe','ignore'], timeout: T })
  return r.status === 0 ? r.stdout.trim() : ''
}
function main() {
  const raw = readStdin()
  if (!raw.trim()) process.exit(0)
  let payload
  try { payload = JSON.parse(raw) } catch { process.exit(0) }
  const fp = payload && payload.tool_input && payload.tool_input.file_path
  if (!fp || typeof fp !== 'string' || !existsSync(fp)) process.exit(0)
  const root = gitTop(dirname(fp))
  if (!root) process.exit(0)
  const rel = relative(root, fp)
  const violations = []
  const gateErrors = []
  const spawnReason = (r) => (r.error ? r.error.message : r.status === null ? `timeout after ${T}ms` : `unexpected exit ${r.status}`)
  if (/^apps\/web\/src\/.+\.(ts|tsx)$/.test(rel) || rel === 'package.json' || /^apps\/web\/config\/environments\/\.env/.test(rel)) {
    const s = join(SCRIPT_DIR, 'verify-code-rules.mjs')
    if (existsSync(s)) {
      const gateArgs = [s, '--files', rel, '--json']
      if (/^apps\/web\/config\/environments\/\.env/.test(rel)) gateArgs.push('--global-scan')
      const r = spawnSync('node', gateArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: T })
      if (r.status === 1 && r.stdout) {
        try { for (const v of (JSON.parse(r.stdout).findings || [])) violations.push('[' + v.ruleId + '] ' + v.file + ':' + v.line + ' - ' + v.message) }
        catch { gateErrors.push('verify-code-rules: unparseable output') }
      } else if (r.status !== 0) {
        gateErrors.push('verify-code-rules: ' + spawnReason(r))
      }
    }
  }
  if (/^apps\/web\/docs_tdd\/common\/rules\/[^/]+\.md$/.test(rel) || rel === 'apps/web/docs_tdd/common/rules/rule-index.json' || /^apps\/web\/docs_tdd\/templates\/[^/]+\.md$/.test(rel)) {
    const s = join(SCRIPT_DIR, 'check-doc-budget.mjs')
    if (existsSync(s)) {
      const r = spawnSync('node', [s], { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: T })
      if (r.status === 1) violations.push('[DOC-BUDGET] resident-budget/route-coverage failed:\n' + ((r.stdout || '') + '\n' + (r.stderr || '')).trim())
      else if (r.status !== 0) gateErrors.push('check-doc-budget: ' + spawnReason(r))
    }
  }
  if (violations.length) {
    process.stderr.write('machine gate blocked (' + rel + '): fix before continuing:\n' + violations.map(v => '  - ' + v).join('\n') + '\n')
    process.exit(2)
  }
  if (gateErrors.length) {
    // Infra failure must not block the edit, but must not read as pass either.
    process.stderr.write('⚠ machine gate could not run (' + rel + '); result is unknown, run docs-tdd changed manually:\n' + gateErrors.map(e => '  - ' + e).join('\n') + '\n')
    process.exit(1)
  }
  process.exit(0)
}
try { main() } catch (error) {
  process.stderr.write('⚠ machine gate hook error: ' + (error && error.message ? error.message : String(error)) + '\n')
  process.exit(1)
}
