#!/usr/bin/env node

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash, randomInt } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  docsSystemRoot,
  resolveProjectBaseRoot as resolveProjectBaseRootFromRoots,
  resolveProjectChangeRoot as resolveProjectChangeRootFromRoots,
  resolveProjectRoot as resolveProjectRootFromRoots,
} from './lib/roots.mjs'
import { readProjectGitBinding } from './lib/project-status-report.mjs'

const scriptDir = new URL('.', import.meta.url)
const docsTddCli = fileURLToPath(new URL('./docs-tdd.mjs', scriptDir))
const kickoffCompat = fileURLToPath(new URL('./lib/kickoff-v4.mjs', scriptDir))
const scriptPath = fileURLToPath(import.meta.url)
let activeProjectsRoot = null

function resolveProjectBaseRoot(projectId) {
  return resolveProjectBaseRootFromRoots(projectId, activeProjectsRoot ? { projectsRoot: activeProjectsRoot } : {})
}

function resolveProjectChangeRoot(projectId, changeId) {
  return resolveProjectChangeRootFromRoots(projectId, changeId, activeProjectsRoot ? { projectsRoot: activeProjectsRoot } : {})
}

function resolveProjectRoot(projectId) {
  return resolveProjectRootFromRoots(projectId, activeProjectsRoot ? { projectsRoot: activeProjectsRoot } : {})
}

function allocateProjectId(allocated) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const projectId = `TR-${randomInt(10000, 100000)}`
    if (!allocated.has(projectId) && !existsSync(resolveProjectBaseRoot(projectId))) {
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
  const projectDir = resolveProjectBaseRoot(projectId)
  const readme = join(projectDir, 'README.md')
  if (!existsSync(readme)) return
  if (!readFileSync(readme, 'utf8').includes(marker)) return
  rmSync(projectDir, { recursive: true, force: true })
}

function directorySnapshot(root) {
  if (!existsSync(root)) return null
  const files = []
  const visit = (dir, prefix = '') => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolutePath = join(dir, entry.name)
      if (entry.isDirectory()) visit(absolutePath, relativePath)
      else files.push([relativePath, createHash('sha256').update(readFileSync(absolutePath)).digest('hex')])
    }
  }
  visit(root)
  return files
}

export function selfTest() {
  const sandbox = mkdtempSync(join(tmpdir(), 'vnext-kickoff-public-e2e-'))
  const sourceRoot = mkdtempSync(join(docsSystemRoot, '.kickoff-public-e2e-'))
  const projectIndexPath = join(docsSystemRoot, 'PROJECTS.md')
  const contextPath = join(docsSystemRoot, 'CONTEXT.md')
  const projectIndexBefore = readFileSync(projectIndexPath, 'utf8')
  const contextBefore = existsSync(contextPath) ? readFileSync(contextPath, 'utf8') : null
  const allocated = new Set()
  const projects = []
  activeProjectsRoot = join(sandbox, 'isolated-projects')
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
      DOCS_TDD_ISOLATED_PROJECTS_ROOT: activeProjectsRoot,
      DOCS_TDD_CODEX_BIN: join(sandbox, 'missing-codex'),
    }

    const dryRunProject = allocateProjectId(allocated)
    const dryRun = outputJson(run(docsTddCli, [
      'run', dryRunProject, '--prd', source, '--title', `kickoff-public-e2e-${nonce}-dry-run`,
      '--client', 'codex', '--dry-run',
    ], { cwd: sandbox, env }))
    assert.equal(dryRun.status, 'dry-run')
    assert.equal(dryRun.runner.outcome, 'dry-run')
    assert.equal(existsSync(resolveProjectBaseRoot(dryRunProject)), false)

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
    const v2ProjectBeforePreview = directorySnapshot(resolveProjectBaseRoot(v2Project))
    const sourceSwitchPreview = outputJson(run(docsTddCli, [
      'kickoff', v2Project, '--prd', alternativeSource, '--title', v2Marker, '--kind', 'bugfix', '--dry-run',
    ], { cwd: sandbox, env }))
    assert.equal(sourceSwitchPreview.status, 'dry-run')
    assert.match(sourceSwitchPreview.dryRun.changeId, /^change-[0-9a-f]{8}$/)
    assert.equal(existsSync(join(resolveProjectBaseRoot(v2Project), 'active-change.json')), false)
    assert.equal(existsSync(sourceSwitchPreview.dryRun.projectDir), false)
    assert.deepEqual(directorySnapshot(resolveProjectBaseRoot(v2Project)), v2ProjectBeforePreview)
    assert.deepEqual(JSON.parse(readFileSync(workItemPath, 'utf8')), firstWorkItem)

    const explicitSourceSwitch = run(docsTddCli, [
      'kickoff', v2Project, '--change', 'different-source', '--prd', alternativeSource, '--title', v2Marker,
    ], { cwd: sandbox, env })
    assert.equal(explicitSourceSwitch.status, 0, explicitSourceSwitch.stderr)
    assert.equal(existsSync(join(resolveProjectChangeRoot(v2Project, 'different-source'), 'work-item.json')), true)
    assert.deepEqual(JSON.parse(readFileSync(workItemPath, 'utf8')), firstWorkItem)
    rmSync(join(resolveProjectBaseRoot(v2Project), 'active-change.json'))

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
    // 失败 action 不再自动重放；契约见 project-orchestrator：runnerFailure 时唯一下一步是显式重试
    assert.equal(firstRunState.nextAction, 'retry-failed-action')
    const runWorkItemPath = join(resolveProjectRoot(runProject), 'work-item.json')
    const runWorkItem = JSON.parse(readFileSync(runWorkItemPath, 'utf8'))
    const runProjectRoot = resolveProjectBaseRoot(runProject)
    const beforeExistingDryRun = directorySnapshot(runProjectRoot)
    const existingDryRun = outputJson(run(docsTddCli, [
      'run', runProject, '--client', 'codex', '--dry-run',
    ], { cwd: sandbox, env }))
    assert.equal(existingDryRun.status, 'dry-run')
    assert.equal(existingDryRun.runner.outcome, 'dry-run')
    assert.deepEqual(directorySnapshot(runProjectRoot), beforeExistingDryRun)

    const previewChangeRoot = resolveProjectChangeRoot(runProject, 'cursor-hover-preview')
    const previewChange = outputJson(run(docsTddCli, [
      'run', runProject, '--change', 'cursor-hover-preview', '--prd', source,
      '--client', 'codex', '--dry-run',
    ], { cwd: sandbox, env }))
    assert.equal(previewChange.status, 'dry-run')
    assert.equal(previewChange.dryRun.changeId, 'cursor-hover-preview')
    assert.equal(existsSync(join(runProjectRoot, 'active-change.json')), false)
    assert.equal(existsSync(previewChangeRoot), false)
    assert.deepEqual(directorySnapshot(runProjectRoot), beforeExistingDryRun)

    const runLegacyProject = allocateProjectId(allocated)
    const runLegacy = run(docsTddCli, [
      'run', runLegacyProject, '--prd', source, '--legacy',
    ], { cwd: sandbox, env })
    assert.notEqual(runLegacy.status, 0)
    assert.match(runLegacy.stderr, /docs-tdd run is workflowVersion 2 only/)
    assert.equal(existsSync(resolveProjectRoot(runLegacyProject)), false)

    const autoChangePreview = outputJson(run(docsTddCli, [
      'run', runProject, '--prd', alternativeSource, '--kind', 'bugfix',
      '--base-ref', 'origin/release-test', '--client', 'codex', '--dry-run',
    ], { cwd: sandbox, env }))
    assert.equal(autoChangePreview.status, 'dry-run')
    assert.match(autoChangePreview.dryRun.changeId, /^change-[0-9a-f]{8}$/)
    assert.equal(existsSync(join(runProjectRoot, 'active-change.json')), false)
    assert.equal(existsSync(autoChangePreview.dryRun.projectDir), false)
    assert.deepEqual(directorySnapshot(runProjectRoot), beforeExistingDryRun)
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

    const historicalWorkItem = readFileSync(join(runProjectRoot, 'work-item.json'), 'utf8')
    const automaticChangeRun = run(docsTddCli, [
      'run', runProject, '--prd', alternativeSource, '--kind', 'bugfix',
      '--base-ref', 'origin/release-test', '--title', `${runMarker}-automatic-change`,
      '--client', 'codex',
    ], { cwd: sandbox, env })
    assert.notEqual(automaticChangeRun.status, 0)
    assert.equal(JSON.parse(automaticChangeRun.stdout).status, 'failed-infrastructure')
    const automaticPointer = JSON.parse(readFileSync(join(runProjectRoot, 'active-change.json'), 'utf8'))
    assert.match(automaticPointer.changeId, /^change-[0-9a-f]{8}$/)
    const automaticChangeRoot = resolveProjectChangeRoot(runProject, automaticPointer.changeId)
    const automaticReadme = readFileSync(join(automaticChangeRoot, 'README.md'), 'utf8')
    assert.match(automaticReadme, new RegExp(`^changeId: ${automaticPointer.changeId}$`, 'm'))
    assert.match(automaticReadme, new RegExp(`^branch: "feature/${runProject}"$`, 'm'))
    assert.match(automaticReadme, /^baseRef: "origin\/online"$/m)
    assert.match(automaticReadme, new RegExp(`^worktree: ".*${runProject}"$`, 'm'))
    const automaticGitBinding = readProjectGitBinding(runProject, { projectsRoot: activeProjectsRoot })
    assert.equal(automaticGitBinding.baseRef, 'origin/online')
    assert.equal(automaticGitBinding.branch, `feature/${runProject}`)
    assert.equal(automaticGitBinding.worktree, join(dirname(resolve(sandbox)), runProject))
    assert.equal(readFileSync(join(runProjectRoot, 'work-item.json'), 'utf8'), historicalWorkItem)

    const changeRun = run(docsTddCli, [
      'run', runProject, '--change', 'cursor-hover', '--prd', source,
      '--title', `${runMarker}-cursor-hover`, '--client', 'codex',
    ], { cwd: sandbox, env })
    assert.notEqual(changeRun.status, 0)
    assert.equal(JSON.parse(changeRun.stdout).status, 'failed-infrastructure')
    const changeRoot = resolveProjectChangeRoot(runProject, 'cursor-hover')
    assert.equal(existsSync(join(changeRoot, 'work-item.json')), true)
    assert.equal(readFileSync(join(runProjectRoot, 'work-item.json'), 'utf8'), historicalWorkItem)
    assert.deepEqual(JSON.parse(readFileSync(join(runProjectRoot, 'active-change.json'), 'utf8')), {
      schemaVersion: 1,
      projectId: runProject,
      changeId: 'cursor-hover',
    })
    assert.match(
      JSON.parse(readFileSync(join(changeRoot, 'agent/lark-sources.json'), 'utf8')).outputDir,
      /changes\/cursor-hover\/inbox\/lark-sync$/,
    )
    for (const { projectId } of projects) {
      assert.equal(existsSync(join(docsSystemRoot, 'prds', projectId)), false, `${projectId} must not be persisted in canonical prds`)
    }

    const liveEnv = { ...env }
    delete liveEnv.DOCS_TDD_ISOLATED_PROJECTS_ROOT
    const updateIndexScript = fileURLToPath(new URL('./update-project-index.mjs', scriptDir))
    const refusedIsolatedIndexWrite = run(updateIndexScript, ['--write'], { cwd: sandbox, env })
    assert.equal(refusedIsolatedIndexWrite.status, 2)
    assert.equal(readFileSync(projectIndexPath, 'utf8'), projectIndexBefore)
    assert.equal(contextBefore === null ? !existsSync(contextPath) : readFileSync(contextPath, 'utf8') === contextBefore, true)
    const canonicalIndex = outputJson(run(updateIndexScript, ['--json'], { cwd: sandbox, env: liveEnv }))
    for (const { projectId } of projects) {
      assert.equal(canonicalIndex.projects.some((project) => project.id === projectId), false, `${projectId} leaked into PROJECTS.md input`)
    }
    const pilotReport = outputJson(run(fileURLToPath(new URL('./vnext-pilot.mjs', scriptDir)), [], { cwd: sandbox, env: liveEnv }))
    const pilotRegistry = JSON.parse(readFileSync(join(docsSystemRoot, 'common/vnext/pilot-registry.json'), 'utf8'))
    assert.equal(pilotReport.summary.enrolled, pilotRegistry.entries.filter((entry) => entry.pilotEligibility !== 'excluded').length)
    for (const { projectId } of projects) {
      assert.equal(pilotReport.projectControls.some((control) => control.projectId === projectId), false, `${projectId} leaked into Pilot registration`)
      assert.equal(pilotReport.samples.some((sample) => sample.projectId === projectId), false, `${projectId} leaked into Pilot sample statistics`)
    }

    const controlRegistryPath = join(docsSystemRoot, 'common/vnext/pilot-registry.json')
    const controlRegistryBefore = readFileSync(controlRegistryPath, 'utf8')
    for (const protectedId of ['PR-02233']) {
      const protectedRoot = resolveProjectBaseRootFromRoots(protectedId)
      const beforeHold = directorySnapshot(protectedRoot)
      const status = outputJson(run(docsTddCli, ['status', protectedId], { cwd: sandbox, env: liveEnv }))
      assert.equal(status.executionControl.pilotEligibility, 'excluded')
      assert.equal(status.executionControl.executionHold.active, true)
      assert.equal(status.status, 'blocked')
      assert.equal(status.executionStatus, status.actionPacket.status, 'status must keep current execution separate from Pilot eligibility and system hold')
      assert.equal(status.executionControl.recordedTerminalState, 'running')
      assert.equal(status.executionStatus, 'active')
      assert.notEqual(status.actionPacket.status, status.status, 'system hold must not overwrite the current Autopilot status')
      const heldChangeId = `hold-bypass-${nonce}`
      const heldChangePreview = outputJson(run(docsTddCli, [
        'run', protectedId, '--change', heldChangeId, '--prd', source,
        '--kind', 'bugfix', '--client', 'codex', '--dry-run',
      ], { cwd: sandbox, env: liveEnv }))
      assert.equal(heldChangePreview.status, 'dry-run')
      assert.equal(heldChangePreview.dryRun.changeId, heldChangeId)
      assert.equal(existsSync(resolveProjectChangeRootFromRoots(protectedId, heldChangeId)), false)
      assert.deepEqual(directorySnapshot(protectedRoot), beforeHold, `${protectedId} change-set preview must remain read-only`)
      for (const action of ['run', 'resume']) {
        const held = run(docsTddCli, [action, protectedId], { cwd: sandbox, env: liveEnv })
        assert.notEqual(held.status, 0)
        const output = JSON.parse(held.stdout)
        assert.equal(output.status, 'blocked')
        assert.equal(output.executionControl.executionHold.active, true)
        assert.equal(output.runner.outcome, 'blocked-safety-check')
        assert.deepEqual(directorySnapshot(protectedRoot), beforeHold, `${protectedId} ${action} must not write state or receipts`)
        assert.equal(readFileSync(controlRegistryPath, 'utf8'), controlRegistryBefore, 'held commands must not alter Pilot controls')
      }
    }
    console.log('vnext public-command E2E passed (isolated synthetic TR projects, hold-before-write, status/trace reconciliation, read-only auto routing, isolated docs/branch/worktree bindings, same-source drift protection, historical preservation, v1 compatibility, path boundary)')
  } finally {
    for (const { projectId, marker } of projects) removeOwnedProject(projectId, marker)
    rmSync(sourceRoot, { recursive: true, force: true })
    activeProjectsRoot = null
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
