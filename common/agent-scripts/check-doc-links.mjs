#!/usr/bin/env node
// Validate local Markdown links in docs_tdd common rules and templates.
// Cross-file anchors are intentionally disallowed: Chinese heading slug rules differ by renderer,
// so use a file link plus visible section text (for example: file.md §3.1) instead.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMMON_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_TDD_DIR = join(COMMON_DIR, '..')
const TARGET_DIRS = [COMMON_DIR, join(DOCS_TDD_DIR, 'templates')]
const TARGET_FILES = [join(DOCS_TDD_DIR, 'PROJECTS.md')]
const LINK_RE = /(?<!!)\[[^\]\n]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

function printHelp() {
  console.log(`usage: check-doc-links.mjs [--self-test] [--help]

Validate local Markdown links in docs_tdd common rules and templates.
Cross-file anchors are intentionally disallowed; use file link + section text instead.

Options:
  --help       Show this help message and exit
  --self-test  Run inline self-test`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walkFiles(full)
    return ['.md', '.mdx'].includes(extname(entry.name)) ? [full] : []
  })
}

function isSkippedTarget(target) {
  return (
    !target ||
    target.startsWith('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(target) ||
    target.includes('<PROJECT-ID>') ||
    target.includes('<repo>')
  )
}

function stripFragment(target) {
  return target.split('#')[0].split('?')[0]
}

function hasFragment(target) {
  return target.includes('#')
}

function checkMarkdownTexts(files, fileExists = existsSync) {
  const errors = []
  const checked = []

  for (const { file, text } of files) {
    for (const match of text.matchAll(LINK_RE)) {
      const rawTarget = match[1].trim()
      if (isSkippedTarget(rawTarget)) continue
      const target = stripFragment(rawTarget)
      if (!target) continue
      const absoluteTarget = normalize(resolve(dirname(file), decodeURIComponent(target)))
      checked.push({ file, target: rawTarget })
      if (!fileExists(absoluteTarget)) {
        errors.push(`${file}: missing link target ${rawTarget}`)
      } else if (hasFragment(rawTarget) && ['.md', '.mdx'].includes(extname(absoluteTarget))) {
        errors.push(`${file}: cross-file anchor is not allowed; use file link + section text: ${rawTarget}`)
      }
    }
  }

  return { errors, checked }
}

function checkMarkdownLinks(files, fileExists = existsSync) {
  return checkMarkdownTexts(files.map((file) => ({ file, text: readFileSync(file, 'utf8') })), fileExists)
}

function selfTest() {
  const sampleFile = normalize(resolve('/tmp/docs/a.md'))
  const targetFile = normalize(resolve('/tmp/docs/b.md'))
  const missingFile = normalize(resolve('/tmp/docs/missing.md'))
  const cases = [
    { name: 'file link ok', text: '[B](./b.md)', exists: new Set([targetFile]), errors: 0 },
    { name: 'missing file fails', text: '[Missing](./missing.md)', exists: new Set(), errors: 1 },
    { name: 'cross-file anchor fails', text: '[B](./b.md#section)', exists: new Set([targetFile]), errors: 1 },
    { name: 'same-file anchor skipped', text: '[Section](#section)', exists: new Set([missingFile]), errors: 0 },
  ]

  for (const testCase of cases) {
    const result = checkMarkdownTexts([{ file: sampleFile, text: testCase.text }], (file) => testCase.exists.has(file))
    if (result.errors.length !== testCase.errors) {
      console.error(`[check-doc-links] self-test failed: ${testCase.name}`)
      process.exit(1)
    }
  }
  console.log('PASS markdown link policy')
}

if (process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

const existingTargetFiles = TARGET_FILES.filter(existsSync)
const { errors, checked } = checkMarkdownLinks([...TARGET_DIRS.flatMap(walkFiles), ...existingTargetFiles])

if (errors.length) {
  console.error(`❌ Markdown 本地链接存在断链：\n${errors.map((item) => `   ${item}`).join('\n')}`)
  process.exit(1)
}

console.log(`✅ Markdown 本地链接：${checked.length} 个目标文件均存在，且无跨文件 #anchor。`)
