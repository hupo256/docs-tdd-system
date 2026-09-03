#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REQUIRED_AGENT_CLIENT_IDS = Object.freeze(['codex', 'claude', 'cursor', 'lark-codex', 'lark-claude'])

const CLIENT_DEFINITIONS = Object.freeze([
  {
    id: 'codex',
    kind: 'direct',
    adapter: 'codex',
    enforcement: 'PreToolUse rule injection + PostToolUse receipt/code gate + changed/gate',
  },
  {
    id: 'claude',
    kind: 'direct',
    adapter: 'claude',
    enforcement: 'PreToolUse rule injection + PostToolUse receipt + changed/gate',
  },
  {
    id: 'cursor',
    kind: 'direct',
    adapter: 'cursor',
    enforcement: 'native glob/alwaysApply + resolver conformance + changed/gate',
  },
  {
    id: 'lark-codex',
    kind: 'unattended',
    delegatesTo: 'codex',
    adapter: 'lark',
    enforcement: 'fresh effective rules + focused context + worker quality gate',
  },
  {
    id: 'lark-claude',
    kind: 'unattended',
    delegatesTo: 'claude',
    adapter: 'lark',
    enforcement: 'fresh effective rules + focused context + worker quality gate',
  },
])

/** Build the exhaustive client matrix from one canonical L1/L2/L3 source set. */
export function createAgentClientMatrix({ canonicalSources, adapterLabels }) {
  const sourceFingerprint = createHash('sha256').update(JSON.stringify(canonicalSources)).digest('hex')
  return Object.fromEntries(
    CLIENT_DEFINITIONS.map((definition) => [
      definition.id,
      {
        kind: definition.kind,
        ...(definition.delegatesTo ? { delegatesTo: definition.delegatesTo } : {}),
        adapter: adapterLabels[definition.adapter],
        enforcement: definition.enforcement,
        sourceFingerprint,
        ...canonicalSources,
      },
    ]),
  )
}

/** Report missing, extra, or incompletely enforced AI entrypoints. */
export function validateAgentClientMatrix(matrix) {
  const actual = Object.keys(matrix || {}).sort()
  const required = [...REQUIRED_AGENT_CLIENT_IDS].sort()
  const missing = required.filter((id) => !actual.includes(id))
  const extra = actual.filter((id) => !required.includes(id))
  const incomplete = actual.filter((id) => {
    const client = matrix[id]
    return !client?.adapter || !client?.enforcement || !client?.sourceFingerprint
  })
  return {
    ok: missing.length === 0 && extra.length === 0 && incomplete.length === 0,
    missing,
    extra,
    incomplete,
  }
}

const RUNTIME_REQUIREMENTS = Object.freeze({
  codex: ['l1', 'adapterProtocol', 'preToolRuleInjection', 'postToolReceipt', 'postToolCodeGate'],
  claude: ['l1', 'adapterProtocol', 'preToolRuleInjection', 'postToolReceipt', 'postToolCodeGate'],
  cursor: ['l1', 'adapterProtocol', 'nativeL2Rules', 'changedGateFallback'],
  'lark-codex': ['runtimeAdapter', 'focusedContext', 'workerQualityGate'],
  'lark-claude': ['runtimeAdapter', 'focusedContext', 'workerQualityGate'],
})

/** Validate independently observed loader/executor capabilities for each client. */
export function validateRuntimeClientConformance(observed = {}) {
  const missing = {}
  for (const client of REQUIRED_AGENT_CLIENT_IDS) {
    const absent = RUNTIME_REQUIREMENTS[client].filter((capability) => observed[client]?.[capability] !== true)
    if (absent.length) missing[client] = absent
  }
  return { ok: Object.keys(missing).length === 0, missing }
}

function selfTest() {
  const matrix = createAgentClientMatrix({
    canonicalSources: {
      l1: ['/l1'],
      l2: ['/l2'],
      l3Router: '/l3',
      l3Fingerprint: 'l3',
    },
    adapterLabels: {
      codex: '/codex',
      claude: '/claude',
      cursor: '/cursor',
      lark: '/lark',
    },
  })
  assert.deepEqual(Object.keys(matrix), REQUIRED_AGENT_CLIENT_IDS)
  assert.equal(new Set(Object.values(matrix).map((client) => client.sourceFingerprint)).size, 1)
  assert.equal(matrix['lark-codex'].delegatesTo, 'codex')
  assert.equal(matrix['lark-claude'].delegatesTo, 'claude')
  assert.equal(validateAgentClientMatrix(matrix).ok, true)
  assert.deepEqual(validateAgentClientMatrix({ codex: matrix.codex }).missing.sort(), REQUIRED_AGENT_CLIENT_IDS.filter((id) => id !== 'codex').sort())
  assert.deepEqual(validateAgentClientMatrix({ ...matrix, unknown: matrix.codex }).extra, ['unknown'])
  assert.deepEqual(
    validateAgentClientMatrix({
      ...matrix,
      cursor: { ...matrix.cursor, enforcement: '' },
    }).incomplete,
    ['cursor'],
  )
  const observed = Object.fromEntries(
    Object.entries(RUNTIME_REQUIREMENTS).map(([client, requirements]) => [client, Object.fromEntries(requirements.map((requirement) => [requirement, true]))]),
  )
  assert.equal(validateRuntimeClientConformance(observed).ok, true)
  observed.codex.postToolCodeGate = false
  assert.deepEqual(validateRuntimeClientConformance(observed).missing, { codex: ['postToolCodeGate'] })
  console.log('agent-clients self-test passed.')
}

if (process.argv.includes('--self-test') && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) selfTest()
