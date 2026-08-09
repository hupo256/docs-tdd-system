#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { fingerprint, hash, inspectManifest, scanMarkdown, selfTest } from './lib/prd-manifest.mjs'

const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const args = process.argv.slice(2)

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

function projectPaths(projectId) {
  const projectDir = resolveProjectRoot(projectId)
  return { projectDir, manifestFile: join(projectDir, 'agent/prd-source-manifest.json') }
}

// 归属校验跟随软链接：apps/web/docs_tdd 可能是指向 docs 仓库根的 symlink，
// 纯字符串 startsWith 会误判为「不在 docs_tdd 内」，故对存在的路径先取 realpath 再比对。
function insideDocs(absolute) {
  if (!existsSync(absolute)) return false
  let real = absolute
  try { real = realpathSync(absolute) } catch { /* keep absolute */ }
  return real.startsWith(`${docsRoot}/`) || absolute.startsWith(`${docsRoot}/`)
}

function readProjectSource(sourcePath) {
  const absolute = resolve(repoRoot, sourcePath)
  if (!insideDocs(absolute)) return null
  return readFileSync(absolute, 'utf8')
}

function readProjectAsset(assetPath) {
  const absolute = resolve(repoRoot, assetPath)
  if (!insideDocs(absolute)) return null
  return readFileSync(absolute)
}

function initManifest(projectId, sourcePaths) {
  const { projectDir, manifestFile } = projectPaths(projectId)
  const previous = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
  const previousByKey = new Map((previous?.items || []).map((item) => [`${item.locator}:${item.contentHash}`, item]))
  const prefixes = { image: 'IMG', table: 'TABLE', embed: 'EMBED' }
  const counters = Object.fromEntries(Object.entries(prefixes).map(([type, prefix]) => [
    type,
    Math.max(0, ...(previous?.items || [])
      .map((item) => item.sourceId.match(new RegExp(`^PRD-${prefix}-(\\d+)$`))?.[1])
      .filter(Boolean)
      .map(Number)),
  ]))
  const sources = []
  const items = []
  for (const sourcePath of sourcePaths) {
    const text = readProjectSource(sourcePath)
    if (text === null) throw new Error(`PRD source must exist inside docs_tdd: ${sourcePath}`)
    sources.push({ path: sourcePath, contentHash: hash(text) })
    for (const found of scanMarkdown(text, sourcePath, readProjectAsset)) {
      const old = previousByKey.get(`${found.locator}:${found.contentHash}`)
      if (!old) counters[found.type] += 1
      items.push(old || {
        sourceId: `PRD-${prefixes[found.type]}-${String(counters[found.type]).padStart(3, '0')}`,
        ...found,
        status: 'unresolved',
        classification: 'unresolved',
        readMethod: '',
        summary: '',
        featureIds: [],
        disposition: '',
        evidence: '',
      })
    }
  }
  const manifest = { version: 1, projectId, generatedAt: new Date().toISOString(), approvedFingerprint: '', sources, items }
  mkdirSync(dirname(manifestFile), { recursive: true })
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

const projectId = args[0]
if (!/^PR-\d{5}$/.test(projectId || '')) {
  console.error('usage: prd-intake.mjs PR-01234 [--init --source <docs_tdd/*.md> ... | --stage G0|G2 | --approve] [--json]')
  process.exit(1)
}

const { projectDir, manifestFile } = projectPaths(projectId)
if (args.includes('--init')) {
  const sourcePaths = args.flatMap((arg, index) => arg === '--source' && args[index + 1] ? [args[index + 1]] : [])
  if (!sourcePaths.length) throw new Error('--init requires at least one --source path relative to repository root')
  const manifest = initManifest(projectId, sourcePaths)
  console.log(`wrote ${relative(repoRoot, manifestFile)} (${manifest.items.length} rich-media item(s)); resolve every item before G2`)
  process.exit(0)
}

const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
const stage = args.includes('--stage') ? args[args.indexOf('--stage') + 1] : 'G2'
const checks = inspectManifest({
  manifest,
  projectId,
  stage,
  readSource: readProjectSource,
  readAsset: readProjectAsset,
  inventoryText: existsSync(join(projectDir, 'product/00-feature-inventory.md')) ? readFileSync(join(projectDir, 'product/00-feature-inventory.md'), 'utf8') : '',
  taskText: existsSync(join(projectDir, 'product/04-frontend-tasks.md')) ? readFileSync(join(projectDir, 'product/04-frontend-tasks.md'), 'utf8') : '',
})

if (args.includes('--approve')) {
  const blocking = checks.filter((check) => !check.ok && check.ruleId !== 'DOC-PRD-009')
  if (blocking.length) throw new Error(`cannot approve PRD intake: ${blocking.map((check) => check.ruleId).join(', ')}`)
  const currentSources = manifest.sources.map((source) => ({ path: source.path, contentHash: hash(readProjectSource(source.path)) }))
  manifest.sources = currentSources
  manifest.approvedFingerprint = fingerprint(currentSources, manifest.items)
  manifest.generatedAt = new Date().toISOString()
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`approved PRD intake fingerprint ${manifest.approvedFingerprint}`)
  process.exit(0)
}

const result = { ok: checks.every((check) => check.ok), projectId, stage, checks }
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`prd-intake: ${projectId} ${stage} — ${result.ok ? 'PASS' : 'BLOCK'} (${checks.filter((check) => check.ok).length}/${checks.length})`)
  for (const check of checks.filter((item) => !item.ok)) console.log(`FAIL ${check.ruleId} ${check.message}`)
}
process.exit(result.ok ? 0 : 1)
