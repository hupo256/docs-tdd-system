#!/usr/bin/env node
// Real-Git regression for structured surface reconciliation and its verify integration.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCoverageReview, buildCoverageReviewRequest, REVIEW_PROTOCOL } from './lib/vnext-coverage-review.mjs'
import { signEvidenceBundle } from './lib/vnext-evidence-receipt.mjs'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { normalizeSourceDocuments } from './lib/vnext-source-units.mjs'
import { assembleVerifyInput, runVNextVerification } from './vnext-verify.mjs'
import { reconcileProject } from './vnext-reconcile.mjs'

const TIMESTAMPS = Object.freeze({
  review: '2026-09-19T12:00:00.000Z',
  evidenceStart: '2026-09-19T12:00:01.000Z',
  evidenceEnd: '2026-09-19T12:00:02.000Z',
  verify: '2026-09-19T12:00:03.000Z',
})

function git(worktree, ...args) {
  const result = spawnSync('git', args, { cwd: worktree, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`)
}

function reviewedWorkItem({ sourcePath, surface }) {
  const sourceDocuments = [{ path: sourcePath, content: 'Render the widget.\n' }]
  const normalized = normalizeSourceDocuments(sourceDocuments, { revision: 'fixture-1' })
  const workItem = {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId: 'PR-00001',
    deliveryTarget: { app: 'apps/web', history: [] },
    sourceSnapshot: normalized.sourceSnapshot,
    requirements: [{
      requirementId: 'R-001',
      sourceAnchors: [{
        type: 'text',
        sourceId: normalized.sourceUnits[0].sourceId,
        path: sourcePath,
        lineStart: 1,
        lineEnd: 1,
      }],
      statement: 'Render the widget.',
      status: 'doing',
      collectionSemantics: { kind: 'none', expectedCount: 0 },
      affectedSurfaces: [surface],
      evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }],
    }],
    requirementsAuthor: { kind: 'human', id: 'fixture-author' },
    coverageAudit: {
      sourceFingerprint: 'pending',
      requirementsFingerprint: 'pending',
      reviewMode: 'independent-cold-read',
      reviewRunId: 'pending',
      reviewer: { kind: 'human', id: 'pending' },
      completedAt: TIMESTAMPS.review,
      verdict: 'changes-required',
      unresolved: ['pending'],
    },
    routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0', routerVersion: 1 },
    apiDependency: { mode: 'no-request', reason: 'fixture has no request' },
    scopeApproval: null,
  }
  const request = buildCoverageReviewRequest({ workItem, sourceUnits: normalized.sourceUnits })
  const reviewResponse = {
    schemaVersion: 1,
    protocol: REVIEW_PROTOCOL,
    projectId: workItem.projectId,
    sourceFingerprint: request.sourceFingerprint,
    requirementsFingerprint: request.requirementsFingerprint,
    reviewRunId: 'fixture-review',
    completedAt: TIMESTAMPS.review,
    reviewer: { kind: 'human', id: 'fixture-reviewer' },
    verdict: 'pass',
    findings: [],
  }
  return {
    workItem: applyCoverageReview(workItem, reviewResponse, { request }),
    reviewResponse,
  }
}

function commandFact(codeState, evidenceId, kind, { requirementIds = [], surfaceIds = [] } = {}) {
  return {
    evidenceId,
    kind,
    result: 'pass',
    codeFingerprint: codeState,
    requirementIds,
    surfaceIds,
    evidenceRefs: [`logs/${evidenceId}.txt`],
    producer: {
      kind: 'command',
      command: `fixture ${kind}`,
      exitCode: 0,
      startedAt: TIMESTAMPS.evidenceStart,
      finishedAt: TIMESTAMPS.evidenceEnd,
    },
  }
}

function signedEvidence(workItem, codeState, runId) {
  const facts = [
    commandFact(codeState, `${runId}-quality`, 'touched-file-quality'),
    commandFact(codeState, `${runId}-copy`, 'copy-literal', { requirementIds: ['R-001'], surfaceIds: ['S-001'] }),
  ]
  return signEvidenceBundle({
    runId,
    capturedAt: TIMESTAMPS.evidenceEnd,
    assuranceMode: 'autonomous',
    evidenceTrust: 'cli-attested',
    codeFingerprint: codeState,
    facts,
  }, {
    workItem,
    plan: { schemaVersion: 1, projectId: workItem.projectId, commands: [] },
    startedAt: TIMESTAMPS.evidenceStart,
    completedAt: TIMESTAMPS.evidenceEnd,
  })
}

function verificationResult({ projectDir, worktree, reviewResponse, evidence, workItem = null }) {
  const input = assembleVerifyInput({
    projectDir,
    worktreePath: worktree,
    evidence,
    surfacesReport: {
      discoveredSurfaces: [{ surfaceId: 'S-001', locator: 'apps/web/src/Widget.tsx' }],
      coveredSurfaceIds: ['S-001'],
    },
  })
  if (workItem) input.workItem = workItem
  input.reviewResponse = reviewResponse
  return {
    input,
    result: runVNextVerification(input, {
      currentCodeState: codeFingerprint(worktree, 'HEAD'),
      generatedAt: TIMESTAMPS.verify,
    }),
  }
}

export function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-reconcile-e2e-'))
  const worktree = join(root, 'worktree')
  const projectDir = join(root, 'project')
  const legacyProjectDir = join(root, 'legacy-project')
  const sourcePath = join(projectDir, 'inbox', 'prd.md')
  const evidenceKey = join(root, 'evidence.key')
  const previousEvidenceKey = process.env.DOCS_TDD_EVIDENCE_KEY_FILE
  try {
    process.env.DOCS_TDD_EVIDENCE_KEY_FILE = evidenceKey
    mkdirSync(join(worktree, 'apps/web/src'), { recursive: true })
    mkdirSync(join(worktree, 'apps/admin/src'), { recursive: true })
    mkdirSync(join(projectDir, 'inbox'), { recursive: true })
    mkdirSync(legacyProjectDir, { recursive: true })
    git(worktree, 'init', '-q')
    git(worktree, 'config', 'user.email', 'fixture@example.com')
    git(worktree, 'config', 'user.name', 'Fixture')
    writeFileSync(sourcePath, 'Render the widget.\n')
    writeFileSync(join(worktree, 'apps/web/src/Page.tsx'), 'export function Page() { return null }\n')
    writeFileSync(join(worktree, 'apps/admin/src/Widget.tsx'), 'export function Widget() { return null }\n')
    git(worktree, 'add', '.')
    git(worktree, 'commit', '-qm', 'fixture')

    const structured = reviewedWorkItem({
      sourcePath,
      surface: {
        surfaceId: 'S-001',
        disposition: 'implement',
        codeLocator: { kind: 'component', app: 'apps/web', symbol: 'Widget', role: 'standalone' },
      },
    })
    writeFileSync(join(projectDir, 'work-item.json'), `${JSON.stringify(structured.workItem, null, 2)}\n`)
    const wrongAppOnly = reconcileProject({ projectDir, worktree, baseRef: 'HEAD' })
    assert.equal(wrongAppOnly.surfaces[0].codeStatus, 'missing')
    assert.deepEqual(wrongAppOnly.surfaces[0].resolvedPaths, [])

    writeFileSync(join(worktree, 'apps/web/src/Widget.tsx'), 'export function Widget() { return null }\n')
    const reconciled = reconcileProject({ projectDir, worktree, baseRef: 'HEAD' })
    const persisted = JSON.parse(readFileSync(join(projectDir, 'reconcile-result.json'), 'utf8'))
    assert.equal(reconciled.rollup.overall, 'ready-for-human-acceptance')
    assert.deepEqual(persisted.surfaces[0].resolvedPaths, ['apps/web/src/Widget.tsx'])

    const currentCode = codeFingerprint(worktree, 'HEAD')
    const evidence = signedEvidence(structured.workItem, currentCode, 'structured-run')
    const verified = verificationResult({
      projectDir,
      worktree,
      reviewResponse: structured.reviewResponse,
      evidence,
    })
    assert.deepEqual(verified.input.reconciliation, persisted)
    assert.equal(verified.result.checks.find((check) => check.code === 'SURFACE_RECONCILIATION').ok, true)
    assert.equal(verified.result.ok, true, JSON.stringify(verified.result))

    const pivotedWorkItem = structuredClone(structured.workItem)
    pivotedWorkItem.deliveryTarget = {
      app: 'apps/admin',
      history: [{ app: 'apps/web', invalidatedAt: TIMESTAMPS.verify, reason: 'fixture pivot' }],
    }
    const pivoted = verificationResult({
      projectDir,
      worktree,
      reviewResponse: structured.reviewResponse,
      evidence,
      workItem: pivotedWorkItem,
    }).result
    const pivotCheck = pivoted.checks.find((check) => check.code === 'SURFACE_RECONCILIATION')
    assert.equal(pivotCheck.ok, false)
    assert.match(pivotCheck.problems.join(' '), /delivery target is stale/)

    writeFileSync(join(worktree, 'apps/web/src/Widget.tsx'), 'export function Widget() { return "changed" }\n')
    const changed = verificationResult({
      projectDir,
      worktree,
      reviewResponse: structured.reviewResponse,
      evidence,
    }).result
    const changedCheck = changed.checks.find((check) => check.code === 'SURFACE_RECONCILIATION')
    assert.equal(changedCheck.ok, false)
    assert.match(changedCheck.problems.join(' '), /effective code state/)

    const legacy = reviewedWorkItem({
      sourcePath,
      surface: { surfaceId: 'S-001', disposition: 'implement', locator: 'apps/web/src/Widget.tsx' },
    })
    writeFileSync(join(legacyProjectDir, 'work-item.json'), `${JSON.stringify(legacy.workItem, null, 2)}\n`)
    const legacyCode = codeFingerprint(worktree, 'HEAD')
    const legacyEvidence = signedEvidence(legacy.workItem, legacyCode, 'legacy-run')
    const legacyVerified = verificationResult({
      projectDir: legacyProjectDir,
      worktree,
      reviewResponse: legacy.reviewResponse,
      evidence: legacyEvidence,
    })
    assert.equal(legacyVerified.input.reconciliation, undefined)
    assert.equal(legacyVerified.result.checks.find((check) => check.code === 'SURFACE_RECONCILIATION').ok, true)
    assert.equal(legacyVerified.result.ok, true, JSON.stringify(legacyVerified.result))
    assert.equal(existsSync(join(legacyProjectDir, 'reconcile-result.json')), false)
    console.log('vnext-reconcile E2E self-test passed')
  } finally {
    if (previousEvidenceKey === undefined) delete process.env.DOCS_TDD_EVIDENCE_KEY_FILE
    else process.env.DOCS_TDD_EVIDENCE_KEY_FILE = previousEvidenceKey
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else {
    console.error('usage: vnext-reconcile-e2e.mjs --self-test')
    process.exitCode = 2
  }
}
