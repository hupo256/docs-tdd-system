#!/usr/bin/env node

// 真实集成 E2E：验证一个「纯展示单点改动」端到端落 trivial 档并跑到 commit。
// harness 与 vnext-clean-project-e2e.mjs 一致（真 git/worktree/commit/evidence，仅 stub 模型）；
// 差异只在 fake codex 产出纯展示证据(component-dom) → deriveEfficiencyRoute 落 trivial。
// 目的：证明 trivial 档能真实跑通，并实测其 elapsedMs / 命令数 / 证据数以校准 budget。

import assert from 'node:assert/strict'
import { randomInt } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { docsSystemRoot, resolveProjectRoot } from './lib/roots.mjs'

const scriptDir = new URL('.', import.meta.url)
const docsTddCli = fileURLToPath(new URL('./docs-tdd.mjs', scriptDir))
const scriptPath = fileURLToPath(import.meta.url)
const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim()

function run(command, args, { cwd, env = process.env, timeout = 90000 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.error) throw result.error
  return result
}

function git(repo, args) {
  const result = run(realGit, args, { cwd: repo })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim())
  return result.stdout || ''
}

function allocateProjectId(parent, projectsRoot) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const projectId = `TR-${randomInt(10000, 100000)}`
    if (!existsSync(resolveProjectRoot(projectId, { projectsRoot })) && !existsSync(join(parent, projectId))) return projectId
  }
  throw new Error('unable to allocate an unused trivial-project E2E project ID')
}

function writeExecutable(file, content) {
  writeFileSync(file, content)
  chmodSync(file, 0o755)
}

function parseJsonOutput(result) {
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  return JSON.parse(result.stdout)
}

function removeOwnedProject(projectId, marker, projectsRoot) {
  const projectDir = resolveProjectRoot(projectId, { projectsRoot })
  const readme = join(projectDir, 'README.md')
  if (!existsSync(readme)) return
  if (!readFileSync(readme, 'utf8').includes(marker)) return
  rmSync(projectDir, { recursive: true, force: true })
}

function installFakeGit(binDir) {
  writeExecutable(join(binDir, 'git'), `#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
appendFileSync(process.env.DOCS_TDD_E2E_GIT_LOG, JSON.stringify(args) + '\\n')
const result = spawnSync(process.env.DOCS_TDD_E2E_REAL_GIT, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})
if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
`)
}

function installFakePnpm(binDir) {
  writeExecutable(join(binDir, 'pnpm'), `#!/usr/bin/env node
import { copyFileSync } from 'node:fs'
import { createServer } from 'node:http'

const args = process.argv.slice(2)
if (args[0] === '--version') {
  console.log('10.0.0-e2e')
  process.exit(0)
}
if (args[0] === 'install') process.exit(0)
if (args[0] === 'exec' && args[1] === 'shx' && args[2] === 'cp') {
  copyFileSync(args[3], args[4])
  process.exit(0)
}
if (args[0] === 'exec' && args[1] === 'next' && args[2] === 'dev') {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<html><body>trivial-project-e2e</body></html>')
  })
  const stop = () => server.close(() => process.exit(0))
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  server.listen(Number(process.env.PORT), '127.0.0.1', () => console.log('ready'))
} else {
  console.error('unsupported fake pnpm invocation: ' + JSON.stringify(args))
  process.exit(2)
}
`)
}

// fake codex：扫描 prompt。extraction 阶段产出「纯展示」需求(evidencePlan=component-dom)，
// checkpoint 阶段真实改写 src/label.js 的文案常量。
function installFakeCodex(binDir) {
  writeExecutable(join(binDir, 'codex'), `#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const outputIndex = args.indexOf('--output-last-message')
const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : ''
const prompt = args.at(-1) || ''

function section(label, nextLabel = '') {
  const start = prompt.indexOf(label)
  if (start < 0) throw new Error('missing prompt section: ' + label)
  const valueStart = start + label.length
  const end = nextLabel ? prompt.indexOf(nextLabel, valueStart) : prompt.length
  return JSON.parse(prompt.slice(valueStart, end < 0 ? prompt.length : end).trim())
}

let output
if (prompt.includes('Extraction scaffold:')) {
  const scaffold = section('Extraction scaffold:\\n')
  const source = scaffold.sourceUnits.find((unit) => String(unit.content || '').includes('src/label.js'))
  if (!source) throw new Error('semantic source unit was not found')
  output = {
    extractionFacts: [{
      factId: 'F-001',
      category: 'action',
      statement: 'Change the sign-in button copy from Sign in to Log in.',
      sourceIds: [source.sourceId],
      requirementIds: ['R-001'],
    }],
    requirements: [{
      requirementId: 'R-001',
      sourceAnchors: [{ type: source.type === 'table' ? 'table' : 'text', sourceId: source.sourceId }],
      statement: 'Change src/label.js to export the copy Log in.',
      status: 'doing',
      collectionSemantics: { kind: 'none', expectedCount: 0 },
      affectedSurfaces: [{ surfaceId: 'S-001', locator: 'src/label.js', disposition: 'implement' }],
      evidencePlan: [{ type: 'touched-file-quality', runtimeRequired: false }, { type: 'component-dom', runtimeRequired: false }],
    }],
    sourceUnitDispositions: [],
    evidenceCommands: [{
      evidenceId: 'E-001',
      kind: 'touched-file-quality',
      argv: ['node', 'tests/label.test.mjs'],
      requirementIds: ['R-001'],
      surfaceIds: ['S-001'],
    }, {
      evidenceId: 'E-002',
      kind: 'component-dom',
      argv: ['node', 'tests/label.test.mjs'],
      requirementIds: ['R-001'],
      surfaceIds: ['S-001'],
    }],
    routing: { scopeClass: 'local', riskSignals: [], verificationLevel: 'V0', routerVersion: 1 },
    apiDependency: { mode: 'no-request', reason: 'The change is an isolated copy literal.' },
    sourceReadiness: {
      figma: { requirement: 'not-required', status: 'not-required', reason: 'No visual redesign is requested.' },
      api: { requirement: 'not-required', status: 'not-required', reason: 'No API change is requested.' },
    },
    deliveryScope: null,
  }
} else {
  const packet = section('Action packet:\\n', '\\n\\nCompact implementation context:')
  writeFileSync(join(process.cwd(), 'src/label.js'), "export const label = 'Log in'\\n")
  output = {
    schemaVersion: 1,
    actionId: packet.actionId,
    outcome: 'completed',
    changedPaths: ['src/label.js'],
    discoveredSurfaces: [{ surfaceId: 'S-001', locator: 'src/label.js' }],
    coveredSurfaceIds: ['S-001'],
    integratedSourceKinds: [],
    msw: null,
    blockers: [],
  }
}

if (!outputFile) throw new Error('missing --output-last-message')
writeFileSync(outputFile, JSON.stringify(output))
`)
}

function installFakeClaude(binDir) {
  writeExecutable(join(binDir, 'claude'), `#!/usr/bin/env node
import { appendFileSync } from 'node:fs'

appendFileSync(process.env.DOCS_TDD_E2E_CLAUDE_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')
console.log(JSON.stringify({ verdict: 'pass', findings: [] }))
`)
}

function initializeConsumerRepo(repo) {
  mkdirSync(join(repo, 'src'), { recursive: true })
  mkdirSync(join(repo, 'tests'), { recursive: true })
  mkdirSync(join(repo, 'config/environments'), { recursive: true })
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  writeFileSync(join(repo, 'src/label.js'), "export const label = 'Sign in'\n")
  writeFileSync(join(repo, 'tests/label.test.mjs'), `import assert from 'node:assert/strict'
import { label } from '../src/label.js'

assert.equal(label, 'Log in')
console.log('label copy contract passed')
`)
  writeFileSync(join(repo, 'package.json'), `${JSON.stringify({ name: 'trivial-project-e2e', private: true, type: 'module' }, null, 2)}\n`)
  writeFileSync(join(repo, '.gitignore'), '.env.development.local\ndocs_tdd\n')
  writeFileSync(join(repo, 'config/environments/.env.test'), 'E2E=true\n')
  writeFileSync(join(repo, 'scripts/pwa-clean.mjs'), '')
  writeFileSync(join(repo, 'scripts/generate-key-modules.mjs'), '')
  git(repo, ['init', '-q', '-b', 'main'])
  git(repo, ['config', 'user.name', 'Trivial Project E2E'])
  git(repo, ['config', 'user.email', 'trivial-project-e2e@example.invalid'])
  git(repo, ['add', '.'])
  git(repo, ['commit', '-qm', 'initial fixture'])
}

function cleanupWorktree(repo, worktree, branch) {
  if (!existsSync(join(repo, '.git'))) return
  if (existsSync(worktree)) run(realGit, ['worktree', 'remove', '--force', worktree], { cwd: repo })
  run(realGit, ['worktree', 'prune'], { cwd: repo })
  run(realGit, ['branch', '-D', branch], { cwd: repo })
}

export function runTrivialProjectE2E() {
  assert.ok(realGit, 'git executable is required')
  const root = mkdtempSync(join(tmpdir(), 'vnext-trivial-project-e2e-'))
  const repo = join(root, 'consumer')
  const binDir = join(root, 'bin')
  const sourceRoot = mkdtempSync(join(docsSystemRoot, '.trivial-project-e2e-'))
  const projectRoot = join(root, 'isolated-projects')
  const projectId = allocateProjectId(root, projectRoot)
  const branch = `feature/${projectId}`
  const worktree = join(root, projectId)
  const marker = `trivial-project-e2e-${process.pid}-${randomInt(100000, 1000000)}`
  const source = join(sourceRoot, 'prd.md')
  const configPath = join(root, 'docs-tdd.config.json')
  const gitLog = join(root, 'git-calls.jsonl')
  const claudeLog = join(root, 'claude-calls.jsonl')

  try {
    mkdirSync(repo, { recursive: true })
    mkdirSync(binDir, { recursive: true })
    initializeConsumerRepo(repo)
    installFakeGit(binDir)
    installFakePnpm(binDir)
    installFakeCodex(binDir)
    installFakeClaude(binDir)
    writeFileSync(source, '# Trivial project E2E\n\nChange the sign-in button copy in `src/label.js` from `Sign in` to `Log in`.\n')
    writeFileSync(configPath, `${JSON.stringify({
      consumerRoot: repo,
      appSubpath: '.',
      docsMountPath: 'docs_tdd',
      baseRef: 'main',
      branchPrefix: 'feature/',
      verifyPath: '/',
      portRangeStart: 47000 + randomInt(0, 1000),
      larkOutputDir: `docs_tdd/prds/${projectId}/inbox/lark-sync`,
    }, null, 2)}\n`)
    writeFileSync(gitLog, '')
    writeFileSync(claudeLog, '')

    const env = {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH || ''}`,
      DOCS_TDD_CONFIG: configPath,
      DOCS_TDD_ISOLATED_PROJECTS_ROOT: projectRoot,
      DOCS_TDD_CODEX_BIN: join(binDir, 'codex'),
      DOCS_TDD_CLAUDE_BIN: join(binDir, 'claude'),
      DOCS_TDD_E2E_REAL_GIT: realGit,
      DOCS_TDD_E2E_GIT_LOG: gitLog,
      DOCS_TDD_E2E_CLAUDE_LOG: claudeLog,
      DOCS_TDD_AGENT_TIMEOUT_MS: '30000',
      DOCS_TDD_REVIEW_TIMEOUT_MS: '30000',
    }
    const result = run(process.execPath, [
      docsTddCli,
      'run',
      projectId,
      '--prd',
      source,
      '--title',
      marker,
      '--client',
      'codex',
    ], { cwd: repo, env, timeout: 120000 })
    const state = parseJsonOutput(result)
    const projectDir = resolveProjectRoot(projectId, { projectsRoot: projectRoot })
    const workItem = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
    const latest = JSON.parse(readFileSync(join(projectDir, 'latest-result.json'), 'utf8'))
    const head = git(worktree, ['rev-parse', 'HEAD']).trim()
    const committedPaths = git(worktree, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])
      .trim()
      .split('\n')
      .filter(Boolean)
    const status = git(worktree, ['status', '--short', '--', 'src/label.js']).trim()
    const evidence = run(process.execPath, ['tests/label.test.mjs'], { cwd: worktree })
    const gitCalls = readFileSync(gitLog, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    const claudeCalls = readFileSync(claudeLog, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    const persistedRunner = JSON.parse(readFileSync(join(projectDir, 'agent/runner-state.json'), 'utf8'))
    const trace = persistedRunner.trace

    const stateDetails = JSON.stringify(state, null, 2)
    assert.equal(state.status, 'complete', stateDetails)
    assert.equal(state.runner.outcome, 'complete', stateDetails)
    assert.equal(state.executionRoute, 'trivial', stateDetails)
    assert.equal(state.executionControl.synthetic, null)
    assert.equal(existsSync(join(docsSystemRoot, 'prds', projectId)), false, 'E2E project must not be persisted in canonical prds')
    assert.equal(latest.mode, 'enforced')
    assert.equal(latest.status, 'passed')
    assert.equal(latest.ok, true)
    assert.equal(workItem.autopilot.delivery.status, 'committed')
    assert.equal(workItem.autopilot.delivery.commitSha, head)
    assert.deepEqual(committedPaths, ['src/label.js'])
    assert.equal(status, '')
    assert.equal(evidence.status, 0, evidence.stderr)
    assert.equal(gitCalls.some((args) => args[0] === 'push'), false)
    assert.equal(claudeCalls.length, 0)
    assert.equal(trace.route, 'trivial')
    assert.equal(trace.assurance, 'V0')
    assert.equal(trace.reviewRounds, 0)
    assert.equal(trace.userInterruptCount, 0)
    assert.ok(trace.commandCount <= trace.budget.limits.commands, `commandCount ${trace.commandCount} > trivial budget ${trace.budget.limits.commands}\n${JSON.stringify(trace, null, 2)}`)
    assert.ok(trace.evidenceCount <= trace.budget.limits.evidence, `evidenceCount ${trace.evidenceCount} > trivial budget ${trace.budget.limits.evidence}\n${JSON.stringify(trace, null, 2)}`)
    assert.equal(trace.tokenUsage, null)
    assert.equal(readFileSync(join(worktree, 'src/label.js'), 'utf8'), "export const label = 'Log in'\n")

    console.log(`vNext trivial-project E2E passed (${projectId}): route=trivial, elapsedMs=${trace.elapsedMs}, commands=${trace.commandCount}/${trace.budget.limits.commands}, evidence=${trace.evidenceCount}/${trace.budget.limits.evidence}, reviewRounds=0, tokenUsage=null, scoped commit, no push`)
  } finally {
    cleanupWorktree(repo, worktree, branch)
    removeOwnedProject(projectId, marker, projectRoot)
    rmSync(join(process.env.HOME || '', '.cache/docs-tdd/evidence', projectId), { recursive: true, force: true })
    rmSync(sourceRoot, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  if (process.argv.includes('--self-test') || process.argv.includes('--run-real-agent')) {
    try {
      runTrivialProjectE2E()
    } catch (error) {
      appendFileSync(2, `${error.stack || error.message}\n`)
      process.exitCode = 1
    }
  } else {
    console.error('usage: vnext-trivial-project-e2e.mjs --self-test | --run-real-agent')
    process.exitCode = 2
  }
}
