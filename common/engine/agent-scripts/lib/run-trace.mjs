#!/usr/bin/env node
/**
 * Run trace 轻量级实现
 *
 * 用于记录每次执行的时间、token、动作数等指标
 * 为 autopilot 提供观测能力
 */

import { randomBytes } from 'node:crypto'
import { writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'

/**
 * 生成 run ID
 */
export function generateRunId(prefix = 'run') {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(3).toString('hex')
  return `${prefix}-${timestamp}-${random}`
}

/**
 * 创建新的 run trace
 */
export function createRunTrace({
  projectId,
  route = 'standard',
  phase = 'extraction',
  description = ''
}) {
  const runId = generateRunId()
  const startedAt = new Date().toISOString()

  return {
    runId,
    projectId,
    route,
    phase,
    description,
    startedAt,
    endedAt: null,
    elapsedMs: null,

    // Metrics
    actionCount: 0,
    commandCount: 0,
    reviewRounds: 0,
    evidenceCount: 0,
    repairAttempts: 0,

    // Token (如果可用)
    estimatedInputTokens: null,
    estimatedOutputTokens: null,

    // Context
    contextChars: null,
    ruleFiles: null,
    sourceUnits: null,

    // Status
    terminalState: null,
    budgetStatus: null,

    // Interrupts
    userInterruptCount: 0,
    necessaryInterruptCount: 0,

    // Actions log
    actions: []
  }
}

/**
 * 记录一个 action
 */
export function recordAction(trace, {
  action,
  executor = 'deterministic',
  outcome = 'completed',
  durationMs = 0,
  commandsConsumed = 0,
  reviewRoundsConsumed = 0,
  repairsConsumed = 0
}) {
  const actionId = `${trace.runId}-a${trace.actions.length + 1}`
  const actionRecord = {
    actionId,
    action,
    executor,
    startedAt: new Date().toISOString(),
    endedAt: new Date(Date.now() + durationMs).toISOString(),
    outcome,
    durationMs,
    commandsConsumed,
    reviewRoundsConsumed,
    repairsConsumed
  }

  trace.actions.push(actionRecord)
  trace.actionCount++
  trace.commandCount += commandsConsumed || 0
  trace.reviewRounds += reviewRoundsConsumed || 0
  trace.repairAttempts += repairsConsumed || 0

  return actionRecord
}

/**
 * 完成 run trace
 */
export function completeRunTrace(trace, {
  terminalState = 'complete',
  budgetStatus = 'within-budget'
} = {}) {
  trace.endedAt = new Date().toISOString()
  trace.elapsedMs = Date.parse(trace.endedAt) - Date.parse(trace.startedAt)
  trace.terminalState = terminalState
  trace.budgetStatus = budgetStatus

  return trace
}

/**
 * 保存 run trace 到文件
 */
export function saveRunTrace(trace, outputPath) {
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // 保存完整 trace (JSON)
  writeFileSync(outputPath, JSON.stringify(trace, null, 2), 'utf-8')

  // 同时追加到 runs.jsonl (如果在项目目录下)
  if (trace.projectId && outputPath.includes(`prds/${trace.projectId}`)) {
    const runsJsonlPath = join(dirname(outputPath), 'runs.jsonl')
    const compactRecord = {
      runId: trace.runId,
      projectId: trace.projectId,
      route: trace.route,
      phase: trace.phase,
      startedAt: trace.startedAt,
      endedAt: trace.endedAt,
      elapsedMs: trace.elapsedMs,
      actionCount: trace.actionCount,
      commandCount: trace.commandCount,
      reviewRounds: trace.reviewRounds,
      evidenceCount: trace.evidenceCount,
      repairAttempts: trace.repairAttempts,
      terminalState: trace.terminalState,
      budgetStatus: trace.budgetStatus,
      contextChars: trace.contextChars,
      ruleFiles: trace.ruleFiles
    }
    appendFileSync(runsJsonlPath, JSON.stringify(compactRecord) + '\n', 'utf-8')
  }

  return outputPath
}

/**
 * 格式化输出 trace 摘要
 */
export function formatTraceSummary(trace) {
  const elapsed = trace.elapsedMs ? `${(trace.elapsedMs / 1000).toFixed(1)}s` : 'N/A'
  const status = trace.terminalState || 'running'

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Run Trace Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run ID:        ${trace.runId}
Project:       ${trace.projectId}
Phase:         ${trace.phase}
Route:         ${trace.route}
Status:        ${status}

⏱️  Time:       ${elapsed}
🔧 Actions:     ${trace.actionCount}
💻 Commands:    ${trace.commandCount}
🔍 Reviews:     ${trace.reviewRounds}
📝 Evidence:    ${trace.evidenceCount}
🔧 Repairs:     ${trace.repairAttempts}

📊 Context:     ${trace.contextChars ? `${(trace.contextChars / 1000).toFixed(1)}K chars` : 'N/A'}
📄 Rules:       ${trace.ruleFiles ?? 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}

/**
 * 简单的性能计时器
 */
export class Timer {
  constructor() {
    this.start = Date.now()
  }

  elapsed() {
    return Date.now() - this.start
  }

  elapsedSeconds() {
    return (this.elapsed() / 1000).toFixed(1)
  }
}

/**
 * 自测
 */
export async function selfTest() {
  console.log('run-trace self-test...')

  // Test 1: 创建 trace
  const trace = createRunTrace({
    projectId: 'PR-00001',
    route: 'standard',
    phase: 'extraction',
    description: 'Test extraction'
  })

  console.assert(trace.runId.startsWith('run-'), 'runId should start with run-')
  console.assert(trace.projectId === 'PR-00001', 'projectId should match')
  console.assert(trace.actionCount === 0, 'actionCount should be 0')

  // Test 2: 记录 action (等待 10ms 确保有时间差)
  await new Promise(resolve => setTimeout(resolve, 10))

  recordAction(trace, {
    action: 'extract-requirements',
    executor: 'agent',
    outcome: 'completed',
    durationMs: 5000,
    commandsConsumed: 2,
    reviewRoundsConsumed: 1
  })

  console.assert(trace.actionCount === 1, 'actionCount should be 1')
  console.assert(trace.commandCount === 2, 'commandCount should be 2')
  console.assert(trace.reviewRounds === 1, 'reviewRounds should be 1')

  // Test 3: 完成 trace
  completeRunTrace(trace, {
    terminalState: 'complete',
    budgetStatus: 'within-budget'
  })

  console.assert(trace.endedAt !== null, 'endedAt should be set')
  console.assert(trace.elapsedMs >= 0, 'elapsedMs should be non-negative')
  console.assert(trace.terminalState === 'complete', 'terminalState should be complete')

  // Test 4: 格式化摘要
  const summary = formatTraceSummary(trace)
  console.assert(summary.includes('Run ID:'), 'summary should include Run ID')
  console.assert(summary.includes(trace.runId), 'summary should include runId value')

  console.log('✅ run-trace self-test passed')
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    await selfTest()
  }
}
