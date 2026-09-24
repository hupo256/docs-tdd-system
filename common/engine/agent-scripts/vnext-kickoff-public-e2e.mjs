#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { docsSystemRoot, resolveProjectRoot } from './lib/roots.mjs'

const scriptDir = new URL('.', import.meta.url)
const docsTddCli = fileURLToPath(new URL('./docs-tdd.mjs', scriptDir))
const kickoffCompat = fileURLToPath(new URL('./lib/kickoff-v4.mjs', scriptDir))
const scriptPath = fileURLToPath(import.meta.url)

function allocateProjectId(allocated) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const projectId = `PR-${randomInt(10000, 100000)}`
    if (!allocated.has(projectId) && !existsSync(resolveProjectRoot(projectId))) {
      allocated.add(projectId)
      return projectId
    }
  }
  throw new Error('unable to allocate an unused kickoff E2E project ID')
}

function run(command, args, { cwd, env }) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 45000,
  })
  if (result.error) throw result.error
  return result
}

function outputJson(result) {
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

function removeOwnedProject(projectId, marker) {
  const projectDir = resolveProjectRoot(projectId)
  const readme = join(projectDir, 'README.md')
  if (!existsSync(readme)) return
  if (!readFileSync(readme, 'utf8').includes(marker)) return
  rmSync(projectDir, { recursive: true, force: true })
}

export function selfTest() {
  const sandbox = mkdtempSync(join(tmpdir(), 'vnext-kickoff-public-e2e-'))
  const sourceRoot = mkdtempSync(join(docsSystemRoot, '.kickoff-public-e2e-'))
  const allocated = new Set()
  const projects = []
  const nonce = `${process.pid}-${randomInt(100000, 1000000)}`
  const source = join(sourceRoot, 'prd.md')
  const outsideSource = join(sandbox, 'outside.md')
  const configPath = join(sandbox, 'docs-tdd.config.json')

  try {
    mkdirSync(sandbox, { recursive: true })
    const gitInit = spawnSync('git', ['init', '-q'], { cwd: sandbox, encoding: 'utf8' })
    assert.equal(gitInit.status, 0, gitInit.stderr)
    mkdirSync(join(sandbox, 'apps/web'), { recursive: true })
    symlinkSync(docsSystemRoot, join(sandbox, 'apps/web/docs_tdd'), 'dir')
    for (const [key, value] of [['user.email', 'kickoff-e2e@example.invalid'], ['user.name', 'Kickoff E2E']]) {
      const result = spawnSync('git', ['config', key, value], { cwd: sandbox, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
    }

    const config = {
      consumerRoot: sandbox,
      docsMountPath: 'apps/web/docs_tdd',
      larkOutputDir: 'apps/web/docs_tdd/prds/${projectId}/inbox/lark-sync',
    }
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    writeFileSync(source, '# Kickoff E2E\n\nRender the requested widget.\n')
    writeFileSync(outsideSource, '# Outside source\n\nMust not be read.\n')
    const outsideSourceBefore = readFileSync(outsideSource, 'utf8')
    const env = {
      ...process.env,
      DOCS_TDD_CONFIG: configPath,
      DOCS_TDD_CODEX_BIN: join(sandbox, 'missing-codex'),
    }

    const v2Project = allocateProjectId(allocated)
    const v2Marker = `kickoff-public-e2e-${nonce}-v2`
    projects.push({ projectId: v2Project, marker: v2Marker })
    const compatible = outputJson(run(kickoffCompat, [
      v2Project, '--prd', source, '--title', v2Marker, '--intent', 'test compatibility forwarding',
    ], { cwd: sandbox, env }))
    assert.equal(compatible.workflowVersion, 2)
    const workItemPath = join(resolveProjectRoot(v2Project), 'work-item.json')
    const firstWorkItem = JSON.parse(readFileSync(workItemPath, 'utf8'))
    assert.equal(firstWorkItem.workflowVersion, 2)
    assert.equal(firstWorkItem.requirements.length, 0)

    const repeated = outputJson(run(docsTddCli, [
      'kickoff', v2Project, '--prd', source, '--title', v2Marker,
    ], { cwd: sandbox, env }))
    assert.equal(repeated.workflowVersion, 2)
    assert.equal(repeated.idempotent, true)
    assert.deepEqual(JSON.parse(readFileSync(workItemPath, 'utf8')), firstWorkItem)

    const alternativeSource = join(sourceRoot, 'alternative-prd.md')
    writeFileSync(alternativeSource, '# Alternative source\n\nThis source must not be ignored.\n')
    const sourceSwitch = run(docsTddCli, [
      'kickoff', v2Project, '--prd', alternativeSource, '--title', v2Marker,
    ], { cwd: sandbox, env })
    assert.notEqual(sourceSwitch.status, 0)
    assert.match(sourceSwitch.stderr, /source differs from the source bound/)
    assert.deepEqual(JSON.parse(readFileSync(workItemPath, 'utf8')), firstWorkItem)

    writeFileSync(source, '# Kickoff E2E\n\nRender the requested widget.\nPreserve the extracted requirement.\n')
    const sourceChanged = run(docsTddCli, [
      'kickoff', v2Project, '--prd', source, '--title', v2Marker,
    ], { cwd: sandbox, env })
    assert.notEqual(sourceChanged.status, 0)
    const sourceChangedResult = JSON.parse(sourceChanged.stdout)
    assert.equal(sourceChangedResult.status, 'blocked')
    assert.equal(sourceChangedResult.nextAction, 'source_update')
    assert.deepEqual(JSON.parse(readFileSync(workItemPath, 'utf8')), firstWorkItem)
    writeFileSync(source, '# Kickoff E2E\n\nRender the requested widget.\n')
    writeFileSync(workItemPath, '{"malformed":')
    const invalidWorkItem = run(docsTddCli, [
      'kickoff', v2Project, '--prd', source, '--title', v2Marker,
    ], { cwd: sandbox, env })
    assert.notEqual(invalidWorkItem.status, 0)
    assert.equal(JSON.parse(invalidWorkItem.stdout).nextAction, 'inspect_work_item')
    assert.equal(readFileSync(workItemPath, 'utf8'), '{"malformed":')

    const liteProject = allocateProjectId(allocated)
    const disabledLite = run(kickoffCompat, [
      liteProject, '--prd', source, '--title', `kickoff-public-e2e-${nonce}-lite`, '--force-lite',
    ], { cwd: sandbox, env })
    assert.notEqual(disabledLite.status, 0)
    assert.equal(existsSync(resolveProjectRoot(liteProject)), false)

    const legacyProject = allocateProjectId(allocated)
    const legacyMarker = `kickoff-public-e2e-${nonce}-legacy`
    projects.push({ projectId: legacyProject, marker: legacyMarker })
    const legacy = outputJson(run(kickoffCompat, [
      legacyProject, '--prd', source, '--title', legacyMarker, '--force-v1',
    ], { cwd: sandbox, env }))
    assert.equal(legacy.workflowVersion, 1)
    const legacyReadmePath = join(resolveProjectRoot(legacyProject), 'README.md')
    assert.equal(existsSync(join(resolveProjectRoot(legacyProject), 'work-item.json')), false)

    const legacyRepeat = outputJson(run(docsTddCli, [
      'kickoff', legacyProject, '--prd', source, '--title', legacyMarker,
    ], { cwd: sandbox, env }))
    assert.equal(legacyRepeat.workflowVersion, 1)
    assert.equal(readFileSync(legacyReadmePath, 'utf8').includes(legacyMarker), true)
    assert.equal(existsSync(join(resolveProjectRoot(legacyProject), 'work-item.json')), false)

    const outsideProject = allocateProjectId(allocated)
    const outsideMarker = `kickoff-public-e2e-${nonce}-outside`
    projects.push({ projectId: outsideProject, marker: outsideMarker })
    const outside = run(docsTddCli, [
      'kickoff', outsideProject, '--prd', outsideSource, '--title', outsideMarker,
    ], { cwd: sandbox, env })
    assert.notEqual(outside.status, 0)
    const outsideResult = JSON.parse(outside.stdout)
    assert.equal(outsideResult.status, 'blocked')
    assert.match(outsideResult.blocker, /must stay inside/)
    assert.equal(existsSync(join(resolveProjectRoot(outsideProject), 'work-item.json')), false)
    assert.equal(readFileSync(outsideSource, 'utf8'), outsideSourceBefore)

    const missingProject = allocateProjectId(allocated)
    const missingMarker = `kickoff-public-e2e-${nonce}-missing-source`
    projects.push({ projectId: missingProject, marker: missingMarker })
    const missingSource = run(docsTddCli, [
      'kickoff', missingProject, '--prd', join(sourceRoot, 'missing.md'), '--title', missingMarker,
    ], { cwd: sandbox, env })
    assert.notEqual(missingSource.status, 0)
    const missingSourceResult = JSON.parse(missingSource.stdout)
    assert.equal(missingSourceResult.status, 'blocked')
    assert.equal(missingSourceResult.nextAction, 'sync_prd')
    assert.equal(existsSync(join(resolveProjectRoot(missingProject), 'work-item.json')), false)

    const invalidId = run(docsTddCli, ['kickoff', '../outside', '--prd', source], { cwd: sandbox, env })
    assert.notEqual(invalidId.status, 0)

    const runProject = allocateProjectId(allocated)
    const runMarker = `kickoff-public-e2e-${nonce}-run`
    projects.push({ projectId: runProject, marker: runMarker })
    const firstRun = run(docsTddCli, [
      'run', runProject, '--prd', source, '--title', runMarker, '--client', 'codex',
    ], { cwd: sandbox, env })
    assert.notEqual(firstRun.status, 0)
    const firstRunState = JSON.parse(firstRun.stdout)
    assert.equal(firstRunState.workflowVersion, 2)
    assert.equal(firstRunState.status, 'failed-infrastructure')
    assert.equal(firstRunState.nextAction, 'extract-requirements')
    const runWorkItemPath = join(resolveProjectRoot(runProject), 'work-item.json')
    const runWorkItem = JSON.parse(readFileSync(runWorkItemPath, 'utf8'))

    const runLegacyProject = allocateProjectId(allocated)
    const runLegacy = run(docsTddCli, [
      'run', runLegacyProject, '--prd', source, '--legacy',
    ], { cwd: sandbox, env })
    assert.notEqual(runLegacy.status, 0)
    assert.match(runLegacy.stderr, /docs-tdd run is workflowVersion 2 only/)
    assert.equal(existsSync(resolveProjectRoot(runLegacyProject)), false)

    const runSourceSwitch = run(docsTddCli, [
      'run', runProject, '--prd', alternativeSource,
    ], { cwd: sandbox, env })
    assert.notEqual(runSourceSwitch.status, 0)
    const runSourceSwitchState = JSON.parse(runSourceSwitch.stdout)
    assert.equal(runSourceSwitchState.status, 'blocked')
    assert.equal(runSourceSwitchState.nextAction, 'source_update')
    assert.deepEqual(JSON.parse(readFileSync(runWorkItemPath, 'utf8')), runWorkItem)

    writeFileSync(source, '# Kickoff E2E\n\nRender the requested widget.\nA changed source must not silently replace the active work item.\n')
    const runSourceDrift = run(docsTddCli, [
      'run', runProject, '--prd', source,
    ], { cwd: sandbox, env })
    assert.notEqual(runSourceDrift.status, 0)
    assert.equal(JSON.parse(runSourceDrift.stdout).nextAction, 'source_update')
    assert.deepEqual(JSON.parse(readFileSync(runWorkItemPath, 'utf8')), runWorkItem)
    writeFileSync(source, '# Kickoff E2E\n\nRender the requested widget.\n')

    rmSync(runWorkItemPath)
    const missingSourcePath = `${source}.temporarily-missing`
    renameSync(source, missingSourcePath)
    const failedResume = run(docsTddCli, ['resume', runProject], { cwd: sandbox, env })
    assert.notEqual(failedResume.status, 0)
    assert.equal(JSON.parse(failedResume.stdout).status, 'blocked')
    renameSync(missingSourcePath, source)

    const resumed = run(docsTddCli, ['resume', runProject], { cwd: sandbox, env })
    assert.equal(resumed.status, 0, resumed.stderr)
    assert.notEqual(JSON.parse(resumed.stdout).status, 'blocked')
    assert.equal(existsSync(runWorkItemPath), true)
    console.log('vnext public-command E2E passed (kickoff, run --prd binding, Agent infrastructure failure, run/v1 separation, resume failure, Lite denial, v1 compatibility, path boundary)')
  } finally {
    for (const { projectId, marker } of projects) removeOwnedProject(projectId, marker)
    rmSync(sourceRoot, { recursive: true, force: true })
    rmSync(sandbox, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  if (process.argv.includes('--self-test')) {
    try {
      selfTest()
    } catch (error) {
      console.error(error)
      process.exitCode = 1
    }
  } else {
    console.error('usage: vnext-kickoff-public-e2e.mjs --self-test')
    process.exitCode = 2
  }
}
