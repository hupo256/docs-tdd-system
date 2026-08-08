#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const args = process.argv.slice(2)
const [command, projectId] = args

function option(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

function run(script, scriptArgs) {
  return spawnSync(process.execPath, [join(scriptDir, script), ...scriptArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function stateFile(id) {
  return join(resolveProjectRoot(id), 'agent/run-state.json')
}

function writeState(id, patch) {
  const file = stateFile(id)
  const previous = readJson(file) || { version: 1, projectId: id, attempts: [] }
  const next = { ...previous, ...patch, updatedAt: new Date().toISOString() }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`)
  return next
}

export function inferState({ projectExists, gateResult, inventoryText = '', worktree = '' }) {
  if (!projectExists) return { status: 'ready', currentStage: 'G0', nextAction: 'scaffold_project' }
  if (gateResult?.gate === 'G8' && gateResult?.ok === true) return { status: 'complete', currentStage: 'G8', nextAction: 'none' }
  if (/待 G2 确认|G2 确认人 & 日期 \|\s*(?:待确认)?\s*\|/.test(inventoryText)) {
    return { status: 'waiting_approval', currentStage: 'G1', nextAction: 'complete_g0_g1_docs' }
  }
  if (!worktree) return { status: 'active', currentStage: 'G2', nextAction: 'prepare_worktree' }
  return { status: 'active', currentStage: gateResult?.gate || 'G4', nextAction: 'continue_current_stage' }
}

export function reconcileState(stored, inferred) {
  const inferredComplete = inferred?.status === 'complete'
  const storedActionableBlock = stored?.status === 'blocked'
    && ['sync_prd', 'initialize_prd_intake'].includes(stored?.nextAction)
  return storedActionableBlock && !inferredComplete
    ? { ...inferred, ...stored }
    : { ...(stored || {}), ...inferred }
}

function print(state) {
  console.log(JSON.stringify(state, null, 2))
}

function syncAndInit(id) {
  const configFile = join(resolveProjectRoot(id), 'agent/lark-sources.json')
  const sources = readJson(configFile)
  if (!sources?.sources?.length) return { ok: false, nextAction: 'sync_prd', error: 'lark-sources.json 缺失或为空' }
  const sync = run('sync-lark-docs.mjs', ['--config', configFile])
  if (sync.status !== 0) {
    return { ok: false, nextAction: 'sync_prd', error: (sync.stderr || sync.stdout).trim().slice(0, 1200) }
  }
  const source = sources.sources[0]
  const syncedPath = join(sources.outputDir, source.target)
  const intake = run('prd-intake.mjs', [id, '--init', '--source', syncedPath])
  if (intake.status !== 0) {
    return { ok: false, nextAction: 'initialize_prd_intake', error: (intake.stderr || intake.stdout).trim().slice(0, 1200), syncedPath }
  }
  return { ok: true, nextAction: 'complete_g0_g1_docs', syncedPath }
}

function kickoff() {
  const prd = option('--prd')
  const title = option('--title', projectId)
  if (!prd) throw new Error('kickoff requires --prd <Lark URL or local Markdown>')
  const projectDir = resolveProjectRoot(projectId)
  if (!existsSync(projectDir)) {
    const scaffold = run('start-new-project.mjs', [projectId, '--prd', prd, '--title', title])
    if (scaffold.status !== 0) throw new Error((scaffold.stderr || scaffold.stdout).trim())
  }
  let state = writeState(projectId, {
    status: 'active',
    currentStage: 'G0',
    lastAction: 'scaffold_project',
    nextAction: 'sync_prd',
    source: prd,
  })
  const result = syncAndInit(projectId)
  state = writeState(projectId, {
    status: result.ok ? 'waiting_approval' : 'blocked',
    currentStage: result.ok ? 'G1' : 'G0',
    lastAction: result.ok ? 'initialize_prd_intake' : 'scaffold_project',
    nextAction: result.nextAction,
    blocker: result.error || '',
    syncedSource: result.syncedPath || '',
    attempts: [...(state.attempts || []), { at: new Date().toISOString(), action: 'sync_and_init', ok: result.ok }],
  })
  print(state)
}

function status() {
  const projectDir = resolveProjectRoot(projectId)
  const stored = readJson(stateFile(projectId))
  const readme = existsSync(join(projectDir, 'README.md')) ? readFileSync(join(projectDir, 'README.md'), 'utf8') : ''
  const inventoryText = existsSync(join(projectDir, 'product/00-feature-inventory.md')) ? readFileSync(join(projectDir, 'product/00-feature-inventory.md'), 'utf8') : ''
  const gateResult = readJson(join(projectDir, 'agent/gate-results.json'))
  const worktree = readme.match(/^worktree:\s*(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || ''
  const inferred = inferState({ projectExists: existsSync(projectDir), gateResult, inventoryText, worktree })
  print({ ...reconcileState(stored, inferred), projectId, stateFile: relative(repoRoot, stateFile(projectId)) })
}

function resume() {
  const stored = readJson(stateFile(projectId))
  if (!stored) throw new Error(`run-state 不存在；先运行 docs-tdd kickoff ${projectId} --prd <source>`)
  if (['sync_prd', 'initialize_prd_intake'].includes(stored.nextAction)) {
    const result = syncAndInit(projectId)
    const state = writeState(projectId, {
      status: result.ok ? 'waiting_approval' : 'blocked',
      currentStage: result.ok ? 'G1' : stored.currentStage,
      lastAction: result.ok ? 'initialize_prd_intake' : stored.lastAction,
      nextAction: result.nextAction,
      blocker: result.error || '',
      syncedSource: result.syncedPath || stored.syncedSource || '',
      attempts: [...(stored.attempts || []), { at: new Date().toISOString(), action: 'resume_sync_and_init', ok: result.ok }],
    })
    print(state)
    return
  }
  print({ ...stored, note: '下一步需要 Agent 完成语义工作；读取 context pack 后执行 nextAction，完成时更新 run-state。' })
}

function selfTest() {
  const a = inferState({ projectExists: false })
  const b = inferState({ projectExists: true, inventoryText: '| G2 确认人 & 日期 | 待确认 |' })
  const c = inferState({ projectExists: true, gateResult: { gate: 'G8', ok: true } })
  const blocked = reconcileState({ status: 'blocked', nextAction: 'sync_prd', blocker: 'permission denied' }, b)
  const completed = reconcileState({ status: 'blocked', nextAction: 'sync_prd' }, c)
  if (
    a.nextAction !== 'scaffold_project'
    || b.status !== 'waiting_approval'
    || c.status !== 'complete'
    || blocked.status !== 'blocked'
    || completed.status !== 'complete'
  ) process.exit(1)
  console.log('project-orchestrator self-test passed (5 cases)')
}

if (args.includes('--self-test')) selfTest()
else if (!new RegExp(`^(?:${config.projectIdPattern || 'PR-\\d{5}'})$`).test(projectId || '')) {
  console.error('usage: project-orchestrator.mjs <kickoff|status|resume|next> PR-01234 [--prd <source>] [--title <name>]')
  process.exit(1)
} else {
  try {
    if (command === 'kickoff') kickoff()
    else if (command === 'status' || command === 'next') status()
    else if (command === 'resume') resume()
    else throw new Error(`unknown orchestrator command: ${command}`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
