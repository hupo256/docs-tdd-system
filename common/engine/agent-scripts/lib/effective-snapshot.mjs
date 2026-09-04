#!/usr/bin/env node
// effective rules 快照 + release 校验（读侧）：从 effective-rules.mjs 抽出的纯逻辑 + deps 绑定工厂。
//
// 纯函数（effectiveFingerprint / compareFiles / stableSettingsInput）独立导出直测；
// 需要 sources/label/manifest 路径的读逻辑经 createSnapshotter(deps) 注入绑定，供执行器与 doctor 共用。

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { createAgentClientMatrix } from './agent-clients.mjs'

const SETTINGS_LABEL = '~/.claude/settings.json'

// consumerWorktree 只作诊断字段，不进指纹（否则同一规则集在不同 worktree 会算出不同指纹）。
export function effectiveFingerprint(composition) {
  const { consumerWorktree: _diagnosticOnly, ...portableComposition } = composition
  return createHash('sha256').update(JSON.stringify(portableComposition)).digest('hex')
}

export function compareFiles(published = {}, current = {}) {
  return {
    added: Object.keys(current)
      .filter((file) => !(file in published))
      .sort(),
    changed: Object.keys(current)
      .filter((file) => file in published && current[file] !== published[file])
      .sort(),
    removed: Object.keys(published)
      .filter((file) => !(file in current))
      .sort(),
  }
}

// settings.json 只指纹化 hooks，避免 permissions 等会话态触发无意义的重新发布。
export function stableSettingsInput(rawText) {
  try {
    return JSON.stringify({ hooks: JSON.parse(rawText).hooks ?? null })
  } catch {
    return rawText
  }
}

export function stableRuleInjectionPolicy(policy = {}) {
  const sortedStrings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string').sort() : [])
  return {
    blockingRuleGlobs: sortedStrings(policy.blockingRuleGlobs),
    advisoryRuleGlobs: sortedStrings(policy.advisoryRuleGlobs),
    advisoryCatalogBudgetBytes: Number.isFinite(policy.advisoryCatalogBudgetBytes) ? policy.advisoryCatalogBudgetBytes : null,
  }
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

/**
 * Bind the snapshot/release-check readers to the resolved roots + source lens.
 * `deps = { sources, label, collectL2Files, commonDir, manifestFile, scriptDir, ruleConsumerRoot, conflictOverrides, config }`
 */
export function createSnapshotter({ sources, label, collectL2Files, commonDir, manifestFile, scriptDir, ruleConsumerRoot, conflictOverrides, config }) {
  function hashFile(file) {
    const raw = readFileSync(file)
    if (label(file) === SETTINGS_LABEL) return createHash('sha256').update(stableSettingsInput(raw.toString('utf8'))).digest('hex')
    return createHash('sha256').update(raw).digest('hex')
  }

  function readL3Release() {
    const file = join(commonDir, 'rule-release.json')
    return existsSync(file) ? readJson(file) : null
  }

  function createClientMatrix(l3Fingerprint) {
    const canonicalSources = {
      l1: sources.l1.map(label),
      l2: collectL2Files().map(label),
      l3Router: `${config.docsMountPath}/common/rules/rule-router.md`,
      l3Fingerprint,
      conflictOverrides,
    }
    return createAgentClientMatrix({
      canonicalSources,
      adapterLabels: {
        codex: label(sources.adapters[0]),
        claude: label(sources.adapters[1]),
        cursor: label(sources.adapters[2]),
        lark: sources.runtimeAdapters.map(label).join(' + '),
      },
    })
  }

  function inspectL3Release() {
    const result = spawnSync(process.execPath, [join(scriptDir, 'rule-release.mjs'), '--check', '--json'], { cwd: ruleConsumerRoot, encoding: 'utf8', stdio: 'pipe' })
    try {
      return { ...JSON.parse(result.stdout), exitCode: result.status ?? 1 }
    } catch (error) {
      return { fresh: false, status: 'invalid', parseError: error.message, exitCode: result.status ?? 1 }
    }
  }

  function createSnapshot() {
    const requiredFiles = [...sources.l1, ...sources.adapters, ...sources.runtimeAdapters, ...collectL2Files()]
    const missing = requiredFiles.filter((file) => !existsSync(file)).map(label)
    const files = {}
    for (const file of requiredFiles.filter(existsSync).sort((a, b) => label(a).localeCompare(label(b)))) {
      files[label(file)] = hashFile(file)
    }
    const l3 = readL3Release()
    const clientMatrix = createClientMatrix(l3?.fingerprint || null)
    const composition = {
      consumerWorktree: ruleConsumerRoot,
      files,
      l3RuleReleaseFingerprint: l3?.fingerprint || null,
      clientMatrix,
      ruleInjectionPolicy: stableRuleInjectionPolicy(config.ruleInjection),
      skillTargets: Object.fromEntries(sources.skillEntries.map((entry) => [label(entry), existsSync(entry) ? label(realpathSync(entry)) : null])),
    }
    return {
      fingerprint: effectiveFingerprint(composition),
      fileCount: Object.keys(files).length,
      files,
      l3RuleReleaseFingerprint: composition.l3RuleReleaseFingerprint,
      clientMatrix,
      ruleInjectionPolicy: composition.ruleInjectionPolicy,
      skillTargets: composition.skillTargets,
      missing,
    }
  }

  function checkRelease() {
    const current = createSnapshot()
    const l3Release = inspectL3Release()
    let published = null
    let parseError = null
    if (existsSync(manifestFile)) {
      try {
        published = readJson(manifestFile)
      } catch (error) {
        parseError = error.message
      }
    }
    const diff = compareFiles(published?.files, current.files)
    const valid = Boolean(published && !parseError && published.version === 2 && published.files && published.clientMatrix)
    const fresh = Boolean(
      valid &&
        l3Release.fresh &&
        current.missing.length === 0 &&
        published.fingerprint === current.fingerprint &&
        published.fileCount === current.fileCount &&
        published.l3RuleReleaseFingerprint === current.l3RuleReleaseFingerprint &&
        JSON.stringify(published.clientMatrix) === JSON.stringify(current.clientMatrix) &&
        JSON.stringify(published.ruleInjectionPolicy) === JSON.stringify(current.ruleInjectionPolicy) &&
        JSON.stringify(published.skillTargets) === JSON.stringify(current.skillTargets) &&
        Object.values(diff).every((items) => items.length === 0),
    )
    return {
      fresh,
      status: !published ? 'missing' : parseError || !valid ? 'invalid' : fresh ? 'fresh' : 'stale',
      publishedFingerprint: published?.fingerprint || null,
      currentFingerprint: current.fingerprint,
      l3RuleReleaseFingerprint: current.l3RuleReleaseFingerprint,
      clientMatrix: current.clientMatrix,
      fileCount: current.fileCount,
      missing: current.missing,
      diff,
      parseError,
      l3Release: {
        fresh: Boolean(l3Release.fresh),
        status: l3Release.status || 'invalid',
        publishedFingerprint: l3Release.publishedFingerprint || null,
        currentFingerprint: l3Release.currentFingerprint || null,
      },
    }
  }

  return { hashFile, readL3Release, createClientMatrix, inspectL3Release, createSnapshot, checkRelease }
}

// `node lib/effective-snapshot.mjs --self-test`
if (process.argv[1]?.endsWith('effective-snapshot.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  assert.deepEqual(compareFiles({ a: '1', b: '2' }, { b: '3', c: '4' }), { added: ['c'], changed: ['b'], removed: ['a'] })
  // effectiveFingerprint 与 consumerWorktree 无关（可移植）。
  assert.equal(effectiveFingerprint({ consumerWorktree: '/a', files: { a: '1' } }), effectiveFingerprint({ consumerWorktree: '/b', files: { a: '1' } }))
  // stableSettingsInput：只认 hooks 变化，忽略 permissions 等易变态。
  const base = JSON.stringify({ hooks: { PostToolUse: [1] }, permissions: { allow: ['a'] } })
  const permChanged = JSON.stringify({ hooks: { PostToolUse: [1] }, permissions: { allow: ['a', 'b'] } })
  const hooksChanged = JSON.stringify({ hooks: { PostToolUse: [2] }, permissions: { allow: ['a'] } })
  assert.equal(stableSettingsInput(base), stableSettingsInput(permChanged))
  assert.notEqual(stableSettingsInput(base), stableSettingsInput(hooksChanged))
  assert.deepEqual(stableRuleInjectionPolicy({ advisoryRuleGlobs: ['b', 'a'], blockingRuleGlobs: ['z'], advisoryCatalogBudgetBytes: 12 }), { blockingRuleGlobs: ['z'], advisoryRuleGlobs: ['a', 'b'], advisoryCatalogBudgetBytes: 12 })
  console.log('effective-snapshot self-test passed.')
}
