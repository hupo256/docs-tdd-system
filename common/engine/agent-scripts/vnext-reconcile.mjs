#!/usr/bin/env node
// Reconcile structured work-item surfaces against the current project worktree and persist the
// derived result separately from source-attributed requirements.

import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { reconcileSurfaces, requiresSurfaceReconciliation } from './lib/vnext-reconcile.mjs'

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function listWorktreeFiles(worktree, appPaths = []) {
  const args = ['ls-files', '--cached', '--others', '--exclude-standard', '-z']
  if (appPaths.length) args.push('--', ...appPaths)
  const result = spawnSync('git', args, { cwd: worktree, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) throw new Error((result.stderr || 'git ls-files failed').trim())
  return result.stdout.split('\0').filter(Boolean).sort()
}

export function readWorktreeText(worktree, path) {
  const file = join(worktree, path)
  if (!existsSync(file)) return ''
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return ''
  const content = readFileSync(file)
  if (content.includes(0)) return ''
  return content.toString('utf8')
}

function atomicWrite(file, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, file)
}

export function reconcileProject({ projectDir, worktree, baseRef = 'origin/online', evidence = null, outputFile = '' } = {}) {
  const workItem = readJson(join(projectDir, 'work-item.json'))
  const destination = outputFile ? resolve(outputFile) : join(projectDir, 'reconcile-result.json')
  const previousResult = existsSync(destination) ? readJson(destination) : null
  const appPaths = [...new Set((workItem.requirements || []).flatMap((requirement) => requirement.affectedSurfaces || [])
    .map((surface) => surface.codeLocator?.app).filter(Boolean))]
  const treeFiles = listWorktreeFiles(worktree, appPaths)
  const fileContents = Object.fromEntries(treeFiles.map((path) => [path, readWorktreeText(worktree, path)]))
  const codeState = codeFingerprint(worktree, baseRef, {
    scopePaths: evidence?.codeFingerprint?.scopeMode === 'path-set-v1' ? evidence.codeFingerprint.scopePaths : null,
  })
  const result = reconcileSurfaces({
    workItem,
    codeState,
    treeFiles,
    fileContents,
    evidenceFacts: evidence?.facts || [],
    previousResult,
  })
  atomicWrite(destination, result)
  return { ...result, outputFile: destination }
}

function selfTest() {
  assert.equal(readWorktreeText('/missing', 'file.ts'), '')
  assert.equal(requiresSurfaceReconciliation({ requirements: [] }), false)
  const root = mkdtempSync(join(tmpdir(), 'vnext-reconcile-command-'))
  const worktree = join(root, 'worktree')
  const projectDir = join(root, 'project')
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: worktree, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  try {
    mkdirSync(join(worktree, 'apps/web/src'), { recursive: true })
    mkdirSync(projectDir, { recursive: true })
    git('init', '-q')
    git('config', 'user.email', 'fixture@example.com')
    git('config', 'user.name', 'Fixture')
    writeFileSync(join(worktree, 'apps/web/src/Dialog.tsx'), 'export function Dialog() { return null }\n')
    writeFileSync(join(worktree, 'apps/web/src/Page.tsx'), "import { Dialog } from './Dialog'; export function Page() { return <Dialog /> }\n")
    git('add', '.')
    git('commit', '-qm', 'fixture')
    const workItem = {
      schemaVersion: 1,
      workflowVersion: 2,
      projectId: 'PR-00001',
      deliveryTarget: { app: 'apps/web', history: [] },
      requirements: [{
        requirementId: 'R-001', status: 'doing', statement: 'Show dialog.', evidencePlan: [],
        affectedSurfaces: [
          { surfaceId: 'S-001', disposition: 'implement', codeLocator: { kind: 'component', app: 'apps/web', symbol: 'Dialog', role: 'provider' } },
          { surfaceId: 'S-002', disposition: 'implement', codeLocator: { kind: 'component', app: 'apps/web', symbol: 'Page', role: 'consumer' }, wiring: { role: 'consumer', dependsOn: ['S-001'], wiringEvidence: 'render' } },
        ],
      }],
    }
    writeFileSync(join(projectDir, 'work-item.json'), JSON.stringify(workItem))
    const first = reconcileProject({ projectDir, worktree, baseRef: 'HEAD' })
    assert.equal(first.rollup.overall, 'ready-for-human-acceptance')
    assert.equal(readJson(join(projectDir, 'reconcile-result.json')).surfaces.length, 2)
    writeFileSync(join(worktree, 'apps/web/src/Page.tsx'), 'export function Page() { return null }\n')
    const second = reconcileProject({ projectDir, worktree, baseRef: 'HEAD' })
    assert.equal(second.rollup.overall, 'partially-implemented')
    assert.equal(second.surfaces.find((surface) => surface.surfaceId === 'S-002').wiringStatus, 'missing')
    console.log('vnext-reconcile command self-test passed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else try {
    const projectDir = resolve(argumentValue('--project'))
    const worktree = resolve(argumentValue('--worktree'))
    if (!argumentValue('--project') || !argumentValue('--worktree')) throw new Error('reconcile requires --project and --worktree')
    const evidenceFile = argumentValue('--evidence')
    const result = reconcileProject({
      projectDir,
      worktree,
      baseRef: argumentValue('--base') || 'origin/online',
      evidence: evidenceFile ? readJson(resolve(evidenceFile)) : null,
      outputFile: argumentValue('--out'),
    })
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = ['implementing', 'partially-implemented'].includes(result.rollup.overall) ? 1 : 0
  } catch (error) {
    console.error(`vNext reconcile failed: ${error.message}`)
    process.exitCode = 2
  }
}
