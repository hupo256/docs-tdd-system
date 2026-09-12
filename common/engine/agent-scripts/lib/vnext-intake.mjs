#!/usr/bin/env node
// vNext intake identity and source binding. A bugfix is a distinct intake kind, not a shortcut
// around extraction, risk routing, review, or verification.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableFingerprint } from './vnext-work-item.mjs'

export const VNEXT_INTAKE_KINDS = Object.freeze(['feature', 'bugfix'])

export function vNextBranchName(projectId, kind = 'feature', featurePrefix = 'feature/') {
  if (!/^PR-\d{5}$/.test(projectId || '')) throw new Error('vNext branch requires a PR-xxxxx projectId')
  if (!VNEXT_INTAKE_KINDS.includes(kind)) throw new Error(`unsupported vNext intake kind: ${kind || 'missing'}`)
  return `${kind === 'bugfix' ? 'fix/' : featurePrefix}${projectId}`
}

export function bindVNextIntake(kind, sourceSnapshot) {
  if (!VNEXT_INTAKE_KINDS.includes(kind)) throw new Error(`unsupported vNext intake kind: ${kind || 'missing'}`)
  if (!sourceSnapshot?.sources?.length) throw new Error('vNext intake requires at least one normalized source')
  return {
    kind,
    sourceRole: kind === 'bugfix' ? 'incident' : 'prd',
    sourceFingerprint: stableFingerprint(sourceSnapshot),
    sourcePaths: sourceSnapshot.sources.map((source) => source.path).sort(),
  }
}

export function vNextIntakeProblems(workItem) {
  const intake = workItem?.intake
  // Work items created before intake kinds were introduced remain compatible.
  if (!intake) return []
  const problems = []
  if (!VNEXT_INTAKE_KINDS.includes(intake.kind)) problems.push(`unsupported intake kind: ${intake.kind || 'missing'}`)
  const expectedRole = intake.kind === 'bugfix' ? 'incident' : 'prd'
  if (intake.sourceRole !== expectedRole) problems.push(`${intake.kind || 'unknown'} intake requires sourceRole=${expectedRole}`)
  const expectedFingerprint = stableFingerprint(workItem?.sourceSnapshot || null)
  if (intake.sourceFingerprint !== expectedFingerprint) problems.push('intake source fingerprint is stale')
  const expectedPaths = (workItem?.sourceSnapshot?.sources || []).map((source) => source.path).sort()
  if (JSON.stringify(intake.sourcePaths || []) !== JSON.stringify(expectedPaths)) problems.push('intake source paths do not match sourceSnapshot')
  return problems
}

export function selfTest() {
  const sourceSnapshot = {
    revision: '1',
    contentHash: 'source',
    sources: [{ path: 'inbox/incident.md', contentHash: 'source' }],
  }
  const bugfix = bindVNextIntake('bugfix', sourceSnapshot)
  assert.equal(bugfix.sourceRole, 'incident')
  assert.equal(vNextBranchName('PR-00001', 'bugfix'), 'fix/PR-00001')
  assert.equal(vNextBranchName('PR-00001', 'feature', 'feature/'), 'feature/PR-00001')
  assert.deepEqual(vNextIntakeProblems({ sourceSnapshot, intake: bugfix }), [])
  assert.match(vNextIntakeProblems({ sourceSnapshot: { ...sourceSnapshot, revision: '2' }, intake: bugfix }).join(' '), /stale/)
  assert.match(vNextIntakeProblems({ sourceSnapshot, intake: { ...bugfix, sourceRole: 'prd' } }).join(' '), /sourceRole=incident/)
  assert.throws(() => bindVNextIntake('hotfix', sourceSnapshot), /unsupported/)
  console.log('vnext-intake self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
