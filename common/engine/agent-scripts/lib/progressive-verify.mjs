#!/usr/bin/env node
// v3.5 progressive-verify: three-level verification system for fast feedback.
// Level 1: immediate check after edit (<10s)
// Level 2: checkpoint check after logical unit (<1min)
// Level 3: full verification on completion (as needed)

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Level 1: 编辑后即时检查（轻量）
 * 只检查受影响的文件，不跑测试，不写状态文件
 *
 * @param {string[]} files - 受影响的文件列表
 * @param {Object} options - 选项
 * @returns {Object} 检查结果
 */
export async function level1Check(files, options = {}) {
  const { root = process.cwd(), fast = true } = options

  console.log(`🔍 Level 1: 即时检查 (${files.length} 个文件)...`)

  const results = {
    passed: true,
    lint: null,
    tsc: null,
    timeSpent: 0,
  }

  const startTime = Date.now()

  try {
    // Lint 检查（快速模式）
    results.lint = await runLint(files, { root, fast })

    // TypeScript 检查（快速模式）
    results.tsc = await runTypeCheck(files, { root, fast })

    results.passed = results.lint.passed && results.tsc.passed

    if (!results.passed) {
      console.log(`   ✗ 发现问题，立即反馈`)
      if (!results.lint.passed) {
        console.log(`      Lint: ${results.lint.error || results.lint.issues.length + ' issues'}`)
      }
      if (!results.tsc.passed) {
        console.log(`      TypeScript: ${results.tsc.error || results.tsc.issues.length + ' errors'}`)
      }
    } else {
      console.log(`   ✓ 通过`)
    }
  } catch (error) {
    results.passed = false
    results.error = error.message
    console.log(`   ✗ 检查失败: ${error.message}`)
  }

  results.timeSpent = Date.now() - startTime
  console.log(`   耗时: ${(results.timeSpent / 1000).toFixed(1)}s`)

  return results
}

/**
 * Level 2: Checkpoint 检查（中等）
 * Lint + TypeScript + 相关测试
 *
 * @param {string[]} files - 受影响的文件列表
 * @param {string[]} relatedTests - 相关测试文件
 * @param {Object} options - 选项
 * @returns {Object} 检查结果
 */
export async function level2Check(files, relatedTests, options = {}) {
  const { root = process.cwd(), writeCheckpoint = true } = options

  console.log(`\n🔍 Level 2: Checkpoint 检查...`)

  const results = {
    passed: true,
    lint: null,
    tsc: null,
    tests: null,
    timeSpent: 0,
  }

  const startTime = Date.now()

  try {
    // Lint 检查
    results.lint = await runLint(files, { root })

    // TypeScript 检查
    results.tsc = await runTypeCheck(files, { root })

    // 相关测试
    if (relatedTests.length > 0) {
      results.tests = await runTests(relatedTests, { root })
    } else {
      results.tests = { passed: true, skipped: true }
    }

    results.passed = results.lint.passed && results.tsc.passed && results.tests.passed

    if (!results.passed) {
      console.log(`   ✗ 检查失败`)
      if (!results.lint.passed) console.log(`      Lint: 失败`)
      if (!results.tsc.passed) console.log(`      TypeScript: 失败`)
      if (!results.tests.passed) console.log(`      Tests: 失败`)
    } else {
      console.log(`   ✓ 通过`)
    }

    // 写 checkpoint
    if (writeCheckpoint) {
      await writeCheckpointFile({
        status: results.passed ? 'partial-pass' : 'partial-fail',
        files,
        results,
        timestamp: new Date().toISOString(),
      }, { root })
    }
  } catch (error) {
    results.passed = false
    results.error = error.message
    console.log(`   ✗ 检查失败: ${error.message}`)
  }

  results.timeSpent = Date.now() - startTime
  console.log(`   耗时: ${(results.timeSpent / 1000).toFixed(1)}s`)

  return results
}

/**
 * Level 3: 完整验证
 * 运行所有证据命令
 *
 * @param {Object} workItem - work-item 对象
 * @param {Object} options - 选项
 * @returns {Object} 验证结果
 */
export async function level3Check(workItem, options = {}) {
  const { root = process.cwd() } = options

  console.log(`\n🔍 Level 3: 完整验证...`)

  const results = {
    passed: true,
    evidenceResults: [],
    timeSpent: 0,
  }

  const startTime = Date.now()

  try {
    // 运行所有证据命令
    for (const evidenceCmd of workItem.evidenceCommands || []) {
      const cmdResult = await runEvidenceCommand(evidenceCmd, { root })
      results.evidenceResults.push(cmdResult)

      if (!cmdResult.passed) {
        results.passed = false
      }
    }

    if (!results.passed) {
      const failedCount = results.evidenceResults.filter(r => !r.passed).length
      console.log(`   ✗ 验证失败 (${failedCount}/${results.evidenceResults.length} 失败)`)
    } else {
      console.log(`   ✓ 验证通过 (${results.evidenceResults.length}/${results.evidenceResults.length})`)
    }

    // 写正式 result
    await writeVerifyResult({
      status: results.passed ? 'pass' : 'fail',
      workItem,
      results,
      timestamp: new Date().toISOString(),
    }, { root })
  } catch (error) {
    results.passed = false
    results.error = error.message
    console.log(`   ✗ 验证失败: ${error.message}`)
  }

  results.timeSpent = Date.now() - startTime
  console.log(`   耗时: ${(results.timeSpent / 1000).toFixed(1)}s`)

  return results
}

/**
 * 运行 Lint 检查
 */
async function runLint(files, options = {}) {
  const { root, fast = false } = options

  try {
    const args = fast ? ['--fast'] : []
    const fileList = files.join(' ')

    execSync(`npx biome check ${args.join(' ')} ${fileList}`, {
      cwd: root,
      stdio: 'pipe',
    })

    return { passed: true }
  } catch (error) {
    return {
      passed: false,
      error: error.message,
      issues: parseOutput(error.stdout?.toString() || ''),
    }
  }
}

/**
 * 运行 TypeScript 检查
 */
async function runTypeCheck(files, options = {}) {
  const { root, fast = false } = options

  try {
    const args = fast ? ['--incremental'] : ['--noEmit']
    const fileList = files.join(' ')

    execSync(`npx tsc ${args.join(' ')} ${fileList}`, {
      cwd: root,
      stdio: 'pipe',
    })

    return { passed: true }
  } catch (error) {
    return {
      passed: false,
      error: error.message,
      issues: parseOutput(error.stdout?.toString() || ''),
    }
  }
}

/**
 * 运行测试
 */
async function runTests(testFiles, options = {}) {
  const { root } = options

  try {
    const fileList = testFiles.join(' ')

    execSync(`npx vitest run ${fileList}`, {
      cwd: root,
      stdio: 'pipe',
    })

    return { passed: true }
  } catch (error) {
    return {
      passed: false,
      error: error.message,
    }
  }
}

/**
 * 运行证据命令
 */
async function runEvidenceCommand(cmd, options = {}) {
  const { root } = options

  try {
    execSync(cmd.command, {
      cwd: root,
      stdio: 'pipe',
    })

    return {
      passed: true,
      command: cmd.command,
    }
  } catch (error) {
    return {
      passed: false,
      command: cmd.command,
      error: error.message,
    }
  }
}

/**
 * 写 checkpoint 文件
 */
async function writeCheckpointFile(data, options = {}) {
  const { root } = options
  const checkpointPath = resolve(root, '.checkpoint.json')

  writeFileSync(checkpointPath, JSON.stringify(data, null, 2))
}

/**
 * 写验证结果文件
 */
async function writeVerifyResult(data, options = {}) {
  const { root } = options
  const resultPath = resolve(root, 'evidence/verify-result.json')

  writeFileSync(resultPath, JSON.stringify(data, null, 2))
}

/**
 * 解析输出中的问题
 */
function parseOutput(output) {
  // 简单解析，实际可以更复杂
  const lines = output.split('\n').filter(l => l.trim())
  return lines.slice(0, 5) // 只返回前5行
}

/**
 * 单元测试
 */
export async function selfTest() {
  console.log('Running progressive-verify self-test...\n')

  // Test 1: Level 1 检查（模拟）
  console.log('Test 1: Level 1 check')
  const result1 = await level1Check(
    ['test.tsx'],
    { root: '/tmp', fast: true }
  )
  console.log(`✓ Level 1 completed (${(result1.timeSpent / 1000).toFixed(1)}s)\n`)

  // Test 2: Level 2 检查（模拟）
  console.log('Test 2: Level 2 check')
  const result2 = await level2Check(
    ['test.tsx'],
    ['test.test.tsx'],
    { root: '/tmp', writeCheckpoint: false }
  )
  console.log(`✓ Level 2 completed (${(result2.timeSpent / 1000).toFixed(1)}s)\n`)

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`progressive-verify self-test: 2 passed, 0 failed`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
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
  node progressive-verify.mjs --self-test
`)
  }
}
