#!/usr/bin/env node
// 新项目脚手架的纯构建层：跨域链接深度重写、PRD 源类型判定、agent/ 下各 JSON 状态文件的初始内容。
// 全纯函数（agent JSON 由 ctx 决定），--self-test 直测（被 check-doc-budget 驱动）。

import path from 'node:path'
import assert from 'node:assert/strict'

export function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

// 模板按「直接位于 templates/ 下」的深度写跨域相对链接（../common、../templates）。物化后的项目文档
// 落在 prds/<id>/<sub>/…，到 docs 根的距离随子目录不同，故按目标文件自身深度重算 ../ 段数；幂等。
export function rewriteTemplateLinksForProjectDoc(content, targetPath, docsRoot) {
  const ups = path.relative(path.dirname(targetPath), docsRoot).split(path.sep).filter((seg) => seg === '..').length
  const prefix = '../'.repeat(ups)
  return content.replace(/(?:\.\.\/)+(?=(?:common|templates)\/)/g, prefix)
}

export function sourceTypeFromPrd(prd) {
  if (/larksuite\.com\/wiki\//i.test(prd)) return 'wiki'
  if (/larksuite\.com\/(docx?|docs?)\//i.test(prd)) return 'doc'
  if (/\.md($|[?#])/i.test(prd) || prd.endsWith('.md')) return 'markdown'
  return 'doc'
}

// agent/ 下开工即写死的 JSON 状态文件初始内容。返回「项目内相对路径 → 内容字符串」映射。
// 不含 gate-results.json（VERIFY-G8-001 要求它由 verify-project-gate --write 真实产出，桩文件会让 G8 证据形同虚设）。
export function buildAgentJsonFiles({ projectId, today, branchName, rulesetVersion }) {
  return {
    'agent/rule-waivers.json': json([]),
    'agent/project-manifest.json': json({
      projectId,
      createdAt: today,
      rulesetVersion,
      templateVersion: 5,
      pilot: { msw: true, prdIntake: true },
      gatePolicy: { legacyRules: 'blocking', currentTouchedRules: 'blocking' },
    }),
    'agent/stage-status.json': json({
      projectId,
      stages: {
        // confirmedBy/confirmedAt 是人工签名槽位（DOC-CONFIRM-001/002）：处置态转 completed 等时必须由真人填写，
        // 空串会被 classifySignature 判为缺签名。模板 v3+ 项目缺签名即 error（trial since:3），存量项目 warn。
        G5: { status: 'pending', reason: '待完成真实 API 联调，或确认本项目无 API 联调范围。', evidence: [], confirmedBy: '', confirmedAt: '', updatedAt: today },
        G7: { status: 'pending', reason: '待收到 QA 用例后执行，或明确记录未提供 QA 用例而跳过。', evidence: [], confirmedBy: '', confirmedAt: '', updatedAt: today },
      },
    }),
    'agent/gate-history.json': json({ projectId, runs: [] }),
    'agent/msw-manifest.json': json({
      projectId,
      route: 'msw',
      lifecycle: 'planned',
      sourceRoot: '',
      assets: {
        handler: '',
        fixture: '',
        contractTest: '',
        registration: 'apps/web/src/mocks/browser.ts',
        workerHook: 'apps/web/src/mocks/useMockWorker.ts',
        provider: 'apps/web/src/app/[lang]/Providers.tsx',
        handlerExport: '',
      },
      endpoints: [],
      retirement: { retiredAt: '', reconciliationEvidence: '' },
    }),
    'agent/assumptions.json': json({ projectId, assumptions: [] }),
    'agent/blockers.json': json([]),
    'agent/code-review.json': json({
      projectId,
      reviewedAt: today,
      reviewer: 'pending',
      // 人工签收槽位（DOC-CONFIRM-004）：reviewer 记谁做的 review（常是 Agent），confirmedBy 记谁签收结论，
      // 两者不能同一人。空串判缺签名——模板 v3+ 缺签名 error，存量项目 warn。
      confirmedBy: '',
      confirmedAt: '',
      head: '0000000000000000000000000000000000000000',
      findings: [
        { id: 'CR-1', category: 'other', severity: 'high', summary: 'G6 code review 尚未执行', disposition: 'open', evidence: [] },
      ],
    }),
    'agent/acceptance-results.json': json({ projectId, head: '0000000000000000000000000000000000000000', items: [] }),
    'agent/delivery-status.json': json({
      projectId,
      mode: 'local',
      branch: branchName,
      headSha: '',
      pullRequestUrl: '',
      evidence: [],
      note: 'G8 前更新为 pushed / merged / released；gate 会用 Git 实际状态复核。',
    }),
  }
}

export function selfTest() {
  assert.equal(sourceTypeFromPrd('https://x.larksuite.com/wiki/abc'), 'wiki')
  assert.equal(sourceTypeFromPrd('https://x.larksuite.com/docx/abc'), 'doc')
  assert.equal(sourceTypeFromPrd('inbox/prd.md'), 'markdown')
  assert.equal(sourceTypeFromPrd('https://x.larksuite.com/other/abc'), 'doc')
  // 项目文档在 prds/<id>/product/ 下，到 docs 根需回退 3 层（prds/<id>/product → docs 根）。
  const rewritten = rewriteTemplateLinksForProjectDoc('见 ../common/README.md', '/docs/prds/PR-00001/product/x.md', '/docs')
  assert.ok(rewritten.includes('../../../common/README.md'), `depth rewrite expected ../../../, got: ${rewritten}`)
  const files = buildAgentJsonFiles({ projectId: 'PR-00001', today: '2026-01-01', branchName: 'feature/PR-00001', rulesetVersion: 3 })
  assert.ok(files['agent/project-manifest.json'].includes('"rulesetVersion": 3'))
  assert.ok(JSON.parse(files['agent/project-manifest.json']).templateVersion === 5, '新脚手架模板版本应为 5（原子需求验收默认启用；MSW-IMPL since:4 与 DOC-CONFIRM since:3 继续生效）')
  // 人工签名槽位随骨架落地（DOC-CONFIRM-001/002/004），真人填写前为空串。
  const stages = JSON.parse(files['agent/stage-status.json']).stages
  assert.ok('confirmedBy' in stages.G5 && 'confirmedAt' in stages.G5, 'G5 应带签名槽位')
  assert.ok('confirmedBy' in stages.G7 && 'confirmedAt' in stages.G7, 'G7 应带签名槽位')
  assert.ok('confirmedBy' in JSON.parse(files['agent/code-review.json']), 'code-review 应带签收槽位')
  assert.ok(!('agent/gate-results.json' in files), 'gate-results.json 不应预建（VERIFY-G8-001）')
  assert.ok(JSON.parse(files['agent/blockers.json']).length === 0)
  console.log('project-scaffold self-test passed')
}

if (process.argv[1] && process.argv[1].endsWith('project-scaffold.mjs') && process.argv.includes('--self-test')) {
  selfTest()
  process.exit(0)
}
