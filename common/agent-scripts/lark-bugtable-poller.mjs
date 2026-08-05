#!/usr/bin/env node

/**
 * Lark bug 多维表格轮询器（能力3）。
 *
 * 周期性读取 bug 表里「负责人=我 且 状态=待处理」的记录，去重后投递到本地
 * Bot Gateway 队列（POST /lark/tasks），复用 worker → AI → 回群 → 回写状态 的统一链路。
 * 鉴权走 lark-cli 已登录的 bot 身份，不在配置里放 app 级密钥。
 *
 * 规则来源：apps/web/docs_tdd/common/lark-bot-gateway.md、lark-doc-sync.md。
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'

const larkCliBin = process.env.LARK_CLI_BIN || 'lark-cli'
const defaultGatewayUrl = process.env.LARK_GATEWAY_URL || 'http://127.0.0.1:3005'
const defaultPollMs = Number(process.env.LARK_BUGTABLE_POLL_MS || 60000)

const runLarkCli = (args) =>
  new Promise((resolveFn) => {
    const child = spawn(larkCliBin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => resolveFn({ code: -1, stdout, stderr: String(error) }))
    child.on('exit', (code) => resolveFn({ code, stdout, stderr }))
  })

const loadConfig = (configPath) => {
  const absolute = resolve(configPath)
  if (!existsSync(absolute)) {
    throw new Error(`Missing config: ${absolute}`)
  }
  return JSON.parse(readFileSync(absolute, 'utf8'))
}

// 已处理 record_id 持久化，避免重复建 task
const createSeenStore = (statePath) => {
  mkdirSync(dirname(statePath), { recursive: true })
  const seen = existsSync(statePath) ? new Set(JSON.parse(readFileSync(statePath, 'utf8')).seen || []) : new Set()
  return {
    has: (id) => seen.has(id),
    add(id) {
      seen.add(id)
      writeFileSync(statePath, JSON.stringify({ seen: [...seen] }, null, 2))
    },
  }
}

// 人员字段值形如 [{id/open_id, name}]；判断是否含目标 open_id
const assigneeHasOpenId = (value, openId) => {
  if (!openId || !Array.isArray(value)) return false
  return value.some((person) => person?.id === openId || person?.open_id === openId)
}

// 单选/文本状态字段取文本值
const readStatusText = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((v) => v?.text || v?.name || '').join('')
  return value?.text || value?.name || ''
}

// 把记录正文拼成给 AI 的 task 文本
const buildBugText = ({ record, bug }) => {
  const fields = record.fields || {}
  const title = readStatusText(fields[bug.titleField || '问题标题']) || '(无标题)'
  const desc = readStatusText(fields[bug.descField || '问题描述（复现步骤）']) || ''
  return `修复：Lark bug 表待处理项 [${title}]\n记录 ID：${record.record_id}\n描述：${desc || '(表格未填描述，请结合标题与项目文档定位)'}`
}

// base +record-list 返回列式结构：data.fields 是列名字符串数组，data.data 是行（单元格数组），
// data.record_id_list 是并行的 record_id。这里 zip 回 { record_id, fields } 记录对象。
const parseColumnarRecords = (data) => {
  const cols = data.fields || []
  const rows = data.data || []
  const ids = data.record_id_list || []
  return rows.map((row, rowIndex) => {
    const fields = {}
    cols.forEach((name, colIndex) => {
      fields[name] = row[colIndex]
    })
    return { record_id: ids[rowIndex], fields }
  })
}

// 服务端按状态过滤 + 翻页拉全（待处理可能 >200），仅投影需要的列以减小 payload
const fetchPendingRecords = async ({ bug }) => {
  const filterJson = JSON.stringify({
    logic: 'and',
    conditions: [[bug.statusField, '==', bug.pendingValue]],
  })
  const projected = [
    bug.statusField,
    bug.assigneeField,
    bug.titleField || '问题标题',
    bug.descField || '问题描述（复现步骤）',
  ].filter(Boolean)

  const all = []
  const pageSize = 200
  for (let offset = 0; offset <= 20000; offset += pageSize) {
    const args = [
      'base',
      '+record-list',
      '--base-token',
      bug.appToken,
      '--table-id',
      bug.tableId,
      '--filter-json',
      filterJson,
      '--format',
      'json',
      '--limit',
      String(pageSize),
      '--offset',
      String(offset),
    ]
    for (const field of projected) {
      args.push('--field-id', field)
    }

    const result = await runLarkCli(args)
    if (result.code !== 0) {
      throw new Error(`record-list failed: ${(result.stderr || result.stdout).slice(0, 200)}`)
    }
    const data = JSON.parse(result.stdout).data || {}
    all.push(...parseColumnarRecords(data))
    if (!data.has_more) break
  }
  return all
}

const enqueueTask = async ({ gatewayUrl, record, bug, chatId }) => {
  const response = await fetch(`${gatewayUrl}/lark/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: record.record_id,
      source: 'lark-bugtable',
      recordId: record.record_id,
      chatId,
      text: buildBugText({ record, bug }),
    }),
  })
  if (!response.ok) {
    throw new Error(`enqueue failed: ${response.status} ${await response.text()}`)
  }
}

const runOnce = async ({ config, seen, gatewayUrl }) => {
  const bug = config.bugTable
  if (!bug?.appToken || !bug?.tableId) {
    throw new Error('config.bugTable.appToken / tableId are required')
  }
  const records = await fetchPendingRecords({ bug })
  const mine = records.filter((record) => assigneeHasOpenId(record.fields?.[bug.assigneeField], bug.myOpenId))
  let enqueued = 0
  for (const record of mine) {
    if (seen.has(record.record_id)) continue
    await enqueueTask({ gatewayUrl, record, bug, chatId: bug.chatId || config.allowedChatIds?.[0] })
    seen.add(record.record_id)
    enqueued += 1
    console.log(`[bugtable-poller] enqueued ${record.record_id}`)
  }
  console.log(`[bugtable-poller] pending=${records.length} mine=${mine.length} new=${enqueued}`)
  return enqueued
}

export async function runLarkBugtablePoller({
  configPath,
  gatewayUrl = defaultGatewayUrl,
  pollMs = defaultPollMs,
  argv = process.argv.slice(2),
}) {
  const config = loadConfig(configPath)
  // 状态文件放在项目 agent/ 下（configPath 在 agent/scripts/ 内）
  const statePath = join(dirname(resolve(configPath)), '..', 'lark-bugtable-state.json')
  const seen = createSeenStore(statePath)
  const once = argv.includes('--once')

  do {
    try {
      await runOnce({ config, seen, gatewayUrl })
    } catch (error) {
      console.error('[bugtable-poller]', error.message)
    }
    if (!once) {
      await new Promise((r) => setTimeout(r, pollMs))
    }
  } while (!once)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const configArgIndex = process.argv.indexOf('--config')
  const configPath = configArgIndex >= 0 ? process.argv[configArgIndex + 1] : undefined
  if (!configPath) {
    console.error('usage: lark-bugtable-poller.mjs --config <path> [--once]')
    process.exit(1)
  }
  runLarkBugtablePoller({ configPath }).catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
