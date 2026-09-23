#!/usr/bin/env node
// v4.0 lite-path executor: fast-track for low-risk changes (copy/style/typo)
// When lite-path-router judges eligible=true, this executor skips extraction/review
// and goes straight to: minimal work-item → code → verify → commit

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * v4.0 lite-path 快速执行通道
 * 
 * @param {string} projectId - 项目 ID (如 PR-02440)
 * @param {string} prdText - PRD 文本（需求描述）
 * @param {string} userIntent - 用户意图（如「改文案」）
 * @param {object} options
 * @param {string} options.docsRoot - docs_tdd 根目录
 * @param {string} options.repoRoot - 代码仓库根目录
 * @param {boolean} options.dryRun - 仅模拟不真实写文件
 * @returns {Promise<object>} 执行结果
 */
export async function executeLitePathV4(projectId, prdText, userIntent, options = {}) {
  const startTime = Date.now()
  const dryRun = options.dryRun || false
  const docsRoot = options.docsRoot || resolve(process.cwd(), 'apps/web/docs_tdd')
  const repoRoot = options.repoRoot || resolve(process.cwd())
  
  const projectDir = join(docsRoot, 'prds', projectId)
  
  // 步骤 1: 产出最小 work-item.json
  const workItem = generateMinimalWorkItem(projectId, prdText, userIntent)
  
  if (!dryRun) {
    const workItemPath = join(projectDir, 'work-item.json')
    writeFileSync(workItemPath, JSON.stringify(workItem, null, 2), 'utf-8')
  }
  
  // 步骤 2: 提取改动文件和预期变更
  const candidate = extractChangeCandidate(prdText, userIntent, repoRoot)
  
  // 步骤 3: 生成简化 README
  const readme = generateLiteReadme(projectId, prdText, userIntent, candidate)
  
  if (!dryRun) {
    const readmePath = join(projectDir, 'README.md')
    writeFileSync(readmePath, readme, 'utf-8')
  }
  
  const elapsedMs = Date.now() - startTime
  
  return {
    success: true,
    mode: 'lite-path-v4',
    projectId,
    workItem,
    candidate,
    files: {
      'work-item.json': workItem,
      'README.md': readme,
    },
    nextSteps: [
      '1. Agent 按 candidate.changes 写代码（context < 20K tokens）',
      '2. 运行 Biome: pnpm biome check --write',
      '3. 运行边界测试（如果 candidate.testCommand 存在）',
      '4. docs-tdd checkpoint → commit',
    ],
    timeSpent: elapsedMs,
    dryRun,
  }
}

/**
 * 生成最小 work-item.json (v2 协议)
 */
function generateMinimalWorkItem(projectId, prdText, userIntent) {
  const requirementId = 'R-001'
  const surfaceId = 'S-001'
  const timestamp = new Date().toISOString()
  
  // 从 PRD 提取改动文件
  const files = extractFilesFromText(prdText)
  const firstFile = files[0] || 'unknown'
  
  // 判断场景类型（copy/style/typo）
  const scenarioType = classifyScenario(prdText, userIntent)
  
  return {
    schemaVersion: 1,
    workflowVersion: 2,
    projectId,
    efficiencyRoute: 'lite',  // 强制 lite 档
    createdAt: timestamp,
    sourceSnapshot: {
      type: 'text',
      content: prdText,
      capturedAt: timestamp,
      fingerprint: generateFingerprint(prdText),
    },
    requirements: [
      {
        requirementId,
        sourceAnchors: [
          {
            type: 'text',
            sourceId: 'lite-path-input',
            path: 'user-intent',
          },
        ],
        statement: userIntent.slice(0, 200),
        status: 'doing',
        collectionSemantics: {
          kind: 'none',
          expectedCount: 0,
        },
        affectedSurfaces: [
          {
            surfaceId,
            locator: `${firstFile} ${scenarioType} 修改`,
            disposition: 'implement',
            expectPath: files.length > 0 ? files[0] : 'src/**/*.tsx',
          },
        ],
        evidencePlan: [
          {
            type: scenarioType === 'copy' ? 'copy-literal' : 'component-dom',
            runtimeRequired: false,
          },
        ],
      },
    ],
    requirementsAuthor: 'lite-path-v4',
    coverageAudit: {
      schemaVersion: 1,
      sourceFingerprint: generateFingerprint(prdText),
      requirementsFingerprint: generateFingerprint(userIntent),
      sourceUnitsFingerprint: generateFingerprint(`${prdText}${userIntent}`),
      status: 'lite-path-skip',
      reviewer: { kind: 'lite-path', id: 'v4' },
      verdict: 'pass',
      findings: [],
      message: 'lite-path 快速通道跳过 extraction/coverage review',
    },
    routing: {
      scenarioKind: 'lite-path',
      scopeClass: 'single-surface',
      riskSignals: [],
      verificationLevel: 'V0',  // lite-path 使用最低验证级别
      deliveryTargetApp: 'apps/web',
    },
    apiDependency: {
      mode: 'not-required',
    },
    deliveryScope: {
      mode: 'full-batch',
      policyPaths: files.length > 0 ? files : ['src'],
    },
  }
}

/**
 * 从文本提取文件路径
 */
function extractFilesFromText(text) {
  const filePattern = /([a-zA-Z0-9_.\-/]+\.(?:tsx?|jsx?|css|scss|json))/g
  const matches = text.match(filePattern) || []
  return [...new Set(matches)]
}

/**
 * 分类场景类型
 */
function classifyScenario(prdText, userIntent) {
  const combined = `${prdText} ${userIntent}`.toLowerCase()
  
  if (/文案|copy|翻译|text|wording/.test(combined)) return 'copy'
  if (/样式|style|颜色|间距|color|spacing/.test(combined)) return 'style'
  if (/typo|拼写|错误/.test(combined)) return 'typo'
  
  return 'simple-change'
}

/**
 * 生成指纹
 */
function generateFingerprint(text) {
  return randomBytes(32).toString('hex')
}

/**
 * 提取变更候选
 */
function extractChangeCandidate(prdText, userIntent, repoRoot) {
  const files = extractFilesFromText(prdText)
  const scenarioType = classifyScenario(prdText, userIntent)
  
  // 提取「从 A 改成 B」模式
  const changePattern = /(?:从|将)[\s"']*([^"'\s]+)[\s"']*(?:改成|改为|换成)[\s"']*([^"'\s]+)/
  const match = prdText.match(changePattern)
  
  const changes = []
  if (match) {
    changes.push({
      file: files[0] || 'unknown',
      type: scenarioType,
      from: match[1],
      to: match[2],
      action: `替换 "${match[1]}" → "${match[2]}"`,
    })
  } else {
    changes.push({
      file: files[0] || 'unknown',
      type: scenarioType,
      description: userIntent,
    })
  }
  
  // 提取测试命令（如果有）
  const testPattern = /测试命令?[:：]\s*([^\n]+)|测试[:：]\s*([^\n]+)/
  const testMatch = prdText.match(testPattern)
  const testCommand = testMatch ? (testMatch[1] || testMatch[2]).trim() : null
  
  return {
    files,
    scenarioType,
    changes,
    testCommand,
    estimatedLOC: changes.length * 2,  // 粗略估算改动行数
  }
}

/**
 * 生成简化 README
 */
function generateLiteReadme(projectId, prdText, userIntent, candidate) {
  return `---
projectId: ${projectId}
workflowVersion: 2
efficiencyRoute: lite
status: implementing
stage: lite-path
createdAt: ${new Date().toISOString()}
---

# ${projectId} (lite-path 快速通道)

> 本项目通过 v4.0 lite-path 快速通道创建，跳过了 extraction/coverage review。

## 需求

${userIntent}

### PRD 原文

\`\`\`
${prdText.slice(0, 500)}${prdText.length > 500 ? '...' : ''}
\`\`\`

## 改动

| 文件 | 类型 | 变更 |
|------|------|------|
${candidate.changes.map(c => `| ${c.file} | ${c.type} | ${c.action || c.description} |`).join('\n')}

## 验证

- [ ] Biome: \`pnpm biome check --write\`
${candidate.testCommand ? `- [ ] 测试: \`${candidate.testCommand}\`\n` : ''}
- [ ] 人工确认: 改动符合预期

## 下一步

执行 \`docs-tdd checkpoint ${projectId}\` 提交改动。
`
}

/**
 * 自测
 */
export async function selfTest() {
  console.log('lite-path-executor-v4 self-test...')
  
  // 测试 1: 纯文案修改
  const test1 = await executeLitePathV4(
    'TEST-LITE-001',
    '把 Home.tsx 首页按钮文案从"开始"改成"立即开始"',
    '改文案',
    { dryRun: true }
  )
  
  if (!test1.success) throw new Error('test1 should succeed')
  if (test1.workItem.efficiencyRoute !== 'lite') throw new Error('test1 should be lite route')
  if (test1.candidate.scenarioType !== 'copy') throw new Error('test1 should be copy scenario')
  if (test1.candidate.changes[0].from !== '开始') throw new Error('test1 change extraction failed')
  
  console.log('✓ Test 1: 纯文案修改')
  
  // 测试 2: 样式调整
  const test2 = await executeLitePathV4(
    'TEST-LITE-002',
    '调整 Button.tsx 按钮颜色为蓝色',
    '样式调整',
    { dryRun: true }
  )
  
  if (test2.candidate.scenarioType !== 'style') throw new Error('test2 should be style scenario')
  console.log('✓ Test 2: 样式调整')
  
  // 测试 3: 带测试命令
  const test3 = await executeLitePathV4(
    'TEST-LITE-003',
    '修复 utils.ts 的拼写错误。测试命令: pnpm test utils.test.ts',
    '修复typo',
    { dryRun: true }
  )
  
  if (!test3.candidate.testCommand) throw new Error('test3 should extract test command')
  if (!test3.candidate.testCommand.includes('pnpm test')) throw new Error('test3 test command incorrect')
  console.log('✓ Test 3: 带测试命令')
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('lite-path-executor-v4 self-test: 3/3 passed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--self-test')) {
    selfTest().catch((error) => {
      console.error(error)
      process.exit(1)
    })
  } else if (process.argv.includes('--exec')) {
    const projectId = process.argv[process.argv.indexOf('--exec') + 1]
    const prdText = process.argv[process.argv.indexOf('--exec') + 2] || ''
    const userIntent = process.argv[process.argv.indexOf('--exec') + 3] || ''
    
    executeLitePathV4(projectId, prdText, userIntent)
      .then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
  } else {
    console.log(`
Usage:
  node lite-path-executor-v4.mjs --self-test
  node lite-path-executor-v4.mjs --exec <PROJECT-ID> "<PRD text>" "<user intent>"
`)
  }
}
