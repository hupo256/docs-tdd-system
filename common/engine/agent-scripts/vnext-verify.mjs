#!/usr/bin/env node
// Formal vNext verifier. It reads one explicit JSON input and emits the authoritative v2 delivery result without mutating v1 state.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { docsSystemRoot } from './lib/roots.mjs'
import { attachReviewIteration, buildCoverageReviewRequest, applyCoverageReview, coverageReviewResponseFromAudit, REVIEW_PROTOCOL } from './lib/vnext-coverage-review.mjs'
import { buildVNextExitResult, verifyExitResultIntegrity } from './lib/vnext-exit.mjs'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { initializeVNextArtifacts, persistVNextRun, VNEXT_ARTIFACT_FILES } from './lib/vnext-persistence.mjs'
import { evaluateVNextMswPolicy } from './lib/vnext-msw-policy.mjs'
import { manualTestProblems } from './lib/vnext-manual-test.mjs'
import { normalizeSourceDocuments, readLocalSourceAsset } from './lib/vnext-source-units.mjs'
import { verifyVNextRouting } from './lib/vnext-risk-route.mjs'
import { signEvidenceBundle } from './lib/vnext-evidence-receipt.mjs'
import { verifyReviewReceipt } from './lib/vnext-review-receipt.mjs'
import { coverageFingerprints, effectiveCoverageReview, evaluateMicroEligibility, verifyVNextCoverage } from './lib/vnext-work-item.mjs'
import { evaluateSourceReadiness } from './lib/vnext-source-readiness.mjs'
import { reconcileResultProblems } from './lib/vnext-reconcile.mjs'

function normalizeCurrentSources(workItem, sourceDocuments, revision) {
  if (!revision?.trim()) throw new Error('currentRevision is required')
  return normalizeSourceDocuments(sourceDocuments, {
    revision,
    readAsset: (asset) => readLocalSourceAsset(asset, { root: docsSystemRoot }),
  })
}

export function scaffoldVerifyInput({ projectDir, worktreePath, baseRef = 'origin/online' }) {
  if (!projectDir) throw new Error('--project is required for scaffold-input')
  if (!worktreePath) throw new Error('--worktree is required for scaffold-input')
  const workItemPath = resolve(projectDir, 'work-item.json')
  const workItem = JSON.parse(readFileSync(workItemPath, 'utf8'))
  const sourceDocuments = (workItem.sourceSnapshot?.sources || []).map((source) => {
    const fullPath = isAbsolute(source.path) ? source.path : join(docsSystemRoot, source.path)
    return { path: source.path, content: readFileSync(fullPath, 'utf8') }
  })
  const code = codeFingerprint(resolve(worktreePath), baseRef)
  return {
    workItem,
    currentRevision: workItem.sourceSnapshot?.revision || 'TODO: current revision',
    sourceDocuments,
    discoveredSurfaces: [],
    implementation: { coveredSurfaceIds: [] },
    evidence: {
      runId: 'TODO: run id',
      capturedAt: 'TODO: ISO 8601 timestamp',
      codeFingerprint: code,
      facts: [],
    },
    blockers: [],
  }
}

// Assemble a full verification input from the reviewed work item, the measured worktree, and the
// signed evidence bundle. Only the two fields that MUST come from real implementation work are
// caller-supplied: discoveredSurfaces (what code search actually found) and coveredSurfaceIds
// (what was actually implemented). Deriving those from the plan would silently disable the
// surface-drift and missing-implementation checks, so they stay agent-reported.
export function assembleVerifyInput({ projectDir, worktreePath, evidence, surfacesReport = {} }) {
  if (!projectDir) throw new Error('--project is required to assemble verification input')
  if (!worktreePath) throw new Error('--worktree is required to assemble verification input')
  if (!evidence || typeof evidence !== 'object') throw new Error('--evidence <evidence.json> is required to assemble verification input')
  const workItem = JSON.parse(readFileSync(resolve(projectDir, 'work-item.json'), 'utf8'))
  const sourceDocuments = (workItem.sourceSnapshot?.sources || []).map((source) => {
    const fullPath = isAbsolute(source.path) ? source.path : join(docsSystemRoot, source.path)
    return { path: source.path, content: readFileSync(fullPath, 'utf8') }
  })
  const { discoveredSurfaces = [], coveredSurfaceIds = [], msw, blockers = [] } = surfacesReport
  const reconciliationFile = join(projectDir, 'reconcile-result.json')
  const reconciliation = existsSync(reconciliationFile) ? JSON.parse(readFileSync(reconciliationFile, 'utf8')) : null
  return {
    workItem,
    currentRevision: workItem.sourceSnapshot?.revision,
    sourceDocuments,
    discoveredSurfaces,
    implementation: { coveredSurfaceIds, ...(msw ? { msw } : {}) },
    evidence,
    blockers,
    ...(reconciliation ? { reconciliation } : {}),
  }
}

export function normalizeSourceInput(input) {
  if (!Array.isArray(input?.sourceDocuments)) throw new Error('normalize-sources input requires sourceDocuments')
  if (!input.currentRevision?.trim()) throw new Error('normalize-sources input requires currentRevision')
  return normalizeSourceDocuments(input.sourceDocuments, {
    revision: input.currentRevision,
    readAsset: (asset) => readLocalSourceAsset(asset, { root: docsSystemRoot }),
  })
}

export function prepareReview(input) {
  if (!input?.workItem || !Array.isArray(input.sourceDocuments)) throw new Error('prepare-review input requires workItem and sourceDocuments')
  const normalized = normalizeCurrentSources(input.workItem, input.sourceDocuments, input.currentRevision)
  const expected = coverageFingerprints(input.workItem).sourceFingerprint
  const actual = coverageFingerprints({ sourceSnapshot: normalized.sourceSnapshot }).sourceFingerprint
  if (actual !== expected) throw new Error('current source documents differ from workItem.sourceSnapshot; refresh the work item before review')
  return attachReviewIteration(
    buildCoverageReviewRequest({ workItem: input.workItem, sourceUnits: normalized.sourceUnits }),
    input.workItem.reviewControl,
  )
}

function reviewedWorkItemForVerification(workItem, reviewResponse, reviewRequest) {
  if (!workItem.reviewAdjudication?.repairConfirmation) {
    return applyCoverageReview(workItem, reviewResponse, { request: reviewRequest })
  }
  const receiptProblems = verifyReviewReceipt(reviewResponse, {
    requestFingerprint: reviewResponse.receipt?.requestFingerprint,
    sourceAssets: reviewResponse.receipt?.reviewedAssets || [],
  })
  if (receiptProblems.length) throw new Error(`invalid original coverage review receipt: ${receiptProblems.join('; ')}`)
  return workItem
}

function resolveReviewedWorkItem(workItem, sourceUnits, reviewResponse) {
  const effectiveReview = effectiveCoverageReview(workItem, { sourceUnits })
  if (effectiveReview.ok && effectiveReview.mode === 'deterministic-micro-audit') return workItem
  if (!reviewResponse) throw new Error('verification requires a signed independent review; run docs-tdd review first')
  const reviewRequest = attachReviewIteration(
    buildCoverageReviewRequest({ workItem, sourceUnits }),
    workItem.reviewControl,
    { reviewRunId: reviewResponse.reviewRunId },
  )
  return reviewedWorkItemForVerification(workItem, reviewResponse, reviewRequest)
}

export function runVNextVerification(input, { currentCodeState, generatedAt, mode = 'enforced' } = {}) {
  if (!input?.workItem) throw new Error('verification input requires workItem')
  if (Object.hasOwn(input, 'sourceOracle')) throw new Error('sourceOracle is reviewer-owned and cannot be supplied by verification input')
  if (!Array.isArray(input.sourceDocuments)) throw new Error('verification input requires sourceDocuments')
  if (!Array.isArray(input.discoveredSurfaces)) throw new Error('verification input requires discoveredSurfaces (use [] when the search found none)')
  if (!input.implementation || !Array.isArray(input.implementation.coveredSurfaceIds)) throw new Error('verification input requires implementation.coveredSurfaceIds')
  if (!input.evidence || !Array.isArray(input.evidence.facts)) throw new Error('verification input requires evidence.facts')
  if (!Array.isArray(input.blockers)) throw new Error('verification input requires blockers (use [] when none are open)')
  if (!currentCodeState) throw new Error('verification requires a code fingerprint measured by the CLI')

  const normalized = normalizeCurrentSources(input.workItem, input.sourceDocuments, input.currentRevision)
  const reviewResponse = input.reviewResponse || coverageReviewResponseFromAudit(input.workItem)
  const reviewedWorkItem = resolveReviewedWorkItem(input.workItem, normalized.sourceUnits, reviewResponse)
  const coverage = verifyVNextCoverage({
    workItem: reviewedWorkItem,
    currentSourceSnapshot: normalized.sourceSnapshot,
    sourceUnits: normalized.sourceUnits,
    discoveredSurfaces: input.discoveredSurfaces,
    implementation: input.implementation,
    reconciliation: input.reconciliation,
  })
  const reconciliationProblems = reconcileResultProblems({
    workItem: reviewedWorkItem,
    result: input.reconciliation,
    currentCodeState,
    requireDeliveryReady: true,
  })
  const reconciliationCheck = {
    code: 'SURFACE_RECONCILIATION',
    ok: reconciliationProblems.length === 0,
    problems: reconciliationProblems,
    evidenceIds: [],
  }
  const routing = verifyVNextRouting(reviewedWorkItem)
  const mswPolicy = evaluateVNextMswPolicy({ workItem: reviewedWorkItem, implementation: input.implementation, blockers: input.blockers })
  const sourceReadiness = evaluateSourceReadiness(reviewedWorkItem)
  const manualProblems = manualTestProblems(reviewedWorkItem, currentCodeState)
  const manualTestCheck = {
    code: 'MANUAL_PRETEST_RUN',
    ok: manualProblems.length === 0,
    problems: manualProblems,
    evidenceIds: reviewedWorkItem.manualTestRun?.runId ? [reviewedWorkItem.manualTestRun.runId] : [],
  }
  return buildVNextExitResult({
    workItem: reviewedWorkItem,
    preflightChecks: [...coverage.checks, reconciliationCheck, ...routing.checks, mswPolicy, sourceReadiness, manualTestCheck],
    currentCodeState,
    evidence: input.evidence,
    blockers: input.blockers,
    mode,
    generatedAt,
  })
}

export function assertSafeArtifactOutput(worktreePath, outDir) {
  const worktree = resolve(worktreePath)
  const output = resolve(outDir)
  const rel = relative(worktree, output)
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))) {
    const unsafe = VNEXT_ARTIFACT_FILES.filter((name) => spawnSync('git', ['check-ignore', '-q', '--', relative(worktree, resolve(output, name))], { cwd: worktree }).status !== 0)
    if (unsafe.length) throw new Error(`--out is inside the measured worktree and these artifacts are not gitignored: ${unsafe.join(', ')}`)
  }
}

function loadInput(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1]
}

function printResult(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.projectId} (vNext ${result.mode})`)
  for (const check of result.checks) {
    console.log(`  ${check.ok ? 'PASS' : 'FAIL'} ${check.code}`)
    for (const problem of check.problems) console.log(`    - ${problem}`)
  }
}

function usage() {
  console.log(`usage:
  vnext-verify.mjs --normalize-sources <input.json>
  vnext-verify.mjs --prepare-review <input.json>
  vnext-verify.mjs --init <work-item.json> --out <v2-project-dir>
  vnext-verify.mjs --input <verified-input.json> --worktree <path> [--base <ref>] [--write --out <v2-project-dir>] [--json] [--shadow]
  vnext-verify.mjs --evidence <evidence.json> [--surfaces <surfaces-report.json>] --project <v2-project-dir> --worktree <path> [--base <ref>] [--write --out <v2-project-dir>] [--json]
  vnext-verify.mjs --scaffold-input --project <v2-project-dir> --worktree <path> [--base <ref>]

normalize-sources input: { currentRevision, sourceDocuments }
prepare-review input:   { workItem, currentRevision, sourceDocuments }
scaffold-input:         prints a verify-input.json skeleton for a v2 project
verification input:     { workItem, currentRevision, sourceDocuments, discoveredSurfaces, implementation, evidence, blockers }
                        reviewResponse is accepted only for legacy V0 fixtures; V1/V2 uses the signed audit written by docs-tdd review.
surfaces report:        { discoveredSurfaces, coveredSurfaceIds, msw?, blockers? } — the only fields --evidence mode cannot derive, because
                        they are the agent's real "which surfaces did code discovery find and implementation cover" report.

sourceOracle is not accepted from callers; source coverage authority comes from the independently signed review response.

Verification is read-only unless --write is explicit. --write persists only work-item.json, latest-result.json, and runs.jsonl in --out; it never updates v1 Gate state.`)
}

export function selfTest() {
  const sourceDocuments = [{ path: 'inbox/prd.md', content: 'All password entries use the same copy.' }]
  const normalized = normalizeSourceDocuments(sourceDocuments, { revision: '1' })
  const workItem = {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId: 'PR-00001',
    sourceSnapshot: normalized.sourceSnapshot,
    requirements: [{
      requirementId: 'R-001',
      sourceAnchors: [{ type: 'text', sourceId: normalized.sourceUnits[0].sourceId, path: 'inbox/prd.md', lineStart: 1, lineEnd: 1 }],
      statement: 'All password entries use the same copy.',
      status: 'doing',
      collectionSemantics: { kind: 'none', expectedCount: 0 },
      affectedSurfaces: [{ surfaceId: 'S-001', locator: 'src/password.ts', disposition: 'implement' }],
      evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }],
    }],
    requirementsAuthor: { kind: 'human', id: 'self-test-author' },
    coverageAudit: {
      sourceFingerprint: 'pending', requirementsFingerprint: 'pending', reviewMode: 'independent-cold-read', reviewRunId: 'pending',
      reviewer: { kind: 'model', id: 'pending' }, completedAt: '2000-01-01T00:00:00Z', verdict: 'changes-required', unresolved: ['pending'],
    },
    routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0', routerVersion: 1 },
    apiDependency: { mode: 'no-request', reason: 'copy-only change' },
    scopeApproval: null,
  }
  assert.deepEqual(normalizeSourceInput({ currentRevision: '1', sourceDocuments }), normalized)
  const request = prepareReview({ workItem, currentRevision: '1', sourceDocuments })
  const reviewResponse = {
    schemaVersion: 1,
    protocol: REVIEW_PROTOCOL,
    projectId: workItem.projectId,
    sourceFingerprint: request.sourceFingerprint,
    requirementsFingerprint: request.requirementsFingerprint,
    reviewRunId: 'self-test-review',
    completedAt: '2026-09-04T00:00:00Z',
    reviewer: { kind: 'model', id: 'self-test-independent-reviewer' },
    verdict: 'pass',
    findings: [],
  }
  const code = { headSha: 'abc1234', baseSha: 'base1234', dirtyHash: 'dirty', dirtyFileCount: 1, untrackedFileCount: 0, isGitRepo: true }
  const evidence = {
    runId: 'self-test-exit', capturedAt: '2026-09-04T00:00:02Z', codeFingerprint: code,
    facts: [{
      evidenceId: 'E-1', kind: 'touched-file-quality', result: 'pass', codeFingerprint: code, requirementIds: [], surfaceIds: [], evidenceRefs: ['logs/quality.txt'],
      producer: { kind: 'command', command: 'test touched files', exitCode: 0, startedAt: '2026-09-04T00:00:00Z', finishedAt: '2026-09-04T00:00:01Z' },
    }, {
      evidenceId: 'E-2', kind: 'copy-literal', result: 'pass', codeFingerprint: code, requirementIds: ['R-001'], surfaceIds: ['S-001'], evidenceRefs: ['logs/copy.txt'],
      producer: { kind: 'command', command: 'test copy', exitCode: 0, startedAt: '2026-09-04T00:00:00Z', finishedAt: '2026-09-04T00:00:01Z' },
    }],
  }
  const verifyInput = { workItem, currentRevision: '1', sourceDocuments, reviewResponse, discoveredSurfaces: [{ surfaceId: 'S-001', locator: 'src/password.ts' }], implementation: { coveredSurfaceIds: ['S-001'] }, evidence, blockers: [] }
  const pass = runVNextVerification(verifyInput, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(pass.ok, true, JSON.stringify(pass))
  assert.equal(pass.mode, 'enforced')
  const manualRequiredInput = structuredClone(verifyInput)
  manualRequiredInput.workItem.reviewControl = { sourceFingerprint: 'source', attempts: 2, status: 'adjudicated', requiresPretestHumanRun: true }
  const manualMissing = runVNextVerification(manualRequiredInput, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(manualMissing.checks.find((item) => item.code === 'MANUAL_PRETEST_RUN').ok, false)
  const stale = runVNextVerification({ ...verifyInput, currentRevision: '2' }, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(stale.ok, false)
  assert.equal(stale.checks.find((item) => item.code === 'SOURCE_FRESH').ok, false)
  const pendingInput = structuredClone(verifyInput)
  pendingInput.workItem.apiDependency = { mode: 'pending-dependency', reason: 'backend contract pending', blockerId: 'DEP-1' }
  pendingInput.blockers = [{ blockerId: 'DEP-1', status: 'open', reason: 'backend contract pending' }]
  const pending = runVNextVerification(pendingInput, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(pending.status, 'blocked')
  assert.equal(pending.checks.find((item) => item.code === 'MSW_POLICY').ok, true)
  const lateApiInput = structuredClone(verifyInput)
  lateApiInput.workItem.sourceReadiness = {
    figma: { requirement: 'not-required', status: 'not-required', reason: 'no visual dependency' },
    api: { requirement: 'required', status: 'pending', reason: 'contract pending' },
  }
  const lateApi = runVNextVerification(lateApiInput, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(lateApi.ok, false)
  assert.equal(lateApi.checks.find((item) => item.code === 'SOURCE_READINESS').ok, false)
  const needlessMockInput = structuredClone(verifyInput)
  needlessMockInput.implementation.msw = { handlerIds: ['unused-handler'] }
  const needlessMock = runVNextVerification(needlessMockInput, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(needlessMock.checks.find((item) => item.code === 'MSW_POLICY').ok, false)
  const shadow = runVNextVerification(verifyInput, { currentCodeState: code, mode: 'shadow', generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(shadow.mode, 'shadow')
  assert.throws(() => runVNextVerification({ ...verifyInput, reviewResponse: null }, { currentCodeState: code }), /signed independent review/)
  assert.throws(() => runVNextVerification({ ...verifyInput, sourceOracle: { requiredUnits: [] } }, { currentCodeState: code }), /sourceOracle is reviewer-owned/)

  const deterministicMicro = structuredClone(workItem)
  deterministicMicro.coverageAudit = { unresolved: [] }
  deterministicMicro.extractionAudit = {
    status: 'pass',
    ...coverageFingerprints(deterministicMicro),
  }
  deterministicMicro.extractionAudit.microEligibility = evaluateMicroEligibility(deterministicMicro, normalized.sourceUnits)
  deterministicMicro.extractionAudit.sourceUnitsFingerprint = deterministicMicro.extractionAudit.microEligibility.sourceUnitsFingerprint
  const microInput = { ...verifyInput, workItem: deterministicMicro }
  delete microInput.reviewResponse
  const microPass = runVNextVerification(microInput, { currentCodeState: code, generatedAt: '2026-09-04T00:00:03Z' })
  assert.equal(microPass.ok, true, JSON.stringify(microPass))
  const staleMicroInput = structuredClone(microInput)
  staleMicroInput.workItem.requirements[0].evidencePlan = [{ type: 'pure-logic', runtimeRequired: false }]
  assert.throws(() => runVNextVerification(staleMicroInput, { currentCodeState: code }), /signed independent review/)

  // End-to-end autonomous seam: sign the evidence bundle against the work item exactly as review
  // seals it to disk, then let runVNextVerification independently rebuild that work item via
  // applyCoverageReview before verifying the receipt. Unit-level exit tests share one workItem
  // object between signer and verifier, so they never catch a round-trip fingerprint drift; this does.
  const e2eKeyPath = resolve(`.vnext-verify-e2e-key-${process.pid}`)
  const previousKey = process.env.DOCS_TDD_EVIDENCE_KEY_FILE
  try {
    process.env.DOCS_TDD_EVIDENCE_KEY_FILE = e2eKeyPath
    const attestedCode = { ...code, contentHash: 'e'.repeat(64) }
    const sealedWorkItem = applyCoverageReview(workItem, reviewResponse, { request })
    const commandFacts = evidence.facts.map((fact) => ({ ...fact, codeFingerprint: attestedCode }))
    const signedEvidence = signEvidenceBundle(
      { runId: 'e2e-autonomous', capturedAt: '2026-09-04T00:00:02Z', assuranceMode: 'autonomous', evidenceTrust: 'cli-attested', codeFingerprint: attestedCode, facts: commandFacts },
      { workItem: sealedWorkItem, plan: { schemaVersion: 1, projectId: workItem.projectId, commands: workItem.evidenceCommands || [] }, startedAt: '2026-09-04T00:00:00Z', completedAt: '2026-09-04T00:00:02Z' },
    )
    const autonomous = runVNextVerification({ ...verifyInput, workItem: sealedWorkItem, evidence: signedEvidence }, { currentCodeState: attestedCode, generatedAt: '2026-09-04T00:00:03Z' })
    assert.equal(autonomous.assuranceMode, 'autonomous', JSON.stringify(autonomous))
    assert.equal(autonomous.evidenceTrust, 'cli-attested')
    assert.equal(autonomous.ok, true)
    assert.equal(verifyExitResultIntegrity(autonomous).ok, true)
    // A tampered post-sign code hash must break the receipt and drop back to a non-authoritative result.
    const tampered = runVNextVerification({ ...verifyInput, workItem: sealedWorkItem, evidence: signedEvidence }, { currentCodeState: { ...attestedCode, contentHash: 'f'.repeat(64) }, generatedAt: '2026-09-04T00:00:03Z' })
    assert.notEqual(tampered.assuranceMode, 'autonomous')
  } finally {
    if (previousKey === undefined) delete process.env.DOCS_TDD_EVIDENCE_KEY_FILE
    else process.env.DOCS_TDD_EVIDENCE_KEY_FILE = previousKey
    try { unlinkSync(e2eKeyPath) } catch { /* no-op */ }
  }
  console.log('vnext-verify self-test passed')
}

if (process.argv.includes('--self-test')) {
  selfTest()
} else if (process.argv.includes('--help')) {
  usage()
} else {
  try {
    const normalizePath = argumentValue('--normalize-sources')
    const preparePath = argumentValue('--prepare-review')
    const initPath = argumentValue('--init')
    const inputPath = argumentValue('--input')
    const outDir = argumentValue('--out')
    if (process.argv.includes('--scaffold-input')) {
      const projectDir = argumentValue('--project')
      const worktreePath = argumentValue('--worktree')
      console.log(JSON.stringify(scaffoldVerifyInput({ projectDir, worktreePath, baseRef: argumentValue('--base') || 'origin/online' }), null, 2))
      process.exit(0)
    }
    if (normalizePath) console.log(JSON.stringify(normalizeSourceInput(loadInput(normalizePath)), null, 2))
    else if (preparePath) console.log(JSON.stringify(prepareReview(loadInput(preparePath)), null, 2))
    else if (initPath) {
      if (!outDir) throw new Error('--init requires --out')
      const initialized = initializeVNextArtifacts(outDir, loadInput(initPath))
      console.log(JSON.stringify(initialized, null, 2))
    } else if (inputPath || argumentValue('--evidence')) {
      const worktreePath = argumentValue('--worktree')
      if (!worktreePath) throw new Error('--worktree is required so current effective code state is measured, not trusted from JSON')
      const evidencePath = argumentValue('--evidence')
      let input
      if (evidencePath) {
        const surfacesPath = argumentValue('--surfaces')
        input = assembleVerifyInput({
          projectDir: argumentValue('--project') || outDir,
          worktreePath,
          evidence: loadInput(evidencePath),
          surfacesReport: surfacesPath ? loadInput(surfacesPath) : {},
        })
      } else {
        input = loadInput(inputPath)
        const reconciliationFile = outDir ? join(outDir, 'reconcile-result.json') : ''
        if (!input.reconciliation && reconciliationFile && existsSync(reconciliationFile)) input.reconciliation = loadInput(reconciliationFile)
      }
      const mode = process.argv.includes('--shadow') ? 'shadow' : 'enforced'
      const scopePaths = input.evidence?.codeFingerprint?.scopeMode === 'path-set-v1'
        ? input.evidence.codeFingerprint.scopePaths
        : null
      const result = runVNextVerification(input, {
        currentCodeState: codeFingerprint(resolve(worktreePath), argumentValue('--base') || 'origin/online', { scopePaths }),
        mode,
      })
      if (process.argv.includes('--write')) {
        if (!outDir) throw new Error('--write requires --out')
        assertSafeArtifactOutput(worktreePath, outDir)
        const normalized = normalizeCurrentSources(input.workItem, input.sourceDocuments, input.currentRevision)
        const reviewResponse = input.reviewResponse || coverageReviewResponseFromAudit(input.workItem)
        const workItem = resolveReviewedWorkItem(input.workItem, normalized.sourceUnits, reviewResponse)
        const persisted = persistVNextRun(outDir, { workItem, result })
        console.error(`vNext artifacts: ${persisted.idempotent ? 'idempotent' : 'written'} (${persisted.runCount} run${persisted.runCount === 1 ? '' : 's'})`)
      }
      printResult(result, process.argv.includes('--json'))
      process.exitCode = result.ok ? 0 : 1
    } else {
      usage()
      process.exitCode = 2
    }
  } catch (error) {
    console.error(`vNext verification failed: ${error.message}`)
    process.exitCode = 2
  }
}
