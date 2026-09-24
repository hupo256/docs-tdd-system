#!/usr/bin/env node
/**
 * Phase 1 验证脚本
 *
 * 测试 extraction-guidance v2.0 在 3 个历史遗漏案例上的表现
 *
 * 使用方法：
 *   node common/engine/agent-scripts/test-phase1-verification.mjs --project PR-02306
 *   node common/engine/agent-scripts/test-phase1-verification.mjs --all
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../../..')

// 3 个历史遗漏案例
const TEST_CASES = {
  'PR-02306': {
    name: '注册登录密码规则修改',
    omission: '图片中的密码规则（8-20位、字母+数字）被遗漏',
    rootCause: '只看了图片的布局，没有读图片中的文字',
    checkPoints: [
      '是否识别到图片中的密码规则文本',
      '是否提取"8-20位"长度限制',
      '是否提取"必须包含字母和数字"组合要求',
      '是否标记为【图片独有需求】'
    ],
    prdPath: 'prds/PR-02306/inbox/lark-sync/prd-latest.md'
  },
  'PR-01930': {
    name: '体验金手动失效功能',
    omission: '"所有入口"只找到 2 个，漏了第 3 个',
    rootCause: '看到 2 个就停了，没有完整枚举',
    checkPoints: [
      '是否识别到"所有"、"每个"等集合语义关键词',
      '是否完整枚举所有入口（≥ 3 个）',
      '是否在 work-item 中标记 collectionSemantics',
      '是否使用代码搜索确认完整性'
    ],
    prdPath: 'prds/PR-01930/inbox/lark-sync/prd-latest.extracted.md'
  },
  'PR-02265': {
    name: 'PR-02265',
    omission: '显式 amount/fee 字段被遗漏',
    rootCause: '关键字段被淹没在大量细节中',
    checkPoints: [
      '是否自动激活【资金类】检查清单',
      '是否识别到 amount/fee 关键字段',
      '是否检查金额字段的类型、单位、精度',
      '是否标记为高风险需求（V2）'
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
  console.log('─'.repeat(50))
}

async function verifyProject(projectId) {
  const testCase = TEST_CASES[projectId]
  if (!testCase) {
    console.error(`❌ 未知项目: ${projectId}`)
    return { success: false, projectId }
  }

  printBanner(`验证项目: ${projectId} - ${testCase.name}`)

  // Step 1: 检查 PRD 是否存在
  const prdFullPath = join(PROJECT_ROOT, testCase.prdPath)
  if (!existsSync(prdFullPath)) {
    console.error(`❌ PRD 文件不存在: ${testCase.prdPath}`)
    return { success: false, projectId, reason: 'prd-not-found' }
  }

  console.log(`✅ PRD 文件存在: ${testCase.prdPath}`)

  // Step 2: 显示历史遗漏信息
  printSection('历史遗漏案例')
  console.log(`遗漏内容: ${testCase.omission}`)
  console.log(`根本原因: ${testCase.rootCause}`)

  // Step 3: 显示检查点
  printSection('验证检查点')
  testCase.checkPoints.forEach((point, i) => {
    console.log(`  ${i + 1}. ${point}`)
  })

  // Step 4: 检查当前 work-item（如果存在）
  const workItemPath = join(PROJECT_ROOT, `prds/${projectId}/work-item.json`)
  let currentWorkItem = null

  if (existsSync(workItemPath)) {
    console.log(`\n✅ 找到现有 work-item: ${workItemPath}`)
    try {
      currentWorkItem = JSON.parse(readFileSync(workItemPath, 'utf-8'))
      console.log(`   - workflowVersion: ${currentWorkItem.workflowVersion || '1 (legacy)'}`)
      console.log(`   - requirements: ${currentWorkItem.requirements?.length || 0} 条`)
    } catch (err) {
      console.error(`⚠️  解析 work-item 失败: ${err.message}`)
    }
  }

  // Step 5: 提示下一步操作
  printSection('下一步操作')
  console.log(`\n需要人工或 AI 完成以下操作：\n`)
  console.log(`1️⃣  读取 PRD：`)
  console.log(`   cat "${testCase.prdPath}"`)
  console.log(`\n2️⃣  使用 extraction-guidance v2.0 重新抽取：`)
  console.log(`   node common/engine/agent-scripts/docs-tdd.mjs extract ${projectId} --force`)
  console.log(`\n3️⃣  检查新抽取结果是否满足所有检查点`)
  console.log(`\n4️⃣  对比旧版本（如果有的话）`)

  return {
    success: true,
    projectId,
    testCase,
    prdPath: testCase.prdPath,
    currentWorkItem
  }
}

async function main() {
  const args = process.argv.slice(2)

  printBanner('Phase 1 验证脚本 - extraction-guidance v2.0')

  console.log('📝 说明：')
  console.log('   本脚本检查 3 个历史遗漏案例的验证准备情况')
  console.log('   实际抽取需要调用 AI（Claude/Pi），请根据提示手动执行\n')

  if (args.includes('--all')) {
    // 验证所有项目
    console.log('🚀 验证所有 3 个历史案例...\n')

    const results = []
    for (const projectId of Object.keys(TEST_CASES)) {
      const result = await verifyProject(projectId)
      results.push(result)
      console.log('\n' + '═'.repeat(60) + '\n')
    }

    // 汇总
    printBanner('验证汇总')
    const successCount = results.filter(r => r.success).length
    console.log(`总计: ${results.length} 个案例`)
    console.log(`准备就绪: ${successCount} 个`)
    console.log(`失败: ${results.length - successCount} 个\n`)

    if (successCount === results.length) {
      console.log('✅ 所有案例准备就绪，可以开始真实验证\n')
      console.log('📋 建议验证顺序：')
      console.log('   1. PR-02306（图片需求，最典型）')
      console.log('   2. PR-01930（集合枚举）')
      console.log('   3. PR-02265（资金字段）\n')
    }

    return
  }

  // 单个项目验证
  const projectId = args.find(arg => !arg.startsWith('--'))
  if (!projectId) {
    console.log('用法：')
    console.log('  node test-phase1-verification.mjs --all')
    console.log('  node test-phase1-verification.mjs PR-02306')
    console.log('  node test-phase1-verification.mjs PR-01930')
    console.log('  node test-phase1-verification.mjs PR-02265')
    process.exit(1)
  }

  await verifyProject(projectId)
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err)
  process.exit(1)
})
