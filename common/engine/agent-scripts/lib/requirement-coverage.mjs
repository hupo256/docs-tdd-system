#!/usr/bin/env node

import assert from 'node:assert/strict'

export const REQUIREMENT_EVIDENCE_TYPES = [
  'copy-literal',
  'component-dom',
  'pure-logic',
  'payload-contract',
  'api-contract',
  'browser-interaction',
  'visual',
]

export const EVIDENCE_METHODS = {
  'copy-literal': ['contract'],
  'component-dom': ['contract', 'browser'],
  'pure-logic': ['vitest'],
  'payload-contract': ['vitest', 'contract'],
  'api-contract': ['vitest', 'contract'],
  'browser-interaction': ['browser'],
  visual: ['manual-visual'],
}

const REQUIREMENT_ID_RE = /^R-(F\d+)-\d+$/
const TASK_ID_RE = /^T\d+[a-z]?$/i

function templateVersion(text) {
  return Number(text.match(/template-version:\s*(\d+)/)?.[1] || 0)
}

function parseTable(text, heading) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return { found: false, headers: [], rows: [] }
  const tableLines = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line.startsWith('## ')) break
    if (line.startsWith('|')) tableLines.push(line)
  }
  const parsed = tableLines
    .filter((line) => !/^\|[-: |]+\|$/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  return { found: true, headers: parsed[0] || [], rows: parsed.slice(1) }
}

function columnIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header))
}

function splitEvidenceTypes(value) {
  return [...new Set(String(value || '').split(/[+，、,]/).map((item) => item.trim()).filter(Boolean))]
}

export function parseAtomicRequirements(inventoryText) {
  const table = parseTable(inventoryText, '## 原子需求清单')
  const strict = templateVersion(inventoryText) >= 3
  const applicable = strict || table.found
  if (!applicable) return { applicable: false, strict: false, requirements: [], errors: [] }
  if (!table.found) return { applicable: true, strict, requirements: [], errors: ['缺少「## 原子需求清单」'] }

  const idAt = columnIndex(table.headers, ['需求 ID', '原子需求 ID'])
  const featureAt = columnIndex(table.headers, ['功能 ID'])
  const statementAt = columnIndex(table.headers, ['PRD 原子条目', '原子需求', '需求'])
  const evidenceAt = columnIndex(table.headers, ['所需证据类型', '证据类型'])
  const errors = []
  if ([idAt, featureAt, statementAt, evidenceAt].some((index) => index < 0)) {
    errors.push('原子需求表必须包含「需求 ID / 功能 ID / PRD 原子条目 / 所需证据类型」列')
    return { applicable: true, strict, requirements: [], errors }
  }

  const seen = new Set()
  const requirements = table.rows.map((row, index) => {
    const id = row[idAt] || ''
    const featureId = row[featureAt] || ''
    const statement = row[statementAt] || ''
    const evidenceTypes = splitEvidenceTypes(row[evidenceAt])
    const label = `原子需求第 ${index + 1} 行`
    const matchedFeatureId = id.match(REQUIREMENT_ID_RE)?.[1]
    if (!REQUIREMENT_ID_RE.test(id)) errors.push(`${label} ID 须形如 R-F09-01`)
    else if (seen.has(id)) errors.push(`原子需求 ID 重复：${id}`)
    else seen.add(id)
    if (!/^F\d+$/.test(featureId)) errors.push(`${id || label} 功能 ID 须形如 F09`)
    if (matchedFeatureId && matchedFeatureId !== featureId) errors.push(`${id} 内嵌功能 ID 与 ${featureId} 不一致`)
    if (!statement || /待填写|待确认|多个子点/.test(statement)) errors.push(`${id || label} 缺可独立验收的 PRD 原子条目`)
    if (!evidenceTypes.length) errors.push(`${id || label} 缺所需证据类型`)
    const invalidEvidence = evidenceTypes.filter((type) => !REQUIREMENT_EVIDENCE_TYPES.includes(type))
    if (invalidEvidence.length) errors.push(`${id || label} 含非法证据类型：${invalidEvidence.join(', ')}`)
    return { id, featureId, statement, evidenceTypes }
  })
  if (!requirements.length) errors.push('原子需求清单不能为空')
  return { applicable: true, strict, requirements, errors }
}

export function parseRequirementTasks(tasksText) {
  const table = parseTable(tasksText, '## 任务清单')
  const idAt = columnIndex(table.headers, ['ID', '任务'])
  const featureAt = columnIndex(table.headers, ['功能 ID', '功能'])
  const requirementAt = columnIndex(table.headers, ['原子需求 ID'])
  if (!table.found || requirementAt < 0) return { hasRequirementColumn: false, tasks: [], errors: [] }
  const errors = []
  const tasks = []
  table.rows.forEach((row, index) => {
    const taskId = row[idAt] || ''
    const featureId = row[featureAt] || ''
    const rawRequirementId = row[requirementAt] || ''
    if (!rawRequirementId || ['—', '-', 'N/A'].includes(rawRequirementId)) return
    const requirementIds = rawRequirementId.split(/[+，、,\/]/).map((item) => item.trim()).filter(Boolean)
    if (requirementIds.length !== 1) errors.push(`${taskId || `任务第 ${index + 1} 行`} 必须只绑定一个原子需求 ID`)
    if (!TASK_ID_RE.test(taskId)) errors.push(`${taskId || `任务第 ${index + 1} 行`} ID 须形如 T10a`)
    if (!/^F\d+$/.test(featureId)) errors.push(`${taskId || `任务第 ${index + 1} 行`} 功能 ID 须形如 F09`)
    for (const requirementId of requirementIds) tasks.push({ taskId, featureId, requirementId })
  })
  return { hasRequirementColumn: true, tasks, errors }
}

export function atomicRequirementChecks({ inventoryText, tasksText, doingFeatureIds, inventoryFile, tasksFile }) {
  const parsed = parseAtomicRequirements(inventoryText)
  if (!parsed.applicable) return { requirements: [], tasks: [], checks: [] }
  const taskResult = parseRequirementTasks(tasksText)
  const doing = new Set(doingFeatureIds || [])
  const inventoryErrors = [...parsed.errors]
  for (const requirement of parsed.requirements) {
    if (!doing.has(requirement.featureId)) inventoryErrors.push(`${requirement.id} 绑定的 ${requirement.featureId} 不是本期=做`)
  }
  if (parsed.strict) {
    const coveredFeatures = new Set(parsed.requirements.map((item) => item.featureId))
    const missingFeatures = [...doing].filter((featureId) => !coveredFeatures.has(featureId))
    if (missingFeatures.length) inventoryErrors.push(`新版清单中本期功能缺原子需求：${missingFeatures.join(', ')}`)
  }

  const taskErrors = [...taskResult.errors]
  if (!taskResult.hasRequirementColumn) taskErrors.push('任务表缺少「原子需求 ID」列')
  const requirementIds = new Set(parsed.requirements.map((item) => item.id))
  for (const requirement of parsed.requirements) {
    const matches = taskResult.tasks.filter((task) => task.requirementId === requirement.id)
    if (matches.length !== 1) taskErrors.push(`${requirement.id} 必须恰好对应一个任务，当前 ${matches.length} 个`)
    else if (matches[0].featureId !== requirement.featureId) taskErrors.push(`${requirement.id} 的任务功能 ID 应为 ${requirement.featureId}`)
  }
  const unknown = taskResult.tasks.filter((task) => !requirementIds.has(task.requirementId))
  if (unknown.length) taskErrors.push(`任务引用未登记的原子需求：${unknown.map((item) => item.requirementId).join(', ')}`)

  return {
    requirements: parsed.requirements,
    tasks: taskResult.tasks,
    checks: [
      {
        ruleId: 'DOC-G2-006',
        ok: inventoryErrors.length === 0,
        severity: 'error',
        category: 'documentation',
        file: inventoryFile,
        message: inventoryErrors.length ? `原子需求清单非法：${inventoryErrors.join('；')}` : `原子需求清单合法（${parsed.requirements.length} 条）`,
      },
      {
        ruleId: 'DOC-G2-007',
        ok: taskErrors.length === 0,
        severity: 'error',
        category: 'documentation',
        file: tasksFile,
        message: taskErrors.length ? `原子需求 ↔ Task 覆盖非法：${taskErrors.join('；')}` : `每条原子需求均恰好对应一个独立任务（${parsed.requirements.length} 条）`,
      },
    ],
  }
}

export function evidenceMethodMatches(evidenceType, method) {
  return Boolean(EVIDENCE_METHODS[evidenceType]?.includes(method))
}

function selfTest() {
  const inventory = '<!-- template-version: 3 -->\n## 原子需求清单\n\n| 需求 ID | 功能 ID | PRD 原子条目 | 所需证据类型 |\n|---|---|---|---|\n| R-F01-01 | F01 | 标签显示新文案 | copy-literal + component-dom |'
  const tasks = '## 任务清单\n\n| ID | 功能 ID | 原子需求 ID | 任务 | 状态 |\n|---|---|---|---|---|\n| T10a | F01 | R-F01-01 | 改标签 | 待办 |'
  const valid = atomicRequirementChecks({ inventoryText: inventory, tasksText: tasks, doingFeatureIds: ['F01'] })
  assert.equal(valid.requirements.length, 1)
  assert.ok(valid.checks.every((check) => check.ok))
  assert.deepEqual(valid.requirements[0].evidenceTypes, ['copy-literal', 'component-dom'])
  assert.ok(evidenceMethodMatches('copy-literal', 'contract'))
  assert.ok(!evidenceMethodMatches('copy-literal', 'vitest'))
  assert.ok(evidenceMethodMatches('component-dom', 'contract'))
  assert.ok(!evidenceMethodMatches('component-dom', 'vitest'))
  assert.ok(!evidenceMethodMatches('visual', 'vitest'))

  const noTask = atomicRequirementChecks({ inventoryText: inventory, tasksText: tasks.replace('R-F01-01', '—'), doingFeatureIds: ['F01'] })
  assert.equal(noTask.checks.find((check) => check.ruleId === 'DOC-G2-007')?.ok, false)
  const missingFeature = atomicRequirementChecks({ inventoryText: inventory, tasksText: tasks, doingFeatureIds: ['F01', 'F02'] })
  assert.equal(missingFeature.checks.find((check) => check.ruleId === 'DOC-G2-006')?.ok, false)
  const legacy = atomicRequirementChecks({ inventoryText: '## 功能清单', tasksText: '', doingFeatureIds: ['F01'] })
  assert.equal(legacy.checks.length, 0)
  console.log('requirement-coverage self-test passed')
}

if (process.argv[1]?.endsWith('requirement-coverage.mjs') && process.argv.includes('--self-test')) selfTest()
