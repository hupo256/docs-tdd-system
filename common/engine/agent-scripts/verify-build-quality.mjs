#!/usr/bin/env node
// G6-G8 checks with changed-file attribution.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { resolveSeverity } from './lib/rule-maturity.mjs'
import { parseValidationTierOptions, validationClassificationCheck, validationRequirements } from './lib/gate-payload.mjs'
import { activeWaivers, isWaived } from './lib/waiver-policy.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config } = resolveRoots()
const worktreeRoot = (() => {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd(), stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : repoRoot
})()

const args = process.argv.slice(2)

function readOption(name, fallback = '') {
  const index = args.indexOf(name)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

function hasFlag(name) {
  return args.includes(name)
}

const projectId = readOption('--project')
const baseRef = readOption('--base', config.baseRef || 'origin/online')
const explicitFiles = readOption('--files')
const json = hasFlag('--json')
const skipList = readOption('--skip')
  .split(',')
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean)
const writeBaseline = hasFlag('--write-baseline')
const productionBuild = hasFlag('--production-build')
const packageManager = readOption('--pm', 'pnpm')
const validationTierOptions = parseValidationTierOptions(args)
const validationTier = validationTierOptions.tier
const validationTierReason = validationTierOptions.reason
const projectManifest = projectId ? (() => {
  try { return JSON.parse(readFileSync(join(resolveProjectRoot(projectId), 'agent/project-manifest.json'), 'utf8')) } catch { return null }
})() : null
// VERIFY-TEST-002 severity comes from the shared ruleset; legacy fallback is preserved.
const ruleset = (() => {
  try { return JSON.parse(readFileSync(join(docsRoot, 'common/rules/ruleset.json'), 'utf8')) } catch { return null }
})()
const test002Rule = ruleset?.rules?.['VERIFY-TEST-002']
const test002Severity = test002Rule
  ? resolveSeverity({ rule: test002Rule, manifest: projectManifest })
  : ((projectManifest?.templateVersion || 0) >= 2 ? 'error' : 'warn')

function printHelp() {
  console.log(`usage: verify-build-quality.mjs [--project <PR-ID>] [--base <ref>] [--files <comma-list>]
                                [--validation-tier <MICRO|FOCUSED|FULL>] [--validation-tier-reason <text>]
                                [--skip <BIOME,TYPE,TEST>] [--write-baseline] [--pm <cmd>]
                                [--json] [--self-test] [--help]

Execute the machine-fact quality layer on this PR's changed files: biome, tsc, vitest.
Unlike evidence-text checks, every verdict here comes from a real child-process exit code.

Rules implemented:
  VERIFY-BIOME-001  biome check on changed js/ts/jsx/tsx/json (error)
  VERIFY-TYPE-001   tsc --noEmit; errors located in changed files must be zero (error)
  VERIFY-TYPE-002   repo-wide tsc error total vs recorded baseline, ripple detection (warn)
  VERIFY-TEST-001   vitest run on test files related to changed files (error)
  VERIFY-TEST-002   changed logic files (utils/helpers/mapper/store) have a related test (warn)
  VERIFY-PROD-BUILD-001 production build at G8 (error)

Options:
  --help            Show this help message and exit
  --project         Project ID; enables agent/tsc-baseline.json and waivers
  --base            Base ref for the changed-file diff (default: origin/online)
  --files           Comma-separated file list, skips git diff (for targeted runs)
  --validation-tier Validation matrix; defaults to FULL
  --validation-tier-reason Required for MICRO/FOCUSED and recorded as evidence
  --skip            Skip check families; each skip is reported as a non-passing check
  --write-baseline  Re-record the tsc baseline totals for this project
  --production-build Run the configured production build (used by G8)
  --pm              Package manager used to exec tools (default: pnpm)
  --json            Output JSON result to stdout
  --self-test       Run inline self-test`)
}

if (hasFlag('--help')) {
  printHelp()
  process.exit(0)
}
if (validationTierOptions.error) {
  console.error(`[verify-build-quality] ${validationTierOptions.error}`)
  process.exit(1)
}

/* ------------------------------------------------------------------ helpers */

function runGit(gitArgs) {
  const result = spawnSync('git', gitArgs, { cwd: worktreeRoot, stdio: 'pipe', encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

function splitLines(value) {
  return value ? value.split('\n').map((line) => line.trim()).filter(Boolean) : []
}

function toPosix(value) {
  return value.split(sep).join('/')
}

function normalizeFile(value) {
  const absolute = resolve(worktreeRoot, value)
  const rel = toPosix(relative(worktreeRoot, absolute))
  return rel.startsWith('..') ? '' : rel
}

const baseResolvable = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`], {
  cwd: worktreeRoot,
  stdio: 'pipe',
  encoding: 'utf8',
}).status === 0

function collectChangedFiles() {
  if (explicitFiles) {
    return explicitFiles
      .split(',')
      .map((file) => normalizeFile(file.trim()))
      .filter(Boolean)
      .filter((file) => existsSync(resolve(worktreeRoot, file)))
  }
  if (!baseResolvable) {
    console.error(`WARN: base ref \`${baseRef}\` 不可解析（未 fetch？）；仅扫本地 unstaged/staged/untracked 改动。`)
  }
  const files = new Set()
  for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR', `${baseRef}...HEAD`]))) files.add(file)
  for (const file of splitLines(runGit(['diff', '--name-only', '--diff-filter=ACMR']))) files.add(file)
  for (const file of splitLines(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR']))) files.add(file)
  for (const file of splitLines(runGit(['ls-files', '--others', '--exclude-standard']))) files.add(file)
  return [...files].filter((file) => existsSync(resolve(worktreeRoot, file)))
}

function isTestFile(file) {
  return /\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/.test(file)
}

function isTypeScriptSource(file) {
  return /\.(?:ts|tsx)$/.test(file) && !file.endsWith('.d.ts')
}

function isLintTarget(file) {
  return /\.(?:js|jsx|ts|tsx|json)$/.test(file)
}

// 需要单测的业务逻辑文件：纯函数聚集地 + 状态机 + mapper。UI 组件（.tsx）不在此列，
// 视觉/交互由人工走查负责（见 verification-division-of-labor.md §1）。
function needsUnitTest(file) {
  if (!/\.ts$/.test(file) || isTestFile(file) || file.endsWith('.d.ts')) return false
  if (!/^(?:apps|packages)\//.test(file)) return false
  return (
    /(?:^|\/)(?:utils?|helpers?|mappers?|lib)\//.test(file) ||
    /(?:^|\/)map[A-Z][A-Za-z0-9]*\.ts$/.test(file) ||
    /(?:^|\/)use[A-Z][A-Za-z0-9]*Store\.ts$/.test(file) ||
    /(?:^|\/)(?:format|calc|schemas?|selectors?)\.ts$/.test(file)
  )
}

const EXPORTED_LOGIC_RE = /export\s+(?:async\s+)?function\s|export\s+const\s+[A-Za-z_$][\w$]*\s*[:=]\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/

function hasExportedLogic(file) {
  try {
    return EXPORTED_LOGIC_RE.test(readFileSync(resolve(worktreeRoot, file), 'utf8'))
  } catch {
    return false
  }
}

// 与某个源文件相关的测试文件：同目录同名、或同目录 test/__tests__ 下同名。
export function relatedTestCandidates(file) {
  const dir = dirname(file)
  const stem = basename(file).replace(/\.(?:ts|tsx|js|jsx)$/, '')
  const candidates = []
  for (const kind of ['test', 'spec']) {
    for (const ext of ['ts', 'tsx']) {
      candidates.push(toPosix(join(dir, `${stem}.${kind}.${ext}`)))
      candidates.push(toPosix(join(dir, '__tests__', `${stem}.${kind}.${ext}`)))
      candidates.push(toPosix(join(dir, 'test', `${stem}.${kind}.${ext}`)))
    }
  }
  return candidates
}

function stripScriptExtension(file) {
  return file.replace(/\.(?:ts|tsx|js|jsx)$/, '')
}

export function testImportsSource(testFile, sourceFile, source) {
  const expected = stripScriptExtension(toPosix(resolve(worktreeRoot, sourceFile)))
  const testDir = dirname(resolve(worktreeRoot, testFile))
  const importPattern = /\b(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (!specifier.startsWith('.')) continue
    const imported = stripScriptExtension(toPosix(resolve(testDir, specifier)))
    if (imported === expected) return true
  }
  return false
}

function findImportingTests(file) {
  const dir = dirname(file)
  const tests = []
  for (const candidateDir of [dir, join(dir, '__tests__'), join(dir, 'test')]) {
    const absoluteDir = resolve(worktreeRoot, candidateDir)
    if (!existsSync(absoluteDir)) continue
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const candidate = toPosix(join(candidateDir, entry.name))
      if (!isTestFile(candidate)) continue
      try {
        const source = readFileSync(resolve(worktreeRoot, candidate), 'utf8')
        if (testImportsSource(candidate, file, source)) tests.push(candidate)
      } catch {
        // 单个测试文件不可读时不阻断发现流程，后续缺测试规则会保持可见。
      }
    }
  }
  return tests
}

export function collectRelatedTests(changedFiles, exists, importingTests = () => []) {
  const tests = new Set(changedFiles.filter(isTestFile))
  for (const file of changedFiles) {
    if (isTestFile(file) || !/\.(?:ts|tsx)$/.test(file)) continue
    for (const candidate of relatedTestCandidates(file)) {
      if (exists(candidate)) tests.add(candidate)
    }
    for (const candidate of importingTests(file)) tests.add(candidate)
  }
  return [...tests].sort()
}

export function groupTestsByVitestRoot(testFiles, hasConfig) {
  const groups = new Map()
  for (const file of testFiles) {
    let root = dirname(file)
    while (!hasConfig(root)) {
      const parent = dirname(root)
      if (parent === root) break
      root = parent
    }
    if (!hasConfig(root)) root = '.'
    const files = groups.get(root) || []
    files.push(file)
    groups.set(root, files)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([root, files]) => ({ root, files: files.sort() }))
}

// tsc 的报错路径相对于 tsconfig 所在目录，必须换算成 worktree 相对路径才能与 changedFiles 比对。
export function parseTscErrors(stdout, appRoot) {
  const errors = []
  for (const line of stdout.split('\n')) {
    const match = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s*(.*)$/.exec(line.trim())
    if (!match) continue
    const [, rawFile, lineNo, , code, message] = match
    errors.push({ file: resolveWithin(appRoot, rawFile), rawFile, line: Number(lineNo), code, message, sourceRoot: appRoot })
  }
  return errors
}

// appRoot 是 worktree 相对路径（如 apps/web），rawFile 可能是 ../../packages/... 形式。
function resolveWithin(appRoot, rawFile) {
  const segments = [...appRoot.split('/'), ...rawFile.split('/')]
  const stack = []
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return stack.join('/')
}

// 从改动文件推导需要 typecheck 的 app 根目录。packages/** 改动统一挂到 apps/web，
// 因为 web 的 tsconfig 会把 packages 源码纳入编译（xSign.ts 等已在报错清单里可证）。
export function deriveTypecheckRoots(changedFiles, hasTsconfig, configuredRoots = ['apps/web', 'apps/admin']) {
  const roots = new Set()
  for (const file of changedFiles) {
    for (const root of configuredRoots) {
      if ((file === root || file.startsWith(`${root}/`)) && hasTsconfig(root)) roots.add(root)
    }
    const primaryRoot = configuredRoots[0]
    if (file.startsWith('packages/') && primaryRoot && hasTsconfig(primaryRoot)) roots.add(primaryRoot)
  }
  return [...roots].sort()
}

/* --------------------------------------------------------------- execution */

const logDir = join(tmpdir(), 'docs-tdd-logs', projectId || 'unscoped')

function persistLog(label, result) {
  const stamp = result.startedAt.replace(/[:.]/g, '-')
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'run'
  const file = join(logDir, `${stamp}-${safeLabel}.log`)
  mkdirSync(logDir, { recursive: true })
  writeFileSync(
    file,
    [
      `command: ${result.command}`,
      `cwd: ${result.cwd}`,
      `startedAt: ${result.startedAt}`,
      `finishedAt: ${result.finishedAt}`,
      `status: ${result.status ?? 'null'}`,
      '',
      '--- stdout ---',
      result.stdout,
      '',
      '--- stderr ---',
      result.stderr,
      '',
    ].join('\n'),
  )
  return file
}

function execTool(label, command, commandArgs, cwd) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 })
  const payload = {
    label,
    command: [command, ...commandArgs].join(' '),
    cwd: toPosix(relative(worktreeRoot, cwd)) || '.',
    startedAt,
    finishedAt: new Date().toISOString(),
    status: result.status,
    spawnError: result.error ? result.error.message : null,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  }
  payload.logFile = persistLog(label, payload)
  return payload
}

const checks = []
const commands = []

function addCheck({ ruleId, ok, severity = 'error', message, file = '', run = null, counts = null, disposition = 'executed' }) {
  if (run) commands.push({ label: run.label, command: run.command, cwd: run.cwd, status: run.status, ok: run.status === 0, logFile: run.logFile })
  checks.push({
    ruleId,
    ok,
    severity,
    message,
    file,
    category: 'build-quality',
    disposition,
    evidence: run ? { command: run.command, cwd: run.cwd, status: run.status, logFile: run.logFile, counts } : counts ? { counts } : null,
  })
}

function addNotRequired(ruleId, message, counts = null) {
  addCheck({ ruleId, ok: true, message, counts, disposition: 'not-required' })
}

function skipped(family) {
  return skipList.includes(family)
}

/* -------------------------------------------------------------- self-test */

function selfTest() {
  const failures = []
  const expect = (name, condition) => {
    if (!condition) failures.push(name)
  }

  // 改动文件归因：tsc 报错路径换算
  const parsed = parseTscErrors(
    [
      'src/apps/Prediction/index.tsx(12,3): error TS2322: Type mismatch.',
      '../../packages/utils/xSign.ts(35,35): error TS2345: Argument of type string.',
      'not an error line',
    ].join('\n'),
    'apps/web',
  )
  expect('tsc parse count', parsed.length === 2)
  expect('tsc app-relative normalization', parsed[0].file === 'apps/web/src/apps/Prediction/index.tsx')
  expect('tsc cross-package normalization', parsed[1].file === 'packages/utils/xSign.ts')
  expect('tsc code captured', parsed[0].code === 'TS2322')

  // typecheck 根推导
  const hasTsconfig = (root) => ['apps/web', 'apps/admin'].includes(root)
  expect(
    'typecheck roots from apps',
    JSON.stringify(deriveTypecheckRoots(['apps/web/src/a.ts', 'apps/admin/src/b.ts'], hasTsconfig)) === JSON.stringify(['apps/admin', 'apps/web']),
  )
  expect('packages change maps to apps/web', JSON.stringify(deriveTypecheckRoots(['packages/utils/x.ts'], hasTsconfig)) === JSON.stringify(['apps/web']))
  expect('unknown app root ignored', deriveTypecheckRoots(['apps/cms/src/a.ts'], hasTsconfig).length === 0)

  // 相关测试收集
  const present = new Set([
    'apps/web/src/utils/fee.test.ts',
    'apps/web/src/apps/X/__tests__/calc.test.ts',
    'apps/web-next/src/apps/Prediction/mappers/test/mapTagEventsToPrediction.test.ts',
  ])
  const related = collectRelatedTests(
    [
      'apps/web/src/utils/fee.ts',
      'apps/web/src/apps/X/calc.ts',
      'apps/web-next/src/apps/Prediction/mappers/mapTagEventsToPrediction.ts',
      'apps/web/src/apps/Y/untested.ts',
      'apps/web/src/z.test.ts',
    ],
    (file) => present.has(file),
  )
  expect('related tests include sibling', related.includes('apps/web/src/utils/fee.test.ts'))
  expect('related tests include __tests__', related.includes('apps/web/src/apps/X/__tests__/calc.test.ts'))
  expect(
    'related tests include test directory',
    related.includes('apps/web-next/src/apps/Prediction/mappers/test/mapTagEventsToPrediction.test.ts'),
  )
  expect('related tests include changed test file', related.includes('apps/web/src/z.test.ts'))
  expect('related tests exclude untested source', related.length === 4)
  expect(
    'direct relative import links a differently named test',
    testImportsSource('apps/web/src/apps/X/ongoingGroup.test.ts', 'apps/web/src/apps/X/format.ts', "import { group } from './format'"),
  )
  expect(
    'unrelated relative import does not link source',
    !testImportsSource('apps/web/src/apps/X/ongoingGroup.test.ts', 'apps/web/src/apps/X/format.ts', "import { group } from './other'"),
  )
  const importRelated = collectRelatedTests(
    ['apps/web/src/apps/X/format.ts'],
    () => false,
    () => ['apps/web/src/apps/X/ongoingGroup.test.ts'],
  )
  expect('related tests include direct importers', importRelated[0] === 'apps/web/src/apps/X/ongoingGroup.test.ts')
  const testGroups = groupTestsByVitestRoot(
    ['apps/web/src/a.test.ts', 'apps/web-next/src/a.test.ts'],
    (root) => root === '.' || root === 'apps/web-next',
  )
  expect('vitest tests grouped by nearest config', JSON.stringify(testGroups) === JSON.stringify([
    { root: '.', files: ['apps/web/src/a.test.ts'] },
    { root: 'apps/web-next', files: ['apps/web-next/src/a.test.ts'] },
  ]))
  expect('vitest root fallback', groupTestsByVitestRoot(['apps/unknown/src/a.test.ts'], () => false)[0]?.root === '.')

  // needsUnitTest 边界
  expect('utils dir needs test', needsUnitTest('apps/web/src/utils/fee.ts'))
  expect('mapper file needs test', needsUnitTest('apps/web/src/services/api/x/mapTagEvents.ts'))
  expect('store file needs test', needsUnitTest('apps/web/src/store/useOrderStore.ts'))
  expect('tsx component does not need test', !needsUnitTest('apps/web/src/apps/X/Card.tsx'))
  expect('test file itself excluded', !needsUnitTest('apps/web/src/utils/fee.test.ts'))
  expect('d.ts excluded', !needsUnitTest('apps/web/src/utils/env.d.ts'))
  expect('non-app path excluded', !needsUnitTest('scripts/utils/tool.ts'))

  // 导出逻辑识别
  expect('exported function detected', EXPORTED_LOGIC_RE.test('export function add(a: number) { return a }'))
  expect('exported arrow detected', EXPORTED_LOGIC_RE.test('export const add = (a: number) => a'))
  expect('exported async arrow detected', EXPORTED_LOGIC_RE.test('export const load = async () => 1'))
  expect('type-only export not logic', !EXPORTED_LOGIC_RE.test('export type Foo = { a: number }'))
  expect('const literal not logic', !EXPORTED_LOGIC_RE.test("export const NAME = 'x'"))

  // biome「0 files」不算通过
  expect('biome zero-file guard fails', biomeVerdict({ status: 0, stdout: 'Checked 0 files in 3ms.' }, 5).ok === false)
  expect('biome real pass', biomeVerdict({ status: 0, stdout: 'Checked 58 files in 37ms.' }, 58).ok === true)
  expect('biome nonzero exit fails', biomeVerdict({ status: 1, stdout: 'Checked 58 files. Found 2 errors.' }, 58).ok === false)
  expect('biome parses checked count', biomeVerdict({ status: 0, stdout: 'Checked 58 files in 37ms.' }, 58).checked === 58)
  expect('biome counts errors', biomeVerdict({ status: 1, stdout: 'Found 2 errors.\nFound 3 warnings.' }, 5).errors === 2)
  expect(
    'biome diagnostics parsed',
    JSON.stringify(
      biomeDiagnostics(
        [
          'apps/web/src/a.tsx:69:3 lint/correctness/useExhaustiveDependencies  FIXABLE  ━━━',
          'apps/web/src/b.tsx format ━━━━━',
          'unrelated output line',
        ].join('\n'),
      ),
    ) === JSON.stringify(['apps/web/src/a.tsx:69 lint/correctness/useExhaustiveDependencies', 'apps/web/src/b.tsx format']),
  )

  // vitest 结果解析
  expect('vitest pass parsed', vitestVerdict({ status: 0, stdout: ' Test Files  11 passed (11)\n Tests  82 passed (82)' }, 11).ok === true)
  expect('vitest fail parsed', vitestVerdict({ status: 1, stdout: ' Test Files  1 failed | 10 passed (11)' }, 11).ok === false)
  expect('vitest zero-collected fails', vitestVerdict({ status: 0, stdout: 'No test files found' }, 3).ok === false)

  // 基线只影响 warn
  expect('ripple warn when outside errors grow', rippleVerdict({ total: 210, inChanged: 0, baselineTotal: 193 }).ok === false)
  expect('ripple ok when equal', rippleVerdict({ total: 193, inChanged: 0, baselineTotal: 193 }).ok === true)
  expect('ripple ignores own new errors', rippleVerdict({ total: 200, inChanged: 7, baselineTotal: 193 }).ok === true)
  expect('ripple ok without baseline', rippleVerdict({ total: 999, inChanged: 0, baselineTotal: null }).ok === true)
  expect('production build exit 0 passes', productionBuildVerdict({ status: 0, spawnError: null }).ok === true)
  expect('production build spawn/exit failure blocks', productionBuildVerdict({ status: 1, spawnError: 'ENOENT' }).ok === false)
  if (failures.length) {
    console.error(`verify-build-quality self-test FAILED:\n  ${failures.join('\n  ')}`)
    process.exit(1)
  }
  console.log('verify-build-quality self-test passed (40 predicate cases).')
  process.exit(0)
}

// biome 判定：退出码 0 且实际检查文件数 > 0。execution-evidence.md 明确「Checked 0 files 不算通过证据」。
export function biomeVerdict(run, candidateCount) {
  const text = `${run.stdout}\n${run.stderr || ''}`
  const match = /Checked\s+(\d+)\s+files?/i.exec(text)
  const checked = match ? Number(match[1]) : null
  const errors = Number(/Found\s+(\d+)\s+errors?/i.exec(text)?.[1] ?? 0)
  const warnings = Number(/Found\s+(\d+)\s+warnings?/i.exec(text)?.[1] ?? 0)
  const diagnostics = biomeDiagnostics(text)
  if (run.status !== 0) return { ok: false, checked, errors, warnings, diagnostics, reason: `biome 报 ${errors} error / ${warnings} warning：${diagnostics.slice(0, 4).join('; ') || '详见日志'}` }
  if (candidateCount > 0 && (checked === null || checked === 0)) {
    return { ok: false, checked, errors, warnings, diagnostics, reason: `候选 ${candidateCount} 个文件但 biome 实际检查 ${checked ?? '未知'} 个，0 files 不算通过证据` }
  }
  return { ok: true, checked, errors, warnings, diagnostics, reason: '' }
}

// biome 的诊断头行形如 `path:line:col rule/name  FIXABLE  ━━━` 或 `path format ━━━`。
export function biomeDiagnostics(text) {
  const found = []
  for (const line of text.split('\n')) {
    const match = /^(\S+?)(?::(\d+):(\d+))?\s+((?:lint|assist)\/\S+|format)\s+/.exec(line)
    if (!match) continue
    const [, file, lineNo, , rule] = match
    found.push(`${file}${lineNo ? `:${lineNo}` : ''} ${rule}`)
  }
  return found
}

export function vitestVerdict(run, selectedCount) {
  const text = `${run.stdout}\n${run.stderr || ''}`
  const match = /Test Files\s+(.*)$/m.exec(text)
  const summary = match ? match[1].trim() : ''
  if (/No test files found/i.test(text)) return { ok: false, summary, reason: `选中 ${selectedCount} 个测试文件但 vitest 未收集到任何测试` }
  if (run.status !== 0) return { ok: false, summary, reason: 'vitest 退出码非 0' }
  return { ok: true, summary, reason: '' }
}

// 存量涟漪：本次改动之外的报错总数不得超过基线。只做 warn，因此基线被改的收益上限是少一个 warn。
export function rippleVerdict({ total, inChanged, baselineTotal }) {
  if (baselineTotal === null || baselineTotal === undefined) return { ok: true, outside: total - inChanged, reason: '' }
  const outside = total - inChanged
  if (outside > baselineTotal) {
    return { ok: false, outside, reason: `改动文件之外的 tsc 报错 ${outside} > 基线 ${baselineTotal}，疑似共享类型改动涟漪` }
  }
  return { ok: true, outside, reason: '' }
}

export function productionBuildVerdict(run) {
  return { ok: run?.status === 0 && !run?.spawnError }
}

if (hasFlag('--self-test')) selfTest()

/* ------------------------------------------------------------------- main */

const changedFiles = collectChangedFiles().filter((file) => /^(?:apps|packages)\//.test(file) || file === 'package.json')
const changedSet = new Set(changedFiles)
const baselineFile = projectId ? join(resolveProjectRoot(projectId), 'agent/tsc-baseline.json') : ''

function readBaseline() {
  if (!baselineFile || !existsSync(baselineFile)) return { version: 1, baseRef, roots: {} }
  try {
    const parsed = JSON.parse(readFileSync(baselineFile, 'utf8'))
    return parsed && typeof parsed === 'object' && parsed.roots ? parsed : { version: 1, baseRef, roots: {} }
  } catch {
    return { version: 1, baseRef, roots: {} }
  }
}

const baseline = readBaseline()
let baselineDirty = false
const requirements = validationRequirements(validationTier)

checks.push(validationClassificationCheck(validationTier, validationTierReason))

// ---- VERIFY-BIOME-001 -------------------------------------------------------
{
  const targets = changedFiles.filter(isLintTarget)
  if (!requirements.biome) {
    addNotRequired('VERIFY-BIOME-001', `${validationTier}：Biome not-required`, { candidates: targets.length })
  } else if (skipped('BIOME')) {
    addCheck({ ruleId: 'VERIFY-BIOME-001', ok: false, severity: 'warn', message: '--skip BIOME：静态检查被跳过，不构成通过证据' })
  } else if (!targets.length) {
    addCheck({ ruleId: 'VERIFY-BIOME-001', ok: true, message: '本次无 js/ts/jsx/tsx/json 改动，biome 不适用', counts: { candidates: 0 } })
  } else {
    const run = execTool('biome-check', packageManager, ['exec', 'biome', 'check', '--no-errors-on-unmatched', ...targets], worktreeRoot)
    const verdict = biomeVerdict(run, targets.length)
    addCheck({
      ruleId: 'VERIFY-BIOME-001',
      ok: verdict.ok,
      message: verdict.ok
        ? `biome check 通过：实检 ${verdict.checked} / 候选 ${targets.length} 个文件`
        : `biome check 未通过（${verdict.reason}）；详见 ${run.logFile}`,
      run,
      counts: { candidates: targets.length, checked: verdict.checked, errors: verdict.errors, warnings: verdict.warnings, diagnostics: verdict.diagnostics.slice(0, 20) },
    })
  }
}

// ---- VERIFY-TYPE-001 / VERIFY-TYPE-002 --------------------------------------
{
  const roots = deriveTypecheckRoots(changedFiles, (root) => existsSync(join(worktreeRoot, root, 'tsconfig.json')), config.typecheckRoots || ['apps/web', 'apps/admin'])
  if (!requirements.type) {
    addNotRequired('VERIFY-TYPE-001', `${validationTier}：typecheck not-required`, { roots: roots.length })
    addNotRequired('VERIFY-TYPE-002', `${validationTier}：typecheck ripple detection not-required`, { roots: roots.length })
  } else if (skipped('TYPE')) {
    addCheck({ ruleId: 'VERIFY-TYPE-001', ok: false, severity: 'warn', message: '--skip TYPE：类型检查被跳过，不构成通过证据' })
  } else if (!roots.length) {
    addCheck({ ruleId: 'VERIFY-TYPE-001', ok: true, message: '本次改动未落在任何带 tsconfig 的 app 下，typecheck 不适用', counts: { roots: 0 } })
  } else {
    for (const root of roots) {
      const run = execTool(`tsc-${root.replace(/\//g, '-')}`, packageManager, ['exec', 'tsc', '--project', './tsconfig.json', '--noEmit', '--pretty', 'false'], join(worktreeRoot, root))
      if (run.spawnError) {
        addCheck({ ruleId: 'VERIFY-TYPE-001', ok: false, message: `${root} typecheck 无法执行：${run.spawnError}`, file: root, run })
        continue
      }
      const errors = parseTscErrors(`${run.stdout}\n${run.stderr}`, root)
      const inChanged = errors.filter((error) => changedSet.has(error.file))
      // tsc 退出码非 0 但一条都没解析出来 = 编译器自身失败（配置错、OOM），不能当通过。
      if (run.status !== 0 && !errors.length) {
        addCheck({ ruleId: 'VERIFY-TYPE-001', ok: false, message: `${root} tsc 退出码 ${run.status} 但未解析到具体报错，视为执行失败；详见 ${run.logFile}`, file: root, run })
        continue
      }
      addCheck({
        ruleId: 'VERIFY-TYPE-001',
        ok: inChanged.length === 0,
        message: inChanged.length
          ? `${root} 本次改动文件存在 ${inChanged.length} 处类型错误：${inChanged.slice(0, 5).map((e) => `${e.file}:${e.line} ${e.code}`).join('; ')}${inChanged.length > 5 ? ' …' : ''}`
          : `${root} 改动文件类型检查通过（全仓 ${errors.length} 处存量报错不阻断）`,
        file: inChanged[0]?.file || root,
        run,
        counts: { total: errors.length, inChangedFiles: inChanged.length },
      })

      const recorded = baseline.roots?.[root]
      const baselineTotal = typeof recorded?.total === 'number' ? recorded.total : null
      if (baselineTotal === null || writeBaseline) {
        if (baselineFile) {
          baseline.roots[root] = { total: errors.length - inChanged.length, recordedAt: new Date().toISOString(), headSha: runGit(['rev-parse', 'HEAD']), baseRef }
          baselineDirty = true
        }
        addCheck({
          ruleId: 'VERIFY-TYPE-002',
          ok: true,
          severity: 'warn',
          message: `${root} tsc 存量基线${writeBaseline ? '已重记' : '首次记录'}：${errors.length - inChanged.length} 处（本次不做涟漪判定）`,
          file: root,
          counts: { total: errors.length, baseline: errors.length - inChanged.length },
        })
      } else {
        const ripple = rippleVerdict({ total: errors.length, inChanged: inChanged.length, baselineTotal })
        // 存量减少时下调基线，避免修好的债被后来者当额度用掉。
        if (ripple.ok && baselineFile && ripple.outside < baselineTotal) {
          baseline.roots[root] = { ...recorded, total: ripple.outside, recordedAt: new Date().toISOString(), headSha: runGit(['rev-parse', 'HEAD']), baseRef }
          baselineDirty = true
        }
        addCheck({
          ruleId: 'VERIFY-TYPE-002',
          ok: ripple.ok,
          severity: 'warn',
          message: ripple.ok
            ? `${root} 存量 tsc 报错未增加（改动外 ${ripple.outside} ≤ 基线 ${baselineTotal}）`
            : ripple.reason,
          file: root,
          counts: { total: errors.length, outsideChanged: ripple.outside, baseline: baselineTotal },
        })
      }
    }
  }
}

// ---- VERIFY-TEST-001 --------------------------------------------------------
{
  const relatedTests = collectRelatedTests(
    changedFiles,
    (file) => existsSync(resolve(worktreeRoot, file)),
    findImportingTests,
  )
  if (!requirements.test) {
    addNotRequired('VERIFY-TEST-001', `${validationTier}：测试 not-required`, { selected: relatedTests.length })
  } else if (skipped('TEST')) {
    addCheck({ ruleId: 'VERIFY-TEST-001', ok: false, severity: 'warn', message: '--skip TEST：单测被跳过，不构成通过证据' })
  } else if (!relatedTests.length && requirements.test === 'existing') {
    addNotRequired('VERIFY-TEST-001', 'FOCUSED：未发现既有相关测试，不为本次改动机械新增测试文件', { selected: 0 })
  } else if (!relatedTests.length) {
    // 没有相关测试不是「通过」，是缺证据；由 VERIFY-TEST-002 指出该补哪些。
    addCheck({
      ruleId: 'VERIFY-TEST-001',
      ok: !changedFiles.some((file) => isTypeScriptSource(file)),
      severity: 'warn',
      message: changedFiles.some((file) => isTypeScriptSource(file))
        ? '本次有 ts/tsx 改动但未找到任何相关测试文件，无单测证据'
        : '本次无 ts/tsx 改动，单测不适用',
      counts: { selected: 0 },
    })
  } else {
    const configNames = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.mjs', 'vitest.config.js', 'vitest.config.cjs', 'vitest.config.cts']
    const groups = groupTestsByVitestRoot(
      relatedTests,
      (root) => configNames.some((name) => existsSync(resolve(worktreeRoot, root, name))),
    )
    for (const { root, files } of groups) {
      const cwd = resolve(worktreeRoot, root)
      const testFiles = files.map((file) => root === '.' ? file : toPosix(relative(root, file)))
      const label = root === '.' ? 'vitest-related-root' : `vitest-related-${root}`
      const run = execTool(label, packageManager, ['exec', 'vitest', 'run', ...testFiles], cwd)
      const verdict = vitestVerdict(run, files.length)
      addCheck({
        ruleId: 'VERIFY-TEST-001',
        ok: verdict.ok,
        message: verdict.ok
          ? `${root} vitest 通过：${files.length} 个相关测试文件（${verdict.summary || 'summary 未解析'}）`
          : `${root} vitest 未通过（${verdict.reason}）；详见 ${run.logFile}`,
        file: root === '.' ? '' : root,
        run,
        counts: { selected: files.length, summary: verdict.summary },
      })
    }
  }
}

// ---- VERIFY-TEST-002 --------------------------------------------------------
{
  const missing = changedFiles
    .filter((file) => needsUnitTest(file) && hasExportedLogic(file))
    .filter(
      (file) =>
        !relatedTestCandidates(file).some((candidate) => existsSync(resolve(worktreeRoot, candidate))) &&
        findImportingTests(file).length === 0,
    )
  if (validationTier !== 'FULL') {
    addNotRequired('VERIFY-TEST-002', `${validationTier}：不机械要求局部逻辑新增测试；由 Review 按测试触发条件判断`, { missing: missing.length })
  } else {
    addCheck({
      ruleId: 'VERIFY-TEST-002',
      ok: missing.length === 0,
      severity: test002Severity,
      message: missing.length
        ? `以下逻辑文件导出了函数，但未找到同名测试或邻近目录中直接导入它的测试：${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` 等 ${missing.length} 个` : ''}`
        : '改动的逻辑文件均有相关单测',
      file: missing[0] || '',
      counts: { missing: missing.length },
    })
  }
}

// ---- VERIFY-PROD-BUILD-001 -------------------------------------------------
if (!requirements.build) {
  addNotRequired('VERIFY-PROD-BUILD-001', `${validationTier}：production build not-required`)
} else if (productionBuild) {
  const buildCommand = Array.isArray(config.productionBuild) ? config.productionBuild.filter(Boolean) : []
  if (!buildCommand.length) {
    addCheck({ ruleId: 'VERIFY-PROD-BUILD-001', ok: false, message: 'G8 要求 production build，但 docs-tdd.config.json 未配置 productionBuild' })
  } else {
    const [command, ...commandArgs] = buildCommand
    const run = execTool('production-build', command, commandArgs, worktreeRoot)
    const verdict = productionBuildVerdict(run)
    addCheck({
      ruleId: 'VERIFY-PROD-BUILD-001',
      ok: verdict.ok,
      message: verdict.ok
        ? `production build 通过：${buildCommand.join(' ')}`
        : `production build 失败：${buildCommand.join(' ')}；详见 ${run.logFile}`,
      run,
    })
  }
}

/* ------------------------------------------------------------- waivers/out */

// 与 verify-code-rules / verify-project-gate 同口径：命中的 error 只被「生命周期 active」的 waiver
// （具名 + 有理由 + ISO 期限且未过期）降级为 waived。判据统一走 waiver-policy.mjs，避免三处口径分裂。
function applyWaivers(list) {
  if (!projectId) return
  const waiverFile = join(resolveProjectRoot(projectId), 'agent/rule-waivers.json')
  if (!existsSync(waiverFile)) return
  let waivers
  try {
    waivers = JSON.parse(readFileSync(waiverFile, 'utf8'))
  } catch {
    return
  }
  const active = activeWaivers(waivers, new Date().toISOString().slice(0, 10))
  for (const check of list) {
    if (check.ok || check.severity !== 'error') continue
    if (isWaived(active, { ruleId: check.ruleId, file: check.file })) {
      check.severity = 'waived'
    }
  }
}

applyWaivers(checks)

if (baselineDirty && baselineFile) {
  mkdirSync(dirname(baselineFile), { recursive: true })
  baseline.version = 1
  baseline.baseRef = baseRef
  baseline.generatedAt = new Date().toISOString()
  writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`)
}

const result = {
  ok: checks.filter((check) => !check.ok && check.severity === 'error').length === 0,
  tool: 'verify-build-quality.mjs',
  projectId: projectId || null,
  baseRef,
  baseResolvable,
  validationTier,
  validationTierReason,
  changedFileCount: changedFiles.length,
  skipped: skipList,
  baselineFile: baselineFile ? toPosix(relative(repoRoot, baselineFile)) : null,
  checks,
  commands,
}

if (json) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`verify-build-quality: ${changedFiles.length} changed file(s), base=${baseRef}`)
  for (const check of checks) {
    const label = check.ok ? 'PASS' : check.severity.toUpperCase()
    console.log(`${label} ${check.ruleId} ${check.message}`)
  }
  for (const command of commands) {
    console.log(`  cmd ${command.label}: exit=${command.status ?? 'null'} log=${command.logFile}`)
  }
}

process.exit(result.ok ? 0 : 1)
