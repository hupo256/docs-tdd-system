#!/usr/bin/env node
// Deterministic surface-to-code reconciliation. The work item declares what must exist; this
// module derives code, wiring, runtime, and dependency truth from the current target tree.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { minimatch } from 'minimatch'
import { matchesEffectiveCodeState } from './fingerprint.mjs'

export const RECONCILE_LIFECYCLE_STATES = Object.freeze([
  'not-started',
  'scoped',
  'approved',
  'implementing',
  'partially-implemented',
  'implementation-complete',
  'integration-pending',
  'ready-for-human-acceptance',
  'delivery-ready',
  'delivered',
])

const ACTION_PATTERN = /(?:click|open|switch|select|close|submit|restore|disable|resend|redirect|点击|打开|切换|选择|关闭|提交|恢复|禁用|重新发送|跳转)/i
const PROVIDER_KINDS = new Set(['component', 'hook', 'function', 'export'])

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function structuredImplementSurfaces(workItem) {
  return (workItem?.requirements || []).flatMap((requirement) => (requirement.affectedSurfaces || [])
    .filter((surface) => requirement.status === 'doing' && surface.disposition === 'implement' && surface.codeLocator)
    .map((surface) => ({
      ...surface,
      requirementId: requirement.requirementId,
      requirementStatement: requirement.statement,
      evidencePlan: requirement.evidencePlan || [],
    })))
}

export function requiresSurfaceReconciliation(workItem) {
  return structuredImplementSurfaces(workItem).length > 0
}

function dependencyMap(workItem) {
  const dependency = workItem?.apiDependency
  const entries = Array.isArray(dependency) ? dependency : dependency?.dependencies || []
  const mapped = new Map(entries.filter((entry) => entry?.id).map((entry) => [entry.id, entry]))
  if (!Array.isArray(dependency) && dependency?.blockerId) {
    mapped.set(dependency.blockerId, { id: dependency.blockerId, ready: dependency.mode !== 'pending-dependency' })
  }
  return mapped
}

function candidatePaths(locator, treeFiles) {
  const app = normalizePath(locator.app)
  const expectPath = normalizePath(locator.expectPath)
  return treeFiles.filter((file) => {
    const normalized = normalizePath(file)
    if (!(normalized === app || normalized.startsWith(`${app}/`))) return false
    if (!expectPath) return true
    const relative = normalized.slice(app.length).replace(/^\//, '')
    return minimatch(relative, expectPath, { dot: true, nocase: false })
  })
}

function symbolMatch(locator, content) {
  if (!locator.symbol) return Boolean(content)
  const symbol = escapeRegExp(locator.symbol)
  return new RegExp(`(?:^|[^A-Za-z0-9_$])${symbol}(?:$|[^A-Za-z0-9_$])`, 'm').test(content)
}

function exportedSymbol(locator, content) {
  if (!locator.symbol || !PROVIDER_KINDS.has(locator.kind)) return true
  const symbol = escapeRegExp(locator.symbol)
  return new RegExp(`(?:export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|class|const|let|var)?\\s*${symbol}\\b|export\\s*\\{[^}]*\\b${symbol}\\b)`, 'm').test(content)
}

function passingFact(evidenceFacts, surface, kinds) {
  return evidenceFacts.some((fact) => fact?.result === 'pass'
    && kinds.includes(fact.kind)
    && ((fact.surfaceIds || []).includes(surface.surfaceId) || (fact.requirementIds || []).includes(surface.requirementId)))
}

function runtimeRequired(surface) {
  return surface.codeLocator.kind === 'browser-scenario'
    || surface.wiring?.wiringEvidence === 'browser'
    || surface.evidencePlan.some((plan) => plan.runtimeRequired)
    || ACTION_PATTERN.test(surface.requirementStatement || '')
}

function resolveCode(surface, treeFiles, fileContents) {
  const paths = candidatePaths(surface.codeLocator, treeFiles)
  const matched = paths.filter((path) => symbolMatch(surface.codeLocator, fileContents[path] || ''))
  if (!matched.length) {
    return {
      codeStatus: 'missing',
      resolvedPaths: [],
      matchedSymbol: false,
      notes: `symbol ${surface.codeLocator.symbol || surface.codeLocator.kind} not found in ${surface.codeLocator.app}`,
    }
  }
  const role = surface.wiring?.role || surface.codeLocator.role || 'standalone'
  const exported = role !== 'provider' || matched.some((path) => exportedSymbol(surface.codeLocator, fileContents[path] || ''))
  return {
    codeStatus: exported ? 'covered' : 'partial',
    resolvedPaths: matched.sort(),
    matchedSymbol: true,
    notes: exported ? '' : `provider symbol ${surface.codeLocator.symbol} exists but is not exported`,
  }
}

function resolveWiring(surface, code, byId, fileContents, evidenceFacts) {
  const role = surface.wiring?.role || surface.codeLocator.role || 'standalone'
  if (role !== 'consumer') return { wiringStatus: 'n/a', note: '' }
  const providers = (surface.wiring?.dependsOn || []).map((id) => byId.get(id)).filter(Boolean)
  if (!providers.length || providers.some((provider) => provider.codeStatus !== 'covered')) {
    return { wiringStatus: 'missing', note: `provider ${(surface.wiring?.dependsOn || []).join(', ') || '<missing>'} is not covered` }
  }
  const level = surface.wiring?.wiringEvidence || 'import'
  const providerSymbols = providers.map((provider) => provider.symbol).filter(Boolean)
  const contents = code.resolvedPaths.map((path) => fileContents[path] || '')
  const importsProvider = providerSymbols.some((symbol) => contents.some((content) => new RegExp(`(?:import[\\s\\S]{0,300}\\b${escapeRegExp(symbol)}\\b|require\\([^)]*${escapeRegExp(symbol)})`, 'm').test(content)))
  const rendersProvider = providerSymbols.some((symbol) => contents.some((content) => new RegExp(`<${escapeRegExp(symbol)}(?:\\s|/|>)`).test(content)))
  const contractPass = passingFact(evidenceFacts, surface, ['component-dom'])
  const browserPass = passingFact(evidenceFacts, surface, ['browser-interaction', 'human-check'])
  const covered = level === 'import'
    ? importsProvider
    : level === 'render'
      ? importsProvider && rendersProvider
      : level === 'event-binding'
        ? importsProvider && rendersProvider && contractPass
        : browserPass
  return { wiringStatus: covered ? 'covered' : 'missing', note: covered ? '' : `consumer wiring does not satisfy ${level}` }
}

function rollupSurfaceStatus(surfaces, pivoted) {
  const missingCount = surfaces.filter((item) => item.codeStatus === 'missing').length
  const staleCount = surfaces.filter((item) => item.codeStatus === 'stale').length
  const partialCount = surfaces.filter((item) => item.codeStatus === 'partial' || ['partial', 'missing'].includes(item.wiringStatus)).length
  const coveredCount = surfaces.filter((item) => item.codeStatus === 'covered' && ['covered', 'n/a'].includes(item.wiringStatus)).length
  const runtimeCriticalPending = surfaces.filter((item) => item.runtimeStatus === 'not-verified').map((item) => item.surfaceId)
  const integrationPending = surfaces.filter((item) => item.integrationStatus === 'pending').map((item) => item.surfaceId)
  let overall = 'implementation-complete'
  if (!surfaces.length || (pivoted && staleCount === surfaces.length)) overall = 'implementing'
  else if (missingCount || partialCount || staleCount) overall = 'partially-implemented'
  else if (integrationPending.length) overall = 'integration-pending'
  else if (!runtimeCriticalPending.length) overall = 'ready-for-human-acceptance'
  return { overall, coveredCount, partialCount, missingCount, staleCount, runtimeCriticalPending, integrationPending }
}

export function reconcileSurfaces({ workItem, codeState, treeFiles = [], fileContents = {}, evidenceFacts = [], previousResult = null, reconciledAt = new Date().toISOString() } = {}) {
  if (!workItem?.projectId || workItem.workflowVersion !== 2) throw new Error('surface reconciliation requires a workflowVersion=2 work item')
  if (!codeState?.headSha || !codeState?.dirtyHash) throw new Error('surface reconciliation requires a current code fingerprint')
  const targetApp = workItem.deliveryTarget?.app || ''
  const declared = structuredImplementSurfaces(workItem)
  const pivoted = Boolean(previousResult?.deliveryTargetApp && targetApp && previousResult.deliveryTargetApp !== targetApp)
  const dependencies = dependencyMap(workItem)
  const initial = declared.map((surface) => {
    const code = resolveCode(surface, treeFiles, fileContents)
    const stale = pivoted && code.codeStatus === 'missing'
    const blockedDependencies = (surface.blockedBy || []).filter((id) => dependencies.get(id)?.ready !== true)
    return {
      surfaceId: surface.surfaceId,
      requirementId: surface.requirementId,
      symbol: surface.codeLocator.symbol || '',
      codeStatus: stale ? 'stale' : code.codeStatus,
      wiringStatus: 'n/a',
      runtimeStatus: stale || runtimeRequired(surface) ? 'not-verified' : 'n/a',
      verifiedBy: null,
      integrationStatus: blockedDependencies.length ? 'pending' : 'ready',
      blockedBy: blockedDependencies,
      resolvedPaths: code.resolvedPaths,
      matchedSymbol: code.matchedSymbol,
      notes: [
        stale ? `stale after delivery target pivot from ${previousResult.deliveryTargetApp}` : code.notes,
        blockedDependencies.length ? `integration-pending: ${blockedDependencies.join(', ')}` : '',
      ].filter(Boolean).join('; '),
      _surface: surface,
    }
  })
  const byId = new Map(initial.map((surface) => [surface.surfaceId, surface]))
  const surfaces = initial.map((entry) => {
    const wiring = resolveWiring(entry._surface, entry, byId, fileContents, evidenceFacts)
    const browserVerified = passingFact(evidenceFacts, entry._surface, ['browser-interaction'])
    const humanVerified = passingFact(evidenceFacts, entry._surface, ['human-check'])
    const { _surface, symbol: _symbol, ...publicEntry } = entry
    return {
      ...publicEntry,
      wiringStatus: wiring.wiringStatus,
      runtimeStatus: publicEntry.runtimeStatus === 'not-verified' && (browserVerified || humanVerified) ? 'verified' : publicEntry.runtimeStatus,
      verifiedBy: browserVerified ? 'browser' : humanVerified ? 'human' : null,
      notes: [publicEntry.notes, wiring.note].filter(Boolean).join('; '),
    }
  })
  return {
    schemaVersion: 1,
    projectId: workItem.projectId,
    reconciledAt,
    headSha: codeState.headSha,
    dirtyHash: codeState.dirtyHash,
    contentHash: codeState.contentHash || '',
    ...(codeState.scopeMode ? { scopeMode: codeState.scopeMode, scopePaths: codeState.scopePaths || [] } : {}),
    deliveryTargetApp: targetApp,
    pivoted,
    surfaces,
    rollup: rollupSurfaceStatus(surfaces, pivoted),
  }
}

export function reconcileResultProblems({ workItem, result, currentCodeState, requireDeliveryReady = false } = {}) {
  if (!requiresSurfaceReconciliation(workItem)) return []
  if (!result || result.schemaVersion !== 1 || result.projectId !== workItem.projectId) {
    return ['current structured surfaces have no valid reconcile-result.json']
  }
  const problems = []
  const recordedCodeState = {
    headSha: result.headSha,
    dirtyHash: result.dirtyHash,
    contentHash: result.contentHash,
    ...(result.scopeMode ? { scopeMode: result.scopeMode, scopePaths: result.scopePaths || [] } : {}),
  }
  if (!matchesEffectiveCodeState(currentCodeState, recordedCodeState)) problems.push('reconcile result does not match current effective code state')
  if ((workItem.deliveryTarget?.app || '') !== result.deliveryTargetApp) problems.push('reconcile result delivery target is stale')
  if (['implementing', 'partially-implemented'].includes(result.rollup?.overall)) problems.push(`surface reconciliation is ${result.rollup?.overall}`)
  if (requireDeliveryReady && result.rollup?.integrationPending?.length) problems.push(`integration-pending surfaces remain: ${result.rollup.integrationPending.join(', ')}`)
  if (requireDeliveryReady && result.rollup?.runtimeCriticalPending?.length) problems.push(`runtime-critical surfaces are not verified: ${result.rollup.runtimeCriticalPending.join(', ')}`)
  return problems
}

function selfTest() {
  const fixtureFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'vnext-reconcile-cases.json')
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'))
  for (const testCase of fixture.cases) {
    const result = reconcileSurfaces(testCase.input)
    assert.equal(result.rollup.overall, testCase.expected.overall, testCase.id)
    for (const expected of testCase.expected.surfaces) {
      const actual = result.surfaces.find((surface) => surface.surfaceId === expected.surfaceId)
      assert.ok(actual, `${testCase.id}:${expected.surfaceId} missing`)
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, `${testCase.id}:${expected.surfaceId}:${key}`)
    }
  }
  assert.deepEqual(reconcileResultProblems({ workItem: { workflowVersion: 2, requirements: [] } }), [])
  console.log(`vnext-reconcile self-test passed (${fixture.cases.length} cases)`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
