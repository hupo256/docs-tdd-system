#!/usr/bin/env node
// v3.5 lite-path executor: read-only experiment evaluator.
// It never implements, verifies, stages, commits, or grants delivery authority.

/**
 * 保留旧函数名，避免实验调用方在迁移期间断裂；返回值明确要求继续标准流程。
 *
 * @param {string} projectId
 * @param {string} prdText
 * @param {{ root?: string }} options
 * @returns {Promise<object>}
 */
export async function executeLitePath(projectId, prdText, options = {}) {
  const candidate = quickUnderstand(prdText, { projectId, ...options })
  const tooManyFiles = candidate.files.length > 3

  return {
    success: false,
    phase: 'evaluation',
    timeSpent: 0,
    fallbackToStandard: true,
    deliveryAuthority: false,
    changes: [],
    verification: null,
    reason: tooManyFiles ? 'too-many-files' : 'lite-path-read-only',
    candidate,
  }
}

function quickUnderstand(prdText, options = {}) {
  return {
    summary: extractSummary(prdText),
    files: extractFiles(prdText, options.projectId),
    changes: prdText,
  }
}

function extractSummary(prdText) {
  const firstLine = String(prdText).split('\n')[0] || ''
  return firstLine.slice(0, 100)
}

function extractFiles(prdText) {
  const filePattern = /([a-zA-Z0-9_.\-/]+\.(?:tsx?|jsx?|css|scss))/g
  const matches = String(prdText).match(filePattern) || []
  return [...new Set(matches)]
}

export async function selfTest() {
  const result = await executeLitePath(
    'TEST-001',
    '把首页按钮文案从"开始"改成"立即开始"',
  )

  if (
    result.success ||
    !result.fallbackToStandard ||
    result.deliveryAuthority ||
    result.changes.length > 0 ||
    result.verification !== null
  ) {
    throw new Error('lite-path must remain read-only and fall back to standard flow')
  }

  const manyFiles = await executeLitePath(
    'TEST-002',
    '修改所有页面的标题，包括 Login.tsx, Register.tsx, Home.tsx, Profile.tsx',
  )
  if (manyFiles.reason !== 'too-many-files' || manyFiles.candidate.files.length !== 4) {
    throw new Error('lite-path must identify too many candidate files without modifying them')
  }

  console.log('lite-path-executor self-test passed')
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--self-test')) {
  selfTest().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
