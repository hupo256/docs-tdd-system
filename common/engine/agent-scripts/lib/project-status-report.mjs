#!/usr/bin/env node
/**
 * 项目状态报告子系统：`docs-tdd capability`（打印 root / client / adapter / ruleset / 发布新鲜度 /
 * worktree 一览）与 worktree 解析（README frontmatter `worktree:` → 绝对路径，回退 cwd/repoRoot）。
 * 从 docs-tdd.mjs 抽出——原本是一坨逐字段 console.log，现改为 [label,value] 行表 + 告警表，
 * 经 lib/cli-report 统一打印。
 *
 * 自成一体：自己 resolveRoots()，发布新鲜度探测复用 lib/context-pack 的 inspect*，不依赖调用方作用域。
 * 报告/IO 型（无导出纯逻辑），登记 check-doc-budget 的 SELF_TEST_EXEMPT；行为由 capability 冒烟 + golden 覆盖。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { resolveProjectRoot, resolveRoots } from './roots.mjs'
import { inspectEffectiveRules, inspectRuleRelease } from './context-pack.mjs'
import { printReport, printWarnings } from './cli-report.mjs'
import { workflowVersionForProject } from './workflow-version.mjs'
import { classifyBaseline } from './gate-doc-parsers.mjs'

const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree, config } = resolveRoots()
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

// 解析项目编码 worktree：优先 README frontmatter `worktree:`（相对项目目录解析成绝对路径），
// 否则回退当前 cwd worktree（非 docsRoot 时）或 repoRoot。返回是否配置/是否存在，供调用方决定告警。
export function resolveProjectWorktree(id) {
  const projectDir = id ? resolveProjectRoot(id) : ''
  const readmeFile = projectDir ? join(projectDir, 'README.md') : ''
  const readme = readmeFile && existsSync(readmeFile) ? readFileSync(readmeFile, 'utf8') : ''
  const configured = readme
    .match(/^worktree:\s*(.*)$/m)?.[1]
    ?.replace(/^['"]|['"]$/g, '')
    .trim()
  const cwdWorktree = consumerWorktree && consumerWorktree !== docsRoot ? consumerWorktree : ''
  const worktree = configured ? resolve(projectDir, configured) : cwdWorktree || repoRoot
  return {
    configured: Boolean(configured),
    exists: existsSync(worktree),
    worktree: existsSync(worktree) ? worktree : repoRoot,
    requestedWorktree: worktree,
  }
}

function gitOutput(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { ok: result.status === 0, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() }
}

/** 与 GIT-G4-002 / classifyBaseline 一致：online 前进后 feature 不必包含最新 online。 */
export function evaluateWorktreeBaseline(worktree, baseRef) {
  const baseExists = gitOutput(worktree, ['rev-parse', '--verify', `${baseRef}^{commit}`]).ok
  if (!baseExists) {
    return { baseExists: false, ok: false, severity: 'error', note: `configured base ref does not exist: ${baseRef}` }
  }
  const hasCommonBase = gitOutput(worktree, ['merge-base', baseRef, 'HEAD']).ok
  const onlineIsAncestorOfHead = gitOutput(worktree, ['merge-base', '--is-ancestor', baseRef, 'HEAD']).ok
  return { baseExists: true, ...classifyBaseline(hasCommonBase, onlineIsAncestorOfHead) }
}

export function validateProjectWorktreeFacts(facts) {
  const problems = []
  if (!facts.configuredPath) problems.push('project README has no worktree binding')
  if (facts.requestedWorktree && facts.configuredPath && facts.worktree !== facts.configuredPath) problems.push('requested worktree differs from the project README binding')
  if (!facts.exists) problems.push('configured worktree does not exist')
  if (facts.exists && !facts.topMatches) problems.push('configured path is not a git worktree root')
  if (facts.exists && !facts.branch) problems.push('worktree has no checked-out branch')
  if (['online', 'pre', 'test', 'dev'].includes(facts.branch)) problems.push(`environment branch is forbidden for coding: ${facts.branch}`)
  if (facts.branch && facts.branch !== facts.expectedBranch) problems.push(`worktree branch ${facts.branch} does not match expected ${facts.expectedBranch}`)
  if (facts.branch && !facts.branch.includes(facts.projectId)) problems.push(`worktree branch is not bound to ${facts.projectId}`)
  if (facts.exists && !facts.baseExists) problems.push(`configured base ref does not exist: ${facts.baseRef}`)
  if (facts.exists && facts.baseExists && facts.baseline && !facts.baseline.ok) problems.push(facts.baseline.note)
  if (facts.requireClean && facts.dirty) problems.push('worktree has unowned changes; checkpoint or clean them before implementation')
  return problems
}

// Write-capable v2 commands must use this fail-closed inspection. The permissive resolver above
// remains available only for read-only status/capability reporting.
export function inspectProjectWorktree(projectId, { requestedWorktree = '', requireClean = false } = {}) {
  const projectDir = resolveProjectRoot(projectId)
  const readmeFile = join(projectDir, 'README.md')
  const readme = existsSync(readmeFile) ? readFileSync(readmeFile, 'utf8') : ''
  const configuredValue = readme.match(/^worktree:\s*(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, '').trim()
  const configuredPath = configuredValue ? resolve(projectDir, configuredValue) : ''
  const expectedBranch = readme.match(/^branch:\s*(.*)$/m)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || `${config.branchPrefix || 'feature/'}${projectId}`
  const baseRef = config.baseRef || 'origin/online'
  const worktree = requestedWorktree ? resolve(requestedWorktree) : configuredPath
  const exists = Boolean(worktree && existsSync(worktree))
  const top = exists ? gitOutput(worktree, ['rev-parse', '--show-toplevel']) : { ok: false, stdout: '' }
  const branchResult = exists ? gitOutput(worktree, ['branch', '--show-current']) : { ok: false, stdout: '' }
  const baseline = exists ? evaluateWorktreeBaseline(worktree, baseRef) : { baseExists: false, ok: false, severity: 'error', note: '' }
  const facts = {
    projectId, configuredPath, requestedWorktree, worktree, exists,
    topMatches: top.ok && realpathSync(resolve(top.stdout)) === realpathSync(worktree),
    branch: branchResult.ok ? branchResult.stdout : '', expectedBranch, baseRef,
    baseExists: baseline.baseExists,
    baseline,
    requireClean,
    dirty: exists && Boolean(gitOutput(worktree, ['status', '--porcelain']).stdout),
  }
  const problems = validateProjectWorktreeFacts(facts)
  return { ok: problems.length === 0, projectId, worktree, branch: facts.branch, expectedBranch, baseRef, problems }
}

export function requireProjectWorktree(projectId, options = {}) {
  const inspection = inspectProjectWorktree(projectId, options)
  if (!inspection.ok) throw new Error(`unsafe project worktree for ${projectId}: ${inspection.problems.join('; ')}`)
  return inspection.worktree
}

// `docs-tdd capability`：把「机器能不能干活」的一屏体检收敛成 报告行 + 告警行两张表，交 cli-report 打印。
export function capability(id, { agentClient }) {
  const projectDir = id ? resolveProjectRoot(id) : ''
  const manifestFile = projectDir ? join(projectDir, 'agent/project-manifest.json') : ''
  const manifest = manifestFile && existsSync(manifestFile) ? readJson(manifestFile) : null
  const workflowVersion = id ? workflowVersionForProject(id, { resolveProjectRoot }) : null
  const resolvedWorktree = resolveProjectWorktree(id)
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  const release = inspectRuleRelease()
  const effectiveRules = inspectEffectiveRules()
  const hook = agentClient === 'pi'
    ? 'pi-before-agent-start-preflight-plus-tool-receipt'
    : agentClient === 'claude'
      ? 'claude-user-prompt-preflight-plus-tool-receipt'
      : agentClient === 'codex'
        ? 'codex-session-start-preflight-plus-tool-receipt'
        : agentClient === 'cursor'
          ? 'cursor-native-plus-changed'
          : 'human-cli'
  const injection = config.ruleInjection || {}
  const deliveryMode = injection.deliveryModes?.[agentClient] || (['claude', 'codex', 'pi'].includes(agentClient) ? 'preflight' : 'n/a')
  const fallback = workflowVersion === 2
    ? `run docs-tdd verify ${id || '<PROJECT-ID>'} --input <verify-input.json>`
    : `run docs-tdd changed ${id || '<PROJECT-ID>'} before completion`

  printReport([
    ['docs_tdd root', docsRoot],
    ['project workflow', workflowVersion ? `v${workflowVersion}${workflowVersion === 2 ? ' (enforced exit)' : ' (legacy G0-G8)'}` : 'n/a'],
    ['agent client', agentClient],
    ['agent adapter', hook],
    ['automatic pre-edit rule delivery', ['claude', 'codex', 'pi'].includes(agentClient) ? `${deliveryMode} (available)` : 'unavailable'],
    ['injection budgets', `${injection.blockingBudgetBytes || 8192} blocking + ${injection.advisoryCatalogBudgetBytes || 4096} advisory <= ${injection.combinedBudgetBytes || 16384} bytes`],
    ['automatic post-edit receipt', ['claude', 'codex', 'pi'].includes(agentClient) ? 'available' : 'unavailable'],
    ['fallback', fallback],
    ['ruleset', `${manifest?.rulesetVersion || ruleset.version} (${ruleset.maturity})`],
    ['rule release', `${release.status || 'invalid'} (${(release.currentFingerprint || 'unknown').slice(0, 12)})`],
    ['effective rules', `${effectiveRules.status || 'invalid'} (${(effectiveRules.currentFingerprint || 'unknown').slice(0, 12)})`],
    ['project worktree', resolvedWorktree.worktree],
  ])
  printWarnings([
    !resolvedWorktree.exists && `warning: configured worktree does not exist: ${resolvedWorktree.requestedWorktree}; falling back to ${repoRoot}`,
    resolvedWorktree.exists && !resolvedWorktree.configured && id && `warning: project worktree is not configured; falling back to ${repoRoot}`,
    !release.fresh && 'note: rule sources are ahead of the published release; this project runs against its pinned policy (run docs-tdd release to publish, docs-tdd rules upgrade <PR> to adopt)',
    !effectiveRules.fresh && 'note: effective rules are ahead of the published snapshot; the current agent may want to reload context (not blocking)',
  ])
}
