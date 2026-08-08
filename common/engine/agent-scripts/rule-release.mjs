#!/usr/bin/env node

import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const docsRoot = resolve(scriptDir, '../../..')
const commonDir = join(docsRoot, 'common')
const templatesDir = join(docsRoot, 'templates')
const manifestFile = join(commonDir, 'rule-release.json')
const manifestRelativePath = 'common/rule-release.json'
const effectiveManifestRelativePath = 'common/effective-rules.json'
// warn-ledger.json 是 gate 每次运行都更新的可变执行状态（同 rule-release/effective 一类），
// 不参与规则内容指纹，否则每次入账都会让规则发布假性 stale。
const warnLedgerRelativePath = 'common/warn-ledger.json'
const args = process.argv.slice(2)
const json = args.includes('--json')

function printHelp() {
  console.log(`usage: rule-release.mjs <--check|--write|--self-test> [--json]

Publish and verify a content fingerprint for local docs_tdd rules.

Options:
  --check      Fail when rule sources differ from the published manifest
  --write      Run check-doc-budget, then publish the current rule sources
  --self-test  Test deterministic fingerprint and diff behavior
  --json       Print the check result as JSON`)
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

function toDocsRelative(file) {
  return relative(docsRoot, file).split(sep).join('/')
}

// Lark 集成层（机器人/消息卡片/任务存储/长连接网关及其 __tests__）属于「把规则搬进 Lark 展示/协作」的外围插件，
// 不定义规则或门禁语义。整棵 common/ 参与指纹会让这些纯基建改动把规则发布拖成假性 stale，
// 从而阻塞所有 consumer（Codex/Claude/Cursor）的 changed/gate。故按 basename `lark-*` 从规则指纹中排除
// （含 agent-scripts/、agent-scripts/lib/、agent-scripts/__tests__/ 下的 lark 插件与其测试）；
// 规则引擎本体（code-review/gate runner/effective-rules 等）仍参与指纹，保证真规则/门禁变更强制重发布 + golden-run。
function isLarkPlumbing(rel) {
  // AI 自动修 bug 的常驻服务整棵子树（入口/lib/schemas/__tests__/runtime）均为纯基建，
  // 不定义规则或门禁语义 → 全部排除出规则指纹，避免其高频改动把规则发布拖成假性 stale。
  if (rel.startsWith('common/lark-bot/')) return true
  // 兼容历史：曾散落在 agent-scripts 下的 lark 插件（现已迁至 common/lark-bot/）。
  return /(?:^|\/)agent-scripts\/(?:[^/]+\/)?lark-[^/]*\.mjs$/.test(rel)
}

function collectRuleFiles() {
  return [...walkFiles(commonDir), ...walkFiles(templatesDir)]
    .filter((file) => ![manifestRelativePath, effectiveManifestRelativePath, warnLedgerRelativePath].includes(toDocsRelative(file)))
    .filter((file) => {
      const rel = toDocsRelative(file)
      if (isLarkPlumbing(rel)) return false
      return rel.startsWith('templates/') || /\.(?:md|json|mjs)$/.test(rel)
    })
    .sort((a, b) => toDocsRelative(a).localeCompare(toDocsRelative(b)))
}

function createSnapshot(files = collectRuleFiles()) {
  const fileHashes = {}
  for (const file of files) {
    fileHashes[toDocsRelative(file)] = createHash('sha256').update(readFileSync(file)).digest('hex')
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(fileHashes)).digest('hex')
  return { fingerprint, fileCount: Object.keys(fileHashes).length, files: fileHashes }
}

function compareFiles(published = {}, current = {}) {
  const added = Object.keys(current).filter((file) => !(file in published)).sort()
  const removed = Object.keys(published).filter((file) => !(file in current)).sort()
  const changed = Object.keys(current).filter((file) => file in published && current[file] !== published[file]).sort()
  return { added, changed, removed }
}

function readManifest() {
  if (!existsSync(manifestFile)) return null
  try {
    return JSON.parse(readFileSync(manifestFile, 'utf8'))
  } catch (error) {
    return { parseError: error.message }
  }
}

function checkRelease() {
  const current = createSnapshot()
  const published = readManifest()
  const diff = compareFiles(published?.files, current.files)
  const ruleset = JSON.parse(readFileSync(join(commonDir, 'rules', 'ruleset.json'), 'utf8'))
  const manifestValid = Boolean(
    published &&
      !published.parseError &&
      published.version === 1 &&
      typeof published.fingerprint === 'string' &&
      published.files &&
      typeof published.files === 'object',
  )
  const fresh = Boolean(
    manifestValid &&
      published.rulesetVersion === ruleset.version &&
      published.fileCount === current.fileCount &&
      diff.added.length === 0 &&
      diff.changed.length === 0 &&
      diff.removed.length === 0 &&
      published.fingerprint === current.fingerprint,
  )
  return {
    fresh,
    status: !published ? 'missing' : published.parseError || !manifestValid ? 'invalid' : fresh ? 'fresh' : 'stale',
    rulesetVersion: ruleset.version,
    publishedRulesetVersion: published?.rulesetVersion || null,
    publishedFingerprint: published?.fingerprint || null,
    currentFingerprint: current.fingerprint,
    publishedAt: published?.publishedAt || null,
    fileCount: current.fileCount,
    diff,
    parseError: published?.parseError || null,
  }
}

function printCheck(result) {
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (result.fresh) {
    console.log(`rule release: fresh (${result.currentFingerprint.slice(0, 12)}, ${result.fileCount} files)`)
    return
  }
  console.error(`rule release: ${result.status}; published=${result.publishedFingerprint || 'none'} current=${result.currentFingerprint}`)
  for (const key of ['added', 'changed', 'removed']) {
    if (result.diff[key].length) console.error(`${key}: ${result.diff[key].join(', ')}`)
  }
  console.error('run check-doc-budget, then rule-release.mjs --write before context/changed/gate')
}

function publish() {
  const check = spawnSync(process.execPath, [join(scriptDir, 'check-doc-budget.mjs')], {
    cwd: docsRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (check.status !== 0) process.exit(check.status ?? 1)

  // 发布是 gate 机器变更真正生效的那一刻，所以在这里跑 golden run 的文档 gate 契约部分：
  // 基线全绿 + 每个变异用例命中预期规则 ID，防「规则改宽/改死」被发布出去。
  // 聚合器烟测需要已发布的新指纹（run-project-gate 拒绝 stale 链），此刻还没写 manifest，
  // 故这里 --skip-aggregator，那一条留给发布后手动/CI 的完整 `docs-tdd golden`。
  const golden = spawnSync(process.execPath, [join(scriptDir, 'golden-run.mjs'), '--skip-aggregator'], {
    cwd: docsRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (golden.status !== 0) {
    console.error('rule-release: golden run 未通过，拒绝发布（先修 gate 判定，再重试）')
    process.exit(golden.status ?? 1)
  }

  const snapshot = createSnapshot()
  const ruleset = JSON.parse(readFileSync(join(commonDir, 'rules', 'ruleset.json'), 'utf8'))
  const manifest = {
    version: 1,
    rulesetVersion: ruleset.version,
    fingerprint: snapshot.fingerprint,
    publishedAt: new Date().toISOString(),
    fileCount: snapshot.fileCount,
    files: snapshot.files,
  }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`published rule release ${manifest.fingerprint.slice(0, 12)} (${manifest.fileCount} files)`)
}

function selfTest() {
  const fixtures = [
    { path: 'common/a.md', content: 'a' },
    { path: 'templates/b.md', content: 'b' },
  ]
  const snapshot = (items) => {
    const files = Object.fromEntries(
      items.map(({ path, content }) => [path, createHash('sha256').update(content).digest('hex')]).sort(),
    )
    return createHash('sha256').update(JSON.stringify(files)).digest('hex')
  }
  assert.equal(snapshot(fixtures), snapshot([...fixtures].reverse()))
  assert.notEqual(snapshot(fixtures), snapshot([{ ...fixtures[0], content: 'changed' }, fixtures[1]]))
  assert.deepEqual(compareFiles({ a: '1', b: '2' }, { b: '3', c: '4' }), {
    added: ['c'],
    changed: ['b'],
    removed: ['a'],
  })
  assert.equal(statSync(commonDir).isDirectory(), true)
  console.log('rule-release self-test passed.')
}

if (args.includes('--help') || args.length === 0) {
  printHelp()
  process.exit(args.length === 0 ? 1 : 0)
}
if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
if (args.includes('--write')) {
  publish()
  process.exit(0)
}
if (args.includes('--check')) {
  const result = checkRelease()
  printCheck(result)
  process.exit(result.fresh ? 0 : 1)
}

printHelp()
process.exit(1)
