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
import { printReport } from './cli-report.mjs'
import { charCount } from './doc-budget-schema.mjs'
import { pinnedFileExists, readPinnedFile } from './pinned-source.mjs'
import { resolveProjectRoot, resolveRoots, rulesRoot } from './roots.mjs'

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree } = resolveRoots()
const executionRoot = consumerWorktree && consumerWorktree !== docsRoot ? consumerWorktree : repoRoot
const releaseScript = join(scriptsDir, 'rule-release.mjs')
const effectiveRulesScript = join(scriptsDir, 'effective-rules.mjs')

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

export function normalizeRuleRef(ref) {
  if (typeof ref === 'string') return { file: ref, sections: '', brief: '' }
  if (ref && typeof ref.file === 'string') return { file: ref.file, sections: ref.sections || '', brief: ref.brief || '' }
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
    .flatMap((selector) =>
      selector
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    )
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

function subtractCoveredRange([min, max], covered) {
  let pending = [[min, max]]
  for (const [coveredMin, coveredMax] of covered) {
    pending = pending.flatMap(([start, end]) => {
      if (coveredMax < start || coveredMin > end) return [[start, end]]
      const remaining = []
      if (coveredMin > start) remaining.push([start, coveredMin - 1])
      if (coveredMax < end) remaining.push([coveredMax + 1, end])
      return remaining
    })
  }
  return pending
}

const formatRanges = (ranges) => ranges.map(([min, max]) => (min === max ? `${min}` : `${min}-${max}`)).join(',')

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
  // 按展开顺序扣除已经出现过的区间。这样既消除重叠正文，也不会把后续子场景的章节提前到文件首次出现处。
  const coverage = new Map()
  const result = []
  for (const ref of expanded) {
    const state = coverage.get(ref.file) || { whole: false, ranges: [], brief: ref.brief }
    if (state.brief !== ref.brief) throw new Error(`conflicting brief modes for ${ref.file}`)
    if (state.whole) continue
    if (!ref.sections) {
      if (state.ranges.length) throw new Error(`whole-file reference for ${ref.file} appears after section references; make the route explicit to preserve order`)
      result.push(ref)
      state.whole = true
      coverage.set(ref.file, state)
      continue
    }
    // 先归一当前引用自身的重叠/相邻区间，再与历史覆盖相减；否则 `1-3,2-4` 会在同一 source 内重复正文。
    const requested = mergeSectionSelectors([ref.sections]).split(',').map(parseSelectorRange)
    const remaining = requested.flatMap((range) => subtractCoveredRange(range, state.ranges))
    if (remaining.length) result.push({ ...ref, sections: formatRanges(remaining) })
    const coveredSelectors = state.ranges.map(([min, max]) => (min === max ? `${min}` : `${min}-${max}`))
    state.ranges = mergeSectionSelectors([...coveredSelectors, ref.sections])
      .split(',')
      .filter(Boolean)
      .map(parseSelectorRange)
    coverage.set(ref.file, state)
  }
  return result
}

export function selectMarkdownSections(text, selector) {
  if (!selector) return text
  const headings = [...text.matchAll(/^##\s+(\d+)(?:\.|\s)/gm)]
  // 多区间：逗号分隔，逐段切片按区间起点升序拼接。
  const ranges = selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseSelectorRange)
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const slices = ranges.map(([min, max]) => {
    const start = headings.find((heading) => Number(heading[1]) === min)?.index
    const end = headings.find((heading) => Number(heading[1]) > max)?.index
    if (start === undefined) throw new Error(`section selector ${min}${max === min ? '' : `-${max}`} did not match any heading`)
    return text.slice(start, end ?? text.length)
  })
  return slices.join('')
}

export function createContextPack(id, scenario, release, effectiveRules, mode = 'compact', options = {}) {
  const started = Date.now()
  const pinnedCommit = options.pinnedCommit || null
  const index = readJson(join(docsRoot, 'common/rules/rule-index.json'))
  const refs = expandScenarioRefs(index, scenario)
  const summaryRef = {
    file: `${id}/agent/context-summary.md`,
    sections: '',
    abs: join(resolveProjectRoot(id), 'agent/context-summary.md'),
    inlineText: options.summaryText,
  }
  const sources = [
    ...(options.includeSummary === false ? [] : [summaryRef]),
    ...refs.map((normalized) => {
      // 规则文档在 common/rules/；少数被场景引用的 common/ 层文件（如 CHANGELOG.md）回退到 common/。
      const rulesPath = join(rulesRoot, normalized.file)
      const inRules = existsSync(rulesPath)
      // relPath 相对 docsSystemRoot——供按 pinned commit 不可变读取（`git show <commit>:relPath`）。
      const relPath = inRules ? `common/rules/${normalized.file}` : `common/${normalized.file}`
      return {
        file: relPath,
        relPath,
        abs: inRules ? rulesPath : join(docsRoot, 'common', normalized.file),
        sections: mode === 'full' ? '' : normalized.sections,
        collapse: mode === 'brief' && normalized.brief === 'pointer',
      }
    }),
  ]
  const sections = sources.map((source) => {
    // 规则文档走 pinned commit（不可变、不受维护者工作副本编辑污染）；项目摘要/内联文本仍读本地。
    const pinned = pinnedCommit && source.relPath
    if (source.inlineText == null && !pinned && !existsSync(source.abs)) throw new Error(`context source does not exist: ${source.file}`)
    if (pinned && source.inlineText == null && !pinnedFileExists({ commit: pinnedCommit, relPath: source.relPath })) {
      throw new Error(`pinned rule source missing at ${pinnedCommit.slice(0, 12)}: ${source.relPath}`)
    }
    if (source.collapse) {
      const suffix = source.sections ? `#§${source.sections}` : ''
      return {
        label: `${source.file}${suffix} (brief)`,
        text: `> [BRIEF] 机器/门禁校验规则，正文未展开：门禁失败时按 finding 的 RULE-ID 运行 \`docs-tdd explain <RULE-ID>\`，或直接读 \`${source.file}\`${suffix}。`,
      }
    }
    const raw = source.inlineText ?? (pinned ? readPinnedFile({ commit: pinnedCommit, relPath: source.relPath }) : readFileSync(source.abs, 'utf8'))
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

  if (options.write !== false) mkdirSync(cacheDir, { recursive: true })
  const cacheHit = existsSync(output)
  if (options.write !== false && !cacheHit) writeFileSync(output, `${body}\n`)
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
  const result = spawnSync(process.execPath, [script, '--check', '--json'], { cwd: executionRoot, encoding: 'utf8' })
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
  const release = inspectRuleRelease()
  // 只有 manifest 损坏/缺失才致命；stale（工作副本领先已发布）不再阻断业务项目——项目按各自 pin 跑，
  // 规则维护侧另有 `docs-tdd release/golden` 硬闸兜住「未发布不能发布」。
  if (release.status === 'invalid' || release.status === 'missing') {
    console.error(`rule release is ${release.status}; current=${release.currentFingerprint || 'unknown'} published=${release.publishedFingerprint || 'none'}`)
    console.error('run docs-tdd check <PROJECT-ID>, then rule-release.mjs --write to repair the manifest')
    return null
  }
  if (!release.fresh) {
    const engineOnly = release.policyFresh && !release.engineFresh
    console.error(`[docs-tdd] ⚠ rule sources are ahead of the published release${engineOnly ? ' (engine only — does not affect pinned projects)' : ''}; projects run against their pinned policy. Publish with \`docs-tdd release\` when ready.`)
  }
  return release
}

// effective-rules（个人 L1 + 各端 adapter 的聚合快照）已退役为「展示基线」，不再是业务命令的运行前置。
// 缺失/损坏/漂移一律只 warn 并回退一个占位对象——业务项目按各自 pinned 规则政策跑，绝不因个人规则面
// 状态而停工（维护侧另有 docs-tdd release/guard/golden 硬闸兜住「个人规则面没发布不能发布」）。
export function requireFreshEffectiveRules() {
  const release = inspectEffectiveRules()
  if (release.status === 'invalid' || release.status === 'missing') {
    console.error(`[docs-tdd] ⚠ effective rules snapshot is ${release.status}; business commands run against each project's pinned policy (not blocking). Run effective-rules.mjs --write to refresh the display baseline.`)
    return { fresh: false, status: release.status, currentFingerprint: release.currentFingerprint || 'unpublished', clientMatrix: release.clientMatrix || {} }
  }
  if (!release.fresh) {
    console.error('[docs-tdd] ⚠ effective rules are ahead of the published snapshot; current agent may need to reload context. Not blocking the project.')
  }
  return release
}

// ---------------------------------------------------------------------------
// self-test：纯函数（section 切片 / 场景展开 / 引用归一）。node lib/context-pack.mjs --self-test
// ---------------------------------------------------------------------------
function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`[context-pack] self-test failed: ${msg}`)
      process.exit(1)
    }
  }
  const md = ['# Test', '', '## 1. One', 'one', '', '## 2 Two', 'two', '', '## 3. Three', 'three'].join('\n')
  assert(selectMarkdownSections(md, '2') === ['## 2 Two', 'two', '', ''].join('\n'), 'section 2 slice')
  assert(selectMarkdownSections(md, '1-2') === ['## 1. One', 'one', '', '## 2 Two', 'two', '', ''].join('\n'), 'section 1-2 slice')
  // 多区间：不相邻的 1 与 3 分别切片后拼接（跳过中间的 §2）。
  assert(selectMarkdownSections(md, '1,3') === ['## 1. One', 'one', '', '## 3. Three', 'three'].join('\n'), 'multi-range 1,3 slice')
  let threw = false
  try {
    selectMarkdownSections(md, '2-1')
  } catch {
    threw = true
  }
  assert(threw, 'reversed selector rejected')
  threw = false
  try {
    selectMarkdownSections(md, '4')
  } catch {
    threw = true
  }
  assert(threw, 'missing heading rejected')
  // 区间合并工具仍供 policy/诊断使用；场景展开本身按原始顺序扣除重叠。
  assert(mergeSectionSelectors(['5-6', '1-3', '3', '6']) === '1-3,5-6', 'overlapping ranges merged (gap kept)')
  assert(mergeSectionSelectors(['2-4', '2-3', '2']) === '2-4', 'nested ranges merged')
  assert(mergeSectionSelectors(['1-3', '4-6']) === '1-6', 'adjacent ranges merged')
  assert(mergeSectionSelectors(['1-3', '']) === '', 'whole-file selector absorbs ranges')
  assert(normalizeRuleRef('a.md').file === 'a.md', 'string ref normalized')
  assert(normalizeRuleRef({ file: 'b.md', sections: '1-2' }).sections === '1-2', 'object ref normalized')
  const index = { scenarios: { base: ['a.md', { file: 'b.md', sections: '1' }], derived: [{ scenario: 'base' }, 'c.md'] } }
  const expanded = expandScenarioRefs(index, 'derived')
  assert(expanded.length === 3 && expanded[2].file === 'c.md', 'scenario refs expanded + deduped')
  // 同文件多次引用（跨子场景）去重但保留首次出现顺序，后续只留下未覆盖区间。
  const overlap = {
    scenarios: {
      q: [
        { file: 'q.md', sections: '5-6' },
        { file: 'q.md', sections: '1-3' },
        { file: 'q.md', sections: '3' },
      ],
    },
  }
  const mergedRefs = expandScenarioRefs(overlap, 'q')
  assert(mergedRefs.length === 2 && mergedRefs[0].sections === '5-6' && mergedRefs[1].sections === '1-3', 'same-file refs deduped without reordering')
  const internalOverlap = expandScenarioRefs({ scenarios: { q: [{ file: 'q.md', sections: '1-3,2-4' }] } }, 'q')
  assert(internalOverlap.length === 1 && internalOverlap[0].sections === '1-4', 'same-ref overlapping ranges merged')
  const partialThenWhole = { scenarios: { q: [{ file: 'q.md', sections: '2' }, 'q.md'] } }
  threw = false
  try {
    expandScenarioRefs(partialThenWhole, 'q')
  } catch {
    threw = true
  }
  assert(threw, 'ambiguous partial-then-whole route rejected')
  threw = false
  try {
    expandScenarioRefs({ scenarios: { x: [{ scenario: 'x' }] } }, 'x')
  } catch {
    threw = true
  }
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
  console.log('PASS context-pack (section selection + order-preserving dedupe + budget)')
}

if (process.argv[1] && process.argv[1].endsWith('context-pack.mjs') && process.argv.includes('--self-test')) selfTest()
