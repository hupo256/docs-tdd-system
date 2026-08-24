#!/usr/bin/env node
import { isPendingReconcileAssumption } from './gate-partial.mjs'
// 假设台账（agent/assumptions.json）的唯一销账语义源：verify-msw-manifest（实现节奏轴）
// 和 verify-project-gate（交付节奏轴）都从这里 import，不各写一份 filter。
//
// 为什么要有它：销账判定原先只存在于 verify-msw-manifest.mjs 一处，且阻断轴取自
// MSW lifecycle——lifecycle=mock-active 时 blockingStatuses 为空数组，于是 open 假设
// 连 warn 都不产生（PR-02074 曾带 7 条 open 假设完全静默）；`blockingWhen:'release'`
// 也只在 lifecycle=mock-retired 时才计入，G8 交付这条轴根本没有钩子。拆出本 lib 后
// 两个轴各有名分：lifecycle 轴仍归 DOC-G3-IMPL-006，gate 轴归 DOC-ASSUM-001/002。
//
// 纯函数、无 I/O、无 process.exit（除 --self-test 入口）：disk 读取由调用方负责，
// 这样 gate 的 --self-test 能直接喂对象断言，不碰真实项目。

// blockingWhen 的四个轴里 prd-clarify 刻意不出现在任何轴：它表达「等 PRD 澄清语义」，
// 是正当阻塞轴而非数据错，不该卡实现或交付（见 CHANGELOG「assumptions.schema.json 补
// prd-clarify」条）。要卡它请用 blockers.json 的 blocksGate。
const API_AXES = ['api-ready', 'reconciling']
const RELEASE_AXES = [...API_AXES, 'release']

// 实现节奏轴：MSW 生命周期推进到哪一步，就该销掉对应轴的假设。
// 语义与拆分前的 verify-msw-manifest.mjs 完全一致，只是搬了家。
export function axesForLifecycle(lifecycle) {
  if (lifecycle === 'mock-retired') return RELEASE_AXES
  if (lifecycle === 'api-ready' || lifecycle === 'reconciling') return API_AXES
  return []
}

// 交付节奏轴：G5 联调出口必须销掉「等接口 / 等对账」的假设；release 轴留到 G8 交付才卡。
// G5 之前不卡——那时假设正是推进手段（MSW 路线 B 的立身之本）。
export function axesForGate(gate) {
  if (gate === 'G8') return RELEASE_AXES
  if (gate === 'G5' || gate === 'G6' || gate === 'G7') return API_AXES
  return []
}

export function unresolvedAssumptions({ ledger, axes }) {
  if (!Array.isArray(axes) || axes.length === 0) return []
  const list = Array.isArray(ledger?.assumptions) ? ledger.assumptions : []
  return list.filter((item) => item && item.status === 'open' && axes.includes(item.blockingWhen))
}

const describe = (items) => items.map((item) => `${item.id}(${item.owner}→${item.blockingWhen})`).join('、')

// gate 消费：返回标准 check 形状（聚合式，每个 gate 一条 check），由调用方逐条 add()。
// 聚合而非逐条假设一条：豁免按 ruleId+file 匹配，聚合让「豁免 DOC-ASSUM-002」成为一次
// 具名带期限的担责动作（= 接受风险交付），而不是给每条假设单独开后门。
export function assumptionChecks({ ledger, gate, file = 'agent/assumptions.json', partial = false }) {
  const axes = axesForGate(gate)
  // 台账缺失（ledger 为 null/undefined）或当前 gate 无阻断轴 → 不发 check：零回填。
  // 台账可读性本身由 DOC-G3-IMPL-005 负责（MSW 试点项目），本处不重复报。
  if (ledger === null || ledger === undefined || axes.length === 0) return []

  const ruleId = gate === 'G8' ? 'DOC-ASSUM-002' : 'DOC-ASSUM-001'
  const unresolved = unresolvedAssumptions({ ledger, axes })

  // G6-partial（G5 停靠态的部分验收）：等接口 / 等对账的 open 假设正是停靠态的题中之义，
  // 记为待对账 warn、不阻断本次部分验收；完整 G6/G7/G8（partial 只在 G6 成立）仍按 error 卡销账。
  // 判据单点收敛在 gate-partial.isPendingReconcileAssumption，本处不另写口径。
  if (partial) {
    const pending = unresolved.filter(isPendingReconcileAssumption)
    const hard = unresolved.filter((item) => !isPendingReconcileAssumption(item))
    return [
      {
        ruleId,
        ok: hard.length === 0,
        severity: 'error',
        category: 'documentation',
        file,
        message: hard.length
          ? `G6-partial 下仍有非接口类 open 假设未销账（不可待对账）：${describe(hard)}`
          : `G6-partial：${pending.length ? `${pending.length} 条待接口对账的假设记为待对账（${describe(pending)}），不阻断部分验收，真实字段到位后须重跑完整 G6 销账` : '无待对账假设'}`,
      },
    ]
  }

  const scope = gate === 'G8' ? '交付前' : `${gate} 出口前`
  return [
    {
      ruleId,
      ok: unresolved.length === 0,
      severity: 'error',
      category: 'documentation',
      file,
      message: unresolved.length
        ? `${scope}必须销账的 open 假设未销账：${describe(unresolved)}（销账=改 status 并写 resolution；确需带风险交付走 rule-waivers.json 具名带期限豁免）`
        : `无到达当前阶段(${gate})仍未销账的假设（阻断轴：${axes.join('/')}）`,
    },
  ]
}

function selfTest() {
  const assert = (name, condition) => {
    if (!condition) {
      console.error(`FAIL ${name}`)
      process.exitCode = 1
    }
  }
  const asm = (id, status, blockingWhen) => ({ id, endpoint: '/x', field: 'f', code: [], owner: 'be', status, blockingWhen, resolution: '' })
  const ledger = { projectId: 'PR-00001', assumptions: [asm('ASM-001', 'open', 'api-ready'), asm('ASM-002', 'open', 'release'), asm('ASM-003', 'open', 'prd-clarify'), asm('ASM-004', 'confirmed', 'api-ready')] }

  // 轴映射
  assert('lifecycle mock-retired → 全轴', axesForLifecycle('mock-retired').length === 3)
  assert('lifecycle api-ready → 双轴', axesForLifecycle('api-ready').join() === 'api-ready,reconciling')
  assert('lifecycle mock-active → 空轴', axesForLifecycle('mock-active').length === 0)
  assert('lifecycle planned → 空轴', axesForLifecycle('planned').length === 0)
  assert('gate G8 → 含 release', axesForGate('G8').includes('release'))
  assert('gate G5 → 不含 release', axesForGate('G5').length === 2 && !axesForGate('G5').includes('release'))
  assert('gate G6/G7 继承 G5 轴', axesForGate('G6').join() === axesForGate('G5').join() && axesForGate('G7').join() === axesForGate('G5').join())
  assert('gate G4 → 空轴（假设是推进手段）', axesForGate('G4').length === 0 && axesForGate('G3').length === 0)

  // 筛选
  assert('G5 轴命中 api-ready，不含 release', unresolvedAssumptions({ ledger, axes: axesForGate('G5') }).map((i) => i.id).join() === 'ASM-001')
  assert('G8 轴命中 api-ready + release', unresolvedAssumptions({ ledger, axes: axesForGate('G8') }).map((i) => i.id).join() === 'ASM-001,ASM-002')
  assert('prd-clarify 永不计入任何轴', [...axesForGate('G8'), ...axesForLifecycle('mock-retired')].every((axis) => axis !== 'prd-clarify'))
  assert('非 open 不计入', unresolvedAssumptions({ ledger, axes: ['api-ready'] }).every((i) => i.id !== 'ASM-004'))
  assert('空轴 → 空结果', unresolvedAssumptions({ ledger, axes: [] }).length === 0)
  assert('台账为空数组 → 空结果', unresolvedAssumptions({ ledger: { assumptions: [] }, axes: axesForGate('G8') }).length === 0)

  // gate 接线
  assert('台账缺失 → 不发 check', assumptionChecks({ ledger: null, gate: 'G8' }).length === 0)
  assert('G4 → 不发 check', assumptionChecks({ ledger, gate: 'G4' }).length === 0)
  const g5 = assumptionChecks({ ledger, gate: 'G5' })
  assert('G5 → DOC-ASSUM-001 fail 且列出 id', g5.length === 1 && g5[0].ruleId === 'DOC-ASSUM-001' && !g5[0].ok && g5[0].message.includes('ASM-001'))
  assert('G5 不提 release 轴假设', !g5[0].message.includes('ASM-002'))
  const g8 = assumptionChecks({ ledger, gate: 'G8' })
  assert('G8 → DOC-ASSUM-002 fail', g8[0].ruleId === 'DOC-ASSUM-002' && !g8[0].ok && g8[0].message.includes('ASM-002'))
  assert('check 是 error 级', g8[0].severity === 'error')
  const clean = assumptionChecks({ ledger: { assumptions: [asm('ASM-001', 'confirmed', 'api-ready'), asm('ASM-002', 'open', 'prd-clarify')] }, gate: 'G8' })
  assert('全销账 / 仅 prd-clarify → pass', clean.length === 1 && clean[0].ok)

  // G6-partial：等接口的 open 假设记为待对账 warn（ok:true）；完整 G6 仍 fail。
  const g6partial = assumptionChecks({ ledger, gate: 'G6', partial: true })
  assert('G6-partial → DOC-ASSUM-001 ok（待对账不阻断）', g6partial.length === 1 && g6partial[0].ruleId === 'DOC-ASSUM-001' && g6partial[0].ok)
  assert('G6-partial 列出待对账假设 ASM-001', g6partial[0].message.includes('ASM-001') && g6partial[0].message.includes('待对账'))
  const g6full = assumptionChecks({ ledger, gate: 'G6', partial: false })
  assert('完整 G6（非 partial）→ 仍 fail', !g6full[0].ok)

  if (!process.exitCode) console.log('assumption-ledger lib self-test passed (24 cases)')
}

if (process.argv[1] && process.argv[1].endsWith('assumption-ledger.mjs') && process.argv.includes('--self-test')) {
  selfTest()
}
