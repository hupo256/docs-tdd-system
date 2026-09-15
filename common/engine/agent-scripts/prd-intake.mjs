#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { validateSource } from './lib/lark-command.mjs'
import { classifyDriftUnverified, compareRemoteSnapshot, hashCanonicalLarkContent, parseLarkDocumentPayload, remoteSnapshotFromMetadata } from './lib/lark-prd-drift.mjs'
import { resolveDocsPath, resolveProjectRoot, resolveRoots } from './lib/roots.mjs'
import { fingerprint, inspectManifest, scanMarkdown, selfTest, sourceContentHash } from './lib/prd-manifest.mjs'

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

// 每源的漂移核对 TTL 缓存：门禁在一个阶段里常被反复运行，只要基线 revision 未变且上次核对结果仍在 TTL 内，
// 就跳过再拉一次 lark-cli（拉取慢且偶发限流）。只缓存「与基线一致(ok)」的结果——检出漂移或拉取失败绝不缓存，
// 以免把一次坏结果冻结整个 TTL。缓存文件落在项目 inbox/lark-sync 下，键为 url\ntarget。
const driftCachePath = (projectDir) => join(projectDir, 'inbox/lark-sync/.drift-cache.json')
const readDriftCache = (projectDir) => {
  try {
    return existsSync(driftCachePath(projectDir)) ? JSON.parse(readFileSync(driftCachePath(projectDir), 'utf8')) : {}
  } catch {
    return {}
  }
}
const writeDriftCache = (projectDir, cache) => {
  try {
    mkdirSync(dirname(driftCachePath(projectDir)), { recursive: true })
    writeFileSync(driftCachePath(projectDir), `${JSON.stringify(cache, null, 2)}\n`)
  } catch {
    // 缓存是纯优化，写不动（只读盘/权限）就跳过，绝不影响门禁判定
  }
}

function inspectRemoteDrift(projectDir, manifest, stage) {
  const config = larkConfig(projectDir)
  const sources = remoteLarkSources(config)
  if (!sources.length) return []

  const ttlMs = Number(process.env.DOC_PRD_DRIFT_TTL_MS || 5 * 60 * 1000)
  const maxStaleDays = Number(process.env.DOC_PRD_DRIFT_MAX_STALE_DAYS || 7)
  const cache = readDriftCache(projectDir)
  const now = Date.now()
  const expectedByKey = new Map((manifest?.remoteSources || []).map((source) => [`${source.url}\n${source.target}`, source]))
  const checks = sources.map((source) => {
    const key = `${source.url}\n${source.target}`
    const expected = expectedByKey.get(key)
    if (!expected) {
      return {
        ruleId: 'DOC-PRD-010',
        ok: false,
        message: `remote PRD baseline missing for ${source.name || source.target}; run sync-lark-docs then prd-intake --init`,
        severity: 'error',
        category: 'documentation',
      }
    }

    // TTL 缓存命中（同 revision 且上次为 ok，且未过期）→ 跳过 lark-cli 再拉一次。
    const cached = cache[key]
    if (cached?.ok && cached.revisionId === String(expected.revisionId || '') && now - (cached.checkedAt || 0) < ttlMs) {
      return {
        ruleId: 'DOC-PRD-010',
        ok: true,
        message: `remote PRD content hash matches intake baseline (cached ${Math.round((now - cached.checkedAt) / 1000)}s ago): ${source.name || source.target} (revision ${cached.revisionId || 'unknown'})`,
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
      // 只缓存 ok；检出漂移不缓存，以免下一轮误报「已修好」而放行。
      cache[key] = comparison.ok
        ? { ok: true, revisionId: String(expected.revisionId || ''), checkedAt: now }
        : undefined
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
      // 「拉不到远端」≠「确有漂移」：基线新鲜且非高阶门禁时只告警不阻断，避免离线/限流卡死整个 PRD intake。
      const verdict = classifyDriftUnverified({ syncedAt: expected.syncedAt, stage, now, maxStaleDays })
      const ageLabel = Number.isFinite(verdict.ageDays) ? `${verdict.ageDays.toFixed(1)}d` : 'unknown'
      const reason = verdict.escalate
        ? `cannot verify remote PRD drift (baseline stale ${ageLabel} or gate ${stage} ≥ G5 — blocking)`
        : `cannot verify remote PRD drift (transient fetch failure; baseline age ${ageLabel} still within ${maxStaleDays}d — warning only)`
      return {
        ruleId: 'DOC-PRD-010',
        ok: verdict.ok,
        message: `${reason} for ${source.name || source.target}: ${error.message}`,
        severity: verdict.severity,
        category: 'documentation',
      }
    }
  })
  writeDriftCache(projectDir, cache)
  return checks
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
    sources.push({ path: sourcePath, contentHash: sourceContentHash(text) })
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

// sync-lark-docs 写盘时在文档正文前加一段 yaml 前言（sourceName/syncedAt/...），前言不属于远端文档内容，
// 重算 remoteSources[].contentHash 前必须剥掉，才能与 fetch 时 hashCanonicalLarkContent(document.content) 同口径。
function stripFrontMatter(text) {
  return String(text || '').replace(/^---\n[\s\S]*?\n---\n+/, '')
}

function remoteSourceOutputDir(projectDir) {
  const config = larkConfig(projectDir)
  if (!config) return null
  return resolveDocsPath(config.outputDir || `apps/web/docs_tdd/prds/${config.projectId}/inbox/lark-sync`, {
    consumerRoot: repoRoot,
  })
}

// 就地重算：不重扫远端（不触发 lark-cli / inbox churn），只用已同步的本地原文重算指纹，
// 让「仅易变媒体元数据变化」的历史 manifest 迁移到新哈希公式而不 churn sourceId / 人工分类。
function remigrateManifest(projectId) {
  const { projectDir, manifestFile } = projectPaths(projectId)
  const existing = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null
  if (!existing) throw new Error(`no existing manifest to remigrate: ${relative(repoRoot, manifestFile)}`)

  const prefixes = { image: 'IMG', table: 'TABLE', embed: 'EMBED' }
  const counters = Object.fromEntries(Object.entries(prefixes).map(([type, prefix]) => [
    type,
    Math.max(0, ...(existing.items || [])
      .map((item) => item.sourceId.match(new RegExp(`^PRD-${prefix}-(\\d+)$`))?.[1])
      .filter(Boolean)
      .map(Number)),
  ]))

  const oldByLocator = new Map((existing.items || []).map((item) => [item.locator, item]))
  // 部分历史 manifest 生成于「同行同类型附加序号」特性之前，locator 缺 ":序号" 后缀（如 "...#L34:embed"
  // 而非 "...#L34:embed:1"）。仅当该 legacy key 在旧/新两侧都恰好唯一时才降级匹配，避免多图挤一行时误配；
  // 否则宁可判定为新增/丢弃，也不要在存在歧义时瞎猜。
  const legacyKeyOf = (locator) => locator.replace(/:\d+$/, '')
  const oldLegacyCounts = new Map()
  for (const item of existing.items || []) {
    const key = legacyKeyOf(item.locator)
    oldLegacyCounts.set(key, (oldLegacyCounts.get(key) || 0) + 1)
  }
  const oldByLegacyKey = new Map()
  for (const item of existing.items || []) {
    const key = legacyKeyOf(item.locator)
    if (oldLegacyCounts.get(key) === 1) oldByLegacyKey.set(key, item)
  }
  const matchedOldLocators = new Set()
  const sources = []
  const items = []
  let carried = 0
  let added = 0

  for (const source of existing.sources || []) {
    const text = readProjectSource(source.path)
    if (text === null) throw new Error(`PRD source must exist inside docs_tdd: ${source.path}`)
    sources.push({ path: source.path, contentHash: sourceContentHash(text) })
    const found = scanMarkdown(text, source.path, readProjectAsset)
    const newLegacyCounts = new Map()
    for (const item of found) {
      const key = legacyKeyOf(item.locator)
      newLegacyCounts.set(key, (newLegacyCounts.get(key) || 0) + 1)
    }
    for (const item of found) {
      let old = oldByLocator.get(item.locator)
      if (!old) {
        const key = legacyKeyOf(item.locator)
        const candidate = oldByLegacyKey.get(key)
        if (candidate && !matchedOldLocators.has(candidate.locator) && newLegacyCounts.get(key) === 1) old = candidate
      }
      if (old) {
        matchedOldLocators.add(old.locator)
        carried += 1
        items.push({ ...old, ...item })
      } else {
        added += 1
        counters[item.type] += 1
        items.push({
          sourceId: `PRD-${prefixes[item.type]}-${String(counters[item.type]).padStart(3, '0')}`,
          ...item,
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
  }

  const dropped = (existing.items || []).filter((item) => !matchedOldLocators.has(item.locator))

  const outputDir = remoteSourceOutputDir(projectDir)
  const remoteSources = (existing.remoteSources || []).map((remote) => {
    if (!outputDir) return remote
    const localPath = join(outputDir, remote.target)
    if (!existsSync(localPath)) return remote
    const text = readFileSync(localPath, 'utf8')
    return { ...remote, contentHash: hashCanonicalLarkContent(stripFrontMatter(text)) }
  })

  const manifest = {
    ...existing,
    generatedAt: new Date().toISOString(),
    remoteSources,
    sources,
    items,
  }
  manifest.approvedFingerprint = existing.approvedFingerprint
    ? fingerprint(sources, items, remoteSources)
    : existing.approvedFingerprint

  mkdirSync(dirname(manifestFile), { recursive: true })
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  return { manifest, summary: { carried, added, dropped: dropped.length, droppedIds: dropped.map((item) => item.sourceId) } }
}

const projectId = args[0]
if (!/^(?:PR|TR)-\d{5}$/.test(projectId || '')) {
  console.error('usage: prd-intake.mjs PR-01234 [--init --source <docs_tdd/*.md> ... | --remigrate | --stage G0|G2 | --approve] [--json]')
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

if (args.includes('--remigrate')) {
  const { summary } = remigrateManifest(projectId)
  const droppedLabel = summary.droppedIds.length ? ` (${summary.droppedIds.join(',')})` : ''
  const message = `remigrated ${relative(repoRoot, manifestFile)}: carried=${summary.carried} new=${summary.added} dropped=${summary.dropped}${droppedLabel}`
  if (args.includes('--json')) console.log(JSON.stringify({ ok: true, projectId, ...summary }, null, 2))
  else console.log(message)
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
checks.push(...inspectRemoteDrift(projectDir, manifest, stage))

if (args.includes('--approve')) {
  const blocking = checks.filter((check) => !check.ok && check.ruleId !== 'DOC-PRD-009')
  if (blocking.length) throw new Error(`cannot approve PRD intake: ${blocking.map((check) => check.ruleId).join(', ')}`)
  const currentSources = manifest.sources.map((source) => ({ path: source.path, contentHash: sourceContentHash(readProjectSource(source.path)) }))
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
