#!/usr/bin/env node
// Lark 只读文档同步的命令构造与安全校验层：只放行 lark-cli 的 read/search/docs-fetch，
// 扫描整条命令拦截写类 token，并把输出目标限制在 docs_tdd 内。validateSource 是禁写安全边界。
// 逻辑由 common/lark-bot/__tests__/lark-pure.test.mjs 经 sync-lark-docs re-export 覆盖。

import path from 'node:path'
import { resolveDocsPath, resolveRoots } from './roots.mjs'

const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, config: bindingConfig } = resolveRoots()
const larkCliBin = process.env.LARK_CLI_BIN || 'lark-cli'

const allowedServices = new Set(['doc', 'docs', 'wiki', 'drive', 'markdown'])
const allowedOperations = new Set(['read', 'search'])
const forbiddenTokenPattern = /(create|update|patch|delete|remove|write|append|upload|send|reply|complete|move|copy|share|permission)/i
const remoteUrlPattern = /^https?:\/\//i

export const shellQuote = (value) => {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export const isLocalMarkdownSource = (source) => {
  const sourcePath = source.path || source.url
  return source.type === 'markdown' && sourcePath && !remoteUrlPattern.test(sourcePath)
}

export const resolveLocalMarkdownSource = (source) =>
  resolveDocsPath(source.path || source.url, {
    consumerRoot: repoRoot,
    docsMountPath: bindingConfig.docsMountPath,
    mustExist: true,
  })

export const assertInside = (parent, child, label) => {
  const relative = path.relative(parent, child)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${parent}: ${child}`)
  }
}

export const normalizeTargetPath = ({ outputDir, target }) => {
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
  if (Array.isArray(source.command) && source.command.length) return source.command.map(String)
  return buildDefaultCommand(source)
}

export const validateSource = (source) => {
  const type = String(source.type || '')
  const operation = String(source.operation || 'read')

  if (!allowedServices.has(type)) throw new Error(`unsupported Lark source type: ${type}`)
  if (!allowedOperations.has(operation)) throw new Error(`unsupported Lark source operation: ${operation}`)
  if (!source.url) throw new Error(`source ${source.name || '<unnamed>'} requires url`)

  if (isLocalMarkdownSource(source)) {
    resolveLocalMarkdownSource(source)
    return null
  }

  const command = getCommand(source)
  const [binary, service, ...rest] = command
  const commandText = command.join(' ')
  const shortcut = rest.find((token) => token.startsWith('+'))

  if (binary !== 'lark-cli' && binary !== larkCliBin) throw new Error(`only lark-cli is allowed: ${commandText}`)
  if (!allowedServices.has(service)) throw new Error(`lark-cli service is not read-sync allowed: ${service}`)
  if (!shortcut || !['+read', '+search', '+fetch'].includes(shortcut)) {
    throw new Error(`lark-cli command must use +read, +search, or docs +fetch: ${commandText}`)
  }
  if (shortcut === '+fetch' && service !== 'docs') throw new Error(`+fetch is only allowed for docs read sync: ${commandText}`)

  // 禁写校验扫描整条命令的每个 token（不止 shortcut），防止 source.command 里夹带写命令；
  // 排除 source.url 本身以免 URL 路径里的普通词误触发。
  const forbiddenHit = command.filter((token) => token !== source.url).find((token) => forbiddenTokenPattern.test(token))
  if (forbiddenHit) throw new Error(`lark-cli command contains a forbidden write-like token (${forbiddenHit}): ${commandText}`)

  return command
}

// docsRoot 参与 writeReport 的 assertInside 边界；导出供主脚本复用。
export { docsRoot }
