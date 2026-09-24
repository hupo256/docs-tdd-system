#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))

export function buildKickoffArgs(projectId, legacyArgs = []) {
  if (legacyArgs.includes('--force-lite')) {
    throw new Error('Lite execution is disabled; use docs-tdd kickoff to initialize through workflowVersion 2')
  }

  const forwarded = []
  let forceV1 = false
  for (let index = 0; index < legacyArgs.length; index += 1) {
    const arg = legacyArgs[index]
    if (arg === '--force-standard') continue
    if (arg === '--force-v1') {
      forceV1 = true
      continue
    }
    if (arg === '--intent') {
      if (legacyArgs[index + 1] && !legacyArgs[index + 1].startsWith('--')) index += 1
      continue
    }
    forwarded.push(arg)
  }
  if (forceV1 && !forwarded.includes('--legacy')) forwarded.push('--legacy')

  return [join(scriptDir, '..', 'project-orchestrator.mjs'), 'kickoff', projectId, ...forwarded]
}

function selfTest() {
  assert.deepEqual(buildKickoffArgs('PR-00001', [
    '--force-standard',
    '--prd',
    'prd.md',
    '--intent',
    'copy change',
  ]), [
    join(scriptDir, '..', 'project-orchestrator.mjs'),
    'kickoff',
    'PR-00001',
    '--prd',
    'prd.md',
  ])
  assert.deepEqual(buildKickoffArgs('PR-00001', ['--force-v1', '--prd', 'prd.md']), [
    join(scriptDir, '..', 'project-orchestrator.mjs'),
    'kickoff',
    'PR-00001',
    '--prd',
    'prd.md',
    '--legacy',
  ])
  assert.throws(() => buildKickoffArgs('PR-00001', ['--force-lite']), /Lite execution is disabled/)
  console.log('kickoff-v4 compatibility self-test passed')
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    selfTest()
    return
  }

  const [projectId, ...legacyArgs] = args
  if (!projectId || projectId.startsWith('--')) {
    console.error('usage: kickoff-v4.mjs <PROJECT-ID> --prd <source> [--title <title>] [--legacy]')
    process.exit(2)
  }

  try {
    const result = spawnSync(process.execPath, buildKickoffArgs(projectId, legacyArgs), {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    process.exit(result.status ?? 1)
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
