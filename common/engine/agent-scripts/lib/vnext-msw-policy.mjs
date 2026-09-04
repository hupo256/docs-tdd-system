#!/usr/bin/env node
// vNext MSW is dependency-driven, never a universal ceremony and never waiver-driven.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const API_DEPENDENCY_MODES = Object.freeze(['no-request', 'real-api', 'mock-required', 'pending-dependency'])
const apiEvidenceTypes = new Set(['payload-contract', 'api-contract'])
const apiRiskSignals = new Set(['new-api', 'contract-change'])

export function evaluateVNextMswPolicy({ workItem, implementation = {}, blockers = [] } = {}) {
  const api = workItem?.apiDependency
  const problems = []
  if (!api || !API_DEPENDENCY_MODES.includes(api.mode) || !api.reason?.trim()) {
    problems.push('apiDependency requires mode and reason')
    return { code: 'MSW_POLICY', ok: false, problems, mode: api?.mode || null, required: false, blocked: false }
  }
  const hasApiEvidence = (workItem.requirements || []).some((requirement) => (requirement.evidencePlan || []).some((plan) => apiEvidenceTypes.has(plan.type)))
  const hasApiRisk = (workItem.routing?.riskSignals || []).some((risk) => apiRiskSignals.has(risk))
  const msw = implementation.msw || { workerIntegrated: false, handlerIds: [], coveredContractIds: [] }
  const handlers = Array.isArray(msw.handlerIds) ? msw.handlerIds : []
  const coveredContracts = new Set(Array.isArray(msw.coveredContractIds) ? msw.coveredContractIds : [])

  if (api.mode === 'no-request') {
    if (hasApiEvidence || hasApiRisk) problems.push('no-request conflicts with API evidence plans or API risk signals')
    if (handlers.length) problems.push('no-request must not add MSW handlers')
  }
  if (api.mode === 'real-api' && handlers.length) problems.push('real-api mode must not add vNext-scoped MSW handlers')
  if (api.mode === 'mock-required') {
    if (!msw.workerIntegrated) problems.push('mock-required needs an integrated MSW worker')
    if (!handlers.length) problems.push('mock-required needs at least one handler')
    for (const contractId of api.contractIds || []) if (!coveredContracts.has(contractId)) problems.push(`MSW does not cover contract ${contractId}`)
  }
  if (api.mode === 'pending-dependency') {
    if (!api.blockerId?.trim()) problems.push('pending-dependency requires blockerId')
    const blocker = blockers.find((item) => item.blockerId === api.blockerId)
    if (!blocker || blocker.status !== 'open') problems.push(`pending dependency blocker is not open: ${api.blockerId || 'missing'}`)
    if (handlers.length) problems.push('pending-dependency does not silently create MSW; change mode to mock-required if a mock contract is approved')
  }
  return {
    code: 'MSW_POLICY',
    ok: problems.length === 0,
    problems,
    mode: api.mode,
    required: api.mode === 'mock-required',
    blocked: api.mode === 'pending-dependency',
  }
}

export function selfTest() {
  const workItem = (mode, extra = {}) => ({
    requirements: [{ evidencePlan: [] }], routing: { riskSignals: [] },
    apiDependency: { mode, reason: 'fixture', ...extra },
  })
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('no-request') }).ok, true)
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('real-api') }).ok, true)
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('real-api'), implementation: { msw: { handlerIds: ['h'] } } }).ok, false)
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('mock-required', { contractIds: ['C-1'] }), implementation: { msw: { workerIntegrated: true, handlerIds: ['h'], coveredContractIds: ['C-1'] } } }).ok, true)
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('mock-required', { contractIds: ['C-1'] }) }).ok, false)
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('pending-dependency', { blockerId: 'DEP-1' }), blockers: [{ blockerId: 'DEP-1', status: 'open' }] }).blocked, true)
  assert.equal(evaluateVNextMswPolicy({ workItem: workItem('pending-dependency', { blockerId: 'DEP-1' }), blockers: [] }).ok, false)
  assert.equal(evaluateVNextMswPolicy({ workItem: { ...workItem('no-request'), routing: { riskSignals: ['new-api'] } } }).ok, false)
  console.log('vnext-msw-policy self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
