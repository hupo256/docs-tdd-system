#!/usr/bin/env node

/**
 * log-exec.mjs — 执行证据日志（PostToolUse hook 公共实现）
 *
 * 作用：把每次**真实执行**的 Bash 命令 + 输出快照，追加写入 append-only 日志。
 * 由 Claude Code 的 PostToolUse hook 在工具真实执行后调用（harness 触发，模型无法用叙述伪造）。
 * 因此日志里的每一条都对应一次真实执行——可用来反查“声称执行过但其实没执行”的幻觉。
 *
 * 规则见 apps/web/docs_tdd/common/execution-evidence.md。
 *
 * 用法（在 settings hooks.command 里）：
 *   node <repo>/apps/web/docs_tdd/common/engine/agent-scripts/log-exec.mjs --out <abs-log-path>
 *
 * stdin：Claude Code PostToolUse 传入的 JSON
 *   { tool_name, tool_input:{command}, tool_response:{stdout,stderr,interrupted}, cwd, session_id, ... }
 *   注意：Bash 的 tool_response 没有 exit_code 字段，只有 stdout/stderr/interrupted。
 *
 * 设计铁律：这是后置、只记录的 hook。无论发生什么都必须 exit 0，绝不阻断主流程。
 */

import fs from 'node:fs'
import path from 'node:path'

// 任何未捕获异常都吞掉并正常退出，绝不阻断主流程
process.on('uncaughtException', () => process.exit(0))
process.on('unhandledRejection', () => process.exit(0))

function readArg(name, fallback = '') {
  const i = process.argv.indexOf(name)
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback)
}

function clip(value, max) {
  const s = typeof value === 'string' ? value : ''
  if (s.length <= max) return s
  return `${s.slice(0, max)}…(+${s.length - max} chars truncated)`
}

function oneLine(value) {
  return String(value ?? '').replace(/\r?\n/g, '⏎')
}

function printHelp() {
  console.log(`usage: log-exec.mjs --out <abs-log-path> [--max <number>] [--help]

PostToolUse hook logger: append-only evidence log for Bash commands.
Reads a JSON payload from stdin and appends a markdown entry to --out.

Options:
  --help  Show this help message and exit
  --out   Absolute path to the append-only markdown log
  --max   Maximum characters of stdout/stderr to record (default: 600)`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const outPath = readArg('--out')
  const maxOut = Number(readArg('--max', '600')) || 600
  if (!outPath) process.exit(0) // 没指定日志路径就静默退出

  const raw = await readStdin()
  let payload = {}
  try {
    payload = JSON.parse(raw)
  } catch {
    process.exit(0) // 解析不了就不记，绝不报错
  }

  // 只记 Bash（matcher 已过滤，这里双保险）
  if (payload.tool_name !== 'Bash') process.exit(0)

  const ts = new Date().toISOString()
  const session = oneLine(payload.session_id || '').slice(0, 8) || '????????'
  const cwd = oneLine(payload.cwd || '')
  const command = oneLine(payload.tool_input?.command || '')
  const resp = payload.tool_response || {}
  const interrupted = resp.interrupted === true
  const stdout = clip(resp.stdout, maxOut)
  const stderr = clip(resp.stderr, maxOut)

  // append-only markdown 块
  const lines = [
    `### ${ts} · sess ${session}${interrupted ? ' · ⚠️ interrupted' : ''}`,
    `- cwd: ${cwd}`,
    '- cmd: ```' + command + '```',
  ]
  if (stdout.trim()) lines.push(`- stdout: \`${oneLine(stdout)}\``)
  if (stderr.trim()) lines.push(`- stderr: \`${oneLine(stderr)}\``)
  lines.push('')

  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.appendFileSync(outPath, lines.join('\n') + '\n')
  } catch {
    // 写不进也不报错
  }
  process.exit(0)
}

main().catch(() => process.exit(0))
