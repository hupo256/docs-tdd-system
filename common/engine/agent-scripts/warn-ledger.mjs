#!/usr/bin/env node
// warn-ledger.mjs — 把 warn-first 规则的「连续 2 PR 零误报」晋级判据从人脑/手填表格变成可审计机器台账。
// gate --write 自动记录命中（verdict 默认 unreviewed），人工用 --mark 标 true-positive / false-positive，
// --report 计算晋级候选。判据正文源见 rule-ids-and-gates.md §2.1；本脚本只负责记录与计算，不自动改规则严重度。

import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { listProjectIds, resolveProjectRoot, resolveRoots, rulesRoot } from './lib/roots.mjs'
import { RETIREMENT_DAYS, ledgerHealthRows, stateLabel, zeroHitRuleIds } from './lib/warn-retirement.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const ledgerFile = join(docsRoot, 'common/warn-ledger.json')

// 计划晋级的 warn-first 规则（与 rule-ids-and-gates.md §2.1 台账一致）。
// 「按阶段/场景合法」的永久 warn（MOCK-001/002、MSW-003、ASSUMED-001、SCOPE-001、DOC-G0-004）不进台账。
export const PROMOTABLE = new Set([
  'CODE-NAMING-001', 'CODE-MOCK-003', 'CODE-ARCH-002', 'CODE-ARCH-003',
  'CODE-STYLE-003', 'CODE-QUERY-001', 'CODE-QUERY-002', 'CODE-MOCK-006', 'CODE-COPY-001',
])
const VERDICTS = new Set(['unreviewed', 'true-positive', 'false-positive'])

export function isPromotable(ruleId) {
  return PROMOTABLE.has(ruleId)
}

export function emptyLedger() {
  return { tool: 'warn-ledger.mjs', updatedAt: null, rules: {} }
}

// 单条命中入账：按 (ruleId, projectId) 去重（一 PR 一格，符合「连续 N 个 PR」的计数单位），
// 保留已有人工 verdict，只刷新 lastSeen/fingerprint/count；新格默认 unreviewed。
export function upsertHit(ledger, { ruleId, projectId, fingerprint = '', count = 1, at }) {
  const rules = ledger.rules || (ledger.rules = {})
  const rule = rules[ruleId] || (rules[ruleId] = { projects: {} })
  const existing = rule.projects[projectId]
  rule.projects[projectId] = {
    firstSeen: existing?.firstSeen || at,
    lastSeen: at,
    lastFingerprint: fingerprint || existing?.lastFingerprint || '',
    count,
    verdict: existing?.verdict || 'unreviewed',
  }
  return ledger
}

// 从一批 findings（verify-code-rules --json 的 findings）记录本 PR 命中的可晋级 warn 规则。
export function recordFindings(ledger, { projectId, fingerprint = '', at, findings = [] }) {
  const counts = new Map()
  for (const f of findings) {
    if (String(f.severity) !== 'warn' || !isPromotable(f.ruleId)) continue
    counts.set(f.ruleId, (counts.get(f.ruleId) || 0) + 1)
  }
  for (const [ruleId, count] of counts) upsertHit(ledger, { ruleId, projectId, fingerprint, count, at })
  return { ledger, recorded: [...counts.keys()] }
}

// 晋级评估：真命中 ≥2 个不同 PR 且零误报 = 可提 error（误报归零重计 → 有任一误报即不合格）。
export function evaluateRule(projects = {}) {
  const values = Object.values(projects)
  const truePositive = values.filter((p) => p.verdict === 'true-positive').length
  const falsePositive = values.filter((p) => p.verdict === 'false-positive').length
  const unreviewed = values.filter((p) => p.verdict === 'unreviewed').length
  return { truePositive, falsePositive, unreviewed, total: values.length, eligible: truePositive >= 2 && falsePositive === 0 }
}

export function setVerdict(ledger, ruleId, projectId, verdict) {
  if (!VERDICTS.has(verdict)) throw new Error(`invalid verdict: ${verdict} (use ${[...VERDICTS].join('/')})`)
  const entry = ledger.rules?.[ruleId]?.projects?.[projectId]
  if (!entry) throw new Error(`no ledger entry for ${ruleId} / ${projectId}`)
  entry.verdict = verdict
  return ledger
}

export function loadLedger() {
  if (!existsSync(ledgerFile)) return emptyLedger()
  try { return JSON.parse(readFileSync(ledgerFile, 'utf8')) } catch { return emptyLedger() }
}

export function saveLedger(ledger, at) {
  ledger.updatedAt = at
  writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`)
}

// ---- CLI ----

function nowIso() { return new Date().toISOString() }
function today() { return nowIso().slice(0, 10) }

function readWorktree(projectId) {
  const readmeFile = join(resolveProjectRoot(projectId), 'README.md')
  const readme = existsSync(readmeFile) ? readFileSync(readmeFile, 'utf8') : ''
  const configured = readme.match(/^worktree:\s*(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, '').trim()
  const worktree = configured ? resolve(resolveProjectRoot(projectId), configured) : repoRoot
  return existsSync(worktree) ? worktree : repoRoot
}

function reportRows() {
  const ledger = loadLedger()
  return Object.entries(ledger.rules || {}).sort(([a], [b]) => a.localeCompare(b)).map(([ruleId, rule]) => {
    const evalResult = evaluateRule(rule.projects)
    return { ruleId, ...evalResult, projects: Object.keys(rule.projects || {}).sort() }
  })
}

function printHelp() {
  console.log(`usage: warn-ledger.mjs <record PR-01234 | --report | --health | --mark RULE PR-01234 VERDICT> [--write] [--json] [--self-test] [--help]

Machine ledger for warn-first rule promotion (rule-ids-and-gates.md §2.1).
  record PR-01234   Run verify-code-rules for the project and record promotable warn hits (needs --write to persist)
  --report          Show per-rule true/false-positive counts and promotion eligibility
  --health          Rule health review: hits per rule, warn ledger age, retirement candidates, zero-hit rules
  --mark R PR V     Set human verdict (V = true-positive|false-positive|unreviewed) for a rule/PR (needs --write)
  --self-test       Run inline pure-function tests`)
}

// 门禁侧命中统计：只读每个项目 agent/gate-results.json（**最近一次**运行），故这是快照而不是终身累计。
// 这个口径限制在输出里明说——rule-health 的用途是「哪些规则根本没在咬东西」，快照足够回答它。
function gateHitStats() {
  const hits = new Map()
  for (const id of listProjectIds()) {
    const file = join(resolveProjectRoot(id), 'agent/gate-results.json')
    if (!existsSync(file)) continue
    let payload
    try { payload = JSON.parse(readFileSync(file, 'utf8')) } catch { continue }
    const at = String(payload?.generatedAt || '').slice(0, 10)
    for (const check of payload?.checks || []) {
      if (!check?.ruleId || check.ok) continue
      const row = hits.get(check.ruleId) || { ruleId: check.ruleId, fail: 0, warn: 0, waived: 0, lastSeen: '', projects: [] }
      if (check.severity === 'error') row.fail += 1
      else if (check.severity === 'warn') row.warn += 1
      else row.waived += 1
      if (!row.projects.includes(id)) row.projects.push(id)
      if (at > row.lastSeen) row.lastSeen = at
      hits.set(check.ruleId, row)
    }
  }
  return [...hits.values()].sort((a, b) => (b.fail + b.warn) - (a.fail + a.warn) || a.ruleId.localeCompare(b.ruleId))
}

// 声明过的全部 Rule ID：两份台账正文（rule-id-ledger.md 的阶段 gate 表 + rule-ids-and-gates.md 的 CODE/VERIFY 表）。
// 多段 ID（如 DOC-G3-IMPL-006）也要认，故中间段允许重复出现。
function declaredRuleIds() {
  const text = ['rule-id-ledger.md', 'rule-ids-and-gates.md']
    .map((name) => join(rulesRoot, name))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  return [...new Set([...text.matchAll(/\b(?:DOC|CODE|GIT|VERIFY)(?:-[A-Z0-9]+)+-\d{3}\b/g)].map((match) => match[0]))].sort()
}

function healthReport() {
  const ledgerRows = ledgerHealthRows(loadLedger(), today())
  const gateRows = gateHitStats()
  const hitIds = new Set([...ledgerRows.map((row) => row.ruleId), ...gateRows.map((row) => row.ruleId)])
  const declared = declaredRuleIds()
  return {
    generatedAt: nowIso(),
    retirementDays: RETIREMENT_DAYS,
    ledger: ledgerRows,
    gateHits: gateRows,
    declaredCount: declared.length,
    zeroHit: zeroHitRuleIds(declared, hitIds),
    retiring: ledgerRows.filter((row) => row.state === 'due-for-retirement').map((row) => row.ruleId),
    eligible: ledgerRows.filter((row) => row.eligible).map((row) => row.ruleId),
  }
}

function printHealth(report, verbose) {
  console.log(`rule-health @ ${report.generatedAt.slice(0, 19).replace('T', ' ')}（退休窗口 ${report.retirementDays} 天；正文源 rule-ids-and-gates.md §2.1）\n`)
  console.log(`1. warn 晋级台账（common/warn-ledger.json，跨 PR 累计）`)
  if (!report.ledger.length) console.log('   （空）跑一次 G5+ gate --write 才会入账')
  for (const row of report.ledger) {
    console.log(`   ${row.ruleId}: 命中 ${row.hits} 次 / ${row.projectCount} 个 PR，首次 ${row.firstSeen} 最近 ${row.lastSeen}，TP=${row.truePositive} FP=${row.falsePositive} 未裁决=${row.unreviewed} → ${stateLabel(row.state)}${row.state === 'watching' ? `（${row.dueAt} 前无人裁决即退休）` : ''}`)
  }
  console.log(`\n2. 门禁命中（各项目 gate-results.json 的**最近一次**运行，快照非累计）`)
  const gateRows = verbose ? report.gateHits : report.gateHits.slice(0, 12)
  for (const row of gateRows) {
    console.log(`   ${row.ruleId}: fail=${row.fail} warn=${row.warn} waived=${row.waived}，最近 ${row.lastSeen || '—'}，项目 [${row.projects.join(', ')}]`)
  }
  if (report.gateHits.length > gateRows.length) console.log(`   …另有 ${report.gateHits.length - gateRows.length} 条（--verbose 全量）`)
  console.log(`\n3. 零命中规则（已声明 ${report.declaredCount} 条，其中 ${report.zeroHit.length} 条在台账与最近门禁结果里都没出现）`)
  console.log(`   ${(verbose ? report.zeroHit : report.zeroHit.slice(0, 20)).join(' ') || '无'}`)
  if (!verbose && report.zeroHit.length > 20) console.log(`   …另有 ${report.zeroHit.length - 20} 条（--verbose 全量）`)
  console.log(`\n4. 结论`)
  console.log(`   待退休（已自动降 note-only）：${report.retiring.join('、') || '无'}${report.retiring.length ? `\n     想留下就裁决一次：node warn-ledger.mjs --mark <RULE> <PR-xxxxx> true-positive --write；否则从脚本里删掉该规则` : ''}`)
  console.log(`   可提 error：${report.eligible.join('、') || '无'}`)
  console.log(`   零命中有两种，机器分不了：① 预防型规则场景没发生（这是它该有的样子，别删）；② 正则/判定从来没咬到东西（形同摆设，该删）。只有判定为 ② 的才退休。`)
}

const args = process.argv.slice(2)
const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href

function cli() {
if (args.includes('--help')) { printHelp(); process.exit(0) }

if (args.includes('--self-test')) {
  let l = emptyLedger()
  recordFindings(l, { projectId: 'PR-00001', at: '2026-08-03', findings: [
    { ruleId: 'CODE-ARCH-002', severity: 'warn' }, { ruleId: 'CODE-ARCH-002', severity: 'warn' },
    { ruleId: 'CODE-TYPE-001', severity: 'error' }, { ruleId: 'CODE-MOCK-001', severity: 'warn' },
  ] })
  assert.equal(l.rules['CODE-ARCH-002'].projects['PR-00001'].count, 2, 'counts promotable warn hits')
  assert.ok(!l.rules['CODE-TYPE-001'], 'ignores non-warn')
  assert.ok(!l.rules['CODE-MOCK-001'], 'ignores permanent-warn (non-promotable)')
  assert.equal(evaluateRule(l.rules['CODE-ARCH-002'].projects).eligible, false, 'unreviewed is not eligible')
  setVerdict(l, 'CODE-ARCH-002', 'PR-00001', 'true-positive')
  upsertHit(l, { ruleId: 'CODE-ARCH-002', projectId: 'PR-00002', at: '2026-08-03' })
  setVerdict(l, 'CODE-ARCH-002', 'PR-00002', 'true-positive')
  assert.equal(evaluateRule(l.rules['CODE-ARCH-002'].projects).eligible, true, '2 true-positive PRs, 0 FP = eligible')
  upsertHit(l, { ruleId: 'CODE-ARCH-002', projectId: 'PR-00003', at: '2026-08-03' })
  setVerdict(l, 'CODE-ARCH-002', 'PR-00003', 'false-positive')
  assert.equal(evaluateRule(l.rules['CODE-ARCH-002'].projects).eligible, false, 'any false-positive resets eligibility')
  // upsert preserves human verdict
  upsertHit(l, { ruleId: 'CODE-ARCH-002', projectId: 'PR-00001', at: '2026-08-04', count: 5 })
  assert.equal(l.rules['CODE-ARCH-002'].projects['PR-00001'].verdict, 'true-positive', 'verdict preserved on re-record')
  assert.throws(() => setVerdict(l, 'CODE-ARCH-002', 'PR-00001', 'bogus'), /invalid verdict/)
  console.log('warn-ledger self-test passed (promotable filter + eligibility + verdict persistence).')
  process.exit(0)
}

const write = args.includes('--write')
const json = args.includes('--json')
const positional = args.filter((a) => !a.startsWith('--'))

if (args.includes('--health') || positional[0] === 'health') {
  const report = healthReport()
  if (json) console.log(JSON.stringify(report, null, 2))
  else printHealth(report, args.includes('--verbose'))
  process.exit(0)
}

if (positional[0] === 'record') {
  const projectId = positional[1]
  if (!/^(?:PR|TR)-\d{5}$/.test(projectId || '')) { console.error('usage: warn-ledger.mjs record <PROJECT-ID> --write'); process.exit(1) }
  const worktree = readWorktree(projectId)
  const run = spawnSync(process.execPath, [join(scriptDir, 'verify-code-rules.mjs'), '--project', projectId, '--json'], { cwd: worktree, encoding: 'utf8' })
  let findings = []
  try { findings = JSON.parse(run.stdout).findings || [] } catch { console.error('could not parse verify-code-rules output'); process.exit(1) }
  const fingerprint = codeFingerprint(worktree).headSha
  const ledger = loadLedger()
  const { recorded } = recordFindings(ledger, { projectId, fingerprint, at: today(), findings })
  if (write) saveLedger(ledger, nowIso())
  console.log(`warn-ledger record ${projectId}: ${recorded.length ? recorded.join(', ') : 'no promotable warn hits'}${write ? ' (persisted)' : ' (dry-run; add --write)'}`)
  process.exit(0)
}

if (positional[0] === 'mark' || args.includes('--mark')) {
  const rest = positional[0] === 'mark' ? positional.slice(1) : positional
  const [ruleId, projectId, verdict] = rest
  const ledger = loadLedger()
  try {
    setVerdict(ledger, ruleId, projectId, verdict)
  } catch (error) { console.error(error.message); process.exit(1) }
  if (write) saveLedger(ledger, nowIso())
  console.log(`warn-ledger mark ${ruleId} / ${projectId} = ${verdict}${write ? ' (persisted)' : ' (dry-run; add --write)'}`)
  process.exit(0)
}

// default: --report
const rows = reportRows()
if (json) { console.log(JSON.stringify({ rules: rows }, null, 2)); process.exit(0) }
if (!rows.length) { console.log('warn-ledger: no recorded hits yet. Run a gate with --write on a real PR to populate.'); process.exit(0) }
console.log('warn-ledger report (promotion criterion: ≥2 true-positive PRs, 0 false-positive):')
for (const r of rows) {
  const flag = r.eligible ? '✅ ELIGIBLE for error' : `${r.unreviewed ? `${r.unreviewed} unreviewed` : ''}${r.falsePositive ? ` ${r.falsePositive} FP` : ''}`.trim() || 'warn'
  console.log(`  ${r.ruleId}: TP=${r.truePositive} FP=${r.falsePositive} unreviewed=${r.unreviewed} PRs=[${r.projects.join(', ')}] → ${flag}`)
}
const eligible = rows.filter((r) => r.eligible)
if (eligible.length) console.log(`\n晋级候选（人工确认后改脚本 'warn'→'error' 并更新 §2.1）：${eligible.map((r) => r.ruleId).join(', ')}`)
process.exit(0)
}

if (isMain) cli()
