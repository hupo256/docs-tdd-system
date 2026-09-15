#!/usr/bin/env node

import { splitPendingReconcile } from './gate-partial.mjs'
import { evidenceMethodMatches, REQUIREMENT_EVIDENCE_TYPES } from './requirement-coverage.mjs'

export const ACCEPTANCE_METHODS = ['vitest', 'browser', 'contract', 'manual-visual', 'manual', 'not-applicable']
export const ACCEPTANCE_STATUSES = ['passed', 'failed', 'blocked', 'not-applicable']

const FEATURE_ID_RE = /^F\d+$/
const ACCEPTANCE_ID_RE = /^AC-\d+$/
const REQUIREMENT_ID_RE = /^R-F\d+-\d+$/
const TASK_ID_RE = /^T\d+[a-z]?$/i

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

// evidence 条目是否像"文件路径锚点"（含路径分隔符或已知产物后缀），据此要求它真实存在。
// 纯文字说明（如"人工目测通过"）不算锚点：passed 项至少要有一条真实存在的文件锚点。
export function looksLikePath(value) {
  return typeof value === 'string' && (/[\\/]/.test(value) || /\.(png|jpe?g|gif|webp|svg|html?|json|md|txt|log|csv|mjs|js|ts|tsx)$/i.test(value.trim()))
}

// 验收报告是否覆盖当前 HEAD（仿 code-review.mjs reviewCoversHead）：head 或 currentSha 缺省时不判定（返回 true）。
export function acceptanceCoversHead(report, currentSha) {
  if (!report || !nonEmpty(report.head) || !nonEmpty(currentSha)) return true
  return report.head === currentSha || String(currentSha).startsWith(report.head) || report.head.startsWith(String(currentSha))
}

export function validateAcceptanceResults(report, expectedProjectId = '') {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return ['acceptance-results.json 必须是对象']
  const errors = []
  if (!nonEmpty(report.projectId)) errors.push('缺 projectId')
  else if (!/^PR-\d{5}$/.test(report.projectId)) errors.push('projectId 须形如 PR-01234')
  else if (expectedProjectId && report.projectId !== expectedProjectId) errors.push(`projectId=${report.projectId} 与当前项目 ${expectedProjectId} 不一致`)
  // head 记录验收对应的 commit sha：强制记录，代码再改即由 DOC-AC-006 判定过时。
  if (!nonEmpty(report.head)) errors.push('缺 head（须记录验收对应的 commit sha，代码变更后重跑）')
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
    if (item.requirementId !== undefined && !REQUIREMENT_ID_RE.test(item.requirementId || '')) errors.push(`${at}.requirementId 须形如 R-F09-01`)
    if (item.taskId !== undefined && !TASK_ID_RE.test(item.taskId || '')) errors.push(`${at}.taskId 须形如 T10a`)
    if (item.evidenceType !== undefined && !REQUIREMENT_EVIDENCE_TYPES.includes(item.evidenceType)) errors.push(`${at}.evidenceType 非法`)
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

// partial=true 即 G6-partial（部分验收）：依赖真实后端字段的 blocked 项（contract/browser）转记
// pending-reconcile —— 它们不再算 DOC-AC-003 的未处置项，也可代替 passed 满足 DOC-AC-002 的覆盖要求，
// 但会由 DOC-AC-007（warn）逐条点名。判定源在 lib/gate-partial.mjs。
export function acceptanceChecks({ report, doingFeatureIds, atomicRequirements = [], requirementTasks = [], expectedProjectId = '', currentSha = '', evidenceExists = null, file = 'agent/acceptance-results.json', partial = false }) {
  const base = { file, category: 'documentation' }
  if (report === null || report === undefined) return []
  const structural = validateAcceptanceResults(report, expectedProjectId)
  if (structural.length) {
    return [{ ...base, ruleId: 'DOC-AC-001', ok: false, severity: 'error', message: `acceptance-results.json 结构非法：${structural.slice(0, 6).join('；')}` }]
  }
  const doing = [...new Set(doingFeatureIds || [])]
  const covered = new Set(report.items.map((item) => item.featureId))
  const missing = doing.filter((id) => !covered.has(id))
  const pendingReconcile = partial ? splitPendingReconcile(report.items).pending : []
  const pendingIdSet = new Set(pendingReconcile.map((item) => item.id))
  const acceptedStatuses = (item) => item.status === 'passed' || pendingIdSet.has(item.id)
  const withoutPass = doing.filter((id) => !report.items.some((item) => item.featureId === id && acceptedStatuses(item)))
  const unresolved = report.items.filter((item) => (item.status === 'failed' || item.status === 'blocked') && !pendingIdSet.has(item.id))
  const missingEvidence = report.items.filter((item) => item.status === 'passed' && item.evidence.length === 0)
  const checks = [
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
  // DOC-AC-005：passed 项的 evidence 必须有真实存在的文件锚点（截图/DOM 比对/测试报告），
  // 堵"evidence 只写一句话就算通过"的缝。仅在 gate 侧注入 evidenceExists(基于 projectDir 的 existsSync) 时判定，
  // 保持 lib 无 I/O（对齐 code-review.mjs 的纯函数理念）。
  if (typeof evidenceExists === 'function') {
    const broken = []
    const noAnchor = []
    for (const item of report.items) {
      if (item.status !== 'passed') continue
      const pathLike = (item.evidence || []).filter(looksLikePath)
      const missingPaths = pathLike.filter((p) => !evidenceExists(p))
      const existingPaths = pathLike.filter((p) => evidenceExists(p))
      if (missingPaths.length) broken.push(`${item.id}→${missingPaths.join('/')}`)
      if (existingPaths.length === 0) noAnchor.push(item.id)
    }
    checks.push({
      ...base,
      ruleId: 'DOC-AC-005',
      ok: broken.length === 0 && noAnchor.length === 0,
      severity: 'error',
      message: broken.length
        ? `验收 evidence 指向不存在的文件：${broken.join('；')}`
        : noAnchor.length
          ? `通过项缺真实文件证据锚点（evidence 需含存在的截图/报告/DOM 比对文件）：${noAnchor.join(', ')}`
          : '所有通过项均有真实存在的 evidence 文件锚点',
    })
  }
  // DOC-AC-006：验收结果是否覆盖当前 HEAD（warn；head 已由结构校验强制，缺 currentSha 不判定）。
  const fresh = acceptanceCoversHead(report, currentSha)
  checks.push({
    ...base,
    ruleId: 'DOC-AC-006',
    ok: fresh,
    severity: 'warn',
    message: fresh
      ? 'acceptance-results 覆盖当前 HEAD（或未提供 currentSha，不判定）'
      : `acceptance-results.head(${report.head}) 与当前 HEAD(${String(currentSha).slice(0, 12)}) 不一致，验收可能已过时`,
  })
  // DOC-AC-007（warn，仅 partial）：待真实字段对账的验收项逐条点名。它是 partial 的"欠账清单"——
  // 这些项在本次不算失败，但必须在字段到位后重跑完整 G6 才算真的验收过。
  if (partial) {
    checks.push({
      ...base,
      ruleId: 'DOC-AC-007',
      ok: pendingReconcile.length === 0,
      severity: 'warn',
      message: pendingReconcile.length
        ? `G6-partial：${pendingReconcile.length} 条验收待真实字段对账（${pendingReconcile.map((item) => `${item.id}/${item.method}`).join(', ')}），字段到位后须重跑完整 G6`
        : 'G6-partial：无待真实字段对账的验收项（可直接跑完整 G6）',
    })
  }
  if (atomicRequirements.length) {
    const taskByRequirement = new Map(requirementTasks.map((task) => [task.requirementId, task.taskId]))
    const requirementById = new Map(atomicRequirements.map((requirement) => [requirement.id, requirement]))
    const missingRequirements = atomicRequirements.filter((requirement) => !report.items.some(
      (item) => item.requirementId === requirement.id && acceptedStatuses(item),
    ))
    checks.push({
      ...base,
      ruleId: 'DOC-AC-008',
      ok: missingRequirements.length === 0,
      severity: 'error',
      message: missingRequirements.length
        ? `原子需求缺 passed 验收：${missingRequirements.map((item) => item.id).join(', ')}`
        : `所有原子需求均有 passed 验收（${atomicRequirements.length} 条）`,
    })

    const issues = []
    for (const requirement of atomicRequirements) {
      const expectedTaskId = taskByRequirement.get(requirement.id)
      for (const evidenceType of requirement.evidenceTypes) {
        const matching = report.items.find((item) => (
          item.requirementId === requirement.id
          && item.taskId === expectedTaskId
          && item.evidenceType === evidenceType
          && item.featureId === requirement.featureId
          && acceptedStatuses(item)
          && evidenceMethodMatches(evidenceType, item.method)
        ))
        if (!matching) issues.push(`${requirement.id} 缺 ${evidenceType}`)
      }
    }
    for (const item of report.items.filter((candidate) => candidate.requirementId !== undefined)) {
      const requirement = requirementById.get(item.requirementId)
      if (!requirement) {
        issues.push(`${item.id} 引用未登记需求 ${item.requirementId}`)
        continue
      }
      const expectedTaskId = taskByRequirement.get(item.requirementId)
      if (item.featureId !== requirement.featureId) issues.push(`${item.id}.featureId 应为 ${requirement.featureId}`)
      if (item.taskId !== expectedTaskId) issues.push(`${item.id}.taskId 应为 ${expectedTaskId || '已映射任务'}`)
      if (!evidenceMethodMatches(item.evidenceType, item.method)) issues.push(`${item.id} 的 ${item.evidenceType} 不能由 ${item.method} 证明`)
    }
    checks.push({
      ...base,
      ruleId: 'DOC-AC-009',
      ok: issues.length === 0,
      severity: 'error',
      message: issues.length
        ? `原子需求证据类型/映射不匹配：${[...new Set(issues)].join('；')}`
        : '每条原子需求的全部所需证据类型均由匹配方法覆盖',
    })
  }
  return checks
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
    head: 'abc123def456',
    items: [{ id: 'AC-1', featureId: 'F01', scenario: 'submit', method: 'vitest', status: 'passed', evidence: ['evidence/gate/g6/README.md'] }],
  }
  // 真实存在的文件锚点白名单（mock existsSync）：只有 passed fixture 里那条路径算存在。
  const existsMock = (p) => p === 'evidence/gate/g6/README.md'
  assert('valid', validateAcceptanceResults(passed).length === 0)
  assert('missing head fails structure', validateAcceptanceResults({ ...passed, head: undefined }).some((item) => item.includes('head')))
  assert('coverage pass', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'] }).every((item) => item.ok))
  assert('coverage fail', acceptanceChecks({ report: passed, doingFeatureIds: ['F01', 'F02'] }).find((item) => item.ruleId === 'DOC-AC-002')?.ok === false)
  const blocked = { ...passed, items: [{ ...passed.items[0], status: 'blocked', evidence: [], reason: 'missing account' }] }
  assert('blocked fails', acceptanceChecks({ report: blocked, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-003')?.ok === false)
  const notApplicable = { ...passed, items: [{ ...passed.items[0], status: 'not-applicable', evidence: [], reason: 'not needed' }] }
  assert('doing feature needs a pass', acceptanceChecks({ report: notApplicable, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-002')?.ok === false)
  assert('passed evidence required', acceptanceChecks({ report: { ...passed, items: [{ ...passed.items[0], evidence: [] }] }, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-004')?.ok === false)
  assert('wrong project fails structure', validateAcceptanceResults(passed, 'PR-00002').some((item) => item.includes('不一致')))
  // DOC-AC-005：evidence 文件锚点真实性（仅注入 evidenceExists 时判定）。
  assert('AC-005 skipped without evidenceExists', !acceptanceChecks({ report: passed, doingFeatureIds: ['F01'] }).some((item) => item.ruleId === 'DOC-AC-005'))
  assert('AC-005 existing anchor passes', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'], evidenceExists: existsMock }).find((item) => item.ruleId === 'DOC-AC-005')?.ok === true)
  const brokenAnchor = { ...passed, items: [{ ...passed.items[0], evidence: ['evidence/gate/g6/missing.png'] }] }
  assert('AC-005 broken anchor fails', acceptanceChecks({ report: brokenAnchor, doingFeatureIds: ['F01'], evidenceExists: existsMock }).find((item) => item.ruleId === 'DOC-AC-005')?.ok === false)
  const textOnly = { ...passed, items: [{ ...passed.items[0], evidence: ['人工目测通过'] }] }
  assert('AC-005 text-only lacks anchor', acceptanceChecks({ report: textOnly, doingFeatureIds: ['F01'], evidenceExists: existsMock }).find((item) => item.ruleId === 'DOC-AC-005')?.ok === false)
  // DOC-AC-006：head 覆盖当前 HEAD（warn）。
  assert('AC-006 stale head warns', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'], currentSha: 'ffffffffffff' }).find((item) => item.ruleId === 'DOC-AC-006')?.ok === false)
  assert('AC-006 matching head passes', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'], currentSha: 'abc123def456789' }).find((item) => item.ruleId === 'DOC-AC-006')?.ok === true)
  assert('AC-006 no currentSha not judged', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-006')?.ok === true)
  // partial（G6-partial）：contract/browser 的 blocked 转待对账；vitest 的 blocked 仍算未处置。
  const blockedContract = { ...passed, items: [{ ...passed.items[0], method: 'contract', status: 'blocked', evidence: [], reason: '后端字段未就绪' }] }
  const partialContract = acceptanceChecks({ report: blockedContract, doingFeatureIds: ['F01'], partial: true })
  assert('partial contract blocked not unresolved', partialContract.find((item) => item.ruleId === 'DOC-AC-003')?.ok === true)
  assert('partial contract blocked covers doing feature', partialContract.find((item) => item.ruleId === 'DOC-AC-002')?.ok === true)
  assert('partial lists pending in AC-007', partialContract.find((item) => item.ruleId === 'DOC-AC-007')?.ok === false)
  assert('AC-007 absent without partial', !acceptanceChecks({ report: blockedContract, doingFeatureIds: ['F01'] }).some((item) => item.ruleId === 'DOC-AC-007'))
  assert('non-partial contract blocked still fails', acceptanceChecks({ report: blockedContract, doingFeatureIds: ['F01'] }).find((item) => item.ruleId === 'DOC-AC-003')?.ok === false)
  const blockedVitest = { ...passed, items: [{ ...passed.items[0], method: 'vitest', status: 'blocked', evidence: [], reason: '环境缺失' }] }
  assert('partial does not excuse vitest blocked', acceptanceChecks({ report: blockedVitest, doingFeatureIds: ['F01'], partial: true }).find((item) => item.ruleId === 'DOC-AC-003')?.ok === false)
  assert('AC-007 clean when nothing pending', acceptanceChecks({ report: passed, doingFeatureIds: ['F01'], partial: true }).find((item) => item.ruleId === 'DOC-AC-007')?.ok === true)
  const atomicRequirements = [{ id: 'R-F01-01', featureId: 'F01', statement: '标签改变', evidenceTypes: ['copy-literal', 'component-dom'] }]
  const requirementTasks = [{ requirementId: 'R-F01-01', featureId: 'F01', taskId: 'T10a' }]
  const atomicPassed = {
    ...passed,
    items: [
      { ...passed.items[0], id: 'AC-1', requirementId: 'R-F01-01', taskId: 'T10a', evidenceType: 'copy-literal', method: 'contract' },
      { ...passed.items[0], id: 'AC-2', requirementId: 'R-F01-01', taskId: 'T10a', evidenceType: 'component-dom', method: 'contract' },
    ],
  }
  const atomicChecks = acceptanceChecks({ report: atomicPassed, doingFeatureIds: ['F01'], atomicRequirements, requirementTasks })
  assert('atomic requirements covered', atomicChecks.find((item) => item.ruleId === 'DOC-AC-008')?.ok === true)
  assert('atomic evidence types matched', atomicChecks.find((item) => item.ruleId === 'DOC-AC-009')?.ok === true)
  const copyOnly = { ...atomicPassed, items: [atomicPassed.items[0]] }
  assert('copy evidence cannot prove DOM behavior', acceptanceChecks({ report: copyOnly, doingFeatureIds: ['F01'], atomicRequirements, requirementTasks }).find((item) => item.ruleId === 'DOC-AC-009')?.ok === false)
  const wrongMethod = { ...atomicPassed, items: atomicPassed.items.map((item) => item.evidenceType === 'component-dom' ? { ...item, method: 'manual' } : item) }
  assert('evidence method must match type', acceptanceChecks({ report: wrongMethod, doingFeatureIds: ['F01'], atomicRequirements, requirementTasks }).find((item) => item.ruleId === 'DOC-AC-009')?.ok === false)
  if (!process.exitCode) console.log('acceptance-results lib self-test passed (27 cases)')
}

if (process.argv[1]?.endsWith('acceptance-results.mjs') && process.argv.includes('--self-test')) selfTest()
