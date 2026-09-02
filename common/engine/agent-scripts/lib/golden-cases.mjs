// golden-run 的基线 gate 列表与变异用例数据表。用例的 apply/assert 闭包依赖运行时 fixture 助手
// （物化目录、读写/编辑夹具文件），故用 buildMutationCases(fx) 工厂注入，而非纯数据常量。
// 无独立可测纯逻辑（判定核心在 lib/golden-verdict.mjs），故登记在 check-doc-budget 的 SELF_TEST_EXEMPT。

import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

export const baselineGates = ['G0', 'G1', 'G2', 'G3', 'G5', 'G6', 'G7']

// fx: { targetDir, editFixtureFile, writeFixtureFile, GOLDEN_PROJECT_ID, errorFailures }
// 每个用例只破坏一处。expectRuleId 是「必须命中」的那条；任何额外 error 命中都算规则变宽。
export function buildMutationCases({ targetDir, editFixtureFile, writeFixtureFile, GOLDEN_PROJECT_ID, errorFailures }) {
  const fastTrackLedger = (overrides = {}) => ({
    projectId: GOLDEN_PROJECT_ID,
    route: 'pending-api',
    confirmedBy: 'golden-owner',
    confirmedAt: '2026-08-24',
    items: [{
      id: 'FTD-001',
      category: 'amount-precision',
      semanticStatus: 'provisional',
      impact: 'cross-cutting',
      summary: '金额精度待真实接口确认',
      source: 'product/03-api-contract.md',
      temporaryContract: '临时按 8 位截断，仅用于 dev 验证',
      safeFallback: '规则未确认时显示 -- 并禁用提交',
      owner: 'product-owner',
      reconcileWith: 'api',
      resolveByGate: 'G5',
      status: 'open',
      resolution: '',
      evidence: ['product/06-collaboration.md'],
    }],
    ...overrides,
  })
  return [
    {
      id: 'missing-api-contract-file',
      gate: 'G0',
      expectRuleId: 'DOC-STRUCT-006',
      apply: () => rmSync(join(targetDir, 'product/03-api-contract.md')),
    },
    {
      id: 'missing-agent-readme',
      gate: 'G0',
      expectRuleId: 'DOC-STRUCT-012',
      apply: () => rmSync(join(targetDir, 'agent/README.md')),
    },
    {
      id: 'prd-source-row-empty',
      gate: 'G0',
      expectRuleId: 'DOC-G0-001',
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| PRD 来源 | golden-project/inbox/prd-fixture.md |', '| PRD 来源 |  |')),
    },
    {
      id: 'feature-list-heading-renamed',
      gate: 'G0',
      expectRuleId: 'DOC-G0-002',
      // 标题被改写时 G0-002 必须红；同一份文档的表格解析也会跟着空掉，故 G2 的行级规则不在此用例断言。
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('## 功能清单', '## 功能一览')),
    },
    {
      id: 'acceptance-mapping-removed',
      gate: 'G0',
      expectRuleId: 'DOC-G0-003',
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('## 验收标准对照', '## 验收想法')),
    },
    {
      id: 'g1-scope-missing',
      gate: 'G1',
      expectRuleId: 'DOC-G1-001',
      apply: () => editFixtureFile('product/01-scope-and-phases.md', (text) => text.replaceAll('范围', '阶段')),
    },
    {
      id: 'blocking-placeholder-left-in-inventory',
      gate: 'G2',
      expectRuleId: 'DOC-G2-001',
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('夹具用最小功能', '待填写')),
    },
    {
      id: 'g2-confirmer-unfilled',
      gate: 'G2',
      expectRuleId: 'DOC-G2-002',
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| G2 确认人 & 日期 | golden-fixture 2026-08-03 |', '| G2 确认人 & 日期 | 待确认 |')),
    },
    {
      id: 'feature-row-without-status',
      gate: 'G2',
      expectRuleId: 'DOC-G2-004',
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| F02 | 历史榜单归档 | 不做 | 夹具用不做项 |', '| F02 | 历史榜单归档 | 评估中 | 夹具用不做项 |')),
    },
    {
      id: 'doing-feature-missing-from-tasks',
      gate: 'G2',
      expectRuleId: 'DOC-G2-005',
      tolerate: ['DOC-G2-006'],
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| F03 | 榜单分享卡片 | 延期 | 夹具用延期项 |', '| F04 | 榜单筛选 | 做 | 任务表里故意缺 F04 |')),
    },
    {
      id: 'atomic-requirement-invalid-evidence-type',
      gate: 'G2',
      expectRuleId: 'DOC-G2-006',
      apply: () => editFixtureFile('product/00-feature-inventory.md', (text) => text.replace('| R-F01-01 | F01 | 打开榜单页能看到列表 | component-dom |', '| R-F01-01 | F01 | 打开榜单页能看到列表 | copy-only |')),
    },
    {
      id: 'atomic-requirement-missing-task',
      gate: 'G2',
      expectRuleId: 'DOC-G2-007',
      apply: () => editFixtureFile('product/04-frontend-tasks.md', (text) => text.replace('| T01 | F01 | R-F01-01 |', '| T01 | F01 | — |')),
    },
    {
      id: 'msw-route-b-not-locked',
      gate: 'G3',
      expectRuleId: 'DOC-G3-001',
      // 三处 MSW 路线锚点同时消失才可能改动路线结论，故本用例把同文件的连带命中列进 tolerate。
      tolerate: ['DOC-G3-002'],
      apply: () => editFixtureFile('product/03-api-contract.md', (text) => text.replace(/MSW 路线 B/g, 'Mock 方案').replace('`src/mocks/handlers`', '`src/fake`')),
    },
    {
      id: 'msw-fallback-task-missing',
      gate: 'G3',
      expectRuleId: 'DOC-G3-006',
      apply: () => editFixtureFile('product/04-frontend-tasks.md', (text) => text.replace('| T03 | F01 | — | G3 API 未 ready 时补齐 MSW handler / 契约测试 / dev-only worker 注册 | 完成 |', '| T03 | F01 | — | 补 mock | 完成 |')),
    },
    {
      id: 'dev-only-worker-note-missing',
      gate: 'G3',
      expectRuleId: 'DOC-G3-005',
      apply: () => editFixtureFile('product/03-api-contract.md', (text) => text.replace('worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。', 'worker 全环境注册。')),
    },
    {
      id: 'valid-waiver-downgrades-error',
      gate: 'G3',
      // 豁免机制本身也是 gate 的一部分：可豁免规则命中 + 未过期豁免 => 该条不再是 error。
      expectRuleId: null,
      apply: () => {
        editFixtureFile('product/03-api-contract.md', (text) => text.replace('worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。', 'worker 全环境注册。'))
        writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
          { ruleId: 'DOC-G3-005', reason: 'golden fixture waiver case', owner: 'golden-run', expiresAt: '2099-12-31' },
        ], null, 2)}\n`)
      },
      assert: (result) => {
        const waived = (result.checks || []).find((check) => check.ruleId === 'DOC-G3-005')
        assert.ok(waived, 'DOC-G3-005 应出现在 checks 里')
        assert.equal(waived.severity, 'waived', `未过期豁免应把 DOC-G3-005 降为 waived，实际 ${waived.severity}`)
        assert.equal(errorFailures(result.checks).length, 0, `豁免后不应剩余 error：${errorFailures(result.checks).join(', ')}`)
      },
    },
    {
      id: 'expired-waiver-still-blocks',
      gate: 'G3',
      expectRuleId: 'DOC-G3-005',
      // 过期豁免有两个后果，都要在：① 原规则照旧阻断（DOC-G3-005）；② 台账已失效本身判 error（DOC-WAIVER-003）。
      tolerate: ['DOC-WAIVER-003'],
      apply: () => {
        editFixtureFile('product/03-api-contract.md', (text) => text.replace('worker 注册仅 dev 环境：`browser.ts` 只在 dev-only 分支启动，生产构建不注册。', 'worker 全环境注册。'))
        writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
          { ruleId: 'DOC-G3-005', reason: 'expired waiver case', owner: 'golden-run', expiresAt: '2020-01-01' },
        ], null, 2)}\n`)
      },
      assert: (result) => {
        const expired = (result.checks || []).find((check) => check.ruleId === 'DOC-WAIVER-003')
        assert.ok(expired, '过期豁免必须以 DOC-WAIVER-003 暴露，不能静默忽略')
        assert.equal(expired.severity, 'error', `过期豁免的台账条目本身应判 error（逼续期/删除），实际 ${expired.severity}`)
      },
    },
    {
      id: 'unowned-waiver-is-error',
      gate: 'G3',
      // 缺 owner（同理缺 reason/expiresAt）的豁免不生效，且台账条目本身判 error：豁免必须具名担责。
      expectRuleId: 'DOC-WAIVER-002',
      apply: () => writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
        { ruleId: 'DOC-G3-005', reason: 'no owner case', expiresAt: '2099-12-31' },
      ], null, 2)}\n`),
    },
    {
      id: 'open-blocker-blocks-at-gate',
      gate: 'G3',
      // 阻塞登记：open 且 blocksGate=G3 的 blocker 在 G3 必须命中 DOC-BLOCK-002。
      expectRuleId: 'DOC-BLOCK-002',
      apply: () => writeFixtureFile('agent/blockers.json', `${JSON.stringify([
        { id: 'BLK-9', type: 'blocker', gate: 'G3', blocksGate: 'G3', category: 'backend', summary: '接口未就绪', owner: 'be', raisedAt: '2026-08-03', status: 'open', evidence: [] },
      ], null, 2)}\n`),
    },
    {
      id: 'malformed-blocker-file',
      gate: 'G3',
      // 结构非法（resolved 缺 resolution）只报 DOC-BLOCK-001，不连环误报 002/003。
      expectRuleId: 'DOC-BLOCK-001',
      apply: () => writeFixtureFile('agent/blockers.json', `${JSON.stringify([
        { id: 'BLK-8', type: 'blocker', gate: 'G3', blocksGate: 'G3', category: 'backend', summary: 'x', owner: 'be', raisedAt: '2026-08-03', status: 'resolved' },
      ], null, 2)}\n`),
    },
    {
      id: 'blocker-waiver-downgrades',
      gate: 'G3',
      // DOC-BLOCK-002 可豁免：具名带期限的 waiver 应把它降为 waived，允许带阻塞往前推。
      expectRuleId: null,
      apply: () => {
        writeFixtureFile('agent/blockers.json', `${JSON.stringify([
          { id: 'BLK-7', type: 'blocker', gate: 'G3', blocksGate: 'G3', category: 'backend', summary: '接口未就绪', owner: 'be', raisedAt: '2026-08-03', status: 'open', evidence: [] },
        ], null, 2)}\n`)
        writeFixtureFile('agent/rule-waivers.json', `${JSON.stringify([
          { ruleId: 'DOC-BLOCK-002', reason: 'golden fixture blocker waiver', owner: 'golden-run', expiresAt: '2099-12-31' },
        ], null, 2)}\n`)
      },
      assert: (result) => {
        const waived = (result.checks || []).find((check) => check.ruleId === 'DOC-BLOCK-002')
        assert.ok(waived, 'DOC-BLOCK-002 应出现在 checks 里')
        assert.equal(waived.severity, 'waived', `未过期豁免应把 DOC-BLOCK-002 降为 waived，实际 ${waived.severity}`)
        assert.equal(errorFailures(result.checks).length, 0, `豁免后不应剩余 error：${errorFailures(result.checks).join(', ')}`)
      },
    },
    {
      id: 'fast-track-undecided-money-blocks-g2',
      gate: 'G2',
      expectRuleId: 'DOC-FAST-003',
      apply: () => writeFixtureFile('agent/fast-track.json', `${JSON.stringify(fastTrackLedger({
        items: [{
          ...fastTrackLedger().items[0],
          semanticStatus: 'undecided',
          temporaryContract: '',
        }],
      }), null, 2)}\n`),
    },
    {
      id: 'fast-track-open-decision-blocks-at-due-gate',
      gate: 'G5',
      expectRuleId: 'DOC-FAST-005',
      apply: () => writeFixtureFile('agent/fast-track.json', `${JSON.stringify(fastTrackLedger(), null, 2)}\n`),
    },
    // G6-partial 正反对照：同一「等真实接口对账」的到期项，partial 下转待对账放行、纯业务 decision 欠账仍阻断。
    {
      id: 'fast-track-partial-defers-api-reconcile',
      gate: 'G6',
      partial: true,
      expectRuleId: null,
      apply: () => writeFixtureFile('agent/fast-track.json', `${JSON.stringify(fastTrackLedger(), null, 2)}\n`),
      assert: (result) => {
        const f5 = (result.checks || []).find((check) => check.ruleId === 'DOC-FAST-005')
        if (!f5?.ok) throw new Error(`G6-partial 下 reconcileWith=api 的到期项应记为待对账、不阻断，实际 DOC-FAST-005 ok=${f5?.ok}：${f5?.message}`)
        const f4 = (result.checks || []).find((check) => check.ruleId === 'DOC-FAST-004')
        if (!f4?.ok) throw new Error(`pending-api 等接口项销账 gate 应放宽到 G6，DOC-FAST-004 不应判 error：${f4?.message}`)
      },
    },
    {
      id: 'fast-track-partial-still-blocks-decision-debt',
      gate: 'G6',
      partial: true,
      expectRuleId: null,
      apply: () => writeFixtureFile('agent/fast-track.json', `${JSON.stringify(fastTrackLedger({
        items: [{ ...fastTrackLedger().items[0], id: 'FTD-002', category: 'permission', reconcileWith: 'decision', temporaryContract: '临时默认拒绝', safeFallback: '未知权限一律拒绝' }],
      }), null, 2)}\n`),
      assert: (result) => {
        const f5 = (result.checks || []).find((check) => check.ruleId === 'DOC-FAST-005')
        if (f5?.ok !== false) throw new Error(`G6-partial 不是逃逸口：纯业务 decision 欠账仍须硬阻断，实际 DOC-FAST-005 ok=${f5?.ok}`)
      },
    },
    {
      id: 'open-code-review-finding',
      gate: 'G6',
      expectRuleId: 'DOC-CR-002',
      apply: () => writeFixtureFile('agent/code-review.json', `${JSON.stringify({
        projectId: GOLDEN_PROJECT_ID,
        reviewedAt: '2026-08-03',
        reviewer: 'golden-fixture',
        confirmedBy: 'golden-owner',
        confirmedAt: '2026-08-03',
        head: '0000000000000000000000000000000000000000',
        findings: [{ id: 'CR-1', category: 'correctness', severity: 'high', summary: '未处理问题', disposition: 'open', evidence: [] }],
      }, null, 2)}\n`),
    },
    {
      id: 'doing-feature-missing-acceptance',
      gate: 'G6',
      expectRuleId: 'DOC-AC-002',
      tolerate: ['DOC-AC-008', 'DOC-AC-009'],
      apply: () => writeFixtureFile('agent/acceptance-results.json', `${JSON.stringify({ projectId: GOLDEN_PROJECT_ID, head: '0000000000000000000000000000000000000000', items: [] }, null, 2)}\n`),
    },
    {
      id: 'passed-acceptance-missing-evidence',
      gate: 'G6',
      expectRuleId: 'DOC-AC-004',
      // 空 evidence 同时触发 DOC-AC-005（无真实文件锚点）——这是正确连带，显式容忍。
      tolerate: ['DOC-AC-005'],
      apply: () => editFixtureFile('agent/acceptance-results.json', (text) => text.replace('"evidence": ["evidence/gate/g6/README.md"]', '"evidence": []')),
    },
    {
      id: 'acceptance-evidence-broken-anchor',
      gate: 'G6',
      expectRuleId: 'DOC-AC-005',
      // evidence 非空但指向不存在的文件：只触发 DOC-AC-005（锚点不存在），不触发 DOC-AC-004（非空）。
      apply: () => editFixtureFile('agent/acceptance-results.json', (text) => text.replace('evidence/gate/g6/README.md', 'evidence/gate/g6/nonexistent.png')),
    },
    {
      id: 'acceptance-evidence-type-mismatch',
      gate: 'G6',
      expectRuleId: 'DOC-AC-009',
      apply: () => editFixtureFile('agent/acceptance-results.json', (text) => text.replace('"evidenceType": "component-dom"', '"evidenceType": "copy-literal"')),
    },
    // ---- G6-partial 端到端：同一批「等接口 open 假设 + 后端未就绪阻塞」在部分验收下放行、在完整 G6 下阻断 ----
    // 两条用例共用同一处 setup（只破坏一处「停靠态」），仅 --partial 开关不同，正反锁死 partial 语义。
    {
      id: 'g6-partial-passes-with-pending-reconcile',
      gate: 'G6',
      partial: true,
      expectRuleId: null,
      apply: () => setupPartialScenario({ editFixtureFile, writeFixtureFile, GOLDEN_PROJECT_ID }),
      assert: (result) => {
        assert.equal(result.gate, 'G6-partial', `partial 运行必须记 gate=G6-partial（否则会伪装成 G6 PASS 满足 G7 前置），实际 ${result.gate}`)
        assert.equal(result.partial, true, 'partial 字段应为 true（写入端与 schema 一致）')
        assert.equal(result.ok, true, `G6-partial 应放行（待对账不阻断），实际 error：${errorFailures(result.checks).join(', ') || '(无但 ok!==true)'}`)
        const assumCheck = (result.checks || []).find((check) => check.ruleId === 'DOC-ASSUM-001')
        assert.ok(assumCheck?.ok, 'DOC-ASSUM-001 在 partial 下应把等接口假设记为待对账（ok）')
        const blockCheck = (result.checks || []).find((check) => check.ruleId === 'DOC-BLOCK-002')
        assert.ok(blockCheck?.ok, 'DOC-BLOCK-002 在 partial 下应把后端阻塞记为待对账（ok）')
        assert.ok((result.checks || []).some((check) => check.ruleId === 'VERIFY-G6-005'), 'partial 运行必须落 VERIFY-G6-005 部分验收结论')
      },
    },
    {
      id: 'g6-full-blocks-on-same-pending-items',
      gate: 'G6',
      partial: false,
      expectRuleId: null,
      apply: () => setupPartialScenario({ editFixtureFile, writeFixtureFile, GOLDEN_PROJECT_ID }),
      assert: (result) => {
        assert.equal(result.gate, 'G6', `完整 G6 应记 gate=G6，实际 ${result.gate}`)
        assert.equal(result.ok, false, '同一批待对账项在完整 G6 下必须阻断（partial 不是逃逸口）')
        assert.deepEqual(
          new Set(errorFailures(result.checks)),
          new Set(['DOC-ASSUM-001', 'DOC-BLOCK-002']),
          `完整 G6 下应恰好由 open 假设 + open 后端阻塞两条判 error，实际：${errorFailures(result.checks).join(', ')}`,
        )
      },
    },
  ]
}

// G6-partial 场景 setup：补 G4 PASS 历史（VERIFY-STAGE-004 前置）+ 一条等接口 open 假设 + 一条后端未就绪 open 阻塞。
// 抽成独立函数是因为正反两条用例（partial / 完整 G6）必须喂完全相同的输入，setup 漂移会让对照失效。
function setupPartialScenario({ editFixtureFile, writeFixtureFile, GOLDEN_PROJECT_ID }) {
  editFixtureFile('agent/gate-history.json', (text) => {
    const history = JSON.parse(text)
    history.runs.unshift({ gate: 'G4', ok: true, generatedAt: '2026-08-03T00:00:00.000Z', tool: 'run-project-gate.mjs', summary: { total: 1, ok: 1, warn: 0, waived: 0, fail: 0 }, evidence: 'evidence/gate/g4/README.md' })
    return `${JSON.stringify(history, null, 2)}\n`
  })
  writeFixtureFile('agent/assumptions.json', `${JSON.stringify({
    projectId: GOLDEN_PROJECT_ID,
    assumptions: [{ id: 'ASM-1', endpoint: '/x', field: 'f', code: [], owner: 'be', status: 'open', blockingWhen: 'api-ready', resolution: '' }],
  }, null, 2)}\n`)
  writeFixtureFile('agent/blockers.json', `${JSON.stringify([
    { id: 'BLK-9', type: 'blocker', gate: 'G5', blocksGate: 'G6', category: 'backend', summary: '接口未就绪', owner: 'be', raisedAt: '2026-08-03', status: 'open', evidence: [] },
  ], null, 2)}\n`)
}
