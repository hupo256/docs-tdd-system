#!/usr/bin/env node
// One scalable self-test entry for the formal v2 workflow and its historical replay tools.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

export function vnextSelfTestScripts() {
  const topLevel = readdirSync(scriptDir)
    .filter((name) => /^vnext-.*\.mjs$/.test(name) && name !== 'vnext-self-test.mjs')
    .map((name) => join(scriptDir, name))
  const libraries = readdirSync(join(scriptDir, 'lib'))
    .filter((name) => /^vnext-.*\.mjs$/.test(name))
    .map((name) => join(scriptDir, 'lib', name))
  return [...topLevel, ...libraries].sort()
}

export function selfTest() {
  const scripts = vnextSelfTestScripts()
  assert.ok(scripts.length > 0, 'no vNext self-test scripts discovered')
  for (const script of scripts) {
    assert.match(readFileSync(script, 'utf8'), /--self-test/, `${script} must implement --self-test before joining the vNext suite`)
    const result = spawnSync(process.execPath, [script, '--self-test'], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(`${script} --self-test failed\n${result.stdout}\n${result.stderr}`)
  }
  console.log(`vnext-self-test passed (${scripts.length} scripts)`)
}

if (process.argv.includes('--self-test')) selfTest()
else selfTest()
