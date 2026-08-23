#!/usr/bin/env node

// warn 台账的健康度与退休判定（正文源见 rule-ids-and-gates.md §2.1）。
//
// 为什么要有「退休」这一档：晋级判据要求人工裁决（true/false-positive），而裁决从来没发生过——
// 台账里 12 个格子全是 unreviewed，`eligible = TP>=2 && FP===0` 永远算不出来。结果不是「规则在观察期」，
// 而是「永久 warn」：命中天天刷屏、谁也不必负责、也永远不会晋级成 error。
// 所以给观察期一个**默认结局**：超过 RETIREMENT_DAYS 天还没人裁决过一次的规则，自动降为 note-only
// 并列入待退休——沉默不再等于「继续保留」，而是等于「这条规则没人认，撤了」。想留下它的出口很便宜：
// `warn-ledger.mjs --mark <RULE> <PR> true-positive --write` 裁决一次即回到观察期。
import assert from 'node:assert/strict'

export const RETIREMENT_DAYS = 90

// 只按日粒度算差值；两个入参都是 YYYY-MM-DD。非法/缺失日期返回 null（调用方按「未知」处理，不当成 0 天）。
export function daysBetween(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to))) return null
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}

// 单条规则的健康度：累计命中、涉及 PR、首末命中、裁决分布、观察期年龄、结局。
export function ruleHealth(ruleId, projects = {}, today, days = RETIREMENT_DAYS) {
  const entries = Object.entries(projects)
  const values = entries.map(([projectId, value]) => ({ projectId, ...value }))
  const verdicts = {
    truePositive: values.filter((item) => item.verdict === 'true-positive').length,
    falsePositive: values.filter((item) => item.verdict === 'false-positive').length,
    unreviewed: values.filter((item) => item.verdict === 'unreviewed').length,
  }
  const seen = values.map((item) => item.firstSeen).filter(Boolean).sort()
  const last = values.map((item) => item.lastSeen).filter(Boolean).sort()
  const firstSeen = seen[0] || null
  const lastSeen = last[last.length - 1] || null
  const ageDays = firstSeen ? daysBetween(firstSeen, today) : null
  const reviewed = verdicts.truePositive + verdicts.falsePositive
  const eligible = verdicts.truePositive >= 2 && verdicts.falsePositive === 0
  // 判定顺序即优先级：够格晋级 > 有人裁决过（观察期有效）> 超期无人裁决（退休）> 观察期内。
  const state = eligible ? 'eligible'
    : reviewed > 0 ? 'reviewing'
      : ageDays !== null && ageDays >= days ? 'due-for-retirement'
        : 'watching'
  return {
    ruleId,
    hits: values.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    projects: values.map((item) => item.projectId).sort(),
    projectCount: values.length,
    firstSeen,
    lastSeen,
    ageDays,
    dueAt: firstSeen ? addDays(firstSeen, days) : null,
    ...verdicts,
    eligible,
    state,
  }
}

// 全台账健康度，按累计命中降序（Top-N 用它，「谁最吵」优先被看见）。
export function ledgerHealthRows(ledger, today, days = RETIREMENT_DAYS) {
  return Object.entries(ledger?.rules || {})
    .map(([ruleId, rule]) => ruleHealth(ruleId, rule?.projects, today, days))
    .sort((a, b) => b.hits - a.hits || a.ruleId.localeCompare(b.ruleId))
}

// 已退休（note-only）的规则 ID 集合：verify-code-rules 用它把 warn 降为 note。
export function retiredRuleIds(ledger, today, days = RETIREMENT_DAYS) {
  return ledgerHealthRows(ledger, today, days).filter((row) => row.state === 'due-for-retirement').map((row) => row.ruleId)
}

// 把已退休规则的 warn finding 降为 note（原地改 severity）。不动 error/waived：
// 退休只针对「观察期没人认的 warn」，不给任何真阻断规则开后门。
export function demoteRetiredFindings(findings, retired) {
  const set = retired instanceof Set ? retired : new Set(retired || [])
  let demoted = 0
  for (const finding of findings || []) {
    if (finding?.severity !== 'warn' || !set.has(finding.ruleId)) continue
    finding.severity = 'note'
    demoted += 1
  }
  return demoted
}

// 零命中清单：声明过但台账/门禁结果里从未出现过的规则 ID——退休的第二类候选（不是吵，是根本没咬到东西）。
export function zeroHitRuleIds(declaredIds, hitIds) {
  const hits = hitIds instanceof Set ? hitIds : new Set(hitIds || [])
  return [...new Set(declaredIds || [])].filter((id) => !hits.has(id)).sort()
}

const STATE_LABEL = {
  eligible: '可提 error',
  reviewing: '裁决中',
  'due-for-retirement': '待退休（已降 note-only）',
  watching: '观察期',
}

export function stateLabel(state) {
  return STATE_LABEL[state] || state
}

// G8 交付摘要的「warn 台账」段：Top-N + 待退休清单。放进交付摘要是为了逼它被人看见——
// 台账文件没人主动打开，交付摘要是每次 G8 必读的那一页。
export function renderWarnLedgerSection({ rows = [], topN = 5, days = RETIREMENT_DAYS } = {}) {
  if (!rows.length) return `Warn 台账（\`common/warn-ledger.json\`）：无记录。`
  const top = rows.slice(0, topN)
  const body = top.map((row) => `| ${row.ruleId} | ${row.hits} | ${row.projectCount} | ${row.lastSeen || '—'} | ${stateLabel(row.state)} |`).join('\n')
  const retired = rows.filter((row) => row.state === 'due-for-retirement')
  const retiredLine = retired.length
    ? `- 待退休（首次命中起 ${days} 天无人裁决 → 已自动降为 note-only）：${retired.map((row) => `${row.ruleId}（自 ${row.firstSeen}）`).join('、')}；要留下它就裁决一次：\`warn-ledger.mjs --mark <RULE> <PR-xxxxx> true-positive --write\``
    : `- 待退休：无`
  const eligible = rows.filter((row) => row.eligible)
  const eligibleLine = eligible.length ? `- 已够格提 error：${eligible.map((row) => row.ruleId).join('、')}` : '- 已够格提 error：无'
  return `Warn 台账 Top-${top.length}（跨 PR 累计，来源 \`common/warn-ledger.json\`；\`docs-tdd rule-health\` 看全量）：

| Rule ID | 累计命中 | PR 数 | 最近命中 | 结局 |
|---------|---------|-------|---------|------|
${body}

${retiredLine}
${eligibleLine}`
}

export function selfTest() {
  const today = '2026-08-23'
  const ledger = {
    rules: {
      'CODE-ARCH-003': { projects: {
        'PR-02074': { firstSeen: '2026-01-01', lastSeen: '2026-08-03', count: 18, verdict: 'unreviewed' },
        'PR-02306': { firstSeen: '2026-08-01', lastSeen: '2026-08-20', count: 5, verdict: 'unreviewed' },
      } },
      'CODE-STYLE-003': { projects: {
        'PR-02074': { firstSeen: '2026-08-20', lastSeen: '2026-08-20', count: 3, verdict: 'unreviewed' },
      } },
      'CODE-MOCK-003': { projects: {
        'PR-01930': { firstSeen: '2026-01-01', lastSeen: '2026-08-01', count: 2, verdict: 'true-positive' },
        'PR-02265': { firstSeen: '2026-02-01', lastSeen: '2026-08-02', count: 1, verdict: 'true-positive' },
      } },
      'CODE-QUERY-001': { projects: {
        'PR-01930': { firstSeen: '2026-01-01', lastSeen: '2026-08-01', count: 4, verdict: 'false-positive' },
      } },
    },
  }
  assert.equal(daysBetween('2026-08-01', '2026-08-23'), 22, '按日粒度算差值')
  assert.equal(daysBetween('', today), null, '缺日期返回 null，不当 0 天')

  const rows = ledgerHealthRows(ledger, today)
  assert.deepEqual(rows.map((row) => row.ruleId), ['CODE-ARCH-003', 'CODE-QUERY-001', 'CODE-MOCK-003', 'CODE-STYLE-003'], '按累计命中降序（23/4/3/3，同数按 ID 字典序）')
  const arch = rows.find((row) => row.ruleId === 'CODE-ARCH-003')
  assert.equal(arch.hits, 23, '累计命中跨 PR 相加')
  assert.equal(arch.firstSeen, '2026-01-01', 'firstSeen 取最早那格')
  assert.equal(arch.lastSeen, '2026-08-20', 'lastSeen 取最晚那格')
  assert.equal(arch.state, 'due-for-retirement', '全 unreviewed 且首次命中超 90 天 → 待退休')
  assert.equal(arch.dueAt, '2026-04-01', 'dueAt = firstSeen + 90 天')
  assert.equal(rows.find((row) => row.ruleId === 'CODE-STYLE-003').state, 'watching', '刚命中 3 天仍在观察期')
  assert.equal(rows.find((row) => row.ruleId === 'CODE-MOCK-003').state, 'eligible', '2 个 TP 零 FP → 可提 error')
  assert.equal(rows.find((row) => row.ruleId === 'CODE-QUERY-001').state, 'reviewing', '有人裁决过（哪怕是误报）就不算超期无人管')

  assert.deepEqual(retiredRuleIds(ledger, today), ['CODE-ARCH-003'], '只有超期未裁决的进退休集')
  assert.deepEqual(retiredRuleIds(ledger, today, 3650), [], '窗口足够长时无人退休（参数生效）')

  const findings = [
    { ruleId: 'CODE-ARCH-003', severity: 'warn' },
    { ruleId: 'CODE-ARCH-003', severity: 'error' },
    { ruleId: 'CODE-STYLE-003', severity: 'warn' },
    { ruleId: 'CODE-ARCH-003', severity: 'waived' },
  ]
  assert.equal(demoteRetiredFindings(findings, ['CODE-ARCH-003']), 1, '只降退休规则的 warn')
  assert.deepEqual(findings.map((f) => f.severity), ['note', 'error', 'warn', 'waived'], 'error/waived/未退休规则不受影响')

  assert.deepEqual(zeroHitRuleIds(['A', 'B', 'C', 'A'], ['B']), ['A', 'C'], '零命中清单去重并排序')
  assert.deepEqual(zeroHitRuleIds(['A'], new Set(['A'])), [], 'Set 入参同样支持')

  const section = renderWarnLedgerSection({ rows, topN: 2 })
  assert.ok(section.includes('Warn 台账 Top-2'), '标题反映实际条数')
  assert.ok(section.includes('CODE-ARCH-003') && !section.includes('| CODE-MOCK-003 |'), 'Top-N 截断在表格里生效')
  assert.ok(section.includes('待退休（首次命中起 90 天无人裁决'), '待退休行必须出现在交付摘要')
  assert.ok(section.includes('--mark'), '给出留下规则的出口命令')
  assert.ok(section.includes('CODE-MOCK-003'), '够格提 error 的规则即使不在 Top-N 也要点名')
  assert.ok(renderWarnLedgerSection({ rows: [] }).includes('无记录'), '空台账不渲染空表格')

  console.log('PASS warn-retirement (台账健康度 + 90 天退休 + Top-N 渲染)')
}

if (process.argv[1] && process.argv[1].endsWith('warn-retirement.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
