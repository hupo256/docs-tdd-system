#!/usr/bin/env node

/**
 * Lark Bot Gateway（本地专用，替代已丢失的 Koa 服务）。
 *
 * 事件源用 `lark-cli event consume` 长连接，不再依赖公网 tunnel + challenge/验签。
 * 对外暴露与 common/lark-worker.mjs 已约定的本地 HTTP 契约：
 *   GET  /lark/health
 *   GET  /lark/tasks
 *   POST /lark/tasks          （外部投递，如 bug 表轮询器）
 *   POST /lark/tasks/next     （worker 领取，pending -> running）
 *   POST /lark/tasks/:id/status（worker 回写终态，触发对应回群卡；仅 done 回写 bug 表）
 *
 * 本文件只做编排 + HTTP 接线；纯函数/IO 拆到 lib/lark-*.mjs：
 *   · lib/lark-message.mjs  信封归一 + 白名单/@bot 判定（纯，可单测）
 *   · lib/lark-cards.mjs    回执卡片构建（纯）
 *   · lib/lark-cli.mjs      lark-cli 子进程 + 发消息/附件/群名缓存/引用消息
 *   · lib/lark-task-store.mjs 文件队列 + 租约回收
 *
 * 硬规则来源：apps/web/docs_tdd/common/lark-bot-gateway.md、lark-active-notification.md。
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve, join, dirname } from 'node:path'

import { resolveRoots } from './lib/roots.mjs'
import { resolveAiExecutor } from './lib/lark-ai-executor.mjs'
import {
  isForBot,
  isWhitelisted,
  normalizeMessage,
  parseProjectFromText,
  summarize,
} from './lib/lark-message.mjs'
import { buildCardContent, buildQueuedCard, buildResultCard, buildWaitingCard, formatDisplayTime } from './lib/lark-cards.mjs'
import {
  downloadAttachments,
  fetchReferencedContext,
  isChatMember,
  resolveChatName,
  runLarkCliWithRetry,
  sendChatMessage,
} from './lib/lark-cli.mjs'
import { createTaskStore } from './lib/lark-task-store.mjs'

// pure 判定/归一化从 lib 透出，保持既有 import 路径（单测 + 外部调用方无需改动）
export { isForBot, isWhitelisted, normalizeMessage } from './lib/lark-message.mjs'

const { consumerRoot: repoRoot } = resolveRoots()
// worktree 约定：/Users/aven/github/<项目ID>（主仓同级目录）
const worktreesDir = dirname(repoRoot)

const defaultPort = Number(process.env.LARK_GATEWAY_PORT || 3005)
// 任务领取租约：worker 领走后置 running 并盖 claimedAt；超过此时长仍 running 视为孤儿（worker 崩了），
// 下次 claim 时自动重入队。必须 > worker 的 AI 执行超时（默认 30min），避免误回收正在跑的长任务。
const taskLeaseMs = Number(process.env.LARK_TASK_LEASE_MS || 40 * 60 * 1000)
// 本地 HTTP 契约的可选共享密钥：配置后所有写操作 POST 必须带 x-lark-gateway-secret
// （worker / poller 从同名环境变量 LARK_GATEWAY_SECRET 读取）。未配置则仅靠 127.0.0.1 绑定兜底。
const gatewaySecret = process.env.LARK_GATEWAY_SECRET || ''
// POST body 上限，防止本地异常进程灌爆内存（默认 1MB）
const maxBodyBytes = Number(process.env.LARK_GATEWAY_MAX_BODY || 1024 * 1024)

const loadConfig = (configPath) => {
  const absolute = resolve(configPath)
  if (!existsSync(absolute)) {
    throw new Error(`Missing gateway config: ${absolute}`)
  }
  return JSON.parse(readFileSync(absolute, 'utf8'))
}

const docsDir = (project) => join(repoRoot, 'apps/web/docs_tdd', project)

// 群消息可用 `[codex]` / `[claude]` 临时覆盖本机默认；只返回固定枚举，不接受命令参数。
export const parseAiExecutorDirective = (text) => {
  const match = String(text || '').match(/^\s*\[(codex|claude)\](?:\s+|$)/i)
  return match ? match[1].toLowerCase() : undefined
}

// 排队卡必须展示任务最终会用的执行器，不能等 Worker 领取后才补写。
export const resolveGatewayAiExecutor = ({ requestedExecutor, config, env = process.env }) =>
  resolveAiExecutor({ localConfig: config }, { aiExecutor: requestedExecutor }, env)

// ---------------------------------------------------------------------------
// bug 表回写：done 后把记录状态从「待处理」改为约定完成值
// ---------------------------------------------------------------------------

const writeBackBugRecord = async ({ config, task }) => {
  const bug = config.bugTable
  if (!bug?.appToken || !bug?.tableId || !task.recordId) return
  // doneValue 缺失就不写：文档 §5.3 明确「处理中」非合法枚举，写非法值只会让 lark-cli 报错
  if (!bug.doneValue) {
    console.warn(`[lark-gateway] bug write-back skipped: config.bugTable.doneValue 未配置，不写非法值`)
    return
  }

  const args = [
    'base', '+record-batch-update',
    '--base-token', bug.appToken,
    '--table-id', bug.tableId,
    '--json',
    JSON.stringify({ record_id_list: [task.recordId], patch: { [bug.statusField]: bug.doneValue } }),
  ]
  const outcome = await runLarkCliWithRetry(args, { logPrefix: `bug write-back ${task.recordId} -> ${bug.doneValue}` })
  if (outcome.ok) return

  // 重试仍失败 → 发群告警。否则「群里已报完成 + poller 已 seen 不再捞 + 表格永卡待处理」会静默不一致
  await sendChatMessage({
    chatId: task.chatId,
    card: buildCardContent({
      config,
      kind: 'alert',
      lines: [`**详情**：记录 ${task.recordId} 状态回写「${bug.doneValue}」失败，请手动在 bug 表改状态。原因：${outcome.reason}`],
    }),
    logPrefix: 'writeback alert',
    idempotencyKey: `${task.recordId}-writeback-alert`,
  })
}

const appendNotificationLog = ({ config, row }) => {
  const logPath = join(docsDir(config.project), 'agent/notification-log.md')
  if (!existsSync(logPath)) return
  const content = readFileSync(logPath, 'utf8')
  const marker = '\n## 规则'
  const next = content.includes(marker)
    ? content.replace(marker, `${row}\n${marker}`)
    : `${content.trimEnd()}\n${row}\n`
  writeFileSync(logPath, next)
}

// ---------------------------------------------------------------------------
// 事件摄入
// ---------------------------------------------------------------------------

// 项目号解析优先级：群名 `[PR-xxxxx]`（权威）> 正文 PR-####。都无则返回 null，
// 由调用方回落到「主仓临时 hotfix 分支」（不再默认套 config.project，避免把无关任务塞进 PR-01947）。
// 群名优先是因为正文常引用别的工单号（如 PR-02172 群里正文提到 PR-02193），只读正文会路由到错项目。
const resolveProject = async ({ chatId, text }) => {
  const fromChatName = parseProjectFromText(await resolveChatName(chatId))
  return fromChatName || parseProjectFromText(text) || null
}

// auto 成员制白名单需查 bot 是否在该群（仅群消息且 auto 模式才查，避免无谓网络调用）
const resolveMembership = async ({ msg, config }) =>
  config.allowedChatIds === 'auto' && msg.chatType !== 'p2p' ? isChatMember(msg.chatId) : false

const ingestLarkEvent = async ({ raw, config, store }) => {
  const msg = normalizeMessage(raw)
  if (!msg || store.has(msg.messageId)) return // 非消息事件 / 幂等
  const isMember = await resolveMembership({ msg, config })
  if (!isWhitelisted({ msg, config, isMember }) || !isForBot({ msg, config })) return
  if (!msg.text && !msg.attachments.length && !msg.replyTo) return

  // 合并被引用/被回复消息（真正的 bug 正文与截图多在父消息里）
  const refCtx = msg.replyTo ? await fetchReferencedContext(msg.replyTo) : null
  const mergedText = refCtx?.text
    ? `【被引用消息】\n${refCtx.text}\n\n【本条 @】${msg.text || '（无附言）'}`.trim()
    : msg.text
  const project = await resolveProject({ chatId: msg.chatId, text: mergedText })
  // 附件跟任务实际项目落盘；跨项目群任务不再错误写进 gateway 默认项目目录。
  const attachmentProject = project || config.project
  const resolvedAttachments = await downloadAttachments({
    repoRoot,
    project: attachmentProject,
    messageId: msg.messageId,
    attachments: msg.attachments,
  })
  const refAttachments = refCtx?.attachments?.length
    ? await downloadAttachments({ repoRoot, project: attachmentProject, messageId: msg.replyTo, attachments: refCtx.attachments })
    : []
  const attachments = [...resolvedAttachments, ...refAttachments]

  const worktreeExists = project ? existsSync(join(worktreesDir, project)) : false
  const requestedExecutor = parseAiExecutorDirective(msg.text)
  const aiExecutor = resolveGatewayAiExecutor({ requestedExecutor, config })

  const task = store.upsert({
    id: msg.messageId,
    source: 'lark',
    chatId: msg.chatId,
    messageId: msg.messageId,
    operator: msg.senderOpenId,
    project: project || null,
    projectTitle: config.title,
    text: mergedText,
    // 卡片「任务」摘要优先展示用户本条附言，其次被引用消息首行
    summary: summarize(msg.text?.trim() ? msg.text : refCtx?.text || ''),
    attachments,
    aiExecutor,
    status: 'queued',
    createdAt: new Date().toISOString(),
  })

  // 无 worktree（有项目号或 adhoc）统一走临时 hotfix worktree，不再发「请选择处理方式」卡片
  const note = worktreeExists
    ? undefined
    : project
      ? `**说明**：本地无 ${project} worktree，将用临时 hotfix 分支处理。`
      : '**说明**：未识别项目号（群名/正文均无），将用临时 hotfix 分支处理。'
  console.log(`[lark-gateway] queued task ${task.id} (${project || 'adhoc'})${worktreeExists ? '' : ' [temp-worktree]'}: ${task.summary}`)
  await sendChatMessage({ chatId: task.chatId, card: buildQueuedCard({ config, task, note }), logPrefix: 'queued receipt', idempotencyKey: `${task.id}-queued` })
  appendNotificationLog({
    config,
    row: `| ${formatDisplayTime()} | Lark Job | 进行中 | 收到群任务(${project || 'adhoc'})：${task.summary} | real | success |`,
  })
}

// ---------------------------------------------------------------------------
// 启动 lark-cli 长连接消费事件（保持 stdin 打开常驻）
// ---------------------------------------------------------------------------

// 长连接自愈：lark-cli 事件消费子进程掉线（WS 抖动/服务端踢连接/进程崩溃）后，
// 若不重连就静默收不到事件。这里用退避重连 + 稳定运行后重置退避 + 连续失败发群告警（可选）。
const RECONNECT_BACKOFFS_MS = [1000, 2000, 5000, 10000, 30000, 60000]
const STABLE_UPTIME_MS = 60000 // 连接存活超过此时长视为已稳定，下次掉线从最小退避重来
const ALERT_AFTER_RESTARTS = 3 // 连续重连达到此次数仍未稳定 -> 发一次群告警

// 通用长连接消费（当前用于 im.message.receive_v1 收群 @）。
// onLine(raw) 处理逐行 JSON 事件；onDownAlert 可选（掉线告警）；maxRestarts 可选（未订阅类错误设上限免刷日志）。
const startConsumer = ({ eventKey, onLine, onDownAlert, maxRestarts }) => {
  const state = { child: null, stopped: false, restarts: 0, alerted: false }

  const spawnOnce = () => {
    const child = spawn(process.env.LARK_CLI_BIN || 'lark-cli', ['event', 'consume', eventKey], { stdio: ['pipe', 'pipe', 'pipe'] })
    state.child = child
    const spawnedAt = Date.now()
    let buffer = ''

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      let index = buffer.indexOf('\n')
      while (index >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
        if (!line) continue
        let raw
        try {
          raw = JSON.parse(line)
        } catch {
          continue
        }
        Promise.resolve(onLine(raw)).catch((error) =>
          console.error(`[lark-gateway] ${eventKey} handler error:`, error.message),
        )
      }
    })
    child.stderr.on('data', (chunk) => process.stderr.write(`[lark-cli consume ${eventKey}] ${chunk}`))
    child.on('error', (error) => console.error(`[lark-gateway] ${eventKey} spawn error:`, error.message))
    child.on('exit', (code) => {
      state.child = null
      if (state.stopped) return

      // 连接曾稳定存活足够久 -> 视为一次独立掉线，重置退避与告警
      if (Date.now() - spawnedAt >= STABLE_UPTIME_MS) {
        state.restarts = 0
        state.alerted = false
      }

      if (maxRestarts && state.restarts >= maxRestarts) {
        console.error(
          `[lark-gateway] ${eventKey} 连续 ${state.restarts} 次消费失败，已停止重试（多为后台未订阅该事件）；订阅后 lark-bot restart 生效`,
        )
        return
      }

      const delay = RECONNECT_BACKOFFS_MS[Math.min(state.restarts, RECONNECT_BACKOFFS_MS.length - 1)]
      state.restarts += 1
      console.error(
        `[lark-gateway] ${eventKey} consumer exited (code ${code}); reconnecting in ${delay}ms (attempt ${state.restarts})`,
      )
      if (onDownAlert && state.restarts >= ALERT_AFTER_RESTARTS && !state.alerted) {
        state.alerted = true
        onDownAlert(state.restarts).catch((error) =>
          console.error(`[lark-gateway] ${eventKey} down alert failed:`, error.message),
        )
      }
      setTimeout(() => {
        if (!state.stopped) spawnOnce()
      }, delay)
    })
  }

  spawnOnce()

  return {
    isAlive: () => state.child != null && state.child.exitCode === null,
    stop: () => {
      state.stopped = true
      state.child?.kill('SIGTERM')
    },
  }
}

// ---------------------------------------------------------------------------
// HTTP 服务
// ---------------------------------------------------------------------------

const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    let aborted = false
    req.on('data', (chunk) => {
      if (aborted) return
      data += chunk
      if (data.length > maxBodyBytes) {
        aborted = true
        req.destroy()
        resolve({})
      }
    })
    req.on('end', () => {
      if (aborted) return
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const VALID_STATUSES = new Set(['queued', 'running', 'verifying', 'done', 'failed', 'blocked', 'waiting_confirmation'])
const VALID_AI_EXECUTORS = new Set(['claude', 'codex'])

const normalizeAiExecutor = (value) => {
  if (value == null || value === '') return undefined
  const normalized = String(value).trim().toLowerCase()
  if (!VALID_AI_EXECUTORS.has(normalized)) throw new Error(`invalid aiExecutor: ${value}`)
  return normalized
}

const handleStatusUpdate = async ({ config, store, id, status, result, aiExecutor }) => {
  if (!VALID_STATUSES.has(status)) return { ok: false, error: `invalid status: ${status}` }
  const task = store.get(id)
  if (!task) return { ok: false, error: 'task not found' }
  task.status = status
  task.result = result
  task.aiExecutor = normalizeAiExecutor(aiExecutor) || task.aiExecutor
  store.upsert(task)

  if (status === 'done' && task.source === 'lark-bugtable') {
    await writeBackBugRecord({ config, task })
  }
  if (status === 'done' || status === 'failed') {
    await sendChatMessage({
      chatId: task.chatId,
      card: buildResultCard({ config, task, status, result }),
      logPrefix: 'result receipt',
      idempotencyKey: `${task.id}-${status}`,
    })
    appendNotificationLog({
      config,
      row: `| ${formatDisplayTime()} | Lark Job | ${status === 'done' ? '已完成' : '阻塞中'} | ${task.summary}：${(result || '').slice(0, 60)} | real | ${status === 'done' ? 'success' : 'failed'} |`,
    })
  }
  // 待确认 / 阻塞：单独一条橙色回执（区别于完成/失败），能识别触发人时 @ 其补料。
  // task.operator = 群 @ 的发送人 open_id（bug 表任务通常没有，则不 @、仅发群）。
  if (status === 'waiting_confirmation' || status === 'blocked') {
    await sendChatMessage({
      chatId: task.chatId,
      card: buildWaitingCard({ config, task, status, result, mentionOpenId: task.operator }),
      logPrefix: `${status} receipt`,
      idempotencyKey: `${task.id}-${status}`,
    })
    appendNotificationLog({
      config,
      row: `| ${formatDisplayTime()} | Lark Job | 待确认 | ${task.summary}：${(result || '').slice(0, 60)} | real | waiting |`,
    })
  }
  return { ok: true }
}

export async function runLarkGateway({ configPath, port = defaultPort }) {
  const config = loadConfig(configPath)
  config.aiExecutor = normalizeAiExecutor(config.aiExecutor)
  const membershipMode = config.allowedChatIds === 'auto'
  if (!membershipMode && !config.allowedChatIds?.length && !config.allowedOpenIds?.length) {
    console.warn('[lark-gateway] ⚠ 未配置任何白名单（allowedChatIds/allowedOpenIds），将拒绝所有事件（fail-closed）。请填 allowedChatIds:"auto"（bot 所在群）或显式群 id。')
  }
  const store = createTaskStore({ tasksDir: join(docsDir(config.project), 'agent/lark-tasks'), leaseMs: taskLeaseMs })

  const alertConsumerDown = (attempt) =>
    sendChatMessage({
      chatId: config.bugTable?.chatId || config.allowedChatIds?.[0],
      card: buildCardContent({
        config,
        kind: 'alert',
        lines: [`**详情**：已连续 ${attempt} 次重连仍未恢复，可能暂时收不到群内 @；请检查网络或 lark-cli 登录态。`],
      }),
      logPrefix: 'consumer-down alert',
      idempotencyKey: `consumer-down-${attempt}`,
    })

  const consumer = startConsumer({
    eventKey: 'im.message.receive_v1',
    onLine: (raw) => ingestLarkEvent({ raw, config, store }),
    onDownAlert: alertConsumerDown,
  })

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    const { pathname } = url

    try {
      // 写操作鉴权：配置了共享密钥时，所有 POST 必须带匹配的 x-lark-gateway-secret
      if (req.method === 'POST' && gatewaySecret && req.headers['x-lark-gateway-secret'] !== gatewaySecret) {
        return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      }
      if (req.method === 'GET' && pathname === '/lark/health') {
        return sendJson(res, 200, { ok: true, consumer: consumer.isAlive(), ...store.stats() })
      }
      if (req.method === 'GET' && pathname === '/lark/tasks') {
        return sendJson(res, 200, { tasks: store.list() })
      }
      if (req.method === 'POST' && pathname === '/lark/tasks/next') {
        return sendJson(res, 200, { task: store.claimNext() })
      }
      // 人工重触发：把 failed/blocked 任务重置为 queued，worker 下一轮重跑，并补发「已重新入队」卡片。
      // bug 表任务只能走这里重跑（POST 幂等命中旧 failed）；群 @ 任务也可直接重新 @。
      const retryMatch = pathname.match(/^\/lark\/tasks\/([^/]+)\/retry$/)
      if (req.method === 'POST' && retryMatch) {
        const task = store.retry(decodeURIComponent(retryMatch[1]))
        if (!task) return sendJson(res, 404, { ok: false, error: 'task not found or not retryable (must be failed/blocked)' })
        await sendChatMessage({
          chatId: task.chatId,
          card: buildQueuedCard({ config, task }),
          logPrefix: 'retry receipt',
          idempotencyKey: `${task.id}-retry-${task.retryCount}`,
        })
        return sendJson(res, 200, { task })
      }
      // 陈旧终态清理：默认清 done（failed 需显式传 statuses，见 store 注释里的自动重投风险）。
      if (req.method === 'POST' && pathname === '/lark/tasks/prune') {
        const body = await readBody(req)
        const olderThanMs = Math.max(0, Number(body.olderThanHours ?? 0)) * 3600000
        const statuses = Array.isArray(body.statuses) && body.statuses.length ? body.statuses : ['done']
        const removed = store.pruneTerminal({ olderThanMs, statuses })
        return sendJson(res, 200, { ok: true, removed })
      }
      // 并行调度器按 id 原子领取：cwd 相同的任务串行、不同 worktree 并行，worker 侧决策哪个可领
      const claimMatch = pathname.match(/^\/lark\/tasks\/([^/]+)\/claim$/)
      if (req.method === 'POST' && claimMatch) {
        return sendJson(res, 200, { task: store.claimById(decodeURIComponent(claimMatch[1])) })
      }
      if (req.method === 'POST' && pathname === '/lark/tasks') {
        const body = await readBody(req)
        const id = body.id || body.recordId || body.messageId
        if (!id) return sendJson(res, 400, { ok: false, error: 'missing id' })
        if (store.has(id)) return sendJson(res, 200, { task: store.get(id) })
        const task = store.upsert({
          id,
          source: body.source || 'lark-bugtable',
          chatId: body.chatId || config.bugTable?.chatId || config.allowedChatIds?.[0],
          recordId: body.recordId,
          project: body.project || config.project,
          projectTitle: config.title,
          text: body.text || '',
          summary: summarize(body.text),
          attachments: body.attachments || [],
          aiExecutor: resolveGatewayAiExecutor({ requestedExecutor: normalizeAiExecutor(body.aiExecutor), config }),
          status: 'queued',
          createdAt: new Date().toISOString(),
        })
        await sendChatMessage({ chatId: task.chatId, card: buildQueuedCard({ config, task }), logPrefix: 'queued receipt', idempotencyKey: `${task.id}-queued` })
        return sendJson(res, 200, { task })
      }
      const statusMatch = pathname.match(/^\/lark\/tasks\/([^/]+)\/status$/)
      if (req.method === 'POST' && statusMatch) {
        const body = await readBody(req)
        const outcome = await handleStatusUpdate({
          config,
          store,
          id: decodeURIComponent(statusMatch[1]),
          status: body.status,
          result: body.result,
          aiExecutor: body.aiExecutor,
        })
        return sendJson(res, outcome.ok ? 200 : 404, outcome)
      }
      return sendJson(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message })
    }
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`[lark-gateway] listening on http://127.0.0.1:${port} for ${config.project}`)
    console.log(`[lark-gateway] whitelist chats=${config.allowedChatIds === 'auto' ? 'auto(bot 所在群)' : ((config.allowedChatIds || []).join(',') || '(none)')} consume=im.message.receive_v1`)
  })

  // 定期清理陈旧 done 任务，防止 /lark/health 计数单调增长（failed 保留待人工 retry/clear）。
  const pruneDoneAfterMs = Number(config.pruneDoneAfterHours ?? 24) * 3600000
  const pruneTimer = setInterval(() => {
    const removed = store.pruneTerminal({ olderThanMs: pruneDoneAfterMs, statuses: ['done'] })
    if (removed.length) console.log(`[lark-gateway] 清理陈旧 done 任务 ${removed.length} 条`)
  }, 60 * 60 * 1000)
  pruneTimer.unref?.()

  const shutdown = () => {
    clearInterval(pruneTimer)
    consumer.stop()
    server.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const configArgIndex = process.argv.indexOf('--config')
  const configPath = configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined
  if (!configPath) {
    console.error('usage: lark-gateway.mjs --config <path> [--port <n>]')
    process.exit(1)
  }
  const portArgIndex = process.argv.indexOf('--port')
  runLarkGateway({
    configPath,
    port: portArgIndex >= 0 ? Number(process.argv[portArgIndex + 1]) : defaultPort,
  }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
