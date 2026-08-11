#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createContextPack,
  expandScenarioRefs,
  inspectEffectiveRules,
  inspectRuleRelease,
  requireFreshEffectiveRules,
  requireFreshRuleRelease,
  selectMarkdownSections,
} from './lib/context-pack.mjs'
import { heartbeatDecision, maybeBroadcastGate, printGateHeartbeat } from './lib/gate-heartbeat.mjs'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { resolveRuleSessionClient } from './lib/rule-session.mjs'
import { CODING_SCENARIOS, requireRuleSession, verifyG2Ready, writeRuleSession } from './lib/rule-session-runtime.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree, config } = resolveRoots()
const releaseScript = join(scriptDir, 'rule-release.mjs')
const effectiveRulesScript = join(scriptDir, 'effective-rules.mjs')
const cliArgs = process.argv.slice(2)
const [command, projectId] = cliArgs
const commandArgs = cliArgs.slice(2)
const clientIndex = commandArgs.indexOf('--client')
if (clientIndex >= 0 && !commandArgs[clientIndex + 1]) {
  console.error('--client requires one of: codex, claude, cursor, manual')
  process.exit(1)
}
let agentClient
try {
  agentClient = resolveRuleSessionClient({ requested: clientIndex >= 0 ? commandArgs[clientIndex + 1] : undefined })
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const positional = commandArgs.filter((arg, index) => !arg.startsWith('--') && commandArgs[index - 1] !== '--client')
const detail = positional[0]
const fullContext = cliArgs.includes('--full')
const noCache = cliArgs.includes('--no-cache')

function run(args, cwd = repoRoot) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit' })
  return result.status ?? 1
}

function runCaptured(args, cwd = repoRoot) {
  const started = Date.now()
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    durationMs: Date.now() - started,
  }
}

function safeLogLabel(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'check'
  )
}

function persistCapturedLog(id, label, result) {
  const logDir = join(tmpdir(), 'docs-tdd-logs', id)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logFile = join(logDir, `${stamp}-${safeLogLabel(label)}.log`)
  mkdirSync(logDir, { recursive: true })
  writeFileSync(logFile, [`status: ${result.status}`, `durationMs: ${result.durationMs}`, '', '--- stdout ---', result.stdout.trim(), '', '--- stderr ---', result.stderr.trim(), ''].join('\n'))
  return logFile
}

function conciseFailure(result, limit = 12) {
  const lines = `${result.stderr}\n${result.stdout}`
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const actionable = lines.filter((line) => /\b(?:fail|block|error|warn|action|required|missing|invalid)\b/i.test(line))
  return (actionable.length ? actionable : lines).slice(0, limit)
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function readOptionalJson(file) {
  return existsSync(file) ? readJson(file) : null
}

function gitOutput(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return result.status === 0 ? result.stdout : ''
}

function changedFingerprint(id, worktree, effectiveFingerprint) {
  const trackedDiff = gitOutput(['diff', '--binary', config.baseRef || 'origin/online'], worktree)
  const untracked = gitOutput(['ls-files', '--others', '--exclude-standard'], worktree).trim().split('\n').filter(Boolean)
  const untrackedPayload = untracked
    .map((file) => {
      const absolute = join(worktree, file)
      return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : file
    })
    .join('\n')
  const prdFile = join(resolveProjectRoot(id), 'agent/prd-source-manifest.json')
  const prdHash = existsSync(prdFile) ? createHash('sha256').update(readFileSync(prdFile)).digest('hex') : 'none'
  const projectDir = resolveProjectRoot(id)
  const projectDocs = ['product/00-feature-inventory.md', 'product/03-api-contract.md', 'product/04-frontend-tasks.md', 'product/06-collaboration.md', 'agent/project-manifest.json', 'agent/msw-manifest.json', 'agent/assumptions.json']
    .map((file) => {
      const absolute = join(projectDir, file)
      return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : `${file}\nmissing`
    })
    .join('\n')
  return createHash('sha256').update(`changed-v2\n${id}\n${effectiveFingerprint}\n${prdHash}\n${projectDocs}\n${trackedDiff}\n${untrackedPayload}`).digest('hex').slice(0, 16)
}

function runChanged(id, worktree, effectiveFingerprint) {
  const started = Date.now()
  const fingerprint = changedFingerprint(id, worktree, effectiveFingerprint)
  const cacheDir = join(tmpdir(), 'docs-tdd-check-cache')
  const cacheFile = join(cacheDir, `${id}-changed-${fingerprint}.json`)
  if (!noCache && existsSync(cacheFile)) {
    const cached = readJson(cacheFile)
    console.log(`changed: ${id} — PASS (cache=hit, checks=${cached.checks}, duration=${Date.now() - started}ms, fingerprint=${fingerprint})`)
    return 0
  }

  const projectManifest = readOptionalJson(join(resolveProjectRoot(id), 'agent/project-manifest.json'))
  const checks = [
    {
      label: 'code-rules',
      args: [join(scriptDir, 'verify-code-rules.mjs'), '--project', id],
    },
  ]
  if (projectManifest?.pilot?.msw)
    checks.push({
      label: 'msw-manifest',
      args: [join(scriptDir, 'verify-msw-manifest.mjs'), id],
    })
  if (projectManifest?.pilot?.prdIntake)
    checks.push({
      label: 'prd-intake',
      args: [join(scriptDir, 'prd-intake.mjs'), id, '--stage', 'G2'],
    })

  let status = 0
  for (const check of checks) {
    const result = runCaptured(check.args, worktree)
    const logFile = persistCapturedLog(id, check.label, result)
    if (result.status === 0) console.log(`PASS ${check.label} (${result.durationMs}ms)`)
    else {
      status ||= result.status
      console.error(`FAIL ${check.label} (${result.durationMs}ms)`)
      for (const line of conciseFailure(result)) console.error(`  ${line}`)
      console.error(`  full log: ${logFile}`)
    }
  }
  const durationMs = Date.now() - started
  console.log(`changed: ${id} — ${status === 0 ? 'PASS' : 'BLOCK'} (cache=miss, checks=${checks.length}, duration=${durationMs}ms, fingerprint=${fingerprint})`)
  if (status === 0 && !noCache) {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(cacheFile, `${JSON.stringify({ id, fingerprint, checks: checks.length, durationMs })}\n`)
  }
  return status
}

function recommendScenarios(worktree) {
  const files = new Set(
    [
      ...gitOutput(['diff', '--name-only', config.baseRef || 'origin/online'], worktree)
        .trim()
        .split('\n'),
      ...gitOutput(['ls-files', '--others', '--exclude-standard'], worktree).trim().split('\n'),
    ].filter(Boolean),
  )
  const recommendations = []
  const add = (scenario, reason) => {
    if (!recommendations.some((item) => item.scenario === scenario)) recommendations.push({ scenario, reason })
  }
  for (const file of files) {
    if (/(?:map[A-Z][^/]*|mapper)\.(?:ts|tsx)$/i.test(file)) add('write_mapper', file)
    if (/(?:mocks?\/handlers|fixtures?|msw)/i.test(file)) add('write_msw', file)
    if (/(?:use[A-Z][^/]*Query|query)\.(?:ts|tsx)$/i.test(file)) add('write_query_hook', file)
    if (/\.(?:tsx|css|scss|less)$/.test(file)) add('write_ui', file)
    if (/figma|07-figma-spec/i.test(file)) add('write_figma', file)
  }
  console.log(recommendations.length ? recommendations.map((item) => `${item.scenario}: ${item.reason}`).join('\n') : 'no scenario recommendation; choose explicitly')
}

function resolveProjectWorktree(id) {
  const projectDir = id ? resolveProjectRoot(id) : ''
  const readmeFile = projectDir ? join(projectDir, 'README.md') : ''
  const readme = readmeFile && existsSync(readmeFile) ? readFileSync(readmeFile, 'utf8') : ''
  const configured = readme
    .match(/^worktree:\s*(.*)$/m)?.[1]
    ?.replace(/^['"]|['"]$/g, '')
    .trim()
  const cwdWorktree = consumerWorktree && consumerWorktree !== docsRoot ? consumerWorktree : ''
  const worktree = configured ? resolve(projectDir, configured) : cwdWorktree || repoRoot
  return {
    configured: Boolean(configured),
    exists: existsSync(worktree),
    worktree: existsSync(worktree) ? worktree : repoRoot,
    requestedWorktree: worktree,
  }
}

function capability(id) {
  const projectDir = id ? resolveProjectRoot(id) : ''
  const manifestFile = projectDir ? join(projectDir, 'agent/project-manifest.json') : ''
  const manifest = manifestFile && existsSync(manifestFile) ? readJson(manifestFile) : null
  const resolvedWorktree = resolveProjectWorktree(id)
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  const release = inspectRuleRelease()
  const effectiveRules = inspectEffectiveRules()
  const hook = process.env.CLAUDE_PROJECT_DIR ? 'claude-posttooluse' : 'manual-agent-adapter'
  console.log(`docs_tdd root: ${docsRoot}`)
  console.log(`agent client: ${agentClient}`)
  console.log(`agent adapter: ${hook}`)
  console.log(`automatic post-edit hook: ${hook === 'claude-posttooluse' ? 'available' : 'unavailable'}`)
  console.log(`fallback: run docs-tdd changed ${id || '<PROJECT-ID>'} before completion`)
  console.log(`ruleset: ${manifest?.rulesetVersion || ruleset.version} (${ruleset.maturity})`)
  console.log(`rule release: ${release.status || 'invalid'} (${(release.currentFingerprint || 'unknown').slice(0, 12)})`)
  console.log(`effective rules: ${effectiveRules.status || 'invalid'} (${(effectiveRules.currentFingerprint || 'unknown').slice(0, 12)})`)
  console.log(`project worktree: ${resolvedWorktree.worktree}`)
  if (!resolvedWorktree.exists) console.warn(`warning: configured worktree does not exist: ${resolvedWorktree.requestedWorktree}; falling back to ${repoRoot}`)
  else if (!resolvedWorktree.configured && id) console.warn(`warning: project worktree is not configured; falling back to ${repoRoot}`)
  if (!release.fresh) console.warn('warning: context/changed/gate are blocked until the current rules are published')
  if (!effectiveRules.fresh) console.warn('warning: context/changed/gate are blocked until effective rules are published')
}

if (process.argv.includes('--self-test')) {
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  if (!ruleset.version || !ruleset.maturity) process.exit(1)
  const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
  if (!Array.isArray(index.scenarios?.write_mapper) || index.scenarios.write_mapper.length === 0) process.exit(1)
  const markdown = ['# Test', '', '## 1. One', 'one', '', '## 2 Two', 'two', '', '## 3. Three', 'three'].join('\n')
  assert.equal(selectMarkdownSections(markdown, '2'), ['## 2 Two', 'two', '', ''].join('\n'))
  assert.equal(selectMarkdownSections(markdown, '1-2'), ['## 1. One', 'one', '', '## 2 Two', 'two', '', ''].join('\n'))
  assert.throws(() => selectMarkdownSections(markdown, '2-1'), /invalid section selector/)
  assert.throws(() => selectMarkdownSections(markdown, 'x'), /invalid section selector/)
  assert.throws(() => selectMarkdownSections(markdown, '4'), /did not match any heading/)
  assert(expandScenarioRefs(index, 'g6_verify').some((ref) => ref.file === 'quality-checklist.md'))
  const release = inspectRuleRelease()
  assert.equal(typeof release.currentFingerprint, 'string')
  const effectiveRules = inspectEffectiveRules()
  assert.equal(typeof effectiveRules.currentFingerprint, 'string')
  // gate 心跳判定
  assert.equal(heartbeatDecision({ located: false }).level, 'skip')
  assert.equal(heartbeatDecision({ located: true, isGitRepo: false }).level, 'skip')
  assert.equal(
    heartbeatDecision({
      located: true,
      isGitRepo: true,
      noDivergence: true,
      gate: null,
    }).level,
    'skip',
  ) // 无代码可 gate → 不催
  assert.equal(
    heartbeatDecision({
      located: true,
      isGitRepo: true,
      noDivergence: false,
      gate: null,
    }).level,
    'warn',
  ) // 有改动却从未跑 → 催
  assert.equal(
    heartbeatDecision({
      located: true,
      isGitRepo: true,
      noDivergence: false,
      gate: { ok: false, gate: 'G5' },
    }).level,
    'warn',
  )
  assert.equal(
    heartbeatDecision({
      located: true,
      isGitRepo: true,
      noDivergence: false,
      gate: { ok: true, gate: 'G5' },
      matches: true,
    }).level,
    'ok',
  )
  assert.equal(
    heartbeatDecision({
      located: true,
      isGitRepo: true,
      noDivergence: false,
      gate: { ok: true, gate: 'G5' },
      matches: false,
    }).level,
    'warn',
  )
  console.log('docs-tdd self-test passed.')
  process.exit(0)
}

if (command === 'capability') {
  capability(projectId)
  process.exit(0)
}

if (command === 'doctor') {
  const doctorFlags = commandArgs.filter((arg) => ['--json', '--allow-tracked-rule-changes'].includes(arg))
  process.exit(run([effectiveRulesScript, '--doctor', ...doctorFlags]))
}

if (command === 'release') {
  process.exit(run([join(scriptDir, 'publish-rule-chain.mjs'), ...cliArgs.slice(1)]))
}

// golden 不针对具体项目：它用保留夹具 PR-00000 回归 gate 机器自己，所以必须在项目 ID 校验之前分流。
if (command === 'golden') {
  process.exit(run([join(scriptDir, 'golden-run.mjs'), ...cliArgs.slice(1)]))
}

// guard：机器层兜底守护，一条命令串跑三检——发布是否 fresh、gate 机器自身能否回归、三端规则加载/冲突。
// project-agnostic，手动/按需运行（不装 launchd/cron；个人本地，机器层正确性不再只靠"每次记得跑"）。
if (command === 'guard') {
  let worst = 0
  const step = (label, args) => {
    console.log(`\n=== docs-tdd guard: ${label} ===`)
    const code = run(args)
    if (code !== 0) worst = code
    return code
  }
  // 先查发布 fresh：stale 时 golden 的聚合器烟测跑不了（run-project-gate 拒 stale 指纹链），
  // 据此决定是否给 golden 传 --skip-aggregator，而不是伪装通过。stale 本身即 worst≠0，guard 会判 BLOCK。
  const releaseFresh = step('rule-release --check', [releaseScript, '--check']) === 0
  step('golden-run', [join(scriptDir, 'golden-run.mjs'), ...(releaseFresh ? [] : ['--skip-aggregator'])])
  step('doctor (effective-rules)', [effectiveRulesScript, '--doctor'])
  console.log(`\ndocs-tdd guard: ${worst === 0 ? 'PASS — 机器层回归/发布/加载三检通过' : 'BLOCK — 见上方失败项'}`)
  process.exit(worst)
}

if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '')) {
  console.error('usage: docs-tdd.mjs <kickoff|status|resume|next|capability|doctor|release|golden|guard|check|gate|context|changed|recommend> PR-01234 [G0-G8|scenario] [--compact|--full|--no-cache] [--client codex|claude|cursor|manual]')
  process.exit(1)
}

if (['kickoff', 'status', 'resume', 'next'].includes(command)) {
  process.exit(run([join(scriptDir, 'project-orchestrator.mjs'), command, projectId, ...cliArgs.slice(2)]))
}

capability(projectId)
const resolvedWorktree = resolveProjectWorktree(projectId)
const { worktree } = resolvedWorktree
let status = 0
if (command === 'check') status = run([join(scriptDir, 'check-doc-budget.mjs')])
else {
  const release = requireFreshRuleRelease()
  if (!release) process.exit(1)
  const effectiveRules = requireFreshEffectiveRules()
  if (!effectiveRules) process.exit(1)
  if (command === 'gate') {
    if (['G5', 'G6', 'G7', 'G8'].includes((detail || 'G3').toUpperCase()) && !requireRuleSession(projectId, worktree, release, effectiveRules, agentClient)) process.exit(1)
    status = run([join(scriptDir, 'run-project-gate.mjs'), projectId, detail || 'G3', '--write', ...(noCache ? ['--no-cache'] : [])], worktree)
    if (status === 0) maybeBroadcastGate(projectId, (detail || 'G3').toUpperCase())
  } else if (command === 'changed') {
    if (!requireRuleSession(projectId, worktree, release, effectiveRules, agentClient)) process.exit(1)
    status = runChanged(projectId, worktree, effectiveRules.currentFingerprint)
  } else if (command === 'context') {
    try {
      const scenario = detail || 'g0_g2_scope'
      if (CODING_SCENARIOS.has(scenario) && !verifyG2Ready(projectId, worktree, scriptDir)) process.exit(1)
      const pack = createContextPack(projectId, scenario, release, effectiveRules, fullContext ? 'full' : 'compact')
      console.log(`scenario: ${scenario}`)
      console.log(`context mode: ${pack.mode}`)
      console.log(`context fingerprint: ${pack.fingerprint}`)
      console.log(`context pack: ${pack.output}`)
      console.log(`context metrics: sources=${pack.refs.length}, sourceChars=${pack.sourceChars}, packChars=${pack.packChars}, cache=${pack.cacheHit ? 'hit' : 'miss'}, duration=${pack.durationMs}ms`)
      console.log(`routed rules: ${pack.refs.join(', ')}`)
      if (CODING_SCENARIOS.has(scenario)) writeRuleSession(projectId, worktree, release, effectiveRules, pack, agentClient)
      printGateHeartbeat(projectId, resolvedWorktree)
    } catch (error) {
      console.error(error.message)
      status = 1
    }
  } else if (command === 'recommend') {
    recommendScenarios(worktree)
  } else {
    console.error(`unknown command: ${command}`)
    status = 1
  }
}
process.exit(status)
