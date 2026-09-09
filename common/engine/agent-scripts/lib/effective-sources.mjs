#!/usr/bin/env node
// 源镜头：把「effective rules 的输入文件集 + 路径标签」按注入的根解析一次，供 snapshot/doctor 共用。
//
// 从 effective-rules.mjs 抽出的纯装配逻辑（依赖注入根，便于 --self-test 直测）：
//   - sources：L1 craft / 三端 adapters / runtime adapters / skill 入口的绝对路径集
//   - label：把绝对路径映射成稳定的展示标签（docs 根 > consumer 根 > repo 根 > ~）
//   - walkFiles：递归收集文件
//   - collectL2Files：仓库级 L2 规则面（AGENTS/CLAUDE/.cursor/rules 里的 .md/.mdc）

import { existsSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { PI_EXTENSION_RELPATH } from './pi-adapter.mjs'

export function walkFiles(root) {
  if (!existsSync(root)) return []
  const files = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

/**
 * Build the source lens for effective-rules given the resolved roots.
 * Returns `{ sources, label, walkFiles, collectL2Files }` bound to those roots.
 */
export function createSourceLens({ docsSystemRoot, ruleConsumerRoot, repoRoot, home, g, config }) {
  const canonicalSkillRoots = ['coding-quality', 'figma-read'].map((skill) => join(g.aiRules, 'skills', skill))
  const sources = {
    l1: [join(g.aiRules, 'AGENT.md'), ...canonicalSkillRoots.flatMap(walkFiles)],
    adapters: [join(g.codex, 'AGENTS.md'), join(g.claude, 'CLAUDE.md'), g.cursorLocalGovernance, join(g.claude, 'settings.json'), join(g.codex, 'hooks.json'), join(g.pi, 'AGENTS.md'), join(g.pi, PI_EXTENSION_RELPATH)],
    runtimeAdapters: [
      join(docsSystemRoot, 'common/lark-bot/lib/lark-rule-context.mjs'),
      join(docsSystemRoot, 'common/lark-bot/lib/lark-worker-prompts.mjs'),
      join(docsSystemRoot, 'common/lark-bot/lib/lark-worker-run.mjs'),
      join(docsSystemRoot, 'common/engine/agent-scripts/rule-context-hook.mjs'),
      join(docsSystemRoot, 'common/engine/agent-scripts/rule-context.mjs'),
      join(docsSystemRoot, 'common/engine/agent-scripts/lib/l2-rule-resolver.mjs'),
      join(docsSystemRoot, 'common/engine/agent-scripts/lib/rule-consumption.mjs'),
    ],
    skillEntries: [join(g.codex, 'skills/coding-quality'), join(g.claude, 'skills/coding-quality'), join(g.codex, 'skills/figma-read'), join(g.claude, 'skills/figma-read')],
  }

  function label(file) {
    if (file.startsWith(`${docsSystemRoot}/`)) return relative(docsSystemRoot, file).split(sep).join('/')
    if (file.startsWith(`${ruleConsumerRoot}/`)) return relative(ruleConsumerRoot, file).split(sep).join('/')
    if (file.startsWith(`${repoRoot}/`)) return relative(repoRoot, file).split(sep).join('/')
    if (file.startsWith(`${home}/`)) return `~/${relative(home, file).split(sep).join('/')}`
    return relative(repoRoot, file).split(sep).join('/')
  }

  function collectL2Files() {
    const s = config.ruleSurfaces
    return [...s.agents.map((f) => join(ruleConsumerRoot, f)), ...s.claude.map((f) => join(ruleConsumerRoot, f)), ...walkFiles(join(ruleConsumerRoot, s.cursorRulesDir))]
      .filter((file) => existsSync(file) && (file.endsWith('.md') || file.endsWith('.mdc')))
      .sort((a, b) => label(a).localeCompare(label(b)))
  }

  return { sources, label, walkFiles, collectL2Files }
}

// `node lib/effective-sources.mjs --self-test`
if (process.argv[1]?.endsWith('effective-sources.mjs') && process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default
  const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const fixture = mkdtempSync(join(tmpdir(), 'effective-sources-'))
  try {
    // walkFiles 递归：只收文件，跳目录本身。
    mkdirSync(join(fixture, 'a/b'), { recursive: true })
    writeFileSync(join(fixture, 'a/top.md'), 'x\n')
    writeFileSync(join(fixture, 'a/b/deep.mdc'), 'y\n')
    const walked = walkFiles(join(fixture, 'a')).sort()
    assert.deepEqual(walked, [join(fixture, 'a/b/deep.mdc'), join(fixture, 'a/top.md')])
    assert.deepEqual(walkFiles(join(fixture, 'nope')), []) // 不存在 → []

    // label 优先级：docs 根 > consumer 根 > repo 根 > ~。
    const g = { aiRules: join(fixture, 'ai'), codex: join(fixture, 'codex'), claude: join(fixture, 'claude'), pi: join(fixture, 'pi'), cursorLocalGovernance: join(fixture, 'gov.mdc') }
    const config = { ruleSurfaces: { agents: ['AGENTS.md'], claude: ['CLAUDE.md'], cursorRulesDir: '.cursor/rules' } }
    const lens = createSourceLens({ docsSystemRoot: '/docs', ruleConsumerRoot: '/repo/wt', repoRoot: '/repo', home: '/home/u', g, config })
    assert.equal(lens.label('/docs/common/rules/x.md'), 'common/rules/x.md')
    assert.equal(lens.label('/repo/wt/AGENTS.md'), 'AGENTS.md') // consumer 优先于 repo
    assert.equal(lens.label('/repo/apps/y.ts'), 'apps/y.ts')
    assert.equal(lens.label('/home/u/.ai-rules/AGENT.md'), '~/.ai-rules/AGENT.md')
    assert.equal(lens.sources.adapters[2], g.cursorLocalGovernance)
    assert.equal(lens.sources.adapters[5], join(g.pi, 'AGENTS.md'))
    assert.equal(lens.sources.adapters[6], join(g.pi, 'extensions/docs-tdd-rules.ts'))
    assert.ok(lens.sources.runtimeAdapters.length === 7)
    console.log('effective-sources self-test passed.')
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}
