#!/usr/bin/env node
// claude-posttooluse-gate.mjs — shared Claude/Codex PostToolUse hook dispatcher
// Agent Edit/Write after -> dispatch to machine gate; violations via stderr + exit 2.
// Dispatch: apps/web/src/**/*.{ts,tsx}, package.json -> verify-code-rules.mjs --files <f> --json
//           apps/web/config/environments/.env* -> verify-code-rules.mjs --files <f> --global-scan --json
//           apps/web/docs_tdd/common/*.md, rule-index.json, templates/*.md -> check-doc-budget.mjs
// Exit: 0 = ok/na; 2 = violation (blocks, fed to Claude); 1 = gate could not run
//       (non-blocking, surfaced to user so a failed/timed-out gate never reads as pass).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { classifyTargets } from './lib/hook-targets.mjs'
import { appendInjectionTelemetry } from './lib/rule-injection-telemetry.mjs'
import { loadConfig, resolveProjectRoot } from './lib/roots.mjs'
import { projectIdForWorktree, workflowVersionForProject } from './lib/workflow-version.mjs'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const T = 18000

export function classifyGateTargets(targets, unknownWrite = false) {
  return {
    codeTargets: targets.filter((rel) => /^apps\/web\/src\/.+\.(ts|tsx)$/.test(rel) || rel === 'package.json' || /^apps\/web\/config\/environments\/\.env/.test(rel)),
    docsTargets: targets.filter((rel) => /^apps\/web\/docs_tdd\/common\/rules\/[^/]+\.md$/.test(rel) || rel === 'apps/web/docs_tdd/common/rules/rule-index.json' || /^apps\/web\/docs_tdd\/templates\/[^/]+\.md$/.test(rel)),
    globalScan: targets.some((rel) => /^apps\/web\/config\/environments\/\.env/.test(rel)),
    scanAllChanged: unknownWrite,
  }
}

function printHelp() {
  console.log(`usage: claude-posttooluse-gate.mjs [--help]

Claude/Codex PostToolUse hook dispatcher.
Reads a JSON payload from stdin and dispatches to the appropriate machine gate
(verify-code-rules for source/env edits, check-doc-budget for docs_tdd edits).

Options:
  --help  Show this help message and exit`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

if (process.argv.includes('--self-test')) {
  const actual = classifyGateTargets(['apps/web/src/a.ts', 'apps/web/src/b.tsx', 'apps/web/docs_tdd/common/rules/a.md', 'README.md'])
  if (actual.codeTargets.join(',') !== 'apps/web/src/a.ts,apps/web/src/b.tsx' || actual.docsTargets.join(',') !== 'apps/web/docs_tdd/common/rules/a.md' || actual.globalScan || actual.scanAllChanged) process.exit(1)
  const env = classifyGateTargets(['apps/web/config/environments/.env.test'])
  if (!env.globalScan || env.codeTargets.length !== 1) process.exit(1)
  if (!classifyGateTargets([], true).scanAllChanged) process.exit(1)
  console.log('PASS posttooluse-code-gate (multi-file dispatch)')
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
  const root = gitTop(payload?.cwd || process.cwd())
  if (!root) process.exit(0)
  const { repoTargets, unknownWrite } = classifyTargets(payload, root)
  const targets = repoTargets.filter((file) => existsSync(join(root, file)))
  if (!targets.length && !unknownWrite) process.exit(0)
  const violations = []
  const gateErrors = []
  const spawnReason = (r) => (r.error ? r.error.message : r.status === null ? `timeout after ${T}ms` : `unexpected exit ${r.status}`)
  const dispatch = classifyGateTargets(targets, unknownWrite)
  if (dispatch.codeTargets.length || dispatch.scanAllChanged) {
    const s = join(SCRIPT_DIR, 'verify-code-rules.mjs')
    if (existsSync(s)) {
      const gateArgs = [s, '--json']
      if (dispatch.codeTargets.length) gateArgs.push('--files', dispatch.codeTargets.join(','))
      if (dispatch.globalScan) gateArgs.push('--global-scan')
      else gateArgs.push('--no-global-scan')
      const r = spawnSync('node', gateArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: T })
      if (r.status === 1 && r.stdout) {
        try { for (const v of (JSON.parse(r.stdout).findings || [])) violations.push('[' + v.ruleId + '] ' + v.file + ':' + v.line + ' - ' + v.message) }
        catch { gateErrors.push('verify-code-rules: unparseable output') }
      } else if (r.status !== 0) {
        gateErrors.push('verify-code-rules: ' + spawnReason(r))
      }
    }
  }
  if (dispatch.docsTargets.length) {
    const s = join(SCRIPT_DIR, 'check-doc-budget.mjs')
    if (existsSync(s)) {
      const r = spawnSync('node', [s], { cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], timeout: T })
      if (r.status === 1) violations.push('[DOC-BUDGET] resident-budget/route-coverage failed:\n' + ((r.stdout || '') + '\n' + (r.stderr || '')).trim())
      else if (r.status !== 0) gateErrors.push('check-doc-budget: ' + spawnReason(r))
    }
  }
  const telemetryClient = process.env.CODEX_THREAD_ID ? 'codex' : process.env.CLAUDE_SESSION_ID ? 'claude' : process.env.PI_SESSION_ID ? 'pi' : 'hook'
  let projectId = process.env.DOCS_TDD_PROJECT_ID || null
  let workflowVersion = 1
  try {
    const { config } = loadConfig({ cwd: root, consumerWorktree: root })
    projectId ||= projectIdForWorktree(root, config)
    workflowVersion = workflowVersionForProject(projectId, { resolveProjectRoot })
  } catch {
    // Telemetry enrichment is best-effort; the quality result remains authoritative.
  }
  appendInjectionTelemetry(
    { worktree: root, sessionId: payload.session_id || `${telemetryClient}-unknown`, client: telemetryClient, workflowVersion },
    {
      event: 'quality-gate',
      projectId,
      targetClasses: [...new Set(targets.map((file) => file.match(/\.[^.\/]+$/)?.[0]?.toLowerCase() || 'extensionless'))].sort(),
      injectedBytes: 0,
      retryCount: violations.length ? 1 : 0,
      manualIntervention: 'not-observed',
      qualityOutcome: violations.length ? 'issues-found' : gateErrors.length ? 'unknown-infrastructure-error' : 'pass',
      qualityIssueCount: violations.length,
      qualityGateErrorCount: gateErrors.length,
    },
  )
  if (violations.length) {
    process.stderr.write('machine gate blocked (' + (targets.join(', ') || 'changed files') + '): fix before continuing:\n' + violations.map(v => '  - ' + v).join('\n') + '\n')
    process.exit(2)
  }
  if (gateErrors.length) {
    // Infra failure must not block the edit, but must not read as pass either.
    process.stderr.write('⚠ machine gate could not run (' + (targets.join(', ') || 'changed files') + '); result is unknown, run docs-tdd changed manually:\n' + gateErrors.map(e => '  - ' + e).join('\n') + '\n')
    process.exit(1)
  }
  process.exit(0)
}
try { main() } catch (error) {
  process.stderr.write('⚠ machine gate hook error: ' + (error && error.message ? error.message : String(error)) + '\n')
  process.exit(1)
}
