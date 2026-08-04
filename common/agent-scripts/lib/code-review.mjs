#!/usr/bin/env node
// G6 /code-review findings 的机器可读单一源：把「跑没跑 review、findings 处理没处理」从
// 06-collaboration.md 的散文（VERIFY-G6-002 靠正则 grep「已修/待修复」字样）挪到结构化
// agent/code-review.json。为什么：散文 grep 一改口径就漏，且「写了 3 条 findings」和
// 「3 条都处理了」在散文里几乎无法机器区分。语义纯函数集中在这里，verify-project-gate 消费。
//
// 纯函数、无 I/O：disposition 的判定喂对象即可断言，gate 的 --self-test 不碰真实项目。

export const CR_DISPOSITIONS = ['fixed', 'waived', 'not-applicable', 'open']
export const CR_SEVERITIES = ['high', 'medium', 'low']
export const CR_CATEGORIES = ['correctness', 'reuse', 'simplification', 'efficiency', 'security', 'test-coverage', 'other']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ID_RE = /^CR-\d+$/

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

// 单条 finding → 错误串数组（空 = 合法）。
export function validateFinding(finding, index) {
  const where = `findings[${index}]`
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return [`${where} 必须是对象`]
  const errors = []
  const label = isNonEmptyString(finding.id) ? finding.id : where

  if (!isNonEmptyString(finding.id)) errors.push(`${where} 缺 id`)
  else if (!ID_RE.test(finding.id)) errors.push(`${label} id 须形如 CR-1`)

  if (!CR_CATEGORIES.includes(finding.category)) errors.push(`${label} category 须是 ${CR_CATEGORIES.join('/')}`)
  if (!CR_SEVERITIES.includes(finding.severity)) errors.push(`${label} severity 须是 ${CR_SEVERITIES.join(' | ')}`)
  if (!isNonEmptyString(finding.summary)) errors.push(`${label} 缺 summary`)
  if (!CR_DISPOSITIONS.includes(finding.disposition)) errors.push(`${label} disposition 须是 ${CR_DISPOSITIONS.join(' | ')}`)
  // fixed / waived 必须留下处理结论；not-applicable / open 不强制（open 就是「还没处理」）。
  if ((finding.disposition === 'fixed' || finding.disposition === 'waived') && !isNonEmptyString(finding.resolution)) {
    errors.push(`${label} disposition=${finding.disposition} 必须填 resolution`)
  }
  if (finding.evidence !== undefined && !Array.isArray(finding.evidence)) errors.push(`${label} evidence 须是数组`)
  return errors
}

// 整份报告的结构校验（顶层字段 + findings 各条 + id 唯一）。返回错误串数组。
export function validateCodeReview(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return ['code-review.json 必须是对象']
  const errors = []
  if (!isNonEmptyString(report.projectId)) errors.push('缺 projectId')
  if (!DATE_RE.test(report.reviewedAt ?? '')) errors.push('reviewedAt 须是 YYYY-MM-DD')
  if (!isNonEmptyString(report.reviewer)) errors.push('缺 reviewer')
  if (!Array.isArray(report.findings)) return [...errors, 'findings 须是数组']

  const seen = new Map()
  report.findings.forEach((finding, index) => {
    errors.push(...validateFinding(finding, index))
    const id = finding && typeof finding === 'object' ? finding.id : undefined
    if (isNonEmptyString(id)) {
      if (seen.has(id)) errors.push(`id 重复：${id}（findings[${seen.get(id)}] 与 findings[${index}]）`)
      else seen.set(id, index)
    }
  })
  return errors
}

// disposition=open 的 findings：未处理 = G6 不得通过（要么当场修，要么 waive/标 N/A）。
export function openFindings(report) {
  const list = Array.isArray(report?.findings) ? report.findings : []
  return list.filter((finding) => finding && finding.disposition === 'open')
}

// 报告是否覆盖当前 HEAD：head 记录了且与当前 sha 不一致 = review 可能已过时（跑完又改了代码）。
// head 缺省时不判定（返回 true），避免强推所有项目都记 sha。
export function reviewCoversHead(report, currentSha) {
  if (!report || !isNonEmptyString(report.head) || !isNonEmptyString(currentSha)) return true
  return report.head === currentSha || currentSha.startsWith(report.head) || report.head.startsWith(currentSha)
}

// gate 消费：标准 check 形状（聚合式）。report===null（文件缺失）→ 不发 check，散文回退由调用方处理。
export function codeReviewChecks({ report, currentSha, file = 'agent/code-review.json' }) {
  const base = { file, category: 'documentation' }
  if (report === null || report === undefined) return []

  const structural = validateCodeReview(report)
  if (structural.length) {
    return [{ ...base, ruleId: 'DOC-CR-001', ok: false, severity: 'error', message: `code-review.json 结构非法：${structural.slice(0, 6).join('；')}${structural.length > 6 ? ` …(+${structural.length - 6})` : ''}` }]
  }

  const checks = [{ ...base, ruleId: 'DOC-CR-001', ok: true, severity: 'error', message: `code-review.json 合法（${report.findings.length} 条 findings）` }]
  const open = openFindings(report)
  checks.push({
    ...base,
    ruleId: 'DOC-CR-002',
    ok: open.length === 0,
    severity: 'error',
    message: open.length
      ? `code-review 有未处理 findings（需当场修或 waive/标 N/A）：${open.map((finding) => `${finding.id}(${finding.category})`).join('、')}`
      : `code-review findings 全部有处理结论（${report.findings.length} 条）`,
  })
  const fresh = reviewCoversHead(report, currentSha)
  checks.push({
    ...base,
    ruleId: 'DOC-CR-003',
    ok: fresh,
    severity: 'warn',
    message: fresh
      ? 'code-review 覆盖当前 HEAD（或未记录 head，不判定）'
      : `code-review.head(${report.head}) 与当前 HEAD(${String(currentSha).slice(0, 12)}) 不一致，review 可能已过时`,
  })
  return checks
}

function selfTest() {
  const assert = (name, condition) => {
    if (!condition) {
      console.error(`FAIL ${name}`)
      process.exitCode = 1
    }
  }
  const okReport = {
    projectId: 'PR-00001',
    reviewedAt: '2026-08-04',
    reviewer: 'aven',
    head: 'abc123',
    findings: [
      { id: 'CR-1', category: 'correctness', severity: 'high', summary: 'x', disposition: 'fixed', resolution: 'patched', evidence: [] },
    ],
  }

  assert('valid report', validateCodeReview(okReport).length === 0)
  assert('fixed needs resolution', validateFinding({ id: 'CR-1', category: 'reuse', severity: 'low', summary: 'x', disposition: 'fixed' }, 0).some((e) => e.includes('resolution')))
  assert('open needs no resolution', validateFinding({ id: 'CR-1', category: 'reuse', severity: 'low', summary: 'x', disposition: 'open' }, 0).length === 0)
  assert('bad id', validateFinding({ ...okReport.findings[0], id: 'X-1' }, 0).some((e) => e.includes('id')))
  assert('bad disposition', validateFinding({ ...okReport.findings[0], disposition: 'done' }, 0).some((e) => e.includes('disposition')))
  assert('missing reviewer', validateCodeReview({ ...okReport, reviewer: '' }).some((e) => e.includes('reviewer')))
  assert('duplicate id', validateCodeReview({ ...okReport, findings: [okReport.findings[0], { ...okReport.findings[0] }] }).some((e) => e.includes('重复')))

  assert('absent → 空', codeReviewChecks({ report: null }).length === 0)
  const structuralBad = codeReviewChecks({ report: { ...okReport, reviewer: '' } })
  assert('structural bad → 只 001', structuralBad.length === 1 && structuralBad[0].ruleId === 'DOC-CR-001' && !structuralBad[0].ok)
  const openReport = { ...okReport, findings: [{ id: 'CR-9', category: 'security', severity: 'high', summary: 'leak', disposition: 'open' }] }
  assert('open finding → 002 fail', codeReviewChecks({ report: openReport }).find((c) => c.ruleId === 'DOC-CR-002')?.ok === false)
  assert('clean → 002 pass', codeReviewChecks({ report: okReport }).find((c) => c.ruleId === 'DOC-CR-002')?.ok === true)
  assert('stale head → 003 warn fail', codeReviewChecks({ report: okReport, currentSha: 'def456' }).find((c) => c.ruleId === 'DOC-CR-003')?.ok === false)
  assert('matching head → 003 pass', codeReviewChecks({ report: okReport, currentSha: 'abc123456' }).find((c) => c.ruleId === 'DOC-CR-003')?.ok === true)
  assert('no head → 003 pass', codeReviewChecks({ report: { ...okReport, head: undefined }, currentSha: 'def456' }).find((c) => c.ruleId === 'DOC-CR-003')?.ok === true)
  assert('openFindings 只收 open', openFindings({ findings: [okReport.findings[0], openReport.findings[0]] }).length === 1)

  if (!process.exitCode) console.log('code-review lib self-test passed (16 cases)')
}

if (process.argv[1] && process.argv[1].endsWith('code-review.mjs') && process.argv.includes('--self-test')) {
  selfTest()
}
