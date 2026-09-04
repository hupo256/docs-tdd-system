#!/usr/bin/env node

import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeTargetPath } from './l2-rule-resolver.mjs'

function patchPaths(value) {
  if (typeof value !== 'string') return []
  const expanded = value.replaceAll('\\n', '\n')
  return [...expanded.matchAll(/\*\*\* (?:Add|Update|Delete) File: ([^\r\n"']+)/g)].map((match) => match[1].trim())
}

// fd-dup 重定向（2>&1、>&2、1>&2）不是写文件，只是把一个 fd 指向另一个 fd。
// 写目标检测前先剥掉它们，否则末尾 `>{1,2}` 会把 `2>&1` 误判成重定向写，
// 让只读命令（git fetch/status、vitest、grep …）被 deny。
export function stripFdDupRedirections(command) {
  if (typeof command !== 'string') return command
  return command.replace(/(^|[\s;|&])\d*>\s*&\s*\d+(?=$|[\s;|&])/g, '$1')
}

function shellTargets(command) {
  if (typeof command !== 'string') return []
  const normalized = stripFdDupRedirections(command)
  const targets = [...patchPaths(normalized)]
  for (const match of normalized.matchAll(/(?:^|[^>])>{1,2}\s*(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  for (const match of normalized.matchAll(/\b(?:touch|rm|unlink)\s+(?:--\s+)?(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  for (const match of normalized.matchAll(/\b(?:tee|truncate)\s+(?:-[^\s]+\s+)*(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  for (const match of normalized.matchAll(/\b(?:cp|mv)\s+(?:-[^\s]+\s+)*(?:["']?[^\s"';&|]+["']?\s+)+(["']?)([^\s"';&|]+)\1(?=\s*(?:[;&|]|$))/g)) targets.push(match[2])
  for (const match of normalized.matchAll(/\b(?:biome|prettier)\b[^\n;&|]*\s(?:--write|check\s+--write)[^\n;&|]*\s(["']?)([^\s"';&|]+)\1/g)) targets.push(match[2])
  return targets
}

function looksLikeUnresolvedWrite(command) {
  return typeof command === 'string' && /(?:^|\s)(?:sed\s+-i|perl\s+-pi|cp\s|mv\s|tee\s|truncate\s|python\s+-c|node\s+-e)|>{1,2}/.test(stripFdDupRedirections(command))
}

export function extractTargets(input) {
  const toolInput = input?.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  const targets = []
  for (const key of ['file_path', 'filePath']) {
    if (typeof toolInput[key] === 'string') targets.push(toolInput[key])
  }
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (typeof edit?.file_path === 'string') targets.push(edit.file_path)
      if (typeof edit?.filePath === 'string') targets.push(edit.filePath)
    }
  }
  for (const key of ['patch', 'code', 'input']) targets.push(...patchPaths(toolInput[key]))
  for (const key of ['command', 'cmd']) targets.push(...shellTargets(toolInput[key]))
  return [...new Set(targets)]
}

export function isPotentialUnresolvedWrite(input) {
  const toolInput = input?.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  return looksLikeUnresolvedWrite(toolInput.command)
    || looksLikeUnresolvedWrite(toolInput.cmd)
    || (typeof toolInput.code === 'string' && /tools\.(?:apply_patch|exec_command)\s*\(/.test(toolInput.code))
}

export function classifyTargets(input, worktree) {
  const repoTargets = []
  const externalTargets = []
  let dynamicTarget = false
  for (const target of extractTargets(input)) {
    if (/[$`*?{}]|^~(?:\/|$)/.test(target)) {
      dynamicTarget = true
      continue
    }
    try {
      repoTargets.push(normalizeTargetPath(worktree, target))
    } catch {
      externalTargets.push(target)
    }
  }
  const toolInput = input?.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  const commands = [toolInput.command, toolInput.cmd].filter((value) => typeof value === 'string')
  const opaqueWrite = commands.some((command) => /(?:^|\s)(?:sed\s+-i|perl\s+-pi|python\s+-c|node\s+-e)(?:\s|$)/.test(command))
    || (typeof toolInput.code === 'string' && /tools\.(?:apply_patch|exec_command)\s*\(/.test(toolInput.code) && repoTargets.length === 0)
  return {
    repoTargets: [...new Set(repoTargets)],
    externalTargets: [...new Set(externalTargets)],
    unknownWrite: dynamicTarget || opaqueWrite || (isPotentialUnresolvedWrite(input) && repoTargets.length === 0 && externalTargets.length === 0),
  }
}

function selfTest() {
  assert.deepEqual(extractTargets({ tool_input: { file_path: 'a.ts' } }), ['a.ts'])
  assert.deepEqual(extractTargets({ tool_input: { edits: [{ filePath: 'a.ts' }, { file_path: 'b.ts' }] } }), ['a.ts', 'b.ts'])
  assert.deepEqual(extractTargets({ tool_input: { patch: '*** Begin Patch\n*** Update File: src/a.ts\n*** Add File: src/b.ts\n*** End Patch' } }), ['src/a.ts', 'src/b.ts'])
  assert.deepEqual(extractTargets({ tool_input: { code: 'const p = "*** Add File: src/b.ts\\n+x"' } }), ['src/b.ts'])
  assert.deepEqual(extractTargets({ tool_input: { command: "printf x > 'src/c.ts'" } }), ['src/c.ts'])
  const external = classifyTargets({ tool_input: { command: 'npm test > /dev/null 2>&1' } }, '/repo')
  assert.equal(external.repoTargets.length, 0)
  assert.deepEqual(external.externalTargets, ['/dev/null'])
  assert.equal(classifyTargets({ tool_input: { command: 'git fetch origin pre 2>&1' } }, '/repo').unknownWrite, false)
  assert.equal(classifyTargets({ tool_input: { command: 'git status 2>&1 | head' } }, '/repo').unknownWrite, false)
  assert.equal(classifyTargets({ tool_input: { command: 'grep -c x file 2>&1' } }, '/repo').unknownWrite, false)
  assert.deepEqual(extractTargets({ tool_input: { command: 'printf x > src/out.txt 2>&1' } }), ['src/out.txt'])
  assert.deepEqual(classifyTargets({ tool_input: { command: 'cp /tmp/a src/a.ts' } }, '/repo').repoTargets, ['src/a.ts'])
  assert.equal(classifyTargets({ tool_input: { command: "python -c 'open(\"src/a.ts\",\"w\").write(\"x\")' > /tmp/out" } }, '/repo').unknownWrite, true)
  assert.equal(classifyTargets({ tool_input: { command: 'printf x > "$TMPDIR/out"' } }, '/repo').unknownWrite, true)
  console.log('PASS hook-targets (single/multi-file and shell target extraction)')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv.includes('--self-test')) selfTest()
