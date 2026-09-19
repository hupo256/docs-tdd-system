#!/usr/bin/env node
// One delivery rollup for lifecycle, completion language, path ownership, and commit subjects.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { verifyExitResultIntegrity } from './vnext-exit.mjs'

const INFRASTRUCTURE_PATH = /^(?:\.github|\.gitlab|\.husky|scripts|tooling|common\/engine|apps\/web\/docs_tdd)(?:\/|$)/

function uniqueSorted(values) {
  return [...new Set((values || []).filter(Boolean))].sort()
}

function pathWithin(path, root) {
  const normalizedPath = String(path || '').replaceAll('\\', '/').replace(/^\.\/+/, '')
  const normalizedRoot = String(root || '').replaceAll('\\', '/').replace(/^\.\/+|\/+$/g, '')
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
}

export function classifyDeliveryPaths(workItem, paths = [], { legacyVerifiedPaths = [] } = {}) {
  const targetRoot = workItem?.deliveryTarget?.app || ''
  const policyPaths = workItem?.deliveryScope?.policyPaths || []
  const ownedRoots = uniqueSorted([targetRoot, ...policyPaths])
  const legacyOwnedPaths = ownedRoots.length ? [] : uniqueSorted(legacyVerifiedPaths)
  const classified = uniqueSorted(paths).map((path) => {
    const ownership = ownedRoots.some((root) => pathWithin(path, root))
      || legacyOwnedPaths.includes(path)
      ? 'delivery'
      : INFRASTRUCTURE_PATH.test(path)
        ? 'infrastructure'
        : 'unowned'
    return { path, ownership }
  })
  return {
    paths: classified,
    deliveryPaths: classified.filter((item) => item.ownership === 'delivery').map((item) => item.path),
    infrastructurePaths: classified.filter((item) => item.ownership === 'infrastructure').map((item) => item.path),
    unownedPaths: classified.filter((item) => item.ownership === 'unowned').map((item) => item.path),
  }
}

function manualAcceptanceRequired(workItem) {
  return workItem?.reviewControl?.requiresPretestHumanRun === true
    || (workItem?.requirements || []).some((requirement) => (requirement.evidencePlan || []).some((plan) => plan.type === 'human-check'))
}

function authoritativeVerification(workItem, latestResult, { integrityOk, codeStateFresh = true, assuranceTrusted } = {}) {
  if (!latestResult) return false
  const integrity = integrityOk === undefined ? verifyExitResultIntegrity(latestResult, workItem).ok : integrityOk
  const trusted = assuranceTrusted === undefined
    ? latestResult.mode === 'enforced'
      && latestResult.assuranceMode === 'autonomous'
      && latestResult.evidenceTrust === 'cli-attested'
    : assuranceTrusted
  return integrity
    && codeStateFresh
    && trusted
    && latestResult.status === 'passed'
    && latestResult.ok === true
}

function samePathSet(left, right) {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right))
}

export function deriveDeliveryTruth({
  workItem,
  latestResult = null,
  integrityOk,
  codeStateFresh = true,
  assuranceTrusted,
  reconciliationResult = null,
  gitScopeClean = false,
  changedPaths = [],
} = {}) {
  const implementationComplete = workItem?.autopilot?.implementation?.status === 'completed'
  const integrationPending = uniqueSorted([
    ...(reconciliationResult?.rollup?.integrationPending || []),
    ...(reconciliationResult?.rollup?.runtimeCriticalPending || []),
  ])
  const acceptanceRequired = manualAcceptanceRequired(workItem)
  const humanAccepted = !acceptanceRequired || workItem?.manualTestRun?.status === 'passed'
  const verified = authoritativeVerification(workItem, latestResult, {
    integrityOk,
    codeStateFresh,
    assuranceTrusted,
  })
  const verifiedPaths = latestResult?.codeFingerprint?.scopeMode === 'path-set-v1'
    ? latestResult.codeFingerprint.scopePaths || []
    : []
  const ownership = classifyDeliveryPaths(
    workItem,
    changedPaths.length ? changedPaths : verifiedPaths,
    { legacyVerifiedPaths: verifiedPaths },
  )
  const deliveryRecord = workItem?.autopilot?.delivery
  const recordMatches = deliveryRecord?.status === 'committed'
    && Boolean(deliveryRecord.commitSha?.trim())
    && samePathSet(deliveryRecord.paths, verifiedPaths)
  const delivered = verified && recordMatches && gitScopeClean && ownership.unownedPaths.length === 0

  let lifecycle = 'partially-implemented'
  if (implementationComplete && integrationPending.length) lifecycle = 'integration-pending'
  else if (implementationComplete && !humanAccepted) lifecycle = 'ready-for-human-acceptance'
  else if (verified && !delivered) lifecycle = 'delivery-ready'
  else if (delivered) lifecycle = 'delivered'

  const blockers = []
  if (!implementationComplete) blockers.push('implementation is not complete')
  if (integrationPending.length) blockers.push(`integration pending: ${integrationPending.join(', ')}`)
  if (!humanAccepted) blockers.push('required human acceptance has not passed')
  if (!verified) blockers.push('authoritative enforced verification is not current')
  if (ownership.unownedPaths.length) blockers.push(`unowned changed paths: ${ownership.unownedPaths.join(', ')}`)
  if (deliveryRecord?.status === 'committed' && !recordMatches) blockers.push('delivery record paths do not match the verified path set')
  if (recordMatches && !gitScopeClean) blockers.push('verified delivery paths are still dirty after the recorded commit')

  const projectId = workItem?.projectId || 'project'
  const commitSubjects = {
    checkpoint: `chore(${projectId}): checkpoint ${lifecycle}`,
    delivery: `feat(${projectId}): deliver verified scope`,
  }
  const statusText = delivered
    ? `Delivered ${projectId}: authoritative verification and the scoped local commit are consistent.`
    : lifecycle === 'delivery-ready'
      ? `${projectId} is delivery-ready; create the scoped local delivery commit.`
      : `${projectId} is ${lifecycle}; ${blockers[0] || 'continue the unique next action'}.`

  return {
    schemaVersion: 1,
    lifecycle,
    authoritativeVerification: verified,
    authoritativeCompletion: delivered,
    implementationComplete,
    integrationPending,
    acceptanceRequired,
    humanAccepted,
    deliveryRecordCommitted: deliveryRecord?.status === 'committed',
    deliveryRecordMatchesVerifiedPaths: recordMatches,
    gitScopeClean,
    ownership,
    blockers: uniqueSorted(blockers),
    statusText,
    commitSubjects,
  }
}

export function deliveryTruthProblems(input) {
  const truth = deriveDeliveryTruth(input)
  return { truth, problems: truth.blockers }
}

export function selfTest() {
  const workItem = {
    projectId: 'PR-00001',
    deliveryTarget: { app: 'apps/web', history: [] },
    requirements: [],
    autopilot: {
      implementation: { status: 'completed', changedPaths: ['apps/web/src/a.ts'] },
      delivery: { status: 'pending' },
    },
  }
  const latestResult = {
    mode: 'enforced',
    assuranceMode: 'autonomous',
    evidenceTrust: 'cli-attested',
    status: 'passed',
    ok: true,
    codeFingerprint: { scopeMode: 'path-set-v1', scopePaths: ['apps/web/src/a.ts'] },
  }
  const ready = deriveDeliveryTruth({ workItem, latestResult, integrityOk: true, assuranceTrusted: true })
  assert.equal(ready.lifecycle, 'delivery-ready')
  assert.equal(ready.authoritativeCompletion, false)
  const committed = structuredClone(workItem)
  committed.autopilot.delivery = { status: 'committed', commitSha: 'abc123', paths: ['apps/web/src/a.ts'] }
  const delivered = deriveDeliveryTruth({
    workItem: committed,
    latestResult,
    integrityOk: true,
    assuranceTrusted: true,
    gitScopeClean: true,
  })
  assert.equal(delivered.lifecycle, 'delivered')
  assert.equal(delivered.authoritativeCompletion, true)
  const missingSha = structuredClone(committed)
  delete missingSha.autopilot.delivery.commitSha
  assert.equal(deriveDeliveryTruth({
    workItem: missingSha,
    latestResult,
    integrityOk: true,
    assuranceTrusted: true,
    gitScopeClean: true,
  }).authoritativeCompletion, false)
  assert.deepEqual(classifyDeliveryPaths(workItem, ['apps/web/src/a.ts', 'scripts/check.mjs', 'other/a.ts']).unownedPaths, ['other/a.ts'])
  console.log('vnext-delivery-truth self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
