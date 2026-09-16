#!/usr/bin/env node
// Generate a mostly pre-filled human-run checklist, or apply the operator's minimal confirmation.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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
      console.log(JSON.stringify({ projectId: workItem.projectId, output: resolve(outputFile), prefilled: ['scope', 'environment', 'time', 'requirement/surface mapping'], humanRequired: ['confirmedBy', 'result'], conditional: ['actualResult when failed', 'blocker when not-testable', 'evidenceRefs/newOmissions when applicable'] }, null, 2))
    } else {
      const input = JSON.parse(readFileSync(resolve(inputFile), 'utf8'))
      const manualTestRun = applyManualTestConfirmation(workItem, input, code, { environment: { worktree, baseRef, headSha: code.headSha } })
      const persisted = persistVNextWorkItem(projectDir, { ...workItem, manualTestRun })
      console.log(JSON.stringify({ projectId: workItem.projectId, manualTestRun, persisted }, null, 2))
      process.exitCode = manualTestRun.status === 'passed' ? 0 : 1
    }
  } catch (error) {
    console.error(`vNext manual test failed: ${error.message}`)
    process.exitCode = 2
  }
}
