#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { minimatch } from 'minimatch'
import YAML from 'yaml'

// Full-pack diagnostics may render up to 96KB; runtime injection uses the separate
// 8KB/4KB/16KB tiered budgets below.
export const DEFAULT_EVENT_BUDGET_BYTES = 96 * 1024
export const DEFAULT_BLOCKING_BUDGET_BYTES = 8 * 1024
export const DEFAULT_ADVISORY_BUDGET_BYTES = 4 * 1024
export const DEFAULT_COMBINED_BUDGET_BYTES = 16 * 1024

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

// Pi 没有能在 tool_call 当下把 additionalContext 送回模型的 API，因此在
// before_agent_start 预送：blocking 全文 + advisory 目录。这里显式把所有已作用域规则
// 做成一个稳定 pack；未带 alwaysApply/globs 的手工规则不自动注入。
export function resolveRulePreflightPack({ worktree, rulesDir = join(worktree, '.cursor/rules'), conflictOverrides = [] }) {
  const overrides = normalizeOverrides(conflictOverrides)
  const matchedRules = loadCursorRules(rulesDir)
    .filter((rule) => rule.alwaysApply || rule.globs.length > 0)
    .map((rule) => ({ ...rule, matches: [{ target: '<preflight>', reason: 'preflight-catalogue' }] }))
  const identity = {
    targets: ['<preflight>'],
    rules: matchedRules.map((rule) => ({ path: rule.relativePath, sourceHash: rule.sourceHash })),
    conflictOverrides: overrides,
  }
  return {
    version: 1,
    worktree: resolve(worktree),
    rulesDir: resolve(rulesDir),
    targets: ['<preflight>'],
    matchedRules,
    unscopedRules: [],
    conflictOverrides: overrides,
    fingerprint: sha256(stableJson(identity)),
  }
}

function matchesAnyRuleGlob(rule, globs) {
  return globs.some((glob) => minimatch(rule.relativePath, glob, { dot: true, nocase: false, nocomment: true, nonegate: true, matchBase: false, platform: 'linux' }))
}

// 把命中的 L2 规则拆成「必须全文送达」与「只报目录、按需自取」两层。
// 未被任何 glob 命中的规则默认落 blocking：分类缺失时保守送全文，不静默降级成一行摘要。
export function partitionRuleInjection(rules, policy = {}) {
  const advisoryGlobs = Array.isArray(policy.advisoryRuleGlobs) ? policy.advisoryRuleGlobs : []
  const blockingGlobs = Array.isArray(policy.blockingRuleGlobs) ? policy.blockingRuleGlobs : []
  const blocking = []
  const advisory = []
  for (const rule of rules) {
    const explicitlyBlocking = matchesAnyRuleGlob(rule, blockingGlobs)
    const explicitlyAdvisory = matchesAnyRuleGlob(rule, advisoryGlobs)
    if (explicitlyAdvisory && !explicitlyBlocking) advisory.push(rule)
    else blocking.push(rule)
  }
  return { blocking, advisory }
}

// advisory 层只渲染「文件名 + description」目录：宽 glob 规则（js-*/rerender-*/rendering-* 等）
// 对单次改动大多不适用，全文送达是纯浪费。目录超预算就截断并报 remainingCount，不无限重注入。
export function renderAdvisoryRuleCatalog(pack, { rules, maxBytes = DEFAULT_ADVISORY_BUDGET_BYTES } = {}) {
  const budget = Number.isFinite(maxBytes) ? Math.max(maxBytes, 1024) : DEFAULT_ADVISORY_BUDGET_BYTES
  const header = [
    '# Advisory Cursor rule catalogue',
    '',
    `Targets: ${pack.targets.join(', ')}`,
    'These broad-glob rules are not unconditional requirements. Read a full rule only when its description matches the actual change; do not load every listed rule.',
    '',
  ]
  const selected = []
  for (const rule of rules || []) {
    const line = `- ${rule.relativePath}: ${rule.description || '(no description)'}`
    if (Buffer.byteLength(`${[...header, ...selected, line].join('\n')}\n`) > budget) {
      if (!selected.length) selected.push(`- ${rule.relativePath}: (description omitted to fit catalogue budget)`)
      break
    }
    selected.push(line)
  }
  const selectedRules = (rules || []).slice(0, selected.length)
  const text = `${[...header, ...selected].join('\n')}\n`
  return {
    text,
    byteLength: Buffer.byteLength(text),
    ruleCount: selectedRules.length,
    ruleHashes: selectedRules.map((rule) => rule.sourceHash),
    remainingCount: (rules || []).length - selectedRules.length,
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

export function composeRuleInjectionContext(pack, { blocking = [], advisory = [], blockingBudgetBytes = DEFAULT_BLOCKING_BUDGET_BYTES, advisoryBudgetBytes = DEFAULT_ADVISORY_BUDGET_BYTES, combinedBudgetBytes = DEFAULT_COMBINED_BUDGET_BYTES } = {}) {
  const blockingRendered = blocking.length
    ? renderRuleContext(pack, { rules: blocking, maxBytes: blockingBudgetBytes })
    : { text: '', byteLength: 0, ruleCount: 0, ruleHashes: [] }
  const advisoryCatalog = advisory.length
    ? renderAdvisoryRuleCatalog(pack, { rules: advisory, maxBytes: advisoryBudgetBytes })
    : { text: '', byteLength: 0, ruleCount: 0, ruleHashes: [], remainingCount: 0 }
  const text = [blockingRendered.text, advisoryCatalog.text].filter(Boolean).join('\n')
  const byteLength = Buffer.byteLength(text)
  if (byteLength > combinedBudgetBytes) {
    const error = new Error(`combined rule context is ${byteLength} bytes, exceeding the ${combinedBudgetBytes}-byte event budget`)
    error.code = 'RULE_CONTEXT_COMBINED_BUDGET_EXCEEDED'
    error.byteLength = byteLength
    error.maxBytes = combinedBudgetBytes
    throw error
  }
  return {
    text,
    byteLength,
    ruleCount: blockingRendered.ruleCount + advisoryCatalog.ruleCount,
    ruleHashes: [...new Set([...blockingRendered.ruleHashes, ...advisoryCatalog.ruleHashes])].sort(),
    blockingByteLength: blockingRendered.byteLength,
    advisoryByteLength: advisoryCatalog.byteLength,
    blockingRuleCount: blockingRendered.ruleCount,
    advisoryRuleCount: advisoryCatalog.ruleCount,
    advisoryRemainingCount: advisoryCatalog.remainingCount,
  }
}

/** Select the largest stable prefix of unseen rules that fits one hook event. */
export function selectRuleInjectionBatch(pack, { rules = pack.matchedRules, maxBytes = DEFAULT_EVENT_BUDGET_BYTES } = {}) {
  if (!rules.length) return { rendered: renderRuleContext(pack, { rules: [], maxBytes }), remainingCount: 0 }
  let rendered = null
  for (let size = 1; size <= rules.length; size += 1) {
    try {
      rendered = renderRuleContext(pack, { rules: rules.slice(0, size), maxBytes })
    } catch (error) {
      if (error?.code !== 'RULE_CONTEXT_BUDGET_EXCEEDED') throw error
      if (size === 1) {
        error.code = 'RULE_CONTEXT_SINGLE_RULE_TOO_LARGE'
        error.rulePath = rules[0].relativePath
        throw error
      }
      break
    }
  }
  return { rendered, remainingCount: rules.length - rendered.ruleCount }
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
  const syntheticPack = {
    targets: ['src/a.ts'],
    fingerprint: 'pack',
    conflictOverrides: [],
    matchedRules: [
      { relativePath: 'a.mdc', sourceHash: 'a', matches: [{ target: 'src/a.ts', reason: 'alwaysApply' }], body: 'a'.repeat(40) },
      { relativePath: 'b.mdc', sourceHash: 'b', matches: [{ target: 'src/a.ts', reason: 'alwaysApply' }], body: 'b'.repeat(40) },
    ],
  }
  const first = renderRuleContext(syntheticPack, { rules: syntheticPack.matchedRules.slice(0, 1) })
  const batch = selectRuleInjectionBatch(syntheticPack, { maxBytes: first.byteLength + 1 })
  assert(batch.rendered.ruleHashes.join(',') === 'a' && batch.remainingCount === 1, 'oversized packs are split in stable order')
  let oversizedRule = false
  try {
    selectRuleInjectionBatch(syntheticPack, { maxBytes: first.byteLength - 1 })
  } catch (error) {
    oversizedRule = error?.code === 'RULE_CONTEXT_SINGLE_RULE_TOO_LARGE' && error?.rulePath === 'a.mdc'
  }
  assert(oversizedRule, 'a single oversized rule reports an actionable error')
  const partitioned = partitionRuleInjection(syntheticPack.matchedRules, {
    advisoryRuleGlobs: ['b.mdc'],
    blockingRuleGlobs: ['a.mdc'],
  })
  assert(partitioned.blocking[0]?.relativePath === 'a.mdc' && partitioned.advisory[0]?.relativePath === 'b.mdc', 'injection policy partitions exact rule globs')
  const unclassified = partitionRuleInjection(syntheticPack.matchedRules, {})
  assert(unclassified.blocking.length === 2 && unclassified.advisory.length === 0, 'unclassified rules default to blocking rather than silently downgrading')
  const catalog = renderAdvisoryRuleCatalog(syntheticPack, { rules: partitioned.advisory })
  assert(catalog.ruleHashes.join(',') === 'b' && catalog.text.includes('b.mdc'), 'advisory rules render as a compact catalogue')
  const composed = composeRuleInjectionContext(syntheticPack, { blocking: partitioned.blocking, advisory: partitioned.advisory })
  assert(composed.blockingRuleCount === 1 && composed.advisoryRuleCount === 1, 'blocking bodies and advisory catalogue compose into one bounded context')
  let combinedOverflow = false
  try {
    composeRuleInjectionContext(syntheticPack, { blocking: partitioned.blocking, advisory: partitioned.advisory, combinedBudgetBytes: composed.byteLength - 1 })
  } catch (error) {
    combinedOverflow = error?.code === 'RULE_CONTEXT_COMBINED_BUDGET_EXCEEDED'
  }
  assert(combinedOverflow, 'combined context has an independent hard budget')
  const tinyBudgetCatalog = renderAdvisoryRuleCatalog(syntheticPack, { rules: partitioned.advisory, maxBytes: 1 })
  assert(tinyBudgetCatalog.ruleCount === 1, 'advisory catalogue clamps an unusably small budget instead of reinjecting forever')
  console.log('PASS l2-rule-resolver (path normalization and bounded tiered injection)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
