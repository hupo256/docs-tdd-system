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
 *   POST /lark/tasks/:id/status（worker 回写 done/failed，触发回群 + bug 表回写）
 *
 * 硬规则来源：apps/web/docs_tdd/common/lark-bot-gateway.md、lark-active-notification.md。
 */

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { resolveRoots } from './lib/roots.mjs'

const { consumerRoot: repoRoot } = resolveRoots()

const defaultPort = Number(process.env.LARK_GATEWAY_PORT || 3005)
const larkCliBin = process.env.LARK_CLI_BIN || 'lark-cli'

const formatDisplayTime = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const loadConfig = (configPath) => {
  const absolute = resolve(configPath)
  if (!existsSync(absolute)) {
    throw new Error(`Missing gateway config: ${absolute}`)
  }
  return JSON.parse(readFileSync(absolute, 'utf8'))
}

// 把 lark-cli 命令包成 Promise，返回 { code, stdout, stderr }
const runLarkCli = (args) =>
  new Promise((resolve) => {
    const child = spawn(larkCliBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => resolve({ code: -1, stdout, stderr: String(error) }))
    child.on('exit', (code) => resolve({ code, stdout, stderr }))
  })

// ---------------------------------------------------------------------------
// 任务存储：文件队列 + 内存索引
// ---------------------------------------------------------------------------

const createTaskStore = ({ tasksDir }) => {
  mkdirSync(tasksDir, { recursive: true })
  const tasks = new Map()

  // 启动时恢复未完成任务
  for (const file of readdirSync(tasksDir)) {
    if (!file.endsWith('.json')) continue
    try {
      const task = JSON.parse(readFileSync(join(tasksDir, file), 'utf8'))
      tasks.set(task.id, task)
    } catch {
      // 损坏的任务文件跳过，不阻塞启动
    }
  }

  const persist = (task) => {
    writeFileSync(join(tasksDir, `${task.id}.json`), JSON.stringify(task, null, 2))
  }

  return {
    has: (id) => tasks.has(id),
    get: (id) => tasks.get(id),
    list: () => [...tasks.values()],
    upsert(task) {
      tasks.set(task.id, task)
      persist(task)
      return task
    },
    // 领取一个 pending 任务并置为 running
    claimNext() {
      const pending = [...tasks.values()]
        .filter((task) => task.status === 'queued' || task.status === 'received')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]
      if (!pending) return null
      pending.status = 'running'
      persist(pending)
      return pending
    },
  }
}

// ---------------------------------------------------------------------------
// 发群消息（走 lark-cli im，bot 身份；无需 webhook secret）
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 发群消息，带重试（网络/DNS 抖动时不丢消息）。idempotencyKey 让重试不会重复发（Lark 侧去重）。
// 传 card（interactive 卡片 content JSON）优先走卡片；否则回退纯文本 text。
const sendChatMessage = async ({ chatId, text, card, logPrefix, idempotencyKey, retries = 3 }) => {
  if (!chatId) {
    console.warn(`[lark-gateway] ${logPrefix}: skipped, missing chatId`)
    return { ok: false, reason: 'missing chatId' }
  }
  const args = card
    ? ['im', '+messages-send', '--chat-id', chatId, '--msg-type', 'interactive', '--content', card]
    : ['im', '+messages-send', '--chat-id', chatId, '--msg-type', 'text', '--text', text]
  if (idempotencyKey) {
    args.push('--idempotency-key', String(idempotencyKey).slice(0, 50))
  }

  let reason = ''
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const result = await runLarkCli(args)
    const failed = result.code !== 0 || /"ok"\s*:\s*false/.test(result.stdout)
    if (!failed) {
      console.log(`[lark-gateway] ${logPrefix} sent to ${chatId}${attempt > 1 ? ` (attempt ${attempt})` : ''}`)
      return { ok: true }
    }
    reason = (result.stderr || result.stdout || '').slice(0, 200)
    console.error(`[lark-gateway] ${logPrefix} send attempt ${attempt}/${retries} failed: ${reason}`)
    if (attempt < retries) {
      await sleep(attempt * 1500)
    }
  }
  console.error(`[lark-gateway] ${logPrefix} send gave up after ${retries} attempts`)
  return { ok: false, reason }
}

// 回执卡片样式：与 notify-lark.mjs 的 G0-G8 卡片同一套规则（header 彩色模板 + 图标 + note 时间行），
// 让 bot 主动发的「已收到/完成/失败/告警」与项目进度卡片视觉统一。
const RECEIPT_STYLES = {
  queued: { template: 'blue', icon: '🔄', statusText: '已收到，正在排队处理' },
  done: { template: 'green', icon: '✅', statusText: '已完成' },
  failed: { template: 'red', icon: '⛔', statusText: '处理失败' },
  alert: { template: 'red', icon: '⚠️', statusText: 'Lark 长连接异常' },
}

// 构建 interactive 卡片 content（供 sendChatMessage 的 --content 使用）。lines 为「**标签**：值」正文行。
const buildCardContent = ({ config, kind, lines }) => {
  const style = RECEIPT_STYLES[kind]
  const content = [`**状态**：${style.statusText} ${style.icon}`, ...lines].join('\n')
  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      template: style.template,
      title: { tag: 'plain_text', content: `[${config.project}] ${config.title || config.project}` },
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content } },
      { tag: 'note', elements: [{ tag: 'plain_text', content: formatDisplayTime() }] },
    ],
  })
}

const taskLine = (task) => `**任务**：${(task.summary || task.text || '').slice(0, 200)}`

const buildQueuedCard = ({ config, task }) =>
  buildCardContent({ config, kind: 'queued', lines: [taskLine(task)] })

const buildResultCard = ({ config, task, status, result }) => {
  const resultText = (result || (status === 'done' ? '已完成。' : '处理失败。')).trim()
  return buildCardContent({
    config,
    kind: status === 'done' ? 'done' : 'failed',
    lines: [taskLine(task), `**结果**：\n${resultText}`],
  })
}

// ---------------------------------------------------------------------------
// bug 表回写：done 后把记录状态从「待处理」改为约定完成值
// ---------------------------------------------------------------------------

const writeBackBugRecord = async ({ config, task }) => {
  const bug = config.bugTable
  if (!bug?.appToken || !bug?.tableId || !task.recordId) return
  const result = await runLarkCli([
    'base',
    '+record-batch-update',
    '--base-token',
    bug.appToken,
    '--table-id',
    bug.tableId,
    '--json',
    JSON.stringify({ record_id_list: [task.recordId], patch: { [bug.statusField]: bug.doneValue || '处理中' } }),
  ])
  if (result.code !== 0) {
    console.error(`[lark-gateway] bug record write-back failed: ${(result.stderr || result.stdout).slice(0, 200)}`)
  } else {
    console.log(`[lark-gateway] bug record ${task.recordId} status -> ${bug.doneValue || '处理中'}`)
  }
}

const appendNotificationLog = ({ config, row }) => {
  const logPath = join(repoRoot, 'apps/web/docs_tdd', config.project, 'agent/notification-log.md')
  if (!existsSync(logPath)) return
  const content = readFileSync(logPath, 'utf8')
  const marker = '\n## 规则'
  const next = content.includes(marker)
    ? content.replace(marker, `${row}\n${marker}`)
    : `${content.trimEnd()}\n${row}\n`
  writeFileSync(logPath, next)
}

// ---------------------------------------------------------------------------
// Lark 事件归一化
//
// 两种信封需统一：
//   · lark-cli event consume（本项目采用）吐「拍平顶层」结构——message_id / chat_id /
//     sender_id 均在顶层，content 是已内联 mention 名的纯文本，mentions[].id 是字符串。
//   · 官方 webhook im.message.receive_v1 是「嵌套」结构——event.message.* + content 为
//     JSON 字符串，sender.sender_id.open_id，mentions[].id 为 { open_id }。
// 实测 lark-cli 形态样例见 apps/web/docs_tdd/PR-01947/agent/lark-integration.md。
// ---------------------------------------------------------------------------

const parseLine = (line) => {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

// mention.id：官方是 { open_id }，lark-cli 拍平结构是字符串
const mentionOpenId = (mention) => (typeof mention?.id === 'string' ? mention.id : mention?.id?.open_id)

// 去掉正文里内联的 @mention 文本（lark-cli 把占位符 @_user_1 替换成了 mention.name）
const stripMentions = (text, mentions) => {
  let out = text || ''
  for (const mention of mentions) {
    if (mention.name) out = out.split(`@${mention.name}`).join(' ')
    if (mention.key) out = out.split(mention.key).join(' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

const parseTextAndAttachments = ({ messageType, rawContent, mentions }) => {
  // lark-cli 拍平：content 已是纯文本；官方 webhook：content 是 JSON 字符串
  const looksJson = typeof rawContent === 'string' && rawContent.trim().startsWith('{')
  if (typeof rawContent === 'string' && !looksJson) {
    return { text: stripMentions(rawContent, mentions), attachments: [] }
  }
  try {
    const content = typeof rawContent === 'string' ? JSON.parse(rawContent || '{}') : rawContent || {}
    if (messageType === 'post') {
      const blocks = Object.values(content).flatMap((locale) => locale?.content || [])
      const flat = blocks.flat()
      const text = flat
        .filter((el) => el.tag === 'text' || el.tag === 'a')
        .map((el) => el.text || el.href || '')
        .join(' ')
        .trim()
      const attachments = flat
        .filter((el) => el.tag === 'img')
        .map((el) => ({ type: 'image', imageKey: el.image_key, width: el.width, height: el.height }))
      return { text: stripMentions(text, mentions), attachments }
    }
    return { text: stripMentions(content.text || '', mentions), attachments: [] }
  } catch {
    return { text: '', attachments: [] }
  }
}

// 把任意信封归一成 canonical message；非消息事件（无 message_id）返回 null
export const normalizeMessage = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  const nested = raw.event || raw.data?.event
  const message = nested?.message ? nested.message : raw
  const messageId = message.message_id || raw.message_id
  if (!messageId) return null

  const mentions = (message.mentions || raw.mentions || []).map((mention) => ({
    id: mentionOpenId(mention),
    key: mention.key,
    name: mention.name,
  }))
  const messageType = message.message_type || raw.message_type
  const { text, attachments } = parseTextAndAttachments({
    messageType,
    rawContent: message.content ?? raw.content,
    mentions,
  })

  return {
    messageId,
    chatId: message.chat_id || raw.chat_id,
    chatType: message.chat_type || raw.chat_type,
    messageType,
    senderOpenId: nested?.sender?.sender_id?.open_id || raw.sender_id || raw.sender?.sender_id?.open_id || 'unknown',
    mentions,
    text,
    attachments,
  }
}

// @机器人判定：p2p 直发始终算；群里需 mentions 命中 botOpenId（或 @所有人）
export const isForBot = ({ msg, config }) => {
  if (msg.chatType === 'p2p') return true
  const mentions = msg.mentions || []
  if (!config.botOpenId) return mentions.length > 0
  return mentions.some((mention) => mention.id === config.botOpenId || mention.key === '@_all')
}

export const isWhitelisted = ({ msg, config }) => {
  const chatOk = !config.allowedChatIds?.length || config.allowedChatIds.includes(msg.chatId)
  const userOk = !config.allowedOpenIds?.length || config.allowedOpenIds.includes(msg.senderOpenId)
  return chatOk && userOk
}

// 下载 post 图片到本地附件目录，写入 localPath。
// 鉴权走 lark-cli 已登录的 bot 身份（keychain），不需要在配置里放 appSecret。
const downloadAttachments = async ({ config, messageId, attachments }) => {
  if (!attachments.length) return attachments
  const outDir = join(repoRoot, 'apps/web/docs_tdd', config.project, 'agent/lark-attachments', messageId)
  mkdirSync(outDir, { recursive: true })
  const resolved = []
  for (const [index, a] of attachments.entries()) {
    const output = join(outDir, `${index + 1}-${a.imageKey}.img`)
    const result = await runLarkCli([
      'im',
      '+messages-resources-download',
      '--message-id',
      messageId,
      '--file-key',
      a.imageKey,
      '--type',
      'image',
      '--output',
      output,
    ])
    resolved.push(result.code === 0 ? { ...a, localPath: output } : { ...a, downloadError: (result.stderr || result.stdout).slice(0, 120) })
  }
  return resolved
}

const summarize = (text) => (text || '').split('\n').find((line) => line.trim())?.trim().slice(0, 80) || '群内任务'

const ingestLarkEvent = async ({ raw, config, store }) => {
  const msg = normalizeMessage(raw)
  if (!msg || store.has(msg.messageId)) return // 非消息事件 / 幂等
  if (!isWhitelisted({ msg, config }) || !isForBot({ msg, config })) return
  if (!msg.text && !msg.attachments.length) return

  const resolvedAttachments = await downloadAttachments({
    config,
    messageId: msg.messageId,
    attachments: msg.attachments,
  })

  const task = {
    id: msg.messageId,
    source: 'lark',
    chatId: msg.chatId,
    messageId: msg.messageId,
    operator: msg.senderOpenId,
    project: config.project,
    projectTitle: config.title,
    text: msg.text,
    summary: summarize(msg.text),
    attachments: resolvedAttachments,
    status: 'queued',
    createdAt: new Date().toISOString(),
  }
  store.upsert(task)
  console.log(`[lark-gateway] queued task ${task.id}: ${task.summary}`)

  await sendChatMessage({ chatId: task.chatId, card: buildQueuedCard({ config, task }), logPrefix: 'queued receipt', idempotencyKey: `${task.id}-queued` })
  appendNotificationLog({
    config,
    row: `| ${formatDisplayTime()} | Lark Job | 进行中 | 收到群任务：${task.summary} | real | success |`,
  })
}

// ---------------------------------------------------------------------------
// 启动 lark-cli 长连接消费事件（保持 stdin 打开常驻）
// ---------------------------------------------------------------------------

// 长连接自愈：lark-cli 事件消费子进程掉线（WS 抖动/服务端踢连接/进程崩溃）后，
// 若不重连就静默收不到 @。这里用退避重连 + 稳定运行后重置退避 + 连续失败发群告警。
const RECONNECT_BACKOFFS_MS = [1000, 2000, 5000, 10000, 30000, 60000]
const STABLE_UPTIME_MS = 60000 // 连接存活超过此时长视为已稳定，下次掉线从最小退避重来
const ALERT_AFTER_RESTARTS = 3 // 连续重连达到此次数仍未稳定 -> 发一次群告警

const startEventConsumer = ({ config, store }) => {
  const state = { child: null, stopped: false, restarts: 0, alerted: false }

  const alertConsumerDown = async (attempt) => {
    const chatId = config.bugTable?.chatId || config.allowedChatIds?.[0]
    await sendChatMessage({
      chatId,
      card: buildCardContent({
        config,
        kind: 'alert',
        lines: [`**详情**：已连续 ${attempt} 次重连仍未恢复，可能暂时收不到群内 @；请检查网络或 lark-cli 登录态。`],
      }),
      logPrefix: 'consumer-down alert',
      idempotencyKey: `consumer-down-${attempt}`,
    })
  }

  const spawnOnce = () => {
    const child = spawn(larkCliBin, ['event', 'consume', 'im.message.receive_v1'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    state.child = child
    const spawnedAt = Date.now()
    let buffer = ''

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        if (!line) continue
        const raw = parseLine(line)
        if (raw) {
          ingestLarkEvent({ raw, config, store }).catch((error) =>
            console.error('[lark-gateway] ingest error:', error.message),
          )
        }
      }
    })
    child.stderr.on('data', (chunk) => process.stderr.write(`[lark-cli consume] ${chunk}`))
    child.on('error', (error) => console.error('[lark-gateway] event consumer spawn error:', error.message))
    child.on('exit', (code) => {
      state.child = null
      if (state.stopped) return

      // 连接曾稳定存活足够久 -> 视为一次独立掉线，重置退避与告警
      if (Date.now() - spawnedAt >= STABLE_UPTIME_MS) {
        state.restarts = 0
        state.alerted = false
      }

      const delay = RECONNECT_BACKOFFS_MS[Math.min(state.restarts, RECONNECT_BACKOFFS_MS.length - 1)]
      state.restarts += 1
      console.error(
        `[lark-gateway] event consumer exited (code ${code}); reconnecting in ${delay}ms (attempt ${state.restarts})`,
      )
      if (state.restarts >= ALERT_AFTER_RESTARTS && !state.alerted) {
        state.alerted = true
        alertConsumerDown(state.restarts).catch((error) =>
          console.error('[lark-gateway] consumer-down alert failed:', error.message),
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
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
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

const handleStatusUpdate = async ({ config, store, id, status, result }) => {
  const task = store.get(id)
  if (!task) return { ok: false, error: 'task not found' }
  task.status = status
  task.result = result
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
  return { ok: true }
}

export async function runLarkGateway({ configPath, port = defaultPort }) {
  const config = loadConfig(configPath)
  const tasksDir = join(repoRoot, 'apps/web/docs_tdd', config.project, 'agent/lark-tasks')
  const store = createTaskStore({ tasksDir })

  const consumer = startEventConsumer({ config, store })

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    const { pathname } = url

    try {
      if (req.method === 'GET' && pathname === '/lark/health') {
        return sendJson(res, 200, { ok: true, consumer: consumer.isAlive() })
      }
      if (req.method === 'GET' && pathname === '/lark/tasks') {
        return sendJson(res, 200, { tasks: store.list() })
      }
      if (req.method === 'POST' && pathname === '/lark/tasks/next') {
        return sendJson(res, 200, { task: store.claimNext() })
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
          project: config.project,
          projectTitle: config.title,
          text: body.text || '',
          summary: summarize(body.text),
          attachments: body.attachments || [],
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
    console.log(`[lark-gateway] whitelist chats=${(config.allowedChatIds || []).join(',') || '(none)'} consume=im.message.receive_v1`)
  })

  const shutdown = () => {
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
