#!/usr/bin/env node

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Build the canonical Cursor adapter from the shared rule roots. */
export function createCursorAdapter({ sharedRoot, repoRoot, conflictOverrides = [] }) {
  const overrideLines = conflictOverrides.length
    ? [
        '',
        'Local L2 conflict overrides (personal only):',
        '',
        ...conflictOverrides.map((override) => `- \`${override.loserFiles.join('`, `')}\` is superseded by **${override.winner}** (${override.id}).`),
      ]
    : []
  return `---
description: Local FameEX rule router and execution protocol shared with Codex and Claude
alwaysApply: true
---

# FameEX Local Rule Adapter

L1 source: \`${sharedRoot}/AGENT.md\` and \`${sharedRoot}/skills/*\`.
L2 source: repository \`AGENTS.md\`, \`CLAUDE.md\`, and matching \`.cursor/rules/*.mdc\`.
L3 source: \`${repoRoot}/apps/web/docs_tdd/common/rules/rule-router.md\`.

For FameEX tasks, read repository \`AGENTS.md\`, repository \`CLAUDE.md\`, the matching \`.cursor/rules/*.mdc\`, and \`rule-router.md\`. Unresolved L2 conflicts block coding; explicit local overrides below select the winner without changing tracked team rules.${overrideLines.join('\n')}

Then use:

- \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs context <PROJECT-ID> <SCENARIO> --client cursor\`
- \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs changed <PROJECT-ID> --client cursor\` after edits
- \`node apps/web/docs_tdd/common/engine/agent-scripts/docs-tdd.mjs gate <PROJECT-ID> <Gx> --client cursor\` at stage exit

If context is blocked or reports stale/conflicting rules, do not edit business code. Cursor has no trusted local PostToolUse gate in this setup, so \`changed\` is mandatory fallback. Do not copy rule bodies into this adapter.
`
}

function selfTest() {
  const adapter = createCursorAdapter({
    sharedRoot: '/shared',
    repoRoot: '/repo',
    conflictOverrides: [{ id: 'server-state', winner: 'React Query', loserFiles: ['.cursor/rules/swr.mdc'] }],
  })
  assert.match(adapter, /\/repo\/apps\/web\/docs_tdd\/common\/rules\/rule-router\.md/)
  assert.match(adapter, /common\/engine\/agent-scripts\/docs-tdd\.mjs context/)
  assert.match(adapter, /--client cursor/)
  assert.doesNotMatch(adapter, /docs_tdd\/common\/rule-router\.md/)
  assert.doesNotMatch(adapter, /docs_tdd\/common\/agent-scripts/)
  assert.match(adapter, /swr\.mdc.*React Query/)
  assert.notEqual(`${adapter}\n# drift`, adapter)
  console.log('agent-rule-adapters self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
