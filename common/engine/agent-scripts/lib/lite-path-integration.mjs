#!/usr/bin/env node
// Lite-path integration wrapper for docs-tdd extract command.
// Evaluates whether the requirement is eligible for fast track before invoking vnext-extract.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { evaluateLitePath, generateLitePathSummary } from './lite-path-router.mjs'
import { executeLitePath } from './lite-path-executor.mjs'

/**
 * 集成快速通道评估到 extract 流程
 *
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 选项
 * @returns {Object} 评估结果和建议
 */
export async function evaluateAndRoute(projectRoot, options = {}) {
  const { enableLitePath = true, autoConfirm = false } = options

  // 如果快速通道被禁用，直接返回标准流程
  if (!enableLitePath) {
    return {
      useLitePath: false,
      reason: 'lite-path-disabled',
    }
  }

  // 读取 PRD source
  let prdText = ''
  let userIntent = ''

  try {
    // 从 work-item.json 或 source 文件中读取 PRD
    const workItemPath = resolve(projectRoot, 'work-item.json')
    const workItem = JSON.parse(readFileSync(workItemPath, 'utf8'))

    // 提取 PRD 文本
    if (workItem.sourceSnapshot && workItem.sourceSnapshot.sources) {
      for (const source of workItem.sourceSnapshot.sources) {
        const sourcePath = resolve(projectRoot, source.path)
        const content = readFileSync(sourcePath, 'utf8')
        prdText += content + '\n'
      }
    }

    // 简单提取用户意图（从第一段或标题）
    userIntent = extractUserIntent(prdText)

  } catch (error) {
    // 如果无法读取 PRD，返回标准流程
    return {
      useLitePath: false,
      reason: 'cannot-read-prd',
      error: error.message,
    }
  }

  // 评估快速通道
  const evaluation = evaluateLitePath(prdText, userIntent)

  // 如果不符合快速通道条件，返回标准流程
  if (!evaluation.eligible) {
    return {
      useLitePath: false,
      reason: evaluation.reason,
      evaluation,
    }
  }

  // 生成摘要
  const summary = generateLitePathSummary(evaluation, userIntent)

  return {
    useLitePath: true,
    evaluation,
    summary,
    prdText,
    autoConfirm,
  }
}

/**
 * 提取用户意图
 */
function extractUserIntent(prdText) {
  // 提取标题
  const titleMatch = prdText.match(/<title>(.*?)<\/title>/i)
  if (titleMatch) {
    return titleMatch[1].trim()
  }

  // 提取第一段
  const lines = prdText.split('\n').filter(l => l.trim())
  if (lines.length > 0) {
    return lines[0].trim().slice(0, 200)
  }

  return prdText.slice(0, 200)
}

/**
 * 询问用户确认（交互式）
 */
async function askUserConfirm(message, defaultValue = 'Y') {
  // 简化版：在实际集成中需要使用 readline
  return new Promise((resolve) => {
    process.stdout.write(`${message} [${defaultValue}]: `)
    process.stdin.once('data', (data) => {
      const answer = data.toString().trim() || defaultValue
      resolve(answer)
    })
  })
}

/**
 * 主集成函数：在 extract 之前调用
 *
 * @param {string} projectId - 项目ID
 * @param {string} projectRoot - 项目根目录
 * @param {Object} options - 选项
 * @returns {Object} 路由结果
 */
export async function routeExtract(projectId, projectRoot, options = {}) {
  console.log('\n━━━ 📋 需求理解路由 ━━━\n')

  // 评估快速通道
  const routeResult = await evaluateAndRoute(projectRoot, options)

  if (!routeResult.useLitePath) {
    console.log(`📋 使用标准流程`)
    if (routeResult.reason) {
      console.log(`   原因: ${routeResult.reason}`)
    }
    return {
      useStandardPath: true,
      useLitePath: false,
    }
  }

  // 显示快速通道评估结果
  console.log(routeResult.summary)

  // 询问用户确认（除非 autoConfirm）
  let confirmed = routeResult.autoConfirm

  if (!confirmed) {
    const answer = await askUserConfirm('是否使用快速通道？(Y/n)', 'Y')
    confirmed = answer.toLowerCase() === 'y' || answer === ''
  }

  if (!confirmed) {
    console.log('\n用户选择标准流程\n')
    return {
      useStandardPath: true,
      useLitePath: false,
    }
  }

  // 执行快速通道
  console.log('\n')
  const result = await executeLitePath(projectId, routeResult.prdText, {
    root: projectRoot,
  })

  // 如果快速通道失败，降级到标准流程
  if (result.fallbackToStandard) {
    console.log('\n⚠️  快速通道遇到问题，转标准流程\n')
    return {
      useStandardPath: true,
      useLitePath: false,
      litePathFailed: true,
      litePathResult: result,
    }
  }

  // 快速通道成功
  return {
    useStandardPath: false,
    useLitePath: true,
    litePathSuccess: true,
    litePathResult: result,
  }
}

/**
 * CLI 入口（测试用）
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const projectId = process.argv[2] || 'TEST-001'
  const projectRoot = process.argv[3] || process.cwd()

  routeExtract(projectId, projectRoot, { enableLitePath: true })
    .then(result => {
      console.log('\n━━━ 路由结果 ━━━')
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.useStandardPath ? 0 : 0)
    })
    .catch(error => {
      console.error('路由失败:', error)
      process.exit(1)
    })
}
