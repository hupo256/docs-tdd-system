#!/usr/bin/env node
// Runtime checks and deduplication for reviewed evidence commands.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
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

function normalizedArgv(command) {
  return (command?.argv || []).map((part) => part.replaceAll('\\', '/').replace(/\/$/, ''))
}

function explicitTestTargets(command) {
  return normalizedArgv(command).filter((part) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(part))
}

function looksLikeTestRunner(command) {
  return normalizedArgv(command).some((part) => ['test', '--test', 'vitest', 'jest', 'mocha', 'ava', 'tap'].includes(basename(part).toLowerCase()))
}

function qualityScope(command) {
  if (!['directed-quality', 'touched-file-quality'].includes(command?.kind)) return null
  const args = normalizedArgv(command)
  const invokesQualityTool = args.some((part) => ['biome', 'eslint', 'lint', 'tsc', 'typecheck', 'type-check'].includes(basename(part).toLowerCase()))
  if (!invokesQualityTool) return null
  const filesOptionIndex = args.indexOf('--files')
  const targets = args.filter((part) => /\.(?:[cm]?[jt]sx?|json)$/.test(part))
  if (filesOptionIndex >= 0 && args[filesOptionIndex + 1]) targets.push(...args[filesOptionIndex + 1].split(','))
  return targets
}

export function evidenceCommandPolicyProblem(command) {
  if (['component-dom', 'copy-literal'].includes(command?.kind) && looksLikeTestRunner(command)) {
    return `${command?.evidenceId || 'command'} ${command.kind} must use a Node/source DOM-contract script or browser evidence, not a Vitest/Jest component or copy test`
  }
  const testTargets = explicitTestTargets(command)
  if (looksLikeTestRunner(command) && !testTargets.length) {
    return `${command?.evidenceId || 'command'} test command must name explicit related test files; repository/package/directory-wide suites are prohibited`
  }
  if (testTargets.some((target) => /[*?{}[\]]/.test(target))) {
    return `${command?.evidenceId || 'command'} test command must name concrete test files; glob targets are prohibited`
  }
  if (testTargets.some((target) => /\.(?:test|spec)\.[cm]?[jt]sx$/.test(target))) {
    return `${command?.evidenceId || 'command'} .tsx component test targets are prohibited; use a Node/source DOM-contract script or browser evidence`
  }
  const qualityTargets = qualityScope(command)
  if (qualityTargets && !qualityTargets.length) {
    return `${command?.evidenceId || 'command'} quality command must name touched files (or pass --files); unscoped lint/typecheck is prohibited`
  }
  if (qualityTargets?.some((target) => /[*?{}[\]]/.test(target))) {
    return `${command?.evidenceId || 'command'} quality command must name concrete touched files; glob targets are prohibited`
  }
  return ''
}

function includesAll(parent = [], child = []) {
  const values = new Set(parent)
  return child.every((value) => values.has(value))
}

function commandSupersedes(parent, child) {
  if (normalizedArgv(parent).join('\0') !== normalizedArgv(child).join('\0')) return false
  if (!includesAll(parent.requirementIds, child.requirementIds) || !includesAll(parent.surfaceIds, child.surfaceIds)) return false
  const strictlyBroader = (parent.requirementIds || []).length > (child.requirementIds || []).length
    || (parent.surfaceIds || []).length > (child.surfaceIds || []).length
  return strictlyBroader || String(parent.evidenceId).localeCompare(String(child.evidenceId)) < 0
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
  const policyProblem = evidenceCommandPolicyProblem(command)
  if (policyProblem) return policyProblem
  const targets = explicitTestTargets(command)
  if (!targets.length) return ''
  const absoluteWorktree = resolve(worktree)
  for (const target of targets) {
    if (isAbsolute(target)) return `${command.evidenceId} test target must be a repository-relative path`
    const absoluteTarget = resolve(worktree, target)
    const targetRelative = relative(absoluteWorktree, absoluteTarget)
    if (!targetRelative || targetRelative.startsWith('..') || resolve(absoluteWorktree, targetRelative) !== absoluteTarget) {
      return `${command.evidenceId} test target must be a repository-relative path`
    }
    if (!existsSync(absoluteTarget)) return `${command.evidenceId} test target does not exist: ${target}`
    if (!statSync(absoluteTarget).isFile()) return `${command.evidenceId} test target must be an explicit file: ${target}`
  }
  if (basename(command.argv[0]).startsWith('pnpm') && command.argv.includes('test')) {
    const filteredPackage = command.argv.includes('--filter')
    let packageDir = filteredPackage ? dirname(resolve(worktree, targets[0])) : absoluteWorktree
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
      return `${command.evidenceId} target package has no test script: ${targets[0]}`
    }
  }
  return ''
}

export async function selfTest() {
  const aggregate = { evidenceId: 'E-all', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/tests/one.test.ts'], requirementIds: ['R-1', 'R-2'], surfaceIds: ['S-1'] }
  const child = { evidenceId: 'E-one', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/tests/one.test.ts'], requirementIds: ['R-1'], surfaceIds: ['S-1'] }
  const selection = selectDevelopmentCommands([aggregate, child])
  assert.deepEqual(selection.supersededCommandIds, ['E-one'])
  assert.equal(selection.supersededCommands[0].coveringCommandId, 'E-all')
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-suite', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/tests'] }), /explicit related test files/)
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-dom', kind: 'component-dom', argv: ['pnpm', 'test', '--run', 'src/Card.test.tsx'] }), /DOM-contract/)
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-copy', kind: 'copy-literal', argv: ['pnpm', 'test', '--run', 'src/copy.test.ts'] }), /source DOM-contract/)
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-test-glob', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/*.test.ts'] }), /concrete test files/)
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-tsx', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', 'src/Card.test.tsx'] }), /component test targets/)
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-type', kind: 'directed-quality', argv: ['pnpm', 'typecheck'] }), /touched files/)
  assert.match(evidenceCommandPolicyProblem({ evidenceId: 'E-quality-glob', kind: 'directed-quality', argv: ['biome', 'check', 'src/*.ts'] }), /concrete touched files/)
  assert.match(evidenceCommandRuntimeProblem({ evidenceId: 'E-missing', kind: 'pure-logic', argv: ['pnpm', 'test', '--run', `missing-${process.pid}.test.ts`] }, '/tmp'), /does not exist/)
  const executed = executeReviewedCommand({ argv: [process.execPath, '-e', "console.log('ok')"], timeoutSeconds: 5 }, process.cwd())
  assert.equal(executed.exitCode, 0)
  assert.match(executed.stdout, /ok/)
  console.log('vnext-command-contract self-test passed')
}

if (process.argv.includes('--self-test') && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await selfTest()
