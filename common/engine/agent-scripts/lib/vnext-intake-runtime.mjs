// vNext source intake runtime: source synchronization, project setup, and work-item initialization.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { docsSystemRoot, resolveDocsPath } from './roots.mjs'
import { sourceTypeFromPrd } from './project-scaffold.mjs'
import { normalizeSourceDocuments, readLocalSourceAsset } from './vnext-source-units.mjs'
import { bindVNextIntake, vNextBranchName } from './vnext-intake.mjs'
import { initializeVNextArtifacts } from './vnext-persistence.mjs'
import { stableFingerprint } from './vnext-work-item.mjs'
import { initialAutopilotState } from './vnext-autopilot.mjs'
import { initialSourceReadiness } from './vnext-source-readiness.mjs'

export function createVNextIntakeRuntime({ docsRoot, consumerRoot, config, resolveProjectRoot, executeScript }) {
  function readJson(file) {
    try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
  }

  function syncAndInit(id, { legacy = true } = {}) {
    const configFile = join(resolveProjectRoot(id), 'agent/lark-sources.json')
    const sources = readJson(configFile)
    if (!sources?.sources?.length) return { ok: false, nextAction: 'sync_prd', error: 'lark-sources.json 缺失或为空' }
    const sync = executeScript('sync-lark-docs.mjs', ['--config', configFile])
    if (sync.status !== 0) {
      return { ok: false, nextAction: 'sync_prd', error: (sync.stderr || sync.stdout).trim().slice(0, 1200) }
    }
    const source = sources.sources[0]
    const syncedPath = join(sources.outputDir, source.target)
    if (!legacy) return { ok: true, nextAction: 'vnext_init', syncedPath }
    const intake = executeScript('prd-intake.mjs', [id, '--init', '--source', syncedPath])
    if (intake.status !== 0) {
      return { ok: false, nextAction: 'initialize_prd_intake', error: (intake.stderr || intake.stdout).trim().slice(0, 1200), syncedPath }
    }
    return { ok: true, nextAction: 'complete_g0_g1_docs', syncedPath }
  }

  function kickoffVNext(projectId, projectDir, prd, title, intakeKind) {
    mkdirSync(join(projectDir, 'inbox/lark-sync'), { recursive: true })
    mkdirSync(join(projectDir, 'agent'), { recursive: true })
    const branchName = vNextBranchName(projectId, intakeKind, config.branchPrefix || 'feature/')
    const sourceRole = intakeKind === 'bugfix' ? 'incident' : 'prd'
    const sourceLabel = intakeKind === 'bugfix' ? '缺陷报告' : '需求 PRD'
    writeFileSync(join(projectDir, 'README.md'), `---\nprojectId: ${projectId}\nstatus: active\nstage: G1\nbranch: ${branchName}\nworktree: ""\nport: ""\nvisualFidelity: standard\nprdSource: ${prd}\nfigmaNode: ""\nlarkEnabled: false\nworkflowVersion: 2\nworkItemKind: ${intakeKind}\n---\n\n# ${projectId} ${title}\n\n> v2 Autopilot ${intakeKind === 'bugfix' ? 'Bugfix' : 'Feature'} 项目：${sourceLabel}是唯一必需的开工输入；Figma/API 可后续增量接入。工作事实只保存在 work-item.json、latest-result.json、runs.jsonl。\n\n## 继续开发\n\n运行 \`docs-tdd run ${projectId}\`。CLI 会根据当前事实返回唯一下一动作；正常路径无需手工选择 Gate 或拼装验证输入。\n`)
    const larkOutputDir = join(
      config.docsMountPath || 'apps/web/docs_tdd',
      relative(docsRoot, projectDir),
      'inbox/lark-sync',
    )
    writeFileSync(join(projectDir, 'agent/lark-sources.json'), JSON.stringify({
      projectId,
      outputDir: larkOutputDir,
      sources: [{
        type: sourceTypeFromPrd(prd), operation: 'read', name: sourceLabel, url: prd,
        target: `${sourceRole}-latest.md`, localizedTarget: `${sourceRole}-latest.extracted.md`,
      }],
    }, null, 2))
  }

  function initializeVNextWorkItem(projectId, projectDir, intakeKind) {
    const manifest = readJson(join(projectDir, 'agent/prd-source-manifest.json'))
    const sourceConfig = readJson(join(projectDir, 'agent/lark-sources.json'))?.sources?.[0]
    const rawSyncedMd = join(projectDir, 'inbox/lark-sync', sourceConfig?.target || 'prd-latest.md')
    const localizedSyncedMd = join(projectDir, 'inbox/lark-sync', sourceConfig?.localizedTarget || 'prd-latest.extracted.md')
    const syncedMd = existsSync(localizedSyncedMd) ? localizedSyncedMd : rawSyncedMd
    if (!existsSync(syncedMd)) {
      return {
        ok: false,
        initialized: false,
        nextAction: 'sync_prd',
        error: 'synced PRD is missing after source synchronization',
      }
    }
    const revision = manifest?.remoteSources?.[0]?.revisionId || '1'
    const sourcePath = relative(docsRoot, syncedMd)
    const { sourceSnapshot } = normalizeSourceDocuments([{ path: sourcePath, content: readFileSync(syncedMd, 'utf8') }], {
      revision,
      readAsset: (asset) => readLocalSourceAsset(asset, { root: docsRoot }),
    })
    const workItemPath = join(projectDir, 'work-item.json')
    if (existsSync(workItemPath)) {
      const existing = readJson(workItemPath)
      if (!existing) {
        return {
          ok: false,
          initialized: false,
          nextAction: 'inspect_work_item',
          error: 'existing work-item.json is unreadable or invalid; preserve it for inspection instead of reinitializing',
        }
      }
      if (stableFingerprint(existing.sourceSnapshot) !== stableFingerprint(sourceSnapshot)) {
        return {
          ok: false,
          initialized: false,
          nextAction: 'source_update',
          error: 'PRD source changed since kickoff; preserve the current work item and apply the change through docs-tdd source-update',
        }
      }
      return { ok: true, initialized: false, idempotent: true }
    }
    const workItem = {
      schemaVersion: 1,
      workflowVersion: 2,
      projectId,
      intake: bindVNextIntake(intakeKind, sourceSnapshot),
      sourceSnapshot,
      requirements: [],
      coverageAudit: {
        sourceFingerprint: 'pending', requirementsFingerprint: 'pending', reviewMode: 'independent-cold-read',
        reviewRunId: 'pending', reviewer: { kind: 'model', id: 'pending' },
        completedAt: '2000-01-01T00:00:00Z', verdict: 'changes-required',
        unresolved: ['kickoff stub: requirements not extracted from PRD yet'],
      },
      routing: { scopeClass: 'local', riskSignals: ['unclassified'], verificationLevel: 'V0', routerVersion: 1 },
      apiDependency: { mode: 'no-request', reason: 'kickoff stub before intake; reassess after requirement extraction' },
      sourceReadiness: initialSourceReadiness(),
      scopeApproval: null,
      autopilot: initialAutopilotState(),
    }
    initializeVNextArtifacts(projectDir, workItem)
    return { ok: true, initialized: true, idempotent: false }
  }

  function sourceIdentity(source) {
    const value = String(source || '').trim()
    if (/^https?:\/\//i.test(value)) return `url:${value}`
    try {
      return `path:${resolveDocsPath(value, { consumerRoot, docsMountPath: config.docsMountPath })}`
    } catch {
      return `raw:${value}`
    }
  }

  function initializeFromBoundSource(id, requestedPrd = '') {
    const projectDir = resolveProjectRoot(id)
    const configuredPrd = readJson(join(projectDir, 'agent/lark-sources.json'))?.sources?.[0]?.url
    if (requestedPrd && (!configuredPrd || sourceIdentity(configuredPrd) !== sourceIdentity(requestedPrd))) {
      return {
        ok: false,
        nextAction: 'source_update',
        error: 'PRD source differs from the source bound at kickoff; preserve the current work item and use docs-tdd source-update',
      }
    }

    const synced = syncAndInit(id, { legacy: false })
    if (!synced.ok) return synced
    const readme = existsSync(join(projectDir, 'README.md')) ? readFileSync(join(projectDir, 'README.md'), 'utf8') : ''
    const intakeKind = readJson(join(projectDir, 'work-item.json'))?.intake?.kind
      || readme.match(/^workItemKind:\s*(.*)$/m)?.[1]?.trim()
      || 'feature'
    const initialized = initializeVNextWorkItem(id, projectDir, intakeKind)
    return initialized.ok
      ? { ok: true, syncedPath: synced.syncedPath, initialized }
      : { ...initialized, syncedPath: synced.syncedPath }
  }

  return {
    syncAndInit,
    kickoffVNext,
    initializeVNextWorkItem,
    sourceIdentity,
    initializeFromBoundSource,
  }
}

export function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'vnext-intake-runtime-'))
  const projectDir = join(root, 'PR-00001')
  const calls = []
  const runtime = createVNextIntakeRuntime({
    docsRoot: docsSystemRoot,
    consumerRoot: root,
    config: { docsMountPath: 'apps/web/docs_tdd' },
    resolveProjectRoot: () => projectDir,
    executeScript: (script, args) => {
      calls.push([script, args])
      return { status: 0, stdout: '', stderr: '' }
    },
  })

  try {
    assert.equal(
      runtime.sourceIdentity(join(docsSystemRoot, 'README.md')),
      runtime.sourceIdentity('apps/web/docs_tdd/README.md'),
    )
    assert.equal(runtime.sourceIdentity('https://example.invalid/prd'), 'url:https://example.invalid/prd')

    mkdirSync(join(projectDir, 'agent'), { recursive: true })
    writeFileSync(join(projectDir, 'agent/lark-sources.json'), JSON.stringify({
      outputDir: join(projectDir, 'inbox/lark-sync'),
      sources: [{ target: 'prd-latest.md', url: 'https://example.invalid/prd' }],
    }))
    const mismatch = runtime.initializeFromBoundSource('PR-00001', 'https://example.invalid/other')
    assert.equal(mismatch.nextAction, 'source_update')
    assert.equal(calls.length, 0)

    const syncOnly = runtime.syncAndInit('PR-00001', { legacy: false })
    assert.equal(syncOnly.nextAction, 'vnext_init')
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'sync-lark-docs.mjs')

    calls.length = 0
    const legacy = runtime.syncAndInit('PR-00001')
    assert.equal(legacy.nextAction, 'complete_g0_g1_docs')
    assert.deepEqual(calls.map(([script]) => script), ['sync-lark-docs.mjs', 'prd-intake.mjs'])
    console.log('vnext-intake-runtime self-test passed (source identity, source binding, sync routing)')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
