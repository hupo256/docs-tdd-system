#!/usr/bin/env node
// Read-only CLI for compact vNext context and session deltas.

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildVNextContext } from './lib/vnext-context.mjs'

function readJson(file) {
  return JSON.parse(readFileSync(resolve(file), 'utf8'))
}

function arg(flag) {
  const index = process.argv.indexOf(flag)
  return index === -1 ? null : process.argv[index + 1]
}

export function loadProjectContextInput(projectDir, sessionFile = null) {
  const root = resolve(projectDir)
  const workFile = join(root, 'work-item.json')
  const latestFile = join(root, 'latest-result.json')
  if (!existsSync(workFile)) throw new Error(`work-item.json not found: ${workFile}`)
  return {
    workItem: readJson(workFile),
    latestResult: existsSync(latestFile) ? readJson(latestFile) : null,
    previousSession: sessionFile ? readJson(sessionFile) : null,
  }
}

export function selfTest() {
  assert.throws(() => loadProjectContextInput('/definitely/missing/vnext-project'), /not found/)
  console.log('vnext-context CLI self-test passed')
}

if (process.argv.includes('--self-test')) selfTest()
else if (process.argv.includes('--help')) {
  console.log('usage: vnext-context.mjs (--project <v2-dir> [--session <session.json>] | --input <input.json>) [--json]')
} else {
  try {
    const inputFile = arg('--input')
    const projectDir = arg('--project')
    const input = inputFile ? readJson(inputFile) : projectDir ? loadProjectContextInput(projectDir, arg('--session')) : null
    if (!input) throw new Error('--project or --input is required')
    const result = buildVNextContext(input)
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : result.text)
  } catch (error) {
    console.error(`vNext context failed: ${error.message}`)
    process.exitCode = 2
  }
}
