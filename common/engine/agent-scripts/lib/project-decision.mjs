#!/usr/bin/env node
/**
 * 项目下一步决策的**纯函数**层：只吃结构化真值（run-state.json / gate-results.json / gate-history.json），
 * 绝不解析 markdown。这是 `docs-tdd next` / `resume` 的单一判据来源——从前 project-orchestrator 用正则去
 * 扫 feature-inventory 的「待 G2 确认」行来猜阶段，一改文案就失灵；现在阶段与阻塞全部来自机器写的 JSON。
 *
 * 决策表（阶段 × 最新门禁 × 未决阻塞类型 → 单一 nextAction + 可直接粘的命令）：
 *   · 项目不存在                       → scaffold_project（docs-tdd kickoff）
 *   · 有门禁结果且 ok=false            → blocked：fix_gate_failures，重跑**最早**受阻的那一关（不是盲目重跑当前关）
 *   · 有门禁结果且 ok=true 且 <G8      → active：run_next_gate（推进到下一关）
 *   · 有门禁结果且 ok=true 且 =G8      → complete：none
 *   · 尚无门禁结果 → 用 run-state.json 的早期阶段（scaffold/sync/intake/待确认/建 worktree），命令按 nextAction 映射
 *
 * 关键的「最早受阻门禁」推断：G8 跑挂常常是因为 G5 没真正通过（VERIFY-STAGE-00N「G6 需要已持久化的 G5」
 * 一连串塌方）。盲目让人重跑 G8 没意义——应把人指向最早那关。做法：从所有 error 级失败项的 ruleId 与
 * message 里抽出被点名的门禁号，取最小值作为重跑目标。
 *
 * 纯函数、零 IO，`--self-test` 直测（内置两条真实项目形态夹具：PR-01930 fail=7、PR-01947 fail=3）。
 */

export const GATE_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']

export const gateNumber = (gate) => {
  const match = /^G([0-8])$/.exec(String(gate || '').trim())
  return match ? Number(match[1]) : -1
}

export const nextGateOf = (gate) => {
  const index = GATE_ORDER.indexOf(String(gate || '').trim())
  return index === -1 || index === GATE_ORDER.length - 1 ? null : GATE_ORDER[index + 1]
}

// ruleId 前缀 → 修复提示。用查表而非一串 if：新增门禁规则族只在这里加一行。命中不到走 message 兜底。
const REMEDY_TABLE = [
  { re: /^CODE-(?:MOCK|MSW)/, remedy: '清理业务 mock / MSW 残留（保留 landing/契约用桩，删掉业务假数据），再重跑该门禁' },
  { re: /^VERIFY-STAGE/, remedy: '补齐前置门禁的成功历史：按 G0→G8 顺序把更早的门禁真正跑通并写入 gate-history.json' },
  { re: /^VERIFY-G(\d)/, remedy: '先让该阶段门禁真正通过（status=completed 且 evidence 路径存在，或给出 not-applicable 的具体理由）' },
  { re: /^DOC-G3/, remedy: '补齐 G3：API 契约 / MSW 清单（正常/空/错误/未授权/边界）/ 前端 MSW 兜底任务与协作记录' },
  { re: /^DOC-G5/, remedy: '补齐 G5 交付文档（如 API 契约里的文案契约表）' },
  { re: /^DOC-/, remedy: '补齐对应文档章节（缺失的必填结构/字段）' },
  { re: /^CODE-SCOPE/, remedy: '确认改动未越出责任模块目录；确有必要越界时在 §1.1 记录豁免' },
]

export const remedyFor = (ruleId, message = '') => {
  for (const { re, remedy } of REMEDY_TABLE) {
    if (re.test(String(ruleId || ''))) return remedy
  }
  // 兜底：用检查自己的 message（截断到人可读长度）——总比没有强，也不冒充精确建议。
  return String(message || '').split('\n')[0].slice(0, 120) || '按门禁输出修复后重跑'
}

const toItem = (check) => ({
  ruleId: check.ruleId,
  severity: check.severity,
  category: check.category,
  message: String(check.message || '').split('\n')[0].slice(0, 160),
  remedy: remedyFor(check.ruleId, check.message),
})

// 门禁结果 → { errors, warns }。error 级是阻塞项（计入 summary.fail），warn 级是建议项。
export const classifyGateFailures = (gateResult) => {
  const failing = (gateResult?.checks || []).filter((check) => check && check.ok === false)
  return {
    errors: failing.filter((check) => check.severity === 'error').map(toItem),
    warns: failing.filter((check) => check.severity !== 'error').map(toItem),
  }
}

// 所有 error 项里被点名的最小门禁号：ruleId（VERIFY-G5-002→5、DOC-G3-002→3）与 message（"G6 requires ... G5"）都扫。
// 找不到任何门禁号时退回 currentGate（就地重跑）。这让「G8 因 G5 没过而塌方」被正确指向 G5。
export const earliestBlockingGate = (errors, currentGate) => {
  let min = gateNumber(currentGate)
  let found = false
  for (const item of errors) {
    for (const source of [item.ruleId, item.message]) {
      for (const match of String(source || '').matchAll(/G([0-8])\b/g)) {
        const num = Number(match[1])
        if (!found || num < min) { min = num; found = true }
      }
    }
  }
  return min >= 0 ? `G${min}` : currentGate
}

// run-state.json 里早期阶段 nextAction → 可直接执行的命令。阶段真值此时来自 run-state（还没门禁结果）。
const EARLY_COMMAND = {
  scaffold_project: (id) => `docs-tdd kickoff ${id} --prd <Lark URL 或本地 Markdown>`,
  sync_prd: (id) => `docs-tdd resume ${id}`,
  initialize_prd_intake: (id) => `docs-tdd resume ${id}`,
  complete_g0_g1_docs: (id) => `补齐 G0/G1 文档并经 G2 确认后运行 docs-tdd gate ${id} G2`,
  prepare_worktree: (id) => `docs-tdd gate ${id} G2  # 通过后准备 coding worktree`,
}

const decision = (fields) => ({ blockers: [], advisories: [], command: null, ...fields })

/**
 * 单一决策入口。inputs 全为结构化真值：
 *   projectExists, storedState(run-state.json), gateResult(gate-results.json), gateHistory(gate-history.json), worktree
 * 返回 { status, stage, nextAction, command, blockers[], advisories[], gate?, gateOk? }。
 */
export const decideNext = ({ projectId = 'PR-XXXXX', projectExists = false, storedState = null, gateResult = null, worktree = '' } = {}) => {
  if (!projectExists) {
    return decision({ status: 'ready', stage: 'G0', nextAction: 'scaffold_project', command: EARLY_COMMAND.scaffold_project(projectId) })
  }

  // 有门禁结果：门禁证据是 G2+ 阶段的权威真值，压过 run-state 的自述。
  if (gateResult?.gate) {
    const { errors, warns } = classifyGateFailures(gateResult)
    const gate = gateResult.gate
    // G6-partial（部分验收）不是 G6 PASS：既不推进到 G7，也不能落 run_next_gate 空命令。
    // 独立状态 waiting_reconcile——下一步明确为「真实字段对账后重跑完整 G6」。
    if (gate.endsWith('-partial')) {
      if (gateResult.ok === true) {
        return decision({
          status: 'waiting_reconcile', stage: gate, gate, gateOk: true,
          nextAction: 'reconcile_then_full_g6',
          command: `docs-tdd gate ${projectId} G6`,
          advisories: warns,
        })
      }
      return decision({
        status: 'blocked', stage: gate, gate, gateOk: false,
        nextAction: 'fix_gate_failures',
        command: `docs-tdd gate ${projectId} G6 --partial`,
        blockers: errors,
        advisories: warns,
      })
    }
    if (gateResult.ok === true) {
      if (gate === 'G8') {
        return decision({ status: 'complete', stage: 'G8', gate, gateOk: true, nextAction: 'none', advisories: warns })
      }
      const next = nextGateOf(gate)
      return decision({
        status: 'active', stage: gate, gate, gateOk: true,
        nextAction: 'run_next_gate',
        command: next ? `docs-tdd gate ${projectId} ${next}` : null,
        advisories: warns,
      })
    }
    const target = earliestBlockingGate(errors, gate)
    return decision({
      status: 'blocked', stage: gate, gate, gateOk: false,
      nextAction: 'fix_gate_failures',
      command: `docs-tdd gate ${projectId} ${target}`,
      blockers: errors,
      advisories: warns,
    })
  }

  // 尚无门禁结果：走 run-state.json 记录的早期阶段（结构化，不再猜 markdown）。
  if (storedState?.nextAction) {
    const build = EARLY_COMMAND[storedState.nextAction]
    return decision({
      status: storedState.status || 'active',
      stage: storedState.currentStage || 'G0',
      nextAction: storedState.nextAction,
      command: build ? build(projectId) : null,
      blockers: storedState.blocker ? [{ ruleId: 'RUN-STATE', severity: 'error', category: 'orchestration', message: storedState.blocker, remedy: '解决上述阻塞后运行 docs-tdd resume' }] : [],
    })
  }

  // 既无门禁也无 run-state：项目已 scaffold 但编排未启动。指向准备 worktree / 先过 G2。
  if (!worktree) {
    return decision({ status: 'active', stage: 'G2', nextAction: 'prepare_worktree', command: EARLY_COMMAND.prepare_worktree(projectId) })
  }
  return decision({ status: 'active', stage: 'G4', nextAction: 'continue_current_stage', command: `docs-tdd gate ${projectId} G4` })
}

// ---------------------------------------------------------------------------
// self-test：两条真实项目形态夹具 + 边界。node lib/project-decision.mjs --self-test
// ---------------------------------------------------------------------------
const assert = (cond, msg) => { if (!cond) { console.error(`[project-decision] self-test failed: ${msg}`); process.exit(1) } }

const selfTest = () => {
  // 边界：项目不存在 / G8 通过
  assert(decideNext({ projectExists: false }).nextAction === 'scaffold_project', 'missing project → scaffold')
  const g8ok = decideNext({ projectId: 'PR-1', projectExists: true, gateResult: { gate: 'G8', ok: true, checks: [] } })
  assert(g8ok.status === 'complete' && g8ok.nextAction === 'none', 'G8 pass → complete')

  // 推进：G5 通过 → 跑 G6
  const g5ok = decideNext({ projectId: 'PR-2', projectExists: true, gateResult: { gate: 'G5', ok: true, checks: [] } })
  assert(g5ok.nextAction === 'run_next_gate' && g5ok.command === 'docs-tdd gate PR-2 G6', 'G5 pass → advance to G6')

  // PR-01930 形态：G8 fail=7，根因是 G5 未过 + mock 残留 → 指向最早的 G5，逐条阻塞有修复建议
  const pr01930 = decideNext({
    projectId: 'PR-01930', projectExists: true,
    gateResult: {
      gate: 'G8', ok: false, summary: { fail: 7 },
      checks: [
        { ruleId: 'VERIFY-G5-002', ok: false, severity: 'error', category: 'verify', message: 'G5 status is completed or not-applicable (got blocked)' },
        { ruleId: 'VERIFY-G5-003', ok: false, severity: 'error', category: 'verify', message: 'G5 completion has existing evidence paths' },
        { ruleId: 'CODE-MOCK-002', ok: false, severity: 'error', category: 'implementation', message: 'mock residue found:\napps/admin/src/mocks/fixtures/menus.ts' },
        { ruleId: 'CODE-MSW-002', ok: false, severity: 'error', category: 'implementation', message: 'MSW route B business mock residue found' },
        { ruleId: 'VERIFY-STAGE-001', ok: false, severity: 'error', category: 'verify', message: 'G6 requires a persisted successful G5 run in agent/gate-history.json' },
        { ruleId: 'VERIFY-STAGE-002', ok: false, severity: 'error', category: 'verify', message: 'G7 requires a persisted successful G6 run in agent/gate-history.json' },
        { ruleId: 'VERIFY-STAGE-003', ok: false, severity: 'error', category: 'verify', message: 'G8 requires a persisted successful G7 run in agent/gate-history.json' },
      ],
    },
  })
  assert(pr01930.status === 'blocked' && pr01930.nextAction === 'fix_gate_failures', 'PR-01930 → blocked')
  assert(pr01930.blockers.length === 7, `PR-01930 should surface 7 error blockers, got ${pr01930.blockers.length}`)
  assert(pr01930.command === 'docs-tdd gate PR-01930 G5', `PR-01930 should point at earliest gate G5, got ${pr01930.command}`)
  assert(pr01930.blockers.every((b) => b.remedy && b.remedy.length > 0), 'every blocker carries a remedy')
  assert(pr01930.blockers.find((b) => b.ruleId === 'CODE-MOCK-002').remedy.includes('mock'), 'mock blocker gets mock remedy')

  // PR-01947 形态：G5 fail=3（error）+ 若干 warn。error 计入阻塞，warn 进 advisories，目标仍是 G5
  const pr01947 = decideNext({
    projectId: 'PR-01947', projectExists: true,
    gateResult: {
      gate: 'G5', ok: false, summary: { fail: 3 },
      checks: [
        { ruleId: 'DOC-G3-002', ok: false, severity: 'warn', category: 'documentation', message: 'G3 API contract contains MSW checklist' },
        { ruleId: 'DOC-G3-003', ok: false, severity: 'warn', category: 'documentation', message: 'G3 MSW checklist covers scenarios' },
        { ruleId: 'DOC-G5-003', ok: false, severity: 'error', category: 'documentation', message: 'API contract records copy contract table' },
        { ruleId: 'VERIFY-G5-002', ok: false, severity: 'error', category: 'verify', message: 'G5 status is completed or not-applicable (got blocked)' },
        { ruleId: 'VERIFY-G5-003', ok: false, severity: 'error', category: 'verify', message: 'G5 completion has existing evidence paths' },
        { ruleId: 'CODE-SCOPE-001', ok: false, severity: 'warn', category: 'implementation', message: 'changed files outside 责任模块目录' },
      ],
    },
  })
  assert(pr01947.blockers.length === 3, `PR-01947 should surface 3 error blockers, got ${pr01947.blockers.length}`)
  assert(pr01947.advisories.length === 3, `PR-01947 should surface 3 warn advisories, got ${pr01947.advisories.length}`)
  assert(pr01947.command === 'docs-tdd gate PR-01947 G5', `PR-01947 should target G5, got ${pr01947.command}`)

  // 早期阶段：run-state.json 说 sync_prd → resume 命令；不碰任何 markdown
  const early = decideNext({ projectId: 'PR-9', projectExists: true, storedState: { status: 'blocked', currentStage: 'G0', nextAction: 'sync_prd', blocker: 'lark-sources.json 缺失' } })
  assert(early.nextAction === 'sync_prd' && early.command === 'docs-tdd resume PR-9', 'early stage from run-state')
  assert(early.blockers[0]?.message.includes('lark-sources'), 'stored blocker surfaced')

  // G6-partial PASS：不落 run_next_gate 空命令，而是 waiting_reconcile + 指向重跑完整 G6
  const g6partial = decideNext({ projectId: 'PR-8', projectExists: true, gateResult: { gate: 'G6-partial', ok: true, checks: [] } })
  assert(g6partial.status === 'waiting_reconcile' && g6partial.nextAction === 'reconcile_then_full_g6', 'G6-partial pass → waiting_reconcile')
  assert(g6partial.command === 'docs-tdd gate PR-8 G6', `G6-partial should point at full G6 rerun, got ${g6partial.command}`)
  const g6partialFail = decideNext({ projectId: 'PR-8', projectExists: true, gateResult: { gate: 'G6-partial', ok: false, summary: { fail: 1 }, checks: [{ ruleId: 'VERIFY-STAGE-004', ok: false, severity: 'error', category: 'verify', message: 'G6-partial requires G4 PASS' }] } })
  assert(g6partialFail.status === 'blocked' && g6partialFail.command === 'docs-tdd gate PR-8 G6 --partial', 'G6-partial fail → rerun partial')

  console.log('PASS project-decision (8 groups: boundaries, advance, PR-01930, PR-01947, early-stage, G6-partial)')
}

if (process.argv[1] && process.argv[1].endsWith('project-decision.mjs') && process.argv.includes('--self-test')) selfTest()
