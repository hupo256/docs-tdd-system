#!/usr/bin/env node
/**
 * check-doc-budget.mjs 的纯解析/校验工具：码点计数、README frontmatter 解析、轻量 JSON Schema 校验。
 * 抽出到 lib 以便 `--self-test` 直测（此前内联在 gate 脚本里，只能靠整脚本实跑间接覆盖），
 * 同时给体量偏大的 check-doc-budget.mjs 瘦身。零 IO、零副作用。
 */

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** 码点数，近似“字符数”直觉（Chinese/emoji 各计 1）。 */
export function charCount(text) {
  return Array.from(text).length
}

// 解析 README 顶部 YAML frontmatter，只处理简单标量。
export function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return null
  const result = {}
  for (const line of match[1].split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()
    let quoted = false
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
      quoted = true
    }
    if (value === 'true') result[key] = true
    else if (value === 'false') result[key] = false
    else if (!quoted && /^\d+$/.test(value)) result[key] = Number(value)
    else result[key] = value
  }
  return result
}

// 轻量 JSON Schema 校验（draft-07 子集）。不引入外部依赖，覆盖 docs_tdd 所需类型/必填/枚举/模式/数组/对象。
export function validateSchema(value, schema, path = '') {
  const errors = []
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path || 'root'} 必须是 object`)
      return errors
    }
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${path || 'root'} 缺少必填字段 ${key}`)
    }
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validateSchema(value[key], propSchema, `${path}.${key}`))
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!schema.properties || !(key in schema.properties)) {
          errors.push(`${path || 'root'} 包含未声明字段 ${key}`)
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path || 'root'} 必须是 array`)
      return errors
    }
    for (let i = 0; i < value.length; i += 1) {
      errors.push(...validateSchema(value[i], schema.items, `${path}[${i}]`))
    }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${path || 'root'} 必须是 string`)
      return errors
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path} 值 "${value}" 不在枚举 [${schema.enum.join(', ')}] 中`)
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path} 值 "${value}" 不匹配模式 ${schema.pattern}`)
    }
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`${path} 长度必须 ≥ ${schema.minLength}`)
    }
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) {
      errors.push(`${path || 'root'} 必须是 integer`)
      return errors
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path} 必须 ≥ ${schema.minimum}`)
    }
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${path || 'root'} 必须是 boolean`)
  }
  return errors
}

export function selfTest() {
  // charCount：码点计数，中文/emoji 各计 1
  assert.equal(charCount('abc'), 3)
  assert.equal(charCount('中文'), 2)
  assert.equal(charCount('a😀b'), 3)

  // parseFrontmatter：标量类型归一 + 引号剥离 + 无 frontmatter 返回 null
  assert.equal(parseFrontmatter('no frontmatter'), null)
  assert.deepEqual(
    parseFrontmatter('---\nstage: G3\nactive: true\ndone: false\ncount: 12\nquoted: "42"\n---\nbody'),
    { stage: 'G3', active: true, done: false, count: 12, quoted: '42' },
  )

  // validateSchema：类型/必填/未声明字段/枚举/模式/数组/整数下限
  const schema = {
    type: 'object',
    required: ['id', 'stage'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: '^PR-\\d{4,}$' },
      stage: { type: 'string', enum: ['G0', 'G3', 'G6'] },
      order: { type: 'integer', minimum: 0 },
      tags: { type: 'array', items: { type: 'string' } },
    },
  }
  assert.deepEqual(validateSchema({ id: 'PR-01947', stage: 'G3', order: 1, tags: ['a'] }, schema), [])
  assert.deepEqual(validateSchema('nope', schema), ['root 必须是 object'])
  const bad = validateSchema({ id: 'X', stage: 'G9', order: -1, extra: 1, tags: [2] }, schema)
  assert.ok(bad.some((e) => e.includes('缺少必填字段')) === false) // id/stage 都在
  assert.ok(bad.some((e) => e.includes('不匹配模式')))
  assert.ok(bad.some((e) => e.includes('不在枚举')))
  assert.ok(bad.some((e) => e.includes('必须 ≥ 0')))
  assert.ok(bad.some((e) => e.includes('包含未声明字段 extra')))
  assert.ok(bad.some((e) => e.includes('必须是 string')))
  console.log('doc-budget-schema self-test passed (charCount, parseFrontmatter, validateSchema).')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--self-test')) {
  selfTest()
}
