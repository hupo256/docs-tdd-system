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
    date: '2026-09-23',
    codename: 'Requirement-to-Commit（2026-10-10 起冻结）',
    type: 'minor',
    features: [
      '四档效率路由与预算、safe work context、source graph',
      'requirement / surface / evidence 对账与六类失败有界修复',
      'delivery truth：enforced verify 为唯一正式出口',
    ],
    modules: [
      'extraction-guidance.mjs（09-21 实验，已改写为抽取契约）',
      'lite-path-router.mjs / lite-path-executor.mjs / lite-path-integration.mjs（只读候选，无交付权限）',
      'smart-approval.mjs / smart-review.mjs / smart-rules.mjs（实验，未接入）',
      'progressive-verify.mjs（仅 preflight）',
    ],
    status: {
      release: 'v3.5.0 / stable',
      frozen: '2026-10-10 frozen; new requests use skill prd-to-commit',
      phase1: 'experimental, not integrated',
      phase2: 'read-only evaluation, not integrated into extract',
      phase3: 'experimental, not integrated',
      phase4: 'preflight only, no delivery authority',
      phase5: 'experimental, not integrated',
      pilot: 'collecting; no production attestation',
    },
    breaking: false,
    notes: '2026-09-19 实施，2026-09-23 guard --strict、规则发布和 golden 回归均通过；pilot 仍在 collecting，未宣称 production-ready。09-21 的 Phase 1-5 效率指标已于 09-24 撤回。',
  },
  {
    version: 'v3.3.0',
    date: '2026-09-12',
    codename: 'Autopilot Implementation Loop',
    type: 'minor',
    features: [
      'Autopilot 实现循环与 scope 工作流加固',
      '真实 pilot 登记（collecting）',
    ],
    breaking: false,
  },
  {
    version: 'v3.2.0',
    date: '2026-09-12',
    codename: 'Intake / Review Reliability',
    type: 'minor',
    features: [
      'PRD 表格逐行生成 source unit',
      'intake 与独立审查可靠性修复',
    ],
    breaking: false,
  },
  {
    version: 'v3.1.0',
    date: '2026-09-11',
    codename: 'v3.1 定版',
    type: 'minor',
    features: [
      'workflowVersion 2 协议首次在真实前端需求上跑通',
      'Lark 轻量闭环与正式交付权分离',
    ],
    breaking: false,
  },
  {
    version: 'v2.0.0',
    date: '2026-09-08',
    codename: 'workflowVersion 2 正式启用',
    type: 'major',
    features: [
      '新需求默认 workflowVersion 2：work-item 状态机',
      'docs-tdd verify 为唯一正式出口，全等级 enforced',
    ],
    breaking: true,
    notes: '存量 v1 项目不迁移，继续使用 G0-G8。',
  },
  {
    version: 'v1.0.0',
    date: '2026-06',
    codename: 'G0-G8 阶段门禁',
    type: 'major',
    features: [
      'G0-G8 阶段门禁与项目文档模板',
      '规则路由、按需加载与 L1/L2/L3 分层',
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
  assert.equal(latest.status.release, 'v3.5.0 / stable')
  assert.equal(latest.status.pilot, 'collecting; no production attestation')
  assert.equal(Object.hasOwn(latest, 'metrics'), false)
  assert.match(formatVersionInfo(latest), /guard --strict.*通过|guard --strict.*passed/)
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
