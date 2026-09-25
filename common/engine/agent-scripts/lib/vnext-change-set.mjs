#!/usr/bin/env node
// Isolate a new increment for an existing project ID without mutating its historical work item.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function changeSetPointer(projectId, changeId) {
  if (!/^(?:PR|TR)-\d{5}$/.test(projectId || '')) throw new Error('change set requires a PR-xxxxx or TR-xxxxx projectId')
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(changeId || '')) {
    throw new Error('changeId must be 1-48 lowercase letters, numbers, or hyphens')
  }
  return { schemaVersion: 1, projectId, changeId }
}

export function activateVNextChangeSet({
  projectId,
  changeId,
  baseRoot,
  changeRoot,
  dryRun = false,
}) {
  const pointer = changeSetPointer(projectId, changeId)
  const pointerFile = join(baseRoot, 'active-change.json')
  const targetExists = existsSync(changeRoot)
  if (!dryRun) {
    mkdirSync(dirname(changeRoot), { recursive: true })
    writeFileSync(pointerFile, `${JSON.stringify(pointer, null, 2)}\n`)
  }
  return {
    projectId,
    changeId,
    pointerFile,
    changeRoot,
    targetExists,
    activated: !dryRun,
  }
}

export function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-change-set-'))
  const baseRoot = join(root, 'PR-00001')
  const changeRoot = join(baseRoot, 'changes', 'cursor-hover')
  try {
    mkdirSync(baseRoot, { recursive: true })
    writeFileSync(join(baseRoot, 'work-item.json'), '{"historical":true}\n')
    const historical = readFileSync(join(baseRoot, 'work-item.json'), 'utf8')
    const preview = activateVNextChangeSet({
      projectId: 'PR-00001', changeId: 'cursor-hover', baseRoot, changeRoot, dryRun: true,
    })
    assert.equal(preview.activated, false)
    assert.equal(existsSync(join(baseRoot, 'active-change.json')), false)
    assert.equal(existsSync(changeRoot), false)

    const activated = activateVNextChangeSet({
      projectId: 'PR-00001', changeId: 'cursor-hover', baseRoot, changeRoot,
    })
    assert.equal(activated.activated, true)
    assert.deepEqual(JSON.parse(readFileSync(activated.pointerFile, 'utf8')), changeSetPointer('PR-00001', 'cursor-hover'))
    assert.equal(readFileSync(join(baseRoot, 'work-item.json'), 'utf8'), historical)
    assert.throws(() => changeSetPointer('PR-00001', '../escape'), /changeId/)
    console.log('vnext-change-set self-test passed (dry-run is read-only; historical work item is preserved)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
