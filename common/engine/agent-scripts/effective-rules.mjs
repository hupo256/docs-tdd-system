#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAgentClientMatrix, REQUIRED_AGENT_CLIENT_IDS, validateAgentClientMatrix } from './lib/agent-clients.mjs'
import { createCursorAdapter } from './lib/agent-rule-adapters.mjs'
import { resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot, consumerRoot: repoRoot, config } = resolveRoots()
const commonDir = join(docsSystemRoot, 'common')
const manifestFile = join(commonDir, 'effective-rules.json')
const home = homedir()
const args = process.argv.slice(2)
const json = args.includes('--json')
const allowTrackedRuleChanges = args.includes('--allow-tracked-rule-changes')

const g = config.globalAdapters
const conflictOverrides = (Array.isArray(config.ruleConflictOverrides) ? config.ruleConflictOverrides : [])
  .filter((override) => override && typeof override.id === 'string' && typeof override.winner === 'string' && Array.isArray(override.loserFiles))
  .map((override) => ({ id: override.id, winner: override.winner, loserFiles: [...override.loserFiles].sort(), reason: override.reason || '' }))
  .sort((a, b) => a.id.localeCompare(b.id))
const expectedCursorAdapter = createCursorAdapter({
  sharedRoot: g.aiRules,
  repoRoot,
  conflictOverrides,
})
const sources = {
  l1: [join(g.aiRules, 'AGENT.md'), join(g.aiRules, 'skills/coding-quality/SKILL.md'), join(g.aiRules, 'skills/figma-read/SKILL.md')],
  adapters: [join(g.codex, 'AGENTS.md'), join(g.claude, 'CLAUDE.md'), g.cursorLocalGovernance, join(g.claude, 'settings.json')],
  runtimeAdapters: [
    join(docsSystemRoot, 'common/lark-bot/lib/lark-rule-context.mjs'),
    join(docsSystemRoot, 'common/lark-bot/lib/lark-worker-prompts.mjs'),
    join(docsSystemRoot, 'common/lark-bot/lib/lark-worker-run.mjs'),
  ],
  skillEntries: [join(g.codex, 'skills/coding-quality'), join(g.claude, 'skills/coding-quality'), join(g.codex, 'skills/figma-read'), join(g.claude, 'skills/figma-read')],
}

function printHelp() {
  console.log(`usage: effective-rules.mjs <--check|--write|--doctor|--self-test> [--json]

Publish and diagnose the effective local rules consumed by every registered AI entrypoint.

Options:
  --allow-tracked-rule-changes  Allow an explicitly approved dirty tracked rule surface for this maintenance run.`)
}

function walkFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

function label(file) {
  if (file.startsWith(`${docsSystemRoot}/`)) return relative(docsSystemRoot, file).split(sep).join('/')
  if (file.startsWith(`${repoRoot}/`)) return relative(repoRoot, file).split(sep).join('/')
  if (file.startsWith(`${home}/`)) return `~/${relative(home, file).split(sep).join('/')}`
  return relative(repoRoot, file).split(sep).join('/')
}

function collectL2Files() {
  const s = config.ruleSurfaces
  return [...s.agents.map((f) => join(repoRoot, f)), ...s.claude.map((f) => join(repoRoot, f)), ...walkFiles(join(repoRoot, s.cursorRulesDir))].filter((file) => existsSync(file) && (file.endsWith('.md') || file.endsWith('.mdc'))).sort((a, b) => label(a).localeCompare(label(b)))
}

const SETTINGS_LABEL = '~/.claude/settings.json'

// settings.json 含 harness 易变状态（permissions、会话态），整文件参与 effective 指纹会让新鲜度门禁
// 自我否定：harness 每改一次 settings，context/gate 就被误挡、逼迫无谓 republish，反而稀释「证明消费了
// 哪组规则」的价值。effective 真正依赖的只是 hooks 适配（PostToolUse 注册），故只取 hooks 子树。纯函数以便自测。
function stableSettingsInput(rawText) {
  try {
    return JSON.stringify({ hooks: JSON.parse(rawText).hooks ?? null })
  } catch {
    return rawText
  }
}

function hashFile(file) {
  const raw = readFileSync(file)
  if (label(file) === SETTINGS_LABEL)
    return createHash('sha256')
      .update(stableSettingsInput(raw.toString('utf8')))
      .digest('hex')
  return createHash('sha256').update(raw).digest('hex')
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function readL3Release() {
  const file = join(commonDir, 'rule-release.json')
  return existsSync(file) ? readJson(file) : null
}

function createClientMatrix(l3Fingerprint) {
  const canonicalSources = {
    l1: sources.l1.map(label),
    l2: collectL2Files().map(label),
    l3Router: `${config.docsMountPath}/common/rules/rule-router.md`,
    l3Fingerprint,
    conflictOverrides,
  }
  return createAgentClientMatrix({
    canonicalSources,
    adapterLabels: {
      codex: label(sources.adapters[0]),
      claude: label(sources.adapters[1]),
      cursor: label(sources.adapters[2]),
      lark: sources.runtimeAdapters.map(label).join(' + '),
    },
  })
}

function inspectL3Release() {
  const result = spawnSync(process.execPath, [join(scriptDir, 'rule-release.mjs'), '--check', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
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

function cursorAdapterMatches() {
  return existsSync(g.cursorLocalGovernance) && readFileSync(g.cursorLocalGovernance, 'utf8') === expectedCursorAdapter
}

function pathsResolveToCanonical(entries, canonical) {
  if (!existsSync(canonical)) return false
  const target = realpathSync(canonical)
  return entries.every((entry) => existsSync(entry) && realpathSync(entry) === target)
}

function declaresSWR(text) {
  return /\bUse SWR\b|\buseSWR(?:Mutation)?\s*\(|from\s+['"]swr(?:\/mutation)?['"]/.test(text)
}

function findL2Conflicts() {
  const reactQueryRule = join(repoRoot, 'AGENTS.md')
  if (!existsSync(reactQueryRule) || !readFileSync(reactQueryRule, 'utf8').includes('React Query')) return []
  return collectL2Files()
    .filter((file) => declaresSWR(readFileSync(file, 'utf8')))
    .map(label)
}

// 通用检测：仓库级三入口(AGENTS.md/CLAUDE.md/.cursor/rules)重叠正文是否回潮。
// 登记在 config.repoEntryDuplicates(docs-tdd.config.default.json)，不是硬编码在这里——
// 条目可随收敛进度增删，避免变成永久性、无法审计的硬编码对（见上面 L2-CONFLICT 的历史教训）。
function findRepoEntryDuplicates() {
  const entries = Array.isArray(config.repoEntryDuplicates) ? config.repoEntryDuplicates : []
  const violations = []
  for (const entry of entries) {
    for (const banned of Array.isArray(entry.bannedIn) ? entry.bannedIn : []) {
      const file = join(repoRoot, banned.file)
      if (!existsSync(file)) continue
      const text = readFileSync(file, 'utf8')
      for (const substring of banned.mustNotContain || []) {
        if (text.includes(substring)) {
          violations.push({ id: entry.id, file: banned.file, canonicalFile: entry.canonicalFile, canonicalAnchor: entry.canonicalAnchor, substring })
        }
      }
    }
  }
  return violations
}

function resolveL2Conflicts(conflicts, overrides = conflictOverrides, canonicalL1 = existsSync(sources.l1[0]) ? readFileSync(sources.l1[0], 'utf8') : '') {
  const resolved = []
  const unresolved = []
  for (const file of conflicts) {
    const override = overrides.find((candidate) => candidate.loserFiles.includes(file) && canonicalL1.includes(candidate.winner))
    if (override) resolved.push({ file, override })
    else unresolved.push(file)
  }
  return { resolved, unresolved }
}

function createSnapshot() {
  const requiredFiles = [...sources.l1, ...sources.adapters, ...sources.runtimeAdapters, ...collectL2Files()]
  const missing = requiredFiles.filter((file) => !existsSync(file)).map(label)
  const files = {}
  for (const file of requiredFiles.filter(existsSync).sort((a, b) => label(a).localeCompare(label(b)))) {
    files[label(file)] = hashFile(file)
  }
  const l3 = readL3Release()
  const clientMatrix = createClientMatrix(l3?.fingerprint || null)
  const composition = {
    files,
    l3RuleReleaseFingerprint: l3?.fingerprint || null,
    clientMatrix,
    skillTargets: Object.fromEntries(sources.skillEntries.map((entry) => [label(entry), existsSync(entry) ? label(realpathSync(entry)) : null])),
  }
  return {
    fingerprint: createHash('sha256').update(JSON.stringify(composition)).digest('hex'),
    fileCount: Object.keys(files).length,
    files,
    l3RuleReleaseFingerprint: composition.l3RuleReleaseFingerprint,
    clientMatrix,
    skillTargets: composition.skillTargets,
    missing,
  }
}

function compareFiles(published = {}, current = {}) {
  return {
    added: Object.keys(current)
      .filter((file) => !(file in published))
      .sort(),
    changed: Object.keys(current)
      .filter((file) => file in published && current[file] !== published[file])
      .sort(),
    removed: Object.keys(published)
      .filter((file) => !(file in current))
      .sort(),
  }
}

function checkRelease() {
  const current = createSnapshot()
  const l3Release = inspectL3Release()
  let published = null
  let parseError = null
  if (existsSync(manifestFile)) {
    try {
      published = readJson(manifestFile)
    } catch (error) {
      parseError = error.message
    }
  }
  const diff = compareFiles(published?.files, current.files)
  const valid = Boolean(published && !parseError && published.version === 2 && published.files && published.clientMatrix)
  const fresh = Boolean(
    valid &&
      l3Release.fresh &&
      current.missing.length === 0 &&
      published.fingerprint === current.fingerprint &&
      published.fileCount === current.fileCount &&
      published.l3RuleReleaseFingerprint === current.l3RuleReleaseFingerprint &&
      JSON.stringify(published.clientMatrix) === JSON.stringify(current.clientMatrix) &&
      JSON.stringify(published.skillTargets) === JSON.stringify(current.skillTargets) &&
      Object.values(diff).every((items) => items.length === 0),
  )
  return {
    fresh,
    status: !published ? 'missing' : parseError || !valid ? 'invalid' : fresh ? 'fresh' : 'stale',
    publishedFingerprint: published?.fingerprint || null,
    currentFingerprint: current.fingerprint,
    l3RuleReleaseFingerprint: current.l3RuleReleaseFingerprint,
    clientMatrix: current.clientMatrix,
    fileCount: current.fileCount,
    missing: current.missing,
    diff,
    parseError,
    l3Release: {
      fresh: Boolean(l3Release.fresh),
      status: l3Release.status || 'invalid',
      publishedFingerprint: l3Release.publishedFingerprint || null,
      currentFingerprint: l3Release.currentFingerprint || null,
    },
  }
}

function containsProtocol(file) {
  if (!existsSync(file)) return false
  const text = readFileSync(file, 'utf8')
  return ['rule-router.md', 'docs-tdd.mjs context', 'docs-tdd.mjs changed', 'docs-tdd.mjs gate'].every((token) => text.includes(token))
}

function doctor() {
  const checks = []
  const add = (id, ok, severity, message, file = '') => checks.push({ id, ok, severity, message, file })
  for (const file of [...sources.l1, ...sources.adapters.slice(0, 3)]) {
    add('ADAPTER-EXISTS', existsSync(file), 'error', `${label(file)} ${existsSync(file) ? 'exists' : 'is missing'}`, label(file))
  }
  for (const file of sources.adapters.slice(0, 3)) {
    add('ADAPTER-PROTOCOL', containsProtocol(file), 'error', `${label(file)} ${containsProtocol(file) ? 'declares' : 'does not declare'} router/context/changed/gate`, label(file))
  }
  const cursorExact = cursorAdapterMatches()
  add('ADAPTER-EXACT', cursorExact, 'error', `${label(g.cursorLocalGovernance)} ${cursorExact ? 'matches the generated canonical adapter' : 'differs from the generated canonical adapter; rerun install-local-agent-rules.mjs'}`, label(g.cursorLocalGovernance))
  const adapterTargets = [join(repoRoot, config.docsMountPath, 'common/rules/rule-router.md'), join(repoRoot, config.docsMountPath, 'common/engine/agent-scripts/docs-tdd.mjs')]
  const targetsExist = adapterTargets.every(existsSync)
  add('ADAPTER-TARGETS', targetsExist, 'error', targetsExist ? 'router and docs-tdd command targets exist' : `missing adapter target: ${adapterTargets.filter((file) => !existsSync(file)).join(', ')}`, config.docsMountPath)
  const matrix = createSnapshot().clientMatrix
  const coverage = validateAgentClientMatrix(matrix)
  const matrixFingerprints = new Set(Object.values(matrix).map((client) => client.sourceFingerprint))
  add(
    'VERIFY-RULE-003',
    coverage.ok,
    'error',
    coverage.ok
      ? `all registered AI entrypoints are covered: ${REQUIRED_AGENT_CLIENT_IDS.join(', ')}`
      : `AI entrypoint coverage invalid; missing=${coverage.missing.join(',') || 'none'} extra=${coverage.extra.join(',') || 'none'} incomplete=${coverage.incomplete.join(',') || 'none'}`,
    label(manifestFile),
  )
  add('VERIFY-RULE-001', matrixFingerprints.size === 1, 'error', matrixFingerprints.size === 1 ? 'all registered AI entrypoints resolve to one canonical L1/L2/L3 source set' : 'client rule source sets diverge', label(manifestFile))
  for (const runtimeAdapter of sources.runtimeAdapters) {
    add('RUNTIME-ADAPTER-EXISTS', existsSync(runtimeAdapter), 'error', `${label(runtimeAdapter)} ${existsSync(runtimeAdapter) ? 'exists' : 'is missing'}`, label(runtimeAdapter))
  }
  for (const skill of ['coding-quality', 'figma-read']) {
    const codex = join(home, `.codex/skills/${skill}`)
    const claude = join(home, `.claude/skills/${skill}`)
    const canonical = join(home, `.ai-rules/skills/${skill}`)
    const same = pathsResolveToCanonical([codex, claude], canonical)
    add('L1-SINGLE-SOURCE', same, 'error', `${skill} ${same ? 'resolves to one shared source' : 'does not resolve to the shared source'}`, label(canonical))
  }
  // 顶层 L1 入口也必须同源：codex/claude 的规则入口须 realpath 到 canonical AGENT.md。
  // 只校验 skill 不够——若有人把 ~/.codex/AGENTS.md 或 ~/.claude/CLAUDE.md 从软链换成分叉的真实文件，
  // ADAPTER-PROTOCOL 的子串匹配仍可能通过，而三端从此读到不同的 L1 craft。这条把「读同一套」焊死到字节级。
  const canonicalL1 = sources.l1[0]
  for (const adapter of [sources.adapters[0], sources.adapters[1]]) {
    const same = pathsResolveToCanonical([adapter], canonicalL1)
    add('L1-TOPLEVEL-SINGLE-SOURCE', same, 'error', `${label(adapter)} ${same ? 'resolves to the shared L1 source' : `does not resolve to shared L1 (${label(canonicalL1)}); replace with symlink via install-local-agent-rules.mjs`}`, label(adapter))
  }
  const settingsText = existsSync(sources.adapters[3]) ? readFileSync(sources.adapters[3], 'utf8') : ''
  const claudeHook = settingsText.includes('PostToolUse') && settingsText.includes('claude-posttooluse-gate.mjs')
  add('CLAUDE-HOOK', claudeHook, 'error', `Claude PostToolUse dispatcher ${claudeHook ? 'is configured' : 'is missing'}`, label(sources.adapters[3]))

  // 强制点对等：Claude 靠自身 PostToolUse hook 拦编辑，但 Codex/Cursor/裸 commit 只能靠消费者仓库的
  // CI 门禁与 pre-commit 接线兜底。这两条接线属于消费者文件（CI 配置、package.json），docs_tdd 无法自注入，
  // 一旦漏接或被删则非 Claude 路径静默裸奔。这里把接线在位与否焊进 doctor（severity=warn：消费者可能用别的
  // CI 或不设 pre-commit，缺失是需暴露的降级而非硬失败）。marker 用 docs_tdd 自带脚本名，保持与业务解耦。
  const wiring = config.enforcementWiring || {}
  const ciMarker = wiring.ciMarker || 'verify-code-rules.mjs'
  const ciCandidates = Array.isArray(wiring.ciConfigCandidates) ? wiring.ciConfigCandidates : ['.gitlab-ci.yml', '.github/workflows']
  const ciFiles = []
  for (const candidate of ciCandidates) {
    const abs = join(repoRoot, candidate)
    if (!existsSync(abs)) continue
    if (lstatSync(abs).isDirectory()) {
      for (const entry of readdirSync(abs)) ciFiles.push(join(abs, entry))
    } else {
      ciFiles.push(abs)
    }
  }
  const ciWired = ciFiles.some((file) => {
    try {
      return lstatSync(file).isFile() && readFileSync(file, 'utf8').includes(ciMarker)
    } catch {
      return false
    }
  })
  add(
    'CI-GATE',
    ciWired,
    'warn',
    ciFiles.length === 0
      ? `no CI config found (${ciCandidates.join(', ')}); verify-code-rules CI gate cannot be confirmed`
      : ciWired
        ? 'verify-code-rules CI gate is wired'
        : `CI config present but verify-code-rules gate not wired (expected "${ciMarker}"); Codex/Cursor/manual MRs bypass the machine rule gate`,
    ciCandidates[0],
  )

  const precommitConfigName = wiring.precommitConfig || 'package.json'
  const precommitMarker = wiring.precommitMarker || 'precommit-verify-code-rules.mjs'
  const precommitConfigPath = join(repoRoot, precommitConfigName)
  const precommitConfigExists = existsSync(precommitConfigPath)
  const precommitWired = precommitConfigExists && readFileSync(precommitConfigPath, 'utf8').includes(precommitMarker)
  add(
    'PRECOMMIT-GATE',
    precommitWired,
    'warn',
    !precommitConfigExists
      ? `no ${precommitConfigName} found; verify-code-rules pre-commit gate cannot be confirmed`
      : precommitWired
        ? 'verify-code-rules pre-commit gate is wired'
        : `${precommitConfigName} present but pre-commit gate not wired (expected "${precommitMarker}"); local commits bypass the machine rule gate`,
    precommitConfigName,
  )

  const release = checkRelease()
  add('L3-RELEASE', release.l3Release.fresh, 'error', `L3 rule release is ${release.l3Release.status}`, 'common/rule-release.json')
  add('EFFECTIVE-RELEASE', release.fresh, 'error', `effective rules release is ${release.status}`, label(manifestFile))
  const ignored = spawnSync('git', ['check-ignore', '-q', config.docsMountPath], { cwd: repoRoot })
  add('LOCAL-ISOLATION', ignored.status === 0, 'error', `docs_tdd ${ignored.status === 0 ? 'is locally ignored' : 'is not ignored'}`, config.docsMountPath)
  const protectedPaths = config.protectedRuleSurfaces
  const trackedChanges = spawnSync('git', ['status', '--short', '--', ...protectedPaths], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).stdout.trim()
  const trackedChangesAllowed = Boolean(trackedChanges && allowTrackedRuleChanges)
  add(
    'TRACKED-RULE-ISOLATION',
    !trackedChanges || trackedChangesAllowed,
    'error',
    trackedChanges ? (trackedChangesAllowed ? `explicitly approved tracked rule changes are visible: ${trackedChanges.replace(/\n/g, '; ')}` : `tracked rule surfaces have local changes: ${trackedChanges.replace(/\n/g, '; ')}`) : 'tracked rule surfaces are unchanged',
    repoRoot,
  )

  // 曾有两条硬编码 L2-STALE-REFERENCE guard（react-component-comments.mdc、.ai-harness）——对应引用已在源头清除
  // （component-comments 上移 L1；.ai-harness 工作流下线，frontend-harness.mdc 已精简）。保留会对「按设计已删除」
  // 的文件永久误报、侵蚀信号，故移除。未来若需通用防悬空引用，应做「扫描规则文件里的 .mdc 交叉引用并校验存在」的
  // 通用检查，而非再堆硬编码对。
  const conflicts = resolveL2Conflicts(findL2Conflicts())
  add(
    'L2-CONFLICT',
    conflicts.unresolved.length === 0,
    'error',
    conflicts.unresolved.length
      ? `unresolved tracked rules conflict: SWR versus React Query in ${conflicts.unresolved.join(', ')}`
      : conflicts.resolved.length
        ? `tracked conflict resolved by explicit local override: ${conflicts.resolved.map(({ file, override }) => `${file} -> ${override.winner}`).join(', ')}`
        : 'no known SWR/React Query conflict',
    conflicts.unresolved[0] || conflicts.resolved[0]?.file || '.cursor/rules',
  )

  const repoEntryDupes = findRepoEntryDuplicates()
  add(
    'L2-REPO-ENTRY-DUP',
    repoEntryDupes.length === 0,
    'error',
    repoEntryDupes.length
      ? `repo-level entry duplicates canonical prose: ${repoEntryDupes.map((v) => `${v.file} repeats "${v.substring}" (canonical: ${v.canonicalFile} § ${v.canonicalAnchor})`).join('; ')}`
      : 'no known repo-level entry duplicates (see repoEntryDuplicates config)',
    repoEntryDupes[0]?.file || 'AGENTS.md',
  )

  const failed = checks.filter((check) => !check.ok)
  const result = {
    ok: !failed.some((check) => check.severity === 'error'),
    summary: {
      total: checks.length,
      error: failed.filter((check) => check.severity === 'error').length,
      warn: failed.filter((check) => check.severity === 'warn').length,
    },
    effectiveRulesFingerprint: release.currentFingerprint,
    checks,
  }
  if (json) console.log(JSON.stringify(result, null, 2))
  else {
    for (const check of checks) console.log(`${check.ok ? 'PASS' : check.severity.toUpperCase()} ${check.id}: ${check.message}`)
    console.log(`doctor: ${result.ok ? 'PASS' : 'BLOCK'} (error=${result.summary.error}, warn=${result.summary.warn})`)
  }
  return result
}

function publish() {
  const snapshot = createSnapshot()
  const l3Release = inspectL3Release()
  const blockers = []
  if (snapshot.missing.length) blockers.push(`missing: ${snapshot.missing.join(', ')}`)
  if (!l3Release.fresh) blockers.push(`L3 rule release is ${l3Release.status || 'invalid'}`)
  if (!cursorAdapterMatches()) blockers.push('Cursor adapter differs from the generated canonical adapter')
  const conflicts = resolveL2Conflicts(findL2Conflicts())
  if (conflicts.unresolved.length) blockers.push(`unresolved tracked rules conflict: SWR versus React Query in ${conflicts.unresolved.join(', ')}`)
  if (blockers.length) {
    console.error(`cannot publish effective rules; ${blockers.join('; ')}`)
    process.exit(1)
  }
  // 指纹未变则保留旧 publishedAt：no-op 重发布不制造 git churn（同 rule-release.mjs）。
  const prior = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
  const publishedAt = prior?.fingerprint === snapshot.fingerprint && prior?.publishedAt
    ? prior.publishedAt
    : new Date().toISOString()
  const manifest = {
    version: 2,
    fingerprint: snapshot.fingerprint,
    publishedAt,
    l3RuleReleaseFingerprint: snapshot.l3RuleReleaseFingerprint,
    clientMatrix: snapshot.clientMatrix,
    fileCount: snapshot.fileCount,
    skillTargets: snapshot.skillTargets,
    files: snapshot.files,
  }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`published effective rules ${manifest.fingerprint.slice(0, 12)} (${manifest.fileCount} files)`)
}

function printCheck(result) {
  if (json) console.log(JSON.stringify(result, null, 2))
  else if (result.fresh) console.log(`effective rules: fresh (${result.currentFingerprint.slice(0, 12)}, ${result.fileCount} files)`)
  else {
    console.error(`effective rules: ${result.status}; published=${result.publishedFingerprint || 'none'} current=${result.currentFingerprint}`)
    if (result.missing.length) console.error(`missing: ${result.missing.join(', ')}`)
    for (const key of ['added', 'changed', 'removed']) if (result.diff[key].length) console.error(`${key}: ${result.diff[key].join(', ')}`)
  }
}

function selfTest() {
  assert.deepEqual(compareFiles({ a: '1', b: '2' }, { b: '3', c: '4' }), {
    added: ['c'],
    changed: ['b'],
    removed: ['a'],
  })
  assert.equal(
    createHash('sha256')
      .update(JSON.stringify({ a: 1 }))
      .digest('hex'),
    createHash('sha256')
      .update(JSON.stringify({ a: 1 }))
      .digest('hex'),
  )
  assert.equal(lstatSync(repoRoot).isDirectory(), true)
  // settings.json 投影：只认 hooks 变化，忽略 permissions 等易变态（否则新鲜度门禁自我否定）。
  const base = JSON.stringify({
    hooks: { PostToolUse: [1] },
    permissions: { allow: ['a'] },
  })
  const permChanged = JSON.stringify({
    hooks: { PostToolUse: [1] },
    permissions: { allow: ['a', 'b'] },
  })
  const hooksChanged = JSON.stringify({
    hooks: { PostToolUse: [2] },
    permissions: { allow: ['a'] },
  })
  assert.equal(stableSettingsInput(base), stableSettingsInput(permChanged))
  assert.notEqual(stableSettingsInput(base), stableSettingsInput(hooksChanged))
  assert.equal(createCursorAdapter({ sharedRoot: '/shared', repoRoot: '/repo' }).includes('/common/rules/rule-router.md'), true)
  const matrix = createClientMatrix('l3')
  assert.deepEqual(Object.keys(matrix), REQUIRED_AGENT_CLIENT_IDS)
  assert.equal(validateAgentClientMatrix(matrix).ok, true)
  assert.equal(new Set(Object.values(matrix).map((client) => client.sourceFingerprint)).size, 1)
  assert.equal(declaresSWR("import useSWR from 'swr'\nuseSWR('/api', fetcher)"), true)
  assert.equal(declaresSWR('Do not introduce SWR; use React Query.'), false)
  assert.deepEqual(resolveL2Conflicts(['legacy-swr.mdc'], [{ id: 'server-state', winner: 'React Query', loserFiles: ['legacy-swr.mdc'] }], 'Use React Query').unresolved, [])
  assert.deepEqual(resolveL2Conflicts(['unknown.mdc'], [], 'Use React Query').unresolved, ['unknown.mdc'])
  const linkFixture = mkdtempSync(join(tmpdir(), 'effective-rules-links-'))
  const canonical = join(linkFixture, 'canonical.md')
  const linked = join(linkFixture, 'linked.md')
  const divergent = join(linkFixture, 'divergent.md')
  writeFileSync(canonical, 'canonical\n')
  symlinkSync(canonical, linked)
  writeFileSync(divergent, 'canonical\n')
  assert.equal(pathsResolveToCanonical([linked], canonical), true)
  assert.equal(pathsResolveToCanonical([divergent], canonical), false)
  rmSync(linked)
  assert.equal(pathsResolveToCanonical([linked], canonical), false)
  rmSync(linkFixture, { recursive: true, force: true })
  console.log('effective-rules self-test passed.')
}

if (args.includes('--help') || args.length === 0) {
  printHelp()
  process.exit(args.length === 0 ? 1 : 0)
}
if (args.includes('--self-test')) selfTest()
else if (args.includes('--write')) publish()
else if (args.includes('--doctor')) process.exit(doctor().ok ? 0 : 1)
else if (args.includes('--check')) {
  const result = checkRelease()
  printCheck(result)
  process.exit(result.fresh ? 0 : 1)
} else {
  printHelp()
  process.exit(1)
}
