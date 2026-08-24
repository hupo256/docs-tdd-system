#!/usr/bin/env node
/**
 * Context pack 构建子系统：场景引用展开、markdown section 切片、context pack 物化，以及
 * rule-release / effective-rules 的新鲜度探测与硬闸。从 docs-tdd.mjs 抽出——那边只留薄路由，
 * 这坨随「新增场景 / 调整规则加载」增长的逻辑集中在此，纯函数（normalizeRuleRef / expandScenarioRefs /
 * selectMarkdownSections）可 `--self-test` 直测。
 *
 * 自成一体：自己 resolveRoots()、自己按相对位置定位同级脚本（rule-release.mjs / effective-rules.mjs），
 * 不依赖调用方的模块作用域。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots, rulesRoot } from './roots.mjs'
import { printReport } from './cli-report.mjs'

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const releaseScript = join(scriptsDir, 'rule-release.mjs')
const effectiveRulesScript = join(scriptsDir, 'effective-rules.mjs')

// 重构期临时开关：DOCS_TDD_SKIP_RULE_FRESHNESS=1 跳过新鲜度硬闸（context/changed/gate 前置），
// 稳定后不设此 env 即恢复严格模式。
const skipRuleFreshness = process.env.DOCS_TDD_SKIP_RULE_FRESHNESS === '1'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

export function normalizeRuleRef(ref) {
  if (typeof ref === 'string') return { file: ref, sections: '' }
  if (ref && typeof ref.file === 'string') return { file: ref.file, sections: ref.sections || '' }
  throw new Error(`invalid rule reference: ${JSON.stringify(ref)}`)
}

// 把一个 section selector（如 "1-3" / "2"）解析成 [min,max] 区间；非法即抛错。
function parseSelectorRange(part) {
  const match = /^(\d+)(?:-(\d+))?$/.exec(part)
  if (!match) throw new Error(`invalid section selector: ${part}`)
  const min = Number(match[1])
  const max = Number(match[2] || match[1])
  if (max < min) throw new Error(`invalid section selector: ${part}`)
  return [min, max]
}

// 把多个 section selector 合并成最小不重叠区间串（重叠/相邻区间并成一段）。
// 任一 selector 为空串（整文件）→ 返回 ''（整文件吞并所有区间）。用于同文件多次引用的去重。
export function mergeSectionSelectors(selectors) {
  if (selectors.some((selector) => !selector)) return ''
  const ranges = selectors
    .flatMap((selector) => selector.split(',').map((part) => part.trim()).filter(Boolean))
    .map(parseSelectorRange)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  for (const [min, max] of ranges) {
    const last = merged[merged.length - 1]
    // 相邻（min === last.max + 1）也合并：连续标题段拼接后语义不变，且减少引用条数。
    if (last && min <= last[1] + 1) last[1] = Math.max(last[1], max)
    else merged.push([min, max])
  }
  return merged.map(([min, max]) => (min === max ? `${min}` : `${min}-${max}`)).join(',')
}

export function expandScenarioRefs(index, scenario, stack = []) {
  if (stack.includes(scenario)) throw new Error(`scenario cycle: ${[...stack, scenario].join(' -> ')}`)
  const refs = index.scenarios?.[scenario]
  if (!Array.isArray(refs) || refs.length === 0) {
    const available = Object.keys(index.scenarios || {})
      .sort()
      .join(', ')
    throw new Error(`unknown scenario: ${scenario}; available: ${available}`)
  }
  const expanded = refs.flatMap((ref) => {
    if (ref && typeof ref.scenario === 'string') return expandScenarioRefs(index, ref.scenario, [...stack, scenario])
    return [normalizeRuleRef(ref)]
  })
  // 按文件聚合（保持首次出现顺序），同文件的多个 section 选择器合并成最小不重叠区间串——
  // 修掉「去重键是精确串 file#sections、重叠区间不合并」导致的同章节正文重复。
  const order = []
  const byFile = new Map()
  for (const ref of expanded) {
    if (!byFile.has(ref.file)) {
      byFile.set(ref.file, [])
      order.push(ref.file)
    }
    byFile.get(ref.file).push(ref.sections)
  }
  return order.map((file) => ({ file, sections: mergeSectionSelectors(byFile.get(file)) }))
}

export function selectMarkdownSections(text, selector) {
  if (!selector) return text
  const headings = [...text.matchAll(/^##\s+(\d+)(?:\.|\s)/gm)]
  // 多区间：逗号分隔，逐段切片按区间起点升序拼接。
  const ranges = selector.split(',').map((part) => part.trim()).filter(Boolean).map(parseSelectorRange)
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const slices = ranges.map(([min, max]) => {
    const start = headings.find((heading) => Number(heading[1]) === min)?.index
    const end = headings.find((heading) => Number(heading[1]) > max)?.index
    if (start === undefined) throw new Error(`section selector ${min}${max === min ? '' : `-${max}`} did not match any heading`)
    return text.slice(start, end ?? text.length)
  })
  return slices.join('')
}

export function createContextPack(id, scenario, release, effectiveRules, mode = 'compact') {
  const started = Date.now()
  const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
  const refs = expandScenarioRefs(index, scenario)

  const summaryRef = {
    file: `${id}/agent/context-summary.md`,
    sections: '',
    abs: join(resolveProjectRoot(id), 'agent/context-summary.md'),
  }
  const sources = [
    summaryRef,
    ...refs.map((normalized) => {
      // 规则文档在 common/rules/；少数被场景引用的 common/ 层文件（如 CHANGELOG.md）回退到 common/。
      const rulesPath = join(rulesRoot, normalized.file)
      const inRules = existsSync(rulesPath)
      return {
        file: inRules ? `common/rules/${normalized.file}` : `common/${normalized.file}`,
        abs: inRules ? rulesPath : join(docsRoot, 'common', normalized.file),
        sections: mode === 'full' ? '' : normalized.sections,
      }
    }),
  ]
  const sections = sources.map((source) => {
    const file = source.abs
    if (!existsSync(file)) throw new Error(`context source does not exist: ${source.file}`)
    const raw = readFileSync(file, 'utf8')
    return {
      label: `${source.file}${source.sections ? `#§${source.sections}` : ''}`,
      text: selectMarkdownSections(raw, source.sections),
    }
  })
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  const payload = sections.map(({ label, text }) => `${label}\n${text}`).join('\n')
  const fingerprint = createHash('sha256').update(`${effectiveRules.currentFingerprint}\n${scenario}\n${mode}\n${payload}`).digest('hex').slice(0, 12)
  const cacheDir = join(tmpdir(), 'docs-tdd-context')
  const output = join(cacheDir, `${id}-${scenario}-${mode}-${fingerprint}.md`)
  const conflictOverrides = effectiveRules.clientMatrix?.codex?.conflictOverrides || []
  const body = [
    '<!-- GENERATED CONTEXT PACK: disposable cache; source of truth remains docs_tdd -->',
    `# ${id} / ${scenario}`,
    '',
    `- ruleset: \`${ruleset.version}\``,
    `- rule release: \`${release.currentFingerprint}\``,
    `- effective rules: \`${effectiveRules.currentFingerprint}\``,
    ...conflictOverrides.map((override) => `- L2 conflict override: \`${override.loserFiles.join(', ')}\` -> **${override.winner}** (\`${override.id}\`)`),
    `- mode: \`${mode}\``,
    `- fingerprint: \`${fingerprint}\``,
    `- sources: ${sections.map(({ label }) => `\`${label}\``).join(', ')}`,
    '',
    ...sections.flatMap(({ label, text }) => [`## Source: ${label}`, '', text.trim(), '']),
  ].join('\n')

  mkdirSync(cacheDir, { recursive: true })
  const cacheHit = existsSync(output)
  if (!cacheHit) writeFileSync(output, `${body}\n`)
  return {
    scenario,
    fingerprint,
    output,
    refs: sections.map(({ label }) => label),
    sources,
    mode,
    cacheHit,
    sourceChars: sections.reduce((total, item) => total + Array.from(item.text).length, 0),
    packChars: Array.from(body).length + 1,
    durationMs: Date.now() - started,
  }
}

function inspectRelease(script) {
  const result = spawnSync(process.execPath, [script, '--check', '--json'], { cwd: repoRoot, encoding: 'utf8' })
  try {
    return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
  } catch (error) {
    return { fresh: false, status: 'invalid', parseError: error.message, exitCode: result.status ?? 1 }
  }
}

export const inspectRuleRelease = () => inspectRelease(releaseScript)
export const inspectEffectiveRules = () => inspectRelease(effectiveRulesScript)

// 打印 context pack 的一屏摘要（场景 / 模式 / 指纹 / 落盘路径 / 指标 / 路由到的规则）。
// 原本是 docs-tdd.mjs 里 6 行逐字段 console.log，收敛成 报告行表，经 cli-report 打印。
export function printContextPack(scenario, pack) {
  printReport([
    ['scenario', scenario],
    ['context mode', pack.mode],
    ['context fingerprint', pack.fingerprint],
    ['context pack', pack.output],
    ['context metrics', `sources=${pack.refs.length}, sourceChars=${pack.sourceChars}, packChars=${pack.packChars}, cache=${pack.cacheHit ? 'hit' : 'miss'}, duration=${pack.durationMs}ms`],
    ['routed rules', pack.refs.join(', ')],
  ])
}

export function requireFreshRuleRelease() {
  if (skipRuleFreshness) {
    console.error('[docs-tdd] ⚠ DOCS_TDD_SKIP_RULE_FRESHNESS=1：跳过 rule-release 新鲜度检查（重构期临时开关）')
    return { fresh: true, skipped: true }
  }
  const release = inspectRuleRelease()
  if (release.fresh) return release
  console.error(`rule release is ${release.status || 'invalid'}; current=${release.currentFingerprint || 'unknown'} published=${release.publishedFingerprint || 'none'}`)
  for (const key of ['added', 'changed', 'removed']) {
    if (release.diff?.[key]?.length) console.error(`${key}: ${release.diff[key].join(', ')}`)
  }
  console.error('run docs-tdd check <PROJECT-ID>, then rule-release.mjs --write before context/changed/gate')
  return null
}

export function requireFreshEffectiveRules() {
  if (skipRuleFreshness) {
    console.error('[docs-tdd] ⚠ DOCS_TDD_SKIP_RULE_FRESHNESS=1：跳过 effective-rules 新鲜度检查（重构期临时开关）')
    return { fresh: true, skipped: true }
  }
  const release = inspectEffectiveRules()
  if (release.fresh) return release
  console.error(`effective rules release is ${release.status || 'invalid'}; current=${release.currentFingerprint || 'unknown'} published=${release.publishedFingerprint || 'none'}`)
  if (release.missing?.length) console.error(`missing: ${release.missing.join(', ')}`)
  console.error('run effective-rules.mjs --doctor, fix errors, then effective-rules.mjs --write')
  return null
}

// ---------------------------------------------------------------------------
// self-test：纯函数（section 切片 / 场景展开 / 引用归一）。node lib/context-pack.mjs --self-test
// ---------------------------------------------------------------------------
function selfTest() {
  const assert = (cond, msg) => { if (!cond) { console.error(`[context-pack] self-test failed: ${msg}`); process.exit(1) } }
  const md = ['# Test', '', '## 1. One', 'one', '', '## 2 Two', 'two', '', '## 3. Three', 'three'].join('\n')
  assert(selectMarkdownSections(md, '2') === ['## 2 Two', 'two', '', ''].join('\n'), 'section 2 slice')
  assert(selectMarkdownSections(md, '1-2') === ['## 1. One', 'one', '', '## 2 Two', 'two', '', ''].join('\n'), 'section 1-2 slice')
  // 多区间：不相邻的 1 与 3 分别切片后拼接（跳过中间的 §2）。
  assert(selectMarkdownSections(md, '1,3') === ['## 1. One', 'one', '', '## 3. Three', 'three'].join('\n'), 'multi-range 1,3 slice')
  let threw = false
  try { selectMarkdownSections(md, '2-1') } catch { threw = true }
  assert(threw, 'reversed selector rejected')
  threw = false
  try { selectMarkdownSections(md, '4') } catch { threw = true }
  assert(threw, 'missing heading rejected')
  // 区间合并：重叠/相邻/整文件吞并。
  assert(mergeSectionSelectors(['5-6', '1-3', '3', '6']) === '1-3,5-6', 'overlapping ranges merged (gap kept)')
  assert(mergeSectionSelectors(['2-4', '2-3', '2']) === '2-4', 'nested ranges merged')
  assert(mergeSectionSelectors(['1-3', '4-6']) === '1-6', 'adjacent ranges merged')
  assert(mergeSectionSelectors(['1-3', '']) === '', 'whole-file selector absorbs ranges')
  assert(normalizeRuleRef('a.md').file === 'a.md', 'string ref normalized')
  assert(normalizeRuleRef({ file: 'b.md', sections: '1-2' }).sections === '1-2', 'object ref normalized')
  const index = { scenarios: { base: ['a.md', { file: 'b.md', sections: '1' }], derived: [{ scenario: 'base' }, 'c.md'] } }
  const expanded = expandScenarioRefs(index, 'derived')
  assert(expanded.length === 3 && expanded[2].file === 'c.md', 'scenario refs expanded + deduped')
  // 同文件多次引用（跨子场景）合并成单条、区间取并集。
  const overlap = { scenarios: { q: [{ file: 'q.md', sections: '5-6' }, { file: 'q.md', sections: '1-3' }, { file: 'q.md', sections: '3' }] } }
  const mergedRefs = expandScenarioRefs(overlap, 'q')
  assert(mergedRefs.length === 1 && mergedRefs[0].sections === '1-3,5-6', 'same-file refs merged to one')
  threw = false
  try { expandScenarioRefs({ scenarios: { x: [{ scenario: 'x' }] } }, 'x') } catch { threw = true }
  assert(threw, 'scenario cycle detected')
  console.log('PASS context-pack (selectMarkdownSections + mergeSectionSelectors + normalizeRuleRef + expandScenarioRefs)')
}

if (process.argv[1] && process.argv[1].endsWith('context-pack.mjs') && process.argv.includes('--self-test')) selfTest()
