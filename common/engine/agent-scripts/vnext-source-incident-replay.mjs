#!/usr/bin/env node
// Read-only intake diagnostic for the four reported PRD incidents.
// This is not a per-unit golden coverage replay and never grants a pass.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isStructuralSourceUnit,
  normalizeSourceDocuments,
  readLocalSourceAsset,
} from './lib/vnext-source-units.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const INCIDENTS = {
  'PR-01947': {
    sourcePath: 'prds/PR-01947/inbox/lark-sync/prd-latest.md',
    format: 'lark-json-envelope',
    anchors: [
      { id: 'margin-mode', sample: '保证金模式', pattern: /保证金模式/ },
      { id: 'leverage', sample: '杠杆', pattern: /杠杆/ },
      { id: 'existing-position-copy', sample: '现有持仓复制', pattern: /现有持仓复制/ },
      { id: 'parameter-timing', sample: '仅后续新开仓', pattern: /仅后续新开仓/ },
    ],
  },
  'PR-02265': {
    sourcePath: 'prds/PR-02265/inbox/lark-sync/prd-latest.extracted.md',
    anchors: [
      { id: 'negative-fee-rate', sample: '支持负数、正数', pattern: /支持负数、正数/ },
      { id: 'negative-range', sample: '请输入【-100,100】之间的数字', pattern: /-100\s*,\s*100/ },
      { id: 'six-digit-precision', sample: '精度支持6位', pattern: /精度支持6位/ },
      { id: 'fee-flow-display', sample: '资金流水 开仓手续费 平仓手续费', pattern: /资金流水[\s\S]*开仓手续费[\s\S]*平仓手续费/ },
    ],
  },
  'PR-02306': {
    sourcePath: 'prds/PR-02306/inbox/lark-sync/prd-latest.extracted.md',
    anchors: [
      { id: 'special-character-range', sample: '特殊符号更新后范围 ^_ + [ ]', pattern: /特殊符号更新后范围[\s\S]{0,80}\^\\?_/ },
      { id: 'reset-password-copy', sample: '重置密码', pattern: /重置密码/ },
      { id: 'change-password-copy', sample: '修改登录密码', pattern: /修改登录密码/ },
      { id: 'registration-password-scenario', sample: '注册登录密码', pattern: /注册登录密码/ },
    ],
  },
  'PR-01930': {
    sourcePath: 'prds/PR-01930/inbox/lark-sync/prd-latest.extracted.md',
    anchors: [
      { id: 'manual-and-batch-invalidation', sample: '按指定用户维度 批量上传', pattern: /按指定用户维度[\s\S]*批量上传/ },
      { id: 'cancel-open-orders', sample: '自动撤单', pattern: /自动撤单/ },
      { id: 'keep-position-until-user-closes', sample: '不自动平仓 用户平仓后自动回收', pattern: /不(?:触发)?自动平仓[\s\S]*平仓后自动回收/ },
      { id: 'trial-fund-detail-and-export', sample: '体验金流水明细 导出报表也新增这个类型数据', pattern: /体验金流水明细[\s\S]*导出报表也新增这个类型数据/ },
    ],
  },
}

function parseArgs(args) {
  const options = { json: args.includes('--json') }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--source-root') options.sourceRoot = args[index + 1]
  }
  return options
}

function parseSourceDocument(projectId, sourceRoot) {
  const spec = INCIDENTS[projectId]
  const absolutePath = resolve(sourceRoot, spec.sourcePath)
  if (!existsSync(absolutePath)) throw new Error(`${projectId} source missing: ${spec.sourcePath}`)

  const raw = readFileSync(absolutePath, 'utf8')
  if (spec.format !== 'lark-json-envelope') {
    return { path: spec.sourcePath, content: raw }
  }

  const envelopeMatch = /^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  if (!envelopeMatch) throw new Error(`${projectId} Lark sync envelope is malformed`)
  const envelope = JSON.parse(envelopeMatch[1])
  const content = envelope?.data?.document?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(`${projectId} Lark envelope has no data.document.content`)
  }
  return { path: spec.sourcePath, content }
}

function readPr1930Asset(asset, sourceRoot) {
  const tokenPath = resolve(sourceRoot, 'prds/PR-01930/inbox/prd-assets/_tokens.json')
  const namesPath = resolve(sourceRoot, 'prds/PR-01930/inbox/prd-assets/names.txt')
  if (!existsSync(tokenPath) || !existsSync(namesPath)) {
    return { assetPath: asset.target, status: 'missing-token-map' }
  }

  const tokens = JSON.parse(readFileSync(tokenPath, 'utf8')).imgTokens || []
  const names = new Map(readFileSync(namesPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.split('='))
    .filter(([token, name]) => token && name)
    .map(([token, name]) => [token, name]))
  const token = basename(asset.target)
  const fileName = names.get(token)
  if (!tokens.includes(token) || !fileName) {
    return { assetPath: asset.target, status: 'unmapped-token' }
  }

  const assetPath = `prds/PR-01930/inbox/prd-assets/${fileName}.png`
  const resolvedAsset = readLocalSourceAsset({
    documentPath: 'prds/PR-01930/inbox/prd-assets/source-placeholder.md',
    target: `${fileName}.png`,
  }, { root: sourceRoot })
  return { ...resolvedAsset, assetPath }
}

function findEmbeddedObjects(documents, projectId, sourceRoot) {
  const objects = []
  const wbTokensPath = resolve(sourceRoot, 'prds/PR-01930/inbox/prd-assets/_tokens.json')
  const wbPreviewNames = [
    'wb1-体验金全生命周期状态流转.png',
    'wb2-体验金状态机含手动失效.png',
    'wb3-产品流程图.png',
  ]
  let whiteboardPreviews = new Map()
  if (projectId === 'PR-01930' && existsSync(wbTokensPath)) {
    const tokens = JSON.parse(readFileSync(wbTokensPath, 'utf8')).wbTokens || []
    whiteboardPreviews = new Map(tokens.map((token, index) => {
      const path = `prds/PR-01930/inbox/prd-assets/${wbPreviewNames[index]}`
      const absolutePath = resolve(sourceRoot, path)
      return [token, {
        path,
        status: existsSync(absolutePath) ? 'local-preview-available' : 'missing-preview',
        assetHash: existsSync(absolutePath) ? sha256(readFileSync(absolutePath)) : null,
      }]
    }))
  }

  for (const document of documents) {
    for (const match of document.content.matchAll(/<(sheet|whiteboard|file|iframe)\b([^>]*)>/gi)) {
      const token = /\btoken=["']([^"']+)["']/i.exec(match[2])?.[1] || null
      const preview = match[1].toLowerCase() === 'whiteboard' && token
        ? whiteboardPreviews.get(token) || null
        : null
      objects.push({
        type: match[1].toLowerCase(),
        token,
        status: 'unsupported-semantic-parser',
        ...(preview ? { preview } : {}),
      })
    }
  }
  return objects
}

function findImagesWithoutAlt(documents) {
  const missing = []
  for (const document of documents) {
    for (const match of document.content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)|<img\b[^>]*>/gi)) {
      if (match[1] !== undefined) {
        if (!match[1].trim()) missing.push({ path: document.path, target: match[2] })
        continue
      }
      const alt = /\balt=["']([^"']*)["']/i.exec(match[0])?.[1]
      const target = /\b(?:src|data-src)=["']([^"']+)["']/i.exec(match[0])?.[1] || '<unknown>'
      if (!alt?.trim()) missing.push({ path: document.path, target })
    }
  }
  return missing
}

function inspectIncident(projectId, documents, { revision = 'local', readAsset, sourceRoot } = {}) {
  const spec = INCIDENTS[projectId]
  const normalized = normalizeSourceDocuments(documents, { revision, readAsset })
  const sourceText = documents.map((document) => document.content).join('\n')
  const anchors = spec.anchors.map(({ id, pattern }) => ({
    id,
    present: pattern.test(sourceText),
  }))
  const semanticUnits = normalized.sourceUnits.filter((unit) => !isStructuralSourceUnit(unit))
  const assetCounts = Object.fromEntries([...new Set(normalized.sourceSnapshot.assets.map((asset) => asset.assetStatus))]
    .sort()
    .map((status) => [status, normalized.sourceSnapshot.assets.filter((asset) => asset.assetStatus === status).length]))
  const unresolvedAssets = normalized.sourceSnapshot.assets.filter((asset) => !['local', 'embedded'].includes(asset.assetStatus))
  const emptyAltImages = findImagesWithoutAlt(documents)
  const embeddedObjects = sourceRoot
    ? findEmbeddedObjects(documents, projectId, sourceRoot)
    : []
  const blockers = []
  if (unresolvedAssets.length) blockers.push('unresolved source assets')
  if (emptyAltImages.length) blockers.push('images without textual descriptions')
  if (embeddedObjects.length) blockers.push('unsupported embedded objects')
  if (anchors.some((anchor) => !anchor.present)) blockers.push('expected incident anchors absent')

  const fingerprintComplete = unresolvedAssets.length === 0
    && emptyAltImages.length === 0
    && embeddedObjects.length === 0
  return {
    projectId,
    sourcePaths: normalized.sourceSnapshot.sources.map((source) => source.path),
    normalizedContentFingerprint: normalized.sourceSnapshot.contentHash,
    sourceFingerprintComplete: fingerprintComplete,
    sourceFingerprint: fingerprintComplete ? normalized.sourceSnapshot.contentHash : null,
    units: {
      total: normalized.sourceUnits.length,
      semantic: semanticUnits.length,
      structural: normalized.sourceUnits.length - semanticUnits.length,
      byType: Object.fromEntries([...new Set(normalized.sourceUnits.map((unit) => unit.type))]
        .sort()
        .map((type) => [type, normalized.sourceUnits.filter((unit) => unit.type === type).length])),
    },
    assets: {
      total: normalized.sourceSnapshot.assets.length,
      byStatus: assetCounts,
      unresolved: unresolvedAssets.map(({ sourceId, path, assetStatus }) => ({ sourceId, path, assetStatus })),
      emptyAlt: emptyAltImages,
    },
    embeddedObjects,
    anchors,
    missingAnchors: anchors.filter((anchor) => !anchor.present).map((anchor) => anchor.id),
    coverageAssessment: 'not-performed',
    blockers,
    status: blockers.length ? 'blocked' : 'ready-for-manual-golden-review',
  }
}

function buildIncidentReport(projectId, sourceRoot) {
  const document = parseSourceDocument(projectId, sourceRoot)
  const readAsset = projectId === 'PR-01930'
    ? (asset) => readPr1930Asset(asset, sourceRoot)
    : (asset) => readLocalSourceAsset(asset, { root: sourceRoot })
  return inspectIncident(projectId, [document], { readAsset, sourceRoot })
}

export function runSourceIncidentReplay(sourceRoot) {
  if (!sourceRoot) throw new Error('usage: vnext-source-incident-replay.mjs --source-root <docs_tdd-root> [--json]')
  const root = resolve(sourceRoot)
  if (!existsSync(root)) throw new Error(`source root does not exist: ${root}`)
  const projects = Object.keys(INCIDENTS).map((projectId) => buildIncidentReport(projectId, root))
  return {
    status: projects.some((project) => project.status === 'blocked') ? 'blocked' : 'ready-for-manual-golden-review',
    coverageAssessment: 'not-performed',
    note: 'Source-anchor and intake diagnostics only; not a per-source-unit golden coverage replay.',
    projects,
  }
}

export function selfTest() {
  for (const [projectId, spec] of Object.entries(INCIDENTS)) {
    const content = [
      ...spec.anchors.map((anchor) => anchor.sample),
      '![embedded reference](data:image/png;base64,aGVsbG8=)',
    ].join('\n')
    const readAsset = ({ target }) => readLocalSourceAsset({ documentPath: `${projectId}/prd.md`, target })
    const first = inspectIncident(projectId, [{ path: `${projectId}/prd.md`, content }], { readAsset })
    const second = inspectIncident(projectId, [{ path: `${projectId}/prd.md`, content }], { readAsset })
    assert.deepEqual(first, second)
    assert.equal(first.status, 'ready-for-manual-golden-review')
    assert.equal(first.coverageAssessment, 'not-performed')
    assert.deepEqual(first.missingAnchors, [])

    const blocked = inspectIncident(projectId, [{
      path: `${projectId}/prd.md`,
      content: `${content}\n<sheet token="unparsed"></sheet>\n![missing](missing.png)`,
    }], {
      readAsset: ({ target }) => target === 'missing.png'
        ? { assetPath: target, status: 'missing' }
        : readLocalSourceAsset({ documentPath: `${projectId}/prd.md`, target }),
      sourceRoot: '/unused-in-self-test',
    })
    assert.equal(blocked.status, 'blocked')
    assert.ok(blocked.blockers.includes('unsupported embedded objects'))
    assert.equal(blocked.sourceFingerprintComplete, false)
    assert.ok(blocked.assets.unresolved.length > 0)
    assert.ok(blocked.embeddedObjects.length > 0)
  }
  console.log('vnext-source-incident-replay self-test passed (4 anchor sets + fail-closed asset/object controls)')
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    selfTest()
    return
  }

  const options = parseArgs(args)
  try {
    const report = runSourceIncidentReplay(options.sourceRoot)
    if (options.json) console.log(JSON.stringify(report, null, 2))
    else {
      console.log(`${report.status}: ${report.note}`)
      for (const project of report.projects) {
        console.log(`${project.status} ${project.projectId}: ${project.units.semantic}/${project.units.total} semantic units; ${project.assets.total} images; ${project.embeddedObjects.length} unsupported embeds`)
        if (project.missingAnchors.length) console.log(`  missing anchors: ${project.missingAnchors.join(', ')}`)
        if (project.blockers.length) console.log(`  blockers: ${project.blockers.join('; ')}`)
      }
    }
    process.exitCode = report.status === 'blocked' ? 1 : 0
  } catch (error) {
    console.error(error.message)
    process.exitCode = 2
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
