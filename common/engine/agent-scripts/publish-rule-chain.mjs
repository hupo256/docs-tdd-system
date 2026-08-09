#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot, consumerRoot: repoRoot, config } = resolveRoots()
const args = process.argv.slice(2)
const projectId = args.find((arg) => new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(arg)) || ''
const scenarioIndex = args.indexOf('--scenario')
const scenario = scenarioIndex >= 0 ? args[scenarioIndex + 1] : 'docs_tdd_maintenance'
const allowTrackedRuleChanges = args.includes('--allow-tracked-rule-changes')
const manifests = [join(docsSystemRoot, 'common/rule-release.json'), join(docsSystemRoot, 'common/effective-rules.json')]

function captureFiles(files) {
  return new Map(files.map((file) => [file, existsSync(file) ? readFileSync(file) : null]))
}

function restoreFiles(snapshot) {
  for (const [file, content] of snapshot) {
    if (content === null) {
      if (existsSync(file)) unlinkSync(file)
    } else writeFileSync(file, content)
  }
}

function runStep(label, commandArgs, cwd = repoRoot) {
  console.log(`\n=== rule release: ${label} ===`)
  const result = spawnSync(process.execPath, commandArgs, {
    cwd,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

function publish() {
  const snapshot = captureFiles(manifests)
  const steps = [
    ['publish L3', [join(scriptDir, 'rule-release.mjs'), '--write']],
    ['publish effective rules', [join(scriptDir, 'effective-rules.mjs'), '--write']],
    ['doctor', [join(scriptDir, 'effective-rules.mjs'), '--doctor', ...(allowTrackedRuleChanges ? ['--allow-tracked-rule-changes'] : [])]],
    ['golden regression', [join(scriptDir, 'golden-run.mjs')]],
  ]
  if (projectId) steps.push(['context smoke', [join(scriptDir, 'docs-tdd.mjs'), 'context', projectId, scenario]])

  for (const [label, commandArgs] of steps) {
    const status = runStep(label, commandArgs)
    if (status !== 0) {
      restoreFiles(snapshot)
      console.error(`\nrule release: BLOCK at ${label}; restored both manifests`)
      process.exit(status)
    }
  }
  console.log('\nrule release: PASS — L3/effective manifests published as one verified chain')
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'docs-tdd-rule-release-'))
  const existing = join(dir, 'existing.json')
  const missing = join(dir, 'missing.json')
  writeFileSync(existing, 'before')
  const snapshot = captureFiles([existing, missing])
  writeFileSync(existing, 'after')
  writeFileSync(missing, 'created')
  restoreFiles(snapshot)
  assert.equal(readFileSync(existing, 'utf8'), 'before')
  assert.equal(existsSync(missing), false)
  rmSync(dir, { recursive: true, force: true })
  console.log('publish-rule-chain self-test passed.')
}

if (args.includes('--help')) {
  console.log('usage: publish-rule-chain.mjs [PR-01234] [--scenario <scenario>] [--allow-tracked-rule-changes] [--self-test]')
} else if (args.includes('--self-test')) selfTest()
else publish()
