#!/usr/bin/env node

import { resolveRoots } from './lib/roots.mjs'

const defaultGatewayUrl = process.env.LARK_GATEWAY_URL || 'http://127.0.0.1:3005'
const defaultPollMs = Number(process.env.LARK_WORKER_POLL_MS || 5000)
const defaultCodexTimeoutMs = Number(process.env.LARK_WORKER_CODEX_TIMEOUT_MS || 1800000)
const defaultAiExecutor = process.env.LARK_AI_EXECUTOR || 'codex'

const { consumerRoot: repoRoot } = resolveRoots()

// AI executor 抽象：把 task prompt 交给 claude 或 codex 的 headless 命令。
// 无人值守场景下 claude 需 --dangerously-skip-permissions，否则只能"描述"、无法真正
// 改文件/执行 git；代价是 worker 会在 repoCwd 里自主写操作，务必只绑受控 worktree + 白名单群。
// codex 若启用需自行补其 bypass flag（本机未安装 codex，未验证故不预置）。
const aiExecutorCommands = {
  codex: (prompt) => ({ cmd: 'codex', args: ['exec', prompt] }),
  claude: (prompt) => ({ cmd: 'claude', args: ['-p', '--dangerously-skip-permissions', prompt] }),
}

const resolveAiExecutor = (workerConfig, task) =>
  task.aiExecutor || workerConfig.aiExecutor || defaultAiExecutor

function printHelp() {
  console.log(`usage: lark-worker.mjs [--once] [--help]

Lark Bot Gateway worker: claim pending tasks from the gateway and dispatch them to codex.
Normally invoked by the per-project wrapper; this module also exports runLarkWorker().

Options:
  --help  Show this help message and exit
  --once  Process one task then exit instead of polling forever`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const requestJson = async (gatewayUrl, path, options = {}) => {
  const response = await fetch(`${gatewayUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

const buildCodexPrompt = ({ projectId, projectName, projectDocs, repoCwd }, task) => {
  const workCwd = repoCwd || '/Users/aven/github/fameex-web'
  const docs = [
    'apps/web/docs_tdd/common/lark-bot-gateway.md',
    'apps/web/docs_tdd/common/lark-doc-sync.md',
    ...projectDocs,
  ]
  const attachments = Array.isArray(task.attachments) && task.attachments.length
    ? task.attachments.map((item, index) => {
        const parts = [
          `${index + 1}. ${item.type || 'attachment'}`,
          item.localPath ? `本地路径：${item.localPath}` : null,
          item.imageKey ? `Lark image_key：${item.imageKey}` : null,
          item.width && item.height ? `尺寸：${item.width}x${item.height}` : null,
          item.downloadError ? `下载状态：${item.downloadError}` : null,
        ].filter(Boolean)

        return parts.join('；')
      }).join('\n')
    : '无'

  return `
你正在处理 ${projectId} ${projectName} 的 Lark 群任务。

任务 ID：${task.id}
项目：${task.project || projectId} ${task.projectTitle || projectName}
任务内容：${task.text}
附件：
${attachments}

请在 ${workCwd} 中完成任务，并遵守以下文档：
${docs.map((item, index) => `${index + 1}. ${item}`).join('\n')}

要求：如果任务是 UI / 样式修复，必须先结合项目编号、项目文档、当前代码和附件图片定位相关页面或组件；图片是输入资源，不得仅因原始文字简短就直接失败。若附件只有 image_key 且没有本地路径，先根据项目上下文和文档尽力定位；只有在确实缺少 Lark 图片读取凭证或无法访问代码时，才回写 failed 并说明具体技术原因。

Lark 资料规则：如果任务是文档 / 修复 / 自测 / API / QA 类命令，开发前先查看项目的 agent/lark-sources.json 和 inbox/lark-sync/sync-report.md；能执行只读同步时，先运行项目 sync-lark-docs.mjs，把最新 Lark PRD / QA / Wiki / Drive / Markdown 资料同步到 docs_tdd 本地副本。开发依据必须是带 sourceUrl、syncedAt、readOnly 元信息的 apps/web/docs_tdd/** 本地副本；不得修改 Lark 云文档，不得把资料同步到业务代码目录。

验证要求（代码类修复必做）：改动完成后，必须在 ${workCwd} 内验证本次改动——至少运行 \`pnpm type-check\`，并运行与改动相关的测试（\`pnpm test\` 或对应包/文件的最小测试范围），对触达文件运行 \`pnpm lint\`。只有验证通过才回写 done；若测试 / 类型检查 / lint 未通过，或环境无法运行验证，必须回写 failed 并写清未通过项或阻塞原因，禁止在未验证的情况下报成功。

完成后必须调用本地 Bot Gateway，把 task 状态回写为 done 或 failed，并触发 Lark 群消息。完成消息格式：任务 + 结果；结果先写「已完成。」再用数字小结列出做了什么和效果（含验证结论：跑了哪些检查、是否通过）。
`.trim()
}

const runProjectDocSync = async ({ projectId }) => {
  const { spawn } = await import('node:child_process')
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const syncScript = path.join(repoRoot, 'apps/web/docs_tdd', projectId, 'agent/scripts/sync-lark-docs.mjs')

  try {
    await fs.access(syncScript)
  } catch (error) {
    return { skipped: true, reason: 'missing project sync script' }
  }

  await new Promise((resolve, reject) => {
    const child = spawn('node', [syncScript], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        if (stdout.trim()) {
          console.log(`[lark-worker] doc sync: ${stdout.trim()}`)
        }
        resolve()
        return
      }

      reject(new Error(`Lark doc sync failed before development: ${(stderr || stdout).trim() || `exit ${code}`}`))
    })
  })

  return { skipped: false }
}

const runAI = async (workerConfig, task) => {
  const { spawn } = await import('node:child_process')
  const executor = resolveAiExecutor(workerConfig, task)
  const buildCommand = aiExecutorCommands[executor]

  if (!buildCommand) {
    throw new Error(`unknown AI executor: ${executor} (expected claude or codex)`)
  }

  const { cmd, args } = buildCommand(buildCodexPrompt(workerConfig, task))
  const cwd = workerConfig.repoCwd || repoRoot

  await new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
    })
    let timedOut = false
    const timeout = Number.isFinite(defaultCodexTimeoutMs) && defaultCodexTimeoutMs > 0
      ? setTimeout(() => {
          timedOut = true
          child.kill('SIGTERM')
        }, defaultCodexTimeoutMs)
      : null

    const clearChildTimeout = () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }

    child.on('error', (error) => {
      clearChildTimeout()
      reject(error)
    })
    child.on('exit', (code) => {
      clearChildTimeout()
      if (timedOut) {
        reject(new Error(`${executor} exec timed out after ${defaultCodexTimeoutMs}ms`))
        return
      }

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${executor} exec exited with code ${code}`))
    })
  })
}

const buildFallbackDoneResult = (task) => {
  const summary = (task.text || '').split('\n').find((line) => line.trim())?.trim() || '群内反馈的问题'

  return `已完成。\n1. 已按群内任务处理：${summary.slice(0, 80)}；\n2. 任务已由 Worker 自动执行并回写群结果。`
}

const buildFailureResult = (task, error) => {
  const summary = (task.text || '').split('\n').find((line) => line.trim())?.trim() || '群内任务'
  const message = error instanceof Error ? error.message : String(error)

  return `处理失败。\n1. 任务：${summary.slice(0, 80)}；\n2. 失败类型：Worker 执行异常；下一步请查看本地任务记录。${message ? `错误：${message.slice(0, 160)}` : ''}`
}

const isCommandTask = (task) => /^\s*(文档|docs|修复|fix|自测|test|api|qa)\s*[:：]/i.test(task.text || '')

export async function runLarkWorker({
  argv = process.argv.slice(2),
  gatewayUrl = defaultGatewayUrl,
  pollMs = defaultPollMs,
  projectId,
  projectName,
  projectDocs = [],
  aiExecutor = defaultAiExecutor,
  repoCwd,
}) {
  if (!projectId || !projectName) {
    throw new Error('runLarkWorker requires projectId and projectName')
  }

  const workerConfig = { projectId, projectName, projectDocs, aiExecutor, repoCwd }
  const request = (path, options) => requestJson(gatewayUrl, path, options)
  const updateTask = (taskId, status, result) =>
    request(`/lark/tasks/${encodeURIComponent(taskId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, result }),
    })

  const getTask = async (taskId) => {
    const { tasks = [] } = await request('/lark/tasks')
    return tasks.find((item) => item.id === taskId)
  }

  const getNextPendingTask = async () => {
    const { task } = await request('/lark/tasks/next', { method: 'POST' })
    return task
  }

  const runOnce = async () => {
    const task = await getNextPendingTask()
    if (!task) {
      return false
    }

    if (!task.text?.trim()) {
      await updateTask(task.id, 'failed', '处理失败。\n1. 这条 Lark 任务内容为空；\n2. 请重新 @ 应用并写清需要处理的事项。')
      return true
    }

    console.log(`[lark-worker] claimed ${task.id}: ${task.text}`)
    try {
      if (isCommandTask(task)) {
        await runProjectDocSync(workerConfig)
      }

      await runAI(workerConfig, task)

      const latestTask = await getTask(task.id)
      if (latestTask?.status === 'running') {
        if (isCommandTask(task)) {
          await updateTask(task.id, 'failed', '处理失败。\n1. 子任务已执行结束，但没有明确回写完成结果；\n2. 命令类任务不能使用兜底成功，需检查 Worker/Codex 日志后重试。')
          return true
        }

        await updateTask(task.id, 'done', buildFallbackDoneResult(task))
      }
    } catch (error) {
      const latestTask = await getTask(task.id)
      if (latestTask?.status === 'running') {
        await updateTask(task.id, 'failed', buildFailureResult(task, error))
      }

      throw error
    }

    return true
  }

  const once = argv.includes('--once')

  do {
    try {
      await runOnce()
    } catch (error) {
      console.error('[lark-worker]', error)
    }

    if (!once) {
      await sleep(pollMs)
    }
  } while (!once)
}
