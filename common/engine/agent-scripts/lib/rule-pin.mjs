#!/usr/bin/env node
// 业务项目的规则版本 pin：把「项目验收所依据的规则政策版本」钉在项目 manifest 里，
// 让共享规则仓的后续演进不再追溯性地掐停在飞项目。
//
// pin = { commit, policyFingerprint, upgradeMode }：
//   - policyFingerprint 是身份（session 校验比它，而非全局最新），docs_tdd 抬高 latest ≠ 项目失效；
//   - commit 供 pinned-source 按 commit 不可变读取规则内容；
//   - upgradeMode 'explicit'：只有显式 `docs-tdd rules upgrade` 才迁移，发布新规则只提示不强制。
//
// 旧项目首次运行命令时惰性生成 pin（取当前已发布 release 的 commit/policyFingerprint），
// 不阻断、仅 stderr 提示，保证存量项目立即解套。

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { docsSystemRoot, resolveProjectRoot } from './roots.mjs'
import { currentDocsCommit } from './pinned-source.mjs'

const releaseManifestFile = join(docsSystemRoot, 'common', 'rule-release.json')

function readJsonSafe(file) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
  } catch {
    return null
  }
}

/** Current published release identity for pinning: precise fields when the manifest is v2, coarse fallback otherwise. */
export function latestReleasePin(manifest = readJsonSafe(releaseManifestFile)) {
  const commit = manifest?.commit || currentDocsCommit()
  // v2 manifest carries policyFingerprint; pre-v2 falls back to the combined fingerprint as a coarse identity.
  const policyFingerprint = manifest?.policyFingerprint || manifest?.fingerprint || 'unpinned'
  return { commit: commit || null, policyFingerprint }
}

function manifestPath(projectId) {
  return join(resolveProjectRoot(projectId), 'agent/project-manifest.json')
}

/**
 * Resolve a project's rule pin. Reads `rulePolicy` from the project manifest; when absent,
 * lazily pins to the current published release and (by default) persists it, so legacy
 * projects keep flowing instead of being blocked by docs_tdd's own evolution.
 */
export function resolveRulePin(projectId, { persist = true } = {}) {
  const file = manifestPath(projectId)
  const manifest = readJsonSafe(file)
  const existing = manifest?.rulePolicy
  if (existing?.policyFingerprint) {
    return { commit: existing.commit || null, policyFingerprint: existing.policyFingerprint, upgradeMode: existing.upgradeMode || 'explicit', source: 'manifest' }
  }
  const latest = latestReleasePin()
  const pin = { commit: latest.commit, policyFingerprint: latest.policyFingerprint, upgradeMode: 'explicit' }
  if (persist && manifest) {
    manifest.rulePolicy = { ...pin, pinnedAt: new Date().toISOString() }
    writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
    console.error(`[rule-pin] ${projectId} lazily pinned to policy ${pin.policyFingerprint.slice(0, 12)}${pin.commit ? ` @ ${pin.commit.slice(0, 12)}` : ''}; run \`docs-tdd rules upgrade ${projectId}\` to adopt newer rules`)
  }
  return { ...pin, source: 'lazy' }
}

/** Explicitly move a project's pin onto the current published release. Returns the new pin. */
export function upgradeRulePin(projectId) {
  const file = manifestPath(projectId)
  const manifest = readJsonSafe(file)
  if (!manifest) throw new Error(`project manifest not found: ${projectId}`)
  const latest = latestReleasePin()
  const previous = manifest.rulePolicy || null
  manifest.rulePolicy = { commit: latest.commit, policyFingerprint: latest.policyFingerprint, upgradeMode: 'explicit', pinnedAt: new Date().toISOString() }
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return { previous, next: manifest.rulePolicy }
}

// `node lib/rule-pin.mjs --self-test`
if (process.argv[1] && process.argv[1].endsWith('rule-pin.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  const latest = latestReleasePin({ commit: 'abc123', policyFingerprint: 'pol' })
  assert.deepEqual(latest, { commit: 'abc123', policyFingerprint: 'pol' })
  const coarse = latestReleasePin({ fingerprint: 'combined' })
  assert.equal(coarse.policyFingerprint, 'combined', 'pre-v2 manifest falls back to combined fingerprint')
  console.log('rule-pin self-test passed.')
}
