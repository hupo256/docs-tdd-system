/**
 * Lark Worker 的 AI executor 适配层：选择优先级、命令边界、CLI 预检与 Codex 结构化结果。
 * 只允许 claude/codex 固定枚举，任何 Lark/config 输入都不能变成任意命令。
 */

import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { docsSystemRoot } from './roots.mjs'

const AI_EXECUTORS = new Set(['claude', 'codex'])
const DEFAULT_EXECUTOR = 'claude'
const defaultAiTimeoutMs = Number(process.env.LARK_WORKER_AI_TIMEOUT_MS || process.env.LARK_WORKER_CODEX_TIMEOUT_MS || 1800000)
const codexResultSchema = join(docsSystemRoot, 'common/schemas/lark-ai-result.schema.json')
const codexAnalysisSchema = join(docsSystemRoot, 'common/schemas/lark-ai-analysis.schema.json')

export const validateAiExecutor = (value, source = 'AI executor') => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!AI_EXECUTORS.has(normalized)) throw new Error(`${source} must be one of: claude, codex`)
  return normalized
}

// task > 环境变量 > 本机 bot 配置 > wrapper 默认 > claude。
export const resolveAiExecutor = (workerConfig, task, env = process.env) => {
  const candidates = [
    [task.aiExecutor, 'task.aiExecutor'],
    [env.LARK_AI_EXECUTOR, 'LARK_AI_EXECUTOR'],
    [workerConfig.localConfig?.aiExecutor, 'config.aiExecutor'],
    [workerConfig.aiExecutor, 'worker aiExecutor'],
    [DEFAULT_EXECUTOR, 'default AI executor'],
  ]
  const [value, source] = candidates.find(([candidate]) => candidate != null && String(candidate).trim())
  return validateAiExecutor(value, source)
}

export const buildAiExecutorCommand = ({
  executor,
  promptText,
  cwd,
  resultPath,
  attachments = [],
  codexModel,
  codexReasoningEffort,
  resultKind = 'task',
}) => {
  if (executor === 'codex') {
    const imageArgs = attachments
      .filter((item) => item.type === 'image' && item.localPath && existsSync(item.localPath))
      .flatMap((item) => ['--image', item.localPath])
    return {
      cmd: 'codex',
      args: [
        '--ask-for-approval', 'never',
        'exec', '--ephemeral',
        ...(codexModel ? ['--model', codexModel] : []),
        ...(codexReasoningEffort ? ['--config', `model_reasoning_effort=${JSON.stringify(codexReasoningEffort)}`] : []),
        '--sandbox', resultKind === 'analysis' ? 'read-only' : 'workspace-write',
        '-c', 'sandbox_workspace_write.network_access=false',
        '--cd', cwd,
        '--output-schema', resultKind === 'analysis' ? codexAnalysisSchema : codexResultSchema,
        '--output-last-message', resultPath,
        ...imageArgs,
        '-',
      ],
      stdin: promptText,
      resultMode: 'structured',
    }
  }
  if (executor === 'claude') {
    return {
      cmd: 'claude',
      args: ['-p', '--dangerously-skip-permissions', promptText],
      stdin: null,
      resultMode: 'gateway-callback',
    }
  }
  throw new Error(`unknown AI executor: ${executor} (expected claude or codex)`)
}

const preflightedExecutors = new Set()
export const preflightAiExecutor = (executor) => {
  if (preflightedExecutors.has(executor)) return
  const version = spawnSync(executor, ['--version'], { encoding: 'utf8', stdio: 'pipe' })
  if (version.error || version.status !== 0) {
    throw new Error(`${executor} CLI 不可用：${version.error?.message || (version.stderr || version.stdout || '').trim() || `exit ${version.status}`}`)
  }
  if (executor === 'codex') {
    const auth = spawnSync('codex', ['login', 'status'], { encoding: 'utf8', stdio: 'pipe' })
    if (auth.error || auth.status !== 0) {
      throw new Error(`Codex 未登录：${auth.error?.message || (auth.stderr || auth.stdout || '').trim() || `exit ${auth.status}`}`)
    }
  }
  preflightedExecutors.add(executor)
}

const parseStructuredAiResult = (resultPath) => {
  let result
  try {
    result = JSON.parse(readFileSync(resultPath, 'utf8'))
  } catch (error) {
    throw new Error(`Codex 未返回合法结构化结果：${error.message}`)
  }
  if (!['done', 'failed', 'waiting_confirmation', 'blocked'].includes(result.status) || typeof result.summary !== 'string' || !result.summary.trim()) {
    throw new Error('Codex 结构化结果缺少合法 status/summary')
  }
  if (!Array.isArray(result.checks) || !result.checks.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error('Codex 结构化结果 checks 必须是字符串数组')
  }
  if (!Array.isArray(result.changedFiles) || !result.changedFiles.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error('Codex 结构化结果 changedFiles 必须是字符串数组')
  }
  // waiting_confirmation / blocked 必须带 blockers；owner 为可选补充字段。
  if (result.blockers != null && (!Array.isArray(result.blockers) || !result.blockers.every((item) => typeof item === 'string'))) {
    throw new Error('Codex 结构化结果 blockers 必须是字符串数组')
  }
  if (['waiting_confirmation', 'blocked'].includes(result.status) && !result.blockers?.length) {
    throw new Error(`Codex ${result.status} 结构化结果必须列出 blockers`)
  }
  if (result.owner != null && typeof result.owner !== 'string') {
    throw new Error('Codex 结构化结果 owner 必须是字符串')
  }
  return result
}

const parseStructuredAnalysisResult = (resultPath) => {
  let result
  try {
    result = JSON.parse(readFileSync(resultPath, 'utf8'))
  } catch (error) {
    throw new Error(`Codex 未返回合法分析结果：${error.message}`)
  }
  if (!['ready', 'blocked'].includes(result.status) || typeof result.summary !== 'string' || !result.summary.trim()) {
    throw new Error('Codex 分析结果缺少合法 status/summary')
  }
  if (!Array.isArray(result.applicableRules) || !result.applicableRules.every((item) =>
    item && typeof item.source === 'string' && item.source.trim() && typeof item.application === 'string' && item.application.trim())) {
    throw new Error('Codex 分析结果 applicableRules 必须包含 source/application')
  }
  if (!Array.isArray(result.requirements) || !result.requirements.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error('Codex 分析结果 requirements 必须是字符串数组')
  }
  if (!Array.isArray(result.blockers) || !result.blockers.every((item) => typeof item === 'string' && item.trim())) {
    throw new Error('Codex 分析结果 blockers 必须是字符串数组')
  }
  if (result.status === 'blocked' && !result.blockers.length) {
    throw new Error('Codex blocked 分析结果必须列出 blockers')
  }
  return result
}

const appendAudit = (auditLogPath, value) => {
  if (!auditLogPath) return
  mkdirSync(dirname(auditLogPath), { recursive: true })
  appendFileSync(auditLogPath, value)
}

export const formatStructuredAiResult = (result, executor = 'codex') => {
  const header = result.status === 'done'
    ? '已完成。'
    : result.status === 'waiting_confirmation'
      ? '需人工确认 / 补充材料后才能继续。'
      : result.status === 'blocked'
        ? '已阻塞，需外部材料 / 权限后才能继续。'
        : '处理失败。'
  const lines = [header, `1. ${result.summary.trim()}`, `2. 执行器：${executor}`]
  let n = 3
  if ((result.status === 'waiting_confirmation' || result.status === 'blocked') && Array.isArray(result.blockers) && result.blockers.length) {
    lines.push(`${n++}. 待补充：${result.blockers.join('；')}`)
  }
  if (result.owner) lines.push(`${n++}. 建议责任人：${result.owner}`)
  if (result.checks.length) lines.push(`${n++}. 验证：${result.checks.join('；')}`)
  if (result.changedFiles.length) lines.push(`${n++}. 文件：${result.changedFiles.join('、')}`)
  return lines.join('\n')
}

export const execAiExecutor = async ({
  executor,
  promptText,
  cwd,
  attachments = [],
  codexModel,
  codexReasoningEffort,
  resultKind = 'task',
  auditLogPath,
}) => {
  const resultDir = executor === 'codex' ? mkdtempSync(join(tmpdir(), 'lark-codex-result-')) : null
  const resultPath = resultDir ? join(resultDir, 'result.json') : null
  const { cmd, args, stdin, resultMode } = buildAiExecutorCommand({
    executor,
    promptText,
    cwd,
    resultPath,
    attachments,
    codexModel,
    codexReasoningEffort,
    resultKind,
  })

  try {
    appendAudit(auditLogPath, `\n=== ${new Date().toISOString()} ${executor} ${resultKind} ===\n`)
    await new Promise((resolve, reject) => {
      const shouldCapture = Boolean(auditLogPath)
      const stdio = shouldCapture
        ? [stdin == null ? 'inherit' : 'pipe', 'pipe', 'pipe']
        : stdin == null
          ? 'inherit'
          : ['pipe', 'inherit', 'inherit']
      const child = spawn(cmd, args, { cwd, stdio })
      let timedOut = false
      let killTimer = null
      const timeout = Number.isFinite(defaultAiTimeoutMs) && defaultAiTimeoutMs > 0
        ? setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
            killTimer = setTimeout(() => child.kill('SIGKILL'), 10000)
          }, defaultAiTimeoutMs)
        : null
      const clearChildTimeout = () => {
        if (timeout) clearTimeout(timeout)
        if (killTimer) clearTimeout(killTimer)
      }
      child.on('error', (error) => {
        clearChildTimeout()
        reject(error)
      })
      if (shouldCapture) {
        child.stdout.on('data', (chunk) => {
          process.stdout.write(chunk)
          appendAudit(auditLogPath, chunk.toString())
        })
        child.stderr.on('data', (chunk) => {
          process.stderr.write(chunk)
          appendAudit(auditLogPath, chunk.toString())
        })
      }
      child.on('exit', (code) => {
        clearChildTimeout()
        if (timedOut) return reject(new Error(`${executor} exec timed out after ${defaultAiTimeoutMs}ms`))
        if (code === 0) return resolve()
        reject(new Error(`${executor} exec exited with code ${code}`))
      })
      if (stdin != null) {
        child.stdin.on('error', (error) => {
          if (error.code !== 'EPIPE') reject(error)
        })
        child.stdin.end(stdin)
      }
    })
    return resultMode === 'structured'
      ? { executor, result: resultKind === 'analysis' ? parseStructuredAnalysisResult(resultPath) : parseStructuredAiResult(resultPath) }
      : { executor, result: null }
  } finally {
    if (resultDir) rmSync(resultDir, { recursive: true, force: true })
  }
}
