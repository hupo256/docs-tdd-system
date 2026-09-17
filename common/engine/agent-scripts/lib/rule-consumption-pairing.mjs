#!/usr/bin/env node

const NESTED_TOOL_PAIR_MAX_AGE_MS = 10 * 60 * 1000

export function matchingPendingTool(state, { toolUseId, file, previousHash, currentTime = Date.now() }) {
  const direct = state.pendingTools[toolUseId]
  if (direct?.contextEpoch === state.contextEpoch && direct.targets?.includes(file) && direct.perFile?.[file]) {
    return { pending: direct, preToolUseId: toolUseId }
  }

  // A client can expose a wrapper in PreToolUse but the nested apply_patch in
  // PostToolUse. Only reuse a recent, explicitly targeted, continuous hash chain.
  for (const [preToolUseId, pending] of Object.entries(state.pendingTools).reverse()) {
    const pendingAgeMs = currentTime - Date.parse(pending?.at || '')
    const isRecent = Number.isFinite(pendingAgeMs) && pendingAgeMs >= 0 && pendingAgeMs <= NESTED_TOOL_PAIR_MAX_AGE_MS
    if (!isRecent || pending?.contextEpoch !== state.contextEpoch || !pending.targets?.includes(file) || !pending.perFile?.[file]) continue
    const continuesApprovedHashChain = pending.beforeHashes?.[file] === previousHash
      || [...state.receipts].reverse().some((receipt) => receipt.file === file && receipt.preToolUseId === preToolUseId && receipt.fileHash === previousHash)
    if (continuesApprovedHashChain) return { pending, preToolUseId }
  }
  return null
}

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`rule-consumption-pairing self-test failed: ${message}`)
  }
  const currentTime = Date.parse('2026-09-16T12:00:00.000Z')
  const pending = {
    contextEpoch: 2,
    targets: ['a.ts'],
    perFile: { 'a.ts': { packFingerprint: 'pack', ruleHashes: ['rule'] } },
    beforeHashes: { 'a.ts': 'before' },
    at: '2026-09-16T11:59:00.000Z',
  }
  const state = { contextEpoch: 2, pendingTools: { wrapper: pending }, receipts: [] }
  assert(matchingPendingTool(state, { toolUseId: 'nested', file: 'a.ts', previousHash: 'before', currentTime })?.preToolUseId === 'wrapper', 'pairs a recent wrapper by target and initial hash')
  state.receipts.push({ file: 'a.ts', preToolUseId: 'wrapper', fileHash: 'middle' })
  assert(matchingPendingTool(state, { toolUseId: 'nested-2', file: 'a.ts', previousHash: 'middle', currentTime })?.preToolUseId === 'wrapper', 'pairs a continuous nested hash chain')
  assert(!matchingPendingTool(state, { toolUseId: 'nested', file: 'b.ts', previousHash: 'before', currentTime }), 'rejects an unapproved sibling target')
  pending.at = '2026-09-16T11:00:00.000Z'
  assert(!matchingPendingTool(state, { toolUseId: 'nested', file: 'a.ts', previousHash: 'before', currentTime }), 'rejects a stale wrapper')
  console.log('PASS rule-consumption-pairing (nested ids remain target-bound, hash-bound, and time-bound)')
}

if (process.argv[1]?.endsWith('rule-consumption-pairing.mjs') && process.argv.includes('--self-test')) selfTest()
