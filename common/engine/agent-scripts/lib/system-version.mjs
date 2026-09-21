#!/usr/bin/env node
// docs_tdd 系统版本管理
// 记录系统的主要版本演进和功能特性

import assert from 'node:assert/strict'

/**
 * 系统版本号规范：v<major>.<minor>.<patch>
 *
 * major: 重大架构变更或不兼容更新
 * minor: 新增功能模块
 * patch: Bug 修复和小优化
 */

export const SYSTEM_VERSION = 'v3.5.0'

export const VERSION_HISTORY = [
  {
    version: 'v3.5.0',
    date: '2026-09-21',
    codename: 'Phase 1-5 实验候选',
    type: 'minor',
    features: [
      'Phase 1: extraction-guidance 实验模块',
      'Phase 2: lite-path 只读候选评估，不具备交付权限',
      'Phase 3: smart-approval 与 smart-review 实验模块',
      'Phase 4: progressive-verify 预检模块，正式出口仍为 vnext-verify',
      'Phase 5: smart-rules 实验模块',
    ],
    modules: [
      'extraction-guidance.mjs',
      'lite-path-router.mjs',
      'lite-path-executor.mjs',
      'lite-path-integration.mjs',
      'smart-approval.mjs',
      'smart-review.mjs',
      'progressive-verify.mjs',
      'smart-rules.mjs',
    ],
    status: {
      release: 'v3.5.0-rc / blocked',
      phase1: 'experimental, not integrated',
      phase2: 'read-only evaluation, not integrated into extract',
      phase3: 'experimental, not integrated',
      phase4: 'preflight only, no delivery authority',
      phase5: 'experimental, not integrated',
      pilot: 'collecting; no production attestation',
    },
    breaking: false,
    notes: '当前版本仍在修复与门禁复核中；正式 release 取决于 guard --strict 结果。',
  },
  {
    version: 'v3.0.0',
    date: '2026-09-12',
    codename: 'v3.x 系统重构',
    type: 'major',
    features: [
      'vnext-* 模块引入',
      'work-item.json 标准化',
      'V2 工作流支持',
    ],
    breaking: true,
    notes: '重大架构升级，引入 v2 工作流',
  },
  {
    version: 'v2.0.0',
    date: '2026-08-xx',
    codename: 'V2 工作流',
    type: 'major',
    features: [
      'work-item 标准化',
      'acceptance-results 验收',
    ],
    breaking: true,
  },
  {
    version: 'v1.0.0',
    date: '2026-06-xx',
    codename: '初始版本',
    type: 'major',
    features: [
      '基础 docs-tdd 工作流',
      'V1 项目流程',
    ],
    breaking: false,
  },
]

/**
 * 获取当前系统版本
 */
export function getVersion() {
  return SYSTEM_VERSION
}

/**
 * 获取版本历史
 */
export function getVersionHistory() {
  return VERSION_HISTORY
}

/**
 * 获取特定版本信息
 */
export function getVersionInfo(version) {
  return VERSION_HISTORY.find(v => v.version === version)
}

/**
 * 获取最新版本信息
 */
export function getLatestVersion() {
  return VERSION_HISTORY[0]
}

/**
 * 格式化版本信息
 */
export function formatVersionInfo(versionInfo) {
  if (!versionInfo) return 'Version not found'

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
docs_tdd System Version ${versionInfo.version}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${versionInfo.date}
🏷️  Codename: ${versionInfo.codename}
📦 Type: ${versionInfo.type}
${versionInfo.breaking ? '⚠️  Breaking Changes: Yes' : '✅ Breaking Changes: No'}

Features:
${versionInfo.features.map(f => `  • ${f}`).join('\n')}

${versionInfo.modules ? `
Modules:
${versionInfo.modules.map(m => `  • ${m}`).join('\n')}
` : ''}

${versionInfo.status ? `
Status:
${Object.entries(versionInfo.status).map(([k, v]) => `  • ${k}: ${v}`).join('\n')}
` : ''}

${versionInfo.metrics ? `
Metrics:
${Object.entries(versionInfo.metrics).map(([k, v]) => `  • ${k}: ${v}`).join('\n')}
` : ''}

${versionInfo.notes ? `
Notes:
  ${versionInfo.notes}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
}

/**
 * 打印版本信息
 */
export function printVersion() {
  console.log(formatVersionInfo(getLatestVersion()))
}

/**
 * 打印完整版本历史
 */
export function printVersionHistory() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('docs_tdd System Version History')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  for (const version of VERSION_HISTORY) {
    console.log(`${version.version} - ${version.date} - ${version.codename}`)
    console.log(`  Type: ${version.type}${version.breaking ? ' (Breaking)' : ''}`)
    console.log(`  Features: ${version.features.length}`)
    console.log()
  }
}

export function selfTest() {
  const latest = getLatestVersion()
  assert.equal(getVersion(), 'v3.5.0')
  assert.equal(latest.version, getVersion())
  assert.equal(latest.status.release, 'v3.5.0-rc / blocked')
  assert.equal(latest.status.pilot, 'collecting; no production attestation')
  assert.equal(Object.hasOwn(latest, 'metrics'), false)
  assert.match(formatVersionInfo(latest), /formal release depends on guard --strict|正式 release 取决于 guard --strict/)
  console.log('system-version self-test passed')
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)

  if (args.includes('--self-test')) {
    selfTest()
  } else if (args.includes('--version') || args.includes('-v')) {
    console.log(SYSTEM_VERSION)
  } else if (args.includes('--info')) {
    printVersion()
  } else if (args.includes('--history')) {
    printVersionHistory()
  } else {
    console.log(`
Usage:
  node system-version.mjs --self-test    # Run version truth assertions
  node system-version.mjs --version      # Print version number
  node system-version.mjs --info         # Print latest version info
  node system-version.mjs --history      # Print version history
`)
  }
}
