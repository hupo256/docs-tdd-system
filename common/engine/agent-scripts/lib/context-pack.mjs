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
  const seen = new Set()
  return expanded.filter((ref) => {
    const key = `${ref.file}#${ref.sections}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function selectMarkdownSections(text, selector) {
  if (!selector) return text
  const match = /^(\d+)(?:-(\d+))?$/.exec(selector)
  if (!match) throw new Error(`invalid section selector: ${selector}`)
  const min = Number(match[1])
  const max = Number(match[2] || match[1])
  if (max < min) throw new Error(`invalid section selector: ${selector}`)
  const headings = [...text.matchAll(/^##\s+(\d+)(?:\.|\s)/gm)]
  const start = headings.find((heading) => Number(heading[1]) === min)?.index
  const end = headings.find((heading) => Number(heading[1]) > max)?.index
  if (start === undefined) throw new Error(`section selector ${selector} did not match any heading`)
  return text.slice(start, end ?? text.length)
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
  let threw = false
  try { selectMarkdownSections(md, '2-1') } catch { threw = true }
  assert(threw, 'reversed selector rejected')
  threw = false
  try { selectMarkdownSections(md, '4') } catch { threw = true }
  assert(threw, 'missing heading rejected')
  assert(normalizeRuleRef('a.md').file === 'a.md', 'string ref normalized')
  assert(normalizeRuleRef({ file: 'b.md', sections: '1-2' }).sections === '1-2', 'object ref normalized')
  const index = { scenarios: { base: ['a.md', { file: 'b.md', sections: '1' }], derived: [{ scenario: 'base' }, 'c.md'] } }
  const expanded = expandScenarioRefs(index, 'derived')
  assert(expanded.length === 3 && expanded[2].file === 'c.md', 'scenario refs expanded + deduped')
  threw = false
  try { expandScenarioRefs({ scenarios: { x: [{ scenario: 'x' }] } }, 'x') } catch { threw = true }
  assert(threw, 'scenario cycle detected')
  console.log('PASS context-pack (selectMarkdownSections + normalizeRuleRef + expandScenarioRefs)')
}

if (process.argv[1] && process.argv[1].endsWith('context-pack.mjs') && process.argv.includes('--self-test')) selfTest()
