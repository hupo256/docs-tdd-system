#!/usr/bin/env node
// Runtime checks and deduplication for reviewed evidence commands.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn'])
const SCRIPT_CONTROL_TOKEN = /(?:&&|\|\||[;|<>`])/

function shellWords(script) {
  const words = []
  let current = ''
  let quote = ''
  let escaped = false
  for (const character of String(script || '')) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\' && quote !== "'") {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = ''
      else current += character
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (/\s/.test(character)) {
      if (current) words.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (escaped || quote) throw new Error('package script has an unterminated quote or escape')
  if (current) words.push(current)
  if (words.some((word) => SCRIPT_CONTROL_TOKEN.test(word))) {
    throw new Error('package script uses shell composition that cannot prove a scoped final command')
  }
  return words
}

function packageJsonAt(directory) {
  const file = join(directory, 'package.json')
  if (!existsSync(file)) return null
  try {
    return { file, directory, value: JSON.parse(readFileSync(file, 'utf8')) }
  } catch (error) {
    throw new Error(`cannot read ${file}: ${error.message}`)
  }
}

function workspacePackages(root) {
  const packages = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ['.git', 'node_modules', '.next', 'dist', 'build', 'coverage'].includes(entry.name)) continue
      const child = join(directory, entry.name)
      const pkg = packageJsonAt(child)
      if (pkg) packages.push(pkg)
      visit(child)
    }
  }
  const rootPackage = packageJsonAt(root)
  if (rootPackage) packages.push(rootPackage)
  visit(root)
  return packages
}

function scriptInvocation(argv) {
  const executable = basename(argv?.[0] || '').toLowerCase()
  if (!PACKAGE_MANAGERS.has(executable)) return null
  let index = 1
  let filter = ''
  if (executable === 'pnpm' && argv[index] === '--filter') {
    filter = argv[index + 1] || ''
    index += 2
  }
  if (argv[index] !== 'run' && !(executable === 'npm' && argv[index] === 'run-script')) return null
  const script = argv[index + 1] || ''
  const tail = argv.slice(index + 2)
  const separator = tail.indexOf('--')
  return {
    manager: executable,
    filter,
    script,
    forwardedArgs: separator >= 0 ? tail.slice(separator + 1) : tail,
    hasForwardSeparator: separator >= 0,
  }
}

function resolveScriptPackage(worktree, filter) {
  const root = resolve(worktree)
  if (!filter) {
    const pkg = packageJsonAt(root)
    if (!pkg) throw new Error(`package script requires ${join(root, 'package.json')}`)
    return pkg
  }
  const normalizedFilter = filter.replace(/^\.\//, '').replace(/\/$/, '')
  const matches = workspacePackages(root).filter((pkg) => (
    pkg.value.name === filter
    || relative(root, pkg.directory).replaceAll('\\', '/') === normalizedFilter
    || basename(pkg.directory) === normalizedFilter
  ))
  if (matches.length !== 1) throw new Error(`pnpm --filter ${filter} matched ${matches.length} workspace packages`)
  return matches[0]
}

export function expandReviewedCommand(command, worktree) {
  const originalArgv = [...(command?.argv || [])]
  if (!worktree) return { argv: originalArgv, originalArgv, scriptExpanded: false, chain: [], forwardedArgs: [] }
  const expand = (argv, seen = new Set(), chain = []) => {
    const invocation = scriptInvocation(argv)
    if (!invocation) return { argv, scriptExpanded: chain.length > 0, chain, forwardedArgs: [] }
    if (!invocation.script) throw new Error('package-manager run command requires a script name')
    const pkg = resolveScriptPackage(worktree, invocation.filter)
    const key = `${pkg.file}:${invocation.script}`
    if (seen.has(key)) throw new Error(`recursive package script cycle: ${[...chain, key].join(' -> ')}`)
    const source = pkg.value.scripts?.[invocation.script]
    if (typeof source !== 'string' || !source.trim()) throw new Error(`${relative(worktree, pkg.file) || 'package.json'} has no ${invocation.script} script`)
    if (invocation.forwardedArgs.length && !invocation.hasForwardSeparator && invocation.manager === 'npm') {
      throw new Error(`npm run ${invocation.script} must use -- before forwarded scoped arguments`)
    }
    const nextArgv = [...shellWords(source), ...invocation.forwardedArgs]
    const nextChain = [...chain, key]
    const expanded = expand(nextArgv, new Set([...seen, key]), nextChain)
    return {
      ...expanded,
      scriptExpanded: true,
      forwardedArgs: invocation.forwardedArgs,
      packageDir: expanded.packageDir || pkg.directory,
    }
  }
  return { originalArgv, ...expand(originalArgv) }
}

function normalizedArgv(command, worktree = '') {
  const argv = worktree ? expandReviewedCommand(command, worktree).argv : command?.argv || []
  return argv.map((part) => part.replaceAll('\\', '/').replace(/\/$/, ''))
}

function explicitTestTargets(command, worktree = '') {
  return normalizedArgv(command, worktree).filter((part) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(part))
}

function looksLikeTestRunner(command, worktree = '') {
  return normalizedArgv(command, worktree).some((part) => ['test', '--test', 'vitest', 'jest', 'mocha', 'ava', 'tap'].includes(basename(part).toLowerCase()))
}

function qualityScope(command, worktree = '') {
  if (!['directed-quality', 'touched-file-quality'].includes(command?.kind)) return null
  const args = normalizedArgv(command, worktree)
  const invokesQualityTool = args.some((part) => ['biome', 'eslint', 'lint', 'tsc', 'typecheck', 'type-check'].includes(basename(part).toLowerCase()))
  if (!invokesQualityTool) return null
  const filesOptionIndex = args.indexOf('--files')
  const targets = args.filter((part) => /\.(?:[cm]?[jt]sx?|json)$/.test(part))
  if (filesOptionIndex >= 0 && args[filesOptionIndex + 1]) targets.push(...args[filesOptionIndex + 1].split(','))
  return targets
}

export function evidenceCommandPolicyProblem(command, worktree = '') {
  let expanded
  try {
    expanded = worktree ? expandReviewedCommand(command, worktree) : null
  } catch (error) {
    return `${command?.evidenceId || 'command'} cannot expand package script: ${error.message}`
  }
  const effective = expanded ? { ...command, argv: expanded.argv } : command
  if (['component-dom', 'copy-literal'].includes(command?.kind) && looksLikeTestRunner(effective)) {
    return `${command?.evidenceId || 'command'} ${command.kind} must use a Node/source DOM-contract script or browser evidence, not a Vitest/Jest component or copy test`
  }
  const testTargets = explicitTestTargets(effective)
  if (looksLikeTestRunner(effective) && !testTargets.length) {
    return `${command?.evidenceId || 'command'} test command must name explicit related test files; repository/package/directory-wide suites are prohibited`
  }
  if (testTargets.some((target) => /[*?{}[\]]/.test(target))) {
    return `${command?.evidenceId || 'command'} test command must name concrete test files; glob targets are prohibited`
  }
  if (testTargets.some((target) => /\.(?:test|spec)\.[cm]?[jt]sx$/.test(target))) {
    return `${command?.evidenceId || 'command'} .tsx component test targets are prohibited; use a Node/source DOM-contract script or browser evidence`
  }
  const qualityTargets = qualityScope(effective)
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
  const policyProblem = evidenceCommandPolicyProblem(command, worktree)
  if (policyProblem) return policyProblem
  const expanded = expandReviewedCommand(command, worktree)
  const effective = { ...command, argv: expanded.argv }
  const targets = explicitTestTargets(effective)
  if (!targets.length) return ''
  const absoluteWorktree = resolve(worktree)
  const executionRoot = resolve(expanded.packageDir || worktree)
  for (const target of targets) {
    if (isAbsolute(target)) return `${command.evidenceId} test target must be a repository-relative path`
    const absoluteTarget = resolve(executionRoot, target)
    const targetRelative = relative(absoluteWorktree, absoluteTarget)
    if (targetRelative.startsWith('..') || resolve(absoluteWorktree, targetRelative) !== absoluteTarget) {
      return `${command.evidenceId} test target must be a repository-relative path`
    }
    if (!existsSync(absoluteTarget)) return `${command.evidenceId} test target does not exist: ${target}`
    if (!statSync(absoluteTarget).isFile()) return `${command.evidenceId} test target must be an explicit file: ${target}`
  }
  const targetSet = new Set(targets)
  for (const arg of normalizedArgv(effective).slice(1)) {
    if (targetSet.has(arg) || arg.startsWith('-')) continue
    const candidate = resolve(executionRoot, arg || '.')
    if ((arg === '.' || arg === './' || existsSync(candidate) && statSync(candidate).isDirectory())
      && !['node_modules'].includes(basename(candidate))) {
      return `${command.evidenceId} expanded test command still includes broad directory target: ${arg}`
    }
  }
  if (expanded.forwardedArgs.length && !expanded.forwardedArgs.every((arg) => expanded.argv.includes(arg))) {
    return `${command.evidenceId} scoped arguments after -- were not forwarded to the final command`
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
  const fixture = mkdtempSync(join(tmpdir(), 'vnext-command-contract-'))
  try {
    mkdirSync(join(fixture, 'packages', 'web', 'src'), { recursive: true })
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({
      name: 'root',
      scripts: {
        scoped: 'pnpm --filter @fixture/web run test:unit',
        cycle: 'npm run cycle',
      },
    }))
    writeFileSync(join(fixture, 'packages', 'web', 'package.json'), JSON.stringify({
      name: '@fixture/web',
      scripts: {
        'test:unit': 'vitest run',
        broad: 'vitest run src',
      },
    }))
    writeFileSync(join(fixture, 'packages', 'web', 'src', 'one.test.ts'), 'export {}\n')
    const scoped = { evidenceId: 'E-script', kind: 'pure-logic', argv: ['pnpm', 'run', 'scoped', '--', 'src/one.test.ts'] }
    assert.deepEqual(expandReviewedCommand(scoped, fixture).argv, ['vitest', 'run', 'src/one.test.ts'])
    assert.equal(evidenceCommandRuntimeProblem(scoped, fixture), '')
    assert.match(evidenceCommandRuntimeProblem({
      evidenceId: 'E-broad-script',
      kind: 'pure-logic',
      argv: ['pnpm', '--filter', '@fixture/web', 'run', 'broad', '--', 'src/one.test.ts'],
    }, fixture), /broad directory target/)
    assert.match(evidenceCommandRuntimeProblem({
      evidenceId: 'E-cycle',
      kind: 'pure-logic',
      argv: ['npm', 'run', 'cycle', '--', 'src/one.test.ts'],
    }, fixture), /recursive package script cycle/)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
  const executed = executeReviewedCommand({ argv: [process.execPath, '-e', "console.log('ok')"], timeoutSeconds: 5 }, process.cwd())
  assert.equal(executed.exitCode, 0)
  assert.match(executed.stdout, /ok/)
  console.log('vnext-command-contract self-test passed')
}

if (process.argv.includes('--self-test') && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await selfTest()
