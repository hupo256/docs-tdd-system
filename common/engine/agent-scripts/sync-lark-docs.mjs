#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { resolveDocsPath, resolveRoots } from './lib/roots.mjs'
import {
  assertInside,
  docsRoot,
  normalizeTargetPath,
  resolveLocalMarkdownSource,
  shellQuote,
  validateSource,
} from './lib/lark-command.mjs'
import { localizeLarkMediaReferences, parseLarkDocumentPayload } from './lib/lark-prd-drift.mjs'

// 安全边界 validateSource 沿用从本文件导入（common/lark-bot/__tests__/lark-pure.test.mjs 依赖此路径）。
export { validateSource } from './lib/lark-command.mjs'

const { consumerRoot: repoRoot, config: bindingConfig } = resolveRoots()
// lark-cli 子进程超时兜底（默认 120s；文档同步可能较慢，给宽一点）
const larkCliTimeoutMs = Number(process.env.LARK_CLI_TIMEOUT_MS || 120000)

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

const runCommand = async (command) => {
  const [binary, ...args] = command

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(value)
    }
    // 超时兜底：卡网/卡登录时先 SIGTERM，宽限 3s 再 SIGKILL，并 reject，避免同步永久挂起
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // 进程可能已退出
        }
      }, 3000)
      finish(reject, new Error(`${command.map(shellQuote).join(' ')} timed out after ${larkCliTimeoutMs}ms`))
    }, larkCliTimeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => finish(reject, error))
    child.on('exit', (code) => {
      if (code === 0) {
        finish(resolve, { stdout, stderr })
        return
      }

      finish(reject, new Error(`${command.map(shellQuote).join(' ')} failed with code ${code}: ${stderr || stdout}`))
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

  const remoteDocument = command?.includes('+fetch') ? parseLarkDocumentPayload(stdout) : null
  const output = remoteDocument?.content ?? stdout
  const cleanMarkdown = (value) => String(value).replace(/[ \t]+$/gm, '').trimEnd()

  if (targetPath.endsWith('.md')) {
    await fs.writeFile(targetPath, `${buildFrontMatter({ source, syncedAt, command })}${cleanMarkdown(output)}\n`)
  } else {
    await fs.writeFile(targetPath, output)
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
    remoteContentHash: remoteDocument?.contentHash || null,
    remoteDocumentId: remoteDocument?.documentId || null,
    remoteRevisionId: remoteDocument?.revisionId || null,
    identity: remoteDocument?.identity || null,
  }, null, 2)}\n`)

  if (remoteDocument && source.localizedTarget) {
    const outputDir = path.dirname(targetPath)
    const { targetPath: localizedPath } = normalizeTargetPath({
      outputDir,
      target: source.localizedTarget,
    })
    const localized = localizeLarkMediaReferences(remoteDocument.content)
    const assetDir = path.join(outputDir, 'assets')
    await fs.mkdir(assetDir, { recursive: true })
    for (const media of localized.media) {
      const response = await fetch(media.url)
      if (!response.ok) throw new Error(`failed to download PRD media ${media.fileName}: HTTP ${response.status}`)
      await fs.writeFile(path.join(assetDir, media.fileName), Buffer.from(await response.arrayBuffer()))
    }
    const frontMatter = `---\nsourceName: ${JSON.stringify(`${source.name || source.target} (extracted, localized assets)`)}\nsourceType: ${JSON.stringify(source.type)}\nsourceUrl: ${JSON.stringify(source.url)}\nderivedFrom: ${JSON.stringify(source.target)}\nsyncedAt: ${JSON.stringify(syncedAt)}\nreadOnly: true\n---\n\n`
    await fs.writeFile(localizedPath, `${frontMatter}${cleanMarkdown(localized.content)}\n`)
  }
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
  const outputDir = config.outputDir || `apps/web/docs_tdd/prds/${config.projectId}/inbox/lark-sync`
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
