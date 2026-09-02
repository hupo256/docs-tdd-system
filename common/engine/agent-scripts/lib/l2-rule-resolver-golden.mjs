#!/usr/bin/env node

import assert from 'node:assert/strict'
import { renderRuleContext, resolveRulePack } from './l2-rule-resolver.mjs'
import { resolveRoots } from './roots.mjs'

const { consumerRoot, consumerWorktree, docsSystemRoot, config } = resolveRoots()
const worktree = consumerWorktree && consumerWorktree !== docsSystemRoot ? consumerWorktree : consumerRoot

function verifyCase(target, expectedCount) {
  const pack = resolveRulePack({
    worktree,
    targetFiles: [target],
    conflictOverrides: config.ruleConflictOverrides,
  })
  const context = renderRuleContext(pack)
  assert.equal(pack.matchedRules.length, expectedCount, `${target} rule count`)
  assert.deepEqual(pack.unscopedRules, ['async-api-routes.mdc'], `${target} unscoped rules`)
  assert.equal(new Set(context.ruleHashes).size, context.ruleHashes.length, `${target} hashes are unique`)
  for (const rule of pack.matchedRules) {
    assert.ok(context.text.includes(rule.body), `${target} contains ${rule.relativePath} verbatim`)
  }
  return {
    target,
    count: expectedCount,
    bytes: context.byteLength,
    fingerprint: pack.fingerprint,
  }
}

export function runGolden() {
  const results = [verifyCase('apps/web/src/Foo.tsx', 47), verifyCase('apps/web/src/useFoo.ts', 34), verifyCase('apps/web/src/foo.ts', 30), verifyCase('README.md', 3)]
  const tsx = resolveRulePack({
    worktree,
    targetFiles: ['apps/web/src/Foo.tsx'],
    conflictOverrides: config.ruleConflictOverrides,
  })
  assert.ok(
    tsx.matchedRules.some((rule) => rule.relativePath === 'architecture-avoid-boolean-props.mdc'),
    'tsx architecture rule',
  )
  assert.ok(!tsx.matchedRules.some((rule) => rule.relativePath === 'client-localstorage-schema.mdc'), 'tsx excludes use*.ts rule')
  const useTs = resolveRulePack({
    worktree,
    targetFiles: ['apps/web/src/useFoo.ts'],
    conflictOverrides: config.ruleConflictOverrides,
  })
  assert.ok(
    useTs.matchedRules.some((rule) => rule.relativePath === 'client-localstorage-schema.mdc'),
    'use*.ts rule',
  )
  assert.ok(
    useTs.conflictOverrides.some((override) => override.id === 'fameex-server-state'),
    'conflict override is fingerprinted',
  )
  console.log(JSON.stringify({ ok: true, worktree, cases: results }, null, 2))
}

if (process.argv[1]?.endsWith('l2-rule-resolver-golden.mjs')) runGolden()
