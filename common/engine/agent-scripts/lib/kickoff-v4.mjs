#!/usr/bin/env node
// v4.0 kickoff wrapper: 默认 v2 + lite-path 自动判断

import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync } from 'node:fs'
import { evaluateLitePath } from './lite-path-router.mjs'
import { executeLitePathV4 } from './lite-path-executor-v4.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * v4.0 kickoff: 默认 v2，自动判断是否走 lite-path
 * 
 * @param {string} projectId
 * @param {object} options
 * @param {string} options.prd - PRD 文本或路径
 * @param {string} options.intent - 用户意图（如「改文案」）
 * @param {string} options.title - 项目标题
 * @param {boolean} options.forceV1 - 强制 v1（需显式指定）
 * @param {boolean} options.forceLite - 强制 lite-path
 * @param {boolean} options.forceStandard - 强制 standard 流程
 * @param {string} options.docsRoot
 * @param {string} options.repoRoot
 * @returns {object}
 */
export async function kickoffV4(projectId, options = {}) {
  const startTime = Date.now()
  
  // v4.0: 废弃 v1，除非显式 --force-v1
  if (options.forceV1) {
    console.warn('⚠️  v4.0 已废弃 v1 流程，强烈建议使用 v2')
    console.warn('   若确需 v1，请使用: docs-tdd kickoff --force-v1')
    console.warn('   v1 支持将在 v4.1 完全移除')
    process.exit(1)
  }
  
  const prdText = options.prd || ''
  const userIntent = options.intent || options.title || ''
  
  // v4.0: 自动检测 docsRoot（从当前目录或脚本目录向上查找）
  let docsRoot = options.docsRoot
  if (!docsRoot) {
    const cwd = process.cwd()
    if (existsSync(join(cwd, 'prds'))) {
      // 当前就在 docs_tdd 根目录
      docsRoot = cwd
    } else if (existsSync(join(cwd, 'apps/web/docs_tdd'))) {
      // 在 monorepo 根目录
      docsRoot = join(cwd, 'apps/web/docs_tdd')
    } else {
      // 从脚本位置推断
      docsRoot = resolve(SCRIPT_DIR, '../..')
    }
  }
  
  const repoRoot = options.repoRoot || process.cwd()
  
  const projectDir = join(docsRoot, 'prds', projectId)
  
  // 确保项目目录存在
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true })
  }
  
  // 步骤 1: 判断是否适合 lite-path
  let useLitePath = false
  let liteEvaluation = null
  
  if (!options.forceStandard) {
    liteEvaluation = evaluateLitePath(prdText, userIntent)
    useLitePath = options.forceLite || liteEvaluation.eligible
    
    if (liteEvaluation.eligible && !options.forceLite) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`🚀 检测到低风险需求，建议使用 lite-path 快速通道`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`\n${liteEvaluation.recommendation}\n`)
      console.log(`是否使用 lite-path？(y/n)`)
      console.log(`  y = 快速通道 (< 2 分钟，跳过 extraction/review)`)
      console.log(`  n = 标准流程 (完整 extraction/coverage/scope approval)`)
      console.log(`\n如需自动选择，使用: --force-lite 或 --force-standard\n`)
      
      // 等待用户输入（简化版，实际应用可以用 readline）
      // 这里默认走 lite
      useLitePath = true
      console.log(`[自动选择] 使用 lite-path 快速通道\n`)
    }
  }
  
  // 步骤 2: 执行对应流程
  let result
  
  if (useLitePath) {
    console.log(`\n🚀 执行 lite-path 快速通道...`)
    result = await executeLitePathV4(projectId, prdText, userIntent, {
      docsRoot,
      repoRoot,
      dryRun: false,
    })
    
    console.log(`\n✅ lite-path 执行完成 (${result.timeSpent}ms)`)
    console.log(`\n下一步:`)
    result.nextSteps.forEach(step => console.log(`  ${step}`))
    
    return {
      ...result,
      mode: 'lite-path',
      liteEvaluation,
    }
  } else {
    console.log(`\n📋 执行标准 v2 流程...`)
    
    // 调用原有的 project-orchestrator kickoff
    const orchestratorScript = join(SCRIPT_DIR, '..', 'project-orchestrator.mjs')
    const args = [
      orchestratorScript,
      'kickoff',
      projectId,
      '--prd', prdText || 'inline',
      '--title', options.title || projectId,
    ]
    
    if (options.source) args.push('--source', options.source)
    
    const proc = spawnSync('node', args, {
      encoding: 'utf-8',
      stdio: 'inherit',
      cwd: repoRoot,
    })
    
    if (proc.status !== 0) {
      throw new Error(`project-orchestrator kickoff failed with exit ${proc.status}`)
    }
    
    const elapsedMs = Date.now() - startTime
    
    return {
      success: true,
      mode: 'standard-v2',
      projectId,
      timeSpent: elapsedMs,
      liteEvaluation,
      nextSteps: [
        '1. 执行: docs-tdd extract <PROJECT-ID>',
        '2. 确认 extraction checklist',
        '3. 执行: docs-tdd scope-approval <PROJECT-ID>',
        '4. 开始实现',
      ],
    }
  }
}

/**
 * CLI 入口
 */
async function main() {
  const args = process.argv.slice(2)
  const projectId = args[0]
  
  if (!projectId || projectId.startsWith('-')) {
    console.error(`
Usage:
  node kickoff-v4.mjs <PROJECT-ID> [options]

Options:
  --prd <text|path>      PRD 文本或文件路径
  --intent <text>        用户意图（如「改文案」）
  --title <text>         项目标题
  --force-lite           强制 lite-path
  --force-standard       强制 standard 流程
  --force-v1             强制 v1（已废弃，将在 v4.1 移除）

Examples:
  # 自动判断
  node kickoff-v4.mjs PR-02440 --prd "把首页按钮文案改成'立即开始'" --intent "改文案"
  
  # 强制 lite
  node kickoff-v4.mjs PR-02441 --force-lite --prd "..." --intent "样式调整"
  
  # 强制 standard
  node kickoff-v4.mjs PR-02442 --force-standard --prd "..." --intent "新功能"
`)
    process.exit(1)
  }
  
  const options = {
    prd: args[args.indexOf('--prd') + 1] || '',
    intent: args[args.indexOf('--intent') + 1] || '',
    title: args[args.indexOf('--title') + 1] || projectId,
    forceLite: args.includes('--force-lite'),
    forceStandard: args.includes('--force-standard'),
    forceV1: args.includes('--force-v1'),
  }
  
  try {
    const result = await kickoffV4(projectId, options)
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`✅ kickoff 完成`)
    console.log(`   模式: ${result.mode}`)
    console.log(`   耗时: ${result.timeSpent}ms`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  } catch (error) {
    console.error(`\n❌ kickoff 失败:`, error.message)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
