#!/usr/bin/env node

import assert from 'node:assert/strict'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function normalize(path) {
  return String(path || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')
}

export function deliveryPolicyPaths(workItem) {
  const paths = workItem?.deliveryScope?.policyPaths || []
  if (!Array.isArray(paths)) throw new Error('deliveryScope.policyPaths must be an array')
  const normalized = paths.map(normalize)
  const invalid = normalized.filter((path) => !path || isAbsolute(path) || path === '..' || path.startsWith('../') || path.includes('/../'))
  if (invalid.length) throw new Error(`deliveryScope.policyPaths must be repository-relative: ${invalid.join(', ')}`)
  if (new Set(normalized).size !== normalized.length) throw new Error('deliveryScope.policyPaths must not contain duplicates')
  return normalized.sort()
}

export function pathMatchesDeliveryPolicy(path, policyPaths) {
  const normalizedPath = normalize(path)
  return policyPaths.some((policyPath) => normalizedPath === policyPath || normalizedPath.startsWith(`${policyPath}/`))
}

export function outOfScopeDeliveryPaths(workItem, changedPaths) {
  const policyPaths = deliveryPolicyPaths(workItem)
  if (!policyPaths.length) return []
  return [...new Set((changedPaths || []).map(normalize).filter((path) => !pathMatchesDeliveryPolicy(path, policyPaths)))].sort()
}

export function deliveryScopePathProblems(workItem, changedPaths) {
  try {
    return outOfScopeDeliveryPaths(workItem, changedPaths).map((path) => `changed path is outside deliveryScope.policyPaths: ${path}`)
  } catch (error) {
    return [error.message]
  }
}

export function selfTest() {
  const workItem = { deliveryScope: { policyPaths: ['apps/web/src', 'packages/shared/file.ts'] } }
  assert.deepEqual(deliveryPolicyPaths(workItem), ['apps/web/src', 'packages/shared/file.ts'])
  assert.equal(pathMatchesDeliveryPolicy('apps/web/src/a.ts', deliveryPolicyPaths(workItem)), true)
  assert.deepEqual(outOfScopeDeliveryPaths(workItem, ['apps/web/src/a.ts', 'scripts/x.mjs']), ['scripts/x.mjs'])
  assert.match(deliveryScopePathProblems({ deliveryScope: { policyPaths: ['../escape'] } }, []).join(' '), /repository-relative/)
  console.log('vnext-delivery-scope self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
