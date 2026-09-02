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

// 规则源分两类：`common/engine/**` 是执行器代码（gate runner / lib / schemas / fixtures / 测试），
// 由 docs_tdd 自身 self-test/golden/CI 保证；其余（common/rules、common/*.md、templates/、ruleset/index/router）
// 是团队正式规则「政策」，可发布、可被业务项目 pin。Phase 2+ 让业务项目只钉政策指纹、引擎变更不阻塞它们。
// Phase 1 仅产出这两个子指纹，组合指纹 `fingerprint` 与 fresh 判定保持不变（下游零感知）。
export function classifyRuleFile(rel) {
  return rel.startsWith('common/engine/') ? 'engine' : 'policy'
}

function fingerprintOf(fileHashes) {
  return createHash('sha256').update(JSON.stringify(fileHashes)).digest('hex')
}

function partitionByClass(fileHashes) {
  const policy = {}
  const engine = {}
  // 保持插入顺序 = 排序后的 rel 顺序，指纹才确定性可复现。
  for (const [rel, hash] of Object.entries(fileHashes)) {
    if (classifyRuleFile(rel) === 'engine') engine[rel] = hash
    else policy[rel] = hash
  }
  return { policy, engine }
}

function createSnapshot(files = collectRuleFiles()) {
  const fileHashes = {}
  for (const file of files) {
    fileHashes[toDocsRelative(file)] = createHash('sha256').update(readFileSync(file)).digest('hex')
  }
  const fingerprint = fingerprintOf(fileHashes)
  const { policy, engine } = partitionByClass(fileHashes)
  return {
    fingerprint,
    policyFingerprint: fingerprintOf(policy),
    engineFingerprint: fingerprintOf(engine),
    fileCount: Object.keys(fileHashes).length,
    policyFileCount: Object.keys(policy).length,
    engineFileCount: Object.keys(engine).length,
    files: fileHashes,
  }
}

// 发布快照的 docs_tdd commit：Phase 2 让业务项目按 commit 读不可变规则内容用。
// 不参与任何指纹（manifest 自身即被排除）；取不到时记 null，不阻断。
function currentCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: docsRoot, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
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
      (published.version === 1 || published.version === 2) &&
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
  // 分类子指纹：published 侧无论新旧格式都从 published.files 现分类重算，兼容 v1 manifest。
  const publishedParts = partitionByClass(published?.files || {})
  const publishedPolicyFingerprint = fingerprintOf(publishedParts.policy)
  const publishedEngineFingerprint = fingerprintOf(publishedParts.engine)
  const policyDiff = compareFiles(publishedParts.policy, partitionByClass(current.files).policy)
  const engineDiff = compareFiles(publishedParts.engine, partitionByClass(current.files).engine)
  const policyFresh = Boolean(manifestValid && publishedPolicyFingerprint === current.policyFingerprint)
  const engineFresh = Boolean(manifestValid && publishedEngineFingerprint === current.engineFingerprint)
  return {
    fresh,
    status: !published ? 'missing' : published.parseError || !manifestValid ? 'invalid' : fresh ? 'fresh' : 'stale',
    rulesetVersion: ruleset.version,
    publishedRulesetVersion: published?.rulesetVersion || null,
    publishedFingerprint: published?.fingerprint || null,
    currentFingerprint: current.fingerprint,
    // Phase 1 附加：分类指纹 + 分类 fresh/diff（组合 fresh 仍是硬闸，下游未切换前行为不变）。
    policyFingerprint: current.policyFingerprint,
    engineFingerprint: current.engineFingerprint,
    publishedPolicyFingerprint,
    publishedEngineFingerprint,
    policyFresh,
    engineFresh,
    policyDiff,
    engineDiff,
    publishedCommit: published?.commit || null,
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
  // 指纹未变则保留旧 publishedAt：no-op 重发布不改内容、不制造 git churn（此前每次 --write 都刷新时间戳，
  // 即便规则一字未动也产生一次 diff）。指纹是内容真值，只有它变了才代表真的发布了新一版。
  const prior = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
  const unchanged = prior?.fingerprint === snapshot.fingerprint
  const publishedAt = unchanged && prior?.publishedAt ? prior.publishedAt : new Date().toISOString()
  // commit 同 publishedAt：内容未变的 no-op 重发布保留旧 commit，不因 HEAD 移动制造 diff。
  const commit = unchanged && prior?.commit ? prior.commit : currentCommit()
  const manifest = {
    version: 2,
    rulesetVersion: ruleset.version,
    fingerprint: snapshot.fingerprint,
    // 分类指纹：政策(可发布/可被项目 pin) vs 引擎(docs_tdd 自测/CI 保证)。组合 fingerprint 仍是过渡期硬闸真值。
    policyFingerprint: snapshot.policyFingerprint,
    engineFingerprint: snapshot.engineFingerprint,
    commit,
    publishedAt,
    fileCount: snapshot.fileCount,
    policyFileCount: snapshot.policyFileCount,
    engineFileCount: snapshot.engineFileCount,
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

  // 分类：common/engine/** → engine，其余 → policy。
  assert.equal(classifyRuleFile('common/engine/agent-scripts/docs-tdd.mjs'), 'engine')
  assert.equal(classifyRuleFile('common/engine/agent-scripts/lib/rule-consumption.mjs'), 'engine')
  assert.equal(classifyRuleFile('common/rules/hook-integration.md'), 'policy')
  assert.equal(classifyRuleFile('common/rules/ruleset.json'), 'policy')
  assert.equal(classifyRuleFile('templates/x.md'), 'policy')

  // 子指纹相互独立：改引擎文件动 engine+组合、不动 policy；改政策文件动 policy+组合、不动 engine。
  const base = createSnapshot([])
  const withPolicy = { 'common/rules/a.md': 'h1', 'common/engine/lib/x.mjs': 'h2' }
  const snap = (hashes) => {
    const { policy, engine } = partitionByClass(hashes)
    return { fingerprint: fingerprintOf(hashes), policyFingerprint: fingerprintOf(policy), engineFingerprint: fingerprintOf(engine) }
  }
  const s0 = snap(withPolicy)
  const sPolicyChanged = snap({ ...withPolicy, 'common/rules/a.md': 'h1b' })
  const sEngineChanged = snap({ ...withPolicy, 'common/engine/lib/x.mjs': 'h2b' })
  assert.notEqual(s0.fingerprint, sPolicyChanged.fingerprint)
  assert.notEqual(s0.policyFingerprint, sPolicyChanged.policyFingerprint)
  assert.equal(s0.engineFingerprint, sPolicyChanged.engineFingerprint, '改政策文件不应影响 engine 子指纹')
  assert.notEqual(s0.fingerprint, sEngineChanged.fingerprint)
  assert.notEqual(s0.engineFingerprint, sEngineChanged.engineFingerprint)
  assert.equal(s0.policyFingerprint, sEngineChanged.policyFingerprint, '改引擎文件不应影响 policy 子指纹')
  assert.ok(base.fingerprint && base.policyFingerprint && base.engineFingerprint, 'createSnapshot 应产出三类指纹')

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
