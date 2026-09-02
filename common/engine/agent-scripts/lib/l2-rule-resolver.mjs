#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { minimatch } from 'minimatch'
import YAML from 'yaml'

export const DEFAULT_EVENT_BUDGET_BYTES = 96 * 1024

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const posix = (value) => value.split(sep).join('/')

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function normalizeTargetPath(worktree, target) {
  if (typeof target !== 'string' || !target.trim()) throw new Error('target path is empty')
  const root = resolve(worktree)
  const absolute = isAbsolute(target) ? resolve(target) : resolve(root, target)
  const repoRelative = posix(relative(root, absolute))
  if (!repoRelative || repoRelative === '..' || repoRelative.startsWith('../') || isAbsolute(repoRelative)) {
    throw new Error(`target path is outside worktree: ${target}`)
  }
  return repoRelative.replace(/^\.\//, '')
}

export function parseCursorRule(file, rulesDir) {
  const raw = readFileSync(file, 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) throw new Error(`invalid MDC frontmatter: ${file}`)
  const metadata = YAML.parse(match[1])
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`MDC frontmatter must be a mapping: ${file}`)
  }
  if (metadata.alwaysApply != null && typeof metadata.alwaysApply !== 'boolean') {
    throw new Error(`alwaysApply must be boolean: ${file}`)
  }
  const rawGlobs = metadata.globs == null ? [] : Array.isArray(metadata.globs) ? metadata.globs : [metadata.globs]
  if (rawGlobs.some((glob) => typeof glob !== 'string' || !glob.trim())) {
    throw new Error(`globs must contain non-empty strings: ${file}`)
  }
  const relativePath = posix(relative(rulesDir, file))
  const body = raw.slice(match[0].length)
  return {
    file,
    relativePath,
    description: typeof metadata.description === 'string' ? metadata.description : '',
    alwaysApply: metadata.alwaysApply === true,
    globs: rawGlobs,
    body,
    sourceHash: sha256(raw),
    bodyHash: sha256(body),
    byteLength: Buffer.byteLength(body),
  }
}

export function loadCursorRules(rulesDir) {
  if (!existsSync(rulesDir)) throw new Error(`Cursor rules directory is missing: ${rulesDir}`)
  return readdirSync(rulesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mdc'))
    .map((entry) => parseCursorRule(join(rulesDir, entry.name), rulesDir))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'))
}

function matchRule(rule, target) {
  if (rule.alwaysApply) return ['alwaysApply']
  return rule.globs
    .filter((glob) =>
      minimatch(target, glob, {
        dot: true,
        nocase: false,
        nocomment: true,
        nonegate: true,
        matchBase: false,
        platform: 'linux',
      }),
    )
    .map((glob) => `glob:${glob}`)
}

function normalizeOverrides(overrides = []) {
  return overrides
    .filter((item) => item && typeof item.id === 'string' && typeof item.winner === 'string' && Array.isArray(item.loserFiles))
    .map((item) => ({
      id: item.id,
      winner: item.winner,
      loserFiles: [...item.loserFiles].sort(),
      reason: item.reason || '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

export function resolveRulePack({ worktree, targetFiles, rulesDir = join(worktree, '.cursor/rules'), conflictOverrides = [] }) {
  const targets = [...new Set(targetFiles.map((target) => normalizeTargetPath(worktree, target)))].sort()
  if (!targets.length) throw new Error('at least one target file is required')
  const rules = loadCursorRules(rulesDir)
  const matchedRules = []
  const unscopedRules = []
  for (const rule of rules) {
    if (!rule.alwaysApply && rule.globs.length === 0) {
      unscopedRules.push(rule.relativePath)
      continue
    }
    const matches = targets.flatMap((target) => matchRule(rule, target).map((reason) => ({ target, reason })))
    if (matches.length) matchedRules.push({ ...rule, matches })
  }
  const overrides = normalizeOverrides(conflictOverrides)
  const identity = {
    targets,
    rules: matchedRules.map((rule) => ({
      path: rule.relativePath,
      sourceHash: rule.sourceHash,
      matches: rule.matches,
    })),
    conflictOverrides: overrides,
  }
  return {
    version: 1,
    worktree: resolve(worktree),
    rulesDir: resolve(rulesDir),
    targets,
    matchedRules,
    unscopedRules,
    conflictOverrides: overrides,
    fingerprint: sha256(stableJson(identity)),
  }
}

export function renderRuleContext(pack, { rules = pack.matchedRules, maxBytes = DEFAULT_EVENT_BUDGET_BYTES } = {}) {
  const selectedHashes = new Set(rules.map((rule) => rule.sourceHash))
  const selected = pack.matchedRules.filter((rule) => selectedHashes.has(rule.sourceHash))
  const overrideLines = pack.conflictOverrides.flatMap((override) => (override.loserFiles.some((file) => selected.some((rule) => rule.relativePath === file)) ? [`- ${override.id}: ${override.winner} overrides ${override.loserFiles.join(', ')}${override.reason ? ` — ${override.reason}` : ''}`] : []))
  const sections = ['# Mechanically injected Cursor rules', '', `Targets: ${pack.targets.join(', ')}`, `Pack fingerprint: ${pack.fingerprint}`, 'The following rule bodies are copied verbatim from the active worktree. Apply them before retrying the blocked edit.']
  if (overrideLines.length) sections.push('', 'Conflict overrides:', ...overrideLines)
  for (const rule of selected) {
    sections.push('', `--- BEGIN ${rule.relativePath} sha256=${rule.sourceHash} matches=${rule.matches.map((match) => `${match.target}:${match.reason}`).join('|')} ---`, rule.body, `--- END ${rule.relativePath} ---`)
  }
  const text = `${sections.join('\n')}\n`
  const byteLength = Buffer.byteLength(text)
  if (byteLength > maxBytes) {
    const error = new Error(`matched rule context is ${byteLength} bytes, exceeding the ${maxBytes}-byte event budget`)
    error.code = 'RULE_CONTEXT_BUDGET_EXCEEDED'
    error.byteLength = byteLength
    error.maxBytes = maxBytes
    throw error
  }
  return {
    text,
    byteLength,
    ruleCount: selected.length,
    ruleHashes: selected.map((rule) => rule.sourceHash),
  }
}

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`l2-rule-resolver self-test failed: ${message}`)
  }
  const currentFile = fileURLToPath(import.meta.url)
  assert(currentFile.endsWith('/l2-rule-resolver.mjs'), 'module path is stable')
  assert(normalizeTargetPath('/repo', '/repo/apps/a.ts') === 'apps/a.ts', 'absolute path normalization')
  assert(normalizeTargetPath('/repo', './apps/a.ts') === 'apps/a.ts', 'relative path normalization')
  let escaped = false
  try {
    normalizeTargetPath('/repo', '../outside.ts')
  } catch {
    escaped = true
  }
  assert(escaped, 'outside paths are rejected')
  console.log('PASS l2-rule-resolver (path normalization)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
