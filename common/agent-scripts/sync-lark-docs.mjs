#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDocsPath, resolveRoots } from './lib/roots.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config: bindingConfig } = resolveRoots()
const larkCliBin = process.env.LARK_CLI_BIN || 'lark-cli'
const allowedServices = new Set(['doc', 'docs', 'wiki', 'drive', 'markdown'])
const allowedOperations = new Set(['read', 'search'])
const forbiddenTokenPattern = /(create|update|patch|delete|remove|write|append|upload|send|reply|complete|move|copy|share|permission)/i
const remoteUrlPattern = /^https?:\/\//i

function printHelp() {
  console.log(`usage: sync-lark-docs.mjs [--config <path>] [--dry-run] [--help]

Read-only sync of Lark docs/wiki/drive/markdown into docs_tdd local copies.
Normally invoked via the per-project wrapper at <PROJECT-ID>/agent/scripts/sync-lark-docs.mjs.

Options:
  --help     Show this help message and exit
  --config   Path to lark-sources.json (default: first positional arg)
  --dry-run  Print planned commands without fetching`)
}

if (process.argv.includes('--help')) {
  printHelp()
  process.exit(0)
}

const parseArgs = (argv) => {
  const options = {
    dryRun: false,
    configPath: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--config') {
      options.configPath = argv[index + 1]
      index += 1
      continue
    }

    if (!options.configPath) {
      options.configPath = arg
    }
  }

  return options
}

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'))

const isLocalMarkdownSource = (source) => {
  const sourcePath = source.path || source.url
  return source.type === 'markdown' && sourcePath && !remoteUrlPattern.test(sourcePath)
}

const resolveLocalMarkdownSource = (source) => {
  return resolveDocsPath(source.path || source.url, {
    consumerRoot: repoRoot,
    docsMountPath: bindingConfig.docsMountPath,
    mustExist: true,
  })
}

const assertInside = (parent, child, label) => {
  const relative = path.relative(parent, child)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${parent}: ${child}`)
  }
}

const normalizeTargetPath = ({ outputDir, target }) => {
  if (!target || path.isAbsolute(target) || target.includes('..')) {
    throw new Error(`source target must be a safe relative path: ${target || '<empty>'}`)
  }

  const resolvedOutputDir = resolveDocsPath(outputDir, {
    consumerRoot: repoRoot,
    docsMountPath: bindingConfig.docsMountPath,
  })

  const targetPath = path.resolve(resolvedOutputDir, target)
  assertInside(resolvedOutputDir, targetPath, 'target')

  return { resolvedOutputDir, targetPath }
}

const shellQuote = (value) => {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value
  }

  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

const buildDefaultCommand = (source) => {
  const service = ['doc', 'docs', 'wiki'].includes(source.type) ? 'docs' : source.type
  const operation = source.operation || 'read'

  if (service === 'docs' && operation === 'read') {
    return [larkCliBin, 'docs', '+fetch', '--api-version', 'v2', '--doc', source.url, '--doc-format', 'markdown']
  }

  const urlFlag = operation === 'search' ? '--query' : '--url'

  return [larkCliBin, service, `+${operation}`, urlFlag, source.url, '--format', 'markdown']
}

const getCommand = (source) => {
  if (Array.isArray(source.command) && source.command.length) {
    return source.command.map(String)
  }

  return buildDefaultCommand(source)
}

const validateSource = (source) => {
  const type = String(source.type || '')
  const operation = String(source.operation || 'read')

  if (!allowedServices.has(type)) {
    throw new Error(`unsupported Lark source type: ${type}`)
  }

  if (!allowedOperations.has(operation)) {
    throw new Error(`unsupported Lark source operation: ${operation}`)
  }

  if (!source.url) {
    throw new Error(`source ${source.name || '<unnamed>'} requires url`)
  }

  if (isLocalMarkdownSource(source)) {
    resolveLocalMarkdownSource(source)
    return null
  }

  const command = getCommand(source)
  const [binary, service, ...rest] = command
  const commandText = command.join(' ')
  const shortcut = rest.find((token) => token.startsWith('+'))

  if (binary !== 'lark-cli' && binary !== larkCliBin) {
    throw new Error(`only lark-cli is allowed: ${commandText}`)
  }

  if (!allowedServices.has(service)) {
    throw new Error(`lark-cli service is not read-sync allowed: ${service}`)
  }

  if (!shortcut || !['+read', '+search', '+fetch'].includes(shortcut)) {
    throw new Error(`lark-cli command must use +read, +search, or docs +fetch: ${commandText}`)
  }

  if (shortcut === '+fetch' && service !== 'docs') {
    throw new Error(`+fetch is only allowed for docs read sync: ${commandText}`)
  }

  if (shortcut && forbiddenTokenPattern.test(shortcut)) {
    throw new Error(`lark-cli command contains a forbidden write-like token: ${commandText}`)
  }

  return command
}

const runCommand = async (command) => {
  const [binary, ...args] = command

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] })
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
        resolve({ stdout, stderr })
        return
      }

      reject(new Error(`${command.map(shellQuote).join(' ')} failed with code ${code}: ${stderr || stdout}`))
    })
  })
}

const buildFrontMatter = ({ source, syncedAt, command }) => `---
sourceName: ${JSON.stringify(source.name || source.target)}
sourceType: ${JSON.stringify(source.type)}
sourceUrl: ${JSON.stringify(source.url)}
syncedAt: ${JSON.stringify(syncedAt)}
readOnly: true
command: ${JSON.stringify(command.join(' '))}
---

`

const writeSourceOutput = async ({ source, targetPath, command, stdout, stderr, syncedAt }) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })

  if (targetPath.endsWith('.md')) {
    await fs.writeFile(targetPath, `${buildFrontMatter({ source, syncedAt, command })}${stdout.trimEnd()}\n`)
  } else {
    await fs.writeFile(targetPath, stdout)
  }

  await fs.writeFile(`${targetPath}.metadata.json`, `${JSON.stringify({
    sourceName: source.name || source.target,
    sourceType: source.type,
    sourceUrl: source.url,
    syncedAt,
    readOnly: true,
    command,
    stderr: stderr.trim() || null,
    target: path.relative(repoRoot, targetPath),
  }, null, 2)}\n`)
}

const readLocalMarkdown = async (source) => {
  const sourcePath = resolveLocalMarkdownSource(source)
  const stdout = await fs.readFile(sourcePath, 'utf8')
  return { stdout, stderr: '', command: ['local-markdown', path.relative(repoRoot, sourcePath)] }
}

const writeReport = async ({ outputDir, rows }) => {
  const reportPath = path.join(resolveDocsPath(outputDir, {
    consumerRoot: repoRoot,
    docsMountPath: bindingConfig.docsMountPath,
  }), 'sync-report.md')
  assertInside(docsRoot, reportPath, 'sync-report')
  await fs.mkdir(path.dirname(reportPath), { recursive: true })

  const lines = [
    '# Lark 文档同步报告',
    '',
    '| 时间 | 资料 | 类型 | 结果 | 输出 |',
    '|------|------|------|------|------|',
    ...rows.map((row) => `| ${row.syncedAt} | ${row.name} | ${row.type} | ${row.status} | ${row.target} |`),
    '',
  ]

  await fs.writeFile(reportPath, lines.join('\n'))
}

export async function runSyncLarkDocs({ argv = process.argv.slice(2), defaultConfigPath } = {}) {
  const options = parseArgs(argv)
  options.configPath = options.configPath || defaultConfigPath

  if (!options.configPath) {
    throw new Error('sync-lark-docs requires --config <path>')
  }

  const configPath = resolveDocsPath(options.configPath, {
    consumerRoot: repoRoot,
    docsMountPath: bindingConfig.docsMountPath,
    mustExist: true,
  })

  const config = await readJson(configPath)
  const outputDir = config.outputDir || `apps/web/docs_tdd/${config.projectId}/inbox/lark-sync`
  const rows = []

  for (const source of config.sources || []) {
    const command = validateSource(source)
    const { targetPath } = normalizeTargetPath({ outputDir, target: source.target })
    const syncedAt = new Date().toISOString()
    const target = path.relative(repoRoot, targetPath)

    if (options.dryRun) {
      const status = command ? `dry-run: ${command.map(shellQuote).join(' ')}` : `dry-run: local markdown ${source.path || source.url}`
      rows.push({ syncedAt, name: source.name || source.target, type: source.type, status, target })
      continue
    }

    const result = command ? { ...(await runCommand(command)), command } : await readLocalMarkdown(source)
    await writeSourceOutput({ source, targetPath, command: result.command, stdout: result.stdout, stderr: result.stderr, syncedAt })
    rows.push({ syncedAt, name: source.name || source.target, type: source.type, status: 'synced', target })
  }

  if (!options.dryRun) {
    await writeReport({ outputDir, rows })
  }

  console.log(JSON.stringify({ ok: true, dryRun: options.dryRun, rows }, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSyncLarkDocs().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
