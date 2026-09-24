#!/usr/bin/env node
// precommit-verify-code-rules.mjs — lint-staged glue for code rules plus the v2 commit guard.
// v4.0: 按 efficiencyRoute 分档验证，micro/lite 走轻量守卫，standard/high-risk 走完整守卫。
// lint-staged passes each staged file as a separate argv entry; verify-code-rules.mjs wants one
// --files <comma-list> argument, so this joins argv before dispatching. On v2 project branches the
// read-only guard defaults to checkpoint mode: only enforce a prior passing dev-check when one
// exists. Ordinary development commits do not require system-repo evidence/verify or latest-result
// PASS. Set DOCS_TDD_COMMIT_MODE=delivery to require authoritative CLI-attested PASS (final delivery).
// Any violation or inability to run either applicable guard blocks the commit.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const T = 20000

function stagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'cannot list staged files')
  return result.stdout.split('\0').filter(Boolean)
}

function runCodeRules(files) {
  if (!files.length) return
  const script = join(SCRIPT_DIR, 'verify-code-rules.mjs')
  const result = spawnSync('node', [script, '--files', files.join(','), '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (result.status === 1 && result.stdout) {
    let payload
    try {
      payload = JSON.parse(result.stdout)
    } catch {
      process.stderr.write('verify-code-rules returned unparseable output; commit blocked because the result is unknown\n')
      process.exit(1)
    }
    const errors = (payload.findings || []).filter((v) => v.severity === 'error')
    const warns = (payload.findings || []).filter((v) => v.severity === 'warn')
    if (warns.length) {
      process.stderr.write(
        `verify-code-rules: ${warns.length} warn-first finding(s) (commit allowed):\n` +
          warns.map((v) => `  - [${v.ruleId}] ${v.file}:${v.line} - ${v.message}`).join('\n') +
          '\n',
      )
    }
    if (!payload.ok || errors.length) {
      process.stderr.write('commit blocked by verify-code-rules, fix before committing:\n' +
        errors.map((v) => `  - [${v.ruleId}] ${v.file}:${v.line} - ${v.message}`).join('\n') + '\n')
      process.exit(1)
    }
    return
  }
  if (result.status !== 0) {
    const reason = result.error ? result.error.message : result.status === null ? `timeout after ${T}ms` : `unexpected exit ${result.status}`
    process.stderr.write(`verify-code-rules gate could not run (${reason}); commit blocked because the result is unknown\n`)
    process.exit(1)
  }
}

const CHECKPOINT_DEV_CHECK_PROBLEM = 'checkpoint commit requires a passing dev-check'
const CHECKPOINT_STALE_DEV_CHECK_PROBLEMS = new Set([
  CHECKPOINT_DEV_CHECK_PROBLEM,
  'current code content differs from the last passing dev-check',
  'staged paths differ from the dev-check pending commit paths',
])

function isCheckpointOrdinaryCommitSkippableProblem(problem) {
  return CHECKPOINT_STALE_DEV_CHECK_PROBLEMS.has(problem)
}

function checkpointGuardSkippable(problems) {
  return problems.length > 0 && problems.every(isCheckpointOrdinaryCommitSkippableProblem)
}

function getEfficiencyRoute() {
  // 从当前目录向上查找 work-item.json
  const findWorkItem = (dir) => {
    const candidates = [
      join(dir, 'work-item.json'),
      join(dir, 'prds', 'work-item.json'),
    ]
    for (const path of candidates) {
      if (existsSync(path)) {
        try {
          const workItem = JSON.parse(readFileSync(path, 'utf-8'))
          return workItem.efficiencyRoute || 'standard'
        } catch { /* fall through */ }
      }
    }
    // 向上一级
    const parent = dirname(dir)
    if (parent !== dir && parent !== '/') return findWorkItem(parent)
    return 'standard'
  }
  
  return findWorkItem(process.cwd())
}

function formatGuardProblems(problems, mode, projectId) {
  // 分类问题
  const scopeProblems = problems.filter(p => p.includes('outside') && p.includes('scope'))
  const devCheckProblems = problems.filter(p =>
    p.includes('dev-check') ||
    p.includes('differs from') ||
    p.includes('staged paths differ')
  )
  const verifyProblems = problems.filter(p =>
    p.includes('latest result') ||
    p.includes('enforced PASS') ||
    p.includes('cli-attested')
  )
  const otherProblems = problems.filter(p =>
    !scopeProblems.includes(p) &&
    !devCheckProblems.includes(p) &&
    !verifyProblems.includes(p)
  )

  let output = `\n❌ commit blocked by v2 ${mode === 'delivery' ? 'delivery' : 'checkpoint'} guard for ${projectId}\n\n`

  // 边界问题
  if (scopeProblems.length > 0) {
    const scopeLines = scopeProblems.flatMap(p => {
      const match = p.match(/outside approved scope: (.+)/)
      return match ? [match[1]] : []
    })
    if (scopeLines.length > 0) {
      output += `📂 边界外文件 (${scopeLines.length} 个):\n`
      scopeLines.slice(0, 5).forEach(file => {
        output += `   ${file}\n`
      })
      if (scopeLines.length > 5) output += `   ... 还有 ${scopeLines.length - 5} 个文件\n`
      output += '\n'
    }
  }

  // dev-check 问题
  if (devCheckProblems.length > 0) {
    output += `🔍 dev-check 状态:\n`
    if (problems.includes(CHECKPOINT_DEV_CHECK_PROBLEM)) {
      output += `   未运行或已过期\n`
    } else if (devCheckProblems.some(p => p.includes('differs from'))) {
      output += `   代码已变更，需要重新验证\n`
    } else if (devCheckProblems.some(p => p.includes('staged paths differ'))) {
      output += `   暂存区文件与验证过的不一致\n`
    }
    output += '\n'
  }

  // verify 问题
  if (verifyProblems.length > 0) {
    output += `⚠️  验证状态:\n`
    verifyProblems.slice(0, 3).forEach(p => {
      output += `   ${p}\n`
    })
    output += '\n'
  }

  // 其他问题
  if (otherProblems.length > 0) {
    output += `⚠️  其他问题:\n`
    otherProblems.forEach(p => {
      output += `   ${p}\n`
    })
    output += '\n'
  }

  // 解决方案
  output += `💡 解决方案:\n`
  if (scopeProblems.length > 0) {
    output += `   1. 扩展边界: 编辑 prds/${projectId}/work-item.json 的 deliveryScope.policyPaths\n`
  }
  if (mode === 'checkpoint') {
    output += `   ${scopeProblems.length > 0 ? 2 : 1}. 开发阶段快速提交: DOCS_TDD_COMMIT_MODE=off git commit -m "..."\n`
    output += `   ${scopeProblems.length > 0 ? 3 : 2}. 运行验证后提交: docs-tdd dev-check ${projectId}\n`
  } else {
    output += `   ${scopeProblems.length > 0 ? 2 : 1}. 运行完整验证: docs-tdd verify ${projectId}\n`
  }
  output += '\n'

  return output
}

function runVNextDeliveryGuard() {
  const explicitMode = process.env.DOCS_TDD_COMMIT_MODE
  if (explicitMode === 'off' || explicitMode === 'skip') return

  // v4.0: 按 efficiencyRoute 分档
  const efficiencyRoute = getEfficiencyRoute()

  // micro/lite 档跳过完整守卫，只跑 Biome
  if (efficiencyRoute === 'micro' || efficiencyRoute === 'lite') {
    process.stderr.write(
      `v4.0 precommit: ${efficiencyRoute} 档跳过完整 checkpoint 守卫，` +
      '仅验证 code-rules (Biome/格式/命名)。\n' +
      '若需完整验证，手动执行: docs-tdd dev-check <PROJECT-ID>\n'
    )
    return
  }

  const mode = explicitMode || 'checkpoint'
  const script = join(SCRIPT_DIR, 'vnext-delivery-guard.mjs')
  const result = spawnSync('node', [script, '--worktree', process.cwd(), '--changed-source', 'staged', '--mode', mode, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: T,
  })
  if (result.status === 0) return
  if (result.status === 1 && result.stdout) {
    try {
      const payload = JSON.parse(result.stdout)
      if (!payload.applies) return

      const problems = payload.problems || []
      if (mode === 'checkpoint' && checkpointGuardSkippable(problems)) {
        const reason = problems.includes(CHECKPOINT_DEV_CHECK_PROBLEM)
          ? 'no passing dev-check'
          : 'dev-check is stale for staged paths'
        process.stderr.write(
          `v2 pre-commit: checkpoint guard skipped (${reason}); ` +
          'ordinary commits only require code-rules. Run docs-tdd dev-check for scoped checkpoint commits, ' +
          'or DOCS_TDD_COMMIT_MODE=delivery / docs-tdd commit --mode delivery before final handoff.\n',
        )
        return
      }

      process.stderr.write(formatGuardProblems(problems, mode, payload.projectId || 'unknown project'))
      process.exit(1)
    } catch { /* fall through to fail closed */ }
  }
  const reason = result.error ? result.error.message : result.stderr.trim() || `unexpected exit ${result.status}`
  process.stderr.write(`v2 commit guard could not run (${reason}); commit blocked because the result is unknown\n`)
  process.exit(1)
}

function main() {
  const files = process.argv.slice(2).filter(Boolean)
  if (!files.length) files.push(...stagedFiles())
  runCodeRules(files)
  runVNextDeliveryGuard()
}

main()
