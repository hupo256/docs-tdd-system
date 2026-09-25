#!/usr/bin/env node
// Fingerprint-bound V2 scope approval protocol. Preparation is read-only; apply persists only a
// human-authored approval that matches the current reviewed work item.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { persistVNextWorkItem } from './lib/vnext-persistence.mjs'
import { createScopeApproval, scopeApprovalFingerprint, verifyVNextRouting } from './lib/vnext-risk-route.mjs'
import { coverageFingerprints, effectiveCoverageReview } from './lib/vnext-work-item.mjs'

function requirementCounts(workItem) {
  return Object.fromEntries(['doing', 'deferred', 'not-doing'].map((status) => [
    status,
    (workItem.requirements || []).filter((requirement) => requirement.status === status).length,
  ]))
}

export function prepareScopeApproval(workItem) {
  const routing = verifyVNextRouting({ ...workItem, scopeApproval: null })
  if (!routing.checks.find((check) => check.code === 'RISK_ROUTE')?.ok || routing.routing.verificationLevel !== 'V2') {
    throw new Error('scope approval can only be prepared for a valid V2 route')
  }
  const review = effectiveCoverageReview(workItem)
  const provisional = workItem.reviewControl?.status === 'human-review-deferred'
    && workItem.reviewControl?.requiresPretestHumanRun === true
  if (!review.ok && !provisional) throw new Error(`scope approval requires passed or explicitly deferred coverage review: ${review.problems.join('; ')}`)
  const fingerprints = coverageFingerprints(workItem)
  return {
    schemaVersion: 1,
    projectId: workItem.projectId,
    approvalFingerprint: scopeApprovalFingerprint(workItem, routing.routing),
    sourceFingerprint: fingerprints.sourceFingerprint,
    requirementsFingerprint: fingerprints.requirementsFingerprint,
    reviewStatus: provisional ? 'provisional-human-review-deferred' : 'passed',
    routing: routing.routing,
    requirementCounts: requirementCounts(workItem),
    highRiskSurfaces: (workItem.requirements || []).flatMap((requirement) => (requirement.affectedSurfaces || [])
      .filter((surface) => surface.disposition === 'implement')
      .map((surface) => ({ requirementId: requirement.requirementId, surfaceId: surface.surfaceId, locator: surface.locator }))),
    sourceReadiness: workItem.sourceReadiness || null,
    apiDependency: workItem.apiDependency,
    confirmation: {
      confirmedBy: '',
      confirmedAt: '',
      reason: '',
      statement: provisional
        ? 'I reviewed this exact provisional source, requirement boundary, risk route, and dependency policy and approve implementation before the mandatory pre-test human closure.'
        : 'I reviewed this exact source, requirement boundary, risk route, and dependency policy and approve implementation of the doing scope.',
    },
  }
}

export function applyScopeApproval(workItem, input, { client = 'cursor', sessionId = '' } = {}) {
  const request = prepareScopeApproval(workItem)
  if (input?.schemaVersion !== 1 || input?.projectId !== workItem.projectId) throw new Error('scope approval schemaVersion/projectId does not match work item')
  if (input.approvalFingerprint !== request.approvalFingerprint) throw new Error('scope approval fingerprint is stale; regenerate the approval request')
  const confirmation = input.confirmation || input
  const scopeApproval = createScopeApproval(workItem, {
    confirmedBy: confirmation.confirmedBy,
    confirmedAt: confirmation.confirmedAt,
    reason: confirmation.reason,
    recordedVia: { client, ...(sessionId ? { sessionId } : {}) },
  })
  return { ...workItem, scopeApproval }
}

export function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-scope-approval-'))
  try {
    const workItem = {
      schemaVersion: 1, workflowVersion: 2, projectId: 'PR-00001',
      sourceSnapshot: { revision: '1', contentHash: 'source', sources: [{ path: 'prd.md', contentHash: 'source' }] },
      requirementsAuthor: { kind: 'human', id: 'fixture' },
      requirements: [{ requirementId: 'R-001', sourceAnchors: [{ type: 'text', sourceId: 'SRC-1' }], statement: 'Fixture requirement.', status: 'doing', affectedSurfaces: [{ surfaceId: 'S-001', locator: 'src/a.ts', disposition: 'implement' }], evidencePlan: [{ type: 'pure-logic', runtimeRequired: false }] }],
      coverageAudit: { sourceFingerprint: '', requirementsFingerprint: '', reviewMode: 'independent-cold-read', reviewRunId: 'review-1', reviewer: { kind: 'human', id: 'reviewer' }, completedAt: '2026-09-12T00:00:00Z', verdict: 'pass', unresolved: [] },
      routing: { scopeClass: 'cross-boundary', riskSignals: [], verificationLevel: 'V2', routerVersion: 1 },
      apiDependency: { mode: 'no-request', reason: 'fixture' }, scopeApproval: null,
    }
    Object.assign(workItem.coverageAudit, coverageFingerprints(workItem))
    const request = prepareScopeApproval(workItem)
    const approved = applyScopeApproval(workItem, {
      ...request,
      confirmation: { confirmedBy: 'owner@example.com', confirmedAt: '2026-09-12', reason: 'scope reviewed' },
    }, { client: 'pi', sessionId: 'session-1' })
    assert.equal(verifyVNextRouting(approved).ok, true)
    assert.equal(approved.scopeApproval.reason, 'scope reviewed')
    assert.equal(approved.scopeApproval.recordedVia.sessionId, 'session-1')
    const deferred = structuredClone(workItem)
    deferred.coverageAudit.verdict = 'changes-required'
    deferred.coverageAudit.findings = [{ findingId: 'F-1' }]
    deferred.coverageAudit.unresolved = ['F-1: missing']
    deferred.reviewControl = { sourceFingerprint: deferred.coverageAudit.sourceFingerprint, attempts: 2, status: 'human-review-deferred', requiresPretestHumanRun: true }
    assert.equal(prepareScopeApproval(deferred).reviewStatus, 'provisional-human-review-deferred')
    assert.throws(() => applyScopeApproval({ ...workItem, requirements: [...workItem.requirements, { requirementId: 'R-002' }] }, { ...request, confirmation: { confirmedBy: 'owner', confirmedAt: '2026-09-12', reason: 'ok' } }), /stale/)
    persistVNextWorkItem(root, approved)
    assert.equal(existsSync(join(root, 'work-item.json')), true)
    console.log('vnext-scope-approval self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? '' : process.argv[index + 1] || ''
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else {
    try {
      const projectDir = resolve(argumentValue('--project'))
      const workItemFile = join(projectDir, 'work-item.json')
      const workItem = JSON.parse(readFileSync(workItemFile, 'utf8'))
      const inputFile = argumentValue('--input')
      if (!inputFile) {
        const request = prepareScopeApproval(workItem)
        const output = argumentValue('--out')
        if (output) writeFileSync(resolve(output), `${JSON.stringify(request, null, 2)}\n`)
        else console.log(JSON.stringify(request, null, 2))
      } else {
        const input = JSON.parse(readFileSync(resolve(inputFile), 'utf8'))
        const next = applyScopeApproval(workItem, input, { client: argumentValue('--client') || 'cursor', sessionId: argumentValue('--session-id') })
        const persisted = persistVNextWorkItem(projectDir, next)
        console.log(JSON.stringify({ projectId: next.projectId, scopeApproval: next.scopeApproval, persisted }, null, 2))
      }
    } catch (error) {
      console.error(`vNext scope approval failed: ${error.message}`)
      process.exitCode = 2
    }
  }
}
