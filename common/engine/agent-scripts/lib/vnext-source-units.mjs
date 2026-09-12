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

function decodeHtml(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10
      const raw = radix === 16 ? entity.slice(2) : entity.slice(1)
      const point = Number.parseInt(raw, radix)
      return Number.isFinite(point) ? String.fromCodePoint(point) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function htmlAttributes(rawTag) {
  const attributes = {}
  const tagName = rawTag.match(/^<\/?\s*([:\w-]+)/)?.[1]?.toLowerCase()
  for (const match of rawTag.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase()
    if (name === tagName) continue
    attributes[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

function htmlTokens(html) {
  const tokens = []
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)) {
    const raw = match[0]
    if (!raw.startsWith('<') || raw.startsWith('<!--')) {
      tokens.push({ type: 'text', value: raw, start: match.index })
      continue
    }
    const tag = raw.match(/^<\s*(\/?)\s*([a-zA-Z][\w:-]*)/)
    if (!tag) continue
    tokens.push({ type: 'tag', raw, name: tag[2].toLowerCase(), closing: Boolean(tag[1]), attributes: htmlAttributes(raw), start: match.index })
  }
  return tokens
}

const normalizeHtmlText = (value) => decodeHtml(value).replace(/\s+/g, ' ').trim()
const lineAtOffset = (content, offset, baseLine) => baseLine + (content.slice(0, offset).match(/\n/g) || []).length

function expandHtmlRows(rows) {
  const pending = new Map()
  return rows.map((row) => {
    const values = []
    const headers = []
    for (const [column, carry] of [...pending.entries()]) {
      values[column] = carry.text
      headers[column] = carry.header
      carry.remaining -= 1
      if (carry.remaining <= 0) pending.delete(column)
    }
    let column = 0
    for (const cell of row.cells) {
      while (values[column] !== undefined) column += 1
      const colspan = Math.max(1, Number.parseInt(cell.colspan || '1', 10) || 1)
      const rowspan = Math.max(1, Number.parseInt(cell.rowspan || '1', 10) || 1)
      for (let offset = 0; offset < colspan; offset += 1) {
        values[column + offset] = cell.text
        headers[column + offset] = cell.header
        if (rowspan > 1) pending.set(column + offset, { text: cell.text, header: cell.header, remaining: rowspan - 1 })
      }
      column += colspan
    }
    return { ...row, values, headers }
  })
}

export function parseHtmlTables(html, { baseLine = 1 } = {}) {
  const tables = []
  let table = null
  let row = null
  let cell = null
  let theadDepth = 0
  for (const token of htmlTokens(html)) {
    if (token.type === 'tag' && token.name === 'table' && !token.closing && !table) {
      table = { lineStart: lineAtOffset(html, token.start, baseLine), rows: [] }
      continue
    }
    if (!table) continue
    if (token.type === 'tag' && token.name === 'thead') {
      theadDepth += token.closing ? -1 : 1
      continue
    }
    if (token.type === 'tag' && token.name === 'tr') {
      if (!token.closing) row = { cells: [], inHead: theadDepth > 0, lineStart: lineAtOffset(html, token.start, baseLine), images: [] }
      else if (row) {
        table.rows.push(row)
        row = null
      }
      continue
    }
    if (!row) {
      if (token.type === 'tag' && token.name === 'table' && token.closing) {
        table.lineEnd = lineAtOffset(html, token.start + token.raw.length, baseLine)
        table.rows = expandHtmlRows(table.rows)
        tables.push(table)
        table = null
      }
      continue
    }
    if (token.type === 'tag' && ['td', 'th'].includes(token.name)) {
      if (!token.closing) cell = { parts: [], header: token.name === 'th' || theadDepth > 0, colspan: token.attributes.colspan, rowspan: token.attributes.rowspan }
      else if (cell) {
        row.cells.push({ ...cell, text: normalizeHtmlText(cell.parts.join(' ')) })
        delete row.cells.at(-1).parts
        cell = null
      }
      continue
    }
    if (cell && token.type === 'tag' && token.name === 'img') {
      const target = token.attributes.src || token.attributes['data-src']
      if (target) row.images.push({ target, alt: token.attributes.alt || '', lineStart: lineAtOffset(html, token.start, baseLine) })
      continue
    }
    if (cell && token.type === 'text') cell.parts.push(token.value)
    if (cell && token.type === 'tag' && token.name === 'br' && !token.closing) cell.parts.push(' ')
  }
  return tables
}

function appendImageUnit(units, unit, documentPath, image, readAsset) {
  const resolvedAsset = readAsset?.({ documentPath, target: image.target }) || {}
  const assetStatus = resolvedAsset.status || (/^data:/i.test(image.target) ? 'embedded-unread' : /^(?:https?:)?\/\//i.test(image.target) ? 'remote' : 'unread')
  const assetHash = resolvedAsset.bytes ? sha256(resolvedAsset.bytes) : ''
  const canonicalImage = canonicalizeLarkDocumentContent(`![](${image.target})`)
  const stableRemotePath = imageMatches(canonicalImage)[0]?.target || image.target
  const assetPath = assetStatus === 'remote' ? stableRemotePath : resolvedAsset.assetPath || image.target
  const mediaType = resolvedAsset.mediaType || mediaTypes.get(extname(image.target.split(/[?#]/, 1)[0]).toLowerCase()) || 'application/octet-stream'
  units.push(unit({
    type: 'image', lineStart: image.lineStart, lineEnd: image.lineStart,
    content: [image.alt, image.target, assetHash ? `asset-sha256:${assetHash}` : `asset-status:${assetStatus}`].filter(Boolean).join('\n'),
    identityContent: `${canonicalImage}\0${assetHash}`,
    assetPath, assetHash, assetStatus, mediaType,
  }))
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
    if (/<table(?:\s|>)/i.test(rawLines[index] || '')) {
      flushText()
      const start = index
      let block = rawLines[index]
      while (!/<\/table\s*>/i.test(block) && index + 1 < rawLines.length) {
        index += 1
        block += `\n${rawLines[index]}`
      }
      const tables = parseHtmlTables(block, { baseLine: start + 1 })
      if (tables.length) {
        for (const table of tables) {
          const headerRows = table.rows.filter((candidate) => candidate.inHead || (candidate.headers.length > 0 && candidate.headers.every(Boolean)))
          const headers = headerRows.at(-1)?.values || []
          const businessRows = table.rows.filter((candidate) => !headerRows.includes(candidate))
          const content = table.rows.map((candidate) => candidate.values.join(' | ')).join('\n')
          units.push(unit({ type: 'table', lineStart: table.lineStart, lineEnd: table.lineEnd, content, tableRole: 'container', rowCount: businessRows.length }))
          businessRows.forEach((businessRow, rowIndex) => {
            const rowContent = normalizeHtmlText(businessRow.values.map((value, column) => headers[column] ? `${headers[column]}: ${value}` : value).filter(Boolean).join(' | '))
            if (rowContent) units.push(unit({ type: 'table', lineStart: businessRow.lineStart, lineEnd: businessRow.lineStart, content: rowContent, tableRole: 'row', rowIndex: rowIndex + 1 }))
            for (const image of businessRow.images) appendImageUnit(units, unit, document.path, image, readAsset)
          })
        }
        const outside = normalizeHtmlText(block.replace(/<table(?:\s|>)[\s\S]*?<\/table\s*>/gi, ' ').replace(/<[^>]+>/g, ' '))
        if (outside) units.push(unit({ type: 'text', lineStart: start + 1, lineEnd: index + 1, content: outside }))
        index += 1
        continue
      }
      index = start
    }

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
      for (const image of images) appendImageUnit(units, unit, document.path, { ...image, lineStart: index + 1 }, readAsset)
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

  const htmlTable = normalizeSourceDocuments([{
    path: 'lark-html.md',
    content: '<p>Before</p><table><thead><tr><th>Entry</th><th>Copy</th><th>Asset</th></tr></thead><tbody><tr><td rowspan="2"><strong>Reset &amp; recover</strong></td><td>A<br>B</td><td><img src="images/reset.png" alt="reset"></td></tr><tr><td colspan="2">Shared</td></tr></tbody></table><p>After</p>',
  }], { revision: '1', readAsset: assetReader })
  assert.equal(htmlTable.sourceUnits.filter((item) => item.tableRole === 'container').length, 1)
  assert.equal(htmlTable.sourceUnits.filter((item) => item.tableRole === 'row').length, 2)
  assert.match(htmlTable.sourceUnits.find((item) => item.tableRole === 'row').content, /Entry: Reset & recover.*Copy: A B/)
  assert.match(htmlTable.sourceUnits.filter((item) => item.tableRole === 'row')[1].content, /Entry: Reset & recover.*Copy: Shared.*Asset: Shared/)
  assert.equal(htmlTable.sourceUnits.filter((item) => item.type === 'image').length, 1)
  assert.match(htmlTable.sourceUnits.find((item) => item.type === 'text').content, /Before After/)
  assert.equal(parseHtmlTables('<table><tr><td>broken').length, 0)

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
