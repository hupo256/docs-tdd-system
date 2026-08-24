#!/usr/bin/env node
// 阶段 gate 的脆弱判定核心：从 markdown/文档正文里抽事实的纯谓词与解析器（无副作用、不闭包 gate 运行态）。
// 从 verify-project-gate.mjs 物理抽出（主文件逼近预算上限），逻辑逐字保留；--self-test 用 +/- 锚点用例
// 逐条守正则/表格解析漂移（历史假阳性根因）。改行序/列序/占位词时，自测会先在 check-doc-budget/hook 处 fail。

export function parseMarkdownTableRows(text, heading) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const rows = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (index > start + 1 && line.startsWith('## ')) break
    if (!line.startsWith('|')) continue
    if (/^\|[-: |]+\|$/.test(line)) continue
    rows.push(line.split('|').slice(1, -1).map((cell) => cell.trim()))
  }
  return rows.slice(1)
}

export function recordsPrdSource(text) {
  return /\| PRD 来源 \|\s*(?!\s*\|)/.test(text)
}
export function recordsG2Confirmer(text) {
  const value = text.match(/\| G2 确认人 & 日期 \|\s*([^|]+)\|/)?.[1]?.trim() || ''
  return Boolean(value && !/待确认|待填写/.test(value) && /\d{4}-\d{2}-\d{2}/.test(value) && /[^\d\s/（()·-]/.test(value))
}
export function featureRowsMissingStatus(rows) {
  return rows.filter((row) => row[0] && !row.some((cell) => ['做', '不做', '延期'].includes(cell)))
}
export function featureRowStatus(row) {
  return row.find((cell) => ['做', '不做', '延期'].includes(cell)) || ''
}
export function parseResponsibilityModulePaths(value) {
  const backtickPaths = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1])
  const candidates = backtickPaths.length ? backtickPaths : value.split(/[,，、]/)
  return candidates
    .map((item) => item.trim().replace(/^`|`$/g, '').replace(/\/\*\*$/, ''))
    .filter((item) => item && !item.includes('如 ') && !item.includes('待'))
}
export function completedTasksWithUnresolvedContract(text) {
  return text
    .split('\n')
    .filter((line) => /^\s*-\s*\[[xX]\]/.test(line) && /ASSUMED|待后端|待对账|后端侧待办|契约未完成/.test(line))
}
export function findBlockingPlaceholders(text, extra = []) {
  const placeholders = ['待填写', '待读取', '待 G2 确认', ...extra]
  return placeholders.filter((item) => text.includes(item))
}
export function technicalDesignOwnership(text) {
  const templateVersion = Number(text.match(/template-version:\s*(\d+)/)?.[1] || 0)
  const section = text.match(/## 单一事实源与所有权[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[0] || ''
  return {
    applicable: templateVersion >= 2,
    hasSection: Boolean(section),
    complete: Boolean(section) && !/待确认|待填写/.test(section),
  }
}
export function technicalDesignDataFlow(text) {
  const templateVersion = Number(text.match(/template-version:\s*(\d+)/)?.[1] || 0)
  const section = text.match(/## 数据流与分层契约[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[0] || ''
  return {
    applicable: templateVersion >= 3,
    hasSection: Boolean(section),
    complete: Boolean(section) && !/待确认|待填写|待检查/.test(section),
  }
}
// DOC-G4-008/009（PR-01947 教训，2026-07-27）：PRD 给出的两条不同面包屑路径，落点探查时
// 其中一条 grep 不到真实代码，探查者未如实报「缺失」，而是静默顶替映射成了另一个名字相近的
// UI 元素——导致 PRD 真正要改的页面全程零改动、零测试却"验收通过"。此检查强制功能清单里
// 出现的每条面包屑，必须在技术方案里逐条原文复述+核验，不允许探查时找不到目标就悄悄换成
// 别的组件（见 architecture-and-state.md §2.2）。
export function technicalDesignBreadcrumbCheck(inventoryText, designText) {
  const breadcrumbs = [...new Set((inventoryText.match(/【[^】]+】(?:--【[^】]+】)+/g) || []))]
  if (!breadcrumbs.length) return { applicable: false }
  const section = designText.match(/## (?:PRD )?路径核验[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[0] || ''
  const missing = breadcrumbs.filter((breadcrumb) => !designText.includes(breadcrumb))
  return {
    applicable: true,
    hasSection: Boolean(section),
    missing,
  }
}
// VERIFY-G6-002：不止「写了 review 命令名」，还要求 findings 有处理结论、且无未处理悬空项。
// 判据（纯谓词，供 self-test）：
//  ① 记录了 code-review / Review；
//  ② 记录了处理结论（已修 / 豁免 / 不适用 / 0 findings / 无问题）；
//  ③ 无未处理悬空标记（findings 旁写「待修复 / 未处理 / 待处理 finding」却无结论）= 未清零，判 fail。
// ③ 用于堵「写了 3 条 findings 就算过」的漏洞：未处理即红灯，要么当场修、要么进 rule-waivers.json。
export function codeReviewFindingsResolved(text) {
  const mentionsReview = /code-review|\/code-review|Review/.test(text)
  const recordsDisposition = /findings?|finding|问题|处理|结论|disposition|0\s*findings?|无问题|已修复|已修|豁免|不适用|N\/A/i.test(text)
  const hasUnresolved = /(待修复|未处理|待处理|未修复|pending\s*fix|unresolved)/i.test(text)
  return mentionsReview && recordsDisposition && !hasUnresolved
}

// GIT-G4-002 基线判定（纯谓词，供 self-test）。
// 关键区分——两种偏离语义完全不同：
//  - 良性：feature 从 online 切出后，origin/online 又前进了（主线正常推进）。基线正确，不该 FAIL。
//  - 恶性：从 dev/test 或与 online 无共同历史处切出（把他人未上线提交带进 feature）。必须 BLOCK。
// 现状用 `origin/online is-ancestor HEAD` 把「良性前进」也判成 FAIL（过严误报）。
// 修正：只要 HEAD 与 origin/online 有共同历史（hasCommonBase）即基线合法 pass；
// online 已前进（!onlineIsAncestorOfHead）仅作 warn 提示「可考虑同步基线」，不阻断。
// 无共同历史（hasCommonBase=false）= 从无关分支切，仍 error。
export function classifyBaseline(hasCommonBase, onlineIsAncestorOfHead) {
  if (!hasCommonBase) return { ok: false, severity: 'error', note: 'no common history with origin/online — likely branched off a non-online ref' }
  if (!onlineIsAncestorOfHead) return { ok: true, severity: 'warn', note: 'baseline valid but origin/online has advanced since branch point; consider syncing before merge' }
  return { ok: true, severity: 'error', note: 'HEAD descends from current origin/online' }
}

export function selfTest() {
  const failures = []
  const truthy = (label, cond) => { if (!cond) failures.push(label) }

  truthy('recordsPrdSource pos', recordsPrdSource('| PRD 来源 | https://x/doc |'))
  truthy('recordsPrdSource neg empty', !recordsPrdSource('| PRD 来源 |  |'))
  truthy('recordsG2Confirmer pos', recordsG2Confirmer('| G2 确认人 & 日期 | 张三 2026-07-10 |'))
  truthy('recordsG2Confirmer neg pending', !recordsG2Confirmer('| G2 确认人 & 日期 | 待确认 |'))
  truthy('recordsG2Confirmer neg empty', !recordsG2Confirmer('| G2 确认人 & 日期 |  |'))
  truthy('findBlockingPlaceholders pos', findBlockingPlaceholders('前置 待填写 后置').length === 1)
  truthy('findBlockingPlaceholders neg', findBlockingPlaceholders('已定稿无占位').length === 0)
  truthy('findBlockingPlaceholders extra', findBlockingPlaceholders('含 待检查 项', ['待检查']).length === 1)

  const inventory = [
    '## 功能清单',
    '',
    '| ID | 名称 | a | b | c | d | 本期 |',
    '|----|------|---|---|---|---|------|',
    '| F1 | 甲 | . | . | . | . | 做 |',
    '| F2 | 乙 | . | . | . | . | 待定 |',
    '',
    '## 下一节',
  ].join('\n')
  const rows = parseMarkdownTableRows(inventory, '## 功能清单')
  truthy('parseMarkdownTableRows count', rows.length === 2)
  truthy('featureRowsMissingStatus pos', featureRowsMissingStatus(rows).length === 1)
  const allValid = parseMarkdownTableRows(inventory.replace('待定', '延期'), '## 功能清单')
  truthy('featureRowsMissingStatus neg', featureRowsMissingStatus(allValid).length === 0)
  truthy('featureRowStatus reads status cell', featureRowStatus(rows[0]) === '做')

  // classifyBaseline：三分支——恶性(无共同历史,error) / 良性前进(warn,不阻断) / 完全最新(error 语义 pass)
  const bad = classifyBaseline(false, false)
  truthy('classifyBaseline no-common-base blocks', !bad.ok && bad.severity === 'error')
  const advanced = classifyBaseline(true, false)
  truthy('classifyBaseline online-advanced passes as warn', advanced.ok && advanced.severity === 'warn')
  const fresh = classifyBaseline(true, true)
  truthy('classifyBaseline fresh passes', fresh.ok && fresh.severity === 'error')
  const modulePaths = parseResponsibilityModulePaths(
    '`apps/web/src/apps/Prediction/**`、`apps/web/src/services/api/prediction/**`、`apps/web/src/mocks/**`（MSW）',
  )
  truthy('parseResponsibilityModulePaths backticks and Chinese delimiter', modulePaths.length === 3 && modulePaths[2] === 'apps/web/src/mocks')
  truthy('parseResponsibilityModulePaths plain commas', parseResponsibilityModulePaths('apps/a/**, apps/b/**').length === 2)
  truthy(
    'completedTasksWithUnresolvedContract detects checked ASSUMED task',
    completedTasksWithUnresolvedContract('- [x] **T-F20** 已落码（ASSUMED `marginMode`，待后端对账）').length === 1,
  )
  truthy(
    'completedTasksWithUnresolvedContract allows unchecked unresolved task',
    completedTasksWithUnresolvedContract('- [ ] **T-F20** 展示代码已落，字段待后端对账').length === 0,
  )

  // VERIFY-G6-002：findings 有结论且无未处理项才 pass
  truthy('codeReviewFindingsResolved pos disposition', codeReviewFindingsResolved('已跑 /code-review：findings 3 条，全部已修'))
  truthy('codeReviewFindingsResolved pos zero', codeReviewFindingsResolved('/code-review 0 findings，无问题'))
  truthy('codeReviewFindingsResolved neg command-only', !codeReviewFindingsResolved('已跑 code-review'))
  truthy('codeReviewFindingsResolved neg unresolved', !codeReviewFindingsResolved('code-review findings 3 条：2 已修，1 待修复'))

  const ownershipV1 = technicalDesignOwnership('<!-- template-version: 1 -->\n## 复用盘点')
  truthy('technicalDesignOwnership v1 not applicable', !ownershipV1.applicable)
  const ownershipMissing = technicalDesignOwnership('<!-- template-version: 2 -->\n## 方案\n已完成')
  truthy('technicalDesignOwnership v2 missing section', ownershipMissing.applicable && !ownershipMissing.hasSection)
  const ownershipPending = technicalDesignOwnership('<!-- template-version: 2 -->\n## 单一事实源与所有权\n| 事实 | 待确认 |\n## 方案')
  truthy('technicalDesignOwnership v2 pending fails', ownershipPending.hasSection && !ownershipPending.complete)
  const ownershipComplete = technicalDesignOwnership('<!-- template-version: 2 -->\n## 单一事实源与所有权\n| 分类规则 | categoryRules.ts | import | 否 | 无 |\n## 方案')
  truthy('technicalDesignOwnership v2 complete passes', ownershipComplete.applicable && ownershipComplete.hasSection && ownershipComplete.complete)
  const dataFlowV2 = technicalDesignDataFlow('<!-- template-version: 2 -->\n## 方案')
  truthy('technicalDesignDataFlow v2 not applicable', !dataFlowV2.applicable)
  const dataFlowMissing = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 方案\n已完成')
  truthy('technicalDesignDataFlow v3 missing section', dataFlowMissing.applicable && !dataFlowMissing.hasSection)
  const dataFlowPending = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 数据流与分层契约\n| UserCard | 待确认 |\n## 方案')
  truthy('technicalDesignDataFlow v3 pending fails', dataFlowPending.hasSection && !dataFlowPending.complete)
  const dataFlowComplete = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 数据流与分层契约\n| UserCard | useUser | userKeys.detail | getUser | userSchema/UserDto | mapUser | UserModel | React Query | mapper test |\n## 方案')
  truthy('technicalDesignDataFlow v3 complete passes', dataFlowComplete.applicable && dataFlowComplete.hasSection && dataFlowComplete.complete)
  const dataFlowPureUi = technicalDesignDataFlow('<!-- template-version: 3 -->\n## 数据流与分层契约\n| StaticBanner | N/A：数据来自静态 i18n 配置 |\n## 方案')
  truthy('technicalDesignDataFlow v3 pure UI N/A passes', dataFlowPureUi.complete)
  const breadcrumbNoInventory = technicalDesignBreadcrumbCheck('无面包屑', '## 方案')
  truthy('technicalDesignBreadcrumbCheck no breadcrumb not applicable', !breadcrumbNoInventory.applicable)
  const breadcrumbMissing = technicalDesignBreadcrumbCheck(
    '【合约管理后台】--【合约跟单】--【Kol列表】\n【合约管理后台】--【合约跟单】--【跟单者管理】',
    '## 路径核验\n| 【合约管理后台】--【合约跟单】--【Kol列表】 | grep KolListPanel | 命中 | KolListPanel.vue |',
  )
  truthy(
    'technicalDesignBreadcrumbCheck flags breadcrumb missing from design doc',
    breadcrumbMissing.applicable && breadcrumbMissing.missing.length === 1,
  )
  const breadcrumbComplete = technicalDesignBreadcrumbCheck(
    '【合约管理后台】--【合约跟单】--【Kol列表】\n【合约管理后台】--【合约跟单】--【跟单者管理】',
    '## 路径核验\n| 【合约管理后台】--【合约跟单】--【Kol列表】 | grep KolListPanel | 命中 | KolListPanel.vue |\n| 【合约管理后台】--【合约跟单】--【跟单者管理】 | grep copyTradingAdminFollow | 缺失（需确认跨 PR 依赖） | N/A，待确认 |',
  )
  truthy(
    'technicalDesignBreadcrumbCheck passes when every breadcrumb echoed',
    breadcrumbComplete.applicable && breadcrumbComplete.hasSection && breadcrumbComplete.missing.length === 0,
  )

  if (failures.length) {
    console.error(`gate-doc-parsers self-test FAILED (${failures.length}):\n  ${failures.join('\n  ')}`)
    process.exit(1)
  }
  console.log('PASS gate-doc-parsers (阶段 gate 文档解析纯谓词，34 cases)')
}

if (process.argv[1] && process.argv[1].endsWith('gate-doc-parsers.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
