#!/usr/bin/env node

import { createHmac } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const gateMeta = {
  G0: { label: '资料接收', defaultStatus: '进行中' },
  G1: { label: '文档生成', defaultStatus: '进行中' },
  G2: { label: '方案确认', defaultStatus: '待确认' },
  G3: { label: 'API 与 Mock 准备', defaultStatus: '待确认' },
  G4: { label: '开发实现', defaultStatus: '进行中' },
  G5: { label: '接口联调', defaultStatus: '进行中' },
  G6: { label: '自测验收', defaultStatus: '待确认' },
  G7: { label: 'QA 用例回归', defaultStatus: '待确认' },
  G8: { label: '交付', defaultStatus: '待确认' },
}

const gateOrder = Object.keys(gateMeta)

const statusMeta = {
  已完成: { icon: '✅', template: 'green' },
  进行中: { icon: '🔄', template: 'blue' },
  待确认: { icon: '⚠️', template: 'yellow' },
  部分完成: { icon: '⚠️', template: 'yellow' },
  跳过: { icon: '⏭️', template: 'grey' },
  阻塞中: { icon: '⛔', template: 'red' },
}

const statusAliases = {
  完成: '已完成',
  阻塞: '阻塞中',
  部分: '部分完成',
  确认: '待确认',
}

function printHelp() {
  console.log(`usage: notify-lark.mjs <G0-G8> [status] [summary] [--dry-run] [--config <path>] [--help]

Send a Lark interactive card notification for a project gate/status update.
Normally invoked via the per-project wrapper at <PROJECT-ID>/agent/scripts/notify-lark.mjs.

Options:
  --help     Show this help message and exit
  --dry-run  Print the payload instead of sending
  --config   Path to the project webhook config JSON`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

function usage(defaultConfigPath) {
  return `
Usage:
  node <PROJECT-ID>/agent/scripts/notify-lark.mjs <G0-G8> [状态] [说明] [--dry-run] [--config <path>]

Examples:
  node <PROJECT-ID>/agent/scripts/notify-lark.mjs G1 已完成 "格式校验：当前阶段与下一阶段字段已更新；请确认 C 端展示范围、Admin 是否同做、API 字段与 AB 分组来源。"
  node <PROJECT-ID>/agent/scripts/notify-lark.mjs G2 待确认 "请确认本期 scope、API 字段、验收账号。" --dry-run

Default config:
  ${defaultConfigPath}
`
}

function parseArgs(argv, defaultConfigPath) {
  const args = [...argv]
  let dryRun = false
  let configPath = defaultConfigPath

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--dry-run') {
      dryRun = true
      args.splice(index, 1)
      index -= 1
      continue
    }

    if (args[index] === '--config') {
      configPath = args[index + 1]
      args.splice(index, 2)
      index -= 1
    }
  }

  const gate = args[0]?.toUpperCase()
  const statusCandidate = args[1]
  const normalizedStatus = statusAliases[statusCandidate] || statusCandidate
  const status = statusMeta[normalizedStatus] ? normalizedStatus : undefined
  const summary = status ? args.slice(2).join(' ') : args.slice(1).join(' ')

  return {
    gate,
    status,
    summary,
    dryRun,
    configPath: resolve(configPath),
  }
}

function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    throw new Error(`Missing config: ${configPath}`)
  }

  return JSON.parse(readFileSync(configPath, 'utf8'))
}

function isPlaceholder(value) {
  return !value || String(value).includes('YOUR_')
}

function createSign(secret, timestamp) {
  return createHmac('sha256', `${timestamp}\n${secret}`).update('').digest('base64')
}

function normalizeSummary(summary) {
  const text = String(summary || '阶段状态已更新').trim()
  const items = text
    .split(/[；;]\s*/)
    .map((item) => item.trim().replace(/[。；;]+$/, ''))
    .filter(Boolean)

  if (items.length <= 1) {
    return `**说明**：${text}`
  }

  return [
    '**说明**：',
    ...items.map((item, index) => `${index + 1}. ${item}${index === items.length - 1 ? '。' : '；'}`),
  ].join('\n')
}

function formatDisplayTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function createPayload({ config, gate, status, summary }) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`
  const gateInfo = gateMeta[gate]
  const statusInfo = statusMeta[status]
  const time = formatDisplayTime()

  const currentGateIndex = gateOrder.indexOf(gate)
  const nextGate = gateOrder[currentGateIndex + 1]
  const nextStage = nextGate ? gateMeta[nextGate].label : '无'

  const content = [
    `**当前阶段**：${gateInfo.label}-${status} ${statusInfo.icon}`,
    `**下一阶段**：${nextStage}`,
    normalizeSummary(summary),
  ].join('\n')

  const payload = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: statusInfo.template,
        title: {
          tag: 'plain_text',
          content: `[${config.project || 'PROJECT'}] ${config.title || '项目进度'}`,
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content,
          },
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: time,
            },
          ],
        },
      ],
    },
  }

  if (!isPlaceholder(config.secret)) {
    payload.timestamp = timestamp
    payload.sign = createSign(config.secret, timestamp)
  }

  return payload
}

export async function runNotifyLark({ argv = process.argv.slice(2), defaultConfigPath }) {
  const options = parseArgs(argv, defaultConfigPath)

  if (!options.gate || !gateMeta[options.gate]) {
    console.error(usage(defaultConfigPath).trim())
    process.exit(1)
  }

  const status = options.status || gateMeta[options.gate].defaultStatus
  const config = loadConfig(options.configPath)

  if (!options.dryRun && isPlaceholder(config.webhookUrl)) {
    throw new Error('webhookUrl is empty or still a placeholder')
  }

  const payload = createPayload({
    config,
    gate: options.gate,
    status,
    summary: options.summary,
  })

  if (options.dryRun) {
    const dryRunPayload = { ...payload }
    if (dryRunPayload.sign) {
      dryRunPayload.sign = '[redacted]'
    }
    console.log(JSON.stringify(dryRunPayload, null, 2))
    return
  }

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.text()

  if (!response.ok) {
    throw new Error(`Webhook request failed: ${response.status} ${body}`)
  }

  const result = JSON.parse(body)
  if (result.code !== 0) {
    throw new Error(`Webhook returned error: ${body}`)
  }

  console.log(`Lark notification sent: ${options.gate} ${status}`)
}
