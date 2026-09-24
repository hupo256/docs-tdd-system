#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptPath = fileURLToPath(import.meta.url)

export async function executeLitePathV4() {
  throw new Error('Lite execution is disabled; use docs-tdd kickoff for the standard source-bound workflow')
}

export async function selfTest() {
  const sandbox = mkdtempSync(join(tmpdir(), 'docs-tdd-disabled-lite-'))
  try {
    const docsRoot = join(sandbox, 'docs')
    await assert.rejects(
      executeLitePathV4('PR-99998', 'prd', 'intent', { docsRoot, repoRoot: sandbox }),
      /Lite execution is disabled/,
    )
    assert.equal(existsSync(join(docsRoot, 'prds', 'PR-99998')), false)

    const cli = spawnSync(process.execPath, [scriptPath, '--exec', 'PR-99999', 'prd', 'intent'], {
      cwd: sandbox,
      encoding: 'utf8',
      stdio: 'pipe',
    })
    assert.notEqual(cli.status, 0)
    assert.equal(existsSync(join(sandbox, 'apps/web/docs_tdd/prds/PR-99999')), false)
    console.log('lite-path-executor-v4 self-test passed (execution disabled without writes)')
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest().catch((error) => {
      console.error(error)
      process.exit(1)
    })
    return
  }

  if (process.argv.includes('--exec')) {
    const projectId = process.argv[process.argv.indexOf('--exec') + 1] || ''
    executeLitePathV4(projectId).catch((error) => {
      console.error(error.message)
      process.exit(2)
    })
    return
  }

  console.error('Lite execution is disabled. Use docs-tdd kickoff <PROJECT-ID> --prd <source>.')
  process.exit(2)
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) main()
