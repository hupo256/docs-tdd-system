#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codeFingerprint, matchesGateFingerprint } from './lib/fingerprint.mjs'
import { resolveProjectRoot, resolveRoots, rulesRoot } from './lib/roots.mjs'
import { CODING_SCENARIOS, requireRuleSession, verifyG2Ready, writeRuleSession } from './lib/rule-session-runtime.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree, config } = resolveRoots()
const releaseScript = join(scriptDir, 'rule-release.mjs')
const effectiveRulesScript = join(scriptDir, 'effective-rules.mjs')
const cliArgs = process.argv.slice(2)
const [command, projectId] = cliArgs
const positional = cliArgs.slice(2).filter((arg) => !arg.startsWith('--'))
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

function inspectRuleRelease() {
  const result = spawnSync(process.execPath, [releaseScript, '--check', '--json'], { cwd: repoRoot, encoding: 'utf8' })
  try {
    return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
  } catch (error) {
    return {
      fresh: false,
      status: 'invalid',
      parseError: error.message,
      exitCode: result.status ?? 1,
    }
  }
}

function inspectEffectiveRules() {
  const result = spawnSync(process.execPath, [effectiveRulesScript, '--check', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  try {
    return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
  } catch (error) {
    return {
      fresh: false,
      status: 'invalid',
      parseError: error.message,
      exitCode: result.status ?? 1,
    }
  }
}

// 重构期临时开关：DOCS_TDD_SKIP_RULE_FRESHNESS=1 跳过新鲜度硬闸（context/changed/gate 前置），
// 稳定后不设此 env 即恢复严格模式。
const skipRuleFreshness = process.env.DOCS_TDD_SKIP_RULE_FRESHNESS === '1'

function requireFreshRuleRelease() {
  if (skipRuleFreshness) {
    console.error('[docs-tdd] ⚠ DOCS_TDD_SKIP_RULE_FRESHNESS=1：跳过 rule-release 新鲜度检查（重构期临时开关）')
    return { fresh: true, skipped: true }
  }
  const release = inspectRuleRelease()
  if (release.fresh) return release
  console.error(`rule release is ${release.status || 'invalid'}; current=${release.currentFingerprint || 'unknown'} published=${release.publishedFingerprint || 'none'}`)
  for (const key of ['added', 'changed', 'removed']) {
    if (release.diff?.[key]?.length) console.error(`${key}: ${release.diff[key].join(', ')}`)
  }
  console.error('run docs-tdd check <PROJECT-ID>, then rule-release.mjs --write before context/changed/gate')
  return null
}

function requireFreshEffectiveRules() {
  if (skipRuleFreshness) {
    console.error('[docs-tdd] ⚠ DOCS_TDD_SKIP_RULE_FRESHNESS=1：跳过 effective-rules 新鲜度检查（重构期临时开关）')
    return { fresh: true, skipped: true }
  }
  const release = inspectEffectiveRules()
  if (release.fresh) return release
  console.error(`effective rules release is ${release.status || 'invalid'}; current=${release.currentFingerprint || 'unknown'} published=${release.publishedFingerprint || 'none'}`)
  if (release.missing?.length) console.error(`missing: ${release.missing.join(', ')}`)
  console.error('run effective-rules.mjs --doctor, fix errors, then effective-rules.mjs --write')
  return null
}

function normalizeRuleRef(ref) {
  if (typeof ref === 'string') return { file: ref, sections: '' }
  if (ref && typeof ref.file === 'string') return { file: ref.file, sections: ref.sections || '' }
  throw new Error(`invalid rule reference: ${JSON.stringify(ref)}`)
}

function expandScenarioRefs(index, scenario, stack = []) {
  if (stack.includes(scenario)) throw new Error(`scenario cycle: ${[...stack, scenario].join(' -> ')}`)
  const refs = index.scenarios?.[scenario]
  if (!Array.isArray(refs) || refs.length === 0) {
    const available = Object.keys(index.scenarios || {})
      .sort()
      .join(', ')
    throw new Error(`unknown scenario: ${scenario}; available: ${available}`)
  }
  const expanded = refs.flatMap((ref) => {
    if (ref && typeof ref.scenario === 'string') return expandScenarioRefs(index, ref.scenario, [...stack, scenario])
    return [normalizeRuleRef(ref)]
  })
  const seen = new Set()
  return expanded.filter((ref) => {
    const key = `${ref.file}#${ref.sections}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function selectMarkdownSections(text, selector) {
  if (!selector) return text
  const match = /^(\d+)(?:-(\d+))?$/.exec(selector)
  if (!match) throw new Error(`invalid section selector: ${selector}`)
  const min = Number(match[1])
  const max = Number(match[2] || match[1])
  if (max < min) throw new Error(`invalid section selector: ${selector}`)
  const headings = [...text.matchAll(/^##\s+(\d+)(?:\.|\s)/gm)]
  const start = headings.find((heading) => Number(heading[1]) === min)?.index
  const end = headings.find((heading) => Number(heading[1]) > max)?.index
  if (start === undefined) throw new Error(`section selector ${selector} did not match any heading`)
  return text.slice(start, end ?? text.length)
}

function createContextPack(id, scenario, release, effectiveRules, mode = 'compact') {
  const started = Date.now()
  const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
  const refs = expandScenarioRefs(index, scenario)

  const summaryRef = {
    file: `${id}/agent/context-summary.md`,
    sections: '',
    abs: join(resolveProjectRoot(id), 'agent/context-summary.md'),
  }
  const sources = [
    summaryRef,
    ...refs.map((normalized) => {
      // 规则文档在 common/rules/；少数被场景引用的 common/ 层文件（如 CHANGELOG.md）回退到 common/。
      const rulesPath = join(rulesRoot, normalized.file)
      const inRules = existsSync(rulesPath)
      return {
        file: inRules ? `common/rules/${normalized.file}` : `common/${normalized.file}`,
        abs: inRules ? rulesPath : join(docsRoot, 'common', normalized.file),
        sections: mode === 'full' ? '' : normalized.sections,
      }
    }),
  ]
  const sections = sources.map((source) => {
    const file = source.abs
    if (!existsSync(file)) throw new Error(`context source does not exist: ${source.file}`)
    const raw = readFileSync(file, 'utf8')
    return {
      label: `${source.file}${source.sections ? `#§${source.sections}` : ''}`,
      text: selectMarkdownSections(raw, source.sections),
    }
  })
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  const payload = sections.map(({ label, text }) => `${label}\n${text}`).join('\n')
  const fingerprint = createHash('sha256').update(`${effectiveRules.currentFingerprint}\n${scenario}\n${mode}\n${payload}`).digest('hex').slice(0, 12)
  const cacheDir = join(tmpdir(), 'docs-tdd-context')
  const output = join(cacheDir, `${id}-${scenario}-${mode}-${fingerprint}.md`)
  const conflictOverrides = effectiveRules.clientMatrix?.codex?.conflictOverrides || []
  const body = [
    '<!-- GENERATED CONTEXT PACK: disposable cache; source of truth remains docs_tdd -->',
    `# ${id} / ${scenario}`,
    '',
    `- ruleset: \`${ruleset.version}\``,
    `- rule release: \`${release.currentFingerprint}\``,
    `- effective rules: \`${effectiveRules.currentFingerprint}\``,
    ...conflictOverrides.map((override) => `- L2 conflict override: \`${override.loserFiles.join(', ')}\` -> **${override.winner}** (\`${override.id}\`)`),
    `- mode: \`${mode}\``,
    `- fingerprint: \`${fingerprint}\``,
    `- sources: ${sections.map(({ label }) => `\`${label}\``).join(', ')}`,
    '',
    ...sections.flatMap(({ label, text }) => [`## Source: ${label}`, '', text.trim(), '']),
  ].join('\n')

  mkdirSync(cacheDir, { recursive: true })
  const cacheHit = existsSync(output)
  if (!cacheHit) writeFileSync(output, `${body}\n`)
  return {
    scenario,
    fingerprint,
    output,
    refs: sections.map(({ label }) => label),
    sources,
    mode,
    cacheHit,
    sourceChars: sections.reduce((total, item) => total + Array.from(item.text).length, 0),
    packChars: Array.from(body).length + 1,
    durationMs: Date.now() - started,
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

// Gate heartbeat: warn when the worktree code drifted from the last PASS, so the
// agent doesn't trust a stale green. Diagnostic-only; never blocks. Worktree-level,
// so any dirty change in the feature worktree flips it (feature worktrees are 1-per-PR).
// Gate 心跳判定（纯函数，便于 self-test）：located/isGitRepo 缺失即跳过；无 gate 结果时，
// 若 worktree 与 base 零差异（还没代码可 gate）也跳过，避免对 pre-coding 项目催跑 gate。
function heartbeatDecision({ located, isGitRepo, noDivergence, gate, matches }) {
  if (!located || !isGitRepo) return { level: 'skip' }
  if (!gate)
    return noDivergence
      ? { level: 'skip' }
      : {
          level: 'warn',
          message: '尚无 gate-results.json（从未跑过 gate）；交付前先跑 docs-tdd gate',
        }
  if (gate.ok !== true)
    return {
      level: 'warn',
      message: `上次 ${gate.gate} 未通过（ok=false）；修复后重跑 docs-tdd gate ${gate.gate}`,
    }
  if (matches) return { level: 'ok', message: `${gate.gate} PASS 与当前代码一致` }
  return {
    level: 'warn',
    message: `距上次 ${gate.gate} PASS 后 worktree 代码已变更（worktree 级，非文件级）；交付前先跑 docs-tdd changed/gate`,
  }
}

function gateHeartbeat(id, resolvedWorktree) {
  const located = resolvedWorktree.configured && resolvedWorktree.exists
  if (!located) return { level: 'skip' } // pre-G4 / 未配置 worktree
  const current = codeFingerprint(resolvedWorktree.worktree, config.baseRef || 'origin/online')
  const noDivergence = current.headSha === current.baseSha && current.dirtyFileCount === 0 && current.untrackedFileCount === 0
  const gate = readOptionalJson(join(resolveProjectRoot(id), 'agent/gate-results.json'))
  return heartbeatDecision({
    located,
    isGitRepo: current.isGitRepo,
    noDivergence,
    gate,
    matches: matchesGateFingerprint(current, gate?.fingerprint),
  })
}

function printGateHeartbeat(id, resolvedWorktree) {
  const beat = gateHeartbeat(id, resolvedWorktree)
  if (beat.level === 'warn') console.warn(`⚠ gate 心跳：${beat.message}`)
  else if (beat.level === 'ok') console.log(`✓ gate 心跳：${beat.message}`)
}

// 阶段推进自动播报：gate 通过（exit 0）后，仅当项目 notify 配置 notifyOnGate===true 才发「Gx 已完成」卡片。
// 非阻塞——发送失败只 warn，绝不改 gate 退出码；指纹入幂等键，同代码状态重复跑 gate 不重复刷群。
function maybeBroadcastGate(id, gate) {
  const configPath = join(resolveProjectRoot(id), 'agent/scripts', `${id.toLowerCase()}.json`)
  const notifyConfig = readOptionalJson(configPath)
  if (!notifyConfig?.notifyOnGate) return

  const wrapper = join(resolveProjectRoot(id), 'agent/scripts/notify-lark.mjs')
  if (!existsSync(wrapper)) {
    console.warn(`⚠ notifyOnGate 开启但缺 notify-lark 薄包装：${wrapper}`)
    return
  }

  const gateResult = readOptionalJson(join(resolveProjectRoot(id), 'agent/gate-results.json'))
  const baseSummary = typeof gateResult?.summary === 'string' && gateResult.summary.trim() ? gateResult.summary.trim() : `${gate} 机器校验通过`
  // bug 轮询窗口提醒：进 G6/G7（自测/QA，bug 密集期）提醒开轮询，G8（交付）提醒收工。
  // 这是系统内唯一能感知「进 QA」的信号（收不到 bug 机器人推送），故顺 gate 播报带出。
  const pollHint = gate === 'G6' || gate === 'G7' ? '；建议 lark-bot poll-on 开始接 bug' : gate === 'G8' ? '；bug 处理完可 lark-bot poll-off 收工' : ''
  const summary = `${baseSummary}${pollHint}`
  const fpKey = createHash('sha1')
    .update(JSON.stringify(gateResult?.fingerprint ?? gate))
    .digest('hex')
    .slice(0, 12)
  const idempotencyKey = `${id}-${gate}-${fpKey}`

  const result = spawnSync(process.execPath, [wrapper, gate, '已完成', summary, '--config', configPath, '--idempotency-key', idempotencyKey], { cwd: repoRoot, encoding: 'utf8' })
  if (result.status === 0) {
    console.log(`✓ 阶段播报已发：${id} ${gate} 已完成`)
  } else {
    console.warn(`⚠ 阶段播报失败（不影响 gate）：${(result.stderr || result.stdout || '').trim().slice(0, 200)}`)
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
  process.exit(run([effectiveRulesScript, '--doctor', ...cliArgs.slice(2).filter((arg) => arg.startsWith('--'))]))
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
  console.error('usage: docs-tdd.mjs <kickoff|status|resume|next|capability|doctor|release|golden|guard|check|gate|context|changed|recommend> PR-01234 [G0-G8|scenario] [--compact|--full|--no-cache]')
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
    if (['G5', 'G6', 'G7', 'G8'].includes((detail || 'G3').toUpperCase()) && !requireRuleSession(projectId, worktree, release, effectiveRules)) process.exit(1)
    status = run([join(scriptDir, 'run-project-gate.mjs'), projectId, detail || 'G3', '--write', ...(noCache ? ['--no-cache'] : [])], worktree)
    if (status === 0) maybeBroadcastGate(projectId, (detail || 'G3').toUpperCase())
  } else if (command === 'changed') {
    if (!requireRuleSession(projectId, worktree, release, effectiveRules)) process.exit(1)
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
      if (CODING_SCENARIOS.has(scenario)) writeRuleSession(projectId, worktree, release, effectiveRules, pack)
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
