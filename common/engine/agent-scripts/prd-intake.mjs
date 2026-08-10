#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { validateSource } from './lib/lark-command.mjs'
import { compareRemoteSnapshot, parseLarkDocumentPayload, remoteSnapshotFromMetadata } from './lib/lark-prd-drift.mjs'
import { resolveDocsPath, resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { fingerprint, hash, inspectManifest, scanMarkdown, selfTest } from './lib/prd-manifest.mjs'

const { docsSystemRoot: docsRoot, consumerRoot: repoRoot } = resolveRoots()
const args = process.argv.slice(2)

if (args.includes('--self-test')) {
  selfTest()
  process.exit(0)
}

function projectPaths(projectId) {
  const projectDir = resolveProjectRoot(projectId)
  return { projectDir, manifestFile: join(projectDir, 'agent/prd-source-manifest.json') }
}

// 归属校验跟随软链接：apps/web/docs_tdd 可能是指向 docs 仓库根的 symlink，
// 纯字符串 startsWith 会误判为「不在 docs_tdd 内」，故对存在的路径先取 realpath 再比对。
function insideDocs(absolute) {
  if (!existsSync(absolute)) return false
  let real = absolute
  try { real = realpathSync(absolute) } catch { /* keep absolute */ }
  return real.startsWith(`${docsRoot}/`) || absolute.startsWith(`${docsRoot}/`)
}

function readProjectSource(sourcePath) {
  const absolute = resolve(repoRoot, sourcePath)
  if (!insideDocs(absolute)) return null
  return readFileSync(absolute, 'utf8')
}

function readProjectAsset(assetPath) {
  const absolute = resolve(repoRoot, assetPath)
  if (!insideDocs(absolute)) return null
  return readFileSync(absolute)
}

function readJson(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}

function larkConfig(projectDir) {
  const config = readJson(join(projectDir, 'agent/lark-sources.json'))
  return config?.sources?.length ? config : null
}

function remoteLarkSources(config) {
  return (config?.sources || []).filter((source) => ['doc', 'docs', 'wiki'].includes(source.type) && /^https?:\/\//i.test(source.url || ''))
}

function snapshotsFromLastSync(projectDir) {
  const config = larkConfig(projectDir)
  if (!config) return []
  const outputDir = resolveDocsPath(config.outputDir || `apps/web/docs_tdd/prds/${config.projectId}/inbox/lark-sync`, {
    consumerRoot: repoRoot,
  })
  return remoteLarkSources(config).flatMap((source) => {
    const metadata = readJson(join(outputDir, `${source.target}.metadata.json`))
    const snapshot = remoteSnapshotFromMetadata({ source, metadata })
    return snapshot ? [snapshot] : []
  })
}

function inspectRemoteDrift(projectDir, manifest) {
  const config = larkConfig(projectDir)
  const sources = remoteLarkSources(config)
  if (!sources.length) return []

  const expectedByKey = new Map((manifest?.remoteSources || []).map((source) => [`${source.url}\n${source.target}`, source]))
  return sources.map((source) => {
    const expected = expectedByKey.get(`${source.url}\n${source.target}`)
    if (!expected) {
      return {
        ruleId: 'DOC-PRD-010',
        ok: false,
        message: `remote PRD baseline missing for ${source.name || source.target}; run sync-lark-docs then prd-intake --init`,
        severity: 'error',
        category: 'documentation',
      }
    }

    try {
      const command = validateSource(source)
      const fetched = spawnSync(command[0], command.slice(1), {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: Number(process.env.LARK_CLI_TIMEOUT_MS || 120000),
        env: {
          ...process.env,
          LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
          LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
        },
      })
      if (fetched.error) throw fetched.error
      if (fetched.status !== 0) throw new Error(fetched.stderr || fetched.stdout || `exit ${fetched.status}`)
      const actual = parseLarkDocumentPayload(fetched.stdout)
      const comparison = compareRemoteSnapshot(expected, actual)
      return {
        ruleId: 'DOC-PRD-010',
        ok: comparison.ok,
        message: comparison.ok
          ? `remote PRD content hash matches intake baseline: ${source.name || source.target} (revision ${actual.revisionId || 'unknown'})`
          : `remote PRD drift detected: ${source.name || source.target} (expected revision ${comparison.expectedRevisionId || 'unknown'}, current ${comparison.actualRevisionId || 'unknown'}); rerun sync and PRD intake`,
        severity: 'error',
        category: 'documentation',
      }
    } catch (error) {
      return {
        ruleId: 'DOC-PRD-010',
        ok: false,
        message: `cannot verify remote PRD drift for ${source.name || source.target}: ${error.message}`,
        severity: 'error',
        category: 'documentation',
      }
    }
  })
}

function initManifest(projectId, sourcePaths) {
  const { projectDir, manifestFile } = projectPaths(projectId)
  const previous = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
  const previousByKey = new Map((previous?.items || []).map((item) => [`${item.locator}:${item.contentHash}`, item]))
  const previousByContent = new Map()
  for (const item of previous?.items || []) {
    const key = `${item.type}:${item.contentHash}`
    if (!previousByContent.has(key)) previousByContent.set(key, item)
    else previousByContent.set(key, null)
  }
  const prefixes = { image: 'IMG', table: 'TABLE', embed: 'EMBED' }
  const counters = Object.fromEntries(Object.entries(prefixes).map(([type, prefix]) => [
    type,
    Math.max(0, ...(previous?.items || [])
      .map((item) => item.sourceId.match(new RegExp(`^PRD-${prefix}-(\\d+)$`))?.[1])
      .filter(Boolean)
      .map(Number)),
  ]))
  const sources = []
  const items = []
  for (const sourcePath of sourcePaths) {
    const text = readProjectSource(sourcePath)
    if (text === null) throw new Error(`PRD source must exist inside docs_tdd: ${sourcePath}`)
    sources.push({ path: sourcePath, contentHash: hash(text) })
    for (const found of scanMarkdown(text, sourcePath, readProjectAsset)) {
      const old = previousByKey.get(`${found.locator}:${found.contentHash}`)
        || previousByContent.get(`${found.type}:${found.contentHash}`)
      if (!old) counters[found.type] += 1
      items.push(old ? { ...old, ...found } : {
        sourceId: `PRD-${prefixes[found.type]}-${String(counters[found.type]).padStart(3, '0')}`,
        ...found,
        status: 'unresolved',
        classification: 'unresolved',
        readMethod: '',
        summary: '',
        featureIds: [],
        disposition: '',
        evidence: '',
      })
    }
  }
  const manifest = {
    version: 2,
    projectId,
    generatedAt: new Date().toISOString(),
    approvedFingerprint: '',
    remoteSources: snapshotsFromLastSync(projectDir),
    sources,
    items,
  }
  mkdirSync(dirname(manifestFile), { recursive: true })
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

const projectId = args[0]
if (!/^PR-\d{5}$/.test(projectId || '')) {
  console.error('usage: prd-intake.mjs PR-01234 [--init --source <docs_tdd/*.md> ... | --stage G0|G2 | --approve] [--json]')
  process.exit(1)
}

const { projectDir, manifestFile } = projectPaths(projectId)
if (args.includes('--init')) {
  const sourcePaths = args.flatMap((arg, index) => arg === '--source' && args[index + 1] ? [args[index + 1]] : [])
  if (!sourcePaths.length) throw new Error('--init requires at least one --source path relative to repository root')
  const manifest = initManifest(projectId, sourcePaths)
  console.log(`wrote ${relative(repoRoot, manifestFile)} (${manifest.items.length} rich-media item(s)); resolve every item before G2`)
  process.exit(0)
}

const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
const stage = args.includes('--stage') ? args[args.indexOf('--stage') + 1] : 'G2'
const checks = inspectManifest({
  manifest,
  projectId,
  stage,
  readSource: readProjectSource,
  readAsset: readProjectAsset,
  inventoryText: existsSync(join(projectDir, 'product/00-feature-inventory.md')) ? readFileSync(join(projectDir, 'product/00-feature-inventory.md'), 'utf8') : '',
  taskText: existsSync(join(projectDir, 'product/04-frontend-tasks.md')) ? readFileSync(join(projectDir, 'product/04-frontend-tasks.md'), 'utf8') : '',
})
checks.push(...inspectRemoteDrift(projectDir, manifest))

if (args.includes('--approve')) {
  const blocking = checks.filter((check) => !check.ok && check.ruleId !== 'DOC-PRD-009')
  if (blocking.length) throw new Error(`cannot approve PRD intake: ${blocking.map((check) => check.ruleId).join(', ')}`)
  const currentSources = manifest.sources.map((source) => ({ path: source.path, contentHash: hash(readProjectSource(source.path)) }))
  manifest.sources = currentSources
  manifest.approvedFingerprint = fingerprint(currentSources, manifest.items, manifest.remoteSources)
  manifest.generatedAt = new Date().toISOString()
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`approved PRD intake fingerprint ${manifest.approvedFingerprint}`)
  process.exit(0)
}

const result = { ok: checks.every((check) => check.ok), projectId, stage, checks }
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
else {
  console.log(`prd-intake: ${projectId} ${stage} — ${result.ok ? 'PASS' : 'BLOCK'} (${checks.filter((check) => check.ok).length}/${checks.length})`)
  for (const check of checks.filter((item) => !item.ok)) console.log(`FAIL ${check.ruleId} ${check.message}`)
}
process.exit(result.ok ? 0 : 1)
