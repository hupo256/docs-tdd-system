#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const args = process.argv.slice(2)

function hash(text) {
  return createHash('sha256').update(text).digest('hex')
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length
}

function imageTarget(raw) {
  const markdown = /^!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/i.exec(raw)
  if (markdown) return markdown[1] || markdown[2]
  return /\bsrc\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1] || ''
}

function resolveAsset(sourcePath, raw, readAsset) {
  const target = imageTarget(raw)
  if (!target) return { assetPath: '', assetHash: '', assetStatus: 'missing' }
  if (/^data:/i.test(target)) return { assetPath: target.slice(0, 48), assetHash: hash(target), assetStatus: 'embedded' }
  if (/^(?:https?:)?\/\//i.test(target)) return { assetPath: target, assetHash: '', assetStatus: 'remote' }

  const cleanTarget = target.split(/[?#]/, 1)[0]
  let decodedTarget = cleanTarget
  try { decodedTarget = decodeURIComponent(cleanTarget) } catch { /* Keep the literal path for malformed exports. */ }
  const assetPath = relative(repoRoot, resolve(repoRoot, dirname(sourcePath), decodedTarget))
  const bytes = readAsset?.(assetPath)
  return bytes === null || bytes === undefined
    ? { assetPath, assetHash: '', assetStatus: 'missing' }
    : { assetPath, assetHash: hash(bytes), assetStatus: 'local' }
}

function scanMarkdown(text, sourcePath, readAsset) {
  const found = []
  // 同一行同类型可能出现多个富媒体（HTML 表格/单行 JSON 导出稿把多张图挤在一行）；
  // 给每次出现附加序号，避免 locator 冲突导致 manifest 按 locator 去重后匹配失败。
  const seq = new Map()
  const add = (type, index, raw) => {
    const line = lineNumber(text, index)
    const key = `${line}:${type}`
    const ordinal = (seq.get(key) || 0) + 1
    seq.set(key, ordinal)
    const asset = type === 'image'
      ? resolveAsset(sourcePath, raw, readAsset)
      : { assetPath: '', assetHash: '', assetStatus: 'not-applicable' }
    found.push({
      type,
      sourcePath,
      line,
      locator: `${sourcePath}#L${line}:${type}:${ordinal}`,
      contentHash: hash(`${raw}\n${asset.assetHash}`),
      ...asset,
    })
  }

  for (const match of text.matchAll(/!\[[^\]]*\]\([^\n)]+\)|<img\b[^>]*>/gi)) add('image', match.index, match[0])
  for (const match of text.matchAll(/<(?:whiteboard|sheet|cite)\b[^>]*>(?:<\/(?:whiteboard|sheet|cite)>)?/gi)) add('embed', match.index, match[0])

  const lines = text.split('\n')
  const lineOffsets = []
  let offset = 0
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index]
    const divider = lines[index + 1]
    if (/^\s*\|.*\|\s*$/.test(header) && /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(divider)) {
      const table = [header, divider]
      let cursor = index + 2
      while (cursor < lines.length && /^\s*\|.*\|\s*$/.test(lines[cursor])) {
        table.push(lines[cursor])
        cursor += 1
      }
      add('table', lineOffsets[index], table.join('\n'))
      index = cursor - 1
    }
  }
  return found.sort((a, b) => a.line - b.line || a.type.localeCompare(b.type))
}

function fingerprint(sources, items) {
  const payload = {
    sources: sources.map(({ path, contentHash }) => ({ path, contentHash })),
    items: items.map(({ sourceId, locator, contentHash, assetPath, assetHash, assetStatus, status, classification, readMethod, summary, featureIds, disposition, evidence }) => ({
      sourceId, locator, contentHash, assetPath, assetHash, assetStatus, status, classification, readMethod, summary, featureIds, disposition, evidence,
    })),
  }
  return hash(JSON.stringify(payload)).slice(0, 16)
}

function inspectManifest({ manifest, projectId, stage, readSource, readAsset, inventoryText = '', taskText = '' }) {
  const checks = []
  const add = (ruleId, ok, message) => checks.push({ ruleId, ok, message, severity: 'error', category: 'documentation' })
  add('DOC-PRD-001', Boolean(manifest) && manifest.projectId === projectId && Array.isArray(manifest.sources) && Array.isArray(manifest.items), 'PRD source manifest exists and has the expected project/collections')
  if (!manifest?.sources || !manifest?.items) return checks

  const currentSources = []
  const discovered = []
  for (const source of manifest.sources) {
    const text = readSource(source.path)
    const exists = text !== null
    add('DOC-PRD-002', exists, `PRD source exists: ${source.path}`)
    if (!exists) continue
    const contentHash = hash(text)
    currentSources.push({ path: source.path, contentHash })
    add('DOC-PRD-008', source.contentHash === contentHash, `PRD source hash has not drifted: ${source.path}`)
    discovered.push(...scanMarkdown(text, source.path, readAsset))
  }

  const manifestByLocator = new Map(manifest.items.map((item) => [item.locator, item]))
  const missing = discovered.filter((item) => !manifestByLocator.has(item.locator) || manifestByLocator.get(item.locator).contentHash !== item.contentHash)
  const stale = manifest.items.filter((item) => !discovered.some((found) => found.locator === item.locator && found.contentHash === item.contentHash))
  add('DOC-PRD-003', missing.length === 0 && stale.length === 0, `all PRD images/tables/embeds are inventoried${missing.length ? `; missing=${missing.map((item) => item.locator).join(',')}` : ''}${stale.length ? `; stale=${stale.map((item) => item.sourceId).join(',')}` : ''}`)
  const assetDrift = manifest.items.filter((item) => item.type === 'image').filter((item) => {
    const current = discovered.find((found) => found.locator === item.locator)
    return current && (current.assetHash !== item.assetHash || current.assetStatus !== item.assetStatus)
  })
  add('DOC-PRD-008', assetDrift.length === 0, `local PRD image assets have not drifted${assetDrift.length ? `: ${assetDrift.map((item) => item.sourceId).join(',')}` : ''}`)

  const ids = new Set()
  const duplicateIds = []
  for (const item of manifest.items) {
    if (ids.has(item.sourceId)) duplicateIds.push(item.sourceId)
    ids.add(item.sourceId)
  }
  add('DOC-PRD-004', duplicateIds.length === 0, `PRD source IDs are unique${duplicateIds.length ? `: ${duplicateIds.join(',')}` : ''}`)

  if (stage !== 'G0') {
    const unresolved = manifest.items.filter((item) => item.status !== 'read' || item.classification === 'unresolved' || !item.readMethod || !item.summary || !item.evidence || (item.type === 'image' && !['local', 'embedded'].includes(item.assetStatus)))
    add('DOC-PRD-005', unresolved.length === 0, `all PRD rich-media inputs are locally readable, read, classified, summarized, and evidenced${unresolved.length ? `: ${unresolved.map((item) => item.sourceId).join(',')}` : ''}`)
    const unmapped = manifest.items.filter((item) => item.classification === 'requirement' && (!item.featureIds.length || item.featureIds.some((id) => !inventoryText.includes(id))))
    const undecided = manifest.items.filter((item) => item.classification === 'decorative' && !item.disposition)
    add('DOC-PRD-006', unmapped.length === 0 && undecided.length === 0, `requirement inputs map to Feature IDs and decorative inputs record disposition${unmapped.length ? `; unmapped=${unmapped.map((item) => item.sourceId).join(',')}` : ''}${undecided.length ? `; no-disposition=${undecided.map((item) => item.sourceId).join(',')}` : ''}`)
    const untracked = manifest.items.filter((item) => item.classification === 'requirement' && (!taskText.includes(item.sourceId) || item.featureIds.some((id) => !taskText.includes(id))))
    add('DOC-PRD-007', untracked.length === 0, `requirement inputs and Feature IDs are traceable in frontend tasks${untracked.length ? `: ${untracked.map((item) => item.sourceId).join(',')}` : ''}`)
    const currentFingerprint = fingerprint(currentSources, manifest.items)
    add('DOC-PRD-009', manifest.approvedFingerprint === currentFingerprint, `G2-approved PRD fingerprint matches current intake${manifest.approvedFingerprint ? ` (expected=${manifest.approvedFingerprint}, current=${currentFingerprint})` : '; run prd-intake.mjs <PROJECT-ID> --approve after resolving intake'}`)
  }
  return checks
}

function projectPaths(projectId) {
  const projectDir = join(docsRoot, projectId)
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

function runSelfTest() {
  const fixturePath = join(docsRoot, 'common/fixtures/prd-intake/prd.md')
  const fixture = readFileSync(fixturePath, 'utf8')
  const sourcePath = 'apps/web/docs_tdd/common/fixtures/prd-intake/prd.md'
  const fixtureAssets = new Map([
    ['apps/web/docs_tdd/common/fixtures/prd-intake/approval-flow.png', Buffer.from('flow-v1')],
    ['apps/web/docs_tdd/common/fixtures/prd-intake/decoration.png', Buffer.from('decoration-v1')],
  ])
  const found = scanMarkdown(fixture, sourcePath, (assetPath) => fixtureAssets.get(assetPath) ?? null)
  assert.deepEqual(found.map(({ type }) => type), ['image', 'table', 'embed', 'image'])
  assert.deepEqual(found.map(({ line }) => line), [7, 11, 16, 18])
  const items = found.map((item, index) => ({
    sourceId: `PRD-${item.type === 'image' ? 'IMG' : item.type === 'table' ? 'TABLE' : 'EMBED'}-${String(index + 1).padStart(3, '0')}`,
    ...item,
    status: 'read', classification: index === 3 ? 'decorative' : 'requirement', readMethod: 'vision+structured-parse', summary: 'fixture requirement', featureIds: index === 3 ? [] : ['F01'], disposition: index === 3 ? 'decorative background' : '', evidence: 'evidence/prd-intake/README.md',
  }))
  const sources = [{ path: sourcePath, contentHash: hash(fixture) }]
  const manifest = { version: 1, projectId: 'PR-00001', generatedAt: new Date().toISOString(), approvedFingerprint: fingerprint(sources, items), sources, items }
  const readSource = () => fixture
  const readAsset = (assetPath) => fixtureAssets.get(assetPath) ?? null
  assert(inspectManifest({ manifest, projectId: 'PR-00001', stage: 'G2', readSource, readAsset, inventoryText: 'F01', taskText: `F01 ${items.map((item) => item.sourceId).join(' ')}` }).every((check) => check.ok))
  const textOnly = { ...manifest, items: items.filter((item) => item.type !== 'image') }
  assert(inspectManifest({ manifest: textOnly, projectId: 'PR-00001', stage: 'G0', readSource, readAsset }).some((check) => check.ruleId === 'DOC-PRD-003' && !check.ok))
  const unresolved = structuredClone(manifest)
  unresolved.items[0].status = 'unresolved'
  assert(inspectManifest({ manifest: unresolved, projectId: 'PR-00001', stage: 'G2', readSource, readAsset, inventoryText: 'F01', taskText: 'F01' }).some((check) => check.ruleId === 'DOC-PRD-005' && !check.ok))
  const drifted = `${fixture}\nchanged`
  assert(inspectManifest({ manifest, projectId: 'PR-00001', stage: 'G2', readSource: () => drifted, readAsset, inventoryText: 'F01', taskText: `F01 ${items.map((item) => item.sourceId).join(' ')}` }).some((check) => check.ruleId === 'DOC-PRD-008' && !check.ok))
  const changedAssets = new Map(fixtureAssets)
  changedAssets.set('apps/web/docs_tdd/common/fixtures/prd-intake/approval-flow.png', Buffer.from('flow-v2'))
  assert(inspectManifest({ manifest, projectId: 'PR-00001', stage: 'G2', readSource, readAsset: (assetPath) => changedAssets.get(assetPath) ?? null, inventoryText: 'F01', taskText: `F01 ${items.map((item) => item.sourceId).join(' ')}` }).some((check) => check.ruleId === 'DOC-PRD-008' && !check.ok))
  console.log('prd-intake self-test passed (scan, omitted image, unresolved input, source drift, and binary image drift).')
}

if (args.includes('--self-test')) {
  runSelfTest()
  process.exit(0)
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
