#!/usr/bin/env node
// L2 冲突/重复检测：仓库级 L2 规则面里的已知冲突（SWR vs React Query）与三入口正文回潮。
//
// 从 effective-rules.mjs 抽出的纯判定逻辑（依赖注入根/配置，便于 --self-test 直测）。
// doctor 与 publish 共用；overrides/duplicates 均来自 config，不硬编码。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function declaresSWR(text) {
  return /\bUse SWR\b|\buseSWR(?:Mutation)?\s*\(|from\s+['"]swr(?:\/mutation)?['"]/.test(text)
}

/** L2 rule files that declare SWR while the repo AGENTS.md mandates React Query (returns labels). */
export function findL2Conflicts({ ruleConsumerRoot, collectL2Files, label }) {
  const reactQueryRule = join(ruleConsumerRoot, 'AGENTS.md')
  if (!existsSync(reactQueryRule) || !readFileSync(reactQueryRule, 'utf8').includes('React Query')) return []
  return collectL2Files()
    .filter((file) => declaresSWR(readFileSync(file, 'utf8')))
    .map(label)
}

/** Partition conflicts into ones cleared by an explicit local override (winner present in canonical L1) vs unresolved. */
export function resolveL2Conflicts(conflicts, overrides = [], canonicalL1 = '') {
  const resolved = []
  const unresolved = []
  for (const file of conflicts) {
    const override = overrides.find((candidate) => candidate.loserFiles.includes(file) && canonicalL1.includes(candidate.winner))
    if (override) resolved.push({ file, override })
    else unresolved.push(file)
  }
  return { resolved, unresolved }
}

// 通用检测：仓库级三入口(AGENTS.md/CLAUDE.md/.cursor/rules)重叠正文是否回潮。
// 登记在 config.repoEntryDuplicates(docs-tdd.config.default.json)，条目可随收敛进度增删，
// 避免变成永久性、无法审计的硬编码对。
export function findRepoEntryDuplicates({ ruleConsumerRoot, config }) {
  const entries = Array.isArray(config.repoEntryDuplicates) ? config.repoEntryDuplicates : []
  const violations = []
  for (const entry of entries) {
    for (const banned of Array.isArray(entry.bannedIn) ? entry.bannedIn : []) {
      const file = join(ruleConsumerRoot, banned.file)
      if (!existsSync(file)) continue
      const text = readFileSync(file, 'utf8')
      for (const substring of banned.mustNotContain || []) {
        if (text.includes(substring)) {
          violations.push({ id: entry.id, file: banned.file, canonicalFile: entry.canonicalFile, canonicalAnchor: entry.canonicalAnchor, substring })
        }
      }
    }
  }
  return violations
}

// `node lib/l2-conflict-detect.mjs --self-test`
if (process.argv[1]?.endsWith('l2-conflict-detect.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  assert.equal(declaresSWR("import useSWR from 'swr'\nuseSWR('/api', fetcher)"), true)
  assert.equal(declaresSWR('Do not introduce SWR; use React Query.'), false)
  assert.deepEqual(
    resolveL2Conflicts(['legacy-swr.mdc'], [{ id: 'server-state', winner: 'React Query', loserFiles: ['legacy-swr.mdc'] }], 'Use React Query').unresolved,
    [],
  )
  assert.deepEqual(resolveL2Conflicts(['unknown.mdc'], [], 'Use React Query').unresolved, ['unknown.mdc'])
  // 命中 override 但 winner 不在 canonical L1 → 仍 unresolved（override 需 L1 背书才生效）。
  assert.deepEqual(resolveL2Conflicts(['legacy-swr.mdc'], [{ id: 'x', winner: 'React Query', loserFiles: ['legacy-swr.mdc'] }], 'no mention').unresolved, ['legacy-swr.mdc'])
  console.log('l2-conflict-detect self-test passed.')
}
