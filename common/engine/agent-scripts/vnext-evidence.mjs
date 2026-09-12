#!/usr/bin/env node
// Trusted command evidence runner. Commands are argv arrays (never shell strings), execute in the
// measured worktree, and receive a machine-local receipt only when the effective code tree is
// byte-identical before and after the run.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { changedCodePaths, codeFingerprint, matchesEffectiveCodeState } from './lib/fingerprint.mjs'
import { evidenceCommandRuntimeProblem, executeReviewedCommand, selectDevelopmentCommands } from './lib/vnext-command-contract.mjs'
import { deliveryScopePathProblems } from './lib/vnext-delivery-scope.mjs'
import { evidencePlanFingerprint, signEvidenceBundle, verifyEvidenceReceipt } from './lib/vnext-evidence-receipt.mjs'
import { EXIT_EVIDENCE_REQUIREMENTS } from './lib/vnext-exit.mjs'

const PLAN_FIELDS = new Set(['schemaVersion', 'projectId', 'commands'])
const COMMAND_FIELDS = new Set(['evidenceId', 'kind', 'argv', 'requirementIds', 'surfaceIds', 'timeoutSeconds'])
const DISALLOWED_EXECUTABLES = new Set(['true', 'false', 'echo', 'printf', 'pwd', 'which', 'bash', 'sh', 'zsh', 'fish', 'cmd', 'powershell', 'pwsh'])

function executableName(value) {
  return String(value || '').split(/[\\/]/).at(-1)?.toLowerCase() || ''
}

function trivialCommandProblem(argv) {
  const executable = executableName(argv?.[0])
  if (DISALLOWED_EXECUTABLES.has(executable)) return `executable ${executable} is trivial or shell-evaluated`
  if (executable === 'node' && (argv || []).some((part) => ['-e', '--eval', '-p', '--print', '-v', '--version'].includes(part))) return 'node eval/version probes are not evidence commands'
  if ((argv || []).some((part) => ['-v', '--version'].includes(part)) && (argv || []).length <= 2) return 'version-only probes are not evidence commands'
  return ''
}

function unknownFields(value, allowed) {
  return Object.keys(value || {}).filter((key) => !allowed.has(key))
}

export function evidencePlanProblems(plan, workItem) {
  const problems = []
  if (plan?.schemaVersion !== 1) problems.push('evidence plan schemaVersion must be 1')
  if (plan?.projectId !== workItem?.projectId) problems.push('evidence plan projectId does not match work item')
  const rootUnknown = unknownFields(plan, PLAN_FIELDS)
  if (rootUnknown.length) problems.push(`evidence plan has unknown fields: ${rootUnknown.join(', ')}`)
  if (!Array.isArray(plan?.commands) || !plan.commands.length) problems.push('evidence plan requires at least one command')
  if (!Array.isArray(workItem?.evidenceCommands) || !workItem.evidenceCommands.length) problems.push('autonomous evidence requires evidenceCommands frozen in the reviewed work item')
  else if (evidencePlanFingerprint(plan?.commands) !== evidencePlanFingerprint(workItem.evidenceCommands)) problems.push('evidence plan commands differ from the reviewed work item evidenceCommands')
  const requirementIds = new Set((workItem?.requirements || []).map((item) => item.requirementId))
  const surfaceIds = new Set((workItem?.requirements || []).flatMap((item) => item.affectedSurfaces || []).map((item) => item.surfaceId))
  const ids = []
  for (const [index, command] of (plan?.commands || []).entries()) {
    const label = command?.evidenceId || `command[${index}]`
    const commandUnknown = unknownFields(command, COMMAND_FIELDS)
    if (commandUnknown.length) problems.push(`${label} has unknown fields: ${commandUnknown.join(', ')}`)
    if (!command?.evidenceId?.trim() || !command?.kind?.trim()) problems.push(`command[${index}] requires evidenceId and kind`)
    else ids.push(command.evidenceId)
    if (!Array.isArray(command?.argv) || !command.argv.length || command.argv.some((item) => typeof item !== 'string' || !item.length) || /\s/.test(command.argv?.[0] || '')) problems.push(`${label} argv must be a non-empty string array whose executable contains no whitespace`)
    else {
      const trivial = trivialCommandProblem(command.argv)
      if (trivial) problems.push(`${label}: ${trivial}`)
    }
    if (command?.timeoutSeconds !== undefined && (!Number.isInteger(command.timeoutSeconds) || command.timeoutSeconds < 1 || command.timeoutSeconds > 1800)) problems.push(`${label} timeoutSeconds must be an integer from 1 to 1800`)
    if (command?.requirementIds !== undefined && (!Array.isArray(command.requirementIds) || command.requirementIds.some((id) => !requirementIds.has(id)))) problems.push(`${label} contains unknown requirementIds`)
    if (command?.surfaceIds !== undefined && (!Array.isArray(command.surfaceIds) || command.surfaceIds.some((id) => !surfaceIds.has(id)))) problems.push(`${label} contains unknown surfaceIds`)
  }
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) problems.push(`duplicate evidence IDs: ${[...new Set(duplicates)].join(', ')}`)
  const commands = plan?.commands || []
  for (const kind of EXIT_EVIDENCE_REQUIREMENTS[workItem?.routing?.verificationLevel] || []) {
    if (!commands.some((command) => command.kind === kind)) problems.push(`evidence plan does not cover required ${kind}`)
  }
  for (const requirement of (workItem?.requirements || []).filter((item) => item.status === 'doing')) {
    for (const evidence of requirement.evidencePlan || []) {
      if (!commands.some((command) => command.kind === evidence.type && (command.requirementIds || []).includes(requirement.requirementId))) problems.push(`evidence plan does not cover ${requirement.requirementId}:${evidence.type}`)
      if (evidence.runtimeRequired && !commands.some((command) => command.kind === 'browser-interaction' && (command.requirementIds || []).includes(requirement.requirementId))) {
        problems.push(`evidence plan does not cover runtime-required ${requirement.requirementId}:${evidence.type} with browser-interaction`)
      }
    }
    for (const surface of (requirement.affectedSurfaces || []).filter((item) => item.disposition === 'implement')) {
      if (!commands.some((command) => (command.surfaceIds || []).includes(surface.surfaceId))) problems.push(`evidence plan does not cover ${surface.surfaceId}`)
    }
  }
  return problems
}

function commandLabel(argv) {
  return argv.map((part) => JSON.stringify(part)).join(' ')
}

function outputHash({ argv, status, signal, stdout, stderr }) {
  return createHash('sha256').update(JSON.stringify({ argv, status, signal, stdout, stderr })).digest('hex')
}

function outputTail(value, limit = 2000) {
  const text = String(value || '')
  return text.length <= limit ? text : text.slice(-limit)
}

function executeCommand(spec, worktree) {
  return executeReviewedCommand(spec, worktree)
}

export function verificationScopePaths(workItem, worktree, baseRef = 'origin/online') {
  return [...new Set([
    ...changedCodePaths(worktree, baseRef),
    ...(workItem?.autopilot?.implementation?.changedPaths || []),
  ])].sort()
}

export function runEvidencePlan({ plan, workItem, worktree, baseRef = 'origin/online', keyPath, dependencies = {} } = {}) {
  const problems = evidencePlanProblems(plan, workItem)
  if (problems.length) throw new Error(`invalid evidence plan:\n- ${problems.join('\n- ')}`)
  const measure = dependencies.measure || codeFingerprint
  const execute = dependencies.execute || executeCommand
  const now = dependencies.now || (() => new Date().toISOString())
  const before = measure(worktree, baseRef)
  if (!before?.isGitRepo || !before.headSha || !before.contentHash) throw new Error('evidence runner requires a valid Git worktree fingerprint')
  const policyScopePaths = dependencies.scopePaths || (dependencies.measure ? [] : verificationScopePaths(workItem, worktree, baseRef))
  const pathProblems = deliveryScopePathProblems(workItem, policyScopePaths)
  if (pathProblems.length) throw new Error(`evidence scope violates delivery policy:\n- ${pathProblems.join('\n- ')}`)
  const startedAt = now()
  const facts = []
  const commandProblem = dependencies.commandProblem || evidenceCommandRuntimeProblem
  const commandSelection = selectDevelopmentCommands(plan.commands)
  for (const spec of commandSelection.commands) {
    const runtimeProblem = commandProblem(spec, worktree)
    const execution = runtimeProblem
      ? { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), stdout: '', stderr: runtimeProblem, exitCode: 127, signal: '' }
      : execute(spec, worktree)
    const afterCommand = measure(worktree, baseRef)
    if (!matchesEffectiveCodeState(before, afterCommand)) throw new Error(`${spec.evidenceId} changed effective code content; inspect the worktree and rerun from the final code state`)
    const digest = outputHash({ argv: spec.argv, status: execution.exitCode, signal: execution.signal, stdout: execution.stdout, stderr: execution.stderr })
    const fact = {
      evidenceId: spec.evidenceId,
      kind: spec.kind,
      result: execution.exitCode === 0 ? 'pass' : 'fail',
      codeFingerprint: before,
      requirementIds: spec.requirementIds || [],
      surfaceIds: spec.surfaceIds || [],
      evidenceRefs: [`command-output:sha256:${digest}`],
      producer: {
        kind: 'command',
        command: commandLabel(spec.argv),
        argv: spec.argv,
        exitCode: execution.exitCode,
        startedAt: execution.startedAt,
        finishedAt: execution.finishedAt,
        stdoutHash: createHash('sha256').update(execution.stdout || '').digest('hex'),
        stderrHash: createHash('sha256').update(execution.stderr || '').digest('hex'),
        ...(execution.exitCode === 0 ? {} : { stdoutTail: outputTail(execution.stdout), stderrTail: outputTail(execution.stderr) }),
        ...(execution.signal ? { signal: execution.signal } : {}),
      },
    }
    facts.push(fact)
    if (fact.result === 'pass') {
      for (const { command } of commandSelection.supersededCommands.filter((entry) => entry.coveringCommandId === spec.evidenceId)) {
        facts.push({
          ...fact,
          evidenceId: command.evidenceId,
          kind: command.kind,
          requirementIds: command.requirementIds || [],
          surfaceIds: command.surfaceIds || [],
          evidenceRefs: [...fact.evidenceRefs, `covered-by:${spec.evidenceId}`],
        })
      }
    }
    if (runtimeProblem || execution.exitCode === 124) break
  }
  const after = measure(worktree, baseRef)
  if (!matchesEffectiveCodeState(before, after)) throw new Error('evidence command changed effective code content; inspect the worktree and rerun from the final code state')
  // The full-tree fingerprints above are a mutation guard around command execution. The persisted
  // identity is narrower: freeze the feature's actual changed paths so an unrelated later edit does
  // not invalidate green evidence, while any byte/mode/deletion change inside this set still does.
  const scopePaths = policyScopePaths
  if (!dependencies.measure && !scopePaths.length) throw new Error('path-scoped evidence requires at least one changed or implementation-reported path')
  const attestedCodeState = dependencies.measure
    ? after
    : codeFingerprint(worktree, baseRef, { scopePaths })
  const completedAt = now()
  const bundle = {
    runId: `evidence-${completedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${evidencePlanFingerprint(plan).slice(0, 8)}`,
    capturedAt: completedAt,
    assuranceMode: 'autonomous',
    evidenceTrust: 'cli-attested',
    codeFingerprint: attestedCodeState,
    facts: facts.map((fact) => ({ ...fact, codeFingerprint: attestedCodeState })),
  }
  return signEvidenceBundle(bundle, { workItem, plan, startedAt, completedAt, keyPath })
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

function readJson(file) {
  return JSON.parse(readFileSync(resolve(file), 'utf8'))
}

function outputIsInsideWorktree(output, worktree) {
  const rel = relative(resolve(worktree), resolve(output))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export function selfTest() {
  const keyPath = resolve(`.vnext-evidence-runner-key-${process.pid}`)
  try {
    const code = { headSha: 'abc', baseSha: 'base', contentHash: 'a'.repeat(64), dirtyHash: 'd', dirtyFileCount: 0, untrackedFileCount: 0, isGitRepo: true }
    const command = { evidenceId: 'E-1', kind: 'pure-logic', argv: ['node', 'path/to/test.mjs'], requirementIds: ['R-001'], surfaceIds: ['S-001'] }
    const workItem = { projectId: 'PR-00001', requirements: [{ requirementId: 'R-001', affectedSurfaces: [{ surfaceId: 'S-001' }] }], evidenceCommands: [command] }
    const plan = { schemaVersion: 1, projectId: 'PR-00001', commands: [command] }
    const times = ['2026-09-10T00:00:00Z', '2026-09-10T00:00:01Z']
    const bundle = runEvidencePlan({
      plan, workItem, worktree: '/tmp/worktree', keyPath,
      dependencies: {
        measure: () => code,
        now: () => times.shift(),
        execute: () => ({ startedAt: '2026-09-10T00:00:00Z', finishedAt: '2026-09-10T00:00:01Z', stdout: 'v1', stderr: '', exitCode: 0, signal: '' }),
      },
    })
    assert.equal(bundle.assuranceMode, 'autonomous')
    assert.equal(bundle.facts[0].result, 'pass')
    assert.deepEqual(verifyEvidenceReceipt(bundle, { workItem, currentCodeState: code, keyPath }), [])
    const aggregate = { ...command, evidenceId: 'E-all', kind: 'directed-tests', argv: ['pnpm', 'test', '--run', 'tests'] }
    const child = { ...command, evidenceId: 'E-child', argv: ['pnpm', 'test', '--run', 'tests/child.test.ts'] }
    const aggregateWorkItem = { ...workItem, evidenceCommands: [aggregate, child] }
    let executionCount = 0
    const aggregateBundle = runEvidencePlan({
      plan: { ...plan, commands: [aggregate, child] }, workItem: aggregateWorkItem, worktree: '/tmp/worktree', keyPath,
      dependencies: {
        measure: () => code,
        now: (() => { const values = ['2026-09-10T00:01:00Z', '2026-09-10T00:01:01Z']; return () => values.shift() })(),
        commandProblem: () => '',
        execute: () => { executionCount += 1; return { startedAt: '2026-09-10T00:01:00Z', finishedAt: '2026-09-10T00:01:01Z', stdout: 'all', stderr: '', exitCode: 0, signal: '' } },
      },
    })
    assert.equal(executionCount, 1)
    assert.deepEqual(aggregateBundle.facts.map((fact) => fact.evidenceId), ['E-all', 'E-child'])
    assert.ok(aggregateBundle.facts[1].evidenceRefs.includes('covered-by:E-all'))
    assert.deepEqual(verifyEvidenceReceipt(aggregateBundle, { workItem: aggregateWorkItem, currentCodeState: code, keyPath }), [])
    assert.match(evidencePlanProblems({ ...plan, commands: [...plan.commands, plan.commands[0]] }, workItem).join(' '), /duplicate/)
    assert.match(evidencePlanProblems({ ...plan, commands: [{ ...plan.commands[0], argv: ['echo ok'] }] }, workItem).join(' '), /argv/)
    const runtimeWorkItem = structuredClone(workItem)
    runtimeWorkItem.requirements[0].status = 'doing'
    runtimeWorkItem.requirements[0].evidencePlan = [{ type: 'pure-logic', runtimeRequired: true }]
    assert.match(evidencePlanProblems(plan, runtimeWorkItem).join(' '), /runtime-required.*browser-interaction/)
    const scoped = { ...code, scopeMode: 'path-set-v1', scopePaths: ['src/x.ts'], contentHash: 'b'.repeat(64) }
    assert.equal(matchesEffectiveCodeState({ ...scoped, headSha: 'new-commit', dirtyHash: 'unrelated' }, scoped), true)
    assert.equal(matchesEffectiveCodeState({ ...scoped, contentHash: 'c'.repeat(64) }, scoped), false)
    console.log('vnext-evidence self-test passed')
  } finally {
    try { unlinkSync(keyPath) } catch { /* no-op */ }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else if (process.argv.includes('--help')) {
    console.log('usage: vnext-evidence.mjs --project <v2-dir> --worktree <path> [--base <ref>] [--plan <evidence-plan.json>] [--out <evidence.json>]')
  } else try {
    const projectValue = argumentValue('--project')
    const planFile = argumentValue('--plan')
    const worktreeValue = argumentValue('--worktree')
    if (!projectValue || !worktreeValue) throw new Error('--project and --worktree are required')
    const projectDir = resolve(projectValue)
    const worktree = resolve(worktreeValue)
    const workItemFile = resolve(projectDir, 'work-item.json')
    if (!existsSync(workItemFile)) throw new Error(`work-item.json not found: ${workItemFile}`)
    const workItem = readJson(workItemFile)
    const plan = planFile
      ? readJson(planFile)
      : { schemaVersion: 1, projectId: workItem.projectId, commands: workItem.evidenceCommands || [] }
    const output = argumentValue('--out')
    if (output && outputIsInsideWorktree(output, worktree)) throw new Error('--out must be outside the measured worktree so writing evidence cannot invalidate its own receipt')
    const bundle = runEvidencePlan({ plan, workItem, worktree, baseRef: argumentValue('--base') || 'origin/online' })
    if (output) {
      mkdirSync(dirname(resolve(output)), { recursive: true })
      writeFileSync(resolve(output), `${JSON.stringify(bundle, null, 2)}\n`)
      console.error(`vNext evidence written: ${resolve(output)}`)
    } else console.log(JSON.stringify(bundle, null, 2))
    process.exitCode = bundle.facts.every((fact) => fact.result === 'pass') ? 0 : 1
  } catch (error) {
    console.error(`vNext evidence failed: ${error.message}`)
    process.exitCode = 2
  }
}
