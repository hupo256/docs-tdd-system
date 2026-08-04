#!/usr/bin/env node

export const ACCEPTANCE_METHODS = ['vitest', 'browser', 'contract', 'manual-visual', 'manual', 'not-applicable']
export const ACCEPTANCE_STATUSES = ['passed', 'failed', 'blocked', 'not-applicable']

const FEATURE_ID_RE = /^F\d+$/
const ACCEPTANCE_ID_RE = /^AC-\d+$/

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateAcceptanceResults(report, expectedProjectId = '') {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return ['acceptance-results.json 必须是对象']
  const errors = []
  if (!nonEmpty(report.projectId)) errors.push('缺 projectId')
  else if (!/^PR-\d{5}$/.test(report.projectId)) errors.push('projectId 须形如 PR-01234')
  else if (expectedProjectId && report.projectId !== expectedProjectId) errors.push(`projectId=${report.projectId} 与当前项目 ${expectedProjectId} 不一致`)
  if (!Array.isArray(report.items)) return [...errors, 'items 必须是数组']
  const ids = new Set()
  report.items.forEach((item, index) => {
    const at = `items[${index}]`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at} 必须是对象`)
      return
    }
    if (!ACCEPTANCE_ID_RE.test(item.id || '')) errors.push(`${at}.id 须形如 AC-1`)
    else if (ids.has(item.id)) errors.push(`id 重复：${item.id}`)
    else ids.add(item.id)
    if (!FEATURE_ID_RE.test(item.featureId || '')) errors.push(`${at}.featureId 须形如 F01`)
    if (!nonEmpty(item.scenario)) errors.push(`${at}.scenario 不能为空`)
    if (!ACCEPTANCE_METHODS.includes(item.method)) errors.push(`${at}.method 非法`)
    if (!ACCEPTANCE_STATUSES.includes(item.status)) errors.push(`${at}.status 非法`)
    if (!Array.isArray(item.evidence)) errors.push(`${at}.evidence 必须是数组`)
    if ((item.status === 'blocked' || item.status === 'not-applicable') && !nonEmpty(item.reason)) {
      errors.push(`${item.id || at} ${item.status} 必须有 reason`)
    }
  })
  return errors
}

export function acceptanceChecks({ report, doingFeatureIds, expectedProjectId = '', file = 'agent/acceptance-results.json' }) {
  const base = { file, category: 'documentation' }
  if (report === null || report === undefined) return []
  const structural = validateAcceptanceResults(report, expectedProjectId)
  if (structural.length) {
    return [{ ...base, ruleId: 'DOC-AC-001', ok: false, severity: 'error', message: `acceptance-results.json 结构非法：${structural.slice(0, 6).join('；')}` }]
  }
  const doing = [...new Set(doingFeatureIds || [])]
  const covered = new Set(report.items.map((item) => item.featureId))
  const missing = doing.filter((id) => !covered.has(id))
  const withoutPass = doing.filter((id) => !report.items.some((item) => item.featureId === id && item.status === 'passed'))
  const unresolved = report.items.filter((item) => item.status === 'failed' || item.status === 'blocked')
  const missingEvidence = report.items.filter((item) => item.status === 'passed' && item.evidence.length === 0)
  return [
    { ...base, ruleId: 'DOC-AC-001', ok: true, severity: 'error', message: `acceptance-results.json 合法（${report.items.length} 条）` },
    {
      ...base,
      ruleId: 'DOC-AC-002',
      ok: missing.length === 0 && withoutPass.length === 0,
      severity: 'error',
      message: missing.length
        ? `本期功能缺验收结果：${missing.join(', ')}`
        : withoutPass.length
          ? `本期功能没有 passed 验收：${withoutPass.join(', ')}`
          : `本期功能均有 passed 验收（${doing.length} 项）`,
    },
    {
      ...base,
      ruleId: 'DOC-AC-003',
      ok: unresolved.length === 0,
      severity: 'error',
      message: unresolved.length ? `验收仍有 failed/blocked：${unresolved.map((item) => item.id).join(', ')}` : '验收结果无 failed/blocked',
    },
    {
      ...base,
      ruleId: 'DOC-AC-004',
      ok: missingEvidence.length === 0,
      severity: 'error',
      message: missingEvidence.length ? `通过项缺 evidence：${missingEvidence.map((item) => item.id).join(', ')}` : '所有通过项均有 evidence',
    },
  ]
}

function selfTest() {
  const assert = (name, condition) => {
    if (!condition) {
      console.error(`FAIL ${name}`)
      process.exitCode = 1
    }
  }
  const passed = {
    projectId: 'PR-00001',
    items: [{ id: 'AC-1', featureId: 'F01', scenario: 'submit', method: 'vitest', status: 'passed', evidence: ['evidence/gate/g6/README.md'] }],
  }
  assert('valid', validateAcceptanceResults(passed).length === 0)
  assert('coverage pass', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'] }).every((item) => item.ok))
  assert('coverage fail', acceptanceChecks({ report: passed, doingFeatureIds: ['F01', 'F02'] }).find((item) => item.ruleId === 'DOC-AC-002')?.ok === false)
  const blocked = { ...passed, items: [{ ...passed.items[0], status: 'blocked', evidence: [], reason: 'missing account' }] }
  assert('blocked fails', acceptanceChecks({ report: blocked, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-003')?.ok === false)
  const notApplicable = { ...passed, items: [{ ...passed.items[0], status: 'not-applicable', evidence: [], reason: 'not needed' }] }
  assert('doing feature needs a pass', acceptanceChecks({ report: notApplicable, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-002')?.ok === false)
  assert('passed evidence required', acceptanceChecks({ report: { ...passed, items: [{ ...passed.items[0], evidence: [] }] }, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-004')?.ok === false)
  assert('wrong project fails structure', validateAcceptanceResults(passed, 'PR-00002').some((item) => item.includes('不一致')))
  if (!process.exitCode) console.log('acceptance-results lib self-test passed (7 cases)')
}

if (process.argv[1]?.endsWith('acceptance-results.mjs') && process.argv.includes('--self-test')) selfTest()
