#!/usr/bin/env node
// 人工确认签名（DOC-CONFIRM-001..004）。
//
// 为什么需要这一层：README「人机分界」写着 G5-G8 以**人工确认为锚点**（真实联调、视觉还原、
// 交互手感、QA 用例执行），但在此之前三份判断层文件里连写签名的字段都没有——
// `stage-status.schema.json` 的 required 只有 status/reason/evidence/updatedAt 且
// `additionalProperties:false`，也就是说「谁确认的、什么时候确认的」在机器侧完全不存在。
// 结果是 Agent 自己把 G5 写成 completed、自己把 manual-visual 验收项写成 passed，
// gate 只能校验结构与证据路径存在，无法区分「人看过」和「AI 声称人看过」。
//
// 本 lib 只判定签名有没有、像不像人签的，不判断确认内容对不对（那是人的事）。
// 严重度一律 warn：机制先立、字段先落，下一轮再按 rule-ids-and-gates.md §2.1 的晋级判据转 error。
//
// 纯函数、无 I/O。

// 需要人工确认的处置态：这些 status 都断言了「人已经看过/试过」，而非机器可判定的事实。
export const G5_CONFIRMED_STATUSES = ['completed', 'not-applicable', 'frontend-complete-pending-reconcile']
export const G7_CONFIRMED_STATUSES = ['completed', 'skipped']
// 靠人眼/人手判定的验收方式：vitest/contract 有机器退出码兜底，这三种没有。
export const HUMAN_JUDGED_METHODS = ['manual', 'manual-visual', 'browser']

// AI 客户端名不算人工签名——Agent 用自己的名字签「人工确认」是这条规则要防的主要形态。
// 只匹配独立词，避免误伤 "Cursor 组的 aichen" 之类真人名（子串匹配会假阳性）。
const AGENT_WORDS = new Set([
  'ai', 'agent', 'bot', 'assistant', 'automation', 'ci', 'system', 'auto',
  'codex', 'claude', 'cursor', 'pi', 'copilot', 'gpt', 'gemini', 'devin', 'aider',
  'lark-codex', 'lark-claude', 'claude-code', 'docs-tdd', 'tbd', 'n/a', 'unknown',
])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// 'missing'（没填）/ 'agent'（填的是 AI 或占位）/ 'human'（看起来是个人）。
export function classifySignature(entity) {
  if (typeof entity !== 'string' || entity.trim().length === 0) return 'missing'
  const words = entity.toLowerCase().split(/[\s,/;、，]+/).filter(Boolean)
  if (words.every((word) => AGENT_WORDS.has(word.replace(/[()（）]/g, '')))) return 'agent'
  return 'human'
}

// 一条「签名 + 日期」是否成立：签名像人，且日期是 YYYY-MM-DD。
// 返回 { ok, kind } —— kind 供调用方拼具体缺什么（缺签名 / AI 代签 / 缺日期）。
export function signatureState(confirmedBy, confirmedAt) {
  const kind = classifySignature(confirmedBy)
  if (kind !== 'human') return { ok: false, kind }
  if (!DATE_RE.test(String(confirmedAt ?? ''))) return { ok: false, kind: 'no-date' }
  return { ok: true, kind: 'human' }
}

const REASON = {
  missing: '缺 confirmedBy（人工确认签名）',
  agent: 'confirmedBy 填的是 AI 客户端或占位符，不算人工确认',
  'no-date': '缺 confirmedAt（须 YYYY-MM-DD）',
}

export function signatureReason(kind) {
  return REASON[kind] || '签名不完整'
}

// DOC-CONFIRM-001 / 002：G5 / G7 的人工处置态须带签名。
// 非人工处置态（pending/blocked）不判定——它们本来就还没到「人确认」这一步，返回 null。
export function stageConfirmationCheck({ stage, status, file = 'agent/stage-status.json' }) {
  const ruleId = stage === 'G5' ? 'DOC-CONFIRM-001' : stage === 'G7' ? 'DOC-CONFIRM-002' : null
  if (!ruleId) return null
  const allowed = stage === 'G5' ? G5_CONFIRMED_STATUSES : G7_CONFIRMED_STATUSES
  if (!status || !allowed.includes(status.status)) return null
  const state = signatureState(status.confirmedBy, status.confirmedAt)
  return {
    ruleId,
    file,
    category: 'documentation',
    severity: 'warn',
    ok: state.ok,
    message: state.ok
      ? `${stage}=${status.status} 有人工确认签名（${status.confirmedBy} / ${status.confirmedAt}）`
      : `${stage}=${status.status} 断言了人工确认，但${signatureReason(state.kind)}——README 人机分界要求 ${stage} 以人工确认为锚点`,
  }
}

// DOC-CONFIRM-003：manual / manual-visual / browser 的 passed 验收项须逐条带签名。
// 聚合式（一条 check 点名所有缺签名项），与 DOC-AC-* / DOC-BLOCK-* 口径一致。
export function acceptanceConfirmationCheck({ report, file = 'agent/acceptance-results.json' }) {
  const items = Array.isArray(report?.items) ? report.items : []
  const subject = items.filter((item) => item && item.status === 'passed' && HUMAN_JUDGED_METHODS.includes(item.method))
  if (subject.length === 0) return null
  const unsigned = subject
    .map((item) => ({ item, state: signatureState(item.confirmedBy, item.confirmedAt) }))
    .filter((entry) => !entry.state.ok)
  return {
    ruleId: 'DOC-CONFIRM-003',
    file,
    category: 'documentation',
    severity: 'warn',
    ok: unsigned.length === 0,
    message: unsigned.length
      ? `人工判定的 passed 验收项缺确认签名：${unsigned.map((entry) => `${entry.item.id}/${entry.item.method}(${signatureReason(entry.state.kind)})`).join('、')}`
      : `人工判定的 passed 验收项均有确认签名（${subject.length} 项）`,
  }
}

// DOC-CONFIRM-004：code-review.json 的人工签收。
// `reviewer` 不能兼任这个角色——它记的是「谁做了这次 review」，而这份 review 通常正是 Agent 自己产出的；
// confirmedBy 记的是「谁认了这个结论」。两者同名（都是人）才算人自己 review 过。
export function codeReviewConfirmationCheck({ report, file = 'agent/code-review.json' }) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null
  const state = signatureState(report.confirmedBy, report.confirmedAt)
  return {
    ruleId: 'DOC-CONFIRM-004',
    file,
    category: 'documentation',
    severity: 'warn',
    ok: state.ok,
    message: state.ok
      ? `code-review 有人工签收（${report.confirmedBy} / ${report.confirmedAt}）`
      : `code-review 结论无人工签收：${signatureReason(state.kind)}（reviewer=${report.reviewer || '?'} 只记录谁做的 review，不等于人认了结论）`,
  }
}

function selfTest() {
  const results = []
  const record = (name, condition) => {
    results.push(condition)
    if (!condition) {
      console.error(`FAIL ${name}`)
      process.exitCode = 1
    }
  }

  record('空签名 → missing', classifySignature('') === 'missing' && classifySignature(undefined) === 'missing')
  record('AI 名 → agent', classifySignature('claude') === 'agent' && classifySignature('Lark-Codex') === 'agent' && classifySignature('TBD') === 'agent')
  record('真人名 → human', classifySignature('aven') === 'human')
  record('含 AI 名的真人名不误判', classifySignature('aichen') === 'human' && classifySignature('cursor 组的 aven') === 'human')
  record('人 + 合法日期 → ok', signatureState('aven', '2026-08-23').ok === true)
  record('人 + 缺日期 → no-date', signatureState('aven', '').kind === 'no-date')
  record('人 + 非法日期 → no-date', signatureState('aven', '2026/08/23').kind === 'no-date')

  const signed = { status: 'completed', confirmedBy: 'aven', confirmedAt: '2026-08-23' }
  record('G5 completed 缺签名 → warn fail', (() => {
    const check = stageConfirmationCheck({ stage: 'G5', status: { status: 'completed' } })
    return check?.ruleId === 'DOC-CONFIRM-001' && check.ok === false && check.severity === 'warn'
  })())
  record('G5 completed 有签名 → pass', stageConfirmationCheck({ stage: 'G5', status: signed })?.ok === true)
  record('G5 pending 不判定', stageConfirmationCheck({ stage: 'G5', status: { status: 'pending' } }) === null)
  record('G5 缺 stage-status 不判定', stageConfirmationCheck({ stage: 'G5', status: null }) === null)
  record('G5 停靠态也要签名', stageConfirmationCheck({ stage: 'G5', status: { status: 'frontend-complete-pending-reconcile' } })?.ok === false)
  record('G7 skipped 要签名', stageConfirmationCheck({ stage: 'G7', status: { status: 'skipped' } })?.ruleId === 'DOC-CONFIRM-002')
  record('G7 AI 代签 → fail 且点名', (() => {
    const check = stageConfirmationCheck({ stage: 'G7', status: { status: 'completed', confirmedBy: 'claude', confirmedAt: '2026-08-23' } })
    return check?.ok === false && check.message.includes('AI 客户端')
  })())
  record('G6 无对应规则', stageConfirmationCheck({ stage: 'G6', status: signed }) === null)

  const manualItem = { id: 'AC-1', method: 'manual-visual', status: 'passed' }
  record('无人工判定项 → 不发 check', acceptanceConfirmationCheck({ report: { items: [{ id: 'AC-2', method: 'vitest', status: 'passed' }] } }) === null)
  record('人工 passed 缺签名 → fail 点名', (() => {
    const check = acceptanceConfirmationCheck({ report: { items: [manualItem] } })
    return check?.ruleId === 'DOC-CONFIRM-003' && check.ok === false && check.message.includes('AC-1/manual-visual')
  })())
  record('人工 passed 有签名 → pass', acceptanceConfirmationCheck({ report: { items: [{ ...manualItem, confirmedBy: 'aven', confirmedAt: '2026-08-23' }] } })?.ok === true)
  record('人工但未 passed 不要求签名', acceptanceConfirmationCheck({ report: { items: [{ ...manualItem, status: 'blocked' }] } }) === null)
  record('缺 items 不判定', acceptanceConfirmationCheck({ report: {} }) === null)

  record('code-review 缺签收 → fail', (() => {
    const check = codeReviewConfirmationCheck({ report: { reviewer: 'claude', findings: [] } })
    return check?.ruleId === 'DOC-CONFIRM-004' && check.ok === false && check.message.includes('reviewer=claude')
  })())
  record('code-review 有签收 → pass', codeReviewConfirmationCheck({ report: { reviewer: 'claude', confirmedBy: 'aven', confirmedAt: '2026-08-23' } })?.ok === true)
  record('code-review 缺文件不判定', codeReviewConfirmationCheck({ report: null }) === null)

  if (!process.exitCode) console.log(`confirmation lib self-test passed (${results.length} cases)`)
}

if (process.argv[1]?.endsWith('confirmation.mjs') && process.argv.includes('--self-test')) selfTest()
