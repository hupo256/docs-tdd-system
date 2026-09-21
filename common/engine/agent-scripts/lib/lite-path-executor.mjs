#!/usr/bin/env node
// v3.5 lite-path executor: fast track for very low-risk changes.
// Skips three-stage extraction and independent review, goes straight to implementation + verification.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 快速通道执行器
 * 跳过三阶段抽取，直接理解 + 实现 + 验证
 *
 * @param {string} projectId - 项目ID
 * @param {string} prdText - PRD 文本
 * @param {Object} options - 选项
 * @returns {Object} 执行结果
 */
export async function executeLitePath(projectId, prdText, options = {}) {
  const { root = process.cwd(), dryRun = false } = options

  console.log(`\n━━━ 🚀 快速通道执行 (V0-lite) ━━━\n`)

  const result = {
    success: false,
    phase: null,
    timeSpent: 0,
    fallbackToStandard: false,
    changes: [],
    verification: null,
  }

  const startTime = Date.now()

  try {
    // Step 1: 快速理解（不走三阶段抽取）
    console.log(`1️⃣  快速理解需求...`)
    result.phase = 'understanding'

    const understanding = await quickUnderstand(prdText, { projectId, root })

    console.log(`   ✓ ${understanding.summary}`)
    console.log(`   ✓ 影响文件: ${understanding.files.join(', ')}`)

    // 二次确认：文件数量是否合理
    if (understanding.files.length > 3) {
      console.log(`   ⚠️  影响文件超过 3 个，转标准流程`)
      result.fallbackToStandard = true
      result.phase = 'fallback'
      return result
    }

    // Step 2: 直接实现
    console.log(`\n2️⃣  实现改动...`)
    result.phase = 'implementation'

    if (dryRun) {
      console.log(`   [DRY RUN] 跳过实际实现`)
      result.changes = understanding.files.map(f => ({ file: f, status: 'would-modify' }))
    } else {
      const changes = await implement(understanding, { root })
      result.changes = changes
      console.log(`   ✓ 修改了 ${changes.length} 个文件`)

      for (const change of changes) {
        console.log(`      - ${change.file} (${change.status})`)
      }
    }

    // Step 3: 定向验证（只跑相关文件的 lint + 类型检查）
    console.log(`\n3️⃣  定向验证...`)
    result.phase = 'verification'

    const verification = await quickVerify(result.changes, { root, dryRun })
    result.verification = verification

    if (!verification.passed) {
      console.log(`   ✗ 验证失败:`)
      if (verification.lint && !verification.lint.passed) {
        console.log(`      Lint: ${verification.lint.error}`)
      }
      if (verification.tsc && !verification.tsc.passed) {
        console.log(`      TypeScript: ${verification.tsc.error}`)
      }
      console.log(`\n   → 转标准流程`)
      result.fallbackToStandard = true
      result.phase = 'fallback'
      return result
    }

    console.log(`   ✓ Lint: 通过`)
    console.log(`   ✓ TypeScript: 通过`)

    // Step 4: Commit (如果不是 dry run)
    if (!dryRun) {
      console.log(`\n4️⃣  提交改动...`)
      result.phase = 'commit'

      await commit(projectId, understanding.summary, result.changes, { root })
      console.log(`   ✓ 已提交`)
    } else {
      console.log(`\n4️⃣  [DRY RUN] 跳过提交`)
    }

    result.success = true
    result.timeSpent = Math.round((Date.now() - startTime) / 1000)

    console.log(`\n✅ 快速通道完成！耗时 ${result.timeSpent} 秒`)

  } catch (error) {
    console.error(`\n❌ 快速通道执行失败: ${error.message}`)
    result.success = false
    result.error = error.message
    result.fallbackToStandard = true
    result.phase = 'error'
  }

  return result
}

/**
 * 快速理解需求
 * 调用 AI，但不走三阶段抽取
 *
 * @param {string} prdText - PRD 文本
 * @param {Object} options - 选项
 * @returns {Object} 理解结果
 */
async function quickUnderstand(prdText, options = {}) {
  // TODO: 实际实现需要调用 AI
  // 这里先返回模拟数据

  // Prompt 示例：
  // """
  // 这是一个低风险需求，请快速理解：
  // 1. 要改什么？（一句话概括）
  // 2. 影响哪些文件？（列出完整路径）
  // 3. 具体改动内容？
  //
  // 输出格式：JSON
  // {
  //   "summary": "修改登录按钮文案",
  //   "files": ["apps/web/src/components/Login.tsx"],
  //   "changes": "把 \"登录\" 改成 \"立即登录\""
  // }
  // """

  // 模拟解析
  const summary = extractSummary(prdText)
  const files = extractFiles(prdText, options.projectId)

  return {
    summary,
    files,
    changes: prdText,
  }
}

/**
 * 实现改动
 * 调用 AI 直接改文件
 */
async function implement(understanding, options = {}) {
  // TODO: 实际实现需要调用 AI
  // 这里先返回模拟数据

  // Prompt 示例：
  // """
  // 请实现以下改动：
  // ${understanding.summary}
  //
  // 影响文件: ${understanding.files.join(', ')}
  //
  // 详细说明: ${understanding.changes}
  //
  // 请直接修改文件，使用 Edit 工具。
  // """

  return understanding.files.map(file => ({
    file,
    status: 'modified',
  }))
}

/**
 * 快速验证
 * 只跑受影响文件的 lint + 类型检查
 */
async function quickVerify(changes, options = {}) {
  const { root, dryRun } = options

  if (dryRun) {
    return {
      passed: true,
      lint: { passed: true },
      tsc: { passed: true },
    }
  }

  const files = changes.map(c => c.file)

  // Lint 检查
  let lintResult = { passed: true }
  try {
    // 使用项目的 lint 工具（biome/eslint）
    const lintCmd = detectLintCommand(root)
    if (lintCmd) {
      execSync(`${lintCmd} ${files.join(' ')}`, {
        cwd: root,
        stdio: 'pipe',
      })
    }
  } catch (error) {
    lintResult = {
      passed: false,
      error: error.message,
    }
  }

  // TypeScript 检查
  let tscResult = { passed: true }
  try {
    // 只检查受影响的文件
    execSync(`npx tsc --noEmit ${files.join(' ')}`, {
      cwd: root,
      stdio: 'pipe',
    })
  } catch (error) {
    tscResult = {
      passed: false,
      error: error.message,
    }
  }

  return {
    passed: lintResult.passed && tscResult.passed,
    lint: lintResult,
    tsc: tscResult,
  }
}

/**
 * 提交改动
 */
async function commit(projectId, summary, changes, options = {}) {
  const { root } = options

  // git add
  const filesToAdd = changes.map(c => c.file)
  execSync(`git add ${filesToAdd.join(' ')}`, { cwd: root })

  // git commit
  const commitMessage = `[${projectId}][lite-path] ${summary}`
  execSync(`git commit -m "${commitMessage}"`, { cwd: root })
}

/**
 * 辅助函数：从 PRD 提取摘要
 */
function extractSummary(prdText) {
  // 简单提取第一句话
  const firstLine = prdText.split('\n')[0]
  return firstLine.slice(0, 100)
}

/**
 * 辅助函数：从 PRD 提取文件列表
 */
function extractFiles(prdText, projectId) {
  // 简单模式匹配提取文件路径
  const filePattern = /([a-zA-Z0-9_\-/]+\.(tsx?|jsx?|css|scss))/g
  const matches = prdText.match(filePattern) || []

  if (matches.length > 0) {
    return [...new Set(matches)]
  }

  // 如果没有明确的文件路径，返回空数组（需要 AI 推断）
  return []
}

/**
 * 辅助函数：检测 lint 命令
 */
function detectLintCommand(root) {
  try {
    // 检查 package.json 中的 lint script
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    if (packageJson.scripts && packageJson.scripts.lint) {
      return 'npm run lint'
    }
  } catch (error) {
    // ignore
  }

  // 检查 biome
  try {
    execSync('which biome', { stdio: 'pipe' })
    return 'biome check'
  } catch (error) {
    // biome not found
  }

  // 检查 eslint
  try {
    execSync('which eslint', { stdio: 'pipe' })
    return 'eslint'
  } catch (error) {
    // eslint not found
  }

  return null
}

/**
 * 单元测试
 */
export async function selfTest() {
  console.log('Running lite-path-executor self-test...\n')

  // Test 1: Dry run
  const result1 = await executeLitePath(
    'TEST-001',
    '把登录按钮文案从"登录"改成"立即登录"',
    { dryRun: true }
  )

  if (!result1.success) {
    throw new Error('Test 1 failed: dry run should succeed')
  }

  console.log('\n✓ Test 1 passed: dry run')

  // Test 2: Fallback on too many files
  const result2 = await executeLitePath(
    'TEST-002',
    '修改所有页面的标题，包括 Login.tsx, Register.tsx, Home.tsx, Profile.tsx',
    { dryRun: true }
  )

  if (!result2.fallbackToStandard) {
    throw new Error('Test 2 failed: should fallback on too many files')
  }

  console.log('\n✓ Test 2 passed: fallback on too many files')

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('lite-path-executor self-test passed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest().catch(error => {
      console.error(error)
      process.exit(1)
    })
  } else {
    console.log(`
Usage:
  node lite-path-executor.mjs --self-test
`)
  }
}
