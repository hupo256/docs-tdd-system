#!/usr/bin/env node
// Deterministic source manifest normalization for docs_tdd vNext.
// Converts raw Markdown documents into stable text/table/image units without model calls.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { extname, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalizeLarkDocumentContent } from './lark-prd-drift.mjs'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const SYNC_FRONT_MATTER_RE = /^---\n([\s\S]*?)\n---(?:\n|$)/
const mediaTypes = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.bmp', 'image/bmp'],
])

// Source snapshots must represent requirement content, not sync transport metadata.
// Keep ordinary author-owned YAML front matter, but remove the read-only envelope emitted by
// sync-lark-docs. Lark temporary media URLs and generated alt text are canonicalized by the
// same helper used by v1 PRD drift checks, so re-fetching an unchanged document stays stable.
function stripSyncEnvelope(value) {
  let content = String(value ?? '').replace(/\r\n?/g, '\n')
  const frontMatter = SYNC_FRONT_MATTER_RE.exec(content)
  if (frontMatter && /(?:^|\n)syncedAt\s*:/m.test(frontMatter[1]) && /(?:^|\n)readOnly\s*:\s*true\s*$/m.test(frontMatter[1])) {
    content = content.slice(frontMatter[0].length)
  }
  return content
}

export function canonicalizeSourceContent(value) {
  return canonicalizeLarkDocumentContent(stripSyncEnvelope(value))
}

function decodeDataUrl(target) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(target)
  if (!match) return null
  try {
    return {
      bytes: match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3])),
      mediaType: match[1] || 'application/octet-stream',
    }
  } catch {
    return null
  }
}

function insideRoot(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

// Production source intake uses this resolver for localized PRD assets. Remote URLs are never
// treated as read: sync-lark-docs must first download them into the project inbox.
export function readLocalSourceAsset({ documentPath, target }, { root = process.cwd() } = {}) {
  const embedded = decodeDataUrl(target)
  if (embedded) return { ...embedded, assetPath: '<embedded>', status: 'embedded' }
  if (/^(?:https?:)?\/\//i.test(target)) return { assetPath: target, status: 'remote' }
  let decoded = target.split(/[?#]/, 1)[0]
  try { decoded = decodeURIComponent(decoded) } catch { /* Keep malformed exports literal. */ }
  const sourcePath = isAbsolute(documentPath) ? documentPath : resolve(root, documentPath)
  const candidate = resolve(dirname(sourcePath), decoded)
  if (!insideRoot(resolve(root), candidate)) return { assetPath: target, status: 'outside-root' }
  const assetPath = relative(resolve(root), candidate)
  if (!existsSync(candidate)) return { assetPath, status: 'missing' }
  return { assetPath, status: 'local', bytes: readFileSync(candidate), mediaType: mediaTypes.get(extname(candidate).toLowerCase()) || 'application/octet-stream' }
}

function tableDelimiter(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  // Lark exports compact Markdown delimiters such as `|-|-|`; CommonMark producers
  // commonly use three hyphens. Accept both without weakening the surrounding table shape.
  return cells.length >= 2 && cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell))
}

function tableStart(lines, index) {
  return lines[index]?.includes('|') && index + 1 < lines.length && tableDelimiter(lines[index + 1])
}

export function isStructuralSourceUnit(unit) {
  if (unit?.type === 'table' && ['container', 'header'].includes(unit.tableRole)) return true
  if (unit?.type !== 'text') return false
  const lines = String(unit.content || '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return true
  return lines.every((line) => /^(?:#{1,6}\s+.+|(?:-{3,}|\*{3,}|_{3,})|<!--(?:[\s\S]*?)-->)$/.test(line))
}

function imageMatches(line) {
  const matches = []
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
  for (const match of line.matchAll(pattern)) {
    matches.push({ raw: match[0], alt: match[1] || '', target: match[2] || match[3] || '' })
  }
  return matches
}

function makeUnitFactory(path) {
  const occurrences = new Map()
  return ({ type, lineStart, lineEnd, content, identityContent = content, ...extra }) => {
    const normalized = content.trim()
    const stableIdentity = String(identityContent).trim()
    const contentHash = sha256(stableIdentity)
    const base = sha256(`${path}\0${type}\0${stableIdentity}`).slice(0, 12).toUpperCase()
    const occurrence = (occurrences.get(base) || 0) + 1
    occurrences.set(base, occurrence)
    return {
      sourceId: `SRC-${base}${occurrence === 1 ? '' : `-${occurrence}`}`,
      type,
      path,
      lineStart,
      lineEnd,
      content: normalized,
      contentHash,
      ...extra,
    }
  }
}

export function extractSourceUnits(document, { readAsset } = {}) {
  if (!document?.path || typeof document.content !== 'string') throw new Error('source document requires path and string content')
  const rawContent = stripSyncEnvelope(document.content).replace(/[ \t]+$/gm, '').trim()
  const content = canonicalizeLarkDocumentContent(rawContent)
  const lines = content.split('\n')
  const rawLines = rawContent.split('\n')
  const unit = makeUnitFactory(document.path)
  const units = []
  let textLines = []
  let textStart = 0

  const flushText = () => {
    const text = textLines.join('\n').trim()
    if (text) units.push(unit({ type: 'text', lineStart: textStart + 1, lineEnd: textStart + textLines.length, content: text }))
    textLines = []
    textStart = 0
  }

  for (let index = 0; index < lines.length;) {
    if (tableStart(lines, index)) {
      flushText()
      const start = index
      const tableLines = []
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        tableLines.push(lines[index])
        index += 1
      }
      // Keep a structural container for backward-compatible table-level anchors, while exposing
      // every data row as its own semantic unit. A reviewer can now identify one omitted row
      // deterministically instead of accepting a single opaque multi-row table blob.
      units.push(unit({
        type: 'table', lineStart: start + 1, lineEnd: start + tableLines.length,
        content: tableLines.join('\n'), tableRole: 'container', rowCount: Math.max(0, tableLines.length - 2),
      }))
      if (tableLines.length >= 2) {
        const header = tableLines[0]
        for (let rowIndex = 2; rowIndex < tableLines.length; rowIndex += 1) {
          units.push(unit({
            type: 'table', lineStart: start + rowIndex + 1, lineEnd: start + rowIndex + 1,
            content: `${header}\n${tableLines[rowIndex]}`, tableRole: 'row', rowIndex: rowIndex - 1,
          }))
        }
      }
      continue
    }

    const images = imageMatches(rawLines[index] || lines[index])
    if (images.length) {
      flushText()
      for (const image of images) {
        const resolvedAsset = readAsset?.({ documentPath: document.path, target: image.target }) || {}
        const assetStatus = resolvedAsset.status || (/^data:/i.test(image.target) ? 'embedded-unread' : /^(?:https?:)?\/\//i.test(image.target) ? 'remote' : 'unread')
        const assetHash = resolvedAsset.bytes ? sha256(resolvedAsset.bytes) : ''
        const canonicalImage = canonicalizeLarkDocumentContent(`![](${image.target})`)
        const stableRemotePath = imageMatches(canonicalImage)[0]?.target || image.target
        const assetPath = assetStatus === 'remote' ? stableRemotePath : resolvedAsset.assetPath || image.target
        const mediaType = resolvedAsset.mediaType || mediaTypes.get(extname(image.target.split(/[?#]/, 1)[0]).toLowerCase()) || 'application/octet-stream'
        units.push(unit({
          type: 'image', lineStart: index + 1, lineEnd: index + 1,
          content: [image.alt, image.target, assetHash ? `asset-sha256:${assetHash}` : `asset-status:${assetStatus}`].filter(Boolean).join('\n'),
          identityContent: `${canonicalImage}\0${assetHash}`,
          assetPath, assetHash, assetStatus, mediaType,
        }))
      }
      const remainder = images.reduce((line, image) => line.replace(image.raw, ''), rawLines[index] || lines[index]).trim()
      if (remainder) units.push(unit({ type: 'text', lineStart: index + 1, lineEnd: index + 1, content: remainder }))
      index += 1
      continue
    }

    if (!lines[index].trim()) {
      flushText()
      index += 1
      continue
    }
    if (!textLines.length) textStart = index
    textLines.push(lines[index])
    index += 1
  }
  flushText()
  return units
}

export function normalizeSourceDocuments(documents, { revision = 'unversioned', readAsset } = {}) {
  if (!Array.isArray(documents) || !documents.length) throw new Error('at least one source document is required')
  const ordered = [...documents].sort((a, b) => String(a.path).localeCompare(String(b.path)))
  const duplicatePaths = ordered.map((item) => item.path).filter((path, index, all) => all.indexOf(path) !== index)
  if (duplicatePaths.length) throw new Error(`duplicate source paths: ${[...new Set(duplicatePaths)].join(', ')}`)

  const sources = ordered.map((document) => {
    if (!document?.path || typeof document.content !== 'string') throw new Error('source document requires path and string content')
    const content = canonicalizeSourceContent(document.content)
    return { path: document.path, contentHash: sha256(content) }
  })
  const sourceUnits = ordered.flatMap((document) => extractSourceUnits(document, { readAsset }))
  const assets = sourceUnits.filter((unit) => unit.type === 'image').map((unit) => ({
    sourceId: unit.sourceId,
    path: unit.assetPath,
    assetHash: unit.assetHash,
    assetStatus: unit.assetStatus,
    mediaType: unit.mediaType,
  }))
  return {
    sourceSnapshot: {
      revision,
      contentHash: sha256(JSON.stringify(assets.length ? { sources, assets } : sources)),
      sources,
      ...(assets.length ? { assets } : {}),
    },
    sourceUnits,
  }
}

export function selfTest() {
  const markdown = [
    '# Password rules',
    '',
    'Use the same copy on every entry.',
    '',
    '| Entry | Copy |',
    '| --- | --- |',
    '| Reset | A |',
    '| Change | B |',
    '',
    'Reset screenshot: ![reset password](images/reset.png)',
  ].join('\r\n')
  const assetReader = ({ target }) => target === 'images/reset.png'
    ? { assetPath: 'inbox/images/reset.png', status: 'local', mediaType: 'image/png', bytes: Buffer.from('reset-image') }
    : { assetPath: target, status: 'missing' }
  const first = normalizeSourceDocuments([{ path: 'inbox/prd.md', content: markdown }], { revision: '7', readAsset: assetReader })
  const second = normalizeSourceDocuments([{ path: 'inbox/prd.md', content: markdown.replaceAll('\r\n', '\n') }], { revision: '7', readAsset: assetReader })
  assert.deepEqual(first, second)
  assert.deepEqual(first.sourceUnits.map((item) => item.type), ['text', 'text', 'table', 'table', 'table', 'image', 'text'])
  assert.equal(first.sourceUnits.find((item) => item.tableRole === 'container').lineStart, 5)
  assert.deepEqual(first.sourceUnits.filter((item) => item.tableRole === 'row').map((item) => item.rowIndex), [1, 2])
  assert.match(first.sourceUnits.find((item) => item.tableRole === 'row').content, /Entry.*Copy[\s\S]*Reset.*A/)
  assert.equal(first.sourceUnits.find((item) => item.type === 'image').lineStart, 10)
  assert.ok(first.sourceUnits.every((item) => item.sourceId.startsWith('SRC-') && item.contentHash.length === 64))
  assert.equal(first.sourceSnapshot.assets[0].assetStatus, 'local')
  assert.equal(first.sourceSnapshot.assets[0].assetHash, sha256(Buffer.from('reset-image')))
  assert.match(first.sourceUnits.find((item) => item.type === 'image').content, /reset password/)
  assert.equal(isStructuralSourceUnit(first.sourceUnits[0]), true)
  assert.equal(isStructuralSourceUnit(first.sourceUnits[1]), false)
  assert.equal(isStructuralSourceUnit(first.sourceUnits.find((item) => item.tableRole === 'container')), true)
  assert.equal(isStructuralSourceUnit(first.sourceUnits.find((item) => item.tableRole === 'row')), false)
  const compactTable = normalizeSourceDocuments([{ path: 'lark.md', content: '|A|B|\n|-|-|\n|x|y|' }], { revision: '1' })
  assert.equal(compactTable.sourceUnits.filter((item) => item.tableRole === 'row').length, 1)

  const reordered = normalizeSourceDocuments([
    { path: 'b.md', content: 'B' },
    { path: 'a.md', content: 'A' },
  ])
  assert.deepEqual(reordered.sourceSnapshot.sources.map((item) => item.path), ['a.md', 'b.md'])
  assert.throws(() => normalizeSourceDocuments([{ path: 'a.md', content: 'A' }, { path: 'a.md', content: 'B' }]), /duplicate source paths/)

  const syncEnvelope = (syncedAt, alt, code) => [
    '---',
    'sourceName: "PRD"',
    `syncedAt: "${syncedAt}"`,
    'readOnly: true',
    '---',
    '',
    '# Stable requirement',
    '',
    `![${alt}](https://example.larksuite.com/space/api/box/stream/download/authcode/?code=${code})`,
  ].join('\n')
  const larkFirst = normalizeSourceDocuments([{ path: 'https://example.larksuite.com/docx/abc', content: syncEnvelope('2026-09-01T00:00:00Z', 'generated A', 'first') }], { revision: '9' })
  const larkSecond = normalizeSourceDocuments([{ path: 'https://example.larksuite.com/docx/abc', content: syncEnvelope('2026-09-02T00:00:00Z', 'generated B', 'second') }], { revision: '9' })
  assert.deepEqual(larkFirst.sourceSnapshot, larkSecond.sourceSnapshot)
  assert.deepEqual(larkFirst.sourceUnits.map(({ sourceId, contentHash }) => ({ sourceId, contentHash })), larkSecond.sourceUnits.map(({ sourceId, contentHash }) => ({ sourceId, contentHash })))
  assert.notDeepEqual(larkFirst.sourceSnapshot, normalizeSourceDocuments([{ path: 'https://example.larksuite.com/docx/abc', content: syncEnvelope('2026-09-02T00:00:00Z', 'generated B', 'second').replace('Stable requirement', 'Changed requirement') }], { revision: '9' }).sourceSnapshot)
  assert.equal(canonicalizeSourceContent('---\ntitle: authored\n---\nRequirement'), '---\ntitle: authored\n---\nRequirement')

  // Real incident regression: PR-02306's generated descriptions and image bytes both enter intake.
  const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
  const incidentPath = 'prds/PR-02306/inbox/lark-sync/prd-latest.extracted.md'
  if (existsSync(resolve(docsRoot, incidentPath))) {
    const incident = normalizeSourceDocuments([{ path: incidentPath, content: readFileSync(resolve(docsRoot, incidentPath), 'utf8') }], {
      revision: 'incident',
      readAsset: (asset) => readLocalSourceAsset(asset, { root: docsRoot }),
    })
    assert.equal(incident.sourceSnapshot.assets.length, 4)
    assert.ok(incident.sourceSnapshot.assets.every((asset) => asset.assetStatus === 'local' && asset.assetHash.length === 64))
    assert.match(incident.sourceUnits.find((unit) => unit.assetPath?.endsWith('img-004.png')).content, /修改登录密码/)
  }
  console.log('vnext-source-units self-test passed (including volatile Lark metadata and PR-02306 image intake)')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
