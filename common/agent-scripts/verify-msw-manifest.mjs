#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree } = resolveRoots()
const projectId = process.argv[2]
const json = process.argv.includes('--json')

function failUsage() {
  console.error('usage: verify-msw-manifest.mjs PR-01234 [--json] [--self-test]')
  process.exit(1)
}

function readJson(file) {
  try {
    return { data: JSON.parse(readFileSync(file, 'utf8')), error: '' }
  } catch (error) {
    return { data: null, error: error.message }
  }
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function resolveSourceRoot(projectDir, sourceRoot) {
  if (!sourceRoot) return consumerWorktree || repoRoot
  if (isAbsolute(sourceRoot)) return sourceRoot
  return resolve(projectDir, sourceRoot)
}

function validateScenario(scenario) {
  if (!scenario?.name || !['implemented', 'not-applicable', 'retired'].includes(scenario.status)) return false
  return scenario.status !== 'not-applicable' || Boolean(scenario.reason?.trim())
}

// 退役拆除断言（DOC-G3-IMPL-004 的一部分）：mock-retired 时不仅要有 evidence，handler 文件应已删除、
// 注册文件不应再引用它——否则「零残留」只是声明未落实（评审发现 retirementOk 只校验两个字符串非空，
// Agent 可在 handler 仍在时伪造 evidence 通过）。纯函数以便 self-test。
function retirementIssues({ retired, retirement, handlerExists, registrationText, handlerExport }) {
  if (!retired) return []
  const issues = []
  if (!retirement?.retiredAt || !retirement?.reconciliationEvidence) issues.push('evidence missing')
  if (handlerExists) issues.push('handler file still present')
  if (handlerExport && registrationText.includes(handlerExport)) issues.push('handler still registered')
  return issues
}

function runSelfTest() {
  const valid = validateScenario({ name: 'empty', status: 'not-applicable', reason: 'detail endpoint' })
  const missingReason = validateScenario({ name: 'empty', status: 'not-applicable', reason: '' })
  const implemented = validateScenario({ name: 'normal', status: 'implemented', reason: '' })
  const teardownClean = retirementIssues({ retired: true, retirement: { retiredAt: '2026-08-01', reconciliationEvidence: 'x' }, handlerExists: false, registrationText: '', handlerExport: 'userHandler' })
  const teardownDirty = retirementIssues({ retired: true, retirement: { retiredAt: '2026-08-01', reconciliationEvidence: 'x' }, handlerExists: true, registrationText: 'handlers = [userHandler]', handlerExport: 'userHandler' })
  const teardownNotRetired = retirementIssues({ retired: false, retirement: null, handlerExists: true, registrationText: 'userHandler', handlerExport: 'userHandler' })
  if (!valid || missingReason || !implemented || teardownClean.length !== 0 || teardownDirty.length !== 2 || teardownNotRetired.length !== 0) {
    console.error('verify-msw-manifest self-test FAILED')
    process.exit(1)
  }
  console.log('verify-msw-manifest self-test passed (3 scenario cases + 3 retirement cases).')
  process.exit(0)
}

if (process.argv.includes('--self-test')) runSelfTest()
if (!/^PR-\d{5}$/.test(projectId || '')) failUsage()

const projectDir = join(docsRoot, projectId)
const manifestFile = join(projectDir, 'agent/msw-manifest.json')
const assumptionsFile = join(projectDir, 'agent/assumptions.json')
const { data: manifest, error: manifestError } = readJson(manifestFile)
const checks = []

function add(ruleId, ok, message, file = manifestFile) {
  checks.push({ ruleId, ok, message, file, category: 'implementation' })
}

add('DOC-G3-IMPL-001', Boolean(manifest), manifest ? 'MSW manifest is valid JSON' : `MSW manifest is missing or invalid: ${manifestError || 'not found'}`)

if (manifest) {
  const sourceRoot = resolveSourceRoot(projectDir, manifest.sourceRoot)
  const active = ['mock-active', 'api-ready', 'reconciling'].includes(manifest.lifecycle)
  const retired = manifest.lifecycle === 'mock-retired'
  const assets = manifest.assets || {}
  const assetEntries = ['handler', 'fixture', 'contractTest', 'registration', 'workerHook', 'provider']
    .map((name) => [name, assets[name], assets[name] ? join(sourceRoot, assets[name]) : ''])
  const missingAssets = active ? assetEntries.filter(([, value, file]) => !value || !existsSync(file)).map(([name]) => name) : []
  add('DOC-G3-IMPL-002', !active || missingAssets.length === 0, active ? `active MSW assets exist${missingAssets.length ? `; missing: ${missingAssets.join(', ')}` : ''}` : `asset existence is not required in lifecycle=${manifest.lifecycle}`)

  if (active && missingAssets.length === 0) {
    const handlerText = read(join(sourceRoot, assets.handler))
    const registrationText = read(join(sourceRoot, assets.registration))
    const providerText = read(join(sourceRoot, assets.provider))
    const wired = Boolean(assets.handlerExport) && handlerText.includes(`export const ${assets.handlerExport}`) && registrationText.includes(assets.handlerExport) && providerText.includes('useMockWorker')
    add('DOC-G3-IMPL-003', wired, 'handler export is registered and provider mounts useMockWorker')
  } else {
    add('DOC-G3-IMPL-003', !active, active ? 'cannot verify registration until all active assets exist' : `registration is retired in lifecycle=${manifest.lifecycle}`)
  }

  const endpoints = Array.isArray(manifest.endpoints) ? manifest.endpoints : []
  const badScenarios = endpoints.flatMap((endpoint) => (endpoint.scenarios || []).filter((scenario) => !validateScenario(scenario)).map((scenario) => `${endpoint.id}:${scenario?.name || '?'}`))
  const endpointIds = endpoints.map((endpoint) => endpoint.id)
  const duplicateIds = endpointIds.filter((id, index) => endpointIds.indexOf(id) !== index)
  const retirementProblems = retirementIssues({
    retired,
    retirement: manifest.retirement,
    handlerExists: Boolean(assets.handler) && existsSync(join(sourceRoot, assets.handler)),
    registrationText: assets.registration ? read(join(sourceRoot, assets.registration)) : '',
    handlerExport: assets.handlerExport,
  })
  const retirementOk = retirementProblems.length === 0
  const endpointInventoryOk = manifest.lifecycle === 'planned' || endpoints.length > 0
  add('DOC-G3-IMPL-004', endpointInventoryOk && badScenarios.length === 0 && duplicateIds.length === 0 && retirementOk, `${manifest.lifecycle === 'planned' && endpoints.length === 0 ? 'endpoint inventory may remain empty before G3' : 'endpoint scenarios are structured and lifecycle-complete'}${badScenarios.length ? `; invalid: ${badScenarios.join(', ')}` : ''}${duplicateIds.length ? `; duplicate IDs: ${duplicateIds.join(', ')}` : ''}${!retirementOk ? `; retirement incomplete: ${retirementProblems.join(', ')}` : ''}`)

  const { data: assumptions, error: assumptionsError } = readJson(assumptionsFile)
  const ledgerOk = Boolean(assumptions) && assumptions.projectId === projectId && Array.isArray(assumptions.assumptions)
  add('DOC-G3-IMPL-005', ledgerOk, ledgerOk ? 'assumption ledger is readable' : `assumption ledger is missing or invalid: ${assumptionsError || 'shape mismatch'}`, assumptionsFile)
  if (ledgerOk) {
    const blockingStatuses = retired ? ['api-ready', 'reconciling', 'release'] : manifest.lifecycle === 'api-ready' || manifest.lifecycle === 'reconciling' ? ['api-ready', 'reconciling'] : []
    const unresolved = assumptions.assumptions.filter((item) => item.status === 'open' && blockingStatuses.includes(item.blockingWhen))
    add('DOC-G3-IMPL-006', unresolved.length === 0, `no blocking assumptions remain for lifecycle=${manifest.lifecycle}${unresolved.length ? `: ${unresolved.map((item) => item.id).join(', ')}` : ''}`, assumptionsFile)
  }
}

const result = { ok: checks.every((check) => check.ok), projectId, checks }
if (json) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`verify-msw-manifest: ${projectId} — ${result.ok ? 'PASS' : 'DIAGNOSTIC'} (${checks.filter((check) => check.ok).length}/${checks.length})`)
  for (const check of checks.filter((item) => !item.ok)) console.log(`WARN ${check.ruleId} ${check.file} - ${check.message}`)
}

process.exit(result.ok ? 0 : 1)
