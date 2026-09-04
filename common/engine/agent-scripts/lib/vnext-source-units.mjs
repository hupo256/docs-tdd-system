#!/usr/bin/env node
// Deterministic source manifest normalization for docs_tdd vNext.
// Converts raw Markdown documents into stable text/table/image units without model calls.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const normalizeText = (value) => String(value ?? '').replace(/\r\n?/g, '\n')

function tableDelimiter(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.length >= 2 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell))
}

function tableStart(lines, index) {
  return lines[index]?.includes('|') && index + 1 < lines.length && tableDelimiter(lines[index + 1])
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
  return ({ type, lineStart, lineEnd, content }) => {
    const normalized = content.trim()
    const contentHash = sha256(normalized)
    const base = sha256(`${path}\0${type}\0${normalized}`).slice(0, 12).toUpperCase()
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
    }
  }
}

export function extractSourceUnits(document) {
  if (!document?.path || typeof document.content !== 'string') throw new Error('source document requires path and string content')
  const content = normalizeText(document.content)
  const lines = content.split('\n')
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
      units.push(unit({ type: 'table', lineStart: start + 1, lineEnd: start + tableLines.length, content: tableLines.join('\n') }))
      continue
    }

    const images = imageMatches(lines[index])
    if (images.length) {
      flushText()
      for (const image of images) {
        units.push(unit({ type: 'image', lineStart: index + 1, lineEnd: index + 1, content: `${image.alt}\n${image.target}` }))
      }
      const remainder = images.reduce((line, image) => line.replace(image.raw, ''), lines[index]).trim()
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

export function normalizeSourceDocuments(documents, { revision = 'unversioned' } = {}) {
  if (!Array.isArray(documents) || !documents.length) throw new Error('at least one source document is required')
  const ordered = [...documents].sort((a, b) => String(a.path).localeCompare(String(b.path)))
  const duplicatePaths = ordered.map((item) => item.path).filter((path, index, all) => all.indexOf(path) !== index)
  if (duplicatePaths.length) throw new Error(`duplicate source paths: ${[...new Set(duplicatePaths)].join(', ')}`)

  const sources = ordered.map((document) => {
    if (!document?.path || typeof document.content !== 'string') throw new Error('source document requires path and string content')
    const content = normalizeText(document.content)
    return { path: document.path, contentHash: sha256(content) }
  })
  const sourceUnits = ordered.flatMap(extractSourceUnits)
  return {
    sourceSnapshot: {
      revision,
      contentHash: sha256(JSON.stringify(sources)),
      sources,
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
  const first = normalizeSourceDocuments([{ path: 'inbox/prd.md', content: markdown }], { revision: '7' })
  const second = normalizeSourceDocuments([{ path: 'inbox/prd.md', content: markdown.replaceAll('\r\n', '\n') }], { revision: '7' })
  assert.deepEqual(first, second)
  assert.deepEqual(first.sourceUnits.map((item) => item.type), ['text', 'text', 'table', 'image', 'text'])
  assert.equal(first.sourceUnits.find((item) => item.type === 'table').lineStart, 5)
  assert.equal(first.sourceUnits.find((item) => item.type === 'image').lineStart, 10)
  assert.ok(first.sourceUnits.every((item) => item.sourceId.startsWith('SRC-') && item.contentHash.length === 64))

  const reordered = normalizeSourceDocuments([
    { path: 'b.md', content: 'B' },
    { path: 'a.md', content: 'A' },
  ])
  assert.deepEqual(reordered.sourceSnapshot.sources.map((item) => item.path), ['a.md', 'b.md'])
  assert.throws(() => normalizeSourceDocuments([{ path: 'a.md', content: 'A' }, { path: 'a.md', content: 'B' }]), /duplicate source paths/)
  console.log('vnext-source-units self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
