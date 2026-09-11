#!/usr/bin/env node
// effective rules 体检：从 effective-rules.mjs 抽出的 doctor 装配逻辑。
//
// 纯 lib（agent-clients / hook-contract / rule-surface-visibility / l2-conflict-detect）直接 import；
// 运行态（sources / label / g / config / 已绑定的 snapshot·checkRelease·cursorAdapterMatches / 标志位）
// 经 deps 注入。私有 helper（containsProtocol / pathsResolveToCanonical / findHiddenRuleEntries 等）留在本文件。

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { REQUIRED_AGENT_CLIENT_IDS, validateAgentClientMatrix, validateRuntimeClientConformance } from './agent-clients.mjs'
import { createClaudeHookSpecs, createCodexHookSpecs, validateHookContract } from './hook-contract.mjs'
import { PI_EXTENSION_MARKERS } from './pi-adapter.mjs'
import { hasUnconditionalTeamPrecommit } from './precommit-wiring.mjs'
import { findL2Conflicts, findRepoEntryDuplicates, resolveL2Conflicts } from './l2-conflict-detect.mjs'
import { isCanonicalL1Symlink } from './rule-surface-visibility.mjs'

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function containsProtocol(file) {
  if (!existsSync(file)) return false
  const text = readFileSync(file, 'utf8')
  return ['rule-router.md', 'docs-tdd.mjs context', 'docs-tdd.mjs changed', 'docs-tdd.mjs gate'].every((token) => text.includes(token))
}

export function pathsResolveToCanonical(entries, canonical) {
  if (!existsSync(canonical)) return false
  const target = realpathSync(canonical)
  return entries.every((entry) => existsSync(entry) && realpathSync(entry) === target)
}

function listConsumerWorktrees(ruleConsumerRoot) {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: ruleConsumerRoot, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0) return [ruleConsumerRoot]
  return result.stdout
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
}

// skip-worktree 的 rule surface 默认判为「被隐藏」（error）。唯一例外：指向规范 L1 家目录的软链
// （如 CLAUDE.md → ~/.claude/*.CLAUDE.md），判定在 lib/rule-surface-visibility.mjs（可 --self-test）。
function findHiddenRuleEntries({ ruleConsumerRoot, config, g }) {
  const ruleSurfaces = [...config.ruleSurfaces.agents, ...config.ruleSurfaces.claude, config.ruleSurfaces.cursorRulesDir]
  const l1Roots = [g.aiRules, g.codex, g.claude].filter(Boolean)
  return listConsumerWorktrees(ruleConsumerRoot).flatMap((worktree) => {
    const result = spawnSync('git', ['ls-files', '-t', '--', ...ruleSurfaces], { cwd: worktree, encoding: 'utf8', stdio: 'pipe' })
    if (result.status !== 0) return [{ worktree, file: '(scan failed)' }]
    return result.stdout
      .split('\n')
      .filter((line) => line.startsWith('S '))
      .map((line) => ({ worktree, file: line.slice(2) }))
      .filter(({ file }) => !isCanonicalL1Symlink(join(worktree, file), l1Roots))
  })
}

function findDiscoverableSkillBackups(g) {
  return [join(g.codex, 'skills'), join(g.claude, 'skills'), join(g.pi, 'skills')].flatMap((skillsDir) => {
    if (!existsSync(skillsDir)) return []
    return readdirSync(skillsDir)
      .filter((name) => name.includes('.backup-'))
      .map((name) => join(skillsDir, name))
  })
}

/**
 * Run the full effective-rules doctor. Returns `{ ok, summary, effectiveRulesFingerprint, checks }`
 * and prints (json or text) as a side effect, mirroring the original in-file doctor().
 */
export function runDoctor(deps) {
  const { sources, label, g, config, docsSystemRoot, ruleConsumerRoot, home, manifestFile, expectedCursorAdapter, createSnapshot, checkRelease, collectL2Files, conflictOverrides, cursorAdapterMatches, json, allowTrackedRuleChanges, strict = false } = deps
  const CODEX_HOOK_COMMAND = `node ${join(docsSystemRoot, 'common/engine/agent-scripts/rule-context-hook.mjs')} --client codex`
  const CLAUDE_HOOK_COMMAND = `node ${join(docsSystemRoot, 'common/engine/agent-scripts/rule-context-hook.mjs')} --client claude`
  const CODEX_GATE_COMMAND = `node ${join(docsSystemRoot, 'common/engine/agent-scripts/claude-posttooluse-gate.mjs')}`
  const checks = []
  const add = (id, ok, severity, message, file = '') => checks.push({ id, ok, severity, message, file })

  for (const file of [...sources.l1, ...sources.adapters.slice(0, 3)]) {
    add('ADAPTER-EXISTS', existsSync(file), 'error', `${label(file)} ${existsSync(file) ? 'exists' : 'is missing'}`, label(file))
  }
  for (const file of sources.adapters.slice(0, 3)) {
    add('ADAPTER-PROTOCOL', containsProtocol(file), 'error', `${label(file)} ${containsProtocol(file) ? 'declares' : 'does not declare'} router/context/changed/gate`, label(file))
  }
  const cursorExact = cursorAdapterMatches()
  add('ADAPTER-EXACT', cursorExact, 'error', `${label(g.cursorLocalGovernance)} ${cursorExact ? 'matches the generated canonical adapter' : 'differs from the generated canonical adapter; rerun install-local-agent-rules.mjs'}`, label(g.cursorLocalGovernance))
  const adapterTargets = [join(ruleConsumerRoot, config.docsMountPath, 'common/rules/rule-router.md'), join(ruleConsumerRoot, config.docsMountPath, 'common/engine/agent-scripts/docs-tdd.mjs')]
  const targetsExist = adapterTargets.every(existsSync)
  add('ADAPTER-TARGETS', targetsExist, 'error', targetsExist ? 'router and docs-tdd command targets exist' : `missing adapter target: ${adapterTargets.filter((file) => !existsSync(file)).join(', ')}`, config.docsMountPath)
  const matrix = createSnapshot().clientMatrix
  const coverage = validateAgentClientMatrix(matrix)
  const matrixFingerprints = new Set(Object.values(matrix).map((client) => client.sourceFingerprint))
  add(
    'VERIFY-RULE-003',
    coverage.ok,
    'error',
    coverage.ok ? `all registered AI entrypoints are covered: ${REQUIRED_AGENT_CLIENT_IDS.join(', ')}` : `AI entrypoint coverage invalid; missing=${coverage.missing.join(',') || 'none'} extra=${coverage.extra.join(',') || 'none'} incomplete=${coverage.incomplete.join(',') || 'none'}`,
    label(manifestFile),
  )
  add('VERIFY-RULE-001', matrixFingerprints.size === 1, 'error', matrixFingerprints.size === 1 ? 'all registered AI entrypoints resolve to one canonical L1/L2/L3 source set' : 'client rule source sets diverge', label(manifestFile))
  for (const runtimeAdapter of sources.runtimeAdapters) {
    add('RUNTIME-ADAPTER-EXISTS', existsSync(runtimeAdapter), 'error', `${label(runtimeAdapter)} ${existsSync(runtimeAdapter) ? 'exists' : 'is missing'}`, label(runtimeAdapter))
  }
  for (const skill of ['coding-quality', 'figma-read']) {
    const codex = join(home, `.codex/skills/${skill}`)
    const claude = join(home, `.claude/skills/${skill}`)
    const pi = join(home, `.pi/agent/skills/${skill}`)
    const canonical = join(home, `.ai-rules/skills/${skill}`)
    const same = pathsResolveToCanonical([codex, claude, pi], canonical)
    add('L1-SINGLE-SOURCE', same, 'error', `${skill} ${same ? 'resolves to one shared source' : 'does not resolve to the shared source'}`, label(canonical))
  }
  const discoverableSkillBackups = findDiscoverableSkillBackups(g)
  add('SKILL-DISCOVERY-CLEAN', discoverableSkillBackups.length === 0, 'error', discoverableSkillBackups.length ? `backup skills remain discoverable: ${discoverableSkillBackups.map(label).join(', ')}` : 'no backup skills are exposed through Codex, Claude, or Pi skill discovery', '~/.ai-rules/backups')
  // 顶层 L1 入口也必须同源：codex/claude/pi 的规则入口须 realpath 到 canonical AGENT.md，把「读同一套」焊到字节级。
  const canonicalL1 = sources.l1[0]
  for (const adapter of [sources.adapters[0], sources.adapters[1], sources.adapters[5]]) {
    const same = pathsResolveToCanonical([adapter], canonicalL1)
    add('L1-TOPLEVEL-SINGLE-SOURCE', same, 'error', `${label(adapter)} ${same ? 'resolves to the shared L1 source' : `does not resolve to shared L1 (${label(canonicalL1)}); replace with symlink via install-local-agent-rules.mjs`}`, label(adapter))
  }
  const settingsText = existsSync(sources.adapters[3]) ? readFileSync(sources.adapters[3], 'utf8') : ''
  let claudeHookIssues = ['settings file is missing']
  if (settingsText) {
    try {
      claudeHookIssues = validateHookContract(JSON.parse(settingsText), createClaudeHookSpecs(CLAUDE_HOOK_COMMAND, CODEX_GATE_COMMAND))
    } catch (error) {
      claudeHookIssues = [`invalid JSON: ${error.message}`]
    }
  }
  const claudeHook = claudeHookIssues.length === 0
  add('CLAUDE-HOOK', claudeHook, 'error', claudeHook ? 'Claude rule injection, receipt, and immediate code-gate hooks match the required contract' : `Claude rule hook contract is invalid: ${claudeHookIssues.join('; ')}`, label(sources.adapters[3]))
  let codexHookIssues = ['hooks file is missing']
  if (existsSync(sources.adapters[4])) {
    try {
      codexHookIssues = validateHookContract(readJson(sources.adapters[4]), createCodexHookSpecs(CODEX_HOOK_COMMAND, CODEX_GATE_COMMAND))
    } catch (error) {
      codexHookIssues = [`invalid JSON: ${error.message}`]
    }
  }
  add('CODEX-HOOK', codexHookIssues.length === 0, 'error', codexHookIssues.length === 0 ? 'Codex rule injection, receipt, and immediate code-gate hooks match the required contract' : `Codex rule hook contract is invalid: ${codexHookIssues.join('; ')}`, label(sources.adapters[4]))

  const injection = config.ruleInjection || {}
  const expectedDeliveryModes = { codex: 'preflight', claude: 'preflight', pi: 'preflight' }
  const deliveryModesValid = Object.entries(expectedDeliveryModes).every(([client, mode]) => injection.deliveryModes?.[client] === mode)
  const budgetsValid = injection.blockingBudgetBytes === 8192
    && injection.advisoryCatalogBudgetBytes === 4096
    && injection.combinedBudgetBytes === 16384
    && injection.blockingBudgetBytes + injection.advisoryCatalogBudgetBytes <= injection.combinedBudgetBytes
  add(
    'RULE-INJECTION-POLICY',
    deliveryModesValid && budgetsValid,
    'error',
    deliveryModesValid && budgetsValid
      ? 'Codex/Claude/Pi use before-agent preflight and 8KB/4KB/16KB budgets are enforced'
      : 'ruleInjection must configure codex+claude+pi=preflight and blocking/advisory/combined budgets of 8192/4096/16384 bytes',
    'docs-tdd.config.json',
  )

  // Pi 直连 agent：全局 AGENTS.md 软链充当 L1+adapter，扩展在 before_agent_start 预送规则，tool_call/tool_result 只做写入收据与门禁。
  const piAdapter = sources.adapters[5]
  const piExtension = sources.adapters[6]
  add('ADAPTER-EXISTS', existsSync(piAdapter), 'error', `${label(piAdapter)} ${existsSync(piAdapter) ? 'exists' : 'is missing'}`, label(piAdapter))
  add('ADAPTER-PROTOCOL', containsProtocol(piAdapter), 'error', `${label(piAdapter)} ${containsProtocol(piAdapter) ? 'declares' : 'does not declare'} router/context/changed/gate`, label(piAdapter))
  const piExtensionText = existsSync(piExtension) ? readFileSync(piExtension, 'utf8') : ''
  const piHookMissing = PI_EXTENSION_MARKERS.filter((marker) => !piExtensionText.includes(marker))
  const piHook = existsSync(piExtension) && piHookMissing.length === 0
  add('PI-HOOK', piHook, 'error', piHook ? 'Pi extension wires before_agent_start preflight, tool receipts, and the code gate to shared scripts' : existsSync(piExtension) ? `Pi extension is missing bridge markers: ${piHookMissing.join(', ')}` : `Pi extension is missing: ${label(piExtension)}; run install-local-agent-rules.mjs`, label(piExtension))

  const adapterProtocol = sources.adapters.slice(0, 3).map(containsProtocol)
  const l1Shared = sources.adapters.slice(0, 2).map((adapter) => pathsResolveToCanonical([adapter], canonicalL1))
  const runtimeAdaptersReady = sources.runtimeAdapters.every(existsSync)
  const conformance = validateRuntimeClientConformance({
    codex: { l1: l1Shared[0], adapterProtocol: adapterProtocol[0], preToolRuleInjection: codexHookIssues.length === 0, postToolReceipt: codexHookIssues.length === 0, postToolCodeGate: codexHookIssues.length === 0 },
    claude: { l1: l1Shared[1], adapterProtocol: adapterProtocol[1], preToolRuleInjection: claudeHook, postToolReceipt: claudeHook, postToolCodeGate: claudeHook },
    cursor: { l1: cursorExact, adapterProtocol: adapterProtocol[2], nativeL2Rules: collectL2Files().length > 0, changedGateFallback: expectedCursorAdapter.includes('docs-tdd.mjs changed') },
    pi: { l1: pathsResolveToCanonical([piAdapter], canonicalL1), adapterProtocol: containsProtocol(piAdapter), preToolRuleInjection: piHook, postToolReceipt: piHook, postToolCodeGate: piHook },
    'lark-codex': { runtimeAdapter: runtimeAdaptersReady, focusedContext: runtimeAdaptersReady, workerQualityGate: runtimeAdaptersReady },
    'lark-claude': { runtimeAdapter: runtimeAdaptersReady, focusedContext: runtimeAdaptersReady, workerQualityGate: runtimeAdaptersReady },
  })
  add(
    'CLIENT-RUNTIME-CONFORMANCE',
    conformance.ok,
    'error',
    conformance.ok ? `all ${REQUIRED_AGENT_CLIENT_IDS.length} clients have installed loader/executor contracts; run docs-tdd probe for delivery evidence` : `client enforcement gaps: ${Object.entries(conformance.missing).map(([client, missing]) => `${client}=[${missing.join(',')}]`).join(' ')}`,
    label(manifestFile),
  )

  // Cursor 没有可信的 PostToolUse hook，非交互写入也可能绕过 Agent hook；CI / pre-commit 是最终兜底。
  const wiring = config.enforcementWiring || {}
  const ciMarkers = [...new Set([wiring.ciMarker || 'verify-code-rules.mjs', 'vnext-delivery-guard.mjs'])]
  const ciCandidates = Array.isArray(wiring.ciConfigCandidates) ? wiring.ciConfigCandidates : ['.gitlab-ci.yml', '.github/workflows']
  const ciFiles = []
  for (const candidate of ciCandidates) {
    const abs = join(ruleConsumerRoot, candidate)
    if (!existsSync(abs)) continue
    if (lstatSync(abs).isDirectory()) {
      for (const entry of readdirSync(abs)) ciFiles.push(join(abs, entry))
    } else {
      ciFiles.push(abs)
    }
  }
  const ciContents = ciFiles.flatMap((file) => {
    try {
      return lstatSync(file).isFile() ? [readFileSync(file, 'utf8')] : []
    } catch {
      return []
    }
  }).join('\n')
  const missingCiMarkers = ciMarkers.filter((marker) => !ciContents.includes(marker))
  const ciWired = ciFiles.length > 0 && missingCiMarkers.length === 0
  add(
    'CI-GATE',
    ciWired,
    'warn',
    ciFiles.length === 0 ? `no CI config found (${ciCandidates.join(', ')}); code-rules + v2 delivery CI guards cannot be confirmed` : ciWired ? 'code-rules + v2 delivery CI guards are wired' : `CI config is missing guard marker(s): ${missingCiMarkers.join(', ')}; Cursor and non-hook commits can bypass a machine gate`,
    ciCandidates[0],
  )

  const precommitConfigName = wiring.precommitConfig || 'package.json'
  const precommitMarker = wiring.precommitMarker || 'precommit-verify-code-rules.mjs'
  const deliveryMarker = wiring.deliveryGuardMarker || 'vnext-delivery-guard.mjs'
  const precommitConfigPath = join(ruleConsumerRoot, precommitConfigName)
  const precommitConfigExists = existsSync(precommitConfigPath)
  const teamConfigContent = precommitConfigExists ? readFileSync(precommitConfigPath, 'utf8') : ''
  const trackedPrecommitPath = join(ruleConsumerRoot, '.husky', 'pre-commit')
  const trackedHookContent = existsSync(trackedPrecommitPath) ? readFileSync(trackedPrecommitPath, 'utf8') : ''
  const teamPrecommitWired = hasUnconditionalTeamPrecommit({ teamConfigContent, trackedHookContent, teamMarker: precommitMarker, deliveryMarker })
  const hooksPathResult = spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: ruleConsumerRoot, encoding: 'utf8', stdio: 'pipe' })
  const hooksPath = hooksPathResult.status === 0 ? hooksPathResult.stdout.trim() : ''
  const localPrecommitPath = hooksPath ? join(hooksPath.startsWith('/') ? hooksPath : join(ruleConsumerRoot, hooksPath), 'pre-commit') : ''
  const localPrecommitWired = Boolean(localPrecommitPath && existsSync(localPrecommitPath) && readFileSync(localPrecommitPath, 'utf8').includes(precommitMarker))
  const precommitWired = teamPrecommitWired || localPrecommitWired
  add(
    'PRECOMMIT-GATE',
    precommitWired,
    'warn',
    !precommitConfigExists
      ? `no ${precommitConfigName} found; code-rules + v2 delivery pre-commit guards cannot be confirmed`
      : precommitWired
        ? `code-rules + v2 delivery pre-commit guards are wired (${teamPrecommitWired ? 'unconditional team hook' : 'personal core.hooksPath'})`
        : `${precommitConfigName} has the code gate, but the hook does not invoke "${precommitMarker}" or "${deliveryMarker}" unconditionally; deletion/non-JS commits can bypass the v2 delivery guard`,
    localPrecommitWired ? localPrecommitPath : precommitConfigName,
  )

  const release = checkRelease()
  add('L3-RELEASE', release.l3Release.fresh, 'error', `L3 rule release is ${release.l3Release.status}`, 'common/rule-release.json')
  add('EFFECTIVE-RELEASE', release.fresh, 'error', `effective rules release is ${release.status}`, label(manifestFile))
  const ignored = spawnSync('git', ['check-ignore', '-q', config.docsMountPath], { cwd: ruleConsumerRoot })
  add('LOCAL-ISOLATION', ignored.status === 0, 'error', `docs_tdd ${ignored.status === 0 ? 'is locally ignored' : 'is not ignored'}`, config.docsMountPath)
  const protectedPaths = config.protectedRuleSurfaces
  const trackedChanges = spawnSync('git', ['status', '--short', '--', ...protectedPaths], { cwd: ruleConsumerRoot, encoding: 'utf8' }).stdout.trim()
  const trackedChangesAllowed = Boolean(trackedChanges && allowTrackedRuleChanges)
  add(
    'TRACKED-RULE-ISOLATION',
    !trackedChanges || trackedChangesAllowed,
    'error',
    trackedChanges ? (trackedChangesAllowed ? `explicitly approved tracked rule changes are visible: ${trackedChanges.replace(/\n/g, '; ')}` : `tracked rule surfaces have local changes: ${trackedChanges.replace(/\n/g, '; ')}`) : 'tracked rule surfaces are unchanged',
    ruleConsumerRoot,
  )
  const hiddenRuleEntries = findHiddenRuleEntries({ ruleConsumerRoot, config, g })
  add('RULE-SURFACE-VISIBLE', hiddenRuleEntries.length === 0, 'error', hiddenRuleEntries.length ? `tracked rule entries hidden with skip-worktree: ${hiddenRuleEntries.map(({ worktree, file }) => `${worktree}:${file}`).join(', ')}` : 'tracked rule entries are visible in every consumer worktree index', ruleConsumerRoot)

  const conflicts = resolveL2Conflicts(findL2Conflicts({ ruleConsumerRoot, collectL2Files, label }), conflictOverrides, existsSync(sources.l1[0]) ? readFileSync(sources.l1[0], 'utf8') : '')
  add(
    'L2-CONFLICT',
    conflicts.unresolved.length === 0,
    'error',
    conflicts.unresolved.length
      ? `unresolved tracked rules conflict: SWR versus React Query in ${conflicts.unresolved.join(', ')}`
      : conflicts.resolved.length
        ? `tracked conflict resolved by explicit local override: ${conflicts.resolved.map(({ file, override }) => `${file} -> ${override.winner}`).join(', ')}`
        : 'no known SWR/React Query conflict',
    conflicts.unresolved[0] || conflicts.resolved[0]?.file || '.cursor/rules',
  )

  const repoEntryDupes = findRepoEntryDuplicates({ ruleConsumerRoot, config })
  add(
    'L2-REPO-ENTRY-DUP',
    repoEntryDupes.length === 0,
    'warn',
    repoEntryDupes.length ? `repo-level entry duplicates canonical prose: ${repoEntryDupes.map((v) => `${v.file} repeats "${v.substring}" (canonical: ${v.canonicalFile} § ${v.canonicalAnchor})`).join('; ')}` : 'no known repo-level entry duplicates (see repoEntryDuplicates config)',
    repoEntryDupes[0]?.file || 'AGENTS.md',
  )

  const failed = checks.filter((check) => !check.ok)
  const strictIgnoredWarnIds = new Set(['CI-GATE']) // CI 需要团队 tracked 改动，不属于个人本地 strict 范围。
  const strictFailures = strict ? failed.filter((check) => check.severity === 'warn' && !strictIgnoredWarnIds.has(check.id)) : []
  const result = {
    ok: !failed.some((check) => check.severity === 'error') && strictFailures.length === 0,
    summary: { total: checks.length, error: failed.filter((check) => check.severity === 'error').length, warn: failed.filter((check) => check.severity === 'warn').length },
    effectiveRulesFingerprint: release.currentFingerprint,
    checks,
  }
  if (json) console.log(JSON.stringify(result, null, 2))
  else {
    for (const check of checks) console.log(`${check.ok ? 'PASS' : check.severity.toUpperCase()} ${check.id}: ${check.message}`)
    console.log(`doctor${strict ? ' --strict' : ''}: ${result.ok ? 'PASS' : 'BLOCK'} (error=${result.summary.error}, warn=${result.summary.warn}${strict ? `, strict-blocking-warn=${strictFailures.length}` : ''})`)
  }
  return result
}

// `node lib/effective-doctor.mjs --self-test`
if (process.argv[1]?.endsWith('effective-doctor.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  const { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const fixture = mkdtempSync(join(tmpdir(), 'effective-doctor-'))
  try {
    // pathsResolveToCanonical：软链→canonical 通过；分叉真实文件不通过；断链不通过。
    const canonical = join(fixture, 'canonical.md')
    const linked = join(fixture, 'linked.md')
    const divergent = join(fixture, 'divergent.md')
    writeFileSync(canonical, 'x\n')
    symlinkSync(canonical, linked)
    writeFileSync(divergent, 'x\n')
    assert.equal(pathsResolveToCanonical([linked], canonical), true)
    assert.equal(pathsResolveToCanonical([divergent], canonical), false)
    assert.equal(pathsResolveToCanonical([join(fixture, 'nope.md')], canonical), false)

    // containsProtocol：四标记齐全才 true。
    const good = join(fixture, 'good.md')
    writeFileSync(good, 'see rule-router.md ; docs-tdd.mjs context ; docs-tdd.mjs changed ; docs-tdd.mjs gate\n')
    assert.equal(containsProtocol(good), true)
    const bad = join(fixture, 'bad.md')
    writeFileSync(bad, 'only rule-router.md here\n')
    assert.equal(containsProtocol(bad), false)
    assert.equal(containsProtocol(join(fixture, 'missing.md')), false)

    // findHiddenRuleEntries：非 git 目录 → git 命令失败 → 该 worktree 记 (scan failed)，不抛。
    mkdirSync(join(fixture, 'plain'), { recursive: true })
    const hidden = findHiddenRuleEntries({ ruleConsumerRoot: join(fixture, 'plain'), config: { ruleSurfaces: { agents: ['AGENTS.md'], claude: ['CLAUDE.md'], cursorRulesDir: '.cursor/rules' } }, g: { aiRules: fixture, codex: fixture, claude: fixture } })
    assert.ok(Array.isArray(hidden))
    console.log('effective-doctor self-test passed.')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}
