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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots, rulesRoot } from './roots.mjs'
import { charCount } from './doc-budget-schema.mjs'
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
  // brief 模式：纯机器/参考型文档（gate 会真跑判定，AI 无需逐字读）折成一行指针，其余照常按 section 切片。
  const briefCollapse = new Set(mode === 'brief' ? index.policy?.briefCollapse || [] : [])

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
        collapse: briefCollapse.has(normalized.file),
      }
    }),
  ]
  const sections = sources.map((source) => {
    if (source.collapse) {
      const suffix = source.sections ? `#§${source.sections}` : ''
      return {
        label: `${source.file}${suffix} (brief)`,
        text: `> [BRIEF] 机器/门禁校验规则，正文未展开：门禁失败时按 finding 的 RULE-ID 运行 \`docs-tdd explain <RULE-ID>\`，或直接读 \`${source.file}\`${suffix}。`,
      }
    }
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
    sectionSizes: sections.map(({ label, text }) => ({ label, chars: charCount(text) })),
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

// context pack 预算门禁（warn/fail 两档，数据驱动）：把 packChars 真正消费起来，超限列出最大来源。
// budget 取自 rule-index.json policy.contextBudget[kind]（kind: coding|stage）。缺配置即放行。
// warn → console.warn 不阻断；fail → console.error + 返回 ok:false（调用方 exit(1)）。对齐 check-doc-budget 两档模型。
export function enforceContextBudget(pack, kind, budget) {
  if (!budget) return { ok: true, level: 'ok' }
  const chars = pack.packChars
  const { warn, fail } = budget
  if (chars <= (warn ?? Number.POSITIVE_INFINITY)) return { ok: true, level: 'ok' }
  const overFail = fail != null && chars > fail
  const top = [...(pack.sectionSizes || [])]
    .sort((a, b) => b.chars - a.chars)
    .slice(0, 5)
    .map((item) => `    ${String(item.chars).padStart(6)}  ${item.label}`)
  const emit = overFail ? console.error : console.warn
  emit(`context budget ${overFail ? 'FAIL' : 'WARN'}: ${kind} pack ${chars} 字符 > ${overFail ? `fail ${fail}` : `warn ${warn}`}`)
  emit('  最大来源（字符）：')
  for (const line of top) emit(line)
  if (overFail) emit('  瘦身：确认编码/验收场景已命中 brief 折叠（勿滥用 --full），或拆分场景引用，机器规则用 docs-tdd explain 按需展开。')
  return { ok: !overFail, level: overFail ? 'fail' : 'warn' }
}

// ---------------------------------------------------------------------------
// 注入去重：同任务内同一 (scenario, contextFingerprint) 不重复吐全文，只回 delta 指针。
// 台账落 agent/context-injections.json（非门禁证据，纯去重提示；schema 校验不覆盖此文件）。
// 指纹含 effectiveRules + 场景 + 正文，规则/内容一变即失配、自然重新生成。
// ---------------------------------------------------------------------------
const INJECTION_LEDGER_LIMIT = 20

export function loadInjectionLedger(id) {
  const file = join(resolveProjectRoot(id), 'agent/context-injections.json')
  if (!existsSync(file)) return { file, injections: [] }
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'))
    return { file, injections: Array.isArray(data.injections) ? data.injections : [] }
  } catch {
    return { file, injections: [] }
  }
}

// 命中条件：场景 + 指纹一致，且缓存包文件仍在（/tmp 被清则视为未注入，重新生成）。
export function findInjectedPack(ledger, scenario, fingerprint) {
  return ledger.injections.find((entry) => entry.scenario === scenario && entry.fingerprint === fingerprint && existsSync(entry.output))
}

export function recordInjection(ledger, entry) {
  const injections = [entry, ...ledger.injections.filter((prev) => !(prev.scenario === entry.scenario && prev.fingerprint === entry.fingerprint))].slice(0, INJECTION_LEDGER_LIMIT)
  mkdirSync(dirname(ledger.file), { recursive: true })
  writeFileSync(ledger.file, `${JSON.stringify({ version: 1, injections }, null, 2)}\n`)
}

// delta 指针：本任务已注入过同指纹包，提示 AI 直接复用已读内容、无需重读全文。
export function printContextDelta(scenario, pack) {
  printReport([
    ['scenario', scenario],
    ['context', 'delta: none — 同指纹包本任务已注入，若已读可跳过重读'],
    ['context pack', pack.output],
    ['context fingerprint', pack.fingerprint],
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
  // 预算门禁三档：无 budget 放行；> warn 且 ≤ fail → warn(ok);  > fail → fail(!ok)。
  // 静音其打印（warn/error 行是被断言的预期行为，不是测试失败），只校验返回判定。
  const budgetPack = { packChars: 15000, sectionSizes: [{ label: 'a', chars: 15000 }] }
  const realWarn = console.warn
  const realError = console.error
  console.warn = () => {}
  console.error = () => {}
  const budgetVerdicts = {
    none: enforceContextBudget(budgetPack, 'coding', undefined),
    under: enforceContextBudget({ packChars: 5000, sectionSizes: [] }, 'coding', { warn: 12000, fail: 24000 }),
    warn: enforceContextBudget(budgetPack, 'coding', { warn: 12000, fail: 24000 }),
    fail: enforceContextBudget({ packChars: 30000, sectionSizes: [] }, 'coding', { warn: 12000, fail: 24000 }),
  }
  console.warn = realWarn
  console.error = realError
  assert(budgetVerdicts.none.ok, 'no budget passes')
  assert(budgetVerdicts.under.level === 'ok', 'under warn ok')
  assert(budgetVerdicts.warn.level === 'warn' && budgetVerdicts.warn.ok, 'over warn warns (not blocking)')
  assert(!budgetVerdicts.fail.ok, 'over fail blocks')
  // 注入去重：同 scenario+fingerprint 且包文件存在才算命中；recordInjection 去重 + 限长。
  const tmpPack = join(tmpdir(), 'ctx-inject-selftest.md')
  writeFileSync(tmpPack, 'x')
  const ledger = { file: join(tmpdir(), 'ctx-inject-selftest-ledger.json'), injections: [{ scenario: 's', fingerprint: 'fp', output: tmpPack }] }
  assert(findInjectedPack(ledger, 's', 'fp'), 'existing injection with live file matched')
  assert(!findInjectedPack(ledger, 's', 'other'), 'different fingerprint not matched')
  assert(!findInjectedPack({ injections: [{ scenario: 's', fingerprint: 'fp', output: join(tmpdir(), 'nope.md') }] }, 's', 'fp'), 'missing pack file not matched')
  rmSync(tmpPack, { force: true })
  console.log('PASS context-pack (selectMarkdownSections + mergeSectionSelectors + normalizeRuleRef + expandScenarioRefs + enforceContextBudget + injection-ledger)')
}

if (process.argv[1] && process.argv[1].endsWith('context-pack.mjs') && process.argv.includes('--self-test')) selfTest()
