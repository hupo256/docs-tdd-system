#!/usr/bin/env node
// Runs one reviewed command in its own process group so a timeout also terminates descendants.

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_OUTPUT_BYTES = 8 * 1024 * 1024

function appendOutput(current, chunk) {
  const next = `${current}${chunk.toString()}`
  return next.length <= MAX_OUTPUT_BYTES ? next : next.slice(-MAX_OUTPUT_BYTES)
}

export async function runCommand({ argv, cwd, timeoutMs }) {
  if (!Array.isArray(argv) || !argv.length) throw new Error('command runner requires argv')
  return await new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      detached: process.platform !== 'win32',
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => { stdout = appendOutput(stdout, chunk) })
    child.stderr.on('data', (chunk) => { stderr = appendOutput(stderr, chunk) })
    child.on('error', (error) => { stderr = appendOutput(stderr, `\n${error.message}`) })

    const terminate = (signal) => {
      try {
        if (process.platform === 'win32') child.kill(signal)
        else process.kill(-child.pid, signal)
      } catch {
        // The process group may already have exited.
      }
    }
    const timeout = setTimeout(() => {
      timedOut = true
      terminate('SIGTERM')
      setTimeout(() => terminate('SIGKILL'), 2000).unref()
    }, timeoutMs)
    timeout.unref()

    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({
        exitCode: timedOut ? 124 : Number.isInteger(code) ? code : 1,
        signal: signal || '',
        stdout,
        stderr: `${stderr}${timedOut ? `\ncommand timed out after ${Math.ceil(timeoutMs / 1000)}s` : ''}`,
      })
    })
  })
}

export async function selfTest() {
  const passed = await runCommand({ argv: [process.execPath, '-e', "console.log('ok')"], cwd: process.cwd(), timeoutMs: 1000 })
  assert.equal(passed.exitCode, 0)
  assert.match(passed.stdout, /ok/)
  const timedOut = await runCommand({ argv: [process.execPath, '-e', 'setInterval(() => {}, 1000)'], cwd: process.cwd(), timeoutMs: 50 })
  assert.equal(timedOut.exitCode, 124)
  assert.match(timedOut.stderr, /timed out/)
  console.log('vnext-command-runner self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) await selfTest()
  else try {
    const input = JSON.parse(readFileSync(0, 'utf8'))
    console.log(JSON.stringify(await runCommand(input)))
  } catch (error) {
    console.log(JSON.stringify({ exitCode: 1, signal: '', stdout: '', stderr: error.message }))
    process.exitCode = 1
  }
}
