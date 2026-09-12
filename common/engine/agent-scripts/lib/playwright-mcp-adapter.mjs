#!/usr/bin/env node
// Playwright MCP CLI adapter：把「系统 Chrome + Playwright 扩展」暴露为可被 docs-tdd evidence spawn 的
// argv 命令，填补 O-17（browser-interaction 运行时证据此前无 CLI 可执行 adapter）。
// 协议：MCP JSON-RPC 2.0 over stdio（newline-delimited），连接 @playwright/mcp --extension。
// 场景文件描述一串 {tool, arguments, assert?} 步骤；assert 支持 contains/notContains 匹配
// 工具返回文本（browser_snapshot/browser_navigate 等），用于验证「交互副作用」而非只看元素存在。

import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const DEFAULT_TIMEOUT_MS = 20000

export function createMcpClient({ token, spawnFn = spawn, extraArgs = [], timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!token) throw new Error('PLAYWRIGHT_MCP_EXTENSION_TOKEN is required to connect to the Chrome extension')
  const child = spawnFn('npx', ['-y', '@playwright/mcp@latest', '--extension', '--caps', 'vision,devtools', '--ignore-https-errors', ...extraArgs], {
    env: { ...process.env, PLAYWRIGHT_MCP_EXTENSION_TOKEN: token },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let buf = ''
  let nextId = 1
  const pending = new Map()
  const log = []
  child.stderr.on('data', (chunk) => log.push(`[stderr] ${chunk}`))
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString()
    let idx
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        log.push(`[parse-error] ${line.slice(0, 200)}`)
        continue
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const request = pending.get(msg.id)
        clearTimeout(request.timer)
        request.resolve(msg)
        pending.delete(msg.id)
      }
    }
  })

  const send = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`mcp request timed out: ${method}`))
      }
    }, timeoutMs)
    pending.set(id, { resolve, timer })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  })
  const notify = (method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)

  return {
    log,
    async initialize() {
      const response = await send('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'docs-tdd-browser-adapter', version: '1.0.0' },
      })
      if (!response.result) throw new Error(`mcp initialize failed: ${JSON.stringify(response)}`)
      notify('notifications/initialized', {})
      return response.result
    },
    async callTool(name, toolArguments = {}) {
      const response = await send('tools/call', { name, arguments: toolArguments })
      if (response.error) throw new Error(`mcp tool ${name} error: ${response.error.message || JSON.stringify(response.error)}`)
      const content = response.result?.content || []
      const text = content.map((item) => item.text || '').join('\n')
      return { isError: Boolean(response.result?.isError), text }
    },
    close() {
      child.kill()
    },
  }
}

function applyAssertion(assertion, text) {
  if (!assertion) return { ok: true }
  if (assertion.contains && !text.includes(assertion.contains)) {
    return { ok: false, reason: `expected text to contain ${JSON.stringify(assertion.contains)}` }
  }
  if (assertion.notContains && text.includes(assertion.notContains)) {
    return { ok: false, reason: `expected text to NOT contain ${JSON.stringify(assertion.notContains)}` }
  }
  return { ok: true }
}

// 执行一串 {tool, arguments, assert} 步骤；每步失败立即短路。
// 「交互副作用」验证依赖 browser-e2e-mcp.md §5：不能只断言元素存在，必须真的 click 后
// 再 snapshot 校验副作用（URL 变化/弹窗消失/toast 出现等），场景文件的步骤顺序本身就承载这个约束。
export async function runScenario({ steps, token, spawnFn, extraArgs, timeoutMs }) {
  if (!Array.isArray(steps) || !steps.length) throw new Error('browser scenario requires at least one step')
  const client = createMcpClient({ token, spawnFn, extraArgs, timeoutMs })
  const results = []
  try {
    await client.initialize()
    for (const step of steps) {
      const { isError, text } = await client.callTool(step.tool, step.arguments || {})
      const verdict = isError ? { ok: false, reason: 'tool call returned isError' } : applyAssertion(step.assert, text)
      results.push({ tool: step.tool, ok: verdict.ok, reason: verdict.reason, excerpt: text.slice(0, 300) })
      if (!verdict.ok) break
    }
  } finally {
    client.close()
  }
  return { ok: results.every((r) => r.ok) && results.length === steps.length, results }
}

export function selfTest() {
  // 用注入的假 spawnFn 模拟 MCP server：不需要真实浏览器/网络，验证协议编排本身的正确性。
  function fakeMcpServer() {
    const listeners = { data: [] }
    const stdin = { write(payload) {
      const msg = JSON.parse(payload)
      queueMicrotask(() => {
        let response
        if (msg.method === 'initialize') {
          response = { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'fake', version: '0' } } }
        } else if (msg.method === 'tools/call' && msg.params.name === 'browser_navigate') {
          response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'Page URL: https://example.com/' }] } }
        } else if (msg.method === 'tools/call' && msg.params.name === 'browser_click_and_check') {
          response = { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'dialog closed, url unchanged' }] } }
        } else if (msg.method === 'notifications/initialized') {
          return
        } else {
          response = { jsonrpc: '2.0', id: msg.id, error: { message: `unknown method ${msg.method}` } }
        }
        for (const fn of listeners.data) fn(Buffer.from(`${JSON.stringify(response)}\n`))
      })
    } }
    const stdout = { on(event, fn) { if (event === 'data') listeners.data.push(fn) } }
    const stderr = { on() {} }
    return { stdin, stdout, stderr, kill() {} }
  }
  const fakeSpawn = () => fakeMcpServer()

  return (async () => {
    const good = await runScenario({
      token: 'fake-token',
      spawnFn: fakeSpawn,
      steps: [
        { tool: 'browser_navigate', arguments: { url: 'https://example.com' }, assert: { contains: 'example.com' } },
        { tool: 'browser_click_and_check', arguments: {}, assert: { contains: 'closed' } },
      ],
    })
    assert.equal(good.ok, true)
    assert.equal(good.results.length, 2)

    const bad = await runScenario({
      token: 'fake-token',
      spawnFn: fakeSpawn,
      steps: [
        { tool: 'browser_navigate', arguments: { url: 'https://example.com' }, assert: { contains: 'nonexistent-marker' } },
        { tool: 'browser_click_and_check', arguments: {} },
      ],
    })
    assert.equal(bad.ok, false)
    assert.equal(bad.results.length, 1) // 第一步失败即短路，第二步不执行

    assert.throws(() => createMcpClient({ token: '' }), /PLAYWRIGHT_MCP_EXTENSION_TOKEN is required/)

    console.log('playwright-mcp-adapter self-test passed (protocol orchestration, assertion short-circuit, missing-token guard).')
  })()
}

function printHelp() {
  console.log(`usage: playwright-mcp-adapter.mjs --scenario <scenario.json> [--timeout-ms <ms>]

Drive the system Chrome via the Playwright browser extension (@playwright/mcp --extension) using a
scripted sequence of MCP tool calls. Requires PLAYWRIGHT_MCP_EXTENSION_TOKEN in the environment
(same token configured for the Chrome extension pairing, see ~/.cursor/mcp.json for reference).

Scenario file: { "steps": [ { "tool": "browser_navigate", "arguments": {"url": "..."}, "assert": {"contains": "..."} }, ... ] }

Exits 0 if every step's assertion passes, 1 otherwise (with a JSON result report on stdout).`)
}

if (process.argv[1]?.endsWith('playwright-mcp-adapter.mjs')) {
  if (process.argv.includes('--self-test')) {
    selfTest().catch((error) => { console.error(error); process.exitCode = 1 })
  } else if (process.argv.includes('--help') || !process.argv.includes('--scenario')) {
    printHelp()
    process.exit(process.argv.includes('--help') ? 0 : 1)
  } else {
    const scenarioIndex = process.argv.indexOf('--scenario')
    const scenarioPath = process.argv[scenarioIndex + 1]
    const timeoutIndex = process.argv.indexOf('--timeout-ms')
    const timeoutMs = timeoutIndex >= 0 ? Number(process.argv[timeoutIndex + 1]) : undefined
    const token = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN
    const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'))
    runScenario({ steps: scenario.steps, token, timeoutMs }).then((result) => {
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    }).catch((error) => {
      console.error(error.message)
      process.exit(1)
    })
  }
}
