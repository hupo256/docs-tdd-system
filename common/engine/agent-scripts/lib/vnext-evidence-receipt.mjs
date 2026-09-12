#!/usr/bin/env node
// Machine-local attestation for evidence executed by docs-tdd. The receipt binds the complete
// evidence bundle to one work item and effective code state; hand-edited evidence cannot become
// autonomous without a matching local signature.

import assert from 'node:assert/strict'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableFingerprint, verificationWorkItemFingerprint } from './vnext-work-item.mjs'

export const EVIDENCE_RECEIPT_ISSUER = 'docs-tdd-evidence-v1'
export const defaultEvidenceKeyPath = () => process.env.DOCS_TDD_EVIDENCE_KEY_FILE || join(homedir(), '.docs-tdd', 'evidence-receipt.key')

function bundleBody(bundle) {
  const { receipt, ...body } = bundle || {}
  return body
}

function receiptBody(receipt) {
  const { signature, bundleFingerprint, ...body } = receipt || {}
  return body
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function loadKey({ keyPath = defaultEvidenceKeyPath(), create = false } = {}) {
  const file = resolve(keyPath)
  if (!existsSync(file)) {
    if (!create) return null
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 })
    chmodSync(file, 0o600)
  }
  const key = readFileSync(file, 'utf8').trim()
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error(`invalid vNext evidence receipt key: ${file}`)
  return key
}

export function evidenceBundleFingerprint(bundle) {
  return stableFingerprint(bundleBody(bundle))
}

function signatureFor(bundleFingerprint, receipt, key) {
  return createHmac('sha256', key).update(canonicalJson({ bundleFingerprint, receipt: receiptBody(receipt) })).digest('hex')
}

export function evidencePlanFingerprint(plan) {
  return stableFingerprint(plan)
}

export function signEvidenceBundle(bundle, { workItem, plan, startedAt, completedAt = bundle.capturedAt, keyPath } = {}) {
  if (!workItem?.projectId || !plan || !startedAt || !completedAt) throw new Error('evidence receipt requires workItem, plan, and timestamps')
  const receipt = {
    issuedBy: EVIDENCE_RECEIPT_ISSUER,
    projectId: workItem.projectId,
    workItemFingerprint: verificationWorkItemFingerprint(workItem),
    codeContentHash: bundle?.codeFingerprint?.contentHash || '',
    planFingerprint: evidencePlanFingerprint(plan),
    runId: bundle?.runId || '',
    startedAt,
    completedAt,
  }
  const key = loadKey({ keyPath, create: true })
  return { ...bundle, receipt: { ...receipt, signature: signatureFor(evidenceBundleFingerprint(bundle), receipt, key) } }
}

export function verifyEvidenceAttestation(attestation, {
  expectedBundleFingerprint,
  expectedProjectId,
  expectedWorkItemFingerprint,
  expectedCodeContentHash,
  expectedRunId,
  keyPath,
} = {}) {
  const problems = []
  const receipt = attestation
  if (!receipt) return ['evidence receipt is required']
  if (receipt.issuedBy !== EVIDENCE_RECEIPT_ISSUER) problems.push(`evidence receipt issuer must be ${EVIDENCE_RECEIPT_ISSUER}`)
  if (expectedProjectId && receipt.projectId !== expectedProjectId) problems.push('evidence receipt does not match project')
  if (expectedWorkItemFingerprint && receipt.workItemFingerprint !== expectedWorkItemFingerprint) problems.push('evidence receipt does not match work item')
  if (expectedCodeContentHash && receipt.codeContentHash !== expectedCodeContentHash) problems.push('evidence receipt does not match current code content')
  if (!/^[a-f0-9]{64}$/.test(receipt.planFingerprint || '')) problems.push('evidence receipt plan fingerprint is invalid')
  if (!receipt.runId || (expectedRunId && receipt.runId !== expectedRunId)) problems.push('evidence receipt does not match runId')
  if (!/^[a-f0-9]{64}$/.test(expectedBundleFingerprint || '')) problems.push('evidence bundle fingerprint is invalid')
  if (!receipt.startedAt || Number.isNaN(Date.parse(receipt.startedAt)) || !receipt.completedAt || Number.isNaN(Date.parse(receipt.completedAt))) problems.push('evidence receipt requires valid timestamps')

  let key
  try { key = loadKey({ keyPath, create: false }) } catch (error) { problems.push(error.message) }
  if (!key) problems.push('local evidence receipt key is unavailable')
  if (!/^[a-f0-9]{64}$/.test(receipt.signature || '')) problems.push('evidence receipt signature is invalid')
  if (key && /^[a-f0-9]{64}$/.test(receipt.signature || '')) {
    const expected = Buffer.from(signatureFor(expectedBundleFingerprint, receipt, key), 'hex')
    const actual = Buffer.from(receipt.signature, 'hex')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) problems.push('evidence receipt signature does not match payload')
  }
  return problems
}

export function verifyEvidenceReceipt(bundle, { workItem, currentCodeState, keyPath } = {}) {
  const problems = verifyEvidenceAttestation(bundle?.receipt, {
    expectedBundleFingerprint: evidenceBundleFingerprint(bundle),
    expectedProjectId: workItem?.projectId,
    expectedWorkItemFingerprint: verificationWorkItemFingerprint(workItem),
    expectedCodeContentHash: currentCodeState?.contentHash,
    expectedRunId: bundle?.runId,
    keyPath,
  })
  if (bundle?.receipt?.codeContentHash !== bundle?.codeFingerprint?.contentHash) problems.push('evidence receipt does not match bundle code content')
  if ((bundle?.facts || []).some((fact) => fact.producer?.kind !== 'command')) problems.push('autonomous evidence receipt may contain command producers only')
  return problems
}

export function selfTest() {
  const keyPath = join(process.cwd(), `.vnext-evidence-key-${process.pid}`)
  try {
    const code = { contentHash: 'a'.repeat(64) }
    const workItem = { projectId: 'PR-00001', requirements: [] }
    const plan = { schemaVersion: 1, projectId: 'PR-00001', commands: [] }
    const bundle = { runId: 'run-1', capturedAt: '2026-09-10T00:00:01Z', codeFingerprint: code, facts: [] }
    const signed = signEvidenceBundle(bundle, { workItem, plan, startedAt: '2026-09-10T00:00:00Z', keyPath })
    assert.deepEqual(verifyEvidenceReceipt(signed, { workItem, currentCodeState: code, keyPath }), [])
    assert.match(verifyEvidenceReceipt({ ...signed, runId: 'forged' }, { workItem, currentCodeState: code, keyPath }).join(' '), /runId|signature/)
    assert.match(verifyEvidenceReceipt(signed, { workItem, currentCodeState: { contentHash: 'b'.repeat(64) }, keyPath }).join(' '), /code content/)
    console.log('vnext-evidence-receipt self-test passed')
  } finally {
    try { unlinkSync(keyPath) } catch { /* no-op */ }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
