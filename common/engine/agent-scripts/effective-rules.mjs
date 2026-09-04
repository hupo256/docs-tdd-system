#!/usr/bin/env node
// effective rules 维护执行器：装配根/源镜头/依赖，分发 --check/--write/--doctor/--self-test。
// 纯判定已抽到 lib/effective-{sources,snapshot,doctor}.mjs 与 lib/l2-conflict-detect.mjs（各自 --self-test）。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCursorAdapter } from './lib/agent-rule-adapters.mjs'
import { runDoctor } from './lib/effective-doctor.mjs'
import { createSourceLens } from './lib/effective-sources.mjs'
import { createSnapshotter } from './lib/effective-snapshot.mjs'
import { findL2Conflicts, resolveL2Conflicts } from './lib/l2-conflict-detect.mjs'
import { resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot, consumerRoot: repoRoot, consumerWorktree, config } = resolveRoots()
const ruleConsumerRoot = consumerWorktree && consumerWorktree !== docsSystemRoot ? consumerWorktree : repoRoot
const commonDir = join(docsSystemRoot, 'common')
const manifestFile = join(commonDir, 'effective-rules.json')
const home = homedir()
const args = process.argv.slice(2)
const json = args.includes('--json')
const allowTrackedRuleChanges = args.includes('--allow-tracked-rule-changes')
const strict = args.includes('--strict')

const g = config.globalAdapters
const conflictOverrides = (Array.isArray(config.ruleConflictOverrides) ? config.ruleConflictOverrides : [])
  .filter((override) => override && typeof override.id === 'string' && typeof override.winner === 'string' && Array.isArray(override.loserFiles))
  .map((override) => ({ id: override.id, winner: override.winner, loserFiles: [...override.loserFiles].sort(), reason: override.reason || '' }))
  .sort((a, b) => a.id.localeCompare(b.id))
const expectedCursorAdapter = createCursorAdapter({ sharedRoot: g.aiRules, repoRoot, conflictOverrides })

const { sources, label, collectL2Files } = createSourceLens({ docsSystemRoot, ruleConsumerRoot, repoRoot, home, g, config })
const { createSnapshot, checkRelease, inspectL3Release } = createSnapshotter({ sources, label, collectL2Files, commonDir, manifestFile, scriptDir, ruleConsumerRoot, conflictOverrides, config })

// Cursor 本地治理适配器是否与生成的规范适配器字节一致（doctor 与 publish 共用的唯一真相）。
function cursorAdapterMatches() {
  return existsSync(g.cursorLocalGovernance) && readFileSync(g.cursorLocalGovernance, 'utf8') === expectedCursorAdapter
}

function printHelp() {
  console.log(`usage: effective-rules.mjs <--check|--write|--doctor|--self-test> [--json]

Publish and diagnose the effective local rules consumed by every registered AI entrypoint.

Options:
  --allow-tracked-rule-changes  Allow an explicitly approved dirty tracked rule surface for this maintenance run.
  --strict                      Treat locally actionable doctor warnings as blocking.`)
}

function doctor() {
  return runDoctor({ sources, label, g, config, docsSystemRoot, ruleConsumerRoot, home, manifestFile, expectedCursorAdapter, createSnapshot, checkRelease, collectL2Files, conflictOverrides, cursorAdapterMatches, json, allowTrackedRuleChanges, strict })
}

function publish() {
  const snapshot = createSnapshot()
  const blockers = []
  if (snapshot.missing.length) blockers.push(`missing: ${snapshot.missing.join(', ')}`)
  const l3Release = inspectL3Release()
  if (!l3Release.fresh) blockers.push(`L3 rule release is ${l3Release.status || 'invalid'}`)
  if (!cursorAdapterMatches()) blockers.push('Cursor adapter differs from the generated canonical adapter')
  const conflicts = resolveL2Conflicts(findL2Conflicts({ ruleConsumerRoot, collectL2Files, label }), conflictOverrides, existsSync(sources.l1[0]) ? readFileSync(sources.l1[0], 'utf8') : '')
  if (conflicts.unresolved.length) blockers.push(`unresolved tracked rules conflict: SWR versus React Query in ${conflicts.unresolved.join(', ')}`)
  if (blockers.length) {
    console.error(`cannot publish effective rules; ${blockers.join('; ')}`)
    process.exit(1)
  }
  // 指纹未变则保留旧 publishedAt：no-op 重发布不制造 git churn（同 rule-release.mjs）。
  const prior = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
  const publishedAt = prior?.fingerprint === snapshot.fingerprint && prior?.publishedAt ? prior.publishedAt : new Date().toISOString()
  const manifest = {
    version: 2,
    fingerprint: snapshot.fingerprint,
    publishedAt,
    l3RuleReleaseFingerprint: snapshot.l3RuleReleaseFingerprint,
    clientMatrix: snapshot.clientMatrix,
    fileCount: snapshot.fileCount,
    skillTargets: snapshot.skillTargets,
    files: snapshot.files,
  }
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`published effective rules ${manifest.fingerprint.slice(0, 12)} (${manifest.fileCount} files)`)
}

function printCheck(result) {
  if (json) console.log(JSON.stringify(result, null, 2))
  else if (result.fresh) console.log(`effective rules: fresh (${result.currentFingerprint.slice(0, 12)}, ${result.fileCount} files)`)
  else {
    console.error(`effective rules: ${result.status}; published=${result.publishedFingerprint || 'none'} current=${result.currentFingerprint}`)
    if (result.missing.length) console.error(`missing: ${result.missing.join(', ')}`)
    for (const key of ['added', 'changed', 'removed']) if (result.diff[key].length) console.error(`${key}: ${result.diff[key].join(', ')}`)
  }
}

// 执行器自测只断言装配层不变式（纯逻辑各 lib 自测已覆盖）：cursor 适配器指向 router、client matrix 单一指纹+全覆盖、checkRelease 形状。
async function selfTest() {
  const assert = (await import('node:assert/strict')).default
  const { createAgentClientMatrix, REQUIRED_AGENT_CLIENT_IDS, validateAgentClientMatrix } = await import('./lib/agent-clients.mjs')
  assert.equal(createCursorAdapter({ sharedRoot: '/shared', repoRoot: '/repo' }).includes('/common/rules/rule-router.md'), true)
  const matrix = createAgentClientMatrix({
    canonicalSources: { l1: ['a'], l2: ['b'], l3Router: 'r', l3Fingerprint: 'l3', conflictOverrides: [] },
    adapterLabels: { codex: 'c', claude: 'cl', cursor: 'cu', lark: 'la' },
  })
  assert.deepEqual(Object.keys(matrix), REQUIRED_AGENT_CLIENT_IDS)
  assert.equal(validateAgentClientMatrix(matrix).ok, true)
  assert.equal(new Set(Object.values(matrix).map((client) => client.sourceFingerprint)).size, 1)
  const result = checkRelease()
  assert.ok(['fresh', 'stale', 'missing', 'invalid'].includes(result.status))
  assert.equal(typeof result.currentFingerprint, 'string')
  console.log('effective-rules self-test passed.')
}

if (args.includes('--help') || args.length === 0) {
  printHelp()
  process.exit(args.length === 0 ? 1 : 0)
}
if (args.includes('--self-test')) await selfTest()
else if (args.includes('--write')) publish()
else if (args.includes('--doctor')) process.exit(doctor().ok ? 0 : 1)
else if (args.includes('--check')) {
  const result = checkRelease()
  printCheck(result)
  process.exit(result.fresh ? 0 : 1)
} else {
  printHelp()
  process.exit(1)
}
