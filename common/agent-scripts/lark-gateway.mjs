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
import { resolve, join, dirname } from 'node:path'

import { resolveRoots } from './lib/roots.mjs'

const { consumerRoot: repoRoot } = resolveRoots()
// worktree 约定：/Users/aven/github/<项目ID>（主仓同级目录）
const worktreesDir = dirname(repoRoot)

const defaultPort = Number(process.env.LARK_GATEWAY_PORT || 3005)
const larkCliBin = process.env.LARK_CLI_BIN || 'lark-cli'
// lark-cli 子进程超时兜底：卡网/卡登录时不让调用永久挂起（默认 60s）
const larkCliTimeoutMs = Number(process.env.LARK_CLI_TIMEOUT_MS || 60000)
// 任务领取租约：worker 领走后置 running 并盖 claimedAt；超过此时长仍 running 视为孤儿（worker 崩了），
// 下次 claim 时自动重入队。必须 > worker 的 AI 执行超时（默认 30min），避免误回收正在跑的长任务。
const taskLeaseMs = Number(process.env.LARK_TASK_LEASE_MS || 40 * 60 * 1000)
// 本地 HTTP 契约的可选共享密钥：配置后所有写操作 POST 必须带 x-lark-gateway-secret
// （worker / poller 从同名环境变量 LARK_GATEWAY_SECRET 读取）。未配置则仅靠 127.0.0.1 绑定兜底。
const gatewaySecret = process.env.LARK_GATEWAY_SECRET || ''
// POST body 上限，防止本地异常进程灌爆内存（默认 1MB）
const maxBodyBytes = Number(process.env.LARK_GATEWAY_MAX_BODY || 1024 * 1024)

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

// 把 lark-cli 命令包成 Promise，返回 { code, stdout, stderr }。带超时兜底：
// 到点先 SIGTERM，宽限 3s 仍未退再 SIGKILL，并立即以 code -1 结算，避免调用方永久挂起。
const runLarkCli = (args, { timeoutMs = larkCliTimeoutMs } = {}) =>
  new Promise((resolve) => {
    const child = spawn(larkCliBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // 进程可能已退出
        }
      }, 3000)
      finish({ code: -1, stdout, stderr: `${stderr}\n[lark-cli timeout after ${timeoutMs}ms]`.slice(-200) })
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => finish({ code: -1, stdout, stderr: String(error) }))
    child.on('exit', (code) => finish({ code, stdout, stderr }))
  })

// ---------------------------------------------------------------------------
// 任务存储：文件队列 + 内存索引
// ---------------------------------------------------------------------------

const createTaskStore = ({ tasksDir, leaseMs = taskLeaseMs }) => {
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

  const isOrphan = (task, now) =>
    task.status === 'running' && task.claimedAt && now - new Date(task.claimedAt).getTime() > leaseMs

  return {
    has: (id) => tasks.has(id),
    get: (id) => tasks.get(id),
    list: () => [...tasks.values()],
    upsert(task) {
      tasks.set(task.id, task)
      persist(task)
      return task
    },
    // 领取一个 pending 任务并置为 running（盖 claimedAt 作租约）。
    // 领取前先回收租约过期的孤儿 running 任务（worker 崩溃/被杀后任务不会永卡 running）。
    claimNext() {
      const now = Date.now()
      for (const task of tasks.values()) {
        if (isOrphan(task, now)) {
          task.status = 'queued'
          task.claimedAt = null
          task.requeuedAt = new Date(now).toISOString()
          task.requeueCount = (task.requeueCount || 0) + 1
          persist(task)
          console.warn(`[lark-gateway] 租约过期，重新入队孤儿任务 ${task.id}（第 ${task.requeueCount} 次）`)
        }
      }
      const pending = [...tasks.values()]
        .filter((task) => task.status === 'queued' || task.status === 'received')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]
      if (!pending) return null
      pending.status = 'running'
      pending.claimedAt = new Date(now).toISOString()
      persist(pending)
      return pending
    },
    // 健康检查用：各状态计数 + 租约已过期仍 running 的卡住任务 id
    stats() {
      const now = Date.now()
      const byStatus = {}
      const stuck = []
      for (const task of tasks.values()) {
        byStatus[task.status] = (byStatus[task.status] || 0) + 1
        if (isOrphan(task, now)) stuck.push(task.id)
      }
      return { counts: byStatus, stuck }
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
// 标题跟随任务项目：传 project 用它（跨项目 @ / bug 表任务），不传则回落 config.project + config.title（gateway 级告警）。
const buildCardContent = ({ config, kind, lines, project, projectTitle }) => {
  const style = RECEIPT_STYLES[kind]
  const headerProject = project || config.project
  const suffix = projectTitle !== undefined
    ? (projectTitle ? ` ${projectTitle}` : '')
    : (headerProject === config.project ? ` ${config.title || config.project}` : '')
  const content = [`**状态**：${style.statusText} ${style.icon}`, ...lines].join('\n')
  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      template: style.template,
      title: { tag: 'plain_text', content: `[${headerProject}]${suffix}` },
    },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content } },
      { tag: 'note', elements: [{ tag: 'plain_text', content: formatDisplayTime() }] },
    ],
  })
}

const taskLine = (task) => `**任务**：${(task.summary || task.text || '').slice(0, 200)}`

// 卡片标题用的项目段：有项目号用它（仅当 == config.project 才带 config.title 后缀），
// 无项目号（adhoc 主仓 hotfix）显示「主仓 hotfix」。
const cardProjectOf = (task, config) => ({
  project: task.project || '主仓 hotfix',
  projectTitle: task.project ? (task.project === config.project ? config.title : undefined) : '',
})

const buildQueuedCard = ({ config, task, note }) =>
  buildCardContent({ config, kind: 'queued', lines: note ? [taskLine(task), note] : [taskLine(task)], ...cardProjectOf(task, config) })

const buildResultCard = ({ config, task, status, result }) => {
  const resultText = (result || (status === 'done' ? '已完成。' : '处理失败。')).trim()
  return buildCardContent({
    config,
    kind: status === 'done' ? 'done' : 'failed',
    lines: [taskLine(task), `**结果**：\n${resultText}`],
    ...cardProjectOf(task, config),
  })
}

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
    'base',
    '+record-batch-update',
    '--base-token',
    bug.appToken,
    '--table-id',
    bug.tableId,
    '--json',
    JSON.stringify({ record_id_list: [task.recordId], patch: { [bug.statusField]: bug.doneValue } }),
  ]

  const retries = 3
  let reason = ''
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const result = await runLarkCli(args)
    const failed = result.code !== 0 || /"ok"\s*:\s*false/.test(result.stdout)
    if (!failed) {
      console.log(`[lark-gateway] bug record ${task.recordId} status -> ${bug.doneValue}${attempt > 1 ? ` (attempt ${attempt})` : ''}`)
      return
    }
    reason = (result.stderr || result.stdout || '').slice(0, 200)
    console.error(`[lark-gateway] bug write-back attempt ${attempt}/${retries} failed: ${reason}`)
    if (attempt < retries) await sleep(attempt * 1500)
  }
  // 重试仍失败 → 发群告警。否则「群里已报完成 + poller 已 seen 不再捞 + 表格永卡待处理」会静默不一致
  console.error(`[lark-gateway] bug write-back gave up after ${retries} attempts for ${task.recordId}`)
  await sendChatMessage({
    chatId: task.chatId,
    card: buildCardContent({
      config,
      kind: 'alert',
      lines: [`**详情**：记录 ${task.recordId} 状态回写「${bug.doneValue}」失败，请手动在 bug 表改状态。原因：${reason}`],
    }),
    logPrefix: 'writeback alert',
    idempotencyKey: `${task.recordId}-writeback-alert`,
  })
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
    // 回复/引用上下文：用户常在 QA 的原始 bug 消息下回复 + @bug，真正 bug 正文在被引用消息里
    replyTo: message.reply_to || raw.reply_to || message.root_id || raw.root_id,
  }
}

// @机器人判定：p2p 直发始终算；群里需 mentions 命中 botOpenId（或 @所有人）
export const isForBot = ({ msg, config }) => {
  if (msg.chatType === 'p2p') return true
  const mentions = msg.mentions || []
  if (!config.botOpenId) return mentions.length > 0
  return mentions.some((mention) => mention.id === config.botOpenId || mention.key === '@_all')
}

// 白名单校验。信任边界是**白名单群**：群里 QA / PM / 后台 @ 都要能触发，故群消息只按群放行、
// 不再按发送人过滤。硬规则：完全没配任何白名单（群 + 用户皆空）时 fail-closed 拒绝所有事件，
// 避免配置漏填导致任何人 @ 都能触发无监督改代码（曾经是 fail-open）。
// p2p 直发没有群作信任锚点，只放行显式配置的白名单用户。
export const isWhitelisted = ({ msg, config }) => {
  const chats = config.allowedChatIds || []
  const users = config.allowedOpenIds || []
  if (!chats.length && !users.length) return false // fail-closed：未配置 = 拒绝
  if (msg.chatType === 'p2p') return users.includes(msg.senderOpenId)
  return chats.includes(msg.chatId)
}

// 下载 post 图片到本地附件目录，写入 localPath。
// 鉴权走 lark-cli 已登录的 bot 身份（keychain），不需要在配置里放 appSecret。
const downloadAttachments = async ({ config, messageId, attachments }) => {
  if (!attachments.length) return attachments
  const outDir = join(repoRoot, 'apps/web/docs_tdd', config.project, 'agent/lark-attachments', messageId)
  mkdirSync(outDir, { recursive: true })
  const resolved = []
  for (const [index, a] of attachments.entries()) {
    // imageKey 会拼进本地文件名，sanitize 掉路径分隔符等，避免越目录写入
    const safeKey = String(a.imageKey || 'img').replace(/[^\w.-]/g, '_').slice(0, 80)
    const output = join(outDir, `${index + 1}-${safeKey}.img`)
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

// 群 @ 任务可在正文写项目号（PR-#### / PM-####）指定目标仓库，取首个匹配（大写归一）；
// 无则回落群绑定的 config.project。worker 的 resolveWorkContext 会据此路由到对应 worktree / 主仓 hotfix。
const parseProjectFromText = (text) => {
  const match = String(text || '').match(/(PR|PM)-\d{3,}/i)
  return match ? match[0].toUpperCase() : null
}

// chat_id → 群名 缓存：每个项目建一个群，群名形如 `[PR-02172]【…】…`，是项目号的权威来源。
// `+chat-list` 只列 bot 所在的群（数量小），miss 时刷新整个缓存。
const chatNameCache = new Map()
const refreshChatNames = async () => {
  const result = await runLarkCli(['im', '+chat-list', '--format', 'json'])
  if (result.code !== 0) return
  try {
    const data = JSON.parse(result.stdout).data || {}
    const items = data.chats || data.items || []
    for (const chat of items) {
      if (chat.chat_id) chatNameCache.set(chat.chat_id, chat.name || '')
    }
  } catch {
    // 解析失败不阻塞，resolveProject 会回落正文 / config.project
  }
}
const resolveChatName = async (chatId) => {
  if (!chatId) return ''
  if (!chatNameCache.has(chatId)) await refreshChatNames()
  return chatNameCache.get(chatId) || ''
}

// 项目号解析优先级：群名 `[PR-xxxxx]`（权威）> 正文 PR-####。都无则返回 null，
// 由调用方回落到「主仓临时 hotfix 分支」（不再默认套 config.project，避免把无关任务塞进 PR-01947）。
// 群名优先是因为正文常引用别的工单号（如 PR-02172 群里正文提到 PR-02193），只读正文会路由到错项目。
const resolveProject = async ({ chatId, text }) => {
  const fromChatName = parseProjectFromText(await resolveChatName(chatId))
  return fromChatName || parseProjectFromText(text) || null
}

// 拉取被引用/被回复的父消息内容（`lark-cli im +messages-mget`）。用户常在 QA 的原始 bug 消息下
// 回复 + @bot，真正的 bug 正文/截图在父消息里；把它并进 task 才有可执行落点。
// text / merge_forward（合并转发）的 content 已是可读字符串直接用；post/image 解析出文本 + 图片 image_key。
const fetchReferencedContext = async (messageId) => {
  if (!messageId) return null
  const result = await runLarkCli(['im', '+messages-mget', '--message-ids', messageId, '--format', 'json'])
  if (result.code !== 0) return null
  let msg
  try {
    msg = (JSON.parse(result.stdout).data?.messages || [])[0]
  } catch {
    return null
  }
  if (!msg) return null

  const content = msg.content
  if (typeof content === 'string' && !content.trim().startsWith('{')) {
    return { text: content.trim(), attachments: [] } // text / merge_forward
  }
  if (msg.msg_type === 'image') {
    try {
      const parsed = JSON.parse(content)
      return { text: '', attachments: parsed.image_key ? [{ type: 'image', imageKey: parsed.image_key }] : [] }
    } catch {
      return { text: '', attachments: [] }
    }
  }
  const parsed = parseTextAndAttachments({ messageType: msg.msg_type, rawContent: content, mentions: [] })
  return { text: parsed.text, attachments: parsed.attachments }
}

const ingestLarkEvent = async ({ raw, config, store }) => {
  const msg = normalizeMessage(raw)
  if (!msg || store.has(msg.messageId)) return // 非消息事件 / 幂等
  if (!isWhitelisted({ msg, config }) || !isForBot({ msg, config })) return
  if (!msg.text && !msg.attachments.length && !msg.replyTo) return

  const resolvedAttachments = await downloadAttachments({
    config,
    messageId: msg.messageId,
    attachments: msg.attachments,
  })

  // 合并被引用/被回复消息（真正的 bug 正文与截图多在父消息里）
  const refCtx = msg.replyTo ? await fetchReferencedContext(msg.replyTo) : null
  const refAttachments = refCtx?.attachments?.length
    ? await downloadAttachments({ config, messageId: msg.replyTo, attachments: refCtx.attachments })
    : []
  const mergedText = refCtx?.text
    ? `【被引用消息】\n${refCtx.text}\n\n【本条 @】${msg.text || '（无附言）'}`.trim()
    : msg.text
  const attachments = [...resolvedAttachments, ...refAttachments]

  const project = await resolveProject({ chatId: msg.chatId, text: mergedText })
  const worktreeExists = project ? existsSync(join(worktreesDir, project)) : false

  const task = {
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
    status: 'queued',
    createdAt: new Date().toISOString(),
  }
  store.upsert(task)

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
    const child = spawn(larkCliBin, ['event', 'consume', eventKey], { stdio: ['pipe', 'pipe', 'pipe'] })
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
          Promise.resolve(onLine(raw)).catch((error) =>
            console.error(`[lark-gateway] ${eventKey} handler error:`, error.message),
          )
        }
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

const handleStatusUpdate = async ({ config, store, id, status, result }) => {
  if (!VALID_STATUSES.has(status)) return { ok: false, error: `invalid status: ${status}` }
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
  if (!config.allowedChatIds?.length && !config.allowedOpenIds?.length) {
    console.warn('[lark-gateway] ⚠ 未配置任何白名单（allowedChatIds/allowedOpenIds），将拒绝所有事件（fail-closed）。请在项目配置里填入白名单群。')
  }
  const tasksDir = join(repoRoot, 'apps/web/docs_tdd', config.project, 'agent/lark-tasks')
  const store = createTaskStore({ tasksDir, leaseMs: taskLeaseMs })

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
