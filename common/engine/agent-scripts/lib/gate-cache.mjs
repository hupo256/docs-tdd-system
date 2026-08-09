// run-project-gate 的指纹/缓存/历史 IO 层：代码+规则指纹、gate 缓存指纹（含项目文件内容）、
// 成功历史追加。纯 IO（读项目文件 + git 指纹），逻辑判定在 lib/gate-payload.mjs。

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { codeFingerprint } from './fingerprint.mjs'

// 代码指纹（git）+ 规则集/发布/生效规则指纹：任一变化都让 gate 缓存失效。
export function createFingerprint({ callerCwd, config, docsRoot }) {
  const code = codeFingerprint(callerCwd, config.baseRef || 'origin/online')
  const readJson = (rel, fallback) => {
    const file = join(docsRoot, rel)
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback
  }
  const ruleset = readJson('common/rules/ruleset.json', { version: 'unknown' })
  const release = readJson('common/rule-release.json', { fingerprint: 'unknown' })
  const effectiveRules = readJson('common/effective-rules.json', { fingerprint: 'unknown' })
  return {
    headSha: code.headSha,
    baseSha: code.baseSha,
    dirtyHash: code.dirtyHash,
    dirtyFileCount: code.dirtyFileCount,
    untrackedFileCount: code.untrackedFileCount,
    rulesetVersion: ruleset.version,
    ruleReleaseFingerprint: release.fingerprint,
    effectiveRulesFingerprint: effectiveRules.fingerprint,
  }
}

const CACHE_TRACKED_FILES = [
  'product/00-feature-inventory.md', 'product/02-technical-design.md', 'product/03-api-contract.md',
  'product/04-frontend-tasks.md', 'product/06-collaboration.md', 'agent/project-manifest.json',
  'agent/prd-source-manifest.json', 'agent/msw-manifest.json', 'agent/assumptions.json',
  'agent/rule-waivers.json', 'agent/stage-status.json', 'agent/gate-history.json',
  'agent/blockers.json', 'agent/code-review.json', 'agent/acceptance-results.json', 'agent/delivery-status.json',
]

export function gateCacheFingerprint(projectDir, { projectId, gate, callerCwd, config, docsRoot }) {
  const fingerprint = createFingerprint({ callerCwd, config, docsRoot })
  const projectFiles = CACHE_TRACKED_FILES
    .map((file) => {
      const absolute = join(projectDir, file)
      return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : `${file}\nmissing`
    })
    .join('\n')
  return createHash('sha256').update(`gate-v1\n${projectId}\n${gate}\n${JSON.stringify(fingerprint)}\n${projectFiles}`).digest('hex').slice(0, 16)
}

export function appendGateHistory(projectDir, payload, evidenceFile, { repoRoot, onError }) {
  const historyFile = join(projectDir, 'agent/gate-history.json')
  let history = { projectId: payload.projectId, runs: [] }
  if (existsSync(historyFile)) {
    try {
      history = JSON.parse(readFileSync(historyFile, 'utf8'))
    } catch {
      onError(`invalid gate history: ${relative(repoRoot, historyFile)}`)
    }
  }
  const runs = Array.isArray(history.runs) ? history.runs : []
  runs.push({
    gate: payload.gate,
    ok: payload.ok,
    generatedAt: payload.generatedAt,
    tool: payload.tool,
    summary: payload.summary,
    fingerprint: payload.fingerprint,
    evidence: relative(projectDir, evidenceFile),
  })
  writeFileSync(historyFile, `${JSON.stringify({ projectId: payload.projectId, runs }, null, 2)}\n`)
}
