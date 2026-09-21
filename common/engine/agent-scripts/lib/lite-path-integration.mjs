#!/usr/bin/env node
// Read-only lite-path candidate evaluation. Standard extraction remains authoritative.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { docsSystemRoot } from './roots.mjs'
import { evaluateLitePath, generateLitePathSummary } from './lite-path-router.mjs'

/**
 * @param {string} projectRoot
 * @param {{ enableLitePath?: boolean }} options
 * @returns {Promise<object>}
 */
export async function evaluateAndRoute(projectRoot, options = {}) {
  const { enableLitePath = false } = options
  if (!enableLitePath) {
    return {
      useLitePath: false,
      candidateOnly: true,
      deliveryAuthority: false,
      reason: 'lite-path-disabled',
    }
  }

  try {
    const workItem = JSON.parse(readFileSync(resolve(projectRoot, 'work-item.json'), 'utf8'))
    const sources = workItem.sourceSnapshot?.sources
    if (!Array.isArray(sources) || sources.length === 0) {
      return {
        useLitePath: false,
        candidateOnly: true,
        deliveryAuthority: false,
        reason: 'no-source-snapshot',
      }
    }

    const prdText = sources
      .map((source) => readFileSync(resolve(docsSystemRoot, source.path), 'utf8'))
      .join('\n')
    const userIntent = extractUserIntent(prdText)
    const evaluation = evaluateLitePath(prdText, userIntent)

    return {
      useLitePath: false,
      candidateOnly: true,
      deliveryAuthority: false,
      reason: evaluation.eligible ? 'candidate-only-standard-flow-required' : evaluation.reason,
      evaluation,
      summary: generateLitePathSummary(evaluation, userIntent),
      prdText,
      userIntent,
    }
  } catch (error) {
    return {
      useLitePath: false,
      candidateOnly: true,
      deliveryAuthority: false,
      reason: 'cannot-read-prd',
      error: error.message,
    }
  }
}

function extractUserIntent(prdText) {
  const titleMatch = prdText.match(/<title>(.*?)<\/title>/i)
  if (titleMatch) return titleMatch[1].trim()

  const firstLine = prdText.split('\n').find((line) => line.trim())
  return (firstLine || prdText).trim().slice(0, 200)
}

/**
 * Compatibility wrapper for older experiment callers. It never prompts or executes.
 *
 * @param {string} projectId
 * @param {string} projectRoot
 * @param {{ enableLitePath?: boolean }} options
 * @returns {Promise<object>}
 */
export async function routeExtract(projectId, projectRoot, options = {}) {
  void projectId
  const routeResult = await evaluateAndRoute(projectRoot, {
    ...options,
    enableLitePath: true,
  })
  console.log('\n━━━ 需求理解候选评估（只读）━━━\n')
  if (routeResult.summary) console.log(routeResult.summary)
  console.log('正式流程保持不变：继续使用标准 extraction / review / verify。')
  return routeResult
}

export async function selfTest() {
  const result = await evaluateAndRoute('/path/that/does/not/exist', { enableLitePath: true })
  if (result.useLitePath || result.deliveryAuthority || !result.candidateOnly) {
    throw new Error('lite-path integration must remain read-only and fail closed')
  }
  console.log('lite-path-integration self-test passed')
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--self-test')) {
  selfTest().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
