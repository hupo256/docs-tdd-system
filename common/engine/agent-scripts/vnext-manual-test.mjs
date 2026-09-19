#!/usr/bin/env node
// Generate a mostly pre-filled human-run checklist, or apply the operator's minimal confirmation.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codeFingerprint } from './lib/fingerprint.mjs'
import { applyManualTestConfirmation, createManualTestTemplate, selfTest } from './lib/vnext-manual-test.mjs'
import { persistVNextWorkItem } from './lib/vnext-persistence.mjs'

function argumentValue(flag) {
  const index = process.argv.indexOf(flag)
  return index < 0 ? '' : process.argv[index + 1] || ''
}

function writeJson(file, value) {
  mkdirSync(dirname(resolve(file)), { recursive: true })
  writeFileSync(resolve(file), `${JSON.stringify(value, null, 2)}\n`)
}

function persistLocalEvidenceRefs(input, projectDir, inputDir) {
  const scenarios = input?.confirmation?.scenarios || []
  for (const scenario of scenarios) {
    if (!Array.isArray(scenario.evidenceRefs)) continue
    scenario.evidenceRefs = scenario.evidenceRefs.map((ref) => {
      const value = String(ref).trim()
      if (/^(?:https:\/\/|evidence-run:|log:)/.test(value)) return value
      const source = resolve(inputDir, value)
      const existingProjectRef = resolve(projectDir, value)
      if (!existsSync(source) && existsSync(existingProjectRef)) return value
      if (!existsSync(source)) return value
      const digest = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0, 16)
      const targetDir = join(projectDir, 'evidence', 'manual')
      const target = join(targetDir, `${digest}-${basename(source)}`)
      mkdirSync(targetDir, { recursive: true })
      if (!existsSync(target)) copyFileSync(source, target)
      return relative(projectDir, target)
    })
  }
  return input
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else if (process.argv.includes('--help')) {
    console.log('usage: vnext-manual-test.mjs --project <v2-dir> --worktree <path> [--base <ref>] (--out <manual-test.json> | --input <manual-test.json>)')
  } else try {
    const projectDir = resolve(argumentValue('--project'))
    const worktree = resolve(argumentValue('--worktree'))
    const inputFile = argumentValue('--input')
    const outputFile = argumentValue('--out')
    if (!existsSync(join(projectDir, 'work-item.json'))) throw new Error(`work-item.json not found: ${projectDir}`)
    if (!argumentValue('--worktree')) throw new Error('--worktree is required')
    if (Boolean(inputFile) === Boolean(outputFile)) throw new Error('exactly one of --out or --input is required')
    const workItem = JSON.parse(readFileSync(join(projectDir, 'work-item.json'), 'utf8'))
    const baseRef = argumentValue('--base') || 'origin/online'
    const code = codeFingerprint(worktree, baseRef)
    if (outputFile) {
      const template = createManualTestTemplate(workItem, code, { worktree, baseRef })
      writeJson(outputFile, template)
      console.log(JSON.stringify({ projectId: workItem.projectId, output: resolve(outputFile), prefilled: ['runtime scenarios', 'steps', 'expected', 'environment', 'time', 'requirement/surface mapping'], humanRequired: ['confirmedBy', 'scenario result', 'actual for passed/failed', 'unresolved items'], conditional: ['blocker when not-testable', 'evidenceRefs when applicable'] }, null, 2))
    } else {
      const resolvedInputFile = resolve(inputFile)
      const input = persistLocalEvidenceRefs(JSON.parse(readFileSync(resolvedInputFile, 'utf8')), projectDir, dirname(resolvedInputFile))
      const manualTestRun = applyManualTestConfirmation(workItem, input, code, { environment: { worktree, baseRef, headSha: code.headSha }, projectDir })
      const persisted = persistVNextWorkItem(projectDir, { ...workItem, manualTestRun })
      console.log(JSON.stringify({ projectId: workItem.projectId, manualTestRun, persisted }, null, 2))
      process.exitCode = manualTestRun.status === 'passed' ? 0 : 1
    }
  } catch (error) {
    console.error(`vNext manual test failed: ${error.message}`)
    process.exitCode = 2
  }
}
