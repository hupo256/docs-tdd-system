#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, realpathSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { resolveRoots } from './lib/roots.mjs'

const { docsSystemRoot, consumerRoot: repoRoot, config } = resolveRoots()
const commonDir = join(docsSystemRoot, 'common')
const manifestFile = join(commonDir, 'effective-rules.json')
const home = homedir()
const args = process.argv.slice(2)
const json = args.includes('--json')

const g = config.globalAdapters
const sources = {
  l1: [
    join(g.aiRules, 'AGENT.md'),
    join(g.aiRules, 'skills/coding-quality/SKILL.md'),
    join(g.aiRules, 'skills/figma-read/SKILL.md'),
  ],
  adapters: [
    join(g.codex, 'AGENTS.md'),
    join(g.claude, 'CLAUDE.md'),
    g.cursorLocalGovernance,
    join(g.claude, 'settings.json'),
  ],
  skillEntries: [
    join(g.codex, 'skills/coding-quality'),
    join(g.claude, 'skills/coding-quality'),
    join(g.codex, 'skills/figma-read'),
    join(g.claude, 'skills/figma-read'),
  ],
}

function printHelp() {
  console.log(`usage: effective-rules.mjs <--check|--write|--doctor|--self-test> [--json]

Publish and diagnose the effective local rules consumed by Codex, Claude, and Cursor.`)
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
  if (file.startsWith(`${repoRoot}/`)) return relative(repoRoot, file).split(sep).join('/')
  if (file.startsWith(`${home}/`)) return `~/${relative(home, file).split(sep).join('/')}`
  return relative(repoRoot, file).split(sep).join('/')
}

function collectL2Files() {
  const s = config.ruleSurfaces
  return [...s.agents.map((f) => join(repoRoot, f)), ...s.claude.map((f) => join(repoRoot, f)), ...walkFiles(join(repoRoot, s.cursorRulesDir))]
    .filter((file) => existsSync(file) && (file.endsWith('.md') || file.endsWith('.mdc')))
    .sort((a, b) => label(a).localeCompare(label(b)))
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
  if (label(file) === SETTINGS_LABEL) return createHash('sha256').update(stableSettingsInput(raw.toString('utf8'))).digest('hex')
  return createHash('sha256').update(raw).digest('hex')
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function readL3Release() {
  const file = join(commonDir, 'rule-release.json')
  return existsSync(file) ? readJson(file) : null
}

function createSnapshot() {
  const requiredFiles = [...sources.l1, ...sources.adapters, ...collectL2Files()]
  const missing = requiredFiles.filter((file) => !existsSync(file)).map(label)
  const files = {}
  for (const file of requiredFiles.filter(existsSync).sort((a, b) => label(a).localeCompare(label(b)))) {
    files[label(file)] = hashFile(file)
  }
  const l3 = readL3Release()
  const composition = {
    files,
    l3RuleReleaseFingerprint: l3?.fingerprint || null,
    skillTargets: Object.fromEntries(
      sources.skillEntries.map((entry) => [label(entry), existsSync(entry) ? label(realpathSync(entry)) : null]),
    ),
  }
  return {
    fingerprint: createHash('sha256').update(JSON.stringify(composition)).digest('hex'),
    fileCount: Object.keys(files).length,
    files,
    l3RuleReleaseFingerprint: composition.l3RuleReleaseFingerprint,
    skillTargets: composition.skillTargets,
    missing,
  }
}

function compareFiles(published = {}, current = {}) {
  return {
    added: Object.keys(current).filter((file) => !(file in published)).sort(),
    changed: Object.keys(current).filter((file) => file in published && current[file] !== published[file]).sort(),
    removed: Object.keys(published).filter((file) => !(file in current)).sort(),
  }
}

function checkRelease() {
  const current = createSnapshot()
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
  const valid = Boolean(published && !parseError && published.version === 1 && published.files)
  const fresh = Boolean(
    valid &&
      current.missing.length === 0 &&
      published.fingerprint === current.fingerprint &&
      published.fileCount === current.fileCount &&
      published.l3RuleReleaseFingerprint === current.l3RuleReleaseFingerprint &&
      JSON.stringify(published.skillTargets) === JSON.stringify(current.skillTargets) &&
      Object.values(diff).every((items) => items.length === 0),
  )
  return {
    fresh,
    status: !published ? 'missing' : parseError || !valid ? 'invalid' : fresh ? 'fresh' : 'stale',
    publishedFingerprint: published?.fingerprint || null,
    currentFingerprint: current.fingerprint,
    l3RuleReleaseFingerprint: current.l3RuleReleaseFingerprint,
    fileCount: current.fileCount,
    missing: current.missing,
    diff,
    parseError,
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
  for (const skill of ['coding-quality', 'figma-read']) {
    const codex = join(home, `.codex/skills/${skill}`)
    const claude = join(home, `.claude/skills/${skill}`)
    const canonical = join(home, `.ai-rules/skills/${skill}`)
    const same = existsSync(codex) && existsSync(claude) && existsSync(canonical) && realpathSync(codex) === realpathSync(canonical) && realpathSync(claude) === realpathSync(canonical)
    add('L1-SINGLE-SOURCE', same, 'error', `${skill} ${same ? 'resolves to one shared source' : 'does not resolve to the shared source'}`, label(canonical))
  }
  const settingsText = existsSync(sources.adapters[3]) ? readFileSync(sources.adapters[3], 'utf8') : ''
  const claudeHook = settingsText.includes('PostToolUse') && settingsText.includes('claude-posttooluse-gate.mjs')
  add('CLAUDE-HOOK', claudeHook, 'error', `Claude PostToolUse dispatcher ${claudeHook ? 'is configured' : 'is missing'}`, label(sources.adapters[3]))

  const release = checkRelease()
  add('EFFECTIVE-RELEASE', release.fresh, 'error', `effective rules release is ${release.status}`, label(manifestFile))
  const ignored = spawnSync('git', ['check-ignore', '-q', config.docsMountPath], { cwd: repoRoot })
  add('LOCAL-ISOLATION', ignored.status === 0, 'error', `docs_tdd ${ignored.status === 0 ? 'is locally ignored' : 'is not ignored'}`, config.docsMountPath)
  const protectedPaths = config.protectedRuleSurfaces
  const trackedChanges = spawnSync('git', ['status', '--short', '--', ...protectedPaths], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim()
  add('TRACKED-RULE-ISOLATION', !trackedChanges, 'error', trackedChanges ? `tracked rule surfaces have local changes: ${trackedChanges.replace(/\n/g, '; ')}` : 'tracked rule surfaces are unchanged', repoRoot)

  const trackedRefs = [
    ['CLAUDE.md', '.cursor/rules/react-component-comments.mdc'],
    ['.cursor/rules/frontend-harness.mdc', '.ai-harness'],
  ]
  for (const [owner, target] of trackedRefs) {
    const exists = existsSync(join(repoRoot, target))
    add('L2-STALE-REFERENCE', exists, 'warn', `${owner} references ${target}, which ${exists ? 'exists' : 'is missing'}`, owner)
  }
  const swrRule = join(repoRoot, '.cursor/rules/client-swr-dedup.mdc')
  const reactQueryRule = join(repoRoot, 'AGENTS.md')
  const conflict = existsSync(swrRule) && readFileSync(swrRule, 'utf8').includes('SWR') && readFileSync(reactQueryRule, 'utf8').includes('React Query')
  add('L2-CONFLICT', !conflict, 'warn', conflict ? 'tracked rules conflict: SWR versus React Query' : 'no known SWR/React Query conflict', label(swrRule))

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
  if (snapshot.missing.length) {
    console.error(`cannot publish effective rules; missing: ${snapshot.missing.join(', ')}`)
    process.exit(1)
  }
  const manifest = {
    version: 1,
    fingerprint: snapshot.fingerprint,
    publishedAt: new Date().toISOString(),
    l3RuleReleaseFingerprint: snapshot.l3RuleReleaseFingerprint,
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
  assert.deepEqual(compareFiles({ a: '1', b: '2' }, { b: '3', c: '4' }), { added: ['c'], changed: ['b'], removed: ['a'] })
  assert.equal(createHash('sha256').update(JSON.stringify({ a: 1 })).digest('hex'), createHash('sha256').update(JSON.stringify({ a: 1 })).digest('hex'))
  assert.equal(lstatSync(repoRoot).isDirectory(), true)
  // settings.json 投影：只认 hooks 变化，忽略 permissions 等易变态（否则新鲜度门禁自我否定）。
  const base = JSON.stringify({ hooks: { PostToolUse: [1] }, permissions: { allow: ['a'] } })
  const permChanged = JSON.stringify({ hooks: { PostToolUse: [1] }, permissions: { allow: ['a', 'b'] } })
  const hooksChanged = JSON.stringify({ hooks: { PostToolUse: [2] }, permissions: { allow: ['a'] } })
  assert.equal(stableSettingsInput(base), stableSettingsInput(permChanged))
  assert.notEqual(stableSettingsInput(base), stableSettingsInput(hooksChanged))
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
