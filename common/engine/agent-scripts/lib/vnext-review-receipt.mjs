#!/usr/bin/env node
// Cryptographic receipt for model coverage reviews. The signing key is machine-local and never
// enters project artifacts, so a caller cannot turn hand-written reviewer JSON into a trusted run.

import assert from 'node:assert/strict'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stableFingerprint } from './vnext-work-item.mjs'

export const REVIEW_RECEIPT_ISSUER = 'docs-tdd-review-v1'
export const defaultReviewKeyPath = () => process.env.DOCS_TDD_REVIEW_KEY_FILE || join(homedir(), '.docs-tdd', 'review-receipt.key')

function receiptBody(receipt) {
  const { signature, ...body } = receipt
  return body
}

function responseBody(response) {
  const { receipt, ...body } = response
  return body
}

function loadKey({ keyPath = defaultReviewKeyPath(), create = false } = {}) {
  const file = resolve(keyPath)
  if (!existsSync(file)) {
    if (!create) return null
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file, `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 })
    chmodSync(file, 0o600)
  }
  const key = readFileSync(file, 'utf8').trim()
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error(`invalid vNext review receipt key: ${file}`)
  return key
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function signatureFor(response, receipt, key) {
  return createHmac('sha256', key).update(canonicalJson({ response: responseBody(response), receipt: receiptBody(receipt) })).digest('hex')
}

export function reviewRequestFingerprint(request) {
  const { requestFingerprint, ...body } = request || {}
  return stableFingerprint(body)
}

export function signReviewResponse(response, {
  request,
  client,
  sessionId,
  startedAt,
  completedAt = response.completedAt,
  reviewedAssets = [],
  keyPath,
} = {}) {
  if (!request || !client?.trim() || !sessionId?.trim() || !startedAt || !completedAt) throw new Error('review receipt requires request, client, sessionId, and timestamps')
  const receipt = {
    issuedBy: REVIEW_RECEIPT_ISSUER,
    client,
    sessionId,
    sourceIsolation: 'source-only-no-code',
    requestFingerprint: reviewRequestFingerprint(request),
    reviewedAssets: reviewedAssets.map(({ sourceId, assetHash }) => ({ sourceId, assetHash })),
    startedAt,
    completedAt,
  }
  const key = loadKey({ keyPath, create: true })
  return { ...response, receipt: { ...receipt, signature: signatureFor(response, receipt, key) } }
}

export function verifyReviewReceipt(response, { requestFingerprint: expectedRequestFingerprint, sourceAssets = [], keyPath } = {}) {
  const problems = []
  const receipt = response?.receipt
  if (!receipt) return ['review receipt is required']
  if (receipt.issuedBy !== REVIEW_RECEIPT_ISSUER) problems.push(`review receipt issuer must be ${REVIEW_RECEIPT_ISSUER}`)
  if (!receipt.client?.trim() || !receipt.sessionId?.trim()) problems.push('review receipt requires client and sessionId')
  if (receipt.sourceIsolation !== 'source-only-no-code') problems.push('review receipt must attest source-only-no-code isolation')
  if (receipt.requestFingerprint !== expectedRequestFingerprint) problems.push('review receipt does not match the current review request')
  if (!receipt.startedAt || Number.isNaN(Date.parse(receipt.startedAt)) || !receipt.completedAt || Number.isNaN(Date.parse(receipt.completedAt))) problems.push('review receipt requires valid timestamps')
  const expectedAssets = sourceAssets.map(({ sourceId, assetHash }) => ({ sourceId, assetHash })).sort((a, b) => a.sourceId.localeCompare(b.sourceId))
  const reviewedAssets = Array.isArray(receipt.reviewedAssets) ? [...receipt.reviewedAssets].sort((a, b) => String(a.sourceId).localeCompare(String(b.sourceId))) : []
  if (JSON.stringify(reviewedAssets) !== JSON.stringify(expectedAssets)) problems.push('review receipt does not cover every current image asset hash')

  let key
  try { key = loadKey({ keyPath, create: false }) } catch (error) { problems.push(error.message) }
  if (!key) problems.push('local review receipt key is unavailable')
  if (!/^[a-f0-9]{64}$/.test(receipt.signature || '')) problems.push('review receipt signature is invalid')
  if (key && /^[a-f0-9]{64}$/.test(receipt.signature || '')) {
    const expected = Buffer.from(signatureFor(response, receipt, key), 'hex')
    const actual = Buffer.from(receipt.signature, 'hex')
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) problems.push('review receipt signature does not match payload')
  }
  return problems
}

export function selfTest() {
  const keyPath = join(process.cwd(), `.vnext-review-key-${process.pid}`)
  try {
    const request = { protocol: 'x', projectId: 'PR-00001', sourceUnits: [] }
    const response = { projectId: 'PR-00001', completedAt: '2026-09-10T00:00:01Z', verdict: 'pass', findings: [] }
    const signed = signReviewResponse(response, { request, client: 'pi', sessionId: 'review-1', startedAt: '2026-09-10T00:00:00Z', keyPath })
    assert.deepEqual(verifyReviewReceipt(signed, { requestFingerprint: reviewRequestFingerprint(request), keyPath }), [])
    assert.match(verifyReviewReceipt({ ...signed, verdict: 'changes-required' }, { requestFingerprint: reviewRequestFingerprint(request), keyPath }).join(' '), /signature/)
    assert.match(verifyReviewReceipt(signed, { requestFingerprint: 'stale', keyPath }).join(' '), /current review request/)
    console.log('vnext-review-receipt self-test passed')
  } finally {
    try { unlinkSync(keyPath) } catch { /* no-op */ }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
