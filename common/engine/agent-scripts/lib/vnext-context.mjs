#!/usr/bin/env node
// Compact, deterministic vNext context. No rule corpus is copied into the prompt.

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXIT_EVIDENCE_REQUIREMENTS, verifyExitResultIntegrity } from './vnext-exit.mjs'
import { stableFingerprint } from './vnext-work-item.mjs'

export const VNEXT_CONTEXT_BUDGETS = Object.freeze({ V0: 4000, V1: 4000, V2: 8000 })

function oneLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim()
}

function short(value) {
  return String(value || '').slice(0, 12)
}

function resultState(result) {
  if (!result) return null
  return {
    mode: result.mode,
    status: result.status,
    ok: result.ok,
    codeFingerprint: result.codeFingerprint,
    failedChecks: result.checks.filter((check) => !check.ok).map((check) => ({ code: check.code, problems: check.problems })),
    blockedBy: result.blockedBy,
  }
}

function renderResult(result) {
  if (!result) return ['Latest: none; run the final verifier before claiming completion.']
  const authority = result.mode === 'enforced' ? 'authoritative' : 'NON-AUTHORITATIVE historical shadow'
  const lines = [`Latest: ${result.status}; mode=${result.mode}; ${authority}; run=${result.runId}; HEAD=${short(result.codeFingerprint?.headSha)}; dirty=${short(result.codeFingerprint?.dirtyHash)}`]
  for (const item of result.checks.filter((check) => !check.ok)) {
    const problems = item.problems.map(oneLine)
    const detail = problems.length <= 3 ? problems.join('; ') : `${problems.length} problems; full list: latest-result.json`
    lines.push(`- ${item.code}: ${detail}`)
  }
  return lines
}

function renderFull(workItem, result) {
  const level = workItem.routing.verificationLevel
  const lines = [
    `# ${workItem.projectId} v2 ${level}`,
    `Source: revision=${oneLine(workItem.sourceSnapshot.revision)} fingerprint=${short(workItem.coverageAudit.sourceFingerprint)}`,
    `Route: scope=${workItem.routing.scopeClass}; risks=${workItem.routing.riskSignals.join(',') || 'none'}; evidence=${EXIT_EVIDENCE_REQUIREMENTS[level].join(',')}`,
    `API/MSW: ${workItem.apiDependency?.mode || 'UNDECLARED'} — ${oneLine(workItem.apiDependency?.reason || 'must be classified')}`,
  ]
  if (level === 'V2') {
    const approval = workItem.scopeApproval
    lines.push(approval ? `Scope approval: ${oneLine(approval.confirmedBy)} @ ${oneLine(approval.confirmedAt)} (${short(approval.fingerprint)})` : 'Scope approval: MISSING (must be human and fingerprint-matched)')
  }
  if (workItem.deliveryScope) {
    lines.push(`Delivery batch: ${oneLine(workItem.deliveryScope.batchId)}; remainder=${oneLine(workItem.deliveryScope.deferred.batch)}; owner=${oneLine(workItem.deliveryScope.deferred.owner)}`)
  }
  lines.push('', 'Requirements:')
  for (const requirement of workItem.requirements) {
    const sources = requirement.sourceAnchors.map((anchor) => anchor.sourceId).join(',')
    const surfaces = requirement.affectedSurfaces.map((surface) => `${surface.surfaceId}:${oneLine(surface.locator)}:${surface.disposition}${surface.reason ? `(${oneLine(surface.reason)})` : ''}`).join(',') || '-'
    const evidence = requirement.evidencePlan.map((item) => `${item.type}${item.runtimeRequired ? '*' : ''}`).join(',')
    lines.push(`- ${requirement.requirementId}[${requirement.status}] ${oneLine(requirement.statement)} | src=${sources} | surfaces=${surfaces} | proof=${evidence}`)
  }
  const findings = workItem.coverageAudit.findings || []
  lines.push('', `Coverage review: ${workItem.coverageAudit.verdict}; ${workItem.coverageAudit.reviewer.kind}:${oneLine(workItem.coverageAudit.reviewer.id)}; findings=${findings.length}`)
  for (const finding of findings) lines.push(`- ${finding.findingId}[${finding.disposition}] ${oneLine(finding.message)}${finding.reason ? `; ${oneLine(finding.reason)}` : ''}`)
  lines.push('', ...renderResult(result), '', `Exit: docs-tdd verify ${workItem.projectId} --input <verify-input.json> --worktree <path>`)
  return `${lines.join('\n')}\n`
}

function renderDelta(workItem, result, unchanged) {
  const lines = [
    `# ${workItem.projectId} v2 ${workItem.routing.verificationLevel} / ${unchanged ? 'unchanged' : 'delta'}`,
    `Work item unchanged: ${short(stableFingerprint(workItem))}`,
  ]
  if (unchanged) lines.push('No source, requirement, route, code-state, blocker, or verdict change since the supplied session.')
  else lines.push(...renderResult(result))
  lines.push('Continue using work-item.json as the business source of truth; do not reload v1 rule packs.')
  return `${lines.join('\n')}\n`
}

export function buildVNextContext({ workItem, latestResult = null, previousSession = null, generatedAt = new Date().toISOString() } = {}) {
  if (workItem?.workflowVersion !== 2 || !workItem?.projectId) throw new Error('vNext context requires a workflowVersion=2 work item')
  const level = workItem.routing?.verificationLevel
  const budget = VNEXT_CONTEXT_BUDGETS[level]
  if (!budget) throw new Error(`unknown vNext level: ${level || 'missing'}`)
  if (latestResult) {
    const integrity = verifyExitResultIntegrity(latestResult, workItem)
    if (!integrity.ok) throw new Error(`latest result is invalid or stale: ${integrity.problems.join('; ')}`)
  }
  const workItemFingerprint = stableFingerprint(workItem)
  const resultStateFingerprint = stableFingerprint(resultState(latestResult))
  const contextFingerprint = stableFingerprint({ workItemFingerprint, resultStateFingerprint })
  const sameWorkItem = previousSession?.projectId === workItem.projectId && previousSession?.workItemFingerprint === workItemFingerprint
  const unchanged = sameWorkItem && previousSession?.contextFingerprint === contextFingerprint
  const mode = sameWorkItem ? (unchanged ? 'unchanged' : 'delta') : 'full'
  const text = mode === 'full' ? renderFull(workItem, latestResult) : renderDelta(workItem, latestResult, unchanged)
  const chars = Array.from(text).length
  if (chars > budget) throw new Error(`${level} context is ${chars} characters, above ${budget}; split the work item instead of silently truncating requirements`)
  return {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId: workItem.projectId,
    level,
    mode,
    chars,
    budget,
    text,
    session: { schemaVersion: 1, projectId: workItem.projectId, level, workItemFingerprint, resultStateFingerprint, contextFingerprint, generatedAt },
  }
}

export function selfTest() {
  const workItem = {
    workflowVersion: 2, projectId: 'PR-00001',
    sourceSnapshot: { revision: '7' },
    coverageAudit: { sourceFingerprint: 'source-fingerprint', reviewer: { kind: 'model', id: 'cold-reader' }, verdict: 'pass', findings: [] },
    routing: { scopeClass: 'multi-surface', riskSignals: ['password'], verificationLevel: 'V1' },
    apiDependency: { mode: 'no-request', reason: 'copy-only change' },
    requirements: [{
      requirementId: 'R-001', status: 'doing', statement: 'Both password entries show the same warning.',
      sourceAnchors: [{ sourceId: 'SRC-1' }],
      affectedSurfaces: [{ surfaceId: 'S-001', locator: 'change-password', disposition: 'implement' }, { surfaceId: 'S-002', locator: 'reset-password', disposition: 'implement' }],
      evidencePlan: [{ type: 'component-dom', runtimeRequired: false }],
    }],
  }
  const full = buildVNextContext({ workItem, generatedAt: '2026-09-04T00:00:00Z' })
  assert.equal(full.mode, 'full')
  assert.ok(full.chars < 4000 && full.text.includes('S-002'))
  const unchanged = buildVNextContext({ workItem, previousSession: full.session, generatedAt: '2026-09-04T00:01:00Z' })
  assert.equal(unchanged.mode, 'unchanged')
  assert.ok(unchanged.chars < full.chars)
  const changed = structuredClone(workItem)
  changed.requirements[0].statement = 'Changed requirement'
  assert.equal(buildVNextContext({ workItem: changed, previousSession: full.session }).mode, 'full')
  const tooLarge = structuredClone(workItem)
  tooLarge.requirements = Array.from({ length: 100 }, (_, index) => ({ ...workItem.requirements[0], requirementId: `R-${String(index).padStart(3, '0')}`, statement: 'x'.repeat(100) }))
  assert.throws(() => buildVNextContext({ workItem: tooLarge }), /silently truncating/)
  console.log('vnext-context self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
