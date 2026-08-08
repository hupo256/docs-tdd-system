#!/usr/bin/env node

// 编码 worktree 退役 / 回收（上线后）。
// 用法：
//   node apps/web/docs_tdd/common/engine/agent-scripts/decommission-worktree.mjs PR-01234 --dry-run
//   node apps/web/docs_tdd/common/engine/agent-scripts/decommission-worktree.mjs PR-01234
// 策略（见 common/coding-worktree.md §7）：
//   - 上线 = 已合入 origin/online；worktree 是一次性脚手架，上线后回收。
//   - 只 `git worktree remove`，不 `rm -rf`（后者留 git 元数据孤儿）。
//   - **保留 feature/* 分支**（本地 + 远端），便于日后回查 / 补丁；只删工作树目录。
//   - docs_tdd 在 worktree 里是 symlink，删目录不影响主仓文档；但会先校验它确实是 symlink，
//     防止误删 worktree 内的真实文档文件。
// 前置硬校验（任一不过即 abort，除非 --force）：
//   1. 分支已合入 origin/online（git merge-base --is-ancestor <branch> origin/online）。
//   2. 无未 push 提交（origin/<branch>..<branch> 为空）。
//   3. 工作树干净（无未提交改动）。
//   4. worktree 内 apps/web/docs_tdd 是 symlink（不是真实目录）。
// 退出码 0 = 完成（或 dry-run 打印计划）；1 = 校验失败 / 出错。
// 脚本只做「删工作树 + 打印待手改项」；端口表 / CONTEXT 的文字更新仍由 Agent 手动执行（脚本打印清单）。

import { existsSync, lstatSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { resolveRoots } from './lib/roots.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const { consumerRoot: repoRoot } = resolveRoots()
const parentDir = resolve(repoRoot, '..')
const projectId = process.argv[2]
const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')

function printHelp() {
  console.log(`usage: decommission-worktree.mjs <PR-xxxxx> [--dry-run] [--force] [--path <worktree>] [--branch <name>] [--help]

编码 worktree 退役 / 回收（上线后）。只移除工作树，保留 feature 分支。

Options:
  --help    Show this help message and exit
  --dry-run Print planned commands without running them
  --force   Skip pre-checks and remove the worktree anyway
  --path    Worktree directory (default: sibling of repo root named <PR-ID>)
  --branch  Branch name (default: feature/<PR-ID>)`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

function fail(message) {
  console.error(`[decommission-worktree] ${message}`)
  process.exit(1)
}

function readOption(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

if (!projectId || !/^PR-[A-Za-z0-9]+$/.test(projectId)) {
  fail('用法：decommission-worktree.mjs PR-xxxxx [--dry-run] [--force] [--path <worktree>] [--branch <name>]')
}

const worktreePath = resolve(readOption('--path', join(parentDir, projectId)))
const branch = readOption('--branch', `feature/${projectId}`)

/** 捕获输出的命令；status 非 0 时返回 null（交由调用方判定，而非直接 fail）。 */
function tryOutput(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout.trim()
}

function run(command, args, cwd = repoRoot) {
  const printable = [command, ...args].join(' ')
  if (dryRun) {
    console.log(`[dry-run] ${printable}`)
    return
  }
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) fail(`command failed: ${printable}`)
}

// ── 0. worktree 存在性 ──────────────────────────────────────────
if (!existsSync(worktreePath)) {
  fail(`worktree 目录不存在：${worktreePath}（已回收？用 --path 指定实际路径）`)
}

console.log(`[decommission-worktree] 目标：${projectId}`)
console.log(`  worktree: ${worktreePath}`)
console.log(`  branch  : ${branch}（保留，不删除）`)

// ── 1-4. 前置硬校验 ─────────────────────────────────────────────
const problems = []

spawnSync('git', ['fetch', 'origin', 'online', '--quiet'], { cwd: repoRoot })

// 1. 已合入 origin/online
const mergedProbe = spawnSync('git', ['merge-base', '--is-ancestor', branch, 'origin/online'], { cwd: repoRoot })
if (mergedProbe.status !== 0) {
  problems.push(`分支 ${branch} 尚未合入 origin/online（上线的定义未满足）。`)
}

// 2. 无未 push 提交
const unpushed = tryOutput('git', ['log', '--oneline', `origin/${branch}..${branch}`], worktreePath)
if (unpushed === null) {
  console.log(`  · 提示：origin/${branch} 不存在或无法比较，跳过未 push 校验。`)
} else if (unpushed) {
  problems.push(`有未 push 提交：\n${unpushed}`)
}

// 3. 工作树干净
const dirty = tryOutput('git', ['status', '--porcelain'], worktreePath)
if (dirty) {
  problems.push(`工作树有未提交改动：\n${dirty}`)
}

// 4. docs_tdd 是 symlink
const docsLink = join(worktreePath, 'apps/web/docs_tdd')
if (existsSync(docsLink) && !lstatSync(docsLink).isSymbolicLink()) {
  problems.push(`${docsLink} 是真实目录而非 symlink——删除前请先把其中真实文件搬回主仓 docs_tdd/。`)
}

if (problems.length) {
  console.error('\n前置校验未通过：')
  for (const p of problems) console.error(`  ❌ ${p}`)
  if (!force) {
    fail('修复以上问题，或确认无误后加 --force 跳过校验。')
  }
  console.warn('\n⚠️  --force：忽略以上问题继续。')
}

// ── 5. 删工作树（保留分支）──────────────────────────────────────
console.log('\n[decommission-worktree] 移除工作树（git worktree remove，保留分支）…')
run('git', ['worktree', 'remove', worktreePath, ...(force ? ['--force'] : [])])
run('git', ['worktree', 'prune'])

// ── 6. 打印 Agent 待手改项（脚本不改文字文档）──────────────────
console.log(`
✅ 工作树已移除：${worktreePath}
   分支 ${branch} 已保留（本地/远端未删）。

后续手动更新（脚本不代改，避免误伤文档措辞）：
  1. common/coding-worktree.md 端口注册表：把 ${projectId} 行状态改为「已回收（上线 <日期>）」。
  2. CONTEXT.md：把 ${projectId} 从「当前活跃项目」移到「非活跃历史项目」，并从 worktree symlink 表移除。
  3. 若该项目 README 在顶层项目索引表，状态改为「已上线 / 已关闭」。
  4. docs_tdd/${projectId}/ 文档保留（历史经验），不删。
`)
