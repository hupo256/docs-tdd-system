#!/usr/bin/env node
// Pure Autopilot decisions derived from the machine-owned surface reconciliation result.

import assert from 'node:assert/strict'
import { requiresSurfaceReconciliation } from './vnext-reconcile.mjs'

export function deriveSurfaceReconciliationAction({ workItem, reconciliationResult = null, reconciliationCurrent = false } = {}) {
  if (!requiresSurfaceReconciliation(workItem)) return null
  const projectId = workItem.projectId
  if (!reconciliationCurrent) {
    return {
      action: 'reconcile-current-code',
      phase: 'implementing',
      reason: 'Structured implementation surfaces must be reconciled against the current delivery target and code state.',
      command: `docs-tdd reconcile ${projectId}`,
      constraints: ['derive-surface-status-from-code', 'invalidate-result-on-code-or-target-change'],
    }
  }
  if (['implementing', 'partially-implemented'].includes(reconciliationResult?.rollup?.overall)) {
    const unresolved = (reconciliationResult.surfaces || [])
      .filter((surface) => surface.codeStatus !== 'covered' || !['covered', 'n/a'].includes(surface.wiringStatus))
      .map((surface) => surface.surfaceId)
    return {
      action: 'implement-current-scope',
      phase: 'implementing',
      reason: `Machine reconciliation found unresolved implementation surfaces: ${unresolved.join(', ')}.`,
      constraints: ['implement-only-reviewed-scope', 'resolve-machine-reconciled-surface-gaps', 'checkpoint-real-changed-paths'],
      checkpoint: {
        command: `docs-tdd checkpoint ${projectId} --input <checkpoint.json>`,
        requiredFields: ['actionId', 'outcome', 'changedPaths'],
        optionalFields: ['msw', 'blockers'],
      },
    }
  }
  if (reconciliationResult?.rollup?.integrationPending?.length) {
    return {
      action: 'await-surface-dependencies',
      phase: 'implementation-ready',
      status: 'waiting',
      reason: `Frontend implementation is complete; integration waits for surfaces: ${reconciliationResult.rollup.integrationPending.join(', ')}.`,
      constraints: ['do-not-mark-frontend-surfaces-missing', 'do-not-claim-delivery-ready', 'resume-when-dependency-is-ready'],
    }
  }
  return null
}

function selfTest() {
  const legacy = { workflowVersion: 2, projectId: 'PR-00001', requirements: [] }
  assert.equal(deriveSurfaceReconciliationAction({ workItem: legacy }), null)
  const structured = {
    ...legacy,
    deliveryTarget: { app: 'apps/web', history: [] },
    requirements: [{ requirementId: 'R-001', status: 'doing', affectedSurfaces: [{ surfaceId: 'S-001', disposition: 'implement', codeLocator: { app: 'apps/web' } }] }],
  }
  assert.equal(deriveSurfaceReconciliationAction({ workItem: structured }).action, 'reconcile-current-code')
  const partial = { rollup: { overall: 'partially-implemented', integrationPending: [] }, surfaces: [{ surfaceId: 'S-001', codeStatus: 'missing', wiringStatus: 'n/a' }] }
  assert.equal(deriveSurfaceReconciliationAction({ workItem: structured, reconciliationResult: partial, reconciliationCurrent: true }).action, 'implement-current-scope')
  const pending = { rollup: { overall: 'integration-pending', integrationPending: ['S-001'] }, surfaces: [] }
  assert.equal(deriveSurfaceReconciliationAction({ workItem: structured, reconciliationResult: pending, reconciliationCurrent: true }).action, 'await-surface-dependencies')
  console.log('vnext-reconcile-actions self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
