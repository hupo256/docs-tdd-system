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

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { resolveProjectRoot, resolveRoots } from './roots.mjs'
import { inspectEffectiveRules, inspectRuleRelease } from './context-pack.mjs'
import { printReport, printWarnings } from './cli-report.mjs'

const { docsSystemRoot: docsRoot, consumerRoot: repoRoot, consumerWorktree } = resolveRoots()
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

// `docs-tdd capability`：把「机器能不能干活」的一屏体检收敛成 报告行 + 告警行两张表，交 cli-report 打印。
export function capability(id, { agentClient }) {
  const projectDir = id ? resolveProjectRoot(id) : ''
  const manifestFile = projectDir ? join(projectDir, 'agent/project-manifest.json') : ''
  const manifest = manifestFile && existsSync(manifestFile) ? readJson(manifestFile) : null
  const resolvedWorktree = resolveProjectWorktree(id)
  const ruleset = readJson(join(docsRoot, 'common/rules/ruleset.json'))
  const release = inspectRuleRelease()
  const effectiveRules = inspectEffectiveRules()
  const hook = process.env.CLAUDE_PROJECT_DIR ? 'claude-posttooluse' : 'manual-agent-adapter'

  printReport([
    ['docs_tdd root', docsRoot],
    ['agent client', agentClient],
    ['agent adapter', hook],
    ['automatic post-edit hook', hook === 'claude-posttooluse' ? 'available' : 'unavailable'],
    ['fallback', `run docs-tdd changed ${id || '<PROJECT-ID>'} before completion`],
    ['ruleset', `${manifest?.rulesetVersion || ruleset.version} (${ruleset.maturity})`],
    ['rule release', `${release.status || 'invalid'} (${(release.currentFingerprint || 'unknown').slice(0, 12)})`],
    ['effective rules', `${effectiveRules.status || 'invalid'} (${(effectiveRules.currentFingerprint || 'unknown').slice(0, 12)})`],
    ['project worktree', resolvedWorktree.worktree],
  ])
  printWarnings([
    !resolvedWorktree.exists && `warning: configured worktree does not exist: ${resolvedWorktree.requestedWorktree}; falling back to ${repoRoot}`,
    resolvedWorktree.exists && !resolvedWorktree.configured && id && `warning: project worktree is not configured; falling back to ${repoRoot}`,
    !release.fresh && 'warning: context/changed/gate are blocked until the current rules are published',
    !effectiveRules.fresh && 'warning: context/changed/gate are blocked until effective rules are published',
  ])
}
