#!/usr/bin/env node
/**
 * Phase 1 验证 + Run Trace 集成
 *
 * 对 3 个历史遗漏案例进行验证，同时记录性能指标
 *
 * 使用方法：
 *   node common/engine/agent-scripts/phase1-verify-with-trace.mjs PR-02306
 *   node common/engine/agent-scripts/phase1-verify-with-trace.mjs --all
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import {
  createRunTrace,
  recordAction,
  completeRunTrace,
  saveRunTrace,
  formatTraceSummary,
  Timer
} from './lib/run-trace.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../../..')

// 3 个历史遗漏案例配置
const TEST_CASES = {
  'PR-02306': {
    name: '注册登录密码规则修改',
    omission: '图片中的密码规则（8-20位、字母+数字）',
    checkPoints: [
      { id: 'IMG-TEXT', desc: '识别图片中的密码规则文本', weight: 'critical' },
      { id: 'LENGTH', desc: '提取"8-20位"长度限制', weight: 'critical' },
      { id: 'COMBINATION', desc: '提取"必须包含字母和数字"组合要求', weight: 'critical' },
      { id: 'IMAGE-ONLY', desc: '标记为【图片独有需求】', weight: 'important' }
    ],
    prdPath: 'prds/PR-02306/inbox/lark-sync/prd-latest.md'
  },
  'PR-01930': {
    name: '体验金手动失效功能',
    omission: '"所有入口"只找到 2 个，漏了第 3 个',
    checkPoints: [
      { id: 'COLLECTION-KW', desc: '识别"所有"、"每个"等集合语义关键词', weight: 'critical' },
      { id: 'COMPLETE-ENUM', desc: '完整枚举所有入口（≥ 3 个）', weight: 'critical' },
      { id: 'COLLECTION-TAG', desc: '在 work-item 中标记 collectionSemantics', weight: 'important' },
      { id: 'CODE-SEARCH', desc: '使用代码搜索确认完整性', weight: 'recommended' }
    ],
    prdPath: 'prds/PR-01930/inbox/lark-sync/prd-latest.extracted.md'
  },
  'PR-02265': {
    name: 'PR-02265',
    omission: '显式 amount/fee 字段被遗漏',
    checkPoints: [
      { id: 'FUND-CHECKLIST', desc: '自动激活【资金类】检查清单', weight: 'critical' },
      { id: 'AMOUNT-FEE', desc: '识别 amount/fee 关键字段', weight: 'critical' },
      { id: 'FIELD-DETAILS', desc: '检查金额字段的类型、单位、精度', weight: 'important' },
      { id: 'V2-RISK', desc: '标记为高风险需求（V2）', weight: 'important' }
    ],
    prdPath: 'prds/PR-02265/inbox/lark-sync/prd-latest.md'
  }
}

function printBanner(text) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  ${text}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

function printSection(text) {
  console.log(`\n📋 ${text}`)
  console.log('─'.repeat(60))
}

/**
 * 读取 PRD 文件
 */
function readPRD(prdPath) {
  const fullPath = join(PROJECT_ROOT, prdPath)
  if (!existsSync(fullPath)) {
    throw new Error(`PRD 文件不存在: ${prdPath}`)
  }
  return readFileSync(fullPath, 'utf-8')
}

/**
 * 模拟验证流程（实际需要 AI）
 */
async function simulateVerification(projectId, testCase, trace) {
  printBanner(`验证项目: ${projectId} - ${testCase.name}`)

  // Step 1: 读取 PRD
  console.log('📖 Step 1: 读取 PRD...')
  const timer1 = new Timer()

  try {
    const prdContent = readPRD(testCase.prdPath)
    const prdSize = Buffer.byteLength(prdContent, 'utf-8')

    recordAction(trace, {
      action: 'read-prd',
      executor: 'deterministic',
      outcome: 'completed',
      durationMs: timer1.elapsed()
    })

    console.log(`   ✅ 已读取 PRD (${(prdSize / 1024).toFixed(1)} KB)`)
    console.log(`   ⏱️  耗时: ${timer1.elapsedSeconds()}s`)

    // Step 2: 显示历史遗漏信息
    printSection('历史遗漏案例')
    console.log(`❌ 遗漏内容: ${testCase.omission}`)

    // Step 3: 显示检查点
    printSection('验证检查点')
    testCase.checkPoints.forEach((cp, i) => {
      const icon = cp.weight === 'critical' ? '🔴' : cp.weight === 'important' ? '🟡' : '⚪'
      console.log(`  ${i + 1}. [${cp.id}] ${icon} ${cp.desc}`)
    })

    // Step 4: 模拟 AI 抽取（实际需要调用 AI）
    printSection('Step 2: AI 抽取（需要手动执行）')
    console.log('\n⚠️  注意：以下步骤需要实际 AI 执行\n')
    console.log(`命令：`)
    console.log(`  node common/engine/agent-scripts/docs-tdd.mjs extract ${projectId} --force\n`)
    console.log(`或者使用 extraction-guidance v2.0 手动抽取\n`)

    // 记录为待执行的 action
    recordAction(trace, {
      action: 'extract-requirements',
      executor: 'agent',
      outcome: 'pending',
      durationMs: 0
    })

    // Step 5: 输出验证指南
    printSection('验证指南')
    console.log('\n完成 AI 抽取后，请检查以下检查点：\n')

    testCase.checkPoints.forEach((cp, i) => {
      console.log(`${i + 1}. [${cp.id}] ${cp.desc}`)
      console.log(`   □ 未检查`)
      console.log(`   □ ✅ 通过`)
      console.log(`   □ ❌ 失败\n`)
    })

    return {
      success: true,
      projectId,
      prdSize,
      checkPointCount: testCase.checkPoints.length
    }

  } catch (error) {
    recordAction(trace, {
      action: 'read-prd',
      executor: 'deterministic',
      outcome: 'failed',
      durationMs: timer1.elapsed()
    })

    console.error(`\n❌ 验证失败: ${error.message}`)
    return {
      success: false,
      projectId,
      error: error.message
    }
  }
}

/**
 * 验证单个项目
 */
async function verifyProject(projectId) {
  const testCase = TEST_CASES[projectId]
  if (!testCase) {
    console.error(`❌ 未知项目: ${projectId}`)
    return { success: false, projectId, reason: 'unknown-project' }
  }

  // 创建 run trace
  const trace = createRunTrace({
    projectId,
    route: 'standard',
    phase: 'phase1-verification',
    description: `Phase 1 验证: ${testCase.name}`
  })

  console.log(`\n🚀 开始验证: ${projectId}`)
  console.log(`   Run ID: ${trace.runId}`)

  // 执行验证
  const result = await simulateVerification(projectId, testCase, trace)

  // 完成 trace
  completeRunTrace(trace, {
    terminalState: result.success ? 'completed-manual-verification-pending' : 'failed',
    budgetStatus: 'within-budget'
  })

  // 保存 trace
  const traceDir = join(PROJECT_ROOT, `prds/${projectId}`)
  const tracePath = join(traceDir, `phase1-verification-${trace.runId}.json`)

  if (existsSync(traceDir)) {
    saveRunTrace(trace, tracePath)
    console.log(`\n💾 Trace 已保存: ${tracePath}`)
  }

  // 输出摘要
  console.log(formatTraceSummary(trace))

  return { ...result, trace }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2)

  printBanner('Phase 1 验证 + Run Trace')

  console.log('📝 说明：')
  console.log('   本脚本用于验证 extraction-guidance v2.0 在历史遗漏案例上的表现')
  console.log('   同时记录性能指标（时间、token、动作数）')
  console.log('   实际 AI 抽取需要手动执行\n')

  if (args.includes('--all')) {
    // 验证所有项目
    console.log('🚀 验证所有 3 个历史案例...\n')

    const results = []
    for (const projectId of Object.keys(TEST_CASES)) {
      const result = await verifyProject(projectId)
      results.push(result)
      console.log('\n' + '═'.repeat(70) + '\n')
    }

    // 汇总
    printBanner('验证汇总')

    const successCount = results.filter(r => r.success).length
    const totalCheckPoints = results.reduce((sum, r) => sum + (r.checkPointCount || 0), 0)
    const totalTime = results.reduce((sum, r) => sum + (r.trace?.elapsedMs || 0), 0)

    console.log(`📊 统计：`)
    console.log(`   项目总数:     ${results.length}`)
    console.log(`   准备就绪:     ${successCount}`)
    console.log(`   检查点总数:   ${totalCheckPoints}`)
    console.log(`   总耗时:       ${(totalTime / 1000).toFixed(1)}s\n`)

    if (successCount === results.length) {
      console.log('✅ 所有案例准备就绪\n')
      console.log('📋 下一步：')
      console.log('   1. 对每个项目执行 AI 抽取')
      console.log('   2. 检查所有检查点')
      console.log('   3. 记录结果（通过/失败）')
      console.log('   4. 汇总准确率\n')
    }

    return
  }

  // 单个项目验证
  const projectId = args.find(arg => !arg.startsWith('--'))
  if (!projectId) {
    console.log('用法：')
    console.log('  node phase1-verify-with-trace.mjs --all')
    console.log('  node phase1-verify-with-trace.mjs PR-02306')
    console.log('  node phase1-verify-with-trace.mjs PR-01930')
    console.log('  node phase1-verify-with-trace.mjs PR-02265')
    process.exit(1)
  }

  await verifyProject(projectId)
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err)
  process.exit(1)
})
