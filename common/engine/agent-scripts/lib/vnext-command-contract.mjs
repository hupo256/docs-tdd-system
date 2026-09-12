#!/usr/bin/env node
// Runtime checks and deduplication for reviewed evidence commands.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_COMMAND_TIMEOUT_SECONDS = 300
const COMMAND_RUNNER = fileURLToPath(new URL('./vnext-command-runner.mjs', import.meta.url))

function outputTail(value, limit = 2000) {
  const text = String(value || '')
  return text.length <= limit ? text : text.slice(-limit)
}

export function executeReviewedCommand(spec, worktree) {
  const startedAt = new Date().toISOString()
  const timeoutSeconds = spec.timeoutSeconds || DEFAULT_COMMAND_TIMEOUT_SECONDS
  const result = spawnSync(process.execPath, [COMMAND_RUNNER], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    input: JSON.stringify({ argv: spec.argv, cwd: worktree, timeoutMs: timeoutSeconds * 1000 }),
    timeout: (timeoutSeconds + 10) * 1000,
    maxBuffer: 20 * 1024 * 1024,
  })
  const finishedAt = new Date().toISOString()
  try {
    return { startedAt, finishedAt, ...JSON.parse(result.stdout || '') }
  } catch {
    return {
      startedAt,
      finishedAt,
      exitCode: 124,
      signal: result.signal || '',
      stdout: '',
      stderr: `command runner did not return a valid result${result.stderr ? `: ${outputTail(result.stderr)}` : ''}${result.error ? `\n${result.error.message}` : ''}`,
    }
  }
}

function testRunTarget(command) {
  const runIndex = command.argv.indexOf('--run')
  if (runIndex === -1 || !command.argv[runIndex + 1]) return ''
  return command.argv[runIndex + 1].replaceAll('\\', '/').replace(/\/$/, '')
}

function includesAll(parent = [], child = []) {
  const values = new Set(parent)
  return child.every((value) => values.has(value))
}

function commandSupersedes(parent, child) {
  const parentTarget = testRunTarget(parent)
  const childTarget = testRunTarget(child)
  if (!parentTarget || !childTarget || parentTarget === childTarget || !childTarget.startsWith(`${parentTarget}/`)) return false
  if (!includesAll(parent.requirementIds, child.requirementIds) || !includesAll(parent.surfaceIds, child.surfaceIds)) return false
  const parentPrefix = parent.argv.slice(0, parent.argv.indexOf('--run')).join('\0')
  const childPrefix = child.argv.slice(0, child.argv.indexOf('--run')).join('\0')
  return parentPrefix === childPrefix
}

export function selectDevelopmentCommands(evidenceCommands = [], deferredKinds = new Set()) {
  const eligible = evidenceCommands.filter((command) => !deferredKinds.has(command.kind))
  const commands = eligible.filter((candidate) => !eligible.some((parent) => parent !== candidate && commandSupersedes(parent, candidate)))
  const supersededCommands = eligible
    .filter((command) => !commands.includes(command))
    .map((command) => ({
      command,
      coveringCommandId: commands.find((parent) => commandSupersedes(parent, command))?.evidenceId || '',
    }))
  return {
    commands,
    supersededCommandIds: supersededCommands.map(({ command }) => command.evidenceId),
    supersededCommands,
  }
}

export function evidenceCommandRuntimeProblem(command, worktree) {
  const target = testRunTarget(command)
  if (!target || /[*?{}[\]]/.test(target)) return ''
  const absoluteWorktree = resolve(worktree)
  const absoluteTarget = resolve(worktree, target)
  const targetRelative = relative(absoluteWorktree, absoluteTarget)
  if (!targetRelative || targetRelative.startsWith('..') || resolve(absoluteWorktree, targetRelative) !== absoluteTarget) {
    return `${command.evidenceId} --run target must be a repository-relative path`
  }
  if (!existsSync(absoluteTarget)) return `${command.evidenceId} --run target does not exist: ${target}`
  if (statSync(absoluteTarget).isDirectory() && !readdirSync(absoluteTarget, { recursive: true }).some((entry) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(String(entry)))) {
    return `${command.evidenceId} --run directory contains no test files: ${target}`
  }
  const runIndex = command.argv.indexOf('--run')
  const scriptName = command.argv.slice(1, runIndex).at(-1)
  if (basename(command.argv[0]).startsWith('pnpm') && scriptName === 'test') {
    let packageDir = statSync(absoluteTarget).isDirectory() ? absoluteTarget : dirname(absoluteTarget)
    let packageJson = ''
    while (!relative(absoluteWorktree, packageDir).startsWith('..')) {
      const candidate = join(packageDir, 'package.json')
      if (existsSync(candidate)) {
        packageJson = candidate
        break
      }
      if (packageDir === absoluteWorktree) break
      packageDir = dirname(packageDir)
    }
    if (!packageJson || !JSON.parse(readFileSync(packageJson, 'utf8')).scripts?.test) {
      return `${command.evidenceId} target package has no test script: ${target}`
    }
  }
  return ''
}

export async function selfTest() {
  const aggregate = { evidenceId: 'E-all', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/tests'], requirementIds: ['R-1'], surfaceIds: ['S-1'] }
  const child = { evidenceId: 'E-one', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/tests/one.test.ts'], requirementIds: ['R-1'], surfaceIds: ['S-1'] }
  const selection = selectDevelopmentCommands([aggregate, child])
  assert.deepEqual(selection.supersededCommandIds, ['E-one'])
  assert.equal(selection.supersededCommands[0].coveringCommandId, 'E-all')
  assert.match(evidenceCommandRuntimeProblem({ evidenceId: 'E-missing', argv: ['pnpm', 'test', '--run', `missing-${process.pid}`] }, '/tmp'), /does not exist/)
  const executed = executeReviewedCommand({ argv: [process.execPath, '-e', "console.log('ok')"], timeoutSeconds: 5 }, process.cwd())
  assert.equal(executed.exitCode, 0)
  assert.match(executed.stdout, /ok/)
  console.log('vnext-command-contract self-test passed')
}

if (process.argv.includes('--self-test') && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await selfTest()
