import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { resolveProjectRoot } from './roots.mjs'
import { CODING_SCENARIOS, codeReadinessFingerprint, validateRuleSession } from './rule-session.mjs'

export { CODING_SCENARIOS }

function runCaptured(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  }
}

function gitOutput(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return result.status === 0 ? result.stdout : ''
}

function currentState(id, worktree, release, effectiveRules) {
  return {
    projectId: id,
    ruleReleaseFingerprint: release.currentFingerprint,
    effectiveRulesFingerprint: effectiveRules.currentFingerprint,
    codeReadinessFingerprint: codeReadinessFingerprint(resolveProjectRoot(id)),
    headSha: gitOutput(['rev-parse', 'HEAD'], worktree).trim() || 'unknown',
  }
}

/** Verify G2 before a coding context can issue a rule session. */
export function verifyG2Ready(id, worktree, scriptDir) {
  const result = runCaptured([join(scriptDir, 'verify-project-gate.mjs'), id, 'G2', '--json'], worktree)
  try {
    const payload = JSON.parse(result.stdout)
    if (result.status === 0 && payload.ok) return true
    const failures = (payload.checks || []).filter((check) => !check.ok && check.severity === 'error')
    console.error(`coding preflight blocked: ${id} has not passed G2`)
    for (const failure of failures.slice(0, 12)) console.error(`  ${failure.ruleId}: ${failure.message}`)
  } catch {
    console.error(`coding preflight blocked: unable to verify G2 (${result.stderr.trim() || 'invalid verifier output'})`)
  }
  return false
}

/** Persist the coding context and source fingerprints as machine evidence. */
export function writeRuleSession(id, worktree, release, effectiveRules, pack) {
  const session = {
    version: 1,
    ...currentState(id, worktree, release, effectiveRules),
    scenario: pack.scenario,
    mode: pack.mode,
    contextFingerprint: pack.fingerprint,
    client: process.env.DOCS_TDD_AGENT_CLIENT || (process.env.CLAUDE_PROJECT_DIR ? 'claude' : 'manual-agent-adapter'),
    generatedAt: new Date().toISOString(),
  }
  const file = join(resolveProjectRoot(id), 'agent/rule-session.json')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(session, null, 2)}\n`)
  console.log(`coding rule session: ${file}`)
}

/** Block changed/G5+ when the agent did not load the current coding rules. */
export function requireRuleSession(id, worktree, release, effectiveRules) {
  const file = join(resolveProjectRoot(id), 'agent/rule-session.json')
  const session = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  const result = validateRuleSession({
    session,
    current: currentState(id, worktree, release, effectiveRules),
  })
  if (result.ok) return true
  console.error(`[VERIFY-RULE-002] coding rule session is missing or stale: ${result.errors.join('; ')}`)
  console.error(`run docs-tdd context ${id} <coding-scenario> before editing or delivering business code`)
  return false
}
