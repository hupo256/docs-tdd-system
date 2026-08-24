#!/usr/bin/env node
/**
 * Changed-file 检测子系统：`docs-tdd changed`（跑 changed-file 静态扫描 + 可选 msw/prd 子检，带指纹缓存）
 * 与 `docs-tdd recommend`（按改动文件名推荐编码场景）。从 docs-tdd.mjs 抽出——那边只留薄路由，这坨
 * 随「新增子检 / 调整指纹口径 / 加场景推荐规则」增长的逻辑集中在此。
 *
 * 自成一体：自己 resolveRoots()、自己按相对位置定位同级子检脚本，不依赖调用方模块作用域。
 * 纯函数（safeLogLabel / conciseFailure）可 `--self-test` 直测。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectRoot, resolveRoots } from './roots.mjs'

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const { config } = resolveRoots()
const baseRef = () => config.baseRef || 'origin/online'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const readOptionalJson = (file) => (existsSync(file) ? readJson(file) : null)

function runCaptured(args, cwd) {
  const started = Date.now()
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    durationMs: Date.now() - started,
  }
}

// git 只读取值：非 0 退出返回空串（调用方按「无输出」处理，不抛）。
function gitOutput(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  return result.status === 0 ? result.stdout : ''
}

// 子检日志文件名：把任意 label 归一成安全文件名片段（小写、非字母数字折成 -、去首尾 -、截断）。纯函数。
export function safeLogLabel(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'check'
}

function persistCapturedLog(id, label, result) {
  const logDir = join(tmpdir(), 'docs-tdd-logs', id)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logFile = join(logDir, `${stamp}-${safeLogLabel(label)}.log`)
  mkdirSync(logDir, { recursive: true })
  writeFileSync(logFile, [`status: ${result.status}`, `durationMs: ${result.durationMs}`, '', '--- stdout ---', result.stdout.trim(), '', '--- stderr ---', result.stderr.trim(), ''].join('\n'))
  return logFile
}

// 从子进程 stdout/stderr 里挑出「可行动」的行（含 fail/block/error/... 关键词），无则回退全部；截断到 limit 行。纯函数。
export function conciseFailure(result, limit = 12) {
  const lines = `${result.stderr}\n${result.stdout}`.split('\n').map((line) => line.trim()).filter(Boolean)
  const actionable = lines.filter((line) => /\b(?:fail|block|error|warn|action|required|missing|invalid)\b/i.test(line))
  return (actionable.length ? actionable : lines).slice(0, limit)
}

// changed 指纹：跟踪差异 + untracked 内容 + PRD manifest hash + 项目关键文档内容 + effective 指纹。
// 任一变化即换缓存 key，命中缓存才敢跳过实跑子检。
function changedFingerprint(id, worktree, effectiveFingerprint) {
  const trackedDiff = gitOutput(['diff', '--binary', baseRef()], worktree)
  const untracked = gitOutput(['ls-files', '--others', '--exclude-standard'], worktree).trim().split('\n').filter(Boolean)
  const untrackedPayload = untracked
    .map((file) => {
      const absolute = join(worktree, file)
      return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : file
    })
    .join('\n')
  const projectDir = resolveProjectRoot(id)
  const prdFile = join(projectDir, 'agent/prd-source-manifest.json')
  const prdHash = existsSync(prdFile) ? createHash('sha256').update(readFileSync(prdFile)).digest('hex') : 'none'
  const projectDocs = ['product/00-feature-inventory.md', 'product/03-api-contract.md', 'product/04-frontend-tasks.md', 'product/06-collaboration.md', 'agent/project-manifest.json', 'agent/msw-manifest.json', 'agent/assumptions.json', 'agent/fast-track.json']
    .map((file) => {
      const absolute = join(projectDir, file)
      return existsSync(absolute) ? `${file}\n${readFileSync(absolute)}` : `${file}\nmissing`
    })
    .join('\n')
  return createHash('sha256').update(`changed-v2\n${id}\n${effectiveFingerprint}\n${prdHash}\n${projectDocs}\n${trackedDiff}\n${untrackedPayload}`).digest('hex').slice(0, 16)
}

// `docs-tdd changed`：跑 code-rules（+ 按 manifest pilot 开关跑 msw-manifest / prd-intake），带指纹缓存。
// 返回退出码：任一子检非 0 即非 0。noCache=true 跳过读写缓存（强制实跑）。
export function runChanged(id, worktree, effectiveFingerprint, { noCache = false } = {}) {
  const started = Date.now()
  const fingerprint = changedFingerprint(id, worktree, effectiveFingerprint)
  const cacheDir = join(tmpdir(), 'docs-tdd-check-cache')
  const cacheFile = join(cacheDir, `${id}-changed-${fingerprint}.json`)
  if (!noCache && existsSync(cacheFile)) {
    const cached = readJson(cacheFile)
    console.log(`changed: ${id} — PASS (cache=hit, checks=${cached.checks}, duration=${Date.now() - started}ms, fingerprint=${fingerprint})`)
    return 0
  }

  const projectManifest = readOptionalJson(join(resolveProjectRoot(id), 'agent/project-manifest.json'))
  const checks = [{ label: 'code-rules', args: [join(scriptsDir, 'verify-code-rules.mjs'), '--project', id] }]
  if (projectManifest?.pilot?.msw) checks.push({ label: 'msw-manifest', args: [join(scriptsDir, 'verify-msw-manifest.mjs'), id] })
  if (projectManifest?.pilot?.prdIntake) checks.push({ label: 'prd-intake', args: [join(scriptsDir, 'prd-intake.mjs'), id, '--stage', 'G2'] })

  let status = 0
  for (const check of checks) {
    const result = runCaptured(check.args, worktree)
    const logFile = persistCapturedLog(id, check.label, result)
    if (result.status === 0) console.log(`PASS ${check.label} (${result.durationMs}ms)`)
    else {
      status ||= result.status
      console.error(`FAIL ${check.label} (${result.durationMs}ms)`)
      for (const line of conciseFailure(result)) console.error(`  ${line}`)
      console.error(`  full log: ${logFile}`)
    }
  }
  const durationMs = Date.now() - started
  console.log(`changed: ${id} — ${status === 0 ? 'PASS' : 'BLOCK'} (cache=miss, checks=${checks.length}, duration=${durationMs}ms, fingerprint=${fingerprint})`)
  if (status === 0 && !noCache) {
    mkdirSync(cacheDir, { recursive: true })
    writeFileSync(cacheFile, `${JSON.stringify({ id, fingerprint, checks: checks.length, durationMs })}\n`)
  }
  return status
}

// changed 文件名 → 编码场景推荐映射（静态查表）；无命中则提示显式指定。命中即打印，无返回。
const SCENARIO_RULES = [
  { re: /(?:map[A-Z][^/]*|mapper)\.(?:ts|tsx)$/i, scenario: 'write_mapper' },
  { re: /(?:mocks?\/handlers|fixtures?|msw)/i, scenario: 'write_msw' },
  { re: /(?:use[A-Z][^/]*Query|query)\.(?:ts|tsx)$/i, scenario: 'write_query_hook' },
  { re: /\.(?:tsx|css|scss|less)$/, scenario: 'write_ui' },
  { re: /figma|07-figma-spec/i, scenario: 'write_figma' },
]
export function recommendScenarios(worktree) {
  const files = new Set(
    [
      ...gitOutput(['diff', '--name-only', baseRef()], worktree).trim().split('\n'),
      ...gitOutput(['ls-files', '--others', '--exclude-standard'], worktree).trim().split('\n'),
    ].filter(Boolean),
  )
  const recommendations = []
  for (const file of files) {
    for (const rule of SCENARIO_RULES) {
      if (rule.re.test(file) && !recommendations.some((item) => item.scenario === rule.scenario)) {
        recommendations.push({ scenario: rule.scenario, reason: file })
      }
    }
  }
  console.log(recommendations.length ? recommendations.map((item) => `${item.scenario}: ${item.reason}`).join('\n') : 'no scenario recommendation; choose explicitly')
}

// ---------------------------------------------------------------------------
// self-test：纯函数（日志名归一 / 失败行摘要）。node lib/changed-detection.mjs --self-test
// ---------------------------------------------------------------------------
function selfTest() {
  const assert = (cond, msg) => { if (!cond) { console.error(`[changed-detection] self-test failed: ${msg}`); process.exit(1) } }
  assert(safeLogLabel('Code Rules!!') === 'code-rules', 'label normalized')
  assert(safeLogLabel('') === 'check', 'empty label fallback')
  assert(safeLogLabel('---') === 'check', 'all-separator label fallback')
  const picked = conciseFailure({ stderr: 'ERROR: boom\nnoise line', stdout: 'all good\nmissing field' }, 5)
  assert(picked.length === 2 && picked[0] === 'ERROR: boom' && picked[1] === 'missing field', 'actionable lines picked')
  const fallback = conciseFailure({ stderr: '', stdout: 'line a\nline b\nline c' }, 2)
  assert(fallback.length === 2 && fallback[0] === 'line a', 'fallback to all lines + limit')
  console.log('PASS changed-detection (safeLogLabel + conciseFailure)')
}

if (process.argv[1] && process.argv[1].endsWith('changed-detection.mjs') && process.argv.includes('--self-test')) selfTest()
