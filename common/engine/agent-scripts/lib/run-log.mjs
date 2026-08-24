// gate 聚合器的子进程执行 + 日志留存 + 失败摘要（IO/格式化）。run-project-gate 与 docs-tdd 复用。
// 逻辑判定（结构化失败提取/摘要）在 lib/gate-payload.mjs；本模块只做执行与落盘。

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { conciseFailure, structuredFailures } from './gate-payload.mjs'

// 用当前 node 跑一个子脚本，捕获 stdout/stderr + 计时 + ok。
export function run(commandArgs, cwd) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(process.execPath, commandArgs, { cwd, encoding: 'utf8', stdio: 'pipe' })
  return {
    command: [process.execPath, ...commandArgs].join(' '),
    startedAt,
    finishedAt: new Date().toISOString(),
    status: result.status,
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

export function safeLogLabel(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'check'
}

// 把一次子进程运行的完整 stdout/stderr 落到 tmp 日志，便于失败后翻全量。返回日志路径并挂到 runResult.logFile。
export function persistRunLog(label, runResult, namespace = 'unknown') {
  const logDir = join(tmpdir(), 'docs-tdd-logs', namespace)
  const stamp = runResult.startedAt.replace(/[:.]/g, '-')
  const logFile = join(logDir, `${stamp}-${safeLogLabel(label)}.log`)
  const body = [
    `command: ${runResult.command}`,
    `startedAt: ${runResult.startedAt}`,
    `finishedAt: ${runResult.finishedAt}`,
    `status: ${runResult.status ?? 'null'}`,
    '',
    '--- stdout ---',
    runResult.stdout,
    '',
    '--- stderr ---',
    runResult.stderr,
    '',
  ].join('\n')
  mkdirSync(logDir, { recursive: true })
  writeFileSync(logFile, body)
  runResult.logFile = logFile
  return logFile
}

// 失败摘要：优先打印结构化 findings（ruleId/severity/message），否则回落到 stdout/stderr 的可操作行。
export function printFailureSummary(label, runResult, parsedResult) {
  const findings = structuredFailures(parsedResult).slice(0, 12)
  console.error(`FAIL ${label}`)
  if (findings.length) {
    for (const finding of findings) {
      const severity = String(finding.severity || 'error').toUpperCase()
      const ruleId = finding.ruleId || finding.id
      console.error(`  [${severity}] ${ruleId || 'ERROR'}: ${finding.message || finding.reason || 'check failed'}${finding.file ? ` (${finding.file})` : ''}`)
      // 门禁失败才按需展开规则：brief 模式下正文默认折成指针，这里给出定向拉取入口。
      if (ruleId) console.error(`    → docs-tdd explain ${ruleId}`)
    }
  } else {
    for (const line of conciseFailure(runResult)) console.error(`  ${line}`)
  }
  console.error(`  full log: ${runResult.logFile}`)
}
