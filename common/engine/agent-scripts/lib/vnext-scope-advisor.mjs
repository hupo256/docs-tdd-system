#!/usr/bin/env node
// 入口守卫（scope advisor）：检测「trivial 形态的单点改动混在大 work-item 里」的反模式。
// 场景：一个纯展示/文案单点需求被追加进一个整体落 standard/high-risk 的巨型 work-item
// （如 PR-02233 把「按钮加 hover 手型」挂进 32 需求项目），从而继承全套重流程。
// 这是告警而非硬拦：合法的大项目本身没错，只是提示把 trivial 需求拆成独立最小项目走快档。

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { deriveEfficiencyRoute } from './vnext-efficiency-policy.mjs'

// 与 vnext-efficiency-policy 的 trivial 判定保持同一口径。
const NON_TRIVIAL_EVIDENCE = new Set(['pure-logic', 'payload-contract', 'api-contract', 'browser-interaction'])
const PRESENTATIONAL_MARKERS = new Set(['copy-literal', 'component-dom'])
const RISK_WORDS = /password|permission|fund|trading|withdraw|transfer|delete|irreversible|money|amount|保证金|杠杆|提币|改密|密码|权限/i
const HEAVY_ROUTES = new Set(['standard', 'high-risk'])

function asArray(value) {
  return Array.isArray(value) ? value : []
}

// 单个需求自身是否 trivial 形态：唯一 implement surface、无集合语义、无风险词、
// 证据无逻辑/契约/运行时项且带正向展示信号(copy-literal/component-dom)。
export function requirementIsTrivialShaped(requirement) {
  const surfaces = asArray(requirement?.affectedSurfaces).filter((surface) => surface?.disposition === 'implement')
  if (surfaces.length !== 1) return false
  const collection = requirement?.collectionSemantics
  if (collection?.kind && collection.kind !== 'none') return false
  const text = [requirement?.statement, requirement?.acceptanceCriteria, requirement?.notes].filter(Boolean).join(' ')
  if (RISK_WORDS.test(text)) return false
  const plan = asArray(requirement?.evidencePlan)
  if (!plan.length) return false
  if (plan.some((evidence) => NON_TRIVIAL_EVIDENCE.has(evidence?.type) || evidence?.runtimeRequired)) return false
  return plan.some((evidence) => PRESENTATIONAL_MARKERS.has(evidence?.type))
}

// 对 work-item 给出范围建议：整体落大档但含 trivial 形态活动需求 → 建议拆分。
export function scopeAdvisory(workItem = {}) {
  const decision = deriveEfficiencyRoute(workItem)
  const activeRequirements = asArray(workItem?.requirements).filter((requirement) => requirement?.status === 'doing')
  const trivialSplitCandidates = activeRequirements
    .filter(requirementIsTrivialShaped)
    .map((requirement) => requirement.requirementId)
  const misbindDetected = HEAVY_ROUTES.has(decision.route) && trivialSplitCandidates.length > 0
  return {
    overallRoute: decision.route,
    activeRequirementCount: activeRequirements.length,
    trivialSplitCandidates,
    misbindDetected,
    recommendation: misbindDetected
      ? `${trivialSplitCandidates.length} 个活动需求是 trivial 形态(纯展示单点)，却挂在 ${decision.route} 档的 work-item 上；建议拆到独立最小项目走 trivial 快档：${trivialSplitCandidates.join(', ')}`
      : null,
  }
}

export function selfTest() {
  // 1) 纯 trivial 单需求 work-item：整体就是 trivial → 不误报。
  const triviaItem = {
    routing: { scopeClass: 'local', riskSignals: [] },
    requirements: [{
      requirementId: 'R-1', status: 'doing', statement: 'Show pointer cursor on the button.',
      collectionSemantics: { kind: 'none', expectedCount: 0 },
      affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement' }],
      evidencePlan: [{ type: 'touched-file-quality', runtimeRequired: false }, { type: 'component-dom', runtimeRequired: false }],
    }],
    apiDependency: { mode: 'no-request' },
  }
  // 1) 小需求 work-item：整体非重档(trivial/micro/lite) → 不误报 misbind。
  const trivialAdvisory = scopeAdvisory(triviaItem)
  assert.equal(HEAVY_ROUTES.has(trivialAdvisory.overallRoute), false, trivialAdvisory.overallRoute)
  assert.equal(trivialAdvisory.misbindDetected, false)
  assert.equal(trivialAdvisory.recommendation, null)

  // 2) 大 work-item(集合语义 + 多 surface → standard/high-risk)里混一个 trivial 形态需求 → 报告拆分候选。
  const mixedItem = {
    routing: { scopeClass: 'multi-surface', riskSignals: [] },
    requirements: [
      {
        requirementId: 'R-big', status: 'doing', statement: 'Update every verification entry across the site.',
        collectionSemantics: { kind: 'explicit-set', expectedCount: 9 },
        affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement' }, { surfaceId: 'S-2', disposition: 'implement' }],
        evidencePlan: [{ type: 'pure-logic', runtimeRequired: false }],
      },
      {
        requirementId: 'R-copy', status: 'doing', statement: 'Change the switch-method link copy.',
        collectionSemantics: { kind: 'none', expectedCount: 0 },
        affectedSurfaces: [{ surfaceId: 'S-3', disposition: 'implement' }],
        evidencePlan: [{ type: 'touched-file-quality', runtimeRequired: false }, { type: 'copy-literal', runtimeRequired: false }],
      },
    ],
    apiDependency: { mode: 'no-request' },
  }
  const mixedAdvisory = scopeAdvisory(mixedItem)
  assert.ok(HEAVY_ROUTES.has(mixedAdvisory.overallRoute), mixedAdvisory.overallRoute)
  assert.equal(mixedAdvisory.misbindDetected, true)
  assert.deepEqual(mixedAdvisory.trivialSplitCandidates, ['R-copy'])
  assert.ok(mixedAdvisory.recommendation.includes('R-copy'))

  // 3) 风险词需求不算 trivial 形态(不误判高危为可拆快档)。
  assert.equal(requirementIsTrivialShaped({
    status: 'doing', statement: 'Change password reset copy.',
    affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement' }],
    evidencePlan: [{ type: 'copy-literal', runtimeRequired: false }],
  }), false)

  // 4) 仅 touched-file-quality(无展示信号，可能是逻辑改)不算 trivial 形态。
  assert.equal(requirementIsTrivialShaped({
    status: 'doing', statement: 'Change exported constant.',
    affectedSurfaces: [{ surfaceId: 'S-1', disposition: 'implement' }],
    evidencePlan: [{ type: 'touched-file-quality', runtimeRequired: false }],
  }), false)

  console.log('vnext-scope-advisor self-test passed (no false-positive on pure-trivial, detects trivial-in-heavy misbind, risk-word + no-marker excluded)')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
