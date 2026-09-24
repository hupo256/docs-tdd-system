#!/usr/bin/env node
// Fail-closed validation for excluding semantic source units from requirements.

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const EXCLUSION_BASES = new Set(['explicit-out-of-scope', 'example-only', 'context-only'])

const FEATURE_SIGNAL_RE = /(?:新增|增加|添加|支持|必须|需要|要求|提供|启用|修改|调整|导出|筛选|搜索|按钮|入口|字段|弹窗|\badd\b|\bnew\b|\bsupport\b|\bmust\b|\bshall\b|\brequired?\b|\bprovide\b|\benable\b|\bchange\b|\bupdate\b|\bexport\b|\bfilter\b|\bsearch\b|\bbutton\b|\bentry\b|\bfield\b|\bmodal\b)/i
const PASSIVE_DISPLAY_RE = /(?:自然展示|自动展示|自动包含|自动生成|自动记录|沿用现有逻辑|保持现状|无需专项开发|无需改动|existing logic|automatically (?:display|appear|include|generate|record)|appears? automatically|no dedicated development)/i
const OUT_OF_SCOPE_RE = /(?:不在本期|不在本次|明确排除|不做|无需实现|不需要开发|不需要前端改动|out of scope|excluded from this release|do not implement|no implementation required)/i

const normalizeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

export function sourceUnitDispositionProblems(disposition, unit, { label = disposition?.sourceId || 'sourceUnitDisposition' } = {}) {
  if (disposition?.disposition !== 'not-a-requirement') return []
  const problems = []
  const reason = disposition?.reason?.trim()
  const evidence = disposition?.exclusionEvidence
  const sourceText = normalizeText(unit?.content)
  const quote = normalizeText(evidence?.sourceQuote)

  if (!reason) problems.push(`${label} exclusion requires a reason`)
  if (!evidence || !EXCLUSION_BASES.has(evidence.basis) || !quote) {
    problems.push(`${label} exclusion requires evidence basis and sourceQuote`)
    return problems
  }
  if (!sourceText || !sourceText.includes(quote)) problems.push(`${label} exclusion sourceQuote is not present in the source unit`)

  const hasFeatureSignal = FEATURE_SIGNAL_RE.test(sourceText)
  if (hasFeatureSignal && evidence.basis !== 'explicit-out-of-scope') {
    if (PASSIVE_DISPLAY_RE.test(sourceText)) {
      problems.push(`${label} cannot exclude a source unit that mixes passive-display wording with an explicit feature`)
    } else {
      problems.push(`${label} contains an explicit feature signal and must be anchored or explicitly out of scope`)
    }
  }
  if (evidence.basis === 'explicit-out-of-scope' && !OUT_OF_SCOPE_RE.test(quote)) {
    problems.push(`${label} explicit-out-of-scope evidence must quote an explicit exclusion`)
  }
  return problems
}

export function selfTest() {
  const unit = { sourceId: 'SRC-1', content: '背景说明：该截图仅为现状示例。' }
  assert.deepEqual(sourceUnitDispositionProblems({
    sourceId: 'SRC-1',
    disposition: 'not-a-requirement',
    reason: 'context only',
    exclusionEvidence: { basis: 'context-only', sourceQuote: '该截图仅为现状示例' },
  }, unit), [])
  assert.match(sourceUnitDispositionProblems({
    sourceId: 'SRC-1',
    disposition: 'not-a-requirement',
    reason: 'context only',
  }, unit).join(' '), /evidence/)
  assert.match(sourceUnitDispositionProblems({
    sourceId: 'SRC-2',
    disposition: 'not-a-requirement',
    reason: 'natural display',
    exclusionEvidence: { basis: 'context-only', sourceQuote: '数据会自然展示' },
  }, { sourceId: 'SRC-2', content: '数据会自然展示，同时需要新增导出按钮。' }).join(' '), /mixes passive-display/)
  assert.deepEqual(sourceUnitDispositionProblems({
    sourceId: 'SRC-3',
    disposition: 'not-a-requirement',
    reason: 'explicitly excluded',
    exclusionEvidence: { basis: 'explicit-out-of-scope', sourceQuote: '导出功能不在本期范围' },
  }, { sourceId: 'SRC-3', content: '导出功能不在本期范围。' }), [])
  console.log('vnext-source-disposition self-test passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) selfTest()
