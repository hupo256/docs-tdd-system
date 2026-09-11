#!/usr/bin/env node

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// A lint-staged entry alone is insufficient: its glob can omit deletions and non-code files. The
// tracked hook must name the wrapper (or delivery guard) so invocation is unconditional per commit.
export function hasUnconditionalTeamPrecommit({ teamConfigContent, trackedHookContent, teamMarker, deliveryMarker }) {
  const wrapperIsUnconditional = trackedHookContent.includes(teamMarker)
  const splitGatesAreComplete = teamConfigContent.includes(teamMarker) && trackedHookContent.includes(deliveryMarker)
  return wrapperIsUnconditional || splitGatesAreComplete
}

function selfTest() {
  const contract = { teamMarker: 'precommit-verify-code-rules.mjs', deliveryMarker: 'vnext-delivery-guard.mjs' }
  assert.equal(hasUnconditionalTeamPrecommit({ ...contract, teamConfigContent: 'precommit-verify-code-rules.mjs', trackedHookContent: 'pnpm lint-staged' }), false)
  assert.equal(hasUnconditionalTeamPrecommit({ ...contract, teamConfigContent: '{}', trackedHookContent: 'node precommit-verify-code-rules.mjs' }), true)
  assert.equal(hasUnconditionalTeamPrecommit({ ...contract, teamConfigContent: 'precommit-verify-code-rules.mjs', trackedHookContent: 'node vnext-delivery-guard.mjs' }), true)
  assert.equal(hasUnconditionalTeamPrecommit({ ...contract, teamConfigContent: '{}', trackedHookContent: 'node vnext-delivery-guard.mjs' }), false)
  console.log('precommit-wiring self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else console.log('usage: import hasUnconditionalTeamPrecommit from lib/precommit-wiring.mjs')
}
